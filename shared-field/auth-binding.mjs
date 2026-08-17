const REQUIRED_STRING_FIELDS = [
  'binding_ref',
  'authenticated_principal',
  'assurance_class',
  'bound_subject_ref',
  'bound_subject_kind',
  'provider',
  'proof_provenance',
  'issued_at',
];

export const AUTH_BINDING_VERSION = 'oi.auth-binding/v1';

export const KeyPurpose = Object.freeze({
  WORLD_SIGNING_AUTHENTICATION: 'world-signing-authentication',
  SECRET_STORAGE_ENCRYPTION: 'secret-storage-encryption',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function timestamp(value, field) {
  requiredString(value, field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${field} must be an RFC3339-compatible timestamp`);
  }
  return parsed;
}

function normalizeScope(scope) {
  const values = Array.isArray(scope) ? scope : [scope];
  if (values.length === 0) {
    throw new TypeError('scope must contain at least one value');
  }
  const normalized = values.map((entry) => requiredString(entry, 'scope entry'));
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError('scope entries must be unique');
  }
  return Object.freeze([...normalized]);
}

export function createAuthBinding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('AuthBinding input must be an object');
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    requiredString(input[field], field);
  }
  const issuedAt = timestamp(input.issued_at, 'issued_at');
  const expiresAt = input.expires_at == null ? null : timestamp(input.expires_at, 'expires_at');
  const revokedAt = input.revoked_at == null ? null : timestamp(input.revoked_at, 'revoked_at');
  if (expiresAt != null && expiresAt <= issuedAt) {
    throw new TypeError('expires_at must be later than issued_at');
  }
  if (revokedAt != null && revokedAt < issuedAt) {
    throw new TypeError('revoked_at must not precede issued_at');
  }

  return Object.freeze({
    version: AUTH_BINDING_VERSION,
    binding_ref: input.binding_ref,
    authenticated_principal: input.authenticated_principal,
    assurance_class: input.assurance_class,
    bound_subject_ref: input.bound_subject_ref,
    bound_subject_kind: input.bound_subject_kind,
    scope: normalizeScope(input.scope),
    provider: input.provider,
    proof_provenance: input.proof_provenance,
    issued_at: input.issued_at,
    expires_at: input.expires_at ?? null,
    revoked_at: input.revoked_at ?? null,
  });
}

export function createKeyRoleBinding({ key_ref, purpose }) {
  requiredString(key_ref, 'key_ref');
  if (!Object.values(KeyPurpose).includes(purpose)) {
    throw new TypeError('unknown key purpose');
  }
  return Object.freeze({ key_ref, purpose });
}

export class AuthBindingRegistry {
  #bindings = new Map();

  register(input) {
    const binding = createAuthBinding(input);
    if (this.#bindings.has(binding.binding_ref)) {
      throw new Error(`AuthBinding already exists: ${binding.binding_ref}`);
    }
    this.#bindings.set(binding.binding_ref, binding);
    return binding;
  }

  get(bindingRef) {
    return this.#bindings.get(bindingRef) ?? null;
  }

  bindingsForSubject(subjectRef) {
    requiredString(subjectRef, 'subjectRef');
    return [...this.#bindings.values()].filter(
      (binding) => binding.bound_subject_ref === subjectRef,
    );
  }

  revoke(bindingRef, revokedAt) {
    requiredString(bindingRef, 'bindingRef');
    timestamp(revokedAt, 'revokedAt');
    const current = this.#bindings.get(bindingRef);
    if (!current) {
      throw new Error(`unknown AuthBinding: ${bindingRef}`);
    }
    const next = createAuthBinding({ ...current, revoked_at: revokedAt });
    this.#bindings.set(bindingRef, next);
    return next;
  }

  authenticate({ binding_ref, authenticated_principal, scope, at }) {
    requiredString(binding_ref, 'binding_ref');
    requiredString(authenticated_principal, 'authenticated_principal');
    requiredString(scope, 'scope');
    const atMs = timestamp(at, 'at');
    const binding = this.#bindings.get(binding_ref);
    if (!binding) {
      return Object.freeze({ authenticated: false, reason: 'binding-not-found' });
    }
    if (binding.authenticated_principal !== authenticated_principal) {
      return Object.freeze({ authenticated: false, reason: 'principal-mismatch' });
    }
    if (atMs < timestamp(binding.issued_at, 'issued_at')) {
      return Object.freeze({ authenticated: false, reason: 'not-yet-issued' });
    }
    if (binding.revoked_at != null && atMs >= timestamp(binding.revoked_at, 'revoked_at')) {
      return Object.freeze({ authenticated: false, reason: 'revoked' });
    }
    if (binding.expires_at != null && atMs >= timestamp(binding.expires_at, 'expires_at')) {
      return Object.freeze({ authenticated: false, reason: 'expired' });
    }
    if (!binding.scope.includes(scope)) {
      return Object.freeze({ authenticated: false, reason: 'scope-not-bound' });
    }

    return Object.freeze({
      authenticated: true,
      binding_ref: binding.binding_ref,
      authenticated_principal: binding.authenticated_principal,
      assurance_class: binding.assurance_class,
      bound_subject_ref: binding.bound_subject_ref,
      bound_subject_kind: binding.bound_subject_kind,
      provider: binding.provider,
      proof_provenance: binding.proof_provenance,
    });
  }
}
