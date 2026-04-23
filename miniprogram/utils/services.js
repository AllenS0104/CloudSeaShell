/**
 * API service layer for WeChat Mini Program
 * All APIs use Open-Meteo (free, no key required, works in China)
 * Includes retry, timeout, and local cache for resilience
 */

const WEATHER_ENDPOINTS = [
  'https://api.open-meteo.com',
  'https://ensemble-api.open-meteo.com',
];

const CACHE_KEY_PREFIX = 'cloudsea_cache_';
const WEATHER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function wxRequest(url, options = {}) {
  const { timeoutMs = 8000, retries = 1 } = options;

  function attempt(retriesLeft) {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        timeout: timeoutMs,
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode >= 500 && retriesLeft > 0) {
            console.warn(`服务器错误 ${res.statusCode}，重试中... (${retriesLeft})`, url);
            setTimeout(() => {
              attempt(retriesLeft - 1).then(resolve, reject);
            }, 1000);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail(err) {
          if (retriesLeft > 0) {
            console.warn(`请求失败，重试中... (${retriesLeft})`, url);
            setTimeout(() => {
              attempt(retriesLeft - 1).then(resolve, reject);
            }, 1000);
          } else {
            reject(new Error(err.errMsg || '网络请求失败'));
          }
        },
      });
    });
  }

  return attempt(retries);
}

function getCachedData(key) {
  try {
    const raw = wx.getStorageSync(CACHE_KEY_PREFIX + key);
    if (raw && raw.expireAt > Date.now()) {
      return raw.data;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function setCachedData(key, data, ttl) {
  try {
    wx.setStorageSync(CACHE_KEY_PREFIX + key, {
      data,
      expireAt: Date.now() + ttl,
    });
  } catch (e) { /* ignore */ }
}

async function fetchWeather(lat, lon) {
  const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    console.log('使用缓存天气数据');
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

      const data = await wxRequest(`${WEATHER_ENDPOINTS[i]}/v1/forecast?${params}`, {
        timeoutMs: 15000,
        retries: 1,
      });

      if (!data?.hourly?.time?.length) {
        throw new Error('天气数据格式无效');
      }

      setCachedData(cacheKey, data, WEATHER_CACHE_TTL);
      return { data, sourceIndex: i, fromCache: false };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`天气数据请求失败：${lastError?.message || '网络超时，请稍后重试'}`);
}

async function fetchElevation(lat, lon) {
  const cacheKey = `elev_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = getCachedData(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await wxRequest(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
      { timeoutMs: 6000, retries: 1 },
    );
    const value = data?.elevation?.[0] ?? data?.elevation;
    if (typeof value === 'number' && isFinite(value)) {
      setCachedData(cacheKey, value, 24 * 60 * 60 * 1000); // cache 24h
      return value;
    }
  } catch (err) {
    console.warn('海拔获取失败，使用默认值', err.message);
  }

  return 300;
}

async function geocodeAddress(address) {
  // Strategy: Open-Meteo only supports single place names.
  // We extract candidate keywords from the input and try each,
  // then rank results by matching province/city context.

  const raw = address.trim();
  if (!raw) throw new Error('请输入地名');

  // Extract context clues (province/city mentioned in input)
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

  // Generate search candidates by splitting on admin suffixes
  // "北京门头沟妙峰山" → try ["妙峰山", "门头沟", ...] in order
  const withSplits = raw
    .replace(/(省|自治区|自治州|市|区|县|镇|乡|村|街道|风景区|景区|国家公园)/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length >= 2);

  const candidates = [];
  // 1. Full input (sometimes works for simple names like "泰山")
  candidates.push(raw);
  // 2. Suffix-split parts in reverse (most specific = rightmost in Chinese)
  for (let i = withSplits.length - 1; i >= 0; i--) {
    if (!candidates.includes(withSplits[i])) candidates.push(withSplits[i]);
  }
  // 3. Last 3 and 4 characters (catches "妙峰山", "牛背山", "哈巴雪山")
  for (const n of [3, 4, 2, 5]) {
    if (n < raw.length) {
      const tail = raw.slice(-n);
      if (!candidates.includes(tail)) candidates.push(tail);
    }
  }

  let allResults = [];

  for (const term of candidates) {
    try {
      const data = await wxRequest(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=zh&format=json`,
        { timeoutMs: 6000, retries: 0 },
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
        break; // Found results, stop trying less specific terms
      }
    } catch (err) {
      // Continue to next candidate
    }
  }

  if (allResults.length === 0) {
    throw new Error('未找到该地址，请尝试更简短的核心地名');
  }

  // Rank: prefer results matching the context (province/city)
  if (contextHint) {
    allResults.sort((a, b) => {
      const aMatch = a.admin1.includes(contextHint) || a.name.includes(contextHint) ? 1 : 0;
      const bMatch = b.admin1.includes(contextHint) || b.name.includes(contextHint) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  // Deduplicate by name
  const seen = new Set();
  allResults = allResults.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });

  return allResults.slice(0, 8);
}

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        resolve({ latitude: res.latitude, longitude: res.longitude });
      },
      fail(err) {
        reject(new Error(err.errMsg || '定位失败，请在设置中允许位置权限'));
      },
    });
  });
}

module.exports = {
  fetchWeather,
  fetchElevation,
  geocodeAddress,
  getLocation,
};
