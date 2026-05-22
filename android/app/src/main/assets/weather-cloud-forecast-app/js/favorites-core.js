// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。
/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaCore = root.CloudSeaCore || {};
    root.CloudSeaCore.createFavorites = api.createFavorites;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const FAV_KEY = 'cloudsea_favorites';
  const MAX_FAVORITES = 20;
  const noopStorage = { get() { return null; }, set() {}, remove() {}, keys() { return []; } };

  function createFavorites(options) {
    const storage = (options && options.storage) || noopStorage;

    function getFavorites() {
      try {
        return storage.get(FAV_KEY) || [];
      } catch (e) { return []; }
    }

    function addFavorite(item) {
      if (!item || !item.name) return false;
      const favs = getFavorites();
      const exists = favs.some(f =>
        Math.abs(f.lat - item.lat) < 0.01 && Math.abs(f.lon - item.lon) < 0.01
      );
      if (exists) return false;
      favs.unshift({
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        elevation: item.elevation || 0,
        addedAt: Date.now(),
      });
      if (favs.length > MAX_FAVORITES) favs.length = MAX_FAVORITES;
      try {
        storage.set(FAV_KEY, favs);
      } catch (e) { /* ignore */ }
      return true;
    }

    function removeFavorite(lat, lon) {
      const favs = getFavorites();
      const filtered = favs.filter(f =>
        !(Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01)
      );
      try {
        storage.set(FAV_KEY, filtered);
      } catch (e) { /* ignore */ }
    }

    function isFavorite(lat, lon) {
      return getFavorites().some(f =>
        Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01
      );
    }

    return { getFavorites, addFavorite, removeFavorite, isFavorite };
  }

  return { createFavorites, constants: { FAV_KEY, MAX_FAVORITES } };
});
