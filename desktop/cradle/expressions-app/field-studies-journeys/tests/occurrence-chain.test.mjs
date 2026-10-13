import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {kernelDocumentToJourney,occurrencesOfSubject} from '../build/kernelDocumentBridge.js';
import {libraryHTML} from '../build/expressions.js';

// E21 — scene -> source -> subject chain, with back-references.
// The back-reference reads ONLY the bindings the bridge already built (occurrencesOfSubject) and, for the
// projection side, the ONE projection state (projectedSubjectStandings in techne/wikiProjectionStore.ts).
// A second index would be a second reading of the same occurrences; these tests fail if one appears.

const E='expression:chain', S1=E+':scene:main', S2=E+':scene:other';
const SHARED='wiki:shared-source', OTHER='wiki:other-source';
const entity=(id,title,subject)=>({entity_ref:`${E}:entity:${id}`,title,subject:{subject_ref:subject,native_owner:'wiki',sources:[{source_ref:'central:note',revision:'r1',selector:{kind:'text_quote',exact:title}}]},parameters:{glyph:{value:'A'},x:{value:0},y:{value:0},z:{value:0}}});
function chainDocument(){
 const list=[entity('a','Passage A',SHARED),entity('b','Passage B',OTHER),entity('c','Passage C',SHARED)];
 return {schema:'oi.expression/v1',expression_ref:E,revision:4,title:'Chain',
  entities:Object.fromEntries(list.map(e=>[e.entity_ref,e])),
  scenes:[
   {scene_ref:S1,title:'Main',revision:1,entity_refs:[`${E}:entity:a`,`${E}:entity:b`],body:null,triggers:[]},
   {scene_ref:S2,title:'Other',revision:1,entity_refs:[`${E}:entity:c`],body:null,triggers:[]},
  ]};
}
const base={saved:[],featured:[],starters:[],section:'collection',errors:[],legacy:false,cover:()=>undefined,standalone:true};

test('E21: a subject back-references exactly the bound occurrences that carry it, scene by scene', ()=>{
 const view=kernelDocumentToJourney(chainDocument());
 const found=occurrencesOfSubject(view,SHARED);
 const fromBindings=view.journey.scenes.flatMap(s=>view.bindings[s.id].occurrences.filter(o=>o.subject?.subject_ref===SHARED));
 assert.deepEqual(found.map(f=>[f.scene_ref,f.entity_ref]),fromBindings.map(o=>[o.scene_ref,o.entity_ref]));
 assert.deepEqual(found.map(f=>f.scene_ref),[S1,S2]);
 assert.deepEqual(occurrencesOfSubject(view,'wiki:absent'),[],'a subject on no stage is an honest empty list');
});

test('E21: every back-reference jumps through the binding spine to its own scene and occurrence', ()=>{
 const view=kernelDocumentToJourney(chainDocument());
 for(const f of occurrencesOfSubject(view,SHARED)){
  const sceneId=view.journey.scenes.find(s=>view.bindings[s.id].scene_ref===f.scene_ref)?.id;
  assert.ok(sceneId,`scene ${f.scene_ref} is bound`);
  const occurrence=view.bindings[sceneId].occurrences.find(o=>o.view_entity_id===f.view_entity_id);
  assert.ok(occurrence,'the view id resolves to exactly one occurrence');
  assert.equal(occurrence.entity_ref,f.entity_ref);
 }
});

test('E21: titles come from the native document, never invented', ()=>{
 const found=occurrencesOfSubject(kernelDocumentToJourney(chainDocument()),SHARED);
 assert.deepEqual(found.map(f=>[f.entity_title,f.scene_title]),[['Passage A','Main'],['Passage C','Other']]);
});

// The projection side is the one wiki projection state. The store is a React-hosted module that the Expressions
// bundle does not carry, so the pure query is bundled here from its real source file, not copied.
async function loadProjectionStore(){
 const out=await build({entryPoints:[new URL('../../../src/techne/wikiProjectionStore.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',target:'es2022',logLevel:'silent'});
 return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
}
const projected=(ref,title,scene,entries)=>({expression_ref:ref,revision:1,title,
 scenes:[{scene_ref:scene,title:'Constellation',entity_refs:entries.map(e=>e.ref)}],
 entities:Object.fromEntries(entries.map(e=>[e.ref,{entity_ref:e.ref,title:e.title,subject:{subject_ref:e.subject,native_owner:'wiki'}}]))});

test('E21: the projection side reads the one projection state; only registers that carry the subject stand for it', async()=>{
 const store=await loadProjectionStore();
 assert.equal(typeof store.projectedSubjectStandings,'function','the projection query is exported from the one state module');
 const docA=projected('expression:wiki-a','Wiki A','scene:a',[{ref:'e:1',title:'Shared',subject:SHARED},{ref:'e:2',title:'Other',subject:OTHER}]);
 const docB=projected('expression:wiki-b','Wiki B','scene:b',[{ref:'e:9',title:'Shared again',subject:SHARED}]);
 const standings={
  'register:a':{phase:'ready',projection:{document:docA},document:docA},
  'register:b':{phase:'projected',projection:{document:docB}},
  'register:c':{phase:'absent'},
 };
 const rows=store.projectedSubjectStandings(standings,SHARED);
 assert.deepEqual(rows.map(r=>[r.registerKey,r.scene_ref,r.entity_ref]),[['register:a','scene:a','e:1'],['register:b','scene:b','e:9']]);
 assert.deepEqual(store.projectedSubjectStandings(standings,'wiki:absent'),[]);
});

test('E21: the Library rail lists where a subject stands as jumpable, escaped rows with an honest projection note', ()=>{
 const html=libraryHTML({...base,standing:{subject:SHARED,projection:'unread',rows:[{kind:'scene',title:'Passage <A> · Main',detail:S1,scene_ref:S1,entity_ref:`${E}:entity:a`,view_entity_id:'v-a',subject_ref:SHARED}]}});
 assert.match(html,/data-scope="back-references"/);
 assert.match(html,/Where this stands/);
 assert.match(html,/data-action="jump-standing" data-kind="scene" data-scene="expression:chain:scene:main" data-entity="expression:chain:entity:a" data-view-entity="v-a"/);
 assert.match(html,/Passage &lt;A&gt; · Main/,'the title is escaped');
 assert.match(html,/not read here/,'an unread projection says so; it is never presented as empty');
});

test('E21: an empty back-reference states that nothing carries the subject; no section without a selection', ()=>{
 assert.match(libraryHTML({...base,standing:{subject:'wiki:x',projection:'read',rows:[]}}),/Nothing on stage carries this subject/);
 assert.doesNotMatch(libraryHTML(base),/data-scope="back-references"/);
});
