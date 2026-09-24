import {useEffect, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import type {DeskReading} from "../desk/deskStore";
import {openRunPage} from "../desk/deskStore";
import {factoryOwner, inspectTelemetry, type TelemetryInspection} from "../desk/factoryReads";
import {ownerReadFailure, type OwnerRead} from "../inhabitation/model";
import {label, runKeysForSignal, temporalOf, when, type Coverage, type Field, type SignalDetail, type SignalSummary, type TemporalReading} from "./model";
import {peekField, readField, readSignal, rememberSourceRun, useField, useSelectedSignal, selectSignal} from "./reading";
import "./sensing.css";

type DocumentRead = OwnerRead<TemporalReading> | {state: "reading"};
function sourceName(project: string | undefined) { return project ?? "Central"; }
function refLink(ref: string) {
  return /^https?:\/\//.test(ref) ? <a href={ref} target="_blank" rel="noreferrer">{ref}</a> : <code>{ref}</code>;
}
const readable = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const shortRef = (ref: string) => ref.length > 30 ? `${ref.slice(0, 15)}…${ref.slice(-8)}` : ref;
function namesOfAbsences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === "string" ? item : item && typeof item === "object" ? readable((item as Record<string, unknown>).reason) ?? readable((item as Record<string, unknown>).source) : undefined).filter((item): item is string => !!item);
}

