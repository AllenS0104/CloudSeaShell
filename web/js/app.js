/**
 * app.js — PWA main controller for 云海观测决策台
 * Mirrors miniprogram/pages/index/index.js control flow.
 */
(function(global) {
  'use strict';

  var CS = global.CloudSea;
  var calc = CS.calc;
  var analyzer = CS.analyzer;
  var api = CS.services;
  var presets = CS.presets;
  var fusionMod = CS.fusion;
  var feedbackMod = CS.feedback;
  var historyMod = CS.searchHistory;
  var favMod = CS.favorites;
  var waypointMod = CS.waypoints;
  var posterRenderer = CS.posterRenderer;

  var DEFAULT_ELEVATION = 300;

  // ===== Application state =====
  var state = {
    lat: 39.9042,
    lon: 116.4074,
    elevation: DEFAULT_ELEVATION,
    locationName: '北京',
    selectedDayIndex: 0,
    weatherData: null,
    dayLabels: [],
    analysis: null,
    guidance: null,
    glowAnalysis: null,
    starInfo: null,
    heroCard: null,
    photoParams: null,
    safetyAlerts: [],
    hourlyList: [],
    currentTemp: '--',
    currentFeelsLike: '--',
    currentHumidity: '--',
    currentWind: '--',
    currentCloudCover: '--',
    currentDewGap: '--',
    loading: true,
    loadError: false,
    // Fusion
    fusionResult: null,
    fusionLoading: false,
    // Collapse toggles
    showHourly: false,
    showFusion: false,
    // Feedback
    currentFeedback: null,
    fbCloudSea: null,
    fbGlow: null,
    fbStars: null,
    fbRating: null,
    fbNote: '',
    // Device selection
    selectedCamera: '',
    selectedPhone: '',
    cameraRec: null,
    phoneRec: null,
    // Waypoint recommendations
    nearbyWaypoints: [],
    selectedWaypoint: null,
    primaryDirection: null,
    lightPollution: null,
  };

  // ===== DOM helpers =====
  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text; }
  function setHTML(id, html) { var el = $(id); if (el) el.innerHTML = html; }
  function show(id) { var el = $(id); if (el) el.classList.remove('hidden'); }
  function hide(id) { var el = $(id); if (el) el.classList.add('hidden'); }
  function toggle(id, visible) { visible ? show(id) : hide(id); }

  // ===== Initialization =====
  function init() {
    bindEvents();
    initMap();
    renderSearchHistory();
    renderFavorites();
    autoLocate();
  }

  function initMap() {
    if (!CS.map || typeof CS.map.init !== 'function') return;
    CS.map.init({ lat: state.lat, lon: state.lon, zoom: 9 });
    CS.map.onSelect(onMapTap);
  }

  function refreshMapLayout() {
    if (!CS.map || typeof CS.map.invalidateSize !== 'function') return;
    [0, 120, 350, 800].forEach(function(delay) {
      setTimeout(function() {
        CS.map.invalidateSize();
      }, delay);
    });
  }

  function onMapTap(point) {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return;
    var hint = $('map-hint');
    if (hint) hint.classList.add('fade');
    state.lat = point.lat;
    state.lon = point.lon;
    state.locationName = '坐标 ' + point.lat.toFixed(4) + ', ' + point.lon.toFixed(4);
    showLoading();
    enrichLocationName(point.lat, point.lon);
    fetchAll(point.lat, point.lon).catch(function(err) {
      console.warn('[map] fetch after tap failed', err && err.message);
    });
  }

  function enrichLocationName(lat, lon) {
    if (!api || typeof api.reverseGeocode !== 'function') return Promise.resolve(null);
    return api.reverseGeocode(lat, lon).then(function(place) {
      if (!place || !place.display) return null;
      if (state.lat !== lat || state.lon !== lon) return place;
      var coords = lat.toFixed(4) + ', ' + lon.toFixed(4);
      var alreadyHasPlace = /\(.+\)$/.test(state.locationName || '');
      if (alreadyHasPlace && state.locationName.indexOf(place.display) >= 0) return place;
      var baseName = /^坐标 /.test(state.locationName || '') ? '坐标 ' + coords : (state.locationName || '');
      var nextName = baseName + ' (' + place.display + ')';
      state.locationName = nextName;
      state.locationPlace = place;
      setText('location-name', nextName);
      return place;
    }).catch(function() { return null; });
  }

  async function ensureLocationEnriched() {
    if (!state.lat || !state.lon) return;
    var name = state.locationName || '';
    var needsEnrich = /^坐标 /.test(name) && !/\(.+\)$/.test(name);
    if (!needsEnrich && state.locationPlace) return;
    if (!needsEnrich) return;
    try {
      await enrichLocationName(state.lat, state.lon);
    } catch (_) { /* ignore */ }
  }

  function bindEvents() {
    // Search
    $('btn-search').addEventListener('click', onSearch);
    $('search-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') onSearch();
    });
    // Locate
    $('btn-locate').addEventListener('click', onLocate);
    // Day selector
    $('day-selector').addEventListener('change', onDayChange);
    // Retry
    $('btn-retry').addEventListener('click', onRetry);
    // Hourly toggle
    $('hourly-toggle').addEventListener('click', onToggleHourly);
    // Fusion toggle
    $('fusion-toggle').addEventListener('click', onToggleFusion);
    // Favorite toggle
    $('btn-toggle-fav').addEventListener('click', onToggleFav);
    // SOS
    $('btn-sos').addEventListener('click', onSOS);
    $('btn-sos-bar').addEventListener('click', onSOS);
    // Bottom bar
    $('btn-open-photo').addEventListener('click', onOpenPhoto);
    $('btn-open-feedback').addEventListener('click', onOpenFeedback);
    $('btn-go-history').addEventListener('click', onGoHistory);
    $('btn-share').addEventListener('click', onShare);
    var posterBtn = $('btn-share-poster');
    if (posterBtn) posterBtn.addEventListener('click', onSharePoster);
    // Photo panel
    $('btn-close-photo').addEventListener('click', onClosePhoto);
    $('photo-overlay-mask').addEventListener('click', onClosePhoto);
    // Camera/phone selectors
    $('camera-selector').addEventListener('change', onSelectCamera);
    $('phone-selector').addEventListener('change', onSelectPhone);
    $('btn-clear-camera').addEventListener('click', onClearCamera);
    $('btn-clear-phone').addEventListener('click', onClearPhone);
    // Feedback panel
    $('btn-close-feedback').addEventListener('click', onCloseFeedback);
    $('feedback-overlay-mask').addEventListener('click', onCloseFeedback);
    $('btn-submit-feedback').addEventListener('click', onSubmitFeedback);
    $('btn-export-feedback').addEventListener('click', onExportFeedback);
    // Feedback toggles
    $('fb-toggle-cloud').addEventListener('click', onToggleCloudSea);
    $('fb-toggle-glow').addEventListener('click', onToggleGlow);
    $('fb-toggle-stars').addEventListener('click', onToggleStars);
    // Feedback rating
    document.querySelectorAll('#fb-rating-row .fb-star').forEach(function(star) {
      star.addEventListener('click', function() {
        var rating = Number(this.getAttribute('data-rating'));
        state.fbRating = (state.fbRating === rating) ? null : rating;
        renderFeedbackRating();
      });
    });
    // Feedback note
    $('fb-note').addEventListener('input', function() { state.fbNote = this.value; });
    // History page
    $('btn-go-home').addEventListener('click', function() { hide('page-history'); show('page-main'); });
    $('btn-back-home').addEventListener('click', function() { hide('page-history'); show('page-main'); });
    $('btn-export-csv').addEventListener('click', onExportFeedback);
  }

  // ===== Auto locate =====
  async function autoLocate() {
    showLoading();
    try {
      var pos = await api.getLocation();
      state.lat = pos.latitude;
      state.lon = pos.longitude;
      state.locationName = '当前位置';
      await fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      console.warn('自动定位失败，使用默认位置', err.message);
      await fetchAll(state.lat, state.lon);
    }
  }

  // ===== Search =====
  async function onSearch() {
    var address = ($('search-input').value || '').trim();
    if (!address) return;

    showStatus('正在搜索 ' + address + '...', 'info');
    showLoading();

    try {
      var results = await api.geocodeAddress(address);
      if (!results || results.length === 0) {
        showStatus('未找到该地点', 'warning');
        hideLoading();
        return;
      }

      if (results.length === 1) {
        pickLocation(results[0]);
      } else {
        // Multiple results — show a simple picker (first 6)
        var names = results.slice(0, 6).map(function(r) { return r.name; });
        var picked = prompt('找到多个地点，请输入序号选择：\n' + names.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n'));
        var idx = parseInt(picked, 10) - 1;
        if (idx >= 0 && idx < results.length) {
          pickLocation(results[idx]);
        } else {
          showStatus('已取消选择', 'info');
          hideLoading();
        }
      }
    } catch (err) {
      showStatus('搜索失败：' + err.message, 'warning');
      hideLoading();
    }
  }

  function pickLocation(r) {
    state.lat = r.latitude;
    state.lon = r.longitude;
    state.locationName = r.name;
    historyMod.addSearchHistory({ name: r.name, lat: r.latitude, lon: r.longitude });
    renderSearchHistory();
    fetchAll(r.latitude, r.longitude);
  }

  // ===== Locate =====
  async function onLocate() {
    showStatus('正在获取当前位置...', 'info');
    try {
      var pos = await api.getLocation();
      state.lat = pos.latitude;
      state.lon = pos.longitude;
      state.locationName = '当前位置';
      await fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      showStatus('定位失败：' + err.message, 'warning');
    }
  }

  // ===== Day change =====
  function onDayChange() {
    state.selectedDayIndex = Number($('day-selector').value);
    renderWeather();
  }

  // ===== Retry =====
  function onRetry() {
    fetchAll(state.lat, state.lon);
  }

  // ===== Core data pipeline =====
  async function fetchAll(lat, lon) {
    state.loading = true;
    state.loadError = false;
    showLoading();
    hide('error-state');
    hide('main-content');
    showStatus('正在获取海拔数据...', 'info');
    if (state.locationName === '当前位置' || /^坐标 /.test(state.locationName || '')) {
      enrichLocationName(lat, lon);
    }

    try {
      var elevation = await api.fetchElevation(lat, lon);
      state.elevation = elevation;
      showStatus('正在获取天气数据...', 'info');

      var weatherResponse = await api.fetchWeather(lat, lon);
      var weatherData = weatherResponse.data;
      var fromCache = weatherResponse.fromCache;

      state.weatherData = weatherData;
      state.dayLabels = analyzer.buildDayLabels(weatherData.hourly.time);
      loadNearbyWaypoints(lat, lon, elevation);

      // Build day selector options
      buildDaySelector(state.dayLabels);

      // Status message
      if (weatherResponse.offlineAge) {
        showStatus('离线模式：数据来自 ' + weatherResponse.offlineAge + ' 分钟前（联网后自动更新）', 'warning');
      } else if (fromCache) {
        showStatus('使用缓存数据（点击刷新获取最新）', 'success');
      } else {
        showStatus('天气数据已更新', 'success');
      }

      // Fire-and-forget air-quality fetch — re-render glow when ready
      fetchAirQualityAndRefresh(lat, lon);

      renderWeather();

      // Update fav state
      updateFavIcon();

      // Background: multi-model fusion (non-blocking)
      fetchFusion(lat, lon);
    } catch (err) {
      state.loading = false;
      state.loadError = true;
      hideLoading();
      hide('main-content');
      show('error-state');
      setText('error-hint', err.message);
      showStatus('加载失败：' + err.message, 'warning');
    }
  }

  function buildDaySelector(dayLabels) {
    var sel = $('day-selector');
    sel.innerHTML = '';
    dayLabels.forEach(function(label, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    sel.value = state.selectedDayIndex;
  }

  // ===== Render weather =====
  function renderWeather() {
    var weatherData = state.weatherData;
    if (!weatherData) return;

    var hourly = weatherData.hourly;
    var elevation = state.elevation;
    var selectedDayIndex = state.selectedDayIndex;

    // Core analysis
    var weatherResult = analyzer.analyzeWeather(weatherData, elevation, selectedDayIndex);
    var analysis = weatherResult.analysis;
    var dayAnalysis = weatherResult.dayAnalysis;
    var guidance = weatherResult.guidance;
    var currentTemp = weatherResult.currentTemp;
    var currentDewGap = weatherResult.currentDewGap;
    var hourlyList = weatherResult.hourlyList;
    var sunrise = weatherResult.sunrise;
    var sunset = weatherResult.sunset;
    var current = weatherResult.current;
    var start = weatherResult.start;

    // Photography
    var timeString = current?.time || hourly.time[start];
    var photoParams = analyzer.buildPhotoParams(timeString, sunrise, sunset, analysis, elevation);

    // Sunset glow
    var glowAnalysis = analyzer.analyzeGlow(hourly, start, sunrise, sunset, state.airQuality);

    // Safety
    var safetyAlerts = analyzer.buildSafetyAlerts(hourly, start, current, elevation);

    // Stargazing
    var starInfo = analyzer.analyzeStars(timeString, state.lat, analysis.cloudCover, analysis.visibility, analysis.humidity, elevation);

    // Hero Card
    var cloudScore = analysis.score || 0;
    var glowScore = glowAnalysis?.score || 0;
    var starScore = starInfo?.score || 0;

    var heroCard = null;
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

    // Save state
    state.analysis = analysis;
    state.guidance = guidance;
    state.photoParams = photoParams;
    state.glowAnalysis = glowAnalysis;
    state.safetyAlerts = safetyAlerts;
    state.starInfo = starInfo;
    state.heroCard = heroCard;
    state.hourlyList = hourlyList;
    state.currentTemp = currentTemp;
    state.currentFeelsLike = current
      ? Number(current.apparent_temperature).toFixed(1)
      : (dayAnalysis.temperatures.length > 0 ? calc.minOrZero(dayAnalysis.temperatures).toFixed(1) : '--');
    state.currentHumidity = current
      ? Math.round(Number(current.relative_humidity_2m))
      : Math.round(calc.maxOrZero(dayAnalysis.humidities));
    state.currentWind = current
      ? Number(current.wind_speed_10m).toFixed(1)
      : calc.maxOrZero(dayAnalysis.windSpeeds).toFixed(1);
    state.currentCloudCover = current
      ? Math.round(calc.getCurrentCloudCover(current))
      : Math.round(calc.maxOrZero(dayAnalysis.cloudCover));
    state.currentDewGap = currentDewGap.toFixed(1);
    state.loading = false;

    // === Update DOM ===
    hideLoading();
    hide('error-state');
    show('main-content');
    refreshMapLayout();

    // Hero card
    if (heroCard) {
      show('hero-card');
      setText('hero-emoji', heroCard.emoji);
      setText('hero-text', heroCard.text);
      var hc = $('hero-card');
      hc.className = 'hero-card ' + heroCard.bgClass;
    } else {
      hide('hero-card');
    }

    // Map
    if (CS.map && typeof CS.map.setLocation === 'function') {
      CS.map.setLocation(state.lat, state.lon);
      var popup = '<strong>' + esc(state.locationName || '观测点')
        + '</strong><br>云海 ' + (state.analysis && state.analysis.score != null ? state.analysis.score + '分' : '--')
        + (state.glowAnalysis && state.glowAnalysis.score != null ? ' · 晚霞 ' + state.glowAnalysis.score + '分' : '')
        + (state.starInfo && state.starInfo.score != null ? ' · 星空 ' + state.starInfo.score + '分' : '');
      CS.map.setMarkerPopup(popup);
      refreshMapLayout();
    }

    // Weather main
    setText('current-temp', state.currentTemp);
    setText('current-feels-like', state.currentFeelsLike);
    setText('location-name', state.locationName);

    // Stats
    setText('stat-humidity', state.currentHumidity + '%');
    setText('stat-wind', state.currentWind + ' m/s');
    setText('stat-cloud', state.currentCloudCover + '%');
    setText('stat-elevation', state.elevation + ' m');
    setText('stat-cloud-base', (analysis.cloudBase != null ? Math.round(analysis.cloudBase) : '--') + ' m');
    setText('stat-dew-gap', state.currentDewGap + '°C');

    // Forecast
    setText('forecast-day-label', state.dayLabels[selectedDayIndex] ? state.dayLabels[selectedDayIndex] + ' 云海预测' : '今日云海预测');
    setText('forecast-result', analysis.resultText || '--');
    setText('forecast-summary', analysis.summary || '');
    renderReasons('forecast-reasons', analysis.reasons);

    // Glow section
    if (glowAnalysis && glowAnalysis.score != null) {
      show('glow-section');
      setText('glow-result', glowAnalysis.label || (glowAnalysis.score + ' 分'));
      setText('glow-summary', glowAnalysis.summary || '');
      renderReasons('glow-reasons', glowAnalysis.reasons);
      renderGlowStats(glowAnalysis);
    } else {
      hide('glow-section');
    }

    // Star section
    if (starInfo && starInfo.score != null) {
      show('star-section');
      setText('star-result', starInfo.label || (starInfo.score + ' 分'));
      renderReasons('star-reasons', starInfo.reasons);
      renderStarStats(starInfo);
      renderAstroParams(starInfo);
    } else {
      hide('star-section');
    }

    // Safety alerts
    renderSafetyAlerts(safetyAlerts);

    // Guidance
    if (guidance && guidance.goLevel) {
      show('guidance-section');
      setText('guidance-level', guidance.goLevel);
      renderGuidanceGrid(guidance);
      renderReasons('guidance-actions', guidance.actionItems);
    } else {
      hide('guidance-section');
    }

    // Hourly
    renderHourlyList(hourlyList);

    // Waypoints
    renderNearbyWaypoints();

    // Auto-save feedback
    autoSaveFeedback();
  }

  function loadNearbyWaypoints(lat, lon, elevation) {
    if (!waypointMod) return;
    state.nearbyWaypoints = waypointMod.findNearbyWaypoints({ lat: lat, lng: lon, radiusKm: 80 }).map(function(item) {
      var direction = item.suggestedDirection != null ? {
        label: waypointMod.getDirectionLabel(item.suggestedDirection),
        deg: item.suggestedDirection,
        compassSvgDataUri: waypointMod.getCompassSvgDataUri(item.suggestedDirection),
      } : null;
      var bestForLabels = waypointMod.getBestForLabels(item.bestFor);
      var lightPollution = waypointMod.getLightPollutionLabelForWaypoint(item);
      return Object.assign({}, item, {
        direction: direction,
        directionText: direction ? direction.label + ' (' + direction.deg + '°)' : '未知',
        bestForLabels: bestForLabels,
        bestForText: bestForLabels.join(' / '),
        lightPollution: lightPollution,
      });
    });
    state.selectedWaypoint = state.nearbyWaypoints[0] || null;
    state.primaryDirection = state.selectedWaypoint ? state.selectedWaypoint.direction : null;
    state.lightPollution = state.selectedWaypoint
      ? state.selectedWaypoint.lightPollution
      : waypointMod.getLightPollutionLabelForWaypoint({ elevation: elevation, distanceKm: 30 });
  }

  function renderNearbyWaypoints() {
    var card = $('nearby-waypoints-card');
    var listEl = $('nearby-waypoints-list');
    if (!card || !listEl || !waypointMod) return;

    if (!state.nearbyWaypoints.length) {
      hide('nearby-waypoints-card');
      return;
    }

    show('nearby-waypoints-card');
    renderSelectedDirection();
    listEl.innerHTML = state.nearbyWaypoints.map(function(item, index) {
      var tags = item.bestForLabels.map(function(label) {
        return '<span class="waypoint-tag">' + esc(label) + '</span>';
      }).join('') + '<span class="waypoint-tag waypoint-tag-night">' + esc(item.lightPollution.label) + '</span>';
      var navUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.lat + ',' + item.lng);
      return '<div class="waypoint-item" data-waypoint-index="' + index + '">'
        + '<div class="waypoint-main"><div class="waypoint-name">📸 ' + esc(item.name) + '</div>'
        + '<div class="waypoint-meta">' + esc(item.elevation + 'm · ' + item.distanceKm + 'km · 建议拍摄方向: ' + item.directionText) + '</div>'
        + '<div class="waypoint-tags">' + tags + '</div>'
        + '<div class="waypoint-notes">' + esc(item.notes || '') + '</div></div>'
        + '<a class="cs-pill-button waypoint-nav-link" href="' + navUrl + '" target="_blank" rel="noopener">导航</a>'
        + '</div>';
    }).join('');

    Array.prototype.forEach.call(listEl.querySelectorAll('.waypoint-item'), function(el) {
      el.addEventListener('click', function(event) {
        if (event.target && event.target.tagName === 'A') return;
        var index = Number(el.getAttribute('data-waypoint-index'));
        state.selectedWaypoint = state.nearbyWaypoints[index];
        state.primaryDirection = state.selectedWaypoint ? state.selectedWaypoint.direction : null;
        state.lightPollution = state.selectedWaypoint ? state.selectedWaypoint.lightPollution : state.lightPollution;
        renderSelectedDirection();
        renderStarStats(state.starInfo);
      });
    });
  }

  function renderSelectedDirection() {
    var el = $('selected-direction');
    if (!el) return;
    if (!state.primaryDirection) {
      hide('selected-direction');
      return;
    }
    show('selected-direction');
    el.innerHTML = '<img class="waypoint-compass" alt="" src="' + state.primaryDirection.compassSvgDataUri + '">'
      + '<span>建议拍摄方向: ' + esc(state.primaryDirection.label) + ' (' + esc(state.primaryDirection.deg) + '°)</span>';
  }

  // ===== Render helpers =====

  function renderReasons(id, reasons) {
    if (!reasons || !reasons.length) { setHTML(id, ''); return; }
    var html = reasons.map(function(r) {
      if (typeof r === 'string') return '<div class="reason-item">' + esc(r) + '</div>';
      var icon = r.icon || (r.positive ? '✅' : '⚠️');
      return '<div class="reason-item">' + icon + ' ' + esc(r.text || r.label || r) + '</div>';
    }).join('');
    setHTML(id, html);
  }

  function renderGlowStats(glow) {
    if (!glow) { setHTML('glow-stats', ''); return; }
    var items = [];
    if (glow.score != null) items.push({ icon: '🌅', label: '晚霞指数', value: glow.score + ' 分' });
    if (glow.midHighCloud != null) items.push({ icon: '☁️', label: '中高层云', value: glow.midHighCloud + '%' });
    if (glow.lowCloud != null) items.push({ icon: '🌫️', label: '低云遮挡', value: glow.lowCloud + '%' });
    setHTML('glow-stats', renderStatCards(items));
  }

  function renderStarStats(star) {
    if (!star) { setHTML('star-stats', ''); return; }
    var items = [];
    if (star.score != null) items.push({ icon: '🌌', label: '银河指数', value: star.score + ' 分' });
    // scoreStargazing returns moonPhase as an object ({ icon, name }), so
    // rendering it directly would print "[object Object]".
    if (star.moonPhase != null) {
      var moon = star.moonPhase;
      var moonText = typeof moon === 'string'
        ? moon
        : [moon.icon, moon.name].filter(Boolean).join(' ');
      if (star.moonIllum != null) moonText += ' · 亮度 ' + star.moonIllum + '%';
      if (moonText) items.push({ icon: '🌙', label: '月相', value: moonText });
    }
    if (star.lightPollution != null) items.push({ icon: '💡', label: '光污染', value: star.lightPollution });
    if (state.lightPollution && state.lightPollution.label) {
      items.push({ icon: '🌃', label: '机位光污染', value: state.lightPollution.label + (state.lightPollution.bortleClass ? ' · Bortle ' + state.lightPollution.bortleClass : '') });
    }
    if (star.transparency != null) items.push({ icon: '🔭', label: '透明度', value: star.transparency });
    setHTML('star-stats', renderStatCards(items));
  }

  function renderAstroParams(star) {
    if (!star || !star.astroParams) { setHTML('star-astro-params', ''); setHTML('star-astro-params2', ''); return; }
    var p = star.astroParams;
    var items1 = [];
    if (p.iso) items1.push({ label: 'ISO', value: p.iso });
    if (p.aperture) items1.push({ label: '光圈', value: p.aperture });
    if (p.shutter) items1.push({ label: '快门', value: p.shutter });
    setHTML('star-astro-params', renderPhotoGrid(items1));
    var items2 = [];
    if (p.focalLength) items2.push({ label: '焦距', value: p.focalLength });
    if (p.rule500) items2.push({ label: '500法则', value: p.rule500 });
    setHTML('star-astro-params2', renderPhotoGrid(items2));
  }

  function renderStatCards(items) {
    return items.map(function(it) {
      return '<div class="stat-card"><span class="stat-icon">' + it.icon + '</span>'
        + '<div><div class="stat-label">' + esc(it.label) + '</div>'
        + '<div class="stat-value">' + esc(String(it.value)) + '</div></div></div>';
    }).join('');
  }

  function renderPhotoGrid(items) {
    return items.map(function(it) {
      return '<div class="photo-param"><div class="photo-param-label">' + esc(it.label) + '</div>'
        + '<div class="photo-param-value">' + esc(String(it.value)) + '</div></div>';
    }).join('');
  }

  function renderSafetyAlerts(alerts) {
    var container = $('safety-alerts');
    if (!container) return;
    if (!alerts || !alerts.length) { container.innerHTML = ''; return; }
    container.innerHTML = alerts.map(function(a) {
      return '<div class="safety-alert safety-' + (a.level || 'warning') + '">'
        + '<span class="safety-icon">' + (a.icon || '⚠️') + '</span>'
        + '<span class="safety-text">' + esc(a.text || a.message || a) + '</span>'
        + '</div>';
    }).join('');
  }

  function renderGuidanceGrid(guidance) {
    var items = [];
    if (guidance.recommendedWindow) items.push({ label: '推荐时段', value: guidance.recommendedWindow });
    if (guidance.daylightWindow) items.push({ label: '日光窗口', value: guidance.daylightWindow });
    if (guidance.viewpointAdvice) items.push({ label: '观测点建议', value: guidance.viewpointAdvice });
    setHTML('guidance-grid', items.map(function(it) {
      return '<div class="guidance-item"><div class="guidance-item-label">' + esc(it.label) + '</div>'
        + '<div class="guidance-item-value">' + esc(it.value) + '</div></div>';
    }).join(''));
  }

  function renderHourlyList(hourlyList) {
    if (!hourlyList || !hourlyList.length) { setHTML('hourly-list', ''); return; }
    var html = hourlyList.map(function(h) {
      return '<div class="hourly-row">'
        + '<div class="hourly-col-time">' + esc(h.time || '') + '</div>'
        + '<div class="hourly-col-temp">' + esc(h.temp != null ? h.temp + '°' : '--') + '</div>'
        + '<div class="hourly-col-cloud">' + esc(h.cloudBase != null ? Math.round(h.cloudBase) + 'm' : '--') + '</div>'
        + '<div class="hourly-col-precip">' + esc(h.precip != null ? h.precip + 'mm' : '--') + '</div>'
        + '</div>';
    }).join('');
    setHTML('hourly-list', html);
  }

  // ===== Fusion =====
  async function fetchFusion(lat, lon) {
    state.fusionLoading = true;
    state.fusionResult = null;
    show('fusion-section');
    show('fusion-loading');
    hide('fusion-detail');

    try {
      var modelResults = await fusionMod.fetchMultiModelWeather(lat, lon);
      var result = fusionMod.fuseModelPredictions(modelResults, state.elevation, state.selectedDayIndex);

      if (result) {
        state.fusionResult = result;
        renderFusion(result);
      }
    } catch (err) {
      console.warn('多模式融合失败:', err.message);
    }
    state.fusionLoading = false;
    hide('fusion-loading');
  }

  // Fetch Open-Meteo air-quality (PM2.5 / AOD) for sunset glow aerosol scoring.
  // Non-blocking — re-render glow when the data arrives.
  async function fetchAirQualityAndRefresh(lat, lon) {
    if (!api || typeof api.fetchAirQuality !== 'function') return;
    try {
      var airQuality = await api.fetchAirQuality(lat, lon);
      if (!airQuality) return;
      if (state.lat !== lat || state.lon !== lon) return;
      state.airQuality = airQuality;
      if (state.weatherData) {
        renderWeather();
      }
    } catch (err) {
      console.warn('空气质量获取失败:', err && err.message);
    }
  }

  function renderFusion(result) {
    if (!result) { hide('fusion-detail'); return; }
    show('fusion-section');
    hide('fusion-loading');

    // CS.fusion returns fusedScore/resultText/agreement/stdDev/modelDetails.
    // Reading score/label/confidence/spread/models here rendered
    // "undefined 分" and an empty model list. Keep the old names as
    // fallbacks in case another caller passes the flatter shape.
    var score = result.fusedScore != null ? result.fusedScore : result.score;
    var label = result.resultText || result.label;
    var agreementLabel = (result.agreement && result.agreement.label) || result.confidence;
    var spread = result.stdDev != null ? result.stdDev : result.spread;
    var models = result.modelDetails || result.models;

    setText('fusion-result', label || (score != null ? score + ' 分' : '--'));
    setText('fusion-summary', result.summary || '');

    // Stats
    var statsItems = [];
    if (score != null) statsItems.push({ icon: '📊', label: '融合评分', value: score + ' 分' });
    if (agreementLabel) statsItems.push({ icon: '🎯', label: '一致性', value: agreementLabel });
    if (spread != null) statsItems.push({ icon: '📏', label: '分散度', value: Number(spread).toFixed(1) });
    if (result.modelCount != null) statsItems.push({ icon: '🧮', label: '参与模式', value: result.modelCount + ' 个' });
    setHTML('fusion-stats', renderStatCards(statsItems));

    // Model details
    if (models && models.length) {
      var html = models.map(function(m) {
        return '<div class="fusion-model-row">'
          + '<span class="fusion-model-name">' + esc(m.name) + '</span>'
          + '<span class="fusion-model-score">' + (m.score != null ? m.score + ' 分' : '--') + '</span>'
          + '</div>';
      }).join('');
      setHTML('fusion-models', html);
    }

    if (result.disclaimer) setText('fusion-disclaimer', result.disclaimer);

    // Collapsed summary
    setText('fusion-collapsed', label || '');

    if (state.showFusion) {
      show('fusion-detail');
      hide('fusion-collapsed');
    } else {
      hide('fusion-detail');
      show('fusion-collapsed');
    }
  }

  function onToggleFusion() {
    state.showFusion = !state.showFusion;
    var arrow = $('fusion-arrow');
    if (arrow) arrow.textContent = state.showFusion ? '▼' : '▶';

    if (state.showFusion) {
      show('fusion-detail');
      hide('fusion-collapsed');
    } else {
      hide('fusion-detail');
      if (state.fusionResult) show('fusion-collapsed');
    }
  }

  // ===== Hourly toggle =====
  function onToggleHourly() {
    state.showHourly = !state.showHourly;
    var arrow = $('hourly-arrow');
    if (arrow) arrow.textContent = state.showHourly ? '▼' : '▶';
    toggle('hourly-section', state.showHourly);
  }

  // ===== Photography panel =====
  function onOpenPhoto() {
    var overlay = $('photo-overlay');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Populate device selectors
    var cameras = presets.getAllCameraPresets();
    var phones = presets.getAllPhonePresets();
    populateSelector('camera-selector', cameras, '选择相机型号 ▾');
    populateSelector('phone-selector', phones, '选择手机型号 ▾');

    renderPhotoPanel();
  }

  function onClosePhoto() {
    var overlay = $('photo-overlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  function populateSelector(id, items, placeholder) {
    var sel = $(id);
    sel.innerHTML = '<option value="">' + placeholder + '</option>';
    items.forEach(function(item, i) {
      var opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  }

  function onSelectCamera() {
    state.selectedCamera = $('camera-selector').value;
    toggle('btn-clear-camera', !!state.selectedCamera);
    updateDeviceRecs();
  }

  function onSelectPhone() {
    state.selectedPhone = $('phone-selector').value;
    toggle('btn-clear-phone', !!state.selectedPhone);
    updateDeviceRecs();
  }

  function onClearCamera() {
    state.selectedCamera = '';
    $('camera-selector').value = '';
    hide('btn-clear-camera');
    state.cameraRec = null;
    hide('camera-rec-section');
    show('generic-camera-section');
  }

  function onClearPhone() {
    state.selectedPhone = '';
    $('phone-selector').value = '';
    hide('btn-clear-phone');
    state.phoneRec = null;
    hide('phone-rec-section');
    show('generic-phone-section');
  }

  function updateDeviceRecs() {
    var score = state.analysis?.score ?? 0;
    var wind = parseFloat(state.currentWind) || 0;
    var lighting = state.photoParams?.lighting || { phase: 'daylight' };
    var ev = state.photoParams?.ev || 12;

    if (state.selectedCamera) {
      state.cameraRec = presets.getCameraRecommendation(state.selectedCamera, ev, lighting, wind, score);
      renderCameraRec(state.cameraRec);
    } else {
      state.cameraRec = null;
      hide('camera-rec-section');
      show('generic-camera-section');
    }

    if (state.selectedPhone) {
      state.phoneRec = presets.getPhoneRecommendation(state.selectedPhone, score, lighting, wind);
      renderPhoneRec(state.phoneRec);
    } else {
      state.phoneRec = null;
      hide('phone-rec-section');
      show('generic-phone-section');
    }
  }

  function renderPhotoPanel() {
    var pp = state.photoParams;
    if (!pp) return;

    // Lighting & EV
    setText('photo-light-icon', pp.lighting?.icon || '☀️');
    setText('photo-light-label', pp.lighting?.label || pp.lighting?.phase || '--');
    setText('photo-ev', pp.ev != null ? 'EV ' + pp.ev : '');
    setText('photo-summary', pp.summary || '');

    // Exposure table
    renderExposureTable(pp.exposureTable);

    // Generic camera params
    if (pp.camera) {
      renderPhotoGridSection('generic-camera-params', pp.camera.params);
      renderPhotoGridSection('generic-camera-focal', pp.camera.focalRecommendations);
      if (pp.camera.dofInfo) {
        show('generic-dof-section');
        renderPhotoGridSection('generic-dof-section', pp.camera.dofInfo);
      }
    }

    // Filters
    if (pp.filters && pp.filters.length) {
      show('filter-section');
      setHTML('filter-list', pp.filters.map(function(f) {
        return '<div class="filter-item"><span class="filter-name">' + esc(f.name || f) + '</span>'
          + (f.note ? '<span class="filter-note">' + esc(f.note) + '</span>' : '') + '</div>';
      }).join(''));
    } else {
      hide('filter-section');
    }

    // Celestial (sun/moon)
    if (pp.celestial) {
      show('celestial-section');
      renderPhotoGridSection('celestial-grid', pp.celestial);
    }

    // Generic phone params
    if (pp.phone) {
      renderPhotoGridSection('generic-phone-params', pp.phone.params);
      renderReasons('generic-phone-tips', pp.phone.tips);
    }

    // Composition
    if (pp.composition && pp.composition.length) {
      show('composition-section');
      renderReasons('composition-list', pp.composition);
    } else {
      hide('composition-section');
    }

    // Timeline
    if (pp.timeline && pp.timeline.length) {
      show('timeline-section');
      renderTimeline(pp.timeline);
    } else {
      hide('timeline-section');
    }

    // ND calculator
    if (pp.nd) {
      show('nd-section');
      renderPhotoGridSection('nd-grid', pp.nd);
    } else {
      hide('nd-section');
    }

    // Timelapse
    if (pp.timelapse) {
      show('timelapse-section');
      renderPhotoGridSection('timelapse-grid', pp.timelapse.params);
      setText('timelapse-note', pp.timelapse.note || '');
      renderReasons('timelapse-tips', pp.timelapse.tips);
    } else {
      hide('timelapse-section');
    }

    updateDeviceRecs();
  }

  function renderExposureTable(table) {
    var container = $('exposure-table');
    if (!container) return;
    // Keep header, append rows
    var header = container.querySelector('.exposure-header');
    container.innerHTML = '';
    if (header) container.appendChild(header);
    if (!table || !table.length) return;
    table.forEach(function(row) {
      var div = document.createElement('div');
      div.className = 'exposure-row';
      div.innerHTML = '<div class="exposure-cell">' + esc(row.aperture || '--') + '</div>'
        + '<div class="exposure-cell">' + esc(row.shutter || '--') + '</div>'
        + '<div class="exposure-cell">' + esc(row.iso || '--') + '</div>'
        + '<div class="exposure-cell">' + esc(row.scene || '--') + '</div>';
      container.appendChild(div);
    });
  }

  function renderPhotoGridSection(id, items) {
    if (!items) { setHTML(id, ''); return; }
    if (Array.isArray(items)) {
      setHTML(id, renderPhotoGrid(items));
    } else if (typeof items === 'object') {
      var arr = Object.keys(items).map(function(k) { return { label: k, value: items[k] }; });
      setHTML(id, renderPhotoGrid(arr));
    }
  }

  function renderCameraRec(rec) {
    if (!rec) { hide('camera-rec-section'); show('generic-camera-section'); return; }
    show('camera-rec-section');
    hide('generic-camera-section');

    var brandModel = [rec.brand, rec.model].filter(Boolean).join(' ') || rec.label || '相机推荐';
    var html = '<div class="photo-device-title">📷 ' + esc(brandModel) + ' 推荐设置</div>';

    if (rec.lens) {
      html += '<div class="photo-param-note" style="margin-top:4px;">镜头：' + esc(rec.lens) + '</div>';
      if (rec.lensNote) {
        html += '<div class="photo-param-note" style="opacity:0.75;">' + esc(rec.lensNote) + '</div>';
      }
    }

    var params = [];
    if (rec.aperture) params.push({ label: '光圈', value: rec.aperture });
    if (rec.shutter)  params.push({ label: '快门', value: rec.shutter });
    if (rec.iso)      params.push({ label: 'ISO', value: rec.iso });
    if (params.length) {
      html += '<div class="photo-grid" style="margin-top:6px;">' + renderPhotoGrid(params) + '</div>';
    }

    if (rec.altLens && rec.altLens.name) {
      html += '<div class="photo-param-note" style="margin-top:6px;">备用镜头：'
        + esc(rec.altLens.name)
        + (rec.altLens.note ? ' — ' + esc(rec.altLens.note) : '')
        + '</div>';
    }

    if (rec.allLenses && rec.allLenses.length) {
      html += '<div style="margin-top:6px;">';
      rec.allLenses.forEach(function(l) {
        html += '<div class="reason-item">' + esc(l.name)
          + (l.bestAperture ? '（推荐 ' + esc(l.bestAperture) + '）' : '')
          + (l.note ? ' — ' + esc(l.note) : '')
          + '</div>';
      });
      html += '</div>';
    }

    if (rec.tips && rec.tips.length) {
      html += '<div class="forecast-reasons" style="margin-top:6px;">';
      rec.tips.forEach(function(t) {
        html += '<div class="reason-item">' + esc(typeof t === 'string' ? t : t.text || '') + '</div>';
      });
      html += '</div>';
    }
    setHTML('camera-rec-section', html);
  }

  function renderPhoneRec(rec) {
    if (!rec) { hide('phone-rec-section'); show('generic-phone-section'); return; }
    show('phone-rec-section');
    hide('generic-phone-section');

    var brandModel = [rec.brand, rec.model].filter(Boolean).join(' ') || rec.label || '手机推荐';
    var html = '<div class="photo-device-title">📱 ' + esc(brandModel) + ' 推荐设置</div>';

    if (rec.mode) {
      html += '<div class="photo-param-note" style="margin-top:4px;">拍摄模式：' + esc(rec.mode) + '</div>';
      if (rec.modeNote) {
        html += '<div class="photo-param-note" style="opacity:0.75;">' + esc(rec.modeNote) + '</div>';
      }
    }

    if (rec.primaryLens) {
      var lens = rec.primaryLens;
      html += '<div class="photo-param-note" style="margin-top:4px;">主镜头：'
        + esc((lens.focal ? lens.focal + 'mm ' : '') + (lens.name || ''))
        + (lens.note ? ' — ' + esc(lens.note) : '')
        + '</div>';
    }

    var pro = rec.proSettings || {};
    var params = [];
    if (pro.iso)     params.push({ label: '专业 ISO', value: pro.iso });
    if (pro.shutter) params.push({ label: '快门', value: pro.shutter });
    if (pro.wb)      params.push({ label: '白平衡', value: pro.wb });
    if (params.length) {
      html += '<div class="photo-grid" style="margin-top:6px;">' + renderPhotoGrid(params) + '</div>';
    }

    if (rec.altLens && (rec.altLens.name || rec.altLens.focal)) {
      var alt = rec.altLens;
      html += '<div class="photo-param-note" style="margin-top:6px;">备用镜头：'
        + esc((alt.focal ? alt.focal + 'mm ' : '') + (alt.name || ''))
        + (alt.note ? ' — ' + esc(alt.note) : '')
        + '</div>';
    }

    if (rec.features && rec.features.length) {
      html += '<div class="forecast-reasons" style="margin-top:6px;">';
      rec.features.forEach(function(f) {
        html += '<div class="reason-item">✨ ' + esc(typeof f === 'string' ? f : (f.text || '')) + '</div>';
      });
      html += '</div>';
    }
    if (rec.timelapse) {
      html += '<div class="photo-param-note" style="margin-top:4px;">⏱ 延时摄影：' + esc(rec.timelapse) + '</div>';
    }

    if (rec.tips && rec.tips.length) {
      html += '<div class="forecast-reasons" style="margin-top:6px;">';
      rec.tips.forEach(function(t) {
        html += '<div class="reason-item">' + esc(typeof t === 'string' ? t : t.text || '') + '</div>';
      });
      html += '</div>';
    }
    setHTML('phone-rec-section', html);
  }

  function renderTimeline(timeline) {
    setHTML('timeline-list', timeline.map(function(t) {
      return '<div class="timeline-item">'
        + '<span class="timeline-time">' + esc(t.time || '') + '</span>'
        + '<span class="timeline-desc">' + esc(t.label || t.desc || '') + '</span>'
        + '</div>';
    }).join(''));
  }

  // ===== Search history & Favorites =====
  function renderSearchHistory() {
    var list = historyMod.getSearchHistory();
    if (!list || !list.length) { hide('search-history-section'); return; }
    show('search-history-section');
    var html = list.map(function(item) {
      return '<span class="history-tag" data-lat="' + item.lat + '" data-lon="' + item.lon
        + '" data-name="' + esc(item.name) + '">' + esc(item.name) + '</span>';
    }).join('');
    setHTML('search-history-tags', html);
    // Bind clicks
    $('search-history-tags').querySelectorAll('.history-tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        onHistoryTap({
          name: this.getAttribute('data-name'),
          lat: parseFloat(this.getAttribute('data-lat')),
          lon: parseFloat(this.getAttribute('data-lon')),
        });
      });
    });
  }

  function renderFavorites() {
    var list = favMod.getFavorites();
    if (!list || !list.length) { hide('fav-section'); return; }
    show('fav-section');
    var html = list.map(function(item) {
      return '<span class="history-tag" data-lat="' + item.lat + '" data-lon="' + item.lon
        + '" data-name="' + esc(item.name) + '" data-elev="' + (item.elevation || 300) + '">⭐ ' + esc(item.name) + '</span>';
    }).join('');
    setHTML('fav-tags', html);
    $('fav-tags').querySelectorAll('.history-tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        onFavTap({
          name: this.getAttribute('data-name'),
          lat: parseFloat(this.getAttribute('data-lat')),
          lon: parseFloat(this.getAttribute('data-lon')),
          elevation: parseFloat(this.getAttribute('data-elev')) || 300,
        });
      });
    });
  }

  function onHistoryTap(item) {
    if (!item) return;
    state.lat = item.lat;
    state.lon = item.lon;
    state.locationName = item.name;
    fetchAll(item.lat, item.lon);
  }

  function onFavTap(item) {
    if (!item) return;
    state.lat = item.lat;
    state.lon = item.lon;
    state.locationName = item.name;
    state.elevation = item.elevation || 300;
    fetchAll(item.lat, item.lon);
  }

  function onToggleFav() {
    if (favMod.isFavorite(state.lat, state.lon)) {
      favMod.removeFavorite(state.lat, state.lon);
    } else {
      favMod.addFavorite({ name: state.locationName, lat: state.lat, lon: state.lon, elevation: state.elevation });
    }
    updateFavIcon();
    renderFavorites();
  }

  function updateFavIcon() {
    var isFav = favMod.isFavorite(state.lat, state.lon);
    setText('fav-icon', isFav ? '★' : '☆');
    setText('fav-label', isFav ? '已收藏' : '收藏');
  }

  // ===== SOS =====
  function onSOS() {
    var info = '🆘 紧急求救\n位置：' + state.locationName
      + '\n坐标：' + state.lat.toFixed(6) + ', ' + state.lon.toFixed(6)
      + '\n海拔：' + state.elevation + 'm'
      + '\n时间：' + new Date().toLocaleString('zh-CN');

    var choice = confirm('紧急求救信息已生成，是否复制到剪贴板？\n\n' + info);
    if (choice) {
      navigator.clipboard.writeText(info).then(function() {
        showToast('位置信息已复制');
      }).catch(function() {
        // Fallback
        prompt('请手动复制以下信息：', info);
      });
    }
  }

  // ===== Share =====
  function posterFilename() {
    var locationPart = String(state.locationName || 'location').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'location';
    var datePart = String(state.dayLabels[state.selectedDayIndex] || new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|\s()]+/g, '-').replace(/^-+|-+$/g, '');
    return 'cloudsea-' + locationPart + '-' + datePart + '.png';
  }

  async function onSharePoster() {
    if (!posterRenderer || !posterRenderer.renderPosterToBlob) {
      showToast('海报功能未加载');
      return;
    }
    showStatus('正在生成海报...', 'info');
    await ensureLocationEnriched();
    await new Promise(function(resolve) { requestAnimationFrame(resolve); });
    try {
      var posterResult = await posterRenderer.renderPosterToBlob(state, {});
      var bridge = (CS && CS.bridge && CS.bridge.isAvailable && CS.bridge.isAvailable()) ? CS.bridge : null;
      if (bridge) {
        var dataUrl = await blobToDataUrl(posterResult.blob);
        var titleText = (state.locationName || '云海观测') + ' 云海/晚霞/星空预报';
        var shareText = buildShareText();
        try {
          await bridge.request('share.image', {
            title: titleText,
            text: shareText,
            dataUrl: dataUrl,
            filename: posterFilename(),
          }, 60000);
          showStatus('海报已生成，请在系统分享面板选择目标', 'success');
          return;
        } catch (nativeErr) {
          console.warn('[poster] share.image failed, trying share.poster', nativeErr && nativeErr.message);
          var base64Png = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          await bridge.request('share.poster', {
            title: titleText,
            text: shareText,
            base64Png: base64Png,
            filename: posterFilename(),
          }, 30000);
          showStatus('海报已生成（文字分享）', 'success');
          return;
        }
      }
      await posterRenderer.downloadPoster(state, posterFilename());
      showStatus('海报已生成并开始下载', 'success');
    } catch (err) {
      showStatus('海报生成失败：' + (err && err.message ? err.message : err), 'warning');
    }
  }

  function blobToDataUrl(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(String(reader.result || '')); };
      reader.onerror = function() { reject(new Error('海报数据读取失败')); };
      reader.readAsDataURL(blob);
    });
  }

  function buildShareText() {
    var lines = [];
    var locationLine = '📍 ' + (state.locationName || '观测点');
    if (state.elevation != null) locationLine += '  ·  海拔 ' + Math.round(state.elevation) + 'm';
    lines.push(locationLine);
    var dateLabel = (state.dayLabels && state.dayLabels[state.selectedDayIndex]) || new Date().toLocaleDateString('zh-CN');
    lines.push('📅 ' + dateLabel);
    lines.push('');

    var preds = [];
    if (state.analysis) preds.push({ icon: '☁️', name: '云海', score: state.analysis.score, label: state.analysis.resultText || state.analysis.label, summary: state.analysis.summary });
    if (state.glowAnalysis) preds.push({ icon: '🌅', name: '晚霞', score: state.glowAnalysis.score, label: state.glowAnalysis.resultText || state.glowAnalysis.label, summary: state.glowAnalysis.summary });
    if (state.starInfo) preds.push({ icon: '🌌', name: '星空', score: state.starInfo.score, label: state.starInfo.resultText || state.starInfo.label, summary: state.starInfo.summary });

    preds.forEach(function(item) {
      if (item.score == null) return;
      var scoreText = Math.round(Number(item.score));
      var line = item.icon + ' ' + item.name + '：' + scoreText + ' 分';
      if (item.label) line += '（' + item.label + '）';
      lines.push(line);
      if (item.summary) lines.push('   · ' + item.summary);
    });

    var reasons = (state.analysis && Array.isArray(state.analysis.reasons))
      ? state.analysis.reasons.slice(0, 3).map(function(r) { return typeof r === 'string' ? r : (r.text || r.label || r.message || ''); }).filter(Boolean)
      : [];
    if (reasons.length) {
      lines.push('');
      lines.push('💡 主要依据：');
      reasons.forEach(function(r) { lines.push('  · ' + r); });
    }

    var hourly = [];
    if (state.currentHumidity != null && state.currentHumidity !== '--') hourly.push('湿度 ' + state.currentHumidity + '%');
    if (state.currentCloudCover != null && state.currentCloudCover !== '--') hourly.push('云量 ' + state.currentCloudCover + '%');
    if (state.currentWind != null && state.currentWind !== '--') hourly.push('风速 ' + state.currentWind + ' m/s');
    if (state.currentDewGap != null && state.currentDewGap !== '--') hourly.push('露点差 ' + state.currentDewGap + '°C');
    if (hourly.length) {
      lines.push('');
      lines.push('🌡️ ' + hourly.join('  ·  '));
    }

    var wp = state.selectedWaypoint || (Array.isArray(state.nearbyWaypoints) && state.nearbyWaypoints[0]);
    if (wp && wp.name) {
      lines.push('');
      var wpLine = '📷 推荐机位：' + wp.name;
      if (wp.distanceKm != null) wpLine += '（' + wp.distanceKm + 'km）';
      lines.push(wpLine);
    }

    lines.push('');
    lines.push('— CloudSeaShell · 云海观测决策台');
    return lines.join('\n');
  }

  function onShare() {
    ensureLocationEnriched().then(function() {
      doShare();
    });
  }

  function doShare() {
    var text = buildShareText();
    var titleScore = (state.analysis && state.analysis.score != null) ? state.analysis.score : null;
    var titleText = (state.locationName || '观测点') + ' 云海/晚霞/星空预报' + (titleScore != null ? '：' + Math.round(titleScore) + ' 分' : '');

    var bridge = (CS && CS.bridge && CS.bridge.isAvailable && CS.bridge.isAvailable()) ? CS.bridge : null;
    if (bridge) {
      bridge.request('share.text', { title: titleText, text: text }, 30000)
        .then(function() { /* native dialog opened */ })
        .catch(function(err) {
          showStatus('原生分享失败：' + (err && err.message ? err.message : err), 'warning');
          fallbackCopy(text);
        });
      return;
    }

    if (typeof navigator.share === 'function') {
      navigator.share({ title: titleText, text: text })
        .then(function() { /* ok */ })
        .catch(function() { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    // 2) Modern Clipboard API (only works in secure context with permission)
    var modern = (navigator.clipboard && typeof navigator.clipboard.writeText === 'function')
      ? navigator.clipboard.writeText(text)
      : Promise.reject();

    modern.then(function() {
      showToast('已复制分享内容到剪贴板');
    }).catch(function() {
      // 3) Legacy execCommand fallback — works under file:// in Android WebView
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          showToast('已复制分享内容到剪贴板');
        } else {
          showShareDialog(text);
        }
      } catch (e) {
        showShareDialog(text);
      }
    });
  }

  // Last-resort visible share dialog (since prompt() is disabled in RN WebView)
  function showShareDialog(text) {
    var existing = document.getElementById('share-fallback-overlay');
    if (existing) existing.parentNode.removeChild(existing);
    var ov = document.createElement('div');
    ov.id = 'share-fallback-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML = '<div style="background:#0d1526;border-radius:12px;padding:16px;max-width:90%;color:#e0e6f0;font-size:14px;">' +
      '<div style="font-weight:600;margin-bottom:8px;">长按下方文字复制分享：</div>' +
      '<textarea readonly style="width:100%;min-height:120px;background:#1a2540;color:#e0e6f0;border:1px solid #2a3858;border-radius:6px;padding:8px;font-size:13px;">' +
      text.replace(/</g, '&lt;') + '</textarea>' +
      '<div style="text-align:right;margin-top:10px;"><button id="share-fallback-close" style="background:#3aa4ff;color:#fff;border:none;border-radius:6px;padding:6px 18px;font-size:14px;">关闭</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('share-fallback-close').addEventListener('click', function() {
      ov.parentNode.removeChild(ov);
    });
  }

  // ===== Feedback =====
  function autoSaveFeedback() {
    if (!state.analysis) return;
    var record = {
      location: { lat: state.lat, lon: state.lon, name: state.locationName },
      predictions: {
        cloudSea: { score: state.analysis.score || 0, suggestion: state.analysis.suggestion || '' },
        glow: { score: (state.glowAnalysis && state.glowAnalysis.score) || 0, label: (state.glowAnalysis && state.glowAnalysis.label) || '' },
        stars: { score: (state.starInfo && state.starInfo.score) || 0, label: (state.starInfo && state.starInfo.label) || '' },
      },
    };
    var saved = feedbackMod.saveFeedback(record);
    state.currentFeedback = saved;
  }

  function onOpenFeedback() {
    var overlay = $('feedback-overlay');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    var records = feedbackMod.getFeedbackRecords();
    var stats = feedbackMod.getFeedbackStats();
    var current = state.currentFeedback || (records.length > 0 ? records[0] : null);

    if (!current) {
      show('fb-empty-hint');
      hide('feedback-content');
      hide('fb-stats-section');
      return;
    }

    hide('fb-empty-hint');
    show('feedback-content');

    // Restore actual values
    var act = (current && current.actual) || {};
    state.fbCloudSea = act.cloudSea !== undefined ? act.cloudSea : null;
    state.fbGlow = act.glow !== undefined ? act.glow : null;
    state.fbStars = act.stars !== undefined ? act.stars : null;
    state.fbRating = act.rating !== undefined ? act.rating : null;
    state.fbNote = act.note || '';

    // Prediction snapshot
    var pred = current.predictions || {};
    setText('fb-cloud-score', (pred.cloudSea?.score ?? '--') + ' 分');
    setText('fb-glow-score', (pred.glow?.score ?? '--') + ' 分');
    setText('fb-star-score', (pred.stars?.score ?? '--') + ' 分');
    setText('fb-date-info', current.date || '');

    // Toggle buttons
    renderFeedbackToggle('fb-cloud-btn', state.fbCloudSea);
    renderFeedbackToggle('fb-glow-btn', state.fbGlow);
    renderFeedbackToggle('fb-star-btn', state.fbStars);

    // Rating
    renderFeedbackRating();

    // Note
    $('fb-note').value = state.fbNote;

    // Stats
    if (stats && stats.total > 0) {
      show('fb-stats-section');
      setText('fb-stats-total', stats.total);
      setText('fb-stats-filled', stats.filled || 0);
      setText('fb-stats-accuracy', stats.accuracy != null ? stats.accuracy + '%' : '--');
    } else {
      hide('fb-stats-section');
    }
  }

  function onCloseFeedback() {
    var overlay = $('feedback-overlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  function renderFeedbackToggle(btnId, value) {
    var btn = $(btnId);
    if (!btn) return;
    btn.className = 'fb-toggle-btn';
    if (value === true) { btn.textContent = '是 ✓'; btn.classList.add('fb-toggle-yes'); }
    else if (value === false) { btn.textContent = '否 ✗'; btn.classList.add('fb-toggle-no'); }
    else { btn.textContent = '未填'; btn.classList.add('fb-toggle-null'); }
  }

  function cycleToggle(key) {
    var v = state[key];
    state[key] = v === null ? true : (v === true ? false : null);
  }

  function onToggleCloudSea() {
    cycleToggle('fbCloudSea');
    renderFeedbackToggle('fb-cloud-btn', state.fbCloudSea);
  }

  function onToggleGlow() {
    cycleToggle('fbGlow');
    renderFeedbackToggle('fb-glow-btn', state.fbGlow);
  }

  function onToggleStars() {
    cycleToggle('fbStars');
    renderFeedbackToggle('fb-star-btn', state.fbStars);
  }

  function renderFeedbackRating() {
    var stars = document.querySelectorAll('#fb-rating-row .fb-star');
    stars.forEach(function(star) {
      var r = Number(star.getAttribute('data-rating'));
      star.classList.toggle('fb-star-active', state.fbRating != null && r <= state.fbRating);
    });
  }

  function onSubmitFeedback() {
    if (!state.currentFeedback) { showToast('暂无预测记录'); return; }

    var actualData = {
      cloudSea: state.fbCloudSea,
      glow: state.fbGlow,
      stars: state.fbStars,
      rating: state.fbRating,
      note: state.fbNote,
    };

    var ok = feedbackMod.updateFeedback(state.currentFeedback.id, actualData);
    if (ok) {
      showToast('反馈已保存 ✓');
    } else {
      showToast('保存失败');
    }
  }

  function onExportFeedback() {
    var csv = feedbackMod.exportFeedbackCSV();
    if (!csv) { showToast('暂无数据可导出'); return; }
    navigator.clipboard.writeText(csv).then(function() {
      showToast('已复制到剪贴板');
    }).catch(function() {
      prompt('请手动复制：', csv);
    });
  }

  // ===== History page =====
  function onGoHistory() {
    hide('page-main');
    show('page-history');
    renderHistoryPage();
  }

  function renderHistoryPage() {
    var records = feedbackMod.getFeedbackRecords();
    var stats = feedbackMod.getFeedbackStats();

    if (!records || !records.length) {
      show('history-empty');
      hide('history-stats');
      setHTML('history-records', '');
      return;
    }

    hide('history-empty');
    show('history-stats');

    // Stats grid
    var statsItems = [
      { label: '总记录', value: stats.total || 0 },
      { label: '已反馈', value: stats.filled || 0 },
      { label: '准确率', value: stats.accuracy != null ? stats.accuracy + '%' : '--' },
      { label: '平均分', value: stats.avgRating != null ? stats.avgRating.toFixed(1) : '--' },
    ];
    setHTML('history-stats-grid', statsItems.map(function(s) {
      return '<div class="stat-card"><div class="stat-label">' + esc(s.label) + '</div>'
        + '<div class="stat-value">' + esc(String(s.value)) + '</div></div>';
    }).join(''));

    // Records list
    var html = records.map(function(r) {
      var pred = r.predictions || {};
      return '<div class="history-record">'
        + '<div class="history-record-date">' + esc(r.date || '--') + ' · ' + esc(r.location?.name || '--') + '</div>'
        + '<div class="history-record-scores">'
        + '<span>☁️ ' + (pred.cloudSea?.score ?? '--') + '</span>'
        + '<span>🌅 ' + (pred.glow?.score ?? '--') + '</span>'
        + '<span>🌌 ' + (pred.stars?.score ?? '--') + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
    setHTML('history-records', html);
  }

  // ===== UI helpers =====
  function showLoading() {
    show('loading-skeleton');
    hide('main-content');
    hide('error-state');
  }

  function hideLoading() {
    hide('loading-skeleton');
  }

  function showStatus(text, type) {
    show('status-banner');
    var banner = $('status-banner');
    if (banner) {
      banner.textContent = text;
      banner.className = 'status-banner status-' + (type || 'info');
    }
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('toast-show'); }, 10);
    setTimeout(function() {
      toast.classList.remove('toast-show');
      setTimeout(function() { document.body.removeChild(toast); }, 300);
    }, 2000);
  }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== Expose public API =====
  global.App = {
    onSearch: onSearch,
    onLocate: onLocate,
    onDayChange: onDayChange,
    onRetry: onRetry,
    onSOS: onSOS,
    onOpenPhoto: onOpenPhoto,
    onClosePhoto: onClosePhoto,
    onOpenFeedback: onOpenFeedback,
    onCloseFeedback: onCloseFeedback,
    onToggleHourly: onToggleHourly,
    onToggleFusion: onToggleFusion,
    onHistoryTap: onHistoryTap,
    onFavTap: onFavTap,
    onToggleFav: onToggleFav,
    onShare: onShare,
    onGoHistory: onGoHistory,
    // Expose state for debugging
    getState: function() { return state; },
  };

  document.addEventListener('DOMContentLoaded', init);

})(window);
