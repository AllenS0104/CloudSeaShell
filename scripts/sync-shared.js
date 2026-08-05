const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED_DIR = path.join(ROOT, 'shared', 'core');
const TARGET_DIRS = [
  path.join(ROOT, 'miniprogram', 'utils'),
  path.join(ROOT, 'web', 'js'),
];
const WAYPOINT_DATA_TARGETS = [
  path.join(ROOT, 'miniprogram', 'data', 'waypoints'),
  path.join(ROOT, 'web', 'data', 'waypoints'),
];

const SHARED_MODULES = [
  'thresholds',
  'calculations',
  'scoring',
  'analyzer',
  'math-utils',
  'stargazing',
  'sunset',
  'photography',
  'camera-presets',
  'guidance',
  'ports/http',
  'ports/storage',
  'ports/ui',
  'services-core',
  'favorites-core',
  'search-history-core',
  'feedback-core',
  'waypoints-data',
  'poster-layout',
];

const SHARED_HEADER = '/* SHARED CORE — single source of truth, do not edit per-end copies */\n';
const GENERATED_HEADER = '// 由 shared/core 同步；请勿直接编辑。运行 npm run sync:shared 更新。\n';

function sharedBody(source) {
  return source.replace(/^\uFEFF/, '').replace(SHARED_HEADER, '');
}

function copyWaypointData() {
  const sourceDir = path.join(ROOT, 'shared', 'data', 'waypoints');
  const files = ['index.json', 'schema.json', 'CONTRIBUTING.md'];
  const jsonContent = fs.readFileSync(path.join(sourceDir, 'index.json'), 'utf8');
  const wrapperJs =
    GENERATED_HEADER +
    'module.exports = ' + jsonContent.trimEnd() + ';\n';
  for (const targetDir of WAYPOINT_DATA_TARGETS) {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`synced ${path.relative(ROOT, sourcePath)} -> ${path.relative(ROOT, targetPath)}`);
    }
    // WeChat 小程序不支持 require('*.json')，生成 .js 包装
    const wrapperPath = path.join(targetDir, 'index.js');
    fs.writeFileSync(wrapperPath, wrapperJs, 'utf8');
    console.log(`generated ${path.relative(ROOT, wrapperPath)} (json wrapper)`);
  }
}

function syncSharedModule(name, targetDir, targetName = name) {
  const sourcePath = path.join(SHARED_DIR, `${name}.js`);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing shared core module: ${sourcePath}`);
  }

  const body = sharedBody(fs.readFileSync(sourcePath, 'utf8'));
  const targetPath = path.join(targetDir, `${targetName}.js`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, GENERATED_HEADER + body, 'utf8');
  console.log(`synced ${path.relative(ROOT, sourcePath)} -> ${path.relative(ROOT, targetPath)}`);
}

for (const name of SHARED_MODULES) {
  for (const targetDir of TARGET_DIRS) {
    syncSharedModule(name, targetDir);
  }
}

syncSharedModule('waypoints-data', path.join(ROOT, 'web', 'js'), 'waypoints');
copyWaypointData();
