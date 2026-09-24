import {IconTabStrip} from "../../../workspace/primitives/IconTabStrip";
/**
 * The Run page (11-FACTORY §3): understand the current developmental question
 * before any tool log; then watch it, steer it, and recognise what returned.
 *
 * Full-page centre: it replaces the Desk, with `← Desk` at the top; going back
 * keeps the Desk's reading and scroll. Header: title, the commission purpose
 * as subtitle, one facts line (state · project · started · units · Git basis),
 * ONE primary action (the first currentlyApplicable native action), the rest
 * in ⋯ with Copy run reference and Show raw. No refs in the header.
 * Tabs Map · Trajectory · Live · Handoff — nothing stacked below.
 */
import {useEffect, useState, type ReactNode, useRef} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {formatRelativeTime} from "../../../shared/relativeTime";
import {MenuButton, type MenuRow} from "./MenuButton";
import {errorWords, readRunEntry, runEntry, useDeskReading, type RunEntry} from "./deskStore";
import {inspectTelemetry, type TelemetryInspection} from "./factoryReads";
import {RUN_STATE_GLYPH, RUN_STATE_WORD, splitActions, type RunAction} from "./runModel";
import {RunMap} from "./RunMap";
import {RunLive} from "./RunLive";
import {RunHandoff} from "./RunHandoff";
import {RunTrajectory} from "./RunTrajectory";
import {RunSignalLink} from "../sensing/RunSignalLink";

export type RunTab = "map" | "trajectory" | "live" | "handoff";
const TABS: {key: RunTab; label: string}[] = [{key: "map", label: "Map"}, {key: "trajectory", label: "Trajectory"}, {key: "live", label: "Live"}, {key: "handoff", label: "Handoff"}];
const tabMemory = new Map<string, RunTab>();

/** The Git basis a telemetry reading carries, in its owner's field names. */
export function gitBasisOf(telemetry: TelemetryInspection | undefined): {branch?: string; clean?: boolean; head?: string; repository?: string} | undefined {
  // `factory telemetry inspect` nests the execution reading under `reading`;
  // a correlation whose owner records are pending carries it at `correlation`.
  const outer = telemetry as Record<string, unknown> | undefined;
  const record = (outer?.reading ?? outer?.correlation ?? outer) as Record<string, unknown> | undefined;
  const basis = (record?.gitBasis ?? outer?.gitBasis) as Record<string, unknown> | undefined | null;
  if (!basis) return undefined;
  return {branch: typeof basis.branch === "string" ? basis.branch : undefined, clean: typeof basis.worktreeClean === "boolean" ? basis.worktreeClean : undefined,
    head: typeof basis.baseHead === "string" ? basis.baseHead : undefined, repository: typeof basis.repository === "string" ? basis.repository : undefined};
}

export interface RunPageHost {
  /** Open the conversation carried by a session (Tasks). */
  onOpenConversation?: (sessionRef: string) => void;
  /** Start a conversation from a prompt — it never launches on its own. */
  onStartConversation?: (prompt: string) => void;
  /** Open the right panel's Run tape (at an event when known). */
  onOpenActivity?: (at?: {sessionRef?: string; eventRef?: string}) => void;
  /** Open an object page in place (§6). */
  onOpenObject?: (object: FactoryObjectRef) => void;
  onOpenInExpressions?: (entry: RunEntry) => void;
  onMessage?: (message: string) => void;
}
export type FactoryObjectRef =
  | {kind: "work-unit"; runKey: string; unitRef: string}
  | {kind: "attempt"; runKey: string; attemptRef: string}
  | {kind: "check"; runKey: string; unitRef: string; check: string}
  | {kind: "now-record"; ref: string}
  | {kind: "agent"; ref: string; label?: string}
  | {kind: "position"; ref: string; label?: string};

