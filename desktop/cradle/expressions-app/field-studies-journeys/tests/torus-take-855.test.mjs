// O-I #855, the owner's half: a Live take keeps the Torus it began on, renders offline for Export Audio, and its moves land at their
// samples. Three things are read from outside the frame:
//   - the Torus kept as it rings and set again (`torus` checkpoint / restore; QL torus-checkpoint / torus-restore, ql.torus-checkpoint/v1:
//     the body's states, its form and forces, the M1′ session's steps, comma and notes, the event and its seeds);
//   - a take rendered offline through the M1′ session (`render-take`; QL torus-render, ql.torus-render/v1): a second owner of the same
//     scene set to the checkpoint, each act made at its sample, its PCM as f32, rendered a second at a time so the live sound runs on;
//   - an instrument edit at a sample (`instrument` with `at_samples_elapsed`): it waits for the owner's sound to reach that sample, and its
//     answer names the sample its act landed at, as a strike's does.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/torus-take-855.test.mjs
//
// The sources are TypeScript: each module is bundled once with the app's own esbuild (as performance-journal-855.test.mjs does). The owner
// is the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs, taught the Torus's acts here.
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
const out = mkdtempSync(join(tmpdir(), 'torus-take-855-'));
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

const checkpoint = (at = '48000', extra = {}) => ({schema: 'ql.torus-checkpoint/v1', taken_at_samples: at, sample_rate: 48000,
  event: {m1: {lens12: 11}}, seeds: {tick12: 7}, shape_ref: 'shape:one', damping_per_second: 0.35, voices: ['scene:logic/0'],
  amplitudes: [[0.25, -0.5]], session: {steps: 12.5, notes: []}, law: 'kept', ...extra});
const keys = [{row: 2, column: 3}];

// ---------------------------------------------------------------------------------------------------- the stage vocabulary
test('the Torus is kept and set again by name: a checkpoint names nothing, a restore carries the owner\'s checkpoint whole', async () => {
  const {readStageRequest, STAGE_TORUS_CHECKPOINT_BYTES_MAX} = await stage();
  assert.deepEqual(readStageRequest(request({command: 'torus', action: 'checkpoint'})), {req: 7, command: {command: 'torus', action: 'checkpoint'}});
  assert.equal(readStageRequest(request({command: 'torus', action: 'checkpoint', checkpoint: checkpoint()})), null, 'no operand');
  const kept = checkpoint();
  assert.deepEqual(readStageRequest(request({command: 'torus', action: 'restore', checkpoint: kept})).command, {command: 'torus', action: 'restore', checkpoint: kept});
  for (const bad of [undefined, null, [], {...kept, schema: 'ql.m1-prime-session/v1'}, {...kept, taken_at_samples: 48000}, {...kept, taken_at_samples: '048000'},
    {...kept, sample_rate: 4000}, {...kept, sample_rate: 48000.5}, {...kept, seeds: 'x'.repeat(STAGE_TORUS_CHECKPOINT_BYTES_MAX)}])
    assert.equal(readStageRequest(request({command: 'torus', action: 'restore', checkpoint: bad})), null, JSON.stringify(bad)?.slice(0, 60));
  assert.equal(readStageRequest(request({command: 'torus', action: 'hold'})), null);
  assert.equal(readStageRequest(request({command: 'torus', action: 'restore', checkpoint: kept, at: '0'})), null, 'no other operand');
});

test('a take to render: the owner\'s checkpoint, its acts at their samples in order within the take, and how many frames', async () => {
  const {readStageRequest, STAGE_RENDER_FRAMES_MAX, STAGE_RENDER_ACTS_MAX} = await stage();
  const acts = [{action: 'strike', at_samples_elapsed: '48100', keys, amplitude: 0.35},
    {action: 'release', at_samples_elapsed: '96000', keys},
    {action: 'set', at_samples_elapsed: '96000', edit: {polyphony: 2}}];
  const take = {command: 'render-take', checkpoint: checkpoint(), acts, frames: 96000};
  assert.deepEqual(readStageRequest(request(take)).command, take);
  assert.deepEqual(readStageRequest(request({...take, acts: []})).command, {...take, acts: []}, 'a take may hold no acts: the body rings on');
  const refused = [
    ['no frames', {frames: 0}], ['too many frames', {frames: STAGE_RENDER_FRAMES_MAX + 1}], ['fractional frames', {frames: 4800.5}],
    ['an act before the take', {acts: [{...acts[0], at_samples_elapsed: '47999'}]}],
    ['an act at its end', {acts: [{...acts[0], at_samples_elapsed: '144000'}]}],
    ['acts out of order', {acts: [acts[1], acts[0]]}],
    ['a cursor as a number', {acts: [{...acts[0], at_samples_elapsed: 48100}]}],
    ['a strike too strong', {acts: [{...acts[0], amplitude: 1.5}]}], ['a strike of nothing', {acts: [{...acts[0], amplitude: 0}]}],
    ['a key off the surface', {acts: [{...acts[0], keys: [{row: 6, column: 0}]}]}], ['repeated keys', {acts: [{...acts[0], keys: [keys[0], keys[0]]}]}],
    ['an unknown setting', {acts: [{...acts[2], edit: {drive: 1}}]}], ['an unknown act', {acts: [{action: 'hold', at_samples_elapsed: '48100', keys}]}],
    ['an operand of another act', {acts: [{...acts[1], amplitude: 0.35}]}],
    ['too many acts', {acts: Array(STAGE_RENDER_ACTS_MAX + 1).fill(acts[1])}],
    ['no checkpoint', {checkpoint: undefined}], ['another operand', {from: '0'}],
  ];
  for (const [why, change] of refused) assert.equal(readStageRequest(request({...take, ...change})), null, why);
});

