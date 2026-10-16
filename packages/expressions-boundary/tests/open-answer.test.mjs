import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';

// Lane D (PATH §7, 16 Oct): the frame's refusal of an Expression the host asked it to open travels to the host's caller.
// Seen natively by the lead (m4 build) and headless on the real ground (lane D's scripted door trace): Technē's door asked Scene "O I";
// the frame refused the open with a revision conflict, which it showed only as its own toast; the shell's ask waited 30 s and then
// said the frame "gave the shell no reason". The host's open now carries a req, as a stage command does, and resolves with the
// frame's own answer (host-command-result by req): ok once it stands on the Expression, or refused in its words.
//
// Channel: SCRIPTED over the real host on a real MessageChannel (as host.test.mjs); the frame's side of the answer (app.ts
// answerHostOpen) is the frame suite's (field-studies-journeys/tests/opened-work-saved.test.mjs). Not covered: the window.

const origin = 'http://127.0.0.1:8788';
const state = {hostMode: 'techne', sceneIndex: 0, sceneCount: 1};

function aperture(t, extra = {}) {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, ...extra});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  return {frame, host, deliver, messages: wire.observe};
}
const opens = async a => (await a.messages()).filter(row => row.kind === 'host-command' && (row.command === 'open-expression' || row.command === 'refresh-expression'));

test('an open carries a req, and resolves with the frame\'s refusal in its own words', async t => {
  const a = aperture(t);
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state});
  const answer = a.host.openExpression('expression:techne-m0.central.x', 'world.expressions', {refresh: true, lens: 'canvas'});
  const [sent] = await opens(a);
  assert.equal(sent.command, 'refresh-expression');
  assert.ok(Number.isSafeInteger(sent.req) && sent.req > 0, 'the open names the req its answer settles');
  const reason = 'revision_conflict: the native Expression changed; inspect its current basis before trying again';
  await a.deliver({v: 1, kind: 'host-command-result', req: sent.req, ok: false, error: reason});
  assert.deepEqual(await answer, {ok: false, error: reason});
});

test('an open the frame stands on resolves ok; a stale answer for another req settles nothing', async t => {
  const a = aperture(t);
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state});
  let settled = null;
  const answer = a.host.openExpression('expression:one', 'world.expressions').then(result => {settled = result; return result;});
  const [sent] = await opens(a);
  await a.deliver({v: 1, kind: 'host-command-result', req: sent.req + 100, ok: false, error: 'not this open'});
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(settled, null);
  await a.deliver({v: 1, kind: 'host-command-result', req: sent.req, ok: true});
  assert.deepEqual(await answer, {ok: true});
});

test('opens before readiness converge on the latest; the superseded one is answered so, at once', async t => {
  const a = aperture(t);
  const first = a.host.openExpression('expression:one', 'world.expressions');
  const second = a.host.openExpression('expression:two', 'world.expressions');
  assert.deepEqual(await first, {ok: false, error: 'A newer open superseded this one before the Expressions application was ready'});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state});
  const sent = await opens(a);
  assert.deepEqual(sent.map(row => row.ref), ['expression:two']);
  await a.deliver({v: 1, kind: 'host-command-result', req: sent[0].req, ok: true});
  assert.deepEqual(await second, {ok: true});
});

test('a reload or a disposal answers an open still waiting, never leaving it hung', async t => {
  const a = aperture(t);
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state});
  const sent = a.host.openExpression('expression:one', 'world.expressions');
  a.frame.dispatchEvent(new Event('load'));
  assert.deepEqual(await sent, {ok: false, error: 'The application reloaded before it answered this stage command'});
  const held = a.host.openExpression('expression:two', 'world.expressions');
  a.host.dispose();
  assert.deepEqual(await held, {ok: false, error: 'The hosted application was disposed'});
});
