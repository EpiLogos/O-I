import test from 'node:test';import assert from 'node:assert/strict';
import {decodeMinorId,decodeToken,originLabel,refusalReason,scoreResolveCommand,SCORE_STATE_COMMAND,MINOR_SUITS,MINOR_PIPS} from '../build/tarotScoreClient.js';

test('the native minor-id decode names suits and pips presentation of the id',()=>{
 // suit = floor(id/14): 0 Cups/A/Water, 1 Wands/T/Fire, 2 Pentacles/C/Earth, 3 Swords/G/Air.
 // pip = id%14: 0 Ace, 1-10 number, 10 Princess, 11 Prince, 12 Queen, 13 King.
 const cases=[[0,'Ace','Cups','Water','A'],[14,'Ace','Wands','Fire','T'],[28,'Ace','Pentacles','Earth','C'],[42,'Ace','Swords','Air','G'],[11,'Prince','Cups','Water','A']];
 for(const [id,pip,suit,element,nucleotide] of cases){
  const card=decodeMinorId(id);
  assert.equal(card.pip,pip,`id ${id} pip`);
  assert.equal(card.suit,suit,`id ${id} suit`);
  assert.equal(card.element,element,`id ${id} element`);
  assert.equal(card.nucleotide,nucleotide,`id ${id} suit nucleotide`);
  assert.equal(card.name,`${pip} of ${suit}`,`id ${id} name`);
  assert.equal(card.id,id,'the id stays the authoritative identity');
 }
 assert.equal(decodeMinorId(11).court,true,'pip 11 is a court card');
 assert.equal(decodeMinorId(11).alias,'Knight','pip 11 presents as Prince with the Knight alias');
 assert.equal(decodeMinorId(10).alias,'Page');
 assert.equal(decodeMinorId(13).name,'King of Cups','pip 13 with suit 0');
 assert.equal(decodeMinorId(55).name,'King of Swords','the last id of the deck');
 assert.equal(decodeMinorId(0).court,false);
 assert.equal(MINOR_SUITS.length,4);assert.equal(MINOR_PIPS.length,14);
 for(const bad of [-1,56,3.5,NaN])assert.throws(()=>decodeMinorId(bad),/outside the 56-card minor deck/,String(bad));
});

// A canned `ql.tarot-score/v1` reply, hand-written to the native wire shape
// (host.rs `score_operation` → `ql.tarot-score/v1`): tokens in canonical
// order, a dual court carrying both codons, poses as `codon_pose` admits them.
const cannedScore={
 schema:'ql.tarot-score/v1',subject_ref:'person:canned-score-subject',locus_ref:'#2-5-4',
 basis_revision:'sha256:canned0000000000000000000000000000000000000000000000000000canned',
 score_revision:1,
 clock:{degree360:355,degree720:715,layer:'720-layer',tick12:11,steps:359,completed_double_covers:0},
 tokens:[
  {token_ref:'sha256:token-a',anchor:{kind:'kairos',body_index:0,snapshot_ref:'sky:2026-09-28',epoch_utc:'2026-09-28T00:00:00Z',longitude_degrees:185.5},
   role:'kairos/Sun',card_kernel_ref:'ql.pole.tarot-bridge/v1#minor:14',codons:[31],
   hexagram_address:31,inscription:{decan_ref:'#2-3-Libra2',decan_name:'Libra Decan 2',pip_card_ref:'#3-4.14',reflection_ref:'#3-4.14/reflection'},
   four_charge_raw:[1,-1,0,0],four_charge_normalised:[0.5,-0.5,0,0],
   pose:{torus_tick12:7,element_ring_position:2,matrix_family:'complementary',active_state:3,state_count:8,
    lawfully_admitted:true,collapsed_non_dual:false,candidate_slot:3,candidate_valence:'positive',
    candidate_rotational_value:12,candidate_rotation_degrees:135,phase_clock_steps:6,phase_argument_degrees:3},
   origin:'computed',origin_ref:null},
  {token_ref:'sha256:token-b',anchor:{kind:'kairos',body_index:3,snapshot_ref:'sky:2026-09-28',epoch_utc:'2026-09-28T00:00:00Z',longitude_degrees:42.25},
   role:'kairos/Moon',card_kernel_ref:'ql.pole.tarot-bridge/v1#minor:11',codons:[17,47],
   hexagram_address:17,inscription:{standing:'drawn-card-exact-cover-reading; no longitude inscription is claimed'},
   four_charge_raw:[2,2,-2,-2],four_charge_normalised:[0.5,0.5,-0.5,-0.5],
   pose:{torus_tick12:1,element_ring_position:0,matrix_family:'moving-resting',active_state:7,state_count:7,
    lawfully_admitted:false,collapsed_non_dual:true,candidate_slot:7,candidate_valence:'negative',
    candidate_rotational_value:-4,candidate_rotation_degrees:315,phase_clock_steps:714,phase_argument_degrees:357},
   origin:'computed',origin_ref:null},
 ],
 boundary_functions:{},primary_token_role:'kairos/Sun',manifestation_ref:null,
};

