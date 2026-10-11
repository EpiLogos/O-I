import {useRef, useState, type FormEvent} from 'react'
import {
  MAX_BODY_ACTIONS, MAX_TRIGGERS_PER_SCENE, PORTAL_PLACEMENTS, SCENE_BODY_PRESENTATIONS, TRIGGER_OCCASIONS, TRIGGER_OPERATIONS,
  type NativeSceneBodyPresentation, type NativeSceneMaterialIntent,
} from '../../../../expressions-boundary/src/sceneMaterialEdits'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import {
  CARRIER_LABELS, DEFAULT_BODY_FORM, DEFAULT_TRIGGER_FORM, OCCASION_LABELS, OPERATION_LABELS, PLACEMENT_LABELS, PRESENTATION_LABELS, SUBJECT_MAX, TARGET_LABELS,
  TRIGGER_KINDS, bodyClearIntent, bodySetIntent, carrierOptions, newTriggerId, presentationProblem, triggerAttachIntent, triggerContext, triggerDetachIntent,
  triggerKindProblem, triggerTargetLabel, type BodyCarrier, type BodyForm, type PortalPlacementName, type TriggerForm, type TriggerKind,
  type TriggerOccasionName, type TriggerOperation,
} from './nativeSceneFace.body.ts'
import './NativeSceneFace.body.css'

/** The Scene body and Jump trigger device's whole expanded panel. The body is one native `scene_body_set`/`scene_body_clear`; each trigger is
 * one `scene_trigger_attach`/`scene_trigger_detach`. Every write is one `scene-material` request on the reading's basis; a refusal keeps the draft. */
