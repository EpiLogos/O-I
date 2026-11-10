// O-I #855, the owner's half: a Live take keeps the sample each played act landed at. Two things make that readable from outside the
// frame: the strike answers name the sample their act landed at (`landed_at_samples_elapsed`), and a stage command reads the owner's
// own performance journal (QL instrument-session.mjs journal(), `ql.instrument-performance-journal/v1`) from a sample on.
// A played act lands where the owner's render lands it: at `at_samples_elapsed` when the act names one, else at the owner's cursor
// (QL-MEF continuous.rs strike_when; cpp/src/field_worker.cpp strike). The journal keeps each act with the cursor it was acknowledged at.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/performance-journal-855.test.mjs
//
// The sources are TypeScript: each module is bundled once with the app's own esbuild (as janko-keys-853.test.mjs does). The owner is
// the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs, taught the Torus's acts as janko-keys-853 teaches them.
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
const out = mkdtempSync(join(tmpdir(), 'performance-journal-855-'));
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
const request = command => ({v: 1, kind: 'host-command', req: 7, ...command});

// A journal as the owner's session gives it: one act now and one at a later sample, and the advances aggregated.
const act = (request_id, samples, extra = {}) => ({request_id, operation: 'torus-play',
  command: {operation: 'torus-play', keys: [{row: 0, column: 42}], amplitude: [0.35, 0], ...extra},
  acknowledged: {generation: String(10 + Number(request_id)), samples_elapsed: samples}, kind: 'act'});
const journal = {schema: 'ql.instrument-performance-journal/v1', instance_ref: 'ql:instance:live',
  acts: [act('3', '48000'), act('4', '48000', {at_samples_elapsed: '52800'})],
  advances: {blocks: 12, frames: 6144, first_samples_elapsed: '43008', last_samples_elapsed: '48000'}};

// ---------------------------------------------------------------------------------------------------- the stage vocabulary
test('the journal is read whole or from a sample on: an exact cursor or none, and nothing else', async () => {
  const {readStageRequest} = await stage();
  assert.deepEqual(readStageRequest(request({command: 'performance-journal'})), {req: 7, command: {command: 'performance-journal'}});
  assert.deepEqual(readStageRequest(request({command: 'performance-journal', from_samples_elapsed: '48000'})).command,
    {command: 'performance-journal', from_samples_elapsed: '48000'});
  for (const from of [48000, '048000', '-1', '18446744073709551616', ''])
    assert.equal(readStageRequest(request({command: 'performance-journal', from_samples_elapsed: from})), null, JSON.stringify(from));
  assert.equal(readStageRequest(request({command: 'performance-journal', acts: []})), null, 'no other operand');
});

test('the journal\'s answer carries the owner\'s journal exactly, both ways across the channel, or nothing is read', async () => {
  const {readStageResult, stageReplyMessage, STAGE_JOURNAL_ACTS_MAX} = await stage();
  const reply = stageReplyMessage(7, {ok: true, journal}, {command: 'performance-journal'});
  assert.deepEqual(reply, {v: 1, kind: 'host-command-result', command: 'performance-journal', req: 7, ok: true, journal});
  assert.deepEqual(readStageResult(reply), {req: 7, ok: true, journal});
  const bad = [
    {...journal, schema: 'ql.instrument-reading/v1'},
    {...journal, instance_ref: ''},
    {...journal, acts: [{...act('3', '48000'), kind: 'replay'}]},
    {...journal, acts: [{...act('3', '48000'), acknowledged: {generation: '11', samples_elapsed: 48000}}]},
    {...journal, acts: [{...act('3', '48000'), command: 'torus-play'}]},
    {...journal, acts: [{...act('3', '48000'), request_id: 3}]},
    {...journal, acts: [{...act('3', '48000'), extra: true}]},
    {...journal, advances: {...journal.advances, blocks: -1}},
    {...journal, advances: {...journal.advances, first_samples_elapsed: 43008}},
    {...journal, acts: Array.from({length: STAGE_JOURNAL_ACTS_MAX + 1}, (_, i) => act(String(i + 1), '48000'))},
  ];
  for (const value of bad) assert.equal(readStageResult({...reply, journal: value}), null, JSON.stringify(value).slice(0, 120));
  const empty = {...journal, acts: [], advances: {blocks: 0, frames: 0, first_samples_elapsed: null, last_samples_elapsed: null}};
  assert.deepEqual(readStageResult({...reply, journal: empty}).journal, empty, 'a lifetime with no act yet is a journal');
});

test('a played act lands where its command names, else at the cursor it was acknowledged at', async () => {
  const {stageJournalLanding} = await stage();
  assert.equal(stageJournalLanding(journal.acts[0]), '48000', 'struck now: the owner\'s cursor');
  assert.equal(stageJournalLanding(journal.acts[1]), '52800', 'struck ahead: the sample it named');
});

