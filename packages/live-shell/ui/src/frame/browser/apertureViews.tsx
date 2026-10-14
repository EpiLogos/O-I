// The aperture slot — the focused pane's own context (world-shell-mockup.html `renderSlot`, "the aperture slot — the focused
// pane's own context"; manual §10.2: "A pane follows what you select, unless you pin it. A pinned pane keeps its subject while
// you work elsewhere."). It stands in the one browser's lower panel in every mode: a head with the pane's mark, its tab's name,
// "pane i/N" and its pin; a Context section (field, world, subject, occasion); and a View section whose rows are the focused
// pane's own, by registration — a table keyed by the pane's kind (APERTURE_VIEWS), never by mode. When a device is chosen on a
// chain the panel shows it whole instead (manual §10.3: "The pool under the browser shows the selected device in full"); the
// head stays and can bring the context back.
//
// Owners write, faces read: every value here is a reading the shell already holds — the Workbench's focused pane
// (native/workbenchDoor.ts), THE selection and the selected occasion (the book's WorldContext), the World the host discloses
// (ShellConfigContext), the World cut's civil reading (the time spine the Timeline host publishes), the reached document
// (central/documents/documentDoor.ts), the Timeline pane's presentation, the atlas's view and the hosted Expression's reading.
// A row no owner answers says "—" and its hover says why. The controls write only through their owners' own doors: the pin
// through the pane's Follow/Pin action, the presentation through the Timeline pane's, the atlas view through the atlas's, the
// document's Save and Re-read through the document face.
import {useContext, useEffect, useState, type ComponentType, type ReactNode} from 'react'
import {useFocusedPane, type FocusedPane} from '../../native/workbenchDoor'
import {useOptionalContinuity} from '../../continuity/workspace'
import {ShellConfigContext, type ShellConfig} from '../../shell/useSet'
import {Workspace} from '../../shell/workspaceContext'
import {revisionShort, useReachedDocument} from '../../central/documents/documentDoor'
import {CENTRAL_DOCUMENT_PANE_KIND, parseDocumentSubject} from '../../central/documents/centralDocuments'
import {civilDateOfDayRef} from '../../central/centralVertical'
import {setTimelinePanePresentation, useTimelinePanePresentation, useTimelineReading} from '../../projections/timelinePaneHost'
import {presentAtlasView, useAtlasView} from '../../projections/atlas/AtlasProjectionPanel'
import {civilDayLabel, worldName} from '../../shell/transports/transportReadings'
import {AGENT_SHELL_KIND} from '../../agent/factoryCentre'
import {instrumentEntries} from '../instruments'
import {selectDevice, useDeviceDoor} from '../devices/deviceDoor'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {IconName} from '../../inhabitants/sdk/icons'
import {KindMark, type KindShapeName} from '../../inhabitants/sdk/marks.tsx'
import type {TimeSpine} from '../../timeline/timeSpine'
import type {WorldContext} from '../../../../../../desktop/cradle/src/workspace/store'
import './apertureViews.css'

// ————————————————————————————————————————————————————————————————————————
// The marks (icons only from the cut: inhabitants/sdk/icons.ts, generated from icon-cut.html).

type Mark = {readonly icon: IconName} | {readonly kind: KindShapeName}

/** A pane's mark by its kind, where the instrument registry (frame/instruments.ts) does not name one. A Central document
 * wears the form its subject names: the day for a Day, the document for a Flow. */
const PANE_MARKS: Readonly<Record<string, (pane: Pick<FocusedPane, 'pinned'>) => Mark>> = {
  [CENTRAL_DOCUMENT_PANE_KIND]: pane => ({kind: parseDocumentSubject(pane.pinned)?.form === 'day' ? 'day' : 'doc'}),
  [AGENT_SHELL_KIND]: () => ({kind: 'agent'}),
  encounter: () => ({kind: 'agent'}),
  file: () => ({kind: 'doc'}),
  flow: () => ({kind: 'doc'}),
  source: () => ({kind: 'source'}),
  knowledge: () => ({icon: 'orbit'}),
  terminal: () => ({icon: 'cmd'}),
  browser: () => ({icon: 'browser'}),
}

/** THE selection's mark by its kind (WorldSelection.kind). A kind with no cut mark draws none. */
const SELECTION_MARKS: Readonly<Record<string, KindShapeName>> = {
  day: 'day',
  note: 'doc',
  doc: 'doc',
  file: 'doc',
  'agent-session': 'agent',
  clip: 'occurrence',
  place: 'place',
  location: 'location',
  expression: 'expression',
  run: 'run',
}

