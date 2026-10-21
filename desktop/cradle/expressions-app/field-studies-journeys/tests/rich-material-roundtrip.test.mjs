// FX-A2: a rich authored entity (compound layers + ASCII/image sources +
// sequence/morph + force + tint + per-object sound) survives the native
// composition path — prepareCompositionEdit → scene_material_set → reopen —
// and the Library save diff no longer stops at the six scalar keys.
// The modules are bundled from source into a private temp dir, so this test
// needs no application build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const {build}=require(path.resolve(root,'../node_modules/esbuild'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'oi-rich-material-'));
const rcRoot=path.resolve(root,'../vendor/research-canvas');
const alias=Object.fromEntries(['schema','domain','desktop-api','geography','viewers','node-document'].map(name=>[`@research-canvas/${name}`,path.join(rcRoot,`packages/${name}/src/index.ts`)]));
const entries={model:'src/model.ts',bridge:'src/kernelDocumentBridge.ts',composition:'src/kernelComposition.ts',expressions:'src/kernelExpressions.ts',sceneWorkflow:'src/sceneWorkflow.ts',sound:'src/native-field/entitySound.ts',controls:'src/soundControls.ts'};
await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:entries,bundle:true,alias,jsx:'automatic',format:'esm',platform:'node',target:'es2022',outdir:out,outExtension:{'.js':'.mjs'},logLevel:'silent',
 loader:{'.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.css':'empty'}});
const load=name=>import(pathToFileURL(path.join(out,name+'.mjs')).href);
const {blankJourney,entity,clone,validateJourney}=await load('model');
const {kernelDocumentToJourney}=await load('bridge');
const {prepareCompositionEdit,rebaseCompositionView}=await load('composition');
const {documentToChanges}=await load('expressions');
const {initialiseSceneSaves,saveScene}=await load('sceneWorkflow');
const {validateEntitySound,entitySoundVoices,entitySoundPlan,activeFromFocus,setObjectSoundMuted,objectSoundIsMuted}=await load('sound');
const {soundControlsHTML,applySoundControl}=await load('controls');
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
function empty(ref,title){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:1,title,scenes:[{scene_ref:ref+':scene:main',revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
}
// Serde reorders object keys; the round trip must not depend on key order.
const reorderKeys=value=>Array.isArray(value)?value.map(reorderKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,reorderKeys(v)])):value;
// A controlled owner-port reducer (the Rust owner is tested in the kernel).
function ownerEdit(document,request){
 const d=clone(document),scene=ref=>d.scenes.find(s=>s.scene_ref===ref);
 for(const c of request.changes){switch(c.change){
  case 'rename':d.title=c.title;break;
  case 'composition_set':d.presentation=clone(c.presentation);break;
  case 'scene_create':d.scenes.push({scene_ref:c.scene_ref,title:c.title,revision:1,entity_refs:[]});break;
  case 'entity_add':d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O'}}};scene(c.scene_ref).entity_refs.push(c.entity_ref);break;
  case 'scene_rename':scene(c.scene_ref).title=c.title;break;
  case 'scene_compose':scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
  case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);if(!c.presentation.saved)delete scene(c.scene_ref).presentation.saved;break;
  case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
  default:assert.fail('Unexpected native operation '+c.change);
 }}
 if(request.changes.length)d.revision++;
 return reorderKeys(d);
}

