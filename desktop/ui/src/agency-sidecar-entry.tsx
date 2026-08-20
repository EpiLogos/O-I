import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { AgentEncounterSurface, WorkbenchEvidence, WorkbenchSemanticRef } from './workbench';
import './agency-sidecar.css';

type SemanticRef = WorkbenchSemanticRef;

type ShellSnapshot = {
  selection?: SemanticRef;
};

type Availability = 'available' | { unresolved: { reasons: string[] } } | { unavailable: { reasons: string[] } };

type ResourceDescriptor = {
  id: string;
  kind: string;
  name: string;
  description: string;
  owner?: string;
};

type ResolvedResource = {
  resource: {
    descriptor: ResourceDescriptor;
    eligibility?: unknown;
    providers?: unknown[];
  };
  availability: Availability;
};

type ReferenceResolution =
  | { state: 'resolved'; resource: ResolvedResource }
  | { state: 'missing'; reference: string; expected: string }
  | { state: 'wrong-kind'; reference: string; expected: string; actual: string };

type ContextResolution = {
  version: string;
  project_binding: { project: string };
  profiles: string[];
  scopes: Array<{ kind: string; depth: number; origin: string }>;
  agent?: ReferenceResolution | null;
  agency?: ReferenceResolution | null;
  host?: ReferenceResolution | null;
  actions: ResolvedResource[];
  context_sources: ResolvedResource[];
  model_candidates: ResolvedResource[];
  harness_candidates: ResolvedResource[];
  execution_offers: ResolvedResource[];
  retrieval: { context_sources: string[] };
  warnings: string[];
};

type AuthorityState = {
  capability?: string;
  capability_available: boolean;
  capability_granted: boolean;
  action?: string;
  action_authorised: boolean;
  provenance: string[];
};

type RuntimeAgentSession = {
  agent_session: string;
  harness: string;
  native_session_id?: string;
  provider?: string;
  provenance: string[];
};

type RuntimeSurface = {
  agent_session: string;
  surface: string;
  component?: string;
  descriptor: unknown;
  state: string;
  provenance: string[];
};

type RuntimeConnection = {
  connection: string;
  provider: string;
  protocol: string;
  agent_session: string;
  component?: string;
  surface?: string;
  state: string;
  native_session_id?: string;
  authority: AuthorityState;
  reason?: string;
  provenance: string[];
};

type SessionSpaceRuntime = {
  version: string;
  id: string;
  revision: number;
  agent_sessions: RuntimeAgentSession[];
  surfaces: RuntimeSurface[];
  connections: RuntimeConnection[];
  provenance: string[];
};

type SessionSpaceState = {
  version: string;
  revision: number;
  definition: { id: string; projects: string[]; provenance: string[] };
  label?: string;
  agent_sessions: Record<string, { agent_session: string; purpose?: string; provenance: string[] }>;
  surfaces: Record<string, { surface: string; component?: string; purpose?: string; provenance: string[] }>;
  focus?: { target: string; region?: string; provenance: string[] };
};

type SessionSpaceReading = {
  state: SessionSpaceState;
  runtime?: SessionSpaceRuntime;
  explanation: unknown;
  history: unknown[];
};

type Contribution = {
  contribution: {
    contribution_ref: string;
    native_owner: string;
    target_contract?: string;
    availability: string;
    provenance: { source: string; revision?: string };
    read_model_ref?: SemanticRef;
    accepted_selection_kinds: string[];
    actions: Array<{
      action_ref: string;
      native_owner: string;
      availability: string;
      required_capability_ref?: string;
    }>;
    detail?: string;
  };
};

type ActionHorizonEntry = {
  actionRef: string;
  label: string;
  owner: string;
  availability: string;
  subjectApplies: boolean | null;
  requiredCapabilityRef?: string;
  authority?: AuthorityState;
  source: string;
};

