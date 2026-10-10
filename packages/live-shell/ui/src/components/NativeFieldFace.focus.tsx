import {useEffect, useRef, useState, type DragEvent, type KeyboardEvent} from 'react'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import type {FieldFaceSwitchContext, FieldFaceView} from './nativeFieldFaceViews.tsx'
import {NativeFieldHandle} from './NativeFieldHandle'
import {
  FOCUS_PATHS, RULER_SECONDS, dropTarget, focusBinding, focusLoop, focusRoute, focusValue, reorder, routeOrderChange, rulerGeometry, type FocusRouteRow,
} from './nativeFieldFace.focus.ts'
import {short} from './nativeFieldFaceValues.ts'
import './NativeFieldFace.focus.css'

// Diagram geometry in the 360 x 160 surface. Seconds run at one fixed scale, so dragging a handle never rescales the drawing under the pointer.
const X0 = 20, WIDTH = 320, SCALE = WIDTH / RULER_SECONDS
const BAR_Y = 24, BAR_H = 18, DWELL_Y = 62, GLIDE_Y = 80, TINT_Y = 98, FOCUS_Y = 116
const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

/** Focus diagram: the engine's loop as segments, two seconds rulers with their handles, and two tint bars.
 * The bottom slider (entity tint, controlPath) is drawn by the surface at y=140, so nothing is drawn there. */
export const focusFaceView: FieldFaceView = {
  draw: ({reading, value, family, disabled, apply, captureCurrent, setDraft}) => {
    const scene = reading.scene, loop = focusLoop(scene)
    const dwell = Math.max(0, value(FOCUS_PATHS.dwell) ?? focusValue(scene, FOCUS_PATHS.dwell))
    const glide = Math.max(0, value(FOCUS_PATHS.glide) ?? focusValue(scene, FOCUS_PATHS.glide))
    const focusTint = clamp01(value(FOCUS_PATHS.focusTint) ?? focusValue(scene, FOCUS_PATHS.focusTint))
    const entityTint = clamp01(value(FOCUS_PATHS.entityTint) ?? focusValue(scene, FOCUS_PATHS.entityTint))
    const dwellBinding = focusBinding(FOCUS_PATHS.dwell), glideBinding = focusBinding(FOCUS_PATHS.glide), focusBindingRow = focusBinding(FOCUS_PATHS.focusTint)
    const end = X0 + WIDTH
    // One segment per step of the engine loop: a solid dwell, then a hatched glide, both to the seconds scale.
    let cursor = X0, drawnSteps = 0
    const segments = loop.steps.map((step, index) => {
      if (cursor >= end) return null
      const dwellWidth = Math.min(end - cursor, dwell * SCALE), glideWidth = Math.max(0, Math.min(end - cursor - dwellWidth, glide * SCALE))
      const start = cursor
      cursor += dwellWidth + glideWidth
      drawnSteps++
      return <g key={`${index}-${step.id}`}>
        <rect x={start} y={BAR_Y} width={dwellWidth} height={BAR_H} fill={step.tint} className="native-focus-dwell"><title>{`Formation ${step.number} · dwell ${short(dwell)} s`}</title></rect>
        <rect x={start + dwellWidth} y={BAR_Y} width={glideWidth} height={BAR_H} fill={step.tint} className="native-focus-glide-base" />
        <rect x={start + dwellWidth} y={BAR_Y} width={glideWidth} height={BAR_H} fill="url(#native-focus-hatch)" className="native-focus-glide"><title>{`Travel to next · glide ${short(glide)} s`}</title></rect>
        {dwellWidth >= 12 && <text x={start + dwellWidth / 2} y={BAR_Y + 12} textAnchor="middle" className="native-focus-seg-label">{step.number}</text>}
      </g>
    })
    const cut = drawnSteps < loop.steps.length
    const header = loop.steps.length === 0 ? 'No enabled formation on the route'
      : loop.parallel ? 'Parallel · route not played' : `Step ${short(loop.period)} s · cycle ${loop.steps.length} = ${short(loop.cycleSeconds)} s`
    const dwellRuler = rulerGeometry(dwellBinding, X0, DWELL_Y, SCALE), glideRuler = rulerGeometry(glideBinding, X0, GLIDE_Y, SCALE)
    const focusRuler = rulerGeometry(focusBindingRow, X0, FOCUS_Y + 3, WIDTH)
    const ticks = [0, 10, 20, 30]
    return <>
      <defs>
        <linearGradient id="native-focus-tint" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{stopColor: 'var(--bg-3, #4a4e54)'}} />
          <stop offset="1" style={{stopColor: 'var(--accent, #ffbe00)'}} />
        </linearGradient>
        <pattern id="native-focus-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V4" className="native-focus-hatch-line" />
        </pattern>
      </defs>
      <text x={X0} y={14} className="native-graph-label">{cut ? 'Loop · bar cut at 30 s' : 'Loop · ruler 0–30 s'}</text>
      <text x={X0 + WIDTH} y={14} textAnchor="end" className="native-graph-label">{header}</text>
      <g className={loop.parallel ? 'native-focus-parked' : undefined}>
        <rect x={X0} y={BAR_Y} width={WIDTH} height={BAR_H} className="native-focus-track" />
        {loop.steps.length === 0 ? <text x={X0 + 4} y={BAR_Y + 12} className="native-graph-label">Add or enable a formation to route focus.</text> : segments}
      </g>
      <text x={X0} y={DWELL_Y - 6} className="native-graph-label">{`Dwell ${short(dwell)} s · solid`}</text>
      <path d={`M${X0 + dwellBinding.min * SCALE} ${DWELL_Y}H${X0 + RULER_SECONDS * SCALE}`} className="native-focus-ruler" />
      {ticks.map(tick => <path key={`d${tick}`} d={`M${X0 + tick * SCALE} ${DWELL_Y - 3}V${DWELL_Y + 3}`} className="native-focus-ruler" />)}
      <text x={X0} y={GLIDE_Y - 6} className="native-graph-label">{`Glide ${short(glide)} s · hatched`}</text>
      <path d={`M${X0 + glideBinding.min * SCALE} ${GLIDE_Y}H${X0 + RULER_SECONDS * SCALE}`} className="native-focus-ruler" />
      {ticks.map(tick => <path key={`g${tick}`} d={`M${X0 + tick * SCALE} ${GLIDE_Y - 3}V${GLIDE_Y + 3}`} className="native-focus-ruler" />)}
      <text x={X0} y={TINT_Y - 4} className="native-graph-label">{`Entity tint ${short(entityTint)}`}</text>
      <rect x={X0} y={TINT_Y} width={WIDTH} height={6} className="native-focus-track" />
      <rect x={X0} y={TINT_Y} width={entityTint * WIDTH} height={6} fill="url(#native-focus-tint)" />
      <text x={X0} y={FOCUS_Y - 6} className="native-graph-label">{`Focus tint ${short(focusTint)}`}</text>
      <rect x={X0} y={FOCUS_Y} width={WIDTH} height={6} className="native-focus-track" />
      <rect x={X0} y={FOCUS_Y} width={focusTint * WIDTH} height={6} fill="url(#native-focus-tint)" />
      <NativeFieldHandle reading={reading} path={FOCUS_PATHS.dwell} family={family} geometry={dwellRuler} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path={FOCUS_PATHS.glide} family={family} geometry={glideRuler} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <NativeFieldHandle reading={reading} path={FOCUS_PATHS.focusTint} family={family} geometry={focusRuler} disabled={disabled} apply={apply} captureCurrent={captureCurrent} onDraft={setDraft} />
      <text x={X0} y={156} className="native-graph-label">Solid dwell · hatched glide · no live focus position in the reading</text>
    </>
  },
  switches: ({reading, disabled, apply}) => <FocusSwitches reading={reading} disabled={disabled} apply={apply} />,
}

