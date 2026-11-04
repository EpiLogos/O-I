// O-I #855, the owner's half, across the channel: a Live take keeps the sample each played act landed at. The shell reads the owner's
// performance journal (`performance-journal`, QL instrument-session.mjs journal(): `ql.instrument-performance-journal/v1`) from a sample
// on, and a strike's answer names the sample its act landed at (`landed_at_samples_elapsed`). Both travel while the frame is concealed,
// as the strikes and the audio clock do, and the host settles with the answer exactly as it was read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, stageRequestMessage, stageReplyMessage, stageJournalLanding, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const journal = {schema: 'ql.instrument-performance-journal/v1', instance_ref: 'ql:instance:live',
  acts: [{request_id: '9', operation: 'torus-play', command: {operation: 'torus-play', keys: [{row: 0, column: 42}], amplitude: [0.35, 0], at_samples_elapsed: '52800'},
    acknowledged: {generation: '14', samples_elapsed: '48000'}, kind: 'act'}],
  advances: {blocks: 3, frames: 1536, first_samples_elapsed: '46464', last_samples_elapsed: '48000'}};

test('the journal is asked for whole or from an exact sample, and the boundary names where a journaled act landed', () => {
  assert.deepEqual(readStageRequest(stageRequestMessage(3, {command: 'performance-journal'})), {req: 3, command: {command: 'performance-journal'}});
  assert.deepEqual(readStageRequest(stageRequestMessage(3, {command: 'performance-journal', from_samples_elapsed: '48000'})),
    {req: 3, command: {command: 'performance-journal', from_samples_elapsed: '48000'}});
  assert.equal(stageRequestMessage(3, {command: 'performance-journal', from_samples_elapsed: 48000}), null, 'a cursor is exact text');
  assert.equal(stageJournalLanding(journal.acts[0]), '52800');
});

test('the host reads the journal while the frame is concealed, and a strike settles with the sample it landed at', async t => {
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
  const read = host.stageCommand({command: 'performance-journal', from_samples_elapsed: '48000'});
  const posted = (await wire.observe()).filter(d => d.command === 'performance-journal').at(-1);
  assert.ok(posted, 'posted while concealed');
  assert.equal(posted.from_samples_elapsed, '48000', 'the cursor travels exactly');
  await deliver(stageReplyMessage(posted.req, {ok: true, journal}, {command: 'performance-journal'}));
  assert.deepEqual(await read, {ok: true, journal}, 'the journal as the frame answered it');
  const keys = {command: 'janko', action: 'strike', keys: [{row: 1, column: 43}], amplitude: 0.35, at_samples_elapsed: '52800'};
  const struck = host.stageCommand(keys);
  const sent = (await wire.observe()).filter(d => d.command === 'janko').at(-1);
  await deliver(stageReplyMessage(sent.req, {ok: true, made_way: [{row: 0, column: 42}], landed_at_samples_elapsed: '52800'}, keys));
  assert.deepEqual(await struck, {ok: true, made_way: [{row: 0, column: 42}], landed_at_samples_elapsed: '52800'}, 'every part of the answer');
  const points = {command: 'strike-at', points: [{theta: 0.5, phi: 1}], amplitude: 0.35};
  const touched = host.stageCommand(points);
  const at = (await wire.observe()).filter(d => d.command === 'strike-at').at(-1);
  await deliver(stageReplyMessage(at.req, {ok: true, landed_at_samples_elapsed: '48000'}, points));
  assert.deepEqual(await touched, {ok: true, landed_at_samples_elapsed: '48000'});
});