function CanonicalAgencySidecar() {
  const [selection, setSelection] = useState<SemanticRef | undefined>();
  const [context, setContext] = useState<ContextResolution | null>(null);
  const [spaces, setSpaces] = useState<SessionSpaceState[]>([]);
  const [space, setSpace] = useState<SessionSpaceReading | null>(null);
  const [activeAgentSession, setActiveAgentSession] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [encounterEvidence, setEncounterEvidence] = useState<WorkbenchEvidence | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async (preferredAgentSession?: string | null) => {
    const [snapshot, nextContext, nextSpaces, nextContributions] = await Promise.all([
      invoke<ShellSnapshot>('shell_snapshot').catch(() => ({} as ShellSnapshot)),
      invoke<ContextResolution | null>('aikit_context_resolution').catch(() => null),
      invoke<SessionSpaceState[]>('aikit_session_spaces').catch(() => []),
      invoke<Contribution[]>('contribution_catalog').catch(() => []),
    ]);

    setSelection(snapshot.selection);
    setContext(nextContext);
    setSpaces(nextSpaces);
    setContributions(nextContributions);

    const selectedAgent = snapshot.selection?.kind === 'agent-session' ? snapshot.selection.ref : null;
    const candidateAgent = preferredAgentSession ?? selectedAgent ?? activeAgentSession;
    const containing = candidateAgent
      ? nextSpaces.find((candidate) => Boolean(candidate.agent_sessions[candidateAgent]))
      : undefined;
    const focused = nextSpaces.find((candidate) => {
      const target = candidate.focus?.target;
      return Boolean(target && candidate.agent_sessions[target]);
    });
    const chosen = containing ?? focused ?? nextSpaces[0];

    if (!chosen) {
      setSpace(null);
      setActiveAgentSession(null);
      return;
    }

    const reading = await invoke<SessionSpaceReading>('aikit_session_space_read', {
      sessionSpaceRef: chosen.definition.id,
    }).catch(() => null);
    if (!reading) {
      setSpace(null);
      return;
    }

    setSpace(reading);
    const refs = Object.keys(reading.state.agent_sessions);
    const nextAgent = candidateAgent && refs.includes(candidateAgent)
      ? candidateAgent
      : reading.state.focus?.target && refs.includes(reading.state.focus.target)
        ? reading.state.focus.target
        : refs[0] ?? null;
    setActiveAgentSession(nextAgent);
  }, [activeAgentSession]);

  useEffect(() => {
    void refresh().catch((nextError) => setError(messageFrom(nextError)));
    const onFocus = () => void refresh().catch(() => undefined);
    const onKeyUp = () => window.setTimeout(() => void refresh().catch(() => undefined), 80);
    window.addEventListener('focus', onFocus);
    window.addEventListener('keyup', onKeyUp);
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 3000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keyup', onKeyUp);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function focusAgentSession(agentSessionRef: string) {
    const sessionSpaceRef = space?.state.definition.id;
    if (!sessionSpaceRef) return;
    try {
      await invoke('aikit_session_space_focus', {
        request: {
          session_space_ref: sessionSpaceRef,
          target_ref: agentSessionRef,
          region: 'sidecar:conversation',
        },
      });
      const subject: SemanticRef = {
        ref: agentSessionRef,
        kind: 'agent-session',
        native_owner: 'ai-kit',
        provenance: { source: 'AIKit SessionSpace application focus' },
      };
      await invoke('select_semantic_ref', { subject });
      setActiveAgentSession(agentSessionRef);
      setSelection(subject);
      await refresh(agentSessionRef);
      setError('');
    } catch (nextError) {
      setError(messageFrom(nextError));
    }
  }

  async function selectFromEncounter(subject: SemanticRef, evidence: WorkbenchEvidence) {
    try {
      await invoke('select_semantic_ref', { subject });
      setSelection(subject);
      setEncounterEvidence(evidence);
      await refresh(subject.kind === 'agent-session' ? subject.ref : activeAgentSession);
    } catch (nextError) {
      setError(messageFrom(nextError));
    }
  }

  const runtimeSession = space?.runtime?.agent_sessions.find((entry) => entry.agent_session === activeAgentSession);
  const runtimeConnections = useMemo(
    () => space?.runtime?.connections.filter((entry) => entry.agent_session === activeAgentSession) ?? [],
    [space, activeAgentSession],
  );
  const alternateSurfaces = useMemo(
    () => space?.runtime?.surfaces.filter((entry) => entry.agent_session === activeAgentSession) ?? [],
    [space, activeAgentSession],
  );
  const actionHorizon = useMemo(
    () => buildActionHorizon(context, contributions, selection, runtimeConnections),
    [context, contributions, selection, runtimeConnections],
  );
  const actuation = contributions.find((entry) => entry.contribution.native_owner === 'actuation');
  const agent = resolvedDescriptor(context?.agent);
  const agency = resolvedDescriptor(context?.agency);
  const host = resolvedDescriptor(context?.host);
  const retrievalRefs = context?.retrieval.context_sources ?? [];
  const selectedInRetrievalPlan = Boolean(selection && retrievalRefs.includes(selection.ref));

  return (
    <section className="oi-agency-sidecar" aria-label="Canonical Agency sidecar">
      <header className="oi-agency-sidecar__header">
        <div>
          <p className="oi-eyebrow">Canonical Agency · P3</p>
          <strong>{agency?.name ?? agent?.name ?? activeAgentSession ?? 'No situated Agency resolved'}</strong>
        </div>
        <button type="button" onClick={() => void refresh(activeAgentSession)}>Re-read</button>
      </header>

      <section className="oi-agency-sidecar__section" aria-label="Identity and SessionSpace relation">
        <p className="oi-eyebrow">Identity / situated relation</p>
        <dl className="oi-agency-sidecar__facts">
          <dt>Agent</dt><dd>{agent ? <code>{agent.id}</code> : 'not resolved in current AIKit Context'}</dd>
          <dt>Agency</dt><dd>{agency ? <code>{agency.id}</code> : 'not resolved in current AIKit Context'}</dd>
          <dt>AgentSession</dt><dd>{activeAgentSession ? <code>{activeAgentSession}</code> : 'none attached'}</dd>
          <dt>SessionSpace</dt><dd>{space ? <code>{space.state.definition.id}</code> : 'none available'}</dd>
          <dt>Harness</dt><dd>{runtimeSession?.harness ? <code>{runtimeSession.harness}</code> : 'not observed'}</dd>
          <dt>Provider</dt><dd>{runtimeSession?.provider ? <code>{runtimeSession.provider}</code> : 'not observed'}</dd>
          <dt>Provider session</dt><dd>{runtimeSession?.native_session_id ?? 'not observed'}</dd>
          <dt>Host</dt><dd>{host ? <code>{host.id}</code> : 'not resolved'}</dd>
        </dl>
        <p className="oi-agency-sidecar__law">Provider session ≠ AgentSession · AgentSession ≠ Agent · Actuation WHAT ≠ AIKit HOW</p>
        {space && Object.keys(space.state.agent_sessions).length > 1 && (
          <div className="oi-agency-sidecar__switcher" aria-label="Current AgentSessions">
            {Object.keys(space.state.agent_sessions).map((ref) => (
              <button
                type="button"
                key={ref}
                data-active={ref === activeAgentSession}
                onClick={() => void focusAgentSession(ref)}
              >{ref}</button>
            ))}
          </div>
        )}
      </section>

      <AgentEncounterSurface agentSessionRef={activeAgentSession} onSelect={selectFromEncounter} />

      <section className="oi-agency-sidecar__section" aria-label="Context disclosure">
        <p className="oi-eyebrow">Bounded Context / disclosure</p>
        <dl className="oi-agency-sidecar__facts">
          <dt>Project</dt><dd>{context?.project_binding.project ? <code>{context.project_binding.project}</code> : 'not resolved'}</dd>
          <dt>Profiles</dt><dd>{context?.profiles.length ? context.profiles.join(', ') : 'none resolved'}</dd>
          <dt>Scopes</dt><dd>{context?.scopes.length ?? 0}</dd>
          <dt>Context sources</dt><dd>{context?.context_sources.length ?? 0} available/resolved descriptors</dd>
          <dt>Selected subject</dt><dd>{selection ? <code>{selection.ref}</code> : 'none'}</dd>
          <dt>Disclosure proof</dt>
          <dd>
            {selection
              ? selectedInRetrievalPlan
                ? 'Selected ref appears in AIKit retrieval plan; current contract still provides no payload-disclosure receipt.'
                : 'No payload-disclosure receipt exists for the selected ref in the current ContextResolution reading.'
              : 'No selected subject.'}
          </dd>
        </dl>
        <p className="oi-agency-sidecar__law">UI selection ≠ Context disclosure. Retrieval availability ≠ prompt materialisation.</p>
        {context?.warnings.length ? (
          <details><summary>Context warnings</summary><pre>{jsonPreview(context.warnings)}</pre></details>
        ) : null}
      </section>

      <section className="oi-agency-sidecar__section" aria-label="Native Action horizon">
        <p className="oi-eyebrow">Native Action horizon</p>
        {!actionHorizon.length && <p className="oi-muted">No native Action descriptors are present in the current effective context/contribution field.</p>}
        <div className="oi-agency-sidecar__actions">
          {actionHorizon.map((action) => (
            <article key={`${action.owner}:${action.actionRef}`}>
              <strong>{action.label}</strong>
              <code>{action.actionRef}</code>
              <small>{action.owner} · {action.availability}</small>
              <span>Subject: {action.subjectApplies == null ? 'owner-defined' : action.subjectApplies ? 'current selection applies' : 'current selection not bound'}</span>
              <span>
                Authority: {action.authority
                  ? `${action.authority.capability_granted ? 'capability granted' : 'capability not granted'} · ${action.authority.action_authorised ? 'action authorised' : 'action not authorised'}`
                  : 'not observed for this AgentSession'}
              </span>
              {action.requiredCapabilityRef && <span>Requires: {action.requiredCapabilityRef}</span>}
            </article>
          ))}
        </div>
        <p className="oi-agency-sidecar__law">Action visible ≠ Action authorised. This Surface does not mint authority or dispatch a desktop-local tool API.</p>
      </section>

      <section className="oi-agency-sidecar__section" aria-label="Alternate Surfaces">
        <p className="oi-eyebrow">Surface continuity</p>
        {alternateSurfaces.length ? alternateSurfaces.map((surface) => (
          <div className="oi-agency-sidecar__surface" key={`${surface.agent_session}:${surface.surface}`}>
            <code>{surface.surface}</code>
            <span>{surface.state}</span>
            <small>same AgentSession · {surface.agent_session}</small>
          </div>
        )) : <p className="oi-muted">No alternate runtime Surface is currently observed for this AgentSession.</p>}
        {runtimeConnections.map((connection) => (
          <details key={connection.connection}>
            <summary>{connection.protocol} · {connection.connection} · {connection.state}</summary>
            <pre>{jsonPreview(connection)}</pre>
          </details>
        ))}
      </section>

      <section className="oi-agency-sidecar__section" aria-label="Cradle and Actuation depth">
        <p className="oi-eyebrow">Cradle / Actuation depth</p>
        {actuation ? (
          <>
            <dl className="oi-agency-sidecar__facts">
              <dt>Owner reading</dt><dd><code>{actuation.contribution.contribution_ref}</code></dd>
              <dt>Contract</dt><dd>{actuation.contribution.target_contract ?? 'not published'}</dd>
              <dt>Availability</dt><dd>{actuation.contribution.availability}</dd>
              <dt>Source</dt><dd>{actuation.contribution.provenance.source}</dd>
            </dl>
            <p className="oi-muted">The current O:I contribution exposes the Actuation owner descriptor, not a live `actuation.agency/v1` / `actuation.realised/v1` payload. WorldBinding, RootScope, Determination, realised body, ActuationStream and Return therefore remain undisclosed here rather than being inferred.</p>
          </>
        ) : <p className="oi-muted">No Actuation owner reading is currently registered.</p>}
      </section>

      <details className="oi-agency-sidecar__section">
        <summary>Explain / History / provenance</summary>
        <pre>{jsonPreview({
          sessionSpaceExplanation: space?.explanation,
          sessionSpaceHistory: space?.history,
          encounterEvidence,
          contextVersion: context?.version,
          contextWarnings: context?.warnings,
          agentSessionRuntime: runtimeSession,
        })}</pre>
      </details>

      <section className="oi-agency-sidecar__section oi-agency-sidecar__gaps" aria-label="Truthful degradation">
        <p className="oi-eyebrow">Current owner/host limits</p>
        <ul>
          <li>ACP is the conversation transport Surface only; no O:I Agent identity or transcript store is created.</li>
          <li>The inherited stdio host returns ordered ACP signals at turn completion. Live renderer streaming and concurrent interrupt are not claimed by this P3 Surface.</li>
          <li>ContextResolution exposes the retrieval horizon, not an exact per-subject payload-disclosure receipt.</li>
          <li>Actuation semantics exist natively, but O:I currently lacks a live payload adapter for the agency/realised contracts; Cradle depth degrades at that boundary.</li>
          <li>Provider tool-call signals are not promoted into canonical Actions without an explicit native Action binding.</li>
        </ul>
      </section>

      {error && <p className="oi-workbench__error">Agency sidecar: {error}</p>}
    </section>
  );
}

