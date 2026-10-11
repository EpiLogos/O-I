/** Independent device checks use the real document, projection, automation,
 * force compiler and composition adapters. Native CAS/GPU/file acknowledgement
 * remains an acceptance path on the running owner, never a fabricated result. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

const root = new URL('../../../', import.meta.url);
const typescript = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, next) {
  try {return await next(specifier, context)} catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0,-3)+'.ts',context);
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}
export async function load(url,context,next) {
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url,context);
  const source=await readFile(new URL(url),'utf8');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
`)}`, import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{applyNativeDeviceChanges,readNativeDeviceEffectiveValues},{blankJourney,entity,clone},{DocumentStore},{toNativeConfig},
  {effectiveScene,initialiseShared,toggleShared},{NATIVE_BINDINGS},{applyAutomations,createAutomationRuntime},
  {compileEntityForceEmitters},{kernelDocumentToJourney},{prepareCompositionEdit}] = await Promise.all([
  import('../src/nativeDeviceEdits.ts'),import(new URL('model.ts',author)),import(new URL('store.ts',author)),import(new URL('nativeBridge.ts',author)),
  import(new URL('sharedSettings.ts',author)),import('../src/parameters.ts'),import(new URL('desktop/cradle/expressions-app/src/engine/automation.ts',root)),
  import(new URL('desktop/cradle/expressions-app/src/engine/forceRuntime.ts',root)),import(new URL('kernelDocumentBridge.ts',author)),import(new URL('kernelComposition.ts',author)),
]);
const address=(id,path)=>`entity:${encodeURIComponent(id)}:${path}`;
const binding=path=>{const b=NATIVE_BINDINGS.find(b=>b.path===path);assert.ok(b,path);return b;};
const field=path=>'field.'+binding(path).key;
function authored() {const journey=blankJourney();journey.scenes[0].entities=[entity('Body','A')];return journey;}
function evaluate(scene,time=0,runtime=createAutomationRuntime()) {const config=toNativeConfig(scene);return applyAutomations(config,config.automations,time,runtime).config;}
const lane=(id,target,extra={})=>({id,enabled:true,target,type:'lfo',wave:'sine',min:1,max:5,rate:.5,phase:0,blend:'replace',duration:4,delay:0,loop:'loop',firedAt:null,...extra});

test('a repeated entity ID in another Scene cannot receive a captured device gesture',()=>{
  const journey=authored(),first=journey.scenes[0],other=clone(first);other.id='scene:other';other.entities[0].force.strength=12;journey.scenes.push(other);
  const before=clone(journey),id=first.entities[0].id;
  const next=applyNativeDeviceChanges(journey,first.id,[{kind:'parameter',target:address(id,'forces.strength'),value:3},{kind:'force-mode',entity_id:id,value:'repel'}]);
  assert.deepEqual(journey,before);assert.deepEqual(next.scenes[1],other);
  const forces=compileEntityForceEmitters(toNativeConfig(next.scenes[0]).entities,[]);
  const force=forces.find(force=>force.sourceEntityId===id);assert.equal(force.strength,3);assert.equal(force.polarity,'repel');
  assert.throws(()=>applyNativeDeviceChanges(journey,'scene:absent',[{kind:'force-mode',entity_id:id,value:'none'}]),/Scene/);
  assert.throws(()=>applyNativeDeviceChanges(journey,first.id,[{kind:'parameter',target:address(id,'forces.spin'),value:4},{kind:'force-mode',entity_id:'absent',value:'none'}]),/selected force/);
  assert.deepEqual(journey,before);
});

test('linked replacement controls offset only their target and retain the real shared clock',()=>{
  const journey=authored(),scene=journey.scenes[0],id=scene.entities[0].id,target=address(id,'forces.spin');
  const leader=lane('clock',field('fluid.viscosity'),{min:.1,max:.9,rate:.25,phase:.125});
  scene.automation=[leader,lane('force',target,{syncWith:leader.id,rate:99,phase:99,min:-2,max:2})];
  const runtime=createAutomationRuntime(),first=evaluate(scene,1,runtime),observed=readNativeDeviceEffectiveValues(scene,{config:first});
  const requested=observed[target]+1.25;
  const next=applyNativeDeviceChanges(journey,scene.id,[{kind:'parameter',target,value:requested}],observed),s=next.scenes[0];
  assert.deepEqual(s.automation[0],leader);assert.equal(s.automation[1].min,-.75);assert.equal(s.automation[1].max,3.25);
  assert.equal(s.entities[0].force.spin,scene.entities[0].force.spin);
  const projected=toNativeConfig(s);assert.equal(projected.automations[1].clockId,'clock');assert.equal(projected.automations[1].rateHz,.25);assert.equal(projected.automations[1].phase,.125);
  assert.ok(Math.abs(readNativeDeviceEffectiveValues(s,{config:evaluate(s,1,runtime)})[target]-requested)<1e-12);
  const later=evaluate(s,1.25,runtime);assert.notEqual(readNativeDeviceEffectiveValues(s,{config:later})[target],requested,'the inherited clock continues after direct manipulation');
});

test('a disabled inherited automation clock falls back to the authored device value',()=>{
  const journey=authored(),scene=journey.scenes[0],id=scene.entities[0].id,target=address(id,'forces.strength');
  scene.automation=[lane('clock',field('fluid.viscosity'),{min:.1,max:.9,enabled:false}),lane('force',target,{syncWith:'clock'})];
  const ranges=clone(scene.automation),next=applyNativeDeviceChanges(journey,scene.id,[{kind:'parameter',target,value:4}]);
  assert.deepEqual(next.scenes[0].automation,ranges);assert.equal(next.scenes[0].entities[0].force.strength,4);
  const config=evaluate(next.scenes[0],9);assert.equal(config.automations[1].enabled,false);
  assert.equal(readNativeDeviceEffectiveValues(next.scenes[0],{config})[target],4);
});

test('shared Field parameters mask local automation while emitter edits remain Scene-local',()=>{
  const journey=initialiseShared(authored()),first=journey.scenes[0],other=clone(first);other.id='scene:shared-other';journey.scenes.push(other);
  const b=binding('medium.coupling'),target=field('medium.coupling');
  for(const scene of journey.scenes)scene.automation=[lane('coupling:'+scene.id,target)];
  toggleShared(journey,first,b.bind);
  const next=applyNativeDeviceChanges(journey,first.id,[{kind:'parameter',target,value:2.4},{kind:'parameter',target:address(first.entities[0].id,'forces.spin'),value:1.75}]);
  for(const scene of next.scenes) {const projected=effectiveScene(next,scene),native=evaluate(projected,2);assert.equal(native.medium.coupling,2.4);assert.equal(native.automations[0].enabled,false);}
  assert.equal(next.scenes[0].entities[0].force.spin,1.75);assert.equal(next.scenes[1].entities[0].force.spin,other.entities[0].force.spin);
  assert.equal(next.scenes[0].automation[0].enabled,true,'shared masking does not destroy the retained local lane');
});

test('device edits survive the actual native composition patch and reconversion at the captured revision',()=>{
  const journey=authored(),E='expression:device-independent',S=E+':scene:main',R=E+':entity:body',scene=clone(journey.scenes[0]);scene.id=S;scene.entities[0].id=R;
  scene.retainedOwnerData={revision:'source:r3',source:['exact','unchanged']};
  const native={schema:'oi.expression/v1',expression_ref:E,revision:7,title:'Native device',entities:{[R]:{entity_ref:R,title:'Body',subject:{subject_ref:'central:source',native_owner:'central',revision:'r3'},parameters:{glyph:{value:'A'}}}},scenes:[{scene_ref:S,title:scene.name,entity_refs:[R],presentation:{schema:'oi.journey-scene/v1',scene,saved:null}}],selection:{scene_ref:S,entity_ref:R},retainedNativeData:{opaque:['preserved']}};
  const view=kernelDocumentToJourney(native),store=new DocumentStore(view.journey),local=store.document.scenes[0],id=local.entities[0].id;
  store.replace(applyNativeDeviceChanges(store.document,local.id,[{kind:'parameter',target:address(id,'x'),value:.75},{kind:'parameter',target:address(id,'forces.spin'),value:-2},{kind:'field-setting',key:'mediumEnabled',value:true}]));
  const request=prepareCompositionEdit(view,store.document);assert.equal(request.expected_revision,7);assert.equal(request.expression_ref,E);assert.equal(view.document.revision,7);
  const material=request.changes.find(c=>c.change==='scene_material_set');assert.ok(material);assert.equal(material.scene_ref,S);
  const reopened=kernelDocumentToJourney({...native,scenes:[{...native.scenes[0],presentation:material.presentation}]}),config=toNativeConfig(reopened.journey.scenes[0]);
  assert.equal(config.entities[0].x,300);assert.equal(config.entities[0].forces.spin,-2);assert.equal(config.medium.enabled,true);
  assert.deepEqual(reopened.document.retainedNativeData,native.retainedNativeData);assert.deepEqual(reopened.journey.scenes[0].retainedOwnerData,scene.retainedOwnerData);
  assert.deepEqual(native.entities[R].subject,{subject_ref:'central:source',native_owner:'central',revision:'r3'});
  assert.deepEqual(prepareCompositionEdit(reopened,reopened.journey).changes,[]);
  const basis=store.revision;store.change(doc=>{doc.scenes[0].entities[0].name='Incoming human draft';});assert.ok(store.revision>basis);
  assert.equal(request.expected_revision,7,'a prepared request never silently retargets its captured native basis');
  assert.equal(store.document.scenes[0].entities[0].name,'Incoming human draft');
});
