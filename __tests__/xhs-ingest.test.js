const {
  classifyPostType,
  extractIntensity,
  resolveObserveDate,
  parseNoteHtml,
  toObservation,
  buildPseudoNegatives,
  dedupeObservations,
  auditDataset,
} = require('../scripts/xhs-ingest');

const spotResolver = (poi) => {
  const table = {
    黄山: { name: '黄山', lat: 30.13, lon: 118.17, elevation: 1864 },
    武功山: { name: '武功山', lat: 27.51, lon: 114.15, elevation: 1918 },
    国贸: { name: '北京国贸', lat: 39.909, lon: 116.461, elevation: 45 },
  };
  return table[poi] || null;
};

const ts = (s) => new Date(s).getTime();

describe('帖子类型分类：预报帖必须被识别', () => {
  test('大鹏式预报帖判为 prediction', () => {
    const text = '7.29北京晚霞限时返场\n预计中烧，非常值得冲。最佳观测时间晚上7点10到8点10，建议提前30分钟抵达拍照机位。建议观测机位：延庆1473咖啡。';
    expect(classifyPostType(text).type).toBe('prediction');
  });

  test('实拍返图帖判为 report', () => {
    const text = '今天的晚霞实拍返图，手机直出没白等，登顶守到了。';
    expect(classifyPostType(text).type).toBe('report');
  });

  test('无特征词判为 unknown', () => {
    expect(classifyPostType('天空').type).toBe('unknown');
  });
});

describe('强度提取：只看文字，不看图片', () => {
  test.each([
    ['今天爆烧！整个天空都炸裂了', 4],
    ['大烧，烧了半边天', 3],
    ['中烧，还行', 2],
    ['只有小烧，淡淡的一层', 1],
    ['空军了，白跑一趟', 0],
    ['翻车，啥也没有', 0],
  ])('%s -> 强度 %i', (text, level) => {
    expect(extractIntensity(text).intensity).toBe(level);
  });

  test('失败词优先级高于景观词，避免"云海翻涌"式误判', () => {
    // 空军帖里常引用别人的美景描述，必须判为 0
    expect(extractIntensity('本来想拍云瀑大云海的，结果空军').intensity).toBe(0);
  });

  test('无关键词返回 null 而非默认值', () => {
    expect(extractIntensity('今天去爬山了').intensity).toBeNull();
  });

  test('否定词护栏：「没白等」「不翻车」是正面结果，不得判为空军', () => {
    expect(extractIntensity('中烧，没白等').intensity).toBe(2);
    expect(extractIntensity('大烧！这次不翻车').intensity).toBe(3);
    expect(extractIntensity('没空军，小烧').intensity).toBe(1);
  });

  test('自身即否定形式的词仍判为 0', () => {
    expect(extractIntensity('今天没烧').intensity).toBe(0);
    expect(extractIntensity('无云海').intensity).toBe(0);
  });
});

describe('观测日期解析：发布时间 ≠ 观测时间', () => {
  test('正文显式日期优先且为 high 置信', () => {
    const r = resolveObserveDate('7.29北京晚霞', ts('2026-07-29T16:00:00'), true);
    expect(r).toMatchObject({ date: '2026-07-29', confidence: 'high' });
  });

  test('"昨晚" 回退一天', () => {
    const r = resolveObserveDate('昨晚的晚霞', ts('2026-07-30T10:00:00'), true);
    expect(r.date).toBe('2026-07-29');
  });

  test('凌晨发布的晚霞帖指前一天傍晚', () => {
    const r = resolveObserveDate('今晚太美了', ts('2026-07-30T01:20:00'), true);
    expect(r.date).toBe('2026-07-29');
  });

  test('云海帖（清晨）凌晨发布不回退', () => {
    const r = resolveObserveDate('今天的云海', ts('2026-07-30T05:30:00'), false);
    expect(r.date).toBe('2026-07-30');
  });

  test('跨年：1 月发布、正文写 12 月 → 上一年', () => {
    const r = resolveObserveDate('12.31 跨年晚霞', ts('2026-01-01T09:00:00'), true);
    expect(r.date).toBe('2025-12-31');
  });

  test('未来日期不被采信（攻略帖里的历史/预告日期）', () => {
    const r = resolveObserveDate('9.15 机位攻略', ts('2026-07-29T16:00:00'), true);
    expect(r.confidence).not.toBe('high');
  });
});

