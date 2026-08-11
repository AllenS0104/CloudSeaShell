#!/usr/bin/env node
/**
 * METAR 客观云底观测 —— 用仪器观测独立校验云海标签
 *
 * 为什么要有这个脚本
 * ------------------
 * 审计发现：国内样本（模糊地名 + 发帖时间 + 控制日弱负标签）的可学习信号
 * 接近于零（域内 AUC 0.506），而外部 Commons 样本（EXIF 时间 + 精确 GPS）
 * 有 0.791。瓶颈不在算法，在标签。
 *
 * 同时，样本全部来自"有人拍到了才会上传"，缺少真负样本（幸存者偏差）。
 *
 * METAR 同时解决这两件事：
 *   - 机场每小时定时观测，不管天气好坏都发报 → 天然无幸存者偏差
 *   - 报文含云底高度与分层云量，是仪器/观测员的客观读数，不是"我觉得很美"
 *   - Iowa State Mesonet 存有全球历史存档，可回溯到我们样本的年代
 *
 * 核心物理
 * --------
 * METAR 的云底高度是**距测站的高度（AGL）**，测站高程已知，于是：
 *
 *     云底海拔 = 测站高程 + 云底AGL × 0.3048
 *
 * 把它和机位高程一比，就得到一个客观三分类：
 *
 *     云底海拔 明显低于 机位  → 机位在云层之上，这才是「云海」
 *     云底海拔 明显高于 机位  → 云在头顶，是阴天，不是云海
 *     云底海拔 ≈ 机位         → 机位正埋在云里，是「白墙」
 *
 * 「白墙」尤其重要：它在照片里是失败，但在只看湿度的模型里却是高分，
 * 是假阳性的主要来源，而我们此前**完全没有**这类样本。
 *
 * 局限（务必如实看待）
 * --------------------
 * 机场在平地或谷地，山区的云底会因地形抬升而与机场读数有出入；
 * 距离越远越不可比。因此本脚本对每条匹配都记录距离与高程差，
 * 并默认丢弃 80km 以外的匹配，让使用方能自行判断可信度。
 * 这是一个**独立参考量**，不是绝对真值。
 *
 * 数据源均为公开档案，不涉及任何认证绕过。
 *
 * 用法：
 *   node scripts/metar-truth.js --check            # 只做站点匹配，不拉数据
 *   node scripts/metar-truth.js --limit 50         # 试跑
 *   node scripts/metar-truth.js                    # 全量
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CACHE_FILE = path.join(ROOT, '.metar-cache.json');
const SWEEP_CACHE = path.join(ROOT, '.metar-sweep-cache.json');
const STATION_CACHE = path.join(ROOT, '.metar-stations.json');
const OUT_FILE = path.join(ROOT, 'data', 'metar-truth.json');
const SWEEP_FILE = path.join(ROOT, 'data', 'metar-sweep.json');

const UA = 'CloudSeaShell/1.0 (cloud-sea forecast research; contact via GitHub AllenS0104/CloudSeaShell)';
const FT_TO_M = 0.3048;
const MAX_DIST_KM = 80;

// METAR 云量代码 → 覆盖度（八分之几）。
// FEW/SCT 不足以成海，BKN/OVC 才是连续云层。
const COVER_OKTAS = {
  SKC: 0, CLR: 0, NCD: 0, NSC: 0, CAVOK: 0, FEW: 2, SCT: 4, BKN: 6, OVC: 8, VV: 8,
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let lastCall = 0;
async function throttle(minGapMs = 1200) {
  const wait = lastCall + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

function get(url, { timeout = 45000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(res.headers.location, { timeout }).then(resolve, reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
      return undefined;
    });
    req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function getRetry(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    await throttle();
    try {
      const r = await get(url);
      // 429/5xx 退避重试；Mesonet 明确要求客户端自我节流
      if (r.status === 429 || r.status >= 500) {
        await sleep(2000 * (2 ** i));
        lastErr = new Error(`HTTP ${r.status}`);
        continue;
      }
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      return r.body;
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (2 ** i));
    }
  }
  throw lastErr;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 下载并缓存全球 ASOS 站点库（199 个国家网络，只需拉一次）。 */
