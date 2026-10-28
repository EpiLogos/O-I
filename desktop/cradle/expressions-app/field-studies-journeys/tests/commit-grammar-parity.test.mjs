import test from 'node:test';
import assert from 'node:assert/strict';
import {documentToChanges,UNEXPRESSIBLE} from '../build/kernelExpressions.js';
import {kernelDocumentToJourney} from '../build/kernelDocumentBridge.js';
import {prepareCompositionEdit} from '../build/kernelComposition.js';

// E20b: one Change grammar, two commit paths. documentToChanges (the document
// diff) and prepareCompositionEdit (the live Journey commit) agree on the
// families both can see; every other family is expressed or named, never dropped.
const E='expression:commit-parity';
const scene=n=>`${E}:scene:${n}`;
const A=scene('a'),B=scene('b'),C=scene('c');
const X=`${E}:entity:x`,Y=`${E}:entity:y`;
const REF={ref:'source-r1',revision:'1',availability:'available'};
const AUTO={min:-100,max:100,rate_hz:1,waveform:'sine'};
const SUBJECT={subject_ref:'wiki:shared-source',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]};
const BODY={carrier:'text_source',subject_ref:'wiki:note',native_owner:'central',reading:REF,provenance:[],actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:null};
const TRIGGER={trigger_ref:`${E}:trigger:t1`,occasion:'scene_enter',target:{kind:'navigate',scene_ref:B,entity_ref:null}};
const CONNECTION={binding_ref:`${E}:relation:connection-1`,native_owner:'oi',relation:{ref:`${E}:relation:connection-1:connects`,revision:'1',availability:'available'},from_entity_ref:X,to_entity_ref:Y,provenance:[]};
const SOURCE={binding_ref:`${E}:relation:source-1`,native_owner:'ai-kit',relation:{ref:'wiki:relation:s1',revision:'r1',availability:'available'},from_entity_ref:X,to_entity_ref:Y,provenance:[]};
const REPRESENTATION={kind:'image',representation:{ref:'rep-1',revision:'1',availability:'available'},provenance:[]};
const PROFILE={profile_ref:'profile:p1',revision:1,overridden_parameters:{}};
const clone=value=>JSON.parse(JSON.stringify(value));

// The whole kernel document, with every field family present.
function rich(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:4,title:'Commit parity',
  scenes:[
   {scene_ref:A,revision:1,title:'Alpha',entity_refs:[X,Y],triggers:[clone(TRIGGER)]},
   {scene_ref:B,revision:1,title:'Beta',entity_refs:[]},
   {scene_ref:C,revision:1,title:'Gamma',entity_refs:[]},
  ],
  entities:{
   [X]:{entity_ref:X,title:'X',revision:1,subject:null,parameters:{glyph:{value:'O',automation:null},x:{value:10,automation:null}}},
   [Y]:{entity_ref:Y,title:'Y',revision:1,subject:null,parameters:{glyph:{value:'Q',automation:null}}},
  },
  relations:{[CONNECTION.binding_ref]:clone(CONNECTION)},
  representations:[clone(REPRESENTATION)],profiles:[clone(PROFILE)],collections:['alpha'],reuse:null,
  selection:{scene_ref:A,entity_ref:null},provenance:[],refinements:[]};
}
// The same document without the families the live Journey cannot see.
function plain(){const d=rich();d.relations={};d.representations=[];d.profiles=[];d.collections=[];d.scenes[0].triggers=[];return d;}
// Edit a copy of `current`; the kernel document itself is never mutated.
function editOf(current,mutate){const edited=clone(current);mutate(edited);return documentToChanges(current,edited);}
const kinds=diff=>diff.changes.map(c=>c.change);

// The kinds the live Journey commit can express: a Journey carries scenes,
// entities, names, membership, material and composition, and no relation,
// subject, pin, body, trigger, profile, collection, reuse, automation or representation.
const JOURNEY_KINDS=new Set(['rename','scene_create','scene_rename','scene_remove','scene_reorder','scene_compose','entity_add','entity_remove','scene_material_set','composition_set','focus']);
const KERNEL_ONLY_KINDS=['entity_pin','scene_private','subject_bind','subject_unbind','parameter_automate','parameter_manual','relation_bind','relation_remove','relation_focus','scene_body_set','scene_body_clear','scene_trigger_attach','scene_trigger_detach','scene_performance_set','scene_performance_clear','representation_bind','profile_adopt','profile_release','collections_set','reuse_set','reuse_clear'];

