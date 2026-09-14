import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ActionInvocation, FactoryBuildView, ViewDepth } from './types'
import { CandidateReading } from "./CandidateReading"
import { SessionCards } from './components/SessionCards'
import { SpanDetail } from './components/SpanDetail'
import { TraceWaterfall } from './components/TraceWaterfall'
import { chronologicalSpans } from './read-model'
import './styles.css'
import './build-surface.css'

export interface BuildSurfaceProps {
  view: FactoryBuildView
  initialDepth?: ViewDepth
  onAction?: (invocation: ActionInvocation) => void | Promise<void>
  onOpenWorkingSurface?: (selection: Omit<import("../../encounter/working-surface").WorkingSurfaceSelection,"project">) => Promise<void>
  /** O:I-owned controls for this selected Run, kept inside Build's existing header. */
  headerControls?: ReactNode
  runSummary?: ReactNode
  projectLabel?: string
}

function Ref({ children }: { children: string }) {
  return <code className="fb-ref" title={children}>{children}</code>
}

function ActionButton({ actionRef, subjectRef, label, availability, unavailableReason, onAction }: {
  actionRef: string; subjectRef: string; label: string; availability?: string; unavailableReason?: string; onAction?: (invocation: ActionInvocation) => void | Promise<void>
}) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string>()
  if (!onAction || availability !== "available") return <details className="fb-provenance fb-action-unavailable"><summary>{label} · unavailable</summary><p>{unavailableReason ?? "Factory has not supplied an admitted operation for this action."}</p></details>
  async function invoke() {
    setBusy(true);setError(undefined)
    try { await onAction?.({actionRef,subjectRef}) }
    catch(reason) { setError(String(reason)) }
    finally { setBusy(false) }
  }
  return <div><button type="button" className="fb-action" disabled={busy} onClick={()=>void invoke()}>{busy?"Applying…":label}</button>{error&&<p role="alert">{error}</p>}</div>
}

