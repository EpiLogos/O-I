import {useRef, useState} from 'react'
import type {NativeEditorChange} from '../../../../expressions-boundary/src/editor'
import {short} from './nativeFieldFaceValues.ts'
import {
  ARRANGE_LAYOUTS, PLANES, PREVIEW_HEIGHT, PREVIEW_WIDTH, arrangeLabel, arrangePlan, blueprintMemberIds, centreStatus, planeAxes, planeChange,
  previewGeometry, previewMoves, quickSelect, recordedLayout, type ArrangeLayout, type Plane, type QuickSelect,
} from './nativeSceneFace.arrange.ts'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import './NativeSceneFace.arrange.css'

const QUICK: readonly {which: QuickSelect; label: string}[] = [
  {which: 'formations', label: 'Formations'}, {which: 'pins', label: 'Pins'}, {which: 'all', label: 'All'}, {which: 'none', label: 'None'},
]

/** The Arrangement device's whole expanded panel. The object checklist is local: the boundary's `select` takes one entity, so checking
 * here never changes the native selection. Apply sends one batched `apply`: one `parameter` change per coordinate that moves, then the
 * chosen mode as a `panel-setting` for Scene.composition.layout, so one undo restores both. A plane choice sends its own single
 * `panel-setting`. The header shows the layout the Scene records (reading.scene.composition.layout), not the local preview choice.
 * Refusals from the owner are shown in a role=alert line and keep the choice for another try. */
