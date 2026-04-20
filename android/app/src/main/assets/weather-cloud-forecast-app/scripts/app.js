import {
  clampSelectedDay,
  DEFAULT_ELEVATION,
  getActiveObservationReminder,
  getState,
  getLastWeatherCacheRecord,
  getWeatherCacheAgeLevel,
  getWeatherCacheRecord,
  loadObservationReminders,
  loadSavedPlaces,
  loadWeatherCache,
  markObservationReminderTriggered,
  MAX_FAVORITE_LOCATIONS,
  MAX_RECENT_LOCATIONS,
  normalizeSavedLocation,
  removeSavedLocation,
  saveObservationReminders,
  saveSavedPlaces,
  saveWeatherCache,
  setState,
  upsertObservationReminder,
  upsertSavedLocation,
  upsertWeatherCacheRecord,
} from './state.js';
import {
  getBridgeInfo,
  hasBridgeCapability,
  isNativeShell,
  invokeBridgeRequest,
  requestNativeOpenMap,
  requestNativeObservationReminder,
  requestNativeShareImage,
  requestNativeShareText,
  waitForAndroidBridge,
} from './bridge.js';
import { getElements, getEl, setStatus } from './dom.js';
import { fetchElevation, fetchWeather, geocodeAddress, normalizeGeocodeResults } from './services.js';
import { initMap, updateMapPosition, updateObservationOverlay } from './map.js';
import { getDeviceLocation } from './location.js';
import { renderDateSelector, renderLoadingState, renderWeather, renderWeatherError } from './render.js';
import { setupSosModal } from './sos.js';
import { analyzeCurrentCloudSea, analyzeDayCloudSea, buildObservationGuidance } from './calculations.js';

function weatherSourceLabelFromIndex(sourceIndex) {
  return sourceIndex === 0 ? 'Open-Meteo 主数据源' : `Open-Meteo 备用源 ${sourceIndex + 1}`;
}

function dispatchAppEvent(eventName, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

let reminderTimerId = null;

function stripOfflineCachePrefix(sourceLabel) {
  return String(sourceLabel || 'Open-Meteo').replace(/^离线缓存\s·\s/, '').trim() || 'Open-Meteo';
}

function persistCurrentWeatherCacheRecord() {
  const state = getState();
  if (!state.weatherData?.hourly?.time?.length) {
    return null;
  }

  const cache = loadWeatherCache();
  const nextCache = upsertWeatherCacheRecord(cache, {
    location: {
      lat: state.lat,
      lon: state.lon,
      name: state.locationName,
    },
    fetchedAt: state.lastUpdatedAt,
    sourceLabel: stripOfflineCachePrefix(state.weatherSourceLabel),
    elevation: state.elevation,
    selectedDayIndex: state.selectedDayIndex,
    weatherData: state.weatherData,
  });

  return saveWeatherCache(nextCache);
}

function applyWeatherCacheRecord(record) {
  if (!record?.weatherData?.hourly?.time?.length) {
    return false;
  }

  setState({
    lat: record.location.lat,
    lon: record.location.lon,
    locationName: record.location.name || '',
    elevation: record.elevation || DEFAULT_ELEVATION,
    weatherData: record.weatherData,
    weatherSourceLabel: `离线缓存 · ${stripOfflineCachePrefix(record.sourceLabel)}`,
    lastUpdatedAt: record.fetchedAt,
    selectedDayIndex: record.selectedDayIndex || 0,
    weatherDataMode: 'cached',
    weatherCacheAgeLevel: getWeatherCacheAgeLevel(record.fetchedAt),
  });
  clampSelectedDay(new Set(record.weatherData.hourly.time.map((time) => time.split('T')[0])).size);
  renderDateSelector(record.weatherData.hourly.time, getState().selectedDayIndex);
  renderWeather(getState());
  syncDashboardArtifacts();
  return true;
}

function buildCurrentPlaceSnapshot() {
  return normalizeSavedLocation({
    lat: getState().lat,
    lon: getState().lon,
    name: getState().locationName || '当前点位',
  });
}

function setObservationReminders(reminders) {
  const nextReminders = saveObservationReminders(reminders);
  setState({ observationReminders: nextReminders });
  return nextReminders;
}

function persistObservationReminder(reminder) {
  const nextReminders = upsertObservationReminder(getState().observationReminders, reminder);
  setState({ observationReminders: nextReminders });
  dispatchAppEvent('cloudsea:reminder:scheduled', reminder);
  return nextReminders;
}

function notifyObservationReminder(reminder) {
  const message = `云海提醒：现在适合为 ${reminder.location.name || '当前地点'} 出发，建议守候 ${reminder.windowLabel || '推荐时段'}。`;
  setStatus(message, 'warning');
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(reminder.title, { // eslint-disable-line no-new
      body: reminder.body || message,
      tag: reminder.reminderId,
    });
    notification.onclick = () => window.focus();
  }
  dispatchAppEvent('cloudsea:reminder:fired', reminder);
}

