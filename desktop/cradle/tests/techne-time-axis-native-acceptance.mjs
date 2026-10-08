/** Existing native World/Expression/Scene source read -> actual hosted reading
 * -> shared projection. No owner writes or synthetic dated subjects. Faults
 * are labelled local clones of actual validated native reads. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readFile} from '../src/files/client.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {getWikiProjectionState} from '../src/techne/wikiProjectionStore.ts';
import {readWikiSceneTechne, wikiReadingPayload} from '../src/techne/wikiReadingProvider.ts';
import {validateReading, validateSession, crossCutSession} from '../src/techne/contract.ts';
import {createDisclosureSessionStore} from '../src/techne/session.ts';
import {relationFieldState} from '../src/techne/m0m5/timeline/state.ts';
import {facetRange} from '../src/techne/m0m5/timeline/scale.ts';
import {timeAxis, timeAxisEventScope} from '../src/techne/m0m5/timeline/timeAxis.ts';

const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const freeze = value => {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value)} return value};
const argument = name => {const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]};
const argumentsFor = name => process.argv.flatMap((value, at) => value === name ? [process.argv[at + 1]] : []);
const eventRef = event => event.facet_ref ?? event.derived_ref;
const inScope = projection => projection.events.filter(event => ['unbounded', 'in-scope'].includes(event.scope.state)).map(eventRef);

export async function runNativeTimeAxisAcceptance(source_sha256 = {}) {
  const url = argument('--kernel-url'), refs = argumentsFor('--expression-ref');
  if (!url || !refs.length || refs.some(ref => !ref?.startsWith('expression:')) || new Set(refs).size !== refs.length)
    throw Error('Pass the already-running --kernel-url and distinct existing --expression-ref values');
  const transport = {kind: 'bridge', url}, requests = [], checks = [], observations = [], nativeReadings = [];
  let nativeSceneReadings = 0, datedConsumerChecks = 0;
  const sourceFiles = new Map(), documents = new Map();
  const originalFetch = globalThis.fetch;
  // Instrument the real HTTP transport; never replace a native response.
  // Fail closed before dispatch if an imported route attempts a mutation.
  globalThis.fetch = async (input, init) => {
    if (String(input) !== `${url.replace(/\/$/, '')}/op`) throw Error('This acceptance may only read its explicitly supplied native owner');
    const op = JSON.parse(init.body);
    const allowed = ['world_read', 'files_list', 'file_read'].includes(op.op)
      || (op.op === 'expression' && op.request?.operation === 'inspect')
      || (op.op === 'knowledge' && op.request?.action === 'relations');
    assert.ok(allowed, `Refuse non-read native request: ${op.op}`);
    requests.push(structuredClone(op));
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000);
    return originalFetch(input, {...init, signal});
  };
  const check = (name, work) => {work(); checks.push({name, passed: true})};
  const inspect = async expression_ref => {
    const reply = await kernelOp(transport, {op: 'expression', request: {operation: 'inspect', expression_ref}}, AbortSignal.timeout(45000));
    assert.equal(reply.error, undefined, reply.error); assert.equal(reply.outcome?.result, 'expression');
    assert.equal(reply.outcome.data.document.expression_ref, expression_ref);
    return reply.outcome.data.document;
  };
  try {
    const world = await kernelOp(transport, {op: 'world_read'}, AbortSignal.timeout(45000));
    assert.equal(world.error, undefined, world.error); assert.equal(world.outcome?.result, 'world_read');
    publishWikiNativeRegisters(world.outcome.snapshot.navigator?.root?.work.projects ?? []);
    for (const ref of refs) documents.set(ref, await inspect(ref));
    for (const [ref, document] of documents) {
      for (const scene of document.scenes) {
        let reading;
        try {
          reading = await readWikiSceneTechne(transport, {expression_ref: ref, revision: document.revision, scene_ref: scene.scene_ref});
        } catch (error) {
          observations.push({expression_ref: ref, revision: document.revision, scene_ref: scene.scene_ref,
            state: 'unavailable', reason: error.message}); continue;
        }
        const validated = validateReading(reading);
        assert.ok(validated.valid, validated.errors.join('; '));
        const before = hash(reading); freeze(reading); nativeReadings.push(reading); nativeSceneReadings++;
        const projection = timeAxis(reading);
        check(`${scene.scene_ref}: deterministic, immutable identity and absent window`, () => {
          assert.equal(JSON.stringify(projection), JSON.stringify(timeAxis(reading)));
          assert.equal(projection.subject_ref, reading.subject.subject_ref); assert.equal(projection.reading_ref, reading.reading_ref);
          assert.equal(projection.snapshot_revision, reading.snapshot?.revision ?? null); assert.equal(projection.window, null);
          assert.equal(projection.events.length, reading.temporal?.length ?? 0);
          assert.equal(projection.relations.length, reading.whole?.relations?.length ?? 0);
          assert.equal(hash(reading), before);
        });
        check(`${scene.scene_ref}: verbatim carriers, qualifiers, precision, uncertainty and provenance`, () => {
          for (const [at, facet] of (reading.temporal ?? []).entries()) {
            const event = projection.events[at];
            for (const [key, value] of Object.entries(facet)) assert.deepEqual(event[key], value);
            if (facet.facet_ref == null) assert.equal(event.derived_ref, `derived:techne:timeline:temporal[${at}]`);
            else assert.equal(event.derived_ref, undefined);
            if (facet.instant === undefined) assert.equal(event.instant, undefined);
            if (facet.interval === undefined) assert.equal(event.interval, undefined);
            for (const provenance of event.provenance) assert.ok(reading.provenance.some(row => hash(row) === hash(provenance)));
          }
          for (const [at, relation] of (reading.whole?.relations ?? []).entries())
            for (const [key, value] of Object.entries(relation)) assert.deepEqual(projection.relations[at][key], value);
          const valid = (reading.temporal ?? []).filter(facet => facet.kind === 'valid');
          assert.equal(projection.bands.length, valid.length);
          for (const [at, facet] of valid.entries()) {
            assert.equal(projection.bands[at].label_verbatim, null, 'There is no authored period-label carrier in the current owner schema');
            assert.equal(projection.bands[at].earliest, facet.interval ? facet.interval.from ?? null : facet.instant ?? null);
            assert.equal(projection.bands[at].latest, facet.interval ? facet.interval.to ?? null : facet.instant ?? null);
          }
        });
        const dated = (reading.temporal ?? []).filter(facet => {try {return facetRange(facet).positioned} catch {return false}});
        const positioned = dated.find(facet => {const span = facetRange(facet); return span.fromMs !== null && span.toMs !== null});
        if (positioned) {
          const span = facetRange(positioned);
          // Explicit local integration-test windows over the actual native
          // extent. These do not assert or save a person's reading window.
          const windows = [{from: new Date(span.fromMs).toISOString(), to: new Date(span.toMs).toISOString()},
            {from: new Date(span.toMs + 1000).toISOString(), to: new Date(span.toMs + 2000).toISOString()}];
          check(`${scene.scene_ref}: Timeline and Places seam agree while out-of-scope events remain present`, () => {
            for (const window of windows) {
              const timeline = timeAxis(reading, window), places = timeAxis(reading, structuredClone(window));
              assert.deepEqual(timeline.window, window); assert.deepEqual(places.window, window);
              assert.deepEqual(inScope(timeline), inScope(places));
              assert.equal(timeline.events.length, projection.events.length);
              for (const [at, facet] of reading.temporal.entries()) assert.deepEqual(timeline.events[at].scope, timeAxisEventScope(facet, window));
              assert.deepEqual(relationFieldState(reading, 'timeline', null, window).time_window, timeline.window);
            }
            assert.equal(timeAxis(reading, windows[1]).events[reading.temporal.indexOf(positioned)].scope.state, 'out-of-scope');
          });
          datedConsumerChecks++;
        }
        if (projection.events.length) check(`${scene.scene_ref}: labelled actual-read clone fault retains undated and derived identity`, () => {
          const clone = structuredClone(reading), facet = clone.temporal[0];
          delete facet.facet_ref;
          assert.ok(validateReading(clone).valid);
          assert.equal(timeAxis(clone).events[0].derived_ref, 'derived:techne:timeline:temporal[0]');
          assert.equal(hash(reading), before);
        });
        observations.push({expression_ref: ref, revision: document.revision, scene_ref: scene.scene_ref,
          state: 'available', reading_ref: reading.reading_ref, snapshot_revision: reading.snapshot?.revision ?? null,
          reading_sha256: before, events: projection.events.length, positioned_events: dated.length,
          undated_events: projection.events.length - dated.length, relations: projection.relations.length,
          bands: projection.bands.length, qualified_relations: projection.relations.filter(row => row.temporal_facet_ref != null).length});
      }
    }
    for (const standing of Object.values(getWikiProjectionState().standings)) if ('reading' in standing && standing.reading?.state === 'ready') {
      const basis = standing.reading.wikiBasis;
      sourceFiles.set(basis.path, {location: basis.location, revision: basis.revision});
      if (nativeSceneReadings === 0) {
        // This is the owner's existing REGISTER route, not a Scene reading.
        // It exercises native undated ground without defeating the Scene's
        // exact retained-source refusal or importing dates from another whole.
        const source = standing.reading, register = source.register;
        const reading = wikiReadingPayload({register, subject: {kind: 'wiki', ref: `wiki:${register.key}`, title: register.title}, reading: source});
        assert.ok(validateReading(reading).valid); freeze(reading); nativeReadings.push(reading);
        const before = hash(reading), axis = timeAxis(reading);
        check(`${register.key}: separately labelled native register projection is deterministic and immutable`, () => {
          assert.equal(JSON.stringify(axis), JSON.stringify(timeAxis(reading)));
          assert.equal(axis.subject_ref, reading.subject.subject_ref); assert.equal(axis.reading_ref, reading.reading_ref);
          assert.equal(axis.snapshot_revision, basis.revision); assert.equal(axis.window, null);
          assert.equal(axis.events.length, reading.temporal?.length ?? 0); assert.equal(axis.relations.length, reading.whole?.relations?.length ?? 0);
          for (const [at, relation] of (reading.whole?.relations ?? []).entries())
            for (const [key, value] of Object.entries(relation)) assert.deepEqual(axis.relations[at][key], value);
          assert.equal(hash(reading), before);
        });
        check(`${register.key}: labelled actual-register clone rejects contract drift and does not invent dates`, () => {
          const clone = structuredClone(reading); clone.contract = 'unsupported';
          assert.equal(validateReading(clone).valid, false); assert.throws(() => timeAxis(clone), /drifted/);
          assert.equal(hash(reading), before); assert.deepEqual(axis.events, []);
        });
        observations.push({scope: 'register-control', state: 'available', reading_ref: reading.reading_ref,
          snapshot_revision: basis.revision, reading_sha256: before, events: axis.events.length,
          positioned_events: 0, undated_events: axis.events.length, relations: axis.relations.length,
          declared_source_temporal: source.temporal?.state === 'available'
            ? source.temporal.sources.reduce((total, row) => total + row.facets.length, 0) : null,
          source_temporal_state: source.temporal?.state ?? 'unavailable',
          source_relation_state: source.relations.state,
          ...(source.relations.state === 'unavailable' ? {source_relation_reason: source.relations.reason} : {}),
          note: 'Current register-control route only; stale native Scene guards remain unchanged'});
      }
    }
    // The source read route captured the revisions above. Read twice through
    // the same owning file seam, compare exact bytes as well as revisions.
    for (const [path, basis] of sourceFiles) {
      const first = await readFile(transport, basis.location), second = await readFile(transport, basis.location);
      assert.equal(first.revision, basis.revision); assert.equal(second.revision, first.revision); assert.equal(second.content, first.content);
      check(`${path}: native source revision and bytes retained`, () => assert.equal(hash(first.content), hash(second.content)));
      basis.source_sha256 = hash(second.content);
    }
    for (const [ref, before] of documents) {
      const after = await inspect(ref);
      check(`${ref}: native document revision and complete value retained`, () => {
        assert.equal(after.revision, before.revision); assert.equal(hash(after), hash(before));
      });
    }
    if (nativeReadings.length) {
      const reading = nativeReadings[0], selection = {selection_ref: reading.subject.subject_ref,
        subject_ref: reading.subject.subject_ref, reading_ref: reading.reading_ref, snapshot_revision: reading.snapshot?.revision ?? null,
        instrument: 'timeline', focus_refs: []};
      const store = createDisclosureSessionStore(), original = store.setSelection(selection);
      const explicitWindow = {from: argument('--window-from') ?? null, to: argument('--window-to') ?? null};
      check('existing pure contract carries an explicitly declared window byte-exact across cuts', () => {
        const declared = {...original, time_window: explicitWindow};
        assert.ok(validateSession(declared).valid);
        const crossed = crossCutSession(declared, 'expressions').session, returned = crossCutSession(crossed, 'place').session;
        assert.deepEqual(crossed.time_window, explicitWindow); assert.deepEqual(returned.time_window, explicitWindow);
        assert.equal(returned.subject_ref, original.subject_ref); assert.equal(returned.reading_ref, original.reading_ref);
        assert.deepEqual(timeAxis(reading, returned.time_window).window, explicitWindow);
      });
      check('native-reading session carries explicit window through ground, setter, navigation and cuts', () => {
        const supplied = structuredClone(explicitWindow), originalHash = hash(original);
        const current = store.setSelection(selection, {time_window: supplied});
        assert.deepEqual(current.time_window, explicitWindow); assert.notEqual(current.time_window, supplied);
        supplied.from = 'caller mutation'; assert.deepEqual(current.time_window, explicitWindow);
        assert.equal(hash(original), originalHash);
        const expression = store.crossCut('expressions').session, place = store.crossCut('place').session;
        assert.deepEqual(expression.time_window, explicitWindow); assert.deepEqual(place.time_window, explicitWindow);
        assert.equal(place.subject_ref, original.subject_ref); assert.equal(place.reading_ref, original.reading_ref);
        assert.deepEqual(store.openInInstrument('timeline').time_window, explicitWindow);
        const openWindow = {from: null, to: explicitWindow.to};
        assert.deepEqual(store.setTimeWindow(openWindow).time_window, openWindow);
        openWindow.to = 'caller mutation'; assert.notEqual(store.get().time_window.to, openWindow.to);
        assert.equal(store.setTimeWindow(null).time_window, undefined);
        assert.deepEqual(store.setTimeWindow(explicitWindow).time_window, explicitWindow);
        const before = store.get(), beforeHash = hash(before);
        for (const invalid of [{from: 1, to: null}, {from: null}, {from: null, to: null, inferred: true}, []]) {
          assert.throws(() => store.setTimeWindow(invalid), /explicit time window/);
          assert.equal(store.get(), before); assert.equal(hash(before), beforeHash);
        }
        assert.throws(() => createDisclosureSessionStore().setTimeWindow(explicitWindow), /No DisclosureSession/);
        assert.deepEqual(timeAxis(reading, store.get().time_window).window, explicitWindow);
      });
    }
    const positionedCount = observations.reduce((sum, row) => sum + (row.positioned_events ?? 0), 0);
    console.log(JSON.stringify({passed: true, kernel_url: url, checks, observations,
      requests: {total: requests.length, by_op: Object.fromEntries([...new Set(requests.map(row => row.op))].map(op => [op, requests.filter(row => row.op === op).length])), mutations: 0},
      native_documents: [...documents].map(([expression_ref, document]) => ({expression_ref, revision: document.revision,
        document_sha256: hash(document), source_basis: document.provenance.filter(row => row.ref.startsWith('wiki:'))})),
      native_sources: [...sourceFiles].map(([path, basis]) => ({path, revision: basis.revision, source_sha256: basis.source_sha256})),
      source_sha256, coverage: {native_readings: nativeReadings.length, native_scene_readings: nativeSceneReadings,
        positioned_events: positionedCount, dated_consumer_checks: datedConsumerChecks,
        dated_scope_admitted: datedConsumerChecks > 0, period_labels_admitted: false, explicit_window_store_admitted: true, t17_store_ui_admitted: false,
        original_126_targets_admitted: false},
      limitation: 'Shared projection and explicit session-window store only. Dated consumer checks run only when real positioned Scene events exist; coverage records actual execution. Native schema has no period label/notes. No mounted Timeline/Places UI acceptance.'}, null, 2));
  } finally {globalThis.fetch = originalFetch;}
}
