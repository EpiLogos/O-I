import {useEffect, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {readAssociatedFlow} from "./factoryReads";
import {runFlowName, runFlowObservationKey, type RunFlowAssociation, type RunFlowObservation} from "./runFlow";
import type {RunEntry} from "./deskStore";
import type {RunPageHost} from "./RunPage";
import "./RunFlowLink.css";

type Reading = {key: string; state: "reading"} | {key: string; state: "refused"; reason: string}
  | {key: string; state: "read"; observation: RunFlowObservation};
const words = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Local read state belongs to this exact retained association. Closing the
 * view discards the observation, never native work, history or Return. */
function RunFlowLink({entry, association, host}: {entry: RunEntry; association: RunFlowAssociation; host: RunPageHost}) {
  const kernel = useKernel();
  const key = runFlowObservationKey(entry.run, entry.card.source.statePath, association);
  const [refresh, setRefresh] = useState(0);
  const [reading, setReading] = useState<Reading>({key, state: "reading"});
  const [opening, setOpening] = useState<string>();
  const [openError, setOpenError] = useState<{key: string; reason: string}>();
  useEffect(() => {
    let active = true;
    setReading({key, state: "reading"});
    setOpenError(undefined);
    void readAssociatedFlow(kernel.transport, association).then(observation => {
      if (active) setReading({key, state: "read", observation});
    }, error => {
      if (active) setReading({key, state: "refused", reason: words(error)});
    });
    return () => { active = false; };
    // The immutable serialized basis includes provider revision and the full
    // relation. A late answer for an older basis is ignored by this cleanup.
  }, [key, kernel.transport, refresh]);
  const shown: Reading = reading.key === key ? reading : {key, state: "reading"};
  const observation = shown.state === "read" ? shown.observation : undefined;
  const available = observation && observation.state !== "replaced";
  const open = async () => {
    if (!host.onOpenFlow || !available) return;
    setOpening(key); setOpenError(undefined);
    try {
      // The ordinary frame opener checks the document in the actual file read
      // used to register/open it; a prior bounded observation is not a grant.
      await host.onOpenFlow({name: runFlowName(association), location: association.flow.location,
        expectedDocumentId: association.flow.documentId});
    } catch (error) { setOpenError({key, reason: words(error)}); }
    finally { setOpening(undefined); }
  };
  const status = shown.state === "reading" ? "Reading the current Flow…"
    : shown.state === "refused" ? `Flow unavailable: ${shown.reason}`
    : shown.observation.state === "replaced" ? "Last read found a different Flow at the retained location."
    : shown.observation.state === "changed" ? "Last read found Flow changed since this Run linked it."
    : "Last read matched the Flow basis this Run linked.";
  return <section className="frun-flow" aria-label="Run Flow" data-run-flow={association.flow.documentId}
    data-run-flow-state={shown.state === "read" ? shown.observation.state : shown.state}
    data-factory-provider-revision={entry.run.provenance?.factoryStateRevision}
    data-retained-flow-source-revision={association.flow.sourceRevision}
    data-observed-flow-source-revision={observation?.current.sourceRevision}>
    <div className="frun-flow-controls">
      <span>{runFlowName(association)}</span>
      <button type="button" className="oi-action" disabled={!host.onOpenFlow || !available || opening !== undefined}
        onClick={() => void open()}>Open Flow</button>
      <button type="button" className="oi-action" disabled={shown.state === "reading"}
        onClick={() => setRefresh(value => value + 1)}>Read Flow</button>
    </div>
    <p className="frun-note" role={shown.state === "refused" ? "alert" : "status"}>{status}</p>
    {openError?.key === key && <p className="frun-note" role="alert">Couldn't open Flow: {openError.reason}</p>}
    <details><summary>Flow basis</summary>
      <dl>
        <dt>Retained document revision</dt><dd>{association.flow.documentRevision}</dd>
        <dt>Retained source revision</dt><dd>{association.flow.sourceRevision}</dd>
        {observation && <><dt>Observed document revision</dt><dd>{observation.current.documentRevision}</dd>
          <dt>Observed source revision</dt><dd>{observation.current.sourceRevision}</dd></>}
        <dt>Workflow source</dt><dd>{association.workflowSourceRef} @ {association.workflowSourceRevision}</dd>
        <dt>Native location</dt><dd>{association.flow.location.ref}</dd>
      </dl>
    </details>
  </section>;
}
export function RunFlowLinks({entry, host}: {entry: RunEntry; host: RunPageHost}) {
  return <>{(entry.run.flowAssociations ?? []).map(association =>
    <RunFlowLink key={`${entry.run.runRef}|${association.flow.location.ref}|${association.flow.documentId}`}
      entry={entry} association={association} host={host}/>)}</>;
}