/** The non-numeric controls of the app's Travelling focus panel (inspector.ts:227-232), in app order. */
export function FocusSwitches({reading, disabled, apply}: {reading: NativeEditorReading; disabled: boolean; apply: FieldFaceSwitchContext['apply']}) {
  const scene = reading.scene, bindings = scene.semanticField?.bindings.length ?? 0
  return <div className="native-focus-switches">
    <section aria-label="Route through centres">
      <h4>Route through centres</h4>
      <label>Orchestration
        <select value={scene.composition.focus} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'focus', value: event.target.value as 'parallel' | 'travelling'}])}>
          <option value="parallel">Parallel</option><option value="travelling">Travelling focus</option>
        </select>
      </label>
      <FocusRoute reading={reading} disabled={disabled} apply={apply} />
    </section>
    <section aria-label="Timing and direction">
      <h4>Timing and direction</h4>
      <label>Traversal
        <select value={scene.engine.focusOrder ?? 'listed'} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'focusOrder', value: event.target.value as 'listed' | 'reverse' | 'pingpong'}])}>
          <option value="listed">Listed order</option><option value="reverse">Reverse order</option><option value="pingpong">There and back</option>
        </select>
      </label>
      <label><input type="checkbox" checked={scene.composition.carryTint === true} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'carryTint', value: event.target.checked}])} />Carry local tint</label>
      <small className="native-focus-note">Setting Focus Tint Weight above 0 switches this on.</small>
      {bindings > 0
        ? <p className="native-focus-note">Semantic resonance follows stable bindings when Shared tuning driver is Travelling focus. The focused entity itself does not carry a physical station index.</p>
        : <label><input type="checkbox" checked={scene.composition.carryStation === true} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'carryStation', value: event.target.checked}])} />Follow linked stations · legacy</label>}
    </section>
    <section aria-label="Visible contributions">
      <h4>Visible contributions</h4>
      <label>Shared tuning driver
        <select value={scene.composition.frequencyDriver} disabled={disabled} onChange={event => apply([{kind: 'panel-setting', key: 'frequencyDriver', value: event.target.value as 'manual' | 'focus' | 'automation'}])}>
          <option value="manual">Manual</option><option value="focus">Travelling focus</option><option value="automation">Automation</option>
        </select>
      </label>
      <small className="native-focus-note">Also in Resonance: the same setting as “Shared frequency is driven by”.</small>
    </section>
  </div>
}

