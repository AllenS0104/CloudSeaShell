const BRIDGE_PROTOCOL_VERSION = '1.0.0';
const DEFAULT_BRIDGE_TIMEOUT = 15000;
const BRIDGE_ACTIONS = Object.freeze({
  LocationGetCurrentPosition: 'location.getCurrentPosition',
  ShareText: 'share.text',
  SharePayload: 'share.payload',
  ShareImage: 'share.image',
  GeocodeSearch: 'geocode.search',
  NavigationMap: 'navigation.map',
  ObservationReminderSchedule: 'observation.reminder.schedule',
});

let requestSequence = 0;
const pendingRequests = new Map();
const bridgeChangeListeners = new Set();
let lastBridgeSnapshot = '';
let lastBridgeInfo = {
  available: false,
  version: 'web',
  protocolVersion: BRIDGE_PROTOCOL_VERSION,
  transport: 'web',
  platform: 'web',
  ready: false,
  capabilities: [],
  supportedActions: [],
  supportsRequest: false,
};

function parseBridgeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getInjectedBridgeInfo() {
  if (typeof window === 'undefined') {
    return null;
  }

  const injected = window.__CLOUDSEA_BRIDGE_INFO__ ?? window.__NATIVE_BRIDGE_INFO__;
  return injected ? parseBridgeValue(injected) : null;
}

function hasReactNativeWebViewTransport() {
  return typeof window !== 'undefined'
    && typeof window.ReactNativeWebView?.postMessage === 'function';
}

function detectTransport(bridge, hasRnTransport) {
  if (typeof bridge?.request === 'function') {
    return 'android-bridge';
  }
  if (hasRnTransport) {
    return 'rn-webview';
  }
  if (bridge) {
    return 'legacy';
  }
  return 'web';
}

function detectPlatform(transport, injectedBridgeInfo) {
  if (typeof injectedBridgeInfo?.platform === 'string') {
    return injectedBridgeInfo.platform;
  }
  if (transport === 'android-bridge' || transport === 'legacy' || transport === 'rn-webview') {
    return 'android';
  }
  return 'web';
}

function dispatchBridgeEvent(eventName, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function notifyBridgeChange(info) {
  bridgeChangeListeners.forEach((listener) => listener(info));
}

function cacheBridgeInfo(info) {
  lastBridgeInfo = info;
  const snapshot = JSON.stringify(info);
  if (snapshot === lastBridgeSnapshot) {
    return info;
  }

  const previousInfo = lastBridgeSnapshot ? JSON.parse(lastBridgeSnapshot) : null;
  lastBridgeSnapshot = snapshot;
  notifyBridgeChange(info);

  if (info.ready) {
    dispatchBridgeEvent('cloudsea:bridge:ready', info);
  } else if (!info.available) {
    dispatchBridgeEvent('cloudsea:bridge:unavailable', info);
  }

  if (!previousInfo || JSON.stringify(previousInfo.capabilities) !== JSON.stringify(info.capabilities)) {
    dispatchBridgeEvent('cloudsea:bridge:capabilities-changed', info);
  }

  dispatchBridgeEvent('cloudsea:bridge:changed', info);
  return info;
}

function inferLegacyCapabilities(bridge) {
  const capabilities = [];
  if (typeof bridge?.request === 'function') {
    capabilities.push('bridge.request');
  }
  if (typeof bridge?.getCurrentPosition === 'function') {
    capabilities.push('location.current');
  }
  if (typeof bridge?.fetchGeocode === 'function') {
    capabilities.push('geocode.search');
  }
  if (typeof bridge?.shareText === 'function') {
    capabilities.push('share.text');
  }
  if (typeof bridge?.shareImage === 'function') {
    capabilities.push('share.image');
  }
  if (typeof bridge?.openMap === 'function') {
    capabilities.push('navigation.map');
  }
  if (typeof bridge?.scheduleObservationReminder === 'function') {
    capabilities.push('observation.reminder.schedule');
  }
  return capabilities;
}

function normalizeStringArray(value) {
  const parsed = parseBridgeValue(value);
  return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
}

function normalizeCapabilities(rawCapabilities, bridge) {
  const parsed = parseBridgeValue(rawCapabilities);
  const values = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.capabilities)
      ? parsed.capabilities
      : typeof parsed === 'object' && parsed
        ? Object.entries(parsed)
          .filter(([, enabled]) => enabled)
          .map(([capability]) => capability)
        : [];

  return [...new Set([...values, ...inferLegacyCapabilities(bridge)])];
}

function createRequestId() {
  requestSequence += 1;
  return `bridge-${Date.now()}-${requestSequence}`;
}

