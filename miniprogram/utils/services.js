const { createServices } = require('./services-core.js');
const http = require('./adapters/wx-http.js');
const storage = require('./adapters/wx-storage.js');

module.exports = createServices({
  http,
  storage,
  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success(res) {
          resolve({ latitude: res.latitude, longitude: res.longitude });
        },
        fail(err) {
          reject(new Error(err.errMsg || '定位失败，请在设置中允许位置权限'));
        },
      });
    });
  },
});
