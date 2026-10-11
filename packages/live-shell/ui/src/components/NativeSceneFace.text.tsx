import {useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {TEXT_LAYER_BUDGET, TEXT_MAX_LENGTH, TEXT_NUMERIC_RANGE, type NativeSceneTextChange} from '../../../../expressions-boundary/src/sceneMaterialEdits'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import {
  TEXT_CONTROL_LABELS, TEXT_NUMERIC_CONTROLS, addLayerChange, addLayerProblem, alignChange, clampPosition, dragPosition, fieldChange, keyStep,
  layerTitle, pagePreview, positionChange, removeLayerChange, visibleChange, type TextControl, type TextLayer,
} from './nativeSceneFace.text.ts'
import './NativeSceneFace.text.css'

type Fault = {message: string; retry: readonly NativeSceneTextChange[]}
type Drag = {layerId: string; x: number; y: number}
type Start = {layerId: string; clientX: number; clientY: number; origin: {x: number; y: number}; pageWidth: number; pageHeight: number}
const omit = <T,>(record: Record<string, T>, key: string): Record<string, T> => {const next = {...record}; delete next[key]; return next}

/** The Page text device's whole expanded panel: layer list with visibility, one selected layer's exact-value controls, and a page preview
 * whose handle drags the selected layer's X/Y. Every write is one text-layer change through `apply`; refusals keep the draft. */
export function TextPanel({reading, apply, disabled}: SceneFacePanelProps) {
  const layers = reading.scene.text
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = layers.find(layer => layer.id === selectedId) ?? layers[0] ?? null
  const [busy, setBusy] = useState(false), [fault, setFault] = useState<Fault | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({}), [problems, setProblems] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const inFlight = useRef(false), dragRef = useRef<Drag | null>(null), start = useRef<Start | null>(null), page = useRef<HTMLDivElement>(null)
  const locked = disabled || busy || reading.standing.pending
  const hold = (next: Drag | null) => {dragRef.current = next; setDrag(next)}

  // One change per call, one in flight at a time. Success clears the drafts; a refusal keeps them with the reason for Retry or Discard.
  const send = async (changes: readonly NativeSceneTextChange[]): Promise<boolean> => {
    if (inFlight.current || disabled || reading.standing.pending || !changes.length) return false
    inFlight.current = true; setBusy(true); setFault(null)
    try {
      const reply = await apply([...changes])
      if (reply.ok) {setDrafts({}); setProblems({}); hold(null); return true}
      setFault({message: reply.error, retry: changes}); return false
    } catch (cause) {
      setFault({message: cause instanceof Error ? cause.message : String(cause), retry: changes}); return false
    } finally {inFlight.current = false; setBusy(false)}
  }
  const commitField = (layer: TextLayer, control: TextControl, raw: string) => {
    if (inFlight.current) return
    const key = `${layer.id}:${control}`, result = fieldChange(layer, control, raw)
    if (result.problem) {setProblems(current => ({...current, [key]: result.problem!})); return}
    setProblems(current => omit(current, key))
    if (!result.change) {setDrafts(current => omit(current, key)); return}
    void send([result.change])
  }
  const revertField = (key: string) => {setDrafts(current => omit(current, key)); setProblems(current => omit(current, key))}

  // The page handle: pointer drag keeps a local draft; pointer-up sends one text-layer-set for both coordinates.
  const down = (event: PointerEvent<HTMLButtonElement>, layer: TextLayer) => {
    if (locked || !page.current) return
    const box = page.current.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = {layerId: layer.id, clientX: event.clientX, clientY: event.clientY, origin: {x: layer.x, y: layer.y}, pageWidth: box.width, pageHeight: box.height}
    hold({layerId: layer.id, x: layer.x, y: layer.y})
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = start.current
    if (!current) return
    hold({layerId: current.layerId, ...dragPosition(current.origin, current, event, {width: current.pageWidth, height: current.pageHeight})})
  }
  const up = (layer: TextLayer) => {
    const current = start.current, final = dragRef.current
    start.current = null
    if (!current || !final) {hold(null); return}
    const change = positionChange(layer, final.x, final.y)
    if (!change) {hold(null); return}
    void send([change])
  }
  const keyOnHandle = (event: KeyboardEvent<HTMLButtonElement>, layer: TextLayer) => {
    if (event.key === 'Escape' && (start.current || dragRef.current)) {event.preventDefault(); start.current = null; hold(null); return}
    const step = keyStep(event.key, event.shiftKey)
    if (!step || locked) return
    event.preventDefault()
    const live = dragRef.current
    const base = live && live.layerId === layer.id ? live : {x: layer.x, y: layer.y}
    const change = positionChange(layer, clampPosition(base.x + step.x), clampPosition(base.y + step.y))
    if (change) void send([change])
  }

  const field = (layer: TextLayer, control: TextControl) => {
    const key = `${layer.id}:${control}`, label = TEXT_CONTROL_LABELS[control], problem = problems[key]
    const text = drafts[key] ?? String(layer[control])
    const shared = {id: key, 'aria-label': label, 'aria-invalid': problem ? true : undefined, 'aria-describedby': problem ? `${key}-bounds` : undefined,
      disabled: locked, value: text,
      onBlur: () => commitField(layer, control, text),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        // Escape reverts only; blurring here would commit the stale draft from this render.
        if (event.key === 'Escape') {event.preventDefault(); revertField(key)}
        else if (event.key === 'Enter' && event.currentTarget.tagName === 'INPUT') {event.preventDefault(); commitField(layer, control, text)}
      }}
    const numeric = (TEXT_NUMERIC_CONTROLS as readonly string[]).includes(control)
    const range = numeric ? TEXT_NUMERIC_RANGE[control as keyof typeof TEXT_NUMERIC_RANGE] : null
    const onChange = (event: {target: {value: string}}) => setDrafts(current => ({...current, [key]: event.target.value}))
    return <label className="native-text-face-field" key={key}>
      <span>{label}</span>
      {control === 'body' ? <textarea {...shared} rows={4} maxLength={TEXT_MAX_LENGTH.body} onChange={onChange}/>
        : <input {...shared} type={numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : undefined} min={range?.[0]} max={range?.[1]}
          step={control === 'x' || control === 'y' ? 0.01 : undefined}
          maxLength={numeric ? undefined : TEXT_MAX_LENGTH[control as keyof typeof TEXT_MAX_LENGTH]} onChange={onChange}/>}
      {problem && <small id={`${key}-bounds`} className="native-text-face-bounds">{problem}</small>}
    </label>
  }

  const addProblem = addLayerProblem(layers)
  const previewLayers = drag ? layers.map(layer => layer.id === drag.layerId ? {...layer, x: drag.x, y: drag.y} : layer) : layers
  const boxes = pagePreview(previewLayers), past = boxes.filter(box => box.past).length
  const handleBox = selected ? boxes.find(box => box.id === selected.id) : undefined
  const handleX = drag && selected && drag.layerId === selected.id ? drag.x : selected?.x ?? 0
  const handleY = drag && selected && drag.layerId === selected.id ? drag.y : selected?.y ?? 0
  return <div className="native-text-face" aria-label="Page text">
    <section className="native-text-face-section" aria-labelledby="native-text-layers-title">
      <header><h3 id="native-text-layers-title">Text layers</h3><span>{layers.length} / {TEXT_LAYER_BUDGET}</span></header>
      <div className="native-text-face-actions">
        <button type="button" disabled={locked || !!addProblem} title={addProblem ?? 'Add a text block to this Scene'} onClick={() => void send([addLayerChange()])}>+ Add layer</button>
        <button type="button" disabled={locked || !selected} title={selected ? `Remove ${layerTitle(selected)} from this Scene` : 'Choose a layer first'}
          onClick={() => selected && void send([removeLayerChange(selected.id)])}>Remove layer</button>
      </div>
      {layers.length
        ? <ol className="native-text-face-layers" aria-label="Text layers in stacking order">{layers.map((layer, index) => <li key={layer.id}>
          <button type="button" className={`native-text-face-layer${layer.id === selected?.id ? ' is-selected' : ''}`} aria-pressed={layer.id === selected?.id}
            onClick={() => setSelectedId(layer.id)}><span>{index + 1}. {layerTitle(layer)}</span>{!layer.visible && <small>hidden</small>}</button>
          <label className="native-text-face-show"><input type="checkbox" aria-label={`Show ${layerTitle(layer)}`} checked={layer.visible} disabled={locked}
            onChange={event => {const change = visibleChange(layer, event.currentTarget.checked); if (change) void send([change])}}/><span>Show</span></label>
        </li>)}</ol>
        : <p className="native-text-face-empty">This Scene has no text layers. Add one to place words on the page.</p>}
      <small>Order follows the Scene's stacking. Reordering layers is not writable from the shell yet.</small>
    </section>

    <section className="native-text-face-section" aria-labelledby="native-text-page-title">
      <header><h3 id="native-text-page-title">Page preview</h3><span>{past ? `${past} clipped at the edge` : 'Reference page 16:9'}</span></header>
      <div ref={page} className="native-text-face-page" role="group" aria-label="Page preview">
        {boxes.map(box => <div key={box.id} className={`native-text-face-box${box.id === selected?.id ? ' is-selected' : ''}${box.past ? ' is-past' : ''}`}
          title={box.past ? `${box.title} runs past the page edge and is clipped` : box.title}
          style={{left: `${box.leftPct}%`, top: `${box.topPct}%`, width: `${box.widthPct}%`, textAlign: box.align, fontSize: `${box.fontCqw}cqw`}}>
          <span className="native-text-face-line">{box.title}</span>{box.italic && <em className="native-text-face-line">{box.italic}</em>}
        </div>)}
        {selected && handleBox && <button type="button" className="native-text-face-handle" disabled={locked}
          aria-label={`Move ${layerTitle(selected)} on the page`} aria-describedby="native-text-position"
          style={{left: `${handleX * 100}%`, top: `${handleY * 100}%`}}
          onPointerDown={event => down(event, selected)} onPointerMove={move} onPointerUp={() => up(selected)}
          onPointerCancel={() => {start.current = null; hold(null)}} onKeyDown={event => keyOnHandle(event, selected)}/>}
      </div>
      <p id="native-text-position" className="native-text-face-readout">{selected ? `${layerTitle(selected)}: X ${handleX.toFixed(2)}, Y ${handleY.toFixed(2)}` : 'No layer selected'}</p>
      <small>Drag the handle, or use the arrow keys (0.01; Shift 0.1). Escape cancels a drag. The page is drawn at 16:9 from the reference stage width, so line breaks and type can differ from the stage. The page drag here follows the inspector range (−0.5 to 1.5); the stage drag clamps to −0.1 to 0.95.</small>
      {fault && <div className="native-text-face-fault" role="alert"><p>{fault.message}</p>
        <button type="button" onClick={() => void send(fault.retry)}>Retry</button>
        <button type="button" onClick={() => {setDrafts({}); setProblems({}); hold(null); setFault(null)}}>Discard</button></div>}
    </section>

    <section className="native-text-face-section" aria-labelledby="native-text-selected-title">
      <header><h3 id="native-text-selected-title">Selected layer</h3><span>{selected ? layerTitle(selected) : 'None'}</span></header>
      {selected ? <div className="native-text-face-form">
        <label className="native-text-face-field"><span>Show this text block</span><input type="checkbox" aria-label="Show this text block" checked={selected.visible} disabled={locked}
          onChange={event => {const change = visibleChange(selected, event.currentTarget.checked); if (change) void send([change])}}/></label>
        {field(selected, 'kicker')}{field(selected, 'title')}{field(selected, 'italic')}{field(selected, 'body')}
        <div className="native-text-face-pair">{field(selected, 'size')}{field(selected, 'width')}</div>
        <label className="native-text-face-field"><span>Alignment</span>
          <select aria-label="Alignment" value={selected.align} disabled={locked}
            onChange={event => {const result = alignChange(selected, event.currentTarget.value); if (result.change) void send([result.change])}}>
            <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
        <div className="native-text-face-pair">{field(selected, 'x')}{field(selected, 'y')}</div>
        <small>Type size 14–150, block width 60–1000, page position −0.5 to 1.5. Values commit on Enter or when you leave the field; Escape reverts.</small>
      </div> : <p className="native-text-face-empty">Add a text block to edit its words, size and place.</p>}
    </section>
  </div>
}
