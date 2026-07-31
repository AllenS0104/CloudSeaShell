/**
 * 小红书笔记 → 云海/晚霞观测真值 的解析与打标模块
 *
 * 设计动机（三个会让"数据越多、模型越差"的陷阱）：
 *
 * 1. 【预测帖污染】部分博主（如 @大鹏爱自由）发的是**预报**而非**实拍返图**。
 *    把预报当真值 = 让我们的模型去拟合另一个模型的输出，是循环论证。
 *    -> classifyPostType() 必须先把 prediction 剔出去。
 *
 * 2. 【只有正样本】几乎没人专门发"今天没有云海"。直接抓取得到的是
 *    presence-only 数据，正样本率会趋近 100%，此时"全猜有"即可拿高准确率，
 *    模型学不到任何判别力（现有云海回测 79% 正样本、AUC 0.66 就是这个病）。
 *    -> 两条对策：
 *       a) 主动挖掘摄影圈的失败帖黑话（空军/翻车/白跑/扑空/寡淡）作为真负样本；
 *       b) buildPseudoNegatives() 用发帖密度构造伪负样本。
 *
 * 3. 【时间/地点/强度都不可信】发布时间≠观测时间（次日补发很常见）；
 *    POI 名称精度不足以定高程（"黄山"跨 700-1860m）；照片饱和度普遍被拉高，
 *    所以强度**只从文字口径判定，不从图片判定**。
 *    -> 每条记录都带 confidence 与 rejectReason，低质量样本必须可被过滤。
 *
 * 【抓取可行性备注】小红书搜索页/信息流页的 __INITIAL_STATE__ 仅含 app 配置，
 * 不含笔记列表；发现类接口需要 x-s/x-t 签名 + 登录 cookie。
 * 笔记**详情页**可用移动端 UA 直抓（含 __INITIAL_STATE__）。
 * 因此本流水线以「分享链接列表」为入口，不做站点发现。
 */

/** 强度分级：0=无 1=小烧/淡 2=中烧 3=大烧 4=爆烧 */
const INTENSITY_KEYWORDS = [
  { level: 4, words: ['爆烧', '炸裂', '炸了', '史诗级', '天花板', '封神', '十年一遇', '整个天空都red'] },
  { level: 3, words: ['大烧', '烧透', '半边天', '刷屏', '绝美', '震撼', '超级晚霞', '大云海', '云海爆了', '云瀑'] },
  { level: 2, words: ['中烧', '还不错', '有霞', '小有惊喜', '云海不错'] },
  { level: 1, words: ['小烧', '微烧', '淡淡', '一点点', '只烧了一会', '薄云海', '云海一般'] },
  { level: 0, words: ['空军', '翻车', '白跑', '扑空', '没烧', '未烧', '寡淡', '啥也没有', '什么都没看到', '无云海', '没有云海', '失败', '白等', '一片灰'] },
];

/** 预报帖特征词 */
const PREDICTION_MARKERS = [
  '预计', '预测', '预报', '今晚将', '将会出现', '建议提前', '最佳观测时间',
  '值得冲', '冲不冲', '机位推荐', '建议观测', '蹲一个', '明天', '概率',
];

/** 实拍返图帖特征词 */
const REPORT_MARKERS = [
  '返图', '实拍', '拍到', '拍了', '记录一下', '出片', '没白等', '没白来',
  '偶遇', '刚刚', '随手拍', '直出', '原图', '手机拍', '今天的晚霞', '今日云海',
  '爬上来', '登顶', '守到', '等到了',
];

/**
 * 否定词护栏。中文里"没白等""不翻车"是**正面**结果，
 * 但它们包含"白等""翻车"这些失败词子串，直接 includes 会把好帖误判成空军。
 */
const NEGATORS = ['没', '不', '未', '别', '无', '非'];

/** 关键词是否在文中以**未被否定**的形式出现 */
function hasUnnegated(text, word) {
  if (!text) return false;
  let from = 0;
  for (;;) {
    const i = text.indexOf(word, from);
    if (i < 0) return false;
    const prev = i > 0 ? text[i - 1] : '';
    // 关键词自身以否定词开头（如"没烧""无云海"）时不再二次否定
    const selfNegated = NEGATORS.includes(word[0]);
    if (selfNegated || !NEGATORS.includes(prev)) return true;
    from = i + 1;
  }
}

