import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActionInvocation, FactoryBuildView, FactoryMaterialSelection } from './types'
import { CandidateReading } from "./CandidateReading"
import { SpanDetail } from './components/SpanDetail'
import { TraceWaterfall } from './components/TraceWaterfall'
import './styles.css'
import './build-surface.css'

export interface BuildSurfaceProps {
  view: FactoryBuildView
  onAction?: (invocation: ActionInvocation) => void | Promise<void>
  onOpenWorkingSurface?: (selection: Omit<import("../../encounter/working-surface").WorkingSurfaceSelection,"project">) => Promise<void>
  /** O:I-owned controls for this selected Run, kept inside Build's existing header. */
  headerControls?: ReactNode
  runSummary?: ReactNode
  runMap?: ReactNode
  onOpenMaterial?: (selection:FactoryMaterialSelection)=>Promise<void>
}

/** The owner's frontier words with engine wrappers unwrapped — `RunMap
 * frontier: Some(Ready)` is owner payload syntax, not reading copy. */
function frontierSummary(summary: string): string {
  const bare = summary.replace(/^RunMap frontier:\s*/, "").trim()
  const wrapped = /^Some\((.*)\)$/.exec(bare)
  const text = (wrapped ? wrapped[1] : /^None$/i.test(bare) ? "" : bare).trim()
  return text ? text.replace(/[_-]+/g, " ") : ""
}

function spokenStatus(status: string): string {
  const clean = status.replaceAll("_", " ").trim().toLowerCase()
  return clean ? clean.replace(/\b\w/g, letter => letter.toUpperCase()) : "Unknown"
}

/** One sentence for where the Run stands, derived only from what the Build
 * view carries (decisions, active work, retained candidates) — never from
 * parsing the owner's status enum beyond echoing it when nothing else is
 * known. The kind colours a quiet stage dot; it is not an owner status. */
function runStage(view: FactoryBuildView): {text: string; kind: "waiting" | "working" | "returned" | "finished" | "idle"} {
  const active = activeExecutionCount(view)
  if (view.humanRequests.length) return {text: `Waiting on you — ${view.humanRequests.length} decision${view.humanRequests.length === 1 ? "" : "s"} pending`, kind: "waiting"}
  if (active) return {text: `Working — ${active} of ${view.executions.length} ${view.executions.length === 1 ? "execution" : "executions"} active`, kind: "working"}
  if (view.candidates.length) return {text: `Returned — ${view.candidates.length} candidate${view.candidates.length === 1 ? "" : "s"} for review`, kind: "returned"}
  if (view.executions.length) return {text: "Executions have finished — nothing retained for review yet", kind: "finished"}
  return {text: `${spokenStatus(view.run.status)} — nothing has run yet`, kind: "idle"}
}

function activeExecutionCount(view: FactoryBuildView): number {
  return view.executions.filter(execution => (execution.status ?? "").toLowerCase() === "running").length
}

function ActionButton({ actionRef, subjectRef, label, availability, unavailableReason, onAction }: {
  actionRef: string; subjectRef: string; label: string; availability?: string; unavailableReason?: string; onAction?: (invocation: ActionInvocation) => void | Promise<void>
}) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string>()
  // An operation Factory has not admitted is stated quietly where it stands,
  // not presented as a collapsed pseudo-control.
  if (!onAction || availability !== "available") return <span className="fb-action-blocked"><span>{label} — unavailable</span><small>{unavailableReason ?? "Factory has not supplied an admitted operation for this subject."}</small></span>
  async function invoke() {
    setBusy(true);setError(undefined)
    try { await onAction?.({actionRef,subjectRef}) }
    catch(reason) { setError(String(reason)) }
    finally { setBusy(false) }
  }
  return <div><button type="button" className="fb-action" disabled={busy} onClick={()=>void invoke()}>{busy?"Applying…":label}</button>{error&&<p role="alert">{error}</p>}</div>
}

/** One reading of the Run: header speaks the stage, human decisions pin to
 * the top, the body follows what the Run actually carries (live work, then
 * review — or review first once work has stopped), the work map folds into
 * an orientation strip, and each execution drills into its own trace. */
