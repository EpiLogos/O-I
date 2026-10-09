import {useState} from 'react'

/** The inhabitant rack — the composed manifests rendered as the focused
 * material's device chain (WORLD-SHELL-DESIGN §5, §16: the rack is one of a
 * family's four surfaces and the only place its devices dock).
 *
 * The rack renders what the manifests declare, and nothing else:
 * - parameter faces as declared cards (their editors remain their
 *   registries' — the agent chain's composed slots render those; a declared
 *   card here is the family's presence on this material's chain);
 * - document faces over the existing hosting path, with the dock/expand
 *   lifecycle and the save router's named outcomes on the strip;
 * - the conversation face over the Nara binding;
 * - waiting faces as honest waiting cards — named owner, no body, no light.
 *
 * This rack does not replace NativeDeviceRack or the agent chain; it is the
 * general manifest renderer the §5.5 door implies, usable wherever a
 * material's chain is composed from declared families (the capture harness
 * docks it; hosts compose it beside their own registries). */

import type {CentralLocation, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {faceKind, type InhabitantFaceDeclaration, type InhabitantManifest} from './manifest.ts'
import {DocumentDayDieFace} from './DocumentDayDieFace'
import {DocumentFlowFace} from './DocumentFlowFace'
import {ConversationNaraFace} from './ConversationNaraFace'
import './inhabitantDevices.css'

export interface InhabitantRackProps {
  readonly manifests: readonly InhabitantManifest[]
  readonly transport: KernelTransportStatus
  /** The aperture: the selected Central Day, when one is selected. */
  readonly day?: {project: string | null; sourceRef: string; documentId: string} | null
  /** The aperture: the selected flow instance, when one is selected. */
  readonly flow?: {location: CentralLocation} | null
  /** The aperture: the selected conversation subject. */
  readonly conversation?: {project: string | null; expressionRef: string | null} | null
  /** The navigator's projects, for the form resolver's owner path. */
  readonly projects?: readonly {name?: string; path?: string}[]
}

export function InhabitantRack({manifests, transport, day, flow, conversation, projects}: InhabitantRackProps) {
  return (
    <div className="inhabitant-rack" data-inhabitant-rack>
      {manifests.map(manifest => (
        <section key={manifest.id} className="inhabitant-family" data-family={manifest.id}>
          <h3 className="inhabitant-family-name">{manifest.id}</h3>
          {manifest.faces.map(face => (
            <InhabitantFace key={`${manifest.id}:${face.id}`} face={face} manifest={manifest}
              transport={transport} day={day} flow={flow} conversation={conversation} projects={projects}/>
          ))}
        </section>
      ))}
    </div>
  )
}

interface FaceProps {
  readonly face: InhabitantFaceDeclaration
  readonly manifest: InhabitantManifest
  readonly transport: KernelTransportStatus
  readonly day?: InhabitantRackProps['day']
  readonly flow?: InhabitantRackProps['flow']
  readonly conversation?: InhabitantRackProps['conversation']
  readonly projects?: readonly {name?: string; path?: string}[]
}

/** One face card: the strip always; the body when expanded (dock/expand —
 * pop-out is declared and rides the pane engine's detach door). */
function InhabitantFace({face, manifest, transport, day, flow, conversation, projects}: FaceProps) {
  const [expanded, setExpanded] = useState(false)
  const kind = faceKind(face)
  const waiting = face.admission === 'waiting'
  const dockable = (face.dock ?? ['dock']).includes('dock')
  const expandable = (face.dock ?? ['dock']).includes('expand')

  let body = null
  if (!waiting && expanded) {
    if (face.id === 'day-die' && day) {
      body = <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef}
        documentId={day.documentId} projects={projects} expanded/>
    } else if (face.id === 'flow-document' && flow) {
      body = <DocumentFlowFace transport={transport} location={flow.location} expanded/>
    } else if (face.id === 'nara-conversation') {
      body = <ConversationNaraFace transport={transport} project={conversation?.project ?? null}
        expressionRef={conversation?.expressionRef ?? null} expanded/>
    }
  }

  const emptySlot = !waiting && expanded && body === null && kind !== 'parameter'
    ? emptySlotLabel(face.id)
    : null

  return (
    <article
      className={`inhabitant-device${waiting ? ' is-waiting' : ''}${expanded ? ' is-expanded' : ''}`}
      data-face-id={face.id}
      data-face-kind={kind}
      data-admission={face.admission ?? 'admitted'}
    >
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${waiting ? '' : ' is-admitted'}`} title={waiting ? 'Declared, waiting — no native owner yet' : 'Admitted — the native owner exists and is read'} />
        {expandable && !waiting
          ? <button type="button" className="inhabitant-device-title" data-action="expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{face.id}</button>
          : <strong className="inhabitant-device-title">{face.id}</strong>}
        <span className="inhabitant-device-sub">{kind}{dockable ? '' : ' · folded'}</span>
        {dockable && <button type="button" className="inhabitant-device-fold" data-action="fold" aria-expanded={expanded}
          title={expanded ? 'Fold to the strip' : 'Expand the body under the strip'} onClick={() => setExpanded(value => !value)}>{expanded ? '▾' : '▸'}</button>}
      </header>
      {waiting && <p className="inhabitant-device-note" data-waiting-note>{face.note}</p>}
      {!waiting && kind === 'parameter' && <p className="inhabitant-device-note">{face.note ?? `declared on the ${manifest.id} chain: ${face.presentations.join(' · ')}`}</p>}
      {emptySlot && <p className="inhabitant-device-note" role="status">{emptySlot}</p>}
      {body}
    </article>
  )
}

/** Empty slot ≠ dead UI: it names what would dock here (the widget guide's
 * law). */
function emptySlotLabel(faceId: string): string {
  switch (faceId) {
    case 'day-die': return 'No Day is selected. Select one in the browser\'s ground and the die docks here over its native source.'
    case 'flow-document': return 'No flow document is selected. Select one and the Flow docks here over its own file.'
    case 'nara-conversation': return 'The conversation face reads the encounter\'s subject; no subject is pinned.'
    default: return `${faceId} docks when its material is selected.`
  }
}
