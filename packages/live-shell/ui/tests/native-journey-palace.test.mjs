import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const root=new URL('../../../../',import.meta.url),author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href)};
import {readFile} from 'node:fs/promises';
export async function resolve(s,c,n){if(s.startsWith('@research-canvas/'))return n(new URL('packages/'+s.slice('@research-canvas/'.length)+'/src/index.ts',${JSON.stringify(new URL('desktop/cradle/expressions-app/vendor/research-canvas/',root).href)}).href,c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;for(const suffix of ['.ts','.tsx'])try{return await n(s.endsWith('.js')?s.slice(0,-3)+suffix:s+suffix,c)}catch{}throw e}}
export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!/\\.tsx?$/.test(u))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(u).pathname}).outputText}}
`)}`,import.meta.url);
const [journey,palace,{kernelDocumentToJourney}]=await Promise.all([import(new URL('journeyInstrumentModel.ts',author)),import(new URL('palaceInstrumentBasis.ts',author)),import(new URL('kernelDocumentBridge.ts',author))]);
const path=process.env.OI_NATIVE_COMPOSITION_RECEIPT??'/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(path,'utf8')),document=receipt.after.document;
assert.deepEqual(document,receipt.before.document);
const bytes=JSON.stringify(document),view=kernelDocumentToJourney(document),sceneId=view.startSceneId;
const {nativeInstrumentCanvas}=await import(new URL('researchInstrumentsData.ts',author));
const minimap=await import(new URL('desktop/cradle/src/shared/navigationMinimapGeometry.ts',root));
const find=await import(new URL('canvasFind.ts',author));
const {applyResearchMaterial}=await import(new URL('researchMaterial.ts',author));
const basis=journey.journeyInstrumentBasis(view,sceneId),nativeScene=document.scenes.find(s=>s.scene_ref===basis.scene_ref);
// This focus input is taken from the actual owner Scene. No native reading
// or successful operation reply is simulated; only production target guards
// are executed, and native transport is never installed.
const beat={expression_ref:document.expression_ref,revision:String(document.revision),scene_ref:nativeScene.scene_ref,title:nativeScene.title,frame:{subject_ref:nativeScene.scene_ref,temporal:[],places:[],sources:[]}};
test('Journey preserves the actual Expression/revision/Scene basis and focuses only its exact native Scene',()=>{
 assert.deepEqual(basis,{expression_ref:document.expression_ref,revision:document.revision,scene_ref:nativeScene.scene_ref});
 assert.equal(journey.sameJourneyInstrumentBasis(basis,view,sceneId),true);
 assert.deepEqual(journey.prepareJourneyBeatFocus(beat,basis,view,sceneId),{...basis,target_scene_ref:nativeScene.scene_ref});
 assert.equal(JSON.stringify(document),bytes);
});
test('Journey rejects absent, stale, foreign and undisclosed beat identity',()=>{
 assert.throws(()=>journey.journeyInstrumentBasis(undefined,sceneId));
 assert.equal(journey.sameJourneyInstrumentBasis({...basis,revision:basis.revision+1},view,sceneId),false);
 assert.throws(()=>journey.prepareJourneyBeatFocus({...beat,expression_ref:'expression:foreign'},basis,view,sceneId),/another/);
 assert.throws(()=>journey.prepareJourneyBeatFocus({...beat,revision:'old'},basis,view,sceneId),/revision/);
 assert.throws(()=>journey.prepareJourneyBeatFocus({...beat,scene_ref:'scene:absent'},basis,view,sceneId),/absent/);
 assert.throws(()=>journey.prepareJourneyBeatFocus(beat,{...basis,revision:basis.revision+1},view,sceneId),/changed/);
 assert.throws(()=>journey.readJourneyInstrument(null,view,sceneId),/invalid/);
});
test('Palace reads qualify actual owner source and Scene; stale, wrong source and duplicate Scene rows refuse',()=>{
 const captured=palace.palaceInstrumentBasis(view,sceneId);
 assert.equal(palace.samePalaceInstrumentBasis(captured,view,sceneId),true);
 palace.assertPalaceSource(document,captured);
 assert.throws(()=>palace.assertPalaceSource({...document,revision:document.revision+1},captured),/another/);
 assert.throws(()=>palace.assertPalaceSource({...document,expression_ref:'expression:foreign'},captured),/another/);
 assert.throws(()=>palace.assertPalaceSource({...document,scenes:[]},captured),/another/);
 assert.throws(()=>palace.assertPalaceSource({...document,scenes:[...document.scenes,nativeScene]},captured),/another/);
 assert.equal(palace.samePalaceInstrumentBasis(captured,undefined,sceneId),false);
});
test('Palace readback checks explicit region order and exact contained target, rather than set membership',()=>{
 const actual=document.scenes.map(scene=>({name:scene.title,scene_ref:scene.scene_ref,member:scene.body?.carrier==='expression_ref'?{expression_ref:scene.body.subject_ref,title:scene.title}:null}));
 assert.equal(palace.samePalaceComposition(actual,actual),true);
 assert.equal(palace.samePalaceComposition(actual,[...actual,{...actual[0],name:'duplicate'}]),false);
 assert.equal(palace.samePalaceComposition(actual,actual.map((item,index)=>index?item:{...item,name:item.name+' changed'})),false);
 assert.equal(palace.samePalaceComposition(actual,actual.map((item,index)=>index?item:{...item,member:{expression_ref:'expression:wrong',title:''}})),false);
 assert.equal(JSON.stringify(document),bytes);
});
test('shared overview bounds the actual native Canvas card extents without changing source rows',()=>{
 const canvas=nativeInstrumentCanvas(view,sceneId),points=canvas.nodes.map(node=>({id:node.id,x:node.position.x+node.size.width/2,y:node.position.y+node.size.height/2,width:node.size.width,height:node.size.height}));
 assert.ok(points.length);const projection=minimap.projectNavigationMinimap(points,{width:160,height:104});assert.ok(projection);
 for(const node of canvas.nodes){
  assert.ok(projection.bounds.left<=node.position.x);assert.ok(projection.bounds.top<=node.position.y);
  assert.ok(projection.bounds.right>=node.position.x+node.size.width);assert.ok(projection.bounds.bottom>=node.position.y+node.size.height);
  assert.ok(canvas.occurrences.has(node.id));
 }
 assert.equal(JSON.stringify(document),bytes);
});
test('Find searches actual native titles/card text, cycles exact occurrences and leaves source untouched',()=>{
 const canvas=nativeInstrumentCanvas(view,sceneId),targets=find.canvasFindTargets(canvas),node=canvas.nodes[0];
 assert.ok(targets.length);const hits=find.findCanvasTargets(targets,node.title);assert.ok(hits.some(hit=>hit.ref===node.id));
 assert.deepEqual(find.findCanvasTargets(targets,''),[]);assert.deepEqual(find.findCanvasTargets(targets,'a-word-that-the-actual-source-does-not-contain-91836'),[]);
 assert.equal(find.cycleCanvasFindTarget(hits,undefined,1),hits[0]);assert.equal(find.cycleCanvasFindTarget(hits,hits.at(-1).key,1),hits[0]);assert.equal(find.cycleCanvasFindTarget(hits,hits[0].key,-1),hits.at(-1));
 assert.deepEqual(find.resolveCanvasFindTarget(hits[0],canvas),targets.find(row=>row.key===hits[0].key));
 assert.equal(JSON.stringify(document),bytes);
});
test('Find includes a real reducer-authored frame over actual native occurrences, with no invented member',()=>{
 const converted=kernelDocumentToJourney(document),scene=converted.journey.scenes.find(row=>row.id===sceneId),canvas=nativeInstrumentCanvas(converted,sceneId),members=Array.from(canvas.occurrences.values());
 applyResearchMaterial(scene,{type:'frame-save',id:'source-verification-frame',label:'Source verification frame',memberRefs:members});
 const frames=scene.research.frames,targets=find.canvasFindTargets(canvas,frames),hits=find.findCanvasTargets(targets,'Source verification frame');
 assert.equal(hits.length,1);assert.equal(hits[0].kind,'frame');assert.equal(hits[0].ref,'source-verification-frame');assert.deepEqual(hits[0].node_ids,canvas.nodes.map(node=>node.id));
 assert.deepEqual(find.canvasFindTargets(canvas,{...frames,'partial-frame':{label:'Partial',memberRefs:[members[0],'absent-occurrence'],z:99}}).filter(row=>row.ref==='partial-frame'),[]);
 const camera=find.canvasFindCamera(hits[0],canvas,{width:1200,height:800},1);assert.ok(camera.zoom>0&&camera.zoom<=1);
 assert.equal(JSON.stringify(document),bytes);
});
test('Find refuses stale content, source, member set and absent viewport before a selection route',()=>{
 const canvas=nativeInstrumentCanvas(view,sceneId),target=find.canvasFindTargets(canvas)[0];
 assert.equal(find.resolveCanvasFindTarget(target,{...canvas,key:'another-native-scene'}),undefined);
 assert.equal(find.resolveCanvasFindTarget(target,{...canvas,nodes:canvas.nodes.map(node=>node.id===target.ref?{...node,title:node.title+' changed'}:node)}),undefined);
 const missing=new Map(canvas.occurrences);missing.delete(target.ref);assert.equal(find.resolveCanvasFindTarget(target,{...canvas,occurrences:missing}),undefined);
 assert.throws(()=>find.canvasFindCamera(target,canvas,{width:0,height:800},1),/actual Canvas viewport/);
 assert.throws(()=>find.canvasFindCamera({...target,node_ids:['absent']},canvas,{width:1200,height:800},1),/members changed/);
 assert.equal(JSON.stringify(document),bytes);
});
