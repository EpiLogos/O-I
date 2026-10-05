/**
 * The Factory Live producer loop (FX-C2): follow a Run's native events and
 * perform them into the Run's act.
 *
 * Each pass is paced by the owner's own change signal — a bounded
 * `factory telemetry watch --resume` (a prepared kernel read, outside the
 * kernel lock). The expensive reads are gated: the attempt reading and
 * custody only when the watch cursor moved; the Gateway population every few
 * passes; Communiques (one `conversation` per cast pair) only when the
 * population shows the cast's undelivered counts moved. Each participant's
 * encounter journal is read after its cursor. A failing pass backs off
 * exponentially (capped at 15 s).
 *
 * Every event goes through the checked event map (eventMap.ts) to act
 * operations; each operation's material comes from the Run's repertoire
 * (repertoire.ts) and is sent through the Expression-world helpers
 * (src/expression/world.ts). An act refusal that is a revision race
 * (`revision_conflict`, `act_revision_conflict`, `material_revision_changed`)
 * is answered by re-reading the act (`act_inspect`) and retrying once with the
 * fresh `expected_act_revision` / `expected_revision`.
 *
 * Exactly once: the follow cursor is rebuilt from the act itself — on
 * `act_open` (an idempotent resume) the act's recorded passages name every
 * occurrence already performed (`event_basis.event_ref` + `occurrence`) and
 * each journal's position (`event_basis.journal`), so reopening Live never
 * re-appends history. Every operation is deduped by that key before any
 * world request. A first open performs a bounded catch-up: the latest state
 * per cast member and the last few journal events, never whole journals.
 *
 * Late arrivals (a new participant, a returned artifact) are added to the
 * Run's Expression (`syncExpression`) and to the act's cast (`act_open` again
 * with the updated cast — idempotent resume).
 *
 * The passage cap: the kernel refuses a Scene/gesture passage at its limit
 * (`act_passage_limit`). The producer then opens a successor act
 * (`<run act ref>:<n+1>`, same Expression, cast, subject and instrument,
 * summary "continues <previous>"), records `live.rollover` on the old act
 * when it still accepts one, and continues there. The chain is read back with
 * `act_list` (by expression_ref) so the timeline and the follow cursor span
 * every act of the Run.
 *
 * FactoryLive supplies kernel reads through the same owner-bound IO seam
 * used by native acceptance.
 */
import type {JournalEventLike} from "../../../agent/tape/model";
import {advanceCursor, castOf, decodeBasis, journalBounds, ownerRunClosed, runWindow, emptyCursor, mapEventsWithCursor, occurrenceKey, opKey, wireBasis, type ActOp, type Binding, type CastMember as CastMemberOfRun, type CursorState, type LiveJournals, type LiveReadings} from "./eventMap";
import {actInspect, actList, materialList, type ActBinding, type ActOutcome, type CastMember, type MaterialListing, type WorldAct, type WorldCall, type WorldRequest} from "../../../expression/world";
import {materialFor, resolveRepertoire, type Repertoire, type RepertoireContext, type ResolvedMaterial} from "./repertoire";
import type {TelemetryWatchReading} from "../desk/factoryReads";

export interface LiveCastMember extends CastMemberOfRun {character_ref?: string}

export interface JournalPageLike {events: JournalEventLike[]; next_cursor?: number; more?: boolean}
export interface LiveIO {
  readAttempts(): Promise<unknown>;
  watch(resume?: {stateRevision: number}): Promise<TelemetryWatchReading | undefined>;
  readJournal(session: string, after: number): Promise<JournalPageLike | undefined>;
  readPopulation?(): Promise<unknown>;
  readConversation?(position: string, withPosition: string): Promise<unknown[]>;
  readCustody?(): Promise<unknown[]>;
  readCard?(agentRef: string): Promise<{character_ref?: string} | undefined>;
  /** Add late cast members / artifacts to the Run's Expression. */
  syncExpression?(readings: LiveReadings, cast: LiveCastMember[]): Promise<void>;
  /** The Expression-world seam (world.ts `viaTransport`). */
  world: WorldCall;
}

export interface LiveConfig {
  runRef: string;
  goal?: string;
  actRef: string;
  expressionRef: string;
  actor: string;
  context: RepertoireContext;
}

export interface PerformedPassage {key: string; op: ActOp; material?: ResolvedMaterial; state: "performed" | "refused" | "unresolved" | "skipped"; error?: string; at: number}
export interface LiveState {
  status: "idle" | "opening" | "following" | "degraded" | "stopped" | "refused";
  cast: LiveCastMember[];
  repertoire?: {basis: Repertoire["basis"]; expression?: {file_ref: string; title: string}};
  /** Every Expression the repertoire could perform (for the Live selector). */
  choices: {file_ref: string; title: string; kind: string}[];
  act?: WorldAct;
  /** Earlier acts of this Run's chain (rolled over at the passage cap), oldest first. */
  chain: WorldAct[];
  performed: PerformedPassage[];
  cursor: CursorState;
  error?: string;
  lastPassAt?: number;
  backoffMs?: number;
  sources: Record<string, "read" | "unavailable">;
}

const ACT_ID = /[^A-Za-z0-9-_.]/g;
export const actRefFor = (runRef: string) => `act:factory-run-${runRef.replace(ACT_ID, "-")}`;
export const liveExpressionRefFor = (runRef: string) => `expression:factory-run-${runRef.replace(ACT_ID, "-")}`;

/** Bounds of the first-open catch-up. */
/** Bounds of the first-open catch-up. A Run whose whole mapped history is
 * at most `fullHistory` operations is performed in full, in order (arrival,
 * work, skill gestures, exchanges, review, completion, text); the engine's
 * timeline and playback pace it — the producer only records. Above it, the
 * bounded catch-up applies (each journal's last `journalEvents` events).
 * On first follow each journal is read whole, up to `journalPages` pages. */
export const CATCH_UP = {journalEvents: 24, journalPages: 40, factoryOps: 40, fullHistory: 160};
const MAX_PERFORMED = 400;
const MIN_PASS_MS = 1500;
const MAX_BACKOFF_MS = 15000;
const POPULATION_EVERY = 5;

/** Fill each agent binding's character from the cast. */
function withCharacters(bindings: Record<string, Binding>, cast: LiveCastMember[]): Record<string, Binding> {
  const out: Record<string, Binding> = {};
  for (const [role, binding] of Object.entries(bindings)) {
    if (binding.kind === "agent") {
      const member = cast.find(candidate => candidate.agent_ref === binding.agent_ref);
      out[role] = member?.character_ref && !binding.character_ref ? {...binding, character_ref: member.character_ref} : binding;
    } else out[role] = binding;
  }
  return out;
}

