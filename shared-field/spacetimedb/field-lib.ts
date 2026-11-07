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
import { contextualContributions } from '../contribution-return.mjs';

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
  'SELECT * FROM owner_pending_contribution',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
  'SELECT * FROM shared_stage',
  'SELECT * FROM my_stage_follow',
  'SELECT * FROM field_presence',
  'SELECT * FROM activity_liveness',
  'SELECT * FROM field_now',
  'SELECT * FROM field_day',
];
/** The worlds in the field (O-I #858): every caller-visible world, the
 * caller's own, the clearings it may see and who has gathered at each star.
 * Subscribed on their own, so a field whose service does not hold worlds
 * yet is read as it always was, and says it holds no worlds. */
export const WORLD_SUBSCRIPTION = [
  'SELECT * FROM world',
  'SELECT * FROM my_world',
  'SELECT * FROM world_clearing',
  'SELECT * FROM world_gathering',
];
/** Each star's day (O-I #858, SF04), subscribed on its own beside the worlds:
 * a service that holds worlds but keeps no star's day yet is read as it was,
 * and says so. */
export const STAR_DAY_SUBSCRIPTION = ['SELECT * FROM star_day'];
/** What was said at each star (O-I #858, SF06), subscribed on its own beside the star's day: a service that keeps a star's day but
 * nothing said there yet is read as it was, and says so. */
export const STAR_SAYING_SUBSCRIPTION = ['SELECT * FROM star_saying'];
/** The work shown at each star and the tasks offered there (O-I #858, SF12, SF13), Software Factory's documents carried between
 * worlds, subscribed on their own beside what is said there: a service that keeps neither yet is read as it was, and says so. */
export const STAR_WORK_SUBSCRIPTION = ['SELECT * FROM star_work', 'SELECT * FROM star_offer'];
/** Which works shown at a star still answer (O-I #858; manual §17.2, "live while its source answers"), subscribed on its own beside
 * them: a service that keeps no answers reads each work by its standing alone, as it always did. */
export const STAR_WORK_ANSWER_SUBSCRIPTION = ['SELECT * FROM star_work_answer'];
/** What the worlds withdrew from the field (O-I #858, SF14): whose world, from what reach, of what kind and when, never which part nor
 * what it showed. Read at the worlds' scope (the circle variant for the narrower apertures), subscribed on its own beside them: a
 * service that keeps no withdrawals yet is read as it was, and says so. */
export const WORLD_WITHDRAWAL_SUBSCRIPTION = ['SELECT * FROM world_withdrawal'];
export const CIRCLE_WITHDRAWAL_SUBSCRIPTION = ['SELECT * FROM my_circle_withdrawal'];
/** Contributions to what a world shows (O-I #858, SF07): the caller's own, what waits in the caller's worlds and how the caller's own
 * were answered, read at every aperture; and beside them, at the worlds' scope, those accepted that the caller may read — in the whole
 * field, or in the caller's circle alone for the narrower apertures (DLW build ruling 2026-11-06). Subscribed on their own beside the
 * worlds: a service that keeps none yet is read as it was, and says so; one without the circle's contributions reads them whole. */
export const OWN_CONTRIBUTION_SUBSCRIPTION = ['SELECT * FROM my_world_contribution', 'SELECT * FROM world_contribution_waiting', 'SELECT * FROM my_world_contribution_answer'];
export const WORLD_CONTRIBUTION_SUBSCRIPTION = ['SELECT * FROM world_contribution'];
export const CIRCLE_CONTRIBUTION_SUBSCRIPTION = ['SELECT * FROM my_circle_contribution'];
/** Whether each world answers (O-I #858, SF11; manual §2): while a window of its owner's stands it answers, and once the last is gone it
 * is away, since when. Read at the worlds' scope (the circle variant for the narrower apertures), subscribed on its own beside them: a
 * service that keeps no answers yet is read as it was, and says nothing of who is away. */
export const WORLD_ANSWER_SUBSCRIPTION = ['SELECT * FROM world_answer'];
export const CIRCLE_WORLD_ANSWER_SUBSCRIPTION = ['SELECT * FROM my_circle_world_answer'];
/** The caller's own watches (DLW build ruling 2026-11-06): held whole, since they are its own at every aperture. */
export const WORLD_WATCH_SUBSCRIPTION = ['SELECT * FROM my_world_watch'];
/** The worlds as the World's narrower apertures read them (O-I #858, Aperture: World, Local, Shared): the worlds and the caller's own
 * whole, so what lies past the edge is counted, and the clearings and gatherings of the caller's circle alone, so what moves far away
 * sends nothing. Federated reads WORLD_SUBSCRIPTION; a service without the circle views is read whole. */
export const CIRCLE_SUBSCRIPTION = ['SELECT * FROM world', 'SELECT * FROM my_world', 'SELECT * FROM my_circle_clearing', 'SELECT * FROM my_circle_gathering'];
/** How much of the worlds a connection reads: the whole field, or the caller's circle. */
export type WorldScope = 'whole' | 'circle';
/** The World's apertures, and the scope each reads. */
export const APERTURE_SCOPE: Readonly<Record<string, WorldScope>> = { world: 'circle', local: 'circle', shared: 'circle', federated: 'whole' };
/** The scope an aperture reads, or undefined for what is no aperture. */
export const apertureScope = (aperture: unknown): WorldScope | undefined => (typeof aperture === 'string' && Object.hasOwn(APERTURE_SCOPE, aperture) ? APERTURE_SCOPE[aperture] : undefined);
/** Whether this connection holds the field's worlds, or why not. */
export type WorldsHeld = { state: 'held' } | { state: 'unavailable'; detail: string };
const NO_WORLDS = 'This field\'s service does not hold worlds yet';
const NO_STAR_DAY = 'This field\'s service does not keep a star\'s day yet';
const NO_SAYINGS = 'This field\'s service does not keep what is said at a star yet';
const NO_WORKS = 'This field\'s service does not keep work shown or tasks offered at a star yet';
const NO_ANSWERS = 'This field\'s service does not keep whether a work shown at a star still answers yet';
const NO_WITHDRAWALS = 'This field\'s service does not keep what a world withdrew yet';
const NO_CONTRIBUTIONS = 'This field\'s service does not keep contributions to a world yet';
const NO_WORLD_ANSWERS = 'This field\'s service does not keep whether a world answers yet';
const NO_WATCHES = 'This field\'s service does not keep the worlds you watch yet';
const TIMEOUT_MS = Number(process.env.OI_SHARED_FIELD_TIMEOUT_MS ?? 15_000);
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Target { name: string; server: string; uri: string; database: string; note?: string }

/** Resolve the hosting target: `OI_SHARED_FIELD_TARGET` names a `hosting.json`
 * target; `SPACETIMEDB_URI`/`SPACETIMEDB_DATABASE` override it. An unbound
 * target is an honest state the caller reports as Unavailable, never an error
 * the caller invents a default for. */
/** The machine-local, non-secret SharedField binding an installed desktop
 * reads when no environment names a target: `{schema, target}` under the
 * same state home as the owner transport tokens. Written by `field bind`. */
export function bindingFile() {
  const state = process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi');
  return join(state, 'shared-field', 'binding.json');
}

export function hostingTargets(): Record<string, Omit<Target, 'name'>> {
  return JSON.parse(readFileSync(join(here, 'hosting.json'), 'utf8')).targets ?? {};
}

