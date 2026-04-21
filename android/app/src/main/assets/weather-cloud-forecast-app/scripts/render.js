import {
  analyzeCurrentCloudSea,
  analyzeDayCloudSea,
  buildObservationGuidance,
  cloudBaseFromHumidity,
  dewPointSpread,
  formatCoords,
  formatDistanceKm,
  getCurrentCloudCover,
  getCurrentLowCloudCover,
  maxOrZero,
  minOrZero,
  pickBackgroundImage,
  windDirection,
} from './calculations.js';
import { clearElement, createElement, getEl } from './dom.js';

function createSectionHeading(eyebrow, title) {
  return createElement('div', {
    className: 'section-heading',
    children: [
      createElement('div', { className: 'section-eyebrow', text: eyebrow }),
      createElement('div', { className: 'section-title', text: title }),
    ],
  });
}

function formatUpdatedAt(timeString) {
  if (!timeString) {
    return '刚刚';
  }

  const value = new Date(timeString);
  if (Number.isNaN(value.getTime())) {
    return '刚刚';
  }

  return value.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function createMetaBar(state) {
  const isFavorite = state.favoriteLocations.some((item) => item.name === state.locationName && item.lat === state.lat && item.lon === state.lon);
  const activeReminder = state.observationReminders.find((item) => item.status === 'scheduled'
    && item.location.lat === state.lat
    && item.location.lon === state.lon);
  const cacheStatusText = state.weatherDataMode === 'cached'
    ? `状态 · ${state.weatherCacheAgeLevel === 'stale' ? '数据较旧' : '上次可用'}`
    : null;
  return createElement('section', {
    className: 'ops-bar',
    children: [
      createElement('div', {
        className: 'ops-meta',
        children: [
          createElement('span', { className: 'ops-chip', text: `数据源 · ${state.weatherSourceLabel || 'Open-Meteo'}` }),
          createElement('span', { className: 'ops-chip', text: `更新于 · ${formatUpdatedAt(state.lastUpdatedAt)}` }),
          cacheStatusText ? createElement('span', { className: 'ops-chip', text: cacheStatusText }) : null,
          createElement('span', { className: 'ops-chip', text: `模型 · ${state.modelVersion || 'CloudSea Model'}` }),
        ].filter(Boolean),
      }),
      createElement('button', {
        className: 'ops-action-button',
        text: '分享观测简报',
        attrs: { id: 'copy-brief-btn', type: 'button' },
      }),
      createElement('button', {
        className: 'ops-action-button secondary',
        text: '生成分享海报',
        attrs: { id: 'download-poster-btn', type: 'button' },
      }),
      createElement('button', {
        className: 'ops-action-button tertiary',
        text: '打开外部地图',
        attrs: { id: 'open-map-btn', type: 'button' },
      }),
      createElement('button', {
        className: `ops-action-button quaternary ${isFavorite ? 'active' : ''}`,
        text: isFavorite ? '取消收藏点位' : '收藏当前点位',
        attrs: { id: 'favorite-toggle-btn', type: 'button' },
      }),
      createElement('button', {
        className: `ops-action-button secondary ${activeReminder ? 'active' : ''}`,
        text: activeReminder ? '已设观测提醒' : '设观测提醒',
        attrs: { id: 'observation-reminder-btn', type: 'button' },
      }),
    ],
  });
}

function createPlaceButton(place, variant) {
  return createElement('button', {
    className: `saved-place-button ${variant}`,
    text: place.name,
    attrs: {
      type: 'button',
    },
    dataset: {
      lat: String(place.lat),
      lon: String(place.lon),
      name: place.name,
    },
  });
}

function createSavedPlacesSection(state) {
  const favoriteButtons = state.favoriteLocations.map((place) => createPlaceButton(place, 'favorite'));
  const recentButtons = state.recentLocations.map((place) => createPlaceButton(place, 'recent'));

  return createElement('section', {
    className: 'saved-places-card',
    children: [
      createElement('div', { className: 'saved-places-title', text: '常用地点' }),
      createElement('div', {
        className: 'saved-places-group',
        children: [
          createElement('div', { className: 'saved-places-label', text: '收藏地点' }),
          favoriteButtons.length
            ? createElement('div', { className: 'saved-places-list', children: favoriteButtons })
            : createElement('div', { className: 'saved-places-empty', text: '收藏后可一键回到常用观测点。' }),
        ],
      }),
      createElement('div', {
        className: 'saved-places-group',
        children: [
          createElement('div', { className: 'saved-places-label', text: '最近查看' }),
          recentButtons.length
            ? createElement('div', { className: 'saved-places-list', children: recentButtons })
            : createElement('div', { className: 'saved-places-empty', text: '最近访问的地点会显示在这里。' }),
        ],
      }),
    ],
  });
}

function createStatCard(icon, label, value) {
  return createElement('div', {
    className: 'stat-card',
    children: [
      createElement('span', { className: 'icon-badge', text: icon }),
      createElement('div', {
        children: [
          createElement('div', { className: 'label', text: label }),
          createElement('div', { className: 'value', text: value }),
        ],
      }),
    ],
  });
}

function createForecastCard(title, result, positive) {
  return createElement('section', {
    className: `forecast-card ${positive ? 'positive' : 'negative'}`,
    children: [
      createElement('div', { className: 'title', text: title }),
      createElement('div', { className: 'result', text: result }),
    ],
  });
}

function createForecastDetails(analysis, bestTimeLabel) {
  return createElement('section', {
    className: 'forecast-details',
    children: [
      createElement('div', {
        className: 'forecast-badges',
        children: [
          createElement('span', {
            className: `confidence-chip confidence-${analysis.confidenceLevel}`,
            text: `${analysis.confidenceLabel} · ${analysis.score} 分`,
          }),
          bestTimeLabel
            ? createElement('span', {
              className: 'confidence-chip confidence-time',
              text: `推荐时段 ${bestTimeLabel}`,
            })
            : null,
        ].filter(Boolean),
      }),
      createElement('div', {
        className: 'forecast-summary',
        text: analysis.summary,
      }),
      createElement('ul', {
        className: 'forecast-reasons',
        children: analysis.reasons.map((reason) => createElement('li', { text: reason })),
      }),
      createElement('div', {
        className: 'forecast-disclaimer',
        text: '⚠️ 预测仅供参考，基于数值天气模式估算，实际云海受微地形、局地气流等因素影响，请结合现场条件判断。',
      }),
    ],
  });
}

function createGuidanceCard(guidance) {
  return createElement('section', {
    className: `guidance-card guidance-${guidance.goClass}`,
    children: [
      createElement('div', { className: 'guidance-title', text: '观测行动建议' }),
      createElement('div', { className: 'guidance-level', text: guidance.goLevel }),
      createElement('div', { className: 'guidance-grid',
        children: [
          createElement('div', {
            className: 'guidance-item',
            children: [
              createElement('div', { className: 'guidance-label', text: '推荐时段' }),
              createElement('div', { className: 'guidance-value', text: guidance.recommendedWindow }),
            ],
          }),
          createElement('div', {
            className: 'guidance-item',
            children: [
              createElement('div', { className: 'guidance-label', text: '建议海拔' }),
              createElement('div', { className: 'guidance-value', text: `${guidance.targetElevation} m` }),
            ],
          }),
          createElement('div', {
            className: 'guidance-item',
            children: [
              createElement('div', { className: 'guidance-label', text: '日照窗口' }),
              createElement('div', { className: 'guidance-value', text: guidance.daylightWindow }),
            ],
          }),
        ],
      }),
      createElement('div', {
        className: 'guidance-summary',
        text: guidance.viewpointAdvice,
      }),
      createElement('ul', {
        className: 'guidance-list',
        children: guidance.actionItems.map((item) => createElement('li', { text: item })),
      }),
    ],
  });
}

function renderMessage(target, message, className) {
  const element = clearElement(target);
  element?.append(createElement('div', { className, text: message }));
}

function currentLocationLabel(state) {
  const coords = formatCoords(state.lat, state.lon);
  return state.locationName ? `当前 · ${state.locationName} (${coords})` : `当前 · ${coords}`;
}

function dailyLocationLabel(state, sunrise) {
  const dateText = sunrise
    ? new Date(sunrise).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
    : '未来天气';
  const coords = formatCoords(state.lat, state.lon);
  return state.locationName ? `${dateText} · ${state.locationName} (${coords})` : `${dateText} · ${coords}`;
}

function renderCurrentDashboard(state, current, daily) {
  const dashboard = clearElement(getEl('weatherDashboard'));
  const analysis = analyzeCurrentCloudSea(current, state.elevation);
  const currentCloudCover = getCurrentCloudCover(current);
  const currentLowCloudCover = getCurrentLowCloudCover(current);
  const currentDewGap = dewPointSpread(current?.temperature_2m, current?.dew_point_2m);
  const guidance = buildObservationGuidance({
    analysis,
    currentElevation: state.elevation,
    sunriseTime: daily?.sunrise?.[0],
    sunsetTime: daily?.sunset?.[0],
  });

  dashboard.append(
    createMetaBar(state),
    createSavedPlacesSection(state),
    createElement('div', {
      className: 'weather-main',
      children: [
        createElement('div', {
          className: 'temp',
          text: `${Number(current.temperature_2m ?? 0).toFixed(1)}°`,
        }),
        createElement('div', {
          className: 'location',
          text: currentLocationLabel(state),
        }),
      ],
    }),
    createElement('section', {
      className: 'weather-stats-grid',
      children: [
        createStatCard('💧', '湿度', `${Number(current.relative_humidity_2m ?? 0).toFixed(0)}%`),
        createStatCard('☁️', '云量', `${currentCloudCover.toFixed(0)}%`),
        createStatCard('🌁', '低层云量', `${currentLowCloudCover.toFixed(0)}%`),
        createStatCard('🌬️', '风速', `${Number(current.wind_speed_10m ?? 0).toFixed(1)} m/s · ${windDirection(Number(current.wind_direction_10m ?? 0))}`),
        createStatCard('👁️', '能见度', formatDistanceKm(Number(current.visibility ?? 0))),
        createStatCard('⛰️', '海拔', `${Math.round(state.elevation)} m`),
        createStatCard('🌫️', '云底高度', `${analysis.cloudBase} m`),
        createStatCard('💧', '露点差', `${currentDewGap.toFixed(1)}°C`),
        createStatCard('🧭', '气压', `${Math.round(Number(current.pressure_msl ?? 0))} hPa`),
      ],
    }),
    createSectionHeading('Forecast Assessment', '云海判断'),
    createForecastCard('今日云海预测', analysis.resultText, analysis.suggestion),
    createForecastDetails(analysis),
    createSectionHeading('Action Guidance', '观测行动建议'),
    createGuidanceCard(guidance),
  );
}

function renderDailyDashboard(state, hourly, daily) {
  const dashboard = clearElement(getEl('weatherDashboard'));
  const start = state.selectedDayIndex * 24;
  const analysis = analyzeDayCloudSea(hourly, start, state.elevation);
  const sunrise = daily?.sunrise?.[state.selectedDayIndex];
  const sunset = daily?.sunset?.[state.selectedDayIndex];
  const guidance = buildObservationGuidance({
    analysis: analysis.bestHour ?? analysis,
    currentElevation: state.elevation,
    sunriseTime: sunrise,
    sunsetTime: sunset,
    bestTimeLabel: analysis.bestHour?.timeLabel,
  });

  dashboard.append(
    createMetaBar(state),
    createSavedPlacesSection(state),
    createElement('div', {
      className: 'weather-main',
      children: [
        createElement('div', {
          className: 'temp',
          children: [
            document.createTextNode(`${maxOrZero(analysis.temperatures).toFixed(1)}°`),
            createElement('span', {
              className: 'temp-sub',
              text: `/${minOrZero(analysis.temperatures).toFixed(1)}°`,
            }),
          ],
        }),
        createElement('div', {
          className: 'location',
          text: dailyLocationLabel(state, sunrise),
        }),
      ],
    }),
    createElement('section', {
      className: 'weather-stats-grid',
      children: [
        createStatCard('💧', '湿度', `${minOrZero(analysis.humidities).toFixed(0)}-${maxOrZero(analysis.humidities).toFixed(0)}%`),
        createStatCard('☁️', '云量', `${minOrZero(analysis.cloudCover).toFixed(0)}-${maxOrZero(analysis.cloudCover).toFixed(0)}%`),
        createStatCard('🌁', '低层云量', `${minOrZero(analysis.lowCloudCover).toFixed(0)}-${maxOrZero(analysis.lowCloudCover).toFixed(0)}%`),
        createStatCard('🌫️', '云底高度', `${minOrZero(analysis.cloudBases)}-${maxOrZero(analysis.cloudBases)} m`),
        createStatCard('👁️', '能见度', `${(minOrZero(analysis.visibilities) / 1000).toFixed(1)}-${(maxOrZero(analysis.visibilities) / 1000).toFixed(1)} km`),
        createStatCard('💦', '降水概率', `${minOrZero(analysis.precipitationProbabilities).toFixed(0)}-${maxOrZero(analysis.precipitationProbabilities).toFixed(0)}%`),
        createStatCard('💧', '露点差', `${minOrZero(analysis.temperatures.map((temperature, index) => dewPointSpread(temperature, analysis.dewPoints[index]))).toFixed(1)}-${maxOrZero(analysis.temperatures.map((temperature, index) => dewPointSpread(temperature, analysis.dewPoints[index]))).toFixed(1)}°C`),
        createStatCard('🌅', '日出', sunrise ? sunrise.slice(11) : '--:--'),
        createStatCard('🌇', '日落', sunset ? sunset.slice(11) : '--:--'),
      ],
    }),
    createSectionHeading('Forecast Assessment', '云海判断'),
    createForecastCard('全天云海预测', analysis.resultText, analysis.suggestion),
    createForecastDetails(analysis, analysis.bestHour?.timeLabel),
    createSectionHeading('Action Guidance', '观测行动建议'),
    createGuidanceCard(guidance),
  );
}

function renderHourlyForecast(hourly, start) {
  const list = clearElement(getEl('hourlyForecastList'));
  let appended = false;

  for (let index = 0; index < 24; index += 1) {
    const hourIndex = start + index;
    if (hourIndex >= hourly.time.length) {
      break;
    }

    appended = true;
    const timeLabel = new Date(hourly.time[hourIndex]).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const temperature = Number(hourly.temperature_2m?.[hourIndex] ?? 0);
    const humidity = Number(hourly.relative_humidity_2m?.[hourIndex] ?? 0);
    const cloudBase = cloudBaseFromHumidity(temperature, humidity);
    const precipitationProbability = Number(hourly.precipitation_probability?.[hourIndex] ?? 0);

    list.append(
      createElement('div', {
        className: 'hour-item',
        children: [
          createElement('div', { className: 'time', text: timeLabel }),
          createElement('div', { className: 'stat', text: `🌡️ ${temperature.toFixed(1)}°C` }),
          createElement('div', { className: 'stat', text: `🌫️ ${cloudBase} m` }),
          createElement('div', { className: 'stat', text: `💦 ${precipitationProbability}%` }),
        ],
      }),
    );
  }

  if (!appended) {
    renderMessage(list, '暂无逐小时数据', 'empty-state');
  }
}

export function renderDateSelector(hourlyTime, selectedDayIndex = 0) {
  const selector = clearElement(getEl('daySelector'));
  const uniqueDays = [...new Set(hourlyTime.map((time) => time.split('T')[0]))].slice(0, 7);

  uniqueDays.forEach((day, index) => {
    const option = createElement('option', {
      text: new Date(day).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }),
      attrs: { value: String(index) },
      dataset: { day },
    });
    if (index === 0) {
      option.textContent += ' (今天)';
    }
    selector.append(option);
  });

  selector.value = String(selectedDayIndex);
}

export function renderLoadingState(message) {
  renderMessage(getEl('weatherDashboard'), message, 'loading');
  renderMessage(getEl('hourlyForecastList'), '正在等待逐小时数据...', 'loading');
}

export function renderWeatherError(message) {
  renderMessage(getEl('weatherDashboard'), message, 'error-message');
  renderMessage(getEl('hourlyForecastList'), '暂无逐小时数据', 'empty-state');
}

export function renderWeather(state) {
  const data = state.weatherData;
  if (!data?.hourly?.time?.length) {
    renderWeatherError('暂无天气数据');
    return;
  }

  const start = state.selectedDayIndex * 24;
  const background = pickBackgroundImage(data.hourly.time[start] ?? data.hourly.time[0]);
  document.body.style.backgroundImage = `url("${background}")`;

  if (state.selectedDayIndex === 0 && data.current) {
    renderCurrentDashboard(state, data.current, data.daily);
  } else {
    renderDailyDashboard(state, data.hourly, data.daily);
  }

  renderHourlyForecast(data.hourly, start);
}
