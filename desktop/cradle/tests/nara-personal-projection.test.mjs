import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindPersonalProjection,
  disconnectPersonalProjection,
  assertNoPrivateLeak,
  assertSharedPersonalIdentity,
  AUTHORED_CHAKRA_STARTER,
  NARA_PERSONAL_LIVE,
  NARA_ANIMA_PROFILE_SCHEMA,
} from '../src/nara/personalProjection.ts';

function profile(current=true){
  const centres=Array.from({length:7},(_,ordinal)=>({
    ordinal,
    locus_ref:`ql:nara:subject:1:centre:${ordinal}`,
    label:`centre-${ordinal}`,
    source_ref:`source:centre:${ordinal}`,
    source_revision:'r1',
    m1_basis_ref:'m1',
    m2_basis_ref:'m2',
    m3_basis_ref:'m3',
    amplitude:0.5+ordinal*0.05,
  }));
  return {
    schema:NARA_ANIMA_PROFILE_SCHEMA,
    subject_ref:'subject:1',
    event_ref:'event:1',
    profile_generation:3,
    personal_reception_generation:7,
    current,
    centres,
    earth_body:{
      locus_ref:'ql:nara:subject:1:earth-body',
      frame_ref:'frame:earth',
      standing:'EarthBody is the grounding relation; not an eighth centre peer',
    },
    centre_identity_neq_cymatic_station:true,
    standing:'live projection',
  };
}

test('bind admits live Anima profile without copying private M4 into Expression',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  assert.equal(binding.standing,NARA_PERSONAL_LIVE);
  assert.equal(binding.profile?.centres.length,7);
  assert.notEqual(binding.profile?.earth_body.locus_ref,binding.profile?.centres[0].locus_ref);
});

test('stale personal reception is refused',()=>{
  assert.throws(()=>bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(false),
  }),/stale/);
});

test('disconnect retains authored Expression standing and drops live profile',()=>{
  const live=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  const disconnected=disconnectPersonalProjection(live);
  assert.equal(disconnected.standing,AUTHORED_CHAKRA_STARTER);
  assert.equal(disconnected.profile,null);
  assert.equal(disconnected.disconnected,true);
});

test('speech and personal body must share nara_ref / subject / expression',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  assert.doesNotThrow(()=>assertSharedPersonalIdentity({
    nara_ref:'nara:desktop',subject_ref:'subject:1',expression_ref:'expression:1',
  },binding));
  assert.throws(()=>assertSharedPersonalIdentity({
    nara_ref:'nara:other',subject_ref:'subject:1',expression_ref:'expression:1',
  },binding),/share nara_ref/);
});

test('private identity keys must not enter Expression JSON',()=>{
  assert.doesNotThrow(()=>assertNoPrivateLeak(JSON.stringify({schema:'oi.expression/v1',scenes:[]})));
  assert.throws(()=>assertNoPrivateLeak(JSON.stringify({identity_hash_ref:'ql:nara-identity:sha256:abc'})),/identity_hash_ref/);
});
