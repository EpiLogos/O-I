import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdmission,
  createContributionIndexDecision,
  createContributionIngressReceipt,
  validateAdmission,
  validateContributionIndexDecision,
  validateContributionIngressReceipt,
} from './admission.mjs';

const decidedAt = '2026-08-17T09:00:00.000Z';
const subject = { kind: 'oi.contribution-ingress', ref: 'ingress:abc123' };

test('Admission is explicit receiving-side evidence and does not imply indexing', () => {
  const admission = createAdmission({
    decision_ref: 'admission:1',
    field_ref: 'oi:field:test',
    subject,
    disposition: 'admitted',
    admission_actor_ref: 'participant:receiver',
    decided_at: decidedAt,
    reason: 'Accepted as a bounded contributed difference.',
    evidence: { schema_valid: true },
    provenance: { source_system: 'o-i', ingress_ref: subject.ref },
    visibility: 'restricted',
    audience_refs: ['participant:receiver'],
  });

  assert.equal(admission.schema, 'oi.admission/v1');
  assert.equal(admission.disposition, 'admitted');
  assert.equal(Object.hasOwn(admission, 'index_eligible'), false);
  assert.equal(Object.hasOwn(admission, 'canonical'), false);
  assert.equal(Object.hasOwn(admission, 'executable'), false);
  assert.deepEqual(validateAdmission(admission), admission);
});

test('index eligibility is a distinct decision over the same ingress identity', () => {
  const decision = createContributionIndexDecision({
    decision_ref: 'index:1',
    field_ref: 'oi:field:test',
    subject,
    eligible: true,
    decision_actor_ref: 'participant:receiver',
    decided_at: decidedAt,
    reason: 'Eligible for the receiving field index.',
    evidence: { admitted: true },
  });

  assert.equal(decision.schema, 'oi.contribution-index-decision/v1');
  assert.equal(decision.eligible, true);
  assert.deepEqual(validateContributionIndexDecision(decision), decision);
});

test('sender receipt exposes lifecycle status without raw quarantine material', () => {
  const receipt = createContributionIngressReceipt({
    ingress_ref: subject.ref,
    field_ref: 'oi:field:test',
    contribution_ref: 'contribution:claimed',
    state: 'quarantined',
    received_at: decidedAt,
    payload_fingerprint: '0011223344556677',
  });

  assert.equal(receipt.schema, 'oi.contribution-ingress-receipt/v1');
  assert.equal(Object.hasOwn(receipt, 'payload'), false);
  assert.equal(Object.hasOwn(receipt, 'server_provenance'), false);
  assert.deepEqual(validateContributionIngressReceipt(receipt), receipt);
});

test('Admission rejects policy-free or malformed ingress references', () => {
  assert.throws(() => createAdmission({
    decision_ref: 'admission:bad',
    field_ref: 'oi:field:test',
    subject: { kind: 'oi.contribution', ref: 'contribution:not-ingress' },
    disposition: 'admitted',
    admission_actor_ref: 'participant:receiver',
    decided_at: decidedAt,
    reason: 'bad',
    evidence: {},
    provenance: {},
  }), /oi\.contribution-ingress/);
});
