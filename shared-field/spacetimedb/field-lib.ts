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
import { execFile, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, fchmodSync, fstatSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
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
/** What a world asked another world's agent at a star, and what that agent answered (O-I #858, SF10): served to the two worlds alone,
 * so held whole at every aperture, subscribed on its own beside the worlds: a service that keeps none yet is read as it was, and says so. */
export const AGENT_ASK_SUBSCRIPTION = ['SELECT * FROM star_agent_ask'];
/** The asks the asked world's window settled (601c), in its words: the two worlds' alone, as the ask is, subscribed on its own beside the
 * asks, so a service that keeps no settling yet is read as it was. */
export const AGENT_ASK_SETTLE_SUBSCRIPTION = ['SELECT * FROM star_agent_ask_settle'];
export const HAND_ON_SUBSCRIPTION = ['SELECT * FROM star_hand_on'];
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
const NO_AGENT_ASKS = 'This field\'s service does not keep what is asked of a world\'s agent yet';
const NO_AGENT_ASK_SETTLES = 'This field\'s service does not keep an ask its agent\'s answer cannot reach yet';
const NO_HAND_ONS = 'This field\'s service does not hand stars on yet';
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
  /** whether the field keeps what is asked of a world's agent at a star (SF10) */
  agentAsks: WorldsHeld
  /** whether the field keeps the asks the asked world's window settled (601c) */
  agentSettles: WorldsHeld
  /** whether the field keeps a star being handed on (SF03) */
  handOns: WorldsHeld
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
  worldAnswers: WorldsHeld; watches: WorldsHeld; agentAsks: WorldsHeld; agentSettles: WorldsHeld; handOns: WorldsHeld; worldHandle?: any; withdrawalHandle?: any; contributionHandle?: any; worldAnswerHandle?: any }> {
  let worldHandle: any, withdrawalHandle: any, contributionHandle: any, worldAnswerHandle: any;
  const held = async (queries: string[], detail: string, keep?: (handle: any) => void): Promise<WorldsHeld> => {
    try { const handle = await subscribeQueries(conn, queries); keep?.(handle); return { state: 'held' }; } catch { return { state: 'unavailable', detail }; }
  };
  const worlds = await held(WORLD_SUBSCRIPTION, NO_WORLDS, (handle) => { worldHandle = handle; });
  if (worlds.state !== 'held') return { worlds, starDay: { state: 'unavailable', detail: NO_STAR_DAY }, sayings: { state: 'unavailable', detail: NO_SAYINGS }, works: { state: 'unavailable', detail: NO_WORKS }, answers: { state: 'unavailable', detail: NO_ANSWERS },
    withdrawals: { state: 'unavailable', detail: NO_WITHDRAWALS }, contributions: { state: 'unavailable', detail: NO_CONTRIBUTIONS }, worldAnswers: { state: 'unavailable', detail: NO_WORLD_ANSWERS },
    watches: { state: 'unavailable', detail: NO_WATCHES }, agentAsks: { state: 'unavailable', detail: NO_AGENT_ASKS }, agentSettles: { state: 'unavailable', detail: NO_AGENT_ASK_SETTLES },
    handOns: { state: 'unavailable', detail: NO_HAND_ONS } };
  const works = await held(STAR_WORK_SUBSCRIPTION, NO_WORKS);
  return { worlds, worldHandle, starDay: await held(STAR_DAY_SUBSCRIPTION, NO_STAR_DAY), sayings: await held(STAR_SAYING_SUBSCRIPTION, NO_SAYINGS), works,
    answers: works.state === 'held' ? await held(STAR_WORK_ANSWER_SUBSCRIPTION, NO_ANSWERS) : { state: 'unavailable', detail: NO_ANSWERS },
    withdrawals: await held(WORLD_WITHDRAWAL_SUBSCRIPTION, NO_WITHDRAWALS, (handle) => { withdrawalHandle = handle; }), withdrawalHandle,
    ...await holdContributions(),
    worldAnswers: await held(WORLD_ANSWER_SUBSCRIPTION, NO_WORLD_ANSWERS, (handle) => { worldAnswerHandle = handle; }), worldAnswerHandle,
    watches: await held(WORLD_WATCH_SUBSCRIPTION, NO_WATCHES), ...await holdAgentAsks(), handOns: await held(HAND_ON_SUBSCRIPTION, NO_HAND_ONS) };
  async function holdAgentAsks(): Promise<{ agentAsks: WorldsHeld; agentSettles: WorldsHeld }> {
    const agentAsks = await held(AGENT_ASK_SUBSCRIPTION, NO_AGENT_ASKS);
    return { agentAsks, agentSettles: agentAsks.state === 'held' ? await held(AGENT_ASK_SETTLE_SUBSCRIPTION, NO_AGENT_ASK_SETTLES) : { state: 'unavailable', detail: NO_AGENT_ASK_SETTLES } };
  }
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
  // the asks the asked world's window settled (601c), where the service keeps them
  const settles = client.agentSettles?.state === 'held' ? new Map(rows(db.starAgentAskSettle).map((row: any) => [row.askRef, row])) : new Map();
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
    // the service this reading came through (O-I #858 TX14: the transport's Carrier names it)
    target: { name: client.target.name, uri: client.target.uri, database: client.target.database },
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
    // what the caller's worlds asked another world's agent at a star, and what was asked of their own agents there (SF10): the two
    // worlds' alone; under each, once answered, the agent that answered, its words, the parts it answered from (a part named only while
    // the caller can see it) and the task its world offered there it points to
    // and, on an ask its agent's answer cannot reach, `settled`: the words the asked world's window settled it in (601c), and when
    agent_ask: client.agentAsks,
    agent_ask_settle: client.agentSettles ?? { state: 'unavailable', detail: NO_AGENT_ASK_SETTLES },
    agent_asks: client.agentAsks.state === 'held' ? rows(db.starAgentAsk).sort((a: any, b: any) => (BigInt(a.askedAtMicros) < BigInt(b.askedAtMicros) ? -1 : BigInt(a.askedAtMicros) > BigInt(b.askedAtMicros) ? 1 : a.askRef < b.askRef ? -1 : 1))
      .map((row: any) => agentAskRow(row, settles.get(row.askRef))) : [],
    // a star being handed on (SF03): read by the world handing it on and the world it is handed to alone
    star_hand_on: client.handOns,
    star_hand_ons: client.handOns.state === 'held' ? rows(db.starHandOn).sort((a: any, b: any) => (a.starRef < b.starRef ? -1 : 1))
      .map((row: any) => ({ star_ref: row.starRef, from_world_ref: row.fromWorldRef, to_world_ref: row.toWorldRef, at_micros: String(row.atMicros) })) : [],
    world_contribution: client.contributions,
    world_contributions: client.contributions.state === 'held' ? worldContributions(db, acceptedRows(client)) : [],
  };
}

/** One ask of a world's agent as the field client reads it (SF10). */
function agentAskRow(row: any, settled?: any) {
  const answer = row.answerJson ? parse(row.answerJson) : null;
  return { ask_ref: row.askRef, star_ref: row.starRef, world_ref: row.worldRef, to_world_ref: row.toWorldRef, by: row.by, address: row.address, words: row.words,
    asked_at_micros: String(row.askedAtMicros), settled: settled ? { words: settled.words, complete: true, settled_at_micros: String(settled.settledAtMicros) } : null,
    answer: answer && { agent: { name: answer.agent.name, role: answer.agent.role || null, instance: answer.agent.instance || null }, words: answer.words,
      cites: answer.cites.map((cite: any) => ({ part_ref: cite.part_ref || null, star_ref: cite.star_ref || null })), offer_ref: answer.offer_ref || null,
      answered_at_micros: String(row.answeredAtMicros) } };
}

/** What a world's agent is asked in at a star (SF10): the body of the Communique the asked world's window relays to it. */
export const WORLD_AGENT_ASK_SCHEMA = 'oi.world-agent-ask/v1';
/** What it answers in: the body of its reply Communique — its words, the parts of its world it answered from, and the task its world
 * offered at that star it points to, if any. */
export const WORLD_AGENT_ANSWER_SCHEMA = 'oi.world-agent-answer/v1';

/** The parts a world shows at an ask's star, and to the whole field or the public (and so there too), as the asked world's own window
 * reads its clearings: the ask's `sources`. They only narrow what its agent answers from: AIKit answers from its own record of what the
 * world shows (agentDiscloseRelay), and keeps of these only what that record holds (ai-kit #601). */
export function agentAskSources(ask: any, clearings: any[]): { part_ref: string; star_ref: string | null; kind: string | null; label: string | null }[] {
  return clearings.filter((c: any) => c.world_ref === ask.to_world_ref
    && ((c.star_ref ?? null) === ask.star_ref ? c.audience === 'star' : (c.star_ref ?? null) === null && (c.audience === 'field' || c.audience === 'public')))
    .map((c: any) => ({ part_ref: c.part_ref, star_ref: c.star_ref ?? null, kind: c.shown?.kind ?? null, label: c.shown?.label ?? null }));
}

/**
 * The relay of one ask to the asked world's agent, through AIKit's gateway (`aikit gateway send`, an `aikit.communique/v1`; O-I #858,
 * SF10): addressed as it was asked — by name to the agent's `@handle`, looked up in the world asked (`--project-world`), never in the
 * one the window's own folder stands in; by role to its world's Position `central:position:<world>:<role>`; or to the exact instance
 * running, bound with `--instance` at the Position `aikit gateway who --json` reads it occupying — with a body (`oi.world-agent-ask/v1`)
 * that carries the words asked and, as `sources`, what the asked world's window reads it showing at that star (agentAskSources). AIKit
 * draws the answer only from its own record of what the world shows there, and keeps of `sources` only what that record holds (ai-kit
 * #601; DLW build ruling 2026-11-09). A Communique runs nothing by itself and never becomes work on its own. Pure: the person's window
 * runs the argv (agentWindow, by runAikit's contract).
 */
export function agentAskRelay(ask: any, clearings: any[], who?: any): { argv: string[]; body: any } | { refused: string } {
  let to: string;
  const more: string[] = [];
  if (ask.by === 'name') {
    if (!qualifiedWorld(ask.to_world_ref)) return { refused: 'The world asked is not named whole, so its agent\'s name cannot be looked up in it' };
    to = `@${ask.address}`;
    more.push('--project-world', ask.to_world_ref);
  } else if (ask.by === 'role') to = `central:position:${ask.to_world_ref}:${ask.address}`;
  else if (ask.by === 'instance') {
    const at = (Array.isArray(who?.positions) ? who.positions : []).find((p: any) => p?.occupancy?.state === 'occupied' && p.occupancy.generation_ref === ask.address);
    if (!at) return { refused: 'That instance is not running at any Position AIKit reads' };
    to = at.position_ref;
    more.push('--instance', ask.address);
  } else return { refused: 'An agent is asked by its name, its role or the exact instance running' };
  const body = { schema: WORLD_AGENT_ASK_SCHEMA, ask_ref: ask.ask_ref, star_ref: ask.star_ref, asked_by_world_ref: ask.world_ref, world_ref: ask.to_world_ref,
    words: ask.words, sources: agentAskSources(ask, clearings), answer_in: WORLD_AGENT_ANSWER_SCHEMA };
  return { argv: ['aikit', 'gateway', 'send', '--to', to, ...more, '--body', JSON.stringify(body), '--json'], body };
}

/**
 * The answer request a reply Communique makes (O-I #858, SF10): the reply AIKit verified (`attribution: verified`) from the Position the
 * ask reached, in `oi.world-agent-answer/v1`, answers as that agent — its name the Position's `@handle` in the `who` reading, its role
 * that Position's own, its instance the generation that sent it. The field refuses what it answers from beyond what the world shows at
 * the star, and any work its world did not offer there.
 */
