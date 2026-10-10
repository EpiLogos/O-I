import {useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode} from 'react'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {BarValue, type BarApply} from './NativeBarControls'
import {createLiveSession, type BarValueSession, type LiveRun, type LiveTargets} from './nativeBarSession'
import {barParameter, formatBarValue, stepBarValue} from './nativeBarModel'
import {
  barMacroCreate, barMacroPoints, barMacroRack, barRangeState, barSlots, clampRangeHandle, rangeFraction, rangeValue,
  readHiddenSlots, SEED_SLOTS, writeHiddenSlots, type BarSlot, type BarToggleSpec,
} from './nativeBarSlots'
import {ScopeToggle} from './NativePinControls'
import {settle} from './nativeFieldHandleModel'
import './NativeBarStrip.css'

/** The pinned-controls strip: the owner-approved seed, then the Expression's Field pins, as one row. Every value and toggle is one
 * owner request on the captured reading; the strip keeps no document state. Only the customise choice is kept, per viewer, in the browser. */
type Slot<K extends BarSlot['kind']> = Extract<BarSlot, {kind: K}>
/** One live session per key, created once. Each call reads the latest runner, automation reading and apply, so a re-render never strands a gesture. */
type SessionFor = (key: string, targets: LiveTargets, target: string | null, changesFor: (value: number) => readonly NativeEditorChange[]) => BarValueSession
type Handle = 'min' | 'max'
interface RangeGesture {handle: Handle; pointer: number; session: BarValueSession; value: number}

