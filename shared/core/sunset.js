/* SHARED CORE — single source of truth, do not edit per-end copies */
/**
 * Sunset glow / fire cloud (晚霞/火烧云) prediction module
 *
 * Physics: When the sun is at low angle (-4° ~ +6°), light travels through
 * thick atmosphere. Short wavelengths scatter away, leaving red/orange light
 * that illuminates mid/high-level thin clouds like a screen.
 *
 * Key factors (different from cloud-sea):
 * - High-level clouds (>8km): the primary "screen" for glow. Best 30-90%;
 *   >=90% seals the sky and is worse than clear. Established by a 255-sample
 *   audit (scripts/glow-audit.js) — see scoreHighCloud for the numbers.
 * - Mid-level clouds (3-8km): mildly NEGATIVE. The original design treated
 *   these as the main screen, but the data disagreed: they signal a frontal
 *   deck. Same conclusion the cloud-sea model reached independently.
 * - Low clouds (<3km): BLOCKS the glow if too thick — the strongest single
 *   signal measured (AUC 0.422)
 * - Humidity: moderate is best (40-75%), too high = overcast
 * - Clean air / good visibility helps color intensity
 */

const { clamp, lerp } = require('./math-utils');

/**
 * Score mid-level cloud cover (3-8km) — the primary glow "screen"
 * Best: 30-70%, too little = no canvas, too much = overcast
 */
/**
 * Score mid-level cloud cover (3-8km).
 *
 * Originally this was the model's single largest positive term (+28, treating
 * 30-70% as the ideal "screen"). A 255-sample audit (scripts/glow-audit.js)
 * rejected that: mid-cloud correlates *negatively* with observed glow
 * (AUC 0.457; mean 17.5% on glow days vs 23.8% on control days), and the
 * supposed sweet spot 30-70% had the *lowest* occurrence rate of any band
 * (25.0%). The logistic fit agrees (coefficient -0.222).
 *
 * This matches the cloud-sea side, where mid-cloud also turned out to be a
 * negative: it signals a synoptic frontal deck, i.e. an overcast sky. It is
 * the high, thin cloud that acts as the screen, not the mid deck.
 *
 * So the term is demoted from the largest bonus to a small one, with thick
 * mid-cloud now costing points. Kept small deliberately — the measured
 * signal is weak and non-monotonic, so a large weight either way would be
 * fitting noise.
 */
function scoreMidCloud(midCover) {
  // 缺数据必须是中性 0，不能落进"<=30% 给奖励"那一档。
  // `Number(x ?? 0)` 会把 null 变成 0，等于把"没有数据"当成"中空通透"
  // 白送 8 分，这是不该有的乐观假设。
  if (midCover === null || midCover === undefined) return 0;
  const v = Number(midCover);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v <= 30) return 8;
  if (v <= 70) return Math.round(lerp(v, 30, 70, 8, 0));
  return Math.round(lerp(Math.min(v, 100), 70, 100, 0, -6));
}

/**
 * Score high-level cloud cover (>8km) — the actual glow screen.
 *
 * The audit found the relationship is an inverted U that the old curve had
 * mispositioned. Measured occurrence rates by band:
 *   0-10%   32.4%      30-60%  47.1%
 *   10-30%  27.3%      60-90%  60.0%   <- peak
 *                      >=90%   24.1%   <- worse than clear sky
 *
 * The old curve peaked at 20-60% and was already *decaying* through 60-90%,
 * i.e. it penalised the best band. Overcast high cloud (>=90%) is genuinely
 * bad — it seals the sky rather than catching light.
 *
 * Robustness: this shape is non-linear, so a linear AUC understates it
 * (0.510). Adding the binned form lifted cross-validated AUC 0.541 -> 0.599,
 * past the existing scorer's 0.566. Bootstrap on the 30-90% vs >=90% gap:
 * +30.0pp, 95% CI [+9.1, +50.7], positive in 99.7% of resamples.
 *
 * This is also the one place our findings line up with SunsetWx, which
 * weights high cloud/high-level moisture above all else.
 */
