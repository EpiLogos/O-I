import { Icon } from './Icon'
import { Icon as CutIcon } from '../inhabitants/sdk/Icon'
import { MODE_GRAMMAR, surfModeOf, type SurfMode } from '../shell/modeGrammar'
import type { ModeTransportReadouts } from '../shell/ModeTransportBar'
import { MODE_TITLE, ModeTransport } from '../shell/modeTransports'
import { useContext } from 'react'
import { useOptionalContinuity } from '../continuity/workspace'
import { ShellConfigContext } from '../shell/useSet'
import { useSpineRevision } from '../shell/ModeTransportBar'
import { titleLine, worldName } from '../shell/transports/transportReadings'
import type { TimeSpine } from '../timeline/timeSpine'
import type { PaneInstrumentId } from '../shell/paneInstrument'
import { ModeModeRail } from '../shell/ModeModeRail'
import type { PanelRegistration } from '../shell/panels'
import type { NativeCompositionViewSource } from '../shell/compositionViews'


export function TransportBar({ tempoBpm, name, mode, setView, chooseMode, presentedView, modeReadouts, timeSpine, focusedInstrument, workName, nativeTransport, centerPanels, activeCenter, openCenter, browser, detail, dock, toggleBrowser, toggleDetail, toggleDock }: {
  /** The Expressions owner's source for the bar's bindings; absent until the native reading is admitted. */
  nativeTransport?: NativeCompositionViewSource | null
  centerPanels: PanelRegistration[]; activeCenter: string | null; openCenter: (id: string) => void
  /** The frame's Rev-5 mode reading (surfModeOf maps it onto the surf). */
  mode: 'live' | 'base' | 'factory' | 'expressions' | 'techne'
  view?: string; setView: (view: string) => void
  /** Enter a surf mode (Rev 5): the encounter transition through the spine. */
  chooseMode: (mode: SurfMode) => void
  /** The presentation that stands now, per the encounter (tab, the native
   * identities, or the agent centre's view) — what Session/Arrangement show. */
  presentedView: 'session' | 'arrangement' | null
  /** Real readings the mode transport may show (Now, carrier); absent slots stay honestly empty. */
  modeReadouts?: ModeTransportReadouts
  /** The World's time spine — the same one the Timeline chips drive. Its Occasion slot steps it; absent, the slot waits. */
  timeSpine?: TimeSpine | null
  /** The focused centre pane's instrument (paneInstrument.ts); Technē's arm slot names it and waits for its writer. */
  focusedInstrument?: PaneInstrumentId | null
  workName?: string; sceneName?: string
  tempoBpm: number | null; name: string; browser: boolean; detail: boolean; dock: boolean
  toggleBrowser: () => void; toggleDetail: () => void; toggleDock: () => void
}) {
  const surf = surfModeOf(mode) ?? 'live'
  const grammar = MODE_GRAMMAR[surf]
  // The bar is the native window's drag region (its title bar is an overlay): the header, the title line and the controls
  // row's empty space move the window; a control inside them is pressed as ever (Tauri drags only from the marked element).
  return <header className="transport" data-tauri-drag-region><TransportTitle line={MODE_TITLE[surf]} setName={name} workName={workName} timeSpine={timeSpine} /><div className="transport-controls" data-tauri-drag-region>
    {/* The chrome toggles wear the cut's marks (the same controls in the
      agent transport draw the same marks — the icon law). */}
    <button className="chrome-toggle" aria-label="Toggle browser" aria-pressed={browser} onClick={toggleBrowser} title="Browser · ⌘⌥B"><CutIcon name="browser" size={15} /></button>
    {/* One transport, five meanings (Rev 5): the SAME slots in the SAME
      places, in every mode — Expressions too: its own bar is retired, its
      working controls are bound to the slots (shell/transports/useExpressionsTransport.tsx)
      and the Scene's other controls stand on the Clip side
      (components/expressions/clip/SceneControls.tsx). Live keeps the audio
      cut's own controls; Base·Central and Technē wear the grammar's
      meanings as drawn waiting states; every mode's texts are the data-i
      strings. The drawn marks are the icon-cut's, the same mark per control
      in every mode. */}
    <ModeTransport key={surf} mode={surf} reading={{readouts: modeReadouts, timeSpine, focusedInstrument, tempoBpm, nativeTransport}} />
    <nav className="surface-icons" aria-label="Working surface">
      {/* Session and Arrangement first — presentations of the Timeline
        projection, their meanings per mode (Rev 5's second table). */}
      {(['session', 'arrangement'] as const).map(value => {
        const presentation = value === 'session' ? grammar.session : grammar.arrangement
        return <button key={value} type="button" aria-label={`${presentation.label} · ${presentation.meaning}`} aria-pressed={presentedView === value}
          data-i={`${presentation.label}|${presentation.meaning}`}
          title={`${presentation.label} · ${presentation.meaning} — Tab`} onClick={() => setView(value)}><CutIcon name={value} size={15} /></button>
      })}
      {/* Then the mode rail: Live (the base) · Central · Factory · Expressions ·
        Technē — marks cut from icon-cut.html (the generated sdk module). */}
      <ModeModeRail mode={mode} chooseMode={chooseMode} />
      {centerPanels.map(panel => <button key={panel.id} type="button" aria-label={panel.title} aria-pressed={activeCenter === panel.id} title={panel.note ?? panel.title} onClick={() => openCenter(panel.id)}><Icon name={panel.icon ?? 'element'} size={17} /></button>)}
    </nav>
    <button className="chrome-toggle" aria-label="Toggle detail" aria-pressed={detail} onClick={toggleDetail} title="Detail panel · ⌘⌥L"><CutIcon name="detail" size={15} /></button><button className="chrome-toggle" aria-label="Toggle agents and context" aria-pressed={dock} onClick={toggleDock} title="Agents & context"><CutIcon name="dock" size={15} /></button>
  </div></header>
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
  return <div className="set-title" data-region="title-line" data-tauri-drag-region title={words} data-i={`${title.lead ?? title.absent ?? ''}|${line === 'set' ? 'The open Live set.' : 'THE selection, its world and the day it stands in.'}`}>
    {title.lead ? <b>{title.lead}</b> : <span className="set-title-absent">{title.absent}</span>}{title.context ? ` — ${title.context}` : null}
  </div>
}

