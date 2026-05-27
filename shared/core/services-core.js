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

    function getContextHint(raw) {
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

      for (const p of contextPatterns) {
        if (p.re.test(raw)) return p.ctx;
      }
      return '';
    }

    function normalizePlaceText(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[（(].*?[）)]/g, '')
        .replace(/[\s,，、;；:：|·\-_/\\]+/g, '')
        .trim();
    }

    function stripAdminSuffix(value) {
      return normalizePlaceText(value)
        .replace(/(特别行政区|自治区|自治州|自治县|地区|省|市|区|县|镇|乡|村|街道|社区|风景名胜区|风景区|景区|国家公园|森林公园|公园)$/g, '');
    }

    function uniqueParts(parts) {
      const seen = new Set();
      const out = [];
      for (const part of parts) {
        const text = String(part || '').trim();
        const key = normalizePlaceText(text);
        if (!text || seen.has(key)) continue;
        seen.add(key);
        out.push(text);
      }
      return out;
    }

    function parseCoordinateInput(raw) {
      const text = raw
        .replace(/[，,;；]/g, ' ')
        .replace(/[°'"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const numbers = text.match(/-?\d+(?:\.\d+)?/g);
      if (!numbers || numbers.length < 2) return null;

      let first = Number(numbers[0]);
      let second = Number(numbers[1]);
      if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

      const hasLonFirst = /(?:东经|经度|lng|lon|longitude)/i.test(text.split(numbers[0])[0] || '')
        || (Math.abs(first) > 90 && Math.abs(second) <= 90);
      const lat = hasLonFirst ? second : first;
      const lon = hasLonFirst ? first : second;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

      return {
        latitude: lat,
        longitude: lon,
        name: `坐标 ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        admin1: '',
        elevation: null,
        matchedTerm: 'coordinates',
        score: 200,
        source: 'coordinates',
      };
    }

    function buildGeocodeCandidates(raw, contextHint) {
      const cleaned = raw
        .replace(/[（(].*?[）)]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const suffixPattern = /(特别行政区|自治区|自治州|自治县|地区|省|市|区|县|旗|镇|乡|村|街道|社区|风景名胜区|风景区|景区|国家公园|森林公园|湿地公园|公园|保护区|观景台|平台|垭口|山口|山|峰|岭|湖|水库|沟|谷|岛|寺|庙)/g;
      const pieces = cleaned
        .replace(suffixPattern, '$1|')
        .split(/[|,，、;；\s]+/)
        .map(s => s.trim())
        .filter(s => s.length >= 2);

      const candidates = [];
      function add(term) {
        const value = String(term || '').trim();
        if (value.length >= 2 && !candidates.includes(value)) candidates.push(value);
      }

      add(cleaned);
      for (let i = pieces.length - 1; i >= 0; i--) {
        add(pieces.slice(i).join(''));
        add(pieces[i]);
      }
      for (const n of [8, 7, 6, 5, 4, 3, 2]) {
        if (n < cleaned.length) add(cleaned.slice(-n));
      }
      if (contextHint) add(contextHint);
      return candidates.slice(0, 12);
    }

    function scoreGeocodeResult(result, raw, contextHint) {
      const query = normalizePlaceText(raw);
      const queryLoose = stripAdminSuffix(raw);
      const name = normalizePlaceText(result.name);
      const primary = normalizePlaceText(result.primaryName || result.name);
      const primaryLoose = stripAdminSuffix(result.primaryName || result.name);
      let score = 0;

      if (primary === query || primaryLoose === queryLoose) score += 120;
      else if (name.includes(query) || query.includes(primary)) score += 80;
      else if (primaryLoose && (queryLoose.includes(primaryLoose) || primaryLoose.includes(queryLoose))) score += 60;

      const tokens = buildGeocodeCandidates(raw, '').map(normalizePlaceText).filter(t => t.length >= 2);
      for (const token of tokens) {
        if (name.includes(token)) score += Math.min(16, token.length * 3);
      }
      if (result.matchedTerm && normalizePlaceText(result.matchedTerm) === query) score += 24;
      if (contextHint && (String(result.admin1 || '').includes(contextHint) || result.name.includes(contextHint))) score += 25;
      if (/中国|China/i.test(result.country || result.name)) score += 8;
      if (/village|hamlet|suburb|attraction|viewpoint|peak|mountain|tourism|村|景区|观景台|山|峰/i.test(result.kind || result.name)) score += 10;
      if (result.source === 'waypoint') score += 18;
      if (result.source === 'nominatim' || result.source === 'photon') score += 8;
      return score;
    }

    function mapOpenMeteoResults(results, term) {
      if (!Array.isArray(results)) return [];
      return results.map(item => {
        const parts = uniqueParts([item.name, item.admin4, item.admin3, item.admin2, item.admin1, item.country]);
        return {
          latitude: item.latitude,
          longitude: item.longitude,
          name: parts.join(', '),
          primaryName: item.name || '',
          admin1: item.admin1 || '',
          country: item.country || '',
          elevation: item.elevation,
          matchedTerm: term,
          source: 'open-meteo',
          kind: item.feature_code || '',
        };
      });
    }

    function mapNominatimResults(results, term) {
      if (!Array.isArray(results)) return [];
      return results.map(item => {
        const address = item.address || {};
        const primary = item.name || address.village || address.hamlet || address.town || address.suburb
          || address.tourism || address.attraction || address.peak || address.natural || address.road
          || String(item.display_name || '').split(',')[0];
        const parts = uniqueParts([
          primary,
          address.village || address.hamlet || address.town || address.suburb,
          address.county || address.city || address.municipality,
          address.state || address.province,
          address.country,
        ]);
        return {
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          name: parts.join(', ') || item.display_name || primary,
          primaryName: primary || '',
          admin1: address.state || address.province || '',
          country: address.country || '',
          elevation: null,
          matchedTerm: term,
          source: 'nominatim',
          kind: [item.class, item.type].filter(Boolean).join(':'),
        };
      });
    }

    function mapPhotonResults(data, term) {
      const features = data && Array.isArray(data.features) ? data.features : [];
      return features.map(feature => {
        const props = feature.properties || {};
        const coords = feature.geometry && feature.geometry.coordinates;
        const parts = uniqueParts([props.name, props.city, props.county, props.state, props.country]);
        return {
          latitude: Array.isArray(coords) ? Number(coords[1]) : NaN,
          longitude: Array.isArray(coords) ? Number(coords[0]) : NaN,
          name: parts.join(', '),
          primaryName: props.name || '',
          admin1: props.state || '',
          country: props.country || '',
          elevation: null,
          matchedTerm: term,
          source: 'photon',
          kind: [props.osm_key, props.osm_value].filter(Boolean).join(':'),
        };
      });
    }

    async function geocodeAddress(address) {
      const raw = address.trim();
      if (!raw) throw new Error('请输入地名');

      const coordinate = parseCoordinateInput(raw);
      if (coordinate) return [coordinate];

      const contextHint = getContextHint(raw);
      const candidates = buildGeocodeCandidates(raw, contextHint);
      let allResults = matchBuiltinWaypoints(raw);
      let networkErrors = 0;
      let totalAttempts = 0;

      async function collect(url, mapper, options) {
        totalAttempts++;
        try {
          const data = await requestJson(url, options || { timeoutMs: 9000, retries: 0 });
          allResults = allResults.concat(mapper(data));
        } catch (err) {
          networkErrors++;
        }
      }

      const rawTerm = candidates[0];
      await collect(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawTerm)}&count=10&language=zh&format=json`,
        data => mapOpenMeteoResults(data?.results, rawTerm),
        { timeoutMs: 10000, retries: 1 }
      );
      await collect(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&accept-language=zh-CN&q=${encodeURIComponent(rawTerm)}`,
        data => mapNominatimResults(data, rawTerm),
        { timeoutMs: 9000, retries: 0, header: { Accept: 'application/json' } }
      );
      await collect(
        `https://photon.komoot.io/api/?limit=10&lang=zh&q=${encodeURIComponent(rawTerm)}`,
        data => mapPhotonResults(data, rawTerm),
        { timeoutMs: 9000, retries: 0 }
      );

      allResults = rankAndDedupeGeocodeResults(allResults, raw, contextHint);
      const topScore = allResults[0]?.score || 0;

      if (topScore < 95) {
        for (const term of candidates.slice(1, 8)) {
          await collect(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=zh&format=json`,
            data => mapOpenMeteoResults(data?.results, term),
            { timeoutMs: 8000, retries: 0 }
          );
        }
      }

      allResults = rankAndDedupeGeocodeResults(allResults, raw, contextHint);

      if ((allResults[0]?.score || 0) < 80) {
        for (const term of candidates.slice(1, 5)) {
          await collect(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&accept-language=zh-CN&q=${encodeURIComponent(term)}`,
            data => mapNominatimResults(data, term),
            { timeoutMs: 8000, retries: 0, header: { Accept: 'application/json' } }
          );
        }
      }

      allResults = rankAndDedupeGeocodeResults(allResults, raw, contextHint);

      if (allResults.length === 0) {
        if (totalAttempts > 0 && networkErrors === totalAttempts) {
          throw new Error('地址查询网络异常，请检查网络（或切换 Wi-Fi）后重试');
        }
        throw new Error(`未找到 "${raw}"，建议输入更完整的“省/市/区县 + 乡镇/景区/观景台”或直接输入坐标`);
      }

      return allResults.slice(0, 8);
    }

    function rankAndDedupeGeocodeResults(results, raw, contextHint) {
      const bestByKey = new Map();
      for (const item of results) {
        const lat = Number(item && item.latitude);
        const lon = Number(item && item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const normalized = Object.assign({}, item, { latitude: lat, longitude: lon });
        normalized.score = scoreGeocodeResult(normalized, raw, contextHint);
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        const prev = bestByKey.get(key);
        if (!prev || normalized.score > prev.score || normalized.name.length > prev.name.length) {
          bestByKey.set(key, normalized);
        }
      }
      return Array.from(bestByKey.values())
        .sort((a, b) => b.score - a.score || (b.name || '').length - (a.name || '').length);
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
            primaryName: wp.name,
            admin1: '',
            country: '中国',
            elevation: typeof wp.elevation === 'number' ? wp.elevation : null,
            matchedTerm: 'waypoint:' + (wp.id || wp.name),
            source: 'waypoint',
            kind: 'waypoint',
          });
        }
      }
      return matches;
    }

    function getLocation() {
      if (typeof locationProvider === 'function') return locationProvider();
      return Promise.reject(new Error('定位端口未配置'));
    }

    async function reverseGeocode(lat, lon) {
      const latitude = Number(lat);
      const longitude = Number(lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const cacheKey = `revgeo_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      const providers = [
        () => reverseGeocodeBigDataCloud(latitude, longitude),
        () => reverseGeocodeNominatim(latitude, longitude),
      ];

      for (const provider of providers) {
        try {
          const result = await provider();
          if (result && result.display) {
            setCachedData(cacheKey, result, 24 * 60 * 60 * 1000);
            return result;
          }
        } catch (err) {
          /* try next provider */
        }
      }
      return null;
    }

    async function reverseGeocodeBigDataCloud(latitude, longitude) {
      const data = await requestJson(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`,
        { timeoutMs: 8000, retries: 0 }
      );
      if (!data) return null;
      const parts = uniqueAddressParts([
        data.locality,
        data.city,
        data.principalSubdivision,
        data.countryName,
      ]);
      const display = parts.join(' ');
      if (!display) return null;
      return {
        display,
        primary: parts[0] || display,
        parts,
        country: data.countryName || '',
        source: 'bigdatacloud',
      };
    }

    async function reverseGeocodeNominatim(latitude, longitude) {
      const data = await requestJson(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&accept-language=zh-CN`,
        { timeoutMs: 8000, retries: 0, header: { Accept: 'application/json' } }
      );
      const address = (data && data.address) || {};
      const parts = uniqueAddressParts([
        address.village || address.hamlet || address.town || address.suburb || address.neighbourhood || address.locality,
        address.tourism || address.attraction || address.natural || address.peak,
        address.county || address.city_district || address.city || address.municipality,
        address.state || address.province,
      ]);
      const display = parts.join(' ');
      if (!display) return null;
      return {
        display,
        primary: parts[0] || display,
        parts,
        country: address.country || '',
        source: 'nominatim',
      };
    }

    function uniqueAddressParts(parts) {
      const seen = new Set();
      const out = [];
      for (const part of parts) {
        const text = String(part || '').trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
      }
      return out;
    }

    return {
      fetchWeather,
      fetchElevation,
      geocodeAddress,
      reverseGeocode,
      getLocation,
      _requestJson: requestJson,
    };
  }

  return {
    createServices,
    constants: { WEATHER_ENDPOINTS, CACHE_KEY_PREFIX, WEATHER_CACHE_TTL, LAST_GOOD_KEY },
  };
});
