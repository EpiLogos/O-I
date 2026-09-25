// Factory re-entry continuity (FACTORY-AGENCY §1: re-entry restores from
// canonical work refs plus presentation state) against the desk store's ONE
// held selection — the store the Run | Agents | Context planes read.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-desk-reentry.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const desk = await import('../src/contributions/factory/desk/deskStore.ts');

const entry = (statePath, projectRef, runRef, key) => ({
  key,
  card: {key, source: {statePath, projectRef}},
  run: {runRef},
  state: 'read',
});
const reading = () => ({
  scopeKey: 'all',
  status: 'read',
  refused: [],
  runs: {
    's1\u0000p1\u0000run-a': entry('s1', 'p1', 'run-a', 's1\u0000p1\u0000run-a'),
    's2\u0000p2\u0000run-b': entry('s2', 'p2', 'run-b', 's2\u0000p2\u0000run-b'),
  },
});

test('the held locator re-establishes by exact ref identity, never a label match', () => {
  const runs = reading().runs;
  assert.equal(desk.deskKeyOfLocator(runs, {statePath: 's2', projectRef: 'p2', runRef: 'run-b'}), 's2\u0000p2\u0000run-b');
  assert.equal(desk.deskKeyOfLocator(runs, {statePath: 's2', projectRef: 'p2', runRef: 'run-x'}), undefined, 'an unknown run ref is no match');
  assert.equal(desk.deskKeyOfLocator(runs, {statePath: 's2', projectRef: 'pX', runRef: 'run-b'}), undefined, 'an unknown project ref is no match');
});

test('re-entry restores the held selection once the owner answers for it; missing runs stay neutral', () => {
  const held = {statePath: 's1', projectRef: 'p1', runRef: 'run-a'};
  // A locator the reading does not contain re-establishes nothing — the
  // sidebar shows its honest neutral state, never a fabricated subject.
  desk.reestablishHeldSelection(held, {'s9\u0000p9\u0000run-z': entry('s9', 'p9', 'run-z', 's9\u0000p9\u0000run-z')});
  assert.equal(desk.peekSelectedRun(), undefined, 'missing run: neutral, not guessed');
  // Once a reading contains the held run, it answers as the subject.
  assert.equal(desk.reestablishHeldSelection(held, reading().runs), true);
  assert.equal(desk.peekSelectedRun(), 's1\u0000p1\u0000run-a');
  // A selection already chosen this session is never silently re-pointed.
  assert.equal(desk.reestablishHeldSelection({statePath: 's2', projectRef: 'p2', runRef: 'run-b'}, reading().runs), false);
  assert.equal(desk.peekSelectedRun(), 's1\u0000p1\u0000run-a');
  // No held locator re-establishes nothing.
  assert.equal(desk.reestablishHeldSelection(undefined, reading().runs), false);
});

test('opening a run page selects and holds it; the store degrades without storage', () => {
  desk.__setDeskReadingForTest(reading());
  desk.openRunPage('s2\u0000p2\u0000run-b');
  assert.equal(desk.peekSelectedRun(), 's2\u0000p2\u0000run-b');
  // In this node harness there is no localStorage: persistence degrades to a
  // no-op and the selection still holds — the same relation the browser
  // exercises with the canonical refs written beside it.
  assert.ok(desk.deskKeyOfLocator(reading().runs, {statePath: 's2', projectRef: 'p2', runRef: 'run-b'}));
  desk.__setDeskReadingForTest(undefined);
});
