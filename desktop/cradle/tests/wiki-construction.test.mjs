import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedPassage, revalidatePassage, passageProvenance} from '../src/knowledge/selection.ts';
import {sourceSlice} from '../src/knowledge/wikiDocument.ts';
import {draftRequest, emptyDraft, withPassage, withForm, withoutMember, fromNative} from '../src/knowledge/constructionDraft.ts';
import {CONSTRUCTION, PARTICIPATION, RELATION, decodeRegister, readAuthoringForms, sourceBases, saveConstruction} from '../src/knowledge/construction.ts';
import {constructionWhole} from '../src/knowledge/constructionProjection.ts';
import {projectionChanges, knowledgeEntityRef} from '../src/knowledge/expressionProjection.ts';

const corpus=JSON.parse(readFileSync(new URL('./fixtures/wiki-native.json',import.meta.url)));
const reading=corpus['source:a'];
const bytes=new TextEncoder().encode(reading.content);
const start=new TextEncoder().encode(reading.content.slice(0,reading.content.indexOf('🌱'))).length;
const select=(a=start,b=start+4,text='🌱')=>selectedPassage(reading,{revision:reading.revision,start_byte:a,end_byte:b},text,'Alpha');
const transport={kind:'bridge',url:'http://controlled.invalid'};
const form={id:'ql:authoring:twofold',label:'Twofold',shape_ref:'ql:shape:1.0.0:constellation:twofold',contract_ref:'ql.shape@1.0.0',roles:[{role_ref:'role:0',label:'0',address:{position:0,layout:{x:-1,y:0,z:0}}},{role_ref:'role:1',label:'1',address:{position:1,layout:{x:1,y:0,z:.2}}}],provenance:[],standing:'proposed'};
function native(draft,version=1){
 const frame={object:'frame',ref:draft.frame_ref,revision:version,constellations:[{anchor_ref:draft.anchor_ref,members:draft.members.map(m=>({ref:m.subject_ref,[PARTICIPATION]:{participation_ref:m.participation_ref,role_ref:m.role_ref,sources:m.sources,note:m.label}})),returns:[]}],[CONSTRUCTION]:{title:draft.title,inquiry:{question:draft.question},frame:draft.form,compositions:[]}};
 const relations=draft.relations.map(e=>({object:'edge',ref:e.ref,revision:e.revision??1,from_ref:draft.members.find(m=>m.participation_ref===e.from).subject_ref,to_ref:draft.members.find(m=>m.participation_ref===e.to).subject_ref,relation:e.relation,[RELATION]:{from_participation_ref:e.from,to_participation_ref:e.to,direction:e.direction,standing:e.standing,evidence:e.evidence}}));
 return {frame,relations};
}
function fullDraft(){
 let draft={...emptyDraft('wiki:space'),title:'Inquiry',question:'How do these readings relate?'};
 draft=withForm(withPassage(withPassage(draft,select()),select(start+5,start+7,'[[')),form);
 draft.members=draft.members.map((m,i)=>({...m,role_ref:form.roles[i].role_ref}));
 draft.relations=[{ref:'wiki:relation:one',from:draft.members[0].participation_ref,to:draft.members[1].participation_ref,relation:'qualifies',direction:'directed',standing:'proposed',evidence:[]}];
 return draft;
}

test('passage intake preserves original Unicode bytes, exact revision and rendered quote separately',()=>{
 const passage=select();
 assert.equal(passage.source_text,'🌱');
 assert.equal(passage.selector.end_byte-passage.selector.start_byte,4);
 assert.equal(passage.source_ref,reading.resource);
 assert.throws(()=>select(start,start+2),/encoded|encoding/i);
 assert.throws(()=>selectedPassage(reading,{revision:'older',start_byte:start,end_byte:start+4},'🌱','Alpha'),/revision/);
 const evidence=passageProvenance(passage)['aikit.techne-facet/v1'].selector;
 assert.equal(evidence.unit,'other');assert.equal(evidence.kind,'markdown-utf8-span');
 assert.deepEqual(JSON.parse(evidence.value),{start_byte:start,end_byte:start+4,quote:'🌱'});
 assert.equal(sourceSlice(reading.content,start,start+4),'🌱');
});

