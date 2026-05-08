function decode(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (e) { return value; }
}

function encode(value) {
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function get(key) {
  const value = wx.getStorageSync(key);
  return value === '' || value === undefined ? null : decode(value);
}

function set(key, value) {
  wx.setStorageSync(key, encode(value));
}

function remove(key) {
  if (typeof wx.removeStorageSync === 'function') wx.removeStorageSync(key);
  else wx.setStorageSync(key, null);
}

function keys() {
  if (typeof wx.getStorageInfoSync !== 'function') return [];
  const info = wx.getStorageInfoSync() || {};
  return info.keys || [];
}

module.exports = { get, set, remove, keys };
