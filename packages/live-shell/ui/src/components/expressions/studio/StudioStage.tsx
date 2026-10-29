// The stage's own controls that no other home holds yet (manual §7: "The studio sits in the device area: the field's tools … and capture";
// the mockup's Studio TOOLS at world-shell-mockup.html:1434). Ported, not recreated: these are the controls the Expressions pane carried
// as a toolbar inside the pane (components/NativeStageTools.tsx before 14 Oct). The owner law moved the controls out of the pane (PATH §1:
// controls live in device UI, never as chrome inside a pane). Every control sends the same typed command (native/stageCommands.ts)
// through the frame's one runner, and keeps the same disabled reason (stageDisabledReason) in its hover words.
//   • CAMERA, on the Stage plate: 2D | 3D and Face plane. The manual gives the field's camera no home yet (PROPOSEd by O-I #747).
// MOVED (O-I #747, manual §20.1 "Where everything is", and the lead's rulings of 29 Oct), each through the same command:
//   • Present → View › Present; Grid, Snap and Guides → View › Grid, Snap, Guides (menus.rs; menuStageCommands below);
//   • ◉ Capture and its options → File › Export › Picture…, whose choices are §20.1 Export's (PictureChoices below); the video take,
//     Record, Stop and Save video → File › Export › Film; Expression JSON, Native configuration and Living HTML → File › Export;
//   • Keep, Restore and Fit → the scene's View in Clip view's Clip panel (components/expressions/clip/clipBinding.ts);
//   • Import → the browser's Expressions, under New (components/NativeExpressionCollections.tsx);
//   • the last export, as the native host received it → said on the status bar, and under Picture…'s choices (studioExports.ts).
// Orbit stays a pointer drag on the stage: the pane's hover words say so (projections/expressionsPane.tsx), not a control here.
import {useState, type ReactNode} from 'react'
import {STAGE_CAPTURE_ASPECTS, STAGE_CAPTURE_WIDTHS, type HostedAppState, type StageCaptureAspect, type StageCaptureSettings, type StageCommand,
  type StageResult, type StageViewAction} from '@epilogos/expressions-boundary'
import {STAGE_CAPTURE_DEFAULTS, STAGE_SAVE_VIDEO, STAGE_VIEW_LABELS, stageCapturePng, stageDisabledReason,
  stageExport, stagePresent, stageReadings, stageRecord, stageView} from '../../../native/stageCommands'
import {Icon} from '../../../inhabitants/sdk/Icon'
import type {IconName} from '../../../inhabitants/sdk/icons'
import {exportWords, type ExportNotice} from './studioExports'
import './studio.css'

/** O-I #747: the homes the manual gives the Stage plate's Present and Export (§20.1 "Where everything is": "Show the field alone — Present,
 * in the View menu"; "Export a picture or a film of the field — Export, in the File menu"; Export's table). Each menu item (menus.rs) is
 * the field's own act, the same typed command the plate sends, with the manual's defaults: a picture 1440 px wide, the stage frame, page
 * text on, background not transparent; a film from its start until you stop it, then written; the Expression as JSON, living HTML or the
 * current scene as a native configuration. Present again (or Esc in the field) brings the window back. Grid, Snap and Guides (View) each
 * toggle the field's own. Picture… runs this default only when its choices are not asked (PictureChoices asks them first). null: not an
 * item of the field's.
 * Pure. */
