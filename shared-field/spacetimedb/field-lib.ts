/**
 * The O:I-owned SharedField client library: one hosting target from
 * `hosting.json`, one owner transport token persisted outside the
 * repository, one caller-visible subscription. Everything the desktop kernel
 * or an acceptance script needs to stand in a hosted field goes through here;
 * nothing here owns identity or source.
 *
 * The transport token is a SpaceTimeDB credential of the publishing
 * connection. It never enters a Projection, a bundle, a reading or a receipt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbConnection } from './module_bindings/index';
import { createExploreTransportLifecycle } from '../transport-lifecycle.mjs';
import { createLiveExploreApplication, createSpacetimeExploreSource, rowsFromSpacetimeDb, hostedSnapshotFromRows } from '../spacetimedb.mjs';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

export const here = dirname(fileURLToPath(import.meta.url));
export const SUBSCRIPTION = [
  'SELECT * FROM shared_field',
  'SELECT * FROM participant',
  'SELECT * FROM projection',
  'SELECT * FROM contribution',
  'SELECT * FROM explore_entry',
  'SELECT * FROM explore_relation',
  'SELECT * FROM my_field_authority',
  'SELECT * FROM my_contribution_receipt',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
];
const TIMEOUT_MS = Number(process.env.OI_SHARED_FIELD_TIMEOUT_MS ?? 15_000);
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Target { name: string; server: string; uri: string; database: string; note?: string }

/** Resolve the hosting target: `OI_SHARED_FIELD_TARGET` names a `hosting.json`
 * target; `SPACETIMEDB_URI`/`SPACETIMEDB_DATABASE` override it. An unbound
 * target is an honest state the caller reports as Unavailable, never an error
 * the caller invents a default for. */
export function resolveTarget(): { bound: true; target: Target } | { bound: false; reason: string } {
  const uri = process.env.SPACETIMEDB_URI;
  const database = process.env.SPACETIMEDB_DATABASE;
  if (uri && database) return { bound: true, target: { name: 'env', server: 'env', uri, database } };
  const name = process.env.OI_SHARED_FIELD_TARGET;
  if (!name) return { bound: false, reason: 'no SharedField target bound: set OI_SHARED_FIELD_TARGET to a target named in shared-field/spacetimedb/hosting.json' };
  const hosting = JSON.parse(readFileSync(join(here, 'hosting.json'), 'utf8'));
  const target = hosting.targets?.[name];
  if (!target) return { bound: false, reason: `SharedField target "${name}" is not named in hosting.json (${Object.keys(hosting.targets ?? {}).join(', ')})` };
  return { bound: true, target: { name, ...target } };
}

export function tokenFile(database: string, label = 'owner') {
  const state = process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi');
  return join(state, 'spacetimedb', label === 'owner' ? `${database}.owner-token` : `${database}.${label}-token`);
}

export interface Client { conn: DbConnection; identity: any; token: string; lifecycle: any; live: any; target: Target; identityHex: string }

export async function connect(target: Target, token?: string): Promise<{ conn: DbConnection; identity: any; token: string; lifecycle: any }> {
  const lifecycle = createExploreTransportLifecycle();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SharedField at ${target.uri}/${target.database} did not answer within ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
    let builder = DbConnection.builder().withUri(target.uri).withDatabaseName(target.database);
    if (token) builder = builder.withToken(token);
    builder
      .onConnect((conn, identity, issued) => { clearTimeout(timer); lifecycle.connected(identity.toHexString()); resolve({ conn, identity, token: issued, lifecycle }); })
      .onConnectError((_ctx, error) => { clearTimeout(timer); lifecycle.connectError(error); reject(error); })
      .onDisconnect((_ctx, error) => lifecycle.disconnected(error))
      .build();
  });
}