/** One source's owner-native sensing field, inside the existing Desk. */
function SourceSensing({statePath, project, desk, readAt}: {statePath: string; project?: string; desk: DeskReading; readAt: number}) {
  const kernel = useKernel();
  const field = useField(statePath);
  const selected = useSelectedSignal();
  const [detail, setDetail] = useState<OwnerRead<SignalDetail> | {state: "reading"}>();
  const [detailFor, setDetailFor] = useState<string>();
  const [digest, setDigest] = useState<DocumentRead>();
  const [history, setHistory] = useState<DocumentRead>();
  const [day, setDay] = useState("");
  const [refreshAt, setRefreshAt] = useState(0);
  useEffect(() => { void readField(kernel.transport, statePath, refreshAt > 0); }, [kernel.transport, statePath, readAt, refreshAt]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && peekField(statePath)?.state === "read") setRefreshAt(value => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [statePath]);
  useEffect(() => {
    let live = true;
    setDigest({state: "reading"});
    void factoryOwner(kernel.transport, {kind: "telemetry-digest", state_path: statePath}).then(data => temporalOf(data, "factory.telemetry-digest/v1")).then(
      data => { if (live) setDigest({state: "read", source: "factory telemetry digest", data}); },
      error => { if (live) setDigest(ownerReadFailure(error, "factory telemetry digest")); },
    );
    return () => { live = false; };
  }, [kernel.transport, statePath, readAt, refreshAt]);
  useEffect(() => {
    if (selected?.statePath !== statePath) return;
    let live = true;
    setDetailFor(selected.signalRef);
    setDetail({state: "reading"});
    void readSignal(kernel.transport, statePath, selected.signalRef).then(answer => { if (live) setDetail(answer); });
    return () => { live = false; };
  }, [kernel.transport, selected?.signalRef, selected?.statePath, statePath]);
  const historyRead = async (kind: "telemetry-lookback" | "telemetry-day") => {
    setHistory({state: "reading"});
    try {
      const data = await factoryOwner(kernel.transport, {kind, state_path: statePath, ...(day ? {day} : {})});
      setHistory({state: "read", source: `factory ${kind}`, data: temporalOf(data, kind === "telemetry-day" ? "factory.telemetry-day/v1" : "factory.telemetry-lookback/v1")});
    } catch (error) { setHistory(ownerReadFailure(error, `factory ${kind}`)); }
  };
  const data = field?.state === "read" ? field.data : undefined;
  const source = sourceName(project);
  const currentSelection = selected?.statePath === statePath
    ? data?.signals.find(signal => signal.signal_ref === selected.signalRef)
      ?? (digest?.state === "read" ? digest.data.signals.find(signal => signal.signal_ref === selected.signalRef) : undefined)
      ?? (history?.state === "read" ? history.data.signals.find(signal => signal.signal_ref === selected.signalRef) : undefined)
      ?? (detail?.state === "read" && detail.data.signal?.signal_ref === selected.signalRef ? detail.data.summary : undefined)
    : undefined;
  return <section className="fsense-source" aria-label={`${source} sensing`} data-sensing-source={source}>
    <header className="fsense-source-head"><strong>{source}</strong><small title={data?.source_revision}>{data ? `${field?.source} · observed ${when(data.observed_at_unix_ms)} · revision ${shortRef(data.source_revision)}` : "owner reading"}</small><button type="button" onClick={() => setRefreshAt(value => value + 1)} aria-label={`Refresh sensing for ${source}`}>Refresh sensing</button></header>
    <>
        {!field || field.state === "reading" ? <p className="fsense-note" role="status">Reading current signals…</p> : field.state === "unavailable" ? <p className="fsense-absence" role="status">Current signals unavailable — {field.reason}</p> : null}
        {data?.truncated && <p className="fsense-absence" data-field-truncated="true">Factory capped this field. Further signals may exist; cursor {data.cursor ?? "not supplied"}.</p>}
        {namesOfAbsences(data?.absences).map((absence, index) => <p key={index} className="fsense-absence">{absence}</p>)}
        <div className="fsense-grid">
          <section aria-label="Signals" className="fsense-group"><h3>Signals <span>{data?.signals.length}</span></h3>
            {data?.signals.length ? <ul className="fsense-list">{data.signals.map(signal => <li key={signal.signal_ref}>
              <button type="button" className="fsense-signal" onClick={() => selectSignal(statePath, signal.signal_ref)} data-signal-ref={signal.signal_ref}>
                <strong>{signal.summary}</strong><span>{label(signal.classification)} · {label(signal.disposition)} · {when(signal.updated_at_unix_ms)}</span>
              </button>
            </li>)}</ul> : <p className={data && !data.coverage.length ? "fsense-absence" : "fsense-note"}>{data ? "No signals in the read field. Source coverage appears under Health." : "Current signal field has not been read."}</p>}
          </section>
          <section aria-label="Decisions" className="fsense-group"><h3>Decisions</h3>
            <DecisionReading digest={digest} field={data} onOpen={ref => selectSignal(statePath, ref)}/>
          </section>
          <section aria-label="History" className="fsense-group"><h3>History</h3>
            <div className="fsense-history-controls"><label>Day <input type="date" value={day} onChange={event => setDay(event.target.value)} aria-label={`History Day for ${source}`}/></label>
              <button type="button" onClick={() => void historyRead("telemetry-lookback")}>Look back</button>
              <button type="button" disabled={!day} onClick={() => void historyRead("telemetry-day")}>Read Day</button></div>
            <HistoryReading reading={history} onOpen={ref => selectSignal(statePath, ref)}/>
          </section>
          <section aria-label="Health" className="fsense-group"><h3>Health</h3>
            <CoverageReading rows={data?.coverage ?? []}/>
          </section>
        </div>
        {currentSelection && <SignalInspection signal={currentSelection} detail={detailFor === currentSelection.signal_ref ? detail : undefined} statePath={statePath} desk={desk}/>}
        {selected?.statePath === statePath && !currentSelection && <p className="fsense-note" role="status">{detailFor === selected.signalRef && detail?.state === "unavailable" ? `Signal evidence unavailable — ${detail.reason}` : "Reading selected signal evidence…"}</p>}
      </>
  </section>;
}

