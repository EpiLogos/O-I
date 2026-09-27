/**
 * The carried act, shown over the Expressions/Technè field while the person
 * continues it here: what the act is, and where it can go next — the other
 * working mode, or back to its Factory Run with the result it reached.
 */
import {useState} from "react";
import type {KernelTransportStatus} from "../kernel/types";
import type {HostedAppMode} from "../expressions/hostedApp";
import {continueActInMode, returnActToFactory, useCarriedAct} from "./crossModeAct";

export function ActStrip({mode, transport, currentRevision}: {mode: HostedAppMode; transport: KernelTransportStatus; currentRevision?: number}) {
  const act = useCarriedAct();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!act || act.mode !== mode) return null;
  const run = (work: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    work().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false));
  };
  const other = mode === "techne" ? "expressions" : "techne";
  return (
    <div className="act-strip" role="region" aria-label="Carried act">
      <span className="act-strip-label">Act · {act.summary ?? act.act_ref}</span>
      <button type="button" disabled={busy} onClick={() => run(() => continueActInMode(transport, {act_ref: act.act_ref, to: other, expression_ref: act.expression_ref, runKey: act.runKey}))}>
        {other === "techne" ? "Develop in Technè" : "Shape in Expressions"}
      </button>
      {act.runKey && (
        <button type="button" disabled={busy} onClick={() => run(() => returnActToFactory(transport, {act_ref: act.act_ref, result_ref: act.expression_ref, result_revision: currentRevision, text: `Returned from ${mode === "techne" ? "Technè" : "Expressions"}${currentRevision === undefined ? "" : ` at revision ${currentRevision}`}`, runKey: act.runKey}))}>
          Return to the Run
        </button>
      )}
      {error && <span className="act-strip-error" role="alert">{error}</span>}
    </div>
  );
}
