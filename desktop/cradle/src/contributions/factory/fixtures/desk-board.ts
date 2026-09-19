/** Fixture rows for the "Desk — cross-project board" dev scenario (handoff
 * §11): whole Runs across two Projects — parallel work inside one Run,
 * different participants, one Run needing permission, one returning material
 * with a completed review waiting, similar Run names across Projects, and a
 * queued Run. Views are the owner's own `factory.build-view/v1` shape, kept
 * minimal but valid: the board and the Run detail render exactly what they
 * would render from a real read. */
import type {ExecutionTraceView, FactoryBuildView, Status} from "../types";
import type {DeskFixtureRun} from "../desk/deskModel";

const SF_STATE = "/Users/admin/.local/state/oi/testing/factory-desk-provider.json";
const SF_PROJECT = "project:01ARZ3NDEKTSV4RRFFQ69G5FAA";
const OI_PROJECT = "project:01ARZ3NDEKTSV4RRFFQ69G5FB1";

/** A minimal valid build view: everything the contract names, empty unless
 * the scenario overrides it. */
function view(parts: {
  projectRef: string; projectLabel: string; runRef: string; runLabel: string; status: Status;
  frontier: FactoryBuildView["frontier"];
  runs?: Partial<FactoryBuildView>;
}): FactoryBuildView {
  return {
    project: {projectRef: parts.projectRef, label: parts.projectLabel},
    run: {runRef: parts.runRef, runMapRef: `${parts.runRef}/map`, label: parts.runLabel, status: parts.status},
    frontier: parts.frontier,
    claims: [], evidence: [], candidates: [], humanRequests: [], agencies: [], executions: [], trajectories: [], actions: [],
    ...parts.runs,
  };
}

function trace(parts: {
  executionRef: string; projectRef: string; runRef: string; status: Status; request: string;
  agentSessionRef?: string; agentRef?: string; agencyRef?: string; totalTokens?: number;
  spans: ExecutionTraceView["spans"];
}): ExecutionTraceView {
  return {
    executionRef: parts.executionRef, projectRef: parts.projectRef, runRef: parts.runRef,
    status: parts.status, request: parts.request, startedAt: "2026-09-18T09:12:00.000Z",
    agentRef: parts.agentRef, agencyRef: parts.agencyRef, harnessRef: "harness:claude (profile)",
    agentSessionRef: parts.agentSessionRef, totalTokens: parts.totalTokens,
    spans: parts.spans,
  };
}

const span = (ref: string, name: string, kind: ExecutionTraceView["spans"][number]["kind"], status: Status, ownerLabel: string): ExecutionTraceView["spans"][number] =>
  ({spanRef: ref, name, kind, status, startedAt: "2026-09-18T09:12:10.000Z", ownerLabel, events: []});

/** The "Desk — cross-project board" scenario's rows. Keyed by the same
 * (statePath, projectRef, runRef) identity a real read carries. */