function syncReminderTimer() {
  if (typeof window === 'undefined') {
    return;
  }

  if (reminderTimerId) {
    window.clearTimeout(reminderTimerId);
    reminderTimerId = null;
  }

  const nextReminder = getState().observationReminders
    .filter((item) => item.status === 'scheduled')
    .sort((left, right) => new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime())[0];

  if (!nextReminder) {
    return;
  }

  const delay = Math.max(0, new Date(nextReminder.fireAt).getTime() - Date.now());
  reminderTimerId = window.setTimeout(() => {
    triggerDueObservationReminders();
  }, delay + 50);
}

function triggerDueObservationReminders() {
  const dueReminders = getState().observationReminders.filter((item) => item.status === 'scheduled'
    && new Date(item.fireAt).getTime() <= Date.now());

  if (!dueReminders.length) {
    syncReminderTimer();
    return;
  }

  dueReminders.forEach((reminder) => notifyObservationReminder(reminder));
  setObservationReminders(
    dueReminders.reduce(
      (reminders, reminder) => markObservationReminderTriggered(reminders, reminder.reminderId),
      getState().observationReminders,
    ),
  );
  syncReminderTimer();
  renderWeather(getState());
  syncDashboardArtifacts();
}

function buildReminderPlan(state = getState()) {
  const decision = buildDecisionContext(state);
  if (!decision || !state.weatherData?.hourly?.time?.length) {
    return null;
  }

  const dayAnalysis = analyzeDayCloudSea(state.weatherData.hourly, state.selectedDayIndex * 24, state.elevation);
  const anchorTime = dayAnalysis.bestHour?.timeString || state.weatherData.current?.time || null;
  if (!anchorTime || Number.isNaN(new Date(anchorTime).getTime())) {
    return null;
  }

  const fireAtTime = new Date(anchorTime).getTime() - (45 * 60 * 1000);
  const safeFireAt = new Date(Math.max(fireAtTime, Date.now() + (2 * 60 * 1000))).toISOString();
  const locationName = state.locationName || '当前地点';
  return {
    reminderId: `${Number(state.lat).toFixed(4)},${Number(state.lon).toFixed(4)}:${safeFireAt}`,
    title: '云海观测提醒',
    body: `${locationName} 建议守候 ${decision.guidance.recommendedWindow}，推荐海拔 ${decision.guidance.targetElevation} m。`,
    fireAt: safeFireAt,
    windowLabel: decision.guidance.recommendedWindow,
    location: {
      lat: state.lat,
      lon: state.lon,
      name: locationName,
    },
  };
}

