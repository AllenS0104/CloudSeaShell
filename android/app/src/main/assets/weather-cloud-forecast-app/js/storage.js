/**
 * Web storage adapter (adapted from wx.getStorageSync/setStorageSync)
 * Provides a unified storage interface using localStorage.
 */
(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};

  CS.storage = {
    get: function(key) {
      try { return JSON.parse(localStorage.getItem(key)); }
      catch (e) { return null; }
    },
    set: function(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { /* ignore — quota exceeded or private mode */ }
    },
    remove: function(key) {
      try { localStorage.removeItem(key); }
      catch (e) { /* ignore */ }
    }
  };

})(window);
