(function(root) {
  'use strict';

  function toast(msg) {
    if (root.CloudSea && typeof root.CloudSea.showToast === 'function') {
      root.CloudSea.showToast(msg);
    } else {
      console.log(msg);
    }
  }

  function loading(msg) {
    if (root.CloudSea && typeof root.CloudSea.showLoading === 'function') root.CloudSea.showLoading(msg);
  }

  function hideLoading() {
    if (root.CloudSea && typeof root.CloudSea.hideLoading === 'function') root.CloudSea.hideLoading();
  }

  var api = { toast: toast, loading: loading, hideLoading: hideLoading };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CloudSeaAdapters = root.CloudSeaAdapters || {};
  root.CloudSeaAdapters.webUi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
