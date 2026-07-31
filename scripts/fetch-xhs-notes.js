#!/usr/bin/env node
/**
 * 小红书笔记采集 CLI —— 分享链接列表 → 观测真值 JSON
 *
 * 用法:
 *   node scripts/fetch-xhs-notes.js --in urls.txt --kind glow  --out data/glow-observations.json
 *   node scripts/fetch-xhs-notes.js --in urls.txt --kind cloudsea --out data/cloudsea-observations.json
 *
 * urls.txt: 每行一个小红书分享链接（App「分享 → 复制链接」得到的带 xsec_token 的完整 URL）。
 *
 * 【为什么是链接喂入而不是站内爬取】
 * 小红书搜索页/信息流页的 __INITIAL_STATE__ 只有 app 配置、不含笔记列表；
 * 发现类接口需要 x-s/x-t 签名 + 登录 cookie。笔记**详情页**用移动端 UA 可直抓。
 * 因此本工具只负责「给定链接 → 结构化真值」，不做站点发现，也不绕过任何风控。
 * 请控制频率并遵守平台条款。
 *
 * 【输出会附带数据集体检】正样本率过高 / 负样本不足 / 机位过少 都会显式告警——
 * 这些正是让"数据越抓越多、模型反而越差"的根因。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const {
  parseNoteHtml, toObservation, dedupeObservations, buildPseudoNegatives, auditDataset,
} = require('./xhs-ingest');
const { SPOT_REGISTRY, resolveSpot } = require('./spot-registry');

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * 抓取笔记 HTML。
 * - 支持 xhslink.com 短链（App「分享→复制链接」复制出来的就是短链），自动跟随跳转
 * - 支持 XHS_COOKIE 环境变量：token 过期时用自己的登录态兜底
 * - 不做任何签名伪造或风控绕过
 */
function fetchHtml(url, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('http://') ? http : https;
    const headers = { 'User-Agent': MOBILE_UA, 'Accept-Language': 'zh-CN,zh;q=0.9' };
    if (process.env.XHS_COOKIE) headers.Cookie = process.env.XHS_COOKIE;

    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchHtml(next, depth + 1));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
      return undefined;
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
  });
}

/** 从任意文本中提取小红书链接（支持 App 分享文案整段粘贴） */
function extractUrls(raw) {
  const re = /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s"'）)】\]]+/g;
  return [...new Set(String(raw || '').match(re) || [])];
}

function parseArgs(argv) {
  const out = { kind: 'glow', pseudo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.in = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--kind') out.kind = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--pseudo-negatives') out.pseudo = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let urls = [];
  if (args.url) urls = extractUrls(args.url);
  else if (args.in) {
    // 支持整段粘贴 App 分享文案，自动提取其中的链接（含 xhslink 短链）
    urls = extractUrls(fs.readFileSync(args.in, 'utf8'));
  } else {
    console.error('用法: node scripts/fetch-xhs-notes.js --in urls.txt --kind glow|cloudsea [--out file.json] [--pseudo-negatives]');
    console.error('      urls.txt 可直接粘贴 App 分享文案，会自动提取 xiaohongshu.com / xhslink.com 链接');
    console.error('      token 过期时可设置环境变量 XHS_COOKIE 用自己的登录态兜底');
    process.exit(1);
  }
  if (!urls.length) {
    console.error('未从输入中提取到任何小红书链接。');
    process.exit(1);
  }

  console.log(`📥 待采集 ${urls.length} 条 | 类型 ${args.kind}`);
  const accepted = [];
  const rejected = [];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const note = parseNoteHtml(html);
      if (!note) { rejected.push({ url, rejectReason: 'unparsable-or-blocked' }); console.log(`  ✗ ${url.slice(0, 60)} 解析失败/被拦截`); continue; }

      const obs = toObservation(note, {
        kind: args.kind,
        spotResolver: (poi, text) => resolveSpot(poi, text),
      });
      if (obs.rejected) {
        rejected.push({ url, title: note.title, ...obs });
        console.log(`  ✗ 「${note.title.slice(0, 24)}」→ ${obs.rejectReason}`);
      } else {
        accepted.push(obs);
        console.log(`  ✓ ${obs.date} ${obs.location.padEnd(8)} 强度${obs.intensity} (${obs.intensityKeyword}) 置信${obs.confidence} 「${note.title.slice(0, 20)}」`);
      }
    } catch (e) {
      rejected.push({ url, rejectReason: e.message });
      console.log(`  ✗ ${url.slice(0, 60)} ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1200)); // 限速，避免给平台造成压力
  }

  let dataset = dedupeObservations(accepted);
  if (args.pseudo) {
    const negs = buildPseudoNegatives(dataset.filter((o) => o.observed));
    console.log(`\n🧪 伪负样本 +${negs.length} 条`);
    dataset = dataset.concat(negs);
  }

  const audit = auditDataset(dataset);
  console.log('\n' + '='.repeat(70));
  console.log(`采纳 ${dataset.length} 条 | 拒绝 ${rejected.length} 条`);
  console.log(`正 ${audit.positives} / 负 ${audit.negatives}（其中伪负 ${audit.pseudoNegatives}）| 机位 ${audit.spots} 个 | 低置信 ${audit.lowConfidence} 条`);
  const byReason = rejected.reduce((m, r) => { m[r.rejectReason] = (m[r.rejectReason] || 0) + 1; return m; }, {});
  if (rejected.length) console.log('拒绝原因:', JSON.stringify(byReason));
  if (audit.warnings.length) {
    console.log('\n⚠️  数据集体检未通过:');
    audit.warnings.forEach((w) => console.log(`   - ${w}`));
  } else {
    console.log('\n✅ 数据集体检通过，可用于权重标定。');
  }

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify({ generatedAt: new Date().toISOString(), kind: args.kind, audit, observations: dataset }, null, 2), 'utf8');
    console.log(`\n💾 已写入 ${args.out}`);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = {
  resolveSpot, fetchHtml, extractUrls, SPOT_REGISTRY,
};