async function loadStations() {
  if (fs.existsSync(STATION_CACHE)) {
    return JSON.parse(fs.readFileSync(STATION_CACHE, 'utf8'));
  }
  process.stdout.write('首次运行：下载全球 METAR 站点库…\n');
  const netsRaw = await getRetry('https://mesonet.agron.iastate.edu/api/1/networks.json');
  const netsJson = JSON.parse(netsRaw);
  const nets = (netsJson.data || netsJson).filter((n) => /__ASOS$/.test(n.id));

  const stations = [];
  for (let i = 0; i < nets.length; i += 1) {
    const net = nets[i];
    try {
      const raw = await getRetry(
        `https://mesonet.agron.iastate.edu/geojson/network/${net.id}.geojson`, 2,
      );
      const gj = JSON.parse(raw);
      (gj.features || []).forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const elev = Number(f.properties.elevation);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        stations.push({
          id: f.id,
          name: f.properties.sname,
          lat,
          lon,
          elev: Number.isFinite(elev) ? elev : null,
          network: net.id,
        });
      });
    } catch (e) {
      process.stdout.write(`  跳过 ${net.id}: ${e.message}\n`);
    }
    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ${i + 1}/${nets.length} 个网络，累计 ${stations.length} 站\n`);
    }
  }
  fs.writeFileSync(STATION_CACHE, JSON.stringify(stations));
  process.stdout.write(`站点库就绪：${stations.length} 站\n`);
  return stations;
}

function nearestStation(stations, lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < stations.length; i += 1) {
    const s = stations[i];
    // 先用便宜的矩形粗筛，避免对上万站做三角函数
    if (Math.abs(s.lat - lat) > 1.2) continue;
    let dLon = Math.abs(s.lon - lon);
    if (dLon > 180) dLon = 360 - dLon;
    if (dLon > 1.8) continue;
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best ? { station: best, distKm: bestD } : null;
}

/** 解析 Mesonet CSV 为逐小时记录。 */
function parseCsv(text) {
  const lines = text.trim().split('\n').filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    head.forEach((h, i) => { row[h.trim()] = (cells[i] || '').trim(); });
    return row;
  });
}

/**
 * 从一条 METAR 记录里取出「最低的连续云层」。
 * FEW/SCT 是零散云，成不了海；只有 BKN/OVC/VV 才算连续覆盖。
 */
function lowestSolidLayer(row) {
  let best = null;
  for (let i = 1; i <= 4; i += 1) {
    const cover = (row[`skyc${i}`] || '').toUpperCase();
    const rawBase = (row[`skyl${i}`] || '').trim();
    const oktas = COVER_OKTAS[cover];
    if (oktas === undefined || oktas < 6) continue;
    // 注意：Number('') === 0，若不先判空串，缺失云底会变成 0ft，
    // 于是「云底=测站高程」，任何山顶机位都会被误判成"在云上"。
    // 这是最危险的一类假阳性，必须显式挡掉。
    if (!rawBase) continue;
    const baseFt = Number(rawBase);
    if (!Number.isFinite(baseFt)) continue;
    if (!best || baseFt < best.baseFt) best = { cover, baseFt, oktas };
  }
  return best;
}

function maxOktas(row) {
  let m = 0;
  for (let i = 1; i <= 4; i += 1) {
    const o = COVER_OKTAS[(row[`skyc${i}`] || '').toUpperCase()];
    if (o !== undefined && o > m) m = o;
  }
  return m;
}

/**
 * 客观判定：把云底海拔与机位高程比较。
 *
 * 容差 150m 不是随手定的：METAR 云底以 100ft(30m) 为步进上报，
 * 山区地形抬升本身也有量级相当的误差，取 150m 让"贴着云顶"
 * 这种模棱两可的情况落进 in-cloud 而不是被武断地判成云海。
 */
function classify(cloudBaseM, spotElevM) {
  if (cloudBaseM === null) return { verdict: 'clear', note: '无连续云层' };
  const rel = cloudBaseM - spotElevM;
  if (rel < -150) return { verdict: 'above-cloud', note: '云底低于机位，机位在云上' };
  if (rel > 150) return { verdict: 'below-cloud', note: '云底高于机位，云在头顶' };
  return { verdict: 'in-cloud', note: '云底与机位齐平，机位埋在云中（白墙）' };
}

async function fetchDay(stationId, date) {
  const d = new Date(`${date}T00:00:00Z`);
  const end = new Date(d.getTime() + 36 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py'
    + `?station=${stationId}`
    + '&data=tmpf&data=dwpf&data=skyc1&data=skyl1&data=skyc2&data=skyl2'
    + '&data=skyc3&data=skyl3&data=skyc4&data=skyl4&data=vsby&data=sknt'
    + `&year1=${d.getUTCFullYear()}&month1=${d.getUTCMonth() + 1}&day1=${d.getUTCDate()}`
    + `&year2=${end.getUTCFullYear()}&month2=${end.getUTCMonth() + 1}&day2=${end.getUTCDate()}`
    + '&tz=UTC&format=onlycomma&missing=empty&trace=empty&report_type=3';
  return parseCsv(await getRetry(url));
}

function loadObservations() {
  const out = [];

  // 人工标注集直接从 backtest 取（它是代码里的常量，不是 JSON 文件）。
  // 这批恰恰是最需要独立校验的：审计显示国内域内 AUC 只有 0.506。
  try {
    // eslint-disable-next-line global-require
    const { observations: manual } = require('../miniprogram/utils/tests/backtest');
    (manual || []).forEach((o) => {
      out.push({
        lat: Number(o.lat),
        lon: Number(o.lon),
        date: String(o.date).slice(0, 10),
        elevation: Number(o.elevation),
        label: o.observed === true,
        spot: o.location || '',
        source: o.source || 'manual',
      });
    });
  } catch (e) {
    process.stdout.write(`  载入人工标注失败: ${e.message}\n`);
  }

  const files = [
    ['data/observations-commons.json', 'commons'],
    ['data/observations.json', 'xhs'],
  ];
  files.forEach(([rel, tag]) => {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.observations || []);
    list.forEach((o) => {
      const lat = Number(o.lat ?? o.latitude);
      const lon = Number(o.lon ?? o.longitude);
      const date = (o.date || o.observedAt || '').slice(0, 10);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      out.push({
        lat,
        lon,
        date,
        elevation: Number(o.elevation ?? o.altitude ?? NaN),
        label: o.label ?? o.observed ?? o.hasCloudSea ?? null,
        spot: o.spot || o.spotName || o.location || '',
        source: o.source || tag,
      });
    });
  });
  return out;
}

/**
 * 扫描模式：对每个机位扫过完整时间段的**每一天**，不管那天有没有人拍照。
 *
 * 这才是真正解决幸存者偏差的一步。前面的逐样本校验仍然只看
 * "有人上传照片的日子"，而这里 METAR 每小时定时发报，
 * 阴天、白墙、万里无云的日子一条不落，全都在档案里。
 *
 * 只保留高置信标签：
 *   above-cloud → 正样本（机位在连续云层之上）
 *   below-cloud / in-cloud → 负样本（云在头顶 / 机位埋在云里）
 *   clear → **单独列出，不当负样本**
 *
 * 为什么 clear 不能当负样本：机场多在开阔平地，而云海常是山谷局地
 * 辐射雾。机场报"无云"完全可能同时山谷里正翻着云海。
 * 把它当负样本会引入系统性错误标签，比没有样本更糟。
 */
async function sweepMode(stations, args) {
  const yearsIdx = args.indexOf('--years');
  const years = yearsIdx >= 0 ? Number(args[yearsIdx + 1]) : 3;
  const minRelief = 400; // 机位需高出测站的最小高差
  const maxDist = 60;

  const observations = loadObservations();
  const seen = new Map();
  observations.forEach((o) => {
    if (!Number.isFinite(o.elevation)) return;
    const key = `${o.lat.toFixed(2)},${o.lon.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.set(key, {
        lat: o.lat, lon: o.lon, elevation: o.elevation, spot: o.spot, source: o.source,
      });
    }
  });

  const sites = [];
  seen.forEach((s) => {
    const m = nearestStation(stations, s.lat, s.lon);
    if (!m || m.distKm > maxDist) return;
    if (!Number.isFinite(m.station.elev)) return;
    const relief = s.elevation - m.station.elev;
    // 高差太小时，云底必须极低才可能低于机位，判定几乎恒为"云下"，没有信息量。
    // 前面的分距分高差检验已经显示 <500m 组确认率只有 30%。
    if (relief < minRelief) return;
    sites.push({ ...s, station: m.station, distKm: m.distKm, relief });
  });

  sites.sort((a, b) => b.relief - a.relief);
  process.stdout.write(`\n符合扫描条件的机位：${sites.length} 个`
    + `（距测站 <${maxDist}km 且高出测站 >${minRelief}m）\n`);
  sites.slice(0, 12).forEach((s) => {
    process.stdout.write(`  ${(s.spot || '?').slice(0, 14).padEnd(16)}${String(Math.round(s.elevation)).padStart(5)}m`
      + `  ←${s.distKm.toFixed(0)}km→  ${s.station.id} (${Math.round(s.station.elev)}m, 高差 ${Math.round(s.relief)}m)\n`);
  });
  if (args.includes('--check')) return;

  const endY = new Date().getUTCFullYear();
  const startY = endY - years + 1;
  const cache = fs.existsSync(SWEEP_CACHE) ? JSON.parse(fs.readFileSync(SWEEP_CACHE, 'utf8')) : {};
  const out = [];

  for (let i = 0; i < sites.length; i += 1) {
    const s = sites[i];
    const key = `${s.station.id}|${startY}-${endY}`;
    let rows = cache[key];
    if (!rows) {
      try {
        rows = await fetchRange(s.station.id, `${startY}-01-01`, `${endY}-12-31`);
        cache[key] = rows;
        fs.writeFileSync(SWEEP_CACHE, JSON.stringify(cache));
      } catch (e) {
        process.stdout.write(`  ${s.station.id} 失败: ${e.message}\n`);
        continue;
      }
    }

    // 按当地日期聚合清晨时段
    const offsetH = Math.round(s.lon / 15);
    const byDate = new Map();
    rows.forEach((r) => {
      const v = r.valid || '';
      const hUtc = Number(v.slice(11, 13));
      if (!Number.isFinite(hUtc)) return;
      const local = ((hUtc + offsetH) % 24 + 24) % 24;
      if (local < 4 || local > 9) return;
      // 跨 UTC 日界时当地日期要回退/前进一天
      const base = new Date(`${v.slice(0, 10)}T00:00:00Z`);
      const shifted = new Date(base.getTime() + Math.floor((hUtc + offsetH) / 24) * 86400000);
      const d = shifted.toISOString().slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(r);
    });

    let kept = 0;
    byDate.forEach((rs, date) => {
      if (rs.length < 3) return; // 当天清晨报文太少，不足以判断
      const bases = rs.map((r) => {
        const l = lowestSolidLayer(r);
        return l ? s.station.elev + l.baseFt * FT_TO_M : null;
      });
      const solid = bases.filter((b) => b !== null).sort((a, b) => a - b);
      const med = solid.length >= Math.ceil(rs.length / 2)
        ? Math.round(solid[Math.floor(solid.length / 2)]) : null;
      const cls = classify(med, s.elevation);
      if (cls.verdict === 'clear') return; // 见上：不当负样本
      out.push({
        date,
        lat: s.lat,
        lon: s.lon,
        spot: s.spot,
        elevation: s.elevation,
        station: s.station.id,
        stationElevM: s.station.elev,
        distKm: Number(s.distKm.toFixed(1)),
        medianCloudBaseM: med,
        relativeToSpotM: med === null ? null : med - Math.round(s.elevation),
        verdict: cls.verdict,
        label: cls.verdict === 'above-cloud',
        source: 'metar-sweep',
      });
      kept += 1;
    });
    process.stdout.write(`  [${i + 1}/${sites.length}] ${s.station.id} ${(s.spot || '').slice(0, 12)}`
      + ` → ${kept} 天有高置信标签\n`);
  }

  fs.mkdirSync(path.dirname(SWEEP_FILE), { recursive: true });
  fs.writeFileSync(SWEEP_FILE, JSON.stringify(out, null, 2));
  const pos = out.filter((o) => o.label).length;
  process.stdout.write(`\n写入 ${SWEEP_FILE}\n`);
  process.stdout.write(`客观样本 ${out.length} 条：正 ${pos} / 负 ${out.length - pos}`
    + `（正样本率 ${(pos / out.length * 100).toFixed(1)}%）\n`);
  process.stdout.write('这批样本不依赖"有没有人拍照"，因此不含幸存者偏差。\n');
}