function clearPendingRequest(requestId) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return null;
  }

  if (pending.timeoutId) {
    window.clearTimeout(pending.timeoutId);
  }
  pendingRequests.delete(requestId);
  return pending;
}

function installBridgeGlobals() {
  if (typeof window === 'undefined' || window.__cloudSeaBridgeGlobalsInstalled) {
    return;
  }

  window.__cloudSeaBridgeGlobalsInstalled = true;

  window.onBridgeResponse = (requestId, payload) => {
    const pending = clearPendingRequest(requestId);
    if (!pending) {
      return;
    }

    try {
      const result = pending.parseResponse
        ? pending.parseResponse(parseBridgeValue(payload))
        : parseBridgeValue(payload);
      pending.resolve(result);
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };

  window.onBridgeError = (requestId, error) => {
    const pending = clearPendingRequest(requestId);
    if (!pending) {
      return;
    }
    pending.reject(normalizeBridgeError(error));
  };
}

function callBridgeRequest(bridge, request) {
  const serializedRequest = JSON.stringify(request);

  try {
    return bridge.request(serializedRequest);
  } catch (firstError) {
    return bridge.request(
      request.action,
      JSON.stringify(request.payload ?? {}),
      request.requestId,
      request.version,
    );
  }
}

function postReactNativeBridgeRequest(request) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    channel: 'bridge.request',
    ...request,
  }));
  return 'accepted';
}

function callLegacyBridgeMethod(methodName, ...args) {
  const bridge = getAndroidBridge(methodName);
  if (!bridge) {
    throw new Error(`原生桥接暂不支持 ${methodName}`);
  }
  return bridge[methodName](...args);
}

function buildBridgeInfo(bridge, injectedBridgeInfo) {
  const hasRnTransport = hasReactNativeWebViewTransport();
  const transport = detectTransport(bridge, hasRnTransport);
  const available = Boolean(bridge || hasRnTransport || injectedBridgeInfo);

  if (!available) {
    return {
      available: false,
      version: 'web',
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      transport: 'web',
      platform: 'web',
      ready: false,
      capabilities: [],
      supportedActions: [],
      supportsRequest: false,
    };
  }

  let version = typeof bridge?.version === 'string' ? bridge.version : null;
  if (!version && typeof bridge?.getVersion === 'function') {
    version = String(bridge.getVersion());
  }
  if (!version && typeof injectedBridgeInfo?.version === 'string') {
    version = injectedBridgeInfo.version;
  }

  let capabilities = inferLegacyCapabilities(bridge);
  if (typeof bridge?.getCapabilities === 'function') {
    capabilities = normalizeCapabilities(bridge.getCapabilities(), bridge);
  } else if (bridge?.capabilities !== undefined) {
    capabilities = normalizeCapabilities(bridge.capabilities, bridge);
  } else if (injectedBridgeInfo?.capabilities !== undefined) {
    capabilities = normalizeCapabilities(injectedBridgeInfo.capabilities, bridge);
  }

  const ready = typeof injectedBridgeInfo?.ready === 'boolean'
    ? injectedBridgeInfo.ready
    : available;
  const supportedActions = normalizeStringArray(injectedBridgeInfo?.supportedActions);

  return {
    available: true,
    version: version || (transport === 'rn-webview' ? 'rn-webview' : 'legacy'),
    protocolVersion: injectedBridgeInfo?.protocolVersion || BRIDGE_PROTOCOL_VERSION,
    transport: injectedBridgeInfo?.transport || transport,
    platform: detectPlatform(transport, injectedBridgeInfo),
    ready,
    capabilities,
    supportedActions,
    supportsRequest: typeof bridge?.request === 'function' || hasRnTransport,
    appName: injectedBridgeInfo?.appName || null,
    appVersion: injectedBridgeInfo?.appVersion || null,
    buildId: injectedBridgeInfo?.buildId || null,
    shellName: injectedBridgeInfo?.shellName || null,
    shellVersion: injectedBridgeInfo?.shellVersion || null,
  };
}

export function hasAndroidBridge(methodName) {
  if (typeof window === 'undefined' || !window.AndroidBridge) {
    return false;
  }

  if (!methodName) {
    return true;
  }

  return typeof window.AndroidBridge?.[methodName] === 'function';
}

export function getAndroidBridge(methodName) {
  return hasAndroidBridge(methodName) ? window.AndroidBridge : null;
}

export function normalizeBridgeError(error, fallbackMessage = '原生请求失败') {
  const parsed = parseBridgeValue(error);

  if (parsed instanceof Error) {
    return parsed;
  }

  if (typeof parsed === 'object' && parsed) {
    const bridgeError = new Error(parsed.message || fallbackMessage);
    bridgeError.code = parsed.code || 'BRIDGE_ERROR';
    bridgeError.recoverable = parsed.recoverable ?? false;
    bridgeError.permissionState = parsed.permissionState ?? 'unknown';
    return bridgeError;
  }

  return new Error(parsed ? String(parsed) : fallbackMessage);
}

