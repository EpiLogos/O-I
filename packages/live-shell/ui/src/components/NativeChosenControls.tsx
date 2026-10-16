// Your controls (the frame's toolbelt, Journey.shared.toolbelt, through the boundary's chosen controls): the parameters the person chose,
// each a dial of the device panel kit (inhabitants/sdk/panel.tsx Dial; docs/dlw/DEVICE-UI.md §5) standing in the section that holds them
// — never a card, never a box of its own. The section never scrolls: the dials page, the pages in the row's head (DEVICE-UI §1 "When a
// panel holds more than fits, it gets pages in its head"), as many to a page as the section's height and width hold. A change goes to the
// owner when the hand lets go (§5.2): the dial shows the value you set while you drag, then the value waits in italics until the owner's
// reading moves, and a refusal returns the owner's value with the owner's words on the status line. Configure adds each control's own
// management under it: its scope (Follow the selection, or Bind the object), its place (drag, ← →, or Alt with ← →) and its removal.
// Ported from the card rack this replaces (this file before lane BE: ChosenScalar's drag and keys, its send, the drop and the order).
import {useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type RefObject} from 'react'
import type {NativeChosenControlReading, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import {Action, Dial, type Scale} from '../inhabitants/sdk/panel'
import {chosenAddChange, chosenDropReason, edgeGap, gapToIndex, reorderChange, wholeChosenOrder} from './nativeBrowserModel'
import {CHOSEN_MIME, PARAMETER_BROWSE_EVENT, activeDrag, setActiveDrag} from './nativeDrag'
import './NativeChosenControls.css'

type Request = (request: NativeEditorRequest) => Promise<NativeEditorReply>
const format = (value: number) => String(Number(value.toPrecision(4)))
/** How long an accepted change waits for the owner's reading before the owner's value stands again (frame/devices/deviceHost.tsx). */
const CONFIRM_GRACE_MS = 4000
/** One dial's cell (DEVICE-UI §3: a control column 56 wide; the name, a 28 px ring, the value) and the head row above the dials. */
export const CHOSEN_COLUMN = 56, CHOSEN_CELL = 58, CHOSEN_HEAD = 20, CHOSEN_MANAGE = 38

/** How many dials a page holds: the rows the section's height takes (each dial's cell, and in Configure its management under it), by the
 * columns asked. Pure. */
export function chosenPage(height: number | null, columns: number, configure: boolean): {rows: number; size: number} {
  const cell = CHOSEN_CELL + (configure ? CHOSEN_MANAGE : 0) + 5
  const rows = height === null || !(height > 0) ? 1 : Math.max(1, Math.floor((height - CHOSEN_HEAD + 5) / cell))
  return {rows, size: rows * columns}
}

/** The page a control stands on, and the controls of that page. Pure. */
export function pageOf<T>(items: readonly T[], size: number, page: number): {at: number; pages: number; shown: T[]} {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, size))), at = Math.min(Math.max(0, page), pages - 1)
  return {at, pages, shown: items.slice(at * size, at * size + size)}
}