/** One mapped operation → its contract world request, or why it cannot be
 * performed. `act_select` with `{role, state}` is an object-local state
 * change (no Scene); with a Scene it is a Scene change. */
export function requestFor(op: ActOp, repertoire: Repertoire, cast: LiveCastMember[], config: Pick<LiveConfig, "actRef" | "actor">): {request?: WorldRequest; material?: ResolvedMaterial; reason?: string} {
  const characterOf = (role: string) => {
    const index = cast.findIndex(member => member.role === role);
    return {character_ref: index >= 0 ? cast[index].character_ref : undefined, index: Math.max(0, index)};
  };
  const bindings = withCharacters(op.bindings, cast);
  const event_basis = wireBasis(op.basis);
  const base = {act_ref: config.actRef, actor: config.actor};
  if (op.operation === "act_text") return {request: {operation: "act_text", ...base, role: op.role, text: op.text, event_basis}};
  const material = materialFor(repertoire, op, characterOf);
  if (!material) return {reason: `No material in this Run's repertoire performs ${"scene" in op ? op.scene : op.operation === "act_gesture" ? op.gesture : op.state}`};
  if (op.operation === "act_gesture") {
    return {material, request: {operation: "act_gesture", ...base, role: op.role, gesture: op.gesture,
      material: {file_ref: material.file_ref, ...(material.revision ? {revision: material.revision} : {}), ...(material.scene_ref ? {scene_ref: material.scene_ref} : {})}, event_basis}};
  }
  if ("state" in op) {
    // Object-local: the role's occupant takes the character state's `self`
    // material while the current Scene continues (no scene_ref).
    return {material, request: {operation: "act_select", ...base, kind: "state", role: op.role, state: op.state, material: {file_ref: material.file_ref}, bindings, event_basis}};
  }
  return {material, request: {operation: "act_select", ...base, kind: "scene", state: op.scene, bindings, event_basis,
    material: {file_ref: material.file_ref, ...(material.revision ? {revision: material.revision} : {}), ...(material.scene_ref ? {scene_ref: material.scene_ref} : {})}}};
}

const RACES = new Set(["revision_conflict", "act_revision_conflict", "material_revision_changed"]);
const REFUSED = /refus|conflict|unavailable|unbound|error|invalid|changed|unknown/;

/** Send one world request; a revision race re-reads the act and retries
 * once with fresh guards. Any other refusal throws with the kernel's state. */
/** The kernel refused a passage because the act reached its passage cap. */
export class PassageLimit extends Error {
  readonly actRef: string;
  constructor(actRef: string) { super(`act_passage_limit on ${actRef}`); this.actRef = actRef; }
}

/** The Run's act chain: `<base>`, `<base>:2`, `<base>:3`, … */
export const chainIndex = (base: string, actRef: string): number => actRef === base ? 1 : actRef.startsWith(`${base}:`) && /^\d+$/.test(actRef.slice(base.length + 1)) ? Number(actRef.slice(base.length + 1)) : 0;
export const chainRef = (base: string, index: number) => index <= 1 ? base : `${base}:${index}`;

/** A recovery/skip receipt must retain this exact native request, not merely
 * reuse its occurrence. No second acknowledgement store is introduced. */
export function requestAccepted(act: WorldAct | undefined, request: WorldRequest): boolean {
  if (!act || !("act_ref" in request) || act.act_ref !== request.act_ref || !("event_basis" in request) || !request.event_basis) return false;
  const basis = request.event_basis;
  const same = (expected: unknown, actual: unknown): boolean => {
    if (expected === actual) return true;
    if (!expected || !actual || typeof expected !== "object" || typeof actual !== "object") return false;
    if (Array.isArray(expected) || Array.isArray(actual)) return Array.isArray(expected) && Array.isArray(actual)
      && expected.length === actual.length && expected.every((value, index) => same(value, actual[index]));
    const entries = Object.entries(expected);
    return entries.length === Object.keys(actual).length && entries.every(([key, value]) => same(value, (actual as Record<string, unknown>)[key]));
  };
  const subset = (expected: object | undefined, actual: object | undefined): boolean => !expected || !!actual
    && Object.entries(expected).every(([key, value]) => value === undefined || same(value, (actual as Record<string, unknown>)[key]));
  return act.sequence.some(passage => {
    if (!passage.target_ref || !subset(basis, passage.event_basis)) return false;
    if (request.operation === "act_text") return passage.kind === "text" && passage.role === request.role
      && passage.field === (request.field ?? "body") && passage.text === request.text && passage.value === request.value;
    if (request.operation === "act_operate") return passage.kind === "operate" && passage.operation === request.operation_kind
      && passage.native_ref === request.native_ref && (request.mode === undefined || passage.mode === request.mode)
      && passage.summary === request.summary;
    if (request.operation !== "act_select" && request.operation !== "act_gesture") return false;
    const material = request.material;
    if (material?.file_ref && passage.file_ref !== material.file_ref || material?.expression_ref && passage.expression_ref !== material.expression_ref
      || material?.revision && passage.revision !== material.revision
      || material?.scene_ref && passage.scene_ref !== material.scene_ref && !passage.scene_ref?.endsWith(`:scene:${material.scene_ref}`)) return false;
    if (!subset(request.transition, passage.transition)) return false;
    if (request.operation === "act_gesture") return passage.kind === "gesture" && passage.gesture === request.gesture
      && passage.role === request.role && (!request.entity_ref || passage.native_ref === request.entity_ref);
    const state = request.state ?? material?.state;
    const kind = request.kind ?? (state && !material?.scene_ref ? "state" : "scene");
    if (passage.kind !== kind || passage.role !== request.role || passage.state !== state || passage.summary !== request.summary
      || !subset(request.captions, passage.captions)) return false;
    return Object.entries(request.bindings ?? {}).every(([role, binding]) => subset(binding, passage.bindings?.[role]));
  });
}

/** Qualify a local historical request using the participant binding that
 * accompanied its native passage, independently of today's role occupants. */
