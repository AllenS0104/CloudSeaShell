#!/usr/bin/env node
/**
 * 特征实验室 —— 用真实样本检验「新特征是否真的有增益」
 *
 * 【为什么要有这个脚本】
 * 任何"加个特征准确率就会提升"的说法，在没跑数据之前都只是假设。
 * 物理上讲得通的特征，在实测里毫无增益甚至反向，是很常见的事。
 * 这个脚本的唯一目的：把候选特征和结果标签一起导出，让数据说话。
 *
 * 【与 prediction-audit 的分工】
 * prediction-audit 评估的是「现有模型」的判别力。
 * 这个脚本评估的是「候选特征」的潜在价值，不依赖现有评分逻辑。
 *
 * 关键设计：一次 API 调用拿 D-2 到 D 三天数据，这样前期降水这类
 * 时间维度特征才有原料。逐日单独取是拿不到的。
 *
 * 用法:
 *   node scripts/feature-lab.js            # 抓取并导出 data/features.csv
 *   node scripts/feature-lab.js --limit 50 # 小样本快速验证
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { observations } = require('../miniprogram/utils/tests/backtest');
const { buildControlDays } = require('../miniprogram/utils/tests/control-days');

const CACHE_FILE = path.resolve(__dirname, '../.feature-lab-cache.json');
const CACHE_VERSION = 1;

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (raw.__version !== CACHE_VERSION) return { __version: CACHE_VERSION };
    return raw;
  } catch (e) {
    return { __version: CACHE_VERSION };
  }
}
function saveCache(c) { fs.writeFileSync(CACHE_FILE, JSON.stringify(c)); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
      return undefined;
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 取 D-2 到 D 的逐小时数据。
 * timezone=auto 而非硬编码 Asia/Shanghai —— 样本遍布全球，
 * 用固定时区会让「日出前」「凌晨 0-4 点」这类时间窗对应到错误的当地时刻。
 */
async function fetchWindow(lat, lon, date) {
  const start = shiftDate(date, -2);
  const daysAgo = (Date.now() - new Date(`${date}T00:00:00Z`)) / 86400000;
  const base = daysAgo > 14
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';
  const hourly = [
    'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
    'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
    'wind_speed_10m', 'wind_direction_10m', 'precipitation',
  ].join(',');
  const url = `${base}?latitude=${lat}&longitude=${lon}`
    + `&start_date=${start}&end_date=${date}`
    + `&hourly=${hourly}&daily=sunrise,sunset&timezone=auto`;
  return getJson(url);
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);

