/**
 * Regression test: web renderers must read the field names the core scorers
 * actually return.
 *
 * Two bugs of this shape shipped to the phone:
 *   - renderStarStats() read `star.moonPhaseLabel || star.moonPhase`, but
 *     scoreStargazing() returns moonPhase as an object, so the stat card
 *     showed literally "[object Object]".
 *   - renderHourly() emits `.hourly-row`, but style.css only styled
 *     `.hour-item` (a miniprogram class name). The rule never matched, the
 *     row was not a flexbox, and all four columns stacked vertically with
 *     nothing lining up under its header.
 *
 * Both are invisible to unit tests of the core modules, so assert the
 * cross-file contracts directly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(ROOT, 'web', 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'web', 'css', 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const stargazing = require(path.join(ROOT, 'shared', 'core', 'stargazing.js'));

function sampleStar() {
  return stargazing.scoreStargazing({
    date: new Date('2026-07-31T22:00:00Z'),
    latitude: 40.0,
    cloudCover: 20,
    visibility: 20000,
    humidity: 55,
    elevation: 1200,
  });
}

describe('stargazing render contract', () => {
  test('moonPhase is an object, so it must never be rendered directly', () => {
    const star = sampleStar();
    expect(typeof star.moonPhase).toBe('object');
    expect(typeof star.moonPhase.name).toBe('string');
    expect(String(star.moonPhase)).toBe('[object Object]');
  });

  test('renderStarStats renders the phase name, not the raw object', () => {
    const body = appSrc.slice(appSrc.indexOf('function renderStarStats'));
    const fn = body.slice(0, body.indexOf('\n  function ', 1));
    expect(fn).toMatch(/\bmoon(Phase)?\.name\b/);
    // the old buggy expression must be gone
    expect(fn).not.toContain('star.moonPhaseLabel || star.moonPhase');
  });

  test('the illumination field name matches what the scorer returns', () => {
    const star = sampleStar();
    expect(star).toHaveProperty('moonIllum');
    expect(star.moonIllumination).toBeUndefined();
    expect(appSrc).toContain('star.moonIllum');
    expect(appSrc).not.toContain('star.moonIllumination');
  });
});

describe('hourly timeline layout contract', () => {
  const rowClasses = ['hourly-row', 'hourly-col-time', 'hourly-col-temp',
    'hourly-col-cloud', 'hourly-col-precip'];

  test('every class emitted by renderHourly is styled', () => {
    const body = appSrc.slice(appSrc.indexOf("'<div class=\"hourly-row\">'"));
    const emitted = [...body.slice(0, 600).matchAll(/class="(hourly-[a-z-]+)"/g)]
      .map((m) => m[1]);
    expect(emitted).toEqual(expect.arrayContaining(rowClasses));
    emitted.forEach((cls) => {
      expect(css).toContain(`.${cls}`);
    });
  });

  test('rows are a flexbox so columns sit side by side', () => {
    const rule = css.slice(css.indexOf('.hourly-row {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('display: flex');
  });

  test('header and rows share the same column classes, so they cannot drift', () => {
    const header = html.slice(html.indexOf('class="hourly-header"'));
    const headerCols = [...header.slice(0, 500).matchAll(/class="(hourly-col-[a-z]+)"/g)]
      .map((m) => m[1]);
    expect(headerCols).toEqual(rowClasses.slice(1));
  });

  test('no dead miniprogram-only row styles are left in the web stylesheet', () => {
    expect(css).not.toMatch(/^\.hour-item\b/m);
    expect(css).not.toMatch(/^\.hour-time\b/m);
    expect(css).not.toMatch(/^\.hour-value\b/m);
  });
});