export function resolveTarget(): { bound: true; target: Target; source: 'env' | 'binding' } | { bound: false; reason: string } {
  const uri = process.env.SPACETIMEDB_URI;
  const database = process.env.SPACETIMEDB_DATABASE;
  if (uri && database) return { bound: true, source: 'env', target: { name: 'env', server: 'env', uri, database } };
  let name = process.env.OI_SHARED_FIELD_TARGET;
  let source: 'env' | 'binding' = 'env';
  if (!name) {
    const file = bindingFile();
    if (existsSync(file)) {
      try {
        const binding = JSON.parse(readFileSync(file, 'utf8'));
        if (binding?.schema === 'oi.shared-field-binding/v1' && typeof binding.target === 'string') { name = binding.target; source = 'binding'; }
      } catch { return { bound: false, reason: `the SharedField binding at ${file} is not readable JSON` }; }
    }
  }
  if (!name) return { bound: false, reason: `no SharedField target bound: set OI_SHARED_FIELD_TARGET, or bind one for this machine with {"kind":"bind","target":"<name>"} (targets in hosting.json)` };
  const targets = hostingTargets();
  const target = targets[name];
  if (!target) return { bound: false, reason: `SharedField target "${name}" is not named in hosting.json (${Object.keys(targets).join(', ')})` };
  return { bound: true, source, target: { name, ...target } };
}

export function tokenFile(database: string, label = 'owner') {
  const state = process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi');
  return join(state, 'spacetimedb', label === 'owner' ? `${database}.owner-token` : `${database}.${label}-token`);
}

export interface Client { conn: DbConnection; identity: any; token: string; lifecycle: any; live: any; target: Target; identityHex: string; worlds: WorldsHeld; starDay: WorldsHeld; sayings: WorldsHeld; works: WorldsHeld
  /** whether the works' answers are held (§17.2) */
  answers: WorldsHeld
  /** whether what the worlds withdrew is held (SF14), and the subscription that reads it at the worlds' scope */
  withdrawals: WorldsHeld; withdrawalHandle?: any; withdrawalScope?: WorldScope
  /** whether contributions to what a world shows are held (SF07), and the subscription that reads those accepted at the worlds' scope */
  contributions: WorldsHeld; contributionHandle?: any; contributionScope?: WorldScope
  /** whether the field keeps which worlds answer (SF11), and the subscription that reads it at the worlds' scope */
  worldAnswers: WorldsHeld; worldAnswerHandle?: any; worldAnswerScope?: WorldScope
  /** whether the field keeps the worlds the caller's own watch (DLW build ruling 2026-11-06) */
  watches: WorldsHeld
  /** how much of the worlds this connection reads, and the subscription that reads it */
  worldScope: WorldScope; worldHandle?: any }

