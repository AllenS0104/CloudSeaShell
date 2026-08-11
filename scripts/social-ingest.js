#!/usr/bin/env node
/**
 * 多平台观测采集 —— 社交媒体公开内容 → 回测真值
 *
 * 【为什么要做这个】
 * npm run audit:prediction 显示模型 ROC AUC 只有 0.597，低于 0.7 的可用线。
 * 根因不是算法，而是标注太少太窄：106 条样本、全部来自中国东部少数几座山、
 * 正样本占比一度高达 79%。社交平台上中外都有大量带地点和时间的云海/晚霞实拍，
 * 这是最现实的扩样本手段。
 *
 * 【合法性边界 —— 请勿放宽】
 * 只走平台**官方公开**接口：oEmbed、公开 REST API、以及用户自备的官方 API key。
 * 不做签名伪造、不绕验证码/访客校验、不冒用登录态。经实测确认不可匿名获取的
 * 平台一律登记在 BLOCKED 里并说明原因，不做绕过尝试。
 *
 * 【两类适配器】
 *   discovery —— 能自主检索发现新观测（Commons / Mastodon / Flickr）
 *   link      —— 只能「给定链接 → 结构化」（YouTube / TikTok / X / 小红书）
 * 前者才能真正规模化扩样本，后者用于精修高质量样本。
 *
 * 【为什么 Commons 和 Flickr 价值最高】
 * 它们带 EXIF 的**拍摄**时间和 GPS 坐标，而不是发布时间和模糊地名。
 * 回测需要的正是「某点某时是否有云海」，这两个源直接给出，无需文本猜测。
 *
 * 用法:
 *   node scripts/social-ingest.js --source commons --query "sea of clouds" --limit 40
 *   node scripts/social-ingest.js --source commons --near 30.13,118.17 --radius 10000
 *   node scripts/social-ingest.js --source mastodon --tag cloudsea
 *   node scripts/social-ingest.js --source flickr --query "sea of clouds"   # 需 FLICKR_API_KEY
 *   node scripts/social-ingest.js --source link --url <youtube/tiktok/x 链接>
 *   加 --out data/observations-commons.json 落盘
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { classifyPostType, extractIntensity, dedupeObservations, auditDataset } = require('./xhs-ingest');
const { resolveSpot, SPOT_REGISTRY } = require('./spot-registry');

const UA = 'CloudSeaShell-research/1.0 (cloud-sea forecast dataset; contact via repo)';

/**
 * 实测确认无法匿名获取的平台。登记原因，避免后来者反复试探或走偏门。
 * 若要接入，正确做法是让用户自备官方开发者凭据，而不是绕过风控。
 */
const BLOCKED = {
  instagram: 'oEmbed 需 Facebook App Token（实测返回 OAuthException code 24）。需用户自备 App 凭据。',
  weibo: 'm.weibo.cn 对匿名请求 302 到 visitor.passport 访客校验。需用户自备登录 Cookie。',
  reddit: '公开 JSON 端点已收紧，匿名返回 403。需注册 OAuth app。',
  bluesky: 'public.api.bsky.app 在本网络返回 403。可能需换出口或自建 AppView。',
};