function DecisionReading({digest, field, onOpen}: {digest: DocumentRead | undefined; field?: Field; onOpen: (signalRef: string) => void}) {
  const held = field?.signals.filter(signal => !!signal.decision_needed) ?? [];
  const answer = digest?.state === "read" ? digest.data : undefined;
  const decisions = answer?.signals ?? held;
  return <div data-digest-readonly="true">
    {answer && <p className="fsense-note">{answer.counts.records} unresolved human decision{answer.counts.records === 1 ? "" : "s"} retained · affected people/sessions {answer.counts.affected_users == null || answer.counts.affected_sessions == null ? "not established" : `${answer.counts.affected_users}/${answer.counts.affected_sessions}`}</p>}
    {decisions.length ? <ul className="fsense-list">{decisions.map(signal => <li key={signal.signal_ref}><button type="button" className="fsense-decision" onClick={() => onOpen(signal.signal_ref)} data-decision-signal={signal.signal_ref}><strong>{signal.decision_needed ?? "Decision text unavailable in source"}</strong><span>{signal.summary} · {signal.source_refs.join(", ")}</span></button></li>)}</ul>
      : <p className={answer && !answer.source_coverage_complete ? "fsense-absence" : "fsense-note"}>{answer ? answer.source_coverage_complete ? "No unresolved human decision returned." : "No decision returned; source coverage is incomplete for this reading." : digest?.state === "unavailable" ? "No current field decision was available." : "Waiting for the owner digest."}</p>}
    {!digest || digest.state === "reading" ? <p className="fsense-note" role="status">Reading the human digest…</p> : digest.state === "unavailable" ? <p className="fsense-absence" role="status">Digest unavailable — {digest.reason}. Current field decisions appear above.</p> : <>
      {answer?.truncated && <p className="fsense-absence">The digest is truncated; more decisions may exist.</p>}
      {answer && !answer.source_coverage_complete && <p className="fsense-absence">The digest does not establish complete source coverage for its temporal basis.</p>}
      {answer?.patterns.filter(pattern => pattern.signal_refs.length > 1).map(pattern => <p key={pattern.boundary_ref} className="fsense-note">{pattern.records} related records at {pattern.boundary_ref}; grouping basis: {pattern.grouping_basis}.</p>)}
    </>}
    <p className="fsense-note">Read only. Decisions remain with their owner.</p>
  </div>;
}

function CoverageReading({rows}: {rows: Coverage[]}) {
  return rows.length ? <ul className="fsense-coverage">{rows.map((row, index) => <li key={`${row.source_ref}-${index}`} data-coverage-state={row.state}>
    <strong>{label(row.state)}</strong><span>{row.provider_ref} · {row.scope}</span>
    <small>{row.records} records · {row.pages} pages · {when(row.window.since_unix_ms)} to {when(row.window.until_unix_ms)}{row.cursor ? ` · cursor ${row.cursor}` : ""}</small>
    {row.reason && <small>{row.reason}</small>}
    <span className="fsense-ref">{refLink(row.source_ref)}</span>
  </li>)}</ul> : <p className="fsense-absence">No source coverage was included. Zero records cannot be established.</p>;
}

function HistoryReading({reading, onOpen}: {reading?: DocumentRead; onOpen: (signalRef: string) => void}) {
  if (!reading) return <p className="fsense-note">Read a bounded period from Factory’s Day history.</p>;
  if (reading.state === "reading") return <p className="fsense-note" role="status">Reading history…</p>;
  if (reading.state === "unavailable") return <p className="fsense-absence" role="status">History unavailable — {reading.reason}</p>;
  const data = reading.data;
  return <div data-history-schema={data.schema}>
    <p className="fsense-note">{when(data.window.since_unix_ms)} to {when(data.window.until_unix_ms)} · {data.counts.records} record{data.counts.records === 1 ? "" : "s"}; people and sessions not established.</p>
    {data.truncated && <p className="fsense-absence">This history reading is truncated. More signals may exist.</p>}
    {!data.source_coverage_complete && <p className="fsense-absence">Source coverage is incomplete for this period. An empty reading does not establish zero events.</p>}
    {data.patterns.length ? <ul className="fsense-list">{data.patterns.map(pattern => { const lead = data.signals.find(signal => pattern.signal_refs.includes(signal.signal_ref)); return <li key={pattern.boundary_ref} className="fsense-history-row">
      <strong>{lead?.summary ?? `${pattern.records} related records`}</strong><small title={pattern.boundary_ref}>Boundary {shortRef(pattern.boundary_ref)}</small><span>{pattern.records} related record{pattern.records === 1 ? "" : "s"} · {pattern.identity_basis}</span>
      {pattern.recurrence_after_live_fix && <span className="fsense-absence">Recurrence after a live fix</span>}
      {pattern.prior_fix_refs.length > 0 && <span>Earlier live fixes: {pattern.prior_fix_refs.map(ref => <span key={ref}>{refLink(ref)} </span>)}</span>}
      <span>Signals: {pattern.signal_refs.map((ref, index) => <button key={ref} type="button" className="fsense-ref-button" onClick={() => onOpen(ref)} aria-label={ref} title={ref}>Open {index + 1} · {shortRef(ref)}</button>)}</span>
      <span>Sources: {pattern.source_refs.map(ref => <span key={ref}>{refLink(ref)} </span>)}</span>
      <small>{pattern.grouping_basis}</small>
    </li>; })}</ul> : <p className="fsense-note">No grouped pattern returned in this period.</p>}
    {data.carried_signal_refs.length > 0 && <p className="fsense-note">Work carried through this Day: {data.carried_signal_refs.map(ref => <button key={ref} type="button" className="fsense-ref-button" onClick={() => onOpen(ref)} aria-label={ref} title={ref}>{shortRef(ref)}</button>)}</p>}
    <details><summary>Source coverage for this period</summary><CoverageReading rows={data.coverage}/></details>
    <p className="fsense-note">Read only. Human Day prose was not changed.</p>
  </div>;
}