export async function connect(target: Target, token?: string): Promise<{ conn: DbConnection; identity: any; token: string; lifecycle: any }> {
  const lifecycle = createExploreTransportLifecycle();
  return new Promise((resolve, reject) => {
    let connection: DbConnection | undefined;
    const timer = setTimeout(() => { connection?.disconnect(); reject(new Error(`SharedField at ${target.uri}/${target.database} did not answer within ${TIMEOUT_MS} ms`)); }, TIMEOUT_MS);
    let builder = DbConnection.builder().withUri(target.uri).withDatabaseName(target.database);
    if (token) builder = builder.withToken(token);
    connection = builder
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
  try { await subscribe(opened.conn, opened.lifecycle); }
  catch (error) { opened.conn.disconnect(); throw error; }
  const held = await holdWorlds(opened.conn);
  const live = createLiveExploreApplication(createSpacetimeExploreSource(opened.conn.db, opened.lifecycle));
  return { ...opened, live, target, identityHex: opened.identity.toHexString(), ...held, worldScope: 'whole' };
}

/** Subscribe the worlds beside the field, each star's day beside them and what was said at each star beside that; a service without
 * any of them is said, never an error of the field. */
async function holdWorlds(conn: DbConnection): Promise<{ worlds: WorldsHeld; starDay: WorldsHeld; sayings: WorldsHeld; works: WorldsHeld; answers: WorldsHeld; withdrawals: WorldsHeld; contributions: WorldsHeld;
  worldAnswers: WorldsHeld; watches: WorldsHeld; worldHandle?: any; withdrawalHandle?: any; contributionHandle?: any; worldAnswerHandle?: any }> {
  let worldHandle: any, withdrawalHandle: any, contributionHandle: any, worldAnswerHandle: any;
  const held = async (queries: string[], detail: string, keep?: (handle: any) => void): Promise<WorldsHeld> => {
    try { const handle = await subscribeQueries(conn, queries); keep?.(handle); return { state: 'held' }; } catch { return { state: 'unavailable', detail }; }
  };
  const worlds = await held(WORLD_SUBSCRIPTION, NO_WORLDS, (handle) => { worldHandle = handle; });
  if (worlds.state !== 'held') return { worlds, starDay: { state: 'unavailable', detail: NO_STAR_DAY }, sayings: { state: 'unavailable', detail: NO_SAYINGS }, works: { state: 'unavailable', detail: NO_WORKS }, answers: { state: 'unavailable', detail: NO_ANSWERS },
    withdrawals: { state: 'unavailable', detail: NO_WITHDRAWALS }, contributions: { state: 'unavailable', detail: NO_CONTRIBUTIONS }, worldAnswers: { state: 'unavailable', detail: NO_WORLD_ANSWERS },
    watches: { state: 'unavailable', detail: NO_WATCHES } };
  const works = await held(STAR_WORK_SUBSCRIPTION, NO_WORKS);
  return { worlds, worldHandle, starDay: await held(STAR_DAY_SUBSCRIPTION, NO_STAR_DAY), sayings: await held(STAR_SAYING_SUBSCRIPTION, NO_SAYINGS), works,
    answers: works.state === 'held' ? await held(STAR_WORK_ANSWER_SUBSCRIPTION, NO_ANSWERS) : { state: 'unavailable', detail: NO_ANSWERS },
    withdrawals: await held(WORLD_WITHDRAWAL_SUBSCRIPTION, NO_WITHDRAWALS, (handle) => { withdrawalHandle = handle; }), withdrawalHandle,
    ...await holdContributions(),
    worldAnswers: await held(WORLD_ANSWER_SUBSCRIPTION, NO_WORLD_ANSWERS, (handle) => { worldAnswerHandle = handle; }), worldAnswerHandle,
    watches: await held(WORLD_WATCH_SUBSCRIPTION, NO_WATCHES) };
  async function holdContributions(): Promise<{ contributions: WorldsHeld; contributionHandle?: any }> {
    const own = await held(OWN_CONTRIBUTION_SUBSCRIPTION, NO_CONTRIBUTIONS);
    if (own.state !== 'held') return { contributions: own };
    return { contributions: await held(WORLD_CONTRIBUTION_SUBSCRIPTION, NO_CONTRIBUTIONS, (handle) => { contributionHandle = handle; }), contributionHandle };
  }
}

/** Read the worlds at a scope (the World's Aperture): subscribe it, and only once it has applied let the scope before it go. A service
 * without the circle views, or whose worlds are not held, keeps the scope it has. Rows the scope brings in or lets go are no
 * transaction. */
export async function scopeWorlds(client: Client, scope: WorldScope): Promise<WorldScope> {
  if (client.worlds.state !== 'held' || client.worldScope === scope) return client.worldScope;
  let handle: any;
  try { handle = await subscribeQueries(client.conn, scope === 'circle' ? CIRCLE_SUBSCRIPTION : WORLD_SUBSCRIPTION); } catch { return client.worldScope; }
  // what the worlds withdrew, the contributions accepted in them and whether they answer, at the same scope; a service without the
  // circle's keeps each of them whole
  const sides = [
    { held: client.withdrawals, queries: scope === 'circle' ? CIRCLE_WITHDRAWAL_SUBSCRIPTION : WORLD_WITHDRAWAL_SUBSCRIPTION, handle: 'withdrawalHandle', scope: 'withdrawalScope' },
    { held: client.contributions, queries: scope === 'circle' ? CIRCLE_CONTRIBUTION_SUBSCRIPTION : WORLD_CONTRIBUTION_SUBSCRIPTION, handle: 'contributionHandle', scope: 'contributionScope' },
    { held: client.worldAnswers, queries: scope === 'circle' ? CIRCLE_WORLD_ANSWER_SUBSCRIPTION : WORLD_ANSWER_SUBSCRIPTION, handle: 'worldAnswerHandle', scope: 'worldAnswerScope' },
  ] as const;
  const now: any[] = [];
  for (const side of sides) {
    let next: any;
    if (side.held.state === 'held') { try { next = await subscribeQueries(client.conn, [...side.queries]); } catch {} }
    now.push(next);
  }
  const prior = [client.worldHandle, ...sides.map((side, i) => (now[i] ? (client as any)[side.handle] : undefined))];
  client.worldHandle = handle;
  sides.forEach((side, i) => { if (now[i]) { (client as any)[side.handle] = now[i]; (client as any)[side.scope] = scope; } });
  client.worldScope = scope;
  for (const old of prior) { try { old?.unsubscribe(); } catch {} }
  return scope;
}

/** The clearings and gatherings as this connection reads them: the caller's circle, or the whole field. */
const clearingRows = (client: Client): any[] => rows(client.worldScope === 'circle' ? (client.conn.db as any).myCircleClearing : (client.conn.db as any).worldClearing);
const gatheringRows = (client: Client): any[] => rows(client.worldScope === 'circle' ? (client.conn.db as any).myCircleGathering : (client.conn.db as any).worldGathering);
/** What the worlds withdrew as this connection reads it: at the scope its withdrawals were last subscribed at. */
const withdrawalRows = (client: Client): any[] => rows(client.withdrawalScope === 'circle' ? (client.conn.db as any).myCircleWithdrawal : (client.conn.db as any).worldWithdrawal);
/** The contributions accepted that this connection reads: at the scope its contributions were last subscribed at. */
const acceptedRows = (client: Client): any[] => rows(client.contributionScope === 'circle' ? (client.conn.db as any).myCircleContribution : (client.conn.db as any).worldContribution);
/** Whether each world answers, as this connection reads it: at the scope its answers were last subscribed at. */
const worldAnswerRows = (client: Client): any[] => rows(client.worldAnswerScope === 'circle' ? (client.conn.db as any).myCircleWorldAnswer : (client.conn.db as any).worldAnswer);

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
    my_authority: rows(db.myFieldAuthority).map((row: any) => ({ field_ref: row.fieldRef, participant_ref: row.participantRef, role: row.role, revoked: Boolean(row.revoked), expires_at_micros: String(row.expiresAtMicros ?? 0) })),
    my_contribution_receipts: rows(db.myContributionReceipt).map((row: any) => ({ contribution_ref: row.contributionRef, ingress_ref: row.ingressRef, field_ref: row.fieldRef, state: row.state })),
    owner_pending_contributions: rows(db.ownerPendingContribution).map((row: any) => ({ ingress_ref: row.ingressRef, field_ref: row.fieldRef, contribution_ref: row.claimedContributionRef, contributor_participant_ref: row.contributorParticipantRef, received_at_micros: String(row.receivedAtMicros), payload_fingerprint: row.payloadFingerprint, contract: parse(row.contractJson) })),
    my_watches: rows(db.myWatch).map((row: any) => ({ watch_ref: row.watchRef, field_ref: row.fieldRef, target_kind: row.targetKind, target_ref: row.targetRef, state: row.state })),
    my_contacts: rows(db.myContact).map((row: any) => {
      // A message (field.ts `message`) is a Contact request whose requested scope carries the passage: the caller's own, initiator or recipient.
      const scope = parse(row.requestedScopeJson);
      return { contact_ref: row.contactRef, field_ref: row.fieldRef, initiator_participant_ref: row.initiatorParticipantRef, recipient_participant_ref: row.recipientParticipantRef, state: row.state ?? row.decision ?? null,
        ...(typeof row.purpose === 'string' ? { purpose: row.purpose } : {}), ...(scope?.kind === 'message' && scope.message ? { message: scope.message } : {}) };
    }),
    stages: rows(db.sharedStage).map(stageReading),
    my_stage_follows: rows(db.myStageFollow).map((row: any) => ({ stage_ref: row.stageRef, field_ref: row.fieldRef, follower_participant_ref: row.followerParticipantRef, followed_at_revision: Number(row.followedAtRevision) })),
    presence: rows(db.fieldPresence).map((row: any) => ({ field_ref: row.fieldRef, participant_ref: row.participantRef, state: row.state, updated_at_micros: String(row.updatedAtMicros) })),
    activity_liveness: rows(db.activityLiveness).map(activityLivenessRow),
    field_now: rows(db.fieldNow).map(fieldNowReading),
    field_day: rows(db.fieldDay).map(fieldDayReading),
    ...worldReading(client),
    counts: { fields: hosted.fields.length, participants: hosted.participants.length, projections: hosted.projections.length, entries: hosted.entries.length, relations: hosted.relations.length, field_now: rows(db.fieldNow).length, field_day: rows(db.fieldDay).length,
      worlds: rows(db.world).length, clearings: clearingRows(client).length, stars: rows(db.sharedField).filter((row: any) => row.kind === 'star').length, gatherings: gatheringRows(client).length },
    // The SharedField each Explore entry is hosted in (the row's fieldRef;
    // the entry contract itself carries no field) — what a Watch or a
    // membership reading is scoped to. Keyed by the entry's semantic ref.
    entry_fields: Object.fromEntries(rows(db.exploreEntry).map((row: any) => [row.semanticRef, row.fieldRef])),
    // A Projection never moves between fields, so its ref names one field.
    projection_fields: Object.fromEntries(rows(db.projection).map((row: any) => [row.projectionRef, row.fieldRef])),
    relation_fields: Object.fromEntries(rows(db.exploreRelation).flatMap((row: any) => { const relation = parse(row.relationJson); return relation?.relation_ref ? [[relation.relation_ref, row.fieldRef]] : []; })),
  };
}

/** The worlds as this caller may see them (O-I #858): each world with its body record and whether it is the
 * caller's own; the clearings it may see; the stars (SharedField rows of kind `star`) with who lit them; and
 * who has gathered or asked at each. What the caller may not see is not here, and nothing here counts it. */
