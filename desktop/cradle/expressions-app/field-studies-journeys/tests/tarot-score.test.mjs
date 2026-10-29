import test from 'node:test';import assert from 'node:assert/strict';
import {decodeMinorId,decodeToken,originLabel,refusalReason,scoreResolveCommand,createTarotScoreClient,SCORE_STATE_COMMAND,MINOR_SUITS,MINOR_PIPS} from '../build/tarotScoreClient.js';

// The pip/court register of ql-core `pole/tarot.rs:247-248`: 0 = Ace,
// 1-9 = Two..Ten, 10 = Princess(Page), 11 = Prince(Knight), 12 = Queen,
// 13 = King. Suits in kernel order (`TarotSuit`, ids suit*14 + pip):
// Cups/A/Water, Wands/T/Fire, Pentacles/C/Earth, Swords/G/Air.
const PIPS=['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Princess','Prince','Queen','King'];
const SUITS=[['Cups','Water','A'],['Wands','Fire','T'],['Pentacles','Earth','C'],['Swords','Air','G']];

test('the minor-id decode names every card in the ql-core pip register, the id staying the identity',()=>{
 assert.deepEqual([...MINOR_PIPS],PIPS);
 assert.deepEqual(MINOR_SUITS.map(s=>[s.name,s.element,s.nucleotide]),SUITS);
 for(let id=0;id<56;id++){
  const card=decodeMinorId(id),[suit,element,nucleotide]=SUITS[Math.floor(id/14)],pip=PIPS[id%14];
  assert.equal(card.id,id);assert.equal(card.pip,pip,`id ${id} pip`);assert.equal(card.suit,suit,`id ${id} suit`);
  assert.equal(card.element,element);assert.equal(card.nucleotide,nucleotide);
  assert.equal(card.name,`${pip} of ${suit}`,`id ${id} name`);
  assert.equal(card.court,id%14>=10,`id ${id} court`);
 }
 assert.equal(decodeMinorId(9).name,'Ten of Cups','pip 9 is the Ten');
 assert.equal(decodeMinorId(10).alias,'Page','pip 10 is the Princess, Page in the kernel print register');
 assert.equal(decodeMinorId(11).alias,'Knight','pip 11 is the Prince, Knight in the kernel print register');
 assert.equal(decodeMinorId(12).alias,null);assert.equal(decodeMinorId(13).name,'King of Cups');
 assert.equal(decodeMinorId(55).name,'King of Swords','the last id of the deck');
 for(const bad of [-1,56,3.5,NaN])assert.throws(()=>decodeMinorId(bad),/outside the 56-card minor deck/,String(bad));
});

