import { useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import { sessionSpace } from "./client";

type Phase = "idle" | "creating" | "create_ready" | "binding" | "binding_ready" | "applying" | "applied";
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
  const applyCreateAndStageBinding = async () => {
    if (phase !== "create_ready" || !preview || typeof preview !== "object") return;
    setPhase("binding"); setError(undefined);
    try {
      await sessionSpace(kernel.transport, project, { action: "apply", preview });
      const binding = await sessionSpace(kernel.transport, project, { action: "project_context" });
      setPreview(await sessionSpace(kernel.transport, project, { action: "stage", space: id.trim(), intent: { operation: "bind-project-context", binding } }));
      setPhase("binding_ready");
    } catch (reason) { setError(message(reason)); setPhase("create_ready"); }
  };
  const applyBinding = async () => {
    if (phase !== "binding_ready" || !preview || typeof preview !== "object") return;
    setPhase("applying"); setError(undefined);
    try {
      const applied = await sessionSpace(kernel.transport, project, { action: "apply", preview });
      const spaces = await sessionSpace(kernel.transport, project, { action: "discover", project: projectRef });
      const rows = spaces && typeof spaces === "object" && Array.isArray((spaces as { spaces?: unknown }).spaces) ? (spaces as { spaces: Array<{ id?: string; projects?: string[] }> }).spaces : [];
      if (!rows.some(row => row.id === id.trim() && row.projects?.includes(projectRef))) throw new Error("Native apply returned, but the project-bound SessionSpace was not present on re-read.");
      setResult(applied); setPhase("applied");
    } catch (reason) { setError(message(reason)); setPhase("binding_ready"); }
  };
  const busy = phase === "creating" || phase === "binding" || phase === "applying";
  return <section className="agents-session-space" aria-label="Project SessionSpace">
    <header><div><h3>Project workspace</h3><p>Create a native SessionSpace bound to this Project.</p></div></header>
    <label>Reference<input value={id} onChange={event => { setId(event.target.value); clearReview(); }} disabled={busy} /></label>
    <label>Label<input value={label} onChange={event => { setLabel(event.target.value); clearReview(); }} disabled={busy} placeholder="Agents workspace" /></label>
    <button onClick={() => void stageCreate()} disabled={busy || !id.trim()}>{phase === "creating" ? "Preparing…" : "Review workspace"}</button>
    {phase === "create_ready" && <div className="agents-session-space-review"><p>Review the new workspace before it is created.</p><details><summary>Technical evidence</summary><pre>{JSON.stringify(preview, null, 2)}</pre></details><button onClick={() => void applyCreateAndStageBinding()} disabled={busy}>Create and prepare Project binding</button></div>}
    {phase === "binding" && <p role="status">Creating workspace and resolving Project context…</p>}
    {phase === "binding_ready" && <div className="agents-session-space-review"><p>Review the exact native Project binding for <strong>{projectRef}</strong>.</p><details><summary>Technical evidence</summary><pre>{JSON.stringify(preview, null, 2)}</pre></details><button onClick={() => void applyBinding()} disabled={busy}>Apply Project binding</button></div>}
    {phase === "applying" && <p role="status">Applying and reading back…</p>}
    {phase === "applied" && <p role="status">Workspace applied and confirmed for this Project.</p>}
    {result !== undefined && <details><summary>Applied evidence</summary><pre data-session-space-result="applied">{JSON.stringify(result, null, 2)}</pre></details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
