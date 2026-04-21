/**
 * Sunset glow / fire cloud (晚霞/火烧云) prediction module
 *
 * Physics: When the sun is at low angle (-4° ~ +6°), light travels through
 * thick atmosphere. Short wavelengths scatter away, leaving red/orange light
 * that illuminates mid/high-level thin clouds like a screen.
 *
 * Key factors (different from cloud-sea):
 * - Mid-level clouds (3-8km): the primary "screen" for glow
 * - High-level clouds (>8km): secondary screen, creates pink/purple tones
 * - Low clouds (<3km): BLOCKS the glow if too thick
 * - Humidity: moderate is best (40-75%), too high = overcast
 * - Clean air / good visibility helps color intensity
 */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(value, inLow, inHigh, outLow, outHigh) {
  const t = clamp((value - inLow) / (inHigh - inLow), 0, 1);
  return outLow + t * (outHigh - outLow);
}

/**
 * Score mid-level cloud cover (3-8km) — the primary glow "screen"
 * Best: 30-70%, too little = no canvas, too much = overcast
 */
function scoreMidCloud(midCover) {
  const v = Number(midCover ?? 0);
  if (v >= 30 && v <= 70) return 28;
  if (v >= 20 && v < 30) return Math.round(lerp(v, 20, 30, 10, 28));
  if (v > 70 && v <= 90) return Math.round(lerp(v, 70, 90, 28, 8));
  if (v > 90) return 4;
  if (v >= 10) return Math.round(lerp(v, 10, 20, 4, 10));
  return 0;
}

/**
 * Score high-level cloud cover (>8km) — secondary screen for pink/purple
 */
function scoreHighCloud(highCover) {
  const v = Number(highCover ?? 0);
  if (v >= 20 && v <= 60) return 18;
  if (v >= 10 && v < 20) return Math.round(lerp(v, 10, 20, 6, 18));
  if (v > 60 && v <= 85) return Math.round(lerp(v, 60, 85, 18, 6));
  if (v > 85) return 3;
  return Math.round(lerp(v, 0, 10, 0, 6));
}

/**
 * Penalty for low cloud cover — blocks glow from reaching mid/high layers
 */
function penaltyLowCloud(lowCover) {
  const v = Number(lowCover ?? 0);
  if (v >= 80) return 20;
  if (v >= 50) return Math.round(lerp(v, 50, 80, 5, 20));
  if (v >= 30) return Math.round(lerp(v, 30, 50, 0, 5));
  return 0;
}

/**
 * Score humidity — moderate is best for glow
 */
function scoreHumidityForGlow(humidity) {
  const v = Number(humidity ?? 0);
  if (v >= 40 && v <= 75) return 12;
  if (v >= 30 && v < 40) return Math.round(lerp(v, 30, 40, 4, 12));
  if (v > 75 && v <= 90) return Math.round(lerp(v, 75, 90, 12, 3));
  if (v > 90) return 2;
  return Math.round(lerp(v, 0, 30, 0, 4));
}

/**
 * Score visibility — cleaner air = more vivid colors
 */
function scoreVisibilityForGlow(visibility) {
  const v = Number(visibility ?? 0);
  if (v >= 15000) return 12;
  if (v >= 5000) return Math.round(lerp(v, 5000, 15000, 4, 12));
  if (v >= 2000) return Math.round(lerp(v, 2000, 5000, 1, 4));
  return 0;
}

/**
 * Score time window relative to sunset
 * Best: 30 min before to 15 min after sunset
 */
function scoreSunsetWindow(timeString, sunsetTime) {
  if (!timeString || !sunsetTime) return 0;

  const time = new Date(timeString);
  const sunset = new Date(sunsetTime);
  if (isNaN(time.getTime()) || isNaN(sunset.getTime())) return 0;

  const diffMin = (time.getTime() - sunset.getTime()) / (1000 * 60);

  // Peak: -30 to +15 min from sunset
  if (diffMin >= -30 && diffMin <= 15) return 20;
  // Good: -60 to -30 or +15 to +30
  if (diffMin >= -60 && diffMin < -30) return Math.round(lerp(diffMin, -60, -30, 8, 20));
  if (diffMin > 15 && diffMin <= 45) return Math.round(lerp(diffMin, 15, 45, 20, 6));
  // Marginal: wider window
  if (diffMin >= -90 && diffMin < -60) return 4;
  if (diffMin > 45 && diffMin <= 60) return 3;
  return 0;
}

