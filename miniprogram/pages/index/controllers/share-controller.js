const { buildPosterModel } = require('../../../utils/poster-layout');
const { renderToCanvas } = require('../../../utils/poster-renderer');

const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1700;

function promisifyWx(method, options) {
  return new Promise((resolve, reject) => {
    method({
      ...(options || {}),
      success: resolve,
      fail: reject,
    });
  });
}

function queryPosterCanvas(pageContext) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(pageContext);
    query.select('#poster-canvas')
      .fields({ node: true, size: true })
      .exec(res => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          reject(new Error('海报画布未就绪'));
          return;
        }
        resolve(canvas);
      });
  });
}

function shareOrSaveImage(filePath) {
  if (wx.showShareImageMenu) {
    return promisifyWx(wx.showShareImageMenu, { path: filePath });
  }
  if (wx.saveImageToPhotosAlbum) {
    return promisifyWx(wx.saveImageToPhotosAlbum, { filePath });
  }
  if (wx.previewImage) {
    wx.previewImage({ urls: [filePath] });
    return Promise.resolve();
  }
  return Promise.resolve();
}

async function generatePoster(pageContext) {
  if (!pageContext || !pageContext.data) throw new Error('缺少页面上下文');
  wx.showLoading({ title: '生成海报中', mask: true });
  try {
    const model = buildPosterModel(pageContext.data);
    const canvas = await queryPosterCanvas(pageContext);
    const dpr = wx.getSystemInfoSync ? (wx.getSystemInfoSync().pixelRatio || 1) : 1;
    canvas.width = POSTER_WIDTH * dpr;
    canvas.height = POSTER_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    renderToCanvas(ctx, model, { width: POSTER_WIDTH, height: POSTER_HEIGHT });
    const exportResult = await promisifyWx(wx.canvasToTempFilePath, {
      canvas,
      fileType: 'png',
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      destWidth: POSTER_WIDTH * dpr,
      destHeight: POSTER_HEIGHT * dpr,
    });
    const tempFilePath = exportResult.tempFilePath;
    await shareOrSaveImage(tempFilePath);
    wx.showToast({ title: '海报已生成', icon: 'success' });
    return tempFilePath;
  } catch (error) {
    wx.showToast({ title: '海报生成失败', icon: 'none' });
    throw error;
  } finally {
    wx.hideLoading();
  }
}

/**
 * Build a multi-section share text covering cloud-sea / sunset / stars.
 * Mirrors the web/native bridge text used in the App so users get the
 * same richness when sharing via clipboard / system share.
 */
function buildShareText(state) {
  if (!state) return '';
  const lines = [];
  let locationLine = `📍 ${state.locationName || '观测点'}`;
  if (state.elevation != null) locationLine += `  ·  海拔 ${Math.round(state.elevation)}m`;
  lines.push(locationLine);
  const dateLabel = (state.dayLabels && state.dayLabels[state.selectedDayIndex || 0])
    || new Date().toLocaleDateString('zh-CN');
  lines.push(`📅 ${dateLabel}`);
  lines.push('');

  const preds = [];
  if (state.analysis) preds.push({ icon: '☁️', name: '云海', score: state.analysis.score, label: state.analysis.resultText || state.analysis.label, summary: state.analysis.summary });
  if (state.glowAnalysis) preds.push({ icon: '🌅', name: '晚霞', score: state.glowAnalysis.score, label: state.glowAnalysis.resultText || state.glowAnalysis.label, summary: state.glowAnalysis.summary });
  if (state.starInfo) preds.push({ icon: '🌌', name: '星空', score: state.starInfo.score, label: state.starInfo.resultText || state.starInfo.label, summary: state.starInfo.summary });

  preds.forEach((item) => {
    if (item.score == null) return;
    const scoreText = Math.round(Number(item.score));
    let line = `${item.icon} ${item.name}：${scoreText} 分`;
    if (item.label) line += `（${item.label}）`;
    lines.push(line);
    if (item.summary) lines.push(`   · ${item.summary}`);
  });

  const reasons = (state.analysis && Array.isArray(state.analysis.reasons))
    ? state.analysis.reasons.slice(0, 3).map((r) => typeof r === 'string' ? r : (r.text || r.label || r.message || '')).filter(Boolean)
    : [];
  if (reasons.length) {
    lines.push('');
    lines.push('💡 主要依据：');
    reasons.forEach((r) => lines.push(`  · ${r}`));
  }

  const hourly = [];
  if (state.currentHumidity != null && state.currentHumidity !== '--') hourly.push(`湿度 ${state.currentHumidity}%`);
  if (state.currentCloudCover != null && state.currentCloudCover !== '--') hourly.push(`云量 ${state.currentCloudCover}%`);
  if (state.currentWind != null && state.currentWind !== '--') hourly.push(`风速 ${state.currentWind} m/s`);
  if (state.currentDewGap != null && state.currentDewGap !== '--') hourly.push(`露点差 ${state.currentDewGap}°C`);
  if (hourly.length) {
    lines.push('');
    lines.push(`🌡️ ${hourly.join('  ·  ')}`);
  }

  const wp = state.selectedWaypoint || (Array.isArray(state.nearbyWaypoints) && state.nearbyWaypoints[0]);
  if (wp && wp.name) {
    lines.push('');
    let wpLine = `📷 推荐机位：${wp.name}`;
    if (wp.distanceKm != null) wpLine += `（${wp.distanceKm}km）`;
    lines.push(wpLine);
  }

  lines.push('');
  lines.push('— CloudSeaShell · 云海观测决策台');
  return lines.join('\n');
}

/**
 * Build a compact onShareAppMessage title covering all three predictions
 * so receivers get a useful preview even before they open the card.
 */
function buildShareTitle(state) {
  if (!state) return '云海观测决策台';
  const parts = [];
  if (state.analysis && state.analysis.score != null) parts.push(`云海 ${Math.round(state.analysis.score)}`);
  if (state.glowAnalysis && state.glowAnalysis.score != null) parts.push(`晚霞 ${Math.round(state.glowAnalysis.score)}`);
  if (state.starInfo && state.starInfo.score != null) parts.push(`星空 ${Math.round(state.starInfo.score)}`);
  const scoreText = parts.length ? `（${parts.join(' / ')}）` : '';
  return `${state.locationName || '观测点'} 云海/晚霞/星空预报${scoreText}`;
}

function copyShareTextToClipboard(state) {
  const text = buildShareText(state);
  if (!text || !wx || typeof wx.setClipboardData !== 'function') return Promise.resolve(false);
  return promisifyWx(wx.setClipboardData, { data: text })
    .then(() => true)
    .catch(() => false);
}

function createShareController(deps) {
  return {
    generatePoster(pageContext) {
      return generatePoster(pageContext || deps.page);
    },
    buildShareTitle(state) {
      return buildShareTitle(state || (deps.page && deps.page.data));
    },
    buildShareText(state) {
      return buildShareText(state || (deps.page && deps.page.data));
    },
    copyShareTextToClipboard(state) {
      return copyShareTextToClipboard(state || (deps.page && deps.page.data));
    },
  };
}

module.exports = { createShareController, generatePoster, buildShareText, buildShareTitle };