// A canned `ql.tarot-score/v1` reply, hand-written to the native wire shape
// (ql-mef `tarot_score.rs` ScoreToken/ScorePose, host.rs score_operation):
// tokens in canonical order, a dual court carrying both codons, poses as the
// profile admits them, the corrected all-axis phase register (#312 §5).
const cannedScore={
 schema:'ql.tarot-score/v1',subject_ref:'person:canned-score-subject',locus_ref:'#2-5-4',
 basis_revision:'sha256:canned0000000000000000000000000000000000000000000000000000canned',
 score_revision:1,
 clock:{steps:359,degree720:715,degree360:355,layer:'720-layer',tick12:11,completed_double_covers:0},
 tokens:[
  {token_ref:'sha256:token-a',anchor:{kind:'kairos',body_index:0,snapshot_ref:'sky:2026-09-28',epoch_utc:'2026-09-28T00:00:00Z',longitude_degrees:185.5},
   role:'kairos/Sun',card_kernel_ref:'ql.pole.tarot-bridge/v1#minor:14',codons:[31],
   hexagram_address:31,inscription:{decan_ref:'#2-3-Libra2',decan_name:'Libra Decan 2',pip_card_ref:'#3-4.14',reflection_ref:'#3-4.14/reflection'},
   four_charge_raw:[1,-1,0,0],four_charge_normalised:[0.5,-0.5,0,0],
   pose:{torus_tick12:7,element_ring_position:2,matrix_family:'complementary',active_state:3,state_count:8,
    lawfully_admitted:true,collapsed_non_dual:false,candidate_slot:3,candidate_valence:'positive',
    candidate_rotational_value:12,candidate_rotation_degrees:135,phase_rotation_degrees:135},
   origin:'computed',origin_ref:null},
  {token_ref:'sha256:token-b',anchor:{kind:'oracle',journey_ref:'journey:canned',placement_ref:'placement:3',day_ref:'day:2026-09-28'},
   role:'oracle/placement:3',card_kernel_ref:'ql.pole.tarot-bridge/v1#minor:11',codons:[17,47],
   hexagram_address:17,inscription:{standing:'drawn-card-exact-cover-reading; no longitude inscription is claimed'},
   four_charge_raw:[2,2,-2,-2],four_charge_normalised:[0.5,0.5,-0.5,-0.5],
   pose:{torus_tick12:1,element_ring_position:0,matrix_family:'complementary',active_state:7,state_count:7,
    lawfully_admitted:false,collapsed_non_dual:true,candidate_slot:7,candidate_valence:'negative',
    candidate_rotational_value:-4,candidate_rotation_degrees:315,phase_rotation_degrees:0},
   origin:'drawn',origin_ref:'placement:3'},
 ],
 boundary_functions:{},primary_token_role:'kairos/Sun',manifestation_ref:null,
};

test('a score token renders as its named card with codons, origin, pose and charge read from the reply',()=>{
 const [sun,court]=cannedScore.tokens.map(decodeToken);
 assert.equal(sun.cardName,'Ace of Wands');assert.equal(sun.cardAlias,null);
 assert.equal(sun.cardRef,'ql.pole.tarot-bridge/v1#minor:14');assert.equal(sun.cardId,14);
 assert.equal(sun.suit,'Wands');assert.equal(sun.element,'Fire');
 assert.equal(sun.dualCourt,false,'a pip card carries one codon');
 assert.deepEqual(sun.codons,[31]);assert.equal(sun.hexagramAddress,31);
 assert.equal(sun.role,'kairos/Sun');assert.equal(sun.origin,'computed');assert.equal(sun.originLabel,'Computed');
 assert.equal(sun.pose.lawfullyAdmitted,true);assert.equal(sun.pose.activeState,3);assert.equal(sun.pose.stateCount,8);
 assert.equal(sun.pose.collapsedNonDual,false);assert.equal(sun.pose.matrixFamily,'complementary');
 assert.equal(sun.pose.torusTick12,7);assert.equal(sun.pose.phaseRotationDegrees,135,'the corrected all-axis phase register');
 assert.deepEqual(sun.fourChargeRaw,[1,-1,0,0]);assert.deepEqual(sun.fourChargeNormalised,[0.5,-0.5,0,0]);
 assert.equal(sun.inscription.decanName,'Libra Decan 2');assert.equal(sun.inscription.decanRef,'#2-3-Libra2');
 assert.equal(sun.inscription.pipCardRef,'#3-4.14');
 assert.equal(sun.anchorKind,'kairos');assert.equal(sun.anchorBody,'0');
 assert.ok(Math.abs(sun.anchorLongitude-185.5)<1e-9);
 // The dual court: BOTH codons in kernel order, a drawn origin with its act, no longitude.
 assert.equal(court.cardName,'Prince of Cups');assert.equal(court.cardAlias,'Knight');
 assert.equal(court.dualCourt,true,'a dual court renders both codons');assert.deepEqual(court.codons,[17,47]);
 assert.equal(court.pose.lawfullyAdmitted,false,'a pose outside the lawful set is disclosed, not hidden');
 assert.equal(court.pose.collapsedNonDual,true);assert.equal(court.pose.stateCount,7);
 assert.equal(court.origin,'drawn');assert.equal(court.originLabel,'Drawn');assert.equal(court.originRef,'placement:3');
 assert.equal(court.anchorKind,'oracle');assert.equal(court.anchorLongitude,null,'a drawn card claims no longitude');
 assert.equal(originLabel('authored-assignment'),'Authored assignment');
 assert.equal(originLabel('interpretation'),'Interpreted');
});

