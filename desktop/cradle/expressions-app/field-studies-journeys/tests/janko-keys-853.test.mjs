// O-I #853: every way of playing reaches the Torus by one path, the M1′ session's own `torus-play` and `torus-release` (QL-MEF
// m1_prime.rs, continuous/scene_field.rs torus_play; instrument-session.mjs torusPlay/torusRelease). The frame's half of that path:
// the `janko` stage command names keys of the Jankó surface (strike, release), the controller runs them as performance acts through
// its one serial owner, and the answer names the notes that made way past Polyphony.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/janko-keys-853.test.mjs
//
// The sources are TypeScript: each module is bundled once with the app's own esbuild into a temporary directory (as
// me1-torus-drive.test.mjs does). The owner is the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs, taught
// the Torus's two acts below with QL's own rule for the count of notes (m1_prime.rs strike/release): each key is a new note, a key
// already sounding is struck again as a new note (the old one makes way), and past Polyphony the oldest make way.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'janko-keys-853-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`);
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
      loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const stage = () => bundle(join(journeys, 'src/stageCommands.ts'), 'stage');
const controller = () => bundle(join(journeys, 'src/native-field/controller.ts'), 'controller');
const fixture = () => import(new URL('../../../tests/native-expression-fixture.mjs', import.meta.url));
// The frame's own origin and its host's: the frame hears only its host, from the host's origin, and posts to it there (round 896, 1R-surface.10).
const HOST_ORIGIN = 'tauri://localhost', FRAME_ORIGIN = 'oi-material://application.localhost';

// ---------------------------------------------------------------------------------------------------- the stage vocabulary
const request = command => ({v: 1, kind: 'host-command', req: 7, ...command});

test('a strike names 1 to 32 distinct keys of the surface at one amplitude in (0, 1], and lands at a sample when it names one', async () => {
  const {readStageRequest} = await stage();
  const keys = [{row: 0, column: 42}, {row: 3, column: 45}];
  assert.deepEqual(readStageRequest(request({command: 'janko', action: 'strike', keys, amplitude: 0.35})),
    {req: 7, command: {command: 'janko', action: 'strike', keys, amplitude: 0.35}});
  assert.deepEqual(readStageRequest(request({command: 'janko', action: 'strike', keys, amplitude: 1, at_samples_elapsed: '48000'})).command,
    {command: 'janko', action: 'strike', keys, amplitude: 1, at_samples_elapsed: '48000'});
  const many = Array.from({length: 32}, (_, i) => ({row: i % 6, column: i}));
  assert.equal(readStageRequest(request({command: 'janko', action: 'strike', keys: many, amplitude: 0.5})).command.keys.length, 32);
});

test('a release names the keys it lets go, and nothing else', async () => {
  const {readStageRequest} = await stage();
  assert.deepEqual(readStageRequest(request({command: 'janko', action: 'release', keys: [{row: 5, column: 0}]})),
    {req: 7, command: {command: 'janko', action: 'release', keys: [{row: 5, column: 0}]}});
  assert.equal(readStageRequest(request({command: 'janko', action: 'release', keys: [{row: 5, column: 0}], amplitude: 0.3})), null, 'a release strikes nothing');
});

test('a key off the surface, a repeated key, too many keys or an amplitude outside the bound is refused before the owner sees it', async () => {
  const {readStageRequest} = await stage();
  const bad = [
    {keys: [], amplitude: 0.3},
    {keys: [{row: 6, column: 0}], amplitude: 0.3},
    {keys: [{row: -1, column: 0}], amplitude: 0.3},
    {keys: [{row: 0, column: -1}], amplitude: 0.3},
    {keys: [{row: 0, column: 65536}], amplitude: 0.3},
    {keys: [{row: 0.5, column: 0}], amplitude: 0.3},
    {keys: [{row: 0, column: 0, pitch: 4}], amplitude: 0.3},
    {keys: [{row: 0, column: 1}, {row: 0, column: 1}], amplitude: 0.3},
    {keys: Array.from({length: 33}, (_, i) => ({row: 0, column: i})), amplitude: 0.3},
    {keys: [{row: 0, column: 0}], amplitude: 0},
    {keys: [{row: 0, column: 0}], amplitude: 1.5},
    {keys: [{row: 0, column: 0}], amplitude: 0.3, at_samples_elapsed: 12},
    {keys: [{row: 0, column: 0}], amplitude: 0.3, pitch_classes: [0]},
  ];
  for (const body of bad) assert.equal(readStageRequest(request({command: 'janko', action: 'strike', ...body})), null, JSON.stringify(body).slice(0, 80));
  assert.equal(readStageRequest(request({command: 'janko', action: 'release', keys: [{row: 9, column: 0}]})), null);
  assert.equal(readStageRequest(request({command: 'janko', action: 'hush', keys: [{row: 0, column: 0}]})), null, 'no third act');
});

