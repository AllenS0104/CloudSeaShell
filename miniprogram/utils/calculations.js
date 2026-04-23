// Background images not used in Mini Program (bundled locally if needed)
const DAY_BACKGROUND = '';
const NIGHT_BACKGROUND = '';

const { clamp, lerp } = require('./math-utils');

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

function scoreHumidity(humidity) {
  const v = Number(humidity ?? 0);
  if (v >= 97) return 25;
  if (v >= 75) return Math.round(lerp(v, 75, 97, 0, 25));
  return 0;
}

function scoreElevationGap(gapToElevation) {
  if (gapToElevation >= 300) return 25;
  if (gapToElevation >= -100) return Math.round(lerp(gapToElevation, -100, 300, 0, 25));
  return 0;
}

function scoreVisibility(visibility) {
  const v = Number(visibility ?? 0);
  if (v >= 12000) return 15;
  if (v >= 2000) return Math.round(lerp(v, 2000, 12000, 2, 15));
  return 0;
}

function scoreWind(windSpeed) {
  const v = Number(windSpeed ?? 0);
  if (v <= 3) return 10;
  if (v <= 12) return Math.round(lerp(v, 3, 12, 10, 0));
  return 0;
}

function scoreCloudCover(cloudCover) {
  const v = Number(cloudCover ?? 0);
  if (v >= 40 && v <= 95) return 8;
  if (v >= 20 && v < 40) return Math.round(lerp(v, 20, 40, 2, 8));
  if (v > 95) return Math.round(lerp(v, 95, 100, 8, 4));
  return 0;
}

function scoreLowCloudCover(lowCloudCover) {
  const v = Number(lowCloudCover ?? 0);
  if (v >= 45 && v <= 95) return 12;
  if (v >= 25 && v < 45) return Math.round(lerp(v, 25, 45, 4, 12));
  if (v > 95) return Math.round(lerp(v, 95, 100, 12, 5));
  return 0;
}

function scoreDewPointSpread(temperature, dewPoint) {
  const spread = Number(temperature ?? 0) - Number(dewPoint ?? 0);
  if (spread <= 1.5) return 12;
  if (spread <= 7) return Math.round(lerp(spread, 1.5, 7, 12, 0));
  return 0;
}

function scorePressure(pressureMsl) {
  const v = Number(pressureMsl ?? 0);
  if (v >= 1016) return 5;
  if (v >= 1004) return Math.round(lerp(v, 1004, 1016, 0, 5));
  return 0;
}

function precipitationPenalty(precipitationProbability, precipitationAmount) {
  const prob = Number(precipitationProbability ?? 0);
  const amt = Number(precipitationAmount ?? 0);
  const probPenalty = prob >= 80 ? 10 : (prob >= 30 ? Math.round(lerp(prob, 30, 80, 0, 10)) : 0);
  const amtPenalty = amt >= 2 ? 10 : (amt >= 0.1 ? Math.round(lerp(amt, 0.1, 2, 0, 10)) : 0);
  return Math.min(15, Math.max(probPenalty, amtPenalty));
}

function scoreTimeWindow(timeString, sunriseTime) {
  if (!timeString) {
    return 0;
  }

  const time = new Date(timeString);
  if (Number.isNaN(time.getTime())) {
    return 0;
  }

  if (sunriseTime) {
    const sunrise = new Date(sunriseTime);
    const diffHours = Math.abs(time.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 1.5) return 10;
    if (diffHours <= 4) return Math.round(lerp(diffHours, 1.5, 4, 10, 2));
  }

  const hour = time.getHours();
  return hour >= 4 && hour <= 9 ? 3 : 0;
}

function scoreInversion(temperatures) {
  if (!Array.isArray(temperatures) || temperatures.length < 3) {
    return { score: 0, detected: false, strength: 0 };
  }

  let maxInversion = 0;
  for (let i = 1; i < temperatures.length; i += 1) {
    const diff = temperatures[i] - temperatures[i - 1];
    if (diff > 0) {
      maxInversion = Math.max(maxInversion, diff);
    }
  }

  if (maxInversion >= 3) return { score: 8, detected: true, strength: maxInversion };
  if (maxInversion >= 1) return { score: Math.round(lerp(maxInversion, 1, 3, 2, 8)), detected: true, strength: maxInversion };
  return { score: 0, detected: false, strength: 0 };
}

function scoreToConfidence(score) {
  const safeScore = clamp(Math.round(score), 0, 100);
  if (safeScore >= 75) {
    return { label: '高把握', level: 'high' };
  }
  if (safeScore >= 55) {
    return { label: '较高把握', level: 'medium' };
  }
  if (safeScore >= 35) {
    return { label: '一般', level: 'low' };
  }
  return { label: '较低', level: 'very-low' };
}

