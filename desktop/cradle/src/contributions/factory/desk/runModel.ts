/**
 * The Desk and Run page read model (11-FACTORY §0, §2, §3) — pure functions
 * over the owner's own readings, no kernel, no React. Every value a card or a
 * page shows is derived here from a real field; a field the owner does not
 * write stays absent (the renderer omits the line), never a guess.
 *
 * Readings consumed (all Factory's own contracts, carried verbatim):
 *   factory.project-location/v1   — discovery (`factory project locate`)
 *   factory.project-reading/v1    — journeys → run refs
 *   factory.journey-reading/v1    — commission.purpose, startedAt, sessions, returns, recognitions
 *   factory.run-reading/v1        — lifecycle, destination, run map, actions, executions, human requests
 *   factory.workflow-inspection/v1 — units, legs, barriers, attempts, telemetry
 *
 * The rules the design makes checkable live here so they can be unit-tested:
 * the title is the purpose's first sentence (fallback: the destination slug
 * made readable — never a ref); the project is a NAME; units are segments
 * shaded by leg standing (never a percentage); a run needs you when a human
 * request is open or a returned Return awaits Recognition.
 */

// ---------------------------------------------------------------------------
// Owner reading shapes (only the fields this model reads)
// ---------------------------------------------------------------------------

export interface ProjectLocation {
  contract?: string; projectKey?: string; projectRef: string; projectRoot?: string; statePath: string;
  status?: string; runCount?: number; centralProjectRef?: string | null;
}
export interface ProjectReading { projectRef?: string; journeys?: {journeyRef: string; status?: string; frontier?: string; runRefs?: string[]}[] }
export interface JourneyReturnRow { return_ref?: string; returnRef?: string; summary?: string; run_refs?: string[]; runRefs?: string[]; recognition_ref?: string | null; recognitionRef?: string | null; evidence_refs?: string[]; basis_refs?: string[] }
export interface JourneyRecognitionRow { recognition_ref?: string; recognitionRef?: string; subject_ref?: string; subjectRef?: string }
export interface JourneyReading {
  journeyRef: string; projectRef?: string; status?: string; frontier?: string;
  commission?: {purpose?: string; commission_ref?: string};
  runRefs?: string[]; agentSessionRefs?: string[];
  participants?: {participant_ref?: string; role?: string}[];
  returns?: JourneyReturnRow[]; recognitions?: JourneyRecognitionRow[];
  startedAt?: string | null; completedAt?: string | null;
}
export type RunNodeKind = "destination" | "position" | "work" | "decision" | "candidate" | "gate" | "authority" | "nested_run";
export interface RunMapNode { id: string; kind: RunNodeKind | string; label: string; state?: string | null; semanticRef?: string | null }
export interface RunMapEdge { from: string; to: string; relation: string }
export interface RunAction { actionRef: string; label: string; subjectKinds?: string[]; currentlyApplicable?: boolean; applicableSubjectRefs?: string[]; requiredCapabilityRef?: string }
export interface RunExecution { executionRef: string; status?: string; agencyRef?: string; agentRef?: string; harnessRef?: string; agentSessionRef?: string; sessionSpaceRef?: string | null; surfaceRefs?: string[]; workcellBindingRefs?: string[] }
export interface RunAgency { agencyRef: string; agentRef?: string; label?: string }
export interface RunHumanRequest { humanRequestRef: string; question?: string; whyHuman?: string; decisionRef?: string }
export interface RunReading {
  runRef: string; revision?: number; projectRef?: string; owningJourneyRefs?: string[];
  lifecycle?: string; destination?: string;
  runMap?: {nodes?: Record<string, RunMapNode>; edges?: RunMapEdge[]};
  agencies?: RunAgency[]; executions?: RunExecution[]; humanRequests?: RunHumanRequest[];
  candidates?: {candidateRef: string; label?: string; status?: string}[];
  claims?: unknown[]; evidence?: unknown[];
  actions?: RunAction[];
}
export interface WorkflowUnit {
  workflowUnitRef: string; key?: string; developmentalConcern?: string; requiredDifference?: string;
  requiredReturn?: {contract?: string; address?: string}; requiredVerification?: string[];
  agentRequirements?: {agentRefs?: string[]; agencyRefs?: string[]; agentSetRefs?: string[]};
  dependencies?: string[]; barrierRelations?: unknown[]; nesting?: {childUnitRefs?: string[]; parentUnitRefs?: string[]};
  permittedEffects?: string[]; stopConditions?: string; escalationConditions?: string; basisRevision?: string;
}
export interface InspectionLeg { status?: string | null; executionRef?: string | null; failureReason?: string | null; requiredVerification?: string[]; standing?: string }
export interface InspectionVerification { verificationRef?: string; ownerRef?: string; sourceRevision?: string; outcome?: "passed" | "failed" | "unknown" | string; obligations?: string[]; evidenceRefs?: string[] }
export interface InspectionAttempt {
  attemptRef: string; taskRef?: string; workflowUnitRef: string; executionRef?: string | null; reservedExecutionRef?: string;
  currentAttempt?: boolean; status?: string | null;
  participant?: {agentRef?: string; agencyRef?: string; profileRef?: string};
  body?: {modelRef?: string; providerRef?: string; routeRef?: string; harnessRef?: string; agentSessionRef?: string; sessionSpaceRef?: string; workcellRef?: string; materialWorldRef?: string};
  verification?: InspectionVerification[]; totalVerifications?: number;
  return?: {returnRef?: string; summary?: string; artifactRefs?: string[]; evidenceRefs?: string[]} | null;
  ownerObservations?: {phase?: string; contract?: string; receiptRef?: string}[];
}
export interface WorkflowInspection {
  contract?: string; revision?: number; runRef?: string;
  units?: WorkflowUnit[]; legs?: Record<string, InspectionLeg>;
  barriers?: {key: string; waitsFor?: string[]; releases?: string[]; notReturned?: string[]; complete?: boolean}[];
  attempts?: InspectionAttempt[]; telemetry?: {telemetryRef: string; workflowUnitRef?: string; executionRef?: string}[];
  totalAttempts?: number; totalUnits?: number;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** The first sentence of a purpose — up to the first sentence-ending stop
 * followed by a space and a capital/digit, or the whole text. */
export function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const match = /^(.+?[.!?])(?=\s+[A-Z0-9"“(])/.exec(trimmed);
  return (match ? match[1] : trimmed).replace(/[.]$/, "");
}

/** A destination slug made readable: `oi-65/native-conversation-identity-v3`
 * → "Native conversation identity v3" (the last path segment, separators to
 * spaces, first letter capitalised). */
export function readableSlug(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? slug;
  const words = last.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

const REF_LIKE = /^(run|project|journey|workflow-unit|execution|agency|agent|attempt|task|return|recognition):\S+$/;
/** The card and page title: the commission purpose's first sentence, else the
 * destination made readable. Never a `run:`/`project:` ref. */
export function runTitle(purpose: string | undefined, destination: string | undefined, runRef: string): string {
  const fromPurpose = purpose?.trim() ? firstSentence(purpose) : "";
  if (fromPurpose && !REF_LIKE.test(fromPurpose)) return fromPurpose;
  if (destination?.trim() && !REF_LIKE.test(destination.trim())) return readableSlug(destination.trim());
  // Nothing readable was written by the owner: say so in words.
  void runRef;
  return "Untitled run";
}

/** The project NAME from the owner's project key: `central-project:Factory` →
 * "Factory", `control:root` → "Central", percent-encoded keys decoded. When
 * the key still names a ref after decoding, the Central project (the Work
 * folder the source was located in) is the name. */
export function projectName(projectKey: string | undefined, centralProject?: string): string | undefined {
  if (projectKey === "control:root") return "Central";
  if (projectKey?.startsWith("central-project:")) {
    let name = projectKey.slice("central-project:".length);
    try { name = decodeURIComponent(name); } catch { /* keep the raw words */ }
    if (name && !name.includes(":")) return name;
  }
  return centralProject;
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type RunState = "queued" | "running" | "blocked" | "success" | "fail" | "cancelled";
/** The owner's lifecycle word → the Desk's state (Factory's own run_status
 * mapping, build.rs). */
export function runState(lifecycle: string | undefined): RunState {
  switch (lifecycle) {
    case "seeded": return "queued";
    case "active": case "finishing": return "running";
    case "waiting_human": case "waiting-human": case "suspended": return "blocked";
    case "finished": case "archived": return "success";
    case "aborted": return "fail";
    default: return "queued";
  }
}
export const RUN_STATE_WORD: Record<RunState, string> = {queued: "Queued", running: "Running", blocked: "Blocked", success: "Succeeded", fail: "Failed", cancelled: "Cancelled"};
export const RUN_STATE_GLYPH: Record<RunState, string> = {queued: "○", running: "●", blocked: "!", success: "✓", fail: "×", cancelled: "×"};

/** The frontier node exactly as Factory materialises it: the first node in
 * the state order active, ready, blocked, waiting, returned. */
export function frontierNode(run: RunReading): RunMapNode | undefined {
  const nodes = Object.values(run.runMap?.nodes ?? {});
  for (const state of ["active", "ready", "blocked", "waiting", "returned"]) {
    const found = nodes.find(node => node.state === state);
    if (found) return found;
  }
  return undefined;
}

export type LegStanding = "not-started" | "active" | "returned" | "failed";
/** A unit's leg standing, from the inspection's leg when read, else the run
 * map node's own state. */
export function legStanding(node: RunMapNode, leg?: InspectionLeg): LegStanding {
  const status = leg?.status ?? undefined;
  if (status) {
    if (status === "returned" || status === "late_result" || status === "late-result") return "returned";
    if (status === "failed") return "failed";
    return "active";
  }
  switch (node.state) {
    case "active": return "active";
    case "returned": case "satisfied": return "returned";
    case "abandoned": return "failed";
    default: return "not-started";
  }
}

export interface UnitSegment { id: string; label: string; standing: LegStanding; unitRef?: string }
/** One segment per work unit, in the map's own order, shaded by standing. */
export function unitSegments(run: RunReading, inspection?: WorkflowInspection): UnitSegment[] {
  const order = mapOrder(run);
  return order
    .map(id => run.runMap?.nodes?.[id])
    .filter((node): node is RunMapNode => !!node && node.kind === "work")
    .map(node => ({id: node.id, label: node.label, unitRef: node.semanticRef ?? undefined,
      standing: legStanding(node, node.semanticRef ? inspection?.legs?.[node.semanticRef] : undefined)}));
}

/** Returns on the journey that no Recognition names yet. */
export function pendingRecognitions(journey: JourneyReading | undefined, runRef?: string): JourneyReturnRow[] {
  if (!journey) return [];
  const recognised = new Set((journey.recognitions ?? []).map(link => link.subject_ref ?? link.subjectRef).filter(Boolean));
  return (journey.returns ?? []).filter(row => {
    const ref = row.return_ref ?? row.returnRef;
    if (!ref || recognised.has(ref) || row.recognition_ref || row.recognitionRef) return false;
    const runs = row.run_refs ?? row.runRefs;
    return !runRef || !runs?.length || runs.includes(runRef);
  });
}

// ---------------------------------------------------------------------------
// The Desk card
// ---------------------------------------------------------------------------

export interface DeskSourceRef { statePath: string; projectRef: string; projectKey?: string; project?: string; root?: string }
export interface DeskCard {
  key: string;
  source: DeskSourceRef;
  runRef: string; journeyRef?: string;
  state: RunState;
  title: string; purpose?: string;
  next?: string;
  units: UnitSegment[];
  needsYou: number; blocked: boolean;
  agents: string[];
  projectName?: string;
  startedAt?: string;
}
export type DeskColumn = "needs-you" | "active" | "queued" | "recent";
export const DESK_COLUMNS: {key: DeskColumn; label: string}[] = [
  {key: "needs-you", label: "Needs you"}, {key: "active", label: "Active"}, {key: "queued", label: "Queued"}, {key: "recent", label: "Recent"},
];
export const cardKey = (source: DeskSourceRef, runRef: string) => `${source.statePath}\u0000${source.projectRef}\u0000${runRef}`;

export function deskCard(source: DeskSourceRef, run: RunReading, journey?: JourneyReading, inspection?: WorkflowInspection): DeskCard {
  const state = runState(run.lifecycle);
  const frontier = frontierNode(run);
  const needsYou = (run.humanRequests?.length ?? 0) + pendingRecognitions(journey, run.runRef).length;
  const agents = [...new Set([
    ...(run.agencies ?? []).map(agency => agency.label ?? "").filter(Boolean),
  ])];
  return {
    key: cardKey(source, run.runRef),
    source, runRef: run.runRef, journeyRef: journey?.journeyRef ?? run.owningJourneyRefs?.[0],
    state,
    title: runTitle(journey?.commission?.purpose, run.destination, run.runRef),
    purpose: journey?.commission?.purpose?.trim() || undefined,
    next: frontier && frontier.kind !== "destination" ? frontier.label : undefined,
    units: unitSegments(run, inspection),
    needsYou, blocked: state === "blocked",
    agents,
    projectName: projectName(source.projectKey, source.project),
    startedAt: journey?.startedAt ?? undefined,
  };
}

export function deskColumn(card: DeskCard): DeskColumn {
  if (card.needsYou > 0 || card.blocked) return "needs-you";
  if (card.state === "running") return "active";
  if (card.state === "queued") return "queued";
  return "recent";
}

/** Two-letter avatar initials from a name. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).replace(/^./, c => c.toUpperCase());
}

/** The search haystack for one card — words a person reads, never refs. */
export function cardMatches(card: DeskCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [card.title, card.purpose, card.next, card.projectName, ...card.agents].filter(Boolean).join(" ").toLowerCase().includes(q);
}

// ---------------------------------------------------------------------------
// The run map, laid out (§3.2)
// ---------------------------------------------------------------------------

/** Node ids in map order: by column (edge depth), then lane. */
export function mapOrder(run: RunReading): string[] {
  return [...layoutRunMap(run).cells].sort((a, b) => a.column - b.column || a.lane - b.lane).map(cell => cell.id);
}

/** Column per node: the longest edge path reaching it from a root (a node no
 * edge points to). Cycles are cut at the first revisit. */
export function mapDepths(run: RunReading): Record<string, number> {
  const nodes = run.runMap?.nodes ?? {};
  const edges = (run.runMap?.edges ?? []).filter(edge => nodes[edge.from] && nodes[edge.to]);
  const incoming = new Map<string, RunMapEdge[]>();
  for (const edge of edges) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  const memo: Record<string, number> = {};
  const visit = (id: string, trail: Set<string>): number => {
    if (memo[id] !== undefined) return memo[id];
    if (trail.has(id)) return 0;
    trail.add(id);
    const parents = incoming.get(id) ?? [];
    const value = parents.length ? Math.max(...parents.map(edge => visit(edge.from, trail) + 1)) : 0;
    trail.delete(id);
    memo[id] = value;
    return value;
  };
  for (const id of Object.keys(nodes)) visit(id, new Set());
  return memo;
}

export interface MapCell { id: string; node: RunMapNode; column: number; lane: number; frontier: boolean }
export interface MapLayout {
  cells: MapCell[];
  lanes: number; columns: number;
  edges: (RunMapEdge & {fromCell: MapCell; toCell: MapCell})[];
  /** Gates as bars spanning the lanes of the units they hold. */
  gates: {cell: MapCell; laneFrom: number; laneTo: number}[];
  workUnits: number;
}
/** The SSSF multi-lane map: one lane per work unit (in edge order), columns
 * by edge depth; the destination and gates sit on the lane of their first
 * neighbour; a gate's bar spans every lane it touches. */
export function layoutRunMap(run: RunReading): MapLayout {
  const nodes = run.runMap?.nodes ?? {};
  const edges = (run.runMap?.edges ?? []).filter(edge => nodes[edge.from] && nodes[edge.to]);
  const depth = mapDepths(run);
  const frontier = frontierNode(run);
  const ids = Object.keys(nodes).sort((a, b) => (depth[a] ?? 0) - (depth[b] ?? 0) || a.localeCompare(b));
  const lanes = new Map<string, number>();
  let next = 0;
  for (const id of ids) if (nodes[id].kind !== "destination" && nodes[id].kind !== "gate") lanes.set(id, next++);
  const neighbourLanes = (id: string) => edges.flatMap(edge => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : [])
    .map(other => lanes.get(other)).filter((lane): lane is number => lane !== undefined);
  for (const id of ids) {
    if (lanes.has(id)) continue;
    const touching = neighbourLanes(id);
    lanes.set(id, touching.length ? Math.min(...touching) : 0);
  }
  const cells: MapCell[] = ids.map(id => ({id, node: nodes[id], column: depth[id] ?? 0, lane: lanes.get(id) ?? 0, frontier: frontier?.id === id}));
  const byId = new Map(cells.map(cell => [cell.id, cell]));
  // A gate holds the units it requires (its outgoing `requires` edges); its
  // bar spans exactly their lanes (falling back to every neighbour).
  const gates = cells.filter(cell => cell.node.kind === "gate").map(cell => {
    const held = edges.filter(edge => edge.from === cell.id && edge.relation === "requires").map(edge => lanes.get(edge.to)).filter((lane): lane is number => lane !== undefined);
    const touching = held.length ? held : neighbourLanes(cell.id).concat(cell.lane);
    cell.lane = Math.min(...touching);
    return {cell, laneFrom: Math.min(...touching), laneTo: Math.max(...touching)};
  });
  return {
    cells,
    lanes: Math.max(1, next),
    columns: Math.max(1, ...cells.map(cell => cell.column + 1)),
    edges: edges.map(edge => ({...edge, fromCell: byId.get(edge.from)!, toCell: byId.get(edge.to)!})),
    gates,
    workUnits: cells.filter(cell => cell.node.kind === "work").length,
  };
}

export const EDGE_WORD: Record<string, string> = {
  requires: "requires", branches_to: "branches to", returns_to: "returns to", nests: "nests",
  converges_to: "converges to", realises: "realises", supersedes: "supersedes",
};

// ---------------------------------------------------------------------------
// Checks, attempts, Return (§3.2 detail band, §3.4 Live, §3.5 Handoff)
// ---------------------------------------------------------------------------

export type CheckState = "passed" | "failed" | "outstanding";
export interface CheckRow { text: string; state: CheckState; revision?: string }
/** Each required check with its state from the unit's attempts' verification
 * receipts: failed wins over passed (a failed required check never disappears
 * into a green aggregate); no receipt naming it = outstanding. */
export function unitChecks(required: string[] | undefined, attempts: InspectionAttempt[]): CheckRow[] {
  const receipts = attempts.flatMap(attempt => attempt.verification ?? []);
  return (required ?? []).map(text => {
    const naming = receipts.filter(receipt => (receipt.obligations ?? []).includes(text));
    const failed = naming.find(receipt => receipt.outcome === "failed");
    const passed = naming.find(receipt => receipt.outcome === "passed");
    const chosen = failed ?? passed;
    return {text, state: failed ? "failed" : passed ? "passed" : "outstanding", revision: chosen?.sourceRevision};
  });
}

export function attemptsFor(inspection: WorkflowInspection | undefined, unitRef: string | undefined): InspectionAttempt[] {
  if (!unitRef) return [];
  return (inspection?.attempts ?? []).filter(attempt => attempt.workflowUnitRef === unitRef);
}

export function unitOf(inspection: WorkflowInspection | undefined, unitRef: string | undefined): WorkflowUnit | undefined {
  if (!unitRef) return undefined;
  return inspection?.units?.find(unit => unit.workflowUnitRef === unitRef);
}

/** A ref's readable tail: `agent/oh-i` → "oh-i", `harness:pi-rpc` → "pi-rpc". */
export function refTail(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const tail = ref.split(/[:/]/).filter(Boolean).pop();
  return tail || ref;
}

/** The primary action: the first currentlyApplicable native action; the
 * others go to the ⋯ menu. */
export function splitActions(actions: RunAction[] | undefined): {primary?: RunAction; others: RunAction[]} {
  const applicable = (actions ?? []).filter(action => action.currentlyApplicable);
  return {primary: applicable[0], others: applicable.slice(1)};
}
