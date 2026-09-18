/**
 * The Factory sidebar's shared model (FACTORY-UI-INTEGRATION-HANDOFF §4/§8):
 * two small module stores, no second authority path.
 *
 * 1. `FactorySelection` — the run the centre has actually read. The centre
 *    surface publishes; the Run/Context planes read. One selection, two
 *    views of it — the sidebar never re-reads over the centre's shoulder.
 *
 * 2. The dev fixture store — labelled typed scenarios behind
 *    `import.meta.env.DEV`, never bundled into a production path. Controls
 *    inside a scenario mutate the fixture's working copy, so an interaction
 *    really changes the state the views render; nothing here ever reaches
 *    native data.
 */
import {useSyncExternalStore} from "react";
import type {FactoryBuildView, Status} from "../types";
import type {EncounterRow} from "../../../encounter/EncounterList";

/** What the composition root lends the Factory sidebar planes: the real ways
 * to reach the rest of the app, so a control never has to fake an outcome. */
export interface FactoryPanelHost {
  /** Focus the centre's full SSSF multi-lane Run view (the factory surface). */
  onOpenFullRun?: () => void;
  /** Switch the Factory sidebar to another top-level plane (e.g. Context for a comparison). */
  onOpenPlane?: (plane: "run" | "agents" | "factory-context") => void;
  /** Open a conversation as the centre's Chat tab (the one open path). */
  onOpenEncounterRow?: (row: EncounterRow) => void;
}

// ---------------------------------------------------------------------------
// 1. The centre ↔ sidebar run selection
// ---------------------------------------------------------------------------

export interface FactorySelection {
  statePath: string;
  projectRef: string;
  runRef?: string;
  /** The centre's verified build view, when its last read produced one. */
  view?: FactoryBuildView;
  /** The owner's project reading, when the centre read one (journey registry). */
  project?: unknown;
  observedAtUnixMs?: number;
}

let selection: FactorySelection | undefined;
const selectionListeners = new Set<() => void>();
export function publishFactorySelection(next: FactorySelection) {
  selection = next;
  for (const listener of [...selectionListeners]) listener();
}
export function peekFactorySelection(): FactorySelection | undefined { return selection; }
function subscribeSelection(listener: () => void) {
  selectionListeners.add(listener);
  return () => { selectionListeners.delete(listener); };
}
export function useFactorySelection(): FactorySelection | undefined {
  return useSyncExternalStore(subscribeSelection, () => selection, () => selection);
}

// ---------------------------------------------------------------------------
// 2. Dev fixture scenarios
// ---------------------------------------------------------------------------

export type FixtureCapabilityState = "selected" | "projected" | "brokered" | "effective" | "unknown" | "pending-reload";
/** A skill can additionally sit at "eligible" — discoverable, not yet part of
 * the worker's set — which is a skill fact, never a capability state. */
