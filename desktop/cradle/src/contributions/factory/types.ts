/** Factory's shared execution status vocabulary (Factory build-view schema,
 * contracts/factory/build-view.schema.json, ui/factory-desk-fixes b4c0ed0):
 * run statuses plus the execution-only 'returned' and 'contract-fixture'. */
export type Status = 'queued' | 'running' | 'blocked' | 'returned' | 'success' | 'fail' | 'cancelled' | 'contract-fixture'
export type ViewDepth = 'semantic' | 'live' | 'trajectory'

export type TraceEventKind =
  | 'phase_start'
  | 'phase_end'
  | 'agent_start'
  | 'agent_end'
  | 'tool_call'
  | 'handoff'
  | 'gate_pass'
  | 'gate_fail'
  | 'log'
  | 'error'
  | 'process'
  | 'permission'
  | 'artifact'
  | 'evidence'
  | 'model'
  | 'actuation'

export interface NativeTraceLink {
  kind: string
  ref: string
  url?: string
  fingerprint?: string
}

export interface ToolCallDetail {
  tool: string
  args?: unknown
  result?: unknown
  error?: string
  ok?: boolean
  durationMs?: number
  agentRef?: string
  nativeRef?: string
}

export interface TraceEvent {
  eventRef: string
  kind: TraceEventKind
  timestamp: string
  endedAt?: string
  name?: string
  parentRef?: string
  spanRef?: string
  projectRef: string
  runRef: string
  executionRef: string
  agentRef?: string
  agencyRef?: string
  actuationRef?: string
  harnessRef?: string
  agentSessionRef?: string
  /** null = the producer reported no SessionSpace bound (see ExecutionTraceView). */
  sessionSpaceRef?: string | null
  workcellBindingRef?: string
  status?: Status
  severity?: 'info' | 'warning' | 'error'
  payload?: unknown
  toolCall?: ToolCallDetail
  nativeRef?: string
}

export interface TraceSpan {
  spanRef: string
  nativeSpanRef?: string
  name: string
  description?: string
  kind: 'engineer' | 'code' | 'agent' | 'process' | 'other'
  status: Status
  startedAt?: string
  endedAt?: string
  attempt?: number
  retries?: number
  agentRef?: string
  agencyRef?: string
  ownerLabel?: string
  modelLabel?: string
  error?: string
  events: TraceEvent[]
}

export interface ExecutionTraceView {
  executionRef: string
  projectRef: string
  runRef: string
  status: Status
  request?: string
  startedAt?: string
  endedAt?: string
  agentRef?: string
  agencyRef?: string
  harnessRef?: string
  harnessCompositionRef?: string
  harnessCompositionRevision?: number
  harnessCompositionFingerprint?: string
  agentSessionRef?: string
  /**
   * Opaque AIKit-owned SessionSpace identity. Factory's execution condition
   * (factory/src/build.rs ExecutionRecord.session_space_ref,
   * developmental_read.rs FactoryExecutionCondition) carries it as
   * Option<String>; a trajectory says "no SessionSpace bound" with null
   * rather than inventing a ref. Consumers treat null and undefined alike.
   */
  sessionSpaceRef?: string | null
  /** AIKit-owned Surface refs from the same execution condition (surface_refs). */
  surfaceRefs?: string[]
  workcellBindingRefs?: string[]
  totalTokens?: number
  totalCost?: number
  spans: TraceSpan[]
  nativeTrajectory?: NativeTraceLink
}

export interface ClaimView {
  claimRef: string
  statement: string
  status: 'standing' | 'challenged' | 'supported' | 'superseded'
  evidenceRefs: string[]
}

export interface EvidenceView {
  evidenceRef: string
  label: string
  assessment?: string
  nativeRef?: string
  producingExecutionRef?: string
}

export interface CandidateView {
  candidateRef: string
  revision: number
  label: string
  status: 'developing' | 'ready' | 'recognised' | 'returned' | 'rejected'
  producingExecutionRefs: string[]
  claimRefs: string[]
  evidenceRefs: string[]
  artifactRefs?: string[]
  previewRef?: string
  tradeoffs?: string[]
}

/** Factory's native HumanRequestRecord decision fields, retained verbatim.
 * Their presence classifies an owner's record for presentation; it grants no
 * human or execution authority and never constructs a native response. */
export interface UnitDecisionBasisView {
  workflowUnitRef: string
  attemptRef: string
  executionRef: string
  subjectRef: string
  subjectRevision: string
  workflowSourceRef: string
  workflowSourceRevision: string
  workflowSourceDigest: string
  resolverRef: string
  controlled: boolean
}

export interface UnitDecisionResponseView {
  responseRef: string
  resolverRef: string
  channelReceiptRef: string
  sourceRevision: string
  outcome: 'resume' | 'cancel'
  evidenceRefs: string[]
  controlled: boolean
}

export interface UnitDecisionRetirementView {
  reason: string
  replacementBasisRefs: string[]
  observedProviderRevision: number
}

export interface HumanRequestView {
  humanRequestRef: string
  decisionRef: string
  question: string
  whyHuman: string
  blockedExecutionRefs?: string[]
  evidenceRefs?: string[]
  unitDecisionBasis?: UnitDecisionBasisView | null
  unitDecisionResponse?: UnitDecisionResponseView | null
  unitDecisionRetirement?: UnitDecisionRetirementView | null
}

export interface LiveAgencyView {
  agencyRef: string
  agentRef: string
  label: string
  position?: 'root' | 'local' | 'participating'
  rootScopeRef?: string
  metagencyGrantRefs?: string[]
  actuationRef?: string
  returnRef?: string
  returnState?: string
}

export interface LiveExecutionView {
  executionRef: string
  agencyRef?: string
  agentRef?: string
  status: Status
  harnessRef?: string
  harnessCompositionRef?: string
  agentSessionRef?: string
  sessionSpaceRef?: string
  surfaceRefs?: string[]
  workcellBindingRefs?: string[]
  nativeTrajectoryRef?: string
}

export interface FactoryActionView {
  actionRef: string
  label: string
  subjectKinds: Array<'run' | 'candidate' | 'execution' | 'human-request'>
  requiredCapabilityRef?: string
}

export interface FrontierView {
  subjectRef: string
  title: string
  mode: 'work' | 'decision' | 'verification' | 'recognition' | 'return'
  summary: string
  closureState?: string
  gateState?: string
}

export interface FactoryBuildView {
  project: {
    projectRef: string
    label: string
  }
  run: {
    runRef: string
    runMapRef: string
    label: string
    status: Status
  }
  frontier: FrontierView
  claims: ClaimView[]
  evidence: EvidenceView[]
  candidates: CandidateView[]
  humanRequests: HumanRequestView[]
  agencies: LiveAgencyView[]
  executions: LiveExecutionView[]
  trajectories: ExecutionTraceView[]
  actions: FactoryActionView[]
}

export interface ActionInvocation {
  actionRef: string
  subjectRef: string
}

/** A produced Factory subject the Desk can open in the material reading —
 * the owner's own candidate/evidence ref plus its label, never a target the
 * owner did not disclose. (Donor parity: PR #292 types.ts.) */
export interface FactoryMaterialSelection {
  subjectRef: string
  label: string
}
