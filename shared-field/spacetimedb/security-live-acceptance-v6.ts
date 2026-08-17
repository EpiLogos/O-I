import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant, createProjection } from '../index.mjs';
import { createReferentExploreApplication } from '../referent.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Client = { name: string; conn: DbConnection; identity: any; token: string };

async function connect(name: string): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
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
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx, error) => reject(error)).subscribe(queries);
  });
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

function rows(handle: any): any[] { return [...handle.iter()]; }
function visibleProjectionRefs(client: Client, fieldRef: string): string[] {
  return rows(client.conn.db.projection)
    .filter(row => row.fieldRef === fieldRef)
    .map(row => row.projectionRef)
    .sort();
}
function visibleExploreRefs(client: Client, fieldRef: string): string[] {
  return rows(client.conn.db.exploreEntry)
    .filter(row => row.fieldRef === fieldRef)
    .map(row => row.semanticRef)
    .sort();
}
function snapshot(client: Client, fieldRef: string) {
  return {
    entries: rows(client.conn.db.exploreEntry).filter(row => row.fieldRef === fieldRef).map(row => JSON.parse(row.entryJson)),
    relations: rows(client.conn.db.exploreRelation).filter(row => row.fieldRef === fieldRef).map(row => JSON.parse(row.relationJson)),
    projections: rows(client.conn.db.projection).filter(row => row.fieldRef === fieldRef).map(row => JSON.parse(row.contractJson)),
    contributions: rows(client.conn.db.contribution).filter(row => row.fieldRef === fieldRef).map(row => JSON.parse(row.contractJson)),
  };
}

function fieldContract(fieldRef: string) {
  return {
    schema: 'oi.shared-field/v1', field_ref: fieldRef, kind: 'general', visibility: 'public', title: 'Referent Privacy Oracle',
    provenance: [{ kind: 'security-fixture', ref: fieldRef, source_system: 'o-i', revision: `${fieldRef}@1` }],
  };
}

