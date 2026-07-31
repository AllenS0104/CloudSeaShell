/**
 * Regression test: the map must not swallow the page's vertical scroll.
 *
 * Leaflet's own stylesheet sets `touch-action: none` on
 * `.leaflet-touch-drag.leaflet-touch-zoom`, which is the class combination
 * applied when dragging and touchZoom are both enabled (the Leaflet default).
 * With a 52vh map that made the report unscrollable on a phone — swipes over
 * the map panned the map instead of the page, and screen recordings got stuck
 * at the map.
 *
 * The fix keeps dragging disabled on touch devices and turns it on only while
 * two fingers are down. Leaflet toggles `leaflet-touch-drag` in the drag
 * handler's addHooks/removeHooks, so that also toggles `touch-action`.
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
  test('the vendored Leaflet still has the touch-action trap this guards against', () => {
    // If a Leaflet upgrade drops this rule the workaround can be revisited.
    const normalized = leafletCss.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      '.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom { -ms-touch-action: none; touch-action: none;'
    );
  });

  test('Leaflet toggles leaflet-touch-drag when dragging is enabled/disabled', () => {
    // The fix relies on this being dynamic rather than set once at init.
    expect(leafletJs).toContain('leaflet-grab leaflet-touch-drag');
    expect(leafletJs).toContain('"leaflet-touch-drag"');
  });

  test('dragging is disabled on touch devices at init', () => {
    expect(mapSrc).toContain('dragging: !isTouch');
    expect(mapSrc).toMatch(/ontouchstart.*maxTouchPoints/s);
  });

  test('dragging is enabled only for two-finger gestures', () => {
    expect(mapSrc).toContain('e.touches.length >= 2');
    expect(mapSrc).toContain('map.dragging.enable()');
    expect(mapSrc).toContain('map.dragging.disable()');
    // and released again when a finger lifts
    expect(mapSrc).toContain('e.touches.length < 2');
    expect(mapSrc).toContain('touchcancel');
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
