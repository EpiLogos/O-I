/** Production compiler/evaluator/admission and actual durable private owner.
 * Native effects stay closed; no GPU or accepted mutation ACK is simulated. */
import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {tmpdir} from 'node:os'
import {resolve,sep} from 'node:path'
const storage=process.execArgv.find(arg=>arg.startsWith('--localstorage-file='))
assert.ok(storage,'Use an owned temporary Node WebStorage file')
assert.ok(resolve(storage.slice('--localstorage-file='.length)).startsWith(resolve(tmpdir())+sep))
assert.equal(localStorage.constructor.name,'Storage')
const root=new URL('../../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(new URL('packages/expressions-boundary/src/parameters.ts',root).href)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`,import.meta.url)
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root)
const [drive,devices,{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},{toNativeConfig},shared,model,{computeMorphDrive},{createNativeInputContinuity},{NativeDeviceInputCustody},react,ssr,tsModule]=await Promise.all([
 import('../src/components/nativeMorphController.ts'),import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import(new URL('nativeBridge.ts',author)),import(new URL('sharedSettings.ts',author)),import(new URL('model.ts',author)),import(new URL('desktop/cradle/expressions-app/src/engine/morphSignal.ts',root)),import('../src/continuity/nativeInputs.ts'),import('../src/components/NativeDeviceEditors.tsx'),import('../node_modules/react/index.js'),import('../node_modules/react-dom/server.node.js'),import(compiler),
])
const {NativeMorphDrive}=await import('../src/components/NativeMorphDrive.tsx')
const {NATIVE_BINDINGS}=await import(new URL('packages/expressions-boundary/src/parameters.ts',root))
const {PARAM_REGISTRY}=await import(new URL('desktop/cradle/expressions-app/src/engine/paramRegistry.ts',root))
const {fieldValue}=await import('../src/components/nativeFieldFaceValues.ts')
const automationEngine=await import(new URL('desktop/cradle/expressions-app/src/engine/automation.ts',root))
const receiptPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
const archived=JSON.parse(await readFile(receiptPath,'utf8'));assert.deepEqual(archived.before.document,archived.after.document)
const nativeBytes=JSON.stringify(archived.after.document)
function source(){const view=kernelDocumentToJourney(archived.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes.find(s=>s.id===view.startSceneId),entity=scene.entities[0]
 const closed=()=>{throw Error('Native effects are closed in Morph source verification')}
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false})
 return {view,store,scene,entity,owner,reading:owner.read()}}
const parameter=(path,value)=>({kind:'parameter',target:'field.'+drive.morphBinding(path).key,value})
const setting=(key,value)=>devices.validateNativeMorphSetting({kind:'morph-setting',key,value})
const readingFrom=(r,journey)=>({...r.reading,scene:shared.effectiveScene(journey,journey.scenes.find(s=>s.id===r.scene.id))})
const scope={owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'morph-source-epoch',workspace_id:'morph-source-test',surface_id:'world.expressions'}
const inventory=()=>Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]}).sort(([a],[b])=>a.localeCompare(b))
beforeEach(()=>localStorage.clear())