export type FixtureSkillState = FixtureCapabilityState | "eligible";
export interface FixtureCapability { name: string; target?: string; permission: "granted" | "refused" | "unknown"; availability: "available" | "unavailable" | "pending-reload" | "unknown"; state: FixtureCapabilityState }
export interface FixtureSkill { name: string; source: string; revision?: string; scope?: string; state: FixtureSkillState; eligible?: boolean }
export interface FixtureRoutine { ref: string; purpose: string; trigger: string; enabled: boolean; last?: string; next?: string; inFlight?: boolean }
export interface FixtureAgent {
  ref: string; name: string; purpose: string;
  availability: "active" | "idle" | "offline" | "unknown";
  team?: string; assignment?: string; needsInput?: string;
  skills: FixtureSkill[];
  capabilities: FixtureCapability[];
  routines: FixtureRoutine[];
  setup: { model?: string; harness?: string; environment?: string };
  conversations: { ref: string; title: string; state: string }[];
}
export interface FixtureTeam { ref: string; name: string; purpose: string; lead?: string; members: string[]; assignments: { agentRef: string; work: string; scope: string }[] }
export interface FixtureProposal {
  intent: string; stale?: boolean;
  skills: { name: string; reason: string; source: string; revision?: string; scope?: string; prerequisites?: string[]; excluded?: boolean }[];
  gaps: string[];
}
export interface FixtureStep {
  ref: string; label: string; lane: string; status: Status; assignee?: string;
  attempt?: number; retries?: number; blockedBy?: string; failedVerification?: string;
  tokens?: number; durationMs?: number;
}
export interface FixtureTrajectoryRow { id: number; kind: "user" | "assistant" | "tool" | "permission" | "error" | "completed"; label: string; detail: string; agent?: string; stepRef?: string }
export interface FixtureCheck { ref: string; attachedTo: string; statement: string; state: "standing" | "challenged" | "supported" | "superseded"; evidence: string[] }
export interface FixtureCandidate {
  ref: string; label: string; revision: string; status: "developing" | "ready" | "recognised" | "returned" | "rejected";
  producer?: string; body: string; diff?: string; check?: string; checkStale?: boolean;
  git?: { basis: string; target: string; state: "committed" | "staged" | "dirty" | "untracked" };
}
export interface FixtureSource { ref: string; kind: "file" | "link" | "passage" | "pool" | "prior-result"; title: string; detail?: string; included: boolean; loadedFor: string[]; body?: string }
export interface FixtureReturn { ref: string; from: string; subject: string; native: "inbox" | "day" | "now"; state: "pending review" | "delivered" | "included"; body: string; runRef?: string }
export interface FixtureRun {
  ref: string; label: string; purpose: string; outcomeOwner: string; state: Status; nextDecision?: string;
  steps: FixtureStep[];
  trajectory: FixtureTrajectoryRow[];
  checks: FixtureCheck[];
  /** Produced material retained by the run — the Context plane's Produced group. */
  candidates: FixtureCandidate[];
  arrivals: number;
}

export interface SidebarFixture {
  scenario: string;
  run?: FixtureRun;
  agents: FixtureAgent[];
  teams: FixtureTeam[];
  sources: FixtureSource[];
  returns: FixtureReturn[];
  proposal?: FixtureProposal;
  degraded?: { provider?: string; search?: string; skill?: string };
}

const TOOL_ROW = (id: number, label: string, detail: string, agent?: string, stepRef?: string): FixtureTrajectoryRow =>
  ({id, kind: "tool", label, detail, agent, stepRef});

function base(scenario: string, extra: Partial<SidebarFixture>): SidebarFixture {
  return {
    scenario,
    agents: [],
    teams: [],
    sources: [],
    returns: [],
    ...extra,
  };
}

/** The labelled scenarios (handoff §8). Each is a factory function: the store
 * deep-clones what it returns, so scenario controls mutate a working copy. */
export const SCENARIOS: {key: string; label: string}[] = [
  {key: "empty", label: "Empty → organised"},
  {key: "team", label: "Configured team"},
  {key: "running", label: "Multi-lane running"},
  {key: "blocked", label: "Blocked → resolved"},
  {key: "review", label: "Produced → review"},
  {key: "history", label: "Historical + arrivals"},
  {key: "degraded", label: "Degraded states"},
];