test('a strike\'s answer names the sample its act landed at, with the keys that made way, read exactly', async () => {
  const {readStageResult, stageReplyMessage} = await stage();
  const keys = {command: 'janko', action: 'strike', keys: [{row: 1, column: 43}], amplitude: 0.35};
  const made_way = [{row: 0, column: 42}];
  const reply = stageReplyMessage(7, {ok: true, made_way, landed_at_samples_elapsed: '52800'}, keys);
  assert.deepEqual(reply, {v: 1, kind: 'host-command-result', command: 'janko', req: 7, ok: true, made_way, landed_at_samples_elapsed: '52800'});
  assert.deepEqual(readStageResult(reply), {req: 7, ok: true, made_way, landed_at_samples_elapsed: '52800'});
  const points = {command: 'strike-at', points: [{theta: 0.5, phi: 1}], amplitude: 0.35};
  assert.deepEqual(readStageResult(stageReplyMessage(8, {ok: true, landed_at_samples_elapsed: '0'}, points)), {req: 8, ok: true, landed_at_samples_elapsed: '0'});
  for (const landed of [52800, '052800', 'now']) assert.equal(readStageResult({...reply, landed_at_samples_elapsed: landed}), null, JSON.stringify(landed));
});

// ---------------------------------------------------------------------------------------------------- the controller
const openController = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class TorusOwner extends ControlledSceneOwner {
    async request(request) {
      const command = request.request?.command;
      if (command?.operation !== 'torus-play' && command?.operation !== 'torus-release') return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-release') return reply;
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      reply.torus_play = {schema: 'ql.torus-play/v1', made_way: [], polyphony: 16,
        notes: command.keys.map((key, id) => ({id, key, place: {arc: 0}, point: {theta: 0.25, phi: 0.5, arc: 0}}))};
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

test('the controller\'s strikes answer the sample they landed at: the owner\'s cursor when struck now, the named sample when struck ahead', async () => {
  const {c} = await openController();
  try {
    const cursor = c.audioClock().samples_elapsed;
    const ahead = (BigInt(cursor) + 4800n).toString();
    assert.deepEqual(await c.torusPlayed([{row: 0, column: 42}], 0.35), {made_way: [], landed_at_samples_elapsed: cursor});
    assert.deepEqual(await c.torusPlayed([{row: 1, column: 43}], 0.35, ahead), {made_way: [], landed_at_samples_elapsed: ahead});
    assert.deepEqual(await c.torusPlay([{row: 2, column: 44}], 0.35), [], 'the keys-only answer stands as it was');
    assert.deepEqual(await c.playAt([{theta: 0.5, phi: 1}], 0.35, ahead), {landed_at_samples_elapsed: ahead});
    assert.deepEqual(await c.playAt([{theta: 0.5, phi: 1}], 0.35), {landed_at_samples_elapsed: c.audioClock().samples_elapsed});
  } finally { await c.dispose(); }
});

test('the journal is the owner\'s own, read from a sample on: the acts landing at or after it, the advances as they stand', async () => {
  const {c} = await openController();
  try {
    const cursor = c.audioClock().samples_elapsed;
    const ahead = (BigInt(cursor) + 9600n).toString();
    await c.torusPlay([{row: 0, column: 42}], 0.35);
    await c.torusPlay([{row: 1, column: 43}], 0.35, ahead);
    await c.torusRelease([{row: 0, column: 42}]);
    const whole = c.performanceJournal();
    assert.equal(whole.schema, 'ql.instrument-performance-journal/v1');
    const played = whole.acts.filter(a => a.operation.startsWith('torus-'));
    assert.deepEqual(played.map(a => a.operation), ['torus-play', 'torus-play', 'torus-release']);
    assert.deepEqual(played.map(a => a.command.at_samples_elapsed ?? null), [null, ahead, null], 'each act as the owner journaled it');
    const later = c.performanceJournal((BigInt(cursor) + 1n).toString());
    assert.deepEqual(later.acts.map(a => [a.operation, a.command.at_samples_elapsed]), [['torus-play', ahead]],
      'only the act that lands at or after the sample');
    assert.deepEqual(later.advances, whole.advances, 'the advances are aggregate: they are not cut');
    assert.throws(() => c.performanceJournal(48000), /exact sample cursor/);
  } finally { await c.dispose(); }
});

test('with no scene owner there is no journal, and the refusal says why', async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const {NativeFieldController} = await controller();
  const c = new NativeFieldController(new ControlledSceneOwner(), {}, () => new ControlledAudio());
  assert.throws(() => c.performanceJournal(), /Open the live instrument first: the performance journal belongs to a scene owner/);
});

// ---------------------------------------------------------------------------------------------------- the frame runs them
test('the frame reads the journal through its native field, and its strikes answer where they landed', async () => {
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  const janko = app.slice(app.indexOf("case 'janko':"), app.indexOf("case 'strike-at':"));
  assert.match(janko, /nativeField\.controller\.torusPlayed\(command\.keys,command\.amplitude,command\.at_samples_elapsed\)/);
  assert.match(janko, /landed_at_samples_elapsed/);
  const points = app.slice(app.indexOf("case 'strike-at':"), app.indexOf("case 'audio-clock':"));
  // REPLACED (round 54 item 0): a strike that waited to reach the owner also answers how long it waited (late_ms; round 54a L1).
  assert.match(points, /const \{landed_at_samples_elapsed,late_ms\}=await nativeField\.controller\.playAt\(command\.points,command\.amplitude,command\.at_samples_elapsed\);announceHostState\(\);return \{ok:true,landed_at_samples_elapsed,\.\.\.\(late_ms!==undefined\?\{late_ms\}:\{\}\)\};/);
  const read = app.slice(app.indexOf("case 'performance-journal':"), app.indexOf("case 'instrument':"));
  assert.match(read, /return \{ok:true,journal:nativeField\.controller\.performanceJournal\(command\.from_samples_elapsed\)\};/);
});
