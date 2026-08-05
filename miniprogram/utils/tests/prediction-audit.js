/**
 * 预测能力审计 — 回答一个问题：模型比「永远说有云海」强多少？
 *
 * 现有 backtest.js 只报 accuracy / precision / recall。但标注集里正样本
 * 占 ~79%，这三个指标在这种不平衡数据上会被平凡基线刷得很高，无法体现
 * 模型是否真的有判别力。本脚本补齐：
 *   - 平凡基线（always-yes / always-no）对照
 *   - 特异度、平衡准确率
 *   - MCC、Cohen's kappa（对不平衡稳健）
 *   - ROC AUC、Brier score（阈值无关的判别力）
 *   - 阈值扫描（找真正的最优工作点）
 *
 * Run: node miniprogram/utils/tests/prediction-audit.js
 */

if (typeof wx === 'undefined') {
  global.wx = { request: () => {}, getStorageSync: () => null, setStorageSync: () => {} };
}

const fs = require('fs');
const path = require('path');
const calc = require('../calculations');
const { CLOUD_SEA_GO } = require('../thresholds');
const { observations, fetchHistoricalWeather } = require('./backtest');
const { buildControlDays } = require('./control-days');

const CACHE_FILE = path.join(__dirname, '.prediction-audit-cache.json');
// 评分算法一变，缓存里的旧分数就全是错的。带上版本号，改算法时把它 +1，
// 缓存自动作废 —— 否则会拿新阈值去比旧分数，得出完全错误的结论。
const CACHE_VERSION = 2;

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (raw.__version !== CACHE_VERSION) return { __version: CACHE_VERSION };
    return raw;
  } catch (e) {
    return { __version: CACHE_VERSION };
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function confusion(samples, threshold) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0;
  for (const s of samples) {
    const predicted = s.score >= threshold;
    if (predicted && s.observed) tp += 1;
    else if (predicted && !s.observed) fp += 1;
    else if (!predicted && !s.observed) tn += 1;
    else fn += 1;
  }
  return { tp, fp, tn, fn };
}

function metrics({ tp, fp, tn, fn }) {
  const n = tp + fp + tn + fn;
  const accuracy = (tp + tn) / n;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
  const balanced = (recall + specificity) / 2;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = mccDen > 0 ? ((tp * tn) - (fp * fn)) / mccDen : 0;

  const po = accuracy;
  const pe = (((tp + fp) / n) * ((tp + fn) / n)) + (((tn + fn) / n) * ((tn + fp) / n));
  const kappa = pe < 1 ? (po - pe) / (1 - pe) : 0;

  return { accuracy, precision, recall, specificity, balanced, f1, mcc, kappa };
}

// ROC AUC via the Mann-Whitney U equivalence (handles ties correctly)
function rocAuc(samples) {
  const pos = samples.filter((s) => s.observed).map((s) => s.score);
  const neg = samples.filter((s) => !s.observed).map((s) => s.score);
  if (!pos.length || !neg.length) return NaN;
  let sum = 0;
  for (const p of pos) {
    for (const q of neg) {
      if (p > q) sum += 1;
      else if (p === q) sum += 0.5;
    }
  }
  return sum / (pos.length * neg.length);
}