/** The pane's own mark: an instrument wears its registry mark (frame/instruments.ts); any other kind the table's; else the pane. */
export function paneMark(pane: Pick<FocusedPane, 'kind' | 'pinned'>): Mark {
  const instrument = instrumentEntries().find(entry => entry.kind === pane.kind && !entry.lens)
  return instrument ? {icon: instrument.mark} : PANE_MARKS[pane.kind]?.(pane) ?? {icon: 'pane'}
}

function MarkOf({mark, size = 12}: {mark: Mark; size?: number}) {
  return 'icon' in mark ? <Icon name={mark.icon} size={size} /> : <KindMark kind={mark.kind} size={size} />
}

// ————————————————————————————————————————————————————————————————————————
// The pin: follows | pinned (manual §10.2).

export interface PinStanding {
  /** The words the head shows. */
  words: 'follows' | 'pinned' | 'holds'
  /** The Context section's right-hand words. */
  context: string
  /** What pressing the toggle does, or null when the pane cannot change its standing. */
  next: {ref: string | undefined} | null
  /** The toggle's Info words. */
  info: string
}

/** The pane's pin standing and what its toggle does — the pane's own Follow/Pin rule (desktop/cradle surface/Workbench.tsx
 * `pane-follow`): a following pane pins to THE selection; a pinned one follows again. Only a pane whose kind follows the
 * selection changes its standing; a pane that holds its own subject (a document) keeps it. */
export function pinStanding(pane: Pick<FocusedPane, 'pinned' | 'follows'>, selection: {ref: string; title: string} | null | undefined): PinStanding {
  if (pane.pinned) return pane.follows
    ? {words: 'pinned', context: 'pinned', next: {ref: undefined}, info: `Pinned to ${pane.pinned}. Press to follow the selection again.`}
    : {words: 'pinned', context: 'pinned', next: null, info: `This pane holds its own subject (${pane.pinned}); it does not follow the selection.`}
  if (!pane.follows) return {words: 'holds', context: 'holds what it opened', next: null, info: 'This pane holds what it opened; its kind does not follow the selection or pin to one.'}
  return selection
    ? {words: 'follows', context: 'following the encounter', next: {ref: selection.ref}, info: `Following the selection. Press to pin this pane to ${selection.title}.`}
    : {words: 'follows', context: 'following the encounter', next: null, info: 'Following the selection. Select something to pin this pane to it.'}
}

// ————————————————————————————————————————————————————————————————————————
// The Context section: field, world, subject, occasion.

export interface ContextRow {
  key: 'field' | 'world' | 'subject' | 'occasion'
  /** The value, or "—" when no reading names one. */
  value: string
  /** The world-coloured dot (a shell token), when the value is a world or a field. */
  dot?: string
  /** The subject's kind mark from the cut. */
  mark?: KindShapeName
  /** A standing the reading discloses (an occasion's admission). */
  standing?: string
  /** The row's Info words: where the value comes from, or why there is none. */
  info: string
}

/** The worlds' colours (the mockup's WORLDS hex as the shell's tokens): the person's own Central world wears the accent. */
const WORLD_DOTS: Readonly<Record<string, string>> = {central: 'var(--accent)'}
/** The field's colour (the mockup's --w-field, the shell's --sel). */
const FIELD_DOT = 'var(--sel)'

/** A civil instant as the mockup's occasion reads it ("now · 14:37", a 24-hour clock as the transport's readouts write it): the
 * spine's own instant, never the wall clock. */
