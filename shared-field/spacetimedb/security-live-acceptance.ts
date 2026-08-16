import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DbConnection, tables } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { refineProjection } from '../projection-refinement.mjs';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
  projectionStorageKey,
  relationStorageRef,
} from '../spacetimedb.mjs';
import { createWatch } from '../watch.mjs';
import { createSpacetimeWatchSource } from '../spacetimedb-watch.mjs';
import { createSpacetimeContactSource } from '../spacetimedb-contact.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(name: string): Promise<{ name: string; conn: DbConnection; identity: any; token: string }> {
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn, identity, token) => resolve({ name, conn, identity, token }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribeTables(conn: DbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe([
        tables.sharedField,
        tables.participant,
        tables.projection,
        tables.exploreEntry,
        tables.exploreRelation,
      ]);
  });
}

async function subscribePrivateViews(conn: DbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe([
        'SELECT * FROM my_field_authority',
        'SELECT * FROM my_watch',
        'SELECT * FROM my_contact',
      ]);
  });
}

async function expectSubscriptionDenied(conn: DbConnection, query: string, description: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    conn.subscriptionBuilder()
      .onApplied(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`${description} unexpectedly applied`));
        }
      })
      .onError((_ctx, error) => {
        if (!settled) {
          settled = true;
          assert.ok(error, `${description} should return an error`);
          resolve();
        }
      })
      .subscribe(query);
  });
}

async function expectReducerRejected(run: () => Promise<unknown>, pattern: RegExp, description: string): Promise<void> {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${description} should reject`);
  assert.match(String(caught), pattern, description);
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

function extraParticipant(fieldRef: string, suffix: string) {
  return createParticipant({
    participant_ref: `participant:security:${suffix}`,
    field_ref: fieldRef,
    identity: { kind: 'agent', ref: `agent:security:${suffix}` },
    presentation: { world_ref: `world:security:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `security-fixture:${suffix}@1` },
  });
}

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/explore-world-v1.json', import.meta.url), 'utf8')
);
const byRef = new Map(fixture.entries.map((entry: any) => [entry.ref, entry]));
const fieldEntry: any = byRef.get('oi:field:public');
const worldEntry: any = byRef.get('world:human:ariadne');
const agentEntry: any = byRef.get('agent:parasakti');
const projectionEntry: any = byRef.get('projection:parasakti:explore-note');
assert.ok(fieldEntry && worldEntry && agentEntry && projectionEntry, 'fixture should contain hosted floor objects');

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: fieldEntry.ref,
  kind: 'public',
  visibility: 'public',
  title: fieldEntry.label,
  provenance: fieldEntry.provenance,
};
const hostileField = {
  ...field,
  field_ref: 'oi:field:security-hostile',
  title: 'Hostile authority test field',
};
const humanParticipant = createParticipant({
  participant_ref: worldEntry.meta.participant_ref,
  field_ref: field.field_ref,
  identity: { kind: 'human', ref: worldEntry.provenance[0].ref },
  presentation: { world_ref: worldEntry.ref },
  provenance: {
    source_system: worldEntry.provenance[0].source_system,
    source_revision: worldEntry.provenance[0].revision,
  },
});
const agentParticipant = createParticipant({
  participant_ref: agentEntry.meta.participant_ref,
  field_ref: field.field_ref,
  identity: { kind: 'agent', ref: agentEntry.ref },
  presentation: { world_ref: agentEntry.world_ref },
  provenance: {
    source_system: agentEntry.provenance[0].source_system,
    source_revision: agentEntry.provenance[0].revision,
  },
  agency: { ref: agentEntry.meta.agency_ref, source_system: agentEntry.provenance[0].source_system },
});
const strangerParticipant = extraParticipant(field.field_ref, 'stranger');
const peerTwoParticipant = extraParticipant(field.field_ref, 'peer-two');
const peerThreeParticipant = extraParticipant(field.field_ref, 'peer-three');
const allParticipants = [humanParticipant, agentParticipant, strangerParticipant, peerTwoParticipant, peerThreeParticipant];

