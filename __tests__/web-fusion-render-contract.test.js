/**
 * Regression test: web/js/app.js renderFusion() must read the field names
 * that web/js/fusion.js actually returns.
 *
 * A mismatch here is invisible to every other test — fusion.js was returning
 * fusedScore/resultText/agreement/stdDev/modelDetails while renderFusion()
 * read score/label/confidence/spread/models, so the app shipped a
 * "undefined 分" multi-model fusion card with an empty model list.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB_JS = path.join(__dirname, '..', 'web', 'js');

function loadFusion() {
  const CS = { calc: require('../shared/core/calculations.js') };
  const win = { CloudSea: CS };
  const ctx = { window: win, console: { warn() {}, log() {} }, Math, Date, JSON, Number, String, Array, Object, isNaN, parseFloat, parseInt, fetch: () => Promise.reject(new Error('no network')) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB_JS, 'fusion.js'), 'utf8'), ctx);
  return win.CloudSea.fusion;
}

/** Build a synthetic 48 h Open-Meteo-shaped payload for one model. */
function makeModelResult(name, weight, { baseTemp, lowCloud, humidity }) {
  const n = 48;
  const series = (fn) => Array.from({ length: n }, (_, i) => fn(i));
  return {
    model: { name, weight },
    data: {
      hourly: {
        time: series((i) => `2026-07-31T${String(i % 24).padStart(2, '0')}:00`),
        temperature_2m: series((i) => baseTemp + Math.sin(i / 4) * 3),
        relative_humidity_2m: series(() => humidity),
        dew_point_2m: series(() => baseTemp - 2),
        pressure_msl: series(() => 1015),
        visibility: series(() => 20000),
        cloud_cover: series(() => 70),
        cloud_cover_low: series(() => lowCloud),
        cloud_cover_mid: series(() => 30),
        cloud_cover_high: series(() => 20),
        wind_speed_10m: series(() => 6),
        precipitation: series(() => 0),
        precipitation_probability: series(() => 5),
        cape: series(() => 100),
        temperature_925hPa: series(() => baseTemp + 4),
        temperature_850hPa: series(() => baseTemp + 2),
        temperature_700hPa: series(() => baseTemp - 4),
      },
      daily: { sunrise: ['2026-07-31T05:12', '2026-08-01T05:13'] },
    },
  };
}

describe('web fusion result contract', () => {
  const fusion = loadFusion();
  const modelResults = [
    makeModelResult('ICON（德国）', 1.0, { baseTemp: 10, lowCloud: 80, humidity: 85 }),
    makeModelResult('GFS（美国）', 0.9, { baseTemp: 12, lowCloud: 60, humidity: 70 }),
    makeModelResult('JMA（日本）', 0.8, { baseTemp: 8, lowCloud: 95, humidity: 92 }),
    makeModelResult('ECMWF（欧洲）', 1.1, { baseTemp: 11, lowCloud: 40, humidity: 60 }),
  ];
  // Signature is (modelResults, elevation, dayIndex) — not (…, dayIndex, elevation).
  const result = fusion.fuseModelPredictions(modelResults, 1500, 0);

  test('produces a usable fused result', () => {
    expect(result).not.toBeNull();
    expect(Number.isFinite(result.fusedScore)).toBe(true);
    expect(result.modelCount).toBe(4);
    expect(Array.isArray(result.modelDetails)).toBe(true);
    expect(result.modelDetails).toHaveLength(4);
  });

  test('every model contributes a numeric score', () => {
    for (const m of result.modelDetails) {
      expect(typeof m.name).toBe('string');
      expect(Number.isFinite(m.score)).toBe(true);
    }
  });

  test('differing model inputs produce differing model scores', () => {
    // Guards the cache-key fingerprint fix: sharing one cache entry across
    // models made every model report the identical score.
    const scores = result.modelDetails.map((m) => m.score);
    expect(new Set(scores).size).toBeGreaterThan(1);
    expect(result.stdDev).toBeGreaterThan(0);
  });

  test('requests Open-Meteo with the plural "models" parameter', () => {
    // The singular "model=" is silently ignored by Open-Meteo, which serves
    // best_match instead — collapsing all four models onto identical data.
    const src = fs.readFileSync(path.join(WEB_JS, 'fusion.js'), 'utf8');
    expect(src).toContain("'models=' + modelId");
    expect(src).not.toMatch(/'model=' \+ modelId/);
  });

  test('renderFusion reads fields that fusion.js actually returns', () => {
    const src = fs.readFileSync(path.join(WEB_JS, 'app.js'), 'utf8');
    const body = src.slice(src.indexOf('function renderFusion'));
    const fn = body.slice(0, body.indexOf('\n  function ', 10));

    // The exact expressions that previously rendered "undefined 分".
    for (const field of ['fusedScore', 'resultText', 'agreement', 'stdDev', 'modelDetails']) {
      expect(fn.includes(`result.${field}`)).toBe(true);
    }
  });

  test('the fused headline never renders the string "undefined"', () => {
    const label = result.resultText || result.label;
    const score = result.fusedScore != null ? result.fusedScore : result.score;
    const headline = label || (score != null ? `${score} 分` : '--');
    expect(headline).not.toContain('undefined');
    expect(headline).toMatch(/\d/);
  });
});
