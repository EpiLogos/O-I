// The one door an instrument opens through (FOUNDATION F2): the pane tree that is mounted publishes how it opens a pane
// kind — in a given pane, on one of its edges, or in the focused pane — and the browser's Instruments rows call it. A stage
// lens (Canvas, Timeline, Journey, Palace) goes through the same door: its payload names the stage and the lens, the door
// opens the stage where it was asked for and then turns it, so a double-click and a drop into a pane do the same thing.
import {useSyncExternalStore} from 'react'
import {dropOnEdge, focusedGroup, groupOf, groupsOf, makeProjectionBinding} from '../../../../../desktop/cradle/src/surface/engine'
import {followsSelection} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {isProjectionPaneKind, type LayoutState, type PaneEdge} from '../../../../../desktop/cradle/src/surface/types'
import {parseInstrumentPayload} from './instruments'
import {openInstrumentAt} from './openInstrument'
import {showMainView} from '../shell/mainView'
import {TRACKS_PANE_KIND} from '../shell/tracksOutOfPanes'
import {timelinePanePresentation} from '../projections/timelinePaneHost'

/** Where an instrument opens: in a named pane or on its edge; or 'in-view' — wherever it comes into view without hiding what the
 * focused pane holds (bringInstrumentIntoView, below); or 'beside-field' — a field device's Full, never over the field it edits
 * (fullBesideField, below). Absent: the focused pane. */
export type InstrumentPlacement = {groupId: string; edge: PaneEdge | null} | 'in-view' | 'beside-field'

/** The set's tracks are never a pane (manual §10.2): asked for, the main area shows Session view or Arrangement view instead, in
 * the presentation the tracks stand in (a Technē lens sets it before it asks). True when the request was answered so. */
function setViewInstead(kind: string): boolean {
  if (kind !== TRACKS_PANE_KIND) return false
  showMainView(timelinePanePresentation())
  return true
}

export type InstrumentOpener = (kind: string, at?: InstrumentPlacement, subject?: {ref: string; title: string}) => void

let opener: InstrumentOpener | null = null

export function publishInstrumentOpener(next: InstrumentOpener | null): void {
  opener = next
}

/** Where the pane tree places an instrument: the one answer the Workbench's opener gives, pure over the cradle engine. A field
 * device's Full asked for with no place opens beside the field, whichever door asked (round 896, item 0.1: the Studio's own ⤢, its
 * Open-in-studio, a rail notification, the device's ⤢), so no door can open it over the field it edits. */
export function placeInstrument(layout: LayoutState, kind: string, asked?: InstrumentPlacement, subject?: {ref: string; title: string}): LayoutState {
  const at = asked ?? (subject ? fullPlacement(subject.ref) : undefined)
  return at === 'in-view' ? instrumentInView(layout, kind, subject) : at === 'beside-field' ? fullBesideField(layout, kind, subject) : openInstrumentAt(layout, kind, at, subject)
}

/** The Expressions field's own surface in the pane tree: the stage pane that holds the one hosted frame (projections/expressionsPane.tsx,
 * the `projection.expressions` kind each mode's seed lays, shell/modeFrames.ts). */
export const FIELD_SURFACE_KIND = 'projection.expressions'

/** A field device's Full (O-I #747 round 896, item 0.1): it is never opened as a tab over the field it edits, since a concealed field
 * takes no editor write (expressions-boundary host.ts captureTarget). When the target pane's front tab is the field, the Full opens
 * beside it, on its right edge, so the field stays presented and the Full's writes land; a Full already standing in another pane shows
 * there; otherwise it opens as any instrument does. Pure over the cradle engine. */
export function fullBesideField(layout: LayoutState, kind: string, subject?: {ref: string; title: string}): LayoutState {
  if (!isProjectionPaneKind(kind)) return layout
  const focused = focusedGroup(layout)
  const front = focused?.active ? layout.surfaces[focused.active] : undefined
  if (!focused || front?.kind !== FIELD_SURFACE_KIND) return openInstrumentAt(layout, kind, undefined, subject)
  const placed = groupOf(layout, makeProjectionBinding(layout, kind, subject ? {subject_ref: subject.ref, subject_title: subject.title} : {}).id)
  if (placed && placed.id !== focused.id) return openInstrumentAt(layout, kind, undefined, subject)
  return openInstrumentAt(layout, kind, {groupId: focused.id, edge: 'right'}, subject)
}

/** The ids of the devices that edit the field (components/devices/expressionsDevice.ts `expressionsDeviceId`, and the Studio's,
 * expressions/studio/studioBinding.ts `STUDIO_DEVICE_ID`): their writes reach the owner only through the presented field. */
export const FIELD_DEVICE_PREFIX = 'expressions:'
/** Where a device's Full opens: beside the field, for a device that edits it; else where any instrument opens. */
export function fullPlacement(deviceId: string): InstrumentPlacement | undefined {
  return deviceId.startsWith(FIELD_DEVICE_PREFIX) ? 'beside-field' : undefined
}

/** "Show the field beside" (round 896, item 0.1): the field a tab stands over is placed in its own pane on that pane's left edge, so the
 * field and what stood over it are both shown. It places the field and changes nothing else: no write is made by it. A field shown in
 * front already is left as it is. Pure over the cradle engine. */
