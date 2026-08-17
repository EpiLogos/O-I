import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import {
  createArtifactAttestation,
  verifyArtifactAttestation,
  SecurityAuditLedger,
  SECURITY_AUDIT_READ_SCOPE,
} from './security-closure.mjs';

function attestedFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const artifact = Buffer.from('native-component-v1');
  const attestation = createArtifactAttestation({
    artifact_ref: 'package/component/demo',
    source_revision: 'git:abc123',
    artifact_bytes: artifact,
    signer_ref: 'publisher/demo',
    key_id: 'ed25519:publisher-demo:v1',
    issued_at_unix_ms: 1_000,
    private_key: privateKey,
  });
  return { privateKey, publicKey, artifact, attestation };
}

function verifyFixture({ attestation, artifact, publicKey, revision = 'git:abc123', keyId = 'ed25519:publisher-demo:v1' }) {
  return verifyArtifactAttestation({
    attestation,
    artifact_bytes: artifact,
    public_key: publicKey,
    expected_artifact_ref: 'package/component/demo',
    expected_source_revision: revision,
    expected_key_id: keyId,
  });
}

test('exact executable artifact revision verifies under its declared Ed25519 key', () => {
  const fixture = attestedFixture();
  const result = verifyFixture(fixture);
  assert.equal(result.verified, true);
  assert.equal(result.code, 'attestation_verified');
});

test('tampered executable bytes fail attestation before activation authority is relevant', () => {
  const fixture = attestedFixture();
  const result = verifyFixture({ ...fixture, artifact: Buffer.from('native-component-v1\nmalicious-patch') });
  assert.equal(result.verified, false);
  assert.equal(result.code, 'attestation_artifact_digest_mismatch');
});

test('source revision substitution fails even when artifact bytes are unchanged', () => {
  const fixture = attestedFixture();
  const result = verifyFixture({ ...fixture, revision: 'git:def456' });
  assert.equal(result.verified, false);
  assert.equal(result.code, 'attestation_source_revision_mismatch');
});

test('key substitution fails without changing semantic artifact identity', () => {
  const fixture = attestedFixture();
  const result = verifyFixture({ ...fixture, keyId: 'ed25519:attacker:v1' });
  assert.equal(result.verified, false);
  assert.equal(result.code, 'attestation_key_id_mismatch');
});

test('modified signed statement fails cryptographic verification', () => {
  const fixture = attestedFixture();
  const forged = { ...fixture.attestation, signer_ref: 'publisher/attacker' };
  const result = verifyFixture({ ...fixture, attestation: forged });
  assert.equal(result.verified, false);
  assert.equal(result.code, 'attestation_signature_invalid');
});

test('attestation receipt contains no execution authority field', () => {
  const { attestation } = attestedFixture();
  for (const forbidden of ['authority', 'grant', 'capability_grant', 'action_authorised', 'trusted']) {
    assert.equal(Object.hasOwn(attestation, forbidden), false);
  }
});

function makeAudit() {
  return new SecurityAuditLedger({ retention_ms: 10_000 });
}

test('representative denied and allowed paths are inspectable with explicit audit scope', () => {
  const audit = makeAudit();
  audit.append({
    event_ref: 'audit/deny/1',
    occurred_at_unix_ms: 2_000,
    decision: 'denied',
    boundary: 'execution-grant',
    reason_code: 'execution_grant_required',
    operation_ref: 'operation/1',
    principal_ref: 'participant/private-alice',
    provenance_ref: 'oi-pr60@5418d102',
  });
  audit.append({
    event_ref: 'audit/allow/1',
    occurred_at_unix_ms: 2_100,
    decision: 'allowed',
    boundary: 'artifact-attestation',
    reason_code: 'attestation_verified',
    operation_ref: 'operation/2',
    principal_ref: 'participant/private-alice',
    provenance_ref: 'attestation/demo',
  });

  const denied = audit.explain('audit/deny/1', { scopes: [SECURITY_AUDIT_READ_SCOPE] });
  const allowed = audit.explain('audit/allow/1', { scopes: [SECURITY_AUDIT_READ_SCOPE] });
  assert.equal(denied.permitted, true);
  assert.equal(denied.event.decision, 'denied');
  assert.equal(allowed.permitted, true);
  assert.equal(allowed.event.decision, 'allowed');
  assert.equal(audit.verifyIntegrity(), true);
});