export function RunPage({runKey, onBack, host}: {runKey: string; onBack: () => void; host: RunPageHost}) {
  const kernel = useKernel();
  useDeskReading(); // re-render when the store's entry changes
  const entry = runEntry(runKey);
  const [tab, setTab] = useState<RunTab>(() => tabMemory.get(runKey) ?? "map");
  const [reading, setReading] = useState<"reading" | "read" | "refused">("reading");
  const [error, setError] = useState<string>();
  const [telemetry, setTelemetry] = useState<TelemetryInspection>();
  const [raw, setRaw] = useState(false);
  const [acting, setActing] = useState<string>();

  // A page that has closed stops its read chain: leaving the Run page before
  // the run read answers must not send the telemetry read afterwards.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const reread = async () => {
    setReading("reading");
    try {
      const next = await readRunEntry(kernel.transport, runKey);
      if (!alive.current) return;
      setReading(next ? "read" : "refused");
      if (!next) setError("This run is no longer in the Desk's reading.");
      const telemetryRef = next?.inspection?.telemetry?.[0]?.telemetryRef;
      if (next && telemetryRef) {
        const reading = await inspectTelemetry(kernel.transport, next.card.source.statePath, telemetryRef).catch(() => undefined);
        if (alive.current) setTelemetry(reading);
      }
    } catch (reason) { if (alive.current) { setReading("refused"); setError(errorWords(reason)); } }
  };
  useEffect(() => { void reread(); /* the page's own read on open */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);
  useEffect(() => { tabMemory.set(runKey, tab); }, [runKey, tab]);

  if (!entry) return <div className="frun" aria-label="Run"><BackBar onBack={onBack}/><p className="frun-empty">This run is no longer in the Desk's reading.</p></div>;
  const {card, run} = entry;
  const {primary, others} = splitActions(run.actions);
  const basis = gitBasisOf(telemetry);
  const facts: ReactNode[] = [
    <span key="state" className="frun-state" data-state={card.state}><span aria-hidden="true">{RUN_STATE_GLYPH[card.state]}</span> {RUN_STATE_WORD[card.state]}</span>,
    card.projectName && <span key="project">{card.projectName}</span>,
    card.startedAt && Number.isFinite(Date.parse(card.startedAt)) && <span key="started">started {formatRelativeTime(Date.parse(card.startedAt))}</span>,
    card.units.length > 0 && <span key="units">{card.units.length} unit{card.units.length === 1 ? "" : "s"}</span>,
    basis?.branch && <span key="git">branch {basis.branch}{basis.clean === undefined ? "" : basis.clean ? " (clean)" : " (dirty)"}</span>,
  ].filter(Boolean);

  const invoke = async (action: RunAction) => {
    // The owner's action projection is invoked with its own request contract;
    // the desktop never fabricates a subject — the applicable subject refs
    // are the owner's.
    host.onMessage?.(`${action.label}: the owner's action request needs a subject the desktop does not choose (${(action.applicableSubjectRefs ?? []).length} applicable).`);
    setActing(undefined);
  };
  const copyRef = () => { void navigator.clipboard?.writeText(run.runRef).then(() => host.onMessage?.("Run reference copied."), () => host.onMessage?.("The clipboard refused the run reference.")); };
  const menu: MenuRow[] = [
    ...others.map(action => ({label: action.label, onSelect: () => void invoke(action)})),
    ...(host.onOpenInExpressions ? [{label: "Open in Expressions", onSelect: () => host.onOpenInExpressions?.(entry), separatorBefore: others.length > 0}] : []),
    {label: "Copy run reference", onSelect: copyRef, separatorBefore: others.length > 0 && !host.onOpenInExpressions},
    {label: raw ? "Hide raw" : "Show raw", onSelect: () => setRaw(value => !value)},
  ];

  return <div className="frun" aria-label={`Run — ${card.title}`} data-run-page={run.runRef}>
    <BackBar onBack={onBack}/>
    <header className="frun-head">
      <div className="frun-head-text">
        <h1 data-run-title>{card.title}</h1>
        {card.purpose && <p className="frun-purpose" data-run-purpose>{card.purpose}</p>}
        <p className="frun-facts" data-run-facts>{facts.map((fact, index) => <span key={index}>{index > 0 && <span className="frun-dot" aria-hidden="true"> · </span>}{fact}</span>)}</p>
      </div>
      <div className="frun-actions">
        {primary && <button type="button" className="oi-action oi-action-primary" data-primary-action={primary.actionRef} disabled={acting === primary.actionRef}
          onClick={() => { setActing(primary.actionRef); void invoke(primary); }}>{primary.label}</button>}
        <MenuButton ariaLabel="More run actions" className="oi-action frun-more" label={<Glyph name="more" size={14}/>} rows={menu}/>
      </div>
    </header>
    <IconTabStrip aria-label="Run views" items={TABS.map(entry=>({id:entry.key,label:entry.label,icon:entry.key==="map"?"graph":entry.key==="trajectory"?"history":entry.key==="live"?"factory":"file"}))} current={tab} onSelect={id=>setTab(id as typeof tab)}/>
    {reading === "reading" && !entry.inspection && !entry.inspectionError && <p className="frun-note" role="status">Reading this run…</p>}
    {reading === "refused" && <p className="frun-note" role="alert">Couldn't read this run: {error}</p>}
    {entry.inspectionPartial && <p className="frun-note" role="status" data-inspection-partial>{entry.inspectionPartial}</p>}
    <section className="frun-body" role="tabpanel" aria-label={TABS.find(entryTab => entryTab.key === tab)!.label}>
      {tab === "map" && <RunMap entry={entry} runKey={runKey} host={host}/>}
      {tab === "trajectory" && <RunTrajectory entry={entry} host={host}/>}
      {tab === "live" && <RunLive entry={entry} runKey={runKey} host={host} primary={primary} onPrimary={primary ? () => void invoke(primary) : undefined} telemetry={telemetry}/>}
      {tab === "handoff" && <RunHandoff entry={entry} host={host} onRecognised={() => void reread()}/>}
    </section>
    {raw && <details className="frun-raw" open>
      <summary>Raw owner readings</summary>
      <pre>{JSON.stringify({run: entry.run, journey: entry.journey, inspection: entry.inspection ?? null}, null, 2)}</pre>
    </details>}
  </div>;
}

function BackBar({onBack, label = "Desk"}: {onBack: () => void; label?: string}) {
  return <div className="frun-back"><button type="button" className="frun-back-link" onClick={onBack}>← {label}</button></div>;
}
export {BackBar};