test('a token without its minor reference, codons or charge vector is refused by name',()=>{
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],card_kernel_ref:'ql.pole.tarot-bridge/v1#major:0'}),/minor card reference/);
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],codons:[]}),/carries no codon/);
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],codons:[64]}),/invalid codon address/);
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],four_charge_raw:[1,2]}),/invalid four-charge vector/);
});

test('a refusal reply renders the owner’s named reason, never a generic error',()=>{
 const reason='no anchor basis: neither identity natal placements nor an occasion sky is admitted';
 assert.equal(refusalReason({refused:true,error:reason}),reason);
 assert.equal(refusalReason({refused:true,error:'score basis subject person:x is not this field’s subject person:y'}),
  'score basis subject person:x is not this field’s subject person:y');
 assert.equal(refusalReason({refused:false,score:cannedScore,current:true,resolved_event_ref:'#2-5'}),null);
});

test('the resolve command carries exactly the admitted basis the owner declares',()=>{
 const basis={schema:'oi.field-score-basis/v1',subject_ref:'person:scene-subject',event_ref:'#2-5-4',clock_steps:359,
  occasion_sky:{schema:'ql.sky-snapshot/v1',snapshot_ref:'sky:2026-09-28'}};
 const command=scoreResolveCommand(basis);
 assert.deepEqual(Object.keys(command),['operation','basis']);
 assert.equal(command.operation,'score-resolve');
 // deny_unknown_fields on the owner side (ScoreBasisInput): exactly the declared keys.
 assert.deepEqual(Object.keys(command.basis).sort(),
  ['boundary_passage','clock_steps','drawn','identity','locus_ref','manifestation','occasion_sky','primary_anchor','subject_ref']);
 assert.equal(command.basis.subject_ref,'person:scene-subject','the basis names the field’s own subject');
 assert.equal(command.basis.locus_ref,'#2-5-4','the locus is the field’s own event');
 assert.equal(command.basis.identity,null);assert.equal(command.basis.occasion_sky,basis.occasion_sky);
 assert.deepEqual(command.basis.primary_anchor,{kind:'kairos',body_index:0},'a carried sky anchors kairos');
 assert.deepEqual(command.basis.drawn,[]);
 assert.deepEqual(SCORE_STATE_COMMAND,{operation:'score-state'});
 // Without a sky the basis still names the field's subject; the owner then
 // refuses by name (the plain empty-anchor state the view shows verbatim).
 assert.deepEqual(scoreResolveCommand({...basis,occasion_sky:null}).basis.primary_anchor,{kind:'natal',planet_id:0});
 for(const bad of [{...basis,clock_steps:1.5},{...basis,subject_ref:''},{...basis,event_ref:''},null])
  assert.throws(()=>scoreResolveCommand(bad),/complete score basis/);
});

test('the client resolves and states through the field’s one exchange path, and names a missing field',async()=>{
 const sent=[],basis={schema:'oi.field-score-basis/v1',subject_ref:'s',event_ref:'e',clock_steps:2,occasion_sky:null};
 let open=true;
 const client=createTarotScoreClient({fieldBasis:()=>open?basis:null,fieldScore:async command=>{sent.push(command);return{refused:true,error:'no anchor basis'};}});
 assert.deepEqual(await client.resolve(),{refused:true,error:'no anchor basis'});
 await client.state();
 assert.deepEqual(sent.map(c=>c.operation),['score-resolve','score-state']);
 open=false;
 await assert.rejects(client.resolve(),/Open the live instrument first/);
 assert.equal(sent.length,2,'no exchange without an open field');
});

