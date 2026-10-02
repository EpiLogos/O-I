/**
 * Factory Live — the checked event → expression inventory (FX-C1; contract
 * docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §5, spec §5 "Event mapping").
 *
 * Pure: owner readings and journals in, act operations out. No React, no
 * kernel, no clock. Every event family the hardened products actually record
 * is named here with its exact source, event name, identity fields and
 * payload paths, and the act operation it yields (`act_select` of a
 * repertoire Scene or a character state, `act_gesture`, `act_text`) with its
 * role bindings. The inventory is data (`EVENT_INVENTORY`), and every mapped
 * operation names the inventory entry it came from, so the test can check
 * that every family maps over real fixtures and that nothing maps without an
 * entry.
 *
 * Sources (their owners' own readings, never re-keyed):
 *   factory-attempt    `factory attempt read <state> <run>` → factory.attempt-reading/v1
 *                      (state, not a log: events are the records that appear
 *                      in it — attempts, dispatch, observations[],
 *                      verifications[], readableReturn, legs.statusHistory,
 *                      independentReviewers, syntheses, reresolutions)
 *   factory-telemetry  `factory telemetry watch <state> --resume <cursor>` JSONL
 *                      (`execution-correlation` lines; the `cursor` line is
 *                      carried as the follow cursor, not an event)
 *   factory-custody    `factory.work-custody/v1` records (the inhabitation
 *                      reading's runs[].custody[], or a custody receipt)
 *   aikit-encounter    `aikit encounter read` journal of each attempt's
 *                      disposition.body.agentSessionRef
 *   aikit-gateway      `aikit gateway who` (aikit.population-reading/v1) and
 *                      `aikit gateway conversation` (aikit.communique/v1 records)
 *   harness-stream     a claude `--output-format stream-json` body transcript.
 *                      NOT a native suite record (AIKit's gateway ecology
 *                      lists no agencies and the encounter journal holds no
 *                      inhabited claude session); mapped so the moment a
 *                      caller supplies it the Skill/Task tool_use it carries
 *                      has a home. Marked `native: false`.
 *
 * Occurrence addressing: every operation carries `event_basis.event_ref` (the
 * native record identity) and `occurrence` (which concrete occurrence: an
 * observation index, a toolCallId, a journal cursor, a transition revision)
 * so repeated invocations are performed separately and a cursor can skip
 * what was already performed.
 */
import type {JournalEventLike} from "../../../agent/tape/model";

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type EventFamily = "arrival" | "activity" | "skill-invocation" | "tool-operation" | "message" | "artifact" | "review" | "continuation" | "completion";
export const EVENT_FAMILIES: readonly EventFamily[] = ["arrival", "activity", "skill-invocation", "tool-operation", "message", "artifact", "review", "continuation", "completion"];
export type EventSource = "factory-attempt" | "factory-telemetry" | "factory-custody" | "aikit-encounter" | "aikit-gateway" | "harness-stream";

/** Repertoire keys: what an event asks the repertoire for. The Live driver
 * resolves each key to saved material (explicit → workflow → task/SkillSet →
 * generic, contract §5). */
export type RepertoireScene = "arrival" | "work-passage" | "handoff" | "review" | "completion" | "continuation" | "explanation";
export type CharacterState = "idle" | "working" | "speaking";

/** `act_select` with `{role, state}` (no Scene) is an OBJECT-LOCAL state
 * change: the role's entity takes that character state's `self` material
 * while the current Scene continues. `act_select` with a Scene is a Scene
 * change (contract §4, lead clarification 2026-09-26). */
export type Yield =
  | {op: "act_select"; scene: RepertoireScene}
  | {op: "act_select"; state: CharacterState}
  | {op: "act_gesture"; gesture: "invoke-skill" | "operate"}
  | {op: "act_text"; role: "progressText" | "resultText" | "caption"};

export interface InventoryEntry {
  id: string;
  family: EventFamily;
  source: EventSource;
  /** The owner's own event name (operation, journal kind, line type). */
  event: string;
  /** Fields that identify the native record. */
  identity: string[];
  /** Payload paths the mapping reads. */
  payload: string[];
  yields: Yield[];
  /** Role → where its value comes from. */
  roles: Record<string, string>;
  /** False only for the harness transcript (not a suite record). */
  native: boolean;
  note?: string;
}

