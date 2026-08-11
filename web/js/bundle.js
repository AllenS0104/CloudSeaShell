// Auto-generated bundle — do not edit. Run: npm run build:web
// Deterministic output: build time is recorded in dist/build-info.json.
(function(global) {
'use strict';
const _cache = {};

function require(name) {
  const key = name.replace(/^\.\//,'').replace(/\.js$/,'');
  if (_cache[key]) return _cache[key];
  throw new Error('Module not found: ' + key);
}

// === math-utils ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(value, inLow, inHigh, outLow, outHigh) {
  const t = clamp((value - inLow) / (inHigh - inLow), 0, 1);
  return outLow + t * (outHigh - outLow);
}

module.exports = { clamp, lerp };

  _cache['math-utils'] = module.exports;
})();

// === thresholds ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
/**
 * 云海评分的判定阈值。
 *
 * 这里集中定义是为了避免「魔法数字」再次散落到十几个模块里 —— 调阈值时
 * 漏改任何一处，都会让 UI 文案、拍摄建议和 go/no-go 结论互相打架。
 *
 * 【定标依据】运行 npm run audit:prediction 可复现。
 * 审计用 274 条样本（84 条人工标注正样本 + 22 条人工标注负样本 + 168 条
 * 同机位同月的控制日），把正样本占比从有偏的 79.2% 拉回到 30.7%。
 *
 * 阈值 55 的问题：当时组件分合计 134 后被 clamp 到 100，造成分数饱和，
 * 59% 的「没有云海」的日子也落在 90-100 档，特异度只有 13.6%，模型准确率
 * 80.2% 对比「永远说有云海」的平凡基线 79.2%，只高 0.9 个百分点。
 *
 * 修掉 clamp 饱和（改为按可用组件线性归一）后分数重新铺开，阈值需要重新定标。
 * 两个面板的平衡准确率在 75 同时取得最优（面板 A 65.0% / 面板 B 60.2%），
 * 是唯一的稳健一致点，故取 75。代价是召回率降到 ~62% —— 对「专程上山看云海」
 * 这种高成本行动，少推荐胜过频繁放空枪。
 *
 * 【仍未解决】AUC 只有 0.60~0.67，低于 0.7 的可用线。也就是说模型的排序能力
 * 本身仍然偏弱，靠挪阈值救不回来，需要改进特征或引入新数据源。改这里的数字
 * 前请务必重跑审计，不要凭直觉调。
 */

// 建议出行（go）：suggestion / hasCloudSea 的判定线。
const CLOUD_SEA_GO = 75;

// 值得专程冲一趟：审计中该档特异度 90.9%，足够选择性。
const CLOUD_SEA_STRONG = 85;

// 可以观望：低于此线召回率已接近饱和，基本不必考虑。
const CLOUD_SEA_WATCH = 35;

module.exports = {
  CLOUD_SEA_GO,
  CLOUD_SEA_STRONG,
  CLOUD_SEA_WATCH,
};

  _cache['thresholds'] = module.exports;
})();

// === i18n ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
/**
 * i18n — 多语言支持基础设施
 * 
 * 使用方式：
 *   const { t } = require('./i18n');
 *   t('hero.epicDay')  → '今日大片日！云海+晚霞双绝，必须出发'
 *   t('weather.humidity', { value: 85 })  → '湿度 85%'
 * 
 * 切换语言：
 *   const i18n = require('./i18n');
 *   i18n.setLocale('en');
 */