function countHits(text, words) {
  if (!text) return 0;
  return words.reduce((n, w) => (hasUnnegated(text, w) ? n + 1 : n), 0);
}

/**
 * 判定帖子类型。只有 'report' 可进入真值集。
 * @returns {{type:'report'|'prediction'|'unknown', reportHits:number, predictionHits:number}}
 */
function classifyPostType(text) {
  const reportHits = countHits(text, REPORT_MARKERS);
  const predictionHits = countHits(text, PREDICTION_MARKERS);
  let type = 'unknown';
  if (reportHits > predictionHits) type = 'report';
  else if (predictionHits > reportHits) type = 'prediction';
  return { type, reportHits, predictionHits };
}

/**
 * 从正文文字判定强度。**刻意不使用图片**——社交平台照片饱和度普遍被后期拉高，
 * 用图片判强度会系统性高估。
 * @returns {{intensity:number|null, matched:string|null}}
 */
function extractIntensity(text) {
  if (!text) return { intensity: null, matched: null };
  // 先匹配失败词（level 0），避免"云海翻涌"这类词把空军帖误判成正样本
  const ordered = [...INTENSITY_KEYWORDS].sort((a, b) => a.level - b.level);
  for (const group of ordered) {
    for (const w of group.words) {
      if (hasUnnegated(text, w)) return { intensity: group.level, matched: w };
    }
  }
  return { intensity: null, matched: null };
}

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 解析观测日期。发布时间 ≠ 观测时间：
 *  - 正文里的 "7.29" / "7月29日" 优先（confidence high）
 *  - "今天/今晚" → 发布日；"昨天/昨晚" → 发布日 -1
 *  - 晚霞帖若在凌晨 0-6 点发布，几乎必然说的是前一天傍晚 → -1 天
 * @param {string} text 标题+正文
 * @param {number} publishTs 毫秒时间戳
 * @param {boolean} isEvening 是否晚霞类（云海多为清晨）
 */
