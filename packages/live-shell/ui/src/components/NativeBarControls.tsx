import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {HostedAppState, StageCommand, StageResult} from '@epilogos/expressions-boundary'
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import {stageDisabledReason, stagePinRepeat, stageTool} from '../native/stageCommands'
import type {BarValueSession} from './nativeBarSession'
import {barEngineLight, barPointer, barRepeatPins, barToolRail, formatBarValue, parseBarValue, scrubBarValue, stepBarValue, type BarParameter, type EngineLight} from './nativeBarModel'

type Run = (command: StageCommand) => Promise<StageResult>
export type BarApply = (changes: readonly NativeEditorChange[]) => Promise<NativeEditorReply>
const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const ABBREVIATION: Record<string, string> = {select: 'S', interact: 'I', pin: 'P', text: 'T', formation: 'F'}

/** One compact numeric control: drag the label, type a value, or use the arrow keys. Base and effective stay apart;
 * Enter or release commits one gesture, Escape returns to the reading. */
export function BarValue({parameter, session, disabled, reason}: {parameter: BarParameter; session: BarValueSession; disabled: boolean; reason?: string | null}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const drag = useRef<{pointer: number; startX: number; start: number; value: number} | null>(null)
  useEffect(() => {setDraft(null); setFault(null)}, [parameter.target])
  const shown = draft ?? formatBarValue(parameter.base, parameter)
  const submit = async (value: number) => {
    if (value === parameter.base) {setDraft(null); return}
    setFault(null)
    const ok = await session.commit(value)
    if (ok) setDraft(null)
    else setFault(`${parameter.label} was not changed.`)
  }
  const commitText = () => {
    if (draft === null) return
    const value = parseBarValue(draft, parameter)
    if (value === null) {setFault(`${parameter.label} must be between ${parameter.hardMin} and ${parameter.hardMax}.`); return}
    void submit(value)
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {event.preventDefault(); commitText()}
    else if (event.key === 'Escape') {event.preventDefault(); session.cancel(); setDraft(null); setFault(null)}
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const current = draft === null ? parameter.base : parseBarValue(draft, parameter) ?? parameter.base
      void submit(stepBarValue(current, parameter, event.key === 'ArrowUp' ? 1 : -1, event.shiftKey))
    }
  }
  const down = (event: PointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {pointer: event.pointerId, startX: event.clientX, start: parameter.base, value: parameter.base}
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const gesture = drag.current
    if (!gesture || gesture.pointer !== event.pointerId) return
    const value = scrubBarValue(gesture.start, event.clientX - gesture.startX, parameter, event.shiftKey)
    gesture.value = value
    setDraft(formatBarValue(value, parameter))
    session.live(value)
  }
  const up = (event: PointerEvent<HTMLElement>) => {
    const gesture = drag.current
    if (!gesture || gesture.pointer !== event.pointerId) return
    drag.current = null
    if (gesture.value === gesture.start) {setDraft(null); return}
    void submit(gesture.value)
  }
  const escape = (event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape' || !drag.current) return
    drag.current = null; session.cancel(); setDraft(null)
  }
  useEffect(() => {window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape)})
  return <label className="bar-value" data-automated={parameter.automated} title={reason ?? `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ''}: drag the name, type a value, or use the arrow keys (Shift for ten steps).`}>
    <span className="bar-value-name" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => {drag.current = null; session.cancel(); setDraft(null)}}>{parameter.label}</span>
    <input type="text" inputMode="decimal" aria-label={parameter.label} value={shown} disabled={disabled}
      onChange={event => setDraft(event.target.value)} onBlur={commitText} onKeyDown={onKey} />
    {parameter.effective !== undefined && <small className="bar-value-effective" title="The automated value the engine is using now">→ {formatBarValue(parameter.effective, parameter)}</small>}
    {fault && <small role="alert" className="bar-value-fault">{fault}</small>}
  </label>
}