describe('端到端：真实笔记 → 观测记录', () => {
  const predictionNote = {
    title: '7.29北京晚霞限时返场',
    desc: '预计中烧，非常值得冲。最佳观测时间晚上7点10到8点10，建议提前30分钟抵达。建议观测机位：延庆1473咖啡，密云水库。',
    publishTs: ts('2026-07-29T16:00:00'),
    poiName: '国贸',
    author: { userId: 'u1', nickName: '大鹏爱自由' },
    likedCount: 33,
    commentCount: 16,
    imageCount: 5,
    imageFingerprint: 'abc',
  };

  test('预报帖被拒绝，不得进入真值集', () => {
    const r = toObservation(predictionNote, { kind: 'glow', spotResolver });
    expect(r.rejected).toBe(true);
    expect(r.rejectReason).toBe('prediction-post');
  });

  test('实拍帖生成合格记录', () => {
    const r = toObservation({
      ...predictionNote,
      title: '7.29北京晚霞返图',
      desc: '实拍返图，中烧，没白等。',
    }, { kind: 'glow', spotResolver });
    expect(r.rejected).toBe(false);
    expect(r).toMatchObject({
      date: '2026-07-29', location: '北京国贸', observed: true, intensity: 2, postType: 'report', verified: true,
    });
  });

  test('空军帖生成宝贵的真负样本', () => {
    const r = toObservation({
      ...predictionNote,
      title: '黄山云海空军记',
      desc: '实拍，爬上来结果空军了，白跑一趟。',
      poiName: '黄山',
    }, { kind: 'cloudsea', spotResolver });
    expect(r.rejected).toBe(false);
    expect(r.observed).toBe(false);
    expect(r.intensity).toBe(0);
  });

  test('无法定位的机位被拒绝', () => {
    const r = toObservation({ ...predictionNote, desc: '实拍返图 中烧', poiName: '某不知名小山' }, { kind: 'glow', spotResolver });
    expect(r).toMatchObject({ rejected: true, rejectReason: 'unresolved-location' });
  });

  test('无强度关键词被拒绝，不猜测', () => {
    const r = toObservation({ ...predictionNote, desc: '实拍返图，今天出去玩了。' }, { kind: 'glow', spotResolver });
    expect(r).toMatchObject({ rejected: true, rejectReason: 'no-intensity-keyword' });
  });
});

