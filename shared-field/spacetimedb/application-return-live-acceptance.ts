import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import {
  createWorldPresentationProjection,
  refineWorldPresentationProjection,
} from '../presentation-projection.mjs';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
} from '../spacetimedb.mjs';
import { createExploreSurfaceModel } from '../explore-surface.mjs';
import {
  browserSeedFromHostedSnapshot,
  createLiveExploreBrowserProvider,
} from '../../site/explore-provider.mjs';
import { genericObservedActivity } from '../activity.mjs';

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
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe(queries);
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

async function expectRejected(run: () => Promise<unknown>, description: string): Promise<void> {
  let rejected = false;
  try {
    await run();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `${description} should reject`);
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

function projectionArgs(value: any, fieldRef: string) {
  return {
    projectionKey: `${value.projection_ref}@${value.projection_revision}`,
    fieldRef,
    projectionRef: value.projection_ref,
    projectionRevision: value.projection_revision,
    sourceRevision: value.source.revision,
    publisherParticipantRef: value.publisher_participant_ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

const FIELD = 'oi:field:w11-application-return';
const WORLD = 'world:w11:application-return';
const PARTICIPANT = 'participant:w11:publisher';
const PROJECTION = 'projection:w11:application-return';
const SOURCE_REVISION = 'central@w11-7';

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: FIELD,
  kind: 'public',
  visibility: 'public',
  title: 'W11 application return',
  provenance: [{
    kind: 'w11-application-fixture',
    ref: FIELD,
    source_system: 'o-i',
    revision: `${FIELD}@1`,
  }],
};

const entry = {
  schema: 'oi.explore-entry/v1',
  ref: WORLD,
  world_ref: WORLD,
  kind: 'world',
  label: 'W11 application World',
  summary: 'One semantic World read across hosted, desktop and structured Agent Surfaces.',
  revision: SOURCE_REVISION,
  visibility: 'public',
  sources: [{ system: 'central', ref: WORLD, revision: SOURCE_REVISION }],
};

const publisherParticipant = createParticipant({
  participant_ref: PARTICIPANT,
  field_ref: FIELD,
  identity: { kind: 'human', ref: 'human:w11:publisher' },
  presentation: { world_ref: WORLD },
  provenance: { source_system: 'o-i', source_revision: 'w11-participant@1' },
});

function presentation(revision: number, title: string) {
  return {
    schema: 'oi.world-presentation/v1',
    presentation_ref: 'presentation:w11:application-return',
    world_ref: WORLD,
    revision,
    title,
    theme: { tokens: {} },
    regions: [],
    provenance: [{
      kind: 'world-presentation',
      ref: 'presentation:w11:application-return',
      source_system: 'central',
      revision: `presentation@${revision}`,
    }],
  };
}

const projection1 = createWorldPresentationProjection({
  presentation: presentation(1, 'W11 World — revision 1'),
  projection: {
    schema: 'oi.projection/v1',
    projection_ref: PROJECTION,
    projection_revision: 1,
    state: 'published',
    subject: { ref: WORLD, kind: 'central.project-world' },
    source: { system: 'central', ref: WORLD, revision: SOURCE_REVISION },
    publisher_participant_ref: PARTICIPANT,
    published_at: '2026-09-02T15:00:00Z',
    audience: { visibility: 'public' },
    provenance: [{
      kind: 'central-project-world',
      ref: WORLD,
      source_system: 'central',
      revision: SOURCE_REVISION,
    }],
  },
});

const projection2 = refineWorldPresentationProjection(
  projection1,
  presentation(2, 'W11 World — revision 2'),
  {
    publisher_participant_ref: PARTICIPANT,
    published_at: '2026-09-02T15:01:00Z',
    provenance: [{
      kind: 'human-refinement',
      ref: 'refinement:w11:application-return@2',
      source_system: 'shared-field',
      revision: `${PROJECTION}@2`,
    }],
  },
);

const [owner, publisher, browserReader] = await Promise.all([
  connect('OWNER'),
  connect('PUBLISHER'),
  connect('BROWSER_READER'),
]);

let live: ReturnType<typeof createLiveExploreApplication> | undefined;

try {
  assert.equal(new Set([owner, publisher, browserReader].map(client => client.identity.toHexString())).size, 3);

  for (const client of [owner, publisher, browserReader]) {
    await subscribe(client.conn, [
      'SELECT * FROM shared_field',
      'SELECT * FROM participant',
      'SELECT * FROM projection',
      'SELECT * FROM explore_entry',
      'SELECT * FROM explore_relation',
    ]);
  }

  await owner.conn.reducers.putSharedField({
    fieldRef: FIELD,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await owner.conn.reducers.putParticipant(participantArgs(publisherParticipant));
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: FIELD,
    participantRef: PARTICIPANT,
    targetIdentity: publisher.identity,
    role: 'contributor',
    contactable: true,
    ttlSeconds: 0,
  });
  await owner.conn.reducers.putExploreEntry({
    semanticRef: entry.ref,
    fieldRef: FIELD,
    worldRef: entry.world_ref,
    kind: entry.kind,
    label: entry.label,
    revision: entry.revision,
    entryJson: JSON.stringify(entry),
  });

  await publisher.conn.reducers.putProjection(projectionArgs(projection1, FIELD));

  await waitUntil(
    () => [...browserReader.conn.db.exploreEntry.iter()].find((row: any) => row.semanticRef === WORLD),
    'public W11 Explore entry',
  );
  await waitUntil(
    () => [...browserReader.conn.db.projection.iter()].find((row: any) => row.projectionKey === `${PROJECTION}@1`),
    'public W11 Projection revision 1',
  );

  const source = createSpacetimeExploreSource(browserReader.conn.db);
  live = createLiveExploreApplication(source);
  const browserProvider = createLiveExploreBrowserProvider(live);

  const initialBrowser = browserProvider.current();
  assert.equal(initialBrowser.open(WORLD)?.resource.ref, WORLD);
  assert.equal(initialBrowser.presentation(WORLD)?.title, 'W11 World — revision 1');
  assert.equal(initialBrowser.presentationProjection(WORLD)?.projection_revision, 1);
  assert.equal(initialBrowser.presentationProjection(WORLD)?.source.revision, SOURCE_REVISION);

  // Reachability/read access is not contributor authority. The public reader can
  // see the World but cannot refine/publish it.
  await expectRejected(
    () => browserReader.conn.reducers.putProjection(projectionArgs(projection2, FIELD)),
    'unprivileged browser Projection refinement',
  );

  await publisher.conn.reducers.putProjection(projectionArgs(projection2, FIELD));

  await waitUntil(
    () => browserProvider.current().presentationProjection(WORLD)?.projection_revision === 2,
    'Projection revision 2 returning through the live Explore application',
  );

  const hostedSnapshot = live.snapshot();
  const browserSeed = browserSeedFromHostedSnapshot(hostedSnapshot);
  assert.equal(Object.prototype.hasOwnProperty.call(browserSeed, 'implementation'), false);

  // Browser, desktop and structured Agent consume the same renderer-neutral
  // application seed. No renderer mints another World/Projection identity.
  const browserModel = browserProvider.current();
  const desktopModel = createExploreSurfaceModel(browserSeed);
  const agentModel = createExploreSurfaceModel(browserSeed);

  for (const [surface, model] of [
    ['browser', browserModel],
    ['desktop', desktopModel],
    ['structured-agent', agentModel],
  ] as const) {
    assert.equal(model.open(WORLD)?.resource.ref, WORLD, `${surface} semantic World ref`);
    assert.equal(model.presentation(WORLD)?.world_ref, WORLD, `${surface} presentation subject`);
    assert.equal(model.presentation(WORLD)?.title, 'W11 World — revision 2', `${surface} returned presentation`);
    assert.equal(model.presentationProjection(WORLD)?.projection_ref, PROJECTION, `${surface} Projection ref`);
    assert.equal(model.presentationProjection(WORLD)?.projection_revision, 2, `${surface} Projection revision`);
    assert.equal(model.presentationProjection(WORLD)?.source.revision, SOURCE_REVISION, `${surface} source revision`);
  }

  // The reducer invocation is meaningful native activity, but is not promoted to
  // a canonical O:I Action merely because it completed. Canonical Action identity
  // remains an owner/Application concern.
  const returnedActivity = genericObservedActivity({
    activity_ref: `activity:w11:${PROJECTION}@2`,
    native_owner: 'shared-field',
    subject: { ref: WORLD, kind: 'central.project-world' },
    verb: 'Published',
    semantic_summary: 'Observed authorised SharedField Projection revision 2 returning to the application field.',
    phase: 'completed',
    result_refs: [`${PROJECTION}@2`],
    return_ref: `${PROJECTION}@2`,
    started_at: '2026-09-02T15:01:00Z',
    updated_at: '2026-09-02T15:01:00Z',
    provenance: [{
      kind: 'spacetimedb-projection-return',
      ref: `${PROJECTION}@2`,
      source_system: 'shared-field',
      revision: `${PROJECTION}@2`,
    }],
  });
  assert.equal(returnedActivity.subject.ref, WORLD);
  assert.deepEqual(returnedActivity.result_refs, [`${PROJECTION}@2`]);
  assert.equal('action_ref' in returnedActivity, false);

  console.log(JSON.stringify({
    acceptance: 'oi155-w11-application-return',
    field_ref: FIELD,
    world_ref: WORLD,
    projection_ref: PROJECTION,
    projection_revision: 2,
    source_revision: SOURCE_REVISION,
    public_reader_mutation_rejected: true,
    surfaces: ['browser', 'desktop', 'structured-agent'],
    activity_is_not_action: true,
  }));
} finally {
  live?.dispose();
  for (const client of [owner, publisher, browserReader]) {
    try { (client.conn as any).disconnect?.(); } catch { /* best-effort test cleanup */ }
  }
}
