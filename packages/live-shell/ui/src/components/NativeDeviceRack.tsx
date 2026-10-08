import {Fragment, useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent} from 'react'
import {sameEditorBasis, type NativeEditorBasis, type NativeEditorChange, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {forceStripDevice, selectedEntity} from './nativeDeviceStripModel'
import {ForceDeviceCard} from './NativeDeviceStrip'
import {NativeFieldHandle} from './NativeFieldHandle'
import {grabOffset, handlePosition, keyboardValue, resetValue, valueFromPoint, valueText, type HandleBinding} from './nativeFieldHandleModel'
import {numberProblem, parseNumberText, soundNumberSpec, steppedValue, type SoundNumberSpec} from './nativeEntityFace.sound'
import {short} from './nativeFieldFaceModel'
import {DEVICE_MIME, afterIdFor, deviceInsertIndex, parseDeviceDrag} from './nativeDrag'
import {activatorChanges, addableDevices, deviceAddChange, deviceNote, deviceOrderChange, deviceRemoveChange, entitySoundControlChange, rackWidgets, reorderWidgetIds,
  LOCKED_OBJECT_NOTE, entityParameterChange, type RackControl, type RackDevice, type RackWidget} from './nativeDeviceRackModel'
import {nativeDeviceSvgPoint, type Apply, type CaptureCurrent} from './nativeDeviceCustody'
import './NativeDeviceRack.css'

export interface NativeDeviceRackProps {
  reading: NativeEditorReading | null
  request: (request: NativeEditorRequest) => Promise<NativeEditorReply>
  onOpen: (device: {scope: 'entity' | 'field'; family: string}) => void
}
type Send = (changes: readonly NativeEditorChange[]) => void
/** The mini bar: a 88-unit track in a 96x18 SVG. The handle moves along it over the parameter's soft range. */
const BAR = {origin: {x: 4, y: 9}, dir: {x: 1, y: 0}, length: 88}
const EMPTY = 'No devices on the rack. + Device adds one; parameters stay active at their defaults.'
const sameTarget = (a: NativeEditorBasis, b: NativeEditorBasis) => a.expression_ref === b.expression_ref && a.scene_ref === b.scene_ref

/** Bottom device rack: the widgets the person added, in order, after the contextual Force card. Parameters stay live whether or not a widget is on the rack.
 * Every commit is one apply on the reading's basis, under one in-flight lock for the whole rack. */
export function NativeDeviceRack({reading, request, onOpen}: NativeDeviceRackProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [gap, setGap] = useState<number | null>(null)
  const inFlight = useRef(false), mounted = useRef(true), live = useRef(reading), dragging = useRef<string | null>(null)
  live.current = reading
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  // A drag that ends anywhere (including outside the rack) clears the insertion line.
  useEffect(() => {const clear = () => setGap(null); window.addEventListener('dragend', clear); window.addEventListener('drop', clear); return () => {window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear)}}, [])
  const locked = busy || !reading || reading.standing.pending
  const send = async (changes: readonly NativeEditorChange[], basis?: NativeEditorBasis): Promise<NativeEditorReply> => {
    const current = live.current
    if (!current) return {ok: false, error: 'Read the native work before editing it.'}
    if (inFlight.current) return {ok: false, error: 'Wait for the current native acknowledgement.'}
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const reply = await request({operation: 'apply', basis: basis ?? current.basis, changes})
      if (mounted.current && !reply.ok) setError(reply.error)
      return reply
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (mounted.current) setError(message)
      return {ok: false, error: message}
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  // A gesture stays current while the same expression and Scene are presented. Plain checks use the exact basis; a reply
  // may carry the basis its own apply produced. A refusal keeps the retained copy on the same Scene.
  const captureCurrent: CaptureCurrent = () => {
    const captured = live.current?.basis ?? null
    return reply => {
      const now = live.current?.basis
      if (!mounted.current || !captured || !now) return false
      if (reply === undefined) return sameEditorBasis(captured, now)
      if (!reply.ok) return sameTarget(captured, now)
      return sameTarget(captured, reply.reading.basis) && sameTarget(captured, now)
    }
  }
  const apply: Apply = (changes, basis) => send(changes, basis)
  const move = (deviceId: string, to: number) => {
    const current = live.current
    if (!current || locked) return
    const ids = current.devices.map(device => device.id), from = ids.indexOf(deviceId)
    if (from < 0 || to < 0 || to >= ids.length || to === from) return
    void send([deviceOrderChange(reorderWidgetIds(ids, from, to))])
  }
  const widgets = reading ? rackWidgets(reading) : []
  const force = reading ? forceStripDevice(reading) : null
  const entity = reading ? selectedEntity(reading) : null
  const choices = reading ? addableDevices(reading) : []
  // A catalogue row dropped on the rack adds one device at the gap under the pointer, after the widget before that gap.
  const isDeviceDrag = (event: DragEvent<HTMLElement>) => !locked && event.dataTransfer.types.includes(DEVICE_MIME)
  const gapAt = (event: DragEvent<HTMLElement>) => deviceInsertIndex(event.clientX,
    [...event.currentTarget.querySelectorAll<HTMLElement>('.native-rack-widgets>li:not(.native-rack-gap)')].map(card => card.getBoundingClientRect()))
  return <div className="native-device-rack" role="region" aria-label="Device rack"
    onDragOver={event => {if (!isDeviceDrag(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setGap(gapAt(event))}}
    onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGap(null)}}
    onDrop={event => {
      if (!isDeviceDrag(event)) return
      event.preventDefault()
      const index = gapAt(event), family = parseDeviceDrag(event.dataTransfer.getData(DEVICE_MIME))
      setGap(null)
      if (family && reading) void send([{kind: 'device-add', family, after_id: afterIdFor(index, reading.devices.map(device => device.id))}])
    }}>
    <div className="native-device-rack-row">
      {force && entity && <ForceDeviceCard device={force} entity={entity} locked={locked} send={changes => void send(changes)} onOpen={onOpen}/>}
      {reading && widgets.length > 0
        ? <ol className="native-rack-widgets" aria-label="Devices on the rack">{widgets.map((widget, index) => <Fragment key={widget.id}>
          {gap === index && <li className="native-rack-gap" aria-hidden="true"/>}
          <li>
          <RackWidgetView widget={widget} index={index} reading={reading} locked={locked} apply={apply} captureCurrent={captureCurrent}
            send={changes => void send(changes)} onOpen={onOpen} move={move} dragging={dragging}/>
          </li>
        </Fragment>)}{gap === widgets.length && <li className="native-rack-gap" aria-hidden="true"/>}</ol>
        : <>{gap !== null && <span className="native-rack-gap" aria-hidden="true"/>}<p className="native-rack-empty">{reading ? EMPTY : 'Open a native Expression to see its devices.'}</p></>}
      <AddDevice choices={choices} locked={locked} onChoose={family => void send([deviceAddChange(family)])}/>
    </div>
    {error && <p className="native-rack-error" role="alert">{error}</p>}
  </div>
}

function RackWidgetView({widget, index, reading, locked, apply, captureCurrent, send, onOpen, move, dragging}: {widget: RackWidget; index: number;
  reading: NativeEditorReading; locked: boolean; apply: Apply; captureCurrent: CaptureCurrent; send: Send;
  onOpen: (device: {scope: 'entity' | 'field'; family: string}) => void; move: (deviceId: string, to: number) => void; dragging: MutableRefObject<string | null>}) {
  const [folded, setFolded] = useState(false)
  if (widget.unavailable) return <div className="native-rack-card is-unavailable" role="group" aria-label={`${widget.family} unavailable`}>
    <header className="native-rack-head">
      <span className="native-rack-family">{widget.family}</span>
      <span className="native-rack-note">not available in this shell</span>
      <button type="button" className="native-rack-remove" aria-label={`Remove ${widget.family} from the rack`} title="Remove from the rack" disabled={locked}
        onClick={() => send([deviceRemoveChange(widget.id)])}><span aria-hidden="true">✕</span></button>
    </header>
  </div>
  const state = widget.on === undefined ? 'unknown' : widget.on ? 'on' : 'off'
  // An entity widget's controls are off while its object is locked; a sound control also needs the object to have a sound.
  const off = locked || widget.locked
  const soundSubmit = (field: 'gain' | 'frequencyHz' | 'waveform') => (value: number | string): Promise<NativeEditorReply> => {
    let change: NativeEditorChange
    try {change = entitySoundControlChange(reading, field, value)} catch (cause) {return Promise.resolve({ok: false, error: cause instanceof Error ? cause.message : String(cause)})}
    return apply([change])
  }
  const blocked = widget.entityCompact.find(row => row.blocked)?.blocked ?? null
  return <div className={`native-rack-card${folded ? ' is-folded' : ''}`} role="group" aria-label={widget.name}
    onDragOver={event => {if (dragging.current) {event.preventDefault(); event.dataTransfer.dropEffect = 'move'}}}
    onDrop={event => {event.preventDefault(); const id = dragging.current; dragging.current = null; if (id) move(id, index)}}>
    <header className="native-rack-head">
      {widget.toggle && <button type="button" className={`native-rack-light is-${state}`} aria-pressed={widget.on} aria-label={`${widget.name} ${state}`}
        title={`Turn ${widget.name} ${widget.on ? 'off' : 'on'}`} disabled={locked}
        onClick={() => {const changes = activatorChanges(widget); if (changes.length) send(changes)}} />}
      <button type="button" className="native-rack-fold" aria-expanded={!folded} aria-label={`${folded ? 'Expand' : 'Fold'} ${widget.name}`}
        onClick={() => setFolded(!folded)}><span aria-hidden="true">{folded ? '▸' : '▾'}</span></button>
      {widget.scope === 'scene'
        ? <span className="native-rack-title" title={widget.name}>{widget.name}</span>
        : <button type="button" className="native-rack-title" title="Open settings" onClick={() => onOpen({scope: widget.scope === 'entity' ? 'entity' : 'field', family: widget.family})}>{widget.name}</button>}
      {/* Dragging is pointer-only; Alt+Left and Alt+Right are the keyboard reorder. Both commit one device-order change. */}
      <span role="button" tabIndex={0} draggable className="native-rack-grip" aria-label={`Reorder ${widget.name}: drag, or Alt+Left or Alt+Right`} title="Drag to reorder"
        onDragStart={event => {dragging.current = widget.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', widget.id)}}
        onDragEnd={() => {dragging.current = null}}
        onKeyDown={event => {if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return; event.preventDefault(); move(widget.id, index + (event.key === 'ArrowLeft' ? -1 : 1))}}>
        <span aria-hidden="true">⋮⋮</span></span>
      <button type="button" className="native-rack-remove" aria-label={`Remove ${widget.name} from the rack`} title="Removes the widget only; parameters keep their values" disabled={locked}
        onClick={() => send([deviceRemoveChange(widget.id)])}><span aria-hidden="true">✕</span></button>
    </header>
    {!folded && <div className="native-rack-body">
      <p className="native-rack-summary" title={widget.summary}>{widget.summary}</p>
      {widget.scope === 'entity' && (widget.target
        ? <p className="native-rack-target" title={`Acts on the selected object: ${widget.target}`}>Target · {widget.target}</p>
        : <p className="native-rack-target is-empty" aria-disabled="true">Select an object to act on it</p>)}
      {widget.scope === 'scene' && widget.target && <p className="native-rack-target">Scene · {widget.target}</p>}
      {widget.locked && <p className="native-rack-target is-empty">{LOCKED_OBJECT_NOTE}</p>}
      {blocked && !widget.locked && <p className="native-rack-target is-empty">{blocked}</p>}
      {widget.compact.length > 0 && <div className="native-rack-controls">{widget.compact.map(control => widget.scope === 'entity'
        ? <EntityScrub key={control.path} binding={control} value={control.value} disabled={off} submit={value => apply([entityParameterChange(control.path, value)])}/>
        : <CompactControl key={control.path} control={control} family={widget.family} reading={reading} disabled={off} apply={apply} captureCurrent={captureCurrent}/>)}</div>}
      {widget.entityCompact.length > 0 && <div className="native-rack-controls">{widget.entityCompact.map(row => {
        const disabledRow = off || row.blocked !== null
        if (row.field === 'waveform') return <EntitySelect key="waveform" label="Waveform" value={row.value} options={row.options} disabled={disabledRow} submit={soundSubmit('waveform')}/>
        if (row.field === 'frequencyHz') return <EntityNumber key="frequencyHz" spec={soundNumberSpec('frequencyHz')} value={row.control.value} disabled={disabledRow} submit={soundSubmit('frequencyHz')}/>
        return <EntityScrub key="gain" binding={row.control} value={row.control.value} disabled={disabledRow} submit={soundSubmit('gain')}/>
      })}</div>}
      {widget.actions && widget.actions.length > 0 && <div className="native-rack-actions" role="group" aria-label={`${widget.name} actions`}>
        {widget.actions.map(action => <button key={action.label} type="button" className="native-rack-action" title={action.disabled ?? action.title}
          disabled={off || action.disabled !== null} onClick={() => send(action.changes)}>{action.label}</button>)}</div>}
    </div>}
  </div>
}

/** One compact control: label above, a 96x18 bar hosting the real NativeFieldHandle, and the live value beside it. */
function CompactControl({control, family, reading, disabled, apply, captureCurrent}: {control: RackControl; family: string; reading: NativeEditorReading;
  disabled: boolean; apply: Apply; captureCurrent: CaptureCurrent}) {
  const [draft, setDraft] = useState<number | null>(null)
  const shown = draft ?? control.value, end = handlePosition(control, BAR, shown)
  return <div className="native-rack-control">
    <span className="native-rack-label">{control.label}</span>
    <div className="native-rack-control-row">
      <svg className="native-rack-bar" width="96" height="18" viewBox="0 0 96 18">
        <line className="native-rack-track" x1={BAR.origin.x} y1="9" x2={BAR.origin.x + BAR.length} y2="9" />
        <line className="native-rack-fill" x1={BAR.origin.x} y1="9" x2={end.x} y2={end.y} />
        <NativeFieldHandle reading={reading} path={control.path} family={family} geometry={BAR} disabled={disabled} apply={apply}
          captureCurrent={captureCurrent} onDraft={(_path, value) => setDraft(value)} shape="bar" label={control.label} />
      </svg>
      <output className="native-rack-value">{short(shown)}{control.unit ? ` ${control.unit}` : ''}</output>
    </div>
  </div>
}

/** A committed entity value the owner has not acknowledged yet. The control holds it until the reply: an ok clears it, a refusal keeps it for Retry or Discard.
 * Entity gestures have no shared private-draft custody family, so this held value lives only in its control. */
function useHeldCommit<T extends number | string>(submit: (next: T) => Promise<NativeEditorReply>) {
  const [held, setHeld] = useState<T | null>(null), [refused, setRefused] = useState(false), mounted = useRef(true)
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  const commit = (next: T) => {
    setHeld(next); setRefused(false)
    void submit(next).then(reply => {if (mounted.current) {if (reply.ok) setHeld(null); else setRefused(true)}})
  }
  const retry = () => {if (held !== null) commit(held)}
  const discard = () => {setHeld(null); setRefused(false)}
  return {held, refused, commit, retry, discard}
}

/** Retry and Discard for a refused entity control. The owner's text is the rack's role=alert line. */
function HeldNotice({label, refused, disabled, retry, discard}: {label: string; refused: boolean; disabled: boolean; retry: () => void; discard: () => void}) {
  if (!refused) return null
  return <div className="native-rack-held" role="group" aria-label={`${label} not applied`}>
    <span className="native-rack-note">Not applied</span>
    <button type="button" className="native-rack-held-action" aria-label={`Retry ${label}`} disabled={disabled} onClick={retry}>Retry</button>
    <button type="button" className="native-rack-held-action" aria-label={`Discard ${label}`} onClick={discard}>Discard</button>
  </div>
}

/** An entity mini bar (96x18, the Field bar's geometry). A drag keeps a LOCAL value and commits ONE apply on release; Escape cancels the drag.
 * Arrows (x10 with Shift), PageUp/PageDown and Home (the binding default) each commit one apply. A click without a move commits nothing. */
function EntityScrub({binding, value, disabled, submit}: {binding: HandleBinding; value: number; disabled: boolean; submit: (value: number) => Promise<NativeEditorReply>}) {
  const held = useHeldCommit<number>(submit), [dragging, setDragging] = useState<number | null>(null)
  const gesture = useRef<{pointer: number; offset: number; value: number; moved: boolean} | null>(null), element = useRef<SVGSVGElement>(null)
  const shown = dragging ?? held.held ?? value, end = handlePosition(binding, BAR, shown)
  const point = (event: {clientX: number; clientY: number}) => nativeDeviceSvgPoint(event, element.current?.getScreenCTM() ?? null)
  const release = (pointer: number) => {if (element.current?.hasPointerCapture(pointer)) element.current.releasePointerCapture(pointer)}
  const cancel = () => {const edit = gesture.current; gesture.current = null; setDragging(null); if (edit) release(edit.pointer)}
  const finish = (pointer: number) => {
    const edit = gesture.current
    if (!edit || edit.pointer !== pointer) return
    cancel()
    if (!edit.moved) return
    if (edit.value === value) held.discard()
    else held.commit(edit.value)
  }
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || gesture.current || event.button !== 0) return
    const at = point(event)
    if (!at) return
    event.preventDefault(); element.current?.setPointerCapture(event.pointerId); element.current?.focus()
    gesture.current = {pointer: event.pointerId, offset: grabOffset(binding, BAR, shown, at), value: shown, moved: false}
    setDragging(shown)
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const edit = gesture.current
    if (!edit || edit.pointer !== event.pointerId) return
    const at = point(event)
    if (!at) return
    edit.value = valueFromPoint(binding, BAR, at, edit.offset); edit.moved = true
    setDragging(edit.value)
  }
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      if (gesture.current) {event.preventDefault(); cancel()}
      else if (held.held !== null) {event.preventDefault(); held.discard()}
      return
    }
    if (disabled) return
    const next = event.key === 'Home' ? resetValue(binding) : keyboardValue(binding, shown, event.key, event.shiftKey)
    if (next === null || next === shown) return
    event.preventDefault(); held.commit(next)
  }
  return <div className={`native-rack-control${held.refused ? ' is-refused' : ''}`}>
    <span className="native-rack-label">{binding.label}</span>
    <div className="native-rack-control-row">
      <svg ref={element} className="native-rack-bar" width="96" height="18" viewBox="0 0 96 18" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={binding.label} aria-valuemin={binding.hardMin} aria-valuemax={binding.hardMax} aria-valuenow={shown} aria-valuetext={valueText(binding, shown)} aria-disabled={disabled}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={event => finish(event.pointerId)} onPointerCancel={cancel}
        onLostPointerCapture={event => {if (gesture.current?.pointer === event.pointerId) cancel()}} onKeyDown={onKeyDown}>
        <title>{valueText(binding, shown)}</title>
        <line className="native-rack-track" x1={BAR.origin.x} y1="9" x2={BAR.origin.x + BAR.length} y2="9" />
        <line className="native-rack-fill" x1={BAR.origin.x} y1="9" x2={end.x} y2={end.y} />
        <circle className="native-rack-knob" cx={end.x} cy={end.y} r={4.5} />
      </svg>
      <output className="native-rack-value">{short(shown)}{binding.unit ? ` ${binding.unit}` : ''}</output>
    </div>
    <HeldNotice label={binding.label} refused={held.refused} disabled={disabled} retry={held.retry} discard={held.discard}/>
  </div>
}

