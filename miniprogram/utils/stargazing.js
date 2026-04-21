/**
 * Stargazing & Milky Way module
 *
 * Pure mathematical calculations for:
 * - Moon phase (synodic month)
 * - Moon illumination percentage
 * - Milky Way core visibility (seasonal + hourly)
 * - Star visibility scoring
 * - Astrophotography parameters (500 rule, NPF rule)
 */

// ─── Moon Phase ─────────────────────────────────────────────

/**
 * Calculate moon phase for a given date
 * Returns 0-29.53 (synodic month cycle)
 * 0 = New Moon, ~7.4 = First Quarter, ~14.8 = Full Moon, ~22.1 = Last Quarter
 */
function getMoonAge(date) {
  const d = date instanceof Date ? date : new Date(date);
  // Reference new moon: Jan 6, 2000 18:14 UTC
  const refNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
  const synodicMonth = 29.53058867;
  const daysSinceRef = (d.getTime() - refNewMoon) / (1000 * 60 * 60 * 24);
  const age = ((daysSinceRef % synodicMonth) + synodicMonth) % synodicMonth;
  return Math.round(age * 100) / 100;
}

/**
 * Moon illumination percentage (0-100)
 */
function getMoonIllumination(moonAge) {
  // Cosine approximation
  return Math.round((1 - Math.cos(moonAge / 29.53 * 2 * Math.PI)) / 2 * 100);
}

/**
 * Moon phase name and icon
 */
function getMoonPhaseName(moonAge) {
  if (moonAge < 1.85) return { name: '新月', icon: '🌑', english: 'New Moon' };
  if (moonAge < 7.38) return { name: '蛾眉月', icon: '🌒', english: 'Waxing Crescent' };
  if (moonAge < 9.23) return { name: '上弦月', icon: '🌓', english: 'First Quarter' };
  if (moonAge < 13.69) return { name: '盈凸月', icon: '🌔', english: 'Waxing Gibbous' };
  if (moonAge < 16.61) return { name: '满月', icon: '🌕', english: 'Full Moon' };
  if (moonAge < 20.30) return { name: '亏凸月', icon: '🌖', english: 'Waning Gibbous' };
  if (moonAge < 22.15) return { name: '下弦月', icon: '🌗', english: 'Last Quarter' };
  if (moonAge < 27.68) return { name: '残月', icon: '🌘', english: 'Waning Crescent' };
  return { name: '新月', icon: '🌑', english: 'New Moon' };
}

// ─── Milky Way ──────────────────────────────────────────────

/**
 * Milky Way galactic center visibility
 * The core (Sagittarius) is best visible:
 * - Northern hemisphere: April to October
 * - Peak months: June-August
 * - Best hours: when Sagittarius is above horizon (varies by month)
 *
 * Returns rough visibility window for given date and latitude
 */
function getMilkyWayVisibility(date, latitude) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth(); // 0-11
  const lat = Number(latitude) || 30;

  // Milky Way core season (Northern Hemisphere focus, China ~20-50°N)
  let seasonScore = 0;
  let seasonLabel = '';
  let coreVisible = false;
  let bestHours = '';

  if (lat >= 0) {
    // Northern hemisphere
    if (month >= 3 && month <= 8) {
      // Apr-Sep: core visible
      coreVisible = true;
      if (month >= 5 && month <= 7) {
        seasonScore = 10;
        seasonLabel = '银河核心最佳季节';
        bestHours = month === 5 ? '01:00-04:00' : month === 6 ? '23:00-03:00' : '22:00-02:00';
      } else if (month === 3 || month === 8) {
        seasonScore = 6;
        seasonLabel = '银河核心可见（偏低）';
        bestHours = month === 3 ? '03:00-05:00' : '20:00-23:00';
      } else {
        seasonScore = 8;
        seasonLabel = '银河核心可见';
        bestHours = month === 4 ? '02:00-04:30' : '21:00-01:00';
      }
    } else if (month === 9) {
      coreVisible = true;
      seasonScore = 5;
      seasonLabel = '银河核心季末';
      bestHours = '19:30-22:00';
    } else {
      seasonScore = 2;
      seasonLabel = '非银河核心季节（仅可见银河弧）';
      bestHours = '银河弧整夜可见';
    }
  } else {
    // Southern hemisphere (simplified)
    coreVisible = month >= 1 && month <= 10;
    seasonScore = coreVisible ? 8 : 3;
    seasonLabel = coreVisible ? '银河核心可见' : '非最佳季节';
    bestHours = '参考当地天文时间';
  }

  return {
    coreVisible,
    seasonScore,
    seasonLabel,
    bestHours,
    month: month + 1,
  };
}

// ─── Star Visibility Score ──────────────────────────────────

/**
 * Overall stargazing / astrophotography score
 * Combines: moon, cloud cover, visibility, light pollution estimate
 */
