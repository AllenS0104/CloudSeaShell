/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaCore = root.CloudSeaCore || {};
    root.CloudSeaCore.createSearchHistory = api.createSearchHistory;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const HISTORY_KEY = 'cloudsea_search_history';
  const MAX_HISTORY = 8;
  const noopStorage = { get() { return null; }, set() {}, remove() {}, keys() { return []; } };

  function createSearchHistory(options) {
    const storage = (options && options.storage) || noopStorage;

    function getSearchHistory() {
      try {
        return storage.get(HISTORY_KEY) || [];
      } catch (e) { return []; }
    }

    function addSearchHistory(item) {
      if (!item || !item.name) return;
      const history = getSearchHistory();
      const filtered = history.filter(h =>
        !(Math.abs(h.lat - item.lat) < 0.01 && Math.abs(h.lon - item.lon) < 0.01)
      );
      filtered.unshift({ name: item.name, lat: item.lat, lon: item.lon });
      if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY;
      try {
        storage.set(HISTORY_KEY, filtered);
      } catch (e) { /* ignore */ }
    }

    function clearSearchHistory() {
      try {
        storage.remove(HISTORY_KEY);
      } catch (e) { /* ignore */ }
    }

    return { getSearchHistory, addSearchHistory, clearSearchHistory };
  }

  return { createSearchHistory, constants: { HISTORY_KEY, MAX_HISTORY } };
});
