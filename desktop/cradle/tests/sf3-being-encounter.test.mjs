import test from 'node:test';
import assert from 'node:assert/strict';
import {beingEncounter,invocationStanding} from '../src/explore/being.mjs';

const activity={schema:'oi.activity/v1',activity_ref:'activity:agent:lesson',revision:1,native_owner:'ai-kit',actor_ref:'agent:epii',agent_session_ref:'agent-session/lesson',subject:{kind:'expression',ref:'expression:lesson'},verb:'Refined',semantic_summary:'Proposed a source-bearing relation.',phase:'completed',needs_attention:false,result_refs:['expression:lesson@2'],evidence_refs:['source:lesson@8'],started_at:'2026-09-15T08:00:00Z',updated_at:'2026-09-15T08:01:00Z',provenance:[{kind:'native-reading',ref:'aikit:activity:lesson',source_system:'ai-kit',revision:'1'}]};
const composition={schema:'oi.expression/v1',expression_ref:'expression:lesson',revision:9,title:'Lesson',scenes:[],entities:{},relations:{},selection:{scene_ref:'expression:lesson:scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
const snapshot={schema:'oi.shared-field.snapshot/v1',target:{name:'second-world',uri:'wss://field',database:'acceptance'},status:{healthy:true},fields:[{field_ref:'oi:field:lesson'}],participants:[{schema:'oi.participant/v1',participant_ref:'participant:world-a:epii',field_ref:'oi:field:lesson',identity:{kind:'agent',ref:'agent:epii'},agency:{ref:'agency:epii',source_system:'actuation'},presentation:{chosen_name:'Epii',summary:'A projected pedagogical presence.',presence:'available',address:'@epii',activity,method_refs:['method:epii/pedagogy'],expression_ref:'expression:lesson',expression_revision:9,expression_composition:composition},provenance:{source_system:'ai-kit',source_revision:'r9'}}],relations:[{from:'participant:world-a:epii',to:'expression:lesson',relation:'oi.agent/refined',origin:'projection'}],my_authority:[{field_ref:'oi:field:lesson',participant_ref:'participant:world-b:human',role:'observer',revoked:false}]};

test('a second world reads an Agent Being without acquiring its private session',()=>{
 const being=beingEncounter(snapshot,'participant:world-a:epii');
 assert.equal(being.state,'available');
 assert.equal(being.identity.ref,'agent:epii');
 assert.equal(being.address.to[0].address,'@epii');
 assert.equal(being.activity.activity_ref,'activity:agent:lesson');
 assert.deepEqual(being.methods,['method:epii/pedagogy']);
 assert.deepEqual(being.relations.map(row=>row.other),['expression:lesson']);
 assert.equal(being.expressionComposition,composition);
 assert.equal('agent_session_ref' in being.participant.presentation,false,'the projected profile does not grow a private session binding');
});

test('membership, address and presence do not authorize invocation',()=>{
 const being=beingEncounter(snapshot,'participant:world-a:epii');
 assert.match(invocationStanding(being).reason,/No native Gateway authority/);
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
