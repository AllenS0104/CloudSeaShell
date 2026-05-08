const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'shared', 'data', 'waypoints', 'index.json');
const SCHEMA_PATH = path.join(ROOT, 'shared', 'data', 'waypoints', 'schema.json');
const BEST_FOR_ENUM = ['cloudsea', 'stargazing', 'sunset', 'sunrise'];
const REQUIRED_FIELDS = [
  'id',
  'name',
  'lat',
  'lng',
  'elevation',
  'bestFor',
  'bestSeasons',
  'suggestedDirection',
  'notes',
  'bortleClass',
];
const ALLOWED_FIELDS = new Set(REQUIRED_FIELDS);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function checkStringArray(errors, waypoint, index, field) {
  if (!Array.isArray(waypoint[field])) {
    errors.push(`waypoint[${index}].${field} must be an array`);
    return;
  }
  if (waypoint[field].length === 0) {
    errors.push(`waypoint[${index}].${field} must contain at least one item`);
  }
  const seen = new Set();
  waypoint[field].forEach((item, itemIndex) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`waypoint[${index}].${field}[${itemIndex}] must be a non-empty string`);
    }
    if (seen.has(item)) {
      errors.push(`waypoint[${index}].${field} contains duplicate value: ${item}`);
    }
    seen.add(item);
  });
}

function validateWaypoint(waypoint, index, seenIds, errors) {
  if (!isPlainObject(waypoint)) {
    errors.push(`waypoint[${index}] must be an object`);
    return;
  }

  REQUIRED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(waypoint, field)) {
      errors.push(`waypoint[${index}].${field} is required`);
    }
  });

  Object.keys(waypoint).forEach((field) => {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`waypoint[${index}].${field} is not allowed by schema`);
    }
  });

  if (typeof waypoint.id === 'string') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(waypoint.id)) {
      errors.push(`waypoint[${index}].id must be kebab-case lowercase alphanumeric`);
    }
    if (seenIds.has(waypoint.id)) {
      errors.push(`waypoint[${index}].id duplicates ${waypoint.id}`);
    }
    seenIds.add(waypoint.id);
  } else if (Object.prototype.hasOwnProperty.call(waypoint, 'id')) {
    errors.push(`waypoint[${index}].id must be a string`);
  }

  ['name', 'notes'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(waypoint, field) && (typeof waypoint[field] !== 'string' || waypoint[field].trim() === '')) {
      errors.push(`waypoint[${index}].${field} must be a non-empty string`);
    }
  });

  if (!isFiniteNumber(waypoint.lat) || waypoint.lat < -90 || waypoint.lat > 90) {
    errors.push(`waypoint[${index}].lat must be a number between -90 and 90`);
  }
  if (!isFiniteNumber(waypoint.lng) || waypoint.lng < -180 || waypoint.lng > 180) {
    errors.push(`waypoint[${index}].lng must be a number between -180 and 180`);
  }
  if (!isFiniteNumber(waypoint.elevation)) {
    errors.push(`waypoint[${index}].elevation must be a number`);
  }
  if (!isFiniteNumber(waypoint.suggestedDirection) || waypoint.suggestedDirection < 0 || waypoint.suggestedDirection > 359) {
    errors.push(`waypoint[${index}].suggestedDirection must be a number between 0 and 359`);
  }
  if (!Number.isInteger(waypoint.bortleClass) || waypoint.bortleClass < 1 || waypoint.bortleClass > 9) {
    errors.push(`waypoint[${index}].bortleClass must be an integer from 1 to 9`);
  }

  checkStringArray(errors, waypoint, index, 'bestFor');
  if (Array.isArray(waypoint.bestFor)) {
    waypoint.bestFor.forEach((item, itemIndex) => {
      if (!BEST_FOR_ENUM.includes(item)) {
        errors.push(`waypoint[${index}].bestFor[${itemIndex}] must be one of ${BEST_FOR_ENUM.join(', ')}`);
      }
    });
  }
  checkStringArray(errors, waypoint, index, 'bestSeasons');
}

function validateWaypoints(data, schema) {
  const errors = [];
  const minItems = schema && schema.minItems ? schema.minItems : 15;
  if (!Array.isArray(data)) {
    return ['waypoints root must be an array'];
  }
  if (data.length < minItems) {
    errors.push(`waypoints must contain at least ${minItems} items`);
  }
  const seenIds = new Set();
  data.forEach((waypoint, index) => validateWaypoint(waypoint, index, seenIds, errors));
  return errors;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const data = readJson(DATA_PATH);
  const schema = readJson(SCHEMA_PATH);
  const errors = validateWaypoints(data, schema);
  if (errors.length) {
    console.error(`Waypoint validation failed with ${errors.length} error(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`Validated ${data.length} waypoint(s).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateWaypoints,
};
