/** Per-object sound through the native boundary: the app validator's bounds, the
 * kernel's own table, the pure reducer, the retained host route, the coupling
 * helpers and the composition request that carries the sound to scene_material_set. */
import test from 'node:test'
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
const receiptPath=new URL('./fixtures/native-rich-glyph-rack-r8.receipt.json',import.meta.url)
const [devices,sounds,appSound,{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},{prepareCompositionEdit},kernelSource,archivedText]=await Promise.all([
 import(new URL('packages/expressions-boundary/src/nativeDeviceEdits.ts',root)),
 import(new URL('packages/expressions-boundary/src/nativeEntitySound.ts',root)),
 import(new URL('native-field/entitySound.ts',author)),
 import(new URL('kernelDocumentBridge.ts',author)),
 import(new URL('store.ts',author)),
 import(new URL('hostEditor.ts',author)),
 import(new URL('kernelComposition.ts',author)),
 readFile(new URL('desktop/cradle/kernel/src/expression_profile.rs',root),'utf8'),
 readFile(receiptPath,'utf8'),
])
const {validateEntitySound,SOUND_FIELDS,REMOVED_SOUND_FIELDS,DEFAULT_ENTITY_SOUND}=appSound
const archived=JSON.parse(archivedText)
const closed=()=>{throw Error('Native effects are closed in Entity sound verification')}
const sound0={enabled:true,carry:{kind:'mode',ref:"chromatic/L0'/aeolian"},gain:.5,attack:.1,release:1.5}
/** A private working copy of the archived native Expression; the baseline view is untouched. */
function source(){
 const view=kernelDocumentToJourney(archived.after.document),store=new DocumentStore(structuredClone(view.journey))
 const scene=store.document.scenes.find(s=>s.id===view.startSceneId),entity=scene.entities[0]
 return {view,store,scene,entity}
}
/** The retained host receiver over the same store; native selection and telemetry stay closed. */
function host(r,{commit=async()=>true,change=fn=>fn()}={}){
 return createRetainedNativeEditor({store:r.store,sceneId:()=>r.view.startSceneId,selection:()=>({entity_ids:[r.entity.id],step_id:null}),nativeView:()=>r.view,nativeSelect:closed,commit,change,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false})
}
const entityIn=(journey,id)=>journey.scenes.flatMap(s=>s.entities).find(e=>e.id===id)
const changeOf=(r,sound,id=r.entity.id)=>({kind:'entity-sound',entity_id:id,sound})
const applyOne=(r,change,doc=r.store.document)=>devices.applyNativeDeviceChanges(doc,r.view.startSceneId,[change])