function scoreStargazing({
  date,
  latitude,
  cloudCover,
  visibility,
  humidity,
  elevation,
}) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const moonAge = getMoonAge(d);
  const moonIllum = getMoonIllumination(moonAge);
  const moonPhase = getMoonPhaseName(moonAge);
  const milkyWay = getMilkyWayVisibility(d, latitude);

  // Moon score: darker = better (new moon best)
  let moonScore;
  if (moonIllum <= 5) moonScore = 20;
  else if (moonIllum <= 25) moonScore = 15;
  else if (moonIllum <= 50) moonScore = 8;
  else if (moonIllum <= 75) moonScore = 3;
  else moonScore = 0;

  const moonNote = moonIllum <= 25
    ? '月光干扰小，利于星空拍摄'
    : moonIllum <= 50
      ? '有一定月光，银河对比度降低'
      : '月光较强，不利于银河/星空拍摄';

  // Cloud cover: clear = better
  const cc = Number(cloudCover ?? 0);
  let cloudScore;
  if (cc <= 10) cloudScore = 20;
  else if (cc <= 25) cloudScore = 15;
  else if (cc <= 50) cloudScore = 8;
  else if (cc <= 75) cloudScore = 3;
  else cloudScore = 0;

  // Visibility / transparency
  const vis = Number(visibility ?? 10000);
  let transScore;
  if (vis >= 20000) transScore = 15;
  else if (vis >= 10000) transScore = 10;
  else if (vis >= 5000) transScore = 5;
  else transScore = 0;

  // Humidity: low = cleaner sky
  const hum = Number(humidity ?? 50);
  let humScore;
  if (hum <= 40) humScore = 10;
  else if (hum <= 60) humScore = 7;
  else if (hum <= 80) humScore = 3;
  else humScore = 0;

  // Altitude bonus: higher = less atmosphere + less light pollution
  const elev = Number(elevation ?? 0);
  const altBonus = Math.min(10, Math.round(elev / 500));

  // Milky Way season
  const mwScore = milkyWay.seasonScore;

  const totalScore = Math.min(100, moonScore + cloudScore + transScore + humScore + altBonus + mwScore);

  let level, label;
  if (totalScore >= 70) { level = 'excellent'; label = '极佳观星条件'; }
  else if (totalScore >= 50) { level = 'good'; label = '较好观星条件'; }
  else if (totalScore >= 30) { level = 'fair'; label = '一般观星条件'; }
  else { level = 'poor'; label = '不利于观星'; }

  // Build reasons
  const reasons = [];
  reasons.push(`${moonPhase.icon} ${moonPhase.name}，月面亮度 ${moonIllum}%。${moonNote}`);
  if (milkyWay.coreVisible) {
    reasons.push(`🌌 ${milkyWay.seasonLabel}，推荐观测时段：${milkyWay.bestHours}`);
  } else {
    reasons.push(`🌌 ${milkyWay.seasonLabel}`);
  }
  if (cc <= 25) {
    reasons.push(`☁️ 云量 ${Math.round(cc)}%，天空通透`);
  } else if (cc >= 60) {
    reasons.push(`☁️ 云量 ${Math.round(cc)}%，云层较厚遮挡星空`);
  }
  if (elev >= 1500) {
    reasons.push(`⛰️ 海拔 ${Math.round(elev)}m，大气稀薄+远离光污染，有利`);
  }

  return {
    score: totalScore,
    level,
    label,
    moonAge,
    moonIllum,
    moonPhase,
    moonScore,
    moonNote,
    milkyWay,
    cloudScore,
    transScore,
    humScore,
    altBonus,
    reasons: reasons.slice(0, 4),
    resultText: `${label}（${totalScore} 分）`,
  };
}

// ─── Astrophotography Parameters ────────────────────────────

/**
 * 500 Rule: max shutter before star trails
 * shutter = 500 / (focal_length × crop_factor)
 *
 * NPF Rule (more accurate):
 * shutter = (35 × aperture + 30 × pixel_pitch) / focal_length
 */
function astroShutter(focalMm, cropFactor) {
  const f = Number(focalMm) || 24;
  const crop = Number(cropFactor) || 1;
  const rule500 = Math.round(500 / (f * crop));
  const rule300 = Math.round(300 / (f * crop)); // conservative
  return {
    rule500: `${rule500}s`,
    rule300: `${rule300}s`,
    recommended: `${rule300}-${rule500}s`,
    note: `${f}mm 焦距下最长曝光（超过会出星轨）`,
  };
}

/**
 * Generate astrophotography recommendations
 */
function getAstroParams(starScore, focalMm, cropFactor) {
  const shutter = astroShutter(focalMm || 24, cropFactor || 1);
  const hasGoodConditions = starScore >= 50;

  return {
    aperture: '最大光圈（f/1.4-f/2.8）',
    apertureNote: '星空需要尽量多进光',
    shutter: shutter.recommended,
    shutterNote: shutter.note,
    iso: hasGoodConditions ? '1600-3200' : '3200-6400',
    isoNote: hasGoodConditions ? '条件好可用较低感光度' : '条件一般需提高感光度补偿',
    wb: '3800-4200K',
    wbNote: '偏冷色调还原星空本色',
    focus: '手动对焦至无穷远，微调至星点最锐',
    focusNote: '放大 LiveView 对准亮星精确对焦',
    focalSuggestion: '14-24mm 超广角最佳',
    stacking: hasGoodConditions
      ? '单张即可出效果，叠加 10-20 张降噪更佳'
      : '建议拍摄 20-30 张用 Sequator/StarStaX 堆栈降噪',
  };
}

module.exports = {
  getMoonAge,
  getMoonIllumination,
  getMoonPhaseName,
  getMilkyWayVisibility,
  scoreStargazing,
  astroShutter,
  getAstroParams,
};
