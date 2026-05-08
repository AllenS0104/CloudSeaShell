/**
 * Unit tests for feedback.js helpers
 * Run with: node utils/tests/feedback.test.js
 */

// Shim wx for Node.js
const storage = {};
if (typeof wx === 'undefined') {
  global.wx = {
    getStorageSync(key) { return storage[key] || []; },
    setStorageSync(key, val) { storage[key] = val; },
  };
}

const feedback = require('../feedback');

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

// ===== saveFeedback =====
console.log('\n--- saveFeedback ---');

const record1 = feedback.saveFeedback({
  location: { lat: 30.05, lon: 118.17, name: '黄山' },
  predictions: { cloudSea: { score: 72 }, glow: { score: 45 }, stars: { score: 30 } },
});
assert(record1.id.startsWith('fb_'), 'record has fb_ prefix id');
assert(record1.location.name === '黄山', 'location name preserved');
assert(record1.actual.cloudSea === null, 'actual starts as null');

// Same location same day should update, not duplicate
const record2 = feedback.saveFeedback({
  location: { lat: 30.05, lon: 118.17, name: '黄山' },
  predictions: { cloudSea: { score: 80 }, glow: { score: 50 }, stars: { score: 35 } },
});
const records = feedback.getFeedbackRecords();
assert(records.length === 1, `same location same day → 1 record, got ${records.length}`);
assert(records[0].predictions.cloudSea.score === 80, 'predictions updated to 80');

// ===== updateFeedback =====
console.log('\n--- updateFeedback ---');

const updated = feedback.updateFeedback(record1.id, { cloudSea: true, rating: 4 });
assert(updated === true, 'update returns true');
const updatedRecords = feedback.getFeedbackRecords();
assert(updatedRecords[0].actual.cloudSea === true, 'actual.cloudSea updated');
assert(updatedRecords[0].actual.rating === 4, 'actual.rating updated');

// Update non-existent id
assert(feedback.updateFeedback('nonexistent', { cloudSea: false }) === false, 'non-existent id returns false');

// ===== getFeedbackStats =====
console.log('\n--- getFeedbackStats ---');

const stats = feedback.getFeedbackStats();
assert(stats.total === 1, `total = 1, got ${stats.total}`);
assert(stats.filled === 1, `filled = 1, got ${stats.filled}`);
assert(stats.cloudSeaAccuracy !== null, 'cloudSea accuracy calculated');

// ===== exportFeedbackCSV =====
console.log('\n--- exportFeedbackCSV ---');

const csv = feedback.exportFeedbackCSV();
assert(csv.includes('日期'), 'CSV has header');
assert(csv.includes('黄山'), 'CSV contains location');
assert(csv.split('\n').length >= 2, 'CSV has header + data rows');

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
