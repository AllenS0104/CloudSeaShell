const waypointData = require('../shared/data/waypoints/index.json');
const schema = require('../shared/data/waypoints/schema.json');
const { validateWaypoints } = require('../scripts/validate-waypoints');

describe('waypoints JSON schema validation', () => {
  test('index.json passes the waypoint schema subset validator', () => {
    expect(validateWaypoints(waypointData, schema)).toEqual([]);
  });
});
