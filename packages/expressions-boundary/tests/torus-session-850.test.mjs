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

// O-I #855 round 6d (PROPOSE of 854): QL's torus-state names the M2 condition's maqām (its name, coordinate and role, with its eight pitches
// while the scene holds its voices, or `absent` in the owner's words naming the source it lacks: scene_field.rs maqam_reading), the lens's
// material (m2_material.rs LensMaterial, or why none) and the twelve classes (class_sounds, CLASS_SOUNDS_LAW, or why none). They cross with
// the session, exact, so the Tuning control can say the maqām is absent before it is chosen; an owner from before them states none.
const maqamAbsent = {name: 'Kirdan', coordinate: '#2-4.3-0-4', role: 'tonic', tonic_hz: 196, tuning: 'bimba-spelled24-tet', standing: 'source-held', pitches_hz: null,
  absent: 'maqām Kirdan (#2-4.3-0-4), the condition\'s tonic, has no Bimba spelling in the map, so its eight pitches have no source, and no other tuning stands in'};
const maqamSounding = {...maqamAbsent, pitches_hz: [196, 220, 233.08, 261.63, 293.66, 311.13, 349.23, 392], absent: null};
const material = {lens: 'L5\'', partner: 'L5', face: 'night', position: 5, valence: -1, colour_rgb: [0.2, 0.3, 0.4], roughness: 0.5, elasticity: 0.25,
  particle_affinity: 0.75, tension: 0.6, standing: 'proposed', law: 'a lens gives its surface'};
const classes = {tuning: 'logic', steps: 12.5, law: 'each of the twelve classes stands at the one place of its helix',
  by_class: Array.from({length: 12}, (_, c) => ({pitch_class: c, pitch_name: `n${c}`, key: {row: c % 6, column: 40 + c},
    point: {theta: 0.1 * c, phi: 0.5 * c, arc: c}, sounds: [{mode_ref: `scene:logic/${c % 8}`, frequency_hz: 200 + c, coupling: -0.25}]}))};

test('the maqām, the lens\'s material and the twelve classes cross with the session exact; an owner from before them states none', () => {
  const read = over => readHostedParameters(parameters({torus: session(over)}));
  const whole = read({maqam: maqamAbsent, material, classes});
  assert.equal(typeof whole, 'object', String(whole));
  assert.deepEqual(whole.torus.maqam, maqamAbsent, 'the maqām with the owner\'s words for its absence');
  assert.deepEqual(read({maqam: maqamSounding}).torus.maqam, maqamSounding, 'a maqām the scene holds names its eight pitches');
  assert.deepEqual(whole.torus.material, material);
  assert.deepEqual(whole.torus.classes, classes);
  const absent = read({material: {absent: 'no lens names a surface here'}, classes: {absent: 'this scene holds no maqam voices: its event admits none'}}).torus;
  assert.deepEqual([absent.material, absent.classes], [{absent: 'no lens names a surface here'}, {absent: 'this scene holds no maqam voices: its event admits none'}], 'the owner\'s words for none');
  const before = read({}).torus;
  for (const key of ['maqam', 'material', 'classes']) assert.equal(key in before, false, `${key}: an owner from before states none`);
  for (const [over, fault] of [
    [{maqam: {...maqamAbsent, absent: null}}, /parameters\.torus\.maqam/], [{maqam: {...maqamSounding, absent: 'both'}}, /parameters\.torus\.maqam/],
    [{maqam: {...maqamSounding, pitches_hz: [196, -1]}}, /parameters\.torus\.maqam/], [{maqam: 'Kirdan'}, /parameters\.torus\.maqam/],
    [{material: {...material, roughness: 2}}, /parameters\.torus\.material/], [{material: {...material, valence: 0}}, /parameters\.torus\.material/],
    [{classes: {...classes, by_class: classes.by_class.slice(1)}}, /parameters\.torus\.classes/],
    [{classes: {...classes, by_class: classes.by_class.map((row, c) => c === 3 ? {...row, pitch_class: 4} : row)}}, /parameters\.torus\.classes/],
    [{classes: {...classes, tuning: 'equal'}}, /parameters\.torus\.classes/], [{classes: {absent: ''}}, /parameters\.torus\.classes/],
  ]) assert.match(read(over), fault, JSON.stringify(over).slice(0, 80));
});