const WORKER: FixtureAgent = {
  ref: "agent:fixture:meredith", name: "Meredith", purpose: "Implements the accepted slice and keeps its checks green.",
  availability: "active", team: "team:fixture:desking", assignment: "Run fixture/run-1 · lane render", needsInput: undefined,
  skills: [
    {name: "rust-build-repair", source: "AIKit Method kit/methods/rust-build-repair@v7", revision: "v7", scope: "project", state: "effective"},
    {name: "walk-authoring", source: "AIKit SkillSet cradle/walks@v3", revision: "v3", scope: "project", state: "projected"},
    {name: "cargo-udeps-sweep", source: "AIKit Method kit/methods/cargo-udeps@v2", revision: "v2", state: "eligible", eligible: true},
  ],
  capabilities: [
    {name: "Edit project files", target: "Work/O-I/desktop/cradle", permission: "granted", availability: "available", state: "selected"},
    {name: "Run cargo test", target: "Work/O-I", permission: "granted", availability: "available", state: "brokered"},
    {name: "Push to origin", permission: "refused", availability: "unavailable", state: "unknown"},
    {name: "Read Workcell secrets", permission: "unknown", availability: "pending-reload", state: "pending-reload"},
  ],
  routines: [
    {ref: "routine:fixture:nightly-green", purpose: "Re-run the affected suites after the nightly merge window", trigger: "schedule 02:00 local", enabled: true, last: "2026-09-18 02:00 — green", next: "2026-09-19 02:00"},
    {ref: "routine:fixture:stale-check", purpose: "Sweep stale checks after source edits", trigger: "after run step completes", enabled: false, last: "2026-09-16 14:10 — 3 revalidated"},
  ],
  setup: {model: "provider policy: project default", harness: "claude (profile)", environment: "this Mac, project worktree"},
  conversations: [{ref: "agent-session:fixture:meredith-1", title: "Render lane — slice 3", state: "open"}],
};
const REVIEWER: FixtureAgent = {
  ref: "agent:fixture:odonata", name: "Odonata", purpose: "Independent verification of retained candidates before recognition.",
  availability: "idle", team: "team:fixture:desking", assignment: "Candidate verification (2 waiting)",
  skills: [{name: "independent-verification", source: "Guardian repertoire — Software Factory", revision: "v11", scope: "suite", state: "effective"}],
  capabilities: [{name: "Read candidates and checks", permission: "granted", availability: "available", state: "effective"}],
  routines: [], setup: {model: "provider policy: suite default"},
  conversations: [],
};
const OFFLINE_MEMBER: FixtureAgent = {
  ref: "agent:fixture:quill", name: "Quill", purpose: "Documentation passes and handoff notes.",
  availability: "offline", team: "team:fixture:desking",
  skills: [], capabilities: [], routines: [], setup: {}, conversations: [],
};

function deskingTeam(): FixtureTeam {
  return {
    ref: "team:fixture:desking", name: "Desking", purpose: "The Factory sidebar slice: render lane, verification, notes.",
    lead: "agent:fixture:meredith", members: ["agent:fixture:meredith", "agent:fixture:odonata", "agent:fixture:quill"],
    assignments: [
      {agentRef: "agent:fixture:meredith", work: "Run fixture/run-1 · lane render", scope: "bounded to this run"},
      {agentRef: "agent:fixture:odonata", work: "Verify retained candidates", scope: "read + checks only"},
    ],
  };
}

function runningRun(): FixtureRun {
  return {
    ref: "run:fixture:1", label: "Sidebar slice — render lane", purpose: "Land the Run/Agents/Context sidebar with real controls.",
    outcomeOwner: "Desking (lead: Meredith)", state: "running", nextDecision: undefined,
    arrivals: 0,
    steps: [
      {ref: "step:fixture:compose", label: "Compose sidebar planes", lane: "render", status: "success", assignee: "Meredith", tokens: 18400, durationMs: 96_000},
      {ref: "step:fixture:wire", label: "Wire scenario controls", lane: "render", status: "running", assignee: "Meredith", attempt: 1, tokens: 6100},
      {ref: "step:fixture:verify", label: "Verify against the handoff", lane: "verification", status: "queued", assignee: "Odonata"},
      {ref: "step:fixture:notes", label: "Handoff notes", lane: "notes", status: "blocked", assignee: "Quill", blockedBy: "Waiting on the render lane's summary"},
    ],
    trajectory: [
      {id: 1, kind: "user", label: "Land the sidebar slice", detail: "Three tabs — Run, Agents, Context. Controls must really change state.", stepRef: "step:fixture:compose"},
      {id: 2, kind: "assistant", label: "Plan accepted — three planes, one fixture store", detail: "Run carries trajectory; Agents carries skills; Context carries sources and produced material.", agent: "Meredith"},
      TOOL_ROW(3, "Edit sidebar/RunPlane.tsx", "wrote 214 lines — plane head, lanes, decisions", "Meredith", "step:fixture:compose"),
      TOOL_ROW(4, "Bash: cargo test -p ctrl", "test result: ok. 41 passed; 0 failed", "Meredith", "step:fixture:compose"),
      {id: 5, kind: "completed", label: "Compose step finished", detail: "Checks green; verification lane still queued.", stepRef: "step:fixture:compose"},
      TOOL_ROW(6, "Edit sidebar/AgentsPlane.tsx", "wrote 188 lines — roster, detail, suggest-skills", "Meredith", "step:fixture:wire"),
    ],
    checks: [
      {ref: "check:fixture:1", attachedTo: "step:fixture:compose", statement: "cargo test -p ctrl green on the touched crates", state: "supported", evidence: ["tool block 4: 41 passed, 0 failed"]},
      {ref: "check:fixture:2", attachedTo: "run:fixture:1", statement: "Independent verification of the retained candidate", state: "challenged", evidence: ["Odonata has not begun — lane queued"]},
    ],
    candidates: [],
  };
}

