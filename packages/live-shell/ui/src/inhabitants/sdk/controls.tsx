/** The face controls — the editor standard, made physical.
 *
 * These are the kit's building blocks for rack faces: the plate (power
 * ring, mark, name, owner, ▾ fold, ⤢ open full — the world mockup's
 * `dev()`), the scalar/enum/boolean controls with the common input law
 * (pointer drag + keyboard + typed entry; acknowledged base vs retained
 * draft displayed distinctly; explicit commit/cancel) drawn as the
 * mockup's knob ring and segmented toggles,
 * reading lamps and chips, the identity disclosure, and the honest waiting
 * card. Visual law: `--sdk-*` tokens mapped from the shell's own tokens —
 * a control never carries a raw colour.
 *
 * The proven aperture is NAMED here, not redefined: a parameter face
 * receives `{reading, disabled, apply, captureCurrent}` (the contract the
 * racks pass; the custody types come from nativeDeviceCustody). The draft
 * hook binds the controls' commit path to whatever the family maps onto
 * that aperture — the kit never dispatches a write of its own. */

import {useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react'
import type {Apply, CaptureCurrent} from '../../components/nativeDeviceCustody.ts'
import type {SdkParamRow} from './define.ts'
import type {FacePresentation} from './define.ts'
import {Icon, type IconName} from './Icon.tsx'
import {ChevronFold, PopOut} from './marks.tsx'
import './sdk.css'

/** The face aperture the racks pass (named structurally; the custody law
 * lives in nativeDeviceCustody and stays its only definition). */
export interface DeviceFaceAperture {
  /** The owner's current reading for this face — shape owned by the family. */
  readonly reading: unknown
  readonly disabled: boolean
  readonly apply: Apply
  readonly captureCurrent: CaptureCurrent
}

/** One parameter change the face submits through its own aperture mapping. */
export interface ParamChange {
  readonly key: string
  readonly value: number | string | boolean
}

export type WriteStanding = 'idle' | 'pending' | 'refused'

/** Draft custody for a face's parameters: acknowledged base values,
 * retained drafts, explicit commit/cancel. The face adopts the owner's
 * readings (`adopt`) and maps `submit` onto its aperture's apply; a refused
 * submit keeps the drafts (the visible editor keeps the intended value
 * until the result is understood). `reading` is the owner's reading the
 * face already holds when it mounts: the controls show it from their first
 * paint, rather than standing dark until the first `adopt`. */
export function useFaceDrafts(submit: (changes: readonly ParamChange[]) => Promise<void>, reading?: Readonly<Record<string, number | string | boolean>>) {
  const [base, setBase] = useState<Record<string, number | string | boolean>>(() => ({...reading}))
  const [drafts, setHeldDrafts] = useState<Record<string, number | string | boolean>>({})
  const [standing, setStanding] = useState<WriteStanding>('idle')
  // The owner's own words when it refuses, shown where the change was asked for (never a generic line).
  const [refusal, setRefusal] = useState<string | null>(null)
  // The drafts as they stand this instant: a control that drafts and commits in one handler (a toggle, a typed value)
  // commits what it just drafted, not the render's stale copy.
  const live = useRef(drafts)
  const setDrafts = useCallback((change: (previous: Record<string, number | string | boolean>) => Record<string, number | string | boolean>) => {
    live.current = change(live.current)
    setHeldDrafts(live.current)
  }, [])

  /** Adopt the owner's acknowledged values (call when a reading arrives).
   * Drafts persist — they are the operator's intended values. */
  const adopt = useCallback((reading: Record<string, number | string | boolean>) => {
    setBase(previous => ({...previous, ...reading}))
  }, [])

  const setDraft = useCallback((key: string, value: number | string | boolean) => {
    setDrafts(previous => ({...previous, [key]: value}))
    setStanding('idle')
  }, [setDrafts])

  const cancel = useCallback((key?: string) => {
    setDrafts(previous => {
      if (!key) return {}
      const {[key]: _removed, ...rest} = previous
      return rest
    })
    setStanding('idle')
  }, [setDrafts])

  const dirtyKeys = useCallback(() =>
    Object.keys(drafts).filter(key => drafts[key] !== base[key]), [drafts, base])

  const commit = useCallback(async () => {
    const changes: readonly ParamChange[] = Object.entries(live.current)
      .filter(([key, value]) => value !== base[key])
      .map(([key, value]) => ({key, value}))
    if (!changes.length) return
    setStanding('pending')
    setRefusal(null)
    try {
      await submit(changes)
      setBase(previous => ({...previous, ...Object.fromEntries(changes.map(change => [change.key, change.value]))}))
      setDrafts(previous => {
        const next = {...previous}
        for (const change of changes) delete next[change.key]
        return next
      })
      setStanding('idle')
    } catch (cause) {
      setStanding('refused') // drafts retained; the plate discloses the refusal
      setRefusal(cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : null)
    }
  }, [base, submit, setDrafts])

  return {base, drafts, standing, refusal, adopt, setDraft, cancel, dirtyKeys, commit}
}

// ---------------------------------------------------------------------------
// the plate

export type PowerStanding = 'on' | 'off' | 'unknown'

/** A mark on the plate's head: one from the cut, or the specimen's own header marks — `fold` (▾, CHEVRON_FOLD) and `full`
 * (⤢, CHEVRON_POP: open the device full size). */
export type PlateMark = IconName | 'fold' | 'full'

export interface FacePlateProps {
  readonly presentation: FacePresentation
  /** Actual owner state; an unknown state has NO illuminated ring. */
  readonly power?: PowerStanding
  /** Turn the device the other way through its owner — the power ring's press. Absent, the ring is a light only. */
  readonly onPower?: () => void
  readonly admission?: 'admitted' | 'waiting'
  /** The marks on the plate's head after its name and owner (open full, settings): each a button with its label. */
  readonly actions?: readonly {readonly icon: PlateMark; readonly label: string; readonly onPress?: () => void}[]
  /** The plate the pool shows (the mockup's `.dev.sel`: an accent outline). */
  readonly selected?: boolean
  /** What pressing the plate does, said on its head. */
  readonly hint?: string
  /** Folded down to its title (manual §10.4): the plate stands as a strip with its light and name; pressing it opens it. */
  readonly folded?: boolean
  /** Fold the plate, or open it again: the ▾ on its head, and the strip itself while folded. */
  readonly onFold?: () => void
  readonly children?: ReactNode
}

const powerWords = (power: PowerStanding) => power === 'unknown' ? 'Power state unknown — the owner has not disclosed it' : `Power ${power}`

/** The power ring (the mockup's `.pw`): the device's light, a reading — lit only when the owner reports on, dark when it is
 * not known. With an owner write it is also the switch. */
function PowerRing({power, onPower}: {power: PowerStanding; onPower?: () => void}) {
  if (!onPower) return <span className={`sdk-power sdk-power--${power}`} role="img" aria-label={powerWords(power)} title={powerWords(power)} />
  const to = power === 'on' ? 'off' : 'on'
  return <button type="button" className={`sdk-power sdk-power--${power}`} aria-pressed={power === 'on'} aria-label={`${powerWords(power)}. Turn it ${to}`}
    title={`${powerWords(power)} — press to turn it ${to}`} onClick={onPower} />
}

function PlateMarkView({mark}: {mark: PlateMark}) {
  return mark === 'fold' ? <ChevronFold size={10} /> : mark === 'full' ? <PopOut size={10} /> : <Icon name={mark} size={12} />
}

/** The device plate (world-shell-mockup.html:333-336, `dev()` at :1410; the specimen's device header): the power ring, the
 * device's mark and name, its owner, and the head's marks — ▾ to fold, ⤢ to open full, any others the place offers. */
export function FacePlate({presentation, power = 'unknown', onPower, admission = 'admitted', actions, selected = false, hint, folded = false, onFold, children}: FacePlateProps) {
  const classes = `sdk-face${admission === 'waiting' ? ' sdk-face--waiting' : ''}${selected ? ' sdk-face--sel' : ''}${folded ? ' sdk-face--folded' : ''}`
  if (folded) {
    return (
      <section className={classes} aria-label={presentation.title}>
        <button type="button" className="sdk-face__unfold" aria-expanded={false} aria-label={`Open ${presentation.title}`} title={`${presentation.title} · ${presentation.owner} — open`} onClick={onFold}>
          <span className={`sdk-power sdk-power--${power}`} title={powerWords(power)} />
          <Icon name={presentation.icon} size={12} className="sdk-face__mark" />
          <span className="sdk-face__fold-title">{presentation.title}</span>
        </button>
      </section>
    )
  }
  return (
    <section className={classes} aria-label={presentation.title}>
      <header className="sdk-face__head" title={hint}>
        <PowerRing power={power} onPower={onPower} />
        <Icon name={presentation.icon} size={12} className="sdk-face__mark" />
        <h3 className="sdk-face__title">{presentation.title}</h3>
        <span className="sdk-face__owner">{presentation.owner}</span>
        {(onFold || !!actions?.length) && <span className="sdk-face__x">
          {onFold && <button type="button" className="sdk-face__action" data-plate-mark="fold" aria-expanded={true} title="Fold to its title" aria-label={`Fold ${presentation.title} to its title`} onClick={onFold}><ChevronFold size={10} /></button>}
          {actions?.map(action => (
            <button key={action.icon} type="button" className="sdk-face__action" data-plate-mark={action.icon} title={action.label} aria-label={action.label} onClick={action.onPress}>
              <PlateMarkView mark={action.icon} />
            </button>
          ))}
        </span>}
      </header>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// rows

export interface ScalarParamProps {
  readonly param: SdkParamRow
  /** The acknowledged value; undefined = no reading yet (control inert). */
  readonly base?: number
  readonly draft?: number
  readonly onDraft: (value: number) => void
  readonly onCommit: () => void
  readonly onCancel: () => void
  readonly disabled?: boolean
  /** `knob`: the plate's ring, its name above and its value below (the mockup's knobSVG); `fader`: a well beside the value. */
  readonly presentation?: 'knob' | 'fader'
}

const SCALAR_STEPS = 150

function clampScalar(param: SdkParamRow, value: number): number {
  const min = param.range?.min ?? 0
  const max = param.range?.max ?? 1
  return Math.min(max, Math.max(min, value))
}

/** Reset an entry field's refusal styling (the out-of-range state). */
const field_reset = (field: HTMLInputElement): void => {
  field.title = ''
  field.style.color = ''
}

/** The scalar row: drag (vertical), arrow keys, typed entry; the draft
 * rides beside the acknowledged value (the knob draws the draft's travel
 * apart from the acknowledged arc); Enter commits, Escape cancels. */
export function ScalarParam({param, base, draft, onDraft, onCommit, onCancel, disabled, presentation = 'knob'}: ScalarParamProps) {
  const inputId = useId()
  const [editing, setEditing] = useState(false)
  const dragState = useRef<{startY: number; startValue: number} | null>(null)
  const min = param.range?.min ?? 0
  const max = param.range?.max ?? 1
  const shown = draft ?? base
  const fraction = shown === undefined ? 0 : (shown - min) / ((max - min) || 1)
  const dirty = draft !== undefined && draft !== base
  const unit = param.range?.unit ?? ''

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || base === undefined) return
    dragState.current = {startY: event.clientY, startValue: shown ?? base}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const span = (max - min) || 1
    const next = dragState.current.startValue + (dragState.current.startY - event.clientY) * (span / SCALAR_STEPS)
    onDraft(clampScalar(param, next))
  }
  const onPointerUp = () => { dragState.current = null }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || base === undefined) return
    const span = (max - min) || 1
    const fine = event.shiftKey ? 0.1 : 1
    const step = (span / 50) * fine
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      onDraft(clampScalar(param, (shown ?? base) + step)); event.preventDefault()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      onDraft(clampScalar(param, (shown ?? base) - step)); event.preventDefault()
    } else if (event.key === 'Enter') {
      onCommit(); event.preventDefault()
    } else if (event.key === 'Escape') {
      onCancel(); event.preventDefault()
    }
  }

  const modulated = param.modulatedBy ? ` sdk-scalar--modulated` : ''
  const knob = presentation === 'knob'
  const name = (
    <label
      className="sdk-row__name"
      htmlFor={inputId}
      title={param.modulatedBy ? `Modulated by ${param.modulatedBy}` : undefined}
    >
      {param.modulatedBy ? <span className="sdk-modulator" aria-label={`modulated by ${param.modulatedBy}`} /> : null}
      {param.title}
    </label>
  )
  const value = editing ? (
    <input
      className="sdk-scalar__entry"
      autoFocus
      defaultValue={shown ?? ''}
      inputMode="decimal"
      aria-label={`${param.title} — typed value${unit ? ` in ${unit}` : ''}`}
      onBlur={event => {
        const parsed = Number.parseFloat(event.currentTarget.value)
        if (!Number.isFinite(parsed)) {
          setEditing(false)
          return
        }
        if (parsed < min || parsed > max) {
          // The typed value is outside the declared domain: the editor stays open with the intended value visible, in the
          // stall colour, and NOTHING is dispatched or clamped (the editor standard: no silent clamp or rewrite). Fix the
          // value or press Escape to cancel.
          const field = event.currentTarget
          field.title = `${parsed} is outside the declared range [${min}, ${max}] — not dispatched; fix the value or press Escape`
          field.style.color = 'var(--stall)'
          field.focus()
          return
        }
        field_reset(event.currentTarget)
        onDraft(parsed)
        onCommit()
        setEditing(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setEditing(false); onCancel() }
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  ) : (
    <button type="button" className="sdk-scalar__value" disabled={disabled || base === undefined} onClick={() => setEditing(true)}>
      {shown === undefined ? '—' : `${+shown.toPrecision(4)}${unit ? ` ${unit}` : ''}`}
    </button>
  )
  const slider = (body: ReactNode) => (
    <div
      id={inputId}
      className={`sdk-scalar sdk-scalar--${presentation}`}
      role="slider"
      tabIndex={disabled || base === undefined ? -1 : 0}
      aria-label={param.title}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={shown ?? undefined}
      aria-valuetext={shown === undefined ? undefined : `${shown.toPrecision(4)}${unit ? ` ${unit}` : ''}`}
      aria-disabled={disabled || base === undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {body}
    </div>
  )
  // The knob (the mockup's `.knob`, world-shell-mockup.html:342-343): its name above, the ring, its value below in mono.
  if (knob) {
    return (
      <div className={`sdk-row sdk-row--knob${dirty ? ' sdk-row--dirty' : ''}${modulated}`}>
        {name}
        {slider(<KnobRing base={base} draft={dirty ? draft : undefined} min={min} max={max} />)}
        {value}
      </div>
    )
  }
  return (
    <div className={`sdk-row${dirty ? ' sdk-row--dirty' : ''}${modulated}`}>
      {name}
      {slider(<>
        <span className="sdk-scalar__well" aria-hidden="true">
          <span className="sdk-scalar__base" style={{height: `${Math.round(((base ?? min) - min) / ((max - min) || 1) * 100)}%`}} />
          {dirty && <span className="sdk-scalar__draft" style={{height: `${Math.round(fraction * 100)}%`}} />}
        </span>
        {value}
      </>)}
    </div>
  )
}

const D2R = Math.PI / 180
const KNOB = {centre: 15, radius: 11, cap: 6.5, from: -135, to: 135} as const

/** The angle a value stands at on the knob ring: 270° of travel from lower left to lower right (knobSVG,
 * world-shell-mockup.html:835). */
export function knobAngle(fraction: number): number {
  return KNOB.from + (KNOB.to - KNOB.from) * Math.min(1, Math.max(0.001, fraction))
}

const knobPoint = (radius: number, angle: number): [number, number] =>
  [KNOB.centre + radius * Math.sin(angle * D2R), KNOB.centre - radius * Math.cos(angle * D2R)]

/** An arc of the knob's ring between two angles (arcP, world-shell-mockup.html:834). */
export function knobArc(from: number, to: number): string {
  const [x0, y0] = knobPoint(KNOB.radius, from), [x1, y1] = knobPoint(KNOB.radius, to)
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${KNOB.radius} ${KNOB.radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

/** The ring: the track; the acknowledged value's arc; an unsent draft's travel drawn apart from it; the cap; the needle at the
 * value shown. With no reading there is no arc and no needle — never a default drawn as a value. */
function KnobRing({base, draft, min, max}: {base?: number; draft?: number; min: number; max: number}) {
  const at = (value: number) => knobAngle((value - min) / ((max - min) || 1))
  const shown = draft ?? base
  const needle = shown === undefined ? null : knobPoint(KNOB.cap, at(shown))
  return (
    <svg className="sdk-knob" width={30} height={30} viewBox="0 0 30 30" aria-hidden="true">
      <path className="sdk-knob__track" d={knobArc(KNOB.from, KNOB.to)} />
      {base !== undefined && <path className="sdk-knob__base" d={knobArc(KNOB.from, at(base))} />}
      {base !== undefined && draft !== undefined && <path className="sdk-knob__draft" d={knobArc(Math.min(at(base), at(draft)), Math.max(at(base), at(draft)))} />}
      <circle className="sdk-knob__cap" cx={KNOB.centre} cy={KNOB.centre} r={KNOB.cap} />
      {needle && <line className="sdk-knob__needle" x1={KNOB.centre} y1={KNOB.centre} x2={needle[0].toFixed(2)} y2={needle[1].toFixed(2)} />}
    </svg>
  )
}

export interface EnumParamProps {
  readonly param: SdkParamRow
  readonly base?: string
  readonly draft?: string
  readonly onDraft: (value: string) => void
  readonly onCommit: () => void
  readonly onCancel: () => void
  readonly disabled?: boolean
  /** `segmented`: every choice side by side, the acknowledged one lit (the mockup's `.tog`); `cycle`: one value box that steps
   * through them (a long list). */
  readonly presentation?: 'segmented' | 'cycle'
}

/** The enumerated row: the owner's actual choices, nothing else. Segmented, a press on a choice sends it at once (a choice is
 * one whole act, as a toggle is); cycled, a click steps the draft, arrows adjust, Enter commits, Escape cancels. */
export function EnumParam(props: EnumParamProps) {
  return props.presentation === 'segmented' ? <SegmentedParam {...props} /> : <CycleParam {...props} />
}

/** One choice of a segmented toggle (the mockup's `.tog .tg span`): lit when it is the acknowledged value; outlined while it
 * is an unsent or refused draft. */
function segmentClass(kind: string, value: unknown, base: unknown, draft: unknown, dirty: boolean): string {
  return `${kind}sdk-seg__opt${base === value ? ' sdk-seg__opt--on' : ''}${dirty && draft === value ? ' sdk-seg__opt--draft' : ''}`
}

function SegmentedParam({param, base, draft, onDraft, onCommit, onCancel, disabled}: EnumParamProps) {
  const labelId = useId()
  const values = param.values ?? []
  const shown = draft ?? base
  const dirty = draft !== undefined && draft !== base
  const inert = disabled || base === undefined || !values.length
  const choose = (value: string) => {
    if (inert || value === shown) return
    onDraft(value)
    onCommit()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (inert) return
    const at = values.indexOf(shown ?? base!)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { onDraft(values[Math.min(values.length - 1, at + 1)]!); event.preventDefault() }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { onDraft(values[Math.max(0, at - 1)]!); event.preventDefault() }
    else if (event.key === 'Enter') { onCommit(); event.preventDefault() }
    else if (event.key === 'Escape') { onCancel(); event.preventDefault() }
  }
  return (
    <div className={`sdk-row sdk-row--tog${dirty ? ' sdk-row--dirty' : ''}`} title={base === undefined ? param.disclosure ?? 'No reading yet — the owner has not disclosed it' : undefined}>
      <span className="sdk-row__name" id={labelId}>{param.title}</span>
      <div className="sdk-seg" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {values.map(value => (
          <button key={value} type="button" role="radio" aria-checked={shown === value} className={segmentClass('', value, base, draft, dirty)}
            disabled={inert} tabIndex={shown === value || (shown === undefined && value === values[0]) ? 0 : -1} onClick={() => choose(value)}>
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function CycleParam({param, base, draft, onDraft, onCommit, onCancel, disabled}: EnumParamProps) {
  const values = param.values ?? []
  const shown = draft ?? base
  const dirty = draft !== undefined && draft !== base
  const cycle = () => {
    if (disabled || !values.length || base === undefined) return
    const at = values.indexOf(shown ?? base)
    onDraft(values[(at + 1) % values.length]!)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !values.length || base === undefined) return
    const at = values.indexOf(shown ?? base)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      onDraft(values[Math.min(values.length - 1, at + 1)]!); event.preventDefault()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      onDraft(values[Math.max(0, at - 1)]!); event.preventDefault()
    } else if (event.key === 'Enter') { onCommit(); event.preventDefault() }
    else if (event.key === 'Escape') { onCancel(); event.preventDefault() }
  }
  return (
    <div className={`sdk-row${dirty ? ' sdk-row--dirty' : ''}`}>
      <span className="sdk-row__name">{param.title}</span>
      <button
        type="button"
        className="sdk-enum"
        disabled={disabled || base === undefined}
        onClick={cycle}
        onKeyDown={onKeyDown}
        aria-label={`${param.title}: ${(param.values ?? []).join(', ')}`}
        title={(param.values ?? []).join(' · ')}
      >
        {shown ?? '—'}
      </button>
    </div>
  )
}

export interface BoolParamProps {
  readonly param: SdkParamRow
  /** undefined = the owner has not disclosed the state — no illuminated lamp. */
  readonly base?: boolean
  readonly draft?: boolean
  readonly onDraft: (value: boolean) => void
  readonly onCommit: () => void
  readonly onCancel: () => void
  readonly disabled?: boolean
}

/** The boolean row: a toggle of two, on and off (the mockup's `.tog.half`), the acknowledged one lit. Unknown renders dark:
 * neither is lit and neither can be pressed. A press sends at once. */
export function BoolParam({param, base, draft, onDraft, onCommit, onCancel, disabled}: BoolParamProps) {
  const labelId = useId()
  const shown = draft ?? base
  const dirty = draft !== undefined && draft !== base
  const inert = disabled || base === undefined
  const set = (value: boolean) => {
    if (inert || value === shown) return
    onDraft(value)
    onCommit()
  }
  return (
    <div className={`sdk-row sdk-row--tog${dirty ? ' sdk-row--dirty' : ''}`} title={shown === undefined ? 'State unknown — the owner has not disclosed it' : undefined}>
      <span className="sdk-row__name" id={labelId}>{param.title}</span>
      <div className="sdk-seg" role="group" aria-labelledby={labelId} onKeyDown={event => { if (event.key === 'Escape') onCancel() }}>
        {[true, false].map(value => (
          <button key={String(value)} type="button" className={segmentClass('sdk-bool ', value, base, draft, dirty)} disabled={inert}
            aria-pressed={shown === undefined ? undefined : shown === value} aria-label={`${param.title} ${value ? 'on' : 'off'}`} onClick={() => set(value)}>
            {value ? 'on' : 'off'}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface ReadingRowProps {
  readonly param: SdkParamRow
  /** The owner's current reading for the row; undefined = disclosed absence. */
  readonly value?: string | number | boolean
}

/** The reading row: an honest value or the disclosure of its absence. */
export function ReadingRow({param, value}: ReadingRowProps) {
  return (
    <div className="sdk-row sdk-row--reading" title={param.disclosure ?? param.title}>
      <span className="sdk-row__name">
        {param.modulatedBy ? <span className="sdk-modulator" aria-label={`modulated by ${param.modulatedBy}`} /> : null}
        {param.title}
      </span>
      <span className="sdk-chip">
        {value === undefined || value === ''
          ? <em className="sdk-chip__absent">{param.disclosure ?? 'no reading'}</em>
          : `${String(value)}${param.unit ?? param.range?.unit ? ` ${param.unit ?? param.range?.unit}` : ''}`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// lamps, disclosure, waiting

export type LampState = 'admit' | 'deny' | 'waiting' | 'refusing' | 'unknown'

/** The admit lamp — a READING, never a literal. Unknown is dark. */
export function Lamp({state, label}: {state: LampState; label?: string}) {
  return (
    <span className={`sdk-lamp sdk-lamp--${state}`} title={label ?? `Reading: ${state}`} />
  )
}

export interface DisclosureProps {
  readonly title: string
  /** The native instance reference — identity, not a list index. Named
   * `instanceRef` (not `ref`): React owns that prop name. */
  readonly instanceRef: string
  readonly owner: string
  readonly revision?: string
}

/** The identity disclosure (the editor standard's common affordance):
 * human name, native ref, owner, revision — through contextual disclosure. */
export function Disclosure({title, instanceRef, owner, revision}: DisclosureProps) {
  const parts = [owner, instanceRef, revision].filter(Boolean)
  return (
    <details className="sdk-disclosure">
      <summary>{title}</summary>
      <code className="sdk-disclosure__body">{parts.join(' · ')}</code>
    </details>
  )
}

/** The honest waiting card: declared, waiting, no body, owner named. */
export function WaitingFace({presentation, note}: {presentation: FacePresentation; note: string}) {
  return (
    <FacePlate presentation={presentation} admission="waiting" power="unknown">
      <p className="sdk-waiting">
        <Lamp state="waiting" /> {note}
      </p>
    </FacePlate>
  )
}
