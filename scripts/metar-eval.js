#!/usr/bin/env node
/**
 * 用 METAR 客观样本评估模型 —— 检验"瓶颈在标签质量"这个判断
 *
 * 背景
 * ----
 * 此前的审计一路指向同一个结论：模型 AUC 上不去（0.64）不是算法问题，
 * 而是标签问题。证据是国内样本域内 AUC 只有 0.506（等于随机），
 * 而标注精确的 Commons 样本有 0.791。
 *
 * 但那仍是间接推断。METAR 扫描给了直接检验的机会：
 * 22537 条客观标签，来自仪器观测而非"有人拍了照片"，
 * 时间精确到小时、地点精确到测站、正负样本都有。
 *
 * 如果在这批样本上模型表现明显更好，"瓶颈在标签"就从推断变成了实证。
 *
 * 效率
 * ----
 * 逐条拉天气要 2 万多次请求。改为按机位一次拉整段日期范围，
 * 77 个机位就是 77 次请求，同样的数据量差三个数量级。
 *
 * 用法：
 *   node scripts/metar-eval.js --limit 6000
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SWEEP_FILE = path.join(ROOT, 'data', 'metar-sweep.json');
const CACHE_FILE = path.join(ROOT, '.metar-eval-cache.json');
const OUT_CSV = path.join(ROOT, 'data', 'metar-features.csv');

const calc = require(path.join(ROOT, 'shared', 'core', 'calculations.js'));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let last = 0;
async function throttle(gap = 1100) {
  const w = last + gap - Date.now();
  if (w > 0) await sleep(w);
  last = Date.now();
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CloudSeaShell/1.0' } }, (res) => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function getJson(url, tries = 4) {
  let err;
  for (let i = 0; i < tries; i += 1) {
    await throttle();
    try {
      const r = await get(url);
      if (r.status === 429 || r.status >= 500) {
        await sleep(3000 * (2 ** i));
        err = new Error(`HTTP ${r.status}`);
        continue;
      }
      const j = JSON.parse(r.body);
      if (j.error) throw new Error(j.reason || 'api error');
      return j;
    } catch (e) {
      err = e;
      await sleep(2000 * (2 ** i));
    }
  }
  throw err;
}

const HOURLY = [
  'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'precipitation', 'visibility', 'wind_speed_10m', 'wind_direction_10m',
].join(',');

async function fetchSite(lat, lon, from, to) {
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}`
    + `&start_date=${from}&end_date=${to}`
    + `&hourly=${HOURLY}&daily=sunrise&timezone=auto`;
  return getJson(url);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function main() {
  if (!fs.existsSync(SWEEP_FILE)) {
    process.stdout.write('先运行: node scripts/metar-truth.js --sweep\n');
    return Promise.resolve();
  }
  const args = process.argv.slice(2);
  const li = args.indexOf('--limit');
  const limit = li >= 0 ? Number(args[li + 1]) : 6000;

  const all = JSON.parse(fs.readFileSync(SWEEP_FILE, 'utf8'));
  process.stdout.write(`客观样本总量 ${all.length} 条\n`);

  // 按机位分组，每个机位均匀抽样，避免少数长记录测站主导整个数据集
  const byKey = new Map();
  all.forEach((r) => {
    const k = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  });
  // 每个机位独立均匀抽样后再合并。
  // 早先的写法是边填边判总量上限，结果按机位顺序填满前十几个站就停了，
  // 正负比被单站气候主导（290/70，而全量是 44.6%），结论会被彻底扭曲。
  const perSite = Math.max(10, Math.floor(limit / byKey.size));
  const picked = [];
  byKey.forEach((rows) => {
    const sorted = rows.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const step = Math.max(1, Math.floor(sorted.length / perSite));
    for (let i = 0; i < sorted.length; i += step) picked.push(sorted[i]);
  });
  const posRate = picked.filter((r) => r.label).length / picked.length;
  process.stdout.write(`抽样 ${picked.length} 条，覆盖 ${byKey.size} 个机位`
    + `（正样本率 ${(posRate * 100).toFixed(1)}%，全量 ${(all.filter((r) => r.label).length / all.length * 100).toFixed(1)}%）\n`);

  return run(picked, byKey);
}

async function run(picked, byKey) {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};

  const sites = new Map();
  picked.forEach((r) => {
    const k = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`;
    if (!sites.has(k)) sites.set(k, { lat: r.lat, lon: r.lon, elevation: r.elevation, rows: [] });
    sites.get(k).rows.push(r);
  });

  const out = [];
  let siteIdx = 0;
  const siteList = [...sites.values()];

  for (let s = 0; s < siteList.length; s += 1) {
    const site = siteList[s];
    siteIdx += 1;
    const dates = site.rows.map((r) => r.date).sort();
    const from = dates[0];
    const to = dates[dates.length - 1];
    const key = `${site.lat.toFixed(3)},${site.lon.toFixed(3)}|${from}|${to}`;

    let data = cache[key];
    if (!data) {
      try {
        const j = await fetchSite(site.lat, site.lon, from, to);
        data = { hourly: j.hourly, daily: j.daily };
        cache[key] = data;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      } catch (e) {
        process.stdout.write(`  机位 ${siteIdx} 失败: ${e.message}\n`);
        continue;
      }
    }

    const h = data.hourly;
    const idxOf = new Map();
    h.time.forEach((t, i) => idxOf.set(t, i));
    const sunriseOf = new Map();
    (data.daily.time || []).forEach((d, i) => sunriseOf.set(d, data.daily.sunrise[i]));

    site.rows.forEach((r) => {
      const sr = sunriseOf.get(r.date);
      if (!sr) return;
      // 取日出时刻所在的整点，这是云海最典型的观测时段
      const hh = Number(sr.slice(11, 13));
      const t = `${r.date}T${String(hh).padStart(2, '0')}:00`;
      const i = idxOf.get(t);
      if (i === undefined) return;
      const dayStart = idxOf.get(`${r.date}T00:00`);
      if (dayStart === undefined) return;

      const temp = num(h.temperature_2m[i]);
      const dew = num(h.dew_point_2m[i]);
      const hum = num(h.relative_humidity_2m[i]);
      if (temp === null || hum === null) return;

      // 直接调用审计所用的同一入口，保证与面板 A-D 的数字可比
      let score = null;
      try {
        const dayHourly = {};
        Object.keys(h).forEach((k) => {
          dayHourly[k] = h[k].slice(dayStart, dayStart + 24);
        });
        const analysis = calc.analyzeDayCloudSea(dayHourly, 0, site.elevation, sr);
        score = analysis && Number.isFinite(analysis.probability)
          ? analysis.probability
          : (analysis && Number.isFinite(analysis.score) ? analysis.score : null);
      } catch (e) { score = null; }

      out.push({
        date: r.date,
        lat: r.lat,
        lon: r.lon,
        elevation: Math.round(site.elevation),
        label: r.label ? 1 : 0,
        verdict: r.verdict,
        station: r.station,
        relativeToSpotM: r.relativeToSpotM,
        score,
        temp,
        humidity: hum,
        dewSpread: (temp !== null && dew !== null) ? Number((temp - dew).toFixed(1)) : null,
        pressure: num(h.pressure_msl[i]),
        cloudLow: num(h.cloud_cover_low[i]),
        cloudMid: num(h.cloud_cover_mid[i]),
        cloudHigh: num(h.cloud_cover_high[i]),
        wind: num(h.wind_speed_10m[i]),
        windDir: num(h.wind_direction_10m[i]),
        visibility: num(h.visibility[i]),
        precip: num(h.precipitation[i]),
      });
    });
    process.stdout.write(`  [${siteIdx}/${siteList.length}] 累计 ${out.length} 条\n`);
  }

  const cols = ['date', 'lat', 'lon', 'elevation', 'label', 'verdict', 'station',
    'relativeToSpotM', 'score', 'temp', 'humidity', 'dewSpread', 'pressure',
    'cloudLow', 'cloudMid', 'cloudHigh', 'wind', 'windDir', 'visibility', 'precip'];
  const csv = [cols.join(',')]
    .concat(out.map((r) => cols.map((c) => (r[c] === null || r[c] === undefined ? '' : r[c])).join(',')))
    .join('\n');
  fs.writeFileSync(OUT_CSV, csv);
  process.stdout.write(`\n写入 ${OUT_CSV}：${out.length} 行\n`);

  const scored = out.filter((r) => r.score !== null);
  if (scored.length > 30) {
    const pos = scored.filter((r) => r.label === 1);
    const neg = scored.filter((r) => r.label === 0);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mp = mean(pos.map((r) => r.score));
    const mn = mean(neg.map((r) => r.score));

    // Mann-Whitney U 等价的 AUC，无需外部依赖
    const sorted = scored.slice().sort((a, b) => a.score - b.score);
    let rank = 0;
    let rsum = 0;
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j < sorted.length && sorted[j].score === sorted[i].score) j += 1;
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k += 1) if (sorted[k].label === 1) rsum += avgRank;
      rank = j;
      i = j;
    }
    const auc = (rsum - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
    process.stdout.write('\n=== 生产评分模型在客观样本上的表现 ===\n');
    process.stdout.write(`  样本 ${scored.length}（正 ${pos.length} / 负 ${neg.length}）\n`);
    process.stdout.write(`  正样本均分 ${mp.toFixed(1)}   负样本均分 ${mn.toFixed(1)}   差值 ${(mp - mn).toFixed(1)}\n`);
    process.stdout.write(`  ROC AUC ${auc.toFixed(3)}\n`);
  }
}

if (require.main === module) {
  main().catch((e) => { process.stderr.write(`${e.stack}\n`); process.exit(1); });
}
