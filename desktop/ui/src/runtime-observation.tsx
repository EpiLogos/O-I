import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type SessionSpaceState = {
  definition: { id: string };
};

type RuntimeAgentSession = {
  agent_session: string;
  harness: string;
  native_session_id?: string;
  provider?: string;
};

type RuntimeComponent = {
  agent_session: string;
  component: string;
  harness: string;
  activation_mode: string;
  state: string;
  provider?: string;
  reason?: string;
};

type RuntimeSurface = {
  agent_session: string;
  surface: string;
  component?: string;
  state: string;
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
  reason?: string;
};

type SessionSpaceRuntime = {
  version: string;
  id: string;
  lifecycle: string;
  revision: number;
  projects: string[];
  agent_sessions: RuntimeAgentSession[];
  components: RuntimeComponent[];
  surfaces: RuntimeSurface[];
  connections: RuntimeConnection[];
  provenance: string[];
};

type SessionSpaceReading = {
  state: SessionSpaceState;
  runtime?: SessionSpaceRuntime;
};

export function RuntimeObservationSurface() {
  const [runtime, setRuntime] = useState<SessionSpaceRuntime | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const spaces = await invoke<SessionSpaceState[]>('aikit_session_spaces');
      let observed: SessionSpaceRuntime | null = null;
      for (const state of spaces) {
        try {
          const reading = await invoke<SessionSpaceReading>('aikit_session_space_read', {
            sessionSpaceRef: state.definition.id,
          });
          if (reading.runtime) {
            observed = reading.runtime;
            break;
          }
        } catch {
          // A configured first-party runtime file may belong to another canonical
          // space. It must never be promoted to this one's identity.
        }
      }
      setRuntime(observed);
      setError('');
    } catch (nextError) {
      setRuntime(null);
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  return (
    <section className="oi-runtime-observation" aria-label="AIKit SessionSpace runtime observation">
      <header>
        <div>
          <p className="oi-eyebrow">Target-owned runtime observation</p>
          <h2>Effective Surfaces</h2>
        </div>
        <button type="button" onClick={() => void refresh()}>Re-observe</button>
      </header>
      {!runtime && !error && (
        <p className="oi-muted">No first-party runtime observation is configured. Authored SessionSpace state remains available without pretending it is live provider truth.</p>
      )}
      {error && <p className="oi-workbench__error">Runtime observation: {error}</p>}
      {runtime && (
        <>
          <dl className="oi-runtime-observation__summary">
            <dt>SessionSpace</dt><dd>{runtime.id}</dd>
            <dt>Runtime revision</dt><dd>{runtime.revision}</dd>
            <dt>Lifecycle</dt><dd>{runtime.lifecycle}</dd>
          </dl>
          <RuntimeRows
            title="AgentSessions"
            rows={runtime.agent_sessions.map((entry) => ({
              ref: entry.agent_session,
              detail: `${entry.provider ?? 'provider undisclosed'} · ${entry.native_session_id ?? 'native id undisclosed'} · ${entry.harness}`,
            }))}
          />
          <RuntimeRows
            title="Components"
            rows={runtime.components.map((entry) => ({
              ref: entry.component,
              detail: `${entry.state} · ${entry.activation_mode} · ${entry.provider ?? 'provider undisclosed'}${entry.reason ? ` · ${entry.reason}` : ''}`,
            }))}
          />
          <RuntimeRows
            title="Surfaces"
            rows={runtime.surfaces.map((entry) => ({
              ref: entry.surface,
              detail: `${entry.state} · AgentSession ${entry.agent_session}${entry.component ? ` · ${entry.component}` : ''}`,
            }))}
          />
          <RuntimeRows
            title="Connections"
            rows={runtime.connections.map((entry) => ({
              ref: entry.connection,
              detail: `${entry.state} · ${entry.protocol} · ${entry.provider} · AgentSession ${entry.agent_session}${entry.native_session_id ? ` · native ${entry.native_session_id}` : ''}${entry.reason ? ` · ${entry.reason}` : ''}`,
            }))}
          />
          <small className="oi-muted">Provider/native ids are observation and provenance. Canonical AgentSession, Component and Surface refs remain their owner identities.</small>
        </>
      )}
    </section>
  );
}

function RuntimeRows({ title, rows }: { title: string; rows: Array<{ ref: string; detail: string }> }) {
  return (
    <div className="oi-runtime-observation__rows">
      <strong>{title}</strong>
      {!rows.length && <span className="oi-muted">none observed</span>}
      {rows.map((row) => (
        <div key={`${title}-${row.ref}`}>
          <code>{row.ref}</code>
          <small>{row.detail}</small>
        </div>
      ))}
    </div>
  );
}
