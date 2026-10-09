import {useCallback, useEffect, useState} from 'react'

/** The Nara conversation device — central family, face `nara-conversation`.
 *
 * A conversation face over `oi.nara-dialogue-binding/v1` (WORLD-SHELL-DESIGN
 * §5.3): the shell binds through the kernel's Nara dialogue op; canonical
 * session, transcript and draft CAS stay in AIKit. The face is a binding
 * reading and an aperture, never a second conversation store:
 * - with a current Nara identity and an open Expression, it resolves the
 *   binding (`lookupNativeDialogue`) and discloses it verbatim — role,
 *   person, Nara, expression, provisioning standing, resume requirement —
 *   as the guide's rowline form, each field with its admit lamp;
 * - without one, it says so as the cut draws absence: the ghost mark
 *   (the dashed hollow node — never a guessed fill) beside the disclosed
 *   reason. Disclosed absence is the face's content, styled, not a blank;
 * - the pop-out rides the existing `encounter` detached kind; the full
 *   conversation surface is the encounter surface that already exists
 *   (opened through its own door, the `contact` mark on the press).
 * No transcript renders here: the encounter surface owns that reading. */

import {lookupNativeDialogue, type NativeDialogue} from '../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity, type CurrentIdentity} from '../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {KindMark, isKindShape, type KindShapeName} from './sdk/marks.tsx'
import {Icon} from './sdk/Icon.tsx'
import './inhabitantDevices.css'

export interface ConversationNaraFaceProps {
  readonly transport: KernelTransportStatus
  readonly project: string | null
  /** The expression the conversation binds to (the aperture's subject). */
  readonly expressionRef: string | null
  /** Identity handed in by the host; when absent the face reads the module's
   * current identity itself and discloses absence if neither exists. */
  readonly identity?: CurrentIdentity | null
}

type Standing =
  | {state: 'no-identity'}
  | {state: 'no-expression'}
  | {state: 'resolving'}
  | {state: 'bound'; dialogue: NativeDialogue}
  | {state: 'unbound'; detail: string}
  | {state: 'refused'; detail: string}

/** The mark each standing draws: bound = the agent node lit; resolving =
 * the hollow ring mid-turn; absence = the ghost (dashed, hollow); refused =
 * the fault colour carries it. */
const STANDING_MARKS: Readonly<Record<Standing['state'], KindShapeName>> = Object.freeze({
  'bound': 'agent',
  'resolving': 'ghost',
  'no-identity': 'ghost',
  'no-expression': 'ghost',
  'unbound': 'ghost',
  'refused': 'ghost',
})

export function NaraConversationFace({transport, project, expressionRef, identity}: ConversationNaraFaceProps) {
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

  const mark = STANDING_MARKS[standing.state]
  const markKind = isKindShape(mark) ? mark : 'ghost'

  return (
    <div
      className="inhabitant-face-body inhabitant-conversation"
      data-conversation-device="nara"
      data-standing={standing.state}
    >
      <div className="inhabitant-conversation-figure" data-conversation-figure>
        <KindMark kind={markKind} size={28} className={standing.state === 'bound' ? 'is-bound' : 'is-absent'}
          title={standingLabel(standing)}/>
        <span className="inhabitant-conversation-standing" data-standing-label>{standingLabel(standing)}</span>
      </div>
      {standing.state === 'bound' && <>
        <dl className="inhabitant-kv" data-binding-fields>
          <dt>role</dt><dd>{standing.dialogue.role}</dd>
          <dt>person</dt><dd>{standing.dialogue.binding.person_ref}</dd>
          <dt>nara</dt><dd>{standing.dialogue.binding.nara_ref}</dd>
          <dt>expression</dt><dd>{standing.dialogue.binding.expression_ref}</dd>
          <dt>session</dt><dd>{standing.dialogue.provisioning.agent_session}</dd>
          <dt>space</dt><dd>{standing.dialogue.provisioning.space}</dd>
          {standing.dialogue.provisioning.resume_required !== undefined && <>
            <dt>resume</dt><dd>{String(standing.dialogue.provisioning.resume_required)}</dd>
          </>}
        </dl>
        <button type="button" className="inhabitant-act" data-action="open-encounter" onClick={openEncounter}>
          <Icon name="contact" size={11}/> Open the encounter surface
        </button>
      </>}
      {standing.state === 'unbound' && <p className="inhabitant-device-notice">{standing.detail}</p>}
      {standing.state === 'no-identity' && <p className="inhabitant-device-notice">No Nara identity is current. The binding waits for its person — select an identity through the identity owner; nothing is fabricated here.</p>}
      {standing.state === 'no-expression' && <p className="inhabitant-device-notice">No expression is selected. A conversation binds to the encounter's subject — select one, and the binding resolves through its owner.</p>}
      {standing.state === 'refused' && <p className="inhabitant-device-fault" role="alert">{standing.detail}</p>}
    </div>
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

/** The name the manifest grammar uses (the §5.3 face kind), kept as the
 * export alias for hosts that compose the face directly. */
export {NaraConversationFace as ConversationNaraFace}
