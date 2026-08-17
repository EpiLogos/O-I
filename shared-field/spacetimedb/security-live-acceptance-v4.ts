import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createWatch } from '../watch.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';

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

type Client = { name: string; conn: DbConnection; identity: any; token: string };

async function connect(name: string, token?: string): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    let builder = DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE);
    if (token) builder = builder.withToken(token);
    builder
      .onConnect((conn, identity, issuedToken) => resolve({ name, conn, identity, token: issuedToken }))
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

function rows(handle: any): any[] {
  return [...handle.iter()];
}

function hasField(client: Client, fieldRef: string): boolean {
  return rows(client.conn.db.sharedField).some(row => row.fieldRef === fieldRef);
}

function hasParticipant(client: Client, participantRef: string): boolean {
  return rows(client.conn.db.participant).some(row => row.participantRef === participantRef);
}

function projectionRow(client: Client, projectionRef: string): any | undefined {
  return rows(client.conn.db.projection).find(row => row.projectionRef === projectionRef);
}

function hasExplore(client: Client, semanticRef: string): boolean {
  return rows(client.conn.db.exploreEntry).some(row => row.semanticRef === semanticRef);
}

function hasRelation(client: Client, relationRef: string): boolean {
  return rows(client.conn.db.exploreRelation).some(row => row.relationRef === relationRef);
}

