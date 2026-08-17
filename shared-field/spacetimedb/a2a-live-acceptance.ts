import assert from 'node:assert/strict';
import http from 'node:http';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createWatch } from '../watch.mjs';
import {
  admitA2aDifference,
  createA2aBinding,
  createA2aPresence,
  encounterA2aDifference,
  performA2aExchange,
  prepareA2aContributionIngress,
} from '../a2a.mjs';
import { reviseA2aBinding, withdrawA2aBinding } from '../a2a-lifecycle.mjs';
import { searchA2aParticipation } from '../a2a-explore.mjs';
import {
  createA2aBindingProjection,
  createA2aPresenceExploreEntry,
  createSpacetimeA2aSource,
} from '../spacetimedb-a2a.mjs';
import { createSpacetimeExploreSource, createLiveExploreApplication, projectionStorageKey } from '../spacetimedb.mjs';
import { createSpacetimeWatchSource } from '../spacetimedb-watch.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_A2A_DATABASE ?? 'oi-shared-field-a2a-ci';
const TIMEOUT_MS = 15_000;

const FIELD_REF = 'oi:field:a2a-live';
const OWNER_PARTICIPANT_REF = 'participant:a2a:owner';
const AGENT_REF = 'agent:a2a:remote';
const AGENT_PARTICIPANT_REF = 'participant:a2a:remote';
const AGENT_WORLD_REF = 'world:a2a:remote';
const BINDING_REF = 'a2a-binding:remote';
const BINDING_PROJECTION_REF = 'projection:a2a-binding:remote';
const PRESENCE_REF = 'a2a-presence:remote';
const RETURNED_CONTRIBUTION_REF = 'contribution:a2a:return:1';
const FIRST_EXCHANGE_REQUEST_REF = 'exchange-request:a2a:full-stack:1';
const FIRST_EXCHANGE_GRANT_REF = 'exchange-grant:a2a:full-stack:1';
const FIRST_EXCHANGE_OPERATION_ID = 'exchange-operation:a2a:full-stack:1';
const REPLACEMENT_EXCHANGE_REQUEST_REF = 'exchange-request:a2a:full-stack:2';
const REPLACEMENT_EXCHANGE_GRANT_REF = 'exchange-grant:a2a:full-stack:2';
const REPLACEMENT_EXCHANGE_OPERATION_ID = 'exchange-operation:a2a:full-stack:2';

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

