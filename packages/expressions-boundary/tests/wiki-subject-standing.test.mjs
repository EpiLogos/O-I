import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readWikiSubjectStandingRequest, WIKI_SUBJECT_STANDING_CHANNEL, CHANNEL_VERSION} from '../src/index.ts';

// lane-3 E21: the frame's wiki standing request is one exact typed channel request. The boundary reads it exactly and
// refuses anything else by name before any owner is asked. Transport-level: a real MessageChannel carries the replies.
const origin = 'http://127.0.0.1:8788';
const REQUEST = {subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:kept', revision: 3};
const state = () => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'},
  selection: [{id: 'entity:one', name: 'A real selection reading'}]});

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

test('the boundary reads a standing request exactly and refuses every other shape by name', () => {
  assert.equal(WIKI_SUBJECT_STANDING_CHANNEL, 'wiki-subject-standing');
  assert.deepEqual(readWikiSubjectStandingRequest(REQUEST), REQUEST);
  for (const bad of [null, [], {...REQUEST, revision: 0}, {...REQUEST, revision: 1.5}, {...REQUEST, expression_ref: 'expression'},
    {...REQUEST, subject_ref: ''}, {...REQUEST, subject_ref: 'x'.repeat(513)}, {subject_ref: REQUEST.subject_ref}]) {
    assert.equal(readWikiSubjectStandingRequest(bad), null, `refused: ${JSON.stringify(bad)}`);
  }
});

test('a standing request reaches its owner once, and the owner reply comes back on the request id', async t => {
  let received = null;
  const a = aperture(t, {channels: {[WIKI_SUBJECT_STANDING_CHANNEL]: async request => {received = request; return {rows: []};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: state()});
  await a.deliver({v: CHANNEL_VERSION, kind: WIKI_SUBJECT_STANDING_CHANNEL, req: 1, request: REQUEST});
  assert.deepEqual(received, REQUEST);
  const reply = (await a.messages()).find(d => d.kind === 'wiki-subject-standing-result' && d.req === 1);
  assert.deepEqual(reply, {v: 1, kind: 'wiki-subject-standing-result', req: 1, ok: true, data: {rows: []}});
});

test('a malformed standing request is refused by name and no owner is asked', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {[WIKI_SUBJECT_STANDING_CHANNEL]: async () => {calls++; return {rows: []};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: state()});
  await a.deliver({v: CHANNEL_VERSION, kind: WIKI_SUBJECT_STANDING_CHANNEL, req: 2, request: {...REQUEST, revision: 0}});
  assert.equal(calls, 0);
  const reply = (await a.messages()).find(d => d.kind === 'wiki-subject-standing-result' && d.req === 2);
  assert.equal(reply.ok, false);
  assert.match(reply.error, /Malformed wiki-subject-standing request/);
});
