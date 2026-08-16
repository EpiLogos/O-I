import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createParticipant } from './index.mjs';
import {
  admitA2aDifference,
  createA2aBinding,
  createA2aPresence,
  encounterA2aDifference,
  performA2aExchange,
  resolveA2aParticipation,
} from './a2a.mjs';
import { reviseA2aBinding, withdrawA2aBinding } from './a2a-lifecycle.mjs';
import { a2aSnapshotFromRows } from './spacetimedb-a2a.mjs';

const FIELD = 'field:o-i:shared';
const AGENT = 'agent:remote:canonical';
const PARTICIPANT = 'participant:remote:canonical';
const LOCAL_PARTICIPANT = 'participant:local:canonical';

function agentParticipant() {
  return createParticipant({
    participant_ref: PARTICIPANT,
    field_ref: FIELD,
    identity: { kind: 'agent', ref: AGENT },
    presentation: { label: 'Remote agent' },
    provenance: { source_system: 'Actuation', source_revision: 'agent@7' },
  });
}

function provenance(ref = 'projection:agent:7') {
  return [{ kind: 'agent-projection', ref, source_system: 'O:I', revision: '7' }];
}

function binding(endpointUrl, cardUrl, overrides = {}) {
  return createA2aBinding({
    binding_ref: 'a2a-binding:remote',
    binding_revision: 1,
    field_ref: FIELD,
    participant_ref: PARTICIPANT,
    agent_ref: AGENT,
    publisher_participant_ref: PARTICIPANT,
    publication_decision_ref: 'decision:publish:a2a:1',
    source_revision: 'agent@7',
    published_at: '2026-08-16T21:00:00.000Z',
    endpoint_url: endpointUrl,
    agent_card_url: cardUrl,
    provenance: provenance(),
    ...overrides,
  });
}

function online(currentBinding, sequence = 1) {
  return createA2aPresence({
    binding_ref: currentBinding.binding_ref,
    field_ref: currentBinding.field_ref,
    participant_ref: currentBinding.participant_ref,
    availability: 'online',
    sequence,
    observed_at: '2026-08-16T21:01:00.000Z',
    provenance: [{ kind: 'reachability-observation', ref: `probe:${sequence}`, source_system: 'O:I' }],
  });
}