export function deskBoardFixture(): DeskFixtureRun[] {
  const sf = {projectRef: SF_PROJECT, projectLabel: "Software Factory"};
  const oi = {projectRef: OI_PROJECT, projectLabel: "O:I Desktop"};
  const at = (runRef: string, project: typeof sf | typeof oi): DeskFixtureRun["locator"] =>
    ({statePath: SF_STATE, projectRef: project.projectRef, runRef, projectLabel: project.projectLabel, centralProject: project.projectLabel === "Software Factory" ? "Factory" : "O-I"});
  return [
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQA", sf),
      view: view({
        ...sf, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQA", runLabel: "Sidebar slice — render lane", status: "running",
        frontier: {subjectRef: "work-node:sf-sidebar-f2", title: "Wire the board's live reads", mode: "work",
          summary: "Two lanes in parallel: the board's source reads and the detail's conversation binding.", closureState: "open"},
        runs: {
          agencies: [
            {agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", label: "Meredith · implementation", position: "local"},
            {agencyRef: "agency:fixture-odonata", agentRef: "agent:fixture:odonata", label: "Odonata · verification", position: "local"},
          ],
          executions: [
            {executionRef: "execution:fixture-lane-render", agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", status: "running", harnessRef: "harness:claude (profile)", agentSessionRef: "agent-session:fixture:meredith-1"},
            {executionRef: "execution:fixture-lane-verify", agencyRef: "agency:fixture-odonata", agentRef: "agent:fixture:odonata", status: "queued", harnessRef: "harness:claude (profile)"},
          ],
          trajectories: [
            trace({executionRef: "execution:fixture-lane-render", projectRef: SF_PROJECT, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQA",
              status: "running", request: "Land the Desk board's source reads.", agentSessionRef: "agent-session:fixture:meredith-1",
              agentRef: "agent:fixture:meredith", agencyRef: "agency:fixture-meredith", totalTokens: 24500,
              spans: [span("fixture-span:board-reads", "read board sources", "agent", "running", "Meredith · implementation")]}),
          ],
          claims: [{claimRef: "claim:fixture-board-reads", statement: "Board rows read only through the owner's own developmental reads.", status: "supported", evidenceRefs: ["evidence:fixture-board-reads"]}],
          evidence: [{evidenceRef: "evidence:fixture-board-reads", label: "Development read contract check", assessment: "supports the read path", producingExecutionRef: "execution:fixture-lane-render"}],
        },
      }),
    },
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQB", sf),
      view: view({
        ...sf, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQB", runLabel: "Documentation pass", status: "blocked",
        frontier: {subjectRef: "work-node:sf-docs-f1", title: "Publishing waits on a permission", mode: "decision",
          summary: "The publish dry-run needs an explicit permit before the notes lane can finish.", closureState: "open", gateState: "awaiting-permission"},
        runs: {
          agencies: [{agencyRef: "agency:fixture-quill", agentRef: "agent:fixture:quill", label: "Quill · notes", position: "local"}],
          executions: [{executionRef: "execution:fixture-docs", agencyRef: "agency:fixture-quill", agentRef: "agent:fixture:quill", status: "blocked", harnessRef: "harness:claude (profile)"}],
          humanRequests: [{humanRequestRef: "human-request:fixture-docs-publish", decisionRef: "decision:fixture-docs-publish",
            question: "Permit `cargo publish --dry-run` for the notes lane?", whyHuman: "Publishing is an outward-facing act; the permit is authorial.",
            blockedExecutionRefs: ["execution:fixture-docs"]}],
        },
      }),
    },
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQC", sf),
      view: view({
        ...sf, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQC", runLabel: "Candidate recognition — desk optic", status: "success",
        frontier: {subjectRef: "candidate:fixture-desk-a", title: "Recognise candidate A, or return it", mode: "recognition",
          summary: "The board optic finished with a retained candidate; recognition is the author's.", closureState: "open", gateState: "awaiting-recognition"},
        runs: {
          agencies: [{agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", label: "Meredith · implementation", position: "local"}],
          executions: [{executionRef: "execution:fixture-desk-a", agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", status: "success", harnessRef: "harness:claude (profile)"}],
          candidates: [{candidateRef: "candidate:fixture-desk-a", revision: 3, label: "Candidate A · Desk optic", status: "ready",
            producingExecutionRefs: ["execution:fixture-desk-a"], claimRefs: ["claim:fixture-desk-a"], evidenceRefs: ["evidence:fixture-desk-a"],
            tradeoffs: ["kanban grouping stays presentation-only"]}],
          claims: [{claimRef: "claim:fixture-desk-a", statement: "The desk renders whole Runs, one card each.", status: "supported", evidenceRefs: ["evidence:fixture-desk-a"]}],
          evidence: [{evidenceRef: "evidence:fixture-desk-a", label: "Board parity check", assessment: "supports the whole-Run card law", producingExecutionRef: "execution:fixture-desk-a"}],
          humanRequests: [{humanRequestRef: "human-request:fixture-desk-a", decisionRef: "decision:fixture-desk-a",
            question: "Recognise candidate A, or request changes?", whyHuman: "Recognition is the author's judgement, not a gate score.",
            evidenceRefs: ["evidence:fixture-desk-a"]}],
        },
      }),
    },
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQD", oi),
      view: view({
        ...oi, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQD", runLabel: "Documentation pass", status: "running",
        frontier: {subjectRef: "work-node:oi-docs-f1", title: "Sweep the desk docs", mode: "work",
          summary: "Same name as the Software Factory lane, a different Run in a different Project.", closureState: "open"},
        runs: {
          agencies: [{agencyRef: "agency:fixture-quill", agentRef: "agent:fixture:quill", label: "Quill · notes", position: "local"}],
          executions: [{executionRef: "execution:fixture-oi-docs", agencyRef: "agency:fixture-quill", agentRef: "agent:fixture:quill", status: "running", harnessRef: "harness:claude (profile)"}],
        },
      }),
    },
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQE", oi),
      view: view({
        ...oi, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQE", runLabel: "Walk harness — desk receipts", status: "queued",
        frontier: {subjectRef: "work-node:oi-walk-f1", title: "Capture the desk walk receipts", mode: "work",
          summary: "Waiting for the render lane to free its lane budget.", closureState: "open"},
        runs: {
          agencies: [{agencyRef: "agency:fixture-odonata", agentRef: "agent:fixture:odonata", label: "Odonata · verification", position: "local"}],
          executions: [{executionRef: "execution:fixture-oi-walk", agencyRef: "agency:fixture-odonata", agentRef: "agent:fixture:odonata", status: "queued", harnessRef: "harness:claude (profile)"}],
        },
      }),
    },
    {
      locator: at("run:01ARZ3NDEKTSV4RRFFQ69G5DQF", oi),
      view: view({
        ...oi, runRef: "run:01ARZ3NDEKTSV4RRFFQ69G5DQF", runLabel: "Chat face polish", status: "success",
        frontier: {subjectRef: "work-node:oi-chat-f3", title: "Full-canvas chat measure", mode: "return",
          summary: "The full-size chat landed; the run closed with its checks green.", closureState: "closed"},
        runs: {
          agencies: [{agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", label: "Meredith · implementation", position: "local"}],
          executions: [{executionRef: "execution:fixture-oi-chat", agencyRef: "agency:fixture-meredith", agentRef: "agent:fixture:meredith", status: "success", harnessRef: "harness:claude (profile)"}],
        },
      }),
    },
  ];
}
