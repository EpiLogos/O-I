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
 import('../src/components/nativeColourController.ts'),import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import(new URL('nativeBridge.ts',author)),import(new URL('sharedSettings.ts',author)),import(new URL('model.ts',author)),import(new URL('desktop/cradle/expressions-app/src/engine/morphSignal.ts',root)),import('../src/continuity/nativeInputs.ts'),import('../src/components/NativeDeviceEditors.tsx'),import('../node_modules/react/index.js'),import('../node_modules/react-dom/server.node.js'),import(compiler),
])
const {NativeColourField}=await import('../src/components/NativeColourField.tsx')
const automationEngine=await import(new URL('desktop/cradle/expressions-app/src/engine/automation.ts',root))
const receiptPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
const archived=JSON.parse(await readFile(receiptPath,'utf8'));assert.deepEqual(archived.before.document,archived.after.document)
const nativeBytes=JSON.stringify(archived.after.document)
function source(){const view=kernelDocumentToJourney(archived.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes.find(s=>s.id===view.startSceneId),entity=scene.entities[0]
 const closed=()=>{throw Error('Native effects are closed in Morph source verification')}
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false})
 return {view,store,scene,entity,owner,reading:owner.read()}}
const parameter=(path,value)=>({kind:'parameter',target:'field.'+drive.colourBinding(path).key,value})
const setting=(key,value)=>devices.validateNativeColourChange({kind:'colour-setting',key,value})
const readingFrom=(r,journey)=>({...r.reading,scene:shared.effectiveScene(journey,journey.scenes.find(s=>s.id===r.scene.id))})
const scope={owner:'central',world:'control:root',workcell:'workcell:mac',accessEpoch:'morph-source-epoch',workspace_id:'morph-source-test',surface_id:'world.expressions'}
const inventory=()=>Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]}).sort(([a],[b])=>a.localeCompare(b))
beforeEach(()=>localStorage.clear())

const nativeFeatures=await import(new URL('nativeFeatures.ts',author))

