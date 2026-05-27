(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};
  var core = global.CloudSeaCore;
  var adapters = global.CloudSeaAdapters || {};
  var bridgeSeq = 0;
  var bridgePending = {};

  function requestNativeBridge(action, payload, timeoutMs) {
    return new Promise(function(resolve, reject) {
      if (!global.ReactNativeWebView || typeof global.ReactNativeWebView.postMessage !== 'function') {
        reject(new Error('原生定位桥接不可用'));
        return;
      }

      var requestId = 'web-' + Date.now() + '-' + (++bridgeSeq);
      var timer = setTimeout(function() {
        delete bridgePending[requestId];
        reject(new Error('定位请求超时'));
      }, timeoutMs || 35000);

      bridgePending[requestId] = {
        resolve: function(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject: function(error) {
          clearTimeout(timer);
          reject(error);
        },
      };

      global.ReactNativeWebView.postMessage(JSON.stringify({
        channel: 'bridge.request',
        requestId: requestId,
        action: action,
        payload: payload || {},
      }));
    });
  }

  global.onBridgeResponse = function(requestId, payload) {
    var pending = bridgePending[requestId];
    if (!pending) return;
    delete bridgePending[requestId];
    pending.resolve(payload);
  };

  global.onBridgeError = function(requestId, error) {
    var pending = bridgePending[requestId];
    if (!pending) return;
    delete bridgePending[requestId];
    pending.reject(new Error((error && error.message) || '原生定位失败'));
  };

  function getBrowserLocation() {
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
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 }
      );
    });
  }

  var services = core.createServices({
    http: adapters.webHttp,
    storage: adapters.webStorage,
    getLocation: function() {
      return requestNativeBridge('location.getCurrentPosition', {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 600000,
      }, 38000).then(function(result) {
        var coords = result && (result.coords || result);
        var latitude = Number(coords && coords.latitude);
        var longitude = Number(coords && coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error('原生定位返回坐标无效');
        }
        return { latitude: latitude, longitude: longitude };
      }).catch(function(nativeError) {
        return getBrowserLocation().catch(function() {
          throw nativeError;
        });
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
