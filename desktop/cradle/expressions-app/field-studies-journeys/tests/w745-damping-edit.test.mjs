// O-I #745 lane N: the Torus's Damping on the stage channel. The manual's Damping is a Q factor (DLW §21.2 the Torus, "Damping | Q factor
// 0.1 to 40"); the native field takes a decay rate per second (QL scene_field.rs set_damping, `set-damping`). The instrument edit carries the
// Q (stageCommands.ts InstrumentEdit `damping`), and the frame lowers it per material mode, per_second = π·frequency_hz / Q, before the
// owner takes it (nativeField.ts lowerQDamping, the instrument command's damping case). Run after `npm run build:journeys` (this suite
// imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readInstrumentEdit,STAGE_INSTRUMENT_Q} from '../build/stageCommands.js';
import {lowerQDamping} from '../build/nativeField.js';

const nativeField = await readFile(new URL('../src/nativeField.ts', import.meta.url), 'utf8');

test('the stage channel admits the body\'s Damping as a Q factor within the manual\'s range, and nothing else', () => {
  assert.deepEqual(STAGE_INSTRUMENT_Q, {min: 0.1, max: 40});
  assert.deepEqual(readInstrumentEdit({kind: 'damping', q_factor: 12}), {kind: 'damping', q_factor: 12});
  assert.deepEqual(readInstrumentEdit({kind: 'damping', q_factor: 0.1}), {kind: 'damping', q_factor: 0.1});
  for (const wrong of [{kind: 'damping', q_factor: 0.05}, {kind: 'damping', q_factor: 40.5}, {kind: 'damping', q_factor: Number.NaN},
    {kind: 'damping', q_factor: '12'}, {kind: 'damping'}, {kind: 'damping', q_factor: 12, per_second: 3}, {kind: 'damping', per_second: 3}])
    assert.equal(readInstrumentEdit(wrong), null, JSON.stringify(wrong));
});

test('a Q factor is lowered per material mode as π·f/Q; the scene, which keeps one rate for its voices, takes its lowest voice\'s', () => {
  // The scene's voices as the owner announces them (scene.ts SceneVoice: planet_ref, frequency_hz).
  const voices = [{planet_ref: '#2-5-3', frequency_hz: 330}, {planet_ref: '#2-5-(0/1)', frequency_hz: 220}, {planet_ref: '#2-5-9', frequency_hz: 495}];
  const lowered = lowerQDamping(voices, 12);
  assert.deepEqual(lowered.modes.map(mode => [mode.mode, Number(mode.per_second.toFixed(6))]),
    [['#2-5-3', Number((Math.PI * 330 / 12).toFixed(6))], ['#2-5-(0/1)', Number((Math.PI * 220 / 12).toFixed(6))], ['#2-5-9', Number((Math.PI * 495 / 12).toFixed(6))]]);
  assert.equal(lowered.fundamental_hz, 220);
  assert.equal(lowered.per_second, Math.PI * 220 / 12, 'the lowest voice rings at exactly the Q');
  assert.throws(() => lowerQDamping([], 12), /no voices/);
  assert.throws(() => lowerQDamping(voices, 0), /Q factor/);
  assert.throws(() => lowerQDamping([{planet_ref: '#2-5-3', frequency_hz: 0}], 12), /frequency/);
});

test('the instrument command damps the scene\'s body through the owner\'s own set-damping, and refuses by name without a scene', () => {
  const start = nativeField.indexOf('const command=async(edit:InstrumentEdit)');
  const body = nativeField.slice(start, nativeField.indexOf('/** Enter the Live cut', start));
  const damping = body.slice(body.indexOf("edit.kind==='damping'"));
  assert.ok(damping.length > 0, 'the command has a damping case');
  assert.match(damping, /lowerQDamping\(/);
  assert.match(damping, /controller\.operate\(\{operation:'set-damping',per_second:/);
  assert.match(damping, /throw new Error\('No scene is open/);
});