export function BuildSurface({ view, initialDepth = 'semantic', onAction, onOpenWorkingSurface, headerControls, runSummary, projectLabel }: BuildSurfaceProps) {
  const [depth, setDepth] = useState<ViewDepth>(initialDepth)
  const [executionRef, setExecutionRef] = useState(view.trajectories[0]?.executionRef)
  const trace = useMemo(() => view.trajectories.find((item) => item.executionRef === executionRef) ?? view.trajectories[0], [executionRef, view.trajectories])
  const [spanRef, setSpanRef] = useState<string | undefined>(trace ? chronologicalSpans(trace)[0]?.spanRef : undefined)
  const [openingExecutionRef, setOpeningExecutionRef] = useState<string>()
  const [surfaceChoices,setSurfaceChoices]=useState<Record<string,string>>({})
  const [workingSurfaceError, setWorkingSurfaceError] = useState<{ executionRef: string; detail: string }>()
  const workingSurfaceGeneration = useRef(0)
  useEffect(() => {
    workingSurfaceGeneration.current += 1
    const initialTrace=view.trajectories[0]
    setExecutionRef(initialTrace?.executionRef)
    setSpanRef(initialTrace ? chronologicalSpans(initialTrace)[0]?.spanRef : undefined)
    setOpeningExecutionRef(undefined)
    setSurfaceChoices({})
    setWorkingSurfaceError(undefined)
  }, [view.run.runRef])
  const selectedSpan = trace?.spans.find((span) => span.spanRef === spanRef)

  function selectExecution(ref: string) {
    setExecutionRef(ref)
    const next = view.trajectories.find((item) => item.executionRef === ref)
    setSpanRef(next ? chronologicalSpans(next)[0]?.spanRef : undefined)
  }

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

  return <main className="fb-build-surface factory-build">
    <header className="fb-header">

      <div className="fb-title-row">
        <div><h1>{view.run.label}</h1><p>{projectLabel??(view.project.label!==view.project.projectRef?view.project.label:undefined)}</p></div>
        <div className="fb-run-state"><span className={`fb-status fb-status-${view.run.status}`}>{view.run.status}</span></div>
        {headerControls&&<div className="fb-header-controls">{headerControls}</div>}
      </div>
      <nav className="fb-depth-tabs" aria-label="Build view depth">
        {(['semantic', 'live', 'trajectory'] as const).map((item) => <button key={item} type="button" className={depth === item ? 'is-selected' : ''} onClick={() => setDepth(item)}>{{semantic:'Run map',live:'Live work',trajectory:'Trajectory'}[item]}</button>)}
      </nav>
    </header>

    {depth === 'semantic' ? <section className="fb-depth fb-semantic">
      {runSummary}
      <div className="fb-frontier">
        <div><span className="fb-kicker">{view.frontier.mode}</span><h2>{view.frontier.title}</h2><p>{view.frontier.summary}</p></div>
        <div className="fb-frontier-meta">{view.frontier.closureState&&<span>{view.frontier.closureState}</span>}{view.frontier.gateState&&<span>Gate: {view.frontier.gateState}</span>}</div>
      </div>

      <CandidateReading key={view.run.runRef} view={view} actions={candidate=><div className="fb-actions">{candidateActions.map(action=><ActionButton key={action.actionRef+"-"+candidate.candidateRef} {...action} subjectRef={candidate.candidateRef} onAction={onAction}/>)}</div>}/>
      {!!view.humanRequests.length&&<section className="fb-human-requests"><div className="fb-section-head"><h3>Needs your decision</h3></div>
        {view.humanRequests.map(request=><article className="fb-human-request" key={request.humanRequestRef}><strong>{request.question}</strong><p>{request.whyHuman}</p>
          <div className="fb-actions">{view.actions.filter(action=>action.subjectKinds.includes('human-request')).map(action=><ActionButton key={action.actionRef} {...action} subjectRef={request.humanRequestRef} onAction={onAction}/>)}</div>
          <details className="fb-provenance"><summary>Decision details</summary><dl><dt>Decision</dt><dd>{request.decisionRef}</dd><dt>Request</dt><dd>{request.humanRequestRef}</dd>{!!request.blockedExecutionRefs?.length&&<><dt>Blocked executions</dt><dd>{request.blockedExecutionRefs.join(", ")}</dd></>}{!!request.evidenceRefs?.length&&<><dt>Evidence</dt><dd>{request.evidenceRefs.join(", ")}</dd></>}</dl></details></article>)}
      </section>}
      <div className="fb-actions fb-run-actions">{runActions.map((action) => <ActionButton key={action.actionRef+"-"+view.run.runRef} actionRef={action.actionRef} subjectRef={view.run.runRef} label={action.label} availability={action.availability} unavailableReason={action.unavailableReason} onAction={onAction} />)}</div>
    </section> : null}

    {depth === 'live' ? <section className="fb-depth">
      <div className="fb-section-head"><h2>Live work</h2><span>{view.executions.length} executions</span></div>
      <div className="fb-live-grid">
        {view.executions.map((execution,index)=>{
          const trajectory=view.trajectories.find(trace=>trace.executionRef===execution.executionRef)
          const agency=view.agencies.find(row=>row.agencyRef===execution.agencyRef)
          const surfaces=execution.surfaceRefs??[]
          const canOpen=Boolean(onOpenWorkingSurface&&execution.agentSessionRef&&execution.sessionSpaceRef)
          return <article key={execution.executionRef} className="fb-live-card">
            <div className="fb-card-top"><h3>{trajectory?.request||agency?.label||`Execution ${index+1}`}</h3><span className={`fb-status fb-status-${execution.status}`}>{execution.status}</span></div>
            {agency?.label&&trajectory?.request&&<p>{agency.label}</p>}
            {canOpen?<div className="fb-working-controls">
              {surfaces.length>1&&<label>Working surface<select aria-label={`Working surface for execution ${index+1}`} value={surfaces.includes(surfaceChoices[execution.executionRef])?surfaceChoices[execution.executionRef]:""} onChange={event=>setSurfaceChoices(current=>({...current,[execution.executionRef]:event.target.value}))}><option value="">Choose a persisted surface</option>{surfaces.map(ref=><option key={ref} value={ref}>{ref}</option>)}</select></label>}
              <button type="button" disabled={Boolean(openingExecutionRef)||(surfaces.length>1&&!surfaces.includes(surfaceChoices[execution.executionRef]))} onClick={()=>void openWorkingSurface(execution)}>{openingExecutionRef===execution.executionRef?"Opening working Surface…":"Open working Surface"}</button>
              {workingSurfaceError?.executionRef===execution.executionRef&&<p role="alert">{workingSurfaceError.detail}</p>}
            </div>:<p className="fb-muted">A working session has not been disclosed for this execution.</p>}
            <details className="fb-provenance"><summary>Execution details</summary><dl>
              {Object.entries({Execution:execution.executionRef,Agent:execution.agentRef,Agency:execution.agencyRef,Harness:execution.harnessRef,"Harness composition":execution.harnessCompositionRef,"Agent session":execution.agentSessionRef,"Session space":execution.sessionSpaceRef,"Working surfaces":surfaces.join(", "),"Material bindings":execution.workcellBindingRefs?.join(", ")}).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl></details>
          </article>
        })}
      </div>
      {!view.executions.length&&<p className="fb-empty">No execution has been recorded for this Run.</p>}
      {!!view.agencies.length&&<section className="fb-agencies"><div className="fb-section-head"><h3>Participating agencies</h3></div><div className="fb-live-grid">{view.agencies.map(agency=><article key={agency.agencyRef} className="fb-live-card"><h3>{agency.label}</h3><p>{agency.position??'local'} agency{agency.returnState?` · Return ${agency.returnState}`:""}</p><details className="fb-provenance"><summary>Agency details</summary><dl>{Object.entries({Agency:agency.agencyRef,Agent:agency.agentRef,"Root scope":agency.rootScopeRef,Actuation:agency.actuationRef,Return:agency.returnRef,Grants:agency.metagencyGrantRefs?.join(", ")}).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></article>)}</div></section>}

    </section> : null}

    {depth === 'trajectory' ? <section className="fb-depth">
      <div className="fb-section-head"><h2>Trajectory</h2></div>
      <SessionCards traces={view.trajectories} selectedExecutionRef={trace?.executionRef} onSelect={selectExecution} />
      {trace ? <>
        <details className="fb-trace-provenance"><summary>Trajectory details</summary><Ref>{trace.executionRef}</Ref><span>{trace.harnessRef ?? 'harness unavailable'}</span>{trace.harnessCompositionFingerprint ? <span>body {trace.harnessCompositionFingerprint}</span> : null}{trace.nativeTrajectory ? <span>native {trace.nativeTrajectory.kind}: <Ref>{trace.nativeTrajectory.ref}</Ref></span> : <span>native trajectory unavailable</span>}</details>
        <TraceWaterfall trace={trace} selectedSpanRef={spanRef} onSelectSpan={setSpanRef} />
        {selectedSpan ? <SpanDetail span={selectedSpan} onClose={() => setSpanRef(undefined)} /> : null}
      </> : <p className="fb-muted">No trajectory is attached to this Run.</p>}
    </section> : null}
    <details className="fb-provenance fb-run-provenance"><summary>Run details</summary><dl><dt>Project</dt><dd>{view.project.projectRef}</dd><dt>Run</dt><dd>{view.run.runRef}</dd><dt>Run map</dt><dd>{view.run.runMapRef}</dd><dt>Current subject</dt><dd>{view.frontier.subjectRef}</dd></dl></details>
  </main>
}
