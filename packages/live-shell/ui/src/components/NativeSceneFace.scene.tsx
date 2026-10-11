import {useRef, useState, type KeyboardEvent} from 'react'
import {NativeSceneEditor} from './NativeSceneEditor'
import {EXPRESSION_DESCRIPTION_MAX, EXPRESSION_TITLE_MAX, expressionDescriptionProblem, expressionEditRequest, expressionTitleProblem} from './nativeSceneFace.scene.ts'
import type {SceneFacePanelProps} from './nativeSceneFaceViews.tsx'
import './NativeSceneFace.scene.css'

/** The Scene device's whole expanded panel. Scene settings are the existing NativeSceneEditor, hosted unchanged (name, duration,
 * transition, Save & next, loop, scene list and reorder, add, duplicate, remove). Expression settings are the Expression title and
 * description, each committed through the boundary's expression-title and expression-description intents. */
export function ScenePanel({reading, request, disabled}: SceneFacePanelProps) {
  const [draft, setDraft] = useState<string | null>(null), [fault, setFault] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState<string | null>(null), [textFault, setTextFault] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const current = reading.scenes?.title ?? ''
  const currentDescription = reading.scenes?.description ?? ''
  const locked = disabled || busy || reading.standing.pending || !reading.scenes
  const send = async (intent: Parameters<typeof expressionEditRequest>[1], problem: string | null,
    report: (fault: string | null) => void, done: () => void) => {
    if (problem) {report(problem); return}
    const edit = expressionEditRequest(reading, intent)
    if (!edit) {report('The native owner has not disclosed this Expression selection yet, so it cannot change here.'); return}
    inFlight.current = true; setBusy(true); report(null)
    try {
      const reply = await request(edit)
      if (reply.ok) done(); else report(reply.error)
    } catch (cause) {report(cause instanceof Error ? cause.message : String(cause))}
    finally {inFlight.current = false; setBusy(false)}
  }
  const commit = async () => {
    if (inFlight.current || draft === null) return
    if (draft === current) {setDraft(null); return}
    await send({operation: 'expression-title', title: draft.trim()}, expressionTitleProblem(draft), setFault, () => setDraft(null))
  }
  const commitText = async () => {
    if (inFlight.current || textDraft === null) return
    if (textDraft === currentDescription) {setTextDraft(null); return}
    // The description is stored as written: empty is a real value and nothing is trimmed.
    await send({operation: 'expression-description', description: textDraft}, expressionDescriptionProblem(textDraft), setTextFault, () => setTextDraft(null))
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {event.preventDefault(); void commit()}
    // Escape reverts the draft only. It must not blur: a blur would commit the stale draft from this render.
    // preventDefault keeps the pool's own Escape (close) from firing.
    if (event.key === 'Escape') {event.preventDefault(); setDraft(null); setFault(null)}
  }
  // Same commit pattern as the title: Enter commits, Shift+Enter starts a new line, Escape reverts, blur commits.
  const onTextKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {event.preventDefault(); void commitText()}
    if (event.key === 'Escape') {event.preventDefault(); setTextDraft(null); setTextFault(null)}
  }
  return <div className="native-scene-face" aria-label="Scene settings">
    <section className="native-scene-face-section" aria-labelledby="native-scene-settings-title">
      <h3 id="native-scene-settings-title">Scene settings</h3>
      <NativeSceneEditor reading={reading} request={request}/>
    </section>
    <section className="native-scene-face-section" aria-labelledby="native-expression-settings-title">
      <h3 id="native-expression-settings-title">Expression settings</h3>
      <label className="native-scene-face-field"><span>Expression title</span>
        <input type="text" aria-label="Expression title" value={draft ?? current} maxLength={EXPRESSION_TITLE_MAX} disabled={locked}
          aria-invalid={fault ? true : undefined} aria-describedby={fault ? 'native-expression-fault' : undefined}
          onChange={event => {setDraft(event.currentTarget.value); setFault(null)}} onBlur={() => void commit()} onKeyDown={onKey}/>
      </label>
      {fault && <p id="native-expression-fault" role="alert" className="native-scene-face-fault">{fault}</p>}
      <label className="native-scene-face-field"><span>Expression description</span>
        <textarea aria-label="Expression description" value={textDraft ?? currentDescription} maxLength={EXPRESSION_DESCRIPTION_MAX}
          disabled={locked} rows={3} aria-invalid={textFault ? true : undefined}
          aria-describedby={textFault ? 'native-expression-description-fault' : undefined}
          onChange={event => {setTextDraft(event.currentTarget.value); setTextFault(null)}} onBlur={() => void commitText()} onKeyDown={onTextKey}/>
      </label>
      {textFault && <p id="native-expression-description-fault" role="alert" className="native-scene-face-fault">{textFault}</p>}
      <p className="native-scene-face-disclosure">Enter commits the title or description (Shift+Enter starts a new line in the description); Escape reverts the field being edited.</p>
    </section>
  </div>
}
