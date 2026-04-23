/**
 * Search history — 缓存最近搜索的地点
 */
const HISTORY_KEY = 'cloudsea_search_history';
const MAX_HISTORY = 8;

function getSearchHistory() {
  try {
    return wx.getStorageSync(HISTORY_KEY) || [];
  } catch (e) { return []; }
}

function addSearchHistory(item) {
  // item: { name, lat, lon }
  if (!item || !item.name) return;
  const history = getSearchHistory();
  // Remove duplicate
  const filtered = history.filter(h => 
    !(Math.abs(h.lat - item.lat) < 0.01 && Math.abs(h.lon - item.lon) < 0.01)
  );
  filtered.unshift({ name: item.name, lat: item.lat, lon: item.lon });
  if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY;
  try {
    wx.setStorageSync(HISTORY_KEY, filtered);
  } catch (e) { /* ignore */ }
}

function clearSearchHistory() {
  try {
    wx.removeStorageSync(HISTORY_KEY);
  } catch (e) { /* ignore */ }
}

module.exports = { getSearchHistory, addSearchHistory, clearSearchHistory };
