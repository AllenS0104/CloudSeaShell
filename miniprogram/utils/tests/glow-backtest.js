/**
 * 晚霞（火烧云）回测验证脚本 — 用真实观测数据验证 sunset.js 评分引擎
 * Run with: node utils/tests/glow-backtest.js
 *
 * 与 backtest.js（云海）平行的晚霞真值集。
 *
 * 【重要】必须使用 historical-forecast-api.open-meteo.com。
 * archive-api 对 visibility / aerosol / 气压层要素一律返回 null，
 * 会让回测在一个被降级的特征集上打分（云海回测曾踩过这个坑）。
 *
 * 【数据规模】当前样本极少（n=1），**不足以用于权重标定**。
 * 本文件的目的是先把采集与评估管线建好，样本靠日常观测逐步累积。
 * 建议达到 ≥60 条（其中负样本 ≥25 条）后再据此调参。
 *
 * 【intensity 分级】沿用中文摄影圈通用口径：
 *   0 = 无霞    1 = 小烧    2 = 中烧    3 = 大烧    4 = 爆烧
 */

if (typeof wx === 'undefined') {
  global.wx = {
    request: () => {},
    getStorageSync: () => null,
    setStorageSync: () => {},
  };
}

const https = require('https');
const fs = require('fs');
const path = require('path');
const sunset = require('../sunset');

/**
 * 晚霞观测真值。
 * observed: 是否出现值得一看的霞光（intensity >= 2 视为正样本）
 * intensity: 0-4，见上方分级说明
 */
const observations = [
  // === 小红书 @大鹏爱自由（北京晚霞预测博主，长期发布定量预测帖）===
  // 注：这一条是博主的【预测】而非事后返图，intensity 为其预报值，
  //     待补充实际观测结果后再作为真值使用。
  {
    date: '2026-07-29',
    location: '北京（全市）',
    lat: 39.909,
    lon: 116.461,
    isEvening: true,
    observed: true,
    intensity: 2,
    source: 'xhs:大鹏爱自由',
    note: '博主预报"通透性中烧晚霞"，依据：湿度>80%、无雨、高空云量不多、中层云轻薄；最佳时段 19:10-20:10',
    verified: false, // 尚未用事后返图核实
  },
];

const CACHE_FILE = path.join(__dirname, '.glow-backtest-cache.json');
const HOURLY = [
  'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'precipitation', 'precipitation_probability', 'wind_speed_10m',
].join(',');
const AQ_HOURLY = 'pm2_5,pm10,aerosol_optical_depth,dust';

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch (e) {
    console.warn('缓存写入失败:', e.message);
  }
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.reason || parsed.error));
          else resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse failed: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchObservationData(obs, cache) {
  const key = `${obs.date}_${obs.lat}_${obs.lon}`;
  if (cache[key]) return cache[key];

  const q = `latitude=${obs.lat}&longitude=${obs.lon}&start_date=${obs.date}&end_date=${obs.date}&timezone=Asia/Shanghai`;
  const weather = await getJSON(
    `https://historical-forecast-api.open-meteo.com/v1/forecast?${q}&hourly=${HOURLY}&daily=sunrise,sunset`
  );
  const aq = await getJSON(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=${AQ_HOURLY}`
  ).catch(() => null);

  const payload = { weather, aq };
  cache[key] = payload;
  saveCache(cache);
  return payload;
}

function toAerosolSeries(aq) {
  if (!aq?.hourly?.time) return null;
  return {
    time: aq.hourly.time,
    pm2_5: aq.hourly.pm2_5,
    pm10: aq.hourly.pm10,
    aerosolOpticalDepth: aq.hourly.aerosol_optical_depth,
    dust: aq.hourly.dust,
  };
}

async function runGlowBacktest() {
  console.log('🌇 晚霞（火烧云）预测回测');
  console.log(`📊 样本 × ${observations.length} 条`);
  if (observations.length < 60) {
    console.log('⚠️  样本量不足，结果仅供管线自检，不可用于权重标定。');
  }
  console.log('='.repeat(78));

  const cache = loadCache();
  const results = [];

  for (const obs of observations) {
    try {
      const { weather, aq } = await fetchObservationData(obs, cache);
      if (!weather?.hourly?.time?.length) {
        console.log(`⚠️  ${obs.date} ${obs.location}: 无天气数据`);
        continue;
      }

      const analysis = sunset.analyzeDayGlow(
        weather.hourly,
        0,
        weather.daily?.sunrise?.[0],
        weather.daily?.sunset?.[0],
        toAerosolSeries(aq)
      );

      const best = obs.isEvening === false
        ? (analysis.bestSunrise || analysis.bestSunset)
        : (analysis.bestSunset || analysis.bestSunrise);
      if (!best) {
        console.log(`⚠️  ${obs.date} ${obs.location}: 无有效时段`);
        continue;
      }

      const predicted = best.score >= 50;
      const hit = predicted === obs.observed;
      results.push({ obs, best, predicted, hit });

      console.log(
        `${hit ? '✅' : '❌'} ${obs.date} ${obs.location.padEnd(12)} ` +
        `实测 ${obs.observed ? '有霞' : '无霞'}(强度${obs.intensity}) | ` +
        `预测 ${String(best.score).padStart(3)} 分 ${best.label}`
      );
      console.log(
        `    分项 中层云+${best.midScore} 高层云+${best.highScore} 湿度+${best.humidityScore} ` +
        `能见度+${best.visScore} 时段+${best.timeScore} 气溶胶${best.aerosolScore >= 0 ? '+' : ''}${best.aerosolScore} ` +
        `| 低云-${best.lowPenalty} 降水-${best.penalty}`
      );
      if (obs.note) console.log(`    备注 ${obs.note}`);

      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.log(`⚠️  ${obs.date} ${obs.location}: ${e.message}`);
    }
  }

  console.log('='.repeat(78));
  const n = results.length;
  if (!n) {
    console.log('无有效结果。');
    return { results: [], accuracy: 0 };
  }
  // 与 scripts/xhs-ingest.js 的质量闸门保持一致：
  // 未经事后返图核实的样本（如博主的"预报帖"）不得计入准确率，否则是循环论证。
  const scored = results.filter((r) => r.obs.verified !== false);
  const skipped = n - scored.length;
  if (skipped) console.log(`⏭️  ${skipped} 条未核实样本（预报帖/待补返图）不计入指标`);
  if (!scored.length) {
    console.log('无可计入指标的已核实样本。请先补充实拍返图类观测。');
    return { results, accuracy: null };
  }
  const hits = scored.filter((r) => r.hit).length;
  const positives = scored.filter((r) => r.obs.observed).length;
  console.log(`命中 ${hits}/${scored.length}（${((100 * hits) / scored.length).toFixed(0)}%）| 正样本占比 ${((100 * positives) / scored.length).toFixed(0)}%`);
  if (positives === scored.length || positives === 0) {
    console.log('⚠️  样本单一类别，准确率无判别意义（"全猜有霞"即可达到同等分数）。');
  }
  return { results, accuracy: hits / scored.length };
}

if (require.main === module) {
  runGlowBacktest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { observations, runGlowBacktest, fetchObservationData };
