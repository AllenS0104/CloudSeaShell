const fs = require('fs');
const path = require('path');

const root = __dirname;
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8'));
const defaultTheme = tokens.meta.defaultTheme || 'dark';

function flatten(obj, prefix = []) {
  return Object.entries(obj).flatMap(([key, value]) => {
    const next = [...prefix, key];
    if (value && typeof value === 'object' && !Array.isArray(value) && !('web' in value) && !('wxss' in value)) {
      return flatten(value, next);
    }
    return [[next.join('-'), value]];
  });
}

function baseVars(platform) {
  const vars = [];
  for (const group of ['spacing', 'radius', 'font']) {
    for (const [name, value] of flatten(tokens[group])) {
      vars.push([`${group}-${name}`, value[platform]]);
    }
  }
  return vars;
}

function themeVars(themeName, platform) {
  const theme = tokens.themes[themeName];
  return [...flatten(theme.color, ['color']), ...flatten(theme.shadow, ['shadow'])]
    .map(([name, value]) => [name, platform === 'wxss' && name.startsWith('shadow-') ? value.replace(/px/g, 'rpx') : value]);
}

function emitBlock(selector, vars) {
  const lines = vars.map(([name, value]) => `  --${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

function buildCss() {
  const defaultVars = [...themeVars(defaultTheme, 'web'), ...baseVars('web')];
  const blocks = [
    '/* Auto-generated from tokens.json. Run: npm run build:tokens */',
    emitBlock(':root', defaultVars),
  ];

  for (const themeName of Object.keys(tokens.themes)) {
    blocks.push(emitBlock(`[data-theme="${themeName}"]`, [...themeVars(themeName, 'web'), ...baseVars('web')]));
  }

  return blocks.join('\n\n') + '\n';
}

function buildWxss() {
  const defaultVars = [...themeVars(defaultTheme, 'wxss'), ...baseVars('wxss')];
  const blocks = [
    '/* Auto-generated from tokens.json. Run: npm run build:tokens */',
    emitBlock('page', defaultVars),
  ];

  for (const themeName of Object.keys(tokens.themes)) {
    blocks.push(emitBlock(`.theme-${themeName}`, [...themeVars(themeName, 'wxss'), ...baseVars('wxss')]));
  }

  return blocks.join('\n\n') + '\n';
}

const css = buildCss();
const wxss = buildWxss();
fs.writeFileSync(path.join(root, 'tokens.css'), css, 'utf8');
fs.writeFileSync(path.join(root, 'tokens.wxss'), wxss, 'utf8');

const repoRoot = path.resolve(root, '..', '..');
const miniprogramRoot = path.join(repoRoot, 'miniprogram');
const miniprogramStyles = path.join(miniprogramRoot, 'styles');
if (fs.existsSync(miniprogramRoot)) {
  fs.mkdirSync(miniprogramStyles, { recursive: true });
  fs.writeFileSync(path.join(miniprogramStyles, 'tokens.wxss'), wxss, 'utf8');
}

const webCss = path.join(repoRoot, 'web', 'css');
if (fs.existsSync(webCss)) {
  fs.writeFileSync(path.join(webCss, 'tokens.css'), css, 'utf8');
  fs.copyFileSync(path.join(root, 'components.css'), path.join(webCss, 'components.css'));
}

console.log('✅ Generated shared tokens plus web/css and miniprogram/styles mirrors');
