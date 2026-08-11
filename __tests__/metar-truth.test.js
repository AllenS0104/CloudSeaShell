/**
 * metar-truth.js 纯函数单测。
 *
 * 这些函数决定「这一天到底算不算云海」，判错会直接污染整个数据集，
 * 所以先测再用。
 */

const {
  haversineKm, lowestSolidLayer, maxOktas, classify, parseCsv, nearestStation,
} = require('../scripts/metar-truth');

describe('haversineKm', () => {
  test('同一点距离为 0', () => {
    expect(haversineKm(30, 118, 30, 118)).toBeCloseTo(0, 6);
  });

  test('已知距离：北京→上海约 1067km', () => {
    expect(haversineKm(39.9, 116.4, 31.2, 121.5)).toBeGreaterThan(1000);
    expect(haversineKm(39.9, 116.4, 31.2, 121.5)).toBeLessThan(1130);
  });

  test('一个纬度约 111km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  test('对称', () => {
    expect(haversineKm(10, 20, 30, 40)).toBeCloseTo(haversineKm(30, 40, 10, 20), 9);
  });
});

describe('lowestSolidLayer', () => {
  test('只认 BKN/OVC，忽略 FEW/SCT', () => {
    // 零散云成不了海，取 3000ft 的 BKN 而非 1000ft 的 FEW
    const row = {
      skyc1: 'FEW', skyl1: '1000', skyc2: 'BKN', skyl2: '3000',
    };
    expect(lowestSolidLayer(row)).toEqual({ cover: 'BKN', baseFt: 3000, oktas: 6 });
  });

  test('多层连续云取最低的一层', () => {
    const row = {
      skyc1: 'OVC', skyl1: '5000', skyc2: 'BKN', skyl2: '2000',
    };
    expect(lowestSolidLayer(row).baseFt).toBe(2000);
  });

  test('全是零散云则返回 null', () => {
    expect(lowestSolidLayer({ skyc1: 'FEW', skyl1: '2500' })).toBeNull();
    expect(lowestSolidLayer({ skyc1: 'SCT', skyl1: '1200' })).toBeNull();
  });

  test('晴空返回 null', () => {
    expect(lowestSolidLayer({ skyc1: 'CLR', skyl1: '' })).toBeNull();
    expect(lowestSolidLayer({ skyc1: 'SKC', skyl1: '' })).toBeNull();
  });

  test('垂直能见度 VV 计为满覆盖', () => {
    expect(lowestSolidLayer({ skyc1: 'VV', skyl1: '200' })).toEqual(
      { cover: 'VV', baseFt: 200, oktas: 8 },
    );
  });

  test('缺高度的层被跳过', () => {
    expect(lowestSolidLayer({ skyc1: 'OVC', skyl1: '' })).toBeNull();
  });

  test('空行不炸', () => {
    expect(lowestSolidLayer({})).toBeNull();
  });

  test('小写代码也能识别', () => {
    expect(lowestSolidLayer({ skyc1: 'ovc', skyl1: '900' }).oktas).toBe(8);
  });
});

describe('maxOktas', () => {
  test('取各层最大覆盖度', () => {
    expect(maxOktas({ skyc1: 'FEW', skyl1: '1000', skyc2: 'OVC', skyl2: '4000' })).toBe(8);
  });

  test('晴空为 0', () => {
    expect(maxOktas({ skyc1: 'CLR' })).toBe(0);
  });

  test('无数据为 0', () => {
    expect(maxOktas({})).toBe(0);
  });
});

describe('classify', () => {
  const SPOT = 1860; // 光明顶

  test('云底远低于机位 = 云海', () => {
    expect(classify(1000, SPOT).verdict).toBe('above-cloud');
  });

  test('云底远高于机位 = 阴天，不是云海', () => {
    expect(classify(3000, SPOT).verdict).toBe('below-cloud');
  });

  test('云底与机位齐平 = 白墙', () => {
    expect(classify(1860, SPOT).verdict).toBe('in-cloud');
    expect(classify(1800, SPOT).verdict).toBe('in-cloud');
    expect(classify(1950, SPOT).verdict).toBe('in-cloud');
  });

  test('无连续云层 = 晴', () => {
    expect(classify(null, SPOT).verdict).toBe('clear');
  });

  test('150m 容差边界', () => {
    // 刚好在容差内仍算白墙，超出才判云海
    expect(classify(SPOT - 150, SPOT).verdict).toBe('in-cloud');
    expect(classify(SPOT - 151, SPOT).verdict).toBe('above-cloud');
    expect(classify(SPOT + 150, SPOT).verdict).toBe('in-cloud');
    expect(classify(SPOT + 151, SPOT).verdict).toBe('below-cloud');
  });

  test('低海拔机位同样适用', () => {
    expect(classify(200, 800).verdict).toBe('above-cloud');
    expect(classify(1500, 800).verdict).toBe('below-cloud');
  });
});

describe('parseCsv', () => {
  test('解析 Mesonet 逗号格式', () => {
    const csv = 'station,valid,tmpf,skyc1,skyl1\n'
      + 'GCTS,2018-05-15 00:00,64.40,FEW,2500.00\n'
      + 'GCTS,2018-05-15 01:00,62.60,BKN,1200.00';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].station).toBe('GCTS');
    expect(rows[1].skyc1).toBe('BKN');
    expect(rows[1].skyl1).toBe('1200.00');
  });

  test('跳过注释行', () => {
    const csv = '# comment\nstation,valid\nAAA,2020-01-01 00:00';
    expect(parseCsv(csv)).toHaveLength(1);
  });

  test('只有表头返回空', () => {
    expect(parseCsv('station,valid')).toEqual([]);
  });

  test('空输入返回空', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   ')).toEqual([]);
  });

  test('缺失字段留空串而不是 undefined', () => {
    const rows = parseCsv('station,valid,tmpf\nAAA,2020-01-01 00:00');
    expect(rows[0].tmpf).toBe('');
  });
});

describe('nearestStation', () => {
  const stations = [
    { id: 'NEAR', lat: 30.1, lon: 118.1, elev: 100 },
    { id: 'FAR', lat: 40.0, lon: 118.0, elev: 200 },
    { id: 'MID', lat: 30.5, lon: 118.5, elev: 300 },
  ];

  test('返回最近的站', () => {
    const r = nearestStation(stations, 30.13, 118.17);
    expect(r.station.id).toBe('NEAR');
    expect(r.distKm).toBeLessThan(15);
  });

  test('粗筛把远站排除后仍能找到次近站', () => {
    const r = nearestStation(stations, 30.5, 118.5);
    expect(r.station.id).toBe('MID');
  });

  test('周围完全没有站则返回 null', () => {
    expect(nearestStation(stations, -40, 0)).toBeNull();
  });

  test('空站库返回 null', () => {
    expect(nearestStation([], 30, 118)).toBeNull();
  });
});
