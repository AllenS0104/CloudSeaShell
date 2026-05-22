// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
// Background images not used in Mini Program (bundled locally if needed)
const DAY_BACKGROUND = '';
const NIGHT_BACKGROUND = '';

const { clamp } = require('./math-utils');
const scoring = require('./scoring');
const guidance = require('./guidance');

const {
  scoreHumidity,
  scoreElevationGap,
  scoreVisibility,
  scoreWind,
  scoreCloudCover,
  scoreLowCloudCover,
  scoreDewPointSpread,
  scorePressure,
  precipitationPenalty,
  scoreTimeWindow,
  scoreInversion,
  scoreToConfidence,
  compositeReliabilityPenalty,
} = scoring;

const { formatTimeLabel } = guidance;

// Memoization cache for analyzeDayCloudSea
const _dayAnalysisCache = new Map();
const DAY_CACHE_MAX = 10;

function cloudBaseFromHumidity(temperature, humidity) {
  const safeTemperature = Number.isFinite(temperature) ? temperature : 0;
  const safeHumidity = Number.isFinite(humidity) ? humidity : 0;
  const safeDewPoint = safeTemperature - ((100 - safeHumidity) / 5);
  return Math.round(Math.max(0, 125 * (safeTemperature - safeDewPoint)));
}

function cloudBaseFromDewPoint(temperature, dewPoint) {
  const safeT = Number.isFinite(temperature) ? temperature : 0;
  const safeTd = Number.isFinite(dewPoint) ? dewPoint : 0;
  return Math.round(Math.max(0, 125 * (safeT - safeTd)));
}

function dewPointSpread(temperature, dewPoint) {
  return Number((Number(temperature ?? 0) - Number(dewPoint ?? 0)).toFixed(1));
}

function buildReasons({
  humidity,
  gapToElevation,
  visibility,
  windSpeed,
  cloudCover,
  lowCloudCover,
  dewPointGap,
  pressureMsl,
  precipitationProbability,
  precipitationAmount,
  timeScore,
  inversionDetected,
  inversionStrength,
}) {
  const reasons = [];

  if (inversionDetected) {
    reasons.push(`检测到逆温层（温差 ${inversionStrength.toFixed(1)}°C），有利于低云/雾层稳定维持。`);
  }

  if (gapToElevation >= 50) {
    reasons.push(`观测点比估算云底高约 ${Math.round(gapToElevation)} 米，具备俯看云层条件。`);
  } else if (gapToElevation < -100) {
    reasons.push('估算云底明显高于观测海拔，形成云海的地形条件偏弱。');
  }

  if (humidity >= 88) {
    reasons.push(`空气湿度 ${Math.round(humidity)}%，水汽条件较充足。`);
  } else {
    reasons.push(`空气湿度仅 ${Math.round(humidity)}%，水汽条件偏弱。`);
  }

  if (visibility >= 8000) {
    reasons.push(`能见度 ${(visibility / 1000).toFixed(1)} km，利于在云层上方获得开阔视野。`);
  } else {
    reasons.push(`能见度 ${(visibility / 1000).toFixed(1)} km，视野条件一般。`);
  }

  if (windSpeed <= 6) {
    reasons.push(`风速 ${windSpeed.toFixed(1)} m/s，云层结构相对更稳定。`);
  } else if (windSpeed > 10) {
    reasons.push(`风速 ${windSpeed.toFixed(1)} m/s 偏大，云层稳定性可能不足。`);
  }

  if (cloudCover >= 40 && cloudCover <= 95) {
    reasons.push(`云量 ${Math.round(cloudCover)}%，云层厚度区间较合适。`);
  }

  if (lowCloudCover >= 35) {
    reasons.push(`低层云量 ${Math.round(lowCloudCover)}%，更贴近云海所需的低云/雾层条件。`);
  }

  if (dewPointGap <= 3) {
    reasons.push(`温度与露点仅差 ${dewPointGap.toFixed(1)}°C，接近饱和，更容易形成低云和雾。`);
  }

  if (pressureMsl >= 1010) {
    reasons.push(`海平面气压 ${Math.round(pressureMsl)} hPa，天气形势相对更稳定。`);
  }

  if (precipitationProbability >= 60 || precipitationAmount >= 0.8) {
    reasons.push('降水信号偏强，虽然水汽充足，但观测体验和稳定性可能受影响。');
  }

  if (timeScore >= 5) {
    reasons.push('时段接近日出窗口，更符合常见云海出现条件。');
  }

  return reasons.slice(0, 5);
}

