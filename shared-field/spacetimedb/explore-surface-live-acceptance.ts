import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createSharedField } from '../social.mjs';
import { createExploreEntry } from '../explore.mjs';
import { createWorldPresentation } from '../presentation.mjs';
import {
  createWorldPresentationProjection,
  refineWorldPresentationProjection,
} from '../presentation-projection.mjs';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
  projectionStorageKey,
} from '../spacetimedb.mjs';
import { createExploreSurfaceModelFromHostedSnapshot } from '../spacetimedb-explore-surface.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

async function subscribe(conn: DbConnection) {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe([
        'SELECT * FROM shared_field',
        'SELECT * FROM participant',
        'SELECT * FROM projection',
        'SELECT * FROM explore_entry',
        'SELECT * FROM explore_relation',
        'SELECT * FROM my_field_authority',
      ]);
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

const owner = await connect();
await subscribe(owner.conn);

const field = createSharedField({
  field_ref: 'field:acceptance:explore-surface-live',
  kind: 'explore',
  visibility: 'public',
  title: 'Explore Surface live acceptance',
  provenance: [{ kind: 'acceptance', ref: 'acceptance:explore-surface-live', source_system: 'o-i', revision: '1' }],
});
await owner.conn.reducers.putSharedField({
  fieldRef: field.field_ref,
  kind: field.kind,
  visibility: field.visibility,
  contractJson: JSON.stringify(field),
});

const worldRef = 'world:acceptance:explore-surface-live';
const participant = createParticipant({
  participant_ref: 'participant:acceptance:explore-surface-human',
  field_ref: field.field_ref,
  identity: { kind: 'human', ref: 'human:acceptance:explore-surface' },
  presentation: { world_ref: worldRef },
  provenance: { source_system: 'central', source_revision: 'acceptance@1' },
});
await owner.conn.reducers.putParticipant(participantArgs(participant));
await owner.conn.reducers.grantParticipantAuthority({
  fieldRef: field.field_ref,
  participantRef: participant.participant_ref,
  targetIdentity: owner.identity,
  role: 'contributor',
  contactable: true,
  ttlSeconds: 0,
});

const presentation = createWorldPresentation({
  presentation_ref: 'presentation:acceptance:explore-surface-live',
  world_ref: worldRef,
  revision: 1,
  title: 'Live world presentation',
  summary: 'Served from the running SharedField.',
  theme: { tokens: {} },
  regions: [],
  provenance: [{ kind: 'authored', ref: worldRef, source_system: 'central', revision: 'acceptance@1' }],
});
const projection = createWorldPresentationProjection({
  presentation,
  projection: {
    projection_ref: 'projection:acceptance:explore-surface-live',
    projection_revision: 1,
    state: 'published',
    subject: { kind: 'human-world', ref: worldRef },
    source: { system: 'central', revision: 'acceptance@1' },
    publisher_participant_ref: participant.participant_ref,
    published_at: '2026-08-18T15:00:00.000Z',
    audience: { visibility: 'public' },
    provenance: [{ kind: 'human-publication', ref: participant.participant_ref, source_system: 'central', revision: 'acceptance@1' }],
  },
});
await owner.conn.reducers.putProjection(projectionArgs(field.field_ref, projection));

const entry = createExploreEntry({
  ref: worldRef,
  kind: 'human-world',
  world_ref: worldRef,
  label: 'Live acceptance world',
  summary: 'Addressable through a running SpaceTimeDB subscription.',
  aliases: ['live acceptance world'],
  revision: 'acceptance@1',
  provenance: [{ kind: 'human-world', ref: worldRef, source_system: 'central', revision: 'acceptance@1' }],
  locators: [],
});
await owner.conn.reducers.putExploreEntry({
  semanticRef: entry.ref,
  fieldRef: field.field_ref,
  worldRef: entry.world_ref,
  kind: entry.kind,
  label: entry.label,
  revision: entry.revision ?? '',
  entryJson: JSON.stringify(entry),
});

const live = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db));
await waitUntil(() => live.read(worldRef)?.ref === worldRef, 'live Explore world');
let surface = createExploreSurfaceModelFromHostedSnapshot(live.snapshot());
let opened = surface.open(worldRef, { depth: 1, budget: 8 });
assert.equal(opened?.world_presentation?.title, 'Live world presentation');
assert.equal(opened?.world_presentation_projection?.projection_revision, 1);

const refinedPresentation = createWorldPresentation({
  ...presentation,
  title: 'Live world presentation — refined',
});
const refinedProjection = refineWorldPresentationProjection(projection, refinedPresentation, {
  publisher_participant_ref: participant.participant_ref,
  published_at: '2026-08-18T15:01:00.000Z',
  provenance: [{ kind: 'human-refinement', ref: participant.participant_ref, source_system: 'o-i', revision: 'acceptance-refine@1' }],
  transport: { provider: 'spacetimedb', database: DATABASE, field_ref: field.field_ref },
});
await owner.conn.reducers.putProjection(projectionArgs(field.field_ref, refinedProjection));
await waitUntil(
  () => live.snapshot().projections.find((value: any) => value.projection_ref === projection.projection_ref && value.projection_revision === 2),
  'subscribed Projection revision 2',
);

surface = createExploreSurfaceModelFromHostedSnapshot(live.snapshot());
opened = surface.open(worldRef, { depth: 1, budget: 8 });
assert.equal(opened?.world_presentation?.title, 'Live world presentation — refined');
assert.equal(opened?.world_presentation?.revision, 2);
assert.equal(opened?.world_presentation_projection?.projection_revision, 2);
assert.equal(opened?.world_presentation_projection?.source?.revision, 'acceptance@1');

live.dispose();
owner.conn.disconnect();
console.log('SpaceTimeDB → live Explore → WorldPresentation → Projection refinement acceptance passed.');