const locales = {
  'zh-CN': {
    // === 首页 ===
    'app.title': '云海观测决策台',
    'app.subtitle': '面向摄影、徒步与山地观测的专业天气分析工具',
    'app.eyebrow': 'CLOUD SEA FORECAST LAB',

    // === 搜索 ===
    'search.placeholder': '输入地点（默认：北京）',
    'search.confirm': '确认',
    'search.locate': '📍 当前位置',
    'search.locating': '正在获取当前位置...',
    'search.searching': '正在搜索 {address}...',
    'search.cancelled': '已取消选择',
    'search.failed': '搜索失败：{error}',

    // === 状态 ===
    'status.fetchingElevation': '正在获取海拔数据...',
    'status.fetchingWeather': '正在获取天气数据...',
    'status.cached': '使用缓存数据（点击刷新获取最新）',
    'status.updated': '天气数据已更新',
    'status.offline': '离线模式：数据来自 {minutes} 分钟前（联网后自动更新）',
    'status.loadFailed': '加载失败：{error}',

    // === 天气数据 ===
    'weather.humidity': '湿度',
    'weather.wind': '风速',
    'weather.cloudCover': '云量',
    'weather.elevation': '海拔',
    'weather.cloudBase': '云底高度',
    'weather.dewGap': '露点差',

    // === 预测结果 ===
    'forecast.title': '云海判断',
    'forecast.today': '今日云海预测',
    'forecast.allDay': '全天云海预测',
    'forecast.disclaimer': '⚠️ 预测仅供参考，基于数值天气模式估算，实际云海受微地形、局地气流等因素影响，请结合现场条件判断。',

    // === Hero Card ===
    'hero.epicDay': '今日大片日！云海+晚霞双绝，必须出发',
    'hero.cloudSea': '云海有戏，建议守候',
    'hero.sunset': '晚霞概率较高，日落前到位',
    'hero.stars': '今晚适合拍银河',
    'hero.rest': '今天适合在家修图',

    // === 行动建议 ===
    'guidance.title': '观测行动建议',
    'guidance.goForIt': '值得冲',
    'guidance.wait': '可以蹲守',
    'guidance.maybe': '可观望',
    'guidance.skip': '不建议专程前往',
    'guidance.window': '推荐时段',
    'guidance.daylight': '日出日落',
    'guidance.viewpoint': '机位建议',

    // === 晚霞 ===
    'glow.title': '🌅 晚霞 / 火烧云预测',
    'glow.disclaimer': '🌅 晚霞预测基于中高层云量、低云遮挡、湿度和能见度综合评估。最佳观赏窗口为日落前 30 分钟至日落后 15 分钟。',

    // === 银河 ===
    'stars.title': '🌌 银河 / 星空预测',
    'stars.moonPhase': '月相',
    'stars.moonBrightness': '月面亮度',
    'stars.milkyWayCore': '银河核心',
    'stars.bestTime': '最佳时段',
    'stars.visible': '可见',
    'stars.notVisible': '不可见',

    // === 安全 ===
    'safety.thunderstorm': '雷暴风险：CAPE {value} J/kg，山顶远离金属物体',
    'safety.convection': '对流发展中：CAPE {value} J/kg，注意天气变化',
    'safety.cold': '体感温度仅 {value}°C，注意防寒保暖',
    'safety.altitude': '高海拔区域注意防晒和补水，紫外线显著增强',

    // === SOS ===
    'sos.title': '🆘 SOS 紧急求救',
    'sos.call110': '拨打 110',
    'sos.call119': '拨打 119',
    'sos.copyLocation': '复制位置信息',

    // === 底部栏 ===
    'nav.photo': '摄影参数',
    'nav.feedback': '反馈',
    'nav.history': '历史',
    'nav.sos': '紧急求救',
    'nav.share': '分享',

    // === 错误态 ===
    'error.title': '数据加载失败',
    'error.retry': '🔄 重新加载',

    // === 历史页 ===
    'history.title': '📊 观测历史',
    'history.subtitle': '预测记录与准确性趋势',
    'history.export': '导出',
    'history.empty': '暂无观测记录',
    'history.emptyHint': '去首页查看预测吧',
    'history.goHome': '返回首页',
    'history.totalRecords': '总记录',
    'history.filled': '已反馈',
    'history.cloudSeaAccuracy': '云海准确率',
    'history.glowAccuracy': '晚霞准确率',

    // === 融合预测 ===
    'fusion.title': '多模式融合预测',
    'fusion.loading': '正在融合多个气象模式...',
    'fusion.modelCount': '模式数量',
    'fusion.agreement': '一致性',
    'fusion.consensus': '共识时段',
    'fusion.inversion': '逆温层',
  },

  'en': {
    'app.title': 'Cloud Sea Observatory',
    'app.subtitle': 'Professional weather analysis for photography, hiking & mountain observation',
    'app.eyebrow': 'CLOUD SEA FORECAST LAB',
    'search.placeholder': 'Enter location (default: Beijing)',
    'search.confirm': 'Search',
    'search.locate': '📍 My Location',
    'hero.epicDay': "Epic day! Cloud sea + sunset glow, let's go!",
    'hero.cloudSea': 'Cloud sea likely, worth waiting',
    'hero.sunset': 'Sunset glow expected, arrive before dusk',
    'hero.stars': 'Good night for Milky Way',
    'hero.rest': 'Stay home and edit photos today',
    'guidance.goForIt': 'Go for it!',
    'guidance.wait': 'Worth waiting',
    'guidance.maybe': 'Maybe',
    'guidance.skip': 'Not recommended',
    'error.title': 'Failed to load data',
    'error.retry': '🔄 Retry',
    // ... more translations can be added incrementally
  },
};

let currentLocale = 'zh-CN';

/**
 * Translate a key with optional interpolation
 * @param {string} key - dot-separated key (e.g., 'hero.epicDay')
 * @param {Object} params - interpolation values (e.g., { value: 85 })
 * @returns {string} translated text, or key if not found
 */
function t(key, params) {
  const dict = locales[currentLocale] || locales['zh-CN'];
  let text = dict[key];

  // Fallback to zh-CN if key not found in current locale
  if (text === undefined && currentLocale !== 'zh-CN') {
    text = locales['zh-CN'][key];
  }

  // Return key if still not found
  if (text === undefined) return key;

  // Interpolate {param} placeholders
  if (params) {
    Object.keys(params).forEach(function(k) {
      text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
    });
  }

  return text;
}

function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale;
  } else {
    console.warn('Unsupported locale:', locale, '— falling back to zh-CN');
    currentLocale = 'zh-CN';
  }
}

function getLocale() {
  return currentLocale;
}

function getSupportedLocales() {
  return Object.keys(locales);
}

module.exports = { t, setLocale, getLocale, getSupportedLocales };

  _cache['i18n'] = module.exports;
})();

