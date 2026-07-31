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
    const http = { request: jest.fn(({ url }) => {
      if (url.includes('geocoding-api.open-meteo.com') && decodeURIComponent(url).includes('西湖区')) {
        return Promise.resolve({ statusCode: 200, data: { results: [
          { latitude: 1, longitude: 2, name: '西湖', admin1: '江西', country: '中国' },
          { latitude: 3, longitude: 4, name: '西湖', admin1: '浙江', country: '中国', elevation: 10 },
          { latitude: 5, longitude: 6, name: '西湖区', admin1: '浙江', country: '中国' },
        ] } });
      }
      return Promise.resolve({ statusCode: 200, data: url.includes('photon') ? { features: [] } : { results: [] } });
    }) };
    const services = createServices({ http });
    await expect(services.geocodeAddress('   ')).rejects.toThrow('请输入地名');
    const results = await services.geocodeAddress('浙江省杭州市西湖区');
    expect(results[0].admin1).toContain('浙江');
    expect(new Set(results.map(r => r.name)).size).toBe(results.length);
    await expect(createServices({ http: { request: jest.fn().mockResolvedValue({ statusCode: 200, data: { results: [] } }) } }).geocodeAddress('不存在地点')).rejects.toThrow('未找到');
  });

  test('geocodeAddress 支持坐标输入并优先返回细粒度地名', async () => {
    const coordinate = await createServices({}).geocodeAddress('北纬30.12345 东经120.54321');
    expect(coordinate[0]).toMatchObject({ latitude: 30.12345, longitude: 120.54321, source: 'coordinates' });

    const http = { request: jest.fn(({ url }) => {
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve({ statusCode: 200, data: { results: [
          { latitude: 39.75, longitude: 115.95, name: '房山区', admin1: '北京', country: '中国' },
        ] } });
      }
      if (url.includes('nominatim.openstreetmap.org')) {
        return Promise.resolve({ statusCode: 200, data: [
          {
            lat: '39.8123',
            lon: '115.7234',
            name: '他窖村',
            display_name: '他窖村, 蒲洼乡, 房山区, 北京市, 中国',
            class: 'place',
            type: 'village',
            address: { village: '他窖村', town: '蒲洼乡', county: '房山区', state: '北京市', country: '中国' },
          },
        ] });
      }
      return Promise.resolve({ statusCode: 200, data: { features: [] } });
    }) };
    const results = await createServices({ http }).geocodeAddress('北京房山他窖村');
    expect(results[0]).toMatchObject({ primaryName: '他窖村', latitude: 39.8123, longitude: 115.7234 });
  });

  test('reverseGeocode 在所有线上源失败时回退到最近机位', async () => {
    const http = { request: jest.fn().mockRejectedValue(new Error('network down')) };
    const services = createServices({ http });
    // 牛背山位置约 (29.8039, 102.4449)，构造一个 ~12km 偏移的点
    const place = await services.reverseGeocode(29.9, 102.45);
    expect(place).toBeTruthy();
    expect(place.source).toBe('waypoint-nearest');
    expect(place.display).toMatch(/牛背山/);
    expect(place.distanceKm).toBeGreaterThan(0);
    expect(place.distanceKm).toBeLessThan(20);
  });

  test('reverseGeocode 在精确命中机位时直接返回名称', async () => {
    const http = { request: jest.fn().mockRejectedValue(new Error('network down')) };
    const services = createServices({ http });
    const place = await services.reverseGeocode(29.8039, 102.4449);
    expect(place.display).toBe('牛背山');
    expect(place.source).toBe('waypoint-nearest');
  });

  test('reverseGeocode 在线上源成功时优先返回线上结果', async () => {
    const http = { request: jest.fn(({ url }) => {
      if (url.includes('bigdatacloud.net')) {
        return Promise.resolve({ statusCode: 200, data: { locality: '海淀区', city: '北京市', countryName: '中国' } });
      }
      return Promise.resolve({ statusCode: 200, data: {} });
    }) };
    const services = createServices({ http });
    const place = await services.reverseGeocode(39.9, 116.4);
    expect(place.source).toBe('bigdatacloud');
    expect(place.display).toMatch(/海淀区/);
  });

  test('reverseGeocode 在所有源均无结果时返回 null', async () => {
    const http = { request: jest.fn().mockRejectedValue(new Error('network down')) };
    const services = createServices({ http });
    // 太平洋中部，距离任何机位都很远
    const place = await services.reverseGeocode(0, -150);
    expect(place).toBeNull();
  });

  test('reverseGeocode 偏好街道/村镇级别而非行政区粗结果', async () => {
    // 同时返回 BigDataCloud (区级粗) 和 Photon (村级细)，应优先选 Photon。
    const http = { request: jest.fn(({ url }) => {
      if (url.includes('bigdatacloud.net')) {
        return Promise.resolve({ statusCode: 200, data: { locality: '', city: '大兴区', principalSubdivision: '北京市', countryName: '中国' } });
      }
      if (url.includes('photon.komoot.io')) {
        return Promise.resolve({ statusCode: 200, data: { features: [{ properties: { name: '黄村镇', suburb: '兴政街', city: '大兴区', state: '北京市', country: '中国' } }] } });
      }
      return Promise.resolve({ statusCode: 200, data: {} });
    }) };
    const place = await createServices({ http }).reverseGeocode(39.7745, 116.2518);
    expect(place.source).toBe('photon');
    expect(place.display).toMatch(/黄村镇/);
  });

  test('reverseGeocode 在 5km 内有机位时把机位名追加到行政区结果', async () => {
    const http = { request: jest.fn(({ url }) => {
      if (url.includes('bigdatacloud.net')) {
        return Promise.resolve({ statusCode: 200, data: { locality: '', city: '雅安市', principalSubdivision: '四川省', countryName: '中国' } });
      }
      return Promise.resolve({ statusCode: 200, data: {} });
    }) };
    // 距离牛背山 (29.8039, 102.4449) 约 2km
    const place = await createServices({ http }).reverseGeocode(29.82, 102.445);
    expect(place.display).toMatch(/雅安市/);
    expect(place.display).toMatch(/牛背山/);
    expect(place.nearestWaypoint).toBeTruthy();
  });

  test('getLocation 使用注入端口，缺失时抛出配置错误', async () => {
    await expect(createServices({ getLocation: () => Promise.resolve({ lat: 1 }) }).getLocation()).resolves.toEqual({ lat: 1 });
    await expect(createServices({}).getLocation()).rejects.toThrow('定位端口未配置');
  });
});
