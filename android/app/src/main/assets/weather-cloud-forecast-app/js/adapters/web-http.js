(function(root) {
  'use strict';

  function request(options) {
    var opts = options || {};
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (controller && opts.timeout) {
      timer = setTimeout(function() { controller.abort(); }, opts.timeout);
    }

    var fetchOptions = {
      method: opts.method || 'GET',
      headers: opts.header,
      signal: controller ? controller.signal : undefined,
    };
    if (opts.data !== undefined && fetchOptions.method !== 'GET') {
      fetchOptions.body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
      fetchOptions.headers = Object.assign({ 'Content-Type': 'application/json' }, fetchOptions.headers || {});
    }

    return fetch(opts.url, fetchOptions).then(function(res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function(text) {
        var data = text;
        try { data = text ? JSON.parse(text) : null; } catch (e) { /* keep text */ }
        var header = {};
        if (res.headers && res.headers.forEach) {
          res.headers.forEach(function(value, key) { header[key] = value; });
        }
        return { statusCode: res.status, data: data, header: header };
      });
    }).catch(function(err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('请求超时');
      throw err;
    });
  }

  var api = { request: request };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CloudSeaAdapters = root.CloudSeaAdapters || {};
  root.CloudSeaAdapters.webHttp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
