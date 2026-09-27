// Reusable material in the authoring app (EXPRESSION-ACT-MATERIAL-V1 §1, §3,
// §4): role slots, the reuse block a "Save as reusable" writes, binding rows
// for performing saved material, and act playback steps. Compiles the pure
// modules on the fly (no app build needed): `node --test tests/reuse.test.mjs`.
import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'oi-reuse-test-'));
async function load(name){
 const outfile=path.join(out,name+'.mjs');
 await build({absWorkingDir:root,nodePaths:[path.resolve(root,'../node_modules')],entryPoints:[`src/${name}.ts`],bundle:true,format:'esm',platform:'node',target:'es2022',outfile,logLevel:'silent',
  // model.ts pulls the engine's research/blueprint validators; they are pure and bundle for node.
  loader:{'.woff':'empty','.woff2':'empty','.ttf':'empty','.svg':'empty','.png':'empty','.jpg':'empty','.webp':'empty','.css':'empty'}});
 return import(pathToFileURL(outfile).href);
}
const reuse=await load('reuse');
const model=await load('model');
test.after(()=>fs.rmSync(out,{recursive:true,force:true}));

function handoffJourney(){
 const j=model.blankJourney();j.name='Handoff';
 const main=j.scenes[0];main.name='Main';
 const sender=model.entity('N'),recipient=model.entity('L'),artifact=model.pin({x:0,y:.2,z:0});
 main.entities=[sender,recipient,artifact];
 main.text=[{id:'caption',visible:true,kicker:'',title:'',italic:'',body:'…',x:.5,y:.8,width:300,size:24,align:'center'}];
 const back=model.clone(main);back.id='scene-return';back.name='Return';
 j.scenes.push(back);
 return {j,main,back,sender,recipient,artifact};
}
const ids=(j)=>({scene:id=>`expression:h:scene:${id}`,entity:(sceneId,entityId)=>`expression:h:entity:${entityId}`});

test('roles are assigned to objects and text layers and survive journey validation',()=>{
 const {j,main,sender,recipient}=handoffJourney();
 assert.equal(reuse.setRole(main,sender.id,'sender'),'entity');
 assert.equal(reuse.setRole(main,recipient.id,'recipient'),'entity');
 assert.equal(reuse.setRole(main,'caption','caption'),'text');
 main.entities[1].overrides={scale:2};
 const checked=model.validateJourney(JSON.parse(JSON.stringify(j)));
 assert.equal(checked.scenes[0].entities[0].role,'sender');
 assert.deepEqual(checked.scenes[0].entities[1].overrides,{scale:2});
 assert.equal(checked.scenes[0].text[0].role,'caption');
 assert.deepEqual(reuse.roleSlots(j).map(r=>[r.role,r.slot,r.accepts]),[['sender','entity','agent'],['recipient','entity','agent'],['caption','text','text']]);
 assert.equal(reuse.setRole(main,sender.id,null),'entity');
 assert.equal(main.entities[0].role,undefined);
 assert.equal(reuse.setRole(main,'absent','goal'),null);
 assert.throws(()=>reuse.setRole(main,sender.id,'bad role'),/role name/);
});

test('journey validation refuses malformed roles and identity-bearing overrides',()=>{
 const {j,main,sender}=handoffJourney();
 sender.role='bad role';assert.throws(()=>model.validateJourney(j),/role/);
 sender.role='sender';sender.overrides={id:'x'};assert.throws(()=>model.validateJourney(j),/overrides/);
 sender.overrides={tint:'#ff0000'};assert.doesNotThrow(()=>model.validateJourney(j));
 main.text[0].role='x'.repeat(65);assert.throws(()=>model.validateJourney(j),/role/);
});

test('the reuse block names committed native refs, states, gestures and playback',()=>{
 const {j,main,back,sender,recipient}=handoffJourney();
 reuse.setRole(main,sender.id,'sender');reuse.setRole(main,recipient.id,'recipient');reuse.setRole(main,'caption','caption');
 const block=reuse.buildReuse(j,{kind:'scene',title:' Handoff ',states:{},gestures:{wave:{sceneId:back.id,role:'sender'}},entrySceneId:main.id,playback:[main.id,back.id],
  associations:{workflow_keys:reuse.parseList('handoff, review ,handoff'),task_types:[],skill_set_refs:[],skill_refs:[],event_families:['agent-message']}},ids(j));
 assert.deepEqual(block,{schema:'oi.expression-reuse/v1',kind:'scene',title:'Handoff',
  roles:[{role:'sender',accepts:'agent',entity_ref:`expression:h:entity:${sender.id}`},{role:'recipient',accepts:'agent',entity_ref:`expression:h:entity:${recipient.id}`},{role:'caption',accepts:'text',text_id:'caption'}],
  entry_scene_ref:`expression:h:scene:${main.id}`,gestures:{wave:{scene_ref:`expression:h:scene:${back.id}`,role:'sender'}},
  playback:[`expression:h:scene:${main.id}`,`expression:h:scene:${back.id}`],
  associations:{workflow_keys:['handoff','review'],event_families:['agent-message']}});
 assert.equal(reuse.materialFileName('Handoff: v2!'),'handoff-v2.expression.json');
});