// === scoring ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
const { clamp, lerp } = require('./math-utils');
const { CLOUD_SEA_GO, CLOUD_SEA_STRONG, CLOUD_SEA_WATCH } = require('./thresholds');

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

/**
 * 中层云惩罚 —— 区分「云海」与「云雾/白墙」。
 *
 * 低云量、湿度、露点差这些判据对两种现象**完全一样**：
 * 站在云上俯瞰云海，和整个人埋在云雾里看不见五米，
 * 地面读数都是高湿、饱和、低云满格。所以此前白墙必然拿高分，
 * 是假阳性的主要来源。
 *
 * 中层云是把两者分开的信号：局地辐射雾（真云海）几乎不伴随中层云，
 * 而中层云意味着系统性的锋面云系——那是阴天，不是云海。
 *
 * 682 样本定标（data/features.csv）：
 *   中层云  0-10%  → 成功率 40.3%
 *          25-50% → 22.0%
 *          75-90% →  7.7%
 * 且**不是总云量的影子**（相关系数仅 0.51）：控制总云量后仍有独立信号，
 * 总云量 50-85% 时，中层云 <40% 成功率 47.1%、≥40% 仅 14.3%（落差 32.8pp）。
 *
 * 30% 以下不罚：少量中层云不影响低层雾海的形成。
 */
function midCloudPenalty(midCloudCover) {
  const v = Number(midCloudCover ?? 0);
  if (!Number.isFinite(v) || v <= 30) return 0;
  if (v >= 75) return 12;
  return Math.round(lerp(v, 30, 75, 0, 12));
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
  if (safeScore >= CLOUD_SEA_STRONG) {
    return { label: '高把握', level: 'high' };
  }
  if (safeScore >= CLOUD_SEA_GO) {
    return { label: '较高把握', level: 'medium' };
  }
  if (safeScore >= CLOUD_SEA_WATCH) {
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
  midCloudPenalty,
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

  _cache['scoring'] = module.exports;
})();

// === guidance ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
const { CLOUD_SEA_GO, CLOUD_SEA_STRONG, CLOUD_SEA_WATCH } = require('./thresholds');

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
  const goLevel = analysis.score >= CLOUD_SEA_STRONG
    ? '值得冲'
    : analysis.score >= CLOUD_SEA_GO
      ? '可以蹲守'
      : analysis.score >= CLOUD_SEA_WATCH
        ? '可观望'
        : '不建议专程前往';
  const goClass = analysis.score >= CLOUD_SEA_GO ? 'go' : analysis.score >= CLOUD_SEA_WATCH ? 'watch' : 'stop';

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

module.exports = {
  recommendedViewpoint,
  recommendedTargetElevation,
  buildObservationGuidance,
  windowAroundSunrise,
  formatTimeLabel,
  shiftMinutes,
};

  _cache['guidance'] = module.exports;
})();

// === calculations ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
// Background images not used in Mini Program (bundled locally if needed)
const DAY_BACKGROUND = '';
const NIGHT_BACKGROUND = '';

const { clamp } = require('./math-utils');
const { CLOUD_SEA_GO } = require('./thresholds');
const scoring = require('./scoring');
const guidance = require('./guidance');

