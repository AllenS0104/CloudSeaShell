const WEATHER_API_ENDPOINTS = [
  'https://api.open-meteo.com',
  'https://ensemble-api.open-meteo.com',
];

async function fetchJson(url, options = {}) {
  const { timeoutMs = 10000, headers, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: { ...headers },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeGeocodeResults(data) {
  const results = Array.isArray(data) ? data : data?.results;
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map((item) => ({
      latitude: Number(item.latitude ?? item.lat),
      longitude: Number(item.longitude ?? item.lon),
      name: item.name ?? item.display_name ?? item.admin1 ?? '',
    }))
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

export async function fetchElevation(lat, lon) {
  const data = await fetchJson(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`, {
    timeoutMs: 5000,
  });
  const value = data?.results?.[0]?.elevation;

  if (!Number.isFinite(value)) {
    throw new Error('海拔数据格式无效');
  }

  return value;
}

export async function fetchWeather(lat, lon, onSourceChange) {
  let lastError = null;

  for (let index = 0; index < WEATHER_API_ENDPOINTS.length; index += 1) {
    onSourceChange?.(index);

    try {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,visibility,wind_speed_10m,wind_direction_10m,precipitation,is_day',
        hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,precipitation,visibility,precipitation_probability,wind_speed_10m,is_day',
        daily: 'sunrise,sunset',
        timezone: 'Asia/Shanghai',
        model: 'icon_seamless,gfs_seamless',
      });
      const data = await fetchJson(`${WEATHER_API_ENDPOINTS[index]}/v1/forecast?${params.toString()}`, {
        timeoutMs: 12000,
      });

      if (!data?.hourly?.time?.length) {
        throw new Error('天气数据格式无效');
      }

      return { data, sourceIndex: index };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`所有天气数据源均请求失败：${lastError?.message ?? '未知错误'}`);
}

export async function geocodeAddress(address) {
  try {
    const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=zh&format=json`, {
      timeoutMs: 10000,
    });
    const results = normalizeGeocodeResults(data);
    if (results.length) {
      return results;
    }
  } catch (error) {
    console.warn('[Open-Meteo] 地理编码失败，尝试回退到 Nominatim。', error);
  }

  try {
    const data = await fetchJson(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=zh-CN`, {
      timeoutMs: 10000,
      headers: {
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    const results = normalizeGeocodeResults(data);
    if (results.length) {
      return results;
    }
  } catch (error) {
    throw new Error(`地址查询网络错误：${error.message}`);
  }

  throw new Error('未找到该地址，请尝试更简单的关键词（如“北京”或“上海”）。');
}

export async function reverseGeocode(lat, lon) {
  const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-CN`, {
    timeoutMs: 8000,
    headers: {
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });

  return data?.display_name || '未知区域';
}
