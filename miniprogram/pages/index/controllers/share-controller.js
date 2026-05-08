const { buildPosterModel } = require('../../../utils/poster-layout');
const { renderToCanvas } = require('../../../utils/poster-renderer');

const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1334;

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

function createShareController(deps) {
  return {
    generatePoster(pageContext) {
      return generatePoster(pageContext || deps.page);
    },
  };
}

module.exports = { createShareController, generatePoster };
