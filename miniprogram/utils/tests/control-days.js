/**
 * 控制日负样本采样器 —— 纠正回测集 79% 的正样本偏差。
 *
 * 【为什么需要它】
 * 现有 106 条标注全部来自「有人发帖」的日子，其中 84 条是正样本。这不是
 * 云海的真实发生率，而是采样偏差：拍到云海的人才会发帖。后果是任何指标都
 * 被平凡基线「永远说有云海」刷到 79.2%，模型看起来有 80% 准确率，实际只
 * 比瞎猜强 0.9 个百分点。不修正基率，就无法判断模型到底有没有判别力。
 *
 * 【做法】
 * 对每个已有正样本（机位 S、月份 M），在同一机位、同一日历月内随机抽取若干
 * 「控制日」，标记为 observed:false。同月抽样是为了保持季节分布一致 —— 否则
 * 会把「冬天云海多」这种季节信号误判成模型能力。
 *
 * 【标签噪声，必须如实说明】
 * 控制日的负标签是弱标签：某天没人发帖不等于那天没有云海。真实基率大概
 * 10~25%，所以控制日里会混进一部分「其实有云海」的假负样本。这带来的偏差
 * 方向是确定的 —— 它只会**低估**精确率和特异度，不会高估。也就是说，用控制日
 * 算出来的模型表现是一个保守下界。这比用 79% 正样本率去高估要诚实得多。
 *
 * 因此本模块产出的样本一律带 pseudo:true，审计工具必须把「仅人工标注」和
 * 「含控制日」两套结果分开呈现，不允许混在一起当成同等强度的证据。
 */

/** mulberry32 —— 小而确定的 PRNG，保证同一 seed 产出完全一致的控制日 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * @param {Array} observations 已有标注（正负都要传，用于避让）
 * @param {object} opts
 *   perPositive  每个正样本生成几个控制日（默认 2）
 *   seed         PRNG 种子，决定结果可复现（默认 20260805）
 *   guardDays    与任何已标注日期的最小间隔天数（默认 3）
 *   archiveLagDays 与今天的最小间隔，避开 Open-Meteo archive 的数据滞后（默认 10）
 *   now          注入「今天」，便于测试
 * @returns {Array} 控制日样本（observed:false, pseudo:true）
 */
function buildControlDays(observations, opts = {}) {
  const perPositive = opts.perPositive ?? 2;
  const seed = opts.seed ?? 20260805;
  const guardDays = opts.guardDays ?? 3;
  const archiveLagDays = opts.archiveLagDays ?? 10;
  const now = opts.now ? new Date(opts.now) : new Date();

  const rand = mulberry32(seed);
  const cutoff = new Date(now.getTime() - archiveLagDays * 86400000);

  // 按机位归拢已标注日期，用于避让
  const labelledBySpot = new Map();
  for (const o of observations) {
    if (!o || !o.date) continue;
    if (!labelledBySpot.has(o.location)) labelledBySpot.set(o.location, []);
    labelledBySpot.get(o.location).push(o.date);
  }

  // 年份池取自整个数据集的跨度，让控制日与正样本落在同一气候时段
  const years = [...new Set(observations.map((o) => Number(o.date.slice(0, 4))))].sort();
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const yearPool = [];
  for (let y = minYear; y <= maxYear; y++) yearPool.push(y);

  const positives = observations.filter((o) => o && o.observed && o.date);
  const controls = [];
  const taken = new Set();

  for (const p of positives) {
    const month = Number(p.date.slice(5, 7));
    const labelled = labelledBySpot.get(p.location) || [];
    let made = 0;

    // 每个正样本最多尝试 60 次，避开已标注日/重复日/太新的日期
    for (let attempt = 0; attempt < 60 && made < perPositive; attempt++) {
      const year = yearPool[Math.floor(rand() * yearPool.length)];
      const day = 1 + Math.floor(rand() * daysInMonth(year, month));
      const candidate = toISO(new Date(Date.UTC(year, month - 1, day)));

      const key = `${p.location}|${candidate}`;
      if (taken.has(key)) continue;
      if (new Date(candidate) > cutoff) continue;
      if (labelled.some((d) => daysBetween(d, candidate) < guardDays)) continue;
      if (controls.some((c) => c.location === p.location && daysBetween(c.date, candidate) < guardDays)) continue;

      taken.add(key);
      controls.push({
        date: candidate,
        location: p.location,
        lat: p.lat,
        lon: p.lon,
        elevation: p.elevation,
        observed: false,
        pseudo: true,
        source: 'control-day',
      });
      made += 1;
    }
  }

  return controls;
}

module.exports = { buildControlDays, mulberry32 };
