import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {NativeAutomationChange, NativeAutomationLaneValues} from '../../../../expressions-boundary/src/editor'
import {NATIVE_AUTOMATION_BLENDS, NATIVE_AUTOMATION_EASINGS, NATIVE_AUTOMATION_LANE_LIMIT, NATIVE_AUTOMATION_LOOPS, NATIVE_AUTOMATION_TYPES, NATIVE_AUTOMATION_WAVES} from '../../../../expressions-boundary/src/nativeAutomationEdits'
import {automationTarget} from '../../../../expressions-boundary/src/parameters'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import {short} from './nativeFieldFaceValues.ts'
import {useFrameTakeLink} from '../native/frameTakes'
import {stageAutomationLoop, stageAutomationPlay} from '../native/stageCommands'
import {automationFrameReason, hasOneShotLeader, pauseAllChanges, playAllChanges} from './nativeSceneFace.automation.ts'
import {
  BLEND_LABELS, EASING_LABELS, LOOP_LABELS, TYPE_LABELS, WAVE_LABELS, addLaneChange, addLaneProblem, admittedTargets, dragLaneIds, effectiveLane, effectiveReadout,
  handleFrame, handlePosition, handleStep, handleValue, laneCurve, laneFieldBounds, laneFieldLabel, laneFieldStep, laneGroups, laneLine, laneRole,
  laneValuesChange, linkLaneChange, moveLaneIds, orderLanesChange, parseLaneNumber, removeLaneChange, targetLabel, valueFraction,
  type Lane, type LaneGroup, type LaneHandle, type LaneNumber, type LaneRole,
} from './nativeSceneFace.automation.ts'
import './NativeSceneFace.automation.css'

type Fault = {message: string; retry: readonly NativeAutomationChange[]}
type Draft = {laneId: string; handle: LaneHandle; value: number}
type Gesture = {laneId: string; handle: LaneHandle; frame: ReturnType<typeof handleFrame>}
const ARROW: Record<string, 1 | -1> = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1}
const SVG_WIDTH = 1000, SVG_HEIGHT = 400
const omit = <T,>(record: Record<string, T>, key: string): Record<string, T> => {const next = {...record}; delete next[key]; return next}
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** One choice control: a native select whose options and labels come from the boundary's own lists. */
function choiceField<T extends string>({label, value, options, labels, disabled, onPick, note}: {label: string; value: T; options: readonly T[];
  labels: Record<T, string>; disabled: boolean; onPick: (next: T) => void; note?: string | null}) {
  return <label className="native-automation-face-field"><span>{label}</span>
    <select aria-label={label} value={value} disabled={disabled} onChange={event => onPick(event.currentTarget.value as T)}>
      {options.map(option => <option key={option} value={option}>{labels[option]}</option>)}</select>
    {note && <small>{note}</small>}</label>
}

/** The Automation device's whole expanded panel. Lanes are listed in engine order and nested by group. The selected lane's shape is drawn
 * from its own settings with the engine's waveform and ease; its handles drag one field each and commit ONE automation-set on release.
 * Every write goes through `apply`; a refusal keeps the draft with Retry and Discard. */
