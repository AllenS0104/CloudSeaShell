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
function estimateEV(lighting, cloudCover, visibility) {
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

  return Math.max(1, Math.min(16, ev));
}

/**
 * Generate DSLR/Mirrorless camera recommendations
 */
function generateCameraParams(ev, lighting, windSpeed, cloudSeaScore) {
  const isLowLight = ev <= 8;
  const isGolden = lighting.phase.includes('golden') || lighting.phase.includes('sunrise') || lighting.phase.includes('sunset');
  const isBluehour = lighting.phase.includes('blue-hour');
  const isNight = lighting.phase === 'night';
  const hasCloudSea = cloudSeaScore >= 55;
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
  const hasCloudSea = cloudSeaScore >= 55;
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
  const hasCloudSea = cloudSeaScore >= 55;
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
  const ev = estimateEV(lighting, cloudCover, visibility);
  const camera = generateCameraParams(ev, lighting, windSpeed, cloudSeaScore);
  const phone = generatePhoneParams(ev, lighting, windSpeed, cloudSeaScore);
  const filters = getFilterRecommendations(lighting, cloudSeaScore, windSpeed);

  // Composition tips based on conditions
  const composition = [];
  if (cloudSeaScore >= 55) {
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
    composition: composition.slice(0, 4),
    summary: buildPhotoSummary(lighting, cloudSeaScore, windSpeed),
  };
}

function buildPhotoSummary(lighting, score, windSpeed) {
  const parts = [];
  parts.push(`当前为${lighting.label}时段`);

  if (score >= 75) {
    parts.push('云海条件极佳，强烈建议出片');
  } else if (score >= 55) {
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
