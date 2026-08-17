import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AuthBindingRegistry,
  KeyPurpose,
  createKeyRoleBinding,
} from './auth-binding.mjs';

const T0 = '2026-08-17T10:00:00Z';
const T1 = '2026-08-17T10:05:00Z';
const T2 = '2026-08-17T10:10:00Z';

function authenticator(overrides = {}) {
  return {
    binding_ref: 'auth-binding:passkey-a',
    authenticated_principal: 'webauthn-credential:cred-a',
    assurance_class: 'webauthn-user-verified',
    bound_subject_ref: 'participant:alice',
    bound_subject_kind: 'participant',
    scope: ['hosted-sign-in'],
    provider: 'webauthn:example.test',
    proof_provenance: 'webauthn-assertion:fixture-a',
    issued_at: T0,
    ...overrides,
  };
}

test('one semantic participant survives authenticator replacement', () => {
  const registry = new AuthBindingRegistry();
  registry.register(authenticator());
  registry.revoke('auth-binding:passkey-a', T1);
  registry.register(authenticator({
    binding_ref: 'auth-binding:passkey-b',
    authenticated_principal: 'oidc-principal:issuer.example/sub-b',
    assurance_class: 'oidc-code-pkce',
    provider: 'oidc:https://issuer.example',
    proof_provenance: 'oidc-id-token:fixture-b',
  }));

  assert.deepEqual(
    registry.bindingsForSubject('participant:alice').map((binding) => binding.bound_subject_ref),
    ['participant:alice', 'participant:alice'],
  );
  assert.equal(
    registry.authenticate({
      binding_ref: 'auth-binding:passkey-b',
      authenticated_principal: 'oidc-principal:issuer.example/sub-b',
      scope: 'hosted-sign-in',
      at: T2,
    }).bound_subject_ref,
    'participant:alice',
  );
});

test('multiple lawful authenticators bind independently to one subject', () => {
  const registry = new AuthBindingRegistry();
  registry.register(authenticator());
  registry.register(authenticator({
    binding_ref: 'auth-binding:device-b',
    authenticated_principal: 'device-key:device-b',
    assurance_class: 'local-signature',
    scope: ['local-world-signing'],
    provider: 'native-ed25519',
    proof_provenance: 'signature:fixture-b',
  }));

  const bindings = registry.bindingsForSubject('participant:alice');
  assert.equal(bindings.length, 2);
  assert.notEqual(bindings[0].authenticated_principal, bindings[1].authenticated_principal);
});

test('revoked authenticator loses authentication capability without changing subject identity', () => {
  const registry = new AuthBindingRegistry();
  registry.register(authenticator());
  registry.revoke('auth-binding:passkey-a', T1);

  assert.deepEqual(
    registry.authenticate({
      binding_ref: 'auth-binding:passkey-a',
      authenticated_principal: 'webauthn-credential:cred-a',
      scope: 'hosted-sign-in',
      at: T2,
    }),
    { authenticated: false, reason: 'revoked' },
  );
  assert.equal(registry.get('auth-binding:passkey-a').bound_subject_ref, 'participant:alice');
});

test('possession of ParticipantRef is not authentication proof', () => {
  const registry = new AuthBindingRegistry();
  registry.register(authenticator());

  assert.deepEqual(
    registry.authenticate({
      binding_ref: 'auth-binding:passkey-a',
      authenticated_principal: 'participant:alice',
      scope: 'hosted-sign-in',
      at: T1,
    }),
    { authenticated: false, reason: 'principal-mismatch' },
  );
});

test('SpaceTimeDB Identity remains a provider runtime principal rather than ParticipantRef', () => {
  const registry = new AuthBindingRegistry();
  const binding = registry.register(authenticator({
    binding_ref: 'auth-binding:spacetimedb-runtime',
    authenticated_principal: 'spacetimedb-identity:0x9ad0',
    assurance_class: 'spacetimedb-runtime-token',
    provider: 'spacetimedb:2.8.1',
    proof_provenance: 'spacetimedb-runtime-session:fixture',
  }));

  assert.notEqual(binding.authenticated_principal, binding.bound_subject_ref);
  assert.equal(binding.bound_subject_ref, 'participant:alice');
});

test('AgentSession or workload principal does not become AgentRef', () => {
  const registry = new AuthBindingRegistry();
  const binding = registry.register(authenticator({
    binding_ref: 'auth-binding:workload-a',
    authenticated_principal: 'spiffe://example.test/workload/run-42',
    assurance_class: 'spiffe-x509-svid',
    bound_subject_ref: 'agent:parasakti',
    bound_subject_kind: 'agent',
    scope: ['workload-service-call'],
    provider: 'spire:1.15.2',
    proof_provenance: 'x509-svid:fixture-a',
  }));

  assert.notEqual(binding.authenticated_principal, binding.bound_subject_ref);
  assert.equal(binding.bound_subject_ref, 'agent:parasakti');
});

test('world signing key replacement does not rewrite world identity and cannot be reused as secret-storage key', () => {
  const worldRef = 'world:local-primary';
  const oldSigning = createKeyRoleBinding({
    key_ref: 'key:world-signing-v1',
    purpose: KeyPurpose.WORLD_SIGNING_AUTHENTICATION,
  });
  const newSigning = createKeyRoleBinding({
    key_ref: 'key:world-signing-v2',
    purpose: KeyPurpose.WORLD_SIGNING_AUTHENTICATION,
  });
  const encryption = createKeyRoleBinding({
    key_ref: 'key:secret-store-v1',
    purpose: KeyPurpose.SECRET_STORAGE_ENCRYPTION,
  });

  assert.equal(worldRef, 'world:local-primary');
  assert.notEqual(oldSigning.key_ref, newSigning.key_ref);
  assert.notEqual(newSigning.key_ref, encryption.key_ref);
  assert.notEqual(newSigning.purpose, encryption.purpose);
});

test('AuthBinding conveys authentication only, never participation authority or trust', () => {
  const registry = new AuthBindingRegistry();
  const result = registry.authenticate({
    binding_ref: registry.register(authenticator()).binding_ref,
    authenticated_principal: 'webauthn-credential:cred-a',
    scope: 'hosted-sign-in',
    at: T1,
  });

  assert.equal(result.authenticated, true);
  assert.equal('authority' in result, false);
  assert.equal('trust' in result, false);
  assert.equal('participation' in result, false);
});
