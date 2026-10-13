import test from 'node:test';
import assert from 'node:assert/strict';
import {documentToChanges,UNEXPRESSIBLE} from '../build/kernelExpressions.js';

// E20: a save emits the kernel's own Change grammar for every edit the editor
// can make; only the named, genuinely unrepresentable differences are refused.
const E='expression:save-expressibility';
const scene=(name,title,entity_refs=[])=>({scene_ref:`${E}:scene:${name}`,revision:1,title,entity_refs});
const X=`${E}:entity:x`,Y=`${E}:entity:y`;
const AUTO={min:-100,max:100,rate_hz:1,waveform:'sine'};
const SUBJECT={subject_ref:'wiki:shared-source',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]};
const clone=value=>JSON.parse(JSON.stringify(value));
function base(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:3,title:'Save expressibility',
  scenes:[scene('a','Alpha',[X]),scene('b','Beta'),scene('c','Gamma')],
  entities:{[X]:{entity_ref:X,title:'X',revision:1,subject:null,parameters:{glyph:{value:'O',automation:null},x:{value:10,automation:null}}}},
  relations:{},selection:{scene_ref:`${E}:scene:a`,entity_ref:null},provenance:[],representations:[],refinements:[]};
}
// Edit a copy of `current`; the kernel document itself is never mutated.
function editOf(current,mutate){const edited=clone(current);mutate(edited);return documentToChanges(current,edited);}
const kinds=diff=>diff.changes.map(c=>c.change);
const find=(diff,kind)=>diff.changes.filter(c=>c.change===kind);

test('an unedited document saves no changes',()=>{
 assert.deepEqual(editOf(base(),()=>{}),{changes:[]});
});

test('the acceptance session: rename, scene remove, scene reorder and a parameter edit save as four kinds in order',()=>{
 const diff=editOf(base(),e=>{
  e.title='Renamed';
  e.scenes=e.scenes.filter(s=>!s.scene_ref.endsWith(':b'));
  e.scenes.reverse();
  e.entities[X].parameters.x.value=20;
 });
 assert.deepEqual(kinds(diff),['rename','scene_remove','scene_reorder','parameter_set']);
 assert.equal(diff.changes[0].title,'Renamed');
 assert.equal(diff.changes[1].scene_ref,`${E}:scene:b`);
 assert.deepEqual(diff.changes[2].scene_refs,[`${E}:scene:c`,`${E}:scene:a`]);
 assert.deepEqual(diff.changes[3],{change:'parameter_set',entity_ref:X,parameter:'x',value:20});
});

test('rename emits the kernel rename',()=>{
 const diff=editOf(base(),e=>{e.title='Renamed';});
 assert.deepEqual(diff.changes,[{change:'rename',title:'Renamed'}]);
});

test('scene remove emits scene_remove and no reorder when the survivors keep their order',()=>{
 const diff=editOf(base(),e=>{e.scenes=e.scenes.filter(s=>!s.scene_ref.endsWith(':c'));});
 assert.deepEqual(diff.changes,[{change:'scene_remove',scene_ref:`${E}:scene:c`}]);
});

test('scene create appends and names the new scene; no reorder is needed for an append',()=>{
 // A new scene also carries its (empty) membership as today: scene_compose [].
 const diff=editOf(base(),e=>{e.scenes.push(scene('d','Delta'));});
 assert.deepEqual(diff.changes,[
  {change:'scene_create',scene_ref:`${E}:scene:d`,title:'Delta'},
  {change:'scene_compose',scene_ref:`${E}:scene:d`,entity_refs:[]},
 ]);
});

test('scene rename retitles a surviving scene',()=>{
 const diff=editOf(base(),e=>{e.scenes[1].title='Beta II';});
 assert.deepEqual(diff.changes,[{change:'scene_rename',scene_ref:`${E}:scene:b`,title:'Beta II'}]);
});

test('scene reorder carries the full edited order when only the order moved',()=>{
 const diff=editOf(base(),e=>{e.scenes.reverse();});
 assert.deepEqual(diff.changes,[{change:'scene_reorder',scene_refs:[`${E}:scene:c`,`${E}:scene:b`,`${E}:scene:a`]}]);
});

test('removed scene material is a scene_material_clear',()=>{
 const current=base();current.scenes[1].presentation={schema:'oi.journey-scene/v1',scene:{name:'Beta',entities:[]}};
 const diff=editOf(current,e=>{delete e.scenes[1].presentation;});
 assert.deepEqual(diff.changes,[{change:'scene_material_clear',scene_ref:`${E}:scene:b`}]);
});

test('a parameter gaining automation is a parameter_automate',()=>{
 const diff=editOf(base(),e=>{e.entities[X].parameters.x.automation=AUTO;});
 assert.deepEqual(diff.changes,[{change:'parameter_automate',entity_ref:X,parameter:'x',automation:AUTO}]);
});

test('an automated parameter returned to manual is a parameter_manual',()=>{
 const current=base();current.entities[X].parameters.x.automation=AUTO;
 const diff=editOf(current,e=>{e.entities[X].parameters.x.automation=null;});
 assert.deepEqual(diff.changes,[{change:'parameter_manual',entity_ref:X,parameter:'x'}]);
});