function reviewCandidates(): FixtureCandidate[] {
  return [
    {
      ref: "candidate:fixture:a", label: "Sidebar slice — candidate A (held revision)", revision: "rev-0a11", status: "ready", producer: "Meredith · step:fixture:compose",
      body: "The three-tab sidebar with the scenario bar. Run absorbs trajectory; Agents absorbs skills and tools; Context absorbs results.\n\nControls: every scenario control mutates this fixture through the store, so what you press is what the views render.",
      diff: "+ Run | Agents | Context\n- Trajectory | Context | Inspect | Skills & tools | Claims & evidence | Results\n+ scenario store with seven labelled states",
      check: "cargo test -p ctrl — 41 passed (rev-0a11)", checkStale: false,
      git: {basis: "main f617fd5a", target: "sidebar/ working tree", state: "dirty"},
    },
    {
      ref: "candidate:fixture:b", label: "Sidebar slice — candidate B (comparison)", revision: "rev-7b22", status: "developing", producer: "Meredith · step:fixture:wire",
      body: "Same arrangement, but Run also absorbs the decisions list and Context drops the prior-results group.",
      check: "checked against rev-0a11's suite run — now stale", checkStale: true,
      git: {basis: "main f617fd5a", target: "sidebar/ working tree", state: "untracked"},
    },
  ];
}