// ─────────────────────────── HTTP ───────────────────────────

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getJson(res.headers.location, headers));
      }
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 160)}`));
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(`JSON 解析失败: ${d.slice(0, 160)}`)); }
      });
      return undefined;
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * 全局串行限流。Wikimedia 明确要求匿名客户端自我节流，实测并发扫描会吃 429。
 * 与其被限速后重试，不如一开始就慢——数据采集是离线任务，不差这点时间。
 */
let chain = Promise.resolve();
let lastCall = 0;
const MIN_GAP_MS = 1100;

function throttle(fn) {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

/** 429 是「请稍后再试」而不是失败，指数退避重试；其余错误直接抛 */
async function getJsonRetry(url, headers = {}, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await throttle(() => getJson(url, headers));
    } catch (e) {
      const retriable = /HTTP 429|HTTP 5\d\d|timeout|ECONNRESET/.test(e.message);
      if (!retriable || i === attempts - 1) throw e;
      const backoff = 2000 * (2 ** i);
      console.log(`     ⏳ ${e.message.slice(0, 40)} — ${backoff / 1000}s 后重试`);
      await sleep(backoff);
    }
  }
  throw new Error('unreachable');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────── 纯解析函数（可单测） ───────────────────────

function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Commons 的 DateTimeOriginal 格式极不统一，实测见过：
 *   "2020-01-22 09:25:22" / "2018-05-15" / "Taken on 4 January 2004"
 *   "22 November 2004 (according to Exif data)" / 带 <span> 包裹
 * @returns {{date:string|null, hour:number|null}}
 */
function parseCommonsDate(raw) {
  const s = stripHtml(raw);
  if (!s) return { date: null, hour: null };

  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh] = iso;
    return { date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, hour: hh != null ? Number(hh) : null };
  }

  const dmy = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dmy && MONTHS[dmy[2].toLowerCase()]) {
    return { date: `${dmy[3]}-${String(MONTHS[dmy[2].toLowerCase()]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`, hour: null };
  }

  const mdy = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy && MONTHS[mdy[1].toLowerCase()]) {
    return { date: `${mdy[3]}-${String(MONTHS[mdy[1].toLowerCase()]).padStart(2, '0')}-${String(mdy[2]).padStart(2, '0')}`, hour: null };
  }

  return { date: null, hour: null };
}

/** Commons 坐标多为十进制，偶有度分秒；两种都要能吃 */
function parseCoord(raw) {
  if (raw == null) return null;
  const s = stripHtml(raw);
  if (s === '') return null;

  const dms = s.match(/(\d+(?:\.\d+)?)\s*[°d]\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NSEW])?/i);
  if (dms && (dms[2] != null || dms[4] != null)) {
    const deg = Number(dms[1]) + Number(dms[2] || 0) / 60 + Number(dms[3] || 0) / 3600;
    const hemi = (dms[4] || '').toUpperCase();
    return (hemi === 'S' || hemi === 'W') ? -deg : deg;
  }

  const dec = Number(s);
  return Number.isFinite(dec) ? dec : null;
}

/** 只有真的落在地球上的坐标才算数 */
function validCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    && !(lat === 0 && lon === 0);
}

/** 粗略球面距离（km），只用于「照片是否在某机位附近」的判断，不需要高精度 */
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 名字命中机位表还不够——「黄山」在文件名里出现不代表照片拍于黄山
 * （可能是黄山市区、或某张风景合集）。必须坐标也对得上才认，
 * 否则会把权威高程错配到几十公里外的平地上，直接毁掉该样本。
 */
function nearSpot(spot, lat, lon, maxKm = 15) {
  if (!spot || !validCoord(lat, lon) || !validCoord(spot.lat, spot.lon)) return false;
  return distanceKm(spot.lat, spot.lon, lat, lon) <= maxKm;
}

/**
 * 云海判据关键词。Commons/Flickr 的标题描述是中英混杂的，
 * 两套都要覆盖；同时排除「云海」以外的同形词（如乐队名、地名）。
 */
const CLOUDSEA_TERMS = [
  'sea of clouds', 'cloud sea', 'cloud inversion', 'temperature inversion',
  'above the clouds', 'nebelmeer', 'mer de nuages', 'mar de nubes', 'undercast',
  '云海', '雲海',
];
const GLOW_TERMS = ['sunset glow', 'afterglow', 'alpenglow', 'burning sky', '晚霞', '火烧云', '朝霞'];

function detectKind(text) {
  const t = String(text || '').toLowerCase();
  if (CLOUDSEA_TERMS.some((k) => t.includes(k.toLowerCase()))) return 'cloudsea';
  if (GLOW_TERMS.some((k) => t.includes(k.toLowerCase()))) return 'glow';
  return null;
}

/**
 * Commons 单个文件页 → 观测记录。
 * 拿不到坐标或拍摄日期就直接拒绝 —— 没有「何时何地」的样本对回测毫无价值，
 * 硬塞进去只会污染数据集。
 */
function commonsPageToObservation(page, opts = {}) {
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata || {};
  const title = String(page?.title || '');
  const text = [title, stripHtml(meta.ImageDescription?.value), stripHtml(meta.Categories?.value)].join(' ');

  const kind = detectKind(text) || opts.assumeKind || null;
  if (!kind) return { rejected: true, rejectReason: 'no-kind-keyword', title };
  if (opts.kind && kind !== opts.kind) return { rejected: true, rejectReason: 'kind-mismatch', title };

  // 四个坐标来源，可靠性递减：geosearch 注入 > {{Location}} 模板 > EXIF GPS
  // > 分类地名地理编码。最后一个只对晚霞开放（见 geoFromCategories 的说明），
  // 因为云海是局地现象，坐标精度不能让步。
  const coord = page?.coordinates?.[0];
  const lat = parseCoord(page.__geoLat ?? coord?.lat ?? meta.GPSLatitude?.value);
  const lon = parseCoord(page.__geoLon ?? coord?.lon ?? meta.GPSLongitude?.value);
  if (!validCoord(lat, lon)) return { rejected: true, rejectReason: 'no-geo', title };

  const { date, hour } = parseCommonsDate(meta.DateTimeOriginal?.value);
  if (!date) return { rejected: true, rejectReason: 'no-capture-date', title };
  // Commons 上有大量历史画作，它们同样带 DateTimeOriginal（画作年份），
  // 于是能一路混到这里。实测捞到过一幅 1896 年的 "Sunset Glow on Mt
  // Tamalpais"，而且它的"地名"是从画家名解析出来的，坐标落在了两千公里外
  // 的德州。月日为 00 是这类条目的共同特征，年份下限则兜住其余情况——
  // 早于 1990 年的日期在任何一个再分析数据源里都取不到可用天气。
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) || date < '1990') {
    return { rejected: true, rejectReason: 'implausible-date', title };
  }

  // 机位表的高程是查证过的published值，优于 DEM（DEM 对陡峰系统性低估 100-420m）。
  // 但只有当照片确实落在该机位附近时才敢用，否则宁可回落到 DEM。
  const named = resolveSpot ? resolveSpot(`${title} ${opts.spotHint || ''}`) : null;
  const spot = named && nearSpot(named, lat, lon) ? named : null;

  return {
    rejected: false,
    kind,
    date,
    hour,
    location: spot?.name || title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').slice(0, 40),
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    elevation: spot?.elevation ?? null,
    observed: true,
    confidence: hour != null ? 'high' : 'medium',
    // 坐标来源存档：靠分类地名地理编码补出来的只有城市级精度，
    // 下游若要做对精度敏感的分析（比如云海那种局地现象），据此剔除。
    geoSource: page.__geoVia ? 'category-geocode' : 'exif-or-geosearch',
    ...(page.__geoVia ? { geoVia: page.__geoVia, geoSpanDeg: page.__geoSpan } : {}),
    source: 'wikimedia-commons',
    url: info?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    license: stripHtml(meta.LicenseShortName?.value) || 'see-commons',
  };
}

/** Mastodon 公开帖 → 观测记录。正文是 HTML，坐标基本没有，靠机位表兜底。 */
function mastodonStatusToObservation(status, opts = {}) {
  const text = stripHtml(status?.content);
  const kind = detectKind(text) || opts.assumeKind || null;
  if (!kind) return { rejected: true, rejectReason: 'no-kind-keyword' };

  const cls = classifyPostType(text);
  if (cls.type === 'prediction') return { rejected: true, rejectReason: 'prediction-post' };
  if (!status?.media_attachments?.length) return { rejected: true, rejectReason: 'no-photo' };

  const spot = resolveSpot ? resolveSpot(text) : null;
  if (!spot) return { rejected: true, rejectReason: 'no-resolvable-spot' };

  const created = new Date(status.created_at);
  if (Number.isNaN(created.getTime())) return { rejected: true, rejectReason: 'bad-date' };

  const { intensity } = extractIntensity(text);

  return {
    rejected: false,
    kind,
    date: created.toISOString().slice(0, 10),
    hour: created.getUTCHours(),
    location: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    elevation: spot.elevation,
    observed: true,
    intensity,
    // 发布时间不等于拍摄时间，故只给 low
    confidence: 'low',
    source: `mastodon:${status.account?.acct || 'unknown'}`,
    url: status.url,
  };
}

/** Flickr 搜索结果 → 观测记录。datetaken 是 EXIF 拍摄时间，质量与 Commons 同级。 */
function flickrPhotoToObservation(photo, opts = {}) {
  const text = `${photo?.title || ''} ${photo?.description?._content || ''}`;
  const kind = detectKind(text) || opts.assumeKind || null;
  if (!kind) return { rejected: true, rejectReason: 'no-kind-keyword' };

  const lat = parseCoord(photo?.latitude);
  const lon = parseCoord(photo?.longitude);
  if (!validCoord(lat, lon)) return { rejected: true, rejectReason: 'no-geo' };

  const m = String(photo?.datetaken || '').match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}))?/);
  if (!m) return { rejected: true, rejectReason: 'no-capture-date' };

  return {
    rejected: false,
    kind,
    date: `${m[1]}-${m[2]}-${m[3]}`,
    hour: m[4] != null ? Number(m[4]) : null,
    location: String(photo.title || '').slice(0, 40) || `${lat.toFixed(2)},${lon.toFixed(2)}`,
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    elevation: null,
    observed: true,
    confidence: 'high',
    source: `flickr:${photo.owner || 'unknown'}`,
    url: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
  };
}

/** oEmbed 响应 → 半成品观测。只有文案，日期/地点仍需文本推断。 */
function oembedToDraft(platform, url, data) {
  const text = stripHtml(`${data?.title || ''} ${data?.html || ''}`);
  const kind = detectKind(text);
  const spot = resolveSpot ? resolveSpot(text) : null;
  return {
    platform,
    url,
    author: data?.author_name || null,
    text: text.slice(0, 400),
    kind,
    spot: spot ? spot.name : null,
    lat: spot?.lat ?? null,
    lon: spot?.lon ?? null,
    elevation: spot?.elevation ?? null,
    // oEmbed 不返回发布时间，日期只能来自文案；拿不到就必须人工补
    needsManualDate: true,
  };
}

const OEMBED = {
  youtube: (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  x: (u) => `https://publish.x.com/oembed?url=${encodeURIComponent(u)}`,
};

function matchPlatform(url) {
  const u = String(url || '');
  if (/youtube\.com|youtu\.be/i.test(u)) return 'youtube';
  if (/tiktok\.com/i.test(u)) return 'tiktok';
  if (/(twitter|x)\.com/i.test(u)) return 'x';
  if (/xiaohongshu\.com|xhslink\.com/i.test(u)) return 'xhs';
  if (/instagram\.com/i.test(u)) return 'instagram';
  if (/weibo\.(com|cn)/i.test(u)) return 'weibo';
  if (/reddit\.com/i.test(u)) return 'reddit';
  return null;
}

// ─────────────────────────── 采集器 ───────────────────────────

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php?action=query&format=json';
const COMMONS_PROPS = '&prop=coordinates|categories|imageinfo&cllimit=max&iiprop=extmetadata|url'
  + '&iiextmetadatafilter=DateTimeOriginal|GPSLatitude|GPSLongitude|ImageDescription|Categories|LicenseShortName';

// ── 分类地名回落（仅晚霞启用） ──────────────────────────────
//
// 云海是局地现象，机位差几百米结果就不同，所以坐标必须精确，宁可丢样本。
// 晚霞不是：它是天边几十公里尺度的现象，城市级精度完全够用。而 Commons
// 文本检索里带 EXIF GPS 的只有 8%，光是 no-geo 一项就丢掉了 172 条晚霞样本，
// 这正是「大烧」样本只剩 61 条、几乎所有结论 CI 都跨 0.5 的直接原因。
//
// 所以对晚霞额外允许第四个坐标来源：从分类名里取地名，再地理编码。
// 关卡有三道，缺一不可：
//   1. 拍摄日期仍然必须来自 EXIF，一点不放宽。这天然挡掉了油画（Commons 上
//      有大量 1878 年的日落油画）和 NASA 图——探针里真的捞到过 MarsSunset.jpg。
//   2. 维护类分类（许可证、Flickr 审核、Wiki Loves 活动等）全部剔除。
//   3. 地理编码结果的 bbox 跨度必须够小。这是关键闸门：「2016 photographs of
//      Canada」这类会解析成整个国家，对天气毫无意义，必须拒掉。
const GEO_CACHE_FILE = path.join(__dirname, '..', '.geocode-cache.json');
let geoCache = null;

function loadGeoCache() {
  if (geoCache) return geoCache;
  try { geoCache = JSON.parse(fs.readFileSync(GEO_CACHE_FILE, 'utf8')); } catch { geoCache = {}; }
  return geoCache;
}

const CAT_NOISE = /(CC-|GFDL|PD-|Licen[cs]e|Self-published|Media |Files |File:|Uploaded|Photographs by|Photos by|Images? (from|with|of|reviewed|missing)|Flickr|import-|Featured pictures?|Featured photographs?|Quality images|Valued images|missing SDC|Wiki Loves|Taken with|Pages with|Artworks|paintings|oil on canvas|Astronomical|Mars|NASA)/i;

// 内容主题词。Commons 的分类大量是「拍的是什么」而不是「在哪拍的」，
// 而 Nominatim 对任何字符串都会尽力返回点东西：实测 "Sunsets" 会匹配到
// 一栋叫 Sunsets 的房子，"nebulae" 匹配到一条叫 Nebulae Way 的路，
// "roses" 匹配到西班牙的 Roses 镇——最后这个连类型闸门都拦不住，
// 因为它确实是个行政区，只是和玫瑰花毫无关系。所以必须在候选阶段就拦掉。
const TOPIC_WORDS = /^(sun(sets?|rises?|light)|sky|skies|cloud(s|scapes?)?|nebulae?|stars?|moon|roses?|flowers?|gardens?|trees?|birds?|water|sea|ocean|dusk|dawn|twilight|afterglow|golden\s+\w+|red\s+\w+|evening|morning|night|weather|nature|landscapes?|panoramas?|silhouettes?|reflections?|colou?rs?\s+\w*)$/i;

// 拍摄参数类分类。Commons 有大量「F-number f/11」「ISO speed rating 200」
// 这样的 EXIF 分类，它们同样会被 Nominatim 硬凑出一个坐标——实测
// "F-number f/11" 真的返回了一个 boundary 类结果，连类型闸门都骗过了。
const EXIF_WORDS = /(f-number|f\/|iso\b|exposure|focal|shutter|aperture|lens|camera|megapixel|orientation|white balance|flash|metering|motion|panorama|HDR|monochrome|black and white)/i;

/** Nominatim 里真正算「地方」的类别。挡掉 highway/building/amenity/man_made 这类 POI */
const GEO_OK_CATEGORY = new Set(['boundary', 'place', 'natural', 'landuse']);

/** 从分类名里挑最可能是地名的候选，具体的排前面 */
function placeCandidates(categories) {
  const names = (categories || [])
    .map((c) => String(c.title || '').replace(/^Category:/, ''))
    .filter((c) => c && !CAT_NOISE.test(c));
  const out = [];
  for (const c of names) {
    // 「Sunsets of Molokaʻi」「Clouds at sunset in San Francisco」→ 取介词后的地名。
    // 前面的 .* 必须贪婪，好让匹配落在**最后**一个介词上：否则
    // "Clouds at sunset in San Francisco" 会停在第一个 at，捕获成
    // "sunset in San Francisco"，地名就丢了。
    const m = c.match(/^.*(?:\bin|\bof|\bat|\bnear)\s+(.{2,60})$/i);
    if (m) out.push(m[1].trim());
    // 「Guangzhou」「Berkeley Beach」这类分类名本身就是地名
    else if (/^[A-Z\u00C0-\u024F\u4e00-\u9fff]/.test(c) && !/^\d/.test(c) && c.length <= 48) out.push(c);
  }
  // 年份前缀「2019 in Schuyler County, New York」也含地名，兜底捞一次
  for (const c of names) {
    const m = c.match(/^\d{4}\s+in\s+(.+)$/i);
    if (m) out.push(m[1].trim());
  }
  return [...new Set(out)]
    .map((s) => s.trim())
    // 真地名在 Commons 分类里几乎总是大写字母或 CJK 开头。这一条通用规则
    // 顺手挡掉了介词规则捞出来的小写噪声（"nebulae"、"motion"）。
    .filter((s) => s
      && /^[A-Z\u00C0-\u024F\u0400-\u04FF\u4e00-\u9fff\u3040-\u30ff]/.test(s)
      && !TOPIC_WORDS.test(s)
      && !EXIF_WORDS.test(s)
      && !/^the\b/i.test(s))
    .slice(0, 4);
}

/** Nominatim 地理编码，带缓存与限速（公开服务要求 <=1 req/s 且必须带 UA） */
async function geocodePlace(name) {
  const cache = loadGeoCache();
  const key = name.toLowerCase();
  if (key in cache) return cache[key];
  await sleep(1100);
  let res = null;
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1'
      + `&q=${encodeURIComponent(name)}`;
    const j = await getJsonRetry(url, { 'User-Agent': 'CloudSeaShell/1.0 (research; contact via GitHub AllenS0104/CloudSeaShell)' });
    const hit = Array.isArray(j) ? j[0] : null;
    // 类型闸门：Nominatim 对任何输入都会尽力返回结果，所以必须确认返回的
    // 确实是个「地方」。实测 "Lybrook Badlands" 会匹配到一个停车场
    // （amenity），"the United States" 匹配到一条人行道（highway），
    // 而这两者的 bbox 都极小，光靠尺寸闸门反而会当成"高精度"放行。
    if (hit && GEO_OK_CATEGORY.has(String(hit.category || '')) && hit.boundingbox) {
      const [s, n, w, e] = hit.boundingbox.map(Number);
      const span = Math.max(Math.abs(n - s), Math.abs(e - w));
      // 跨度 >1.5° 约等于省/国家级，天气上没有意义，直接判废
      if (Number.isFinite(span) && span <= 1.5) {
        res = {
          lat: Number(hit.lat),
          lon: Number(hit.lon),
          span: Number(span.toFixed(3)),
          cat: `${hit.category}/${hit.type}`,
          display: hit.display_name,
        };
      }
    }
  } catch { res = null; }
  cache[key] = res;
  try { fs.writeFileSync(GEO_CACHE_FILE, JSON.stringify(cache)); } catch { /* 缓存写失败不致命 */ }
  return res;
}

