// O-I #855, the owner's half: a Live take keeps the Torus it began on, renders offline for Export Audio, and its moves land at their
// samples. Three things are read from outside the frame:
//   - the Torus kept as it rings and set again (`torus` checkpoint / restore; QL torus-checkpoint / torus-restore, ql.torus-checkpoint/v1:
//     the body's states, its form and forces, the M1′ session's steps, comma and notes, the event and its seeds);
//   - a take rendered offline through the M1′ session (`render-take`; QL torus-render, ql.torus-render/v1): a second owner of the same
//     scene set to the checkpoint, each act made at its sample, its PCM as f32, rendered a second at a time so the live sound runs on;
//   - an instrument edit at a sample (`instrument` with `at_samples_elapsed`): a Torus setting is sent at once and the owner makes it at
//     that sample inside the block that reaches it, as it lands a strike (QL torus-set at_samples_elapsed); a determinant or a damping edit,
//     which the owner makes only at its cursor, waits for the owner's sound to reach that sample. Each answer names the sample its act
//     landed at, as a strike's does.
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
/** A sound as the kernel seals one (kernel expression_performance/kept.rs TorusSound, `oi.torus-sound/v1`). */
const sound = (extra = {}) => ({schema: 'oi.torus-sound/v1', sound_ref: 'sha256:sound', name: 'Low bell', sample_rate: 48000, checkpoint: checkpoint(),
  checkpoint_sha256: 'sha256:kept', body: {kind: 'torus'}, sources: [], law: 'kept', seal: 'hmac-sha256:seal', ...extra});

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