// Every field family, with the change it must yield or the named refusal it
// must carry. The optional base is the state the family starts from.
const withBody=()=>{const d=rich();d.scenes[0].body=clone(BODY);return d;};
const withMaterial=()=>{const d=rich();d.scenes[0].presentation={schema:'oi.journey-scene/v1',scene:{name:'Alpha',entities:[]}};return d;};
const withProperties=()=>{const d=rich();d.presentation={schema:'oi.journey-properties/v1',description:'d',loop:true};return d;};
const withReuse=()=>{const d=rich();d.reuse={schema:'oi.expression-reuse/v1',kind:'scene',title:'Reusable'};return d;};
const withSubject=()=>{const d=rich();d.entities[X].subject=clone(SUBJECT);return d;};
const withSource=()=>{const d=rich();d.relations[SOURCE.binding_ref]=clone(SOURCE);return d;};
const withTrigger=()=>{const d=rich();return d;};
const FAMILIES=[
 ['document title',e=>{e.title='Renamed';},{kind:'rename'}],
 ['scene created',e=>{e.scenes.push({scene_ref:`${E}:scene:d`,revision:1,title:'Delta',entity_refs:[]});},{kind:'scene_create'}],
 ['scene removed',e=>{e.scenes=e.scenes.filter(s=>s.scene_ref!==C);},{kind:'scene_remove'}],
 ['scene renamed',e=>{e.scenes[1].title='Beta II';},{kind:'scene_rename'}],
 ['scene order',e=>{e.scenes.reverse();},{kind:'scene_reorder'}],
 ['scene membership',e=>{e.scenes[1].entity_refs=[Y];e.scenes[0].entity_refs=[X];},{kind:'scene_compose'}],
 ['entity added',e=>{const Z=`${E}:entity:z`;e.entities[Z]={entity_ref:Z,title:'Z',revision:1,subject:null,parameters:{glyph:{value:'Z',automation:null}}};e.scenes[1].entity_refs=[Z];},{kind:'entity_add'}],
 ['entity removed',e=>{delete e.entities[Y];e.scenes[0].entity_refs=[X];e.relations={};},{kind:'entity_remove'}],
 ['entity title',e=>{e.entities[X].title='X renamed';},{refuse:'entity_rename'}],
 ['parameter value',e=>{e.entities[X].parameters.x.value=20;},{kind:'parameter_set'}],
 ['parameter automation',e=>{e.entities[X].parameters.x.automation=AUTO;},{kind:'parameter_automate'}],
 ['parameter removal',e=>{delete e.entities[X].parameters.x;},{refuse:'parameter_removal'}],
 ['subject bound',e=>{e.entities[X].subject=clone(SUBJECT);},{kind:'subject_bind'}],
 ['subject cleared',e=>{e.entities[X].subject=null;},{kind:'subject_unbind'},withSubject],
 ['entity pinned',e=>{e.entities[X].pinned=true;},{kind:'entity_pin'}],
 // O-I #761: a Scene the owner marks private (a Palace's private room) is the Scene's own flag, as a pin is the entity's.
 ['scene private',e=>{e.scenes[1].private=true;},{kind:'scene_private'}],
 ['O:I connection bound',e=>{e.relations={[`${E}:relation:connection-2`]:{...clone(CONNECTION),binding_ref:`${E}:relation:connection-2`,relation:{ref:`${E}:relation:connection-2:connects`,revision:'1',availability:'available'}}};},{kind:'relation_bind'}],
 ['O:I connection removed',e=>{e.relations={};},{kind:'relation_remove'}],
 ['source relation bound',e=>{e.relations[SOURCE.binding_ref]=clone(SOURCE);},{refuse:'source_relation'}],
 ['source relation removed',e=>{delete e.relations[SOURCE.binding_ref];},{refuse:'source_relation'},withSource],
 ['scene body set',e=>{e.scenes[2].body=clone(BODY);},{kind:'scene_body_set'}],
 ['scene body cleared',e=>{e.scenes[0].body=null;},{kind:'scene_body_clear'},withBody],
 ['scene performance set',e=>{e.scenes[1].performance={schema:'oi.performance/v1',steps:[]};},{kind:'scene_performance_set'}],
 ['scene trigger attached',e=>{e.scenes[1].triggers=[clone({...TRIGGER,trigger_ref:`${E}:trigger:t2`})];},{kind:'scene_trigger_attach'}],
 ['scene trigger detached',e=>{e.scenes[0].triggers=[];},{kind:'scene_trigger_detach'},withTrigger],
 ['representation bound',e=>{e.representations.push({...clone(REPRESENTATION),representation:{ref:'rep-2',revision:'1',availability:'available'}});},{kind:'representation_bind'}],
 ['representation removed',e=>{e.representations=[];},{refuse:'representation_removal'}],
 ['profile adopted',e=>{e.profiles.push({...clone(PROFILE),profile_ref:'profile:p2'});},{kind:'profile_adopt'}],
 ['profile released',e=>{e.profiles=[];},{kind:'profile_release'}],
 ['collections',e=>{e.collections=['alpha','beta'];},{kind:'collections_set'}],
 ['reuse set',e=>{e.reuse={schema:'oi.expression-reuse/v1',kind:'scene',title:'Reuse II'};},{kind:'reuse_set'},withReuse],
 ['reuse cleared',e=>{e.reuse=null;},{kind:'reuse_clear'},withReuse],
 ['properties set',e=>{e.presentation={schema:'oi.journey-properties/v1',description:'d',loop:false};},{kind:'composition_set'}],
 ['properties removed',e=>{delete e.presentation;},{refuse:'composition_removal'},withProperties],
 ['scene material set',e=>{e.scenes[1].presentation={schema:'oi.journey-scene/v1',scene:{name:'Beta',entities:[]}};},{kind:'scene_material_set'}],
 ['scene material cleared',e=>{delete e.scenes[0].presentation;},{kind:'scene_material_clear'},withMaterial],
 ['scene focus',e=>{e.selection={scene_ref:B,entity_ref:null};},{kind:'focus'}],
 ['relation focus',e=>{e.selection={scene_ref:A,entity_ref:null,relation_ref:CONNECTION.binding_ref};},{kind:'relation_focus'}],
 ['document provenance',e=>{e.provenance=[REF];},{refuse:'owner_metadata'}],
 ['document refinements',e=>{e.refinements=[{proposal_ref:'p'}];},{refuse:'owner_metadata'}],
];