/** 对无坐标的晚霞条目，尝试用分类地名补一个城市级坐标 */
async function geoFromCategories(page) {
  for (const cand of placeCandidates(page.categories)) {
    const hit = await geocodePlace(cand);
    if (hit) return { ...hit, via: cand };
  }
  return null;
}

/** 按标题批量取详情（每批 20 个，Commons 对匿名请求的 titles 上限是 50） */
async function commonsDetails(titles, geoByTitle = {}, opts = {}) {
  const pages = [];
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const det = await getJsonRetry(`${COMMONS_API}&titles=${encodeURIComponent(batch.join('|'))}${COMMONS_PROPS}`);
    for (const p of Object.values(det.query?.pages || {})) {
      const g = geoByTitle[p.title];
      if (g) { p.__geoLat = g.lat; p.__geoLon = g.lon; }
      pages.push(p);
    }
      }
  // 晚霞专属：给还没有坐标的条目补一次分类地名地理编码。
  // 放在这里而不是解析函数里，是为了让 commonsPageToObservation 保持同步，
  // 与既有的 geosearch 注入走同一条路径。
  if (opts.geocodeFallback) await enrichGeoFromCategories(pages);
  return pages;
}

/** 对无坐标的条目就地补上分类地名坐标；返回补上的条数 */
async function enrichGeoFromCategories(pages) {
  let n = 0;
  for (const p of pages) {
    const has = p.__geoLat != null || p.coordinates?.[0]
      || p.imageinfo?.[0]?.extmetadata?.GPSLatitude?.value;
    if (has) continue;
    // 没有拍摄日期的条目（油画、渲染图）横竖会被拒，不必浪费地理编码配额
    if (!p.imageinfo?.[0]?.extmetadata?.DateTimeOriginal?.value) continue;
    const hit = await geoFromCategories(p);
    if (hit) {
      p.__geoLat = hit.lat;
      p.__geoLon = hit.lon;
      p.__geoVia = hit.via;
      p.__geoSpan = hit.span;
      n += 1;
    }
  }
  return n;
}

