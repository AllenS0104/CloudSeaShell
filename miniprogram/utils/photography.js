// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
const { CLOUD_SEA_GO } = require('./thresholds');
/**
 * Photography parameter recommendation for cloud-sea observation
 *
 * Generates camera settings based on weather conditions, time of day,
 * and cloud-sea characteristics. Supports DSLR, mirrorless, and phone.
 */

/**
 * Determine lighting phase based on time relative to sunrise/sunset
 */
function getLightingPhase(timeString, sunriseTime, sunsetTime) {
  if (!timeString) return { phase: 'unknown', label: '未知', icon: '📷' };

  const time = new Date(timeString);
  const hour = time.getHours();
  const minutes = hour * 60 + time.getMinutes();

  let sunriseMin = 6 * 60;
  let sunsetMin = 18 * 60;

  if (sunriseTime) {
    const sr = new Date(sunriseTime);
    sunriseMin = sr.getHours() * 60 + sr.getMinutes();
  }
  if (sunsetTime) {
    const ss = new Date(sunsetTime);
    sunsetMin = ss.getHours() * 60 + ss.getMinutes();
  }

  const diffFromSunrise = minutes - sunriseMin;
  const diffFromSunset = minutes - sunsetMin;

  if (diffFromSunrise >= -90 && diffFromSunrise < -30) {
    return { phase: 'blue-hour-morning', label: '晨曦蓝调', icon: '🌌', colorTemp: 9000 };
  }
  if (diffFromSunrise >= -30 && diffFromSunrise < 0) {
    return { phase: 'pre-sunrise', label: '日出前', icon: '🌅', colorTemp: 7000 };
  }
  if (diffFromSunrise >= 0 && diffFromSunrise < 30) {
    return { phase: 'golden-sunrise', label: '黄金日出', icon: '🌄', colorTemp: 3500 };
  }
  if (diffFromSunrise >= 30 && diffFromSunrise < 90) {
    return { phase: 'post-sunrise', label: '日出后', icon: '☀️', colorTemp: 4500 };
  }
  if (diffFromSunset >= -90 && diffFromSunset < -30) {
    return { phase: 'pre-sunset', label: '日落前', icon: '🌇', colorTemp: 4500 };
  }
  if (diffFromSunset >= -30 && diffFromSunset <= 0) {
    return { phase: 'golden-sunset', label: '黄金日落', icon: '🌅', colorTemp: 3200 };
  }
  if (diffFromSunset > 0 && diffFromSunset <= 30) {
    return { phase: 'post-sunset', label: '日落后', icon: '🌆', colorTemp: 6500 };
  }
  if (diffFromSunset > 30 && diffFromSunset <= 90) {
    return { phase: 'blue-hour-evening', label: '傍晚蓝调', icon: '🌌', colorTemp: 9000 };
  }
  if (hour >= 22 || hour < 4) {
    return { phase: 'night', label: '夜间', icon: '🌙', colorTemp: 4000 };
  }
  return { phase: 'daylight', label: '日间', icon: '☀️', colorTemp: 5500 };
}

/**
 * Calculate EV (Exposure Value) from lighting conditions
 * Simplified EV estimation for outdoor cloud-sea scenarios
 */
function estimateEV(lighting, cloudCover, visibility, elevation) {
  const baseEV = {
    'night': 2,
    'blue-hour-morning': 6,
    'pre-sunrise': 8,
    'golden-sunrise': 10,
    'post-sunrise': 13,
    'daylight': 14,
    'pre-sunset': 13,
    'golden-sunset': 10,
    'post-sunset': 8,
    'blue-hour-evening': 6,
    'unknown': 12,
  };

  let ev = baseEV[lighting.phase] || 12;

  // Cloud cover reduces light
  const cc = Number(cloudCover ?? 0);
  if (cc > 80) ev -= 2;
  else if (cc > 50) ev -= 1;

  // Low visibility (fog/haze) reduces light
  const vis = Number(visibility ?? 10000);
  if (vis < 2000) ev -= 1;

  // Altitude correction: UV intensity increases ~10-12% per 1000m
  const elev = Number(elevation ?? 0);
  if (elev > 500) {
    ev += Math.min(1.5, elev / 2000 * 0.7);
  }

  return Math.round(Math.max(1, Math.min(17, ev)) * 10) / 10;
}