const {
  scoreHumidity,
  scoreElevationGap,
  scoreVisibility,
  scoreWind,
  scoreCloudCover,
  scoreLowCloudCover,
  midCloudPenalty,
  scoreDewPointSpread,
  scorePressure,
  precipitationPenalty,
  scoreTimeWindow,
  scoreInversion,
  scoreVerticalInversion,
  scoreCapeStability,
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
  midCloudCover,
  dewPointGap,
  pressureMsl,
  precipitationProbability,
  precipitationAmount,
  timeScore,
  inversionDetected,
  inversionStrength,
  inversionLayer,
  cape,
  capePenalty,
}) {
  const reasons = [];

  // 白墙预警放在最前：reasons 最终只保留 5 条，而"劝退"信息对用户的价值
  // 高于任何一条锦上添花的正面理由。若排在后面会被正面理由挤掉。
  if (midCloudCover >= 50) {
    reasons.push(`中层云量 ${Math.round(midCloudCover)}%偏高，多为系统性云系而非局地雾海，`
      + '更可能是身处云雾中的「白墙」而不是俯瞰脚下云海，实拍效果通常打折。');
  } else if (midCloudCover >= 30) {
    reasons.push(`中层云量 ${Math.round(midCloudCover)}%，存在被云雾笼罩而非俯瞰云海的可能。`);
  }

  if (inversionDetected) {
    if (inversionLayer) {
      reasons.push(`检测到逆温层（${inversionLayer} 比地面高 ${inversionStrength.toFixed(1)}°C），暖盖压制对流，有利低云/雾层稳定堆叠。`);
    } else {
      reasons.push(`检测到逆温层（温差 ${inversionStrength.toFixed(1)}°C），有利于低云/雾层稳定维持。`);
    }
  }

  if (Number(capePenalty) >= 3) {
    reasons.push(`对流潜势偏强（CAPE ${Math.round(cape)} J/kg），层结不稳定不利于稳定云海形成。`);
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

/**
 * True when a model supplies no usable value for an hourly variable across
 * the requested slice (missing array, or every entry null/undefined/NaN).
 */
function isSeriesUnavailable(series, start, count) {
  if (!Array.isArray(series)) return true;
  const slice = series.slice(start, start + count);
  if (!slice.length) return true;
  return slice.every((value) => value === null || value === undefined || Number.isNaN(Number(value)));
}

/**
 * Sum scoring components and normalise the result onto a 0-100 scale.
 *
 * Two problems are solved here.
 *
 * 1) Model coverage differs. Open-Meteo models disagree on which variables
 *    they return: ICON/JMA/ECMWF return `visibility` as all-null while GFS
 *    returns real values. Treating a missing variable as 0 silently deducted
 *    its full weight (up to 15 points for visibility), which made those models
 *    score systematically lower than GFS and inflated the cross-model spread
 *    behind the "模式分歧" label. Missing components are excluded and the
 *    remainder renormalised, keeping models comparable.
 *
 * 2) Score saturation. The components add up to 134 points, and the caller
 *    used to clamp that to 100. Any day scoring 75% of the component points
 *    therefore pegged at 100, which crushed most weather into one bucket:
 *    an audit over 274 samples found 59% of days *without* a cloud sea still
 *    landed in the 90-100 band, leaving specificity at 17% no matter where
 *    the go/no-go threshold was placed. Worse, the clamp headroom silently
 *    absorbed the precipitation and reliability penalties — a raw-134 day
 *    could take a 30 point penalty and still display 100.
 *    Dividing by the available maximum keeps the full range usable and makes
 *    penalties actually visible.
 *
 * Returns a 0-100 value; callers subtract penalties afterwards.
 */
function scoreAvailableComponents(components, unavailable) {
  let rawSum = 0;
  let availableMax = 0;

  for (const component of components) {
    if (component.key && unavailable && unavailable[component.key]) {
      continue;
    }
    rawSum += component.value;
    availableMax += component.max;
  }

  if (availableMax <= 0) {
    return 0;
  }

  return Math.round((rawSum / availableMax) * 100);
}

function analyzeCloudSeaSample({
  temperature,
  humidity,
  visibility,
  cloudCover,
  lowCloudCover,
  midCloudCover,
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
  inversionLayer = null,
  capePenalty = 0,
  cape = 0,
  unavailable = null,
}) {
  const safeTemperature = Number(temperature ?? 0);
  const safeHumidity = Number(humidity ?? 0);
  const safeVisibility = Number(visibility ?? 0);
  const safeCloudCover = Number(cloudCover ?? 0);
  const safeLowCloudCover = Number(lowCloudCover ?? 0);
  const safeMidCloudCover = Number(midCloudCover ?? 0);
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
  // 中层云惩罚：把「站在云上」与「埋在云里」分开，详见 scoring.js
  const midPenalty = midCloudPenalty(safeMidCloudCover);

  const baseScore = clamp(
    scoreAvailableComponents([
      { max: 25, value: scoreHumidity(safeHumidity) },
      { max: 25, value: scoreElevationGap(gapToElevation) },
      { max: 15, value: scoreVisibility(safeVisibility), key: 'visibility' },
      { max: 10, value: scoreWind(safeWindSpeed) },
      { max: 8, value: scoreCloudCover(safeCloudCover) },
      { max: 12, value: scoreLowCloudCover(safeLowCloudCover) },
      { max: 12, value: scoreDewPointSpread(safeTemperature, safeDewPoint) },
      { max: 5, value: scorePressure(safePressureMsl) },
      { max: 10, value: timeScore },
      { max: 12, value: inversionScore },
    ], unavailable),
    0,
    100,
  );
  const compositePenalty = compositeReliabilityPenalty({    humidity: safeHumidity,
    windSpeed: safeWindSpeed,
    cloudCover: safeCloudCover,
    lowCloudCover: safeLowCloudCover,
    inversionDetected,
    dewPointGap,
    precipitationProbability: safePrecipitationProbability,
  });
  const score = clamp(baseScore - penalty - compositePenalty - midPenalty - Number(capePenalty || 0), 0, 100);
  const confidence = scoreToConfidence(score);
  const suggestion = score >= CLOUD_SEA_GO;

  return {
    cloudBase,
    humidity: safeHumidity,
    visibility: safeVisibility,
    cloudCover: safeCloudCover,
    lowCloudCover: safeLowCloudCover,
    midCloudCover: safeMidCloudCover,
    windSpeed: safeWindSpeed,
    dewPoint: safeDewPoint,
    dewPointGap,
    pressureMsl: safePressureMsl,
    precipitationProbability: safePrecipitationProbability,
    precipitationAmount: safePrecipitationAmount,
    gapToElevation,
    timeScore,
    inversionScore,
    inversionDetected,
    inversionStrength,
    inversionLayer,
    cape: Number(cape || 0),
    capePenalty: Number(capePenalty || 0),
    baseScore,
    penalty,
    compositePenalty,
    midPenalty,
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
      midCloudCover: safeMidCloudCover,
      dewPointGap,
      pressureMsl: safePressureMsl,
      precipitationProbability: safePrecipitationProbability,
      precipitationAmount: safePrecipitationAmount,
      timeScore,
      inversionDetected,
      inversionStrength,
      inversionLayer,
      cape: Number(cape || 0),
      capePenalty: Number(capePenalty || 0),
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

function getHourlyMidCloudCover(hourly, start, count = 24) {
  const values = hourly?.cloud_cover_mid ?? hourly?.cloudcover_mid ?? [];
  return values.slice(start, start + count).map((value) => Number(value ?? 0));
}

function minOrZero(values) {
  return values.length ? Math.min(...values) : 0;
}

function maxOrZero(values) {
  return values.length ? Math.max(...values) : 0;
}

/**
 * Cheap content fingerprint of the 24 h window actually used for scoring.
 * Cache correctness depends on this: two different weather payloads must
 * never collide, otherwise callers such as the multi-model fusion silently
 * reuse another model's result.
 */
function fingerprintHourly(hourly, start) {
  if (!hourly) return 'none';
  const fields = [
    'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
    'visibility', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'wind_speed_10m',
    'precipitation', 'precipitation_probability', 'cape',
    'temperature_925hPa', 'temperature_850hPa', 'temperature_700hPa',
  ];
  /* eslint-disable no-bitwise */
  let hash = 0x811c9dc5;
  const mix = (value) => {
    // null/undefined must not collide with a real 0 reading: a model that
    // omits a variable would otherwise share a cache entry with one that
    // reports 0 for it.
    let n;
    if (value === null || value === undefined) {
      n = -888888;
    } else {
      n = Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : -999999;
    }
    hash ^= n;
    hash = Math.imul(hash, 0x01000193);
  };
  mix(hourly.time?.[start] ? String(hourly.time[start]).length : 0);
  for (const field of fields) {
    const series = hourly[field];
    if (!Array.isArray(series)) { mix(-1); continue; }
    for (let i = start; i < start + 24; i += 1) mix(series[i]);
  }
  return (hash >>> 0).toString(36);
  /* eslint-enable no-bitwise */
}

function analyzeDayCloudSea(hourly, start, elevation, sunriseTimeFromAPI) {
  // Cache key must fingerprint the actual weather payload, not just the
  // slice parameters. Keying on start/elevation/sunrise alone made every
  // caller with matching parameters share one result — which silently
  // reduced multi-model fusion (ICON/GFS/JMA/ECMWF) to a single model and
  // returned stale scores after a forecast refresh.
  const cacheKey = `${start}_${elevation}_${sunriseTimeFromAPI || ''}_${fingerprintHourly(hourly, start)}`;
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
  const midCloudCover = getHourlyMidCloudCover(hourly, start, 24);
  const windSpeeds = (hourly.wind_speed_10m ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const precipitationProbabilities = (hourly.precipitation_probability ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const precipitationAmounts = (hourly.precipitation ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  const timeSeries = hourly.time.slice(start, start + 24);
  const temp925 = (hourly.temperature_925hPa ?? []).slice(start, start + 24);
  const temp850 = (hourly.temperature_850hPa ?? []).slice(start, start + 24);
  const temp700 = (hourly.temperature_700hPa ?? []).slice(start, start + 24);
  const capeValues = (hourly.cape ?? []).slice(start, start + 24).map((value) => Number(value ?? 0));
  // Some Open-Meteo models (ICON/JMA/ECMWF) never return `visibility` — the
  // array is present but entirely null. Flag it so the scorer excludes the
  // component instead of scoring it as 0 km.
  const unavailable = {
    visibility: isSeriesUnavailable(hourly.visibility, start, 24),
  };
  const sunriseTime = sunriseTimeFromAPI || timeSeries.find((timeString) => {
    const hour = new Date(timeString).getHours();
    return hour >= 5 && hour <= 7;
  }) || timeSeries[0];
  const timeSeriesInversion = scoreInversion(temperatures);
  const hourlyAnalyses = temperatures.map((temperature, index) => {
    const verticalInversion = scoreVerticalInversion({
      surfaceTemperature: temperature,
      temperature925hPa: temp925[index],
      temperature850hPa: temp850[index],
      temperature700hPa: temp700[index],
      elevation,
    });
    // Use the pressure-level (real vertical profile) result whenever upper-air
    // data exists — including when it reports "no inversion". Falling back to
    // the surface time-series proxy in that case caused ~96% of days to be
    // flagged as having an inversion (ground truth: ~10%), because rising
    // daytime surface temperature looks identical to an inversion to that proxy.
    const useVertical = verticalInversion.available;
    const inversionScore = useVertical ? verticalInversion.score : timeSeriesInversion.score;
    const inversionDetected = useVertical ? verticalInversion.detected : timeSeriesInversion.detected;
    const inversionStrength = useVertical ? verticalInversion.strength : timeSeriesInversion.strength;
    const inversionLayer = useVertical ? verticalInversion.layer : null;
    const capeAtHour = Number(capeValues[index] || 0);
    const capePenalty = scoreCapeStability(capeAtHour);

    return analyzeCloudSeaSample({
      temperature,
      humidity: humidities[index],
      visibility: visibilities[index],
      cloudCover: cloudCover[index],
      lowCloudCover: lowCloudCover[index],
      midCloudCover: midCloudCover[index],
      windSpeed: windSpeeds[index],
      dewPoint: dewPoints[index],
      pressureMsl: pressureMsl[index],
      precipitationProbability: precipitationProbabilities[index],
      precipitationAmount: precipitationAmounts[index],
      elevation,
      timeString: timeSeries[index],
      sunriseTime,
      inversionScore,
      inversionDetected,
      inversionStrength,
      inversionLayer,
      cape: capeAtHour,
      capePenalty,
      unavailable,
    });
  });
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
    inversion: timeSeriesInversion,
    verticalInversionAvailable: temp925.length > 0 || temp850.length > 0 || temp700.length > 0,
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
  fingerprintHourly,
  minOrZero,
  maxOrZero,
  windDirection,
  formatDistanceKm,
  formatCoords,
  pickBackgroundImage,
  DAY_BACKGROUND,
  NIGHT_BACKGROUND,
}, scoring, guidance);

  _cache['calculations'] = module.exports;
})();

// === photography ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
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

  _cache['photography'] = module.exports;
})();

// === stargazing ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
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

  _cache['stargazing'] = module.exports;
})();

