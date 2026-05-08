const { createFeedback } = require('./feedback-core.js');
const storage = require('./adapters/wx-storage.js');

module.exports = createFeedback({ storage });
