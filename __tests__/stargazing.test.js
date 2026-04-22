/**
 * Tests for stargazing.js — moon phase, Milky Way, star visibility
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'stargazing.js'), 'utf-8');
const cjs = src.replace(/^module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m, '');
const mod = new Function(`${cjs}\nreturn { getMoonAge, getMoonIllumination, getMoonPhaseName, getMilkyWayVisibility, scoreStargazing, astroShutter, getAstroParams };`)();

// ─── Moon Phase ────────────────────────────────────────────

describe('getMoonAge', () => {
  test('returns value between 0 and 29.53', () => {
    const age = mod.getMoonAge(new Date('2026-04-22'));
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(29.54);
  });

  test('known new moon returns near 0', () => {
    // Jan 6 2000 was the reference new moon
    const age = mod.getMoonAge(new Date('2000-01-06T18:14:00Z'));
    expect(age).toBeLessThan(0.5);
  });

  test('full moon ~14.8 days after new moon', () => {
    const age = mod.getMoonAge(new Date('2000-01-21'));
    expect(age).toBeGreaterThan(13);
    expect(age).toBeLessThan(16);
  });

  test('handles string input', () => {
    const age = mod.getMoonAge('2026-06-15');
    expect(Number.isFinite(age)).toBe(true);
  });
});

describe('getMoonIllumination', () => {
  test('new moon = 0%', () => {
    expect(mod.getMoonIllumination(0)).toBe(0);
  });

  test('full moon = 100%', () => {
    expect(mod.getMoonIllumination(14.765)).toBe(100);
  });

  test('quarter moon ≈ 50%', () => {
    const illum = mod.getMoonIllumination(7.38);
    expect(illum).toBeGreaterThan(40);
    expect(illum).toBeLessThan(60);
  });
});

describe('getMoonPhaseName', () => {
  test('new moon', () => {
    expect(mod.getMoonPhaseName(0).name).toBe('新月');
    expect(mod.getMoonPhaseName(0).icon).toBe('🌑');
  });

  test('full moon', () => {
    expect(mod.getMoonPhaseName(14.8).name).toBe('满月');
    expect(mod.getMoonPhaseName(14.8).icon).toBe('🌕');
  });

  test('all 8 phases covered', () => {
    const ages = [0, 3, 8, 11, 15, 18, 22, 25];
    const names = ages.map(a => mod.getMoonPhaseName(a).name);
    expect(new Set(names).size).toBe(8);
  });
});

// ─── Milky Way ─────────────────────────────────────────────

describe('getMilkyWayVisibility', () => {
  test('June in China = peak season', () => {
    const r = mod.getMilkyWayVisibility('2026-06-15', 30);
    expect(r.coreVisible).toBe(true);
    expect(r.seasonScore).toBe(10);
  });

  test('December in China = non-core season', () => {
    const r = mod.getMilkyWayVisibility('2026-12-15', 30);
    expect(r.coreVisible).toBe(false);
    expect(r.seasonScore).toBeLessThanOrEqual(3);
  });

  test('returns bestHours string', () => {
    const r = mod.getMilkyWayVisibility('2026-07-15', 35);
    expect(typeof r.bestHours).toBe('string');
    expect(r.bestHours.length).toBeGreaterThan(0);
  });
});

// ─── Star Visibility Score ─────────────────────────────────

describe('scoreStargazing', () => {
  test('ideal conditions: new moon + clear + high altitude + MW season', () => {
    const r = mod.scoreStargazing({
      date: '2026-07-01', latitude: 30, cloudCover: 5,
      visibility: 25000, humidity: 30, elevation: 3000,
    });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.level).toMatch(/excellent|good/);
  });

  test('poor: full moon + overcast + low altitude scores lower than ideal', () => {
    const ideal = mod.scoreStargazing({
      date: '2026-07-01', latitude: 30, cloudCover: 5,
      visibility: 25000, humidity: 30, elevation: 3000,
    });
    const poor = mod.scoreStargazing({
      date: '2026-07-15', latitude: 30, cloudCover: 90,
      visibility: 2000, humidity: 90, elevation: 50,
    });
    expect(poor.score).toBeLessThan(ideal.score);
    expect(poor.score).toBeLessThan(40);
  });

  test('returns moonPhase and reasons', () => {
    const r = mod.scoreStargazing({ date: '2026-04-22', latitude: 35 });
    expect(r.moonPhase).toBeDefined();
    expect(r.moonPhase.icon).toBeDefined();
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  test('handles missing inputs gracefully', () => {
    const r = mod.scoreStargazing({});
    expect(Number.isFinite(r.score)).toBe(true);
  });
});

// ─── Astrophotography ──────────────────────────────────────

describe('astroShutter', () => {
  test('500 rule: 24mm full frame = ~20s', () => {
    const r = mod.astroShutter(24, 1);
    expect(parseInt(r.rule500)).toBeGreaterThanOrEqual(18);
    expect(parseInt(r.rule500)).toBeLessThanOrEqual(22);
  });

  test('APS-C crop factor reduces time', () => {
    const ff = mod.astroShutter(24, 1);
    const apsc = mod.astroShutter(24, 1.5);
    expect(parseInt(apsc.rule500)).toBeLessThan(parseInt(ff.rule500));
  });

  test('longer focal = shorter max shutter', () => {
    const wide = mod.astroShutter(14, 1);
    const tele = mod.astroShutter(50, 1);
    expect(parseInt(tele.rule500)).toBeLessThan(parseInt(wide.rule500));
  });
});

describe('getAstroParams', () => {
  test('good conditions recommend lower ISO', () => {
    const r = mod.getAstroParams(70, 24, 1);
    expect(r.iso).toContain('1600');
  });

  test('poor conditions recommend higher ISO', () => {
    const r = mod.getAstroParams(20, 24, 1);
    expect(r.iso).toContain('3200');
  });
});