const SCENARIO_FACTORIES: Record<string, () => SidebarFixture> = {
  empty: () => base("empty", {
    agents: [], teams: [], sources: [], returns: [],
  }),
  team: () => base("team", {
    agents: [WORKER, REVIEWER, OFFLINE_MEMBER],
    teams: [deskingTeam()],
    sources: [
      {ref: "source:fixture:handoff", kind: "file", title: "FACTORY-UI-INTEGRATION-HANDOFF.md", detail: "docs/experience · rev adbd014", included: true, loadedFor: ["agent:fixture:meredith"], body: "# Factory UI handoff — Run / Agents / Context\n\nExactly three top-level Factory sidebar tabs…"},
      {ref: "source:fixture:desk-types", kind: "passage", title: "deskTypes.ts — the held-state store", detail: "desktop/cradle/src/agent/desk", included: true, loadedFor: [], body: "export function useDeskState…"},
      {ref: "source:fixture:pr-379", kind: "link", title: "PR #379 — design source", detail: "EpiLogos/O-I · open", included: false, loadedFor: []},
    ],
    returns: [],
  }),
  running: () => base("running", {
    run: runningRun(),
    agents: [WORKER, REVIEWER],
    teams: [deskingTeam()],
    sources: [SCENARIO_FACTORIES.team!().sources[0]],
    returns: [],
  }),
  blocked: () => {
    const run = runningRun();
    run.state = "blocked";
    run.nextDecision = "Permit `cargo publish --dry-run` for the render lane? (Meredith, step:fixture:wire)";
    run.steps = [
      {ref: "step:fixture:compose", label: "Compose sidebar planes", lane: "render", status: "success", assignee: "Meredith", tokens: 18400, durationMs: 96_000},
      {ref: "step:fixture:wire", label: "Wire scenario controls", lane: "render", status: "blocked", assignee: "Meredith", attempt: 2, retries: 1, blockedBy: "Permission: cargo publish --dry-run"},
      {ref: "step:fixture:verify", label: "Verify against the handoff", lane: "verification", status: "fail", assignee: "Odonata", failedVerification: "Scenario 3 check — no labelled blocker reachability", attempt: 1},
      {ref: "step:fixture:notes", label: "Handoff notes", lane: "notes", status: "success", assignee: "Quill"},
    ];
    run.trajectory = [
      ...run.trajectory,
      {id: 7, kind: "permission", label: "Permission requested: cargo publish --dry-run", detail: "Meredith asks to run a dry-run publish for the render lane. Scope: this run only.", agent: "Meredith", stepRef: "step:fixture:wire"},
      {id: 8, kind: "error", label: "Verification leg failed", detail: "check:fixture:2 — the blocker was not reachable from another open tab.", agent: "Odonata", stepRef: "step:fixture:verify"},
      {id: 9, kind: "completed", label: "Handoff notes finished", detail: "Notes written; no open blockers on the notes lane.", agent: "Quill", stepRef: "step:fixture:notes"},
    ];
    return base("blocked", {
      run,
      agents: [WORKER, REVIEWER, OFFLINE_MEMBER],
      teams: [deskingTeam()],
      sources: [SCENARIO_FACTORIES.team!().sources[0]],
      returns: [],
    });
  },
  review: () => {
    const run = runningRun();
    run.state = "success";
    run.nextDecision = "Recognise candidate A, or request changes?";
    run.candidates = reviewCandidates();
    return base("review", {
      run,
      agents: [WORKER, REVIEWER],
      teams: [deskingTeam()],
      sources: [SCENARIO_FACTORIES.team!().sources[0]],
      returns: [
        {ref: "return:fixture:1", from: "Meredith · run:fixture:1", subject: "Sidebar slice ready for review", native: "inbox", state: "pending review", body: "The three-tab sidebar is complete on the fixture. Candidate A is ready; candidate B is held for comparison. Request changes or recognise.", runRef: "run:fixture:1"},
      ],
    });
  },
  history: () => {
    const run = runningRun();
    run.arrivals = 2;
    run.trajectory = [
      ...run.trajectory,
      {id: 10, kind: "tool", label: "Bash: cargo test -p ctrl (rerun)", detail: "test result: ok. 41 passed; 0 failed", agent: "Meredith", stepRef: "step:fixture:wire"},
      {id: 11, kind: "assistant", label: "Newer result — candidate A restated", detail: "The render lane re-reported candidate A after the rerun.", agent: "Meredith", stepRef: "step:fixture:wire"},
    ];
    return base("history", {run, agents: [WORKER, REVIEWER], teams: [deskingTeam()], sources: [], returns: []});
  },
  degraded: () => {
    const run = runningRun();
    run.steps = run.steps.map(step => step.ref === "step:fixture:wire" ? {...step, status: "fail" as Status, failedVerification: "provider unavailable — no model session could open"} : step);
    run.trajectory = [...run.trajectory, {id: 12, kind: "error", label: "Provider unreachable", detail: "The configured provider refused connection; the lane stops instead of pretending to wait.", agent: "Meredith", stepRef: "step:fixture:wire"}];
    return base("degraded", {
      run,
      agents: [WORKER, REVIEWER],
      teams: [deskingTeam()],
      sources: [SCENARIO_FACTORIES.team!().sources[0]],
      returns: [],
      degraded: {
        provider: "The configured provider is unreachable — reads that need a model say so instead of empty-successing.",
        search: "AIKit search is partially indexed — results may be stale; direct ripgrep path still answers.",
        skill: "Skill companion for `walk-authoring` is missing its shipped files — the skill reports, it does not silently skip.",
      },
    });
  },
};

let fixture: SidebarFixture | undefined;
const fixtureListeners = new Set<() => void>();
function emitFixture() { for (const listener of [...fixtureListeners]) listener(); }
function subscribeFixture(listener: () => void) {
  fixtureListeners.add(listener);
  return () => { fixtureListeners.delete(listener); };
}
/** The dev scenario bar mounts this; a production build never calls it. */
export function setScenario(key: string) {
  const factory = SCENARIO_FACTORIES[key];
  fixture = factory ? structuredClone(factory()) : undefined;
  emitFixture();
}
export function exitScenarios() { fixture = undefined; emitFixture(); }
export function activeScenario(): string | undefined { return fixture?.scenario; }
export function useFactoryFixture(): SidebarFixture | undefined {
  return useSyncExternalStore(subscribeFixture, () => fixture, () => fixture);
}