function brier(samples) {
  // treat score/100 as the claimed probability
  return samples.reduce((acc, s) => acc + ((s.score / 100) - (s.observed ? 1 : 0)) ** 2, 0) / samples.length;
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const sig = (v) => v.toFixed(3);

async function scoreAll(list, cache, onProgress) {
  const samples = [];
  let fetched = 0;

  for (const obs of list) {
    const key = `${obs.date}_${obs.lat}_${obs.lon}_${obs.elevation}`;
    let score = cache[key];

    if (score === undefined) {
      try {
        await new Promise((r) => setTimeout(r, 350));
        const weather = await fetchHistoricalWeather(obs.lat, obs.lon, obs.date);
        if (!weather?.hourly?.time?.length) continue;
        const analysis = calc.analyzeDayCloudSea(weather.hourly, 0, obs.elevation, weather.daily?.sunrise?.[0]);
        score = analysis.score;
        cache[key] = score;
        fetched += 1;
        if (fetched % 20 === 0) { saveCache(cache); onProgress?.(fetched); }
      } catch (err) {
        continue;
      }
    }
    samples.push({ ...obs, score });
  }
  saveCache(cache);
  return samples;
}

/** 打印一整套判别力指标。label 说明这批样本的标注强度。 */
function report(label, samples) {
  const nPos = samples.filter((s) => s.observed).length;
  const nNeg = samples.length - nPos;

  console.log('\n' + '─'.repeat(72));
  console.log(`▌${label}`);
  console.log('─'.repeat(72));
  console.log(`样本: ${samples.length} 条（正 ${nPos} / 负 ${nNeg}，正样本占比 ${pct(nPos / samples.length)}）`);

  if (!nPos || !nNeg) {
    console.log('  正负样本不齐，跳过。');
    return null;
  }

  const alwaysYes = metrics({ tp: nPos, fp: nNeg, tn: 0, fn: 0 });
  const alwaysNo = metrics({ tp: 0, fp: 0, tn: nNeg, fn: nPos });
  const model = metrics(confusion(samples, CLOUD_SEA_GO));

  console.log(`\n【对照：模型 vs 平凡基线】阈值 ${CLOUD_SEA_GO}`);
  console.log('┌────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ 指标           │ 当前模型 │ 永远说有 │ 永远说无 │');
  console.log('├────────────────┼──────────┼──────────┼──────────┤');
  const row = (name, a, b, c) => console.log(`│ ${name.padEnd(14)} │ ${a.padStart(8)} │ ${b.padStart(8)} │ ${c.padStart(8)} │`);
  row('准确率', pct(model.accuracy), pct(alwaysYes.accuracy), pct(alwaysNo.accuracy));
  row('精确率', pct(model.precision), pct(alwaysYes.precision), '—');
  row('召回率', pct(model.recall), pct(alwaysYes.recall), pct(alwaysNo.recall));
  row('特异度', pct(model.specificity), pct(alwaysYes.specificity), pct(alwaysNo.specificity));
  row('平衡准确率', pct(model.balanced), pct(alwaysYes.balanced), pct(alwaysNo.balanced));
  row('MCC', sig(model.mcc), sig(alwaysYes.mcc), sig(alwaysNo.mcc));
  row("Cohen's kappa", sig(model.kappa), sig(alwaysYes.kappa), sig(alwaysNo.kappa));
  console.log('└────────────────┴──────────┴──────────┴──────────┘');
  console.log(`\n→ 模型相对「永远说有」的准确率增益: ${((model.accuracy - alwaysYes.accuracy) * 100).toFixed(1)} 个百分点`);

  const auc = rocAuc(samples);
  console.log('\n【阈值无关判别力】');
  console.log(`  ROC AUC     : ${sig(auc)}   (0.5 = 完全随机, 0.7 以上才算可用)`);
  console.log(`  Brier score : ${sig(brier(samples))}   (越低越好，把分数/100 当概率)`);

  const posScores = samples.filter((s) => s.observed).map((s) => s.score);
  const negScores = samples.filter((s) => !s.observed).map((s) => s.score);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`  正样本平均分: ${mean(posScores).toFixed(1)}   负样本平均分: ${mean(negScores).toFixed(1)}   差值: ${(mean(posScores) - mean(negScores)).toFixed(1)}`);

  // 分数分布 —— 判别力差到底是「阈值没选好」还是「分数根本拉不开」，看这里
  console.log('\n【分数分布】每 10 分一档，看正负样本是否真的分得开');
  console.log('  区间      正样本            负样本');
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 10;
    const inBin = (xs) => xs.filter((v) => v >= lo && (hi === 100 ? v <= 100 : v < hi)).length;
    const p = inBin(posScores);
    const n = inBin(negScores);
    if (!p && !n) continue;
    const bar = (count, total) => '█'.repeat(Math.round((count / total) * 20)).padEnd(20);
    console.log(`  ${String(lo).padStart(2)}-${String(hi).padStart(3)}  ${bar(p, posScores.length)}${pct(p / posScores.length).padStart(6)}  ${bar(n, negScores.length)}${pct(n / negScores.length).padStart(6)}`);
  }

  // 饱和度诊断：如果绝大多数负样本也挤在最高分档，问题就不在阈值选得对不对，
  // 而在于分数根本没有分辨力 —— 此时调阈值只是在饱和区里挪一条无效的线。
  const topBinPos = posScores.filter((v) => v >= 90).length / posScores.length;
  const topBinNeg = negScores.filter((v) => v >= 90).length / negScores.length;
  if (topBinNeg > 0.4) {
    console.log(`\n  ⚠️  分数饱和：${pct(topBinNeg)} 的负样本也落在 90-100 档（正样本 ${pct(topBinPos)}）。`);
    console.log('      成因是各组件满分合计 134 分后 clamp 到 100 —— 只要拿到 75% 的组件分就顶格，');
    console.log('      大量平庸天气因此被压缩进同一个高分区。这种情况下任何阈值都救不了特异度，');
    console.log('      要真正提升判别力，得先把合成分改成按 134 线性归一（或对高分段做拉伸）。');
  }

  console.log('\n【阈值扫描】按平衡准确率与 MCC 找真正的最优点');
  console.log('  阈值   准确率  召回率  特异度  平衡准确率   MCC');
  let best = null;
  for (let t = 20; t <= 95; t += 5) {
    const m = metrics(confusion(samples, t));
    const marker = t === CLOUD_SEA_GO ? ' ← 当前' : '';
    console.log(`  ${String(t).padStart(3)}   ${pct(m.accuracy).padStart(6)}  ${pct(m.recall).padStart(6)}  ${pct(m.specificity).padStart(6)}  ${pct(m.balanced).padStart(9)}  ${sig(m.mcc).padStart(6)}${marker}`);
    if (!best || m.mcc > best.mcc) best = { t, ...m };
  }
  console.log(`\n→ MCC 最优阈值: ${best.t}（MCC ${sig(best.mcc)}，平衡准确率 ${pct(best.balanced)}）`);
  return { model, best, auc };
}

