import {Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {Entity} from '../../../../expressions-boundary/src/editor'
import type {EntityFaceContext, EntityFaceView} from './nativeEntityFaceViews.tsx'
import {
  ENVELOPE, LOCKED_NOTE, SOUND_GROUPS, SOUND_NUMBERS, addedSound, carryFromValue, carryValue, envelopeGeometry, envelopeValueAt, numberProblem,
  parseNumberText, replyRefusal, resolvedSound, soundChange, soundNumberSpec, soundSummaryText, steppedValue, timeToX,
  soundWithField, voiceChoiceNote, voiceChoices, type EnvelopeField, type SoundField, type SoundNumberSpec,
} from './nativeEntityFace.sound.ts'
import {useLiveModeCatalogue} from '../native/liveModeCatalogue.ts'
import './NativeEntityFace.sound.css'

type EntitySound = NonNullable<Entity['sound']>
/** The retained whole sound a gesture composed (null = remove). Shown in place of the object's sound until the owner acknowledges it. */
type Draft = {sound: EntitySound | null} | null
const VIEW = {width: 360, height: 130}
const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const arrowDirection = (key: string): 1 | -1 | null => key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : null

/** One exact-value number. Commits on Enter or blur; a bad value shows its bound and sends nothing. */
function SoundNumber({spec, value, disabled, onCommit}: {spec: SoundNumberSpec; value: number; disabled: boolean; onCommit: (field: SoundNumberSpec['field'], value: number) => Promise<void>}) {
  const [text, setText] = useState(String(value))
  const [problem, setProblem] = useState<string | null>(null)
  const inFlight = useRef<number | null>(null)
  useEffect(() => { setText(String(value)); setProblem(null) }, [value])
  const id = `native-entity-sound-${spec.field}`
  const commit = () => {
    if (disabled) return
    const next = parseNumberText(text)
    const refused = numberProblem(spec, next)
    setProblem(refused)
    if (refused || next === value || inFlight.current === next) return
    inFlight.current = next
    void onCommit(spec.field, next).finally(() => { if (inFlight.current === next) inFlight.current = null })
  }
  return <label className="native-entity-sound-field" htmlFor={id}>
    <span>{spec.label}{spec.unit && <small>{spec.unit}</small>}</span>
    <input id={id} type="number" inputMode="decimal" min={spec.min} max={spec.max} step={spec.step} value={text} disabled={disabled}
      aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : undefined}
      onChange={event => setText(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { setText(String(value)); setProblem(null) }
      }} />
    {problem && <span id={`${id}-problem`} className="native-entity-sound-problem">{problem}</span>}
  </label>
}

