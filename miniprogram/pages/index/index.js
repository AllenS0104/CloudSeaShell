/* global Page */
const calc = require('../../utils/calculations');
const api = require('../../utils/services');
const fusion = require('../../utils/fusion');
const searchHistory = require('../../utils/search-history');
const favorites = require('../../utils/favorites');
const analyzer = require('../../utils/analyzer');
const feedback = require('../../utils/feedback');
const waypoints = require('../../utils/waypoints-data');
const { createSearchController } = require('./controllers/search-controller');
const { createWeatherController } = require('./controllers/weather-controller');
const { createFeedbackController } = require('./controllers/feedback-controller');
const { createFavoritesController } = require('./controllers/favorites-controller');
const { createRecommendationController } = require('./controllers/recommendation-controller');
const { createNotificationController } = require('./controllers/notification-controller');
const { createShareController } = require('./controllers/share-controller');

let presets = null;
function getPresets() {
  if (!presets) {
    presets = require('../../utils/camera-presets');
  }
  return presets;
}

const DEFAULT_ELEVATION = 300;

function getControllers(page) {
  if (!page.__indexControllers) {
    const deps = {
      getState: () => page.data,
      setState: patch => page.setData(patch),
      services: {
        api,
        analyzer,
        calc,
        favorites,
        feedback,
        fusion,
        waypoints,
        getPresets,
        searchHistory,
        autoSaveFeedback: () => page.autoSaveFeedback(),
        loadNearbyWaypoints: state => page.loadNearbyWaypoints(state),
        fetchAll: (lat, lon) => page.fetchAll(lat, lon),
      },
      page,
      utils: {},
    };

    page.__indexControllers = {
      search: createSearchController(deps),
      weather: createWeatherController(deps),
      feedback: createFeedbackController(deps),
      favorites: createFavoritesController(deps),
      recommendation: createRecommendationController(deps),
      notification: createNotificationController(deps),
      share: createShareController(deps),
    };
  }
  return page.__indexControllers;
}

Page({
  data: {
    lat: 39.9042,
    lon: 116.4074,
    elevation: DEFAULT_ELEVATION,
    locationName: '北京',
    searchText: '',
    selectedDayIndex: 0,
    dayLabels: [],
    loading: true,
    loadError: false,
    statusText: '',
    statusType: 'info',
    weatherData: null,
    analysis: null,
    guidance: null,
    currentTemp: '--',
    currentFeelsLike: '--',
    currentHumidity: '--',
    currentWind: '--',
    currentCloudCover: '--',
    currentDewGap: '--',
    hourlyList: [],
    markers: [],
    fusionResult: null,
    fusionLoading: false,
    photoParams: null,
    showPhoto: false,
    glowAnalysis: null,
    safetyAlerts: [],
    cameraPresets: [],
    phonePresets: [],
    selectedCamera: '',
    selectedPhone: '',
    cameraRec: null,
    phoneRec: null,
    starInfo: null,
    heroCard: null,
    nearbyWaypoints: [],
    selectedWaypoint: null,
    primaryDirection: null,
    lightPollution: null,
    // Feedback
    showFeedback: false,
    feedbackRecords: [],
    currentFeedback: null,
    feedbackStats: null,
    fbCloudSea: null,
    fbGlow: null,
    fbStars: null,
    fbRating: null,
    fbNote: '',
    // 折叠状态
    showHourly: false,
    showFusion: false,
    // Search history & favorites
    searchHistoryList: [],
    isFav: false,
    favList: [],
  },

  onLoad() {
    const controllers = getControllers(this);
    controllers.notification.flushDueSubscribeMessages();
    this.autoLocate();
    this.setData({
      searchHistoryList: searchHistory.getSearchHistory(),
      favList: favorites.getFavorites(),
    });
  },

  onShareAppMessage() {
    const { analysis, locationName } = this.data;
    const score = analysis?.score ?? 0;
    return {
      title: `${locationName} 云海预测：${score} 分`,
      path: '/pages/index/index',
    };
  },

  autoLocate() {
    return getControllers(this).search.autoLocate();
  },

  onSearchInput(e) {
    return getControllers(this).search.handleSearchInput(e);
  },

  onSearch() {
    return getControllers(this).search.handleSearch();
  },

  onLocate() {
    return getControllers(this).search.handleLocate();
  },

  onMapTap(e) {
    return getControllers(this).search.handleMapTap(e);
  },

  onWaypointMarkerTap(e) {
    return getControllers(this).recommendation.markerTap(e);
  },

  onOpenWaypointNavigation() {
    return getControllers(this).recommendation.openWaypointNavigation();
  },

  loadNearbyWaypoints(state) {
    return getControllers(this).recommendation.loadNearbyWaypoints(state);
  },

  onHistoryTap(e) {
    return getControllers(this).search.handleHistoryTap(e);
  },

  fetchAll(lat, lon) {
    return getControllers(this).weather.fetchAll(lat, lon);
  },

  onRetry() {
    return getControllers(this).weather.retry();
  },

  renderWeather() {
    return getControllers(this).weather.renderWeather();
  },

  onDayChange(e) {
    return getControllers(this).weather.handleDayChange(e);
  },

  fetchFusion(lat, lon) {
    return getControllers(this).weather.fetchFusion(lat, lon);
  },

  onToggleHourly() {
    return getControllers(this).weather.toggleHourly();
  },

  onToggleFusion() {
    return getControllers(this).weather.toggleFusion();
  },

  autoSaveFeedback() {
    return getControllers(this).feedback.autoSaveFeedback();
  },

  onOpenFeedback() {
    return getControllers(this).feedback.openFeedback();
  },

  onCloseFeedback() {
    return getControllers(this).feedback.closeFeedback();
  },

  onToggleCloudSea() {
    return getControllers(this).feedback.toggleCloudSea();
  },

  onToggleGlow() {
    return getControllers(this).feedback.toggleGlow();
  },

  onToggleStars() {
    return getControllers(this).feedback.toggleStars();
  },

  onSetRating(e) {
    return getControllers(this).feedback.setRating(e);
  },

  onFeedbackNoteInput(e) {
    return getControllers(this).feedback.noteInput(e);
  },

  onSubmitFeedback() {
    return getControllers(this).feedback.submitFeedback();
  },

  onGoHistory() {
    return getControllers(this).feedback.goHistory();
  },

  onExportFeedback() {
    return getControllers(this).feedback.exportFeedback();
  },

  onToggleFav() {
    return getControllers(this).favorites.toggleFavorite();
  },

  onSharePosterTap() {
    return getControllers(this).share.generatePoster(this);
  },

  onEnableObservationReminder() {
    return getControllers(this).notification.enableObservationReminder();
  },

  onFavTap(e) {
    return getControllers(this).favorites.favoriteTap(e);
  },

  onOpenPhoto() {
    return getControllers(this).recommendation.openPhoto();
  },

  onSelectCamera(e) {
    return getControllers(this).recommendation.selectCamera(e);
  },

  onSelectPhone(e) {
    return getControllers(this).recommendation.selectPhone(e);
  },

  updateDeviceRecs() {
    return getControllers(this).recommendation.updateDeviceRecs();
  },

  onClearCamera() {
    return getControllers(this).recommendation.clearCamera();
  },

  onClearPhone() {
    return getControllers(this).recommendation.clearPhone();
  },

  onClosePhoto() {
    return getControllers(this).recommendation.closePhoto();
  },

  onSOS() {
    return getControllers(this).recommendation.sos();
  },
});
