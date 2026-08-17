import assert from 'node:assert/strict';
import http from 'node:http';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import {
  admitA2aDifference,
  createA2aBinding,
  createA2aPresence,
  performA2aExchange,
  prepareA2aContributionIngress,
} from '../a2a.mjs';
import {
  createA2aBindingProjection,
  createA2aPresenceExploreEntry,
  createSpacetimeA2aSource,
} from '../spacetimedb-a2a.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_A2A_DATABASE ?? 'oi-shared-field-a2a-ci';
const TIMEOUT_MS = 10_000;
const FIELD_REF = 'oi:field:a2a-phase2-adapter';
const OWNER_PARTICIPANT_REF = 'participant:a2a:p2-owner';
const AGENT_PARTICIPANT_REF = 'participant:a2a:p2-remote';
const AGENT_REF = 'agent:a2a:p2-remote';
const BINDING_REF = 'a2a-binding:p2-remote';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect() {
  return new Promise<{ conn: DbConnection; identity: any }>((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn, identity) => resolve({ conn, identity }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribe(conn: DbConnection, queries: string[]) {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx, error) => reject(error)).subscribe(queries);
  });
}

function participantArgs(value: any) {
  return {
    participantRef: value.participant_ref,
    fieldRef: value.field_ref,
    identityKind: value.identity.kind,
    identityRef: value.identity.ref,
    sourceSystem: value.provenance.source_system,
    sourceRevision: value.provenance.source_revision,
    contractJson: JSON.stringify(value),
  };
}

