/**
 * Simple bundler: concatenates algorithm files with require() shim
 * Run: node web/build.js
 *      node web/build.js --check   # verify bundle.js is up to date (CI)
 * Output: web/js/bundle.js and web/dist/build-info.json
 *
 * bundle.js is what index.html actually loads (the individual js/scoring.js,
 * js/calculations.js ... files are NOT script-tagged), so a stale bundle
 * silently ships old algorithms to both the web app and the APK. The bundle
 * is therefore byte-deterministic — no timestamp inside — so `--check` can
 * detect staleness. Build time lives in build-info.json instead.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(__dirname, 'dist');
const androidAssetsDir = path.join(
  repoRoot,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'weather-cloud-forecast-app',
);

const order = [
  'math-utils',
  'i18n',
  'scoring',
  'guidance',
  'calculations',
  'photography',
  'stargazing',
  'sunset',
  'camera-presets',
  'analyzer',
  'poster-layout',
];

let output = `// Auto-generated bundle — do not edit. Run: npm run build:web
// Deterministic output: build time is recorded in dist/build-info.json.
(function(global) {
'use strict';
const _cache = {};

function require(name) {
  const key = name.replace(/^\\.\\//,'').replace(/\\.js$/,'');
  if (_cache[key]) return _cache[key];
  throw new Error('Module not found: ' + key);
}

`;

for (const name of order) {
  const file = path.join(__dirname, 'js', name + '.js');
  if (!fs.existsSync(file)) {
    // Silently skipping would drop a whole feature (云海 / 晚霞 / 星空 /
    // 摄影参数) from the web app and the APK with only a warning in the log.
    console.error(`❌ Missing bundle module: web/js/${name}.js`);
    process.exit(1);
  }
  const src = fs.readFileSync(file, 'utf8');
  output += `// === ${name} ===\n`;
  output += `(function() {\n`;
  output += `  var module = { exports: {} };\n`;
  output += `  var exports = module.exports;\n`;
  output += src + '\n';
  output += `  _cache['${name}'] = module.exports;\n`;
  output += `})();\n\n`;
}

output += `
// Expose modules globally
global.CloudSea = global.CloudSea || {};
global.CloudSea.calc = _cache['calculations'];
global.CloudSea.analyzer = _cache['analyzer'];
global.CloudSea.presets = _cache['camera-presets'];
global.CloudSea.i18n = _cache['i18n'];
global.CloudSea.scoring = _cache['scoring'];
global.CloudSea.guidance = _cache['guidance'];
global.CloudSea.photography = _cache['photography'];
global.CloudSea.stargazing = _cache['stargazing'];
global.CloudSea.sunset = _cache['sunset'];
global.CloudSea.mathUtils = _cache['math-utils'];
global.CloudSea.posterLayout = _cache['poster-layout'];
})(window);
`;

const bundlePath = path.join(__dirname, 'js', 'bundle.js');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath, 'utf8') : null;
  if (current !== output) {
    console.error('❌ web/js/bundle.js is stale — index.html loads the bundle, '
      + 'so algorithm edits are NOT live until it is rebuilt.');
    console.error('   Run: npm run build:web && npm run sync:android');
    process.exit(1);
  }
  console.log('✅ web/js/bundle.js is up to date');
  process.exit(0);
}

fs.writeFileSync(bundlePath, output, 'utf8');
console.log('✅ Bundle created: web/js/bundle.js (' + (output.length / 1024).toFixed(1) + ' KB)');

function getCommitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  try {
    return execSync('git rev-parse HEAD', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return 'unknown';
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const buildInfo = {
  commitSha: getCommitSha(),
  builtAt: new Date().toISOString(),
  version: packageJson.version || '0.0.0',
};
const buildInfoJson = JSON.stringify(buildInfo, null, 2) + '\n';
const distBuildInfo = path.join(distDir, 'build-info.json');
const androidBuildInfo = path.join(androidAssetsDir, 'build-info.json');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distBuildInfo, buildInfoJson, 'utf8');
console.log('✅ Build metadata created: web/dist/build-info.json');

fs.mkdirSync(androidAssetsDir, { recursive: true });
fs.copyFileSync(distBuildInfo, androidBuildInfo);
console.log('✅ Build metadata copied: android/app/src/main/assets/weather-cloud-forecast-app/build-info.json');
