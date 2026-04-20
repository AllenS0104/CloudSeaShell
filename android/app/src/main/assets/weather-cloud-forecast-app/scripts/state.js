export const DEFAULT_LOCATION = {
  lat: 39.9042,
  lon: 116.4074,
  name: '北京',
};

export const DEFAULT_ELEVATION = 300;
export const MAX_FAVORITE_LOCATIONS = 6;
export const MAX_RECENT_LOCATIONS = 6;
export const SAVED_PLACES_STORAGE_KEY = 'cloudsea.savedPlaces.v1';
export const WEATHER_CACHE_STORAGE_KEY = 'cloudsea.weatherCache.v1';
export const WEATHER_CACHE_VERSION = 1;
export const WEATHER_CACHE_STALE_MS = 6 * 60 * 60 * 1000;
export const OBSERVATION_REMINDER_STORAGE_KEY = 'cloudsea.observationReminders.v1';
export const MAX_OBSERVATION_REMINDERS = 12;

const state = {
  lat: DEFAULT_LOCATION.lat,
  lon: DEFAULT_LOCATION.lon,
  locationName: DEFAULT_LOCATION.name,
  selectedDayIndex: 0,
  elevation: DEFAULT_ELEVATION,
  weatherData: null,
  weatherSourceLabel: 'Open-Meteo',
  lastUpdatedAt: null,
  modelVersion: 'CloudSea Model v4',
  favoriteLocations: [],
  recentLocations: [],
  weatherDataMode: 'live',
  weatherCacheAgeLevel: 'fresh',
  observationReminders: [],
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clampSelectedDay(maxDays) {
  const safeMax = Math.max(0, maxDays - 1);
  state.selectedDayIndex = Math.min(Math.max(state.selectedDayIndex, 0), safeMax);
  return state.selectedDayIndex;
}

export function normalizeSavedLocation(location) {
  const lat = Number(location?.lat ?? location?.latitude);
  const lon = Number(location?.lon ?? location?.longitude);
  const name = String(location?.name ?? '').trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !name) {
    return null;
  }

  return {
    id: `${lat.toFixed(4)},${lon.toFixed(4)}:${name}`,
    lat,
    lon,
    name,
  };
}

export function upsertSavedLocation(list, location, limit) {
  const normalized = normalizeSavedLocation(location);
  if (!normalized) {
    return list;
  }

  const next = [
    normalized,
    ...list.filter((item) => item.id !== normalized.id),
  ];
  return next.slice(0, limit);
}

export function removeSavedLocation(list, location) {
  const normalized = normalizeSavedLocation(location);
  if (!normalized) {
    return list;
  }

  return list.filter((item) => item.id !== normalized.id);
}

function getStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function normalizeWeatherLocation(location) {
  const lat = Number(location?.lat ?? location?.latitude);
  const lon = Number(location?.lon ?? location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    name: String(location?.name ?? '').trim(),
  };
}

function normalizeReminderLocation(location) {
  const lat = Number(location?.lat ?? location?.latitude);
  const lon = Number(location?.lon ?? location?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    name: String(location?.name ?? location?.locationName ?? '').trim(),
  };
}

export function weatherCacheKey(lat, lon) {
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) {
    return null;
  }

  return `${safeLat.toFixed(4)},${safeLon.toFixed(4)}`;
}

export function getWeatherCacheAgeLevel(fetchedAt, now = Date.now()) {
  const timestamp = new Date(fetchedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return 'stale';
  }

  return now - timestamp > WEATHER_CACHE_STALE_MS ? 'stale' : 'fresh';
}

export function normalizeWeatherCacheRecord(record) {
  const location = normalizeWeatherLocation(record?.location ?? record);
  if (!location || !record?.weatherData?.hourly?.time?.length) {
    return null;
  }

  const key = weatherCacheKey(location.lat, location.lon);
  if (!key) {
    return null;
  }

  return {
    key,
    location,
    fetchedAt: record?.fetchedAt || null,
    sourceLabel: String(record?.sourceLabel ?? 'Open-Meteo').trim() || 'Open-Meteo',
    sourceIndex: Number.isFinite(Number(record?.sourceIndex)) ? Number(record.sourceIndex) : 0,
    elevation: Number.isFinite(Number(record?.elevation)) ? Number(record.elevation) : DEFAULT_ELEVATION,
    selectedDayIndex: Math.max(0, Number(record?.selectedDayIndex) || 0),
    weatherData: record.weatherData,
  };
}

export function loadWeatherCache(storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return { version: WEATHER_CACHE_VERSION, lastKey: null, records: {} };
  }

  try {
    const raw = safeStorage.getItem(WEATHER_CACHE_STORAGE_KEY);
    if (!raw) {
      return { version: WEATHER_CACHE_VERSION, lastKey: null, records: {} };
    }

    const parsed = JSON.parse(raw);
    const records = Object.fromEntries(
      Object.values(parsed?.records || {})
        .map(normalizeWeatherCacheRecord)
        .filter(Boolean)
        .map((record) => [record.key, record]),
    );

    return {
      version: WEATHER_CACHE_VERSION,
      lastKey: records[parsed?.lastKey] ? parsed.lastKey : Object.keys(records)[0] || null,
      records,
    };
  } catch (error) {
    console.warn('读取天气缓存失败:', error);
    return { version: WEATHER_CACHE_VERSION, lastKey: null, records: {} };
  }
}