const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const registryLabel = (path: string) => NATIVE_BINDINGS.find(item => item.path === path)?.label ?? path
const isTransport = (slot: BarSlot) => slot.kind === 'value' && slot.placement === 'transport'
const slotName = (slot: BarSlot) => slot.kind === 'value' ? registryLabel(slot.path) : slot.kind === 'toggle' ? slot.toggle.label : slot.label
const automatedOn = (reading: NativeEditorReading | null, target: string) => !!reading && reading.scene.automation.some(lane => lane.enabled && lane.target === target)
/** The owner call as a promise, so a synchronous throw becomes a refusal rather than an escaped error. */
const send = (apply: BarApply, changes: readonly NativeEditorChange[]) => Promise.resolve().then(() => apply(changes))
const pct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`
const parameterChange = (target: string) => (value: number): NativeEditorChange[] => [{kind: 'parameter', target, value}]

export function BarStrip({reading, apply, run, disabled}: {reading: NativeEditorReading | null; apply: BarApply; run: LiveRun | null; disabled: boolean}) {
  const [hidden, setHidden] = useState<Set<string>>(readHiddenSlots)
  const latest = useRef({run, apply, reading})
  latest.current = {run, apply, reading}
  const sessions = useRef(new Map<string, BarValueSession>())
  const sessionFor: SessionFor = (key, targets, target, changesFor) => {
    const known = sessions.current.get(key)
    if (known) return known
    const made = createLiveSession(targets, () => {
      const now = latest.current
      return {run: now.run, automated: target !== null && automatedOn(now.reading, target),
        apply: value => send(now.apply, changesFor(value)).then(reply => reply.ok, () => false)}
    })
    sessions.current.set(key, made)
    return made
  }
  if (!reading) return null
  const view: NativeEditorReading = reading
  const slots = barSlots(view, hidden)
  const slotView = (slot: BarSlot): ReactNode => {
    if (slot.kind === 'value') {
      if (isTransport(slot)) return null
      const parameter = barParameter(view, slot.path)
      if (!parameter) return null
      const session = sessionFor(parameter.target, parameter.target, parameter.target, parameterChange(parameter.target))
      return <span className="bar-slot" key={slot.id}>
        <BarValue parameter={parameter} session={session} disabled={disabled} />
        {slot.entryId !== undefined && <ScopeToggle reading={view} control={{kind: 'field', path: slot.path}} apply={apply} label={parameter.label} disabled={disabled} />}
      </span>
    }
    if (slot.kind === 'toggle') return <BarToggle key={slot.id} toggle={slot.toggle} reading={view} apply={apply} disabled={disabled} />
    if (slot.kind === 'pair') return <BarPair key={slot.id} slot={slot} reading={view} apply={apply} disabled={disabled} sessionFor={sessionFor} />
    if (slot.kind === 'range') return <BarRange key={slot.id} slot={slot} reading={view} disabled={disabled} sessionFor={sessionFor} />
    return <BarMacro key={slot.id} slot={slot} reading={view} apply={apply} disabled={disabled} sessionFor={sessionFor} />
  }
  return <div className="bar-strip" role="group" aria-label="Pinned controls">
    {slots.map(slotView)}
    <BarCustomise hidden={hidden} setHidden={setHidden} disabled={disabled} />
  </div>
}

/** A binary Scene or Field switch. Its pressed state is the Scene's own reading, and no state is claimed when the reading is absent. */
function BarToggle({toggle, reading, apply, disabled}: {toggle: BarToggleSpec; reading: NativeEditorReading; apply: BarApply; disabled: boolean}) {
  const [fault, setFault] = useState<string | null>(null)
  const on = toggle.read(reading)
  const press = () => {
    setFault(null)
    void send(apply, toggle.changes(on !== true, reading)).then(reply => {if (!reply.ok) setFault(reply.error)}, cause => setFault(reasonOf(cause)))
  }
  return <span className="bar-toggle-wrap">
    <button type="button" className="bar-toggle" aria-label={toggle.label} aria-pressed={on} title={toggle.title} disabled={disabled} onClick={press}>{toggle.label}</button>
    {fault && <small role="alert" className="bar-fault">{fault}</small>}
  </span>
}

/** A Field switch with its numeric value beside it. The value is disabled while the switch reads off. */
function BarPair({slot, reading, apply, disabled, sessionFor}: {slot: Slot<'pair'>; reading: NativeEditorReading; apply: BarApply; disabled: boolean; sessionFor: SessionFor}) {
  const parameter = barParameter(reading, slot.path)
  const off = slot.toggle.read(reading) === false
  return <div className="bar-pair" role="group" aria-label={slot.label}>
    <BarToggle toggle={slot.toggle} reading={reading} apply={apply} disabled={disabled} />
    {parameter && <BarValue parameter={parameter}
      session={sessionFor(parameter.target, parameter.target, parameter.target, parameterChange(parameter.target))}
      disabled={disabled || off} reason={off ? `Turn the ${slot.label} field on to use its plate size.` : null} />}
  </div>
}

/** A two-handle range over the registry's soft track. The handles never cross, the band is decorative, and a release is one write per handle. */
function BarRange({slot, reading, disabled, sessionFor}: {slot: Slot<'range'>; reading: NativeEditorReading; disabled: boolean; sessionFor: SessionFor}) {
  const [drag, setDrag] = useState<{handle: Handle; value: number} | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const gesture = useRef<RangeGesture | null>(null)
  const track = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      const live = gesture.current
      if (event.key !== 'Escape' || !live) return
      gesture.current = null; live.session.cancel(); setDrag(null)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const base = barRangeState(reading, slot.minPath, slot.maxPath)
  const low = barParameter(reading, slot.minPath), high = barParameter(reading, slot.maxPath)
  if (!base || !low || !high) return null
  const sessions: Record<Handle, BarValueSession> = {
    min: sessionFor(low.target, low.target, low.target, parameterChange(low.target)),
    max: sessionFor(high.target, high.target, high.target, parameterChange(high.target)),
  }
  const committed = (handle: Handle) => handle === 'min' ? base.min : base.max
  const shown = drag === null ? base : drag.handle === 'min' ? {...base, min: drag.value} : {...base, max: drag.value}
  const at = (handle: Handle) => handle === 'min' ? shown.min : shown.max
  const fraction = (value: number) => rangeFraction(value, base)
  const text = (value: number) => [formatBarValue(value, base.track), base.track.unit].filter(Boolean).join(' ')
  const label = (handle: Handle) => `${slot.label} ${handle === 'min' ? 'minimum' : 'maximum'}`
  const failed = (handle: Handle) => `${label(handle)} was not changed.`
  const settled = (handle: Handle, ok: boolean) => {setDrag(null); if (!ok) setFault(failed(handle))}
  // Pointer values follow the track: the shared soft range, settled to the step grid, then kept clear of the other handle.
  const valueAt = (clientX: number, handle: Handle) => {
    const rect = track.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return committed(handle)
    return clampRangeHandle(handle, settle(base.track, rangeValue((clientX - rect.left) / rect.width, base)), base)
  }
  const press = (handle: Handle) => (event: PointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {handle, pointer: event.pointerId, session: sessions[handle], value: committed(handle)}
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const live = gesture.current
    if (!live || live.pointer !== event.pointerId) return
    const value = valueAt(event.clientX, live.handle)
    live.value = value
    setDrag({handle: live.handle, value})
    live.session.live(value)
  }
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const live = gesture.current
    if (!live || live.pointer !== event.pointerId) return
    gesture.current = null
    if (live.value === committed(live.handle)) {live.session.cancel(); setDrag(null); return}
    setFault(null)
    void live.session.commit(live.value).then(ok => settled(live.handle, ok), () => settled(live.handle, false))
  }
  const abandon = () => {
    const live = gesture.current
    if (!live) return
    gesture.current = null; live.session.cancel(); setDrag(null)
  }
  // Arrows step one registry step (Shift for ten); Home and End go to the handle's own reachable bounds. Each key is one write.
  const key = (handle: Handle) => (event: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled) return
    const current = committed(handle)
    const direction: 1 | -1 | null = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : null
    let next: number | null = null
    if (direction !== null) next = clampRangeHandle(handle, stepBarValue(current, base.track, direction, event.shiftKey), base)
    else if (event.key === 'Home') next = handle === 'min' ? base.lowest : base.min
    else if (event.key === 'End') next = handle === 'min' ? base.max : base.highest
    if (next === null) return
    event.preventDefault()
    if (next === current) return
    setFault(null)
    void sessions[handle].commit(next).then(ok => {if (!ok) setFault(failed(handle))}, () => setFault(failed(handle)))
  }
  const band = {from: rangeFraction(slot.band.from, base), to: rangeFraction(slot.band.to, base)}
  const minPos = fraction(shown.min), maxPos = fraction(shown.max)
  return <div className="bar-range" role="group" aria-label={slot.label} title={slot.title}>
    <div className="bar-range-track" ref={track} onPointerMove={move} onPointerUp={release} onPointerCancel={abandon}>
      <span className="bar-rail" aria-hidden="true" />
      <span className="bar-band" aria-hidden="true" style={{left: pct(band.from), width: pct(band.to - band.from)}} />
      <span className="bar-span" aria-hidden="true" style={{left: pct(minPos), width: pct(maxPos - minPos)}} />
      {(['min', 'max'] as const).map(handle => <span key={handle} role="slider" className="bar-handle" tabIndex={disabled ? -1 : 0}
        aria-label={label(handle)} aria-valuemin={base.lowest} aria-valuemax={base.highest} aria-valuenow={at(handle)}
        aria-valuetext={text(at(handle))} aria-disabled={disabled || undefined} style={{left: pct(fraction(at(handle)))}}
        onPointerDown={press(handle)} onKeyDown={key(handle)} />)}
    </div>
    <span className="bar-range-values">{`${text(shown.min)} – ${text(shown.max)}`}</span>
    {fault && <small role="alert" className="bar-fault">{fault}</small>}
  </div>
}

/** Shape hold: one macro over a Scene rack. Until the person adds the rack it is an add button; then a range over the rack's macro value. */
function BarMacro({slot, reading, apply, disabled, sessionFor}: {slot: Slot<'macro'>; reading: NativeEditorReading; apply: BarApply; disabled: boolean; sessionFor: SessionFor}) {
  const rack = barMacroRack(reading, slot.macro)
  const [draft, setDraft] = useState<number | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const pending = useRef<number | null>(null)
  if (!rack) {
    const add = () => {
      setFault(null)
      void send(apply, [barMacroCreate(reading, slot.macro)]).then(reply => {if (!reply.ok) setFault(reply.error)}, cause => setFault(reasonOf(cause)))
    }
    return <span className="bar-macro">
      <button type="button" className="bar-macro-add" disabled={disabled} title={`Creates a parameter rack in this Scene. ${slot.title}`} onClick={add}>{`Add ${slot.label}`}</button>
      {fault && <small role="alert" className="bar-fault">{fault}</small>}
    </span>
  }
  const macro = rack.macros[0]
  const position = macro?.value ?? 0
  const session = sessionFor(`macro:${slot.macro.rackId}:${slot.macro.macroId}`, value => barMacroPoints(slot.macro, value), null,
    value => [{kind: 'rack-macro-value', rack_id: slot.macro.rackId, macro_id: slot.macro.macroId, value}])
  const shown = draft ?? position
  const percent = `${Math.round(shown * 100)}%`
  const finish = () => {
    const value = pending.current
    pending.current = null
    if (value === null) return
    if (value === position) {session.cancel(); setDraft(null); return}
    setFault(null)
    void session.commit(value).then(ok => {setDraft(null); if (!ok) setFault(`${slot.label} was not changed.`)},
      () => {setDraft(null); setFault(`${slot.label} was not changed.`)})
  }
  const cancel = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    pending.current = null; session.cancel(); setDraft(null)
  }
  return <span className="bar-macro">
    <span className="bar-macro-name">{slot.label}</span>
    <input type="range" min={0} max={1} step={0.01} aria-label={slot.label} title={slot.title} value={shown} aria-valuetext={percent} disabled={disabled}
      onChange={event => {const next = Number(event.target.value); pending.current = next; setDraft(next); session.live(next)}}
      onPointerUp={finish} onKeyDown={cancel} onKeyUp={finish} onBlur={finish} />
    <span className="bar-macro-value">{percent}</span>
    {fault && <small role="alert" className="bar-fault">{fault}</small>}
  </span>
}

/** The Controls menu: which seed controls this viewer shows. Hiding is a per-viewer convenience; pins are chosen controls in the document. */
function BarCustomise({hidden, setHidden, disabled}: {hidden: ReadonlySet<string>; setHidden: (next: Set<string>) => void; disabled: boolean}) {
  const choose = (id: string, visible: boolean) => {
    const next = new Set<string>(hidden)
    if (visible) next.delete(id); else next.add(id)
    writeHiddenSlots(next); setHidden(next)
  }
  const reset = () => {const next = new Set<string>(); writeHiddenSlots(next); setHidden(next)}
  return <details className="bar-strip-menu">
    <summary aria-label="Customise controls" title="Show or hide the pinned controls">Controls</summary>
    <div className="bar-strip-menu-panel">
      {SEED_SLOTS.filter(slot => !isTransport(slot)).map(slot => <label key={slot.id} className="bar-strip-option">
        <input type="checkbox" checked={!hidden.has(slot.id)} disabled={disabled} onChange={event => choose(slot.id, event.target.checked)} />{slotName(slot)}</label>)}
      <button type="button" className="bar-strip-reset" disabled={disabled} onClick={reset}>Reset to defaults</button>
    </div>
  </details>
}
