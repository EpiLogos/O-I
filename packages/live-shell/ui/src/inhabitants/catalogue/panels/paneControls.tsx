// The controls an instrument draws over its own pane, on a device (O-I #762; manual §16.3: "A pane holds no device controls. They stay
// in Device view under the pane"). The Earth stands its chrome down in the pane and publishes it as data (projections/atlas/paneChrome.ts):
// the World design draws the World's part, the Lens design the lens's. Each control is drawn by its kind in the panel kit — a press is an
// action, a pressed state a toggle, a choice a chooser, a bounded number a dial, any other value a field — in the atlas's own words, and
// sent back as one `pane.press` ({id, value?}), which presses the atlas's own control (atlasDevices.ts pressPane). Nothing here holds a
// value of a control or re-implements one: the frame's chrome on the plates draws the same way (components/expressions/studio/
// frameChrome.tsx FrameControl), in the plate kit; this is its form in the device kit, for a design.
import {Action, Chooser, Dial, TextField, Toggle} from '../../sdk/panel'
import {json, st, strOf, type ViewProps} from './design'

/** One control as the pane publishes it (paneChrome.ts PaneChromeControl), read with every field guarded. */
export interface PaneControl {
  readonly id: string
  readonly region: string
  readonly kind: 'button' | 'toggle' | 'select' | 'text' | 'number' | 'reading'
  readonly label: string
  readonly title?: string
  readonly value?: string
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly options?: readonly {readonly value: string; readonly label: string}[]
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

const KINDS = new Set(['button', 'toggle', 'select', 'text', 'number', 'reading'])
const txt = (x: unknown): x is string => typeof x === 'string'
const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)

/** The pane's controls the binding reports (`pane.controls`), those of the given regions where some are named; undefined while the pane
 * is not read (the device then says so, and draws no control). */
export function paneControlsOf(v: ViewProps['v'], regions?: readonly string[]): PaneControl[] | undefined {
  const raw = json<unknown>(v, 'pane.controls', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x): PaneControl[] => {
    if (!x || typeof x !== 'object') return []
    const o = x as Record<string, unknown>
    if (!txt(o.id) || !txt(o.region) || !txt(o.kind) || !KINDS.has(o.kind) || !txt(o.label)) return []
    if (regions && !regions.includes(o.region)) return []
    const options = Array.isArray(o.options) ? o.options.flatMap(option => (option && typeof option === 'object' && txt((option as {value?: unknown}).value)
      ? [{value: (option as {value: string}).value, label: txt((option as {label?: unknown}).label) ? (option as {label: string}).label : (option as {value: string}).value}] : [])) : undefined
    return [{id: o.id, region: o.region, kind: o.kind as PaneControl['kind'], label: o.label, ...(txt(o.title) ? {title: o.title} : {}), ...(txt(o.value) ? {value: o.value} : {}),
      ...(o.pressed === true ? {pressed: true} : o.pressed === false ? {pressed: false} : {}), ...(o.disabled === true ? {disabled: true} : {}), ...(options ? {options} : {}),
      ...(num(o.min) !== undefined ? {min: num(o.min)} : {}), ...(num(o.max) !== undefined ? {max: num(o.max)} : {}), ...(num(o.step) !== undefined ? {step: num(o.step)} : {})}]
  })
}

/** A control's word on its key: its name up to its explanation ("Node size: How large every node is drawn" → "Node size"). */
export const keyWord = (control: PaneControl): string => control.label.split(': ')[0]!
/** What it does, in the atlas's words. */
const doesOf = (control: PaneControl): string => control.title ?? control.label

/** Press one control: the atlas's own, through the binding's one hand. */
const press = (p: ViewProps, control: PaneControl, value?: string) => p.set('pane.press', JSON.stringify(value === undefined ? {id: control.id} : {id: control.id, value}))

/** One control in the device kit, by its kind. A reading is not drawn here: the design reads the readings it shows by name. */
export function PaneControlView({p, control}: {p: ViewProps; control: PaneControl}) {
  const why = st(p, 'pane.press').disabled ?? (control.disabled ? `${keyWord(control)} is off here${control.title ? `: ${control.title}` : ''}.` : undefined)
  const word = keyWord(control), does = doesOf(control)
  switch (control.kind) {
    case 'reading':
      return null
    case 'toggle':
      return <Toggle label={word} does={does} on={control.pressed === true} onChange={() => press(p, control)} disabled={why} />
    case 'select':
      return <Chooser wide label={word} does={does} value={control.value ?? ''} options={(control.options ?? []).map(option => ({value: option.value, label: option.label}))}
        onChange={x => press(p, control, x)} disabled={why} />
    case 'number': {
      const value = Number(control.value)
      if (control.min !== undefined && control.max !== undefined && control.max > control.min && control.value !== undefined && control.value !== '' && Number.isFinite(value)) {
        const digits = control.step !== undefined && control.step < 1 ? 2 : 0
        return <Dial label={word} does={does} value={value} def={value} scale={{min: control.min, max: control.max, ...(control.step ? {step: control.step} : {})}}
          format={x => x.toFixed(digits)} onChange={x => press(p, control, String(x))} disabled={why} />
      }
      return <TextField label={word} does={does} value={control.value ?? ''} onChange={x => press(p, control, x)} disabled={why} />
    }
    case 'text':
      return <TextField wide label={word} does={does} value={control.value ?? ''} onChange={x => press(p, control, x)} disabled={why} />
    case 'button':
      return <Action label={word} does={does} onPress={() => press(p, control)} disabled={why} />
  }
}

/** The controls in their order, each in the device kit; the readings among them are the design's to show. */
export function PaneControls({p, controls}: {p: ViewProps; controls: readonly PaneControl[]}) {
  return <>{controls.filter(control => control.kind !== 'reading').map(control => <PaneControlView key={control.id} p={p} control={control} />)}</>
}

/** The readings among them (the focus label's name and line), in their order. */
export const paneReadings = (controls: readonly PaneControl[]): string[] => controls.filter(control => control.kind === 'reading').map(control => control.value ?? control.label)

/** The title the pane reports for these controls (the lens they are the lens's, the subject in focus). */
export const paneTitle = (v: ViewProps['v']): string | undefined => strOf(v, 'pane.title')
