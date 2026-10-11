import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {NativeSemanticFieldChange} from '../../../../expressions-boundary/src/editor'
import type {SemanticBinding, SemanticColorCoupling, SemanticModulation} from '../../../../../desktop/cradle/expressions-app/src/engine/semantics/semanticTypes.ts'
import type {EntityFaceContext, EntityFaceView} from './nativeEntityFaceViews.tsx'
import {
  DEFAULT_RADIUS_PX, DIAGRAM, MEANING_NUMBERS, MEANING_OPTIONS, addedMapping, authoredGain, bindingOfEntity, canonicalColourOf, contributionColour, meaningSummaryText,
  discRadius, discStops, falloffPath, fieldChange, forceRadiusOf, labelOf, mappingsOf, meaningChange, newMeaningId, numberProblem,
  parseNumberText, planeOf, radiusAtDistance, resolvedRadius, semanticFieldOf, withColour, withMappings, withMeaning, withRadius, withResonanceGain,
  type MeaningNumberSpec,
} from './nativeEntityFace.meaning.ts'
import './NativeEntityFace.meaning.css'

type Draft = {binding: SemanticBinding | null} | null
const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const arrowDirection = (key: string): 1 | -1 | null => key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : null
/** The owner's refusal text from a reply the editor returned, or null when the reply is not a refusal. */
export function replyRefusal(reply: unknown): string | null {
  if (!reply || typeof reply !== 'object' || (reply as {ok?: unknown}).ok !== false) return null
  const error = (reply as {error?: unknown}).error
  return typeof error === 'string' && error ? error : 'The owner refused this meaning change.'
}
const LOCKED_NOTE = 'This object is locked. Unlock this entity to change its meaning.'
const HEX = /^#[\da-f]{6}$/i

/** One exact-value number. Commits on Enter or blur; a bad value shows its bound and sends nothing. */
function MeaningNumber({id, spec, value, disabled, onCommit}: {id: string; spec: MeaningNumberSpec; value: number; disabled: boolean; onCommit: (value: number) => Promise<void>}) {
  const [text, setText] = useState(String(value))
  const [problem, setProblem] = useState<string | null>(null)
  const inFlight = useRef<number | null>(null)
  useEffect(() => { setText(String(value)); setProblem(null) }, [value])
  const commit = () => {
    if (disabled) return
    const next = parseNumberText(text)
    const refused = numberProblem(spec, next)
    setProblem(refused)
    if (refused || next === value || inFlight.current === next) return
    inFlight.current = next
    void onCommit(next).finally(() => { if (inFlight.current === next) inFlight.current = null })
  }
  return <label className="native-entity-meaning-field" htmlFor={id}>
    <span>{spec.label}{spec.unit && <small>{spec.unit}</small>}</span>
    <input id={id} type="number" inputMode="decimal" min={spec.min} max={spec.max} step={spec.step} value={text} disabled={disabled}
      aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : undefined}
      onChange={event => setText(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { setText(String(value)); setProblem(null) }
      }} />
    {problem && <span id={`${id}-problem`} className="native-entity-meaning-problem">{problem}</span>}
  </label>
}

