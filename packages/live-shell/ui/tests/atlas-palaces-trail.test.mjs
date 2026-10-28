// lane-5 palace seams A and B, moved from the frame's field-studies-journeys/tests/palace-open-route.test.mjs (T-PALACES-ONTO-ATLAS).
// The frame recorded its trail step through the boundary's palace route (packages/expressions-boundary/src/timeWindow.ts palaceHop,
// reached by the retired palaceHop.ts over the techne-time-window channel); the atlas records it on the shared session directly
// (desktop/cradle/src/techne/m0m5/palace/basis.ts palaceTrailStep, the port of that route's law). The boundary's own route was pinned
// here beside the atlas's port until #762 removed it (no caller): the port is pinned alone now, and the boundary refuses the operation. Retired: 'the frame addresses the owner with the basis, reading and
// target only, and qualifies the reply it gets back' (palaceHopRequest / qualifyPalaceHopReply, the frame's channel) → 'the atlas's trail
// step records exactly the hop the boundary's palace route records'; 'seam B: the frame asks for a non-Expression instrument through the
// existing host-request summon' → atlas-palaces-session.test.mjs 'an object opens through its owner …' (the instrument door).
//
//   A  an Open on a Palace Expression records ONE endpoint hop on the session's one history, through the owner's
//      palace route. The hop carries the session's own subject and selection; a session off the Expression reading
//      records nothing, refused by name, and a Palace not admitted at this Scene is refused by name.
//   B  the Palace's non-Expression entries are admitted by the instruments it wires; the frame asks for them through
//      the existing host-request instrument summon (the host's selectInstrument path) and names the ref it means.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// The owner route is app TypeScript with extensionless siblings and type-only imports: register the boundary's own
// production-source loader (the one packages/expressions-boundary/tests uses), then load the sources dynamically.
register('../../../expressions-boundary/tests/editor-source-loader.mjs', import.meta.url);
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts');
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts');
const {createNativeTimeWindowOwner} = await import('../../../expressions-boundary/src/timeWindow.ts');
const {isDeepInstrument} = await import('../../../expressions-boundary/src/protocol.ts');
const {PALACE_WIRED_INSTRUMENTS, palaceOpenRoute} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/whole.ts');
const {palaceTrailStep} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/basis.ts');

const EXPRESSION = 'expression:journey-probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const THREE = `${EXPRESSION}:scene:three`;
const CONTAINED = 'expression:contained-work';
const binding = (scene_ref) => ({expression_ref: EXPRESSION, revision: '7', scene_ref});

function expressionReading(scenes = [ONE, TWO, THREE]) {
  const reading = structuredClone(provingReading());
  reading.expressions = scenes.map(binding);
  return reading;
}
const sceneReading = (scene) => ({...expressionReading(), expressions: [binding(scene)]});
const basisAt = (scene_ref) => ({expression_ref: EXPRESSION, revision: 7, scene_ref});
const contextAt = (basis) => ({mode: 'techne', bindingId: 'palace-open-route', epoch: 1,
  signal: new AbortController().signal, state: {hostMode: 'techne', nativeScene: structuredClone(basis)}, current: () => true});
const readingRef = () => provingReading().reading_ref;

function owner(scene = TWO) {
  const store = createDisclosureSessionStore();
  const handle = createNativeTimeWindowOwner({store});
  const basis = basisAt(scene), context = contextAt(basis);
  handle.admit(basis, sceneReading(scene), context);
  handle.admitJourney(basis, expressionReading(), context);
  return {store, owner: handle, basis, context};
}

function acknowledge(state) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: 'journey', operation: 'refresh'}, state.context);
}

function cross(state, ack, target) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: 'journey', operation: 'cross',
    expected_session_ref: ack.session.session_ref, expected_selection: structuredClone(ack.session.selection),
    expected_window: structuredClone(ack.axis.window), target_scene_ref: target}, state.context);
}

function palaceOpen(state, target, basis = state.basis, context = state.context) {
  return state.owner.handle({...basis, reading_ref: readingRef(), instrument: 'expressions', operation: 'palace', target_ref: target}, context);
}

