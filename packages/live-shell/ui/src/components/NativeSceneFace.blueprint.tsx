import {useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {BLUEPRINT_BASE_SIZE, BLUEPRINT_WORLD_SCALE, blueprintFieldValue, blueprintNativeOf, type BlueprintDisplayTransform, type NativeBlueprintIntent} from '../../../../expressions-boundary/src/nativeBlueprintEdits'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import {
  FIELD_KEYS, FIELD_LABELS, FIELD_RANGE, type FieldKey, bindingOf, blueprintRequest, centreFromPoint, committedDisplay, fieldValue, keyDelta,
  memberName, memberPoints, movedCentre, planPoint, PLAN, resized, sameDisplay, sizeFromPoint, sizeHandlePoint, stageFromBox, transformIntent, withField,
} from './nativeSceneFace.blueprint.ts'
import './NativeSceneFace.blueprint.css'

type Fault = {message: string; retry: NativeBlueprintIntent}
type Drag = {kind: 'centre' | 'size'; value: BlueprintDisplayTransform}
const format = (value: number) => String(Number(value.toFixed(4)))
const polygon = (points: readonly {x: number; y: number}[]) => points.map(point => {const p = planPoint(point.x, point.y); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')

/** The Blueprint device's whole expanded panel. The bound members' QL sites are drawn with the app's own transform law; the centre and
 * outer handles drive position X/Y and relative size from a local draft, one `blueprint` request on release. Refusals keep the draft. */
export function BlueprintPanel({reading, request, disabled}: SceneFacePanelProps) {
  const binding = bindingOf(reading)
  const committed = committedDisplay(binding)
  // A draft belongs to the basis it was made against; a newer reading supersedes it without a stale value showing.
  const baseKey = JSON.stringify([reading.basis, committed])
  const [draft, setDraft] = useState<{base: string; value: BlueprintDisplayTransform} | null>(null)
  const [texts, setTexts] = useState<Partial<Record<FieldKey, string>>>({})
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState<Fault | null>(null)
  const [problems, setProblems] = useState<Partial<Record<FieldKey, string>>>({})
  const inFlight = useRef(false), dragRef = useRef<Drag | null>(null), plan = useRef<SVGSVGElement>(null)
  const locked = disabled || busy || reading.standing.pending
  const live = draft && draft.base === baseKey ? draft.value : committed
  const dirty = !!live && !!committed && !sameDisplay(live, committed)

  // One request per call, one in flight at a time. Success clears the draft; a refusal keeps it with the reason for Retry or Discard.
  const send = async (intent: NativeBlueprintIntent): Promise<boolean> => {
    if (inFlight.current || locked) return false
    inFlight.current = true; setBusy(true); setFault(null)
    try {
      const reply = await request(blueprintRequest(reading, intent))
      if (reply.ok) {setDraft(null); setTexts({}); setProblems({}); return true}
      setFault({message: reply.error, retry: intent}); return false
    } catch (cause) {
      setFault({message: cause instanceof Error ? cause.message : String(cause), retry: intent}); return false
    } finally {inFlight.current = false; setBusy(false)}
  }
  const hold = (value: BlueprintDisplayTransform | null) => setDraft(value ? {base: baseKey, value} : null)
  const discard = () => {dragRef.current = null; hold(null); setTexts({}); setProblems({}); setFault(null)}

  // Exact-value fields: Apply parses every typed field; any out-of-range value is named and nothing is sent.
  const apply = () => {
    if (!live) return
    let next = live
    const found: Partial<Record<FieldKey, string>> = {}
    for (const key of FIELD_KEYS) {
      const text = texts[key]
      if (text === undefined) continue
      const parsed = blueprintFieldValue(text, FIELD_RANGE[key], FIELD_LABELS[key])
      if (parsed.problem !== null) found[key] = parsed.problem
      else next = withField(next, key, parsed.value)
    }
    setProblems(found)
    if (Object.keys(found).length) return
    if (sameDisplay(next, committed ?? next)) {setTexts({}); hold(null); return}
    void send(transformIntent(next))
  }

  // The plan handles: pointer drag keeps a local draft; release sends one transform.
  const plane = (event: PointerEvent<SVGGElement>) => {
    const box = plan.current?.getBoundingClientRect()
    return box ? stageFromBox(box, event.clientX, event.clientY) : null
  }
  const down = (event: PointerEvent<SVGGElement>, kind: Drag['kind']) => {
    if (locked || !live) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {kind, value: live}
  }
  const move = (event: PointerEvent<SVGGElement>) => {
    const current = dragRef.current, point = plane(event)
    if (!current || !point) return
    const value = current.kind === 'centre'
      ? {...current.value, translation: [...centreFromPoint(point), current.value.translation[2]] as [number, number, number]}
      : {...current.value, size: sizeFromPoint(current.value.translation, point)}
    dragRef.current = {kind: current.kind, value}
    hold(value)
  }
  const up = () => {
    const current = dragRef.current
    dragRef.current = null
    if (!current || !committed) {return}
    if (sameDisplay(current.value, committed)) {hold(null); return}
    void send(transformIntent(current.value))
  }
  const keyOnHandle = (event: KeyboardEvent<SVGGElement>, kind: Drag['kind']) => {
    if (event.key === 'Escape') {event.preventDefault(); dragRef.current = null; hold(null); return}
    const delta = keyDelta(event.key, event.shiftKey)
    if (!delta || locked || !live) return
    event.preventDefault()
    const base = draft && draft.base === baseKey ? draft.value : live
    if (kind === 'centre') hold(movedCentre(base, delta.dx, delta.dy))
    // Right and Up grow the size, Left and Down shrink it: the keyDelta components sum to that sign.
    else hold(resized(base, delta.dx + delta.dy))
  }
  const keyUpOnHandle = (event: KeyboardEvent<SVGGElement>) => {
    if (!keyDelta(event.key, event.shiftKey) || !live) return
    const pending = draft && draft.base === baseKey ? draft.value : null
    if (pending && committed && !sameDisplay(pending, committed) && !dragRef.current) void send(transformIntent(pending))
  }

  // The plan: committed constellation in grey, the live draft in amber, the admitted frame behind them.
  const members = binding ? memberPoints(binding) : []
  const draftMembers = binding && live ? memberPoints(binding, blueprintNativeOf(live)) : []
  const centre = live ? live.translation : null
  const outer = live && centre ? sizeHandlePoint(centre, live.size) : null
  const names = binding ? binding.members.map(member => ({member, name: memberName(reading, member.entity_ref)})) : []
  const grid = [-2, 0, 2]

  return <div className="native-blueprint" aria-label="Blueprint">
    <section className="native-blueprint-section" aria-labelledby="native-blueprint-roles-title">
      <header><h3 id="native-blueprint-roles-title">Sixfold roles</h3><span>{binding === undefined ? 'not in the reading' : binding === null ? 'not bound' : `bound ${binding.members.length} members`}</span></header>
      {binding === undefined && <p className="native-blueprint-note">The current blueprint is not in the reading, so its roles and transform cannot be shown. Bind or release still act on the native Scene.</p>}
      {binding === null && <p className="native-blueprint-note">This Scene is not bound. Bind assigns the roles already placed in its sixfold constellation and moves them together.</p>}
      {binding && <ol className="native-blueprint-members" aria-label="Bound members">{names.map(({member, name}) =>
        <li key={member.entity_ref}><span>{name ?? 'Member'}</span> <small>position {member.position + 1} of 6 · {member.role_ref}</small></li>)}</ol>}
      {binding && <p className="native-blueprint-note">Member positions follow the blueprint. Inspector and stage moves refuse them until you release it.</p>}
      <div className="native-blueprint-actions">
        <button type="button" disabled={locked || !!binding} title={binding ? 'The Scene is already bound. Release it first.' : 'Bind the roles already placed in this Scene’s sixfold constellation'}
          onClick={() => void send({operation: 'bind'})}>Bind sixfold roles</button>
        <button type="button" disabled={locked || binding === null} title={binding === null ? 'This Scene has no blueprint' : 'Release keeps the current positions'}
          onClick={() => void send({operation: 'release'})}>Release blueprint</button>
      </div>
    </section>

    <section className="native-blueprint-section" aria-labelledby="native-blueprint-plan-title">
      <header><h3 id="native-blueprint-plan-title">Plan view</h3><span>X right, Y up · stage units</span></header>
      <svg ref={plan} className="native-blueprint-plan" viewBox={`0 0 ${PLAN.px} ${PLAN.px}`} role="group"
        aria-label={live ? `Plan of the blueprint: centre X ${format(live.translation[0])}, Y ${format(live.translation[1])}, relative size ${format(live.size)}` : 'Plan of the blueprint: not bound'}>
        <rect x="0" y="0" width={PLAN.px} height={PLAN.px} className="native-blueprint-frame"/>
        {grid.map(value => {const a = planPoint(value, -PLAN.half), b = planPoint(value, PLAN.half), c = planPoint(-PLAN.half, value), d = planPoint(PLAN.half, value); return <g key={value} className="native-blueprint-grid">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line x1={c.x} y1={c.y} x2={d.x} y2={d.y}/></g>})}
        {committed && binding && <polygon className="native-blueprint-committed" points={polygon(members)}/>}
        {dirty && live && binding && <polygon className="native-blueprint-draft" points={polygon(draftMembers)}/>}
        {(dirty ? draftMembers : members).map(point => {const p = planPoint(point.x, point.y); return <g key={point.entity_ref}>
          <circle cx={p.x} cy={p.y} r="5" className="native-blueprint-member"/>
          <text x={p.x} y={p.y - 9} className="native-blueprint-label">{point.position + 1}</text></g>})}
        {centre && outer && <>
          <line className="native-blueprint-spoke" x1={planPoint(centre[0], centre[1]).x} y1={planPoint(centre[0], centre[1]).y} x2={planPoint(outer.x, outer.y).x} y2={planPoint(outer.x, outer.y).y}/>
          <g role="slider" tabIndex={locked ? -1 : 0} aria-label="Position X and Y" aria-disabled={locked || undefined}
            aria-valuetext={`X ${format(centre[0])}, Y ${format(centre[1])} stage units`}
            onPointerDown={event => down(event, 'centre')} onPointerMove={move} onPointerUp={up} onPointerCancel={() => {dragRef.current = null; hold(null)}}
            onKeyDown={event => keyOnHandle(event, 'centre')} onKeyUp={keyUpOnHandle} className="native-blueprint-handle">
            <circle cx={planPoint(centre[0], centre[1]).x} cy={planPoint(centre[0], centre[1]).y} r="11"/></g>
          <g role="slider" tabIndex={locked ? -1 : 0} aria-label="Relative size" aria-disabled={locked || undefined}
            aria-valuetext={`relative size ${format(live!.size)}`}
            onPointerDown={event => down(event, 'size')} onPointerMove={move} onPointerUp={up} onPointerCancel={() => {dragRef.current = null; hold(null)}}
            onKeyDown={event => keyOnHandle(event, 'size')} onKeyUp={keyUpOnHandle} className="native-blueprint-handle is-size">
            <circle cx={planPoint(outer.x, outer.y).x} cy={planPoint(outer.x, outer.y).y} r="9"/></g>
        </>}
      </svg>
      <p className="native-blueprint-readout">{live ? `Centre X ${format(live.translation[0])}, Y ${format(live.translation[1])} · size ${format(live.size)} · rotation ${format(live.rotationDegrees[0])}, ${format(live.rotationDegrees[1])}, ${format(live.rotationDegrees[2])}°${dirty ? ' · draft, not yet applied' : ''}` : 'No blueprint to draw'}</p>
      <small>A configuration diagram: the Stage shows the physical result. Each number is a bound member's sixfold position, drawn under the transform. Drag the centre or the outer handle, or use the arrow keys (0.05; Shift 0.5). Escape cancels a drag. A release sends one whole transform. Relative size 1 is {format(BLUEPRINT_BASE_SIZE / BLUEPRINT_WORLD_SCALE)} stage units from the centre to a member.</small>
    </section>

    <section className="native-blueprint-section" aria-labelledby="native-blueprint-transform-title">
      <header><h3 id="native-blueprint-transform-title">Whole transform</h3><span>{live ? 'applies to all bound roles' : 'bind first'}</span></header>
      <div className="native-blueprint-fields">{FIELD_KEYS.map(key => {
        const value = live ? format(fieldValue(live, key)) : ''
        const shown = texts[key] ?? value, problem = problems[key], id = `native-blueprint-${key}`
        return <label key={key} className="native-blueprint-field"><span>{FIELD_LABELS[key]}</span>
          <input id={id} type="number" inputMode="decimal" step={key === 'rx' || key === 'ry' || key === 'rz' ? 1 : 0.05}
            min={FIELD_RANGE[key][0]} max={FIELD_RANGE[key][1]} value={shown} disabled={locked || !live}
            aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-bounds` : undefined}
            onChange={event => setTexts(current => ({...current, [key]: event.currentTarget.value}))}
            onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); apply()} else if (event.key === 'Escape') {event.preventDefault(); setTexts(current => {const next = {...current}; delete next[key]; return next}); setProblems(current => {const next = {...current}; delete next[key]; return next})}}}/>
          {problem && <small id={`${id}-bounds`} className="native-blueprint-bounds">{problem}</small>}</label>
      })}</div>
      <div className="native-blueprint-actions">
        <button type="button" disabled={locked || !live} onClick={apply}>Apply whole transform</button>
        <button type="button" disabled={locked || (!dirty && !Object.keys(texts).length)} onClick={discard}>Discard draft</button>
      </div>
      <small>Position is in stage units (native / {BLUEPRINT_WORLD_SCALE}), rotation in degrees, relative size from the native scale / {BLUEPRINT_BASE_SIZE}. Enter applies; Escape reverts a field.</small>
    </section>

    {fault && <div className="native-blueprint-fault" role="alert"><p>{fault.message}</p>
      <button type="button" disabled={locked} onClick={() => void send(fault.retry)}>Retry</button>
      <button type="button" disabled={locked} onClick={discard}>Discard</button></div>}
  </div>
}