function scoreHighCloud(highCover) {
  if (highCover === null || highCover === undefined) return 0;
  const v = Number(highCover);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v >= 30 && v <= 90) return 28;
  if (v >= 10 && v < 30) return Math.round(lerp(v, 10, 30, 8, 28));
  if (v > 90) return Math.round(lerp(Math.min(v, 100), 90, 100, 28, 2));
  return Math.round(lerp(v, 0, 10, 0, 8));
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
 * Aerosol bonus / penalty for sunset glow.
 *
 * ⚠ UNVALIDATED. This curve is physical reasoning, not a measured result, and
 * an attempt to validate it failed in an instructive way — do not repeat it.
 * See docs/数据采集与模型审计.md.
 *
 * The attempt: label 85 Commons sunset photos by image-derived "blaze
 * intensity" (scripts/glow-intensity.py), then compare aerosol on blazing vs
 * dull days (scripts/glow-blaze-eval.js). It appeared to show a strong signal
 * in the *opposite* direction to this curve — clean air favouring blaze, at
 * PM2.5 AUC 0.244 and AOD 0.283, seemingly robust outside East Asia too.
 *
 * That signal was an artefact. Blazing samples skew to older photos (2011-13),
 * which fall outside historical-forecast-api coverage and fall back to ERA5 —
 * and ERA5 carries no aerosol fields. Aerosol was therefore missing for 53% of
 * blazing samples versus 8% of dull ones, the dump encoded missing as 0, and 0
 * sorts as "cleanest". The AUC was measuring photo age, not air quality.
 *
 * Restricted to samples with real data the signal evaporates:
 *   PM2.5  n=30, AUC 0.568, 95% CI [0.289, 0.830]
 *   AOD    n=18 (only 3 blazing), AUC 0.644, 95% CI [0.286, 1.000]
 * Both cross 0.5. There is currently *no* evidence for either direction, so
 * this curve is left alone rather than inverted on the strength of an artefact.
 *
 * Two rules this cost us, worth keeping:
 *   1. Never encode a missing value as 0 in a dump used for ranking metrics.
 *      0 is an extreme, not a neutral, and AUC will happily rank it.
 *   2. When a fallback data source has different field coverage, missingness
 *      becomes a confounder correlated with whatever caused the fallback.
 *      Check per-class missing rates before believing any feature.
 *
 * To settle it properly: restrict the cohort to post-2016 photos so every
 * sample has real aerosol data, then re-measure.
 *
 * Per 云海和晚霞的形成.md, the dreamy pink / lilac / purple tones come
 * from Mie scattering off aerosols (火山灰、海盐、细颗粒污染物) of the
 * right size. Light pollution-free clean air is OK, but a touch of
 * aerosol typically produces the most striking colors. Heavy haze on the
 * other hand obscures the sky.
 *
 * Inputs (any may be null):
 *   pm2_5: μg/m³ (Open-Meteo air-quality)
 *   aerosolOpticalDepth: 0..several (Open-Meteo)
 *   dust: μg/m³
 *
 * Returns +bonus / -penalty in the range -8 .. +10.
 */