export function retainedRequest(request: WorldRequest, op: ActOp, cast: LiveCastMember[], owner: WorldAct): WorldRequest {
  const key = opKey(op);
  const passage = owner.sequence.find(passage => {
    const basis = decodeBasis(passage.event_basis);
    return basis && occurrenceKey(basis.event_ref, basis.occurrence) === key;
  });
  if (!passage) throw new Error("Retained occurrence has no original native passage");
  if (request.operation !== "act_gesture" && request.operation !== "act_select") return request;
  // Rendering choices belong to the accepted passage. A person's later
  // repertoire/character selection applies to new work, not old receipts.
  const material = {...(passage.file_ref ? {file_ref: passage.file_ref} : {}),
    ...(passage.expression_ref ? {expression_ref: passage.expression_ref} : {}),
    ...(passage.revision ? {revision: passage.revision} : {}), ...(passage.scene_ref ? {scene_ref: passage.scene_ref} : {})};
  let qualified: WorldRequest = {...request, material};
  if (request.operation === "act_select") {
    const bindings = {...request.bindings};
    for (const [role, binding] of Object.entries(bindings)) {
      const original = passage.bindings?.[role];
      if (binding.kind === "agent" && binding.agent_ref === original?.agent_ref
        && !(op.bindings[role]?.kind === "agent" && (op.bindings[role] as Extract<Binding, {kind: "agent"}>).character_ref) && original?.character_ref)
        bindings[role] = {...binding, character_ref: original.character_ref};
    }
    qualified = {...request, material, bindings,
      ...(request.kind === "scene" && passage.state === undefined ? {state: undefined} : {})};
  }
  if (request.operation === "act_gesture" || request.operation === "act_select" && request.kind === "state") {
    const sourceRole = (op as {role: string}).role;
    const sourceBinding = op.bindings[sourceRole], selfBinding = op.bindings.self;
    const roleAgent = sourceBinding?.kind === "agent" ? sourceBinding.agent_ref : undefined;
    const selfAgent = selfBinding?.kind === "agent" ? selfBinding.agent_ref : undefined;
    // Factory's local state/gesture grammar binds its acting participant as
    // `self`; scoped Direct grammar uses the cast role. If both are authored,
    // they must identify the same actor before a historical receipt qualifies.
    if (roleAgent && selfAgent && roleAgent !== selfAgent)
      throw new Error("Retained local occurrence has no qualified historical participant: conflicting role/self actors");
    const sourceAgent = roleAgent ?? selfAgent;
    const castAgent = cast.find(member => member.role === sourceRole)?.agent_ref;
    const role = passage.role;
    const binding = role && (passage.bindings?.[role] ?? owner.sequence.slice(0, passage.index).reverse()
      .map(earlier => earlier.bindings?.[role]).find(binding => binding?.agent_ref));
    if (!role || !sourceAgent || sourceAgent !== castAgent || !binding || binding.agent_ref !== sourceAgent)
      throw new Error("Retained local occurrence has no qualified historical participant");
    qualified = request.operation === "act_gesture"
      ? {...qualified, operation:"act_gesture", role, ...(passage.native_ref ? {entity_ref: passage.native_ref} : {})} as WorldRequest
      : {...qualified, role};
  }
  return qualified;
}

/** Rebuild semantic source fields without consulting today's repertoire. */
export function requestForRetained(op: ActOp, cast: LiveCastMember[], config: Pick<LiveConfig, "actRef" | "actor">, owner: WorldAct): WorldRequest {
  const base = {act_ref: config.actRef, actor: config.actor, event_basis: wireBasis(op.basis)};
  if (op.operation === "act_text") return {...base, operation:"act_text", role:op.role, text:op.text};
  const bindings = withCharacters(op.bindings, cast);
  const request: WorldRequest = op.operation === "act_gesture"
    ? {...base, operation:"act_gesture", role:op.role, gesture:op.gesture}
    : "state" in op
      ? {...base, operation:"act_select", kind:"state", role:op.role, state:op.state, bindings}
      : {...base, operation:"act_select", kind:"scene", state:op.scene, bindings};
  return retainedRequest(request, op, cast, owner);
}

/** Reconcile an uncertain request through the native owner before sending
 * anything further. An unreadable owner or conflicting retained payload is
 * unavailable work, never permission to resend. */
export async function reconcilePendingDelivery(world: WorldCall, request: WorldRequest): Promise<ActOutcome> {
  if (!("act_ref" in request)) throw new Error("Pending delivery has no native Act identity");
  const fresh = await actInspect(world, request.act_ref);
  if (fresh.act?.act_ref !== request.act_ref) throw new Error("Pending native delivery remains unreadable; no resend is permitted");
  const basis = "event_basis" in request ? decodeBasis(request.event_basis) : undefined;
  const key = basis && occurrenceKey(basis.event_ref, basis.occurrence);
  if (key && cursorFromAct(fresh.act).performed.includes(key) && !requestAccepted(fresh.act, request)) throw new Error("The pending occurrence retains different native request material");
  return fresh;
}

export async function performWithRetry(world: WorldCall, request: WorldRequest, actRef: string): Promise<ActOutcome> {
  const eventBasis = "event_basis" in request ? decodeBasis(request.event_basis) : undefined;
  const accepted = (outcome: ActOutcome | undefined) => outcome?.act?.act_ref === actRef
    && (!eventBasis || requestAccepted(outcome.act, request));
  const admit = (outcome: ActOutcome): ActOutcome => {
    if (!accepted(outcome)) throw new Error(`${request.operation}: no native Act acceptance receipt`);
    return outcome;
  };
  let first: ActOutcome;
  try { first = await world(request) as ActOutcome; }
  catch (error) {
    // A lost response can follow an accepted native write. Read its receipt;
    // this recovery never repeats the operation or claims unobserved acceptance.
    const fresh = await actInspect(world, actRef).catch(() => undefined);
    if (accepted(fresh) && requestAccepted(fresh?.act, request)) return fresh!;
    throw error;
  }
  if (first && typeof first === "object" && first.state === "act_passage_limit") throw new PassageLimit(actRef);
  if (!first || typeof first !== "object" || !RACES.has(String(first.state))) {
    if (first && typeof first === "object" && typeof first.state === "string" && REFUSED.test(first.state)) throw new Error(`${request.operation}: ${first.state}`);
    return admit(first);
  }
  const fresh = await actInspect(world, actRef).catch(() => undefined);
  // Another producer may have accepted this occurrence before our stale
  // revision was refused. Its native passage is the acceptance receipt.
  if (requestAccepted(fresh?.act, request)) return fresh!;
  if (fresh?.act?.act_ref !== actRef) throw new Error(`${request.operation}: no native Act reading to qualify retry`);
  const retry = {...request} as WorldRequest & {expected_act_revision?: number; expected_revision?: number};
  if (fresh?.act) retry.expected_act_revision = fresh.act.revision;
  if (typeof first.current_revision === "number") retry.expected_revision = first.current_revision;
  const second = await world(retry) as ActOutcome;
  if (second && typeof second === "object" && second.state === "act_passage_limit") throw new PassageLimit(actRef);
  if (second && typeof second === "object" && typeof second.state === "string" && (RACES.has(second.state) || REFUSED.test(second.state))) throw new Error(`${request.operation}: ${second.state}`);
  return admit(second);
}