// --- scenario mutations: controls inside a scenario really change it -------

// Every mutation clones: the store's snapshot must change identity or
// useSyncExternalStore never re-renders the planes reading it.
function mutate(edit: (data: SidebarFixture) => void) {
  if (!fixture) return;
  const next = structuredClone(fixture);
  edit(next);
  fixture = next;
  emitFixture();
}

export function resolvePermission(stepRef: string) {
  mutate(data => {
    const run = data.run; if (!run) return;
    const step = run.steps.find(candidate => candidate.ref === stepRef);
    if (step && step.status === "blocked") { step.status = "running"; step.blockedBy = undefined; }
    run.trajectory = [...run.trajectory, {id: nextRowId(run), kind: "completed", label: "Permission granted", detail: `The requested permission on ${stepRef} was granted; the lane resumed.`, stepRef}];
    if (run.nextDecision?.startsWith("Permit")) run.nextDecision = undefined;
  });
}

export function refusePermission(stepRef: string) {
  mutate(data => {
    const run = data.run; if (!run) return;
    const step = run.steps.find(candidate => candidate.ref === stepRef);
    if (step && step.status === "blocked") { step.status = "cancelled"; step.blockedBy = "Permission refused — the lane stops"; }
    run.trajectory = [...run.trajectory, {id: nextRowId(run), kind: "completed", label: "Permission refused", detail: `${stepRef} stops; no retry was attempted.`, stepRef}];
    if (run.nextDecision?.startsWith("Permit")) run.nextDecision = undefined;
  });
}

export function retryStep(stepRef: string) {
  mutate(data => {
    const run = data.run; if (!run) return;
    const step = run.steps.find(candidate => candidate.ref === stepRef); if (!step) return;
    // Unknown/late effects demand reconciliation before a consequential
    // retry: the fixture keeps that honest by forcing the attempt up and
    // naming the reconciliation, never silently resetting to green.
    step.attempt = (step.attempt ?? 1) + 1;
    step.retries = (step.retries ?? 0) + 1;
    if (step.status === "fail") { step.status = "running"; step.failedVerification = undefined; }
    if (step.status === "cancelled") step.status = "running";
    run.trajectory = [...run.trajectory, {id: nextRowId(run), kind: "tool", label: `Retry ${step.label}`, detail: `Attempt ${step.attempt} after reconciling prior effects (late results held explicit).`, agent: step.assignee, stepRef}];
  });
}

export function appendArrival() {
  mutate(data => {
    const run = data.run; if (!run) return;
    const row: FixtureTrajectoryRow = TOOL_ROW(nextRowId(run), `Live update ${nextRowId(run)}`, "A new event arrived while the view was held on history.", "Meredith");
    run.trajectory = [...run.trajectory, row];
    if (run.arrivals !== undefined) run.arrivals += 1;
  });
}

export function markArrivalsSeen() {
  mutate(data => { const run = data.run; if (run && run.arrivals) run.arrivals = 0; });
}

export function produceArtifact() {
  mutate(data => {
    const run = data.run; if (!run) return;
    const index = run.candidates.length + 1;
    run.candidates = [...run.candidates, {
      ref: `candidate:fixture:new-${index}`, label: `Produced just now (${index})`, revision: `rev-live-${index}`, status: "developing", producer: "Meredith · live",
      body: "A partial artifact produced by the scenario control — it appears in Context › Produced immediately, as real produced work would.",
      check: undefined, checkStale: undefined,
    }];
  });
}

export function proposeSkills(agentRef: string, intent: string) {
  mutate(data => {
    const agent = data.agents.find(candidate => candidate.ref === agentRef); if (!agent) return;
    data.proposal = {
      intent,
      skills: [
        {name: "cargo-udeps-sweep", reason: "The intent names keeping Rust checks honest; this method sweeps unused dependencies before review.", source: "AIKit Method kit/methods/cargo-udeps@v2", revision: "v2", scope: "project", prerequisites: ["cargo installed on the working host"]},
        {name: "walk-authoring", reason: "The intent asks for try-it-now UI proof; this SkillSet authors walk scenarios against the dev server.", source: "AIKit SkillSet cradle/walks@v3", revision: "v3", scope: "project"},
      ],
      gaps: ["No eligible skill covers the named-availability disclosure for offline team members — named, not invented."],
    };
  });
}