// === sunset ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
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

const { clamp, lerp } = require('./math-utils');

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
 * Aerosol bonus / penalty for sunset glow.
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
  aerosol,
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
  const aerosolScore = aerosol ? scoreAerosolForGlow(aerosol) : 0;

  const rawScore = midScore + highScore + humidityScore + visScore + timeScore + aerosolScore - lowPenalty - penalty;
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
  const humidities = hourly.relative_humidity_2m.slice(start, start + 24).map(v => Number(v ?? 0));
  const visibilities = (hourly.visibility ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipProbs = (hourly.precipitation_probability ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
  const precipAmts = (hourly.precipitation ?? []).slice(start, start + 24).map(v => Number(v ?? 0));

  const aerosolSeries = buildAerosolSeries(times, airQuality);

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
};

  _cache['sunset'] = module.exports;
})();

// === camera-presets ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
const { CLOUD_SEA_GO } = require('./thresholds');
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

  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
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
function getPhoneRecommendation(presetId, cloudSeaScore, lighting, windSpeed) {
  const preset = PHONE_PRESETS[presetId];
  if (!preset) return null;

  const hasCloudSea = cloudSeaScore >= CLOUD_SEA_GO;
  const windCalm = (windSpeed ?? 0) <= 5;
  const isNight = lighting?.phase === 'night';
  const isBluehour = (lighting?.phase || '').includes('blue-hour');
  const isGolden = (lighting?.phase || '').includes('golden');

  // Pick best lens
  let primaryLens, altLens;
  if (hasCloudSea && preset.lenses.length >= 2) {
    primaryLens = preset.lenses.find(l => l.focal <= 15) || preset.lenses[0];
    altLens = preset.lenses.find(l => l.focal >= 60);
  } else {
    primaryLens = preset.lenses.find(l => l.focal >= 20 && l.focal <= 30) || preset.lenses[0];
  }

  // Shooting mode recommendation
  let mode, modeNote;
  if (isNight) {
    mode = '夜景模式';
    modeNote = '手持稳定 3-5 秒，AI 多帧合成';
  } else if (hasCloudSea && windCalm) {
    mode = '专业模式 / 长曝光';
    modeNote = '设置 1-4 秒快门拍丝绸云海';
  } else if (isBluehour) {
    mode = '夜景模式 / 专业模式';
    modeNote = '蓝调时段需要延长曝光';
  } else if (isGolden) {
    mode = 'HDR 模式';
    modeNote = '保留日出日落高光与暗部细节';
  } else {
    mode = '风景模式 / AI拍照';
    modeNote = 'AI 自动识别场景优化';
  }

  // Pro mode settings
  let proISO, proShutter, proWB;
  if (isNight) {
    proISO = '800-1600';
    proShutter = '1/4s - 4s';
    proWB = '自动';
  } else if (hasCloudSea && windCalm) {
    proISO = '50-100';
    proShutter = '1s - 4s';
    proWB = isGolden ? '偏暖 (5000K)' : '自动';
  } else if (isBluehour) {
    proISO = '200-800';
    proShutter = '1s - 8s';
    proWB = '偏冷 (7000K)';
  } else {
    proISO = '50-200';
    proShutter = '自动';
    proWB = '自动';
  }

  return {
    brand: preset.brand,
    model: preset.model,
    primaryLens,
    altLens,
    mode,
    modeNote,
    proSettings: { iso: proISO, shutter: proShutter, wb: proWB },
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

  _cache['camera-presets'] = module.exports;
})();

