/** Controlled REAL native binary join. No personal root, provider or model.
 * Missing selected native executable is failure, never a skipped acceptance. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,stat,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {modules} from './nara-personal-modules.mjs';
import {source,consent} from './nara-personal-fixtures.mjs';
const executable=process.env.QL_NARA_TEST_BIN;if(!executable)throw Error('Set QL_NARA_TEST_BIN to the source-pinned native ql executable');
const root=await mkdtemp(join(tmpdir(),'nara-consumer-native-')),{mod:m,dispose}=await modules();
let outcome='in-progress';
const checks=[],requests=[];const check=(v,label)=>{assert.ok(v,label);checks.push(label);console.log('PASS '+label);};
async function call(request){requests.push(structuredClone(request));return await new Promise((done,reject)=>{
 const child=spawn(resolve(executable),['nara','--request-file','-','--json'],{env:{...process.env,QL_NARA_HOME:join(root,'private')},stdio:['pipe','pipe','pipe']});
 let out='',err='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Native test deadline'));},20000);
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error('Native test exit '+code+': '+err);done(JSON.parse(out));}catch(e){reject(e);}});child.stdin.end(JSON.stringify(request));
 });}
const q={w:1,x:0,y:0,z:0},s=n=>({source_ref:`source:${n}`,revision:'r1',standing_ref:'controlled-test'});
const seed={nara_ref:'nara:controlled',personal:{schema:'ql.nara-personal-field/v1',subject_id:'subject:controlled',constitution_ref:'constitution:controlled',reception_generation:1,event:{event_ref:'event:controlled',subject_ref:'subject:controlled',profile_generation:1,registry_revision:'r1',m1_revision:'m1:r1',m2_source_ref:'m2:r1',m2_contract_ref:'m2:contract',m3_source_ref:'m3:r1',m3_contract_ref:'m3:contract'},observed_at_unix_ms:1,consent:'granted',lifecycle:'active',q_identity:q,q_transit:q,q_activity:q,q_composed:q,ephemeral_source:null,receivers:Array.from({length:7},(_,n)=>({ordinal:n,label:`centre:${n}`,source:s(`centre:${n}`),input_basis:['m1','m2','m3'].map(v=>({basis_ref:`${v}:r1`,source_ref:`${v}:${n}`,value:n})),bioquaternion:q,receiver_orientation:q,composed_orientation:q,orientation_alignment:1,drive:n,resonance:n/10,reradiation:n/20})),earth_body:{source:s('earthbody'),frame_ref:'earth-fixed',orientation:q,relation_alignment:1},aggregate_resonance:0,aggregate_reradiation:0,source_revisions:[s('personal')],standing:'controlled-test'},embodied:{elemental_efwa:{earth:.1,fire:.2,water:.3,air:.4},elemental_source:s('elemental'),elemental_standing:'reported',nadi_refs:[],sushumna_ref:null,temporal_astrology_refs:[],materia_refs:[],operation_refs:[],safety_intensity:null,contraindication_refs:[],response_refs:[],adjustment_refs:[]}};
try{
 const caps=m.readEnvelope(await call({operation:'capabilities'}));check(caps.public_export===false&&caps.centres_are_cymatic_stations===false,'native capability privacy and centre identity');
 const c=new m.PersonalController(call,consent);let r=await c.create(seed);check(r.domain.identity.slots.length===6&&r.domain.embodied.centres.length===7,'actual native create admits all six identity layers and seven distinct centres');
 check(r.domain.identity.slots.every(s=>s.source===null),'native creation invents no identity evidence');
 r=await c.apply(m.identitySource('birthdate-name',source));check(r.domain.identity.slots[0].source.revision===source.revision,'identity source proposal crosses real native validation and receipt');
 r=await c.apply(m.identitySource('natal-chart',null,'Birth time unknown'));check(r.domain.identity.slots[1].absence_reason==='Birth time unknown','optional evidence remains explicitly unprovided');
 r=await c.apply({kind:'centre_feedback',ordinal:3,feedback_ref:source.location.ref});check(r.domain.embodied.centres[3].feedback_refs.includes(source.location.ref),'feedback belongs to the selected native receiving centre');
 r=await c.apply({kind:'oracle_cast',cast:{system:'i-ching-coins',tradition_ref:source.location.ref,deck_or_method_ref:source.location.ref,spread_ref:null,query_ref:m.protectedSource(source),draw_count:6,source_revisions:[m.sourceBasis(source)],hygiene:'clear'}});
 const original=structuredClone(r.domain.oracle.records[0].original);check(original.tokens.length===6,'actual native oracle retains original entropy-backed six-line cast');
 r=await c.apply(m.interpretOracle(original.packet_ref,source,''));check(JSON.stringify(r.domain.oracle.records[0].original)===JSON.stringify(original)&&r.domain.oracle.records[0].interpretations.length===1,'interpretation does not rewrite the original oracle');
 r=await c.apply(m.nextPractice(r,source,true));const phase=r.domain.transformation.phase_history.phases[0].phase_ref;
 r=await c.apply({kind:'practice_hold',phase_ref:phase,feedback_ref:source.location.ref});check(r.domain.transformation.phase_history.phases[0].safety==='consent-required','explicit practice hold is native consent state, not inferred physiology');
 const held=structuredClone(r);
 r=await c.apply({kind:'practice_resume',phase_ref:phase,safety_review_ref:source.location.ref});
 for(let i=0;i<2;i++){r=await c.apply({kind:'practice_hold',phase_ref:phase,feedback_ref:source.location.ref});r=await c.apply({kind:'practice_resume',phase_ref:phase,safety_review_ref:source.location.ref});}
 const reviewRef='central:path:/test:Control/user/practice-safety-review.md';
 const reflectionRef='central:path:/test:Control/user/practice-closing-reflection.md';
 r=await c.apply({kind:'practice_hold',phase_ref:phase,feedback_ref:source.location.ref});
 r=await c.apply({kind:'practice_resume',phase_ref:phase,safety_review_ref:reviewRef});
 r=await c.apply({kind:'practice_close',phase_ref:phase,feedback_refs:[source.location.ref,reflectionRef]});
 const finished=r.domain.transformation.phase_history.phases[0];
 check(finished.closed_at_unix_ms!==null&&JSON.stringify(finished.feedback_refs)===JSON.stringify([source.location.ref,reviewRef,reflectionRef]),'same source and distinct sources remain unique links across actual repeated practice acts');
 check(r.receipts.length===held.receipts.length+8,'each authorised practice transition has its own native receipt');
 r=await c.apply(m.contextSource('phenomenological','M4.4.4',source,''));check(r.domain.context.branches.find(b=>b.branch==='phenomenological').readings.length===1,'context reading uses the real native branch and source');
 r=await c.apply({kind:'journal_link',source:m.protectedSource(source)});check(r.journal_refs[0].ref_id===source.location.ref,'native journal link references Central rather than copying its body');
 r=await c.apply({kind:'integration_return',returned:{return_ref:'return:controlled',office:'integration-lab',input_refs:[source.location.ref],source_refs:[source.location.ref],method_ref:null,output_ref:m.protectedSource(source),evidence_refs:[],human_response_ref:null,retention_policy_ref:'policy:controlled-private',standing:'reported'}});check(r.domain.integration.offices.find(o=>o.office==='integration-lab').returns.length===1,'integration Return has the native office, retention and protected source');
 const reopened=new m.PersonalController(call,consent);await reopened.read(r.target);check(JSON.stringify(reopened.snapshot.record)===JSON.stringify(r),'native private state survives independent consumer reconstruction');
 const mode=(await stat(join(root,'private'))).mode&0o777;check(mode===0o700,'actual native storage is owner-only');
 const query=()=>call({operation:'identity_material',target:r.target,consent,expected_revision:r.revision});
 let material=m.readIdentityMaterial(m.readEnvelope(await query()).material,r);
 check(material.sealed===false,'native identity preview performs no acceptance');
 await assert.rejects(m.identityPattern(r,'cymatic',material),/accept/);
 r=await c.apply({kind:'identity_seal',expected_value:material.value});
 material=m.readIdentityMaterial(m.readEnvelope(await query()).material,r);
 const pattern=await m.identityPattern(r,'cymatic',material);
 check(pattern.fingerprint.value===material.value&&m.identityScene(pattern).entities.length===7,'accepted native identity material enters the existing seven-centre chakral renderer unchanged');
 await m.verifyIdentitySources(r,async location=>({...source,location}));
 await assert.rejects(m.verifyIdentitySources(r,async location=>({...source,location,revision:'external:new'})),/changed/);
 check(true,'external source drift refuses presentation without copying source text');

 const stale=await call({operation:'apply',request_id:'stale:controlled',target:r.target,expected_revision:1,consent,mutation:{kind:'centre_feedback',ordinal:0,feedback_ref:source.location.ref}});check(stale.ok===false,'native stale revision refuses without overwriting');
 const after=(await call({operation:'read',target:r.target,consent})).record;check(after.revision===r.revision,'refused stale operation leaves actual native state unchanged');
 check(requests.every(q=>!JSON.stringify(q).includes(source.content)),'source content never entered the native derived working record');
 outcome='passed';
}catch(error){outcome='failed';throw error;}finally{
 const out=new URL('./artifacts/nara-personal/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('native-receipt.json',out),JSON.stringify({outcome,standing:'real-native-binary-controlled-temporary-world-not-personal-install',native_revision:process.env.QL_NARA_TEST_REVISION??null,checks},null,2));await dispose();await rm(root,{recursive:true,force:true});
}