function scoreAerosolForGlow({ pm2_5, aerosolOpticalDepth, dust }) {
  const aod = Number(aerosolOpticalDepth);
  const pm = Number(pm2_5);
  const dustVal = Number(dust);

  // Heavy dust storms obscure rather than colorize
  if (Number.isFinite(dustVal) && dustVal >= 200) return -8;

  // Prefer AOD when available (most direct measure of column aerosol load)
  if (Number.isFinite(aod) && aod > 0) {
    if (aod >= 0.8) return -8;             // heavy haze, obscured sky
    if (aod >= 0.5) return Math.round(lerp(aod, 0.5, 0.8, 2, -8));
    if (aod >= 0.2) return 10;             // sweet spot for pink/purple
    if (aod >= 0.1) return Math.round(lerp(aod, 0.1, 0.2, 4, 10));
    if (aod >= 0.05) return Math.round(lerp(aod, 0.05, 0.1, 0, 4));
    return -2;                             // ultra-clean air — no Mie tint
  }

  // Fallback to PM2.5 if AOD missing
  if (Number.isFinite(pm) && pm > 0) {
    if (pm >= 200) return -8;
    if (pm >= 150) return Math.round(lerp(pm, 150, 200, 2, -8));
    if (pm >= 30 && pm <= 80) return 8;
    if (pm >= 10 && pm < 30) return Math.round(lerp(pm, 10, 30, 2, 8));
    if (pm > 80 && pm < 150) return Math.round(lerp(pm, 80, 150, 8, 2));
    return -2;                             // very clean
  }

  return 0;
}

/**
 * Analyze sunset glow potential for a single time sample
 */
/**
 * Score total cloud cover — the "is there a canvas to set alight" term.
 *
 * Every cloud layer points in *opposite* directions under the two labels we
 * have, and that is physics, not contradiction:
 *
 *   feature      P(glow visible), n=255   P(blazing | visible), n=61
 *   cloudTotal   0.464                    0.650
 *   cloudLow     0.422                    0.613
 *   cloudMid     0.457                    0.607
 *   humidity     0.440                    0.635
 *
 * Cloud blocks the view, but without cloud there is nothing for the low sun to
 * set alight — a clear sky gives only a thin band of afterglow, never a 大烧.
 * A single linear sum can only express one of those directions, which is why
 * the overall score scored *below* chance (0.456) on blaze.
 *
 * This term is added because total cloud is the one place the two labels do
 * not have to fight. On presence it is nearly signal-free (AUC 0.464, |dev|
 * 0.036 — the weakest cloud feature there), while on blaze intensity it is the
 * most consistent feature measured, with 0% missing data in both classes.
 * Blazing skies averaged 58.7% total cloud against 40.7% for dull ones.
 *
 * Honest accounting of how the evidence moved as the cohort grew (samples were
 * recovered by geocoding place names out of Commons categories):
 *   n=61  AUC 0.650, 95% CI [0.509, 0.790]   paired effect +0.042 [+0.011, +0.079]
 *   n=80  AUC 0.630, 95% CI [0.505, 0.754]   paired effect +0.028 [-0.003, +0.060]
 *   n=85  AUC 0.611, 95% CI [0.488, 0.731]
 * The direction replicated every time and bootstrap stayed 96.5% positive, but
 * the effect shrank toward the mean and the interval no longer clears 0.5.
 *
 * That shrinkage turned out to be partly an artefact of its own. The recovered
 * samples only carry city-level coordinates, and grouping by coordinate source
 * showed they score *below chance* on both labels (presence 0.472, blaze 0.361)
 * where EXIF-located samples score 0.563 / 0.477. Sunset is a wide phenomenon,
 * but the weather variables that explain it are not — being tens of kilometres
 * off means reading the neighbouring town's cloud cover. Those samples are now
 * excluded by default in both audit scripts, and on the clean n=62 cohort the
 * term still measures 0.497 overall, matching the 0.499 it was accepted at.
 *
 * Treat it as a real but *weak* signal either way: the honest read is that the
 * cohort has never been large enough to call it robust.
 *
 * It is kept rather than reverted because it is not the kind of failure the
 * aerosol term was: missingness is 0% in both classes, so there is no coverage
 * confounder here, and the direction never flipped. But it is deliberately
 * capped at a weight of 10 — a nudge, not a pillar — and it should not be
 * leaned on further without materially more data. The peak sits high (50-85%)
 * rather than mid-range; overcast (>95%) is pulled back down, since at that
 * point the sun is sealed off and cannot light anything.
 */
