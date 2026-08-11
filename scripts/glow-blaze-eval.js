#!/usr/bin/env node
/**
 * 「大烧」判别力审计。
 *
 * 用户的口径很明确：颜色艳丽的红/橘红才算晚霞，也就是「大烧」。
 * 之前的审计把"有人拍到晚霞"当正样本，标签口径太松——实测 85 张里
 * 中位数火烧指数只有 0.068，绝大多数所谓晚霞其实颜色寡淡。
 * 用这种标签训出来的模型，预测的是"天上有没有点颜色"，不是用户要的东西。
 *
 * 这一版换成图像客观强度（scripts/glow-intensity.py 从像素算出）：
 *   正样本 = 大烧（火烧指数高）
 *   负样本 = 同样有人拍照、但天空寡淡
 *
 * 这个对比的好处是**两边都是实拍**，不需要控制日。上一版的结构性问题
 * （晚霞基率高、控制日大量其实也有晚霞）在这里自动消失了，因为问的问题
 * 变成了"同样有人举起相机，为什么这张烧起来了、那张没有"。
 */

const fs = require('fs');
const path = require('path');
const { analyzeDayGlow } = require('../shared/core/sunset');

const CACHE_FILE = path.join(__dirname, '..', '.glow-audit-cache.json');
const HOURLY = [
  'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'wind_speed_10m', 'precipitation', 'precipitation_probability',
].join(',');

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
let dirty = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await sleep(1500 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(800 * (i + 1));
    }
  }
  throw new Error('unreachable');
}

const AQ_HOURLY = 'pm2_5,pm10,aerosol_optical_depth,dust';