// The controller's score path, against the controlled scene protocol owner
// (protocol fixture ONLY, not QL's score owner): the basis it discloses, the
// two score reads through the one serial owner, a refusal kept as data, and
// the retained occasion sky the compose re-opens on. Bundled here with the
// app's own esbuild, so it never depends on the shared build/ folder.
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ControlledAudio,ControlledSceneOwner} from '../../../tests/native-expression-fixture.mjs';
const esbuild=createRequire(import.meta.url)('esbuild');
const journeys=fileURLToPath(new URL('..',import.meta.url)),out=mkdtempSync(join(tmpdir(),'tarot-score-controller-'));
test.after(()=>rmSync(out,{recursive:true,force:true}));
let controllerModule=null;
const controller=async()=>controllerModule??=(async()=>{
 await esbuild.build({absWorkingDir:journeys,nodePaths:[join(journeys,'../node_modules')],entryPoints:['src/native-field/controller.ts'],bundle:true,format:'esm',platform:'node',outfile:join(out,'controller.mjs'),logLevel:'silent'});
 return import(pathToFileURL(join(out,'controller.mjs')).href);
})();
const SKY={schema:'ql.sky-snapshot/v1',snapshot_ref:'sha256:controlled-occasion',epoch_utc:'2026-09-27T12:00:00Z',bodies:[]};
/** The scene owner, with the facts a score basis stands on (the event's sky
 * receipt, the M3 clock) and the two score reads answered as host.rs does:
 * the field unchanged, the held score with its currentness. */
class ScoredSceneOwner extends ControlledSceneOwner{
 scoreReply=null;
 event(){const e=super.event();e.source_receipts=[structuredClone(SKY)];return e;}
 sources(){const s=super.sources();s.current.m3.clock={steps:359,degree720:359,degree360:359,tick12:11,completed_double_covers:0};return s;}
 async request(request){
  const command=request.request?.command;
  // As the kernel does for a saved sky: the composed source discloses the full snapshot it was composed on.
  if(request.operation==='compose'){const opened=await super.request(request);if(request.request.sky_snapshot)opened.source.sky=structuredClone(request.request.sky_snapshot);return opened;}
  if(request.operation!=='exchange'||!['score-resolve','score-state'].includes(command?.operation))return super.request(request);
  this.calls.push(structuredClone(request));
  const packet=request.request;
  if(packet.request_id!==String(++this.sequence)||packet.expected_generation!==this.frame.generation)throw new Error('controlled native cursor mismatch');
  const reply={schema:'ql.field-host-receipt/v1',instance_ref:'controlled:scene',status:'ok',available:true,request_id:packet.request_id,last_request_id:packet.request_id,field:{...structuredClone(this.frame),audio:[]}};
  if(this.refuse?.(command))return{...reply,status:'refused',error:'no anchor basis: neither identity natal placements nor an occasion sky is admitted'};
  return{...reply,score:this.scoreReply??{schema:'ql.tarot-score/v1',subject_ref:packet.subject_ref,tokens:[]},current:true,resolved_event_ref:packet.event_ref};
 }
}
function renderer(){
 const texture=()=>new THREE.DataTexture(new Float32Array(16),2,2,THREE.RGBAFormat,THREE.FloatType);
 const port={texWidth:2,texHeight:2,particleCount:4,targetA:texture(),targetB:texture(),sets:0,setTargetTextures(a,b){this.actualA=a;this.actualB=b;this.sets++;}};
 return{port,native:false,retainedTopology(){return{tex_width:2,tex_height:2,particle_count:4,slot_count:4};},retainedTargetPort(){return port;},setNativeDomain(v){this.native=v;},releaseRetainedField(){},onRetainedRecoveryRequired(){return()=>{};},checkpointRetainedField(){throw new Error('no GPU');}};
}
async function scene(options={sky:'none'}){
 const {NativeFieldController}=await controller();
 const owner=new ScoredSceneOwner(),c=new NativeFieldController(owner,renderer(),()=>new ControlledAudio());
 await c.compose(options);return{owner,c};
}
const exchanged=(owner,name)=>owner.calls.filter(call=>call.request?.command?.operation===name);

