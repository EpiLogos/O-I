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
import {isDeepStrictEqual} from 'node:util';
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
/** A take as the kernel seals one (kernel expression_performance/torus.rs TorusTake, `oi.torus-take/v1`): its digest, the checkpoint it began
 * at by the name the kernel relayed it under, what was made and the kernel's seal. */
const sealedTake = (extra = {}) => ({schema: 'oi.torus-take/v1', take_ref: 'sha256:take', lease: 'controlled:scene-lease', sample_rate: 48000,
  from_samples: '48000', frames: '48000', checkpoint: checkpoint(), checkpoint_sha256: 'sha256:checkpoint/48000/0', acts: [], render: {}, readings: [],
  law: 'kept', seal: 'hmac-sha256:seal', ...extra});
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
const openController = async ({prepare} = {}) => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  class TorusOwner extends ControlledSceneOwner {
    renders = 0; renderCalls = []; torusCalls = []; waiting = []; soundCalls = []; moved = []; unlabelled = false; given = new Map(); takeCalls = []; takeAnswer = null;
    // What rings (O-I #852, QL scene_field.rs set_body): the torus until a form is chosen. The scene's M2 condition and M3 form as the
    // owner discloses them on inspect (current.m2.condition.source_path; current.m3.form.angles_deg10), and its session's Strike.
    body = null; condition = {tattva_coordinate: '#2-2-2-5-5', material_fibre: 'earth'}; angles = [0, 600, -300];
    torus() {
      const body = this.body === null ? {kind: 'torus', law: 'controlled'}
        : {kind: 'form', prepared: {schema: 'ql.physical-body-preparation/v1', request: {preparation_ref: `controlled:body/${this.body.modes}`,
          material: {...this.body.material, damping: 'controlled'}}, form: this.body.form},
          modes: this.body.modes, voices: 8, law: 'controlled'};
      return {...super.torus(), body};
    }
    sources() {
      const sources = super.sources();
      if (this.condition) sources.current.m2.condition = {source_path: structuredClone(this.condition)};
      sources.current.m3.form.angles_deg10 = [...this.angles];
      return sources;
    }
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
      // The kernel's seal of a take (O-I #855, native_expression.rs torus_take): what its owner was sent from the checkpoint it relayed under
      // that name; no worker request, no fresh checkpoint.
      if (request.operation === 'torus_take') {
        this.takeCalls.push(structuredClone(request));
        if (request.lease !== 'controlled:scene-lease') throw new Error('native-expression.foreign_lease');
        // named, or given whole and named by the kernel (native_expression.rs TorusTake: its value_sha256), never both
        if ((request.checkpoint_sha256 === undefined) === (request.checkpoint === undefined)) throw new Error('A take is sealed from one checkpoint');
        const named = request.checkpoint === undefined ? request.checkpoint_sha256
          : [...this.given].find(([, kept]) => isDeepStrictEqual(kept, request.checkpoint))?.[0] ?? 'sha256:unkept';
        if (!this.given.has(named)) throw new Error(`No Torus checkpoint ${named} was given under this lease`);
        return this.takeAnswer ?? sealedTake({checkpoint: this.given.get(named), checkpoint_sha256: named});
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
      // The stage's disclosure and a Tarot score's state, two reads that do not advance the field (QL stage-state, score-state), so every
      // reading the controller holds the field for can be made on a field the person held (round 896, 1T item 14).
      if (command?.operation === 'stage-state' || command?.operation === 'score-state') {
        const read = structuredClone(request);
        read.request.command = {operation: 'read'};
        const reply = await super.request(read);
        return command.operation === 'stage-state' ? {...reply, stage: {schema: 'ql.stage-state/v1', law: 'controlled'}}
          : {...reply, score: {schema: 'ql.tarot-score/v1', law: 'controlled'}, current: true, resolved_event_ref: 'controlled:scene'};
      }
      const own = ['torus-checkpoint', 'torus-restore', 'torus-render', 'torus-body'];
      if (!own.includes(command?.operation)) return super.request(request);
      this.torusCalls.push(structuredClone(command));
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      if (command.operation === 'torus-body') {
        // One body act, one generation (QL scene_field.rs set_body): a form prepared for this scene's event, subject and rate, or the torus.
        const body = command.body;
        if (this.refuse?.(command)) return {...reply, status: 'refused', error: 'controlled refusal: torus-body'};
        if (body !== null && (body.event_ref !== this.frame.event_ref || body.subject_ref !== this.frame.subject_ref || body.sample_rate !== this.frame.sample_rate))
          return {...reply, status: 'refused', error: 'a form\'s body is prepared for this scene\'s event, subject and rate'};
        this.body = body === null ? null : structuredClone(body);
        this.bump(1n);
        return {...reply, field: {...structuredClone(this.frame), audio: []}, torus: this.torus()};
      }
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
  prepare?.(owner, audio);
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

// O-I #747 round 896, 1S (DLW build ruling 2026-11-09, F1: "Only a hold that waits on a person reads as 'sound closed'"): a take rendered on
// a held field holds it for each part ("take render") and leaves each part's hold ("take render complete; resume explicitly") until the
// next part takes it again: the controller's own work, never said as the sound closed. Once the whole take is rendered the hold stands
// until someone resumes it, and only then is it said (entitySound.ts fieldSoundClosed over controller.ts holdStands).
// Round 896, 1T item 14 (review c99d F-1): a hold that is not the person's starts it (the port's own, an acknowledgement it could not
// read), since a take on a field the person held puts the person's hold back, and says nothing (the test below).
test('a take rendered on a held field says the sound closed only once the whole take is rendered, never between its parts', async () => {
  const {c} = await openController();
  const {fieldSoundClosed, setFieldSound} = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
  try {
    setFieldSound(c, false);
    c.hold('native acknowledgement unknown; not retried');
    assert.equal(c.heldByPerson, false, 'the port\'s hold, not the person\'s');
    const said = [];
    c.onChange = () => { said.push(fieldSoundClosed(c, true)); };
    await c.renderTake(checkpoint('48000'), [], 120000);
    const words = 'The field\'s sound is closed: the field is held (take render complete; resume explicitly).';
    assert.deepEqual(said.filter(Boolean), [words], 'said once, when the whole take was rendered');
    assert.equal(said.at(-1), words);
    assert.equal(fieldSoundClosed(c, true), words, 'and offers Open sound');
  } finally { await c.dispose(); }
});

// Round 896, 1T item 14 (DLW build ruling 2026-11-09; review c99d F-1): a take rendered on a field the person held puts the person's hold
// back after each part, mark and all, as an operation does: the Sound says nothing, before, between the parts or after, and the field
// stands held by the person.
test('a take rendered on a field the person held says nothing, and leaves the person\'s hold as it stood', async () => {
  const {c} = await openController();
  const {fieldSoundClosed, setFieldSound} = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
  try {
    setFieldSound(c, false);
    c.hold('held by you');
    assert.equal(c.heldByPerson, true);
    const said = [];
    c.onChange = () => { said.push(fieldSoundClosed(c, true)); };
    await c.renderTake(checkpoint('48000'), [], 120000);
    assert.ok(said.length > 0, 'the take held and let go the field');
    assert.deepEqual(said.filter(Boolean), [], 'nothing said, nothing announced');
    assert.equal(c.status, 'held');
    assert.equal(c.reason, 'held by you', 'the person\'s hold, put back');
    assert.equal(c.heldByPerson, true, 'and its mark');
    assert.equal(fieldSoundClosed(c, true), null);
  } finally { await c.dispose(); }
});

// Round 896, 1T item 14 (review c99d F-1): every reading the controller holds the field for, made on a field the person held, puts the
// person's hold back when it ends, mark and all, as an operation does: an influence, a stage disclosure, a Torus session reading, a Torus
// checkpoint, a Tarot score, a source inspection and a take. The Sound says nothing and announces nothing. Over a hold that is not the
// person's, each reading's own hold stands and is said (the test above, and field-sound-closed-896).
test('every reading on a field the person held puts the person\'s hold back, and says nothing', async () => {
  const {c} = await openController();
  const {fieldSoundClosed, setFieldSound} = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
  try {
    setFieldSound(c, false);
    c.hold('held by you');
    const said = [];
    c.onChange = () => { said.push(fieldSoundClosed(c, true)); };
    const readings = [['influence', () => c.influence()], ['stage disclosure', () => c.stageState()], ['Torus session', () => c.torusState()],
      ['Torus checkpoint', () => c.torusCheckpoint()], ['Tarot score', () => c.score({operation: 'score-state'})],
      ['source inspection', () => c.inspectSources()], ['take', () => c.renderTake(checkpoint('48000'), [], 48000)]];
    for (const [name, read] of readings) {
      const before = said.length;
      await read();
      assert.ok(said.length > before, `${name}: it held and let go the field`);
      assert.deepEqual([c.status, c.reason, c.heldByPerson, fieldSoundClosed(c, true)], ['held', 'held by you', true, null],
        `${name}: the person's hold, put back, says nothing`);
    }
    assert.deepEqual(said.filter(Boolean), [], 'nothing announced');
    // Resumed, the field follows, and the person's mark is let go.
    await c.resume();
    assert.equal(c.status, 'following');
    assert.equal(c.heldByPerson, false, 'a resume lets the person\'s mark go');
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
  // O-I #856: and, heard on your own place's sky, it says so (`heard_on_your_sky`): the checkpoint keeps the world's sky.
  assert.match(torus, /if\(command\.action==='checkpoint'\)\{const checkpoint=await nativeField\.controller\.torusCheckpoint\(\),checkpoint_sha256=nativeField\.controller\.checkpointName\(checkpoint\);\s+const heard=nativeField\.controller\.heardOnYourSky\?\{heard_on_your_sky:true as const\}:\{\};\s+return checkpoint_sha256\?\{ok:true,checkpoint,checkpoint_sha256,\.\.\.heard\}:\{ok:true,checkpoint,\.\.\.heard\};\}/,
    'keeping is a read, answered with the name the kernel relayed the checkpoint under when it named it (O-I #855)');
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
  assert.match(sound, /if\(command\.action==='save'\)\{const sound=await nativeField\.controller\.torusSound\(command\.name\);\s+return nativeField\.controller\.heardOnYourSky\?\{ok:true,sound,heard_on_your_sky:true\}:\{ok:true,sound\};\}/,
    'saving is a read, which says when it was heard on your own place\'s sky (O-I #856)');
  assert.match(sound, /\{const \{landed_at_samples_elapsed,moved\}=await nativeField\.controller\.openTorusSound\(command\.sound\);announceHostState\(\);return \{ok:true,landed_at_samples_elapsed,moved\};\}/,
    'opening sets the Torus again, so the state is announced');
});

// ---------------------------------------------------------------------------------------------------- the body that rings (O-I #852)
// DLW manual §21.2 Body: "The body is what rings. It is the torus unless you choose a form." The Body page's choice crosses the stage
// channel as the instrument's `body` edit; the controller makes the scene's own M3 form (its codon at its angles, domain.m3) a body of
// QL's fold sheet, of the scene's M2 fibre under the owner's Strike, and sends it as one `torus-body` act (QL scene_field.rs set_body,
// instrument-session.mjs torusBody); null gives the body back to the torus. The owner prepares it and refuses in its words.
test('a body is a form of so many modes a voice at a Q, its material declared or the tattva\'s, or the torus: nothing else, and at no sample', async () => {
  const {readStageRequest, readInstrumentEdit, STAGE_BODY_MODES_MAX} = await stage();
  assert.equal(STAGE_BODY_MODES_MAX, 64, 'QL form_instrument/body.rs MAX_BODY_MODES');
  const form = {kind: 'body', body: {modes: 8, q_factor: 12, material: 'declared'}};
  assert.deepEqual(readStageRequest(request({command: 'instrument', edit: form})).command, {command: 'instrument', edit: form});
  assert.deepEqual(readInstrumentEdit({kind: 'body', body: null}), {kind: 'body', body: null}, 'the torus');
  assert.deepEqual(readInstrumentEdit({kind: 'body', body: {modes: 64, q_factor: 0.1, material: 'tattva'}}), {kind: 'body', body: {modes: 64, q_factor: 0.1, material: 'tattva'}});
  for (const body of [undefined, {}, {modes: 0, q_factor: 12, material: 'declared'}, {modes: 65, q_factor: 12, material: 'declared'},
    {modes: 2.5, q_factor: 12, material: 'declared'}, {modes: 8, q_factor: 0, material: 'declared'}, {modes: 8, q_factor: 41, material: 'declared'},
    {modes: 8, q_factor: 12, material: 'earth'}, {modes: 8, q_factor: 12}, {modes: 8, q_factor: 12, material: 'declared', fibre: 'earth'}, 'form'])
    assert.equal(readInstrumentEdit({kind: 'body', body}), null, JSON.stringify(body));
  assert.equal(readInstrumentEdit({kind: 'body', body: null, form: 'fold'}), null, 'no other operand');
  assert.equal(readStageRequest(request({command: 'instrument', edit: form, at_samples_elapsed: '48000'})), null,
    'a body is chosen at the owner\'s cursor, once no act waits: it lands at no later sample');
});

test('the controller makes the scene\'s M3 form a body and sends it as one torus-body act; the torus is the body given back', async () => {
  const {owner, c} = await openController();
  try {
    owner.torusSettings = {...owner.torusSettings, strike: 0.7};
    await c.torusState();
    const generation = c.reading.native.acknowledged.generation;
    assert.equal(c.reading.instrument.torus.body.kind, 'torus', 'the torus rings until a form is chosen');
    const landed = await c.torusBody({modes: 8, q_factor: 12, material: 'declared'});
    assert.deepEqual(sent(owner, 'torus-body'), [{operation: 'torus-body', body: {
      schema: 'ql.form-body-request/v1', event_ref: 'controlled:scene', subject_ref: 'controlled:subject', source_generation: 1,
      form: {kind: 'fold', form_ref: '#3-controlled', source_ref: 'ql.m3-state/v1@1'},
      samples: {schema: 'ql.psg-form-samples/v1', prep_ref: 'oi:psg:m3-fold-body', treatment: 'sheet-carrier', layers: [{layer_ref: 'form:sheet', rest_depth_w: 0.5}],
        resolution: 12, units: {extent_units: 2, depth_units: 0.1, metres_per_unit: 0.25}},
      crease_deg10: [0, 600, -300], material: {fibre: 'earth', q_factor: 12, strike_share: 0.7, source_ref: 'declared'}, modes: 8, sample_rate: 48000}}],
    'the scene\'s own codon at its own angles, of its own fibre, struck by the session\'s Strike');
    assert.equal(BigInt(c.reading.native.acknowledged.generation), BigInt(generation) + 1n, 'one body act, one generation');
    assert.equal(landed, c.reading.native.acknowledged.samples_elapsed, 'it rings from the owner\'s cursor');
    assert.equal(c.reading.instrument.torus.body.kind, 'form', 'what rings is read back from the owner\'s reply, never set here');
    assert.equal(c.reading.instrument.torus.body.modes, 8);
    await c.torusBody({modes: 16, q_factor: 4.5, material: 'tattva'});
    assert.deepEqual(sent(owner, 'torus-body').at(-1).body.material, {fibre: 'earth', q_factor: 4.5, strike_share: 0.7, source_ref: '#2-2-2-5-5'},
      'under Tattva the material names the tattva it was taken from');
    await c.torusBody(null);
    assert.deepEqual(sent(owner, 'torus-body').at(-1), {operation: 'torus-body', body: null});
    assert.equal(c.reading.instrument.torus.body.kind, 'torus');
  } finally { await c.dispose(); }
});

test('a body the scene cannot make is refused in words before the owner is asked; one the owner refuses leaves the body as it rang', async () => {
  const choice = {modes: 8, q_factor: 12, material: 'declared'};
  const struck = owner => { owner.torusSettings = {...owner.torusSettings, strike: 0.7}; };
  for (const [why, prepare, words, made = choice] of [
    ['no Strike in the session', () => {}, /session states no Strike/],
    ['no fibre', owner => { struck(owner); owner.condition = {tattva_coordinate: '#2-2-2-5-5', material_fibre: null}; }, /gives no material fibre/],
    ['no condition', owner => { struck(owner); owner.condition = null; }, /gives no material fibre/],
    ['an angle between tenths', owner => { struck(owner); owner.angles = [0, 600.5, -300]; }, /whole number of tenths of a degree within 180° either way/],
    ['an angle past half a turn', owner => { struck(owner); owner.angles = [0, 1801, -300]; }, /whole number of tenths of a degree within 180° either way/],
    ['Tattva on no tattva', owner => { struck(owner); owner.condition = {tattva_coordinate: null, material_fibre: 'earth'}; }, /stands on no tattva: set Body source to Declared/,
      {...choice, material: 'tattva'}],
    ['no modes', struck, /modes/, {...choice, modes: 0}],
    ['too many modes', struck, /modes/, {...choice, modes: 65}],
    ['a Q of nothing', struck, /Q factor/, {...choice, q_factor: 0}],
  ]) {
    const {owner, c} = await openController({prepare});
    try {
      await c.torusState();
      await assert.rejects(c.torusBody(made), words, why);
      assert.deepEqual(sent(owner, 'torus-body'), [], `${why}: nothing the scene cannot make reached the owner`);
    } finally { await c.dispose(); }
  }
  const {owner, c} = await openController({prepare: struck});
  try {
    await c.torusState();
    owner.refuse = command => command.operation === 'torus-body';
    await assert.rejects(c.torusBody(choice), /controlled refusal/);
    assert.equal(c.reading.instrument.torus.body.kind, 'torus', 'a body the owner did not take is not what rings');
  } finally { await c.dispose(); }
});

test('the frame chooses the body through its native field at the owner\'s cursor, and refuses one for a later sample in words', async () => {
  const field = await readFile(join(journeys, 'src/nativeField.ts'), 'utf8');
  const command = field.slice(field.indexOf('const command=async(edit:InstrumentEdit'), field.indexOf('const liveEntry='));
  const body = command.slice(command.indexOf("if(edit.kind==='body')"), command.indexOf("if(at!==undefined)throw new Error('This edit"));
  assert.ok(body.length > 0, 'the frame runs the body edit');
  assert.match(body, /if\(at!==undefined\)throw new Error\('A body is chosen at the owner\\'s cursor/);
  assert.match(body, /const landed=await controller\.torusBody\(edit\.body\);update\(\);return \{landed_at_samples_elapsed:landed\};/);
});

// ---------------------------------------------------------------------------------------------------- a take sealed to lie under a scene
// O-I #855 (BB's steps, round 19): a Live take lies under an Expression's scene only as the kernel sealed it from what the Torus's owner was
// sent (native_expression.rs `torus_take`), from the checkpoint the take BEGAN at, never a fresh one. The kernel names each checkpoint it
// relays (`torus_checkpoint_sha256`) and the frame cannot reproduce that digest, so the checkpoint a take begins at answers with its name.
test('a take is sealed by the name of the checkpoint it began at, and the kernel\'s seal answers across the channel (O-I #855)', async () => {
  const {readStageRequest, readStageResult, stageReplyMessage, STAGE_COMMANDS} = await stage();
  assert.ok(STAGE_COMMANDS.includes('torus-take'));
  const named = 'sha256:checkpoint/48000/0';
  assert.deepEqual(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint_sha256: named})).command, {command: 'torus-take', action: 'seal', checkpoint_sha256: named});
  for (const bad of [undefined, '', 'checkpoint', 7, 'sha256:' + 'x'.repeat(600), 'sha256:a\nb'])
    assert.equal(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint_sha256: bad})), null, String(bad).slice(0, 40));
  assert.equal(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint_sha256: named, checkpoint: checkpoint()})), null, 'one checkpoint: named or given, never both');
  // BB round 20: or given whole, as the take's course keeps it, the kernel naming it (native_expression.rs TorusTake `checkpoint`), so a
  // seal the kernel refused by a name it no longer knows is asked again from the checkpoint itself
  const given = checkpoint();
  assert.deepEqual(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint: given})).command, {command: 'torus-take', action: 'seal', checkpoint: given});
  for (const bad of [{...given, schema: 'ql.torus-sound/v1'}, {...given, taken_at_samples: 48000}, {...given, sample_rate: 7}, 'checkpoint', null,
    {...given, pad: 'x'.repeat(1024 * 1024)}])
    assert.equal(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint: bad})), null, JSON.stringify(bad)?.slice(0, 60));
  assert.equal(readStageRequest(request({command: 'torus-take', action: 'seal'})), null, 'sealed from no checkpoint, it is refused');
  assert.equal(readStageRequest(request({command: 'torus-take', action: 'seal', checkpoint: given, name: 'x'})), null, 'and nothing else');
  assert.deepEqual(readStageResult(stageReplyMessage(9, {ok: true, take: sealedTake()}, {command: 'torus-take', action: 'seal', checkpoint: given})), {req: 9, ok: true, take: sealedTake()});
  assert.equal(readStageRequest(request({command: 'torus-take', action: 'record', checkpoint_sha256: named})), null, 'sealing is its one act');
  const take = sealedTake();
  assert.deepEqual(readStageResult(stageReplyMessage(7, {ok: true, take}, {command: 'torus-take', action: 'seal', checkpoint_sha256: named})), {req: 7, ok: true, take});
  const answer = {v: 1, kind: 'host-command-result', command: 'torus-take', req: 7, ok: true};
  for (const [why, bad] of [['another schema', {...take, schema: 'oi.torus-sound/v1'}], ['no seal', {...take, seal: 3}], ['no rate', {...take, sample_rate: 'x'}]])
    assert.equal(readStageResult({...answer, take: bad}), null, why);
  const kept = checkpoint();
  assert.deepEqual(readStageResult(stageReplyMessage(8, {ok: true, checkpoint: kept, checkpoint_sha256: named}, {command: 'torus', action: 'checkpoint'})),
    {req: 8, ok: true, checkpoint: kept, checkpoint_sha256: named}, 'the checkpoint a take begins at answers with the name the kernel relayed it under');
  assert.equal(readStageResult({...answer, command: 'torus', checkpoint: kept, checkpoint_sha256: 4}), null);
});

