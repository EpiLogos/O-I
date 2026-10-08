import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SetSummary } from '../shell/useSet'
import { displayDeviceName, type SetDocument } from '../shell/document'
import type { SetSelection } from './SessionView'
import {createNativeCompositionPresentationGuard, nativeSourceLanes, readNativeSourceTimeline, type CompositionViewSource, type NativeCompositionViewSource} from '../shell/compositionViews'
import {NativeSceneTransport} from './NativeSceneTransport'
import {NativeSceneOverview} from './NativeSceneOverview'
import {sceneFocused, sceneLoopControl} from './nativeScenePlayback'
import {NativeArrangementTimeline, arrangementEditEffect, type ArrangementEdit} from './nativeArrangementTimeline'
import {NativeArrangementAbsences} from './nativeArrangementAbsences'
import type {NativeGlyphClipSource} from '../shell/nativeContent'
import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import './NativeCompositionViews.css'
import './nativeArrangement.css'
export function ArrangementView({ set, document, selection, select, colors, native, compactTransport }: {
  set: SetSummary | null; document: SetDocument | null; selection: SetSelection; select: (value: SetSelection) => void; colors: string[]
  native?: NativeCompositionViewSource
  /** The header transport bar is present: the in-view Scene transport keeps only what the bar lacks. */
  compactTransport?: boolean
}) {
  const [offset, setOffset] = useState(0)
  const [zoom, setZoom] = useState(1)
  const ruler = useRef<HTMLDivElement>(null)
  const drag = useRef<{x: number; y: number; offset: number; zoom: number} | null>(null)
  const [laneWidth, setLaneWidth] = useState(1)
  useEffect(() => {
    const node = ruler.current
    if (!node) return
    const measure = () => setLaneWidth(node.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(node); measure()
    return () => observer.disconnect()
  }, [set?.path, native?.owner])
  const scale = 230 / 32 * zoom
  const lastBeat = Math.max(128, ...(document?.tracks.flatMap(track => track.arrangementClips.map(clip => clip.end)) ?? []))
  useEffect(() => {
    // A wider viewport or a shorter owner document may invalidate the old
    // view offset. Keep the overview and lanes on the same bounded window.
    setOffset(value => Math.max(0, Math.min(Math.max(0, lastBeat - laneWidth / scale), value)))
  }, [lastBeat, laneWidth, scale])
  const source: CompositionViewSource = native ?? {owner: 'live-set', set, document}
  if (source.owner === 'expressions') return <NativeSourceArrangement source={source} compactTransport={compactTransport}/>
  if (!set) return <div className="view-empty">Open a Live set from the browser.</div>
  const visibleBeats = Math.min(lastBeat, laneWidth / scale)
  const clampOffset = (value: number, nextScale = scale) => Math.max(0, Math.min(Math.max(0, lastBeat - laneWidth / nextScale), value))
  const move = (value: number) => setOffset(clampOffset(value))
  const zoomAt = (value: number, fraction = .5) => {
    const next = Math.max(.125, Math.min(8, value))
    const beat = offset + visibleBeats * fraction
    setZoom(next)
    setOffset(clampOffset(beat - laneWidth / (230 / 32 * next) * fraction, 230 / 32 * next))
  }
  const reading = (label: string) => <input aria-label={label} title="Value not disclosed by the document owner" readOnly value="—" />
  return <div className="arrange-view">
    <div className="arrange-overview" role="slider" tabIndex={0} aria-label="Arrangement overview" aria-valuemin={0} aria-valuemax={Math.max(0, lastBeat - visibleBeats)} aria-valuenow={offset} aria-valuetext={`Beats ${Number((offset + 1).toFixed(3))}–${Number(Math.min(lastBeat, offset + visibleBeats + 1).toFixed(3))}`} title="Arrangement overview · drag to traverse, drag vertically or scroll to zoom · arrows to navigate, ↑↓ to zoom" onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const bounds = event.currentTarget.getBoundingClientRect()
      const beat = (event.clientX - bounds.left) / bounds.width * lastBeat
      const start = beat >= offset && beat <= offset + visibleBeats ? offset : clampOffset(beat - visibleBeats / 2)
      setOffset(start)
      drag.current = {x: event.clientX, y: event.clientY, offset: start, zoom}
    }} onPointerMove={event => {
      const start = drag.current
      if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return
      const nextZoom = Math.max(.125, Math.min(8, start.zoom * Math.pow(2, (start.y - event.clientY) / 120)))
      const bounds = event.currentTarget.getBoundingClientRect()
      setZoom(nextZoom)
      setOffset(clampOffset(start.offset + (event.clientX - start.x) / bounds.width * lastBeat, 230 / 32 * nextZoom))
    }} onPointerUp={() => {drag.current = null}} onPointerCancel={() => {drag.current = null}} onWheel={event => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) move(offset + (event.deltaX || event.deltaY) / scale)
      else {const bounds = event.currentTarget.getBoundingClientRect(); zoomAt(zoom * Math.pow(2, -event.deltaY / 240), Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)))}
    }} onKeyDown={event => {
      if (event.key === 'ArrowLeft') {event.preventDefault(); move(offset - visibleBeats / 10)}
      if (event.key === 'ArrowRight') {event.preventDefault(); move(offset + visibleBeats / 10)}
      if (event.key === 'ArrowUp' || event.key === '+') {event.preventDefault(); zoomAt(zoom * 2)}
      if (event.key === 'ArrowDown' || event.key === '-') {event.preventDefault(); zoomAt(zoom / 2)}
      if (event.key === 'Home') {event.preventDefault(); move(0)}
      if (event.key === 'End') {event.preventDefault(); move(lastBeat)}
    }}>{document?.tracks.flatMap((track, index) => track.arrangementClips.map((clip, i) => <span key={`${index}:${i}`} style={{ left: `${clip.start / lastBeat * 100}%`, width: `${Math.max(.1, (clip.end - clip.start) / lastBeat * 100)}%`, top: `${index / document.tracks.length * 12}px`, background: colors[index] }} />))}<div className="arrange-overview-window" style={{left:`${offset / lastBeat * 100}%`,width:`${visibleBeats / lastBeat * 100}%`}} /></div>
    <div className="arrange-ruler-row"><div className="arrange-ruler" ref={ruler}><div style={{ transform: `translateX(${-offset * scale}px)` }}>{Array.from({ length: Math.ceil(lastBeat / 32) + 1 }, (_, i) => <span key={i} style={{ width: scale * 32 }}>{1 + i * 32}</span>)}</div><div className="arrange-loop-brace" title="Loop points await native transport" /></div><div className="arrange-header-space"><button disabled title="Locator writing requires native document editing">Set</button><button disabled title="Automation editing requires native device editing">●</button></div></div>
    <div className="arrange-scroll">{set.tracks.map((track, index) => <div key={index} className={'arrange-row' + (selection.track === index ? ' is-selected' : '')} style={{ '--track-color': colors[index], '--beat-spacing': `${scale * 8}px` } as CSSProperties}>
      <div className="arrange-lane" style={{ backgroundPositionX: -offset * scale }} onClick={() => select({ track: index, scene: null })} title={document ? undefined : 'Clip positions await the document owner'}>
        {document?.tracks[index].arrangementClips.map((clip, i) => <button key={i} className={'arrange-clip ' + clip.kind + (selection.track === index && selection.clip === i ? ' selected-clip' : '')} style={{ left: (clip.start - offset) * scale, width: Math.max(3, (clip.end - clip.start) * scale) }} title={`${clip.name} · ${clip.kind} · beats ${clip.start}–${clip.end}`} onClick={event => { event.stopPropagation(); select({ track: index, scene: null, clip: i }) }}><span className="clip-caption">{clip.name || (clip.kind === 'midi' ? 'MIDI clip' : 'Audio clip')}</span><span className="clip-type">{clip.kind === 'audio' ? 'Audio' : 'MIDI'}</span></button>)}
      </div><div className="arrange-lane-label"><div className="arrange-track-identity"><button className="track-header track-name" onClick={() => select({ track: index, scene: null })} title={track.name}><span className="track-fold">▸</span>{track.name}</button><select aria-label={`Device for ${track.name}`} disabled title="Select a device from the bottom chain"><option>{displayDeviceName(track.devices[0] ?? 'Mixer')}</option></select><select disabled aria-label={`Automation parameter for ${track.name}`} title="Automation owner has not landed"><option>—</option></select></div>
        <div className="arrange-routing"><select aria-label={`Input for ${track.name}`} disabled title="Routing unavailable"><option>—</option></select><select aria-label="Input channel" disabled><option>—</option></select><div className="monitor-options">{['In', 'Auto', 'Off'].map(label => <button key={label} disabled>{label}</button>)}</div><select disabled aria-label="Audio To"><option>—</option></select></div>
        <div className="arrange-mixer"><div><button className="track-number" onClick={() => select({ track: index, scene: null })}>{track.kind === 'return' ? track.name.split('-')[0] : track.kind === 'master' ? 'Main' : index + 1}</button><button disabled title="Solo requires native mixer">S</button><button disabled title="Arm requires native transport">●</button></div><div>{reading('Volume')}{reading('Pan')}</div><div>{reading('Send A')}{reading('Send B')}</div></div>
      </div></div>)}</div>

  </div>
}

