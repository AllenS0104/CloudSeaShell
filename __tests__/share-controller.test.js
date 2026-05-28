const { buildShareText, buildShareTitle } = require('../miniprogram/pages/index/controllers/share-controller');

describe('小程序分享文本工具', () => {
  test('buildShareTitle 覆盖云海/晚霞/星空三个评分', () => {
    expect(buildShareTitle({
      locationName: '黄山',
      analysis: { score: 78 },
      glowAnalysis: { score: 64 },
      starInfo: { score: 35 },
    })).toBe('黄山 云海/晚霞/星空预报（云海 78 / 晚霞 64 / 星空 35）');
  });

  test('buildShareTitle 在缺少所有分数时退化为基础标题', () => {
    expect(buildShareTitle({ locationName: '北京' })).toBe('北京 云海/晚霞/星空预报');
    expect(buildShareTitle(null)).toBe('云海观测决策台');
  });

  test('buildShareText 输出位置、日期与三项预测', () => {
    const text = buildShareText({
      locationName: '坐标 39.9, 116.4 (海淀区 北京市)',
      elevation: 320,
      dayLabels: ['5月28日周三 (今天)'],
      selectedDayIndex: 0,
      analysis: { score: 76, resultText: '高把握', summary: '低云充足', reasons: ['湿度 92%', '逆温层强'] },
      glowAnalysis: { score: 58, resultText: '晚霞潜力较好' },
      starInfo: { score: 22 },
      currentHumidity: 88,
      currentWind: '3.2',
      selectedWaypoint: { name: '观景台', distanceKm: 1.5 },
    });

    expect(text).toMatch(/坐标 39\.9, 116\.4 \(海淀区 北京市\)/);
    expect(text).toMatch(/海拔 320m/);
    expect(text).toMatch(/5月28日周三/);
    expect(text).toMatch(/☁️ 云海：76 分（高把握）/);
    expect(text).toMatch(/🌅 晚霞：58 分/);
    expect(text).toMatch(/🌌 星空：22 分/);
    expect(text).toMatch(/💡 主要依据：/);
    expect(text).toMatch(/逆温层强/);
    expect(text).toMatch(/湿度 88%/);
    expect(text).toMatch(/观景台/);
    expect(text).toMatch(/CloudSeaShell/);
  });

  test('buildShareText 对空状态返回空字符串', () => {
    expect(buildShareText(null)).toBe('');
  });

  test('buildShareText 在缺失部分预测时只包含可用项', () => {
    const text = buildShareText({
      locationName: '测试点',
      analysis: { score: 40 },
    });
    expect(text).toMatch(/☁️ 云海：40 分/);
    expect(text).not.toMatch(/🌅 晚霞/);
    expect(text).not.toMatch(/🌌 星空/);
  });
});