/**
 * Generate DSLR/Mirrorless camera recommendations
 */
function generateCameraParams(ev, lighting, windSpeed, cloudSeaScore) {
  const isLowLight = ev <= 8;
  const isGolden = lighting.phase.includes('golden') || lighting.phase.includes('sunrise') || lighting.phase.includes('sunset');
  const isBluehour = lighting.phase.includes('blue-hour');
  const isNight = lighting.phase === 'night';
  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const windCalm = (windSpeed ?? 0) <= 5;

  // Aperture: landscape sharpness sweet spot
  let aperture, apertureNote;
  if (isNight) {
    aperture = 'f/2.8';
    apertureNote = '夜间大光圈进光';
  } else if (hasCloudSea && windCalm) {
    aperture = 'f/11';
    apertureNote = '最佳画质光圈，云海细节丰富';
  } else {
    aperture = 'f/8';
    apertureNote = '风景通用锐度最佳光圈';
  }

  // Shutter speed
  let shutter, shutterNote;
  if (hasCloudSea && windCalm && !isNight) {
    shutter = '1/4s - 2s';
    shutterNote = '慢门让云海呈现丝滑流动感';
  } else if (hasCloudSea && !windCalm) {
    shutter = '1/125s - 1/30s';
    shutterNote = '风大时适当提速，保留云层纹理';
  } else if (isBluehour) {
    shutter = '2s - 15s';
    shutterNote = '蓝调时段长曝光，云海如梦似幻';
  } else if (isNight) {
    shutter = '15s - 30s';
    shutterNote = '星空+云海，需稳固三脚架';
  } else if (isGolden) {
    shutter = '1/60s - 1s';
    shutterNote = '金色光线下适当慢门增加氛围';
  } else {
    shutter = '1/250s - 1/60s';
    shutterNote = '日间标准曝光';
  }

  // ISO
  let iso, isoNote;
  if (isNight) {
    iso = '1600-3200';
    isoNote = '夜间需要高感光度';
  } else if (isBluehour) {
    iso = '400-800';
    isoNote = '蓝调时段适当提高';
  } else if (isLowLight) {
    iso = '200-800';
    isoNote = '弱光环境适度提升';
  } else {
    iso = '100-200';
    isoNote = '低感光度保证画质纯净';
  }

  // White balance
  let wb;
  if (lighting.colorTemp) {
    wb = `${lighting.colorTemp}K`;
  } else {
    wb = '自动';
  }
  const wbNote = isGolden ? '可偏暖强化金色氛围' : isBluehour ? '保持冷色调增强蓝调感' : '建议 RAW 后期调整';

  // Focal length
  let focal, focalNote;
  if (hasCloudSea) {
    focal = '16-35mm 广角 / 70-200mm 长焦';
    focalNote = '广角拍全景气势，长焦拍云浪细节';
  } else {
    focal = '24-70mm 标准';
    focalNote = '标准变焦覆盖多数构图';
  }

  return {
    aperture, apertureNote,
    shutter, shutterNote,
    iso, isoNote,
    wb, wbNote,
    focal, focalNote,
  };
}

/**
 * Generate phone camera recommendations
 */
function generatePhoneParams(ev, lighting, windSpeed, cloudSeaScore) {
  const isLowLight = ev <= 8;
  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const windCalm = (windSpeed ?? 0) <= 5;
  const isBluehour = lighting.phase.includes('blue-hour');
  const isNight = lighting.phase === 'night';

  const tips = [];

  // Mode
  let mode, modeNote;
  if (isNight) {
    mode = '夜景模式';
    modeNote = '开启夜景/长曝光模式，手持稳定 3-5 秒';
  } else if (hasCloudSea && windCalm) {
    mode = '专业模式 / 长曝光';
    modeNote = '如支持，设置 1-4 秒快门拍出丝绒云海';
  } else {
    mode = '风景模式 / HDR';
    modeNote = 'HDR 可保留高光和暗部细节';
  }

  // Lens
  let lens;
  if (hasCloudSea) {
    lens = '超广角 + 主摄交替使用';
    tips.push('超广角拍壮阔全景，主摄拍云层细节');
  } else {
    lens = '主摄';
    tips.push('主摄画质最好，避免使用数码变焦');
  }

  // Additional tips
  if (hasCloudSea && windCalm) {
    tips.push('找支撑物或小三脚架稳定手机');
  }
  if (isBluehour || isNight) {
    tips.push('开启定时自拍（2秒）避免手抖');
  }
  if (hasCloudSea) {
    tips.push('连拍模式捕捉云涌瞬间');
    tips.push('拍摄 RAW 格式（如支持）便于后期');
  }

  tips.push('开启网格线辅助构图，地平线放在 1/3 处');

  return {
    mode, modeNote,
    lens,
    tips: tips.slice(0, 5),
  };
}

