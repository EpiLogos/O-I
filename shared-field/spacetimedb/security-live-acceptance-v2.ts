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
  relationStorageRef,
} from '../spacetimedb.mjs';
import { createSpacetimeWatchSource } from '../spacetimedb-watch.mjs';
import { createSpacetimeContactSource } from '../spacetimedb-contact.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 15_000;

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
  return new Promise<{ name: string; conn: DbConnection; identity: any; token: string }>((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn, identity, token) => resolve({ name, conn, identity, token }))
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
          assert.ok(error, `${description} should fail`);
          resolve();
        }
      })
      .subscribe(query);
  });
}

async function expectRejected(run: () => Promise<unknown>, description: string): Promise<void> {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${description} should reject`);
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
const hostileField = { ...field, field_ref: 'oi:field:hostile', title: 'Independent hostile field' };
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
const strangerParticipant = makeParticipant(field.field_ref, 'stranger');

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
const PUBLIC = [
  'SELECT * FROM shared_field',
  'SELECT * FROM participant',
  'SELECT * FROM projection',
  'SELECT * FROM explore_entry',
  'SELECT * FROM explore_relation',
];
const PRIVATE_VIEWS = [
  'SELECT * FROM my_field_authority',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
];

try {
  assert.notEqual(owner.identity.toHexString(), agent.identity.toHexString());
  assert.notEqual(agent.identity.toHexString(), stranger.identity.toHexString());
  for (const client of clients) await subscribe(client.conn, [...PUBLIC, ...PRIVATE_VIEWS]);

  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM watch', 'private Watch table');
  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM contact', 'private Contact table');
  await expectSubscriptionDenied(probe.conn, 'SELECT * FROM field_authority', 'private authority table');

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
  await waitUntil(() => owner.conn.db.sharedField.fieldRef.find(field.field_ref), 'owned field');

  await expectRejected(() => stranger.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify({ ...field, title: 'hostile rewrite' }),
  }), 'cross-field mutation by non-owner');
  await expectRejected(() => owner.conn.reducers.putSharedField({
    fieldRef: hostileField.field_ref,
    kind: hostileField.kind,
    visibility: hostileField.visibility,
    contractJson: JSON.stringify({ ...hostileField, title: 'owner steals hostile field' }),
  }), 'reciprocal cross-field mutation');

  for (const value of [humanParticipant, agentParticipant, strangerParticipant]) {
    await owner.conn.reducers.putParticipant(participantArgs(value));
  }
  await expectRejected(() => stranger.conn.reducers.putParticipant(participantArgs({
    ...strangerParticipant,
    participant_ref: 'participant:security:pollution',
  })), 'participant creation without field ownership');

  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: humanParticipant.participant_ref,
    targetIdentity: owner.identity,
    role: 'contributor',
    ttlSeconds: 0,
  });
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: agentParticipant.participant_ref,
    targetIdentity: agent.identity,
    role: 'contributor',
    ttlSeconds: 0,
  });
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
    targetIdentity: stranger.identity,
    role: 'contact',
    ttlSeconds: 0,
  });

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
  }), 'publisher impersonation / revision overwrite');

  const refined = refineProjection(projection, {
    publisher_participant_ref: humanParticipant.participant_ref,
    published_at: '2026-08-16T19:05:00.000Z',
    representation: { kind: 'explore-entry', ref: projectionEntry.ref, payload: { summary: 'Human-refined wording.' } },
    provenance: [{ kind: 'human-refinement', ref: humanParticipant.participant_ref, source_system: 'o-i', revision: 'refine@1' }],
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
  assert.equal(refined.source.revision, 'run:explore@1');

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
  await expectRejected(() => stranger.conn.reducers.putExploreEntry({
    semanticRef: 'wiki:o-i:index-poison',
    fieldRef: field.field_ref,
    worldRef: worldEntry.ref,
    kind: 'wiki-node',
    label: 'Index poison',
    revision: 'hostile@1',
    entryJson: JSON.stringify({ schema: 'oi.explore-entry/v1', ref: 'wiki:o-i:index-poison', kind: 'wiki-node', world_ref: worldEntry.ref, label: 'Index poison', provenance: [] }),
  }), 'non-owner Explore index pollution');

  const live = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db));
  await waitUntil(() => live.search('knowledge navigation')[0]?.ref === 'wiki:o-i:explore:knowledge-navigation', 'Explore rebuild');
  assert.equal(live.snapshot().projections.length, 2);
  assert.equal(live.snapshot().projections[1].source.revision, 'run:explore@1');
  assert.equal('watch' in live.snapshot(), false);
  assert.equal('contact' in live.snapshot(), false);

  const watch = createWatch({
    watch_ref: 'watch:security:ariadne:parasakti',
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
  const ownerWatch = createSpacetimeWatchSource(owner.conn.db as any);
  const agentWatch = createSpacetimeWatchSource(agent.conn.db as any);
  const strangerWatch = createSpacetimeWatchSource(stranger.conn.db as any);
  await waitUntil(() => ownerWatch.snapshot().length === 1, 'owner private Watch view');
  assert.equal(agentWatch.snapshot().length, 0);
  assert.equal(strangerWatch.snapshot().length, 0);

  const ownerContact = createSpacetimeContactSource(owner.conn.db as any);
  const agentContact = createSpacetimeContactSource(agent.conn.db as any);
  const strangerContact = createSpacetimeContactSource(stranger.conn.db as any);
  const request = (ref: string, purpose = 'Bounded collaboration request.') => agent.conn.reducers.requestContact({
    contactRef: ref,
    fieldRef: field.field_ref,
    initiatorParticipantRef: agentParticipant.participant_ref,
    recipientParticipantRef: humanParticipant.participant_ref,
    purpose,
    requestedScopeJson: JSON.stringify({ mode: 'conversation', topic_ref: 'wiki:o-i:explore:knowledge-navigation' }),
    ttlSeconds: 600,
    provenanceJson: JSON.stringify({ source_system: 'o-i', source_revision: `security-contact:${ref}@1` }),
  });

  await request('contact:security:1');
  await waitUntil(() => ownerContact.snapshot().some(row => row.contact.contact_ref === 'contact:security:1'), 'recipient Contact view');
  await waitUntil(() => agentContact.snapshot().some(row => row.contact.contact_ref === 'contact:security:1'), 'initiator Contact view');
  assert.equal(strangerContact.snapshot().length, 0, 'unrelated caller must not receive private Contact graph');

  await expectRejected(() => agent.conn.reducers.respondContact({
    contactRef: 'contact:security:1',
    recipientParticipantRef: humanParticipant.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ note: 'spoofed recipient response' }),
  }), 'initiator cannot impersonate recipient');
  await owner.conn.reducers.respondContact({
    contactRef: 'contact:security:1',
    recipientParticipantRef: humanParticipant.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ scope: 'conversation-only' }),
  });
  await waitUntil(() => ownerContact.snapshot().find(row => row.contact.contact_ref === 'contact:security:1')?.contact.state === 'accepted', 'explicit Contact acceptance');

  await owner.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: humanParticipant.participant_ref,
    blockedParticipantRef: agentParticipant.participant_ref,
    mode: 'blocked',
  });
  await expectRejected(() => request('contact:security:blocked'), 'blocked origin Contact');
  await owner.conn.reducers.setContactPolicy({
    fieldRef: field.field_ref,
    blockerParticipantRef: humanParticipant.participant_ref,
    blockedParticipantRef: agentParticipant.participant_ref,
    mode: 'clear',
  });
  await expectRejected(() => request('contact:security:oversize', 'x'.repeat(501)), 'oversized Contact purpose');

  for (let n = 2; n <= 3; n += 1) {
    const ref = `contact:security:${n}`;
    await request(ref);
    await owner.conn.reducers.respondContact({
      contactRef: ref,
      recipientParticipantRef: humanParticipant.participant_ref,
      decision: 'declined',
      responseJson: JSON.stringify({ reason: 'fixture decline' }),
    });
  }
  await expectRejected(() => request('contact:security:4'), 'high-rate Contact request');

  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
  });
  await expectRejected(() => stranger.conn.reducers.requestContact({
    contactRef: 'contact:security:revoked',
    fieldRef: field.field_ref,
    initiatorParticipantRef: strangerParticipant.participant_ref,
    recipientParticipantRef: humanParticipant.participant_ref,
    purpose: 'Should fail after revocation.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  }), 'revoked authority');

  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: field.field_ref,
    participantRef: strangerParticipant.participant_ref,
    targetIdentity: stranger.identity,
    role: 'contact',
    ttlSeconds: 1,
  });
  await sleep(1_150);
  await expectRejected(() => stranger.conn.reducers.requestContact({
    contactRef: 'contact:security:expired',
    fieldRef: field.field_ref,
    initiatorParticipantRef: strangerParticipant.participant_ref,
    recipientParticipantRef: humanParticipant.participant_ref,
    purpose: 'Should fail after expiry.',
    requestedScopeJson: '{}',
    ttlSeconds: 60,
    provenanceJson: '{}',
  }), 'expired authority');

  console.log(JSON.stringify({
    proof: 'oi-encounter-security-spacetimedb-v1',
    spacetimedb: '2.8.1',
    identities: clients.map(client => ({ name: client.name, identity: client.identity.toHexString() })),
    public_participants: String(owner.conn.db.participant.count()),
    projection_revisions: String(owner.conn.db.projection.count()),
    explore_entries: String(owner.conn.db.exploreEntry.count()),
    private_watch_owner_visible: ownerWatch.snapshot().length,
    private_watch_unrelated_visible: strangerWatch.snapshot().length,
    contact_rows_owner_visible: ownerContact.snapshot().length,
    contact_rows_unrelated_visible: strangerContact.snapshot().length,
    attacks: {
      cross_field_mutation: 'denied',
      participant_creation_without_owner: 'denied',
      projection_impersonation: 'denied',
      explore_pollution: 'denied',
      private_table_subscription: 'denied',
      recipient_impersonation: 'denied',
      blocked_contact: 'denied',
      oversized_contact: 'denied',
      high_rate_contact: 'denied',
      revoked_authority: 'denied',
      expired_authority: 'denied',
    },
  }, null, 2));

  live.dispose();
} finally {
  for (const client of [...clients, probe]) client.conn.disconnect();
}