export function toggleProposalSkill(name: string) {
  mutate(data => {
    const proposal = data.proposal; if (!proposal) return;
    proposal.skills = proposal.skills.map(skill => skill.name === name ? {...skill, excluded: !skill.excluded} : skill);
  });
}

export function applyProposal(agentRef: string) {
  mutate(data => {
    const agent = data.agents.find(candidate => candidate.ref === agentRef); if (!agent || !data.proposal) return;
    for (const skill of data.proposal.skills) {
      if (skill.excluded) continue;
      const existing = agent.skills.find(entry => entry.name === skill.name);
      if (existing) existing.state = "selected";
      else agent.skills = [...agent.skills, {name: skill.name, source: skill.source, revision: skill.revision, scope: skill.scope, state: "selected"}];
    }
    data.proposal = undefined;
  });
}

export function markProposalStale() {
  mutate(data => { if (data.proposal) data.proposal.stale = true; });
}

export function toggleRoutine(agentRef: string, routineRef: string) {
  mutate(data => {
    const agent = data.agents.find(candidate => candidate.ref === agentRef); if (!agent) return;
    const routine = agent.routines.find(candidate => candidate.ref === routineRef); if (!routine) return;
    routine.enabled = !routine.enabled;
  });
}

export function addSource(source: Omit<FixtureSource, "included" | "loadedFor">) {
  mutate(data => {
    if (data.sources.some(existing => existing.ref === source.ref)) return;
    data.sources = [...data.sources, {...source, included: true, loadedFor: []}];
  });
}

export function setSourceIncluded(ref: string, included: boolean) {
  mutate(data => { data.sources = data.sources.map(source => source.ref === ref ? {...source, included} : source); });
}

export function reuseAsInput(candidateRef: string) {
  mutate(data => {
    const run = data.run; if (!run) return;
    const candidate = run.candidates.find(entry => entry.ref === candidateRef); if (!candidate) return;
    const ref = `source:from:${candidateRef}`;
    if (data.sources.some(existing => existing.ref === ref)) return;
    data.sources = [...data.sources, {ref, kind: "prior-result", title: candidate.label, detail: `revision ${candidate.revision} — reused by reference`, included: true, loadedFor: [], body: candidate.body}];
  });
}

export function acceptReturn(ref: string) {
  mutate(data => {
    data.returns = data.returns.map(entry => entry.ref === ref ? {...entry, state: "included" as const} : entry);
  });
}

function nextRowId(run: FixtureRun): number {
  return run.trajectory.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

// --- Agents-plane mutations --------------------------------------------------

export function createFixtureKind(kind: "agent" | "team", name: string, purpose: string) {
  mutate(data => {
    if (kind === "agent") {
      const ref = `agent:fixture:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (data.agents.some(existing => existing.ref === ref)) return;
      data.agents = [...data.agents, {
        ref, name, purpose: purpose || "Created in the fixture — purpose is the intent you typed.", availability: "idle",
        skills: [], capabilities: [], routines: [], setup: {}, conversations: [],
      }];
    } else {
      const ref = `team:fixture:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (data.teams.some(existing => existing.ref === ref)) return;
      data.teams = [...data.teams, {ref, name, purpose: purpose || "Created in the fixture.", members: [], assignments: []}];
    }
  });
}

export function removeTeamMember(teamRef: string, memberRef: string) {
  mutate(data => {
    data.teams = data.teams.map(team => team.ref === teamRef ? {...team, members: team.members.filter(ref => ref !== memberRef)} : team);
  });
}

export function assignTeamWork(teamRef: string, agentRef: string, work: string) {
  mutate(data => {
    data.teams = data.teams.map(team => team.ref === teamRef ? {...team, assignments: [...team.assignments, {agentRef, work, scope: "bounded to this team's purpose"}]} : team);
  });
}

export function discardProposal() {
  mutate(data => { data.proposal = undefined; });
}