test('ordinary sources and empty chosen frames both produce native creation, never file rewriting',()=>{
 const empty={...emptyDraft('wiki:space'),title:'Frame first',question:'What belongs here?'};
 const request=draftRequest(withForm(empty,form));
 assert.equal(request.expected_revision,0);
 assert.equal(request.changes[0].change,'create');
 assert.equal(request.changes[0].frame.roles.length,2);
 assert.equal(request.changes[0].frame.id,undefined,'catalogue UI fields do not leak into strict native shape');
 assert.equal(request.changes.length,1,'open positions are not invented members');
 const ordinary=draftRequest(withPassage(empty,select()));
 assert.equal(ordinary.changes[0].frame,null);
 assert.equal(ordinary.changes[1].member.subject_ref,reading.resource);
 assert.equal('content' in ordinary,false);
});

test('two passages in one source are distinct contextual participants and survive native decoding',()=>{
 const draft=fullDraft(),request=draftRequest(draft);
 const additions=request.changes.filter(c=>c.change==='member_add');
 assert.equal(additions.length,2);
 assert.equal(additions[0].member.subject_ref,additions[1].member.subject_ref);
 assert.notEqual(additions[0].member.participation.participation_ref,additions[1].member.participation.participation_ref);
 const result=native(draft);
 const register=decodeRegister({content:JSON.stringify({objects:[result.frame,...result.relations]}),revision:'file-r1'},'source:register');
 const reopened=fromNative(register.frames[0],register.relations);
 assert.equal(reopened.members.length,2);
 assert.equal(reopened.relations[0].relation,'qualifies');
 assert.throws(()=>draftRequest(reopened),/already matches/);
});

test('membership removal retracts native connections first; role edits keep other membership identity',()=>{
 const {frame,relations}=native(fullDraft());
 const reopened=fromNative(frame,relations),removed=withoutMember(reopened,reopened.members[0].participation_ref);
 assert.deepEqual(draftRequest(removed).changes.map(c=>c.change),['relation_retract','member_remove']);
 const changed={...reopened,members:reopened.members.map((m,i)=>i?m:{...m,role_ref:null})};
 const request=draftRequest(changed);
 assert.deepEqual(request.changes,[{change:'role_set',participation_ref:reopened.members[0].participation_ref,role_ref:null}]);
 assert.equal(request.expected_revision,1);
 assert.throws(()=>draftRequest({...changed,basis:{...frame,read_only:true}}),/read-only/);
});

test('different revisions of the same source cannot be silently combined in an action',()=>{
 const request=draftRequest(fullDraft());
 assert.equal(sourceBases(request).length,1);
 request.changes.push({evidence:{source_ref:reading.resource,source_revision:'changed'}});
 assert.throws(()=>sourceBases(request),/mixes revisions/);
 assert.deepEqual(readAuthoringForms({schema:'old',forms:[form]}),[]);
 assert.equal(readAuthoringForms({schema:'aikit.ql-authoring-forms/v1',forms:[form,{...form,roles:[{}]}]}).length,1);
});

test('a source revision change refuses before invoking native save and never replays a write',async()=>{
 const original=globalThis.fetch;let writes=0;
 globalThis.fetch=async(_url,options)=>{
  const op=JSON.parse(options.body);if(op.op==='invoke_action')writes++;
  return {json:async()=>({ok:true,outcome:{result:'knowledge',data:{...reading,revision:'r2'}}})};
 };
 try{await assert.rejects(saveConstruction(transport,undefined,{file:{revision:'file-r1'}},draftRequest(fullDraft()),[select()]),/Source changed/);assert.equal(writes,0);}
 finally{globalThis.fetch=original;}
});

