/**
 * Favorites controller for the index page.
 *
 * Owns favorite add/remove behavior and selecting favorite locations while the
 * page remains responsible for holding the current data object.
 */
function createFavoritesController(deps) {
  const { getState, setState, services } = deps;
  const { favorites } = services;

  function toggleFavorite() {
    const { lat, lon, locationName, elevation, isFav } = getState();
    if (isFav) {
      favorites.removeFavorite(lat, lon);
    } else {
      favorites.addFavorite({ name: locationName, lat, lon, elevation });
    }
    setState({
      isFav: !isFav,
      favList: favorites.getFavorites(),
    });
  }

  function favoriteTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    setState({ lat: item.lat, lon: item.lon, locationName: item.name, elevation: item.elevation || 300 });
    services.fetchAll(item.lat, item.lon);
  }

  return {
    toggleFavorite,
    favoriteTap,
  };
}

module.exports = { createFavoritesController };
