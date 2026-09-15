import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createNaraPresenceConsent,hostedNaraExpressionArgs,isNaraBoundExpression,isNaraCueExpression,projectNaraExpression,withdrawNaraProjection} from './nara-expression-projection.mjs';
import {expressionPublicationPayloads,expressionPublicationLeaks} from './expression-projection.mjs';

const snapshotPath=process.env.QL_NARA_SNAPSHOT;
const portable=snapshotPath&&existsSync(snapshotPath)?JSON.parse(readFileSync(snapshotPath,'utf8')).nara_expression.portable:{centre_locus_refs:Array.from({length:7},(_,i)=>`ql:nara:fixture:occasion:centre:${i}`),earth_body_locus_ref:'ql:nara:fixture:occasion:earth-body',source_refs:Array.from({length:8},(_,i)=>`source:fixture-k8:locus-${i}@r1`),cue_refs:['ql:nara:focus:m4']};
function document(){
 const expression_ref='expression:sf5:nara',scene_ref=`${expression_ref}:scene:main`,loci=[...portable.centre_locus_refs,portable.earth_body_locus_ref];
 return {schema:'oi.expression/v1',expression_ref,revision:1,title:'Nara · safe cues',scenes:[{scene_ref,revision:1,title:'Seven centres and EarthBody',entity_refs:loci.map((_,i)=>`${expression_ref}:entity:${i}`)}],entities:Object.fromEntries(loci.map((ref,i)=>[`${expression_ref}:entity:${i}`,{entity_ref:`${expression_ref}:entity:${i}`,revision:1,title:i===7?'EarthBody':`Centre ${i+1}`,subject:{subject_ref:ref,native_owner:'ql',presentation_role:'thing',sources:[],readings:[],actions:[]},parameters:{glyph:{value:i===7?'⊕':String(i+1),automation:null},x:{value:0,automation:null},y:{value:i===7?-376:-264+i*88,automation:null},scale:{value:1,automation:null}}}])),relations:{},selection:{scene_ref,entity_ref:null},provenance:[...portable.source_refs,...portable.cue_refs].map(ref=>({ref,revision:'unavailable',availability:'unavailable'})),representations:[],refinements:[]};
}
const publisher='participant:oi-field-expression-sf5-nara:human-owner',target='participant:world-b';
const consent=(suffix='1')=>createNaraPresenceConsent({consent_ref:`consent:sf5:${suffix}`,participant_ref:publisher,expression_ref:'expression:sf5:nara',target_ref:target,target_identity_ref:'human:world-b',granted_at:`2026-09-15T12:00:0${suffix}Z`,source_refs:portable.source_refs});
const input=(grant=consent(),doc=document())=>({document:doc,consent:grant,selection:{disclose_sources:'available',include_source_refs:['personal:PRIVATE_SENTINEL']},publisher:{identity_ref:'human:owner'},audience:{visibility:'restricted',refs:[target]},world_ref:'world:owner',field_ref:'oi:field:expression-sf5-nara',projection_ref:'projection:sf5:nara',presentation_ref:'presentation:sf5:nara',published_at:'2026-09-15T12:01:00Z'});

