/** Real durable WebStorage/private draft owner; native effects remain closed.
 * Run with an owned OS temporary --localstorage-file and experimental-webstorage. */
import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,sep} from 'node:path';
const storageArg=process.execArgv.find(arg=>arg.startsWith('--localstorage-file='));
assert.ok(storageArg,'Use genuine durable Node WebStorage');
const storageFile=resolve(storageArg.slice('--localstorage-file='.length));
assert.ok(storageFile.startsWith(resolve(tmpdir())+sep),'Use this test aperture’s owned OS temporary file');
assert.equal(localStorage.constructor.name,'Storage');
const root=new URL('../../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
const parameters=new URL('packages/expressions-boundary/src/parameters.ts',root).href;
const loader=`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const suffix of ['.ts','.tsx']){try{return await n(s+suffix,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`;
register(loader,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [drafts,{createNativeInputContinuity,nativeInputTargetKey},{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},face,{readDocumentIdentity,islandSpan}]=await Promise.all([
 import(new URL('desktop/cradle/src/workspace/drafts.ts',root)),import('../src/continuity/nativeInputs.ts'),
 import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import('../src/components/NativeDeviceEditors.tsx'),import(new URL('desktop/cradle/src/document/identity.ts',root)),
]);
const raw=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
assert.deepEqual(raw.before.document,raw.after.document);
const view=kernelDocumentToJourney(raw.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes[0],entity=scene.entities[0];
const closed=()=>{throw Error('Native mutation/adoption is closed during private-input source verification')};
const editor=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
const reading=editor.read(),scope={owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'source-private-input-epoch',workspace_id:'source-private-input-workspace',surface_id:'source-private-input-surface'};
const target={scope:'entity',entity_id:entity.id,entity_ref:reading.entityOccurrences[entity.id],step_id:entity.sequence.steps[0].id,parameter:`entity:${encodeURIComponent(entity.id)}:forces.radius`,family:'force',axis:'y'};
const material=(text='2.45e-')=>({basis:reading.basis,target,input:{kind:'text',text,initial:String(entity.force.radius)}});
const current=()=>true,key=ref=>'oi-cradle.draft.v1:'+ref;
const saved=()=>Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).sort().map(name=>[name,localStorage.getItem(name)]);
beforeEach(()=>localStorage.clear());

test('exact incomplete text, original native basis and stable occurrence survive actual durable acknowledgement',()=>{
 const adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material(' 2.45e-\nλ '),current),actual=drafts.readPrivateNativeInput(receipt.ref);
 assert.deepEqual(actual.copy.input,material(' 2.45e-\nλ ').input);assert.deepEqual(actual.copy.basis,reading.basis);assert.deepEqual(actual.copy.target,target);
 assert.deepEqual(actual.copy.scope,scope);assert.deepEqual(actual.copy.writer_scope,scope);assert.equal(actual.copy.writer_id,adapter.writerId);
 assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(key(receipt.ref)))),['native_input']);adapter.checkpoint(current);
 assert.deepEqual(store.document,view.journey);assert.equal(store.undoStack.length,0);
});
test('full production Force gesture and intended parameter targets retain all offsets, bounds and plane identity',()=>{
 const first=face.createNativeForceGesture(reading,entity,'centre',7,{x:164,y:109}),gesture=face.moveNativeForceGesture(first,{x:193,y:75}),changes=face.nativeForceGestureChanges(gesture),adapter=createNativeInputContinuity(scope);
 const receipt=adapter.retain({basis:gesture.basis,target:{...target,step_id:null,parameter:null,axis:gesture.axis},input:{kind:'gesture',gesture,changes},refusal:'Native effect remains closed'},current);
 assert.deepEqual(drafts.readPrivateNativeInput(receipt.ref).copy.input,{kind:'gesture',gesture,changes});assert.equal(receipt.copy.refusal,'Native effect remains closed');
 assert.ok(changes.every(change=>!change.target.endsWith(':z')));assert.deepEqual(store.document,view.journey);
});
test('distinct apertures preserve divergent same-target copies while only their own receipt advances',()=>{
 const a=createNativeInputContinuity(scope),b=createNativeInputContinuity(scope),first=a.retain(material('2.45'),current),second=b.retain(material('2.55'),current),secondBytes=localStorage.getItem(key(second.ref));
 assert.notEqual(a.writerId,b.writerId);assert.notEqual(first.ref,second.ref);
 const next=a.retain(material('2.65'),current,first);assert.equal(next.ref,first.ref);assert.equal(localStorage.getItem(key(second.ref)),secondBytes);
 assert.deepEqual(a.read().copies.map(row=>row.copy.input.text).sort(),['2.55','2.65']);
 assert.throws(()=>a.retain(material('2.75'),current,second),/Fork a recovered copy/);assert.equal(localStorage.getItem(key(second.ref)),secondBytes);
});
test('recovery forks original full bytes into new writer identity without changing original basis or epoch',()=>{
 const original=createNativeInputContinuity(scope).retain(material('2.45'),current),originalBytes=localStorage.getItem(key(original.ref)),nextScope={...scope,accessEpoch:'new-aperture-epoch'},next=createNativeInputContinuity(nextScope),recovered=next.read().copies[0],fork=next.fork(recovered,current);
 assert.notEqual(fork.ref,original.ref);assert.notEqual(fork.copy.copy_id,original.copy.copy_id);assert.notEqual(fork.copy.writer_id,original.copy.writer_id);
 assert.deepEqual(fork.copy.scope,scope);assert.deepEqual(fork.copy.writer_scope,nextScope);assert.deepEqual(fork.copy.basis,original.copy.basis);assert.deepEqual(fork.copy.target,original.copy.target);assert.deepEqual(fork.copy.input,original.copy.input);
 assert.equal(localStorage.getItem(key(original.ref)),originalBytes);assert.equal(next.clear(recovered,current),false);assert.equal(localStorage.getItem(key(original.ref)),originalBytes);
 // Even an accidentally reused caller writer ID must not write/clear across epochs.
 const reused=createNativeInputContinuity(nextScope,original.copy.writer_id);assert.throws(()=>reused.retain(material('2.75'),current,recovered),/Fork a recovered copy/);assert.equal(reused.clear(recovered,current),false);assert.equal(localStorage.getItem(key(original.ref)),originalBytes);
});
test('stable target keys distinguish actual Expression/Scene/occurrence/step/parameter/family without adopting revision',()=>{
 const key=nativeInputTargetKey(material());assert.equal(nativeInputTargetKey({...material(),basis:{...reading.basis,revision:reading.basis.revision+1}}),key);
 for(const value of [{...material(),basis:{...reading.basis,expression_ref:reading.basis.expression_ref+'-other'}},{...material(),basis:{...reading.basis,scene_ref:reading.basis.scene_ref+'-other'}},...['entity_ref','step_id','parameter','family','axis'].map(field=>({...material(),target:{...target,[field]:field==='axis'?'z':target[field]+'-other'}}))])assert.notEqual(nativeInputTargetKey(value),key);
 assert.deepEqual(material().basis,reading.basis);
});
test('basis/target/scope mutation refuses before writing and never silently rebases private input',()=>{
 const adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material('2.45'),current),before=saved();
 for(const value of [{...material(),basis:{...reading.basis,revision:reading.basis.revision+1}},{...material(),target:{...target,axis:'z'}}])assert.throws(()=>adapter.retain(value,current,receipt),/cannot change its captured basis/);
 assert.deepEqual(saved(),before);
 const foreign=createNativeInputContinuity({...scope,workspace_id:'other-workspace'});assert.throws(()=>foreign.fork(receipt,current),/another native owner\/workspace\/surface/);assert.deepEqual(saved(),before);
});
test('delayed clear cannot erase newer typing and explicit current Discard clears only exact own bytes',()=>{
 const adapter=createNativeInputContinuity(scope),first=adapter.retain(material('2.45'),current),second=adapter.retain(material('2.55'),current,first),before=saved();
 assert.throws(()=>adapter.clear(first,current),/Newer private input/);assert.deepEqual(saved(),before);assert.throws(()=>adapter.clear(second,()=>false),/aperture retired/);assert.deepEqual(saved(),before);
 assert.equal(adapter.clear(second,current),true);assert.equal(drafts.readPrivateNativeInput(second.ref),null);assert.equal(localStorage.length,0);
});
test('actual-read receipt body changes, stale callbacks and retirement retain every durable copy',()=>{
 const adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material('2.45'),current),before=saved();receipt.copy.input.text='2.65';
 assert.throws(()=>drafts.qualifyPrivateNativeInput(receipt),/unchanged private input receipt/);assert.throws(()=>adapter.fork(receipt,current),/unchanged private input receipt/);assert.deepEqual(saved(),before);
 assert.throws(()=>adapter.retain(material(),()=>false),/aperture retired/);assert.deepEqual(saved(),before);adapter.retire();
 assert.throws(()=>adapter.retain(material(),current),/aperture retired/);assert.throws(()=>adapter.checkpoint(current),/aperture retired/);assert.deepEqual(saved(),before);
});
test('malformed and foreign records are disclosed with original raw bytes and never removed',()=>{
 const adapter=createNativeInputContinuity(scope),own=adapter.retain(material('2.45'),current),foreign=createNativeInputContinuity({...scope,world:'project:foreign'}).retain(material('2.55'),current);
 const malformedRef='private-native-input:malformed-writer:malformed-copy',malformedBytes='{broken original';localStorage.setItem(key(malformedRef),malformedBytes);const before=saved(),inventory=adapter.read();
 assert.deepEqual(inventory.copies.map(row=>row.ref),[own.ref]);assert.equal(inventory.foreign[0].ref,foreign.ref);assert.equal(inventory.foreign[0].raw,localStorage.getItem(key(foreign.ref)));assert.deepEqual(inventory.malformed.map(row=>[row.ref,row.raw]),[[malformedRef,malformedBytes]]);assert.deepEqual(saved(),before);
});
test('callbacks, non-finite values, cycles, getters and lossy array payloads refuse before storage',()=>{
 const adapter=createNativeInputContinuity(scope),cycle={};cycle.self=cycle;const extra=[];extra.length=1;extra.bad=2;let getterCalls=0;const accessor={};Object.defineProperty(accessor,'value',{enumerable:true,get(){getterCalls++;return 2}});
 for(const gesture of [{value:()=>{}},{value:NaN},{value:Infinity},{value:-0},{value:undefined},{value:new Date()},cycle,accessor,{value:extra},{value:[,1]}])assert.throws(()=>adapter.retain({...material(),input:{kind:'gesture',gesture,changes:[]}},current));
 assert.equal(localStorage.length,0);assert.equal(getterCalls,0);assert.throws(()=>createNativeInputContinuity({...scope,dispatch:closed}),/callbacks|unsupported/);assert.equal(localStorage.length,0);
});
test('private input coexists with unchanged source and actual supplied Page/Day form draft APIs',async()=>{
 const form=await readFile(new URL('desktop/cradle/documents/ql-daily-die.html',root),'utf8'),identity=readDocumentIdentity(form),span=islandSpan(form,'ql-doc'),text=form.slice(span.start,span.end),payload=JSON.parse(text);
 const formRef='central:source:project:o-i:desktop/cradle/documents/ql-daily-die.html',location={schema:'central.path-ref/v1',ref:formRef,root:new URL('desktop/cradle/documents/',root).pathname,path:'ql-daily-die.html'},fileScope={owner:scope.owner,world:scope.world,workcell:scope.workcell,accessEpoch:scope.accessEpoch};
 drafts.writeDraft('source-private-input-coexistence',{content:'Source retained exactly',base_revision:'retained-local-source-basis',saved_content:'Original source'});
 drafts.writePageDraft(formRef,{schema:'oi.cradle.page-working-copy/v1',location,scope:fileScope,base_revision:'retained-local-form-basis',saved_content:form,frame_content:form,document:identity,island:{text,revision:identity.documentRevision,documentId:identity.documentId}});
 // A pristine form has no Day identity. This is explicitly a locally declared
 // working-copy payload over the actual form, never a fabricated native read.
 const dayRef=formRef+':day-copy',dayPayload=structuredClone(payload);dayPayload.meta.uuid=crypto.randomUUID();
 drafts.writeDayPageDraft({schema:'oi.cradle.native-day-working-copy/v1',scope:fileScope,basis:{sourceRef:dayRef,documentId:dayPayload.meta.uuid,revision:'retained-local-day-basis',payload:dayPayload,fields:[]},template:{location,revision:'retained-local-form-basis',content:form},snapshot:dayPayload});
 const originals=saved(),adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material('2.45'),current);assert.ok(drafts.readPageDraft(formRef));assert.ok(drafts.readDayPageDraft(dayRef));assert.equal(drafts.readDraft('source-private-input-coexistence').content,'Source retained exactly');
 adapter.clear(receipt,current);assert.deepEqual(saved(),originals);
 // The variant also leaves unknown original fields in its own v1 record intact.
 const other=adapter.retain(material('2.55'),current),row=JSON.parse(localStorage.getItem(key(other.ref)));row.other_variant={full:['unrecognised','original']};localStorage.setItem(key(other.ref),JSON.stringify(row));adapter.clear(other,current);assert.deepEqual(JSON.parse(localStorage.getItem(key(other.ref))),{other_variant:row.other_variant});
});
test('actual durable record is read verbatim by a second process using the production owner/adapter',()=>{
 const adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material('2.45\n retained full input'),current),bytes=localStorage.getItem(key(receipt.ref));
 const code=`import {register} from 'node:module';register(${JSON.stringify(loader)},import.meta.url);const {createNativeInputContinuity}=await import(${JSON.stringify(new URL('packages/live-shell/ui/src/continuity/nativeInputs.ts',root).href)});const reader=createNativeInputContinuity(${JSON.stringify(scope)});const inventory=reader.read();console.log(JSON.stringify({inventory,bytes:localStorage.getItem(${JSON.stringify(key(receipt.ref))})}));`;
 const child=spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${storageFile}`,'--input-type=module','-e',code],{encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const found=JSON.parse(child.stdout);
 assert.equal(found.bytes,bytes);assert.deepEqual(found.inventory.copies[0],{ref:receipt.ref,copy:receipt.copy});assert.deepEqual(found.inventory.malformed,[]);assert.deepEqual(found.inventory.foreign,[]);
});
test('checkpoint qualifies actual bytes and refuses an externally changed cached copy before close acknowledgement',()=>{
 const adapter=createNativeInputContinuity(scope),receipt=adapter.retain(material('2.45'),current);adapter.checkpoint(current);
 drafts.retainPrivateNativeInput({...receipt.copy,input:{...receipt.copy.input,text:'2.55'}},receipt);const before=saved();assert.throws(()=>adapter.checkpoint(current),/Newer private input/);assert.deepEqual(saved(),before);
});
test('two actual concurrent processes retain every distinct writer copy without a per-Expression map race',async()=>{
 const moduleUrl=new URL('packages/live-shell/ui/src/continuity/nativeInputs.ts',root).href;
 const start=writer=>new Promise((done,fail)=>{
  const code=`import {register} from 'node:module';register(${JSON.stringify(loader)},import.meta.url);const {createNativeInputContinuity}=await import(${JSON.stringify(moduleUrl)});const adapter=createNativeInputContinuity(${JSON.stringify(scope)},${JSON.stringify(writer)});for(let index=0;index<10;index++)adapter.retain({...${JSON.stringify(material())},input:{kind:'text',text:${JSON.stringify(writer)}+':'+index,initial:${JSON.stringify(material().input.initial)}}},()=>true);adapter.checkpoint(()=>true);console.log('10 exact copies acknowledged');`;
  const child=spawn(process.execPath,['--experimental-webstorage',`--localstorage-file=${storageFile}`,'--input-type=module','-e',code],{stdio:['ignore','pipe','pipe']});let output='',error='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>error+=data);
  const timer=setTimeout(()=>{child.kill();fail(Error('Concurrent private storage child timed out'))},30000);child.on('error',fail);child.on('close',status=>{clearTimeout(timer);status===0?done(output):fail(Error(error))});
 });
 assert.deepEqual(await Promise.all([start('aperture-process-a'),start('aperture-process-b')]),['10 exact copies acknowledged\n','10 exact copies acknowledged\n']);
 const code=`import {register} from 'node:module';register(${JSON.stringify(loader)},import.meta.url);const {createNativeInputContinuity}=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(createNativeInputContinuity(${JSON.stringify(scope)}).read()));`;
 const child=spawnSync(process.execPath,['--experimental-webstorage',`--localstorage-file=${storageFile}`,'--input-type=module','-e',code],{encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const inventory=JSON.parse(child.stdout);
 assert.equal(inventory.copies.length,20);assert.equal(new Set(inventory.copies.map(row=>row.ref)).size,20);assert.deepEqual(inventory.copies.map(row=>row.copy.input.text).sort(),['aperture-process-a','aperture-process-b'].flatMap(writer=>Array.from({length:10},(_,index)=>writer+':'+index)).sort());assert.deepEqual(inventory.malformed,[]);assert.deepEqual(inventory.foreign,[]);
});
