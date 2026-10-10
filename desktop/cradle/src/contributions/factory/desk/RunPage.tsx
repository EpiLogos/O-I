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
 * Tabs Map · Trajectory · Live · Handoff — nothing stacked below. Live is
 * the Run performed through the Expressions engine (live/RunLiveExpression:
 * cast, goal and work in the Run's act, its timeline, object panels), with
 * the legs/attempts table beneath it.
 */
import {useEffect, useState, type ReactNode, useRef, useId, lazy, Suspense} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {Glyph} from "../../../workspace/Glyph";
import {formatRelativeTime} from "../../../shared/relativeTime";
import {MenuButton, type MenuRow} from "./MenuButton";
import {errorWords, readRunEntry, rememberRunTab as rememberTab, rememberedRunTab, runEntry, useDeskReading, type RunEntry} from "./deskStore";
import {factoryOwner, readRun, inspectTelemetry, type TelemetryInspection} from "./factoryReads";
import {actionSubjectReading, actionSubjectRefusal, FACTORY_ACTION_ADMISSION_MISSING, mergeActionSubjectRead, sameActionTarget, type RunActionTarget, type RunActionSubjectDraft} from "./runActionSubject";
import {RUN_STATE_GLYPH, RUN_STATE_WORD, splitActions, type RunAction} from "./runModel";
import {RunMap} from "./RunMap";
import {RunLive} from "./RunLive";
import {RunHandoff} from "./RunHandoff";
import {RunMaterial} from './RunMaterial';
import {RunTrajectory} from "./RunTrajectory";
import {RunSignalLink} from "../sensing/RunSignalLink";
import {RunLiveExpression} from "../live/RunLiveExpression";

const ComputerView=lazy(()=>import("../ComputerView").then(module=>({default:module.ComputerView})));
export type RunTab = "map" | "trajectory" | "live" | "computer" | "material" | "handoff";
const TABS: {key: RunTab; label: string}[] = [{key: "map", label: "Map"}, {key: "trajectory", label: "Trajectory"}, {key: "live", label: "Live"}, {key:"computer",label:"Computer"}, {key:'material',label:'Material'}, {key: "handoff", label: "Handoff"}];
const isRunTab = (value: string | undefined): value is RunTab => TABS.some(tab => tab.key === value);
/** Open a Run's page on a given tab (a Tasks conversation's Live). */
export function rememberRunTab(runKey: string, tab: RunTab) { rememberTab(runKey, tab); }

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
  /** Original retained owner/workspace/presentation gate. No owner admission. */
  current?:()=>boolean;
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
  const [tab, setTab] = useState<RunTab>(() => { const remembered = rememberedRunTab(runKey); return isRunTab(remembered) ? remembered : "map"; });
  const [reading, setReading] = useState<"reading" | "read" | "refused">("reading");
  const [error, setError] = useState<string>();
  const [telemetry, setTelemetry] = useState<TelemetryInspection>();
  const [raw, setRaw] = useState(false);
  const [acting, setActing] = useState<string>();
  const [actionDraft, setActionDraft] = useState<RunActionSubjectDraft>();
  const actionEpoch = useRef(0);
  const actionAdmissionId = useId();
  const actionContext = useRef({runKey, transport: kernel.transport});
  actionContext.current = {runKey, transport: kernel.transport};

  // A page that has closed stops its read chain: leaving the Run page before
  // the run read answers must not send the telemetry read afterwards.
  const alive = useRef(true);
  const readEpoch=useRef(0),latestRead=useRef({runKey,transport:kernel.transport,host});
  latestRead.current={runKey,transport:kernel.transport,host};
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { actionEpoch.current++; setActionDraft(undefined); setActing(undefined); }, [runKey, kernel.transport, entry?.card.source.statePath, entry?.card.source.projectRef, entry?.run.runRef]);
  const reread = async () => {
    const epoch=++readEpoch.current,original=host.current,capturedKey=runKey,transport=kernel.transport;
    const current=()=>alive.current&&readEpoch.current===epoch&&latestRead.current.runKey===capturedKey&&latestRead.current.transport===transport
      &&(!original||original())&&(!latestRead.current.host.current||latestRead.current.host.current());
    if(!current())return;
    setReading("reading");
    try {
      const next = await readRunEntry(transport, capturedKey,current);
      if (!current()) return;
      setReading(next ? "read" : "refused");
      if (!next) setError("This run is no longer in the Desk's reading.");
      const telemetryRef = next?.inspection?.telemetry?.[0]?.telemetryRef;
      if (next && telemetryRef) {
        const reading = await inspectTelemetry(transport, next.card.source.statePath, telemetryRef).catch(() => undefined);
        if (current()) setTelemetry(reading);
      }
    } catch (reason) { if (current()) { setReading("refused"); setError(errorWords(reason)); } }
  };
  useEffect(() => { void reread(); /* the page's own read on open */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey,kernel.transport]);
  useEffect(() => { rememberTab(runKey, tab); }, [runKey, tab]);
  // A Live open requested while this page is already showing the run.
  useEffect(() => { const remembered = rememberedRunTab(runKey); if (isRunTab(remembered) && remembered !== tab) setTab(remembered); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

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

  const readActionSubjects = async (target: RunActionTarget) => {
    const epoch = ++actionEpoch.current, transport = kernel.transport, capturedKey = runKey,original=host.current;
    const current = () => {
      const retained = runEntry(capturedKey);
      return alive.current && epoch === actionEpoch.current && actionContext.current.runKey === capturedKey && actionContext.current.transport === transport
        &&(!original||original())&&(!latestRead.current.host.current||latestRead.current.host.current())
        && retained?.run.runRef === target.runRef && retained.card.source.statePath === target.statePath && retained.card.source.projectRef === target.projectRef;
    };
    if(!current())return;
    setActing(target.actionRef);
    setActionDraft(draft => draft && sameActionTarget(draft.target, target) ? {...draft, error: undefined} : draft);
    try {
      const listed = await factoryOwner(transport, {kind: "action-list", state_path: target.statePath, project_ref: target.projectRef, run_ref: target.runRef});
      if (!current()) return;
      const nativeRun = await readRun(transport, target.statePath, target.runRef);
      if (!current()) return;
      const reading = actionSubjectReading(target, listed, nativeRun);
      // Update only the owner reading: a subject chosen while the asynchronous
      // read was pending remains the person's uncommitted selection.
      setActionDraft(draft => draft && sameActionTarget(draft.target, target) ? mergeActionSubjectRead(draft, reading) : draft);
    } catch (reason) {
      if (current()) setActionDraft(draft => draft && sameActionTarget(draft.target, target) ? {...draft, error: errorWords(reason)} : draft);
    } finally { if (current()) setActing(undefined); }
  };
  const invoke = (action: RunAction) => {
    const target = {statePath: card.source.statePath, projectRef: card.source.projectRef, runRef: run.runRef, actionRef: action.actionRef};
    setActionDraft(draft => draft && sameActionTarget(draft.target, target) ? draft : {target, label: action.label, selected: ""});
    void readActionSubjects(target);
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
    {actionDraft && <section className="fhandoff-section" aria-label={`Action — ${actionDraft.label}`} data-run-action-subject={actionDraft.target.actionRef}>
      <h2>{actionDraft.label}</h2>
      <label>Subject <select aria-label="Factory action subject" value={actionDraft.selected}
        onChange={event => setActionDraft(draft => draft ? {...draft, selected: event.target.value} : draft)}>
        <option value="">Choose a subject…</option>
        {actionDraft.selected && !actionDraft.reading?.subjects.some(subject => subject.ref === actionDraft.selected)
          && <option value={actionDraft.selected}>{actionDraft.selected} — no longer in the current reading</option>}
        {actionDraft.reading?.subjects.map(subject => <option key={subject.ref} value={subject.ref}>{subject.label} — {subject.ref}</option>)}
      </select></label>
      {acting === actionDraft.target.actionRef && <p role="status">Reading Factory's applicable subjects…</p>}
      {actionDraft.error && <p role="alert">Factory refused the action reading: {actionDraft.error}</p>}
      {actionDraft.reading && <>
        <p className="frun-note">Factory revision {actionDraft.reading.factoryStateRevision} · Run revision {actionDraft.reading.runRevision}</p>
        {actionSubjectRefusal(actionDraft.reading, actionDraft.selected) && <p role="status">{actionSubjectRefusal(actionDraft.reading, actionDraft.selected)}</p>}
      </>}
      <p id={actionAdmissionId} role="status">{FACTORY_ACTION_ADMISSION_MISSING}</p>
      <button type="button" className="oi-action oi-action-primary" disabled aria-describedby={actionAdmissionId}>{actionDraft.label}</button>{" "}
      <button type="button" className="oi-action" disabled={acting === actionDraft.target.actionRef} onClick={() => void readActionSubjects(actionDraft.target)}>Read again</button>{" "}
      <button type="button" className="oi-action" onClick={() => { actionEpoch.current++; setActionDraft(undefined); setActing(undefined); }}>Close action</button>
    </section>}
    <RunSignalLink runKey={runKey} entry={entry} onBack={onBack}/>
    <IconTabStrip aria-label="Run views" items={TABS.map(entry=>({id:entry.key,label:entry.label,icon:entry.key==="map"?"graph":entry.key==="trajectory"?"history":entry.key==="live"?"factory":"file"}))} current={tab} onSelect={id=>setTab(id as typeof tab)}/>
    {reading === "reading" && !entry.inspection && !entry.inspectionError && <p className="frun-note" role="status">Reading this run…</p>}
    {reading === "refused" && <p className="frun-note" role="alert">Couldn't read this run: {error}</p>}
    {entry.inspectionPartial && <p className="frun-note" role="status" data-inspection-partial>{entry.inspectionPartial}</p>}
    <section className="frun-body" role="tabpanel" aria-label={TABS.find(entryTab => entryTab.key === tab)!.label}>
      {tab === "map" && <RunMap entry={entry} runKey={runKey} host={host}/>}
      {tab === "trajectory" && <RunTrajectory entry={entry} host={host}/>}
      {tab === "live" && <RunLiveExpression entry={entry} runKey={runKey} host={host}>
        <RunLive entry={entry} runKey={runKey} host={host} primary={primary} onPrimary={primary ? () => void invoke(primary) : undefined} telemetry={telemetry}/>
      </RunLiveExpression>}
      {tab === "computer" && <Suspense fallback={<p>Opening Computer…</p>}><ComputerView entry={entry}/></Suspense>}
      {tab === 'material' && <RunMaterial key={runKey} entry={entry} host={host}/>}
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
