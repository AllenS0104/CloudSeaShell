/* SHARED CORE — single source of truth, do not edit per-end copies */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CloudSea = root.CloudSea || {};
    root.CloudSea.waypoints = api;
    root.CloudSeaCore = root.CloudSeaCore || {};
    root.CloudSeaCore.waypoints = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  function loadBundledWaypoints() {
    if (typeof require === 'function') {
      return require('../data/waypoints/index.json');
    }
    return root && root.CloudSeaWaypointData ? root.CloudSeaWaypointData : [];
  }

  function cloneWaypoint(waypoint) {
    return Object.assign({}, waypoint, {
      bestFor: Array.isArray(waypoint.bestFor) ? waypoint.bestFor.slice() : [],
      bestSeasons: Array.isArray(waypoint.bestSeasons) ? waypoint.bestSeasons.slice() : []
    });
  }

  const BASE_WAYPOINTS = loadBundledWaypoints().map(cloneWaypoint);
  const WAYPOINTS = BASE_WAYPOINTS.map(cloneWaypoint);

  const BEST_FOR_LABELS = {
    cloudsea: '云海',
    stargazing: '星空',
    sunset: '日落',
    sunrise: '日出'
  };

  function normalizeExtraWaypoints(extra) {
    if (!extra) return [];
    if (Array.isArray(extra)) return extra;
    if (Array.isArray(extra.waypoints)) return extra.waypoints;
    return [];
  }

  function loadWaypoints(extra) {
    const merged = new Map();
    BASE_WAYPOINTS.concat(normalizeExtraWaypoints(extra)).forEach(function(waypoint) {
      if (!waypoint || !waypoint.id) return;
      merged.set(waypoint.id, cloneWaypoint(waypoint));
    });
    WAYPOINTS.splice.apply(WAYPOINTS, [0, WAYPOINTS.length].concat(Array.from(merged.values())));
    return WAYPOINTS;
  }

  function toRad(value) {
    return value * Math.PI / 180;
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    const earthRadiusKm = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function normalizeLng(value) {
    return Number(value);
  }

  function findNearbyWaypoints(options) {
    const lat = Number(options && options.lat);
    const lng = normalizeLng(options && (options.lng ?? options.lon));
    const radiusKm = Number(options && options.radiusKm);
    const maxDistance = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 80;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    return WAYPOINTS
      .map(function(waypoint) {
        const distanceKm = haversineKm(lat, lng, waypoint.lat, waypoint.lng);
        return Object.assign({}, waypoint, { distanceKm: Math.round(distanceKm * 10) / 10 });
      })
      .filter(function(waypoint) { return waypoint.distanceKm <= maxDistance; })
      .sort(function(a, b) { return a.distanceKm - b.distanceKm; });
  }

  function getDirectionLabel(deg) {
    const n = ((Number(deg) % 360) + 360) % 360;
    const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return labels[Math.floor((n + 22.5) / 45) % 8];
  }

  function getBestForLabels(bestFor) {
    return (bestFor || []).map(function(key) { return BEST_FOR_LABELS[key] || key; });
  }

  function getBortleLightPollutionLabel(bortleClass) {
    const value = Number(bortleClass);
    if (!Number.isFinite(value)) return '未知';
    if (value <= 3) return '暗夜保护区';
    if (value <= 6) return '中等光污染';
    return '城市光污染重';
  }

  function estimateBortleClass(waypointOrLocation) {
    if (waypointOrLocation && Number.isFinite(Number(waypointOrLocation.bortleClass))) {
      return Number(waypointOrLocation.bortleClass);
    }
    const elevation = Number(waypointOrLocation && waypointOrLocation.elevation);
    const distanceKm = Number(waypointOrLocation && waypointOrLocation.distanceKm);
    if (Number.isFinite(elevation) && elevation > 1500 && (!Number.isFinite(distanceKm) || distanceKm > 20)) {
      return 6;
    }
    return null;
  }

  function getLightPollutionLabelForWaypoint(waypointOrLocation) {
    const estimated = estimateBortleClass(waypointOrLocation);
    return {
      bortleClass: estimated,
      label: estimated == null ? '未知' : getBortleLightPollutionLabel(estimated),
      estimated: !(waypointOrLocation && Number.isFinite(Number(waypointOrLocation.bortleClass))) && estimated != null
    };
  }

  function getCompassSvgDataUri(deg) {
    const n = ((Number(deg) % 360) + 360) % 360;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
      + '<circle cx="12" cy="12" r="10" fill="#0b2f5b" stroke="#3aa4ff" stroke-width="1.5"/>'
      + '<text x="12" y="6" text-anchor="middle" font-size="4" fill="#b8d8ff" font-family="Arial">N</text>'
      + '<g transform="rotate(' + n + ' 12 12)">'
      + '<path d="M12 3.5 L15 13 L12 11.5 L9 13 Z" fill="#ffcf5a"/>'
      + '<path d="M12 20.5 L9.8 12 L12 13.2 L14.2 12 Z" fill="#7fbfff" opacity="0.9"/>'
      + '</g></svg>';
    return 'data:image/svg+xml;base64,' + base64Encode(svg);
  }

  function base64Encode(text) {
    if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(text)));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; text.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
      charCode = text.charCodeAt(i += 3 / 4);
      if (charCode > 0xff) return '';
      block = block << 8 | charCode;
    }
    return output;
  }

  return {
    WAYPOINTS,
    BEST_FOR_LABELS,
    loadWaypoints,
    findNearbyWaypoints,
    getDirectionLabel,
    getBestForLabels,
    getBortleLightPollutionLabel,
    estimateBortleClass,
    getLightPollutionLabelForWaypoint,
    getCompassSvgDataUri,
    haversineKm
  };
});
