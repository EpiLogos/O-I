import type { ExecutionTraceView, FactoryBuildView } from '../types'
import { sssfParityTrace } from './sssf-parity'

export const dshMaximalTrace: ExecutionTraceView = {
  executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG',
  projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA',
  runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB',
  status: 'success',
  request: 'Evaluate a maximal native trajectory without flattening it into Factory portable trace.',
  startedAt: '2026-08-16T20:01:00.000Z',
  endedAt: '2026-08-16T20:01:21.000Z',
  agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD',
  agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE',
  harnessRef: 'harness:deepseek-ai/dsh',
  harnessCompositionRef: 'harness-composition:dsh-maximal-001',
  harnessCompositionRevision: 4,
  harnessCompositionFingerprint: 'sha256:dsh-maximal-cordis-a7f9',
  agentSessionRef: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FBF',
  workcellBindingRefs: ['workcell-binding:ubuntu-gpu-01', 'workcell-binding:preview-01'],
  totalTokens: 26310,
  totalCost: 0.071,
  nativeTrajectory: { kind: 'dsh-session-events', ref: 'dsh-session:01JMAXIMAL', fingerprint: 'sha256:dsh-maximal-cordis-a7f9' },
  spans: [
    {
      spanRef: 'factory-span:dsh-request', nativeSpanRef: 'dsh:request', name: 'request', description: 'Commission the semantic act.', kind: 'engineer', status: 'success',
      startedAt: '2026-08-16T20:01:00.000Z', endedAt: '2026-08-16T20:01:01.000Z', ownerLabel: 'engineer', events: [],
    },
    {
      spanRef: 'factory-span:dsh-build', nativeSpanRef: 'dsh:turn:42', name: 'develop candidate', description: 'One portable span aligned to a richer DSH SessionEvent trajectory.', kind: 'agent', status: 'success',
      startedAt: '2026-08-16T20:01:01.000Z', endedAt: '2026-08-16T20:01:16.000Z', ownerLabel: 'Mahāmāyā · implementation agency',
      agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', modelLabel: 'deepseek-v4-flash', events: [
        { eventRef: 'event:dsh-model-1', kind: 'model', timestamp: '2026-08-16T20:01:01.100Z', name: 'model turn started', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', harnessRef: 'harness:deepseek-ai/dsh', agentSessionRef: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FBF', nativeRef: 'dsh:event:1042' },
        { eventRef: 'event:dsh-read-1', kind: 'tool_call', timestamp: '2026-08-16T20:01:05.000Z', endedAt: '2026-08-16T20:01:05.114Z', name: 'read_file', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', harnessRef: 'harness:deepseek-ai/dsh', agentSessionRef: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FBF', status: 'success', toolCall: { tool: 'read_file', args: { path: 'factory-ui/src/BuildSurface.tsx' }, result: 'read 98 lines', ok: true, durationMs: 114, agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', nativeRef: 'dsh:event:1044' }, nativeRef: 'dsh:event:1044' },
        { eventRef: 'event:dsh-permission-1', kind: 'permission', timestamp: '2026-08-16T20:01:07.000Z', name: 'target-native permission response', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', harnessRef: 'harness:deepseek-ai/dsh', status: 'success', payload: { decision: 'allow-once', protocol: 'target-native', factoryHumanRequest: false }, nativeRef: 'dsh:event:1046' },
        { eventRef: 'event:dsh-process-1', kind: 'process', timestamp: '2026-08-16T20:01:10.000Z', endedAt: '2026-08-16T20:01:13.500Z', name: 'preview process', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', harnessRef: 'harness:deepseek-ai/dsh', workcellBindingRef: 'workcell-binding:preview-01', status: 'success', payload: { processRef: 'process:dsh-preview', serviceRef: 'service:candidate-preview', exitCode: 0 }, nativeRef: 'dsh:event:1050' },
        { eventRef: 'event:dsh-artifact-1', kind: 'artifact', timestamp: '2026-08-16T20:01:15.000Z', name: 'candidate artifact emitted', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', harnessRef: 'harness:deepseek-ai/dsh', status: 'success', payload: { artifactRef: 'artifact:01ARZ3NDEKTSV4RRFFQ69G5FCA' }, nativeRef: 'dsh:event:1054' },
      ],
    },
    {
      spanRef: 'factory-span:dsh-verify', nativeSpanRef: 'dsh:check:17', name: 'verify', description: 'Deterministic check and evidence emission.', kind: 'code', status: 'success',
      startedAt: '2026-08-16T20:01:16.000Z', endedAt: '2026-08-16T20:01:21.000Z', ownerLabel: 'code', events: [
        { eventRef: 'event:dsh-test-1', kind: 'tool_call', timestamp: '2026-08-16T20:01:16.300Z', name: 'npm test', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', harnessRef: 'harness:deepseek-ai/dsh', status: 'success', toolCall: { tool: 'bash', args: { command: 'npm test' }, result: '18 passed', ok: true, durationMs: 4240, nativeRef: 'dsh:event:1059' }, nativeRef: 'dsh:event:1059' },
        { eventRef: 'event:dsh-evidence-1', kind: 'evidence', timestamp: '2026-08-16T20:01:20.700Z', name: 'verification evidence', projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FBG', harnessRef: 'harness:deepseek-ai/dsh', status: 'success', payload: { evidenceRef: 'evidence:01ARZ3NDEKTSV4RRFFQ69G5FCB' }, nativeRef: 'dsh:event:1061' },
      ],
    },
  ],
}

export const factoryBuildFixture: FactoryBuildView = {
  project: { projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA', label: 'Software Factory' },
  run: { runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', runMapRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB/map', label: 'Build source-faithful Factory GUI', status: 'running' },
  frontier: { subjectRef: 'work-node:factory-gui-f1', title: 'Choose the execution optic that preserves meaning and evidence', mode: 'recognition', summary: 'The source-faithful execution view is proven; compare a maximal DSH-backed candidate with the thinner SSSF/Pi path without collapsing either native record.', closureState: 'open', gateState: 'awaiting-recognition' },
  claims: [
    { claimRef: 'claim:01ARZ3NDEKTSV4RRFFQ69G5FDA', statement: 'The maximal trajectory preserves target-native composition and process evidence.', status: 'supported', evidenceRefs: ['evidence:01ARZ3NDEKTSV4RRFFQ69G5FCB'] },
    { claimRef: 'claim:01ARZ3NDEKTSV4RRFFQ69G5FDB', statement: 'The thinner SSSF path is sufficient only if missing native process/composition detail stays explicitly unavailable.', status: 'supported', evidenceRefs: ['evidence:sssf-parity'] },
    { claimRef: 'claim:01ARZ3NDEKTSV4RRFFQ69G5FDC', statement: 'A single winner score is enough to recognise the better Candidate.', status: 'challenged', evidenceRefs: ['evidence:tradeoff-contradiction'] },
  ],
  evidence: [
    { evidenceRef: 'evidence:01ARZ3NDEKTSV4RRFFQ69G5FCB', label: 'DSH deterministic verification', assessment: 'supports maximal native trajectory retention', nativeRef: 'dsh:event:1061', producingExecutionRef: dshMaximalTrace.executionRef },
    { evidenceRef: 'evidence:sssf-parity', label: 'Pinned SSSF source-parity fixture', assessment: 'supports faithful thin-path degradation', nativeRef: 'sssf:adw-parity-001', producingExecutionRef: sssfParityTrace.executionRef },
    { evidenceRef: 'evidence:tradeoff-contradiction', label: 'Candidate trade-off evidence', assessment: 'contradicts collapse to one scalar score' },
  ],
  candidates: [
    { candidateRef: 'candidate:01ARZ3NDEKTSV4RRFFQ69G5FAC', revision: 2, label: 'Candidate A · DSH maximal', status: 'ready', producingExecutionRefs: [dshMaximalTrace.executionRef], claimRefs: ['claim:01ARZ3NDEKTSV4RRFFQ69G5FDA'], evidenceRefs: ['evidence:01ARZ3NDEKTSV4RRFFQ69G5FCB'], artifactRefs: ['artifact:01ARZ3NDEKTSV4RRFFQ69G5FCA'], previewRef: 'preview:factory-gui-a', tradeoffs: ['rich native trajectory and process evidence', 'target composition remains external provenance'] },
    { candidateRef: 'candidate:01ARZ3NDEKTSV4RRFFQ69G5FEC', revision: 1, label: 'Candidate B · SSSF thin', status: 'ready', producingExecutionRefs: [sssfParityTrace.executionRef], claimRefs: ['claim:01ARZ3NDEKTSV4RRFFQ69G5FDB'], evidenceRefs: ['evidence:sssf-parity'], previewRef: 'preview:factory-gui-b', tradeoffs: ['source-faithful execution optic', 'no native process/composition record at pinned SSSF revision'] },
  ],
  humanRequests: [
    { humanRequestRef: 'human-request:factory-gui-recognition', decisionRef: 'decision:factory-gui-recognition', question: 'Which applied Candidate should become the recognised Build surface?', whyHuman: 'The remaining difference is authorial product preference between coherent realities, not a transient protocol permission.', evidenceRefs: ['evidence:01ARZ3NDEKTSV4RRFFQ69G5FCB', 'evidence:sssf-parity'], blockedExecutionRefs: [] },
  ],
  agencies: [
    { agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FBE', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', label: 'Mahāmāyā · implementation agency', position: 'local', actuationRef: 'actuation:factory-gui-development', returnRef: 'return:factory-gui-candidate-a', returnState: 'received-unrecognised' },
    { agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FAE', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', label: 'Factory root-world agency', position: 'root', rootScopeRef: 'root-scope:factory-project-world', metagencyGrantRefs: ['metagency-grant:factory-build'], returnRef: 'return:factory-gui-recognition', returnState: 'awaiting-recognition' },
  ],
  executions: [
    { executionRef: dshMaximalTrace.executionRef, agencyRef: dshMaximalTrace.agencyRef, agentRef: dshMaximalTrace.agentRef, status: 'success', harnessRef: dshMaximalTrace.harnessRef, harnessCompositionRef: dshMaximalTrace.harnessCompositionRef, agentSessionRef: dshMaximalTrace.agentSessionRef, surfaceRefs: ['surface:aikit-terminal-field', 'surface:dsh-web-ui'], workcellBindingRefs: dshMaximalTrace.workcellBindingRefs, nativeTrajectoryRef: dshMaximalTrace.nativeTrajectory?.ref },
    { executionRef: sssfParityTrace.executionRef, agencyRef: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FAE', agentRef: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', status: sssfParityTrace.status, harnessRef: sssfParityTrace.harnessRef, agentSessionRef: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FAF', nativeTrajectoryRef: sssfParityTrace.nativeTrajectory?.ref },
  ],
  trajectories: [dshMaximalTrace, sssfParityTrace],
  actions: [
    { actionRef: 'action:01ARZ3NDEKTSV4RRFFQ69G5FAN', label: 'recognise Candidate', subjectKinds: ['candidate'] },
    { actionRef: 'action:01ARZ3NDEKTSV4RRFFQ69G5FBN', label: 'return for repair', subjectKinds: ['candidate'] },
    { actionRef: 'action:01ARZ3NDEKTSV4RRFFQ69G5FCN', label: 'request more evidence', subjectKinds: ['candidate', 'run'] },
    { actionRef: 'action:01ARZ3NDEKTSV4RRFFQ69G5FDN', label: 're-enter frontier', subjectKinds: ['run'] },
  ],
}