describe('HTML 解析', () => {
  test('从含 undefined 字面量的 __INITIAL_STATE__ 中抽取字段', () => {
    const html = `<html><script>window.__INITIAL_STATE__={"noteData":{"interactInfo":{"collectedCount":"14","likedCount":"33","commentCount":"16","sticky":false},"lastUpdateTime":1785295134000,"poi":{"name":"国贸","poiId":"B000A8WS9T"},"title":"7.29北京晚霞限时返场","desc":"实拍返图\\n中烧，没白等","user":{"userId":"609cc3ba","nickName":"大鹏爱自由"},"imageList":[{"fileId":"f1"},{"fileId":"f2"}],"x":undefined}}</script></html>`;
    const note = parseNoteHtml(html);
    expect(note).toMatchObject({
      title: '7.29北京晚霞限时返场',
      poiName: '国贸',
      likedCount: 33,
      commentCount: 16,
      collectedCount: 14,
      imageCount: 2,
      publishTs: 1785295134000,
    });
    expect(note.author.nickName).toBe('大鹏爱自由');
    expect(note.desc).toContain('中烧');
  });

  test('非笔记页返回 null', () => {
    expect(parseNoteHtml('<html><body>404</body></html>')).toBeNull();
    expect(parseNoteHtml(null)).toBeNull();
  });

  test('页尾推荐流不得污染标题（真实页面有 50+ 个 title 字段）', () => {
    const html = '<html><script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{},"data":{'
      + '"noteData":{"atUserList":[],"lastUpdateTime":1785295134000,'
      + '"poi":{"type":12,"name":"国贸","poiId":"B000A8WS9T"},'
      + '"noteId":"6a69703a000000000100fc68","type":"normal",'
      + '"desc":"实拍返图，中烧，没白等","interactInfo":{"likedCount":"40","collectedCount":"14","commentCount":"26"},'
      + '"title":"7.29北京晚霞返场","imageList":[{"fileId":"f1"},{"fileId":"f2"}],'
      + '"user":{"userId":"609cc3ba","nickName":"大鹏爱自由"}}},'
      // 页尾推荐流：其他作者的笔记
      + '"feed":[{"id":"","title":"熬夜垮脸救星！油敏皮本命精华！","user":{"nickName":"广告号"}},'
      + '{"id":"","title":"新买的东芝小白茶pro到货了！","user":{"nickName":"带货号"}}]}</script></html>';
    const note = parseNoteHtml(html);
    expect(note.title).toBe('7.29北京晚霞返场');
    expect(note.author.nickName).toBe('大鹏爱自由');
    expect(note.noteId).toBe('6a69703a000000000100fc68');
    expect(note.poiName).toBe('国贸');
    expect(note.imageCount).toBe(2);
  });

  test('poi 对象内字段顺序变化仍能取到 name', () => {
    const html = '{"noteData":{"poi":{"type":12,"poiId":"X","name":"黄山"},"title":"t","desc":"实拍 中烧"}}';
    expect(parseNoteHtml(html).poiName).toBe('黄山');
  });
});

describe('伪负样本构造：打破 presence-only 瓶颈', () => {
  const mk = (date) => ({
    kind: 'cloudsea', date, location: '黄山', lat: 30.13, lon: 118.17,
    elevation: 1864, isEvening: false, observed: true, intensity: 3,
  });

  test('高密度机位的空白日期生成伪负样本', () => {
    // 10 天窗口里 8 天有帖 → 密度 0.8，剩下 2 天为伪负
    const days = ['01', '02', '03', '04', '06', '07', '08', '10'].map((d) => mk(`2026-05-${d}`));
    const negs = buildPseudoNegatives(days, { minPostsPerSpot: 8 });
    expect(negs.map((n) => n.date).sort()).toEqual(['2026-05-05', '2026-05-09']);
    expect(negs.every((n) => n.observed === false && n.pseudo === true)).toBe(true);
    expect(negs[0].confidence).toBe('medium');
    expect(negs[0].elevation).toBe(1864);
  });

  test('发帖量不足的机位不生成伪负样本（无帖≠无景）', () => {
    const negs = buildPseudoNegatives([mk('2026-05-01'), mk('2026-05-05')], { minPostsPerSpot: 8 });
    expect(negs).toHaveLength(0);
  });

  test('密度过低不生成伪负样本', () => {
    // 8 条帖但散布在 59 天 → 密度 0.14
    const sparse = [1, 8, 15, 22, 29, 36, 43, 59].map((d) => mk(`2026-05-${String(d).padStart(2, '0')}`.replace('2026-05-59', '2026-06-28')));
    const negs = buildPseudoNegatives(sparse, { minPostsPerSpot: 8 });
    expect(negs).toHaveLength(0);
  });
});

