/**
 * Behavioural check for the map gestures, kept out of the Jest suite because
 * it needs jsdom (a heavy dep the project does not otherwise carry).
 *
 *   npm install --no-save jsdom && node scripts/verify-map-gestures.js
 *
 * It loads the real Leaflet, builds the map with exactly the options
 * web/js/map.js uses on a touch device, dispatches a genuine two-finger pan
 * and asserts the map actually moved. This is the only way to prove the
 * gesture works: `adb shell input swipe` is single-touch, `sendevent` needs
 * root, and the release APK has no WebView debugging.
 *
 * Last run (2026-07-31, Leaflet 1.9.x):
 *   container classes: leaflet-container leaflet-touch leaflet-touch-zoom
 *   dragging enabled: false      <- single finger scrolls the page
 *   touchZoom enabled: true
 *   center 40.00000,116.30000 -> 39.93659,116.29990 at an unchanged zoom 11
 *   RESULT: two-finger PAN WORKS with dragging disabled
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is required: npm install --no-save jsdom');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const leafletJs = fs.readFileSync(
  path.join(ROOT, 'web', 'vendor', 'leaflet', 'leaflet.js'), 'utf8');

const dom = new JSDOM(
  '<!doctype html><html><body><div id="map" style="width:400px;height:500px"></div></body></html>',
  { pretendToBeVisual: true, runScripts: 'outside-only' }
);
const { window } = dom;

// Make Leaflet take its touch code path.
window.ontouchstart = null;
Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5 });

// jsdom has no layout, so give the container a real size.
window.HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.id === 'map' || this.classList.contains('leaflet-container')) {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 500, width: 400, height: 500 };
  }
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
};
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 400; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 500; } });
// Leaflet's getMousePosition divides rect.width by offsetWidth; jsdom reports
// 0, which makes both finger positions collapse to (0,0) and _startDist NaN.
Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return 400; } });
Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get() { return 500; } });
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);

window.eval(leafletJs);
const L = window.L;

const isTouch = ('ontouchstart' in window) || window.navigator.maxTouchPoints > 0;
console.log('isTouch detected:', isTouch);

const map = L.map('map', {
  // exactly what web/js/map.js passes
  dragging: !isTouch,
  touchZoom: true,
  scrollWheelZoom: false,
  zoomAnimation: false,
  fadeAnimation: false,
  inertia: false,
}).setView([40.0, 116.3], 11);

const container = map.getContainer();
console.log('container classes:', container.className);
console.log('dragging enabled:', map.dragging.enabled());
console.log('touchZoom enabled:', map.touchZoom.enabled());

function touch(id, x, y) {
  return { identifier: id, clientX: x, clientY: y, pageX: x, pageY: y, target: container };
}
function fire(type, touches, target) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true });
  ev.touches = touches;
  ev.targetTouches = touches;
  ev.changedTouches = touches;
  (target || container).dispatchEvent(ev);
}

const before = map.getCenter();
console.log('center before:', before.lat.toFixed(5), before.lng.toFixed(5));

// Two fingers down, then moved together by (0, -120): a pure pan, pinch ratio 1.
fire('touchstart', [touch(0, 150, 400), touch(1, 250, 400)]);
for (let i = 1; i <= 12; i++) {
  const y = 400 - i * 10;
  fire('touchmove', [touch(0, 150, y), touch(1, 250, y)], window.document);
}
fire('touchend', [], window.document);

setTimeout(() => {
  const after = map.getCenter();
  console.log('center after: ', after.lat.toFixed(5), after.lng.toFixed(5));
  const moved = Math.abs(after.lat - before.lat) > 1e-6 || Math.abs(after.lng - before.lng) > 1e-6;
  console.log('zoom before/after:', 11, map.getZoom());
  console.log(moved
    ? 'RESULT: two-finger PAN WORKS with dragging disabled'
    : 'RESULT: FAILED - map did not move');
  process.exit(moved ? 0 : 1);
}, 200);
