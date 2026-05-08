(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};
  CS.feedback = global.CloudSeaCore.createFeedback({
    storage: global.CloudSeaAdapters.webStorage,
  });
})(window);
