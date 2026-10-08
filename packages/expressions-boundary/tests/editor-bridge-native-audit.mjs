/** Source-bound editor transport audit over a genuine native owner read.
 * No DOM/engine claim, native writes, fixtures or fabricated owner successes.
 * Malformed/stale carriers are deliberate protocol fault injection. Outgoing
 * messages use real MessageChannel FIFO observation; synchronous listener
 * instrumentation exposes subscriber exceptions and correlated outcomes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {messageWire} from './message-wire.mjs';
register('./editor-source-loader.mjs',import.meta.url);
const [{ExpressionsHost},{createNativeEditorClient},{EDITOR_CHANNEL},{createRetainedNativeEditor,installNativeEditorReceiver},{DocumentStore},{kernelDocumentToJourney},{kernelOp}] = await Promise.all([
  import('../src/host.ts'),import('../src/editorHost.ts'),import('../src/editor.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),
  import('../../../desktop/cradle/src/kernel/bridge.ts'),
]);
const argument = name => {const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1]};
const kernelUrl=argument('--kernel-url'), expressionRef=argument('--expression-ref');
if (!kernelUrl || !expressionRef) throw Error('Pass explicit --kernel-url and already-open --expression-ref; this audit never creates or opens native work');
const transport={kind:'bridge',url:kernelUrl}, origin='http://127.0.0.1:8788';
const inspect=async()=>{
  const result=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:expressionRef}},AbortSignal.timeout(10000));
  assert.equal(result.error,undefined,result.error);assert.equal(result.outcome?.result,'expression');
  assert.equal(result.outcome.data.document?.expression_ref,expressionRef,'An existing genuine native document is required');
  return result.outcome.data.document;
};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nativeBefore=await inspect(), view=kernelDocumentToJourney(nativeBefore);
const sceneId=view.startSceneId??view.journey.scenes[0]?.id;
assert.ok(sceneId&&view.bindings[sceneId]);
let blockedEffects=0;
const denied=()=>{blockedEffects++;throw Error('This read-only audit refuses owner mutations before dispatch')};
const store=new DocumentStore(view.journey);
const ownerPorts={store,sceneId:()=>sceneId,nativeView:()=>view,
  selection:()=>({entity_ids:[],step_id:null}),nativeSelect:denied,commit:denied,change:denied,afterHistory:denied,selectLocal:denied,openEditor:denied,
  standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>true};
const retained=createRetainedNativeEditor(ownerPorts);
const genuineReading=retained.read();
class ObservedMessages extends EventTarget {
  handlers=new Map();
  addEventListener(type,handler,options){super.addEventListener(type,handler,options);if(type==='message')this.handlers.set(handler,options)}
  removeEventListener(type,handler,options){super.removeEventListener(type,handler,options);if(type==='message')this.handlers.delete(handler)}
  deliver(event){for(const handler of [...this.handlers.keys()])typeof handler==='function'?handler(event):handler.handleEvent(event)}
}
async function aperture(initialReading=genuineReading,document=nativeBefore){
  const wire=messageWire(), surface=new ObservedMessages(), frame=new EventTarget();
  let visible=true;
  frame.src=`${origin}/__application/expressions/index.html`;frame.closest=()=>null;
  frame.contentWindow={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);wire.port1.postMessage(data)}};
  const host=new ExpressionsHost(frame,{bindingId:'native-editor-audit',owners:{channels:{}},messageTarget:new EventTarget(),isPresented:()=>visible});
  const setState=(revision=document.revision,selectedScene=initialReading.basis.scene_ref)=>host.handleMessage({source:frame.contentWindow,origin,data:{v:1,kind:'oi-app-state',state:{
    hostMode:'expressions',sceneCount:document.scenes.length,document:{id:document.expression_ref,name:document.title},
    nativeScene:{expression_ref:document.expression_ref,revision,scene_ref:selectedScene},
  }}});
  await setState();
  const client=createNativeEditorClient(host,surface);
  const deliver=(data,extra={})=>surface.deliver({source:frame.contentWindow,origin,data,...extra});
  const request=async value=>{const promise=client.request(value);await wire.observe();return {promise,carrier:wire.messages.filter(row=>row.schema===EDITOR_CHANNEL).at(-1)}};
  const result=(carrier,reply={ok:true,reading:initialReading})=>({schema:EDITOR_CHANNEL,kind:'result',token:carrier.token,req:carrier.req,bindingId:carrier.bindingId,epoch:carrier.epoch,reply});
  return {wire,surface,frame,host,client,request,deliver,result,setState,setVisible(value){visible=value},close(){try{client.dispose()}finally{host.dispose();wire.dispose()}}};
}
const results=[];
async function check(name,run){try{await run();results.push({name,passed:true})}catch(error){results.push({name,passed:false,error:error.message})}}
async function withClient(run){const a=await aperture();try{await run(a)}finally{a.close()}}
await check('real retained-owner reading matches the exact native expression and scene',async()=>{
  assert.equal(genuineReading.basis.expression_ref,nativeBefore.expression_ref);
  assert.equal(genuineReading.basis.revision,nativeBefore.revision);
  assert.ok(nativeBefore.scenes.some(scene=>scene.scene_ref===genuineReading.basis.scene_ref));
  assert.ok(genuineReading.scene.entities.length>0);assert.deepEqual(store.document,view.journey);
});
await check('chosen controls read the real expression-wide list and preserve exact entry identity',async()=>{
  assert.deepEqual(genuineReading.chosenControls.entries,view.journey.shared?.toolbelt??[]);
  assert.equal(genuineReading.chosenControls.available,!!view.journey.shared);
  assert.deepEqual(genuineReading.chosenControls.controls.map(row=>row.entry_id),genuineReading.chosenControls.entries.map(row=>row.id));
});
await check('a missing chosen-control family is a correlated refusal',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'}),malformed=structuredClone(genuineReading);
  delete malformed.chosenControls;
  assert.doesNotThrow(()=>a.deliver(a.result(carrier,{ok:true,reading:malformed})));
  assert.equal((await promise).ok,false);
}));
await check('duplicate chosen-control identity cannot enter presentation',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'}),malformed=structuredClone(genuineReading);
  assert.ok(malformed.chosenControls.controls.length>=2,'The genuine work must exercise multiple chosen controls');
  malformed.chosenControls.controls[1].entry_id=malformed.chosenControls.controls[0].entry_id;
  a.deliver(a.result(carrier,{ok:true,reading:malformed}));assert.equal((await promise).ok,false);
}));
await check('a chosen control with a different property definition cannot enter presentation',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'}),malformed=structuredClone(genuineReading);
  const control=malformed.chosenControls.controls.find(row=>row.binding);
  assert.ok(control,'The genuine work must supply a defined chosen parameter');
  control.binding.key+=':foreign';
  a.deliver(a.result(carrier,{ok:true,reading:malformed}));assert.equal((await promise).ok,false);
}));
await check('non-finite chosen parameter values cannot enter presentation',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'}),malformed=structuredClone(genuineReading);
  const control=malformed.chosenControls.controls.find(row=>row.binding);
  assert.ok(control,'The genuine work must supply a defined chosen parameter');
  control.base_value=NaN;
  a.deliver(a.result(carrier,{ok:true,reading:malformed}));assert.equal((await promise).ok,false);
}));
await check('foreign frame and origin cannot settle an editor request',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'});let settled=false;promise.then(()=>{settled=true});
  a.deliver(a.result(carrier),{source:{}});a.deliver(a.result(carrier),{origin:'https://foreign.example'});
  await Promise.resolve();assert.equal(settled,false);
  a.deliver(a.result(carrier));assert.equal((await promise).ok,true);
}));
await check('stale captured native revision is refused before posting a mutation',()=>withClient(async a=>{
  const initial=await a.request({operation:'read'});a.deliver(a.result(initial.carrier));await initial.promise;
  const count=a.wire.messages.filter(row=>row.schema===EDITOR_CHANNEL).length;
  const result=await a.client.request({operation:'save',basis:{...genuineReading.basis,revision:genuineReading.basis.revision+1}});
  assert.equal(result.ok,false);assert.match(result.error,/changed|refresh/i);await a.wire.observe();
  assert.equal(a.wire.messages.filter(row=>row.schema===EDITOR_CHANNEL).length,count);
}));
await check('hiding the issued target preserves its genuine read acknowledgement and keeps new request authority strict',()=>withClient(async a=>{
  const values=[];a.client.subscribe(value=>values.push(value));const {promise,carrier}=await a.request({operation:'read'});
  a.setVisible(false);const reply={ok:true,reading:genuineReading};a.deliver(a.result(carrier,reply));
  assert.equal(await promise,reply,'The exact owning result survives a presentation change');
  assert.equal(values.at(-1),genuineReading);
  const hidden=await a.client.request({operation:'read'});assert.equal(hidden.ok,false);assert.match(hidden.error,/open.*native.*scene/i);
}));
await check('a genuine different selected scene blocks old reading adoption without relabeling its acknowledged read',async()=>{
  const ref='expression:techne-m0.central.dd19f55a16862f362d32617854728b2a';
  const answer=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:ref}},AbortSignal.timeout(10000));
  assert.equal(answer.error,undefined,answer.error);const document=answer.outcome.data.document;
  assert.ok(document?.scenes?.length>=2,'This case requires the existing multi-scene Central work');
  const conversion=kernelDocumentToJourney(document),selectedId=conversion.startSceneId??conversion.journey.scenes[0].id;
  const different=document.scenes.find(scene=>scene.scene_ref!==conversion.bindings[selectedId].scene_ref);
  assert.ok(different);
  const centralOwner=createRetainedNativeEditor({...ownerPorts,store:new DocumentStore(conversion.journey),sceneId:()=>selectedId,nativeView:()=>conversion});
  const centralReading=centralOwner.read(),a=await aperture(centralReading,document);
  try{
    const values=[];a.client.subscribe(value=>values.push(value));const {promise,carrier}=await a.request({operation:'read'});
    await a.setState(document.revision,different.scene_ref);const count=values.length,reply={ok:true,reading:centralReading};
    a.deliver(a.result(carrier,reply));assert.equal(await promise,reply,'An acknowledged owner read remains an acknowledged read');
    assert.equal(values.length,count,'Only the selected scene can enter the editor presentation');assert.equal(values.at(-1),null);
    const after=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:ref}},AbortSignal.timeout(10000));
    assert.equal(digest(after.outcome.data.document),digest(document));
  }finally{a.close()}
});
await check('reload invalidates pending editor operations',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'});a.frame.dispatchEvent(new Event('load'));
  const result=await promise;assert.equal(result.ok,false);assert.match(result.error,/reload|reopen/i);
  await a.setState(nativeBefore.revision);a.deliver(a.result(carrier));
}));
await check('an old unsolicited reading cannot re-enter a replacement frame epoch',()=>withClient(async a=>{
  const values=[];a.client.subscribe(value=>values.push(value));const {promise,carrier}=await a.request({operation:'read'});
  a.deliver(a.result(carrier));assert.equal((await promise).ok,true);
  a.frame.dispatchEvent(new Event('load'));await a.setState(nativeBefore.revision);
  const count=values.length;
  a.deliver({schema:EDITOR_CHANNEL,kind:'reading',token:carrier.token,bindingId:carrier.bindingId,epoch:carrier.epoch,reading:genuineReading});
  assert.equal(values.length,count,'A retained token does not prove that this reading belongs to the new frame epoch');
  assert.equal(values.at(-1),null);
}));
await check('older same-scene native readings do not replace the current editor reading',()=>withClient(async a=>{
  const values=[];a.client.subscribe(value=>values.push(value));const {promise,carrier}=await a.request({operation:'read'});
  a.deliver(a.result(carrier));await promise;await a.setState(nativeBefore.revision+1);
  const count=values.length;
  a.deliver({schema:EDITOR_CHANNEL,kind:'reading',token:carrier.token,bindingId:carrier.bindingId,epoch:carrier.epoch,reading:genuineReading});
  assert.equal(values.length,count,'Exact subject continuity also needs current native revision admission');
}));
await check('malformed entity readings are a correlated refusal, never a thrown receive handler',()=>withClient(async a=>{
  const {promise,carrier}=await a.request({operation:'read'}), malformed={...genuineReading,scene:{...genuineReading.scene,entities:[null]}};
  assert.doesNotThrow(()=>a.deliver(a.result(carrier,{ok:true,reading:malformed})));
  assert.equal((await promise).ok,false);
}));
await check('a subscriber exception cannot strand an owner acknowledgement or starve other subscribers',()=>withClient(async a=>{
  let other=0;
  const stop=a.client.subscribe(value=>{if(value)throw Error('Deliberate failing UI subscriber')});
  a.client.subscribe(value=>{if(value)other++});const {promise,carrier}=await a.request({operation:'read'});
  let settled=false;promise.then(()=>{settled=true});let thrown;
  try{a.deliver(a.result(carrier))}catch(error){thrown=error}
  await Promise.resolve();stop();
  assert.equal(settled,true,`The acknowledged request must settle even when a subscriber throws (${thrown?.message??'no thrown error'})`);
  assert.equal(other,1,'An independent subscriber still receives the reading');
}));
await check('subscriber failure during dispose cannot leave editor message subscriptions attached',()=>withClient(async a=>{
  let closing=false;const stop=a.client.subscribe(value=>{if(closing&&value===null)throw Error('Deliberate disposal subscriber fault')});
  closing=true;let thrown;try{a.client.dispose()}catch(error){thrown=error}finally{stop()}
  assert.equal(a.surface.handlers.size,0,`All message subscriptions must release (${thrown?.message??'no thrown error'})`);
}));
await check('receiver refuses stale authored basis and open human gestures before entering an owner effect',async()=>{
  const wire=messageWire(), target=new ObservedMessages();target.location={origin};
  target.parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);wire.port1.postMessage(data)}};
  const receiver=installNativeEditorReceiver(retained,target);
  const send=(req,request)=>target.deliver({source:target.parent,origin,data:{schema:EDITOR_CHANNEL,kind:'request',token:'native-audit',bindingId:'native-editor-audit',epoch:0,req,request}});
  try{
    send('read',{operation:'read'});await wire.observe();assert.equal(wire.messages.at(-1).reply.ok,true);
    send('old-authoring',{operation:'save',basis:{...genuineReading.basis,authored_revision:genuineReading.basis.authored_revision+1}});await wire.observe();
    assert.equal(wire.messages.at(-1).reply.ok,false);assert.match(wire.messages.at(-1).reply.error,/authoring revision|captured scene/i);
    store.begin();send('human-gesture',{operation:'save',basis:genuineReading.basis});await wire.observe();
    assert.equal(wire.messages.at(-1).reply.ok,false);assert.match(wire.messages.at(-1).reply.error,/human gesture/i);
    assert.equal(blockedEffects,0);
  }finally{store.finish();receiver.dispose();wire.dispose()}
});
await check('receiver publishes its admitted binding and epoch so stale subscriptions can be rejected',async()=>{
  const wire=messageWire(), target=new ObservedMessages();target.location={origin};
  target.parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);wire.port1.postMessage(data)}};
  const receiver=installNativeEditorReceiver(retained,target);
  try{
    target.deliver({source:target.parent,origin,data:{schema:EDITOR_CHANNEL,kind:'request',token:'native-audit',bindingId:'native-editor-audit',epoch:7,req:'read',request:{operation:'read'}}});
    receiver.publish();await wire.observe();const published=wire.messages.find(row=>row.kind==='reading');
    assert.equal(published.bindingId,'native-editor-audit');assert.equal(published.epoch,7);
  }finally{receiver.dispose();wire.dispose()}
});
await check('receiver requires a native read admission before dispatching any mutation',async()=>{
  const wire=messageWire(),target=new ObservedMessages();target.location={origin};
  target.parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);wire.port1.postMessage(data)}};
  const receiver=installNativeEditorReceiver(retained,target),before=blockedEffects;
  try{
    target.deliver({source:target.parent,origin,data:{schema:EDITOR_CHANNEL,kind:'request',token:'native-audit',bindingId:'native-editor-audit',epoch:0,req:'unadmitted-save',request:{operation:'save',basis:genuineReading.basis}}});
    await wire.observe();assert.equal(wire.messages.at(-1).reply.ok,false);
    assert.equal(blockedEffects,before,'The refusal must precede every owner effect port');
    assert.match(wire.messages.at(-1).reply.error,/read.*native.*editor/i);
  }finally{receiver.dispose();wire.dispose()}
});
await check('older authoring revisions cannot overwrite a more recent local owner reading',()=>withClient(async a=>{
  const local=new DocumentStore(view.journey),owner=createRetainedNativeEditor({...ownerPorts,store:local});
  local.touch();const later=owner.read(),values=[];a.client.subscribe(value=>values.push(value));
  const {promise,carrier}=await a.request({operation:'read'});a.deliver(a.result(carrier,{ok:true,reading:later}));await promise;
  const count=values.length;a.deliver({schema:EDITOR_CHANNEL,kind:'reading',token:carrier.token,bindingId:carrier.bindingId,epoch:carrier.epoch,reading:genuineReading});
  assert.equal(values.length,count,'A native revision match does not admit an older authoring revision');assert.equal(values.at(-1),later);
}));
let intentionalRefusalPorts=0;
for(const retirement of ['dispose','newer-epoch']) await check(`receiver retires an asynchronous denied outcome after ${retirement}`,async()=>{
  // Exercise the actual retained owner's asynchronous commit path. This port
  // deliberately denies every write before native dispatch; it never invents
  // an owning success. The case tests late error delivery, not native saving.
  let release,completed;
  const gate=new Promise(resolve=>{release=resolve}),finished=new Promise(resolve=>{completed=resolve});
  const owner=createRetainedNativeEditor({...ownerPorts,commit:async()=>{
    intentionalRefusalPorts++;
    try{await gate;throw Error('The read-only audit port deliberately refuses write dispatch')}
    finally{completed()}
  }});
  const wire=messageWire(),target=new ObservedMessages();target.location={origin};
  target.parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);wire.port1.postMessage(data)}};
  const receiver=installNativeEditorReceiver(owner,target);
  const send=(req,operation,epoch=0)=>target.deliver({source:target.parent,origin,data:{schema:EDITOR_CHANNEL,kind:'request',token:'native-async-audit',bindingId:'native-editor-audit',epoch,req,request:operation}});
  try{
    send('read',{operation:'read'});await wire.observe();assert.equal(wire.messages.at(-1).reply.ok,true);
    send('late-save',{operation:'save',basis:genuineReading.basis});await wire.observe();
    assert.equal(wire.messages.some(row=>row.req==='late-save'),false);
    if(retirement==='dispose')receiver.dispose();
    else{
      send('current-read',{operation:'read'},1);await wire.observe();
      const current=wire.messages.find(row=>row.req==='current-read');
      assert.equal(current?.reply.ok,true,'A newer frame epoch may read while the old owning operation finishes');assert.equal(current.epoch,1);
    }
    release();await finished;await wire.observe();
    assert.equal(wire.messages.some(row=>row.req==='late-save'),false,'A retired asynchronous outcome cannot enter a different lifetime');
  }finally{release();receiver.dispose();wire.dispose()}
});
const nativeAfter=await inspect();
assert.equal(digest(nativeAfter),digest(nativeBefore),'The entire personal native document must be unchanged');
assert.equal(blockedEffects,0,'No native owner mutation may even enter the audit effect port');
const sourceFiles=['../src/editorHost.ts','../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts'];
const sources=await Promise.all(sourceFiles.map(async path=>({path,sha256:createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex')})));
console.log(JSON.stringify({grade:'B',claim:'actual production host/client/receiver and retained authoring read over a genuine native document; malformed/stale carrier and asynchronous readonly-port refusal fault injection only; no DOM/save acceptance',kernel_url:kernelUrl,expression_ref:expressionRef,revision:nativeBefore.revision,document_sha256:digest(nativeBefore),native_writes:0,intentional_refusal_ports:intentionalRefusalPorts,sources,passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length,results},null,2));
process.exitCode=results.some(result=>!result.passed)?1:0;
