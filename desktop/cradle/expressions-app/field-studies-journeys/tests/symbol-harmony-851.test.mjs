// O-I 851, the open line (DLW §20.2: "A symbol has a voice: the symbol translated into sound. It is the symbol's harmony, the chord whose
// figure on the torus is the symbol's shape, and you hear it from where the symbol stands. The pulse sounds it, as it sounds everything. A
// name or a mode from M2′'s store of sound can stand in for the translation"). QL's Torus reading says where each of the twelve classes
// stands on the body and what each sounds under the tuning in force (scene_field.rs class_sounds); the frame lays the symbol's form on
// the body at its place, takes the classes its form covers, and their chord is the voice's bands. Moving the symbol moves the voice.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/symbol-harmony-851.test.mjs
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const native = join(journeys, 'src/native-field');
const out = mkdtempSync(join(tmpdir(), 'symbol-harmony-851-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`), from = typeof entry === 'string' ? {entryPoints: [entry]} : {stdin: {resolveDir: join(journeys, 'src'), loader: 'ts', contents: entry.stdin}};
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], ...from, bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const harmony = () => bundle(join(native, 'symbolHarmony.ts'), 'harmony');
const voices = () => bundle(join(native, 'symbolVoices.ts'), 'voices');
const sound = () => bundle(join(native, 'entitySound.ts'), 'sound');
const object = () => bundle(join(journeys, '../src/engine/torusObject.ts'), 'object');
const play = () => import(pathToFileURL(join(native, 'torusPlay.mjs')).href);
const near = (a, b, tolerance, label = '') => assert.ok(Math.abs(a - b) <= tolerance, `${label} ${a} vs ${b}`);
const TAU = Math.PI * 2;

// A body as the owner's influence states it: eight Logic voices on their helices, four boundaries (QL scene_field.rs group).
const HZ = [196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392];
const BOUNDARIES = [0, 1, 2, 3].map(i => ({m: 2 + i, n: 3 + (i % 2), helix: i < 2 ? 'bimba' : 'pratibimba', ql_position: (i % 2) * 5}));
const VOICES = HZ.map((hz, k) => {
  const helix = Math.floor(k / 4), position = (k % 4) + 1, boundary = BOUNDARIES[helix * 2 + (position >= 3 ? 1 : 0)];
  return {mode_ref: `scene:logic/${k}`, frequency_hz: hz, m: boundary.m, n: boundary.n, helix: helix ? 'pratibimba' : 'bimba', ql_position: position,
    longitude_radians: position * Math.PI / 3, weight: hz / 392, phase_radians: (k + 1) * Math.PI / 36};
});
const influence = {voices: VOICES, boundaries: BOUNDARIES, geometry: {metres_per_unit: 1, attachment: 1}, material: {strike_metres: 0.08}};
// The twelve classes as QL's reading gives them (janko POINT_LAW: φ = 60°·((arc + steps) mod 6), θ = 30°·((arc + steps) mod 12)).
// Class c stands at arc (5c) mod 12 here: any one-to-one placing does; the frame reads it, never derives it.
const pointAt = (arc, steps) => { const arcs = ((arc + steps) % 12 + 12) % 12; return {arc: Math.floor(arcs) % 12, theta: arcs * Math.PI / 6, phi: (arcs % 6) * Math.PI / 3}; };
const qlClasses = async steps => {
  const {chi} = await object();
  return {tuning: 'logic', steps, law: 'QL CLASS_SOUNDS_LAW', by_class: Array.from({length: 12}, (_, c) => {
    const arc = (5 * c) % 12, point = pointAt(arc, steps);
    return {pitch_class: c, pitch_name: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][c], key: {row: c % 2, column: 0},
      place: {helix: arc >= 6 ? 1 : 0, position: arc % 6, arc, cover_degrees: arc * 60}, point: {...point, place: {arc}, pulse_steps: steps},
      sounds: VOICES.map(v => ({mode_ref: v.mode_ref, frequency_hz: v.frequency_hz, coupling: chi(v, point.phi, point.theta)}))};
  })};
};
const owner = classes => ({status: 'following', instrument: {acting: {voices: []}, influence, torus: {pulse: {steps: classes?.steps ?? 0}, steps_per_second: 2.5, band: 'rhythm', classes}}});
// Where a class stands on the stage: the body laid flat, one stage unit a side, centred on the stage's origin.
const plateOf = cls => ({x: cls.phi / TAU - 0.5, y: cls.theta / TAU - 0.5});
const FULL = (n = 8) => ({size: n, cells: new Uint8Array(n * n).fill(1)});

