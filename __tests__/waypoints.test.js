const waypoints = require('../shared/core/waypoints-data');

describe('waypoints data helpers', () => {
  test('findNearbyWaypoints filters by haversine radius and sorts by distance', () => {
    const nearby = waypoints.findNearbyWaypoints({ lat: 29.8039, lng: 102.4449, radiusKm: 5 });
    expect(nearby.length).toBeGreaterThanOrEqual(1);
    expect(nearby[0]).toMatchObject({ id: 'niubei-shan' });
    expect(nearby[0].distanceKm).toBeLessThanOrEqual(0.1);

    const far = waypoints.findNearbyWaypoints({ lat: 29.8039, lng: 102.4449, radiusKm: 1 });
    expect(far.some((item) => item.id === 'wugong-shan')).toBe(false);
  });

  test('getDirectionLabel handles sector boundary values', () => {
    expect(waypoints.getDirectionLabel(0)).toBe('北');
    expect(waypoints.getDirectionLabel(22.4)).toBe('北');
    expect(waypoints.getDirectionLabel(22.5)).toBe('东北');
    expect(waypoints.getDirectionLabel(67.4)).toBe('东北');
    expect(waypoints.getDirectionLabel(67.5)).toBe('东');
    expect(waypoints.getDirectionLabel(359)).toBe('北');
    expect(waypoints.getDirectionLabel(-45)).toBe('西北');
  });

  test('loadWaypoints merges external data while preserving base entries', () => {
    const merged = waypoints.loadWaypoints([
      {
        id: 'test-waypoint',
        name: '测试机位',
        lat: 29.8,
        lng: 102.4,
        elevation: 3000,
        bestFor: ['cloudsea'],
        bestSeasons: ['秋'],
        suggestedDirection: 0,
        notes: '测试运行时扩展数据。',
        bortleClass: 4,
      },
    ]);

    expect(merged.some((item) => item.id === 'niubei-shan')).toBe(true);
    expect(waypoints.findNearbyWaypoints({ lat: 29.8, lng: 102.4, radiusKm: 2 })[0]).toMatchObject({
      id: 'test-waypoint',
    });
    waypoints.loadWaypoints();
  });

  test('bortleClass label mapping and elevation fallback', () => {
    expect(waypoints.getBortleLightPollutionLabel(2)).toBe('暗夜保护区');
    expect(waypoints.getBortleLightPollutionLabel(5)).toBe('中等光污染');
    expect(waypoints.getBortleLightPollutionLabel(8)).toBe('城市光污染重');
    expect(waypoints.getBortleLightPollutionLabel(undefined)).toBe('未知');

    expect(waypoints.getLightPollutionLabelForWaypoint({ elevation: 1800, distanceKm: 30 })).toMatchObject({
      bortleClass: 6,
      label: '中等光污染',
      estimated: true,
    });
    expect(waypoints.getLightPollutionLabelForWaypoint({ elevation: 300 })).toMatchObject({ label: '未知' });
  });
});
