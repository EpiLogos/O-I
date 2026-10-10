import {stageOneOf, stageRequestMessage, readStageRequest, STAGE_VIEW_ACTIONS, STAGE_EXPORT_FORMATS,
  type HostedAppState, type StageCaptureSettings, type StageCommand, type StageEngineAction, type StageExportFormat, type StageTool, type StageViewAction} from '@epilogos/expressions-boundary'

/** The stage toolbar's typed commands and readings. Pure: nothing here reaches
 * the frame. The builders return commands the boundary's own reader accepts. */
export const STAGE_VIEW_LABELS: Record<StageViewAction, string> = {
  'view-2d': '2D', 'view-3d': '3D', 'face-plane': 'Face plane', guides: 'Guides', grid: 'Grid', snap: 'Snap',
  'fit-view': 'Fit view', 'keep-view': 'Keep view', 'restore-view': 'Restore view',
}
export const STAGE_EXPORT_LABELS: Record<StageExportFormat, string> = {json: 'Expression JSON', native: 'Native configuration', html: 'Living HTML'}
export const STAGE_TOOL_LABELS: Record<StageTool, string> = {select: 'Select', interact: 'Interact', pin: 'Pin', text: 'Text', formation: 'Formation'}
/** The Image suite's defaults, as the frame starts them. The capture popover holds these in React state and sends all four with each capture. */
export const STAGE_CAPTURE_DEFAULTS: Required<StageCaptureSettings> = {width: 1440, aspect: 'stage', includeText: true, transparent: false}

export const stageView = (action: StageViewAction): StageCommand => ({command: 'view', action})
export const stageTool = (tool: StageTool): StageCommand => ({command: 'tool', tool})
export const stagePinRepeat = (repeat: boolean): StageCommand => ({command: 'tool', tool: 'pin', repeat})
export const stageEngine = (action: StageEngineAction, confirmed?: boolean): StageCommand =>
  confirmed === undefined ? {command: 'engine', action} : {command: 'engine', action, confirmed}
export const STAGE_SAVE_VIDEO: StageCommand = {command: 'capture', mediaKind: 'video', action: 'save'}
export const stageCapturePng = (settings?: StageCaptureSettings): StageCommand =>
  settings ? {command: 'capture', mediaKind: 'png', settings} : {command: 'capture', mediaKind: 'png'}
export const stageRecord = (action: 'start' | 'stop', settings?: StageCaptureSettings): StageCommand =>
  action === 'stop' ? {command: 'capture', mediaKind: 'video', action: 'stop'} : {command: 'capture', mediaKind: 'video', action: 'start', ...(settings ? {settings} : {})}
export const stagePresent = (on: boolean): StageCommand => ({command: 'present', on})
export const stageExport = (format: StageExportFormat): StageCommand => ({command: 'export', format})
export const STAGE_IMPORT: StageCommand = {command: 'import'}
/** Automation runtime commands (Automation device panel). Pause is a document change and is sent through the editor, not here. */
export const stageAutomationPlay: StageCommand = {command: 'automation', action: 'play'}
export const stageAutomationLoop = (on: boolean): StageCommand => ({command: 'automation', action: 'loop', on})

/** Live parameter channel (stageCommands.ts 'live'): a streamed transient value, a hold on an automated parameter, and the release that ends a gesture. */
export const stageLiveSet = (target: string, value: number): StageCommand => ({command: 'live', action: 'set', target, value})
export const stageLiveHold = (target: string, value: number): StageCommand => ({command: 'live', action: 'hold', target, value})
export const STAGE_LIVE_RELEASE: StageCommand = {command: 'live', action: 'release'}
/** Re-enable automation: hand every manually held parameter back to its automation (frame runtime state, no document write). */
export const STAGE_AUTOMATION_RESUME: StageCommand = {command: 'automation', action: 'resume'}

/** A command from an untyped source, admitted only by the boundary's reader. */
export function parseStageCommand(raw: unknown): StageCommand | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const message = stageRequestMessage(1, raw as StageCommand)
  return message ? readStageRequest(message)?.command ?? null : null
}

/** Typed checks for a view action from a control value. */
export const isStageViewAction = (value: unknown): value is StageViewAction => stageOneOf(STAGE_VIEW_ACTIONS, value)
export const isStageExportFormat = (value: unknown): value is StageExportFormat => stageOneOf(STAGE_EXPORT_FORMATS, value)

/** aria-pressed readings. Each is undefined when the hosted state does not carry it, so no toggle claims a state it cannot read. */
export function stageReadings(state: HostedAppState | null) {
  const stage = state?.stage
  return {
    view2d: stage ? stage.mode === '2d' : undefined,
    view3d: stage ? stage.mode === '3d' : undefined,
    grid: stage?.grid,
    snap: stage?.snap,
    guides: stage?.guides,
    recording: state?.recording,
    presenting: state?.presenting,
    tool: stage?.tool,
    repeatPins: stage?.repeatPins,
    videoTake: stage?.videoTake,
  }
}

/** Why every stage control is off, or null when they are available. */
export function stageDisabledReason(input: {mounted: boolean; state: HostedAppState | null; busy: boolean}): string | null {
  if (!input.mounted) return 'No Expressions application is mounted.'
  if (input.busy) return 'The application is still answering the last stage command.'
  if (!input.state) return 'The Expressions application has not reported its state yet.'
  if (!input.state.nativeScene) return 'Open a native Expression to use its stage.'
  return null
}
