import test from 'node:test';
import assert from 'node:assert/strict';
import {beingEncounter,invocationStanding} from '../src/explore/being.mjs';

const activity={schema:'oi.activity/v1',activity_ref:'activity:agent:lesson',revision:1,native_owner:'ai-kit',actor_ref:'agent:epii',agent_session_ref:'agent-session/lesson',subject:{kind:'expression',ref:'expression:lesson'},verb:'Refined',semantic_summary:'Proposed a source-bearing relation.',phase:'completed',needs_attention:false,result_refs:['expression:lesson@2'],evidence_refs:['source:lesson@8'],started_at:'2026-09-15T08:00:00Z',updated_at:'2026-09-15T08:01:00Z',provenance:[{kind:'native-reading',ref:'aikit:activity:lesson',source_system:'ai-kit',revision:'1'}]};
const composition={schema:'oi.expression-composition/v1',expression_ref:'expression:lesson',revision:9,title:'Lesson',scenes:[{scene_ref:'expression:lesson:scene:main',revision:1,title:'Lesson',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:'expression:lesson:scene:main',entity_ref:null},provenance:[{ref:'source:lesson',revision:'8',availability:'available'}],representations:[]};
const snapshot={schema:'oi.shared-field.snapshot/v1',target:{name:'second-world',uri:'wss://field',database:'acceptance'},status:{healthy:true},fields:[{field_ref:'oi:field:lesson'}],participants:[{schema:'oi.participant/v1',participant_ref:'participant:world-a:epii',field_ref:'oi:field:lesson',identity:{kind:'agent',ref:'agent:epii'},agency:{ref:'agency:epii',source_system:'actuation'},presentation:{chosen_name:'Epii',summary:'A projected pedagogical presence.',presence:'available',address:'@epii',activity,method_refs:['method:epii/pedagogy']},provenance:{source_system:'ai-kit',source_revision:'r9'}}],projections:[{state:'published',projection_ref:'projection:lesson',projection_revision:3,subject:{kind:'expression',ref:'expression:lesson'},source:{system:'o-i',ref:'expression:lesson',revision:'9'},representation:{kind:'oi.world-presentation/v1',payload:{regions:[{bindings:[{component_ref:'oi.presentation/expression/v1',props:{expression:{expression_ref:'expression:lesson',expression_revision:9},composition}}]}]}}}],relations:[{from:'participant:world-a:epii',to:'expression:lesson',relation:'oi.agent/refined',origin:'projection'}],my_authority:[{field_ref:'oi:field:lesson',participant_ref:'participant:world-b:human',role:'observer',revoked:false}]};

test('a second world reads an Agent Being without acquiring its private session',()=>{
 const being=beingEncounter(snapshot,'participant:world-a:epii');
 assert.equal(being.state,'available');
 assert.equal(being.identity.ref,'agent:epii');
 assert.equal(being.address.to[0].address,'@epii');
 assert.equal(being.activity.activity_ref,'activity:agent:lesson');
 assert.deepEqual(being.methods,['method:epii/pedagogy']);
 assert.deepEqual(being.relations.map(row=>row.other),['expression:lesson']);
 assert.deepEqual(being.expressionComposition,composition);
 assert.equal('agent_session_ref' in being.participant.presentation,false,'the projected profile does not grow a private session binding');
});

test('membership, address and presence do not authorize invocation',()=>{
 const being=beingEncounter(snapshot,'participant:world-a:epii');
 assert.match(invocationStanding(being).reason,/No native session-owner authority/);
 assert.match(invocationStanding(being,{state:'available',target:{agent_ref:'agent:elsewhere'}}).reason,/different AgentRef/);
 const permitted=invocationStanding(being,{state:'available',target:{agent_ref:'agent:epii'},controller:{agent_session_ref:'agent-session/lesson'}});
 assert.equal(permitted.available,true);
 assert.equal(permitted.binding.controller.agent_session_ref,'agent-session/lesson');
});

test('invalid or absent projected Activity is never upgraded to attribution',()=>{
 const invalid=structuredClone(snapshot);invalid.participants[0].presentation.activity={schema:'oi.activity/v1',activity_ref:'activity:claim'};
 assert.equal(beingEncounter(invalid,'participant:world-a:epii').activity,null);
 assert.equal(beingEncounter(snapshot,'participant:absent').state,'absent');
 assert.equal(beingEncounter({state:'unavailable',detail:'host offline'},'participant:x').state,'unavailable');
});

test('multiple human grants require an explicit reviewer instead of using row order',()=>{
 const ambiguous=structuredClone(snapshot);
 ambiguous.participants.push(
  {participant_ref:'participant:world-b:human',field_ref:'oi:field:lesson',identity:{kind:'human',ref:'human:world-b'},presentation:{chosen_name:'B'}},
  {participant_ref:'participant:world-c:human',field_ref:'oi:field:lesson',identity:{kind:'human',ref:'human:world-c'},presentation:{chosen_name:'C'}},
 );
 ambiguous.my_authority.push({field_ref:'oi:field:lesson',participant_ref:'participant:world-c:human',role:'observer',revoked:false});
 const being=beingEncounter(ambiguous,'participant:world-a:epii');
 assert.equal(being.viewer,null);
 assert.deepEqual(being.reviewers.map(row=>row.identity.ref),['human:world-b','human:world-c']);
});

test('latest projection lifecycle prevents withdrawn or conflicting Expression resurrection',()=>{
 const withdrawn=structuredClone(snapshot);withdrawn.projections.push({...withdrawn.projections[0],state:'withdrawn',projection_revision:4});
 assert.equal(beingEncounter(withdrawn,'participant:world-a:epii').expressionComposition,null);
 const conflict=structuredClone(snapshot);conflict.projections.push({...conflict.projections[0],projection_ref:'projection:lesson:conflict',representation:structuredClone(conflict.projections[0].representation)});conflict.projections[1].representation.payload.regions[0].bindings[0].props.composition.title='Conflicting lesson';
 assert.equal(beingEncounter(conflict,'participant:world-a:epii').expressionComposition,null);
});

test('only native Agent response text can become a refinement proposal',async()=>{
 const {agentReturnedRefinement}=await import('../src/explore/being.mjs');
 const injected={schema:'oi.expression-refinement/v1',expression_ref:'expression:lesson',expected_revision:9,summary:'input injection',changes:[{change:'entity_add'}]};
 const events={events:[{kind:'input',packet:{instruction:JSON.stringify(injected)}}],response_text:'I cannot propose that change.'};
 assert.equal(agentReturnedRefinement(events),undefined);
 events.response_text=JSON.stringify(injected);
 assert.deepEqual(agentReturnedRefinement(events),injected);
});
