/**
 * Web multi-model fusion module (adapted from miniprogram/utils/fusion.js)
 * wx.request → fetch (via CS._webRequest from services.js)
 * require('./calculations') → CS.calc (must be loaded before this script)
 */
(function(global) {
  'use strict';

  var CS = global.CloudSea = global.CloudSea || {};

  var MODELS = [
    { id: 'icon_seamless', name: 'ICON（德国）', weight: 1.0 },
    { id: 'gfs_seamless', name: 'GFS（美国）', weight: 1.0 },
    { id: 'jma_seamless', name: 'JMA（日本）', weight: 1.2 },
    { id: 'ecmwf_ifs025', name: 'ECMWF（欧洲）', weight: 1.5 },
  ];

  function webRequest(url, options) {
    // Reuse the webRequest from services.js if available, otherwise inline
    if (CS._webRequest) return CS._webRequest(url, options);

    var opts = options || {};
    var timeoutMs = opts.timeoutMs || 12000;

    return new Promise(function(resolve, reject) {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
      fetch(url, { signal: controller.signal })
        .then(function(res) {
          clearTimeout(timer);
          if (res.ok) return res.json();
          throw new Error('HTTP ' + res.status);
        })
        .then(resolve)
        .catch(function(err) {
          clearTimeout(timer);
          if (err.name === 'AbortError') err = new Error('请求超时');
          reject(err);
        });
    });
  }

  /**
   * Fetch weather from a single model
   */
  async function fetchModelWeather(lat, lon, modelId) {
    var params = [
      'latitude=' + lat,
      'longitude=' + lon,
      'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,visibility,precipitation_probability,wind_speed_10m,weather_code,cape,is_day',
      'daily=sunrise,sunset',
      'timezone=Asia/Shanghai',
      'model=' + modelId,
      'forecast_days=3',
    ].join('&');

    var data = await webRequest('https://api.open-meteo.com/v1/forecast?' + params, {
      timeoutMs: 12000,
    });

    if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) {
      throw new Error(modelId + ': 数据格式无效');
    }

    return data;
  }

  /**
   * Fetch multiple models in parallel with graceful degradation
   */
  async function fetchMultiModelWeather(lat, lon) {
    var results = await Promise.allSettled(
      MODELS.map(async function(model) {
        try {
          var data = await fetchModelWeather(lat, lon, model.id);
          return { model: model, data: data, success: true };
        } catch (err) {
          console.warn('模式 ' + model.name + ' 获取失败:', err.message);
          return { model: model, data: null, success: false, error: err.message };
        }
      })
    );

    var successful = results
      .filter(function(r) { return r.status === 'fulfilled' && r.value.success; })
      .map(function(r) { return r.value; });

    if (successful.length === 0) {
      throw new Error('所有气象模式均获取失败');
    }

    return successful;
  }

  /**
   * Analyze cloud sea for each model and fuse the results
   */
  function fuseModelPredictions(modelResults, elevation, dayIndex) {
    if (dayIndex == null) dayIndex = 0;
    var calc = CS.calc;
    if (!calc) throw new Error('CS.calc not loaded — include calculations.js before fusion.js');

    var start = dayIndex * 24;
    var analyses = [];

    for (var mi = 0; mi < modelResults.length; mi++) {
      var result = modelResults[mi];
      try {
        var analysis = calc.analyzeDayCloudSea(result.data.hourly, start, elevation, result.data.daily && result.data.daily.sunrise ? result.data.daily.sunrise[dayIndex] : undefined);
        analyses.push({
          modelName: result.model.name,
          modelWeight: result.model.weight,
          score: analysis.score,
          suggestion: analysis.suggestion,
          confidenceLabel: analysis.confidenceLabel,
          bestHour: analysis.bestHour,
          cloudBases: analysis.cloudBases,
          temperatures: analysis.temperatures,
          humidities: analysis.humidities,
          inversion: analysis.inversion,
        });
      } catch (err) {
        console.warn('模式 ' + result.model.name + ' 分析失败:', err.message);
      }
    }

    if (analyses.length === 0) {
      return null;
    }

    // Weighted average score
    var totalWeight = 0;
    var weightedScore = 0;
    var scores = [];

    for (var ai = 0; ai < analyses.length; ai++) {
      weightedScore += analyses[ai].score * analyses[ai].modelWeight;
      totalWeight += analyses[ai].modelWeight;
      scores.push(analyses[ai].score);
    }

    var fusedScore = Math.round(weightedScore / totalWeight);

    // Model agreement: standard deviation of scores
    var mean = scores.reduce(function(s, v) { return s + v; }, 0) / scores.length;
    var variance = scores.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / scores.length;
    var stdDev = Math.sqrt(variance);

    // Agreement level
    var agreement;
    if (stdDev <= 5) {
      agreement = { level: 'high', label: '模式高度一致', color: '#28a745' };
    } else if (stdDev <= 12) {
      agreement = { level: 'medium', label: '模式基本一致', color: '#f0ad4e' };
    } else {
      agreement = { level: 'low', label: '模式分歧较大', color: '#dc3545' };
    }

    // Fused confidence
    var fusedConfidence = calc.scoreToConfidence(fusedScore);

    // Best time consensus
    var bestTimes = analyses
      .filter(function(a) { return a.bestHour && a.bestHour.timeLabel; })
      .map(function(a) { return a.bestHour.timeLabel; });
    var timeConsensus = bestTimes.length > 0 ? mostFrequent(bestTimes) : null;

    // Inversion consensus
    var inversionsDetected = analyses.filter(function(a) { return a.inversion && a.inversion.detected; }).length;
    var inversionConsensus = inversionsDetected > analyses.length / 2;

    return {
      fusedScore: fusedScore,
      fusedConfidence: fusedConfidence,
      fusedSuggestion: fusedScore >= 55,
      agreement: agreement,
      stdDev: Math.round(stdDev * 10) / 10,
      modelCount: analyses.length,
      timeConsensus: timeConsensus,
      inversionConsensus: inversionConsensus,
      inversionsDetected: inversionsDetected,
      modelDetails: analyses.map(function(a) {
        return {
          name: a.modelName,
          score: a.score,
          suggestion: a.suggestion,
          label: a.confidenceLabel,
        };
      }),
      resultText: fusedScore >= 55
        ? fusedConfidence.label + '（融合 ' + fusedScore + ' 分）'
        : '概率偏低（融合 ' + fusedScore + ' 分）',
      summary: generateFusedSummary(fusedScore, analyses, agreement, inversionConsensus),
    };
  }

  function generateFusedSummary(fusedScore, analyses, agreement, inversionConsensus) {
    var parts = [];

    parts.push('综合 ' + analyses.length + ' 个气象模式（' + analyses.map(function(a) { return a.modelName; }).join('、') + '）');

    if (agreement.level === 'high') {
      parts.push('各模式预测高度一致');
    } else if (agreement.level === 'low') {
      parts.push('各模式存在较大分歧，建议谨慎参考');
    }

    if (inversionConsensus) {
      parts.push('多数模式检测到逆温层，有利于云海形成');
    }

    if (fusedScore >= 55) {
      parts.push('整体条件具备云海观测潜力。');
    } else {
      parts.push('整体条件一般，更适合作为参考。');
    }

    return parts.join('，') + (parts[parts.length - 1].slice(-1) === '。' ? '' : '。');
  }

  function mostFrequent(arr) {
    var counts = {};
    var maxCount = 0;
    var maxItem = arr[0];

    for (var i = 0; i < arr.length; i++) {
      counts[arr[i]] = (counts[arr[i]] || 0) + 1;
      if (counts[arr[i]] > maxCount) {
        maxCount = counts[arr[i]];
        maxItem = arr[i];
      }
    }

    return maxItem;
  }

  // ===== Export to namespace =====

  CS.fusion = {
    fetchMultiModelWeather: fetchMultiModelWeather,
    fuseModelPredictions: fuseModelPredictions,
    MODELS: MODELS,
  };

})(window);
