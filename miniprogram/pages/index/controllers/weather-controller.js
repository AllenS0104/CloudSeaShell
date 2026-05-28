/**
 * Weather controller for the index page.
 *
 * Owns weather loading, weather rendering, day switching, retry, hourly/fusion
 * toggles, and multi-model fusion orchestration.
 */
function createWeatherController(deps) {
  const { getState, setState, services } = deps;
  const { api, analyzer, calc, favorites, fusion } = services;

  async function fetchAll(lat, lon) {
    setState({ loading: true, loadError: false, statusText: '正在获取海拔数据...', statusType: 'info' });

    try {
      const elevation = await api.fetchElevation(lat, lon);
      setState({ elevation, statusText: '正在获取天气数据...', statusType: 'info' });

      const weatherResponse = await api.fetchWeather(lat, lon);
      const { data: weatherData, fromCache } = weatherResponse;

      const dayLabels = analyzer.buildDayLabels(weatherData.hourly.time);

      setState({
        elevation,
        weatherData,
        dayLabels,
        markers: [{ id: 0, latitude: lat, longitude: lon, width: 28, height: 36, colorTag: 'selected-location' }],
        statusText: weatherResponse.offlineAge
          ? `离线模式：数据来自 ${weatherResponse.offlineAge} 分钟前（联网后自动更新）`
          : (fromCache ? '使用缓存数据（点击刷新获取最新）' : '天气数据已更新'),
        statusType: weatherResponse.offlineAge ? 'warning' : 'success',
      });

      services.loadNearbyWaypoints?.({ lat, lon, elevation });
      renderWeather();

      setState({ isFav: favorites.isFavorite(lat, lon) });

      fetchAirQualityAndRefresh(lat, lon);
      fetchFusion(lat, lon);
    } catch (err) {
      setState({
        loading: false,
        loadError: true,
        statusText: `加载失败：${err.message}`,
        statusType: 'warning',
      });
    }
  }

  async function fetchAirQualityAndRefresh(lat, lon) {
    if (!api || typeof api.fetchAirQuality !== 'function') return;
    try {
      const airQuality = await api.fetchAirQuality(lat, lon);
      if (!airQuality) return;
      const state = getState();
      if (state.lat !== lat || state.lon !== lon) return;
      setState({ airQuality });
      renderWeather();
    } catch (err) {
      /* swallow, non-blocking */
    }
  }

  function retry() {
    const state = getState();
    fetchAll(state.lat, state.lon);
  }

  function renderWeather() {
    const { weatherData, elevation, selectedDayIndex, lat, airQuality } = getState();
    if (!weatherData) return;

    const hourly = weatherData.hourly;

    const weatherResult = analyzer.analyzeWeather(weatherData, elevation, selectedDayIndex);
    const { analysis, dayAnalysis, guidance, currentTemp, currentDewGap, hourlyList, sunrise, sunset, current, start } = weatherResult;

    const timeString = current?.time || hourly.time[start];
    const photoParams = analyzer.buildPhotoParams(timeString, sunrise, sunset, analysis, elevation);

    const glowAnalysis = analyzer.analyzeGlow(hourly, start, sunrise, sunset, airQuality);

    const safetyAlerts = analyzer.buildSafetyAlerts(hourly, start, current, elevation);

    const starInfo = analyzer.analyzeStars(timeString, lat, analysis.cloudCover, analysis.visibility, analysis.humidity, elevation);

    const cloudScore = analysis.score || 0;
    const glowScore = glowAnalysis?.score || 0;
    const starScore = starInfo?.score || 0;

    let heroCard = null;
    if (cloudScore >= 70 && glowScore >= 60) {
      heroCard = { emoji: '🔥', text: '今日大片日！云海+晚霞双绝，必须出发', bgClass: 'hero-epic' };
    } else if (cloudScore >= 55) {
      heroCard = { emoji: '☁️', text: '云海有戏，建议守候', bgClass: 'hero-cloud' };
    } else if (glowScore >= 60) {
      heroCard = { emoji: '🌅', text: '晚霞概率较高，日落前到位', bgClass: 'hero-glow' };
    } else if (starScore >= 60) {
      heroCard = { emoji: '🌌', text: '今晚适合拍银河', bgClass: 'hero-star' };
    } else {
      heroCard = { emoji: '😴', text: '今天适合在家修图', bgClass: 'hero-rest' };
    }

    setState({
      loading: false,
      analysis: {
        cloudBase: analysis.cloudBase,
        score: analysis.score,
        suggestion: analysis.suggestion,
        resultText: analysis.resultText,
        summary: analysis.summary,
        reasons: analysis.reasons,
        confidenceLabel: analysis.confidenceLabel,
        confidenceLevel: analysis.confidenceLevel,
      },
      guidance: {
        goLevel: guidance.goLevel,
        goClass: guidance.goClass,
        recommendedWindow: guidance.recommendedWindow,
        daylightWindow: guidance.daylightWindow,
        viewpointAdvice: guidance.viewpointAdvice,
        actionItems: guidance.actionItems,
      },
      currentTemp,
      currentFeelsLike: current ? Number(current.apparent_temperature).toFixed(1) : (dayAnalysis.temperatures.length > 0 ? calc.minOrZero(dayAnalysis.temperatures).toFixed(1) : '--'),
      currentHumidity: current ? Math.round(Number(current.relative_humidity_2m)) : Math.round(calc.maxOrZero(dayAnalysis.humidities)),
      currentWind: current ? Number(current.wind_speed_10m).toFixed(1) : calc.maxOrZero(dayAnalysis.windSpeeds).toFixed(1),
      currentCloudCover: current ? Math.round(calc.getCurrentCloudCover(current)) : Math.round(calc.maxOrZero(dayAnalysis.cloudCover)),
      currentDewGap: currentDewGap.toFixed(1),
      hourlyList,
      photoParams,
      glowAnalysis,
      safetyAlerts,
      starInfo,
      heroCard,
    });

    services.autoSaveFeedback();
  }

  function handleDayChange(e) {
    const index = Number(e.detail.value);
    setState({ selectedDayIndex: index });
    renderWeather();
  }

  async function fetchFusion(lat, lon) {
    setState({ fusionLoading: true, fusionResult: null });

    try {
      const modelResults = await fusion.fetchMultiModelWeather(lat, lon);
      const result = fusion.fuseModelPredictions(modelResults, getState().elevation, getState().selectedDayIndex);

      if (result) {
        setState({ fusionResult: result, fusionLoading: false });
      } else {
        setState({ fusionLoading: false });
      }
    } catch (err) {
      console.warn('多模式融合失败:', err.message);
      setState({ fusionLoading: false });
    }
  }

  function toggleHourly() {
    setState({ showHourly: !getState().showHourly });
  }

  function toggleFusion() {
    setState({ showFusion: !getState().showFusion });
  }

  return {
    fetchAll,
    retry,
    renderWeather,
    handleDayChange,
    fetchFusion,
    toggleHourly,
    toggleFusion,
  };
}

module.exports = { createWeatherController };