/**
 * Generate filter recommendations
 */
function getFilterRecommendations(lighting, cloudSeaScore, windSpeed) {
  const filters = [];
  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const windCalm = (windSpeed ?? 0) <= 5;

  if (hasCloudSea && windCalm) {
    filters.push({ name: 'ND8/ND64 减光镜', reason: '延长曝光时间，拍出丝绸般云海', priority: 'high' });
  }

  if (lighting.phase.includes('golden') || lighting.phase.includes('sunrise') || lighting.phase.includes('sunset')) {
    filters.push({ name: 'GND 渐变灰滤镜', reason: '平衡天空与云海的亮度差', priority: 'high' });
  }

  filters.push({ name: 'CPL 偏振镜', reason: '增强云层立体感，减少水汽反光', priority: 'medium' });

  if (hasCloudSea && !windCalm) {
    filters.push({ name: 'UV 保护镜', reason: '山顶风大保护镜头', priority: 'low' });
  }

  return filters;
}

/**
 * Exposure table: multiple equivalent exposures for current EV (Planit style)
 */
function buildExposureTable(ev, cloudSeaScore) {
  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const table = [];

  // EV = log2(f² / t) + log2(ISO/100)
  // For a given EV and ISO, t = f² / (2^(EV - log2(ISO/100)))
  function shutterForEV(aperture, iso, targetEV) {
    const apertureNum = parseFloat(aperture.replace('f/', ''));
    const evAdjusted = targetEV - Math.log2(iso / 100);
    const t = (apertureNum * apertureNum) / Math.pow(2, evAdjusted);
    if (t >= 30) return '30s+';
    if (t >= 10) return `${Math.round(t)}s`;
    if (t >= 1) return `${t.toFixed(1)}s`;
    if (t >= 0.1) return `1/${Math.round(1 / t)}s`;
    if (t >= 0.01) return `1/${Math.round(1 / t)}s`;
    return `1/${Math.round(1 / t)}s`;
  }

  // Silky cloud sea (long exposure)
  if (hasCloudSea) {
    table.push({
      aperture: 'f/11', shutter: shutterForEV('f/11', 100, ev - 3),
      iso: '100', scene: '☁️ 丝绸云海（ND8）',
    });
  }

  // Standard landscape
  table.push({
    aperture: 'f/8', shutter: shutterForEV('f/8', 100, ev),
    iso: '100', scene: '🏔️ 标准风景',
  });

  // Handheld
  table.push({
    aperture: 'f/5.6', shutter: shutterForEV('f/5.6', 400, ev),
    iso: '400', scene: '🤳 手持拍摄',
  });

  // Night / blue hour
  if (ev <= 8) {
    table.push({
      aperture: 'f/2.8', shutter: shutterForEV('f/2.8', 1600, ev),
      iso: '1600', scene: '🌙 夜景/蓝调',
    });
  }

  return table;
}

/**
 * Depth of field calculation (simplified)
 * Hyperfocal distance and DOF range for landscape
 */
function calculateDepthOfField(focalMm, aperture) {
  const f = parseFloat(String(focalMm)) || 24;
  const N = parseFloat(String(aperture).replace('f/', '')) || 8;
  const CoC = 0.03; // Circle of confusion for full frame (mm)

  // Hyperfocal = f² / (N × CoC) + f
  const hyperfocal = (f * f) / (N * CoC) + f; // in mm
  const hyperfocalM = hyperfocal / 1000;

  let range, note;
  if (hyperfocalM < 3) {
    range = `${hyperfocalM.toFixed(1)}m ~ ∞`;
    note = '近距景深充足，适合前景构图';
  } else if (hyperfocalM < 10) {
    range = `${hyperfocalM.toFixed(1)}m ~ ∞`;
    note = '对焦超焦距即可前后皆清';
  } else {
    range = `${hyperfocalM.toFixed(0)}m ~ ∞`;
    note = '长焦景深较浅，注意对焦点选择';
  }

  return {
    hyperfocal: `${hyperfocalM < 10 ? hyperfocalM.toFixed(1) : Math.round(hyperfocalM)}m`,
    range,
    note,
  };
}