function scoreTotalCloud(totalCover) {
  const c = Number(totalCover);
  if (!Number.isFinite(c)) return 0;       // unknown — stay neutral, never 0-as-value
  if (c < 20) return 0;                    // bare sky: nothing to catch the light
  if (c < 50) return Math.round(lerp(c, 20, 50, 0, 10));
  if (c <= 85) return 10;                  // measured sweet spot
  if (c <= 95) return Math.round(lerp(c, 85, 95, 10, 4));
  return 2;                                // sealed overcast
}

function analyzeGlowSample({
  cloudCoverMid,
  cloudCoverHigh,
  cloudCoverLow,
  cloudCoverTotal,
  humidity,
  visibility,
  precipitationProbability,
  precipitationAmount,
  timeString,
  sunriseTime,
  sunsetTime,
  aerosol,
}) {
  const midScore = scoreMidCloud(cloudCoverMid);
  const highScore = scoreHighCloud(cloudCoverHigh);
  const totalScore = scoreTotalCloud(cloudCoverTotal);
  const lowPenalty = penaltyLowCloud(cloudCoverLow);
  const humidityScore = scoreHumidityForGlow(humidity);
  const visScore = scoreVisibilityForGlow(visibility);
  const sunsetScore = scoreSunsetWindow(timeString, sunsetTime);
  const sunriseScore = scoreSunriseWindow(timeString, sunriseTime);
  const timeScore = Math.max(sunsetScore, sunriseScore);
  const isEvening = sunsetScore >= sunriseScore;
  const penalty = precipPenalty(precipitationProbability, precipitationAmount);
  const aerosolScore = aerosol ? scoreAerosolForGlow(aerosol) : 0;

  const rawScore = midScore + highScore + totalScore + humidityScore + visScore + timeScore + aerosolScore - lowPenalty - penalty;
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
    aerosol, aerosolScore,
  });

  return {
    score,
    level,
    label,
    isEvening,
    timeLabel: isEvening ? '日落' : '日出',
    midScore,
    highScore,
    totalScore,
    lowPenalty,
    humidityScore,
    visScore,
    timeScore,
    aerosolScore,
    penalty,
    reasons,
    resultText: score >= 50 ? `${label}（${score} 分）` : `${label}（${score} 分）`,
    summary: score >= 50
      ? `${isEvening ? '今日日落' : '今日日出'}前后有较好的霞光条件，建议提前到位守候。`
      : `${isEvening ? '日落' : '日出'}霞光条件一般，不确定性较大。`,
  };
}

