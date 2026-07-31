/**
 * Regression tests for two P0 defects found in the accuracy review:
 *
 * 1. analyzeDayCloudSea memoized on (start, elevation, sunrise) only, so
 *    different weather payloads collided in the cache. Multi-model fusion
 *    (ICON/GFS/JMA/ECMWF) degenerated into a single model with stdDev 0.
 *
 * 2. The pressure-level inversion detector was overridden by a surface
 *    time-series proxy whenever it reported "no inversion". Because rising
 *    daytime temperature is indistinguishable from an inversion to that
 *    proxy, ~96% of days were flagged as having an inversion (ground truth
 *    from upper-air data: ~10%).
 */

const calc = require('../shared/core/calculations');
const scoring = require('../shared/core/scoring');

function buildHourly(overrides = {}) {
  const {
    temperature = 10,
    humidity = 95,
    dewPoint = 9.5,
    lowCloud = 70,
    temperature925hPa = null,
    temperature850hPa = null,
    temperature700hPa = null,
    temperatureSeries = null,
  } = overrides;

  const hourly = {
    time: [],
    temperature_2m: [],
    relative_humidity_2m: [],
    dew_point_2m: [],
    pressure_msl: [],
    visibility: [],
    cloud_cover: [],
    cloud_cover_low: [],
    wind_speed_10m: [],
    precipitation_probability: [],
    precipitation: [],
  };
  if (temperature925hPa !== null) hourly.temperature_925hPa = [];
  if (temperature850hPa !== null) hourly.temperature_850hPa = [];
  if (temperature700hPa !== null) hourly.temperature_700hPa = [];

  for (let i = 0; i < 24; i += 1) {
    hourly.time.push(`2026-05-01T${String(i).padStart(2, '0')}:00`);
    hourly.temperature_2m.push(temperatureSeries ? temperatureSeries[i] : temperature);
    hourly.relative_humidity_2m.push(humidity);
    hourly.dew_point_2m.push(dewPoint);
    hourly.pressure_msl.push(1018);
    hourly.visibility.push(20000);
    hourly.cloud_cover.push(70);
    hourly.cloud_cover_low.push(lowCloud);
    hourly.wind_speed_10m.push(1);
    hourly.precipitation_probability.push(0);
    hourly.precipitation.push(0);
    if (temperature925hPa !== null) hourly.temperature_925hPa.push(temperature925hPa);
    if (temperature850hPa !== null) hourly.temperature_850hPa.push(temperature850hPa);
    if (temperature700hPa !== null) hourly.temperature_700hPa.push(temperature700hPa);
  }
  return hourly;
}

describe('analyzeDayCloudSea 缓存正确性', () => {
  const SUNRISE = '2026-05-01T05:30';

  it('天气数据不同时不得复用缓存结果', () => {
    const favourable = buildHourly({ temperature: 10, humidity: 99, dewPoint: 9.8, lowCloud: 80 });
    const hostile = buildHourly({ temperature: 30, humidity: 20, dewPoint: 3, lowCloud: 0 });

    const a = calc.analyzeDayCloudSea(favourable, 0, 1800, SUNRISE);
    const b = calc.analyzeDayCloudSea(hostile, 0, 1800, SUNRISE);

    expect(a.score).not.toBe(b.score);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('同一份数据重复调用结果稳定（缓存仍生效）', () => {
    const hourly = buildHourly();
    const first = calc.analyzeDayCloudSea(hourly, 0, 1500, SUNRISE);
    const second = calc.analyzeDayCloudSea(hourly, 0, 1500, SUNRISE);
    expect(second).toBe(first);
  });

  it('多模式融合下各模式得分互不串扰', () => {
    const models = [
      buildHourly({ temperature: 12, humidity: 95, dewPoint: 11, lowCloud: 75 }),
      buildHourly({ temperature: 25, humidity: 35, dewPoint: 8, lowCloud: 5 }),
      buildHourly({ temperature: 8, humidity: 99, dewPoint: 7.9, lowCloud: 90 }),
      buildHourly({ temperature: 28, humidity: 25, dewPoint: 6, lowCloud: 0 }),
    ];
    const scores = models.map((h) => calc.analyzeDayCloudSea(h, 0, 2000, '2026-06-01T05:00').score);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('fingerprintHourly 对不同数据产生不同指纹', () => {
    const a = calc.fingerprintHourly(buildHourly({ temperature: 10 }), 0);
    const b = calc.fingerprintHourly(buildHourly({ temperature: 25 }), 0);
    expect(a).not.toBe(b);
    expect(calc.fingerprintHourly(null, 0)).toBe('none');
  });
});

describe('逆温层检测不得误报', () => {
  // 白天正常升温序列——对"逐小时地面温度"代理来说和逆温无法区分
  const diurnal = [5, 5.5, 6.5, 8, 10, 12, 14, 15, 16, 16.5, 16, 15,
    14, 13, 12, 11, 10, 9, 8, 7, 6.5, 6, 5.5, 5];

  it('有高空数据且显示无逆温时，不得回退到地面代理', () => {
    const hourly = buildHourly({
      temperatureSeries: diurnal,
      temperature925hPa: 2,   // 明显递减，无逆温
      temperature850hPa: -2,
    });
    const result = calc.analyzeDayCloudSea(hourly, 0, 200, '2026-05-01T05:30');
    expect(result.hourlyAnalyses.every((a) => a.inversionDetected === false)).toBe(true);
    expect(result.hourlyAnalyses.every((a) => a.inversionScore === 0)).toBe(true);
  });

  it('有高空数据且确实存在逆温时正常识别', () => {
    const hourly = buildHourly({
      temperatureSeries: diurnal,
      temperature925hPa: 20,  // 高空明显更暖 = 真逆温
    });
    const result = calc.analyzeDayCloudSea(hourly, 0, 200, '2026-05-01T05:30');
    const detected = result.hourlyAnalyses.filter((a) => a.inversionDetected);
    expect(detected.length).toBeGreaterThan(0);
    expect(detected[0].inversionLayer).toBe('925hPa');
  });

  it('完全没有高空数据时才允许使用地面代理', () => {
    const hourly = buildHourly({ temperatureSeries: diurnal });
    const result = calc.analyzeDayCloudSea(hourly, 0, 200, '2026-05-01T05:30');
    expect(result.verticalInversionAvailable).toBe(false);
    expect(result.inversion.detected).toBe(true); // 代理仍生效，但已标注来源
  });

  it('scoreVerticalInversion 通过 available 区分"无数据"与"无逆温"', () => {
    const noData = scoring.scoreVerticalInversion({ surfaceTemperature: 10, elevation: 200 });
    expect(noData.available).toBe(false);

    const noInversion = scoring.scoreVerticalInversion({
      surfaceTemperature: 10, temperature925hPa: 4, elevation: 200,
    });
    expect(noInversion.available).toBe(true);
    expect(noInversion.detected).toBe(false);
  });
});
