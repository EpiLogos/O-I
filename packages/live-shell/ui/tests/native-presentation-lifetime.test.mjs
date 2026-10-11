import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {messageWire} from '../../../expressions-boundary/tests/message-wire.mjs';

const root = new URL('../../../../',import.meta.url),compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;for(const suffix of ['.ts','.tsx']){try{return await n(s+suffix,c)}catch{}}if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}export async function load(u,c,n){if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(u).pathname}).outputText}}`)}`,import.meta.url);
const [{ContinuityResources},{ExpressionsHost},{kernelDocumentToJourney},typescript] = await Promise.all([
  import('../src/continuity/resources.ts'),import('../../../expressions-boundary/src/host.ts'),
  import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts',root)),import(compiler),
]);
const ts = typescript.default;
const files = {};
for(const [name,path] of Object.entries({workspace:'packages/live-shell/ui/src/shell/workspace.tsx',browser:'packages/live-shell/ui/src/components/WorldBrowser.tsx',panel:'packages/live-shell/ui/src/panels/expressions.tsx',kernel:'desktop/cradle/src/kernel/KernelProvider.tsx'})) {
  const source = await readFile(new URL(path,root),'utf8');files[name] = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
}
const nodes = (file,predicate) => {const found=[];const walk=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,walk)};walk(file);return found};
const variableCallback = (file,name) => {
  const declaration = nodes(file,n=>ts.isVariableDeclaration(n)&&n.name.getText(file)===name)[0];
  assert.ok(declaration,`production ${name} exists`);
  const callback = declaration.initializer.arguments?.[0] ?? declaration.initializer;
  assert.ok(ts.isArrowFunction(callback));return callback.getText(file);
};
const effect = (file,contains) => nodes(file,n=>ts.isCallExpression(n)&&n.expression.getText(file)==='useEffect'&&n.arguments[0]?.getText(file).includes(contains))[0].arguments[0].getText(file);
function execute(source,bindings) {
  // Execute the actual receiving closures with actual resource instances.
  // Ref/setter observers replace only React scheduling, never native owners.
  const js = ts.transpileModule(`const receiving = ${source};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return new Function(...Object.keys(bindings),js+'\nreturn receiving;')(...Object.values(bindings));
}
const access = {transport:{kind:'bridge',url:'http://127.0.0.1:4180'},scope:{owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'archived-native-presentation-source-check'}};
function workspace() {
  const state = {resources:new ContinuityResources(),accessGeneration:{current:0},accessReadyRef:{current:false},heldNativeAccess:{current:null},transportRef:{current:{kind:'unavailable',reason:'No admitted access'}},openingBindings:{current:new Map()}};
  const publications = [];
  for(const name of ['setAccessEpoch','setAccessReady','setRecoveredScopes','setSettledScopes','setSourceErrors','setNativeScope','setTransport'])state[name]=value=>publications.push([name,value]);
  return {state,publications,current:execute(variableCallback(files.workspace,'nativeAccessCurrent'),state),
    attach:execute(variableCallback(files.workspace,'attachNativeAccess'),state),transport:execute(variableCallback(files.workspace,'attachTransport'),state),
    lifetime:execute(effect(files.workspace,'resources.retire()'),state)};
}

test('live production resource guard refuses stale ready snapshots immediately on retirement',()=>{
  const w = workspace();w.attach(access);
  const epoch = w.state.accessGeneration.current,listing = w.state.resources.directory('source-workspace');
  assert.equal(w.current(epoch),true);assert.equal(w.state.resources.hasAccess(),true);
  w.state.resources.retire();
  assert.equal(w.state.accessReadyRef.current,true); // deliberately stale rendered ready snapshot
  assert.equal(w.current(epoch),false);assert.equal(w.state.resources.hasAccess(),false);
  assert.throws(()=>w.state.resources.directory('source-workspace'),/Directory reading requires/);
  assert.match(listing.activeWorkspaceKey,/^retired:/);
});

test('actual resource effect reattaches only held admission and advances epoch across a refresh',()=>{
  const w = workspace();w.attach(access);
  const oldEpoch=w.state.accessGeneration.current,oldListing=w.state.resources.directory('source-workspace'),cleanup=w.lifetime();
  cleanup();assert.equal(w.current(oldEpoch),false);assert.equal(w.state.accessReadyRef.current,false);
  const nextCleanup=w.lifetime(),nextEpoch=w.state.accessGeneration.current;
  assert.equal(nextEpoch,oldEpoch+1);assert.equal(w.current(oldEpoch),false);assert.equal(w.current(nextEpoch),true);
  assert.notEqual(w.state.resources.directory('source-workspace'),oldListing);
  assert.deepEqual(w.state.heldNativeAccess.current,access);
  assert.ok(w.publications.some(([name,value])=>name==='setAccessEpoch'&&value===nextEpoch));
  nextCleanup();assert.equal(w.current(nextEpoch),false);
});

test('explicit owner retirement or changed transport cannot be restored by resource setup',()=>{
  for(const retire of [w=>w.attach(null),w=>w.transport({kind:'unavailable',reason:'Owner access retired'})]) {
    const w=workspace();w.attach(access);const epoch=w.state.accessGeneration.current;
    const cleanup=w.lifetime();cleanup();retire(w);
    const cleanupAgain=w.lifetime();
    assert.equal(w.state.heldNativeAccess.current,null);assert.equal(w.state.resources.hasAccess(),false);
    assert.equal(w.current(epoch),false);assert.equal(w.state.accessReadyRef.current,false);cleanupAgain();
  }
});

test('actual WorldBrowser directory effect refuses retired resources before directory acquisition',()=>{
  const w=workspace();w.attach(access);const epoch=w.state.accessGeneration.current;
  w.state.resources.retire();const updates=[];
  const receive=execute(effect(files.browser,'resources.directory(workspaceId)'),{
    fileEpoch:{current:0},setDirectory:v=>updates.push(['directory',v]),setOpening:v=>updates.push(['opening',v]),setError:v=>updates.push(['error',v]),setLoading:v=>updates.push(['loading',v]),
    transport:access.transport,accessReady:true,sourceRecoveryReady:true,origin:{current:{workspaceId:'source-workspace'}},workspaceId:'source-workspace',accessEpoch:epoch,
    workspace:{nativeAccessCurrent:w.current},resources:w.state.resources,path:'',
  });
  assert.doesNotThrow(()=>receive());assert.deepEqual(updates.at(-1),['loading',false]);
  assert.equal(w.state.resources.hasAccess(),false);
});

test('real host delayed qualified state clears only the production panel host fault',async t=>{
  const raw=JSON.parse(await readFile(process.env.OI_NATIVE_PRESENTATION_ACK ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/glyph-ui-timing-ack-20261008.json','utf8'));
  const doc=raw.response.outcome.data.document,view=kernelDocumentToJourney(doc),scene=view.journey.scenes[0],binding=view.bindings[scene.id];
  // Presentation grammar over actual archived owner material. This tests the
  // real channel/status receiving path, not an invented owner acknowledgement.
  const reading={hostMode:'techne',sceneIndex:0,sceneCount:view.journey.scenes.length,sceneName:scene.name,
    document:{id:doc.expression_ref,name:doc.title},nativeScene:{expression_ref:doc.expression_ref,revision:doc.revision,scene_ref:binding.scene_ref}};
  const w=workspace();let operationFault;
  try{w.state.resources.directory('retired-source')}catch(error){operationFault=error.message}
  let hostFault=null,status,unavailable;
  const expired=new Promise(resolve=>{unavailable=resolve});
  const onStatusNode=nodes(files.panel,n=>ts.isPropertyAssignment(n)&&n.name.getText(files.panel)==='onStatus')[0];
  const onStatus=execute(onStatusNode.initializer.getText(files.panel),{live:true,setStatus:v=>{status=v},setHostFault:v=>{hostFault=v},setFault:v=>{operationFault=v}});
  const wire=messageWire(),frame=new EventTarget(),origin='http://127.0.0.1:5176';
  frame.src=origin+'/__application/expressions/index.html';frame.contentWindow={postMessage:(data,target)=>{assert.equal(target,origin);wire.port1.postMessage(data)}};frame.closest=()=>null;
  const host=new ExpressionsHost(frame,{bindingId:'source-presentation-check',owners:{channels:{}},messageTarget:new EventTarget(),handshakeTimeoutMs:5,onStatus:(value,reason)=>{onStatus(value,reason);if(value==='unavailable')unavailable()}});
  t.after(()=>{host.dispose();wire.dispose()});
  await expired;assert.match(hostFault,/state handshake/);assert.equal(host.isReady(),false);
  await host.handleMessage({source:frame.contentWindow,origin:'https://wrong-origin.invalid',data:{v:1,kind:'oi-app-state',state:reading}});
  assert.equal(host.isReady(),false);assert.match(hostFault,/state handshake/);
  await host.handleMessage({source:frame.contentWindow,origin,data:{v:1,kind:'oi-app-state',state:reading}});
  assert.equal(host.isReady(),true);assert.equal(hostFault,null);assert.equal(status,'Expressions');
  assert.match(operationFault,/Directory reading requires/);assert.equal(host.getState().nativeScene.revision,9);
});

test('production kernel admission refuses queued SurfaceOpen before any native call while lifetime is unavailable',async()=>{
  const errors=[],state={epochKey:'actual-source-epoch',ownerEpoch:{current:{key:'actual-source-epoch',generation:0}},operationAdmission:{current:false},applySerial:{current:Promise.resolve()},
    reportOpError:v=>errors.push(v),kernelOp:()=>{throw Error('Native calls are unavailable in this source regression')},transport:access.transport};
  const apply=execute(variableCallback(files.kernel,'apply'),state);
  const op={op:'surface_open',surface_id:'source-presentation-check',kind:'expressions',title:'Expressions'};
  assert.equal(await apply(op),null);assert.match(errors.at(-1),/retired owner access/);
  state.operationAdmission.current=true;state.ownerEpoch.current.key='new-owner-epoch';
  assert.equal(await apply(op),null);assert.match(errors.at(-1),/captured retired owner access/);
});

const deferred = () => {let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function admissionBindings() {
  const publications=[],state={operationAdmission:{current:true},setOperationReady:v=>publications.push(v)};
  return {...state,publications,publishOperationAdmission:execute(variableCallback(files.kernel,'publishOperationAdmission'),state)};
}

test('actual startup effect closes reactive admission until state settles and cleanup forbids late settlement',async()=>{
  const a=admissionBindings(),pending=deferred(),calls=[];
  const state={...a,ownerEpoch:{current:{key:'source-epoch',generation:3}},receiptOwner:{current:'source-epoch'},epochKey:'source-epoch',transport:access.transport,
    kernelOp:(_transport,op)=>{calls.push(op);return pending.promise},setReceipts:()=>{},seenSeq:{current:0},deliveredSeq:{current:0},
    setStateSettled:()=>assert.fail('Retired startup must not settle the live projection'),merge:()=>assert.fail('Retired startup must not merge material')};
  const cleanup=execute(effect(files.kernel,'const initial = await kernelOp'),state)();
  assert.deepEqual(calls,[{op:'state'}]);assert.equal(a.operationAdmission.current,false);assert.deepEqual(a.publications,[false]);
  cleanup();assert.equal(state.ownerEpoch.current.generation,4);assert.deepEqual(a.publications,[false,false]);
  // Closing the scheduling barrier after cleanup carries no native outcome.
  pending.resolve(undefined);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(a.operationAdmission.current,false);
});

test('actual replay closes reactive admission and does not restore a retired lifetime after its read',async()=>{
  const a=admissionBindings(),pending=deferred(),abort=new AbortController(),calls=[],retirements=[];
  const subscription=nodes(files.kernel,n=>ts.isCallExpression(n)&&n.expression.getText(files.kernel)==='subscribeTopic')[0];
  const state={...a,alive:true,ownerEpoch:{current:{key:'source-epoch',generation:3}},transport:access.transport,
    callbacks:{current:{onAccessRetired:()=>retirements.push('retired'),onResync:()=>assert.fail('Retired replay cannot qualify access')}},
    kernelOp:(_transport,op,signal)=>{calls.push({op,signal});return pending.promise},merge:()=>assert.fail('Retired replay must not merge material')};
  const replay=execute(subscription.arguments[2].getText(files.kernel),state);
  const lifetime={signal:abort.signal,isCurrent:()=>!abort.signal.aborted};
  const completion=replay({latest_seq:0},lifetime);
  assert.equal(state.ownerEpoch.current.generation,4);assert.equal(a.operationAdmission.current,false);
  assert.deepEqual(a.publications,[false]);assert.deepEqual(retirements,['retired']);
  assert.deepEqual(calls.map(call=>call.op),[{op:'world_read'}]);assert.equal(calls[0].signal,abort.signal);
  abort.abort();pending.resolve(undefined);await completion;
  assert.equal(a.operationAdmission.current,false);assert.deepEqual(a.publications,[false]);
});

test('actual presentation effect waits reactive readiness and retains exact admission diagnostics',async()=>{
  const receiveSource=effect(files.panel,'bindingRequests.current.has(key)'),updates=[],requests=[];
  const owner={id:'source-workspace',project:null,layout:{mode:'techne',surfaces:{}}};
  const bindings={workspace:{accessReady:true,accessEpoch:7},kernel:{operationReady:false,apply:()=>assert.fail('Unready presentation must not dispatch')},book:{current:owner},
    expressionBinding:()=>null};
  const receive=execute(receiveSource,bindings);assert.equal(receive(),undefined);
  // Exercise a real production refusal through apply's retired-owner gate.
  const errors=[],state={epochKey:'old-epoch',ownerEpoch:{current:{key:'new-epoch',generation:1}},reportOpError:v=>errors.push(v)};
  const refusedApply=execute(variableCallback(files.kernel,'apply'),state);
  const readyBindings={...bindings,kernel:{operationReady:true,apply:refusedApply,lastOpError:()=>errors.at(-1)},
    bindingRequests:{current:new Set()},withHostedDescriptor:value=>value,crypto:globalThis.crypto,
    bookRef:{current:{current:owner}},
    workspaceRef:{current:{nativeAccessCurrent:()=>true}},setSurfaceFault:value=>updates.push(value),setFault:()=>assert.fail('Surface refusal must not overwrite a working-operation fault')};
  execute(receiveSource,readyBindings)();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(updates.length,1);assert.match(updates[0],/captured retired owner access/);
  assert.equal(readyBindings.bindingRequests.current.size,0);assert.deepEqual(requests,[]);
  const receivingEffect=nodes(files.panel,n=>ts.isCallExpression(n)&&n.expression.getText(files.panel)==='useEffect'&&n.arguments[0]?.getText(files.panel).includes('bindingRequests.current.has(key)'))[0];
  assert.ok(receivingEffect.arguments[1].elements.some(n=>n.getText(files.panel)==='kernel.operationReady'),'real readiness changes trigger the receiving effect again');
});

test('actual presentation rejection retains diagnostics only for its current owner and presentation cut',async()=>{
  for(const retire of ['epoch','workspace','mode',null]) {
    const owner={id:'source-workspace',project:null,layout:{mode:'techne',surfaces:{}}},bookRef={current:{current:owner}},updates=[];
    let current=true,release;const barrier=new Promise(resolve=>{release=resolve});
    const resources=new ContinuityResources();
    const kernel={operationReady:true,lastOpError:()=>null,apply:async()=>{
      await barrier;
      // A genuine resource owner refusal, with no fabricated native reply.
      return resources.directory('unattached-source-workspace');
    }};
    execute(effect(files.panel,'bindingRequests.current.has(key)'),{workspace:{accessReady:true,accessEpoch:7},kernel,book:{current:owner},bookRef,
      expressionBinding:()=>null,bindingRequests:{current:new Set()},withHostedDescriptor:value=>value,crypto:globalThis.crypto,
      workspaceRef:{current:{nativeAccessCurrent:()=>current}},setSurfaceFault:value=>updates.push(value),setFault:()=>assert.fail('Surface rejection must not overwrite a working-operation fault')})();
    if(retire==='epoch')current=false;
    if(retire==='workspace')bookRef.current={current:{...owner,id:'new-workspace'}};
    if(retire==='mode')bookRef.current={current:{...owner,layout:{...owner.layout,mode:'knowledge'}}};
    release();await new Promise(resolve=>setImmediate(resolve));
    if(retire===null){assert.equal(updates.length,1);assert.match(updates[0],/Directory reading requires/)}
    else assert.deepEqual(updates,[]);
  }
});

const readinessInputPath=process.env.OI_NATIVE_READINESS_INPUT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/native-state-world-readiness-input-20261008.json';
async function readinessInput() {
  const input=JSON.parse(await readFile(readinessInputPath,'utf8'));
  assert.equal(input.schema,'oi.native-state-readiness-input/v1');
  for(const name of ['state','world_read']) {assert.equal(input.readings[name].response.ok,true);assert.equal(input.readings[name].response.outcome.result,name)}
  return input;
}
function mergeObserver() {
  const snapshots=[],receipts=[];
  return {snapshots,receipts,merge:execute(variableCallback(files.kernel,'merge'),{admitReceipts:value=>receipts.push(value),setSnapshot:value=>snapshots.push(value)})};
}

test('actual startup admission prefix accepts genuine archived state only for its current lifetime',async()=>{
  const input=await readinessInput();
  const bootstrap=nodes(files.kernel,n=>ts.isCallExpression(n)&&n.expression.getText(files.kernel)==='useEffect'&&n.arguments[0]?.getText(files.kernel).includes('const initial = await kernelOp'))[0].arguments[0];
  const startup=nodes(bootstrap,n=>ts.isArrowFunction(n)&&n.body?.statements?.some(s=>s.getText(files.kernel).startsWith('const initial = await kernelOp')))[0];
  const statements=startup.body.statements,end=statements.findIndex(s=>s.getText(files.kernel)==='setStateSettled(true);');
  assert.ok(end>=0);
  // Run the exact native-state admission prefix; ground and subscriptions are
  // separate owner operations and are not simulated by this source check.
  const prefix=`async () => {${statements.slice(0,end+1).map(s=>s.getText(files.kernel)).join('\n')}}`;
  for(const current of [true,false]) {
    const a=admissionBindings(),m=mergeObserver(),pending=deferred(),settlements=[],requests=[];
    a.publishOperationAdmission(false);
    const run=execute(prefix,{...a,...m,current:()=>current,transport:access.transport,setStateSettled:v=>settlements.push(v),kernelOp:(_transport,op)=>{requests.push(op);return pending.promise}})();
    assert.equal(a.operationAdmission.current,false);pending.resolve(input.readings.state.response);await run;
    assert.deepEqual(requests,[input.readings.state.request]);
    assert.equal(a.operationAdmission.current,current);
    assert.deepEqual(a.publications,current?[false,true]:[false]);assert.deepEqual(settlements,current?[true]:[]);
    assert.deepEqual(m.snapshots,current?[input.readings.state.response.outcome.snapshot]:[]);
  }
});

test('actual replay admits archived world only after receiving qualification and refuses retirement during qualification',async()=>{
  const input=await readinessInput(),subscription=nodes(files.kernel,n=>ts.isCallExpression(n)&&n.expression.getText(files.kernel)==='subscribeTopic')[0];
  for(const retireWhileQualifying of [false,true]) {
    const a=admissionBindings(),m=mergeObserver(),pending=deferred(),qualification=deferred(),abort=new AbortController(),requests=[],order=[];
    const state={...a,...m,alive:true,ownerEpoch:{current:{key:'source-epoch',generation:3}},transport:access.transport,seenSeq:{current:0},deliveredSeq:{current:0},setReceipts:v=>order.push(['receipts',v]),
      callbacks:{current:{onAccessRetired:()=>order.push(['retired']),onResync:()=>{order.push(['qualifying']);return qualification.promise}}},
      kernelOp:(_transport,op,signal)=>{requests.push({op,signal});return pending.promise}};
    const replay=execute(subscription.arguments[2].getText(files.kernel),state),lifetime={signal:abort.signal,isCurrent:()=>!abort.signal.aborted};
    const completion=replay({latest_seq:7},lifetime);
    assert.equal(a.operationAdmission.current,false);assert.deepEqual(a.publications,[false]);
    pending.resolve(input.readings.world_read.response);await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(m.snapshots,[input.readings.world_read.response.outcome.snapshot]);assert.equal(state.seenSeq.current,7);assert.equal(state.deliveredSeq.current,7);
    assert.deepEqual(order,[['retired'],['receipts',[]],['qualifying']]);assert.equal(a.operationAdmission.current,false);
    if(retireWhileQualifying)abort.abort();qualification.resolve();await completion;
    assert.equal(a.operationAdmission.current,!retireWhileQualifying);assert.deepEqual(a.publications,retireWhileQualifying?[false]:[false,true]);
    assert.deepEqual(requests.map(value=>value.op),[input.readings.world_read.request]);assert.equal(requests[0].signal,abort.signal);
  }
});
