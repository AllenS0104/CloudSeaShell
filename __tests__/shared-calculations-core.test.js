const calc = require('../shared/core/calculations');

function makeHourly(overrides = {}) {
  const time = Array.from({ length: 30 }, (_, i) => `2026-05-01T${String(i % 24).padStart(2, '0')}:00:00+08:00`);
  const fill = (v) => Array.from({ length: 30 }, () => v);
  return {
    time,
    temperature_2m: fill(10),
    relative_humidity_2m: fill(92),
    dew_point_2m: fill(8.5),
    pressure_msl: fill(1018),
    visibility: fill(16000),
    cloud_cover: fill(65),
    cloud_cover_low: fill(70),
    wind_speed_10m: fill(3),
    precipitation_probability: fill(10),
    precipitation: fill(0),
    ...overrides,
  };
}

describe('云海计算核心', () => {
  test('云底、露点差和格式化工具处理异常输入', () => {
    expect(calc.cloudBaseFromHumidity(20, 90)).toBe(250);
    expect(calc.cloudBaseFromHumidity(NaN, NaN)).toBe(2500);
    expect(calc.cloudBaseFromDewPoint(12, 10)).toBe(250);
    expect(calc.dewPointSpread(12.2, 10.1)).toBe(2.1);
    expect(calc.getCurrentCloudCover({ cloudcover: 44 })).toBe(44);
    expect(calc.getCurrentLowCloudCover({ cloudcover_low: 33 })).toBe(33);
    expect(calc.getHourlyCloudCover({ cloudcover: [1, 2, 3] }, 1, 2)).toEqual([2, 3]);
    expect(calc.getHourlyLowCloudCover({ cloudcover_low: [3, null] }, 0, 2)).toEqual([3, 0]);
    expect(calc.minOrZero([])).toBe(0);
    expect(calc.maxOrZero([1, 5, 2])).toBe(5);
    expect(calc.windDirection(91)).toBe('东风');
    expect(calc.windDirection(Number.NaN)).toBe('北风');
    expect(calc.formatDistanceKm(1234)).toBe('1.2 km');
    expect(calc.formatCoords(30.123, 120.456)).toBe('30.12, 120.46');
    expect(calc.pickBackgroundImage('2026-05-01T12:00:00')).toBe(calc.DAY_BACKGROUND);
    expect(calc.pickBackgroundImage('2026-05-01T23:00:00')).toBe(calc.NIGHT_BACKGROUND);
  });

  test('单点分析区分可出发与降水大风风险', () => {
    const good = calc.analyzeCloudSeaSample({ temperature: 10, humidity: 96, visibility: 18000, cloudCover: 70, lowCloudCover: 80, windSpeed: 2, dewPoint: 9, pressureMsl: 1020, precipitationProbability: 0, precipitationAmount: 0, elevation: 1800, timeString: '2026-05-01T05:30:00+08:00', sunriseTime: '2026-05-01T05:45:00+08:00', inversionScore: 8, inversionDetected: true, inversionStrength: 3 });
    const poor = calc.analyzeCloudSeaSample({ temperature: 10, humidity: 45, visibility: 1000, cloudCover: 5, lowCloudCover: 0, windSpeed: 14, dewPoint: 0, pressureMsl: 990, precipitationProbability: 90, precipitationAmount: 3, elevation: 300, timeString: '2026-05-01T13:00:00+08:00' });
    expect(good.suggestion).toBe(true);
    expect(good.reasons.join('')).toContain('逆温层');
    expect(poor.suggestion).toBe(false);
    expect(poor.score).toBeLessThan(good.score);
    expect(poor.reasons.join('')).toContain('水汽条件偏弱');
  });

  test('日分析挑选最佳小时并缓存相同参数', () => {
    const hourly = makeHourly({ temperature_2m: Array.from({ length: 30 }, (_, i) => 8 + i * 0.2) });
    const first = calc.analyzeDayCloudSea(hourly, 0, 1800, '2026-05-01T05:40:00+08:00');
    const second = calc.analyzeDayCloudSea(hourly, 0, 1800, '2026-05-01T05:40:00+08:00');
    expect(second).toBe(first);
    expect(first.hourlyAnalyses).toHaveLength(24);
    expect(first.bestHour.timeLabel).toMatch(/:/);
    expect(first.summary).toContain('最佳观测窗口');
  });

  test('当前天气分析读取 current 字段', () => {
    const result = calc.analyzeCurrentCloudSea({ temperature_2m: 9, relative_humidity_2m: 93, visibility: 12000, cloud_cover: 70, cloud_cover_low: 80, wind_speed_10m: 3, dew_point_2m: 8, pressure_msl: 1016, precipitation_probability: 0, precipitation: 0, time: '2026-05-01T06:00:00+08:00' }, 1600);
    expect(result.humidity).toBe(93);
    expect(result.cloudBase).toBe(125);
  });
});
