// O-I 851 (DLW §21.2 "The Torus in the pane", §20.2 Body and Modes, §20.14 Resonance): the Torus is an object of the scene. Its shapes
// are its states (QL's figure law), its helices are its layers, its eight voices are force points that pull the particles while they
// sound, its four boundaries are where the particles settle, and its morph runs on the pulse. The Resonance plate under Torus takes a,
// b, the amplitudes and the phase from the eight and m, n and the edge from the four. Picture and sound are one state: the native frame.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/torus-object-851.test.mjs
//
// The sources are TypeScript: each test bundles what it needs with the app's own esbuild into a temporary directory (as
// me1-torus-drive.test.mjs does). The native body here is built exactly as QL's owner writes it (continuous_field.hpp write_targets:
// rest + Σ shape_k·Re(A_k), the shapes normal·χ_k rounded to 1e-6, turned by the clock); the owner's own numbers are QL-MEF's tests.
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
const engine = fileURLToPath(new URL('../../src/engine/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'torus-object-851-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`);
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const object = () => bundle(join(engine, 'torusObject.ts'), 'object');
const drive = () => bundle(join(engine, 'torusDrive.ts'), 'drive');
const signal = () => bundle(join(engine, 'morphSignal.ts'), 'signal');
const projection = () => bundle(join(journeys, 'src/native-field/projection.ts'), 'projection');
const play = () => import(new URL('../src/native-field/torusPlay.mjs', import.meta.url));
const near = (a, b, tolerance, label = '') => assert.ok(Math.abs(a - b) <= tolerance, `${label} ${a} vs ${b}`);
const TAU = Math.PI * 2, R = 16 / 9;

// ------------------------------------------------------------------------------------------------- a body as QL's owner writes it

const BOUNDARIES = [{m: 3, n: 4, helix: 'bimba', ql_position: 0}, {m: 5, n: 2, helix: 'bimba', ql_position: 5},
  {m: 4, n: 6, helix: 'pratibimba', ql_position: 0}, {m: 2, n: 3, helix: 'pratibimba', ql_position: 5}];
/** Vimarśā's octet as scene_field.rs places it: slot k at sounding place k mod 4 + 1 of helix k div 4, the nearer boundary's m and n. */
const octet = (address72 = 7) => Array.from({length: 8}, (_, k) => {
  const helix = k < 4 ? 0 : 1, position = (k % 4) + 1, boundary = BOUNDARIES[helix * 2 + (position >= 3 ? 1 : 0)], hz = 220 * (1 + k / 8);
  return {mode_ref: `scene:logic/${k}`, frequency_hz: hz, m: boundary.m, n: boundary.n, helix: boundary.helix, ql_position: position,
    weight: hz / (220 * (1 + 7 / 8)), phase_radians: (address72 + k + 1) * Math.PI / 36, longitude_radians: position * Math.PI / 3};
});
const influence = (overrides = {}) => ({schema: 'ql.expression-influence/v1', voices: octet(), boundaries: BOUNDARIES,
  geometry: {longitude_samples: 24, latitude_samples: 16, metres_per_unit: 1, attachment: 1}, material: {strike_metres: 0.08}, ...overrides});
const chiOf = (v, phi, theta) => {
  const p = phi - v.longitude_radians, a = v.weight * Math.cos(v.phase_radians), b = v.weight * Math.sin(v.phase_radians);
  return a * Math.sin(v.m * p / 2) * Math.sin(v.n * theta / 2) + b * Math.cos(v.m * p / 2) * Math.cos(v.n * theta / 2);
};
/** The frame the owner writes for amplitudes [re, im] per voice (resident order = octet order here), at a clock of `half` half-degrees. */
function nativeFrame({amplitudes, half = 0, samples = '0', generation = '1', inf = influence()}) {
  const {longitude_samples: lon, latitude_samples: lat, metres_per_unit: mpu} = inf.geometry, angle = half * Math.PI / 360;
  const targets = [];
  for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
    const phi = TAU * i / lon, theta = TAU * j / lat, ring = R + Math.cos(theta);
    const normal = [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)];
    const p = [ring * Math.cos(phi) * mpu, ring * Math.sin(phi) * mpu, Math.sin(theta) * mpu];
    inf.voices.forEach((v, k) => {
      const x = chiOf(v, phi, theta);
      for (let axis = 0; axis < 3; axis++) p[axis] += (Math.round(normal[axis] * x * 1e6) / 1e6) * amplitudes[k][0];
    });
    targets.push({identity: j * lon + i, constituent: '#3-0', position: [Math.cos(angle) * p[0] - Math.sin(angle) * p[1], Math.sin(angle) * p[0] + Math.cos(angle) * p[1], p[2]]});
  }
  return {schema: 'ql.continuous-field/v1', event_ref: 'e', subject_ref: 's', registry_revision: 'r', geometry_ref: 'g', material_ref: 'm', model_ref: 'k',
    sample_rate: 48000, generation, samples_elapsed: samples, standing: 'synthetic', audio: [],
    clock: {field_ref: '#3-0', centre_ref: '#3-5-5/0', generation: '1', inscription: {turns: '0', half_degrees: half}, lensing: {turns: '0', half_degrees: 0}},
    m2_identity: {event_ref: 'e', profile_generation: 1}, presentation_units_per_metre: 1, amplitudes_metres: amplitudes, targets};
}
const modeRefs = () => octet().map(v => v.mode_ref);
const chord = (levels) => levels.map((level, k) => [level * 0.08 * Math.cos(k), level * 0.08 * Math.sin(k)]);
const quiet = () => Array.from({length: 8}, () => [0, 0]);
const session = (overrides = {}) => ({schema: 'ql.m1-prime-session/v1', settings: {shape: 'auto'}, steps_per_second: 2, band: 'rhythm',
  pulse: {steps: 0}, figure: 'figure-eight', samples_elapsed: '0',
  figure_law: {return_steps: 12, klein_for_steps: 1, klein_until_steps: null, by_band: {cosmic: 'spiral', breath: 'spiral', rhythm: 'figure-eight', pitch: 'torus', beyond: 'torus'}}, ...overrides});

// ------------------------------------------------------------------------------------------------------------------ the shapes

test('the torus shape is the native rest body, and the inverse gives every sample its own angles and displacement', async () => {
  const {shapePoint, torusCoordinates} = await object();
  for (const [phi, theta, offset, mpu] of [[0.3, 1.1, 0.02, 1], [4.1, 5.9, -0.05, 0.5], [6.0, 3.0, 0, 2]]) {
    const ring = R + Math.cos(theta), rest = [ring * Math.cos(phi), ring * Math.sin(phi), Math.sin(theta)];
    assert.deepEqual(shapePoint('torus', phi, theta).map(v => +v.toFixed(12)), rest.map(v => +v.toFixed(12)));
    const normal = [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)];
    const back = torusCoordinates(rest.map((v, i) => v * mpu + normal[i] * offset), mpu);
    near(back.phi, phi, 1e-12, 'φ'); near(back.theta, theta, 1e-12, 'θ'); near(back.offset, offset, 1e-12, 'd');
  }
});

test('each shape is a closed form within the torus\'s own reach, distinct from the torus, and the Klein bottle meets itself flipped', async () => {
  const {shapePoint, shapeNormal, TORUS_FIGURES} = await object();
  assert.deepEqual([...TORUS_FIGURES], ['torus', 'figure-eight', 'spiral', 'klein-bottle'], 'QL\'s four figures, as the reading spells them');
  for (const figure of TORUS_FIGURES) {
    let apart = 0;
    for (let i = 0; i < 24; i++) for (let j = 0; j < 12; j++) {
      const phi = TAU * i / 24, theta = TAU * j / 12, p = shapePoint(figure, phi, theta), n = shapeNormal(figure, phi, theta);
      assert.ok(p.every(Number.isFinite) && Math.hypot(p[0], p[1]) <= 25 / 9 + 0.5 && Math.abs(p[2]) <= 1.6, `${figure} stays within reach`);
      near(Math.hypot(...n), 1, 1e-9, `${figure} has a unit normal`);
      apart = Math.max(apart, Math.hypot(...p.map((v, k) => v - shapePoint('torus', phi, theta)[k])));
    }
    if (figure === 'torus') assert.equal(apart, 0); else assert.ok(apart > 0.5, `${figure} is its own shape`);
  }
  for (const theta of [0.4, 1.9, 3.7]) {
    const end = shapePoint('klein-bottle', TAU - 1e-7, theta), start = shapePoint('klein-bottle', 0, -theta);
    end.forEach((v, i) => near(v, start[i], 1e-5, 'the Klein bottle closes through θ → −θ'));
  }
});

test('the helices are the object\'s layers: θ = φ/2 + hπ, the places the keys and voices stand on', async () => {
  const {helixPlace, helixCurve} = await object();
  // QL janko.rs point: arc = 6h + position; θ = arc·π/6 round the tube, φ = (arc mod 6)·π/3 round the ring.
  for (const [helix, h] of [['bimba', 0], ['pratibimba', 1]]) for (let position = 0; position < 6; position++) {
    const arc = 6 * h + position, place = helixPlace(helix, position * Math.PI / 3);
    near(place.theta, (arc * Math.PI / 6) % TAU, 1e-12, `${helix} ${position} θ`); near(place.phi, (arc % 6) * Math.PI / 3, 1e-12, `${helix} ${position} φ`);
  }
  assert.equal(helixCurve('bimba', 12).length, 12);
});

// --------------------------------------------------------------------------------------------------------- the law and the morph

test('the figure law the reading carries names the shape between reads, the tritone\'s Klein bottle included', async () => {
  const {figureAt, stepsAt} = await object();
  const s = session();
  assert.equal(figureAt(s, 2.5), 'figure-eight', 'Auto takes the band\'s shape');
  assert.equal(figureAt(s, 12.4), 'klein-bottle', 'and the Klein bottle for one step at each return');
  assert.equal(figureAt(s, 13.1), 'figure-eight');
  const crossed = session({figure_law: {...s.figure_law, klein_until_steps: 3}});
  assert.equal(figureAt(crossed, 2.9), 'klein-bottle', 'a tritone shows the Klein bottle until the step it names');
  assert.equal(figureAt(crossed, 3.0), 'figure-eight');
  assert.equal(figureAt(session({band: 'pitch'}), 5), 'torus');
  assert.equal(figureAt(session({settings: {shape: 'spiral'}, figure: 'spiral'}), 12.5), 'spiral', 'a held shape holds');
  assert.equal(figureAt(session({settings: {shape: 'sequence'}, figure: null}), 1), null, 'Sequence is the scene\'s');
  assert.equal(figureAt(session({figure_law: undefined, figure: 'spiral'}), 12.5), 'spiral', 'without the law, the reading\'s own figure');
  // The pulse runs on from one reading at its rate: 0.5 s at 2 steps a second is one step.
  assert.equal(stepsAt(session({pulse: {steps: 4}, samples_elapsed: '48000'}), 72000, 48000), 5);
  assert.equal(stepsAt(session({pulse: {steps: 4}, samples_elapsed: '48000'}), 0, 48000), 4, 'never back');
});

test('the morph runs on the pulse: a change of shape begins on the step it is read at and passes in half a step, on the morph signal', async () => {
  const {TorusMorph, PASSAGE_STEPS} = await object();
  const {pulseTurnings} = await signal();
  // One return (twelve steps) is the 720° cover: two turns round the ring, one round the tube.
  near(pulseTurnings(12).theta, 2 * TAU, 1e-12); near(pulseTurnings(12).phi, TAU, 1e-12);
  assert.equal(PASSAGE_STEPS, 0.5);
  const morph = new TorusMorph();
  assert.deepEqual(morph.at('torus', 3), {from: 'torus', to: 'torus', progress: 1, since: null});
  assert.equal(morph.at('klein-bottle', 4).progress, 0, 'the passage starts on the step it is read at');
  near(morph.at('klein-bottle', 4.25).progress, 0.5, 1e-12, 'half way at a quarter step');
  assert.equal(morph.at('klein-bottle', 4.5).progress, 1);
  const back = morph.at('figure-eight', 5);
  assert.deepEqual([back.from, back.to, back.progress], ['klein-bottle', 'figure-eight', 0], 'and on from where it stands');
  const turned = morph.at('torus', 5.1);
  assert.deepEqual([turned.from, turned.to], ['klein-bottle', 'torus'], 'a change in a passage starts from the nearer shape');
});

// --------------------------------------------------------------------------------------------------------------- the 8 + 4 roles

test('under Torus the plate takes a, b, the amplitude and the phase from the eight, and m, n and the edge from the four', async () => {
  const module = await drive();
  assert.equal('ROLES_ABSENT' in module, false, 'ROLES_ABSENT is gone');
  const amplitudes = chord([1, 0.5, 0, 0, 0.25, 0, 0, 0]);
  const reading = {torus: {tonesHz: [220], silentBecause: null}, sky: {tonesHz: [], absentBecause: 'none'},
    body: {influence: influence(), amplitudes: modeRefs().map((ref, k) => ({mode_ref: ref, re: amplitudes[k][0], im: amplitudes[k][1]}))}};
  const resolved = new module.TorusDriveState().resolve({keySource: 'torus', reading, manualHz: 396});
  const roles = resolved.roles;
  assert.equal(roles.standing, 'read');
  assert.equal(roles.voices.length, 8); assert.equal(roles.boundaries.length, 4);
  octet().forEach((v, k) => {
    const r = roles.voices[k];
    near(r.a, v.weight * Math.cos(v.phase_radians), 1e-12, 'a'); near(r.b, v.weight * Math.sin(v.phase_radians), 1e-12, 'b');
    near(r.amplitude_metres, Math.hypot(...amplitudes[k]), 1e-15, 'amplitude'); if (r.amplitude_metres) near(r.phase_radians, Math.atan2(amplitudes[k][1], amplitudes[k][0]), 1e-12, 'phase');
    const boundary = BOUNDARIES[r.boundary];
    assert.deepEqual([r.m, r.n], [boundary.m, boundary.n], 'its m and n are its boundary\'s');
    assert.equal(boundary.helix, v.helix, 'of its own helix');
    assert.equal(boundary.ql_position, v.ql_position >= 3 ? 5 : 0, 'the nearer end');
  });
  assert.deepEqual(roles.boundaries.map(b => b.edge), ['opening', 'closing', 'opening', 'closing']);
  const unread = new module.TorusDriveState().resolve({keySource: 'torus', reading: null, manualHz: 396}).roles;
  assert.equal(unread.standing, 'unread'); assert.match(unread.reason, /No instrument is open/);
});

test('the plate laid flat is the body\'s own displacement, and the eight and the four alone give it back', async () => {
  const {TorusObject, readRoles, bodyOf, amplitudesOf, plateDisplacement, PLATE_SIDE} = await object();
  const amplitudes = chord([1, 0.7, 0.4, 0.2, 0.9, 0.3, 0.6, 0.1]), frame = nativeFrame({amplitudes, half: 40});
  const torus = new TorusObject();
  torus.setBody(influence(), modeRefs()); torus.layFlat(true);
  const shown = torus.present(frame);
  assert.ok(shown, 'the plate is presented');
  const roles = readRoles(bodyOf(influence()), amplitudesOf(frame, modeRefs()));
  const {longitude_samples: lon} = influence().geometry;
  frame.targets.forEach((_, s) => {
    const i = s % lon, j = Math.floor(s / lon), x = PLATE_SIDE * i / lon, y = PLATE_SIDE * j / 16;
    near(shown[s * 3 + 2], plateDisplacement(roles, x, y), 2e-6, `sample ${s}: the plate rings as the body does`);
  });
});

test('cutting the shared state breaks the one-cause test: a picture from another frame than the sound\'s fails it', async () => {
  const {TorusObject, readRoles, bodyOf, amplitudesOf, plateDisplacement, PLATE_SIDE} = await object();
  const {NativeProjection} = await projection();
  const first = nativeFrame({amplitudes: chord([1, 0, 0, 0, 0, 0, 0, 0]), generation: '1', samples: '0'});
  const second = nativeFrame({amplitudes: chord([0, 0, 1, 0, 0, 0.6, 0, 0]), generation: '2', samples: '480'});
  // One cause: the picture's displacement at each sample is what the sound's own amplitudes give through the eight and the four.
  const oneCause = (presented, frame) => {
    const roles = readRoles(bodyOf(influence()), amplitudesOf(frame, modeRefs()));
    frame.targets.forEach((_, s) => near(presented[s * 3 + 2], plateDisplacement(roles, PLATE_SIDE * (s % 24) / 24, PLATE_SIDE * Math.floor(s / 24) / 16), 2e-6, `sample ${s}`));
  };
  const run = (cut) => {
    globalThis.__OI_TEST_CUT_TORUS_STATE__ = cut;
    try {
      const {port, presentation} = fakePort(first.targets.length);
      const p = new NativeProjection(port, first, presentation);
      const torus = new TorusObject(); torus.setBody(influence(), modeRefs()); torus.layFlat(true);
      p.setPresenter(torus); p.apply(second);
      oneCause(perSample(p.inspect().presented), second);
    } finally { delete globalThis.__OI_TEST_CUT_TORUS_STATE__; }
  };
  assert.doesNotThrow(() => run(false), 'the shown body is the sounding body');
  assert.throws(() => run(true), /sample/, 'a picture held from another frame is caught');
});

// ------------------------------------------------------------------------------------------------- the eight pull, the four hold

test('a chord lights its voices as force points on their helices, and each lets go as it fades', async () => {
  const {TorusObject, helixPlace, shapePoint, shapeNormal, VOICE_LIFT_TUBES} = await object();
  const torus = new TorusObject(); torus.setBody(influence(), modeRefs());
  torus.present(nativeFrame({amplitudes: chord([1, 0, 0.5, 0, 0, 0, 0, 0.002])}));
  const points = torus.voicePoints(120);
  assert.deepEqual(points.map(p => p.mode_ref), ['scene:logic/0', 'scene:logic/2', 'scene:logic/7'], 'the voices that sound, and only those');
  const [first] = points, v = octet()[0], place = helixPlace(v.helix, v.longitude_radians);
  const at = shapePoint('torus', place.phi, place.theta), n = shapeNormal('torus', place.phi, place.theta);
  [first.position.x, first.position.y, first.position.z].forEach((value, i) => near(value, (at[i] + n[i] * VOICE_LIFT_TUBES) * 120, 1e-6, 'at its place on its helix'));
  assert.equal(first.polarity, 'attract'); assert.equal(first.metric, 'world3d');
  assert.ok(points[0].strength > points[1].strength && points[1].strength > points[2].strength, 'each pulls as strongly as it sounds');
  torus.present(nativeFrame({amplitudes: quiet(), generation: '2', samples: '48000'}));
  assert.deepEqual(torus.voicePoints(120), [], 'a body that has fallen quiet lets the particles go');
});

test('while the body rings its particles settle towards the still lines of the four, and stand where they are when it is quiet', async () => {
  const {TorusObject, torusCoordinates, chi} = await object();
  const torus = new TorusObject(); torus.setBody(influence(), modeRefs());
  const at = (p, s) => torusCoordinates([p[s * 3], p[s * 3 + 1], p[s * 3 + 2]], 1);
  const energy = (amplitudes, phi, theta) => octet().reduce((sum, v, k) => sum + (amplitudes[k][0] ** 2 + amplitudes[k][1] ** 2) * chi(v, phi, theta) ** 2, 0);
  const quietFrame = nativeFrame({amplitudes: quiet()});
  assert.equal(torus.present(quietFrame), null, 'a quiet torus is shown exactly as the owner gives it');
  const ringing = chord([1, 1, 1, 1, 1, 1, 1, 1]), frame = nativeFrame({amplitudes: ringing, generation: '2', samples: '10'});
  const shown = torus.present(frame);
  let before = 0, afterwards = 0;
  frame.targets.forEach((target, s) => {
    const own = torusCoordinates(target.position, 1), there = at(shown, s);
    before += energy(ringing, own.phi, own.theta); afterwards += energy(ringing, there.phi, there.theta);
    near(there.offset, own.offset, 1e-5, 'each keeps its own native displacement');
  });
  assert.ok(afterwards < before * 0.9, `the particles gather where the body is still (${afterwards} < ${before})`);
});

// ---------------------------------------------------------------------------------------------------------- the pane's projection

function fakePort(count) {
  const size = 2 ** Math.ceil(Math.log2(Math.ceil(Math.sqrt(count)))), texels = size * size;
  const texture = () => ({image: {width: size, height: size, data: new Float32Array(texels * 4).fill(1)}, dispose() {}});
  const port = {texWidth: size, texHeight: size, particleCount: texels, targetA: texture(), targetB: texture(), sets: 0,
    setTargetTextures(a, b) { this.a = a; this.b = b; this.sets++; }};
  const slots = Array.from({length: texels}, (_, t) => t % count);
  return {port, presentation: {units_per_metre: 120, slots_a: slots, slots_b: slots}};
}
const perSample = (presented) => presented;

test('the pane\'s projection presents the body through the object: as the owner gives it while the torus is quiet, on the law\'s figure otherwise', async () => {
  const {NativeProjection} = await projection();
  const {TorusObject, shapePoint, torusCoordinates} = await object();
  const first = nativeFrame({amplitudes: quiet()}), {port, presentation} = fakePort(first.targets.length);
  const p = new NativeProjection(port, first, presentation), torus = new TorusObject();
  torus.setBody(influence(), modeRefs()); torus.setSession(session({band: 'pitch', figure: 'torus'}));
  p.setPresenter(torus);
  const asIs = Array.from(p.inspect().target_a.slice(0, 12)), admitted = Array.from(p.inspect().admitted_a.slice(0, 12));
  assert.deepEqual(asIs, admitted.map((v, i) => i % 4 === 3 ? v : Math.fround(v * 120)), 'a quiet torus: the native targets × scale, exactly');
  torus.setSession(session());
  p.apply(nativeFrame({amplitudes: quiet(), generation: '2', samples: '48000'}));
  p.apply(nativeFrame({amplitudes: quiet(), generation: '3', samples: '96000'}));
  const a = p.inspect().target_a, frame = nativeFrame({amplitudes: quiet()});
  for (const t of [0, 5, 77, 200]) {
    const own = torusCoordinates(frame.targets[t].position, 1), eight = shapePoint('figure-eight', own.phi, own.theta);
    [a[t * 4], a[t * 4 + 1], a[t * 4 + 2]].forEach((v, i) => near(v, Math.fround(eight[i] * 120), 1e-3, `texel ${t} stands on the figure-eight`));
    assert.equal(a[t * 4 + 3], 1, 'density stays the authored fourth channel');
  }
  assert.equal(p.inspect().presented_shape.to, 'figure-eight');
});

// ------------------------------------------------------------------------------------------------------------- the frame's reading

test('what the torus plays carries the body: the voices sounding now by their own amplitudes, the four, and the pulse', async () => {
  const {torusPlayReading} = await play();
  const amplitudes = chord([1, 0, 0.5, 0, 0, 0, 0, 0]);
  const reading = {status: 'following', instrument: {acting: {voices: octet(), sky: {kind: 'none'}}, struck: {refs: ['scene:logic/5']},
    influence: influence(), torus: session(),
    torus_object: {amplitudes: modeRefs().map((ref, k) => ({mode_ref: ref, re: amplitudes[k][0], im: amplitudes[k][1]}))}}};
  const played = torusPlayReading(reading);
  assert.deepEqual(played.torus.tonesHz, [octet()[0].frequency_hz, octet()[2].frequency_hz], 'the voices sounding now, by their amplitudes');
  assert.equal(played.body.influence.boundaries.length, 4);
  assert.equal(played.body.amplitudes.length, 8);
  assert.deepEqual(played.pulse, {steps: 0, steps_per_second: 2, band: 'rhythm'});
  const silent = torusPlayReading({...reading, instrument: {...reading.instrument, torus_object: {amplitudes: modeRefs().map(ref => ({mode_ref: ref, re: 0, im: 0}))}}});
  assert.deepEqual(silent.torus.tonesHz, []); assert.match(silent.torus.silentBecause, /rung down|silent/i);
  const before = torusPlayReading({...reading, instrument: {...reading.instrument, torus_object: undefined}});
  assert.deepEqual(before.torus.tonesHz, [octet()[5].frequency_hz], 'an owner that gives no amplitudes: the voices last struck, as before');
});

test('under Manual, Focus and Automation the pulse is tuned to the drive; under Torus the pulse is the torus\'s own', async () => {
  const {pulseRateFor} = await drive();
  assert.equal(pulseRateFor({kind: 'frequency', targetHz: 396, bound: true}), 396, 'Manual: the Drive frequency');
  assert.equal(pulseRateFor({kind: 'sweep', targetHz: 140.5, bound: true}), 140.5, 'Automation: the sweep where it stands');
  assert.equal(pulseRateFor({kind: 'semanticFocus', targetHz: 61, bound: true}), 61, 'Focus: the focus\'s frequency');
  assert.equal(pulseRateFor({kind: 'torus', targetHz: 220, bound: true}), null);
  assert.equal(pulseRateFor({kind: 'frequency', targetHz: NaN, bound: true}), null, 'no number, no tuning');
  assert.equal(pulseRateFor(null), null);
});

test('a press finds the object where the shape shown stands, not where the torus would', async () => {
  const {shapeRayHit, shapePoint, shapeNormal} = await object();
  const state = {morph: {from: 'figure-eight', to: 'figure-eight', progress: 1, since: null}, angle: 0};
  const phi = 0.4, theta = 0.9, p = shapePoint('figure-eight', phi, theta), n = shapeNormal('figure-eight', phi, theta);
  const origin = p.map((v, i) => v + n[i] * 3), hit = shapeRayHit(origin, n.map(v => -v), state, 1);
  assert.ok(hit, 'the ray meets the figure-eight');
  const at = shapePoint('figure-eight', hit.phi, hit.theta);
  assert.ok(Math.hypot(...at.map((v, i) => v - p[i])) < 0.08, `at the point under it (${hit.phi}, ${hit.theta})`);
});

// ------------------------------------------------------------------------------------------------- the same object in an Expression

const model = () => bundle(join(journeys, 'src/model.ts'), 'model');
const bridge = () => bundle(join(journeys, 'src/nativeBridge.ts'), 'bridge');

test('in an Expression the torus is an object: selected, given forces and a sequence of its shapes, as any symbol is', async () => {
  const {blankJourney, entity, validateJourney} = await model();
  const {toNativeConfig, fromNativeEntity} = await bridge();
  const {torusCandidates, shapePoint} = await object();
  const journey = blankJourney(), torus = entity('Torus', '');
  torus.shape = 'torus'; torus.torusFigure = 'figure-eight';
  torus.force = {kind: 'vortex', strength: 1.2, radius: .4, spin: .5};
  torus.sequence = {enabled: true, clock: 'seconds', steps: [
    {id: 'step-a', text: '', shape: 'torus', torusFigure: 'torus', hold: 2, transition: 1, position: null},
    {id: 'step-b', text: '', shape: 'torus', torusFigure: 'klein-bottle', hold: 2, transition: 1, position: null}]};
  journey.scenes[0].entities.push(torus);
  const saved = validateJourney(JSON.parse(JSON.stringify(journey)));
  assert.equal(saved.scenes[0].entities.at(-1).torusFigure, 'figure-eight', 'it saves as the torus, on its shape');
  const bad = JSON.parse(JSON.stringify(journey)); bad.scenes[0].entities.at(-1).torusFigure = 'cube';
  assert.throws(() => validateJourney(bad), /Invalid/);
  const native = toNativeConfig(saved.scenes[0]).entities.find(e => e.name === 'Torus');
  assert.deepEqual(native.shape, {kind: 'torus', figure: 'figure-eight'}, 'the engine is handed the torus and its shape');
  assert.deepEqual(native.sequence.links.map(l => l.shape.figure), ['torus', 'klein-bottle'], 'its shapes in turn');
  assert.equal(native.forces.mode, 'vortex');
  const back = fromNativeEntity(native);
  assert.deepEqual([back.shape, back.torusFigure], ['torus', 'figure-eight'], 'and reads back as it was');
  // The engine samples the object as the shape it names: every candidate on the figure, at the stage's primitive scale.
  const candidates = torusCandidates('klein-bottle');
  assert.ok(candidates.length >= 4096);
  const scale = 200 / (25 / 9);
  for (const c of candidates.slice(0, 64)) assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z) && c.density === 1);
  const [first] = candidates, at = shapePoint('klein-bottle', 0, 0);
  near(first.x, at[0] * scale, 1e-9); near(first.y, at[1] * scale, 1e-9); near(first.z, at[2] * scale, 1e-9);
});

test('on the candidate an Expression\'s torus travels whole through the kernel\'s Scene material and opens as it was saved', async () => {
  const {blankJourney, entity, clone} = await model();
  const {kernelDocumentToJourney} = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'kernel');
  const E = 'expression:torus-851', sceneRef = `${E}:scene:one`, ref = `${E}:entity:torus`;
  const scene = blankJourney().scenes[0], torus = entity('Torus', '');
  scene.id = sceneRef; torus.id = ref; torus.shape = 'torus'; torus.torusFigure = 'spiral';
  torus.force = {kind: 'attract', strength: .8, radius: .5, spin: 0};
  torus.sequence = {enabled: true, clock: 'seconds', steps: [
    {id: 'step-a', text: '', shape: 'torus', torusFigure: 'torus', hold: 1, transition: .5, position: null},
    {id: 'step-b', text: '', shape: 'torus', torusFigure: 'klein-bottle', hold: 1, transition: .5, position: null}]};
  scene.entities = [torus];
  const doc = {schema: 'oi.expression/v1', expression_ref: E, revision: 1, title: 'Torus',
    scenes: [{scene_ref: sceneRef, revision: 1, title: scene.name, entity_refs: [ref], presentation: {schema: 'oi.journey-scene/v1', scene: clone(scene), saved: null}}],
    entities: {[ref]: {entity_ref: ref, revision: 1, title: 'Torus', parameters: {}}}, relations: {}, selection: {scene_ref: sceneRef, entity_ref: null},
    provenance: [], representations: [], refinements: []};
  const opened = kernelDocumentToJourney(doc).journey.scenes[0].entities[0];
  assert.deepEqual([opened.shape, opened.torusFigure, opened.force.kind], ['torus', 'spiral', 'attract'], 'the object, its shape and its force');
  assert.deepEqual(opened.sequence.steps.map(s => [s.shape, s.torusFigure]), [['torus', 'torus'], ['torus', 'klein-bottle']], 'and its sequence of shapes');
});

test('the Live editor gives the torus a sequence of its shapes: a step\'s source names the torus and its shape, and a shape the torus has not is refused', async () => {
  const {blankJourney, entity} = await model();
  const {applyNativeGlyphChanges} = await bundle(join(journeys, 'src/hostEditor.ts'), 'host-editor');
  const journey = blankJourney(), scene = journey.scenes[0], torus = entity('Torus', '');
  torus.shape = 'torus';
  torus.sequence = {enabled: true, clock: 'seconds', steps: [
    {id: 'step-a', text: '', shape: 'torus', hold: 1, transition: .5, position: null},
    {id: 'step-b', text: 'O', shape: 'text', hold: 1, transition: .5, position: null}]};
  scene.entities = [torus];
  const change = (step_id, shape, torusFigure) => ({kind: 'step-source', entity_id: torus.id, step_id, shape, text: '', ...(torusFigure ? {torusFigure} : {})});
  const next = applyNativeGlyphChanges(journey, scene.id, [change('step-a', 'torus', 'klein-bottle'), change('step-b', 'torus', 'spiral')]);
  assert.deepEqual(next.scenes[0].entities[0].sequence.steps.map(s => [s.shape, s.torusFigure]), [['torus', 'klein-bottle'], ['torus', 'spiral']]);
  const back = applyNativeGlyphChanges(next, scene.id, [{kind: 'step-source', entity_id: torus.id, step_id: 'step-b', shape: 'ring', text: 'O'}]);
  assert.equal(back.scenes[0].entities[0].sequence.steps[1].torusFigure, undefined, 'a step that leaves the torus leaves its shape');
  assert.throws(() => applyNativeGlyphChanges(journey, scene.id, [change('step-a', 'torus', 'cube')]), /torus/i);
});