function SignalInspection({signal, detail, statePath, desk}: {signal: SignalSummary; detail?: OwnerRead<SignalDetail> | {state: "reading"}; statePath: string; desk: DeskReading}) {
  const sourceInhabitation = desk.inhabitation?.[statePath];
  const runKeys = runKeysForSignal(signal, desk.runs, statePath, sourceInhabitation?.state === "read" ? sourceInhabitation.data : undefined);
  const record = detail?.state === "read" ? detail.data.signal : undefined;
  return <aside className="fsense-inspection" aria-label="Signal evidence" data-signal-detail={signal.signal_ref}>
    <div className="fsense-inspection-head"><h3>{signal.summary}</h3><button type="button" onClick={() => selectSignal(statePath, "")}>Close</button></div>
    <p>{label(signal.classification)} · {label(signal.disposition)}</p>
    <dl><dt>Signal</dt><dd><code>{signal.signal_ref}</code></dd><dt>Source</dt><dd>{signal.source_refs.map(ref => <span key={ref}>{refLink(ref)} </span>)}</dd>
      {signal.position_ref && <><dt>Position</dt><dd><code>{signal.position_ref}</code></dd></>}
      {signal.now_ref && <><dt>NOW</dt><dd><code>{signal.now_ref}</code></dd></>}
      {signal.return_ref && <><dt>Return</dt><dd><code>{signal.return_ref}</code></dd></>}
      {signal.decision_needed && <><dt>Decision needed</dt><dd>{signal.decision_needed}</dd></>}</dl>
    {runKeys.length ? <div className="fsense-work"><span>Factory work</span>{runKeys.map(key => <button key={key} type="button" onClick={() => openRunPage(key)}>Open linked Run</button>)}</div>
      : signal.work_ref ? <p className="fsense-absence">Work ref <code>{signal.work_ref}</code> is not linked to a Run in this Desk reading.</p> : null}
    {!detail || detail.state === "reading" ? <p className="fsense-note" role="status">Reading original observation…</p> : detail.state === "unavailable" ? <p className="fsense-absence">Original observation unavailable — {detail.reason}</p> : <>
      {record?.observation && <div className="fsense-observation"><strong>Original observation</strong><p>{record.observation.summary}</p><dl><dt>Provider</dt><dd>{record.observation.provider_ref}</dd><dt>Source revision</dt><dd>{record.observation.source_revision}</dd><dt>Occurred</dt><dd>{when(record.observation.occurred_at_unix_ms ?? undefined)}</dd><dt>Observed</dt><dd>{when(record.observation.observed_at_unix_ms)}</dd><dt>Source ref</dt><dd>{refLink(record.observation.source_ref)}</dd></dl>
        {record.observation.provider_ref === "factory" && record.observation.source_ref.startsWith("telemetry:") && <NativeTelemetrySource key={record.observation.source_ref} signalRef={signal.signal_ref} statePath={statePath} sourceRef={record.observation.source_ref} sourceRevision={record.observation.source_revision} desk={desk}/>}</div>}
      {(record?.decisions ?? []).map((decision, index) => <p key={index} className="fsense-note">{decision.reason}{decision.evidence_refs?.length ? ` · evidence ${decision.evidence_refs.join(", ")}` : ""}</p>)}
    </>}
  </aside>;
}

