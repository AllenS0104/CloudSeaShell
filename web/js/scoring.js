// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
const { clamp, lerp } = require('./math-utils');

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

/**
 * Vertical inversion detection using pressure-level temperatures.
 *
 * The cloud-sea physics (per 云海和晚霞的形成.md) requires an absolute
 * stable layering where a WARM dry layer sits ABOVE cold moist air —
 * "下重上轻" sealing convection. This is best detected by comparing
 * surface/2m temperature against 925/850/700 hPa pressure-level
 * temperatures (corresponding to roughly 800m / 1.5km / 3km altitude).
 *
 * Returns { score 0-12, detected, strength, layer } so the cloud-sea
 * scorer can use it instead of (or in addition to) the legacy
 * `scoreInversion` time-series proxy.
 */
function scoreVerticalInversion({
  surfaceTemperature,
  temperature925hPa,
  temperature850hPa,
  temperature700hPa,
  elevation,
}) {
  const tSurface = Number(surfaceTemperature);
  if (!Number.isFinite(tSurface)) {
    return { score: 0, detected: false, strength: 0, layer: null, available: false };
  }

  // Skip levels that are physically below the observation point.
  // 925 hPa ≈ 800 m, 850 hPa ≈ 1500 m, 700 hPa ≈ 3000 m.
  const elev = Number(elevation) || 0;
  const candidates = [];
  if (Number.isFinite(Number(temperature925hPa)) && elev < 800) {
    candidates.push({ level: '925hPa', temperature: Number(temperature925hPa) });
  }
  if (Number.isFinite(Number(temperature850hPa)) && elev < 1500) {
    candidates.push({ level: '850hPa', temperature: Number(temperature850hPa) });
  }
  if (Number.isFinite(Number(temperature700hPa)) && elev < 3000) {
    candidates.push({ level: '700hPa', temperature: Number(temperature700hPa) });
  }
  if (!candidates.length) {
    return { score: 0, detected: false, strength: 0, layer: null, available: false };
  }

  let best = { strength: -Infinity, level: null };
  for (const candidate of candidates) {
    const strength = candidate.temperature - tSurface;
    if (strength > best.strength) {
      best = { strength, level: candidate.level };
    }
  }
  const strength = best.strength;
  const layer = best.level;

  // Strong inversion: upper level ≥ surface + 3°C → cap solidly in place
  if (strength >= 3) return { score: 12, detected: true, strength, layer, available: true };
  // Moderate inversion: surface ≤ upper level ≤ surface + 3°C
  if (strength >= 0.5) return { score: Math.round(lerp(strength, 0.5, 3, 4, 12)), detected: true, strength, layer, available: true };
  // No inversion or weak — no bonus
  return { score: 0, detected: false, strength, layer, available: true };
}

/**
 * CAPE-based stability penalty for cloud-sea predictions.
 *
 * Per the physics doc, cloud sea forms under "绝对稳定的封锁" (absolute
 * stable layering). High CAPE (Convective Available Potential Energy)
 * indicates the opposite — the atmosphere wants to convect, which
 * destroys any inversion-trapped fog layer.
 *
 * Returns a penalty 0-12 to subtract from the cloud-sea score.
 */
function scoreCapeStability(cape) {
  const v = Number(cape ?? 0);
  if (!Number.isFinite(v) || v <= 100) return 0;
  if (v >= 1500) return 12;
  if (v >= 800) return Math.round(lerp(v, 800, 1500, 6, 12));
  if (v >= 300) return Math.round(lerp(v, 300, 800, 2, 6));
  return Math.round(lerp(v, 100, 300, 0, 2));
}

/**
 * Composite false-positive penalty
 *
 * Analysis of 17 FP cases shows they share a pattern:
 * - Weather looks good on paper (high humidity, low dew gap, moderate cloud)
 * - But cloud sea DOESN'T form because:
 *   a) No temperature inversion to trap moisture at low altitude
 *   b) Wind is too strong, dispersing potential fog layers
 *   c) High cloud cover without corresponding low cloud formation
 *
 * This penalty fires when cloud-sea-favorable humidity exists
 * but supporting structural conditions (inversion, calm winds,
 * low cloud dominance) are ABSENT.
 */
function compositeReliabilityPenalty({
  humidity,
  windSpeed,
  cloudCover,
  lowCloudCover,
  inversionDetected,
  dewPointGap,
  precipitationProbability,
}) {
  const h = Number(humidity ?? 0);
  const w = Number(windSpeed ?? 0);
  const cc = Number(cloudCover ?? 0);
  const lcc = Number(lowCloudCover ?? 0);
  const dg = Number(dewPointGap ?? 10);
  const pp = Number(precipitationProbability ?? 0);

  let penalty = 0;

  // Pattern 1: High humidity but NO inversion detected
  // Inversion is the #1 structural requirement for cloud sea
  if (h >= 80 && !inversionDetected) {
    penalty += 8;
  }

  // Pattern 2: High humidity + strong wind = moisture disperses, no stable fog layer
  if (h >= 80 && w > 8) {
    penalty += 5;
  }

  // Pattern 3: High total cloud but low clouds are minority
  // = high/mid altitude clouds, not the low fog that makes cloud sea
  if (cc > 50 && lcc < cc * 0.3) {
    penalty += 6;
  }

  // Pattern 4: Very narrow dew gap + high precip probability
  // = likely rain/drizzle, not stable fog
  if (dg < 2 && pp >= 50) {
    penalty += 5;
  }

  // Cap total composite penalty at 18
  return Math.min(penalty, 18);
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

module.exports = {
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
  scoreVerticalInversion,
  scoreCapeStability,
  scoreToConfidence,
  compositeReliabilityPenalty,
};
