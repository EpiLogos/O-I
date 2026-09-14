import assert from 'node:assert/strict';
import test from 'node:test';

import { createParticipant } from './index.mjs';
import { createExploreSurfaceModel, EXPLORE_SURFACE_SEED_SCHEMA } from './explore-surface.mjs';
import { createA2aBinding, createA2aPresence } from './a2a.mjs';
import { searchA2aParticipation } from './a2a-explore.mjs';

const fieldRef = 'field:o-i:public';
const agentRef = 'agent:parasakti';
const participantRef = 'participant:public:parasakti';

const explore = createExploreSurfaceModel({
  schema: EXPLORE_SURFACE_SEED_SCHEMA,
  entries: [{
    ref: agentRef,
    kind: 'agent',
    world_ref: 'world:agent:parasakti',
    label: 'Parāśakti',
    aliases: ['Parasakti'],
    provenance: [{ kind: 'agent-projection', ref: agentRef, source_system: 'Actuation', revision: 'agent@1' }],
    locators: [],
  }],
  relations: [],
  presentations: [],
  presentation_projections: [],
});

const participant = createParticipant({
  participant_ref: participantRef,
  field_ref: fieldRef,
  identity: { kind: 'agent', ref: agentRef },
  presentation: { world_ref: 'world:agent:parasakti' },
  provenance: { source_system: 'Actuation', source_revision: 'agent@1' },
});

const binding = createA2aBinding({
  binding_ref: 'a2a-binding:parasakti',
  field_ref: fieldRef,
  participant_ref: participantRef,
  agent_ref: agentRef,
  publisher_participant_ref: participantRef,
  publication_decision_ref: 'decision:publish:a2a:parasakti:1',
  source_revision: 'agent@1',
  projection_ref: 'projection:a2a:parasakti',
  published_at: '2026-08-16T21:00:00.000Z',
  endpoint_url: 'https://agent.example/a2a',
  agent_card_url: 'https://agent.example/.well-known/agent-card.json',
  provenance: [{ kind: 'agent-projection', ref: agentRef, source_system: 'O:I', revision: '1' }],
});

const presence = createA2aPresence({
  binding_ref: binding.binding_ref,
  field_ref: fieldRef,
  participant_ref: participantRef,
  availability: 'online',
  sequence: 1,
  observed_at: '2026-08-16T21:01:00.000Z',
  provenance: [{ kind: 'reachability-observation', ref: 'probe:parasakti:1', source_system: 'O:I' }],
});

test('Explore/search Agent resolves by semantic ref through Participant to explicit binding and live presence', () => {
  const found = searchA2aParticipation({
    explore,
    query: 'Parasakti',
    participants: [participant],
    bindings: [binding],
    presence: [presence],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].explore.ref, agentRef);
  assert.equal(found[0].participation.participant.participant_ref, participantRef);
  assert.equal(found[0].participation.binding.binding_ref, binding.binding_ref);
  assert.equal(found[0].participation.presence.availability, 'online');
  assert.notEqual(found[0].explore.ref, found[0].participation.participant.participant_ref);
  assert.notEqual(found[0].participation.binding.endpoint_url, found[0].explore.ref);
});

test('Explore Agent remains discoverable after A2A publication disappears', () => {
  const found = searchA2aParticipation({
    explore,
    query: 'Parāśakti',
    participants: [participant],
    bindings: [],
    presence: [],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].explore.ref, agentRef);
  assert.equal(found[0].participation.participant.participant_ref, participantRef);
  assert.equal(found[0].participation.binding, undefined);
});
