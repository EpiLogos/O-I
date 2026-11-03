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

test('the chord a clip strikes still reads as before: the pitch-class act stands beside the keys', async () => {
  const {readStageRequest} = await stage();
  assert.deepEqual(readStageRequest(request({command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35})).command,
    {command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35});
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
const openController = async ({polyphony = 16} = {}) => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class TorusOwner extends ControlledSceneOwner {
    acts = []; notes = []; next = 0;
    async request(request) {
      const command = request.request?.command;
      if (command?.operation !== 'torus-play' && command?.operation !== 'torus-release') return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      this.acts.push(structuredClone(command));
      if (this.refuse?.(command)) return {...reply, status: 'refused', error: 'controlled refusal: ' + command.operation};
      if (command.operation === 'torus-release') {
        this.notes = this.notes.filter(note => !command.keys.some(key => keyOf(key) === keyOf(note.key)));
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
        notes: admitted.map(note => ({id: note.id, key: note.key, place: {arc: note.arc}, point: {theta: 0.25 * (note.arc + 1), phi: 0.5 * (note.arc + 1), arc: note.arc}}))};
      return reply;
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new TorusOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  await c.compose({sky: 'none'});
  return {owner, c};
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
  assert.match(block, /command\.action==='strike'[\s\S]*nativeField\.controller\.torusPlay\(command\.keys,command\.amplitude,command\.at_samples_elapsed\)/);
  assert.match(block, /made_way/);
  assert.match(block, /command\.action==='release'[\s\S]*nativeField\.controller\.torusRelease\(command\.keys\)/);
});
