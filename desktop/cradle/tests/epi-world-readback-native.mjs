#!/usr/bin/env node
/** Actual issued-CAS -> native-owner readback -> production loading adapter.
 * No bridge, fake owner, fabricated positive document, renderer or provider.
 * Config: issued_cas_file, document_file, prepared_file, output; optional
 * plan_file is an actual retained producer plan. Without it, ONLY the helper's
 * expected input is recovered from the original issued request, never from
 * the actual owner readback. That is adapter fidelity, not producer semantics.
 */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw Error('Supply an actual original issued-CAS/readback configuration.');
const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.ok(path.isAbsolute(config.output) && config.output.includes('/Control/agents/now/clearings/') && config.output.includes('/T/'));
await mkdir(config.output, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = [];
async function artifact(key) {
  assert.ok(path.isAbsolute(config[key]), `${key} must be the real artifact's absolute path`);
  const bytes = await readFile(config[key]);
  sources.push({role: key, path: config[key], sha256: hash(bytes)});
  return JSON.parse(bytes);
}
const issued = await artifact('issued_cas_file');
const owned = await artifact('document_file');
const prepared = await artifact('prepared_file');
assert.equal(issued.request?.op, 'expression', 'Retain the original issued native transport packet.');
const edit = issued.request.request;
assert.equal(edit.operation, 'edit');
assert.equal(edit.changes.length, 219, 'This regression concerns the actual ordinary-entry construction CAS.');
assert.match(edit.expression_ref, /^expression:epi-/);
if (issued.response) {
  assert.equal(issued.response.ok, true, 'Use the actual successful CAS, not the refused predecessor.');
  assert.equal(issued.response.outcome.data.state, 'ready');
}
assert.equal(owned.response.ok, true);
const document = owned.response.outcome.data.document;
assert.equal(document.expression_ref, edit.expression_ref);
assert.equal(document.revision, edit.expected_revision + 1);
assert.equal(prepared.response.ok, true);
const nativeWorld = prepared.response.outcome.data.source.world;
assert.equal(nativeWorld.schema, 'ql.scene-world/v1');
assert.equal(nativeWorld.instance_ref, edit.expression_ref);

const materialChanges = edit.changes.filter(change => change.change === 'scene_material_set');
assert.equal(materialChanges.length, 3);
const liveChanges = materialChanges.filter(change => change.presentation.scene.epiWorld);
assert.equal(liveChanges.length, 1);
const live = liveChanges[0].presentation.scene.epiWorld;
assert.equal(live.schema, 'oi.epi-world-material/v1');
assert.equal(live.world.schema, 'oi.epi-portable-world/v1');
assert.equal(live.world.instance_ref, nativeWorld.instance_ref);
assert.equal(live.person_ref, nativeWorld.subject_ref);
assert.equal(live.world.event_ref, nativeWorld.event_ref);
assert.deepEqual(live.world.basis, nativeWorld.basis);
assert.deepEqual(live.world.sky, nativeWorld.sky);
assert.equal(live.receiving.personal.canonical_locus, 'ql:m-coordinate:bimba:M4.4.4.4');

// The issued subject and entity changes are the expectation for readback.
// Reading them from the owner document would make this a false self-pass.
const subjects = new Map();
const additions = edit.changes.filter(change => change.change === 'entity_add');
for (const change of edit.changes) if (change.change === 'subject_bind') subjects.set(change.entity_ref, change.binding);
assert.ok(additions.length > 0);
const requestedScenes = materialChanges.map(change => {
  const scene = structuredClone(change.presentation.scene);
  delete scene.epiWorld;
  return scene;
});
let plan, planBasis;
if (config.plan_file) {
  plan = await artifact('plan_file');
  assert.equal(plan.standing, 'prepared-native-edit');
  assert.equal(plan.edit.expression_ref, edit.expression_ref);
  assert.equal(plan.edit.expected_revision, edit.expected_revision);
  // The coordinator appends the live carrier before CAS. The original plan's
  // authored scenes/occurrences stay independent; its actual issued edit is
  // supplied explicitly to the verifier under test.
  plan.edit = structuredClone(edit);
  planBasis = 'Actual retained producer plan; edit replaced only with the original complete issued CAS, including its coordinator-added live carrier.';
} else {
  const occurrences = additions.map(change => {
    const material = requestedScenes.flatMap(scene => scene.entities).find(entity => entity.id === change.entity_ref);
    assert.ok(material, `Original issued material is missing ${change.entity_ref}`);
    assert.ok(subjects.has(change.entity_ref), `Original issued native binding is missing ${change.entity_ref}`);
    return {material: structuredClone(material), subject: structuredClone(subjects.get(change.entity_ref))};
  });
  plan = {edit: structuredClone(edit), scenes: requestedScenes, occurrences, receiving: structuredClone(live.receiving)};
  planBasis = 'Minimum helper input recovered from the original issued CAS and its retained receiving declaration. No original raw producer plan/input was available. Expectations were not recovered from native owner readback.';
}
const canonicalLocus = plan.receiving.personal.locus_entity_ref;
assert.equal(subjects.get(canonicalLocus)?.subject_ref, 'ql:m-coordinate:bimba:M4.4.4.4');
const earth = [...subjects].find(([, subject]) => subject.subject_ref === 'ql:m-coordinate:bimba:M2-5-0/1-0')?.[0];
assert.ok(earth, 'The original issued CAS must contain the exact canonical EarthBody, independently of its label.');
const cosmic = materialChanges.find(change => change.scene_ref === live.receiving.scene_ref);
assert.ok(cosmic.presentation.scene.entities.some(entity => entity.id === earth));
const modulePath = root + '/expressions-app/field-studies-journeys/src/epiWorldMaterial.ts';
const sourceBytes = await readFile(modulePath), sourceHash = hash(sourceBytes);
const bundle = config.output + `/epi-world-readback-${sourceHash}.mjs`;
await build({stdin: {contents: `export {verifyEpiWorldReadback} from ${JSON.stringify(modulePath)};`, resolveDir: root, sourcefile: 'actual-world-readback-helper.ts', loader: 'ts'}, outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'warning'});
const {verifyEpiWorldReadback} = await import(pathToFileURL(bundle).href);
const view = verifyEpiWorldReadback(document, plan);
for (const change of materialChanges) {
  const actual = document.scenes.find(scene => scene.scene_ref === change.scene_ref);
  assert.deepEqual(actual.presentation, change.presentation, 'Complete actual Scene carrier must equal the original issued request.');
  const binding = Object.values(view.bindings).find(binding => binding.scene_ref === change.scene_ref);
  assert.equal(binding.loaded_refs.length, change.presentation.scene.entities.length);
  assert.equal(binding.hidden_refs.length, 0);
  assert.equal(binding.page_count, 1);
}
assert.equal(view.journey.scenes.length, 3);
assert.deepEqual(document.scenes.map(scene => scene.entity_refs.length), [32, 9, 7]);

const cases = [];
const sceneOf = value => value.scenes.find(scene => scene.scene_ref === cosmic.scene_ref);
let changed = structuredClone(document);
sceneOf(changed).presentation.scene.entities = sceneOf(changed).presentation.scene.entities.filter(entity => entity.id !== earth);
assert.deepEqual(sceneOf(changed).presentation.scene.epiWorld, live);
assert.deepEqual(changed.entities, document.entities);
assert.deepEqual(changed.profiles, document.profiles);
cases.push(['remove-only-required-expressive-Earth-body-with-metadata-retained', changed, /complete required expressive material/]);
changed = structuredClone(document);
changed.entities[canonicalLocus].subject.subject_ref = 'ql:m-coordinate:bimba:M4.4.4.3';
assert.equal(changed.entities[canonicalLocus].title, document.entities[canonicalLocus].title);
cases.push(['same-labelled-wrong-personal-branch', changed, /absent or incorrectly bound|wrong same-labelled branch/]);
changed = structuredClone(document);
delete sceneOf(changed).presentation.scene.epiWorld;
assert.deepEqual(changed.entities, document.entities);
cases.push(['remove-only-coordinator-live-receipt', changed, /complete required expressive material/]);
changed = structuredClone(document);
const changedEarth = sceneOf(changed).presentation.scene.entities.find(entity => entity.id === earth);
changedEarth.tint = changedEarth.tint === '#ff00ff' ? '#00ff00' : '#ff00ff';
cases.push(['corrupt-required-artistic-body-with-live-receipt-retained', changed, /complete required expressive material/]);
changed = structuredClone(document);
assert.ok(sceneOf(changed).presentation.saved);
sceneOf(changed).presentation.saved.name += ' corrupted';
cases.push(['corrupt-only-artistic-saved-material', changed, /complete required expressive material/]);
changed = structuredClone(document);
delete changed.entities[earth];
cases.push(['remove-native-body-while-scene-and-live-metadata-remain', changed, /absent or incorrectly bound/]);
changed = structuredClone(document);
sceneOf(changed).entity_refs = sceneOf(changed).entity_refs.filter(ref => ref !== earth);
cases.push(['remove-only-native-scene-member', changed, /complete required expressive material/]);
changed = structuredClone(document);
assert.ok(changed.entities[earth].subject.sources.length > 0);
changed.entities[earth].subject.sources.pop();
cases.push(['lose-native-source-binding-with-artistic-body-retained', changed, /absent or incorrectly bound/]);
const negatives = [];
for (const [name, value, expected] of cases) {
  let refusal;
  assert.throws(() => verifyEpiWorldReadback(value, plan), error => {
    refusal = String(error.message);
    assert.match(refusal, expected, `${name} must reach its intended material/source guard`);
    return true;
  });
  negatives.push({case: name, refused: true, reason: refusal});
}
assert.equal(hash(await readFile(modulePath)), sourceHash, 'The owner helper changed during independent replay.');
const receipt = {
  schema: 'oi.epi-world-readback-native-regression/v1', passed: true,
  standing: 'Actual original issued CAS/native owner readback/production loading-adapter proof; no producer numerical correctness, rendered pixels, native consumer effect, audio, durable file/restart, managed installed or human acceptance.',
  plan_basis: planBasis, artifacts: sources,
  source: {path: modulePath, sha256: sourceHash},
  test: {path: fileURLToPath(import.meta.url), sha256: hash(await readFile(fileURLToPath(import.meta.url)))},
  bundle: {path: bundle, sha256: hash(await readFile(bundle))},
  expression_ref: document.expression_ref, revision: document.revision, issued_changes: edit.changes.length,
  scenes: document.scenes.map(scene => ({scene_ref: scene.scene_ref, native_members: scene.entity_refs.length,
    loaded_members: Object.values(view.bindings).find(binding => binding.scene_ref === scene.scene_ref).loaded_refs.length})),
  live_carrier: {schema: live.world.schema, person_ref: live.person_ref, event_ref: live.world.event_ref},
  negative_cases: negatives
};
const output = config.output + '/epi-world-readback-native-receipt.json';
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({passed: true, negative_cases: negatives.length, receipt: output, sha256: hash(await readFile(output))}, null, 2));
