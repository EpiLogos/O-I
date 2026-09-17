import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
let n=0;
try{
 const {sceneBodyDisclosures,sceneHasLiveRenderer}=await server.ssrLoadModule('/src/expression/carriers.ts');
 const ref='expression:test',scene=`${ref}:scene:main`;
 const fileBody={carrier:'file_thing',subject_ref:'central:file:lessons/lesson.md',native_owner:'central',
  reading:{ref:'central:file:lessons/lesson.md',revision:'r8',availability:'available'},
  provenance:[],actions:[{action_ref:'central.files.read',target_ref:'central:file:lessons/lesson.md',authority_requirement:'central ordinary file'}],
  presentation:'preview',capability:{state:'degrades_to_thing',reason:'no inline renderer is admitted for this file type'},span:null,recursion:null};
 const document={schema:'oi.expression/v1',expression_ref:ref,revision:2,title:'Test',
  scenes:[
   {scene_ref:scene,revision:2,title:'Main',entity_refs:[],body:fileBody,triggers:[{trigger_ref:`${ref}:trigger:open-lesson`,occasion:'activate',target:{kind:'portal',placement:'beside',subject_ref:'central:file:lessons/lesson.md',scene_ref:null}}]},
   {scene_ref:`${ref}:scene:second`,revision:2,title:'Plain',entity_refs:[],body:null,triggers:[]},
  ],
  entities:{},relations:{},selection:{scene_ref:scene,entity_ref:null},provenance:[],representations:[],refinements:[],collections:['library'],profiles:[]};
 const disclosures=sceneBodyDisclosures(document);
 assert.equal(disclosures.length,1);n++;
 const [body]=disclosures;
 // The file body discloses its exact native subject and the real native open
 // Action — no implied bespoke renderer, honest degradation.
 assert.equal(body.carrier,'file_thing');n++;
 assert.equal(body.renderable,false);n++;
 assert.equal(body.capability,'degrades_to_thing');n++;
 assert.match(body.reason,/no inline renderer/);n++;
 assert.deepEqual(body.native_actions,[{action_ref:'central.files.read',target_ref:'central:file:lessons/lesson.md',authority_requirement:'central ordinary file'}]);n++;
 // The authored activation trigger is disclosed as a declarative relation;
 // its portal runtime is not simulated here (ES4 lane owns open/close).
 assert.equal(body.triggers.length,1);n++;
 assert.equal(body.triggers[0].target.placement,'beside');n++;
 // A scene without a carrier body keeps the live engine composition.
 assert.equal(sceneHasLiveRenderer(document.scenes[0]),false);n++;
 assert.equal(sceneHasLiveRenderer(document.scenes[1]),true);n++;
 // An engine-composition body with a renderable capability presents live.
 const live={...document,scenes:[{scene_ref:scene,revision:2,title:'Main',entity_refs:[],body:{...fileBody,carrier:'engine_composition',subject_ref:ref,reading:{ref:ref,revision:'2',availability:'available'},presentation:'live',capability:{state:'renderable'},triggers:[]}}]};
 assert.equal(sceneHasLiveRenderer(live.scenes[0]),true);n++;
 assert.equal(sceneBodyDisclosures(live)[0].renderable,true);n++;
 console.log(`Expression carriers: ${n} scene-body disclosure assertions passed (honest degradation, native open Actions, declarative triggers)`);
}finally{await server.close();}
