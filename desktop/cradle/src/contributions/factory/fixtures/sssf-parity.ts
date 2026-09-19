import { mapSssfTrace, type SssfBinding, type SssfEvent, type SssfSessionDetail } from '../sssf'

export const sssfParityDetail: SssfSessionDetail = {
  session: {
    adw_id: 'adw-parity-001',
    adw_name: 'adw_simple_sdlc',
    request: 'Preserve source-faithful execution detail while porting the Build surface.',
    status: 'fail',
    engineer: 'engineer',
    started_at: '2026-08-16T20:00:00.000Z',
    ended_at: '2026-08-16T20:00:18.000Z',
    total_tokens: 18432,
    total_cost: 0.0412,
  },
  agents: [
    { adw_id: 'adw-parity-001', agent: 'planner', coding_agent: 'pi', model: 'model:planning', session_id: 'pi-planner-native', color: '#a78bfa', context_tokens: 6100, context_window: 32768, created_at: '2026-08-16T20:00:01.000Z', last_used_at: '2026-08-16T20:00:06.000Z' },
    { adw_id: 'adw-parity-001', agent: 'builder', coding_agent: 'pi', model: 'model:builder', session_id: 'pi-builder-native', color: '#5ad2dd', context_tokens: 9200, context_window: 32768, created_at: '2026-08-16T20:00:06.000Z', last_used_at: '2026-08-16T20:00:18.000Z' },
  ],
  phases: [
    { phase_id: 'p-request', adw_id: 'adw-parity-001', seq: 0, name: 'request', kind: 'engineer', owner: 'engineer', description: 'The engineer commissions the run.', status: 'success', attempt: 1, retries: 0, error: null, started_at: '2026-08-16T20:00:00.000Z', ended_at: '2026-08-16T20:00:01.000Z' },
    { phase_id: 'p-plan', adw_id: 'adw-parity-001', seq: 1, name: 'plan', kind: 'agent', owner: 'planner', description: 'Inspect source and determine the faithful port.', status: 'success', attempt: 1, retries: 0, error: null, started_at: '2026-08-16T20:00:01.000Z', ended_at: '2026-08-16T20:00:06.000Z' },
    { phase_id: 'p-build', adw_id: 'adw-parity-001', seq: 2, name: 'build', kind: 'agent', owner: 'builder', description: 'Implement the selected execution optic.', status: 'success', attempt: 1, retries: 0, error: null, started_at: '2026-08-16T20:00:06.000Z', ended_at: '2026-08-16T20:00:14.000Z' },
    { phase_id: 'p-test', adw_id: 'adw-parity-001', seq: 3, name: 'test', kind: 'code', owner: 'code', description: 'Run deterministic verification.', status: 'fail', attempt: 1, retries: 1, error: 'responsive parity assertion failed', started_at: '2026-08-16T20:00:14.000Z', ended_at: '2026-08-16T20:00:18.000Z' },
    { phase_id: 'p-review', adw_id: 'adw-parity-001', seq: 4, name: 'review', kind: 'agent', owner: 'builder', description: 'Review is retained as queued after the failed gate.', status: 'queued', attempt: 0, retries: 0, error: null, started_at: null, ended_at: null },
  ],
}

export const sssfParityEvents: SssfEvent[] = [
  { rowid: 1, event_id: 'e-request', adw_id: 'adw-parity-001', phase_id: 'p-request', parent_id: null, type: 'log', name: 'input', payload_json: JSON.stringify({ input: sssfParityDetail.session.request }), tokens: null, started_at: '2026-08-16T20:00:00.100Z', ended_at: null },
  { rowid: 2, event_id: 'e-plan-start', adw_id: 'adw-parity-001', phase_id: 'p-plan', parent_id: null, type: 'agent_start', name: 'planner', payload_json: JSON.stringify({ model: 'model:planning', coding_agent: 'pi', thinking: 'medium' }), tokens: null, started_at: '2026-08-16T20:00:01.000Z', ended_at: null },
  { rowid: 3, event_id: 'e-read', adw_id: 'adw-parity-001', phase_id: 'p-plan', parent_id: 'e-plan-start', type: 'tool_call', name: 'read: SessionTrace.vue', payload_json: JSON.stringify({ tool: 'read', args: { path: '.claude/skills/sssf/apps/visualizer/src/components/SessionTrace.vue' }, result_snippet: 'source trace geometry', ok: true, duration_ms: 84, agent: 'planner' }), tokens: null, started_at: '2026-08-16T20:00:02.000Z', ended_at: null },
  { rowid: 4, event_id: 'e-build-start', adw_id: 'adw-parity-001', phase_id: 'p-build', parent_id: null, type: 'agent_start', name: 'builder', payload_json: JSON.stringify({ model: 'model:builder', coding_agent: 'pi', thinking: 'medium' }), tokens: null, started_at: '2026-08-16T20:00:06.000Z', ended_at: null },
  { rowid: 5, event_id: 'e-write', adw_id: 'adw-parity-001', phase_id: 'p-build', parent_id: 'e-build-start', type: 'tool_call', name: 'write: TraceWaterfall.tsx', payload_json: JSON.stringify({ tool: 'write', args: { path: 'factory-ui/src/components/TraceWaterfall.tsx', content: 'x'.repeat(1200) }, result_snippet: 'written 68 lines', ok: true, duration_ms: 121, agent: 'builder' }), tokens: null, started_at: '2026-08-16T20:00:09.000Z', ended_at: null },
  { rowid: 6, event_id: 'e-test', adw_id: 'adw-parity-001', phase_id: 'p-test', parent_id: null, type: 'tool_call', name: 'bash: npm test', payload_json: JSON.stringify({ tool: 'bash', args: { command: 'npm test' }, result_snippet: '1 failed, 12 passed', ok: false, duration_ms: 3100, agent: 'code' }), tokens: null, started_at: '2026-08-16T20:00:14.400Z', ended_at: null },
  { rowid: 7, event_id: 'e-gate', adw_id: 'adw-parity-001', phase_id: 'p-test', parent_id: null, type: 'gate_fail', name: 'responsive parity', payload_json: JSON.stringify({ violations: ['narrow layout overflow'] }), tokens: null, started_at: '2026-08-16T20:00:17.700Z', ended_at: null },
]

export const sssfParityBinding: SssfBinding = {
  projectRef: 'project:01ARZ3NDEKTSV4RRFFQ69G5FAA',
  runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB',
  executionRef: 'execution:01ARZ3NDEKTSV4RRFFQ69G5FAG',
  agentRefs: { planner: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', builder: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD', code: 'agent:01ARZ3NDEKTSV4RRFFQ69G5FAD' },
  agencyRefs: { planner: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FAE', builder: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FAE', code: 'agency:01ARZ3NDEKTSV4RRFFQ69G5FAE' },
  harnessRef: 'harness:sssf-pi',
  agentSessionRefs: { planner: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FAF', builder: 'agent-session:01ARZ3NDEKTSV4RRFFQ69G5FAF' },
  nativeTrajectoryRef: 'sssf:adw-parity-001',
}

export const sssfParityTrace = mapSssfTrace(sssfParityDetail, sssfParityEvents, sssfParityBinding)