test('fresh projection preserves two source occurrences, native edge identity, role positions and human layout',async()=>{
 const {frame,relations}=native(fullDraft()),original=globalThis.fetch;let reads=0;
 globalThis.fetch=async()=>{reads++;return {json:async()=>({ok:true,outcome:{result:'knowledge',data:reading}})};};
 try{
  const whole=await constructionWhole(transport,undefined,frame,relations);
  assert.equal(reads,1,'one source read can serve two contextual occurrences');
  assert.equal(whole.members.length,2);
  assert.notEqual(whole.members[0].node.ref,whole.members[1].node.ref);
  assert.equal(whole.members[0].node.subject_ref,whole.members[1].node.subject_ref);
  assert.equal(whole.members[0].initialPosition.x,-110);
  const document={schema:'oi.expression/v1',expression_ref:'expression:test',revision:1,entities:{},relations:{},scenes:[],selection:{scene_ref:'none',entity_ref:null}};
  const changes=await projectionChanges(document,whole);
  const bindings=changes.filter(c=>c.change==='subject_bind');
  assert.equal(bindings.length,2);assert.equal(bindings[0].binding.subject_ref,reading.resource);
  assert.ok(bindings[0].binding.readings.some(r=>r.ref===frame.ref));
  const edges=changes.filter(c=>c.change==='relation_bind');
  assert.equal(edges.length,1);assert.equal(edges[0].binding.relation.ref,'wiki:relation:one');
  assert.notEqual(edges[0].binding.from_entity_ref,edges[0].binding.to_entity_ref);
  const id=await knowledgeEntityRef(document.expression_ref,whole.members[0].node.ref);
  document.entities[id]={entity_ref:id,subject:bindings[0].binding,parameters:{x:{value:876}}};
  const again=await projectionChanges(document,whole);
  assert.equal(again.filter(c=>c.change==='parameter_set'&&c.entity_ref===id).length,0,'reprojection must not reset an edited occurrence pose');
 }finally{globalThis.fetch=original;}
});

test('checkpoint recovery rejects malformed roles, duplicate participation and wrong pending target', async()=>{
  const {restoreConstructionCheckpoint,memberAnchor}=await import('../src/knowledge/constructionCheckpoint.ts');
  const draft=withPassage(emptyDraft('wiki:space'),select());
  const checkpoint={draft,saved:false};
  assert.equal(restoreConstructionCheckpoint(checkpoint).draft.frame_ref,draft.frame_ref);
  for(const bad of [
    {draft:{...draft,form:{shape_ref:'shape',roles:'not a list'}}},
    {draft:{...draft,members:[draft.members[0],draft.members[0]]}},
    {draft,pending:{schema:'aikit.constellation-action/v1',frame_ref:'wrong',operation_ref:'op',actor_ref:'human:a',expected_revision:0,changes:[]}},
  ])assert.throws(()=>restoreConstructionCheckpoint(bad));
  const held=draft.members[0];
  const restored={...held,passage:undefined};
  assert.deepEqual(memberAnchor(restored),{revision:held.passage.source_revision,...held.passage.selector});
});

test('a retained relation is reconnected before its former member is removed, preserving temporal evidence',()=>{
  let draft=withPassage(emptyDraft('wiki:space'),select());
  const a=draft.members[0];
  const b={...a,participation_ref:'part:b'},c={...a,participation_ref:'part:c'};
  const frame={ref:draft.frame_ref,revision:1,constellations:[{anchor_ref:draft.anchor_ref,members:[a,b,c].map(m=>({ref:m.subject_ref,[PARTICIPATION]:{participation_ref:m.participation_ref,role_ref:null,sources:m.sources}}))}],
    [CONSTRUCTION]:{title:'Whole',inquiry:{question:'Why?'}}};
  const temporal=[{kind:'date',value:'2026-09-21'}];
  const edge={ref:'edge:relation',revision:3,relation:'qualifies',from_ref:a.subject_ref,to_ref:a.subject_ref,[RELATION]:{from_participation_ref:a.participation_ref,to_participation_ref:b.participation_ref,direction:'directed',standing:'proposed',evidence:[],temporal}};
  draft=fromNative(frame,[edge]);draft.relations[0].from=c.participation_ref;
  draft=withoutMember(draft,a.participation_ref);
  const request=draftRequest(draft);
  assert.ok(request.changes.findIndex(c=>c.change==='relation_put')<request.changes.findIndex(c=>c.change==='member_remove'));
  assert.deepEqual(request.changes.find(c=>c.change==='relation_put').relation.temporal,temporal);
});
