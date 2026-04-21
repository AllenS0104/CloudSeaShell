/**
 * Camera & phone presets database
 * Real-world device specs for accurate parameter recommendations
 */

const CAMERA_PRESETS = {
  // === Canon ===
  'canon-5d4': {
    brand: 'Canon', model: '5D Mark IV', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 32000], bestISO: 100,
    evCompRange: [-3, 3],
    lenses: {
      '16-35mm f/2.8': { focal: [16, 35], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '超广角挂机，云海全景首选' },
      '24-70mm f/2.8': { focal: [24, 70], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '万能焦段，构图灵活' },
      '70-200mm f/2.8': { focal: [70, 200], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '长焦压缩云浪纹理，拍远处云瀑' },
      '100-400mm f/4.5-5.6': { focal: [100, 400], maxAperture: 4.5, bestLandscape: 'f/8', note: '超长焦拍云海细节特写' },
    },
    tips: ['建议开启镜头防抖（IS）仅在手持时', '云海慢门请关闭IS', 'LiveView对焦更精准', '使用C.Fn自定义按键快速切换对焦模式'],
  },
  'canon-r5': {
    brand: 'Canon', model: 'R5', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 51200], bestISO: 100,
    evCompRange: [-3, 3],
    lenses: {
      'RF 15-35mm f/2.8': { focal: [15, 35], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: 'RF超广角，画质极佳' },
      'RF 24-70mm f/2.8': { focal: [24, 70], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '标准变焦旗舰' },
      'RF 70-200mm f/2.8': { focal: [70, 200], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '轻量化长焦，云海压缩感强' },
      'RF 100-500mm f/4.5-7.1': { focal: [100, 500], maxAperture: 4.5, bestLandscape: 'f/8', note: '超远摄拍云海日出' },
    },
    tips: ['8K延时视频直接机内拍摄', '机身防抖(IBIS)有效，但三脚架上建议关闭', '电子快门避免机震', '眼控对焦在有人物前景时很实用'],
  },
  'canon-r6ii': {
    brand: 'Canon', model: 'R6 Mark II', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 102400], bestISO: 100,
    evCompRange: [-3, 3],
    lenses: {
      'RF 24-105mm f/4': { focal: [24, 105], maxAperture: 4, bestLandscape: 'f/8-f/11', note: '万能旅行头，覆盖广角到中长焦' },
      'RF 15-35mm f/2.8': { focal: [15, 35], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '超广角云海全景' },
    },
    tips: ['高感表现优秀，蓝调/夜景可放心ISO 3200', '4K 60p延时后期裁切空间大'],
  },

  // === Sony ===
  'sony-a7r5': {
    brand: 'Sony', model: 'A7R V', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 32000], bestISO: 100,
    evCompRange: [-5, 5],
    lenses: {
      'FE 16-35mm f/2.8 GM': { focal: [16, 35], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: 'GM超广角，风光摄影标杆' },
      'FE 24-70mm f/2.8 GM II': { focal: [24, 70], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '二代GM轻量化，画质顶级' },
      'FE 70-200mm f/2.8 GM II': { focal: [70, 200], maxAperture: 2.8, bestLandscape: 'f/8', note: '长焦云海压缩利器' },
      'FE 100-400mm f/4.5-5.6 GM': { focal: [100, 400], maxAperture: 4.5, bestLandscape: 'f/8', note: '远距云海特写' },
    },
    tips: ['6100万像素可大幅裁切', '像素偏移多重拍摄提升细节', '建议关闭SteadyShot上三脚架时', '使用SONY遥控app远程触发'],
  },
  'sony-a7c2': {
    brand: 'Sony', model: 'A7C II', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 51200], bestISO: 100,
    evCompRange: [-5, 5],
    lenses: {
      'FE 20-70mm f/4 G': { focal: [20, 70], maxAperture: 4, bestLandscape: 'f/8', note: '轻便旅行头，20mm端够广' },
      'FE 16-35mm f/2.8 GM': { focal: [16, 35], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '超广角云海经典组合' },
    },
    tips: ['轻便机身适合徒步登山', '翻转屏方便低角度构图', '创意外观模式可直出氛围感照片'],
  },
  'sony-a6700': {
    brand: 'Sony', model: 'A6700', sensor: 'APS-C',
    coc: 0.020, nativeISO: [100, 32000], bestISO: 100,
    evCompRange: [-5, 5],
    lenses: {
      'E 10-18mm f/4': { focal: [10, 18], maxAperture: 4, bestLandscape: 'f/8', note: '等效15-27mm超广角' },
      'E 18-135mm f/3.5-5.6': { focal: [18, 135], maxAperture: 3.5, bestLandscape: 'f/8', note: '一镜走天下旅行方案' },
    },
    tips: ['APS-C裁切系数1.5x注意等效焦距', 'AI对焦性能接近全画幅旗舰', '轻便登山首选'],
  },

  // === Nikon ===
  'nikon-z8': {
    brand: 'Nikon', model: 'Z8', sensor: 'full-frame',
    coc: 0.030, nativeISO: [64, 25600], bestISO: 64,
    evCompRange: [-5, 5],
    lenses: {
      'Z 14-24mm f/2.8 S': { focal: [14, 24], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '超广角S线镜头，星空+云海绝配' },
      'Z 24-70mm f/2.8 S': { focal: [24, 70], maxAperture: 2.8, bestLandscape: 'f/8-f/11', note: '标变旗舰' },
      'Z 70-200mm f/2.8 VR S': { focal: [70, 200], maxAperture: 2.8, bestLandscape: 'f/8', note: '长焦云浪利器' },
    },
    tips: ['原生ISO 64画质极佳', '星光模式(Starlight View)方便暗光构图', '延时视频机内合成'],
  },
  'nikon-z6iii': {
    brand: 'Nikon', model: 'Z6 III', sensor: 'full-frame',
    coc: 0.030, nativeISO: [100, 64000], bestISO: 100,
    evCompRange: [-3, 3],
    lenses: {
      'Z 24-120mm f/4 S': { focal: [24, 120], maxAperture: 4, bestLandscape: 'f/8', note: '大变焦旅行首选' },
      'Z 14-30mm f/4 S': { focal: [14, 30], maxAperture: 4, bestLandscape: 'f/8-f/11', note: '轻便超广角方案' },
    },
    tips: ['部分遮光传感器减少鬼影', '高感优秀适合蓝调/夜景'],
  },

  // === Fujifilm ===
  'fuji-xt5': {
    brand: 'Fujifilm', model: 'X-T5', sensor: 'APS-C',
    coc: 0.020, nativeISO: [125, 12800], bestISO: 125,
    evCompRange: [-5, 5],
    lenses: {
      'XF 10-24mm f/4': { focal: [10, 24], maxAperture: 4, bestLandscape: 'f/8', note: '等效15-36mm超广角' },
      'XF 16-55mm f/2.8': { focal: [16, 55], maxAperture: 2.8, bestLandscape: 'f/8', note: '等效24-84mm标变' },
      'XF 50-140mm f/2.8': { focal: [50, 140], maxAperture: 2.8, bestLandscape: 'f/8', note: '等效75-210mm长焦' },
    },
    tips: ['胶片模拟Velvia模式直出风光色彩浓郁', '4020万像素可大幅裁切', 'APS-C裁切系数1.5x'],
  },
};

