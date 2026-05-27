const { buildPosterModel, posterPalette } = require('../shared/core/poster-layout');

describe('poster layout model', () => {
  test('maps page state to share poster fields', () => {
    const model = buildPosterModel({
      locationName: '黄山',
      dayLabels: ['5月8日周五 (今天)'],
      selectedDayIndex: 0,
      analysis: {
        score: 76,
        resultText: '云海有戏',
        summary: '低云与湿度条件较好',
        humidity: 88,
        cloudBase: 1220,
        visibility: 18000,
        windSpeed: 3.2,
        reasons: ['湿度高', { text: '风速适中' }],
      },
      guidance: { viewpointAdvice: '选择高于云底 200m 的山脊机位' },
    });

    expect(model.width).toBe(750);
    expect(model.height).toBe(1700);
    expect(model.location).toBe('黄山');
    expect(model.predictionType).toBe('云海');
    expect(model.score).toBe(76);
    expect(model.kpis).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '湿度', value: '88%' }),
      expect.objectContaining({ label: '云底', value: '1220m' }),
      expect.objectContaining({ label: '能见度', value: '18km' }),
      expect.objectContaining({ label: '风速', value: '3.2m/s' }),
    ]));
    expect(model.reasons).toEqual(['湿度高', '风速适中']);
    expect(model.hints[0]).toContain('山脊机位');
    expect(model.layout.some(section => section.type === 'qrcode')).toBe(true);
    expect(model.layout.some(section => section.type === 'footer')).toBe(true);
  });

  test('palette switches between themes with dark default', () => {
    expect(posterPalette('dark').backgroundTop).toBe('#0b2f5b');
    expect(posterPalette('light').theme).toBe('light');
    expect(posterPalette('missing').theme).toBe('dark');
  });

  test('omits reasons segment when data is empty', () => {
    const model = buildPosterModel({
      locationName: '北京',
      analysis: { score: 20, reasons: [] },
    });

    expect(model.reasons).toEqual([]);
    expect(model.layout.some(section => section.type === 'reasons')).toBe(false);
  });
});
