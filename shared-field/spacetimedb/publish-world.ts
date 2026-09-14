/**
 * Hosted publication: push one publication bundle (oi.world-publication/v1)
 * into a SharedField on a running SpaceTimeDB database through the generated
 * client, then wait until the caller-visible subscription echoes the new
 * Projection revision back.
 *
 *   SPACETIMEDB_URI=wss://... SPACETIMEDB_DATABASE=... \
 *   npx tsx shared-field/spacetimedb/publish-world.ts --bundle out/bundle.json [--token-file ~/.local/state/oi/spacetimedb/<db>.owner-token]
 *
 * The owner token is the SpaceTimeDB transport credential of the publishing
 * connection. It is persisted outside the repository so the same transport
 * identity owns the SharedField across runs. It is not a Human, Agent or
 * Participant identity, and it never enters the bundle or any Projection.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DbConnection } from './module_bindings/index';
import { hostedPublicationArgs } from '../central-wiki-projection.mjs';
import { createExploreTransportLifecycle } from '../transport-lifecycle.mjs';
import { createLiveExploreApplication, createSpacetimeExploreSource } from '../spacetimedb.mjs';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}
const bundlePath = flag('--bundle');
if (!bundlePath) throw new Error('--bundle <bundle.json> is required');
const tokenFile = flag('--token-file') ?? join(process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi'), 'spacetimedb', `${DATABASE}.owner-token`);
const receiptPath = flag('--receipt');

const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
const args = hostedPublicationArgs(bundle);

async function connect(token?: string) {
  const lifecycle = createExploreTransportLifecycle();
  return new Promise<{ conn: DbConnection; identity: any; token: string; lifecycle: any }>((resolve, reject) => {
    let builder = DbConnection.builder().withUri(URI).withDatabaseName(DATABASE);
    if (token) builder = builder.withToken(token);
    builder
      .onConnect((conn, identity, issued) => { lifecycle.connected(identity.toHexString()); resolve({ conn, identity, token: issued, lifecycle }); })
      .onConnectError((_ctx, error) => { lifecycle.connectError(error); reject(error); })
      .onDisconnect((_ctx, error) => lifecycle.disconnected(error))
      .build();
  });
}

async function subscribe(conn: DbConnection, lifecycle: any) {
  lifecycle.subscribing();
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => { lifecycle.applied(); resolve(); })
      .onError((_ctx, error) => { lifecycle.subscriptionError(error); reject(error); })
      .subscribe(['SELECT * FROM shared_field', 'SELECT * FROM participant', 'SELECT * FROM projection', 'SELECT * FROM explore_entry', 'SELECT * FROM explore_relation', 'SELECT * FROM my_field_authority']);
  });
}

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const savedToken = existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : undefined;
const owner = await connect(savedToken);
if (!savedToken || savedToken !== owner.token) {
  mkdirSync(dirname(tokenFile), { recursive: true, mode: 0o700 });
  writeFileSync(tokenFile, owner.token, { mode: 0o600 });
}
await subscribe(owner.conn, owner.lifecycle);

const live = createLiveExploreApplication(createSpacetimeExploreSource(owner.conn.db, owner.lifecycle));
const reducers: any = owner.conn.reducers;

await reducers.putSharedField(args.putSharedField);
await reducers.putParticipant(args.putParticipant);
const rows = (handle: any) => [...handle.iter()];
const existingGrant = rows(owner.conn.db.myFieldAuthority).find((row: any) => row.fieldRef === args.putSharedField.fieldRef && row.participantRef === args.putParticipant.participantRef && row.role === 'contributor' && !row.revoked);
if (!existingGrant) {
  await reducers.grantParticipantAuthority({ fieldRef: args.putSharedField.fieldRef, participantRef: args.putParticipant.participantRef, targetIdentity: owner.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
}
const alreadyPublished = rows(owner.conn.db.projection).find((row: any) => row.projectionKey === args.putProjection.projectionKey);
if (!alreadyPublished) await reducers.putProjection(args.putProjection);
for (const entry of args.putExploreEntries) await reducers.putExploreEntry(entry);
for (const relation of args.putExploreRelations) await reducers.putExploreRelation(relation);

const projectionRow = await waitUntil(() => rows(owner.conn.db.projection).find((row: any) => row.projectionKey === args.putProjection.projectionKey), `Projection ${args.putProjection.projectionKey} in caller-visible view`);
await waitUntil(() => live.snapshot().entries.length >= args.putExploreEntries.length && live.snapshot().relations.length >= args.putExploreRelations.length, 'live Explore application to observe published entries and relations');
const opened = live.open(bundle.world_ref, { depth: 1, budget: 24 });
assert.ok(opened, 'published world opens through the live Explore application');
const surfaceProjection = live.snapshot().projections.find((projection: any) => projection.projection_ref === args.putProjection.projectionRef);
assert.equal(surfaceProjection.projection_revision, args.putProjection.projectionRevision);
assert.equal(surfaceProjection.source.revision, args.putProjection.sourceRevision);

const receipt = {
  schema: 'oi.hosted-publication-receipt/v1',
  uri: URI,
  database: DATABASE,
  owner_transport_identity: owner.identity.toHexString(),
  field_ref: args.putSharedField.fieldRef,
  world_ref: bundle.world_ref,
  projection_ref: args.putProjection.projectionRef,
  projection_revision: args.putProjection.projectionRevision,
  source: bundle.source,
  hosted_projection_row: { projectionKey: projectionRow.projectionKey, rowId: String(projectionRow.rowId) },
  entries: args.putExploreEntries.map((entry) => entry.semanticRef),
  relations: args.putExploreRelations.map((relation) => relation.relationRef),
  explore_status: live.status(),
  published_at: new Date().toISOString(),
  note: 'owner_transport_identity is a SpaceTimeDB transport identity; it is not a Human, Agent or Participant identity.',
};
if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
live.dispose();
owner.conn.disconnect();
