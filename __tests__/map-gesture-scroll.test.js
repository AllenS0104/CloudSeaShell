/**
 * Regression test: the map must not swallow the page's vertical scroll.
 *
 * Leaflet's own stylesheet derives touch-action from the enabled handlers:
 *   dragging + touchZoom -> `none`          (the map eats every swipe)
 *   touchZoom only       -> `pan-x pan-y`   (the browser scrolls the page)
 *
 * With Leaflet's defaults a 52vh map made the report unscrollable on a
 * phone — swipes over the map panned the map instead of the page, and screen
 * recordings got stuck at the map.
 *
 * The fix leaves dragging off on touch devices. That costs nothing, because
 * Leaflet's TouchZoom handler already pans as well as zooms and binds on the
 * touchstart that lands the second finger, so two-finger panning is
 * immediate. Toggling dragging at runtime would NOT work: touch-action is
 * latched when a gesture starts.
 *
 * Verified behaviourally with scripts/verify-map-gestures.js, which drives
 * the real Leaflet in jsdom: with dragging off, a two-finger pan moved the
 * center 40.00000,116.30000 -> 39.93659,116.29990 at an unchanged zoom, and
 * the container carried only `leaflet-touch-zoom` (touch-action:
 * `pan-x pan-y`, so the page still scrolls). The assertions below are the
 * cheap always-on guards for the same contract.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mapSrc = fs.readFileSync(path.join(ROOT, 'web', 'js', 'map.js'), 'utf8');
const leafletCss = fs.readFileSync(
  path.join(ROOT, 'web', 'vendor', 'leaflet', 'leaflet.css'), 'utf8'
);
const leafletJs = fs.readFileSync(
  path.join(ROOT, 'web', 'vendor', 'leaflet', 'leaflet.js'), 'utf8'
);

describe('map gesture handling', () => {
  test('Leaflet drives touch-action from the enabled handlers', () => {
    const normalized = leafletCss.replace(/\s+/g, ' ');
    // dragging + touchZoom => the map eats every swipe (the original bug)
    expect(normalized).toContain(
      '.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom { -ms-touch-action: none; touch-action: none;'
    );
    // touchZoom alone => the browser still scrolls the page
    expect(normalized).toContain(
      '.leaflet-container.leaflet-touch-zoom { -ms-touch-action: pan-x pan-y; touch-action: pan-x pan-y;'
    );
  });

  test("Leaflet's TouchZoom pans as well as zooms, so two fingers move the map", () => {
    // _onTouchMove shifts the map by the delta of the two-finger midpoint,
    // and only bails out when the pinch ratio is 1 AND the midpoint is still.
    // That is what makes two-finger panning work with dragging disabled.
    expect(leafletJs).toContain('_pinchStartLatLng');
    expect(leafletJs).toMatch(/1==o&&0===i\.x&&0===i\.y\)return/);
    // and it binds on the touchstart that lands the second finger
    expect(leafletJs).toMatch(/2!==t\.touches\.length/);
  });

  test('dragging is disabled on touch devices, touchZoom stays on', () => {
    expect(mapSrc).toContain('dragging: !isTouch');
    expect(mapSrc).toContain('touchZoom: true');
    expect(mapSrc).toMatch(/ontouchstart.*maxTouchPoints/s);
  });

  test('nothing toggles dragging at runtime, which would relatch the trap', () => {
    // touch-action is latched when a gesture begins, so enabling dragging
    // mid-gesture cannot help — and a missed touchend would leave the map
    // eating single-finger swipes again.
    expect(mapSrc).not.toContain('dragging.enable()');
    expect(mapSrc).not.toContain('dragging.disable()');
  });

  test('a bare mouse wheel does not zoom, so the page can scroll', () => {
    expect(mapSrc).toContain('scrollWheelZoom: false');
    expect(mapSrc).toContain('e.ctrlKey || e.metaKey');
  });

  test('no stylesheet forces touch-action back on, which would break two-finger pan', () => {
    const appCss = fs.readFileSync(path.join(ROOT, 'web', 'css', 'style.css'), 'utf8');
    expect(appCss).not.toMatch(/leaflet-touch-drag[^{]*\{[^}]*touch-action/s);
  });

  test('the map hint tells the user how to scroll and how to pan', () => {
    const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
    const hint = html.slice(html.indexOf('id="map-hint"'));
    const text = hint.slice(0, hint.indexOf('</div>'));
    expect(text).toContain('单指');
    expect(text).toContain('双指');
  });
});