// REPLACED (O-I #855 fold-in): was "the chord a clip strikes still reads as before: the pitch-class act stands beside the keys". The clip
// strikes keys since #790 and the QL sitting's bell since this fold-in (live-shell/ui tests/sitting-bell-keys.test.mjs), so no act names
// pitch classes: the frame refuses one, and runs its janko case on keys alone.
test('every note is a key of the surface: a chord of pitch classes is refused before the owner sees it, and the frame plays none', async () => {
  const {readStageRequest} = await stage();
  for (const body of [{pitch_classes: [0, 4, 7], amplitude: 0.35}, {pitch_classes: [2], amplitude: 0.35, at_samples_elapsed: '48000'}]) {
    assert.equal(readStageRequest(request({command: 'janko', action: 'play', ...body})), null, JSON.stringify(body));
  }
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  const janko = app.slice(app.indexOf("case 'janko':"), app.indexOf("case 'strike-at':"));
  assert.match(janko, /torusPlayed\(command\.keys/);
  assert.doesNotMatch(janko, /playJanko|pitch_classes/, 'no pitch-class act in the frame');
});

test('a strike\'s answer carries the keys whose notes made way, both ways across the channel, read exactly', async () => {
  const {readStageResult, stageReplyMessage} = await stage();
  const made_way = [{row: 0, column: 42}];
  const command = {command: 'janko', action: 'strike', keys: [{row: 1, column: 43}], amplitude: 0.35};
  const reply = stageReplyMessage(7, {ok: true, made_way}, command);
  assert.deepEqual(reply, {v: 1, kind: 'host-command-result', command: 'janko', req: 7, ok: true, made_way});
  assert.deepEqual(readStageResult(reply), {req: 7, ok: true, made_way});
  assert.deepEqual(readStageResult({v: 1, kind: 'host-command-result', req: 7, ok: true}), {req: 7, ok: true}, 'an act with none made way');
  assert.equal(readStageResult({...reply, made_way: [{row: 7, column: 0}]}), null, 'a key off the surface is not read');
  assert.equal(readStageResult({...reply, made_way: 'all'}), null);
});

// ---------------------------------------------------------------------------------------------------- the controller's two acts
const keyOf = key => `${key.row}/${key.column}`;
const TorusOwnerCoupling = k => (k === 2 || k === 5 ? 0 : (k + 1) / 10);
const openController = async ({polyphony = 16, Audio = base => base, playback} = {}) => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class TorusOwner extends ControlledSceneOwner {
    acts = []; notes = []; next = 0;
    // The strike's receipt as QL's owner answers it beside the act (scene_field.rs; instrument-session.mjs lastStrikeAt), once a test asks
    // for it: under Logic on the torus each key is a note that strikes its own cell (`ql.note-voices/v1`, voice_cells: eight voices of their
    // own, each `like` the Logic voice of its slot, at its own frequency); otherwise, and for a singlet, the resident voices at the points
    // (`ql.strike-at/v1`). The coupling is a protocol number, not QL's χ: voice 2 and voice 5 stand on a node line, so they get nothing.
    receipts = false;
    static coupling(k) { return k === 2 || k === 5 ? 0 : (k + 1) / 10; }
    keyReceipt(notes, amplitude) {
      const points = notes.map(note => ({theta: note.point.theta, phi: note.point.phi, amplitude}));
      if (this.torusSettings.tuning !== 'logic') return this.residentReceipt(notes.map(note => note.point), amplitude);
      return {schema: 'ql.note-voices/v1', points, strike: 1, law: 'controlled', made_way: [],
        notes: notes.map(note => ({id: note.id, voices: Array.from({length: 8}, (_, k) => ({like: `scene:logic/${k}`, frequency_hz: 200 + 10 * note.id + k,
          m: 1 + k % 4, n: 2 + k % 3, coupling: TorusOwner.coupling(k), amplitude: [amplitude[0] * TorusOwner.coupling(k), 0]}))}))};
    }
    residentReceipt(at, amplitude) {
      const points = at.map(point => ({theta: point.theta, phi: point.phi, amplitude}));
      return {schema: 'ql.strike-at/v1', points, law: 'controlled', standing: 'controlled',
        voices: this.voices().map((voice, k) => ({mode_ref: voice.mode_ref ?? `scene:planet/${voice.planet_ref}`, coupling: points.map(() => TorusOwner.coupling(k)),
          amplitude: [points.length * amplitude[0] * TorusOwner.coupling(k), 0]}))};
    }
    // A stall the test sets (1T item 22): the next exchange it names waits at the owner until the test lets it go, then is answered.
    stall = null;
    async request(request) {
      const command = request.request?.command;
      if (this.stall && command && this.stall.names(command)) { const stall = this.stall; this.stall = null; stall.reached(request); await stall.gate; }
      if (command?.operation === 'torus-native') {
        // The kernel keeps the Torus handed over and relays its digest in the document's place (native_expression.rs hand_over): a read.
        const read = structuredClone(request);
        read.request.command = {operation: 'read'};
        const reply = await super.request(read);
        this.handovers = (this.handovers ?? 0) + 1;
        if (this.refuseHandover) return {...reply, status: 'refused', error: 'controlled refusal: a setting waits for a later sample'};
        reply.torus_native = {schema: 'ql.torus-native/v1', sha256: 'sha256:' + this.handovers.toString(16).padStart(64, '0'),
          generation: reply.field.generation, at_samples_elapsed: this.handedAt ?? reply.field.samples_elapsed};
        return reply;
      }
      if (!['torus-play', 'torus-release', 'torus-singlet'].includes(command?.operation)) return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      this.acts.push(structuredClone(command));
      if (this.refuse?.(command)) return {...reply, status: 'refused', error: 'controlled refusal: ' + command.operation};
      if (command.operation === 'torus-release') {
        this.notes = this.notes.filter(note => !command.keys.some(key => keyOf(key) === keyOf(note.key)));
        return reply;
      }
      // The pulse turns 40 steps a second at 48 kHz: an act for a later sample stands where the pulse will have carried it (QL-MEF
      // scene_field.rs torus_play / torus_singlet: the steps at the act's sample). The owner's points, never the frame's.
      const turned = command.at_samples_elapsed === undefined ? 0 : Number(command.at_samples_elapsed) / 1200;
      if (command.operation === 'torus-singlet') {
        // QL's ring_places: codon 8 is one of the nonet collision's eight, at arcs 9 and 10; codon 5 at arc 6. No note is counted.
        const places = command.codon === 8 ? [{lens: 0, arc: 9}, {lens: 0, arc: 10}] : [{lens: 0, arc: 6}];
        this.bump(1n);
        reply.field = structuredClone(this.frame);
        reply.field.audio = [];
        reply.torus_singlet = {schema: 'ql.torus-singlet/v1', codon: command.codon, places,
          points: places.map(place => ({theta: (0.3 * (place.arc + turned)) % 6, phi: (0.6 * (place.arc + turned)) % 6, arc: place.arc}))};
        if (this.receipts) reply.strike_at = this.residentReceipt(reply.torus_singlet.points, command.amplitude);
        return reply;
      }
      // QL m1_prime.rs strike: a key already sounding makes way for its new note; past Polyphony the oldest make way.
      const admitted = [], made_way = [];
      for (const key of command.keys) {
        const index = this.notes.findIndex(note => keyOf(note.key) === keyOf(key));
        if (index >= 0) made_way.push(...this.notes.splice(index, 1));
        const note = {id: this.next++, key: {row: key.row, column: key.column}, arc: (key.column % 6) + 6 * (key.row % 2), struck_at_samples: 0};
        this.notes.push(note); admitted.push(note);
        while (this.notes.length > polyphony) made_way.push(this.notes.shift());
      }
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      reply.torus_play = {schema: 'ql.torus-play/v1', made_way, polyphony,
        notes: admitted.map(note => ({id: note.id, key: note.key, place: {arc: note.arc},
          point: {theta: 0.25 * (note.arc + 1) + turned / 100, phi: 0.5 * (note.arc + 1) + turned / 100, arc: note.arc}}))};
      if (this.receipts) reply.strike_at = this.keyReceipt(reply.torus_play.notes, command.amplitude);
      return reply;
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new TorusOwner(), audio = new (Audio(ControlledAudio))(),
    c = new NativeFieldController(owner, renderer, () => audio, ...(playback ? [{blockFrames: 512, leadSeconds: .04, lookaheadSeconds: .1, ...playback}] : []));
  await c.compose({sky: 'none'});
  return {owner, c, audio};
};

test('a strike of keys is one torus-play act on the owner: the keys, the amplitude as its metres, the sample it lands at', async () => {
  const {c, owner} = await openController();
  try {
    const keys = [{row: 0, column: 42}, {row: 1, column: 43}, {row: 2, column: 44}];
    const madeWay = await c.torusPlay(keys, 0.5);
    assert.deepEqual(madeWay, [], 'nothing made way under Polyphony');
    assert.deepEqual(owner.acts, [{operation: 'torus-play', keys, amplitude: [0.5, 0]}]);
    assert.equal(c.reading.instrument.struck.source, 'point', 'the plate follows a key as it follows a touch: the points it struck');
    assert.deepEqual(c.reading.instrument.struck.points, [{theta: 0.25, phi: 0.5}, {theta: 2, phi: 4}, {theta: 0.75, phi: 1.5}],
      'the points are the owner\'s own, from its receipt, never made up here');
    await c.torusRelease([{row: 1, column: 43}]);
    assert.deepEqual(owner.acts.at(-1), {operation: 'torus-release', keys: [{row: 1, column: 43}]});
    assert.deepEqual(owner.notes.map(note => keyOf(note.key)), ['0/42', '2/44'], 'the released key left the count; the others sound on');
  } finally { await c.dispose(); }
});

test('past Polyphony the oldest note makes way, and the strike answers with its key', async () => {
  const {c, owner} = await openController({polyphony: 2});
  try {
    assert.deepEqual(await c.torusPlay([{row: 0, column: 42}], 0.35), []);
    assert.deepEqual(await c.torusPlay([{row: 1, column: 43}], 0.35), []);
    assert.deepEqual(await c.torusPlay([{row: 2, column: 44}], 0.35), [{row: 0, column: 42}], 'the oldest made way');
    assert.deepEqual(owner.notes.map(note => keyOf(note.key)), ['1/43', '2/44']);
  } finally { await c.dispose(); }
});

test('a key off the surface is refused before the owner is asked, and a refused act leaves what was struck as it was', async () => {
  const {c, owner} = await openController();
  try {
    await c.torusPlay([{row: 0, column: 42}], 0.35);
    const struck = structuredClone(c.reading.instrument.struck);
    for (const keys of [[], [{row: 6, column: 0}], Array.from({length: 33}, (_, i) => ({row: 0, column: i}))])
      await assert.rejects(c.torusPlay(keys, 0.35), /1 to 32 keys/);
    await assert.rejects(c.torusPlay([{row: 0, column: 1}], 0), /amplitude/);
    await assert.rejects(c.torusRelease([{row: 0, column: -2}]), /1 to 32 keys/);
    assert.equal(owner.acts.length, 1, 'nothing malformed reached the owner');
    owner.refuse = command => command.operation === 'torus-play';
    await assert.rejects(c.torusPlay([{row: 3, column: 45}], 0.35), /controlled refusal/);
    assert.deepEqual(c.reading.instrument.struck, struck, 'a key the owner did not take is not what the torus plays');
  } finally { await c.dispose(); }
});

test('the strikes and releases of a quick run keep their order through the one serial owner', async () => {
  const {c, owner} = await openController();
  try {
    const k = {row: 4, column: 46};
    await Promise.all([c.torusPlay([k], 0.35), c.torusRelease([k]), c.torusPlay([k], 0.35)]);
    assert.deepEqual(owner.acts.map(act => act.operation), ['torus-play', 'torus-release', 'torus-play']);
    assert.deepEqual(owner.notes.map(note => keyOf(note.key)), ['4/46'], 'the last strike sounds: a release never overtakes the strike after it');
  } finally { await c.dispose(); }
});

// ---------------------------------------------------------------------------------------------------- the frame's stage runner
test('the frame runs a strike as the controller\'s torus-play and a release as its torus-release, and answers what made way', async () => {
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const start = app.indexOf("case 'janko':");
  assert.ok(start >= 0);
  const block = app.slice(start, app.indexOf("case 'strike-at':", start));
  assert.match(block, /command\.action==='strike'[\s\S]*nativeField\.controller\.torusPlayed\(command\.keys,command\.amplitude,command\.at_samples_elapsed\)/);
  assert.match(block, /made_way/);
  assert.match(block, /command\.action==='release'[\s\S]*nativeField\.controller\.torusRelease\(command\.keys\)/);
});

// ---------------------------------------------------------------------------------------------------- every strike lands at its point (O-I #771)
// A touch strikes at the touched point (packages/live-shell/ui/tests/mt2-strike-at-point.test.mjs), a clip's note at its key's point as the
// clip plays it, a singlet at its codon's place on the ring. The places and the points are QL's (crates/ql-mef/tests/torus_host.rs: a clip's
// note strikes its key's point at its own sample; a singlet strikes its codon's place where the turning torus has carried it); the frame
// sends the act and the plate follows the points the owner struck.
test('a clip\'s note at its sample strikes where the owner places its key there: the point the plate follows is the owner\'s at that sample', async () => {
  const {c, owner} = await openController();
  try {
    const key = {row: 2, column: 44};
    const {landed_at_samples_elapsed} = await c.torusPlayed([key], 0.4, '48000');
    assert.deepEqual(owner.acts.at(-1), {operation: 'torus-play', keys: [key], amplitude: [0.4, 0], at_samples_elapsed: '48000'});
    assert.equal(landed_at_samples_elapsed, '48000');
    assert.deepEqual(c.reading.instrument.struck.points, [{theta: 0.75 + 40 / 100, phi: 1.5 + 40 / 100}], 'forty steps on, as the owner said');
    await c.torusPlayed([key], 0.4);
    assert.deepEqual(c.reading.instrument.struck.points, [{theta: 0.75, phi: 1.5}], 'struck now: where the pulse stands now');
  } finally { await c.dispose(); }
});

test('a singlet is one torus-singlet act on the owner: the codon, the amplitude as its metres; the plate follows the points it struck', async () => {
  const {c, owner} = await openController();
  try {
    const answer = await c.torusSinglet(8);
    assert.deepEqual(owner.acts, [{operation: 'torus-singlet', codon: 8, amplitude: [0.35, 0]}], 'the codon alone: its place is the owner\'s');
    assert.equal(typeof answer.landed_at_samples_elapsed, 'string');
    assert.equal(c.reading.instrument.struck.source, 'point');
    assert.deepEqual(c.reading.instrument.struck.points, [{theta: 0.3 * 9, phi: 0.6 * 9 % 6}, {theta: 0.3 * 10, phi: 0.6 * 10 % 6}],
      'both arcs of a nonet-collision codon, from the owner\'s receipt');
    assert.deepEqual(owner.notes, [], 'a singlet is no key: it counts no note');
    const later = await c.torusSinglet(5, 0.5, '24000');
    assert.deepEqual(owner.acts.at(-1), {operation: 'torus-singlet', codon: 5, amplitude: [0.5, 0], at_samples_elapsed: '24000'});
    assert.equal(later.landed_at_samples_elapsed, '24000');
    assert.deepEqual(c.reading.instrument.struck.points, [{theta: (0.3 * 26) % 6, phi: (0.6 * 26) % 6}]);
  } finally { await c.dispose(); }
});

// ---------------------------------------------------------------------------------------------------- the voices a key or a singlet rang (O-I #771)
// As a touch's and a collision's (controller.ts struckVoicesOf, playAt): the plate records the voices the owner's receipt of the strike gave an
// impulse, each with its impulse; under Logic a key's are its own note's voices, at their own pitches. Where the owner names no voices, every
// voice tuned, as before.
const play = () => import(new URL('../src/native-field/torusPlay.mjs', import.meta.url));
const excited = [0, 1, 3, 4, 6, 7];
const near = values => values.map(value => Number(value.toFixed(9)));

test('a key under Logic rings its own note\'s voices: the plate records the ones its strike gave an impulse, each by it, at its own pitch', async () => {
  const {c, owner} = await openController();
  const {torusPlayReading} = await play();
  try {
    await c.torusPlay([{row: 0, column: 42}], 0.5);
    assert.deepEqual(c.reading.instrument.struck.refs, c.reading.instrument.influence.voices.map(voice => voice.mode_ref), 'no receipt: every voice tuned');
    owner.receipts = true;
    await c.torusPlay([{row: 1, column: 43}, {row: 2, column: 44}], 0.5);
    const struck = c.reading.instrument.struck;
    const ids = [1, 2];
    assert.deepEqual(struck.refs, ids.flatMap(() => excited.map(k => `scene:logic/${k}`)), 'each note\'s voices, the ones on a node line left out');
    assert.deepEqual(near(struck.impulses), near(ids.flatMap(() => excited.map(k => 0.5 * TorusOwnerCoupling(k)))));
    assert.deepEqual(struck.tones_hz, ids.flatMap(id => excited.map(k => 200 + 10 * id + k)), 'each at the pitch its own cell gives it');
    assert.deepEqual(torusPlayReading(c.reading).torus.tonesHz, struck.tones_hz, 'the plate plays the notes\' own pitches');
  } finally { await c.dispose(); }
});

test('a key under Sky, and a singlet, ring the resident voices at their points: the plate records the ones given an impulse, each by it', async () => {
  const {c, owner} = await openController();
  try {
    owner.receipts = true;
    await c.torusSinglet(8);
    const singlet = c.reading.instrument.struck;
    assert.deepEqual(singlet.refs, excited.map(k => `scene:logic/${k}`), 'the singlet\'s two points ring the resident voices they move');
    assert.deepEqual(near(singlet.impulses), near(excited.map(k => 2 * 0.35 * TorusOwnerCoupling(k))), 'summed over its two points');
    assert.equal('tones_hz' in singlet, false, 'a resident voice sounds at its own pitch, read from the owner\'s voices');
    await c.torusSet({tuning: 'sky'});
    await c.torusPlay([{row: 3, column: 45}], 0.5);
    const sky = c.reading.instrument.struck;
    const planets = c.reading.instrument.influence.voices.map(voice => `scene:planet/${voice.planet_ref}`);
    const rung = planets.map((_, k) => k).filter(k => TorusOwnerCoupling(k) > 0);
    assert.deepEqual(sky.refs, rung.map(k => planets[k]), 'the sky\'s planets at the key\'s point');
    assert.deepEqual(near(sky.impulses), near(rung.map(k => 0.5 * TorusOwnerCoupling(k))));
  } finally { await c.dispose(); }
});

test('a codon past the 64 is refused before the owner is asked, and a singlet the owner refuses leaves what was struck as it was', async () => {
  const {c, owner} = await openController();
  try {
    await c.torusSinglet(5);
    const struck = structuredClone(c.reading.instrument.struck);
    for (const codon of [64, -1, 2.5, NaN, '8']) await assert.rejects(c.torusSinglet(codon), /codon is 0 to 63/, String(codon));
    await assert.rejects(c.torusSinglet(8, 0), /amplitude/);
    assert.equal(owner.acts.length, 1, 'nothing malformed reached the owner');
    owner.refuse = command => command.operation === 'torus-singlet';
    await assert.rejects(c.torusSinglet(8), /controlled refusal/);
    assert.deepEqual(c.reading.instrument.struck, struck, 'a singlet the owner did not take is not what the torus plays');
  } finally { await c.dispose(); }
});

test('the singlet stage command names one codon of the 64, and for a take played again its strength and sample', async () => {
  const {readStageRequest} = await stage();
  assert.deepEqual(readStageRequest(request({command: 'singlet', codon: 58})), {req: 7, command: {command: 'singlet', codon: 58}});
  assert.deepEqual(readStageRequest(request({command: 'singlet', codon: 0})).command, {command: 'singlet', codon: 0});
  // A take's singlet strikes again as it was struck, at its sample (O-I #855; live/clipPlayer.ts).
  assert.deepEqual(readStageRequest(request({command: 'singlet', codon: 8, amplitude: 0.35, at_samples_elapsed: '4800'})).command,
    {command: 'singlet', codon: 8, amplitude: 0.35, at_samples_elapsed: '4800'});
  for (const body of [{}, {codon: 64}, {codon: -1}, {codon: 2.5}, {codon: '8'}, {codon: 8, amplitude: 0}, {codon: 8, amplitude: 1.5},
    {codon: 8, amplitude: '0.35'}, {codon: 8, at_samples_elapsed: 4800}, {codon: 8, at_samples_elapsed: '04800'}, {codon: 8, arc: 9}])
    assert.equal(readStageRequest(request({command: 'singlet', ...body})), null, JSON.stringify(body));
});

test('the frame runs a singlet as the controller\'s torus-singlet and answers where it landed', async () => {
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const start = app.indexOf("case 'singlet':");
  assert.ok(start >= 0);
  const block = app.slice(start, app.indexOf("case 'audio-clock':", start));
  assert.match(block, /nativeField\.controller\.torusSinglet\(command\.codon,command\.amplitude,command\.at_samples_elapsed\)/);
  assert.match(block, /landed_at_samples_elapsed/);
});

test('an M3 event applied through the frame\'s own Nara channel strikes the singlet it leaves, through the native field', async () => {
  const field = await readFile(new URL('../src/nativeField.ts', import.meta.url), 'utf8');
  assert.match(field, /import \{onM3Applied\} from '\.\/kernelExpressions'/);
  assert.match(field, /import \{singletOfApplied\} from '\.\.\/\.\.\/\.\.\/src\/nara\/nativeM3'/);
  const own = field.slice(field.indexOf('const unsinglet='), field.indexOf('const touch='));
  assert.match(own, /onM3Applied\(reading=>\{const codon=singletOfApplied\(reading\);if\(codon===null\)return;/);
  assert.match(own, /controller\.torusSinglet\(codon\)\.catch\(/);
  assert.match(field, /dispose:\(\)=>\{unsinglet\(\);/, 'the listener goes with the field');
});

test('the frame\'s Nara channel announces each applied M3 answer once it lands, and nothing else', async () => {
  // The hosted frame's channel to the kernel (kernelExpressions.ts), over a simulated host as composite-edits.test.mjs simulates it.
  const listeners = [], posted = [];
  let reply = () => ({ok: true, data: {schema: 'oi.m3-reception-context/v1', status: 'available'}});
  const parent = {postMessage: message => {
    posted.push(message);
    if (message.kind === 'oi-kernel-hello') setTimeout(() => deliver({v: 1, kind: 'oi-kernel-channel'}), 0);
    if (message.kind === 'nara-instrument') setTimeout(() => deliver({v: 1, kind: 'nara-instrument-result', req: message.req, ...reply(message)}), 0);
  }};
  const deliver = data => { for (const fn of listeners.slice()) fn({source: parent, origin: HOST_ORIGIN, data}); };
  const before = globalThis.window;
  globalThis.window = {parent, location: {origin: FRAME_ORIGIN, ancestorOrigins: {length: 1, 0: HOST_ORIGIN}}, addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); }, setTimeout, clearTimeout};
  try {
    const channel = await bundle(join(journeys, 'src/kernelExpressions.ts'), 'kernel-expressions');
    channel.installKernelExpressions();
    await new Promise(resolve => setTimeout(resolve, 0));
    const heard = [];
    const off = channel.onM3Applied(reading => heard.push(reading));
    const basis = {expression_ref: 'expression:e', source: {source_ref: 's', revision: 'r'}};
    const apply = {operation: 'm3', basis, role: 'nara', request: {operation: 'apply', expected_generation: 7, operations: [{operation: 'set-matrix', family: 0}]}};
    const answered = await channel.naraInstrumentRequest(apply);
    assert.deepEqual(heard, [answered], 'the applied answer, as the kernel gave it');
    await channel.naraInstrumentRequest({...apply, request: {operation: 'read'}});
    await channel.naraInstrumentRequest({operation: 'current_read', basis, role: 'nara'});
    assert.equal(heard.length, 1, 'a read is no event');
    reply = () => ({ok: false, error: 'stale generation'});
    await assert.rejects(channel.naraInstrumentRequest(apply), /stale generation/);
    assert.equal(heard.length, 1, 'a refused event is no event');
    reply = () => ({ok: true, data: {schema: 'oi.m3-reception-context/v1', status: 'available'}});
    off();
    await channel.naraInstrumentRequest(apply);
    assert.equal(heard.length, 1, 'a listener let go hears nothing');
    assert.ok(posted.some(message => message.kind === 'nara-instrument' && message.request.request.operation === 'apply'));
  } finally { if (before === undefined) delete globalThis.window; else globalThis.window = before; }
});

// ---------------------------------------------------------------------------------------------------- the Torus in the desktop's one engine (O-I #849)
// On Play the shell asks the frame to hand the Torus over (`torus-engine`), puts it on the set's MIDI part with the lease and digest the
// answer carries (live_engine_torus), and the frame's own sound of it is shut so the part sounds once. The kernel tells the engine every act
// the owner lands; whatever else moves the owner's Torus has it handed over again (src-tauri torus_native.rs follows it bit for bit).
test('the torus-engine stage command says on or off, and its answer is the lease and digest the engine takes the Torus by, read exactly', async () => {
  const {readStageRequest, readStageResult, stageReplyMessage, readStageTorusEngine, STAGE_COMMANDS} = await stage();
  assert.ok(STAGE_COMMANDS.includes('torus-engine'));
  assert.deepEqual(readStageRequest(request({command: 'torus-engine', on: true})), {req: 7, command: {command: 'torus-engine', on: true}});
  assert.deepEqual(readStageRequest(request({command: 'torus-engine', on: false})).command, {command: 'torus-engine', on: false});
  for (const body of [{}, {on: 'true'}, {on: 1}, {on: true, lease: 'l'}, {on: true, track: 0}])
    assert.equal(readStageRequest(request({command: 'torus-engine', ...body})), null, JSON.stringify(body));
  const handed = {lease: 'native-expression-1-2-3', sha256: 'sha256:' + 'ab'.repeat(32), generation: '4', at_samples_elapsed: '4800'};
  assert.deepEqual(readStageTorusEngine(handed), handed);
  // round 13: when the frame plays the sample it was handed over at, in the machine's wall clock, so the engine takes it then
  assert.deepEqual(readStageTorusEngine({...handed, heard_at_ms: 1793750400123.5}), {...handed, heard_at_ms: 1793750400123.5});
  for (const bad of [{...handed, sha256: 'sha256:' + 'AB'.repeat(32)}, {...handed, sha256: 'ab'.repeat(32)}, {...handed, at_samples_elapsed: 4800},
    {...handed, generation: '04'}, {...handed, lease: ''}, {...handed, continuation: {}}, null, 'sha256:',
    {...handed, heard_at_ms: '1793750400123'}, {...handed, heard_at_ms: NaN}, {...handed, heard_at_ms: Infinity}, {...handed, heard_at_ms: 0}, {...handed, heard_at_ms: -40}])
    assert.equal(readStageTorusEngine(bad), null, JSON.stringify(bad));
  const reply = stageReplyMessage(7, {ok: true, torus_engine: handed}, {command: 'torus-engine', on: true});
  assert.deepEqual(reply.torus_engine, handed);
  assert.deepEqual(readStageResult(reply), {req: 7, ok: true, torus_engine: handed});
  const timed = {...handed, heard_at_ms: 1793750400123.5};
  assert.deepEqual(readStageResult(stageReplyMessage(7, {ok: true, torus_engine: timed}, {command: 'torus-engine', on: true})), {req: 7, ok: true, torus_engine: timed},
    'when the frame plays the sample it was handed over at crosses the channel with it');
  assert.equal(readStageResult({...reply, torus_engine: {...handed, continuation: {}}}), null, 'the field itself never crosses the channel');
});

test('the Torus handed over to the engine shuts the frame\'s own sound of it, and anything but an act the engine follows hands it over again', async () => {
  const {c, owner} = await openController();
  const handovers = () => owner.handovers ?? 0;
  const settled = async () => { for (let i = 0; i < 100 && c.reading.torus_engine.stale; i++) await new Promise(resolve => setTimeout(resolve, 5)); };
  try {
    assert.deepEqual(c.reading.torus_engine, {on: false, handed: null, stale: false, refusal: null, frame_gain: 1, frame_until: null}, 'the frame sounds the Torus until asked');
    // round 13: the answer also names when the frame plays the sample it was handed over at (heard_at_ms; the next test reads it)
    const {heard_at_ms, ...handed} = await c.torusEngine(true);
    assert.ok(Number.isFinite(heard_at_ms), 'when the frame plays the sample the Torus was handed over at');
    assert.deepEqual(handed, {lease: 'controlled:scene-lease', sha256: 'sha256:' + '1'.padStart(64, '0'), generation: owner.frame.generation,
      at_samples_elapsed: owner.frame.samples_elapsed}, 'the lease and the digest the kernel relayed, never the field');
    assert.equal(handovers(), 1);
    assert.equal(c.reading.torus_engine.on, true);
    assert.equal(c.reading.torus_engine.frame_gain, 0, 'the part sounds once: through the engine');
    // an act the engine follows (the kernel tells it) is not a reason to hand the Torus over again
    await c.torusPlay([{row: 0, column: 42}], 0.35);
    await c.torusSinglet(5);
    await settled();
    assert.equal(handovers(), 1, 'a key and a singlet reach the engine as the owner landed them');
    // a setting moves what the engine sounds: handed over again, in the serial owner's next turn
    await c.torusSet({tuning: 'sky'});
    await settled();
    assert.equal(handovers(), 2, 'a setting has the Torus handed over again');
    assert.equal(c.reading.torus_engine.handed.sha256, 'sha256:' + '2'.padStart(64, '0'));
    assert.equal(c.reading.torus_engine.stale, false);
    // a hand-over the owner refuses stands in words, and the frame stays shut: the engine still sounds what it was handed
    owner.refuseHandover = true;
    await c.torusSet({tuning: 'logic'});
    await settled();
    assert.equal(handovers(), 3);
    assert.match(c.reading.torus_engine.refusal, /a setting waits for a later sample/);
    assert.equal(c.reading.torus_engine.frame_gain, 0);
    owner.refuseHandover = false;
    // off: the frame sounds the Torus again, and nothing is asked of the owner
    assert.equal(await c.torusEngine(false), null);
    assert.deepEqual(c.reading.torus_engine, {on: false, handed: null, stale: false, refusal: null, frame_gain: 1, frame_until: null});
    await c.torusSet({tuning: 'sky'});
    await settled();
    assert.equal(handovers(), 3, 'off, nothing is handed over');
  } finally { await c.dispose(); }
});

// Round 13: the first hand-over in step with the frame. The frame keeps sounding the Torus until it plays the sample its owner handed it
// over at — the context time its receiver schedules that sample for (native-audio.mjs: context_origin_seconds + (s − native_origin)/rate) —
// and shuts then, not at once; the answer names when that is heard, in the machine's wall clock, through the context's output timestamp or
// its output latency, so the engine takes the Torus at its own frame heard then (live_engine_host.rs frame_heard_in) and the part sounds on
// from where the frame stops. Off opens the frame again at once.
test('the frame sounds the Torus until the sample it was handed over at, and names when that is heard so the engine takes it then', async () => {
  // a gain whose scheduled values stand from their time, as Web Audio's do; cancelling them restores the value set before them
  const Timed = base => class extends base {
    createGain() {
      const context = this, node = super.createGain();
      let value = node.gain.value, events = [];
      node.gain = {
        get value() { const due = events.filter(([, at]) => at <= context.currentTime).at(-1); return due ? due[0] : value; },
        set value(v) { value = v; events = []; },
        setValueAtTime(v, at) { events.push([v, at]); },
        cancelScheduledValues(at) { events = events.filter(([, t]) => t < at); },
      };
      return node;
    }
  };
  const {c, owner, audio} = await openController({Audio: Timed});
  try {
    audio.outputLatency = 0.012;
    const before = Date.now();
    const handed = await c.torusEngine(true);
    const after = Date.now();
    const receipt = c.reading.native.audio;
    const until = receipt.context_origin_seconds + (Number(handed.at_samples_elapsed) - Number(receipt.native_origin)) / receipt.device_sample_rate;
    assert.ok(until > audio.currentTime, `the frame has scheduled the sample ahead of what it plays: ${until}`);
    assert.equal(c.reading.torus_engine.frame_until, until, 'the frame shuts at the sample it was handed over at');
    assert.equal(c.reading.torus_engine.frame_gain, 1, 'until then the frame sounds it');
    const heard = (until - audio.currentTime + audio.outputLatency) * 1000;
    assert.ok(handed.heard_at_ms >= before + heard - 1 && handed.heard_at_ms <= after + heard + 1,
      `heard ${heard} ms from now, through the output latency: ${handed.heard_at_ms - before}`);
    audio.currentTime = until;
    assert.equal(c.reading.torus_engine.frame_gain, 0, 'from then the part sounds once: through the engine');
    assert.equal(await c.torusEngine(false), null);
    assert.equal(c.reading.torus_engine.frame_gain, 1, 'off: at once');
    assert.equal(c.reading.torus_engine.frame_until, null);
    // the context's own output timestamp, when it gives one: the context time heard at a moment of the page's clock
    audio.getOutputTimestamp = () => ({contextTime: audio.currentTime - 0.004, performanceTime: performance.now() - 2});
    const again = await c.torusEngine(true);
    const shut = c.reading.torus_engine.frame_until;
    const stamped = (shut - (audio.currentTime - 0.004)) * 1000 - 2;
    assert.ok(Math.abs(again.heard_at_ms - Date.now() - stamped) <= 5, `heard through the output timestamp: ${again.heard_at_ms - Date.now()} vs ${stamped}`);
    // a hand-over while the engine already sounds it, at a later sample of the owner's, leaves the frame shut as it stood
    audio.currentTime = shut;
    assert.equal(c.reading.torus_engine.frame_gain, 0);
    owner.handedAt = String(Number(again.at_samples_elapsed) + 2400);
    const later = await c.torusEngine(true);
    assert.equal(later.at_samples_elapsed, owner.handedAt);
    assert.equal(c.reading.torus_engine.frame_gain, 0, 'the frame stays shut');
    assert.equal(c.reading.torus_engine.frame_until, shut, 'and shut from where it stood');
  } finally { await c.dispose(); }
});

test('a hand-over the owner refuses leaves the frame sounding the Torus, and says why', async () => {
  const {c, owner} = await openController();
  try {
    owner.refuseHandover = true;
    await assert.rejects(c.torusEngine(true), /a setting waits for a later sample/);
    assert.equal(c.reading.torus_engine.on, false);
    assert.equal(c.reading.torus_engine.frame_gain, 1, 'nothing was handed over, so the frame still sounds it');
    assert.match(c.reading.torus_engine.refusal, /a setting waits for a later sample/);
  } finally { await c.dispose(); }
});

test('what moves the owner\'s Torus past what the engine follows: a setting, a restore, a body, an event, a setting landing in an advance', async () => {
  const {torusMoved} = await controller();
  for (const operation of ['torus-set', 'torus-restore', 'torus-body', 'm1-advance', 'replace-event', 'set-damping'])
    assert.equal(torusMoved({operation}, {status: 'ok'}), true, operation);
  for (const operation of ['torus-play', 'strike-at', 'torus-singlet', 'strike', 'torus-release', 'torus-native', 'torus-state', 'torus-checkpoint', 'read', 'inspect'])
    assert.equal(torusMoved({operation}, {status: 'ok'}), false, operation);
  // O-I #849 round 14: the receiver moves only the gains the Torus is heard by, and the owner names each part of a block that reaches
  // them (QL torus_heard), which the engine reaches over the same samples: it follows the move, so the receiver hands nothing over again.
  assert.equal(torusMoved({operation: 'torus-receiver'}, {status: 'ok'}), false, 'the engine follows the receiver\'s moves');
  assert.equal(torusMoved({operation: 'advance'}, {status: 'ok'}), false, 'an advance moves only the cursor the engine runs on');
  assert.equal(torusMoved({operation: 'advance'}, {status: 'ok', torus_set_landed: {at_samples_elapsed: '4800'}}), true, 'a setting landed in it');
  assert.equal(torusMoved(undefined, {}), false);
});

test('the frame runs torus-engine as the controller\'s torusEngine and answers what the engine takes the Torus by', async () => {
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const start = app.indexOf("case 'torus-engine':");
  assert.ok(start >= 0);
  const block = app.slice(start, app.indexOf("case 'render-take':", start));
  assert.match(block, /nativeField\.controller\.torusEngine\(command\.on\)/);
  assert.match(block, /torus_engine/);
});

// ---------------------------------------------------------------------------------------------------- the frame off screen (G4)
// DLW build ruling 2026-11-07 (G4 of the walk of O-I 857): the instrument sounds while its frame is not on screen, as Live's instruments
// play from Session view with the device view closed. Leaving Pane view pauses drawing only; it never holds the field, its audio
// receiver, keys, strikes, clip play or Record, and coming back draws the instrument as it stands. Only the person's own hold holds it.
const channel = () => bundle(join(journeys, 'src/native-field/channel.ts'), 'channel');
const NATIVE = 'oi.native-expression/v1';

test('the host hiding the frame\'s surface is told to the frame as drawing paused, never as a hold of the field', async () => {
  const listeners = [], parent = {postMessage() {}};
  const previous = globalThis.window;
  globalThis.window = {location: {origin: FRAME_ORIGIN, ancestorOrigins: {length: 1, 0: HOST_ORIGIN}}, addEventListener: (kind, f) => { if (kind === 'message') listeners.push(f); }, removeEventListener() {}, parent,
    setTimeout, clearTimeout};
  try {
    const {NativeChannel} = await channel();
    const port = new NativeChannel(), holds = [], shown = [];
    port.onHold = reason => holds.push(reason);
    port.onVisibility = visible => shown.push(visible);
    const post = data => { for (const f of listeners) f({source: parent, origin: HOST_ORIGIN, data: {schema: NATIVE, epoch: 'e1', ...data}}); };
    post({kind: 'available', available: true});
    post({kind: 'visibility', visible: false});
    post({kind: 'visibility', visible: true});
    assert.deepEqual(holds, [], 'a hidden surface holds nothing');
    assert.deepEqual(shown, [false, true], 'hidden, then shown again: drawing pauses and resumes');
    port.dispose();
  } finally { globalThis.window = previous; }
});

test('while its surface is hidden the field follows on: keys sound, the receiver stands, and the person\'s own hold still holds', async () => {
  const {c, owner, audio} = await openController();
  try {
    assert.equal(c.status, 'following');
    assert.equal(typeof owner.onVisibility, 'function', 'the controller hears the host show and hide its surface');
    owner.onVisibility(false);
    assert.equal(c.surfaceShown, false, 'drawing is paused');
    assert.equal(c.status, 'following', 'the field is not held');
    assert.notEqual(c.reason, 'host surface hidden');
    c.frame(0.016, false);
    assert.equal(c.status, 'following', 'the app\'s frame while hidden holds nothing');
    assert.deepEqual(await c.torusPlay([{row: 0, column: 42}], 0.35), [], 'a key sounds while the frame is off screen');
    assert.deepEqual(owner.acts.at(-1).operation, 'torus-play');
    assert.notEqual(audio.state, 'closed', 'the audio receiver outlives the view change');
    owner.onVisibility(true);
    assert.equal(c.surfaceShown, true, 'shown again: the instrument draws as it stands');
    assert.equal(c.status, 'following');
    c.hold('manual hold');
    assert.equal(c.status, 'held', 'the person\'s own hold holds the field');
    owner.onVisibility(false); owner.onVisibility(true);
    assert.equal(c.status, 'held', 'and a view change does not lift it');
    assert.equal(c.reason, 'manual hold');
  } finally { await c.dispose(); }
});

test('the frame pauses only drawing while hidden: no hold for a hidden document, and the field is drawn again when shown', async () => {
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const field = await readFile(new URL('../src/nativeField.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(field, /controller\.hold\('document hidden'\)/, 'a hidden document holds nothing');
  const tick = app.slice(app.indexOf('function tick(now:number'), app.indexOf('// Collisions strike', app.indexOf('function tick(now:number')));
  assert.match(tick, /controller\.frame\(delta,fieldPaused\|\|libraryOpen\)/, 'the app\'s frame holds only for the person\'s pause or the library');
  // The scene clock is the document's own (controller.ts documentSceneClock, 46c item 10): it draws only while the surface is shown and
  // the document is not hidden, and catches up the time since its last step when the page comes back (behaviour: transport.test.mjs).
  assert.match(app, /documentSceneClock\(document,\{surfaceShown:\(\)=>nativeField\?\.controller\.surfaceShown!==false/, 'drawing waits on the surface being shown');
  assert.match(tick, /if\(drawn&&!surfaceWasShown\)needsFrame=true/, 'and shown again the field is drawn as it stands');
});

// G4, BA's r893 finding (DLW build ruling 2026-11-07): the frame drew at about 60 frames a second inside a container shown none, and the
// scene clock rode that draw loop. Hidden, the draw loop is let go and a timer steps the clock alone.
test('a minimized window keeps its scene\'s time: hidden, the clock steps by the real time elapsed, and only a drawn step is clamped (DLW build ruling 2026-11-08, item 8)', async () => {
  // A hidden document's timers are throttled to about once a second. The frame's step was clamped to 0.25 s whatever it drew, so a
  // minimized window ran the scene's clock at a quarter of its time, and the transport held outright on `document.hidden`.
  const {frameClock, sceneStep, DRAWN_STEP_MAX_S} = await controller();
  let shown = false, at = 0, ids = 0, scene = 0, last = 0;
  const timers = new Map(), frames = new Map();
  const host = {shown: () => shown, now: () => at,
    frame: step => { const id = ++ids; frames.set(id, step); return id; }, cancelFrame: id => { frames.delete(id); },
    timer: (step, ms) => { const id = ++ids; timers.set(id, step); return id; }, cancelTimer: id => { timers.delete(id); }};
  const clock = frameClock(host, (now, drawn) => { scene += sceneStep(now - last, drawn); last = now; });
  clock.start();
  for (let second = 1; second <= 10; second++) { at = second * 1000; const [[id, step]] = [...timers]; timers.delete(id); step(); }
  assert.equal(scene, 10, 'ten throttled seconds hidden are ten seconds of the scene, on a logical clock');
  assert.equal(sceneStep(1000, true), DRAWN_STEP_MAX_S, 'a drawn step after a stall is clamped, so the picture never leaps');
  assert.equal(sceneStep(16, true), 0.016);
  assert.equal(sceneStep(-5, false), 0, 'time never runs back');
  clock.stop();
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const tick = app.slice(app.indexOf('function tick(now:number'), app.indexOf('\n}\n', app.indexOf('function tick(now:number')));
  assert.match(tick, /const rawDelta=sceneStep\(now-lastTime,drawn\);/, 'the tick steps the scene by sceneStep');
  assert.doesNotMatch(tick, /hidden:document\.hidden/, 'a hidden document no longer holds the scene\'s transport: it holds drawing only (ruling 1)');
  assert.doesNotMatch(tick, /Math\.min\(rawDelta,\.25\)/, 'the reverse shuttle takes the same step, clamped only when drawn');
});

test('hidden, the frame lets its draw loop go and a timer steps its clock alone; shown, one animation frame steps it and draws', async () => {
  const {frameClock, CLOCK_STEP_MS} = await controller();
  let shown = true, at = 0, ids = 0;
  const frames = new Map(), timers = new Map(), steps = [];
  const host = {shown: () => shown, now: () => at,
    frame: step => { const id = ++ids; frames.set(id, step); return id; }, cancelFrame: id => { frames.delete(id); },
    timer: (step, ms) => { const id = ++ids; timers.set(id, {step, ms}); return id; }, cancelTimer: id => { timers.delete(id); }};
  const runFrame = now => { const [[id, step]] = [...frames]; frames.delete(id); step(now); };
  const runTimer = () => { const [[id, {step}]] = [...timers]; timers.delete(id); step(); };
  const clock = frameClock(host, (now, drawn) => steps.push([now, drawn]));
  clock.start();
  assert.deepEqual([frames.size, timers.size], [1, 0], 'shown: one animation frame waits');
  runFrame(16);
  assert.deepEqual(steps, [[16, true]], 'it steps the clock and draws');
  shown = false; clock.moved();
  assert.deepEqual([frames.size, timers.size], [0, 1], 'hidden: the waiting frame is let go at once, never waited for, and a timer takes the clock');
  assert.equal([...timers.values()][0].ms, CLOCK_STEP_MS);
  at = 40; runTimer(); at = 56; runTimer();
  assert.deepEqual(steps.slice(1), [[40, false], [56, false]], 'the clock steps on with nothing drawn');
  assert.deepEqual([frames.size, timers.size], [0, 1], 'and asks no animation frame while hidden');
  shown = true; clock.moved();
  assert.deepEqual([frames.size, timers.size], [1, 0], 'shown again: the timer is let go and the draw loop takes the clock back');
  clock.moved(); clock.start();
  assert.deepEqual([frames.size, timers.size], [1, 0], 'never two steps waiting');
  clock.stop();
  assert.deepEqual([frames.size, timers.size], [0, 0], 'stopped: nothing waits');
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const tick = app.slice(app.indexOf('function tick(now:number'), app.indexOf('\nwindow.addEventListener(\'resize\'', app.indexOf('function tick(now:number')));
  assert.doesNotMatch(tick, /requestAnimationFrame/, 'the step asks for no animation frame of its own: the clock schedules it');
  // REPLACED (O-I #747 round 896 1V, F1): the engine steps on every step, drawn or not, and draws only on a drawn one (fieldStep; below).
  assert.match(tick, /if\(fieldDoes\)\{try\{const frame=frameData\(delta\);rebindAroundAct\(frame\);engine\.render\(frame,fieldDoes==='draw'\);/, 'the field is drawn only on a drawn step');
  assert.match(tick, /if\(drawn&&transitionDuration>0\)\{const f=[^;]*;paintTransition\(f\)/, 'a transition is painted only on a drawn step');
  assert.match(tick, /if\(drawn&&overlayDirty&&!libraryOpen\)drawGuides\(\)/, 'the guides are drawn only on a drawn step');
  // 47c item 4: the step goes through sceneTransport.ts's tickSceneTransport, which tells the transport whether it was drawn.
  assert.match(tick, /\n const transportFrame=tickSceneTransport\(store\.document,sceneIndex,sceneElapsed,rawDelta,rate,drawn,/, 'the scene\'s transport steps on every step, drawn or not');
  const transport = await readFile(new URL('../src/sceneTransport.ts', import.meta.url), 'utf8');
  assert.match(transport, /advanceSceneTransport\(journey, sceneIndex, elapsed, rate < 0 \? 0 : rawDelta \* Math\.max\(0, rate\), told\)/, 'forward at the rate it plays');
  assert.match(app, /onSurface:\(\)=>sceneClock\.moved\(\)/, 'the host showing or hiding the surface moves the clock at once');
});

// ---------------------------------------------------------------------------------------------------- the driver's heartbeat (G2)
// DLW build ruling 2026-11-07 (G2): the driver's lease follows its holder's life; the frame's readback tick is the holder's heartbeat.
test('the frame beats its driver\'s holder on its readback tick while it holds a lease, and not before it is answered', async () => {
  const posted = [], listeners = [];
  const parent = {postMessage: data => posted.push(data)};
  const previous = globalThis.window;
  globalThis.window = {location: {origin: FRAME_ORIGIN, ancestorOrigins: {length: 1, 0: HOST_ORIGIN}}, addEventListener: (kind, f) => { if (kind === 'message') listeners.push(f); }, removeEventListener() {}, parent, setTimeout, clearTimeout};
  try {
    const {NativeChannel} = await channel();
    const port = new NativeChannel();
    port.beat();
    assert.equal(posted.filter(d => d.kind === 'beat').length, 0, 'no beat before the host has answered');
    for (const f of listeners) f({source: parent, origin: HOST_ORIGIN, data: {schema: NATIVE, epoch: 'e1', kind: 'available', available: true}});
    port.beat();
    assert.deepEqual(posted.filter(d => d.kind === 'beat'), [{schema: NATIVE, epoch: 'e1', kind: 'beat'}], 'the beat names no lease: the host beats its own');
    port.dispose();
    port.beat();
    assert.equal(posted.filter(d => d.kind === 'beat').length, 1, 'a disposed channel beats nothing');
  } finally { globalThis.window = previous; }
  const {c} = await openController();
  assert.equal(c.leased, true, 'an open driver is leased');
  await c.release();
  assert.equal(c.leased, false);
  const field = await readFile(new URL('../src/nativeField.ts', import.meta.url), 'utf8');
  const tick = field.slice(field.indexOf('const timer=window.setInterval('), field.indexOf('},250);', field.indexOf('const timer=window.setInterval(')));
  assert.match(tick, /if\(controller\.leased\)port\.beat\(\)/, 'the readback tick is the heartbeat; no timer of its own');
});

// O-I #747 round 896 1V, F1 and F3 (DLW build ruling 2026-11-09, the review of 24b62a75): a hidden field keeps playing and only its drawing
// stops; a film being recorded draws hidden, by the animation frame where the engine runs one for a hidden frame (WebKit) and by the timer
// where it runs none (Chromium). Behaviour in both engines, on the real engine: packages/live-shell/ui/tests/frame-hidden-draw-896.test.mjs.
test('1V F1 and F3: the engine steps on a hidden step and draws only on a drawn one; a film draws hidden, by whichever of the frame and the timer comes first', async () => {
  const {frameClock, documentSceneClock, fieldStep, CLOCK_STEP_MS} = await controller();
  const step = (drawn, more = {}) => fieldStep({due: true, drawn, paced: true, moving: true, ...more});
  assert.equal(step(true), 'draw', 'shown: the field steps and draws');
  assert.equal(step(false), 'advance', 'hidden: the field steps and draws nothing');
  assert.equal(step(false, {paced: false}), 'advance', 'the pace is the drawing\'s, not the field\'s');
  assert.equal(step(false, {moving: false}), null, 'a hidden step that moves no time (a pause) leaves it');
  assert.equal(step(true, {paced: false}), null, 'a drawn step the pace refuses leaves it, as before');
  assert.equal(step(true, {due: false}), null, 'a field not due a step is left');
  let shown = false, filming = true, at = 0, ids = 0;
  const frames = new Map(), timers = new Map(), steps = [];
  const host = {shown: () => shown, filming: () => filming, now: () => at,
    frame: step => { const id = ++ids; frames.set(id, step); return id; }, cancelFrame: id => { frames.delete(id); },
    timer: (step, ms) => { const id = ++ids; timers.set(id, {step, ms}); return id; }, cancelTimer: id => { timers.delete(id); }};
  const runFrame = now => { const [[id, step]] = [...frames]; frames.delete(id); step(now); };
  const runTimer = () => { const [[id, {step}]] = [...timers]; timers.delete(id); step(); };
  const clock = frameClock(host, (now, drawn) => steps.push([now, drawn]));
  clock.start();
  assert.deepEqual([frames.size, timers.size], [1, 1], 'hidden with a film: an animation frame and the timer both wait');
  assert.equal([...timers.values()][0].ms, CLOCK_STEP_MS, 'the timer at the field\'s own step');
  at = 16; runFrame(15.2);
  assert.deepEqual(steps, [[16, true]], 'where the frame runs (WebKit), it steps the clock and draws, at the host\'s time and not the frame\'s own (one clock, 1W item 1)');
  assert.deepEqual([frames.size, timers.size], [1, 1], 'the timer that lost is let go: one pair waits, never a double step');
  at = 40; runTimer();
  assert.deepEqual(steps.slice(1), [[40, true]], 'where no frame runs (Chromium), the timer steps it and draws');
  assert.deepEqual([frames.size, timers.size], [1, 1]);
  filming = false; clock.moved();
  assert.deepEqual([frames.size, timers.size], [0, 1], 'the film ended: hidden, the timer alone');
  at = 56; runTimer();
  assert.deepEqual(steps.slice(2), [[56, false]], 'and nothing is drawn');
  shown = true; clock.moved();
  assert.deepEqual([frames.size, timers.size], [1, 0], 'shown: the animation frame alone');
  clock.stop();
  assert.deepEqual([frames.size, timers.size], [0, 0]);
  // A hidden document draws no film: its frames and timers are the browser's to stop.
  const doc = {hidden: true, addEventListener() {}, removeEventListener() {}};
  frames.clear(); timers.clear();
  const minimized = documentSceneClock(doc, {...host, surfaceShown: () => false, filming: () => true}, () => {});
  minimized.start();
  assert.deepEqual([frames.size, timers.size], [0, 1], 'a hidden document with a film: the timer alone, drawing nothing');
  minimized.stop();
  // A shown document whose host shows the surface none of (a Session view over the field), with a film: the scene clock passes the film
  // through to the frame clock, which then draws by whichever of the frame and the timer comes first (1W item 1).
  const visible = {hidden: false, addEventListener() {}, removeEventListener() {}};
  frames.clear(); timers.clear();
  const covered = documentSceneClock(visible, {...host, surfaceShown: () => false, filming: () => true}, () => {});
  covered.start();
  assert.deepEqual([frames.size, timers.size], [1, 1], 'a shown document, its surface hidden, a film: the frame and the timer both wait');
  covered.stop();
  frames.clear(); timers.clear();
  const unfilmed = documentSceneClock(visible, {...host, surfaceShown: () => false, filming: () => false}, () => {});
  unfilmed.start();
  assert.deepEqual([frames.size, timers.size], [0, 1], 'and with no film, the timer alone');
  unfilmed.stop();
  // The app asks the same rule and names the film to its clock: each clause red when removed.
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.match(app, /documentSceneClock\(document,\{surfaceShown:\(\)=>nativeField\?\.controller\.surfaceShown!==false,filming:\(\)=>recorder\.active,/,
    'a film being recorded draws hidden (the clock\'s filming, once the surface\'s || recorder.active)');
  // The film's clean frame presents the scene again: it is taken only where the field was drawn, so it waits on the GPU as the draw does.
  assert.match(app, /\n if\(recorder\.active&&fieldDrawn\)\{const paperScene=/, 'the film takes its frame only where the field was drawn (1W item 1)');
  const tick = app.slice(app.indexOf('function tick(now:number'), app.indexOf('// Collisions strike', app.indexOf('function tick(now:number')));
  assert.match(tick, /const fieldDoes=fieldStep\(\{due:recovery\.hidden&&!libraryOpen&&\(!fieldPaused\|\|needsFrame\|\|engine\.needsRender\?\.\(\)\|\|pointer\.active\|\|recorder\.active\|\|transitionDuration>0\),drawn:fieldDrawn,paced:now-lastStudioRender>=\(physisFpsCap\?1000\/physisFpsCap:0\),moving:delta>0\}\);/,
    'the tick asks fieldStep with the clock\'s drawn');
  // A film's draw while the surface is hidden, on a timer no animation frame paces, waits on the GPU: taken undrawn while it is behind.
  assert.match(tick, /const fieldDrawn=drawn&&!\(nativeField\?\.controller\.surfaceShown===false&&engine\.gpuBehind\?\.\(\)===true\);/,
    'a film\'s hidden draw waits on the GPU');
  assert.doesNotMatch(tick, /if\(drawn&&recovery\.hidden/, 'the engine no longer waits on a drawn step');
  const production = await readFile(new URL('../src/production.ts', import.meta.url), 'utf8');
  assert.match(production, / render\(frame:EngineFrame,draw=true\)\{\n  if\(draw\)this\.dirty=false;/, 'a step that draws nothing leaves the draw owed');
  assert.match(production, /this\.engine\.advance\(frame\.delta,draw\);/);
  assert.match(production, /this\.engine\.advance\(0,draw\);/);
  const field = await readFile(new URL('../../src/engine/PointCloudField.ts', import.meta.url), 'utf8');
  assert.match(field, /public advance\(rawDelta: number, draw = true\): number \{/);
  assert.match(field, /this\.tickFrame\(delta \/ count, this\.simTime, draw && i === count - 1\);/, 'the field steps and draws only where it is asked to');
});

// O-I #747 round 896 1W item 2 (DLW build ruling 2026-11-09): a hidden document (a minimised or covered window) keeps its field playing
// while its sound is open, by the real time elapsed, as far as the webview lets the page run; a throttled timer's long step is caught up
// in the engine's own steps, the rest owed and bounded, never one jump. The sound's openness is read from the controller's reading and its
// audio context (a mocked owner here: no audio device is opened). What the webviews do with a hidden page: COMMENTS-896-1T, 1W item 2.
test('1W item 2: a hidden document\'s field plays on by real time while its sound is open, in capped steps, never one jump', async () => {
  const {hiddenFieldClock, fieldStep, HIDDEN_STEP_MAX_S, HIDDEN_OWED_MAX_S} = await controller();
  const {fieldSoundOpen} = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
  const owner = (status, audioState, muted = false) => ({reading: {status, muted}, audioState, setMuted() {}, chooseSound() {}});
  assert.equal(fieldSoundOpen(owner('following', 'running')), true, 'following, its context running: open');
  assert.equal(fieldSoundOpen(owner('following', 'suspended')), false, 'its context suspended: closed');
  assert.equal(fieldSoundOpen(owner('following', 'running', true)), false, 'the person\'s Sound Off: closed');
  assert.equal(fieldSoundOpen(owner('held', 'running')), false, 'held: closed');
  assert.equal(fieldSoundOpen(null), false, 'no field: closed');
  assert.equal(HIDDEN_STEP_MAX_S, .1, 'the engine\'s own step (PointCloudField.advance)');
  const clock = hiddenFieldClock();
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.equal(clock.step(.016, false), 0, 'its sound closed, a hidden field stands');
  assert.ok(near(clock.step(.016, true), .016), 'open, a timer\'s short step moves it by the time elapsed');
  // A hidden page's timer comes about once a second: the second is caught up in the engine's steps over the steps that follow.
  const steps = [clock.step(1, true)];
  while (clock.owed > 0) steps.push(clock.step(0, true));
  assert.ok(steps.every(s => s <= HIDDEN_STEP_MAX_S + 1e-12), `never more than the engine's step at once (${steps})`);
  assert.ok(near(steps.reduce((a, b) => a + b, 0), 1), 'and all of the second, over ten steps');
  assert.equal(steps.length, 10);
  assert.equal(fieldStep({due: true, drawn: false, paced: true, moving: steps[0] > 0}), 'advance', 'each step advances the engine, drawing nothing');
  // A page the webview suspended for half a minute: the field owes at most HIDDEN_OWED_MAX_S, and the rest is let go.
  assert.ok(near(clock.step(30, true), HIDDEN_STEP_MAX_S));
  assert.ok(near(clock.owed, HIDDEN_OWED_MAX_S - HIDDEN_STEP_MAX_S), `owed ${clock.owed}`);
  clock.reset();
  assert.equal(clock.owed, 0, 'shown again, nothing is owed: a shown step is clamped as a frame is');
  clock.step(.5, true); clock.step(0, false);
  assert.equal(clock.owed, 0, 'its sound closed, the owed time is let go');
  // The app's tick: hidden, the field's step is the hidden clock's, by the field's sound; shown, the frame's clamp, and nothing owed.
  const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.match(app, /let delta=fieldPaused\|\|libraryOpen\?0:document\.hidden\?hiddenField\.step\(rawDelta,fieldSoundOpen\(nativeField\?\.controller\)\):Math\.min\(rawDelta,\.05\);if\(!document\.hidden\)hiddenField\.reset\(\);/,
    'a hidden document steps its field by the hidden clock while its sound is open');
  assert.doesNotMatch(app, /!fieldPaused&&!document\.hidden&&!libraryOpen\?Math\.min\(rawDelta,\.05\):0/, 'no longer a hidden document\'s field standing whatever its sound');
});

// O-I #747 round 896 1X (DLW build ruling 2026-11-09): "The engine never waits indefinitely on the GPU." 1V paced an undrawn step by the
// GPU: while the fence after the last step had not passed, the step queued nothing and its time was held for the next. In headless Chromium
// on Linux (SwiftShader) a hidden frame's fence stood unpassed through whole spans, and the hidden field's time stood at 0.000 s (#946's
// candidate job). Now an unpassed fence is let go once it has stood GPU_WAIT_MS, doubled for each let go since one passed, to four at most;
// "the undrawn-step pacing stays": a fence that passes sets the wait back.
// Channel: the engine's own advance and gpuBehind (PointCloudField.ts, REAL, bundled), on a stand-in for its GPU only: a WebGL context
// whose clientWaitSync answers TIMEOUT_EXPIRED until it is told to pass, a recorded tickFrame for each sub-step's GPU work, and a logical
// wall clock (wallNow) stepped as the frame's hidden clock steps (CLOCK_STEP_MS), so the wait is read without real time.
test('1X: a fence the GPU never passes holds a hidden step for a bounded wait; the field steps on in capped steps, never one leap', async () => {
  const {PointCloudField, GPU_WAIT_MS} = await bundle(join(journeys, '../src/engine/PointCloudField.ts'), 'field-1x');
  const {DEFAULT_CONFIG} = await bundle(join(journeys, '../src/engine/fieldDefaults.ts'), 'defaults-1x');
  const {CLOCK_STEP_MS, DRAWN_STEP_MAX_S} = await controller();
  const engine = passes => {
    const gl = {SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, ALREADY_SIGNALED: 0x911a, fences: 0, deleted: 0,
      fenceSync() { this.fences++; return {fence: this.fences}; }, deleteSync() { this.deleted++; }, flush() {},
      clientWaitSync(fence) { return passes(fence.fence) ? this.ALREADY_SIGNALED : this.TIMEOUT_EXPIRED; }};
    const field = Object.create(PointCloudField.prototype), clock = {wall: 0}, ticks = [];
    Object.assign(field, {isDestroyed: false, simTime: 0, heldDelta: 0, drawFirst: false, shownAgainAt: 0, owedShown: 0, stepFence: null, stepFencedAt: 0, stepFencesLetGo: 0,
      wallNow: () => clock.wall, torPhaseAcc: 0, polPhaseAcc: 0, listeningContacts: false, automationRt: {lanes: new Map()},
      config: {...DEFAULT_CONFIG, particleCount: 64, automations: []}, renderer: {getContext: () => gl},
      simulator: {particleCount: 64, contactsListening: false, takeContactsBack() {}, readContacts() {}},
      tickFrame: (dt, _at, draw) => ticks.push({dt, draw}), emitTelemetry() {}, syncLiveMaterialUniforms() {}});
    // Hidden: the frame's timer steps the field undrawn every CLOCK_STEP_MS; each step that moves its time is recorded.
    const moves = [];
    let last = 0;
    const run = (from, to) => {
      for (let at = from; at < to; at += CLOCK_STEP_MS) {
        clock.wall = at;
        const sub = ticks.length, time = field.advance(CLOCK_STEP_MS / 1000, false);
        if (time > last) { moves.push({at, by: time - last, sub: ticks.slice(sub)}); last = time; }
      }
    };
    return {field, gl, clock, ticks, moves, run};
  };
  const gaps = moves => moves.slice(1).map((move, i) => move.at - moves[i].at);
  // A GPU that never passes a fence, for 5 s.
  const never = engine(() => false);
  never.run(0, 5000);
  assert.ok(never.moves.length > 1, `a fence that never passes no longer holds the field's time for good (${never.moves.length} step moved it in 5 s)`);
  assert.ok(never.field.simTime > .4, `the hidden field's time goes on (${never.field.simTime.toFixed(3)} s in 5 s)`);
  const waited = gaps(never.moves), longest = 4 * GPU_WAIT_MS;
  // Each fence stands its wait, rounded up to the clock's next step: GPU_WAIT_MS, then doubled for each let go, to four at most.
  waited.forEach((gap, i) => assert.ok(gap >= Math.min(longest, GPU_WAIT_MS * 2 ** i) && gap <= Math.min(longest, GPU_WAIT_MS * 2 ** i) + CLOCK_STEP_MS,
    `within the bound: wait ${i + 1} is ${gap} ms, for ${Math.min(longest, GPU_WAIT_MS * 2 ** i)} ms`));
  assert.ok(waited.every(gap => gap <= longest + CLOCK_STEP_MS), `no wait longer than ${longest} ms (${waited.join(', ')})`);
  for (const move of never.moves.slice(1)) {
    assert.ok(move.by <= .1 + 1e-9, `the held time is taken in advance's capped step, never one leap (${move.by.toFixed(4)} s)`);
    assert.ok(move.by > .05, `and it is the held time, not only the step's own (${move.by.toFixed(4)} s)`);
    assert.ok(move.sub.length >= 1 && move.sub.every(tick => tick.dt <= 1 / 60 + 1e-9 && tick.draw === false),
      `in 1/60 s sub-steps, drawing nothing (${JSON.stringify(move.sub)})`);
  }
  assert.ok(never.gl.fences - never.gl.deleted <= 1, `each fence let go is deleted (${never.gl.fences} queued, ${never.gl.deleted} deleted)`);
  // The pacing stays: a GPU that passes its fences paces the field by them, and a fence that passes sets the wait back to GPU_WAIT_MS.
  let open = false;
  const paced = engine(() => open);
  paced.run(0, 2000);
  const letGo = paced.moves.length;
  open = true; paced.run(2000, 2000 + 4 * CLOCK_STEP_MS);
  assert.ok(paced.moves.length - letGo >= 3, `a GPU that passes its fences moves the field on every step (${paced.moves.length - letGo} of 4)`);
  const caughtUp = paced.moves.length;
  open = false; paced.run(2000 + 4 * CLOCK_STEP_MS, 3000);
  const after = paced.moves[caughtUp].at - paced.moves[caughtUp - 1].at;
  assert.ok(after >= GPU_WAIT_MS && after <= GPU_WAIT_MS + CLOCK_STEP_MS, `a fence that passed set the wait back to ${GPU_WAIT_MS} ms (${after} ms)`);
  // A drawn step is paced by its animation frame: it never asks the fence.
  const drawn = engine(() => false);
  for (let at = 0; at < 200; at += CLOCK_STEP_MS) { drawn.clock.wall = at; drawn.field.advance(CLOCK_STEP_MS / 1000, true); }
  assert.ok(Math.abs(drawn.field.simTime - 13 * CLOCK_STEP_MS / 1000) < 1e-9, `drawn, every step moves (${drawn.field.simTime.toFixed(3)} s)`);
  // One bound, named twice: an undrawn step first waits on the GPU as long as the frame's clock lets a drawn step last.
  assert.equal(GPU_WAIT_MS, DRAWN_STEP_MAX_S * 1000, 'GPU_WAIT_MS is the clock\'s longest drawn step');
});

// ---------------------------------------------------------------------------------------------------- one stall (1T item 22)
// O-I #747 round 896, 1T item 22 (DLW build ruling 2026-11-09): "An acknowledgement that times out leaves the exchange's outcome unknown,
// so that one exchange is said as unknown. The session then reopens and follows again on its own. It reads the owner's current state
// before sending anything new, and never resends the unknown exchange blind." Before, the session's own bound (5 s, instrument-session.mjs
// #unknown) closed the owner when one answer was late, and only Disconnect and Connect brought the instrument back. Here a key's answer is
// held at the owner past the session's bound (250 ms in place of 5 s, the same law), then given: the controller takes the late answer as
// the owner's standing, opens the session again on it, reads the owner first, and the next key reaches the owner with no press.
const stallAt = (owner, names) => {
  let go, reached;
  const at = new Promise(resolve => { reached = resolve; });
  owner.stall = {names, gate: new Promise(resolve => { go = resolve; }), reached};
  return {at, go: () => go()};
};
const turns = async (c, until, n = 4000) => {
  for (let i = 0; i < n && !until(); i++) { c.frame(.02, false); await new Promise(resolve => setImmediate(resolve)); }
  return until();
};
const READS = ['read', 'inspect', 'influence', 'torus-state'];

test('1T item 23: shown again, the next step draws before any time held while hidden is stepped; the held time then goes in capped steps across the following draws', async () => {
  // DLW build ruling 2026-11-09 (1Y §2, item 23): under heavy contention 1X drew 0 frames shown again in 3 of 4 runs, where 08721ea3's
  // engine drew 2–6; the hidden steps 1X lets through delay the first draw. The engine's own advance, over a WebGL context whose fences
  // never pass, its host's frame clock stepping it as app.ts tick does (CLOCK_STEP_MS undrawn hidden; shownAgain when the surface is shown).
  // The held time is what a step takes of it, capped (STEP_MAX_S, as before), and it goes one sub-step with each following draw: spread
  // at the cap with each draw (each then six sub-steps), the eight-at-once run drew fewer frames shown again than 08721ea3's engine in two
  // rounds of four; one sub-step a draw, as many or more in three of three (t1/i23 of lane BA's receipt).
  const {PointCloudField, GPU_WAIT_MS, STEP_MAX_S} = await bundle(join(journeys, '../src/engine/PointCloudField.ts'), 'field-23');
  const {DEFAULT_CONFIG} = await bundle(join(journeys, '../src/engine/fieldDefaults.ts'), 'defaults-1x');
  const {CLOCK_STEP_MS} = await controller();
  const rig = () => {
    const gl = {SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, ALREADY_SIGNALED: 0x911a,
      fenceSync: () => ({}), deleteSync() {}, flush() {}, clientWaitSync() { return this.TIMEOUT_EXPIRED; }};
    const field = Object.create(PointCloudField.prototype), clock = {wall: 0}, ticks = [];
    Object.assign(field, {isDestroyed: false, simTime: 0, heldDelta: 0, drawFirst: false, shownAgainAt: 0, owedShown: 0, stepFence: null, stepFencedAt: 0, stepFencesLetGo: 0,
      wallNow: () => clock.wall, torPhaseAcc: 0, polPhaseAcc: 0, listeningContacts: false, automationRt: {lanes: new Map()},
      config: {...DEFAULT_CONFIG, particleCount: 64, automations: []}, renderer: {getContext: () => gl},
      simulator: {particleCount: 64, contactsListening: false, takeContactsBack() {}, readContacts() {}},
      tickFrame: (dt, _at, draw) => ticks.push({dt, draw}), emitTelemetry() {}, syncLiveMaterialUniforms() {}});
    // Hidden: the frame's timer steps the field undrawn; with no fence passing it moves once a bound, and the time between is held.
    const hide = (from, to) => { for (let at = from; at < to; at += CLOCK_STEP_MS) { clock.wall = at; field.advance(CLOCK_STEP_MS / 1000, false); } };
    // One step at `at`: how far it moved the field, and its sub-steps.
    const step = (at, dt, draw) => {
      clock.wall = at;
      const from = ticks.length, before = field.simTime;
      field.advance(dt, draw);
      return {by: field.simTime - before, sub: ticks.slice(from)};
    };
    return {field, step, hide};
  };
  // The steps no fence holds, on the clock's grid: the first, then one each bound, GPU_WAIT_MS doubled for each let go (1X).
  const grid = ms => Math.ceil(ms / CLOCK_STEP_MS) * CLOCK_STEP_MS;
  const moves = [0, grid(GPU_WAIT_MS), 0, 0];
  moves[2] = grid(moves[1] + 2 * GPU_WAIT_MS);
  moves[3] = grid(moves[2] + 4 * GPU_WAIT_MS);
  const own = CLOCK_STEP_MS / 1000;
  // The surface shown again (the frame's surface: its next step is an animation frame's, drawn).
  {
    const {field, step, hide} = rig();
    hide(0, moves[3] - 2 * CLOCK_STEP_MS);
    const held = field.heldDelta;
    assert.ok(held > .5, `hidden, the time between bounds is held (${held.toFixed(3)} s)`);
    field.shownAgain?.();
    const first = step(moves[3] - 2 * CLOCK_STEP_MS, own, true);
    assert.ok(Math.abs(first.by - own) < 1e-9 && first.sub.length === 1 && first.sub[0].draw === true,
      `shown again, the first draw steps its own time alone (${first.by.toFixed(3)} s in ${first.sub.length} sub-steps)`);
    // The following draws, one each animation frame: the time held goes across them, each a capped step with its own.
    const after = [];
    for (let at = moves[3] - CLOCK_STEP_MS; after.length < 60; at += CLOCK_STEP_MS) after.push(step(at, own, true));
    after.forEach(({by, sub}, i) => {
      assert.ok(by <= own + 1 / 60 + 1e-9 && by >= own - 1e-9, `draw ${i + 2} moves the field ${by.toFixed(4)} s: its own, and one sub-step of the time held at most`);
      assert.ok(sub.every(tick => tick.dt <= 1 / 60 + 1e-9) && sub.filter(tick => tick.draw).length === 1 && sub[sub.length - 1].draw,
        `in 1/60 s sub-steps, drawn once (${JSON.stringify(sub)})`);
    });
    const stepped = first.by + after.reduce((sum, {by}) => sum + by, 0), owed = Math.min(held, STEP_MAX_S);
    assert.ok(owed < held, 'more is held here than a step takes');
    assert.ok(Math.abs(stepped - (owed + 61 * own)) < 1e-6, `the time held, capped as a step takes it, is stepped across the draws (${stepped.toFixed(4)} of ${(owed + 61 * own).toFixed(4)} s)`);
    assert.ok(after.slice(-10).every(({by}) => Math.abs(by - own) < 1e-9), 'then each draw steps its own time again');
  }
  // The document shown again (app.ts: its visibility changing steps the clock once, undrawn, before the first animation frame).
  {
    const {field, step, hide} = rig();
    hide(0, moves[3]);
    const held = field.heldDelta;
    field.shownAgain?.();
    const caughtUp = step(moves[3], own, false);
    assert.ok(caughtUp.by === 0 && caughtUp.sub.length === 0,
      `shown again, an undrawn step before the first draw steps nothing, though no fence holds it now (${caughtUp.by.toFixed(3)} s in ${caughtUp.sub.length} sub-steps)`);
    const first = step(moves[3] + CLOCK_STEP_MS, own, true);
    assert.ok(Math.abs(first.by - own) < 1e-9 && first.sub.length === 1, `and the first draw steps its own time alone (${first.by.toFixed(3)} s)`);
    let stepped = first.by;
    for (let at = moves[3] + 2 * CLOCK_STEP_MS, i = 0; i < 60; at += CLOCK_STEP_MS, i++) stepped += step(at, own, true).by;
    const owed = Math.min(held + own, STEP_MAX_S);
    assert.ok(Math.abs(stepped - (owed + 61 * own)) < 1e-6, `the time held, and the undrawn step's, go after it, capped (${stepped.toFixed(4)} of ${(owed + 61 * own).toFixed(4)} s)`);
  }
  // Shown again and hidden again before it drew: the hold lapses after GPU_WAIT_MS, and the field steps on.
  {
    const {field, step, hide} = rig();
    hide(0, moves[2] + CLOCK_STEP_MS);
    field.shownAgain?.();
    let moved = null;
    for (let at = moves[2] + CLOCK_STEP_MS; at < moves[2] + 3000 && moved === null; at += CLOCK_STEP_MS) if (step(at, own, false).by > 0) moved = at;
    assert.ok(moved !== null && moved <= moves[3] + GPU_WAIT_MS + CLOCK_STEP_MS, `hidden again before it drew, the field steps on (at ${moved} ms)`);
  }
});

test('one stall past the session\'s bound does not end the instrument: the late exchange is said as unknown, never sent again, and the next key reaches the owner with no press', async () => {
  const {c, owner} = await openController({playback: {timeoutMs: 250}});
  try {
    assert.equal(c.status, 'following');
    const first = {row: 0, column: 42}, next = {row: 1, column: 43};
    const stall = stallAt(owner, command => command.operation === 'torus-play');
    const played = c.torusPlay([first], 0.35);
    const stalled = await stall.at;
    // The session's bound passes with the answer still at the owner: that exchange's outcome is unknown, and said so.
    await assert.rejects(played, /native acknowledgement timed out/);
    assert.ok(await turns(c, () => !!c.reading.unknown_exchange), 'the unknown exchange is said');
    const unknown = c.reading.unknown_exchange;
    assert.equal(unknown.operation, 'torus-play');
    assert.equal(unknown.request_id, stalled.request.request_id);
    assert.match(unknown.said, /is unknown/);
    assert.match(unknown.said, /not sent again/);
    // The application's frames go on meanwhile: the instrument is not given up while its answer may still come.
    await turns(c, () => false, 20);
    assert.equal(c.status, 'opening', `joining again, not unavailable (${c.reason})`);
    // The owner answers at last; the instrument follows again on its own.
    stall.go();
    assert.ok(await turns(c, () => c.status === 'following'), `the instrument follows again with no press (${c.status}: ${c.reason})`);
    assert.equal(c.reading.unknown_exchange.joined, true);
    // The stalled exchange was sent once; after it, the owner's state is read before anything new is sent.
    const ids = owner.calls.filter(call => call.operation === 'exchange').map(call => call.request);
    assert.equal(ids.filter(request => request.request_id === stalled.request.request_id).length, 1, 'the unknown exchange is never sent again');
    const after = ids.slice(ids.findIndex(request => request.request_id === stalled.request.request_id) + 1);
    assert.ok(after.length > 0 && READS.includes(after[0].command.operation), `the first exchange after it reads the owner (${after[0]?.command.operation})`);
    assert.ok(owner.calls.every(call => call.operation !== 'close'), 'the owner was never closed');
    // The next key reaches the owner, with no Connect and no Resume.
    const acts = owner.acts.length;
    assert.deepEqual(await c.torusPlay([next], 0.35), []);
    assert.equal(owner.acts.length, acts + 1);
    assert.deepEqual(owner.acts.at(-1).keys, [next], 'the next key reached the owner');
    assert.equal(owner.acts.filter(act => act.operation === 'torus-play' && act.keys[0].column === first.column).length, 1, 'the first key was played once, late, and never again');
  } finally { await c.dispose(); }
});

test('a stall whose answer never comes, or a release while it is awaited, ends the lifetime as before: closed, and said', async () => {
  // The owner is lost while the answer is awaited: the session is not opened again, the owner is closed, and the words say why.
  {
    const {c, owner} = await openController({playback: {timeoutMs: 250}});
    try {
      const stall = stallAt(owner, command => command.operation === 'torus-play');
      const played = c.torusPlay([{row: 0, column: 42}], 0.35);
      await stall.at;
      await assert.rejects(played, /timed out/);
      assert.ok(await turns(c, () => !!c.reading.unknown_exchange));
      owner.closed = true;
      stall.go();
      assert.ok(await turns(c, () => c.status === 'unavailable'), `given up only once the owner is gone (${c.status})`);
      assert.match(c.reason, /is unknown/);
      assert.match(c.reason, /could not be joined again/);
      assert.equal(c.reading.unknown_exchange.joined, false);
      assert.ok(owner.calls.some(call => call.operation === 'close'), 'the owner is closed');
    } finally { await c.dispose(); }
  }
  // The person releases the instrument while the answer is awaited: the late answer opens nothing.
  {
    const {c, owner} = await openController({playback: {timeoutMs: 250}});
    try {
      const stall = stallAt(owner, command => command.operation === 'torus-play');
      const played = c.torusPlay([{row: 0, column: 42}], 0.35);
      await stall.at;
      await assert.rejects(played, /timed out/);
      assert.ok(await turns(c, () => !!c.reading.unknown_exchange));
      await c.release();
      stall.go();
      await turns(c, () => false, 200);
      assert.equal(c.status, 'manual');
      assert.equal(c.reading.lease, null, 'no lease is held again');
      assert.ok(owner.calls.some(call => call.operation === 'close'));
    } finally { await c.dispose(); }
  }
});

test('1Z: a read the GPU never lets back is taken at the step\'s bound, once, and the next read is issued: hidden, the contacts come back', async () => {
  // DLW build ruling 2026-11-09 (#946 red on CI at 8ffb2fd1: hidden, "0 read, 0 back"): a read's fence takes the same bound as a step's
  // fence; at the bound the read is taken once with getBufferSubData, then the next one is issued. The engine's own advance and its
  // simulator's own read path (GPGPUSimulator readContacts, FencedRead), over a WebGL context whose fences never pass; the reductions that
  // fill the slots are the GPU's and stand outside this test.
  const {PointCloudField, GPU_WAIT_MS, fenceWait} = await bundle(join(journeys, '../src/engine/PointCloudField.ts'), 'field-1x');
  const {GPGPUSimulator, FencedRead} = await bundle(join(journeys, '../src/engine/GPGPUSimulator.ts'), 'sim-1z');
  const {DEFAULT_CONFIG} = await bundle(join(journeys, '../src/engine/fieldDefaults.ts'), 'defaults-1x');
  const {CLOCK_STEP_MS} = await controller();
  const clock = {wall: 0}, issued = [], taken = [];
  let passes = false;
  const gl = {SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, ALREADY_SIGNALED: 0x911a, WAIT_FAILED: 0x911d,
    PIXEL_PACK_BUFFER: 0x88eb, STREAM_READ: 0x88e1, RGBA: 0x1908, FLOAT: 0x1406, fences: 0,
    fenceSync() { return {fence: ++this.fences}; }, deleteSync() {}, flush() {},
    clientWaitSync() { return passes ? this.ALREADY_SIGNALED : this.TIMEOUT_EXPIRED; },
    createBuffer: () => ({}), deleteBuffer() {}, bindBuffer() {}, bufferData() {},
    // Each read with the bound the step's fence stands as it is issued (fenceWait of the fences let go since one passed).
    readPixels() { issued.push({at: clock.wall, bound: fenceWait(field.stepFencesLetGo)}); },
    // The slots as the GPU would give them: one closing pair, at half the field's top speed.
    getBufferSubData(_target, _offset, into) { taken.push(clock.wall); into.fill(0); into.set([.1, .2, .3, .5], 0); }};
  const sim = Object.create(GPGPUSimulator.prototype);
  Object.assign(sim, {particleCount: 64, contactsListening: true, pairwiseStepped: false, pairForceTarget: {}, contactRead: new FencedRead(),
    contactRestore: null, contactData: new Float32Array(8 * 8 * 4), contactQueue: [],
    contactCounts: {read: 0, back: 0, waited: 0, lost: 0, unread: 0, delivered: 0, overflow: 0, ms: 0, takeMs: 0},
    renderer: {getContext: () => gl, getRenderTarget: () => null, setRenderTarget() {}}, reduceContacts() {}});
  // The bound each read is asked to stand, beside the fences the step had let go then (1Z.1 item 4).
  const asked = [], readContacts = sim.readContacts;
  sim.readContacts = function (now, waitMs) { asked.push({waitMs, letGo: field.stepFencesLetGo}); return readContacts.call(this, now, waitMs); };
  const field = Object.create(PointCloudField.prototype);
  Object.assign(field, {isDestroyed: false, simTime: 0, heldDelta: 0, drawFirst: false, shownAgainAt: 0, owedShown: 0, stepFence: null, stepFencedAt: 0, stepFencesLetGo: 0,
    wallNow: () => clock.wall, torPhaseAcc: 0, polPhaseAcc: 0, listeningContacts: true, automationRt: {lanes: new Map()},
    config: {...DEFAULT_CONFIG, particleCount: 64, automations: []}, renderer: {getContext: () => gl}, simulator: sim,
    // Each sub-step runs the pairwise pass, as a field whose particles can make contacts does.
    tickFrame: () => { sim.pairwiseStepped = true; }, emitTelemetry() {}, syncLiveMaterialUniforms() {}});
  // Hidden for 5 s: the frame's timer steps the field undrawn every CLOCK_STEP_MS.
  const moves = [];
  for (let at = 0, last = 0; at < 5000; at += CLOCK_STEP_MS) {
    clock.wall = at;
    const time = field.advance(CLOCK_STEP_MS / 1000, false);
    if (time > last) { moves.push(at); last = time; }
  }
  const counts = sim.contactCounts;
  assert.ok(moves.length >= 4, `the field steps on (${moves.length} moves)`);
  assert.equal(counts.read, moves.length, `each step that moves the field reads its contacts (${counts.read} read in ${moves.length} moves)`);
  assert.ok(counts.back >= moves.length - 1 && counts.back >= 3, `hidden, the contacts come back with no fence passing (${counts.read} read, ${counts.back} back)`);
  assert.equal(counts.waited, counts.back, 'each taken at its bound, the GPU waited for');
  assert.equal(taken.length, counts.back, 'once each: one getBufferSubData a read');
  // Within the bound: each read is taken once it has stood the bound the step's fence stood then, and by the next step that moves.
  const longest = fenceWait(Infinity);
  assert.equal(longest, 4 * GPU_WAIT_MS);
  // The read's bound doubles with the step's (1Z.1 item 4, the review's finding 3): readContacts is given fenceWait of the fences let go,
  // never a fixed GPU_WAIT_MS, so once the step's bound has doubled a read is not taken sooner than the step is let through.
  assert.ok(asked.some(({letGo}) => letGo >= 2), `the step's bound doubled while no fence passed (${asked.map(({letGo}) => letGo)})`);
  asked.forEach(({waitMs, letGo}, i) => assert.equal(waitMs, fenceWait(letGo), `read ${i + 1} stands the step's bound, ${fenceWait(letGo)} ms at ${letGo} let go (${waitMs})`));
  taken.forEach((at, i) => {
    const stood = at - issued[i].at, bound = issued[i].bound;
    assert.ok(stood >= bound && stood <= bound + CLOCK_STEP_MS, `read ${i + 1} is taken after ${stood} ms, once it has stood its step's ${bound} ms`);
  });
  const contacts = sim.takeContacts();
  assert.ok(contacts.length >= 3 && contacts.every(c => c.speed === .5 && c.x === Math.fround(.1)), `the contacts read back are the field's (${contacts.length})`);
  assert.equal(counts.unread, 0, 'no step that moves the field goes unread');
  // Shown, a drawn step is paced by the animation frame, and no fence holds it (ruling 1.3): a read is polled, and one the GPU never lets
  // back is taken once it has stood the cap, fenceWait's ceiling (1Z.1 item 2, DLW build ruling 2026-11-09: strikes dead while shown are a
  // loss), so a GPU that never signals stalls a shown frame once a second at most and the contacts go on coming back. While a read is out,
  // each drawn step goes unread. Hidden again, a step that moves takes it at its bound.
  // The GPU passes one step's fences (the bound goes back to GPU_WAIT_MS), then none again, and the field is shown: each read's own bound
  // is then shorter than the cap, which a drawn step stands all the same.
  passes = true; clock.wall = 5000; field.advance(CLOCK_STEP_MS / 1000, false); passes = false;
  assert.equal(field.stepFencesLetGo, 0, 'a fence that passed set the bound back');
  const shownFrom = {taken: taken.length, read: counts.read, unread: counts.unread};
  for (let at = 5016; at < 8000; at += 16) { clock.wall = at; field.advance(.016, true); }
  const shownTakes = taken.slice(shownFrom.taken).map((at, i) => at - issued[shownFrom.taken + i].at);
  assert.ok(shownTakes.length >= 2, `shown, the GPU never signalling, the contacts are read back within the cap (${shownTakes.length} taken in 3 s)`);
  shownTakes.forEach((stood, i) => assert.ok(stood >= longest && stood <= longest + 16, `shown, read ${i + 1} is taken once it has stood the cap, ${longest} ms (${stood} ms)`));
  assert.ok(counts.read >= shownFrom.read + shownTakes.length && counts.unread > shownFrom.unread,
    `and the next is issued; between, each drawn step goes unread (${counts.read - shownFrom.read} read, ${counts.unread - shownFrom.unread} unread)`);
  const shownTo = {taken: taken.length, read: counts.read};
  for (let at = 8000; at < 11000; at += CLOCK_STEP_MS) { clock.wall = at; field.advance(CLOCK_STEP_MS / 1000, false); }
  assert.ok(taken.length > shownTo.taken && counts.read > shownTo.read,
    `hidden again, the read is taken at its bound and the next is issued (${taken.length - shownTo.taken} taken, ${counts.read - shownTo.read} read)`);
  // A fence the GPU passes is taken at once, before its bound, and is not counted as waited.
  const passing = new FencedRead(), data = new Float32Array(4);
  const open = {...gl, clientWaitSync() { return this.ALREADY_SIGNALED; }};
  passing.issue(open, 1, 1, open.FLOAT, 16, 0);
  assert.equal(passing.take(open, data, 1), 'back');
  passing.issue(gl, 1, 1, gl.FLOAT, 16, 0, GPU_WAIT_MS);
  assert.equal(passing.take(gl, data, GPU_WAIT_MS - 1), 'pending', 'before its bound an unpassed read is not taken');
  assert.equal(passing.take(gl, data, GPU_WAIT_MS), 'waited', 'at its bound it is');
  assert.equal(passing.pending, false, 'and taken once');
  passing.issue(gl, 1, 1, gl.FLOAT, 16, 0);
  assert.equal(passing.take(gl, data, 1e9), 'pending', 'a read issued without a bound is only ever polled');
  assert.equal(passing.issue(gl, 1, 1, gl.FLOAT, 16, 0, GPU_WAIT_MS), false, 'and while it is out, the next issue is refused (1Z.1 item 1)');
  passing.dispose(gl);
  passing.issue(gl, 1, 1, gl.FLOAT, 16, 0, GPU_WAIT_MS);
  assert.equal(passing.take(gl, data, 1e9, Infinity), 'pending', 'one its taker only polls is too');
  assert.equal(passing.take(gl, data, longest - 1, longest), 'pending', 'a taker that asks a longer stand than its bound waits it out (a drawn step: the cap)');
  assert.equal(passing.take(gl, data, longest, longest), 'waited');
  // A GPU whose fences pass: shown and hidden, no read ever stands its bound, so none is taken at it (1Z.1 item 2: counted).
  const healthy = {...gl, fenceSync() { return {at: clock.wall}; }, clientWaitSync(fence) { return clock.wall - fence.at >= 100 ? this.ALREADY_SIGNALED : this.TIMEOUT_EXPIRED; }};
  const well = Object.create(GPGPUSimulator.prototype);
  Object.assign(well, {...sim, contactRead: new FencedRead(), contactQueue: [], renderer: {...sim.renderer, getContext: () => healthy},
    contactCounts: {read: 0, back: 0, waited: 0, lost: 0, unread: 0, delivered: 0, overflow: 0, ms: 0, takeMs: 0}});
  delete well.readContacts;
  const wellField = Object.create(PointCloudField.prototype);
  Object.assign(wellField, {...field, simTime: 0, heldDelta: 0, drawFirst: false, shownAgainAt: 0, owedShown: 0, stepFence: null, stepFencedAt: 0, stepFencesLetGo: 0, simulator: well,
    renderer: {getContext: () => healthy}, tickFrame: () => { well.pairwiseStepped = true; }});
  for (let at = 20000; at < 23000; at += 16) { clock.wall = at; wellField.advance(.016, true); }
  const shownWell = {...well.contactCounts};
  for (let at = 23000; at < 26000; at += CLOCK_STEP_MS) { clock.wall = at; wellField.advance(CLOCK_STEP_MS / 1000, false); }
  assert.ok(shownWell.back >= 10 && well.contactCounts.back - shownWell.back >= 10, `a GPU whose fences pass lets the reads back, shown and hidden (${shownWell.back}, ${well.contactCounts.back - shownWell.back})`);
  assert.equal(well.contactCounts.waited, 0, `and none is taken at a bound (${well.contactCounts.waited} of ${well.contactCounts.back})`);
});

// O-I #747 round 896 1Z.1 item 1 (the 1Z review's finding 5, DLW build ruling 2026-11-09): FencedRead is the engine's one readback path, and
// 1T item 24's field read is its second user. A read in flight is never written over and its fence never dropped, and the pixel buffer is
// the size of what is read. Over a WebGL context whose pixel buffers hold what is read into them, as GL sizes them: a read past a
// buffer's end, or a take of more than it holds, is an error and moves no bytes (INVALID_OPERATION, INVALID_VALUE).
const pixelBufferContext = () => ({PIXEL_PACK_BUFFER: 0x88eb, STREAM_READ: 0x88e1, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401, FLOAT: 0x1406,
  SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, ALREADY_SIGNALED: 0x911a, WAIT_FAILED: 0x911d,
  source: 0, passed: false, errors: [], fences: 0, deleted: 0, bound: null,
  createBuffer: () => ({bytes: new Uint8Array(0)}), deleteBuffer() {}, flush() {},
  bindBuffer(_target, buffer) { this.bound = buffer; },
  bufferData(_target, size) { this.bound.bytes = new Uint8Array(size); },
  // The framebuffer's pixels: every byte `source`.
  readPixels(_x, _y, width, height, _format, type, offset) {
    const size = width * height * 4 * (type === this.FLOAT ? 4 : 1);
    if (!this.bound || offset + size > this.bound.bytes.length) { this.errors.push('INVALID_OPERATION: readPixels past the buffer'); return; }
    this.bound.bytes.fill(this.source, offset, offset + size);
  },
  getBufferSubData(_target, offset, into) {
    const view = new Uint8Array(into.buffer, into.byteOffset, into.byteLength);
    if (offset + view.length > this.bound.bytes.length) { this.errors.push('INVALID_VALUE: getBufferSubData past the buffer'); return; }
    view.set(this.bound.bytes.subarray(offset, offset + view.length));
  },
  fenceSync() { return {fence: ++this.fences}; }, deleteSync() { this.deleted++; },
  clientWaitSync() { return this.passed ? this.ALREADY_SIGNALED : this.TIMEOUT_EXPIRED; }});

test('1Z.1 item 1: a second issue while a FencedRead\'s read is out never writes over it or drops its fence; it is refused', async () => {
  const {FencedRead} = await bundle(join(journeys, '../src/engine/GPGPUSimulator.ts'), 'sim-1z1');
  const gl = pixelBufferContext(), read = new FencedRead(), out = new Uint8Array(16);
  gl.source = 1;
  const first = read.issue(gl, 2, 2, gl.UNSIGNED_BYTE, 16, 0, 250);
  gl.source = 2;
  const second = read.issue(gl, 2, 2, gl.UNSIGNED_BYTE, 16, 1, 250);
  assert.equal(gl.deleted, 0, `the read out keeps its fence (${gl.deleted} deleted)`);
  assert.equal(read.take(gl, out, 2), 'pending', 'and is still out, with its own bound');
  gl.passed = true;
  assert.equal(read.take(gl, out, 3), 'back');
  assert.ok(out.every(byte => byte === 1), `the read comes back as it was read, never written over by the second issue (${out[0]})`);
  assert.deepEqual([first, second], [true, false], 'the issue while it was out was refused, and said so');
  assert.equal(read.issue(gl, 2, 2, gl.UNSIGNED_BYTE, 16, 4, 250), true, 'taken, the next issue is let through');
  assert.deepEqual(gl.errors, []);
});

test('1Z.1 item 1: a FencedRead\'s buffer follows the size of what is read: a resize reads into a buffer of the new size, never stale bytes', async () => {
  const {FencedRead} = await bundle(join(journeys, '../src/engine/GPGPUSimulator.ts'), 'sim-1z1');
  const gl = pixelBufferContext(), read = new FencedRead();
  gl.passed = true;
  gl.source = 1;
  read.issue(gl, 2, 2, gl.UNSIGNED_BYTE, 16, 0, 250);
  const small = new Uint8Array(16);
  assert.equal(read.take(gl, small, 1), 'back');
  // A resize between reads: the next read is of a larger rectangle, and reads into a buffer of its own size.
  gl.source = 3;
  read.issue(gl, 4, 4, gl.UNSIGNED_BYTE, 64, 2, 250);
  const larger = new Uint8Array(64);
  read.take(gl, larger, 3);
  assert.ok(larger.every(byte => byte === 3), `a larger read comes back whole (${larger.filter(byte => byte === 3).length} of 64 bytes read)`);
  assert.deepEqual(gl.errors, [], 'no read past the buffer');
  // A resize between issue and take: the read out is of the old size; taken into a view of the new size, it is let go and nothing is copied.
  gl.source = 4;
  read.issue(gl, 4, 4, gl.UNSIGNED_BYTE, 64, 4, 250);
  const resized = new Uint8Array(256).fill(9);
  const took = read.take(gl, resized, 5);
  assert.ok(resized.every(byte => byte === 9), 'no stale or partial bytes are taken as the new size\'s');
  assert.equal(took, 'resized', 'and the take says why');
  assert.equal(read.pending, false, 'the read is let go');
  gl.source = 5;
  assert.equal(read.issue(gl, 8, 8, gl.UNSIGNED_BYTE, 256, 6, 250), true);
  assert.equal(read.take(gl, resized, 7), 'back');
  assert.ok(resized.every(byte => byte === 5), 'the read at the new size comes back whole');
  // A smaller read after a larger one reads only its own bytes.
  gl.source = 6;
  read.issue(gl, 1, 1, gl.UNSIGNED_BYTE, 4, 8, 250);
  const one = new Uint8Array(4);
  assert.equal(read.take(gl, one, 9), 'back');
  assert.ok(one.every(byte => byte === 6));
  assert.deepEqual(gl.errors, [], 'no GL error');
});
