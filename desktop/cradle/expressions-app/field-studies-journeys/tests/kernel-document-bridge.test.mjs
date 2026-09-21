import test from 'node:test';
import assert from 'node:assert/strict';
import {kernelDocumentToJourney,kernelViewToChanges} from '../build/kernelDocumentBridge.js';
import {validateJourney,clone} from '../build/model.js';
import {toNativeConfig,checkNativeLimits} from '../build/nativeBridge.js';

const E='expression:ordinary',S=E+':scene:main';
const read=(ref)=>({ref,revision:'source-r4',availability:'available'});
function document(count=2){
 const entities=Object.fromEntries(Array.from({length:count},(_,i)=>{
  const ref=`${E}:entity:m${i}`;
  return [ref,{entity_ref:ref,title:`Passage ${i}`,subject:{subject_ref:'wiki:shared-source',native_owner:'ai-kit',sources:[{source_ref:'central:note',revision:'r4',selector:{kind:'text_quote',exact:'different exact passage '+i}}]},parameters:{glyph:{value:String.fromCharCode(65+i%26)},x:{value:(i%5)*110-220},y:{value:Math.floor(i/5)*120},z:{value:i===1?60:0}}}];
 }));
 const refs=Object.keys(entities);
 const rel=(id)=>({binding_ref:`${E}:relation:${id}`,native_owner:'ai-kit',relation:read('wiki:edge:'+id),from_entity_ref:refs[0],to_entity_ref:refs[1],provenance:[read('wiki:assertion:'+id)]});
 return {schema:'oi.expression/v1',expression_ref:E,revision:3,title:'Ordinary linked notes',entities,scenes:[{scene_ref:S,title:'Main',revision:1,entity_refs:refs,body:{carrier:'text_source',subject_ref:'central:note',native_owner:'Central',reading:read('central:note'),presentation:'inline',capability:{state:'renderable'},span:{start:2,end:40},actions:[]},triggers:[{trigger_ref:'declared:portal'}]}],relations:count>1?{[E+':relation:a']:rel('a'),[E+':relation:b']:rel('b')}:{},selection:{scene_ref:S,entity_ref:refs[0]??null},provenance:[read('wiki:whole')],profiles:[{profile_ref:'profile:quiet',revision:2}],refinements:[{proposal_ref:'proposal:unapplied'}],representations:[],collections:['world:local']};
}
test('actual app adapter retains the complete native document, body and independent sourced relations',()=>{
 const input=document(),before=clone(input),view=kernelDocumentToJourney(input),binding=view.bindings[view.startSceneId];
 assert.deepEqual(view.document,before);assert.deepEqual(input,before);
 assert.deepEqual(binding.body,before.scenes[0].body);assert.deepEqual(binding.triggers,before.scenes[0].triggers);
 assert.equal(binding.relations.length,2);assert.notEqual(binding.relations[0].relation.ref,binding.relations[1].relation.ref);
 assert.equal(binding.occurrences[0].subject.subject_ref,'wiki:shared-source');
 assert.notDeepEqual(binding.occurrences[0].subject.sources,binding.occurrences[1].subject.sources);
 assert.deepEqual(validateJourney(view.journey),view.journey);
 view.bindings[view.startSceneId].body.span.start=7;assert.equal(input.scenes[0].body.span.start,2);
});
test('the SAME subject in two Scenes retains exact scene/member occurrences',()=>{
 const input=document();input.scenes.push({...clone(input.scenes[0]),scene_ref:E+':scene:other',title:'Other'});
 input.selection={scene_ref:input.scenes[1].scene_ref,entity_ref:Object.keys(input.entities)[1]};
 const view=kernelDocumentToJourney(input);
 assert.equal(view.bindings[view.startSceneId].scene_ref,E+':scene:other');
 const occurrences=Object.values(view.bindings).flatMap(b=>b.occurrences);
 assert.equal(occurrences.length,4);assert.equal(new Set(occurrences.map(o=>o.scene_ref+'\0'+o.entity_ref)).size,4);
 for(const binding of Object.values(view.bindings))assert.equal(binding.relations.length,2);
});
test('27-member whole survives page changes and native render budget checks',()=>{
 const input=document(27),before=clone(input),view=kernelDocumentToJourney(input);
 assert.equal(view.bindings[view.startSceneId].member_refs.length,27);
 assert.equal(view.journey.scenes[0].entities.length,10);
 assert.equal(view.bindings[view.startSceneId].page_count,3);
 assert.doesNotThrow(()=>checkNativeLimits(view.journey.scenes[0]));
 const next=kernelDocumentToJourney(input,{pages:{[S]:2}});
 assert.equal(next.journey.id,view.journey.id);assert.equal(next.startSceneId,view.startSceneId);
 assert.equal(next.journey.scenes[0].entities.length,7);assert.deepEqual(input,before);
 assert.deepEqual(next.document,view.document);assert.deepEqual(kernelViewToChanges(next,next.journey),[]);
 assert.throws(()=>kernelDocumentToJourney(input,{pages:{[S]:3}}),/page/);
});
test('a relation across ordinary pages brings BOTH exact endpoints into one focus window',()=>{
 const input=document(27),r=input.relations[E+':relation:a'];r.to_entity_ref=E+':entity:m24';
 input.selection={scene_ref:S,entity_ref:null,relation_ref:r.binding_ref};
 const view=kernelDocumentToJourney(input),binding=view.bindings[view.startSceneId];
 assert.equal(binding.focused_relation,r.binding_ref);
 for(const ref of [r.from_entity_ref,r.to_entity_ref])assert.ok(binding.loaded_refs.includes(ref));
 assert.doesNotThrow(()=>checkNativeLimits(view.journey.scenes[0]));
 assert.equal(binding.member_refs.length,27);
});
test('primitive, pin, image, ASCII, 3D and forces reach the EXISTING native engine adapter',()=>{
 const input=document(5),entities=Object.values(input.entities);
 Object.assign(entities[0].parameters,{shape:{value:'triangle'},width:{value:320},height:{value:200},rotation:{value:Math.PI/4},force_mode:{value:'vortex'},force_strength:{value:1.2},force_spin:{value:.5},force_radius:{value:160}});
 entities[1].parameters.ascii={value:'0 / 1\n  /'};
 entities[2].parameters.image={value:'data:image/png;base64,iVBORw0KGgo='};
 entities[3].parameters.kind={value:'pin'};
 entities[4].parameters.glyph={value:'x'.repeat(128)};
 const view=kernelDocumentToJourney(input),config=toNativeConfig(view.journey.scenes[0]);
 assert.equal(config.entities.length,5);
 assert.equal(config.entities[0].shape.primitive,'triangle');assert.equal(config.entities[0].extent.width,320);
 assert.equal(config.entities[0].forces.mode,'vortex');assert.equal(config.entities[0].forces.radius,160);
 assert.equal(config.entities[1].authoringSource.ascii.text,'0 / 1\n  /');assert.equal(config.entities[1].z,60);
 assert.equal(config.entities[2].authoringSource.image.dataUrl,entities[2].parameters.image.value);
 assert.equal(config.entities[3].kind,'pin');assert.equal(config.entities[4].authoringSource.ascii.text.length,128);
});
test('eight pins and ten formations are rendering budgets, not semantic membership limits',()=>{
 const input=document(30);Object.values(input.entities).slice(0,12).forEach(e=>{e.parameters.kind={value:'pin'};});
 const visited=new Set();
 for(let page=0;page<3;page++){
  const view=kernelDocumentToJourney(input,{pages:{[S]:page}}),binding=view.bindings[view.startSceneId];
  assert.doesNotThrow(()=>checkNativeLimits(view.journey.scenes[0]));binding.loaded_refs.forEach(r=>visited.add(r));
 }
 assert.equal(visited.size,30);
});
test('invalid identities, orphan endpoints and missing members fail instead of inventing placeholders',()=>{
 const missing=document();missing.scenes[0].entity_refs.push('not:defined');assert.throws(()=>kernelDocumentToJourney(missing),/unresolved/);
 const duplicate=document();duplicate.scenes[0].entity_refs.push(duplicate.scenes[0].entity_refs[0]);assert.throws(()=>kernelDocumentToJourney(duplicate),/duplicate/);
 const edge=document();edge.relations[E+':relation:a'].to_entity_ref='not:defined';assert.throws(()=>kernelDocumentToJourney(edge),/endpoints/);
 const drift=document();drift.entities[E+':entity:m0'].entity_ref='different';assert.throws(()=>kernelDocumentToJourney(drift),/identity/);
 const poison=JSON.parse('{"schema":"oi.expression/v1","__proto__":{"polluted":true}}');assert.throws(()=>kernelDocumentToJourney(poison),/Unsafe/);
});
test('folded view IDs stay valid and stable across revisions without changing native identity',()=>{
 const input=document(1),ref=E+':'+('long:'.repeat(50));input.entities[ref]={...input.entities[E+':entity:m0'],entity_ref:ref};delete input.entities[E+':entity:m0'];input.scenes[0].entity_refs=[ref];input.expression_ref='expression:'+('whole:'.repeat(30));
 const one=kernelDocumentToJourney(input);input.revision++;const two=kernelDocumentToJourney(input);
 assert.doesNotThrow(()=>validateJourney(one.journey));assert.equal(one.journey.id,two.journey.id);
 assert.equal(one.journey.scenes[0].entities[0].id,two.journey.scenes[0].entities[0].id);
 assert.equal(one.bindings[one.startSceneId].occurrences[0].entity_ref,ref);
});
test('material edits return exact native refs and leave hidden members and all semantic metadata alone',()=>{
 const input=document(20),view=kernelDocumentToJourney(input),edited=clone(view.journey);
 edited.scenes[0].entities[0].position.x=.25;
 assert.deepEqual(kernelViewToChanges(view,edited),[{change:'parameter_set',entity_ref:E+':entity:m0',parameter:'x',value:100}]);
 assert.equal(view.document.scenes[0].entity_refs.length,20);assert.deepEqual(view.document,input);
 edited.scenes[0].entities.pop();assert.throws(()=>kernelViewToChanges(view,edited),/hide is not delete/);
});
test('independent occurrences cannot silently overwrite one another or native automation',()=>{
 const input=document();input.scenes.push({...clone(input.scenes[0]),scene_ref:E+':scene:other'});
 const view=kernelDocumentToJourney(input),edited=clone(view.journey);edited.scenes[0].entities[0].position.x=.1;edited.scenes[1].entities[0].position.x=.2;
 assert.throws(()=>kernelViewToChanges(view,edited),/conflicting/);
 input.entities[E+':entity:m0'].parameters.x.automation={min:-100,max:100,rate_hz:1,waveform:'sine'};
 const automated=kernelDocumentToJourney(input),changed=clone(automated.journey);changed.scenes[0].entities[0].position.x=.5;
 assert.throws(()=>kernelViewToChanges(automated,changed),/automation/);
});