async function fetchDay(lat, lon, date) {
  const key = `${date}_${lat}_${lon}`;
  if (cache[key]) return cache[key];
  const q = `latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&timezone=auto`;
  let payload = null;
  for (const base of [
    'https://historical-forecast-api.open-meteo.com/v1/forecast',
    'https://archive-api.open-meteo.com/v1/archive',
  ]) {
    try {
      const w = await getJSON(`${base}?${q}&hourly=${HOURLY}&daily=sunrise,sunset`);
      if (w?.hourly?.time) {
        payload = { hourly: w.hourly, sunrise: w.daily?.sunrise?.[0] || null, sunset: w.daily?.sunset?.[0] || null };
        break;
      }
    } catch { /* 换下一个源 */ }
  }
  // 气溶胶是显色的核心机制，模型里有 ±10 分的判据。
  // 不喂这份数据就等于让模型闭着一只眼睛应试，评出来的分数不作数。
  if (payload) {
    try {
      const aq = await getJSON(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=${AQ_HOURLY}`,
      );
      payload.aq = aq?.hourly || null;
    } catch {
      payload.aq = null;
    }
  }
  cache[key] = payload;
  dirty = true;
  return payload;
}

function rocAuc(rows) {
  const pos = rows.filter((s) => s.label === 1).map((s) => s.v);
  const neg = rows.filter((s) => s.label === 0).map((s) => s.v);
  if (!pos.length || !neg.length) return null;
  let w = 0;
  for (const p of pos) for (const n of neg) w += p > n ? 1 : (p === n ? 0.5 : 0);
  return w / (pos.length * neg.length);
}

function spearman(a, b) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (x) => x.reduce((p, c) => p + c, 0) / n;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

function nearestIdx(times, target) {
  const t = new Date(target).getTime();
  let bi = -1;
  let bd = Infinity;
  times.forEach((x, i) => {
    const d = Math.abs(new Date(x).getTime() - t);
    if (d < bd) { bd = d; bi = i; }
  });
  return bi;
}

async function main() {
  const file = path.join(__dirname, '..', 'data', 'glow-intensity.json');
  const recs = JSON.parse(fs.readFileSync(file, 'utf8'));

  const sorted = [...recs].sort((a, b) => a.fiery - b.fiery);
  const q = (p) => sorted[Math.floor((sorted.length - 1) * p)].fiery;
  const LOW = q(0.40);
  const HIGH = q(0.70);
  console.log(`火烧指数切点：寡淡 <= ${LOW.toFixed(3)}   大烧 >= ${HIGH.toFixed(3)}\n`);

  const rows = [];
  for (const r of recs) {
    if (r.fiery > LOW && r.fiery < HIGH) continue;
    const day = await fetchDay(r.lat, r.lon, r.date);
    if (!day?.hourly?.time) continue;
    const aqSeries = day.aq ? {
      time: day.aq.time,
      pm2_5: day.aq.pm2_5,
      pm10: day.aq.pm10,
      aerosolOpticalDepth: day.aq.aerosol_optical_depth,
      dust: day.aq.dust,
    } : null;
    const res = analyzeDayGlow(day.hourly, 0, day.sunrise, day.sunset, aqSeries);
    const best = res?.bestHour;
    if (!best || !Number.isFinite(best.score)) continue;

    const feats = {};
    if (day.sunset) {
      const bi = nearestIdx(day.hourly.time, day.sunset);
      if (bi >= 0) {
        // ERA5 / CAMS return a literal 0 for dates outside their coverage
        // rather than null. For quantities that cannot physically be 0 in a
        // sample where somebody photographed the sky, treat 0 as missing —
        // otherwise 0 sorts as an extreme and manufactures fake AUC. This
        // exact trap produced a bogus "clean air causes 大烧" result; see
        // the note on scoreAerosolForGlow in shared/core/sunset.js.
        const g = (k, zeroIsMissing = false) => {
          const v = Number(day.hourly[k]?.[bi]);
          if (!Number.isFinite(v)) return null;
          if (zeroIsMissing && v === 0) return null;
          return v;
        };
        feats.cloudHigh = g('cloud_cover_high');
        feats.cloudMid = g('cloud_cover_mid');
        feats.cloudLow = g('cloud_cover_low');
        feats.cloudTotal = g('cloud_cover');
        feats.humidity = g('relative_humidity_2m', true);
        feats.visibility = g('visibility', true);
        feats.pressure = g('pressure_msl', true);
        feats.wind = g('wind_speed_10m');
        feats.precip = g('precipitation');
      }
      if (day.aq?.time) {
        const ai = nearestIdx(day.aq.time, day.sunset);
        if (ai >= 0) {
          const ga = (k) => {
            const v = Number(day.aq[k]?.[ai]);
            // Same trap: CAMS predates 2013, and returns 0 rather than null
            // outside coverage. Aerosol is never exactly 0 in real air.
            if (!Number.isFinite(v) || v === 0) return null;
            return v;
          };
          feats.aod = ga('aerosol_optical_depth');
          feats.pm25 = ga('pm2_5');
        }
      }
    }
    rows.push({ label: r.fiery >= HIGH ? 1 : 0, v: best.score, fiery: r.fiery, feats, rec: r });
  }
  if (dirty) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

  const nPos = rows.filter((r) => r.label === 1).length;
  console.log(`样本 ${rows.length} 条（大烧 ${nPos} / 寡淡 ${rows.length - nPos}）\n`);

  const auc = rocAuc(rows);
  console.log(`现有评分区分「大烧 vs 寡淡」 AUC = ${auc == null ? 'n/a' : auc.toFixed(3)}`);

  const all = recs.filter((r) => r.__ok !== false);
  const withScore = [];
  for (const r of rows) withScore.push(r);
  const rho = spearman(withScore.map((r) => r.v), withScore.map((r) => r.fiery));
  console.log(`评分与火烧指数的 Spearman 相关 = ${rho.toFixed(3)}\n`);

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  console.log(`大烧组均分 ${mean(rows.filter((r) => r.label === 1).map((r) => r.v)).toFixed(1)}   `
    + `寡淡组均分 ${mean(rows.filter((r) => r.label === 0).map((r) => r.v)).toFixed(1)}`);

  console.log('\n▌单变量诊断（日落时刻气象量 → 是否大烧）');
  console.log('特征            AUC     |偏离|   大烧均值    寡淡均值   有效n  缺失率(大烧/寡淡)');
  const keys = ['cloudHigh', 'cloudMid', 'cloudLow', 'cloudTotal',
    'humidity', 'visibility', 'pressure', 'wind', 'precip', 'aod', 'pm25'];
  const out = [];
  const nPosAll = rows.filter((r) => r.label === 1).length;
  const nNegAll = rows.length - nPosAll;
  for (const k of keys) {
    const sub = rows.filter((r) => r.feats && r.feats[k] != null)
      .map((r) => ({ v: r.feats[k], label: r.label }));
    if (sub.length < 20) continue;
    const a = rocAuc(sub);
    if (a == null) continue;
    // 缺失率必须按类别分开看：若两类缺失率差得远，这个特征的 AUC
    // 很可能在量"数据有没有覆盖"而不是量物理。参见 sunset.js 的教训。
    const missPos = nPosAll ? 1 - sub.filter((s) => s.label === 1).length / nPosAll : 0;
    const missNeg = nNegAll ? 1 - sub.filter((s) => s.label === 0).length / nNegAll : 0;
    out.push({
      k,
      a,
      n: sub.length,
      missPos,
      missNeg,
      pm: mean(sub.filter((s) => s.label === 1).map((s) => s.v)),
      nm: mean(sub.filter((s) => s.label === 0).map((s) => s.v)),
    });
  }
  out.sort((x, y) => Math.abs(y.a - 0.5) - Math.abs(x.a - 0.5));
  for (const r of out) {
    const skew = Math.abs(r.missPos - r.missNeg) > 0.2 ? '  ⚠缺失率失衡，AUC 不可信' : '';
    console.log(`${r.k.padEnd(14)} ${r.a.toFixed(3)}   ${Math.abs(r.a - 0.5).toFixed(3)}   `
      + `${r.pm.toFixed(1).padStart(9)}  ${r.nm.toFixed(1).padStart(10)}  `
      + `${String(r.n).padStart(5)}  ${(r.missPos * 100).toFixed(0).padStart(3)}%/${(r.missNeg * 100).toFixed(0).padStart(3)}%${skew}`);
  }

  if (process.argv.includes('--dump')) {
    const dst = path.join(__dirname, '..', 'data', 'glow-blaze.csv');
    // 带上经纬度，好在下游检验"信号是不是只是某个地区的代理"。
    // 缺失一律写空串，绝不写 0：下游按列各自剔除空值即可，
    // 而写 0 会让缺失值在排序类指标里冒充极端值。
    const hdr = ['label', 'fiery', 'score', 'lon', 'lat', ...keys].join(',');
    const lines = rows.map((r) => [r.label, r.fiery.toFixed(4), r.v, r.rec.lon, r.rec.lat,
      ...keys.map((k) => (r.feats?.[k] == null ? '' : r.feats[k]))].join(','));
    fs.writeFileSync(dst, `${hdr}\n${lines.join('\n')}\n`);
    console.log(`\n已导出 ${lines.length} 行 → data/glow-blaze.csv（缺失写空串）`);
  }
  void all;
}

main().catch((e) => { console.error(e); process.exit(1); });
