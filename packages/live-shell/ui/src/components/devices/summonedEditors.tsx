// The editors the hosted frame summons, each in its device home (lane BE; manual §16.3: "Whole — the pool … Every parameter, grouped";
// "Full — a pane … The material itself"; owner, via the lead, 16 Oct: "summoned editors (Acts, Nara, library, Find) still open over the
// field — each needs its device home"). While the shell presents the frame in a pane ('devices', framePresentation.ts) the frame no longer
// draws these over its field (expressions-app presentedChrome.ts, workspace.css):
//   • the Library — the frame hands its summon to the shell (its chrome reading's `summons.library` counts it) and the shell opens the
//     Library full in a pane, on the Library's own page (library.html through desktop/cradle/src/library/LibraryHost.tsx, the light
//     gallery the instrument shares its store with; an open there comes back to the instrument through `oi:host-workspace-mode`, App.tsx);
//   • Acts, the Nara instrument and Find on Canvas — each stays mounted in the frame, stood down, and its controls stand in the frame's
//     chrome reading under its own home (acts, nara:instrument, canvas:find); the shell shows that editor whole in the pool the moment
//     the frame opens it, its controls drawn as every frame control is (frameChrome.tsx: the frame's own control pressed through its one
//     runner), paged in the head when they do not fit one band (§1). Closing it there closes it in the frame.
// In the frame's own presentation (the pane at full size) the frame opens them as it always has, and nothing here stands.
// DLW build ruling 2026-11-05 (O-I #747; manual §20.15): Acts is a device of its own, standing in Device view after the Studio while a frame
// is hosted ("Give a scene's objects roles, keep reusable material, and play acts — the Acts device, in Device view after the Studio"): its
// first key is the frame's own Acts (scene/l:Acts), which opens it; open, the frame's Acts controls follow, and the pool shows it whole.
// Owners write, faces read: nothing here keeps a value of the frame's; every press is the frame's own control.
import {useEffect, useRef, type CSSProperties} from 'react'
import type {FrameChromeControl, FrameChromeHome, FrameChromeReading} from '@epilogos/expressions-boundary'
import {useKernel, KernelApiProvider, type KernelApi} from '../../../../../../desktop/cradle/src/kernel/KernelContext'
import {LibraryHost} from '../../../../../../desktop/cradle/src/library/LibraryHost'
import type {DeviceDeclaration} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import {Band, Folded, Panel, Section, Tile} from '../../inhabitants/sdk/panel'
import type {DesignedDevice, ViewProps} from '../../frame/devices/designed'
import {registerDesignedDevice} from '../../frame/devices/designs'
import {DEVICE_PANE_KIND, publishDevice, selectDevice, selectedDeviceId} from '../../frame/devices/deviceDoor'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {bringInstrumentIntoView} from '../../frame/instrumentDoor'
import {useHostedChrome} from '../../projections/expressionsPaneHost'
import {FrameControls, controlsAt, useFrameChromeOver} from '../expressions/studio/frameChrome'
import './summonedEditors.css'

export interface SummonedEditor {
  /** The device's id on the door: `expressions:<face>`, the design's key. */
  readonly id: string
  readonly face: string
  readonly title: string
  readonly icon: IconName
  /** The frame's chrome home its controls stand in while it is open; absent for the Library, which opens on its own page. */
  readonly home?: FrameChromeHome
  /** What the device is, for the status bar. */
  readonly does: string
  /** The frame's own control that opens it (its chrome id), drawn first on its plate; absent where the frame opens it itself. */
  readonly entry?: string
  /** It stands on the door while a frame is hosted, open or not (the Library's page; Acts, in Device view after the Studio). */
  readonly stands?: boolean
}

export const SUMMONED_EDITORS: readonly SummonedEditor[] = [
  {id: 'expressions:library', face: 'library', title: 'Library', icon: 'lib', stands: true, does: 'The Expressions library: saved, featured and native works. Open one to bring it into the field.'},
  {id: 'expressions:acts', face: 'acts', title: 'Acts', icon: 'loop', home: 'acts', entry: 'scene/l:Acts', stands: true,
    does: 'Give the scene\'s objects roles, keep reusable material, and play acts. Its first key opens Acts in the application.'},
  {id: 'expressions:nara-instrument', face: 'nara-instrument', title: 'Nara', icon: 'contact', home: 'nara:instrument', does: 'Your personal Nara layer: your identity, its sky and the conversation, over this Expression.'},
  {id: 'expressions:find', face: 'find', title: 'Find', icon: 'search', home: 'canvas:find', does: 'Find a card or a frame on the Canvas: Enter for the next match.'},
]

/** One band holds this many rows of the frame's keys (frameChrome.css: 16 px keys, 3 px apart, under the section's label). */
const BAND_ROWS = 7
/** And this many columns of them in the pool's 400 px plate (frameChrome.css: a key is at most 132 px). */
const BAND_COLUMNS = 3

/** The controls a home holds now, cut into the pages one band shows: the keys flow down a column of `rows` and then across, a choice or a
 * value two rows high and never split between columns (frameChrome.css); a page holds `columns` columns. Pure. */