// BB round 20: the take's bound is its owner's, the kernel's bound on what crosses to it (native_expression.rs MAX_REQUEST, 32 MiB), which the
// kernel gives no reading of; the frame keeps it in one place, cited to that constant, and the boundary reads it there.
test('a sealed take is read within the kernel\'s bound on what crosses to it, kept in one place and cited to the kernel\'s constant', async () => {
  const {readStageTorusTake, STAGE_TORUS_TAKE_BYTES_MAX} = await stage();
  assert.equal(STAGE_TORUS_TAKE_BYTES_MAX, 32 * 1024 * 1024);
  const padded = n => sealedTake({acts: ['x'.repeat(n)]});
  assert.ok(readStageTorusTake(padded(5 * 1024 * 1024)), 'a take past 4 MiB reads');
  assert.equal(readStageTorusTake(padded(STAGE_TORUS_TAKE_BYTES_MAX)), null, 'one past the kernel\'s bound does not');
  const kernel = await readFile(join(journeys, '../../kernel/src/native_expression.rs'), 'utf8');
  assert.match(kernel, /^const MAX_REQUEST: usize = 32 \* 1024 \* 1024;$/m, 'the kernel\'s constant, which no reading exposes');
  const source = await readFile(join(journeys, 'src/stageCommands.ts'), 'utf8');
  assert.match(source, /native_expression\.rs MAX_REQUEST[^\n]*\n[^\n]*\nexport const STAGE_TORUS_TAKE_BYTES_MAX = 32 \* 1024 \* 1024;/, 'cited where it is kept');
  const basis = await readFile(join(journeys, '../../../../packages/expressions-boundary/src/performanceBasis.ts'), 'utf8');
  assert.match(basis, /import \{[^}]*STAGE_TORUS_TAKE_BYTES_MAX[^}]*\} from '[^']*field-studies-journeys\/src\/stageCommands\.ts';/, 'the boundary reads the one bound');
  assert.doesNotMatch(basis, /4 \* 1024 \* 1024|[^_]TAKE_BYTES_MAX = /, 'and keeps none of its own');
});