test('the Torus reading\'s twelve classes reach the voices: where each stands and what it sounds under the tuning in force', async () => {
  const {torusPlayReading} = await play();
  const table = await qlClasses(0);
  const read = torusPlayReading(owner(table)).classes;
  assert.equal(read.tuning, 'logic');
  assert.equal(read.steps, 0);
  assert.equal(read.steps_per_second, 2.5);
  assert.equal(read.by_class.length, 12);
  for (const [c, cls] of read.by_class.entries()) {
    assert.equal(cls.pitch_class, c);
    assert.equal(cls.place_arc, table.by_class[c].place.arc, 'its place on its helix, which never moves');
    assert.deepEqual([cls.phi, cls.theta], [table.by_class[c].point.phi, table.by_class[c].point.theta], 'its point at the reading\'s steps');
    assert.deepEqual(cls.sounds, table.by_class[c].sounds, 'what it sounds, as the owner says it');
  }
  assert.match(torusPlayReading(null).classes.absentBecause, /No instrument is open/);
  assert.match(torusPlayReading(owner(undefined)).classes.absentBecause, /names no classes/);
  assert.match(torusPlayReading(owner({absent: 'this scene holds no maqam voices: its event admits none'})).classes.absentBecause, /maqam/);
});

test('between reads the pulse carries each class by the owner\'s law, and at the reading\'s own steps the couplings are the owner\'s', async () => {
  const {torusPlayReading} = await play();
  const {classesAt} = await harmony();
  const {bodyOf, chi} = await object();
  const body = bodyOf(influence), read = torusPlayReading(owner(await qlClasses(1.5))).classes;
  const same = classesAt(read, body, 1.5);
  for (const [c, cls] of same.entries()) {
    near(cls.phi, read.by_class[c].phi, 1e-12); near(cls.theta, read.by_class[c].theta, 1e-12);
    cls.sounds.forEach((s, k) => near(s.coupling, read.by_class[c].sounds[k].coupling, 1e-12, 'the owner\'s coupling'));
  }
  const later = classesAt(read, body, 2.75);
  for (const [c, cls] of later.entries()) {
    const point = pointAt(read.by_class[c].place_arc, 2.75);
    near(cls.phi, point.phi, 1e-12, 'φ'); near(cls.theta, point.theta, 1e-12, 'θ');
    cls.sounds.forEach((s, k) => { near(s.coupling, chi(VOICES[k], point.phi, point.theta), 1e-12, 'its shape at the carried point'); assert.equal(s.frequency_hz, VOICES[k].frequency_hz); });
  }
  // Without the body the reading stands as read: the pulse is not guessed.
  assert.deepEqual(classesAt(read, null, 9).map(c => c.phi), read.by_class.map(c => c.phi));
});

