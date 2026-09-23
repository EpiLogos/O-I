/**
 * Theme conversion tests: the JSONC surface, the mapping tables, the
 * derived-role fallbacks, the emission shape — and an integration pass that
 * converts every downloaded upstream theme, so the corpus itself is the
 * regression fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseJsonc, normalizeColor, mix, flattenTokenColors, resolveSyntaxColors,
  resolveTerminalColors, mergeInclude, convertTheme, themeVariables, emitCss, emitIndexModule,
  uniqueThemeId, guessAppearance,
} from '../scripts/convert.mjs';

const HERE = fileURLToPath(new URL('../', import.meta.url));

test('parseJsonc takes comments and trailing commas', () => {
  const parsed = parseJsonc(`{
    // a line comment
    "name": "Test", /* a block
       comment */
    "colors": { "editor.background": "#101010", }, // trailing comma above
    "tokenColors": [ { "scope": "comment", "settings": { "foreground": "#111", } }, ],
  }`);
  assert.equal(parsed.name, 'Test');
  assert.equal(parsed.colors['editor.background'], '#101010');
  assert.equal(parsed.tokenColors.length, 1);
});

test('normalizeColor accepts 3/6/8-digit and bare hex, compositing alpha over the ground', () => {
  assert.equal(normalizeColor('#abc'), '#aabbcc');
  assert.equal(normalizeColor('#AABBCC'), '#aabbcc');
  assert.equal(normalizeColor('282a36'), '#282a36');
  assert.equal(normalizeColor('#ff000080', '#ffffff'), '#ff7f7f');
  assert.equal(normalizeColor('#ff000080', '#000000'), '#800000');
  assert.equal(normalizeColor('nope'), null);
});

test('mix walks ground to ink linearly', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#101010', '#101010', 0.4), '#101010');
});

test('tokenColors resolve by TextMate prefix rules: descendant tails do not leak, specific selectors win where they match', () => {
  const pairs = flattenTokenColors([
    { scope: ['comment'], settings: { foreground: '#111111' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6272A4' } },
    { scope: ['comment keyword.codetag.notation'], settings: { foreground: '#FF79C6' } },
    { scope: 'string', settings: { foreground: '#f1fa8c' } },
    { scope: 'string.regexp', settings: { foreground: '#ff9cac' } },
  ]);
  const resolved = resolveSyntaxColors(pairs, '#282a36');
  // The later same-length comment rule wins; the JSDoc descendant rule
  // applies only to its tail scope and must not recolour every comment.
  assert.equal(resolved['--oi-syntax-comment'], '#6272a4');
  // The bare string scope colours the string role…
  assert.equal(resolved['--oi-syntax-string'], '#f1fa8c');
  // …while the regexp selector matches the special role's representative,
  // which no shorter rule overrides there.
  assert.equal(resolved['--oi-syntax-special'], '#ff9cac');
  assert.equal('--oi-syntax-type' in resolved, false);
});

test('the older object tokenColors form converts too', () => {
  const resolved = resolveSyntaxColors(flattenTokenColors({ comment: '#0a0a0a', 'entity.name.function': '#0b0b0b' }), '#ffffff');
  assert.equal(resolved['--oi-syntax-comment'], '#0a0a0a');
  assert.equal(resolved['--oi-syntax-definition'], '#0b0b0b');
});

test('terminal colours map with editor-pair fallbacks and positional ANSI slots', () => {
  const terminal = resolveTerminalColors({
    'terminal.ansiRed': '#ff5555',
    'terminal.selectionBackground': '#334477ee',
  }, '#1e1e2e', '#cdd6f4');
  assert.equal(terminal.background, '#1e1e2e');
  assert.equal(terminal.foreground, '#cdd6f4');
  assert.equal(terminal.selection, '#324172'); // 8-digit alpha composited over the ground
  assert.equal(terminal.ansi.length, 2);
  assert.equal(terminal.ansi[0], undefined); // black slot stays empty
  assert.equal(terminal.ansi[1], '#ff5555'); // red keeps its own slot
});

test('include inheritance merges the parent under the child', () => {
  const merged = mergeInclude(
    { colors: { 'editor.background': '#222222' }, tokenColors: [{ scope: 'comment', settings: { foreground: '#111111' } }] },
    { colors: { 'editor.background': '#ffffff', 'editor.foreground': '#000000' }, tokenColors: [{ scope: 'string', settings: { foreground: '#333333' } }] },
  );
  assert.equal(merged.colors['editor.background'], '#222222');
  assert.equal(merged.colors['editor.foreground'], '#000000');
  assert.equal(merged.tokenColors.length, 2);
});

const BASE_THEME = {
  colors: { 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2', 'sideBar.background': '#21222c' },
  tokenColors: [{ scope: 'keyword', settings: { foreground: '#ff79c6' } }],
};

function convert(overrides = {}, meta = {}) {
  return convertTheme({ ...BASE_THEME, ...overrides }, {
    id: 'test-dark', name: 'Test', appearance: 'dark',
    source: { format: 'vscode-color-theme', name: 'Test', repo: 'example/test', revision: 'r1', license: 'MIT', url: 'x' },
    ...meta,
  });
}

test('conversion colours only existing roles; unmapped workbench keys are ignored', () => {
  const doc = convert({ colors: { ...BASE_THEME.colors, 'some.future.key': '#123456' } });
  const roles = Object.keys(themeVariables(doc));
  for (const role of roles) assert.match(role, /^--oi-/);
  assert.equal(doc.tokens['--oi-sidebar-ground'], '#21222c');
  assert.equal('--oi-title-bar' in doc.tokens, false);
});

test('a minimal theme still grounds the shell through derived roles', () => {
  const doc = convert({ colors: { 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2' }, tokenColors: [] });
  for (const role of ['--oi-rule', '--oi-wash', '--oi-hairline', '--oi-muted-2', '--oi-sidebar-ground', '--oi-shadow-plane']) {
    assert.ok(doc.tokens[role], `${role} derived`);
  }
  assert.ok(doc.tokens['--oi-muted'] !== doc.tokens['--oi-foreground']);
});

test('a theme without editor.background is refused loudly', () => {
  assert.throws(() => convert({ colors: {} }), /editor\.background/);
});

test('emission: css blocks select data-oi-theme and carry terminal roles; index previews stay small', () => {
  const doc = convert();
  const css = emitCss([doc]);
  assert.match(css, /\.oi-desktop\[data-oi-theme="test-dark"\]/);
  assert.match(css, /color-scheme: dark;/);
  const terminal = resolveTerminalColors({ 'terminal.ansiBlack': '#000000', 'terminal.ansiWhite': '#ffffff' }, '#282a36', '#f8f8f2');
  doc.terminal = terminal;
  const withTerminal = emitCss([doc]);
  assert.match(withTerminal, /--oi-terminal-ansi-black: #000000;/);
  const index = emitIndexModule([doc]);
  assert.match(index, /export const THEMES/);
  const payload = index.slice(index.indexOf('=', index.indexOf('THEMES')) + 1).trim().replace(/;$/, '');
  const entry = JSON.parse(payload)[0];
  assert.equal(entry.preview.ground, '#282a36');
  assert.equal(entry.tokens, undefined);
});

test('imported themes get a stable CSS-safe id, deduped against taken ids', () => {
  const taken = new Set(['dracula-dark']);
  assert.equal(uniqueThemeId('My Cool Theme!', taken), 'my-cool-theme');
  assert.equal(uniqueThemeId('dracula-dark', taken), 'dracula-dark-2');
  assert.equal(uniqueThemeId('dracula-dark', new Set(['dracula-dark', 'dracula-dark-2'])), 'dracula-dark-3');
  assert.equal(uniqueThemeId('///', taken), 'theme');
});

test('appearance guesses from the declared type, else the ground lightness', () => {
  assert.equal(guessAppearance({ type: 'hcLight' }), 'light');
  assert.equal(guessAppearance({ colors: { 'editor.background': '#1e1e2e' } }), 'dark');
  assert.equal(guessAppearance({ colors: { 'editor.background': '#F5F5F5' } }), 'light');
  assert.equal(guessAppearance({}), 'dark');
});

/* ---- integration: the downloaded corpus converts end to end --------------- */

const CORPUS = readdirSync(`${HERE}themes/upstream`).filter((name) => name.endsWith('.color-theme.json'));

test(`every upstream theme in the corpus converts (${CORPUS.length})`, () => {
  assert.ok(CORPUS.length >= 5, 'the corpus should carry the downloaded themes');
  const provenance = JSON.parse(readFileSync(`${HERE}themes/upstream/PROVENANCE.json`, 'utf8'));
  const byId = new Map(provenance.themes.map((entry) => [entry.id, entry]));
  for (const file of CORPUS) {
    const id = file.replace('.color-theme.json', '');
    const entry = byId.get(id);
    assert.ok(entry, `${id} has provenance`);
    let theme = parseJsonc(readFileSync(`${HERE}themes/upstream/${file}`, 'utf8'));
    try {
      const include = parseJsonc(readFileSync(`${HERE}themes/upstream/${id}.include.json`, 'utf8'));
      theme = mergeInclude(theme, include);
    } catch { /* no inheritance parent */ }
    const doc = convertTheme(theme, { id: entry.id, name: entry.name, appearance: entry.appearance, source: entry.source });
    assert.equal(doc.schema, 'oi.theme/v1');
    assert.match(doc.tokens['--oi-canvas-ground'], /^#[0-9a-f]{6}$/);
    assert.match(doc.tokens['--oi-foreground'], /^#[0-9a-f]{6}$/);
    for (const value of Object.values(doc.syntax)) assert.match(value, /^#[0-9a-f]{6}$/);
    assert.ok(doc.preview.strip.length >= 1 && doc.preview.strip.length <= 3);
    assert.ok(doc.source.license === 'MIT', `${id} is MIT-licensed`);
  }
});