export function menuStageCommands(id: string, state: HostedAppState | null): StageCommand[] | null {
  const readings = stageReadings(state)
  switch (id) {
    case 'view.present': return [stagePresent(readings.presenting !== true)]
    case 'view.grid': return [stageView('grid')]
    case 'view.snap': return [stageView('snap')]
    case 'view.guides': return [stageView('guides')]
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

/** CAMERA: the stage's camera — flat or in depth, and facing its plane — the one stage control the manual gives no home yet. */
export function StageViewTools({sender}: {sender: StageSender}) {
  const {readings} = sender
  return <div className="studio-stage" role="group" aria-label="Stage camera">
    <span className="studio-stage-label">Camera</span>
    <div className="studio-seg" role="group" aria-label="Camera" data-i="Camera|The stage's camera: flat or in depth, and facing its plane.">
      {view(sender, 'view-2d', readings.view2d)}{view(sender, 'view-3d', readings.view3d)}{view(sender, 'face-plane')}
    </div>
    {sender.reason && <p className="inst-section-line studio-stage-reason">{sender.reason}</p>}
  </div>
}

/** File › Export › Picture… (manual §20.1 Export: "Picture — The frame on the stage now, as a PNG named after the scene. Width: 1280, 1440,
 * 1920 or 3840 pixels, 1440 by default. Frame: Stage frame, 16:9, 1:1 or 9:16, Stage frame by default; another shape is cut from the
 * centre. Include page text, on by default. Transparent background, off by default."): the choices, each at the manual's default, then
 * Export as one capture command; under them the last export as the native host received it. The choices live here only: they are sent
 * with the capture, never stored. */
export function PictureChoices({sender, onDone, exported = null}: {sender: StageSender; onDone: () => void; exported?: ExportNotice | null}) {
  const [options, setOptions] = useState<CaptureOptions>(STAGE_CAPTURE_DEFAULTS)
  return <PictureChoicesBody sender={sender} options={options} onOptions={setOptions} onDone={onDone} exported={exported} />
}

/** Picture…'s body over its choices (held by PictureChoices): drawn from them, every press one call back or one command. */
export function PictureChoicesBody({sender, options, onOptions: setOptions, onDone, exported = null}: {sender: StageSender; options: CaptureOptions
  onOptions: (options: CaptureOptions) => void; onDone: () => void; exported?: ExportNotice | null}) {
  const sized = `${options.width} px, ${STAGE_ASPECT_LABELS[options.aspect].toLowerCase()}`
  return <div className="studio-edition picture-choices" role="group" aria-label="Export picture">
    <div className="studio-edition-col" role="group" aria-label="Picture">
      <span className="studio-stage-label">Picture</span>
      <label className="studio-edition-field">Width <select value={options.width} onChange={event => {const width = STAGE_CAPTURE_WIDTHS.find(value => String(value) === event.target.value); if (width !== undefined) setOptions({...options, width})}}>
        {STAGE_CAPTURE_WIDTHS.map(width => <option key={width} value={width}>{`${width} px`}</option>)}</select></label>
      <label className="studio-edition-field">Frame <select value={options.aspect} onChange={event => {const aspect = STAGE_CAPTURE_ASPECTS.find(value => value === event.target.value); if (aspect !== undefined) setOptions({...options, aspect})}}>
        {STAGE_CAPTURE_ASPECTS.map(aspect => <option key={aspect} value={aspect}>{STAGE_ASPECT_LABELS[aspect]}</option>)}</select></label>
      <label className="studio-edition-check"><input type="checkbox" checked={options.includeText} onChange={event => setOptions({...options, includeText: event.target.checked})} /> Include page text</label>
      <label className="studio-edition-check"><input type="checkbox" checked={options.transparent} onChange={event => setOptions({...options, transparent: event.target.checked})} /> Transparent background</label>
    </div>
    <div className="studio-stage-row">
      <StageButton sender={sender} id="capture-png" label="Export picture" words={`Export the frame on the stage now as a PNG, ${sized}.`} command={stageCapturePng(options)} primary mark="cap">Export</StageButton>
      <button type="button" className="studio-stage-button" onClick={onDone}>Close</button>
    </div>
    {sender.reason && <p className="inst-section-line studio-stage-reason">{sender.reason}</p>}
    {sender.refusal && <p className="studio-fault" role="alert">{sender.refusal}</p>}
    {exported && <p className="studio-export-line" role="status" data-export={exported.state}
      title={exported.folder && exported.file ? `${exported.folder}/${exported.file}` : exported.reason ?? undefined}>{exportWords(exported)}</p>}
  </div>
}