const A = "attempts[]";
export const EVENT_INVENTORY: readonly InventoryEntry[] = [
  // ── factory-attempt ────────────────────────────────────────────────────
  {id: "attempt.start", family: "arrival", source: "factory-attempt", event: "start-serial | start-fork (attempt record appears)",
    identity: [`${A}.attemptRef`, `${A}.taskRef`, `${A}.workflowUnitRef`],
    payload: [`${A}.attemptRecordedAt`, `${A}.disposition.participant.agentRef`, `${A}.disposition.participant.agencyRef`, `${A}.disposition.participant.positionRef`, `${A}.disposition.participant.profileRef`, `${A}.disposition.body.agentSessionRef`, `${A}.disposition.praxisRefs`, `${A}.disposition.capabilityRefs`],
    yields: [{op: "act_select", scene: "arrival"}], roles: {self: "disposition.participant.agentRef (cast role, state working)", goal: "run destination", artifact: "workflowUnitRef"}, native: true},
  {id: "attempt.dispatch", family: "activity", source: "factory-attempt", event: "bind-dispatch",
    identity: [`${A}.attemptRef`, `${A}.dispatch.receiptRef`], payload: [`${A}.dispatch.phase`, `${A}.dispatch.operationRef`, `${A}.dispatch.ownerRef`, `${A}.executionRef`],
    yields: [{op: "act_select", state: "working"}, {op: "act_text", role: "progressText"}], roles: {self: "participant agent"}, native: true},
  {id: "attempt.observation", family: "activity", source: "factory-attempt", event: "record-observation",
    identity: [`${A}.attemptRef`, `${A}.observations[i].receiptRef`], payload: [`${A}.observations[i].phase`, `${A}.observations[i].operationRef`, `${A}.observations[i].evidenceRefs`, `${A}.observations[i].contract`],
    yields: [{op: "act_select", scene: "work-passage"}], roles: {self: "participant agent", artifact: "workflowUnitRef", progressText: "phase + operationRef"}, native: true},
  {id: "attempt.tracking", family: "activity", source: "factory-attempt", event: "record-tracking",
    identity: [`${A}.attemptRef`, `${A}.tracking[i].factRef`], payload: [`${A}.tracking[i].kind`, `${A}.tracking[i].subjectRef`, `${A}.tracking[i].ownerRef`],
    yields: [{op: "act_text", role: "progressText"}], roles: {progressText: "kind + subjectRef"}, native: true},
  {id: "attempt.verification", family: "review", source: "factory-attempt", event: "record-verification",
    identity: [`${A}.attemptRef`, `${A}.verifications[i].verificationRef`], payload: [`${A}.verifications[i].outcome`, `${A}.verifications[i].obligations`, `${A}.verifications[i].evidenceRefs`, `${A}.verificationRecordedAt[verificationRef]`],
    yields: [{op: "act_select", scene: "review"}], roles: {lead: "participant agent", artifact: "workflowUnitRef", caption: "outcome · obligations checked", outcome: "passed=1 unknown=.5 failed=0"}, native: true},
  {id: "attempt.fail", family: "review", source: "factory-attempt", event: "fail (legs[unit].statusHistory → failed)",
    identity: [`${A}.attemptRef`, "legs[unit].statusHistory[i]"], payload: ["legs[unit].failureReason", `${A}.failureEvidenceRefs`, `${A}.failureRecordedAt`],
    yields: [{op: "act_select", scene: "review"}], roles: {lead: "participant agent", caption: "failureReason", outcome: "0"}, native: true},
  {id: "attempt.return", family: "artifact", source: "factory-attempt", event: "return-artifact",
    identity: [`${A}.attemptRef`, `${A}.readableReturn.returnRef`], payload: [`${A}.readableReturn.summary`, `${A}.readableReturn.artifactRefs`, `${A}.readableReturn.evidenceRefs`, `${A}.returnRecordedAt`, "legs[unit].artifacts[].semanticDifference"],
    yields: [{op: "act_text", role: "resultText"}], roles: {artifact: "readableReturn.artifactRefs[0]", resultText: "readableReturn.summary"}, native: true},
  {id: "attempt.synthesis", family: "artifact", source: "factory-attempt", event: "synthesize",
    identity: ["syntheses[ref].synthesisRef", "syntheses[ref].barrierKey"], payload: ["syntheses[ref].integratedDifference", "syntheses[ref].artifactRefs", "syntheses[ref].reviewerExecutionRef"],
    yields: [{op: "act_text", role: "resultText"}], roles: {artifact: "synthesisRef", resultText: "integratedDifference"}, native: true},
  {id: "attempt.independent-review", family: "review", source: "factory-attempt", event: "register-independent-review",
    identity: ["independentReviewers[executionRef]"], payload: ["independentReviewers[ref].reviewOf", "independentReviewers[ref].independentFromExecutionRefs"],
    yields: [{op: "act_select", scene: "review"}], roles: {lead: "the reviewing attempt's agent (by executionRef)", caption: "review of N units"}, native: true},
  {id: "attempt.retry", family: "continuation", source: "factory-attempt", event: "retry (a later attempt on a unit that already had one) | record-reresolution",
    identity: [`${A}.attemptRef`, `${A}.workflowUnitRef`, `${A}.reresolutions[i].resolutionRef`], payload: [`${A}.reresolutions[i].reason`, `${A}.disposition.body.agentSessionRef`],
    yields: [{op: "act_select", scene: "continuation"}], roles: {self: "participant agent", caption: "re-resolution reason"}, native: true},
  {id: "attempt.leg-hold", family: "continuation", source: "factory-attempt", event: "request-cancellation | accept-cancellation | record-process-termination | mark-quiescent | incorporate-late-result (legs[unit].statusHistory)",
    identity: ["legs[unit]", "legs[unit].statusHistory[i]"], payload: ["legs[unit].status", "legs[unit].lateArtifacts"],
    yields: [{op: "act_select", state: "idle"}, {op: "act_text", role: "caption"}], roles: {self: "the leg's current attempt agent", caption: "status words"}, native: true},
  {id: "attempt.receiving", family: "continuation", source: "factory-attempt", event: "attach-receiving",
    identity: [`${A}.attemptRef`, `${A}.readableReturn.receivingRef`], payload: [`${A}.readableReturn.receivingSourceRevision`],
    yields: [{op: "act_select", scene: "continuation"}], roles: {self: "participant agent", goal: "workflowUnitRef", caption: "Return received; whole Run remains owned by Factory"}, native: true},
  {id: "attempt.run-complete", family: "completion", source: "factory-attempt", event: "native admitted closure and wholeRunState complete over every required current Return",
    identity: ["runRef"], payload: ["completionVerified", "wholeRunState", "lifecycle", "requiredUnits", "currentReturnedUnits", "attempts[].readableReturn.summary"],
    yields: [{op: "act_select", scene: "completion"}], roles: {participants: "every cast member", resultText: "the last readable Return summary"}, native: true},
  // ── factory-telemetry ──────────────────────────────────────────────────
  {id: "telemetry.correlation", family: "activity", source: "factory-telemetry", event: "execution-correlation",
    identity: ["correlationRef"], payload: ["telemetryRef", "stateRevision", "runRef", "childNowRef"],
    yields: [{op: "act_text", role: "progressText"}], roles: {progressText: "correlated execution"}, native: true,
    note: "Lines for other runs are ignored; the `cursor` line carries {stateRevision} for --resume."},
  // ── factory-custody ───────────────────────────────────────────────────
  {id: "custody.in-progress", family: "arrival", source: "factory-custody", event: "factory.work-custody/v1 transition → in-progress",
    identity: ["custody_ref", "transitions[i].revision"], payload: ["position_ref", "work_ref", "run_ref", "transitions[i].reason", "transitions[i].at_unix_ms"],
    yields: [{op: "act_select", scene: "arrival"}], roles: {self: "the Position's occupant agent", goal: "work_ref", caption: "reason"}, native: true},
  {id: "custody.completed", family: "completion", source: "factory-custody", event: "factory.work-custody/v1 transition → completed",
    identity: ["custody_ref", "transitions[i].revision"], payload: ["position_ref", "work_ref", "transitions[i].reason"],
    yields: [{op: "act_select", scene: "completion"}], roles: {lead: "the Position's agent", resultText: "reason"}, native: true},
  {id: "custody.released", family: "continuation", source: "factory-custody", event: "factory.work-custody/v1 transition → any other state (released, cancelled, …)",
    identity: ["custody_ref", "transitions[i].revision"], payload: ["transitions[i].to", "transitions[i].reason"],
    yields: [{op: "act_select", scene: "continuation"}], roles: {self: "the Position's agent", caption: "to · reason"}, native: true},
  // ── aikit-gateway ─────────────────────────────────────────────────────
  {id: "gateway.occupancy", family: "arrival", source: "aikit-gateway", event: "aikit.population-reading/v1 positions[].occupancy.state = occupied",
    identity: ["positions[].position_ref", "positions[].occupancy.generation_ref"], payload: ["positions[].occupancy.agent_ref", "positions[].occupancy.since_unix_ms", "positions[].occupancy.workcell_ref", "positions[].current_work.run_ref"],
    yields: [{op: "act_select", scene: "arrival"}], roles: {self: "occupancy.agent_ref"}, native: true,
    note: "Only Positions whose current_work.run_ref is this Run, or who are already in the cast."},
  {id: "gateway.communique", family: "message", source: "aikit-gateway", event: "aikit.communique/v1 (gateway send / conversation)",
    identity: ["communique_ref", "sequence"], payload: ["from_position_ref", "to_position_ref", "body", "sent_at_unix_ms", "state", "reply_to", "escalated_custody_ref"],
    yields: [{op: "act_select", scene: "handoff"}], roles: {sender: "from_position_ref → agent", recipient: "to_position_ref → agent", caption: "body", artifact: "escalated_custody_ref (delegate) when set"}, native: true},
  // ── aikit-encounter ───────────────────────────────────────────────────
  {id: "encounter.user-message", family: "message", source: "aikit-encounter", event: "user-message",
    identity: ["agent_session", "cursor"], payload: ["event.text", "event.draft_revision"],
    yields: [{op: "act_select", scene: "handoff"}], roles: {sender: "the person", recipient: "the session's agent", caption: "event.text"}, native: true},
  {id: "encounter.agent-message", family: "message", source: "aikit-encounter", event: "agent-message",
    identity: ["agent_session", "event.delivery_ref", "cursor"], payload: ["event.sender", "event.request.submission.turn.packet.text", "event.request.submission.agent_ref"],
    yields: [{op: "act_select", scene: "handoff"}], roles: {sender: "event.sender (agent/…, or human:…)", recipient: "the session's agent", caption: "packet.text"}, native: true},
  {id: "encounter.tool-call", family: "tool-operation", source: "aikit-encounter", event: "provider Signal tool-call (Pi tool_execution_start | ACP tool_call)",
    identity: ["agent_session", "payload.toolCallId"], payload: ["payload.toolName | payload.title | payload.kind", "payload.args | payload.rawInput", "payload.locations[].path"],
    yields: [{op: "act_gesture", gesture: "operate"}], roles: {self: "the session's agent", detail: "tool name + input"}, native: true,
    note: "tool-result and tool_call_update/tool_execution_update join the same toolCallId occurrence (detail only, never a second gesture)."},
  {id: "encounter.skill", family: "skill-invocation", source: "aikit-encounter", event: "provider Signal tool-call whose tool is a skill load",
    identity: ["agent_session", "payload.toolCallId"], payload: ["payload.toolName|title = Skill → args.skill | rawInput.skill", "payload.toolName = read with args.path|file_path ending /SKILL.md → the skill directory name"],
    yields: [{op: "act_gesture", gesture: "invoke-skill"}], roles: {self: "the session's agent", skill: "skill name"}, native: true,
    note: "No real journal on this machine carries one yet (12,319 events checked); the rule follows the providers' own shapes (Pi loads a skill with `read` on SKILL.md; claude-code names the tool `Skill`)."},
  {id: "encounter.delegation", family: "message", source: "aikit-encounter", event: "provider Signal tool-call whose tool dispatches a subagent (Task | Agent)",
    identity: ["agent_session", "payload.toolCallId"], payload: ["args.subagent_type | rawInput.subagent_type", "args.description"],
    yields: [{op: "act_select", scene: "handoff"}], roles: {sender: "the session's agent", recipient: "subagent_type", caption: "description"}, native: true},
  {id: "encounter.reply", family: "activity", source: "aikit-encounter", event: "provider Signal agent-message-chunk (one run of chunks)",
    identity: ["agent_session", "journal cursor of the run's first chunk"], payload: ["Signal.kind.text"],
    yields: [{op: "act_select", state: "speaking"}, {op: "act_text", role: "progressText"}], roles: {self: "the session's agent", progressText: "the reply text so far"}, native: true},
  {id: "encounter.thought", family: "activity", source: "aikit-encounter", event: "provider Signal agent-thought-chunk (one run)",
    identity: ["agent_session", "first cursor of the run"], payload: ["Signal.kind.text"],
    yields: [{op: "act_select", state: "working"}], roles: {self: "the session's agent"}, native: true},
  {id: "encounter.turn-end", family: "activity", source: "aikit-encounter", event: "provider Signal completed | failed | cancelled | TurnEnded",
    identity: ["agent_session", "connection_generation", "Signal.sequence = TurnEnded.last_sequence"], payload: ["Signal.kind.stop_reason", "Signal.kind.reason", "TurnEnded.stop"],
    yields: [{op: "act_select", state: "idle"}], roles: {self: "the session's agent"}, native: true,
    note: "A provider `completed` and the TurnEnded that follows it are one occurrence (the turn), never two."},
  // ── harness-stream (not native) ───────────────────────────────────────
  {id: "harness.skill", family: "skill-invocation", source: "harness-stream", event: "claude stream-json assistant tool_use name=Skill",
    identity: ["session_id", "message.content[].id"], payload: ["message.content[].input.skill"],
    yields: [{op: "act_gesture", gesture: "invoke-skill"}], roles: {self: "the body's agent", skill: "input.skill"}, native: false,
    note: "The body's own transcript; AIKit records no body activity natively."},
  {id: "harness.delegation", family: "message", source: "harness-stream", event: "claude stream-json assistant tool_use name=Task|Agent",
    identity: ["session_id", "message.content[].id"], payload: ["message.content[].input.subagent_type", "message.content[].input.description"],
    yields: [{op: "act_select", scene: "handoff"}], roles: {sender: "the body's agent", recipient: "subagent_type | description", caption: "description"}, native: false},
  {id: "harness.tool", family: "tool-operation", source: "harness-stream", event: "claude stream-json assistant tool_use (any other name)",
    identity: ["session_id", "message.content[].id"], payload: ["message.content[].name", "message.content[].input"],
    yields: [{op: "act_gesture", gesture: "operate"}], roles: {self: "the body's agent", detail: "name + input"}, native: false},
];
export const inventoryEntry = (id: string): InventoryEntry | undefined => EVENT_INVENTORY.find(entry => entry.id === id);

