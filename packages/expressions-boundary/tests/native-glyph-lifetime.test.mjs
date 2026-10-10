import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
import ts from '../../../desktop/cradle/node_modules/typescript/lib/typescript.js';
const [{sameEditorBasis},{kernelDocumentToJourney},{DocumentStore},{NativeWorking},{createRetainedNativeEditor,installNativeEditorReceiver},{stateSource},{toNativeEntity}]=await Promise.all([
 import('../src/editor.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/sourceState.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge.ts'),
]);

const sourcePath=new URL('../../live-shell/ui/src/components/GlyphSequenceEditor.tsx',import.meta.url);
const source=ts.createSourceFile('GlyphSequenceEditor.tsx',await readFile(sourcePath,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function nodes(predicate){const result=[];function walk(node){if(predicate(node))result.push(node);ts.forEachChild(node,walk)}walk(source);return result}
function execute(name,bindings={}) {
 const node=nodes(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)[0];assert.ok(node,name);
 const body=ts.transpileModule(node.getText(source).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:'receive.tsx'}).outputText;
 return new Function(...Object.keys(bindings),body+`\nreturn ${name};`)(...Object.values(bindings));
}
const currentGlyphReply=execute('currentGlyphReply',{sameEditorBasis});
const reconcileGlyphSelection=execute('reconcileGlyphSelection');
const glyphThumbnailMaterial=execute('glyphThumbnailMaterial',{stateSource});
const inputPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(inputPath,'utf8'));
assert.deepEqual(receipt.before.document,receipt.after.document);
const nativeDocument=receipt.after.document,closed=Error('Native effects remain closed during Glyph source verification');
function retained(t,checkpoint=()=>{throw closed}) {
 const view=kernelDocumentToJourney(nativeDocument),store=new DocumentStore(view.journey),scene=store.document.scenes.find(row=>row.id===view.startSceneId),entity=scene.entities.find(row=>row.kind==='formation');
 const selection={entity_ids:[entity.id],step_id:entity.sequence.steps[0].id};
 const work=new NativeWorking({checkpoint,expression:()=>{throw closed},file:()=>{throw closed},mint:()=>{throw closed}});
 work.restore({schema:'oi.native-working/v1',draft_id:view.journey.id,view},store.document);
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>work.state.view,
  nativeSelect:()=>{throw closed},commit:async()=>{await work.commit({journey:structuredClone(store.document),sceneId:scene.id,entityId:entity.id});return true},
  change:fn=>store.change(fn),afterHistory:()=>{},selectLocal:()=>{throw closed},openEditor:()=>{throw closed},standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 const target=new EventTarget(),pending=new Map();let index=0;
 const parent={postMessage:data=>{if(data.kind==='result'){pending.get(data.req)?.(data.reply);pending.delete(data.req)}}};
 target.parent=parent;target.location={origin:'http://source-review.invalid'};
 const receiver=installNativeEditorReceiver(owner,target);t.after(()=>receiver.dispose());
 const request=operation=>new Promise(resolve=>{const req=String(++index);pending.set(req,resolve);const event=new Event('message');
  Object.defineProperties(event,{source:{value:parent},origin:{value:target.location.origin},data:{value:{schema:'oi.native-editor/v1',kind:'request',token:'glyph-source-review',bindingId:'retained-editor',epoch:0,req,request:operation}}});target.dispatchEvent(event)});
 return {view,store,scene,entity,selection,owner,request};
}
function presented(reading,request) {
 const values={visible:true,timing:{id:reading.selection.step_id,hold:1,transition:1},updates:[]};
 const lifetime={current:{mounted:true,epoch:1}},tickets={current:0},latest={current:{reading}};
 const setters={setPending:value=>values.updates.push(['pending',value]),setFault:value=>values.updates.push(['fault',value]),setTimingDraft:value=>{values.timing=typeof value==='function'?value(values.timing):value;values.updates.push(['timing',values.timing])}};
 const entity=reading.scene.entities.find(row=>row.id===reading.selection.entity_ids[0]),step=entity.sequence.steps.find(row=>row.id===reading.selection.step_id);
 const bindings={r:reading,e:entity,k:step,request,lifetime,tickets,latest,timingDraft:values.timing,shown:()=>lifetime.current.mounted&&values.visible,isPresented:()=>values.visible,currentGlyphReply,...setters};
 return {values,lifetime,latest,apply:execute('apply',bindings),settle:execute('settle',bindings)};
}
function deferred(){let reject,enter;const pending=new Promise((_,r)=>{reject=r}),started=new Promise(resolve=>{enter=resolve});return {pending,started,reject,enter}}