test('the controller seals a take through the kernel by the checkpoint it began at, under its lease, and names a checkpoint it kept (O-I #855)', async () => {
  const {owner, c} = await openController();
  try {
    const kept = await c.torusCheckpoint();
    const [named] = owner.given.keys();
    assert.equal(c.checkpointName(kept), named, 'the name the kernel relayed the checkpoint under');
    assert.equal(c.checkpointName(checkpoint()), null, 'a checkpoint it did not keep has no name');
    const sealed = await c.torusTake(named);
    assert.deepEqual(owner.takeCalls, [{operation: 'torus_take', lease: 'controlled:scene-lease', checkpoint_sha256: named}], 'the kernel seals the take that began there');
    assert.equal(sent(owner, 'torus-checkpoint').length, 1, 'no fresh checkpoint is taken to seal it');
    assert.equal(sealed.schema, 'oi.torus-take/v1');
    assert.equal(sealed.checkpoint_sha256, named);
    owner.takeAnswer = {schema: 'oi.torus-sound/v1'};
    await assert.rejects(c.torusTake(named), /oi\.torus-take\/v1/);
    await assert.rejects(c.torusTake(''), /names the checkpoint/);
    assert.equal(owner.takeCalls.length, 2, 'refused before the kernel');
    // BB round 20: given the checkpoint itself, the kernel names it and seals the take that began there
    owner.takeAnswer = undefined;
    const whole = await c.torusTake(kept);
    assert.deepEqual(owner.takeCalls.at(-1), {operation: 'torus_take', lease: 'controlled:scene-lease', checkpoint: kept}, 'sent whole, with no name beside it');
    assert.equal(whole.checkpoint_sha256, named, 'the kernel names it as it relayed it');
    await assert.rejects(c.torusTake(checkpoint('96000')), /No Torus checkpoint sha256:unkept was given under this lease/, 'a checkpoint it did not keep is refused in the kernel\'s words');
    await assert.rejects(c.torusTake({...kept, schema: 'ql.torus-sound/v1'}), /checkpoint it began at/);
    assert.equal(owner.takeCalls.length, 4, 'a checkpoint that is not one is refused before the kernel');
  } finally { await c.dispose(); }
});

