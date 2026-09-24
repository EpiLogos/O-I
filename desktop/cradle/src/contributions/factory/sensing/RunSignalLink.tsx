import {useEffect} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {peekDeskReading, type RunEntry} from "../desk/deskStore";
import {runKeysForSignal} from "./model";
import {peekField, readField, selectSignal, sourceRunFor, useField} from "./reading";

/** Navigate back along an owner-recorded signal → work/custody relation. */
export function RunSignalLink({runKey, entry, onBack}: {runKey: string; entry: RunEntry; onBack: () => void}) {
  const kernel = useKernel();
  const statePath = entry.card.source.statePath;
  const field = useField(statePath);
  useEffect(() => { if (!peekField(statePath)) void readField(kernel.transport, statePath); }, [kernel.transport, statePath]);
  if (field?.state === "unavailable") return <p className="frun-note" data-signal-ancestry="unavailable">Signal ancestry unavailable — {field.reason}</p>;
  if (field?.state !== "read") return null;
  const desk = peekDeskReading();
  const source = desk?.inhabitation?.[statePath];
  const linked = field.data.signals.filter(signal => {
    if (!desk) return false;
    if (runKeysForSignal(signal, desk.runs, statePath, source?.state === "read" ? source.data : undefined).includes(runKey)) return true;
    const relation = sourceRunFor(signal.signal_ref);
    return relation?.statePath === statePath && relation.runRef === entry.run.runRef && relation.sourceRevision === signal.source_revision && signal.source_refs.includes(relation.sourceRef);
  });
  if (!linked.length) return null;
  return <div className="fsense-work" data-signal-ancestry={linked.length}>
    <span>Originating signal{linked.length === 1 ? "" : "s"}</span>
    {linked.map(signal => <button key={signal.signal_ref} type="button" onClick={() => { selectSignal(statePath, signal.signal_ref); onBack(); }} title={signal.signal_ref}>{signal.summary}</button>)}
  </div>;
}