/** One chosen control as the kit's dial over the owner's reading: the draft while the hand moves, sent on release or on a key. */
function ChosenDial({control, reading, request, scope}: {control: NativeChosenControlReading; reading: NativeEditorReading; request: Request; scope: string}) {
  const [draft, setDraft] = useState<number | null>(null), [pending, setPending] = useState(false), [refused, setRefused] = useState<string | null>(null)
  const latest = useRef<number | null>(null), sending = useRef(false)
  // The owner's new reading ends the wait and drops the draft: the owner's value stands, never a copy.
  useEffect(() => {setPending(false); setDraft(null)}, [control.base_value, reading.basis.revision])
  useEffect(() => {if (!pending) return; const timer = setTimeout(() => {setPending(false); setDraft(null)}, CONFIRM_GRACE_MS); return () => clearTimeout(timer)}, [pending])
  const binding = control.binding, value = control.base_value
  const subject = control.entity_id ? reading.scene.entities.find(entity => entity.id === control.entity_id)?.name ?? 'Bound object' : 'Field'
  const label = binding?.label.replace(/^Entity \d+ · /, '') ?? 'Unavailable parameter'
  const unavailable = !binding || control.target === null || value === null || !Number.isFinite(value)
  const why = unavailable ? control.unavailable_reason ?? 'The native owner has not resolved this retained declaration.'
    : control.locked ? `${subject} is locked: its owner takes no change.` : reading.standing.pending ? 'Waiting for the native owner to acknowledge the last change.' : undefined
  const send = async () => {
    const next = latest.current
    latest.current = null
    if (next === null || sending.current || !binding || !control.target || why) return
    if (next < binding.hardMin || next > binding.hardMax) {setRefused(`Range ${format(binding.hardMin)}–${format(binding.hardMax)}`); setDraft(null); return}
    sending.current = true; setPending(true); setRefused(null)
    const basis = reading.basis, target = control.target
    try {
      const reply = await request({operation: 'apply', basis, changes: [{kind: 'parameter', target, value: next}]})
      if (!reply.ok) {setRefused(reply.error); setPending(false); setDraft(null)}
    } catch (cause) {setRefused(cause instanceof Error ? cause.message : String(cause)); setPending(false); setDraft(null)}
    finally {sending.current = false}
  }
  const change = (next: number) => {latest.current = next; setDraft(next); setRefused(null)}
  const scale: Scale = binding ? {min: binding.min, max: binding.max, ...(binding.scale === 'log' && binding.min > 0 ? {log: true} : {}), ...(binding.step > 0 ? {step: binding.step} : {})} : {min: 0, max: 1}
  const effective = control.effective_value
  const shown = draft ?? (unavailable ? NaN : value)
  const does = `${scope} · ${subject}${binding?.unit ? ` · ${binding.unit}` : ''}${effective !== null && Number.isFinite(effective) && effective !== value ? ` · the field plays it at ${format(effective)}` : ''}${control.native_ref ? ` · ${control.native_ref}` : ''}${unavailable ? `. ${why}` : ''}`
  return <div className="native-chosen-dial" data-entry={control.entry_id}
    onPointerUp={() => void send()} onKeyUp={(event: KeyboardEvent<HTMLElement>) => {if (/^(Arrow|Page|Home|End|Delete|Backspace)/.test(event.key)) void send()}}
    onDoubleClick={() => setTimeout(() => void send(), 0)}>
    <Dial label={label} does={does} value={shown} def={binding?.defaultValue} scale={scale} format={format} onChange={why ? undefined : change}
      pending={pending} refused={refused ?? undefined} disabled={why}
      mod={effective !== null && value !== null && Number.isFinite(effective) && effective !== value ? [value, effective] : undefined} />
  </div>
}

/** Measure the height the controls stand in: the section body that holds them (the Studio's plate), else none. */
function useHeldHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const holder = ref.current?.parentElement?.closest<HTMLElement>('.inst-section-body')
    if (!holder || typeof ResizeObserver === 'undefined') return
    const measure = () => setHeight(was => (was === holder.clientHeight ? was : holder.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(holder)
    return () => observer.disconnect()
  }, [ref])
  return height
}

