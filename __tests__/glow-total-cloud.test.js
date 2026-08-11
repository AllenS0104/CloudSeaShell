const { scoreTotalCloud, analyzeGlowSample } = require('../shared/core/sunset.js');

describe('scoreTotalCloud', () => {
  test('缺失值必须中性，绝不能当作晴空', () => {
    // 这是本项目栽过跟头的地方：把缺失塞成 0 会被下游当成"晴空无云"这一端的
    // 极值。0 分是"不加不减"，与 scoreTotalCloud(0) 恰好同值属于巧合，
    // 关键是它不能因为数据缺失而去动分数。
    expect(scoreTotalCloud(null)).toBe(0);
    expect(scoreTotalCloud(undefined)).toBe(0);
    expect(scoreTotalCloud(NaN)).toBe(0);
    expect(scoreTotalCloud('')).toBe(0);
  });

  test('晴空没有幕布可烧，不给分', () => {
    expect(scoreTotalCloud(0)).toBe(0);
    expect(scoreTotalCloud(19)).toBe(0);
  });

  test('实测甜区 50-85% 拿满分', () => {
    expect(scoreTotalCloud(50)).toBe(10);
    expect(scoreTotalCloud(63)).toBe(10);   // 大烧组实测均值 62.8%
    expect(scoreTotalCloud(85)).toBe(10);
  });

  test('密闭阴天把太阳封死，回落', () => {
    expect(scoreTotalCloud(100)).toBe(2);
    expect(scoreTotalCloud(96)).toBe(2);
    expect(scoreTotalCloud(92)).toBeLessThan(10);
    expect(scoreTotalCloud(92)).toBeGreaterThan(2);
  });

  test('曲线是倒 U 型：甜区高于两端', () => {
    expect(scoreTotalCloud(63)).toBeGreaterThan(scoreTotalCloud(10));
    expect(scoreTotalCloud(63)).toBeGreaterThan(scoreTotalCloud(100));
  });

  test('接入评分后，总云量确实能改变最终分数', () => {
    const base = {
      cloudCoverMid: 20,
      cloudCoverHigh: 50,
      cloudCoverLow: 10,
      humidity: 70,
      visibility: 20000,
      precipitationProbability: 0,
      precipitationAmount: 0,
      timeString: '2024-05-01T18:00',
      sunsetTime: '2024-05-01T18:15',
      sunriseTime: '2024-05-01T05:30',
    };
    const bare = analyzeGlowSample({ ...base, cloudCoverTotal: 5 });
    const sweet = analyzeGlowSample({ ...base, cloudCoverTotal: 65 });
    const sealed = analyzeGlowSample({ ...base, cloudCoverTotal: 100 });
    expect(sweet.score).toBeGreaterThan(bare.score);
    expect(sweet.score).toBeGreaterThan(sealed.score);
    // 缺失时不应相对"晴空"平白改变分数
    const missing = analyzeGlowSample({ ...base, cloudCoverTotal: null });
    expect(missing.totalScore).toBe(0);
  });
});
