import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readKnowledgeWholeRequest, KNOWLEDGE_WHOLE_CHANNEL, CHANNEL_VERSION} from '../src/index.ts';

// O-I #768: a scene's body can be a knowledge whole — a constellation of the wiki, the scene's source (DLW §16.5, §20.1). The frame
// reads the whole it places through one exact typed channel request; the boundary reads it exactly and refuses anything else by name
// before any owner is asked (as the wiki standing request, wiki-subject-standing.test.mjs). Transport-level: a real MessageChannel
// carries the replies.
const origin = 'http://127.0.0.1:8788';
const REQUEST = {ref: 'wiki:anchor:lived-in'};
const state = () => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}, selection: []});

function aperture(t, owners = {channels: {}}) {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  return {host, deliver, messages: wire.observe};
}

test('the boundary reads a knowledge-whole request exactly: one wiki ref, and nothing else', () => {
  assert.equal(KNOWLEDGE_WHOLE_CHANNEL, 'knowledge-whole');
  assert.deepEqual(readKnowledgeWholeRequest(REQUEST), REQUEST);
  for (const bad of [null, [], {}, {ref: ''}, {ref: 'Lived-in'}, {ref: 'wiki:'}, {ref: `wiki:${'x'.repeat(1024)}`}, {ref: 'wiki:a\u0007'},
    {...REQUEST, extra: 1}]) {
    assert.equal(readKnowledgeWholeRequest(bad), null, `refused: ${JSON.stringify(bad)}`);
  }
});

test('a knowledge-whole request reaches its owner once, and the owner reply comes back on the request id', async t => {
  let received = null;
  const reading = {requested_ref: REQUEST.ref, ref: REQUEST.ref, native_owner: 'wiki', title: 'The lived-in world'};
  const a = aperture(t, {channels: {[KNOWLEDGE_WHOLE_CHANNEL]: async request => {received = request; return reading;}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: state()});
  await a.deliver({v: CHANNEL_VERSION, kind: KNOWLEDGE_WHOLE_CHANNEL, req: 1, request: REQUEST});
  assert.deepEqual(received, REQUEST);
  const reply = (await a.messages()).find(d => d.kind === 'knowledge-whole-result' && d.req === 1);
  assert.deepEqual(reply, {v: 1, kind: 'knowledge-whole-result', req: 1, ok: true, data: reading});
});

test('a malformed knowledge-whole request is refused by name and no owner is asked', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {[KNOWLEDGE_WHOLE_CHANNEL]: async () => {calls++; return {};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: state()});
  await a.deliver({v: CHANNEL_VERSION, kind: KNOWLEDGE_WHOLE_CHANNEL, req: 2, request: {ref: 'notes.md'}});
  assert.equal(calls, 0);
  const reply = (await a.messages()).find(d => d.kind === 'knowledge-whole-result' && d.req === 2);
  assert.equal(reply.ok, false);
  assert.match(reply.error, /Malformed knowledge-whole request/);
});
