// The frame's chrome on the shell's devices (T-FRAME-CHROME-ONTO-PLATES; manual §16.1 "A pane is a device at full size. Its controls stay
// out of the pane and appear in Device view below it"; PATH §1, owner 14 Oct: controls live in device UI, never as chrome inside a
// pane). The hosted frame stands its chrome down while the shell presents it in a pane and publishes that chrome as data with its state
// (expressions-app field-studies-journeys/src/presentedChrome.ts → the boundary's readHostedState `chrome`), read here from the one
// published channel (projections/expressionsPaneHost.ts useHostedChrome). Each control is drawn from the frame's own words and state and
// sent back as one `chrome` command through the frame's one runner, which presses the frame's own control: nothing here holds a value of
// a control, re-implements one, or reaches into the frame.
//
// Drawn in the device craft (owner, 15 Oct: "the ableton UI approach … no scrollers, no overuse of internal boxes"; ProjectCentral/docs/1-vision/dlw/DLW.md §16
// §5, the panel kit's controls, inhabitants/sdk/panel.tsx): a toggle is the kit's toggle, lit amber while the frame reads it pressed; a
// press the kit's action; a choice the kit's chooser under its small name; a number the frame bounds a value box (a range a dial) that
// sends on release; any other value a small field that commits on Enter or leaving it; a reading a line of mono words — keys flow in
// rows at the section's width, never in a box of their own.
import {useEffect, useRef, useState, type ReactNode} from 'react'
import type {FrameChromeControl, FrameChromeHome, FrameChromeReading, FramePresentation, HostedAppState} from '@epilogos/expressions-boundary'
import {useHostedChrome} from '../../../projections/expressionsPaneHost'
import {OwnerDial, OwnerValueBox} from '../../../frame/devices/plateControls'
import type {StageRun} from './StudioStage'
import './frameChrome.css'

const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

/** The frame's chrome and the one sender: the reading as the frame announced it, the presentation it stands in, and the frame's last
 * refusal of a press, in its words. */
export interface FrameChromeView {
  readonly reading: FrameChromeReading | null
  readonly presentation: FramePresentation | null
  /** Why every chrome control is off (no frame mounted, the last press still answering), or null. */
  readonly reason: string | null
  readonly refusal: string | null
  readonly send: (control: FrameChromeControl, value?: string) => void
}

/** The view over a frame's state and runner: one press at a time, its refusal kept until the next. */
export function useFrameChromeOver(state: HostedAppState | null, run: StageRun | null): FrameChromeView {
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const send = (control: FrameChromeControl, value?: string) => {
    if (!run || busy) return
    setBusy(true)
    setRefusal(null)
    let answer: ReturnType<StageRun>
    try {answer = run({command: 'chrome', id: control.id, ...(value !== undefined ? {value} : {})})} catch (cause) {setBusy(false); setRefusal(reasonOf(cause)); return}
    void answer.then(result => {if (!result.ok) setRefusal(result.error)}, cause => setRefusal(reasonOf(cause))).finally(() => setBusy(false))
  }
  const reason = !run ? 'No Expressions application is mounted.' : !state ? 'The Expressions application has not reported its state yet.'
    : !state.chrome ? 'This application does not publish its controls to the devices.' : busy ? 'The application is answering the last press.' : null
  return {reading: state?.chrome ?? null, presentation: state?.presentation ?? null, reason, refusal, send}
}

/** The view over the one hosted frame (the published chrome). */
export function useFrameChrome(): FrameChromeView {
  const chrome = useHostedChrome()
  return useFrameChromeOver(chrome?.state ?? null, chrome?.run ?? null)
}

/** The controls the frame places in one of its homes, in its order, without those another device already carries (named by the key the
 * frame gives them, `region/key`). */
export function controlsAt(reading: FrameChromeReading | null, homes: FrameChromeHome | readonly FrameChromeHome[], carried: ReadonlySet<string> = new Set()): FrameChromeControl[] {
  const wanted = new Set<string>(typeof homes === 'string' ? [homes] : homes)
  return (reading?.controls ?? []).filter(control => wanted.has(control.home) && !carried.has(control.id.replace(/~\d+$/, '')))
}

/** A control's word on its key: the frame's own short word, else its name. */
export const keyWord = (control: FrameChromeControl) => control.short ?? control.label
/** What a control does, in the frame's words, or why it is off. */
const hoverWords = (control: FrameChromeControl, reason: string | null) => reason ?? (control.disabled ? `${control.label} — off here${control.title ? `: ${control.title}` : ''}` : control.title && control.title !== control.label ? `${control.label} — ${control.title}` : control.label)

/** A value field: the frame's value shown, the person's typing a draft until Enter or leaving it commits it as one press. */
function ValueField({control, view, disabled}: {control: FrameChromeControl; view: FrameChromeView; disabled: boolean}) {
  const field = useRef<HTMLInputElement>(null)
  // A new value from the frame replaces an unsent draft (the frame's reading stands; the draft is presentation only).
  useEffect(() => {if (field.current && document.activeElement !== field.current) field.current.value = control.value ?? ''}, [control.value])
  const commit = () => {const value = field.current?.value ?? ''; if (value !== (control.value ?? '')) view.send(control, value)}
  return <label className="dp-cell frame-chrome-field" title={hoverWords(control, view.reason)} data-i={`${control.label}|${hoverWords(control, view.reason)}`}>
    <span className="dp-label">{keyWord(control)}</span>
    <input ref={field} className="plate-field-input" type={control.kind === 'number' ? 'number' : 'text'} defaultValue={control.value ?? ''} disabled={disabled} aria-label={control.label}
      min={control.min} max={control.max} step={control.step} onBlur={commit} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); commit()}}} />
  </label>
}