/** geosearch：结果按定义必带坐标，是唯一能规模化拿到「有地理标记的照片」的入口 */
async function commonsGeoSearch(lat, lon, radius, limit) {
  const geo = await getJsonRetry(`${COMMONS_API}&list=geosearch&gscoord=${lat}|${lon}`
    + `&gsradius=${Math.min(radius, 10000)}&gslimit=${Math.min(limit, 500)}&gsnamespace=6`);
  const hits = geo.query?.geosearch || [];
  const byTitle = {};
  for (const h of hits) byTitle[h.title] = { lat: h.lat, lon: h.lon };
  return commonsDetails(hits.map((h) => h.title), byTitle);
}

/**
 * 多语种深度扫库 —— 实测最高产的模式。
 *
 * 权衡依据（实测数据）：
 *   关键词检索：命中的 100% 是云海照、100% 带拍摄时间，但只有约 8% 带坐标
 *   周边地理扫描：100% 带坐标，但玉龙雪山周边 132 张里 0 张是云海
 * 结论是「先按关键词筛内容、再丢掉没坐标的」远比反过来高效。
 * 用多语种词条是因为 Commons 的贡献者以欧洲和日本居多，只搜英文会漏掉大半。
 */
async function sweepCommons({ limit, kind }) {
  // 云海和晚霞是两套完全不同的检索词。用云海词表去搜晚霞会几乎全军覆没，
  // 因为 detectKind 靠关键词判类，检索词决定了召回池的成分。
  const CLOUD_SEA_QUERIES = [
    'sea of clouds', 'cloud inversion', 'above the clouds mountain',
    'undercast mountain', 'Nebelmeer', 'mer de nuages', 'mar de nubes',
    '雲海', 'cloud sea sunrise', 'temperature inversion valley fog',
    'fog sea mountain summit', 'alpenglow above clouds',
  ];
  // 同样按多语种铺开（Commons 贡献者以欧洲/日本居多）。
  // 晚霞比云海更依赖拍摄时刻，所以偏重能带出具体时间的表述。
  const GLOW_QUERIES = [
    'sunset glow', 'afterglow sky', 'red sky sunset clouds',
    'burning sky sunset', 'alpenglow', 'sunset clouds mountain',
    'Abendrot', 'coucher de soleil nuages', 'atardecer nubes',
    '夕焼け', '夕焼け雲', '火烧云', '晚霞',
    'golden hour clouds', 'crepuscular sunset sky',
  ];
  const queries = kind === 'glow' ? GLOW_QUERIES : CLOUD_SEA_QUERIES;
  const seenTitles = new Set();
  const all = [];

  for (const q of queries) {
    let offset = 0;
    let qAccepted = 0;
    let qSeen = 0;
    let qGeocoded = 0;
    while (qSeen < limit) {
      let j;
      try {
        j = await getJsonRetry(`${COMMONS_API}&generator=search`
          + `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}`
          + `&gsrlimit=50&gsrnamespace=6${offset ? `&gsroffset=${offset}` : ''}${COMMONS_PROPS}`);
      } catch (e) {
        console.log(`  "${q}" ⚠️  ${e.message.slice(0, 50)}`);
        break;
      }
      const batch = Object.values(j.query?.pages || {}).filter((p) => !seenTitles.has(p.title));
      for (const p of batch) seenTitles.add(p.title);
      qSeen += batch.length;

      // 晚霞放宽到城市级坐标，把原本因 no-geo 丢掉的样本捞回来。
      // 云海不放宽：局地现象，坐标差几百米结论就变了。
      let geoAdded = 0;
      if (kind === 'glow') geoAdded = await enrichGeoFromCategories(batch);

      const obs = batch.map((p) => commonsPageToObservation(p, { kind }));
      qAccepted += obs.filter((o) => !o.rejected).length;
      qGeocoded += geoAdded;
      all.push(...obs);

      if (!j.continue?.gsroffset) break;
      offset = j.continue.gsroffset;
    }
    console.log(`  ${q.padEnd(34)} 扫 ${String(qSeen).padStart(4)} 张 → 采纳 ${qAccepted}`
      + (qGeocoded ? `（其中 ${qGeocoded} 条靠分类地名补坐标）` : ''));
  }
  return all;
}