function participant(fieldRef: string, suffix: string) {
  return createParticipant({
    participant_ref: `participant:referent:${suffix}`,
    field_ref: fieldRef,
    identity: { kind: 'agent', ref: `agent:referent:${suffix}` },
    presentation: { world_ref: `world:referent:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `referent:${suffix}@1` },
  });
}

function participantArgs(value: any) {
  return {
    participantRef: value.participant_ref, fieldRef: value.field_ref, identityKind: value.identity.kind, identityRef: value.identity.ref,
    sourceSystem: value.provenance.source_system, sourceRevision: value.provenance.source_revision, contractJson: JSON.stringify(value),
  };
}

function projected(ref: string, fieldRef: string, publisherRef: string, bytes: Buffer, audience: any, worldRef: string) {
  const value = createProjection({
    projection_ref: ref,
    projection_revision: 1,
    state: 'published',
    subject: { ref: `artifact:${ref}`, kind: 'artifact' },
    source: { system: `source:${publisherRef}`, revision: `${ref}@1` },
    publisher_participant_ref: publisherRef,
    published_at: '2026-08-17T12:30:00.000Z',
    audience,
    representation: { kind: 'application/pdf', payload: { bytes_base64: bytes.toString('base64') } },
    provenance: [{ kind: 'security-fixture', ref, source_system: 'o-i', revision: `${ref}@1` }],
  });
  const explore = {
    schema: 'oi.explore-entry/v1', ref, kind: 'projection', world_ref: worldRef, label: ref,
    aliases: [], locators: [], projection_ref: ref,
    provenance: [{ kind: 'security-fixture', ref, source_system: 'o-i', revision: `${ref}@1` }],
  };
  return { value, explore, fieldRef };
}

function projectionArgs(item: any) {
  const value = item.value;
  return {
    projectionKey: `${value.projection_ref}@${value.projection_revision}`,
    fieldRef: item.fieldRef,
    projectionRef: value.projection_ref,
    projectionRevision: value.projection_revision,
    sourceRevision: value.source.revision,
    publisherParticipantRef: value.publisher_participant_ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

function exploreArgs(item: any) {
  const value = item.explore;
  return {
    semanticRef: value.ref, fieldRef: item.fieldRef, worldRef: value.world_ref, kind: value.kind,
    label: value.label, revision: value.revision ?? '', entryJson: JSON.stringify(value),
  };
}

const fieldRef = 'oi:field:referent-oracle-v1';
const clients = await Promise.all([connect('OWNER'), connect('B'), connect('C'), connect('STRANGER')]);
const [owner, b, c, stranger] = clients;
const queries = [
  'SELECT * FROM shared_field', 'SELECT * FROM participant', 'SELECT * FROM projection', 'SELECT * FROM contribution',
  'SELECT * FROM explore_entry', 'SELECT * FROM explore_relation', 'SELECT * FROM my_field_authority',
];

try {
  for (const client of clients) await subscribe(client.conn, queries);
  const field = fieldContract(fieldRef);
  await owner.conn.reducers.putSharedField({ fieldRef, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) });

  const ownerParticipant = participant(fieldRef, 'owner');
  const bParticipant = participant(fieldRef, 'b');
  const cParticipant = participant(fieldRef, 'c');
  for (const value of [ownerParticipant, bParticipant, cParticipant]) await owner.conn.reducers.putParticipant(participantArgs(value));
  for (const grant of [
    { participantRef: ownerParticipant.participant_ref, targetIdentity: owner.identity },
    { participantRef: bParticipant.participant_ref, targetIdentity: b.identity },
    { participantRef: cParticipant.participant_ref, targetIdentity: c.identity },
  ]) await owner.conn.reducers.grantParticipantAuthority({ fieldRef, ...grant, role: 'contributor', contactable: false, ttlSeconds: 0 });

  const commonBytes = Buffer.from('PUBLIC A + PRIVATE B/C exact representation');
  const hiddenBytes = Buffer.from('PRIVATE B + PRIVATE C disjoint exact representation');
  const publicA = projected('projection:referent:public-a', fieldRef, ownerParticipant.participant_ref, commonBytes, { visibility: 'public', refs: [] }, 'world:public');
  const privateB = projected('projection:referent:private-b', fieldRef, bParticipant.participant_ref, commonBytes, { visibility: 'private', refs: [bParticipant.participant_ref] }, 'world:b');
  const privateC = projected('projection:referent:private-c', fieldRef, cParticipant.participant_ref, commonBytes, { visibility: 'private', refs: [cParticipant.participant_ref] }, 'world:c');
  const disjointB = projected('projection:referent:disjoint-b', fieldRef, bParticipant.participant_ref, hiddenBytes, { visibility: 'private', refs: [bParticipant.participant_ref] }, 'world:b');
  const disjointC = projected('projection:referent:disjoint-c', fieldRef, cParticipant.participant_ref, hiddenBytes, { visibility: 'private', refs: [cParticipant.participant_ref] }, 'world:c');

  await owner.conn.reducers.putProjection(projectionArgs(publicA));
  await b.conn.reducers.putProjection(projectionArgs(privateB));
  await c.conn.reducers.putProjection(projectionArgs(privateC));
  await b.conn.reducers.putProjection(projectionArgs(disjointB));
  await c.conn.reducers.putProjection(projectionArgs(disjointC));
  for (const item of [publicA, privateB, privateC, disjointB, disjointC]) await owner.conn.reducers.putExploreEntry(exploreArgs(item));

  await waitUntil(() => visibleExploreRefs(stranger, fieldRef).includes(publicA.value.projection_ref), 'public projection Explore row');
  await waitUntil(() => visibleExploreRefs(b, fieldRef).includes(disjointB.value.projection_ref), 'B private projection Explore row');
  await waitUntil(() => visibleExploreRefs(c, fieldRef).includes(disjointC.value.projection_ref), 'C private projection Explore row');

  assert.deepEqual(visibleProjectionRefs(stranger, fieldRef), [publicA.value.projection_ref]);
  assert.equal(visibleProjectionRefs(b, fieldRef).includes(privateB.value.projection_ref), true);
  assert.equal(visibleProjectionRefs(b, fieldRef).includes(privateC.value.projection_ref), false);
  assert.equal(visibleProjectionRefs(c, fieldRef).includes(privateC.value.projection_ref), true);
  assert.equal(visibleProjectionRefs(c, fieldRef).includes(privateB.value.projection_ref), false);

  const strangerApp = createReferentExploreApplication(snapshot(stranger, fieldRef));
  const bApp = createReferentExploreApplication(snapshot(b, fieldRef));
  const cApp = createReferentExploreApplication(snapshot(c, fieldRef));
  const publicRef = strangerApp.referentFor(publicA.value.projection_ref);
  assert.equal(publicRef, bApp.referentFor(publicA.value.projection_ref));
  assert.equal(publicRef, cApp.referentFor(publicA.value.projection_ref));
  assert.equal(strangerApp.open(publicRef).counts.visible_projected_holdings, 1);
  assert.equal(bApp.open(publicRef).counts.visible_projected_holdings, 2);
  assert.equal(cApp.open(publicRef).counts.visible_projected_holdings, 2);
  assert.equal(JSON.stringify(strangerApp.open(publicRef)).includes(privateB.value.projection_ref), false);
  assert.equal(JSON.stringify(strangerApp.open(publicRef)).includes(privateC.value.projection_ref), false);
  assert.equal(strangerApp.open(publicRef).privacy.hidden_member_count, 'not-computed');

  const bHiddenRef = bApp.referentFor(disjointB.value.projection_ref);
  const cHiddenRef = cApp.referentFor(disjointC.value.projection_ref);
  assert.equal(bHiddenRef, cHiddenRef);
  assert.equal(bApp.open(bHiddenRef).counts.visible_projected_holdings, 1);
  assert.equal(cApp.open(cHiddenRef).counts.visible_projected_holdings, 1);
  assert.equal(strangerApp.open(bHiddenRef), undefined);
  assert.equal(JSON.stringify(strangerApp.search('disjoint')).includes('referent'), false);

  const rebuiltB = createReferentExploreApplication(snapshot(b, fieldRef));
  assert.equal(rebuiltB.referentFor(disjointB.value.projection_ref), bHiddenRef);
  assert.deepEqual(rebuiltB.bindings(), bApp.bindings());

  console.log('SpaceTimeDB common-referent privacy-oracle acceptance passed');
} finally {
  for (const client of clients) client.conn.disconnect();
}
