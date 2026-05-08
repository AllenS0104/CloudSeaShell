const { createFavorites, constants } = require('../shared/core/favorites-core');

function storageWith(value) { const data = { [constants.FAV_KEY]: value }; return { get: jest.fn(k => data[k]), set: jest.fn((k, v) => { data[k] = v; }), remove: jest.fn(), keys: jest.fn(), data }; }

describe('收藏核心存储', () => {
  test('添加收藏会去重、补默认海拔并限制数量', () => {
    const storage = storageWith([]);
    const fav = createFavorites({ storage });
    expect(fav.addFavorite({ name: '牛背山', lat: 29.8, lon: 102.4 })).toBe(true);
    expect(fav.addFavorite({ name: '重复点', lat: 29.805, lon: 102.405 })).toBe(false);
    for (let i = 0; i < 25; i += 1) fav.addFavorite({ name: '点' + i, lat: i, lon: i });
    expect(fav.getFavorites()).toHaveLength(constants.MAX_FAVORITES);
    expect(fav.getFavorites()[0].name).toBe('点24');
  });

  test('删除和判断收藏按坐标容差匹配', () => {
    const storage = storageWith([{ name: 'A', lat: 1, lon: 2 }, { name: 'B', lat: 5, lon: 6 }]);
    const fav = createFavorites({ storage });
    expect(fav.isFavorite(1.005, 2.005)).toBe(true);
    fav.removeFavorite(1.005, 2.005);
    expect(fav.isFavorite(1, 2)).toBe(false);
    expect(fav.isFavorite(5, 6)).toBe(true);
  });

  test('存储异常时安全降级', () => {
    const fav = createFavorites({ storage: { get: () => { throw new Error('bad'); }, set: () => { throw new Error('bad'); } } });
    expect(fav.getFavorites()).toEqual([]);
    expect(fav.addFavorite({ name: 'A', lat: 1, lon: 2 })).toBe(true);
    expect(fav.addFavorite(null)).toBe(false);
  });
});