test('coupled handle captures exact native Field basis and only its original pointer can move',()=>{
 const r=source(),gesture=drive.startMorphPhaseGesture(r.reading,41,{x:50,y:80}),before=structuredClone(gesture)
 assert.equal(drive.moveMorphPhaseGesture(gesture,42,{x:120,y:20}),gesture);assert.deepEqual(gesture,before)
 const moved=drive.moveMorphPhaseGesture(gesture,41,{x:125,y:42.5})
 assert.ok(Math.abs(moved.theta-gesture.theta-.25)<=drive.morphBinding('toroidalMorph.toroidalPhase').step/2)
 assert.ok(Math.abs(moved.phi-gesture.phi-.25)<=drive.morphBinding('toroidalMorph.poloidalPhase').step/2)
 assert.deepEqual(moved.basis,r.reading.basis);assert.deepEqual(moved.initial,gesture.initial)
 const changes=drive.morphPhaseChanges(moved);assert.equal(changes.length,2);assert.deepEqual(changes.map(c=>c.target),['field.thetaOffset','field.phiOffset'])
})
test('no-motion and returning to original pointer position preserve exact unsnapped initial values',()=>{
 const r=source();r.reading.scene.morph.thetaOffset=.123456;r.reading.scene.morph.phiOffset=-.345678
 const initial=drive.startMorphPhaseGesture(r.reading,1,{x:20,y:30}),still=drive.moveMorphPhaseGesture(initial,1,{x:20,y:30})
 assert.equal(drive.changedMorphPhase(still),false);assert.deepEqual(still,initial)
 const moved=drive.moveMorphPhaseGesture(initial,1,{x:100,y:100}),returned=drive.moveMorphPhaseGesture(moved,1,{x:20,y:30});assert.equal(drive.changedMorphPhase(returned),false)
})
test('phase keyboard uses exact native step/turn conversion, Shift precision and native hard bounds',()=>{
 const r=source(),initial=drive.startMorphPhaseGesture(r.reading,-1,{x:0,y:0}),b=drive.morphBinding('toroidalMorph.toroidalPhase')
 assert.ok(Math.abs(b.factor-2*Math.PI)<1e-12);assert.ok(Math.abs(b.step*2*Math.PI-.01)<1e-12)
 assert.equal(drive.nudgeMorphPhaseGesture(initial,'ArrowRight').theta,initial.theta+b.step)
 assert.equal(drive.nudgeMorphPhaseGesture(initial,'ArrowLeft',true).theta,initial.theta-b.step*10)
 const moved=drive.moveMorphPhaseGesture(initial,-1,{x:1e8,y:-1e8});assert.equal(moved.theta,b.hardMax);assert.equal(moved.phi,drive.morphBinding('toroidalMorph.poloidalPhase').hardMax)
 assert.throws(()=>drive.moveMorphPhaseGesture(initial,-1,{x:Infinity,y:0}),/finite coordinate/)
})
test('one coupled native reducer transaction preserves body/assets/states and has one actual Undo/Redo',()=>{
 const r=source(),before=structuredClone(r.store.document),initial=drive.startMorphPhaseGesture(r.reading,1,{x:0,y:0}),moved=drive.moveMorphPhaseGesture(initial,1,{x:70,y:30})
 const authored=devices.applyNativeDeviceChanges(before,r.scene.id,drive.morphPhaseChanges(moved));assert.deepEqual(authored.scenes[0].entities,before.scenes[0].entities)
 r.store.replace(authored);assert.equal(r.store.undoStack.length,1);const after=structuredClone(r.store.document)
 const native=toNativeConfig(r.store.document.scenes[0]);assert.equal(native.toroidalMorph.toroidalPhase,moved.theta*2*Math.PI);assert.equal(native.toroidalMorph.poloidalPhase,moved.phi*2*Math.PI)
 assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);assert.equal(r.store.redo(),true);assert.deepEqual(r.store.document,after)
})
test('native projection uses actual compiled configuration and exact conjugate phase evaluator',()=>{
 const r=source(),changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('morphEnabled',true),setting('driveShape','sine'),setting('law','product'),parameter('toroidalMorph.toroidalPhase',.25),parameter('toroidalMorph.poloidalPhase',0),parameter('toroidalMorph.fiberPhaseOffset',0),parameter('toroidalMorph.driveDepth',.5),parameter('toroidalMorph.holdRatio',0),parameter('toroidalMorph.oscillationSpeed',1),parameter('toroidalMorph.poloidalRate',0)])
 const reading=readingFrom(r,changed),projection=drive.nativeMorphProjection(reading),native=toNativeConfig(reading.scene)
 assert.deepEqual(projection.config,native.toroidalMorph);assert.equal(projection.duration,1);assert.ok(Math.abs(projection.initial.progress-.75)<1e-12)
 for(const point of projection.points){const actual=computeMorphDrive(native.toroidalMorph,native.toroidalMorph.toroidalPhase+Math.PI*2*point.seconds,native.toroidalMorph.poloidalPhase);assert.equal(point.progress,actual.progress);assert.equal(point.signal,actual.signal)}
 assert.equal(projection.scope,'field');assert.throws(()=>drive.nativeMorphProjection(reading,undefined,514),/2–513/)
})
test('runtime observations never replace the authored native curve or unautomated gesture start',()=>{
 const r=source(),before=drive.nativeMorphProjection(r.reading),reading={...r.reading,observation:{simTime:91,effectiveValues:{'field.thetaOffset':.73,'field.phiOffset':-.28,'field.thetaRate':9,'field.depth':.09}}}
 assert.deepEqual(drive.nativeMorphProjection(reading),before)
 const gesture=drive.startMorphPhaseGesture(reading,5,{x:0,y:0})
 assert.equal(gesture.theta,drive.morphValue(r.reading,'toroidalMorph.toroidalPhase'));assert.equal(gesture.phi,drive.morphValue(r.reading,'toroidalMorph.poloidalPhase'))
 const preview=drive.nativeMorphProjection(reading,{theta:.25,phi:.5})
 assert.equal(preview.config.toroidalPhase,Math.PI/2);assert.equal(preview.config.poloidalPhase,Math.PI);assert.deepEqual(drive.nativeMorphProjection(reading),before)
})
test('active replacing phase starts at actual evaluator output and offsets its range with one history entry',()=>{
 const r=source(),journey=structuredClone(r.store.document),scene=journey.scenes[0],target='field.thetaOffset',path='toroidalMorph.toroidalPhase'
 scene.automation=[{id:'morph-phase-clock',enabled:true,target,type:'lfo',wave:'sine',min:.1,max:.7,rate:.5,phase:0,blend:'replace',duration:4,delay:0,loop:'loop',firedAt:null}]
 const evaluate=s=>{const config=toNativeConfig(s);return automationEngine.applyAutomations(config,config.automations,0,automationEngine.createAutomationRuntime()).config}
 const actual=evaluate(scene),observed=devices.readNativeDeviceEffectiveValues(scene,{config:actual}),reading={...readingFrom(r,journey),observation:{simTime:0,effectiveValues:observed}}
 assert.ok(Math.abs(observed[target]-.4)<1e-12)
 const initial=drive.startMorphPhaseGesture(reading,1,{x:0,y:0});assert.equal(initial.theta,observed[target]);assert.equal(drive.morphValue(reading,path),scene.morph.thetaOffset)
 assert.deepEqual(drive.nativeMorphProjection(reading).config,toNativeConfig(scene).toroidalMorph)
 const moved=drive.nudgeMorphPhaseGesture(initial,'ArrowRight'),changed=devices.applyNativeDeviceChanges(journey,scene.id,drive.morphPhaseChanges(moved),observed),next=changed.scenes[0],delta=moved.theta-initial.theta
 assert.ok(Math.abs(next.automation[0].min-scene.automation[0].min-delta)<1e-12);assert.ok(Math.abs(next.automation[0].max-scene.automation[0].max-delta)<1e-12)
 assert.equal(next.morph.thetaOffset,scene.morph.thetaOffset);assert.equal(next.automation[0].rate,scene.automation[0].rate);assert.equal(next.automation[0].phase,scene.automation[0].phase)
 assert.ok(Math.abs(devices.readNativeDeviceEffectiveValues(next,{config:evaluate(next)})[target]-moved.theta)<1e-12)
 const store=new DocumentStore(journey);store.replace(changed);const recorded=structuredClone(store.document);assert.equal(store.undoStack.length,1);assert.equal(store.undo(),true);assert.deepEqual(store.document,journey);assert.equal(store.redo(),true);assert.deepEqual(store.document,recorded)
 const missing={...reading,observation:undefined};assert.throws(()=>drive.startMorphPhaseGesture(missing,1,{x:0,y:0}),/effective automated value/);assert.throws(()=>devices.applyNativeDeviceChanges(journey,scene.id,drive.morphPhaseChanges(moved)),/effective automated value/)
 assert.deepEqual(drive.nativeMorphProjection(missing).config,toNativeConfig(scene).toroidalMorph);assert.equal(drive.morphPhaseInputIdentity(missing).target.parameter,null)
 scene.automation[0].enabled=false;assert.equal(drive.startMorphPhaseGesture(readingFrom(r,journey),2,{x:0,y:0}).theta,scene.morph.thetaOffset)
 scene.automation[0].enabled=true;scene.automation[0].blend='add';assert.equal(drive.startMorphPhaseGesture({...readingFrom(r,journey),observation:{simTime:0,effectiveValues:observed}},2,{x:0,y:0}).theta,scene.morph.thetaOffset)
})
for(const [key,values]of Object.entries(devices.NATIVE_MORPH_SETTINGS))test(`every admitted native ${key} value survives real reducer/compiler with correct source path`,()=>{
 const r=source()
 for(const value of values){const changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting(key,value)]),scene=changed.scenes[0],native=toNativeConfig(scene)
  assert.equal(drive.morphSettingValue(scene,key),value)
  assert.equal(native.toroidalMorph[key==='morphEnabled'?'enabled':key==='law'?'interference':key],key==='law'&&value==='theta'?'toroidalOnly':value)
  assert.deepEqual(scene.entities,r.scene.entities)
 }
})
test('wrong key/value/scope/foreign operands and duplicate setting refuse atomically without authored mutation',()=>{
 const r=source(),before=structuredClone(r.store.document)
 const bad=[{kind:'morph-setting',key:'morphEnabled',value:'true'},{kind:'morph-setting',key:'trajectory',value:'invented'},{kind:'morph-setting',key:'law',value:'toroidalOnly'},{kind:'morph-setting',key:'__proto__',value:true},{kind:'morph-setting',key:'driveShape',value:'sine',entity_id:r.entity.id},{kind:'morph-setting',key:'driveShape',value:'sine',scope:'entity'}]
 for(const value of bad)assert.throws(()=>devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter('toroidalMorph.driveDepth',.4),value]),/Morph setting|shared Field/)
 assert.throws(()=>devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('law','product'),setting('law','sum')]),/same Morph setting twice/)
 assert.deepEqual(r.store.document,before)
})
test('existing shared Field law/engine path changes resolve for all Scenes without retargeting any entity',()=>{
 const r=source(),journey=structuredClone(r.store.document);journey.scenes.push(model.blankScene('Shared Field neighbor'));shared.initialiseShared(journey)
 shared.toggleShared(journey,journey.scenes[0],'engine.driveShape');shared.toggleShared(journey,journey.scenes[0],'morph.law')
 const base=structuredClone(journey),changed=devices.applyNativeDeviceChanges(journey,r.scene.id,[setting('driveShape','pulse'),setting('law','beat')])
 assert.equal(changed.shared.values['engine.driveShape'],'pulse');assert.equal(changed.shared.values['morph.law'],'beat')
 for(const scene of changed.scenes){const native=toNativeConfig(shared.effectiveScene(changed,scene));assert.equal(native.toroidalMorph.driveShape,'pulse');assert.equal(native.toroidalMorph.interference,'beat')}
 assert.deepEqual(changed.scenes.map(s=>s.entities),base.scenes.map(s=>s.entities));assert.deepEqual(journey,base)
})
test('compound phase draft uses actual durable private owner and strict original producer decoder',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'morph-writer'),aperture={owner,current:()=>true,changed(){}},initial=drive.startMorphPhaseGesture(r.reading,2,{x:0,y:0}),gesture=drive.moveMorphPhaseGesture(initial,2,{x:60,y:-30}),material=drive.morphPhaseInputMaterial(gesture),custody=new NativeDeviceInputCustody(aperture,material,'gesture'),receipt=custody.retain(material)
 assert.deepEqual(drive.morphPhaseGestureCopy(receipt),gesture);assert.equal(owner.read().copies.length,1);assert.deepEqual(receipt.copy.basis,r.reading.basis);assert.equal(receipt.copy.target.scope,'field');assert.equal(receipt.copy.target.entity_ref,null);assert.equal(receipt.copy.input.changes.length,2)
 const before=inventory();owner.checkpoint(()=>true);assert.deepEqual(inventory(),before)
 const later=new NativeDeviceInputCustody(aperture,material,'gesture');assert.deepEqual(drive.morphPhaseGestureCopy(later.receipt),gesture)
 custody.clear(receipt);assert.equal(owner.read().copies.length,0);owner.retire()
})
test('actual durable discrete setting draft retains original source enum and basis across incoming reading',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'morph-writer'),aperture={owner,current:()=>true,changed(){}},edit={basis:r.reading.basis,change:setting('driveShape','triangle'),initial:r.scene.engine.driveShape},material=drive.morphSettingInputMaterial(edit),custody=new NativeDeviceInputCustody(aperture,material,'gesture'),receipt=custody.retain(material)
 assert.deepEqual(drive.morphSettingGestureCopy(receipt),edit);r.store.touch();assert.notEqual(r.owner.read().basis.authored_revision,receipt.copy.basis.authored_revision);owner.checkpoint(()=>true);assert.deepEqual(drive.morphSettingGestureCopy(owner.read().copies[0]),edit);custody.clear(receipt);owner.retire()
})
test('foreign private scope, malicious changed targets and changed setting key cannot decode or erase original durable copy',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'morph-writer'),gesture=drive.moveMorphPhaseGesture(drive.startMorphPhaseGesture(r.reading,3,{x:0,y:0}),3,{x:60,y:30}),material=drive.morphPhaseInputMaterial(gesture),receipt=owner.retain(material,()=>true),before=inventory()
 const tampered=structuredClone(receipt);tampered.copy.input.changes[0].target=`entity:${encodeURIComponent(r.entity.id)}:x`;assert.throws(()=>drive.morphPhaseGestureCopy(tampered),/original Field target/)
 const wrong=structuredClone(receipt);wrong.copy.target.entity_ref=r.reading.entityOccurrences[r.entity.id];assert.throws(()=>drive.morphPhaseGestureCopy(wrong),/original Field target/)
 const settingReceipt=owner.retain(drive.morphSettingInputMaterial({basis:r.reading.basis,change:setting('driveShape','triangle'),initial:r.scene.engine.driveShape}),()=>true),changed=structuredClone(settingReceipt);changed.copy.input.gesture.change={kind:'morph-setting',key:'trajectory',value:'linear'};assert.throws(()=>drive.morphSettingGestureCopy(changed),/native Morph setting|Field target/)
 assert.ok(before.every(([key,bytes])=>localStorage.getItem(key)===bytes));assert.equal(owner.read().copies.length,2);owner.retire()
})
test('retired actual private aperture and foreign writer cannot clear retained original gesture',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'morph-writer'),material=drive.morphPhaseInputMaterial(drive.startMorphPhaseGesture(r.reading,4,{x:0,y:0})),receipt=owner.retain(material,()=>true),before=inventory(),other=createNativeInputContinuity(scope,'other-morph-writer')
 assert.equal(other.clear(receipt,()=>true),false);owner.retire();assert.throws(()=>owner.clear(receipt,()=>true),/aperture retired/);assert.deepEqual(inventory(),before);other.retire()
})
test('real Morph face renders native enum/control disclosures and evaluator chart without native dispatch',()=>{
 const r=source(),paths=[],html=ssr.renderToStaticMarkup(react.createElement(NativeMorphDrive,{reading:r.reading,disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>{paths.push(path);return react.createElement('span',null,path)},createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 assert.deepEqual(paths,[...drive.MORPH_CONTROL_PATHS]);assert.match(html,/Coupled native Morph phase offsets/);assert.match(html,/Native conjugate-phase A to B drive law/);assert.match(html,/Drive waveform/);assert.match(html,/Conjugate interference/);assert.match(html,/configured law/);assert.equal(JSON.stringify(archived.after.document),nativeBytes)
})
test('real face remains readable with unavailable replacing-lane observation; no gesture starts during render',()=>{
 const r=source();r.reading.scene.automation=[{id:'unavailable-morph-clock',enabled:true,target:'field.thetaOffset',type:'lfo',wave:'sine',min:0,max:1,rate:.5,phase:0,blend:'replace',duration:4,delay:0,loop:'loop',firedAt:null}]
 assert.throws(()=>drive.startMorphPhaseGesture(r.reading,1,{x:0,y:0}),/effective automated value/)
 const html=ssr.renderToStaticMarkup(react.createElement(NativeMorphDrive,{reading:r.reading,disabled:false,apply:()=>{throw Error('Render must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>react.createElement('span',null,path),createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 assert.match(html,/Authored offsets/);assert.match(html,/solid curve evaluates the authored/);assert.equal(localStorage.length,0)
})

const facts=drive.morphDeviceFacts
const sorted=values=>[...values].sort()
const renderFace=(r,renderControl)=>ssr.renderToStaticMarkup(react.createElement(NativeMorphDrive,{reading:r.reading,disabled:false,apply:()=>{throw Error('Render must not dispatch')},captureCurrent:()=>()=>false,renderControl,createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
test('Morph facts paths are exactly the native Morph group in the registry and the native bindings',()=>{
 const registry=PARAM_REGISTRY.filter(p=>p.group==='Morph').map(p=>p.path),bindings=NATIVE_BINDINGS.filter(b=>b.group==='morph').map(b=>b.path)
 assert.equal(registry.length,16);assert.equal(new Set(facts.paths).size,facts.paths.length)
 assert.deepEqual(sorted(facts.paths),sorted(registry));assert.deepEqual(sorted(facts.paths),sorted(bindings))
 for(const path of facts.paths)assert.ok(NATIVE_BINDINGS.find(row=>row.path===path)?.label,`${path} needs a real label`)
})
test('Morph groups cover paths exactly, in app order, with no duplicate or empty group',()=>{
 assert.deepEqual(facts.groups.map(g=>g.title),['Conjugate phases','Physical morph','Manifold detail'])
 assert.ok(facts.groups.every(g=>g.paths.length>0))
 assert.deepEqual(facts.groups.flatMap(g=>[...g.paths]),[...facts.paths])
})
test('Morph compact set is a justified subset of at most four distinct paths',()=>{
 assert.ok(facts.compact.length>=1&&facts.compact.length<=4)
 assert.equal(new Set(facts.compact).size,facts.compact.length)
 for(const path of facts.compact)assert.ok(facts.paths.includes(path),`${path} is not a Morph path`)
})
test('Morph slider path is a parameter, the phase handle drives only its coupled pair, and identity matches the app',()=>{
 assert.ok(facts.paths.includes(facts.controlPath));assert.ok(!drive.MORPH_HANDLE_PATHS.includes(facts.controlPath))
 assert.deepEqual([...drive.MORPH_HANDLE_PATHS],['toroidalMorph.toroidalPhase','toroidalMorph.poloidalPhase'])
 assert.equal(facts.name,'Morph');assert.equal(facts.studio,'motion')
})
test('Morph enable light, strip toggle and summary are read from the reading',()=>{
 const r=source(),on=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('morphEnabled',true)]),off=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('morphEnabled',false)])
 assert.equal(facts.enabled(readingFrom(r,on)),true);assert.equal(facts.enabled(readingFrom(r,off)),false)
 assert.deepEqual(facts.strip.toggle,{kind:'morph-setting',key:'morphEnabled'})
 const changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter('toroidalMorph.oscillationSpeed',.37),parameter('toroidalMorph.driveDepth',.61)]),reading=readingFrom(r,changed)
 assert.equal(facts.strip.summary(reading),`θ ${fieldValue(reading.scene,'toroidalMorph.oscillationSpeed')} · φ ${fieldValue(reading.scene,'toroidalMorph.poloidalRate')} · depth ${fieldValue(reading.scene,'toroidalMorph.driveDepth')}`)
 assert.match(facts.strip.summary(reading),/θ 0\.37 .* depth 0\.61/)
})
test('the four parameters the shell previously omitted are admitted, round-trip and reach the native config',()=>{
 const r=source(),values={'toroidalMorph.oscillationAmplitude':.75,'toroidalMorph.breathRate':.5,'toroidalMorph.breathDepth':.6,'toroidalMorph.chiralCoupling':-1.25}
 const changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,Object.entries(values).map(([path,value])=>parameter(path,value))),native=toNativeConfig(changed.scenes[0]).toroidalMorph,reading=readingFrom(r,changed)
 for(const [path,value] of Object.entries(values)){assert.equal(native[path.split('.')[1]],value);assert.equal(drive.morphValue(reading,path),value)}
})
test('the charted drive law ignores Stage-manifold-only parameters and reacts to its own inputs',()=>{
 const r=source(),base=drive.nativeMorphProjection(r.reading)
 const manifold=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter('toroidalMorph.breathDepth',1.5),parameter('toroidalMorph.chiralCoupling',2),parameter('toroidalMorph.oscillationAmplitude',3),parameter('toroidalMorph.manifoldRadius',400)])
 assert.deepEqual(drive.nativeMorphProjection(readingFrom(r,manifold)).points.map(p=>p.progress),base.points.map(p=>p.progress))
 const depth=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter('toroidalMorph.driveDepth',.2)])
 assert.notDeepEqual(drive.nativeMorphProjection(readingFrom(r,depth)).points.map(p=>p.progress),base.points.map(p=>p.progress))
})
test('real Morph face lays out the three app groups in order with every control and every non-numeric switch',()=>{
 const r=source(),paths=[],html=renderFace(r,path=>{paths.push(path);return react.createElement('span',null,path)})
 assert.deepEqual(paths,[...facts.paths])
 const at=text=>{const index=html.indexOf(text);assert.ok(index>=0,`${text} is rendered`);return index}
 assert.ok(at('Coupled native Morph phase offsets')<at('>Physical morph<'));assert.ok(at('>Physical morph<')<at('>Manifold detail<'))
 for(const label of ['Morph trajectory','Oscillating drive','Spatial trajectory','Drive waveform','Conjugate interference'])assert.ok(at(label)>at('>Physical morph<')&&at(label)<at('>Manifold detail<'),`${label} sits in Physical morph`)
})
