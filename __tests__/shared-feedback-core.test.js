const { createFeedback, constants } = require('../shared/core/feedback-core');
const { CLOUD_SEA_GO } = require('../shared/core/thresholds');

function storageWith(value) { const data = { [constants.STORAGE_KEY]: value }; return { get: jest.fn(k => data[k]), set: jest.fn((k, v) => { data[k] = v; }), remove: jest.fn(), keys: jest.fn(), data }; }

describe('反馈核心记录', () => {
  beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-01T10:00:00Z').getTime()); });
  afterEach(() => { jest.restoreAllMocks(); });

  test('保存反馈会创建记录，且同日同坐标更新预测', () => {
    const storage = storageWith([]);
    const feedback = createFeedback({ storage });
    const first = feedback.saveFeedback({ location: { lat: 30, lon: 120, name: '黄山' }, predictions: { cloudSea: { score: 70 }, glow: { score: 50 }, stars: { score: 40 } } });
    expect(first.id).toBe('fb_' + Date.now());
    const second = feedback.saveFeedback({ location: { lat: 30.0005, lon: 120.0005, name: '黄山' }, predictions: { cloudSea: { score: 10 } } });
    expect(second.id).toBe(first.id);
    expect(feedback.getFeedbackRecords()).toHaveLength(1);
    expect(feedback.getFeedbackRecords()[0].predictions.cloudSea.score).toBe(10);
  });

  test('更新反馈和统计会按阈值计算命中率', () => {
    const records = [{ id: 'a', date: '2026-05-01', location: { lat: 1, lon: 2, name: 'A' }, predictions: { cloudSea: { score: CLOUD_SEA_GO }, glow: { score: 30 }, stars: { score: 80 } }, actual: { cloudSea: true, glow: false, stars: false, rating: 4, note: 'ok' } }];
    const feedback = createFeedback({ storage: storageWith(records) });
    expect(feedback.updateFeedback('a', { stars: true, note: '银河可见' })).toBe(true);
    expect(feedback.updateFeedback('missing', { stars: true })).toBe(false);
    const stats = feedback.getFeedbackStats();
    expect(stats).toMatchObject({ total: 1, filled: 1, cloudSeaAccuracy: 100, glowAccuracy: 100, starsAccuracy: 100 });
    expect(stats.accuracy).toBe(100);
  });

  test('CSV 导出会转义危险字符和逗号换行', () => {
    const feedback = createFeedback({ storage: storageWith([{ date: '2026-05-01', location: { lat: 1, lon: 2, name: '山,顶' }, predictions: { cloudSea: { score: 1 }, glow: { score: 2 }, stars: { score: 3 } }, actual: { cloudSea: null, glow: true, stars: false, rating: 5, note: '=SUM(A1)\n好' } }]) });
    const csv = feedback.exportFeedbackCSV();
    expect(csv).toContain('"山,顶"');
    expect(csv).toContain('"\'=SUM(A1)\n好"');
    expect(createFeedback({ storage: storageWith([]) }).exportFeedbackCSV()).toBe('');
  });

  test('空记录和存储异常安全降级', () => {
    expect(createFeedback({ storage: storageWith([]) }).getFeedbackStats()).toMatchObject({ total: 0, accuracy: null });
    const feedback = createFeedback({ storage: { get: () => { throw new Error('bad'); }, set: () => { throw new Error('bad'); } } });
    expect(feedback.getFeedbackRecords()).toEqual([]);
    expect(feedback.saveFeedback({}).location.name).toBe('未知');
  });
});
