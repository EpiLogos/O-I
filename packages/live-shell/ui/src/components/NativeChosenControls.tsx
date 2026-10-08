import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {NativeChosenControlReading, NativeEditorBasis, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import type {NativeBinding} from '@epilogos/expressions-boundary/parameters'
import './NativeChosenControls.css'

type Request = (request: NativeEditorRequest) => Promise<NativeEditorReply>
const format = (value: number) => String(Number(value.toPrecision(6)))
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const fraction = (binding: NativeBinding, value: number) => {
  if (binding.max === binding.min) return 0
  const ratio = binding.scale === 'log' && binding.min > 0 && binding.max > binding.min
    ? Math.log(Math.max(binding.min, value) / binding.min) / Math.log(binding.max / binding.min)
    : (value - binding.min) / (binding.max - binding.min)
  return bounded(ratio, 0, 1)
}
const fromFraction = (binding: NativeBinding, value: number) => {
  const raw = binding.scale === 'log' && binding.min > 0 && binding.max > binding.min
    ? binding.min * (binding.max / binding.min) ** value
    : binding.min + value * (binding.max - binding.min)
  const stepped = binding.step > 0 ? binding.min + Math.round((raw - binding.min) / binding.step) * binding.step : raw
  return bounded(stepped, binding.hardMin, binding.hardMax)
}
interface CapturedValue {basis: NativeEditorBasis; target: string; binding: NativeBinding; text: string; subject: string}

/** One chosen declaration stays mounted when Follow resolves to a different object. */
function ChosenScalar({control, reading, request, scope, onDraft, identity, drafts}: {
  control: NativeChosenControlReading; reading: NativeEditorReading; request: Request;
  scope: string; onDraft: (id: string, retained: boolean) => void
  identity: string; drafts: Map<string, CapturedValue>
}) {
  const [draft, setDraft] = useState<CapturedValue | null>(() => drafts.get(identity) ?? null), [error, setError] = useState(''), [pending, setPending] = useState(false)
  const captured = useRef<CapturedValue | null>(drafts.get(identity) ?? null), sending = useRef(false)
  const drag = useRef<{pointer: number; startY: number; startFraction: number; value: CapturedValue} | null>(null)
  const keyboard = useRef(false)
  useEffect(() => {onDraft(control.entry_id, !!draft); return () => onDraft(control.entry_id, false)}, [control.entry_id, !!draft, onDraft])
  const binding = control.binding, value = control.base_value
  const subject = control.entity_id ? reading.scene.entities.find(entity => entity.id === control.entity_id)?.name ?? 'Bound object' : 'Field'
  const label = binding?.label.replace(/^Entity \d+ · /, '') ?? 'Unavailable parameter'
  const unavailable = !binding || control.target === null || value === null || !Number.isFinite(value)
  const disabled = unavailable || control.locked || reading.standing.pending || pending
  const capture = (): CapturedValue | null => {
    if (captured.current) return captured.current
    if (!binding || !control.target || value === null) return null
    const next = {basis: reading.basis, target: control.target, binding, text: format(value), subject}
    captured.current = next
    return next
  }
  const retain = (next: CapturedValue) => {captured.current = next; drafts.set(identity, next); setDraft(next); setError('')}
  const discard = () => {captured.current = null; drafts.delete(identity); drag.current = null; keyboard.current = false; setDraft(null); setError('')}
  const submit = async (intended = captured.current) => {
    if (!intended || sending.current || reading.standing.pending) return
    const next = intended.text.trim() ? Number(intended.text) : NaN
    if (!Number.isFinite(next)) {setError('Enter a finite number'); return}
    if (next < intended.binding.hardMin || next > intended.binding.hardMax) {setError(`Range ${format(intended.binding.hardMin)}–${format(intended.binding.hardMax)}`); return}
    sending.current = true; setPending(true)
    try {
      const reply = await request({operation: 'apply', basis: intended.basis, changes: [{kind: 'parameter', target: intended.target, value: next}]})
      if (captured.current !== intended) return
      if (reply.ok) discard()
      else setError(reply.error)
    } catch (cause) {if (captured.current === intended) setError(cause instanceof Error ? cause.message : String(cause))}
    finally {sending.current = false; setPending(false)}
  }
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0) return
    const current = capture()
    if (!current) return
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {pointer: event.pointerId, startY: event.clientY, startFraction: fraction(current.binding, Number(current.text)), value: current}
  }
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    const ratio = bounded(current.startFraction + (current.startY - event.clientY) / (event.shiftKey ? 1200 : 180), 0, 1)
    retain({...current.value, text: format(fromFraction(current.value.binding, ratio))})
  }
  const pointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    const gesture = drag.current
    if (gesture?.pointer !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (captured.current && captured.current.text !== gesture.value.text) void submit()
  }
  const pointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    const pointer = drag.current?.pointer
    drag.current = null
    if (!drafts.has(identity)) captured.current = null
    if (pointer !== undefined && event.currentTarget.hasPointerCapture(pointer)) event.currentTarget.releasePointerCapture(pointer)
  }
  const keyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      const pointer = drag.current?.pointer
      drag.current = null
      if (pointer !== undefined && event.currentTarget.hasPointerCapture(pointer)) event.currentTarget.releasePointerCapture(pointer)
      discard(); return
    }
    if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const current = capture()
    if (!current) return
    event.preventDefault(); keyboard.current = true
    const step = current.binding.step > 0 ? current.binding.step : (current.binding.max - current.binding.min) / 100
    const next = event.key === 'Home' ? current.binding.min : event.key === 'End' ? current.binding.max
      : Number(current.text) + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) * step * (event.shiftKey ? 10 : 1)
    retain({...current, text: format(bounded(next, current.binding.hardMin, current.binding.hardMax))})
  }
  const shown = draft && Number.isFinite(Number(draft.text)) ? Number(draft.text) : value
  const turn = binding && shown !== null ? -135 + fraction(binding, shown) * 270 : -135
  const effective = control.effective_value
  return <article className={`native-chosen-control${draft ? ' has-draft' : ''}${unavailable ? ' is-unavailable' : ''}`}>
    <strong title={binding?.note ?? binding?.path}>{label}</strong>
    <div className="native-chosen-dial-row"><svg viewBox="0 0 48 48" role="slider" tabIndex={disabled ? -1 : 0}
      aria-label={`${label} · ${subject}`} aria-disabled={disabled} aria-valuemin={binding?.hardMin} aria-valuemax={binding?.hardMax}
      aria-valuenow={shown ?? undefined} aria-valuetext={shown === null ? 'Unavailable' : `${format(shown)} ${binding?.unit ?? ''}`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd}
      onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel}
      onKeyDown={keyDown} onKeyUp={event => {if (keyboard.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {keyboard.current = false; void submit()}}}>
      <circle cx="24" cy="24" r="17" className="native-chosen-dial-track" />
      <path d="M12 36A17 17 0 1 1 36 36" className="native-chosen-dial-range" />
      <g transform={`rotate(${turn} 24 24)`}><path d="M24 24V10" className="native-chosen-dial-hand" /></g>
      {binding && effective !== null && Number.isFinite(effective) && <g transform={`rotate(${-135 + fraction(binding, effective) * 270} 24 24)`}><circle cx="24" cy="4" r="2" className="native-chosen-effective-dot" /></g>}
    </svg><span title={control.unavailable_reason ?? `${scope} · ${subject}${control.native_ref ? '\n' + control.native_ref : ''}`}>{scope}<small>{unavailable ? 'Unavailable' : control.locked ? 'Locked' : subject}</small></span></div>
    <div className="native-chosen-value"><input aria-label={`${label} exact value`} inputMode="decimal" value={draft?.text ?? (value === null ? '—' : format(value))} disabled={disabled}
      onFocus={() => {capture()}} onBlur={() => {if (!drafts.has(identity) && !drag.current && !keyboard.current) captured.current = null}}
      onChange={event => {const current = capture(); if (current) retain({...current, text: event.target.value})}}
      onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); void submit()} else if (event.key === 'Escape') {event.preventDefault(); discard()}}} /><small>{binding?.unit ?? ''}</small></div>
    {effective !== null && Number.isFinite(effective) && <small className="native-chosen-effective" title="Actual native effective value">↳ {format(effective)} {binding?.unit ?? ''}</small>}
    {draft && <div className="native-chosen-draft"><span title={`${draft.target}\n${draft.basis.scene_ref} · r${draft.basis.revision}`}>{pending ? 'Awaiting owner…' : `Draft · ${draft.subject}`}</span><button disabled={pending || reading.standing.pending} onClick={() => void submit()}>Apply</button><button disabled={pending} onClick={discard}>Discard</button></div>}
    {error && <small role="alert" className="native-chosen-error">{error}</small>}
    {unavailable && <small className="native-chosen-unavailable">{control.unavailable_reason}</small>}
  </article>
}