// ---------------------------------------------------------------------------
// Act operations (contract §3/§4 shapes; the Live driver resolves the
// repertoire key to material and sends the world request)
// ---------------------------------------------------------------------------

export type Binding =
  | {kind: "agent"; agent_ref: string; profile_ref?: string; character_ref?: string; state?: CharacterState; label?: string}
  | {kind: "object"; subject_ref: string; label?: string; glyph?: string; state?: string}
  | {kind: "text"; text: string}
  | {kind: "value"; value: number};

/** The mapping's own record of an operation's origin (richer than the
 * wire `event_basis`; see `wireBasis`). */
export interface OpBasis {
  family: EventFamily;
  source: EventSource;
  /** The inventory entry this operation was produced by. */
  entry: string;
  event_ref: string;
  occurrence: string;
  at_unix_ms?: number;
  /** Detail for the object panel (tool name/input, message text, …). */
  detail?: Record<string, unknown>;
  /** For journal events: the session and journal cursor of the originating
   * event, so a resumed act rebuilds its follow cursor from its passages. */
  journal?: {session: string; cursor: number};
}

export type ActOp =
  | {operation: "act_select"; scene: RepertoireScene; bindings: Record<string, Binding>; basis: OpBasis}
  | {operation: "act_select"; state: CharacterState; role: string; bindings: Record<string, Binding>; basis: OpBasis}
  | {operation: "act_gesture"; gesture: "invoke-skill" | "operate"; role: string; skill?: string; bindings: Record<string, Binding>; basis: OpBasis}
  | {operation: "act_text"; role: "progressText" | "resultText" | "caption"; text: string; bindings: Record<string, Binding>; basis: OpBasis};

/** An operation's identity: the native event and its concrete occurrence.
 * Every operation's occurrence is unique (an event that yields two
 * operations suffixes the second), so this is also the dedupe key the act's
 * recorded passages are checked against (`event_basis`). */
export const occurrenceKey = (eventRef: string, occurrence: string) => `${eventRef}|${occurrence}`;
export const opKey = (op: ActOp) => occurrenceKey(op.basis.event_ref, op.basis.occurrence);

/** The wire `event_basis` (kernel EventBasis: family, source, event_ref,
 * occurrence — text only). The occurrence carries, after `~`, the inventory
 * entry and, for journal events, `session#cursor`, so a resumed act rebuilds
 * both the performed keys and each journal's position from its passages. */
export interface WireBasis {family: string; source: string; event_ref: string; occurrence: string}
export function wireBasis(basis: OpBasis): WireBasis {
  const journal = basis.journal ? `~${basis.journal.session}#${basis.journal.cursor}` : "";
  return {family: basis.family, source: basis.source, event_ref: basis.event_ref, occurrence: `${basis.occurrence}~${basis.entry}${journal}`};
}
export interface DecodedBasis {event_ref: string; occurrence: string; entry?: string; journal?: {session: string; cursor: number}; family?: string; source?: string}
export function decodeBasis(basis: {family?: string; source?: string; event_ref?: string; occurrence?: string | number} | undefined): DecodedBasis | undefined {
  if (!basis?.event_ref || basis.occurrence === undefined) return undefined;
  const [occurrence, entry, journal] = String(basis.occurrence).split("~");
  const at = journal ? journal.lastIndexOf("#") : -1;
  const cursor = at >= 0 ? Number(journal!.slice(at + 1)) : NaN;
  return {event_ref: basis.event_ref, occurrence, ...(entry ? {entry} : {}), ...(journal && Number.isFinite(cursor) ? {journal: {session: journal!.slice(0, at), cursor}} : {}),
    ...(basis.family ? {family: basis.family} : {}), ...(basis.source ? {source: basis.source} : {})};
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const obj = (value: unknown): value is Obj => !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const ms = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : undefined; }
  return undefined;
};
const oneLine = (text: string, limit = 140) => { const line = text.replace(/\s+/g, " ").trim(); return line.length > limit ? `${line.slice(0, limit - 1)}…` : line; };
const tail = (ref: string | undefined) => ref ? ref.replace(/^.*[/:]/, "") : undefined;

/** The owner readings the mapping consumes. Every field is optional: a
 * source that could not be read simply contributes nothing. */
export interface LiveReadings {
  runRef: string;
  /** The Run's destination / goal text (factory.run-reading/v1 destination). */
  goal?: string;
  /** factory.attempt-reading/v1, as the owner wrote it (camelCase). */
  attempts?: unknown;
  /** `factory telemetry watch` lines (parsed JSONL). */
  telemetry?: unknown[];
  /** factory.work-custody/v1 records. */
  custody?: unknown[];
  /** aikit.population-reading/v1 (the envelope's `data`). */
  population?: unknown;
  /** aikit.communique/v1 records (from `aikit gateway conversation`). */
  communiques?: unknown[];
  /** The Run's own time span (unix ms). Gateway records (Communiques,
   * occupancy, custody transitions) outside it belong to other work between
   * the same Positions and are not this Run's events. */
  window?: {from?: number; to?: number};
}

/** The Run's time span from its attempt reading: from the first attempt's
 * admission (less a minute) to, only after a native terminal lifecycle, the
 * last recorded return/verification/failure (plus ten minutes). A missing leg
 * or failed attempt does not close the ongoing undertaking's time span. */
export function runWindow(attempts: unknown): {from?: number; to?: number} | undefined {
  const reading = attemptReading(attempts);
  if (!reading?.attempts?.length) return undefined;
  const times = (values: (string | undefined)[]) => values.map(ms).filter((value): value is number => value !== undefined);
  const starts = times(reading.attempts.map(attempt => attempt.attemptRecordedAt));
  const ends = times(reading.attempts.flatMap(attempt => [attempt.returnRecordedAt, attempt.failureRecordedAt, ...Object.values(attempt.verificationRecordedAt ?? {})]));
  const done = ownerRunComplete(reading) || reading.lifecycle === "aborted";
  return {...(starts.length ? {from: Math.min(...starts) - 60_000} : {}), ...(done && ends.length ? {to: Math.max(...ends) + 600_000} : {})};
}
const within = (window: LiveReadings["window"], at: number | undefined) => at === undefined || !window || ((window.from === undefined || at >= window.from) && (window.to === undefined || at <= window.to));
/** Journals by agent session ref: encounter journals ({cursor,event}) or
 * harness stream lines. */
export interface LiveJournals {
  encounter?: Record<string, readonly JournalEventLike[]>;
  harness?: Record<string, readonly unknown[]>;
  /** Each session's Run-bounds computed over its WHOLE journal (a page of
   * new events alone cannot tell which work it belongs to). */
  bounds?: Record<string, {from: number; to: number}>;
}
/** What was already performed (op keys) and where each follow stands. */
/** A journal's open state across passes: a chunk run not yet closed (its
 * originating cursor and text so far) and whether the turn already ended. */
export interface SessionCursor {run?: {kind: "reply" | "thought"; first: number; text: string; at?: number}; turnClosed?: boolean}
export interface CursorState {
  performed: string[];
  sessions?: Record<string, SessionCursor>;
  encounterAfter: Record<string, number>;
  telemetry?: {stateRevision: number};
  attemptRevision?: number;
}
export const emptyCursor = (): CursorState => ({performed: [], encounterAfter: {}});