/**
 * Sunrise glow scoring (similar logic, morning version)
 */
function scoreSunriseWindow(timeString, sunriseTime) {
  if (!timeString || !sunriseTime) return 0;

  const time = new Date(timeString);
  const sunrise = new Date(sunriseTime);
  if (isNaN(time.getTime()) || isNaN(sunrise.getTime())) return 0;

  const diffMin = (time.getTime() - sunrise.getTime()) / (1000 * 60);

  if (diffMin >= -15 && diffMin <= 30) return 20;
  if (diffMin >= -30 && diffMin < -15) return Math.round(lerp(diffMin, -30, -15, 8, 20));
  if (diffMin > 30 && diffMin <= 60) return Math.round(lerp(diffMin, 30, 60, 20, 6));
  if (diffMin >= -60 && diffMin < -30) return 4;
  if (diffMin > 60 && diffMin <= 90) return 3;
  return 0;
}

/**
 * Precipitation penalty
 */
function precipPenalty(precipProb, precipAmt) {
  const prob = Number(precipProb ?? 0);
  const amt = Number(precipAmt ?? 0);
  if (amt >= 1 || prob >= 70) return 15;
  if (amt >= 0.3 || prob >= 40) return Math.round(lerp(Math.max(prob / 70, amt / 1), 0.4, 1, 3, 15));
  return 0;
}

/**
 * Analyze sunset glow potential for a single time sample
 */
function analyzeGlowSample({
  cloudCoverMid,
  cloudCoverHigh,
  cloudCoverLow,
  humidity,
  visibility,
  precipitationProbability,
  precipitationAmount,
  timeString,
  sunriseTime,
  sunsetTime,
}) {
  const midScore = scoreMidCloud(cloudCoverMid);
  const highScore = scoreHighCloud(cloudCoverHigh);
  const lowPenalty = penaltyLowCloud(cloudCoverLow);
  const humidityScore = scoreHumidityForGlow(humidity);
  const visScore = scoreVisibilityForGlow(visibility);
  const sunsetScore = scoreSunsetWindow(timeString, sunsetTime);
  const sunriseScore = scoreSunriseWindow(timeString, sunriseTime);
  const timeScore = Math.max(sunsetScore, sunriseScore);
  const isEvening = sunsetScore >= sunriseScore;
  const penalty = precipPenalty(precipitationProbability, precipitationAmount);

  const rawScore = midScore + highScore + humidityScore + visScore + timeScore - lowPenalty - penalty;
  const score = clamp(rawScore, 0, 100);

  let level, label;
  if (score >= 70) { level = 'high'; label = '火烧云概率高'; }
  else if (score >= 50) { level = 'medium'; label = '晚霞潜力较好'; }
  else if (score >= 30) { level = 'low'; label = '可能有色彩'; }
  else { level = 'very-low'; label = '晚霞概率低'; }

  const reasons = buildGlowReasons({
    cloudCoverMid, cloudCoverHigh, cloudCoverLow,
    humidity, visibility, timeScore, isEvening,
    precipitationProbability, precipitationAmount,
  });

  return {
    score,
    level,
    label,
    isEvening,
    timeLabel: isEvening ? '日落' : '日出',
    midScore,
    highScore,
    lowPenalty,
    humidityScore,
    visScore,
    timeScore,
    penalty,
    reasons,
    resultText: score >= 50 ? `${label}（${score} 分）` : `${label}（${score} 分）`,
    summary: score >= 50
      ? `${isEvening ? '今日日落' : '今日日出'}前后有较好的霞光条件，建议提前到位守候。`
      : `${isEvening ? '日落' : '日出'}霞光条件一般，不确定性较大。`,
  };
}