const SOUND={enabled:true,carry:{kind:'mode',ref:'maqam/00'},gain:.3,attack:.05,release:1.5};
function richCharacter(){
 const e=entity('Nous','◇',{x:.2,y:-.1,z:.4});
 e.source={kind:'ascii',ascii:{text:' /\\\n<  >\n \\/',fontSize:18}};
 e.layers=[{id:'layer-halo',text:'○',z:-.2,scale:1.6},{id:'layer-mark',text:'',z:.1,scale:.8,source:{kind:'image',image:{dataUrl:PNG,mode:'silhouette',threshold:.4,invert:false,scale:1}}}];
 e.force={kind:'vortex',strength:2.5,radius:.6,spin:1.2};
 e.tint='#c0ffee';e.tintWeight=.7;e.scale=1.2;e.share=2;e.rotation=30;
 e.templateFrequency=528;e.templateGeometry='circular';
 e.sequence={enabled:true,clock:'morph',hold:2,transition:.8,easing:'smoothstep',order:'pingpong',steps:[
  {id:'step-idle',name:'idle',text:'◇',shape:'text',hold:2,transition:.8,position:null},
  {id:'step-work',name:'working',text:'◆',shape:'ring',hold:1.5,transition:.4,position:{x:.3,y:0,z:0},
   objectState:{size:{x:.7,y:.9},rotation:45,scale:1.4,tint:'#ff0066',tintWeight:.9,force:{kind:'attract',strength:4,radius:.5,spin:0}}},
 ]};
 e.sound={...SOUND};
 return e;
}
function richJourney(){
 const j=initialiseSceneSaves(blankJourney());
 j.name='Character material';
 const s=j.scenes[0];s.name='Character';
 s.entities=[richCharacter()];
 s.engine={...s.engine,morphEnabled:true,resonanceEnabled:true,colorEnabled:true,paletteId:'aurora'};
 s.morph={thetaRate:.21,phiRate:.34,thetaOffset:.1,phiOffset:.2,law:'beat',depth:.8,dwell:.4};
 s.field.palette=['#101820','#c0ffee','#ff0066'];s.field.params.frequency=396;
 s.resonanceDrive={kind:'sweep',glideS:3,dwellS:2,direction:'pingpong'};
 return j;
}
function seed(j){const d=empty('expression:rich',j.name);return kernelDocumentToJourney(d,{identity:{expression:j.id,scenes:{[d.scenes[0].scene_ref]:j.scenes[0].id}}});}
const MATERIAL=['source','layers','force','tint','tintWeight','scale','share','rotation','templateFrequency','templateGeometry','sequence','sound','text','shape','size','position'];

