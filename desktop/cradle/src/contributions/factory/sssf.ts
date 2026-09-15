import type { ExecutionTraceView, Status, TraceEvent, TraceSpan } from './types'

export type SssfSessionStatus = 'running' | 'success' | 'fail'
export type SssfPhaseStatus = 'queued' | 'running' | 'success' | 'fail'
export type SssfPhaseKind = 'engineer' | 'code' | 'agent'
export type SssfEventType =
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

export interface SssfSession {
  adw_id: string
  adw_name: string | null
  request: string | null
  status: SssfSessionStatus | null
  engineer: string | null
  started_at: string | null
  ended_at: string | null
  total_tokens: number | null
  total_cost: number | null
}

export interface SssfPhase {
  phase_id: string
  adw_id: string
  seq: number | null
  name: string | null
  kind: SssfPhaseKind | null
  owner: string | null
  description: string | null
  status: SssfPhaseStatus | null
  attempt: number | null
  retries: number | null
  error: string | null
  started_at: string | null
  ended_at: string | null
}

export interface SssfEvent {
  rowid: number
  event_id: string
  adw_id: string
  phase_id: string | null
  parent_id: string | null
  type: SssfEventType | null
  name: string | null
  payload_json: string | null
  tokens: number | null
  started_at: string | null
  ended_at: string | null
}

export interface SssfAgentSession {
  adw_id: string
  agent: string
  coding_agent: string | null
  model: string | null
  session_id: string | null
  color: string | null
  context_tokens: number | null
  context_window: number | null
  created_at: string | null
  last_used_at: string | null
}

export interface SssfSessionDetail {
  session: SssfSession
  phases: SssfPhase[]
  agents: SssfAgentSession[]
}

export interface SssfEventsPage {
  events: SssfEvent[]
  cursor: number
  has_more: boolean
}

export interface SssfBinding {
  projectRef: string
  runRef: string
  executionRef: string
  agentRefs: Record<string, string>
  agencyRefs: Record<string, string>
  harnessRef: string
  agentSessionRefs?: Record<string, string>
  nativeTrajectoryRef?: string
}

export interface SssfApi {
  session(adwId: string): Promise<SssfSessionDetail>
  events(adwId: string, after: number, limit: number): Promise<SssfEventsPage>
}

export class SssfHttpClient implements SssfApi {
  constructor(private readonly baseUrl = '') {}

  async session(adwId: string): Promise<SssfSessionDetail> {
    return this.get(`/api/sessions/${encodeURIComponent(adwId)}`)
  }

  async events(adwId: string, after: number, limit: number): Promise<SssfEventsPage> {
    return this.get(`/api/sessions/${encodeURIComponent(adwId)}/events?after=${after}&limit=${limit}`)
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) throw new Error(`SSSF ${response.status}: ${path}`)
    return response.json() as Promise<T>
  }
}

/** Source-faithful rowid cursor drain: each page depends on the previous cursor. */
export async function drainSssfEvents(api: SssfApi, adwId: string, after = 0, limit = 1000): Promise<SssfEventsPage> {
  const all: SssfEvent[] = []
  let cursor = after
  let page: SssfEventsPage
  do {
    page = await api.events(adwId, cursor, limit)
    cursor = Math.max(cursor, page.cursor)
    all.push(...page.events)
  } while (page.has_more)
  return { events: all, cursor, has_more: false }
}

function mapStatus(value: SssfSessionStatus | SssfPhaseStatus | null): Status {
  if (value === 'running' || value === 'success' || value === 'fail' || value === 'queued') return value
  return 'queued'
}