test('a symbol\'s form laid on the body at its place covers the classes standing under it, and moving it moves which', async () => {
  const {coveredClasses} = await harmony();
  const {by_class} = (await play()).torusPlayReading(owner(await qlClasses(0))).classes;
  const at = (cls, size = 0.06, mask = FULL()) => coveredClasses(by_class, {...plateOf(cls), width: size, height: size, rotation: 0}, mask).map(c => c.pitch_class);
  for (const cls of by_class) assert.deepEqual(at(cls), [cls.pitch_class], `a small form on class ${cls.pitch_class} covers it alone`);
  const three = by_class[3], seven = by_class[7];
  assert.deepEqual(at(three), [3]); assert.deepEqual(at(seven), [7], 'moved, it covers another');
  // The body tiles the stage: a whole stage unit away the same class stands under it again.
  assert.deepEqual(coveredClasses(by_class, {x: plateOf(three).x + 1, y: plateOf(three).y - 2, width: 0.06, height: 0.06, rotation: 0}, FULL()).map(c => c.pitch_class), [3]);
  // Its shape, not its box: a ring's hole over the class covers nothing.
  const ring = {size: 9, cells: new Uint8Array(81).fill(1)}; ring.cells[4 * 9 + 4] = 0;
  assert.deepEqual(at(three, 0.06, ring), [], 'the hole is not the form');
  assert.deepEqual(coveredClasses(by_class, {x: 0, y: 0, width: 1, height: 1, rotation: 0}, FULL()).length, 12, 'a form the size of the body covers all twelve');
  // Turned, a bar covers what lies along its own length.
  const bar = {size: 8, cells: new Uint8Array(64)}; for (let col = 0; col < 8; col++) bar.cells[4 * 8 + col] = bar.cells[3 * 8 + col] = 1;
  const centre = plateOf(three), across = coveredClasses(by_class, {...centre, width: 1.1, height: 0.04, rotation: 0}, bar).map(c => c.pitch_class);
  const upright = coveredClasses(by_class, {...centre, width: 1.1, height: 0.04, rotation: 90}, bar).map(c => c.pitch_class);
  assert.deepEqual(across, [3], 'lying along the ring it covers the one class at its height');
  assert.deepEqual(upright, [3, 9], 'turned to stand along the tube it covers the classes at its ring place: turning the form turns what it covers');
  assert.deepEqual(coveredClasses(by_class, {...centre, width: 0.06, height: 0.06, rotation: 0}, null), [], 'a form not yet sampled covers nothing');
});

test('the harmony is the chord the covered classes strike: each voice by its summed coupling, at the voice\'s own frequency', async () => {
  const {harmonyOf, coveredClasses} = await harmony();
  const {by_class} = (await play()).torusPlayReading(owner(await qlClasses(0))).classes;
  const covered = [by_class[2], by_class[9]];
  const result = harmonyOf(covered, 48000);
  assert.equal(result.state, 'carrying');
  const sums = VOICES.map((v, k) => Math.abs(covered[0].sounds[k].coupling + covered[1].sounds[k].coupling)), max = Math.max(...sums);
  const expected = VOICES.map((v, k) => ({hz: v.frequency_hz, gain: sums[k] / max, ref: v.mode_ref})).sort((a, b) => a.hz - b.hz);
  assert.deepEqual(result.harmony.bands.map(b => b.centreHz), expected.map(b => b.hz), 'a band at each voice of the tuning, at its own frequency');
  assert.deepEqual(result.harmony.bands.map(b => b.modeRefs), expected.map(b => [b.ref]));
  assert.equal(Math.max(...result.harmony.bands.map(b => b.gain)), 1, 'the loudest voice of the chord at full weight');
  result.harmony.bands.forEach((band, i) => {
    near(band.gain, expected[i].gain, 1e-12, 'by its summed coupling');
    const below = i > 0 ? band.centreHz - expected[i - 1].hz : Infinity, above = i < expected.length - 1 ? expected[i + 1].hz - band.centreHz : Infinity;
    near(band.widthHz, Math.min(below, above) / 2, 1e-9, 'half the distance to its nearer neighbour');
    near(band.q, band.centreHz / band.widthHz, 1e-9);
  });
  assert.deepEqual(result.harmony.classes, [2, 9]);
  const none = harmonyOf([], 48000);
  assert.equal(none.state, 'absent');
  assert.match(none.because, /covers none of the twelve classes/);
  assert.match(none.because, /pulse/);
  // A full form covers all twelve: its harmony is every voice the whole body moves.
  assert.equal(harmonyOf(coveredClasses(by_class, {x: 0, y: 0, width: 1, height: 1, rotation: 0}, FULL()), 48000).harmony.classes.length, 12);
  // Nodes: classes that give no voice anything are a chord of nothing, and say so.
  const still = covered.map(cls => ({...cls, sounds: cls.sounds.map(s => ({...s, coupling: 0}))}));
  assert.match(harmonyOf(still, 48000).because, /strike no voice where they stand now/);
  // A voice above the device's Nyquist has no band.
  assert.ok(harmonyOf(covered, 600).harmony.bands.every(b => b.centreHz < 300));
});

