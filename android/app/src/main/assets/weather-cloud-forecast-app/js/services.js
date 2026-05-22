(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};
  var core = global.CloudSeaCore;
  var adapters = global.CloudSeaAdapters || {};

  var services = core.createServices({
    http: adapters.webHttp,
    storage: adapters.webStorage,
    getLocation: function() {
      return new Promise(function(resolve, reject) {
        if (!global.navigator || !navigator.geolocation) {
          reject(new Error('浏览器不支持定位'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          function(err) {
            reject(new Error(err.message || '定位失败，请在浏览器设置中允许位置权限'));
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    },
  });

  CS.services = {
    fetchWeather: services.fetchWeather,
    fetchElevation: services.fetchElevation,
    geocodeAddress: services.geocodeAddress,
    getLocation: services.getLocation,
  };
  CS._webRequest = services._requestJson;
})(window);
