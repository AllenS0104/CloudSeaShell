#!/usr/bin/env node
/**
 * 晚霞模型审计 —— 把云海那套"正样本 + 控制日负样本 + AUC"的方法论迁移到晚霞。
 *
 * 背景：晚霞评分模块（shared/core/sunset.js）逻辑完整，但在此之前
 * 全项目只有 1 条晚霞观测样本，且 verified:false。也就是说这个模块
 * 从未被真实数据检验过，分数是否有判别力完全未知。
 *
 * 方法与云海审计一致：
 *   正样本 = Commons 上带 GPS + 拍摄日期的晚霞照片（拍到了 => 当天有晚霞）
 *   负样本 = 同一地点、同季节的随机"控制日"（绝大多数日子没有出彩晚霞）
 * 控制日不是完美的负样本（控制日也可能恰好有晚霞），这会压低 AUC，
 * 所以测出来的是**下界**。云海审计用的是同一套口径，两者可直接比较。
 */

const fs = require('fs');
const path = require('path');
const { analyzeDayGlow } = require('../shared/core/sunset');
const { buildControlDays } = require('../miniprogram/utils/tests/control-days');

const CACHE_FILE = path.join(__dirname, '..', '.glow-audit-cache.json');
const HOURLY = [
  'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'wind_speed_10m', 'precipitation', 'precipitation_probability',
].join(',');

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
let cache = loadCache();
let cacheDirty = false;
function saveCache() {
  if (cacheDirty) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  cacheDirty = false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      // Open-Meteo archive 对并发很敏感，429 要退避而不是放弃，
      // 否则样本会被"网络运气"而非天气条件筛掉，引入偏差。
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

async function fetchDay(lat, lon, date) {
  const key = `${date}_${lat}_${lon}`;
  if (cache[key] !== undefined) return cache[key];
  const q = `latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&timezone=auto`;
  let payload = null;
  try {
    const w = await getJSON(
      `https://historical-forecast-api.open-meteo.com/v1/forecast?${q}&hourly=${HOURLY}&daily=sunrise,sunset`,
    );
    payload = { hourly: w.hourly, sunrise: w.daily?.sunrise?.[0] || null, sunset: w.daily?.sunset?.[0] || null };
  } catch {
    payload = null;
  }
  cache[key] = payload;
  cacheDirty = true;
  return payload;
}

function rocAuc(samples) {
  const pos = samples.filter((s) => s.label === 1).map((s) => s.score);
  const neg = samples.filter((s) => s.label === 0).map((s) => s.score);
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : (p === n ? 0.5 : 0);
  return wins / (pos.length * neg.length);
}

function stats(samples, threshold) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0;
  for (const s of samples) {
    const pred = s.score >= threshold ? 1 : 0;
    if (s.label === 1 && pred === 1) tp += 1;
    else if (s.label === 1) fn += 1;
    else if (pred === 1) fp += 1;
    else tn += 1;
  }
  const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return {
    threshold,
    tp,
    fp,
    tn,
    fn,
    precision: tp + fp ? tp / (tp + fp) : 0,
    recall: tp + fn ? tp / (tp + fn) : 0,
    mcc: denom ? ((tp * tn) - (fp * fn)) / denom : 0,
  };
}

async function scoreOne(obs) {
  const day = await fetchDay(obs.lat, obs.lon, obs.date);
  if (!day?.hourly?.time) return null;
  const r = analyzeDayGlow(day.hourly, 0, day.sunrise, day.sunset, null);
  const best = r?.bestHour;
  if (!best || !Number.isFinite(best.score)) return null;
  return best.score;
}

async function main() {
  const file = path.join(__dirname, '..', 'data', 'observations-glow.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const positives = (Array.isArray(raw) ? raw : raw.observations || [])
    .filter((o) => !o.rejected && o.observed && o.lat != null && o.date);

  const controlsPer = Number((process.argv.find((a) => a.startsWith('--controls=')) || '').split('=')[1] || 2);
  const controls = buildControlDays(positives, controlsPer);
  console.log(`晚霞正样本 ${positives.length} 条，控制日负样本 ${controls.length} 条\n`);

  const samples = [];
  const all = [
    ...positives.map((o) => ({ o, label: 1 })),
    ...controls.map((o) => ({ o, label: 0 })),
  ];

  let done = 0;
  for (const item of all) {
    const score = await scoreOne(item.o);
    done += 1;
    if (done % 25 === 0) { saveCache(); process.stdout.write(`  取数 ${done}/${all.length}\r`); }
    if (score == null) continue;
    samples.push({ score, label: item.label, obs: item.o });
  }
  saveCache();
  console.log(`\n成功取到天气的样本 ${samples.length} 条 `
    + `(正 ${samples.filter((s) => s.label === 1).length} / 负 ${samples.filter((s) => s.label === 0).length})\n`);

  const auc = rocAuc(samples);
  console.log(`ROC AUC = ${auc == null ? 'n/a' : auc.toFixed(3)}   (0.5 = 与随机猜测无异)\n`);

  console.log('阈值    命中率   查全率   MCC     TP   FP   TN   FN');
  let bestMcc = null;
  for (let t = 30; t <= 80; t += 5) {
    const s = stats(samples, t);
    if (!bestMcc || s.mcc > bestMcc.mcc) bestMcc = s;
    console.log(`${String(t).padStart(4)}  ${(s.precision * 100).toFixed(1).padStart(6)}%  `
      + `${(s.recall * 100).toFixed(1).padStart(6)}%  ${s.mcc.toFixed(3).padStart(6)}  `
      + `${String(s.tp).padStart(3)}  ${String(s.fp).padStart(3)}  `
      + `${String(s.tn).padStart(3)}  ${String(s.fn).padStart(3)}`);
  }
  console.log(`\nMCC 最优阈值 = ${bestMcc.threshold}（MCC ${bestMcc.mcc.toFixed(3)}）`);

  const posScores = samples.filter((s) => s.label === 1).map((s) => s.score);
  const negScores = samples.filter((s) => s.label === 0).map((s) => s.score);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  console.log(`\n正样本均分 ${mean(posScores).toFixed(1)}  负样本均分 ${mean(negScores).toFixed(1)}  `
    + `落差 ${(mean(posScores) - mean(negScores)).toFixed(1)} 分`);
}

main().catch((e) => { console.error(e); process.exit(1); });
