function request(options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    wx.request({
      url: opts.url,
      method: opts.method || 'GET',
      data: opts.data,
      header: opts.header,
      timeout: opts.timeout,
      success(res) {
        resolve({
          statusCode: res.statusCode,
          data: res.data,
          header: res.header || res.headers || {},
        });
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

module.exports = { request };