export async function subscribe(conn: DbConnection, lifecycle: any) {
  lifecycle.subscribing();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`subscription did not apply within ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
    conn.subscriptionBuilder()
      .onApplied(() => { clearTimeout(timer); lifecycle.applied(); resolve(); })
      .onError((_ctx, error) => { clearTimeout(timer); lifecycle.subscriptionError(error); reject(error); })
      .subscribe(SUBSCRIPTION);
  });
}

/** Open a client on the target with the persisted token for `label`
 * (created on first use, mode 0600, outside the repository). */
export async function open(target: Target, label = 'owner'): Promise<Client> {
  const file = tokenFile(target.database, label);
  const saved = existsSync(file) ? readFileSync(file, 'utf8').trim() : undefined;
  const opened = await connect(target, saved);
  if (!saved || saved !== opened.token) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, opened.token, { mode: 0o600 });
  }
  await subscribe(opened.conn, opened.lifecycle);
  const live = createLiveExploreApplication(createSpacetimeExploreSource(opened.conn.db, opened.lifecycle));
  return { ...opened, live, target, identityHex: opened.identity.toHexString() };
}

export function close(client: Client) {
  try { client.live.dispose(); } catch {}
  try { client.conn.disconnect(); } catch {}
}

export const rows = (handle: any): any[] => (handle && typeof handle.iter === 'function' ? [...handle.iter()] : []);

export async function waitUntil<T>(read: () => T | undefined | false | null, description: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = read();
    if (value) return value as T;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const parse = (json: string) => { try { return JSON.parse(json); } catch { return null; } };

/** The caller-visible field, exactly as the subscription holds it: the
 * validated hosted snapshot plus the caller's own private views. Transport
 * identity is reported as what it is; no token is ever included. */
export function fieldSnapshot(client: Client) {
  const db: any = client.conn.db;
  const hosted = hostedSnapshotFromRows(rowsFromSpacetimeDb(db));
  return {
    schema: 'oi.shared-field.snapshot/v1',
    target: { name: client.target.name, uri: client.target.uri, database: client.target.database },
    transport_identity: client.identityHex,
    status: client.live.status(),
    fields: hosted.fields,
    participants: hosted.participants,
    projections: hosted.projections,
    entries: hosted.entries,
    relations: hosted.relations,
    relation_errors: hosted.relation_errors,
    contributions: rows(db.contribution).map((row: any) => ({ contribution_ref: row.contributionRef, field_ref: row.fieldRef, contributor_participant_ref: row.contributorParticipantRef, ingress_ref: row.ingressRef ?? null, contract: parse(row.contractJson) })),
    my_authority: rows(db.myFieldAuthority).map((row: any) => ({ field_ref: row.fieldRef, participant_ref: row.participantRef, role: row.role, revoked: Boolean(row.revoked) })),
    my_contribution_receipts: rows(db.myContributionReceipt).map((row: any) => ({ contribution_ref: row.contributionRef, ingress_ref: row.ingressRef, field_ref: row.fieldRef, state: row.state })),
    my_watches: rows(db.myWatch).map((row: any) => ({ watch_ref: row.watchRef, field_ref: row.fieldRef, target_kind: row.targetKind, target_ref: row.targetRef, state: row.state })),
    my_contacts: rows(db.myContact).map((row: any) => ({ contact_ref: row.contactRef, field_ref: row.fieldRef, initiator_participant_ref: row.initiatorParticipantRef, recipient_participant_ref: row.recipientParticipantRef, state: row.state ?? row.decision ?? null })),
    counts: { fields: hosted.fields.length, participants: hosted.participants.length, projections: hosted.projections.length, entries: hosted.entries.length, relations: hosted.relations.length },
    // The SharedField each Explore entry is hosted in (the row's fieldRef;
    // the entry contract itself carries no field) — what a Watch or a
    // membership reading is scoped to. Keyed by the entry's semantic ref.
    entry_fields: Object.fromEntries(rows(db.exploreEntry).map((row: any) => [row.semanticRef, row.fieldRef])),
  };
}

/** One hosted ref read as a Projection reading: the Explore entry, the
 * Projections whose subject is that ref or its world, the relations that
 * touch it, and the bounded neighbourhood the live application opens. */
export function readRef(client: Client, ref: string) {
  const snapshot = fieldSnapshot(client);
  const entry = snapshot.entries.find((candidate: any) => candidate.ref === ref || (candidate.aliases ?? []).includes(ref));
  if (!entry) return { schema: 'oi.shared-field.reading/v1', ref, state: 'absent', target: snapshot.target };
  const projections = snapshot.projections.filter((projection: any) => projection.subject?.ref === entry.ref || projection.subject?.ref === entry.world_ref || projection.projection_ref === ref);
  const relations = snapshot.relations.filter((relation: any) => relation.from === entry.ref || relation.to === entry.ref);
  let neighbourhood: any = null;
  try { neighbourhood = client.live.open(entry.ref, { depth: 1, budget: 24 }); } catch (error: any) { neighbourhood = { error: error?.message ?? String(error) }; }
  const contributions = snapshot.contributions.filter((row: any) => projections.some((projection: any) => row.contract?.target?.ref === projection.projection_ref) || row.contract?.target?.ref === entry.ref);
  const field_ref = snapshot.entry_fields[entry.ref] ?? null;
  const relation_errors = snapshot.relation_errors.filter((row: any) => row.field_ref === field_ref || row.from === entry.ref || row.to === entry.ref);
  const my_authority = snapshot.my_authority.filter((row: any) => row.field_ref === field_ref);
  const my_watches = snapshot.my_watches.filter((row: any) => row.target_ref === entry.ref);
  return { schema: 'oi.shared-field.reading/v1', ref, state: 'hosted', target: snapshot.target, field_ref, entry, projections, relations, relation_errors, contributions, neighbourhood, my_authority, my_watches, status: snapshot.status };
}

/** Push hosted reducer arguments (the `hostedPublicationArgs` shape) in
 * publish order under the caller's own authority, then wait until the
 * caller-visible view echoes the Projection row back. */
export async function publishArgs(client: Client, args: any) {
  const reducers: any = client.conn.reducers;
  const db: any = client.conn.db;
  await reducers.putSharedField(args.putSharedField);
  await reducers.putParticipant(args.putParticipant);
  const granted = rows(db.myFieldAuthority).find((row: any) => row.fieldRef === args.putSharedField.fieldRef && row.participantRef === args.putParticipant.participantRef && row.role === 'contributor' && !row.revoked);
  if (!granted) await reducers.grantParticipantAuthority({ fieldRef: args.putSharedField.fieldRef, participantRef: args.putParticipant.participantRef, targetIdentity: client.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
  const already = rows(db.projection).find((row: any) => row.projectionKey === args.putProjection.projectionKey);
  if (!already) await reducers.putProjection(args.putProjection);
  for (const entry of args.putExploreEntries ?? []) await reducers.putExploreEntry(entry);
  for (const relation of args.putExploreRelations ?? []) await reducers.putExploreRelation(relation);
  const row = await waitUntil(() => rows(db.projection).find((candidate: any) => candidate.projectionKey === args.putProjection.projectionKey), `Projection ${args.putProjection.projectionKey} in the caller-visible view`);
  await waitUntil(() => (args.putExploreEntries ?? []).every((entry: any) => rows(db.exploreEntry).some((candidate: any) => candidate.semanticRef === entry.semanticRef)), 'published entries in the caller-visible view');
  return {
    schema: 'oi.shared-field.hosted-result/v1',
    target: { name: client.target.name, uri: client.target.uri, database: client.target.database },
    transport_identity: client.identityHex,
    hosted_projection_row: { projectionKey: row.projectionKey, rowId: String(row.rowId), projectionRef: row.projectionRef, projectionRevision: row.projectionRevision, sourceRevision: row.sourceRevision, state: row.state, publisherParticipantRef: row.publisherParticipantRef },
    entries: (args.putExploreEntries ?? []).map((entry: any) => entry.semanticRef),
    relations: (args.putExploreRelations ?? []).map((relation: any) => relation.relationRef),
    status: client.live.status(),
  };
}
