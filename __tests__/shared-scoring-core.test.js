const scoring = require('../shared/core/scoring');

describe('评分核心边界', () => {
  test('各项气象评分覆盖高低和插值区间', () => {
    expect(scoring.scoreHumidity(98)).toBe(25);
    expect(scoring.scoreHumidity(86)).toBeGreaterThan(0);
    expect(scoring.scoreHumidity(60)).toBe(0);
    expect(scoring.scoreElevationGap(300)).toBe(25);
    expect(scoring.scoreElevationGap(100)).toBeGreaterThan(0);
    expect(scoring.scoreElevationGap(-150)).toBe(0);
    expect(scoring.scoreVisibility(13000)).toBe(15);
    expect(scoring.scoreVisibility(7000)).toBeGreaterThan(2);
    expect(scoring.scoreVisibility(1000)).toBe(0);
    expect(scoring.scoreWind(2)).toBe(10);
    expect(scoring.scoreWind(8)).toBeGreaterThan(0);
    expect(scoring.scoreWind(15)).toBe(0);
    expect(scoring.scoreCloudCover(60)).toBe(8);
    expect(scoring.scoreCloudCover(30)).toBeGreaterThan(2);
    expect(scoring.scoreCloudCover(98)).toBeGreaterThanOrEqual(4);
    expect(scoring.scoreLowCloudCover(60)).toBe(12);
    expect(scoring.scoreLowCloudCover(35)).toBeGreaterThan(4);
    expect(scoring.scoreLowCloudCover(98)).toBeLessThan(12);
    expect(scoring.scoreDewPointSpread(10, 9)).toBe(12);
    expect(scoring.scoreDewPointSpread(10, 5)).toBeGreaterThan(0);
    expect(scoring.scoreDewPointSpread(10, 1)).toBe(0);
    expect(scoring.scorePressure(1020)).toBe(5);
    expect(scoring.scorePressure(1010)).toBeGreaterThan(0);
    expect(scoring.scorePressure(990)).toBe(0);
  });

  test('惩罚与时间窗口反映真实风险', () => {
    expect(scoring.precipitationPenalty(90, 0)).toBe(10);
    expect(scoring.precipitationPenalty(20, 3)).toBe(10);
    expect(scoring.precipitationPenalty(20, 0)).toBe(0);
    expect(scoring.scoreTimeWindow('2026-05-01T05:20:00+08:00', '2026-05-01T05:40:00+08:00')).toBe(10);
    expect(scoring.scoreTimeWindow('2026-05-01T08:40:00+08:00', '2026-05-01T05:40:00+08:00')).toBeGreaterThan(2);
    expect(scoring.scoreTimeWindow('bad-time', '2026-05-01T05:40:00+08:00')).toBe(0);
    expect(scoring.scoreTimeWindow('', null)).toBe(0);
  });

  test('逆温、置信度和复合误报惩罚覆盖分级', () => {
    expect(scoring.scoreInversion([10, 12, 14])).toMatchObject({ detected: true, score: 5 });
    expect(scoring.scoreInversion([10, 11.5, 11])).toMatchObject({ detected: true });
    expect(scoring.scoreInversion([10, 9])).toMatchObject({ detected: false, score: 0 });
    expect(scoring.scoreToConfidence(80)).toEqual({ label: '高把握', level: 'high' });
    expect(scoring.scoreToConfidence(60).level).toBe('medium');
    expect(scoring.scoreToConfidence(40).level).toBe('low');
    expect(scoring.scoreToConfidence(20).level).toBe('very-low');
    expect(scoring.compositeReliabilityPenalty({ humidity: 90, windSpeed: 12, cloudCover: 80, lowCloudCover: 10, inversionDetected: false, dewPointGap: 1, precipitationProbability: 70 })).toBe(18);
    expect(scoring.compositeReliabilityPenalty({ humidity: 50, windSpeed: 2, cloudCover: 20, lowCloudCover: 10, inversionDetected: true, dewPointGap: 5, precipitationProbability: 0 })).toBe(0);
  });
});
