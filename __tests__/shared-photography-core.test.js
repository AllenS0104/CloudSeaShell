const photo = require('../shared/core/photography');
const { CLOUD_SEA_GO } = require('../shared/core/thresholds');

describe('摄影推荐核心', () => {
  test('光线阶段覆盖日出日落、夜间、日间和未知', () => {
    const sr = '2026-06-01T06:00:00+08:00';
    const ss = '2026-06-01T18:30:00+08:00';
    expect(photo.getLightingPhase('', sr, ss).phase).toBe('unknown');
    expect(photo.getLightingPhase('2026-06-01T05:00:00+08:00', sr, ss).phase).toBe('blue-hour-morning');
    expect(photo.getLightingPhase('2026-06-01T05:45:00+08:00', sr, ss).phase).toBe('pre-sunrise');
    expect(photo.getLightingPhase('2026-06-01T06:10:00+08:00', sr, ss).phase).toBe('golden-sunrise');
    expect(photo.getLightingPhase('2026-06-01T07:00:00+08:00', sr, ss).phase).toBe('post-sunrise');
    expect(photo.getLightingPhase('2026-06-01T17:30:00+08:00', sr, ss).phase).toBe('pre-sunset');
    expect(photo.getLightingPhase('2026-06-01T18:10:00+08:00', sr, ss).phase).toBe('golden-sunset');
    expect(photo.getLightingPhase('2026-06-01T18:45:00+08:00', sr, ss).phase).toBe('post-sunset');
    expect(photo.getLightingPhase('2026-06-01T19:30:00+08:00', sr, ss).phase).toBe('blue-hour-evening');
    expect(photo.getLightingPhase('2026-06-01T23:00:00+08:00', sr, ss).phase).toBe('night');
    expect(photo.getLightingPhase('2026-06-01T12:00:00+08:00', sr, ss).phase).toBe('daylight');
  });

  test('高分云海晨昏推荐包含慢门、滤镜、时间线和构图', () => {
    const rec = photo.generatePhotoRecommendations({ timeString: '2026-06-01T06:10:00+08:00', sunriseTime: '2026-06-01T06:00:00+08:00', sunsetTime: '2026-06-01T18:30:00+08:00', cloudCover: 60, visibility: 20000, windSpeed: 2, cloudSeaScore: 82, elevation: 2200 });
    expect(rec.lighting.phase).toBe('golden-sunrise');
    expect(rec.camera.aperture).toBe('f/11');
    expect(rec.phone.mode).toContain('长曝光');
    expect(rec.filters.map(f => f.name).join(',')).toContain('ND');
    expect(rec.exposureTable[0].scene).toContain('丝绸云海');
    expect(rec.timeline.length).toBeGreaterThan(5);
    expect(rec.composition.join('')).toContain('云海');
    expect(rec.summary).toContain('极佳');
  });

  test('夜间、蓝调、大风和低分场景给出不同参数', () => {
    const night = photo.generatePhotoRecommendations({ timeString: '2026-06-01T23:30:00+08:00', sunriseTime: '2026-06-01T06:00:00+08:00', sunsetTime: '2026-06-01T18:30:00+08:00', cloudCover: 10, visibility: 30000, windSpeed: 1, cloudSeaScore: 30, elevation: 100 });
    expect(night.camera.shutter).toBe('15s - 30s');
    expect(night.phone.mode).toBe('夜景模式');
    expect(night.exposureTable.some(row => row.scene.includes('夜景'))).toBe(true);
    const windy = photo.generatePhotoRecommendations({ timeString: '2026-06-01T19:10:00+08:00', sunriseTime: '2026-06-01T06:00:00+08:00', sunsetTime: '2026-06-01T18:30:00+08:00', cloudCover: 90, visibility: 1000, windSpeed: 12, cloudSeaScore: CLOUD_SEA_GO + 5, elevation: 500 });
    expect(windy.camera.shutter).toContain('1/125s');
    expect(windy.filters.some(f => f.name.includes('UV'))).toBe(true);
    expect(windy.summary).toContain('风大');
    const plain = photo.generatePhotoRecommendations({ timeString: '2026-06-01T12:00:00+08:00', cloudCover: 20, visibility: 10000, windSpeed: 4, cloudSeaScore: 20, elevation: 0 });
    expect(plain.celestial).toBeNull();
    expect(plain.timeline).toEqual([]);
    expect(plain.summary).toContain('概率偏低');
  });
});