export function BodyPanel({reading, request, disabled}: SceneFacePanelProps) {
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState<string | null>(null)
  const [bodyForm, setBodyForm] = useState<BodyForm>(DEFAULT_BODY_FORM)
  const [bodyProblem, setBodyProblem] = useState<string | null>(null)
  const [triggerForm, setTriggerForm] = useState<TriggerForm>(DEFAULT_TRIGGER_FORM)
  const [triggerProblem, setTriggerProblem] = useState<string | null>(null)
  const inFlight = useRef(false)
  const context = triggerContext(reading)
  const native = reading.nativeScene
  const locked = disabled || busy || reading.standing.pending

  if (!native || !context) return <div className="native-body-face" aria-label="Scene body and jump triggers">
    <p className="native-body-face-empty">Scene body and triggers are not in this reading. Open this Scene as a native Expression to author them.</p>
  </div>

  const body = native.body
  const triggers = native.triggers
  const carriers = carrierOptions()
  const carrierOption = carriers.find(row => row.carrier === bodyForm.carrier) ?? carriers[0]
  const kindProblems = Object.fromEntries(TRIGGER_KINDS.map(kind => [kind, triggerKindProblem(kind, context)])) as Record<TriggerKind, string | null>
  // The effective selections: the stored choice when it is still offered, otherwise the first offered one.
  const sceneValue = context.scenes.some(row => row.scene_ref === triggerForm.scene) ? triggerForm.scene : context.scenes[0]?.scene_ref ?? ''
  const subjectValue = context.subjects[0] ?? ''
  const actionValue = context.actions.some(row => row.action_ref === triggerForm.action) ? triggerForm.action : context.actions[0]?.action_ref ?? ''
  const presentationReason = presentationProblem(bodyForm.presentation, 'renderable')
  const kindProblem = kindProblems[triggerForm.kind]
  const capabilityLabel = body
    ? body.capability.state === 'renderable' ? 'renderable' : `${body.capability.state === 'degrades_to_thing' ? 'degrades to a Thing' : 'unavailable'}: ${'reason' in body.capability ? body.capability.reason : ''}`
    : ''

  // One request, one in flight. Success returns true; an owner refusal is shown on the alert line and the draft stays.
  const send = async (intent: NativeSceneMaterialIntent): Promise<boolean> => {
    if (inFlight.current || locked) return false
    inFlight.current = true; setBusy(true); setFault(null)
    try {
      const reply = await request({operation: 'scene-material', basis: reading.basis, intent})
      if (reply.ok) return true
      setFault(reply.error); return false
    } catch (cause) {
      setFault(cause instanceof Error ? cause.message : String(cause)); return false
    } finally {inFlight.current = false; setBusy(false)}
  }
  const submitBody = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = bodySetIntent(bodyForm)
    setBodyProblem(result.problem)
    if (result.intent) void send(result.intent)
  }
  const submitTrigger = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = triggerAttachIntent({...triggerForm, scene: sceneValue, subject: subjectValue, action: actionValue}, context, newTriggerId(Date.now(), Math.random))
    setTriggerProblem(result.problem)
    if (result.intent) void send(result.intent)
  }
  const optionText = (row: (typeof carriers)[number]) => row.resolvable ? row.label
    : `${row.label} (${row.carrier === 'engine_composition' ? 'default: use Clear body' : 'no host resolver yet'})`

  return <div className="native-body-face" aria-label="Scene body and jump triggers">
    {fault && <div className="native-body-face-fault" role="alert"><p>{fault}</p><button type="button" onClick={() => setFault(null)}>Dismiss</button></div>}

    <section className="native-body-face-section" aria-labelledby="native-body-scene-title">
      <header><h3 id="native-body-scene-title">Scene body</h3><span>{body ? 'Set' : 'None'}</span></header>
      {body
        ? <p className="native-body-face-current">{CARRIER_LABELS[body.carrier as BodyCarrier] ?? body.carrier} · {body.subject_ref} · {PRESENTATION_LABELS[body.presentation as NativeSceneBodyPresentation] ?? body.presentation} · {capabilityLabel}{body.span ? ` · span ${body.span.start}–${body.span.end}` : ''}</p>
        : <p className="native-body-face-current">No native body: this Scene shows its live engine composition.</p>}
      <p className="native-body-face-budget">Actions on this body: {body?.actions.length ?? 0} / {MAX_BODY_ACTIONS}</p>
      {body && <button type="button" disabled={locked} onClick={() => void send(bodyClearIntent())}>Clear body</button>}

      <form className="native-body-face-form" onSubmit={submitBody} aria-label="Set the Scene body">
        <label className="native-body-face-field"><span>Carrier</span>
          <select aria-label="Body carrier" aria-describedby="native-body-carrier-reason" value={bodyForm.carrier} disabled={locked}
            onChange={event => {setBodyForm({...bodyForm, carrier: event.currentTarget.value as BodyCarrier}); setBodyProblem(null)}}>
            {carriers.map(row => <option key={row.carrier} value={row.carrier} disabled={!row.resolvable}>{optionText(row)}</option>)}
          </select>
        </label>
        <small id="native-body-carrier-reason" className="native-body-face-reason">
          {carrierOption.resolvable ? 'The host reads this native source exactly and writes its reading into the Scene.'
            : `${carrierOption.label} ${carrierOption.carrier === 'engine_composition' ? 'is the default body, shown by Clear body' : 'has no host resolver yet, so it cannot be set from the shell'}.`}
        </small>
        <label className="native-body-face-field"><span>Presentation</span>
          <select aria-label="Body presentation" aria-describedby="native-body-presentation-reason" value={bodyForm.presentation} disabled={locked}
            onChange={event => {setBodyForm({...bodyForm, presentation: event.currentTarget.value as NativeSceneBodyPresentation}); setBodyProblem(null)}}>
            {SCENE_BODY_PRESENTATIONS.map(presentation => {
              const reason = presentationProblem(presentation, 'renderable')
              return <option key={presentation} value={presentation} disabled={!!reason}>{reason ? `${PRESENTATION_LABELS[presentation]} (not for this body)` : PRESENTATION_LABELS[presentation]}</option>
            })}
          </select>
        </label>
        <small id="native-body-presentation-reason" className="native-body-face-reason">{presentationReason ?? 'Live and inline draw the native source; preview shows a bounded excerpt.'}</small>
        <label className="native-body-face-field"><span>Native file ref or path</span>
          <input type="text" aria-label="Native file ref or path" placeholder="Project/notes.md" maxLength={SUBJECT_MAX} value={bodyForm.subject}
            disabled={locked || !carrierOption.resolvable} onChange={event => {setBodyForm({...bodyForm, subject: event.currentTarget.value}); setBodyProblem(null)}}/>
        </label>
        {bodyForm.carrier === 'text_source' && <div className="native-body-face-pair">
          <label className="native-body-face-field"><span>Span start</span>
            <input type="number" aria-label="Span start" min={0} step={1} value={bodyForm.spanStart} disabled={locked}
              onChange={event => {setBodyForm({...bodyForm, spanStart: event.currentTarget.value}); setBodyProblem(null)}}/></label>
          <label className="native-body-face-field"><span>Span end (0 = whole file)</span>
            <input type="number" aria-label="Span end" min={0} step={1} value={bodyForm.spanEnd} disabled={locked}
              onChange={event => {setBodyForm({...bodyForm, spanEnd: event.currentTarget.value}); setBodyProblem(null)}}/></label>
        </div>}
        <button type="submit" disabled={locked || !carrierOption.resolvable}>Set body</button>
        {bodyProblem && <small className="native-body-face-problem" role="status">{bodyProblem}</small>}
      </form>
    </section>

    <section className="native-body-face-section" aria-labelledby="native-body-jump-title">
      <header><h3 id="native-body-jump-title">Jump triggers</h3><span>{triggers.length} / {MAX_TRIGGERS_PER_SCENE}</span></header>
      {triggers.length
        ? <ol className="native-body-face-triggers" aria-label="Triggers on this Scene">{triggers.map(trigger => {
          const label = `${OCCASION_LABELS[trigger.occasion as TriggerOccasionName] ?? trigger.occasion}: ${triggerTargetLabel(trigger.target)}`
          return <li key={trigger.trigger_ref}>
            <span><strong>{OCCASION_LABELS[trigger.occasion as TriggerOccasionName] ?? trigger.occasion}</strong> {triggerTargetLabel(trigger.target)}</span>
            <button type="button" disabled={locked} aria-label={`Remove trigger ${label}`} onClick={() => void send(triggerDetachIntent(trigger.trigger_ref))}>Remove</button>
          </li>
        })}</ol>
        : <p className="native-body-face-empty">No triggers on this Scene.</p>}

      <form className="native-body-face-form" onSubmit={submitTrigger} aria-label="Add a jump trigger">
        <label className="native-body-face-field"><span>When</span>
          <select aria-label="Trigger occasion" value={triggerForm.occasion} disabled={locked}
            onChange={event => {setTriggerForm({...triggerForm, occasion: event.currentTarget.value as TriggerOccasionName}); setTriggerProblem(null)}}>
            {TRIGGER_OCCASIONS.map(occasion => <option key={occasion} value={occasion}>{OCCASION_LABELS[occasion]}</option>)}
          </select>
        </label>
        <label className="native-body-face-field"><span>Target</span>
          <select aria-label="Trigger target" aria-describedby="native-body-target-reason" value={triggerForm.kind} disabled={locked}
            onChange={event => {setTriggerForm({...triggerForm, kind: event.currentTarget.value as TriggerKind}); setTriggerProblem(null)}}>
            {TRIGGER_KINDS.map(kind => <option key={kind} value={kind} disabled={!!kindProblems[kind]}>{kindProblems[kind] ? `${TARGET_LABELS[kind]} (unavailable)` : TARGET_LABELS[kind]}</option>)}
          </select>
        </label>
        <small id="native-body-target-reason" className="native-body-face-reason">{kindProblem ?? 'One exact target. Each is checked by the kernel before it is kept.'}</small>

        {triggerForm.kind === 'expression_operation' && <>
          <label className="native-body-face-field"><span>Operation</span>
            <select aria-label="Expression operation" value={triggerForm.operation} disabled={locked}
              onChange={event => setTriggerForm({...triggerForm, operation: event.currentTarget.value as TriggerOperation})}>
              {TRIGGER_OPERATIONS.map(operation => <option key={operation} value={operation}>{OPERATION_LABELS[operation]}</option>)}
            </select>
          </label>
          <small className="native-body-face-reason">Reads {context.expressionRef}. Triggers never mutate documents.</small>
        </>}
        {triggerForm.kind === 'portal' && <>
          <label className="native-body-face-field"><span>Placement</span>
            <select aria-label="Portal placement" value={triggerForm.placement} disabled={locked}
              onChange={event => setTriggerForm({...triggerForm, placement: event.currentTarget.value as PortalPlacementName})}>
              {PORTAL_PLACEMENTS.map(placement => <option key={placement} value={placement}>{PLACEMENT_LABELS[placement]}</option>)}
            </select>
          </label>
          {subjectValue && <small className="native-body-face-reason">Opens {subjectValue}, the subject disclosed on this Scene body.</small>}
        </>}
        {triggerForm.kind === 'native_action' && context.actions.length > 0 && <>
          <label className="native-body-face-field"><span>Native Action</span>
            <select aria-label="Native Action" value={actionValue} disabled={locked}
              onChange={event => setTriggerForm({...triggerForm, action: event.currentTarget.value})}>
              {context.actions.map(action => <option key={action.action_ref} value={action.action_ref}>{action.action_ref} on {action.target_ref}</option>)}
            </select>
          </label>
          <small className="native-body-face-reason">Requires {context.actions.find(row => row.action_ref === actionValue)?.authority_requirement ?? 'its disclosed authority'}.</small>
        </>}
        {triggerForm.kind === 'navigate' && context.scenes.length > 0 && <label className="native-body-face-field"><span>Scene to jump to</span>
          <select aria-label="Scene to jump to" value={sceneValue} disabled={locked}
            onChange={event => setTriggerForm({...triggerForm, scene: event.currentTarget.value})}>
            {context.scenes.map(scene => <option key={scene.scene_ref} value={scene.scene_ref}>{scene.title}</option>)}
          </select>
        </label>}

        <button type="submit" disabled={locked || triggers.length >= MAX_TRIGGERS_PER_SCENE || !!kindProblem}>Add trigger</button>
        <small className="native-body-face-budget">{triggers.length} of {MAX_TRIGGERS_PER_SCENE} triggers used on this Scene.</small>
        {triggerProblem && <small className="native-body-face-problem" role="status">{triggerProblem}</small>}
      </form>
    </section>
  </div>
}
