/** Actual native inspect -> existing bounded conversion -> Scene projection.
 * Only inspect is dispatched. Missing/reordered carriers are local copies of
 * those real reads, never a simulated native owner or successful write. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {sceneSaveState, savedSceneIndices as savedRowsFor} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow.ts';
import {expressionTiming} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks.ts';
import {mapSceneOccurrences} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneCorrespondence.ts';
import {projectNativeScenes, nativeSceneMember} from '../src/scenes.ts';
import {isNativeScenesReading} from '../src/scenesValidation.ts';
import {advanceSceneTransport, nativeSceneTransportMaterial} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneTransport.ts';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freeze = value => {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value)} return value};
const argument = name => {const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]};
const allArguments = name => process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []);

export async function runNativeSceneAcceptance(source_sha256 = {}) {
  const url = argument('--kernel-url');
  if (!url) throw Error('Pass --kernel-url for the already-running native owner');
  const refs = allArguments('--expression-ref');
  if (!refs.length || refs.some(ref => !ref?.startsWith('expression:')) || new Set(refs).size !== refs.length)
    throw Error('Pass distinct existing --expression-ref values; this runner creates no native work');
  const expected = new Map(allArguments('--expect-revision').map(value => {
    const split = value.lastIndexOf('=');
    return [value.slice(0, split), Number(value.slice(split + 1))];
  }));
  const effects = [], checks = [], observations = [];
  const inspect = async expression_ref => {
    const request = {operation: 'inspect', expression_ref};
    assert.equal(request.operation, 'inspect'); effects.push(request);
    const result = await kernelOp({kind: 'bridge', url}, {op: 'expression', request}, AbortSignal.timeout(30000));
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.outcome?.result, 'expression');
    const document = result.outcome.data.document;
    assert.equal(document?.expression_ref, expression_ref, 'Read the explicitly named existing native document');
    if (expected.has(expression_ref)) assert.equal(document.revision, expected.get(expression_ref), 'Native revision must match the declared acceptance basis');
    return document;
  };
  const before = new Map();
  let partialPages = 0, missingMaterial = 0, presentMaterial = 0, absentMembership = 0, withheldMembers = 0, transportScenes = 0, savedTransports = 0;
  const check = (name, work) => {work(); checks.push({name, passed: true})};
  try {
    for (const ref of refs) before.set(ref, await inspect(ref));
    for (const [ref, document] of before) {
      const nativeHash = hash(document), view = freeze(kernelDocumentToJourney(freeze(document)));
      const viewHash = hash(view), reading = projectNativeScenes(view.journey, view);
      check(`${ref}: portable Scene disclosure is qualified by the actual captured native basis`, () => {
        const basis = {expression_ref: ref, revision: document.revision, scene_ref: reading.native_order[0]};
        assert.equal(isNativeScenesReading(reading, basis), true);
        assert.equal(isNativeScenesReading(reading, {...basis, revision: basis.revision + 1}), false);
        assert.equal(isNativeScenesReading(reading, {...basis, expression_ref: ref + '-different-owner'}), false);
        assert.equal(isNativeScenesReading(reading, {...basis, scene_ref: 'undisclosed-native-scene'}), false);
        const renamedRef = structuredClone(reading); renamedRef.scenes[0].scene_ref = 'undisclosed-native-scene';
        assert.equal(isNativeScenesReading(renamedRef, basis), false);
        const detached = structuredClone(reading); detached.scenes[0].member_refs.push('undisclosed-native-entity');
        assert.equal(isNativeScenesReading(detached, basis), false);
        const impossible = structuredClone(reading); impossible.timing.working = {available: true, total_seconds: Infinity, extents: []};
        assert.equal(isNativeScenesReading(impossible, basis), false);
        if(reading.timing.working.available){
          const wrongTotal=structuredClone(reading);wrongTotal.timing.working.total_seconds+=1;
          assert.equal(isNativeScenesReading(wrongTotal,basis),false);
          const displaced=structuredClone(reading);displaced.timing.working.extents[0].start_seconds=1;
          assert.equal(isNativeScenesReading(displaced,basis),false);
          const changedDuration=structuredClone(reading);changedDuration.timing.working.extents[0].duration_seconds+=1;
          assert.equal(isNativeScenesReading(changedDuration,basis),false);
        }
        assert.equal(hash(document), nativeHash); assert.equal(hash(view), viewHash);
      });
      check(`${ref}: native identity, order, titles and working correspondence`, () => {
        assert.deepEqual(reading.basis, {expression_ref: ref, revision: document.revision});
        assert.deepEqual(reading.native_order, document.scenes.map(scene => scene.scene_ref));
        assert.deepEqual(reading.working_order, view.journey.scenes.map(scene => view.bindings[scene.id].scene_ref));
        assert.equal(reading.native_selected_scene_ref, document.selection?.scene_ref ?? null);
        assert.deepEqual(reading.object_titles,Object.fromEntries(Object.values(document.entities).map(entity=>[entity.entity_ref,entity.title])));
        assert.equal(reading.completeness.order, true);
        for (const row of reading.scenes) {
          const native = document.scenes.find(scene => scene.scene_ref === row.scene_ref);
          const local = view.journey.scenes.find(scene => scene.id === row.local_scene_id);
          assert.equal(row.native_title, native.title); assert.equal(row.title, local.name);
          assert.deepEqual(row.member_refs, native.entity_refs);
          assert.deepEqual(row.members.map(member => member.entity_ref), native.entity_refs);
          for(const member of row.members)assert.equal(reading.object_titles[member.entity_ref],document.entities[member.entity_ref].title);
        }
      });
      check(`${ref}: authored pacing and snapshot standing, with compatibility defaults unavailable`, () => {
        for (const row of reading.scenes) {
          const native = document.scenes.find(scene => scene.scene_ref === row.scene_ref);
          const local = view.journey.scenes.find(scene => scene.id === row.local_scene_id);
          if (native.presentation) {
            presentMaterial++;
            assert.deepEqual(row.working, {duration: native.presentation.scene.duration, transition: native.presentation.scene.transition});
            assert.equal(row.snapshot.standing, row.membership.complete ? sceneSaveState(view.journey, local) : null);
            assert.equal(row.snapshot.availability, view.journey.savedScenes?.[local.id] ? 'present' : 'absent');
          } else {
            missingMaterial++; assert.equal(row.material.available, false);
            assert.equal(row.working, null); assert.equal(row.snapshot.availability, 'unavailable');
            assert.equal(row.snapshot.standing, null); assert.equal(reading.timing.working.available, false);
          }
        }
        for (const savedOnly of [false, true]) {
          const timing = savedOnly ? reading.timing.saved : reading.timing.working;
          if (!timing.available) continue;
          assert.equal(timing.total_seconds, expressionTiming(view.journey, 0, 0, savedOnly).total);
          for (const extent of timing.extents) {
            const index = view.journey.scenes.findIndex(scene => view.bindings[scene.id].scene_ref === extent.scene_ref);
            const local = view.journey.scenes[index], played = savedOnly ? view.journey.savedScenes[local.id] : local;
            assert.equal(extent.start_seconds, expressionTiming(view.journey, index, 0, savedOnly).start);
            assert.equal(extent.duration_seconds, played.duration); assert.equal(extent.transition_seconds, played.transition);
          }
        }
      });
      check(`${ref}: native loaded, unloaded and absent occurrences remain distinct`, () => {
        for (const row of reading.scenes) {
          const binding = view.bindings[row.local_scene_id], local = view.journey.scenes.find(scene => scene.id === row.local_scene_id);
          for (const member of row.members) {
            if (member.state === 'loaded') {
              const occurrence = binding.occurrences.find(value => value.entity_ref === member.entity_ref);
              assert.deepEqual(member.occurrence, occurrence); assert.ok(local.entities.some(entity => entity.id === occurrence.view_entity_id));
            } else {
              assert.equal(member.occurrence, null);
              if (member.state === 'unloaded') assert.ok(!binding.loaded_refs.includes(member.entity_ref) && !binding.hidden_refs.includes(member.entity_ref));
            }
          }
          const foreign = Object.keys(document.entities).find(entityRef => !row.member_refs.includes(entityRef));
          if (foreign) {absentMembership++; assert.equal(nativeSceneMember(reading, row.scene_ref, foreign).state, 'absent')}
          if (row.membership.unloaded_refs.length) {partialPages++; assert.equal(row.membership.complete, false)}
        }
      });
      check(`${ref}: unavailable working Scene and correspondence cannot fabricate total extents`, () => {
        const partialJourney = structuredClone(view.journey); partialJourney.scenes.shift();
        const partial = projectNativeScenes(partialJourney, view);
        assert.equal(partial.completeness.order, false); assert.equal(partial.timing.working.available, false);
        assert.equal(partial.timing.saved.available, false);
        const withoutBinding = structuredClone(view); delete withoutBinding.bindings[view.journey.scenes[0].id];
        const unbound = projectNativeScenes(view.journey, withoutBinding);
        assert.equal(unbound.timing.working.available, false);
        assert.equal(unbound.scenes[0].local_scene_id, null);
        assert.ok(unbound.scenes[0].members.every(member => member.state === 'unloaded'));
        const withoutMaterial = structuredClone(view); delete withoutMaterial.document.scenes[0].presentation;
        const missing = projectNativeScenes(view.journey, withoutMaterial);
        assert.equal(missing.scenes[0].working, null); assert.equal(missing.scenes[0].material.available, false);
        assert.equal(missing.timing.working.available, false); assert.equal(missing.timing.saved.available, false);
        assert.equal(nativeSceneMember(reading, 'undisclosed-native-scene', 'undisclosed-native-entity').state, 'unavailable');
      });
      const heldRow = reading.scenes.find(row => row.members.some(member => member.state === 'loaded'));
      if (heldRow) check(`${ref}: withholding an actual occurrence preserves native membership and honest standing`, () => {
        const member = heldRow.members.find(value => value.state === 'loaded'), partialView = structuredClone(view);
        const binding = partialView.bindings[heldRow.local_scene_id];
        binding.loaded_refs = binding.loaded_refs.filter(value => value !== member.entity_ref);
        binding.occurrences = binding.occurrences.filter(value => value.entity_ref !== member.entity_ref);
        const visible = new Set(binding.loaded_refs.map(value => partialView.entity_ids[value]));
        const localIndex = partialView.journey.scenes.findIndex(scene => scene.id === heldRow.local_scene_id);
        partialView.journey.scenes[localIndex] = mapSceneOccurrences(partialView.journey.scenes[localIndex], heldRow.local_scene_id, new Map(), visible);
        if (partialView.journey.savedScenes?.[heldRow.local_scene_id]) partialView.journey.savedScenes[heldRow.local_scene_id] =
          mapSceneOccurrences(partialView.journey.savedScenes[heldRow.local_scene_id], heldRow.local_scene_id, new Map(), visible);
        const partial = projectNativeScenes(partialView.journey, partialView), row = partial.scenes.find(value => value.scene_ref === heldRow.scene_ref);
        assert.deepEqual(row.member_refs, heldRow.member_refs);
        assert.equal(nativeSceneMember(partial, row.scene_ref, member.entity_ref).state, 'unloaded');
        assert.equal(row.membership.complete, false); assert.equal(row.snapshot.standing, null);
        assert.deepEqual(partial.timing, reading.timing, 'Known pacing is independent of an unloaded object page');
        assert.equal(hash(partialView.document), nativeHash, 'Withholding presentation did not alter the native document');
        withheldMembers++;
      });
      check(`${ref}: local reorder preserves native identities, owned content and inputs`, () => {
        const reordered = structuredClone(view.journey); reordered.scenes.reverse();
        const projected = projectNativeScenes(reordered, view);
        assert.deepEqual(projected.native_order, reading.native_order);
        assert.deepEqual(projected.working_order, [...reading.working_order].reverse());
        for (const row of projected.scenes) assert.deepEqual(row, reading.scenes.find(value => value.scene_ref === row.scene_ref));
        assert.equal(hash(document), nativeHash); assert.equal(hash(view), viewHash);
        assert.equal('playback' in reading, false, 'No fabricated runtime clock is produced');
      });
      const playable = reading.scenes.find(row => row.material.available);
      const authoredSceneIds = nativeSceneTransportMaterial(view);
      const unavailablePacing = reading.scenes.filter(row => !row.material.available);
      if (unavailablePacing.length) check(`${ref}: compatibility snapshots never establish native playback pacing`, () => {
        for (const row of unavailablePacing) {
          const index = view.journey.scenes.findIndex(scene => scene.id === row.local_scene_id);
          const state = {playing: true, savedSequence: false, hidden: false, libraryOpen: false, propertyRecording: false, editing: false, authoredSceneIds};
          const refused = advanceSceneTransport(view.journey, index, 0, .05, state);
          assert.equal(refused.scene_playing, false); assert.equal(refused.saved_sequence_playing, false);
          assert.equal(refused.elapsed_seconds, 0); assert.match(refused.unavailable_reason, /compatibility snapshots/);
        }
        const candidate = savedRowsFor(view.journey)[0];
        if (candidate !== undefined) {
          const refused = advanceSceneTransport(view.journey, candidate, 0, .05, {playing: true, savedSequence: true, hidden: false, libraryOpen: false, propertyRecording: false, editing: false, authoredSceneIds});
          assert.equal(refused.elapsed_seconds, 0); assert.equal(refused.saved_sequence_playing, false);
          assert.match(refused.unavailable_reason, /compatibility snapshots/);
        }
      });
      if (playable) check(`${ref}: retained Scene transport advances once and holds recording or hidden work`, () => {
        const index = view.journey.scenes.findIndex(scene => scene.id === playable.local_scene_id);
        const state = {playing: true, savedSequence: false, hidden: false, libraryOpen: false, propertyRecording: false, editing: false, authoredSceneIds};
        let elapsed = 0;
        for (let frame = 0; frame < 10; frame++) elapsed = advanceSceneTransport(view.journey, index, elapsed, .05, state).elapsed_seconds;
        assert.ok(Math.abs(elapsed - .5) < 1e-10, 'Ten 50ms frames advance the single retained playhead by 500ms');
        for (const blocked of [{hidden: true}, {libraryOpen: true}, {propertyRecording: true}, {playing: false}]) {
          assert.equal(advanceSceneTransport(view.journey, index, elapsed, .05, {...state, ...blocked}).elapsed_seconds, elapsed);
        }
        assert.equal(advanceSceneTransport(view.journey, index, 0, 30, state).elapsed_seconds, .25, 'A suspended frame keeps the existing 250ms bound');
        const end = advanceSceneTransport(view.journey, index, playable.working.duration - .05, .1, state);
        assert.equal(end.elapsed_seconds, playable.working.duration); assert.equal(end.scene_playing, false);
        assert.equal(end.completed, true); assert.equal(end.advance_to_scene_index, null);
        assert.equal(hash(document), nativeHash); assert.equal(hash(view), viewHash); transportScenes++;
      });
      const savedRows = reading.scenes.filter(row => row.material.available && row.snapshot.availability === 'present');
      const actualSaved = savedRowsFor(view.journey);
      if (savedRows.length && actualSaved.every(index => authoredSceneIds.includes(view.journey.scenes[index].id))) check(`${ref}: saved sequence uses its retained snapshot pacing and transitions once`, () => {
        const indices = view.journey.scenes.flatMap((scene, index) => savedRows.some(row => row.local_scene_id === scene.id) ? [index] : []);
        const index = indices[0], snapshot = view.journey.savedScenes[view.journey.scenes[index].id];
        const state = {playing: true, savedSequence: true, hidden: false, libraryOpen: false, propertyRecording: false, editing: false, authoredSceneIds};
        let elapsed = 0;
        for (let frame = 0; frame < 10; frame++) elapsed = advanceSceneTransport(view.journey, index, elapsed, .05, state).elapsed_seconds;
        assert.ok(Math.abs(elapsed - .5) < 1e-10, 'Saved-sequence playback advances by 500ms, never the previous 1000ms');
        assert.equal(advanceSceneTransport(view.journey, index, elapsed, .05, {...state, editing: true}).elapsed_seconds, elapsed);
        assert.equal(advanceSceneTransport(view.journey, index, elapsed, .05, {...state, propertyRecording: true}).elapsed_seconds, elapsed);
        const end = advanceSceneTransport(view.journey, index, snapshot.duration - .05, .1, state);
        const next = actualSaved[actualSaved.indexOf(index) + 1] ?? (view.journey.loop ? actualSaved[0] : null);
        assert.equal(end.advance_to_scene_index, next); assert.equal(end.elapsed_seconds, 0);
        if (next === null) {assert.equal(end.scene_playing, false); assert.equal(end.saved_sequence_playing, false); assert.equal(end.completed, true)}
        const last = actualSaved.at(-1), lastSnapshot = view.journey.savedScenes[view.journey.scenes[last].id];
        const stopped = advanceSceneTransport({...view.journey, loop: false}, last, lastSnapshot.duration - .05, .1, state);
        assert.equal(stopped.completed, true); assert.equal(stopped.saved_sequence_playing, false);
        const looped = advanceSceneTransport({...view.journey, loop: true}, last, lastSnapshot.duration - .05, .1, state);
        assert.equal(looped.advance_to_scene_index, actualSaved[0]); assert.equal(looped.saved_sequence_playing, true);
        assert.equal(hash(document), nativeHash); assert.equal(hash(view), viewHash); savedTransports++;
      });
      observations.push({expression_ref: ref, revision: document.revision, document_sha256: nativeHash,
        scenes: reading.scenes.length, member_counts: reading.scenes.map(row => row.member_refs.length),
        timing: {working_available: reading.timing.working.available, saved_available: reading.timing.saved.available},
        completeness: reading.completeness});
    }
    assert.ok(presentMaterial > 0, 'Actual authored Scene material must be exercised');
    assert.ok(withheldMembers > 0, 'Actual native occurrences must exercise unavailable presentation correspondence');
    assert.ok(absentMembership > 0, 'Actual native work must exercise a subject absent from another Scene');
    assert.ok(transportScenes > 0 && savedTransports > 0, 'Actual authored Scenes and snapshots must exercise retained transport');
  } finally {
    for (const [ref, document] of before) {
      const after = await inspect(ref);
      assert.equal(after.revision, document.revision, 'Read-only acceptance cannot move native revisions');
      assert.equal(hash(after), hash(document), 'Native values and membership remain unchanged');
    }
  }
  assert.ok(effects.every(request => request.operation === 'inspect'));
  console.log(JSON.stringify({grade: 'B', kernel_url: url, passed: checks.length, faults: 0,
    claim: 'Scene projection and retained per-frame transport over actual native inspect reads; no GUI, audio rendering, editing or save acceptance',
    mutation_operations: 0, inspect_operations: effects.length, exercised: {present_material: presentMaterial, missing_material: missingMaterial,
      naturally_partial_pages: partialPages, withheld_correspondence_checks: withheldMembers, absent_membership: absentMembership,
      authored_scene_transports: transportScenes, saved_sequence_transports: savedTransports},
    unavailable_native_coverage: partialPages ? [] : ['The named existing works disclosed no naturally partial member page'],
    observations, checks, source_sha256}, null, 2));
}
