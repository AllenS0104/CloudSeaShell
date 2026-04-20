import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';

const CLOUDSEA_WEB_URL = 'file:///android_asset/weather-cloud-forecast-app/index.html';

const BRIDGE_INFO = {
  version: '1.0-rn',
  protocolVersion: '1.0',
  transport: 'rn-webview',
  platform: 'android',
  ready: true,
  shellName: 'CloudSeaShell',
  shellVersion: '0.0.1',
  appName: 'Cloud Sea Shell',
  appVersion: '0.0.1',
  capabilities: [
    'bridge.request',
    'location.current',
    'geocode.search',
    'share.text',
    'share.image',
    'navigation.map',
    'observation.reminder.schedule',
  ],
};

type BridgeRequest = {
  channel?: string;
  requestId?: string;
  action?: string;
  payload?: Record<string, unknown>;
};

type ScheduledReminder = {
  reminderId: string;
  title: string;
  body: string;
  fireAt: string;
  locationName: string;
};

type NativeCloudSeaCapabilities = {
  scheduleObservationReminder?: (payload: {
    reminderId: string;
    title: string;
    body: string;
    fireAt: string;
    locationName: string;
  }) => Promise<{
    reminderId: string;
    fireAt: string;
    transport: string;
  }>;
  shareImage?: (payload: {
    title: string;
    dataUrl: string;
    filename: string;
  }) => Promise<{
    accepted: boolean;
  }>;
};

const cloudSeaCapabilities = NativeModules.CloudSeaCapabilities as NativeCloudSeaCapabilities | undefined;

function escapeForInjectedJavaScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildInjectedScript(callbackName: string, requestId: string, payload: unknown) {
  return `window.${callbackName}(${escapeForInjectedJavaScript(requestId)}, ${escapeForInjectedJavaScript(payload)}); true;`;
}

async function ensureLocationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    || granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  });
}

async function openExternalMap(latitude: number, longitude: number, label: string) {
  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  const androidUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
  const targetUrl = Platform.OS === 'android' ? androidUrl : fallbackUrl;
  const canOpen = await Linking.canOpenURL(targetUrl);
  await Linking.openURL(canOpen ? targetUrl : fallbackUrl);
}

