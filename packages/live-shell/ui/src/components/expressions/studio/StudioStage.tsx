// The stage's own controls as two of the Studio's sections (manual §7: "The studio sits in the device area: the field's tools …
// and capture"; lock §2.4 Device = Studio; the mockup's Studio TOOLS and CAPTURE at world-shell-mockup.html:1434 and :1440 —
// `x.tool`, `x.cap` still|video, ◉ Capture, Edition…). Ported, not recreated: these are the controls the Expressions pane carried as
// a toolbar inside the pane (components/NativeStageTools.tsx before 14 Oct: its Camera, Guides and snap, View, and Capture and
// present groups, its Capture options, Export and Import menus). The owner law moved the controls out of the pane (PATH §1: controls
// live in device UI, never as chrome inside a pane). Every control sends the same typed command (native/stageCommands.ts) through
// the frame's one runner, and keeps the same disabled reason (stageDisabledReason, and Save video's own) in its hover words.
//   • TOOLS: the camera (2D | 3D, Face plane), the guides (Grid, Snap, Guides) and Fit.
//   • CAPTURE: still | video (the mockup's x.cap), ◉ Capture (a PNG, or a video take started and stopped), Save video, and Edition… —
//     the capture options (width, frame, text, background) and Import; under them the last export as the native host received it — the
//     file and the folder it landed in, or why not (ticket P, G1: studioExports.ts).
// MOVED (O-I #747, manual §20.1 "Where everything is"): Present → View › Present; Export (Expression JSON, Native configuration, Living
// HTML) → File › Export, with a picture and a film at the manual's defaults (menuStageCommands below; menus.rs); Keep and Restore → the
// scene's View in Clip view's Clip panel (components/expressions/clip/clipBinding.ts). What stays here has no other home yet: the
// camera, the guides and Fit, the capture's own options, and Import.
// Orbit stays a pointer drag on the stage: the pane's hover words say so (projections/expressionsPane.tsx), not a control here.
import {useEffect, useId, useState, type ReactNode} from 'react'
import {STAGE_CAPTURE_ASPECTS, STAGE_CAPTURE_WIDTHS, type HostedAppState, type StageCaptureAspect, type StageCaptureSettings, type StageCommand,
  type StageResult, type StageViewAction} from '@epilogos/expressions-boundary'
import {STAGE_CAPTURE_DEFAULTS, STAGE_IMPORT, STAGE_SAVE_VIDEO, STAGE_VIEW_LABELS, stageCapturePng, stageDisabledReason,
  stageExport, stagePresent, stageReadings, stageRecord, stageView} from '../../../native/stageCommands'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {IconName} from '../../../inhabitants/sdk/icons'
import {exportWords, useLastExport, type ExportNotice} from './studioExports'

/** O-I #747: the homes the manual gives the Stage plate's Present and Export (§20.1 "Where everything is": "Show the field alone — Present,
 * in the View menu"; "Export a picture or a film of the field — Export, in the File menu"; Export's table). Each menu item (menus.rs) is
 * the field's own act, the same typed command the plate sends, with the manual's defaults: a picture 1440 px wide, the stage frame, page
 * text on, background not transparent; a film from its start until you stop it, then written; the Expression as JSON, living HTML or the
 * current scene as a native configuration. Present again (or Esc in the field) brings the window back. null: not an item of the field's.
 * Pure. */
export function menuStageCommands(id: string, state: HostedAppState | null): StageCommand[] | null {
  const readings = stageReadings(state)
  switch (id) {
    case 'view.present': return [stagePresent(readings.presenting !== true)]
    case 'file.export.picture': return [stageCapturePng(STAGE_CAPTURE_DEFAULTS)]
    case 'file.export.film': return readings.recording === true ? [stageRecord('stop', STAGE_CAPTURE_DEFAULTS), STAGE_SAVE_VIDEO] : [stageRecord('start', STAGE_CAPTURE_DEFAULTS)]
    case 'file.export.json': return [stageExport('json')]
    case 'file.export.html': return [stageExport('html')]
    case 'file.export.native': return [stageExport('native')]
    default: return null
  }
}

/** The frame's one runner: one typed command, one answer. */
export type StageRun = (command: StageCommand) => Promise<StageResult>
export type CaptureOptions = Required<StageCaptureSettings>
const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
export const STAGE_ASPECT_LABELS: Record<StageCaptureAspect, string> = {stage: 'Stage frame', '16:9': '16:9', '1:1': '1:1', '9:16': '9:16'}

/** What each view action does, in the hosted application's own terms (expressions-app app.ts action bodies, :1655-1710). */
const VIEW_WORDS: Record<StageViewAction, string> = {
  'view-2d': 'The stage flat, facing its plane.',
  'view-3d': 'The stage in depth.',
  'face-plane': 'Turn the camera to face the plane.',
  grid: 'Show or hide the stage\'s grid.',
  snap: 'Snap what you place to the grid.',
  guides: 'Show or hide the guides.',
  'fit-view': 'Return the camera to its default framing, facing the plane.',
  'keep-view': 'Keep this camera framing as part of the Scene.',
  'restore-view': 'Return to the framing the Scene keeps.',
}