/** Ableton's Draw-mode slot: the stage tool rail, with Repeat pins while Pin is active. */
export function BarTools({state, run}: {state: HostedAppState | null; run: Run | null}) {
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const reason = stageDisabledReason({mounted: !!run, state, busy})
  const repeat = barRepeatPins(state)
  const send = (command: StageCommand) => {
    if (!run || busy) return
    setBusy(true); setRefusal(null)
    let answer: Promise<StageResult>
    try {answer = run(command)} catch (cause) {setBusy(false); setRefusal(reasonOf(cause)); return}
    void answer.then(result => {if (!result.ok) setRefusal(result.error)}, cause => setRefusal(reasonOf(cause))).finally(() => setBusy(false))
  }
  return <div className="bar-tools" role="group" aria-label="Stage tool">
    {barToolRail(state).map(item => <button key={item.tool} type="button" className="bar-tool" aria-label={item.label} aria-pressed={item.pressed}
      disabled={reason !== null} title={reason ?? item.label} onClick={() => send(stageTool(item.tool))}>
      <span className="bar-tool-full">{item.label}</span><span className="bar-tool-abbr" aria-hidden="true">{ABBREVIATION[item.tool]}</span></button>)}
    {repeat.visible && <button type="button" className="bar-tool" aria-label="Repeat pins" aria-pressed={repeat.pressed} disabled={reason !== null}
      title={reason ?? 'Keep placing pins after each click'} onClick={() => send(stagePinRepeat(repeat.pressed !== true))}>Repeat</button>}
    {refusal && <small role="alert" className="bar-fault">{refusal}</small>}
  </div>
}

/** The pointer force mode, click effect and scope, while Interact is the active tool. Each is one admitted panel-setting. */
export function BarPointerGroup({reading, state, apply, disabled}: {reading: NativeEditorReading | null; state: HostedAppState | null; apply: BarApply; disabled: boolean}) {
  const pointer = barPointer(reading, state)
  const [fault, setFault] = useState<string | null>(null)
  if (!pointer) return null
  const write = (change: NativeEditorChange) => {
    setFault(null)
    void apply([change]).then(reply => {if (!reply.ok) setFault(reply.error)}, cause => setFault(reasonOf(cause)))
  }
  return <div className="bar-pointer" role="group" aria-label="Pointer">
    <select aria-label="Pointer force" value={pointer.mode} disabled={disabled} title="Temporary pointer force"
      onChange={event => write({kind: 'panel-setting', key: 'pointerMode', value: event.target.value as typeof pointer.mode})}>
      {pointer.modes.map(mode => <option key={mode} value={mode}>{mode[0].toUpperCase() + mode.slice(1)}</option>)}</select>
    <select aria-label="Click effect" value={pointer.click} disabled={disabled} title="What a click does"
      onChange={event => write({kind: 'panel-setting', key: 'pointerClick', value: event.target.value as typeof pointer.click})}>
      {pointer.clicks.map(click => <option key={click} value={click}>{click === 'off' ? 'No click' : click[0].toUpperCase() + click.slice(1)}</option>)}</select>
    <select aria-label="Pointer scope" value={pointer.scope} disabled={disabled} title="Global: shared across this Expression's scenes. Local: this scene only."
      onChange={event => write({kind: 'panel-setting', key: 'pointerScope', value: event.target.value as typeof pointer.scope})}>
      <option value="global">Global</option><option value="local">Local</option></select>
    {fault && <small role="alert" className="bar-fault">{fault}</small>}
  </div>
}

/** The CPU-light slot: read-only engine status. */
export function BarEngineLight({state, playback}: {state: HostedAppState | null; playback: {field_paused: boolean} | null | undefined}) {
  const light: EngineLight = barEngineLight(state, playback)
  return <output className="bar-engine" data-kind={light.kind} title={light.title} aria-label={`Engine: ${light.label}`}><i aria-hidden="true" />{light.label}</output>
}