export function showFieldBeside(layout: LayoutState): LayoutState {
  for (const group of groupsOf(layout.root)) {
    const field = group.tabs.find(id => layout.surfaces[id]?.kind === FIELD_SURFACE_KIND)
    if (!field) continue
    if (group.active === field) return layout.maximizedGroupId && layout.maximizedGroupId !== group.id ? {...layout, maximizedGroupId: undefined} : layout
    return dropOnEdge(layout, field, group.id, 'left')
  }
  return layout
}

/** The pane tree's own placement of the field, published by the mounted tree (native/Workbench.tsx); null while none is mounted. */
let fieldPlacer: (() => void) | null = null
export function publishFieldPlacer(next: (() => void) | null): void {
  fieldPlacer = next
}
/** Place the field beside what stands over it; the words to say, or the reason it could not be placed. */
export function placeFieldBeside(): string {
  if (!fieldPlacer) return 'No pane tree is mounted to show the field in.'
  fieldPlacer()
  showMainView('pane')
  return 'The field is shown beside. Nothing was changed: make the change again.'
}

/** Open an instrument: in the named pane (or on its edge), else in the focused pane. `payload` is a pane kind, or a stage
 * lens's payload (`kind#lens`, instruments.ts), in which case the stage is turned to the lens once it is open. Refuses when no
 * pane tree is mounted; a lens the owner refuses is said through the fault line (reportInstrumentFault). */
export function openInstrument(payload: string, at?: InstrumentPlacement, subject?: {ref: string; title: string}): void {
  const {kind, lens} = parseInstrumentPayload(payload)
  if (setViewInstead(kind)) return
  if (!opener) throw Error('No pane tree is mounted to open the instrument in')
  opener(kind, at, subject)
  showMainView('pane')
  if (lens) driveStageLens(lens, reportInstrumentFault)
}

/** Bring an instrument into view (lane F, F2): an act that needs the instrument seen — World › Palaces entering a palace on the
 * Earth — must never leave it behind another tab. The pane tree decides where (instrumentInView, below): already
 * in front, it stays; in another pane, that pane shows it; otherwise the focused pane takes it when it follows the selection, and
 * when the focused pane holds what it opened (the hosted frame's Canvas, a document) or is pinned, it opens beside it. Refuses
 * when no pane tree is mounted. */
export function bringInstrumentIntoView(payload: string, subject?: {ref: string; title: string}): void {
  const {kind, lens} = parseInstrumentPayload(payload)
  if (setViewInstead(kind)) return
  if (!opener) throw Error('No pane tree is mounted to open the instrument in')
  opener(kind, 'in-view', subject)
  showMainView('pane')
  if (lens) driveStageLens(lens, reportInstrumentFault)
}

/** Where an instrument comes into view (lane F, F2: the pane tree's answer to bringInstrumentIntoView). In front in its pane
 * already: it stays, and that pane takes the focus. Placed in another pane behind its tab: that pane shows it. Otherwise the
 * focused pane takes it when that pane follows the selection (manual §10.2: "A pane follows what you select, unless you pin it")
 * or stands empty; when the focused pane holds what it opened (the hosted frame's Canvas, a document) or is pinned to a subject,
 * the instrument opens beside it, and what the pane holds stays in view. Pure over the cradle engine. */
export function instrumentInView(layout: LayoutState, kind: string, subject?: {ref: string; title: string}, follows: (kind: string) => boolean = followsSelection): LayoutState {
  if (!isProjectionPaneKind(kind)) return layout
  const binding = makeProjectionBinding(layout, kind, subject ? {subject_ref: subject.ref, subject_title: subject.title} : {})
  const placed = groupOf(layout, binding.id)
  const focused = focusedGroup(layout)
  if (placed && (placed.active === binding.id || placed.id !== focused?.id)) return openInstrumentAt(layout, kind, undefined, subject)
  const front = focused?.active ? layout.surfaces[focused.active] : undefined
  const holds = !!front && front.id !== binding.id && front.kind !== 'blank' && !focused?.emptySlot
    && (!front.projection || !follows(front.projection.kind) || !!front.projection.subject_ref)
  return focused && holds ? openInstrumentAt(layout, kind, {groupId: focused.id, edge: 'right'}, subject) : openInstrumentAt(layout, kind, undefined, subject)
}

// ── the fault line ────────────────────────────────────────────────────────
// A refusal arrives from wherever the instrument was opened — the row's own open, or a drop into a pane that the browser
// never sees. It is said in one place, the Instruments section, in the owner's words.
let fault: string | null = null
const faultListeners = new Set<() => void>()

/** Say a refusal (or, with null, clear it). */
export function reportInstrumentFault(reason: string | null): void {
  if (fault === reason) return
  fault = reason
  for (const listener of [...faultListeners]) listener()
}

export function instrumentFault(): string | null {
  return fault
}

export function useInstrumentFault(): string | null {
  return useSyncExternalStore(listener => { faultListeners.add(listener); return () => { faultListeners.delete(listener) } }, instrumentFault, instrumentFault)
}

/** Turning the stage to one of its lenses needs the open work's native scope, which only the frame holds: the frame
 * publishes the driver, and the browser's stage-lens rows call it. It answers with a refusal in the owner's words, or null. */
export type StageLensDriver = (lens: string, refused: (reason: string) => void) => void

let lensDriver: StageLensDriver | null = null

export function publishStageLensDriver(next: StageLensDriver | null): void {
  lensDriver = next
}

export function driveStageLens(lens: string, refused: (reason: string) => void): void {
  if (!lensDriver) { refused('The Expressions stage is not mounted in this shell.'); return }
  lensDriver(lens, refused)
}
