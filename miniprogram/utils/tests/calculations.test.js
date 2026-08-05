/**
 * Unit tests for calculations.js
 * Run with: node utils/tests/calculations.test.js
 */

// Shim wx global for Node.js environment
if (typeof wx === 'undefined') {
  global.wx = {};
}

const calc = require('../calculations');
const { CLOUD_SEA_GO, CLOUD_SEA_STRONG, CLOUD_SEA_WATCH } = require('../thresholds');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance,
    `${message} — expected ~${expected}, got ${actual}`);
}

// ===== cloudBaseFromHumidity =====
console.log('\n--- cloudBaseFromHumidity ---');
assert(calc.cloudBaseFromHumidity(20, 100) === 0, 'humidity 100% → cloud base 0m');
assert(calc.cloudBaseFromHumidity(20, 80) > 0, 'humidity 80% → cloud base > 0');
assert(calc.cloudBaseFromHumidity(20, 50) > calc.cloudBaseFromHumidity(20, 80), 'lower humidity → higher cloud base');
assert(calc.cloudBaseFromHumidity(NaN, 50) >= 0, 'NaN temperature handled');
assert(calc.cloudBaseFromHumidity(20, NaN) >= 0, 'NaN humidity handled');

// ===== cloudBaseFromDewPoint =====
console.log('\n--- cloudBaseFromDewPoint ---');
assert(calc.cloudBaseFromDewPoint(20, 20) === 0, 'temp = dewpoint → cloud base 0m');
assert(calc.cloudBaseFromDewPoint(20, 15) === 625, 'temp 20, dew 15 → 625m');
assert(calc.cloudBaseFromDewPoint(0, 0) === 0, '0°C temp and dewpoint → 0m');
assert(calc.cloudBaseFromDewPoint(0, -2) === 250, '0°C temp, -2°C dew → 250m');

// ===== scoreInversion =====
console.log('\n--- scoreInversion ---');
assert(calc.scoreInversion([10, 12, 14]).detected === true, 'rising temps = inversion detected');
assert(calc.scoreInversion([14, 12, 10]).detected === false, 'falling temps = no inversion');
assert(calc.scoreInversion([10, 15, 12]).score > 0, 'partial inversion scores > 0');
assert(calc.scoreInversion([10]).detected === false, 'single temp = no inversion');
assert(calc.scoreInversion([]).detected === false, 'empty array = no inversion');

// ===== dewPointSpread =====
console.log('\n--- dewPointSpread ---');
assert(calc.dewPointSpread(20, 15) === 5, '20-15 = 5');
assert(calc.dewPointSpread(20, 20) === 0, '20-20 = 0');
assert(calc.dewPointSpread(null, null) === 0, 'null values = 0');

// ===== scoreToConfidence =====
console.log('\n--- scoreToConfidence ---');
assert(calc.scoreToConfidence(CLOUD_SEA_STRONG).level === 'high', 'STRONG = high');
assert(calc.scoreToConfidence(CLOUD_SEA_GO).level === 'medium', 'GO = medium');
assert(calc.scoreToConfidence(CLOUD_SEA_WATCH).level === 'low', 'WATCH = low');
assert(calc.scoreToConfidence(CLOUD_SEA_WATCH - 1).level === 'very-low', 'below WATCH = very-low');
assert(calc.scoreToConfidence(0).level === 'very-low', '0 = very-low');
assert(calc.scoreToConfidence(100).level === 'high', '100 = high');
assert(calc.scoreToConfidence(-5).level === 'very-low', 'negative clamped');
assert(calc.scoreToConfidence(150).level === 'high', 'over 100 clamped');

// ===== analyzeCloudSeaSample =====
console.log('\n--- analyzeCloudSeaSample ---');

// Ideal cloud sea conditions.
// 必须把日出时段和逆温也给全 —— 否则 timeScore/inversionScore 会以 0 计入
// 134 分的分母，这个 fixture 就名不副实了（实测只有 74 分）。
const idealResult = calc.analyzeCloudSeaSample({
  temperature: 15, humidity: 95, visibility: 15000,
  cloudCover: 70, lowCloudCover: 60, windSpeed: 2,
  dewPoint: 14, pressureMsl: 1018, precipitationProbability: 0,
  precipitationAmount: 0, elevation: 1500,
  timeString: '2026-05-01T06:00:00+08:00',
  sunriseTime: '2026-05-01T06:00:00+08:00',
  inversionScore: 12, inversionDetected: true,
});
assert(idealResult.score >= CLOUD_SEA_GO, `ideal conditions score >= ${CLOUD_SEA_GO}, got ${idealResult.score}`);
assert(idealResult.suggestion === true, 'ideal → suggestion true');