export function editorPages(controls: readonly FrameChromeControl[], rows = BAND_ROWS, columns = BAND_COLUMNS): FrameChromeControl[][] {
  const span = (control: FrameChromeControl) => (control.kind === 'select' || control.kind === 'range' || control.kind === 'number' || control.kind === 'text' ? 2 : 1)
  const pages: FrameChromeControl[][] = []
  let page: FrameChromeControl[] = [], column = 0, row = 0
  for (const control of controls) {
    const take = Math.min(rows, span(control))
    if (row + take > rows) {column += 1; row = 0}
    if (column >= columns) {pages.push(page); page = []; column = 0; row = 0}
    page.push(control)
    row += take
  }
  if (page.length || !pages.length) pages.push(page)
  return pages
}

/** The Acts device (manual §20.15): in Device view after the Studio. */
export const ACTS_EDITOR: SummonedEditor = SUMMONED_EDITORS.find(editor => editor.id === 'expressions:acts')!

/** An editor's keys: the frame's own control that opens it, then the frame's controls for its home while it is open. Pure. */
export function editorControls(editor: SummonedEditor, reading: FrameChromeReading | null): FrameChromeControl[] {
  const entry = editor.entry ? (reading?.controls ?? []).filter(control => control.id.replace(/~\d+$/, '') === editor.entry).slice(0, 1) : []
  return [...entry, ...(editor.home ? controlsAt(reading, editor.home) : [])]
}

/** The editors the frame holds open now, by home, from its chrome reading. Pure. */
export function openEditors(reading: FrameChromeReading | null): SummonedEditor[] {
  return SUMMONED_EDITORS.filter(editor => editor.home && controlsAt(reading, editor.home).length > 0)
}

/** The Library summons the shell has not answered: a count above the one it last answered. Pure. */
export function newSummons(reading: FrameChromeReading | null, answered: number | null): {count: number | null; open: boolean} {
  const count = reading?.summons?.library ?? null
  if (count === null) return {count: answered, open: false}
  if (answered === null) return {count, open: false}
  return {count, open: count > answered}
}

const declaration = (editor: SummonedEditor): DeviceDeclaration => ({
  id: editor.face, title: editor.title, icon: editor.icon, liveSemantic: editor.face === 'library' ? 'browser' : 'detail-device',
  note: `${editor.title}: the hosted Expressions application's own ${editor.face === 'library' ? 'Library page' : 'editor'}, in its device home; every press is the application's own control.`,
} as DeviceDeclaration)

/** The device of an editor on the door: no rows of its own — its controls are the frame's, drawn by its design. */
export const editorDevice = (editor: SummonedEditor): DeviceInstance => ({id: editor.id, family: 'expressions', face: declaration(editor), rows: [], values: {}})

// The kernel the Library's page reads through (LibraryHost relays its kernel channel). A pane's device is drawn in a root of its own,
// outside the shell's providers (devicePane.tsx), so the shell's kernel is handed to it from where the editors are published.
let kernelForPanes: KernelApi | null = null

/** An editor's plate on the kit, compact on a chain or whole in the pool: its controls in the frame's words, pressed through its one runner
 * (frameChrome.tsx), paged in the head when one band does not hold them (manual §16.9). The Library's plate opens its page (⤢). */
function EditorPanel({editor, p, view}: {editor: SummonedEditor; p: ViewProps; view: 'compact' | 'whole'}) {
  const chrome = useHostedChrome()
  const frame = useFrameChromeOver(chrome?.state ?? null, chrome?.run ?? null)
  const controls = editorControls(editor, frame.reading)
  const open = editor.home ? controlsAt(frame.reading, editor.home).length > 0 : false
  const pages = editorPages(controls)
  const at = Math.min(pages.length - 1, Math.max(0, Number.parseInt(p.page || '0', 10) || 0))
  return <Panel title={editor.title} view={view} light="unknown" hint={editor.does} onFold={view === 'compact' ? p.nav.fold : undefined}
    onSelect={view === 'compact' ? p.nav.select : undefined} onFull={editor.home ? undefined : p.nav.full} fullLabel={editor.home ? undefined : 'Open the Library full in a pane'}
    pages={pages.length > 1 ? pages.map((_, index) => ({id: String(index), label: String(index + 1)})) : undefined} page={String(at)} onPage={p.setPage}>
    <Band><Section label={editor.home ? editor.title : 'Library'} grow>
      {!editor.home ? <p className="inst-section-line" data-i={`Library|${editor.does} ⤢ opens it full in a pane.`}>⤢ in a pane</p>
        : <>{controls.length > 0 && <div className="summoned-controls" style={{'--chrome-rows': BAND_ROWS} as CSSProperties}><FrameControls label={editor.title} controls={pages[at]!} view={frame} /></div>}
          {!open && <p className="inst-section-line" data-i={`${editor.title}|${editor.title} is closed in the application${editor.entry && controls.length ? `: ${controls[0]!.label} opens it` : ''}.`}>closed</p>}</>}
    </Section></Band>
  </Panel>
}