// ---------------------------------------------------------------------------
// The cast: who is present (constellation), from the readings
// ---------------------------------------------------------------------------

export interface CastMember {
  role: string;
  agent_ref: string;
  agency_ref?: string;
  position_ref?: string;
  profile_ref?: string;
  label: string;
  session_refs: string[];
  attempt_refs: string[];
}

interface AttemptRecord {
  attemptRef: string; taskRef?: string; workflowUnitRef?: string; attemptRecordedAt?: string; executionRef?: string;
  disposition?: {participant?: {agentRef?: string; agencyRef?: string; positionRef?: string; profileRef?: string}; body?: {agentSessionRef?: string}; praxisRefs?: string[]; capabilityRefs?: string[]};
  dispatch?: Obj | null; observations?: Obj[]; verifications?: Obj[]; verificationRecordedAt?: Record<string, string>;
  tracking?: Obj[]; reresolutions?: Obj[]; failureEvidenceRefs?: string[]; failureRecordedAt?: string;
  readableReturn?: {returnRef?: string; summary?: string; artifactRefs?: string[]; evidenceRefs?: string[]; receivingRef?: string | null} | null;
  returnRecordedAt?: string;
}
interface AttemptReadingShape {contract?: string; revision?: number; runRef?: string; lifecycle?: string; completionVerified?: boolean; wholeRunState?: "incomplete" | "complete" | "failed"; requiredUnits?: string[]; currentReturnedUnits?: string[]; attempts?: AttemptRecord[]; legs?: Record<string, {status?: string; statusHistory?: string[]; failureReason?: string | null; artifacts?: Obj[]; attempts?: Obj[]}>; independentReviewers?: Record<string, Obj>; syntheses?: Record<string, Obj>}

const attemptReading = (value: unknown): AttemptReadingShape | undefined =>
  obj(value) && Array.isArray((value as AttemptReadingShape).attempts) ? value as AttemptReadingShape : undefined;

/** Whole completion is an owner fact. Legacy/partial/mismatched readings stay
 * incomplete; a view never certifies the set of currently present legs. */
export function ownerRunComplete(value: unknown): boolean {
  const reading = attemptReading(value);
  if (!reading || reading.completionVerified !== true || reading.wholeRunState !== "complete" || !["finished", "archived"].includes(reading.lifecycle ?? "")) return false;
  const required = reading.requiredUnits;
  const returned = reading.currentReturnedUnits;
  if (!Array.isArray(required) || !Array.isArray(returned) || !required.length
    || !required.every(unit => typeof unit === "string" && unit.length > 0)
    || !returned.every(unit => typeof unit === "string" && unit.length > 0)) return false;
  const requiredSet = new Set(required);
  const returnedSet = new Set(returned);
  return requiredSet.size === required.length && returnedSet.size === returned.length
    && requiredSet.size === returnedSet.size && required.every(unit => returnedSet.has(unit));
}

const readingForRun = (readings: LiveReadings): AttemptReadingShape | undefined => {
  const reading = attemptReading(readings.attempts);
  return reading?.runRef === readings.runRef ? reading : undefined;
};

function populationPositions(value: unknown): Obj[] {
  const reading = obj(value) && obj((value as Obj).data) ? (value as Obj).data : value;
  return obj(reading) ? arr(reading.positions).filter(obj) : [];
}

/** Position → the agent currently occupying it (population), else the
 * attempt participant that names the Position. */
function agentOfPosition(positionRef: string, readings: LiveReadings, attempts: AttemptRecord[]): {agent_ref: string; label?: string; agency_ref?: string} | undefined {
  const row = populationPositions(readings.population).find(position => position.position_ref === positionRef);
  const occupancy = row && obj(row.occupancy) ? row.occupancy : undefined;
  const agent = str(occupancy?.agent_ref);
  if (agent) return {agent_ref: agent, label: str(row?.label) ?? str(row?.handle), agency_ref: str(occupancy?.agency_ref)};
  const attempt = attempts.find(candidate => candidate.disposition?.participant?.positionRef === positionRef);
  const fromAttempt = attempt?.disposition?.participant?.agentRef;
  if (fromAttempt) return {agent_ref: fromAttempt, agency_ref: attempt?.disposition?.participant?.agencyRef};
  return row ? {agent_ref: positionRef, label: str(row.label) ?? str(row.handle)} : undefined;
}

/** The cast in order of arrival: attempt participants (by attempt admission
 * time), then custody Positions, then Communique parties. The first is also
 * `lead`; each member is `participants.<i>`. */
export function castOf(readings: LiveReadings): CastMember[] {
  const cast: CastMember[] = [];
  const byAgent = new Map<string, CastMember>();
  const add = (agentRef: string, fields: Partial<CastMember>) => {
    let member = byAgent.get(agentRef);
    if (!member) {
      member = {role: `participants.${cast.length}`, agent_ref: agentRef, label: fields.label ?? tail(agentRef) ?? agentRef, session_refs: [], attempt_refs: []};
      cast.push(member); byAgent.set(agentRef, member);
    }
    for (const key of ["agency_ref", "position_ref", "profile_ref"] as const) if (!member[key] && fields[key]) member[key] = fields[key];
    if (fields.label && member.label === tail(agentRef)) member.label = fields.label;
    for (const ref of fields.session_refs ?? []) if (!member.session_refs.includes(ref)) member.session_refs.push(ref);
    for (const ref of fields.attempt_refs ?? []) if (!member.attempt_refs.includes(ref)) member.attempt_refs.push(ref);
    return member;
  };
  const attempts = [...(readingForRun(readings)?.attempts ?? [])]
    .sort((a, b) => (ms(a.attemptRecordedAt) ?? 0) - (ms(b.attemptRecordedAt) ?? 0));
  for (const attempt of attempts) {
    const participant = attempt.disposition?.participant;
    if (!participant?.agentRef) continue;
    add(participant.agentRef, {agency_ref: participant.agencyRef, position_ref: participant.positionRef, profile_ref: participant.profileRef,
      session_refs: attempt.disposition?.body?.agentSessionRef ? [attempt.disposition.body.agentSessionRef] : [], attempt_refs: [attempt.attemptRef]});
  }
  for (const record of readings.custody ?? []) {
    const custody = custodyRecord(record);
    if (!custody || (custody.run_ref && custody.run_ref !== readings.runRef)) continue;
    const agent = str(custody.position_ref) ? agentOfPosition(custody.position_ref as string, readings, attempts) : undefined;
    if (agent) add(agent.agent_ref, {position_ref: custody.position_ref as string, agency_ref: agent.agency_ref, label: agent.label});
  }
  for (const record of readings.communiques ?? []) {
    if (!obj(record) || !within(readings.window, ms(record.sent_at_unix_ms))) continue;
    for (const key of ["from_position_ref", "to_position_ref"] as const) {
      const position = str(record[key]);
      const agent = position ? agentOfPosition(position, readings, attempts) : undefined;
      if (agent && position) add(agent.agent_ref, {position_ref: position, agency_ref: agent.agency_ref, label: agent.label});
    }
  }
  for (const row of populationPositions(readings.population)) {
    const work = obj(row.current_work) ? row.current_work : undefined;
    const occupancy = obj(row.occupancy) ? row.occupancy : undefined;
    if (work?.run_ref === readings.runRef && str(occupancy?.agent_ref)) add(occupancy!.agent_ref as string, {position_ref: str(row.position_ref), agency_ref: str(occupancy!.agency_ref), label: str(row.label)});
  }
  return cast;
}

function custodyRecord(value: unknown): Obj | undefined {
  if (!obj(value)) return undefined;
  if (obj(value.custody)) return value.custody; // factory.work-custody-receipt/v1
  return str(value.custody_ref) ? value : undefined;
}

const agentBinding = (member: CastMember | undefined, state?: CharacterState): Binding | undefined =>
  member ? {kind: "agent", agent_ref: member.agent_ref, label: member.label, ...(member.profile_ref ? {profile_ref: member.profile_ref} : {}), ...(state ? {state} : {})} : undefined;
const personBinding = (ref: string): Binding => ({kind: "agent", agent_ref: ref, label: ref.startsWith("human:") ? "You" : tail(ref) ?? ref});
const bindings = (entries: Record<string, Binding | undefined>): Record<string, Binding> =>
  Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, Binding] => !!entry[1]));
const materialBody = (value: string, maxBytes: number) => {
  if (new TextEncoder().encode(value).byteLength > maxBytes) throw new Error(`Direct reply exceeds the native ${maxBytes}-byte text bound; source cursor remains pending`);
  return value;
};

// ---------------------------------------------------------------------------
// Skill / delegation / tool classification (provider shapes)
// ---------------------------------------------------------------------------

