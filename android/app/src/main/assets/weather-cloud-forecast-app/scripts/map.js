let mapInstance = null;
let markerInstance = null;
let recommendationCircle = null;
let recommendationBadge = null;

export function initMap({ lat, lon, onSelect }) {
  const Leaflet = window.L;
  if (!Leaflet) {
    throw new Error('Leaflet 加载失败');
  }

  const gaode = Leaflet.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    attribution: '高德地图',
  });
  const topo = Leaflet.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
  });
  const satellite = Leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri',
  });
  const carto = Leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: 'CARTO',
    subdomains: 'abcd',
  });

  const baseLayers = {
    '高德地图 (中文)': gaode,
    '地形图 (户外)': topo,
    '高清卫星图': satellite,
    '简洁地图 (英文)': carto,
  };

  mapInstance = Leaflet.map('map', { layers: [gaode] }).setView([lat, lon], 6);
  Leaflet.control.layers(baseLayers).addTo(mapInstance);
  markerInstance = Leaflet.marker([lat, lon]).addTo(mapInstance);
  mapInstance.on('click', (event) => {
    onSelect?.({ lat: event.latlng.lat, lon: event.latlng.lng });
  });

  return mapInstance;
}

export function updateMapPosition(lat, lon, zoom = 9) {
  if (!mapInstance || !markerInstance) {
    return;
  }

  mapInstance.setView([lat, lon], zoom);
  markerInstance.setLatLng([lat, lon]);
}

export function updateObservationOverlay({ lat, lon, guidance, analysis }) {
  if (!mapInstance || !window.L) {
    return;
  }

  if (recommendationCircle) {
    recommendationCircle.remove();
  }
  if (recommendationBadge) {
    recommendationBadge.remove();
  }

  const Leaflet = window.L;
  const color = guidance.goClass === 'go'
    ? '#28a745'
    : guidance.goClass === 'watch'
      ? '#f0ad4e'
      : '#6c757d';
  const radius = guidance.goClass === 'go' ? 1800 : guidance.goClass === 'watch' ? 2600 : 3200;

  recommendationCircle = Leaflet.circle([lat, lon], {
    radius,
    color,
    weight: 2,
    dashArray: '6 8',
    fillColor: color,
    fillOpacity: 0.08,
  }).addTo(mapInstance);

  const popupHtml = `
    <div style="min-width:220px;">
      <strong>观测建议区</strong><br/>
      建议等级：${guidance.goLevel}<br/>
      建议海拔：${guidance.targetElevation} m<br/>
      推荐时段：${guidance.recommendedWindow}<br/>
      云海评分：${analysis.score} 分
    </div>
  `;
  recommendationCircle.bindPopup(popupHtml);

  recommendationBadge = Leaflet.marker([lat, lon], {
    interactive: false,
    icon: Leaflet.divIcon({
      className: 'observation-map-badge',
      html: `<div class="observation-map-badge__inner" style="border-color:${color};color:${color};">${guidance.goLevel}</div>`,
      iconSize: [120, 30],
      iconAnchor: [60, 48],
    }),
  }).addTo(mapInstance);
}