// === Phone presets ===
const PHONE_PRESETS = {
  'iphone-16pro': {
    brand: 'Apple', model: 'iPhone 16 Pro / Pro Max',
    lenses: [
      { name: '超广角 13mm', focal: 13, aperture: 2.2, note: '云海全景震撼', bestFor: '壮阔全景' },
      { name: '广角 24mm', focal: 24, aperture: 1.78, note: '主摄画质最佳', bestFor: '主力拍摄' },
      { name: '长焦 120mm', focal: 120, aperture: 2.8, note: '5x光学变焦拍云浪', bestFor: '远景特写' },
    ],
    features: ['ProRAW 拍摄保留最大后期空间', '48MP全像素输出', '动作模式防抖适合手持延时', '夜景模式最长30秒曝光'],
    timelapse: '内置延时摄影模式，自动调整间隔',
  },
  'huawei-p70pro': {
    brand: 'Huawei', model: 'P70 Pro / Ultra',
    lenses: [
      { name: '超广角', focal: 13, aperture: 2.2, note: '全景模式', bestFor: '壮阔全景' },
      { name: '广角主摄', focal: 23, aperture: 1.4, note: 'XMAGE影像', bestFor: '主力拍摄' },
      { name: '长焦', focal: 90, aperture: 2.6, note: '3.5x光学变焦', bestFor: '远景特写' },
    ],
    features: ['XMAGE影像风格直出氛围感', '长曝光模式（丝绢水/流光）', 'RAW+拍摄', '超级夜景多帧合成'],
    timelapse: '相机-更多-延时摄影',
  },
  'xiaomi-15pro': {
    brand: 'Xiaomi', model: '小米 15 Pro / Ultra',
    lenses: [
      { name: '超广角 14mm', focal: 14, aperture: 2.2, note: '115°视角', bestFor: '壮阔全景' },
      { name: '广角主摄 23mm', focal: 23, aperture: 1.6, note: '5000万像素', bestFor: '主力拍摄' },
      { name: '长焦 75mm', focal: 75, aperture: 2.6, note: '3.2x光学', bestFor: '远景特写' },
    ],
    features: ['徕卡色彩（鲜艳/经典）直出氛围', '长曝光/光绘/星轨模式', '专业模式支持RAW', '超级夜景AI降噪'],
    timelapse: '相机-更多-延时摄影',
  },
  'oneplus-13': {
    brand: 'OnePlus', model: '一加 13',
    lenses: [
      { name: '超广角 14mm', focal: 14, aperture: 2.2, note: '120°视角', bestFor: '壮阔全景' },
      { name: '广角主摄 23mm', focal: 23, aperture: 1.6, note: '5000万像素 LYT-808', bestFor: '主力拍摄' },
      { name: '长焦 73mm', focal: 73, aperture: 2.6, note: '3x光学变焦', bestFor: '远景特写' },
    ],
    features: ['哈苏色彩调校直出大片', '专业模式支持RAW+长曝光', 'AI场景识别自动优化', '超级夜景+星空模式'],
    timelapse: '相机-更多-延时摄影',
  },
  'oppo-findx8pro': {
    brand: 'OPPO', model: 'Find X8 Pro',
    lenses: [
      { name: '超广角 15mm', focal: 15, aperture: 2.2, note: '114°视角', bestFor: '壮阔全景' },
      { name: '广角主摄 23mm', focal: 23, aperture: 1.6, note: '5000万像素 LYT-808', bestFor: '主力拍摄' },
      { name: '长焦 65mm', focal: 65, aperture: 2.6, note: '3x光学变焦', bestFor: '中距特写' },
      { name: '超长焦 135mm', focal: 135, aperture: 2.6, note: '6x光学潜望', bestFor: '远景特写' },
    ],
    features: ['哈苏人像+风光模式', '专业模式RAW/长曝光/星轨', 'AI消除/扩图', '闪速抓拍不糊片'],
    timelapse: '相机-更多-延时摄影',
  },
  'vivo-x200pro': {
    brand: 'vivo', model: 'X200 Pro',
    lenses: [
      { name: '超广角 15mm', focal: 15, aperture: 2.0, note: '119°视角 JN1', bestFor: '壮阔全景' },
      { name: '广角主摄 23mm', focal: 23, aperture: 1.57, note: '5000万像素 HP9', bestFor: '主力拍摄' },
      { name: '长焦 100mm', focal: 100, aperture: 2.67, note: '蔡司APO长焦', bestFor: '远景特写' },
    ],
    features: ['蔡司T*镀膜减少鬼影眩光', '蔡司自然色/生动色彩模式', '长曝光/星空/流光模式', '专业模式RAW输出'],
    timelapse: '相机-更多-延时摄影',
  },
  'samsung-s25ultra': {
    brand: 'Samsung', model: 'Galaxy S25 Ultra',
    lenses: [
      { name: '超广角 13mm', focal: 13, aperture: 2.2, note: '120°视角', bestFor: '壮阔全景' },
      { name: '广角 23mm', focal: 23, aperture: 1.7, note: '2亿像素主摄', bestFor: '主力拍摄' },
      { name: '长焦 67mm', focal: 67, aperture: 2.4, note: '3x光学', bestFor: '中距特写' },
      { name: '超长焦 120mm', focal: 120, aperture: 2.4, note: '5x光学', bestFor: '远景特写' },
    ],
    features: ['Expert RAW应用专业拍摄', '2亿像素模式可巨幅裁切', '夜景模式支持长曝光', 'AI一键修图'],
    timelapse: '相机-更多-延时摄影/超级慢动作',
  },
  'pixel-9pro': {
    brand: 'Google', model: 'Pixel 9 Pro',
    lenses: [
      { name: '超广角 12mm', focal: 12, aperture: 1.7, note: '125.5°超大视角', bestFor: '壮阔全景' },
      { name: '广角 25mm', focal: 25, aperture: 1.68, note: '主摄', bestFor: '主力拍摄' },
      { name: '长焦 112mm', focal: 112, aperture: 2.8, note: '5x光学', bestFor: '远景特写' },
    ],
    features: ['天文摄影模式（自动长曝+堆栈）', 'Magic Eraser消除杂物', '长曝光模式', '最佳照片(Best Take)'],
    timelapse: '相机-延时摄影',
  },
};