test('a rich character entity survives scene_material_set and native reopen',()=>{
 const j=richJourney();saveScene(j,j.scenes[0],'Character');
 const view=seed(j),request=prepareCompositionEdit(view,j);
 const set=request.changes.find(c=>c.change==='scene_material_set');
 assert.ok(set,'the rich material travels through scene_material_set');
 assert.deepEqual(set.presentation.scene.entities[0].sound,SOUND);
 const native=ownerEdit(view.document,request);
 // Restart: nothing but the serialised native document.
 const reopened=kernelDocumentToJourney(JSON.parse(JSON.stringify(native)));
 const before=j.scenes[0],after=reopened.journey.scenes[0];
 for(const key of MATERIAL)assert.deepEqual(after.entities[0][key],before.entities[0][key],key);
 for(const key of ['morph','engine','resonanceDrive'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(after.field.palette,before.field.palette);assert.equal(after.field.params.frequency,396);
 // The saved version carries the same material.
 const saved=reopened.journey.savedScenes[after.id];
 assert.deepEqual(saved.entities[0].sound,SOUND);assert.deepEqual(saved.entities[0].layers,before.entities[0].layers);
 // An acknowledged result is not perpetually dirty.
 const rebased=rebaseCompositionView(view,j,native);
 assert.equal(prepareCompositionEdit(rebased,j).changes.length,0);
});

test('a later material edit (sound, tint, force) returns as one scene_material_set',()=>{
 const j=richJourney();
 const view=seed(j),native=ownerEdit(view.document,prepareCompositionEdit(view,j));
 const rebased=rebaseCompositionView(view,j,native);
 const next=clone(j);
 next.scenes[0].entities[0].sound.gain=.6;next.scenes[0].entities[0].tint='#123456';next.scenes[0].entities[0].force.kind='repel';
 const edit=prepareCompositionEdit(rebased,next);
 assert.deepEqual(edit.changes.map(c=>c.change),['scene_material_set']);
 const entity=edit.changes[0].presentation.scene.entities[0];
 assert.equal(entity.sound.gain,.6);assert.equal(entity.tint,'#123456');assert.equal(entity.force.kind,'repel');
});

test('malformed per-object sound is refused before any change is built',()=>{
 for(const sound of [{enabled:'yes'},{enabled:true,gain:3},{enabled:true,waveform:'noise'},{enabled:true,script:'x'},{enabled:true,frequencyHz:432},{enabled:true,carry:{kind:'oscillator',ref:'x'}}]){
  const j=richJourney();j.scenes[0].entities[0].sound=sound;
  assert.throws(()=>prepareCompositionEdit(seed(j),j),/Invalid entity sound/);
 }
 assert.equal(validateEntitySound(undefined),undefined);
});

test('the Library save diff carries rich Scene material and the full parameter vocabulary',()=>{
 const j=richJourney();
 const view=seed(j),current=ownerEdit(view.document,prepareCompositionEdit(view,j));
 const edited=clone(current);
 const ref=Object.keys(edited.entities)[0];
 edited.entities[ref].parameters.rotation={value:.5};
 edited.entities[ref].parameters.force_mode={value:'vortex'};
 edited.scenes[0].presentation.scene.entities[0].sound.gain=.9;
 const diff=documentToChanges(current,edited);
 assert.ok(!('error' in diff),diff.error);
 assert.deepEqual(diff.changes.filter(c=>c.change==='parameter_set').map(c=>c.parameter).sort(),['force_mode','rotation']);
 const material=diff.changes.find(c=>c.change==='scene_material_set');
 assert.equal(material.presentation.scene.entities[0].sound.gain,.9);
 // Genuinely unknown keys are still refused, by name.
 edited.entities[ref].parameters.mood={value:'dark'};
 assert.match(documentToChanges(current,edited).error,/mood/);
});

test('sound voices follow presence, activity and what they carry',()=>{
 const carry={kind:'mode',ref:'maqam/00'};
 const scene={field:{params:{frequency:396}},entities:[
  {id:'a',sound:{enabled:true,carry},templateFrequency:528},
  {id:'b',sound:{enabled:true,carry,gain:.5}},
  {id:'c',sound:{enabled:true,carry},enabled:false},
  {id:'d',sound:{enabled:false,carry}},
  {id:'e',sound:{enabled:true}},
 ]};
 const voices=entitySoundVoices(scene);
 assert.deepEqual(voices.map(v=>v.entityId),['a','b'],'a voice that carries something, present and on');
 assert.equal(voices[1].gain,.5);assert.deepEqual(voices[0].carry,carry);
 assert.deepEqual(Object.keys(voices[0]).sort(),['attack','carry','entityId','gain','release'],'no frequency, waveform or pan');
 assert.deepEqual(entitySoundVoices(scene,new Set(['b'])).map(v=>v.entityId),['b']);
 assert.deepEqual(entitySoundPlan(scene).silent.map(v=>v.entityId),['e'],'one that carries nothing is silent and says why');
});

test('validateJourney keeps the sound block (model carries it as authored material)',()=>{
 const j=richJourney();
 assert.deepEqual(validateJourney(j).scenes[0].entities[0].sound,SOUND);
});

test('the shared object-sound mute is one switch every voice and the Sound control read',()=>{
 const seen=[];
 setObjectSoundMuted(true);seen.push(objectSoundIsMuted());setObjectSoundMuted(false);seen.push(objectSoundIsMuted());
 assert.deepEqual(seen,[true,false]);
});

test('travelling focus sounds only the focused entity; parallel sounds all present',()=>{
 assert.equal(activeFromFocus(null),undefined);
 assert.deepEqual([...activeFromFocus({entityId:'a',nextEntityId:'b',blend:.2})],['a']);
 assert.deepEqual([...activeFromFocus({entityId:'a',nextEntityId:'b',blend:.8})].sort(),['a','b']);
});

test('the Sound control edits exactly the validated sound block',()=>{
 const store={catalogue:null,why:'The mode catalogue has not been read yet'};
 let sound=applySoundControl(undefined,'enabled',true);
 assert.deepEqual(sound,{enabled:true});
 sound=applySoundControl(sound,'carry','mode:maqam/00');assert.deepEqual(sound.carry,{kind:'mode',ref:'maqam/00'});
 sound=applySoundControl(sound,'gain','0.4');sound=applySoundControl(sound,'attack','0.5');
 assert.deepEqual(sound,{enabled:true,carry:{kind:'mode',ref:'maqam/00'},gain:.4,attack:.5});
 assert.throws(()=>applySoundControl(sound,'gain','3'),/gain/);
 const html=soundControlsHTML(sound,false,store);
 assert.ok(html.includes('data-sound="enabled" checked'));
 assert.ok(/data-sound="gain"[^>]*value="0.4"/.test(html));
 assert.ok(/<option value="mode:maqam\/00" selected>maqam\/00 · not in the store<\/option>/.test(html),'a carry the store does not list stays visible as what it is');
 assert.ok(!/frequencyHz|waveform|data-sound="pan"|followCymatic/.test(html),'no oscillator control');
 assert.ok(!/data-action|data-bind/.test(html),'its own event vocabulary, never the app\'s');
 assert.ok(/data-sound="gain"[^>]*disabled/.test(soundControlsHTML(undefined,false,store)),'off until enabled');
});
