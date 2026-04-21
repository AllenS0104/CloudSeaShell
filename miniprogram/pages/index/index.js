const calc = require('../../utils/calculations');
const api = require('../../utils/services');
const fusion = require('../../utils/fusion');
const photo = require('../../utils/photography');
const presets = require('../../utils/camera-presets');
const sunsetModule = require('../../utils/sunset');

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
    if (e.detail?.latitude && e.detail?.longitude) {
      this.setData({
        lat: e.detail.latitude,
        lon: e.detail.longitude,
        locationName: `${e.detail.latitude.toFixed(2)}, ${e.detail.longitude.toFixed(2)}`,
      });
      this.fetchAll(e.detail.latitude, e.detail.longitude);
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

      const daySet = new Set(weatherData.hourly.time.map(t => t.split('T')[0]));
      const dayLabels = Array.from(daySet).map((date, i) => {
        const d = new Date(date);
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
        return i === 0 ? `${d.getMonth() + 1}月${d.getDate()}日${weekday} (今天)` : `${d.getMonth() + 1}月${d.getDate()}日${weekday}`;
      });

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
    const { weatherData, elevation, selectedDayIndex } = this.data;
    if (!weatherData) return;

    const hourly = weatherData.hourly;
    const daily = weatherData.daily;
    const current = weatherData.current;
    const start = selectedDayIndex * 24;

    // Day analysis
    const dayAnalysis = calc.analyzeDayCloudSea(hourly, start, elevation);

    // Current analysis (for day 0)
    let analysis = dayAnalysis;
    if (selectedDayIndex === 0 && current) {
      const currentAnalysis = calc.analyzeCurrentCloudSea(current, elevation);
      analysis = { ...dayAnalysis, ...currentAnalysis };
    }

    // Guidance
    const sunrise = daily?.sunrise?.[selectedDayIndex];
    const sunsetVal = daily?.sunset?.[selectedDayIndex];
    const guidance = calc.buildObservationGuidance({
      analysis: dayAnalysis.bestHour || analysis,
      currentElevation: elevation,
      sunriseTime: sunrise,
      sunsetTime: sunsetVal,
      bestTimeLabel: dayAnalysis.bestHour?.timeLabel,
    });

    // Current stats
    const currentTemp = current ? Number(current.temperature_2m).toFixed(1) : dayAnalysis.temperatures[0]?.toFixed(1) || '--';
    const currentDewGap = current
      ? calc.dewPointSpread(current.temperature_2m, current.dew_point_2m)
      : calc.dewPointSpread(dayAnalysis.temperatures[0], dayAnalysis.dewPoints[0]);

    // Hourly list
    const times = hourly.time.slice(start, start + 24);
    const hourlyList = times.map((t, i) => ({
      time: t.slice(11, 16),
      temp: dayAnalysis.temperatures[i]?.toFixed(1) || '--',
      cloudBase: dayAnalysis.cloudBases[i] || 0,
      precip: dayAnalysis.precipitationProbabilities[i]?.toFixed(0) || '0',
    }));

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
      currentFeelsLike: dayAnalysis.temperatures.length > 0 ? calc.minOrZero(dayAnalysis.temperatures).toFixed(1) : '--',
      currentHumidity: current ? Math.round(Number(current.relative_humidity_2m)) : Math.round(calc.maxOrZero(dayAnalysis.humidities)),
      currentWind: current ? Number(current.wind_speed_10m).toFixed(1) : calc.maxOrZero(dayAnalysis.windSpeeds).toFixed(1),
      currentCloudCover: current ? Math.round(calc.getCurrentCloudCover(current)) : Math.round(calc.maxOrZero(dayAnalysis.cloudCover)),
      currentDewGap: currentDewGap.toFixed(1),
      hourlyList,
    });

    // Generate photography recommendations
    const bestHourTime = dayAnalysis.bestHour?.timeLabel
      ? hourly.time.slice(start, start + 24).find(t => t.includes(dayAnalysis.bestHour.timeLabel?.replace(':', ''))) || hourly.time[start]
      : hourly.time[start];
    const photoParams = photo.generatePhotoRecommendations({
      timeString: current?.time || bestHourTime,
      sunriseTime: sunrise,
      sunsetTime: sunsetVal,
      cloudCover: analysis.cloudCover,
      visibility: analysis.visibility,
      windSpeed: analysis.windSpeed,
      cloudSeaScore: analysis.score,
      elevation,
    });
    this.setData({ photoParams });

    // Sunset glow analysis
    const glowResult = sunsetModule.analyzeDayGlow(hourly, start, sunrise, sunsetVal);
    this.setData({
      glowAnalysis: {
        score: glowResult.score,
        level: glowResult.level,
        label: glowResult.label,
        resultText: glowResult.resultText,
        summary: glowResult.summary,
        reasons: glowResult.reasons,
        bestSunrise: glowResult.bestSunrise ? { score: glowResult.bestSunrise.score, label: glowResult.bestSunrise.label } : null,
        bestSunset: glowResult.bestSunset ? { score: glowResult.bestSunset.score, label: glowResult.bestSunset.label } : null,
      },
    });

    // Safety alerts
    const alerts = [];
    const capeValues = (hourly.cape ?? []).slice(start, start + 24).map(v => Number(v ?? 0));
    const maxCape = capeValues.length ? Math.max(...capeValues) : 0;
    if (maxCape >= 1000) {
      alerts.push({ type: 'danger', icon: '⛈️', text: `雷暴风险：CAPE ${Math.round(maxCape)} J/kg，山顶远离金属物体` });
    } else if (maxCape >= 500) {
      alerts.push({ type: 'warning', icon: '🌩️', text: `对流发展中：CAPE ${Math.round(maxCape)} J/kg，注意天气变化` });
    }

    const apparentTemp = current?.apparent_temperature ?? null;
    if (apparentTemp !== null && apparentTemp < 5) {
      alerts.push({ type: 'warning', icon: '🥶', text: `体感温度仅 ${Number(apparentTemp).toFixed(1)}°C，注意防寒保暖` });
    }

    if (elevation > 1500) {
      alerts.push({ type: 'info', icon: '⛰️', text: '高海拔区域注意防晒和补水，紫外线显著增强' });
    }

    this.setData({ safetyAlerts: alerts });
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
});