export function NativeChosenControls({reading, request, configure, columns = 3}: {reading: NativeEditorReading | null; request: Request; configure: boolean; columns?: number}) {
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [page, setPage] = useState(0)
  const [drop, setDrop] = useState<{status: 'valid' | 'invalid'; text: string} | null>(null)
  const [marker, setMarker] = useState<{index: number; edge: 'before' | 'after'} | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const root = useRef<HTMLElement>(null)
  const height = useHeldHeight(root)
  const chosen = reading?.chosenControls
  const invoke = async (operation: NativeEditorRequest) => {
    if (pendingRef.current) return
    pendingRef.current = true; setPending(true); setError('')
    try {const reply = await request(operation); if (!reply.ok) setError(reply.error)}
    catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {pendingRef.current = false; setPending(false)}
  }
  // Field pins live in the top bar (NativeBarStrip); this rack keeps the object controls (Follow and Bind). Ordering is of the
  // visible controls only: the owner's chosen-order takes the whole list, so the hidden Field entries keep their own slots.
  const objectEntries = chosen?.entries.filter(entry => entry.scope !== 'field') ?? []
  const entryIds = () => objectEntries.map(entry => entry.id)
  const wholeOrder = (visible: string[]) => wholeChosenOrder(chosen?.entries ?? [], visible)
  /** One chosen-order request per gesture; a move that changes nothing sends nothing. */
  const order = (id: string, offset: number) => {
    if (!reading || !chosen) return
    const ids = entryIds(), index = ids.indexOf(id)
    if (index < 0) return
    const next = reorderChange(ids, index, index + offset)
    if (next) void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-order', entry_ids: wholeOrder(next)}]})
  }
  const edgeOf = (event: DragEvent<HTMLElement>): 'before' | 'after' => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }
  /** A parameter from the Browser: valid targets accept, invalid ones name the reason and refuse the drop. */
  const sectionOver = (event: DragEvent<HTMLElement>) => {
    const active = activeDrag()
    if (active?.kind !== 'parameter') return
    const reason = chosenDropReason(active.drag, reading)
    if (reason) {setDrop(current => current?.status === 'invalid' && current.text === reason ? current : {status: 'invalid', text: reason}); return}
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy'
    const text = `Drop to choose ${active.drag.label}`
    setDrop(current => current?.status === 'valid' && current.text === text ? current : {status: 'valid', text})
  }
  const sectionLeave = (event: DragEvent<HTMLElement>) => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null)}
  const sectionDrop = (event: DragEvent<HTMLElement>) => {
    const active = activeDrag()
    setDrop(null)
    if (active?.kind !== 'parameter') return
    event.preventDefault()
    const reason = chosenDropReason(active.drag, reading)
    if (reason || !reading) {setError(reason ?? 'Open an Expression to choose controls'); return}
    setError('')
    void invoke({operation: 'apply', basis: reading.basis, changes: [chosenAddChange(active.drag)]})
  }
  const handleStart = (event: DragEvent<HTMLButtonElement>, entryId: string, index: number) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(CHOSEN_MIME, entryId)
    const item = event.currentTarget.closest('.native-chosen-item')
    if (item instanceof HTMLElement) event.dataTransfer.setDragImage(item, 12, 12)
    setActiveDrag({kind: 'chosen', entry_id: entryId, index})
    setDragging(entryId)
  }
  const handleEnd = () => {setActiveDrag(null); setDragging(null); setMarker(null)}
  const itemOver = (event: DragEvent<HTMLElement>, index: number) => {
    if (activeDrag()?.kind !== 'chosen') return
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'
    const edge = edgeOf(event)
    setMarker(current => current?.index === index && current.edge === edge ? current : {index, edge})
  }
  const itemDrop = (event: DragEvent<HTMLElement>, index: number) => {
    const active = activeDrag()
    if (active?.kind !== 'chosen' || !reading || !chosen) return
    event.preventDefault()
    const ids = entryIds(), from = ids.indexOf(active.entry_id), edge = edgeOf(event)
    setMarker(null); setDragging(null); setActiveDrag(null)
    if (from < 0) return
    const next = reorderChange(ids, from, gapToIndex(from, edgeGap(index, edge)))
    if (next) void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-order', entry_ids: wholeOrder(next)}]})
  }
  /** Alt+Arrow is the keyboard equal of dragging a handle: taken before the dial's own arrows (the kit's dial steps on any arrow). */
  const itemKey = (event: KeyboardEvent<HTMLDivElement>, entryId: string) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || event.target instanceof HTMLSelectElement) return
    event.preventDefault(); event.stopPropagation()
    if (configure) order(entryId, event.key === 'ArrowLeft' ? -1 : 1)
  }
  const browse = () => window.dispatchEvent(new CustomEvent(PARAMETER_BROWSE_EVENT))
  const fit = chosenPage(height, columns, configure)
  const paged = pageOf(objectEntries, fit.size, page)
  // A page that no longer exists (a control removed, the section shorter) shows the last one.
  useEffect(() => {if (page !== paged.at) setPage(paged.at)}, [page, paged.at])
  const pager = paged.pages > 1 && <span className="dp-pager" role="group" aria-label="Your controls: pages">
    <button type="button" aria-label="Previous page of your controls" disabled={paged.at === 0} onClick={() => setPage(paged.at - 1)}>‹</button>
    <span>{paged.at + 1}/{paged.pages}</span>
    <button type="button" aria-label="Next page of your controls" disabled={paged.at === paged.pages - 1} onClick={() => setPage(paged.at + 1)}>›</button>
  </span>
  return <section ref={root} className="native-chosen" aria-label="Chosen native controls" aria-busy={pending} data-drop={drop?.status} data-configure={configure ? 'true' : undefined}
    style={{'--chosen-cols': columns} as CSSProperties} onDragOver={sectionOver} onDragLeave={sectionLeave} onDrop={sectionDrop}>
    <div className="native-chosen-head">
      <Action label="+ Parameter" does="Choose a parameter in the browser: it stands here as one of your controls." onPress={chosen?.available ? browse : undefined} />
      {pager}
    </div>
    {drop && <p className={`native-chosen-drop is-${drop.status}`} role="status">{drop.text}</p>}
    {!reading || !chosen?.available ? <p className="native-chosen-empty" data-i="|The retained owner has not disclosed its chosen controls.">The retained owner has not disclosed its chosen controls.</p>
      : !objectEntries.length ? <p className="native-chosen-empty" data-i={`|${chosen.entries.length ? 'No object parameters chosen. Field pins are in the top bar.' : 'No parameters chosen.'}`}>{chosen.entries.length ? 'No object parameters chosen. Field pins are in the top bar.' : 'No parameters chosen.'}</p>
      : <div className="native-chosen-grid" style={{'--chosen-rows': fit.rows} as CSSProperties}>{paged.shown.map((entry, offset) => {
        const index = paged.at * fit.size + offset
        const control = chosen.controls.find(item => item.entry_id === entry.id)
        const resolved = control ?? {entry_id: entry.id, target: null, binding: null, entity_id: null, native_ref: null, base_value: null, effective_value: null, locked: false, unavailable_reason: 'The native owner has not resolved this retained declaration.'}
        const entityId = resolved.entity_id ?? (reading.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : null)
        const disabled = pending || reading.standing.pending
        const identity = `${reading.basis.expression_ref}:${entry.id}`
        const name = resolved.binding?.label ?? entry.key
        return <div key={identity} className={`native-chosen-item${dragging === entry.id ? ' is-dragging' : ''}${control ? '' : ' is-unavailable'}`} title={entry.key}
          data-drop-edge={marker?.index === index ? marker.edge : undefined}
          onDragOver={event => itemOver(event, index)} onDrop={event => itemDrop(event, index)} onKeyDownCapture={event => itemKey(event, entry.id)}>
          <ChosenDial control={resolved} reading={reading} request={request} scope={entry.scope === 'selected' ? 'Follow' : 'Bound'} />
          <div className="native-chosen-manage" hidden={!configure}>
            <select aria-label={`Scope for ${name}`} value={entry.scope} disabled={disabled} onChange={event => {
              const scope = event.target.value as 'selected' | 'named'
              if (scope === 'named' && !entityId) return
              void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-scope', entry_id: entry.id, scope, ...(scope === 'named' ? {entity_id: entityId!} : {})}]})
            }}><option value="selected">Follow selection</option><option value="named" disabled={!entityId && entry.scope !== 'named'}>Bind this object</option></select>
            <span><button className="native-chosen-handle" draggable={!disabled} disabled={disabled} aria-label={`Drag to reorder ${name}; or Alt with Left or Right arrow`} title="Drag to reorder" onDragStart={event => handleStart(event, entry.id, index)} onDragEnd={handleEnd}>⠿</button><button aria-label={`Move ${name} earlier`} disabled={disabled || index === 0} onClick={() => order(entry.id, -1)}>←</button><button aria-label={`Move ${name} later`} disabled={disabled || index === objectEntries.length - 1} onClick={() => order(entry.id, 1)}>→</button><button aria-label={`Remove ${name} chosen control`} disabled={disabled} title="Remove chosen control; retain parameter value" onClick={() => void invoke({operation: 'apply', basis: reading.basis, changes: [{kind: 'chosen-remove', entry_id: entry.id}]})}>×</button></span>
          </div>
        </div>
      })}</div>}
    {error && <p role="alert" className="native-chosen-error" data-i={`|${error}`}>{error}</p>}
  </section>
}