async function withA2aServer(fn) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === '/.well-known/agent-card.json') {
      const port = server.address().port;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        // Deliberately adversarial: card metadata tries to look canonical. The adapter must ignore it.
        name: AGENT,
        description: 'Conformance fixture',
        version: '1.0.1-fixture',
        supportedInterfaces: [{
          url: `http://127.0.0.1:${port}/a2a`,
          protocolBinding: 'HTTP+JSON',
          protocolVersion: '1.0',
          agentRef: 'agent:malicious-card-claim',
          participantRef: 'participant:malicious-card-claim',
        }],
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      }));
      return;
    }

    if (req.url === '/a2a/message:send' && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({ headers: req.headers, body });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/a2a+json');
      if (body.message.parts?.[0]?.text === 'return task') {
        res.end(JSON.stringify({
          task: {
            id: 'a2a-task:fixture-1',
            contextId: 'ctx:fixture',
            status: { state: 'TASK_STATE_COMPLETED' },
            artifacts: [{ artifactId: 'artifact:fixture-1', name: 'result', parts: [{ text: 'returned difference' }] }],
          },
        }));
      } else {
        res.end(JSON.stringify({
          message: {
            messageId: 'a2a-message:response-1',
            role: 'ROLE_AGENT',
            parts: [{ text: 'returned difference' }],
          },
        }));
      }
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await fn({
      endpointUrl: `http://127.0.0.1:${port}/a2a`,
      cardUrl: `http://127.0.0.1:${port}/.well-known/agent-card.json`,
      requests,
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('publication is explicit and Agent, Participant, binding and transport identities cannot collapse', () => {
  assert.throws(() => createA2aBinding({
    binding_ref: AGENT,
    field_ref: FIELD,
    participant_ref: PARTICIPANT,
    agent_ref: AGENT,
    publisher_participant_ref: PARTICIPANT,
    source_revision: 'agent@7',
    published_at: '2026-08-16T21:00:00.000Z',
    endpoint_url: 'https://agent.example/a2a',
    agent_card_url: 'https://agent.example/.well-known/agent-card.json',
    provenance: provenance(),
  }), /publication_decision_ref|must remain distinct/);

  assert.throws(() => binding('https://user:secret@agent.example/a2a', 'https://agent.example/.well-known/agent-card.json'), /credentials/);
  assert.throws(() => binding('https://agent.example/a2a?token=secret', 'https://agent.example/.well-known/agent-card.json'), /query credentials/);
});

test('semantic Agent resolves through Participant to binding and presence without using SpaceTimeDB row IDs', () => {
  const current = binding('https://agent.example/a2a', 'https://agent.example/.well-known/agent-card.json');
  const currentPresence = online(current);
  const resolved = resolveA2aParticipation({
    agent_ref: AGENT,
    participants: [agentParticipant()],
    bindings: [current],
    presence: [currentPresence],
  });

  assert.equal(resolved.agent_ref, AGENT);
  assert.equal(resolved.participant.participant_ref, PARTICIPANT);
  assert.equal(resolved.binding.binding_ref, 'a2a-binding:remote');
  assert.equal(resolved.presence.availability, 'online');
  assert.notEqual(resolved.agent_ref, resolved.participant.participant_ref);
  assert.notEqual(resolved.binding.binding_ref, resolved.participant.participant_ref);
});

test('SpaceTimeDB adapter validates semantic columns independently of implementation row IDs', () => {
  const current = binding('https://agent.example/a2a', 'https://agent.example/.well-known/agent-card.json');
  const currentPresence = online(current);
  const snapshot = a2aSnapshotFromRows({
    a2aBindings: [{
      rowId: 991n,
      bindingRef: current.binding_ref,
      bindingRevision: current.binding_revision,
      fieldRef: current.field_ref,
      participantRef: current.participant_ref,
      agentRef: current.agent_ref,
      publisherParticipantRef: current.publisher_participant_ref,
      publicationDecisionRef: current.publication_decision_ref,
      sourceRevision: current.source_revision,
      state: current.state,
      protocolVersion: current.protocol_version,
      protocolBinding: current.protocol_binding,
      endpointUrl: current.endpoint_url,
      agentCardUrl: current.agent_card_url,
      contractJson: JSON.stringify(current),
    }],
    a2aPresence: [{
      rowId: 992n,
      bindingRef: currentPresence.binding_ref,
      fieldRef: currentPresence.field_ref,
      participantRef: currentPresence.participant_ref,
      availability: currentPresence.availability,
      sequence: 1n,
      contractJson: JSON.stringify(currentPresence),
    }],
  });

  assert.equal(snapshot.bindings[0].binding_ref, 'a2a-binding:remote');
  assert.equal(snapshot.implementation.bindings[0].row_id, '991');
  assert.notEqual(snapshot.implementation.bindings[0].row_id, snapshot.bindings[0].binding_ref);
});

test('source-faithful HTTP+JSON v1 exchange keeps Agent Card claims transport-only', async () => {
  await withA2aServer(async ({ endpointUrl, cardUrl, requests }) => {
    const current = binding(endpointUrl, cardUrl);
    const difference = await performA2aExchange({
      binding: current,
      presence: online(current),
      initiator_participant_ref: LOCAL_PARTICIPANT,
      message: { message_id: 'a2a-message:request-1', text: 'hello' },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers['content-type'], 'application/a2a+json');
    assert.equal(requests[0].headers['a2a-version'], '1.0');
    assert.equal(requests[0].body.message.role, 'ROLE_USER');
    assert.equal(requests[0].body.message.messageId, 'a2a-message:request-1');
    assert.equal(difference.transport_result.kind, 'message');
    assert.equal(difference.agent_ref, AGENT);
    assert.equal(difference.recipient_participant_ref, PARTICIPANT);
    assert.equal(difference.transport_provenance.agent_card.name, AGENT);
    assert.equal(difference.admission, 'pending');
    assert.equal('contribution_ref' in difference, false);
    assert.equal('projection_ref' in difference, false);
    assert.equal('determination_ref' in difference, false);
    assert.equal('run_ref' in difference, false);
  });
});

test('A2A Task and Artifact remain transport results until an explicit admission decision', async () => {
  await withA2aServer(async ({ endpointUrl, cardUrl }) => {
    const current = binding(endpointUrl, cardUrl);
    const difference = await performA2aExchange({
      binding: current,
      presence: online(current),
      initiator_participant_ref: LOCAL_PARTICIPANT,
      message: { message_id: 'a2a-message:request-task', text: 'return task', exchange_ref: 'a2a-exchange:task-proof' },
    });

    assert.equal(difference.transport_result.kind, 'task');
    assert.equal(difference.transport_result.ref, 'a2a-task:fixture-1');
    assert.ok(difference.transport_result.payload.task.artifacts[0]);
    assert.equal(difference.admission, 'pending');
    assert.equal('contribution' in difference, false);
    assert.equal('projection' in difference, false);

    const rejected = admitA2aDifference(difference, {
      decision_ref: 'decision:reject:return-1',
      decided_by_participant_ref: LOCAL_PARTICIPANT,
      decided_at: '2026-08-16T21:02:00.000Z',
      disposition: 'reject',
    });
    assert.equal('contribution' in rejected, false);
    assert.equal('projection' in rejected, false);

    const admitted = admitA2aDifference(difference, {
      decision_ref: 'decision:admit:return-1',
      decided_by_participant_ref: LOCAL_PARTICIPANT,
      decided_at: '2026-08-16T21:03:00.000Z',
      disposition: 'contribution+projection',
      contribution: {
        contribution_ref: 'contribution:a2a:return-1',
        target: { ref: 'project:o-i', kind: 'project' },
      },
      projection: { projection_ref: 'projection:a2a:return-1' },
    });

    assert.equal(admitted.contribution.schema, 'oi.contribution/v1');
    assert.equal(admitted.projection.schema, 'oi.projection/v1');
    assert.equal(admitted.contribution.provenance[0].ref, difference.exchange_ref);
    assert.equal(admitted.projection.provenance[1].ref, 'decision:admit:return-1');
    assert.equal('determination_ref' in admitted, false);
    assert.equal('run_ref' in admitted, false);
  });
});

test('endpoint replacement and withdrawal preserve semantic Agent/Participant identity and require fresh publication decisions', () => {
  const first = binding('https://one.example/a2a', 'https://one.example/.well-known/agent-card.json');
  assert.throws(() => reviseA2aBinding(first, {
    publication_decision_ref: first.publication_decision_ref,
    source_revision: 'agent@8',
    published_at: '2026-08-16T21:10:00.000Z',
    endpoint_url: 'https://two.example/a2a',
    agent_card_url: 'https://two.example/.well-known/agent-card.json',
  }), /fresh explicit publication decision/);

  const replacement = reviseA2aBinding(first, {
    publication_decision_ref: 'decision:publish:a2a:2',
    source_revision: 'agent@8',
    published_at: '2026-08-16T21:10:00.000Z',
    endpoint_url: 'https://two.example/a2a',
    agent_card_url: 'https://two.example/.well-known/agent-card.json',
  });
  assert.equal(replacement.binding_ref, first.binding_ref);
  assert.equal(replacement.binding_revision, 2);
  assert.equal(replacement.agent_ref, AGENT);
  assert.equal(replacement.participant_ref, PARTICIPANT);
  assert.notEqual(replacement.endpoint_url, first.endpoint_url);

  const withdrawn = withdrawA2aBinding(replacement, {
    publication_decision_ref: 'decision:withdraw:a2a:3',
    source_revision: 'agent@9',
    published_at: '2026-08-16T21:11:00.000Z',
  });
  assert.equal(withdrawn.state, 'withdrawn');
  assert.equal(withdrawn.binding_revision, 3);
  assert.equal(withdrawn.agent_ref, AGENT);
  assert.equal(withdrawn.participant_ref, PARTICIPANT);
  assert.equal('endpoint_url' in withdrawn, false);
  assert.equal('agent_card_url' in withdrawn, false);
});

test('endpoint disappearance blocks exchange without deleting Participant or Agent identity', async () => {
  const current = binding('https://agent.example/a2a', 'https://agent.example/.well-known/agent-card.json');
  const offline = createA2aPresence({
    ...online(current),
    sequence: 2,
    availability: 'offline',
    observed_at: '2026-08-16T21:12:00.000Z',
  });
  let called = false;
  await assert.rejects(() => performA2aExchange({
    binding: current,
    presence: offline,
    initiator_participant_ref: LOCAL_PARTICIPANT,
    message: { message_id: 'a2a-message:offline', text: 'hello' },
    fetch_impl: async () => { called = true; throw new Error('must not call'); },
  }), /not currently reachable/);
  assert.equal(called, false);
  const resolved = resolveA2aParticipation({ agent_ref: AGENT, participants: [agentParticipant()], bindings: [current], presence: [offline] });
  assert.equal(resolved.agent_ref, AGENT);
  assert.equal(resolved.participant.participant_ref, PARTICIPANT);
  assert.equal(resolved.presence.availability, 'offline');
});

test('A2A Encounter records mediation/provenance without imputing subjective state', () => {
  const difference = {
    schema: 'oi.a2a-difference/v1',
    exchange_ref: 'a2a-exchange:encounter-1',
    field_ref: FIELD,
    initiator_participant_ref: LOCAL_PARTICIPANT,
    recipient_participant_ref: PARTICIPANT,
    agent_ref: AGENT,
    binding_ref: 'a2a-binding:remote',
    binding_revision: 4,
    request_message_id: 'a2a-message:encounter-1',
    transport_result: { kind: 'message', ref: 'a2a-message:return-encounter', payload: { message: { messageId: 'a2a-message:return-encounter' } } },
    admission: 'pending',
    transport_provenance: { protocol: 'A2A', protocol_version: '1.0', protocol_binding: 'HTTP+JSON' },
  };
  const encounter = encounterA2aDifference(difference, {
    encounter_ref: 'encounter:a2a:1',
    participant_ref: LOCAL_PARTICIPANT,
    occurred_at: '2026-08-16T21:20:00.000Z',
  });
  assert.equal(encounter.schema, 'oi.encounter/v1');
  assert.equal(encounter.mediation.kind, 'direct-address');
  assert.equal(encounter.mediation.protocol, 'A2A');
  assert.equal(encounter.provenance[0].ref, 'a2a-exchange:encounter-1');
  assert.equal('believed' in encounter, false);
  assert.equal('understood' in encounter, false);
  assert.equal('subjective_state' in encounter, false);
});