test('an instrument edit that acts on the owner may name the sample it lands at; one the frame makes on its own sound may not', async () => {
  const {readStageRequest, STAGE_INSTRUMENT_TIMED_KINDS} = await stage();
  assert.deepEqual([...STAGE_INSTRUMENT_TIMED_KINDS], ['lens', 'context-frame', 'harmonic', 'transcription', 'damping', 'torus']);
  const torus = {command: 'instrument', edit: {kind: 'torus', edit: {polyphony: 4}}, at_samples_elapsed: '52800'};
  assert.deepEqual(readStageRequest(request(torus)).command, torus);
  assert.deepEqual(readStageRequest(request({command: 'instrument', edit: {kind: 'lens', lens12: 3}, at_samples_elapsed: '0'})).command,
    {command: 'instrument', edit: {kind: 'lens', lens12: 3}, at_samples_elapsed: '0'});
  assert.deepEqual(readStageRequest(request({command: 'instrument', edit: {kind: 'level', value: 0.5}})).command, {command: 'instrument', edit: {kind: 'level', value: 0.5}});
  assert.equal(readStageRequest(request({command: 'instrument', edit: {kind: 'level', value: 0.5}, at_samples_elapsed: '52800'})), null,
    'a level is the frame\'s own sound: it lands at the device\'s time, not at a sample of the owner');
  for (const at of [52800, '052800', '', '-1']) assert.equal(readStageRequest(request({...torus, at_samples_elapsed: at})), null, JSON.stringify(at));
});

test('the answers carry the checkpoint, the render and the sample an edit landed at, read exactly both ways across the channel', async () => {
  const {readStageResult, stageReplyMessage} = await stage();
  const kept = checkpoint();
  assert.deepEqual(readStageResult(stageReplyMessage(7, {ok: true, checkpoint: kept}, {command: 'torus', action: 'checkpoint'})), {req: 7, ok: true, checkpoint: kept});
  assert.equal(readStageResult({v: 1, kind: 'host-command-result', command: 'torus', req: 7, ok: true, checkpoint: {...kept, schema: 'x'}}), null);
  const render = {from_samples_elapsed: '48000', frames: 4, sample_rate: 48000, pcm: new Float32Array([0, 0.25, -0.25, 0.5]),
    made_way: [[], [{row: 0, column: 2}]], ended: checkpoint('48004')};
  const message = stageReplyMessage(8, {ok: true, render}, {command: 'render-take', checkpoint: kept, acts: [], frames: 4});
  const read = readStageResult(structuredClone(message));
  assert.ok(read.render.pcm instanceof Float32Array, 'the PCM crosses as f32');
  assert.deepEqual([...read.render.pcm], [0, 0.25, -0.25, 0.5]);
  assert.deepEqual({...read.render, pcm: null}, {...render, pcm: null});
  for (const [why, bad] of [['PCM of another length', {pcm: new Float32Array(3)}], ['PCM as numbers', {pcm: [0, 0, 0, 0]}],
    ['PCM as f64', {pcm: new Float64Array(4)}], ['a made-way key off the surface', {made_way: [[{row: 9, column: 0}]]}],
    ['an end that is no checkpoint', {ended: {schema: 'x'}}], ['a start that is no cursor', {from_samples_elapsed: 48000}],
    ['no rate', {sample_rate: undefined}], ['another part', {extra: true}]])
    assert.equal(readStageResult({...message, render: {...render, ...bad}}), null, why);
  assert.deepEqual(readStageResult(stageReplyMessage(9, {ok: true, landed_at_samples_elapsed: '52992'}, {command: 'instrument', edit: {kind: 'torus', edit: {polyphony: 4}}})),
    {req: 9, ok: true, landed_at_samples_elapsed: '52992'});
});