export function worldReading(client: Client) {
  const db: any = client.conn.db;
  const mine = new Set(rows(db.myWorld).map((row: any) => row.worldRef));
  // whether each world answers (SF11): kept only where the service keeps it; a world it holds no word of has not answered since it began to
  const worldAnswered = client.worldAnswers.state === 'held' ? new Map(worldAnswerRows(client).map((row: any) => [row.worldRef, row])) : null;
  const answerOf = (ref: string) => { const row = worldAnswered?.get(ref); return row ? { answering: Boolean(row.answering), since_micros: String(row.sinceMicros) } : null; };
  const worlds = rows(db.world).map((row: any) => ({ world_ref: row.worldRef, body: parse(row.bodyJson), linked: Boolean(row.linked), mine: mine.has(row.worldRef), updated_at_micros: String(row.updatedAtMicros),
    ...(worldAnswered ? { answer: answerOf(row.worldRef) } : {}) }));
  const stars = rows(db.sharedField).filter((row: any) => row.kind === 'star').map((row: any) => {
    const contract = parse(row.contractJson) ?? {};
    const litBy = typeof contract.presentation?.lit_by === 'string' ? contract.presentation.lit_by : null;
    return { star_ref: row.fieldRef, name: contract.title ?? row.fieldRef, gathers: contract.presentation?.gathers ?? '', comes: contract.presentation?.comes ?? 'asked',
      lit_by: litBy, mine: litBy !== null && mine.has(litBy), ...(contract.parent_field_ref ? { within: contract.parent_field_ref } : {}) };
  });
  // which works shown at a star still answer (§17.2): known only where the service keeps it
  const answered = client.answers.state === 'held' ? new Set(rows(db.starWorkAnswer).map((row: any) => row.workKey)) : null;
  return {
    world_field: client.worlds,
    // how much of the worlds is read: the whole field (Federated), or the caller's circle (World, Local, Shared)
    world_scope: client.worldScope,
    worlds,
    clearings: clearingRows(client).map((row: any) => ({ world_ref: row.worldRef, part_ref: row.partRef, star_ref: row.starRef || null, audience: row.audience, shown: parse(row.shownJson), shown_at_micros: String(row.shownAtMicros) })),
    stars,
    gatherings: gatheringRows(client).map((row: any) => ({ star_ref: row.starRef, world_ref: row.worldRef, state: row.state, asked_at_micros: String(row.askedAtMicros), ...(row.state === 'gathered' ? { gathered_at_micros: String(row.gatheredAtMicros) } : {}) })),
    // each star's day, in the order it happened: who came, was let in, showed something (of what kind) and left
    star_day: client.starDay,
    star_days: rows(db.starDay).sort((a: any, b: any) => (BigInt(a.rowId) < BigInt(b.rowId) ? -1 : 1))
      .map((row: any) => ({ star_ref: row.starRef, world_ref: row.worldRef, what: row.what, ...(row.kind ? { kind: row.kind } : {}), at_micros: String(row.atMicros) })),
    // what was said at each star, in the order it was said: who said what (a question, finding, correction or reproduction) to what —
    // something shown there (named only while the caller can see it) or something said there before
    star_saying: client.sayings,
    star_sayings: rows(db.starSaying).sort((a: any, b: any) => (BigInt(a.saidAtMicros) < BigInt(b.saidAtMicros) ? -1 : BigInt(a.saidAtMicros) > BigInt(b.saidAtMicros) ? 1 : a.sayingRef < b.sayingRef ? -1 : 1))
      .map((row: any) => ({ saying_ref: row.sayingRef, star_ref: row.starRef, world_ref: row.worldRef, to_world_ref: row.toWorldRef || null, to_part_ref: row.toPartRef || null,
        to_saying_ref: row.toSayingRef || null, what: row.what, words: row.words, said_at_micros: String(row.saidAtMicros) })),
    // the work each world shows at a star (Software Factory's `factory.shown-work/v1`, live while its Run is open, as it was kept
    // once it closed) and the tasks offered there (`factory.task-offer/v1` under its grant): what came back to an offer is here only
    // for its offerer and its taker
    star_work: client.works,
    star_works: rows(db.starWork).sort((a: any, b: any) => (BigInt(a.shownAtMicros) < BigInt(b.shownAtMicros) ? -1 : BigInt(a.shownAtMicros) > BigInt(b.shownAtMicros) ? 1 : a.workKey < b.workKey ? -1 : 1))
      .map((row: any) => ({ star_ref: row.starRef, world_ref: row.worldRef, work_ref: row.workRef, standing: row.standing, revision: Number(row.revision), shown: parse(row.shownJson),
        shown_at_micros: String(row.shownAtMicros), updated_at_micros: String(row.updatedAtMicros), ...(answered ? { answering: answered.has(row.workKey) } : {}) })),
    star_offers: rows(db.starOffer).sort((a: any, b: any) => (BigInt(a.offeredAtMicros) < BigInt(b.offeredAtMicros) ? -1 : BigInt(a.offeredAtMicros) > BigInt(b.offeredAtMicros) ? 1 : a.offerRef < b.offerRef ? -1 : 1))
      .map((row: any) => ({ offer_ref: row.offerRef, star_ref: row.starRef, world_ref: row.worldRef, state: row.state, taker_world_ref: row.takerWorldRef || null, offer: parse(row.offerJson),
        ...(row.returnJson ? { returned: parse(row.returnJson) } : {}), lapses_at_micros: String(row.lapsesAtMicros), offered_at_micros: String(row.offeredAtMicros), moved_at_micros: String(row.movedAtMicros) })),
    // what the worlds withdrew (SF14), in the order it happened: whose world, from what reach (the public, the field, a star — or the
    // world itself, out of the field), of what kind and when; never which part, nor what it showed
    world_withdrawal: client.withdrawals,
    world_withdrawals: client.withdrawals.state === 'held' ? withdrawalRows(client).sort((a: any, b: any) => (BigInt(a.rowId) < BigInt(b.rowId) ? -1 : 1))
      .map((row: any) => ({ world_ref: row.worldRef, star_ref: row.starRef || null, reach: row.reach, ...(row.kind ? { kind: row.kind } : {}), withdrawn_at_micros: String(row.withdrawnAtMicros) })) : [],
    // contributions to what a world shows (SF07), in the order they came: whose world each came from, the world it waits or stands in,
    // what it stands on (a part shown, named only while the caller may see it, or a contribution above it), what it is and its words,
    // and where it stands — waiting, accepted or refused; under the caller's own, the owner's words in answer
    // whether each world answers (SF11): on each world above, `answer` (null when it has not answered since the field began to keep it)
    world_answer: client.worldAnswers,
    // the worlds the caller's own watch (DLW build ruling 2026-11-06): its own alone, never who watches it, and no count
    world_watch: client.watches,
    world_watches: client.watches.state === 'held' ? rows(db.myWorldWatch).sort((a: any, b: any) => (a.watchKey < b.watchKey ? -1 : 1))
      .map((row: any) => ({ world_ref: row.watcherWorldRef, watched_world_ref: row.watchedWorldRef, watched_at_micros: String(row.watchedAtMicros) })) : [],
    world_contribution: client.contributions,
    world_contributions: client.contributions.state === 'held' ? worldContributions(db, acceptedRows(client)) : [],
  };
}

/** Where a contribution stands, by its ingress row's state. */
const CONTRIBUTION_STANDING: Readonly<Record<string, string>> = { quarantined: 'waiting', admitted: 'accepted', rejected: 'refused' };

/** The contributions this connection reads, one row each: accepted ones the caller may read, what waits in the caller's worlds and the
 * caller's own in whatever state, with the owner's words under the caller's own once answered. */
function worldContributions(db: any, accepted: any[]): any[] {
  const answers = new Map<string, any>();
  for (const row of rows(db.myWorldContributionAnswer)) {
    const before = answers.get(row.ingressRef);
    if (!before || BigInt(before.decidedAtMicros) < BigInt(row.decidedAtMicros)) answers.set(row.ingressRef, row);
  }
  const read = new Map<string, any>();
  const put = (row: any, state: string | undefined, at: unknown) => {
    const contract = parse(row.contractJson);
    if (!state || !contract || typeof contract.contribution_ref !== 'string' || !contract.to || typeof contract.to !== 'object') return;
    const to = typeof contract.to.contribution_ref === 'string' ? { contribution_ref: contract.to.contribution_ref }
      : { world_ref: contract.to.world_ref, part_ref: contract.to.part_ref || null, star_ref: contract.to.star_ref || null };
    const answer = state === 'waiting' ? undefined : answers.get(row.ingressRef);
    // a claim of the same work (SF09): the part of its claimant's set beside its target, named only while the caller may read it
    const beside = contract.beside && typeof contract.beside === 'object'
      ? { beside: { world_ref: contract.beside.world_ref, part_ref: contract.beside.part_ref || null, star_ref: contract.beside.star_ref || null } } : {};
    read.set(contract.contribution_ref, { contribution_ref: contract.contribution_ref, world_ref: contract.world_ref, from_world_ref: contract.from_world_ref, to, what: contract.what,
      ...beside, words: contract.words, state, at_micros: String(at), ...(answer && (answer.reason || state === 'refused') ? { answer: { words: answer.reason, at_micros: String(answer.decidedAtMicros) } } : {}) });
  };
  for (const row of accepted) put(row, 'accepted', row.admittedAtMicros);
  for (const row of rows(db.worldContributionWaiting)) put(row, 'waiting', row.receivedAtMicros);
  for (const row of rows(db.myWorldContribution)) put(row, CONTRIBUTION_STANDING[row.state], row.receivedAtMicros);
  return [...read.values()].sort((a, b) => (BigInt(a.at_micros) < BigInt(b.at_micros) ? -1 : BigInt(a.at_micros) > BigInt(b.at_micros) ? 1 : a.contribution_ref < b.contribution_ref ? -1 : 1));
}

