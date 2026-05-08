/* global wx */
const subscribeMessage = require('../../../utils/subscribe-message');

const localTimers = {};

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolveFireAt(state, calc) {
  const hourly = state.weatherData && state.weatherData.hourly;
  if (hourly && Array.isArray(hourly.time)) {
    const dayStart = (Number(state.selectedDayIndex) || 0) * 24;
    const dayAnalysis = calc.analyzeDayCloudSea(
      hourly,
      dayStart,
      Number(state.elevation) || 0,
      state.weatherData.daily && state.weatherData.daily.sunrise && state.weatherData.daily.sunrise[state.selectedDayIndex],
    );
    const bestLabel = dayAnalysis.bestHour && dayAnalysis.bestHour.timeLabel;
    const best = bestLabel && hourly.time.slice(dayStart, dayStart + 24).find(time => time.slice(11, 16) === bestLabel);
    if (best) return best;
  }

  const fallback = new Date(Date.now() + 60 * 60 * 1000);
  return fallback.toISOString();
}

function scheduleLocalFallback(item) {
  if (!item || !item.id) return;
  if (localTimers[item.id]) clearTimeout(localTimers[item.id]);
  const delay = new Date(item.fireAt).getTime() - Date.now();
  if (delay <= 0) return;
  localTimers[item.id] = setTimeout(() => {
    delete localTimers[item.id];
    if (typeof wx !== 'undefined' && typeof wx.showModal === 'function') {
      wx.showModal({
        title: '云海观测提醒',
        content: `${item.locationName || '当前地点'} 已到观测提醒时间。`,
        showCancel: false,
      });
    }
  }, Math.min(delay, 2147483647));
}

function buildSubscribeData(state, fireAt) {
  const score = state.analysis && Number(state.analysis.score || 0);
  const reason = Number.isFinite(score) && score > 0
    ? `云海预测 ${score} 分，建议关注观测窗口`
    : '建议关注云海观测窗口';
  return {
    thing1: { value: `观测地点：${state.locationName || '当前地点'}` },
    time2: { value: formatDateTime(fireAt) },
    thing3: { value: reason },
  };
}

function createNotificationController(deps) {
  const { getState, services } = deps;
  const { calc } = services;

  async function enableObservationReminder(statePatch) {
    const state = statePatch || getState();
    const auth = await subscribeMessage.requestObservationReminderAuth();
    if (!auth.authorized) {
      wx.showToast({ title: '未获得订阅授权', icon: 'none' });
      return { authorized: false, auth };
    }

    const fireAt = resolveFireAt(state, calc);
    const scheduled = subscribeMessage.scheduleSubscribeMessage({
      templateKey: 'observationReminder',
      fireAt,
      locationName: state.locationName,
      data: buildSubscribeData(state, fireAt),
    });

    if (scheduled === 'expired') {
      wx.showToast({ title: '提醒时间已过期', icon: 'none' });
      return { authorized: true, status: 'expired' };
    }

    scheduleLocalFallback(scheduled);
    wx.showToast({ title: '提醒已开启', icon: 'success' });
    return { authorized: true, scheduled };
  }

  function flushDueSubscribeMessages() {
    return subscribeMessage.flushDueSubscribeMessages();
  }

  return {
    enableObservationReminder,
    flushDueSubscribeMessages,
  };
}

module.exports = { createNotificationController };