test('the frame seals a take through its native field, and the checkpoint a take begins at answers with its name (O-I #855)', async () => {
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  assert.ok(app.includes("case 'torus-take':"), 'the frame runs the seal');
  const take = app.slice(app.indexOf("case 'torus-take':"), app.indexOf("case 'torus-engine':"));
  assert.match(take, /return \{ok:true,take:await nativeField\.controller\.torusTake\('checkpoint' in command\?command\.checkpoint:command\.checkpoint_sha256\)\};/, 'sealing is a read, by the name or the checkpoint itself');
  const torus = app.slice(app.indexOf("case 'torus':"), app.indexOf("case 'torus-sound':"));
  assert.match(torus, /checkpointName\(checkpoint\)/, 'the checkpoint a take begins at carries the name it was relayed under');
  const host = await readFile(join(journeys, '../../../../packages/expressions-boundary/src/host.ts'), 'utf8');
  assert.match(host, /CONCEALED_STAGE_COMMANDS[^\n]*'torus-take'/, 'concealed from the hosted page, as every Torus read is');
});

// ---------------------------------------------------------------------------------------------------- a take sounds (O-I #855 round 25)
// DLW build ruling 2026-11-05: "The sealed take is rendered offline from checkpoint + acts (renderTake). Its PCM is checked against
// pcm_sha256; a mismatch is refused in words. It plays from at_sample while the scene plays forward, and stops on pause, seek or rate
// change"; "the verified render is held per take, with a cap of 256 MB held across all takes. A take that would exceed it is refused in
// words that name the cap. It never silently drops"; "The take's acts drive setTorusPlay at their samples. The render feeds the symbol
// voices' tap (voiceTap). No collision strikes back: the take already holds what struck."
const {createHash} = await import('node:crypto');
/** The sha256 a sound of `frames` samples each `value` has, over its IEEE-754 binary32 little-endian samples (kernel torus.rs PCM_ENCODING). */
const pcmSha = (value, frames) => 'sha256:' + createHash('sha256').update(Buffer.from(new Float32Array(frames).fill(value).buffer)).digest('hex');
/** A take as the kernel seals one, with the acts its owner was sent in the owner's own grammar (each strength its pair of metres). */
const soundingTake = (extra = {}) => sealedTake({from_samples: '48000', frames: '48000', checkpoint: checkpoint('48000'),
  acts: [{action: 'strike-at', at_samples_elapsed: '48600', points: [{theta: 0.75, phi: 2.5, amplitude: [0.3, 0]}]},
    {action: 'strike', at_samples_elapsed: '49800', keys, amplitude: [0.35, 0]}],
  render: {schema: 'ql.torus-render/v1', parts: '1', pcm_sha256: pcmSha(0.125, 48000), pcm_encoding: 'kept', ended: checkpoint('96000'), ended_sha256: 'sha256:e'}, ...extra});
