const waypoints = require('../shared/core/waypoints-data');

describe('机位数据边界', () => {
  test('haversine 处理零距离、近距离和跨经度距离', () => {
    expect(waypoints.haversineKm(0, 0, 0, 0)).toBeCloseTo(0, 5);
    expect(waypoints.haversineKm(0, 0, 0, 1)).toBeCloseTo(111.2, 0);
    expect(waypoints.haversineKm(10, 179.9, 10, -179.9)).toBeLessThan(25);
  });

  test('附近机位支持 lon 别名、默认半径和非法坐标', () => {
    expect(waypoints.findNearbyWaypoints({ lat: 'bad', lon: 1 })).toEqual([]);
    const nearby = waypoints.findNearbyWaypoints({ lat: 29.8039, lon: 102.4449 });
    expect(nearby[0].id).toBe('niubei-shan');
    expect(nearby.every((item, idx, arr) => idx === 0 || item.distanceKm >= arr[idx - 1].distanceKm)).toBe(true);
  });

  test('标签映射保留未知用途并覆盖 bortle 边界', () => {
    expect(waypoints.getBestForLabels(['cloudsea', 'unknown'])).toEqual(['云海', 'unknown']);
    expect(waypoints.getBestForLabels()).toEqual([]);
    expect(waypoints.getBortleLightPollutionLabel(3)).toBe('暗夜保护区');
    expect(waypoints.getBortleLightPollutionLabel(6)).toBe('中等光污染');
    expect(waypoints.getBortleLightPollutionLabel(7)).toBe('城市光污染重');
    expect(waypoints.estimateBortleClass({ bortleClass: '4' })).toBe(4);
    expect(waypoints.estimateBortleClass({ elevation: 2000, distanceKm: 10 })).toBeNull();
    expect(waypoints.getLightPollutionLabelForWaypoint({ bortleClass: 2 })).toMatchObject({ bortleClass: 2, estimated: false, label: '暗夜保护区' });
  });

  test('罗盘 SVG 数据 URI 可生成 base64', () => {
    const uri = waypoints.getCompassSvgDataUri(-45);
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(uri.split(',')[1], 'base64').toString('utf8')).toContain('rotate(315');
  });
});