export function saveWeatherCache(cache, storage) {
  const safeStorage = getStorage(storage);
  const records = Object.fromEntries(
    Object.values(cache?.records || {})
      .map(normalizeWeatherCacheRecord)
      .filter(Boolean)
      .map((record) => [record.key, record]),
  );
  const payload = {
    version: WEATHER_CACHE_VERSION,
    lastKey: cache?.lastKey && records[cache.lastKey] ? cache.lastKey : Object.keys(records)[0] || null,
    records,
  };

  if (!safeStorage) {
    return payload;
  }

  try {
    safeStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('保存天气缓存失败:', error);
  }

  return payload;
}

export function upsertWeatherCacheRecord(cache, record) {
  const normalized = normalizeWeatherCacheRecord(record);
  if (!normalized) {
    return cache;
  }

  return {
    version: WEATHER_CACHE_VERSION,
    lastKey: normalized.key,
    records: {
      ...(cache?.records || {}),
      [normalized.key]: normalized,
    },
  };
}

export function getWeatherCacheRecord(cache, location) {
  const normalized = normalizeWeatherLocation(location);
  if (!normalized) {
    return null;
  }

  const key = weatherCacheKey(normalized.lat, normalized.lon);
  return key ? cache?.records?.[key] || null : null;
}

export function getLastWeatherCacheRecord(cache) {
  return cache?.lastKey ? cache.records?.[cache.lastKey] || null : null;
}

export function normalizeObservationReminder(reminder) {
  const fireAt = new Date(reminder?.fireAt).toISOString?.();
  const location = normalizeReminderLocation(reminder?.location ?? reminder);
  if (!location || !fireAt) {
    return null;
  }

  return {
    reminderId: String(
      reminder?.reminderId
      || `${weatherCacheKey(location.lat, location.lon)}:${fireAt}`,
    ),
    title: String(reminder?.title ?? '云海观测提醒').trim() || '云海观测提醒',
    body: String(reminder?.body ?? '').trim(),
    fireAt,
    transport: String(reminder?.transport ?? 'web').trim() || 'web',
    status: reminder?.status === 'triggered' ? 'triggered' : 'scheduled',
    windowLabel: String(reminder?.windowLabel ?? '').trim(),
    location,
  };
}

export function loadObservationReminders(storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return [];
  }

  try {
    const raw = safeStorage.getItem(OBSERVATION_REMINDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return (JSON.parse(raw) || [])
      .map(normalizeObservationReminder)
      .filter(Boolean)
      .slice(0, MAX_OBSERVATION_REMINDERS);
  } catch (error) {
    console.warn('读取观测提醒失败:', error);
    return [];
  }
}

export function saveObservationReminders(reminders, storage) {
  const safeStorage = getStorage(storage);
  const payload = (reminders || [])
    .map(normalizeObservationReminder)
    .filter(Boolean)
    .sort((left, right) => new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime())
    .slice(0, MAX_OBSERVATION_REMINDERS);

  if (!safeStorage) {
    return payload;
  }

  try {
    safeStorage.setItem(OBSERVATION_REMINDER_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('保存观测提醒失败:', error);
  }

  return payload;
}

export function upsertObservationReminder(reminders, reminder) {
  const normalized = normalizeObservationReminder(reminder);
  if (!normalized) {
    return reminders;
  }

  return saveObservationReminders([
    normalized,
    ...(reminders || []).filter((item) => item.reminderId !== normalized.reminderId),
  ]);
}

export function markObservationReminderTriggered(reminders, reminderId) {
  return saveObservationReminders(
    (reminders || []).map((item) => (
      item.reminderId === reminderId ? { ...item, status: 'triggered' } : item
    )),
  );
}

export function getActiveObservationReminder(reminders, location) {
  const normalizedLocation = normalizeReminderLocation(location);
  if (!normalizedLocation) {
    return null;
  }

  return (reminders || []).find((item) => item.status === 'scheduled'
    && item.location.lat === normalizedLocation.lat
    && item.location.lon === normalizedLocation.lon) || null;
}

export function loadSavedPlaces(storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return { favorites: [], recents: [] };
  }

  try {
    const raw = safeStorage.getItem(SAVED_PLACES_STORAGE_KEY);
    if (!raw) {
      return { favorites: [], recents: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      favorites: (parsed?.favorites || []).map(normalizeSavedLocation).filter(Boolean).slice(0, MAX_FAVORITE_LOCATIONS),
      recents: (parsed?.recents || []).map(normalizeSavedLocation).filter(Boolean).slice(0, MAX_RECENT_LOCATIONS),
    };
  } catch (error) {
    console.warn('读取已保存地点失败:', error);
    return { favorites: [], recents: [] };
  }
}

export function saveSavedPlaces(nextPlaces, storage) {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return nextPlaces;
  }

  const payload = {
    favorites: (nextPlaces?.favorites || []).map(normalizeSavedLocation).filter(Boolean).slice(0, MAX_FAVORITE_LOCATIONS),
    recents: (nextPlaces?.recents || []).map(normalizeSavedLocation).filter(Boolean).slice(0, MAX_RECENT_LOCATIONS),
  };

  try {
    safeStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('保存已保存地点失败:', error);
  }

  return payload;
}