const until = async (ready, why) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise(r => setTimeout(r, 5)); assert.ok(ready(), why); };

test('a take\'s sealed acts are the acts the stage renders: each strength the owner\'s pair of metres taken back to its one strength', async () => {
  const {stageTakeActsOf} = await stage();
  const take = soundingTake();
  assert.deepEqual(stageTakeActsOf(take.acts, '48000', 48000), [
    {action: 'strike-at', at_samples_elapsed: '48600', points: [{theta: 0.75, phi: 2.5}], amplitude: 0.3},
    {action: 'strike', at_samples_elapsed: '49800', keys, amplitude: 0.35}]);
  assert.deepEqual(stageTakeActsOf([{action: 'singlet', at_samples_elapsed: '48000', codon: 8, amplitude: [0.35, 0]}, {action: 'release', at_samples_elapsed: '48001', keys}], '48000', 4800),
    [{action: 'singlet', at_samples_elapsed: '48000', codon: 8, amplitude: 0.35}, {action: 'release', at_samples_elapsed: '48001', keys}]);
  for (const [why, acts] of [['a strength with a second part', [{...take.acts[1], amplitude: [0.35, 0.1]}]],
    ['a touch at two strengths', [{...take.acts[0], points: [{theta: 1, phi: 1, amplitude: [0.3, 0]}, {theta: 2, phi: 1, amplitude: [0.4, 0]}]}]],
    ['an act past the take', [{...take.acts[1], at_samples_elapsed: '96000'}]], ['acts that are none', 'acts']])
    assert.equal(stageTakeActsOf(acts, '48000', 4800), null, why);
});

