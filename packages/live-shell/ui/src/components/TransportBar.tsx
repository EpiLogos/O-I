import { Icon as CutIcon } from '../inhabitants/sdk/Icon'
import { MODE_GRAMMAR, surfModeOf, type SurfMode } from '../shell/modeGrammar'
import type { ModeTransportReadouts } from '../shell/ModeTransportBar'
import { MODE_TITLE, ModeTransport } from '../shell/modeTransports'
import { useContext } from 'react'
import { useOptionalContinuity } from '../continuity/workspace'
import { returnToStop } from '../shell/TrailWidget'
import { trailSteps } from '../frame/encounter/encounterRows'
import { standingOn } from '../../../../../desktop/cradle/src/workspace/store'
import type { MainView } from '../shell/mainView'
import { ShellConfigContext } from '../shell/useSet'
import { useSpineRevision } from '../shell/ModeTransportBar'
import { titleLine, worldName } from '../shell/transports/transportReadings'
import type { TimeSpine } from '../timeline/timeSpine'
import type { PaneInstrumentId } from '../shell/paneInstrument'
import { ModeModeRail } from '../shell/ModeModeRail'
import type { NativeCompositionViewSource } from '../shell/compositionViews'


/** The three views of the main area (manual §10.2), in the transport's View group: the mode's set as Session view or
 * Arrangement view, and Pane view. */
const VIEWS: ReadonlyArray<{view: MainView; label: string; mark: 'session' | 'arrangement' | 'pane'; keys: string}> = [
  {view: 'session', label: 'Session view', mark: 'session', keys: 'Tab'},
  {view: 'arrangement', label: 'Arrangement view', mark: 'arrangement', keys: 'Tab'},
  {view: 'pane', label: 'Pane view', mark: 'pane', keys: '⌥⌘9'},
]

/** The transport (manual §10.1): every control in one place, the same in every mode. From the left: the browser's toggle, the
 * mode's transport in Live's order (shell/modeTransports.tsx), the modes, the three views, and the widget rail's toggle. The
 * instruments are not here: they come from the browser. Settings open with ⌘, in a window of their own. */
export function TransportBar({ tempoBpm, name, mode, view, setView, chooseMode, modeReadouts, timeSpine, focusedInstrument, workName, nativeTransport, browser, dock, toggleBrowser, toggleDock }: {
  /** The Expressions owner's source for the bar's bindings; absent until the native reading is admitted. */
  nativeTransport?: NativeCompositionViewSource | null
  /** The frame's Rev-5 mode reading (surfModeOf maps it onto the surf). */
  mode: 'live' | 'base' | 'factory' | 'expressions' | 'techne'
  /** The view that stands in the main area, and the one writer that switches it (shell/mainView.ts). */
  view: MainView; setView: (view: MainView) => void
  /** Enter a surf mode (Rev 5): the encounter transition through the spine. */
  chooseMode: (mode: SurfMode) => void
  /** Real readings the mode transport may show (Now, carrier); absent slots stay honestly empty. */
  modeReadouts?: ModeTransportReadouts
  /** The World's time spine — the same one the Timeline chips drive. Its Occasion slot steps it; absent, the slot waits. */
  timeSpine?: TimeSpine | null
  /** The focused centre pane's instrument (paneInstrument.ts); Technē's arm slot names it and waits for its writer. */
  focusedInstrument?: PaneInstrumentId | null
  workName?: string; sceneName?: string
  tempoBpm: number | null; name: string; browser: boolean; dock: boolean
  toggleBrowser: () => void; toggleDock: () => void
}) {
  const surf = surfModeOf(mode) ?? 'live'
  const grammar = MODE_GRAMMAR[surf]
  // The bar is the native window's drag region (its title bar is an overlay): the header, the title line and the controls
  // row's empty space move the window; a control inside them is pressed as ever (Tauri drags only from the marked element).
  return <header className="transport" data-tauri-drag-region data-focus-region="transport" tabIndex={-1}><TransportTitle line={MODE_TITLE[surf]} setName={name} workName={workName} timeSpine={timeSpine} /><div className="transport-controls" data-tauri-drag-region>
    <button className="chrome-toggle" aria-label="Toggle browser" aria-pressed={browser} onClick={toggleBrowser} data-i="Browser|Shows or hides the browser (⌥⌘B)."><CutIcon name="browser" size={15} /></button>
    {/* One transport, five meanings (Rev 5): the SAME slots in the SAME places, in every mode, in Live's order. */}
    <ModeTransport key={surf} mode={surf} reading={{readouts: modeReadouts, timeSpine, focusedInstrument, tempoBpm, nativeTransport}} />
    <nav className="surface-icons transport-modes" aria-label="Mode">
      <ModeModeRail mode={mode} chooseMode={chooseMode} />
    </nav>
    <nav className="surface-icons transport-views" aria-label="View">
      {VIEWS.map(entry => {
        const meaning = entry.view === 'pane' ? 'the instruments you work in, at full size' : (entry.view === 'session' ? grammar.session : grammar.arrangement).meaning
        return <button key={entry.view} type="button" aria-label={entry.label} aria-pressed={view === entry.view}
          data-i={`${entry.label}|${meaning} (${entry.keys}).`} onClick={() => setView(entry.view)}><CutIcon name={entry.mark} size={15} /></button>
      })}
    </nav>
    <button className="chrome-toggle" aria-label="Toggle widget rail" aria-pressed={dock} onClick={toggleDock} data-i="Widget rail|Shows or hides the widget rail (⌥⌘8)."><CutIcon name="dock" size={15} /></button>
  </div></header>
}

