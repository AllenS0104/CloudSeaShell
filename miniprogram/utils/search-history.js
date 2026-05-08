const { createSearchHistory } = require('./search-history-core.js');
const storage = require('./adapters/wx-storage.js');

module.exports = createSearchHistory({ storage });
