const scoring = require('../shared/core/scoring');
const calc = require('../shared/core/calculations');

/**
 * 中层云惩罚 —— 区分「站在云上看云海」和「埋在云里的白墙」。
 *
 * 依据（scripts/midcloud-calib.py 实测，682 条样本）：
 *   高湿子集里中层云单特征 AUC 0.319（远离 0.5，方向为负）
 *   分档成功率：0-10% → 40.3%，25-50% → 22.0%，75-90% → 7.7%，单调下降
 *   控制总云量后仍有独立信号（总云量 50-85% 时落差 32.8pp），
 *   即它不是总云量的影子（两者相关系数仅 0.511）
 */
describe('中层云惩罚（云海 vs 白墙）', () => {
  test('切点以下不惩罚，切点以上单调加重直到封顶', () => {
    expect(scoring.midCloudPenalty(0)).toBe(0);
    expect(scoring.midCloudPenalty(30)).toBe(0);

    const at45 = scoring.midCloudPenalty(45);
    const at60 = scoring.midCloudPenalty(60);
    expect(at45).toBeGreaterThan(0);
    expect(at60).toBeGreaterThan(at45);

    expect(scoring.midCloudPenalty(75)).toBe(12);
    expect(scoring.midCloudPenalty(100)).toBe(12);
  });

  test('缺失值和非有限值不得意外产生惩罚', () => {
    // 关键回归点：Number('') === 0 这类隐式转换曾在 METAR 脚本里
    // 造成过严重误判，这里确保缺失中层云数据时是"不罚"而不是"乱罚"。
    expect(scoring.midCloudPenalty(null)).toBe(0);
    expect(scoring.midCloudPenalty(undefined)).toBe(0);
    expect(scoring.midCloudPenalty(NaN)).toBe(0);
    expect(scoring.midCloudPenalty('')).toBe(0);
    expect(scoring.midCloudPenalty(-20)).toBe(0);
  });

  test('同样的低层条件下，中层云越厚总分越低', () => {
    const base = {
      temperature: 5,
      humidity: 98,
      visibility: 20000,
      cloudCover: 90,
      lowCloudCover: 85,
      windSpeed: 2,
      dewPoint: 4.8,
      pressureMsl: 1020,
      elevation: 1860,
      timeString: '2026-01-10T07:00',
      sunriseTime: '2026-01-10T07:00',
    };
    const clear = calc.analyzeCloudSeaSample({ ...base, midCloudCover: 0 });
    const thick = calc.analyzeCloudSeaSample({ ...base, midCloudCover: 90 });

    expect(clear.midPenalty).toBe(0);
    expect(thick.midPenalty).toBe(12);
    expect(thick.score).toBeLessThan(clear.score);
    expect(clear.score - thick.score).toBe(12);
  });

  test('中层云进入缓存指纹，不同中层云不得共用缓存结果', () => {
    // 这是真实踩过的坑：新增输入若不进指纹，analyzeDayCloudSea 会让
    // 所有调用共享同一条缓存，惩罚在日级路径上完全失效（分数纹丝不动）。
    const n = 24;
    const A = (v) => Array(n).fill(v);
    const mk = (mid) => calc.analyzeDayCloudSea({
      time: Array.from({ length: n }, (_, i) => `2026-01-10T${String(i).padStart(2, '0')}:00`),
      temperature_2m: A(5),
      relative_humidity_2m: A(98),
      dew_point_2m: A(4.8),
      pressure_msl: A(1020),
      cloud_cover: A(90),
      cloud_cover_low: A(85),
      cloud_cover_mid: A(mid),
      visibility: A(20000),
      wind_speed_10m: A(2),
      precipitation: A(0),
      precipitation_probability: A(0),
      cape: A(0),
    }, 0, 1860, '2026-01-10T07:00');

    expect(mk(0).bestHour.score).toBeGreaterThan(mk(90).bestHour.score);
    expect(mk(90).bestHour.midPenalty).toBe(12);
  });

  test('中层云偏高时给出可读的白墙提示', () => {
    const r = calc.analyzeCloudSeaSample({
      temperature: 5,
      humidity: 98,
      visibility: 20000,
      cloudCover: 90,
      lowCloudCover: 85,
      midCloudCover: 85,
      windSpeed: 2,
      dewPoint: 4.8,
      pressureMsl: 1020,
      elevation: 1860,
      timeString: '2026-01-10T07:00',
      sunriseTime: '2026-01-10T07:00',
    });
    expect(r.reasons.some((x) => x.includes('白墙'))).toBe(true);
  });
});