/* ---------- The held field (O-I #858): one connection for the window's life ----------
 *
 * The native host holds one client per identity for as long as its window
 * lives (field.ts `--held`, spoken to by desktop/cradle/kernel/src/shared_field.rs).
 * Requests go in on it and the rows they change come out of it; nothing is
 * reconnected, resubscribed or relaunched per request. Its cursor is the
 * transaction: it moves once for each server transaction that changed what
 * this caller can see, and never for one it cannot (another identity's
 * private rows change nothing here, so they move nothing). Rows that only
 * enter or leave the subscription as the view narrows and widens are no
 * transaction; but a field that was out of view may have moved unseen, so
 * the cursor moves once when a field that was in view and out of it since
 * (or the whole field) comes back into view (`backInView`). */

/** The views a field scope narrows: every caller-filtered view whose rows
 * belong to one field. The rest of SUBSCRIPTION — the fields themselves and
 * the caller's own rows — is held whatever is in view. */
export const FIELD_SCOPED_VIEWS = ['participant', 'projection', 'contribution', 'explore_entry', 'explore_relation', 'shared_stage', 'field_presence', 'activity_liveness', 'field_now', 'field_day'];
export const HELD_BASE = SUBSCRIPTION.filter((query) => !FIELD_SCOPED_VIEWS.includes(query.slice('SELECT * FROM '.length)));

/** What is in view: the whole field, or the fields named. */
export type FieldScope = 'whole' | string[];

const SCOPED_REF = /^[^\u0000-\u001f\u007f]{1,512}$/;
/** A scope as a request names it, or null when it names none. */
export function fieldScopeOf(value: unknown): FieldScope | null {
  if (value === 'whole') return 'whole';
  if (Array.isArray(value) && value.length <= 64 && value.every((ref) => typeof ref === 'string' && SCOPED_REF.test(ref))) return [...new Set(value as string[])].sort();
  return null;
}

/** The subscription a scope asks for: each scoped view whole, or each
 * filtered to the fields named (refs as SQL string literals, quotes doubled).
 * Every query names a caller-filtered view, never a backing table. */
export function scopeQueries(scope: FieldScope): string[] {
  if (scope === 'whole') return FIELD_SCOPED_VIEWS.map((view) => `SELECT * FROM ${view}`);
  return scope.flatMap((ref) => FIELD_SCOPED_VIEWS.map((view) => `SELECT * FROM ${view} WHERE field_ref = '${ref.replaceAll("'", "''")}'`));
}

/** What every lease has in view, together. */
export function unionScope(scopes: Iterable<FieldScope>): FieldScope {
  const refs = new Set<string>();
  for (const scope of scopes) {
    if (scope === 'whole') return 'whole';
    for (const ref of scope) refs.add(ref);
  }
  return [...refs].sort();
}

/** Whether a change of view, from `prior` (none yet on this connection when undefined) to `want`, brings back into view a
 * field that was in view before on this connection (`seen`) and out of it since: what moved there meanwhile sent nothing,
 * so what is held of it is read again. A field first brought into view, one still in view, or one let go brings none. */
export function backInView(seen: FieldScope, prior: FieldScope | undefined, want: FieldScope): boolean {
  if (prior === 'whole') return false;
  const before = new Set(prior ?? []);
  if (want === 'whole') return seen === 'whole' || seen.some((ref) => !before.has(ref));
  return want.some((ref) => !before.has(ref) && (seen === 'whole' || seen.includes(ref)));
}

/** Requests that read none of a field's scoped rows: who the caller is, the worlds (held whole beside the base, as are the
 * stars, which are fields), the acts on them, and the caller's own rows. */
const READS_NO_FIELD = new Set(['identity', 'worlds', 'receipt', 'watch', 'contact', 'grant-read', 'revoke-read', 'stage-follow', 'stage-unfollow',
  'world-put', 'clearing-open', 'clearing-withdraw', 'star-light', 'star-gather', 'star-admit', 'star-leave', 'star-close', 'star-say', 'star-unsay',
  'work-show', 'work-unshow', 'offer-put', 'offer-revoke', 'offer-take', 'offer-return', 'offer-accept',
  'world-contribute', 'world-claim-same', 'world-contribution-accept', 'world-contribution-refuse', 'world-contribution-take-back', 'world-watch', 'world-unwatch']);
/** Requests that read one field's scoped rows, the field their `field_ref` names. */
const READS_ONE_FIELD = new Set(['field-now', 'field-day', 'stage', 'enter', 'leave', 'activity-liveness-put', 'activity-liveness-clear']);
/** What one request reads, so what its glance brings into view: no field, the one field it names, or (for every other
 * request: a snapshot, an observation, a ref's reading, a publication) the whole field. */
export function requestScope(request: any): FieldScope {
  const kind = request?.kind;
  if (READS_NO_FIELD.has(kind)) return [];
  if (READS_ONE_FIELD.has(kind)) return fieldScopeOf([request.field_ref]) ?? 'whole';
  return 'whole';
}

/** Each held table: its SDK handle, its wire name, and the column that
 * names one of its rows. A change carries these refs, never a row's content. */
export const HELD_TABLES: ReadonlyArray<readonly [property: string, table: string, key: string]> = [
  ['sharedField', 'shared_field', 'fieldRef'], ['participant', 'participant', 'participantRef'], ['projection', 'projection', 'projectionKey'],
  ['contribution', 'contribution', 'contributionRef'], ['exploreEntry', 'explore_entry', 'semanticRef'], ['exploreRelation', 'explore_relation', 'relationRef'],
  ['myFieldAuthority', 'my_field_authority', 'authorityKey'], ['myContributionReceipt', 'my_contribution_receipt', 'ingressRef'],
  ['ownerPendingContribution', 'owner_pending_contribution', 'ingressRef'], ['myWatch', 'my_watch', 'watchRef'], ['myContact', 'my_contact', 'contactRef'],
  ['sharedStage', 'shared_stage', 'stageRef'], ['myStageFollow', 'my_stage_follow', 'followKey'], ['fieldPresence', 'field_presence', 'presenceKey'],
  ['activityLiveness', 'activity_liveness', 'activityKey'], ['fieldNow', 'field_now', 'fieldRef'], ['fieldDay', 'field_day', 'dayKey'],
  ['world', 'world', 'worldRef'], ['myWorld', 'my_world', 'worldRef'], ['worldClearing', 'world_clearing', 'clearingKey'], ['worldGathering', 'world_gathering', 'gatheringKey'],
  ['starDay', 'star_day', 'rowId'], ['starSaying', 'star_saying', 'sayingRef'], ['starWork', 'star_work', 'workKey'], ['starOffer', 'star_offer', 'offerRef'],
  ['myCircleClearing', 'my_circle_clearing', 'clearingKey'], ['myCircleGathering', 'my_circle_gathering', 'gatheringKey'], ['starWorkAnswer', 'star_work_answer', 'workKey'],
  ['worldWithdrawal', 'world_withdrawal', 'rowId'], ['myCircleWithdrawal', 'my_circle_withdrawal', 'rowId'],
  ['worldContribution', 'world_contribution', 'contributionRef'], ['myWorldContribution', 'my_world_contribution', 'ingressRef'],
  ['worldContributionWaiting', 'world_contribution_waiting', 'ingressRef'], ['myWorldContributionAnswer', 'my_world_contribution_answer', 'decisionRef'],
  ['myCircleContribution', 'my_circle_contribution', 'contributionRef'],
  ['worldAnswer', 'world_answer', 'worldRef'], ['myCircleWorldAnswer', 'my_circle_world_answer', 'worldRef'], ['myWorldWatch', 'my_world_watch', 'watchKey'],
];

