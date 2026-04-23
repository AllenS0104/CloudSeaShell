/**
 * Favorites — 收藏常去的观测点
 */
const FAV_KEY = 'cloudsea_favorites';
const MAX_FAVORITES = 20;

function getFavorites() {
  try {
    return wx.getStorageSync(FAV_KEY) || [];
  } catch (e) { return []; }
}

function addFavorite(item) {
  // item: { name, lat, lon, elevation }
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
    addedAt: Date.now() 
  });
  if (favs.length > MAX_FAVORITES) favs.length = MAX_FAVORITES;
  try {
    wx.setStorageSync(FAV_KEY, favs);
  } catch (e) { /* ignore */ }
  return true;
}

function removeFavorite(lat, lon) {
  const favs = getFavorites();
  const filtered = favs.filter(f => 
    !(Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01)
  );
  try {
    wx.setStorageSync(FAV_KEY, filtered);
  } catch (e) { /* ignore */ }
}

function isFavorite(lat, lon) {
  return getFavorites().some(f => 
    Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01
  );
}

module.exports = { getFavorites, addFavorite, removeFavorite, isFavorite };
