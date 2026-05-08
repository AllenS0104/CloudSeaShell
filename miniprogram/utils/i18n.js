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