export async function getBridgeInfo(options = {}) {
  const bridge = await waitForAndroidBridge(undefined, options);
  const injectedBridgeInfo = getInjectedBridgeInfo();
  return cacheBridgeInfo(buildBridgeInfo(bridge, injectedBridgeInfo));
}

export function hasBridgeCapability(bridgeInfo, capability) {
  return Boolean(bridgeInfo?.capabilities?.includes(capability));
}

export function getProtocolVersion() {
  return buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo()).protocolVersion;
}

export function getSupportedActions(bridgeInfo = null) {
  const info = bridgeInfo || buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo());
  return normalizeStringArray(info.supportedActions);
}

export function hasBridgeActionSupport(bridgeInfo, action) {
  const supportedActions = getSupportedActions(bridgeInfo);
  return supportedActions.length === 0 || supportedActions.includes(action);
}

export function isNativeShell(bridgeInfo = null) {
  const info = bridgeInfo || buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo());
  return info.transport !== 'web';
}

export function isBridgeReady() {
  return Boolean(buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo()).ready);
}

export function onBridgeChange(listener, options = {}) {
  const { immediate = true } = options;
  bridgeChangeListeners.add(listener);
  if (immediate) {
    listener(buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo()));
  }
  return () => bridgeChangeListeners.delete(listener);
}

export function onBridgeReady(listener) {
  if (isBridgeReady()) {
    listener(buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo()));
    return () => {};
  }

  const unsubscribe = onBridgeChange((info) => {
    if (info.ready) {
      unsubscribe();
      listener(info);
    }
  }, { immediate: false });
  return unsubscribe;
}

export function whenBridgeReady(options = {}) {
  if (isBridgeReady()) {
    return Promise.resolve(buildBridgeInfo(getAndroidBridge(undefined), getInjectedBridgeInfo()));
  }

  const { timeout = 1200, interval = 100 } = options;

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const unsubscribe = onBridgeChange((info) => {
      if (info.ready) {
        unsubscribe();
        resolve(info);
      }
    }, { immediate: false });

    const timer = window.setInterval(async () => {
      const info = await getBridgeInfo({ timeout: 0 });
      if (info.ready) {
        window.clearInterval(timer);
        unsubscribe();
        resolve(info);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        unsubscribe();
        resolve(info);
      }
    }, interval);
  });
}

export function updateInjectedBridgeInfo(patch = {}) {
  if (typeof window === 'undefined') {
    return lastBridgeInfo;
  }

  const nextInfo = {
    ...(getInjectedBridgeInfo() || {}),
    ...patch,
  };
  window.__CLOUDSEA_BRIDGE_INFO__ = nextInfo;
  return cacheBridgeInfo(buildBridgeInfo(getAndroidBridge(undefined), nextInfo));
}

export function invokeBridgeRequest({
  action,
  payload = {},
  timeout = DEFAULT_BRIDGE_TIMEOUT,
  parseResponse,
}) {
  const bridge = getAndroidBridge('request');
  const useReactNativeTransport = !bridge && hasReactNativeWebViewTransport();
  if (!bridge && !useReactNativeTransport) {
    return Promise.reject(new Error('原生桥接暂不支持请求协议'));
  }

  const bridgeInfo = buildBridgeInfo(bridge, getInjectedBridgeInfo());
  if (!hasBridgeActionSupport(bridgeInfo, action)) {
    return Promise.reject(new Error(`当前 App 不支持 ${action}，请升级 App 后重试`));
  }

  installBridgeGlobals();

  const requestId = createRequestId();
  const request = {
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    version: BRIDGE_PROTOCOL_VERSION,
    requestId,
    action,
    payload,
  };

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`${action} 请求超时`));
    }, timeout);

    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
      parseResponse,
    });

    try {
      const immediateResult = bridge
        ? callBridgeRequest(bridge, request)
        : postReactNativeBridgeRequest(request);
      if (immediateResult !== undefined && immediateResult !== null && immediateResult !== '' && immediateResult !== true && immediateResult !== 'accepted') {
        const pending = clearPendingRequest(requestId);
        if (pending) {
          const parsedResult = parseResponse
            ? parseResponse(parseBridgeValue(immediateResult))
            : parseBridgeValue(immediateResult);
          pending.resolve(parsedResult);
        }
      }
    } catch (error) {
      clearPendingRequest(requestId);
      reject(normalizeBridgeError(error, `${action} 请求失败`));
    }
  });
}