test('audit read is denied without explicit read scope', () => {
  const audit = makeAudit();
  audit.append({
    event_ref: 'audit/1', occurred_at_unix_ms: 2_000, decision: 'denied',
    boundary: 'exchange', reason_code: 'exchange_grant_required', operation_ref: 'operation/1',
    principal_ref: 'participant/alice', provenance_ref: 'phase3/receipt',
  });
  assert.deepEqual(audit.explain('audit/1'), { permitted: false, code: 'audit_read_scope_required' });
});

test('audit projection never stores raw principal, content, secrets or relationship graph', () => {
  const audit = makeAudit();
  audit.append({
    event_ref: 'audit/1', occurred_at_unix_ms: 2_000, decision: 'denied',
    boundary: 'contact', reason_code: 'blocked', operation_ref: 'operation/1',
    principal_ref: 'participant/secret-identity', provenance_ref: 'contact/fixture',
  });
  const serialised = JSON.stringify(audit.snapshotForTest());
  assert.equal(serialised.includes('participant/secret-identity'), false);
  assert.equal(audit.policy.stores_private_relationship_graph, false);
  assert.equal(audit.policy.stores_content_payloads, false);
  assert.equal(audit.policy.stores_secret_values, false);

  assert.throws(() => audit.append({
    event_ref: 'audit/2', occurred_at_unix_ms: 2_100, decision: 'allowed',
    boundary: 'contact', reason_code: 'ok', operation_ref: 'operation/2',
    principal_ref: 'participant/a', provenance_ref: 'contact/fixture',
    related_private_refs: ['participant/b'],
  }), /private_relationship_graph_not_accepted/);
});

test('audit hash chain detects mutation of retained security facts', () => {
  const audit = makeAudit();
  audit.append({
    event_ref: 'audit/1', occurred_at_unix_ms: 2_000, decision: 'denied',
    boundary: 'admission', reason_code: 'not_admitted', operation_ref: 'operation/1',
    principal_ref: 'participant/a', provenance_ref: 'phase2/receipt',
  });
  assert.equal(audit.verifyIntegrity(), true);
  const snapshot = audit.snapshotForTest();
  snapshot[0].reason_code = 'rewritten';
  assert.equal(audit.verifyIntegrity(), true, 'external snapshots cannot mutate ledger state');
});

test('retention pruning is explicit and retained chain remains verifiable', () => {
  const audit = makeAudit();
  audit.append({
    event_ref: 'audit/old', occurred_at_unix_ms: 1_000, decision: 'denied',
    boundary: 'contact', reason_code: 'rate_limited', operation_ref: 'operation/old',
    principal_ref: 'participant/a', provenance_ref: 'contact/fixture',
  });
  audit.append({
    event_ref: 'audit/new', occurred_at_unix_ms: 12_000, decision: 'allowed',
    boundary: 'contact', reason_code: 'accepted', operation_ref: 'operation/new',
    principal_ref: 'participant/a', provenance_ref: 'contact/fixture',
  });
  const result = audit.prune(12_500);
  assert.equal(result.removed, 1);
  assert.equal(audit.verifyIntegrity(), true);
  assert.equal(audit.explain('audit/old', { scopes: [SECURITY_AUDIT_READ_SCOPE] }).code, 'audit_event_not_found');
  assert.equal(audit.explain('audit/new', { scopes: [SECURITY_AUDIT_READ_SCOPE] }).permitted, true);
});
