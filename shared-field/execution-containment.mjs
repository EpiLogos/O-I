// Phase-4 execution-containment conformance oracle.
//
// This module is deliberately NOT an O:I execution dispatcher, grant issuer, or
// authority database. Native owners remain responsible for granting and enforcing
// privileged effects. The oracle gives the permanent adversarial corpus one
// deterministic place to state the non-promotion laws and exact grant bindings
// that every real dispatcher/provider must satisfy.

const TARGET_KINDS = new Set([
  'action',
  'mcp_tool',
  'package_component',
  'workcell_process',
  'native_bridge',
]);

const EFFECT_KEYS = [
  'filesystem_read',
  'filesystem_write',
  'network',
  'secrets',
  'subprocess',
  'native_bridge',
  'dynamic_load',
];

export function evaluateExecutionContainment({ request, grant }) {
  const invalidRequest = validateRequest(request);
  if (invalidRequest) return deny(invalidRequest);
  if (!grant) return deny('execution_grant_required');

  const invalidGrant = validateGrant(grant);
  if (invalidGrant) return deny(invalidGrant);
  if (grant.revoked) return deny('execution_grant_revoked');
  if (grant.remaining_uses <= 0) return deny('execution_grant_exhausted');
  if (request.now_unix_ms < grant.not_before_unix_ms) {
    return deny('execution_grant_not_yet_valid');
  }
  if (request.now_unix_ms >= grant.expires_at_unix_ms) {
    return deny('execution_grant_expired');
  }

  for (const field of [
    'actor_ref',
    'target_kind',
    'target_ref',
    'binding_revision',
    'purpose',
  ]) {
    if (request[field] !== grant[field]) {
      return deny(`execution_grant_${field}_mismatch`);
    }
  }

  for (const key of EFFECT_KEYS) {
    if (request.effects[key] && !grant.effects[key]) {
      return deny(`execution_effect_${key}_not_granted`);
    }
  }

  return {
    permitted: true,
    code: 'execution_authorised',
    grant_ref: grant.grant_ref,
    issuer_ref: grant.issuer_ref,
    operation_id: request.operation_id,
  };
}

export function privilegedEffectKeys() {
  return [...EFFECT_KEYS];
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') return 'execution_request_required';
  for (const field of [
    'operation_id',
    'actor_ref',
    'target_kind',
    'target_ref',
    'binding_revision',
    'purpose',
  ]) {
    if (typeof request[field] !== 'string' || request[field].trim() === '') {
      return `execution_request_${field}_required`;
    }
  }
  if (!TARGET_KINDS.has(request.target_kind)) return 'execution_request_target_kind_invalid';
  if (!Number.isSafeInteger(request.now_unix_ms) || request.now_unix_ms < 0) {
    return 'execution_request_time_invalid';
  }
  if (!request.effects || typeof request.effects !== 'object') {
    return 'execution_request_effects_required';
  }
  for (const key of EFFECT_KEYS) {
    if (typeof request.effects[key] !== 'boolean') {
      return `execution_request_effect_${key}_invalid`;
    }
  }
  return null;
}

function validateGrant(grant) {
  if (!grant || typeof grant !== 'object') return 'execution_grant_required';
  for (const field of [
    'grant_ref',
    'issuer_ref',
    'actor_ref',
    'target_kind',
    'target_ref',
    'binding_revision',
    'purpose',
  ]) {
    if (typeof grant[field] !== 'string' || grant[field].trim() === '') {
      return `execution_grant_${field}_required`;
    }
  }
  if (!TARGET_KINDS.has(grant.target_kind)) return 'execution_grant_target_kind_invalid';
  for (const field of ['not_before_unix_ms', 'expires_at_unix_ms', 'remaining_uses']) {
    if (!Number.isSafeInteger(grant[field]) || grant[field] < 0) {
      return `execution_grant_${field}_invalid`;
    }
  }
  if (grant.expires_at_unix_ms <= grant.not_before_unix_ms) {
    return 'execution_grant_lifetime_invalid';
  }
  if (typeof grant.revoked !== 'boolean') return 'execution_grant_revoked_invalid';
  if (!grant.effects || typeof grant.effects !== 'object') {
    return 'execution_grant_effects_required';
  }
  for (const key of EFFECT_KEYS) {
    if (typeof grant.effects[key] !== 'boolean') {
      return `execution_grant_effect_${key}_invalid`;
    }
  }
  return null;
}

function deny(code) {
  return { permitted: false, code };
}