export interface ToolFacts {id?: string; name?: string; input?: unknown; start: boolean; skill?: string; delegate?: {recipient: string; description?: string}}

/** Classify one provider tool-call payload (Pi RPC or ACP). */
export function toolFacts(payload: Obj): ToolFacts {
  const id = str(payload.toolCallId) ?? str(payload.tool_call_id) ?? str(payload.id);
  const piType = str(payload.type);
  const update = str(payload.sessionUpdate);
  const name = str(payload.toolName) ?? str(payload.title) ?? str(payload.kind);
  const input = obj(payload.args) ? payload.args : obj(payload.rawInput) ? payload.rawInput : obj(payload.input) ? payload.input : undefined;
  const start = piType ? piType === "tool_execution_start" : update ? update === "tool_call" : true;
  return {id, name, input, start, ...classifyTool(name, input, payload)};
}

function classifyTool(name: string | undefined, input: Obj | undefined, payload?: Obj): {skill?: string; delegate?: {recipient: string; description?: string}} {
  const bare = (name ?? "").trim();
  const lower = bare.toLowerCase();
  if (lower === "skill" || lower.startsWith("skill:") || lower.startsWith("skill ")) {
    const skill = str(input?.skill) ?? str(input?.name) ?? str(input?.command) ?? bare.replace(/^skill[:\s]+/i, "").trim();
    return {skill: skill || "skill"};
  }
  const path = str(input?.path) ?? str(input?.file_path) ?? str(input?.filePath)
    ?? (payload ? arr(payload.locations).map(location => obj(location) ? str(location.path) : undefined).find(Boolean) : undefined);
  if ((lower === "read" || lower.startsWith("read")) && path && /(^|\/)SKILL\.md$/.test(path)) {
    const parts = path.split("/");
    return {skill: parts[parts.length - 2] ?? "skill"};
  }
  if (lower === "task" || lower === "agent") {
    const recipient = str(input?.subagent_type) ?? str(input?.agent) ?? str(input?.description) ?? "subagent";
    return {delegate: {recipient, description: str(input?.description)}};
  }
  return {};
}

// ---------------------------------------------------------------------------
// The mapping
// ---------------------------------------------------------------------------

const LEG_HOLD: Record<string, string> = {
  cancel_requested: "cancellation requested", cancellation_accepted: "cancelling", process_terminated: "process ended",
  quiescent: "quiescent", detached: "detached", late_result: "late result retained; not incorporated",
};

/** Map every event the readings and journals carry to act operations, in
 * occurrence order, skipping what `cursor.performed` already names. */
export function mapEvents(readings: LiveReadings, journals: LiveJournals, cursor: CursorState = emptyCursor()): ActOp[] {
  return mapEventsWithCursor(readings, journals, cursor).ops;
}

/** The mapping and the journals' carried state (open chunk runs, closed
 * turns) the next pass continues from. */
/** Explicit native session scope lets the same encounter event grammar perform
 * Direct activity without creating Factory attempts, roles or Run identity. */
