// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
const DEFAULT_WIDTH = 750;
const DEFAULT_HEIGHT = 1334;

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
    date: String(dateText),
    predictionType: primary.type,
    badge: `${primary.icon} ${primary.type}`,
    score,
    scoreText,
    confidence: confidenceLabel(safeState, score),
    summary: firstValue(primaryData.summary, safeState.analysis?.summary, ''),
    kpis,
    reasons,
    hints,
    qrcode: { enabled: false, text: '扫码查看实时预报' },
    footer: 'CloudSeaShell · 云海决策台',
    layout,
  };
}

module.exports = { buildPosterModel, posterPalette };
