/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaPorts = root.CloudSeaPorts || {};
    root.CloudSeaPorts.ui = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const contract = {
    toast: 'toast(msg, type) -> void',
    loading: 'loading(msg) -> void',
    hideLoading: 'hideLoading() -> void',
  };

  const noop = {
    toast() {},
    loading() {},
    hideLoading() {},
  };

  return { contract, noop };
});