async function ensureNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function searchGeocode(query: string) {
  const endpoint = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=zh&format=json`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('地理搜索失败');
  }

  const data = await response.json() as {
    results?: Array<{
      latitude: number;
      longitude: number;
      name?: string;
      admin1?: string;
      country?: string;
    }>;
  };

  return (data.results || []).map((item) => ({
    latitude: item.latitude,
    longitude: item.longitude,
    name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
  }));
}

function App(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remindersRef = useRef<ScheduledReminder[]>([]);

  const bootstrapScript = useMemo(() => (
    `window.__CLOUDSEA_BRIDGE_INFO__ = ${escapeForInjectedJavaScript(BRIDGE_INFO)}; true;`
  ), []);

  const injectBridgeInfo = useCallback(() => {
    webViewRef.current?.injectJavaScript(bootstrapScript);
  }, [bootstrapScript]);

  const respondSuccess = useCallback((requestId: string, payload: unknown) => {
    webViewRef.current?.injectJavaScript(buildInjectedScript('onBridgeResponse', requestId, payload));
  }, []);

  const respondError = useCallback((requestId: string, error: Record<string, unknown>) => {
    webViewRef.current?.injectJavaScript(buildInjectedScript('onBridgeError', requestId, error));
  }, []);

  const clearReminderTimer = useCallback(() => {
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
  }, []);

  const flushDueReminders = useCallback(() => {
    const now = Date.now();
    const due = remindersRef.current.filter((item) => new Date(item.fireAt).getTime() <= now);
    if (!due.length) {
      return;
    }

    due.forEach((item) => {
      Alert.alert(item.title, item.body || `${item.locationName} 已到观测提醒时间。`);
    });
    remindersRef.current = remindersRef.current.filter((item) => new Date(item.fireAt).getTime() > now);
  }, []);

  const syncReminderTimer = useCallback(() => {
    clearReminderTimer();
    flushDueReminders();

    const nextReminder = remindersRef.current
      .sort((left, right) => new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime())[0];

    if (!nextReminder) {
      return;
    }

    const delay = Math.max(0, new Date(nextReminder.fireAt).getTime() - Date.now());
    reminderTimerRef.current = setTimeout(() => {
      flushDueReminders();
      syncReminderTimer();
    }, delay + 50);
  }, [clearReminderTimer, flushDueReminders]);

  const handleBridgeAction = useCallback(async (request: BridgeRequest) => {
    const requestId = String(request.requestId || '');
    if (!requestId || !request.action) {
      return;
    }

    try {
      switch (request.action) {
        case 'location.getCurrentPosition': {
          const granted = await ensureLocationPermission();
          if (!granted) {
            throw {
              code: 'PERMISSION_DENIED',
              message: '用户未授权定位',
              recoverable: true,
              permissionState: 'denied',
            };
          }

          const position = await getCurrentPosition() as {
            coords: { latitude: number; longitude: number };
          };
          respondSuccess(requestId, {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          return;
        }
        case 'share.text': {
          const title = String(request.payload?.title || '云海观测简报');
          const text = String(request.payload?.text || '');
          await Share.share({
            title,
            message: text,
          });
          respondSuccess(requestId, { accepted: true });
          return;
        }
        case 'share.image': {
          const title = String(request.payload?.title || '云海观测海报');
          const dataUrl = String(request.payload?.dataUrl || '');
          const filename = String(request.payload?.filename || 'cloud-sea-brief.png');
          if (!dataUrl) {
            throw {
              code: 'INVALID_IMAGE',
              message: '分享图片不能为空',
            };
          }
          if (!cloudSeaCapabilities?.shareImage) {
            throw {
              code: 'UNSUPPORTED_ACTION',
              message: '当前壳层暂不支持原生图片分享',
            };
          }
          const result = await cloudSeaCapabilities.shareImage({
            title,
            dataUrl,
            filename,
          });
          respondSuccess(requestId, result || { accepted: true });
          return;
        }
        case 'geocode.search': {
          const query = String(request.payload?.query || '').trim();
          if (!query) {
            throw {
              code: 'INVALID_QUERY',
              message: '搜索关键词不能为空',
            };
          }
          const results = await searchGeocode(query);
          respondSuccess(requestId, { results });
          return;
        }
        case 'navigation.map': {
          const latitude = Number(request.payload?.latitude);
          const longitude = Number(request.payload?.longitude);
          const label = String(request.payload?.label || '观测点');
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw {
              code: 'INVALID_COORDINATES',
              message: '地图坐标无效',
            };
          }
          await openExternalMap(latitude, longitude, label);
          respondSuccess(requestId, { opened: true });
          return;
        }
        case 'observation.reminder.schedule': {
          const reminderId = String(request.payload?.reminderId || '');
          const title = String(request.payload?.title || '云海观测提醒');
          const body = String(request.payload?.body || '');
          const fireAt = String(request.payload?.fireAt || '');
          const locationName = String(
            (request.payload?.location as { name?: string } | undefined)?.name || '当前地点',
          );
          if (!reminderId || Number.isNaN(new Date(fireAt).getTime())) {
            throw {
              code: 'INVALID_REMINDER',
              message: '提醒参数无效',
            };
          }

          const notificationGranted = await ensureNotificationPermission();
          if (cloudSeaCapabilities?.scheduleObservationReminder && notificationGranted) {
            const nativeResult = await cloudSeaCapabilities.scheduleObservationReminder({
              reminderId,
              title,
              body,
              fireAt,
              locationName,
            });
            respondSuccess(requestId, nativeResult || {
              scheduled: true,
              reminderId,
              fireAt,
              transport: 'android-notification',
            });
            return;
          }

          remindersRef.current = [
            {
              reminderId,
              title,
              body,
              fireAt,
              locationName,
            },
            ...remindersRef.current.filter((item) => item.reminderId !== reminderId),
          ];
          syncReminderTimer();
          respondSuccess(requestId, {
            scheduled: true,
            reminderId,
            fireAt,
            transport: notificationGranted ? 'rn-foreground' : 'webview-foreground',
          });
          return;
        }
        default:
          throw {
            code: 'UNSUPPORTED_ACTION',
            message: `当前壳层暂不支持 ${request.action}`,
          };
      }
    } catch (error) {
      const normalized = error instanceof Error
        ? { code: 'BRIDGE_ERROR', message: error.message }
        : error as Record<string, unknown>;
      respondError(requestId, normalized);
    }
  }, [respondError, respondSuccess, syncReminderTimer]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const request = JSON.parse(event.nativeEvent.data) as BridgeRequest;
      if (request.channel !== 'bridge.request') {
        return;
      }
      await handleBridgeAction(request);
    } catch (error) {
      console.warn('Bridge message parse failed:', error);
    }
  }, [handleBridgeAction]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [canGoBack]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setAppState(nextState);
      if (nextState === 'active') {
        flushDueReminders();
        syncReminderTimer();
      }
    });

    return () => subscription.remove();
  }, [flushDueReminders, syncReminderTimer]);

  useEffect(() => () => clearReminderTimer(), [clearReminderTimer]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{ uri: CLOUDSEA_WEB_URL }}
        style={styles.container}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          injectBridgeInfo();
          if (appState === 'active') {
            flushDueReminders();
            syncReminderTimer();
          }
        }}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          setCanGoBack(navState.canGoBack);
        }}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={bootstrapScript}
        mixedContentMode="always"
        allowFileAccess
        onError={(syntheticEvent) => {
          setIsLoading(false);
          Alert.alert('加载错误', '网页加载失败，请检查网络连接或部署地址。');
          console.warn('WebView error:', syntheticEvent.nativeEvent);
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3aa4ff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
});

export default App;
