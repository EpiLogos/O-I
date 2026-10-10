import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const root=new URL('../../../',import.meta.url);
const compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
 try{return await next(specifier,context)}catch(error){
  if(!specifier.startsWith('.'))throw error;
  if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
  for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
  throw error;
 }
}
export async function load(url,context,next){
 if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},{NativeWorking},workflow,{prepareCompositionEdit},{evaluateTracks,readTrackValue,sampleTrack,mergeTake},{advanceSceneTransport,nativeSceneTransportMaterial}]=await Promise.all([
 import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import(new URL('nativeWorking.ts',author)),
 import(new URL('sceneWorkflow.ts',author)),import(new URL('kernelComposition.ts',author)),import(new URL('propertyTracks.ts',author)),import(new URL('sceneTransport.ts',author)),
]);
const receiptPath=process.env.OI_NATIVE_COMPOSITION_RECEIPT??'/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(receiptPath,'utf8')),document=receipt.after.document;
assert.deepEqual(document,receipt.before.document);
const bytes=JSON.stringify(document);
function retained(){
 const original=kernelDocumentToJourney(document),store=new DocumentStore(original.journey),checkpoints=[];let currentId=original.startSceneId,epoch=0,recording=false,pending=false;
 const effects=[];let readingView=value=>value;
 const closed=()=>{throw Error('Native writes and live transport effects are closed during source verification')};
 const work=new NativeWorking({expression:closed,file:closed,mint:closed,checkpoint:async(id,record)=>{checkpoints.push(structuredClone(record));return closed()}});
 work.restore({schema:'oi.native-working/v1',draft_id:original.journey.id,view:original},store.document);
 const owner=createRetainedNativeEditor({store,sceneId:()=>currentId,selection:()=>({entity_ids:[],step_id:null}),nativeView:()=>readingView(work.state.view),
  nativeSelect:async(id,entityId)=>{effects.push(['focus',id,entityId]);await work.select({scene_ref:original.bindings[id].scene_ref,entity_ref:entityId});return 'applied'},
  commit:async()=>{await work.commit({journey:structuredClone(store.document),sceneId:currentId,entityId:null});return true},change:fn=>store.change(fn),afterHistory:closed,selectLocal:closed,openEditor:closed,
  standing:()=>({busy:pending,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false,
  sceneControls:{read:()=>({scene_ref:original.bindings[currentId]?.scene_ref??'',scene_elapsed_seconds:0,expression_time_seconds:0,scene_playing:false,saved_sequence_playing:false,field_paused:false,track_preview:false,intent_epoch:epoch}),recording:()=>recording,
   focus:closed,transport:closed,seek:closed,
   snapshot:input=>{effects.push(['snapshot',input.action]);store.change(()=>{const scene=store.document.scenes.find(s=>s.id===currentId);if(input.action==='restore-snapshot')assert.equal(workflow.restoreScene(store.document,scene.id),true);else{workflow.saveScene(store.document,scene,input.name);if(input.next)currentId=workflow.nextSceneFrom(store.document,scene).id;}})},
  }});
 const request=(action,extra={})=>({operation:'scene',basis:owner.read().basis,intent_epoch:epoch,action,...extra});
 return {owner,store,original,request,effects,checkpoints,work,setEpoch:v=>{epoch=v},setRecording:v=>{recording=v},setPending:v=>{pending=v},withhold:fn=>{readingView=fn}};
}
test('Scene reading joins actual native order, saved material and distinct transport disclosure without mutation',()=>{
 const r=retained(),reading=r.owner.read();assert.equal(reading.scenes.basis.expression_ref,document.expression_ref);assert.equal(reading.scenes.basis.revision,document.revision);
 assert.deepEqual(reading.scenes.native_order,document.scenes.map(s=>s.scene_ref));assert.equal(reading.playback.intent_epoch,0);assert.equal(r.store.undoStack.length,0);assert.equal(JSON.stringify(document),bytes);
});
test('exact native/authored/transport basis, lifetime and pending human gesture refuse before effects',async()=>{
 for(const key of ['expression_ref','scene_ref','revision','authored_revision']){const r=retained(),request=r.request('pause');request.basis[key]=typeof request.basis[key]==='number'?request.basis[key]+1:request.basis[key]+':other';await assert.rejects(r.owner.scene(request),/captured Scene/);assert.equal(r.effects.length,0);}
 const r=retained(),request=r.request('pause');r.setEpoch(1);await assert.rejects(r.owner.scene(request),/transport intent changed/);assert.equal(r.effects.length,0);
 await assert.rejects(r.owner.scene(r.request('pause'),()=>false),/editor lifetime/);
 r.setPending(true);await assert.rejects(r.owner.scene(r.request('pause')),/awaiting acknowledgement/);r.setPending(false);
 r.store.begin();await assert.rejects(r.owner.scene(r.request('pause')),/current human gesture/);assert.equal(r.effects.length,0);
});
test('unavailable target, malformed operands, invented saved seek and recording refuse without owner writes',async()=>{
 const r=retained(),scene_ref=r.owner.read().basis.scene_ref;
 for(const request of [r.request('focus',{scene_ref:'scene:undisclosed'}),r.request('seek',{scene_ref,seconds:-1,sequence:'working'}),r.request('seek',{scene_ref,seconds:Infinity,sequence:'working'}),r.request('seek',{scene_ref,seconds:0,sequence:'saved'}),r.request('play',{beat:1}),r.request('save-snapshot',{name:' ',next:false})])await assert.rejects(r.owner.scene(request));
 r.setRecording(true);await assert.rejects(r.owner.scene(r.request('pause')),/parameter recording/);assert.equal(r.effects.length,0);assert.equal(r.checkpoints.length,0);
});
test('native focus stages exact null-focus CAS before the closed owner boundary and never adopts locally',async()=>{
 const r=retained(),request=r.request('focus',{scene_ref:r.owner.read().basis.scene_ref}),before=structuredClone(r.store.document);
 await assert.rejects(r.owner.scene(request),/Native writes/);
 assert.deepEqual(r.effects,[['focus',r.original.startSceneId,null]]);assert.equal(r.checkpoints.length,1);
 const native=r.checkpoints[0].pending.request;assert.equal(native.expected_revision,document.revision);assert.deepEqual(native.changes,[{change:'focus',scene_ref:request.scene_ref,entity_ref:null}]);
 assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);assert.equal(JSON.stringify(document),bytes);
});
test('saved Scene capture retains a real draft and exact compiler CAS on native refusal; one Undo restores it',async()=>{
 const r=retained(),before=structuredClone(r.store.document),request=r.request('save-snapshot',{name:'Bounded retained source snapshot',next:false});
 await assert.rejects(r.owner.scene(request),/Native writes/);assert.equal(r.store.undoStack.length,1);assert.equal(r.checkpoints.length,1);
 const scene=r.store.document.scenes.find(s=>r.original.bindings[s.id]?.scene_ref===request.basis.scene_ref);assert.equal(scene.name,request.name);assert.deepEqual(r.store.document.savedScenes[scene.id],scene);
 const compiled=prepareCompositionEdit(r.original,r.store.document);assert.equal(compiled.expected_revision,document.revision);assert.ok(compiled.changes.some(c=>c.change==='scene_material_set'&&c.scene_ref===request.basis.scene_ref&&c.presentation.saved.name===request.name));
 assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);assert.equal(r.store.redo(),true);assert.equal(r.store.document.savedScenes[scene.id].name,request.name);assert.equal(JSON.stringify(document),bytes);
});
test('actual save-and-next creates a distinct Scene and captured material while next remains a draft',async()=>{
 const r=retained(),ids=r.store.document.scenes.map(s=>s.id),request=r.request('save-snapshot',{name:'Saved before actual next draft',next:true});
 await assert.rejects(r.owner.scene(request),/Native writes/);const next=r.store.document.scenes.find(s=>!ids.includes(s.id));assert.ok(next);assert.equal(r.store.document.savedScenes[next.id],undefined);
 const native=prepareCompositionEdit(r.original,r.store.document);assert.equal(native.expected_revision,document.revision);assert.ok(native.changes.some(c=>c.change==='scene_create'));assert.equal(r.store.undoStack.length,1);
});
test('restore uses the actual saved material, preserves pointer scope and remains one recoverable human transaction',async()=>{
 const r=retained(),scene=r.store.document.scenes.find(s=>s.id===r.original.startSceneId);assert.ok(r.store.document.savedScenes[scene.id]);
 scene.duration=scene.duration===17?18:17;scene.pointerScope='local';const before=structuredClone(r.store.document);
 await assert.rejects(r.owner.scene(r.request('restore-snapshot')),/Native writes/);
 const actual=r.store.document.scenes.find(s=>s.id===scene.id),saved=r.store.document.savedScenes[scene.id];assert.equal(actual.duration,saved.duration);assert.equal(actual.pointerScope,'local');assert.equal(r.store.undoStack.length,1);r.store.undo();assert.deepEqual(r.store.document,before);
});
test('real retained Scene frame evaluator holds hidden/recording work and does not mutate source or rewind a field',()=>{
 const r=retained(),index=r.store.document.scenes.findIndex(s=>s.id===r.original.startSceneId),scene=r.store.document.scenes[index],before=structuredClone(r.store.document);
 const state={playing:true,savedSequence:false,hidden:false,libraryOpen:false,propertyRecording:false,editing:false,authoredSceneIds:nativeSceneTransportMaterial(r.original)};
 let elapsed=0;for(let i=0;i<10;i++)elapsed=advanceSceneTransport(r.store.document,index,elapsed,.05,state).elapsed_seconds;assert.ok(Math.abs(elapsed-.5)<1e-10);
 for(const patch of [{hidden:true},{propertyRecording:true},{libraryOpen:true}])assert.equal(advanceSceneTransport(r.store.document,index,elapsed,.05,{...state,...patch}).elapsed_seconds,elapsed);
 const evaluated=evaluateTracks(scene,.2);assert.ok(evaluated);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});

