/** Genuine native reads + existing session owner + production consumers.
 * A current-register payload is labelled owner/helper seam coverage only:
 * it is never attached to a stale Scene and called installed admission.
 * Explicit test windows change an injected ephemeral session, not source.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';
import {readFile} from '../../../desktop/cradle/src/files/client.ts';
import {publishWikiNativeRegisters} from '../../../desktop/cradle/src/techne/wikiNativeExpression.ts';
import {getWikiProjectionState, ensureWikiProjectionReading} from '../../../desktop/cradle/src/techne/wikiProjectionStore.ts';
import {readWikiSceneTechne, wikiReadingPayload} from '../../../desktop/cradle/src/techne/wikiReadingProvider.ts';
import {createDisclosureSessionStore} from '../../../desktop/cradle/src/techne/session.ts';
import {groundSelection} from '../../../desktop/cradle/src/techne/m0m5/reading.ts';
import {validateReading, validateSession} from '../../../desktop/cradle/src/techne/contract.ts';
import {createNativeTimeWindowOwner} from '../src/timeWindow.ts';
import {qualifyTimeWindowReply} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedTimeWindow.tsx';
import {sharedTemporalNodeScopes, sharedTimelinePresentation} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedTimeProjection.ts';
import {sharedPlaceTimeScope, filteredFacets, filteredPlacesRepository} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/placeReading.ts';
import {readingInstruments} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstrumentsData.ts';

const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const argument = name => {const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]};
const values = name => process.argv.flatMap((value, at) => value === name ? [process.argv[at + 1]] : []);
const clone = value => structuredClone(value);

export async function runNativeTimeWindowAcceptance(source_sha256 = {}) {
  const url = argument('--kernel-url'), refs = values('--expression-ref'), sceneExpression = argument('--scene-expression-ref');
  const suppliedWindow = {from: argument('--window-from') ?? null, to: argument('--window-to') ?? null};
  if (!url || !refs.length || !refs.includes(sceneExpression) || refs.some(ref => !ref?.startsWith('expression:'))
    || new Set(refs).size !== refs.length) throw Error('Pass an actual running native URL, distinct protected refs, and one explicit Scene expression from those refs');
  const transport = {kind: 'bridge', url}, requests = [], checks = [], observations = [], documents = new Map();
  const originalFetch = globalThis.fetch;
  // Real transport audit: allow only read operations, never substitute replies.
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${url.replace(/\/$/, '')}/op`);
    const op = JSON.parse(init.body);
    assert.ok(['world_read', 'files_list', 'file_read'].includes(op.op)
      || op.op === 'expression' && op.request?.operation === 'inspect'
      || op.op === 'knowledge' && op.request?.action === 'relations', `Refuse native mutation: ${op.op}`);
    requests.push(clone(op));
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000);
    return originalFetch(input, {...init, signal});
  };
  const check = (name, run) => {run(); checks.push({name, passed: true})};
  const asyncCheck = async (name, run) => {await run(); checks.push({name, passed: true})};
  const inspect = async expression_ref => {
    const reply = await kernelOp(transport, {op: 'expression', request: {operation: 'inspect', expression_ref}}, AbortSignal.timeout(45000));
    assert.equal(reply.error, undefined, reply.error); assert.equal(reply.outcome?.result, 'expression');
    assert.equal(reply.outcome.data.document.expression_ref, expression_ref); return reply.outcome.data.document;
  };
  let source, reading, basis, nativeSceneReading = null, scope;
  try {
    const world = await kernelOp(transport, {op: 'world_read'}, AbortSignal.timeout(45000));
    assert.equal(world.error, undefined, world.error); assert.equal(world.outcome?.result, 'world_read');
    publishWikiNativeRegisters(world.outcome.snapshot.navigator?.root?.work.projects ?? []);
    for (const ref of refs) documents.set(ref, await inspect(ref));
    const document = documents.get(sceneExpression);
    const scene = document.scenes.find(row => row.scene_ref === document.selection?.scene_ref) ?? document.scenes[0];
    assert.ok(scene, 'The actual native document has a Scene');
    basis = {expression_ref: document.expression_ref, revision: document.revision, scene_ref: scene.scene_ref};
    try {
      nativeSceneReading = await readWikiSceneTechne(transport, basis);
      assert.ok(validateReading(nativeSceneReading).valid);
      observations.push({scope: 'actual-native-Scene-route', state: 'available', basis,
        reading_ref: nativeSceneReading.reading_ref, reading_sha256: hash(nativeSceneReading)});
    } catch (error) {
      observations.push({scope: 'actual-native-Scene-route', state: 'unavailable', basis, reason: error.message});
    }
    // Prefer an actual bound Scene reply. If refused, use the owner's already
    // read register route strictly as a separately named state seam check.
    if (nativeSceneReading) {reading = nativeSceneReading; scope = 'native-Scene-owner/helper';}
    else {
      const state = getWikiProjectionState();
      const ready = Object.values(state.standings).find(row => row.reading?.state === 'ready');
      if (ready) source = ready.reading;
      else {
        const register = state.registers.find(row => !row.project);
        assert.ok(register, 'World disclosed an actual root wiki register');
        source = await ensureWikiProjectionReading(register, transport);
      }
      const register = source.register;
      reading = wikiReadingPayload({register, subject: {kind: 'wiki', ref: `wiki:${register.key}`, title: register.title}, reading: source});
      assert.equal(reading.expressions, undefined, 'Do not lend this register reading the refused Scene binding');
      scope = 'current-register-owner/helper-only';
      observations.push({scope, state: 'available', reading_ref: reading.reading_ref,
        snapshot_revision: reading.snapshot?.revision ?? null, source_temporal_state: source.temporal?.state ?? 'unavailable',
        source_temporal_facets: source.temporal?.state === 'available' ? source.temporal.sources.reduce((sum, row) => sum + row.facets.length, 0) : null,
        source_relation_state: source.relations.state,
        source_relation_reason: source.relations.state === 'unavailable' ? source.relations.reason : null,
        note: 'Unbound actual register payload exercises the injected owner port; no installed Scene admission, synthetic Scene binding, or dated subject'});
    }
    assert.ok(validateReading(reading).valid);
    const readingHash = hash(reading), store = createDisclosureSessionStore();
    let notifications = 0;
    store.subscribe(() => notifications++);
    const owner = createNativeTimeWindowOwner({store}), abort = new AbortController();
    let presented = true;
    const context = {mode: 'techne', bindingId: 'time-window-owner-acceptance', epoch: 1,
      signal: abort.signal, state: {hostMode: 'techne', sceneCount: document.scenes.length, nativeScene: clone(basis)}, current: () => presented};
    const read = instrument => ({...basis, reading_ref: reading.reading_ref, instrument, operation: 'read'});
    const refresh = (admitted = reading, instrument = 'timeline') => ({...basis, reading_ref: admitted.reading_ref, instrument, operation: 'refresh'});
    const set = (reply, window, instrument = reply.instrument) => ({...basis, reading_ref: reading.reading_ref, instrument, operation: 'set',
      expected_session_ref: reply.session.session_ref, expected_selection: clone(reply.session.selection),
      expected_window: clone(reply.axis.window), window: clone(window)});
    const refusal = (name, run, pattern) => check(name, () => {
      const before = hash(store.get()), count = notifications;
      assert.throws(run, pattern); assert.equal(hash(store.get()), before); assert.equal(notifications, count);
    });
    check('admission caches a validated actual read without moving the native session', () => {
      owner.admit(basis, reading, context); assert.equal(store.get(), null); assert.equal(notifications, 0);
    });
    let timeline;
    check('read grounds the actual reading through the injected native owner', () => {
      timeline = owner.handle(read('timeline'), context);
      assert.ok(validateSession(timeline.session).valid); assert.equal(timeline.session.subject_ref, reading.subject.subject_ref);
      assert.equal(timeline.session.expression_focus_ref, basis.expression_ref); assert.equal(timeline.session.scene_focus_ref, basis.scene_ref);
      assert.equal(timeline.session.selection.snapshot_revision ?? null, reading.snapshot?.revision ?? null);
      assert.equal(timeline.axis.events.length, reading.temporal?.length ?? 0); assert.equal(timeline.axis.window, null);
      assert.equal(timeline.session.selection.instrument, 'timeline'); assert.equal(notifications, 1);
    });
    check('same reading read and admission retain selection, window, session and notification count', () => {
      const before = hash(store.get()), count = notifications;
      owner.admit(basis, reading, context); assert.deepEqual(owner.handle(read('timeline'), context), timeline);
      assert.equal(hash(store.get()), before); assert.equal(notifications, count);
    });
    check('explicit test-supplied window is carried by the native setter without adding temporal material', () => {
      timeline = owner.handle(set(timeline, suppliedWindow), context);
      assert.deepEqual(timeline.axis.window, suppliedWindow); assert.deepEqual(store.get().time_window, suppliedWindow);
      assert.equal(timeline.axis.events.length, reading.temporal?.length ?? 0); assert.equal(hash(reading), readingHash);
    });
    check('reply/session/axis clones cannot mutate the injected owner or admitted reading', () => {
      const before = hash(store.get()), leaked = clone(timeline);
      leaked.session.time_window.from = 'caller mutation'; leaked.session.selection.instrument = 'place'; leaked.axis.window.to = 'caller mutation';
      timeline.session.time_window.to = 'reply mutation'; timeline.axis.window.from = 'reply mutation';
      assert.equal(hash(store.get()), before); assert.equal(hash(reading), readingHash);
      timeline = owner.handle(read('timeline'), context); assert.deepEqual(timeline.axis.window, suppliedWindow);
    });
    let place;
    check('Timeline to Places and back retain source/window/selection with actual native navigation hops', () => {
      const original = clone(timeline);
      place = owner.handle(read('place'), context);
      assert.equal(place.session.session_ref, original.session.session_ref); assert.deepEqual(place.axis.window, original.axis.window);
      assert.deepEqual(place.session.selection, {...original.session.selection, instrument: 'place'});
      assert.equal(place.session.navigation.at(-1).to_instrument, 'place');
      timeline = owner.handle(read('timeline'), context);
      assert.deepEqual(timeline.session.selection, original.session.selection); assert.deepEqual(timeline.axis.window, original.axis.window);
      assert.equal(timeline.session.navigation.at(-1).to_instrument, 'timeline');
    });
    refusal('stale session-ref CAS refuses before any instrument alignment', () => owner.handle({...set(timeline, null, 'place'), expected_session_ref: `${timeline.session.session_ref}:stale`}, context), /session, window or actual selection/);
    refusal('null and an explicitly open window are distinct CAS operands', () => owner.handle({...set(timeline, null), expected_window: null}, context), /session, window or actual selection/);
    refusal('incomplete/camera-shaped windows refuse before native movement', () => owner.handle({...set(timeline, null, 'place'), window: {from: suppliedWindow.from}}, context), /explicit from\/to/);
    check('a null clear removes the owner window and an explicit open window remains explicit', () => {
      timeline = owner.handle(set(timeline, null), context); assert.equal(timeline.axis.window, null); assert.equal(store.get().time_window, undefined);
      timeline = owner.handle(set(timeline, {from: null, to: null}), context); assert.deepEqual(timeline.axis.window, {from: null, to: null});
    });
    refusal('open bounds do not match an absent captured window', () => owner.handle({...set(timeline, suppliedWindow), expected_window: null}, context), /session, window or actual selection/);
    check('window setter permits a captured intentional instrument hop', () => {
      place = owner.handle(set(timeline, suppliedWindow, 'place'), context);
      assert.equal(place.session.instrument, 'place'); assert.deepEqual(place.axis.window, suppliedWindow);
      timeline = owner.handle(read('timeline'), context);
    });
    const beforeHop = clone(timeline); store.openInInstrument('place');
    refusal('actual navigation advance retaining session-ref/window invalidates captured selection CAS', () => owner.handle(set(beforeHop, null), context), /actual selection\/instrument changed/);
    timeline = owner.handle(read('timeline'), context);
    const member = reading.whole?.member_refs?.[0];
    if (member) {
      const beforeFocus = clone(timeline), selected = {...store.get().selection, focus_refs: [member]};
      store.setSelection(selected);
      refusal('actual disclosed member selection advance invalidates captured CAS', () => owner.handle(set(beforeFocus, null), context), /actual selection\/instrument changed/);
      timeline = owner.handle(read('timeline'), context);
      check('same-source instrument reads preserve an actual disclosed member refinement', () => assert.deepEqual(timeline.session.selection.focus_refs, [member]));
    } else observations.push({scope, state: 'coverage-unavailable', reason: 'No actual disclosed member for member-refinement CAS'});
    const advanced = clone(reading); advanced.snapshot = {...advanced.snapshot, revision: `${reading.snapshot?.revision ?? ''}:labelled-clone-fault`};
    assert.ok(validateReading(advanced).valid); owner.admit(basis, advanced, context);
    refusal('labelled actual-read snapshot clone cannot silently retain an older same-ref session', () => owner.handle(read('timeline'), context), /source snapshot changed/);
    refusal('ordinary set cannot silently accept a labelled advanced source snapshot', () => owner.handle(set(timeline, suppliedWindow), context), /source snapshot changed/);
    check('explicit refresh adopts a labelled advanced snapshot through native ground selection while retaining same-source window', () => {
      const before = clone(store.get()), count = notifications;
      const refreshed = owner.handle(refresh(advanced), context);
      assert.ok(validateSession(refreshed.session).valid);
      assert.deepEqual(refreshed.session.selection, groundSelection(advanced, 'timeline'));
      assert.equal(refreshed.session.session_ref, before.session_ref);
      assert.deepEqual(refreshed.session.time_window, before.time_window);
      assert.deepEqual(refreshed.session.navigation, before.navigation);
      assert.equal(notifications, count + 1);
    });
    owner.admit(basis, reading, context);
    refusal('ordinary read still refuses a refreshed clone snapshot until the actual admitted source is explicitly refreshed', () => owner.handle(read('timeline'), context), /source snapshot changed/);
    check('explicit refresh restores the genuine admitted reading without rewriting its source or window', () => {
      const window = clone(store.get().time_window), before = hash(reading);
      timeline = owner.handle(refresh(), context);
      assert.deepEqual(timeline.session.selection, groundSelection(reading, 'timeline'));
      assert.deepEqual(timeline.axis.window, window); assert.equal(hash(reading), before);
    });
    const otherScene = document.scenes.find(row => row.scene_ref !== basis.scene_ref);
    if (otherScene) {
      store.setSelection(store.get().selection, {scene_focus_ref: otherScene.scene_ref});
      refusal('an actual other Scene ground requires explicit native refresh', () => owner.handle(read('timeline'), context), /another native Expression or Scene/);
      refusal('ordinary set cannot silently repair another actual Scene ground', () => owner.handle(set(timeline, suppliedWindow), context), /another native Expression or Scene/);
      check('explicit refresh repairs an actual other Scene ground through the injected owner and retains the same-source window', () => {
        const before = clone(store.get()), count = notifications;
        timeline = owner.handle(refresh(), context);
        assert.equal(timeline.session.expression_focus_ref, basis.expression_ref);
        assert.equal(timeline.session.scene_focus_ref, basis.scene_ref);
        assert.deepEqual(timeline.session.selection, groundSelection(reading, 'timeline'));
        assert.equal(timeline.session.session_ref, before.session_ref);
        assert.deepEqual(timeline.session.time_window, before.time_window);
        assert.equal(notifications, count + 1);
      });
    }
    const anotherSource = clone(reading); anotherSource.reading_ref += ':labelled-refresh-source';
    assert.ok(validateReading(anotherSource).valid); owner.admit(basis, anotherSource, context);
    check('explicit refresh over a labelled changed-source clone uses native new-session window reset semantics', () => {
      const before = clone(store.get()); assert.ok(before.time_window);
      const refreshed = owner.handle(refresh(anotherSource, 'place'), context);
      assert.notEqual(refreshed.session.session_ref, before.session_ref);
      assert.equal(refreshed.session.reading_ref, anotherSource.reading_ref);
      assert.deepEqual(refreshed.session.selection, groundSelection(anotherSource, 'place'));
      assert.equal(refreshed.session.time_window, undefined); assert.equal(refreshed.axis.window, null);
    });
    owner.admit(basis, reading, context); timeline = owner.handle(refresh(), context);
    timeline = owner.handle(set(timeline, suppliedWindow), context);
    refusal('explicit refresh refuses an unadmitted reading identity without native session movement', () => owner.handle({...refresh(), reading_ref: anotherSource.reading_ref}, context), /No actual native reading/);
    refusal('explicit refresh refuses window and camera operands without native session movement', () => owner.handle({...refresh(), window: suppliedWindow}, context), /Unsupported shared-time operands/);
    refusal('wrong actual native revision refuses before session movement', () => owner.handle({...read('timeline'), revision: basis.revision + 1}, context), /target, access/);
    refusal('explicit refresh refuses a wrong native revision before session movement', () => owner.handle({...refresh(), revision: basis.revision + 1}, context), /target, access/);
    refusal('binding/epoch change refuses the cached reading', () => owner.handle(read('timeline'), {...context, epoch: 2}), /binding or epoch changed/);
    refusal('explicit refresh refuses a retired binding epoch before session movement', () => owner.handle(refresh(), {...context, epoch: 2}), /binding or epoch changed/);
    presented = false;
    refusal('revoked presented/access context refuses admission and read without movement', () => owner.handle(read('timeline'), context), /target, access/);
    refusal('revoked context cannot replace the admitted read', () => owner.admit(basis, reading, context), /target, access/);
    refusal('concealed explicit refresh refuses without native session movement', () => owner.handle(refresh(), context), /target, access/);
    presented = true;
    const incompatible = clone(reading); incompatible.contract = 'labelled-invalid-contract';
    refusal('labelled actual-read contract drift refuses admission', () => owner.admit(basis, incompatible, context), /drifted native Technē reading/);
    timeline = owner.handle(read('timeline'), context);
    check('production reply qualifier admits the actual returned owner reading and clones it', () => {
      const qualified = qualifyTimeWindowReply(timeline, basis, reading, 'timeline');
      assert.deepEqual(qualified, timeline); assert.notEqual(qualified.session, timeline.session);
      assert.throws(() => qualifyTimeWindowReply(timeline, {...basis, revision: basis.revision + 1}, reading, 'timeline'), /does not address/);
      assert.throws(() => qualifyTimeWindowReply({...timeline, axis: {...timeline.axis, events: [...timeline.axis.events, {}]}}, basis, reading, 'timeline'), /does not address/);
      const scopes = sharedTemporalNodeScopes(reading, timeline.axis);
      assert.equal(scopes.size, reading.temporal?.length ?? 0);
      const facets = filteredFacets(reading, {relations: null, standing: null, window: timeline.axis.window});
      assert.equal(facets.length, (reading.spatial ?? []).filter(facet => sharedPlaceTimeScope(facet, timeline.axis.window).state !== 'out-of-scope').length);
      for (const facet of facets) assert.ok(reading.spatial.includes(facet), 'Retained place objects preserve native identity');
    });
    // Labelled malformed clones of the actual returned owner reply. These
    // are boundary refusal checks, never alternative source readings.
    const faultyReply = change => {const reply = clone(timeline); change(reply); return reply};
    const rejectReply = (name, change) => check(name, () => {
      const before = hash(store.get());
      assert.throws(() => qualifyTimeWindowReply(faultyReply(change), basis, reading, 'timeline'), /does not address/);
      assert.equal(hash(store.get()), before); assert.equal(hash(reading), readingHash);
    });
    rejectReply('labelled actual-return clone with missing Expression ground refuses at the production consumer', reply => delete reply.session.expression_focus_ref);
    if (otherScene) rejectReply('labelled actual-return clone with another actual Scene ground refuses at the production consumer', reply => {reply.session.scene_focus_ref = otherScene.scene_ref});
    if (member && member !== reading.subject.subject_ref) rejectReply('labelled actual-return clone with another actual disclosed selection subject refuses at the production consumer', reply => {reply.session.selection.subject_ref = member});
    rejectReply('labelled actual-return clone with drifted selection reading refuses at the production consumer', reply => {reply.session.selection.reading_ref += ':labelled-clone-fault'});
    rejectReply('labelled actual-return clone with another actual selection instrument refuses at the production consumer', reply => {reply.session.selection.instrument = 'place'});
    const instruments = await readingInstruments(reading);
    const presentation = sharedTimelinePresentation(instruments.dataSource, instruments.timeline, reading, timeline.axis);
    await asyncCheck('production Timeline and Places wrappers preserve actual unknown/absent scope cardinality', async () => {
      const baseView = await instruments.dataSource.loadTimelineView();
      const scopedView = await presentation.dataSource.loadTimelineView();
      const scopes = sharedTemporalNodeScopes(reading, timeline.axis);
      assert.deepEqual(scopedView.nodes, baseView.nodes.filter(row => scopes.get(row.node.graphNodeId)?.state !== 'out-of-scope'));
      const walk = await instruments.timeline.getTimelineWalk(reading.subject.subject_ref);
      const scopedWalk = await presentation.repository.getTimelineWalk(reading.subject.subject_ref);
      assert.deepEqual(scopedWalk.earthboundNodes, walk.earthboundNodes.filter(row => scopes.get(row.graphNodeId)?.state !== 'out-of-scope'));
      const nativePlaces = await instruments.places.getLocatedNodes(reading.subject.subject_ref);
      const filtered = filteredPlacesRepository(instruments.places, reading, {relations: null, standing: null, window: timeline.axis.window});
      const scopedPlaces = await filtered.getLocatedNodes(reading.subject.subject_ref);
      const spatialScopes = new Map((reading.spatial ?? []).map(facet => [facet.place_ref, sharedPlaceTimeScope(facet, timeline.axis.window)]));
      assert.deepEqual(scopedPlaces, nativePlaces.filter(row => spatialScopes.get(row.graphNodeId)?.state !== 'out-of-scope'));
      observations.push({scope: 'production-consumers-over-actual-read', temporal_facets: timeline.axis.events.length,
        timeline_nodes: baseView.nodes.length, scoped_timeline_nodes: scopedView.nodes.length,
        timeline_walk_nodes: walk.earthboundNodes.length, scoped_walk_nodes: scopedWalk.earthboundNodes.length,
        spatial_facets: reading.spatial?.length ?? 0, located_nodes: nativePlaces.length, scoped_located_nodes: scopedPlaces.length,
        note: 'Zero dated/located rows are absent coverage, never a successful dated comparison'});
    });
    check('aborted native context refuses synchronously without movement', () => {
      const before = hash(store.get()), count = notifications; abort.abort();
      assert.throws(() => owner.handle(read('timeline'), context), /abort/i);
      assert.throws(() => owner.handle(refresh(), context), /abort/i);
      assert.equal(hash(store.get()), before); assert.equal(notifications, count);
    });
    check('actual source reading was not mutated by owners, consumers or labelled clone faults', () => assert.equal(hash(reading), readingHash));
    if (source) {
      const first = await readFile(transport, source.wikiBasis.location), second = await readFile(transport, source.wikiBasis.location);
      check('native source revision and complete bytes retained across the owner/helper checks', () => {
        assert.equal(first.revision, source.wikiBasis.revision); assert.equal(second.revision, first.revision); assert.equal(second.content, first.content);
      });
      observations.push({scope: 'actual-source-file', path: source.wikiBasis.path, revision: second.revision, sha256: hash(second.content)});
    }
    for (const [ref, before] of documents) {
      const after = await inspect(ref);
      check(`${ref}: protected native revision and complete document retained`, () => {
        assert.equal(after.revision, before.revision); assert.equal(hash(after), hash(before));
      });
    }
    const evidence = {schema: 'oi.native-time-window-acceptance/v1', executed_at: new Date().toISOString(), passed: true,
      source_sha256, scope, basis, checks, observations, request_count: requests.length, native_domain_writes: 0,
      documents: [...documents].map(([ref, document]) => ({ref, revision: document.revision, sha256: hash(document)})),
      mounted_Scene_time_admitted: false, dated_T6_T17_admitted: false,
      limitations: ['This packet exercises the existing injected owner and production helper functions, not an installed host/iframe round trip.',
        ...(!nativeSceneReading ? ['Actual native Scene reading refused its retained source; current-register seam checks do not bypass that refusal.'] : []),
        'Dated/partial scope comparison and interactive mounted Timeline/Places acceptance remain open; no fabricated dates or second timestamp engine.'],
      requests};
    const destination = argument('--evidence');
    if (destination) {await mkdir(dirname(destination), {recursive: true}); await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`);}
    console.log(JSON.stringify({passed: true, scope, checks: checks.length, requests: requests.length, native_domain_writes: 0,
      native_scene_read_available: !!nativeSceneReading, dated_T6_T17_admitted: false, evidence: destination ?? null,
      observations}, null, 2));
  } finally {globalThis.fetch = originalFetch;}
}
