import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addressedContribution,
  createParticipantAddress,
  createParticipantTarget,
  privateDialogueField,
} from './addressing.mjs';

const provenance = [{ kind: 'source', ref: 'project:o-i', source_system: 'EpiLogos/O-I', revision: 'main' }];

test('human Agent and AgentSet round-trip through one typed To/@ grammar', () => {
  const address = createParticipantAddress({
    to: [
      { kind: 'human', participant: 'participant:human:satya', address: '@satya' },
      { kind: 'agent', participant: 'agent:developer', address: '@developer' },
      { kind: 'agent-set', participant: 'agent-set:development', address: '@development' },
    ],
    mentions: [{ kind: 'agent', participant: 'agent:reviewer', address: '@reviewer' }],
  });

  assert.equal(address.version, 'aikit.participant-address/v1');
  assert.deepEqual(address.to.map((target) => target.kind), ['human', 'agent', 'agent-set']);
  assert.equal(address.mentions[0].participant, 'agent:reviewer');
  assert.equal(Object.hasOwn(address, 'authority'), false);
  assert.equal(Object.hasOwn(address, 'invocation'), false);
  assert.equal(Object.hasOwn(address, 'attention'), false);
});

test('address grammar rejects malformed and duplicated targets', () => {
  assert.throws(() => createParticipantTarget({ kind: 'agent', participant: 'agent:a', address: 'agent-a' }), /@token/);
  assert.throws(() => createParticipantTarget({ kind: 'synthetic-agent', participant: 'set:a', address: '@a' }), /must be one of/);
  assert.throws(() => createParticipantAddress({
    to: [{ kind: 'agent', participant: 'agent:a', address: '@a' }],
    mentions: [{ kind: 'agent', participant: 'agent:a', address: '@a' }],
  }), /duplicated/);
});

test('addressing attaches to a Contribution without mutating authored representation', () => {
  const contribution = {
    schema: 'oi.contribution/v1',
    contribution_ref: 'contribution:1',
    field_ref: 'field:journey',
    contributor_participant_ref: 'participant:human:satya',
    created_at: '2026-08-31T17:00:00Z',
    mode: 'statement',
    target: { ref: 'journey:o-i', kind: 'factory.journey' },
    relation: { kind: 'addresses' },
    representation: { kind: 'text', payload: 'Please review this.' },
    provenance,
  };
  const representationBefore = JSON.stringify(contribution.representation);
  const addressed = addressedContribution(contribution, createParticipantAddress({
    mentions: [{ kind: 'agent-set', participant: 'agent-set:development', address: '@development' }],
  }));

  assert.equal(JSON.stringify(contribution.representation), representationBefore);
  assert.equal(addressed.addressing.mentions[0].kind, 'agent-set');
  assert.equal(addressed.representation.payload, 'Please review this.');
});

test('private dialogue is a private SharedField and is not an AgentSession lifetime', () => {
  const field = privateDialogueField({
    field_ref: 'field:dialogue:1',
    participant_refs: ['participant:human:satya', 'participant:agent:developer'],
    provenance,
  });

  assert.equal(field.schema, 'oi.shared-field/v1');
  assert.equal(field.kind, 'dialogue');
  assert.equal(field.visibility, 'private');
  assert.deepEqual(field.participant_refs, ['participant:human:satya', 'participant:agent:developer']);
  assert.equal(Object.hasOwn(field, 'agent_session_ref'), false);
});
