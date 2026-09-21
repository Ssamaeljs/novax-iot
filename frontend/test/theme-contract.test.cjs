const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const bootstrap = fs.readFileSync(
  path.join(root, 'public/theme-init.js'),
  'utf8',
);

function browser({ stored = null, dark = false, storageBlocked = false } = {}) {
  const attributes = new Map();
  const handlers = new Map();
  let mediaHandler;
  const media = {
    matches: dark,
    addEventListener: (_name, handler) => {
      mediaHandler = handler;
    },
  };
  const window = {
    matchMedia: () => media,
    localStorage: {
      getItem() {
        if (storageBlocked) throw new Error('Blocked');
        return stored;
      },
      setItem(_key, value) {
        if (storageBlocked) throw new Error('Blocked');
        stored = value;
      },
    },
    addEventListener: (name, handler) => handlers.set(name, handler),
    dispatchEvent: (event) => handlers.get(event.type)?.(event),
  };
  vm.runInNewContext(bootstrap, {
    window,
    document: {
      documentElement: {
        setAttribute: (name, value) => attributes.set(name, value),
      },
    },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  });
  return {
    runtime: window.novaxTheme,
    theme: () => attributes.get('data-theme'),
    stored: () => stored,
    system(dark) {
      media.matches = dark;
      mediaHandler();
    },
    storage(value, key = 'novax.theme') {
      stored = value;
      handlers.get('storage')({ key });
    },
  };
}

test('applies the OS preference synchronously before Angular initializes', () => {
  assert.equal(browser({ dark: true }).theme(), 'dark');
  assert.equal(browser({ dark: false }).theme(), 'light');
  const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  assert.match(html, /<script src="theme-init.js"><\/script>/);
  assert.ok(html.indexOf('theme-init.js') < html.indexOf('<body>'));
});
test('explicit selection persists and takes precedence over OS changes', () => {
  const app = browser({ stored: 'light', dark: true });
  assert.equal(app.theme(), 'light');
  app.runtime.setPreference('dark');
  assert.equal(app.stored(), 'dark');
  app.system(false);
  assert.equal(app.theme(), 'dark');
  assert.equal(browser({ stored: app.stored() }).theme(), 'dark');
});
test('System follows OS changes and recovers from invalid storage', () => {
  const app = browser({ stored: 'invalid' });
  assert.equal(app.runtime.getState().preference, 'system');
  app.system(true);
  assert.equal(app.theme(), 'dark');
  app.runtime.setPreference('light');
  app.runtime.setPreference('system');
  assert.equal(app.theme(), 'dark');
  app.system(false);
  assert.equal(app.theme(), 'light');
});
test('blocked localStorage never prevents theme selection', () => {
  const app = browser({ storageBlocked: true, dark: true });
  assert.equal(app.theme(), 'dark');
  app.runtime.setPreference('light');
  assert.equal(app.theme(), 'light');
});
test('syncs other tabs and storage removal without writing back', () => {
  const app = browser();
  app.storage('dark');
  assert.equal(app.theme(), 'dark');
  app.storage(null, null);
  assert.equal(app.runtime.getState().preference, 'system');
  assert.equal(app.theme(), 'light');
});

const palette = fs.readFileSync(
  path.join(root, 'src/styles/palette.css'),
  'utf8',
);
const tokens = fs.readFileSync(
  path.join(root, 'src/styles/tokens.css'),
  'utf8',
);
const declarations = (css) =>
  Object.fromEntries(
    [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
const lightCss = tokens.split("[data-theme='dark']")[0];
const darkCss = tokens.split("[data-theme='dark']")[1].split(':root')[0];
const light = { ...declarations(palette), ...declarations(lightCss) };
const dark = { ...light, ...declarations(darkCss) };
function color(theme, key) {
  const value = theme[key];
  assert.ok(value, `Missing token ${key}`);
  if (value.startsWith('var(')) return color(theme, value.slice(4, -1));
  assert.match(value, /^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}
function luminance(rgb) {
  return rgb
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(theme, foreground, background) {
  const values = [
    luminance(color(theme, foreground)),
    luminance(color(theme, background)),
  ].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [name, theme] of Object.entries({ light, dark })) {
  test(`${name}: semantic text, buttons and status badges meet AA text contrast`, () => {
    const pairs = [];
    for (const bg of [
      '--bg-app',
      '--bg-surface',
      '--bg-surface-secondary',
      '--bg-elevated',
    ]) {
      for (const text of [
        '--text-primary',
        '--text-secondary',
        '--text-muted',
        '--primary',
      ])
        pairs.push([text, bg]);
    }
    for (const status of [
      'success',
      'warning',
      'danger',
      'info',
      'maintenance',
      'offline',
      'unknown',
    ])
      pairs.push([`--${status}`, `--${status}-soft`]);
    pairs.push(
      ['--on-primary', '--primary'],
      ['--on-primary', '--primary-hover'],
      ['--on-primary', '--primary-active'],
      ['--on-accent', '--accent'],
      ['--on-accent', '--accent-hover'],
      ['--on-danger', '--danger'],
      ['--sidebar-text', '--sidebar-bg'],
      ['--sidebar-muted', '--sidebar-bg'],
      ['--sidebar-text-active', '--sidebar-item-active'],
    );
    for (const [fg, bg] of pairs)
      assert.ok(
        ratio(theme, fg, bg) >= 4.5,
        `${name} ${fg} on ${bg}: ${ratio(theme, fg, bg).toFixed(2)} < 4.5`,
      );
  });
  test(`${name}: controls and chart series have non-text contrast`, () => {
    for (const fg of [
      '--border-control',
      '--focus-ring',
      '--chart-series-1',
      '--chart-series-2',
      '--chart-series-3',
      '--chart-series-4',
      '--chart-series-5',
      '--chart-series-6',
    ]) {
      assert.ok(
        ratio(theme, fg, '--bg-surface') >= 3,
        `${name} ${fg} has insufficient contrast`,
      );
    }
  });
}
test('Dark supplies all Light theme tokens', () => {
  for (const key of Object.keys(declarations(lightCss)))
    assert.ok(key in declarations(darkCss), `Dark is missing ${key}`);
});
test('application styles and templates have no hardcoded colors outside token definitions', () => {
  function walk(directory) {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  }
  const colorLiteral =
    /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(|(?:color|background|fill|stroke)\s*:\s*(?:white|black|red|blue)\b/i;
  for (const file of walk(path.join(root, 'src'))) {
    if (
      !/\.(css|html|ts)$/.test(file) ||
      /(?:palette|tokens)\.css$|\.spec\.ts$/.test(file)
    )
      continue;
    assert.equal(
      colorLiteral.test(fs.readFileSync(file, 'utf8')),
      false,
      `Hardcoded color in ${file}`,
    );
  }
});
