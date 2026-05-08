describe('miniprogram onSearch', () => {
  let pageConfig;
  let services;
  let searchHistory;

  const loadPage = () => {
    jest.resetModules();
    pageConfig = null;
    services = {
      geocodeAddress: jest.fn(),
    };
    searchHistory = {
      addSearchHistory: jest.fn(),
      getSearchHistory: jest.fn(() => []),
    };

    global.Page = jest.fn((cfg) => {
      pageConfig = cfg;
      return cfg;
    });
    global.wx = {
      showToast: jest.fn(),
      showActionSheet: jest.fn(),
    };

    jest.doMock('../miniprogram/utils/services', () => services);
    jest.doMock('../miniprogram/utils/search-history', () => searchHistory);
    jest.doMock('../miniprogram/utils/favorites', () => ({
      getFavorites: jest.fn(() => []),
      isFavorite: jest.fn(() => false),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
    }));
    jest.doMock('../miniprogram/utils/calculations', () => ({}));
    jest.doMock('../miniprogram/utils/fusion', () => ({}));
    jest.doMock('../miniprogram/utils/analyzer', () => ({}));
    jest.doMock('../miniprogram/utils/feedback', () => ({}));

    require('../miniprogram/pages/index/index.js');
    return pageConfig;
  };

  const makeContext = (searchText = '北京') => {
    const ctx = {
      data: { searchText },
      setData: jest.fn((patch) => {
        ctx.data = { ...ctx.data, ...patch };
      }),
      fetchAll: jest.fn(async () => {
        ctx.setData({ loading: false });
      }),
    };
    return ctx;
  };

  afterEach(() => {
    delete global.Page;
    delete global.wx;
    jest.dontMock('../miniprogram/utils/services');
    jest.dontMock('../miniprogram/utils/search-history');
    jest.dontMock('../miniprogram/utils/favorites');
    jest.dontMock('../miniprogram/utils/calculations');
    jest.dontMock('../miniprogram/utils/fusion');
    jest.dontMock('../miniprogram/utils/analyzer');
    jest.dontMock('../miniprogram/utils/feedback');
  });

  it('0 结果时提示未找到并复位 loading', async () => {
    const page = loadPage();
    services.geocodeAddress.mockResolvedValue([]);
    const ctx = makeContext();

    await page.onSearch.call(ctx);

    expect(global.wx.showToast).toHaveBeenCalledWith({ title: '未找到匹配地点', icon: 'none' });
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.statusText).toContain('未找到');
    expect(ctx.data.statusType).toBe('warning');
  });

  it('1 结果时直接选中并拉取数据', async () => {
    const page = loadPage();
    const result = { name: '成都', latitude: 30.67, longitude: 104.06 };
    services.geocodeAddress.mockResolvedValue([result]);
    const ctx = makeContext('成都');

    await page.onSearch.call(ctx);

    expect(ctx.data.lat).toBe(result.latitude);
    expect(ctx.data.lon).toBe(result.longitude);
    expect(ctx.data.locationName).toBe(result.name);
    expect(searchHistory.addSearchHistory).toHaveBeenCalledWith({
      name: result.name,
      lat: result.latitude,
      lon: result.longitude,
    });
    expect(ctx.fetchAll).toHaveBeenCalledWith(result.latitude, result.longitude);
  });

  it('7 结果时 ActionSheet 只展示前 6 个，并按 visibleResults 的 tapIndex 选中', async () => {
    const page = loadPage();
    const results = Array.from({ length: 7 }, (_, index) => ({
      name: `地点${index + 1}`,
      latitude: index + 10,
      longitude: index + 100,
    }));
    services.geocodeAddress.mockResolvedValue(results);
    global.wx.showActionSheet.mockImplementation(({ success }) => success({ tapIndex: 5 }));
    const ctx = makeContext('地点');

    await page.onSearch.call(ctx);

    expect(global.wx.showActionSheet).toHaveBeenCalledWith(expect.objectContaining({
      itemList: results.slice(0, 6).map((item) => item.name),
    }));
    expect(ctx.data.locationName).toBe(results[5].name);
    expect(ctx.data.lat).toBe(results[5].latitude);
    expect(ctx.data.lon).toBe(results[5].longitude);
    expect(ctx.fetchAll).toHaveBeenCalledWith(results[5].latitude, results[5].longitude);
  });

  it('服务报错时写入 loadError 并复位 loading', async () => {
    const page = loadPage();
    services.geocodeAddress.mockRejectedValue(new Error('network down'));
    const ctx = makeContext();

    await page.onSearch.call(ctx);

    expect(ctx.data.loadError).toBe(true);
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.statusText).toContain('network down');
    expect(ctx.data.statusType).toBe('warning');
  });
});
