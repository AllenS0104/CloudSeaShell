const sunset = require('../shared/core/sunset');

/**
 * 晚霞云层判据 —— 由 255 条 Commons 观测样本的审计结果反推。
 * 见 scripts/glow-audit.js 与 docs/数据采集与模型审计.md。
 *
 * 这组测试锁住的是"哪一层云是光幕"这个结论本身，
 * 因为最初的实现把中层云当成主光幕，方向是反的。
 */
describe('晚霞云层判据（经 255 条样本校正）', () => {
  test('高层云是主光幕：峰值落在 30-90%，overcast 反而更差', () => {
    // 实测出现率：30-60% 47.1%，60-90% 60.0%，>=90% 24.1%
    const peak = sunset.scoreHighCloud(60);
    expect(sunset.scoreHighCloud(30)).toBe(peak);
    expect(sunset.scoreHighCloud(90)).toBe(peak);

    // 旧曲线在 60-90% 已经开始衰减，恰好惩罚了最好的一档
    expect(sunset.scoreHighCloud(75)).toBe(peak);

    // 高空封死比少量高云还差
    expect(sunset.scoreHighCloud(100)).toBeLessThan(sunset.scoreHighCloud(20));
  });

  test('中层云是轻度负面，不再是最大正分项', () => {
    expect(sunset.scoreMidCloud(10)).toBeGreaterThan(sunset.scoreMidCloud(50));
    expect(sunset.scoreMidCloud(50)).toBeGreaterThan(sunset.scoreMidCloud(95));
    expect(sunset.scoreMidCloud(95)).toBeLessThan(0);

    // 关键回归点：中层云任何取值都不得超过高层云的峰值权重，
    // 否则就退回到"中层云当主光幕"的错误结论。
    const midMax = Math.max(...[0, 10, 30, 50, 70, 90, 100].map(sunset.scoreMidCloud));
    expect(midMax).toBeLessThan(sunset.scoreHighCloud(60));
  });

  test('缺失与异常输入不产生意外分数', () => {
    expect(sunset.scoreHighCloud(null)).toBe(0);
    expect(sunset.scoreHighCloud(undefined)).toBe(0);
    expect(sunset.scoreHighCloud(NaN)).toBe(0);
    expect(sunset.scoreMidCloud(null)).toBe(0);
    expect(sunset.scoreMidCloud(NaN)).toBe(0);
    expect(sunset.scoreMidCloud(-5)).toBe(0);
  });

  test('整体评分：高层云通透 + 中低层干净 应显著优于阴天', () => {
    const base = {
      humidity: 60,
      visibility: 20000,
      precipitationProbability: 0,
      precipitationAmount: 0,
      timeString: '2026-01-10T17:30',
      sunsetTime: '2026-01-10T17:40',
      sunriseTime: '2026-01-10T07:00',
    };
    const good = sunset.analyzeGlowSample({
      ...base, cloudCoverHigh: 60, cloudCoverMid: 10, cloudCoverLow: 5,
    });
    const overcast = sunset.analyzeGlowSample({
      ...base, cloudCoverHigh: 100, cloudCoverMid: 90, cloudCoverLow: 90,
    });
    expect(good.score).toBeGreaterThan(overcast.score);
    expect(good.reasons.some((r) => r.includes('光幕'))).toBe(true);
  });
});
