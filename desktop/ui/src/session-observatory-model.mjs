import { advanceActivity, createActivity, genericObservedActivity } from '../../../shared-field/activity.mjs';

export const SESSION_OBSERVATORY_SCHEMA = 'oi.session-observatory/v1';
export const SESSION_OBSERVATORY_SURFACE_REF = 'surface/oi/session-observatory';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

/**
 * Compose the research-grade Observatory over one exact canonical AgentSession.
 * The caller supplies existing SessionSpace/Context/runtime/connection readings;
 * this model owns no session registry and cannot mint session identity.
 */
export function createSessionObservatoryReading(input) {
  record(input, 'session observatory input');
  const agentSessionRef = text(input.agent_session_ref, 'session observatory.agent_session_ref');
  const connection = input.connection ? record(input.connection, 'session observatory.connection') : null;
  if (connection?.binding?.agent_session && connection.binding.agent_session !== agentSessionRef) {
    throw new TypeError('connection binding AgentSession must match Observatory AgentSession');
  }
  const runtime = input.runtime ? record(input.runtime, 'session observatory.runtime') : null;
  const runtimeSession = runtime?.agent_sessions?.find?.((entry) => entry.agent_session === agentSessionRef) ?? null;
  const runtimeSurfaces = runtime?.surfaces?.filter?.((entry) => entry.agent_session === agentSessionRef) ?? [];
  const runtimeConnections = runtime?.connections?.filter?.((entry) => entry.agent_session === agentSessionRef) ?? [];
  const signals = Array.isArray(connection?.signals) ? connection.signals : [];

  return {
    schema: SESSION_OBSERVATORY_SCHEMA,
    surface_ref: SESSION_OBSERVATORY_SURFACE_REF,
    agent_session_ref: agentSessionRef,
    conversation: {
      provider_binding: connection?.binding ? clone(connection.binding) : null,
      visible_signals: signals.filter((signal) => ['agent-message-chunk', 'status', 'completed', 'cancelled', 'degraded'].includes(signal?.kind?.kind)),
    },
    activity: semanticActivityFromSignals(agentSessionRef, signals),
    raw: clone(signals),
    context: clone(input.context ?? null),
    disclosure: clone(input.disclosure ?? null),
    actions: clone(input.actions ?? []),
    runtime: {
      session: clone(runtimeSession),
      surfaces: clone(runtimeSurfaces),
      connections: clone(runtimeConnections),
    },
    alternate_surfaces: clone(runtimeSurfaces),
    provenance: clone(input.provenance ?? []),
  };
}

/**
 * Project the same Observatory/session binding into another presentation locus.
 * Only provider-local presentation metadata changes.
 */
export function projectSessionObservatory(reading, input) {
  const value = validateSessionObservatory(reading);
  record(input, 'session observatory projection');
  const mode = text(input.mode, 'session observatory projection.mode');
  if (!['embedded', 'detached', 'alternate'].includes(mode)) {
    throw new TypeError('session observatory projection.mode must be embedded, detached or alternate');
  }
  return {
    surface_ref: value.surface_ref,
    agent_session_ref: value.agent_session_ref,
    mode,
    ...(input.provider_surface_ref ? { provider_surface_ref: text(input.provider_surface_ref, 'provider_surface_ref') } : {}),
    ...(input.window_ref ? { window_ref: text(input.window_ref, 'window_ref') } : {}),
    provenance: clone(input.provenance ?? value.provenance),
  };
}

export function validateSessionObservatory(value) {
  record(value, 'session observatory');
  if (value.schema !== SESSION_OBSERVATORY_SCHEMA) throw new TypeError(`Unsupported Session Observatory schema: ${value.schema}`);
  if (value.surface_ref !== SESSION_OBSERVATORY_SURFACE_REF) throw new TypeError(`Unsupported Session Observatory Surface: ${value.surface_ref}`);
  text(value.agent_session_ref, 'session observatory.agent_session_ref');
  return clone(value);
}

