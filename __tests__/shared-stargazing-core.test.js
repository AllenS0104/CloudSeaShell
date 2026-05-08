const stars = require('../shared/core/stargazing');

describe('星空核心分析', () => {
  test('月相年龄、照明和名称覆盖主要边界', () => {
    expect(stars.getMoonAge('2000-01-06T18:14:00Z')).toBeCloseTo(0, 1);
    expect(stars.getMoonIllumination(0)).toBe(0);
    expect(stars.getMoonIllumination(14.76)).toBeGreaterThan(95);
    expect(stars.getMoonPhaseName(0).name).toBe('新月');
    expect(stars.getMoonPhaseName(8).name).toBe('上弦月');
    expect(stars.getMoonPhaseName(15).name).toBe('满月');
    expect(stars.getMoonPhaseName(22).name).toBe('下弦月');
    expect(stars.getMoonPhaseName(28).name).toBe('新月');
  });

  test('银河可见性区分南北半球和月份', () => {
    expect(stars.getMilkyWayVisibility('2026-07-01', 30)).toMatchObject({ coreVisible: true, seasonScore: 10 });
    expect(stars.getMilkyWayVisibility('2026-04-01', 30).bestHours).toContain('03:00');
    expect(stars.getMilkyWayVisibility('2026-10-01', 30)).toMatchObject({ coreVisible: true, seasonScore: 5 });
    expect(stars.getMilkyWayVisibility('2026-01-01', 30).coreVisible).toBe(false);
    expect(stars.getMilkyWayVisibility('2026-03-01', -25)).toMatchObject({ coreVisible: true, seasonScore: 8 });
  });

  test('观星评分反映云量、能见度、湿度、海拔和月光影响', () => {
    const good = stars.scoreStargazing({ date: '2026-07-15', latitude: 30, cloudCover: 5, visibility: 25000, humidity: 35, elevation: 3500 });
    const poor = stars.scoreStargazing({ date: '2026-01-15', latitude: 30, cloudCover: 90, visibility: 1000, humidity: 90, elevation: 0 });
    expect(good.score).toBeGreaterThan(poor.score);
    expect(good.reasons.join('')).toContain('海拔');
    expect(poor.reasons.join('')).toContain('云层较厚');
    expect(good.resultText).toContain('分');
  });

  test('星空摄影参数按分数调整 ISO 与堆栈建议', () => {
    expect(stars.astroShutter(25, 1).recommended).toBe('12-20s');
    expect(stars.astroShutter(undefined, undefined).recommended).toBe('13-21s');
    expect(stars.getAstroParams(70, 14, 1).iso).toBe('1600-3200');
    expect(stars.getAstroParams(20, 14, 1).stacking).toContain('20-30');
  });
});