test('concurrent Enter/blur receipt executes one real rich mutation and closed checkpoint once',async t=>{
 const barrier=deferred(),checkpoints=[],r=retained(t,(_id,record)=>{checkpoints.push(record);barrier.enter();return barrier.pending});
 const read=await r.request({operation:'read'}),p=presented(read.reading,r.request),step=r.entity.sequence.steps[0];
 const entry={label:'Hold',value:String(step.hold+.1),commit:()=>p.apply([{kind:'step-timing',entity_id:r.entity.id,step_id:step.id,hold:step.hold+.1}])};
 const submit=execute('submitInput',{submissions:new WeakMap()}),a=submit(entry),b=submit(entry);assert.equal(a,b);
 await barrier.started;assert.equal(checkpoints.length,1);assert.equal(r.store.undoStack.length,1);assert.equal(checkpoints[0].pending.kind,'edit');
 barrier.reject(closed);assert.equal(await a,false);assert.equal(await b,false);assert.equal(checkpoints.length,1);
 assert.deepEqual(r.store.document.scenes[0].entities[0].sequence.steps[0].layers,r.entity.sequence.steps[0].layers);
});

test('delayed real checkpoint refusal cannot publish into a hidden or unmounted Glyph cut',async t=>{
 for(const transition of ['hidden','unmounted']) {
  const barrier=deferred(),r=retained(t,()=>{barrier.enter();return barrier.pending}),read=await r.request({operation:'read'}),p=presented(read.reading,r.request),step=r.entity.sequence.steps[0];
  const finishing=p.apply([{kind:'step-timing',entity_id:r.entity.id,step_id:step.id,hold:step.hold+.1}]);await barrier.started;
  if(transition==='hidden')p.values.visible=false;else{p.lifetime.current.mounted=false;p.lifetime.current.epoch++}
  const before=p.values.updates.length;barrier.reject(closed);assert.equal(await finishing,false);assert.equal(p.values.updates.length,before);
  assert.equal(r.store.undoStack.length,1);
 }
});

test('changed native subject, stable step or actual human store basis refuses old fault settlement',async t=>{
 const r=retained(t),read=await r.request({operation:'read'}),captured=read.reading,entityId=r.entity.id,stepId=r.entity.sequence.steps[0].id;
 const rejection=await r.request({operation:'select',basis:captured.basis,entity_id:entityId,step_id:stepId});assert.equal(rejection.ok,false);
 for(const change of [value=>value.basis.expression_ref+=':other',value=>value.basis.scene_ref+=':other',value=>value.selection.entity_ids=[],value=>value.selection.step_id=r.entity.sequence.steps[1].id]) {
  const current=structuredClone(captured);change(current);assert.equal(currentGlyphReply(captured,current,rejection,entityId,stepId),false);
 }
 r.store.begin();r.store.document.scenes[0].entities[0].sequence.steps[0].hold+=.1;r.store.touch();
 assert.equal(currentGlyphReply(captured,r.owner.read(),rejection,entityId,stepId),false);assert.equal(r.store.transactionOpen,true);
});

test('hidden captured draft and history do not dispatch any editor request',async t=>{
 const r=retained(t),read=await r.request({operation:'read'}),p=presented(read.reading,()=>assert.fail('Hidden Glyph intent must not dispatch'));
 p.values.visible=false;
 assert.equal(await p.apply([{kind:'step-timing',entity_id:r.entity.id,step_id:r.entity.sequence.steps[0].id,hold:1}]),false);
 await p.settle({operation:'undo',basis:read.reading.basis});assert.deepEqual(p.values.updates,[]);
});

test('qualified actual owner read clears its current fault',async t=>{
 const r=retained(t),read=await r.request({operation:'read'}),p=presented(read.reading,r.request);
 await p.settle({operation:'read'});assert.deepEqual(p.values.updates,[['pending',true],['fault',null],['pending',false]]);
});

test('delayed actual Undo checkpoint refusal remains with its departed Glyph presentation',async t=>{
 const barrier=deferred(),r=retained(t,()=>{barrier.enter();return barrier.pending});
 r.store.change(doc=>{doc.scenes[0].entities[0].sequence.steps[0].hold+=.1});
 r.store.change(doc=>{doc.scenes[0].entities[0].sequence.steps[0].hold+=.1});
 const read=await r.request({operation:'read'}),p=presented(read.reading,r.request);
 const finishing=p.settle({operation:'undo',basis:read.reading.basis});await barrier.started;
 p.lifetime.current.epoch++;const before=p.values.updates.length;barrier.reject(closed);await finishing;
 assert.equal(p.values.updates.length,before);assert.equal(r.store.undoStack.length,1);assert.equal(r.store.redoStack.length,1);
});

