/**
 * Unit tests for i18n.js
 * Run with: node utils/tests/i18n.test.js
 */

if (typeof wx === 'undefined') {
  global.wx = {};
}

const i18n = require('../i18n');
const { t, setLocale, getLocale, getSupportedLocales } = i18n;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('❌ FAIL: ' + message);
  }
}

// === Basic translation ===
console.log('\n--- Basic translation ---');
setLocale('zh-CN');
assert(t('app.title') === '云海观测决策台', 'zh-CN app.title');
assert(t('hero.epicDay') === '今日大片日！云海+晚霞双绝，必须出发', 'zh-CN hero.epicDay');

// === Interpolation ===
console.log('\n--- Interpolation ---');
assert(t('status.offline', { minutes: 30 }) === '离线模式：数据来自 30 分钟前（联网后自动更新）', 'interpolation with {minutes}');
assert(t('safety.cold', { value: -5.2 }) === '体感温度仅 -5.2°C，注意防寒保暖', 'interpolation with {value}');

// === Missing key returns key ===
console.log('\n--- Missing keys ---');
assert(t('nonexistent.key') === 'nonexistent.key', 'missing key returns key');

// === English locale ===
console.log('\n--- English locale ---');
setLocale('en');
assert(t('app.title') === 'Cloud Sea Observatory', 'en app.title');
assert(t('hero.rest') === 'Stay home and edit photos today', 'en hero.rest');

// === English fallback to zh-CN ===
assert(t('weather.humidity') === '湿度', 'en falls back to zh-CN for missing key');

// === Locale management ===
console.log('\n--- Locale management ---');
assert(getLocale() === 'en', 'getLocale returns en');
setLocale('zh-CN');
assert(getLocale() === 'zh-CN', 'getLocale returns zh-CN after switch');
setLocale('invalid');
assert(getLocale() === 'zh-CN', 'invalid locale falls back');
assert(getSupportedLocales().length >= 2, 'at least 2 supported locales');

// === Summary ===
console.log('\n' + '='.repeat(40));
console.log('Tests: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed!');
}

test('legacy Node self-test assertions pass', () => {
  expect(failed).toBe(0);
});
