(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};
  CS.searchHistory = global.CloudSeaCore.createSearchHistory({
    storage: global.CloudSeaAdapters.webStorage,
  });
})(window);
