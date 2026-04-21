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
  // Clean up search term: extract key place name
  const cleanAddress = address
    .replace(/[省市区县镇乡村路街道号楼栋单元室]+$/g, '')
    .replace(/[,，。.!！?？]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');

  const searchTerm = cleanAddress || address;

  const data = await wxRequest(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=10&language=zh&format=json`,
    { timeoutMs: 8000, retries: 1 },
  );

  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) {
    // Retry with first 2 characters (often the core place name in Chinese)
    if (searchTerm.length > 2) {
      return geocodeAddress(searchTerm.slice(0, 2));
    }
    throw new Error('未找到该地址，请尝试更简短的地名（如"黄山"）');
  }

  // Return all results for user to pick
  return results.map(item => ({
    latitude: item.latitude,
    longitude: item.longitude,
    name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
    elevation: item.elevation,
  }));
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
