(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};
  CS.favorites = global.CloudSeaCore.createFavorites({
    storage: global.CloudSeaAdapters.webStorage,
  });
})(window);
