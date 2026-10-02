/** Source-bound publication over independent real transport credentials.
 * Native document arguments must be actual owner readings/exports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {curatedArtifactFromCentralDocument,projectCuratedArtifact,hostedArtifactArgs} from '../curated-html-projection.mjs';
import {createParticipant} from '../index.mjs';
import {close,open,publishArgs,readRef,rows,waitUntil} from './field-lib';
const argv=process.argv.slice(2), flag=(name:string)=>argv[argv.indexOf(name)+1];
for(const name of ['--reading','--export']) if(!argv.includes(name)) throw new Error(name+' requires an actual native document reading');
const target={name:'acceptance',server:'acceptance',uri:process.env.SPACETIMEDB_URI!,database:process.env.SPACETIMEDB_DATABASE!};
if(!target.uri||!/acceptance|(?:^|-)ci(?:-|$)/.test(target.database))throw new Error('Explicit acceptance target required');
const unwrap=(path:string)=>{const value=JSON.parse(readFileSync(path,'utf8'));return value.data??value;};
const artifact=curatedArtifactFromCentralDocument(unwrap(flag('--reading')),unwrap(flag('--export')));
assert.ok(artifact.entries.some((entry:any)=>entry.html.includes('Shared continuation guide')));
const owner=await open(target,'publication-owner'), contributor=await open(target,'publication-contributor');
const run=crypto.randomUUID(), fieldRef='oi:field:publication-membership:'+run, participantRef='participant:publication-membership:'+run;
const input={artifact,selection:{schema:'oi.curated-artifact-selection/v1',artifact_ref:'artifact:guide:'+run,world_ref:'world:controlled:publication:'+run,field_ref:fieldRef,field_title:'Continue the shared guide',projection_ref:'projection:guide:'+run,presentation_ref:'presentation:guide:'+run,title:artifact.title,audience:{visibility:'public'},publisher:{participant_ref:participantRef,identity_ref:'human:controlled:ann',chosen_name:'Ann'},entry_ids:artifact.entries.map((entry:any)=>entry.id),meta_fields:['title']},published_at:new Date().toISOString()};
try {
 const args=hostedArtifactArgs(projectCuratedArtifact(input));
 // The standalone artifact's world relation is indexed by the owning World
 // publication. This bounded test checks material and membership independently.
 args.putExploreRelations=[];
 await publishArgs(owner,args);
 const actual = readRef(owner,args.putExploreEntries[0].semanticRef);
 assert.equal(actual.state,'hosted');
 const ownProjection = actual.projections.find((value:any)=>value.projection_ref===input.selection.projection_ref);
 assert.ok(ownProjection,'the selected qualified artifact reads its own material');
 assert.equal(ownProjection.subject.ref,actual.entry.ref,'the published subject is the canonical world-qualified artifact');
 assert.equal(ownProjection.source.world_ref,actual.entry.world_ref);
 assert.ok(ownProjection.representation.payload.regions.some((region:any)=>region.role==='reading' && region.bindings.some((binding:any)=>binding.props.html.includes('Shared continuation guide'))),'actual native document prose reaches the selected body');
 const member=createParticipant({participant_ref:participantRef+':bea',field_ref:fieldRef,identity:{kind:'human',ref:'human:controlled:bea'},provenance:{source_system:'central',source_revision:artifact.source.revision,source_ref:artifact.source.ref}});
 await owner.conn.reducers.putParticipant({participantRef:member.participant_ref,fieldRef,identityKind:member.identity.kind,identityRef:member.identity.ref,sourceSystem:member.provenance.source_system,sourceRevision:member.provenance.source_revision,contractJson:JSON.stringify(member)});
 await owner.conn.reducers.grantParticipantAuthority({fieldRef,participantRef:member.participant_ref,targetIdentity:contributor.identity,role:'contributor',contactable:false,ttlSeconds:0});
 await waitUntil(()=>rows(contributor.conn.db.myFieldAuthority).some((row)=>row.participantRef===member.participant_ref),'independent contributor authority');
 const fieldBefore=rows(owner.conn.db.sharedField).find(row=>row.fieldRef===fieldRef)!.contractJson;
 const memberBefore=rows(owner.conn.db.participant).find(row=>row.participantRef===member.participant_ref)!.contractJson;
 const other=hostedArtifactArgs(projectCuratedArtifact({...input,selection:{...input.selection,projection_ref:input.selection.projection_ref+':bea',publisher:{participant_ref:member.participant_ref,identity_ref:member.identity.ref,chosen_name:'Bea'}}}));
 other.putExploreEntries=[];other.putExploreRelations=[];
 if(argv.includes('--baseline-client')){
   let refused=false;
   try{execFileSync(flag('--baseline-client'),[],{input:JSON.stringify({kind:'publish',token_label:'publication-contributor',args:other}),env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
   catch(error:any){const result=JSON.parse(error.stdout);assert.equal(result.ok,false);assert.match(result.error.message,/owner/i);refused=true;}
   assert.equal(refused,true,'the prior installed adapter must reproduce the owner rewrite refusal');
 }
 await publishArgs(contributor,other);
 assert.equal(rows(owner.conn.db.sharedField).find(row=>row.fieldRef===fieldRef)!.contractJson,fieldBefore);
 assert.equal(rows(owner.conn.db.participant).find(row=>row.participantRef===member.participant_ref)!.contractJson,memberBefore);
 await assert.rejects(()=>publishArgs(contributor,{...other,putParticipant:{...other.putParticipant,identityRef:'human:controlled:impostor'}}),/identity|field/i);
 await assert.rejects(()=>publishArgs(contributor,{...other,putSharedField:{...other.putSharedField,visibility:'private'}}),/visibility/i);
 console.log(JSON.stringify({acceptance:'controlled-user-native-source-protocol',source:artifact.source,field_ref:fieldRef,passed:['independent contributor publishes real native material','field and membership source unchanged by artifact publication','identity substitution refused','field redefinition refused'],baseline_checked:argv.includes('--baseline-client')}));
} finally {close(owner);close(contributor);}
