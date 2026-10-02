import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mapEventsWithCursor, opKey, wireBasis, decodeBasis} from '../src/contributions/factory/live/eventMap.ts';

const bytes = readFileSync(new URL('./fixtures/shared-direct-journal/native-turn.json', import.meta.url));
const journal = JSON.parse(bytes);
const source = JSON.parse(readFileSync(new URL('./fixtures/shared-direct-journal/source.json', import.meta.url), 'utf8'));
const session = source.world_ref + '/' + journal.agent_session;
const role = 'bo';
const scope = {
  cast: [{role, agent_ref: source.agent_ref, label: 'Bo', session_refs: [session], attempt_refs: []}],
  humanRefs: {[session]: source.world_ref + '/' + source.human_ref},
  replyRole: 'resultText', replyChars: 4096, messageRole: 'communication', worldRef: source.world_ref,
  phaseScenes: {working: 'work-passage', speaking: 'review', idle: 'continuation'},
};
const readings = {runRef: 'expression:shared-continuation-20260930'};
const journals = {encounter: {[session]: journal.events}, bounds: {[session]: {from: source.from, to: source.to}}};
const cursor = {performed: [], encounterAfter: {[session]: source.from - 1}};

test('recorded native Direct speech uses the Factory grammar with its own participant, scenes and complete text', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.excerpt_sha256);
  assert.equal(journal.agent_session, source.agent_session);
  assert.equal(journal.events.length, source.events);
  assert.ok(journal.events.every((event, i) => event.cursor >= source.from && event.cursor <= source.to && (!i || event.cursor > journal.events[i - 1].cursor)));
  const {ops} = mapEventsWithCursor(readings, journals, cursor, scope);
  const reply = journal.events.map(event => event.event?.event?.Signal?.kind).filter(signal => signal?.kind === 'agent-message-chunk').map(signal => signal.text).join('').trim();
  const text = ops.filter(op => op.operation === 'act_text');
  assert.equal(text.length, 1);
  assert.equal(text[0].role, 'resultText');
  assert.equal(text[0].text, reply, 'Actual source paragraphs survive in Expression material');
  assert.ok(reply.includes('\n\n') && Buffer.byteLength(reply) < 4096);
  const handoff = ops.find(op => op.scene === 'handoff');
  assert.equal(handoff.bindings.sender.agent_ref, scope.humanRefs[session]);
  assert.equal(handoff.bindings.recipient.agent_ref, source.agent_ref);
  assert.equal(handoff.bindings.communication.subject_ref, session + '#' + source.from);
  assert.equal(handoff.bindings.artifact, undefined, 'The native message does not acquire artifact identity');
  assert.ok(ops.some(op => op.scene === 'review'));
  assert.ok(ops.findIndex(op => op.scene === 'continuation') > ops.indexOf(text[0]), 'Returned speech precedes the terminal scene');
  assert.ok(ops.every(op => !op.role || op.operation === 'act_text' || op.role === role));
  assert.equal(new Set(ops.map(opKey)).size, ops.length);
  for (const op of ops) {
    const basis = decodeBasis(wireBasis(op.basis));
    assert.equal(basis.source, 'aikit-encounter');
    assert.equal(basis.journal.session, session);
    assert.ok(basis.journal.cursor >= source.from && basis.journal.cursor <= source.to);
  }
  assert.deepEqual(mapEventsWithCursor(readings, journals, cursor, scope).ops, ops, 'A later read maps the same native occurrences');
  assert.throws(() => mapEventsWithCursor(readings, {encounter: journals.encounter}, cursor, scope), /exact work bounds/);
});