/** Back and Forward at the head of the title line (manual §10.7: "To go back, press Back at the head of the title line … Forward
 * goes the other way, until you go somewhere new"): one stop along the book's trail each way from the stop you stand on, through
 * the trail's one return (shell/TrailWidget.tsx returnToStop), never a second writer. The place on the trail is the book's
 * (WorldContext.trailAt), so the Trail's own press moves it too, and a move — which lands on the newest stop — leaves Forward
 * nothing. The browser's ‹ › walk only the categories the browser has shown (frame/browser/Browser.tsx): what the browser shows,
 * never where you are, so they add no stop and move no place on this trail. */
function TitleTrail() {
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const trail = context?.trail ?? []
  const steps = trailSteps(trail.length, standingOn(context ?? {}))
  const go = (index: number | null) => { if (continuity && index !== null) returnToStop(continuity, index) }
  const back = steps.back === null ? null : trail[steps.back]
  const forward = steps.forward === null ? null : trail[steps.forward]
  return <span className="title-trail">
    <button type="button" aria-label="Back" disabled={!back} onClick={() => go(steps.back)}
      data-i={back ? `Back|Return to ${back.label}.` : 'Back|Nothing before this on the trail yet.'}>‹</button>
    <button type="button" aria-label="Forward" disabled={!forward} onClick={() => go(steps.forward)}
      data-i={forward ? `Forward|On to ${forward.label}.` : 'Forward|Nothing after this on the trail.'}>›</button>
  </span>
}

/** The title line (the mockup's `#title`: "<b>Bollingen · the stone carved</b> — Central · 08 Oct"): THE selection (the
 * book's WorldContext.selection), the world (the book's WorldContext.world, else the World the host discloses) and the civil
 * day the World cut's spine stands in (`now().dayRef`) — or, in Live, the open set's name. With no selection, the open work. What the line reads is the mode's
 * registration (shell/modeTransports.tsx MODE_TITLE); with nothing standing it says so. */
export function TransportTitle({line, setName, workName, timeSpine}: {line: 'set' | 'selection'; setName?: string; workName?: string; timeSpine?: TimeSpine | null}) {
  const context = useOptionalContinuity()?.current.context
  const config = useContext(ShellConfigContext)
  useSpineRevision(timeSpine)
  // With no selection standing, the open work in front of you (the hosted frame's document) is what the line names, as before.
  const title = titleLine({line, setName, selection: context?.selection ?? (workName ? {title: workName} : null), world: worldName(context?.world, config), civilDayRef: timeSpine?.now()?.dayRef ?? null})
  const words = [title.lead ?? title.absent, title.context].filter(Boolean).join(' — ')
  return <div className="set-title" data-region="title-line" data-tauri-drag-region title={words} data-i={`${title.lead ?? title.absent ?? ''}|${line === 'set' ? 'The open Live set.' : 'What you have selected, its world and its day.'}`}>
    <TitleTrail />{title.lead ? <b>{title.lead}</b> : <span className="set-title-absent">{title.absent}</span>}{title.context ? ` — ${title.context}` : null}
  </div>
}

