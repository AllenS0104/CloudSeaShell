/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaPorts = root.CloudSeaPorts || {};
    root.CloudSeaPorts.http = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const contract = {
    request: 'request({url, method, data, header, timeout}) -> Promise<{statusCode, data, header}>',
  };

  const noop = {
    request() {
      return Promise.reject(new Error('HTTP port is not configured'));
    },
  };

  return { contract, noop };
});