/**
 * Celestial info from sunrise/sunset
 */
function buildCelestialInfo(sunriseTime, sunsetTime) {
  if (!sunriseTime && !sunsetTime) return null;

  function formatTime(t) {
    if (!t) return '--:--';
    return t.slice(11, 16);
  }

  // Approximate sun direction from time (simplified for China)
  function sunDirection(t, isSunrise) {
    if (!t) return '';
    const month = new Date(t).getMonth();
    if (isSunrise) {
      if (month >= 3 && month <= 8) return '东偏北';
      return '东偏南';
    }
    if (month >= 3 && month <= 8) return '西偏北';
    return '西偏南';
  }

  return {
    sunrise: formatTime(sunriseTime),
    sunset: formatTime(sunsetTime),
    sunriseDir: sunriseTime ? `方位：${sunDirection(sunriseTime, true)}` : '',
    sunsetDir: sunsetTime ? `方位：${sunDirection(sunsetTime, false)}` : '',
  };
}

/**
 * ND filter calculator: how many stops needed for target shutter speed
 */
function calculateNDStops(ev, targetShutterSec, aperture, iso) {
  const N = parseFloat(String(aperture).replace('f/', '')) || 8;
  const isoVal = Number(iso) || 100;
  // Current shutter at this EV: t = N² / (2^(EV - log2(ISO/100)))
  const evAdj = ev - Math.log2(isoVal / 100);
  const currentShutter = (N * N) / Math.pow(2, evAdj);
  const targetSec = Number(targetShutterSec) || 1;

  if (targetSec <= currentShutter) return { stops: 0, filter: '不需要减光镜' };

  const stops = Math.round(Math.log2(targetSec / currentShutter) * 10) / 10;
  let filter;
  if (stops <= 3) filter = 'ND8 (3档)';
  else if (stops <= 6) filter = 'ND64 (6档)';
  else if (stops <= 10) filter = 'ND1000 (10档)';
  else if (stops <= 13) filter = 'ND8 + ND1000 (13档)';
  else filter = 'ND64 + ND1000 (16档)';

  return { stops: Math.round(stops * 10) / 10, filter };
}

/**
 * Timelapse recommendation for cloud sea
 */
function buildTimelapseParams(cloudSeaScore, windSpeed, lighting) {
  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const windCalm = (windSpeed ?? 0) <= 5;

  let interval, duration, frames, note;

  if (hasCloudSea && windCalm) {
    interval = '3-5 秒';
    duration = '30-60 分钟';
    frames = '360-1200 张';
    note = '云海缓慢翻涌，间隔稍长可呈现流动感';
  } else if (hasCloudSea) {
    interval = '2-3 秒';
    duration = '20-40 分钟';
    frames = '400-1200 张';
    note = '风大云动快，缩短间隔捕捉变化';
  } else if (lighting.phase.includes('golden') || lighting.phase.includes('blue-hour')) {
    interval = '5-8 秒';
    duration = '30-45 分钟';
    frames = '225-540 张';
    note = '记录光线色温变化过程';
  } else {
    interval = '5-10 秒';
    duration = '20-30 分钟';
    frames = '120-360 张';
    note = '日间云层变化较慢';
  }

  return {
    interval,
    duration,
    frames,
    note,
    videoLength: '按 24fps 约 5-50 秒成片',
    tips: [
      '使用三脚架 + 快门线/遥控',
      '关闭自动对焦，手动对焦后锁定',
      '关闭自动白平衡，固定色温',
      hasCloudSea ? '拍摄 RAW+JPEG，后期更灵活' : '拍摄 JPEG 节省存储空间',
    ],
  };
}

/**
 * Build shooting timeline (visual schedule of lighting phases)
 */
