const calc = require('../../utils/calculations');
const api = require('../../utils/services');
const fusion = require('../../utils/fusion');
const presets = require('../../utils/camera-presets');
const analyzer = require('../../utils/analyzer');
const feedback = require('../../utils/feedback');

const DEFAULT_ELEVATION = 300;

Page({
  data: {
    lat: 39.9042,
    lon: 116.4074,
    elevation: DEFAULT_ELEVATION,
    locationName: '北京',
    searchText: '',
    selectedDayIndex: 0,
    dayLabels: [],
    loading: true,
    statusText: '',
    statusType: 'info',
    weatherData: null,
    analysis: null,
    guidance: null,
    currentTemp: '--',
    currentFeelsLike: '--',
    currentHumidity: '--',
    currentWind: '--',
    currentCloudCover: '--',
    currentDewGap: '--',
    hourlyList: [],
    markers: [],
    fusionResult: null,
    fusionLoading: false,
    photoParams: null,
    showPhoto: false,
    glowAnalysis: null,
    safetyAlerts: [],
    cameraPresets: presets.getAllCameraPresets(),
    phonePresets: presets.getAllPhonePresets(),
    selectedCamera: '',
    selectedPhone: '',
    cameraRec: null,
    phoneRec: null,
    starInfo: null,
    heroCard: null,
    // Feedback
    showFeedback: false,
    feedbackRecords: [],
    currentFeedback: null,
    feedbackStats: null,
    fbCloudSea: null,
    fbGlow: null,
    fbStars: null,
    fbRating: null,
    fbNote: '',
    // 折叠状态
    showHourly: false,
    showFusion: false,
  },

  onLoad() {
    // Auto-locate on startup
    this.autoLocate();
  },

  async autoLocate() {
    try {
      const pos = await api.getLocation();
      this.setData({
        lat: pos.latitude,
        lon: pos.longitude,
        locationName: '当前位置',
      });
      this.fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      console.warn('自动定位失败，使用默认位置', err.message);
      this.fetchAll(this.data.lat, this.data.lon);
    }
  },

  onShareAppMessage() {
    const { analysis, locationName } = this.data;
    const score = analysis?.score ?? 0;
    return {
      title: `${locationName} 云海预测：${score} 分`,
      path: '/pages/index/index',
    };
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
  },

  async onSearch() {
    const address = this.data.searchText.trim();
    if (!address) return;

    this.setData({ statusText: `正在搜索 ${address}...`, statusType: 'info', loading: true });

    try {
      const results = await api.geocodeAddress(address);

      if (results.length === 1) {
        // Single result: use directly
        const r = results[0];
        this.setData({ lat: r.latitude, lon: r.longitude, locationName: r.name });
        await this.fetchAll(r.latitude, r.longitude);
      } else {
        // Multiple results: let user pick
        const names = results.map(r => r.name);
        const that = this;
        wx.showActionSheet({
          itemList: names.slice(0, 6),
          success(res) {
            const picked = results[res.tapIndex];
            that.setData({ lat: picked.latitude, lon: picked.longitude, locationName: picked.name });
            that.fetchAll(picked.latitude, picked.longitude);
          },
          fail() {
            that.setData({ loading: false, statusText: '已取消选择', statusType: 'info' });
          },
        });
      }
    } catch (err) {
      this.setData({ statusText: `搜索失败：${err.message}`, statusType: 'warning', loading: false });
    }
  },

  async onLocate() {
    this.setData({ statusText: '正在获取当前位置...', statusType: 'info' });

    try {
      const pos = await api.getLocation();
      this.setData({
        lat: pos.latitude,
        lon: pos.longitude,
        locationName: '当前位置',
      });
      await this.fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      this.setData({ statusText: `定位失败：${err.message}`, statusType: 'warning' });
    }
  },

  onOpenPhoto() {
    this.setData({ showPhoto: true });
    this.updateDeviceRecs();
  },

  onSelectCamera(e) {
    const idx = Number(e.detail.value);
    const id = this.data.cameraPresets[idx]?.id || '';
    this.setData({ selectedCamera: id });
    this.updateDeviceRecs();
  },

  onSelectPhone(e) {
    const idx = Number(e.detail.value);
    const id = this.data.phonePresets[idx]?.id || '';
    this.setData({ selectedPhone: id });
    this.updateDeviceRecs();
  },

  updateDeviceRecs() {
    const { selectedCamera, selectedPhone, photoParams } = this.data;
    const score = this.data.analysis?.score ?? 0;
    const wind = parseFloat(this.data.currentWind) || 0;
    const lighting = photoParams?.lighting || { phase: 'daylight' };
    const ev = photoParams?.ev || 12;

    let cameraRec = null;
    if (selectedCamera) {
      cameraRec = presets.getCameraRecommendation(selectedCamera, ev, lighting, wind, score);
    }

    let phoneRec = null;
    if (selectedPhone) {
      phoneRec = presets.getPhoneRecommendation(selectedPhone, score, lighting, wind);
    }

    this.setData({ cameraRec, phoneRec });
  },

  onClearCamera() {
    this.setData({ selectedCamera: '', cameraRec: null });
  },

  onClearPhone() {
    this.setData({ selectedPhone: '', phoneRec: null });
  },

  onClosePhoto() {
    this.setData({ showPhoto: false });
  },

  onDayChange(e) {
    const index = Number(e.detail.value);
    this.setData({ selectedDayIndex: index });
    this.renderWeather();
  },

  onMapTap(e) {
    // 微信 map bindtap 可能不返回坐标，仅在有效时处理
    const lat = e.detail?.latitude;
    const lon = e.detail?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number' && 
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      this.setData({
        lat,
        lon,
        locationName: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      });
      this.fetchAll(lat, lon);
    }
  },

  onSOS() {
    const { lat, lon, elevation, locationName } = this.data;
    const info = `🆘 紧急求救\n位置：${locationName}\n坐标：${lat.toFixed(6)}, ${lon.toFixed(6)}\n海拔：${elevation}m\n时间：${new Date().toLocaleString('zh-CN')}`;

    wx.showActionSheet({
      itemList: ['拨打 110', '拨打 119', '复制位置信息'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({ phoneNumber: '110' });
        } else if (res.tapIndex === 1) {
          wx.makePhoneCall({ phoneNumber: '119' });
        } else if (res.tapIndex === 2) {
          wx.setClipboardData({ data: info });
        }
      },
    });
  },

  async fetchAll(lat, lon) {
    this.setData({ loading: true, statusText: '正在获取海拔数据...', statusType: 'info' });

    try {
      const elevation = await api.fetchElevation(lat, lon);
      this.setData({ elevation, statusText: '正在获取天气数据...', statusType: 'info' });

      const { data: weatherData, fromCache } = await api.fetchWeather(lat, lon);

      const dayLabels = analyzer.buildDayLabels(weatherData.hourly.time);

      this.setData({
        elevation,
        weatherData,
        dayLabels,
        markers: [{ id: 0, latitude: lat, longitude: lon, width: 28, height: 36 }],
        statusText: fromCache ? '使用缓存数据（点击刷新获取最新）' : '天气数据已更新',
        statusType: 'success',
      });

      this.renderWeather();

      // Background: multi-model fusion (non-blocking)
      this.fetchFusion(lat, lon);
    } catch (err) {
      this.setData({
        loading: false,
        statusText: `加载失败：${err.message}`,
        statusType: 'warning',
      });
    }
  },

  renderWeather() {
    const { weatherData, elevation, selectedDayIndex, lat } = this.data;
    if (!weatherData) return;

    const hourly = weatherData.hourly;

    // Core weather analysis (cloud sea + guidance)
    const weatherResult = analyzer.analyzeWeather(weatherData, elevation, selectedDayIndex);
    const { analysis, dayAnalysis, guidance, currentTemp, currentDewGap, hourlyList, sunrise, sunset, current, start } = weatherResult;

    // Photography
    const timeString = current?.time || hourly.time[start];
    const photoParams = analyzer.buildPhotoParams(timeString, sunrise, sunset, analysis, elevation);

    // Sunset glow
    const glowAnalysis = analyzer.analyzeGlow(hourly, start, sunrise, sunset);

    // Safety
    const safetyAlerts = analyzer.buildSafetyAlerts(hourly, start, current, elevation);

    // Stargazing
    const starInfo = analyzer.analyzeStars(timeString, lat, analysis.cloudCover, analysis.visibility, analysis.humidity, elevation);

    // Hero Card decision
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

    // Single setData call for all render updates
    this.setData({
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

    // Auto-save prediction snapshot to feedback
    this.autoSaveFeedback();
  },

  autoSaveFeedback() {
    const { analysis, glowAnalysis, starInfo, lat, lon, locationName } = this.data;
    if (!analysis) return;

    const record = {
      location: { lat, lon, name: locationName },
      predictions: {
        cloudSea: { score: analysis.score || 0, suggestion: analysis.suggestion || '' },
        glow: { score: (glowAnalysis && glowAnalysis.score) || 0, label: (glowAnalysis && glowAnalysis.label) || '' },
        stars: { score: (starInfo && starInfo.score) || 0, label: (starInfo && starInfo.label) || '' },
      },
    };

    const saved = feedback.saveFeedback(record);
    this.setData({ currentFeedback: saved });
  },

  onOpenFeedback() {
    const records = feedback.getFeedbackRecords();
    const stats = feedback.getFeedbackStats();
    const current = this.data.currentFeedback || (records.length > 0 ? records[0] : null);

    // Restore existing actual values if any
    const act = (current && current.actual) || {};
    this.setData({
      showFeedback: true,
      feedbackRecords: records,
      feedbackStats: stats,
      currentFeedback: current,
      fbCloudSea: act.cloudSea !== undefined ? act.cloudSea : null,
      fbGlow: act.glow !== undefined ? act.glow : null,
      fbStars: act.stars !== undefined ? act.stars : null,
      fbRating: act.rating !== undefined ? act.rating : null,
      fbNote: act.note || '',
    });
  },

  onCloseFeedback() {
    this.setData({ showFeedback: false });
  },

  onToggleCloudSea() {
    const v = this.data.fbCloudSea;
    // null -> true -> false -> null
    this.setData({ fbCloudSea: v === null ? true : (v === true ? false : null) });
  },

  onToggleGlow() {
    const v = this.data.fbGlow;
    this.setData({ fbGlow: v === null ? true : (v === true ? false : null) });
  },

  onToggleStars() {
    const v = this.data.fbStars;
    this.setData({ fbStars: v === null ? true : (v === true ? false : null) });
  },

  onSetRating(e) {
    const rating = Number(e.currentTarget.dataset.rating);
    this.setData({ fbRating: this.data.fbRating === rating ? null : rating });
  },

  onFeedbackNoteInput(e) {
    this.setData({ fbNote: e.detail.value });
  },

  onSubmitFeedback() {
    const { currentFeedback, fbCloudSea, fbGlow, fbStars, fbRating, fbNote } = this.data;
    if (!currentFeedback) {
      wx.showToast({ title: '暂无预测记录', icon: 'none' });
      return;
    }

    const actualData = {
      cloudSea: fbCloudSea,
      glow: fbGlow,
      stars: fbStars,
      rating: fbRating,
      note: fbNote,
    };

    const ok = feedback.updateFeedback(currentFeedback.id, actualData);
    if (ok) {
      const stats = feedback.getFeedbackStats();
      this.setData({
        feedbackStats: stats,
        feedbackRecords: feedback.getFeedbackRecords(),
      });
      wx.showToast({ title: '反馈已保存 ✓', icon: 'success' });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onGoHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onExportFeedback() {
    const csv = feedback.exportFeedbackCSV();
    if (!csv) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: csv,
      success() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
    });
  },

  async fetchFusion(lat, lon) {
    this.setData({ fusionLoading: true, fusionResult: null });

    try {
      const modelResults = await fusion.fetchMultiModelWeather(lat, lon);
      const result = fusion.fuseModelPredictions(modelResults, this.data.elevation, this.data.selectedDayIndex);

      if (result) {
        this.setData({ fusionResult: result, fusionLoading: false });
      } else {
        this.setData({ fusionLoading: false });
      }
    } catch (err) {
      console.warn('多模式融合失败:', err.message);
      this.setData({ fusionLoading: false });
    }
  },

  onToggleHourly() {
    this.setData({ showHourly: !this.data.showHourly });
  },

  onToggleFusion() {
    this.setData({ showFusion: !this.data.showFusion });
  },
});
