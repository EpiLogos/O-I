// lane-5 palace seams A and B.
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
register('../../../../../packages/expressions-boundary/tests/editor-source-loader.mjs', import.meta.url);
const {createDisclosureSessionStore} = await import('../../../src/techne/session.ts');
const {provingReading} = await import('../../../src/techne/m0m5/journey/proving-reading.ts');
const {createNativeTimeWindowOwner} = await import('../../../../../packages/expressions-boundary/src/timeWindow.ts');
const {isDeepInstrument} = await import('../../../../../packages/expressions-boundary/src/protocol.ts');
const {PALACE_WIRED_INSTRUMENTS, palaceInstrumentOpenRequest, palaceOpenRoute} = await import('../src/palaceWhole.ts');
const {palaceHopRequest, qualifyPalaceHopReply} = await import('../src/palaceHop.ts');

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

test('seam A: an Open on a Palace Expression appends exactly one endpoint hop to the session history and changes no identity', () => {
  const state = owner(TWO);
  cross(state, acknowledge(state), TWO);
  const before = structuredClone(state.store.get());
  const reply = palaceOpen(state, CONTAINED);
  const after = state.store.get();
  assert.equal(after.navigation.length, before.navigation.length + 1, 'exactly one hop is appended');
  assert.deepEqual(after.navigation.at(-1), {kind: 'traversal', instrument: 'expressions', step: 'endpoint', ref: CONTAINED,
    subject_ref: before.subject_ref, selection_ref: before.selection.selection_ref});
  assert.equal(after.session_ref, before.session_ref, 'the one session is kept');
  assert.equal(after.instrument, 'expressions', 'the instrument is carried, never re-targeted');
  assert.deepEqual(after.selection, before.selection, 'the actual selection is carried byte-equal');
  assert.equal(reply.instrument, 'expressions');
  assert.equal(reply.reading_ref, readingRef());
  assert.equal(reply.session.navigation.at(-1).ref, CONTAINED);
});

test('seam A: a session that stands off the Expression reading records no hop and says so by name', () => {
  const state = owner(TWO);
  acknowledge(state);
  const before = JSON.stringify(state.store.get());
  assert.throws(() => palaceOpen(state, CONTAINED), /not on the Expression reading/);
  assert.equal(JSON.stringify(state.store.get()), before, 'a refused hop changes nothing');
});

test('seam A: a Palace that is not admitted at this native Scene is refused by name and records nothing', () => {
  const state = owner(TWO);
  cross(state, acknowledge(state), TWO);
  const before = JSON.stringify(state.store.get());
  const other = basisAt(ONE);
  assert.throws(() => palaceOpen(state, CONTAINED, other, contextAt(other)), /not admitted/);
  assert.equal(JSON.stringify(state.store.get()), before);
});

test('the frame addresses the owner with the basis, reading and target only, and qualifies the reply it gets back', () => {
  const basis = basisAt(TWO);
  const reading = expressionReading();
  assert.deepEqual(palaceHopRequest(basis, reading, CONTAINED), {...basis, operation: 'palace', reading_ref: reading.reading_ref,
    instrument: 'expressions', target_ref: CONTAINED});
  const state = owner(TWO);
  cross(state, acknowledge(state), TWO);
  const reply = palaceOpen(state, CONTAINED);
  assert.equal(qualifyPalaceHopReply(reply, basis, reading).session.navigation.at(-1).ref, CONTAINED);
  assert.throws(() => qualifyPalaceHopReply({...reply, reading_ref: 'ql.techne:reading:other'}, basis, reading), /does not address/);
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

test('seam B: the frame asks for a non-Expression instrument through the existing host-request summon, naming its ref', () => {
  const request = palaceInstrumentOpenRequest('timeline', 'ql.techne:ref:x');
  assert.deepEqual(request, {request: 'summon', detail: {kind: 'instrument', lens: 'timeline', ref: 'ql.techne:ref:x'}});
  // The host admits exactly this shape: a summon whose detail is an instrument with a deep lens.
  assert.equal(request.request, 'summon');
  assert.equal(request.detail.kind, 'instrument');
  assert.ok(isDeepInstrument(request.detail.lens));
});