test('the field discloses the score basis its scene stands on: subject, event, M3 clock and the event’s sky',async()=>{
 const {c}=await scene();
 try{
  const basis=c.scoreBasis;
  assert.deepEqual(basis,{schema:'oi.field-score-basis/v1',subject_ref:c.reading.native.subject_ref,event_ref:c.reading.native.event_ref,
   clock_steps:359,occasion_sky:SKY});
  assert.equal(scoreResolveCommand(basis).basis.primary_anchor.kind,'kairos','the scene’s sky anchors the score');
 }finally{await c.dispose();}
});

test('the score reads ride the one serial owner and never move the field',async()=>{
 const {owner,c}=await scene();
 try{
  const before=structuredClone(c.reading.native.acknowledged);
  const reply=await c.score(scoreResolveCommand(c.scoreBasis));
  assert.equal(reply.refused,false);assert.equal(reply.current,true,'the host’s currentness reaches the view');
  assert.equal(reply.resolved_event_ref,c.reading.native.event_ref);
  assert.equal(exchanged(owner,'score-resolve').length,1);
  assert.deepEqual(exchanged(owner,'score-resolve')[0].request.command.basis.occasion_sky,SKY);
  const state=await c.score({operation:'score-state'});
  assert.equal(state.refused,false);
  assert.deepEqual(c.reading.native.acknowledged,before,'a score read advances neither generation nor samples');
  assert.notEqual(c.status,'unavailable');
 }finally{await c.dispose();}
});

test('a refused score comes back in the owner’s words and leaves the field as it was',async()=>{
 const {owner,c}=await scene();
 try{
  const status=c.status;
  owner.refuse=command=>command.operation==='score-resolve';
  const reply=await c.score(scoreResolveCommand({...c.scoreBasis,occasion_sky:null}));
  assert.deepEqual(reply,{refused:true,error:'no anchor basis: neither identity natal placements nor an occasion sky is admitted'});
  assert.equal(c.status,status);assert.equal(c.reading.native.available,true);
 }finally{await c.dispose();}
});

test('a field that stopped answering says so plainly and sends nothing',async()=>{
 const {owner,c}=await scene();
 try{
  owner.delay=()=>new Promise(()=>{});
  await assert.rejects(c.m1Advance(1));
  const sent=owner.calls.length;
  await assert.rejects(c.score({operation:'score-state'}),/The live field stopped answering, so the score cannot be read/);
  assert.equal(owner.calls.length,sent,'no exchange is sent to a field whose last reply never came');
 }finally{await c.dispose();}
});

test('a retained occasion re-opens on its saved sky: the kernel gets the snapshot, not a fresh sky request',async()=>{
 const {owner,c}=await scene({skySnapshot:SKY});
 try{
  const compose=owner.calls.find(call=>call.operation==='compose');
  assert.deepEqual(compose.request.sky_snapshot,SKY);
  assert.equal('sky' in compose.request,false,'no fresh sky is asked for');
  assert.deepEqual(c.reading.instrument.acting.sky,{kind:'dated',mode:'saved',epoch:'2026-09-27T12:00:00Z',snapshot_ref:SKY.snapshot_ref,
   label:'Saved occasion sky · 2026-09-27T12:00:00Z'},'the field names the saved sky it stands on');
 }finally{await c.dispose();}
 const {NativeFieldController}=await controller();
 const refused=new ScoredSceneOwner(),c2=new NativeFieldController(refused,renderer(),()=>new ControlledAudio());
 for(const bad of [{schema:'ql.other/v1',snapshot_ref:'x'},{schema:'ql.sky-snapshot/v1'},null,[SKY]])
  await assert.rejects(c2.compose({skySnapshot:bad}),/not one bounded ql.sky-snapshot\/v1 owner reading/);
 assert.equal(refused.calls.length,0,'a malformed saved sky is refused before any compose');
 await c2.dispose();
});