test('an unedited rich document saves no changes',()=>{
 assert.deepEqual(editOf(rich(),()=>{}),{changes:[]});
});

for(const [name,mutate,expect,base=rich] of FAMILIES){
 test(`field family "${name}" yields its change or its named refusal, never a silent drop`,()=>{
  const diff=editOf(base(),mutate);
  if(expect.refuse){
   assert.ok('error' in diff,`${name} must refuse`);
   assert.ok(diff.error.includes(UNEXPRESSIBLE[expect.refuse]),`${name}: ${diff.error}`);
   assert.equal('changes' in diff,false,`${name} is never partial`);
  }else{
   assert.ok('changes' in diff,`${name} must express: ${diff.error}`);
   assert.ok(kinds(diff).includes(expect.kind),`${name} yields ${expect.kind}, got ${kinds(diff).join(',')}`);
  }
 });
}

test('a relation or trigger that leaves goes before the entity or Scene it names',()=>{
 const diff=editOf(rich(),e=>{
  e.scenes=e.scenes.filter(s=>s.scene_ref!==A);
  delete e.entities[X];delete e.entities[Y];e.relations={};
  e.selection={scene_ref:B,entity_ref:null};
 });
 const order=kinds(diff);
 assert.ok(order.indexOf('scene_trigger_detach')>=0&&order.indexOf('scene_trigger_detach')<order.indexOf('scene_remove'),order.join(','));
 assert.ok(order.indexOf('relation_remove')>=0&&order.indexOf('relation_remove')<order.indexOf('entity_remove'),order.join(','));
});

