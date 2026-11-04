// O-I #855, the owner's half, across the channel: a Live take keeps the Torus it began on (`torus` checkpoint / restore), renders offline
// for Export Audio (`render-take`: the take's PCM as f32), and an instrument edit lands at a sample (`instrument` at_samples_elapsed). Each
// travels while the frame is concealed, as the strikes and the journal do, and the host settles with the answer exactly as it was read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, stageRequestMessage, stageReplyMessage, readStageTorusCheckpoint, STAGE_TORUS_CHECKPOINT_BYTES_MAX,
  STAGE_RENDER_FRAMES_MAX, STAGE_RENDER_ACTS_MAX, STAGE_INSTRUMENT_TIMED_KINDS, STAGE_EDIT_AHEAD_SECONDS, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const checkpoint = at => ({schema: 'ql.torus-checkpoint/v1', taken_at_samples: at, sample_rate: 48000, event: {m1: {lens12: 11}}, seeds: {tick12: 7},
  amplitudes: [[0.25, -0.5]], session: {steps: 12.5, notes: []}});

test('the boundary carries the Torus take vocabulary and its bounds', () => {
  assert.deepEqual(readStageTorusCheckpoint(checkpoint('48000')), checkpoint('48000'));
  assert.equal(readStageTorusCheckpoint({...checkpoint('48000'), schema: 'ql.m1-prime-session/v1'}), null);
  assert.deepEqual([STAGE_TORUS_CHECKPOINT_BYTES_MAX, STAGE_RENDER_FRAMES_MAX, STAGE_RENDER_ACTS_MAX, STAGE_EDIT_AHEAD_SECONDS], [1048576, 16777216, 16384, 30]);
  assert.ok(STAGE_INSTRUMENT_TIMED_KINDS.includes('torus') && !STAGE_INSTRUMENT_TIMED_KINDS.includes('level'));
  const take = {command: 'render-take', checkpoint: checkpoint('48000'), acts: [{action: 'strike', at_samples_elapsed: '48100', keys: [{row: 2, column: 3}], amplitude: 0.35}], frames: 4800};
  assert.deepEqual(readStageRequest(stageRequestMessage(3, take)), {req: 3, command: take});
  assert.equal(stageRequestMessage(3, {...take, frames: 0}), null);
});

test('the host keeps and sets the Torus, renders a take and makes an edit at a sample while the frame is concealed', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => false});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  const posted = async name => (await wire.observe()).filter(d => d.command === name).at(-1);

  const keep = {command: 'torus', action: 'checkpoint'};
  const keeping = host.stageCommand(keep);
  const asked = await posted('torus');
  assert.equal(asked.action, 'checkpoint', 'posted while concealed');
  await deliver(stageReplyMessage(asked.req, {ok: true, checkpoint: checkpoint('48000')}, keep));
  assert.deepEqual(await keeping, {ok: true, checkpoint: checkpoint('48000')});

  const restore = {command: 'torus', action: 'restore', checkpoint: checkpoint('48000')};
  const restoring = host.stageCommand(restore);
  const set = await posted('torus');
  assert.deepEqual(set.checkpoint, checkpoint('48000'), 'the checkpoint travels whole');
  await deliver(stageReplyMessage(set.req, {ok: true, landed_at_samples_elapsed: '52224'}, restore));
  assert.deepEqual(await restoring, {ok: true, landed_at_samples_elapsed: '52224'});

  const take = {command: 'render-take', checkpoint: checkpoint('48000'), acts: [], frames: 3};
  const rendering = host.stageCommand(take);
  const render = await posted('render-take');
  assert.equal(render.frames, 3);
  const rendered = {from_samples_elapsed: '48000', frames: 3, sample_rate: 48000, pcm: new Float32Array([0.5, -0.5, 0.25]), made_way: [], ended: checkpoint('48003')};
  await deliver(structuredClone(stageReplyMessage(render.req, {ok: true, render: rendered}, take)));
  const answer = await rendering;
  assert.ok(answer.ok && answer.render.pcm instanceof Float32Array, 'the PCM settles as f32');
  assert.deepEqual([...answer.render.pcm], [0.5, -0.5, 0.25]);
  assert.deepEqual(answer.render.ended, checkpoint('48003'));

  const edit = {command: 'instrument', edit: {kind: 'torus', edit: {polyphony: 4}}, at_samples_elapsed: '52800'};
  const editing = host.stageCommand(edit);
  const sent = await posted('instrument');
  assert.equal(sent.at_samples_elapsed, '52800', 'the sample travels exactly');
  await deliver(stageReplyMessage(sent.req, {ok: true, landed_at_samples_elapsed: '52992'}, edit));
  assert.deepEqual(await editing, {ok: true, landed_at_samples_elapsed: '52992'});
});