// === analyzer ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
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
  const dayAnalysis = calc.analyzeDayCloudSea(hourly, start, elevation, daily?.sunrise?.[selectedDayIndex]);

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

function analyzeGlow(hourly, start, sunrise, sunset, airQuality) {
  const result = sunsetModule.analyzeDayGlow(hourly, start, sunrise, sunset, airQuality);
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

  _cache['analyzer'] = module.exports;
})();

// === poster-layout ===
(function() {
  var module = { exports: {} };
  var exports = module.exports;
// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
const DEFAULT_WIDTH = 750;
const DEFAULT_HEIGHT = 1700;

const PALETTES = {
  dark: {
    theme: 'dark',
    backgroundTop: '#0b2f5b',
    backgroundBottom: '#211433',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(173,199,255,0.18)',
    text: '#eef4ff',
    textSecondary: '#aab4c5',
    textMuted: '#6f7d95',
    primary: '#3aa4ff',
    primarySoft: 'rgba(58,164,255,0.16)',
    success: '#37d67a',
    warning: '#ffb84d',
    danger: '#ff6b6b',
    glow: '#ff8a3d',
    star: '#b388ff',
    white: '#ffffff',
  },
  light: {
    theme: 'light',
    backgroundTop: '#dff3ff',
    backgroundBottom: '#f6e7ff',
    card: 'rgba(255,255,255,0.72)',
    cardBorder: 'rgba(11,47,91,0.12)',
    text: '#142033',
    textSecondary: '#506070',
    textMuted: '#7a8796',
    primary: '#1677d2',
    primarySoft: 'rgba(22,119,210,0.12)',
    success: '#168a4a',
    warning: '#b36a00',
    danger: '#c43b3b',
    glow: '#d95f14',
    star: '#7354c8',
    white: '#ffffff',
  },
};

function posterPalette(theme) {
  return { ...(PALETTES[theme] || PALETTES.dark) };
}

function firstValue() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function round(value, digits) {
  const num = toNumber(value);
  if (num === null) return null;
  const factor = Math.pow(10, digits || 0);
  return Math.round(num * factor) / factor;
}

function formatValue(value, unit, digits) {
  const num = round(value, digits || 0);
  if (num === null) return '--';
  return `${num}${unit || ''}`;
}

function normalizeReason(reason) {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  return reason.text || reason.label || reason.message || String(reason);
}

function normalizeHint(hint) {
  if (!hint) return '';
  if (typeof hint === 'string') return hint;
  return hint.text || hint.label || hint.title || hint.value || String(hint);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function scoreLabel(score) {
  const num = toNumber(score);
  if (num === null) return '暂无评分';
  if (num >= 80) return '大片概率高';
  if (num >= 60) return '值得蹲守';
  if (num >= 40) return '可观望';
  return '谨慎出发';
}

function confidenceLabel(state, score) {
  const explicit = firstValue(state.confidence, state.analysis?.confidence, state.fusionResult?.confidence);
  if (explicit) return String(explicit);
  const num = toNumber(score);
  if (num === null) return '置信度：待更新';
  if (num >= 70) return '置信度：中高';
  if (num >= 45) return '置信度：中';
  return '置信度：偏低';
}

function collectPredictions(state) {
  const predictions = state.predictions || {};
  const cloud = firstValue(predictions.cloudSea, predictions.cloud, state.analysis);
  const glow = firstValue(predictions.glow, predictions.sunset, state.glowAnalysis);
  const stars = firstValue(predictions.stars, predictions.star, state.starInfo);
  const items = [];
  if (cloud) items.push({ type: '云海', key: 'cloud', icon: '☁️', colorKey: 'primary', data: cloud, score: firstValue(cloud.score, state.score) });
  if (glow) items.push({ type: '晚霞', key: 'glow', icon: '🌅', colorKey: 'glow', data: glow, score: glow.score });
  if (stars) items.push({ type: '星空', key: 'star', icon: '🌌', colorKey: 'star', data: stars, score: stars.score });
  if (!items.length) items.push({ type: '预测', key: 'forecast', icon: '📷', colorKey: 'primary', data: state.analysis || {}, score: firstValue(state.score, state.analysis?.score) });
  return items.map(item => ({ ...item, score: toNumber(item.score) })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

function collectHints(state) {
  const candidates = [];
  candidates.push(...asArray(state.hints));
  candidates.push(...asArray(state.photographerHints));
  candidates.push(...asArray(state.photographyHints));
  candidates.push(...asArray(state.guidance?.actionItems));
  if (state.guidance?.viewpointAdvice) candidates.push(state.guidance.viewpointAdvice);
  if (state.guidance?.recommendedWindow) candidates.push(`推荐窗口：${state.guidance.recommendedWindow}`);
  if (state.photoParams?.composition) candidates.push(...asArray(state.photoParams.composition));
  if (state.selectedWaypoint?.name) {
    candidates.push(`${state.selectedWaypoint.name} · ${state.selectedWaypoint.directionText || state.selectedWaypoint.direction?.label || '建议机位'}`);
  }
  asArray(state.nearbyWaypoints).slice(0, 2).forEach(item => {
    if (item && item.name) candidates.push(`${item.name} · ${item.distanceKm ? `${item.distanceKm}km` : '附近机位'}`);
  });
  if (state.cameraRec?.summary) candidates.push(state.cameraRec.summary);
  if (state.phoneRec?.summary) candidates.push(state.phoneRec.summary);
  return candidates.map(normalizeHint).filter(Boolean).slice(0, 2);
}

function buildPosterModel(state) {
  const safeState = state || {};
  const palette = posterPalette(safeState.theme || 'dark');
  const predictions = collectPredictions(safeState);
  const primary = predictions[0];
  const primaryData = primary.data || {};
  const score = toNumber(firstValue(safeState.score, primary.score, primaryData.score));
  const scoreText = score === null ? '--' : String(Math.round(score));
  const dateText = firstValue(safeState.dateLabel, safeState.dayLabel, safeState.dayLabels?.[safeState.selectedDayIndex || 0], safeState.date, new Date().toLocaleDateString('zh-CN'));
  const locationName = firstValue(safeState.locationName, safeState.location?.name, safeState.location, '当前位置');
  const lat = toNumber(firstValue(safeState.lat, safeState.location?.lat, safeState.latitude));
  const lon = toNumber(firstValue(safeState.lon, safeState.lng, safeState.location?.lon, safeState.longitude));
  const coordsText = (lat !== null && lon !== null) ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '';
  const elevation = toNumber(firstValue(safeState.elevation, safeState.currentElevation));
  const cloudBase = firstValue(safeState.currentCloudBase, safeState.analysis?.cloudBase, primaryData.cloudBase);
  const visibility = firstValue(safeState.currentVisibility, safeState.analysis?.visibility, primaryData.visibility);
  const wind = firstValue(safeState.currentWind, safeState.analysis?.windSpeed, primaryData.windSpeed);
  const humidity = firstValue(safeState.currentHumidity, safeState.analysis?.humidity, primaryData.humidity, safeState.weather?.humidity);
  const reasons = asArray(firstValue(safeState.reasons, primaryData.reasons, safeState.analysis?.reasons))
    .map(normalizeReason)
    .filter(Boolean)
    .slice(0, 5);
  const hints = collectHints(safeState);
  const kpis = [
    { label: '湿度', value: formatValue(humidity, '%'), color: palette.primary },
    { label: '云底', value: formatValue(cloudBase, 'm'), color: palette.success },
    { label: '能见度', value: formatValue(toNumber(visibility) !== null && Number(visibility) > 1000 ? Number(visibility) / 1000 : visibility, 'km', 1), color: palette.warning },
    { label: '风速', value: formatValue(wind, 'm/s', 1), color: palette.star },
  ];

  const predictionCards = predictions.map(item => {
    const data = item.data || {};
    return {
      type: item.type,
      icon: item.icon,
      key: item.key,
      score: item.score,
      scoreText: item.score === null ? '--' : String(Math.round(item.score)),
      label: firstValue(data.resultText, data.label, scoreLabel(item.score)),
      summary: firstValue(data.summary, ''),
      reasons: asArray(data.reasons).map(normalizeReason).filter(Boolean).slice(0, 2),
      color: palette[item.colorKey] || palette.primary,
    };
  });

  const layout = [
    { type: 'title', text: `${locationName}`, value: String(dateText), color: palette.text },
    { type: 'subtitle', text: `${primary.icon} ${primary.type}预测`, value: firstValue(primaryData.resultText, primaryData.label, scoreLabel(score)), color: palette[primary.colorKey] || palette.primary },
    { type: 'score', text: '综合评分', value: `${scoreText}/100`, color: palette[primary.colorKey] || palette.primary },
    { type: 'subtitle', text: confidenceLabel(safeState, score), value: scoreLabel(score), color: palette.textSecondary },
  ];
  kpis.forEach(kpi => layout.push({ type: 'kpi', text: kpi.label, value: kpi.value, color: kpi.color }));
  if (reasons.length) layout.push({ type: 'reasons', text: '推荐理由', value: reasons, color: palette.text });
  if (hints.length) layout.push({ type: 'hints', text: '推荐机位', value: hints, color: palette.success });
  layout.push({ type: 'qrcode', text: '二维码占位', value: '扫码查看实时预报', color: palette.textMuted });
  layout.push({ type: 'footer', text: 'CloudSeaShell · 云海决策台', value: '预测仅供参考，请结合现场天气与安全条件', color: palette.textSecondary });

  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    palette,
    location: String(locationName),
    coordsText,
    elevation,
    date: String(dateText),
    predictionType: primary.type,
    badge: `${primary.icon} ${primary.type}`,
    score,
    scoreText,
    confidence: confidenceLabel(safeState, score),
    summary: firstValue(primaryData.summary, safeState.analysis?.summary, ''),
    predictions: predictionCards,
    kpis,
    reasons,
    hints,
    qrcode: { enabled: false, text: '扫码查看实时预报' },
    footer: 'CloudSeaShell · 云海决策台',
    layout,
  };
}

module.exports = { buildPosterModel, posterPalette };

  _cache['poster-layout'] = module.exports;
})();


// Expose modules globally
global.CloudSea = global.CloudSea || {};
global.CloudSea.calc = _cache['calculations'];
global.CloudSea.analyzer = _cache['analyzer'];
global.CloudSea.presets = _cache['camera-presets'];
global.CloudSea.i18n = _cache['i18n'];
global.CloudSea.scoring = _cache['scoring'];
global.CloudSea.guidance = _cache['guidance'];
global.CloudSea.photography = _cache['photography'];
global.CloudSea.stargazing = _cache['stargazing'];
global.CloudSea.sunset = _cache['sunset'];
global.CloudSea.mathUtils = _cache['math-utils'];
global.CloudSea.thresholds = _cache['thresholds'];
global.CloudSea.posterLayout = _cache['poster-layout'];
})(window);