/** 从三天窗口里提取候选特征。索引约定：最后 24 个点是目标日 D。 */
function extractFeatures(w, obs) {
  const t = w?.hourly?.time;
  if (!t || t.length < 48) return null;

  const n = t.length;
  const dayStart = t.findIndex((x) => x.startsWith(obs.date));
  if (dayStart < 0) return null;
  const D = (arr, i) => (arr && arr[i] != null ? arr[i] : null);
  const h = w.hourly;

  // 目标日的日出小时 —— 云海的观察窗口是日出前后
  const sunriseISO = w.daily?.sunrise?.[w.daily.sunrise.length - 1];
  const sunriseHour = sunriseISO ? Number(sunriseISO.slice(11, 13)) : 6;

  const idxAt = (hour) => dayStart + hour;
  const win = (from, to) => {
    const out = [];
    for (let i = idxAt(from); i <= idxAt(to) && i < n; i += 1) out.push(i);
    return out.filter((i) => i >= 0);
  };

  // 观察窗：日出前 1 小时到日出后 2 小时
  const obsWin = win(Math.max(0, sunriseHour - 1), Math.min(23, sunriseHour + 2));
  // 夜间辐射冷却窗：凌晨 0-4 点
  const nightWin = win(0, 4);
  // 前期降水：D-2 00:00 到 D 00:00，即目标日之前的全部
  const priorIdx = [];
  for (let i = 0; i < dayStart; i += 1) priorIdx.push(i);
  const prior24 = priorIdx.slice(-24);
  const prior48 = priorIdx;

  const pick = (arr, idxs) => idxs.map((i) => D(arr, i)).filter((v) => v != null);

  const f = {};

  // ── 现有类特征（观察窗内） ──
  f.humidity = avg(pick(h.relative_humidity_2m, obsWin));
  f.temp = avg(pick(h.temperature_2m, obsWin));
  f.dewSpread = avg(obsWin.map((i) => {
    const a = D(h.temperature_2m, i); const b = D(h.dew_point_2m, i);
    return a != null && b != null ? a - b : null;
  }).filter((v) => v != null));
  f.cloudLow = avg(pick(h.cloud_cover_low, obsWin));
  f.cloudMid = avg(pick(h.cloud_cover_mid, obsWin));
  f.cloudHigh = avg(pick(h.cloud_cover_high, obsWin));
  f.cloudTotal = avg(pick(h.cloud_cover, obsWin));
  f.wind = avg(pick(h.wind_speed_10m, obsWin));
  f.pressure = avg(pick(h.pressure_msl, obsWin));

  // ── 建议 1a：前期累计降水（"久雨初晴出云海"） ──
  f.precip24 = sum(pick(h.precipitation, prior24));
  f.precip48 = sum(pick(h.precipitation, prior48));
  f.precipToday = sum(pick(h.precipitation, win(0, 23)));
  f.wetThenClear = (f.precip24 > 1 && f.cloudTotal != null && f.cloudTotal < 60) ? 1 : 0;

  // ── 建议 1b：夜间辐射冷却（高空无云 → 强逆温） ──
  f.nightCloudHigh = avg(pick(h.cloud_cover_high, nightWin));
  f.nightCloudTotal = avg(pick(h.cloud_cover, nightWin));
  f.nightCloudLow = avg(pick(h.cloud_cover_low, nightWin));
  // 辐射冷却强度：夜间降温幅度，逆温的直接证据
  const nightTemps = pick(h.temperature_2m, nightWin);
  const eveIdx = win(18, 23);
  const eveTemps = pick(h.temperature_2m, eveIdx.map((i) => i - 24)).filter((v) => v != null);
  f.nightCooling = (eveTemps.length && nightTemps.length)
    ? avg(eveTemps) - Math.min(...nightTemps) : null;

  // ── 建议 1c：风向（后续与坡向叉乘用） ──
  const wd = pick(h.wind_direction_10m, obsWin);
  f.windDir = wd.length ? wd[Math.floor(wd.length / 2)] : null;

  // ── 湿度的时间演变：夜间增湿是水汽积累的信号 ──
  f.humidityNight = avg(pick(h.relative_humidity_2m, nightWin));
  f.humidityRise = (f.humidityNight != null && f.humidity != null) ? f.humidity - f.humidityNight : null;

  f.elevation = obs.elevation;
  f.month = Number(obs.date.slice(5, 7));
  f.label = obs.observed ? 1 : 0;
  f.date = obs.date;
  f.lat = obs.lat;
  f.lon = obs.lon;
  f.source = obs.source || 'manual';
  return f;
}

async function main() {
  const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '--limit=0').split('=')[1]);

  // 与 prediction-audit 面板 D 相同的样本构成，保证结论可比
  const manual = observations;
  const controls = buildControlDays(manual, { perPositive: 2 });
  let external = [];
  const extPath = path.resolve(__dirname, '../data/observations-commons.json');
  if (fs.existsSync(extPath)) {
    external = JSON.parse(fs.readFileSync(extPath, 'utf8'));
  }
  const extControls = external.length ? buildControlDays(external, { perPositive: 2 }) : [];

  let all = [...manual, ...controls, ...external, ...extControls]
    .filter((o) => o.date && Number.isFinite(o.lat) && Number.isFinite(o.lon) && Number.isFinite(o.elevation));
  if (limit) all = all.slice(0, limit);

  console.log(`样本 ${all.length} 条（正 ${all.filter((o) => o.observed).length}）`);
  console.log('拉取 D-2~D 三天窗口（前期降水等时间特征的原料）...\n');

  const cache = loadCache();
  const rows = [];
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < all.length; i += 1) {
    const obs = all[i];
    const key = `${obs.date}_${obs.lat}_${obs.lon}`;
    let w = cache[key];
    if (w === undefined) {
      try {
        w = await fetchWindow(obs.lat, obs.lon, obs.date);
        cache[key] = w;
        fetched += 1;
        if (fetched % 25 === 0) {
          saveCache(cache);
          console.log(`  已拉取 ${fetched} 条 (${i + 1}/${all.length})`);
        }
        await sleep(250);
      } catch (e) {
        failed += 1;
        cache[key] = null;
        continue;
      }
    }
    if (!w) continue;
    const f = extractFeatures(w, obs);
    if (f) rows.push(f);
  }
  saveCache(cache);

  console.log(`\n成功提取特征 ${rows.length} 条（失败 ${failed}）`);

  const cols = Object.keys(rows[0]);
  const csv = [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => (r[c] == null ? '' : r[c])).join(',')))
    .join('\n');
  const out = path.resolve(__dirname, '../data/features.csv');
  fs.writeFileSync(out, csv);
  console.log(`💾 已写入 data/features.csv（${cols.length} 列）`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { extractFeatures, shiftDate };
