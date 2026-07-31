#!/usr/bin/env node
/**
 * Mirror the web PWA (web/) into the Android WebView asset bundle
 * (android/app/src/main/assets/weather-cloud-forecast-app/).
 *
 * The APK ships the same PWA, so any change under web/ must be copied over or
 * the Android build silently runs stale logic. This used to be a manual copy
 * and drifted (e.g. services-core.js updated but calculations.js/scoring.js
 * left behind, so the APK missed scoring fixes).
 *
 * Two differences are intentional and applied as transforms instead of being
 * copied verbatim: manifest.json and sw.js must use relative ("./") paths
 * because assets are served from file:///android_asset/... , not from a
 * site root.
 *
 * Usage:
 *   node scripts/sync-android-assets.js          # write changes
 *   node scripts/sync-android-assets.js --check  # fail if out of sync (CI)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'web');
const ANDROID_DIR = path.join(
  ROOT, 'android', 'app', 'src', 'main', 'assets', 'weather-cloud-forecast-app'
);

// Build/dev tooling that must never ship inside the APK.
const EXCLUDED_FILES = new Set(['.eslintrc.js', 'build.js', 'server.js']);
const EXCLUDED_DIRS = new Set(['dist', 'node_modules']);

// Files needing the absolute -> relative path rewrite described above.
const TRANSFORMS = {
  'manifest.json': (text) => text.replace(/"start_url":\s*"\/(?!\/)/, '"start_url": "./'),
  'sw.js': (text) => text.replace(/'\/(?!\/)/g, "'./"),
};

const checkOnly = process.argv.includes('--check');
const BOM = '\ufeff';

function listWebFiles(dir = WEB_DIR, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...listWebFiles(path.join(dir, entry.name), rel));
    } else if (!EXCLUDED_FILES.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

/** Text files get transformed and normalised; everything else is copied raw. */
function isTextAsset(rel) {
  return /\.(js|json|css|html|md|svg|txt)$/i.test(rel);
}

function desiredContent(rel, targetPath) {
  const sourcePath = path.join(WEB_DIR, rel);
  if (!isTextAsset(rel)) return fs.readFileSync(sourcePath);

  let text = fs.readFileSync(sourcePath, 'utf8').replace(/^\ufeff/, '');
  const transform = TRANSFORMS[rel.split(path.sep).join('/')];
  if (transform) text = transform(text);

  // Keep the BOM if the existing Android copy had one, to avoid churn.
  if (fs.existsSync(targetPath)
    && fs.readFileSync(targetPath, 'utf8').startsWith(BOM)) {
    text = BOM + text;
  }
  return Buffer.from(text, 'utf8');
}

const stale = [];
let written = 0;

for (const rel of listWebFiles()) {
  const targetPath = path.join(ANDROID_DIR, rel);
  const content = desiredContent(rel, targetPath);
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
  if (current && current.equals(content)) continue;

  stale.push(rel);
  if (checkOnly) continue;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
  written += 1;
  console.log(`synced web/${rel.split(path.sep).join('/')} -> android asset`);
}

if (checkOnly) {
  if (stale.length) {
    console.error('❌ Android assets are out of sync with web/:');
    for (const rel of stale) console.error(`   - ${rel.split(path.sep).join('/')}`);
    console.error('   Run: npm run sync:android');
    process.exit(1);
  }
  console.log('✅ Android assets are in sync with web/');
} else {
  console.log(written
    ? `✅ Synced ${written} file(s) into the Android asset bundle`
    : '✅ Android assets already in sync with web/');
}
