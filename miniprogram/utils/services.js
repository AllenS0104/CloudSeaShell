/**
 * API service layer for WeChat Mini Program
 * Adapts web fetch calls to wx.request
 */

const WEATHER_ENDPOINTS = [
  'https://api.open-meteo.com',
  'https://ensemble-api.open-meteo.com',
];

const ELEVATION_ENDPOINTS = [
  'https://api.open-meteo.com/v1/elevation',
  'https://api.open-elevation.com/api/v1/lookup',
];

function wxRequest(url, options = {}) {
  const { timeoutMs = 10000 } = options;
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
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

async function fetchWeather(lat, lon) {
  let lastError = null;

  for (let i = 0; i < WEATHER_ENDPOINTS.length; i++) {
    try {
      const params = [
        `latitude=${lat}`,
        `longitude=${lon}`,
        'current=temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,visibility,wind_speed_10m,wind_direction_10m,precipitation,is_day',
        'hourly=temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,precipitation,visibility,precipitation_probability,wind_speed_10m,is_day',
        'daily=sunrise,sunset',
        'timezone=Asia/Shanghai',
        'model=icon_seamless,gfs_seamless',
      ].join('&');

      const data = await wxRequest(`${WEATHER_ENDPOINTS[i]}/v1/forecast?${params}`, { timeoutMs: 12000 });

      if (!data?.hourly?.time?.length) {
        throw new Error('天气数据格式无效');
      }

      return { data, sourceIndex: i };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`所有天气源均请求失败：${lastError?.message || '未知错误'}`);
}

async function fetchElevation(lat, lon) {
  // Try Open-Meteo elevation first (faster, more reliable in China)
  try {
    const data = await wxRequest(
      `${ELEVATION_ENDPOINTS[0]}?latitude=${lat}&longitude=${lon}`,
      { timeoutMs: 5000 },
    );
    const value = data?.elevation?.[0] ?? data?.elevation;
    if (typeof value === 'number' && isFinite(value)) {
      return value;
    }
  } catch (err) {
    console.warn('Open-Meteo elevation failed, trying fallback', err.message);
  }

  // Fallback to Open-Elevation
  try {
    const data = await wxRequest(
      `${ELEVATION_ENDPOINTS[1]}?locations=${lat},${lon}`,
      { timeoutMs: 5000 },
    );
    const value = data?.results?.[0]?.elevation;
    if (typeof value === 'number' && isFinite(value)) {
      return value;
    }
  } catch (err) {
    console.warn('Open-Elevation also failed', err.message);
  }

  // Return default if all fail
  return 300;
}

async function geocodeAddress(address) {
  const data = await wxRequest(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=zh&format=json`,
    { timeoutMs: 10000 },
  );

  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('未找到该地址');
  }

  const item = results[0];
  return {
    latitude: item.latitude,
    longitude: item.longitude,
    name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
  };
}

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        resolve({ latitude: res.latitude, longitude: res.longitude });
      },
      fail(err) {
        reject(new Error(err.errMsg || '定位失败'));
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