export function ArrangePanel({reading, apply, disabled}: SceneFacePanelProps) {
  const entities = reading.scene.entities
  const plane = reading.scene.composition.plane
  const blueprint = blueprintMemberIds(reading.scene)
  const sceneRef = reading.basis.scene_ref
  const [boundScene, setBoundScene] = useState(sceneRef)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(reading.selection.entity_ids))
  const [mode, setMode] = useState<ArrangeLayout | null>(null)
  // The checklist is a batch set, not the spine selection. A new Scene starts it from that Scene's selection.
  if (boundScene !== sceneRef) {
    setBoundScene(sceneRef)
    setChecked(new Set(reading.selection.entity_ids))
    setMode(null)
  }
  const recorded = recordedLayout(reading.scene)
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState<string | null>(null)
  const inFlight = useRef(false)
  const locked = disabled || busy || reading.standing.pending

  const plan = arrangePlan(entities, checked, blueprint, mode, plane)
  const checkedCount = entities.filter(entity => checked.has(entity.id) && centreStatus(entity, blueprint).movable).length
  const [horizontal, vertical] = planeAxes(plane)
  const preview = previewGeometry(entities, mode ? plan.ghost : [], plane)
  const currentAt = new Map(preview.current.map(mark => [mark.id, mark]))
  const moves = mode ? previewMoves(entities, plan) : []
  const coordinateChanges = plan.changes.filter(change => change.kind === 'parameter').length
  const note = mode && !fault && !plan.problem && plan.movable.length && !coordinateChanges
    ? `The checked centres already sit where ${arrangeLabel(mode)} puts them. Apply still records ${arrangeLabel(mode)} as the Scene's layout.` : null

  // One batch per call, one in flight at a time. A refusal is shown and the checklist, mode and plane choice are kept.
  const send = async (changes: readonly NativeEditorChange[]): Promise<boolean> => {
    if (inFlight.current || locked || !changes.length) return false
    inFlight.current = true; setBusy(true); setFault(null)
    try {
      const reply = await apply([...changes])
      if (reply.ok) return true
      setFault(reply.error)
      return false
    } catch (cause) {
      setFault(cause instanceof Error ? cause.message : String(cause))
      return false
    } finally {inFlight.current = false; setBusy(false)}
  }
  const applyArrangement = async () => {
    if (await send(plan.changes)) setMode(null)
  }
  const choosePlane = async (next: Plane) => {
    if (next === plane) return
    await send([planeChange(next)])
  }
  const toggle = (id: string, on: boolean) => {
    setFault(null)
    setChecked(current => {const next = new Set(current); if (on) next.add(id); else next.delete(id); return next})
  }
  const quick = (which: QuickSelect) => {setFault(null); setChecked(quickSelect(entities, which, blueprint))}

  return <div className="native-arrange-face" aria-label="Arrangement">
    <section className="native-arrange-face-section" aria-labelledby="native-arrange-objects-title">
      <header><h3 id="native-arrange-objects-title">Objects</h3><span>{entities.length} {entities.length === 1 ? 'object' : 'objects'} · {checkedCount} checked</span></header>
      <div className="native-arrange-face-quick" role="group" aria-label="Quick selects">
        {QUICK.map(item => <button key={item.which} type="button" disabled={locked} onClick={() => quick(item.which)}>{item.label}</button>)}
      </div>
      {entities.length
        ? <ul className="native-arrange-face-objects" aria-label="Objects in this Scene">{entities.map(entity => {
          const status = centreStatus(entity, blueprint), reasonId = `native-arrange-reason-${entity.id}`
          return <li key={entity.id}>
            <label className={`native-arrange-face-row${status.movable ? '' : ' is-disabled'}`}>
              <input type="checkbox" aria-label={`Arrange ${entity.name}`} checked={status.movable && checked.has(entity.id)}
                disabled={locked || !status.movable} aria-describedby={status.reason ? reasonId : undefined}
                onChange={event => toggle(entity.id, event.currentTarget.checked)}/>
              <span className="native-arrange-face-kind">{entity.kind === 'pin' ? 'Pin' : 'Formation'}</span>
              <span className="native-arrange-face-name">{entity.name}</span>
              <span className="native-arrange-face-at">{short(entity.position.x)}, {short(entity.position.y)}, {short(entity.position.z)}</span>
            </label>
            {status.reason && <small id={reasonId}>{status.reason}</small>}
          </li>
        })}</ul>
        : <p className="native-arrange-face-empty">This Scene has no objects. Add a formation or a pin first.</p>}
      <small>The shell reads one selected object at a time, so this checklist is local: checking here does not change the native selection. Arrange moves only the checked, unlocked centres that are not Blueprint members.</small>
    </section>

    <section className="native-arrange-face-section" aria-labelledby="native-arrange-arrangement-title">
      <header><h3 id="native-arrange-arrangement-title">Arrangement</h3><span>{recorded ? `Recorded: ${arrangeLabel(recorded)}` : 'No layout recorded'}</span></header>
      <span id="native-arrange-mode-title" className="native-arrange-face-caption">Arrange mode</span>
      <div className="native-arrange-face-modes" role="group" aria-labelledby="native-arrange-mode-title">
        {ARRANGE_LAYOUTS.map(layout => <button key={layout} type="button" aria-pressed={mode === layout} disabled={locked}
          onClick={() => {setFault(null); setMode(layout)}}>{arrangeLabel(layout)}</button>)}
      </div>
      <label className="native-arrange-face-field"><span>Layout plane</span>
        <select aria-label="Layout plane" value={plane} disabled={locked} onChange={event => void choosePlane(event.currentTarget.value as Plane)}>
          {PLANES.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <svg className="native-arrange-face-plane" viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`} role="img"
        aria-label={mode ? `Plane ${plane}: current positions and where ${arrangeLabel(mode)} puts the checked centres` : `Plane ${plane}: current positions`}>
        <line className="axis" x1={0} x2={PREVIEW_WIDTH} y1={PREVIEW_HEIGHT / 2} y2={PREVIEW_HEIGHT / 2}/>
        <line className="axis" x1={PREVIEW_WIDTH / 2} x2={PREVIEW_WIDTH / 2} y1={0} y2={PREVIEW_HEIGHT}/>
        <text className="axis-label" x={PREVIEW_WIDTH - 6} y={PREVIEW_HEIGHT / 2 - 5} textAnchor="end">{horizontal.toUpperCase()}</text>
        <text className="axis-label" x={PREVIEW_WIDTH / 2 + 5} y={12}>{vertical.toUpperCase()}</text>
        {preview.ghost.map(mark => {const from = currentAt.get(mark.id); return from
          ? <line key={`path-${mark.id}`} className="ghost-path" x1={from.x} y1={from.y} x2={mark.x} y2={mark.y}/> : null})}
        {preview.current.map(mark => <circle key={mark.id} className="mark-current" cx={mark.x} cy={mark.y} r={4}><title>{mark.name}</title></circle>)}
        {preview.ghost.map(mark => <circle key={`ghost-${mark.id}`} className="mark-ghost" cx={mark.x} cy={mark.y} r={5}>
          <title>{`${mark.name} after ${mode ? arrangeLabel(mode) : ''}`}</title></circle>)}
      </svg>
      <small>Configuration diagram of the {plane} plane ({horizontal.toUpperCase()} across, {vertical.toUpperCase()} up), in stage units. Filled marks are current positions; dashed rings are where the chosen mode puts the checked centres. It is not the stage view.{mode === 'laminate' ? ' Laminate stacks through depth, which this plane does not draw; the readout lists it.' : ''}</small>
      {moves.length > 0 && <ul className="native-arrange-face-moves" aria-label="Coordinates that change">
        {moves.map(move => <li key={move.id}>{move.name}: {move.text}</li>)}
      </ul>}

      {fault && <p role="alert" className="native-arrange-face-alert">{fault}</p>}
      {!fault && plan.problem && <p role="alert" className="native-arrange-face-alert">{plan.problem}</p>}
      {note && <p className="native-arrange-face-note">{note}</p>}
      <div className="native-arrange-face-actions">
        <button type="button" disabled={locked || plan.changes.length === 0}
          title={plan.changes.length ? `Sends ${coordinateChanges} coordinate changes and the layout ${mode ? arrangeLabel(mode) : ''} as one batch` : 'Choose a mode and check an unlocked centre it moves'}
          onClick={() => void applyArrangement()}>{mode ? `Apply ${arrangeLabel(mode)}` : 'Apply arrangement'}</button>
        <button type="button" disabled={locked || mode === null} onClick={() => {setFault(null); setMode(null)}}>Reset preview</button>
      </div>
      <small>Apply sends one change for each coordinate that moves, then the chosen mode as the Scene's layout. The owner applies them together, so one undo restores the positions and the layout.</small>
    </section>
  </div>
}
