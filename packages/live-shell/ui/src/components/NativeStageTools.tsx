import {useState} from 'react'
import {STAGE_CAPTURE_ASPECTS, STAGE_CAPTURE_WIDTHS, type HostedAppState, type StageCaptureAspect, type StageCaptureSettings, type StageCommand, type StageExportFormat, type StageResult} from '@epilogos/expressions-boundary'
import {STAGE_CAPTURE_DEFAULTS, STAGE_EXPORT_LABELS, STAGE_IMPORT, STAGE_SAVE_VIDEO, STAGE_VIEW_LABELS, stageCapturePng, stageDisabledReason, stageExport, stagePresent, stageReadings, stageRecord, stageView} from '../native/stageCommands'
import './NativeStageTools.css'

type Run = (command: StageCommand) => Promise<StageResult>
type CaptureOptions = Required<StageCaptureSettings>
const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const ASPECT_LABELS: Record<StageCaptureAspect, string> = {stage: 'Stage frame', '16:9': '16:9', '1:1': '1:1', '9:16': '9:16'}

/** Stage controls for the presented Expressions application (the tool rail lives in the top bar: NativeBarControls.tsx). Each button sends one
 * typed command through the host and shows the application's refusal here. Camera
 * orbit stays a pointer drag on the stage itself: the note says so instead of a button. */
export function NativeStageTools({state, run}: {state: HostedAppState | null; run: Run | null}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  // The capture choice lives in this toolbar's state only: it is sent with each capture, never stored.
  const [options, setOptions] = useState<CaptureOptions>(STAGE_CAPTURE_DEFAULTS)
  const reason = stageDisabledReason({mounted: !!run, state, busy: busy !== null})
  const readings = stageReadings(state)
  const send = (key: string, command: StageCommand) => {
    if (!run || busy !== null) return
    setBusy(key)
    setRefusal(null)
    let answer: Promise<StageResult>
    try {answer = run(command)} catch (cause) {setBusy(null); setRefusal(reasonOf(cause)); return}
    void answer.then(result => {if (!result.ok) setRefusal(result.error)}, cause => setRefusal(reasonOf(cause)))
      .finally(() => setBusy(null))
  }
  // blocked is a control-specific reason; the shared reason (mount, busy, state) wins when both apply.
  const button = (key: string, label: string, command: StageCommand, pressed?: boolean, blocked?: string) => {
    const why = reason ?? blocked ?? null
    return <button key={key} type="button" disabled={why !== null} title={why ?? undefined} aria-pressed={pressed} onClick={() => send(key, command)}>{label}</button>
  }
  const formats = Object.keys(STAGE_EXPORT_LABELS) as StageExportFormat[]
  const recordBlocked = readings.recording === true ? 'Stop the recording first.' : readings.videoTake === true ? undefined : 'Record a take first.'
  return <div className="native-stage-tools" role="toolbar" aria-label="Stage controls">
    <div role="group" aria-label="Camera" className="native-stage-group">
      {button('view-2d', STAGE_VIEW_LABELS['view-2d'], stageView('view-2d'), readings.view2d)}
      {button('view-3d', STAGE_VIEW_LABELS['view-3d'], stageView('view-3d'), readings.view3d)}
      {button('face-plane', STAGE_VIEW_LABELS['face-plane'], stageView('face-plane'))}
    </div>
    <div role="group" aria-label="Guides and snap" className="native-stage-group">
      {button('grid', STAGE_VIEW_LABELS.grid, stageView('grid'), readings.grid)}
      {button('snap', STAGE_VIEW_LABELS.snap, stageView('snap'), readings.snap)}
      {button('guides', STAGE_VIEW_LABELS.guides, stageView('guides'), readings.guides)}
    </div>
    <div role="group" aria-label="View" className="native-stage-group">
      {button('fit-view', STAGE_VIEW_LABELS['fit-view'], stageView('fit-view'))}
      {button('keep-view', STAGE_VIEW_LABELS['keep-view'], stageView('keep-view'))}
      {button('restore-view', STAGE_VIEW_LABELS['restore-view'], stageView('restore-view'))}
    </div>
    <div role="group" aria-label="Capture and present" className="native-stage-group">
      {button('capture-png', 'Capture PNG', stageCapturePng(options))}
      {button('record', readings.recording ? 'Stop recording' : 'Record video', stageRecord(readings.recording ? 'stop' : 'start', options), readings.recording)}
      {button('save-video', 'Save video', STAGE_SAVE_VIDEO, undefined, recordBlocked)}
      {button('present', 'Present', stagePresent(!readings.presenting), readings.presenting)}
    </div>
    <details className="native-stage-menu native-stage-options">
      <summary>Capture options ▾</summary>
      <div className="native-stage-menu-items">
        <label>Width <select value={options.width} onChange={event => {const width = STAGE_CAPTURE_WIDTHS.find(value => String(value) === event.target.value); if (width !== undefined) setOptions({...options, width})}}>
          {STAGE_CAPTURE_WIDTHS.map(width => <option key={width} value={width}>{`${width} px`}</option>)}</select></label>
        <label>Frame <select value={options.aspect} onChange={event => {const aspect = STAGE_CAPTURE_ASPECTS.find(value => value === event.target.value); if (aspect !== undefined) setOptions({...options, aspect})}}>
          {STAGE_CAPTURE_ASPECTS.map(aspect => <option key={aspect} value={aspect}>{ASPECT_LABELS[aspect]}</option>)}</select></label>
        <label><input type="checkbox" checked={options.includeText} onChange={event => setOptions({...options, includeText: event.target.checked})} /> Include text</label>
        <label><input type="checkbox" checked={options.transparent} onChange={event => setOptions({...options, transparent: event.target.checked})} /> Transparent background</label>
      </div>
    </details>
    <details className="native-stage-menu native-stage-orbit">
      <summary>Orbit</summary>
      <p className="native-stage-menu-items native-stage-note">Orbit is a pointer drag on the stage itself, not a button.</p>
    </details>
    <details className="native-stage-menu">
      <summary>Export ▾</summary>
      <div className="native-stage-menu-items">
        {formats.map(format => button(`export-${format}`, STAGE_EXPORT_LABELS[format], stageExport(format)))}
      </div>
    </details>
    {button('import', 'Import', STAGE_IMPORT)}
    {reason && <p className="native-stage-note">{reason}</p>}
    {refusal && <p role="alert" className="native-stage-refusal">{refusal}</p>}
  </div>
}
