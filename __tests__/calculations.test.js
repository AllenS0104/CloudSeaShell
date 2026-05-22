/**
 * Unit tests for the cloud-sea prediction algorithm (calculations.js)
 *
 * These tests verify the core scoring functions, cloud base calculation,
 * inversion detection, and end-to-end analysis pipeline.
 */

// We test the module by importing its source directly.
// The embedded web app uses ES modules, so we configure Jest to handle them.

const path = require('path');

// Source of truth: shared/core/calculations.js (CommonJS).
// The Android assets and web bundle are synced from this file via `npm run sync:shared`.
const calc = require(path.join('..', 'shared', 'core', 'calculations.js'));

// ─── Cloud Base ─────────────────────────────────────────────

describe('cloudBaseFromDewPoint', () => {
  test('returns 0 when T equals Td (saturated)', () => {
    expect(calc.cloudBaseFromDewPoint(15, 15)).toBe(0);
  });

  test('returns 125m per degree of T-Td spread', () => {
    expect(calc.cloudBaseFromDewPoint(20, 18)).toBe(250);
    expect(calc.cloudBaseFromDewPoint(20, 16)).toBe(500);
  });

  test('handles NaN inputs gracefully', () => {
    expect(calc.cloudBaseFromDewPoint(NaN, 10)).toBe(0);
    expect(calc.cloudBaseFromDewPoint(10, NaN)).toBe(1250);
  });
});

describe('cloudBaseFromHumidity', () => {
  test('100% humidity gives 0m cloud base', () => {
    expect(calc.cloudBaseFromHumidity(20, 100)).toBe(0);
  });

  test('50% humidity gives ~1250m cloud base', () => {
    expect(calc.cloudBaseFromHumidity(20, 50)).toBe(1250);
  });

  test('handles edge case of 0% humidity', () => {
    const result = calc.cloudBaseFromHumidity(20, 0);
    expect(result).toBe(2500);
  });
});

// ─── Inversion Detection ────────────────────────────────────

describe('scoreInversion', () => {
  test('no inversion when temperatures decrease', () => {
    const result = calc.scoreInversion([15, 14, 13, 12, 11]);
    expect(result.detected).toBe(false);
    expect(result.score).toBe(0);
  });

  test('detects weak inversion (1-3°C)', () => {
    const result = calc.scoreInversion([10, 9, 11, 10, 9]);
    expect(result.detected).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(8);
    expect(result.strength).toBe(2);
  });

  test('detects strong inversion (≥3°C)', () => {
    const result = calc.scoreInversion([5, 4, 8, 7, 6]);
    expect(result.detected).toBe(true);
    expect(result.score).toBe(8);
    expect(result.strength).toBe(4);
  });

  test('handles insufficient data', () => {
    expect(calc.scoreInversion([10])).toEqual({ score: 0, detected: false, strength: 0 });
    expect(calc.scoreInversion(null)).toEqual({ score: 0, detected: false, strength: 0 });
  });
});

// ─── Score to Confidence ────────────────────────────────────

describe('scoreToConfidence', () => {
  test('high confidence at 75+', () => {
    expect(calc.scoreToConfidence(80).level).toBe('high');
    expect(calc.scoreToConfidence(75).level).toBe('high');
  });

  test('medium confidence at 55-74', () => {
    expect(calc.scoreToConfidence(60).level).toBe('medium');
  });

  test('low confidence at 35-54', () => {
    expect(calc.scoreToConfidence(40).level).toBe('low');
  });

  test('very-low confidence below 35', () => {
    expect(calc.scoreToConfidence(20).level).toBe('very-low');
    expect(calc.scoreToConfidence(0).level).toBe('very-low');
  });

  test('clamps extreme values', () => {
    expect(calc.scoreToConfidence(150).level).toBe('high');
    expect(calc.scoreToConfidence(-10).level).toBe('very-low');
  });
});

// ─── End-to-end Analysis ────────────────────────────────────

describe('analyzeCloudSeaSample', () => {
  const idealConditions = {
    temperature: 8,
    humidity: 98,
    visibility: 15000,
    cloudCover: 60,
    lowCloudCover: 70,
    windSpeed: 2,
    dewPoint: 7.5,
    pressureMsl: 1020,
    precipitationProbability: 0,
    precipitationAmount: 0,
    elevation: 1800,
    timeString: '2026-04-20T06:00:00',
    sunriseTime: '2026-04-20T06:15:00',
    inversionScore: 8,
  };

  test('ideal conditions yield high score', () => {
    const result = calc.analyzeCloudSeaSample(idealConditions);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.suggestion).toBe(true);
  });

  test('poor conditions yield low score', () => {
    const result = calc.analyzeCloudSeaSample({
      temperature: 30,
      humidity: 30,
      visibility: 1000,
      cloudCover: 10,
      lowCloudCover: 5,
      windSpeed: 20,
      dewPoint: 10,
      pressureMsl: 990,
      precipitationProbability: 90,
      precipitationAmount: 5,
      elevation: 100,
      timeString: '2026-04-20T14:00:00',
      sunriseTime: '2026-04-20T06:15:00',
    });
    expect(result.score).toBeLessThan(35);
    expect(result.suggestion).toBe(false);
  });

  test('cloud base uses dewpoint when available', () => {
    const result = calc.analyzeCloudSeaSample({
      ...idealConditions,
      temperature: 10,
      dewPoint: 8,
    });
    // Cloud base should be 125 * (10 - 8) = 250m
    expect(result.cloudBase).toBe(250);
  });

  test('returns reasons array', () => {
    const result = calc.analyzeCloudSeaSample(idealConditions);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.length).toBeLessThanOrEqual(5);
  });

  test('handles all-null inputs without crashing', () => {
    const result = calc.analyzeCloudSeaSample({
      elevation: 0,
    });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Utility functions ──────────────────────────────────────

describe('dewPointSpread', () => {
  test('returns correct spread', () => {
    expect(calc.dewPointSpread(20, 15)).toBe(5);
    expect(calc.dewPointSpread(10, 10)).toBe(0);
  });
});

describe('windDirection', () => {
  test('returns correct cardinal direction', () => {
    expect(calc.windDirection(0)).toBe('北风');
    expect(calc.windDirection(90)).toBe('东风');
    expect(calc.windDirection(180)).toBe('南风');
    expect(calc.windDirection(270)).toBe('西风');
  });
});

describe('formatDistanceKm', () => {
  test('converts meters to km', () => {
    expect(calc.formatDistanceKm(5000)).toBe('5.0 km');
    expect(calc.formatDistanceKm(12345)).toBe('12.3 km');
  });
});