test('a score token renders as its named card with codons, origin, pose and charge',()=>{
 const [sun,court]=cannedScore.tokens.map(decodeToken);
 assert.equal(sun.cardName,'Ace of Wands');
 assert.equal(sun.cardRef,'ql.pole.tarot-bridge/v1#minor:14');
 assert.equal(sun.cardId,14);
 assert.equal(sun.suit,'Wands');assert.equal(sun.element,'Fire');
 assert.equal(sun.dualCourt,false,'a pip card carries one codon');
 assert.deepEqual(sun.codons,[31]);
 assert.equal(sun.hexagramAddress,31);
 assert.equal(sun.role,'kairos/Sun');
 assert.equal(sun.origin,'computed');assert.equal(sun.originLabel,'Computed');
 assert.equal(sun.originLabel,originLabel('computed'));
 assert.equal(sun.pose.lawfullyAdmitted,true);
 assert.equal(sun.pose.activeState,3);assert.equal(sun.pose.stateCount,8);
 assert.equal(sun.pose.collapsedNonDual,false);
 assert.equal(sun.pose.matrixFamily,'complementary');
 assert.equal(sun.pose.torusTick12,7);assert.equal(sun.pose.phaseClockSteps,6);
 assert.equal(sun.pose.phaseArgumentDegrees,3);
 assert.deepEqual(sun.fourChargeRaw,[1,-1,0,0]);
 assert.deepEqual(sun.fourChargeNormalised,[0.5,-0.5,0,0]);
 assert.equal(sun.inscription.decanName,'Libra Decan 2');
 assert.equal(sun.inscription.decanRef,'#2-3-Libra2');
 assert.equal(sun.inscription.pipCardRef,'#3-4.14');
 assert.equal(sun.anchorKind,'kairos');assert.equal(sun.anchorBody,'0');
 assert.ok(Math.abs(sun.anchorLongitude-185.5)<1e-9);
 // The dual court: BOTH codons, kernel order, and the distinct origin labels.
 assert.equal(court.cardName,'Prince of Cups');
 assert.equal(court.dualCourt,true,'a dual court renders both codons');
 assert.deepEqual(court.codons,[17,47]);
 assert.equal(court.pose.lawfullyAdmitted,false,'a pose outside the lawful set is disclosed, not hidden');
 assert.equal(court.pose.collapsedNonDual,true);
 assert.equal(court.pose.stateCount,7);
 assert.equal(originLabel('drawn'),'Drawn');
 assert.equal(originLabel('authored-assignment'),'Authored assignment');
 assert.equal(originLabel('interpretation'),'Interpreted');
 assert.equal(originLabel('computed'),'Computed');
});

test('a token without its minor reference or codons is refused by name',()=>{
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],card_kernel_ref:'ql.pole.tarot-bridge/v1#major:0'}),/minor card reference/);
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],codons:[]}),/carries no codon/);
 assert.throws(()=>decodeToken({...cannedScore.tokens[0],four_charge_raw:[1,2]}),/invalid four-charge vector/);
});

test('a refusal reply renders the owner’s named reason, never a generic error',()=>{
 const refusal={refused:true,error:'no anchor basis: neither identity natal placements nor an occasion sky is admitted'};
 assert.equal(refusalReason(refusal),'no anchor basis: neither identity natal placements nor an occasion sky is admitted');
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
 // deny_unknown_fields on the owner side: exactly the declared basis keys.
 assert.deepEqual(Object.keys(command.basis).sort(),
  ['boundary_passage','clock_steps','drawn','identity','locus_ref','manifestation','occasion_sky','primary_anchor','subject_ref']);
 assert.equal(command.basis.subject_ref,'person:scene-subject','the basis names the field’s own subject');
 assert.equal(command.basis.locus_ref,'#2-5-4','the locus is the field’s own event');
 assert.equal(command.basis.identity,null);
 assert.equal(command.basis.occasion_sky,basis.occasion_sky);
 assert.deepEqual(command.basis.primary_anchor,{kind:'kairos',body_index:0},'a carried sky anchors kairos');
 assert.deepEqual(command.basis.drawn,[]);
 assert.deepEqual(SCORE_STATE_COMMAND,{operation:'score-state'});
 // Without a sky the basis still names the field's subject; the owner then
 // refuses by name (the honest empty-anchor state the UI shows verbatim).
 const empty=scoreResolveCommand({...basis,occasion_sky:null});
 assert.deepEqual(empty.basis.primary_anchor,{kind:'natal',planet_id:0});
 assert.throws(()=>scoreResolveCommand({...basis,clock_steps:1.5}),/complete score basis/);
 assert.throws(()=>scoreResolveCommand({...basis,subject_ref:''}),/complete score basis/);
 assert.throws(()=>scoreResolveCommand(null),/complete score basis/);
});