test('Audition names a take lane or none, and a take\'s sound is asked for by its ref: each by its own keys only', async () => {
  const {readStageRequest, STAGE_COMMANDS} = await stage();
  assert.ok(STAGE_COMMANDS.includes('take-audition') && STAGE_COMMANDS.includes('take-sound'));
  for (const lane_ref of ['take-lane:torus/2', null])
    assert.deepEqual(readStageRequest(request({command: 'take-audition', lane_ref})).command, {command: 'take-audition', lane_ref});
  for (const bad of [{lane_ref: 'note-lane:keys'}, {lane_ref: 'take-lane:torus/'}, {}, {lane_ref: null, take_ref: 'sha256:take'}])
    assert.equal(readStageRequest(request({command: 'take-audition', ...bad})), null, JSON.stringify(bad));
  assert.deepEqual(readStageRequest(request({command: 'take-sound', take_ref: 'sha256:take'})).command, {command: 'take-sound', take_ref: 'sha256:take'});
  for (const bad of [{take_ref: 'take'}, {take_ref: 7}, {}, {take_ref: 'sha256:take', frames: 1}])
    assert.equal(readStageRequest(request({command: 'take-sound', ...bad})), null, JSON.stringify(bad));
});

test('a sealed take sounds at its place under its scene, verified against its hash, through the frame\'s sound and the voices\' tap', async () => {
  const started = [];
  const {owner, audio, c} = await openController({prepare: (_owner, audio) => {
    const gain = audio.createGain.bind(audio), source = audio.createBufferSource.bind(audio);
    audio.createGain = () => { const node = gain(); node.to = []; node.connect = target => { node.to.push(target); return target; }; return node; };
    audio.createBufferSource = () => { const node = source(), start = node.start; node.to = [];
      node.connect = target => { node.to.push(target); return target; };
      // the native receiver's own blocks start at a time alone; a take starts at its offset
      node.start = (when, offset) => { start.call(node, when); node.offset = offset; if (offset !== undefined) started.push(node); }; return node; };
  }});
  try {
    const take = soundingTake(), want = from => ({take, lane_ref: 'take-lane:torus/1', title: 'Take 1', from_frame: from});
    const playing = {playing: true, rate: 1};
    assert.equal(c.soundTake(want(0), playing), null);
    await until(() => c.reading.take_player.held_bytes === 48000 * 4, 'the render is held once verified');
    assert.deepEqual(owner.renderCalls.at(-1), {operation: 'torus-render', checkpoint: checkpoint('48000'), acts: [
      {action: 'strike-at', at_samples_elapsed: '48600', points: [{theta: 0.75, phi: 2.5, amplitude: [0.3, 0]}]},
      {action: 'strike', at_samples_elapsed: '49800', keys, amplitude: [0.35, 0]}], frames: 48000}, 'rendered from its checkpoint with its acts');
    assert.equal(started.length, 0, 'nothing sounds before its render is verified');
    // it plays from where the scene stands now
    c.soundTake(want(1200), playing);
    assert.equal(started.length, 1);
    const [first] = started;
    assert.equal(first.offset, 1200 / 48000, 'from the take\'s frame at the scene\'s sample');
    assert.deepEqual([...first.buffer.data.slice(0, 3)], [0.125, 0.125, 0.125], 'its verified sound');
    const tap = c.voiceTap().input, level = first.to[0];
    assert.ok(level.to.includes(tap), 'through the frame\'s level, which the symbols\' voices listen to after');
    const sounding = c.reading.take_player.sounding;
    assert.deepEqual({...sounding, heard_at_ms: typeof sounding.heard_at_ms}, {take_ref: 'sha256:take', lane_ref: 'take-lane:torus/1', title: 'Take 1',
      from_frame: 1200, frames: 48000, sample_rate: 48000, heard_at_ms: 'number'});
    assert.equal(c.takeSounding(), true);
    assert.equal(c.reading.take_player.audition, null, 'no lane is auditioned: the row\'s main lane sounds');
    // the field answers its acts at their samples: the touch at its frame 600 struck before 1200
    const voices = c.reading.instrument.acting.voices.map(voice => voice.mode_ref);
    assert.deepEqual({...c.reading.take_player.struck, at: 0}, {at: 0, source: 'point', refs: voices, points: [{theta: 0.75, phi: 2.5}]});
    const {torusPlayReading} = await import('../src/native-field/torusPlay.mjs');
    assert.deepEqual(torusPlayReading(c.reading).torus.tonesHz, c.reading.instrument.acting.voices.map(voice => voice.frequency_hz), 'what the take struck is what the plate plays');
    // the scene plays on: no new start; the strike at frame 1800 is answered when the take reaches it
    audio.currentTime += 0.01;
    c.soundTake(want(1680), playing);
    assert.equal(started.length, 1, 'it plays on');
    audio.currentTime += 0.005;
    c.soundTake(want(1920), playing);
    assert.equal(c.reading.take_player.struck.points, undefined, 'the keys at frame 1800 struck');
    // a seek stops it and it plays again from the new place
    c.soundTake(want(30000), playing);
    assert.equal(first.stopped, true);
    assert.equal(started.length, 2);
    assert.equal(started[1].offset, 30000 / 48000);
    // a pause stops it; so does a rate other than the scene's own
    c.soundTake(want(30100), {playing: false, rate: 1});
    assert.equal(started[1].stopped, true);
    assert.equal(c.reading.take_player.sounding, null);
    assert.equal(c.takeSounding(), false);
    // the lane auditioned in place of the main lane is the row's, as its transport names it, reported even while nothing sounds
    c.soundTake(want(30100), {playing: false, rate: 1, audition: 'take-lane:torus/1'});
    assert.equal(c.reading.take_player.audition, 'take-lane:torus/1');
    c.soundTake(want(30100), {playing: false, rate: 1, audition: null});
    assert.equal(c.reading.take_player.audition, null);
    c.soundTake(want(30100), {playing: true, rate: 2});
    assert.equal(started.length, 2, 'at twice the rate, nothing sounds');
    c.soundTake(want(30100), playing);
    assert.equal(started.length, 3);
    assert.equal(owner.renderCalls.filter(call => call.frames === 48000).length, 1, 'rendered once: the verified render is held');
    // the engine plays it from the same render
    const render = c.takeSound('sha256:take');
    assert.equal(render.pcm.length, 48000);
    assert.throws(() => c.takeSound('sha256:other'), /sha256:other is not held/);
    // a take no scene lays any longer is let go
    c.soundTake(null, playing, new Set());
    assert.equal(started[2].stopped, true);
    assert.equal(c.reading.take_player.held_bytes, 0);
  } finally { await c.dispose(); }
});