async function scheduleObservationReminder() {
  const activeReminder = getActiveObservationReminder(getState().observationReminders, {
    lat: getState().lat,
    lon: getState().lon,
  });
  if (activeReminder) {
    setStatus(`当前地点已设置提醒：${new Date(activeReminder.fireAt).toLocaleString('zh-CN')}`, 'info');
    return;
  }

  const plan = buildReminderPlan();
  if (!plan) {
    setStatus('当前暂无可预约的提醒时段。', 'warning');
    return;
  }

  dispatchAppEvent('cloudsea:reminder:requested', plan);

  try {
    const bridgeInfo = await getBridgeInfo({ timeout: 0 });
    if (isNativeShell(bridgeInfo) && hasBridgeCapability(bridgeInfo, 'observation.reminder.schedule')) {
      await requestNativeObservationReminder(plan);
      persistObservationReminder({ ...plan, transport: 'native' });
      renderWeather(getState());
      syncDashboardArtifacts();
      setStatus('已交给原生壳设置观测提醒。', 'success');
      return;
    }
  } catch (error) {
    setStatus(`原生提醒失败，改用网页提醒继续。${error.message ? ` (${error.message})` : ''}`, 'warning');
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore permission prompt failures; in-page banner still works
    }
  }

  persistObservationReminder({ ...plan, transport: 'web' });
  syncReminderTimer();
  renderWeather(getState());
  syncDashboardArtifacts();
  setStatus('网页提醒已保存，标签页打开时会提醒你。', 'success');
}

function persistSavedPlaces(nextPlaces) {
  const savedPlaces = saveSavedPlaces(nextPlaces);
  setState({
    favoriteLocations: savedPlaces.favorites,
    recentLocations: savedPlaces.recents,
  });
  dispatchAppEvent('cloudsea:places:updated', savedPlaces);
  return savedPlaces;
}

function toggleFavoriteCurrentPlace() {
  const currentPlace = buildCurrentPlaceSnapshot();
  if (!currentPlace) {
    setStatus('当前点位信息不完整，暂时无法收藏。', 'warning');
    return;
  }

  const state = getState();
  const isFavorite = state.favoriteLocations.some((item) => item.id === currentPlace.id);
  const favorites = isFavorite
    ? removeSavedLocation(state.favoriteLocations, currentPlace)
    : upsertSavedLocation(state.favoriteLocations, currentPlace, MAX_FAVORITE_LOCATIONS);

  persistSavedPlaces({
    favorites,
    recents: state.recentLocations,
  });
  renderWeather(getState());
  syncDashboardArtifacts();
  setStatus(isFavorite ? '已取消收藏当前点位。' : '已收藏当前点位。', 'success');
}

async function restoreSavedPlace(place) {
  await applyCoordinates({
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    name: place.name,
  }, `正在加载“${place.name}”的天气数据...`);
}

function buildDecisionContext(state) {
  const data = state.weatherData;
  if (!data?.hourly?.time?.length) {
    return null;
  }

  if (state.selectedDayIndex === 0 && data.current) {
    const analysis = analyzeCurrentCloudSea(data.current, state.elevation);
    const guidance = buildObservationGuidance({
      analysis,
      currentElevation: state.elevation,
      sunriseTime: data.daily?.sunrise?.[0],
      sunsetTime: data.daily?.sunset?.[0],
    });
    return {
      headline: '当前观测简报',
      analysis,
      guidance,
    };
  }

  const analysis = analyzeDayCloudSea(data.hourly, state.selectedDayIndex * 24, state.elevation);
  const guidance = buildObservationGuidance({
    analysis: analysis.bestHour ?? analysis,
    currentElevation: state.elevation,
    sunriseTime: data.daily?.sunrise?.[state.selectedDayIndex],
    sunsetTime: data.daily?.sunset?.[state.selectedDayIndex],
    bestTimeLabel: analysis.bestHour?.timeLabel,
  });
  return {
    headline: '全天观测简报',
    analysis: analysis.bestHour ?? analysis,
    guidance,
  };
}

function buildObservationBrief(state) {
  const decision = buildDecisionContext(state);
  if (!decision) {
    return '当前暂无可分享的观测简报。';
  }
  const { analysis, guidance, headline } = decision;

  return [
    `${headline}`,
    `地点：${state.locationName || `${state.lat.toFixed(2)}, ${state.lon.toFixed(2)}`}`,
    `坐标：${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`,
    `结论：${analysis.resultText}`,
    `行动建议：${guidance.goLevel}`,
    `推荐时段：${guidance.recommendedWindow}`,
    `建议海拔：${guidance.targetElevation} m`,
    `机位建议：${guidance.viewpointAdvice}`,
    `数据源：${state.weatherSourceLabel || 'Open-Meteo'}`,
    `更新时间：${state.lastUpdatedAt ? new Date(state.lastUpdatedAt).toLocaleString('zh-CN') : '刚刚'}`,
    `模型：${state.modelVersion || 'CloudSea Model v4'}`,
  ].join('\n');
}