function buildActionHorizon(
  context: ContextResolution | null,
  contributions: Contribution[],
  selection: SemanticRef | undefined,
  connections: RuntimeConnection[],
): ActionHorizonEntry[] {
  const byRef = new Map<string, ActionHorizonEntry>();
  const authorityByAction = new Map<string, AuthorityState>();
  for (const connection of connections) {
    const authority = connection.authority;
    if (authority?.action) authorityByAction.set(authority.action, authority);
  }

  for (const entry of context?.actions ?? []) {
    const descriptor = entry.resource.descriptor;
    byRef.set(descriptor.id, {
      actionRef: descriptor.id,
      label: descriptor.name,
      owner: descriptor.owner ?? 'native-owner-unresolved',
      availability: availabilityLabel(entry.availability),
      subjectApplies: null,
      authority: authorityByAction.get(descriptor.id),
      source: 'AIKit ContextResolution',
    });
  }

  for (const { contribution } of contributions) {
    for (const action of contribution.actions ?? []) {
      const key = action.action_ref;
      const subjectApplies = selection
        ? contribution.accepted_selection_kinds.includes(selection.kind)
        : false;
      const existing = byRef.get(key);
      byRef.set(key, {
        actionRef: key,
        label: existing?.label ?? key,
        owner: action.native_owner,
        availability: action.availability,
        subjectApplies,
        requiredCapabilityRef: action.required_capability_ref,
        authority: authorityByAction.get(key) ?? existing?.authority,
        source: contribution.provenance.source,
      });
    }
  }

  return [...byRef.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function resolvedDescriptor(resolution?: ReferenceResolution | null): ResourceDescriptor | null {
  return resolution?.state === 'resolved' ? resolution.resource.resource.descriptor : null;
}

function availabilityLabel(availability: Availability) {
  if (availability === 'available') return 'available';
  if ('unresolved' in availability) return `unresolved: ${availability.unresolved.reasons.join('; ')}`;
  return `unavailable: ${availability.unavailable.reasons.join('; ')}`;
}

function jsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mountAgencySidecar() {
  const slot = document.querySelector<HTMLElement>('.oi-p1-agent-slot');
  if (!slot || slot.dataset.oiP3Mounted === 'true') return;
  slot.dataset.oiP3Mounted = 'true';
  ReactDOM.createRoot(slot).render(
    <React.StrictMode><CanonicalAgencySidecar /></React.StrictMode>,
  );
}

mountAgencySidecar();
const observer = new MutationObserver(() => mountAgencySidecar());
observer.observe(document.documentElement, { childList: true, subtree: true });
