import test from 'node:test';
import assert from 'node:assert/strict';
import {
  memberSelection,
  memberSelectionRef,
  relationSelection,
  relationSelectionRef,
  wholeSelection,
  wholeSelectionRef,
} from '../src/techne/canvas/selection.ts';
import { validateSelection } from '../src/techne/contract.ts';
import { coReferenced, createDisclosureSessionStore } from '../src/techne/session.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const developmentDay = readings.find((reading) => reading.subject.subject_ref.startsWith('central:now:'));
const SUBJECT = developmentDay.subject.subject_ref;

const openSelection = () => ({
  selection_ref: 'ql.techne:selection:open',
  subject_ref: SUBJECT,
  reading_ref: developmentDay.reading_ref,
  source_ref: 'central:source:control:root:Control/user/day/2026-09-15/day.md',
  source_revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325',
  agent_session_ref: 'agent-session/zcode-session-2026-09-16-l5-techne-execution',
  selection_standing: 'current',
  instrument: 'canvas',
});

test('a member click refocuses the disclosure: focus_refs carry the member, subject and reading_ref stay byte-identical', () => {
  const current = openSelection();
  const before = structuredClone(current);
  const readingBefore = structuredClone(developmentDay);
  const member = developmentDay.whole.member_refs[1];

  const updated = memberSelection(developmentDay, current, member);

  assert.equal(updated.subject_ref, current.subject_ref, 'the subject is the reading subject, byte-identical');
  assert.equal(updated.reading_ref, current.reading_ref, 'the reading basis is byte-identical');
  assert.equal(updated.selection_ref, `ql.techne:selection:${SUBJECT}:${member}`, 'the derived selection_ref is stable and carries the refs verbatim');
  assert.equal(updated.selection_ref, memberSelectionRef(SUBJECT, member));
  assert.deepEqual(updated.focus_refs, [member]);
  assert.equal(updated.instrument, 'canvas');
  assert.equal(validateSelection(updated).valid, true, 'the produced selection satisfies the contract');
  assert.deepEqual(current, before, 'the current selection is not mutated');
  assert.deepEqual(developmentDay, readingBefore, 'the reading is not mutated');
});

test('the source basis rides over from the current selection, verbatim', () => {
  const current = openSelection();
  const updated = memberSelection(developmentDay, current, developmentDay.whole.member_refs[0]);
  assert.equal(updated.source_ref, current.source_ref);
  assert.equal(updated.source_revision, current.source_revision);
  assert.equal(updated.agent_session_ref, current.agent_session_ref, 'the agent-session ref is carried, never minted or rewritten');
  assert.equal(updated.selection_standing, current.selection_standing);
  assert.equal(updated.snapshot_revision, developmentDay.snapshot.revision);
});

test('a relation click focuses its two endpoints and derives a distinct, stable selection_ref', () => {
  const current = openSelection();
  const relation = developmentDay.whole.relations[0];
  const updated = relationSelection(developmentDay, current, relation);

  assert.deepEqual(updated.focus_refs, [relation.from_ref, relation.to_ref]);
  assert.equal(updated.selection_ref, relationSelectionRef(SUBJECT, relation));
  assert.equal(updated.selection_ref, `ql.techne:selection:${SUBJECT}:${relation.from_ref}~${relation.relation}~${relation.to_ref}`);
  assert.notEqual(updated.selection_ref, memberSelectionRef(SUBJECT, relation.from_ref), 'a relation click is distinguishable from a member click');
  assert.equal(validateSelection(updated).valid, true);
  // Same input → same ref (the derived ref is stable, not minted).
  assert.equal(relationSelection(developmentDay, null, relation).selection_ref, updated.selection_ref);

  // Degenerate relation (from === to): one focus ref, no duplicates.
  const loop = relationSelection(developmentDay, null, { ...relation, to_ref: relation.from_ref });
  assert.deepEqual(loop.focus_refs, [relation.from_ref]);
});

test('member→whole navigation preserves co-reference: the session before and after is the same disclosure', () => {
  const store = createDisclosureSessionStore();
  const open = store.setSelection(openSelection());
  const memberClick = store.setSelection(memberSelection(developmentDay, open.selection, developmentDay.whole.member_refs[0]));
  const hop = store.setSelection(wholeSelection(developmentDay, memberClick));

  assert.equal(coReferenced(open, memberClick), true, 'a member click keeps the session co-referenced');
  assert.equal(coReferenced(memberClick, hop), true, 'the whole hop keeps the session co-referenced');
  assert.deepEqual(hop.selection.focus_refs, [developmentDay.whole.whole_ref]);
  assert.equal(hop.selection.selection_ref, wholeSelectionRef(SUBJECT, developmentDay.whole.whole_ref));
  assert.equal(hop.subject_ref, open.subject_ref);
  assert.equal(hop.reading_ref, open.reading_ref);
  assert.equal(validateSelection(hop.selection).valid, true);

  // And the co-referenced session still projects into another instrument.
  const timeline = store.openInInstrument('timeline');
  assert.equal(coReferenced(hop, timeline), true);
  assert.equal(timeline.subject_ref, open.subject_ref);
});

test('the whole hop is refused when the reading discloses no whole; empty refs are refused', () => {
  const { whole, ...subjectOnly } = structuredClone(developmentDay);
  assert.throws(() => wholeSelection(subjectOnly, null), /discloses no whole/);
  assert.throws(() => memberSelection(developmentDay, null, '   '), /member ref/);
  assert.throws(() => relationSelection(developmentDay, null, { relation: '', from_ref: 'a', to_ref: 'b' }), /from_ref and to_ref/);
});
