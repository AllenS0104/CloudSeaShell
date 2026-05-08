/* global wx */
/**
 * Search controller for the index page.
 *
 * Owns location search, auto-location, map taps, and search-history taps while
 * keeping the page layer limited to event forwarding and state storage.
 */
function createSearchController(deps) {
  const { getState, setState, services } = deps;
  const { api, searchHistory } = services;

  async function autoLocate() {
    try {
      const pos = await api.getLocation();
      setState({
        lat: pos.latitude,
        lon: pos.longitude,
        locationName: '当前位置',
      });
      services.fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      console.warn('自动定位失败，使用默认位置', err.message);
      const state = getState();
      services.fetchAll(state.lat, state.lon);
    }
  }

  function handleSearchInput(e) {
    setState({ searchText: e.detail.value });
  }

  async function handleSearch() {
    const address = getState().searchText.trim();
    if (!address) return;

    setState({ statusText: `正在搜索 ${address}...`, statusType: 'info', loading: true });

    try {
      const results = await api.geocodeAddress(address);

      if (results.length === 0) {
        wx.showToast({ title: '未找到匹配地点', icon: 'none' });
        setState({ loading: false, statusText: '未找到匹配地点', statusType: 'warning' });
      } else if (results.length === 1) {
        const r = results[0];
        setState({ lat: r.latitude, lon: r.longitude, locationName: r.name });
        searchHistory.addSearchHistory({ name: r.name, lat: r.latitude, lon: r.longitude });
        setState({ searchHistoryList: searchHistory.getSearchHistory() });
        await services.fetchAll(r.latitude, r.longitude);
      } else {
        const visibleResults = results.slice(0, 6);
        const names = visibleResults.map(r => r.name);
        wx.showActionSheet({
          itemList: names,
          success(res) {
            const picked = visibleResults[res.tapIndex];
            setState({ lat: picked.latitude, lon: picked.longitude, locationName: picked.name });
            searchHistory.addSearchHistory({ name: picked.name, lat: picked.latitude, lon: picked.longitude });
            setState({ searchHistoryList: searchHistory.getSearchHistory() });
            services.fetchAll(picked.latitude, picked.longitude);
          },
          fail() {
            setState({ loading: false, statusText: '已取消选择', statusType: 'info' });
          },
        });
      }
    } catch (err) {
      setState({ loadError: true, statusText: `搜索失败：${err.message}`, statusType: 'warning', loading: false });
    }
  }

  async function handleLocate() {
    setState({ statusText: '正在获取当前位置...', statusType: 'info' });

    try {
      const pos = await api.getLocation();
      setState({
        lat: pos.latitude,
        lon: pos.longitude,
        locationName: '当前位置',
      });
      await services.fetchAll(pos.latitude, pos.longitude);
    } catch (err) {
      setState({ statusText: `定位失败：${err.message}`, statusType: 'warning' });
    }
  }

  function handleMapTap(e) {
    const lat = e.detail?.latitude;
    const lon = e.detail?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number' &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setState({
        lat,
        lon,
        locationName: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      });
      services.fetchAll(lat, lon);
    }
  }

  function handleHistoryTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    setState({ lat: item.lat, lon: item.lon, locationName: item.name });
    services.fetchAll(item.lat, item.lon);
  }

  return {
    autoLocate,
    handleSearchInput,
    handleSearch,
    handleLocate,
    handleMapTap,
    handleHistoryTap,
  };
}

module.exports = { createSearchController };
