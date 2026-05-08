/**
 * Multi-source weather fusion for cloud-sea prediction
 *
 * Fetches multiple weather models from Open-Meteo and produces
 * a fused prediction with cross-model consistency metrics.
 *
 * Models used (all free via Open-Meteo):
 * - ICON (DWD, Germany) — high-res Europe/global
 * - GFS (NOAA, USA) — global standard
 * - JMA (Japan) — good for East Asia
 * - CMA (China Meteorological Administration) — best for China
 * - ECMWF (European Centre) — gold standard global
 */

const calc = require('./calculations');

const MODELS = [
  { id: 'icon_seamless', name: 'ICON（德国）', weight: 1.0 },
  { id: 'gfs_seamless', name: 'GFS（美国）', weight: 1.0 },
  { id: 'jma_seamless', name: 'JMA（日本）', weight: 1.2 },
  { id: 'ecmwf_ifs025', name: 'ECMWF（欧洲）', weight: 1.5 },
];

// CMA (GFS-based Chinese model) is available via the standard endpoint
// Open-Meteo uses 'best_match' which already blends CMA for China regions

function wxRequest(url, options = {}) {
  const { timeoutMs = 12000 } = options;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      timeout: timeoutMs,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

/**
 * Fetch weather from a single model
 */
async function fetchModelWeather(lat, lon, modelId) {
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,visibility,precipitation_probability,wind_speed_10m,weather_code,cape,is_day',
    'daily=sunrise,sunset',
    'timezone=Asia/Shanghai',
    `model=${modelId}`,
    'forecast_days=3',
  ].join('&');

  const data = await wxRequest(`https://api.open-meteo.com/v1/forecast?${params}`, {
    timeoutMs: 12000,
  });

  if (!data?.hourly?.time?.length) {
    throw new Error(`${modelId}: 数据格式无效`);
  }

  return data;
}

/**
 * Fetch multiple models in parallel with graceful degradation
 */
async function fetchMultiModelWeather(lat, lon) {
  const results = await Promise.allSettled(
    MODELS.map(async (model) => {
      try {
        const data = await fetchModelWeather(lat, lon, model.id);
        return { model, data, success: true };
      } catch (err) {
        console.warn(`模式 ${model.name} 获取失败:`, err.message);
        return { model, data: null, success: false, error: err.message };
      }
    }),
  );

  const successful = results
    .filter((r) => r.status === 'fulfilled' && r.value.success)
    .map((r) => r.value);

  if (successful.length === 0) {
    throw new Error('所有气象模式均获取失败');
  }

  return successful;
}

/**
 * Analyze cloud sea for each model and fuse the results
 */
function fuseModelPredictions(modelResults, elevation, dayIndex = 0) {
  const start = dayIndex * 24;
  const analyses = [];

  for (const result of modelResults) {
    try {
      const analysis = calc.analyzeDayCloudSea(result.data.hourly, start, elevation, result.data.daily?.sunrise?.[dayIndex]);
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
      console.warn(`模式 ${result.model.name} 分析失败:`, err.message);
    }
  }

  if (analyses.length === 0) {
    return null;
  }

  // Weighted average score
  let totalWeight = 0;
  let weightedScore = 0;
  const scores = [];

  for (const a of analyses) {
    weightedScore += a.score * a.modelWeight;
    totalWeight += a.modelWeight;
    scores.push(a.score);
  }

  const fusedScore = Math.round(weightedScore / totalWeight);

  // Model agreement: standard deviation of scores
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Agreement level
  let agreement;
  if (stdDev <= 5) {
    agreement = { level: 'high', label: '模式高度一致', color: '#28a745' };
  } else if (stdDev <= 12) {
    agreement = { level: 'medium', label: '模式基本一致', color: '#f0ad4e' };
  } else {
    agreement = { level: 'low', label: '模式分歧较大', color: '#dc3545' };
  }

  // Fused confidence
  const fusedConfidence = calc.scoreToConfidence(fusedScore);

  // Best time consensus
  const bestTimes = analyses
    .filter((a) => a.bestHour?.timeLabel)
    .map((a) => a.bestHour.timeLabel);
  const timeConsensus = bestTimes.length > 0
    ? mostFrequent(bestTimes)
    : null;

  // Inversion consensus
  const inversionsDetected = analyses.filter((a) => a.inversion?.detected).length;
  const inversionConsensus = inversionsDetected > analyses.length / 2;

  return {
    fusedScore,
    fusedConfidence,
    fusedSuggestion: fusedScore >= 55,
    agreement,
    stdDev: Math.round(stdDev * 10) / 10,
    modelCount: analyses.length,
    timeConsensus,
    inversionConsensus,
    inversionsDetected,
    modelDetails: analyses.map((a) => ({
      name: a.modelName,
      score: a.score,
      suggestion: a.suggestion,
      label: a.confidenceLabel,
    })),
    resultText: fusedScore >= 55
      ? `${fusedConfidence.label}（融合 ${fusedScore} 分）`
      : `概率偏低（融合 ${fusedScore} 分）`,
    summary: generateFusedSummary(fusedScore, analyses, agreement, inversionConsensus),
  };
}

function generateFusedSummary(fusedScore, analyses, agreement, inversionConsensus) {
  const parts = [];

  parts.push(`综合 ${analyses.length} 个气象模式（${analyses.map((a) => a.modelName).join('、')}）`);

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

  return parts.join('，') + (parts[parts.length - 1].endsWith('。') ? '' : '。');
}

function mostFrequent(arr) {
  const counts = {};
  let maxCount = 0;
  let maxItem = arr[0];

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }

  return maxItem;
}

module.exports = {
  fetchMultiModelWeather,
  fuseModelPredictions,
  MODELS,
};
