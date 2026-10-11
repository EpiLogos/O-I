/** Actual private input owner, production decoder/provider/controller and rich
 * source reading. Durable Node WebStorage is required; native effects closed. */
import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve,sep} from 'node:path';
import {MessageChannel} from 'node:worker_threads';
const storageArg=process.execArgv.find(arg=>arg.startsWith('--localstorage-file='));
assert.ok(storageArg,'Run with owned temporary durable Node WebStorage');
assert.ok(resolve(storageArg.slice('--localstorage-file='.length)).startsWith(resolve(tmpdir())+sep));
assert.equal(localStorage.constructor.name,'Storage');
const root=new URL('../../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/editor')return n(${JSON.stringify(new URL('packages/expressions-boundary/src/editor.ts',root).href)},c);if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(new URL('packages/expressions-boundary/src/parameters.ts',root).href)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{createNativeInputContinuity},drafts,recovery,{glyphInputMaterial},{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor,installNativeEditorReceiver,applyNativeGlyphChanges},{sameEditorBasis},{ExpressionsHost},{createNativeEditorClient},engine,{freshLayout},frame,tsModule]=await Promise.all([
 import('../src/continuity/nativeInputs.ts'),import(new URL('desktop/cradle/src/workspace/drafts.ts',root)),import('../src/continuity/nativeInputRecovery.ts'),import('../src/continuity/glyphInputMaterial.ts'),
 import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import('../../../expressions-boundary/src/editor.ts'),import('../../../expressions-boundary/src/host.ts'),import('../../../expressions-boundary/src/editorHost.ts'),
 import(new URL('desktop/cradle/src/surface/engine.ts',root)),import(new URL('desktop/cradle/src/surface/types.ts',root)),import(new URL('desktop/cradle/src/document/frame.ts',root)),import(compiler),
]);
const raw=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
assert.deepEqual(raw.before.document,raw.after.document);
const closed=()=>{throw Error('Native mutation/adoption remains closed in private-input source verification')};
function source(){const view=kernelDocumentToJourney(raw.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes[0],entity=scene.entities[0],selection={entity_ids:[entity.id],step_id:entity.sequence.steps[0].id};
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});return {view,store,scene,entity,selection,owner,reading:owner.read()};}
const scope={owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'source-input-recovery-epoch',workspace_id:'source-input-recovery-workspace',surface_id:'world.expressions'};
const target=r=>({scope:'entity',entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id],step_id:r.selection.step_id,parameter:`entity:${encodeURIComponent(r.entity.id)}:forces.radius`,family:'force',axis:'y'});
const material=(r,text='2.45')=>({basis:r.reading.basis,target:target(r),input:{kind:'text',text,initial:String(r.entity.force.radius)}});
const saved=()=>Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).sort().map(key=>[key,localStorage.getItem(key)]);
const ts=tsModule.default,sourceText=await readFile(new URL('packages/live-shell/ui/src/components/NativeInputRetention.tsx',root),'utf8'),ast=ts.createSourceFile('NativeInputRetention.tsx',sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const find=(node,predicate)=>{const matches=[];const walk=n=>{if(predicate(n))matches.push(n);ts.forEachChild(n,walk)};walk(node);assert.equal(matches.length,1);return matches[0];};
const execute=(text,bindings)=>new Function(...Object.keys(bindings),ts.transpileModule(`const selected=${text.replace(/^export /,'')};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+'\nreturn selected;')(...Object.values(bindings));
const nativeInputBinding=execute(find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='nativeInputBinding').getText(ast),{groupsOf:engine.groupsOf});
const provider=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NativeInputRetentionProvider'),providerEffect=find(provider,n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect').arguments[0].getText(ast);
const component=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NativeInputRecovery'),applyCopy=find(component,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='applyCopy').initializer.getText(ast);
beforeEach(()=>localStorage.clear());

async function transport(r){
 const origin='http://127.0.0.1:8788',messages=new EventTarget(),target=new EventTarget(),nativeFrame=new EventTarget(),{port1,port2}=new MessageChannel();
 const event=(data,source)=>Object.assign(new Event('message'),{data,source,origin});
 const parent={postMessage(data,to){assert.equal(to,origin);port2.postMessage(data)}};target.parent=parent;target.location={origin};nativeFrame.src=origin+'/__application/expressions/index.html';nativeFrame.closest=()=>null;
 nativeFrame.contentWindow={postMessage(data,to){assert.equal(to,origin);port1.postMessage(data)}};
 const host=new ExpressionsHost(nativeFrame,{bindingId:scope.surface_id,owners:{channels:{}},messageTarget:new EventTarget(),isPresented:()=>true}),barriers=[];
 port2.on('message',data=>target.dispatchEvent(event(data,parent)));port1.on('message',data=>{messages.dispatchEvent(event(data,nativeFrame.contentWindow));while(barriers.length)barriers.shift()()});
 const receiver=installNativeEditorReceiver(r.owner,target),client=createNativeEditorClient(host,messages),published={current:null};const stop=client.subscribe(reading=>{published.current=reading});
 await host.handleMessage({source:nativeFrame.contentWindow,origin,data:{v:1,kind:'oi-app-state',state:{hostMode:'expressions',sceneCount:r.view.document.scenes.length,document:{id:r.view.document.expression_ref,name:r.view.document.title},nativeScene:{expression_ref:r.reading.basis.expression_ref,revision:r.reading.basis.revision,scene_ref:r.reading.basis.scene_ref}}}});
 const initial=await client.request({operation:'read'});assert.equal(initial.ok,true);assert.deepEqual(initial.reading,r.owner.read());
 return {client,published,receiver,publish:async()=>{const done=new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Actual source publication did not arrive')),3000);barriers.push(()=>{clearTimeout(timer);yes()})});receiver.publish();await done},close:()=>{stop();receiver.dispose();client.dispose();host.dispose();port1.close();port2.close()}};
}
function receive(r,wire,owner,request){
 const effects=[],aperture={owner,current:()=>true,changed:()=>effects.push(['changed'])},lifetime={current:1},bindings={busy:false,presented:()=>true,reading:r.reading,lifetime,published:wire.published,privateNativeInputTargetCurrent:recovery.privateNativeInputTargetCurrent,privateNativeInputChanges:recovery.privateNativeInputChanges,sameEditorBasis,request,aperture,setBusy:value=>effects.push(['busy',value]),setFault:value=>effects.push(['fault',value])};
 return {bindings,effects,apply:(receipt,currentRevision)=>execute(applyCopy,bindings)(receipt,currentRevision)};
}
function authorTiming(r){const step=r.scene.entities[0].sequence.steps[0];r.store.change(()=>{r.store.document=applyNativeGlyphChanges(r.store.document,r.scene.id,[{kind:'step-timing',entity_id:r.entity.id,step_id:step.id,hold:step.hold+.1}])});}

test('actual target decoder refuses wrong native object, occurrence, Expression, Scene and stable state without storage or document effects',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),receipt=owner.retain(material(r),()=>true),before=saved(),document=structuredClone(r.store.document);
 assert.equal(recovery.privateNativeInputTargetCurrent(receipt.copy,r.reading),true);
 for(const alter of [copy=>{copy.target.entity_id='other-view-object'},copy=>{copy.target.entity_ref='entity:wrong-native-occurrence'},copy=>{copy.basis.expression_ref='expression:other'},copy=>{copy.basis.scene_ref='scene:other'},copy=>{copy.target.step_id='step:absent'}]){const copy=structuredClone(receipt.copy);alter(copy);assert.equal(recovery.privateNativeInputTargetCurrent(copy,r.reading),false);assert.throws(()=>recovery.privateNativeInputChanges(copy,r.reading),/target/)}
 const current=structuredClone(r.reading);current.selection.entity_ids=[];assert.equal(recovery.privateNativeInputTargetCurrent(receipt.copy,current),false);
 assert.deepEqual(saved(),before);assert.deepEqual(r.store.document,document);assert.equal(r.store.undoStack.length,0);
});

test('stored malicious private JSON cannot become a generic command queue or cross native scope/state',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),before=structuredClone(r.store.document);
 const changes=[{kind:'parameter',target:'field.gravity',value:1},{kind:'parameter',target:`entity:${encodeURIComponent(r.entity.id+'-other')}:forces.radius`,value:1},{kind:'step-timing',entity_id:r.entity.id,step_id:r.selection.step_id+'-other',hold:1},{kind:'step-source',entity_id:r.entity.id+'-other',step_id:r.selection.step_id,shape:'text',text:'foreign'},{kind:'field-font',values:{fontFamily:'foreign'}},{kind:'force-mode',entity_id:r.entity.id+'-other',mode:'off'},{kind:'step-remove',entity_id:r.entity.id,step_ids:[r.selection.step_id]},{kind:'undo'},{kind:'apply',changes:[]},{kind:'eval',source:'unsupported'}];
 for(const change of changes){const receipt=owner.retain({...material(r),input:{kind:'gesture',gesture:{label:'malicious private JSON fault injection'},changes:[change]}},()=>true);assert.throws(()=>recovery.privateNativeInputChanges(receipt.copy,r.reading));assert.ok(drafts.readPrivateNativeInput(receipt.ref))}
 const invalid=owner.retain(material(r,'2.45e-'),()=>true);assert.throws(()=>recovery.privateNativeInputChanges(invalid.copy,r.reading),/finite/);
 localStorage.setItem('oi-cradle.draft.v1:private-native-input:malicious:missing-fields',JSON.stringify({native_input:{schema:'oi.cradle.private-native-input/v1'}}));const bytes=saved();assert.ok(owner.read().malformed.length);assert.deepEqual(saved(),bytes);assert.deepEqual(r.store.document,before);
});

test('rich Glyph compound overrides and full layer edits retain original native basis and reduce only the selected payload',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),step=r.entity.sequence.steps[0],document=structuredClone(r.store.document);
 assert.ok(step.objectState);assert.ok((step.layers??r.entity.layers).length>=2);
 const state=glyphInputMaterial(r.reading,r.entity,step,'State radius · px','State radius · px','240','160'),stateReceipt=owner.retain(state,()=>true),changes=recovery.privateNativeInputChanges(stateReceipt.copy,r.reading),expected=structuredClone(step.objectState);expected.force.radius=.6; // actual native WORLD_SCALE400, 240px -> .6 world units

 assert.deepEqual(changes,[{kind:'step-overrides',entity_id:r.entity.id,step_id:step.id,operation:'capture',values:expected}]);assert.deepEqual(stateReceipt.copy.basis,r.reading.basis);
 const layers=step.layers??r.entity.layers,layer=layers[1],input=glyphInputMaterial(r.reading,r.entity,step,'Depth',`${layer.id}:depth`,'3.75',String(layer.z)),receipt=owner.retain(input,()=>true),decoded=recovery.privateNativeInputChanges(receipt.copy,r.reading),expectedLayers=structuredClone(layers);expectedLayers[1].z=3.75;
 assert.deepEqual(decoded,[{kind:'step-layers',entity_id:r.entity.id,step_id:step.id,layers:expectedLayers}]);
 const next=applyNativeGlyphChanges(r.store.document,r.scene.id,decoded);assert.deepEqual(next.scenes[0].entities[0].sequence.steps[0].layers,expectedLayers);assert.deepEqual(next.scenes[0].parameterRacks,r.scene.parameterRacks);assert.deepEqual(next.savedScenes,document.savedScenes);assert.deepEqual(next.scenes[0].entities[0].sequence.steps.slice(1),r.entity.sequence.steps.slice(1));assert.deepEqual(r.store.document,document);
 const unfinished=owner.retain(glyphInputMaterial(r.reading,r.entity,step,'Hold · s','Hold · s','2.45e-','2.35'),()=>true);assert.deepEqual(unfinished.copy.input,{kind:'text',text:'2.45e-',initial:'2.35'});assert.throws(()=>recovery.privateNativeInputChanges(unfinished.copy,r.reading));
});

test('actual Apply current revision forks even its own writer and closed native refusal retains original full bytes',async()=>{
 const r=source(),wire=await transport(r),owner=createNativeInputContinuity(scope),receipt=owner.retain(material(r),()=>true),originalBytes=localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref),calls=[];
 try{const receiver=receive(r,wire,owner,async request=>{calls.push(request);return wire.client.request(request)});await receiver.apply(receipt,true);assert.deepEqual(calls.map(row=>row.operation),['read','apply']);assert.deepEqual(calls[1].basis,r.owner.read().basis);assert.equal(owner.read().copies.length,2);assert.equal(localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref),originalBytes);assert.ok(receiver.effects.some(effect=>effect[0]==='fault'&&/closed/.test(effect[1])));assert.deepEqual(r.store.document,r.view.journey);assert.equal(r.store.undoStack.length,0)}finally{wire.close();owner.retire()}
});

test('incoming actual authored revision or selected target after read refuses Apply before mutation or fork',async()=>{
 for(const depart of [async(r,w)=>{authorTiming(r);await w.publish()},async(r,w)=>{r.selection.entity_ids=[];await w.publish()},async(r,w)=>{r.selection.step_id=r.entity.sequence.steps[1].id;await w.publish()}]){
  const r=source(),wire=await transport(r),owner=createNativeInputContinuity(scope),receipt=owner.retain(material(r),()=>true),before=saved(),calls=[];
  try{const receiver=receive(r,wire,owner,async request=>{calls.push(request);const reply=await wire.client.request(request);if(request.operation==='read')await depart(r,wire);return reply});await receiver.apply(receipt,true);assert.deepEqual(calls.map(row=>row.operation),['read']);assert.deepEqual(saved(),before);assert.equal(receiver.effects.some(effect=>effect[0]==='fault'&&effect[1]!==null),false)}finally{wire.close();owner.retire()}
 }
});

test('late real closed Apply result cannot clear copies or publish fault into later authored work',async()=>{
 const r=source(),wire=await transport(r),owner=createNativeInputContinuity(scope),receipt=owner.retain(material(r),()=>true),calls=[];
 try{const receiver=receive(r,wire,owner,async request=>{calls.push(request);const reply=await wire.client.request(request);if(request.operation==='apply'){assert.equal(reply.ok,false);authorTiming(r);await wire.publish()}return reply});await receiver.apply(receipt,true);assert.deepEqual(calls.map(row=>row.operation),['read','apply']);assert.equal(owner.read().copies.length,2);assert.equal(receiver.effects.some(effect=>effect[0]==='fault'&&effect[1]!==null),false);assert.equal(r.store.undoStack.length,1)}finally{wire.close();owner.retire()}
});

test('actual provider binding/checkpoint follows membership through hide/reveal, detach, retained mode and close',async()=>{
 const open=engine.openBinding(freshLayout(),{id:'world.expressions',kind:'expressions',title:'Expressions'}),book={current:{layout:open,modeLayouts:{}}};
 assert.equal(nativeInputBinding(book.current),'world.expressions');assert.equal(nativeInputBinding({...book.current,layout:engine.detachBinding(open,'world.expressions')}),'world.expressions');assert.equal(nativeInputBinding({layout:freshLayout(),modeLayouts:{techne:open}}),'world.expressions');
 const r=source(),workspace={workspaceId:scope.workspace_id,accessEpoch:7,accessReady:true,nativeScope:{owner:scope.owner,world:scope.world,workcell:scope.workcell,accessEpoch:scope.accessEpoch},nativeAccessCurrent:epoch=>epoch===7},latest={current:{workspace,book}},windowEvents=new EventTarget();let aperture;
 const cleanup=execute(providerEffect,{scope:workspace.nativeScope,bindingId:'world.expressions',workspace,latest,failures:{current:new Map()},nativeInputBinding,createNativeInputContinuity,registerDocumentCheckpoint:frame.registerDocumentCheckpoint,window:windowEvents,revision:()=>{},setAperture:value=>{aperture=value}})();
 try{assert.ok(aperture.current());const receipt=aperture.owner.retain(material(r),aperture.current),before=saved();await frame.checkpointDocuments(['world.expressions']);
  aperture.failure('actual-unretained-source-draft','Storage refusal · full text still in current input');await assert.rejects(frame.checkpointDocuments(['world.expressions']),/Unretained native input/);assert.deepEqual(saved(),before);aperture.failure('actual-unretained-source-draft',null);await frame.checkpointDocuments(['world.expressions']);
  book.current={layout:engine.openBinding(open,{id:'source-test-inactive-tab',kind:'blank',title:'New view'}),modeLayouts:{}};assert.ok(aperture.current());await frame.checkpointDocuments(['world.expressions']);book.current={layout:engine.activateSurface(book.current.layout,'world.expressions'),modeLayouts:{}};assert.ok(aperture.current());assert.deepEqual(saved(),before);
  const visibleBook=book.current;book.current={layout:freshLayout(),modeLayouts:{techne:visibleBook.layout}};assert.ok(aperture.current());await frame.checkpointDocuments(['world.expressions']);assert.deepEqual(saved(),before);book.current=visibleBook;
  const configured=workspace.nativeScope;workspace.nativeScope={...configured,world:'project:foreign'};assert.equal(aperture.current(),false);await assert.rejects(frame.checkpointDocuments(['world.expressions']),/aperture retired/);assert.deepEqual(saved(),before);workspace.nativeScope=configured;
  book.current={layout:engine.closeSurface(book.current.layout,'world.expressions'),modeLayouts:{}};assert.equal(nativeInputBinding(book.current),null);assert.equal(aperture.current(),false);await assert.rejects(frame.checkpointDocuments(['world.expressions']),/aperture retired/);assert.deepEqual(saved(),before);assert.ok(drafts.readPrivateNativeInput(receipt.ref));
 }finally{cleanup()}
 await frame.checkpointDocuments(['world.expressions']);assert.throws(()=>aperture.owner.read(),/retired/);
});

test('Apply captured revision sends the original basis and real retained receiver refuses after human authoring advances',async()=>{
 const r=source(),owner=createNativeInputContinuity(scope),receipt=owner.retain(material(r),()=>true),originalBytes=localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref);authorTiming(r);const before=structuredClone(r.store.document),wire=await transport(r),calls=[];
 try{const receiver=receive(r,wire,owner,async request=>{calls.push(request);return wire.client.request(request)});await receiver.apply(receipt,false);assert.deepEqual(calls.map(row=>row.operation),['read','apply']);assert.deepEqual(calls[1].basis,receipt.copy.basis);assert.notEqual(calls[1].basis.authored_revision,wire.published.current.basis.authored_revision);assert.equal(owner.read().copies.length,1);assert.equal(localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref),originalBytes);assert.ok(receiver.effects.some(effect=>effect[0]==='fault'&&/captured scene or authoring revision changed/.test(effect[1])));assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,1)}finally{wire.close();owner.retire()}
});