/**
 * AIKit connection signals become semantic Activity without being promoted into
 * canonical Actions. Known lifecycle signals coalesce into one visible Activity;
 * unknown signals remain generic Activity with an exact raw trace reference.
 */
export function semanticActivityFromSignals(agentSessionRef, signals) {
  text(agentSessionRef, 'agentSessionRef');
  if (!Array.isArray(signals)) throw new TypeError('signals must be an array');
  let lifecycle = null;
  const generic = [];
  for (const signal of signals) {
    const kind = signal?.kind?.kind;
    const sequence = Number.isInteger(signal?.sequence) ? signal.sequence : generic.length + 1;
    const updatedAt = signalTimestamp(signal, sequence);
    const traceRef = `agent-signal:${agentSessionRef}:${sequence}`;
    if (['status', 'agent-message-chunk', 'completed', 'cancelled', 'degraded'].includes(kind)) {
      const mapped = knownSignal(kind, signal);
      if (!lifecycle) {
        lifecycle = createActivity({
          activity_ref: `activity:${agentSessionRef}:connection`,
          native_owner: 'ai-kit',
          agent_session_ref: agentSessionRef,
          subject: { ref: agentSessionRef, kind: 'agent-session' },
          verb: mapped.verb,
          object_ref: agentSessionRef,
          semantic_summary: mapped.summary,
          phase: mapped.phase,
          needs_attention: mapped.needs_attention,
          trace_ref: traceRef,
          started_at: updatedAt,
          updated_at: updatedAt,
          provenance: [`AIKit AgentSession connection signal ${sequence}`],
        });
      } else if (!['completed', 'failed', 'cancelled'].includes(lifecycle.phase)) {
        lifecycle = advanceActivity(lifecycle, {
          verb: mapped.verb,
          semantic_summary: mapped.summary,
          phase: mapped.phase,
          needs_attention: mapped.needs_attention,
          trace_ref: traceRef,
          updated_at: updatedAt,
          provenance: [...lifecycle.provenance, `AIKit AgentSession connection signal ${sequence}`],
        });
      }
      continue;
    }
    generic.push(genericObservedActivity({
      activity_ref: `activity:${agentSessionRef}:signal:${sequence}`,
      native_owner: 'ai-kit',
      agent_session_ref: agentSessionRef,
      subject: { ref: agentSessionRef, kind: 'agent-session' },
      phase: 'active',
      semantic_summary: `Observed AIKit AgentSession signal ${kind ?? 'unknown'}.`,
      trace_ref: traceRef,
      started_at: updatedAt,
      updated_at: updatedAt,
      provenance: [`AIKit AgentSession connection signal ${sequence}`],
    }));
  }
  return [...(lifecycle ? [lifecycle] : []), ...generic];
}

function knownSignal(kind, signal) {
  const detail = signal?.kind?.text ?? signal?.kind?.message ?? signal?.kind?.stop_reason;
  if (kind === 'completed') return { verb: 'Completed', summary: detail || 'AgentSession turn completed.', phase: 'completed', needs_attention: false };
  if (kind === 'cancelled') return { verb: 'Cancelled', summary: detail || 'AgentSession activity was cancelled.', phase: 'cancelled', needs_attention: false };
  if (kind === 'degraded') return { verb: 'Degraded', summary: detail || 'AgentSession provider activity degraded.', phase: 'failed', needs_attention: true };
  if (kind === 'agent-message-chunk') return { verb: 'Responding', summary: detail || 'Agent is responding.', phase: 'active', needs_attention: false };
  return { verb: 'Working', summary: detail || 'AgentSession activity updated.', phase: 'active', needs_attention: false };
}

function signalTimestamp(signal, sequence) {
  const candidate = signal?.timestamp ?? signal?.occurred_at ?? signal?.updated_at;
  if (typeof candidate === 'string' && !Number.isNaN(Date.parse(candidate))) return candidate;
  // Deterministic fallback for ordered fixture/provider signals that do not yet
  // expose wall-clock time. Sequence remains the primary owner ordering fact.
  return new Date(sequence * 1000).toISOString();
}
