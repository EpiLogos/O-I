import { Icon } from './Icon'
import { Icon as CutIcon } from '../inhabitants/sdk/Icon'
import { NativeTransportBar } from './NativeTransportBar'
import { MODE_GRAMMAR, surfModeOf, type SurfMode } from '../shell/modeGrammar'
import type { ModeTransportReadouts } from '../shell/ModeTransportBar'
import { ModeTransport } from '../shell/modeTransports'
import type { TimeSpine } from '../timeline/timeSpine'
import type { PaneInstrumentId } from '../shell/paneInstrument'
import { ModeModeRail } from '../shell/ModeModeRail'
import type { PanelRegistration } from '../shell/panels'
import type { NativeCompositionViewSource } from '../shell/compositionViews'


export function TransportBar({ tempoBpm, name, mode, setView, chooseMode, presentedView, modeReadouts, timeSpine, focusedInstrument, workName, nativeTransport, centerPanels, activeCenter, openCenter, browser, detail, dock, toggleBrowser, toggleDetail, toggleDock }: {
  /** The Expressions Scene transport source; absent until the native reading is admitted. */
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
  return <header className="transport"><div className="set-title">{mode === 'live' ? name || 'Untitled' : workName || grammar.title}</div><div className="transport-controls">
    {/* The chrome toggles wear the cut's marks (the same controls in the
      agent transport draw the same marks — the icon law). */}
    <button className="chrome-toggle" aria-label="Toggle browser" aria-pressed={browser} onClick={toggleBrowser} title="Browser · ⌘⌥B"><CutIcon name="browser" size={15} /></button>
    {/* One transport, five meanings (Rev 5): the SAME slots in the SAME
      places. Live keeps the audio cut's own controls; Expressions keeps the
      native transport when the owner is attached; Base·Central and Technē
      wear the grammar's meanings as drawn waiting states; every mode's
      texts are the data-i strings. The drawn marks are the icon-cut's, the
      same mark per control in every mode. */}
    {mode === 'expressions' && nativeTransport?.content ? <NativeTransportBar source={nativeTransport} />
      : <ModeTransport key={surf} mode={surf} reading={{readouts: modeReadouts, timeSpine, focusedInstrument, tempoBpm, nativeTransport}} />}
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
