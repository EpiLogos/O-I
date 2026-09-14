import { useEffect, useRef, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import { encounter, type EncounterStatus } from "./client";
import { resolveWorkingSurface, type ResolvedWorkingSurface, type WorkingSurfaceSelection } from "./working-surface";
import { SessionModelControl } from "./SessionModelControl";
import "./session-controls.css";

export interface SessionControlsProps {
  project: string;
  agentSession: string;
  space: string;
  onOpenWorkingSurface?: (selection: WorkingSurfaceSelection) => Promise<void>;
}

export function SessionControls({ project, agentSession, space, onOpenWorkingSurface }: SessionControlsProps) {
  const kernel = useKernel();
  const [status, setStatus] = useState<EncounterStatus>();
  const [working, setWorking] = useState<ResolvedWorkingSurface>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const openGeneration = useRef(0);

  useEffect(() => {
    let live = true;
    const generation = ++openGeneration.current;
    setStatus(undefined);
    setWorking(undefined);
    setError(undefined);
    setOpening(false);
    Promise.allSettled([
      encounter<EncounterStatus>(kernel.transport, project, { action: "status", agent_session: agentSession }),
      resolveWorkingSurface(kernel.transport, { project, space, agentSession }),
    ]).then(([statusResult, workingResult]) => {
      if (!live) return;
      const failures: string[] = [];
      if (statusResult.status === "fulfilled") setStatus(statusResult.value);
      else failures.push("Session status: " + String(statusResult.reason));
      if (workingResult.status === "fulfilled") setWorking(workingResult.value);
      else failures.push("Working environment: " + String(workingResult.reason));
      if (failures.length) setError(failures.join("; "));
    });
    return () => {
      live = false;
      if (openGeneration.current === generation) openGeneration.current += 1;
    };
  }, [agentSession, kernel.transport, project, space, revision]);

  return <section className="session-controls" aria-label="Existing session controls">
    <header>
      <div>
        <h3>Session runtime</h3>
      </div>
      <button type="button" onClick={() => setRevision((value) => value + 1)}>Refresh</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {!status && !error && <p role="status">Reading native session…</p>}
    {status && <dl>
      <dt>Connection</dt><dd>{status.state}{status.resident ? " · resident" : ""}</dd>
      <dt>Provider</dt><dd>{status.provider?.label ?? "Not disclosed"}</dd>
      <dt>Native session</dt><dd>{status.native_session_id ?? "Not resident"}</dd>
      <dt>SessionSpace</dt><dd>{space}</dd>
      {working && <><dt>Environment</dt><dd>{working.service_cwd}</dd><dt>Surface</dt><dd>{working.binding.surface}</dd></>}
    </dl>}
    {status && (status.resident || status.state === "Resident")
      ? <SessionModelControl project={project} agentSession={agentSession} />
      : status && <p>Model selection is unavailable until this session is resident.</p>}
    {working && onOpenWorkingSurface && <button
      type="button"
      disabled={opening}
      onClick={() => {
        const operation = ++openGeneration.current;
        setOpening(true);
        setError(undefined);
        void onOpenWorkingSurface({ project, space, agentSession, surface: working.binding.surface })
          .catch((reason) => {
            if (openGeneration.current === operation) setError("Working surface: " + String(reason));
          })
          .finally(() => {
            if (openGeneration.current === operation) setOpening(false);
          });
      }}
    >{opening ? "Opening…" : "Open working surface"}</button>}
    <details>
      <summary>Native session evidence</summary>
      <pre>{JSON.stringify({ status, working }, null, 2)}</pre>
    </details>
  </section>;
}