export function agentAnswerRequest(ask: any, reply: any, who?: any): { request: any } | { refused: string } {
  if (reply?.schema !== 'aikit.communique/v1') return { refused: 'An answer arrives as an AIKit Communique' };
  if (reply.attribution !== 'verified') return { refused: 'Only a reply AIKit verified answers for your world' };
  const position = typeof reply.from_position_ref === 'string' ? reply.from_position_ref : '';
  const prefix = `central:position:${ask.to_world_ref}:`;
  if (!position.startsWith(prefix)) return { refused: 'The reply came from no Position of the world asked' };
  const handle = (Array.isArray(who?.positions) ? who.positions : []).find((p: any) => p?.position_ref === position)?.handle;
  if (typeof handle !== 'string' || !handle.replace(/^@/, '')) return { refused: 'AIKit names no handle for the agent that answered' };
  let answer: any;
  try { answer = JSON.parse(reply.body); } catch { return { refused: `The reply is not an answer in ${WORLD_AGENT_ANSWER_SCHEMA}` }; }
  if (answer?.schema !== WORLD_AGENT_ANSWER_SCHEMA || typeof answer.words !== 'string') return { refused: `The reply is not an answer in ${WORLD_AGENT_ANSWER_SCHEMA}` };
  return { request: { kind: 'world-agent-answer', ask_ref: ask.ask_ref, world_ref: ask.to_world_ref,
    agent: { name: handle.replace(/^@/, ''), role: position.slice(prefix.length), instance: typeof reply.from_generation_ref === 'string' ? reply.from_generation_ref : '' },
    words: answer.words, cites: Array.isArray(answer.cites) ? answer.cites : [], ...(typeof answer.offer_ref === 'string' && answer.offer_ref ? { offer_ref: answer.offer_ref } : {}) } };
}

/** The line back to a sender with no Position (ai-kit #601): AIKit holds each reply to the window that relayed an ask there. */
export const SENDER_OF_PREFIX = 'aikit:sender-of:';
/** What `aikit gateway replies` answers: the replies to one Communique, read by its ref. */
export const COMMUNIQUE_REPLIES_SCHEMA = 'aikit.communique-replies/v1';
/** The ref AIKit names a Communique by. */
const COMMUNIQUE_REF_PREFIX = 'aikit:communique:';

/** How the window reads its agent's answers to an ask it relayed (ai-kit #601): by the ref `aikit gateway send` answered (its `data`),
 * never from an inbox, since the window stands at no Position. Pure: the window runs the argv. */
export function agentRepliesRelay(sent: any): { argv: string[]; communique_ref: string } | { refused: string } {
  const ref = sent?.communique?.communique_ref;
  if (typeof ref !== 'string' || !ref.startsWith(COMMUNIQUE_REF_PREFIX) || !plainRef(ref)) return { refused: 'AIKit named no ref for the ask it sent, so there is nothing to read its answers by' };
  return { argv: ['aikit', 'gateway', 'replies', ref, '--json'], communique_ref: ref };
}

/** What a replies reading holds for one relayed ask: always this one shape (601b ruling 5). */
export interface AgentReplies {
  /** each reply that answers, as the answer request it makes; `declined` when it is AIKit's one plain decline */
  answers: { request: any; declined: boolean }[];
  /** why each reply that could not be used was not, or why there was no reading to use; empty when nothing was refused */
  refused: string[];
  /** whether the reading covers everywhere an answer could be */
  complete: boolean;
  /** AIKit's own words while nothing has answered */
  waiting: string | null;
  /** AIKit ended the ask with no reply sent: its words, once the reading is complete */
  ended: string | null;
  /** where the ask was relayed could not be read, in plain words */
  unread: string | null;
  /** replies came and none could be used, and AIKit waits no more: the ask settles in these words */
  settled: string | null;
}

/**
 * The answers a replies reading holds for one relayed ask (ai-kit #601). `reading` is what `aikit gateway replies --json` printed (its
 * envelope) or that envelope's `data`. Each reply to that ask, held on the line back to the window, is made an answer request as
 * agentAnswerRequest makes it; any other reply answers nothing, and why is in `refused`. A decline (AIKit's one plain answer when the
 * agent could not answer from what the world shows there, `declined: true`) is carried as the answer it is, so the asker never waits on
 * it, and marked `declined` for the window. While nothing has answered, AIKit's own words for the wait are `waiting`. An ask AIKit ended
 * with no reply sent (a day waited with no occupant to answer it; ai-kit #602, DLW build ruling 2026-11-09) reads declined: its words are
 * `ended`, so the window never waits on it, and no answer is made up for an agent that said nothing. A reading that could not reach the
 * workcell the ask was relayed to is not "no answer": it is said, in plain words, `complete` is false, and nothing is ended on it. A
 * reading that could not be had is refused for its own cause (AIKit's words, where AIKit said no), with `complete` false. Replies none of
 * which could be used, once AIKit waits no more, settle the ask in words (601b ruling 2), so it never stands in no state.
 */
export function agentRepliesAnswers(ask: any, communiqueRef: string, reading: any, who?: any): AgentReplies {
  const unhad = (why: string): AgentReplies => ({ answers: [], refused: [why], complete: false, waiting: null, ended: null, unread: null, settled: null });
  if (reading?.ok === false) return unhad(`AIKit could not read its replies: ${String(reading.error?.message ?? reading.error?.code ?? 'it gave no reason')}`);
  if (reading?.ok === true && reading.data !== undefined) reading = reading.data;
  if (reading?.schema !== COMMUNIQUE_REPLIES_SCHEMA) return unhad(`AIKit's replies reading is ${COMMUNIQUE_REPLIES_SCHEMA}`);
  if (reading.communique_ref !== communiqueRef) return unhad('That reading is of another ask');
  const answers: { request: any; declined: boolean }[] = [];
  const refused: string[] = [];
  for (const reply of Array.isArray(reading.replies) ? reading.replies : []) {
    if (reply?.reply_to !== communiqueRef || reply?.to_position_ref !== SENDER_OF_PREFIX + communiqueRef) {
      refused.push('That reply is not a reply to this ask on the line back to your window');
      continue;
    }
    const made = agentAnswerRequest(ask, reply, who);
    if ('refused' in made) refused.push(made.refused);
    else answers.push({ ...made, declined: declinedReply(reply) });
  }
  const complete = reading.complete === true;
  const unread = !complete && reading.remote_replies?.state === 'unreadable'
    ? 'The workcell the ask was relayed to could not be read, so its answers may be waiting there'
    : null;
  const waiting = !answers.length && typeof reading.waiting === 'string' && reading.waiting.trim() ? reading.waiting : null;
  const words = reading.declined?.words;
  const ended = complete && !answers.length && typeof words === 'string' && words.trim() ? words : null;
  const settled = complete && !answers.length && refused.length && !waiting && !ended ? `Its agent's reply could not be read as an answer: ${refused[0]}` : null;
  return { answers, refused, complete, waiting, ended, unread, settled };
}
const declinedReply = (reply: any): boolean => { try { return JSON.parse(reply.body)?.declined === true; } catch { return false; } };

