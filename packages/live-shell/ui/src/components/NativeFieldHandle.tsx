import {useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent} from 'react'
import {sameEditorBasis, type NativeEditorBasis, type NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import {nativeInputTargetKey, type NativeInputMaterial, type PrivateNativeInputReceipt} from '../continuity/nativeInputs'
import {fieldInputTarget, nativeDeviceSvgPoint, useDeviceInputCustody, type Apply, type CaptureCurrent, type DeviceCurrent} from './nativeDeviceCustody'
import {grabOffset, handlePosition, keyboardValue, resetValue, valueFromPoint, valueText, type HandleGeometry} from './nativeFieldHandleModel'
import './NativeFieldHandle.css'

/** One handle gesture: the native basis it started on, the value it proposes, and the axis grab offset. */
export interface HandleGesture {pointer: number; basis: NativeEditorBasis; value: number; initial: number; offset: number}
/** Producer material for one handle gesture; the same shape the Field slider retains, on the same parameter target. */
export function handleGestureMaterial(gesture: HandleGesture, parameter: string, family: string): NativeInputMaterial {
  const {pointer, basis, value, initial, offset} = gesture
  return {basis, target: fieldInputTarget(parameter, family), input: {kind: 'gesture', gesture: {pointer, basis: {...basis}, value, initial, offset}, changes: [{kind: 'parameter', target: parameter, value}]}}
}
/** A restored own gesture must rebuild the exact producer material, or it stays in recovery. */
function restoredGesture(copy: PrivateNativeInputReceipt['copy'], parameter: string, family: string): HandleGesture {
  if (copy.input.kind !== 'gesture') throw Error('The retained copy is not a native device gesture')
  const gesture = copy.input.gesture as unknown as HandleGesture
  if (!sameEditorBasis(gesture.basis, copy.basis)) throw Error('The retained gesture lost its original native basis')
  const material = handleGestureMaterial(gesture, parameter, family)
  if (nativeInputTargetKey(material) !== nativeInputTargetKey(copy) || JSON.stringify(material.input) !== JSON.stringify(copy.input)) throw Error('The retained device gesture is incomplete; its original copy remains in recovery')
  return gesture
}
const plain = (gesture: HandleGesture): HandleGesture => ({pointer: gesture.pointer, basis: gesture.basis, value: gesture.value, initial: gesture.initial, offset: gesture.offset})

export interface NativeFieldHandleProps {
  reading: NativeEditorReading; path: string; family: string; geometry: HandleGeometry; disabled: boolean
  apply: Apply; captureCurrent: CaptureCurrent; onDraft?: (path: string, value: number | null) => void
  shape?: 'dot' | 'bar' | 'ring'; label?: string
}

/** One native parameter as an in-diagram handle inside a parent SVG. Custody and gesture semantics follow the Field slider;
 * the exact-value row of the same path and the device recovery panel remain the typed and recovery equivalents. */
export function NativeFieldHandle({reading, path, family, geometry, disabled, apply, captureCurrent, onDraft, shape = 'dot', label}: NativeFieldHandleProps) {
  const binding = NATIVE_BINDINGS.find(row => row.path === path)
  const id = 'field.' + (binding?.key ?? path), value = binding ? baseValue(reading.scene, binding.key) : 0
  const custody = useDeviceInputCustody({basis: reading.basis, target: fieldInputTarget(id, family)}, 'gesture')
  const [draft, setDraft] = useState<number | null>(null), [attempt, setAttempt] = useState<HandleGesture | null>(null), [custodyError, setCustodyError] = useState(custody.fault)
  const active = useRef<(HandleGesture & {current: DeviceCurrent}) | null>(null), mounted = useRef(true), element = useRef<SVGGElement>(null)
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; active.current = null}}, [])
  useEffect(() => {
    const copy = custody.receipt?.copy
    if (attempt || copy?.input.kind !== 'gesture') return
    try {setAttempt(restoredGesture(copy, id, family))} catch (cause) {setCustodyError(cause instanceof Error ? cause.message : String(cause))}
  }, [custody])
  if (!binding) return null
  const retainGesture = (edit: HandleGesture, refusal?: string) => {try {const receipt = custody.retain({...handleGestureMaterial(edit, id, family), ...(refusal ? {refusal} : {})}); setCustodyError(''); return receipt} catch (cause) {setCustodyError(cause instanceof Error ? cause.message : String(cause)); return null}}
  const clearGesture = (submitted: PrivateNativeInputReceipt | null) => {try {custody.clear(submitted); return true} catch (cause) {setCustodyError(cause instanceof Error ? cause.message : String(cause)); return false}}
  const cancel = () => {const pointer = active.current?.pointer; active.current = null; setDraft(null); onDraft?.(path, null); if (pointer !== undefined && element.current?.hasPointerCapture(pointer)) element.current.releasePointerCapture(pointer)}
  const retainAndCancel = () => {const edit = active.current; if (edit && edit.value !== edit.initial) {retainGesture(plain(edit)); if (mounted.current) setAttempt(plain(edit))} cancel()}
  // Exact arrow, page, Home and double-click commits are one gesture on the current basis; a refused apply is retained, never dropped.
  const commitDirect = (next: number) => {
    const current = captureCurrent()
    if (!current() || next === value) return
    const edit: HandleGesture = {pointer: -1, basis: {...reading.basis}, value: next, initial: value, offset: 0}
    const receipt = retainGesture(edit)
    setAttempt(edit)
    if (!receipt) return
    void apply([{kind: 'parameter', target: id, value: next}], edit.basis).then(reply => {
      if (!mounted.current || !current(reply)) return
      if (reply.ok) {if (clearGesture(receipt)) setAttempt(now => now === edit ? null : now)}
      else retainGesture(edit, reply.error)
    })
  }
  const finish = (event: PointerEvent<SVGGElement>) => {
    const gesture = active.current
    if (!gesture || gesture.pointer !== event.pointerId) return
    cancel()
    if (gesture.value === gesture.initial) return
    const submitted = plain(gesture)
    if (mounted.current) setAttempt(submitted)
    const receipt = retainGesture(submitted)
    if (!receipt || !mounted.current || !gesture.current()) return
    void apply([{kind: 'parameter', target: id, value: submitted.value}], gesture.basis).then(reply => {
      if (!mounted.current || !gesture.current(reply)) return
      if (reply.ok) {if (clearGesture(receipt)) setAttempt(now => now === submitted ? null : now)}
      else retainGesture(submitted, reply.error)
    })
  }
  const onPointerDown = (event: PointerEvent<SVGGElement>) => {
    event.stopPropagation()
    if (disabled || active.current || event.button !== 0 || !captureCurrent()()) return
    const point = nativeDeviceSvgPoint(event, event.currentTarget.ownerSVGElement?.getScreenCTM() ?? null)
    if (!point) return
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
    active.current = {pointer: event.pointerId, basis: {...reading.basis}, value, initial: value, offset: grabOffset(binding, geometry, value, point), current: captureCurrent()}
    setDraft(value); onDraft?.(path, value)
  }
  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    const gesture = active.current
    if (!gesture || gesture.pointer !== event.pointerId) return
    if (!gesture.current()) {if (gesture.value !== gesture.initial) {retainGesture(plain(gesture)); setAttempt(plain(gesture))} cancel(); return}
    const point = nativeDeviceSvgPoint(event, element.current?.ownerSVGElement?.getScreenCTM() ?? null)
    if (!point) return
    gesture.value = valueFromPoint(binding, geometry, point, gesture.offset)
    setDraft(gesture.value); onDraft?.(path, gesture.value)
    if (gesture.value !== gesture.initial || custody.receipt) retainGesture(plain(gesture))
  }
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Escape') {if (active.current) {event.preventDefault(); event.stopPropagation(); cancel()} return}
    if (disabled) return
    const next = event.key === 'Home' ? resetValue(binding) : keyboardValue(binding, value, event.key, event.shiftKey)
    if (next === null) return
    event.preventDefault(); event.stopPropagation(); commitDirect(next)
  }
  const onDoubleClick = (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation()
    const next = resetValue(binding)
    if (disabled || active.current || next === null) return
    event.preventDefault(); commitDirect(next)
  }
  const shown = draft ?? attempt?.value ?? value, point = handlePosition(binding, geometry, shown)
  const perp = {x: -geometry.dir.y, y: geometry.dir.x}, retained = attempt !== null
  return <g ref={element} className={`native-field-handle is-${shape}${draft !== null ? ' is-dragging' : ''}${retained ? ' is-retained' : ''}`} role="slider" tabIndex={disabled ? -1 : 0}
    aria-label={label ?? binding.label} aria-valuemin={binding.hardMin} aria-valuemax={binding.hardMax} aria-valuenow={shown} aria-valuetext={valueText(binding, shown)} aria-disabled={disabled}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish}
    onPointerCancel={event => {if (active.current?.pointer === event.pointerId) retainAndCancel()}} onLostPointerCapture={event => {if (active.current?.pointer === event.pointerId) retainAndCancel()}}
    onKeyDown={onKeyDown} onDoubleClick={onDoubleClick}>
    <title>{custodyError ? `Input not retained · ${custodyError}` : valueText(binding, shown)}</title>
    <circle className="native-field-handle-hit" cx={point.x} cy={point.y} r={10} fill="transparent" stroke="none" pointerEvents="all" />
    <circle className="native-field-handle-focus" cx={point.x} cy={point.y} r={13} />
    {retained && <circle className="native-field-handle-halo" cx={point.x} cy={point.y} r={10} />}
    {shape === 'bar'
      ? <path className="native-field-handle-mark" d={`M${point.x - perp.x * 8} ${point.y - perp.y * 8}L${point.x + perp.x * 8} ${point.y + perp.y * 8}`} />
      : <circle className="native-field-handle-mark" cx={point.x} cy={point.y} r={shape === 'ring' ? 6 : 4.5} />}
    {retained && <text className="native-field-handle-hint" x={point.x + 12} y={point.y - 10}>Unacknowledged edit retained · see retained input copies</text>}
  </g>
}
