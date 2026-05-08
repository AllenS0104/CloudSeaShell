const { createFavorites } = require('./favorites-core.js');
const storage = require('./adapters/wx-storage.js');

module.exports = createFavorites({ storage });
