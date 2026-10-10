/** The face controls — the editor standard, made physical.
 *
 * These are the kit's building blocks for rack faces: the plate (mark,
 * name, owner, honest power), the scalar/enum/boolean controls with the
 * common input law (pointer drag + keyboard + typed entry; acknowledged
 * base vs retained draft displayed distinctly; explicit commit/cancel),
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
 * until the result is understood). */
export function useFaceDrafts(submit: (changes: readonly ParamChange[]) => Promise<void>) {
  const [base, setBase] = useState<Record<string, number | string | boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, number | string | boolean>>({})
  const [standing, setStanding] = useState<WriteStanding>('idle')

  /** Adopt the owner's acknowledged values (call when a reading arrives).
   * Drafts persist — they are the operator's intended values. */
  const adopt = useCallback((reading: Record<string, number | string | boolean>) => {
    setBase(previous => ({...previous, ...reading}))
  }, [])

  const setDraft = useCallback((key: string, value: number | string | boolean) => {
    setDrafts(previous => ({...previous, [key]: value}))
    setStanding('idle')
  }, [])

  const cancel = useCallback((key?: string) => {
    setDrafts(previous => {
      if (!key) return {}
      const {[key]: _removed, ...rest} = previous
      return rest
    })
    setStanding('idle')
  }, [])

  const dirtyKeys = useCallback(() =>
    Object.keys(drafts).filter(key => drafts[key] !== base[key]), [drafts, base])

  const commit = useCallback(async () => {
    const changes: readonly ParamChange[] = Object.entries(drafts)
      .filter(([key, value]) => value !== base[key])
      .map(([key, value]) => ({key, value}))
    if (!changes.length) return
    setStanding('pending')
    try {
      await submit(changes)
      setBase(previous => ({...previous, ...Object.fromEntries(changes.map(change => [change.key, change.value]))}))
      setDrafts(previous => {
        const next = {...previous}
        for (const change of changes) delete next[change.key]
        return next
      })
      setStanding('idle')
    } catch {
      setStanding('refused') // drafts retained; the plate discloses the refusal
    }
  }, [drafts, base, submit])

  return {base, drafts, standing, adopt, setDraft, cancel, dirtyKeys, commit}
}

// ---------------------------------------------------------------------------
// the plate

export type PowerStanding = 'on' | 'off' | 'unknown'

export interface FacePlateProps {
  readonly presentation: FacePresentation
  /** Actual owner state; an unknown state has NO illuminated lamp. */
  readonly power?: PowerStanding
  readonly admission?: 'admitted' | 'waiting'
  /** The mark+label buttons on the plate's header (fold, pop-out, settings). */
  readonly actions?: readonly {readonly icon: IconName; readonly label: string; readonly onPress?: () => void}[]
  readonly children?: ReactNode
}

/** The device plate: mark, name, owner line, honest power lamp, actions. */
export function FacePlate({presentation, power = 'unknown', admission = 'admitted', actions, children}: FacePlateProps) {
  return (
    <section className={`sdk-face${admission === 'waiting' ? ' sdk-face--waiting' : ''}`} aria-label={presentation.title}>
      <header className="sdk-face__head">
        <span className={`sdk-lamp sdk-lamp--${power}`} title={power === 'unknown' ? 'Power state unknown — the owner has not disclosed it' : `Power ${power}`} />
        <Icon name={presentation.icon} size={15} className="sdk-face__mark" />
        <h3 className="sdk-face__title">{presentation.title}</h3>
        {actions?.map(action => (
          <button key={action.icon} type="button" className="sdk-face__action" title={action.label} aria-label={action.label} onClick={action.onPress}>
            <Icon name={action.icon} size={13} />
          </button>
        ))}
      </header>
      <p className="sdk-face__owner">{presentation.owner}</p>
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
 * handle rides beside the acknowledged one; Enter commits, Escape cancels. */
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
  return (
    <div className={`sdk-row${dirty ? ' sdk-row--dirty' : ''}${modulated}`}>
      <label
        className="sdk-row__name"
        htmlFor={inputId}
        title={param.modulatedBy ? `Modulated by ${param.modulatedBy}` : undefined}
      >
        {param.modulatedBy ? <span className="sdk-modulator" aria-label={`modulated by ${param.modulatedBy}`} /> : null}
        {param.title}
      </label>
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
        <span className="sdk-scalar__well" aria-hidden="true">
          <span className="sdk-scalar__base" style={{height: `${Math.round(((base ?? min) - min) / ((max - min) || 1) * 100)}%`}} />
          {dirty && <span className="sdk-scalar__draft" style={{height: `${Math.round(fraction * 100)}%`}} />}
        </span>
        {editing ? (
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
              const min = param.range?.min ?? 0
              const max = param.range?.max ?? 1
              if (parsed < min || parsed > max) {
                // The typed value is outside the declared domain: the editor
                // stays open with the intended value visible, in the stall
                // colour, and NOTHING is dispatched or clamped (the editor
                // standard: no silent clamp or rewrite). Fix the value or
                // press Escape to cancel.
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
        )}
      </div>
    </div>
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
}

/** The enumerated row: click cycles the owner's actual choices; arrows
 * adjust; Enter commits, Escape cancels. The owner's values, nothing else. */
export function EnumParam({param, base, draft, onDraft, onCommit, onCancel, disabled}: EnumParamProps) {
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

/** The boolean row: a three-state toggle; unknown renders dark. */
export function BoolParam({param, base, draft, onDraft, onCommit, onCancel, disabled}: BoolParamProps) {
  const shown = draft ?? base
  const dirty = draft !== undefined && draft !== base
  return (
    <div className={`sdk-row${dirty ? ' sdk-row--dirty' : ''}`}>
      <span className="sdk-row__name">{param.title}</span>
      <button
        type="button"
        className={`sdk-bool${shown === undefined ? '' : shown ? ' sdk-bool--on' : ' sdk-bool--off'}`}
        disabled={disabled || base === undefined}
        aria-label={param.title}
        aria-pressed={shown === undefined ? undefined : shown}
        onClick={() => {
          if (base === undefined) return
          onDraft(!(shown ?? base))
          onCommit()
        }}
        onKeyDown={event => { if (event.key === 'Escape') onCancel() }}
        title={shown === undefined ? 'State unknown — the owner has not disclosed it' : String(shown)}
      >
        <span className="sdk-bool__dot" aria-hidden="true" />
      </button>
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