function analyzeCloudSeaSample({
  temperature,
  humidity,
  visibility,
  cloudCover,
  lowCloudCover,
  windSpeed,
  dewPoint,
  pressureMsl,
  precipitationProbability,
  precipitationAmount,
  elevation,
  timeString,
  sunriseTime,
  inversionScore = 0,
  inversionDetected = false,
  inversionStrength = 0,
}) {
  const safeTemperature = Number(temperature ?? 0);
  const safeHumidity = Number(humidity ?? 0);
  const safeVisibility = Number(visibility ?? 0);
  const safeCloudCover = Number(cloudCover ?? 0);
  const safeLowCloudCover = Number(lowCloudCover ?? 0);
  const safeWindSpeed = Number(windSpeed ?? 0);
  const safeDewPoint = Number(dewPoint ?? 0);
  const safePressureMsl = Number(pressureMsl ?? 0);
  const safePrecipitationProbability = Number(precipitationProbability ?? 0);
  const safePrecipitationAmount = Number(precipitationAmount ?? 0);
  const dewPointGap = dewPointSpread(safeTemperature, safeDewPoint);
  const cloudBase = (dewPoint !== null && dewPoint !== undefined)
    ? cloudBaseFromDewPoint(safeTemperature, safeDewPoint)
    : cloudBaseFromHumidity(safeTemperature, safeHumidity);
  const gapToElevation = elevation - cloudBase;
  const timeScore = scoreTimeWindow(timeString, sunriseTime);
  const penalty = precipitationPenalty(safePrecipitationProbability, safePrecipitationAmount);

  const baseScore = clamp(
    scoreHumidity(safeHumidity) +
      scoreElevationGap(gapToElevation) +
      scoreVisibility(safeVisibility) +
      scoreWind(safeWindSpeed) +
      scoreCloudCover(safeCloudCover) +
      scoreLowCloudCover(safeLowCloudCover) +
      scoreDewPointSpread(safeTemperature, safeDewPoint) +
      scorePressure(safePressureMsl) +
      timeScore +
      inversionScore,
    0,
    100,
  );
  const compositePenalty = compositeReliabilityPenalty({
    humidity: safeHumidity,
    windSpeed: safeWindSpeed,
    cloudCover: safeCloudCover,
    lowCloudCover: safeLowCloudCover,
    inversionDetected,
    dewPointGap,
    precipitationProbability: safePrecipitationProbability,
  });
  const score = clamp(baseScore - penalty - compositePenalty, 0, 100);
  const confidence = scoreToConfidence(score);
  const suggestion = score >= 55;

  return {
    cloudBase,
    humidity: safeHumidity,
    visibility: safeVisibility,
    cloudCover: safeCloudCover,
    lowCloudCover: safeLowCloudCover,
    windSpeed: safeWindSpeed,
    dewPoint: safeDewPoint,
    dewPointGap,
    pressureMsl: safePressureMsl,
    precipitationProbability: safePrecipitationProbability,
    precipitationAmount: safePrecipitationAmount,
    gapToElevation,
    timeScore,
    baseScore,
    penalty,
    score,
    confidenceLabel: confidence.label,
    confidenceLevel: confidence.level,
    suggestion,
    resultText: suggestion ? `${confidence.label}（${score} 分）` : `概率偏低（${score} 分）`,
    summary: suggestion
      ? '当前条件具备一定云海观测潜力，建议优先关注高海拔、视野开阔的位置。'
      : '当前条件暂不算理想，更适合作为参考而不是强结论。',
    reasons: buildReasons({
      humidity: safeHumidity,
      gapToElevation,
      visibility: safeVisibility,
      windSpeed: safeWindSpeed,
      cloudCover: safeCloudCover,
      lowCloudCover: safeLowCloudCover,
      dewPointGap,
      pressureMsl: safePressureMsl,
      precipitationProbability: safePrecipitationProbability,
      precipitationAmount: safePrecipitationAmount,
      timeScore,
      inversionDetected,
      inversionStrength,
    }),
  };
}

function analyzeCurrentCloudSea(current, elevation) {
  return analyzeCloudSeaSample({
    temperature: Number(current?.temperature_2m ?? 0),
    humidity: Number(current?.relative_humidity_2m ?? 0),
    visibility: Number(current?.visibility ?? 0),
    cloudCover: getCurrentCloudCover(current),
    lowCloudCover: getCurrentLowCloudCover(current),
    windSpeed: Number(current?.wind_speed_10m ?? 0),
    dewPoint: Number(current?.dew_point_2m ?? 0),
    pressureMsl: Number(current?.pressure_msl ?? 0),
    precipitationProbability: Number(current?.precipitation_probability ?? 0),
    precipitationAmount: Number(current?.precipitation ?? 0),
    elevation,
    timeString: current?.time,
  });
}

function getCurrentCloudCover(current) {
  return Number(current?.cloud_cover ?? current?.cloudcover ?? 0);
}

function getCurrentLowCloudCover(current) {
  return Number(current?.cloud_cover_low ?? current?.cloudcover_low ?? 0);
}

function getHourlyCloudCover(hourly, start, count = 24) {
  const values = hourly?.cloud_cover ?? hourly?.cloudcover ?? [];
  return values.slice(start, start + count).map((value) => Number(value ?? 0));
}

function getHourlyLowCloudCover(hourly, start, count = 24) {
  const values = hourly?.cloud_cover_low ?? hourly?.cloudcover_low ?? [];
  return values.slice(start, start + count).map((value) => Number(value ?? 0));
}

function minOrZero(values) {
  return values.length ? Math.min(...values) : 0;
}