function NativeSourceArrangement({source, compactTransport}: {source: NativeCompositionViewSource; compactTransport?: boolean}) {
  const [clock, setClock] = useState<'seconds' | 'morph'>('seconds')
  const [fault, setFault] = useState<string | null>(null)
  const latest = useRef(source); latest.current = source
  const presentation = useRef(createNativeCompositionPresentationGuard()).current
  useEffect(() => presentation.mount(), [presentation])
  const content = source.content
  useEffect(() => {setFault(null)}, [content?.basis.expression_ref, content?.basis.scene_ref])
  if (!content) return <div className="view-empty">The native composition reading is unavailable.</div>
  let lanes: ReturnType<typeof nativeSourceLanes>
  try {lanes = nativeSourceLanes(content)} catch (cause) {return <div className="view-empty" role="alert">{cause instanceof Error ? cause.message : String(cause)}</div>}
  const clocks = [...new Set(lanes.map(lane => lane.source.timing.clock))]
  const activeClock = clocks.includes(clock) ? clock : clocks[0] ?? 'seconds'
  const timeline = readNativeSourceTimeline(content, activeClock)
  const ready = !!source.actions && !content.standing.pending
  // The loop value is the owner's reading; the toggle is the Scene editor's loop intent.
  const loopControl = sceneLoopControl({loop: content.scenes?.loop === true, ready, focused: sceneFocused(content.native_selection, content.basis.scene_ref),
    savedAvailable: !!content.scenes?.timing.saved.available})
  const toggleLoop = () => {const actions = source.actions; if (actions && !loopControl.reason) void settle(() => actions.setSceneLoop(!loopControl.on))}
  const settle = async (effect: () => Promise<NativeEditorReply>, reveal: boolean|'source'|'layers'|'placement' = false) => {
    const captured = source
    const current = presentation.capture(captured)
    try {
      const result = await effect()
      if (!current(latest.current, result)) return
      setFault(result.ok ? null : result.error)
      if (result.ok && reveal===true) captured.revealDetail('clip',undefined,result.reading.basis)
      if (result.ok && typeof reveal==='string') captured.revealNativeEditor?.(reveal,result.reading.basis)
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      if (current(latest.current, {ok: false, error})) setFault(error)
    }
  }
  // Every timeline gesture maps to one existing owner request on the captured basis.
  const perform = (clip: NativeGlyphClipSource, edit: ArrangementEdit): Promise<void> => {
    const {effect, reveal} = arrangementEditEffect(source, clip, edit);
    return settle(effect, reveal);
  }
  return <div className="arrange-view native-composition"><NativeSceneTransport source={source} compact={compactTransport}/>
    <NativeSceneOverview source={source}/>
    <div className="native-composition-caption"><strong>{content.scene.name}</strong><span>Glyph source timing · {timeline.unit}</span>
      {clocks.length > 1 && <nav className="native-clock-tabs" aria-label="Source timing clock">{clocks.map(value => <button key={value} aria-pressed={activeClock === value} onClick={() => setClock(value)}>{value === 'seconds' ? 'Seconds' : 'Morph cycles'}</button>)}</nav>}
      {fault && <span role="alert">{fault}</span>}</div>
    <NativeArrangementTimeline key={`${content.basis.expression_ref}|${content.basis.scene_ref}|${activeClock}`} content={content} clock={activeClock} unit={timeline.unit} duration={timeline.duration} lanes={timeline.lanes} ready={ready} perform={perform} loop={{on: loopControl.on, reason: loopControl.reason, toggle: toggleLoop}}/>
    {!timeline.lanes.length && <div className="view-empty">This Scene has no Glyph sources.</div>}
    <NativeArrangementAbsences/>
  </div>
}