export function clockOf(instantUnixMs: number): string {
  return new Date(instantUnixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
}

/** The four context rows, as pure functions of the readings (exported for the tests). */
export function contextRows({pane, context, config, spine}: {
  pane: Pick<FocusedPane, 'worldRef' | 'fieldRef'> | null
  context: WorldContext | null | undefined
  config: Pick<ShellConfig, 'world_scope'> | null | undefined
  spine: Pick<TimeSpine, 'now' | 'occasion'> | null | undefined
}): ContextRow[] {
  const rows: ContextRow[] = []
  // The field: the shared field the pane's hosted presentation stands in (binding.presentation.field_ref).
  rows.push(pane?.fieldRef
    ? {key: 'field', value: pane.fieldRef, dot: FIELD_DOT, info: `The field this pane's presentation stands in (${pane.fieldRef}).`}
    : {key: 'field', value: '—', info: 'No reading names a shared field for this pane: a pane hosted in a field carries its field ref.'})
  // The world: a hosted presentation's own world (a projection), else the World the book stands in or the host discloses.
  const home = config?.world_scope?.world
  if (pane?.worldRef && pane.worldRef !== home) {
    rows.push({key: 'world', value: `${pane.worldRef} · projection`, dot: 'var(--text-faint)', info: `This pane presents another World (${pane.worldRef}), projected here.`})
  } else {
    const key = context?.world ?? config?.world_scope?.owner
    const name = worldName(context?.world, config)
    rows.push(name
      ? {key: 'world', value: name, dot: WORLD_DOTS[key ?? ''] ?? 'var(--text-faint)', info: `The World the encounter stands in: ${name}${home ? ` (${home})` : ''}.`}
      : {key: 'world', value: '—', info: 'Neither the book nor the host names the World yet (it is read when the native World answers).'})
  }
  // The subject: THE selection (the book's WorldContext.selection).
  const selection = context?.selection
  rows.push(selection
    ? {key: 'subject', value: selection.title, mark: SELECTION_MARKS[selection.kind], info: `THE selection: ${selection.title} — ${selection.kind} · ${selection.ref}.`}
    : {key: 'subject', value: '—', info: 'Nothing is selected. Select a row, a clip or a track; a following pane turns to it.'})
  // The occasion: the selected occasion (the World cut's retained basis, else the book's reading), else the civil Now.
  const occasion = spine?.occasion()
  const now = spine?.now()
  if (occasion) {
    const day = civilDayLabel(civilDateOfDayRef(occasion.basis.civilDayRef))
    const at = occasion.basis.instantUnixMs === null ? null : clockOf(occasion.basis.instantUnixMs)
    rows.push({key: 'occasion', value: [occasion.basis.summary ?? occasion.basis.ref, day, at].filter(Boolean).join(' · '),
      standing: occasion.admission ? (occasion.admission.admitted ? 'admitted' : 'not admitted now') : undefined,
      info: `The selected occasion, as first read (${occasion.basis.ref})${occasion.admission ? ` — ${occasion.admission.disclosure}` : ''}.`})
  } else if (context?.reading?.ref) {
    rows.push({key: 'occasion', value: context.reading.ref + (context.reading.position ? ` · ${context.reading.position}` : ''), info: `The occasion the encounter stands in (${context.reading.ref}).`})
  } else if (now) {
    const day = civilDayLabel(civilDateOfDayRef(now.dayRef))
    rows.push({key: 'occasion', value: `now · ${clockOf(now.instantUnixMs)}`, info: `The day's Now${day ? `, ${day}` : ''} — the World cut's civil reading (${now.source}${now.dayRef ? ` · ${now.dayRef}` : ''}).`})
  } else {
    rows.push({key: 'occasion', value: '—', info: 'No occasion is selected and no civil reading stands here: the Now shows when the World cut\'s temporal read answers.'})
  }
  return rows
}

// ————————————————————————————————————————————————————————————————————————
// The View section, by the focused pane's kind.

/** A save standing's tone, by its words (central/documents/documentDoor.ts documentStateWords; outcomeLabel). */
const STANDING_TONES: readonly (readonly [string, string])[] = [
  ['edited', 'var(--stall)'], ['saved', 'var(--green)'], ['unchanged', 'var(--green)'],
  ['stale', 'var(--rec)'], ['conflict', 'var(--rec)'], ['refused', 'var(--rec)'], ['blocked', 'var(--rec)'],
]
export const toneOf = (words: string | null | undefined): string | undefined => STANDING_TONES.find(([lead]) => words?.startsWith(lead))?.[1]

function Row({k, info, children}: {k: string; info: string; children: ReactNode}) {
  return <div className="aperture-row" data-i={`${k}|${info}`}><span className="k">{k}</span><span className="v">{children}</span></div>
}

function Seg<T extends string>({k, info, options, value, choose}: {k: string; info: string; options: readonly {value: T; label: string}[]; value: T | null; choose: (value: T) => void}) {
  return <div className="aperture-row" data-i={`${k}|${info}`}><span className="k">{k}</span>
    <div className="aperture-seg" role="group" aria-label={k}>
      {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>
  </div>
}

/** A Central document (the Day, a Flow): the document the hand reached in this pane — its form, file, revision and save
 * standing, and its owner's Save and Re-read (the mockup's Form · File · Revision, then the actions under them). */
function DocumentView({pane}: {pane: FocusedPane}) {
  const reached = useReachedDocument()
  const held = parseDocumentSubject(pane.pinned)
  const form = held ? (held.form === 'day' ? 'Day' : 'Flow') : null
  // The document door holds the one the hand last reached; it is this pane's when its form is this pane's.
  const document = reached && (!form || reached.form === form) ? reached : null
  const revision = document?.revision ? `r${revisionShort(document.revision)}` : null
  return <>
    <Row k="Form" info={`The form of the document this pane holds${pane.pinned ? ` (${pane.pinned})` : ''}.`}>{document?.form ?? form ?? '—'}</Row>
    <Row k="File" info={document ? `The document the pane reads: ${document.title}.` : 'Reach the document in its pane (press or focus it) to read its file here.'}>
      <span className="mono">{document?.title ?? '—'}</span></Row>
    <Row k="Revision" info={document ? `The owner's revision${document.revision ? ` ${document.revision}` : ''} and the save standing: ${document.state}.` : 'No document reached in this pane yet.'}>
      {document ? <>{revision && <>{revision} · </>}<span style={{color: toneOf(document.state)}}>{document.state}</span></> : '—'}</Row>
    <div className="aperture-acts">
      <button type="button" className="aperture-bt" data-action="save" disabled={!document?.save} onClick={() => document?.save?.()}
        data-i={`Save to Central|The owner's revision-checked write of the ${document?.form ?? 'document'} as it stands in its pane.`}>Save to Central</button>
      <button type="button" className="aperture-bt" data-action="reread" disabled={!document?.reread} onClick={() => document?.reread?.()}
        data-i={`${document?.rereadLabel ?? 'Re-read'}|Read the ${document?.form ?? 'document'} again from its owner.`}>{document?.rereadLabel ?? 'Re-read'}</button>
    </div>
  </>
}

const PRESENTATIONS = [{value: 'session', label: 'Session'}, {value: 'arrangement', label: 'Arrangement'}] as const
/** The tracks pane: its presentation (manual §3: Session and Arrangement, "Tab moves you between the two"), the pane's own. */
function TracksView() {
  const presented = useTimelinePanePresentation()
  return <Seg k="Presentation" info="The tracks pane's own presentation: Session (a grid of clips) or Arrangement (along one ruler)."
    options={PRESENTATIONS} value={presented} choose={setTimelinePanePresentation} />
}

const ATLAS_VIEWS = [{value: 'earth', label: 'Earth'}, {value: 'graph', label: 'Graph'}] as const
/** The Earth and its graph (DEVICE-SEMANTICS-LOCK §0.1.3: the 0 instrument is the Earth and solar system with its graph view):
 * the atlas's view, as the atlas publishes it. */
function AtlasViewRows() {
  const view = useAtlasView()
  return <Seg k="View" info="The atlas's view: the Earth and its system, or the same material as a graph." options={ATLAS_VIEWS} value={view} choose={presentAtlasView} />
}

/** A thread (a conversation pane, or Factory's agent tab): the session it holds — its own, else THE selection when that is an
 * agent session — and the Workcell the host discloses. */
function ThreadView({pane}: {pane: FocusedPane}) {
  const selection = useOptionalContinuity()?.current.context?.selection
  const config = useContext(ShellConfigContext)
  const session = pane.ref ? {title: pane.title, ref: pane.ref} : selection?.kind === 'agent-session' ? selection : null
  const workcell = config?.world_scope?.workcell_ref
  return <>
    <Row k="Session" info={session ? `The agent session: ${session.title} (${session.ref}).` : 'No agent session is selected. Select a session\'s track to read it here.'}>{session?.title ?? '—'}</Row>
    <Row k="Workcell" info={workcell ? `The Workcell the host discloses for this World (${workcell}).` : 'The host discloses no Workcell here (the development browser has none).'}>
      <span className="mono">{workcell ?? '—'}</span></Row>
  </>
}

/** An Expression: its Scene and State, from the hosted Expression's own reading. */
function ExpressionView() {
  const reading = useContext(Workspace)?.reading
  const scene = reading?.nativeScene
  return <>
    <Row k="Scene" info={reading?.sceneName ? `The open Scene${scene ? ` (${scene.scene_ref}, revision ${scene.revision})` : ''}.` : 'No Expression has reported its Scene yet.'}>{reading?.sceneName ?? '—'}</Row>
    <Row k="State" info={reading?.sceneState ? `The Scene's standing: ${reading.sceneState}.` : 'No Expression has reported its standing yet.'}>
      <span style={{color: toneOf(reading?.sceneState?.toLowerCase())}}>{reading?.sceneState ?? '—'}</span></Row>
  </>
}

export interface ApertureView {
  /** The View section's right-hand words (the mockup's "aperture", or "Technē instrument" for the 0 instrument). */
  label: string
  Rows: ComponentType<{pane: FocusedPane}>
}

/** The View rows by the focused pane's kind: a registration table, never a mode branch. A kind not named here has no View. */
export const APERTURE_VIEWS: Readonly<Record<string, ApertureView>> = {
  [CENTRAL_DOCUMENT_PANE_KIND]: {label: 'aperture', Rows: DocumentView},
  'projection.timeline': {label: 'aperture', Rows: TracksView},
  // The Earth and its graph are Technē's 0 instrument (DEVICE-SEMANTICS-LOCK §0.1.3), in every mode.
  'projection.earth': {label: 'Technē instrument', Rows: AtlasViewRows},
  'projection.constellation': {label: 'Technē instrument', Rows: AtlasViewRows},
  'projection.expressions': {label: 'aperture', Rows: ExpressionView},
  encounter: {label: 'aperture', Rows: ThreadView},
  [AGENT_SHELL_KIND]: {label: 'aperture', Rows: ThreadView},
}

// ————————————————————————————————————————————————————————————————————————
// The slot.

/** Re-render when the spine moves (a Now read, an occasion chosen). */
function useSpine(spine: TimeSpine | null | undefined): void {
  const [, bump] = useState(0)
  useEffect(() => (spine ? spine.subscribe(() => bump(value => value + 1)) : undefined), [spine])
}

export function ApertureSlot() {
  const pane = useFocusedPane()
  const context = useOptionalContinuity()?.current.context
  const config = useContext(ShellConfigContext)
  const reading = useTimelineReading()
  const spine = reading?.spine ?? reading?.world?.spine ?? null
  useSpine(spine)
  const door = useDeviceDoor()
  const device = door.selected ? door.device(door.selected) : undefined
  return <ApertureFace pane={pane} rows={contextRows({pane, context, config, spine})} pin={pane ? pinStanding(pane, context?.selection) : null} deviceHeld={!!device} />
}

/** The slot drawn from its readings (the face the hook above feeds; a fixture may feed it too). */
export function ApertureFace({pane, rows, pin, deviceHeld}: {pane: FocusedPane | null; rows: readonly ContextRow[]; pin: PinStanding | null; deviceHeld: boolean}) {
  const view = pane ? APERTURE_VIEWS[pane.kind] : undefined
  return <section className="aperture-slot" aria-label="Aperture" data-aperture-pane={pane?.kind ?? 'none'}>
    <header className="aperture-head" data-i={pane ? `${pane.title}|The focused pane — pane ${pane.index} of ${pane.count}. Its context and its view stand below.` : 'Aperture|No pane holds the focus; its context shows here when one does.'}>
      {pane && <span className="aperture-mark" aria-hidden="true"><MarkOf mark={paneMark(pane)} /></span>}
      <b>{pane?.title ?? 'No pane in focus'}</b>
      <span className="aperture-r">
        {pane && <span data-aperture-index>pane {pane.index}/{pane.count}</span>}
        {pane && pin && <button type="button" className={`aperture-pin${pin.words === 'pinned' ? ' on' : ''}`} data-pin={pin.words} disabled={!pin.next}
          data-i={`Pin|${pin.info}`} title={pin.info} onClick={() => { if (pin.next) pane.pin(pin.next.ref) }}>{pin.words}</button>}
        {deviceHeld && <button type="button" className="aperture-pin" data-aperture-return
          data-i="Context|Show the focused pane's context here again; the device stays on its chain — choose it there to see it whole."
          onClick={() => selectDevice(null)}>context</button>}
      </span>
    </header>
    {!deviceHeld && <div className="aperture-body">
      <div className="aperture-sec" data-i={`Context|${pin?.info ?? 'The encounter the panes stand in.'}`}><span>Context</span><span>{pin?.context ?? 'no pane in focus'}</span></div>
      {rows.map(row => <div key={row.key} className="aperture-ctx" data-context={row.key} data-i={`${row.key}|${row.info}`}>
        <span className="k">{row.key}</span>
        <span className="v">{row.dot && <span className="dot" style={{background: row.dot}} />}{row.mark && <span className="kg"><KindMark kind={row.mark} size={11} /></span>}
          {row.key === 'subject' && row.value !== '—' ? <b>{row.value}</b> : row.value}</span>
        <span className="s">{row.standing ?? ''}</span>
      </div>)}
      {pane && view && <>
        <div className="aperture-sec"><span>View</span><span>{view.label}</span></div>
        <view.Rows pane={pane} />
      </>}
    </div>}
  </section>
}