/** A number the frame bounds, swept: the kit's value box or dial (inhabitants/sdk/panel.tsx), the frame's value shown, the new value sent
 * as one press when the hand lets go (ProjectCentral/docs/1-vision/dlw/DLW.md §16.10). */
function sweepable(control: FrameChromeControl): {min: number; max: number; step?: number} | null {
  const min = Number(control.min), max = Number(control.max)
  return control.min !== undefined && control.max !== undefined && Number.isFinite(min) && Number.isFinite(max) && max > min
    ? {min, max, ...(control.step !== undefined && Number.isFinite(Number(control.step)) && Number(control.step) > 0 ? {step: Number(control.step)} : {})} : null
}

/** One control of the frame, drawn by its kind in the device craft: a toggle is the kit's toggle (amber when the frame reads it pressed),
 * a press the kit's action, a choice its chooser under a small name, a bounded number a value box or a dial, a reading a line. */
export function FrameControl({control, view}: {control: FrameChromeControl; view: FrameChromeView}) {
  const disabled = !!view.reason || !!control.disabled
  const words = hoverWords(control, view.reason)
  switch (control.kind) {
    case 'reading':
      return <span className="frame-chrome-reading" data-chrome={control.id} title={control.title ?? control.label} data-i={`${control.label}|${control.title ?? control.value ?? control.label}`}>
        {control.value && control.value !== control.label ? <><span className="frame-chrome-name">{control.label}</span> {control.value}</> : control.label}
      </span>
    case 'select': {
      const groups = [...new Set((control.options ?? []).map(option => option.group ?? ''))]
      return <label className="dp-cell dp-cell--chooser frame-chrome-choice" data-chrome={control.id} title={words} data-i={`${control.label}|${words}`}>
        <span className="dp-label">{keyWord(control)}</span>
        <select className="dp-chooser" value={control.value ?? ''} disabled={disabled} aria-label={control.label} onChange={event => view.send(control, event.target.value)}>
          {groups.map(group => {
            const options = (control.options ?? []).filter(option => (option.group ?? '') === group).map(option => <option key={`${group}|${option.value}`} value={option.value}>{option.label}</option>)
            return group ? <optgroup key={group} label={group}>{options}</optgroup> : options
          })}
        </select>
      </label>
    }
    case 'color':
      return <label className="dp-cell frame-chrome-swatch" data-chrome={control.id} title={words} data-i={`${control.label}|${words}`}>
        <input type="color" value={control.value || '#808080'} disabled={disabled} aria-label={control.label} onChange={event => view.send(control, event.target.value)} />
        <span className="dp-label">{keyWord(control)}</span>
      </label>
    case 'range':
    case 'number': {
      const range = sweepable(control)
      const value = Number(control.value)
      if (!range || control.value === undefined || control.value === '' || !Number.isFinite(value)) return <span data-chrome={control.id}><ValueField control={control} view={view} disabled={disabled} /></span>
      const scale = {min: range.min, max: range.max, ...(range.step ? {step: range.step} : {})}
      const format = (v: number) => `${+v.toFixed(range.step && range.step < 1 ? 2 : 0)}`
      const commit = disabled ? undefined : (v: number) => view.send(control, String(v))
      return <span className="frame-chrome-sweep" data-chrome={control.id} title={words}>
        {control.kind === 'range'
          ? <OwnerDial label={keyWord(control)} does={words} value={value} def={value} scale={scale} format={format} onCommit={commit} why={disabled ? words : undefined} />
          : <OwnerValueBox label={keyWord(control)} does={words} value={value} def={value} scale={scale} format={format} onCommit={commit} why={disabled ? words : undefined} />}
      </span>
    }
    case 'text':
      return <span data-chrome={control.id}><ValueField control={control} view={view} disabled={disabled} /></span>
    case 'toggle':
    case 'button':
      return <button type="button" className={`${control.kind === 'toggle' ? 'dp-toggle' : 'dp-action'} frame-chrome-key`} data-chrome={control.id} disabled={disabled} title={words} data-i={`${control.label}|${words}`}
        aria-label={control.label} aria-pressed={control.kind === 'toggle' ? !!control.pressed : undefined} onClick={() => view.send(control)}>{keyWord(control)}</button>
  }
}

/** A run of the frame's controls, in its order: keys flow in rows, choices and values stand under their names. */
export function FrameControls({controls, view, label}: {controls: readonly FrameChromeControl[]; view: FrameChromeView; label: string}): ReactNode {
  if (!controls.length) return null
  return <div className="frame-chrome" role="group" aria-label={label}>
    {controls.map(control => <FrameControl key={control.id} control={control} view={view} />)}
  </div>
}

/** A parameter the manual names that no owner carries yet: drawn as its switch with nothing lit, dim, its reason on the status line —
 * never as a working control (the mockup's waiting rows). */
export function WaitingRow({name, values, why}: {name: string; values: string; why: string}) {
  const choices = values.split(' · ').map(value => value.trim()).filter(Boolean)
  const kind = choices.length > 5 ? 'chooser' : choices.length > 1 ? 'radio' : 'reading'
  return <div className={`dp-cell dp-cell--${kind} frame-chrome-waiting`} data-waiting="true" title={`${name} — ${why}`} data-disabled="true" data-i={`${name}|${why}`}>
    <span className="dp-label">{name}</span>
    {kind === 'radio' ? <div className="dp-radio" role="radiogroup" aria-label={name}>{choices.map(choice => <button key={choice} type="button" role="radio" aria-checked={false} disabled>{choice}</button>)}</div>
      : kind === 'chooser' ? <select className="dp-chooser" aria-label={name} value="" disabled><option value="">—</option>{choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select>
      : <span className="frame-chrome-values">{values}</span>}
  </div>
}
