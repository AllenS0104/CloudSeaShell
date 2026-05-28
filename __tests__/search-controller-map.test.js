const { createSearchController } = require('../miniprogram/pages/index/controllers/search-controller');

describe('miniprogram search-controller 地图点选 + 反向地名解析', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  let state;
  let setStateFn;
  let api;
  let fetchAllFn;
  let controller;

  beforeEach(() => {
    state = { lat: 0, lon: 0, locationName: '' };
    setStateFn = jest.fn((patch) => { state = { ...state, ...patch }; });
    api = {
      reverseGeocode: jest.fn(),
      geocodeAddress: jest.fn(),
      getLocation: jest.fn(),
    };
    fetchAllFn = jest.fn();
    controller = createSearchController({
      getState: () => state,
      setState: setStateFn,
      services: {
        api,
        searchHistory: { addSearchHistory: jest.fn(), getSearchHistory: jest.fn(() => []) },
        fetchAll: fetchAllFn,
      },
    });
    global.wx = {
      showToast: jest.fn(),
      showActionSheet: jest.fn(),
    };
  });

  afterEach(() => {
    delete global.wx;
  });

  test('handleMapTap 设置坐标格式并触发 fetchAll', () => {
    api.reverseGeocode.mockResolvedValue({ display: '海淀区 北京市', primary: '海淀区', parts: ['海淀区', '北京市'] });
    controller.handleMapTap({ detail: { latitude: 39.9042, longitude: 116.4074 } });

    expect(setStateFn).toHaveBeenCalledWith(expect.objectContaining({
      lat: 39.9042,
      lon: 116.4074,
      locationName: '坐标 39.9042, 116.4074',
      locationPlace: null,
    }));
    expect(fetchAllFn).toHaveBeenCalledWith(39.9042, 116.4074);
  });

  test('enrichLocationName 在解析成功后追加地名', async () => {
    state = { lat: 39.9042, lon: 116.4074, locationName: '坐标 39.9042, 116.4074' };
    api.reverseGeocode.mockResolvedValue({ display: '海淀区 北京市', primary: '海淀区', parts: ['海淀区', '北京市'] });

    await controller.enrichLocationName(39.9042, 116.4074);

    expect(api.reverseGeocode).toHaveBeenCalledWith(39.9042, 116.4074);
    const lastPatch = setStateFn.mock.calls[setStateFn.mock.calls.length - 1][0];
    expect(lastPatch.locationName).toBe('坐标 39.9042, 116.4074 (海淀区 北京市)');
    expect(lastPatch.locationPlace).toEqual(expect.objectContaining({ primary: '海淀区' }));
  });

  test('enrichLocationName 在用户已切换位置时不写回', async () => {
    state = { lat: 39.9042, lon: 116.4074, locationName: '坐标 39.9042, 116.4074' };
    api.reverseGeocode.mockResolvedValue({ display: '海淀区 北京市', primary: '海淀区', parts: ['海淀区'] });
    const promise = controller.enrichLocationName(39.9042, 116.4074);
    state = { lat: 30, lon: 120, locationName: '别的地方' };
    await promise;
    const nameWrites = setStateFn.mock.calls.filter((c) => c[0].locationName != null);
    expect(nameWrites).toHaveLength(0);
  });

  test('enrichLocationName 在反向地名为空时安静返回', async () => {
    state = { lat: 39.9, lon: 116.4, locationName: '坐标 39.9000, 116.4000' };
    api.reverseGeocode.mockResolvedValue(null);
    await controller.enrichLocationName(39.9, 116.4);
    const nameWrites = setStateFn.mock.calls.filter((c) => c[0].locationName != null);
    expect(nameWrites).toHaveLength(0);
  });

  test('handleLocate 成功后会触发 reverseGeocode', async () => {
    api.getLocation.mockResolvedValue({ latitude: 31.23, longitude: 121.47 });
    api.reverseGeocode.mockResolvedValue({ display: '黄浦区 上海市', primary: '黄浦区', parts: ['黄浦区'] });
    await controller.handleLocate();
    await flush();
    expect(api.reverseGeocode).toHaveBeenCalledWith(31.23, 121.47);
  });
});