/** Legacy FNV-1a identifier, retained only to refuse unqualified hash-only continuation. */
export function keyHash(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { hash ^= key.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}
const CATCH_UP_KIND = "live.catch-up";

/** The follow cursor a recorded act implies: every occurrence its passages
 * performed, each journal's furthest cursor, the telemetry position. */
export function cursorFromAct(act: WorldAct | undefined, base: CursorState = emptyCursor()): CursorState & {skipped: Set<string>} {
  const performed = new Set(base.performed);
  const skipped = new Set<string>();
  const encounterAfter = {...base.encounterAfter};
  const openRuns: {session: string; cursor: number}[] = [];
  const decoded = (act?.sequence ?? []).map(passage => ({passage, basis: decodeBasis(passage.event_basis)}));
  for (const {passage, basis} of decoded) {
    // The catch-up passages name (by hash) what the first follow deliberately
    // did not perform, so a resumed act never performs that history either.
    if (passage.operation === CATCH_UP_KIND && passage.native_ref) {
      if (passage.native_ref.startsWith("live-catch-up-keys:")) {
        const keys: unknown = JSON.parse(passage.native_ref.slice("live-catch-up-keys:".length));
        if (!Array.isArray(keys) || !keys.length || !keys.every(key => typeof key === "string" && key.length))
          throw new Error("Native catch-up receipt has invalid source identities");
        for (const key of keys) skipped.add(key);
      } else if (passage.native_ref.startsWith("live-catch-up:")) {
        for (const hash of passage.native_ref.slice("live-catch-up:".length).split(".")) if (hash) skipped.add("legacy-hash:" + hash);
      } else throw new Error("Native catch-up receipt has unknown source custody");
    }
    if (!basis) continue;
    performed.add(occurrenceKey(basis.event_ref, basis.occurrence));
    const journal = basis.journal;
    if (journal) encounterAfter[journal.session] = Math.max(encounterAfter[journal.session] ?? -1, journal.cursor);
    // A reply run whose text passage is missing was still open: re-read the
    // journal from its first chunk (its select passage dedupes; the text
    // lands once when the run closes).
    const replyStart = basis.occurrence.replace(/\/scene$/, "");
    if (basis.entry === "encounter.reply" && journal && /^cursor:\d+$/.test(replyStart)
      && !decoded.some(other => other.basis?.event_ref === basis.event_ref && other.basis.occurrence === `${replyStart}/text`)) {
      openRuns.push(journal);
    }
  }
  for (const run of openRuns) encounterAfter[run.session] = Math.min(encounterAfter[run.session] ?? -1, run.cursor - 1);
  return {...base, performed: [...performed], encounterAfter, skipped};
}

/** First-open catch-up over the factory/gateway operations: per native
 * record, its arrival and its latest two other operations; then the last
 * `limit` of those. Everything else is skipped (recorded, never sent). */
export function catchUp(ops: ActOp[], limit = CATCH_UP.factoryOps): {keep: ActOp[]; skip: ActOp[]} {
  const byRef = new Map<string, ActOp[]>();
  for (const op of ops) { const list = byRef.get(op.basis.event_ref) ?? []; list.push(op); byRef.set(op.basis.event_ref, list); }
  const chosen = new Set<ActOp>();
  for (const list of byRef.values()) {
    const arrival = list.find(op => op.basis.family === "arrival");
    if (arrival) chosen.add(arrival);
    for (const op of list.filter(candidate => candidate !== arrival).slice(-2)) chosen.add(op);
  }
  const ordered = ops.filter(op => chosen.has(op));
  const keep = ordered.slice(-limit);
  const kept = new Set(keep);
  return {keep, skip: ops.filter(op => !kept.has(op))};
}

export class LiveProducer {
  state: LiveState;
  private io: LiveIO;
  private config: LiveConfig;
  private stopped = false;
  private running?: Promise<void>;
  /** Existing explicit native material selections share this producer's custody. */
  private selections = new Set<Promise<void>>();
  private repertoire: Repertoire = {basis: "none", material: []};
  private listeners = new Set<(state: LiveState) => void>();
  private passes = 0;
  private held: {attempts?: unknown; custody?: unknown[]; population?: unknown; communiques: Map<string, unknown>; populationSignature?: string; artifacts: Set<string>} = {communiques: new Map(), artifacts: new Set()};
  private firstFollow = true;
  /** Run-bounds per session, from its whole journal (settled once found). */
  private bounds = new Map<string, {from: number; to: number; settled: boolean}>();
  private skipped = new Set<string>();
  /** The act currently performed into (the chain's newest). */
  private current: string;
  /** Uncertain delivery is reconciled against its native passage before any
   * subsequent pass can send it again. This is IO custody, not source state. */
  private pendingRequest?: WorldRequest;
  constructor(io: LiveIO, config: LiveConfig, cursor: CursorState = emptyCursor()) {
    this.io = io;
    this.config = config;
    this.current = config.actRef;
    this.state = {status: "idle", cast: [], choices: [], chain: [], performed: [], cursor, sources: {}};
  }
  subscribe(listener: (state: LiveState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private set(patch: Partial<LiveState>) { this.state = {...this.state, ...patch}; for (const listener of [...this.listeners]) listener(this.state); }

  private async source<T>(name: string, read: (() => Promise<T>) | undefined): Promise<T | undefined> {
    if (!read) return undefined;
    try { const value = await read(); this.state.sources[name] = "read"; return value; }
    catch { this.state.sources[name] = "unavailable"; return undefined; }
  }

  /** Each cast role pinned to the entity presenting that participant in the
   * Run's Expression (run-expression.ts `cast-<agent>`), so an object-local
   * state or gesture has an occupant before any Scene names the role. */
  private castBindings(cast: LiveCastMember[]): Record<string, ActBinding> {
    const entity = (agentRef: string) => `${this.config.expressionRef}:entity:cast-${agentRef.replace(/[^A-Za-z0-9-_.]/g, "-")}`;
    const bindings: Record<string, ActBinding> = {};
    for (const member of cast) {
      bindings[member.role] = {kind: "agent", agent_ref: member.agent_ref, label: member.label, entity_ref: entity(member.agent_ref), ...(member.profile_ref ? {profile_ref: member.profile_ref} : {}), ...(member.character_ref ? {character_ref: member.character_ref} : {})};
    }
    if (cast[0]) bindings.lead = {...bindings[cast[0].role]};
    return bindings;
  }

  /** The role (and live entity) presenting an agent now: a role the act's
   * current bindings give that agent and the kernel maps to an entity, else
   * the cast role pinned at open. */
  private occupantOf(agentRef: string | undefined, fallbackRole: string, act = this.state.act): {role: string; entity_ref?: string} {
    if (agentRef && act) {
      for (const [role, binding] of Object.entries(act.bindings ?? {})) {
        if (binding.agent_ref === agentRef && act.role_entities?.[role]) return {role, entity_ref: act.role_entities[role]};
      }
      const pinned = act.bindings?.[fallbackRole]?.entity_ref;
      if (pinned) return {role: fallbackRole, entity_ref: pinned};
    }
    return {role: fallbackRole};
  }

  private localiseRequest(built: WorldRequest, op: ActOp, cast: LiveCastMember[], act = this.state.act): WorldRequest {
    if (built.operation !== "act_gesture" && !(built.operation === "act_select" && built.kind === "state")) return built;
    const role = (op as {role: string}).role;
    const agentRef = cast.find(member => member.role === role)?.agent_ref;
    const occupant = this.occupantOf(agentRef, role, act);
    return built.operation === "act_gesture" ? {...built, role: occupant.role, ...(occupant.entity_ref ? {entity_ref: occupant.entity_ref} : {})} : {...built, role: occupant.role};
  }

  private castEntries(cast: LiveCastMember[]): CastMember[] {
    const entries: CastMember[] = cast.map(member => ({role: member.role, participant_ref: member.agent_ref, label: member.label, ...(member.profile_ref ? {profile_ref: member.profile_ref} : {}), ...(member.character_ref ? {character_ref: member.character_ref} : {})}));
    if (cast[0]) entries.push({role: "lead", participant_ref: cast[0].agent_ref, label: cast[0].label, ...(cast[0].character_ref ? {character_ref: cast[0].character_ref} : {})});
    return entries;
  }

  /** Open (or idempotently resume) the chain's newest act with its cast,
   * goal subject and run instrument. */
  private async openAct(cast: LiveCastMember[], summary?: string): Promise<WorldAct | undefined> {
    const opened = await performWithRetry(this.io.world, {operation: "act_open", act_ref: this.current, mode: "factory", expression_ref: this.config.expressionRef, cast: this.castEntries(cast),
      bindings: this.castBindings(cast),
      subject_ref: this.config.runRef, instrument_ref: this.config.runRef,
      summary: summary ?? (this.config.goal ? `Factory Run — ${this.config.goal}`.slice(0, 400) : undefined), actor: this.config.actor}, this.current);
    return opened.act;
  }

  /** The chain's refs and phases, oldest first (act_list, archived included). */
  private async readChainRefs(): Promise<{act_ref: string; phase: string}[]> {
    const listed = await actList(this.io.world, {expression_ref: this.config.expressionRef}).catch(() => undefined);
    return (listed?.acts ?? []).filter(act => chainIndex(this.config.actRef, act.act_ref) > 0)
      .sort((a, b) => chainIndex(this.config.actRef, a.act_ref) - chainIndex(this.config.actRef, b.act_ref))
      .map(act => ({act_ref: act.act_ref, phase: act.phase}));
  }

  /** The Run's acts on this Expression, oldest first (the rollover chain). */
  private async readChain(): Promise<WorldAct[]> {
    const listed = await actList(this.io.world, {expression_ref: this.config.expressionRef}).catch(() => undefined);
    const refs = (listed?.acts ?? []).map(act => act.act_ref).filter(ref => chainIndex(this.config.actRef, ref) > 0)
      .sort((a, b) => chainIndex(this.config.actRef, a) - chainIndex(this.config.actRef, b));
    const acts: WorldAct[] = [];
    for (const ref of refs) { const read = await actInspect(this.io.world, ref).catch(() => undefined); if (read?.act) acts.push(read.act); }
    return acts;
  }

  /** At the passage cap: open the successor act, mark the rollover on the
   * old one (when it still accepts), and continue there. */
  private async rollover(cast: LiveCastMember[]): Promise<void> {
    const previous = this.current;
    const next = chainRef(this.config.actRef, chainIndex(this.config.actRef, previous) + 1);
    this.current = next;
    const act = await this.openAct(cast, `continues ${previous}`);
    await performWithRetry(this.io.world, {operation: "act_operate", act_ref: previous, actor: this.config.actor, mode: "factory", operation_kind: "live.rollover", native_ref: next,
      summary: `Continues in ${next}`, event_basis: {family: "continuation", source: "factory-live", event_ref: previous, occurrence: "rollover"}}, previous).catch(() => undefined);
    const old = this.state.act;
    this.set({act, chain: old ? [...this.state.chain.filter(a => a.act_ref !== old.act_ref), old] : this.state.chain});
  }

  async open(): Promise<void> {
    this.set({status: "opening", error: undefined});
    this.held.attempts = await this.source("factory-attempt", () => this.io.readAttempts());
    this.held.population = await this.source("aikit-population", this.io.readPopulation?.bind(this.io));
    const window = runWindow(this.held.attempts);
    const cast: LiveCastMember[] = castOf({runRef: this.config.runRef, attempts: this.held.attempts, population: this.held.population, ...(window ? {window} : {})});
    await this.readCharacters(cast, []);
    const material = (await this.source("material", () => materialList(this.io.world)))?.materials ?? [];
    this.resolve(material);
    try {
      // Resume the chain's newest act; the cursor spans every act of the chain.
      // A cancelled act was set aside by the person: it neither resumes nor
      // counts as performed. An ended newest act is continued by a successor.
      const listed = (await this.readChain()).filter(earlier => earlier.phase !== "cancelled");
      const all = await this.readChainRefs();
      const newest = all[all.length - 1];
      if (newest) {
        const ended = newest.phase === "completed" || newest.phase === "cancelled";
        this.current = ended ? chainRef(this.config.actRef, chainIndex(this.config.actRef, newest.act_ref) + 1) : newest.act_ref;
      }
      const act = await this.openAct(cast);
      const chain = listed.filter(earlier => earlier.act_ref !== this.current);
      let combined = this.state.cursor;
      let skippedAll = new Set<string>();
      for (const earlier of [...chain, ...(act ? [act] : [])]) {
        const {skipped, ...next} = cursorFromAct(earlier, combined);
        combined = next;
        skippedAll = new Set([...skippedAll, ...skipped]);
      }
      const cursor = combined, skipped = skippedAll;
      this.state.chain = chain;
      this.skipped = skipped;
      // A partial catch-up can have durable skip receipts but no live passage.
      // Re-entry must finish the same bounded initial catch-up in that case.
      const retained = [...chain, ...(act ? [act] : [])];
      const catchUpKeys = new Set(retained.flatMap(owner => owner.sequence.filter(passage => passage.operation === CATCH_UP_KIND)
        .map(passage => decodeBasis(passage.event_basis)).filter((basis): basis is NonNullable<typeof basis> => !!basis)
        .map(basis => occurrenceKey(basis.event_ref, basis.occurrence))));
      this.firstFollow = retained.every(owner => owner.sequence.every(passage => passage.operation === CATCH_UP_KIND))
        && this.state.cursor.performed.every(key => catchUpKeys.has(key));
      this.set({status: "following", cast, act, cursor, choices: material.filter(entry => entry.kind === "expression" || entry.kind === "scene").map(entry => ({file_ref: entry.file_ref, title: entry.title, kind: entry.kind}))});
    } catch (error) {
      this.set({status: "refused", cast, error: error instanceof Error ? error.message : String(error)});
      throw error;
    }
  }

  private resolve(material: MaterialListing[]) {
    const workflowKey = this.held.attempts && typeof this.held.attempts === "object" ? (this.held.attempts as {workflowKey?: string}).workflowKey : undefined;
    this.repertoire = resolveRepertoire(material, {...this.config.context, workflowKey: this.config.context.workflowKey ?? workflowKey});
    this.set({repertoire: {basis: this.repertoire.basis, ...(this.repertoire.expression ? {expression: {file_ref: this.repertoire.expression.file_ref, title: this.repertoire.expression.title}} : {})}});
  }

  /** Tier 1: an explicitly selected Expression (or Scene) for this Run. */
  select(fileRef: string | undefined): Promise<void> {
    const selected = (async () => {
      this.config = {...this.config, context: {...this.config.context, explicit: fileRef}};
      this.resolve(this.repertoire.material);
      if (this.state.status === "following" || this.state.status === "degraded") {
        const act = await this.openAct(this.state.cast).catch(() => undefined);
        if (act) this.set({act});
      }
    })();
    this.selections.add(selected);
    void selected.then(() => { this.selections.delete(selected); }, () => { this.selections.delete(selected); });
    return selected;
  }

  private async readCharacters(cast: LiveCastMember[], known: LiveCastMember[]) {
    for (const member of cast) {
      const was = known.find(candidate => candidate.agent_ref === member.agent_ref);
      if (was) { member.character_ref = was.character_ref; continue; }
      const card = await this.source(`card:${member.agent_ref}`, this.io.readCard ? () => this.io.readCard!(member.agent_ref) : undefined);
      if (card?.character_ref) member.character_ref = card.character_ref;
    }
  }

  /** A session's whole journal (page-bounded) — for its Run-bounds. */
  private async wholeJournal(session: string): Promise<JournalEventLike[]> {
    let after = 0;
    const events: JournalEventLike[] = [];
    for (let page = 0; page < CATCH_UP.journalPages; page++) {
      const read = await this.io.readJournal(session, after);
      if (!read?.events?.length) break;
      events.push(...read.events);
      after = Math.max(after, read.next_cursor ?? 0, read.events[read.events.length - 1].cursor);
      if (!read.more) break;
    }
    return events;
  }

  /** Read a journal's tail on first follow: page through keeping only the
   * last few events (bounded pages), never performing whole histories. */
  private async journalTail(session: string): Promise<JournalEventLike[]> {
    let after = 0;
    let kept: JournalEventLike[] = [];
    for (let page = 0; page < CATCH_UP.journalPages; page++) {
      const read = await this.io.readJournal(session, after);
      if (!read?.events?.length) break;
      // Keep the whole (page-bounded) journal: whether the history is small
      // enough to perform in full is decided on the mapped operations, not
      // on raw events (a reply of hundreds of chunks is one operation).
      kept = [...kept, ...read.events];
      after = Math.max(after, read.next_cursor ?? 0, read.events[read.events.length - 1].cursor);
      if (!read.more) break;
    }
    return kept;
  }

  /** One follow pass. Returns the operations performed. */
  async pass(): Promise<ActOp[]> {
    if (this.pendingRequest) {
      const request = this.pendingRequest;
      const pendingAct = "act_ref" in request ? request.act_ref : this.current;
      this.state.sources["expression-delivery"] = "unavailable";
      const fresh = await reconcilePendingDelivery(this.io.world, request);
      this.state.sources["expression-delivery"] = "read";
      const recovered = cursorFromAct(fresh.act);
      for (const hash of recovered.skipped) this.skipped.add(hash);
      if (requestAccepted(fresh.act, request)) this.state.cursor = {...this.state.cursor, performed: [...new Set([...this.state.cursor.performed, ...recovered.performed])].slice(-4000)};
      if (pendingAct === this.current) this.state.act = fresh.act;
      this.pendingRequest = undefined;
    }
    this.passes++;
    const previousRevision = this.state.cursor.telemetry?.stateRevision;
    const watch = await this.source("factory-telemetry", () => this.io.watch(this.state.cursor.telemetry));
    const moved = this.held.attempts === undefined || this.state.sources["factory-attempt"] === "unavailable" || !watch || watch.cursor.stateRevision !== previousRevision;
    if (moved) {
      this.held.attempts = await this.source("factory-attempt", () => this.io.readAttempts()) ?? this.held.attempts;
      this.held.custody = await this.source("factory-custody", this.io.readCustody?.bind(this.io)) ?? this.held.custody;
    }
    if (this.passes % POPULATION_EVERY === 1 || moved) this.held.population = await this.source("aikit-population", this.io.readPopulation?.bind(this.io)) ?? this.held.population;
    const window = runWindow(this.held.attempts);
    const readings: LiveReadings = {runRef: this.config.runRef, goal: this.config.goal, attempts: this.held.attempts, telemetry: watch?.lines, population: this.held.population, custody: this.held.custody, ...(window ? {window} : {})};

    // The cast now; late arrivals get their character, the Expression and
    // the act's cast.
    const cast: LiveCastMember[] = castOf(readings);
    await this.readCharacters(cast, this.state.cast);
    const artifacts = artifactRefsOf(this.held.attempts);
    const newcomers = cast.filter(member => !this.state.cast.some(known => known.agent_ref === member.agent_ref));
    const newArtifacts = artifacts.filter(ref => !this.held.artifacts.has(ref));
    if (newcomers.length || newArtifacts.length) {
      await this.source("expression-sync", this.io.syncExpression ? () => this.io.syncExpression!(readings, cast) : undefined);
      for (const ref of newArtifacts) this.held.artifacts.add(ref);
      if (newcomers.length && (this.state.status === "following" || this.state.status === "degraded")) {
        const act = await this.openAct(cast).catch(() => undefined);
        if (act) this.set({act});
      }
    }

    // Communiques: one conversation per cast pair, only when the cast's
    // undelivered counts moved.
    const signature = communiqueSignature(this.held.population, cast);
    if (this.io.readConversation && signature !== this.held.populationSignature) {
      const positions = [...new Set(cast.map(member => member.position_ref).filter((ref): ref is string => !!ref))];
      for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
        const records = await this.source(`conversation:${positions[i]}|${positions[j]}`, () => this.io.readConversation!(positions[i], positions[j]));
        for (const record of records ?? []) {
          const ref = record && typeof record === "object" ? (record as {communique_ref?: unknown}).communique_ref : undefined;
          if (typeof ref === "string") this.held.communiques.set(ref, record);
        }
      }
      this.held.populationSignature = signature;
    }
    readings.communiques = [...this.held.communiques.values()];

    // Journals: after each cursor; on first follow only their tails. Each
    // session's Run-bounds come from its whole journal, read once.
    const journals: LiveJournals = {encounter: {}, bounds: {}};
    const closed = ownerRunClosed(this.held.attempts, this.config.runRef);
    for (const session of [...new Set(cast.flatMap(member => member.session_refs))]) {
      const held = this.bounds.get(session);
      if (!held?.settled) {
        const whole = await this.source(`journal:${session}`, () => this.wholeJournal(session));
        if (whole) {
          const found = journalBounds(whole, this.config.runRef, new Set(cast.map(member => member.agent_ref)), closed);
          // Native terminal identity bounds the addressed journal turn; the
          // native-result window remains open to later owner facts.
          this.bounds.set(session, {...found, settled: closed});
        }
      }
      const bound = this.bounds.get(session);
      if (bound) journals.bounds![session] = {from: bound.from, to: bound.to};
      const known = this.state.cursor.encounterAfter[session];
      const events = known === undefined && this.firstFollow
        ? await this.source(`journal:${session}`, () => this.journalTail(session))
        : (await this.source(`journal:${session}`, () => this.io.readJournal(session, known ?? 0)))?.events;
      if (events?.length) journals.encounter![session] = events;
    }

    const mapped = mapEventsWithCursor(readings, journals, this.state.cursor, undefined, true);
    let ops = mapped.ops;
    // Retained occurrences are qualified against their exact native request
    // before any source cursor or new mutation is allowed to advance. Earlier
    // rollover Acts retain their own request and occupant identity.
    const owners = new Map<string, WorldAct>();
    for (const op of ops) {
      const key = opKey(op);
      if (this.skipped.has(key) || !this.state.cursor.performed.includes(key)) continue;
      const retained = [...this.state.chain, ...(this.state.act ? [this.state.act] : [])]
        .find(owner => cursorFromAct(owner).performed.includes(key));
      if (!retained) throw new Error("Retained occurrence has no native Act owner");
      let owner = owners.get(retained.act_ref);
      if (!owner) {
        owner = (await actInspect(this.io.world, retained.act_ref)).act;
        if (!owner || owner.act_ref !== retained.act_ref) throw new Error("Retained occurrence owner remains unreadable");
        owners.set(owner.act_ref, owner);
      }
      const qualified = requestForRetained(op, cast, {...this.config, actRef: owner.act_ref}, owner);
      if (!requestAccepted(owner, qualified)) throw new Error("Retained occurrence has different native request material");
    }
    // Old hash-only receipts cannot prove which colliding source key they
    // skipped. Preserve their native history and refuse ambiguous live input.
    if (ops.some(op => this.skipped.has("legacy-hash:" + keyHash(opKey(op)))))
      throw new Error("Legacy catch-up has no exact source identities; its retained Act is readable but cannot qualify this live continuation");
    const skipped: ActOp[] = [];
    if (this.firstFollow) {
      const fresh = ops.filter(op => !this.state.cursor.performed.includes(opKey(op)) && !this.skipped.has(opKey(op)));
      if (ops.length > CATCH_UP.fullHistory) {
        // A long history: its latest state per record, and each journal's
        // last few events only.
        const lastCursors = new Map<string, number>();
        for (const [session, events] of Object.entries(journals.encounter ?? {})) {
          const tail = events.slice(-CATCH_UP.journalEvents);
          if (tail.length) lastCursors.set(session, tail[0].cursor);
        }
        const recentJournal = (op: ActOp) => {
          const journal = op.basis.journal;
          return !!journal && journal.cursor >= (lastCursors.get(journal.session) ?? Infinity);
        };
        const journalOps = fresh.filter(op => op.basis.source === "aikit-encounter");
        const {keep, skip} = catchUp(fresh.filter(op => op.basis.source !== "aikit-encounter"));
        const keptSet = new Set([...keep, ...journalOps.filter(recentJournal)]);
        skipped.push(...skip, ...journalOps.filter(op => !recentJournal(op)));
        ops = fresh.filter(op => keptSet.has(op));
      }
      // Otherwise the whole (small) history is performed, in order.
    }

    // Dedupe by event_ref + occurrence before any world request.
    const already = new Set(this.state.cursor.performed);
    const performed: PerformedPassage[] = skipped.map(op => ({key: opKey(op), op, state: "skipped" as const, at: Date.now()}));
    const done: ActOp[] = [];
    let blocked = false;
    if (skipped.length) {
      // Native passages retain complete source identities, chunked to the
      // existing4096byte text bound. A hash is never writable skip authority.
      const chunks: string[][] = [];
      let chunk: string[] = [];
      const fits = (keys: string[]) => new TextEncoder().encode("live-catch-up-keys:" + JSON.stringify(keys)).length <= 4096;
      for (const op of skipped) {
        const key = opKey(op);
        if (!fits([key])) throw new Error("Source identity exceeds native catch-up capacity; no source cursor was consumed");
        if (!fits([...chunk, key])) { chunks.push(chunk); chunk = []; }
        chunk.push(key);
      }
      if (chunk.length) chunks.push(chunk);
      for (const keys of chunks) {
        const payload = JSON.stringify(keys);
        const request: WorldRequest = {operation: "act_operate", act_ref: this.current, actor: this.config.actor, mode: "factory", operation_kind: CATCH_UP_KIND,
          native_ref: "live-catch-up-keys:" + payload, summary: `Caught up: ${keys.length} earlier event${keys.length === 1 ? "" : "s"} not performed`,
          event_basis: {family: "activity", source: "factory-live", event_ref: this.config.runRef, occurrence: "catch-up:" + payload}};
        try { await performWithRetry(this.io.world, request, this.current); }
        catch (error) { this.pendingRequest = request; throw error; }
        for (const key of keys) this.skipped.add(key);
      }
      done.push(...skipped);
    }
    // Initial catch-up custody ends only after every native skip receipt has
    // qualified. A refusal/lost acknowledgement leaves this bounded path open.
    this.firstFollow = false;
    for (const op of ops) {
      if (this.stopped) break;
      const key = opKey(op);
      if (already.has(key) || this.skipped.has(key)) continue;
      already.add(key);
      let {request, material, reason} = requestFor(op, this.repertoire, cast, {...this.config, actRef: this.current});
      if (!request) { performed.push({key, op, state: "unresolved", error: reason, at: Date.now()}); blocked = true; break; }
      // Object-local operations address the entity presenting that agent now.
      const localise = (built: WorldRequest) => this.localiseRequest(built, op, cast);
      request = localise(request);
      try {
        try {
          const outcome = await performWithRetry(this.io.world, request, this.current);
          if (outcome?.act) this.state.act = outcome.act;
          else if (request.operation === "act_select" && request.kind === "scene") this.state.act = (await actInspect(this.io.world, this.current).catch(() => undefined))?.act ?? this.state.act;
        }
        catch (error) {
          if (!(error instanceof PassageLimit)) throw error;
          await this.rollover(cast);
          ({request, material} = requestFor(op, this.repertoire, cast, {...this.config, actRef: this.current}));
          request = localise(request!);
          const outcome = await performWithRetry(this.io.world, request, this.current);
          this.state.act = outcome.act ?? this.state.act;
        }
        performed.push({key, op, material, state: "performed", at: Date.now()});
        done.push(op);
      } catch (error) {
        // Keep the original ordering and read cursors. A refused/unconfirmed
        // operation has no native acceptance and cannot consume its source.
        performed.push({key, op, material, state: "refused", error: error instanceof Error ? error.message : String(error), at: Date.now()});
        this.pendingRequest = request;
        blocked = true;
        break;
      }
    }
    const attemptRevision = this.held.attempts && typeof this.held.attempts === "object" && typeof (this.held.attempts as {revision?: unknown}).revision === "number" ? (this.held.attempts as {revision: number}).revision : undefined;
    const cursor = advanceCursor(this.state.cursor, done, blocked ? {} : journals,
      !blocked && watch ? [{type: "cursor", cursor: watch.cursor}] : undefined,
      blocked ? undefined : attemptRevision, blocked ? undefined : mapped.sessions);
    // The act is re-read every pass (a kernel-local read): passages performed
    // by others — the Expressions application playing it, a seek, a mode
    // continuation — reach this view's timeline too.
    let act = this.state.act;
    try {
      act = (await actInspect(this.io.world, this.current)).act ?? act;
      // Recover accepted occurrences after a lost acknowledgement while the
      // raw journal/telemetry cursor and unfinished chunk state remain held.
      const pending = this.pendingRequest;
      const basis = pending && "event_basis" in pending ? decodeBasis(pending.event_basis) : undefined;
      const pendingKey = basis && occurrenceKey(basis.event_ref, basis.occurrence);
      const recovered = cursorFromAct(act);
      for (const hash of recovered.skipped) this.skipped.add(hash);
      const confirmed = recovered.performed.filter(key => key !== pendingKey || requestAccepted(act, pending!));
      cursor.performed = [...new Set([...cursor.performed, ...confirmed])].slice(-4000);
    } catch { /* keep the last reading; unconfirmed work stays pending */ }
    this.set({cast, cursor, act, performed: [...this.state.performed, ...performed].slice(-MAX_PERFORMED), lastPassAt: Date.now()});
    if (blocked) throw new Error(performed[performed.length - 1]?.error ?? "Native material remains unresolved");
    return done.filter(op => !skipped.includes(op));
  }

  /** Follow until stopped. The watch paces each pass; a failing pass (or an
   * unreadable watch) backs off exponentially, capped at 15 s. */
  start(): void {
    // Reopening resumes the existing pass and its exact pending request;
    // it never replaces that writer before its native effects are retired.
    this.stopped = false;
    if (this.running) return;
    this.running = (async () => {
      let backoff = MIN_PASS_MS;
      try {
        if (this.state.status !== "following") await this.open();
        while (!this.stopped) {
          const began = Date.now();
          let failed = false;
          try { await this.pass(); } catch (error) { failed = true; this.set({error: error instanceof Error ? error.message : String(error)}); }
          if (this.state.sources["factory-telemetry"] === "unavailable" || this.state.sources["factory-attempt"] === "unavailable") failed = true;
          backoff = failed ? Math.min(backoff * 2, MAX_BACKOFF_MS) : MIN_PASS_MS;
          // This is observed source availability, not a fabricated Agent or
          // act phase. Retain the last native edition and receipt/cursors.
          this.set({status: failed ? "degraded" : "following", backoffMs: failed ? backoff : undefined, ...(failed ? {} : {error: undefined})});
          const rest = backoff - (Date.now() - began);
          if (rest > 0 && !this.stopped) await new Promise(resolve => setTimeout(resolve, rest));
        }
      } catch { /* open refused: the state carries the reason */ }
      finally { this.running = undefined; if (this.stopped) this.set({status: "stopped"}); }
    })();
  }
  stop(): Promise<void> {
    this.stopped = true;
    return Promise.allSettled([...this.selections, ...(this.running ? [this.running] : [])]).then(() => undefined);
  }
  get following(): boolean { return !!this.running && !this.stopped; }
  get retired(): boolean { return this.stopped && !this.running && this.selections.size === 0; }
}

function artifactRefsOf(attempts: unknown): string[] {
  const list = attempts && typeof attempts === "object" ? (attempts as {attempts?: {readableReturn?: {artifactRefs?: string[]} | null}[]}).attempts ?? [] : [];
  return [...new Set(list.flatMap(attempt => attempt.readableReturn?.artifactRefs ?? []))];
}

/** The cast Positions' undelivered Communique counts (population reading). */
function communiqueSignature(population: unknown, cast: CastMemberOfRun[]): string {
  const reading = population && typeof population === "object" && "data" in (population as object) ? (population as {data: unknown}).data : population;
  const rows = reading && typeof reading === "object" ? (reading as {positions?: {position_ref?: string; communiques?: {undelivered?: number | null}}[]}).positions ?? [] : [];
  const positions = new Set(cast.map(member => member.position_ref).filter(Boolean));
  return JSON.stringify(rows.filter(row => row.position_ref && positions.has(row.position_ref)).map(row => [row.position_ref, row.communiques?.undelivered ?? null]).sort());
}
