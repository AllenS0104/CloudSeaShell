/**
 * social-ingest 纯解析函数单测。
 *
 * 这些解析器的失败模式是**静默的**：日期解析错了不会报错，只会往回测集里
 * 塞进一条"某天某地有云海"的假真值，然后整个模型标定跟着歪掉。
 * 所以宁可解析失败返回 null（样本被丢弃），也不能猜错。
 */

const {
  stripHtml,
  parseCommonsDate,
  parseCoord,
  validCoord,
  distanceKm,
  nearSpot,
  detectKind,
  commonsPageToObservation,
  oembedToDraft,
  matchPlatform,
  BLOCKED,
} = require('../scripts/social-ingest');

describe('stripHtml', () => {
  test('剥离标签与实体', () => {
    expect(stripHtml('<span class="x">2020-01-22</span>')).toBe('2020-01-22');
    expect(stripHtml('a&nbsp;&amp;b')).toBe('a b');
  });

  test('空值安全', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });
});

describe('parseCommonsDate', () => {
  // 以下格式全部来自 Commons 真实返回，不是构造的
  test('ISO 带时间', () => {
    expect(parseCommonsDate('2020-01-22 09:25:22')).toEqual({ date: '2020-01-22', hour: 9 });
  });

  test('纯 ISO 日期', () => {
    expect(parseCommonsDate('2018-05-15')).toEqual({ date: '2018-05-15', hour: null });
  });

  test('"Taken on" 前缀的英文日期', () => {
    expect(parseCommonsDate('Taken on 5 December 2019')).toEqual({ date: '2019-12-05', hour: null });
  });

  test('带 EXIF 说明尾巴的日期', () => {
    expect(parseCommonsDate('22 November 2004 (according to Exif data)'))
      .toEqual({ date: '2004-11-22', hour: null });
  });

  test('月在前的美式日期', () => {
    expect(parseCommonsDate('January 3, 2015')).toEqual({ date: '2015-01-03', hour: null });
  });

  test('HTML 包裹', () => {
    expect(parseCommonsDate('<span style="white-space:nowrap">2016-09-08</span>').date).toBe('2016-09-08');
  });

  test('补零', () => {
    expect(parseCommonsDate('2020-1-2').date).toBe('2020-01-02');
  });

  test('无法识别时返回 null 而不是瞎猜', () => {
    expect(parseCommonsDate('unknown date').date).toBeNull();
    expect(parseCommonsDate('').date).toBeNull();
    expect(parseCommonsDate(null).date).toBeNull();
  });
});

describe('parseCoord', () => {
  test('十进制', () => {
    expect(parseCoord('28.32994')).toBeCloseTo(28.32994, 5);
    expect(parseCoord(-16.4897)).toBeCloseTo(-16.4897, 4);
  });

  test('度分秒带半球', () => {
    expect(parseCoord('28° 19\' 48" N')).toBeCloseTo(28.33, 2);
    expect(parseCoord('16° 29\' 22" W')).toBeCloseTo(-16.489, 2);
  });

  test('南半球取负', () => {
    expect(parseCoord('33° 51\' 0" S')).toBeCloseTo(-33.85, 2);
  });

  test('非坐标返回 null', () => {
    expect(parseCoord('somewhere')).toBeNull();
    expect(parseCoord(null)).toBeNull();
    expect(parseCoord('')).toBeNull();
  });
});

describe('validCoord', () => {
  test('接受合法坐标', () => {
    expect(validCoord(30.13, 118.17)).toBe(true);
  });

  test('拒绝越界', () => {
    expect(validCoord(91, 0)).toBe(false);
    expect(validCoord(0, 181)).toBe(false);
  });

  test('拒绝 0,0 —— 几乎全是坐标缺失的占位值而不是几内亚湾', () => {
    expect(validCoord(0, 0)).toBe(false);
  });

  test('拒绝非数字', () => {
    expect(validCoord(null, 118)).toBe(false);
    expect(validCoord(NaN, 1)).toBe(false);
  });
});

describe('distanceKm / nearSpot', () => {
  test('同点距离为 0', () => {
    expect(distanceKm(30.13, 118.17, 30.13, 118.17)).toBeCloseTo(0, 3);
  });

  test('已知距离大致正确（黄山→泰山约 600km）', () => {
    const d = distanceKm(30.13, 118.17, 36.25, 117.1);
    expect(d).toBeGreaterThan(600);
    expect(d).toBeLessThan(750);
  });

  const huangshan = { name: '黄山', lat: 30.13, lon: 118.17, elevation: 1864 };

  test('机位附近的照片被认可', () => {
    expect(nearSpot(huangshan, 30.14, 118.18)).toBe(true);
  });

  test('名字命中但坐标在几百公里外必须拒绝，否则会把权威高程错配到平地', () => {
    expect(nearSpot(huangshan, 36.25, 117.1)).toBe(false);
  });

  test('坐标非法时拒绝', () => {
    expect(nearSpot(huangshan, null, null)).toBe(false);
    expect(nearSpot(null, 30.13, 118.17)).toBe(false);
  });
});

