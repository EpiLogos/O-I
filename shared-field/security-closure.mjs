import {
  createHash,
  sign as signBytes,
  verify as verifyBytes,
} from 'node:crypto';

const AUDIT_SCHEMA = 'oi.security-audit/v1';
const ATTESTATION_SCHEMA = 'oi.artifact-attestation/v1';
const AUDIT_READ_SCOPE = 'security:audit:read';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field}_required`);
  }
  return value;
}

function attestationPayload(statement) {
  // Deliberately fixed field order. This is an O:I statement envelope, not a
  // claim that arbitrary JSON has one universal semantic canonicalisation.
  return Buffer.from(JSON.stringify([
    ATTESTATION_SCHEMA,
    statement.artifact_ref,
    statement.source_revision,
    statement.artifact_sha256,
    statement.signer_ref,
    statement.key_id,
    statement.issued_at_unix_ms,
  ]));
}

export function createArtifactAttestation({
  artifact_ref,
  source_revision,
  artifact_bytes,
  signer_ref,
  key_id,
  issued_at_unix_ms,
  private_key,
}) {
  requireText(artifact_ref, 'artifact_ref');
  requireText(source_revision, 'source_revision');
  requireText(signer_ref, 'signer_ref');
  requireText(key_id, 'key_id');
  if (!Buffer.isBuffer(artifact_bytes)) throw new TypeError('artifact_bytes_buffer_required');
  if (!Number.isSafeInteger(issued_at_unix_ms) || issued_at_unix_ms < 0) {
    throw new TypeError('issued_at_unix_ms_required');
  }
  if (!private_key) throw new TypeError('private_key_required');

  const statement = Object.freeze({
    schema: ATTESTATION_SCHEMA,
    artifact_ref,
    source_revision,
    artifact_sha256: sha256(artifact_bytes),
    signer_ref,
    key_id,
    issued_at_unix_ms,
  });
  const signature = signBytes(null, attestationPayload(statement), private_key).toString('base64');
  return Object.freeze({ ...statement, signature });
}

export function verifyArtifactAttestation({
  attestation,
  artifact_bytes,
  public_key,
  expected_artifact_ref,
  expected_source_revision,
  expected_key_id,
}) {
  if (!attestation || attestation.schema !== ATTESTATION_SCHEMA) {
    return { verified: false, code: 'attestation_schema_invalid' };
  }
  if (!Buffer.isBuffer(artifact_bytes)) {
    return { verified: false, code: 'artifact_bytes_buffer_required' };
  }
  if (attestation.artifact_ref !== expected_artifact_ref) {
    return { verified: false, code: 'attestation_artifact_ref_mismatch' };
  }
  if (attestation.source_revision !== expected_source_revision) {
    return { verified: false, code: 'attestation_source_revision_mismatch' };
  }
  if (attestation.key_id !== expected_key_id) {
    return { verified: false, code: 'attestation_key_id_mismatch' };
  }
  if (attestation.artifact_sha256 !== sha256(artifact_bytes)) {
    return { verified: false, code: 'attestation_artifact_digest_mismatch' };
  }

  let signature;
  try {
    signature = Buffer.from(attestation.signature, 'base64');
  } catch {
    return { verified: false, code: 'attestation_signature_invalid' };
  }
  const verified = verifyBytes(null, attestationPayload(attestation), public_key, signature);
  return verified
    ? {
        verified: true,
        code: 'attestation_verified',
        artifact_ref: attestation.artifact_ref,
        source_revision: attestation.source_revision,
        signer_ref: attestation.signer_ref,
        key_id: attestation.key_id,
      }
    : { verified: false, code: 'attestation_signature_invalid' };
}

function auditHash(record) {
  return sha256(Buffer.from(JSON.stringify([
    record.schema,
    record.event_ref,
    record.occurred_at_unix_ms,
    record.decision,
    record.boundary,
    record.reason_code,
    record.operation_ref,
    record.principal_digest,
    record.provenance_ref,
    record.previous_hash,
  ])));
}

function safePrincipalDigest(principalRef) {
  return sha256(Buffer.from(`oi.security-audit.principal/v1\0${principalRef}`));
}

export class SecurityAuditLedger {
  #events = [];
  #retentionAnchorHash = 'GENESIS';

  constructor({ retention_ms }) {
    if (!Number.isSafeInteger(retention_ms) || retention_ms <= 0) {
      throw new TypeError('retention_ms_positive_integer_required');
    }
    this.retention_ms = retention_ms;
    this.policy = Object.freeze({
      schema: AUDIT_SCHEMA,
      access_scope: AUDIT_READ_SCOPE,
      retention_ms,
      principal_representation: 'sha256-scoped-fingerprint',
      stores_content_payloads: false,
      stores_secret_values: false,
      stores_private_relationship_graph: false,
    });
  }

  append({
    event_ref,
    occurred_at_unix_ms,
    decision,
    boundary,
    reason_code,
    operation_ref,
    principal_ref,
    provenance_ref,
    related_private_refs,
    content,
    secret,
  }) {
    requireText(event_ref, 'event_ref');
    requireText(boundary, 'boundary');
    requireText(reason_code, 'reason_code');
    requireText(operation_ref, 'operation_ref');
    requireText(principal_ref, 'principal_ref');
    requireText(provenance_ref, 'provenance_ref');
    if (!Number.isSafeInteger(occurred_at_unix_ms) || occurred_at_unix_ms < 0) {
      throw new TypeError('occurred_at_unix_ms_required');
    }
    if (decision !== 'allowed' && decision !== 'denied') {
      throw new TypeError('decision_must_be_allowed_or_denied');
    }
    if (related_private_refs !== undefined) {
      throw new TypeError('private_relationship_graph_not_accepted');
    }
    if (content !== undefined) throw new TypeError('content_payload_not_accepted');
    if (secret !== undefined) throw new TypeError('secret_value_not_accepted');
    if (this.#events.some((event) => event.event_ref === event_ref)) {
      throw new TypeError('event_ref_must_be_unique');
    }

    const previous_hash = this.#events.at(-1)?.record_hash ?? this.#retentionAnchorHash;
    const record = {
      schema: AUDIT_SCHEMA,
      event_ref,
      occurred_at_unix_ms,
      decision,
      boundary,
      reason_code,
      operation_ref,
      principal_digest: safePrincipalDigest(principal_ref),
      provenance_ref,
      previous_hash,
    };
    record.record_hash = auditHash(record);
    this.#events.push(Object.freeze(record));
    return Object.freeze({ event_ref, record_hash: record.record_hash });
  }

  explain(event_ref, { scopes = [] } = {}) {
    if (!scopes.includes(AUDIT_READ_SCOPE)) {
      return { permitted: false, code: 'audit_read_scope_required' };
    }
    const event = this.#events.find((candidate) => candidate.event_ref === event_ref);
    if (!event) return { permitted: false, code: 'audit_event_not_found' };
    return { permitted: true, code: 'audit_event_explained', event: { ...event } };
  }

  prune(now_unix_ms) {
    if (!Number.isSafeInteger(now_unix_ms) || now_unix_ms < 0) {
      throw new TypeError('now_unix_ms_required');
    }
    const cutoff = now_unix_ms - this.retention_ms;
    let removed = 0;
    while (this.#events.length > 0 && this.#events[0].occurred_at_unix_ms < cutoff) {
      const [event] = this.#events.splice(0, 1);
      this.#retentionAnchorHash = event.record_hash;
      removed += 1;
    }
    return Object.freeze({ removed, retention_anchor_hash: this.#retentionAnchorHash });
  }

  verifyIntegrity() {
    let previous = this.#retentionAnchorHash;
    for (const event of this.#events) {
      if (event.previous_hash !== previous) return false;
      if (event.record_hash !== auditHash(event)) return false;
      previous = event.record_hash;
    }
    return true;
  }

  snapshotForTest() {
    return this.#events.map((event) => ({ ...event }));
  }
}

export const SECURITY_AUDIT_READ_SCOPE = AUDIT_READ_SCOPE;
export const SECURITY_AUDIT_SCHEMA = AUDIT_SCHEMA;
export const ARTIFACT_ATTESTATION_SCHEMA = ATTESTATION_SCHEMA;
