const { createSearchHistory, constants } = require('../shared/core/search-history-core');

function storageWith(value) { const data = { [constants.HISTORY_KEY]: value }; return { get: jest.fn(k => data[k]), set: jest.fn((k, v) => { data[k] = v; }), remove: jest.fn(k => { delete data[k]; }), keys: jest.fn(), data }; }

describe('搜索历史核心存储', () => {
  test('新增历史会坐标去重并限制最大数量', () => {
    const storage = storageWith([{ name: '旧', lat: 1, lon: 2 }]);
    const history = createSearchHistory({ storage });
    history.addSearchHistory({ name: '更新', lat: 1.005, lon: 2.005 });
    for (let i = 0; i < 10; i += 1) history.addSearchHistory({ name: '点' + i, lat: i + 10, lon: i + 10 });
    expect(history.getSearchHistory()).toHaveLength(constants.MAX_HISTORY);
    expect(history.getSearchHistory()[0]).toEqual({ name: '点9', lat: 19, lon: 19 });
    expect(history.getSearchHistory().some(item => item.name === '旧')).toBe(false);
  });

  test('清空历史调用存储 remove，非法输入不写入', () => {
    const storage = storageWith([]);
    const history = createSearchHistory({ storage });
    history.addSearchHistory({ lat: 1, lon: 2 });
    expect(storage.set).not.toHaveBeenCalled();
    history.clearSearchHistory();
    expect(storage.remove).toHaveBeenCalledWith(constants.HISTORY_KEY);
  });

  test('存储异常时安全返回空数组', () => {
    const history = createSearchHistory({ storage: { get: () => { throw new Error('bad'); }, set: () => { throw new Error('bad'); }, remove: () => { throw new Error('bad'); } } });
    expect(history.getSearchHistory()).toEqual([]);
    expect(() => history.addSearchHistory({ name: 'A', lat: 1, lon: 2 })).not.toThrow();
    expect(() => history.clearSearchHistory()).not.toThrow();
  });
});
