#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const allowEmpty = process.argv.includes('--allow-empty');
const webBuildInfoPath = path.join(repoRoot, 'web', 'dist', 'build-info.json');
const androidBuildInfoPath = path.join(
  repoRoot,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'weather-cloud-forecast-app',
  'build-info.json',
);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readBuildInfo(filePath, label) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

const webBuildInfo = readBuildInfo(webBuildInfoPath, 'web/dist/build-info.json');
if (!webBuildInfo) {
  fail('Missing web/dist/build-info.json. Run npm run build:web first.');
}

const androidBuildInfo = readBuildInfo(
  androidBuildInfoPath,
  'android assets build-info.json',
);
if (!androidBuildInfo) {
  if (allowEmpty) {
    console.log('⚠️  Android assets build-info.json is missing; skipped because --allow-empty was provided.');
    process.exit(0);
  }

  fail('Missing android assets build-info.json. Run npm run build:web or copy web/dist/build-info.json into android assets.');
}

const fields = ['commitSha', 'version'];
const mismatches = fields.filter((field) => webBuildInfo[field] !== androidBuildInfo[field]);

if (mismatches.length > 0) {
  console.error('❌ Android assets build metadata is stale.');
  for (const field of mismatches) {
    console.error(`  ${field}: web=${webBuildInfo[field] || '<empty>'} android=${androidBuildInfo[field] || '<empty>'}`);
  }
  process.exit(1);
}

console.log(`✅ Android assets build metadata matches web/dist (commitSha=${webBuildInfo.commitSha}, version=${webBuildInfo.version}).`);