function drawObservationOverlay() {
  const state = getState();
  const decision = buildDecisionContext(state);
  if (!decision) {
    return;
  }

  updateObservationOverlay({
    lat: state.lat,
    lon: state.lon,
    guidance: decision.guidance,
    analysis: decision.analysis,
  });
}

function buildPosterData(state) {
  const decision = buildDecisionContext(state);
  if (!decision) {
    return null;
  }

  return {
    title: decision.headline,
    location: state.locationName || `${state.lat.toFixed(2)}, ${state.lon.toFixed(2)}`,
    coords: `${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`,
    result: decision.analysis.resultText,
    action: decision.guidance.goLevel,
    window: decision.guidance.recommendedWindow,
    elevation: `${decision.guidance.targetElevation} m`,
    source: state.weatherSourceLabel || 'Open-Meteo',
    updatedAt: state.lastUpdatedAt ? new Date(state.lastUpdatedAt).toLocaleString('zh-CN') : '刚刚',
    version: state.modelVersion || 'CloudSea Model v4',
  };
}

function buildPosterAsset() {
  const poster = buildPosterData(getState());
  if (!poster) {
    setStatus('暂无可导出的海报数据。', 'warning');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    setStatus('当前环境不支持海报导出。', 'warning');
    return null;
  }

  ctx.fillStyle = '#08111e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, 'rgba(58,164,255,0.25)');
  gradient.addColorStop(1, 'rgba(40,167,69,0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#8dc7ff';
  ctx.font = '28px Poppins';
  ctx.fillText('Cloud Sea Forecast Lab', 72, 88);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Poppins';
  ctx.fillText('云海观测简报', 72, 170);

  ctx.font = '30px Poppins';
  ctx.fillStyle = '#d9e7fa';
  ctx.fillText(poster.location, 72, 230);
  ctx.fillText(`坐标 ${poster.coords}`, 72, 274);

  ctx.fillStyle = '#101b2c';
  roundRect(ctx, 72, 330, 936, 220, 28, '#101b2c', 'rgba(255,255,255,0.08)');
  ctx.fillStyle = '#8dc7ff';
  ctx.font = '28px Poppins';
  ctx.fillText('综合判断', 110, 392);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Poppins';
  ctx.fillText(poster.result, 110, 468);
  ctx.font = '32px Poppins';
  ctx.fillStyle = '#d9e7fa';
  ctx.fillText(`行动建议：${poster.action}`, 110, 522);

  roundRect(ctx, 72, 590, 936, 470, 28, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');
  const rows = [
    ['推荐时段', poster.window],
    ['建议海拔', poster.elevation],
    ['数据源', poster.source],
    ['更新时间', poster.updatedAt],
    ['模型版本', poster.version],
  ];
  let y = 660;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = '#8dc7ff';
    ctx.font = '26px Poppins';
    ctx.fillText(label, 110, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Poppins';
    ctx.fillText(value, 320, y);
    y += 82;
  });

  ctx.fillStyle = '#a9bdd8';
  ctx.font = '24px Poppins';
  ctx.fillText('Generated by 云海观测决策台', 72, 1220);

  return {
    poster,
    dataUrl: canvas.toDataURL('image/png'),
    filename: 'cloud-sea-brief.png',
  };
}

async function downloadPoster() {
  const posterAsset = buildPosterAsset();
  if (!posterAsset) {
    return;
  }

  dispatchAppEvent('cloudsea:share:requested', {
    type: 'poster-download',
    poster: posterAsset.poster,
  });

  try {
    const bridgeInfo = await getBridgeInfo({ timeout: 0 });
    if (isNativeShell(bridgeInfo) && hasBridgeCapability(bridgeInfo, 'share.image')) {
      await requestNativeShareImage({
        title: '云海观测海报',
        filename: posterAsset.filename,
        dataUrl: posterAsset.dataUrl,
      });
      setStatus('海报已交给原生壳分享。', 'success');
      return;
    }
  } catch (error) {
    setStatus(`原生海报分享失败，改用下载方式继续。${error.message ? ` (${error.message})` : ''}`, 'warning');
  }

  const link = document.createElement('a');
  link.href = posterAsset.dataUrl;
  link.download = posterAsset.filename;
  link.click();
  setStatus('分享海报已生成并开始下载。', 'success');
}

function roundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function openExternalMapFallback({ latitude, longitude, label }) {
  const targetUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}&query_place_id=${encodeURIComponent(label)}`;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

function wireDashboardActions() {
  const briefButton = document.getElementById('copy-brief-btn');
  const posterButton = document.getElementById('download-poster-btn');
  const mapButton = document.getElementById('open-map-btn');
  const favoriteButton = document.getElementById('favorite-toggle-btn');
  const reminderButton = document.getElementById('observation-reminder-btn');
  const savedPlaceButtons = document.querySelectorAll('.saved-place-button');
  if (!briefButton && !posterButton && !mapButton && !favoriteButton && !reminderButton && !savedPlaceButtons.length) {
    return;
  }

  if (briefButton) {
    briefButton.onclick = async () => {
      const brief = buildObservationBrief(getState());

      try {
        dispatchAppEvent('cloudsea:share:requested', {
          type: 'brief',
          brief,
        });
        const bridgeInfo = await getBridgeInfo({ timeout: 0 });
        if (isNativeShell(bridgeInfo) && hasBridgeCapability(bridgeInfo, 'share.text')) {
          await requestNativeShareText({
            title: '云海观测简报',
            text: brief,
          });
          setStatus('观测简报已交给原生壳分享。', 'success');
          return;
        }

        if (navigator.share && !isNativeShell()) {
          await navigator.share({
            title: '云海观测简报',
            text: brief,
          });
          setStatus('观测简报已打开系统分享面板。', 'success');
          return;
        }

        await navigator.clipboard.writeText(brief);
        setStatus('观测简报已复制到剪贴板。', 'success');
      } catch (error) {
        setStatus(`分享失败：${error.message || '请稍后重试'}`, 'warning');
      }
    };
  }

  if (posterButton) {
    posterButton.onclick = () => downloadPoster();
  }

  if (mapButton) {
    mapButton.onclick = async () => {
      const state = getState();
      const target = {
        latitude: state.lat,
        longitude: state.lon,
        label: state.locationName || '观测点',
      };

      dispatchAppEvent('cloudsea:navigation:requested', target);

      try {
        const bridgeInfo = await getBridgeInfo({ timeout: 0 });
        if (isNativeShell(bridgeInfo) && hasBridgeCapability(bridgeInfo, 'navigation.map')) {
          await requestNativeOpenMap(target);
          setStatus('已交给原生壳打开地图。', 'success');
          return;
        }
      } catch (error) {
        setStatus(`原生地图跳转失败，改用网页地图继续。${error.message ? ` (${error.message})` : ''}`, 'warning');
      }

      openExternalMapFallback(target);
      setStatus('已在外部网页地图中打开当前点位。', 'success');
    };
  }

  if (favoriteButton) {
    favoriteButton.onclick = () => toggleFavoriteCurrentPlace();
  }

  if (reminderButton) {
    reminderButton.onclick = async () => {
      await scheduleObservationReminder();
    };
  }

  savedPlaceButtons.forEach((button) => {
    button.onclick = async () => {
      await restoreSavedPlace(button.dataset);
    };
  });
}

function syncDashboardArtifacts() {
  wireDashboardActions();
  drawObservationOverlay();
  syncReminderTimer();
}

function restoreLastView(message) {
  const state = getState();
  if (state.weatherData) {
    renderWeather(state);
    syncDashboardArtifacts();
  } else {
    renderWeatherError(message);
  }
  setStatus(message, 'error');
}

async function refreshForecast(loadingMessage) {
  const state = getState();
  renderLoadingState(loadingMessage);
  setStatus(loadingMessage, 'info');

  let elevation = DEFAULT_ELEVATION;
  try {
    elevation = await fetchElevation(state.lat, state.lon);
    setStatus('海拔获取成功，正在加载天气数据...', 'info');
  } catch (error) {
    setStatus(`海拔获取失败，已使用默认海拔继续加载。${error.message ? ` (${error.message})` : ''}`, 'warning');
  }
  setState({ elevation });

  try {
    const { data, sourceIndex } = await fetchWeather(state.lat, state.lon, (index) => {
      setStatus(`正在从数据源 ${index + 1} 加载天气数据...`, 'info');
    });
    const fetchedAt = new Date().toISOString();
    setState({
      weatherData: data,
      weatherSourceLabel: weatherSourceLabelFromIndex(sourceIndex),
      lastUpdatedAt: fetchedAt,
      weatherDataMode: 'live',
      weatherCacheAgeLevel: getWeatherCacheAgeLevel(fetchedAt),
    });
    clampSelectedDay(new Set(data.hourly.time.map((time) => time.split('T')[0])).size);
    renderDateSelector(data.hourly.time, getState().selectedDayIndex);
    const currentPlace = buildCurrentPlaceSnapshot();
    if (currentPlace) {
      persistSavedPlaces({
        favorites: getState().favoriteLocations,
        recents: upsertSavedLocation(getState().recentLocations, currentPlace, MAX_RECENT_LOCATIONS),
      });
    }
    persistCurrentWeatherCacheRecord();
    renderWeather(getState());
    syncDashboardArtifacts();
    dispatchAppEvent('cloudsea:weather:updated', {
      locationName: getState().locationName,
      lat: getState().lat,
      lon: getState().lon,
      sourceLabel: getState().weatherSourceLabel,
      updatedAt: getState().lastUpdatedAt,
      selectedDayIndex: getState().selectedDayIndex,
    });
    setStatus(
      sourceIndex === 0 ? '天气数据已更新。' : `天气数据已更新，已自动切换到备用数据源 ${sourceIndex + 1}。`,
      'success',
    );
  } catch (error) {
    const cachedRecord = getWeatherCacheRecord(loadWeatherCache(), state);
    if (applyWeatherCacheRecord(cachedRecord)) {
      setStatus(
        `网络不稳定，当前显示上次可用天气数据（更新于 ${cachedRecord.fetchedAt ? new Date(cachedRecord.fetchedAt).toLocaleString('zh-CN') : '稍早前'}）。`,
        'warning',
      );
      return;
    }

    renderWeatherError(error.message);
    setStatus(error.message, 'error');
  }
}

async function applyCoordinates({ latitude, longitude, name }, loadingMessage) {
  setState({
    lat: Number(latitude),
    lon: Number(longitude),
    locationName: name || '',
  });
  updateMapPosition(getState().lat, getState().lon);
  dispatchAppEvent('cloudsea:location:changed', {
    lat: getState().lat,
    lon: getState().lon,
    locationName: getState().locationName,
  });
  await refreshForecast(loadingMessage);
}

async function handleSearch() {
  const address = getEl('address')?.value.trim() || '';
  if (!address) {
    setStatus('请输入地点名称。', 'warning');
    return;
  }

  getEl('address')?.blur();
  renderLoadingState(`正在搜索“${address}”...`);
  setStatus(`正在搜索“${address}”...`, 'info');

  const bridgeInfo = await getBridgeInfo({ timeout: 400 });
  if (bridgeInfo.supportsRequest && hasBridgeCapability(bridgeInfo, 'geocode.search')) {
    try {
      const rawResult = await invokeBridgeRequest({
        action: 'geocode.search',
        payload: { query: address },
        timeout: 10000,
      });
      const results = normalizeGeocodeResults(rawResult);
      if (!results.length) {
        throw new Error('未找到地址。');
      }
      await applyCoordinates(results[0], `正在加载“${results[0].name || address}”的天气数据...`);
      return;
    } catch (error) {
      setStatus(`原生搜索失败，改用网页接口继续搜索。${error.message ? ` (${error.message})` : ''}`, 'warning');
    }
  }

  const bridge = await waitForAndroidBridge('fetchGeocode');
  if (bridge && hasBridgeCapability(bridgeInfo, 'geocode.search')) {
    try {
      bridge.fetchGeocode(address);
      return;
    } catch (error) {
      setStatus(`原生搜索失败，改用网页接口继续搜索。${error.message ? ` (${error.message})` : ''}`, 'warning');
    }
  }

  try {
    const results = await geocodeAddress(address);
    await applyCoordinates(results[0], `正在加载“${address}”的天气数据...`);
  } catch (error) {
    restoreLastView(error.message);
  }
}

async function handleLocate() {
  renderLoadingState('正在获取您的当前位置...');
  setStatus('正在获取您的当前位置...', 'info');

  try {
    const position = await getDeviceLocation();
    const latitude = Number(position.coords?.latitude ?? position.latitude);
    const longitude = Number(position.coords?.longitude ?? position.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('定位结果无效');
    }

    await applyCoordinates({ latitude, longitude, name: '当前位置' }, '正在根据当前位置加载天气数据...');
  } catch (error) {
    setStatus(`定位失败：${error.message}，继续显示当前地点天气。`, 'warning');
    await refreshForecast('正在加载当前地点天气数据...');
  }
}

function handleDayChange(event) {
  setState({ selectedDayIndex: Number(event.target.value) || 0 });
  persistCurrentWeatherCacheRecord();
  renderWeather(getState());
  syncDashboardArtifacts();
  setStatus('已切换日期。', 'info');
}

async function handleMapSelection({ lat, lon }) {
  await applyCoordinates({ latitude: lat, longitude: lon, name: '地图选点' }, '正在加载地图点位天气数据...');
}

function registerServiceWorker() {
  if (isNativeShell() || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service Worker 注册失败:', error);
    });
  });
}

function bindEvents() {
  getEl('searchButton')?.addEventListener('click', handleSearch);
  getEl('address')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  });
  getEl('locateButton')?.addEventListener('click', handleLocate);
  getEl('daySelector')?.addEventListener('change', handleDayChange);
}

function setupAndroidBridgeCallbacks() {
  window.onGeocodeResult = async (data, error) => {
    if (error) {
      restoreLastView(`地址查询失败：${error}`);
      return;
    }

    const results = normalizeGeocodeResults(data);
    if (!results.length) {
      restoreLastView('未找到地址。');
      return;
    }

    await applyCoordinates(results[0], `正在加载“${results[0].name || '目标地点'}”的天气数据...`);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  getElements();
  const savedPlaces = loadSavedPlaces();
  const weatherCache = loadWeatherCache();
  const observationReminders = loadObservationReminders();
  const lastWeatherRecord = getLastWeatherCacheRecord(weatherCache);
  setState({
    favoriteLocations: savedPlaces.favorites,
    recentLocations: savedPlaces.recents,
    observationReminders,
  });
  if (lastWeatherRecord) {
    applyWeatherCacheRecord(lastWeatherRecord);
  }
  setupAndroidBridgeCallbacks();
  setupSosModal();
  bindEvents();
  registerServiceWorker();

  try {
    initMap({
      lat: getState().lat,
      lon: getState().lon,
      onSelect: handleMapSelection,
    });
  } catch (error) {
    renderWeatherError(`地图加载失败：${error.message}`);
    setStatus(`地图加载失败：${error.message}`, 'error');
    return;
  }

  if (lastWeatherRecord) {
    updateMapPosition(getState().lat, getState().lon);
    setStatus(
      `已恢复上次可用天气数据（更新于 ${lastWeatherRecord.fetchedAt ? new Date(lastWeatherRecord.fetchedAt).toLocaleString('zh-CN') : '稍早前'}），正在尝试刷新。`,
      'info',
    );
  }

  triggerDueObservationReminders();
  await refreshForecast('正在加载默认天气数据...');
  dispatchAppEvent('cloudsea:app:ready', {
    bridge: await getBridgeInfo({ timeout: 0 }),
    locationName: getState().locationName,
    lat: getState().lat,
    lon: getState().lon,
  });
});