test('a take whose sound is not the one the kernel sealed is refused in words, and one past the cap is refused naming it, never dropped', async () => {
  const {owner, c} = await openController();
  try {
    const playing = {playing: true, rate: 1};
    const forged = soundingTake({take_ref: 'sha256:forged', render: {...soundingTake().render, pcm_sha256: pcmSha(0.5, 48000)}});
    c.soundTake({take: forged, lane_ref: 'take-lane:torus/2', title: 'Take 2', from_frame: 0}, playing);
    await until(() => c.reading.take_player.refusal !== null, 'refused once rendered');
    assert.match(c.reading.take_player.refusal, /^Take 2 is not played: its sound rendered again from its checkpoint and acts is not the sound the kernel sealed/);
    assert.equal(c.reading.take_player.held_bytes, 0, 'nothing held');
    assert.match(c.soundTake({take: forged, lane_ref: 'take-lane:torus/2', title: 'Take 2', from_frame: 10}, playing), /not the sound the kernel sealed/, 'said once');
    assert.equal(c.soundTake({take: forged, lane_ref: 'take-lane:torus/2', title: 'Take 2', from_frame: 20}, playing), null);
    const renders = owner.renderCalls.length;
    assert.equal(c.reading.take_player.sounding, null);
    // held across takes: one held, then one that would take the held past the cap
    const held = soundingTake({take_ref: 'sha256:held', render: {...soundingTake().render, pcm_sha256: pcmSha((owner.renders + 1) / 8, 48000)}});
    c.soundTake({take: held, lane_ref: 'take-lane:torus/3', title: 'Take 3', from_frame: 0}, playing);
    await until(() => c.reading.take_player.held_bytes === 48000 * 4, 'held');
    const {TAKE_RENDERS_BYTES_MAX, TAKE_NOT_PLAYED_RESUMES} = await controller();
    assert.equal(TAKE_RENDERS_BYTES_MAX, 256 * 1024 * 1024);
    const frames = (TAKE_RENDERS_BYTES_MAX - 48000 * 4) / 4 + 1;
    const big = soundingTake({take_ref: 'sha256:big', frames: String(frames), acts: []});
    const said = c.soundTake({take: big, lane_ref: 'take-lane:torus/4', title: 'Take 4', from_frame: 0}, playing);
    // REPLACES the words without where the scene resumes (O-I #855: "A take whose motion cannot replay exactly says where it resumes")
    assert.equal(said, `Take 4 is not played: its sound takes ${(frames * 4 / 1048576).toFixed(2)} MB, and the takes' sounds held come to 256 MB at most (0.18 MB are held now). Nothing held is let go for it. ${TAKE_NOT_PLAYED_RESUMES}`);
    assert.equal(owner.renderCalls.length, renders + 1, 'refused before the owner renders anything');
    assert.equal(c.reading.take_player.held_bytes, 48000 * 4, 'what is held stays held');
  } finally { await c.dispose(); }
});

