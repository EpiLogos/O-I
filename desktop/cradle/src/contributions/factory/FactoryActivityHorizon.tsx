import {useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {developmentRead} from "./development";

export interface FactoryLocator {statePath: string; runRef?: string; telemetryRef?: string}
interface OwnerRef {owner: string; ref: string; revision: string; standing: string}
interface UnitList {
  contract: string; projectRef: string;
  provenance: {buildStateRevision: number; sourceBases: unknown[]};
  units: {workflowUnitRef: string; key: string; subjectRef: string; basisRevision: string;
    currentCorrelation: {telemetryRefs?: string[]}}[];
}
/** Factory's public execution-telemetry-reading/v1. These names and standings
 * remain owner payload; this is not an O:I execution or formation model. */
export interface FactoryExecutionReading {
  contract: string; telemetryRef: string; projectRef: string; runRef: string;
  executionRef: string; workflowUnitRef: string;
  condition: {
    agentRef: string; agencyRef: string; actuationRef?: string;
    agentSessionRef?: string; sessionSpaceRef?: string; surfaceRefs: string[];
    carrier: {mechanism: string; carrierRef: string; determinationRef: string; source: OwnerRef};
  };
  temporal: {activityRefs: OwnerRef[]};
  returnState: {agencyReturnRef?: string; agencyReturnState?: string; evidenceRefs: string[]};
}

export function FactoryActivityHorizon({locator, onLocator, onSelect, enabled}: {
  locator?: FactoryLocator; onLocator: (value: FactoryLocator) => void;
  onSelect: (value: FactoryExecutionReading | undefined) => void; enabled: boolean;
}) {
  const kernel = useKernel();
  const [path, setPath] = useState(locator?.statePath ?? "");
  const [run, setRun] = useState(locator?.runRef ?? "");
  const [rows, setRows] = useState<FactoryExecutionReading[]>([]);
  const [error, setError] = useState<string>();
  const [observed, setObserved] = useState<string>();
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [titles,setTitles]=useState<Record<string,string>>({});
  const [revision, setRevision] = useState(0);
  const callbacks = useRef({onSelect, onLocator});
  callbacks.current = {onSelect, onLocator};
  const selected = useRef(locator?.telemetryRef); selected.current = locator?.telemetryRef;
  useEffect(() => {
    if (!enabled || !locator?.statePath) return;
    let live = true, timer: ReturnType<typeof setTimeout> | undefined;
    let reading = false;
    setRows([]); setObserved(undefined); setError(undefined); setTotal(0);
    callbacks.current.onSelect(undefined);
    const read = async () => {
      if (!live || reading || document.hidden) return;
      reading = true;
      try {
        // Bounded current correlations, not trajectory or artifact bodies.
        const list = await developmentRead<UnitList>(kernel.transport, locator.statePath, "workflow-units", locator.runRef);
        if (list.contract !== "factory.workflow-unit-list-reading/v1" || !Array.isArray(list.units))
          throw new Error("Factory returned an incompatible workflow-unit reading");
        const refs = [...new Set(list.units.flatMap(unit => unit.currentCorrelation.telemetryRefs ?? []))];
        // Telemetry has native owner currentness independent of the list revision.
        const next: FactoryExecutionReading[] = [];
          for (const ref of refs.slice(0, limit)) {
            if (!live) return;
            const row = await developmentRead<FactoryExecutionReading>(kernel.transport, locator.statePath, "execution-telemetry", ref);
            if (row.contract !== "factory.execution-telemetry-reading/v1" || row.telemetryRef !== ref
                || row.projectRef !== list.projectRef || (locator.runRef && row.runRef !== locator.runRef))
              throw new Error("Factory returned a different execution correlation");
            next.push(row);
          }
        if (!live) return;
        setRows(next); setTotal(refs.length); setError(undefined);
        setTitles(Object.fromEntries(list.units.flatMap(unit=>(unit.currentCorrelation.telemetryRefs??[]).map(ref=>[ref,unit.key]))));
        setObserved(new Date().toLocaleTimeString());
        callbacks.current.onSelect(next.find(row => row.telemetryRef === selected.current));
      } catch (reason) {
        if (live) { setError(String(reason)); callbacks.current.onSelect(undefined); }
      } finally {
        reading = false;
        if (live && !document.hidden) timer = setTimeout(read, 5000);
      }
    };
    const visibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void read();
    };
    document.addEventListener("visibilitychange", visibility);
    void read();
    return () => { live = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [enabled, locator?.statePath, locator?.runRef, kernel.transport, limit, revision]);
  return <section className="factory-activity" aria-label="Factory activity horizon">
    <header><strong className="factory-activity-title">Factory</strong>
      {locator && <button onClick={() => setRevision(value => value + 1)}>Refresh activity</button>}
      {observed && <small>{error ? "Last successful reading" : "Factory read"} {observed}</small>}
      <details className="factory-source-picker"><summary>{locator ? "Work source" : "Connect work"}</summary>
        <form onSubmit={event => {event.preventDefault(); if (!path.trim()) return; setLimit(12); callbacks.current.onLocator({statePath:path.trim(),runRef:run.trim() || undefined});}}>
          <label>Developmental state path<input value={path} onChange={event=>setPath(event.target.value)} required/></label>
          <label>Run ref (optional)<input value={run} onChange={event=>setRun(event.target.value)}/></label>
          <button type="submit">Read activity</button>
        </form>
      </details>
    </header>
    {!locator && <p className="factory-activity-empty">Connect Factory work to follow its executions here.</p>}
    {error && <p role="alert">Activity reading unavailable: {error}. Earlier rows are not a current reading.</p>}
    {locator && observed && !rows.length && !error && <p>No execution correlations are published in this Factory scope.</p>}
    <div className="factory-activity-lanes" aria-label="Correlated executions">
      {rows.map(row=><button key={row.telemetryRef} disabled={!!error} aria-pressed={locator?.telemetryRef===row.telemetryRef}
        data-execution-ref={row.executionRef} onClick={() => {
          callbacks.current.onLocator({...locator!, telemetryRef:row.telemetryRef});
          callbacks.current.onSelect(row);
        }}>
        <strong title={row.executionRef}>{titles[row.telemetryRef] ?? row.executionRef}</strong>
        <span>{row.condition.agentRef} · {row.condition.carrier.mechanism}</span>
        <small>{row.returnState.agencyReturnState ?? "No Return state reported"}</small>
      </button>)}
    </div>
    {total>rows.length && <button onClick={()=>setLimit(value=>value+12)}>Read more ({rows.length} of {total})</button>}
  </section>;
}

export function FactoryExecutionDetails({reading}: {reading: FactoryExecutionReading}) {
  const condition=reading.condition;
  return <section className="factory-execution-reading" aria-label="Selected Factory execution">
    <h2>{reading.executionRef}</h2>
    <dl>{Object.entries({Run:reading.runRef,Agent:condition.agentRef,Agency:condition.agencyRef,
      AgentSession:condition.agentSessionRef,SessionSpace:condition.sessionSpaceRef,
      Carrier:condition.carrier.carrierRef,"Carrier standing":condition.carrier.source.standing,
      Return:reading.returnState.agencyReturnRef}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value ?? "Not reported by owner"}</dd></div>)}</dl>
    <h3>Activity sources</h3>
    {reading.temporal.activityRefs.map(source=><p key={source.ref}><code>{source.ref}</code> · {source.owner} · {source.revision} · {source.standing}</p>)}
    <h3>Evidence refs</h3>
    {reading.returnState.evidenceRefs.length ? reading.returnState.evidenceRefs.map(ref=><p key={ref}><code>{ref}</code></p>) : <p>No Evidence is correlated to this execution.</p>}
    <details><summary>Owner reading and provenance</summary><pre>{JSON.stringify(reading,null,2)}</pre></details>
  </section>;
}