test('a take holds a touch and a singlet as the owner was sent them: points on the sheet at one strength, a codon of the 64 at its strength', async () => {
  // O-I #855, kept whole: a touch of the surface (`strike-at`) and a singlet (`torus-singlet`, O-I #771) are acts of a take, as a key is.
  const {readStageRequest} = await stage();
  const acts = [{action: 'strike-at', at_samples_elapsed: '48100', points: [{theta: 0.75, phi: 2.5}, {theta: 4, phi: 5.5}], amplitude: 0.3},
    {action: 'singlet', at_samples_elapsed: '52800', codon: 8, amplitude: 0.35}];
  const take = {command: 'render-take', checkpoint: checkpoint(), acts, frames: 96000};
  assert.deepEqual(readStageRequest(request(take)).command, take);
  const refused = [
    ['a touch of nothing', {acts: [{...acts[0], points: []}]}], ['a touch of 65 points', {acts: [{...acts[0], points: Array(65).fill({theta: 1, phi: 1})}]}],
    ['a touch off the sheet', {acts: [{...acts[0], points: [{theta: 2 * Math.PI, phi: 1}]}]}],
    ['a point with its own impulse', {acts: [{...acts[0], points: [{theta: 1, phi: 1, amplitude: [0.3, 0]}]}]}],
    ['a touch too strong', {acts: [{...acts[0], amplitude: 1.5}]}], ['a touch of no strength', {acts: [{...acts[0], amplitude: 0}]}],
    ['a touch of keys', {acts: [{...acts[0], keys}]}],
    ['a codon past the 64', {acts: [{...acts[1], codon: 64}]}], ['a codon that is no integer', {acts: [{...acts[1], codon: 2.5}]}],
    ['a codon as words', {acts: [{...acts[1], codon: '8'}]}], ['a singlet of no strength', {acts: [{...acts[1], amplitude: 0}]}],
    ['a singlet naming its places', {acts: [{...acts[1], arc: 9}]}],
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
    renders = 0; renderCalls = []; torusCalls = []; waiting = []; soundCalls = []; moved = []; unlabelled = false; given = new Map();
    async request(request) {
      // The kernel's own acts beside the owner (O-I #852, native_expression.rs torus_sound / torus_sound_open): a sound sealed from a
      // checkpoint the kernel relayed under that name, and opened against one, its restore the sound as saved.
      if (request.operation === 'torus_sound' || request.operation === 'torus_sound_open') {
        this.soundCalls.push(structuredClone(request));
        if (request.lease !== 'controlled:scene-lease') throw new Error('native-expression.foreign_lease');
        if (request.operation === 'torus_sound_open') {
          if (!this.given.has(request.now_sha256)) throw new Error(`No Torus checkpoint ${request.now_sha256} was given under this lease`);
          return {schema: 'oi.torus-sound-opening/v1', sound_ref: request.sound.sound_ref, restore: {operation: 'torus-restore', checkpoint: request.sound.checkpoint}, moved: this.moved};
        }
        const kept = this.given.get(request.checkpoint_sha256);
        if (!kept) throw new Error(`No Torus checkpoint ${request.checkpoint_sha256} was given under this lease`);
        return sound({name: request.name, checkpoint: kept, checkpoint_sha256: request.checkpoint_sha256});
      }
      const command = request.request?.command;
      // A Torus setting for a later sample waits for it and moves nothing (QL scene_field.rs torus_set_when); the block that reaches its
      // sample makes it there and names it in torus_set_landed, a Fundamental made there being that block's one generation.
      if (command?.operation === 'torus-set' && command.at_samples_elapsed !== undefined &&
        BigInt(command.at_samples_elapsed) > BigInt(this.frame.samples_elapsed)) {
        this.torusCalls.push(structuredClone(command));
        this.waiting.push(structuredClone(command));
        const read = structuredClone(request);
        read.request.command = {operation: 'read'};
        const reply = await super.request(read);
        return {...reply, torus: {...this.torus(), waiting: this.waiting.map(({at_samples_elapsed, edit}) => ({at_samples_elapsed, edit}))},
          influence: this.influence()};
      }
      if (command?.operation === 'advance' && this.waiting.length) {
        const reply = await super.request(request);
        const due = this.waiting.filter(set => BigInt(set.at_samples_elapsed) <= BigInt(this.frame.samples_elapsed));
        if (!due.length) return reply;
        this.waiting = this.waiting.filter(set => !due.includes(set));
        for (const set of due) {
          this.torusSettings = {...this.torusSettings, ...structuredClone(set.edit)};
          if (set.edit.fundamental) this.bump(1n);
        }
        return {...reply, field: {...structuredClone(this.frame), audio: reply.field.audio},
          torus_set_landed: due.map(({at_samples_elapsed, edit}) => ({at_samples_elapsed, edit, applied: true, moved: Object.keys(edit)})),
          torus: {...this.torus(), waiting: []}, influence: this.influence()};
      }
      const own = ['torus-checkpoint', 'torus-restore', 'torus-render'];
      if (!own.includes(command?.operation)) return super.request(request);
      this.torusCalls.push(structuredClone(command));
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-checkpoint') {
        // The kernel relays each checkpoint it kept named by its digest (native_expression.rs `labelled`).
        const kept = checkpoint(this.frame.samples_elapsed), sha256 = `sha256:checkpoint/${kept.taken_at_samples}/${this.given.size}`;
        this.given.set(sha256, kept);
        return {...reply, torus: this.torus(), torus_checkpoint: kept, ...(this.unlabelled ? {} : {torus_checkpoint_sha256: sha256})};
      }
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

test('a take renders its touches and singlets as the owner\'s own acts: the acts it was sent, each strength the owner\'s pair of metres', async () => {
  const {owner, c} = await openController();
  try {
    const kept = checkpoint('48000');
    const acts = [{action: 'strike-at', at_samples_elapsed: '48100', points: [{theta: 0.75, phi: 2.5}, {theta: 4, phi: 5.5}], amplitude: 0.3},
      {action: 'singlet', at_samples_elapsed: '52800', codon: 8, amplitude: 0.35},
      {action: 'strike', at_samples_elapsed: '96100', keys, amplitude: 0.5}];
    await c.renderTake(kept, acts, 96000);
    assert.deepEqual(owner.renderCalls, [
      {operation: 'torus-render', checkpoint: kept, acts: [
        {action: 'strike-at', at_samples_elapsed: '48100', points: [{theta: 0.75, phi: 2.5, amplitude: [0.3, 0]}, {theta: 4, phi: 5.5, amplitude: [0.3, 0]}]},
        {action: 'singlet', at_samples_elapsed: '52800', codon: 8, amplitude: [0.35, 0]}], frames: 48000},
      {operation: 'torus-render', continues: 'render:1', acts: [{...acts[2], amplitude: [0.5, 0]}], frames: 48000}],
    'as the owner took them live (controller.ts playAt, torusSinglet), so the kernel finds the acts it relayed in the render');
    const sent = owner.renderCalls.length;
    await assert.rejects(c.renderTake(kept, [{...acts[1], codon: 64}], 48000), /codon is 0 to 63/);
    await assert.rejects(c.renderTake(kept, [{...acts[0], points: [{theta: 7, phi: 1}]}], 48000), /\[0, 2\*pi\)/);
    assert.equal(owner.renderCalls.length, sent, 'refused before the owner');
  } finally { await c.dispose(); }
});

const hear = async (audio, c, at) => {
  for (let i = 0; i < 400 && BigInt(c.audioClock().samples_elapsed) < BigInt(at); i++) {
    audio.currentTime += 0.05; await new Promise(r => setTimeout(r, 5));
  }
};

test('a Torus setting for a later sample is sent at once and the owner makes it there, inside the block that reaches it', async () => {
  const {owner, audio, c} = await openController();
  try {
    const generation = c.reading.native.acknowledged.generation;
    const cursor = c.audioClock().samples_elapsed;
    const ahead = (BigInt(cursor) + 4800n).toString();
    const landed = await c.torusSet({polyphony: 4}, ahead);
    assert.equal(landed, ahead, 'it names the sample it lands at');
    assert.ok(BigInt(c.audioClock().samples_elapsed) < BigInt(ahead), 'answered before the owner\'s sound reached it: nothing waited');
    assert.deepEqual(owner.torusCalls.at(-1), {operation: 'torus-set', edit: {polyphony: 4}, at_samples_elapsed: ahead}, 'the sample travels to the owner');
    assert.equal(c.reading.native.acknowledged.generation, generation, 'nothing moves before its sample');
    assert.deepEqual(c.reading.instrument.torus.waiting, [{at_samples_elapsed: ahead, edit: {polyphony: 4}}], 'the owner names what waits');
    // A Fundamental for a later sample moves the scene's event where it lands: the sources stand stale until they are read past it.
    const later = (BigInt(cursor) + 9600n).toString();
    await c.torusSet({fundamental: {source: 'hz', hz: 300}}, later);
    assert.equal(c.reading.instrument.sources_stale, true);
    await hear(audio, c, later);
    assert.ok(BigInt(c.audioClock().samples_elapsed) >= BigInt(later), 'the owner\'s sound reached it');
    assert.equal(BigInt(c.reading.native.acknowledged.generation), BigInt(generation) + 1n,
      'the Fundamental is one modes continuation, in the block that reached it');
    assert.equal(owner.torusSettings.polyphony, 4);
    assert.deepEqual(owner.torusSettings.fundamental, {source: 'hz', hz: 300});
    assert.deepEqual(owner.waiting, []);
    // At the cursor it is made now; behind it, or not an exact cursor, it is refused before the owner sees it.
    const now = c.audioClock().samples_elapsed;
    assert.equal(await c.torusSet({polyphony: 5}, now), now);
    const calls = owner.torusCalls.length;
    await assert.rejects(c.torusSet({polyphony: 3}, '0'), /setting at sample 0 is behind the owner's cursor/);
    await assert.rejects(c.torusSet({polyphony: 3}, 48000), /exact sample cursor/);
    assert.equal(owner.torusCalls.length, calls);
  } finally { await c.dispose(); }
});

test('a determinant at a sample waits for the owner\'s sound to reach it; its answer names where it landed; one behind or far ahead is refused', async () => {
  const {audio, c} = await openController();
  try {
    const cursor = c.audioClock().samples_elapsed;
    await c.untilSample(cursor);
    const landed = await c.torusSet({polyphony: 4});
    assert.equal(landed, c.audioClock().samples_elapsed, 'a Torus edit with no sample lands at the cursor the owner took it at');
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
  assert.match(command, /if\(at!==undefined\)await controller\.untilSample\(at\);/, 'a determinant or a damping edit at a sample waits for it');
  const torusEdit = command.slice(command.indexOf("if(edit.kind==='torus')"), command.indexOf('if(at!==undefined)throw'));
  assert.match(torusEdit, /const landed=await controller\.torusSet\(edit\.edit,at\);update\(\);return \{landed_at_samples_elapsed:landed\};/,
    'a Torus setting is sent with its sample and made there by the owner');
  assert.doesNotMatch(torusEdit, /reach\(\)|untilSample/, 'it does not wait for the cursor');
  const controlled = await readFile(join(journeys, 'src/native-field/controller.ts'), 'utf8');
  const sources = controlled.slice(controlled.indexOf('private async readSources('), controlled.indexOf('private async readInfluence('));
  assert.match(sources, /this\.fundamentalAt/, 'sources read before a waiting Fundamental lands stay stale');
  assert.match(command, /This edit is made on the frame\\'s own sound/, 'an edit of the frame\'s own sound at a sample is refused in words');
});

// ---------------------------------------------------------------------------------------------------- a kept sound (O-I #852)
test('a sound is saved from the Torus by its name alone, and a kept sound is opened whole (O-I #852)', async () => {
  const {readStageRequest, STAGE_TORUS_SOUND_BYTES_MAX, STAGE_TORUS_SOUND_NAME_MAX} = await stage();
  assert.equal(STAGE_TORUS_SOUND_NAME_MAX, 120, 'the kernel\'s own bound on a sound\'s name');
  assert.deepEqual(readStageRequest(request({command: 'torus-sound', action: 'save', name: 'Low bell'})).command, {command: 'torus-sound', action: 'save', name: 'Low bell'});
  for (const name of [undefined, '', '   ', 'a\nb', 'x'.repeat(121), 7])
    assert.equal(readStageRequest(request({command: 'torus-sound', action: 'save', name})), null, JSON.stringify(name));
  assert.equal(readStageRequest(request({command: 'torus-sound', action: 'save', name: 'Low bell', body: {}})), null, 'no other operand: the torus is its body');
  const kept = sound();
  assert.deepEqual(readStageRequest(request({command: 'torus-sound', action: 'open', sound: kept})).command, {command: 'torus-sound', action: 'open', sound: kept});
  for (const bad of [undefined, null, [], {...kept, schema: 'oi.torus-take/v1'}, {...kept, sound_ref: ''}, {...kept, name: 4},
    {...kept, checkpoint: 'x'.repeat(STAGE_TORUS_SOUND_BYTES_MAX)}])
    assert.equal(readStageRequest(request({command: 'torus-sound', action: 'open', sound: bad})), null, JSON.stringify(bad)?.slice(0, 60));
  assert.equal(readStageRequest(request({command: 'torus-sound', action: 'open', sound: kept, name: 'x'})), null, 'no other operand');
});

test('a saved sound and an opened one answer across the channel: the sound; where it rings again from and what has moved', async () => {
  const {readStageResult, stageReplyMessage} = await stage();
  const kept = sound();
  assert.deepEqual(readStageResult(stageReplyMessage(7, {ok: true, sound: kept}, {command: 'torus-sound', action: 'save', name: 'Low bell'})), {req: 7, ok: true, sound: kept});
  const moved = [{source: 'event', saved: 'sha256:a', now: 'sha256:b', words: 'The event the tuning was read from has moved'}];
  assert.deepEqual(readStageResult(stageReplyMessage(8, {ok: true, landed_at_samples_elapsed: '52992', moved}, {command: 'torus-sound', action: 'open', sound: kept})),
    {req: 8, ok: true, landed_at_samples_elapsed: '52992', moved});
  assert.deepEqual(readStageResult(stageReplyMessage(9, {ok: true, landed_at_samples_elapsed: '52992', moved: []}, {command: 'torus-sound', action: 'open', sound: kept})),
    {req: 9, ok: true, landed_at_samples_elapsed: '52992', moved: []}, 'nothing moved is said too');
  const answer = {v: 1, kind: 'host-command-result', command: 'torus-sound', req: 8, ok: true, landed_at_samples_elapsed: '52992'};
  for (const [why, bad] of [['a move with no words', {moved: [{source: 'event', saved: 'a', now: 'b'}]}], ['moves as text', {moved: 'event'}],
    ['a sound of another schema', {sound: {...kept, schema: 'x'}}]])
    assert.equal(readStageResult({...answer, ...bad}), null, why);
});

test('a sound is saved from the checkpoint the kernel named, and opens as saved through the one owner, saying what has moved (O-I #852)', async () => {
  const {owner, c} = await openController();
  try {
    const saved = await c.torusSound('Low bell');
    assert.deepEqual(sent(owner, 'torus-checkpoint'), [{operation: 'torus-checkpoint'}], 'the owner keeps the Torus as it rings');
    const [named] = owner.given.keys();
    assert.deepEqual(owner.soundCalls, [{operation: 'torus_sound', lease: 'controlled:scene-lease', checkpoint_sha256: named, name: 'Low bell'}],
      'saved under the name the kernel relayed the checkpoint by, under the frame\'s own lease');
    assert.equal(saved.schema, 'oi.torus-sound/v1');
    owner.moved = [{source: 'event', saved: 'sha256:a', now: 'sha256:b', words: 'The event the tuning was read from has moved'}];
    const generation = c.reading.native.acknowledged.generation;
    const opened = await c.openTorusSound(saved);
    const [, now] = owner.given.keys();
    assert.deepEqual(owner.soundCalls[1], {operation: 'torus_sound_open', lease: 'controlled:scene-lease', sound: saved, now_sha256: now},
      'opened against the Torus as it stands now, a fresh checkpoint');
    assert.deepEqual(sent(owner, 'torus-restore'), [{operation: 'torus-restore', checkpoint: saved.checkpoint}], 'the owner restores the sound as saved');
    assert.equal(BigInt(c.reading.native.acknowledged.generation), BigInt(generation) + 2n);
    assert.deepEqual(opened, {landed_at_samples_elapsed: c.reading.native.acknowledged.samples_elapsed, moved: owner.moved});
    // A checkpoint relayed unnamed saves nothing and opens nothing: refused in words before the kernel is asked.
    owner.unlabelled = true;
    await assert.rejects(c.torusSound('Low bell'), /relayed the Torus checkpoint unnamed/);
    await assert.rejects(c.openTorusSound(saved), /relayed the Torus checkpoint unnamed/);
    assert.equal(owner.soundCalls.length, 2);
    await assert.rejects(c.openTorusSound({schema: 'oi.torus-take/v1'}), /oi\.torus-sound\/v1/);
    await assert.rejects(c.torusSound(''), /1 to 120 characters/);
    assert.equal(owner.soundCalls.length, 2, 'refused before the kernel');
  } finally { await c.dispose(); }
});

test('the frame saves and opens a sound through its native field (O-I #852)', async () => {
  const {STAGE_COMMANDS} = await stage();
  assert.ok(STAGE_COMMANDS.includes('torus-sound'));
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  assert.ok(app.includes("case 'torus-sound':"), 'the frame runs the sound\'s acts (until it does, the shell refuses an answer that carries no sound and no landing)');
  const sound = app.slice(app.indexOf("case 'torus-sound':"), app.indexOf("case 'render-take':"));
  assert.match(sound, /if\(command\.action==='save'\)return \{ok:true,sound:await nativeField\.controller\.torusSound\(command\.name\)\};/, 'saving is a read');
  assert.match(sound, /\{const \{landed_at_samples_elapsed,moved\}=await nativeField\.controller\.openTorusSound\(command\.sound\);announceHostState\(\);return \{ok:true,landed_at_samples_elapsed,moved\};\}/,
    'opening sets the Torus again, so the state is announced');
});