/** One sender for both sections: the shared reason (mount, busy, state), the toggles' readings, and the owner's last refusal. */
export interface StageSender {
  /** Why every stage control is off, or null when they are available (stageDisabledReason). */
  readonly reason: string | null
  readonly readings: ReturnType<typeof stageReadings>
  /** The application's refusal of the last command, in its words. */
  readonly refusal: string | null
  readonly send: (key: string, command: StageCommand) => void
}

/** The toolbar's sender, moved whole (NativeStageTools.tsx before 14 Oct, :16-30): a command at a time, its refusal kept. */
export function useStageSender(state: HostedAppState | null, run: StageRun | null): StageSender {
  const [busy, setBusy] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const send = (key: string, command: StageCommand) => {
    if (!run || busy !== null) return
    setBusy(key)
    setRefusal(null)
    let answer: Promise<StageResult>
    try {answer = run(command)} catch (cause) {setBusy(null); setRefusal(reasonOf(cause)); return}
    void answer.then(result => {if (!result.ok) setRefusal(result.error)}, cause => setRefusal(reasonOf(cause)))
      .finally(() => setBusy(null))
  }
  return {reason: stageDisabledReason({mounted: !!run, state, busy: busy !== null}), readings: stageReadings(state), refusal, send}
}

/** One stage control. Its hover words are its owner's reason while it is off (the shared reason wins over its own, as before), else
 * what it does; `pressed` is the hosted state's reading, absent when the state does not carry it. */
function StageButton({sender, id, label, words, command, pressed, blocked, primary, mark, children}: {sender: StageSender; id: string; label: string; words: string
  command: StageCommand; pressed?: boolean; blocked?: string; primary?: boolean; mark?: IconName; children?: ReactNode}) {
  const why = sender.reason ?? blocked ?? null
  const said = why ?? words
  return <button type="button" className={`studio-stage-button${primary ? ' is-primary' : ''}`} disabled={why !== null} aria-pressed={pressed}
    aria-label={children !== undefined ? label : undefined} title={said} data-i={`${label}|${said}`} data-stage={id} onClick={() => sender.send(id, command)}>
    {mark && <Icon name={mark} size={11} />}{children ?? label}
  </button>
}

const view = (sender: StageSender, action: StageViewAction, pressed?: boolean, short?: string) =>
  <StageButton key={action} sender={sender} id={action} label={STAGE_VIEW_LABELS[action]} words={VIEW_WORDS[action]} command={stageView(action)} pressed={pressed}>
    {short}
  </StageButton>

/** TOOLS: the stage's camera, guides and view (the pane toolbar's Camera, Guides and snap, and View groups). */
export function StageViewTools({sender}: {sender: StageSender}) {
  const {readings} = sender
  return <div className="studio-stage" role="group" aria-label="Stage view">
    <span className="studio-stage-label">View</span>
    <div className="studio-seg" role="group" aria-label="Camera" data-i="Camera|The stage's camera: flat or in depth, and facing its plane.">
      {view(sender, 'view-2d', readings.view2d)}{view(sender, 'view-3d', readings.view3d)}{view(sender, 'face-plane')}
    </div>
    <div className="studio-seg" role="group" aria-label="Guides and snap" data-i="Guides and snap|The stage's grid, snapping and guides.">
      {view(sender, 'grid', readings.grid)}{view(sender, 'snap', readings.snap)}{view(sender, 'guides', readings.guides)}
    </div>
    {/* Keep and Restore are the scene's: its View in Clip view's Clip panel (O-I #747). */}
    <div className="studio-seg" role="group" aria-label="View" data-i="View|Fit the camera to its default framing. The scene keeps its own view in Clip view's Clip panel.">
      {view(sender, 'fit-view', undefined, 'Fit')}
    </div>
  </div>
}

export type CaptureKind = 'still' | 'video'

/** CAPTURE: still | video, ◉ Capture, Save video, Present, and Edition… (the pane toolbar's Capture and present group, its Capture
 * options, Export and Import menus). The capture choice and the options live here only: they are sent with each capture, never stored. */
export function StageCaptureTools({sender}: {sender: StageSender}) {
  const [chosen, setChosen] = useState<CaptureKind>('still')
  const [options, setOptions] = useState<CaptureOptions>(STAGE_CAPTURE_DEFAULTS)
  const [edition, setEdition] = useState(false)
  const editionId = useId()
  // Capture is the plate's last column, often scrolled past: an opened Edition is brought into view (presentation only).
  useEffect(() => {if (edition) document.getElementById(editionId)?.scrollIntoView?.({block: 'nearest', inline: 'nearest'})}, [edition, editionId])
  // The last export as the native host received it (studioExports.ts): where the file landed, or why it did not.
  const exported = useLastExport()
  return <StageCaptureBody sender={sender} chosen={chosen} options={options} edition={edition} editionId={editionId}
    onChoose={setChosen} onOptions={setOptions} onEdition={() => setEdition(open => !open)} exported={exported} />
}

