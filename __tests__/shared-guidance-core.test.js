const guidance = require('../shared/core/guidance');
const { CLOUD_SEA_GO, CLOUD_SEA_STRONG, CLOUD_SEA_WATCH } = require('../shared/core/thresholds');

describe('观测建议核心', () => {
  test('时间格式和日出窗口处理缺失或非法输入', () => {
    expect(guidance.formatTimeLabel()).toBe('--:--');
    expect(guidance.formatTimeLabel('bad')).toBe('--:--');
    expect(guidance.shiftMinutes('bad', 30)).toBeNull();
    expect(guidance.windowAroundSunrise()).toBe('日出前后 1-2 小时');
    expect(guidance.windowAroundSunrise('2026-05-01T06:00:00.000Z')).toMatch(/:/);
  });

  test('不同海拔差给出不同机位建议和目标海拔', () => {
    expect(guidance.recommendedViewpoint(300)).toContain('山顶');
    expect(guidance.recommendedViewpoint(100)).toContain('山脊');
    expect(guidance.recommendedViewpoint(0)).toContain('更高');
    expect(guidance.recommendedViewpoint(-200)).toContain('偏低');
    expect(guidance.recommendedTargetElevation(1200, 1500)).toBe(1500);
    expect(guidance.recommendedTargetElevation(1200, 900)).toBe(1350);
  });

  test('综合建议按评分、降水和风速生成行动项', () => {
    const high = guidance.buildObservationGuidance({ analysis: { score: CLOUD_SEA_STRONG + 3, cloudBase: 1000, gapToElevation: 300, precipitationProbability: 0, precipitationAmount: 0, windSpeed: 2 }, currentElevation: 1500, sunriseTime: '2026-05-01T06:00:00.000Z', sunsetTime: '2026-05-01T10:00:00.000Z', bestTimeLabel: '05:40' });
    expect(high.goLevel).toBe('值得冲');
    expect(high.actionItems.join('')).toContain('风速尚可');
    expect(high.recommendedWindow).toBe('05:40 前后');
    const risky = guidance.buildObservationGuidance({ analysis: { score: CLOUD_SEA_WATCH - 5, cloudBase: 1800, gapToElevation: -100, precipitationProbability: 80, precipitationAmount: 1, windSpeed: 12 }, currentElevation: 1000, sunriseTime: '2026-05-01T06:00:00.000Z' });
    expect(risky.goClass).toBe('stop');
    expect(risky.actionItems.join('')).toContain('防水');
    expect(risky.actionItems.join('')).toContain('风偏大');
  });

  test('go/watch/stop 分档严格跟随共享阈值常量', () => {
    const at = (score) => guidance.buildObservationGuidance({
      analysis: { score, cloudBase: 1000, gapToElevation: 300, precipitationProbability: 0, precipitationAmount: 0, windSpeed: 2 },
      currentElevation: 1500,
      sunriseTime: '2026-05-01T06:00:00.000Z',
    });
    expect(at(CLOUD_SEA_GO).goClass).toBe('go');
    expect(at(CLOUD_SEA_GO - 1).goClass).toBe('watch');
    expect(at(CLOUD_SEA_WATCH).goClass).toBe('watch');
    expect(at(CLOUD_SEA_WATCH - 1).goClass).toBe('stop');
    expect(at(CLOUD_SEA_STRONG).goLevel).toBe('值得冲');
    expect(at(CLOUD_SEA_STRONG - 1).goLevel).toBe('可以蹲守');
  });
});
