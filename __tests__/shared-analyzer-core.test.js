const analyzer = require('../shared/core/analyzer');

function makeHourly() {
  const time = Array.from({ length: 48 }, (_, i) => `2026-06-0${i < 24 ? 1 : 2}T${String(i % 24).padStart(2, '0')}:00:00+08:00`);
  const fill = (v) => Array.from({ length: 48 }, () => v);
  return { time, temperature_2m: fill(10), relative_humidity_2m: fill(92), dew_point_2m: fill(8), pressure_msl: fill(1018), cloud_cover: fill(65), cloud_cover_low: fill(70), cloud_cover_mid: fill(50), cloud_cover_high: fill(35), visibility: fill(18000), precipitation: fill(0), precipitation_probability: fill(0), wind_speed_10m: fill(3), weather_code: fill(0), cape: fill(0), is_day: fill(1) };
}

describe('分析编排核心', () => {
  test('日期标签按去重日期生成今天标记', () => {
    expect(analyzer.buildDayLabels(['2026-06-01T00:00', '2026-06-01T01:00', '2026-06-02T00:00'])).toEqual(['6月1日周一 (今天)', '6月2日周二']);
  });

  test('天气分析整合日分析、当前值、指南和小时列表', () => {
    const current = { temperature_2m: 9.2, relative_humidity_2m: 95, dew_point_2m: 8, pressure_msl: 1018, cloud_cover: 70, cloud_cover_low: 80, visibility: 16000, wind_speed_10m: 2, apparent_temperature: 4, precipitation: 0, precipitation_probability: 0, time: '2026-06-01T06:00:00+08:00' };
    const result = analyzer.analyzeWeather({ hourly: makeHourly(), daily: { sunrise: ['2026-06-01T06:00:00+08:00', '2026-06-02T06:00:00+08:00'], sunset: ['2026-06-01T18:30:00+08:00', '2026-06-02T18:30:00+08:00'] }, current }, 1800, 0);
    expect(result.start).toBe(0);
    expect(result.currentTemp).toBe('9.2');
    expect(result.currentDewGap).toBe(1.2);
    expect(result.hourlyList).toHaveLength(24);
    expect(result.guidance.actionItems.length).toBeGreaterThan(0);
  });

  test('非当天分析使用日分析首小时兜底当前值', () => {
    const result = analyzer.analyzeWeather({ hourly: makeHourly(), daily: { sunrise: ['2026-06-01T06:00:00+08:00', '2026-06-02T06:00:00+08:00'], sunset: ['2026-06-01T18:30:00+08:00', '2026-06-02T18:30:00+08:00'] } }, 1800, 1);
    expect(result.start).toBe(24);
    expect(result.currentTemp).toBe('10.0');
    expect(result.sunrise).toContain('2026-06-02');
  });

  test('晚霞、星空和摄影编排只暴露页面需要字段', () => {
    const hourly = makeHourly();
    const glow = analyzer.analyzeGlow(hourly, 0, '2026-06-01T06:00:00+08:00', '2026-06-01T18:30:00+08:00');
    expect(glow).toEqual(expect.objectContaining({ score: expect.any(Number), bestSunrise: expect.any(Object), bestSunset: expect.any(Object) }));
    const stars = analyzer.analyzeStars('2026-07-01T22:00:00+08:00', 30, 5, 25000, 35, 2500);
    expect(stars.astro.iso).toBeDefined();
    const photo = analyzer.buildPhotoParams('2026-06-01T06:10:00+08:00', '2026-06-01T06:00:00+08:00', '2026-06-01T18:30:00+08:00', { cloudCover: 60, visibility: 20000, windSpeed: 2, score: 80 }, 2200);
    expect(photo.camera.aperture).toBe('f/11');
  });

  test('安全提醒覆盖雷暴、对流、低温和高海拔', () => {
    const danger = analyzer.buildSafetyAlerts({ cape: [0, 1200] }, 0, { apparent_temperature: 2 }, 2000);
    expect(danger.map(a => a.type)).toEqual(['danger', 'warning', 'info']);
    const warning = analyzer.buildSafetyAlerts({ cape: [600] }, 0, {}, 1000);
    expect(warning[0].type).toBe('warning');
    expect(analyzer.buildSafetyAlerts({}, 0, {}, 1000)).toEqual([]);
  });
});