async function fetchRange(stationId, from, to) {
  const a = from.split('-');
  const b = to.split('-');
  const url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py'
    + `?station=${stationId}`
    + '&data=skyc1&data=skyl1&data=skyc2&data=skyl2&data=skyc3&data=skyl3&data=skyc4&data=skyl4'
    + `&year1=${a[0]}&month1=${a[1]}&day1=${a[2]}`
    + `&year2=${b[0]}&month2=${b[1]}&day2=${b[2]}`
    + '&tz=UTC&format=onlycomma&missing=empty&trace=empty&report_type=3';
  return parseCsv(await getRetry(url));
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const limIdx = args.indexOf('--limit');
  const limit = limIdx >= 0 ? Number(args[limIdx + 1]) : Infinity;

  if (args.includes('--sweep')) {
    const st = await loadStations();
    process.stdout.write(`站点库 ${st.length} 站\n`);
    await sweepMode(st, args);
    return;
  }

  const observations = loadObservations();
  if (!observations.length) {
    process.stdout.write('没有找到观测数据，先跑 npm run ingest:commons\n');
    return;
  }
  process.stdout.write(`载入观测 ${observations.length} 条\n`);

  const stations = await loadStations();
  process.stdout.write(`站点库 ${stations.length} 站\n\n`);

  // 同一坐标复用匹配结果，避免重复最近邻搜索
  const matchCache = new Map();
  let matched = 0;
  const tasks = [];
  observations.forEach((o) => {
    const key = `${o.lat.toFixed(3)},${o.lon.toFixed(3)}`;
    if (!matchCache.has(key)) matchCache.set(key, nearestStation(stations, o.lat, o.lon));
    const m = matchCache.get(key);
    if (!m || m.distKm > MAX_DIST_KM) return;
    matched += 1;
    tasks.push({ ...o, station: m.station, distKm: m.distKm });
  });

  process.stdout.write(`可匹配到 ${MAX_DIST_KM}km 内测站的样本：${matched}/${observations.length}`
    + ` (${(matched / observations.length * 100).toFixed(1)}%)\n`);

  const byStation = {};
  tasks.forEach((t) => { byStation[t.station.id] = (byStation[t.station.id] || 0) + 1; });
  const top = Object.entries(byStation).sort((a, b) => b[1] - a[1]).slice(0, 10);
  process.stdout.write('样本最多的测站：\n');
  top.forEach(([id, n]) => {
    const s = stations.find((x) => x.id === id);
    process.stdout.write(`  ${id.padEnd(6)} ${String(n).padStart(3)} 条  ${s.elev}m  ${s.name}\n`);
  });

  if (checkOnly) return;

  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  const results = [];
  const run = tasks.slice(0, limit);
  process.stdout.write(`\n开始拉取 METAR（${run.length} 条，已缓存的不重复请求）\n`);

  for (let i = 0; i < run.length; i += 1) {
    const t = run[i];
    const key = `${t.station.id}|${t.date}`;
    let rows = cache[key];
    if (!rows) {
      try {
        rows = await fetchDay(t.station.id, t.date);
        cache[key] = rows;
        if (i % 20 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      } catch (e) {
        process.stdout.write(`  ${t.station.id} ${t.date} 失败: ${e.message}\n`);
        rows = [];
        cache[key] = [];
      }
    }
    if (!rows.length) continue;

    // 取当地清晨时段。没有逐点时区，用经度估算 UTC 偏移已足够定位"日出前后"。
    const offsetH = Math.round(t.lon / 15);
    const dawn = rows.filter((r) => {
      const hUtc = Number((r.valid || '').slice(11, 13));
      if (!Number.isFinite(hUtc)) return false;
      const local = ((hUtc + offsetH) % 24 + 24) % 24;
      return local >= 4 && local <= 9 && (r.valid || '').startsWith(t.date);
    });
    if (!dawn.length) continue;

    const spotElev = Number.isFinite(t.elevation) ? t.elevation : null;
    const stElev = Number.isFinite(t.station.elev) ? t.station.elev : 0;

    const samples = dawn.map((r) => {
      const layer = lowestSolidLayer(r);
      const baseM = layer ? stElev + layer.baseFt * FT_TO_M : null;
      return {
        time: r.valid,
        cloudBaseM: baseM === null ? null : Math.round(baseM),
        oktas: maxOktas(r),
        vsbyMi: Number(r.vsby) || null,
      };
    });

    const solid = samples.filter((s) => s.cloudBaseM !== null);
    const medBase = solid.length
      ? solid.map((s) => s.cloudBaseM).sort((a, b) => a - b)[Math.floor(solid.length / 2)]
      : null;
    const cls = spotElev !== null ? classify(medBase, spotElev) : { verdict: 'unknown', note: '缺机位高程' };

    results.push({
      date: t.date,
      lat: t.lat,
      lon: t.lon,
      spot: t.spot,
      source: t.source,
      label: t.label,
      spotElevM: spotElev,
      station: t.station.id,
      stationName: t.station.name,
      stationElevM: t.station.elev,
      distKm: Number(t.distKm.toFixed(1)),
      dawnSamples: samples.length,
      medianCloudBaseM: medBase,
      relativeToSpotM: (medBase !== null && spotElev !== null) ? medBase - spotElev : null,
      maxOktas: Math.max(...samples.map((s) => s.oktas)),
      verdict: cls.verdict,
      note: cls.note,
    });

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ${i + 1}/${run.length}，已产出 ${results.length} 条\n`);
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  process.stdout.write(`\n写入 ${OUT_FILE}：${results.length} 条\n`);

  const tally = {};
  results.forEach((r) => { tally[r.verdict] = (tally[r.verdict] || 0) + 1; });
  process.stdout.write('\n客观判定分布：\n');
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    process.stdout.write(`  ${k.padEnd(12)} ${String(v).padStart(4)} 条 (${(v / results.length * 100).toFixed(1)}%)\n`);
  });

  // 标签 vs 客观观测的一致性——这是本脚本真正想回答的问题
  const labelled = results.filter((r) => r.label === true || r.label === 1);
  if (labelled.length) {
    const agree = labelled.filter((r) => r.verdict === 'above-cloud').length;
    process.stdout.write(`\n人工判为「有云海」的 ${labelled.length} 条中，`
      + `${agree} 条 (${(agree / labelled.length * 100).toFixed(1)}%) 被 METAR 独立确认为"机位在云上"\n`);
  }
}

if (require.main === module) {
  main().catch((e) => { process.stderr.write(`失败: ${e.stack}\n`); process.exit(1); });
}

module.exports = {
  haversineKm, lowestSolidLayer, maxOktas, classify, parseCsv, nearestStation, COVER_OKTAS,
};