describe('机位登记表', () => {
  const { SPOT_REGISTRY, resolveSpot: resolve } = require('../scripts/spot-registry');
  const { extractUrls } = require('../scripts/fetch-xhs-notes');

  test('登记表规模与字段完整', () => {
    expect(SPOT_REGISTRY.length).toBeGreaterThanOrEqual(80);
    for (const s of SPOT_REGISTRY) {
      expect(typeof s.name).toBe('string');
      expect(Math.abs(s.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(s.lon)).toBeLessThanOrEqual(180);
      expect(Number.isFinite(s.elevation)).toBe(true);
      expect(s.elevation).toBeGreaterThanOrEqual(0);
      expect(s.match.length).toBeGreaterThan(0);
    }
  });

  test('权威高程覆盖主要名山（DEM 会低估陡峰数百米）', () => {
    expect(resolve('黄山风景区', null).elevation).toBe(1864);
    expect(resolve('泰山', null).elevation).toBe(1545);
    expect(resolve(null, '牛背山日出').elevation).toBe(3660);
    // DEM 值一并留存以便审计
    expect(resolve('黄山', null).demMax).toBeLessThan(1864);
  });

  test('具体机位优先于宽泛地名', () => {
    // "北京妙峰山" 不得被 "北京" 抢先匹配成城区机位
    expect(resolve(null, '今天去北京妙峰山看云海').name).toBe('妙峰山');
  });

  test('POI 优先于正文', () => {
    expect(resolve('泰山', '出发前在北京集合').name).toBe('泰山');
  });

  test('雪山观景台高程低于主峰属正常，已标注 viewpoint', () => {
    const gongga = resolve('子梅垭口', null);
    expect(gongga.name).toBe('贡嘎山');
    expect(gongga.viewpoint).toBeTruthy();
    // 坐标必须是观景位，不能被吸附到主峰，否则会在冰川上取天气
    expect(gongga.elevation).toBeLessThan(gongga.demMax);
  });

  test('未登记机位返回 null，不猜测高程', () => {
    expect(resolve('某野山', '某野山看云海')).toBeNull();
  });

  test('从 App 分享文案中提取链接（含 xhslink 短链）', () => {
    const raw = '12 大鹏爱自由发布了一篇小红书笔记，快来看吧！ 😆 http://xhslink.com/a/AbC123 😆 '
      + '还有 https://www.xiaohongshu.com/discovery/item/abc123?xsec_token=T1 快看';
    expect(extractUrls(raw)).toEqual([
      'http://xhslink.com/a/AbC123',
      'https://www.xiaohongshu.com/discovery/item/abc123?xsec_token=T1',
    ]);
  });

  test('提取链接去重且忽略非小红书域名', () => {
    const raw = 'https://www.xiaohongshu.com/x/1 https://example.com/y https://www.xiaohongshu.com/x/1';
    expect(extractUrls(raw)).toEqual(['https://www.xiaohongshu.com/x/1']);
  });
});

describe('去重与数据集体检', () => {
  test('同作者同日同机位、同首图指纹均去重', () => {
    const base = { author: 'A', date: '2026-05-01', location: '黄山', observed: true, imageFingerprint: 'f1' };
    const list = [base, { ...base }, { ...base, author: 'B', imageFingerprint: 'f1' }, { ...base, author: 'C', imageFingerprint: 'f9' }];
    expect(dedupeObservations(list)).toHaveLength(2);
  });

  test('被拒绝的记录不进入结果', () => {
    expect(dedupeObservations([{ rejected: true, rejectReason: 'x' }])).toHaveLength(0);
  });

  test('体检报出正样本率过高与负样本不足', () => {
    const list = Array.from({ length: 100 }, (_, i) => ({ observed: true, location: `山${i % 12}`, confidence: 'high' }));
    const a = auditDataset(list);
    expect(a.positiveRate).toBe(1);
    expect(a.warnings.join()).toMatch(/正样本率/);
    expect(a.warnings.join()).toMatch(/负样本仅/);
  });

  test('健康数据集无警告', () => {
    const list = [
      ...Array.from({ length: 60 }, (_, i) => ({ observed: true, location: `山${i % 15}`, confidence: 'high' })),
      ...Array.from({ length: 40 }, (_, i) => ({ observed: false, location: `山${i % 15}`, confidence: 'high' })),
    ];
    expect(auditDataset(list).warnings).toHaveLength(0);
  });

  test('伪负样本占比过高会被标注', () => {
    const list = [
      ...Array.from({ length: 60 }, (_, i) => ({ observed: true, location: `山${i % 15}`, confidence: 'high' })),
      ...Array.from({ length: 40 }, (_, i) => ({ observed: false, pseudo: true, location: `山${i % 15}`, confidence: 'low' })),
    ];
    expect(auditDataset(list).warnings.join()).toMatch(/伪负样本/);
  });
});