/**
 * Get camera recommendation for specific device + conditions
 */
function getCameraRecommendation(presetId, ev, lighting, windSpeed, cloudSeaScore) {
  const preset = CAMERA_PRESETS[presetId];
  if (!preset) return null;

  const hasCloudSea = cloudSeaScore >= 55;
  const windCalm = (windSpeed ?? 0) <= 5;
  const isNight = lighting.phase === 'night';
  const isBluehour = lighting.phase.includes('blue-hour');

  // Pick best lens for conditions
  const lensEntries = Object.entries(preset.lenses);
  let recommendedLens;
  if (hasCloudSea) {
    // Prefer wide-angle for cloud sea panorama, but also suggest telephoto
    recommendedLens = lensEntries.find(([name]) => name.includes('16-35') || name.includes('15-35') || name.includes('14-24') || name.includes('10-'));
    if (!recommendedLens) recommendedLens = lensEntries[0];
  } else {
    recommendedLens = lensEntries.find(([name]) => name.includes('24-70') || name.includes('24-105') || name.includes('24-120') || name.includes('16-55'));
    if (!recommendedLens) recommendedLens = lensEntries[0];
  }

  const [lensName, lensSpec] = recommendedLens;

  // Compute settings
  let aperture, shutter, iso;
  if (isNight) {
    aperture = `f/${lensSpec.maxAperture}`;
    iso = Math.min(preset.nativeISO[1], 3200);
    shutter = '15-30s';
  } else if (isBluehour) {
    aperture = lensSpec.bestLandscape;
    iso = Math.min(preset.nativeISO[1], 800);
    shutter = '2-10s';
  } else if (hasCloudSea && windCalm) {
    aperture = lensSpec.bestLandscape;
    iso = preset.bestISO;
    shutter = '0.5-4s (ND)';
  } else {
    aperture = lensSpec.bestLandscape;
    iso = preset.bestISO;
    shutter = '自动';
  }

  // Secondary lens suggestion
  let altLens = null;
  if (hasCloudSea) {
    const tele = lensEntries.find(([name]) => name.includes('70-200') || name.includes('100-') || name.includes('50-140'));
    if (tele && tele[0] !== lensName) {
      altLens = { name: tele[0], note: tele[1].note };
    }
  }

  return {
    brand: preset.brand,
    model: preset.model,
    sensor: preset.sensor,
    lens: lensName,
    lensNote: lensSpec.note,
    aperture,
    shutter,
    iso: `ISO ${iso}`,
    altLens,
    tips: preset.tips,
    allLenses: lensEntries.map(([name, spec]) => ({ name, note: spec.note, bestAperture: spec.bestLandscape })),
  };
}