function resolveObserveDate(text, publishTs, isEvening) {
  const pub = new Date(publishTs);
  if (Number.isNaN(pub.getTime())) return { date: null, confidence: 'none' };

  const explicit = String(text || '').match(/(\d{1,2})\s*[.月/-]\s*(\d{1,2})\s*日?/);
  if (explicit) {
    const m = Number(explicit[1]);
    const d = Number(explicit[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      // 跨年：发布在 1 月而正文写 12 月 → 上一年
      let year = pub.getFullYear();
      if (m === 12 && pub.getMonth() === 0) year -= 1;
      const cand = new Date(year, m - 1, d);
      // 正文日期不应晚于发布日太多（防止把"机位攻略"里的历史日期抓进来）
      const ahead = (cand - pub) / 86400000;
      if (ahead <= 1 && ahead > -400) {
        return { date: toISO(cand), confidence: 'high' };
      }
    }
  }

  const shift = (days) => toISO(new Date(pub.getTime() - days * 86400000));
  if (/昨天|昨晚|昨日/.test(text || '')) return { date: shift(1), confidence: 'medium' };
  if (/今天|今晚|今日|刚刚/.test(text || '')) {
    // 凌晨发的"今晚"其实指前一天傍晚
    if (isEvening && pub.getHours() < 6) return { date: shift(1), confidence: 'medium' };
    return { date: shift(0), confidence: 'medium' };
  }
  if (isEvening && pub.getHours() < 6) return { date: shift(1), confidence: 'low' };
  return { date: shift(0), confidence: 'low' };
}

/**
 * 从笔记详情页 HTML 抽取原始字段。
 *
 * 【为什么必须锚定 noteData】页面尾部带「相关推荐」信息流，整页有 50+ 个
 * `"title":"..."`，直接全局正则会抓到别人的笔记标题。因此先定位 `"noteData":{`，
 * 只在其后的窗口内取字段。
 *
 * 【为什么不用 JSON.parse】小红书 __INITIAL_STATE__ 内含 `undefined` 字面量，
 * 不是合法 JSON；定向正则比整体反序列化更稳。
 */
function parseNoteHtml(html) {
  if (!html || typeof html !== 'string') return null;

  const anchor = html.indexOf('"noteData":{');
  const win = anchor >= 0 ? html.slice(anchor, anchor + 40000) : html;

  const pick = (re) => {
    const m = win.match(re);
    return m ? m[1] : null;
  };
  const unescapeU = (s) => (s == null ? null : s
    .replace(/\\u002F/gi, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"'));

  // JSON 字符串体：允许转义序列，但不跨越未转义的引号
  const jsonStr = (key) => new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`);

  const title = unescapeU(pick(jsonStr('title')));
  const desc = unescapeU(pick(jsonStr('desc')));
  if (title == null && desc == null) return null;

  const lastUpdateTime = Number(pick(/"lastUpdateTime":(\d+)/));
  const poiName = unescapeU(pick(/"poi":\{[^}]*?"name":"((?:[^"\\]|\\.)*)"/));
  const nickName = unescapeU(pick(/"nickName":"((?:[^"\\]|\\.)*)"/));
  const userId = pick(/"userId":"(\w+)"/);
  const noteId = pick(/"noteId":"(\w+)"/);
  const num = (re) => {
    const v = pick(re);
    return v == null ? null : Number(v);
  };

  // 图片去重指纹：搬运/转发帖的 fileId 相同
  const fileIds = [...win.matchAll(/"fileId":"(\w+)"/g)].map((m) => m[1]).filter(Boolean);

  return {
    noteId,
    title: title || '',
    desc: desc || '',
    publishTs: Number.isFinite(lastUpdateTime) ? lastUpdateTime : null,
    poiName,
    author: { userId, nickName },
    likedCount: num(/"likedCount":"(\d+)"/),
    collectedCount: num(/"collectedCount":"(\d+)"/),
    commentCount: num(/"commentCount":"(\d+)"/),
    imageCount: new Set(fileIds).size,
    imageFingerprint: fileIds.length ? fileIds[0] : null,
  };
}

/**
 * 笔记 → 观测记录。不合格的返回 { rejected: true, rejectReason }。
 * @param {object} note parseNoteHtml 的输出
 * @param {object} opts { kind:'glow'|'cloudsea', spotResolver: (poiName, text) => {lat,lon,elevation,name}|null }
 */
function toObservation(note, opts = {}) {
  const kind = opts.kind === 'cloudsea' ? 'cloudsea' : 'glow';
  const isEvening = kind === 'glow';
  if (!note) return { rejected: true, rejectReason: 'unparsable' };

  const text = `${note.title}\n${note.desc}`;

  const cls = classifyPostType(text);
  if (cls.type === 'prediction') {
    return { rejected: true, rejectReason: 'prediction-post', detail: cls };
  }

  const { intensity, matched } = extractIntensity(text);
  if (intensity == null) {
    return { rejected: true, rejectReason: 'no-intensity-keyword' };
  }

  const { date, confidence: dateConfidence } = resolveObserveDate(text, note.publishTs, isEvening);
  if (!date) return { rejected: true, rejectReason: 'no-date' };

  const spot = opts.spotResolver ? opts.spotResolver(note.poiName, text) : null;
  if (!spot) return { rejected: true, rejectReason: 'unresolved-location', poiName: note.poiName };

  // 综合置信度：日期不确定 或 帖子类型不明 都会降级
  let confidence = 'high';
  if (dateConfidence === 'low' || cls.type === 'unknown') confidence = 'medium';
  if (dateConfidence === 'low' && cls.type === 'unknown') confidence = 'low';

  return {
    rejected: false,
    kind,
    date,
    location: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    elevation: spot.elevation,
    isEvening,
    observed: intensity >= 2,
    intensity,
    intensityKeyword: matched,
    postType: cls.type,
    dateConfidence,
    confidence,
    likes: note.likedCount,
    comments: note.commentCount,
    author: note.author?.nickName || null,
    imageFingerprint: note.imageFingerprint,
    source: `xhs:${note.author?.nickName || 'unknown'}`,
    verified: cls.type === 'report',
  };
}

/**
 * 用发帖密度构造伪负样本（presence-only 学习的标准做法）。
 *
 * 思路：对于发帖密度足够高的热门机位（黄山/牛背山/武功山…），
 * 若某日在观测窗口内**零发帖**，则该日很可能确实没有云海/晚霞。
 * 这是打破"22 个负样本"瓶颈的唯一可规模化手段。
 *
 * @param {Array} positives toObservation 产出的正样本数组
 * @param {object} opts { minPostsPerSpot, windowDays, maxPerSpot }
 * @returns {Array} 伪负样本（observed:false, pseudo:true）
 */
function buildPseudoNegatives(positives, opts = {}) {
  const minPostsPerSpot = opts.minPostsPerSpot ?? 8;
  const windowDays = opts.windowDays ?? 60;
  const maxPerSpot = opts.maxPerSpot ?? 20;

  const bySpot = new Map();
  for (const p of positives) {
    if (!p || p.rejected || !p.date) continue;
    const key = p.location;
    if (!bySpot.has(key)) bySpot.set(key, []);
    bySpot.get(key).push(p);
  }

  const negatives = [];
  for (const [spotName, posts] of bySpot) {
    if (posts.length < minPostsPerSpot) continue;

    const dates = posts.map((p) => p.date).sort();
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const span = Math.round((last - first) / 86400000) + 1;
    if (span > windowDays) continue; // 跨度太大，密度假设不成立

    // 密度：窗口内有帖天数占比。太低则不足以支撑"无帖即无景"
    const seen = new Set(dates);
    const density = seen.size / span;
    if (density < 0.25) continue;

    const ref = posts[0];
    const empties = [];
    for (let i = 0; i < span; i++) {
      const d = toISO(new Date(first.getTime() + i * 86400000));
      if (!seen.has(d)) empties.push(d);
    }

    for (const d of empties.slice(0, maxPerSpot)) {
      negatives.push({
        rejected: false,
        kind: ref.kind,
        date: d,
        location: spotName,
        lat: ref.lat,
        lon: ref.lon,
        elevation: ref.elevation,
        isEvening: ref.isEvening,
        observed: false,
        intensity: 0,
        pseudo: true,
        // 密度越高，"零发帖=真没有"越可信
        confidence: density >= 0.5 ? 'medium' : 'low',
        source: `pseudo-negative(density=${density.toFixed(2)},n=${posts.length})`,
        verified: false,
      });
    }
  }
  return negatives;
}

/** 去重：同作者同日同机位、或首图指纹相同（搬运/转发）视为重复 */
function dedupeObservations(list) {
  const seen = new Set();
  const out = [];
  for (const o of list) {
    if (!o || o.rejected) continue;
    const keys = [`${o.author}|${o.date}|${o.location}`];
    if (o.imageFingerprint) keys.push(`img|${o.imageFingerprint}`);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(o);
  }
  return out;
}

/** 数据集体检：把"越抓越差"的风险显性化 */
function auditDataset(list) {
  const n = list.length;
  const pos = list.filter((o) => o.observed).length;
  const pseudo = list.filter((o) => o.pseudo).length;
  const lowConf = list.filter((o) => o.confidence === 'low').length;
  const spots = new Set(list.map((o) => o.location));
  const warnings = [];
  if (n < 60) warnings.push(`样本量 ${n} < 60，不足以标定权重`);
  const posRate = n ? pos / n : 0;
  if (posRate > 0.7) warnings.push(`正样本率 ${(posRate * 100).toFixed(0)}%，"全猜有"即可达到同等准确率，需补负样本`);
  if (n - pos < 25) warnings.push(`负样本仅 ${n - pos} 条 < 25，AUC 置信区间会宽到无法比较模型`);
  if (spots.size < 10) warnings.push(`机位仅 ${spots.size} 个，高程/地形与结果高度混淆`);
  if (pseudo / Math.max(n - pos, 1) > 0.8 && pseudo > 0) warnings.push('负样本几乎全为伪负样本，结论需标注此前提');
  return { total: n, positives: pos, negatives: n - pos, positiveRate: posRate, pseudoNegatives: pseudo, lowConfidence: lowConf, spots: spots.size, warnings };
}

module.exports = {
  classifyPostType,
  extractIntensity,
  resolveObserveDate,
  parseNoteHtml,
  toObservation,
  buildPseudoNegatives,
  dedupeObservations,
  auditDataset,
  INTENSITY_KEYWORDS,
  PREDICTION_MARKERS,
  REPORT_MARKERS,
};