function buildGlowReasons({ cloudCoverMid, cloudCoverHigh, cloudCoverLow, humidity, visibility, timeScore, isEvening, precipitationProbability, precipitationAmount, aerosol, aerosolScore }) {
  const reasons = [];
  const midV = Number(cloudCoverMid ?? 0);
  const highV = Number(cloudCoverHigh ?? 0);
  const lowV = Number(cloudCoverLow ?? 0);

  // 文案随判据一起修正：实测表明充当"光幕"的是高层薄云，不是中层云。
  // 中层云 30-70% 这一档的晚霞出现率反而是各档里最低的（25.0%）。
  if (highV >= 30 && highV <= 90) {
    reasons.push(`高层云量 ${Math.round(highV)}%，高空薄云充当"光幕"，最利于霞光显色。`);
  } else if (highV > 90) {
    reasons.push(`高层云量 ${Math.round(highV)}%，高空被云封死，霞光难以透出。`);
  } else {
    reasons.push(`高层云量仅 ${Math.round(highV)}%，缺少高空反射面，霞光可能不够壮观。`);
  }

  if (midV >= 70) {
    reasons.push(`中层云量 ${Math.round(midV)}%，多为系统性云系，会挡住霞光。`);
  } else if (midV <= 30) {
    reasons.push(`中层云量 ${Math.round(midV)}%，中空通透，利于霞光照到高空云上。`);
  }

  if (aerosol && aerosolScore > 4) {
    const aod = Number(aerosol.aerosolOpticalDepth);
    const pm = Number(aerosol.pm2_5);
    if (Number.isFinite(aod) && aod > 0) {
      reasons.push(`气溶胶光学厚度 ${aod.toFixed(2)}，米氏散射有助形成粉紫色调。`);
    } else if (Number.isFinite(pm) && pm > 0) {
      reasons.push(`PM2.5 约 ${Math.round(pm)} μg/m³，颗粒物正好有助渲染粉紫色霞光。`);
    }
  } else if (aerosol && aerosolScore <= -4) {
    reasons.push('空气浑浊度偏高，可能遮蔽霞光透射。');
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

  return reasons.slice(0, 5);
}

/**
 * Analyze glow potential for a full day (find best hour)
 */
function analyzeDayGlow(hourly, start, sunriseTime, sunsetTime, airQuality) {
  const times = hourly.time.slice(start, start + 24);
  const midCovers = (hourly.cloud_cover_mid ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const highCovers = (hourly.cloud_cover_high ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const lowCovers = (hourly.cloud_cover_low ?? hourly.cloudcover_low ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  // 缺失保持 null，不要 ?? 0。总云量的 0 是"晴空无云"这个实打实的一端，
  // 把缺失塞成 0 等于谎报晴空。scoreTotalCloud 对 null 返回中性 0 分。
  const totalCovers = (hourly.cloud_cover ?? hourly.cloudcover ?? []).slice(start, start + 24)
    .map((v) => (v == null || v === '' ? null : Number(v)));
  const humidities = hourly.relative_humidity_2m.slice(start, start + 24).map(v => Number(v ?? 0));
  const visibilities = (hourly.visibility ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipProbs = (hourly.precipitation_probability ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipAmts = (hourly.precipitation ?? []).slice(start, start + 24).map(v => Number(v ?? 0));

  const aerosolSeries = buildAerosolSeries(times, airQuality);

  const hourlyAnalyses = times.map((t, i) => analyzeGlowSample({
    cloudCoverMid: midCovers[i],
    cloudCoverHigh: highCovers[i],
    cloudCoverLow: lowCovers[i],
    cloudCoverTotal: totalCovers[i],
    humidity: humidities[i],
    visibility: visibilities[i],
    precipitationProbability: precipProbs[i],
    precipitationAmount: precipAmts[i],
    timeString: t,
    sunriseTime,
    sunsetTime,
    aerosol: aerosolSeries[i],
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

/**
 * Align hourly air-quality samples (different time index than weather)
 * with the weather timeline by matching the YYYY-MM-DDTHH prefix.
 * Returns an array of aerosol payloads (or null) per weather hour.
 */
function buildAerosolSeries(weatherTimes, airQuality) {
  if (!airQuality || !Array.isArray(airQuality.time)) {
    return weatherTimes.map(() => null);
  }
  const indexByPrefix = new Map();
  airQuality.time.forEach((t, idx) => {
    const prefix = String(t || '').slice(0, 13);
    if (prefix && !indexByPrefix.has(prefix)) indexByPrefix.set(prefix, idx);
  });

  return weatherTimes.map((t) => {
    const prefix = String(t || '').slice(0, 13);
    const idx = indexByPrefix.get(prefix);
    if (idx == null) return null;
    return {
      pm2_5: Number(airQuality.pm2_5?.[idx] ?? NaN),
      pm10: Number(airQuality.pm10?.[idx] ?? NaN),
      aerosolOpticalDepth: Number(airQuality.aerosolOpticalDepth?.[idx] ?? NaN),
      dust: Number(airQuality.dust?.[idx] ?? NaN),
    };
  });
}

module.exports = {
  analyzeGlowSample,
  analyzeDayGlow,
  scoreAerosolForGlow,
  // 导出云层判据本身，好让"哪一层云是光幕"这个结论被回归测试锁住。
  scoreMidCloud,
  scoreHighCloud,
  scoreTotalCloud,
};