// Poor conditions
const poorResult = calc.analyzeCloudSeaSample({
  temperature: 25, humidity: 30, visibility: 2000,
  cloudCover: 10, lowCloudCover: 5, windSpeed: 20,
  dewPoint: 5, pressureMsl: 998, precipitationProbability: 80,
  precipitationAmount: 5, elevation: 100, timeString: null,
});
assert(poorResult.score < 30, `poor conditions score < 30, got ${poorResult.score}`);
assert(poorResult.suggestion === false, 'poor → suggestion false');

// Edge: all nulls/undefined
const nullResult = calc.analyzeCloudSeaSample({
  temperature: null, humidity: null, visibility: null,
  cloudCover: null, lowCloudCover: null, windSpeed: null,
  dewPoint: null, pressureMsl: null, precipitationProbability: null,
  precipitationAmount: null, elevation: 0, timeString: null,
});
assert(typeof nullResult.score === 'number', 'null inputs → still returns number score');
assert(nullResult.score >= 0, 'null inputs → score >= 0');

// ===== windDirection =====
console.log('\n--- windDirection ---');
assert(calc.windDirection(0) === '北风', '0° = 北风');
assert(calc.windDirection(90) === '东风', '90° = 东风');
assert(calc.windDirection(180) === '南风', '180° = 南风');
assert(calc.windDirection(270) === '西风', '270° = 西风');
assert(calc.windDirection(NaN) === '北风', 'NaN → 北风 (default)');

// ===== formatDistanceKm =====
console.log('\n--- formatDistanceKm ---');
assert(calc.formatDistanceKm(5000) === '5.0 km', '5000m = 5.0 km');
assert(calc.formatDistanceKm(0) === '0.0 km', '0m = 0.0 km');
assert(calc.formatDistanceKm(NaN) === '0.0 km', 'NaN = 0.0 km');

// ===== formatCoords =====
console.log('\n--- formatCoords ---');
assert(calc.formatCoords(30.123, 118.456) === '30.12, 118.46', 'coords formatted to 2dp');

// ===== minOrZero / maxOrZero =====
console.log('\n--- minOrZero / maxOrZero ---');
assert(calc.minOrZero([3, 1, 2]) === 1, 'min of [3,1,2] = 1');
assert(calc.minOrZero([]) === 0, 'min of [] = 0');
assert(calc.maxOrZero([3, 1, 2]) === 3, 'max of [3,1,2] = 3');
assert(calc.maxOrZero([]) === 0, 'max of [] = 0');

// ===== missing-variable handling (model coverage gaps) =====
console.log('\n--- missing variable renormalization ---');
{
  // ICON/JMA/ECMWF return `visibility` as an all-null series. Such a model
  // must not be scored as if visibility were 0 km, otherwise it loses up to
  // 15 points relative to GFS and corrupts multi-model fusion.
  const hours = 24;
  const mkHourly = (visibility) => ({
    time: Array.from({ length: hours }, (_, i) => `2026-08-05T${String(i).padStart(2, '0')}:00`),
    temperature_2m: new Array(hours).fill(15),
    relative_humidity_2m: new Array(hours).fill(80),
    dew_point_2m: new Array(hours).fill(11),
    pressure_msl: new Array(hours).fill(1008),
    cloud_cover: new Array(hours).fill(35),
    cloud_cover_low: new Array(hours).fill(30),
    wind_speed_10m: new Array(hours).fill(6),
    precipitation: new Array(hours).fill(0),
    precipitation_probability: new Array(hours).fill(5),
    cape: new Array(hours).fill(0),
    visibility,
  });

  const withVisibility = calc.analyzeDayCloudSea(mkHourly(new Array(hours).fill(20000)), 0, 600);
  const nullVisibility = calc.analyzeDayCloudSea(mkHourly(new Array(hours).fill(null)), 0, 600);
  const zeroVisibility = calc.analyzeDayCloudSea(mkHourly(new Array(hours).fill(0)), 0, 600);
  const missingVisibility = calc.analyzeDayCloudSea(mkHourly(undefined), 0, 600);

  assert(nullVisibility.score > zeroVisibility.score,
    'all-null visibility must not be scored as 0 km');
  assert(missingVisibility.score === nullVisibility.score,
    'absent visibility series behaves like an all-null one');
  assertApprox(nullVisibility.score, withVisibility.score, 10,
    'model without visibility scores close to one reporting good visibility');
  assert(Number.isInteger(nullVisibility.score),
    'renormalized score stays an integer');
  assert(zeroVisibility.score < withVisibility.score,
    'a genuine 0 km visibility reading is still penalised');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed!');
}

test('legacy Node self-test assertions pass', () => {
  expect(failed).toBe(0);
});