async function searchCommons({ query, near, radius, limit, category, geocodeFallback }) {
  if (near) {
    const [lat, lon] = String(near).split(',').map(Number);
    return commonsGeoSearch(lat, lon, radius || 10000, limit);
  }

  if (category) {
    const j = await getJsonRetry(`${COMMONS_API}&list=categorymembers`
      + `&cmtitle=${encodeURIComponent(`Category:${category}`)}&cmlimit=${Math.min(limit, 500)}&cmtype=file`);
    const titles = (j.query?.categorymembers || []).map((m) => m.title);
    return commonsDetails(titles.slice(0, limit), {}, { geocodeFallback });
  }

  const pages = [];
  let offset = 0;
  while (pages.length < limit) {
    const j = await getJsonRetry(`${COMMONS_API}&generator=search`
      + `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}`
      + `&gsrlimit=50&gsrnamespace=6${offset ? `&gsroffset=${offset}` : ''}${COMMONS_PROPS}`);
    const batch = Object.values(j.query?.pages || {});
    if (!batch.length) break;
    pages.push(...batch);
    if (!j.continue?.gsroffset) break;
    offset = j.continue.gsroffset;
    await sleep(300);
  }
  const out = pages.slice(0, limit);
  if (geocodeFallback) await enrichGeoFromCategories(out);
  return out;
}