test('a voice with no name or mode sounds the symbol\'s own harmony, on bands with its chord\'s weights; a name or a mode stands in for it', async () => {
  const {entitySoundPlan} = await sound();
  const {SymbolVoices} = await voices();
  const {harmonyOf} = await harmony();
  const {by_class} = (await play()).torusPlayReading(owner(await qlClasses(0))).classes;
  const entities = [{id: 'a', sound: {enabled: true, gain: 0.5}}, {id: 'b', sound: {enabled: true, carry: {kind: 'name', ref: 'shem/1'}}}];
  const plan = entitySoundPlan({entities});
  assert.deepEqual(plan.voices.map(v => [v.entityId, v.carry]), [['a', null], ['b', {kind: 'name', ref: 'shem/1'}]], 'no name or mode: the translation');
  assert.deepEqual(plan.silent, []);
  const nodes = [], node = (kind, extra = {}) => { const n = {kind, out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect(t) { if (t === undefined) this.out.clear(); else this.out.delete(t); }, ...extra}; nodes.push(n); return n; };
  const param = value => ({value, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, cancelScheduledValues() {}});
  const context = {sampleRate: 48000, currentTime: 0, destination: {kind: 'destination', out: new Set()}, createGain: () => node('gain', {gain: param(1)}),
    createBiquadFilter: () => node('biquad', {type: 'lowpass', frequency: param(350), Q: param(1)}), createStereoPanner: () => node('panner', {pan: param(0)}),
    createOscillator() { throw new Error('no oscillator'); }};
  const tap = {context, input: node('tap')};
  const bank = new SymbolVoices(); bank.attach(tap);
  const chord = harmonyOf([by_class[2], by_class[9]], 48000);
  const input = {plan, catalogue: {modes: new Map(), absent: new Map()}, catalogueWhy: null, root: {hz: 130.81, absentBecause: null}, torusSilentBecause: null,
    places: new Map([['a', 0.25]]), muted: false, harmonies: new Map([['a', chord]])};
  const readings = bank.sync(input);
  const a = readings.find(r => r.entityId === 'a');
  assert.deepEqual([a.state, a.mode, a.bands, a.harmony], ['carrying', null, chord.harmony.bands.length, [2, 9]]);
  const filters = nodes.filter(n => n.kind === 'biquad');
  assert.equal(filters.length, chord.harmony.bands.length);
  filters.forEach((filter, i) => {
    const band = chord.harmony.bands[i], [weight] = [...filter.out];
    assert.equal(filter.frequency.value, band.centreHz); assert.equal(filter.Q.value, band.q); assert.ok(tap.input.out.has(filter));
    assert.equal(weight.kind, 'gain'); assert.equal(weight.gain.value, band.gain, 'each band at its chord\'s weight');
  });
  assert.equal(readings.find(r => r.entityId === 'b').state, 'absent', 'a name the store gives no sound stands in, and says so');
  // Moved: another chord, the same bank retuned in place or rebuilt to its new count.
  const moved = harmonyOf([by_class[5]], 48000);
  bank.sync({...input, harmonies: new Map([['a', moved]])});
  assert.deepEqual(bank.inspect().voices.find(v => v.entityId === 'a').harmony, [5], 'moving the symbol moves the voice');
  const live = nodes.filter(n => n.kind === 'biquad' && tap.input.out.has(n));
  assert.deepEqual(live.map(f => f.frequency.value).sort((x, y) => x - y), moved.harmony.bands.map(b => b.centreHz));
  const gone = bank.sync({...input, harmonies: new Map([['a', harmonyOf([], 48000)]])}).find(r => r.entityId === 'a');
  assert.equal(gone.state, 'absent'); assert.match(gone.because, /covers none/);
  bank.dispose();
});

