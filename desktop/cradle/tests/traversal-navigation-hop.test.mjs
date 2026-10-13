// Lane-2 T20 (one history) — the traversal hop is a session navigation hop.
//   contract  a hop without `kind` is still the instrument hop (stored sessions stay valid); a traversal hop
//             validates with closed keys and its subject; anything else is refused by name.
//   store     recordTraversal appends without changing the instrument, refuses a subject or selection that is
//             not the session's (byte-equal law) by name, and notifies only when it records.
//   trail     the trail is read from the session's own navigation: the traversal hops since the origin event.
//   route     the owner's compare-and-set writes a traversal hop through the same path as the time writes.
// The owner (expressions-boundary) and the session store are bundled once, so the route and the store are one instance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const cradle = resolve(fileURLToPath(new URL('..', import.meta.url)));
let api;
let temporary;
test.before(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'oi-traversal-hop-'));
  const out = join(temporary, 'traversal-hop.mjs');
  await build({
    stdin: {
      contents: [
        `export {validateSession} from ${JSON.stringify(resolve(cradle, 'src/techne/contract.ts'))};`,
        `export {createDisclosureSessionStore} from ${JSON.stringify(resolve(cradle, 'src/techne/session.ts'))};`,
        `export {groundSelection} from ${JSON.stringify(resolve(cradle, 'src/techne/m0m5/reading.ts'))};`,
        `export {provingReading, PROVING_EXPRESSION, PROVING_SCENE_GROUND} from ${JSON.stringify(resolve(cradle, 'src/techne/m0m5/journey/proving-reading.ts'))};`,
        `export * from ${JSON.stringify(resolve(cradle, 'src/techne/m0m5/timeline/navigationIdentity.ts'))};`,
        `export {createNativeTimeWindowOwner} from ${JSON.stringify(resolve(cradle, '../../packages/expressions-boundary/src/timeWindow.ts'))};`,
      ].join('\n'),
      resolveDir: cradle,
    },
    bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent',
  });
  api = await import(`${out}?t=${Date.now()}`);
  ({validateSession, createDisclosureSessionStore, groundSelection, provingReading, traversalHopOf, trailOfNavigation, createNativeTimeWindowOwner, PROVING_EXPRESSION, PROVING_SCENE_GROUND} = api);
});
test.after(async () => {
  if (temporary) await rm(temporary, {recursive: true, force: true});
});
let validateSession, createDisclosureSessionStore, groundSelection, provingReading, traversalHopOf, trailOfNavigation, createNativeTimeWindowOwner, PROVING_EXPRESSION, PROVING_SCENE_GROUND;

const EVENT = 'ql.techne:facet:tb0:authored';
const RELATION = 'rel:native:causes:1';
const PLACE = 'place:fixture:royal-observatory-greenwich';

function opened() {
  const reading = provingReading();
  const store = createDisclosureSessionStore();
  const session = store.setSelection(groundSelection(reading, 'timeline'));
  return {reading, store, session};
}

const withNavigation = (session, navigation) => ({...structuredClone(session), navigation});

test('a hop without kind is still the instrument hop, so a stored session stays valid', () => {
  const {session} = opened();
  const old = withNavigation(session, [{from_instrument: 'canvas', to_instrument: 'timeline', selection_ref: session.selection.selection_ref}]);
  assert.equal(validateSession(old).valid, true, validateSession(old).errors.join('; '));
});

test('a traversal hop validates with its subject and selection carried by ref', () => {
  const {session} = opened();
  const hop = {kind: 'traversal', instrument: 'timeline', step: 'relation', ref: RELATION,
    subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref};
  assert.equal(validateSession(withNavigation(session, [hop])).valid, true, validateSession(withNavigation(session, [hop])).errors.join('; '));
});

test('a traversal hop with unknown keys, an unknown step, a foreign subject or a bad instrument is refused by name', () => {
  const {session} = opened();
  const base = {kind: 'traversal', instrument: 'timeline', step: 'relation', ref: RELATION,
    subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref};
  const refused = hop => validateSession(withNavigation(session, [hop]));
  const extra = refused({...base, camera: {centerYear: 1}});
  assert.equal(extra.valid, false);
  assert.match(extra.errors.join(' '), /unknown field "camera"/);
  const step = refused({...base, step: 'sideways'});
  assert.equal(step.valid, false);
  assert.match(step.errors.join(' '), /step/);
  const subject = refused({...base, subject_ref: 'subject:elsewhere'});
  assert.equal(subject.valid, false);
  assert.match(subject.errors.join(' '), /subject_ref/);
  const instrument = refused({...base, instrument: 'orrery'});
  assert.equal(instrument.valid, false);
  assert.match(instrument.errors.join(' '), /instrument/);
  const kind = refused({...base, kind: 'teleport'});
  assert.equal(kind.valid, false);
  assert.match(kind.errors.join(' '), /kind/);
});