/** The Sound device on one selected object: the voice's switch, what it carries (a name or a mode of the store), and its envelope handles and exact-value controls. */
function SoundPanel({reading, entity, disabled, apply}: EntityFaceContext) {
  const [draft, setDraft] = useState<Draft>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const modes = useLiveModeCatalogue().reading
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{field: EnvelopeField; pointerId: number; base: EntitySound; latest: EntitySound | null} | null>(null)
  const shownSound: EntitySound | undefined = draft ? draft.sound ?? undefined : entity.sound
  const off = disabled || entity.locked

  /** One gesture, one change: the whole next sound (or null). A refusal keeps the draft and shows the owner's text. */
  async function send(next: EntitySound | null): Promise<void> {
    let change: ReturnType<typeof soundChange>
    try { change = soundChange(entity.id, next) } catch (cause) { setError(messageOf(cause)); return }
    setError(null); setDraft({sound: next}); setSending(true)
    try {
      const refusal = replyRefusal(await apply([change]))
      if (refusal) { setError(refusal); return }
      setDraft(null)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setSending(false)
    }
  }
  const edit = (build: () => EntitySound | null): Promise<void> => {
    try { return send(build()) } catch (cause) { setError(messageOf(cause)); return Promise.resolve() }
  }

  const point = (event: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return null
    return {x: (event.clientX - box.left) * VIEW.width / box.width, y: (event.clientY - box.top) * VIEW.height / box.height}
  }
  const beginDrag = (field: EnvelopeField, base: EntitySound | undefined) => (event: PointerEvent<SVGGElement>) => {
    if (off || !base || sending) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
    drag.current = {field, pointerId: event.pointerId, base, latest: null}
  }
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    const at = current && event.pointerId === current.pointerId ? point(event) : null
    if (!current || !at) return
    current.latest = soundWithField(current.base, current.field, envelopeValueAt(current.field, at.x, at.y))
    setDraft({sound: current.latest})
  }
  /** Pointer up commits the one change; Escape (pointer cancel) drops the local draft and sends nothing. */
  const endDrag = (event: PointerEvent<SVGSVGElement>, cancel: boolean) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    drag.current = null
    const next = current.latest
    if (cancel || !next || resolvedSound(next)[current.field] === resolvedSound(current.base)[current.field]) { setDraft(null); return }
    void send(next)
  }
  const handleKey = (field: EnvelopeField, base: EntitySound | undefined) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Escape') { if (drag.current) { drag.current = null; setDraft(null) } return }
    const direction = arrowDirection(event.key)
    if (direction === null || off || !base || sending) return
    event.preventDefault()
    const value = steppedValue(soundNumberSpec(field), resolvedSound(base)[field], direction, event.shiftKey)
    if (value !== null) void edit(() => soundWithField(base, field, value))
  }

  const retry = () => { if (draft) void send(draft.sound) }
  const discard = () => { setDraft(null); setError(null) }
  const numberSpec = (field: SoundField) => SOUND_NUMBERS.find(spec => spec.field === field)

  const renderField = (field: SoundField) => {
    const base = shownSound
    if (!base) return null
    const s = resolvedSound(base)
    if (field === 'enabled') return <label key={field} className="native-entity-sound-toggle"><input type="checkbox" checked={s.enabled} disabled={off}
      onChange={event => void edit(() => soundWithField(base, 'enabled', event.target.checked))} /><span>This object carries the torus's sound while present</span></label>
    if (field === 'carry') return <Fragment key={field}>
      <label className="native-entity-sound-field"><span>Name or mode</span>
        <select value={carryValue(s.carry)} disabled={off}
          onChange={event => void edit(() => soundWithField(base, 'carry', carryFromValue(event.target.value)))}>
          {voiceChoices(modes.state === 'ready' ? modes.catalogue : null, s.carry).map(group =>
            <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}
        </select></label>
      <p className="native-entity-sound-note" aria-live="polite">{voiceChoiceNote(base, modes)}</p>
    </Fragment>
    const spec = numberSpec(field)
    if (!spec) return null
    return <SoundNumber key={field} spec={spec} value={s[spec.field]} disabled={off}
      onCommit={(name, value) => edit(() => soundWithField(base, name, value))} />
  }

  const lockNote = entity.locked ? LOCKED_NOTE : reading.standing.pending ? 'A native acknowledgement is pending: sound edits wait for it.' : null
  const s = shownSound ? resolvedSound(shownSound) : null
  const env = s ? envelopeGeometry(s) : null
  const handle = (field: EnvelopeField, x: number, y: number, label: string, value: number, valueText: string, min: number, max: number, vertical = false) =>
    <g role="slider" tabIndex={off ? -1 : 0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}
      aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-disabled={off} className="native-entity-sound-handle"
      onPointerDown={beginDrag(field, shownSound)} onKeyDown={handleKey(field, shownSound)}>
      <circle cx={x} cy={y} r={11} className="native-entity-sound-hit" />
      <circle cx={x} cy={y} r={5} className="native-entity-sound-knob" />
    </g>

  return <section className="native-entity-sound" aria-label="Sound device">
    {lockNote && <p className="native-entity-sound-note">{lockNote}</p>}
    {draft && !error && <p className="native-entity-sound-note">Draft: waiting for the owner to accept it.</p>}
    {error && <div className="native-entity-sound-alert" role="alert">
      <p>{error}</p>
      <div className="native-entity-sound-actions">
        <button type="button" onClick={retry} disabled={off || sending || !draft}>Retry</button>
        <button type="button" onClick={discard} disabled={sending}>Discard</button>
      </div>
    </div>}

    {shownSound && s && env ? <>
      <p className="native-entity-sound-summary">{soundSummaryText(shownSound)}</p>
      <figure className="native-entity-sound-figure">
        <svg ref={svg} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="group" aria-label={`Sound envelope for ${entity.name}`}
          className="native-entity-sound-svg" onPointerMove={moveDrag} onPointerUp={event => endDrag(event, false)} onPointerCancel={event => endDrag(event, true)}>
          <text x={ENVELOPE.x0} y={12} className="native-entity-sound-label">Envelope · attack {s.attack} s · release {s.release} s · gain {s.gain}</text>
          <rect x={ENVELOPE.x0} y={ENVELOPE.topY} width={ENVELOPE.span} height={ENVELOPE.baseY - ENVELOPE.topY} className="native-entity-sound-plot" />
          {[0, 10, 20, 30, 40].map(second => <g key={second}>
            <path d={`M${timeToX(second)} ${ENVELOPE.topY}V${ENVELOPE.baseY}`} className="native-grid-line" />
            <text x={timeToX(second)} y={ENVELOPE.baseY + 13} textAnchor="middle" className="native-entity-sound-label">{second} s</text>
          </g>)}
          <text x={timeToX(s.attack) + 8} y={env.gainY - 6} className="native-entity-sound-label">sustain while present</text>
          <path d={env.path} className="native-entity-sound-env" />
          {handle('attack', env.handles.attack.x, env.handles.attack.y, 'Attack handle', s.attack, `${s.attack} seconds`, 0, 10)}
          {handle('release', env.handles.release.x, env.handles.release.y, 'Release handle', s.release, `${s.release} seconds after the sustain`, 0, 30)}
          {handle('gain', env.handles.gain.x, env.handles.gain.y, 'Gain handle', s.gain, `gain ${s.gain}`, 0, 1, true)}

        </svg>
        <figcaption>Configuration diagram, drawn only from this object's sound. The envelope shares one time axis (0 to 40 s); the sustain is a break, not to scale. It is not a sound preview.</figcaption>
      </figure>
      <div className="native-entity-sound-groups">
        {SOUND_GROUPS.map(group => <section key={group.title} className="native-entity-sound-group" aria-label={group.title}>
          <h4>{group.title}</h4>
          <div className="native-entity-sound-grid">{group.fields.map(renderField)}</div>
        </section>)}
      </div>
      <button type="button" className="native-entity-sound-remove" onClick={() => void edit(() => null)} disabled={off || sending}>Remove sound</button>
    </> : <div className="native-entity-sound-absent">
      <p>No sound on this object.</p>
      <button type="button" onClick={() => void edit(() => addedSound())} disabled={off || sending}>Add sound</button>
    </div>}

    <footer className="native-entity-sound-footer">
      <p>Audio: this voice carries part of the torus's sound, in the Expressions body only. It makes no sound of its own: while the torus is silent it is silent. This panel shows the configuration and does not play it.</p>
      <p>Presentation mute is local to the page and is not saved in the document; it is not offered here.</p>
    </footer>
  </section>
}

/** The ENTITY view for the Sound family: the shared body supplies the article and heading; this renders the whole panel. */
export const soundFaceView: EntityFaceView = {
  render: ctx => <SoundPanel key={ctx.reading.basis.scene_ref + ':' + ctx.entity.id} {...ctx} />,
}
