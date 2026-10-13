// The Jankó keyboard's chord travels the host-command channel the instrument uses (ticket T-LIVE-JANKO-DEVICE): one validated `janko` command
// per chord, admitted while the frame is concealed as the instrument's edits are, and refused before the owner when malformed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, stageRequestMessage, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const chord = {command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35};

test('a chord reads as one exact janko command: distinct pitch classes 0–11, one amplitude in (0, 1]', () => {
  assert.deepEqual(readStageRequest(stageRequestMessage(4, chord)), {req: 4, command: chord});
  assert.deepEqual(readStageRequest(stageRequestMessage(5, {...chord, pitch_classes: [11]})).command.pitch_classes, [11]);
  assert.deepEqual(readStageRequest(stageRequestMessage(6, {...chord, amplitude: 1})).command.amplitude, 1);
});

test('a malformed chord is refused before anything is posted', () => {
  const refused = [
    {...chord, pitch_classes: []}, {...chord, pitch_classes: [12]}, {...chord, pitch_classes: [-1]}, {...chord, pitch_classes: [0.5]},
    {...chord, pitch_classes: [0, 0]}, {...chord, pitch_classes: Array.from({length: 13}, (_, i) => i % 12)}, {...chord, pitch_classes: '0'},
    {...chord, amplitude: 0}, {...chord, amplitude: 1.5}, {...chord, amplitude: NaN}, {...chord, action: 'hold'}, {...chord, velocity: 3},
  ];
  for (const command of refused) assert.equal(stageRequestMessage(1, command), null, JSON.stringify(command));
});

test('the host admits a chord while the frame is concealed, and the owner\'s answer settles it; other commands keep the presented gate', async t => {
  let presented = false;
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => presented});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  const sent = host.stageCommand(chord);
  const posted = (await wire.observe()).filter(d => d.command === 'janko').at(-1);
  assert.deepEqual(posted.pitch_classes, [0, 4, 7], 'posted while concealed');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'janko', req: posted.req, ok: false,
    error: 'No voice of this sky sounds at G'});
  assert.deepEqual(await sent, {ok: false, error: 'No voice of this sky sounds at G'}, 'the owner\'s refusal is named');
  assert.throws(() => host.stageCommand({command: 'view', action: 'guides'}), /concealed/);
  assert.throws(() => host.stageCommand({command: 'janko', action: 'play', pitch_classes: [], amplitude: 0.3}), /Unknown Expressions stage command/);
});