/**
 * 扫描机位表里每个机位周边的带地理标记照片。
 * 这是最贴合回测需求的模式：拿到的正是我们真正在预报的那些山头的观测，
 * 而不是全球随机的风景照。
 */
async function scanRegistrySpots({ radius, perSpot, kind }) {
  const spots = Object.values(SPOT_REGISTRY || {});
  const seen = new Set();
  const all = [];
  for (const spot of spots) {
    if (!validCoord(spot.lat, spot.lon)) continue;
    const key = `${spot.lat},${spot.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const pages = await commonsGeoSearch(spot.lat, spot.lon, radius, perSpot);
      const obs = pages.map((p) => commonsPageToObservation(p, { kind, spotHint: spot.name }));
      const ok = obs.filter((o) => !o.rejected);
      console.log(`  ${String(spot.name).padEnd(14)} ${String(pages.length).padStart(3)} 张 → 采纳 ${ok.length}`);
      all.push(...obs);
    } catch (e) {
      console.log(`  ${String(spot.name).padEnd(14)} ⚠️  ${e.message}`);
    }
    await sleep(400);
  }
  return all;
}

async function searchMastodon({ tag, limit, instance }) {
  const host = instance || 'mastodon.social';
  const out = [];
  let maxId = null;
  while (out.length < limit) {
    const url = `https://${host}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=40`
      + (maxId ? `&max_id=${maxId}` : '');
    const batch = await getJsonRetry(url);
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch);
    maxId = batch[batch.length - 1].id;
    await sleep(400);
  }
  return out.slice(0, limit);
}