test('reuse refusals are legible before anything is written',()=>{
 const {j,main,sender}=handoffJourney();
 const form={kind:'character',title:'Nous',states:{},gestures:{},playback:[],associations:{workflow_keys:[],task_types:[],skill_set_refs:[],skill_refs:[],event_families:[]}};
 assert.throws(()=>reuse.buildReuse(j,form,ids(j)),/at least one state/);
 assert.throws(()=>reuse.buildReuse(j,{...form,states:{idle:main.id}},ids(j)),/role "self"/);
 reuse.setRole(main,sender.id,'self');
 assert.equal(reuse.buildReuse(j,{...form,states:{idle:main.id},previewState:'idle'},ids(j)).preview_state,'idle');
 assert.throws(()=>reuse.buildReuse(j,{...form,states:{idle:main.id},previewState:'speaking'},ids(j)),/preview state/);
 assert.throws(()=>reuse.buildReuse(j,{...form,states:{'not ok':main.id}},ids(j)),/state name/);
 assert.throws(()=>reuse.buildReuse(j,{...form,title:''},ids(j)),/title/);
 assert.throws(()=>reuse.buildReuse(j,{...form,states:{idle:main.id}},{scene:()=>undefined,entity:()=>undefined}),/natively/);
});

test('binding rows become act bindings and captions; empty rows keep the placeholder',()=>{
 const {bindings,captions}=reuse.actBindings([
  {role:'sender',accepts:'agent',character_ref:'central:path:/c:nous.expression.json',state:'speaking',label:'Nous'},
  {role:'recipient',accepts:'agent',character_ref:'',state:'',label:''},
  {role:'artifact',accepts:'object',glyph:'◇',label:'Draft'},
  {role:'caption',accepts:'text',text:' Handing over '},
  {role:'progress',accepts:'value',value:0.4},
 ]);
 assert.deepEqual(bindings,{sender:{kind:'agent',character_ref:'central:path:/c:nous.expression.json',state:'speaking',label:'Nous'},artifact:{kind:'object',glyph:'◇',label:'Draft'},progress:{kind:'value',value:0.4}});
 assert.deepEqual(captions,{caption:'Handing over'});
 assert.throws(()=>reuse.actBindings([{role:'sender',accepts:'agent',state:'no way'}]),/state name/);
});

test('act playback steps carry each passage transition and skip non-performing marks',()=>{
 const steps=reuse.actTimeline([
  {index:0,kind:'scene',scene_ref:'expression:h:scene:main',transition:{duration:1.2}},
  {index:1,kind:'gesture',role:'sender',gesture:'nod'},
  {index:2,kind:'operate',operation:'factory.message',native_ref:'message:7'},
  {index:3,kind:'continue',mode:'techne'},
  {index:4,kind:'text',role:'caption',text:'Reviewing',transition:{duration:0}},
  {index:5,kind:'return',text:'Accepted'},
 ]);
 assert.deepEqual(steps.map(s=>[s.position,s.label,s.seconds,s.performs]),[
  [0,'main',1.2,true],[1,'sender · nod',1.5,true],[2,'factory.message · 7',1.5,false],[3,'→ techne',1.5,false],[4,'caption · Reviewing',0,true],[5,'return · Accepted',1.5,true]]);
 assert.equal(reuse.nextStep(steps,1).position,4);
 assert.equal(reuse.nextStep(steps,5),null);
});

test('a reusable copy re-addresses only the source Expression refs onto its fork',()=>{
 const block={schema:'oi.expression-reuse/v1',kind:'scene',title:'H',roles:[{role:'sender',accepts:'agent',entity_ref:'expression:w:entity:a'},{role:'caption',accepts:'text',text_id:'c'}],
  entry_scene_ref:'expression:w:scene:main',states:{idle:'expression:w:scene:idle'},gestures:{nod:{scene_ref:'expression:w:scene:nod',role:'self'}},playback:['expression:w:scene:main','expression:other:scene:x']};
 const copy=reuse.remapReuse(block,'expression:w','expression:material-h-1');
 assert.equal(copy.roles[0].entity_ref,'expression:material-h-1:entity:a');
 assert.deepEqual(copy.roles[1],{role:'caption',accepts:'text',text_id:'c'});
 assert.equal(copy.entry_scene_ref,'expression:material-h-1:scene:main');
 assert.equal(copy.states.idle,'expression:material-h-1:scene:idle');
 assert.equal(copy.gestures.nod.scene_ref,'expression:material-h-1:scene:nod');
 assert.deepEqual(copy.playback,['expression:material-h-1:scene:main','expression:other:scene:x']);
 assert.equal(block.entry_scene_ref,'expression:w:scene:main','the working block is untouched');
 const ref=reuse.materialExpressionRef('Handoff: v2!','1234-abcd-ef');
 assert.match(ref,/^expression:[a-zA-Z0-9_.-]{1,128}$/);
 assert.equal(ref,'expression:material-handoff-v2-1234abcdef');
});

test('playback steps carry the passage easing for the frame crossfade',()=>{
 const [step]=reuse.actTimeline([{index:0,kind:'scene',scene_ref:'expression:h:scene:main',transition:{duration:2,easing:'kineticSnap'}}]);
 assert.equal(step.easing,'kineticSnap');assert.equal(step.seconds,2);
});
