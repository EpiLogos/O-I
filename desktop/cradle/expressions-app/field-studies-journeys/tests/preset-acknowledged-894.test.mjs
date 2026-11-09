// O-I #747 round 894, found walking it: the Semantic Chakra Body added through the frame's editor was taken by the owner (one revision,
// seven centres, seven meanings), and the frame then refused the owner's answer, "Native acknowledgement does not contain the submitted
// composition; inspect before retrying", so every later edit stayed uncommitted. The preset's objects take fresh identities, but each kept
// the engine entity it was built from under the engine's own id (ent_semantic_muladhara …). The owner's correspondence
// (sceneCorrespondence.ts: "embedded native entity parameters still address this exact occurrence") writes the object's own id there, so
// the acknowledged document never read back as what was sent. A preset's object now addresses itself from the moment it is added.
// The modules are bundled from source into a private temp dir, so this test needs no application build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const {build}=require(path.resolve(root,'../node_modules/esbuild'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'oi-preset-ack-'));
const rcRoot=path.resolve(root,'../vendor/research-canvas');
const alias=Object.fromEntries(['schema','domain','desktop-api','geography','viewers','node-document'].map(name=>[`@research-canvas/${name}`,path.join(rcRoot,`packages/${name}/src/index.ts`)]));
const entries={model:'src/model.ts',bridge:'src/kernelDocumentBridge.ts',composition:'src/kernelComposition.ts',presets:'../../../../packages/expressions-boundary/src/nativePresets.ts'};
await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:entries,bundle:true,alias,jsx:'automatic',format:'esm',platform:'node',target:'es2022',outdir:out,outExtension:{'.js':'.mjs'},logLevel:'silent',
 loader:{'.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.css':'empty'}});
const load=name=>import(pathToFileURL(path.join(out,name+'.mjs')).href);
const {blankJourney,clone}=await load('model');
const {kernelDocumentToJourney}=await load('bridge');
const {prepareCompositionEdit,rebaseCompositionView}=await load('composition');
const {applyNativeFormationPresets,FORMATION_PRESETS}=await load('presets');
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));

function empty(ref,title){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:1,title,scenes:[{scene_ref:ref+':scene:main',revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[]};
}
// Serde reorders object keys and leaves an absent saved Scene out; the acknowledgement must not depend on either.
const reorderKeys=value=>Array.isArray(value)?value.map(reorderKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,reorderKeys(v)])):value;
// A controlled owner-port reducer (the Rust owner is tested in the kernel), as rich-material-roundtrip.test.mjs has it.
function ownerEdit(document,request){
 const d=clone(document),scene=ref=>d.scenes.find(s=>s.scene_ref===ref);
 for(const c of request.changes){switch(c.change){
  case 'rename':d.title=c.title;break;
  case 'composition_set':d.presentation=clone(c.presentation);break;
  case 'entity_add':d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O'}}};scene(c.scene_ref).entity_refs.push(c.entity_ref);break;
  case 'scene_compose':scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
  case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);if(!c.presentation.saved)delete scene(c.scene_ref).presentation.saved;break;
  default:assert.fail('Unexpected native operation '+c.change);
 }}
 if(request.changes.length)d.revision++;
 return reorderKeys(d);
}
/** An opened work the owner holds: a blank Expression, saved once, read back. */
function held(){
 const j=blankJourney(),d=empty('expression:preset','Presets');
 const view=kernelDocumentToJourney(d,{identity:{expression:j.id,scenes:{[d.scenes[0].scene_ref]:j.scenes[0].id}}});
 const native=ownerEdit(view.document,prepareCompositionEdit(view,view.journey));
 return rebaseCompositionView(view,view.journey,native);
}

test('a preset added through the editor reads back as what was sent once the owner takes it: the edit is acknowledged, not refused',()=>{
 for(const {preset} of FORMATION_PRESETS){
  const view=held(),sent=applyNativeFormationPresets(view.journey,view.journey.scenes[0].id,[{kind:'formation-preset',preset}]);
  const request=prepareCompositionEdit(view,sent);
  assert.ok(request.changes.some(change=>change.change==='entity_add'),`${preset}: the objects are added natively`);
  const taken=ownerEdit(view.document,request);
  // nativeWorking.ts editMatches: the owner's answer, read back over the sent work, holds nothing still to send.
  const again=prepareCompositionEdit(rebaseCompositionView(view,sent,taken),sent);
  assert.deepEqual(again.changes.map(change=>change.change),[],`${preset}: the owner's answer contains the submitted composition`);
 }
});

test('each object a preset adds carries its engine entity under its own identity, so the same preset added twice repeats no engine id',()=>{
 for(const {preset} of FORMATION_PRESETS){
  const view=held(),scene=view.journey.scenes[0].id;
  const twice=applyNativeFormationPresets(applyNativeFormationPresets(view.journey,scene,[{kind:'formation-preset',preset}]),scene,[{kind:'formation-preset',preset}]);
  const objects=twice.scenes[0].entities;
  for(const entity of objects)if(entity.native)assert.equal(entity.native.id,entity.id,`${preset}: ${entity.name}'s engine entity addresses this object`);
  const engine=objects.filter(entity=>entity.native).map(entity=>entity.native.id);
  assert.equal(new Set(engine).size,engine.length,`${preset}: no engine id repeats`);
 }
});

test('the app\'s own add-built-in and chakra-add give each added object\'s engine entity its new identity too, so the same edit on an owner-held work is acknowledged',()=>{
 const app=fs.readFileSync(path.join(root,'src/app.ts'),'utf8');
 const builtIn=app.split('\n').find(line=>line.includes("case 'add-built-in':"));
 assert.match(builtIn,/x\.id=uid\('entity'\);if\(x\.native\)x\.native=\{\.\.\.x\.native,id:x\.id\}/,'add-built-in: the engine entity takes the object\'s identity');
 const merge=app.slice(app.indexOf('function mergeSemanticStarter('),app.indexOf('function pathTarget('));
 assert.match(merge,/e\.id=eid;if\(e\.native\)e\.native=\{\.\.\.e\.native,id:eid\}/,'chakra-add: the engine entity takes the centre\'s identity');
});
