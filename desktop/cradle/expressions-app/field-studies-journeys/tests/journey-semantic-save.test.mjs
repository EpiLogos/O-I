// lane-5 T20: semantic saving. The kernel Expression is the only store of record. Every proposal carries the captured
// revision; a stale revision is refused loudly with the draft intact; replaying an applied composition emits nothing; one
// edit is bounded (256 changes) and is refused whole, never truncated. Proved over the existing floors (kernelComposition).
// Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney, entity, clone, validateJourney} from '../build/model.js';
import {initialiseSceneSaves} from '../build/sceneWorkflow.js';
import {kernelDocumentToJourney} from '../build/kernelDocumentBridge.js';
import {prepareCompositionEdit, rebaseCompositionView, acceptCompositionReply} from '../build/kernelComposition.js';

function empty(ref='expression:test',title='Test'){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:1,title,scenes:[{scene_ref:ref+':scene:main',revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
}
const reorderKeys=value=>Array.isArray(value)?value.map(reorderKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,reorderKeys(v)])):value;
function ownerEdit(document,request){
 if(request.expected_revision!==document.revision)return {state:'revision_conflict',current_revision:document.revision};
 const d=clone(document),scene=ref=>d.scenes.find(s=>s.scene_ref===ref);
 for(const c of request.changes){switch(c.change){
  case 'rename':d.title=c.title;break;
  case 'composition_set':d.presentation=clone(c.presentation);break;
  case 'scene_create':d.scenes.push({scene_ref:c.scene_ref,title:c.title,revision:1,entity_refs:[]});break;
  case 'entity_add':d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O'}}};scene(c.scene_ref).entity_refs.push(c.entity_ref);break;
  case 'scene_rename':scene(c.scene_ref).title=c.title;if(scene(c.scene_ref).presentation)scene(c.scene_ref).presentation.scene.name=c.title;break;
  case 'scene_compose':scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
  case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);if(!c.presentation.saved)delete scene(c.scene_ref).presentation.saved;break;
  case 'scene_remove':d.scenes=d.scenes.filter(s=>s.scene_ref!==c.scene_ref);break;
  case 'scene_reorder':d.scenes=c.scene_refs.map(scene);break;
  case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
  case 'relation_focus':d.selection={scene_ref:c.scene_ref,entity_ref:null,relation_ref:c.binding_ref};break;
  default:assert.fail('Unexpected native operation '+c.change);
 }}
 if(request.changes.length)d.revision++;
 return {state:'ready',document:reorderKeys(d)};
}
function authored() {
  const j = initialiseSceneSaves(blankJourney());
  j.name = 'A working inquiry';
  j.scenes[0].name = 'First';
  j.scenes[0].entities = [entity('source role', 'A')];
  return j;
}
const snapshot = (j) => ({journey: j, sceneId: j.scenes[0].id, entityId: j.scenes[0].entities[0]?.id ?? null});
function seed(j) {
  const d = empty('expression:whole', j.name);
  return kernelDocumentToJourney(d, {identity: {expression: j.id, scenes: {[d.scenes[0].scene_ref]: j.scenes[0].id}}});
}

test('T20: a save under a stale revision is refused loudly; no document is adopted and the draft is intact', () => {
  const j = authored();
  const view = seed(j);
  const draft = clone(j);
  const request = prepareCompositionEdit(view, j, snapshot(j));
  // The owner moved on after the draft was captured.
  const moved = {...view.document, revision: view.document.revision + 1};
  const reply = ownerEdit(moved, request);
  assert.equal(reply.state, 'revision_conflict');
  assert.throws(() => acceptCompositionReply(request, reply), /revision_conflict/);
  assert.deepEqual(j, draft, 'the draft is untouched by the refused save');
  assert.equal(request.expected_revision, view.document.revision, 'the proposal carries the captured revision, never a fresh one');
});

test('T20: replaying an applied composition emits nothing: the second save of the same draft is a no-op', () => {
  const j = authored();
  const view = seed(j);
  const first = prepareCompositionEdit(view, j, snapshot(j));
  assert.ok(first.changes.length > 0, 'the first save carries the composition');
  const applied = acceptCompositionReply(first, ownerEdit(view.document, first));
  const rebased = rebaseCompositionView(view, j, applied);
  assert.equal(prepareCompositionEdit(rebased, j, snapshot(j)).changes.length, 0, 'a replayed composition proposes no change');
});

test('T20: one edit carries at most 256 changes; an over-budget composition is refused whole and nothing is truncated', () => {
  const j = authored();
  const view = seed(j);
  // The journey bound is 64 scenes; 60 scenes of two new objects each (scene_create, two entity_add, scene_compose, scene_material_set)
  // carry 300 changes, over the 256-operation budget, yet every scene is a valid member of the journey.
  const template = clone(j.scenes[0]);
  for (let index = 0; index < 60; index++) j.scenes.push({...clone(template), id: `probe-scene-${index}`, name: `Probe ${index}`, entities: [entity('probe a', 'A'), entity('probe b', 'B')]});
  assert.equal(validateJourney(j).id, j.id);
  assert.throws(() => prepareCompositionEdit(view, j, snapshot(j)), /256-operation budget; no work was truncated or submitted/);
});
