/**
 * Build ML training dataset from backtest observations
 * Run: node utils/tests/build-dataset.js
 * Output: utils/tests/ml-dataset.csv
 */

if (typeof wx === 'undefined') {
  global.wx = { request:()=>{}, getStorageSync:()=>null, setStorageSync:()=>{} };
}

const https = require('https');
const fs = require('fs');
const path = require('path');
const calc = require('../calculations');

const observations = [
  // === 2026年4月 正样本 (小红书) ===
  { date: '2026-04-23', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true, likes: 12, source: 'xhs' },
  { date: '2026-04-23', location: '张家界金鞭', lat: 29.32, lon: 110.43, elevation: 1262, observed: true, likes: 2, source: 'xhs' },
  { date: '2026-04-22', location: '北京妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 8, source: 'xhs' },
  { date: '2026-04-22', location: '北山', lat: 30.35, lon: 120.06, elevation: 800, observed: true, likes: 1, source: 'xhs' },
  { date: '2026-04-21', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 16, source: 'xhs' },
  { date: '2026-04-20', location: '午山', lat: 36.05, lon: 117.02, elevation: 680, observed: true, likes: 17, source: 'xhs' },
  { date: '2026-04-19', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 9, source: 'xhs' },
  { date: '2026-04-19', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 3, source: 'xhs' },
  { date: '2026-04-18', location: '太子尖', lat: 29.95, lon: 119.47, elevation: 1480, observed: true, likes: 1, source: 'xhs' },
  { date: '2026-04-18', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 67, source: 'xhs' },
  { date: '2026-04-17', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 144, source: 'xhs' },
  { date: '2026-04-16', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 89, source: 'xhs' },
  { date: '2026-04-10', location: '绝石梁', lat: 30.02, lon: 119.43, elevation: 1530, observed: true, likes: 32, source: 'xhs' },
  { date: '2026-04-10', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 45, source: 'xhs' },
  { date: '2026-04-10', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 283, source: 'xhs' },
  { date: '2026-04-09', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs' },
  { date: '2026-04-06', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 29, source: 'xhs' },
  { date: '2026-04-05', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 1575, source: 'xhs' },
  { date: '2026-04-04', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 1561, source: 'xhs' },
  { date: '2026-04-04', location: '峨眉山金顶', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 5, source: 'xhs' },
  { date: '2026-04-02', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 5, source: 'xhs' },
  { date: '2026-03-31', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 18, source: 'xhs' },
  { date: '2026-03-26', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 131, source: 'xhs' },
  { date: '2026-03-18', location: '峨眉山金顶', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 728, source: 'xhs' },
  { date: '2026-03-18', location: '太皇山(甘肃)', lat: 34.73, lon: 104.63, elevation: 2100, observed: true, likes: 150, source: 'youtube' },
  { date: '2026-03-06', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 225, source: 'xhs' },
  { date: '2026-02-25', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 54, source: 'xhs' },
  { date: '2026-02-21', location: '峨眉山金顶', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 6, source: 'xhs' },
  { date: '2026-02-20', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 8, source: 'xhs' },
  { date: '2026-02-09', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 26, source: 'xhs' },
  // === 2025年 历史正样本 ===
  { date: '2025-10-11', location: '北京妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 247, source: 'xhs' },
  { date: '2025-09-15', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 471, source: 'xhs' },
  { date: '2025-08-16', location: '北灵山', lat: 39.97, lon: 115.50, elevation: 2240, observed: true, likes: 183, source: 'xhs' },
  { date: '2025-08-02', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 492, source: 'xhs' },
  { date: '2025-07-05', location: '东灵山', lat: 39.97, lon: 115.46, elevation: 2303, observed: true, likes: 257, source: 'xhs' },
  { date: '2025-03-15', location: '千佛山', lat: 36.64, lon: 117.05, elevation: 285, observed: true, likes: 687, source: 'bilibili' },
  // === 2024年 正样本 (搜索结果 + 历史云海记录) ===
  { date: '2024-12-22', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-12-15', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-12-01', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-11-24', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-11-17', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-11-10', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-11-03', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-10-27', location: '庐山', lat: 29.56, lon: 115.97, elevation: 1474, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-10-20', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-10-13', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-10-06', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-10-01', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-09-22', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-09-15', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-09-08', location: '达瓦更扎', lat: 30.10, lon: 102.47, elevation: 3866, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-09-01', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-08-18', location: '北灵山', lat: 39.97, lon: 115.50, elevation: 2240, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-08-11', location: '东灵山', lat: 39.97, lon: 115.46, elevation: 2303, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-05-19', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-05-12', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-05-05', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-04-28', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-04-21', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-04-14', location: '庐山', lat: 29.56, lon: 115.97, elevation: 1474, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-04-07', location: '达瓦更扎', lat: 30.10, lon: 102.47, elevation: 3866, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-03-31', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-03-24', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-03-17', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-03-10', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-03-03', location: '光雾山', lat: 32.53, lon: 106.68, elevation: 2507, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-02-25', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-02-18', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-02-11', location: '四明山', lat: 29.77, lon: 121.07, elevation: 900, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-01-28', location: '牛背山', lat: 29.66, lon: 102.35, elevation: 3660, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-01-21', location: '峨眉山', lat: 29.52, lon: 103.33, elevation: 3077, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-01-14', location: '莫干山', lat: 30.63, lon: 119.87, elevation: 719, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2024-01-07', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: true, likes: 0, source: 'xhs-search' },
  // === Wave 2: 光雾山 正样本 (小红书搜索) ===
  { date: '2025-10-27', location: '光雾山', lat: 32.53, lon: 106.68, elevation: 2507, observed: true, likes: 18, source: 'xhs-search' },
  { date: '2025-10-29', location: '光雾山', lat: 32.53, lon: 106.68, elevation: 2507, observed: true, likes: 48, source: 'xhs-search' },
  { date: '2025-10-30', location: '光雾山', lat: 32.53, lon: 106.68, elevation: 2507, observed: true, likes: 30, source: 'xhs-search' },
  { date: '2025-11-29', location: '光雾山', lat: 32.53, lon: 106.68, elevation: 2507, observed: true, likes: 6, source: 'xhs-search' },
  // === Wave 2: 大别山 正样本 (小红书搜索) ===
  { date: '2026-04-14', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 15, source: 'xhs-search' },
  { date: '2026-04-04', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 31, source: 'xhs-search' },
  { date: '2026-03-13', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 17, source: 'xhs-search' },
  { date: '2026-02-18', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 33, source: 'xhs-search' },
  { date: '2025-11-17', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 0, source: 'xhs-search' },
  { date: '2025-11-16', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 6, source: 'xhs-search' },
  { date: '2025-10-05', location: '大别山', lat: 31.13, lon: 115.78, elevation: 1729, observed: true, likes: 13, source: 'xhs-search' },
  // === 负样本 ===
  { date: '2026-04-23', location: '梅里雪山', lat: 28.45, lon: 98.67, elevation: 3500, observed: false, likes: 1, source: 'xhs' },
  { date: '2026-04-20', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 39, source: 'xhs' },
  { date: '2026-04-17', location: '绝石梁', lat: 30.02, lon: 119.43, elevation: 1530, observed: false, likes: 8, source: 'xhs' },
  { date: '2025-12-28', location: '未知山', lat: 30.0, lon: 119.0, elevation: 1000, observed: false, likes: 1, source: 'xhs' },
  { date: '2025-11-08', location: '未知山B', lat: 30.0, lon: 118.0, elevation: 1200, observed: false, likes: 41, source: 'xhs' },
  { date: '2025-09-22', location: '未知山C', lat: 30.0, lon: 119.0, elevation: 1000, observed: false, likes: 10, source: 'xhs' },
  { date: '2025-08-17', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 4, source: 'xhs' },
  { date: '2025-06-15', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 10, source: 'xhs' },
  // === 2024年 负样本 (搜索结果) ===
  { date: '2024-12-08', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-11-30', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-10-19', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-09-28', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-08-25', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-07-14', location: '黄山', lat: 30.13, lon: 118.17, elevation: 1864, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-07-07', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-06-16', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-06-02', location: '三清山', lat: 28.91, lon: 118.06, elevation: 1817, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-05-26', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-04-15', location: '妙峰山', lat: 39.97, lon: 116.06, elevation: 1291, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-03-20', location: '庐山', lat: 29.56, lon: 115.97, elevation: 1474, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-02-04', location: '武功山', lat: 27.51, lon: 114.15, elevation: 1918, observed: false, likes: 0, source: 'xhs-search' },
  { date: '2024-01-15', location: '泰山', lat: 36.25, lon: 117.10, elevation: 1545, observed: false, likes: 0, source: 'xhs-search' },
];

function fetchWeather(lat, lon, date) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const targetDate = new Date(date);
    const daysDiff = (now - targetDate) / (1000 * 60 * 60 * 24);
    const baseUrl = daysDiff > 14
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const params = [
      `latitude=${lat}`, `longitude=${lon}`,
      `start_date=${date}`, `end_date=${date}`,
      'hourly=temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,precipitation',
      'daily=sunrise,sunset',
      'timezone=Asia/Shanghai',
    ].join('&');

    https.get(`${baseUrl}?${params}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.reason || 'API error'));
          else resolve(parsed);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function buildDataset() {
  const rows = [];
  const header = [
    'date', 'location', 'lat', 'lon', 'elevation', 'month',
    'rule_score', 'humidity', 'dew_gap', 'cloud_cover', 'low_cloud_cover',
    'low_cloud_ratio', 'wind_speed', 'pressure', 'inversion_detected',
    'observed'
  ];
  rows.push(header.join(','));

  console.log(`Building dataset from ${observations.length} observations...`);

  for (const obs of observations) {
    try {
      await new Promise(r => setTimeout(r, 500));
      const weather = await fetchWeather(obs.lat, obs.lon, obs.date);
      if (!weather?.hourly?.time?.length) {
        console.log(`⚠️ Skip ${obs.location} ${obs.date} — no data`);
        continue;
      }

      const sunrise = weather.daily?.sunrise?.[0];
      const analysis = calc.analyzeDayCloudSea(weather.hourly, 0, obs.elevation, sunrise);

      // Extract features from the best hour analysis
      const best = analysis.bestHour || analysis;
      const month = new Date(obs.date).getMonth() + 1;
      const lowCloudRatio = best.cloudCover > 0 ? (best.lowCloudCover / best.cloudCover) : 0;

      const row = [
        obs.date,
        `"${obs.location}"`,
        obs.lat,
        obs.lon,
        obs.elevation,
        month,
        analysis.score,           // rule_score — primary feature
        Math.round(best.humidity || 0),
        (best.dewPointGap || 0).toFixed(1),
        Math.round(best.cloudCover || 0),
        Math.round(best.lowCloudCover || 0),
        lowCloudRatio.toFixed(2),
        (best.windSpeed || 0).toFixed(1),
        Math.round(best.pressureMsl || 0),
        analysis.inversion?.detected ? 1 : 0,
        obs.observed ? 1 : 0
      ];

      rows.push(row.join(','));
      console.log(`✅ ${obs.date} ${obs.location} — score=${analysis.score} label=${obs.observed ? 1 : 0}`);
    } catch(err) {
      console.log(`⚠️ Skip ${obs.location} ${obs.date} — ${err.message}`);
    }
  }

  const csvPath = path.join(__dirname, 'ml-dataset.csv');
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
  console.log(`\n✅ Dataset saved: ${csvPath} (${rows.length - 1} samples)`);
}

buildDataset().catch(err => { console.error(err); process.exit(1); });