test('the scene\'s voices take their harmonies from where their symbols stand: the plan, the forms and the classes now', async () => {
  const {symbolHarmonies} = await harmony();
  const {entitySoundPlan} = await sound();
  const {bodyOf} = await object();
  const read = (await play()).torusPlayReading(owner(await qlClasses(0))).classes;
  const three = plateOf(read.by_class[3]), eight = plateOf(read.by_class[8]);
  const scene = position => ({entities: [{id: 'a', position: {...position, z: 0}, size: {x: 0.06, y: 0.06}, rotation: 0, scale: 1, sound: {enabled: true}}]});
  const forms = () => FULL();
  const at = (position, steps = 0) => symbolHarmonies(scene(position).entities, entitySoundPlan(scene(position)), read, bodyOf(influence), steps, forms, 48000).get('a');
  assert.deepEqual(at(three).harmony.classes, [3]);
  assert.deepEqual(at(eight).harmony.classes, [8], 'moving the symbol moves the voice');
  // The pulse carries the classes on: a step later another class stands under the same place.
  const later = at(three, 1);
  assert.notDeepEqual(later.state === 'carrying' ? later.harmony.classes : [], [3], 'the pulse sounds it from where it stands');
  const carried = entitySoundPlan({entities: [{id: 'a', sound: {enabled: true, carry: {kind: 'mode', ref: 'x'}}}]});
  assert.equal(symbolHarmonies(scene(three).entities, carried, read, bodyOf(influence), 0, forms, 48000).size, 0, 'a voice that carries a name or a mode has no harmony to take');
  const closed = (await play()).torusPlayReading(null).classes;
  assert.match(symbolHarmonies(scene(three).entities, entitySoundPlan(scene(three)), closed, null, 0, forms, 48000).get('a').because, /No instrument is open/);
});

test('the form a voice is laid by is the form its particles take: the engine\'s own pool, as cells of its own box', async () => {
  const {formMaskOf} = await harmony();
  const disc = []; for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const x = (i / 63 - 0.5) * 400, y = (j / 63 - 0.5) * 400; if (Math.hypot(x, y) <= 200) disc.push({x, y}); }
  const mask = formMaskOf(disc, 16);
  assert.equal(mask.size, 16);
  assert.equal(mask.cells[0], 0, 'a disc leaves its corners empty');
  assert.equal(mask.cells[8 * 16 + 8], 1, 'and fills its middle');
  const top = formMaskOf([{x: 0, y: 190}], 4);
  assert.equal(top.cells[0 * 4 + 2], 1, 'row 0 is the top of the form (y up)');
  assert.equal(formMaskOf([], 4), null, 'no pool, no form');
});

test('the engine keeps the form each symbol\'s particles take now, so the voice is laid by the form that is drawn', async () => {
  const {EntityRuntime, blankScene, entity, toNativeConfig} = await bundle({stdin: `export {EntityRuntime} from '../../src/engine/entityRuntime'; export {blankScene, entity} from './model'; export {toNativeConfig} from './nativeBridge';`}, 'runtime');
  const {formMaskOf} = await harmony();
  const scene = blankScene('harmony'); scene.entities = [entity('Disc', 'O')];
  const config = toNativeConfig(scene), [e] = config.entities;
  e.shape = {kind: 'primitive', primitive: 'disc'}; e.sequence.links = []; e.sequence.advance = 'off';
  // Primitives need no glyph sampler: none is given.
  const runtime = new EntityRuntime({}); runtime.allocate(4096, 64, 64); runtime.layout([e]);
  assert.equal(runtime.formPool(e.id), null, 'before it is baked there is no form');
  runtime.update([e], config.composition, 0, 0, 0, 0, 'sans-serif', 400);
  const disc = runtime.formPool(e.id), discMask = formMaskOf(disc, 16);
  assert.ok(disc.length > 0 && disc.every(p => Math.hypot(p.x, p.y) <= 205), 'the pool in its own 400-unit box');
  assert.equal(discMask.cells[8 * 16 + 8], 1, 'a disc fills its middle');
  e.shape = {kind: 'primitive', primitive: 'ring'}; runtime.update([e], config.composition, 1, 0, 0, 0, 'sans-serif', 400);
  const ring = runtime.formPool(e.id);
  assert.notEqual(ring, disc, 'a new form is a new pool');
  assert.equal(formMaskOf(ring, 16).cells[8 * 16 + 8], 0, 'a ring leaves its middle empty');
  runtime.layout([]);
  assert.equal(runtime.formPool(e.id), null, 'a symbol that leaves takes its form with it');
});