const projection = {
  schema: 'oi.projection/v1',
  projection_ref: projectionEntry.projection_ref,
  projection_revision: 1,
  state: 'published',
  subject: { ref: projectionEntry.provenance[1].ref, kind: projectionEntry.provenance[1].kind },
  source: { system: projectionEntry.provenance[1].source_system, revision: projectionEntry.meta.source_revision },
  publisher_participant_ref: projectionEntry.meta.publisher_participant_ref,
  published_at: '2026-08-16T12:00:00.000Z',
  audience: { visibility: 'public' },
  representation: { kind: 'explore-entry', ref: projectionEntry.ref },
  provenance: projectionEntry.provenance,
};

const clients = await Promise.all([
  connect('owner'),
  connect('agent'),
  connect('stranger'),
  connect('peer-two'),
  connect('peer-three'),
]);
const [owner, agent, stranger, peerTwo, peerThree] = clients;

try {
  assert.notEqual(owner.identity.toHexString(), agent.identity.toHexString(), 'runtime identities must be distinct');
  assert.notEqual(agent.identity.toHexString(), stranger.identity.toHexString(), 'runtime identities must be distinct');

  for (const client of clients) {
    await subscribeTables(client.conn);
    await subscribePrivateViews(client.conn);
  }

  await expectSubscriptionDenied(stranger.conn, 'SELECT * FROM watch', 'private Watch table subscription');
  await expectSubscriptionDenied(stranger.conn, 'SELECT * FROM contact', 'private Contact table subscription');
  await expectSubscriptionDenied(stranger.conn, 'SELECT * FROM field_authority', 'private authority table subscription');

  await owner.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await stranger.conn.reducers.putSharedField({
    fieldRef: hostileField.field_ref,
    kind: hostileField.kind,
    visibility: hostileField.visibility,
    contractJson: JSON.stringify(hostileField),
  });
  await waitUntil(() => owner.conn.db.sharedField.fieldRef.find(field.field_ref), 'main SharedField insertion');

  await expectReducerRejected(
    () => stranger.conn.reducers.putSharedField({
      fieldRef: field.field_ref,
      kind: field.kind,
      visibility: field.visibility,
      contractJson: JSON.stringify({ ...field, title: 'hostile rewrite' }),
    }),
    /not owner/,
    'cross-field owner mutation'
  );
  await expectReducerRejected(
    () => owner.conn.reducers.putSharedField({
      fieldRef: hostileField.field_ref,
      kind: hostileField.kind,
      visibility: hostileField.visibility,
      contractJson: JSON.stringify({ ...hostileField, title: 'owner cannot steal field' }),
    }),
    /not owner/,
    'reciprocal cross-field owner mutation'
  );

  for (const participantValue of allParticipants) {
    await owner.conn.reducers.putParticipant(participantArgs(participantValue));
  }

  const grants = [
    [humanParticipant, owner, 'contributor'],
    [agentParticipant, agent, 'contributor'],
    [strangerParticipant, stranger, 'contributor'],
    [peerTwoParticipant, peerTwo, 'contact'],
    [peerThreeParticipant, peerThree, 'contact'],
  ] as const;
  for (const [participantValue, client, role] of grants) {
    await owner.conn.reducers.grantParticipantAuthority({
      fieldRef: field.field_ref,
      participantRef: participantValue.participant_ref,
      targetIdentity: client.identity,
      role,
      ttlSeconds: 0,
    });
  }

  await agent.conn.reducers.putProjection({
    projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
    fieldRef: field.field_ref,
    projectionRef: projection.projection_ref,
    projectionRevision: projection.projection_revision,
    sourceRevision: projection.source.revision,
    publisherParticipantRef: projection.publisher_participant_ref,
    state: projection.state,
    contractJson: JSON.stringify(projection),
  });

  await expectReducerRejected(
    () => stranger.conn.reducers.putProjection({
      projectionKey: projectionStorageKey(projection.projection_ref, 1),
      fieldRef: field.field_ref,
      projectionRef: projection.projection_ref,
      projectionRevision: 1,
      sourceRevision: 'hostile-source@1',
      publisherParticipantRef: projection.publisher_participant_ref,
      state: projection.state,
      contractJson: JSON.stringify({ ...projection, source: { ...projection.source, revision: 'hostile-source@1' } }),
    }),
    /not bound|immutable/,
    'Projection publisher impersonation'
  );

  const refinedProjection = refineProjection(projection, {
    publisher_participant_ref: humanParticipant.participant_ref,
    published_at: '2026-08-16T19:05:00.000Z',
    representation: {
      kind: 'explore-entry',
      ref: projectionEntry.ref,
      payload: { summary: 'Human-refined public wording.' },
    },
    provenance: [{
      kind: 'human-refinement',
      ref: humanParticipant.participant_ref,
      source_system: 'o-i',
      revision: 'refinement@1',
    }],
  });
  await owner.conn.reducers.putProjection({
    projectionKey: projectionStorageKey(refinedProjection.projection_ref, refinedProjection.projection_revision),
    fieldRef: field.field_ref,
    projectionRef: refinedProjection.projection_ref,
    projectionRevision: refinedProjection.projection_revision,
    sourceRevision: refinedProjection.source.revision,
    publisherParticipantRef: refinedProjection.publisher_participant_ref,
    state: refinedProjection.state,
    contractJson: JSON.stringify(refinedProjection),
  });
  assert.equal(refinedProjection.source.revision, 'run:explore@1', 'refinement must not rewrite canonical source revision');

  for (const entry of fixture.entries) {
    await owner.conn.reducers.putExploreEntry({
      semanticRef: entry.ref,
      fieldRef: field.field_ref,
      worldRef: entry.world_ref,
      kind: entry.kind,
      label: entry.label,
      revision: entry.revision ?? '',
      entryJson: JSON.stringify(entry),
    });
  }
  for (const relation of fixture.relations) {
    await owner.conn.reducers.putExploreRelation({
      relationRef: relationStorageRef(relation),
      fieldRef: field.field_ref,
      fromRef: relation.from,
      toRef: relation.to,
      relation: relation.relation,
      origin: relation.origin,
      relationJson: JSON.stringify(relation),
    });
  }

  await expectReducerRejected(
    () => stranger.conn.reducers.putExploreEntry({
      semanticRef: 'wiki:o-i:hostile-index-pollution',
      fieldRef: field.field_ref,
      worldRef: worldEntry.ref,
      kind: 'wiki-node',
      label: 'Hostile index pollution',
      revision: 'hostile@1',
      entryJson: JSON.stringify({
        schema: 'oi.explore-entry/v1',
        ref: 'wiki:o-i:hostile-index-pollution',
        kind: 'wiki-node',
        world_ref: worldEntry.ref,
        label: 'Hostile index pollution',
        provenance: [{ kind: 'hostile', ref: 'hostile', source_system: 'remote' }],
      }),
    }),
    /not owner/,
    'Explore index pollution'
  );

  const live = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db));
  await waitUntil(
    () => live.search('knowledge navigation')[0]?.ref === 'wiki:o-i:explore:knowledge-navigation',
    'secured Explore index seed'
  );
  assert.equal(live.read('projection:parasakti:explore-note')?.meta.source_revision, 'run:explore@1');
  const r1 = owner.conn.db.projection.projectionKey.find(projectionStorageKey(projection.projection_ref, 1));
  const r2 = owner.conn.db.projection.projectionKey.find(projectionStorageKey(projection.projection_ref, 2));
  assert.ok(r1 && r2, 'both Projection revisions remain independently addressable');
  assert.notEqual(String(r1.rowId), String(r2.rowId));

  const watch = createWatch({
    watch_ref: 'watch:participant:public:ariadne:agent:parasakti',
    watcher_participant_ref: humanParticipant.participant_ref,
    field_ref: field.field_ref,
    target: { kind: 'agent', ref: agentEntry.ref },
    created_at: '2026-08-16T19:00:00.000Z',
    provenance: { source_system: 'o-i', source_revision: 'security-watch@1' },
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
  const ownerWatchSource = createSpacetimeWatchSource(owner.conn.db as any);
  await waitUntil(() => ownerWatchSource.snapshot()[0]?.watch.watch_ref === watch.watch_ref, 'private Watch view delivery');
  assert.equal(createSpacetimeWatchSource(agent.conn.db as any).snapshot().length, 0, 'unrelated caller must not see Watch relation');

  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
  });
  await expectReducerRejected(
    () => stranger.conn.reducers.putWatch({
      watchRef: 'watch:security:stranger:revoked',
      fieldRef: field.field_ref,
      watcherParticipantRef: strangerParticipant.participant_ref,
      targetKind: 'agent',
      targetRef: agentEntry.ref,
      state: 'active',
      contractJson: JSON.stringify({ ...watch, watch_ref: 'watch:security:stranger:revoked', watcher_participant_ref: strangerParticipant.participant_ref }),
    }),
    /revoked/,
    'revoked Participant authority'
  );
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
    targetIdentity: stranger.identity,
    role: 'contributor',
    ttlSeconds: 1,
  });
  await sleep(1100);
  await expectReducerRejected(
    () => stranger.conn.reducers.putWatch({
      watchRef: 'watch:security:stranger:expired',
      fieldRef: field.field_ref,
      watcherParticipantRef: strangerParticipant.participant_ref,
      targetKind: 'agent',
      targetRef: agentEntry.ref,
      state: 'active',
      contractJson: JSON.stringify({ ...watch, watch_ref: 'watch:security:stranger:expired', watcher_participant_ref: strangerParticipant.participant_ref }),
    }),
    /expired/,
    'expired Participant authority'
  );
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
    targetIdentity: stranger.identity,
    role: 'contributor',
    ttlSeconds: 0,
  });

  const contactOne = {
    contactRef: 'contact:security:ariadne:parasakti:1',
    fieldRef: field.field_ref,
    initiatorParticipantRef: humanParticipant.participant_ref,
    recipientParticipantRef: agentParticipant.participant_ref,
    purpose: 'Discuss the bounded knowledge-navigation projection.',
    requestedScopeJson: JSON.stringify({ mode: 'conversation', topic_ref: 'wiki:o-i:explore:knowledge-navigation' }),
    ttlSeconds: 3600,
    provenanceJson: JSON.stringify({ source_system: 'o-i', source_revision: 'security-contact@1', mediation: 'direct-address' }),
  };
  const projectionCountBeforeContact = Number(owner.conn.db.projection.count());
  await owner.conn.reducers.requestContact(contactOne);
  const ownerContactSource = createSpacetimeContactSource(owner.conn.db as any);
  const agentContactSource = createSpacetimeContactSource(agent.conn.db as any);
  await waitUntil(() => ownerContactSource.snapshot()[0]?.contact.contact_ref === contactOne.contactRef, 'initiator Contact view');
  await waitUntil(() => agentContactSource.snapshot()[0]?.contact.contact_ref === contactOne.contactRef, 'recipient Contact view');
  assert.equal(createSpacetimeContactSource(stranger.conn.db as any).snapshot().length, 0, 'unrelated caller must not see Contact relation');
  assert.equal(Number(owner.conn.db.projection.count()), projectionCountBeforeContact, 'Contact must not create a Projection');

  await expectReducerRejected(
    () => owner.conn.reducers.requestContact({ ...contactOne, contactRef: 'contact:security:duplicate' }),
    /active Contact request already exists/,
    'duplicate pending Contact'
  );
  await agent.conn.reducers.respondContact({
    contactRef: contactOne.contactRef,
    recipientParticipantRef: agentParticipant.participant_ref,
    decision: 'narrowed',
    responseJson: JSON.stringify({ accepted_scope: { mode: 'conversation', topic_ref: 'wiki:o-i:explore:knowledge-navigation' } }),
  });
  await waitUntil(() => ownerContactSource.snapshot()[0]?.contact.state === 'narrowed', 'explicit Contact response transition');

  await agent.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: agentParticipant.participant_ref,
    blockedParticipantRef: humanParticipant.participant_ref,
    mode: 'blocked',
  });
  await expectReducerRejected(
    () => owner.conn.reducers.requestContact({ ...contactOne, contactRef: 'contact:security:blocked' }),
    /blocked by recipient/,
    'recipient block policy'
  );
  await agent.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: agentParticipant.participant_ref,
    blockedParticipantRef: humanParticipant.participant_ref,
    mode: 'clear',
  });
  await expectReducerRejected(
    () => owner.conn.reducers.requestContact({
      ...contactOne,
      contactRef: 'contact:security:oversized',
      recipientParticipantRef: peerTwoParticipant.participant_ref,
      purpose: 'x'.repeat(501),
    }),
    /at most 500/,
    'oversized Contact purpose'
  );

  await owner.conn.reducers.requestContact({
    ...contactOne,
    contactRef: 'contact:security:peer-two',
    recipientParticipantRef: peerTwoParticipant.participant_ref,
    purpose: 'Bounded request two.',
  });
  await owner.conn.reducers.requestContact({
    ...contactOne,
    contactRef: 'contact:security:peer-three',
    recipientParticipantRef: peerThreeParticipant.participant_ref,
    purpose: 'Bounded request three.',
  });
  await expectReducerRejected(
    () => owner.conn.reducers.requestContact({
      ...contactOne,
      contactRef: 'contact:security:rate-four',
      recipientParticipantRef: strangerParticipant.participant_ref,
      purpose: 'Fourth request in one server window.',
    }),
    /rate limit exceeded/,
    'Contact high-fanout rate limit'
  );

  assert.equal(live.status().healthy, true);
  assert.equal(live.resolve('wiki:o-i:explore:knowledge-navigation')?.ref, 'wiki:o-i:explore:knowledge-navigation');
  assert.equal(live.snapshot().projections.find((item: any) => item.projection_revision === 2)?.source.revision, 'run:explore@1');

  console.log(JSON.stringify({
    proof: 'oi-encounter-security-live/v1',
    database: DATABASE,
    spacetime_identity_distinct: true,
    participant_count: String(owner.conn.db.participant.count()),
    projection_count: String(owner.conn.db.projection.count()),
    explore_entry_count: String(owner.conn.db.exploreEntry.count()),
    relation_count: String(owner.conn.db.exploreRelation.count()),
    owner_watch_count: ownerWatchSource.snapshot().length,
    owner_contact_count: ownerContactSource.snapshot().length,
    agent_contact_count: agentContactSource.snapshot().length,
    stranger_contact_count: createSpacetimeContactSource(stranger.conn.db as any).snapshot().length,
    projection_source_revision: 'run:explore@1',
    cross_field_mutation_denied: true,
    participant_impersonation_denied: true,
    projection_overwrite_denied: true,
    index_pollution_denied: true,
    private_relation_tables_denied: true,
    revoked_authority_denied: true,
    expired_authority_denied: true,
    contact_duplicate_denied: true,
    contact_block_denied: true,
    contact_oversize_denied: true,
    contact_rate_limit_denied: true,
    contact_creates_no_projection: true,
  }, null, 2));

  live.dispose();
} finally {
  for (const client of clients) client.conn.disconnect();
}