/** Whitespace as Rust's `char::is_whitespace` reads it (Unicode White_Space): JavaScript's `\s` adds U+FEFF and leaves out U+0085. */
const RUST_WHITESPACE = /[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/;
/** A control character as Rust's `char::is_control` reads it (Cc). */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
/** Half of a surrogate pair, alone: no character at all, so nothing an argv can carry as it is. */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const MAX_REF_BYTES = 512;
const MAX_LABEL_CHARS = 160;
const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8');

/** A ref as AIKit takes one (ai-kit `plain_ref`, gateway_world_agent.rs): non-empty, at most 512 bytes, no whitespace or control
 * character as Rust reads them; and never one that begins with a dash, which its command line would read as a flag (601b ruling 4). */
export function plainRef(ref: unknown): ref is string {
  return typeof ref === 'string' && ref.length > 0 && !ref.startsWith('-') && utf8Bytes(ref) <= MAX_REF_BYTES
    && !RUST_WHITESPACE.test(ref) && !CONTROL.test(ref) && !LONE_SURROGATE.test(ref);
}
/** A world named whole, as AIKit takes one (`qualified_world`): a plain ref of two or more components, none empty. */
export function qualifiedWorld(ref: unknown): ref is string {
  return plainRef(ref) && ref.split(':').length >= 2 && ref.split(':').every((part) => part.length > 0);
}
/** A label AIKit takes (`plain_label`): at most 160 characters, with no control character. */
const plainLabel = (label: unknown): label is string => typeof label === 'string' && label.length > 0 && [...label].length <= MAX_LABEL_CHARS
  && !CONTROL.test(label) && !LONE_SURROGATE.test(label);

/** Who the person's window tells AIKit it is (`aikit gateway disclose --by`, ai-kit #609; F11, DLW build ruling 2026-11-09): AIKit keeps
 * it with each part the window tells and lists it, and refuses the window a part another, or no one, told in the same place. */
export const WINDOW_TELLER = 'field-window';

/**
 * What the person's window tells AIKit its world shows (ai-kit #601, `aikit gateway disclose`, `aikit.world-star-disclosure/v1`), on each
 * Show and each Withdraw the field takes, and for each part star-leave and star-close take back (601b ruling 3): a part shown at a star
 * is recorded at that star, one shown to the field or the public at every star (`--field`), and a withdrawal takes back exactly the
 * clearing withdrawn. AIKit answers an ask of the world's agent at a star only from this record, never from what the ask says it saw (DLW
 * build ruling 2026-11-09). A world is named whole and each ref is one AIKit takes (plainRef); a star of '' is no star, as the field reads
 * it; a kind or label AIKit would refuse is left out, never the part. Each is told as the window's own (`--by field-window`, F11): AIKit keeps
 * the text a part has when it is told again with none, and takes back by this name only what the window told. Pure: the person's window
 * runs the argv (agentWindow, by runAikit's contract), after the field has taken the act.
 */
export function agentDiscloseRelay(request: any): { argv: string[] } | { refused: string } {
  if (request?.kind !== 'clearing-open' && request?.kind !== 'clearing-withdraw') return { refused: 'Only a Show or a Withdraw changes what your world shows' };
  if (!qualifiedWorld(request.world_ref)) return { refused: 'A world is told to AIKit by its whole ref' };
  if (!plainRef(request.part_ref)) return { refused: 'A part is told to AIKit by its own ref' };
  const star = request.star_ref || null;
  if (star !== null && !plainRef(star)) return { refused: 'A star is told to AIKit by its own ref' };
  const head = ['aikit', 'gateway', 'disclose', '--world', request.world_ref, '--part', request.part_ref];
  if (request.kind === 'clearing-withdraw') return { argv: [...head, ...(star ? ['--star', star] : ['--field']), '--withdraw', '--by', WINDOW_TELLER, '--json'] };
  const where = request.audience === 'star' ? (star ? ['--star', star] : null) : request.audience === 'field' || request.audience === 'public' ? (star ? null : ['--field']) : null;
  if (!where) return { refused: 'A part is shown at one star, or to the field or the public' };
  const kind = request.shown?.kind, label = request.shown?.label;
  // the label as one argument (`--label=…`), so words that begin with a dash stay words
  return { argv: [...head, ...where, ...(plainRef(kind) ? ['--kind', kind] : []), ...(plainLabel(label) ? [`--label=${label}`] : []), '--by', WINDOW_TELLER, '--json'] };
}

/** The program the window runs AIKit by (O-I #942 follow-ups 3 and 7): `OI_AIKIT_PROGRAM`, which the kernel sets when it launches the
 * held client, else `OI_AIKIT_BIN`, the name the installed app gives its AIKit, else `aikit` on the PATH. The name is trimmed. An
 * `OI_AIKIT_PROGRAM` set but blank, or a path that is not absolute, is refused in words and nothing is run: never an AIKit on the PATH by
 * accident. A blank `OI_AIKIT_BIN` names no AIKit, as the kernel reads it (knowledge.rs: an empty pin is none; 601d, review of #947
 * finding 7). Tests and walks point it at a fake, never at the machine's own AIKit (601b bound 4). */
export function aikitProgram(): { program: string } | { refused: string } {
  for (const name of ['OI_AIKIT_PROGRAM', 'OI_AIKIT_BIN']) {
    const named = process.env[name];
    if (named === undefined) continue;
    const program = named.trim();
    if (!program && name === 'OI_AIKIT_BIN') continue;
    if (!program) return { refused: `${name} is set but names no program, so AIKit was not run` };
    if (program.includes('/') && !isAbsolute(program)) return { refused: `${name} names ${program}, a path that is not absolute, so AIKit was not run` };
    return { program };
  }
  return { program: 'aikit' };
}
/** How long one AIKit run may take before the window stops it (601b bound 2). */
export const AIKIT_RUN_MS = 30_000;
/** How long a Show or a Withdraw waits for AIKit to be told before it answers: inside the host's limit for one client call (60 s, the
 * kernel's shared_field.rs CLIENT_CALL_LIMIT), however many tells wait ahead of it (#942 follow-up 1). */
export const TOLD_WITHIN_MS = 40_000;
/** How long a Show or a Withdraw may take from its arrival to its answer, however long the field's acts before it took: inside the host's
 * limit for one client call (60 s, the kernel's shared_field.rs CLIENT_CALL_LIMIT). The wait for AIKit to be told is what remains of it,
 * at most TOLD_WITHIN_MS (601d, review of #947 finding 8). */
export const ANSWER_WITHIN_MS = 55_000;

/** One AIKit run as the window reads it: AIKit's `data`, or what went wrong in words. `done` is false when nothing was done (AIKit
 * refused before it recorded anything, could not be started or was not run, or the window's own close stopped it) and null when it
 * cannot be known (AIKit refused without saying it kept nothing, or a run stopped at its limit, ended without an answer, or answered
 * unreadably). `sentNothing` marks a run that cannot be known but ended as a usage error does: its words say nothing was sent, and
 * `unknownArgument` is the argument AIKit's parser named as one it does not take, where it named one (601g ruling 8). `code` is the code
 * of AIKit's refusal. */
export type AikitRun = { ok: true; data: any } | { ok: false; done: false | null; words: string; sentNothing?: true; unknownArgument?: string; code?: string };
/** Whether a refusal kept nothing (keptNothing): AIKit's `details.recorded` where it says (601c ruling 3), "false" or "true" as AIKit renders
 * it (`aikit gateway send`, every refusal); where it does not, AIKit's own
 * words, in a refusal's `details.consequence`, that it kept nothing: `nothing_sent` and the refusal of a state held by an
 * unreachable service (ai-kit gateway_contact.rs l.1127-1129 and l.201, at 0348d944), and any consequence that begins as nothing_sent
 * does (one that adds a sentence to it, gateway_contact.rs l.775). A refusal after it kept a Communique (an exact-instance binding lost,
 * a forward that failed) says otherwise, so what it may have sent is never sent again (601b bound 1). */
const KEPT_NOTHING = new Set(['Nothing was sent; no Communique was recorded.', 'Nothing was read or written.']);
const NOTHING_SENT = 'Nothing was sent;';
/** The refusals AIKit makes before it records anything, by their code, though their details say nothing of it: an ask past the bound of
 * asks waiting (`agency_gateway.asks_waiting_full`, ai-kit gateway_communique.rs l.69-70 and l.998-1003, an `AikitError::new` whose
 * details are empty). Such an ask goes back to waiting and is offered again on the back-off; AIKit's own 24 h expiry frees the room it
 * waits for (#942 follow-up 2). */
const KEPT_NOTHING_CODES = new Set(['agency_gateway.asks_waiting_full']);
const keptNothing = (error: any): boolean => {
  // AIKit says in data whether a refusal kept anything (601c ruling 3): `details.recorded` decides it, whatever the words say. AIKit renders
  // every detail as a string (ai-kit json.rs failure: its details are a map of strings), so only "false" kept nothing; "true", and any value
  // that is neither (a JSON false among them, which AIKit never renders), counts as kept. An AIKit that does not say yet is read by its
  // words and codes, below.
  const details = error?.details;
  if (details && typeof details === 'object' && Object.prototype.hasOwnProperty.call(details, 'recorded')) return details.recorded === 'false';
  const consequence = String(details?.consequence ?? '');
  return KEPT_NOTHING.has(consequence) || consequence.startsWith(NOTHING_SENT) || KEPT_NOTHING_CODES.has(String(error?.code ?? ''));
};

/**
 * The one way the window runs AIKit (O-I #858, 601b ruling 1): the seams' argv as an array, its first word the program aikitProgram names,
 * by `execFile` with no shell, so no ref is ever read as a command; with `OI_POSITION_REF` and `OI_OCCUPANT_GENERATION` removed from its
 * environment, since the window stands at no Position and AIKit refuses the person's own acts from one that claims a Position
 * (`the_persons_own`); stopped by its own pid at `timeoutMs` (AIKIT_RUN_MS); and read as AIKit prints `--json`: one envelope on stdout,
 * `{ok: true, data}` or `{ok: false, error: {code, message, details}}` (ai-kit json.rs). A refusal did nothing only when AIKit says it
 * kept nothing (keptNothing). Never rejects: a failure is said in words.
 */
export function runAikit(argv: string[], options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<AikitRun> {
  const named = aikitProgram();
  if ('refused' in named) return Promise.resolve({ ok: false, done: false, words: named.refused });
  const program = named.program;
  const env = { ...process.env };
  delete env.OI_POSITION_REF;
  delete env.OI_OCCUPANT_GENERATION;
  const timeoutMs = options.timeoutMs ?? AIKIT_RUN_MS;
  const limit = timeoutMs >= 1000 ? `${Number((timeoutMs / 1000).toFixed(1))} s` : `${timeoutMs} ms`;
  if (options.signal?.aborted) return Promise.resolve({ ok: false, done: false, words: 'The window closed before AIKit was asked' });
  return new Promise((resolve) => {
    // the window's own close stops a run by SIGKILL as its limit does (execFile's own `signal` would send SIGTERM, which a run may ignore)
    let stopped = false;
    let stop = () => {};
    try {
      const child = execFile(program, argv.slice(1), { env, shell: false, timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024, encoding: 'utf8',
        windowsHide: true }, (error: any, stdout: string, stderr: string) => {
        options.signal?.removeEventListener('abort', stop);
        if (error?.code === 'ENOENT' || error?.code === 'EACCES') return resolve({ ok: false, done: false, words: `AIKit could not be started: ${program} was not found or cannot be run` });
        if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return resolve({ ok: false, done: null, words: 'AIKit said more than the window reads, and was stopped' });
        // what AIKit answered is what it did, though the window's close or the run's limit stopped it after (601d, review of #947 finding 9)
        const envelope = lastJson(stdout);
        if (envelope?.ok === true && envelope.data !== undefined) return resolve({ ok: true, data: envelope.data });
        if (envelope?.ok === false) {
          const code = typeof envelope.error?.code === 'string' && envelope.error.code ? { code: envelope.error.code } : {};
          return resolve({ ok: false, done: keptNothing(envelope.error) ? false : null, words: `AIKit refused: ${String(envelope.error?.message ?? envelope.error?.code ?? 'it gave no reason')}`, ...code });
        }
        // the window's own close, before AIKit answered: what it asked is offered again when a window opens again, and AIKit's replay takes
        // an identical ask still waiting as that ask (#942 follow-up 2)
        if (stopped) return resolve({ ok: false, done: false, words: 'The window closed while AIKit was asked, and the run was stopped' });
        if (error?.killed) return resolve({ ok: false, done: null, words: `AIKit did not answer within ${limit}, and was stopped` });
        // a usage error, as the CLI's parser ends one: 2, and no envelope (AIKit prints its own refusals as one, main.rs l.91-97)
        if (error?.code === 2 && !envelope) {
          const unknown = unknownArgument(stderr);
          return resolve({ ok: false, done: null, sentNothing: true, words: 'AIKit did not take what it was asked as it was given (it ended with 2, as a usage error does, and gave no answer), so nothing was sent',
            ...(unknown ? { unknownArgument: unknown } : {}) });
        }
        resolve({ ok: false, done: null, words: `AIKit gave no answer the window could read${typeof error?.code === 'number' ? ` (it ended with ${error.code})` : ''}` });
      });
      stop = () => { stopped = true; child.kill('SIGKILL'); };
      options.signal?.addEventListener('abort', stop, { once: true });
      child.stdin?.end();
    } catch (error: any) {
      resolve({ ok: false, done: false, words: `AIKit could not be started: ${error?.message ?? String(error)}` });
    }
  });
}
/** The argument a usage error names as one AIKit's parser does not take, as clap says it ("unexpected argument '--by' found"), or null. */
export function unknownArgument(stderr: unknown): string | null {
  return /unexpected argument '([^'\n]+)'/.exec(String(stderr ?? ''))?.[1] ?? null;
}
/** The envelope AIKit printed: its whole output, or its last line. */
function lastJson(stdout: string): any {
  const text = String(stdout ?? '').trim();
  try { return JSON.parse(text); } catch {}
  const last = text.split('\n').filter((line) => line.trim()).at(-1);
  try { return last ? JSON.parse(last) : null; } catch { return null; }
}
/** What a promise comes to within `ms`, else undefined. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(undefined); });
  });
}

/** What the window keeps of each ask it relayed (601b bound 1). */
export const AGENT_RELAY_SCHEMA = 'oi.shared-field.agent-relay/v1';
/** Where it keeps it: beside the field's binding, one record per field and identity. */
export function agentRelayFile(database: string, label = 'owner') {
  const state = process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi');
  return join(state, 'shared-field', label === 'owner' ? `${database}.agent-relay.json` : `${database}.${label}.agent-relay.json`);
}
/** How many asks the record keeps before it lets go of the oldest whose ask can never be relayed again (agentWindow's keptMost). */
const RELAY_KEPT = 1024;
/** One ask in the record. `window` names the window relaying or reading it (relayWindow), so another window keeping the same record
 * leaves it be while that window stands; `sent_nothing` marks an ask kept as unsure whose run said nothing was sent. */
type RelayEntry = { ask_ref: string; state: 'relaying' | 'sent' | 'unsure' | 'answered' | 'ended' | 'settled'; communique_ref?: string; words?: string; declined?: boolean;
  sent_nothing?: boolean; window?: string; at: number };
/** The tables whose moving can start or stop an ask's relay: its asks, the gatherings, the stars and the person's worlds. */
const ASK_TABLES = new Set(['star_agent_ask', 'star_agent_ask_settle', 'world_gathering', 'my_circle_gathering', 'shared_field', 'my_world']);
/** The tables whose rows say what the person's worlds show (the clearings, and which worlds are the person's): a transaction that moves
 * one sets AIKit's record of it right (601c ruling 6). The clearings move as `world_clearing` where the window holds the whole field, and
 * as `my_circle_clearing` where it holds the person's circle, as at the shell's default aperture (601d ruling 1). */
const SHOWN_TABLES = new Set(['world_clearing', 'my_circle_clearing', 'my_world']);
/** The tables whose change names a clearing by its key, `[world, part, star]` as JSON (the module's clearingKey). */
const CLEARING_TABLES = new Set(['world_clearing', 'my_circle_clearing']);
/** The world a clearing's change names, or null when its ref cannot be read as a clearing's key. */
function clearingWorld(ref: unknown): string | null {
  try { const key = JSON.parse(String(ref)); return Array.isArray(key) && typeof key[0] === 'string' ? key[0] : null; } catch { return null; }
}
/** The longest an ask AIKit did not take waits before it is offered again. */
const RETRY_MOST_MS = 30 * 60_000;
/** How far past a retry's time the wall clock must read before a pass run for another reason offers it without its timer (601c-CI2). */
const RETRY_LATE_MS = 1_000;
/** How many times an answer the field refuses is carried before the ask settles in words. */
const CARRIES = 3;
/** The words an ask is settled in, in the field: the window's own, of what happened, and nothing of AIKit's (#953's review, finding 4: a list
 * of what not to carry lets through what it does not name). AIKit's reason stays with the person, in the window's own lines. */
export function settleWords(entry: Pick<RelayEntry, 'state' | 'sent_nothing'>): string {
  if (entry.state === 'relaying') return 'It may have reached the world\'s agent, but its answer cannot be read: the window relaying it stopped before AIKit answered';
  if (entry.state === 'unsure') return entry.sent_nothing ? 'It was not passed to the world\'s agent' : 'It may have reached the world\'s agent, but its answer cannot be read';
  if (entry.state === 'settled') return 'Its agent\'s answer cannot reach it';
  return 'The world\'s agent cannot answer it';
}

/** The windows this process opened (relayWindow): each window's name is its pid, a count and, where it can be read, its process's start
 * (`<pid>:<count>@<start>`); those still open hold what they claimed. */