/**
 * 载入 scripts/social-ingest.js 采集的全球观测（Wikimedia Commons 等）。
 *
 * 为什么要单独成一个面板：这批样本的地理分布和人工标注集完全不同
 * （欧洲、南美、东南亚的山地为主，高程 380m~2500m 跨度极大）。
 * 如果模型只在中国东部的山上有效，合并后指标会掉——那本身就是重要发现，
 * 说明当前权重是过拟合到特定地形的，而不是普适的物理判据。
 */
function loadExternalObservations(file) {
  const p = path.resolve(__dirname, '../../../', file);
  if (!fs.existsSync(p)) {
    console.log(`\n⚠️  未找到 ${file}，跳过外部数据面板。`);
    console.log('   先运行: node scripts/social-ingest.js --source commons-sweep --out data/observations-commons.json');
    return [];
  }
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  return list.filter((o) => o.date && Number.isFinite(o.lat) && Number.isFinite(o.lon) && Number.isFinite(o.elevation));
}

async function main() {
  const perPositive = Number(
    (process.argv.find((a) => a.startsWith('--controls=')) || '--controls=2').split('=')[1],
  );

  const cache = loadCache();

  console.log('\n' + '='.repeat(72));
  console.log('🔍 云海预测判别力审计');
  console.log('='.repeat(72));

  const strict = await scoreAll(observations, cache, (n) => process.stdout.write(`  已获取 ${n} 条人工标注...\n`));

  let controlSamples = [];
  if (perPositive > 0) {
    const controls = buildControlDays(observations, { perPositive });
    console.log(`\n生成控制日负样本 ${controls.length} 条（每正样本 ${perPositive} 个，同机位同月，避让已标注日 ±3 天）`);
    controlSamples = await scoreAll(controls, cache, (n) => process.stdout.write(`  已获取 ${n} 条控制日...\n`));
  }

  report('面板 A：仅人工标注（标签可信，但正样本占比严重偏高）', strict);

  if (controlSamples.length) {
    report('面板 B：人工标注 + 控制日负样本（基率已修正，标签含噪声）', [...strict, ...controlSamples]);
    console.log('\n' + '='.repeat(72));
    console.log('⚠️  两个面板怎么读');
    console.log('  面板 A 的标签都是人看图确认的，但样本只来自「有人发帖」的日子，');
    console.log('  正样本占比 ~79%，远高于云海的真实发生率，会让所有指标虚高。');
    console.log('  面板 B 用同机位同月的控制日把基率拉回现实。代价是控制日的负标签');
    console.log('  是弱标签 —— 没人发帖不等于没有云海，里面会混进真正的正样本。');
    console.log('  这个噪声只会**压低**精确率和特异度，所以面板 B 是保守下界。');
    console.log('  真实能力落在两者之间，选阈值时应以面板 B 为准（宁可保守）。');
  }

  if (process.argv.includes('--commons')) {
    const ext = loadExternalObservations('data/observations-commons.json');
    if (ext.length) {
      console.log(`\n载入外部观测 ${ext.length} 条（GPS + EXIF 拍摄时间，全球分布）`);
      const extPos = await scoreAll(ext, cache, (n) => process.stdout.write(`  已获取 ${n} 条外部正样本...\n`));
      const extCtl = perPositive > 0
        ? await scoreAll(buildControlDays(ext, { perPositive }), cache, (n) => process.stdout.write(`  已获取 ${n} 条外部控制日...\n`))
        : [];
      report('面板 C：全球外部观测（Commons，GPS+拍摄时间）', [...extPos, ...extCtl]);
      report('面板 D：全部合并（人工标注 + 控制日 + 全球外部）',
        [...strict, ...controlSamples, ...extPos, ...extCtl]);
      console.log('\n' + '='.repeat(72));
      console.log('⚠️  面板 C/D 怎么读');
      console.log('  面板 C 的地点是全球山地，与人工标注集（中国东部）几乎不重叠。');
      console.log('  若 C 明显差于 A/B，说明现有权重是拟合到特定地形气候的，不普适；');
      console.log('  若 C 与 A/B 相当，才有理由相信判据抓到的是物理规律。');
      console.log('  面板 D 是样本量最大的一版，AUC 置信区间最窄，应作为主要参考。');
    }
  }

  console.log('\n' + '='.repeat(72));
}

main().catch((e) => { console.error(e); process.exit(1); });