export interface EncounterScope {
  cast: readonly CastMember[];
  humanRefs: Record<string, string>;
  /** Native text material may carry a bounded complete reply, rather than a
   * collapsed Factory progress caption. */
  replyRole?: "progressText" | "resultText";
  replyChars?: number;
  /** Keep an exchanged message distinct from the undertaking's artifact. */
  messageRole?: string;
  /** The selected shared repertoire may give a native Scene to each phase. */
  phaseScenes?: Partial<Record<CharacterState, RepertoireScene>>;
  worldRef?: string;
}
export function mapEventsWithCursor(readings: LiveReadings, journals: LiveJournals, cursor: CursorState = emptyCursor(), encounterScope?: EncounterScope): {ops: ActOp[]; sessions: Record<string, SessionCursor>} {
  const sessions: Record<string, SessionCursor> = {...(cursor.sessions ?? {})};
  const cast = encounterScope ? [...encounterScope.cast] : castOf(readings);
  const lead = cast[0];
  const byAgent = new Map(cast.map(member => [member.agent_ref, member]));
  const bySession = new Map<string, CastMember>();
  for (const member of cast) for (const session of member.session_refs) bySession.set(session, member);
  const byPosition = new Map(cast.filter(member => member.position_ref).map(member => [member.position_ref!, member]));
  const goal: Binding | undefined = readings.goal ? {kind: "object", subject_ref: readings.runRef, label: readings.goal} : undefined;
  const goalText: Binding | undefined = readings.goal ? {kind: "text", text: readings.goal} : undefined;

  const out: {op: ActOp; order: number; seq: number}[] = [];
  let seq = 0;
  const keys = new Set<string>();
  const emit = (op: ActOp, order?: number) => {
    // A second operation of the same occurrence is its own occurrence.
    if (keys.has(opKey(op))) op.basis = {...op.basis, occurrence: `${op.basis.occurrence}/${op.operation}${"state" in op ? `:${op.state}` : ""}${op.operation === "act_text" ? `:${op.role}` : ""}`};
    keys.add(opKey(op));
    out.push({op, order: order ?? op.basis.at_unix_ms ?? Number.MAX_SAFE_INTEGER, seq: seq++});
  };
  const basis = (entry: string, event_ref: string, occurrence: string, at?: number, detail?: Record<string, unknown>): OpBasis => {
    const inventory = inventoryEntry(entry);
    if (!inventory) throw new Error(`No inventory entry ${entry}`);
    return {family: inventory.family, source: inventory.source, entry, event_ref, occurrence, ...(at !== undefined ? {at_unix_ms: at} : {}), ...(detail ? {detail} : {})};
  };

  // ── factory-attempt ────────────────────────────────────────────────────
  const reading = readingForRun(readings);
  if (reading) {
    const attempts = [...(reading.attempts ?? [])].sort((a, b) => (ms(a.attemptRecordedAt) ?? 0) - (ms(b.attemptRecordedAt) ?? 0));
    const firstOfUnit = new Map<string, string>();
    const byExecution = new Map<string, AttemptRecord>();
    for (const attempt of attempts) {
      if (attempt.executionRef) byExecution.set(attempt.executionRef, attempt);
      const member = attempt.disposition?.participant?.agentRef ? byAgent.get(attempt.disposition.participant.agentRef) : undefined;
      const self = member?.role ?? "participants.0";
      const unit = attempt.workflowUnitRef ?? attempt.attemptRef;
      const unitObject: Binding = {kind: "object", subject_ref: unit, label: tail(attempt.taskRef) ?? tail(unit)};
      const started = ms(attempt.attemptRecordedAt);
      const selected = {skills: attempt.disposition?.praxisRefs ?? [], capabilities: attempt.disposition?.capabilityRefs ?? []};
      const retryOf = firstOfUnit.get(unit);
      if (!retryOf) firstOfUnit.set(unit, attempt.attemptRef);
      if (retryOf || (attempt.reresolutions ?? []).length) {
        const reason = (attempt.reresolutions ?? []).map(entry => str(entry.reason)).find(Boolean);
        emit({operation: "act_select", scene: "continuation",
          bindings: bindings({self: agentBinding(member, "working"), artifact: unitObject, goal, caption: {kind: "text", text: reason ? oneLine(reason) : `Another attempt at ${tail(attempt.taskRef) ?? "the unit"}`}}),
          basis: basis("attempt.retry", attempt.attemptRef, retryOf ? `retry-of:${retryOf}` : "reresolution", started, {retry_of: retryOf, reresolutions: attempt.reresolutions ?? []})}, started);
      } else {
        emit({operation: "act_select", scene: "arrival",
          bindings: bindings({self: agentBinding(member, "working"), lead: agentBinding(lead), goal, artifact: unitObject, caption: goalText}),
          basis: basis("attempt.start", attempt.attemptRef, "start", started, {task_ref: attempt.taskRef, workflow_unit_ref: unit, session_ref: attempt.disposition?.body?.agentSessionRef, ...selected})}, started);
      }
      if (obj(attempt.dispatch)) {
        const phase = str(attempt.dispatch.phase) ?? "dispatched";
        const b = basis("attempt.dispatch", attempt.attemptRef, `dispatch:${str(attempt.dispatch.receiptRef) ?? "0"}`, started, {receipt: attempt.dispatch});
        emit({operation: "act_select", state: "working", role: self, bindings: bindings({self: agentBinding(member, "working")}), basis: b}, started);
        emit({operation: "act_text", role: "progressText", text: `${member?.label ?? "Agent"} · ${phase}`, bindings: {}, basis: b}, started);
      }
      for (const [index, observation] of (attempt.observations ?? []).entries()) {
        const phase = str(observation.phase) ?? "observed";
        emit({operation: "act_select", scene: "work-passage",
          bindings: bindings({self: agentBinding(member, "working"), artifact: unitObject, goal, progressText: {kind: "text", text: `${tail(attempt.taskRef) ?? "work"} · ${phase}`}}),
          basis: basis("attempt.observation", attempt.attemptRef, `observation:${index}:${str(observation.receiptRef) ?? index}`, undefined, {receipt: observation})});
      }
      for (const [index, fact] of (attempt.tracking ?? []).entries()) {
        emit({operation: "act_text", role: "progressText", text: `${str(fact.kind) ?? "fact"} · ${tail(str(fact.subjectRef)) ?? ""}`.trim(), bindings: {},
          basis: basis("attempt.tracking", attempt.attemptRef, `tracking:${index}:${str(fact.factRef) ?? index}`, started, {fact})});
      }
      for (const [index, verification] of (attempt.verifications ?? []).entries()) {
        const ref = str(verification.verificationRef) ?? String(index);
        const outcome = str(verification.outcome) ?? "unknown";
        const obligations = arr(verification.obligations).length;
        emit({operation: "act_select", scene: "review",
          bindings: bindings({lead: agentBinding(member, "speaking"), artifact: unitObject, caption: {kind: "text", text: `${outcome}${obligations ? ` · ${obligations} checked` : ""}`}, outcome: {kind: "value", value: outcome === "passed" ? 1 : outcome === "failed" ? 0 : 0.5}}),
          basis: basis("attempt.verification", attempt.attemptRef, `verification:${index}:${ref}`, ms(attempt.verificationRecordedAt?.[ref]), {verification})});
      }
      const ret = attempt.readableReturn;
      if (ret?.returnRef) {
        const artifact = ret.artifactRefs?.[0];
        emit({operation: "act_text", role: "resultText", text: oneLine(ret.summary ?? "Returned", 280),
          bindings: bindings({artifact: artifact ? {kind: "object", subject_ref: artifact, label: tail(artifact)} : unitObject, self: agentBinding(member, "speaking")}),
          basis: basis("attempt.return", attempt.attemptRef, `return:${ret.returnRef}`, ms(attempt.returnRecordedAt), {readable_return: ret})}, ms(attempt.returnRecordedAt));
        if (ret.receivingRef) {
          emit({operation: "act_select", scene: "continuation", bindings: bindings({self: agentBinding(member, "idle"), goal: unitObject, caption: {kind: "text", text: "Return received"}}),
            basis: basis("attempt.receiving", attempt.attemptRef, `receiving:${ret.receivingRef}`, undefined, {receiving_ref: ret.receivingRef})});
        }
      }
    }
    // Legs: status history in order. A returned unit is retained material;
    // whole Run closure is read independently from its native owner. Failed
    // attempts and late output remain visible while the undertaking continues.
    const legs = reading.legs ?? {};
    for (const [unit, leg] of Object.entries(legs)) {
      const current = [...attempts].reverse().find(attempt => attempt.workflowUnitRef === unit);
      const member = current?.disposition?.participant?.agentRef ? byAgent.get(current.disposition.participant.agentRef) : undefined;
      const history = leg.statusHistory ?? (leg.status ? [leg.status] : []);
      // The owner resets a leg's history on retry, so address each status by
      // the leg's attempt count as well (occurrence addressing).
      const generation = arr(leg.attempts).length || 1;
      for (const [index, status] of history.entries()) {
        const occurrence = `leg:${generation}:${index}:${status}`;
        if (status === "failed") {
          emit({operation: "act_select", scene: "review",
            bindings: bindings({lead: agentBinding(member, "idle"), artifact: {kind: "object", subject_ref: unit, label: tail(current?.taskRef) ?? tail(unit)}, caption: {kind: "text", text: oneLine(leg.failureReason ?? "failed")}, outcome: {kind: "value", value: 0}}),
            basis: basis("attempt.fail", current?.attemptRef ?? unit, occurrence, ms(current?.failureRecordedAt), {failure_reason: leg.failureReason, evidence: current?.failureEvidenceRefs ?? []})}, ms(current?.failureRecordedAt));
        } else if (LEG_HOLD[status]) {
          const b = basis("attempt.leg-hold", current?.attemptRef ?? unit, occurrence, undefined, {status});
          emit({operation: "act_select", state: "idle", role: member?.role ?? "participants.0", bindings: bindings({self: agentBinding(member, "idle")}), basis: b});
          emit({operation: "act_text", role: "caption", text: `${member?.label ?? "Agent"} · ${LEG_HOLD[status]}`, bindings: {}, basis: b});
        }
      }
    }
    if (ownerRunComplete(reading)) {
      const last = [...attempts].reverse().find(attempt => attempt.readableReturn?.summary);
      emit({operation: "act_select", scene: "completion",
        bindings: bindings({...Object.fromEntries(cast.map(member => [member.role, agentBinding(member, "idle")])), lead: agentBinding(lead, "idle"), goal, resultText: last?.readableReturn?.summary ? {kind: "text", text: oneLine(last.readableReturn.summary, 280)} : undefined}),
        basis: basis("attempt.run-complete", readings.runRef, "run-complete", undefined, {completionVerified: reading.completionVerified, wholeRunState: reading.wholeRunState, lifecycle: reading.lifecycle, requiredUnits: reading.requiredUnits, currentReturnedUnits: reading.currentReturnedUnits, revision: reading.revision ?? 0})});
    }
    for (const [executionRef, reviewer] of Object.entries(reading.independentReviewers ?? {})) {
      const attempt = byExecution.get(executionRef);
      const member = attempt?.disposition?.participant?.agentRef ? byAgent.get(attempt.disposition.participant.agentRef) : undefined;
      emit({operation: "act_select", scene: "review", bindings: bindings({lead: agentBinding(member, "working"), caption: {kind: "text", text: `Independent review of ${arr(reviewer.reviewOf).length} unit${arr(reviewer.reviewOf).length === 1 ? "" : "s"}`}}),
        basis: basis("attempt.independent-review", executionRef, "registered", undefined, {reviewer})});
    }
    for (const [ref, synthesis] of Object.entries(reading.syntheses ?? {})) {
      emit({operation: "act_text", role: "resultText", text: oneLine(str(synthesis.integratedDifference) ?? "Synthesised", 280),
        bindings: bindings({artifact: {kind: "object", subject_ref: str(synthesis.synthesisRef) ?? ref, label: str(synthesis.barrierKey)}}),
        basis: basis("attempt.synthesis", str(synthesis.synthesisRef) ?? ref, "synthesised", undefined, {synthesis})});
    }
  }

  // ── factory-telemetry ──────────────────────────────────────────────────
  for (const line of readings.telemetry ?? []) {
    if (!obj(line) || line.type !== "execution-correlation" || line.runRef !== readings.runRef) continue;
    const ref = str(line.correlationRef) ?? str(line.telemetryRef) ?? "correlation";
    emit({operation: "act_text", role: "progressText", text: `Execution correlated · ${tail(str(line.telemetryRef)) ?? ""}`.trim(), bindings: {},
      basis: basis("telemetry.correlation", ref, "correlated", undefined, {line})});
  }

  // ── factory-custody ───────────────────────────────────────────────────
  for (const record of readings.custody ?? []) {
    const custody = custodyRecord(record);
    if (!custody || (str(custody.run_ref) && custody.run_ref !== readings.runRef)) continue;
    const member = str(custody.position_ref) ? byPosition.get(custody.position_ref as string) : undefined;
    const work: Binding = {kind: "object", subject_ref: str(custody.work_ref) ?? str(custody.custody_ref)!, label: tail(str(custody.work_ref))};
    const transitions = arr(custody.transitions).filter(obj).filter(transition => within(readings.window, ms(transition.at_unix_ms)));
    for (const transition of transitions) {
      const to = str(transition.to) ?? "";
      const occurrence = `revision:${String(transition.revision ?? 0)}`;
      const at = ms(transition.at_unix_ms);
      const reason = str(transition.reason);
      if (to === "in-progress") emit({operation: "act_select", scene: "arrival", bindings: bindings({self: agentBinding(member, "working"), goal: work, caption: reason ? {kind: "text", text: oneLine(reason)} : undefined}), basis: basis("custody.in-progress", custody.custody_ref as string, occurrence, at, {custody: {...custody, transitions: undefined}, transition})}, at);
      else if (to === "completed") emit({operation: "act_select", scene: "completion", bindings: bindings({lead: agentBinding(member, "idle"), goal: work, resultText: reason ? {kind: "text", text: oneLine(reason, 280)} : undefined}), basis: basis("custody.completed", custody.custody_ref as string, occurrence, at, {transition})}, at);
      else emit({operation: "act_select", scene: "continuation", bindings: bindings({self: agentBinding(member, "idle"), goal: work, caption: {kind: "text", text: `${to}${reason ? ` · ${oneLine(reason)}` : ""}`}}), basis: basis("custody.released", custody.custody_ref as string, occurrence, at, {transition})}, at);
    }
  }

  // ── aikit-gateway ─────────────────────────────────────────────────────
  for (const row of populationPositions(readings.population)) {
    const occupancy = obj(row.occupancy) ? row.occupancy : undefined;
    if (occupancy?.state !== "occupied") continue;
    const member = str(row.position_ref) ? byPosition.get(row.position_ref as string) : undefined;
    if (!member) continue; // not part of this Run
    // An attempt's start is already this member's arrival in the Run.
    if (member.attempt_refs.length) continue;
    const at = ms(occupancy.since_unix_ms);
    if (!within(readings.window, at)) continue;
    emit({operation: "act_select", scene: "arrival", bindings: bindings({self: agentBinding(member, "idle"), goal}),
      basis: basis("gateway.occupancy", row.position_ref as string, `generation:${str(occupancy.generation_ref) ?? "current"}`, at, {occupancy, current_work: row.current_work})}, at);
  }
  for (const record of readings.communiques ?? []) {
    if (!obj(record) || !str(record.communique_ref) || !within(readings.window, ms(record.sent_at_unix_ms))) continue;
    const from = str(record.from_position_ref), to = str(record.to_position_ref);
    const sender = from ? byPosition.get(from) : undefined, recipient = to ? byPosition.get(to) : undefined;
    const at = ms(record.sent_at_unix_ms);
    const escalated = str(record.escalated_custody_ref);
    emit({operation: "act_select", scene: "handoff",
      bindings: bindings({sender: agentBinding(sender, "speaking") ?? (from ? personBinding(from) : undefined), recipient: agentBinding(recipient, "idle") ?? (to ? personBinding(to) : undefined),
        caption: {kind: "text", text: oneLine(str(record.body) ?? "", 200)}, artifact: escalated ? {kind: "object", subject_ref: escalated, label: "delegated work"} : {kind: "object", subject_ref: record.communique_ref as string, label: "Communique"}}),
      basis: basis("gateway.communique", record.communique_ref as string, `sequence:${String(record.sequence ?? 0)}`, at,
        {communique_ref: record.communique_ref, from, to, body: record.body, state: record.state, reply_to: record.reply_to ?? null, escalated_custody_ref: escalated ?? null})}, at);
  }

  // ── aikit-encounter ───────────────────────────────────────────────────
  for (const [session, events] of Object.entries(journals.encounter ?? {})) {
    const member = bySession.get(session);
    if (encounterScope && (!member || !journals.bounds?.[session] || !encounterScope.humanRefs[session])) {
      throw new Error('Direct journal requires its admitted participant, human and exact work bounds');
    }
    const self = member?.role ?? "participants.0";
    const after = cursor.encounterAfter[session] ?? -1;
    // A chunk run or a closed turn can span passes: carry them in the cursor
    // and key every occurrence by the journal cursor of its originating event.
    const carried = sessions[session] ?? {};
    let run: SessionCursor["run"] = carried.run ? {...carried.run} : undefined;
    let turnClosed = carried.turnClosed ?? false;
    const seenCalls = new Set<string>();
    const jb = (entry: string, eventRef: string, occurrence: string, cursorOf: number, at?: number, detail?: Record<string, unknown>): OpBasis => ({...basis(entry, eventRef, occurrence, at, detail), journal: {session, cursor: cursorOf}});
    const actorBindings = (state: CharacterState) => bindings({[encounterScope ? self : "self"]: agentBinding(member, state)});
    const phaseScene = (state: CharacterState, entry: string, occurrence: string, cursorOf: number, at?: number) => {
      const scene = encounterScope?.phaseScenes?.[state];
      if (scene) emit({operation: "act_select", scene, bindings: actorBindings(state), basis: jb(entry, session, occurrence + "/scene", cursorOf, at)}, at);
    };
    const closeRun = () => {
      if (run?.kind === "reply" && run.text.trim()) emit({operation: "act_text", role: encounterScope?.replyRole ?? "progressText", text: encounterScope ? materialBody(run.text, encounterScope.replyChars ?? 4096) : oneLine(run.text, 240), bindings: {}, basis: jb("encounter.reply", session, `cursor:${run.first}/text`, run.first, run.at)}, run.at);
      run = undefined;
    };
    const bounds = journals.bounds?.[session] ?? journalBounds(events, readings.runRef, new Set(cast.map(candidate => candidate.agent_ref)), readings.window?.to !== undefined);
    for (const entry of events) {
      if (entry.cursor <= after) continue;
      if (entry.cursor < bounds.from || entry.cursor > bounds.to) continue; // this session's other work
      const event = obj(entry.event) ? entry.event : undefined;
      if (!event) continue;
      const at = ms(event.observed_at_ms);
      const kind = str(event.kind);
      const chunkRun = (runKind: "reply" | "thought", text: string) => {
        const scopedReply = encounterScope && runKind === "reply";
        if (run?.kind === runKind) { run.text = scopedReply ? materialBody(run.text + text, encounterScope.replyChars ?? 4096) : (run.text + text).slice(-2000); return; }
        if (scopedReply ? !text.length : !text.trim()) return;
        closeRun();
        run = {kind: runKind, first: entry.cursor, text: scopedReply ? materialBody(text, encounterScope.replyChars ?? 4096) : text.slice(-2000), at};
        turnClosed = false;
        const state = runKind === "reply" ? "speaking" : "working";
        phaseScene(state, runKind === "reply" ? "encounter.reply" : "encounter.thought", `cursor:${entry.cursor}`, entry.cursor, at);
        emit({operation: "act_select", state, role: self, bindings: actorBindings(state),
          basis: jb(runKind === "reply" ? "encounter.reply" : "encounter.thought", session, `cursor:${entry.cursor}`, entry.cursor, at)}, at);
      };
      if (kind === "user-message") {
        closeRun(); turnClosed = false;
        emit({operation: "act_select", scene: "handoff", bindings: bindings({sender: personBinding(encounterScope?.humanRefs[session] ?? "human:owner"), recipient: agentBinding(member, "idle"), caption: {kind: "text", text: oneLine(str(event.text) ?? "", 200)},
          [encounterScope?.messageRole ?? "artifact"]: {kind: "object", subject_ref: `${session}#${entry.cursor}`, label: "Message"}}),
          basis: jb("encounter.user-message", session, `cursor:${entry.cursor}`, entry.cursor, at, {text: event.text})}, at);
        continue;
      }
      if (kind === "agent-message") {
        closeRun(); turnClosed = false;
        const request = obj(event.request) ? event.request : {};
        const submission = obj(request.submission) ? request.submission : {};
        const turn = obj(submission.turn) ? submission.turn : {};
        const packet = obj(turn.packet) ? turn.packet : {};
        const senderRef = str(event.sender) ?? str(turn.sender) ?? str(request.sender) ?? "agent";
        const senderMember = byAgent.get(senderRef);
        // The Run itself addressing an agent (its task dispatch) is the goal
        // handing over, not a person or an agent.
        const qualifiedSender = encounterScope?.worldRef && !senderRef.startsWith("world:") ? `${encounterScope.worldRef}/${senderRef}` : senderRef;
        const senderBinding: Binding = senderRef === readings.runRef ? {kind: "object", subject_ref: readings.runRef, label: readings.goal ?? "The Run"} : agentBinding(senderMember, "speaking") ?? personBinding(qualifiedSender);
        const delivery = str(event.delivery_ref);
        const messageRef = delivery ? encounterScope?.worldRef && !delivery.startsWith("world:") ? `${encounterScope.worldRef}/${delivery}` : delivery : `${session}#${entry.cursor}`;
        emit({operation: "act_select", scene: "handoff", bindings: bindings({sender: senderBinding, recipient: agentBinding(member, "idle"), caption: {kind: "text", text: oneLine(str(packet.text) ?? str(event.text) ?? "", 200)},
          // The exchanged message is the handoff's selectable object.
          [encounterScope?.messageRole ?? "artifact"]: {kind: "object", subject_ref: messageRef, label: "Message"}}),
          basis: jb("encounter.agent-message", encounterScope ? messageRef : str(event.delivery_ref) ?? session, `cursor:${entry.cursor}`, entry.cursor, at, {sender: qualifiedSender, text: packet.text, delivery_ref: event.delivery_ref})}, at);
        continue;
      }
      // Provider events (`kind: "provider"`); trimmed excerpts may omit the
      // kind but keep the owner's `event.Signal` / `event.TurnEnded` envelope.
      const inner = obj(event.event) ? event.event : undefined;
      if (kind !== "provider" && !(inner && (obj(inner.Signal) || obj(inner.TurnEnded)))) continue;
      if (inner && obj(inner.TurnEnded)) {
        closeRun();
        // Keyed by the provider's terminal signal sequence: the `completed`
        // signal and the TurnEnded that closes it are one occurrence, in any
        // pass and after any resume.
        const ended = inner.TurnEnded;
        const terminal = typeof ended.last_sequence === "number" ? `turn-end:${str(event.connection_generation) ?? ""}:${ended.last_sequence}` : `cursor:${entry.cursor}`;
        if (!turnClosed) {
          phaseScene("idle", "encounter.turn-end", terminal, entry.cursor, at);
          emit({operation: "act_select", state: "idle", role: self, bindings: actorBindings("idle"), basis: jb("encounter.turn-end", session, terminal, entry.cursor, at, {stop: ended.stop})}, at);
        }
        turnClosed = false;
        continue;
      }
      const signal = inner && obj(inner.Signal) && obj(inner.Signal.kind) ? inner.Signal.kind : undefined;
      const signalKind = str(signal?.kind);
      if (!signal || !signalKind) continue;
      // Source text is material, not an identity. A whitespace-only chunk
      // inside speech still separates words and must survive concatenation.
      if (signalKind === "agent-message-chunk") { chunkRun("reply", typeof signal.text === "string" ? signal.text : ""); continue; }
      if (signalKind === "agent-thought-chunk") { chunkRun("thought", typeof signal.text === "string" ? signal.text : ""); continue; }
      if (signalKind !== "status") closeRun();
      if (signalKind === "tool-call" || signalKind === "tool-result") {
        const payload = obj(signal.payload) ? signal.payload : {};
        const facts = toolFacts(payload);
        const callId = facts.id ?? `cursor:${entry.cursor}`;
        if (signalKind === "tool-result" || !facts.start || seenCalls.has(callId)) continue; // joins its occurrence
        seenCalls.add(callId);
        const detail = {tool: facts.name, input: facts.input, tool_call_id: facts.id};
        if (facts.skill) emit({operation: "act_gesture", gesture: "invoke-skill", role: self, skill: facts.skill, bindings: bindings({...actorBindings("working"), caption: {kind: "text", text: facts.skill}}), basis: jb("encounter.skill", session, `call:${callId}`, entry.cursor, at, detail)}, at);
        else if (facts.delegate) emit({operation: "act_select", scene: "handoff", bindings: bindings({sender: agentBinding(member, "speaking"), recipient: {kind: "agent", agent_ref: facts.delegate.recipient, label: facts.delegate.recipient}, caption: {kind: "text", text: oneLine(facts.delegate.description ?? facts.delegate.recipient)}}), basis: jb("encounter.delegation", session, `call:${callId}`, entry.cursor, at, detail)}, at);
        else emit({operation: "act_gesture", gesture: "operate", role: self, bindings: bindings({...actorBindings("working"), caption: {kind: "text", text: oneLine(facts.name ?? "tool", 80)}}), basis: jb("encounter.tool-call", session, `call:${callId}`, entry.cursor, at, detail)}, at);
        continue;
      }
      if (signalKind === "completed" || signalKind === "failed" || signalKind === "cancelled") {
        const sequence = obj(inner?.Signal) ? inner!.Signal.sequence : undefined;
        const terminal = typeof sequence === "number" ? `turn-end:${str(event.connection_generation) ?? ""}:${sequence}` : `cursor:${entry.cursor}`;
        phaseScene("idle", "encounter.turn-end", terminal, entry.cursor, at);
        emit({operation: "act_select", state: "idle", role: self, bindings: actorBindings("idle"), basis: jb("encounter.turn-end", session, terminal, entry.cursor, at, {signal: signalKind, reason: signal.stop_reason ?? signal.reason})}, at);
        turnClosed = true;
      }
    }
    sessions[session] = {...(run ? {run} : {}), ...(turnClosed ? {turnClosed} : {})};
  }

  // ── harness-stream (not native) ───────────────────────────────────────
  for (const [session, lines] of Object.entries(journals.harness ?? {})) {
    const member = bySession.get(session) ?? cast.find(candidate => candidate.session_refs.some(ref => ref.endsWith(session)));
    const self = member?.role ?? "participants.0";
    for (const line of lines) {
      if (!obj(line) || line.type !== "assistant" || !obj(line.message)) continue;
      for (const block of arr(line.message.content)) {
        if (!obj(block) || block.type !== "tool_use") continue;
        const id = str(block.id) ?? "tool";
        const name = str(block.name);
        const input = obj(block.input) ? block.input : undefined;
        const facts = classifyTool(name, input);
        const detail = {tool: name, input, tool_use_id: id, session_id: line.session_id};
        if (facts.skill) emit({operation: "act_gesture", gesture: "invoke-skill", role: self, skill: facts.skill, bindings: bindings({self: agentBinding(member, "working"), caption: {kind: "text", text: facts.skill}}), basis: basis("harness.skill", session, `tool_use:${id}`, undefined, detail)});
        else if (facts.delegate) emit({operation: "act_select", scene: "handoff", bindings: bindings({sender: agentBinding(member, "speaking"), recipient: {kind: "agent", agent_ref: facts.delegate.recipient, label: facts.delegate.recipient}, caption: {kind: "text", text: oneLine(facts.delegate.description ?? facts.delegate.recipient)}}), basis: basis("harness.delegation", session, `tool_use:${id}`, undefined, detail)});
        else emit({operation: "act_gesture", gesture: "operate", role: self, bindings: bindings({self: agentBinding(member, "working"), caption: {kind: "text", text: oneLine(name ?? "tool", 80)}}), basis: basis("harness.tool", session, `tool_use:${id}`, undefined, detail)});
      }
    }
  }

  const performed = new Set(cursor.performed);
  // A scoped Direct journal is one native cursor sequence. Wall-clock rollback
  // must not move a turn's completion before its speech or produced text.
  return {ops: out.sort((a, b) => encounterScope ? a.seq - b.seq : a.order - b.order || a.seq - b.seq).map(entry => entry.op).filter(op => !performed.has(opKey(op))), sessions};
}

