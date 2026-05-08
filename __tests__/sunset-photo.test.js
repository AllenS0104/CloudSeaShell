/**
 * Tests for sunset.js glow prediction module
 */

const mod = require('../miniprogram/utils/sunset');

describe('analyzeGlowSample', () => {
  const idealSunset = {
    cloudCoverMid: 50,
    cloudCoverHigh: 40,
    cloudCoverLow: 10,
    humidity: 55,
    visibility: 20000,
    precipitationProbability: 0,
    precipitationAmount: 0,
    timeString: '2026-04-20T18:00:00',
    sunriseTime: '2026-04-20T05:30:00',
    sunsetTime: '2026-04-20T18:15:00',
  };

  test('ideal sunset conditions yield high score', () => {
    const r = mod.analyzeGlowSample(idealSunset);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.level).toMatch(/high|medium/);
  });

  test('overcast low clouds yield lower score', () => {
    const ideal = mod.analyzeGlowSample(idealSunset);
    const r = mod.analyzeGlowSample({ ...idealSunset, cloudCoverLow: 90, cloudCoverMid: 10 });
    expect(r.score).toBeLessThan(ideal.score);
  });

  test('no mid/high clouds yield lower score', () => {
    const ideal = mod.analyzeGlowSample(idealSunset);
    const r = mod.analyzeGlowSample({ ...idealSunset, cloudCoverMid: 2, cloudCoverHigh: 2 });
    expect(r.score).toBeLessThan(ideal.score);
  });

  test('midday time scores lower than sunset time', () => {
    const atSunset = mod.analyzeGlowSample(idealSunset);
    const r = mod.analyzeGlowSample({ ...idealSunset, timeString: '2026-04-20T12:00:00' });
    expect(r.score).toBeLessThan(atSunset.score);
  });

  test('returns reasons array', () => {
    const r = mod.analyzeGlowSample(idealSunset);
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  test('handles null inputs gracefully', () => {
    const r = mod.analyzeGlowSample({});
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('photography timeline & ND', () => {
  const photoMod = require('../miniprogram/utils/photography');

  test('golden sunrise detected correctly', () => {
    const r = photoMod.getLightingPhase('2026-04-20T05:35:00', '2026-04-20T05:30:00', '2026-04-20T18:15:00');
    expect(r.phase).toBe('golden-sunrise');
  });

  test('blue hour morning detected', () => {
    const r = photoMod.getLightingPhase('2026-04-20T04:15:00', '2026-04-20T05:30:00', '2026-04-20T18:15:00');
    expect(r.phase).toBe('blue-hour-morning');
  });

  test('photo recommendations include timeline', () => {
    const r = photoMod.generatePhotoRecommendations({
      timeString: '2026-04-20T05:30:00',
      sunriseTime: '2026-04-20T05:30:00',
      sunsetTime: '2026-04-20T18:15:00',
      cloudCover: 50, visibility: 15000, windSpeed: 3,
      cloudSeaScore: 70, elevation: 1800,
    });
    expect(r.timeline.length).toBeGreaterThan(0);
    expect(r.ndCalc).toBeDefined();
    expect(r.timelapse).toBeDefined();
    expect(r.timelapse.interval).toBeDefined();
  });

  test('altitude adjusts EV upward', () => {
    const low = photoMod.generatePhotoRecommendations({
      timeString: '2026-04-20T12:00:00',
      sunriseTime: '2026-04-20T05:30:00', sunsetTime: '2026-04-20T18:15:00',
      cloudCover: 20, visibility: 15000, windSpeed: 3,
      cloudSeaScore: 50, elevation: 100,
    });
    const high = photoMod.generatePhotoRecommendations({
      timeString: '2026-04-20T12:00:00',
      sunriseTime: '2026-04-20T05:30:00', sunsetTime: '2026-04-20T18:15:00',
      cloudCover: 20, visibility: 15000, windSpeed: 3,
      cloudSeaScore: 50, elevation: 3000,
    });
    expect(high.ev).toBeGreaterThan(low.ev);
  });
});