function projectionArgs(fieldRef: string, value: any) {
  return {
    projectionKey: projectionStorageKey(value.projection_ref, value.projection_revision),
    fieldRef,
    projectionRef: value.projection_ref,
    projectionRevision: value.projection_revision,
    sourceRevision: value.source.revision,
    publisherParticipantRef: value.publisher_participant_ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

function exploreArgs(fieldRef: string, value: any) {
  return {
    semanticRef: value.ref,
    fieldRef,
    worldRef: value.world_ref,
    kind: value.kind,
    label: value.label,
    revision: value.revision ?? '',
    entryJson: JSON.stringify(value),
  };
}

async function startFixture() {
  const requests: any[] = [];
  const server = http.createServer(async (req, res) => {
    const port = (server.address() as any).port;
    if (req.url === '/.well-known/agent-card.json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        name: 'Phase2 A2A adapter fixture',
        version: '1-fixture',
        supportedInterfaces: [{ url: `http://127.0.0.1:${port}/a2a`, protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }],
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      }));
      return;
    }
    if (req.url === '/a2a/message:send' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.setHeader('content-type', 'application/a2a+json');
      res.end(JSON.stringify({
        task: {
          id: 'a2a-task:p2-return',
          contextId: 'ctx:p2',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [{ artifactId: 'a2a-artifact:p2-return', name: 'difference', parts: [{ text: 'untrusted returned material' }] }],
        },
      }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  return {
    server,
    requests,
    endpoint: `http://127.0.0.1:${port}/a2a`,
    card: `http://127.0.0.1:${port}/.well-known/agent-card.json`,
  };
}

const fixture = await startFixture();
const [owner, agent] = await Promise.all([connect(), connect()]);

try {
  for (const client of [owner, agent]) {
    await subscribe(client.conn, [
      'SELECT * FROM shared_field',
      'SELECT * FROM participant',
      'SELECT * FROM projection',
      'SELECT * FROM explore_entry',
      'SELECT * FROM my_field_authority',
    ]);
  }

  const field = {
    schema: 'oi.shared-field/v1',
    field_ref: FIELD_REF,
    kind: 'public',
    visibility: 'public',
    title: 'Phase 2 A2A ingress adapter acceptance',
    provenance: [{ kind: 'acceptance-fixture', ref: 'fixture:a2a:p2', source_system: 'O:I', revision: '1' }],
  };
  await owner.conn.reducers.putSharedField({ fieldRef: FIELD_REF, kind: 'public', visibility: 'public', contractJson: JSON.stringify(field) });

  const ownerParticipant = createParticipant({
    participant_ref: OWNER_PARTICIPANT_REF,
    field_ref: FIELD_REF,
    identity: { kind: 'human', ref: 'human:a2a:p2-owner' },
    presentation: { world_ref: 'world:a2a:p2-owner' },
    provenance: { source_system: 'O:I', source_revision: 'owner@1' },
  });
  const agentParticipant = createParticipant({
    participant_ref: AGENT_PARTICIPANT_REF,
    field_ref: FIELD_REF,
    identity: { kind: 'agent', ref: AGENT_REF },
    presentation: { world_ref: 'world:a2a:p2-remote' },
    provenance: { source_system: 'Actuation', source_revision: 'agent@1' },
  });
  await owner.conn.reducers.putParticipant(participantArgs(ownerParticipant));
  await owner.conn.reducers.putParticipant(participantArgs(agentParticipant));
  await owner.conn.reducers.grantParticipantAuthority({ fieldRef: FIELD_REF, participantRef: OWNER_PARTICIPANT_REF, targetIdentity: owner.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
  await owner.conn.reducers.grantParticipantAuthority({ fieldRef: FIELD_REF, participantRef: AGENT_PARTICIPANT_REF, targetIdentity: agent.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });

  const agentEntry = {
    schema: 'oi.explore-entry/v1', ref: AGENT_REF, kind: 'agent', world_ref: 'world:a2a:p2-remote', label: 'Phase2 Remote A2A Agent',
    provenance: [{ kind: 'agent-projection', ref: AGENT_REF, source_system: 'Actuation', revision: 'agent@1' }], locators: [],
  };
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, agentEntry));

  const binding = createA2aBinding({
    binding_ref: BINDING_REF,
    binding_revision: 1,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    agent_ref: AGENT_REF,
    publisher_participant_ref: AGENT_PARTICIPANT_REF,
    publication_decision_ref: 'decision:a2a:p2-publish',
    source_revision: 'agent@1',
    projection_ref: 'projection:a2a:p2-binding',
    published_at: '2026-08-17T09:00:00.000Z',
    endpoint_url: fixture.endpoint,
    agent_card_url: fixture.card,
    provenance: [{ kind: 'explicit-publication', ref: 'decision:a2a:p2-publish', source_system: 'O:I', revision: '1' }],
  });
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(binding)));
  const presence = createA2aPresence({
    binding_ref: BINDING_REF,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    availability: 'online',
    sequence: 1,
    observed_at: '2026-08-17T09:00:05.000Z',
    provenance: [{ kind: 'reachability-observation', ref: 'probe:a2a:p2', source_system: 'O:I' }],
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, createA2aPresenceExploreEntry(presence, {
    semantic_ref: 'a2a-presence:p2-remote', world_ref: 'world:a2a:p2-remote',
  })));

  const source = createSpacetimeA2aSource(owner.conn.db as any);
  await waitUntil(() => source.snapshot().bindings[0]?.binding_ref === BINDING_REF, 'hosted A2A binding');
  const snapshot = source.snapshot();
  const projectionsBefore = [...owner.conn.db.projection.iter()].length;

  const difference = await performA2aExchange({
    binding: snapshot.bindings[0],
    presence: snapshot.presence[0],
    initiator_participant_ref: OWNER_PARTICIPANT_REF,
    message: { exchange_ref: 'a2a-exchange:p2', message_id: 'a2a-message:p2', text: 'Return untrusted material.' },
  });
  assert.equal(difference.transport_result.kind, 'task');
  assert.equal(difference.transport_result.ref, 'a2a-task:p2-return');
  assert.equal(difference.admission, 'pending');
  assert.equal('contribution' in difference, false);
  assert.equal('projection' in difference, false);

  assert.throws(() => admitA2aDifference(difference, { disposition: 'projection' }), /A2A-specific Admission is disabled/);

  const ingress = prepareA2aContributionIngress(difference, {
    contribution_ref: 'contribution:a2a:p2-return',
    created_at: '2026-08-17T09:00:10.000Z',
    target: { ref: AGENT_REF, kind: 'agent' },
  });
  assert.equal(ingress.schema, 'oi.a2a-contribution-ingress/v1');
  assert.equal(ingress.source_kind, 'a2a');
  assert.equal(ingress.contributor_participant_ref, AGENT_PARTICIPANT_REF);
  assert.equal(ingress.contribution.schema, 'oi.contribution/v1');
  assert.equal(ingress.contribution.representation.payload.task.artifacts[0].artifactId, 'a2a-artifact:p2-return');
  assert.equal('admission' in ingress, false);
  assert.equal('projection' in ingress, false);
  assert.equal('visibility' in ingress, false);
  assert.equal('index_eligible' in ingress, false);
  assert.equal([...owner.conn.db.projection.iter()].length, projectionsBefore, 'transport/ingress preparation must not mint Projection');
  assert.equal(fixture.requests.length, 1);

  console.log(JSON.stringify({
    proof: 'oi-a2a-phase2-ingress-adapter/v1',
    spacetimedb: '2.8.1',
    database: DATABASE,
    binding_ref: BINDING_REF,
    task_ref: difference.transport_result.ref,
    generic_ingress_schema: ingress.schema,
    contributor_participant_ref: ingress.contributor_participant_ref,
    legacy_a2a_admission_bridge: 'disabled',
    auto_contribution: false,
    auto_projection: false,
    auto_index: false,
  }, null, 2));
} finally {
  owner.conn.disconnect();
  agent.conn.disconnect();
  await new Promise<void>((resolve, reject) => fixture.server.close(error => error ? reject(error) : resolve()));
}
