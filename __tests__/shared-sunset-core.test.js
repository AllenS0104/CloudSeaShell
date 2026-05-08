const sunset = require('../shared/core/sunset');

function makeHourly() {
  const time = Array.from({ length: 24 }, (_, i) => `2026-06-01T${String(i).padStart(2, '0')}:00:00+08:00`);
  const fill = (v) => Array.from({ length: 24 }, () => v);
  return { time, cloud_cover_mid: fill(50), cloud_cover_high: fill(40), cloud_cover_low: fill(10), relative_humidity_2m: fill(55), visibility: fill(20000), precipitation_probability: fill(0), precipitation: fill(0) };
}

describe('晚霞核心分析', () => {
  test('单点分析区分最佳晚霞、日出和低云降水风险', () => {
    const evening = sunset.analyzeGlowSample({ cloudCoverMid: 50, cloudCoverHigh: 40, cloudCoverLow: 10, humidity: 55, visibility: 20000, precipitationProbability: 0, precipitationAmount: 0, timeString: '2026-06-01T18:10:00+08:00', sunriseTime: '2026-06-01T05:30:00+08:00', sunsetTime: '2026-06-01T18:20:00+08:00' });
    const morning = sunset.analyzeGlowSample({ cloudCoverMid: 25, cloudCoverHigh: 15, cloudCoverLow: 20, humidity: 35, visibility: 8000, precipitationProbability: 0, precipitationAmount: 0, timeString: '2026-06-01T05:35:00+08:00', sunriseTime: '2026-06-01T05:30:00+08:00', sunsetTime: '2026-06-01T18:20:00+08:00' });
    const bad = sunset.analyzeGlowSample({ cloudCoverMid: 5, cloudCoverHigh: 90, cloudCoverLow: 90, humidity: 95, visibility: 1000, precipitationProbability: 80, precipitationAmount: 2, timeString: '2026-06-01T12:00:00+08:00', sunriseTime: 'bad', sunsetTime: 'bad' });
    expect(evening.level).toMatch(/high|medium/);
    expect(evening.isEvening).toBe(true);
    expect(morning.isEvening).toBe(false);
    expect(bad.score).toBeLessThan(morning.score);
    expect(bad.reasons.join('')).toContain('低层云量');
  });

  test('全天分析挑选日出与日落最佳小时', () => {
    const result = sunset.analyzeDayGlow(makeHourly(), 0, '2026-06-01T05:00:00+08:00', '2026-06-01T18:00:00+08:00');
    expect(result.hourlyAnalyses).toHaveLength(24);
    expect(result.bestHour.score).toBeGreaterThan(0);
    expect(result.bestSunrise).toBeTruthy();
    expect(result.bestSunset).toBeTruthy();
    expect(result.resultText).toContain('分');
  });

  test('缺少有效时段时返回低概率兜底', () => {
    const hourly = { time: [], cloud_cover_mid: [], cloud_cover_high: [], cloud_cover_low: [], relative_humidity_2m: [], visibility: [], precipitation_probability: [], precipitation: [] };
    expect(sunset.analyzeDayGlow(hourly, 0).score).toBe(0);
  });
});