function dewPointSpread(temperature, dewPoint) {
  return Number((Number(temperature ?? 0) - Number(dewPoint ?? 0)).toFixed(1));
}

function formatTimeLabel(timeString) {
  if (!timeString) {
    return '--:--';
  }

  const value = new Date(timeString);
  if (Number.isNaN(value.getTime())) {
    return '--:--';
  }

  return value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function shiftMinutes(timeString, minutes) {
  const value = new Date(timeString);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  value.setMinutes(value.getMinutes() + minutes);
  return value.toISOString();
}

function windowAroundSunrise(sunriseTime) {
  if (!sunriseTime) {
    return '日出前后 1-2 小时';
  }

  const start = shiftMinutes(sunriseTime, -60);
  const end = shiftMinutes(sunriseTime, 90);
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

function recommendedViewpoint(gapToElevation) {
  if (gapToElevation >= 250) {
    return '当前位置已具备优势，优先选择山顶或高位观景台。';
  }
  if (gapToElevation >= 80) {
    return '建议选择无遮挡山脊、平台或观景台，尽量避免谷地。';
  }
  if (gapToElevation >= -80) {
    return '当前点位接近云底，建议再上切到附近更高的山脊线。';
  }
  return '当前点位大概率偏低，建议直接规划更高海拔山顶或次高峰。';
}

function recommendedTargetElevation(cloudBase, currentElevation) {
  const ideal = Math.round(cloudBase + 150);
  return Math.max(ideal, Math.round(currentElevation));
}

function buildObservationGuidance({
  analysis,
  currentElevation,
  sunriseTime,
  sunsetTime,
  bestTimeLabel,
}) {
  const targetElevation = recommendedTargetElevation(analysis.cloudBase, currentElevation);
  const goLevel = analysis.score >= 75
    ? '值得冲'
    : analysis.score >= 55
      ? '可以蹲守'
      : analysis.score >= 35
        ? '可观望'
        : '不建议专程前往';
  const goClass = analysis.score >= 55 ? 'go' : analysis.score >= 35 ? 'watch' : 'stop';

  const actionItems = [];
  if (analysis.precipitationProbability >= 60 || analysis.precipitationAmount >= 0.8) {
    actionItems.push('降水风险偏高，务必准备防水和保暖装备。');
  }
  if (analysis.windSpeed > 10) {
    actionItems.push('风偏大，优先避开完全暴露的山脊顶端。');
  } else {
    actionItems.push('风速尚可，适合提前到位等待云层变化。');
  }
  if (analysis.gapToElevation < 80) {
    actionItems.push(`建议把目标海拔提高到至少 ${targetElevation} m 左右。`);
  } else {
    actionItems.push(`当前海拔条件尚可，建议围绕 ${Math.round(currentElevation)} m 以上寻找最佳机位。`);
  }

  if (bestTimeLabel) {
    actionItems.push(`优先守候时段：${bestTimeLabel} 前后 30-60 分钟。`);
  } else {
    actionItems.push(`建议守候窗口：${windowAroundSunrise(sunriseTime)}。`);
  }

  const daylightWindow = sunriseTime && sunsetTime
    ? `${formatTimeLabel(sunriseTime)} 日出 / ${formatTimeLabel(sunsetTime)} 日落`
    : '优先关注日出前后';

  return {
    goLevel,
    goClass,
    targetElevation,
    recommendedWindow: bestTimeLabel ? `${bestTimeLabel} 前后` : windowAroundSunrise(sunriseTime),
    daylightWindow,
    viewpointAdvice: recommendedViewpoint(analysis.gapToElevation),
    actionItems: actionItems.slice(0, 4),
  };
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
  const score = clamp(
    baseScore - penalty,
    0,
    100,
  );
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
  const temperatures = hourly.temperature_2m.slice(start, start + 24).map((value) => Number(value ?? 0));
  const humidities = hourly.relative_humidity_2m.slice(start, start + 24).map((value) => Number(value ?? 0));
  const dewPoints = (hourly.dew_point_2m ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const pressureMsl = (hourly.pressure_msl ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const visibilities = hourly.visibility.slice(start, start + 24).map((value) => Number(value ?? 0));
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

  return {
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


module.exports = {
  cloudBaseFromHumidity,
  cloudBaseFromDewPoint,
  scoreInversion,
  scoreToConfidence,
  dewPointSpread,
  analyzeCloudSeaSample,
  analyzeCurrentCloudSea,
  analyzeDayCloudSea,
  buildObservationGuidance,
  getCurrentCloudCover,
  getCurrentLowCloudCover,
  windDirection,
  formatDistanceKm,
  formatCoords,
  pickBackgroundImage,
  minOrZero,
  maxOrZero,
  DAY_BACKGROUND,
  NIGHT_BACKGROUND,
};