test('custom native palette is ordered 2–8 source colours with exact compiler output and full payload retention',()=>{
 const r=source(),before=structuredClone(r.store.document),colors=['#102030','#456789','#abcdef','#FEDCBA'],changed=devices.applyNativeDeviceChanges(before,r.scene.id,[{kind:'colour-palette',colors}]),scene=changed.scenes[0],native=toNativeConfig(scene)
 assert.deepEqual(scene.field.palette,colors);assert.equal(scene.engine.paletteSource,'custom');assert.deepEqual(native.color.customPaletteColors,colors);assert.deepEqual(scene.entities,before.scenes[0].entities);assert.deepEqual(changed.savedScenes,before.savedScenes);assert.deepEqual(r.store.document,before)
 const projection=drive.nativeColourProjection(readingFrom(r,changed));assert.deepEqual(projection.positions,[0,1/3,2/3,1]);assert.deepEqual(projection.config,native.color)
 r.store.replace(changed);const recorded=structuredClone(r.store.document);assert.equal(r.store.undoStack.length,1);assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);assert.equal(r.store.redo(),true);assert.deepEqual(r.store.document,recorded)
})
test('wrong native colour scope/key/value/preset/sparse palettes refuse the full batch without caller mutation',()=>{
 const r=source(),before=structuredClone(r.store.document),sparse=new Array(2)
 const bad=[{kind:'colour-palette',colors:['#fff','#000000']},{kind:'colour-palette',colors:sparse},{kind:'colour-palette',colors:['#000000']},{kind:'colour-palette',colors:Array(9).fill('#000000')},{kind:'colour-palette',colors:['#000000','#FFFFFF'],entity_id:r.entity.id},{kind:'colour-palette',colors:['#000000','#FFFFFF'],scope:'entity'},{kind:'colour-background',value:'red'},{kind:'colour-setting',key:'colorMode',value:'invented'},{kind:'colour-setting',key:'colorEnabled',value:'true'},{kind:'colour-preset',palette_id:'invented'},{kind:'colour-setting',key:'__proto__',value:true}]
 for(const change of bad)assert.throws(()=>devices.applyNativeDeviceChanges(before,r.scene.id,[parameter('color.contrast',1.25),change]),/hex|scope|disclosed|Colour/)
 assert.throws(()=>devices.applyNativeDeviceChanges(before,r.scene.id,[{kind:'colour-palette',colors:['#000000','#FFFFFF']},{kind:'colour-preset',palette_id:devices.NATIVE_COLOUR_PALETTES[0].id}]),/same Colour Field target twice/)
 assert.deepEqual(r.store.document,before)
})
test('every source-disclosed native distribution and activation reaches actual compiled colour settings',()=>{
 const r=source()
 for(const mode of devices.NATIVE_COLOUR_MODES){const changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('colorMode',mode.id),setting('colorEnabled',true)]);assert.equal(toNativeConfig(changed.scenes[0]).color.mode,mode.id);assert.equal(toNativeConfig(changed.scenes[0]).color.enabled,true)}
 const off=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('colorEnabled',false)]);assert.equal(toNativeConfig(off.scenes[0]).color.enabled,false)
})
test('each real native palette preset reuses the established writer including legacy ramp and recommendations',()=>{
 const r=source()
 for(const preset of devices.NATIVE_COLOUR_PALETTES){const expected=structuredClone(r.scene);nativeFeatures.applyPalette(expected,preset.id);const changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[{kind:'colour-preset',palette_id:preset.id}]);assert.deepEqual(changed.scenes[0],expected);assert.deepEqual(toNativeConfig(changed.scenes[0]),toNativeConfig(expected));assert.equal(drive.nativeColourProjection(readingFrom(r,changed)).positions,null)}
})
test('preset reassertion updates actual shared override even when native Scene base was already enabled',()=>{
 const r=source(),journey=structuredClone(r.store.document),scene=journey.scenes[0],preset=devices.NATIVE_COLOUR_PALETTES.find(p=>p.recommendedAngle!==undefined)
 scene.engine.colorEnabled=true;nativeFeatures.applyPalette(scene,preset.id);journey.scenes.push(model.blankScene('Shared colour neighbor'));shared.initialiseShared(journey)
 shared.toggleShared(journey,scene,'engine.colorEnabled');shared.toggleShared(journey,scene,'engine.colorMode');shared.toggleShared(journey,scene,drive.colourBinding('color.angle').bind)
 journey.shared.values['engine.colorEnabled']=false;journey.shared.values['engine.colorMode']='monochrome';journey.shared.values[drive.colourBinding('color.angle').bind]=-93
 const secondPalette=[...journey.scenes[1].field.palette],changed=devices.applyNativeDeviceChanges(journey,scene.id,[{kind:'colour-preset',palette_id:preset.id}])
 assert.equal(changed.shared.values['engine.colorEnabled'],true);assert.equal(changed.shared.values['engine.colorMode'],preset.recommendedMode);assert.equal(changed.shared.values[drive.colourBinding('color.angle').bind],preset.recommendedAngle)
 for(const s of changed.scenes){const config=toNativeConfig(shared.effectiveScene(changed,s));assert.equal(config.color.enabled,true);assert.equal(config.color.mode,preset.recommendedMode);assert.equal(config.color.angle,preset.recommendedAngle)}
 assert.deepEqual(changed.scenes[1].field.palette,secondPalette);assert.equal('field.palette' in changed.shared.values,false)
})
test('background edits preserve exact shared scalar law and all source identities',()=>{
 const r=source(),journey=structuredClone(r.store.document);journey.scenes.push(model.blankScene('Color sibling'));shared.toggleShared(journey,journey.scenes[0],'field.background')
 const changed=devices.applyNativeDeviceChanges(journey,r.scene.id,[{kind:'colour-background',value:'#AbCdEf'}]);for(const s of changed.scenes)assert.equal(toNativeConfig(shared.effectiveScene(changed,s)).color.backgroundColor,'#AbCdEf');assert.deepEqual(changed.scenes[0].entities,journey.scenes[0].entities)
})
test('real centre handle keeps original pointer, registry steps/ranges and one atomic XY Undo/Redo',()=>{
 const r=source(),edit=drive.startColourGeometry(r.reading,41,'centre',{x:100,y:90},40),before=structuredClone(edit)
 assert.equal(drive.moveColourGeometry(edit,42,{x:150,y:40}),edit);assert.deepEqual(edit,before)
 const moved=drive.moveColourGeometry(edit,41,{x:140,y:70}),changed=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,drive.colourEditChanges(moved)),native=toNativeConfig(changed.scenes[0])
 assert.deepEqual(moved.changes.map(c=>c.target),['field.'+drive.colourBinding('color.fieldCenterOffset.0').key,'field.'+drive.colourBinding('color.fieldCenterOffset.1').key]);assert.deepEqual(native.color.fieldCenterOffset,[moved.gesture.value.x,moved.gesture.value.y]);assert.equal(moved.gesture.value.x,edit.gesture.initial.x+1);assert.equal(moved.gesture.value.y,edit.gesture.initial.y+.5)
 const returned=drive.moveColourGeometry(moved,41,{x:100,y:90});assert.deepEqual(returned.gesture.value,edit.gesture.initial);assert.equal(returned.changes.length,0);assert.deepEqual(drive.colourEditChanges(returned),[])
 const doc=structuredClone(r.store.document);r.store.replace(changed);const after=structuredClone(r.store.document);assert.equal(r.store.undoStack.length,1);assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,doc);assert.equal(r.store.redo(),true);assert.deepEqual(r.store.document,after)
})
test('direction handle measures rotation about displayed centre rather than delta travel or a fabricated angle',()=>{
 const r=source(),angle=drive.colourBinding('color.angle'),original=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter(angle.path,725)]),reading=readingFrom(r,original),edit=drive.startColourGeometry(reading,5,'direction',{x:200,y:150},40,{x:150,y:150})
 const moved=drive.moveColourGeometry(edit,5,{x:150,y:100});assert.equal(moved.gesture.value.angle,815);assert.equal(moved.changes.length,1);assert.equal(toNativeConfig(devices.applyNativeDeviceChanges(original,r.scene.id,moved.changes).scenes[0]).color.angle,815)
 const nudge=drive.nudgeColourGeometry(edit,'ArrowRight',true);assert.equal(nudge.gesture.value.angle,735);assert.equal(drive.moveColourGeometry(moved,5,{x:200,y:150}).changes.length,0)
 assert.throws(()=>drive.startColourGeometry(reading,5,'direction',{x:150,y:150},40,{x:150,y:150}),/actual displayed/)
})
test('automated colour centre uses actual evaluated observation and retains the original range clock',()=>{
 const r=source(),journey=structuredClone(r.store.document),scene=journey.scenes[0],binding=drive.colourBinding('color.fieldCenterOffset.0'),target='field.'+binding.key
 scene.automation=[{id:'colour-clock',enabled:true,target,type:'lfo',wave:'sine',min:-1,max:1,rate:.25,phase:.5,blend:'replace',duration:4,delay:0,loop:'loop',firedAt:null}]
 const evaluate=s=>{const config=toNativeConfig(s);return automationEngine.applyAutomations(config,config.automations,0,automationEngine.createAutomationRuntime()).config},observed=devices.readNativeDeviceEffectiveValues(scene,{config:evaluate(scene)}),reading={...readingFrom(r,journey),observation:{simTime:0,effectiveValues:observed}}
 const edit=drive.startColourGeometry(reading,5,'centre',{x:0,y:0},40);assert.equal(edit.gesture.initial.x,observed[target]);const moved=drive.moveColourGeometry(edit,5,{x:20,y:0}),changed=devices.applyNativeDeviceChanges(journey,scene.id,moved.changes,observed)
 assert.ok(Math.abs(changed.scenes[0].automation[0].min-scene.automation[0].min-.5)<1e-12);assert.equal(changed.scenes[0].automation[0].rate,.25);assert.equal(changed.scenes[0].automation[0].phase,.5);assert.ok(Math.abs(devices.readNativeDeviceEffectiveValues(changed.scenes[0],{config:evaluate(changed.scenes[0])})[target]-moved.gesture.value.x)<1e-12)
 assert.deepEqual(drive.nativeColourProjection(reading).config,toNativeConfig(scene).color);assert.throws(()=>drive.startColourGeometry({...reading,observation:undefined},1,'centre',{x:0,y:0},40),/effective automated value/)
})
test('incomplete hex draft is retained in actual durable private owner and refuses mutation without losing bytes',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'colour-writer'),aperture={owner,current:()=>true,changed(){}},edit=drive.colourPaletteEdit(r.reading,['#12','#ffffff']),material=drive.colourInputMaterial(edit),custody=new NativeDeviceInputCustody(aperture,material,'gesture'),receipt=custody.retain(material),bytes=inventory()
 assert.equal(edit.changes.length,0);assert.deepEqual(drive.nativeColourInputEdit(receipt.copy),edit);assert.throws(()=>drive.nativeColourInputChanges(receipt.copy),/six-digit/);owner.checkpoint(()=>true);assert.deepEqual(inventory(),bytes)
 const incoming={...r.reading,basis:{...r.reading.basis,authored_revision:r.reading.basis.authored_revision+1}},corrected=drive.colourPaletteEdit(incoming,['#123456','#ffffff'],edit);assert.deepEqual(corrected.basis,edit.basis);assert.equal(drive.colourEditChanges(corrected)[0].colors[0],'#123456');custody.clear(receipt);owner.retire()
})
test('newer real human palette draft cannot be cleared by older receipt and retains original basis',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'colour-writer'),aperture={owner,current:()=>true,changed(){}},first=drive.colourPaletteEdit(r.reading,['#102030','#abcdef']),custody=new NativeDeviceInputCustody(aperture,drive.colourInputMaterial(first),'gesture'),receipt=custody.retain(drive.colourInputMaterial(first)),next=drive.colourPaletteEdit(r.reading,['#102031','#abcdef'],first),latest=custody.retain(drive.colourInputMaterial(next)),before=inventory()
 assert.throws(()=>custody.clear(receipt),/Newer private input replaced this receipt/);assert.deepEqual(inventory(),before);assert.equal(custody.receipt,latest);assert.deepEqual(drive.nativeColourInputChanges(latest.copy),next.changes);assert.deepEqual(latest.copy.basis,r.reading.basis);custody.clear(latest);owner.retire()
})
test('private malicious colour family, entity operand and injected parameter cannot retarget retained native Field input',()=>{
 const r=source(),owner=createNativeInputContinuity(scope,'colour-writer'),edit=drive.colourPaletteEdit(r.reading,['#102030','#abcdef']),receipt=owner.retain(drive.colourInputMaterial(edit),()=>true),before=inventory()
 const wrong=structuredClone(receipt.copy);wrong.target.entity_ref=r.reading.entityOccurrences[r.entity.id];assert.throws(()=>drive.nativeColourInputChanges(wrong),/original Field/)
 const injected=structuredClone(receipt.copy);injected.input.gesture.changes[0]={kind:'parameter',target:'field.'+drive.colourBinding('color.angle').key,value:90};injected.input.changes=injected.input.gesture.changes;assert.throws(()=>drive.nativeColourInputChanges(injected),/foreign native changes/)
 const wrongFamily=structuredClone(receipt.copy);wrongFamily.target.family='colour:background';assert.throws(()=>drive.nativeColourInputChanges(wrongFamily),/original Field/)
 const geometry=drive.moveColourGeometry(drive.startColourGeometry(r.reading,3,'centre',{x:0,y:0},40),3,{x:40,y:20}),g=owner.retain(drive.colourInputMaterial(geometry),()=>true),malicious=structuredClone(g.copy);malicious.input.gesture.changes[0].target='field.'+drive.colourBinding('color.contrast').key;malicious.input.changes=malicious.input.gesture.changes;assert.throws(()=>drive.nativeColourInputChanges(malicious),/original native target/)
 assert.ok(before.every(([key,bytes])=>localStorage.getItem(key)===bytes));assert.throws(()=>drive.colourPaletteEdit(r.reading,Array(9).fill('#fff')),/2–8/);owner.retire()
})
test('source face exposes real ordered stop editing, catalogue, native geometry and numeric controls without dispatch',()=>{
 const r=source(),paths=[],html=ssr.renderToStaticMarkup(react.createElement(NativeColourField,{reading:r.reading,disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>{paths.push(path);return react.createElement('span',null,path)},createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 assert.deepEqual(paths,drive.COLOUR_CONTROL_PATHS);assert.match(html,/Native Colour Field centre and direction/);assert.match(html,/Ordered palette stops/);assert.match(html,/Native palette preset/);assert.match(html,/300 native pixels/);assert.equal(localStorage.length,0);assert.equal(JSON.stringify(archived.after.document),nativeBytes)
})
const registry=await import(new URL('packages/expressions-boundary/src/parameters.ts',root))
const facts=drive.colourDeviceFacts,sorted=values=>[...values].sort()
test('colour device paths are exactly the registry Color and Paper rows in registry (app) order, paperGrain included',()=>{
 const expected=registry.PARAM_REGISTRY.filter(p=>p.group==='Color'||p.group==='Paper').map(p=>p.path)
 assert.equal(new Set(facts.paths).size,facts.paths.length);assert.equal(facts.paths.length,12);assert.ok(facts.paths.includes('paperGrain'))
 assert.deepEqual(sorted(facts.paths),sorted(expected));assert.deepEqual(facts.paths,expected)
 assert.ok(facts.paths.every(path=>drive.colourBinding(path).group==='color'))
})
test('colour device groups are titled in device order, cover paths exactly once and set the exact-value render order',()=>{
 assert.deepEqual(facts.groups.map(g=>g.title),['Palette','Dynamics','Geometry','Atmosphere & paper'])
 const covered=facts.groups.flatMap(g=>g.paths);assert.equal(new Set(covered).size,covered.length);assert.deepEqual(sorted(covered),sorted(facts.paths))
 assert.deepEqual(facts.groups[0].paths,[]);assert.deepEqual(drive.COLOUR_CONTROL_PATHS,covered)
})
test('colour device compact set is at most four performer levers from the panel, none of them a diagram handle',()=>{
 assert.ok(facts.compact.length>=1&&facts.compact.length<=4);assert.equal(new Set(facts.compact).size,facts.compact.length)
 assert.ok(facts.compact.every(path=>facts.paths.includes(path)));assert.ok(!facts.compact.some(path=>drive.COLOUR_GROUPS.geometry.paths.includes(path)))
 assert.equal(facts.studio,'appearance');assert.equal(facts.name,'Colour Field')
})
test('colour device activator, toggle and summary are computed from the actual reading and admitted setting',()=>{
 const r=source(),on=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('colorEnabled',true)]),off=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[setting('colorEnabled',false)])
 assert.equal(facts.enabled(readingFrom(r,on)),true);assert.equal(facts.enabled(readingFrom(r,off)),false)
 assert.deepEqual(facts.strip.toggle,{kind:'colour-setting',key:'colorEnabled'})
 const moved=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[parameter('color.cycleSpeed',1.5)]),movedReading=readingFrom(r,moved)
 assert.match(facts.strip.summary(movedReading),new RegExp(`^Palette on · ${movedReading.scene.field.palette.length} stops · .+ · cycle 1\\.5$`))
 assert.match(facts.strip.summary(readingFrom(r,off)),/^Monochrome ink · /)
})
test('atmosphere choice is the admitted panel-setting, refuses invented values and compiles into the native background mode without retaining a draft',()=>{
 const r=source(),before=structuredClone(r.store.document)
 for(const value of ['solid','vignette','ambientGlow','adaptive']){const change=drive.atmosphereChange(value);assert.deepEqual(change,{kind:'panel-setting',key:'backgroundMode',value});assert.equal(toNativeConfig(devices.applyNativeDeviceChanges(before,r.scene.id,[change]).scenes[0]).backgroundMode,value)}
 for(const value of ['invented','','Vignette'])assert.throws(()=>drive.atmosphereChange(value),/admitted native Field panel/)
 assert.deepEqual(r.store.document,before);assert.equal(localStorage.length,0)
})
test('colour device view renders the four titled groups in device order with the admitted atmosphere options and exact controls, without dispatch',()=>{
 const r=source(),paths=[]
 const html=ssr.renderToStaticMarkup(react.createElement(NativeColourField,{reading:r.reading,disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>{paths.push(path);return react.createElement('span',null,path)},createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 assert.deepEqual([...html.matchAll(/<h4>([^<]*)<\/h4>/g)].map(m=>m[1]),['Palette','Dynamics','Geometry','Atmosphere &amp; paper'])
 assert.deepEqual(paths,facts.groups.flatMap(g=>g.paths));assert.ok(paths.includes('paperGrain'))
 assert.match(html,/aria-label="Background atmosphere"/);for(const [id,label] of [['solid','Solid paper'],['vignette','Vignette'],['ambientGlow','Ambient glow'],['adaptive','Adaptive glow']])assert.match(html,new RegExp(`<option value="${id}"[^>]*>${label}</option>`))
 assert.match(html,/Field palette → entity tint → travelling-focus contribution → optional semantic spatial colour/);assert.equal(localStorage.length,0)
})
test('semantic spatial colour field is disclosed as not writable only when the Scene has bindings, never as a control',()=>{
 const r=source(),render=reading=>ssr.renderToStaticMarkup(react.createElement(NativeColourField,{reading,disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>react.createElement('span',null,path),createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 const bound={...r.reading,scene:{...r.reading.scene,semanticField:{enabled:true,globalColorGain:12.5,bindings:[{}]}}},unbound={...r.reading,scene:{...r.reading.scene,semanticField:{enabled:false,globalColorGain:3,bindings:[]}}}
 assert.match(render(bound),/Semantic spatial colour field · on · global gain 12\.5 — not writable from the shell yet/)
 assert.doesNotMatch(render(unbound),/Semantic spatial colour field/);assert.doesNotMatch(render(r.reading),/Semantic spatial colour field/)
 assert.doesNotMatch(render(bound),/data-semantic|type="number"/)
})
test('palette and paper discrete actions sit beside their fields, render without dispatch, and keep no draft',()=>{
 const r=source(),html=ssr.renderToStaticMarkup(react.createElement(NativeColourField,{reading:r.reading,disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>react.createElement('span',null,path),createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture')}))
 for(const label of ['Invert palette','Random palette','Invert paper','Harmonize paper to palette','Native paper preset'])assert.match(html,new RegExp(label))
 assert.equal(localStorage.length,0)
})