// O-I #855 Done when: "A take whose motion cannot replay exactly says where it resumes." Under its scene a take's sound is the one the
// kernel sealed, sample for sample, from any frame; what it struck before the frame it is taken up at is not struck again, and a take
// that is not played leaves the scene to the Torus as it rings: each is said, once, where it happens.
test('a take under its scene says where it resumes: taken up past its start, from that frame and its last act; not played, on the Torus as it rings', async () => {
  const {TAKE_NOT_PLAYED_RESUMES, takeResumesAt} = await controller();
  assert.equal(TAKE_NOT_PLAYED_RESUMES, 'The scene plays on, its Torus ringing as it stands.');
  assert.equal(takeResumesAt('Take 1', 30000, 48000), 'Take 1 resumes 0.63 s in: its sound as the kernel sealed it from there, and the plate from the last act it struck before then, on the scene\'s voices as they stand.');
  const {c} = await openController();
  try {
    const take = soundingTake(), want = from => ({take, lane_ref: 'take-lane:torus/1', title: 'Take 1', from_frame: from});
    const playing = {playing: true, rate: 1};
    assert.equal(c.soundTake(want(0), playing), null, 'nothing to say while it renders');
    await until(() => c.reading.take_player.held_bytes === 48000 * 4, 'held');
    assert.equal(c.soundTake(want(0), playing), null, 'from its start it plays exactly as sealed: nothing to say');
    assert.equal(c.soundTake(want(240), playing), null, 'playing on says nothing');
    assert.equal(c.soundTake(want(30000), playing), takeResumesAt('Take 1', 30000, 48000), 'a seek into it says where it resumes');
    assert.equal(c.soundTake(want(30000), playing), null, 'once');
    c.soundTake(want(30000), {playing: false, rate: 1});
    assert.equal(c.soundTake(want(1200), playing), takeResumesAt('Take 1', 1200, 48000), 'played again past its start: said again');
  } finally { await c.dispose(); }
  const {c: d} = await openController();
  try {
    const forged = soundingTake({take_ref: 'sha256:forged', render: {...soundingTake().render, pcm_sha256: pcmSha(0.5, 48000)}});
    d.soundTake({take: forged, lane_ref: 'take-lane:torus/2', title: 'Take 2', from_frame: 0}, {playing: true, rate: 1});
    await until(() => d.reading.take_player.refusal !== null, 'refused once rendered');
    assert.ok(d.reading.take_player.refusal.endsWith(`). ${TAKE_NOT_PLAYED_RESUMES}`), d.reading.take_player.refusal);
  } finally { await d.dispose(); }
});

test('the plate plays what a sounding take struck, before what the live Torus sounds', async () => {
  const {torusPlayReading} = await import('../src/native-field/torusPlay.mjs');
  const voices = [{mode_ref: 'scene:logic/0', frequency_hz: 100}, {mode_ref: 'scene:logic/1', frequency_hz: 150}];
  const reading = {status: 'following', instrument: {acting: {voices}, torus_object: {sounding_hz: [440]}, struck: null},
    take_player: {sounding: {take_ref: 'sha256:take'}, struck: {at: 1, source: 'point', refs: ['scene:logic/1']}}};
  assert.deepEqual(torusPlayReading(reading).torus, {tonesHz: [150], silentBecause: null});
  assert.deepEqual(torusPlayReading({...reading, take_player: {sounding: null, struck: null}}).torus, {tonesHz: [440], silentBecause: null}, 'no take sounds: the live Torus');
});

test('the frame sounds the take its scene lays where the scene stands, auditions a lane, hands its sound to the engine, and no collision strikes under it', async () => {
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8');
  assert.match(app, /soundSceneTake\(rate\);/, 'each frame, at the scene\'s rate');
  const audition = app.slice(app.indexOf("case 'take-audition':"), app.indexOf("case 'take-sound':"));
  assert.match(audition, /takeAudition=command\.lane_ref===null\?null:\{sceneId:scene\(\)\.id,lane:command\.lane_ref\};/);
  // the lane auditioned on the presented Scene goes with the row's transport, so the frame reports it (take_player.audition)
  const sounds = app.slice(app.indexOf('function soundSceneTake('), app.indexOf('function soundSceneTake(') + 1200);
  assert.match(sounds, /const audition=takeAudition\?\.sceneId===id\?takeAudition\.lane:null;/);
  // a frame with no native view yet reads the takes laid as none, never a null it then reads from (tsc TS18047)
  assert.match(sounds, /const laid=takesLaid&&takesLaid\.view===view\?takesLaid:\(takesLaid=\{view,refs:new Set\(/);
  assert.match(sounds, /controller\.soundTake\(want,\{playing:scenePlaying&&!fieldPaused&&!document\.hidden&&!libraryOpen,rate,audition\},laid\.refs\)/);
  const sound = app.slice(app.indexOf("case 'take-sound':"), app.indexOf("case 'instrument':"));
  assert.match(sound, /return \{ok:true,render:nativeField\.controller\.takeSound\(command\.take_ref\)\};/);
  const field = await readFile(join(journeys, 'src/nativeField.ts'), 'utf8');
  const collide = field.slice(field.indexOf('const collide=('), field.indexOf('const hear=('));
  assert.match(collide, /if\(controller\.takeSounding\(\)\)return null;/, 'the take already holds what struck');
});

test('the take a scene sounds is the one its row sounds at the scene\'s sample: its audition, else its comp, else the latest laid', async () => {
  const {sceneTakeAt} = await bundle(join(journeys, 'src/sceneTransport.ts'), 'transport');
  const lane = n => ({layer_ref: `take-lane:torus/${n}`, title: `Take ${n}`, enabled: true, solo: false});
  const laid = (n, at) => ({take: sealedTake({take_ref: `sha256:take${n}`, frames: '96000'}), layer: n - 1, at_sample: String(at)});
  const performance = {sample_rate: 48000, layers: [lane(1), lane(2)], torus_takes: [laid(1, 48000), laid(2, 48000)],
    torus_comp: [{lane_ref: 'take-lane:torus/1', start_sample: '96000', end_sample: '120000'}]};
  const view = {bindings: {local: {scene_ref: 'scene:one'}}, document: {scenes: [{scene_ref: 'scene:one', performance}]}};
  const at = (seconds, audition = null) => { const take = sceneTakeAt(view, 'local', seconds, audition); return take && {ref: take.take.take_ref, lane: take.lane_ref, title: take.title, from: take.from_frame}; };
  assert.deepEqual(at(1.5), {ref: 'sha256:take2', lane: 'take-lane:torus/2', title: 'Take 2', from: 24000}, 'the latest laid');
  assert.deepEqual(at(2.25), {ref: 'sha256:take1', lane: 'take-lane:torus/1', title: 'Take 1', from: 60000}, 'the comp over its stretch');
  assert.deepEqual(at(1.5, 'take-lane:torus/1'), {ref: 'sha256:take1', lane: 'take-lane:torus/1', title: 'Take 1', from: 24000}, 'Audition in place of the main lane');
  assert.equal(at(0.5), null, 'before any take');
  assert.equal(sceneTakeAt(view, 'other', 1.5, null), null, 'a scene the kernel does not bind');
  assert.equal(sceneTakeAt(undefined, 'local', 1.5, null), null);
});