let windowsOpened = 0;
const OPEN_WINDOWS = new Set<string>();
/** Whether the window named still holds what it claimed in a record: one of this process's still open, or another process still running
 * that started when the window was named, so a pid the system gave again holds nothing (601d ruling 3; review of #947 finding 5). A name
 * without a start (a record kept before 601d) is held while its pid runs. */
function relayWindow(window: string | undefined): boolean {
  if (!window) return false;
  const pid = Number(window.split(':')[0]);
  if (pid === process.pid) return OPEN_WINDOWS.has(window);
  return stillRuns(pid, windowStart(window));
}
/**
 * The start a window's name gives (windowName), or null for a name with none. The name is `<pid>:<n>@<lstart>` where ps names the start
 * (macOS, and a window before 601g on Linux), and `<pid>:<n>#<start>` where it is read from /proc (Linux, 601g ruling 5). The `#` is on
 * purpose, and must not become `@`: a window of an older version, still running after an update, reads after `@` alone and reads that by
 * ps, so it would read a /proc start as another process's and take over every ask this window holds; with `#` it finds no start and goes
 * by the pid alone, as before 601d (601g's guard b, DLW build ruling 2026-11-09).
 */
function windowStart(window: string): string | null {
  const hash = window.indexOf('#');
  if (hash >= 0) return window.slice(hash + 1) || null;
  const at = window.indexOf('@');
  return at < 0 ? null : window.slice(at + 1) || null;
}
/** A window's name: its pid, which window of this process it is, and its start (windowStart says why the start's mark differs). */
const windowName = (n: number, start: string | null) => `${process.pid}:${n}${start ? `${start.startsWith(PROC_START) ? '#' : '@'}${start}` : ''}`;
function running(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error: any) { return error?.code === 'EPERM'; }
}
const PS = ['/bin/ps', '/usr/bin/ps'].find((one) => existsSync(one)) ?? null;
/** A start read from /proc (startOf): `proc:<boot id>:<ticks>`. */
const PROC_START = 'proc:';
const READS_PROC = process.platform === 'linux';
let bootRead: string | undefined;
/** This boot's id, read once: ticks since boot name one process only within one boot. '' where it cannot be read. */
const bootId = () => (bootRead ??= (() => { try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(); } catch { return ''; } })());
/** A process's start in its /proc/<pid>/stat line: field 22, starttime, in clock ticks since boot. The fields are counted after the last
 * `)`, since the command's name (field 2, in parentheses) may hold spaces and parentheses of its own; null when the line has none. */
export function procStart(stat: string): string | null {
  const close = stat.lastIndexOf(')');
  if (close < 0) return null;
  // field 3 (the state) is the first after the name, so field 22 is the twentieth
  const ticks = stat.slice(close + 1).trim().split(/\s+/)[19];
  return ticks !== undefined && /^\d+$/.test(ticks) ? ticks : null;
}
/**
 * When a process started, or null when it is not running or cannot be read. A pid with its start names one process: a process the system
 * gave that pid again started later (601d ruling 3).
 * - On Linux it is read from /proc/<pid>/stat (procStart), with this boot's id: ticks since boot, which no step of the wall clock moves.
 *   `ps lstart` there is the boot time plus those ticks, and the boot time it reckons moves when the clock is stepped (an NTP step, a
 *   resume), so a live holder's start read as another process's (601g ruling 5; #955's review, finding 8).
 * - Elsewhere (macOS) it is ps's lstart, from the start the kernel keeps, in the C locale and UTC, to the second. UTC, because lstart is
 *   local time: a window run under another TZ read a live holder's start as another process's (#953's review, finding 1).
 * `like` reads it the way a start named before was read: a name a window gave before 601g on Linux is an lstart, and is read by ps
 * still, so a record or a lock kept then is judged as it was meant.
 */
export function startOf(pid: number, like?: string | null): string | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  if (like ? like.startsWith(PROC_START) : READS_PROC) {
    try { const ticks = procStart(readFileSync(`/proc/${pid}/stat`, 'utf8')); return ticks ? `${PROC_START}${bootId()}:${ticks}` : null; } catch { return null; }
  }
  if (!PS) return null;
  try {
    return execFileSync(PS, ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2_000 }).trim() || null;
  } catch { return null; }
}
let ownStart: string | null | undefined;
/** This process's start, read once: when its first window opens (agentWindow), and in any case before a lock is made, never while one
 * this process made names no one (#953's review, finding 8). */
const myStart = () => (ownStart === undefined ? (ownStart = startOf(process.pid)) : ownStart);
/** How long a start read of another process stands before it is read again. */
const START_READ_MS = 5_000;
const startsRead = new Map<string, { start: string | null; at: number }>();
/** Whether the process a window or a lock names still runs: its pid runs and, where its start was named and can be read, it started then,
 * read the way it was named (startOf's `like`). */
function stillRuns(pid: number, start: string | null): boolean {
  if (!running(pid)) return false;
  if (!start) return true;
  const as = `${start.startsWith(PROC_START) ? 'proc' : 'ps'} ${pid}`;
  let read = startsRead.get(as);
  if (!read || Date.now() - read.at > START_READ_MS) { read = { start: startOf(pid, start), at: Date.now() }; startsRead.set(as, read); }
  return read.start === null || read.start === start;
}
const pauseSync = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
/** The record as it stands on disk: `{}` while there is none; throws when it cannot be read. */
function readRelay(file: string): Record<string, RelayEntry> {
  if (!existsSync(file)) return {};
  const held = JSON.parse(readFileSync(file, 'utf8'));
  if (held?.schema !== AGENT_RELAY_SCHEMA || !held.asks || typeof held.asks !== 'object' || Array.isArray(held.asks)) throw new Error(`it is not ${AGENT_RELAY_SCHEMA}`);
  return held.asks;
}
/** Write the record whole: to `<file>.next` (the lock's holder's alone), made the person's alone (0600), synced, then renamed over it, so
 * a reader finds the record before or after, never half of it; a write that fails leaves nothing beside it. */