async function connect(name: string) {
  return new Promise<{ name: string; conn: DbConnection; identity: any }>((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn, identity) => resolve({ name, conn, identity }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribe(conn: DbConnection, queries: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe(queries);
  });
}

function rows(handle: any): any[] {
  return [...handle.iter()];
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

async function startA2aFixture() {
  const requests: Array<{ url?: string; headers: http.IncomingHttpHeaders; body: any }> = [];
  const server = http.createServer(async (req, res) => {
    const port = (server.address() as any).port;
    if (req.url === '/.well-known/agent-card.json' || req.url === '/.well-known/agent-card-next.json') {
      const next = req.url.includes('next');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        name: 'Remote SharedField fixture agent',
        description: 'A2A HTTP+JSON conformance fixture',
        version: next ? '2-fixture' : '1-fixture',
        supportedInterfaces: [{
          url: `http://127.0.0.1:${port}/${next ? 'a2a-next' : 'a2a'}`,
          protocolBinding: 'HTTP+JSON',
          protocolVersion: '1.0',
        }],
        capabilities: {},
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        skills: [],
      }));
      return;
    }

    if ((req.url === '/a2a/message:send' || req.url === '/a2a-next/message:send') && req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({ url: req.url, headers: req.headers, body });
      res.setHeader('content-type', 'application/a2a+json');
      res.end(JSON.stringify({
        task: {
          id: req.url.includes('next') ? 'a2a-task:replacement' : 'a2a-task:initial',
          contextId: 'a2a-context:shared-field',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [{
            artifactId: req.url.includes('next') ? 'a2a-artifact:replacement' : 'a2a-artifact:initial',
            name: 'returned-difference',
            parts: [{ text: req.url.includes('next') ? 'replacement endpoint difference' : 'initial endpoint difference' }],
          }],
        },
      }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port as number;
  return {
    server,
    requests,
    initial: {
      endpoint: `http://127.0.0.1:${port}/a2a`,
      card: `http://127.0.0.1:${port}/.well-known/agent-card.json`,
    },
    replacement: {
      endpoint: `http://127.0.0.1:${port}/a2a-next`,
      card: `http://127.0.0.1:${port}/.well-known/agent-card-next.json`,
    },
  };
}

const fixtureServer = await startA2aFixture();
const [owner, agent] = await Promise.all([connect('owner'), connect('agent')]);

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: FIELD_REF,
  kind: 'public',
  visibility: 'public',
  title: 'A2A live SharedField acceptance',
  provenance: [{ kind: 'acceptance-fixture', ref: 'fixture:a2a-live', source_system: 'O:I', revision: '1' }],
};
const ownerParticipant = createParticipant({
  participant_ref: OWNER_PARTICIPANT_REF,
  field_ref: FIELD_REF,
  identity: { kind: 'human', ref: 'human:a2a:owner' },
  presentation: { world_ref: 'world:a2a:owner' },
  provenance: { source_system: 'O:I', source_revision: 'owner@1' },
});
const agentParticipant = createParticipant({
  participant_ref: AGENT_PARTICIPANT_REF,
  field_ref: FIELD_REF,
  identity: { kind: 'agent', ref: AGENT_REF },
  presentation: { world_ref: AGENT_WORLD_REF },
  provenance: { source_system: 'Actuation', source_revision: 'agent@1' },
  agency: { ref: 'agency:a2a:remote', source_system: 'Actuation' },
});
const agentExploreEntry = {
  schema: 'oi.explore-entry/v1',
  ref: AGENT_REF,
  kind: 'agent',
  world_ref: AGENT_WORLD_REF,
  label: 'Remote A2A Agent',
  aliases: ['A2A remote'],
  provenance: [{ kind: 'agent-projection', ref: AGENT_REF, source_system: 'Actuation', revision: 'agent@1' }],
  locators: [],
};

try {
  const readQueries = [
    'SELECT * FROM shared_field',
    'SELECT * FROM participant',
    'SELECT * FROM projection',
    'SELECT * FROM contribution',
    'SELECT * FROM explore_entry',
    'SELECT * FROM my_field_authority',
    'SELECT * FROM my_contribution_receipt',
  ];
  await subscribe(owner.conn, [...readQueries, 'SELECT * FROM my_watch']);
  await subscribe(agent.conn, readQueries);

  await owner.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await owner.conn.reducers.putParticipant(participantArgs(ownerParticipant));
  await owner.conn.reducers.putParticipant(participantArgs(agentParticipant));
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: FIELD_REF,
    participantRef: OWNER_PARTICIPANT_REF,
    targetIdentity: owner.identity,
    role: 'contributor',
    contactable: true,
    ttlSeconds: 0,
  });
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: FIELD_REF,
    participantRef: AGENT_PARTICIPANT_REF,
    targetIdentity: agent.identity,
    role: 'contributor',
    contactable: true,
    ttlSeconds: 0,
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, agentExploreEntry));

  const firstBinding = createA2aBinding({
    binding_ref: BINDING_REF,
    binding_revision: 1,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    agent_ref: AGENT_REF,
    publisher_participant_ref: AGENT_PARTICIPANT_REF,
    publication_decision_ref: 'decision:a2a:publish:1',
    source_revision: 'agent@1',
    projection_ref: BINDING_PROJECTION_REF,
    published_at: '2026-08-16T21:00:00.000Z',
    endpoint_url: fixtureServer.initial.endpoint,
    agent_card_url: fixtureServer.initial.card,
    provenance: [{ kind: 'explicit-publication', ref: 'decision:a2a:publish:1', source_system: 'O:I', revision: '1' }],
  });
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(firstBinding)));

  const firstPresence = createA2aPresence({
    binding_ref: BINDING_REF,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    availability: 'online',
    sequence: 1,
    observed_at: '2026-08-16T21:00:05.000Z',
    provenance: [{ kind: 'reachability-observation', ref: 'probe:a2a:1', source_system: 'O:I' }],
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, createA2aPresenceExploreEntry(firstPresence, {
    semantic_ref: PRESENCE_REF,
    world_ref: AGENT_WORLD_REF,
  })));

  const a2aSource = createSpacetimeA2aSource(owner.conn.db as any);
  let a2aEvents = 0;
  const stopA2a = a2aSource.subscribe(() => { a2aEvents += 1; });
  const liveExplore = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db as any));
  await waitUntil(() => a2aSource.snapshot().bindings[0]?.binding_ref === BINDING_REF, 'hosted A2A binding');
  await waitUntil(() => a2aSource.snapshot().presence[0]?.availability === 'online', 'hosted A2A presence');
  await waitUntil(() => liveExplore.search('Remote A2A Agent')[0]?.ref === AGENT_REF, 'Explore Agent search');

  const firstSnapshot = a2aSource.snapshot();
  const found = searchA2aParticipation({
    explore: liveExplore,
    query: 'Remote A2A Agent',
    participants: [ownerParticipant, agentParticipant],
    bindings: firstSnapshot.bindings,
    presence: firstSnapshot.presence,
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].participation.participant.participant_ref, AGENT_PARTICIPANT_REF);
  assert.notEqual(firstSnapshot.implementation.bindings[0].row_id, BINDING_REF);

  await owner.conn.reducers.requestExchange({
    requestRef: FIRST_EXCHANGE_REQUEST_REF,
    fieldRef: FIELD_REF,
    initiatorParticipantRef: OWNER_PARTICIPANT_REF,
    counterpartyParticipantRef: AGENT_PARTICIPANT_REF,
    purpose: 'a2a-message-exchange',
    scopeJson: JSON.stringify({ kind: 'message' }),
    protocol: 'a2a',
    bindingRef: BINDING_REF,
    bindingRevision: 1,
    modesJson: JSON.stringify(['message:send']),
    maxUses: 1,
    ttlSeconds: 300,
  });
  await owner.conn.reducers.grantExchange({
    requestRef: FIRST_EXCHANGE_REQUEST_REF,
    grantRef: FIRST_EXCHANGE_GRANT_REF,
    reason: 'Full-stack A2A exchange authority for binding revision 1',
    evidenceJson: JSON.stringify({ fixture: 'a2a-full-stack', binding_revision: 1 }),
  });

  const difference = await performA2aExchange({
    binding: found[0].participation.binding,
    presence: found[0].participation.presence,
    initiator_participant_ref: OWNER_PARTICIPANT_REF,
    authorize_exchange: async (demand: any) => {
      await owner.conn.reducers.consumeExchange({
        grantRef: FIRST_EXCHANGE_GRANT_REF, operationId: demand.operation_id, fieldRef: demand.field_ref,
        initiatorParticipantRef: demand.initiator_participant_ref, counterpartyParticipantRef: demand.counterparty_participant_ref,
        protocol: demand.protocol, bindingRef: demand.binding_ref, bindingRevision: demand.binding_revision,
        mode: demand.mode, purpose: demand.purpose, scopeJson: demand.scope_json,
      });
      return { allowed: true, grant_ref: FIRST_EXCHANGE_GRANT_REF };
    },
    message: {
      exchange_ref: 'a2a-exchange:live:1',
      exchange_operation_id: FIRST_EXCHANGE_OPERATION_ID,
      message_id: 'a2a-message:live:1',
      text: 'Return a bounded difference for generic Contribution ingress.',
    },
  });
  assert.equal(difference.transport_result.kind, 'task');
  assert.equal(difference.transport_result.ref, 'a2a-task:initial');
  assert.equal(difference.admission, 'pending');
  assert.equal('projection' in difference, false);
  assert.equal('contribution' in difference, false);

  const encounter = encounterA2aDifference(difference, {
    encounter_ref: 'encounter:a2a:live:1',
    participant_ref: OWNER_PARTICIPANT_REF,
    occurred_at: '2026-08-16T21:00:10.000Z',
  });
  assert.equal(encounter.mediation.protocol, 'A2A');
  assert.equal('subjective_state' in encounter, false);

  // The legacy A2A-specific semantic bridge is now fail-closed.
  assert.throws(() => admitA2aDifference(difference, {
    decision_ref: 'decision:a2a:legacy:1',
    decided_by_participant_ref: OWNER_PARTICIPANT_REF,
    decided_at: '2026-08-16T21:00:15.000Z',
    disposition: 'projection',
  }), /A2A-specific Admission is disabled/);

  const ingress = prepareA2aContributionIngress(difference, {
    contribution_ref: RETURNED_CONTRIBUTION_REF,
    created_at: '2026-08-16T21:00:15.000Z',
    target: { ref: AGENT_REF, kind: 'agent' },
  });
  const projectionCountBeforeIngress = rows(owner.conn.db.projection).length;
  await owner.conn.reducers.ingestAuthorizedExchangeContribution({
    grantRef: FIRST_EXCHANGE_GRANT_REF,
    operationId: FIRST_EXCHANGE_OPERATION_ID,
    fieldRef: ingress.field_ref,
    contributorParticipantRef: ingress.contributor_participant_ref,
    sourceKind: ingress.source_kind,
    transportProvider: ingress.transport_provider,
    transportMessageId: ingress.transport_message_id,
    contractJson: JSON.stringify(ingress.contribution),
  });
  const receipt = await waitUntil(
    () => rows(owner.conn.db.myContributionReceipt).find(row => row.contributionRef === RETURNED_CONTRIBUTION_REF),
    'A2A returned difference quarantine receipt'
  );
  assert.equal(receipt.state, 'quarantined');
  assert.equal(rows(owner.conn.db.contribution).some(row => row.contributionRef === RETURNED_CONTRIBUTION_REF), false);
  assert.equal(rows(owner.conn.db.exploreEntry).some(row => row.semanticRef === RETURNED_CONTRIBUTION_REF), false);
  assert.equal(rows(owner.conn.db.projection).length, projectionCountBeforeIngress, 'A2A ingress must not auto-create Projection');

  await owner.conn.reducers.admitContribution({
    ingressRef: receipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'Receiving field explicitly admits bounded A2A returned difference as data.',
    evidenceJson: JSON.stringify({ schema: 'oi.a2a-phase2-evidence/v1', exchange_ref: difference.exchange_ref }),
  });
  await waitUntil(
    () => rows(owner.conn.db.contribution).find(row => row.contributionRef === RETURNED_CONTRIBUTION_REF),
    'explicitly admitted A2A Contribution'
  );
  assert.equal(rows(owner.conn.db.exploreEntry).some(row => row.semanticRef === RETURNED_CONTRIBUTION_REF), false, 'Admission alone remains non-indexing');
  assert.equal(rows(owner.conn.db.projection).length, projectionCountBeforeIngress, 'Admission remains non-projecting');

  const watch = createWatch({
    watch_ref: 'watch:a2a:agent',
    watcher_participant_ref: OWNER_PARTICIPANT_REF,
    field_ref: FIELD_REF,
    target: { kind: 'agent', ref: AGENT_REF },
    created_at: '2026-08-16T21:00:20.000Z',
    provenance: { source_system: 'O:I', source_revision: 'a2a-watch@1' },
  });
  await owner.conn.reducers.putWatch({
    watchRef: watch.watch_ref,
    fieldRef: watch.field_ref,
    watcherParticipantRef: watch.watcher_participant_ref,
    targetKind: watch.target.kind,
    targetRef: watch.target.ref,
    state: watch.state,
    contractJson: JSON.stringify(watch),
  });
  const watchSource = createSpacetimeWatchSource(owner.conn.db as any);
  await waitUntil(() => watchSource.snapshot()[0]?.watch.watch_ref === watch.watch_ref, 'private Watch after A2A encounter');

  const replacement = reviseA2aBinding(firstBinding, {
    publication_decision_ref: 'decision:a2a:publish:2',
    source_revision: 'agent@2',
    published_at: '2026-08-16T21:01:00.000Z',
    endpoint_url: fixtureServer.replacement.endpoint,
    agent_card_url: fixtureServer.replacement.card,
    provenance: [{ kind: 'explicit-publication', ref: 'decision:a2a:publish:2', source_system: 'O:I', revision: '2' }],
  });
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(replacement, {
    projection_ref: BINDING_PROJECTION_REF,
    projection_revision: 2,
  })));
  const replacementPresence = createA2aPresence({
    binding_ref: BINDING_REF,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    availability: 'online',
    sequence: 2,
    observed_at: '2026-08-16T21:01:05.000Z',
    provenance: [{ kind: 'reachability-observation', ref: 'probe:a2a:2', source_system: 'O:I' }],
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, createA2aPresenceExploreEntry(replacementPresence, {
    semantic_ref: PRESENCE_REF,
    world_ref: AGENT_WORLD_REF,
  })));
  await waitUntil(() => a2aSource.snapshot().bindings[0]?.binding_revision === 2, 'A2A endpoint replacement');
  const replacementSnapshot = a2aSource.snapshot();
  await owner.conn.reducers.requestExchange({
    requestRef: REPLACEMENT_EXCHANGE_REQUEST_REF,
    fieldRef: FIELD_REF,
    initiatorParticipantRef: OWNER_PARTICIPANT_REF,
    counterpartyParticipantRef: AGENT_PARTICIPANT_REF,
    purpose: 'a2a-message-exchange',
    scopeJson: JSON.stringify({ kind: 'message' }),
    protocol: 'a2a',
    bindingRef: BINDING_REF,
    bindingRevision: 2,
    modesJson: JSON.stringify(['message:send']),
    maxUses: 1,
    ttlSeconds: 300,
  });
  await owner.conn.reducers.grantExchange({
    requestRef: REPLACEMENT_EXCHANGE_REQUEST_REF,
    grantRef: REPLACEMENT_EXCHANGE_GRANT_REF,
    reason: 'Fresh Exchange authority for replacement binding revision 2',
    evidenceJson: JSON.stringify({ fixture: 'a2a-full-stack', binding_revision: 2 }),
  });

  const replacementDifference = await performA2aExchange({
    binding: replacementSnapshot.bindings[0],
    presence: replacementSnapshot.presence[0],
    initiator_participant_ref: OWNER_PARTICIPANT_REF,
    authorize_exchange: async (demand: any) => {
      await owner.conn.reducers.consumeExchange({
        grantRef: REPLACEMENT_EXCHANGE_GRANT_REF, operationId: demand.operation_id, fieldRef: demand.field_ref,
        initiatorParticipantRef: demand.initiator_participant_ref, counterpartyParticipantRef: demand.counterparty_participant_ref,
        protocol: demand.protocol, bindingRef: demand.binding_ref, bindingRevision: demand.binding_revision,
        mode: demand.mode, purpose: demand.purpose, scopeJson: demand.scope_json,
      });
      return { allowed: true, grant_ref: REPLACEMENT_EXCHANGE_GRANT_REF };
    },
    message: { exchange_operation_id: REPLACEMENT_EXCHANGE_OPERATION_ID, message_id: 'a2a-message:live:replacement', text: 'Use replacement endpoint.' },
  });
  assert.equal(replacementDifference.transport_result.ref, 'a2a-task:replacement');

  const withdrawn = withdrawA2aBinding(replacement, {
    publication_decision_ref: 'decision:a2a:withdraw:3',
    source_revision: 'agent@3',
    published_at: '2026-08-16T21:02:00.000Z',
    provenance: [{ kind: 'explicit-withdrawal', ref: 'decision:a2a:withdraw:3', source_system: 'O:I', revision: '3' }],
  });
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(withdrawn, {
    projection_ref: BINDING_PROJECTION_REF,
    projection_revision: 3,
  })));
  const withdrawnPresence = createA2aPresence({
    binding_ref: BINDING_REF,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    availability: 'withdrawn',
    sequence: 3,
    observed_at: '2026-08-16T21:02:05.000Z',
    provenance: [{ kind: 'reachability-observation', ref: 'probe:a2a:3', source_system: 'O:I' }],
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, createA2aPresenceExploreEntry(withdrawnPresence, {
    semantic_ref: PRESENCE_REF,
    world_ref: AGENT_WORLD_REF,
  })));
  await waitUntil(() => a2aSource.snapshot().bindings[0]?.binding_revision === 3, 'A2A withdrawal projection');
  await waitUntil(() => a2aSource.snapshot().presence[0]?.availability === 'withdrawn', 'A2A withdrawn presence');

  const withdrawnSnapshot = a2aSource.snapshot();
  assert.equal(withdrawnSnapshot.bindings[0].state, 'withdrawn');
  assert.equal('endpoint_url' in withdrawnSnapshot.bindings[0], false);
  const stillDiscoverable = searchA2aParticipation({
    explore: liveExplore,
    query: 'Remote A2A Agent',
    participants: [ownerParticipant, agentParticipant],
    bindings: withdrawnSnapshot.bindings,
    presence: withdrawnSnapshot.presence,
  });
  assert.equal(stillDiscoverable.length, 1);
  assert.equal(stillDiscoverable[0].participation.binding, undefined, 'withdrawal removes reachability without deleting identity');
  assert.equal(watchSource.snapshot()[0]?.watch.watch_ref, watch.watch_ref, 'Watch remains independent after A2A withdrawal');

  let attemptedFetch = false;
  await assert.rejects(() => performA2aExchange({
    binding: withdrawn,
    presence: withdrawnPresence,
    initiator_participant_ref: OWNER_PARTICIPANT_REF,
    authorize_exchange: async () => { throw new Error('withdrawn binding must fail before authority consumption'); },
    message: { message_id: 'a2a-message:after-withdrawal', text: 'must not send' },
    fetch_impl: async () => { attemptedFetch = true; throw new Error('must not fetch'); },
  }), /explicitly published binding|currently reachable/);
  assert.equal(attemptedFetch, false);

  assert.equal(fixtureServer.requests[0].headers['content-type'], 'application/a2a+json');
  assert.equal(fixtureServer.requests[0].headers['a2a-version'], '1.0');
  assert.equal(fixtureServer.requests[0].body.message.role, 'ROLE_USER');
  assert.ok(a2aEvents >= 3);

  console.log(JSON.stringify({
    proof: 'oi-a2a-sharedfield-live/v3-exchange-authority',
    spacetimedb: '2.8.1',
    database: DATABASE,
    agent_ref: AGENT_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    binding_ref: BINDING_REF,
    binding_revision: withdrawn.binding_revision,
    binding_state: withdrawn.state,
    initial_task: difference.transport_result.ref,
    replacement_task: replacementDifference.transport_result.ref,
    contribution_ingress_ref: receipt.ingressRef,
    admitted_contribution_ref: RETURNED_CONTRIBUTION_REF,
    admitted_contribution_indexed: false,
    legacy_a2a_admission_bridge: 'disabled',
    automatic_projection_from_returned_difference: false,
    encounter_ref: encounter.encounter_ref,
    watch_ref: watch.watch_ref,
    a2a_subscription_events: a2aEvents,
    semantic_identity_preserved: AGENT_REF !== AGENT_PARTICIPANT_REF && AGENT_PARTICIPANT_REF !== BINDING_REF,
    transport_did_not_create_actuation_or_run: true,
  }, null, 2));

  stopA2a();
  liveExplore.dispose();
} finally {
  owner.conn.disconnect();
  agent.conn.disconnect();
  await new Promise<void>((resolve, reject) => fixtureServer.server.close((error) => error ? reject(error) : resolve()));
}