function buildShootingTimeline(sunriseTime, sunsetTime) {
  if (!sunriseTime || !sunsetTime) return [];

  const sr = new Date(sunriseTime);
  const ss = new Date(sunsetTime);
  const srMin = sr.getHours() * 60 + sr.getMinutes();
  const ssMin = ss.getHours() * 60 + ss.getMinutes();

  function fmt(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  const phases = [
    { start: srMin - 90, end: srMin - 30, label: '蓝调', icon: '🌌', color: '#1a237e' },
    { start: srMin - 30, end: srMin, label: '日出前', icon: '🌅', color: '#e65100' },
    { start: srMin, end: srMin + 30, label: '黄金日出', icon: '🌄', color: '#ff8f00' },
    { start: srMin + 30, end: srMin + 90, label: '日出后', icon: '☀️', color: '#fdd835' },
    { start: srMin + 90, end: ssMin - 90, label: '日间', icon: '☀️', color: '#90caf9' },
    { start: ssMin - 90, end: ssMin - 30, label: '日落前', icon: '🌇', color: '#fdd835' },
    { start: ssMin - 30, end: ssMin, label: '黄金日落', icon: '🌅', color: '#ff8f00' },
    { start: ssMin, end: ssMin + 30, label: '日落后', icon: '🌆', color: '#e65100' },
    { start: ssMin + 30, end: ssMin + 90, label: '蓝调', icon: '🌌', color: '#1a237e' },
  ];

  return phases.map(p => ({
    startTime: fmt(Math.max(0, p.start)),
    endTime: fmt(Math.min(1439, p.end)),
    label: p.label,
    icon: p.icon,
    color: p.color,
    durationMin: Math.max(0, Math.min(1439, p.end) - Math.max(0, p.start)),
  })).filter(p => p.durationMin > 0);
}

/**
 * Main entry: generate full photography recommendations
 */
function generatePhotoRecommendations({
  timeString,
  sunriseTime,
  sunsetTime,
  cloudCover,
  visibility,
  windSpeed,
  cloudSeaScore,
  elevation,
}) {
  const lighting = getLightingPhase(timeString, sunriseTime, sunsetTime);
  const ev = estimateEV(lighting, cloudCover, visibility, elevation);
  const camera = generateCameraParams(ev, lighting, windSpeed, cloudSeaScore);
  const phone = generatePhoneParams(ev, lighting, windSpeed, cloudSeaScore);
  const filters = getFilterRecommendations(lighting, cloudSeaScore, windSpeed);
  const exposureTable = buildExposureTable(ev, cloudSeaScore);
  const depthOfField = calculateDepthOfField(24, camera.aperture);
  const celestial = buildCelestialInfo(sunriseTime, sunsetTime);
  const ndCalc = calculateNDStops(ev, 2, camera.aperture, 100);
  const timelapse = buildTimelapseParams(cloudSeaScore, windSpeed, lighting);
  const timeline = buildShootingTimeline(sunriseTime, sunsetTime);

  const composition = [];
  if (cloudSeaScore >= CLOUD_SEA_GO) {
    composition.push('前景放入山石/树木/人物剪影增加纵深');
    composition.push('寻找云海"瀑布"（翻越山脊的云流）');
    composition.push('等待光线穿透云层的"耶稣光"瞬间');
  }
  if (lighting.phase.includes('golden')) {
    composition.push('利用侧逆光拍摄云海金边');
  }
  if (lighting.phase.includes('blue-hour')) {
    composition.push('保留天际线色彩渐变，天空占画面 2/3');
  }
  if (elevation > 1500) {
    composition.push('高海拔注意镜头起雾，备好镜头布');
  }

  return {
    lighting,
    ev,
    camera,
    phone,
    filters,
    exposureTable,
    depthOfField,
    celestial,
    ndCalc,
    timelapse,
    timeline,
    composition: composition.slice(0, 4),
    summary: buildPhotoSummary(lighting, cloudSeaScore, windSpeed),
  };
}

function buildPhotoSummary(lighting, score, windSpeed) {
  const parts = [];
  parts.push(`当前为${lighting.label}时段`);

  if (score >= 75) {
    parts.push('云海条件极佳，强烈建议出片');
  } else if (score >= CLOUD_SEA_GO) {
    parts.push('有云海潜力，值得守候拍摄');
  } else {
    parts.push('云海概率偏低，可练习风景构图');
  }

  if ((windSpeed ?? 0) <= 3) {
    parts.push('风平浪静适合长曝光');
  } else if ((windSpeed ?? 0) > 10) {
    parts.push('风大注意三脚架稳定性');
  }

  return parts.join('，') + '。';
}

module.exports = {
  generatePhotoRecommendations,
  getLightingPhase,
};
