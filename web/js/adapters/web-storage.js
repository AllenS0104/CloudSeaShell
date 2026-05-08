(function(root) {
  'use strict';

  function getStore() {
    return root.localStorage;
  }

  function get(key) {
    try {
      var raw = getStore().getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }

  function set(key, value) {
    getStore().setItem(key, JSON.stringify(value));
  }

  function remove(key) {
    getStore().removeItem(key);
  }

  function keys() {
    var store = getStore();
    var result = [];
    for (var i = 0; i < store.length; i++) result.push(store.key(i));
    return result;
  }

  var api = { get: get, set: set, remove: remove, keys: keys };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CloudSeaAdapters = root.CloudSeaAdapters || {};
  root.CloudSeaAdapters.webStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