/** A Factory telemetry ref has a native inspect route. Other source refs are
 * left visible as refs until their own provider supplies a drill contract. */
function NativeTelemetrySource({signalRef, statePath, sourceRef, sourceRevision, desk}: {signalRef: string; statePath: string; sourceRef: string; sourceRevision: string; desk: DeskReading}) {
  const kernel = useKernel();
  const [reading, setReading] = useState<OwnerRead<TelemetryInspection> | {state: "reading"}>();
  const read = async () => {
    setReading({state: "reading"});
    try {
      const data = await inspectTelemetry(kernel.transport, statePath, sourceRef);
      const source = (data.reading ?? data.correlation) as Record<string, unknown> | undefined;
      if (source && readable(source.telemetryRef) === sourceRef && readable(source.runRef)) rememberSourceRun(signalRef, statePath, sourceRef, sourceRevision, String(source.runRef));
      setReading({state: "read", source: "factory telemetry inspect", data});
    }
    catch (error) { setReading(ownerReadFailure(error, "factory telemetry inspect")); }
  };
  const source = reading?.state === "read" ? (reading.data.reading ?? reading.data.correlation) as Record<string, unknown> | undefined : undefined;
  const status = reading?.state === "read" ? readable(reading.data.status) : undefined;
  const runRef = readable(source?.runRef);
  const runKey = runRef ? Object.entries(desk.runs).find(([, entry]) => entry.card.source.statePath === statePath && entry.run.runRef === runRef)?.[0] : undefined;
  return <div className="fsense-native-source"><button type="button" onClick={() => void read()}>Read Factory source</button>
    {reading?.state === "reading" && <p className="fsense-note" role="status">Reading source evidence…</p>}
    {reading?.state === "unavailable" && <p className="fsense-absence">Source evidence unavailable — {reading.reason}</p>}
    {reading?.state === "read" && <div data-native-source={sourceRef}><p className="fsense-note">{status ? label(status) : "Factory telemetry inspection"}</p>
      {source && <dl><dt>Telemetry</dt><dd><code>{readable(source.telemetryRef) ?? sourceRef}</code></dd>
        {runRef && <><dt>Run</dt><dd>{runKey ? <button type="button" onClick={() => openRunPage(runKey)}>Open source Run</button> : <code>{runRef}</code>}</dd></>}
        {readable(source.executionRef) && <><dt>Execution</dt><dd><code>{String(source.executionRef)}</code></dd></>}
      </dl>}
      {!source && <p className="fsense-absence">Factory returned the source ref but no supported relation fields.</p>}
    </div>}
  </div>;
}

export function SignalsPanel({desk}: {desk: DeskReading}) {
  const sources = desk.discovery?.sources ?? [];
  if (desk.status !== "read") return <section className="fsense" aria-label="Factory sensing"><h2>Factory sensing</h2><p className="fsense-note">Waiting for Factory sources…</p></section>;
  return <section className="fsense" aria-label="Factory sensing" data-sensing="read">
    <header className="fsense-head"><div><p className="fsense-eyebrow">Current World</p><h2>Signals &amp; decisions</h2></div><p>Source-qualified Factory readings, in this Desk’s scope.</p></header>
    {sources.length ? sources.map(source => <SourceSensing key={source.statePath} statePath={source.statePath} project={source.project} desk={desk} readAt={desk.readAt ?? 0}/>)
      : <p className="fsense-absence">No Factory state source was located in this scope. No telemetry result is inferred.</p>}
  </section>;
}