test('a different automation course with no value change is one parameter_automate',()=>{
 const current=base();current.entities[X].parameters.x.automation=AUTO;
 const next={...AUTO,rate_hz:2};
 const diff=editOf(current,e=>{e.entities[X].parameters.x.automation=next;});
 assert.deepEqual(diff.changes,[{change:'parameter_automate',entity_ref:X,parameter:'x',automation:next}]);
});

test('a value change under automation takes manual control, sets, and automates again with the same course',()=>{
 // The kernel refuses parameter_set on an automated parameter, so the value
 // travels as manual, set, automate: the final state is value new, course kept.
 const current=base();current.entities[X].parameters.x.automation=AUTO;
 const diff=editOf(current,e=>{e.entities[X].parameters.x.value=20;});
 assert.deepEqual(kinds(diff),['parameter_manual','parameter_set','parameter_automate']);
 assert.deepEqual(diff.changes[1],{change:'parameter_set',entity_ref:X,parameter:'x',value:20});
 assert.deepEqual(diff.changes[2].automation,AUTO);
});

test('a subject bound on an entity is a subject_bind with the edited binding',()=>{
 const diff=editOf(base(),e=>{e.entities[X].subject=SUBJECT;});
 assert.deepEqual(diff.changes,[{change:'subject_bind',entity_ref:X,binding:SUBJECT}]);
});

test('a cleared subject is a subject_unbind',()=>{
 const current=base();current.entities[X].subject=SUBJECT;
 const diff=editOf(current,e=>{e.entities[X].subject=null;});
 assert.deepEqual(diff.changes,[{change:'subject_unbind',entity_ref:X}]);
});

test('a changed subject binding is a subject_bind with the edited binding',()=>{
 const current=base();current.entities[X].subject=SUBJECT;
 const next={...SUBJECT,subject_ref:'wiki:other-source'};
 const diff=editOf(current,e=>{e.entities[X].subject=next;});
 assert.deepEqual(diff.changes,[{change:'subject_bind',entity_ref:X,binding:next}]);
});

test('a new entity is entity_add, its parameters, its subject, then its scene membership',()=>{
 const diff=editOf(base(),e=>{
  e.entities[Y]={entity_ref:Y,title:'Y',revision:1,subject:SUBJECT,parameters:{glyph:{value:'Q',automation:null}}};
  e.scenes[1].entity_refs=[Y];
 });
 assert.deepEqual(kinds(diff),['entity_add','parameter_set','subject_bind','scene_compose']);
});

test('an unedited parameter outside the vocabulary is not a difference',()=>{
 const current=base();current.entities[X].parameters.foo={value:1,automation:null};
 assert.deepEqual(editOf(current,()=>{}),{changes:[]});
});

test('each remaining refusal is named, and the named set is exactly UNEXPRESSIBLE',()=>{
 assert.deepEqual(Object.keys(UNEXPRESSIBLE).sort(),[
  'composition_removal','entity_rename','new_entity_unplaced','non_finite_number','owner_metadata','parameter_outside_editable','parameter_removal',
  'representation_removal','source_relation','text_value','undefined_scene_entity','unsupported_properties','unsupported_scene_material',
 ]);
 const cases=[
  ['parameter_removal',e=>{delete e.entities[X].parameters.x;},'x'],
  ['parameter_outside_editable',e=>{e.entities[X].parameters.mood={value:'dark',automation:null};},'mood'],
  ['non_finite_number',e=>{e.entities[X].parameters.x.value=Infinity;},'x'],
  ['text_value',e=>{e.entities[X].parameters.glyph.value=5;},'glyph'],
  ['new_entity_unplaced',e=>{e.entities[Y]={entity_ref:Y,title:'Y',revision:1,subject:null,parameters:{}};},Y],
  ['undefined_scene_entity',e=>{e.scenes[1].entity_refs=[`${E}:entity:ghost`];},'ghost'],
  ['unsupported_scene_material',e=>{e.scenes[0].presentation={schema:'not-a-scene'};},`${E}:scene:a`],
  ['unsupported_properties',e=>{e.presentation={schema:'not-properties'};},'Expression properties'],
 ];
 for(const [reason,mutate,mention] of cases){
  const diff=editOf(base(),mutate);
  assert.ok('error' in diff,`${reason} must refuse`);
  assert.ok(diff.error.includes(UNEXPRESSIBLE[reason]),`${reason}: ${diff.error}`);
  assert.ok(diff.error.includes(mention),`${reason} names its subject: ${diff.error}`);
  assert.equal('changes' in diff,false,`${reason} is never partial`);
 }
 const current=base();current.presentation={schema:'oi.journey-properties/v1',description:'',loop:true};
 const removed=editOf(current,e=>{delete e.presentation;});
 assert.ok('error' in removed);
 assert.ok(removed.error.includes(UNEXPRESSIBLE.composition_removal));
});

test('a document that is not an oi.expression/v1 expression is refused, not diffed',()=>{
 const diff=documentToChanges(base(),{schema:'other'});
 assert.match(diff.error,/not an oi\.expression\/v1 expression/);
});