/** The Scene's formation route as a reorderable list. Every drop, Alt+arrow or button press writes one route-order change. */
export function FocusRoute({reading, disabled, apply}: {reading: NativeEditorReading; disabled: boolean; apply: FieldFaceSwitchContext['apply']}) {
  const rows: FocusRouteRow[] = focusRoute(reading.scene)
  const order = rows.map(row => row.id).join('|')
  const [dragFrom, setDragFrom] = useState<number | null>(null), [insertion, setInsertion] = useState<number | null>(null)
  const list = useRef<HTMLOListElement>(null), pendingFocus = useRef<string | null>(null)
  // Keyboard moves keep focus on the moved row once the new order arrives.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    Array.from(list.current?.querySelectorAll<HTMLElement>('li[data-route-id]') ?? []).find(item => item.dataset.routeId === id)?.focus()
  }, [order])
  const move = (from: number, to: number) => {
    const ids = rows.map(row => row.id), next = reorder(ids, from, to)
    if (from === to || next.every((id, index) => id === ids[index])) return
    pendingFocus.current = ids[from] ?? null
    void apply([routeOrderChange(next)]).then(reply => {if (!(reply as {ok?: boolean} | undefined)?.ok) pendingFocus.current = null})
  }
  const onDragStart = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', rows[index]?.id ?? '')
    setDragFrom(index)
  }
  const onDragOver = (event: DragEvent<HTMLElement>, index?: number) => {
    if (dragFrom === null) return
    event.preventDefault()
    if (index === undefined) return
    const box = event.currentTarget.getBoundingClientRect()
    setInsertion(event.clientY < box.top + box.height / 2 ? index : index + 1)
  }
  const onDrop = (event: DragEvent<HTMLOListElement>) => {
    if (dragFrom === null || insertion === null) return
    event.preventDefault()
    const from = dragFrom, to = dropTarget(from, insertion, rows.length)
    setDragFrom(null); setInsertion(null)
    move(from, to)
  }
  const onRowKey = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (disabled || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    move(index, index + (event.key === 'ArrowUp' ? -1 : 1))
  }
  const dropBefore = (index: number) => dragFrom !== null && insertion === index && insertion !== dragFrom && insertion !== dragFrom + 1
  const dropAfter = (index: number) => dragFrom !== null && index === rows.length - 1 && insertion === rows.length && dragFrom !== index
  return <div className="native-focus-route">
    <p className="native-focus-note">{rows.length === 0 ? 'This Scene has no formation. Add one to route focus.' : 'Drag a row, or select it and press Alt+↑ or Alt+↓. Enabled formations play in this order.'}</p>
    <ol ref={list} onDragOver={event => onDragOver(event)} onDrop={onDrop} onDragEnd={() => {setDragFrom(null); setInsertion(null)}}>
      {rows.map((row, index) => <li key={row.id} data-route-id={row.id} tabIndex={disabled ? -1 : 0} draggable={!disabled}
        className={[row.enabled ? '' : 'is-idle', dragFrom === index ? 'is-dragging' : '', dropBefore(index) ? 'is-drop-before' : '', dropAfter(index) ? 'is-drop-after' : ''].filter(Boolean).join(' ')}
        onDragStart={event => onDragStart(event, index)} onDragOver={event => onDragOver(event, index)} onKeyDown={event => onRowKey(event, index)}>
        <span className="native-focus-route-number">{row.number}</span>
        <i className="native-focus-route-swatch" style={{background: row.tint}} aria-hidden="true" />
        <span className="native-focus-route-name">{row.name}{!row.enabled && <small> · not in the engine route</small>}</span>
        <button type="button" disabled={disabled || index === 0} aria-label={`Move ${row.name} earlier`} onClick={() => move(index, index - 1)}>▲</button>
        <button type="button" disabled={disabled || index === rows.length - 1} aria-label={`Move ${row.name} later`} onClick={() => move(index, index + 1)}>▼</button>
      </li>)}
    </ol>
  </div>
}