function buildGlowReasons({ cloudCoverMid, cloudCoverHigh, cloudCoverLow, humidity, visibility, timeScore, isEvening, precipitationProbability, precipitationAmount }) {
  const reasons = [];
  const midV = Number(cloudCoverMid ?? 0);
  const highV = Number(cloudCoverHigh ?? 0);
  const lowV = Number(cloudCoverLow ?? 0);

  if (midV >= 30 && midV <= 70) {
    reasons.push(`中层云量 ${Math.round(midV)}%，薄云充当"光幕"，最利于霞光显色。`);
  } else if (midV < 20) {
    reasons.push(`中层云量仅 ${Math.round(midV)}%，缺少反射面，霞光可能不够壮观。`);
  } else {
    reasons.push(`中层云量 ${Math.round(midV)}%，云层偏厚可能影响色彩透射。`);
  }

  if (highV >= 20 && highV <= 60) {
    reasons.push(`高层云量 ${Math.round(highV)}%，有利于呈现粉紫色调。`);
  }

  if (lowV >= 50) {
    reasons.push(`低层云量 ${Math.round(lowV)}% 偏高，可能遮挡阳光到达中高层云。`);
  } else if (lowV <= 20) {
    reasons.push(`低层通透（${Math.round(lowV)}%），阳光无遮挡直达云层。`);
  }

  if (visibility >= 10000) {
    reasons.push(`能见度 ${(visibility / 1000).toFixed(0)} km，空气洁净有利于色彩饱和。`);
  }

  if (timeScore >= 15) {
    reasons.push(`时段接近${isEvening ? '日落' : '日出'}最佳窗口，散射角度最优。`);
  }

  if (precipitationProbability >= 40 || precipitationAmount >= 0.3) {
    reasons.push('有降水信号，可能影响霞光可见性。');
  }

  return reasons.slice(0, 4);
}

/**
 * Analyze glow potential for a full day (find best hour)
 */
function analyzeDayGlow(hourly, start, sunriseTime, sunsetTime) {
  const times = hourly.time.slice(start, start + 24);
  const midCovers = (hourly.cloud_cover_mid ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const highCovers = (hourly.cloud_cover_high ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const lowCovers = (hourly.cloud_cover_low ?? hourly.cloudcover_low ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const humidities = hourly.relative_humidity_2m.slice(start, start + 24).map(v => Number(v ?? 0));
  const visibilities = (hourly.visibility ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipProbs = (hourly.precipitation_probability ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipAmts = (hourly.precipitation ?? []).slice(start, start + 24).map(v => Number(v ?? 0));

  const hourlyAnalyses = times.map((t, i) => analyzeGlowSample({
    cloudCoverMid: midCovers[i],
    cloudCoverHigh: highCovers[i],
    cloudCoverLow: lowCovers[i],
    humidity: humidities[i],
    visibility: visibilities[i],
    precipitationProbability: precipProbs[i],
    precipitationAmount: precipAmts[i],
    timeString: t,
    sunriseTime,
    sunsetTime,
  }));

  // Find best glow hour
  const bestHour = hourlyAnalyses.reduce((best, current, index) => {
    if (!best || current.score > best.score) {
      return { ...current, timeLabel: times[index]?.slice(11, 16) || '--:--' };
    }
    return best;
  }, null);

  // Separate sunrise and sunset best
  const sunriseHours = hourlyAnalyses.filter(a => !a.isEvening && a.timeScore > 0);
  const sunsetHours = hourlyAnalyses.filter(a => a.isEvening && a.timeScore > 0);
  const bestSunrise = sunriseHours.sort((a, b) => b.score - a.score)[0] || null;
  const bestSunset = sunsetHours.sort((a, b) => b.score - a.score)[0] || null;

  return {
    hourlyAnalyses,
    bestHour,
    bestSunrise,
    bestSunset,
    score: bestHour?.score ?? 0,
    level: bestHour?.level ?? 'very-low',
    label: bestHour?.label ?? '晚霞概率低',
    resultText: bestHour?.resultText ?? '晚霞概率低（0 分）',
    summary: bestHour?.summary ?? '霞光条件暂不理想。',
    reasons: bestHour?.reasons ?? [],
  };
}

module.exports = {
  analyzeGlowSample,
  analyzeDayGlow,
};
