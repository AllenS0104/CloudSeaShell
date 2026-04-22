/**
 * Weather data processing and analysis orchestrator
 * Extracted from index.js to reduce page controller size
 */
const calc = require('./calculations');
const sunsetModule = require('./sunset');
const stars = require('./stargazing');
const photo = require('./photography');

function buildDayLabels(hourlyTime) {
  const daySet = new Set(hourlyTime.map(t => t.split('T')[0]));
  return Array.from(daySet).map((date, i) => {
    const d = new Date(date);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return i === 0
      ? `${d.getMonth() + 1}月${d.getDate()}日${weekday} (今天)`
      : `${d.getMonth() + 1}月${d.getDate()}日${weekday}`;
  });
}

function analyzeWeather(weatherData, elevation, selectedDayIndex) {
  const hourly = weatherData.hourly;
  const daily = weatherData.daily;
  const current = weatherData.current;
  const start = selectedDayIndex * 24;

  // Cloud sea analysis
  const dayAnalysis = calc.analyzeDayCloudSea(hourly, start, elevation);

  let analysis = dayAnalysis;
  if (selectedDayIndex === 0 && current) {
    const currentAnalysis = calc.analyzeCurrentCloudSea(current, elevation);
    analysis = { ...dayAnalysis, ...currentAnalysis };
  }

  // Guidance
  const sunrise = daily?.sunrise?.[selectedDayIndex];
  const sunset = daily?.sunset?.[selectedDayIndex];
  const guidance = calc.buildObservationGuidance({
    analysis: dayAnalysis.bestHour || analysis,
    currentElevation: elevation,
    sunriseTime: sunrise,
    sunsetTime: sunset,
    bestTimeLabel: dayAnalysis.bestHour?.timeLabel,
  });

  // Current stats
  const currentTemp = current
    ? Number(current.temperature_2m).toFixed(1)
    : dayAnalysis.temperatures[0]?.toFixed(1) || '--';
  const currentDewGap = current
    ? calc.dewPointSpread(current.temperature_2m, current.dew_point_2m)
    : calc.dewPointSpread(dayAnalysis.temperatures[0], dayAnalysis.dewPoints[0]);

  // Hourly list
  const times = hourly.time.slice(start, start + 24);
  const hourlyList = times.map((t, i) => ({
    time: t.slice(11, 16),
    temp: dayAnalysis.temperatures[i]?.toFixed(1) || '--',
    cloudBase: dayAnalysis.cloudBases[i] || 0,
    precip: dayAnalysis.precipitationProbabilities[i]?.toFixed(0) || '0',
  }));

  return {
    analysis, dayAnalysis, guidance,
    currentTemp, currentDewGap,
    hourlyList, sunrise, sunset, current, start,
  };
}

function analyzeGlow(hourly, start, sunrise, sunset) {
  const result = sunsetModule.analyzeDayGlow(hourly, start, sunrise, sunset);
  return {
    score: result.score,
    level: result.level,
    label: result.label,
    resultText: result.resultText,
    summary: result.summary,
    reasons: result.reasons,
    bestSunrise: result.bestSunrise ? { score: result.bestSunrise.score, label: result.bestSunrise.label } : null,
    bestSunset: result.bestSunset ? { score: result.bestSunset.score, label: result.bestSunset.label } : null,
  };
}

function analyzeStars(timeString, lat, cloudCover, visibility, humidity, elevation) {
  const starInfo = stars.scoreStargazing({
    date: timeString, latitude: lat,
    cloudCover, visibility, humidity, elevation,
  });
  const astroParams = stars.getAstroParams(starInfo.score, 24, 1);
  return {
    score: starInfo.score,
    level: starInfo.level,
    label: starInfo.label,
    resultText: starInfo.resultText,
    moonPhase: starInfo.moonPhase,
    moonIllum: starInfo.moonIllum,
    moonNote: starInfo.moonNote,
    milkyWay: starInfo.milkyWay,
    reasons: starInfo.reasons,
    astro: astroParams,
  };
}

function buildSafetyAlerts(hourly, start, current, elevation) {
  const alerts = [];
  const capeValues = (hourly.cape ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const maxCape = capeValues.length ? Math.max(...capeValues) : 0;

  if (maxCape >= 1000) {
    alerts.push({ type: 'danger', icon: '⛈️', text: `雷暴风险：CAPE ${Math.round(maxCape)} J/kg，山顶远离金属物体` });
  } else if (maxCape >= 500) {
    alerts.push({ type: 'warning', icon: '🌩️', text: `对流发展中：CAPE ${Math.round(maxCape)} J/kg，注意天气变化` });
  }

  const apparentTemp = current?.apparent_temperature ?? null;
  if (apparentTemp !== null && apparentTemp < 5) {
    alerts.push({ type: 'warning', icon: '🥶', text: `体感温度仅 ${Number(apparentTemp).toFixed(1)}°C，注意防寒保暖` });
  }

  if (elevation > 1500) {
    alerts.push({ type: 'info', icon: '⛰️', text: '高海拔区域注意防晒和补水，紫外线显著增强' });
  }

  return alerts;
}

function buildPhotoParams(timeString, sunrise, sunset, analysis, elevation) {
  return photo.generatePhotoRecommendations({
    timeString,
    sunriseTime: sunrise,
    sunsetTime: sunset,
    cloudCover: analysis.cloudCover,
    visibility: analysis.visibility,
    windSpeed: analysis.windSpeed,
    cloudSeaScore: analysis.score,
    elevation,
  });
}

module.exports = {
  buildDayLabels,
  analyzeWeather,
  analyzeGlow,
  analyzeStars,
  buildSafetyAlerts,
  buildPhotoParams,
};
