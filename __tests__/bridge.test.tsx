import { Linking, PermissionsAndroid, Share } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { handleBridgeRequest } from '../App';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-webview', () => ({
  WebView: jest.fn(() => null),
}));

type TestDeps = Parameters<typeof handleBridgeRequest>[1];

const makeDeps = (): TestDeps => ({
  respondSuccess: jest.fn(),
  respondError: jest.fn(),
  remindersRef: { current: [] },
  syncReminderTimer: jest.fn(),
});

describe('Bridge action dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('未知 action 返回 UNSUPPORTED_ACTION', async () => {
    const deps = makeDeps();

    await handleBridgeRequest({ requestId: 'req-unknown', action: 'unknown.action', payload: {} }, deps);

    expect(deps.respondError).toHaveBeenCalledWith(
      'req-unknown',
      expect.objectContaining({ code: 'UNSUPPORTED_ACTION' }),
    );
    expect(deps.respondSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['string', 'string'],
    ['array', []],
    ['undefined', undefined],
  ])('非对象 payload: %s 返回 INVALID_PAYLOAD', async (label, payload) => {
    const deps = makeDeps();
    const request = {
      requestId: `req-invalid-${label}`,
      action: 'share.payload',
      payload,
    } as Parameters<typeof handleBridgeRequest>[0];

    await handleBridgeRequest(request, deps);

    expect(deps.respondError).toHaveBeenCalledWith(
      `req-invalid-${label}`,
      expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
    );
    expect(deps.respondSuccess).not.toHaveBeenCalled();
  });

  it('observation.reminder.schedule 参数无效返回 INVALID_REMINDER', async () => {
    const deps = makeDeps();

    await handleBridgeRequest({
      requestId: 'req-reminder',
      action: 'observation.reminder.schedule',
      payload: { reminderId: '', fireAt: 'not-a-date' },
    }, deps);

    expect(deps.respondError).toHaveBeenCalledWith(
      'req-reminder',
      expect.objectContaining({ code: 'INVALID_REMINDER' }),
    );
    expect(deps.syncReminderTimer).not.toHaveBeenCalled();
  });

  it('share.payload 调用 Share.share 并返回成功', async () => {
    const deps = makeDeps();

    await handleBridgeRequest({
      requestId: 'req-share',
      action: 'share.payload',
      payload: { title: '分享标题', message: '分享正文' },
    }, deps);

    expect(Share.share).toHaveBeenCalledWith({
      title: '分享标题',
      message: '分享正文',
    });
    expect(deps.respondSuccess).toHaveBeenCalledWith('req-share', { accepted: true });
    expect(deps.respondError).not.toHaveBeenCalled();
  });

  it('location.getCurrentPosition 先尝试低精度定位并返回坐标', async () => {
    const deps = makeDeps();
    const position = { coords: { latitude: 30.25, longitude: 120.15 } };
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementationOnce((success) => success(position));

    await handleBridgeRequest({
      requestId: 'req-location',
      action: 'location.getCurrentPosition',
      payload: { timeout: 30000, maximumAge: 600000 },
    }, deps);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: false, timeout: 8000 }),
    );
    expect(deps.respondSuccess).toHaveBeenCalledWith('req-location', {
      coords: position.coords,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    expect(deps.respondError).not.toHaveBeenCalled();
  });

  it('location.getCurrentPosition 多次超时后返回可恢复错误', async () => {
    const deps = makeDeps();
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error) => error(new Error('Timeout expired')));

    await handleBridgeRequest({
      requestId: 'req-location-timeout',
      action: 'location.getCurrentPosition',
      payload: { timeout: 20000 },
    }, deps);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(3);
    expect(deps.respondError).toHaveBeenCalledWith(
      'req-location-timeout',
      expect.objectContaining({ code: 'LOCATION_TIMEOUT', recoverable: true }),
    );
    expect(deps.respondSuccess).not.toHaveBeenCalled();
  });

  it('map.openWaypointNavigation 复用外部地图打开逻辑', async () => {
    const deps = makeDeps();

    await handleBridgeRequest({
      requestId: 'req-waypoint-nav',
      action: 'map.openWaypointNavigation',
      payload: { name: '牛背山', lat: 29.8039, lng: 102.4449 },
    }, deps);

    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('29.8039%2C102.4449'));
    expect(deps.respondSuccess).toHaveBeenCalledWith('req-waypoint-nav', { opened: true });
    expect(deps.respondError).not.toHaveBeenCalled();
  });
});