test('portable loci become one safe WorldPresentation with actual Participant endpoints',()=>{
 const bundle=projectNaraExpression(input());assert.equal(isNaraCueExpression(document()),true);assert.equal(Object.keys(bundle.composition.entities).length,8);
 assert.equal(new Set(Object.values(bundle.composition.entities).map(e=>e.subject.subject_ref)).size,8);
 assert.deepEqual(bundle.projection.relation_hints,[{kind:'consented-presence',from:publisher,to:target,expression_ref:'expression:sf5:nara',consent_ref:'consent:sf5:1'}]);
 const hosted=hostedNaraExpressionArgs(bundle);assert.deepEqual(hosted.putExploreRelations,[]);assert.equal(hosted.putParticipants[0].participantRef,target);assert.equal(hosted.putParticipants[0].identityRef,'human:world-b');
});
test('strict Nara admission refuses mixed bases, duplicate centres and allowed-looking private material',()=>{
 for(const mutate of [d=>{d.title='Renamed unsafe document';},d=>{d.entities[Object.keys(d.entities)[1]].subject.subject_ref=d.entities[Object.keys(d.entities)[0]].subject.subject_ref;},d=>{d.entities[Object.keys(d.entities)[1]].subject.subject_ref='ql:nara:other:occasion:centre:1';},d=>{d.entities[Object.keys(d.entities)[0]].title='PRIVATE_JOURNAL_BODY';},d=>{d.entities[Object.keys(d.entities)[0]].parameters.resonance={value:0.77,automation:null};},d=>{d.entities[Object.keys(d.entities)[0]].parameters.glyph.automation={source_ref:'source:private-journal@r1',value:0.77};},d=>{d.entities[Object.keys(d.entities)[0]].parameters.glyph.private_scalar=0.77;},d=>{d.provenance[0].ref='source:private-journal@r1';}]){const d=document();mutate(d);assert.equal(isNaraBoundExpression(d),true,'hostile Nara specimen remains routed to protected publication');assert.equal(isNaraCueExpression(d),false);assert.throws(()=>projectNaraExpression(input(consent(),d)));}
});
test('private sentinels are absent across payload, embedded JSON, index, fallback and relation reading',()=>{
 const bundle=projectNaraExpression(input()),payloads=expressionPublicationPayloads(bundle),hosted=hostedNaraExpressionArgs(bundle),{omissions:_local,...outward}=bundle,serialized=JSON.stringify({outward,payloads,hosted});
 for(const sentinel of ['PRIVATE_JOURNAL_BODY','PRIVATE_BIOQUATERNION','PRIVATE_RENDERER_STATE','PRIVATE_PERSONAL_PACKET','personal:PRIVATE_SENTINEL'])assert.equal(serialized.includes(sentinel),false,sentinel);
 assert.equal(payloads.fallback_html.includes('PRIVATE_'),false);assert.equal(hosted.putExploreEntries[0].entryJson.includes('PRIVATE_'),false);
 assert.deepEqual(expressionPublicationLeaks(bundle,['PRIVATE_JOURNAL_BODY','PRIVATE_BIOQUATERNION','PRIVATE_RENDERER_STATE','PRIVATE_PERSONAL_PACKET']),[]);
 for(const ref of portable.source_refs)assert.ok(JSON.stringify(bundle).includes(ref));assert.ok(JSON.stringify(bundle).includes(portable.cue_refs[0]));
});
test('withdrawal expires the current relation; re-entry needs a new grant at stable refs',()=>{
 assert.throws(()=>projectNaraExpression(input({...consent(),target_ref:'participant:other'})),/target/);
 const first=projectNaraExpression(input()),withdrawn=withdrawNaraProjection(first,consent(),{withdrawn_at:'2026-09-15T12:02:00Z',withdrawal_ref:'withdrawal:sf5:1'});
 assert.equal(withdrawn.projection.state,'withdrawn');assert.equal(withdrawn.projection.projection_revision,2);assert.equal(withdrawn.projection.relation_hints,undefined);
 assert.throws(()=>hostedNaraExpressionArgs({...first,nara_presence:{...first.nara_presence,consent:withdrawn.consent}}),/Withdrawn/);
 assert.throws(()=>projectNaraExpression(input(withdrawn.consent)),/Current explicit/);
 const reentered=projectNaraExpression({...input(consent('3')),projection_revision:3,published_at:'2026-09-15T12:03:00Z'});
 assert.equal(reentered.expression_ref,first.expression_ref);assert.equal(reentered.projection.projection_ref,first.projection.projection_ref);assert.equal(reentered.field_ref,first.field_ref);assert.equal(reentered.nara_presence.consent.consent_ref,'consent:sf5:3');
});
