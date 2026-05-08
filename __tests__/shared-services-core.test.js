const { createServices, constants } = require('../shared/core/services-core');

function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return { get: jest.fn((k) => data[k] ?? null), set: jest.fn((k, v) => { data[k] = v; }), remove: jest.fn((k) => { delete data[k]; }), keys: jest.fn(() => Object.keys(data)), data };
}

describe('服务核心端口适配', () => {
  test('requestJson 返回成功数据并对 4xx 抛错', async () => {
    const http = { request: jest.fn().mockResolvedValueOnce({ statusCode: 200, data: { ok: true } }).mockResolvedValueOnce({ statusCode: 404, data: {} }) };
    const services = createServices({ http });
    await expect(services._requestJson('https://x.test/a')).resolves.toEqual({ ok: true });
    await expect(services._requestJson('https://x.test/b', { retries: 0 })).rejects.toThrow('HTTP 404');
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', timeout: 8000 }));
  });

  test('fetchWeather 使用缓存、写入缓存并在主源无效时切到备用源', async () => {
    const validWeather = { hourly: { time: ['2026-05-01T00:00'] } };
    const storage = createMemoryStorage({ [constants.CACHE_KEY_PREFIX + 'weather_30.00_120.00']: { data: { cached: true }, expireAt: Date.now() + 10000 } });
    const cached = await createServices({ storage }).fetchWeather(30, 120);
    expect(cached).toMatchObject({ fromCache: true, sourceIndex: -1, data: { cached: true } });

    const storage2 = createMemoryStorage();
    const http = { request: jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, data: { hourly: { time: [] } } })
      .mockResolvedValueOnce({ statusCode: 200, data: validWeather }) };
    const fresh = await createServices({ http, storage: storage2 }).fetchWeather(30, 120);
    expect(fresh).toMatchObject({ fromCache: false, sourceIndex: 1, data: validWeather });
    expect(storage2.set).toHaveBeenCalledWith(constants.LAST_GOOD_KEY, expect.objectContaining({ lat: 30, lon: 120, data: validWeather }));
  });

  test('fetchWeather 全部失败时返回同城离线缓存，否则抛出最终错误', async () => {
    const savedAt = Date.now() - 120000;
    const storage = createMemoryStorage({ [constants.LAST_GOOD_KEY]: { lat: 30, lon: 120, data: { old: true }, savedAt } });
    const badHttp = { request: jest.fn().mockResolvedValue({ statusCode: 200, data: { hourly: { time: [] } } }) };
    const offline = await createServices({ http: badHttp, storage }).fetchWeather(30.04, 120.03);
    expect(offline).toMatchObject({ fromCache: true, offlineAge: 2, data: { old: true } });
    await expect(createServices({ http: badHttp, storage: createMemoryStorage() }).fetchWeather(30, 120)).rejects.toThrow('天气数据请求失败');
  });

  test('fetchElevation 缓存、解析和默认值分支', async () => {
    const cachedStorage = createMemoryStorage({ [constants.CACHE_KEY_PREFIX + 'elev_30.00_120.00']: { data: 888, expireAt: Date.now() + 1000 } });
    await expect(createServices({ storage: cachedStorage }).fetchElevation(30, 120)).resolves.toBe(888);
    const storage = createMemoryStorage();
    const http = { request: jest.fn().mockResolvedValueOnce({ statusCode: 200, data: { elevation: [1234] } }).mockResolvedValueOnce({ statusCode: 200, data: {} }) };
    const services = createServices({ http, storage });
    await expect(services.fetchElevation(30, 120)).resolves.toBe(1234);
    await expect(services.fetchElevation(31, 121)).resolves.toBe(300);
  });

  test('geocodeAddress 拆词、上下文排序、去重和空输入校验', async () => {
    const http = { request: jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, data: { results: [] } })
      .mockResolvedValueOnce({ statusCode: 200, data: { results: [
        { latitude: 1, longitude: 2, name: '西湖', admin1: '江西', country: '中国' },
        { latitude: 3, longitude: 4, name: '西湖', admin1: '浙江', country: '中国', elevation: 10 },
        { latitude: 5, longitude: 6, name: '西湖区', admin1: '浙江', country: '中国' },
      ] } }) };
    const services = createServices({ http });
    await expect(services.geocodeAddress('   ')).rejects.toThrow('请输入地名');
    const results = await services.geocodeAddress('浙江省杭州市西湖区');
    expect(results[0].admin1).toContain('浙江');
    expect(new Set(results.map(r => r.name)).size).toBe(results.length);
    await expect(createServices({ http: { request: jest.fn().mockResolvedValue({ statusCode: 200, data: { results: [] } }) } }).geocodeAddress('不存在地点')).rejects.toThrow('未找到');
  });

  test('getLocation 使用注入端口，缺失时抛出配置错误', async () => {
    await expect(createServices({ getLocation: () => Promise.resolve({ lat: 1 }) }).getLocation()).resolves.toEqual({ lat: 1 });
    await expect(createServices({}).getLocation()).rejects.toThrow('定位端口未配置');
  });
});