/** The part of a session's journal that is this Run's work. A session can
 * carry other work before and after the Run (a resident agent's earlier and
 * later turns). The Run's work begins with the Run addressing the agent
 * (an `agent-message` from the Run, or from a cast member when the Run
 * addresses this session at all) and — once the Run is complete — ends with
 * the turn that follows the last message addressed within the Run. Without a Run message the whole journal
 * stands (the session is the attempt's own). */
export function journalBounds(events: readonly JournalEventLike[], runRef: string, castAgents: Set<string>, complete: boolean): {from: number; to: number} {
  const senderOf = (event: Obj) => {
    const request = obj(event.request) ? event.request : {};
    const submission = obj(request.submission) ? request.submission : {};
    const turn = obj(submission.turn) ? submission.turn : {};
    return str(event.sender) ?? str(turn.sender) ?? str(request.sender);
  };
  const messages = events.filter(entry => obj(entry.event) && entry.event.kind === "agent-message");
  const inRun = (entry: JournalEventLike) => { const sender = senderOf(entry.event as Obj); return sender === runRef || (!!sender && castAgents.has(sender)); };
  // The Run's own addressing marks the session as carrying it; its work
  // spans from the first message addressed within the Run (the Run or a cast
  // member — a peer can address the agent before the Run's task arrives).
  if (!messages.some(entry => senderOf(entry.event as Obj) === runRef)) return {from: -Infinity, to: Infinity};
  const first = messages.find(inRun)!;
  if (!complete) return {from: first.cursor, to: Infinity};
  const last = [...messages].reverse().find(inRun)!;
  const end = events.find(entry => entry.cursor > last.cursor && obj(entry.event) && obj(entry.event.event) && obj((entry.event.event as Obj).TurnEnded));
  return {from: first.cursor, to: end ? end.cursor : Infinity};
}

