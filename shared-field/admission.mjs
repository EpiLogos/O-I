export const ADMISSION_SCHEMA = 'oi.admission/v1';
export const CONTRIBUTION_INGRESS_RECEIPT_SCHEMA = 'oi.contribution-ingress-receipt/v1';
export const CONTRIBUTION_INDEX_DECISION_SCHEMA = 'oi.contribution-index-decision/v1';

const DISPOSITIONS = new Set(['admitted', 'rejected', 'withdrawn']);
const VISIBILITIES = new Set(['public', 'restricted', 'private']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function requireTimestamp(value, name) {
  requireString(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function validateRef(value, name) {
  const ref = requireRecord(value, name);
  requireString(ref.ref, `${name}.ref`);
  requireString(ref.kind, `${name}.kind`);
  if (ref.revision !== undefined) requireString(ref.revision, `${name}.revision`);
  return clone(ref);
}

/**
 * Portable evidence that the receiving field made an Admission decision.
 *
 * This is not a sender request and it is not a trust/canon/execution grant. Hosted
 * reducers construct the authoritative decision from private quarantine state and the
 * runtime caller; client-provided copies of this object never drive Admission.
 */
export function createAdmission(input) {
  requireRecord(input, 'admission');
  requireString(input.decision_ref, 'admission.decision_ref');
  requireString(input.field_ref, 'admission.field_ref');
  const subject = validateRef(input.subject, 'admission.subject');
  if (subject.kind !== 'oi.contribution-ingress') {
    throw new TypeError('admission.subject.kind must be oi.contribution-ingress');
  }
  requireString(input.disposition, 'admission.disposition');
  if (!DISPOSITIONS.has(input.disposition)) {
    throw new TypeError(`admission.disposition must be one of ${[...DISPOSITIONS].join(', ')}`);
  }
  requireString(input.admission_actor_ref, 'admission.admission_actor_ref');
  requireTimestamp(input.decided_at, 'admission.decided_at');
  requireString(input.reason, 'admission.reason');
  const evidence = requireRecord(input.evidence, 'admission.evidence');
  const provenance = requireRecord(input.provenance, 'admission.provenance');

  const output = {
    schema: ADMISSION_SCHEMA,
    decision_ref: input.decision_ref,
    field_ref: input.field_ref,
    subject,
    disposition: input.disposition,
    admission_actor_ref: input.admission_actor_ref,
    decided_at: input.decided_at,
    reason: input.reason,
    evidence: clone(evidence),
    provenance: clone(provenance),
  };

  if (input.visibility !== undefined) {
    requireString(input.visibility, 'admission.visibility');
    if (!VISIBILITIES.has(input.visibility)) {
      throw new TypeError(`admission.visibility must be one of ${[...VISIBILITIES].join(', ')}`);
    }
    output.visibility = input.visibility;
  }
  if (input.audience_refs !== undefined) {
    if (!Array.isArray(input.audience_refs)) throw new TypeError('admission.audience_refs must be an array');
    output.audience_refs = input.audience_refs.map((ref, index) => requireString(ref, `admission.audience_refs[${index}]`));
  }
  return output;
}

export function validateAdmission(value) {
  requireRecord(value, 'admission');
  if (value.schema !== ADMISSION_SCHEMA) throw new TypeError(`Unsupported Admission schema: ${value.schema}`);
  return createAdmission(value);
}

/** Minimal caller-scoped receipt for material accepted into server quarantine. */
export function createContributionIngressReceipt(input) {
  requireRecord(input, 'contribution ingress receipt');
  requireString(input.ingress_ref, 'contribution ingress receipt.ingress_ref');
  requireString(input.field_ref, 'contribution ingress receipt.field_ref');
  requireString(input.contribution_ref, 'contribution ingress receipt.contribution_ref');
  requireString(input.state, 'contribution ingress receipt.state');
  if (!['quarantined', 'admitted', 'rejected', 'withdrawn'].includes(input.state)) {
    throw new TypeError('contribution ingress receipt.state is unsupported');
  }
  requireTimestamp(input.received_at, 'contribution ingress receipt.received_at');
  requireString(input.payload_fingerprint, 'contribution ingress receipt.payload_fingerprint');
  return {
    schema: CONTRIBUTION_INGRESS_RECEIPT_SCHEMA,
    ingress_ref: input.ingress_ref,
    field_ref: input.field_ref,
    contribution_ref: input.contribution_ref,
    state: input.state,
    received_at: input.received_at,
    payload_fingerprint: input.payload_fingerprint,
  };
}

export function validateContributionIngressReceipt(value) {
  requireRecord(value, 'contribution ingress receipt');
  if (value.schema !== CONTRIBUTION_INGRESS_RECEIPT_SCHEMA) {
    throw new TypeError(`Unsupported Contribution ingress receipt schema: ${value.schema}`);
  }
  return createContributionIngressReceipt(value);
}

/**
 * Explicit receiving-side index decision. It remains separate from Admission even if a
 * future provider chooses to transact both decisions together.
 */
export function createContributionIndexDecision(input) {
  requireRecord(input, 'contribution index decision');
  requireString(input.decision_ref, 'contribution index decision.decision_ref');
  requireString(input.field_ref, 'contribution index decision.field_ref');
  const subject = validateRef(input.subject, 'contribution index decision.subject');
  if (subject.kind !== 'oi.contribution-ingress') {
    throw new TypeError('contribution index decision.subject.kind must be oi.contribution-ingress');
  }
  if (typeof input.eligible !== 'boolean') throw new TypeError('contribution index decision.eligible must be boolean');
  requireString(input.decision_actor_ref, 'contribution index decision.decision_actor_ref');
  requireTimestamp(input.decided_at, 'contribution index decision.decided_at');
  requireString(input.reason, 'contribution index decision.reason');
  return {
    schema: CONTRIBUTION_INDEX_DECISION_SCHEMA,
    decision_ref: input.decision_ref,
    field_ref: input.field_ref,
    subject,
    eligible: input.eligible,
    decision_actor_ref: input.decision_actor_ref,
    decided_at: input.decided_at,
    reason: input.reason,
    evidence: clone(requireRecord(input.evidence, 'contribution index decision.evidence')),
  };
}

export function validateContributionIndexDecision(value) {
  requireRecord(value, 'contribution index decision');
  if (value.schema !== CONTRIBUTION_INDEX_DECISION_SCHEMA) {
    throw new TypeError(`Unsupported Contribution index decision schema: ${value.schema}`);
  }
  return createContributionIndexDecision(value);
}