export function AutomationFacePanel({reading, apply, disabled}: SceneFacePanelProps) {
  const scene = reading.scene
  const lanes = scene.automation ?? []
  const ids = lanes.map(lane => lane.id)
  const {groups, problem: groupProblem} = laneGroups(lanes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = lanes.find(lane => lane.id === selectedId) ?? lanes[0] ?? null
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState<Fault | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [addTo, setAddTo] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const inFlight = useRef(false), draftRef = useRef<Draft | null>(null), gesture = useRef<Gesture | null>(null), plot = useRef<HTMLDivElement>(null)
  const locked = disabled || busy || reading.standing.pending
  const hold = (next: Draft | null) => {draftRef.current = next; setDraft(next)}

  // One change per call, one in flight at a time. Success clears every draft; a refusal keeps the draft with the reason for Retry or Discard.
  const send = async (changes: readonly NativeAutomationChange[]): Promise<boolean> => {
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
  const revert = (draftKey: string) => {setDrafts(current => omit(current, draftKey)); setProblems(current => omit(current, draftKey))}

  const selectedGroup: LaneGroup | undefined = selected ? groups.find(group => group.leader.id === selected.id || group.followers.some(lane => lane.id === selected.id)) : undefined
  const role: LaneRole | null = selected ? laneRole(lanes, selected) : null
  const inherited = role === 'follower'
  const leaderLabel = inherited && selectedGroup ? targetLabel(scene, selectedGroup.leader.target).label : ''
  const hard = selected ? automationTarget(scene, selected.target) : undefined
  const effective = selected ? effectiveLane(lanes, selected) : null
  const frame = hard && effective ? handleFrame(effective, hard) : null
  // The draft is applied to the displayed lane only, so the diagram and the handle move together while the pointer is down.
  const shown: Lane | null = selected && effective && draft && draft.laneId === selected.id ? {...effective, [draft.handle]: draft.value} as Lane : effective
  const curve = shown && frame ? laneCurve(shown, frame.xMax) : null
  const handles: LaneHandle[] = shown && curve
    ? ['min', 'max', ...(curve.start ? ['phase' as const] : []), ...(shown.type === 'ramp' ? ['delay' as const, 'duration' as const] : [])] : []
  const yAt = (value: number) => valueFraction(value, hard ?? {hardMin: 0, hardMax: 1})
  const path = curve && curve.kind !== 'drive' && hard ? curve.points.map((point, index) =>
    `${index ? 'L' : 'M'}${(point.x / curve.xMax * SVG_WIDTH).toFixed(1)} ${(yAt(point.y) * SVG_HEIGHT).toFixed(1)}`).join(' ') : ''
  const addProblem = addLaneProblem(lanes)
  // Play-all, pause-all and loop (app.ts automation-play, automation-pause, automation-loop). Pause and the enabling step of play are
  // document changes sent through apply; the fire and the loop flag are runtime commands through the mounted frame's own link.
  const link = useFrameTakeLink()
  const [runFault, setRunFault] = useState<string | null>(null)
  const frameReason = automationFrameReason(link)
  const loopOn = link.state?.automationLoop === true
  const runFrame = async (command: Parameters<NonNullable<typeof link.run>>[0]) => {
    if (!link.run) return
    try {const result = await link.run(command); setRunFault(result.ok ? null : result.error)}
    catch (cause) {setRunFault(cause instanceof Error ? cause.message : String(cause))}
  }
  const playAll = async () => {
    setRunFault(null)
    const held = playAllChanges(lanes)
    if (held.length && !(await send(held))) return
    await runFrame(stageAutomationPlay)
  }
  const pauseAll = () => {
    setRunFault(null)
    const changes = pauseAllChanges(lanes)
    if (changes.length) void send(changes)
  }
  const entityId = reading.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : null
  const entityName = entityId ? scene.entities.find(entity => entity.id === entityId)?.name?.trim() || 'Selected object' : null
  const picker = admittedTargets(scene, lanes, entityId, search)
  const shownField = picker.field.slice(0, 80)

  // ---- Edits -------------------------------------------------------------------

  const commitNumber = (lane: Lane, key: LaneNumber, raw: string) => {
    if (inFlight.current || !hard) return
    const draftKey = `${lane.id}:${key}`
    const label = laneFieldLabel(key, lane.type)
    const parsed = parseLaneNumber(raw, laneFieldBounds(key, hard), label)
    if (parsed.problem !== null) {const message = parsed.problem; setProblems(current => ({...current, [draftKey]: message})); return}
    setProblems(current => omit(current, draftKey))
    const change = laneValuesChange(lane, {[key]: parsed.value} as NativeAutomationLaneValues)
    if (!change) {setDrafts(current => omit(current, draftKey)); return}
    void send([change])
  }

  // Pointer drag keeps a local draft; release sends one automation-set for the one field. Escape cancels.
  const pressHandle = (event: PointerEvent<HTMLDivElement>, handle: LaneHandle) => {
    if (locked || !selected || !frame || !shown) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {laneId: selected.id, handle, frame}
    hold({laneId: selected.id, handle, value: shown[handle]})
  }
  const dragHandle = (event: PointerEvent<HTMLDivElement>) => {
    const live = gesture.current, box = plot.current?.getBoundingClientRect()
    if (!live || !box || !(box.width > 0) || !(box.height > 0) || !effective) return
    hold({laneId: live.laneId, handle: live.handle, value: handleValue(live.handle, {x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height}, effective, live.frame)})
  }
  const releaseHandle = (lane: Lane) => {
    const live = gesture.current, final = draftRef.current
    gesture.current = null
    if (!live || !final || final.laneId !== lane.id) {hold(null); return}
    const change = laneValuesChange(lane, {[final.handle]: final.value} as NativeAutomationLaneValues)
    if (!change) {hold(null); return}
    void send([change])
  }
  const keyHandle = (event: KeyboardEvent<HTMLDivElement>, handle: LaneHandle) => {
    if (!selected || !hard) return
    if (event.key === 'Escape') {if (gesture.current || draftRef.current) {event.preventDefault(); gesture.current = null; hold(null)} return}
    const direction = ARROW[event.key]
    if (!direction || locked) return
    event.preventDefault()
    const live = draftRef.current && draftRef.current.laneId === selected.id && draftRef.current.handle === handle ? draftRef.current.value : selected[handle]
    const change = laneValuesChange(selected, {[handle]: handleStep(handle, live, direction, event.shiftKey, hard)} as NativeAutomationLaneValues)
    if (change) void send([change])
  }

  const moveLane = (laneId: string, delta: -1 | 1) => {
    const next = moveLaneIds(ids, laneId, delta)
    if (next) void send([orderLanesChange(next)])
  }
  const addTarget = async (target: string) => {
    const ok = await send([addLaneChange(target, addTo || undefined)])
    if (ok) {setPickerOpen(false); setSearch('')}
  }
  const linkTo = (value: string) => {
    if (!selected) return
    const next = value === '' ? null : value
    if ((selected.syncWith ?? null) === next) return
    void send([linkLaneChange(selected.id, next)])
  }
  const removeSelected = (scope: 'lane' | 'group-target') => {
    if (selected) void send([removeLaneChange(selected.id, scope)])
  }

  // ---- Rendering pieces ------------------------------------------------------------

  const numberField = (key: LaneNumber, reason: string | null) => {
    if (!selected || !shown || !hard) return null
    const bounds = laneFieldBounds(key, hard), label = laneFieldLabel(key, shown.type)
    const draftKey = `${selected.id}:${key}`, problem = problems[draftKey], text = drafts[draftKey] ?? String(shown[key])
    return <label className="native-automation-face-field" key={draftKey}>
      <span>{label}</span>
      <input id={draftKey} type="number" aria-label={label} aria-invalid={problem ? true : undefined} aria-describedby={`${draftKey}-bounds`}
        disabled={locked || reason !== null} value={text} min={bounds.min} max={bounds.max} step={laneFieldStep(key, hard)}
        onChange={event => setDrafts(current => ({...current, [draftKey]: event.currentTarget.value}))}
        onBlur={() => commitNumber(selected, key, text)}
        onKeyDown={event => {
          // Escape reverts only: committing here would send the stale draft from this render.
          if (event.key === 'Escape') {event.preventDefault(); revert(draftKey)}
          else if (event.key === 'Enter') {event.preventDefault(); commitNumber(selected, key, text)}
        }}/>
      <small id={`${draftKey}-bounds`} className={problem ? 'native-automation-face-bounds' : undefined}>
        {problem ?? `Range ${bounds.min} to ${bounds.max}${reason ? `. ${reason}` : ''}`}</small>
    </label>
  }

  const laneRow = (lane: Lane, nested: boolean) => {
    const label = targetLabel(scene, lane.target).label
    const index = ids.indexOf(lane.id)
    const own = effectiveLane(lanes, lane)
    const runLabel = laneRole(lanes, lane) === 'follower' ? 'Target enabled' : 'Run group'
    const isSelected = selected?.id === lane.id
    return <li key={lane.id} data-lane-id={lane.id}
      className={`native-automation-face-row${nested ? ' is-nested' : ''}${dragId === lane.id ? ' is-dragging' : ''}`}
      draggable={!locked} onDragStart={() => setDragId(lane.id)} onDragEnd={() => setDragId(null)}
      onDragOver={event => {if (dragId && dragId !== lane.id) event.preventDefault()}}
      onDrop={event => {
        event.preventDefault()
        if (!dragId) return
        const next = dragLaneIds(ids, dragId, lane.id)
        setDragId(null)
        if (next && !locked) void send([orderLanesChange(next)])
      }}>
      <button type="button" className="native-automation-face-lane" aria-pressed={isSelected} aria-label={`Select ${label}`}
        onClick={() => setSelectedId(lane.id)}
        onKeyDown={event => {
          if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {event.preventDefault(); if (!locked) moveLane(lane.id, event.key === 'ArrowUp' ? -1 : 1)}
        }}>
        <span>{nested ? '↳ ' : ''}{label}</span>
        <small>{laneLine(own)}</small>
      </button>
      <label className="native-automation-face-run"><input type="checkbox" checked={lane.enabled} disabled={locked} aria-label={`${runLabel}: ${label}`}
        onChange={event => {const change = laneValuesChange(lane, {enabled: event.currentTarget.checked}); if (change) void send([change])}}/>
        <span>{runLabel}</span></label>
      <span className="native-automation-face-order">
        <button type="button" disabled={locked || index === 0} aria-label={`Move ${label} earlier in the order`} onClick={() => moveLane(lane.id, -1)}>▲</button>
        <button type="button" disabled={locked || index === lanes.length - 1} aria-label={`Move ${label} later in the order`} onClick={() => moveLane(lane.id, 1)}>▼</button>
        <small>{index + 1} of {lanes.length}</small>
      </span>
    </li>
  }

  const leaderChoices = groups.map(group => group.leader).filter(lane => lane.id !== selected?.id)
  const readout = selected ? targetLabel(scene, selected.target) : null
  const observed = selected ? effectiveReadout(reading, selected.target) : null
  // Monitor: authored shape, or the live output the owner reports. The trace holds only the readings received (the bar polls while a lane runs).
  const [monitorMode, setMonitorMode] = useState<'authored' | 'live'>('authored')
  const trace = useRef<{target: string | null; values: number[]}>({target: null, values: []})
  const [, redraw] = useState(0)
  useEffect(() => {
    const target = selected?.target ?? null
    if (trace.current.target !== target) trace.current = {target, values: []}
    if (target && observed !== null) {
      const values = trace.current.values
      values.push(observed)
      if (values.length > MONITOR_TRACE_LIMIT) values.shift()
      redraw(count => count + 1)
    }
  }, [reading])
  const roleNote = role === 'leader'
    ? `Leads ${plural(selectedGroup?.followers.length ?? 0, 'other target')}. Source, wave, rate, phase, duration, delay, repeat and easing are edited here. Each target keeps its own low, high, blend and enabled.`
    : role === 'follower'
      ? `Follows ${leaderLabel}. Source, wave, rate, phase, duration, delay, repeat and easing come from the leader and are disabled here.`
      : 'Independent: this lane has its own shape.'
  const inheritedReason = inherited ? `Set by the group leader (${leaderLabel}).` : null
  const isRamp = shown?.type === 'ramp'
  const isMorph = shown?.type === 'lfo' && shown.wave === 'morph'

  return <div className="native-automation-face" aria-label="Automation">
    <section className="native-automation-face-section" aria-labelledby="native-automation-lanes-title">
      <header><h3 id="native-automation-lanes-title">Lanes</h3><span>{lanes.length} / {NATIVE_AUTOMATION_LANE_LIMIT}</span></header>
      <div className="native-automation-face-actions">
        <button type="button" disabled={locked || !!addProblem} aria-expanded={pickerOpen} title={addProblem ?? 'Choose a parameter to automate'}
          onClick={() => setPickerOpen(open => !open)}>+ Add lane</button>
        <button type="button" disabled={locked || !!frameReason || !hasOneShotLeader(lanes)} onClick={() => void playAll()}
          title={frameReason ?? (hasOneShotLeader(lanes) ? 'Enable every automation group and restart its one-shot ramps' : 'This Scene has no one-shot automation to play')}>Play all</button>
        <button type="button" disabled={locked || pauseAllChanges(lanes).length === 0} onClick={pauseAll}
          title="Hold every automation group at its base; Play all restarts them">Pause all</button>
        <button type="button" aria-pressed={loopOn} disabled={locked || !!frameReason} onClick={() => void runFrame(stageAutomationLoop(!loopOn))}
          title={frameReason ?? 'Loop: whenever every one-shot has finished, fire them all again'}>Loop</button>
        {runFault && <small className="native-automation-face-fault" role="alert">{runFault}</small>}
      </div>
      <p className="native-automation-face-note">Order is semantic. The engine applies lanes in this order, and for each parameter the last enabled replacing lane wins.
        Move a row with the arrows, Alt+Up or Alt+Down, or drag it onto another row.</p>
      {pickerOpen && <section className="native-automation-face-picker" aria-labelledby="native-automation-picker-title">
        <header><h4 id="native-automation-picker-title">Choose a parameter</h4><button type="button" onClick={() => setPickerOpen(false)}>Close</button></header>
        <label className="native-automation-face-field"><span>Search parameters</span>
          <input type="search" aria-label="Search automation parameters" value={search} onChange={event => setSearch(event.currentTarget.value)}/></label>
        <label className="native-automation-face-field"><span>Add to</span>
          <select aria-label="Add to automation" value={addTo} disabled={locked} onChange={event => setAddTo(event.currentTarget.value)}>
            <option value="">New automation</option>
            {groups.map(group => <option key={group.leader.id} value={group.leader.id}>{`${targetLabel(scene, group.leader.target).label} group`}</option>)}
          </select></label>
        {addProblem && <p className="native-automation-face-bounds">{addProblem}</p>}
        <h5>Scene parameters</h5>
        <ul aria-label="Scene parameters">{shownField.map(item => <li key={item.target}>
          <button type="button" disabled={locked || !!addProblem} aria-label={`Automate ${item.label}`} onClick={() => void addTarget(item.target)}>{item.label}</button>
        </li>)}</ul>
        {picker.field.length > shownField.length && <small>{picker.field.length - shownField.length} more: search to narrow the list.</small>}
        <h5>{entityName ? `Object · ${entityName}` : 'Object'}</h5>
        {entityId
          ? <ul aria-label="Object parameters">{picker.entity.map(item => <li key={item.target}>
            <button type="button" disabled={locked || !!addProblem} aria-label={`Automate ${item.label}`} onClick={() => void addTarget(item.target)}>{item.label}</button>
          </li>)}</ul>
          : <small>Select one object to automate its parameters.</small>}
        <small>Adding a lane to the shared frequency also sets its driver to Automation, as the app does.</small>
      </section>}
      {groupProblem && <p className="native-automation-face-fault" role="alert">{groupProblem}</p>}
      {lanes.length
        ? <ol className="native-automation-face-groups" aria-label="Automation lanes in engine order">{groups.map(group => <li key={group.leader.id}>
          <ol aria-label={`${targetLabel(scene, group.leader.target).label} group`}>
            {laneRow(group.leader, false)}{group.followers.map(lane => laneRow(lane, true))}
          </ol></li>)}</ol>
        : <p className="native-automation-face-empty">No automation lanes in this Scene. Add one to drive a parameter over time.</p>}
    </section>

    <section className="native-automation-face-section" aria-labelledby="native-automation-selected-title">
      <header><h3 id="native-automation-selected-title">Selected lane</h3><span>{readout ? readout.label : 'None'}</span></header>
      {selected && readout && shown && effective && hard && curve ? <div className="native-automation-face-form">
        <p className="native-automation-face-note">{roleNote}</p>
        <figure className="native-automation-face-figure">
          <div ref={plot} className="native-automation-face-plot" role="group" aria-label={`${readout.label} curve`}
            onPointerMove={dragHandle} onPointerCancel={() => {gesture.current = null; hold(null)}}>
            {curve.kind !== 'drive' && <svg className="native-automation-face-svg" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <rect className="band" x="0" y={Math.min(yAt(shown.min), yAt(shown.max)) * SVG_HEIGHT} width={SVG_WIDTH}
                height={Math.abs(yAt(shown.max) - yAt(shown.min)) * SVG_HEIGHT}/>
              <line className="axis" x1="0" x2={SVG_WIDTH} y1="0" y2="0"/><line className="axis" x1="0" x2={SVG_WIDTH} y1={SVG_HEIGHT} y2={SVG_HEIGHT}/>
              <path className="curve" d={path} vectorEffect="non-scaling-stroke"/>
            </svg>}
            <span className="native-automation-face-axis is-top">{`${short(hard.hardMax)}${readout.unit ? ` ${readout.unit}` : ''}`}</span>
            <span className="native-automation-face-axis is-bottom">{`${short(hard.hardMin)}${readout.unit ? ` ${readout.unit}` : ''}`}</span>
            {handles.map(handle => {
              const at = handlePosition(shown, handle, frame ?? handleFrame(effective, hard))
              const enabled = !locked && !(inherited && handle !== 'min' && handle !== 'max')
              const handleLabel = `${laneFieldLabel(handle, shown.type)} · ${readout.label}`
              return <div key={handle} role="slider" tabIndex={enabled ? 0 : -1} aria-disabled={enabled ? undefined : true}
                className={`native-automation-face-handle is-${handle}`} aria-label={handleLabel}
                aria-valuemin={laneFieldBounds(handle, hard).min} aria-valuemax={laneFieldBounds(handle, hard).max} aria-valuenow={shown[handle]}
                aria-valuetext={`${shown[handle]}${readout.unit ? ` ${readout.unit}` : ''}`}
                style={{left: `${at.x * 100}%`, top: `${at.y * 100}%`}}
                onPointerDown={event => {if (enabled) pressHandle(event, handle)}}
                onPointerUp={() => releaseHandle(selected)}
                onKeyDown={event => {if (enabled) keyHandle(event, handle)}}/>
            })}
          </div>
          <figcaption>Configuration diagram: computed from this lane's own settings with the engine's waveform and ease (engine/automation.ts), not a recording. {curve.note}</figcaption>
        </figure>
        {fault && <div className="native-automation-face-fault" role="alert"><p>{fault.message}</p>
          <button type="button" onClick={() => void send(fault.retry)}>Retry</button>
          <button type="button" onClick={() => {setDrafts({}); setProblems({}); hold(null); setFault(null)}}>Discard</button></div>}
        <div className="native-automation-face-pair">{numberField('min', null)}{numberField('max', null)}</div>
        <label className="native-automation-face-field"><span>Sync with leader</span>
          <select aria-label="Sync with leader" value={selected.syncWith ?? ''} disabled={locked || role === 'leader'}
            onChange={event => linkTo(event.currentTarget.value)}>
            <option value="">Not synced</option>
            {leaderChoices.map(lane => <option key={lane.id} value={lane.id}>{targetLabel(scene, lane.target).label}</option>)}
          </select>
          <small>{role === 'leader'
            ? 'This lane leads its group. Remove its other targets before it joins another group.'
            : 'Not synced copies the group settings onto this target, which then keeps them.'}</small></label>
        {choiceField({label: 'Source', value: shown.type, options: NATIVE_AUTOMATION_TYPES, labels: TYPE_LABELS, disabled: locked || inherited,
          note: inheritedReason, onPick: type => {const change = laneValuesChange(selected, {type}); if (change) void send([change])}})}
        {isRamp
          ? choiceField({label: 'Easing', value: shown.easing ?? 'smooth', options: NATIVE_AUTOMATION_EASINGS, labels: EASING_LABELS,
            disabled: locked || inherited, note: inheritedReason, onPick: easing => {const change = laneValuesChange(selected, {easing}); if (change) void send([change])}})
          : choiceField({label: 'Wave', value: shown.wave, options: NATIVE_AUTOMATION_WAVES, labels: WAVE_LABELS, disabled: locked || inherited,
            note: inheritedReason, onPick: wave => {const change = laneValuesChange(selected, {wave}); if (change) void send([change])}})}
        {isRamp
          ? <div className="native-automation-face-pair">{numberField('duration', inheritedReason)}{numberField('delay', inheritedReason)}</div>
          : isMorph ? <p className="native-automation-face-note">Morph drive has no rate or phase of its own here: it follows the Morph page phases.</p>
            : <div className="native-automation-face-pair">{numberField('rate', inheritedReason)}{numberField('phase', inheritedReason)}</div>}
        {isRamp && choiceField({label: 'Repeat', value: shown.loop, options: NATIVE_AUTOMATION_LOOPS, labels: LOOP_LABELS, disabled: locked || inherited,
          note: inheritedReason, onPick: loop => {const change = laneValuesChange(selected, {loop}); if (change) void send([change])}})}
        {choiceField({label: 'Blend', value: selected.blend, options: NATIVE_AUTOMATION_BLENDS, labels: BLEND_LABELS, disabled: locked,
          onPick: blend => {const change = laneValuesChange(selected, {blend}); if (change) void send([change])}})}
        <div className="native-automation-face-actions">
          {role === 'independent' && <button type="button" disabled={locked} aria-label={`Remove lane ${readout.label}`}
            onClick={() => removeSelected('lane')}>Remove lane</button>}
          {role === 'follower' && <button type="button" disabled={locked} aria-label={`Remove ${readout.label} from its group`}
            onClick={() => removeSelected('group-target')}>Remove from group</button>}
          {role === 'leader' && <button type="button" disabled={locked} aria-label={`Remove ${readout.label} from the group`}
            onClick={() => removeSelected('group-target')}>Remove this target</button>}
        </div>
        {role === 'leader' && <small className="native-automation-face-note">The group stays: its first remaining target takes over the shape.</small>}
        <section className="native-automation-face-monitor" aria-labelledby="native-automation-monitor-title">
          <header><h4 id="native-automation-monitor-title">Monitor</h4>
            <span role="group" aria-label="Monitor mode">
              <button type="button" aria-pressed={monitorMode === 'authored'} onClick={() => setMonitorMode('authored')}>Authored shape</button>
              <button type="button" aria-pressed={monitorMode === 'live'} onClick={() => setMonitorMode('live')}>Live output</button></span></header>
          {monitorMode === 'authored'
            ? <p>The diagram above shows the authored shape. Choose Live output for what the engine is using now.</p>
            : (() => {
              const shapeTrace = monitorTrace(trace.current.values)
              return shapeTrace.last === null
                ? <p>No live reading yet: the owner has not reported an effective value for this target.</p>
                : <figure className="native-automation-face-trace"><svg viewBox="0 0 240 48" role="img" aria-label={`Live output of ${readout.label}: ${short(shapeTrace.last)} now, between ${short(shapeTrace.min)} and ${short(shapeTrace.max)} over the last ${trace.current.values.length} readings`} preserveAspectRatio="none"><path d={shapeTrace.path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
                  <figcaption>{short(shapeTrace.min)} – {short(shapeTrace.max)}{readout.unit ? ` ${readout.unit}` : ''} · {trace.current.values.length} readings</figcaption></figure>
            })()}
          <dl className="native-automation-face-values">
            <div><dt>Base</dt><dd>{readout.base !== null ? `${short(readout.base)}${readout.unit ? ` ${readout.unit}` : ''}` : 'Not in this Scene'}</dd></div>
            <div><dt>Effective</dt><dd>{observed !== null ? `${short(observed)}${readout.unit ? ` ${readout.unit}` : ''}` : 'not in the reading'}</dd></div>
            <div><dt>Automated</dt><dd>{selected.enabled ? 'running' : 'paused'}</dd></div>
          </dl>
        </section>
      </div> : <p className="native-automation-face-empty">{selected ? 'This target is no longer in the Scene. Remove the lane to clear it.' : 'Add a lane to shape a parameter over time.'}</p>}
    </section>

    <p className="native-automation-face-disclosure">Not built here: restart and manual takeover, which change the document outside native history, and deleting a whole group.
      Those stay in the Studio's Automation section.</p>
  </div>
}