/** The cursor after performing `ops` over these journals. */
export function advanceCursor(cursor: CursorState, ops: readonly ActOp[], journals: LiveJournals = {}, telemetry?: unknown[], attemptRevision?: number, sessions?: Record<string, SessionCursor>): CursorState {
  const performed = [...new Set([...cursor.performed, ...ops.map(opKey)])].slice(-4000);
  const encounterAfter = {...cursor.encounterAfter};
  // A chunk run still open at the end of a page is carried in `sessions`
  // (its originating cursor), so the journal cursor always advances.
  for (const [session, events] of Object.entries(journals.encounter ?? {})) {
    const last = events.reduce((max, entry) => Math.max(max, entry.cursor), encounterAfter[session] ?? -1);
    encounterAfter[session] = last;
  }
  let next: CursorState["telemetry"] = cursor.telemetry;
  for (const line of telemetry ?? []) {
    if (obj(line) && line.type === "cursor" && obj(line.cursor) && typeof line.cursor.stateRevision === "number") next = {stateRevision: line.cursor.stateRevision};
  }
  return {performed, encounterAfter, ...(sessions ?? cursor.sessions ? {sessions: sessions ?? cursor.sessions} : {}), ...(next ? {telemetry: next} : {}), ...(attemptRevision !== undefined ? {attemptRevision} : cursor.attemptRevision !== undefined ? {attemptRevision: cursor.attemptRevision} : {})};
}
