// lane-5 T9: journey presence. The journey records the position the author stands on, and a return
// discloses its basis against the reading now disclosed: current (restored silently), field-advanced
// (shown once, with the new revision), stale (dropped, never restored as if current). A corrupt or
// unavailable store degrades to no presence and no error. Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileJourneyPresence, savedJourneyPosition, recordJourneyPosition, FIELD_ADVANCED_NOTICE, STALE_NOTICE} from '../build/journeyPresence.js';

const KEY = 'oi-cradle.techne-journey.presence.v1';
const EXPRESSION = 'oi.expression:probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;

function reading(overrides = {}) {
  return {
    contract: 'ql.techne/v1',
    reading_ref: 'ql.techne:reading:probe',
    snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: EXPRESSION, native_owner: 'oi.cradle.kernel', kind: 'expression-scene'},
    ...overrides,
  };
}

function memoryStorage(seed) {
  const map = new Map(seed === undefined ? [] : [[KEY, seed]]);
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function savedEntry(storage) {
  return JSON.parse(storage.map.get(KEY) ?? 'null')?.[EXPRESSION];
}

function presenceAt(scene_ref, overrides = {}) {
  return {
    schema: 'ql.techne-journey-presence/v1',
    subject_ref: EXPRESSION,
    reading_ref: 'ql.techne:reading:probe',
    snapshot_revision: 'rev-1',
    expression_ref: EXPRESSION,
    scene_ref,
    ...overrides,
  };
}

test('T9: a first visit records the position and discloses nothing', () => {
  const storage = memoryStorage();
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(result.standing, 'none');
  assert.equal(result.notice, undefined);
  assert.deepEqual(savedEntry(storage), presenceAt(ONE));
});

test('T9: a return to the same reading and revision restores the saved position with no notice', () => {
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO)}));
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(result.standing, 'current');
  assert.equal(result.notice, undefined);
  assert.equal(result.presence.scene_ref, TWO, 'the saved scene ref rides verbatim');
});

test('T9: a field that moved while away is disclosed once, then the new revision is recorded', () => {
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO, {snapshot_revision: 'rev-0'})}));
  const first = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: TWO, storage});
  assert.equal(first.standing, 'field-advanced');
  assert.equal(first.notice, FIELD_ADVANCED_NOTICE);
  const second = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: TWO, storage});
  assert.equal(second.standing, 'current');
  assert.equal(second.notice, undefined, 'the banner shows once, against the revision now recorded');
});

test('T9: presence for another reading is stale: disclosed, dropped, and never restored as current', () => {
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO, {reading_ref: 'ql.techne:reading:other'})}));
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(result.standing, 'stale');
  assert.equal(result.notice, STALE_NOTICE);
  assert.equal(result.presence, undefined, 'a stale position is not handed back for restoring');
  assert.equal(savedEntry(storage).reading_ref, 'ql.techne:reading:probe', 'the stale entry is replaced by the current position');
});

test('T9: a corrupt payload degrades to no presence and no error', () => {
  const storage = memoryStorage('{not json');
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(result.standing, 'none');
  assert.equal(result.presence, undefined);
  assert.equal(result.notice, undefined);
});

test('T9: a drifted entry is dropped, not repaired into a guess', () => {
  const drifted = {...presenceAt(TWO), schema: 'ql.techne-journey-presence/v0'};
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: drifted}));
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(result.standing, 'none');
  assert.equal(result.presence, undefined);
});

test('T9: an unavailable store opens with no presence and no error', () => {
  const throwing = {
    getItem() { throw new Error('SecurityError: storage is blocked'); },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  const result = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage: throwing});
  assert.equal(result.standing, 'none');
  assert.equal(result.notice, undefined);
});

test('T9: the stored presence holds refs and presentation values only, never a reading or a scene object', () => {
  const storage = memoryStorage();
  reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.deepEqual(Object.keys(savedEntry(storage)).sort(), ['expression_ref', 'reading_ref', 'scene_ref', 'schema', 'snapshot_revision', 'subject_ref']);
});

test('T9: a Scene the strip moved to is recorded without disclosing, and a pending field move is still disclosed on the next load', () => {
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO, {snapshot_revision: 'rev-0'})}));
  recordJourneyPosition({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.deepEqual(savedEntry(storage), presenceAt(ONE, {snapshot_revision: 'rev-0'}), 'the scene moves, the revision it was saved against stays');
  const next = reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(next.standing, 'field-advanced');
  assert.equal(next.notice, FIELD_ADVANCED_NOTICE);
});

test('T9: a recorded Scene on a reading the author never saved takes the current basis, and a stale entry is never restored', () => {
  const storage = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO, {reading_ref: 'ql.techne:reading:other'})}));
  assert.deepEqual(savedJourneyPosition({reading: reading(), storage}), {standing: 'stale'});
  recordJourneyPosition({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.deepEqual(savedEntry(storage), presenceAt(ONE));
});

test('T9: a restore hands back the saved position only when it is current, and never writes', () => {
  const current = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO)}));
  const before = current.map.get(KEY);
  const result = savedJourneyPosition({reading: reading(), storage: current});
  assert.equal(result.standing, 'current');
  assert.equal(result.presence.scene_ref, TWO);
  assert.equal(current.map.get(KEY), before, 'reading the saved position writes nothing');
  const moved = memoryStorage(JSON.stringify({[EXPRESSION]: presenceAt(TWO, {snapshot_revision: 'rev-0'})}));
  assert.deepEqual(savedJourneyPosition({reading: reading(), storage: moved}), {standing: 'field-advanced'});
  assert.deepEqual(savedJourneyPosition({reading: reading(), storage: memoryStorage()}), {standing: 'none'});
});
