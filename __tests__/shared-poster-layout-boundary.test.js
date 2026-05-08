const { buildPosterModel, posterPalette } = require('../shared/core/poster-layout');

describe('海报布局边界', () => {
  test('空状态使用默认预测、地点和占位 KPI', () => {
    const model = buildPosterModel();
    expect(model.location).toBe('当前位置');
    expect(model.score).toBeNull();
    expect(model.scoreText).toBe('--');
    expect(model.confidence).toBe('置信度：待更新');
    expect(model.kpis.map(k => k.value)).toEqual(['--', '--', '--', '--']);
  });

  test('多预测会按分数排序并限制理由和提示数量', () => {
    const model = buildPosterModel({ theme: 'light', predictions: { cloudSea: { score: 50, label: '云海一般' }, glow: { score: 82, resultText: '晚霞很强', reasons: ['a', { label: 'b' }, { message: 'c' }, 'd', 'e', 'f'] }, stars: { score: 20 } }, hints: [{ title: '提示1' }, { value: '提示2' }, '提示3'], nearbyWaypoints: [{ name: '近点', distanceKm: 1.2 }] });
    expect(model.palette.theme).toBe('light');
    expect(model.predictionType).toBe('晚霞');
    expect(model.reasons).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(model.hints).toEqual(['提示1', '提示2']);
  });

  test('机位提示覆盖选中点、方向文字和附近无距离分支', () => {
    const model = buildPosterModel({ score: 65, selectedWaypoint: { name: '主峰', direction: { label: '东南' } }, nearbyWaypoints: [{ name: '副峰' }], cameraRec: { summary: '相机建议' }, phoneRec: { summary: '手机建议' } });
    expect(model.hints[0]).toContain('主峰 · 东南');
    expect(model.confidence).toBe('置信度：中');
    expect(model.layout.find(item => item.type === 'hints')).toBeTruthy();
  });

  test('调色板返回副本不会污染默认主题', () => {
    const dark = posterPalette('missing');
    dark.text = 'changed';
    expect(posterPalette('dark').text).not.toBe('changed');
  });
});