// O-I #852 (DLW manual §21.2 Body): what rings crosses exact, as the frame announces the owner's naming of it (instrumentAnnouncement.mjs
// bodyOf, QL scene_field.rs `body`): the torus, or a form with the form it was made from, the owner's preparation, its modes a voice and the
// voices that ring it, and the material it was made of. The Body page's choice crosses as the instrument's closed `body` edit: a form of so
// many modes at a Q, or the torus.
test('what rings crosses exact: the torus, or a form, its preparation, material, modes and voices; the Body page chooses it as one closed edit', () => {
  const read = over => readHostedParameters(parameters({torus: session(over)}));
  const form = {kind: 'fold', form_ref: '#3-controlled', source_ref: 'ql.m3-state/v1@1'};
  const material = {fibre: 'earth', q_factor: 12, strike_share: 0.7, source_ref: 'declared'};
  const body = {kind: 'form', form, preparation_ref: 'sha256:prepared', material, modes: 8, voices: 9};
  assert.deepEqual(read({body}).torus.body, body);
  assert.deepEqual(read({body: {kind: 'torus'}}).torus.body, {kind: 'torus'});
  assert.equal('body' in read({}).torus, false, 'an owner from before names none');
  for (const bad of [{kind: 'plate'}, {kind: 'torus', modes: 8}, {...body, modes: 0}, {...body, modes: 65}, {...body, voices: -1},
    {...body, form: {...form, kind: 'sphere'}}, {...body, form: {...form, form_ref: ''}}, {...body, preparation_ref: 4}, {...body, prepared: {}},
    {...body, material: {...material, fibre: 'wood'}}, {...body, material: {...material, q_factor: 0}}, {...body, material: {...material, strike_share: 1.5}},
    {...body, material: {...material, source_ref: ''}}, {...body, material: {...material, damping: 'law'}}])
    assert.match(read({body: bad}), /parameters\.torus\.body/, JSON.stringify(bad).slice(0, 80));
  const choice = {kind: 'body', body: {modes: 8, q_factor: 4.5, material: 'tattva'}};
  assert.deepEqual(readInstrumentEdit(choice), choice);
  assert.deepEqual(readInstrumentEdit({kind: 'body', body: null}), {kind: 'body', body: null});
  assert.deepEqual(readStageRequest(stageRequestMessage(3, {command: 'instrument', edit: choice})).command, {command: 'instrument', edit: choice});
  assert.equal(readInstrumentEdit({kind: 'body', body: {modes: 8, q_factor: 4.5, material: 'tattva', form: 'fold'}}), null, 'the form is the scene\'s, never the hand\'s');
});

// O-I 856: where the Torus is heard from crosses exactly: Receiver On or Off, the owner's context and its refusal. The place is the listener's
// own, so a frame that announced one would be refused by name.
test('Receiver crosses exact: On or Off, the owner\'s context and its refusal, never a place; a frame from before it announces none', () => {
  const receiver = {on: true, context: 'personal', refusal: null};
  assert.deepEqual(readHostedParameters(parameters({receiver})).receiver, receiver);
  assert.deepEqual(readHostedParameters(parameters({receiver: {on: false, context: 'world', refusal: 'no torus here'}})).receiver,
    {on: false, context: 'world', refusal: 'no torus here'});
  assert.equal('receiver' in readHostedParameters(parameters()), false, 'a frame that announces none carries none');
  for (const [bad, words] of [[{...receiver, at_metres: [0, 0, 3]}, /^parameters\.receiver\.at_metres: not announced/], [{...receiver, on: 'yes'}, /^parameters\.receiver\.on:/],
    [{...receiver, context: 'mine'}, /^parameters\.receiver\.context:/], [{...receiver, refusal: 7}, /^parameters\.receiver\.refusal:/], ['on', /^parameters\.receiver: expected/]])
    assert.match(readHostedParameters(parameters({receiver: bad})), words, JSON.stringify(bad));
  assert.deepEqual(readInstrumentEdit({kind: 'receiver', on: false}), {kind: 'receiver', on: false});
  assert.equal(readInstrumentEdit({kind: 'receiver', on: true, at_metres: [0, 0, 3]}), null, 'the shell sends On or Off, never a place');
  const message = stageRequestMessage(3, {command: 'instrument', edit: {kind: 'receiver', on: true}});
  assert.deepEqual(readStageRequest(structuredClone(message)), {req: 3, command: {command: 'instrument', edit: {kind: 'receiver', on: true}}});
});

// O-I #856 (QL-MEF #383, f16812eb; QL-MEF #289 packet N): a third context is explicitly shared, the place you stand shared under a named
// reference, and so disclosed with it; a context is returned to by name, where it last stood. The frame announces the shared reference and
// never a place; the shell sends a reference, which the owner judges in its own words, or a context to return to.
test('a shared Receiver crosses with its reference and never a place; the shell sends a reference to share under or a context to return to', () => {
  const shared = {on: true, context: 'shared', shared: 'room-7', refusal: null};
  assert.deepEqual(readHostedParameters(parameters({receiver: shared})).receiver, shared);
  for (const [bad, words] of [[{on: true, context: 'shared', refusal: null}, /^parameters\.receiver\.shared: expected the reference the place is shared under/],
    [{on: true, context: 'personal', shared: 'room-7', refusal: null}, /^parameters\.receiver\.shared: only a shared place is announced with a reference/],
    [{...shared, shared: 7}, /^parameters\.receiver\.shared: expected the reference/], [{...shared, at_metres: [0, 0, 3]}, /^parameters\.receiver\.at_metres: not announced/]])
    assert.match(readHostedParameters(parameters({receiver: bad})), words, JSON.stringify(bad));
  assert.deepEqual(readInstrumentEdit({kind: 'receiver', on: true, shared: 'room-7'}), {kind: 'receiver', on: true, shared: 'room-7'});
  assert.deepEqual(readInstrumentEdit({kind: 'receiver', on: true, shared: 'room 7'}), {kind: 'receiver', on: true, shared: 'room 7'},
    'the owner judges a reference\'s form, and refuses one it does not admit in its own words');
  for (const context of ['world', 'personal', 'shared']) assert.deepEqual(readInstrumentEdit({kind: 'receiver', context}), {kind: 'receiver', context});
  for (const bad of [{kind: 'receiver', on: false, shared: 'room-7'}, {kind: 'receiver', on: true, shared: 7}, {kind: 'receiver', context: 'mine'},
    {kind: 'receiver', on: true, context: 'world'}, {kind: 'receiver', on: true, shared: 'x'.repeat(4097)}, {kind: 'receiver', context: 'shared', shared: 'room-7'}])
    assert.equal(readInstrumentEdit(bad), null, JSON.stringify(bad).slice(0, 80));
});