export function NativeChosenControls({reading, request, configure}: {reading: NativeEditorReading | null; request: Request; configure: boolean}) {
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [draftIds, setDraftIds] = useState<Set<string>>(new Set())
  const pendingRef = useRef(false)
  const draftValues = useRef(new Map<string, CapturedValue>())
  const onDraft = useRef((id: string, retained: boolean) => setDraftIds(before => {
    if (before.has(id) === retained) return before
    const next = new Set(before); retained ? next.add(id) : next.delete(id); return next
  })).current
  const chosen = reading?.chosenControls
  const invoke = async (operation: NativeEditorRequest) => {
    if (pendingRef.current) return
    pendingRef.current = true; setPending(true); setError('')
    try {const reply = await request(operation); if (!reply.ok) setError(reply.error)}
    catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {pendingRef.current = false; setPending(false)}
  }
  const order = (id: string, offset: number) => {
    if (!reading || !chosen) return
    const ids = chosen.entries.map(entry => entry.id), index = ids.indexOf(id), destination = index + offset
    if (index < 0 || destination < 0 || destination >= ids.length) return
    ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
    void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-order', entry_ids: ids}]})
  }
  return <section className="native-chosen-editor" aria-label="Chosen native controls" aria-busy={pending}>
    <header><strong>Chosen controls</strong><button disabled={!chosen?.available} onClick={() => window.dispatchEvent(new CustomEvent('oi:expression-browse-parameters'))}>+ Parameter</button></header>
    {!reading || !chosen?.available ? <div className="native-chosen-empty">The retained owner has not disclosed its chosen controls.</div>
      : !chosen.entries.length ? <div className="native-chosen-empty"><span>No parameters chosen.</span><button onClick={() => window.dispatchEvent(new CustomEvent('oi:expression-browse-parameters'))}>Browse parameters</button></div>
      : <div className="native-chosen-grid">{chosen.entries.map((entry, index) => {
        const control = chosen.controls.find(item => item.entry_id === entry.id)
        const resolved = control ?? {entry_id: entry.id, target: null, binding: null, entity_id: null, native_ref: null, base_value: null, effective_value: null, locked: false, unavailable_reason: 'The native owner has not resolved this retained declaration.'}
        const entityId = resolved.entity_id ?? (reading.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : null)
        const disabled = pending || reading.standing.pending
        const identity = `${reading.basis.expression_ref}:${entry.id}`
        return <div key={identity} className="native-chosen-item" title={entry.key}>
          <ChosenScalar control={resolved} reading={reading} request={request} scope={entry.scope === 'field' ? 'Field' : entry.scope === 'selected' ? 'Follow' : 'Bound'} onDraft={onDraft} identity={identity} drafts={draftValues.current} />
          <div className="native-chosen-manage" hidden={!configure}>
            {entry.scope !== 'field' && <select aria-label={`Scope for ${resolved.binding?.label ?? entry.key}`} value={entry.scope} disabled={disabled || draftIds.has(entry.id)} onChange={event => {
              const scope = event.target.value as 'selected' | 'named'
              if (scope === 'named' && !entityId) return
              void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-scope', entry_id: entry.id, scope, ...(scope === 'named' ? {entity_id: entityId!} : {})}]})
            }}><option value="selected">Follow selection</option><option value="named" disabled={!entityId && entry.scope !== 'named'}>Bind this object</option></select>}
            <span><button aria-label={`Move ${resolved.binding?.label ?? entry.key} earlier`} disabled={disabled || index === 0} onClick={() => order(entry.id, -1)}>←</button><button aria-label={`Move ${resolved.binding?.label ?? entry.key} later`} disabled={disabled || index === chosen.entries.length - 1} onClick={() => order(entry.id, 1)}>→</button><button aria-label={`Remove ${resolved.binding?.label ?? entry.key} chosen control`} disabled={disabled || draftIds.has(entry.id)} title={draftIds.has(entry.id) ? 'Apply or discard the captured value before removing its control' : 'Remove chosen control; retain parameter value'} onClick={() => void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-remove', entry_id: entry.id}]})}>×</button></span>
          </div>
        </div>
      })}</div>}
    {error && <p role="alert" className="native-chosen-error">{error}</p>}
  </section>
}