/** The override colour: a local value that commits once on blur or Enter, so a picker's stream of events is one change. */
function OverrideColour({id, value, disabled, onCommit}: {id: string; value: string; disabled: boolean; onCommit: (value: string) => void}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const commit = () => { if (!disabled && HEX.test(local) && local !== value) onCommit(local) }
  return <label className="native-entity-meaning-field" htmlFor={id}><span>Override colour</span>
    <input id={id} type="color" value={HEX.test(local) ? local : '#ffffff'} disabled={disabled} onChange={event => setLocal(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} /></label>
}

/** The Meaning device on one selected object: the diagram with its radius handle, then the inspector's groups. */
function MeaningPanel({reading, entity, disabled, apply}: EntityFaceContext) {
  const [draft, setDraft] = useState<Draft>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{pointerId: number; base: SemanticBinding; latest: number | null} | null>(null)
  const saved = bindingOfEntity(reading, entity) ?? null
  const shown: SemanticBinding | null = draft ? draft.binding : saved
  const field = semanticFieldOf(reading)
  const off = disabled || entity.locked || sending

  /** One gesture, one change: the whole next binding (or null). A refusal keeps the draft and shows the owner's text. */
  async function send(next: SemanticBinding | null): Promise<void> {
    let change: ReturnType<typeof meaningChange>
    try { change = meaningChange(entity.id, next) } catch (cause) { setError(messageOf(cause)); return }
    setError(null); setDraft({binding: next}); setSending(true)
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
  /** Builds the next binding from the shown one; a refused build shows its text and sends nothing. */
  const edit = (build: () => SemanticBinding | null): Promise<void> => {
    try { return send(build()) } catch (cause) { setError(messageOf(cause)); return Promise.resolve() }
  }
  async function sendField(build: () => NativeSemanticFieldChange): Promise<void> {
    let change: NativeSemanticFieldChange
    try { change = build() } catch (cause) { setFieldError(messageOf(cause)); return }
    setFieldError(null); setSending(true)
    try {
      const refusal = replyRefusal(await apply([change]))
      if (refusal) setFieldError(refusal)
    } catch (cause) {
      setFieldError(messageOf(cause))
    } finally {
      setSending(false)
    }
  }

  const point = (event: PointerEvent<SVGSVGElement> | {clientX: number; clientY: number}) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return null
    return {x: (event.clientX - box.left) * DIAGRAM.width / box.width, y: (event.clientY - box.top) * DIAGRAM.height / box.height}
  }
  const beginDrag = (base: SemanticBinding | null) => (event: PointerEvent<SVGGElement>) => {
    if (off || !base) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
    drag.current = {pointerId: event.pointerId, base, latest: null}
  }
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    const at = current && event.pointerId === current.pointerId ? point(event) : null
    if (!current || !at) return
    const value = radiusAtDistance(Math.hypot(at.x - DIAGRAM.cx, at.y - DIAGRAM.cy))
    current.latest = value
    setDraft({binding: withRadius(current.base, {value})})
  }
  /** Pointer up commits the one radius; a pointer cancel (or Escape) drops the draft and sends nothing. */
  const endDrag = (event: PointerEvent<SVGSVGElement>, cancel: boolean) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    drag.current = null
    const value = current.latest
    if (cancel || value === null || value === current.base.color?.radius.value) { setDraft(null); return }
    void send(withRadius(current.base, {value}))
  }
  const handleKey = (base: SemanticBinding | null) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Escape') { if (drag.current) { drag.current = null; setDraft(null) } return }
    const direction = arrowDirection(event.key)
    if (direction === null || off || !base) return
    event.preventDefault()
    const current = base.color?.radius.value ?? DEFAULT_RADIUS_PX
    const next = Math.min(MEANING_NUMBERS.radius.max, Math.max(MEANING_NUMBERS.radius.min, current + direction * (event.shiftKey ? 10 : 1)))
    if (next !== current) void edit(() => withRadius(base, {value: next}))
  }

  const retry = () => { if (draft) void send(draft.binding) }
  const discard = () => { setDraft(null); setError(null) }
  const lockNote = entity.locked ? LOCKED_NOTE : reading.standing.pending ? 'A native acknowledgement is pending: meaning edits wait for it.' : null
  const colour = shown?.color ?? null
  const radius = shown ? resolvedRadius(shown, entity) : null
  const forced = forceRadiusOf(entity)
  const gain = shown ? authoredGain(shown, field) : 0
  const contributed = shown ? contributionColour(shown, entity) : null
  const mappings = mappingsOf(shown ?? undefined)
  const idPrefix = `native-entity-meaning-${entity.id.replace(/[^\w-]/g, '_')}`
  const numberId = (name: string) => `${idPrefix}-${name}`
  const select = (name: string, label: string, value: string, options: readonly (readonly [string, string])[], onChange: (value: string) => void, isDisabled = off, note?: string) =>
    <label className="native-entity-meaning-field" htmlFor={numberId(name)} key={name}><span>{label}</span>
      <select id={numberId(name)} value={value} disabled={isDisabled} onChange={event => onChange(event.target.value)}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select>
      {note && <small className="native-entity-meaning-note">{note}</small>}</label>
  const toggle = (name: string, label: string, checked: boolean, onChange: (checked: boolean) => void, isDisabled = off) =>
    <label className="native-entity-meaning-toggle" key={name}><input id={numberId(name)} type="checkbox" checked={checked} disabled={isDisabled} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>

  const diagram = radius && shown ? (() => {
    const drawn = discRadius(radius.value)
    const stops = discStops(shown.color?.falloff ?? 'gaussian')
    const gradientId = `${idPrefix}-disc`
    const fills = {contribution: contributed, canonical: canonicalColourOf(shown), tint: entity.tint}
    return <figure className="native-entity-meaning-figure">
      <svg ref={svg} viewBox={`0 0 ${DIAGRAM.width} ${DIAGRAM.height}`} role="group" aria-label={`Meaning diagram for ${entity.name}`} className="native-entity-meaning-svg"
        onPointerMove={moveDrag} onPointerUp={event => endDrag(event, false)} onPointerCancel={event => endDrag(event, true)}>
        <text x={8} y={14} className="native-entity-meaning-label">Influence radius · {radius.value} {radius.source === 'force' ? 'stage units, followed' : 'native px, independent'}</text>
        <defs><radialGradient id={gradientId}>
          {stops.map(stop => <stop key={stop.offset} offset={`${stop.offset * 100}%`} stopColor={contributed ?? 'currentColor'} stopOpacity={gain > 0 ? Math.min(1, stop.opacity) : 0} />)}
        </radialGradient></defs>
        <circle cx={DIAGRAM.cx} cy={DIAGRAM.cy} r={DIAGRAM.radius} className="native-entity-meaning-frame" />
        <circle cx={DIAGRAM.cx} cy={DIAGRAM.cy} r={drawn} fill={`url(#${gradientId})`} className="native-entity-meaning-disc" />
        <circle cx={DIAGRAM.cx} cy={DIAGRAM.cy} r={drawn} className="native-entity-meaning-ring" />
        <circle cx={DIAGRAM.cx} cy={DIAGRAM.cy} r={2.5} className="native-entity-meaning-centre" />
        {radius.source === 'independent' && <g role="slider" tabIndex={off ? -1 : 0} aria-label="Independent radius handle" aria-valuemin={MEANING_NUMBERS.radius.min}
          aria-valuemax={MEANING_NUMBERS.radius.max} aria-valuenow={radius.value} aria-valuetext={`${radius.value} native px`} aria-disabled={off}
          className="native-entity-meaning-handle" onPointerDown={beginDrag(shown)} onKeyDown={handleKey(shown)}>
          <circle cx={DIAGRAM.cx + drawn} cy={DIAGRAM.cy} r={11} className="native-entity-meaning-hit" />
          <circle cx={DIAGRAM.cx + drawn} cy={DIAGRAM.cy} r={5} className="native-entity-meaning-knob" />
        </g>}
        <text x={DIAGRAM.plotX} y={DIAGRAM.plotTop - 8} className="native-entity-meaning-label">Falloff · {labelOf(MEANING_OPTIONS.falloff, shown.color?.falloff ?? 'gaussian')}</text>
        <rect x={DIAGRAM.plotX} y={DIAGRAM.plotTop} width={DIAGRAM.plotWidth} height={DIAGRAM.plotBase - DIAGRAM.plotTop} className="native-entity-meaning-plot" />
        <line x1={DIAGRAM.plotX + DIAGRAM.plotWidth / 2} x2={DIAGRAM.plotX + DIAGRAM.plotWidth / 2} y1={DIAGRAM.plotTop} y2={DIAGRAM.plotBase} className="native-grid-line" />
        <path d={falloffPath(shown.color?.falloff ?? 'gaussian')} className="native-entity-meaning-curve" />
        <text x={DIAGRAM.plotX} y={DIAGRAM.plotBase + 13} className="native-entity-meaning-label">0</text>
        <text x={DIAGRAM.plotX + DIAGRAM.plotWidth / 2} y={DIAGRAM.plotBase + 13} textAnchor="middle" className="native-entity-meaning-label">r</text>
        <text x={DIAGRAM.plotX + DIAGRAM.plotWidth} y={DIAGRAM.plotBase + 13} textAnchor="end" className="native-entity-meaning-label">2r</text>
        {[['Contribution', fills.contribution], ['Canonical', fills.canonical], ['Entity tint', fills.tint]].map(([label, colour], index) => <g key={label as string} transform={`translate(${8 + index * 118} 180)`}>
          <rect width={12} height={12} rx={2} fill={(colour as string | null) ?? 'none'} className="native-entity-meaning-swatch" />
          <text x={18} y={10} className="native-entity-meaning-label">{label as string}{colour ? ` ${colour}` : ' none'}</text>
        </g>)}
        <text x={8} y={206} className="native-entity-meaning-label">Plane {planeOf(reading)} · metric {labelOf(MEANING_OPTIONS.metric, shown.color?.metric ?? 'compositionPlane')} · mix {labelOf(MEANING_OPTIONS.blend, shown.color?.blend ?? 'weighted')}</text>
        <text x={8} y={220} className="native-entity-meaning-label">Authored peak gain {Number(gain.toFixed(3))} · activation {labelOf(MEANING_OPTIONS.activation, shown.color?.activation ?? 'constant')} is live</text>
      </svg>
      <figcaption>Configuration diagram, drawn from this object's meaning and the Scene's semantic field. The disc is drawn on one fixed scale of 220 native px, the engine's default radius; a radius beyond 1.6 times that scale is drawn at the edge. It is not the rendered field: the Stage shows the result.</figcaption>
    </figure>
  })() : null

  return <section className="native-entity-meaning" aria-label="Meaning device">
    {lockNote && <p className="native-entity-meaning-note">{lockNote}</p>}
    {draft && !error && <p className="native-entity-meaning-note">Draft: waiting for the owner to accept it.</p>}
    {error && <div className="native-entity-meaning-alert" role="alert">
      <p>{error}</p>
      <div className="native-entity-meaning-actions">
        <button type="button" onClick={retry} disabled={off || sending || !draft}>Retry</button>
        <button type="button" onClick={discard} disabled={sending}>Discard</button>
      </div>
    </div>}
    <p className="native-entity-meaning-summary">{shown ? meaningSummaryText(shown, field) : 'No meaning on this object. Choose one below to attach it.'}</p>

    {diagram}

    <div className="native-entity-meaning-groups">
      <section className="native-entity-meaning-group" aria-label="Meaning">
        <h4>Meaning</h4>
        <div className="native-entity-meaning-grid">
          {select('meaning', 'Meaning', shown?.semanticNodeId ?? 'none', MEANING_OPTIONS.meaning, value => void edit(() => withMeaning(shown ?? undefined, entity.id, value === 'none' ? null : value, newMeaningId)))}
        </div>
        <p className="native-entity-meaning-note">Attached by stable entity identity: moving, reshaping or reordering this object does not change it. Assigning a meaning switches the Scene's semantic layer on, as the inspector does. The live resonant anchor and affinity are not in this reading.</p>
        {shown && <button type="button" className="native-entity-meaning-remove" onClick={() => void edit(() => null)} disabled={off}>Remove meaning</button>}
      </section>

      {shown && <section className="native-entity-meaning-group" aria-label="Colour">
        <h4>Colour</h4>
        {!colour && <p className="native-entity-meaning-note">No colour contribution is authored for this meaning. The controls show the app's defaults; the first change writes them.</p>}
        <div className="native-entity-meaning-grid">
          {toggle('colour-enabled', 'Spatial colour contribution', colour?.enabled === true, checked => void edit(() => withColour(shown, {enabled: checked})))}
          {select('colour-source', 'Colour identity', colour?.colorSource ?? 'canonical', MEANING_OPTIONS.colourSource, value => void edit(() => withColour(shown, {colorSource: value as SemanticColorCoupling['colorSource']})))}
          {colour?.colorSource === 'override' && <OverrideColour id={numberId('override')} value={colour.overrideColor ?? '#ffffff'} disabled={off}
            onCommit={value => void edit(() => withColour(shown, {overrideColor: value}))} />}
          {select('activation', 'Activation', colour?.activation ?? 'constant', MEANING_OPTIONS.activation, value => void edit(() => withColour(shown, {activation: value as SemanticColorCoupling['activation']})),
            off, 'Live activations read the travelling focus or resonance, which this reading does not carry.')}
          <MeaningNumber id={numberId('colour-gain')} spec={MEANING_NUMBERS.colourGain} value={colour?.gain ?? 1} disabled={off}
            onCommit={value => edit(() => withColour(shown, {gain: value}))} />
          <MeaningNumber id={numberId('resonance-gain')} spec={MEANING_NUMBERS.resonanceGain} value={shown.resonance?.gain ?? 1} disabled={off}
            onCommit={value => edit(() => withResonanceGain(shown, value))} />
        </div>
      </section>}

      {shown && <section className="native-entity-meaning-group" aria-label="Radius and falloff">
        <h4>Radius and falloff</h4>
        <div className="native-entity-meaning-grid">
          {select('radius-source', 'Colour radius', colour?.radius.source ?? 'force', MEANING_OPTIONS.radiusSource, value => void edit(() => withRadius(shown, {source: value as 'force' | 'independent'})))}
          {colour?.radius.source === 'independent' && <MeaningNumber id={numberId('radius')} spec={MEANING_NUMBERS.radius} value={colour.radius.value ?? DEFAULT_RADIUS_PX} disabled={off}
            onCommit={value => edit(() => withRadius(shown, {value}))} />}
          {select('falloff', 'Falloff', colour?.falloff ?? 'gaussian', MEANING_OPTIONS.falloff, value => void edit(() => withColour(shown, {falloff: value as SemanticColorCoupling['falloff']})))}
          {select('metric', 'Metric', colour?.metric ?? 'compositionPlane', MEANING_OPTIONS.metric, value => void edit(() => withColour(shown, {metric: value as SemanticColorCoupling['metric']})))}
          {select('blend', 'Mix law', colour?.blend ?? 'weighted', MEANING_OPTIONS.blend, value => void edit(() => withColour(shown, {blend: value as SemanticColorCoupling['blend']})))}
        </div>
        {colour?.radius.source !== 'independent' && <p className="native-entity-meaning-note" data-derived-radius>
          Follows this object's force radius: {forced.value} stage units{forced.emitter ? ', read from Influence · Falloff radius' : ' (no force emitter: the engine default, 220 native px)'}. Read only here; change it in Influence.
        </p>}
      </section>}

      {shown && <section className="native-entity-meaning-group" aria-label="Mapping">
        <h4>Mapping</h4>
        {mappings.length ? mappings.map((mapping: SemanticModulation, index) => <div key={index} className="native-entity-meaning-mapping" aria-label={`Mapping ${index + 1}`}>
          {select(`mapping-${index}-signal`, 'Signal', mapping.source.kind, MEANING_OPTIONS.signal, value => void edit(() => withMappings(shown, mappings.map((m, i) => i === index ? {...m, source: {kind: value as SemanticModulation['source']['kind']}} : m))))}
          {select(`mapping-${index}-target`, 'Modulates', mapping.target, MEANING_OPTIONS.target, value => void edit(() => withMappings(shown, mappings.map((m, i) => i === index ? {...m, target: value as SemanticModulation['target']} : m))))}
          <MeaningNumber id={numberId(`mapping-${index}-amount`)} spec={MEANING_NUMBERS.amount} value={mapping.amount} disabled={off}
            onCommit={value => edit(() => withMappings(shown, mappings.map((m, i) => i === index ? {...m, amount: value} : m)))} />
          <MeaningNumber id={numberId(`mapping-${index}-offset`)} spec={MEANING_NUMBERS.offset} value={mapping.offset ?? 0} disabled={off}
            onCommit={value => edit(() => withMappings(shown, mappings.map((m, i) => i === index ? {...m, offset: value} : m)))} />
          <button type="button" aria-label={`Remove mapping ${index + 1}`} onClick={() => void edit(() => withMappings(shown, mappings.filter((_, i) => i !== index)))} disabled={off}>Remove mapping</button>
        </div>) : <p className="native-entity-meaning-note">No physical signal currently modulates this colour contribution.</p>}
        <button type="button" onClick={() => void edit(() => withMappings(shown, [...mappings, addedMapping()]))} disabled={off}>Add signal mapping</button>
        <p className="native-entity-meaning-note">Mappings are data: they change colour gain, radius or hue without rewriting the stored values. Force and colour stay separate; strength, polarity and spin recolour only when mapped here.</p>
      </section>}

      <section className="native-entity-meaning-group" aria-label="Scene field">
        <h4>Scene field</h4>
        {fieldError && <p className="native-entity-meaning-alert" role="alert">{fieldError}</p>}
        <div className="native-entity-meaning-grid">
          {toggle('field-enabled', 'Semantic layer enabled', field?.enabled === true, checked => void sendField(() => fieldChange('enabled', checked)), disabled || sending || !field)}
          <MeaningNumber id={numberId('global-gain')} spec={MEANING_NUMBERS.globalColourGain} value={field?.globalColorGain ?? 1} disabled={disabled || sending || !field}
            onCommit={value => sendField(() => fieldChange('globalColorGain', value))} />
        </div>
        <p className="native-entity-meaning-note">The same flag and gain as the Colour and material panel's Semantic spatial colour field. The Scene field is not object data, so an object lock does not gate it.</p>
      </section>
    </div>

    <footer className="native-entity-meaning-footer">
      <p>Presentation only: the semantic colour is drawn in the Stage. The live affinity, focus and mapped signals are not in this reading and are not drawn.</p>
    </footer>
  </section>
}

/** The ENTITY view for the Meaning family: the shared body supplies the article and heading; this renders the whole panel. */
export const meaningFaceView: EntityFaceView = {
  render: ctx => <MeaningPanel key={ctx.reading.basis.scene_ref + ':' + ctx.entity.id} {...ctx} />,
}