// ---------------------------------------------------------------------------------------------------- the controller
const openController = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class TorusOwner extends ControlledSceneOwner {
    renders = 0; renderCalls = []; torusCalls = [];
    async request(request) {
      const command = request.request?.command;
      const own = ['torus-checkpoint', 'torus-restore', 'torus-render'];
      if (!own.includes(command?.operation)) return super.request(request);
      this.torusCalls.push(structuredClone(command));
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-checkpoint') return {...reply, torus: this.torus(), torus_checkpoint: checkpoint(this.frame.samples_elapsed)};
      if (command.operation === 'torus-restore') {
        this.bump(2n);
        return {...reply, field: {...structuredClone(this.frame), audio: []}, torus: this.torus(), influence: this.influence()};
      }
      // A controlled render: each part's PCM is its own number, so the frame's assembly is seen; the notes that made way are the owner's.
      this.renderCalls.push(structuredClone(command));
      const part = ++this.renders, from = command.checkpoint?.taken_at_samples ?? this.endsAt;
      this.endsAt = (BigInt(from) + BigInt(command.frames)).toString();
      return {...reply, torus: this.torus(), torus_render: {schema: 'ql.torus-render/v1', from_samples: from, frames: command.frames, sample_rate: 48000,
        audio: Array(command.frames).fill(part / 8),
        made_way: command.acts.filter(act => act.action === 'strike').map(() => part === 3 ? [{id: 0, key: {row: 0, column: 2}, arc: 0, struck_at_samples: 0}] : []),
        checkpoint: checkpoint(this.endsAt), continues: `render:${part}`, law: 'controlled'}};
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new TorusOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  await c.compose({sky: 'none'});
  return {owner, audio, c};
};
const sent = (owner, operation) => owner.torusCalls.filter(command => command.operation === operation);

test('the controller keeps the Torus as the owner gives it and sets it again through the one owner, reading back what it answered', async () => {
  const {owner, c} = await openController();
  try {
    const generation = c.reading.native.acknowledged.generation;
    const kept = await c.torusCheckpoint();
    assert.equal(kept.schema, 'ql.torus-checkpoint/v1');
    assert.equal(kept.taken_at_samples, c.audioClock().samples_elapsed, 'kept at the owner\'s cursor');
    assert.equal(c.reading.native.acknowledged.generation, generation, 'keeping is a read');
    assert.deepEqual(sent(owner, 'torus-checkpoint'), [{operation: 'torus-checkpoint'}]);
    const landed = await c.torusRestore(kept);
    assert.deepEqual(sent(owner, 'torus-restore'), [{operation: 'torus-restore', checkpoint: kept}], 'the checkpoint travels whole');
    assert.equal(BigInt(c.reading.native.acknowledged.generation), BigInt(generation) + 2n);
    assert.equal(landed, c.reading.native.acknowledged.samples_elapsed, 'the restore names the sample it rang again from');
    await assert.rejects(c.torusRestore({schema: 'ql.m1-prime-session/v1'}), /ql\.torus-checkpoint\/v1/);
    assert.equal(sent(owner, 'torus-restore').length, 1, 'refused before the owner');
  } finally { await c.dispose(); }
});

test('a take renders a second at a time: the first part from the checkpoint, each next continuing the last, the PCM assembled whole', async () => {
  const {owner, c} = await openController();
  try {
    const kept = checkpoint('48000');
    const acts = [{action: 'strike', at_samples_elapsed: '48100', keys, amplitude: 0.35},
      {action: 'release', at_samples_elapsed: '96000', keys},
      {action: 'set', at_samples_elapsed: '98000', edit: {polyphony: 2}},
      {action: 'strike', at_samples_elapsed: '148000', keys: [{row: 4, column: 5}], amplitude: 0.5}];
    const generation = c.reading.native.acknowledged.generation;
    const render = await c.renderTake(kept, acts, 120000);
    assert.deepEqual(owner.renderCalls, [
      {operation: 'torus-render', checkpoint: kept, acts: [{action: 'strike', at_samples_elapsed: '48100', keys, amplitude: [0.35, 0]}], frames: 48000},
      {operation: 'torus-render', continues: 'render:1', acts: [acts[1], acts[2]], frames: 48000},
      {operation: 'torus-render', continues: 'render:2', acts: [{...acts[3], amplitude: [0.5, 0]}], frames: 24000}],
    'a second per part at the owner\'s rate; each act in the part its sample falls in; a key\'s strength is the owner\'s pair of metres');
    assert.ok(render.pcm instanceof Float32Array);
    assert.equal(render.pcm.length, 120000);
    assert.deepEqual([render.pcm[0], render.pcm[47999], render.pcm[48000], render.pcm[95999], render.pcm[96000], render.pcm[119999]],
      [0.125, 0.125, 0.25, 0.25, 0.375, 0.375], 'each part where its samples lie');
    assert.equal(render.from_samples_elapsed, '48000');
    assert.equal(render.frames, 120000);
    assert.equal(render.sample_rate, 48000);
    assert.deepEqual(render.made_way, [[], [{row: 0, column: 2}]], 'strike by strike, the keys whose notes made way');
    assert.deepEqual(render.ended, checkpoint('168000'), 'where the take ended, kept');
    assert.equal(c.reading.native.acknowledged.generation, generation, 'the live owner does not move');
    await assert.rejects(c.renderTake(kept, [acts[1], acts[0]], 120000), /order of their samples/);
    await assert.rejects(c.renderTake(kept, [], 0), /frames/);
    await assert.rejects(c.renderTake({schema: 'x'}, [], 4800), /ql\.torus-checkpoint\/v1/);
    await assert.rejects(c.renderTake(checkpoint('0', {sample_rate: 44100}), [], 4800), /44100/);
    assert.equal(owner.renderCalls.length, 3, 'refused before the owner');
  } finally { await c.dispose(); }
});

test('an edit at a sample waits for the owner\'s sound to reach it; its answer names where it landed; one behind or far ahead is refused', async () => {
  const {audio, c} = await openController();
  try {
    const cursor = c.audioClock().samples_elapsed;
    await c.untilSample(cursor);
    const landed = await c.torusSet({polyphony: 4});
    assert.equal(landed, c.audioClock().samples_elapsed, 'a Torus edit lands at the cursor the owner took it at');
    const lens = await c.edit({kind: 'lens', lens12: 3});
    assert.equal(lens, c.audioClock().samples_elapsed, 'so does a determinant');
    await assert.rejects(c.untilSample((BigInt(cursor) + 48000n * 31n).toString()), /more than 30 s ahead/);
    await assert.rejects(c.untilSample(48000), /exact sample cursor/);
    const ahead = (BigInt(c.audioClock().samples_elapsed) + 1n).toString();
    const waiting = c.untilSample(ahead);
    let done = false; void waiting.then(() => { done = true; });
    for (let i = 0; i < 400 && !done; i++) { audio.currentTime += 0.05; await new Promise(r => setTimeout(r, 5)); }
    await waiting;
    assert.ok(BigInt(c.audioClock().samples_elapsed) >= BigInt(ahead), 'the owner\'s sound reached the sample');
    await assert.rejects(c.untilSample('0'), /already rendered/, 'a sample the owner has rendered is behind it');
  } finally { await c.dispose(); }
});

// ---------------------------------------------------------------------------------------------------- the frame runs them
test('the frame keeps and sets the Torus, renders a take and makes an edit at its sample through its native field', async () => {
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  const torus = app.slice(app.indexOf("case 'torus':"), app.indexOf("case 'render-take':"));
  assert.match(torus, /if\(command\.action==='checkpoint'\)return \{ok:true,checkpoint:await nativeField\.controller\.torusCheckpoint\(\)\};/);
  assert.match(torus, /await nativeField\.controller\.torusRestore\(command\.checkpoint\);announceHostState\(\);return \{ok:true,landed_at_samples_elapsed\}/);
  const render = app.slice(app.indexOf("case 'render-take':"), app.indexOf("case 'instrument':"));
  assert.match(render, /return \{ok:true,render:await nativeField\.controller\.renderTake\(command\.checkpoint,command\.acts,command\.frames\)\};/);
  const edit = app.slice(app.indexOf("case 'instrument':"), app.indexOf("case 'procedural-stage':"));
  assert.match(edit, /await nativeField\.command\(command\.edit,command\.at_samples_elapsed\)/);
  assert.match(edit, /landed_at_samples_elapsed/);
  const field = await readFile(join(journeys, 'src/nativeField.ts'), 'utf8');
  const command = field.slice(field.indexOf('const command=async(edit:InstrumentEdit'), field.indexOf('const liveEntry='));
  assert.match(command, /if\(at!==undefined\)await controller\.untilSample\(at\);/, 'an edit at a sample waits for it');
  assert.match(command, /const landed=await controller\.torusSet\(edit\.edit\);update\(\);return \{landed_at_samples_elapsed:landed\};/);
  assert.match(command, /This edit is made on the frame\\'s own sound/, 'an edit of the frame\'s own sound at a sample is refused in words');
});
