// The Torus's M1′ session crosses the hosted stage channel (O-I #850; DLW manual §21.2): one closed `torus` instrument edit carries
// any of QL's own settings (rate Free or Sync, tempo, Fundamental, Carrier, Shape, Tuning, Polyphony), typed and closed here, its range
// the owner's to refuse in words; the frame's announced session (`parameters.torus`) is read exact or refused by name. The retired
// controls (Pulse mix, Helix balance, Drive, Agitation, Attack, Release) have no edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readStageRequest, stageRequestMessage, readInstrumentEdit, readHostedParameters} from '../src/index.ts';

const parameters = over => ({muted: false, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, ...over});
const session = over => ({
  settings: {rate: {mode: 'free', steps_per_second: 2.5}, fundamental: {source: 'map'}, carrier: 0, shape: 'auto', tuning: 'sky', polyphony: 16, tempo_bpm: 120},
  steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'figure-eight', comma_cents: 0, notes: 0,
  resident_tunings: ['logic', 'sky'], carrier_drive: 'unbuilt', ...over,
});

test('every Torus setting QL takes reads as one closed instrument edit, as given', () => {
  const edits = [
    {rate: {mode: 'free', steps_per_second: 440}}, {rate: {mode: 'free', steps_per_second: 1 / (365.25 * 86400)}},
    {rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}, tempo_bpm: 90}, {tempo_bpm: 60},
    {fundamental: {source: 'map'}}, {fundamental: {source: 'hz', hz: 261.6}},
    {carrier: 0}, {carrier: 1}, {shape: 'auto'}, {shape: 'klein-bottle'}, {shape: 'sequence'},
    {tuning: 'logic'}, {tuning: 'maqam'}, {tuning: 'sky'}, {polyphony: 1}, {polyphony: 32},
    {rate: {mode: 'free', steps_per_second: 2.5}, carrier: 0.5, shape: 'spiral', tuning: 'logic', polyphony: 4, fundamental: {source: 'hz', hz: 220}},
  ];
  for (const edit of edits) {
    const instrument = {kind: 'torus', edit};
    assert.deepEqual(readInstrumentEdit(instrument), instrument, JSON.stringify(edit));
    assert.deepEqual(readStageRequest(stageRequestMessage(4, {command: 'instrument', edit: instrument})), {req: 4, command: {command: 'instrument', edit: instrument}});
  }
});

test('a Torus edit with no setting, an unknown or retired one, or a mistyped operand is refused before anything is posted', () => {
  const refused = [
    {}, {drive: 1}, {pulseMix: 50}, {helixBalance: 50}, {agitation: 0.3}, {attack: 0.01}, {release: 1.2},
    {rate: {mode: 'free'}}, {rate: {mode: 'free', steps_per_second: NaN}}, {rate: {mode: 'free', steps_per_second: 2.5, note: {numerator: 1, denominator: 4}}},
    {rate: {mode: 'sync', note: {numerator: 1.5, denominator: 4}}}, {rate: {mode: 'sync'}}, {rate: {mode: 'beat', steps_per_second: 2}},
    {fundamental: {source: 'hz'}}, {fundamental: {source: 'map', hz: 220}}, {fundamental: 220},
    {carrier: '50%'}, {shape: 'circle'}, {tuning: 'equal'}, {polyphony: 1.5}, {polyphony: '4'}, {tempo_bpm: Infinity},
  ];
  for (const edit of refused) {
    assert.equal(readInstrumentEdit({kind: 'torus', edit}), null, JSON.stringify(edit));
    assert.equal(stageRequestMessage(1, {command: 'instrument', edit: {kind: 'torus', edit}}), null, JSON.stringify(edit));
  }
  assert.equal(readInstrumentEdit({kind: 'torus', edit: {carrier: 0}, extra: true}), null, 'the edit itself is closed');
  for (const kind of ['drive', 'pulse-mix', 'helix-balance', 'agitation', 'attack', 'release']) assert.equal(readInstrumentEdit({kind, value: 1}), null, `${kind}: retired`);
});

test('the frame\'s announced Torus session is read exact, and a malformed one is refused by name', () => {
  const read = readHostedParameters(parameters({torus: session()}));
  assert.equal(typeof read, 'object');
  assert.deepEqual(read.torus, session(), 'the owner\'s session, unchanged');
  assert.equal(readHostedParameters(parameters()).torus, undefined, 'a frame that announces none carries none');
  assert.deepEqual(readHostedParameters(parameters({torus: session({figure: null, settings: {...session().settings, shape: 'sequence', rate: {mode: 'sync', note: {numerator: 1, denominator: 4}}}})})).torus.figure, null,
    'Sequence names no figure: the scene\'s shapes are its own');
  for (const [over, fault] of [
    [{band: 'audio'}, /parameters\.torus\.band/], [{comma_cents: -1}, /parameters\.torus\.comma_cents/], [{notes: 1.5}, /parameters\.torus\.notes/],
    [{figure: 'circle'}, /parameters\.torus\.figure/], [{resident_tunings: ['equal']}, /parameters\.torus\.resident_tunings/],
    [{settings: {...session().settings, tuning: 'equal'}}, /parameters\.torus\.settings/], [{fundamental_hz: 'map'}, /parameters\.torus\.fundamental_hz/],
    [{carrier_drive: 7}, /parameters\.torus\.carrier_drive/],
  ]) assert.match(readHostedParameters(parameters({torus: session(over)})), fault, JSON.stringify(over));
});

// O-I #854 (DLW manual §21.2 Body: "Strike | 0 to 100 % | 70 % | How strongly velocity excites the body"): QL's M1′ session holds Strike
// as a share 0..1, so the Body group's Strike crosses as the same closed `torus` edit, and the announced session carries it.
test('Strike crosses as a share of velocity: the edit as given, the announced session exact, an owner from before it stating none', () => {
  for (const edit of [{strike: 0}, {strike: 0.45}, {strike: 1}, {strike: 0.7, carrier: 0.5}]) {
    const instrument = {kind: 'torus', edit};
    assert.deepEqual(readInstrumentEdit(instrument), instrument, JSON.stringify(edit));
    assert.deepEqual(readStageRequest(stageRequestMessage(2, {command: 'instrument', edit: instrument})), {req: 2, command: {command: 'instrument', edit: instrument}});
  }
  for (const edit of [{strike: '45%'}, {strike: NaN}, {strike: null}]) assert.equal(readInstrumentEdit({kind: 'torus', edit}), null, JSON.stringify(edit));
  const stated = session({settings: {...session().settings, strike: 0.45}});
  assert.deepEqual(readHostedParameters(parameters({torus: stated})).torus, stated, 'the owner\'s Strike, unchanged');
  assert.equal('strike' in readHostedParameters(parameters({torus: session()})).torus.settings, false, 'an owner stating no Strike carries none');
  for (const strike of [1.5, -0.1, '70%']) assert.match(readHostedParameters(parameters({torus: session({settings: {...session().settings, strike}})})), /parameters\.torus\.settings: expected Strike as a share 0\.\.1/, String(strike));
});