async function searchFlickr({ query, limit, apiKey }) {
  const out = [];
  let page = 1;
  while (out.length < limit) {
    const url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search'
      + `&api_key=${apiKey}&text=${encodeURIComponent(query)}`
      + '&has_geo=1&extras=geo,date_taken,description&sort=relevance'
      + `&per_page=100&page=${page}&format=json&nojsoncallback=1`;
    const j = await getJsonRetry(url);
    if (j.stat !== 'ok') throw new Error(`Flickr: ${j.message}`);
    const batch = j.photos?.photo || [];
    if (!batch.length) break;
    out.push(...batch);
    if (page >= (j.photos?.pages || 1)) break;
    page += 1;
    await sleep(400);
  }
  return out.slice(0, limit);
}

/** 批量补高程。观测者就站在 GPS 点上，故直接取该点 DEM，不做山顶吸附。 */
async function fillElevations(observations) {
  const need = observations.filter((o) => o.elevation == null && validCoord(o.lat, o.lon));
  for (let i = 0; i < need.length; i += 90) {
    const batch = need.slice(i, i + 90);
    const url = 'https://api.open-meteo.com/v1/elevation'
      + `?latitude=${batch.map((o) => o.lat).join(',')}`
      + `&longitude=${batch.map((o) => o.lon).join(',')}`;
    try {
      const j = await getJsonRetry(url);
      batch.forEach((o, k) => { o.elevation = j.elevation?.[k] ?? null; });
    } catch (e) {
      console.warn(`  ⚠️  高程补全失败: ${e.message}`);
    }
    await sleep(400);
  }
  return observations;
}

