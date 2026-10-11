import test,{beforeEach} from 'node:test';
import {tmpdir} from 'node:os';
import {resolve,sep} from 'node:path';
const storageArg=process.execArgv.find(arg=>arg.startsWith('--localstorage-file='));
assert.ok(storageArg,'Use an owned OS temporary --localstorage-file for real device custody');
assert.ok(resolve(storageArg.slice('--localstorage-file='.length)).startsWith(resolve(tmpdir())+sep));
assert.equal(localStorage.constructor.name,'Storage');
beforeEach(()=>localStorage.clear());
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const root=new URL('../../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
const parameters=new URL('packages/expressions-boundary/src/parameters.ts',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{createNativeInputContinuity},face,{kernelDocumentToJourney},{applyNativeDeviceChanges},{toNativeConfig},{DocumentStore},{compileEntityForceEmitters},{NATIVE_BINDINGS},{createRetainedNativeEditor},tsModule]=await Promise.all([
 import('../src/continuity/nativeInputs.ts'),import('../src/components/NativeDeviceEditors.tsx'),import(new URL('kernelDocumentBridge.ts',author)),import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),import(new URL('nativeBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('desktop/cradle/expressions-app/src/engine/forceRuntime.ts',root)),import(parameters),import(new URL('hostEditor.ts',author)),import(compiler),
]);
const receiptPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(receiptPath,'utf8'));assert.deepEqual(receipt.before.document,receipt.after.document);
const closed=()=>{throw Error('Live native effects are closed during source verification')};
function source(){
 const view=kernelDocumentToJourney(receipt.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes[0],entity=scene.entities[0];
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:fn=>store.change(fn),afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 return {view,store,scene,entity,reading:owner.read()};
}
test('real SVG transform inversion preserves letterboxed, scaled and rotated handle coordinates',()=>{
 for(const m of [{a:2,b:0,c:0,d:2,e:100,f:80},{a:0,b:1.5,c:-1.5,d:0,e:420,f:12},{a:.75,b:.2,c:.1,d:.9,e:32,f:91}]){
  const point={x:174,y:106},screen={clientX:m.a*point.x+m.c*point.y+m.e,clientY:m.b*point.x+m.d*point.y+m.f},actual=face.nativeDeviceSvgPoint(screen,m);
  assert.ok(Math.abs(actual.x-point.x)<1e-10);assert.ok(Math.abs(actual.y-point.y)<1e-10);
 }
 assert.equal(face.nativeDeviceSvgPoint({clientX:0,clientY:0},null),null);
 assert.equal(face.nativeDeviceSvgPoint({clientX:0,clientY:0},{a:0,b:0,c:0,d:0,e:0,f:0}),null);
});
test('centre grip offset prevents initial jump and unchanged handle gestures emit no edits',()=>{
 const r=source(),extent=Math.max(1.5,Math.abs(r.entity.position.x)+r.entity.force.radius*1.4,Math.abs(r.entity.position.y)+r.entity.force.radius*1.4);
 const point={x:160+r.entity.position.x/extent*140+4,y:106-r.entity.position.y/extent*86+3},gesture=face.createNativeForceGesture(r.reading,r.entity,'centre',19,point);
 assert.deepEqual(face.nativeForceGestureChanges(gesture),[]);
 const stationary=face.moveNativeForceGesture(gesture,point);assert.ok(Math.abs(stationary.x-r.entity.position.x)<1e-14);assert.ok(Math.abs(stationary.y-r.entity.position.y)<1e-14);assert.deepEqual(face.nativeForceGestureChanges(stationary),[]);
 const moved=face.moveNativeForceGesture(gesture,{x:point.x+14,y:point.y-8.6});
 assert.ok(Math.abs(moved.x-r.entity.position.x-extent/10)<1e-12);assert.ok(Math.abs(moved.y-r.entity.position.y-extent/10)<1e-12);
});
test('force attempt keeps exact Y target across current plane change and refuses another native occurrence',()=>{
 const r=source(),gesture=face.createNativeForceGesture(r.reading,r.entity,'centre',2,{x:160,y:106}),moved=face.moveNativeForceGesture(gesture,{x:190,y:70});
 const changed=structuredClone(r.reading);changed.scene.engine.mediumPlane='horizontal';changed.basis.revision++;
 assert.equal(face.sameNativeForceTarget(moved,changed,r.entity),true);
 const changes=face.nativeForceGestureChanges(moved);assert.ok(changes.some(change=>change.target.endsWith(':y')));assert.ok(changes.every(change=>!change.target.endsWith(':z')));
 changed.entityOccurrences[r.entity.id]+=':different-occurrence';assert.equal(face.sameNativeForceTarget(moved,changed,r.entity),false);
 assert.equal(face.sameNativeForceTarget(moved,{...r.reading,basis:{...r.reading.basis,scene_ref:'scene:other'}},r.entity),false);
});
test('real registry bounds, radius units, full rich payload and one gesture Undo/Redo hold',()=>{
 const r=source(),before=structuredClone(r.store.document),gesture=face.createNativeForceGesture(r.reading,r.entity,'radius',4,{x:300,y:106}),moved=face.moveNativeForceGesture(gesture,{x:1e9,y:1e9});
 assert.equal(moved.radius,50);
 // The real whole-document owner also bounds held state-relative radii.
 // Registry maximum is not permission to truncate an overridden state.
 assert.throws(()=>applyNativeDeviceChanges(r.store.document,r.scene.id,face.nativeForceGestureChanges(moved)),/Invalid object state/);assert.deepEqual(r.store.document,before);
 const changes=face.nativeForceGestureChanges({...moved,radius:1});
 r.store.replace(applyNativeDeviceChanges(r.store.document,r.scene.id,changes));assert.equal(r.store.undoStack.length,1);
 const after=structuredClone(r.store.document),config=toNativeConfig(after.scenes[0]);assert.equal(config.entities[0].forces.radius,400);
 assert.deepEqual(after.scenes[0].parameterRacks,before.scenes[0].parameterRacks);assert.deepEqual(after.savedScenes,before.savedScenes);
 assert.deepEqual(after.scenes[0].entities[0].sequence.steps.map(s=>[s.id,s.source,s.layers]),before.scenes[0].entities[0].sequence.steps.map(s=>[s.id,s.source,s.layers]));
 assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);assert.equal(r.store.redo(),true);assert.deepEqual(r.store.document,after);
});
test('real independent force compiler retains two separate native contributions and shared resonance',()=>{
 const r=source(),inserted=applyNativeDeviceChanges(r.store.document,r.scene.id,[{kind:'force-insert',position:{x:-.5,y:.25,z:1}},{kind:'force-insert',position:{x:.5,y:-.25,z:-1}}]),scene=inserted.scenes[0],pins=scene.entities.filter(e=>e.kind==='pin');
 assert.equal(pins.length,2);const frequency=NATIVE_BINDINGS.find(row=>row.path==='cymatics.frequencyHz');
 const changed=applyNativeDeviceChanges(inserted,scene.id,[{kind:'force-mode',entity_id:pins[0].id,value:'none'},{kind:'parameter',target:`entity:${encodeURIComponent(pins[0].id)}:forces.spin`,value:2},{kind:'force-mode',entity_id:pins[1].id,value:'repel'},{kind:'parameter',target:`entity:${encodeURIComponent(pins[1].id)}:forces.strength`,value:-3},{kind:'field-setting',key:'resonanceEnabled',value:true},{kind:'parameter',target:'field.'+frequency.key,value:432}]);
 const config=toNativeConfig(changed.scenes[0]),emitters=compileEntityForceEmitters(config.entities,[]),first=emitters.find(e=>e.sourceEntityId===pins[0].id),second=emitters.find(e=>e.sourceEntityId===pins[1].id);
 assert.equal(first.strength,0);assert.equal(first.spin,2);assert.equal(first.metric,'world3d');assert.equal(second.polarity,'repel');assert.equal(second.strength,-3);assert.notDeepEqual(first.position,second.position);
 assert.equal(config.cymatics.frequencyHz,432);assert.equal(config.cymatics.enabled,true);
 config.entities.find(e=>e.id===pins[0].id).enabled=false;assert.ok(!compileEntityForceEmitters(config.entities,[]).some(e=>e.sourceEntityId===pins[0].id));
});
const scope={owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'real-source-device-input',workspace_id:'real-source-device-input',surface_id:'real-source-device-input'};
function fieldCustody(r,binding){const owner=createNativeInputContinuity(scope),aperture={owner,current:()=>true,changed:()=>{}};
 const material=face.nativeFieldInputMaterial({pointer:7,basis:r.reading.basis,value:432,initial:397,offset_x:0},'field.'+binding.key,'resonance'),custody=new face.NativeDeviceInputCustody(aperture,material,'gesture');
 return {custody,retainGesture:edit=>custody.retain(face.nativeFieldInputMaterial(edit,'field.'+binding.key,'resonance')),clearGesture:receipt=>{custody.clear(receipt);return true}};
}
const ts=tsModule.default,text=await readFile(new URL('packages/live-shell/ui/src/components/NativeDeviceEditors.tsx',root),'utf8'),ast=ts.createSourceFile('NativeDeviceEditors.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const custodyAst=ts.createSourceFile('nativeDeviceCustody.tsx',await readFile(new URL('packages/live-shell/ui/src/components/nativeDeviceCustody.tsx',root),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const find=(node,predicate)=>{const all=[];const visit=n=>{if(predicate(n))all.push(n);ts.forEachChild(n,visit)};visit(node);assert.equal(all.length,1);return all[0];};
const execute=(text,bindings)=>new Function(...Object.keys(bindings),ts.transpileModule(`const selected=${text};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+'\nreturn selected;')(...Object.values(bindings));
test('actual Field finish consumes latest ref value once, ignores another pointer and makes one real store change',async()=>{
 const surface=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FieldSurface'),finish=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='finish').initializer.getText(ast);
 const r=source(),binding=NATIVE_BINDINGS.find(row=>row.path==='cymatics.frequencyHz'),active={current:{pointer:7,basis:r.reading.basis,value:432,initial:397,offset_x:0,current:()=>true}},attempts=[];
 const cancel=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='cancel').initializer.getText(ast);
 const bindings={...fieldCustody(r,binding),active,mounted:{current:true},svg:{current:null},setDraft:()=>{},setAttempt:value=>attempts.push(value),binding,
  apply:async changes=>{r.store.replace(applyNativeDeviceChanges(r.store.document,r.scene.id,changes));try{closed()}catch(error){return {ok:false,error:error.message}}}};
 bindings.cancel=execute(cancel,bindings);const receive=execute(finish,bindings);
 receive({pointerId:8});assert.equal(r.store.undoStack.length,0);assert.ok(active.current);
 receive({pointerId:7});assert.equal(active.current,null);assert.equal(r.store.undoStack.length,1);assert.equal(attempts.length,1);assert.equal(attempts[0].value,432);
 receive({pointerId:7});assert.equal(r.store.undoStack.length,1);assert.equal(toNativeConfig(r.store.document.scenes[0]).cymatics.frequencyHz,432);
});
test('actual numeric commit retains newer typing on a real closed-boundary refusal',async()=>{
 const control=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NumberControl'),commit=find(control,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='commit').initializer.getText(ast);
 const r=source(),owner=createNativeInputContinuity(scope),material={basis:r.reading.basis,target:{scope:'entity',entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id],step_id:null,parameter:`entity:${encodeURIComponent(r.entity.id)}:forces.radius`,family:'force',axis:null}},custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{}},material,'text');
 const retainText=text=>custody.retain({...material,input:{kind:'text',text,initial:'1'}});
 const draftEpoch={current:1},effects=[],inFlight={current:false},original={current:1};let reject;
 const receiving=execute(commit,{retainText,inputCustody:{current:custody},text:'2.45',binding:{hardMin:-1000,hardMax:1000},mounted:{current:true},commitCurrent:{current:()=>true},draftEpoch,inFlight,original,retained:true,commitTarget:{current:()=>new Promise((_resolve,no)=>{reject=no})},setRetained:value=>effects.push(['retained',value]),setError:value=>effects.push(['error',value]),setText:value=>effects.push(['text',value]),short:value=>String(value)});
 receiving();assert.equal(inFlight.current,true);draftEpoch.current++;
 reject(Error('Native effect is closed; later typing must remain'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(inFlight.current,false);assert.deepEqual(effects,[['error',''],['retained',true]]);assert.equal(original.current,1);
});

test('actual device receiving predicate refuses hidden, retired, changed-cut and stale-basis callbacks',()=>{
 const r=source(),captured={epoch:1,cut:'exact-force-cut',reading:r.reading,presented:true,entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id]};
 assert.equal(face.currentNativeDeviceReply(captured,captured),true);
 for(const change of [{presented:false},{epoch:2},{cut:'other-entity-or-field-family'},{reading:{...r.reading,basis:{...r.reading.basis,revision:r.reading.basis.revision+1}}}])assert.equal(face.currentNativeDeviceReply(captured,{...captured,...change}),false);
});

test('actual Field pointer-up retains changed value after hide without dispatch or DocumentStore edit',()=>{
 const r=source(),binding=NATIVE_BINDINGS.find(row=>row.path==='cymatics.frequencyHz'),active={current:{pointer:7,basis:r.reading.basis,value:432,initial:397,offset_x:0,current:()=>false}},attempts=[],before=structuredClone(r.store.document);
 const surface=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FieldSurface'),finish=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='finish').initializer.getText(ast),cancel=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='cancel').initializer.getText(ast);
 const bindings={...fieldCustody(r,binding),active,mounted:{current:true},svg:{current:null},setDraft:()=>{},setAttempt:value=>attempts.push(value),binding,apply:closed};bindings.cancel=execute(cancel,bindings);
 execute(finish,bindings)({pointerId:7});assert.equal(active.current,null);assert.equal(attempts.length,1);assert.equal(attempts[0].value,432);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});

test('actual invoke refuses stale or hidden apply before touching the closed owner and ignores late retired refusal',async()=>{
 const r=source(),panel=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NativeDeviceEditors'),invoke=find(panel,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='invoke').initializer.getText(ast);
 const captured={epoch:1,cut:'same-force-cut',reading:r.reading,presented:true,entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id]};let now={...captured};
 const effects=[],pending={current:false},bindings={captureCurrent:()=>{const receipt={...captured};return reply=>face.currentNativeDeviceReply(receipt,now,reply)},presentation:{current:{reading:r.reading}},sameEditorBasis:(a,b)=>Object.keys(a).every(key=>a[key]===b[key]),pending,alive:{current:true},request:closed,setBusy:value=>effects.push(['busy',value]),setError:value=>effects.push(['error',value])};
 const receive=execute(invoke,bindings),operation={operation:'apply',basis:r.reading.basis,changes:[]};
 now.presented=false;assert.equal((await receive(operation)).ok,false);assert.deepEqual(effects,[]);
 now={...captured};assert.equal((await receive({...operation,basis:{...operation.basis,revision:operation.basis.revision+1}})).ok,false);assert.deepEqual(effects,[]);
 let release;bindings.request=()=>new Promise((_yes,no)=>{release=no});const pendingReceive=execute(invoke,bindings)(operation);
 now={...captured,cut:'other-field-cut'};release(Error('Real native effect remains closed in this source test'));const result=await pendingReceive;
 assert.equal(result.ok,false);assert.match(result.error,/closed/);assert.deepEqual(effects,[['busy',true],['error',null],['busy',false]]);assert.equal(pending.current,false);
});

test('actual numeric commit refuses a retired first-focus target before native dispatch',()=>{
 const control=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NumberControl'),commit=find(control,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='commit').initializer.getText(ast),effects=[];
 const receiving=execute(commit,{text:'2.45',binding:{hardMin:-1000,hardMax:1000},mounted:{current:true},commitCurrent:{current:()=>false},draftEpoch:{current:1},inFlight:{current:false},original:{current:2.35},retained:true,commitTarget:{current:closed},setRetained:value=>effects.push(['retained',value]),setError:value=>effects.push(['error',value]),setText:value=>effects.push(['text',value]),short:value=>String(value)});
 receiving();assert.equal(effects.length,1);assert.match(effects[0][1],/captured device presentation/);
});

test('actual hidden-cut effect permanently retires captured callbacks across same-target reveal',()=>{
 const r=source(),renderPresentation={epoch:1,cut:'same-force-cut',reading:r.reading,presented:true,entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id]},renderLifetime={cut:renderPresentation.cut,live:true};let now={...renderPresentation};
 const panel=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NativeDeviceEditors'),capture=find(panel,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='captureCurrent').initializer.getText(ast),effect=find(panel,n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('readPresentation().presented')).arguments[0].getText(ast);
 const bindings={renderPresentation,renderLifetime,lifetime:{current:1},readPresentation:()=>now,currentNativeDeviceReply:face.currentNativeDeviceReply};const receive=execute(capture,bindings)();assert.equal(receive(),true);
 now={...now,presented:false};execute(effect,bindings)();assert.equal(renderLifetime.live,false);assert.equal(receive(),false);
 now={...renderPresentation};assert.equal(receive(),false);assert.equal(execute(capture,bindings)()(),false);
 const fresh=execute(capture,{...bindings,renderLifetime:{cut:renderPresentation.cut,live:true}})();assert.equal(fresh(),true);
});

test('actual mount cleanup/setup replay retires old epochs while keeping fresh visible callbacks usable',()=>{
 const r=source(),panel=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NativeDeviceEditors'),effect=find(panel,n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('alive.current = true')).arguments[0].getText(ast),capture=find(panel,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='captureCurrent').initializer.getText(ast);
 const renderLifetime={cut:'same-force-cut',live:true},alive={current:true},lifetime={current:0},renderPresentation={epoch:0,cut:renderLifetime.cut,reading:r.reading,presented:true,entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id]};
 const bindings={renderPresentation,renderLifetime,alive,lifetime,cutLifetime:{current:renderLifetime},readPresentation:()=>({...renderPresentation,epoch:lifetime.current,presented:alive.current}),currentNativeDeviceReply:face.currentNativeDeviceReply};
 const setup=execute(effect,bindings),firstCleanup=setup(),first=execute(capture,bindings)();assert.equal(first(),true);firstCleanup();assert.equal(first(),false);
 const secondCleanup=setup();assert.equal(first(),false);assert.equal(execute(capture,bindings)()(),true);secondCleanup();assert.equal(alive.current,false);assert.equal(renderLifetime.live,false);
});

for(const family of ['ForceSurface','FieldSurface'])test(`actual ${family} lost capture ignores another pointer and retains only its owned changed gesture`,()=>{
 const r=source(),surface=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text===family),handler=find(surface,n=>ts.isJsxAttribute(n)&&n.name.getText(ast)==='onLostPointerCapture').initializer.expression.getText(ast);
 const binding=NATIVE_BINDINGS.find(row=>row.path==='cymatics.frequencyHz'),pointer=7;
 const gesture=family==='ForceSurface'?{...face.createNativeForceGesture(r.reading,r.entity,'centre',pointer,{x:160,y:106}),x:r.entity.position.x+.25}:{pointer,basis:r.reading.basis,value:432,initial:397,offset_x:0};
 const active={current:gesture},attempts=[],before=structuredClone(r.store.document),bindings={active,mounted:{current:true},svg:{current:null},setDraft:()=>{},setGesture:()=>{},setAttempt:value=>attempts.push(value),nativeForceGestureChanges:face.nativeForceGestureChanges,binding};
 const owner=createNativeInputContinuity(scope),material=family==='ForceSurface'?face.nativeForceInputMaterial(gesture):face.nativeFieldInputMaterial(gesture,'field.'+binding.key,'resonance'),custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{}},material,'gesture');bindings.retainGesture=edit=>custody.retain(family==='ForceSurface'?face.nativeForceInputMaterial(edit):face.nativeFieldInputMaterial(edit,'field.'+binding.key,'resonance'));
 const cancel=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='cancel').initializer.getText(ast),retain=find(surface,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='retainAndCancel').initializer.getText(ast);
 bindings.cancel=execute(cancel,bindings);bindings.retainAndCancel=execute(retain,bindings);const receive=execute(handler,bindings);
 receive({pointerId:8});assert.equal(active.current,gesture);assert.deepEqual(attempts,[]);
 receive({pointerId:pointer});assert.equal(active.current,null);assert.deepEqual(attempts,[gesture]);assert.deepEqual(owner.read().copies[0].copy.input,material.input);
 receive({pointerId:pointer});assert.equal(attempts.length,1);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});

test('actual device reply cannot retarget a captured force to another native source body',()=>{
 const r=source(),captured={epoch:1,cut:'captured-native-body',reading:r.reading,presented:true,entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id]};
 for(const change of [reading=>{reading.basis.scene_ref='scene:another'},reading=>{reading.basis.expression_ref='expression:another'},reading=>{reading.entityOccurrences[r.entity.id]='entity:replacement-native-body'},reading=>{reading.selection.entity_ids=[]}]){
  const reading=structuredClone(r.reading);change(reading);
  assert.equal(face.currentNativeDeviceReply(captured,{...captured,reading},{ok:true,reading}),false);
 }
 assert.equal(face.currentNativeDeviceReply(captured,captured,{ok:true,reading:r.reading}),true);
});

test('real keyed-remount custody restores one exact own raw copy without changing its initial native basis',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),aperture={owner,current:()=>true,changed:()=>{}},material={basis:r.reading.basis,target:{scope:'entity',entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id],step_id:null,parameter:`entity:${encodeURIComponent(r.entity.id)}:forces.radius`,family:'force',axis:null}},first=new face.NativeDeviceInputCustody(aperture,material,'text');
 const receipt=first.retain({...material,input:{kind:'text',text:' 2.45e-\nλ ',initial:String(r.entity.force.radius)}}),bytes=localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref);
 const later={...material,basis:{...material.basis,revision:material.basis.revision+1}},remount=new face.NativeDeviceInputCustody(aperture,later,'text');
 assert.deepEqual(remount.receipt.copy,receipt.copy);assert.equal(localStorage.getItem('oi-cradle.draft.v1:'+receipt.ref),bytes);
 const foreign=new face.NativeDeviceInputCustody({owner:createNativeInputContinuity(scope),current:()=>true,changed:()=>{}},material,'text');assert.equal(foreign.receipt,null);assert.equal(owner.read().copies.length,1);
});
test('a new human gesture on a new basis retains a distinct private copy and never rebases the old failed gesture',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),aperture={owner,current:()=>true,changed:()=>{}},gesture=face.moveNativeForceGesture(face.createNativeForceGesture(r.reading,r.entity,'centre',7,{x:160,y:106}),{x:183,y:92}),material=face.nativeForceInputMaterial(gesture),custody=new face.NativeDeviceInputCustody(aperture,material,'gesture');
 const old=custody.retain({...material,refusal:'Actual native effects closed'}),oldBytes=localStorage.getItem('oi-cradle.draft.v1:'+old.ref),later={...gesture,basis:{...gesture.basis,revision:gesture.basis.revision+1},x:gesture.x+.1},next=custody.retain(face.nativeForceInputMaterial(later));
 assert.notEqual(next.ref,old.ref);assert.deepEqual(next.copy.basis,later.basis);assert.equal(localStorage.getItem('oi-cradle.draft.v1:'+old.ref),oldBytes);assert.equal(owner.read().copies.length,2);
 const remount=new face.NativeDeviceInputCustody(aperture,material,'gesture');assert.equal(remount.receipt,null);assert.match(remount.fault,/Divergent/);assert.throws(()=>remount.retain(material),/Divergent/);assert.equal(owner.read().copies.length,2);
});
test('full Force and Field producer material strips receiving callbacks and qualifies exact restoration',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),force={...face.moveNativeForceGesture(face.createNativeForceGesture(r.reading,r.entity,'centre',4,{x:160,y:106}),{x:195,y:70}),current:closed},fm=face.nativeForceInputMaterial(force),fr=owner.retain(fm,()=>true);
 assert.equal(Object.hasOwn(fr.copy.input.gesture,'current'),false);assert.deepEqual(face.nativeDeviceGestureCopy(fr,'force'),fm.input.gesture);
 const field={pointer:9,basis:r.reading.basis,value:432,initial:397,offset_x:9,current:closed},material=face.nativeFieldInputMaterial(field,'field.cymatics.frequencyHz','resonance'),receipt=owner.retain(material,()=>true);assert.equal(Object.hasOwn(receipt.copy.input.gesture,'current'),false);assert.deepEqual(face.nativeDeviceGestureCopy(receipt,'field'),material.input.gesture);
 const bad=owner.retain({...fm,input:{kind:'gesture',gesture:{unexpected:2},changes:[]}},()=>true);assert.throws(()=>face.nativeDeviceGestureCopy(bad,'force'));assert.equal(owner.read().copies.length,3);
});
test('actual numeric onChange retains incomplete exact text before any native Apply or blur',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),material={basis:r.reading.basis,target:{scope:'entity',entity_id:r.entity.id,entity_ref:r.reading.entityOccurrences[r.entity.id],step_id:null,parameter:`entity:${encodeURIComponent(r.entity.id)}:forces.radius`,family:'force',axis:null}},custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{}},material,'text'),draftEpoch={current:0},effects=[];
 const control=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NumberControl'),handler=find(control,n=>ts.isJsxAttribute(n)&&n.name.getText(ast)==='onChange').initializer.expression.getText(ast);
 const receive=execute(handler,{draftEpoch,setRetained:v=>effects.push(['retained',v]),setText:v=>effects.push(['text',v]),setError:v=>effects.push(['error',v]),retainText:text=>custody.retain({...material,input:{kind:'text',text,initial:String(r.entity.force.radius)}})}),before=structuredClone(r.store.document);
 receive({target:{value:'2.45e-'}});const first=custody.receipt;receive({target:{value:'2.45e-\nλ'}});
 assert.equal(draftEpoch.current,2);assert.equal(owner.read().copies[0].copy.input.text,'2.45e-\nλ');assert.throws(()=>custody.clear(first),/Newer private input/);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});
test('actual Force pointerMove durably retains exact changed geometry before cancellation or owner dispatch',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),gesture={...face.createNativeForceGesture(r.reading,r.entity,'centre',7,{x:160,y:106}),current:()=>true},material=face.nativeForceInputMaterial(gesture),custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{}},material,'gesture'),active={current:gesture};
 const surface=find(ast,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ForceSurface'),handler=find(surface,n=>ts.isJsxAttribute(n)&&n.name.getText(ast)==='onPointerMove').initializer.expression.getText(ast),before=structuredClone(r.store.document),point={x:187,y:88};
 execute(handler,{active,coordinate:()=>point,moveNativeForceGesture:face.moveNativeForceGesture,nativeForceGestureChanges:face.nativeForceGestureChanges,setGesture:()=>{},setAttempt:()=>{},cancel:closed,custody,retainGesture:edit=>custody.retain(face.nativeForceInputMaterial(edit))})({pointerId:7});
 assert.deepEqual(owner.read().copies[0].copy.input,face.nativeForceInputMaterial(active.current).input);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});
test('own exact Discard cannot consume changed input or a retired aperture and keeps foreign originals',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),material=face.nativeFieldInputMaterial({pointer:7,basis:r.reading.basis,value:432,initial:397,offset_x:0},'field.cymatics.frequencyHz','resonance');let current=true;
 const custody=new face.NativeDeviceInputCustody({owner,current:()=>current,changed:()=>{}},material,'gesture'),first=custody.retain(material),second=custody.retain({...material,input:{...material.input,gesture:{...material.input.gesture,value:433},changes:[{kind:'parameter',target:material.target.parameter,value:433}]}});
 assert.throws(()=>custody.clear(first),/Newer private input/);current=false;assert.throws(()=>custody.clear(second),/aperture retired/);assert.equal(owner.read().copies.length,1);current=true;custody.clear(second);assert.equal(owner.read().copies.length,0);
});

test('genuine changed owner receipt marks unretained failure and only actual retain or exact Discard clears it',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),material=face.nativeFieldInputMaterial({pointer:1,basis:r.reading.basis,value:432,initial:397,offset_x:0},'field.cymatics.frequencyHz','resonance'),failures=[],custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{},failure:(key,reason)=>failures.push([key,reason])},material,'gesture');
 const initial=custody.retain(material);owner.retain({...material,refusal:'A separate current receiving callback retained this body'},()=>true,initial);
 assert.throws(()=>custody.retain(material),/Newer private input/);assert.match(failures.at(-1)[1],/Newer private input/);assert.equal(owner.read().copies.length,1);
 const remount=new face.NativeDeviceInputCustody(custody.aperture,material,'gesture'),receipt=remount.retain(material);assert.equal(failures.at(-1)[1],null);remount.clear(receipt);assert.equal(failures.at(-1)[1],null);assert.equal(owner.read().copies.length,0);
});
test('after deliberate recovery-panel Discard a new human edit has a new copy without refreshing native basis',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),material=face.nativeFieldInputMaterial({pointer:1,basis:r.reading.basis,value:432,initial:397,offset_x:0},'field.cymatics.frequencyHz','resonance'),custody=new face.NativeDeviceInputCustody({owner,current:()=>true,changed:()=>{}},material,'gesture'),first=custody.retain(material);
 owner.clear(owner.read().copies[0],()=>true);const next=custody.retain({...material,input:{...material.input,gesture:{...material.input.gesture,value:433},changes:[{kind:'parameter',target:material.target.parameter,value:433}]}});
 assert.notEqual(next.ref,first.ref);assert.deepEqual(next.copy.basis,first.copy.basis);assert.equal(owner.read().copies.length,1);
});

test('actual context pulse keeps device custody tied to the same owner while distinct owners retire the projection',()=>{
 const r=source(),owner=createNativeInputContinuity(scope),aperture={owner,current:()=>true,changed:()=>{}},gesture=face.moveNativeForceGesture(face.createNativeForceGesture(r.reading,r.entity,'centre',7,{x:160,y:106}),{x:183,y:92}),material=face.nativeForceInputMaterial(gesture),custody=new face.NativeDeviceInputCustody(aperture,material,'gesture');
 custody.retain(material);custody.retain(face.nativeForceInputMaterial({...gesture,basis:{...gesture.basis,revision:gesture.basis.revision+1}}));
 const hook=find(custodyAst,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useDeviceInputCustody'),condition=find(hook,n=>ts.isIfStatement(n)).expression.getText(custodyAst),held={current:{aperture,key:JSON.stringify([1]),custody}},key=held.current.key;
 assert.equal(execute(`()=>(${condition})`,{held,aperture:{...aperture,failures:[]},key})(),false);
 assert.equal(execute(`()=>(${condition})`,{held,aperture:{...aperture,owner:createNativeInputContinuity(scope)},key})(),true);assert.equal(owner.read().copies.length,2);assert.equal(held.current.custody,custody);
});