test('every field bound is inclusive at its edges and refuses one step outside, through the app validator and the boundary change',()=>{
 const bounds=[['gain',0,1],['attack',0,10],['release',0,30]]
 for(const [field,low,high] of bounds){
  const base={enabled:true,[field]:low}
  assert.deepEqual(validateEntitySound({...base}),{...base})
  assert.doesNotThrow(()=>validateEntitySound({enabled:true,[field]:high}))
  assert.equal(sounds.validateNativeEntitySoundChange({kind:'entity-sound',entity_id:'e',sound:{enabled:true,[field]:high}}).sound[field],high)
  for(const bad of [low-.001,high+.001,Number.NaN,Number.POSITIVE_INFINITY,'220',null]){
   assert.throws(()=>validateEntitySound({enabled:true,[field]:bad}),/Invalid entity sound/,`${field}=${String(bad)}`)
   assert.throws(()=>sounds.validateNativeEntitySoundChange({kind:'entity-sound',entity_id:'e',sound:{enabled:true,[field]:bad}}),/Invalid entity sound/,`${field}=${String(bad)} via change`)
  }
 }
 // A symbol's voice carries a name or a mode and has no oscillator: its four old fields are refused in words, at the app validator and at the boundary.
 for(const [field,value,words] of [['frequencyHz',330,/frequencyHz was removed: a symbol's voice carries the torus's sound and has no pitch/],['followCymatic',true,/followCymatic was removed/],['waveform','sine',/waveform was removed: a symbol's voice has no oscillator/],['pan',.5,/pan was removed: a symbol's voice stands where its symbol stands/]]){
  assert.throws(()=>validateEntitySound({enabled:true,[field]:value}),words,field)
  assert.throws(()=>sounds.validateNativeEntitySoundChange({kind:'entity-sound',entity_id:'e',sound:{enabled:true,[field]:value}}),words,`${field} via change`)
 }
 for(const carry of [{kind:'mode',ref:'maqam/00'},{kind:'name',ref:'shem'}])assert.deepEqual(validateEntitySound({enabled:true,carry}),{enabled:true,carry})
 for(const bad of [{kind:'oscillator',ref:'x'},{kind:'mode'},{kind:'mode',ref:''},{kind:'mode',ref:'x'.repeat(201)},{kind:'mode',ref:'x',hz:3},'maqam/00',7])assert.throws(()=>validateEntitySound({enabled:true,carry:bad}),/Invalid entity sound: (unsupported )?carry/,JSON.stringify(bad))
 assert.throws(()=>validateEntitySound({enabled:'true'}),/enabled must be a boolean/)
 assert.throws(()=>validateEntitySound({gain:.2}),/enabled must be a boolean/)
 assert.throws(()=>validateEntitySound({enabled:true,detune:3}),/unsupported field detune/)
 assert.throws(()=>validateEntitySound(null),/expected an object/)
 assert.throws(()=>validateEntitySound([]),/expected an object/)
 assert.equal(validateEntitySound(undefined),undefined)
})
test('the boundary change admits only the whole block or null, and refuses foreign operands and an absent sound',()=>{
 const id='entity-a'
 assert.deepEqual(sounds.validateNativeEntitySoundChange({kind:'entity-sound',entity_id:id,sound:null}),{kind:'entity-sound',entity_id:id,sound:null})
 const admitted=sounds.validateNativeEntitySoundChange({kind:'entity-sound',entity_id:id,sound:sound0})
 assert.deepEqual(admitted.sound,sound0);assert.notEqual(admitted.sound,sound0,'the admitted change is a fresh copy')
 for(const bad of [{kind:'entity-sound',entity_id:id,sound:sound0,scope:'entity'},{kind:'entity-sound',entity_id:id,sound:sound0,muted:true},{kind:'entity-sound',entity_id:id},{kind:'entity-sound',entity_id:id,sound:undefined},{kind:'entity-sound',entity_id:'',sound:null},{kind:'entity-sound',entity_id:7,sound:null},{kind:'entity-sound-mute',entity_id:id,sound:null},{kind:'entity-sound',entity_id:id,sound:{...sound0,frequencyHz:0}}])
  assert.throws(()=>sounds.validateNativeEntitySoundChange(bad),/object sound|foreign|sound|Choose/)
})
test('the kernel expression_profile::sound table is the same table the app validator enforces',()=>{
 const kernelSound=kernelSource.slice(kernelSource.indexOf('pub fn sound('),kernelSource.indexOf('/// Bring a voice written for an oscillator'))
 const bounds=Object.fromEntries([...kernelSound.matchAll(/finite\(v, ([-\d._]+), ([-\d._]+), "(\w+)"\)/g)].map(m=>[m[3],[Number(m[1].replace(/_/g,'')),Number(m[2].replace(/_/g,''))]]))
 assert.deepEqual(bounds,{gain:[0,1],attack:[0,10],release:[0,30]})
 const kernelFields=[...kernelSource.match(/pub const SOUND_FIELDS: &\[&str\] = &\[([\s\S]*?)\];/)[1].matchAll(/"(\w+)"/g)].map(m=>m[1])
 assert.deepEqual(kernelFields,[...SOUND_FIELDS])
 // The oscillator's fields, and the words each is refused in, are one table in both owners.
 const removed=kernelSource.match(/pub const REMOVED_SOUND_FIELDS: &\[\(&str, &str\)\] = &\[([\s\S]*?)\n\];/)[1]
 const kernelRemoved=[...removed.matchAll(/\(\s*"(\w+)",\s*"((?:[^"\\]|\\.)*)",?\s*\)/g)].map(m=>[m[1],m[2].replace(/\\'/g,"'")])
 assert.deepEqual(kernelRemoved.map(([field])=>field),[...REMOVED_SOUND_FIELDS])
 assert.deepEqual(kernelRemoved.map(([,words])=>words),REMOVED_SOUND_FIELDS.map(field=>appSound.REMOVED_SOUND_WORDS[field]),'the same words, kernel and frame')
 const kernelKinds=[...kernelSource.match(/pub const CARRY_KINDS: &\[&str\] = &\[([^\]]*)\];/)[1].matchAll(/"(\w+)"/g)].map(m=>m[1])
 assert.deepEqual(kernelKinds,[...appSound.CARRY_KINDS])
})
test('the reducer sets the whole object sound, clears it on null, and leaves the caller document untouched on refusal',()=>{
 const r=source(),before=structuredClone(r.store.document),id=r.entity.id
 const changed=applyOne(r,changeOf(r,sound0))
 assert.deepEqual(entityIn(changed,id).sound,sound0);assert.deepEqual(r.store.document,before)
 assert.deepEqual(entityIn(changed,id).gain,entityIn(before,id).gain,'other entity fields are not rewritten')
 const cleared=applyOne(r,changeOf(r,null),changed)
 assert.equal('sound' in entityIn(cleared,id),false);assert.deepEqual(entityIn(changed,id).sound,sound0)
 for(const bad of [{...sound0,detune:1},{...sound0,frequencyHz:330},{...sound0,pan:0},{enabled:'yes'},undefined])
  assert.throws(()=>applyOne(r,{kind:'entity-sound',entity_id:id,sound:bad}),/Invalid entity sound|whole sound|Choose/)
 assert.throws(()=>applyOne(r,{kind:'entity-sound',entity_id:'entity:missing',sound:sound0}),/no longer belongs to this Scene/)
 assert.throws(()=>applyOne(r,{kind:'entity-sound',entity_id:id,sound:sound0,scope:'entity'}),/Choose|foreign|object sound/)
 assert.deepEqual(r.store.document,before)
})
test('a locked entity refuses the sound edit and a batch with a second bad change keeps the first change out of the document',()=>{
 const r=source(),before=structuredClone(r.store.document),locked=structuredClone(r.store.document)
 entityIn(locked,r.entity.id).locked=true
 assert.throws(()=>devices.applyNativeDeviceChanges(locked,r.view.startSceneId,[changeOf(r,sound0)]),/Unlock this entity/)
 assert.throws(()=>devices.applyNativeDeviceChanges(before,r.view.startSceneId,[changeOf(r,sound0),{kind:'entity-sound',entity_id:r.entity.id,sound:{enabled:true,frequencyHz:99999}}]),/frequencyHz was removed/)
 assert.throws(()=>devices.applyNativeDeviceChanges(before,r.view.startSceneId,[changeOf(r,sound0),changeOf(r,null)]),/same object sound twice/)
 assert.deepEqual(r.store.document,before)
})
test('mute is not a document change: the page-global presentation has no sound change kind',()=>{
 const r=source()
 for(const kind of ['entity-sound-mute','sound-mute','object-sound-muted'])
  assert.throws(()=>applyOne(r,{kind,entity_id:r.entity.id,muted:true}),/another editor owner/)
})
test('the carry helper is pure, validated, and changes the voice the planner reads',()=>{
 const base={enabled:true,gain:.2,attack:.08,release:.8}
 const snapshot=structuredClone(base)
 const carries=sounds.soundWithCarry(base,{kind:'mode',ref:'maqam/00'})
 assert.deepEqual(carries,{...base,carry:{kind:'mode',ref:'maqam/00'}});assert.deepEqual(base,snapshot,'the input is not mutated')
 assert.deepEqual(sounds.soundWithCarry(undefined,{kind:'name',ref:'shem'}),{enabled:false,carry:{kind:'name',ref:'shem'}})
 assert.deepEqual(sounds.soundWithCarry(carries,null),base,'null removes the carry')
 for(const bad of [{kind:'oscillator',ref:'x'},{kind:'mode',ref:''}])assert.throws(()=>sounds.soundWithCarry(base,bad),/Invalid entity sound/)
 assert.equal('soundWithFrequency' in sounds,false,'the frequency control is gone');assert.equal('soundWithFollow' in sounds,false,'and so is follow')
 const scene={entities:[{id:'a',enabled:true,sound:carries},{id:'b',enabled:true,sound:base}]}
 assert.deepEqual(appSound.entitySoundVoices(scene).map(v=>v.entityId),['a'],'a voice that carries something is planned')
 assert.deepEqual(appSound.entitySoundPlan(scene).silent,[{entityId:'b',because:appSound.NO_CARRY}],'one that carries nothing is silent and says why')
 assert.deepEqual(Object.keys(appSound.entitySoundVoices(scene)[0]).sort(),['attack','carry','entityId','gain','release'],'no frequency, waveform or pan in the plan')
})
test('the retained host admits the kind through the device batch and commits one transaction, with readback from the reading',async()=>{
 const r=source(),id=r.entity.id;let commits=0,changes=0
 const owner=host(r,{commit:async()=>{commits++;return true},change:(...edit)=>{changes++;edit[edit.length-1]()}})
 const reading=owner.read()
 await owner.apply({operation:'apply',basis:reading.basis,changes:[changeOf(r,sound0)]})
 assert.equal(commits,1);assert.equal(changes,1)
 assert.deepEqual(entityIn(r.store.document,id).sound,sound0)
 assert.deepEqual(owner.read().scene.entities.find(e=>e.id===id).sound,sound0,'the reading shows the stored sound')
 await owner.apply({operation:'apply',basis:owner.read().basis,changes:[changeOf(r,null)]})
 assert.equal('sound' in owner.read().scene.entities.find(e=>e.id===id),false)
 assert.equal(commits,2)
})
test('the host refuses a locked entity and a foreign operand with the document and commit untouched',async()=>{
 const r=source(),id=r.entity.id;let commits=0
 const owner=host(r,{commit:async()=>{commits++;return true}})
 const before=structuredClone(r.store.document)
 entityIn(r.store.document,id).locked=true;const locked=structuredClone(r.store.document);entityIn(r.store.document,id).locked=false
 r.store.document=locked
 await assert.rejects(owner.apply({operation:'apply',basis:owner.read().basis,changes:[changeOf(r,sound0)]}),/Unlock this entity/)
 r.store.document=structuredClone(before)
 await assert.rejects(owner.apply({operation:'apply',basis:owner.read().basis,changes:[{...changeOf(r,sound0),scope:'entity'}]}),/Choose|foreign|object sound/)
 assert.equal(commits,0);assert.deepEqual(r.store.document,before)
})
test('prepareCompositionEdit carries the object sound in the scene_material_set request and refuses an invalid sound before building any change',()=>{
 const r=source(),id=r.entity.id,sceneRef=r.view.bindings[r.scene.id].scene_ref
 const entityRef=r.view.bindings[r.scene.id].occurrences.find(o=>o.view_entity_id===id).entity_ref
 const changed=applyOne(r,changeOf(r,sound0))
 const edit=prepareCompositionEdit(r.view,changed)
 const material=edit.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===sceneRef)
 assert.ok(material,'the edited Scene produces one scene_material_set request')
 const native=material.presentation.scene.entities.find(e=>e.id===entityRef)
 assert.ok(native,'the request addresses the entity by its native occurrence ref')
 assert.deepEqual(native.sound,sound0,'the kernel-shaped request carries the exact sound block')
 const cleared=applyOne(r,changeOf(r,null),changed)
 assert.equal(prepareCompositionEdit(r.view,cleared).changes.some(c=>c.change==='scene_material_set'&&c.scene_ref===sceneRef),false,'clearing back to the baseline writes nothing')
 // Removal against a baseline that carried the sound emits the material without it.
 const carried={...r.view,journey:structuredClone(r.view.journey)};entityIn(carried.journey,id).sound=sound0
 const removal=prepareCompositionEdit(carried,cleared).changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===sceneRef)
 assert.ok(removal,'the removal produces a scene_material_set request')
 assert.equal('sound' in removal.presentation.scene.entities.find(e=>e.id===entityRef),false,'a cleared sound is absent from the request')
 const invalid=structuredClone(r.store.document);entityIn(invalid,id).sound={enabled:true,frequencyHz:330}
 assert.throws(()=>prepareCompositionEdit(r.view,invalid),/frequencyHz was removed/)
})
