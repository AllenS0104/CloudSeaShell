/* global wx */
/**
 * Recommendation controller for the index page.
 *
 * Owns photography-device preset selection, recommendation refreshes, photo
 * panel state, and emergency SOS action-sheet behavior.
 */
function createRecommendationController(deps) {
  const { getState, setState, services } = deps;
  const { waypoints } = services;

  function formatDirection(waypoint) {
    if (!waypoint || waypoint.suggestedDirection == null) return null;
    const deg = Number(waypoint.suggestedDirection);
    return {
      label: waypoints.getDirectionLabel(deg),
      deg,
      compassSvgDataUri: waypoints.getCompassSvgDataUri(deg),
    };
  }

  function formatLightPollution(waypoint, elevation) {
    return waypoints.getLightPollutionLabelForWaypoint(waypoint || { elevation });
  }

  function buildWaypointMarkers(list) {
    return list.map((item, index) => ({
      id: 1000 + index,
      waypointId: item.id,
      latitude: item.lat,
      longitude: item.lng,
      width: 26,
      height: 34,
      colorTag: 'waypoint-recommendation',
      callout: {
        content: `${item.name} · ${item.elevation}m\n${item.bestForLabels.join('/')} · ${item.directionText}\n点击下方卡片导航`,
        color: '#ffffff',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#0b2f5b',
        padding: 8,
        display: 'BYCLICK',
      },
      label: {
        content: '📸',
        color: '#ffcf5a',
        fontSize: 18,
      },
    }));
  }

  function loadNearbyWaypoints(statePatch) {
    const state = statePatch || getState();
    const lat = Number(state.lat);
    const lon = Number(state.lon ?? state.lng);
    const elevation = Number(state.elevation || getState().elevation || 0);
    const nearby = waypoints.findNearbyWaypoints({ lat, lng: lon, radiusKm: 80 }).map(item => {
      const direction = formatDirection(item);
      const lightPollution = formatLightPollution(item, elevation);
      return {
        ...item,
        bestForLabels: waypoints.getBestForLabels(item.bestFor),
        bestForText: waypoints.getBestForLabels(item.bestFor).join(' / '),
        direction,
        directionText: direction ? `${direction.label} (${direction.deg}°)` : '未知',
        lightPollution,
      };
    });

    const baseMarker = {
      id: 0,
      latitude: lat,
      longitude: lon,
      width: 28,
      height: 36,
      colorTag: 'selected-location',
      callout: {
        content: '已选观测点',
        display: 'BYCLICK',
      },
    };
    const selected = nearby[0] || null;
    const primaryDirection = selected ? selected.direction : null;
    const lightPollution = selected
      ? selected.lightPollution
      : formatLightPollution({ elevation, distanceKm: 30 }, elevation);

    setState({
      nearbyWaypoints: nearby,
      selectedWaypoint: selected,
      primaryDirection,
      lightPollution,
      markers: [baseMarker].concat(buildWaypointMarkers(nearby)),
    });
    return nearby;
  }

  function markerTap(e) {
    const markerId = Number(e.detail?.markerId);
    if (markerId < 1000) return;
    const waypoint = getState().nearbyWaypoints[markerId - 1000];
    if (!waypoint) return;
    setState({
      selectedWaypoint: waypoint,
      primaryDirection: waypoint.direction,
      lightPollution: waypoint.lightPollution,
    });
  }

  function openWaypointNavigation() {
    const waypoint = getState().selectedWaypoint;
    if (!waypoint) return;
    wx.openLocation({
      latitude: waypoint.lat,
      longitude: waypoint.lng,
      name: waypoint.name,
      address: waypoint.notes || '推荐摄影机位（示例数据）',
      scale: 14,
    });
  }

  function openPhoto() {
    const p = services.getPresets();
    setState({
      showPhoto: true,
      cameraPresets: p.getAllCameraPresets(),
      phonePresets: p.getAllPhonePresets(),
    });
    updateDeviceRecs();
  }

  function selectCamera(e) {
    const idx = Number(e.detail.value);
    const id = getState().cameraPresets[idx]?.id || '';
    setState({ selectedCamera: id });
    updateDeviceRecs();
  }

  function selectPhone(e) {
    const idx = Number(e.detail.value);
    const id = getState().phonePresets[idx]?.id || '';
    setState({ selectedPhone: id });
    updateDeviceRecs();
  }

  function updateDeviceRecs() {
    const { selectedCamera, selectedPhone, photoParams } = getState();
    const score = getState().analysis?.score ?? 0;
    const wind = parseFloat(getState().currentWind) || 0;
    const lighting = photoParams?.lighting || { phase: 'daylight' };
    const ev = photoParams?.ev || 12;

    let cameraRec = null;
    if (selectedCamera) {
      cameraRec = services.getPresets().getCameraRecommendation(selectedCamera, ev, lighting, wind, score);
    }

    let phoneRec = null;
    if (selectedPhone) {
      phoneRec = services.getPresets().getPhoneRecommendation(selectedPhone, score, lighting, wind);
    }

    setState({ cameraRec, phoneRec });
  }

  function clearCamera() {
    setState({ selectedCamera: '', cameraRec: null });
  }

  function clearPhone() {
    setState({ selectedPhone: '', phoneRec: null });
  }

  function closePhoto() {
    setState({ showPhoto: false });
  }

  function sos() {
    const { lat, lon, elevation, locationName } = getState();
    const info = `🆘 紧急求救\n位置：${locationName}\n坐标：${lat.toFixed(6)}, ${lon.toFixed(6)}\n海拔：${elevation}m\n时间：${new Date().toLocaleString('zh-CN')}`;

    wx.showActionSheet({
      itemList: ['拨打 110', '拨打 119', '复制位置信息'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({ phoneNumber: '110' });
        } else if (res.tapIndex === 1) {
          wx.makePhoneCall({ phoneNumber: '119' });
        } else if (res.tapIndex === 2) {
          wx.setClipboardData({ data: info });
        }
      },
    });
  }

  return {
    loadNearbyWaypoints,
    markerTap,
    openWaypointNavigation,
    openPhoto,
    selectCamera,
    selectPhone,
    updateDeviceRecs,
    clearCamera,
    clearPhone,
    closePhoto,
    sos,
  };
}

module.exports = { createRecommendationController };
