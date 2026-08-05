/**
 * Tests for camera-presets.js — device database integrity + recommendations
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'camera-presets.js'), 'utf-8');
const cjs = src.replace(/^module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m, '');
// 该模块 require('./thresholds')，沙箱里没有模块系统，注入一个最小 require 垫片。
const requireShim = (name) => require(path.join(__dirname, '..', 'miniprogram', 'utils', name));
const mod = new Function('require', `${cjs}\nreturn { CAMERA_PRESETS, PHONE_PRESETS, getCameraRecommendation, getPhoneRecommendation, getAllCameraPresets, getAllPhonePresets };`)(requireShim);

// ─── Database Integrity ─────────────────────────────────────

describe('CAMERA_PRESETS integrity', () => {
  const entries = Object.entries(mod.CAMERA_PRESETS);

  test('has at least 8 cameras', () => {
    expect(entries.length).toBeGreaterThanOrEqual(8);
  });

  test.each(entries)('%s has required fields', (id, preset) => {
    expect(preset.brand).toBeDefined();
    expect(preset.model).toBeDefined();
    expect(preset.sensor).toMatch(/full-frame|APS-C/);
    expect(preset.coc).toBeGreaterThan(0);
    expect(preset.nativeISO).toHaveLength(2);
    expect(preset.bestISO).toBeGreaterThan(0);
    expect(Object.keys(preset.lenses).length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(preset.tips)).toBe(true);
  });

  test.each(entries)('%s lenses have specs', (id, preset) => {
    Object.entries(preset.lenses).forEach(([name, spec]) => {
      expect(spec.focal).toHaveLength(2);
      expect(spec.maxAperture).toBeGreaterThan(0);
      expect(typeof spec.bestLandscape).toBe('string');
      expect(typeof spec.note).toBe('string');
    });
  });
});

describe('PHONE_PRESETS integrity', () => {
  const entries = Object.entries(mod.PHONE_PRESETS);

  test('has at least 8 phones', () => {
    expect(entries.length).toBeGreaterThanOrEqual(8);
  });

  test.each(entries)('%s has required fields', (id, preset) => {
    expect(preset.brand).toBeDefined();
    expect(preset.model).toBeDefined();
    expect(Array.isArray(preset.lenses)).toBe(true);
    expect(preset.lenses.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(preset.features)).toBe(true);
    expect(typeof preset.timelapse).toBe('string');
  });

  test.each(entries)('%s lenses have focal and aperture', (id, preset) => {
    preset.lenses.forEach(lens => {
      expect(lens.name).toBeDefined();
      expect(lens.focal).toBeGreaterThan(0);
      expect(lens.aperture).toBeGreaterThan(0);
      expect(typeof lens.bestFor).toBe('string');
    });
  });
});

// ─── Camera Recommendations ────────────────────────────────

describe('getCameraRecommendation', () => {
  const lighting = { phase: 'golden-sunrise' };

  test('returns recommendation for valid camera', () => {
    const r = mod.getCameraRecommendation('canon-5d4', 12, lighting, 3, 70);
    expect(r).not.toBeNull();
    expect(r.brand).toBe('Canon');
    expect(r.model).toBe('5D Mark IV');
    expect(r.lens).toBeDefined();
    expect(r.aperture).toBeDefined();
    expect(r.iso).toBeDefined();
  });

  test('returns null for unknown camera', () => {
    expect(mod.getCameraRecommendation('nonexistent', 12, lighting, 3, 70)).toBeNull();
  });

  test('recommends wide angle for cloud sea', () => {
    const r = mod.getCameraRecommendation('sony-a7r5', 12, lighting, 3, 80);
    expect(r.lens).toMatch(/16-35|14-24|15-35/);
  });

  test('suggests alt telephoto lens for cloud sea', () => {
    const r = mod.getCameraRecommendation('sony-a7r5', 12, lighting, 3, 80);
    expect(r.altLens).not.toBeNull();
    expect(r.altLens.name).toMatch(/70-200|100-/);
  });

  test('night mode uses max aperture + high ISO', () => {
    const r = mod.getCameraRecommendation('canon-r5', 4, { phase: 'night' }, 2, 30);
    expect(r.aperture).toMatch(/f\/2\.8/);
    expect(r.shutter).toMatch(/15|30/);
  });
});

// ─── Phone Recommendations ─────────────────────────────────

describe('getPhoneRecommendation', () => {
  const lighting = { phase: 'golden-sunrise' };

  test('returns recommendation with pro settings', () => {
    const r = mod.getPhoneRecommendation('iphone-16pro', 70, lighting, 3);
    expect(r).not.toBeNull();
    expect(r.brand).toBe('Apple');
    expect(r.mode).toBeDefined();
    expect(r.proSettings).toBeDefined();
    expect(r.proSettings.iso).toBeDefined();
    expect(r.proSettings.shutter).toBeDefined();
  });

  test('returns null for unknown phone', () => {
    expect(mod.getPhoneRecommendation('nonexistent', 50, lighting, 3)).toBeNull();
  });

  test('cloud sea recommends ultra-wide as primary', () => {
    const r = mod.getPhoneRecommendation('iphone-16pro', 80, lighting, 3);
    expect(r.primaryLens.focal).toBeLessThanOrEqual(15);
  });

  test('night mode for night conditions', () => {
    const r = mod.getPhoneRecommendation('huawei-p70pro', 30, { phase: 'night' }, 2);
    expect(r.mode).toMatch(/夜景/);
  });

  test('all presets return valid recommendations', () => {
    const allPhones = mod.getAllPhonePresets();
    allPhones.forEach(p => {
      const r = mod.getPhoneRecommendation(p.id, 50, lighting, 3);
      expect(r).not.toBeNull();
      expect(r.model).toBeDefined();
    });
  });

  test('all camera presets return valid recommendations', () => {
    const allCameras = mod.getAllCameraPresets();
    allCameras.forEach(c => {
      const r = mod.getCameraRecommendation(c.id, 12, lighting, 3, 50);
      expect(r).not.toBeNull();
      expect(r.model).toBeDefined();
    });
  });
});
