const calc = require('../../utils/calculations');
const api = require('../../utils/services');
const fusion = require('../../utils/fusion');

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
  },

  onLoad() {
    this.fetchAll(this.data.lat, this.data.lon);
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
      const result = await api.geocodeAddress(address);
      this.setData({
        lat: result.latitude,
        lon: result.longitude,
        locationName: result.name,
      });
      await this.fetchAll(result.latitude, result.longitude);
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
    const sunset = daily?.sunset?.[selectedDayIndex];
    const guidance = calc.buildObservationGuidance({
      analysis: dayAnalysis.bestHour || analysis,
      currentElevation: elevation,
      sunriseTime: sunrise,
      sunsetTime: sunset,
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