test('a new or changed trigger attaches after its Scene and entities exist',()=>{
 const diff=editOf(rich(),e=>{
  e.scenes.push({scene_ref:`${E}:scene:d`,revision:1,title:'Delta',entity_refs:[],triggers:[clone({...TRIGGER,trigger_ref:`${E}:trigger:t3`,target:{kind:'navigate',scene_ref:`${E}:scene:d`,entity_ref:null}})]});
 });
 const order=kinds(diff);
 assert.ok(order.indexOf('scene_create')<order.indexOf('scene_trigger_attach'),order.join(','));
});

test('a document that addresses another Expression is refused, not diffed',()=>{
 const diff=editOf(rich(),e=>{e.expression_ref=`${E}:other`;});
 assert.match(diff.error,/different Expression/);
});

// Parity: the shared families produce the same change set on both paths.
// New objects are excluded by design: the live Journey mints its own refs for
// them (kernelComposition localRef), so the pair compares existing refs only.
const SHARED=new Set(['rename','scene_create','scene_rename','scene_remove','scene_reorder','scene_compose','entity_add','entity_remove']);
const normal=changes=>changes.filter(c=>SHARED.has(c.change)).map(c=>c.change==='scene_compose'?{...c,entity_refs:[...c.entity_refs].sort()}:c).map(c=>JSON.stringify(c)).sort();
function bothPaths(current,edited){
 const doc=documentToChanges(current,edited);
 assert.ok('changes' in doc,`document diff must express the pair: ${doc.error}`);
 const live=prepareCompositionEdit(kernelDocumentToJourney(current),kernelDocumentToJourney(edited).journey);
 return {doc:normal(doc.changes),live:normal(live.changes)};
}
const PARITY=[
 ['rename, scene removal and reorder',e=>{e.title='Renamed';e.scenes=e.scenes.filter(s=>s.scene_ref!==B);e.scenes.reverse();}],
 ['scene rename',e=>{e.scenes[1].title='Beta II';}],
 ['an entity moves between existing scenes',e=>{e.scenes[0].entity_refs=[X];e.scenes[1].entity_refs=[Y];}],
 ['an entity leaves the document',e=>{delete e.entities[Y];e.scenes[0].entity_refs=[X];}],
];
for(const [name,mutate] of PARITY){
 test(`parity: ${name} is the same change set on both commit paths`,()=>{
  const current=plain(),edited=clone(current);mutate(edited);
  const pair=bothPaths(current,edited);
  assert.ok(pair.doc.length>0,'the pair is a real edit');
  assert.deepEqual(pair.live,pair.doc);
 });
}

test('the live path emits only Journey-visible kinds; the kernel-only families are carried by the view, not dropped',()=>{
 const view=kernelDocumentToJourney(rich());
 const edited=clone(view.journey);edited.name='Renamed live';
 const edit=prepareCompositionEdit(view,edited);
 const emitted=edit.changes.map(c=>c.change);
 assert.deepEqual([...new Set(emitted)].sort(),['rename']);
 for(const kind of KERNEL_ONLY_KINDS)assert.ok(!emitted.includes(kind),`live path must not emit ${kind}`);
 for(const kind of emitted)assert.ok(JOURNEY_KINDS.has(kind),`${kind} is Journey-visible`);
});

test('the live path refuses by name an entity removal that still has native relations',()=>{
 const view=kernelDocumentToJourney(rich());
 const edited=clone(view.journey),id=edited.scenes[0].id;
 // The saved version of a Scene carries its members too, so the removal leaves both.
 edited.scenes[0].entities=edited.scenes[0].entities.filter(en=>en.id!==Y);
 if(edited.savedScenes?.[id])edited.savedScenes[id].entities=edited.savedScenes[id].entities.filter(en=>en.id!==Y);
 assert.throws(()=>prepareCompositionEdit(view,edited),/still has native relations/);
});