export async function requestNativeShareText({
  title = '云海观测简报',
  text,
  timeout = DEFAULT_BRIDGE_TIMEOUT,
} = {}) {
  if (!text) {
    throw new Error('分享文本不能为空');
  }

  const bridgeInfo = await getBridgeInfo({ timeout: 0 });
  if (!hasBridgeCapability(bridgeInfo, 'share.text')) {
    throw new Error('原生壳当前不支持文本分享');
  }

  if (bridgeInfo.supportsRequest) {
    return invokeBridgeRequest({
      action: 'share.text',
      payload: { title, text },
      timeout,
    });
  }

  return callLegacyBridgeMethod('shareText', title, text);
}

export async function requestNativeShareImage({
  title = '云海观测海报',
  filename = 'cloud-sea-brief.png',
  dataUrl,
  timeout = DEFAULT_BRIDGE_TIMEOUT,
} = {}) {
  if (!dataUrl) {
    throw new Error('分享图片不能为空');
  }

  const bridgeInfo = await getBridgeInfo({ timeout: 0 });
  if (!hasBridgeCapability(bridgeInfo, 'share.image')) {
    throw new Error('原生壳当前不支持图片分享');
  }

  if (bridgeInfo.supportsRequest) {
    return invokeBridgeRequest({
      action: 'share.image',
      payload: { title, filename, dataUrl },
      timeout,
    });
  }

  return callLegacyBridgeMethod('shareImage', title, dataUrl, filename);
}

export async function requestNativeOpenMap({
  latitude,
  longitude,
  label = '观测点',
  timeout = DEFAULT_BRIDGE_TIMEOUT,
} = {}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new Error('地图坐标无效');
  }

  const bridgeInfo = await getBridgeInfo({ timeout: 0 });
  if (!hasBridgeCapability(bridgeInfo, 'navigation.map')) {
    throw new Error('原生壳当前不支持地图跳转');
  }

  const payload = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    label,
  };

  if (bridgeInfo.supportsRequest) {
    return invokeBridgeRequest({
      action: 'navigation.map',
      payload,
      timeout,
    });
  }

  return callLegacyBridgeMethod('openMap', payload.latitude, payload.longitude, payload.label);
}

export async function requestNativeObservationReminder({
  reminderId,
  title = '云海观测提醒',
  body,
  fireAt,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  location,
  timeout = DEFAULT_BRIDGE_TIMEOUT,
} = {}) {
  if (!fireAt || Number.isNaN(new Date(fireAt).getTime())) {
    throw new Error('提醒时间无效');
  }

  const bridgeInfo = await getBridgeInfo({ timeout: 0 });
  if (!hasBridgeCapability(bridgeInfo, 'observation.reminder.schedule')) {
    throw new Error('原生壳当前不支持观测提醒');
  }

  const payload = {
    reminderId,
    title,
    body,
    fireAt: new Date(fireAt).toISOString(),
    timezone,
    location,
  };

  if (bridgeInfo.supportsRequest) {
    return invokeBridgeRequest({
      action: 'observation.reminder.schedule',
      payload,
      timeout,
    });
  }

  return callLegacyBridgeMethod('scheduleObservationReminder', payload);
}

export function waitForAndroidBridge(methodName, options = {}) {
  const { timeout = 1200, interval = 100 } = options;
  const bridge = getAndroidBridge(methodName);
  if (bridge) {
    return Promise.resolve(bridge);
  }

  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const detectedBridge = getAndroidBridge(methodName);
      if (detectedBridge) {
        window.clearInterval(timer);
        resolve(detectedBridge);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, interval);
  });
}

function createCloudSeaBridgeFacade() {
  return {
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    actions: BRIDGE_ACTIONS,
    getProtocolVersion,
    getSupportedActions,
    supportsAction: async (action) => hasBridgeActionSupport(await getBridgeInfo({ timeout: 0 }), action),
    getInfo: (options) => getBridgeInfo(options),
    refreshInfo: (options) => getBridgeInfo(options),
    isReady: () => isBridgeReady(),
    whenReady: (options) => whenBridgeReady(options),
    onReady: (listener) => onBridgeReady(listener),
    onChange: (listener) => onBridgeChange(listener),
    hasCapability: async (capability) => hasBridgeCapability(await getBridgeInfo({ timeout: 0 }), capability),
    invoke: (request) => invokeBridgeRequest(request),
    scheduleReminder: (payload) => requestNativeObservationReminder(payload),
    updateInfo: (patch) => updateInjectedBridgeInfo(patch),
  };
}

if (typeof window !== 'undefined') {
  installBridgeGlobals();
  window.CloudSeaBridge = createCloudSeaBridgeFacade();
}