test('numeric input retains its first captured actual basis through rerender and rejects instead of retargeting human work',async t=>{
 const r=retained(t),read=await r.request({operation:'read'}),p=presented(read.reading,r.request),values=new Map(),id='captured-rich-hold';let retargeted=0;
 const onChange=nodes(node=>ts.isJsxAttribute(node)&&node.name.getText(source)==='onChange'&&node.getText(source).includes('numericCommit'))[0].initializer.expression;
 const receive=bindings=>new Function(...Object.keys(bindings),ts.transpileModule(`const receive=${onChange.getText(source)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+'\nreturn receive;')(...Object.values(bindings));
 const context={values,changed:()=>{}},bindings={context,id,label:'Hold',setDraft:()=>{},min:0,max:3600};
 receive({...bindings,onCommit:hold=>p.apply([{kind:'step-timing',entity_id:r.entity.id,step_id:r.entity.sequence.steps[0].id,hold}])})({target:{value:'3.05'}});
 r.store.begin();r.store.document.scenes[0].entities[0].sequence.steps[0].hold=2.75;r.store.touch();
 receive({...bindings,onCommit:()=>{retargeted++;throw Error('Newer intent must not replace the captured draft')}})({target:{value:'3.15'}});
 const submit=execute('submitInput',{submissions:new WeakMap()});assert.equal(await submit(values.get(id)),false);
 assert.equal(retargeted,0);assert.equal(values.get(id).value,'3.15');assert.equal(r.store.document.scenes[0].entities[0].sequence.steps[0].hold,2.75);assert.equal(r.store.transactionOpen,true);
});

test('same formation stable-step selection follows owner while retaining a range on unrelated runtime readings',()=>{
 const view=kernelDocumentToJourney(nativeDocument),entity=view.journey.scenes[0].entities.find(row=>row.kind==='formation'),ids=entity.sequence.steps.map(row=>row.id);
 assert.deepEqual(reconcileGlyphSelection([ids[0]],entity,ids[1]),[ids[1]]);
 assert.deepEqual(reconcileGlyphSelection(ids.slice(0,2),entity,ids[1]),ids.slice(0,2));
 assert.deepEqual(reconcileGlyphSelection(ids.slice(0,2),structuredClone(entity),ids[1]),ids.slice(0,2));
 assert.deepEqual(reconcileGlyphSelection(['removed-state'],entity,ids[2]),[ids[2]]);
});

test('archived rich sampled layer planes match actual native layer union and complete state body',()=>{
 const view=kernelDocumentToJourney(nativeDocument),entity=view.journey.scenes[0].entities.find(row=>row.kind==='formation'),step=entity.sequence.steps[0],before=structuredClone(entity),plan=glyphThumbnailMaterial(step,entity),native=toNativeEntity(entity);
 assert.equal(plan.planes.length,2);assert.deepEqual(plan.planes.map(plane=>plane.source?.kind),['ascii','image']);
 assert.deepEqual(plan.planes.map(plane=>plane.source),native.sequence.links[0].layers.map(layer=>layer.source));
 assert.deepEqual(plan.appearance,step.objectState);assert.deepEqual(plan.planes.map(plane=>[plane.id,plane.z,plane.scale]),step.layers.map(layer=>[layer.id,layer.z,layer.scale]));
 const imagePlan=glyphThumbnailMaterial(entity.sequence.steps[1],entity);assert.equal(imagePlan.planes[0].text,entity.sequence.steps[1].layers[0].text);
 const inherited=structuredClone(entity);delete inherited.sequence.steps[0].layers;inherited.layers=step.layers;delete inherited.sequence.steps[0].objectState;
 assert.deepEqual(glyphThumbnailMaterial(inherited.sequence.steps[0],inherited).appearance,inherited);
 assert.equal(glyphThumbnailMaterial(inherited.sequence.steps[0],inherited).planes.length,2);
 inherited.sequence.steps[0].layers=[];assert.equal(glyphThumbnailMaterial(inherited.sequence.steps[0],inherited).planes.length,1);
 assert.deepEqual(entity,before);
});