/** A numeric sound field as a stepper: − and + each commit one step (Shift x10). Typed text commits on Enter or blur, once the validator's bounds accept it. */
function EntityNumber({spec, value, disabled, submit}: {spec: SoundNumberSpec; value: number; disabled: boolean; submit: (value: number) => Promise<NativeEditorReply>}) {
  const held = useHeldCommit<number>(submit), [typed, setTyped] = useState<string | null>(null), [problem, setProblem] = useState<string | null>(null)
  const shown = held.held ?? value
  const commitTyped = () => {
    if (typed === null) return
    const next = parseNumberText(typed), text = numberProblem(spec, next)
    setProblem(text)
    if (text) return
    setTyped(null)
    if (next !== value) held.commit(next)
  }
  const step = (direction: 1 | -1, shift: boolean) => {
    setTyped(null); setProblem(null)
    const next = steppedValue(spec, shown, direction, shift)
    if (next !== null) held.commit(next)
  }
  const unit = spec.unit && !spec.unit.startsWith('(') ? ` ${spec.unit}` : ''
  return <div className={`native-rack-control${held.refused ? ' is-refused' : ''}`}>
    <span className="native-rack-label">{spec.label}</span>
    <div className="native-rack-control-row native-rack-stepper">
      <button type="button" className="native-rack-step" aria-label={`Decrease ${spec.label}`} disabled={disabled} onClick={() => step(-1, false)}>−</button>
      <input type="number" className="native-rack-number" aria-label={spec.label} min={spec.min} max={spec.max} step={spec.step} disabled={disabled}
        aria-invalid={problem !== null} value={typed ?? String(shown)} onChange={event => setTyped(event.target.value)} onBlur={commitTyped}
        onKeyDown={event => {
          if (event.key === 'Enter') {event.preventDefault(); commitTyped()}
          else if (event.key === 'Escape') {setTyped(null); setProblem(null)}
          else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {event.preventDefault(); step(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)}
        }}/>
      <button type="button" className="native-rack-step" aria-label={`Increase ${spec.label}`} disabled={disabled} onClick={() => step(1, false)}>+</button>
      <output className="native-rack-value">{unit.trim()}</output>
    </div>
    {problem && <p className="native-rack-note native-rack-problem">{problem}</p>}
    <HeldNotice label={spec.label} refused={held.refused} disabled={disabled} retry={held.retry} discard={held.discard}/>
  </div>
}