function writeRelay(file: string, asks: Record<string, RelayEntry>) {
  const written = `${file}.next`;
  try {
    const fd = openSync(written, 'w', 0o600);
    try { fchmodSync(fd, 0o600); writeSync(fd, `${JSON.stringify({ schema: AGENT_RELAY_SCHEMA, asks }, null, 1)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(written, file);
  } catch (error) {
    rmSync(written, { force: true });
    throw error;
  }
}
/** How long a lock may name no holder (its holder between making it and naming itself in it) before it is stale. */
const LOCK_EMPTY_MS = 5_000;
/** The age past which a lock is stale whoever it names (601d ruling 3): a window holds it only to read and write the record once, never
 * this long; the backstop where a holder's start cannot be read. */
const LOCK_MOST_MS = 30_000;
/**
 * Run `then` holding the record's lock: `<file>.lock`, made with O_EXCL and naming its holder: its pid, its process's start and a nonce of
 * its own, new each time it is made (601d ruling 3; #953's review, finding 3), as `<pid> <nonce>` on the first line and the start on the
 * second (lockHolder says why). A lock is stale when the process it names runs no more, or is this one (which holds it only inside this
 * call), or is a process the system gave that pid again, started since; when it is older than LOCK_MOST_MS; or when it names no one past
 * LOCK_EMPTY_MS. A stale lock is taken over whole: first named for this window (`<lock>.taken.<inode>.<nonce>`, a hard link, which one
 * window alone can make), then let go only while what that name holds is still the lock judged stale, read whole, nonce and all, and stale
 * still: never a lock made anew meanwhile, though the file system gave it the same inode. A window that finds that name made leaves the
 * lock to the window taking it over (a name left by a window that died doing so goes after LOCK_EMPTY_MS), so two windows never both enter.
 * On a file system with no hard links a stale lock is never taken over: the window waits as for a live holder, and says why. A lock a
 * running window holds is waited for, a little. Throws when it cannot be had, in words of why.
 */
export function underLock<T>(file: string, then: () => T): T {
  const lock = `${file}.lock`;
  // its name, read before the lock is made, so the lock never names no one while this window reads it (#953's review, finding 8)
  const start = myStart();
  let held: Judged | null = null, cannotTake: string | null = null;
  for (let tries = 0; ; tries++) {
    if (tries >= 200) {
      throw new Error(cannotTake ? `its lock (${lock}) is stale, but this file system cannot hand it over (${cannotTake}), so the window waits for it as for a window still holding it: remove it if no window runs`
        : `its lock (${lock}) is held by another window`);
    }
    try {
      const fd = openSync(lock, 'wx', 0o600);
      try {
        const named = `${process.pid} ${randomBytes(12).toString('hex')}\n${start ?? ''}`;
        writeSync(fd, named);
        held = { ino: fstatSync(fd).ino, named, stale: false };
      } finally { closeSync(fd); }
      break;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
      const judged = lockJudged(lock);
      if (judged === null) continue;
      if (!judged.stale) { pauseSync(5); continue; }
      const taken = takeOver(lock, judged);
      if (taken !== true) { cannotTake = taken || cannotTake; pauseSync(5); }
    }
  }
  try { return then(); } finally { release(lock, held); }
}
/** A lock as it was read: its inode, what it names (read whole), and whether it is stale. */
type Judged = { ino: number; named: string; stale: boolean };
/** The lock as it stands (underLock), or a name for it: its inode, what it names and whether it is stale; null when it is gone. Read
 * through one descriptor, so what it names and its inode are one file's. */
function lockJudged(lock: string): Judged | null {
  let fd: number;
  try { fd = openSync(lock, 'r'); } catch { return null; }
  try {
    const seen = fstatSync(fd), named = readFileSync(fd, 'utf8');
    const { pid: holder, start } = lockHolder(named), age = Date.now() - seen.mtimeMs;
    const stale = !Number.isSafeInteger(holder) || holder <= 0 ? age > LOCK_EMPTY_MS : age > LOCK_MOST_MS || holder === process.pid || !stillRuns(holder, start);
    return { ino: seen.ino, named, stale };
  } catch { return null; } finally { closeSync(fd); }
}
/**
 * Who a lock names: its holder's pid, start and nonce. A lock this window makes is `<pid> <nonce>` on its first line and the start on its
 * second. The nonce shares the pid's line on purpose, and must not move to a line of its own: a window of an older version, still running
 * after an update, reads the first line as the pid alone, and the rest as the start (before #955 it read every line after the first as
 * one start, nonce and all; at #955 it read a /proc start, 601g ruling 5, by ps). Either way it would judge a live holder gone and take its
 * lock over. Reading `<pid> <nonce>` it finds no pid, so it judges the lock by its age alone (LOCK_EMPTY_MS) and waits, as a lock is held
 * for a moment only (601g's guard a, DLW build ruling 2026-11-09). A lock an older window made (its pid alone on the first line, its start
 * on the second, and from #955 its nonce on the third) is read as it was made.
 */
function lockHolder(named: string): { pid: number; start: string | null; nonce: string | null } {
  const [first = '', second = '', third = ''] = named.split('\n');
  const [pid = '', nonce = ''] = first.trim().split(/\s+/);
  return { pid: Number(pid || NaN), start: second.trim() || null, nonce: nonce || third.trim() || null };
}
/** The name a lock is taken over or let go under: its inode and its nonce, so one lock's name is never another's. */
const lockName = (lock: string, judged: Judged) => {
  const nonce = lockHolder(judged.named).nonce;
  return `${lock}.taken.${judged.ino}${nonce ? `.${nonce}` : ''}`;
};
/** Name a lock for this window (a hard link): true when it is named, false when it is gone or another window names it (one that died
 * doing so has its name taken back after LOCK_EMPTY_MS), and the error's code when the file system cannot link it. */
function nameLock(lock: string, taking: string): true | false | string {
  try { linkSync(lock, taking); return true; } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    if (error?.code === 'EEXIST') {
      // making a link marks the change time
      try { if (Date.now() - statSync(taking).ctimeMs > LOCK_EMPTY_MS) unlinkSync(taking); } catch {}
      return false;
    }
    return String(error?.code ?? error?.message ?? error);
  }
}
/** Take a stale lock over whole (underLock): name it for this window, and let it go only while what that name holds is the lock judged
 * stale, read whole, and stale still. True when it was let go or is gone; false when another window takes it over; the error's code when
 * the file system cannot name it, and then nothing is let go (#953's review, finding 3). */
function takeOver(lock: string, judged: Judged): true | false | string {
  const taking = lockName(lock, judged);
  const named = nameLock(lock, taking);
  if (named !== true) { if (named === false) pauseSync(2); return named === false ? !existsSync(lock) : named; }
  try {
    const now = lockJudged(taking);
    // Each of `now.stale` and `now.named === judged.named` is enough alone, and both are kept on purpose (601g ruling 6; #955's review,
    // finding 7, m7 and m8): a lock read whole as the one judged stale stays stale (its holder does not come back, nor its start change,
    // nor its age shrink), and a lock made anew under the same inode is let go only when it is stale itself, as any stale lock may be. The
    // one guards by which lock it is, the other by how it stands, so neither rests on the other's reasoning.
    if (now && now.stale && now.ino === judged.ino && now.named === judged.named) unlinkSync(lock);
  } catch {} finally { try { unlinkSync(taking); } catch {} }
  return true;
}
/** Let this window's own lock go (underLock): named for this window as a taker names it, and let go only while what that name holds is the
 * lock this window made, nonce and all; a lock another window took over from it (past LOCK_MOST_MS) and one made anew since are left. On a
 * file system with no hard links no window takes a lock over, so what the lock names is read and it is let go if it is still this one. */
function release(lock: string, held: Judged | null) {
  if (!held) return;
  const taking = lockName(lock, held);
  const named = nameLock(lock, taking);
  if (named === false) return;
  if (named !== true) { try { if (readFileSync(lock, 'utf8') === held.named) unlinkSync(lock); } catch {} return; }
  try { if (readFileSync(taking, 'utf8') === held.named) unlinkSync(lock); } catch {} finally { try { unlinkSync(taking); } catch {} }
}

/** What the window says, once, of an AIKit that refuses `--by` as an argument it does not take (601g ruling 8; #955's review, finding 9). */
export const OLD_AIKIT_WORDS = 'AIKit is older than this window; update it with `oi update`.';
/** AIKit's refusal of a tell, or a withdrawal by name, of a part another told, or no one (ai-kit #609 and #610). */
const NOT_ITS_TELLER = 'gateway.disclose_not_its_teller';
/** Who told a part AIKit lists, or null: told by hand, or before AIKit kept who told it (#609 keeps no teller for either). */
const tellerOf = (part: any): string | null => (typeof part?.teller === 'string' && part.teller ? part.teller : null);
/** One word of a command as the person types it into a POSIX shell: as it is when it holds nothing the shell reads, else single-quoted. */
const shellWord = (word: string) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`);
/** What the window says of a part AIKit holds as told by hand that the field does not show (601g ruling 1; #955's review, finding 1): the
 * window never takes it back, so the person is told it is still shown, and the command that takes it back. */
export function leftWords(world: string, part: string, star: string | null): string {
  const where = star ? ['--star', star] : ['--field'];
  const command = ['aikit', 'gateway', 'disclose', '--world', world, '--part', part, ...where, '--withdraw'].map(shellWord).join(' ');
  return `${part} is still shown to your agent at ${star ?? 'every star'}. It was told by hand, so this window leaves it. Take it back with \`${command}\`.`;
}

/**
 * The person's window runs the AIKit seams (O-I #858; ai-kit #601; 601b and 601c, DLW build ruling 2026-11-09). It runs in the held client
 * (`field.sh --held`), never in a one-shot run.
 *
 * - **What its worlds show** (`act`). The field's own acts go one at a time, in order. After each Show and Withdraw the field takes, and
 *   for each part of the person's own worlds that star-leave and star-close take back there, it runs agentDiscloseRelay's argv, in a queue
 *   of its own, in the order the field took the acts, ahead of any read; AIKit never holds the field's next act. A Show or a Withdraw
 *   answers what came of telling AIKit (`data.aikit`: `told`, `parts`, `words`), or, past `toldWithinMs`, that AIKit is still being told
 *   (`told: null`). A leave or a close answers once the field has acted, and AIKit is told afterwards. A failure is said in words, and the
 *   field's own act is not undone. A Withdraw of a part AIKit holds there as told by hand, which AIKit refuses the window, is said once
 *   to leave that part shown, with the command that takes it back (leftWords, 601g ruling 1), and its answer's words say the same. An
 *   AIKit that refuses `--by` as an argument it does not take is said once to be older than the window (OLD_AIKIT_WORDS, 601g ruling 8).
 * - **What AIKit holds of it, set right** (`reconcile`, 601c rulings 2 and 6: on the field going live, on a rebind, and on each
 *   transaction that moves a clearing or a world, at whichever aperture the window holds; never on a clearing of a world not the person's,
 *   nor, while AIKit is older than its list, on each move of the field). For each of the person's own worlds, what the field shows of it against what AIKit lists
 *   it holds (`aikit gateway disclose --list`), after every tell of the person's acts asked for before it: what the field shows and AIKit lacks is told
 *   (a part shown from the person's other device or before the window started, a tell that failed), and what AIKit holds and the field
 *   does not show is taken back (a star closed or a world turned away by the star's holder, a withdraw that failed). What AIKit holds as the
 *   field shows it is not told again. What cannot be set right now is said once and tried again at the slowing pace. The window sets right
 *   only the parts it told (F11, DLW build ruling 2026-11-09): a part AIKit lists as told by another, or by no one (by hand, or before
 *   AIKit kept who told it), is never withdrawn nor told again; where the field shows a part that such a teller holds in the same place,
 *   the window leaves it as it stands and says so once, and a part told by hand that the field no longer shows is said once to be shown
 *   still, with the command that takes it back (601g ruling 1). While AIKit is too old for `--by`, nothing is tried again at the slowing
 *   pace, nor on each move of the field (601g ruling 8).
 * - **Each ask of the person's own worlds** (`saw`, on the field going live and on each transaction that moves an ask, a gathering, a star
 *   or a world of theirs). While the ask waits at a star where its world is gathered, and once AIKit has been told what the field took of
 *   the person's acts, the window relays it once through agentAskRelay. The ask is claimed in the window's record (agentRelayFile) under
 *   its lock before it is sent, so it is relayed at most once, across restarts and across windows keeping the same record (the lock names
 *   its holder by pid and start, and is taken over whole: underLock); AIKit's own replay takes back only an identical ask still waiting. An
 *   ask another window still standing relays or reads is left to it, and looked at again at the retry's slowing pace (the base pace again
 *   once what is held changes), and on a move of the field at most once a step of the base pace, a move inside the step looking at its
 *   end, by its entry in the record alone, never by a reading of the field, so once that window is gone this one reads its replies
 *   within a step of the next move (601d ruling 4; #953's review, finding 2; 601g ruling 2). An ask AIKit refused before it recorded anything, could not start for, or that
 *   the window's own close stopped, is offered again later, at a slowing pace, when its own timer fires: never only by the wall clock,
 *   which can read short of a timer that fired (a Linux event loop keeps a coarse clock) or be set back, so no pass finds a retry early and
 *   drops it. A pass run for another reason (a move of the field, a wake) offers it too once the wall clock is clearly past its time, by
 *   RETRY_LATE_MS, as after a sleep the timer's own clock did not count; and a pass after a retry's timer that could not look at every ask
 *   (no field bound, the field, its asks or the record not read, a throw part way) leaves a look to come at the retry's pace (601c-CI2),
 *   slowing as a retry does while that lasts, a throw said once (#952's review).
 *   One whose send may have reached AIKit is never sent again, and is said.
 * - **Its replies**. The window reads them through agentRepliesRelay, one read at a time, backing off from `pace.first` to `pace.most`
 *   while nothing comes. An answer or a decline reaches the field as world-agent-answer, as the agent that sent it. Replies none of which
 *   can be used settle the ask in words, as does an ask AIKit ended or an answer the field refuses three times. The reads stop when the
 *   ask is settled, answered, taken back, its world leaves its star, the star closes, the field is unbound, or the window closes.
 * - **Endings** (an ask kept as unsure, ended or settled) are said, go out as `event` lines, `{event: 'agent-ask', ask_ref, state,
 *   words}`, and settle the ask in the field (world-agent-settle, 601c ruling 1) in words of why its agent's answer cannot reach it, so
 *   the world that asked reads it closed, and both worlds' lists of asks show it; one the field cannot settle now is tried again later.
 *   The words are the window's own, of what happened (settleWords); AIKit's reason is never carried into the field, and stays with the
 *   person, in the window's own lines (#953's review, finding 4).
 *
 * Every AIKit run goes through one queue, one at a time, by runAikit's contract (601c-CI and 601c-CI2, DLW build ruling 2026-11-09): the
 * tells of the person's own acts first, in order; every other run, the asks' and the reconcile's, in the order it was asked for. An ask
 * waits for the tells of the person's acts, and they never wait for a reconcile: each waits only for the tell before it. A reconcile pass
 * begins after the tells asked for before it, asks for one run at a time and never while the asks' pass is under way, and stops when an
 * act is taken in hand during it, a run of its own still queued then never running, to begin again after that act's tell, reading the
 * field anew. So an ask due waits behind at most the one reconcile run under way, whatever the person does meanwhile, and the reconcile
 * never acts on a reading an act of the person's has passed.
 */
export function agentWindow(options: {
  request: (request: any) => Promise<HeldEnvelope>;
  /** the record of the asks this window relayed, for the field bound now; null while none is bound */
  record: () => string | null;
  say?: (words: string) => void;
  /** each ask's ending, as the held client writes it for the shell */
  event?: (line: { event: 'agent-ask'; ask_ref: string; state: 'unsure' | 'ended' | 'settled'; words: string | null }) => void;
  pace?: { first?: number; most?: number; retry?: number };
  timeoutMs?: number;
  /** how long a Show or a Withdraw waits for AIKit to be told before it answers (TOLD_WITHIN_MS) */
  toldWithinMs?: number;
  /** how long a Show or a Withdraw may take from its arrival to its answer (ANSWER_WITHIN_MS) */
  answerWithinMs?: number;
  /** how many asks the record keeps before it lets go of the oldest that can never be relayed again (RELAY_KEPT) */
  keptMost?: number;
  /** whether AIKit's record of what the person's worlds show is set right against the field (rulings 2 and 6); on unless set false */
  reconcile?: boolean;
}) {
  const say = options.say ?? ((words: string) => { process.stderr.write(`SharedField window: ${words}\n`); });
  const ending = (ask_ref: string, state: 'unsure' | 'ended' | 'settled', words: string | null) => { options.event?.({ event: 'agent-ask', ask_ref, state, words }); };
  const first = options.pace?.first ?? 2_000, most = options.pace?.most ?? 60_000, retry = options.pace?.retry ?? 30_000;
  const toldWithin = options.toldWithinMs ?? TOLD_WITHIN_MS, answerWithin = options.answerWithinMs ?? ANSWER_WITHIN_MS, keptMost = options.keptMost ?? RELAY_KEPT;
  const started = myStart();
  const me = windowName(++windowsOpened, started);
  OPEN_WINDOWS.add(me);
  let closed = false;
  const stopping = new AbortController();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, then: () => void) => { const timer = setTimeout(() => { timers.delete(timer); then(); }, ms); timers.add(timer); return timer; };
  const spoken = new Set<string>();
  const once = (key: string, words: string) => { if (spoken.has(key)) return; spoken.add(key); say(words); };

  // ---- one AIKit run at a time: what the person did (a Show, a Withdraw) before any read ----
  /** a run asked for; `stale` (the reconcile's) passes it by, unrun, once what it was asked for on no longer stands (601c-CI2) */
  type Job = { argv: string[]; urgent: boolean; stale?: () => boolean; settle: (run: AikitRun) => void };
  const queue: Job[] = [];
  let running: Promise<void> | undefined;
  function enqueue(argv: string[], urgent = false, stale?: () => boolean): Promise<AikitRun> {
    if (closed) return Promise.resolve({ ok: false, done: false, words: 'The window closed before AIKit was asked' });
    return new Promise((settle) => {
      const job = { argv, urgent, stale, settle };
      const at = urgent ? queue.findIndex((queued) => !queued.urgent) : -1;
      if (at < 0) queue.push(job); else queue.splice(at, 0, job);
      pump();
    });
  }
  function pump() {
    while (!running && queue.length) {
      const job = queue.shift()!;
      if (job.stale?.()) { job.settle({ ok: false, done: false, words: 'An act of yours was taken in hand after it was asked for, so it was not run' }); continue; }
      running = runAikit(job.argv, { timeoutMs: options.timeoutMs, signal: stopping.signal })
        .then(job.settle, (error) => job.settle({ ok: false, done: null, words: String(error?.message ?? error) }))
        .finally(() => { running = undefined; pump(); });
    }
  }

  // ---- what the person's worlds show ----
  type Told = { told: boolean | null; parts: number; words: string | null };
  /** AIKit refused a tell as too old for `--by` (601g ruling 8): said once, plainly, and the reconcile asks nothing more of it until a tell
   * of the person's is taken, or the window goes live again; no retry at the slowing pace. */
  let byLacking = false;
  const tooOld = (ran: AikitRun): boolean => {
    if (ran.ok || ran.unknownArgument !== '--by') return false;
    byLacking = true;
    once('aikit too old', OLD_AIKIT_WORDS);
    return true;
  };
  /** A tell AIKit took: it takes `--by` (601g ruling 8), and a move of the field let pass meanwhile sets its record right now. */
  const tookBy = () => {
    if (!byLacking) return;
    byLacking = false;
    spoken.delete('aikit too old');
    if (missedMove && !listLacking) reconcile();
  };
  async function tell(acts: any[]): Promise<Told> {
    const missed: string[] = [], said: string[] = [];
    for (const act of acts) {
      const made = agentDiscloseRelay(act);
      const ran: AikitRun = 'refused' in made ? { ok: false, done: false, words: made.refused } : await enqueue(made.argv, true);
      if (ran.ok) { tookBy(); continue; }
      if (tooOld(ran)) { missed.push(OLD_AIKIT_WORDS); continue; }
      // a part the person told by hand that the field takes back: AIKit keeps it, and the window says so once (601g ruling 1)
      const left = act.kind === 'clearing-withdraw' && ran.code === NOT_ITS_TELLER ? await leftByHand(act) : null;
      if (left) { missed.push(left); continue; }
      missed.push(ran.words);
      said.push(ran.words);
    }
    if (said.length) say(`AIKit was not told what your world shows: ${said.join('; ')}`);
    return { told: !missed.length, parts: acts.length, words: missed.length ? missed.join('; ') : null };
  }
  /** A Withdraw AIKit refused as not the window's to take back (F11): what AIKit lists it holds there, and if it holds that part as told by
   * hand, the words that say so (leftWords), said once; null when it holds it as told by another, or its list cannot be read. */
  async function leftByHand(act: any): Promise<string | null> {
    if (!qualifiedWorld(act.world_ref)) return null;
    const listed = await enqueue(listArgv(act.world_ref), true);
    const record = listed.ok ? listed.data?.disclosure : null;
    if (record?.world_ref !== act.world_ref || !Array.isArray(record?.parts)) return null;
    const at = shownAt(act.part_ref, act.star_ref || null);
    const part = record.parts.find((one: any) => typeof one?.part_ref === 'string' && shownAt(one.part_ref, one.star_ref || null) === at);
    if (!part || tellerOf(part) !== null) return null;
    const words = leftWords(act.world_ref, act.part_ref, act.star_ref || null);
    once(`left ${act.world_ref}\n${at}`, words);
    return words;
  }
  /** The parts of the person's own worlds shown at the star an act leaves or closes, read before the field takes them back. */
  async function shownThere(request: any): Promise<any[] | string> {
    const read = await options.request({ kind: 'worlds' });
    if (!read.ok) return `What your world showed there could not be read, so AIKit was not told it is taken back: ${read.error.message}`;
    const reading: any = read.data;
    noteMine(reading);
    const mine = new Set((reading?.worlds ?? []).filter((world: any) => world.mine).map((world: any) => world.world_ref));
    return (reading?.clearings ?? []).filter((c: any) => c.star_ref === request.star_ref && mine.has(c.world_ref) && (request.kind === 'star-close' || c.world_ref === request.world_ref))
      .map((c: any) => ({ kind: 'clearing-withdraw', world_ref: c.world_ref, part_ref: c.part_ref, star_ref: c.star_ref }));
  }
  // the field's own acts, one at a time; what AIKit is told of them, in a queue of its own, in the order the field took them
  let acting: Promise<unknown> = Promise.resolve();
  /** the tell of the person's last act, which waited for the tell before it and for nothing else: never for a reconcile (601c-CI2) */
  let actsTold: Promise<unknown> = Promise.resolve();
  /** how many of the person's acts have been taken in hand: a reconcile pass under way when one more is stops (601c-CI2) */
  let actsTaken = 0;
  function act(request: any, take: () => Promise<HeldEnvelope>): Promise<HeldEnvelope> {
    const kind = request?.kind;
    if (kind !== 'clearing-open' && kind !== 'clearing-withdraw' && kind !== 'star-leave' && kind !== 'star-close') return take();
    const leaving = kind === 'star-leave' || kind === 'star-close', arrived = Date.now();
    actsTaken += 1;
    const acted = acting.then(async () => ({ back: leaving ? await shownThere(request) : [request], envelope: await take() }));
    acting = acted.catch(() => undefined);
    const told: Promise<Told | null> = Promise.all([acted, actsTold]).then(([{ back, envelope }]) => {
      if (!envelope.ok) return null;
      if (typeof back === 'string') { say(back); return { told: false, parts: 0, words: back }; }
      return tell(back);
    });
    actsTold = told.catch(() => undefined);
    return acted.then(async ({ back, envelope }): Promise<HeldEnvelope> => {
      if (!envelope.ok) return envelope;
      const aikit: Told = typeof back === 'string' ? { told: false, parts: 0, words: back }
        : leaving ? (back.length ? { told: null, parts: back.length, words: 'The field has acted; AIKit is told what it took back of your worlds after it, in order' } : { told: true, parts: 0, words: null })
        : (await within(told, Math.max(0, Math.min(toldWithin, answerWithin - (Date.now() - arrived))))) ?? { told: null, parts: back.length, words: 'The field took it; AIKit is still being told, in the order the field took your acts, and what comes of it is said then' };
      return { ok: true, data: { ...(envelope.data as object), aikit } };
    });
  }
  /** AIKit has been told what the field took of the person's acts (#942 follow-up 8); a reconcile is never waited for. */
  const toldAll = () => Promise.all([acting, actsTold]);
  /** Every act's tell asked for until now has run, acts asked for while waiting included: how many acts were taken in hand then, read in
   * the turn of the last check, so an act taken after it is one the reconcile stops for (#952's review, info 7). */
  async function actsAllTold(): Promise<number> {
    for (let told = actsTold; !closed; told = actsTold) { await Promise.all([acting, told]); if (told === actsTold) return actsTaken; }
    return actsTaken;
  }

  // ---- what AIKit holds of what the person's worlds show, set right against the field (601c rulings 2 and 6) ----
  const listArgv = (world: string) => ['aikit', 'gateway', 'disclose', '--list', '--world', world, '--json'];
  const shownAt = (part: string, star: unknown) => `${part}\n${typeof star === 'string' ? star : ''}`;
  let reconcileQueued = false, reconcileTries = 0;
  /** AIKit's last list ended as a usage error does (an AIKit older than the list): moves of the field start no pass until one lists
   * (601d, review of #947 finding 3) */
  let listLacking = false;
  /** a move of the field that would have set it right came while AIKit could not list: a pass follows once it can (601d) */
  let missedMove = false;
  /** the person's own worlds, as the last reading of the field said; null before one */
  let mineWorlds: Set<string> | null = null;
  const noteMine = (reading: any) => {
    if (Array.isArray(reading?.worlds)) mineWorlds = new Set(reading.worlds.filter((world: any) => world?.mine).map((world: any) => world.world_ref));
  };
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
  const reconcileLater = (wait: number) => {
    if (reconcileTimer) { clearTimeout(reconcileTimer); timers.delete(reconcileTimer); }
    reconcileTimer = wait < 0 ? undefined : later(wait, () => { reconcileTimer = undefined; reconcile(); });
  };
  /** the reconcile's passes, one at a time */
  let reconciling: Promise<unknown> = Promise.resolve();
  /** Set AIKit's record right, after every tell of the person's acts asked for before it: one pass waits at a time. A pass an act stops
   * begins again after that act's tell (601c-CI2). */
  function reconcile() {
    if (closed || options.reconcile === false || reconcileQueued) return;
    reconcileQueued = true;
    reconciling = reconciling.then(async () => {
      reconcileQueued = false;
      if (closed) return;
      missedMove = false;
      const right = await reconcileNow();
      if (closed || right === null) return;
      if (right === 'stopped') { reconcile(); return; }
      // an AIKit too old for --by is not asked again at the slowing pace (601g ruling 8): a tell of the person's that it takes, or the
      // window going live again, begins again
      if (right === 'old') { reconcileTries = 0; reconcileLater(-1); return; }
      if (right) { reconcileTries = 0; reconcileLater(-1); } else {
        reconcileTries += 1;
        reconcileLater(Math.min(retry * 2 ** (reconcileTries - 1), RETRY_MOST_MS));
      }
      // a move let pass while AIKit could not list, once it can: this pass may have read the field before it (601d)
      if (missedMove && !listLacking && !byLacking) reconcile();
    }).catch((error) => say(`What AIKit holds of what your worlds show could not be set right against the field: ${error?.message ?? error}`));
  }
  /**
   * One pass: for each of the person's own worlds, what the field shows of it (its clearings, as agentDiscloseRelay tells them, as each
   * Show's own tell does) against what AIKit lists it holds (`aikit gateway disclose --list`). A part the field
   * shows and AIKit lacks, or holds as the window told it under another kind or name, is told; one the window told that the field does
   * not show is taken back. A part AIKit holds as told by another, or by no one, is the person's own record and is left as it stands,
   * said once where the field shows it in the same place (F11); one AIKit holds as told by hand that the field does not show is said
   * once to be shown still, with the command that takes it back (leftWords, 601g ruling 1). Another's that the field does not show is
   * its teller's to set right, and nothing is said of it.
   * True when all was set right, false when something was not (said, and tried again later), null when no field is bound, 'stopped' when
   * an act of the person's was taken in hand during it (601c-CI2): it stops where it stands, and a run of its own still queued is never
   * run, so it never acts on a reading the act has passed, and no ask waits for the rest of it. 'old' when AIKit refused a tell as too old
   * for `--by` (said once, plainly: tooOld): it stops there, since every tell and withdrawal of the window's carries it.
   */
  async function reconcileNow(): Promise<boolean | null | 'stopped' | 'old'> {
    const since = await actsAllTold();
    if (closed) return null;
    const stopped = () => actsTaken !== since;
    /** a run of its own, asked for once no pass of the asks is under way, so an ask due waits behind at most one of them; never run stale */
    const run = async (argv: string[]): Promise<AikitRun | 'stopped' | null> => {
      while (looking && !closed && !stopped()) await looking;
      if (closed) return null;
      if (stopped()) return 'stopped';
      const ran = await enqueue(argv, false, stopped);
      return closed ? null : stopped() ? 'stopped' : ran;
    };
    if (!options.record()) return null;
    const read = await options.request({ kind: 'worlds' });
    if (closed) return null;
    if (stopped()) return 'stopped';
    if (!read.ok) return false;
    const reading: any = read.data;
    noteMine(reading);
    let right = true;
    for (const world of (reading?.worlds ?? []).filter((one: any) => one?.mine && qualifiedWorld(one.world_ref))) {
      const ref: string = world.world_ref;
      const shows = new Map<string, { argv: string[]; kind: string | null; label: string | null }>();
      for (const clearing of reading.clearings ?? []) {
        if (clearing?.world_ref !== ref) continue;
        const made = agentDiscloseRelay({ ...clearing, kind: 'clearing-open' });
        if ('refused' in made) continue;
        const kind = clearing.shown?.kind, label = clearing.shown?.label;
        shows.set(shownAt(clearing.part_ref, clearing.star_ref || null), { argv: made.argv, kind: plainRef(kind) ? kind : null, label: plainLabel(label) ? label : null });
      }
      const listed = await run(listArgv(ref));
      if (listed === null || listed === 'stopped') return listed;
      listLacking = !listed.ok && listed.sentNothing === true;
      const record = listed.ok ? listed.data?.disclosure : null;
      if (!listed.ok || record?.world_ref !== ref || !Array.isArray(record?.parts)) {
        once(`list ${ref}`, `What AIKit holds of what ${ref} shows could not be read, so it is not set right against the field now: ${listed.ok ? 'AIKit\'s answer is not its record of what that world shows' : listed.words}`);
        right = false;
        continue;
      }
      spoken.delete(`list ${ref}`);
      const held = new Map<string, any>(record.parts.filter((part: any) => typeof part?.part_ref === 'string').map((part: any) => [shownAt(part.part_ref, part.star_ref || null), part]));
      const missed: string[] = [];
      const othersNow = new Set<string>();
      for (const [at, shown] of shows) {
        const part = held.get(at);
        if (part && part.teller !== WINDOW_TELLER) {
          // the person's own record (by hand, or by another): never told over (F11)
          const key = `told by ${ref}\n${at}`;
          othersNow.add(key);
          const by = typeof part.teller === 'string' && part.teller ? `by ${part.teller}` : 'by hand';
          once(key, `AIKit holds ${part.part_ref} of ${ref}, shown ${part.star_ref ? `at ${part.star_ref}` : 'to the whole field'}, as told ${by}, not by this window: the window leaves it as it stands, and does not tell AIKit what the field shows of it there`);
          continue;
        }
        if (part && (part.kind ?? null) === shown.kind && (part.label ?? null) === shown.label) continue;
        const ran = await run(shown.argv);
        if (ran === null || ran === 'stopped') return ran;
        if (tooOld(ran)) return 'old';
        if (ran.ok) tookBy(); else missed.push(ran.words);
      }
      const leftNow = new Set<string>();
      for (const [at, part] of held) {
        if (shows.has(at)) continue;
        if (part.teller !== WINDOW_TELLER) {
          // told by hand, and shown no more by the field: AIKit still shows it, the window never takes it back, so it says so once (601g
          // ruling 1); one told by another is that teller's to set right
          if (tellerOf(part) !== null) continue;
          const key = `left ${ref}\n${at}`;
          leftNow.add(key);
          once(key, leftWords(ref, part.part_ref, part.star_ref || null));
          continue;
        }
        const made = agentDiscloseRelay({ kind: 'clearing-withdraw', world_ref: ref, part_ref: part.part_ref, star_ref: part.star_ref || null });
        const ran: AikitRun | 'stopped' | null = 'refused' in made ? { ok: false, done: false, words: made.refused } : await run(made.argv);
        if (ran === null || ran === 'stopped') return ran;
        if (tooOld(ran)) return 'old';
        if (ran.ok) tookBy(); else missed.push(ran.words);
      }
      // each said again should it come back once it has gone
      for (const key of [...spoken]) {
        if ((key.startsWith(`told by ${ref}\n`) && !othersNow.has(key)) || (key.startsWith(`left ${ref}\n`) && !leftNow.has(key))) spoken.delete(key);
      }
      if (missed.length) {
        say(`AIKit's record of what ${ref} shows was not all set right against the field; it is tried again later: ${missed.join('; ')}`);
        right = false;
      }
    }
    return right;
  }

  // ---- the record of what was relayed: read whole on each pass, changed only under its lock ----
  let inField: Set<string> | null = null;
  /** The record as it stands now; null, said once, while it cannot be read. */
  function kept(file: string): Record<string, RelayEntry> | null {
    try { return readRelay(file); } catch (error: any) {
      once(`record ${file}`, `The record of the asks this window relayed cannot be read (${file}), so it relays none until it can: ${error?.message ?? error}`);
      return null;
    }
  }
  /**
   * Keep an entry (or let it go) on disk before anything follows from it, reading the record again under its lock: 'kept'; 'theirs' when
   * `unless` finds the entry as it stands there taken already (another window claimed it); false, said once, while it cannot be kept.
   * Past keptMost the oldest entries whose ask can never be relayed again go: one answered, or one AIKit ended or the window settled once
   * its ask has left the field; never one still in the field (#942 follow-up 4).
   */
  function keep(file: string, key: string, entry: RelayEntry | null, unless?: (now: RelayEntry | undefined) => boolean): 'kept' | 'theirs' | false {
    try {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      const outcome = underLock(file, () => {
        const asks = readRelay(file);
        if (unless?.(asks[key])) return 'theirs' as const;
        if (entry) asks[key] = entry; else delete asks[key];
        const keys = Object.keys(asks);
        if (keys.length > keptMost) {
          const gone = (k: string) => asks[k].state === 'answered' || ((asks[k].state === 'ended' || asks[k].state === 'settled') && inField !== null && !inField.has(k));
          for (const k of keys.filter(gone).sort((a, b) => asks[a].at - asks[b].at).slice(0, keys.length - keptMost)) delete asks[k];
        }
        writeRelay(file, asks);
        return 'kept' as const;
      });
      spoken.delete(`kept ${file}`);
      return outcome;
    } catch (error: any) {
      once(`kept ${file}`, `The record of the asks this window relayed could not be kept (${file}), so nothing follows from it until it can be: ${error?.message ?? error}`);
      return false;
    }
  }
  const unsureWords = (ask_ref: string, words: string, sentNothing?: boolean) => sentNothing
    ? `${ask_ref} was not relayed, and is not offered again: ${words}`
    : `${ask_ref} may have reached AIKit, but its answers cannot be read, so it is not relayed again${words ? `: ${words}` : ''}`;

  // ---- each waiting ask of the person's worlds: relayed once, its replies read ----
  const readers = new Map<string, { file: string; stop: () => void }>();
  /**
   * A retry at the slowing pace: it is due when its own timer has fired. Never by the wall clock alone: a timer may fire while Date.now()
   * reads short of the moment it was set for (a Linux event loop reads a coarse clock behind it), and the wall clock may be set back, so
   * a pass that judged by it would find the retry early and drop it, with no timer left to look again (601c-CI). A pass run for another
   * reason offers it too once the wall clock is past its time by RETRY_LATE_MS (601c-CI2): after a sleep, which the timer's own clock does
   * not count, the first move of the field or wake offers it, never a wait of up to RETRY_MOST_MS more.
   */
  type Retry = { tries: number; waiting: boolean; at: number };
  const due = (retrying: Retry | undefined) => !retrying || !retrying.waiting || Date.now() > retrying.at + RETRY_LATE_MS;
  /** retry timers fired, and of them, those a pass that looked at every ask has seen since (601c-CI2) */
  let fired = 0, seen = 0;
  function backOff(after: Map<string, Retry>, key: string) {
    const tries = (after.get(key)?.tries ?? 0) + 1, wait = Math.min(retry * 2 ** (tries - 1), RETRY_MOST_MS);
    const retrying: Retry = { tries, waiting: true, at: Date.now() + wait };
    after.set(key, retrying);
    later(wait, () => { retrying.waiting = false; fired += 1; look(); });
  }
  const offerAfter = new Map<string, Retry>();
  const whoArgv = (world: string) => ['aikit', 'gateway', 'who', '--project-world', world, '--json'];
  let looking: Promise<void> | undefined;
  let again = false;
  let lookLater: ReturnType<typeof setTimeout> | undefined;
  /** looks to come armed since a pass last had nothing more to look for, and the words of the last throw said */
  let lookTries = 0, lookThrew: string | null = null;
  /** the asks the last whole pass left to another window still standing, and the clearings that pass read (601d ruling 4) */
  let heldByOthers = new Map<string, any>(), heldClearings: any[] = [];
  /** set while a move of the field may not look at those asks again: one step of the retry's base pace, never slowing (601g ruling 2;
   * #955's review, finding 2); a move inside it leaves one look at its end (`heldTrailing`), never none */
  let heldQuiet: ReturnType<typeof setTimeout> | undefined, heldTrailing = false;
  /** each ask left to another window, with its entry's state and the window that holds it, as last looked at */
  let heldAs = '';
  /** The asks left to other windows now, by their entries. Once they change (one held anew, one taken up or ended, its entry moved on or
   * held by another window), the look to come is at the retry's base pace again, never the pace a window standing long slowed it to
   * (601g ruling 2). */
  function holdNow(held: Map<string, any>, entries: Map<string, RelayEntry | undefined>) {
    heldByOthers = held;
    const now = [...entries].map(([key, entry]) => JSON.stringify([key, entry?.state ?? null, entry?.window ?? null, entry?.communique_ref ?? null])).sort().join('\n');
    if (now === heldAs) return;
    heldAs = now;
    lookTries = 0;
    if (lookLater) { clearTimeout(lookLater); timers.delete(lookLater); lookLater = undefined; }
  }
  /** One look to come at the retry's pace, slowing as a retry does while what it waits for lasts (#952's review), unless one is armed. */
  function lookAgain() {
    if (lookLater) return;
    const wait = Math.min(retry * 2 ** lookTries, RETRY_MOST_MS);
    lookTries += 1;
    lookLater = later(wait, () => { lookLater = undefined; look(); });
  }
  function look() {
    if (closed) return;
    if (looking) { again = true; return; }
    const owed = fired;
    looking = pass().then((whole) => { if (whole) { seen = Math.max(seen, owed); lookThrew = null; } })
      .catch((error) => {
        const words = String(error?.message ?? error);
        if (words !== lookThrew) say(`The asks of your worlds' agents could not be read: ${words}`);
        lookThrew = words;
      })
      .finally(() => {
        looking = undefined;
        if (closed) return;
        if (again) { again = false; look(); return; }
        // a retry's timer fired and no pass since could look at every ask (601c-CI2), or an ask was left to another window still standing
        // (601d ruling 4): one look to come, at the retry's pace, slowing as a retry does while that lasts (#952's review)
        if (seen >= fired && !heldByOthers.size) { lookTries = 0; return; }
        lookAgain();
      });
  }
  /** A clearing's change names its world: one not the person's, by the last reading, shows nothing of theirs (601d, review of #947 finding
   * 3); a ref that cannot be read, a change before any reading, and every other table's, count. */
  const shownMine = (change: any) => {
    if (!CLEARING_TABLES.has(change?.table) || !mineWorlds) return true;
    const world = clearingWorld(change.ref);
    return world === null || mineWorlds.has(world);
  };
  /**
   * A move of the field while another window holds asks of the person's worlds (601d ruling 4): their entries in the record are looked at
   * alone, never the field, at most once a step of the retry's base pace however many moves come (#953's review, finding 2), and never
   * slower: a move inside the step leaves one look at its end, so an ask whose window is gone is taken up within a step of the move,
   * however long that window stood (601g ruling 2; #955's review, finding 2). A move while a whole pass is under way leaves the asks to
   * that pass, which looks at them itself. An ask whose window stands no more is taken up as a whole pass would, from what that pass read.
   */
  function lookHeld() {
    if (closed || !heldByOthers.size) return;
    if (heldQuiet) { heldTrailing = true; return; }
    if (looking) return;
    heldTrailing = false;
    heldQuiet = later(retry, () => { heldQuiet = undefined; if (heldTrailing) { heldTrailing = false; lookHeld(); } });
    looking = (async () => {
      const file = options.record();
      const asks = file ? kept(file) : null;
      if (!file || !asks) return;
      const still = new Map<string, any>(), entries = new Map<string, RelayEntry | undefined>();
      for (const [key, ask] of heldByOthers) {
        if (closed) return;
        if (await lookAt(file, key, ask, asks[key], heldClearings)) { still.set(key, ask); entries.set(key, asks[key]); }
      }
      holdNow(still, entries);
    })().catch((error) => say(`The asks of your worlds' agents another window held could not be looked at: ${error?.message ?? error}`))
      .finally(() => {
        looking = undefined;
        if (closed) return;
        if (again) { again = false; look(); return; }
        if (heldByOthers.size || seen < fired) lookAgain();
      });
  }
  function saw(line: any) {
    if (closed || !line || typeof line !== 'object') return;
    if (line.event === 'status' && line.state === 'live') { look(); reconcile(); return; }
    if (line.event !== 'transaction') return;
    const changes = Array.isArray(line.changes) ? line.changes : [], more = Number(line.more) > 0;
    if (more || changes.some((change: any) => ASK_TABLES.has(change?.table))) look();
    else lookHeld();
    // an AIKit older than the list is asked again at the slowing pace, on going live and on a rebind, never on each move (601d); one older
    // than --by on going live, on a rebind, and once a tell of the person's is taken (601g ruling 8)
    if (more || changes.some((change: any) => SHOWN_TABLES.has(change?.table) && shownMine(change))) { if (listLacking || byLacking) missedMove = true; else reconcile(); }
  }
  /** One look at every ask waiting of the person's worlds: true when it looked at each, false when it could not (601c-CI2). */
  async function pass(): Promise<boolean> {
    await toldAll();
    if (closed) return false;
    const file = options.record();
    // unbound, or bound to another field: the reads of the record before stop
    for (const reader of [...readers.values()]) if (reader.file !== file) reader.stop();
    if (!file) return false;
    const read = await options.request({ kind: 'worlds' });
    if (closed || !read.ok) return false;
    const reading: any = read.data;
    noteMine(reading);
    if (reading?.agent_ask?.state !== 'held' || !Array.isArray(reading.agent_asks)) return false;
    inField = new Set(reading.agent_asks.map((ask: any) => `${ask?.ask_ref}@${ask?.asked_at_micros}`));
    const mine = new Set((reading.worlds ?? []).filter((world: any) => world.mine).map((world: any) => world.world_ref));
    const gathered = new Set((reading.gatherings ?? []).filter((g: any) => g.state === 'gathered').map((g: any) => `${g.star_ref}\n${g.world_ref}`));
    const waiting = new Map<string, any>();
    for (const ask of reading.agent_asks) {
      if (mine.has(ask?.to_world_ref) && !ask.answer && !ask.settled && gathered.has(`${ask.star_ref}\n${ask.to_world_ref}`)) waiting.set(`${ask.ask_ref}@${ask.asked_at_micros}`, ask);
    }
    // the reads stop for each ask that waits here no more: answered, taken back, its star closed or left, or no world of this person's
    for (const [key, reader] of [...readers]) if (!waiting.has(key)) reader.stop();
    const asks = kept(file);
    if (!asks) return false;
    const held = new Map<string, any>(), entries = new Map<string, RelayEntry | undefined>();
    for (const [key, ask] of waiting) {
      if (closed) return false;
      if (await lookAt(file, key, ask, asks[key], reading.clearings ?? [])) { held.set(key, ask); entries.set(key, asks[key]); }
    }
    holdNow(held, entries);
    heldClearings = reading.clearings ?? [];
    return true;
  }
  /** One waiting ask, by its entry in the record: relayed, read, or settled. True when another window keeping this record relays it, or
   * reads its answers, while it stands: it is left to that window, and looked at again (601d ruling 4). */
  async function lookAt(file: string, key: string, ask: any, entry: RelayEntry | undefined, clearings: any[]): Promise<boolean> {
    if (entry && (entry.state === 'relaying' || entry.state === 'sent') && entry.window !== me && relayWindow(entry.window)) return true;
    if (!entry) { if (due(offerAfter.get(key))) await relay(file, key, ask, clearings); }
    else if (entry.state === 'sent' && entry.communique_ref) {
      if (readers.has(key)) return false;
      // one window reads it: this one takes it over, under the lock, from the window that sent it and stands no more
      if (entry.window !== me && keep(file, key, { ...entry, window: me }, (now) => now?.state !== 'sent' || now.window !== entry.window) !== 'kept') return false;
      readFrom(file, key, ask, entry.communique_ref);
    } else if (entry.state === 'relaying' || entry.state === 'unsure') {
      once(key, unsureWords(ask.ask_ref, entry.words ?? '', entry.sent_nothing));
      await settleInField(key, ask, entry);
    } else if (entry.state === 'ended' || entry.state === 'settled') await settleInField(key, ask, entry);
    return false;
  }
  /**
   * Settle in the field an ask this window ended (601c ruling 1): the world that asked reads it closed, in the window's words of why its
   * agent's answer cannot reach it, never as the agent. One the field cannot settle now is said once and tried again on a later pass,
   * at the retry's slowing pace (backOff); one already in the field settled, answered or taken back no longer waits, so it is not tried.
   */
  const settleAfter = new Map<string, Retry>();
  async function settleInField(key: string, ask: any, entry: RelayEntry) {
    if (closed || !due(settleAfter.get(key))) return;
    // the window's own words of what happened, never AIKit's: its reason is said to the person alone (#953's review, finding 4)
    const done = await options.request({ kind: 'world-agent-settle', ask_ref: ask.ask_ref, words: settleWords(entry) });
    if (done.ok || closed) { settleAfter.delete(key); return; }
    backOff(settleAfter, key);
    once(`settle ${key}`, `${ask.ask_ref} could not be settled in the field, so the world that asked reads it waiting still; it is tried again later: ${done.error.message}`);
  }
  /** Offer the ask again later, at a slowing pace; words null when they were said already. */
  function notYet(key: string, ask: any, words: string | null) {
    if (closed) return;
    backOff(offerAfter, key);
    if (words) say(`${ask.ask_ref} was not relayed to its agent, and is offered again later: ${words}`);
  }
  async function relay(file: string, key: string, ask: any, clearings: any[]) {
    await toldAll();
    if (closed) return;
    let who: any;
    if (ask.by === 'instance') {
      if (!qualifiedWorld(ask.to_world_ref)) return notYet(key, ask, 'The world asked is not named whole');
      const named = await enqueue(whoArgv(ask.to_world_ref));
      if (closed) return;
      if (!named.ok) return notYet(key, ask, named.words);
      who = named.data;
    }
    const made = agentAskRelay(ask, clearings, who);
    if ('refused' in made) return notYet(key, ask, made.refused);
    // claimed in the record under its lock before it is sent: an ask is relayed at most once, across restarts and windows (601b bound 1)
    const claimed = keep(file, key, { ask_ref: ask.ask_ref, state: 'relaying', window: me, at: Date.now() }, (now) => now !== undefined);
    if (claimed === 'theirs') return;
    if (!claimed) return notYet(key, ask, null);
    const sent = await enqueue(made.argv);
    if (sent.ok) {
      const line = agentRepliesRelay(sent.data);
      if ('refused' in line) {
        const entry: RelayEntry = { ask_ref: ask.ask_ref, state: 'settled', words: line.refused, at: Date.now() };
        keep(file, key, entry);
        say(`${ask.ask_ref}: ${line.refused}`);
        ending(ask.ask_ref, 'settled', line.refused);
        return settleInField(key, ask, entry);
      }
      keep(file, key, { ask_ref: ask.ask_ref, state: 'sent', communique_ref: line.communique_ref, window: me, at: Date.now() });
      if (!closed) readFrom(file, key, ask, line.communique_ref);
    } else if (sent.done === false) {
      keep(file, key, null);
      if (closed) return say(`${ask.ask_ref} was being relayed when the window closed; it is offered again when the window opens again`);
      notYet(key, ask, sent.words);
    } else {
      const entry: RelayEntry = { ask_ref: ask.ask_ref, state: 'unsure', words: sent.words, ...(sent.sentNothing ? { sent_nothing: true } : {}), at: Date.now() };
      keep(file, key, entry);
      const words = unsureWords(ask.ask_ref, sent.words, sent.sentNothing);
      once(key, words);
      ending(ask.ask_ref, 'unsure', words);
      await settleInField(key, ask, entry);
    }
  }
  function readFrom(file: string, key: string, ask: any, ref: string) {
    const line = agentRepliesRelay({ communique: { communique_ref: ref } });
    if ('refused' in line) return;
    let wait = first, stopped = false, carried = 0, last: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reader = { file, stop() { stopped = true; if (timer) { clearTimeout(timer); timers.delete(timer); } if (readers.get(key) === reader) readers.delete(key); } };
    readers.set(key, reader);
    const settle = (entry: Pick<RelayEntry, 'state'> & Partial<RelayEntry>, words?: string) => {
      const closing: RelayEntry = { ask_ref: ask.ask_ref, communique_ref: ref, at: Date.now(), ...entry };
      keep(file, key, closing);
      if (words) say(`${ask.ask_ref}: ${words}`);
      reader.stop();
      if (closing.state === 'ended' || closing.state === 'settled') { ending(ask.ask_ref, closing.state, closing.words ?? null); return settleInField(key, ask, closing); }
    };
    const sayOnce = (words: string) => { if (words !== last) say(`${ask.ask_ref}: ${words}`); last = words; };
    const next = () => { if (stopped || closed) return; timer = later(wait, () => { timer = undefined; void read().catch(lost); }); wait = Math.min(most, wait * 2); };
    // a reading that throws is said and read on later, never an unhandled rejection (#942 follow-up 8)
    const lost = (error: any) => { if (stopped || closed) return; sayOnce(`its answers could not be read now: ${error?.message ?? error}`); next(); };
    const read = async () => {
      if (stopped || closed) return;
      const got = await enqueue(line.argv);
      if (stopped || closed) return;
      if (!got.ok) { sayOnce(`its answers could not be read now: ${got.words}`); return next(); }
      let who: any;
      if (Array.isArray(got.data?.replies) && got.data.replies.length) {
        // its agent's handle, read in the world asked; a reading not had now is no answer refused
        const named = qualifiedWorld(ask.to_world_ref) ? await enqueue(whoArgv(ask.to_world_ref)) : null;
        if (stopped || closed) return;
        if (named && !named.ok) { sayOnce(`who answered could not be read now: ${named.words}`); return next(); }
        who = named?.data;
      }
      const result = agentRepliesAnswers(ask, ref, got.data, who);
      const answer = result.answers[0];
      if (answer) {
        const carriedTo = await options.request(answer.request);
        if (carriedTo.ok) return settle({ state: 'answered', declined: answer.declined });
        if (stopped || closed) return;
        if (carriedTo.error.kind === 'refused' && ++carried >= CARRIES) {
          return settle({ state: 'settled', words: `Its agent's answer was refused by the field: ${carriedTo.error.message}` }, `its agent's answer was refused by the field: ${carriedTo.error.message}`);
        }
        sayOnce(`its agent's answer could not be carried to the field now: ${carriedTo.error.message}`);
        return next();
      }
      if (result.settled) return settle({ state: 'settled', words: result.settled }, result.settled);
      if (result.ended) return settle({ state: 'ended', words: result.ended }, `AIKit ended it: ${result.ended}`);
      if (!result.complete) sayOnce(result.unread ?? result.refused[0] ?? 'its answers could not all be read');
      next();
    };
    next();
  }

  return Object.freeze({
    act,
    saw,
    /** Read the field's asks now. */
    look,
    /** Set AIKit's record of what the person's worlds show right against the field now (601c rulings 2 and 6). */
    reconcile,
    /** The window closes: every read stops, nothing more is asked of AIKit, and a run under way is stopped. */
    async close() {
      closed = true;
      OPEN_WINDOWS.delete(me);
      for (const reader of [...readers.values()]) reader.stop();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const job of queue.splice(0)) job.settle({ ok: false, done: false, words: 'The window closed before AIKit was asked' });
      stopping.abort();
      await Promise.allSettled([running, looking, acting, actsTold, reconciling]);
    },
  });
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
  'world-contribute', 'world-claim-same', 'world-contribution-accept', 'world-contribution-refuse', 'world-contribution-take-back', 'world-watch', 'world-unwatch',
  'world-agent-ask', 'world-agent-answer', 'world-agent-unask', 'star-hand-on', 'star-keep', 'star-take-on']);
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
  ['starAgentAsk', 'star_agent_ask', 'askRef'], ['starAgentAskSettle', 'star_agent_ask_settle', 'askRef'], ['starHandOn', 'star_hand_on', 'starRef'],
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

/** What the World says while its held field's service does not answer (O-I #858 TX14): plain words, what happens next and what
 * still stands, never the transport's raw cause. */
export const FIELD_LOST = 'The SharedField is not reachable now. It comes back on its own once its service answers again; your world goes on here meanwhile.';

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
      // the person reads it in plain words; the transport's own cause (`detail`: "fetch failed", a URI, a timeout) stays in this
      // client's status line, for whoever looks into the service (O-I #858 TX14)
      if (!held || state !== 'live') return { ok: false, error: { kind: 'unavailable', message: FIELD_LOST } };
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
