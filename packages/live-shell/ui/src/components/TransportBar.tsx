import { Icon } from './Icon'
import { Icon as CutIcon } from '../inhabitants/sdk/Icon'
import { NativeTransportBar } from './NativeTransportBar'
import { MODE_GRAMMAR, slotDataI, slotMeaning, surfModeOf, type SurfMode } from '../shell/modeGrammar'
import { ModeTransportBar, type ModeTransportReadouts } from '../shell/ModeTransportBar'
import { ModeModeRail } from '../shell/ModeModeRail'
import type { PanelRegistration } from '../shell/panels'
import type { NativeCompositionViewSource } from '../shell/compositionViews'

/** A waiting audio control: the Live meaning (from the grammar) with the
 * standing honesty that the audio engine's transport is read-only until its
 * owner lands. The data-i string IS the per-mode meaning (the F2 law). */
function NativeControl({ children, label, slot, className = '' }: { children: React.ReactNode; label: string; slot?: string; className?: string }) {
  const meaning = slot ? slotMeaning('live', slot) : null
  return <button
    className={'native-control ' + className}
    disabled
    aria-label={label}
    data-i={meaning ? slotDataI(meaning) : `${label}|requires native transport`}
    title={meaning ? `${meaning.label} — ${meaning.fn} · requires native transport` : `${label} · requires native transport`}
  >{children}</button>
}

export function TransportBar({ tempoBpm, name, mode, setView, chooseMode, presentedView, modeReadouts, workName, nativeTransport, centerPanels, activeCenter, openCenter, browser, detail, dock, toggleBrowser, toggleDetail, toggleDock }: {
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
    {mode === 'live' ? <><div className="transport-group transport-tempo"><NativeControl label="Link" slot="link">Link</NativeControl><NativeControl label="Tap tempo" slot="tap">Tap</NativeControl><input className="tempo-field" aria-label="Tempo" data-i={slotDataI(slotMeaning('live', 'tempo'))} title="Tempo — the set's tempo · document read-only until editing owner lands" value={tempoBpm?.toFixed(2) ?? '—'} readOnly /><NativeControl label="Tempo nudge down" slot="tempo">‹</NativeControl><NativeControl label="Tempo nudge up" slot="tempo">›</NativeControl><output className="meter-field" data-i={slotDataI(slotMeaning('live', 'signature'))} title="Signature — the set's time signature · not disclosed by the document">— / —</output><NativeControl label="Metronome" slot="metro"><CutIcon name="metroDots" size={14} /></NativeControl><select aria-label="Global quantization" data-i={slotDataI(slotMeaning('live', 'quantize'))} disabled title="Quantize — global launch quantization · requires native transport"><option>—</option></select></div>
    <div className="transport-scale"><NativeControl label="Scale" slot="key">♯</NativeControl><select disabled aria-label="Root note" data-i={slotDataI(slotMeaning('live', 'root'))} title="Root — the key's root note · not disclosed"><option>—</option></select><select disabled aria-label="Scale mode" data-i={slotDataI(slotMeaning('live', 'scale'))} title="Scale — the key's scale mode · not disclosed"><option>—</option></select></div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback"><NativeControl label="Follow arrangement" slot="follow"><CutIcon name="follow" size={14} /></NativeControl><output className="position-field" data-i={slotDataI(slotMeaning('live', 'position'))} title="Position — bars . beats . sixteenths · native transport position unavailable">— . — . —</output>{([['play', 'play'], ['stop', 'stop'], ['record', 'rec']] as const).map(([slot, mark]) => <NativeControl key={slot} label={slot[0].toUpperCase() + slot.slice(1)} slot={slot} className={'transport-btn transport-' + slot}><CutIcon name={mark} size={15} /></NativeControl>)}<NativeControl label="MIDI overdub" slot="overdub"><CutIcon name="plus" size={13} /></NativeControl><NativeControl label="Automation arm" slot="arm"><CutIcon name="cmd" size={14} /></NativeControl><NativeControl label="Re-enable automation" slot="re-enable"><CutIcon name="back" size={14} /></NativeControl><NativeControl label="Session record" slot="capture"><CutIcon name="cap" size={14} /></NativeControl></div>
    <div className="transport-loop transport-group"><output className="position-field" data-i={slotDataI(slotMeaning('live', 'punch-in'))} title="Punch in — record between the in and out points · requires native transport">— . — . —</output><NativeControl label="Punch in" slot="punch-in"><CutIcon name="punchIn" size={14} /></NativeControl><NativeControl label="Loop" slot="loop"><CutIcon name="loop" size={13} /></NativeControl><NativeControl label="Punch out" slot="punch-out"><CutIcon name="punchOut" size={14} /></NativeControl><output className="position-field" data-i={slotDataI(slotMeaning('live', 'loop-length'))} title="Loop length — the loop brace's length · requires native transport">— . — . —</output></div>
    <div className="transport-spacer" />
    <div className="transport-system"><NativeControl label="Draw mode" slot="draw"><CutIcon name="draw" size={14} /></NativeControl><NativeControl label="Computer MIDI keyboard" slot="keys"><CutIcon name="keys" size={14} /></NativeControl><NativeControl label="Key mapping" slot="key-map">Key</NativeControl><NativeControl label="MIDI mapping" slot="midi-map">MIDI</NativeControl><output data-i={slotDataI(slotMeaning('live', 'rate'))} title="Rate — the engine's sample rate · unavailable">— kHz</output><output data-i={slotDataI(slotMeaning('live', 'cpu'))} title="CPU — the engine's CPU load · unavailable">— %</output><span className="cpu-meter" /></div>
    </> : mode === 'expressions' && nativeTransport?.content ? <NativeTransportBar source={nativeTransport} />
      : <ModeTransportBar mode={surf} readouts={modeReadouts} />}
    <nav className="surface-icons" aria-label="Working surface">
      {/* Session and Arrangement first — presentations of the Timeline
        projection, their meanings per mode (Rev 5's second table). */}
      {(['session', 'arrangement'] as const).map(value => {
        const presentation = value === 'session' ? grammar.session : grammar.arrangement
        return <button key={value} type="button" aria-label={`${presentation.label} · ${presentation.meaning}`} aria-pressed={presentedView === value}
          data-i={`${presentation.label}|${presentation.meaning}`}
          title={`${presentation.label} · ${presentation.meaning} — Tab`} onClick={() => setView(value)}><Icon name={value} size={15} /></button>
      })}
      {/* Then the mode rail: Live · Base · Central · Factory · Expressions ·
        Technē — marks cut from icon-cut.html (the generated sdk module). */}
      <ModeModeRail mode={mode} chooseMode={chooseMode} />
      {centerPanels.map(panel => <button key={panel.id} type="button" aria-label={panel.title} aria-pressed={activeCenter === panel.id} title={panel.note ?? panel.title} onClick={() => openCenter(panel.id)}><Icon name={panel.icon ?? 'element'} size={17} /></button>)}
    </nav>
    <button className="chrome-toggle" aria-label="Toggle detail" aria-pressed={detail} onClick={toggleDetail} title="Detail panel · ⌘⌥L"><CutIcon name="detail" size={15} /></button><button className="chrome-toggle" aria-label="Toggle agents and context" aria-pressed={dock} onClick={toggleDock} title="Agents & context"><CutIcon name="dock" size={15} /></button>
  </div></header>
}
