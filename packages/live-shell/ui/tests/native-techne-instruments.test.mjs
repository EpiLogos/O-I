import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const root=new URL('../../../../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href)};
import {readFile} from 'node:fs/promises';
export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;for(const suffix of ['.ts','.tsx'])try{return await n(s.endsWith('.js')?s.slice(0,-3)+suffix:s+suffix,c)}catch{}throw e}}
export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!/\\.tsx?$/.test(u))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(u).pathname}).outputText}}
`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},api]=await Promise.all([
 import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import('../src/native/techneInstrumentOpen.ts')]);
const path=process.env.OI_NATIVE_COMPOSITION_RECEIPT??'/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(path,'utf8')),document=receipt.after.document;
assert.deepEqual(document,receipt.before.document);
const blocked=()=>{throw Error('Source suite cannot dispatch native effects')};
function actualScope(){
 const view=kernelDocumentToJourney(document),store=new DocumentStore(view.journey),scene=store.document.scenes.find(s=>s.id===view.startSceneId)??store.document.scenes[0];
 const occurrence=view.bindings[scene.id].occurrences.find(o=>o.entity_ref===document.selection.entity_ref);
 const selection={entity_ids:occurrence?[occurrence.view_entity_id]:[],step_id:scene.entities[0]?.sequence.steps[0]?.id??null};
 const editor=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>view,nativeSelect:blocked,commit:blocked,change:f=>store.change(f),afterHistory:blocked,selectLocal:blocked,openEditor:blocked,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 return {workspaceId:'archived-owner-read',accessEpoch:2,accessReady:true,nativeAccessCurrent:e=>e===2,mode:'techne',editorReading:editor.read()};
}
test('every existing deep family captures the actual rich native basis without copying material',()=>{
 const scope=actualScope(),bytes=JSON.stringify(document);
 for(const lens of ['project','canvas','timeline','journey','place','palace']){
  const request=api.captureTechneInstrumentOpen(scope,lens);
  assert.equal(request.basis.expression_ref,document.expression_ref);assert.equal(request.basis.revision,document.revision);
  assert.equal(api.currentTechneInstrumentOpen(request,scope),true);
  assert.notEqual(request.selection,scope.editorReading.selection);assert.equal('scene' in request,false);
 }
 assert.equal(JSON.stringify(document),bytes);
});
test('workspace, access, native revision, authored revision, selection and pending changes refuse old presentation',()=>{
 const scope=actualScope(),request=api.captureTechneInstrumentOpen(scope,'canvas');
 const changes=[{workspaceId:'other'},{accessEpoch:3},{accessReady:false},{mode:'audio'},
  {editorReading:{...scope.editorReading,basis:{...scope.editorReading.basis,revision:document.revision+1}}},
  {editorReading:{...scope.editorReading,basis:{...scope.editorReading.basis,authored_revision:scope.editorReading.basis.authored_revision+1}}},
  {editorReading:{...scope.editorReading,selection:{...scope.editorReading.selection,step_id:'changed'}}},
  {editorReading:{...scope.editorReading,standing:{...scope.editorReading.standing,pending:true}}}];
 for(const change of changes)assert.equal(api.currentTechneInstrumentOpen(request,{...scope,...change}),false);
});
test('unavailable, concealed and wrong native adopted target never dispatch a successful host command',()=>{
 const scope=actualScope(),input=api.captureTechneInstrumentOpen(scope,'palace');let effects=0;
 const host={bindingId:'world.expressions',isReady:()=>false,getState:()=>null,selectInstrument:()=>{effects++;blocked()}};
 const receiver={host,current:()=>scope,isPresented:()=>true};
 assert.throws(()=>api.openRetainedTechneInstrument(receiver,input),/unavailable/);
 host.isReady=()=>true;assert.throws(()=>api.openRetainedTechneInstrument(receiver,input),/adopted/);
 assert.throws(()=>api.openRetainedTechneInstrument({...receiver,isPresented:()=>false},input),/unavailable/);
 assert.equal(effects,0);
});
test('malformed instrument identities and duplicated native selection are refused',()=>{
 const input=api.captureTechneInstrumentOpen(actualScope(),'timeline');
 for(const lens of ['Graph','places','factory','',null])assert.throws(()=>api.validateTechneInstrumentOpen({...input,lens}));
 assert.throws(()=>api.validateTechneInstrumentOpen({...input,selection:{entity_ids:['same','same'],step_id:null}}));
 assert.throws(()=>api.validateTechneInstrumentOpen({...input,basis:{...input.basis,revision:NaN}}));
});
test('receiver retirement removes its listener and unavailable native result stays a refusal',()=>{
 const scope=actualScope(),input=api.captureTechneInstrumentOpen(scope,'journey'),events=new EventTarget();let response;
 const stop=api.connectTechneInstrumentRequests({host:{bindingId:'world.expressions',isReady:()=>false},current:()=>scope,isPresented:()=>true},events);
 const detail={...input,complete:r=>response=r};
 const event=new Event(api.TECHNE_INSTRUMENT_OPEN);Object.assign(event,{detail});events.dispatchEvent(event);
 assert.equal(detail.handled,true);assert.equal(response.state,'refused');
 stop();const retired={...input,complete:blocked};const later=new Event(api.TECHNE_INSTRUMENT_OPEN);Object.assign(later,{detail:retired});events.dispatchEvent(later);assert.equal(retired.handled,undefined);
});