/** A sound's waveform choice: one whole-sound change per selection. */
function EntitySelect({label, value, options, disabled, submit}: {label: string; value: string; options: readonly string[]; disabled: boolean;
  submit: (value: string) => Promise<NativeEditorReply>}) {
  const held = useHeldCommit<string>(submit), shown = held.held ?? value
  return <div className={`native-rack-control${held.refused ? ' is-refused' : ''}`}>
    <span className="native-rack-label">{label}</span>
    <select className="native-rack-select" aria-label={label} value={shown} disabled={disabled} onChange={event => held.commit(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
    <HeldNotice label={label} refused={held.refused} disabled={disabled} retry={held.retry} discard={held.discard}/>
  </div>
}

/** '+ Device': a small role=menu of the addable devices. Choosing one sends one device-add (appended to the rack). */
function AddDevice({choices, locked, onChoose}: {choices: readonly RackDevice[]; locked: boolean; onChoose: (family: string) => void}) {
  const [open, setOpen] = useState(false), [anchor, setAnchor] = useState<{left: number; bottom: number} | null>(null)
  const button = useRef<HTMLButtonElement>(null), wrap = useRef<HTMLDivElement>(null), items = useRef<(HTMLButtonElement | null)[]>([])
  const pending = useRef<'first' | 'last'>('first'), menuId = useId()
  const off = locked || choices.length === 0
  const show = (which: 'first' | 'last') => {
    if (off) return
    const rect = button.current?.getBoundingClientRect()
    pending.current = which
    // The menu is fixed to the viewport so the rack's horizontal scroll box cannot clip it.
    if (rect) setAnchor({left: rect.left, bottom: window.innerHeight - rect.top + 4})
    setOpen(true)
  }
  useEffect(() => {if (open) items.current[pending.current === 'last' ? choices.length - 1 : 0]?.focus()}, [open])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {if (!wrap.current?.contains(event.target as Node)) setOpen(false)}
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {if (off) setOpen(false)}, [off])
  const menuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = items.current.indexOf(document.activeElement as HTMLButtonElement), last = choices.length - 1
    const go = (next: number) => {event.preventDefault(); items.current[next]?.focus()}
    if (event.key === 'ArrowDown') go(at < 0 || at >= last ? 0 : at + 1)
    else if (event.key === 'ArrowUp') go(at <= 0 ? last : at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(last)
    else if (event.key === 'Escape') {event.preventDefault(); setOpen(false); button.current?.focus()}
    else if (event.key === 'Tab') setOpen(false)
  }
  return <div ref={wrap} className="native-rack-add-wrap">
    <button ref={button} type="button" className="native-rack-add" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={off}
      title={choices.length ? 'Add a device to the rack' : 'Every device is already on the rack'}
      onClick={() => open ? setOpen(false) : show('first')}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        if (open) items.current[event.key === 'ArrowUp' ? choices.length - 1 : 0]?.focus()
        else show(event.key === 'ArrowUp' ? 'last' : 'first')
      }}>+ Device</button>
    {open && anchor && <div id={menuId} className="native-rack-menu" role="menu" aria-label="Add a device" style={{left: anchor.left, bottom: anchor.bottom}} onKeyDown={menuKey}>
      {choices.map((device, index) => <button key={device.family} ref={element => {items.current[index] = element}} type="button" role="menuitem" tabIndex={-1}
        className="native-rack-menuitem" onClick={() => {setOpen(false); button.current?.focus(); onChoose(device.family)}}>
        <span className="native-rack-menuitem-name">{device.name}</span>
        <span className="native-rack-menuitem-note">{deviceNote(device)}</span>
      </button>)}
    </div>}
  </div>
}
