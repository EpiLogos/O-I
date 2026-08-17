import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { refineProjection } from '../projection-refinement.mjs';
import { createWatch } from '../watch.mjs';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
  projectionStorageKey,
} from '../spacetimedb.mjs';
import { createSpacetimeWatchSource } from '../spacetimedb-watch.mjs';
import { createSpacetimeContactSource } from '../spacetimedb-contact.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
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

async function expectRejected(run: () => Promise<unknown>, description: string): Promise<void> {
  let rejected = false;
  try {
    await run();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `${description} should reject`);
}

async function expectSubscriptionDenied(conn: DbConnection, query: string, description: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => reject(new Error(`${description} unexpectedly applied`)))
      .onError(() => resolve())
      .subscribe(query);
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

function makeParticipant(fieldRef: string, suffix: string, kind = 'agent') {
  return createParticipant({
    participant_ref: `participant:security:${suffix}`,
    field_ref: fieldRef,
    identity: { kind, ref: `${kind}:security:${suffix}` },
    presentation: { world_ref: `world:security:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `security:${suffix}@1` },
  });
}

const fixture = JSON.parse(await readFile(new URL('../fixtures/explore-world-v1.json', import.meta.url), 'utf8'));
const byRef = new Map(fixture.entries.map((entry: any) => [entry.ref, entry]));
const fieldEntry: any = byRef.get('oi:field:public');
const worldEntry: any = byRef.get('world:human:ariadne');
const agentEntry: any = byRef.get('agent:parasakti');
const projectionEntry: any = byRef.get('projection:parasakti:explore-note');
assert.ok(fieldEntry && worldEntry && agentEntry && projectionEntry);

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: fieldEntry.ref,
  kind: 'public',
  visibility: 'public',
  title: fieldEntry.label,
  provenance: fieldEntry.provenance,
};
const foreignField = { ...field, field_ref: 'oi:field:security-foreign', title: 'Foreign owner field' };
const human = createParticipant({
  participant_ref: worldEntry.meta.participant_ref,
  field_ref: field.field_ref,
  identity: { kind: 'human', ref: worldEntry.provenance[0].ref },
  presentation: { world_ref: worldEntry.ref },
  provenance: { source_system: worldEntry.provenance[0].source_system, source_revision: worldEntry.provenance[0].revision },
});
const agentParticipant = createParticipant({
  participant_ref: agentEntry.meta.participant_ref,
  field_ref: field.field_ref,
  identity: { kind: 'agent', ref: agentEntry.ref },
  presentation: { world_ref: agentEntry.world_ref },
  provenance: { source_system: agentEntry.provenance[0].source_system, source_revision: agentEntry.provenance[0].revision },
  agency: { ref: agentEntry.meta.agency_ref, source_system: agentEntry.provenance[0].source_system },
});
const strangerParticipant = makeParticipant(field.field_ref, 'stranger');
const silentParticipant = makeParticipant(field.field_ref, 'silent');

const projection = {
  schema: 'oi.projection/v1',
  projection_ref: projectionEntry.projection_ref,
  projection_revision: 1,
  state: 'published',
  subject: { ref: projectionEntry.provenance[1].ref, kind: projectionEntry.provenance[1].kind },
  source: { system: projectionEntry.provenance[1].source_system, revision: projectionEntry.meta.source_revision },
  publisher_participant_ref: agentParticipant.participant_ref,
  published_at: '2026-08-16T12:00:00.000Z',
  audience: { visibility: 'public' },
  representation: { kind: 'explore-entry', ref: projectionEntry.ref },
  provenance: projectionEntry.provenance,
};

const [owner, agent, stranger, probe] = await Promise.all([
  connect('owner'), connect('agent'), connect('stranger'), connect('probe'),
]);
const clients = [owner, agent, stranger];
const publicQueries = [
  'SELECT * FROM shared_field',
  'SELECT * FROM participant',
  'SELECT * FROM projection',
  'SELECT * FROM explore_entry',
  'SELECT * FROM explore_relation',
];
const privateViews = [
  'SELECT * FROM my_field_authority',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
];

try {
  assert.notEqual(owner.identity.toHexString(), agent.identity.toHexString());
  assert.notEqual(agent.identity.toHexString(), stranger.identity.toHexString());
  for (const client of clients) await subscribe(client.conn, [...publicQueries, ...privateViews]);

  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM watch', 'raw Watch');
  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM contact', 'raw Contact');
  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM field_authority', 'raw authority');

  await owner.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await stranger.conn.reducers.putSharedField({
    fieldRef: foreignField.field_ref,
    kind: foreignField.kind,
    visibility: foreignField.visibility,
    contractJson: JSON.stringify(foreignField),
  });
  await waitUntil(() => owner.conn.db.sharedField.fieldRef.find(field.field_ref), 'primary field');

  await expectRejected(() => stranger.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify({ ...field, title: 'cross-field overwrite' }),
  }), 'cross-field mutation');
  await expectRejected(() => owner.conn.reducers.putSharedField({
    fieldRef: 'oi:field:private-attempt',
    kind: 'private',
    visibility: 'private',
    contractJson: JSON.stringify({ ...field, field_ref: 'oi:field:private-attempt', kind: 'private', visibility: 'private' }),
  }), 'private field entering public floor');

  for (const value of [human, agentParticipant, strangerParticipant, silentParticipant]) {
    await owner.conn.reducers.putParticipant(participantArgs(value));
  }
  await expectRejected(() => stranger.conn.reducers.putParticipant(participantArgs({
    ...strangerParticipant,
    participant_ref: 'participant:security:pollution',
  })), 'non-owner Participant creation');
  await expectRejected(() => owner.conn.reducers.putParticipant({
    ...participantArgs(strangerParticipant),
    participantRef: 'participant:security:semantic-spoof',
  }), 'Participant semantic-ref spoof');

  for (const grant of [
    { participantRef: human.participant_ref, targetIdentity: owner.identity, role: 'contributor', contactable: true },
    { participantRef: agentParticipant.participant_ref, targetIdentity: agent.identity, role: 'contributor', contactable: true },
    { participantRef: strangerParticipant.participant_ref, targetIdentity: stranger.identity, role: 'contact', contactable: true },
    { participantRef: silentParticipant.participant_ref, targetIdentity: probe.identity, role: 'observer', contactable: false },
  ]) {
    await owner.conn.reducers.grantParticipantAuthority({
      fieldRef: field.field_ref,
      ...grant,
      ttlSeconds: 0,
    });
  }

  await agent.conn.reducers.putProjection({
    projectionKey: projectionStorageKey(projection.projection_ref, 1),
    fieldRef: field.field_ref,
    projectionRef: projection.projection_ref,
    projectionRevision: 1,
    sourceRevision: projection.source.revision,
    publisherParticipantRef: projection.publisher_participant_ref,
    state: projection.state,
    contractJson: JSON.stringify(projection),
  });
  await expectRejected(() => stranger.conn.reducers.putProjection({
    projectionKey: projectionStorageKey(projection.projection_ref, 1),
    fieldRef: field.field_ref,
    projectionRef: projection.projection_ref,
    projectionRevision: 1,
    sourceRevision: 'spoofed@1',
    publisherParticipantRef: agentParticipant.participant_ref,
    state: projection.state,
    contractJson: JSON.stringify(projection),
  }), 'Projection publisher impersonation');
  await expectRejected(() => agent.conn.reducers.putProjection({
    projectionKey: 'projection:security:private@1',
    fieldRef: field.field_ref,
    projectionRef: 'projection:security:private',
    projectionRevision: 1,
    sourceRevision: 'private@1',
    publisherParticipantRef: agentParticipant.participant_ref,
    state: 'published',
    contractJson: JSON.stringify({
      ...projection,
      projection_ref: 'projection:security:private',
      source: { ...projection.source, revision: 'private@1' },
      audience: { visibility: 'private' },
    }),
  }), 'private Projection entering public floor');

  const refined = refineProjection(projection, {
    publisher_participant_ref: human.participant_ref,
    published_at: '2026-08-16T19:05:00.000Z',
    representation: { kind: 'explore-entry', ref: projectionEntry.ref, payload: { summary: 'Human refinement.' } },
    provenance: [{ kind: 'human-refinement', ref: human.participant_ref, source_system: 'o-i', revision: 'refine@1' }],
  });
  await owner.conn.reducers.putProjection({
    projectionKey: projectionStorageKey(refined.projection_ref, refined.projection_revision),
    fieldRef: field.field_ref,
    projectionRef: refined.projection_ref,
    projectionRevision: refined.projection_revision,
    sourceRevision: refined.source.revision,
    publisherParticipantRef: refined.publisher_participant_ref,
    state: refined.state,
    contractJson: JSON.stringify(refined),
  });
  assert.equal(refined.source.revision, projection.source.revision);

  for (const entry of [worldEntry, agentEntry, projectionEntry]) {
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
  await expectRejected(() => stranger.conn.reducers.putExploreEntry({
    semanticRef: 'wiki:o-i:poison',
    fieldRef: field.field_ref,
    worldRef: worldEntry.ref,
    kind: 'wiki-node',
    label: 'Poison',
    revision: 'hostile@1',
    entryJson: JSON.stringify({ schema: 'oi.explore-entry/v1', ref: 'wiki:o-i:poison', world_ref: worldEntry.ref, kind: 'wiki-node', label: 'Poison', provenance: [] }),
  }), 'Explore index pollution');
  await expectRejected(() => owner.conn.reducers.putExploreEntry({
    semanticRef: 'agent:semantic-spoof',
    fieldRef: field.field_ref,
    worldRef: agentEntry.world_ref,
    kind: agentEntry.kind,
    label: agentEntry.label,
    revision: agentEntry.revision ?? '',
    entryJson: JSON.stringify(agentEntry),
  }), 'SpaceTimeDB ID to semantic-ref spoof');

  const live = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db));
  await waitUntil(() => live.read(agentEntry.ref)?.ref === agentEntry.ref, 'Explore security seed');
  assert.equal(live.snapshot().projections.length, 2);
  assert.equal(live.snapshot().projections[1].source.revision, projection.source.revision);
  assert.equal('watch' in live.snapshot(), false);
  assert.equal('contact' in live.snapshot(), false);

  const ownerWatchContract = createWatch({
    watch_ref: 'watch:security:owner:agent',
    watcher_participant_ref: human.participant_ref,
    field_ref: field.field_ref,
    target: { kind: 'agent', ref: agentEntry.ref },
    created_at: '2026-08-16T19:00:00.000Z',
    provenance: { source_system: 'o-i', source_revision: 'security-watch@1' },
  });
  await owner.conn.reducers.putWatch({
    watchRef: ownerWatchContract.watch_ref,
    fieldRef: ownerWatchContract.field_ref,
    watcherParticipantRef: ownerWatchContract.watcher_participant_ref,
    targetKind: ownerWatchContract.target.kind,
    targetRef: ownerWatchContract.target.ref,
    state: ownerWatchContract.state,
    contractJson: JSON.stringify(ownerWatchContract),
  });

  const strangerWatchContract = createWatch({
    watch_ref: 'watch:security:stranger:agent',
    watcher_participant_ref: strangerParticipant.participant_ref,
    field_ref: field.field_ref,
    target: { kind: 'agent', ref: agentEntry.ref },
    created_at: '2026-08-16T19:01:00.000Z',
    provenance: { source_system: 'o-i', source_revision: 'security-watch-stranger@1' },
  });
  await stranger.conn.reducers.putWatch({
    watchRef: strangerWatchContract.watch_ref,
    fieldRef: strangerWatchContract.field_ref,
    watcherParticipantRef: strangerWatchContract.watcher_participant_ref,
    targetKind: strangerWatchContract.target.kind,
    targetRef: strangerWatchContract.target.ref,
    state: strangerWatchContract.state,
    contractJson: JSON.stringify(strangerWatchContract),
  });

  const ownerWatch = createSpacetimeWatchSource(owner.conn.db as any);
  const agentWatch = createSpacetimeWatchSource(agent.conn.db as any);
  const strangerWatch = createSpacetimeWatchSource(stranger.conn.db as any);
  await waitUntil(() => ownerWatch.snapshot().length === 1, 'owner private Watch');
  await waitUntil(() => strangerWatch.snapshot().length === 1, 'stranger private Watch');
  assert.equal(agentWatch.snapshot().length, 0);

  const ownerContact = createSpacetimeContactSource(owner.conn.db as any);
  const agentContact = createSpacetimeContactSource(agent.conn.db as any);
  const strangerContact = createSpacetimeContactSource(stranger.conn.db as any);
  const requestFromAgent = (ref: string, purpose = 'Bounded collaboration request.') => agent.conn.reducers.requestContact({
    contactRef: ref,
    fieldRef: field.field_ref,
    initiatorParticipantRef: agentParticipant.participant_ref,
    recipientParticipantRef: human.participant_ref,
    purpose,
    requestedScopeJson: JSON.stringify({ mode: 'conversation', topic_ref: agentEntry.ref }),
    ttlSeconds: 600,
    provenanceJson: JSON.stringify({ source_system: 'o-i', source_revision: `${ref}@1` }),
  });

  await expectRejected(() => agent.conn.reducers.requestContact({
    contactRef: 'contact:security:not-contactable',
    fieldRef: field.field_ref,
    initiatorParticipantRef: agentParticipant.participant_ref,
    recipientParticipantRef: silentParticipant.participant_ref,
    purpose: 'Discoverable must not imply contactable.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  }), 'discoverable non-contactable Participant');

  await requestFromAgent('contact:security:1');
  await waitUntil(() => ownerContact.snapshot().some(row => row.contact.contact_ref === 'contact:security:1'), 'recipient Contact');
  await waitUntil(() => agentContact.snapshot().some(row => row.contact.contact_ref === 'contact:security:1'), 'initiator Contact');
  assert.equal(strangerContact.snapshot().length, 0);

  await expectRejected(() => agent.conn.reducers.respondContact({
    contactRef: 'contact:security:1',
    recipientParticipantRef: human.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ note: 'spoof' }),
  }), 'recipient impersonation');
  await owner.conn.reducers.respondContact({
    contactRef: 'contact:security:1',
    recipientParticipantRef: human.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ scope: 'conversation-only' }),
  });

  await owner.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: human.participant_ref,
    blockedParticipantRef: agentParticipant.participant_ref,
    mode: 'blocked',
  });
  await expectRejected(() => requestFromAgent('contact:security:blocked'), 'blocked Contact');
  await owner.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: human.participant_ref,
    blockedParticipantRef: agentParticipant.participant_ref,
    mode: 'clear',
  });
  await expectRejected(() => requestFromAgent('contact:security:oversize', 'x'.repeat(501)), 'oversized Contact');

  for (let n = 2; n <= 3; n += 1) {
    const ref = `contact:security:${n}`;
    await requestFromAgent(ref);
    await owner.conn.reducers.respondContact({
      contactRef: ref,
      recipientParticipantRef: human.participant_ref,
      decision: 'declined',
      responseJson: JSON.stringify({ reason: 'fixture' }),
    });
  }
  await expectRejected(() => requestFromAgent('contact:security:4'), 'high-rate Contact');

  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
  });
  await waitUntil(() => strangerWatch.snapshot().length === 0, 'revoked private Watch visibility');
  assert.equal(strangerContact.snapshot().length, 0);
  await expectRejected(() => stranger.conn.reducers.requestContact({
    contactRef: 'contact:security:revoked',
    fieldRef: field.field_ref,
    initiatorParticipantRef: strangerParticipant.participant_ref,
    recipientParticipantRef: human.participant_ref,
    purpose: 'Revoked.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  }), 'revoked authority');

  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
    targetIdentity: stranger.identity,
    role: 'contact',
    contactable: true,
    ttlSeconds: 1,
  });
  assert.equal(strangerWatch.snapshot().length, 0, 'finite grant must not disclose private Watch state');
  assert.equal(strangerContact.snapshot().length, 0, 'finite grant must not disclose private Contact state');
  await stranger.conn.reducers.requestContact({
    contactRef: 'contact:security:finite-live',
    fieldRef: field.field_ref,
    initiatorParticipantRef: strangerParticipant.participant_ref,
    recipientParticipantRef: human.participant_ref,
    purpose: 'Finite mutation authority before expiry.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  });
  await waitUntil(() => ownerContact.snapshot().some(row => row.contact.contact_ref === 'contact:security:finite-live'), 'finite-grant mutation reaches recipient');
  assert.equal(strangerContact.snapshot().length, 0, 'finite initiator still receives no private relation view');
  await sleep(1_150);
  await expectRejected(() => stranger.conn.reducers.requestContact({
    contactRef: 'contact:security:expired',
    fieldRef: field.field_ref,
    initiatorParticipantRef: strangerParticipant.participant_ref,
    recipientParticipantRef: human.participant_ref,
    purpose: 'Expired.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  }), 'server-time expired authority');

  console.log(JSON.stringify({
    proof: 'oi-encounter-security-spacetimedb/v3',
    spacetimedb: '2.8.1',
    identities: clients.map(client => ({ name: client.name, identity: client.identity.toHexString() })),
    public_participants: String(owner.conn.db.participant.count()),
    projection_revisions: String(owner.conn.db.projection.count()),
    private_watch_owner_visible: ownerWatch.snapshot().length,
    private_watch_revoked_or_finite_visible: strangerWatch.snapshot().length,
    private_contact_unrelated_or_finite_visible: strangerContact.snapshot().length,
    attacks: {
      private_content_public_floor: 'denied',
      cross_field_mutation: 'denied',
      participant_creation_without_owner: 'denied',
      semantic_ref_spoof: 'denied',
      projection_impersonation: 'denied',
      explore_pollution: 'denied',
      private_table_subscription: 'denied',
      discoverable_not_contactable: 'denied',
      recipient_impersonation: 'denied',
      blocked_contact: 'denied',
      oversized_contact: 'denied',
      high_rate_contact: 'denied',
      revoked_authority: 'denied_and_private_views_removed',
      finite_private_read: 'fail_closed',
      expired_authority: 'denied_server_time',
    },
  }, null, 2));

  live.dispose();
} finally {
  for (const client of [...clients, probe]) client.conn.disconnect();
}
