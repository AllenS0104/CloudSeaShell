/**
 * map.js — Leaflet 地图初始化与控制
 * 提供：4 层切换（高德 / 地形 / 卫星 / CARTO），标记，点击回调
 * 暴露：window.CloudSea.map = { init, setLocation, onSelect }
 */
(function(global) {
  'use strict';
  var CS = global.CloudSea = global.CloudSea || {};

  var mapInstance = null;
  var markerInstance = null;
  var clickHandler = null;

  function init(opts) {
    var L = global.L;
    if (!L) {
      console.error('[map] Leaflet not loaded');
      return null;
    }

    var lat = (opts && opts.lat) || 39.9042;
    var lon = (opts && opts.lon) || 116.4074;
    var zoom = (opts && opts.zoom) || 9;

    // 4 base layers — 高德优先（中文标注，国内可用）
    var gaode = L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      { subdomains: ['1','2','3','4'], attribution: '高德地图', maxZoom: 18 }
    );
    var gaodeSat = L.tileLayer(
      'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      { subdomains: ['1','2','3','4'], attribution: '高德卫星', maxZoom: 18 }
    );
    var topo = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      { attribution: 'OpenTopoMap (户外地形)', maxZoom: 17 }
    );
    var esriSat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri 高清卫星', maxZoom: 19 }
    );
    var carto = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: 'CARTO (英文简洁)', subdomains: 'abcd', maxZoom: 19 }
    );

    var baseLayers = {
      '高德地图 (中文)': gaode,
      '高德卫星 (中文)': gaodeSat,
      '地形图 (户外)': topo,
      '高清卫星图 (Esri)': esriSat,
      '简洁地图 (英文)': carto,
    };

    var isTouch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);

    mapInstance = L.map('map', {
      layers: [gaode],
      zoomControl: true,
      attributionControl: true,
      // On touch devices Leaflet's own CSS sets `touch-action: none` on the
      // container whenever dragging + touchZoom are both active. That makes
      // the map swallow every vertical swipe, so the page (and screen
      // recordings) get stuck at the map and you cannot scroll past it.
      // Leaflet adds/removes `leaflet-touch-drag` in the drag handler's
      // addHooks/removeHooks, so toggling dragging also toggles touch-action:
      // off => `pan-x pan-y` (page scrolls), on => `none` (map pans).
      // Dragging is therefore turned on only for two-finger gestures.
      dragging: !isTouch,
      // A bare wheel should scroll the page; Ctrl/⌘ + wheel zooms the map.
      scrollWheelZoom: false,
    }).setView([lat, lon], zoom);

    if (isTouch) enableTwoFingerPan(mapInstance);
    enableCtrlWheelZoom(mapInstance);

    L.control.layers(baseLayers, null, { position: 'topright', collapsed: true }).addTo(mapInstance);

    markerInstance = L.circleMarker([lat, lon], {
      radius: 15,
      color: '#ffffff',
      weight: 4,
      fillColor: '#ff3b30',
      fillOpacity: 1,
      opacity: 1,
      bubblingMouseEvents: false,
    }).addTo(mapInstance);
    markerInstance.bringToFront();

    mapInstance.on('click', function(e) {
      if (typeof clickHandler === 'function') {
        clickHandler({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    });

    scheduleInvalidateSize();

    return mapInstance;
  }

  /**
   * Pan the map only while two fingers are down. A single finger keeps its
   * default behaviour (scrolling the page), which is what makes the rest of
   * the report reachable on a phone.
   */
  function enableTwoFingerPan(map) {
    var container = map.getContainer();
    if (!container) return;

    map.dragging.disable();

    container.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches.length >= 2) {
        map.dragging.enable();
        setHint('twoFinger');
      }
    }, { passive: true });

    var release = function(e) {
      if (!e.touches || e.touches.length < 2) map.dragging.disable();
    };
    container.addEventListener('touchend', release, { passive: true });
    container.addEventListener('touchcancel', release, { passive: true });
  }

  /** Ctrl/⌘ + wheel zooms; a bare wheel is left alone so the page scrolls. */
  function enableCtrlWheelZoom(map) {
    var container = map.getContainer();
    if (!container) return;

    container.addEventListener('wheel', function(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var delta = e.deltaY < 0 ? 1 : -1;
      map.setZoom(map.getZoom() + delta);
    }, { passive: false });
  }

  /** Swap the hint text once the user has discovered the gesture. */
  function setHint(state) {
    var el = global.document && global.document.getElementById('map-hint');
    if (!el) return;
    if (state === 'twoFinger') {
      el.textContent = '💡 点击地图任意位置可定位';
      el.classList.add('fade');
    }
  }

  function setLocation(lat, lon, opts) {
    if (!mapInstance) return;
    var zoom = (opts && opts.zoom) || mapInstance.getZoom() || 11;
    mapInstance.setView([lat, lon], zoom);
    if (markerInstance) {
      markerInstance.setLatLng([lat, lon]);
      markerInstance.bringToFront();
    }
    scheduleInvalidateSize();
  }

  function setMarkerPopup(html) {
    if (!markerInstance) return;
    markerInstance.bindPopup(html);
  }

  function onSelect(fn) { clickHandler = fn; }

  function invalidateSize() {
    if (mapInstance) {
      try { mapInstance.invalidateSize(); } catch(_) {}
    }
  }

  function scheduleInvalidateSize() {
    [80, 250, 600].forEach(function(delay) {
      setTimeout(invalidateSize, delay);
    });
  }

  CS.map = { init: init, setLocation: setLocation, setMarkerPopup: setMarkerPopup, onSelect: onSelect, invalidateSize: invalidateSize };
})(typeof window !== 'undefined' ? window : globalThis);
