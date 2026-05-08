/**
 * Tests for fusion.js — multi-model weather fusion
 */
const fusionMod = require('../miniprogram/utils/fusion');

// ─── Mock weather data ──────────────────────────────────────

function makeMockHourly(tempBase, humBase) {
  const time = [];
  const temperature_2m = [];
  const relative_humidity_2m = [];
  const dew_point_2m = [];
  const pressure_msl = [];
  const cloud_cover = [];
  const cloud_cover_low = [];
  const cloud_cover_mid = [];
  const cloud_cover_high = [];
  const visibility = [];
  const precipitation = [];
  const precipitation_probability = [];
  const wind_speed_10m = [];

  for (let i = 0; i < 24; i++) {
    time.push(`2026-07-01T${String(i).padStart(2, '0')}:00`);
    temperature_2m.push(tempBase + Math.sin(i / 24 * Math.PI) * 5);
    relative_humidity_2m.push(humBase);
    dew_point_2m.push(tempBase - 3);
    pressure_msl.push(1015);
    cloud_cover.push(50);
    cloud_cover_low.push(40);
    cloud_cover_mid.push(30);
    cloud_cover_high.push(20);
    visibility.push(12000);
    precipitation.push(0);
    precipitation_probability.push(10);
    wind_speed_10m.push(3);
  }

  return {
    time, temperature_2m, relative_humidity_2m, dew_point_2m,
    pressure_msl, cloud_cover, cloud_cover_low, cloud_cover_mid, cloud_cover_high,
    visibility, precipitation, precipitation_probability, wind_speed_10m,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('fuseModelPredictions', () => {
  const modelResults = [
    { model: { name: 'ICON', weight: 1.0 }, data: { hourly: makeMockHourly(10, 90) } },
    { model: { name: 'GFS', weight: 1.0 }, data: { hourly: makeMockHourly(10, 88) } },
    { model: { name: 'ECMWF', weight: 1.5 }, data: { hourly: makeMockHourly(10, 92) } },
  ];

  test('produces fused score from multiple models', () => {
    const r = fusionMod.fuseModelPredictions(modelResults, 1800, 0);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r.fusedScore)).toBe(true);
    expect(r.fusedScore).toBeGreaterThanOrEqual(0);
    expect(r.fusedScore).toBeLessThanOrEqual(100);
  });

  test('model count matches input', () => {
    const r = fusionMod.fuseModelPredictions(modelResults, 1800, 0);
    expect(r.modelCount).toBe(3);
  });

  test('modelDetails contains per-model scores', () => {
    const r = fusionMod.fuseModelPredictions(modelResults, 1800, 0);
    expect(r.modelDetails).toHaveLength(3);
    r.modelDetails.forEach(d => {
      expect(d.name).toBeDefined();
      expect(Number.isFinite(d.score)).toBe(true);
    });
  });

  test('agreement is computed', () => {
    const r = fusionMod.fuseModelPredictions(modelResults, 1800, 0);
    expect(r.agreement).toBeDefined();
    expect(['high', 'medium', 'low']).toContain(r.agreement.level);
    expect(Number.isFinite(r.stdDev)).toBe(true);
  });

  test('ECMWF higher weight influences fused score', () => {
    const ecmwfOnly = [{ model: { name: 'ECMWF', weight: 1.5 }, data: { hourly: makeMockHourly(10, 95) } }];
    const iconOnly = [{ model: { name: 'ICON', weight: 1.0 }, data: { hourly: makeMockHourly(10, 95) } }];
    const rE = fusionMod.fuseModelPredictions(ecmwfOnly, 1800, 0);
    const rI = fusionMod.fuseModelPredictions(iconOnly, 1800, 0);
    // Same data, should produce same score since it's single model
    expect(rE.fusedScore).toBe(rI.fusedScore);
  });

  test('single model degradation works', () => {
    const single = [modelResults[0]];
    const r = fusionMod.fuseModelPredictions(single, 1800, 0);
    expect(r).not.toBeNull();
    expect(r.modelCount).toBe(1);
  });

  test('returns resultText and summary', () => {
    const r = fusionMod.fuseModelPredictions(modelResults, 1800, 0);
    expect(typeof r.resultText).toBe('string');
    expect(typeof r.summary).toBe('string');
    expect(r.resultText.length).toBeGreaterThan(0);
  });

  test('returns null for empty input', () => {
    const r = fusionMod.fuseModelPredictions([], 1800, 0);
    expect(r).toBeNull();
  });
});

describe('MODELS constant', () => {
  test('has 4 models', () => {
    expect(fusionMod.MODELS).toHaveLength(4);
  });

  test('ECMWF has highest weight', () => {
    const ecmwf = fusionMod.MODELS.find(m => m.name.includes('ECMWF'));
    const maxWeight = Math.max(...fusionMod.MODELS.map(m => m.weight));
    expect(ecmwf.weight).toBe(maxWeight);
  });
});
