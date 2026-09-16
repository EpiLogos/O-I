import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TECHNE_CONTRACT,
  validateReading,
  validateSession,
  validateActionRoute,
  validateActionReceipt,
} from '../src/techne/contract.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();

const developmentDay = readings.find((reading) => reading.subject.subject_ref.startsWith('central:now:'));
const representative = readings.find((reading) => reading.subject.subject_ref.startsWith('aikit:wiki:'));

const validSession = () => ({
  contract: TECHNE_CONTRACT,
  session_ref: 'techne:disclosure-session:test',
  subject_ref: developmentDay.subject.subject_ref,
  selection: {
    selection_ref: 'ql.techne:selection:test',
    subject_ref: developmentDay.subject.subject_ref,
    reading_ref: developmentDay.reading_ref,
    instrument: 'timeline',
  },
  instrument: 'timeline',
  reading_ref: developmentDay.reading_ref,
});

test('all three canonical conformance fixtures validate against the reading mirror', () => {
  assert.equal(readings.length, 3);
  for (const reading of readings) {
    const checked = validateReading(reading);
    assert.deepEqual(checked, { valid: true, errors: [] }, JSON.stringify(checked.errors));
    assert.equal(reading.contract, TECHNE_CONTRACT);
  }
});

test('absent facets are data, not errors: fixtures without ql/spatial/expressions validate', () => {
  for (const name of ['ql', 'spatial', 'expressions']) {
    assert.equal(developmentDay[name], undefined, `${name} should be absent from the development-day fixture`);
    assert.equal(validateReading({...developmentDay}).valid, true);
  }
  // ...and the representative fixture carries them, warranted.
  assert.ok(representative.ql.warrant.evidence_refs.length >= 1);
  assert.equal(representative.spatial[0].precision, 'approximate');
  assert.equal(validateReading(representative).valid, true);
});

test('a ql facet without a warrant is refused', () => {
  const mutated = structuredClone(representative);
  delete mutated.ql.warrant;
  const checked = validateReading(mutated);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('warrant')));
});

test('a ql warrant without evidence refs is refused', () => {
  const mutated = structuredClone(representative);
  mutated.ql.warrant.evidence_refs = [];
  const checked = validateReading(mutated);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('evidence')));
});

test('an unavailable instrument without a reason is refused', () => {
  const mutated = structuredClone(developmentDay);
  const place = mutated.disclosure.instruments.find((entry) => entry.instrument === 'place');
  assert.equal(place.available, false);
  delete place.reason;
  const checked = validateReading(mutated);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('unavailable instrument requires a reason')));
});

test('a temporal facet without any carrier is refused', () => {
  const mutated = structuredClone(developmentDay);
  for (const key of ['instant', 'interval', 'day_ref', 'now_ref', 'session_ref', 'run_ref']) delete mutated.temporal[0][key];
  const checked = validateReading(mutated);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('carries at least one of')));
});

test('unknown fields are refused — the schema keeps presentation state inexpressible', () => {
  const mutatedReading = structuredClone(developmentDay);
  mutatedReading.camera = { zoom: 3 };
  assert.ok(validateReading(mutatedReading).errors.some((error) => error.includes('camera')));
  const mutatedSession = validSession();
  mutatedSession.layout = { lanes: ['day', 'now'] };
  const checked = validateSession(mutatedSession);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('layout')));
});

test('a wrong contract tag is refused', () => {
  assert.ok(validateReading({...developmentDay, contract: 'ql.techne/v2'}).errors.some((error) => error.includes('contract')));
  assert.ok(validateSession({...validSession(), contract: 'something/else'}).errors.some((error) => error.includes('contract')));
});

test('a session whose subject differs from its selection subject is refused', () => {
  const mutated = validSession();
  mutated.selection.subject_ref = 'other:subject';
  const checked = validateSession(mutated);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some((error) => error.includes('must equal selection.subject_ref')));
});

test('a well-formed session validates, and selection standing follows the K9 discipline', () => {
  assert.equal(validateSession(validSession()).valid, true);
  const stale = validSession();
  stale.selection.selection_standing = 'stale';
  assert.equal(validateSession(stale).valid, true);
  const invented = validSession();
  invented.selection.selection_standing = 'fresh';
  assert.equal(validateSession(invented).valid, false);
  const minted = validSession();
  minted.selection.agent_session_ref = null;
  assert.equal(validateSession(minted).valid, true, 'agent_session_ref is nullable and never required');
});

test('action route and receipt validators mirror the session schema', () => {
  assert.equal(validateActionRoute({ action_ref: 'central.day.read', subject_ref: developmentDay.subject.subject_ref, input: { day_ref: 'central:day:control:root:2026-09-15' } }).valid, true);
  assert.equal(validateActionRoute({ subject_ref: developmentDay.subject.subject_ref }).valid, false);
  assert.equal(validateActionReceipt({ action_ref: 'central.day.read', native_owner: 'central/ctrl', routed: true, authority: 'registered-read-action', expected_effects: ['none — read only'] }).valid, true);
  assert.equal(validateActionReceipt({ action_ref: 'central.day.read', native_owner: 'central/ctrl' }).valid, false);
});
