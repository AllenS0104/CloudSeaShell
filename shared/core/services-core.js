/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSeaCore = root.CloudSeaCore || {};
    root.CloudSeaCore.createServices = api.createServices;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const WEATHER_ENDPOINTS = [
    'https://api.open-meteo.com',
    'https://ensemble-api.open-meteo.com',
  ];

  const CACHE_KEY_PREFIX = 'cloudsea_cache_';
  const WEATHER_CACHE_TTL = 10 * 60 * 1000;
  const LAST_GOOD_KEY = 'cloudsea_last_good_weather';
  const noopStorage = { get() { return null; }, set() {}, remove() {}, keys() { return []; } };
  const noopHttp = {
    request() { return Promise.reject(new Error('HTTP port is not configured')); },
  };

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function createServices(options) {
    const http = (options && options.http) || noopHttp;
    const storage = (options && options.storage) || noopStorage;
    const locationProvider = options && options.getLocation;

    async function requestJson(url, options) {
      const opts = options || {};
      const timeoutMs = opts.timeoutMs || opts.timeout || 8000;
      const retries = opts.retries != null ? opts.retries : 1;
      const method = opts.method || 'GET';
      const data = opts.data;
      const header = opts.header;

      async function attempt(retriesLeft) {
        try {
          const res = await http.request({ url, method, data, header, timeout: timeoutMs });
          const statusCode = res && res.statusCode;
          if (statusCode >= 200 && statusCode < 300) return res.data;
          if (statusCode >= 500 && retriesLeft > 0) {
            console.warn(`服务器错误 ${statusCode}，重试中... (${retriesLeft})`, url);
            await delay(1000);
            return attempt(retriesLeft - 1);
          }
          throw new Error(`HTTP ${statusCode}`);
        } catch (err) {
          if (retriesLeft > 0) {
            console.warn(`请求失败，重试中... (${retriesLeft})`, url);
            await delay(1000);
            return attempt(retriesLeft - 1);
          }
          throw err;
        }
      }

      return attempt(retries);
    }

    function getCachedData(key) {
      try {
        const raw = storage.get(CACHE_KEY_PREFIX + key);
        if (raw && raw.expireAt > Date.now()) {
          return raw.data;
        }
      } catch (e) { /* ignore */ }
      return null;
    }

    function setCachedData(key, data, ttl) {
      try {
        storage.set(CACHE_KEY_PREFIX + key, {
          data,
          expireAt: Date.now() + ttl,
        });
      } catch (e) { /* ignore */ }
    }

    function saveLastGoodWeather(lat, lon, data) {
      try {
        storage.set(LAST_GOOD_KEY, {
          lat: Number(lat.toFixed(2)),
          lon: Number(lon.toFixed(2)),
          data,
          savedAt: Date.now(),
        });
      } catch (e) { /* ignore */ }
    }

    function getLastGoodWeather(lat, lon) {
      try {
        const saved = storage.get(LAST_GOOD_KEY);
        if (saved && saved.data &&
            Math.abs(saved.lat - Number(lat.toFixed(2))) < 0.1 &&
            Math.abs(saved.lon - Number(lon.toFixed(2))) < 0.1) {
          return { data: saved.data, savedAt: saved.savedAt };
        }
      } catch (e) { /* ignore */ }
      return null;
    }

    async function fetchWeather(lat, lon) {
      const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return { data: cached, sourceIndex: -1, fromCache: true };
      }

      let lastError = null;

      for (let i = 0; i < WEATHER_ENDPOINTS.length; i++) {
        try {
          const params = [
            `latitude=${lat}`,
            `longitude=${lon}`,
            'current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,precipitation,weather_code,is_day',
            'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,visibility,precipitation_probability,wind_speed_10m,weather_code,cape,is_day',
            'daily=sunrise,sunset',
            'timezone=Asia/Shanghai',
            'model=icon_seamless,gfs_seamless',
          ].join('&');

          const data = await requestJson(`${WEATHER_ENDPOINTS[i]}/v1/forecast?${params}`, {
            timeoutMs: 15000,
            retries: 1,
          });

          if (!data?.hourly?.time?.length) {
            throw new Error('天气数据格式无效');
          }

          setCachedData(cacheKey, data, WEATHER_CACHE_TTL);
          saveLastGoodWeather(lat, lon, data);
          return { data, sourceIndex: i, fromCache: false };
        } catch (err) {
          lastError = err;
        }
      }

      const lastGood = getLastGoodWeather(lat, lon);
      if (lastGood) {
        const ageMinutes = Math.round((Date.now() - lastGood.savedAt) / 60000);
        console.warn(`使用离线缓存数据（${ageMinutes} 分钟前）`);
        return { data: lastGood.data, sourceIndex: -1, fromCache: true, offlineAge: ageMinutes };
      }

      throw new Error(`天气数据请求失败：${lastError?.message || '网络超时，请稍后重试'}`);
    }

    async function fetchElevation(lat, lon) {
      const cacheKey = `elev_${lat.toFixed(2)}_${lon.toFixed(2)}`;
      const cached = getCachedData(cacheKey);
      if (cached !== null) return cached;

      try {
        const data = await requestJson(
          `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
          { timeoutMs: 6000, retries: 1 }
        );
        const value = data?.elevation?.[0] ?? data?.elevation;
        if (typeof value === 'number' && isFinite(value)) {
          setCachedData(cacheKey, value, 24 * 60 * 60 * 1000);
          return value;
        }
      } catch (err) {
        console.warn('海拔获取失败，使用默认值', err.message);
      }

      return 300;
    }

    async function geocodeAddress(address) {
      const raw = address.trim();
      if (!raw) throw new Error('请输入地名');

      const contextPatterns = [
        { re: /北京/, ctx: '北京' }, { re: /上海/, ctx: '上海' }, { re: /天津/, ctx: '天津' },
        { re: /重庆/, ctx: '重庆' }, { re: /广东|广州|深圳/, ctx: '广东' }, { re: /浙江|杭州/, ctx: '浙江' },
        { re: /江苏|南京|苏州/, ctx: '江苏' }, { re: /四川|成都/, ctx: '四川' }, { re: /云南|昆明/, ctx: '云南' },
        { re: /安徽|合肥/, ctx: '安徽' }, { re: /湖北|武汉/, ctx: '湖北' }, { re: /湖南|长沙/, ctx: '湖南' },
        { re: /山东|济南|青岛/, ctx: '山东' }, { re: /河南|郑州/, ctx: '河南' }, { re: /福建|福州|厦门/, ctx: '福建' },
        { re: /江西|南昌/, ctx: '江西' }, { re: /贵州|贵阳/, ctx: '贵州' }, { re: /陕西|西安/, ctx: '陕西' },
        { re: /山西|太原/, ctx: '山西' }, { re: /河北|石家庄/, ctx: '河北' }, { re: /吉林|长春/, ctx: '吉林' },
        { re: /辽宁|沈阳|大连/, ctx: '辽宁' }, { re: /黑龙江|哈尔滨/, ctx: '黑龙江' },
        { re: /海南|海口/, ctx: '海南' }, { re: /广西|南宁|桂林/, ctx: '广西' },
        { re: /甘肃|兰州/, ctx: '甘肃' }, { re: /青海|西宁/, ctx: '青海' },
        { re: /西藏|拉萨/, ctx: '西藏' }, { re: /新疆|乌鲁木齐/, ctx: '新疆' },
        { re: /内蒙古|呼和浩特/, ctx: '内蒙古' }, { re: /宁夏|银川/, ctx: '宁夏' },
        { re: /台湾|台北/, ctx: '台湾' }, { re: /香港/, ctx: '香港' }, { re: /澳门/, ctx: '澳门' },
      ];

      let contextHint = '';
      for (const p of contextPatterns) {
        if (p.re.test(raw)) { contextHint = p.ctx; break; }
      }

      const withSplits = raw
        .replace(/(省|自治区|自治州|市|区|县|镇|乡|村|街道|风景区|景区|国家公园)/g, '$1|')
        .split('|')
        .map(s => s.trim())
        .filter(s => s.length >= 2);

      const candidates = [];
      candidates.push(raw);
      for (let i = withSplits.length - 1; i >= 0; i--) {
        if (!candidates.includes(withSplits[i])) candidates.push(withSplits[i]);
      }
      for (const n of [3, 4, 2, 5]) {
        if (n < raw.length) {
          const tail = raw.slice(-n);
          if (!candidates.includes(tail)) candidates.push(tail);
        }
      }

      // L3 fallback: when input includes a province/city context like 北京 房山 他窖村,
      // ensure the broader context is also tried (so we degrade to 房山 / 北京 instead of empty).
      if (contextHint && !candidates.includes(contextHint)) {
        candidates.push(contextHint);
      }

      let allResults = [];
      let networkErrors = 0;
      let totalAttempts = 0;

      for (const term of candidates) {
        totalAttempts++;
        try {
          const data = await requestJson(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=zh&format=json`,
            // L2: longer timeout (10s vs 6s) and one retry on the most specific candidate
            // to better tolerate slow 5G / no-VPN networks in mainland China.
            { timeoutMs: 10000, retries: term === raw ? 1 : 0 }
          );
          const results = data?.results;
          if (Array.isArray(results) && results.length > 0) {
            for (const item of results) {
              allResults.push({
                latitude: item.latitude,
                longitude: item.longitude,
                name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
                admin1: item.admin1 || '',
                elevation: item.elevation,
                matchedTerm: term,
              });
            }
            break;
          }
        } catch (err) {
          // L1: count network/timeout failures separately from valid empty responses
          // so we can show a network-specific error if every attempt threw.
          networkErrors++;
        }
      }

      if (allResults.length === 0) {
        // L1: if every API call failed with an exception, treat as a network problem.
        if (totalAttempts > 0 && networkErrors === totalAttempts) {
          throw new Error('地址查询网络异常，请检查网络（或切换 Wi-Fi）后重试');
        }

        // L3: fall back to the bundled waypoints dataset for queries that
        // Open-Meteo (GeoNames) cannot resolve (typically village-level names).
        const waypointMatches = matchBuiltinWaypoints(raw);
        if (waypointMatches.length > 0) {
          allResults = waypointMatches;
        } else {
          throw new Error(`未找到 "${raw}"，建议改用所在乡镇 / 区县 / 景区名（Open-Meteo 数据库不含村级地名）`);
        }
      }

      if (contextHint) {
        allResults.sort((a, b) => {
          const aMatch = a.admin1.includes(contextHint) || a.name.includes(contextHint) ? 1 : 0;
          const bMatch = b.admin1.includes(contextHint) || b.name.includes(contextHint) ? 1 : 0;
          return bMatch - aMatch;
        });
      }

      const seen = new Set();
      allResults = allResults.filter(r => {
        if (seen.has(r.name)) return false;
        seen.add(r.name);
        return true;
      });

      return allResults.slice(0, 8);
    }

    // L3 helper: fuzzy-match the raw query against the bundled waypoints dataset.
    // Reachable in CommonJS (miniprogram, node) and via UMD globals (web build).
    function matchBuiltinWaypoints(raw) {
      let all = [];
      try {
        if (typeof require === 'function') {
          try {
            const mod = require('./waypoints-data');
            if (mod && Array.isArray(mod.WAYPOINTS)) all = mod.WAYPOINTS;
          } catch (e) { /* fallthrough to globals */ }
        }
        if (all.length === 0 && typeof globalThis !== 'undefined') {
          const g = globalThis;
          if (g.CloudSeaCore && g.CloudSeaCore.waypoints && Array.isArray(g.CloudSeaCore.waypoints.WAYPOINTS)) {
            all = g.CloudSeaCore.waypoints.WAYPOINTS;
          } else if (g.CloudSea && g.CloudSea.waypoints && Array.isArray(g.CloudSea.waypoints.WAYPOINTS)) {
            all = g.CloudSea.waypoints.WAYPOINTS;
          }
        }
      } catch (e) {
        return [];
      }

      if (!Array.isArray(all) || all.length === 0) return [];

      const tokens = raw
        .replace(/[\s,，、]+/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);

      const matches = [];
      for (const wp of all) {
        if (!wp || !wp.name) continue;
        if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng)) continue;
        const hit = raw.includes(wp.name)
          || wp.name.includes(raw)
          || tokens.some(t => wp.name.includes(t));
        if (hit) {
          matches.push({
            latitude: wp.lat,
            longitude: wp.lng,
            name: `${wp.name}（内置参考机位）`,
            admin1: '',
            elevation: typeof wp.elevation === 'number' ? wp.elevation : null,
            matchedTerm: 'waypoint:' + (wp.id || wp.name),
          });
        }
      }
      return matches;
    }

    function getLocation() {
      if (typeof locationProvider === 'function') return locationProvider();
      return Promise.reject(new Error('定位端口未配置'));
    }

    return {
      fetchWeather,
      fetchElevation,
      geocodeAddress,
      getLocation,
      _requestJson: requestJson,
    };
  }

  return {
    createServices,
    constants: { WEATHER_ENDPOINTS, CACHE_KEY_PREFIX, WEATHER_CACHE_TTL, LAST_GOOD_KEY },
  };
});
