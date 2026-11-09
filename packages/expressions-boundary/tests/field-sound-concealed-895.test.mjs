// The Field's Sound reaches the frame while the frame is concealed (O-I #747 round 895, item 5's walk). The Studio's Full opens in the pane
// that has focus, as a tab beside the field's own (expressions__studio.tsx Suite), so the frame stands concealed while the Field's Sound is
// pressed there. The Sound is the frame's mute (live-shell frameSound.ts setFieldSoundMuted, `{command: 'sound', muted}`), and a Solo
// elsewhere silences it by the same command: both reach the owner as the instrument's edits do. Before this the press was refused in the
// boundary's words, "The requested application is concealed", and the Field read Off over a scene that played unheard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';

test('the Field\'s Sound and a Solo\'s silence reach the owner while the frame is concealed; a view command keeps the presented gate', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'expressions', isPresented: () => false});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, soundMuted: true,
    nativeScene: {expression_ref: 'expression:tide', revision: 2, scene_ref: 'scene:swell'}}});
  assert.equal(host.isReady(), true);
  const on = host.stageCommand({command: 'sound', muted: false});
  const posted = (await wire.observe()).filter(d => d.command === 'sound').at(-1);
  assert.equal(posted?.muted, false, 'the Sound is posted while concealed');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'sound', req: posted.req, ok: true});
  assert.deepEqual(await on, {ok: true});
  const silenced = host.stageCommand({command: 'sound', silenced: true});
  const second = (await wire.observe()).filter(d => d.command === 'sound').at(-1);
  assert.equal(second?.silenced, true, 'a Solo\'s silence is posted while concealed');
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'sound', req: second.req, ok: true});
  assert.deepEqual(await silenced, {ok: true});
  assert.throws(() => host.stageCommand({command: 'view', action: 'guides'}), /concealed/, 'the presented gate still holds for the view');
});
