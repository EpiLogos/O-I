import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coReferenced,
  createDisclosureSessionStore,
  techneSurfaceBinding,
} from '../src/techne/session.ts';
import { validateSession } from '../src/techne/contract.ts';

const SUBJECT = 'central:now:control:root:b417a7c3d37cd47c2762deee3224687d59db1a9015a322e9a8d7584b3947adf6';
const READING = 'ql.techne:reading:fixture:development-day@1';
const SOURCE = 'central:source:control:root:Control/user/day/2026-09-15/day.md';

const selection = (overrides = {}) => ({
  selection_ref: 'ql.techne:selection:s1',
  subject_ref: SUBJECT,
  reading_ref: READING,
  source_ref: SOURCE,
  instrument: 'canvas',
  agent_session_ref: 'agent-session/lesson',
  selection_standing: 'current',
  ...overrides,
});

test('setSelection opens the one current session; a new basis opens a new one', () => {
  const store = createDisclosureSessionStore();
  assert.equal(store.get(), null);
  const first = store.setSelection(selection());
  assert.equal(validateSession(first).valid, true);
  assert.equal(first.contract, 'ql.techne/v1');
  assert.ok(first.session_ref.startsWith('techne:disclosure-session:'));
  assert.equal(first.navigation.length, 0);
  // Same basis: the session persists, only the selection moves.
  const moved = store.setSelection(selection({ selection_ref: 'ql.techne:selection:s2' }));
  assert.equal(moved.session_ref, first.session_ref);
  assert.equal(moved.selection.selection_ref, 'ql.techne:selection:s2');
  // Different subject: a new session, empty navigation.
  const other = store.setSelection(selection({ subject_ref: 'central:source:control:root:Control/user/placement.json' }));
  assert.notEqual(other.session_ref, first.session_ref);
  assert.equal(other.navigation.length, 0);
});

test('canvas → timeline → expressions preserves subject, reading basis, source and agent ref, and records navigation', () => {
  const store = createDisclosureSessionStore();
  const canvas = store.setSelection(selection());
  const timeline = store.openInInstrument('timeline');
  const expressions = store.openInInstrument('expressions');
  assert.equal(validateSession(expressions).valid, true);
  assert.equal(expressions.subject_ref, canvas.subject_ref);
  assert.equal(expressions.reading_ref, canvas.reading_ref);
  assert.equal(expressions.selection.source_ref, SOURCE);
  assert.equal(expressions.selection.source_revision ?? null, canvas.selection.source_revision ?? null);
  assert.equal(expressions.selection.agent_session_ref, 'agent-session/lesson');
  assert.equal(coReferenced(canvas, expressions), true);
  assert.deepEqual(expressions.navigation, [
    { from_instrument: 'canvas', to_instrument: 'timeline', selection_ref: 'ql.techne:selection:s1' },
    { from_instrument: 'timeline', to_instrument: 'expressions', selection_ref: 'ql.techne:selection:s1' },
  ]);
});

test('opening the current instrument is a no-op; sessions on different subjects are not co-referenced', () => {
  const store = createDisclosureSessionStore();
  const canvas = store.setSelection(selection());
  assert.equal(store.openInInstrument('canvas'), canvas);
  assert.equal(canvas.navigation.length, 0);
  const other = createDisclosureSessionStore();
  const elsewhere = other.setSelection(selection({ subject_ref: 'central:source:control:root:Control/user/placement.json', reading_ref: 'ql.techne:reading:fixture:absent-facets@1' }));
  assert.equal(coReferenced(canvas, elsewhere), false);
});

test('the agent-session ref is carried verbatim, never minted', () => {
  const store = createDisclosureSessionStore();
  const carried = store.setSelection(selection({ agent_session_ref: null }));
  const opened = store.openInInstrument('journey');
  assert.equal(opened.selection.agent_session_ref, null);
  assert.equal(carried.session_ref.startsWith('techne:disclosure-session:'), true);
});

test('a selection that drifts from the contract is refused before it becomes observable', () => {
  const store = createDisclosureSessionStore();
  assert.throws(() => store.setSelection(selection({ reading_ref: undefined })), /reading_ref/);
  assert.throws(() => store.setSelection(selection({ instrument: 'map' })), /instrument/);
  assert.equal(store.get(), null);
});

test('subscribe observes every change; clear returns to austere rest', () => {
  const store = createDisclosureSessionStore();
  let observed = 0;
  const stop = store.subscribe(() => { observed += 1; });
  store.setSelection(selection());
  store.openInInstrument('palace');
  assert.equal(observed, 2);
  store.clear();
  assert.equal(store.get(), null);
  assert.equal(observed, 3);
  store.clear();
  assert.equal(observed, 3, 'clearing an empty store notifies nothing');
  stop();
  store.setSelection(selection());
  assert.equal(observed, 3);
});

test('the techne surface binding names the subject as its ref, so kernel focus (and the AgentLayer) co-references', () => {
  const store = createDisclosureSessionStore();
  const canvas = store.setSelection(selection());
  const binding = techneSurfaceBinding(canvas, 'surface-techne-1');
  assert.equal(binding.kind, 'techne');
  assert.equal(binding.ref, canvas.subject_ref, 'the binding ref is the session subject — surface_focus moves focus.subject to it');
  assert.deepEqual(binding.techne, {
    instrument: 'canvas',
    subjectRef: canvas.subject_ref,
    selectionRef: canvas.selection.selection_ref,
  });
  const opened = store.openInInstrument('timeline');
  const moved = techneSurfaceBinding(opened);
  assert.equal(moved.techne.instrument, 'timeline');
  assert.equal(moved.ref, canvas.subject_ref);
});
