import { Icon } from './Icon'
import { NativeTransportBar } from './NativeTransportBar'
import type { PanelRegistration } from '../shell/panels'
import type { WorkspaceMode } from '../shell/workspace'
import type { NativeCompositionViewSource } from '../shell/compositionViews'
function NativeControl({ children, label, className = '' }: { children: React.ReactNode; label: string; className?: string }) {
  return <button className={'native-control ' + className} disabled aria-label={label} title={`${label} · requires native transport`}>{children}</button>
}
export function TransportBar({ tempoBpm, name, mode, view, setView, setMode, workName, sceneName, nativeTransport, centerPanels, activeCenter, openCenter, browser, detail, dock, toggleBrowser, toggleDetail, toggleDock }: {
  /** The Expressions Scene transport source; absent until the native reading is admitted. */
  nativeTransport?: NativeCompositionViewSource | null
  centerPanels: PanelRegistration[]; activeCenter: string | null; openCenter: (id: string) => void
  mode: WorkspaceMode; view: string; setView: (view: string) => void; setMode: (mode: WorkspaceMode) => void; workName?: string; sceneName?: string
  tempoBpm: number | null; name: string; browser: boolean; detail: boolean; dock: boolean
  toggleBrowser: () => void; toggleDetail: () => void; toggleDock: () => void
}) {
  return <header className="transport"><div className="set-title">{mode === 'audio' ? name || 'Untitled' : workName || (mode === 'expressions' ? 'Expressions' : 'Technē')}</div><div className="transport-controls">
    <button className="chrome-toggle" aria-label="Toggle browser" aria-pressed={browser} onClick={toggleBrowser} title="Browser · ⌘⌥B">▥</button>
    {mode === 'audio' ? <><div className="transport-group transport-tempo"><NativeControl label="Link">Link</NativeControl><NativeControl label="Tap tempo">Tap</NativeControl><input className="tempo-field" aria-label="Tempo" title="Set tempo · document read-only until editing owner lands" value={tempoBpm?.toFixed(2) ?? '—'} readOnly /><NativeControl label="Tempo nudge down">▥</NativeControl><NativeControl label="Tempo nudge up">▥</NativeControl><output className="meter-field" title="Signature is not disclosed by the document">— / —</output><NativeControl label="Metronome">●◦</NativeControl><select aria-label="Global quantization" disabled title="Quantization requires native transport"><option>—</option></select></div>
    <div className="transport-scale"><NativeControl label="Scale">♯</NativeControl><select disabled aria-label="Root note" title="Scale not disclosed"><option>—</option></select><select disabled aria-label="Scale mode" title="Scale not disclosed"><option>—</option></select></div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback"><NativeControl label="Follow arrangement">➜</NativeControl><output className="position-field" title="Native transport position unavailable">— . — . —</output>{['play', 'stop', 'record'].map(icon => <NativeControl key={icon} label={icon[0].toUpperCase() + icon.slice(1)} className={'transport-btn transport-' + icon}><Icon name={icon} size={15} /></NativeControl>)}<NativeControl label="MIDI overdub">+</NativeControl><NativeControl label="Automation arm">⌘</NativeControl><NativeControl label="Re-enable automation">←</NativeControl><NativeControl label="Session record">○</NativeControl></div>
    <div className="transport-loop transport-group"><output className="position-field" title="Loop position requires native transport">— . — . —</output><NativeControl label="Punch in">⌁</NativeControl><NativeControl label="Loop"><Icon name="loop" size={13} /></NativeControl><NativeControl label="Punch out">⌁</NativeControl><output className="position-field" title="Loop length requires native transport">— . — . —</output></div>
    <div className="transport-spacer" />
    <div className="transport-system"><NativeControl label="Draw mode">✎</NativeControl><NativeControl label="Computer MIDI keyboard">▥</NativeControl><NativeControl label="Key mapping">Key</NativeControl><NativeControl label="MIDI mapping">MIDI</NativeControl><output title="Native engine sample rate unavailable">— kHz</output><output title="Native engine CPU reading unavailable">— %</output><span className="cpu-meter" /></div>
    </> : mode === 'expressions' && nativeTransport?.content ? <NativeTransportBar source={nativeTransport} />
      : <div className="world-transport-reading"><span>{mode === 'expressions' ? 'Expressions' : 'Technē'}</span>{sceneName && <span>{sceneName}</span>}</div>}
    <nav className="surface-icons" aria-label="Working surface">
      {(['session', 'arrangement'] as const).map(value => <button key={value} type="button" aria-label={value === 'session' ? 'Session view' : 'Arrangement view'} aria-pressed={mode === 'audio' ? activeCenter !== 'world.settings' && view === value : activeCenter === `native.${value}`} title={`${value === 'session' ? 'Session' : 'Arrangement'} · Tab`} onClick={() => setView(value)}><Icon name={value} size={15} /></button>)}
      {(['expressions', 'techne'] as const).map(value => <button key={value} type="button" aria-label={value === 'expressions' ? 'Expressions' : 'Technē'} aria-pressed={mode === value && activeCenter === 'world.expressions'} title={value === 'expressions' ? 'Expressions · physical body' : 'Technē · knowledge and instruments'} onClick={() => setMode(value)}><Icon name={value} size={17} /></button>)}
      {centerPanels.map(panel => <button key={panel.id} type="button" aria-label={panel.title} aria-pressed={activeCenter === panel.id} title={panel.note ?? panel.title} onClick={() => openCenter(panel.id)}><Icon name={panel.icon ?? 'element'} size={17} /></button>)}
    </nav>
    <button className="chrome-toggle" aria-label="Toggle detail" aria-pressed={detail} onClick={toggleDetail} title="Detail panel · ⌘⌥L">▤</button><button className="chrome-toggle" aria-label="Toggle agents and context" aria-pressed={dock} onClick={toggleDock} title="Agents & context"><Icon name="agents" size={16} /></button>
  </div></header>
}