function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function mapEvent(raw: SssfEvent, span: SssfPhase, binding: SssfBinding): TraceEvent {
  const payload = parsePayload(raw.payload_json)
  const owner = span.owner ?? undefined
  const agentRef = owner ? binding.agentRefs[owner] : undefined
  const agencyRef = owner ? binding.agencyRefs[owner] : undefined
  const tool = raw.type === 'tool_call' && typeof payload?.tool === 'string' ? payload.tool : undefined
  const ok = typeof payload?.ok === 'boolean' ? payload.ok : undefined
  const result = payload?.result_snippet
  const duration = typeof payload?.duration_ms === 'number' ? payload.duration_ms : undefined
  const args = payload?.args
  return {
    eventRef: `sssf-event:${raw.event_id}`,
    kind: raw.type ?? 'log',
    timestamp: raw.started_at ?? span.started_at ?? '1970-01-01T00:00:00.000Z',
    endedAt: raw.ended_at ?? undefined,
    name: raw.name ?? undefined,
    parentRef: raw.parent_id ? `sssf-event:${raw.parent_id}` : undefined,
    spanRef: `sssf-span:${span.phase_id}`,
    projectRef: binding.projectRef,
    runRef: binding.runRef,
    executionRef: binding.executionRef,
    agentRef,
    agencyRef,
    harnessRef: binding.harnessRef,
    agentSessionRef: owner ? binding.agentSessionRefs?.[owner] : undefined,
    status: raw.type === 'error' || raw.type === 'gate_fail' || ok === false ? 'fail' : undefined,
    severity: raw.type === 'error' || raw.type === 'gate_fail' || ok === false ? 'error' : 'info',
    payload: payload ?? raw.payload_json,
    toolCall: tool ? {
      tool,
      args,
      result,
      ok,
      durationMs: duration,
      agentRef,
      nativeRef: raw.event_id,
    } : undefined,
    nativeRef: raw.event_id,
  }
}

export function mapSssfTrace(detail: SssfSessionDetail, events: SssfEvent[], binding: SssfBinding): ExecutionTraceView {
  const agents = new Map(detail.agents.map((agent) => [agent.agent, agent]))
  const byPhase = new Map<string, SssfEvent[]>()
  for (const event of [...events].sort((a, b) => a.rowid - b.rowid)) {
    if (!event.phase_id) continue
    const rows = byPhase.get(event.phase_id) ?? []
    rows.push(event)
    byPhase.set(event.phase_id, rows)
  }
  const spans: TraceSpan[] = [...detail.phases].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)).map((phase) => {
    const owner = phase.owner ?? undefined
    const info = owner ? agents.get(owner) : undefined
    return {
      spanRef: `sssf-span:${phase.phase_id}`,
      nativeSpanRef: phase.phase_id,
      name: phase.name ?? phase.phase_id,
      description: phase.description ?? undefined,
      kind: phase.kind ?? 'other',
      status: mapStatus(phase.status),
      startedAt: phase.started_at ?? undefined,
      endedAt: phase.ended_at ?? undefined,
      attempt: phase.attempt ?? undefined,
      retries: phase.retries ?? undefined,
      agentRef: owner ? binding.agentRefs[owner] : undefined,
      agencyRef: owner ? binding.agencyRefs[owner] : undefined,
      ownerLabel: owner ?? (phase.kind === 'engineer' ? detail.session.engineer ?? 'engineer' : undefined),
      modelLabel: info?.model ?? undefined,
      error: phase.error ?? undefined,
      events: (byPhase.get(phase.phase_id) ?? []).map((event) => mapEvent(event, phase, binding)),
    }
  })
  return {
    executionRef: binding.executionRef,
    projectRef: binding.projectRef,
    runRef: binding.runRef,
    status: mapStatus(detail.session.status),
    request: detail.session.request ?? undefined,
    startedAt: detail.session.started_at ?? undefined,
    endedAt: detail.session.ended_at ?? undefined,
    harnessRef: binding.harnessRef,
    totalTokens: detail.session.total_tokens ?? undefined,
    totalCost: detail.session.total_cost ?? undefined,
    spans,
    nativeTrajectory: binding.nativeTrajectoryRef ? { kind: 'sssf', ref: binding.nativeTrajectoryRef } : undefined,
  }
}
