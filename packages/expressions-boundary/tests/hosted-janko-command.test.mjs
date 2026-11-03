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

// O-I #853: the keyboard plays the Torus by keys — a strike of keys and their release travel the same concealed channel, and the
// strike's answer brings back the keys whose notes made way past Polyphony.
test('keys of the surface travel the concealed channel as a strike and a release, and the answer names the notes that made way', async t => {
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
  const struck = host.stageCommand({command: 'janko', action: 'strike', keys: [{row: 0, column: 42}, {row: 1, column: 43}], amplitude: 0.35});
  const strike = (await wire.observe()).filter(d => d.command === 'janko').at(-1);
  assert.deepEqual(strike.keys, [{row: 0, column: 42}, {row: 1, column: 43}]);
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'janko', req: strike.req, ok: true, made_way: [{row: 4, column: 40}]});
  assert.deepEqual(await struck, {ok: true, made_way: [{row: 4, column: 40}]});
  const released = host.stageCommand({command: 'janko', action: 'release', keys: [{row: 0, column: 42}]});
  const release = (await wire.observe()).filter(d => d.command === 'janko').at(-1);
  assert.equal(release.action, 'release');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'janko', req: release.req, ok: true});
  assert.deepEqual(await released, {ok: true});
  assert.throws(() => host.stageCommand({command: 'janko', action: 'strike', keys: [{row: 6, column: 0}], amplitude: 0.35}), /Unknown Expressions stage command/);
});