describe('detectKind', () => {
  test('识别中英文云海', () => {
    expect(detectKind('Sea of clouds at sunrise')).toBe('cloudsea');
    expect(detectKind('黄山云海')).toBe('cloudsea');
    expect(detectKind('雲海')).toBe('cloudsea');
  });

  test('识别其他语种（Commons 是多语种的）', () => {
    expect(detectKind('Nebelmeer über Zürich')).toBe('cloudsea');
    expect(detectKind('Mer de nuages')).toBe('cloudsea');
  });

  test('识别晚霞类', () => {
    expect(detectKind('beautiful afterglow')).toBe('glow');
    expect(detectKind('火烧云')).toBe('glow');
  });

  test('无关内容返回 null', () => {
    expect(detectKind('a cat on a table')).toBeNull();
    expect(detectKind('')).toBeNull();
  });

  test('云海优先于晚霞（同时出现时云海是更强的判据）', () => {
    expect(detectKind('sea of clouds during sunset glow')).toBe('cloudsea');
  });
});

describe('commonsPageToObservation', () => {
  const page = (over = {}) => ({
    title: 'File:Sea of clouds from Mount Fuji.jpg',
    coordinates: [{ lat: 35.3606, lon: 138.7274 }],
    imageinfo: [{
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      extmetadata: {
        DateTimeOriginal: { value: '2019-10-12 05:40:11' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
      },
    }],
    ...over,
  });

  test('完整样本被采纳并保留拍摄小时', () => {
    const o = commonsPageToObservation(page());
    expect(o.rejected).toBe(false);
    expect(o.date).toBe('2019-10-12');
    expect(o.hour).toBe(5);
    expect(o.lat).toBeCloseTo(35.3606, 3);
    expect(o.observed).toBe(true);
    expect(o.source).toBe('wikimedia-commons');
  });

  test('无坐标必须拒绝 —— 没有地点的样本对回测毫无价值', () => {
    const o = commonsPageToObservation(page({ coordinates: undefined }));
    expect(o.rejected).toBe(true);
    expect(o.rejectReason).toBe('no-geo');
  });

  test('无拍摄日期必须拒绝', () => {
    const p = page();
    p.imageinfo[0].extmetadata.DateTimeOriginal = { value: 'unknown' };
    expect(commonsPageToObservation(p).rejectReason).toBe('no-capture-date');
  });

  test('非云海/晚霞内容被拒绝', () => {
    const o = commonsPageToObservation(page({ title: 'File:A red bus in London.jpg' }));
    expect(o.rejected).toBe(true);
    expect(o.rejectReason).toBe('no-kind-keyword');
  });

  test('geosearch 注入的坐标优先于 EXIF', () => {
    const p = page({ coordinates: undefined });
    p.__geoLat = 30.13;
    p.__geoLon = 118.17;
    p.imageinfo[0].extmetadata.GPSLatitude = { value: '1.0' };
    const o = commonsPageToObservation(p);
    expect(o.lat).toBeCloseTo(30.13, 2);
  });

  test('缺拍摄小时时置信度降级', () => {
    const p = page();
    p.imageinfo[0].extmetadata.DateTimeOriginal = { value: '2019-10-12' };
    expect(commonsPageToObservation(p).confidence).toBe('medium');
  });

  test('kind 过滤生效', () => {
    const o = commonsPageToObservation(page({ title: 'File:Beautiful afterglow.jpg' }), { kind: 'cloudsea' });
    expect(o.rejectReason).toBe('kind-mismatch');
  });
});

describe('matchPlatform', () => {
  test('识别各平台', () => {
    expect(matchPlatform('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(matchPlatform('https://youtu.be/abc')).toBe('youtube');
    expect(matchPlatform('https://www.tiktok.com/@u/video/1')).toBe('tiktok');
    expect(matchPlatform('https://x.com/u/status/1')).toBe('x');
    expect(matchPlatform('https://twitter.com/u/status/1')).toBe('x');
    expect(matchPlatform('https://www.xiaohongshu.com/explore/1')).toBe('xhs');
  });

  test('未知链接返回 null', () => {
    expect(matchPlatform('https://example.com')).toBeNull();
  });
});

describe('BLOCKED 登记', () => {
  test('实测不可匿名的平台都有据可查的原因说明', () => {
    for (const key of ['instagram', 'weibo', 'reddit']) {
      expect(typeof BLOCKED[key]).toBe('string');
      expect(BLOCKED[key].length).toBeGreaterThan(10);
    }
  });
});

describe('oembedToDraft', () => {
  test('oEmbed 只有文案，必须标记需要人工补日期', () => {
    const d = oembedToDraft('youtube', 'https://youtu.be/x', {
      title: '黄山云海日出 Sea of clouds',
      author_name: 'someone',
    });
    expect(d.kind).toBe('cloudsea');
    expect(d.needsManualDate).toBe(true);
    expect(d.author).toBe('someone');
  });
});