// #762: the boundary's palace route (timeWindow.ts palaceHop) had no caller once the frame's Palace lens retired; it is removed. Retired:
// 'seam A: an Open on a Palace Expression appends exactly one endpoint hop …' and 'the atlas's trail step records exactly the hop the
// boundary's palace route records …' → 'the atlas's trail step appends exactly one endpoint hop …' below (the same hop, now pinned on the
// atlas's own port, desktop/cradle/src/techne/m0m5/palace/basis.ts palaceTrailStep); 'seam A: a session that stands off the Expression
// reading records no hop …' → 'the atlas's trail step on a session off the Expression reading …' below; 'seam A: a Palace that is not
// admitted at this native Scene is refused …' → the same test's "another subject or reading" refusal (the atlas admits no Scene: its trail
// step stands on the session's own reading, or refuses by name).

test('the boundary carries no palace route: a palace operation is refused by the shared-time law and records nothing', () => {
  const state = owner(TWO);
  cross(state, acknowledge(state), TWO);
  const before = JSON.stringify(state.store.get());
  assert.throws(() => palaceOpen(state, CONTAINED), /Shared time supports only/);
  assert.equal(JSON.stringify(state.store.get()), before, 'a refused operation changes nothing');
});

test('the atlas\'s trail step appends exactly one endpoint hop to the session history, and changes no identity', () => {
  const atlas = owner(TWO);
  cross(atlas, acknowledge(atlas), TWO);
  const before = structuredClone(atlas.store.get());
  // the reading the session stands on (the boundary admitted the Journey's whole-Expression reading at this basis)
  const reading = {...expressionReading(), reading_ref: before.reading_ref, subject: {...expressionReading().subject, subject_ref: before.subject_ref}};
  palaceTrailStep(atlas.store, reading, CONTAINED);
  const after = atlas.store.get();
  assert.equal(after.navigation.length, before.navigation.length + 1, 'exactly one hop is appended');
  assert.deepEqual(after.navigation.at(-1), {kind: 'traversal', instrument: 'expressions', step: 'endpoint', ref: CONTAINED,
    subject_ref: before.subject_ref, selection_ref: before.selection.selection_ref}, 'the endpoint hop, with the session\'s own subject and selection');
  assert.equal(after.session_ref, before.session_ref, 'the one session is kept');
  assert.equal(after.instrument, 'expressions', 'the instrument is carried, never re-targeted');
  assert.deepEqual(after.selection, before.selection, 'the selection is carried byte-equal');
});

test('the atlas\'s trail step on a session off the Expression reading, or on another reading, records nothing and says so by name', () => {
  const state = owner(TWO);
  acknowledge(state);
  const before = JSON.stringify(state.store.get());
  const session = state.store.get();
  const reading = {...expressionReading(), reading_ref: session.reading_ref, subject: {...expressionReading().subject, subject_ref: session.subject_ref}};
  assert.throws(() => palaceTrailStep(state.store, reading, CONTAINED), /not on the Expression reading/);
  assert.throws(() => palaceTrailStep(state.store, {...reading, reading_ref: 'ql.techne:reading:other'}, CONTAINED), /another subject or reading/);
  assert.throws(() => palaceTrailStep(createDisclosureSessionStore(), reading, CONTAINED), /No shared session stands/);
  assert.throws(() => palaceTrailStep(state.store, reading, '   '), /one object ref/);
  assert.equal(JSON.stringify(state.store.get()), before, 'a refused step changes nothing');
});

test('seam B: the palace wires the five non-Expression instruments and refuses the rest by name', () => {
  for (const instrument of ['project', 'canvas', 'timeline', 'journey', 'place']) {
    const entry = {kind: 'ground', ref: 'ql.techne:ref:x', label: 'x', open_instrument: instrument};
    assert.deepEqual(palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS), {kind: 'open', instrument, ref: 'ql.techne:ref:x'});
    assert.ok(isDeepInstrument(instrument), `${instrument} is a deep instrument the shell can select`);
  }
  const palace = palaceOpenRoute({kind: 'ground', ref: 'r', label: 'l', open_instrument: 'palace'}, PALACE_WIRED_INSTRUMENTS);
  assert.equal(palace.kind, 'refused');
  assert.match(palace.reason, /palace/);
  assert.equal(palaceOpenRoute({kind: 'ground', ref: 'r', label: 'l', open_instrument: null}, PALACE_WIRED_INSTRUMENTS).kind, 'refused');
});