/** The Capture section's body over its choices (held by StageCaptureTools): drawn from them, every press one call back or one command. */
export function StageCaptureBody({sender, chosen, options, edition, editionId, onChoose, onOptions, onEdition, exported = null}: {sender: StageSender; chosen: CaptureKind
  options: CaptureOptions; edition: boolean; editionId: string; onChoose: (kind: CaptureKind) => void; onOptions: (options: CaptureOptions) => void; onEdition: () => void
  /** The last export the native host received (ticket P, G1): its file and folder, or its fault. */
  exported?: ExportNotice | null}) {
  const {readings, reason} = sender
  const recording = readings.recording === true
  // While a take records, the choice is video: Stop is the one capture that can run.
  const kind: CaptureKind = recording ? 'video' : chosen
  const recordBlocked = recording ? 'Stop the recording first.' : readings.videoTake === true ? undefined : 'Record a take first.'
  const choose = (next: CaptureKind) => {if (!recording) onChoose(next)}
  const setOptions = onOptions
  const sized = `${options.width} px, ${STAGE_ASPECT_LABELS[options.aspect].toLowerCase()}`
  return <div className="studio-stage studio-capture" role="group" aria-label="Capture">
    <div className="studio-capture-main">
      <span className="studio-stage-label">Capture</span>
      <div className="studio-seg" role="group" aria-label="Capture kind" data-i={`Capture|What ◉ Capture makes: a still of the stage, or a video take.${recording ? ' A take is recording: Stop it first.' : ''}`}>
        {(['still', 'video'] as const).map(value => <button key={value} type="button" className="studio-stage-button" aria-pressed={kind === value}
          disabled={recording && value === 'still'} title={recording && value === 'still' ? 'Stop the recording first.' : value === 'still' ? 'Capture a still (PNG)' : 'Record a video take'}
          onClick={() => choose(value)}>{value}</button>)}
      </div>
      <div className="studio-stage-row">
        {kind === 'still'
          ? <StageButton sender={sender} id="capture-png" label="Capture PNG" words={`Capture a still of the stage at ${sized}.`} command={stageCapturePng(options)} primary mark="cap">Capture</StageButton>
          : <StageButton sender={sender} id="record" label={recording ? 'Stop recording' : 'Record video'} words={recording ? 'Stop the take; it is held for Save video.' : `Record a video take of the stage at ${sized}.`}
              command={stageRecord(recording ? 'stop' : 'start', options)} pressed={readings.recording} primary mark={recording ? 'stop' : 'rec'}>{recording ? 'Stop' : 'Record'}</StageButton>}
        {/* Present is View › Present (O-I #747). */}
        <button type="button" className="studio-stage-button" aria-expanded={edition} aria-controls={editionId} data-i="Edition|The capture options and Import. Export is in the File menu."
          title="Edition: the capture options and Import (Export is in the File menu)" onClick={onEdition}>Edition…</button>
      </div>
      {kind === 'video' && <div className="studio-stage-row">
        <StageButton sender={sender} id="save-video" label="Save video" words="Save the take you recorded." command={STAGE_SAVE_VIDEO} blocked={recordBlocked} />
      </div>}
      {reason && <p className="inst-section-line studio-stage-reason">{reason}</p>}
      {exported && <p className="studio-export-line" role="status" data-export={exported.state}
        title={exported.folder && exported.file ? `${exported.folder}/${exported.file}` : exported.reason ?? undefined}>{exportWords(exported)}</p>}
    </div>
    {edition && <div className="studio-edition" id={editionId} role="group" aria-label="Edition">
      <div className="studio-edition-col" role="group" aria-label="Capture options">
        <span className="studio-stage-label">Options</span>
        <label className="studio-edition-field">Width <select value={options.width} onChange={event => {const width = STAGE_CAPTURE_WIDTHS.find(value => String(value) === event.target.value); if (width !== undefined) setOptions({...options, width})}}>
          {STAGE_CAPTURE_WIDTHS.map(width => <option key={width} value={width}>{`${width} px`}</option>)}</select></label>
        <label className="studio-edition-field">Frame <select value={options.aspect} onChange={event => {const aspect = STAGE_CAPTURE_ASPECTS.find(value => value === event.target.value); if (aspect !== undefined) setOptions({...options, aspect})}}>
          {STAGE_CAPTURE_ASPECTS.map(aspect => <option key={aspect} value={aspect}>{STAGE_ASPECT_LABELS[aspect]}</option>)}</select></label>
        <label className="studio-edition-check"><input type="checkbox" checked={options.includeText} onChange={event => setOptions({...options, includeText: event.target.checked})} /> Include text</label>
        <label className="studio-edition-check"><input type="checkbox" checked={options.transparent} onChange={event => setOptions({...options, transparent: event.target.checked})} /> Transparent background</label>
      </div>
      <div className="studio-edition-col" role="group" aria-label="Import">
        <span className="studio-stage-label">Import</span>
        <StageButton sender={sender} id="import" label="Import" words="Import a work into the field." command={STAGE_IMPORT} />
      </div>
    </div>}
  </div>
}
