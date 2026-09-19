/** Techne theme derivation — unit tests (node --test). Mirrors app.ts theme(). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { techneLuminance, deriveTechneTheme, sceneTechneTheme, applyTechneTheme } from '../src/techne-theme.mjs';

test('luminance is the Rec. 709 sum on the 0..255 scale', () => {
  assert.equal(techneLuminance('#000000'), 0);
  // 0.2126+0.7152+0.0722 is 1.0 only to floating point, so white lands a
  // fraction under 255 — the module stays faithful to app.ts's raw weights.
  assert.ok(Math.abs(techneLuminance('#ffffff') - 255) < 1e-9);
  // app.ts parses hex.slice(1,3|3,5|5,7) and weights 0.2126/0.7152/0.0722.
  assert.ok(Math.abs(techneLuminance('#f4f2eb') - (0.2126 * 244 + 0.7152 * 242 + 0.0722 * 235)) < 1e-9);
});

test('derivation agrees with the known cases', () => {
  const cases = [
    ['#f4f2eb', 'scene', { night: false, hudContrast: false }],
    ['#ffffff', 'scene', { night: false, hudContrast: false }],
    ['#000000', 'scene', { night: true, hudContrast: false }],
    ['#10140f', 'scene', { night: true, hudContrast: false }],
    ['#000000', 'light', { night: false, hudContrast: true }],
    ['#ffffff', 'dark', { night: true, hudContrast: true }],
    ['#10140f', 'dark', { night: true, hudContrast: false }],
    ['#f4f2eb', 'light', { night: false, hudContrast: false }],
  ];
  for (const [paper, appearance, expected] of cases) {
    assert.deepEqual(deriveTechneTheme({ paper, appearance }), { ...expected, luminance: techneLuminance(paper) }, `${paper} ${appearance}`);
  }
});

test('the night threshold is strict: luminance 100 reads light', () => {
  assert.equal(deriveTechneTheme({ paper: '#646464', appearance: 'scene' }).night, false); // 0.6410*... = exactly 100
  assert.equal(deriveTechneTheme({ paper: '#636363', appearance: 'scene' }).night, true);
});

test('malformed input is rejected', () => {
  assert.throws(() => techneLuminance('f4f2eb'), TypeError);
  assert.throws(() => techneLuminance('#f4f2e'), TypeError);
  assert.throws(() => deriveTechneTheme({ paper: '#000000', appearance: 'system' }), TypeError);
  assert.throws(() => deriveTechneTheme({}), TypeError);
});

test('sceneTechneTheme reads the engine document shape', () => {
  const theme = sceneTechneTheme({ field: { background: '#10140f', palette: ['#e4e8dc'] } });
  assert.equal(theme.night, true);
  assert.equal(theme.ink, '#e4e8dc');
});

test('applyTechneTheme sets the attributes and world hooks idempotently', () => {
  const properties = new Map();
  const root = {
    style: { setProperty(name, value) { properties.set(name, value); } },
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
  };
  const theme = applyTechneTheme(root, { paper: '#000000', ink: '#ededed', appearance: 'scene' });
  assert.equal(theme.night, true);
  assert.equal(root.attributes.get('data-techne-night'), 'true');
  assert.equal(root.attributes.get('data-techne-hud-contrast'), 'false');
  assert.equal(properties.get('--oi-world-surface'), '#000000');
  assert.equal(properties.get('--oi-world-foreground'), '#ededed');
  // Forced light over a dark scene raises hud contrast, not night.
  const forced = applyTechneTheme(root, { paper: '#000000', appearance: 'light' });
  assert.equal(forced.night, false);
  assert.equal(forced.hudContrast, true);
  assert.equal(root.attributes.get('data-techne-hud-contrast'), 'true');
  assert.throws(() => applyTechneTheme(null, { paper: '#000000' }), TypeError);
});