function fieldContract(fieldRef: string, visibility: string, title: string) {
  return {
    schema: 'oi.shared-field/v1',
    field_ref: fieldRef,
    kind: visibility === 'public' ? 'public' : 'general',
    visibility,
    title,
    provenance: [{ kind: 'shared-field', ref: fieldRef, source_system: 'o-i', revision: `${fieldRef}@1` }],
  };
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
    participant_ref: `participant:${suffix}:${fieldRef}`,
    field_ref: fieldRef,
    identity: { kind, ref: `${kind}:${suffix}` },
    presentation: { world_ref: `world:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `${suffix}@1` },
  });
}

function projectionContract(input: {
  projectionRef: string;
  revision: number;
  publisherParticipantRef: string;
  audience: { visibility: string; refs?: string[] };
  representation: any;
  state?: 'published' | 'withdrawn';
  sourceRevision?: string;
}) {
  const state = input.state ?? 'published';
  return {
    schema: 'oi.projection/v1',
    projection_ref: input.projectionRef,
    projection_revision: input.revision,
    state,
    subject: { ref: `subject:${input.projectionRef}`, kind: 'agent' },
    source: { system: 'o-i-security-fixture', revision: input.sourceRevision ?? `${input.projectionRef}@${input.revision}` },
    publisher_participant_ref: input.publisherParticipantRef,
    published_at: `2026-08-17T08:${String(input.revision).padStart(2, '0')}:00.000Z`,
    audience: input.audience,
    representation: input.representation,
    provenance: [{ kind: 'security-fixture', ref: input.projectionRef, source_system: 'o-i', revision: `r${input.revision}` }],
    ...(state === 'withdrawn' ? { withdrawal: { reason: 'fixture withdrawal', source_history_deleted: false } } : {}),
  };
}

function projectionArgs(fieldRef: string, projection: any) {
  return {
    projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
    fieldRef,
    projectionRef: projection.projection_ref,
    projectionRevision: projection.projection_revision,
    sourceRevision: projection.source.revision,
    publisherParticipantRef: projection.publisher_participant_ref,
    state: projection.state,
    contractJson: JSON.stringify(projection),
  };
}

function exploreEntry(ref: string, kind: string, worldRef: string, label: string, extra: any = {}) {
  return {
    schema: 'oi.explore-entry/v1',
    ref,
    kind,
    world_ref: worldRef,
    label,
    summary: `${label} security fixture`,
    provenance: [{ kind: 'security-fixture', ref, source_system: 'o-i', revision: `${ref}@1` }],
    ...extra,
  };
}

function exploreArgs(fieldRef: string, entry: any) {
  return {
    semanticRef: entry.ref,
    fieldRef,
    worldRef: entry.world_ref,
    kind: entry.kind,
    label: entry.label,
    revision: entry.revision ?? '',
    entryJson: JSON.stringify(entry),
  };
}

function relation(ref: string, from: string, to: string) {
  return {
    relation_ref: ref,
    from,
    to,
    relation: 'oi.references',
    origin: 'security-fixture',
    provenance: [{ kind: 'security-fixture', ref, source_system: 'o-i', revision: `${ref}@1` }],
  };
}

function relationArgs(fieldRef: string, value: any) {
  return {
    relationRef: value.relation_ref,
    fieldRef,
    fromRef: value.from,
    toRef: value.to,
    relation: value.relation,
    origin: value.origin,
    relationJson: JSON.stringify(value),
  };
}

const publicField = fieldContract('oi:field:phase1-public', 'public', 'Phase 1 Public');
const restrictedField = fieldContract('oi:field:phase1-restricted', 'restricted', 'Phase 1 Restricted');
const privateField = fieldContract('oi:field:phase1-private', 'private', 'Phase 1 Private');
const foreignField = fieldContract('oi:field:phase1-foreign', 'public', 'Foreign owner field');
const unlistedField = fieldContract('oi:field:phase1-unlisted', 'unlisted', 'Rejected unlisted field');

const clients = await Promise.all([
  connect('OWNER'),
  connect('MEMBER'),
  connect('EXPLICIT_PRIVATE_RECIPIENT'),
  connect('REVOKED_ACTOR'),
  connect('FINITE_ACTOR'),
  connect('STRANGER'),
  connect('REMOTE_AGENT'),
]);
const [owner, member, recipient, revokedActor, finiteActor, stranger, remoteAgent] = clients;
let reconnectedRevoked: Client | undefined;

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
  assert.equal(new Set(clients.map(client => client.identity.toHexString())).size, clients.length);
  for (const client of clients) await subscribe(client.conn, [...publicQueries, ...privateViews]);

  for (const [tableName, description] of [
    ['shared_field_backing', 'raw SharedField backing'],
    ['participant_backing', 'raw Participant backing'],
    ['projection_backing', 'raw Projection backing'],
    ['explore_entry_backing', 'raw Explore entry backing'],
    ['explore_relation_backing', 'raw Explore relation backing'],
    ['field_read_grant', 'raw field read audience'],
    ['field_authority', 'raw authority'],
    ['watch', 'raw Watch'],
    ['contact', 'raw Contact'],
  ] as const) {
    await expectSubscriptionDenied(stranger.conn, `SELECT * FROM ${tableName}`, description);
  }

  for (const field of [publicField, restrictedField, privateField]) {
    await owner.conn.reducers.putSharedField({
      fieldRef: field.field_ref,
      kind: field.kind,
      visibility: field.visibility,
      contractJson: JSON.stringify(field),
    });
  }
  await stranger.conn.reducers.putSharedField({
    fieldRef: foreignField.field_ref,
    kind: foreignField.kind,
    visibility: foreignField.visibility,
    contractJson: JSON.stringify(foreignField),
  });
  await expectRejected(() => owner.conn.reducers.putSharedField({
    fieldRef: unlistedField.field_ref,
    kind: unlistedField.kind,
    visibility: unlistedField.visibility,
    contractJson: JSON.stringify(unlistedField),
  }), 'hosted unlisted field');
  await expectRejected(() => stranger.conn.reducers.putSharedField({
    fieldRef: publicField.field_ref,
    kind: publicField.kind,
    visibility: publicField.visibility,
    contractJson: JSON.stringify({ ...publicField, title: 'cross-field overwrite' }),
  }), 'cross-field field mutation');

  await waitUntil(() => hasField(owner, privateField.field_ref), 'owner private field visibility');
  assert.equal(hasField(stranger, restrictedField.field_ref), false);
  assert.equal(hasField(stranger, privateField.field_ref), false);

  const ownerPublic = makeParticipant(publicField.field_ref, 'owner', 'human');
  const remotePublic = makeParticipant(publicField.field_ref, 'remote-agent');
  const memberPublic = makeParticipant(publicField.field_ref, 'member');
  const recipientPublic = makeParticipant(publicField.field_ref, 'recipient');
  const revokedPublic = makeParticipant(publicField.field_ref, 'revoked');

  const memberRestricted = makeParticipant(restrictedField.field_ref, 'member-restricted');
  const memberPrivate = makeParticipant(privateField.field_ref, 'member-private');
  const recipientPrivate = makeParticipant(privateField.field_ref, 'recipient-private');
  const revokedPrivate = makeParticipant(privateField.field_ref, 'revoked-private');
  const finitePrivate = makeParticipant(privateField.field_ref, 'finite-private');
  const foreignParticipant = makeParticipant(foreignField.field_ref, 'foreign');

  for (const value of [
    ownerPublic, remotePublic, memberPublic, recipientPublic, revokedPublic,
    memberRestricted, memberPrivate, recipientPrivate, revokedPrivate, finitePrivate,
  ]) {
    await owner.conn.reducers.putParticipant(participantArgs(value));
  }
  await stranger.conn.reducers.putParticipant(participantArgs(foreignParticipant));
  await expectRejected(() => stranger.conn.reducers.putParticipant(participantArgs({
    ...memberPublic,
    participant_ref: 'participant:phase1:pollution',
  })), 'non-owner Participant creation');

  for (const grant of [
    { fieldRef: publicField.field_ref, participantRef: ownerPublic.participant_ref, targetIdentity: owner.identity, role: 'contributor', contactable: true },
    { fieldRef: publicField.field_ref, participantRef: remotePublic.participant_ref, targetIdentity: remoteAgent.identity, role: 'contributor', contactable: true },
    { fieldRef: publicField.field_ref, participantRef: memberPublic.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: true },
    { fieldRef: publicField.field_ref, participantRef: recipientPublic.participant_ref, targetIdentity: recipient.identity, role: 'observer', contactable: true },
    { fieldRef: publicField.field_ref, participantRef: revokedPublic.participant_ref, targetIdentity: revokedActor.identity, role: 'contact', contactable: true },
    { fieldRef: restrictedField.field_ref, participantRef: memberRestricted.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: false },
    { fieldRef: privateField.field_ref, participantRef: memberPrivate.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: false },
    { fieldRef: privateField.field_ref, participantRef: recipientPrivate.participant_ref, targetIdentity: recipient.identity, role: 'observer', contactable: false },
    { fieldRef: privateField.field_ref, participantRef: revokedPrivate.participant_ref, targetIdentity: revokedActor.identity, role: 'observer', contactable: false },
  ]) {
    await owner.conn.reducers.grantParticipantAuthority({ ...grant, ttlSeconds: 0 });
  }
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: privateField.field_ref,
    participantRef: finitePrivate.participant_ref,
    targetIdentity: finiteActor.identity,
    role: 'observer',
    contactable: false,
    ttlSeconds: 1,
  });

  await waitUntil(() => hasField(member, restrictedField.field_ref), 'persistent restricted member visibility');
  assert.equal(hasField(member, privateField.field_ref), false, 'ordinary membership must not grant private-field read');
  assert.equal(hasField(recipient, privateField.field_ref), false, 'private recipient needs explicit field read grant');
  assert.equal(hasField(finiteActor, privateField.field_ref), false, 'finite grant cannot receive protected field rows');

  await owner.conn.reducers.grantFieldRead({ fieldRef: privateField.field_ref, participantRef: recipientPrivate.participant_ref });
  await owner.conn.reducers.grantFieldRead({ fieldRef: privateField.field_ref, participantRef: revokedPrivate.participant_ref });
  await expectRejected(
    () => owner.conn.reducers.grantFieldRead({ fieldRef: privateField.field_ref, participantRef: finitePrivate.participant_ref }),
    'finite authority promoted to protected read'
  );
  await waitUntil(() => hasField(recipient, privateField.field_ref), 'explicit private recipient field visibility');
  await waitUntil(() => hasField(revokedActor, privateField.field_ref), 'revocable private field visibility');
  assert.equal(hasField(member, privateField.field_ref), false);
  assert.equal(hasField(stranger, privateField.field_ref), false);
  assert.equal(hasParticipant(stranger, recipientPrivate.participant_ref), false, 'private Participant graph must remain absent');

  await expectRejected(
    () => owner.conn.reducers.grantFieldRead({ fieldRef: privateField.field_ref, participantRef: foreignParticipant.participant_ref }),
    'cross-field explicit read grant'
  );

  const anchor = exploreEntry('entry:phase1:public-anchor', 'wiki-node', 'world:phase1', 'Public anchor');
  const remoteAgentEntry = exploreEntry('agent:phase1:remote', 'agent', 'world:phase1', 'Remote Agent', {
    meta: { participant_ref: remotePublic.participant_ref },
  });
  for (const entry of [anchor, remoteAgentEntry]) {
    await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, entry));
  }
  await waitUntil(() => hasExplore(stranger, anchor.ref), 'public Explore anchor');

  const secretProjection = projectionContract({
    projectionRef: 'projection:phase1:secret',
    revision: 1,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'private', refs: [recipientPublic.participant_ref] },
    representation: { kind: 'explore-entry', ref: 'entry:phase1:secret' },
  });
  await remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, secretProjection));
  const secretEntry = exploreEntry('entry:phase1:secret', 'projection', 'world:phase1', 'Private projected object', {
    projection_ref: secretProjection.projection_ref,
    locators: [{ surface: 'web', locator: '/private/phase1-secret' }],
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, secretEntry));
  const secretRelation = relation('relation:phase1:anchor-secret', anchor.ref, secretEntry.ref);
  await owner.conn.reducers.putExploreRelation(relationArgs(publicField.field_ref, secretRelation));

  await waitUntil(() => projectionRow(recipient, secretProjection.projection_ref)?.projectionRevision === 1, 'explicit private projection recipient');
  await waitUntil(() => hasExplore(recipient, secretEntry.ref), 'explicit private Explore recipient');
  assert.equal(projectionRow(member, secretProjection.projection_ref), undefined, 'ordinary membership must not defeat private Projection refs');
  assert.equal(projectionRow(stranger, secretProjection.projection_ref), undefined);
  assert.equal(hasExplore(stranger, secretEntry.ref), false);
  assert.equal(hasRelation(stranger, secretRelation.relation_ref), false, 'relation must not reveal hidden endpoint');

  await expectRejected(() => remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, projectionContract({
    projectionRef: 'projection:phase1:cross-field-audience',
    revision: 1,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'private', refs: [recipientPrivate.participant_ref] },
    representation: { kind: 'explore-entry', ref: 'entry:phase1:cross-field-audience' },
  }))), 'cross-field Projection audience ref');

  const narrowingRef = 'projection:phase1:narrowing';
  const narrowingEntry = exploreEntry('entry:phase1:narrowing', 'projection', 'world:phase1', 'Narrowing projection', {
    projection_ref: narrowingRef,
    locators: [{ surface: 'web', locator: '/PUBLIC-LOCATOR-LEAK' }],
  });
  const narrowingV1 = projectionContract({
    projectionRef: narrowingRef,
    revision: 1,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'public' },
    representation: { kind: 'explore-entry', ref: narrowingEntry.ref },
  });
  await remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, narrowingV1));
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, narrowingEntry));
  await waitUntil(() => projectionRow(stranger, narrowingRef)?.projectionRevision === 1, 'public projection revision 1');
  await waitUntil(() => hasExplore(stranger, narrowingEntry.ref), 'public projection Explore revision 1');

  const narrowingV2 = projectionContract({
    projectionRef: narrowingRef,
    revision: 2,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'private', refs: [recipientPublic.participant_ref] },
    representation: { kind: 'explore-entry', ref: narrowingEntry.ref, payload: { summary: 'Now private.' } },
  });
  await remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, narrowingV2));
  await waitUntil(() => projectionRow(recipient, narrowingRef)?.projectionRevision === 2, 'private narrowed revision visible to recipient');
  await waitUntil(() => projectionRow(stranger, narrowingRef) === undefined, 'narrowing removes current public Projection');
  await waitUntil(() => !hasExplore(stranger, narrowingEntry.ref), 'narrowing removes current public Explore representation');
  assert.equal(JSON.stringify({
    projections: rows(stranger.conn.db.projection),
    entries: rows(stranger.conn.db.exploreEntry),
  }).includes('PUBLIC-LOCATOR-LEAK'), false, 'stale public locator must not survive current caller Views');

  const a2aRef = 'projection:phase1:a2a-binding';
  const a2aEntry = exploreEntry('entry:phase1:a2a-binding', 'a2a-binding', 'world:phase1', 'A2A binding', {
    locators: [{ surface: 'a2a', locator: 'https://agent.example/A2A-OLD-ENDPOINT' }],
  });
  const a2aV1 = projectionContract({
    projectionRef: a2aRef,
    revision: 1,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'public' },
    representation: { kind: 'a2a-binding', ref: a2aEntry.ref },
  });
  await remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, a2aV1));
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, a2aEntry));
  await waitUntil(() => hasExplore(stranger, a2aEntry.ref), 'public A2A binding Explore entry');
  assert.equal(JSON.stringify(rows(stranger.conn.db.exploreEntry)).includes('A2A-OLD-ENDPOINT'), true);

  const a2aV2 = projectionContract({
    projectionRef: a2aRef,
    revision: 2,
    publisherParticipantRef: remotePublic.participant_ref,
    audience: { visibility: 'public' },
    representation: { kind: 'oi.withdrawal/v1', payload: { reason: 'endpoint withdrawn' } },
    state: 'withdrawn',
  });
  await remoteAgent.conn.reducers.putProjection(projectionArgs(publicField.field_ref, a2aV2));
  await waitUntil(() => projectionRow(stranger, a2aRef)?.projectionRevision === 2, 'A2A withdrawal current revision');
  await waitUntil(() => !hasExplore(stranger, a2aEntry.ref), 'withdrawn A2A binding removed from Explore');
  assert.equal(JSON.stringify({
    projections: rows(stranger.conn.db.projection),
    entries: rows(stranger.conn.db.exploreEntry),
  }).includes('A2A-OLD-ENDPOINT'), false, 'withdrawn binding must expose no stale public locator');

  const ownerWatchContract = createWatch({
    watch_ref: 'watch:phase1:owner:remote',
    watcher_participant_ref: ownerPublic.participant_ref,
    field_ref: publicField.field_ref,
    target: { kind: 'agent', ref: remoteAgentEntry.ref },
    created_at: '2026-08-17T08:30:00.000Z',
    provenance: { source_system: 'o-i', source_revision: 'watch:phase1@1' },
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
  await waitUntil(() => rows(owner.conn.db.myWatch).some(row => row.watchRef === ownerWatchContract.watch_ref), 'owner private Watch');
  assert.equal(rows(stranger.conn.db.myWatch).length, 0);

  const requestFromRemote = (ref: string, purpose = 'Bounded collaboration request.') => remoteAgent.conn.reducers.requestContact({
    contactRef: ref,
    fieldRef: publicField.field_ref,
    initiatorParticipantRef: remotePublic.participant_ref,
    recipientParticipantRef: ownerPublic.participant_ref,
    purpose,
    requestedScopeJson: JSON.stringify({ mode: 'conversation', topic_ref: remoteAgentEntry.ref }),
    ttlSeconds: 600,
    provenanceJson: JSON.stringify({ source_system: 'o-i', source_revision: `${ref}@1` }),
  });

  await requestFromRemote('contact:phase1:1');
  await waitUntil(() => rows(owner.conn.db.myContact).some(row => row.contactRef === 'contact:phase1:1'), 'recipient Contact');
  assert.equal(rows(stranger.conn.db.myContact).length, 0);
  await expectRejected(() => member.conn.reducers.respondContact({
    contactRef: 'contact:phase1:1',
    recipientParticipantRef: ownerPublic.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ note: 'spoof' }),
  }), 'recipient impersonation');
  await owner.conn.reducers.respondContact({
    contactRef: 'contact:phase1:1',
    recipientParticipantRef: ownerPublic.participant_ref,
    decision: 'accepted',
    responseJson: JSON.stringify({ scope: 'conversation-only' }),
  });

  await owner.conn.reducers.setContactPolicy({
    fieldRef: publicField.field_ref,
    blockerParticipantRef: ownerPublic.participant_ref,
    blockedParticipantRef: remotePublic.participant_ref,
    mode: 'blocked',
  });
  await expectRejected(() => requestFromRemote('contact:phase1:blocked'), 'blocked Contact');
  await owner.conn.reducers.setContactPolicy({
    fieldRef: publicField.field_ref,
    blockerParticipantRef: ownerPublic.participant_ref,
    blockedParticipantRef: remotePublic.participant_ref,
    mode: 'clear',
  });
  await expectRejected(() => requestFromRemote('contact:phase1:oversize', 'x'.repeat(501)), 'oversized Contact');
  for (let n = 2; n <= 3; n += 1) {
    const ref = `contact:phase1:${n}`;
    await requestFromRemote(ref);
    await owner.conn.reducers.respondContact({
      contactRef: ref,
      recipientParticipantRef: ownerPublic.participant_ref,
      decision: 'declined',
      responseJson: JSON.stringify({ reason: 'fixture' }),
    });
  }
  await expectRejected(() => requestFromRemote('contact:phase1:4'), 'high-rate Contact');

  await expectRejected(() => stranger.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, exploreEntry(
    'entry:phase1:poison', 'wiki-node', 'world:phase1', 'Poison'
  ))), 'Explore index pollution');

  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: privateField.field_ref,
    participantRef: revokedPrivate.participant_ref,
  });
  await waitUntil(() => !hasField(revokedActor, privateField.field_ref), 'revocation removes subscribed private field rows');
  revokedActor.conn.disconnect();
  reconnectedRevoked = await connect('REVOKED_ACTOR_RECONNECTED', revokedActor.token);
  assert.equal(reconnectedRevoked.identity.toHexString(), revokedActor.identity.toHexString(), 'saved token must reconnect same identity');
  await subscribe(reconnectedRevoked.conn, [...publicQueries, ...privateViews]);
  assert.equal(hasField(reconnectedRevoked, privateField.field_ref), false, 'reconnect after revocation must remain empty');
  assert.equal(hasParticipant(reconnectedRevoked, revokedPrivate.participant_ref), false);

  await sleep(1_150);
  assert.equal(hasField(finiteActor, privateField.field_ref), false, 'finite grant remains zero protected rows after expiry');

  console.log(JSON.stringify({
    proof: 'oi-encounter-security-spacetimedb/v4-phase1-private-content',
    spacetimedb: '2.8.1',
    identities: clients.map(client => ({ name: client.name, identity: client.identity.toHexString() })),
    visible: {
      stranger_restricted_fields: rows(stranger.conn.db.sharedField).filter(row => row.visibility === 'restricted').length,
      stranger_private_fields: rows(stranger.conn.db.sharedField).filter(row => row.visibility === 'private').length,
      member_restricted: hasField(member, restrictedField.field_ref),
      member_private_without_explicit_read: hasField(member, privateField.field_ref),
      explicit_private_recipient: hasField(recipient, privateField.field_ref),
      finite_private: hasField(finiteActor, privateField.field_ref),
    },
    attacks: {
      raw_backing_subscription_bypass: 'denied',
      unrelated_restricted_private_content: 'zero',
      private_participant_graph_leak: 'zero',
      ordinary_membership_private_widening: 'denied',
      explicit_private_recipient: 'allowed_only_when_named',
      finite_private_read: 'fail_closed',
      cross_field_read_grant: 'denied',
      cross_field_projection_audience: 'denied',
      private_explore_entry: 'hidden',
      relation_hidden_endpoint: 'hidden',
      public_to_private_revision_stale_publicity: 'removed',
      withdrawn_a2a_locator: 'removed',
      revocation_live_subscription: 'removed',
      revocation_reconnect: 'empty',
      cross_field_mutation: 'denied',
      participant_creation_without_owner: 'denied',
      explore_pollution: 'denied',
      recipient_impersonation: 'denied',
      blocked_contact: 'denied',
      oversized_contact: 'denied',
      high_rate_contact: 'denied',
    },
  }, null, 2));
} finally {
  for (const client of clients) {
    try { client.conn.disconnect(); } catch {}
  }
  try { reconnectedRevoked?.conn.disconnect(); } catch {}
}