/** The rail's tile of an editor: its first controls (the Library's: its ⤢). */
function EditorTile({editor, p}: {editor: SummonedEditor; p: ViewProps}) {
  const chrome = useHostedChrome()
  const frame = useFrameChromeOver(chrome?.state ?? null, chrome?.run ?? null)
  const controls = editorControls(editor, frame.reading).slice(0, 4)
  return <Tile title={editor.title} light="unknown" onFull={editor.home ? undefined : p.nav.full} onClose={p.nav.close}>
    {controls.length ? <div className="summoned-controls" style={{'--chrome-rows': 4} as CSSProperties}><FrameControls label={editor.title} controls={controls} view={frame} /></div>
      : <p className="inst-section-line">{editor.home ? 'closed' : '⤢ in a pane'}</p>}
  </Tile>
}

/** An editor's five views (manual §16.3) on the kit: compact and whole its controls; the Library's Full its own page in a pane; the rail's
 * tile its first controls. */
export function editorDesign(editor: SummonedEditor): DesignedDevice {
  return {
    id: editor.id, title: editor.title, kind: 'effect', defaults: {}, firstPage: '0',
    folded: p => <Folded title={editor.title} light="unknown" onUnfold={p.nav.unfold} />,
    compact: p => <EditorPanel editor={editor} p={p} view="compact" />,
    whole: p => <EditorPanel editor={editor} p={p} view="whole" />,
    // Full holds the material (manual §16.3): the Library's own page. An editor whose material is the field has no Full of its own.
    full: () => editor.home ? <p className="source-note" role="status">{editor.title} stands in the pool under the browser.</p>
      : kernelForPanes ? <KernelApiProvider value={kernelForPanes}><div className="summoned-library"><LibraryHost /></div></KernelApiProvider>
      : <p className="source-note" role="status">The Library needs the shell's kernel; open it again from the Studio.</p>,
    widget: p => <EditorTile editor={editor} p={p} />,
  }
}

let registered = false
function registerEditorDesigns(): void {
  if (registered) return
  registered = true
  for (const editor of SUMMONED_EDITORS) registerDesignedDevice(editorDesign(editor))
}

/** Hold the kernel when this hook stands inside the shell's providers (the transport's), and nothing where it does not (a test). */
function useHeldKernel(): KernelApi | null {
  try {return useKernel()} catch {return null}
}

/** Give the frame's summoned editors their device homes while the shell presents the frame on its devices. Mounted once, with the frame's
 * presentation (framePresentation.ts useFramePresentation, which stands with the transport in every mode). */
export function useSummonedEditors(): void {
  const chrome = useHostedChrome()
  const kernel = useHeldKernel()
  kernelForPanes = kernel ?? kernelForPanes
  const state = chrome?.state ?? null
  const devices = state?.presentation === 'devices'
  const reading = devices ? state?.chrome ?? null : null
  const answered = useRef<number | null>(null)
  const shownBefore = useRef(new Map<string, string | null>())
  const open = new Set(openEditors(reading).map(editor => editor.id))
  const openKey = [...open].join('|')
  const libraryKey = reading?.summons?.library ?? null
  // The Library and Acts stand on the door while a frame is hosted (a pane that holds the Library's page outlives a change of presentation;
  // Acts stands in Device view after the Studio, §20.15): the Library's summon brings it into view full in a pane — beside the field's
  // pane, never over it (instrumentDoor.ts bringInstrumentIntoView).
  const hosted = !!state
  useEffect(() => {
    registerEditorDesigns()
    const always = SUMMONED_EDITORS.filter(editor => editor.stands)
    for (const editor of always) publishDevice(editor.id, hosted ? {device: editorDevice(editor)} : null)
    return () => {for (const editor of always) publishDevice(editor.id, null)}
  }, [hosted])
  useEffect(() => {
    const next = newSummons(reading, answered.current)
    answered.current = next.count
    if (!next.open) return
    try {bringInstrumentIntoView(DEVICE_PANE_KIND, {ref: SUMMONED_EDITORS[0]!.id, title: 'Library'})}
    catch (cause) {console.warn(`The Library could not open in a pane: ${cause instanceof Error ? cause.message : String(cause)}`)}
  }, [libraryKey, devices])
  // Nara and Find stand on the door while the frame holds them open (Acts stands while hosted); the pool shows the one just opened, and
  // gives the device it showed before back when it closes.
  useEffect(() => {
    registerEditorDesigns()
    for (const editor of SUMMONED_EDITORS.slice(1)) {
      if (open.has(editor.id)) {
        if (!shownBefore.current.has(editor.id)) {
          shownBefore.current.set(editor.id, selectedDeviceId())
          if (!editor.stands) publishDevice(editor.id, {device: editorDevice(editor)})
          selectDevice(editor.id)
        }
      } else if (shownBefore.current.has(editor.id)) {
        const before = shownBefore.current.get(editor.id) ?? null
        shownBefore.current.delete(editor.id)
        if (selectedDeviceId() === editor.id) selectDevice(before)
        if (!editor.stands) publishDevice(editor.id, null)
      }
    }
  }, [openKey])
  useEffect(() => () => {for (const id of shownBefore.current.keys()) publishDevice(id, null); shownBefore.current.clear()}, [])
}
