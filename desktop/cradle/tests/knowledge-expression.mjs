import assert from 'node:assert/strict';import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});let n=0;
try{const {knowledgeEntityRef,projectionChanges,validateParticipation}=await server.ssrLoadModule('/src/knowledge/expressionProjection.ts');const expression_ref='expression:knowledge-test',scene=`${expression_ref}:scene:main`,node=(ref,revision='r1')=>({node:{ref,kind:'wiki-node',label:ref,native_owner:'central',provenance:{source:'projectcentral.wiki.read',revision},actions:[]},reading:{resource:ref,provider:'semantic-wiki',revision,authority:'owner',evidence:[`source:${ref}`],why_selected:'relation'}});const whole={locus:'wiki:a',members:[node('wiki:a'),node('wiki:b')],edges:[{from:'wiki:a',to:'wiki:b',relation:'linked'}],truncated:false,warnings:[],pinned:[],grammar:{state:'unavailable',detail:'absent'},relationBindingsUnavailable:1};const document={schema:'oi.expression/v1',expression_ref,revision:1,title:'Knowledge',scenes:[{scene_ref:scene,revision:1,title:'Main',entity_refs:['expression:knowledge-test:entity:human']}],entities:{'expression:knowledge-test:entity:human':{entity_ref:'expression:knowledge-test:entity:human',revision:1,title:'Human',subject:null,parameters:{glyph:{value:'H',automation:null}}}},relations:{},selection:{scene_ref:scene,entity_ref:null},provenance:[],representations:[]};const changes=await projectionChanges(document,whole);assert.equal(changes.some(c=>c.change==='entity_remove'&&c.entity_ref.endsWith(':human')),false);n++;assert.equal(changes.filter(c=>c.change==='subject_bind').length,2);n++;const evidenceBinding=changes.find(c=>c.change==='subject_bind').binding;assert.equal(evidenceBinding.sources[0].revision,'revision-unavailable');assert.equal(evidenceBinding.sources[0].availability,'unavailable');n+=2;assert.equal(changes.some(c=>c.change==='relation_bind'),false);n++;assert.notEqual(await knowledgeEntityRef(expression_ref,'wiki:a'),await knowledgeEntityRef(expression_ref,'wiki:b'));n++;const first=await knowledgeEntityRef(expression_ref,'wiki:a');const existing={...document,scenes:[...document.scenes,{scene_ref:`${expression_ref}:scene:knowledge`,revision:2,title:'Knowledge',entity_refs:[first]}],entities:{...document.entities,[first]:{entity_ref:first,revision:2,title:'A',subject:{subject_ref:'wiki:changed',native_owner:'central',presentation_role:'thing',sources:[],readings:[],actions:[]},parameters:{}}}};await assert.rejects(()=>projectionChanges(existing,whole),/changed outside/);n++;const participation={contract:'ql-mef/wiki-participation/v1',participation_ref:'p1',revision:1,form:'pair',members:[{role:'member',canonical_ref:'wiki:a',source_identity:'wiki:wiki:a@r1'},{role:'member',canonical_ref:'wiki:b',source_identity:'wiki:wiki:b@r1'}],provenance:[{source_ref:'wiki:a',source_revision:'r1'},{source_ref:'wiki:b',source_revision:'r1'}]};assert.equal(validateParticipation(participation,whole.members).state,'applied');n++;assert.equal(validateParticipation({...participation,members:[participation.members[0],participation.members[0]]},whole.members).state,'stale');n++;assert.equal(validateParticipation({...participation,provenance:[{source_ref:'wiki:a',source_revision:'old'}]},whole.members).state,'stale');n++;assert.equal(validateParticipation({...participation,members:[{...participation.members[0],source_identity:'wrong@r1'},participation.members[1]]},whole.members).state,'stale');n++;const second=await knowledgeEntityRef(expression_ref,'wiki:b'),bound=member=>({subject_ref:member.node.ref,native_owner:'central',presentation_role:'thing',sources:[{ref:`source:${member.node.ref}`,revision:'r1',availability:'available'}],readings:[{ref:member.node.ref,revision:'r1',availability:'available'}],actions:[]}),manual={...document,scenes:[...document.scenes,{scene_ref:`${expression_ref}:scene:knowledge`,revision:3,title:'Knowledge',entity_refs:[first,second,'expression:knowledge-test:entity:human']}],entities:{...document.entities,[first]:{entity_ref:first,revision:3,title:'A',subject:bound(whole.members[0]),parameters:{x:{value:917,automation:null},glyph:{value:'human-glyph',automation:null}}},[second]:{entity_ref:second,revision:3,title:'B',subject:bound(whole.members[1]),parameters:{x:{value:-411,automation:null}}}},selection:{scene_ref:`${expression_ref}:scene:knowledge`,entity_ref:first}};const retained=await projectionChanges(manual,whole);assert.equal(retained.some(c=>c.change==='parameter_set'),false);assert.equal(retained.some(c=>c.change==='scene_compose'),false);n+=2;
// Exact owner readings, including a relation's identity and independent source
// revision, survive projection; layout cannot manufacture a relation identity.
const sourceReading={ref:'central:source:control:root:Control/agents/wiki/wiki.json',revision:'wiki-r19',availability:'available'};
const ownerRelation={from:'wiki:a',to:'wiki:b',relation:{ref:'wiki:relation:a-b',revision:'relation-r4',availability:'available'},provenance:[sourceReading]};
const disclosed={...whole,members:whole.members.map(member=>({...member,sources:[sourceReading]})),ownerRelations:[ownerRelation]};
const ownerChanges=await projectionChanges(document,disclosed);
assert.deepEqual(ownerChanges.find(change=>change.change==='subject_bind').binding.sources,[sourceReading]);n++;
const relation=ownerChanges.find(change=>change.change==='relation_bind').binding;
assert.deepEqual(relation.relation,ownerRelation.relation);assert.deepEqual(relation.provenance,[sourceReading]);n+=2;
const withRelation={...manual,relations:{[relation.binding_ref]:relation}};
const revised=await projectionChanges(withRelation,{...disclosed,ownerRelations:[{...ownerRelation,relation:{...ownerRelation.relation,revision:'relation-r5'}}]});
assert.equal(revised.find(change=>change.change==='relation_bind').binding.binding_ref,relation.binding_ref);
assert.equal(revised.find(change=>change.change==='relation_bind').binding.relation.revision,'relation-r5');n+=2;
const removed=await projectionChanges(withRelation,{...whole,members:[whole.members[0]],edges:[]});
assert.ok(removed.findIndex(change=>change.change==='relation_remove')<removed.findIndex(change=>change.change==='entity_remove'));n++;
await assert.rejects(()=>projectionChanges(document,{...disclosed,ownerRelations:[ownerRelation,ownerRelation]}),/not unique/);n++;

// F07: a bounded render window never deletes what it did not see. 25 known
// members are already projected; a truncated 10-member window plus one newly
// disclosed member must add the new one, keep all 25, and remove nothing.
const bigRef='expression:knowledge-big';
const bigScene=`${bigRef}:scene:knowledge`;
const bigNodes=Array.from({length:25},(_,i)=>node(`wiki:big-${i}`));
const bigIds=await Promise.all(bigNodes.map(m=>knowledgeEntityRef(bigRef,m.node.ref)));
const bigEntities={};bigNodes.forEach((m,i)=>{bigEntities[bigIds[i]]={entity_ref:bigIds[i],revision:1,title:m.node.label,subject:{subject_ref:m.node.ref,native_owner:'central',presentation_role:'thing',sources:[],readings:[],actions:[]},parameters:{glyph:{value:'○',automation:null},x:{value:i*10,automation:null}}};});
const bigDoc={schema:'oi.expression/v1',expression_ref:bigRef,revision:1,title:'Knowledge',scenes:[{scene_ref:bigScene,revision:1,title:'Knowledge',entity_refs:[...bigIds]}],entities:bigEntities,relations:{},selection:{scene_ref:bigScene,entity_ref:null},provenance:[],representations:[]};
const newRef=await knowledgeEntityRef(bigRef,'wiki:big-new');
const truncatedWhole={locus:'wiki:big-0',members:[...bigNodes.slice(0,10),node('wiki:big-new')],edges:[],truncated:true,warnings:[],pinned:[],grammar:{state:'unavailable',detail:'partial'},relationBindingsUnavailable:0};
const partial=await projectionChanges(bigDoc,truncatedWhole);
assert.equal(partial.some(c=>c.change==='entity_remove'),false);n++; // no unseen member deleted
assert.equal(partial.some(c=>c.change==='entity_add'&&c.entity_ref===newRef),true);n++; // the newly disclosed member is added
const partialCompose=partial.find(c=>c.change==='scene_compose');
assert.ok(partialCompose&&bigIds.every(ref=>partialCompose.entity_refs.includes(ref))&&partialCompose.entity_refs.includes(newRef));n++; // all 25 kept, new one appended

// F07: an authoritative complete reading still removes a genuinely dropped member.
const completeWhole={locus:'wiki:big-0',members:bigNodes.slice(0,10),edges:[],truncated:false,warnings:[],pinned:[],grammar:{state:'unavailable',detail:'complete'},relationBindingsUnavailable:0};
const pruned=await projectionChanges(bigDoc,completeWhole);
assert.equal(pruned.filter(c=>c.change==='entity_remove').length,15);n++; // wiki:big-10..24 removed on a complete diff

// F08: create only on the owner's explicit absence. Inspect through a bridge
// transport with a stubbed kernel: an explicit not-open creates once; a denied
// inspect surfaces unchanged and never creates.
const {projectProvidedLocalWhole}=await server.ssrLoadModule('/src/knowledge/expressionProjection.ts');
const bridge={kind:'bridge',url:'http://kernel-test'};
const soloWhole={locus:'wiki:solo',members:[node('wiki:solo')],edges:[],truncated:false,warnings:[],pinned:[],grammar:{state:'unavailable',detail:'x'},relationBindingsUnavailable:0};
const withStub=async(handler,fn)=>{const old=globalThis.fetch;const ops=[];globalThis.fetch=async(_url,init)=>{const op=JSON.parse(init.body);ops.push(op.request.operation);return {ok:true,json:async()=>handler(op)};};try{return {result:await fn(),ops};}finally{globalThis.fetch=old;}};
const doc=ref=>({schema:'oi.expression/v1',expression_ref:ref,revision:1,title:'Knowledge',scenes:[],entities:{},relations:{},selection:{scene_ref:'',entity_ref:null},provenance:[],representations:[]});
const absent=await withStub(op=>op.request.operation==='inspect'?{ok:false,error:'Expression is not open'}:{ok:true,outcome:{result:'expression',data:{state:'ready',document:doc(op.request.expression_ref)}}},()=>projectProvidedLocalWhole(bridge,'surface-absent','A',soloWhole));
assert.equal(absent.ops.includes('create'),true);n++; // explicit absence created once
assert.notEqual(absent.result.state,'unavailable');n++;
const denied=await withStub(()=>({ok:false,error:'permission denied for expression'}),()=>projectProvidedLocalWhole(bridge,'surface-denied','B',soloWhole));
assert.equal(denied.result.state,'unavailable');n++;
assert.match(String(denied.result.detail),/permission denied/);n++; // the original error is preserved
assert.equal(denied.ops.includes('create'),false);n++; // a non-absent failure never creates

console.log(`Knowledge Expression: ${n} identity/preservation/grammar/refusal assertions passed`);}finally{await server.close();}