// ─────────────────────────── CLI ───────────────────────────

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const source = arg('source', 'commons');
  const limit = Number(arg('limit', 40));
  const kind = arg('kind', 'cloudsea');
  const out = arg('out');

  console.log('='.repeat(70));
  console.log('🌐 多平台观测采集');
  console.log('='.repeat(70));

  let observations = [];
  let raw = [];

  if (source === 'commons') {
    const query = arg('query', 'sea of clouds');
    raw = await searchCommons({
      query,
      near: arg('near'),
      radius: Number(arg('radius', 10000)),
      category: arg('category'),
      limit,
    });
    console.log(`Commons 命中 ${raw.length} 个文件页`);
    observations = raw.map((p) => commonsPageToObservation(p, { kind }));
  } else if (source === 'commons-sweep') {
    console.log('多语种深度扫库（Commons 贡献者以欧洲/日本居多，只搜英文会漏掉大半）...\n');
    observations = await sweepCommons({ limit: Number(arg('per-query', 300)), kind });
    raw = observations;
  } else if (source === 'commons-spots') {
    console.log(`扫描机位表 ${Object.keys(SPOT_REGISTRY).length} 个机位周边的带地理标记照片...\n`);
    observations = await scanRegistrySpots({
      radius: Number(arg('radius', 8000)),
      perSpot: Number(arg('per-spot', 100)),
      kind,
    });
    raw = observations;
  } else if (source === 'mastodon') {
    const tag = arg('tag', 'cloudsea');
    raw = await searchMastodon({ tag, limit, instance: arg('instance') });
    console.log(`Mastodon #${tag} 命中 ${raw.length} 条`);
    observations = raw.map((s) => mastodonStatusToObservation(s, { kind }));
  } else if (source === 'flickr') {
    const apiKey = process.env.FLICKR_API_KEY;
    if (!apiKey) {
      console.error('❌ 需要 FLICKR_API_KEY 环境变量。Flickr 提供免费 key：https://www.flickr.com/services/apps/create/');
      console.error('   这是官方途径，不要试图绕过。');
      process.exit(1);
    }
    raw = await searchFlickr({ query: arg('query', 'sea of clouds'), limit, apiKey });
    console.log(`Flickr 命中 ${raw.length} 张带地理标记的照片`);
    observations = raw.map((p) => flickrPhotoToObservation(p, { kind }));
  } else if (source === 'link') {
    const url = arg('url');
    if (!url) { console.error('❌ --source link 需要 --url'); process.exit(1); }
    const platform = matchPlatform(url);
    if (BLOCKED[platform]) {
      console.error(`❌ ${platform} 无法匿名获取：${BLOCKED[platform]}`);
      process.exit(1);
    }
    if (!OEMBED[platform]) {
      console.error(`❌ 暂不支持该平台：${platform || '未知'}（小红书请用 npm run ingest:xhs）`);
      process.exit(1);
    }
    const data = await getJson(OEMBED[platform](url));
    console.log(JSON.stringify(oembedToDraft(platform, url, data), null, 2));
    console.log('\nℹ️  oEmbed 不返回发布/拍摄时间，日期需人工确认后再并入数据集。');
    return;
  } else {
    console.error(`❌ 未知数据源: ${source}`);
    process.exit(1);
  }

  const accepted = observations.filter((o) => !o.rejected);
  const rejected = observations.filter((o) => o.rejected);

  const reasons = {};
  for (const r of rejected) reasons[r.rejectReason] = (reasons[r.rejectReason] || 0) + 1;
  console.log(`\n✅ 采纳 ${accepted.length} 条 / ❌ 剔除 ${rejected.length} 条`);
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(v).padStart(3)}  ${k}`);
  }

  const deduped = dedupeObservations(accepted);
  console.log(`\n去重后 ${deduped.length} 条`);

  if (deduped.length) {
    console.log('补全高程...');
    await fillElevations(deduped);
  }

  const usable = deduped.filter((o) => o.elevation != null);
  console.log(`可用（含高程）${usable.length} 条`);

  if (usable.length) {
    console.log('\n样例:');
    for (const o of usable.slice(0, 8)) {
      console.log(`  ${o.date}${o.hour != null ? ` ${String(o.hour).padStart(2, '0')}时` : '     '}  `
        + `${String(o.location).slice(0, 30).padEnd(30)} ${String(o.lat).padStart(8)},${String(o.lon).padStart(9)}  ${String(o.elevation).padStart(6)}m`);
    }

    const health = auditDataset(usable);
    console.log(`\n数据集体检: ${health.total} 条 / 正 ${health.positives} / 负 ${health.negatives} / 机位 ${health.spots}`);
    for (const w of health.warnings) console.log(`   ⚠️  ${w}`);
  }

  if (out) {
    const target = path.resolve(out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(usable, null, 2));
    console.log(`\n💾 已写入 ${path.relative(process.cwd(), target)}`);
  } else {
    console.log('\nℹ️  未指定 --out，仅预览未落盘。');
  }

  console.log('\n无法匿名获取的平台（已实测，不做绕过）:');
  for (const [k, v] of Object.entries(BLOCKED)) console.log(`   ${k.padEnd(10)} ${v}`);
}

if (require.main === module) {
  main().catch((e) => { console.error('❌', e.message); process.exit(1); });
}

module.exports = {
  stripHtml,
  parseCommonsDate,
  placeCandidates,
  parseCoord,
  validCoord,
  distanceKm,
  nearSpot,
  detectKind,
  commonsPageToObservation,
  mastodonStatusToObservation,
  flickrPhotoToObservation,
  oembedToDraft,
  matchPlatform,
  BLOCKED,
  CLOUDSEA_TERMS,
  GLOW_TERMS,
};