export function BuildSurface({ view, onAction, onOpenWorkingSurface, headerControls, runSummary, runMap, onOpenMaterial }: BuildSurfaceProps) {
  const [drilledExecutionRef, setDrilledExecutionRef] = useState<string>()
  const [spanRef, setSpanRef] = useState<string | undefined>(undefined)
  const [surfaceChoices,setSurfaceChoices]=useState<Record<string,string>>({})
  const [workingSurfaceError, setWorkingSurfaceError] = useState<{ executionRef: string; detail: string }>()
  const workingSurfaceGeneration = useRef(0)
  useEffect(() => {
    workingSurfaceGeneration.current += 1
    setDrilledExecutionRef(undefined)
    setSpanRef(undefined)
    setSurfaceChoices({})
    setWorkingSurfaceError(undefined)
  }, [view.run.runRef])
  const [openingExecutionRef, setOpeningExecutionRef] = useState<string>()

  async function openWorkingSurface(execution: FactoryBuildView["executions"][number]) {
    const surfaces=execution.surfaceRefs??[]
    const surface=surfaces.length===1?surfaces[0]:surfaceChoices[execution.executionRef]
    if (!onOpenWorkingSurface || !execution.agentSessionRef || !execution.sessionSpaceRef || (surfaces.length>1&&!surfaces.includes(surface))) return
    const generation=++workingSurfaceGeneration.current
    setOpeningExecutionRef(execution.executionRef)
    setWorkingSurfaceError(undefined)
    try {
      await onOpenWorkingSurface({ agentSession: execution.agentSessionRef, space: execution.sessionSpaceRef, surface })
    } catch (error) {
      if (workingSurfaceGeneration.current===generation) setWorkingSurfaceError({ executionRef: execution.executionRef, detail: String(error) })
    } finally {
      if (workingSurfaceGeneration.current===generation) setOpeningExecutionRef(undefined)
    }
  }

  const candidateActions = view.actions.filter((action) => action.subjectKinds.includes('candidate'))
  const runActions = view.actions.filter((action) => action.subjectKinds.includes('run'))
  const frontier = view.frontier
  const frontierText = frontierSummary(frontier.summary)
  const activeExecutions = activeExecutionCount(view)
  const runStageView = runStage(view)
  const reviewLeads = view.candidates.length > 0 && activeExecutions === 0
  // The returned-outcome summary belongs with review; it is noise before
  // anything has run or while work is still active.
  const showRunSummary = view.executions.length > 0 && activeExecutions === 0

  const interrupts = view.humanRequests.length > 0 && <section className="fb-interrupts" aria-label="Needs your decision">
    <div className="fb-section-head"><h2>Needs your decision</h2><span>{view.humanRequests.length} waiting</span></div>
    {view.humanRequests.map(request => <article className="fb-interrupt" key={request.humanRequestRef}>
      <strong>{request.question}</strong>
      <p>{request.whyHuman}</p>
      <div className="fb-actions">{view.actions.filter(action=>action.subjectKinds.includes('human-request')).map(action=><ActionButton key={action.actionRef} {...action} subjectRef={request.humanRequestRef} onAction={onAction}/>)}</div>
      <p className="fb-ref-line">{request.decisionRef&&<code>decision {request.decisionRef}</code>}{request.humanRequestRef&&<code>request {request.humanRequestRef}</code>}{!!request.blockedExecutionRefs?.length&&<span title={request.blockedExecutionRefs.join(", ")}>blocking {request.blockedExecutionRefs.length} execution{request.blockedExecutionRefs.length===1?"":"s"}</span>}{!!request.evidenceRefs?.length&&request.evidenceRefs.map(ref=><code key={ref}>{ref}</code>)}</p>
    </article>)}
  </section>

  const liveWork = <section className="fb-reading-section" aria-label="Live work">
    <div className="fb-section-head"><h2>Live work</h2><span>{view.executions.length} {view.executions.length === 1 ? "execution" : "executions"}</span></div>
    {view.executions.length ? <div className="fb-live-grid">
      {view.executions.map((execution,index)=>{
        const trajectory=view.trajectories.find(trace=>trace.executionRef===execution.executionRef)
        const agency=view.agencies.find(row=>row.agencyRef===execution.agencyRef)
        const surfaces=execution.surfaceRefs??[]
        const canOpen=Boolean(onOpenWorkingSurface&&execution.agentSessionRef&&execution.sessionSpaceRef)
        const drilled=drilledExecutionRef===execution.executionRef
        const drilledSpan=drilled?trajectory?.spans.find(span=>span.spanRef===spanRef):undefined
        return <article key={execution.executionRef} className="fb-live-card">
          <div className="fb-card-top"><h3>{trajectory?.request||agency?.label||`Execution ${index+1}`}</h3><span className={`fb-status fb-status-${execution.status}`}>{execution.status}</span></div>
          {agency?.label&&trajectory?.request&&<p>{agency.label}</p>}
          {canOpen?<div className="fb-working-controls">
            {surfaces.length>1&&<label>Working surface<select aria-label={`Working surface for execution ${index+1}`} value={surfaces.includes(surfaceChoices[execution.executionRef])?surfaceChoices[execution.executionRef]:""} onChange={event=>setSurfaceChoices(current=>({...current,[execution.executionRef]:event.target.value}))}><option value="">Choose a persisted surface</option>{surfaces.map(ref=><option key={ref} value={ref}>{ref}</option>)}</select></label>}
            <button type="button" disabled={Boolean(openingExecutionRef)||(surfaces.length>1&&!surfaces.includes(surfaceChoices[execution.executionRef]))} onClick={()=>void openWorkingSurface(execution)}>{openingExecutionRef===execution.executionRef?"Opening working Surface…":"Open working Surface"}</button>
            {workingSurfaceError?.executionRef===execution.executionRef&&<p role="alert">{workingSurfaceError.detail}</p>}
          </div>:<p className="fb-muted">A working session has not been disclosed for this execution.</p>}
          {trajectory&&<details className="fb-trace-drill">
            <summary>Trace this work</summary>
            {trajectory.request&&<p className="fb-trace-request-line">{trajectory.request}</p>}
            <TraceWaterfall trace={trajectory} selectedSpanRef={drilled?spanRef:undefined} onSelectSpan={ref=>{setDrilledExecutionRef(execution.executionRef);setSpanRef(ref)}}/>
            {drilledSpan&&<SpanDetail span={drilledSpan} onClose={()=>setSpanRef(undefined)}/>}
          </details>}
          <details className="fb-provenance"><summary>Execution details</summary><dl>
            {Object.entries({Execution:execution.executionRef,Agent:execution.agentRef,Agency:execution.agencyRef,Harness:execution.harnessRef,"Harness composition":execution.harnessCompositionRef,"Agent session":execution.agentSessionRef,"Session space":execution.sessionSpaceRef,"Working surfaces":surfaces.join(", "),"Material bindings":execution.workcellBindingRefs?.join(", ")}).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl></details>
        </article>
      })}
    </div>:<p className="fb-empty">No execution has been recorded for this Run.</p>}
    {!!view.agencies.length&&<section className="fb-agencies"><div className="fb-section-head"><h3>Participating agencies</h3></div><div className="fb-live-grid">{view.agencies.map(agency=><article key={agency.agencyRef} className="fb-live-card"><h3>{agency.label}</h3><p>{agency.position??'local'} agency{agency.returnState?` · Return ${agency.returnState}`:""}</p><details className="fb-provenance"><summary>Agency details</summary><dl>{Object.entries({Agency:agency.agencyRef,Agent:agency.agentRef,"Root scope":agency.rootScopeRef,Actuation:agency.actuationRef,Return:agency.returnRef,Grants:agency.metagencyGrantRefs?.join(", ")}).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></article>)}</div></section>}
  </section>

  const review = <>
    {showRunSummary&&runSummary}
    <CandidateReading view={view} onOpenMaterial={onOpenMaterial} impliedEmpty={view.executions.length===0&&!view.claims.length&&!view.evidence.length} actions={candidate=><div className="fb-actions">{candidateActions.map(action=><ActionButton key={action.actionRef+"-"+candidate.candidateRef} {...action} subjectRef={candidate.candidateRef} onAction={onAction}/>)}</div>}/>
  </>

  return <main className="fb-build-surface factory-build">
    <header className="fb-header">
      <div className="fb-title-row">
        <div className="fb-heading">
          <h1>{view.run.label}</h1>
          <p className="fb-run-sentence"><span className={`fb-stage-dot fb-stage-${runStageView.kind}`} aria-hidden="true"/><span>{runStageView.text}</span></p>
        </div>
        {headerControls&&<div className="fb-header-controls">{headerControls}</div>}
      </div>
      <p className="fb-frontier-line"><span className="fb-kicker">{spokenStatus(frontier.mode)}</span><strong>{frontier.title}</strong>{frontierText&&<span>{frontierText}</span>}{frontier.gateState&&<span className="fb-chip">Gate: {frontier.gateState}</span>}{frontier.closureState&&<span className="fb-chip">{frontier.closureState}</span>}</p>
    </header>
    <div className="fb-reading">
      {interrupts}
      {reviewLeads?<>{review}{liveWork}</>:<>{liveWork}{review}</>}
      {runMap&&<details className="fb-workmap">
        <summary>Work map</summary>
        {runMap}
      </details>}
      <div className="fb-actions fb-run-actions">{runActions.map((action) => <ActionButton key={action.actionRef+"-"+view.run.runRef} actionRef={action.actionRef} subjectRef={view.run.runRef} label={action.label} availability={action.availability} unavailableReason={action.unavailableReason} onAction={onAction} />)}</div>
      <details className="fb-provenance fb-run-provenance"><summary>Run details</summary><dl><dt>Project</dt><dd>{view.project.projectRef}</dd><dt>Run</dt><dd>{view.run.runRef}</dd><dt>Run map</dt><dd>{view.run.runMapRef}</dd><dt>Current subject</dt><dd>{frontier.subjectRef}</dd></dl></details>
    </div>
  </main>
}