export interface RowChange { table: string; op: 'insert' | 'update' | 'delete'; ref: string }
type HeldEnvelope = { ok: true; data: unknown } | { ok: false; error: { kind: 'unbound' | 'unavailable' | 'refused' | 'malformed'; message: string } };

/** How long one request keeps what it reads in view after it is answered. */
const GLANCE_MS = Number(process.env.OI_SHARED_FIELD_GLANCE_MS ?? 30_000);
/** The most changes one transaction event names; the rest are counted. */
const CHANGES_PER_EVENT = 128;

function subscribeQueries(conn: DbConnection, queries: string[], lifecycle?: any): Promise<any> {
  if (queries.length === 0) return Promise.resolve(undefined);
  lifecycle?.subscribing();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`subscription did not apply within ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
    const handle: any = conn.subscriptionBuilder()
      .onApplied(() => { clearTimeout(timer); lifecycle?.applied(); resolve(handle); })
      .onError((_ctx: any, error: any) => { clearTimeout(timer); lifecycle?.subscriptionError(error ?? new Error('subscription refused')); reject(error ?? new Error('subscription refused')); })
      .subscribe(queries);
  });
}

/**
 * Hold one identity's field: one connection, kept and re-made when the
 * service is lost (500 ms doubling to 15 s, as the site's own connection
 * does: site/src/explore/spacetimedb-provider.ts), its base subscription,
 * and a field-scoped subscription that follows what is in view — the leases
 * (`view`) and, for GLANCE_MS after each request, a glance of what that request
 * reads (requestScope): no field, the one it names, or the whole field.
 * `answer` is the request law (field.ts); `emit` carries a transaction or a
 * status line out. Nothing reconnecting replays a presence or any other act.
 */
export function holdField(options: { label: string; answer: (client: Client, request: any) => Promise<HeldEnvelope>; emit: (line: Record<string, unknown>) => void }) {
  const { label, answer, emit } = options;
  let client: Client | undefined;
  // A connection's epoch starts from this client's start (ms): a cursor names
  // one transaction on one connection of one client, never one seen before.
  let epoch = Date.now(), count = 0, attempt = 0, closed = false;
  let state: 'connecting' | 'live' | 'degraded' | 'unbound' = 'connecting';
  let detail: string | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Each request's glance: what it reads, in view until when. */
  const glances = new Map<string, { scope: FieldScope; until: number; timer: ReturnType<typeof setTimeout> }>();
  let scoped: { key: string; scope: FieldScope; handle: any } | undefined;
  let scoping: Promise<void> = Promise.resolve();
  let batch: RowChange[] | undefined;
  /** What has been in view on this connection: a field back in view after it was out of it is read again. */
  let seen: FieldScope = [];
  const leases = new Map<string, FieldScope>();
  /** How much of the worlds the window's Aperture reads (`worlds {aperture}`): the whole field until it says. */
  let worldWant: WorldScope = 'whole';

  const cursor = () => `tx:${epoch}:${count}`;
  const inView = (): FieldScope => unionScope([...leases.values(), ...[...glances.values()].filter((glance) => Date.now() < glance.until).map((glance) => glance.scope)]);
  const reading = () => ({ state, ...(detail ? { detail } : {}), cursor: cursor(), scope: scoped?.scope ?? [], leases: leases.size, transport_identity: client?.identityHex ?? null });
  const status = () => emit({ event: 'status', ...reading() });

  function changed(connection: number, table: string, op: RowChange['op'], ref: unknown) {
    if (connection !== epoch || closed) return;
    if (!batch) {
      count += 1;
      batch = [];
      const at = cursor();
      // One server transaction's callbacks all run before this timer does.
      setTimeout(() => {
        const changes = batch ?? [];
        batch = undefined;
        emit({ event: 'transaction', cursor: at, changes: changes.slice(0, CHANGES_PER_EVENT), more: Math.max(0, changes.length - CHANGES_PER_EVENT) });
      }, 0);
    }
    batch.push({ table, op, ref: String(ref) });
  }

  /** A row moved by a transaction — this caller's own reducer or anyone's
   * the caller can see — not one the view brought in or let go. */
  const transacted = (ctx: any) => !['SubscribeApplied', 'UnsubscribeApplied'].includes(ctx?.event?.tag);
  function watchRows(conn: DbConnection, connection: number) {
    for (const [property, table, key] of HELD_TABLES) {
      const handle = (conn.db as any)[property];
      if (!handle) continue;
      handle.onInsert?.((ctx: any, row: any) => { if (transacted(ctx)) changed(connection, table, 'insert', row?.[key]); });
      handle.onDelete?.((ctx: any, row: any) => { if (transacted(ctx)) changed(connection, table, 'delete', row?.[key]); });
      handle.onUpdate?.((ctx: any, _old: any, row: any) => { if (transacted(ctx)) changed(connection, table, 'update', row?.[key]); });
    }
  }

  /** The held client is the window (SF11; manual §2): while it stands it answers for each world of its owner's, those it holds now and
   * each put from here on; with its connection gone the field reads them away. A service that keeps no answers refuses, and is let be. */
  function answerForWorlds(conn: DbConnection, connection: number) {
    (conn.db as any).myWorld?.onInsert?.((_ctx: any, row: any) => {
      if (connection !== epoch || closed || typeof row?.worldRef !== 'string') return;
      try { Promise.resolve((conn.reducers as any).answerForWorld?.({ worldRef: row.worldRef })).catch(() => {}); } catch {}
    });
  }

  function drop() {
    const held = client;
    client = undefined;
    scoped = undefined;
    if (held) close(held);
  }

  let losing = false;
  function lost(error: unknown) {
    // A loss is met once: letting the connection go reports its own end.
    if (closed || retry || losing) return;
    losing = true;
    try { drop(); } finally { losing = false; }
    state = 'degraded';
    // The transport's own words when it has any; a socket that only closed
    // says nothing, and the person is told what happened instead.
    const said = String((error as any)?.message ?? error ?? '').trim();
    detail = said || 'The SharedField connection ended';
    status();
    const delay = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5));
    attempt += 1;
    retry = setTimeout(() => { retry = undefined; ready = connectHeld(); }, delay);
  }

  async function connectHeld(): Promise<void> {
    if (closed) return;
    const binding = resolveTarget();
    if (!binding.bound) { state = 'unbound'; detail = binding.reason; status(); return; }
    state = 'connecting';
    detail = undefined;
    status();
    const target = binding.target;
    const file = tokenFile(target.database, label);
    const saved = existsSync(file) ? readFileSync(file, 'utf8').trim() : undefined;
    let opened: Awaited<ReturnType<typeof connect>>;
    try { opened = await connect(target, saved); } catch (error) { lost(error); return; }
    if (closed) { opened.conn.disconnect(); return; }
    if (!saved || saved !== opened.token) {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(file, opened.token, { mode: 0o600 });
    }
    const connection = ++epoch;
    count = 0;
    seen = [];
    watchRows(opened.conn, connection);
    answerForWorlds(opened.conn, connection);
    opened.lifecycle.subscribe((event: any) => {
      if (connection === epoch && ['offline', 'error'].includes(event?.transport?.state)) lost(new Error(event.transport.error ?? 'The SharedField connection ended'));
    });
    try { await subscribeQueries(opened.conn, HELD_BASE, opened.lifecycle); } catch (error) { try { opened.conn.disconnect(); } catch {} lost(error); return; }
    if (closed || connection !== epoch) { try { opened.conn.disconnect(); } catch {} return; }
    const held = await holdWorlds(opened.conn);
    if (closed || connection !== epoch) { try { opened.conn.disconnect(); } catch {} return; }
    const live = createLiveExploreApplication(createSpacetimeExploreSource(opened.conn.db, opened.lifecycle));
    const made: Client = { ...opened, live, target, identityHex: opened.identity.toHexString(), ...held, worldScope: 'whole' };
    // the worlds at the scope the window's Aperture last asked for, on this connection as on the one before it
    await scopeWorlds(made, worldWant);
    if (closed || connection !== epoch) { try { opened.conn.disconnect(); } catch {} return; }
    client = made;
    state = 'live';
    attempt = 0;
    status();
    await rescope();
  }

  /** Bring the subscription to what is in view now: subscribe the new
   * scope, and only once it has applied let the old one go. */
  function rescope(): Promise<void> {
    scoping = scoping.then(async () => {
      const held = client;
      if (!held) return;
      const want = inView();
      const key = JSON.stringify(want);
      if (scoped?.key === key) return;
      const handle = await subscribeQueries(held.conn, scopeQueries(want));
      if (client !== held) { try { handle?.unsubscribe(); } catch {} return; }
      const prior = scoped;
      scoped = { key, scope: want, handle };
      try { prior?.handle?.unsubscribe(); } catch {}
      const back = backInView(seen, prior?.scope, want);
      seen = unionScope([seen, want]);
      if (back) {
        // A field (or the whole field) back in view after it was out of it:
        // what moved there unseen meanwhile is read now, at a new cursor.
        count += 1;
        status();
      }
    }).catch((error) => { detail = `The field could not be brought into view: ${error?.message ?? error}`; status(); });
    return scoping;
  }

  /** Keep what this request reads in view for it and GLANCE_MS after it; true once all of it is in view. */
  async function glance(scope: FieldScope): Promise<boolean> {
    const key = JSON.stringify(scope);
    if (scope !== 'whole' && scope.length === 0) return true;
    const prior = glances.get(key);
    if (prior) clearTimeout(prior.timer);
    const timer = setTimeout(() => { if (glances.get(key)?.timer === timer) glances.delete(key); void rescope(); }, GLANCE_MS + 10);
    glances.set(key, { scope, until: Date.now() + GLANCE_MS, timer });
    await rescope();
    const now = scoped?.scope;
    return now === 'whole' || (scope !== 'whole' && now !== undefined && scope.every((ref) => now.includes(ref)));
  }

  let ready: Promise<void> = connectHeld();

  return Object.freeze({
    reading,
    /** The binding changed: let the connection go and stand on the new target. */
    async rebind() {
      if (retry) { clearTimeout(retry); retry = undefined; }
      epoch += 1;
      drop();
      attempt = 0;
      ready = connectHeld();
      await ready;
    },
    async request(request: any): Promise<HeldEnvelope> {
      if (!request || typeof request !== 'object' || typeof request.kind !== 'string') return { ok: false, error: { kind: 'malformed', message: 'request must be an object with a string `kind`' } };
      if (request.token_label !== undefined) return { ok: false, error: { kind: 'refused', message: 'This held client serves one identity and takes no other credential' } };
      if (request.kind === 'view') {
        if (typeof request.lease !== 'string' || !/^[A-Za-z0-9:._-]{1,128}$/.test(request.lease)) return { ok: false, error: { kind: 'malformed', message: 'view requires a bounded `lease`' } };
        if (request.scope === null) leases.delete(request.lease);
        else {
          const scope = fieldScopeOf(request.scope);
          if (!scope) return { ok: false, error: { kind: 'malformed', message: 'view requires `scope`: "whole", a list of field refs, or null to let the lease go' } };
          if (!leases.has(request.lease) && leases.size >= 64) return { ok: false, error: { kind: 'refused', message: 'This window has reached its field view budget' } };
          leases.set(request.lease, scope);
        }
        await rescope();
        return { ok: true, data: { schema: 'oi.shared-field.view/v1', lease: request.lease, in_view: inView(), scope: scoped?.scope ?? [], cursor: cursor() } };
      }
      await ready;
      if (state === 'unbound') return { ok: false, error: { kind: 'unbound', message: detail ?? 'no SharedField target bound' } };
      const held = client;
      if (!held || state !== 'live') return { ok: false, error: { kind: 'unavailable', message: `The SharedField is not reachable now: ${detail ?? 'it is connecting again'}` } };
      if (!(await glance(requestScope(request)))) return { ok: false, error: { kind: 'unavailable', message: detail ?? 'The field could not be brought into view' } };
      if (request.kind === 'worlds' && request.aperture !== undefined) {
        // the World's Aperture: the narrower ones read the caller's circle, Federated the whole field; the window reads at the last one
        const scope = apertureScope(request.aperture);
        if (!scope) return { ok: false, error: { kind: 'malformed', message: 'worlds takes an `aperture`: world, local, shared or federated' } };
        worldWant = scope;
        await (scoping = scoping.then(() => scopeWorlds(held, scope)).then(() => undefined, () => undefined));
      }
      if (request.kind === 'observe') {
        return { ok: true, data: { schema: 'oi.shared-field.observation/v1', cursor: cursor(), snapshot: { state: 'hosted', ...fieldSnapshot(held) }, ...(typeof request.ref === 'string' && request.ref ? { reading: readRef(held, request.ref) } : {}) } };
      }
      return answer(held, request);
    },
    close() {
      closed = true;
      if (retry) clearTimeout(retry);
      for (const glance of glances.values()) clearTimeout(glance.timer);
      glances.clear();
      drop();
    },
  });
}

/** One activity-liveness row as the caller reads it, in the snake_case shape
 * `activity-liveness.mjs` consumes. Server facts only: who produced it, the
 * owner state/revision it reported, and when (server microseconds). */
export function activityLivenessRow(row: any) {
  return {
    activity_key: row.activityKey,
    field_ref: row.fieldRef,
    activity_ref: row.activityRef,
    producer_participant_ref: row.producerParticipantRef || null,
    producer_identity: row.producerIdentity?.toHexString ? row.producerIdentity.toHexString() : String(row.producerIdentity),
    owner_state: row.ownerState,
    owner_revision: Number(row.ownerRevision),
    observed_at_micros: String(row.observedAtMicros),
    heartbeat_at_micros: String(row.heartbeatAtMicros),
  };
}

/** The collective FieldNow of one field as the caller reads it: server
 * revision/attribution plus the `oi.field-now/v1` contract (refs only). */
export function fieldNowReading(row: any) {
  return {
    schema: 'oi.shared-field.field-now-reading/v1',
    field_ref: row.fieldRef,
    revision: Number(row.revision),
    contract: parse(row.contractJson),
    updated_by_participant_ref: row.updatedByParticipantRef || null,
    updated_at_micros: String(row.updatedAtMicros),
  };
}

/** One FieldDay aggregation interval as the caller reads it. */
export function fieldDayReading(row: any) {
  return {
    schema: 'oi.shared-field.field-day-reading/v1',
    field_ref: row.fieldRef,
    interval: { start: row.intervalStart, end: row.intervalEnd },
    revision: Number(row.revision),
    contract: parse(row.contractJson),
    updated_by_participant_ref: row.updatedByParticipantRef || null,
    updated_at_micros: String(row.updatedAtMicros),
  };
}

/** The open Shared Stage row as the caller reads it: the server facts plus
 * the `oi.shared-stage/v1` contract it carries. Admitted shared presentation
 * state only — the row has no field that could hold local view state. */
export function stageReading(row: any) {
  return {
    stage_ref: row.stageRef,
    field_ref: row.fieldRef,
    revision: Number(row.revision),
    state: row.state,
    presenter_ref: row.presenterRef,
    subject_ref: row.subjectRef,
    contract: parse(row.contractJson),
    updated_by_participant_ref: row.updatedByParticipantRef,
    updated_at_micros: String(row.updatedAtMicros),
  };
}

/** The caller's stage reading for one field: the open stage (or none), the
 * caller's own follow row, and the live presence of the field. */
export function stageView(client: Client, fieldRef: string) {
  const db: any = client.conn.db;
  const row = rows(db.sharedStage).find((candidate: any) => candidate.fieldRef === fieldRef);
  const follow = rows(db.myStageFollow).find((candidate: any) => candidate.fieldRef === fieldRef);
  return {
    schema: 'oi.shared-field.stage-reading/v1',
    field_ref: fieldRef,
    stage: row ? stageReading(row) : null,
    my_follow: follow ? { stage_ref: follow.stageRef, follower_participant_ref: follow.followerParticipantRef, followed_at_revision: Number(follow.followedAtRevision), following: true } : null,
    presence: rows(db.fieldPresence).filter((candidate: any) => candidate.fieldRef === fieldRef).map((row: any) => ({ participant_ref: row.participantRef, state: row.state, updated_at_micros: String(row.updatedAtMicros) })),
  };
}

/** One hosted ref read as a Projection reading: the Explore entry, the
 * Projections whose subject is that ref or its world, the relations that
 * touch it, and the bounded neighbourhood the live application opens. */
export function readRef(client: Client, ref: string) {
  const snapshot = fieldSnapshot(client);
  const matches = snapshot.entries.filter((candidate: any) => candidate.ref === ref || (candidate.aliases ?? []).includes(ref));
  if (matches.length > 1) return {schema: 'oi.shared-field.reading/v1', state: 'unavailable', owner_operation: 'shared-field.resolve', detail: `Ambiguous shared address ${ref}: qualify its world before opening`};
  const entry = matches[0];
  if (!entry) return { schema: 'oi.shared-field.reading/v1', ref, state: 'absent', target: snapshot.target };
  const field_ref = snapshot.entry_fields[entry.ref] ?? null;
  const namedProjection = entry.meta?.projection_ref ?? entry.projection_ref;
  const projections = snapshot.projections.filter((projection: any) => snapshot.projection_fields[projection.projection_ref] === field_ref && (
    projection.subject?.ref === entry.ref || projection.subject?.ref === entry.world_ref ||
    // Retained editions used the artifact's local alias as subject. Resolve
    // their explicitly named projection only within the attested source World.
    (projection.projection_ref === namedProjection && projection.source?.world_ref === entry.world_ref)
  ));
  const relations = snapshot.relations.filter((relation: any) => snapshot.relation_fields[relation.relation_ref] === field_ref && (relation.from === entry.ref || relation.to === entry.ref));
  let neighbourhood: any = null;
  try { neighbourhood = client.live.open(entry.ref, { depth: 1, budget: 24 }); } catch (error: any) { neighbourhood = { error: error?.message ?? String(error) }; }
  const contributions = contextualContributions(snapshot.contributions.filter((row: any) => row.field_ref === field_ref), [entry.ref, ...projections.map((projection: any) => projection.projection_ref)]);
  const relation_errors = snapshot.relation_errors.filter((row: any) => row.field_ref === field_ref || row.from === entry.ref || row.to === entry.ref);
  const my_authority = snapshot.my_authority.filter((row: any) => row.field_ref === field_ref);
  const participants = snapshot.participants.filter((row: any) => row.field_ref === field_ref);
  const owner_pending_contributions = snapshot.owner_pending_contributions.filter((row: any) => row.field_ref === field_ref);
  const my_watches = snapshot.my_watches.filter((row: any) => row.target_ref === entry.ref);
  return { schema: 'oi.shared-field.reading/v1', ref, state: 'hosted', target: snapshot.target, field_ref, entry, projections, relations, relation_errors, contributions, owner_pending_contributions, participants, neighbourhood, my_authority, my_watches, status: snapshot.status };
}

/** Push hosted reducer arguments (the `hostedPublicationArgs` shape) in
 * publish order under the caller's own authority, then wait until the
 * caller-visible view echoes the Projection row back. */
export async function publishArgs(client: Client, args: any) {
  const reducers: any = client.conn.reducers;
  const db: any = client.conn.db;
  const field = rows(db.sharedField).find((row: any) => row.fieldRef === args.putSharedField.fieldRef);
  if (!field) await reducers.putSharedField(args.putSharedField);
  else if (field.kind !== args.putSharedField.kind || field.visibility !== args.putSharedField.visibility) {
    throw new Error('Publication cannot redefine the native field kind or visibility; change the field through its owner first');
  }
  // Membership has its own owner and revision. An artifact edition must not
  // rewrite an admitted identity, profile or membership provenance.
  for (const participant of [args.putParticipant, ...(args.putParticipants ?? [])]) {
    const held = rows(db.participant).find((row: any) => row.participantRef === participant.participantRef);
    if (!held) await reducers.putParticipant(participant);
    else if (held.fieldRef !== participant.fieldRef || held.identityKind !== participant.identityKind || held.identityRef !== participant.identityRef) {
      throw new Error('Publication cannot redefine an admitted participant identity or field');
    }
  }
  await waitUntil(() => (args.putParticipants ?? []).every((participant: any) => rows(db.participant).some((row: any) => row.participantRef === participant.participantRef && row.fieldRef === participant.fieldRef)), 'additional Participants in the caller-visible view');
  const granted = rows(db.myFieldAuthority).find((row: any) => row.fieldRef === args.putSharedField.fieldRef && row.participantRef === args.putParticipant.participantRef && row.role === 'contributor' && !row.revoked);
  if (!granted) await reducers.grantParticipantAuthority({ fieldRef: args.putSharedField.fieldRef, participantRef: args.putParticipant.participantRef, targetIdentity: client.identity, role: 'contributor', contactable: true, ttlSeconds: 0 });
  const already = rows(db.projection).find((row: any) => row.projectionKey === args.putProjection.projectionKey);
  if (already && already.contractJson !== args.putProjection.contractJson) throw new Error('Projection revision conflict: the same immutable key already holds different material');
  if (!already) await reducers.putProjection(args.putProjection);
  for (const entry of args.putExploreEntries ?? []) await reducers.putExploreEntry(entry);
  for (const relation of args.putExploreRelations ?? []) await reducers.putExploreRelation(relation);
  const row = await waitUntil(() => rows(db.projection).find((candidate: any) => candidate.projectionKey === args.putProjection.projectionKey), `Projection ${args.putProjection.projectionKey} in the caller-visible view`);
  await waitUntil(() => (args.putExploreEntries ?? []).every((entry: any) => rows(db.exploreEntry).some((candidate: any) => candidate.semanticRef === entry.semanticRef && candidate.worldRef === entry.worldRef && candidate.fieldRef === entry.fieldRef && candidate.entryJson === entry.entryJson)), 'exact published entries in the caller-visible view');
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