/**
 * Get phone recommendation for specific device
 */
function getPhoneRecommendation(presetId, cloudSeaScore) {
  const preset = PHONE_PRESETS[presetId];
  if (!preset) return null;

  const hasCloudSea = cloudSeaScore >= 55;

  // Pick best lens
  let primaryLens, altLens;
  if (hasCloudSea && preset.lenses.length >= 2) {
    primaryLens = preset.lenses.find(l => l.focal <= 15) || preset.lenses[0]; // ultra-wide
    altLens = preset.lenses.find(l => l.focal >= 60); // telephoto for details
  } else {
    primaryLens = preset.lenses.find(l => l.focal >= 20 && l.focal <= 30) || preset.lenses[0]; // main
  }

  return {
    brand: preset.brand,
    model: preset.model,
    primaryLens,
    altLens,
    features: preset.features,
    timelapse: preset.timelapse,
    allLenses: preset.lenses,
  };
}

function getAllCameraPresets() {
  return Object.entries(CAMERA_PRESETS).map(([id, p]) => ({ id, label: `${p.brand} ${p.model}` }));
}

function getAllPhonePresets() {
  return Object.entries(PHONE_PRESETS).map(([id, p]) => ({ id, label: `${p.brand} ${p.model}` }));
}

module.exports = {
  CAMERA_PRESETS,
  PHONE_PRESETS,
  getCameraRecommendation,
  getPhoneRecommendation,
  getAllCameraPresets,
  getAllPhonePresets,
};