test('compatibility-only native material cannot admit playing and partial correspondence cannot admit whole snapshots',async()=>{
 const compatibility=retained();compatibility.withhold(view=>{delete view.document.scenes.find(s=>s.scene_ref===view.bindings[view.startSceneId].scene_ref).presentation;return view});
 await assert.rejects(compatibility.owner.scene(compatibility.request('play')),/pacing is not disclosed/);
 await assert.rejects(compatibility.owner.scene(compatibility.request('play-saved')),/authored native Scene/);
 assert.equal(compatibility.effects.length,0);
 const partial=retained();partial.withhold(view=>{view.bindings[view.startSceneId].member_refs=[];return view});
 await assert.rejects(partial.owner.scene(partial.request('save-snapshot',{name:'Must not overwrite hidden native material',next:false})),/complete authored/);
 await assert.rejects(partial.owner.scene(partial.request('restore-snapshot')),/complete authored/);
 assert.equal(partial.effects.length,0);assert.equal(partial.checkpoints.length,0);assert.equal(partial.store.undoStack.length,0);assert.equal(JSON.stringify(document),bytes);
});

test('actual property take sampling keeps held values and replaces only its authored interval',()=>{
 const r=retained(),scene=r.store.document.scenes.find(s=>s.id===r.original.startSceneId),entity=scene.entities[0],before=structuredClone(scene);
 const bind='entity.position.x',initial=readTrackValue(scene,{bind,entityId:entity.id});assert.ok(Number.isFinite(initial));
 const changed=initial+.01,track={id:'source-test:bounded-take',bind,entityId:entity.id,points:[]};
 sampleTrack(track,0,initial,0);sampleTrack(track,.05,initial,0);sampleTrack(track,.1,changed,.05);
 assert.deepEqual(track.points,[{time:0,value:initial},{time:.05,value:initial},{time:.1,value:changed}]);
 const original={...track,points:[{time:0,value:initial},{time:.05,value:initial},{time:.1,value:initial},{time:.2,value:initial}]};
 const merged=mergeTake([original],[track],0,.1);assert.equal(merged[0].points.at(-1).time,.2);assert.equal(merged[0].points.at(-1).value,initial);
 const evaluated=evaluateTracks({...scene,propertyTracks:merged},.075);assert.ok(Math.abs(evaluated.entities[0].position.x-(initial+changed)/2)<1e-10);
 assert.deepEqual(scene,before);assert.equal(r.store.undoStack.length,0);assert.equal(JSON.stringify(document),bytes);
});
