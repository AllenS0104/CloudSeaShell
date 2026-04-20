import {
  getBridgeInfo,
  hasBridgeCapability,
  invokeBridgeRequest,
  waitForAndroidBridge,
} from './bridge.js';

function getBrowserLocation(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前环境不支持定位')); 
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(error.message || '浏览器定位失败')),
      options,
    );
  });
}

function asFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLocationResult(...payload) {
  const value = payload.length <= 1 ? payload[0] : payload;

  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return normalizeLocationResult(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 1) {
      return normalizeLocationResult(value[0]);
    }

    const latitude = asFiniteNumber(value[0]);
    const longitude = asFiniteNumber(value[1]);
    if (latitude !== null && longitude !== null) {
      return {
        coords: { latitude, longitude },
        latitude,
        longitude,
      };
    }

    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const nestedCoords = value.coords && typeof value.coords === 'object'
    ? value.coords
    : null;
  const latitude = asFiniteNumber(
    nestedCoords?.latitude
      ?? nestedCoords?.lat
      ?? value.latitude
      ?? value.lat,
  );
  const longitude = asFiniteNumber(
    nestedCoords?.longitude
      ?? nestedCoords?.lng
      ?? nestedCoords?.lon
      ?? value.longitude
      ?? value.lng
      ?? value.lon,
  );

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    ...value,
    coords: {
      ...(nestedCoords || {}),
      latitude,
      longitude,
    },
    latitude,
    longitude,
  };
}

export async function getDeviceLocation() {
  const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
  const bridge = await waitForAndroidBridge('getCurrentPosition');
  if (!bridge) {
    return getBrowserLocation(options);
  }

  const bridgeInfo = await getBridgeInfo({ timeout: 0 });
  if (bridgeInfo.supportsRequest && hasBridgeCapability(bridgeInfo, 'location.current')) {
    try {
      const position = normalizeLocationResult(await invokeBridgeRequest({
        action: 'location.getCurrentPosition',
        payload: options,
        timeout: options.timeout + 1000,
      }));
      if (position) {
        return position;
      }
    } catch {
      // Fall through to the legacy callback path for backward compatibility.
    }
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const callbackName = `locationCallback_${Date.now()}`;
    const fallback = async (message) => {
      if (settled) {
        return;
      }

      try {
        const browserPosition = await getBrowserLocation(options);
        finishResolve(browserPosition);
      } catch (error) {
        finishReject(new Error(message || error.message || '定位失败'));
      }
    };

    const cleanup = () => {
      delete window[callbackName];
      delete window.onLocationResult;
      delete window.onLocationError;
      delete window.onPermissionResult;
    };

    const finishResolve = (position) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(position);
    };

    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const handleNativeResult = (...resultPayload) => {
      const position = normalizeLocationResult(...resultPayload);
      if (!position) {
        fallback('原生定位结果无效');
        return;
      }
      finishResolve(position);
    };

    window[callbackName] = handleNativeResult;
    window.onLocationResult = handleNativeResult;
    window.onLocationError = (errorMessage) => fallback(`定位失败：${errorMessage}`);
    window.onPermissionResult = (granted) => {
      if (granted === false || granted === 'false' || granted === 'denied' || granted === 0) {
        fallback('用户拒绝了定位权限');
      }
    };

    try {
      bridge.getCurrentPosition(callbackName);
    } catch (error) {
      try {
        bridge.getCurrentPosition();
      } catch (fallbackError) {
        fallback(error.message || fallbackError.message);
        return;
      }
    }

    setTimeout(() => {
      if (!settled) {
        fallback('原生定位超时');
      }
    }, options.timeout);
  });
}
