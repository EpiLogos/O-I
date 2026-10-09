import {useCallback, useEffect, useState} from 'react'

/** The Nara conversation device — central family, face `nara-conversation`.
 *
 * A conversation face over `oi.nara-dialogue-binding/v1` (WORLD-SHELL-DESIGN
 * §5.3): the shell binds through the kernel's Nara dialogue op; canonical
 * session, transcript and draft CAS stay in AIKit. The face is a binding
 * reading and an aperture, never a second conversation store:
 * - with a current Nara identity and an open Expression, it resolves the
 *   binding (`lookupNativeDialogue`) and discloses it verbatim — role,
 *   person, Nara, expression, provisioning standing, resume requirement;
 * - without one, it says so — absent identity is disclosed absence, the
 *   most honest state a conversation device can hold;
 * - the pop-out rides the existing `encounter` detached kind; the full
 *   conversation surface is the encounter surface that already exists.
 * No transcript renders here: the encounter surface owns that reading. */

import {lookupNativeDialogue, type NativeDialogue} from '../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity, type CurrentIdentity} from '../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import './inhabitantDevices.css'

export interface ConversationNaraFaceProps {
  readonly transport: KernelTransportStatus
  readonly project: string | null
  /** The expression the conversation binds to (the aperture's subject). */
  readonly expressionRef: string | null
  /** Identity handed in by the host; when absent the face reads the module's
   * current identity itself and discloses absence if neither exists. */
  readonly identity?: CurrentIdentity | null
  readonly expanded?: boolean
}

type Standing =
  | {state: 'no-identity'}
  | {state: 'no-expression'}
  | {state: 'resolving'}
  | {state: 'bound'; dialogue: NativeDialogue}
  | {state: 'unbound'; detail: string}
  | {state: 'refused'; detail: string}

export function ConversationNaraFace({transport, project, expressionRef, identity, expanded = false}: ConversationNaraFaceProps) {
  const [standing, setStanding] = useState<Standing>({state: expressionRef ? 'resolving' : 'no-expression'})

  useEffect(() => {
    let alive = true
    const person = identity ?? currentIdentity()
    if (!person) {
      setStanding({state: 'no-identity'})
      return
    }
    if (!expressionRef) {
      setStanding({state: 'no-expression'})
      return
    }
    setStanding({state: 'resolving'})
    ;(async () => {
      try {
        const dialogue = await lookupNativeDialogue(transport, project ?? '', person, expressionRef, 'nara')
        if (!alive) return
        if (dialogue) setStanding({state: 'bound', dialogue})
        else setStanding({state: 'unbound', detail: 'AIKit holds no dialogue binding for this person and expression yet; resolve creates one through its own operation.'})
      } catch (error) {
        if (alive) setStanding({state: 'refused', detail: String(error)})
      }
    })()
    return () => {alive = false}
  }, [expressionRef, identity, project, transport])

  const openEncounter = useCallback(() => {
    // The aperture opens the existing encounter surface through its own
    // door (the `encounter` binding the panes already host). This face
    // dispatches no conversation operation of its own.
    window.dispatchEvent(new CustomEvent('oi:open-encounter', {detail: {project, expression: expressionRef}}))
  }, [expressionRef, project])

  const light = standing.state === 'bound' ? ' is-engaged' : standing.state === 'resolving' ? ' is-pending' : ''
  const lightTitle = standing.state === 'bound'
    ? 'Dialogue binding resolved — the encounter surface holds the conversation'
    : standing.state === 'resolving'
      ? 'Resolving the Nara dialogue binding'
      : 'No binding: the honest absence is the face\'s content'

  return (
    <article className="inhabitant-device inhabitant-conversation" data-conversation-device="nara" data-standing={standing.state}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${light}`} title={lightTitle} />
        <strong>Conversation</strong>
        <span className="inhabitant-device-sub">oi.nara-dialogue-binding/v1</span>
        <span className="inhabitant-device-save" role="status">{standingLabel(standing)}</span>
      </header>
      {expanded && <div className="inhabitant-conversation-body">
        {standing.state === 'bound' && <dl className="inhabitant-kv" data-binding-fields>
          <dt>role</dt><dd>{standing.dialogue.role}</dd>
          <dt>person</dt><dd>{standing.dialogue.binding.person_ref}</dd>
          <dt>nara</dt><dd>{standing.dialogue.binding.nara_ref}</dd>
          <dt>expression</dt><dd>{standing.dialogue.binding.expression_ref}</dd>
          <dt>session</dt><dd>{standing.dialogue.provisioning.agent_session}</dd>
          <dt>space</dt><dd>{standing.dialogue.provisioning.space}</dd>
          {standing.dialogue.provisioning.resume_required !== undefined && <>
            <dt>resume</dt><dd>{String(standing.dialogue.provisioning.resume_required)}</dd>
          </>}
        </dl>}
        {standing.state === 'unbound' && <p className="inhabitant-device-notice">{standing.detail}</p>}
        {standing.state === 'no-identity' && <p className="inhabitant-device-notice">No Nara identity is current. The binding waits for its person — select an identity through the identity owner; nothing is fabricated here.</p>}
        {standing.state === 'no-expression' && <p className="inhabitant-device-notice">No expression is selected. A conversation binds to the encounter's subject — select one, and the binding resolves through its owner.</p>}
        {standing.state === 'refused' && <p className="inhabitant-device-fault" role="alert">{standing.detail}</p>}
        {standing.state === 'bound' && <button type="button" data-action="open-encounter" onClick={openEncounter}>Open the encounter surface</button>}
      </div>}
    </article>
  )
}

function standingLabel(standing: Standing): string {
  switch (standing.state) {
    case 'bound': return 'bound'
    case 'resolving': return 'resolving…'
    case 'unbound': return 'unbound — declared, waiting'
    case 'no-identity': return 'no identity — disclosed absence'
    case 'no-expression': return 'no subject — disclosed absence'
    case 'refused': return 'refused'
  }
}
