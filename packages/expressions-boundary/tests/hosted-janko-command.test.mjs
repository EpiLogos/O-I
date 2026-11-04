// The Jankó keyboard's notes travel the host-command channel the instrument uses (ticket T-LIVE-JANKO-DEVICE): one validated `janko` command
// per act, admitted while the frame is concealed as the instrument's edits are, and refused before the owner when malformed. Since O-I #853
// every act names keys of the surface; the pitch-class chord (`action: 'play'`) the QL sitting's bell last struck is retired (O-I #855
// fold-in: the bell strikes its key on the one playing path, live-shell/ui tests/sitting-bell-keys.test.mjs). REPLACED here: "a chord
// reads as one exact janko command" (now: the chord is no command), "a malformed chord is refused" (now: a malformed strike of keys) and
// "the host admits a chord while the frame is concealed" (now: a strike of keys, and the chord refused before anything is posted).
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, stageRequestMessage, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const chord = {command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35};
const strike = {command: 'janko', action: 'strike', keys: [{row: 0, column: 42}, {row: 0, column: 44}, {row: 1, column: 45}], amplitude: 0.35};

test('a chord of pitch classes is no command: every note is a key of the surface, read exactly', () => {
  assert.equal(stageRequestMessage(4, chord), null);
  assert.equal(stageRequestMessage(4, {...chord, pitch_classes: [11], at_samples_elapsed: '48000'}), null);
  assert.equal(readStageRequest({v: CHANNEL_VERSION, kind: 'host-command', req: 4, ...chord}), null, 'nor read off the channel');
  assert.deepEqual(readStageRequest(stageRequestMessage(5, strike)), {req: 5, command: strike});
  assert.deepEqual(readStageRequest(stageRequestMessage(6, {...strike, amplitude: 1})).command.amplitude, 1);
});

test('a malformed strike of keys is refused before anything is posted', () => {
  const refused = [
    {...strike, keys: []}, {...strike, keys: [{row: 6, column: 0}]}, {...strike, keys: [{row: 0, column: -1}]}, {...strike, keys: [{row: 0.5, column: 0}]},
    {...strike, keys: [{row: 0, column: 1}, {row: 0, column: 1}]}, {...strike, keys: Array.from({length: 33}, (_, i) => ({row: 0, column: i}))},
    {...strike, keys: '0'}, {...strike, amplitude: 0}, {...strike, amplitude: 1.5}, {...strike, amplitude: NaN}, {...strike, action: 'hold'},
    {...strike, velocity: 3}, {...strike, pitch_classes: [0]},
  ];
  for (const command of refused) assert.equal(stageRequestMessage(1, command), null, JSON.stringify(command).slice(0, 80));
});

test('the host admits a strike while the frame is concealed, and the owner\'s answer settles it; other commands keep the presented gate', async t => {
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
  const sent = host.stageCommand(strike);
  const posted = (await wire.observe()).filter(d => d.command === 'janko').at(-1);
  assert.deepEqual(posted.keys, strike.keys, 'posted while concealed');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'janko', req: posted.req, ok: false,
    error: 'No voice of this sky sounds at G'});
  assert.deepEqual(await sent, {ok: false, error: 'No voice of this sky sounds at G'}, 'the owner\'s refusal is named');
  assert.throws(() => host.stageCommand({command: 'view', action: 'guides'}), /concealed/);
  assert.throws(() => host.stageCommand({...strike, keys: []}), /Unknown Expressions stage command/);
  assert.throws(() => host.stageCommand(chord), /Unknown Expressions stage command/, 'the retired chord is refused before anything is posted');
  assert.equal((await wire.observe()).filter(d => d.command === 'janko').length, 1, 'only the strike was posted');
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