function maxOrZero(values) {
  return values.length ? Math.max(...values) : 0;
}

function analyzeDayCloudSea(hourly, start, elevation, sunriseTimeFromAPI) {
  // Cache key based on start index + elevation + sunrise
  const cacheKey = `${start}_${elevation}_${sunriseTimeFromAPI || ''}`;
  if (_dayAnalysisCache.has(cacheKey)) {
    return _dayAnalysisCache.get(cacheKey);
  }

  const temperatures = hourly.temperature_2m.slice(start, start + 24).map((value) => Number(value ?? 0));
  const humidities = hourly.relative_humidity_2m.slice(start, start + 24).map((value) => Number(value ?? 0));
  const dewPoints = (hourly.dew_point_2m ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const pressureMsl = (hourly.pressure_msl ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const visibilities = (hourly.visibility ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const cloudCover = getHourlyCloudCover(hourly, start, 24);
  const lowCloudCover = getHourlyLowCloudCover(hourly, start, 24);
  const windSpeeds = (hourly.wind_speed_10m ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const precipitationProbabilities = (hourly.precipitation_probability ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const precipitationAmounts = (hourly.precipitation ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const timeSeries = hourly.time.slice(start, start + 24);
  const sunriseTime = sunriseTimeFromAPI || timeSeries.find((timeString) => {
    const hour = new Date(timeString).getHours();
    return hour >= 5 && hour <= 7;
  }) || timeSeries[0];
  const inversion = scoreInversion(temperatures);
  const hourlyAnalyses = temperatures.map((temperature, index) => analyzeCloudSeaSample({
    temperature,
    humidity: humidities[index],
    visibility: visibilities[index],
    cloudCover: cloudCover[index],
    lowCloudCover: lowCloudCover[index],
    windSpeed: windSpeeds[index],
    dewPoint: dewPoints[index],
    pressureMsl: pressureMsl[index],
    precipitationProbability: precipitationProbabilities[index],
    precipitationAmount: precipitationAmounts[index],
    elevation,
    timeString: timeSeries[index],
    sunriseTime,
    inversionScore: inversion.score,
    inversionDetected: inversion.detected,
    inversionStrength: inversion.strength,
  }));
  const cloudBases = hourlyAnalyses.map((analysis) => analysis.cloudBase);
  const bestHour = hourlyAnalyses.reduce((best, current, index) => {
    if (!best || current.score > best.score) {
      return {
        ...current,
        timeLabel: formatTimeLabel(timeSeries[index]),
      };
    }
    return best;
  }, null);

  const result = {
    temperatures,
    humidities,
    dewPoints,
    pressureMsl,
    visibilities,
    cloudCover,
    lowCloudCover,
    windSpeeds,
    precipitationProbabilities,
    precipitationAmounts,
    cloudBases,
    inversion,
    hourlyAnalyses,
    bestHour,
    score: bestHour?.score ?? 0,
    confidenceLabel: bestHour?.confidenceLabel ?? '较低',
    confidenceLevel: bestHour?.confidenceLevel ?? 'very-low',
    resultText: bestHour?.resultText ?? '概率偏低（0 分）',
    summary: bestHour?.suggestion
      ? `最佳观测窗口大约在 ${bestHour.timeLabel}，建议优先关注日出前后。`
      : '全天条件整体一般，可结合当地地形和实际云层再做判断。',
    reasons: bestHour?.reasons ?? [],
    suggestion: bestHour?.suggestion ?? false,
  };

  // Cache result (LRU-style eviction)
  if (_dayAnalysisCache.size >= DAY_CACHE_MAX) {
    const firstKey = _dayAnalysisCache.keys().next().value;
    _dayAnalysisCache.delete(firstKey);
  }
  _dayAnalysisCache.set(cacheKey, result);

  return result;
}

function windDirection(degrees) {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const safeDegrees = Number.isFinite(degrees) ? degrees : 0;
  return `${dirs[Math.round(safeDegrees / 45) % 8]}风`;
}

function formatDistanceKm(meters) {
  const safeMeters = Number.isFinite(meters) ? meters : 0;
  return `${(safeMeters / 1000).toFixed(1)} km`;
}

function formatCoords(lat, lon) {
  return `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`;
}

function pickBackgroundImage(timeString) {
  const hour = new Date(timeString).getHours();
  return hour >= 6 && hour < 18 ? DAY_BACKGROUND : NIGHT_BACKGROUND;
}


module.exports = Object.assign({
  cloudBaseFromHumidity,
  cloudBaseFromDewPoint,
  dewPointSpread,
  buildReasons,
  analyzeCloudSeaSample,
  analyzeCurrentCloudSea,
  analyzeDayCloudSea,
  getCurrentCloudCover,
  getCurrentLowCloudCover,
  getHourlyCloudCover,
  getHourlyLowCloudCover,
  minOrZero,
  maxOrZero,
  windDirection,
  formatDistanceKm,
  formatCoords,
  pickBackgroundImage,
  DAY_BACKGROUND,
  NIGHT_BACKGROUND,
}, scoring, guidance);