test('recordTraversal appends the hop, keeps the instrument, notifies once, and refuses a foreign subject or selection by name', () => {
  const {reading, store, session} = opened();
  let notified = 0;
  store.subscribe(() => notified++);
  const hop = traversalHopOf(session, 'relation', RELATION);
  const recorded = store.recordTraversal(hop);
  assert.equal(recorded.navigation.length, 1);
  assert.deepEqual(recorded.navigation[0], hop);
  assert.equal(recorded.instrument, 'timeline');
  assert.equal(recorded.application_cut, session.application_cut);
  assert.equal(recorded.subject_ref, session.subject_ref);
  assert.equal(notified, 1);
  const before = JSON.stringify(store.get());
  assert.throws(() => store.recordTraversal({...hop, subject_ref: 'subject:elsewhere'}), /subject_ref.*byte-equal|subject_ref/);
  assert.throws(() => store.recordTraversal({...hop, selection_ref: 'ql.techne:selection:other'}), /selection_ref/);
  assert.throws(() => store.recordTraversal({...hop, instrument: 'place'}), /instrument/);
  assert.equal(JSON.stringify(store.get()), before, 'a refused hop changes nothing');
  assert.equal(notified, 1, 'a refused hop does not notify');
  assert.equal(reading.subject.subject_ref, session.subject_ref);
  assert.throws(() => createDisclosureSessionStore().recordTraversal(hop), /No DisclosureSession/);
});

test('the hop the model builds carries the session subject and selection byte-equal, and the trail is read from the navigation', () => {
  const {store, session} = opened();
  const steps = [
    traversalHopOf(session, 'event', EVENT),
    traversalHopOf(session, 'relation', RELATION),
    traversalHopOf(session, 'endpoint', PLACE),
  ];
  for (const hop of steps) {
    assert.equal(hop.subject_ref, session.subject_ref);
    assert.equal(hop.selection_ref, session.selection.selection_ref);
    assert.equal(hop.instrument, 'timeline');
    store.recordTraversal(hop);
  }
  assert.deepEqual(trailOfNavigation(store.get().navigation), {origin: EVENT, steps: [{step: 'relation', ref: RELATION}, {step: 'endpoint', ref: PLACE}]});
  store.recordTraversal(traversalHopOf(session, 'back', EVENT));
  assert.deepEqual(trailOfNavigation(store.get().navigation), {origin: EVENT, steps: []});
});

test('an instrument hop between traversal hops does not break the trail, and a new event starts a new trail', () => {
  const {store, session} = opened();
  store.recordTraversal(traversalHopOf(session, 'event', EVENT));
  store.recordTraversal(traversalHopOf(session, 'relation', RELATION));
  store.openInInstrument('place');
  assert.deepEqual(trailOfNavigation(store.get().navigation), {origin: EVENT, steps: [{step: 'relation', ref: RELATION}]});
  store.openInInstrument('timeline');
  store.recordTraversal(traversalHopOf(store.get(), 'event', PLACE));
  assert.deepEqual(trailOfNavigation(store.get().navigation), {origin: PLACE, steps: []});
});

test('the owner route writes a traversal hop through the compare-and-set and refuses a drifted session by name', () => {
  // The owner admits a reading against its declared Expression bindings; this reading declares none, so the route's own
  // basis (an `expression:` ref the owner accepts) admits without inventing a binding.
  const reading = structuredClone(provingReading());
  delete reading.expressions;
  const store = createDisclosureSessionStore();
  const basis = {expression_ref: 'expression:traversal-route', revision: 1, scene_ref: 'scene:traversal-route'};
  const abort = new AbortController();
  const context = {mode: 'techne', bindingId: 'traversal-route-test', epoch: 1, signal: abort.signal,
    state: {hostMode: 'techne', nativeScene: structuredClone(basis)}, current: () => true};
  const owner = createNativeTimeWindowOwner({store});
  owner.admit(basis, reading, context);
  const read = owner.handle({...basis, reading_ref: reading.reading_ref, instrument: 'timeline', operation: 'read'}, context);
  const hop = traversalHopOf(read.session, 'relation', RELATION);
  const request = {...basis, reading_ref: reading.reading_ref, instrument: 'timeline', operation: 'traversal',
    expected_session_ref: read.session.session_ref, expected_selection: structuredClone(read.session.selection),
    expected_window: structuredClone(read.axis.window), hop};
  const written = owner.handle(request, context);
  assert.equal(written.session.navigation.length, 1);
  assert.deepEqual(written.session.navigation[0], hop);
  assert.equal(store.get().navigation.length, 1, 'the owner recorded the hop on the one shared session');
  store.setTimeWindow({from: '2020-01-01T00:00:00+00:00', to: null});
  assert.throws(() => owner.handle({...request, hop: traversalHopOf(store.get(), 'back', EVENT)}, context), /changed; read it before recording traversal/);
  assert.equal(store.get().navigation.length, 1, 'a drifted write records nothing');
});
