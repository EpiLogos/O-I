import { useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import { sessionSpace } from "./client";

type Phase =
  | "idle"
  | "creating"
  | "create_ready"
  | "binding_pending"
  | "binding"
  | "binding_ready"
  | "applying"
  | "readback_pending"
  | "reading_back"
  | "applied";
function message(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason); }

export function SessionSpaceControls({ project, projectRef }: { project: string; projectRef: string }) {
  const kernel = useKernel();
  const [id, setId] = useState("session-space/");
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<unknown>();
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");

  const clearReview = () => { setPreview(undefined); setResult(undefined); setError(undefined); setPhase("idle"); };
  const stageCreate = async () => {
    const space = id.trim();
    if (!space.startsWith("session-space/")) { setError("Use the canonical session-space/… reference."); return; }
    setPhase("creating"); setPreview(undefined); setResult(undefined); setError(undefined);
    try { setPreview(await sessionSpace(kernel.transport, project, { action: "create", id: space, label: label.trim() || undefined })); setPhase("create_ready"); }
    catch (reason) { setError(message(reason)); setPhase("idle"); }
  };
  const prepareBinding = async () => {
    setPhase("binding");
    setError(undefined);
    try {
      const binding = await sessionSpace(kernel.transport, project, { action: "project_context" });
      setPreview(await sessionSpace(kernel.transport, project, {
        action: "stage",
        space: id.trim(),
        intent: { operation: "bind-project-context", binding },
      }));
      setPhase("binding_ready");
    } catch (reason) {
      setError("Project binding is not ready; check native workspace state before retrying preparation: " + message(reason));
      setPhase("binding_pending");
    }
  };

  const applyCreateAndStageBinding = async () => {
    if (phase !== "create_ready" || !preview || typeof preview !== "object") return;
    setPhase("binding");
    setError(undefined);
    try {
      await sessionSpace(kernel.transport, project, { action: "apply", preview });
    } catch (reason) {
      setError("The native workspace application could not be confirmed; check native state before retrying Project binding preparation: " + message(reason));
      setPhase("binding_pending");
      return;
    }
    await prepareBinding();
  };

  const readbackBinding = async (applied?: unknown) => {
    setPhase("reading_back");
    setError(undefined);
    try {
      const applications = await sessionSpace(kernel.transport, project, { action: "discover", project: projectRef });
      if (!Array.isArray(applications)) {
        throw new Error("Native SessionSpace readback returned an invalid application list.");
      }
      const confirmed = applications.some((application) => {
        if (!application || typeof application !== "object") return false;
        const value = application as {
          version?: unknown;
          definition?: { version?: unknown; id?: unknown; projects?: unknown };
        };
        return value.version === "aikit.session-space-application/v1" &&
          value.definition?.version === "aikit.session-space/v1" &&
          value.definition.id === id.trim() &&
          Array.isArray(value.definition.projects) &&
          value.definition.projects.includes(projectRef);
      });
      if (!confirmed) {
        throw new Error("Native readback does not yet show this Project-bound SessionSpace.");
      }
      setResult(applied ?? applications);
      setPhase("applied");
    } catch (reason) {
      setError("The native application could not be confirmed; retry readback without applying again: " + message(reason));
      setPhase("readback_pending");
    }
  };

  const applyBinding = async () => {
    if (phase !== "binding_ready" || !preview || typeof preview !== "object") return;
    setPhase("applying");
    setError(undefined);
    try {
      const applied = await sessionSpace(kernel.transport, project, { action: "apply", preview });
      await readbackBinding(applied);
    } catch (reason) {
      setError("The native application could not be confirmed; retry readback without applying again: " + message(reason));
      setPhase("readback_pending");
    }
  };

  const busy = phase === "creating" || phase === "binding" || phase === "applying" || phase === "reading_back";
  const canReview = phase === "idle" || phase === "create_ready" || phase === "applied";
  return <section className="agents-session-space" aria-label="Project SessionSpace">
    <header><div><h3>Project workspace</h3><p>Create a native SessionSpace bound to this Project.</p></div></header>
    <label>Reference<input value={id} onChange={event => { setId(event.target.value); clearReview(); }} disabled={busy} /></label>
    <label>Label<input value={label} onChange={event => { setLabel(event.target.value); clearReview(); }} disabled={busy} placeholder="Agents workspace" /></label>
    <button onClick={() => void stageCreate()} disabled={busy || !canReview || !id.trim()}>{phase === "creating" ? "Preparing…" : "Review workspace"}</button>
    {phase === "create_ready" && <div className="agents-session-space-review"><p>Review the new workspace before it is created.</p><details><summary>Technical evidence</summary><pre>{JSON.stringify(preview, null, 2)}</pre></details><button onClick={() => void applyCreateAndStageBinding()} disabled={busy}>Create and prepare Project binding</button></div>}
    {phase === "binding_pending" && <div className="agents-session-space-review">
      <p>Check workspace state, then prepare its Project binding.</p>
      <button onClick={() => void prepareBinding()} disabled={busy}>Retry Project binding preparation</button>
    </div>}
    {phase === "binding" && <p role="status">Resolving Project context…</p>}
    {phase === "binding_ready" && <div className="agents-session-space-review"><p>Review the exact native Project binding for <strong>{projectRef}</strong>.</p><details><summary>Technical evidence</summary><pre>{JSON.stringify(preview, null, 2)}</pre></details><button onClick={() => void applyBinding()} disabled={busy}>Apply Project binding</button></div>}
    {phase === "applying" && <p role="status">Applying Project binding…</p>}
    {phase === "readback_pending" && <div className="agents-session-space-review">
      <p>Check the native application result before continuing.</p>
      <button onClick={() => void readbackBinding()} disabled={busy}>Retry binding readback</button>
    </div>}
    {phase === "reading_back" && <p role="status">Reading back native Project binding…</p>}
    {phase === "applied" && <p role="status">Workspace applied and confirmed for this Project.</p>}
    {result !== undefined && <details><summary>Applied evidence</summary><pre data-session-space-result="applied">{JSON.stringify(result, null, 2)}</pre></details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
