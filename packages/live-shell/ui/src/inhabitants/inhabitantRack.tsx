import {useState, type ReactNode} from 'react'

/** The inhabitant rack — the composed manifests rendered as the focused
 * material's device chain (WORLD-SHELL-DESIGN §5, §16: the rack is one of a
 * family's four surfaces and the only place its devices dock).
 *
 * The chain anatomy is the guide's (§3.7, icon-cut §5): device cards
 * left→right at card density — power light, kind mark, name, owner line,
 * the fold chevron and the pop-out mark where the lifecycle declares it —
 * then one dashed drop zone naming what may dock. Folded waiting faces and
 * parameter faces carry their honest note as the card's reason line.
 *
 * The rack renders what the manifests declare, and nothing else:
 * - parameter faces as declared cards (their editors remain their
 *   registries' — the agent chain's composed slots render those; a declared
 *   card here is the family's presence on this material's chain);
 * - document faces over the existing hosting path, with the dock/expand
 *   lifecycle and the save router's named outcomes as chips;
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
import {FlowFace} from './DocumentFlowFace'
import {NaraConversationFace} from './ConversationNaraFace'
import {QlInstrumentBody, qlInstrumentLight, qlInstrumentStanding} from './qlInstrumentDevice'
import {InhabitantCard, type CardLight} from './inhabitantCard.tsx'
import type {IconName} from './sdk/Icon.tsx'
import type {KindShapeName} from './sdk/marks.tsx'
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
  /** [L9] The QL field/PCM owner's reading as the host received it (raw —
   * the instrument face parses it). Null/absent → the face's refusing state. */
  readonly instrumentReading?: unknown
}

export function InhabitantRack({manifests, transport, day, flow, conversation, projects, instrumentReading}: InhabitantRackProps) {
  const families = manifests.map(manifest => ({manifest, faces: manifest.faces}))
  const total = families.reduce((count, family) => count + family.faces.length, 0)
  return (
    <div className="inhabitant-rack" data-inhabitant-rack data-face-count={total}>
      {families.map(({manifest, faces}) => (
        <section key={manifest.id} className="inhabitant-family" data-family={manifest.id}>
          <h3 className="inhabitant-family-name">{manifest.id}<span className="inhabitant-family-count">{faces.length}</span></h3>
          <div className="inhabitant-family-chain">
            {faces.map(face => (
              <InhabitantFace key={`${manifest.id}:${face.id}`} face={face} manifest={manifest}
                transport={transport} day={day} flow={flow} conversation={conversation} projects={projects}
                instrumentReading={instrumentReading}/>
            ))}
          </div>
        </section>
      ))}
      <div className="inhabitant-dropz" data-dropz role="status"
        title="The chain's door: a family declared here docks its faces on the selected material's chain. Nothing docks undeclared.">
        Drop zone — declared family faces dock here, through the manifest door
      </div>
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
  readonly instrumentReading?: unknown
}

/** Each face's named mark of the cut — the header's kind reading. A face
 * without a clear named mark carries none; the note still speaks. */
const FACE_MARKS: Readonly<Record<string, IconName | KindShapeName>> = Object.freeze({
  'context-world': 'world',
  'agent-identity': 'agent',
  'ground-hygiene': 'location',
  'impact': 'expression',
  'day-die': 'day',
  'flow-document': 'doc',
  'nara-conversation': 'agent',
  'gateway': 'linkChain',
  'gateways-rack': 'chain',
  'experiment': 'run',
  'frames-monitor': 'detail',
  'skillset-rack': 'lib',
  'knowledge-route': 'search',
  'agency-gateway': 'link',
  'capture-skill': 'cap',
  'agent-custody': 'agent',
  'ledger': 'lib',
  'run-device': 'run',
  'attempt-review': 'run',
  'git-seat': 'chain',
  'remote-carrier': 'earth',
  'link': 'link',
  'seat': 'placed',
  'ql-instrument': 'expr',
  'sky': 'expr',
  'torus': 'expr',
  'm3-clock': 'metro',
  'deck': 'lib',
  'chakra': 'form',
  'm-prime-matrices': 'techne',
})

/** The guide's card density (§3.7): fixed widths per kind — compact cards,
 * never full-width grey boxes; the instrument takes the card-chain scale. */
function faceWidth(face: InhabitantFaceDeclaration): number | string {
  const kind = faceKind(face)
  if (kind === 'instrument') return 'min(100%, 920px)'
  if (kind === 'document') return 380
  if (kind === 'conversation') return 264
  if (face.admission === 'waiting') return 216
  return 224
}

/** One face on the chain: the strip always; the body when expanded (dock/
 * expand — pop-out is declared and rides the pane engine's detach door). */
function InhabitantFace({face, manifest, transport, day, flow, conversation, projects, instrumentReading}: FaceProps) {
  const [expanded, setExpanded] = useState(false)
  const kind = faceKind(face)
  const waiting = face.admission === 'waiting'
  const dockable = (face.dock ?? ['dock']).includes('dock')
  const expandable = (face.dock ?? ['dock']).includes('expand') && !waiting
  const popOutDeclared = (face.dock ?? ['dock']).includes('pop-out')
  const mark = FACE_MARKS[face.id]

  // The power light is a reading. Admitted parameter faces carry the hollow
  // admitted ring (declared at the door, its registry owns the controls);
  // waiting faces carry a dark lamp — no illumination, the note carries the
  // honesty. Kinds with a live reading light their own (the bodies below).
  const isInstrument = face.id === 'ql-instrument'
  const light: CardLight = waiting
    ? {state: 'off', title: 'Declared, waiting — no native owner yet, so nothing is illuminated'}
    : isInstrument
      ? qlInstrumentLight(instrumentReading ?? null)
      : {state: 'admitted', title: 'Admitted at the manifest door — the native owner exists; its registry owns the controls, this strip holds no live reading'}

  let body: ReactNode = null
  if (!waiting && expanded) {
    if (face.id === 'day-die' && day) {
      body = <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef}
        documentId={day.documentId} projects={projects}/>
    } else if (face.id === 'flow-document' && flow) {
      body = <FlowFace transport={transport} location={flow.location}/>
    } else if (face.id === 'nara-conversation') {
      body = <NaraConversationFace transport={transport} project={conversation?.project ?? null}
        expressionRef={conversation?.expressionRef ?? null}/>
    } else if (face.id === 'ql-instrument') {
      // [L9 musical family] the QL field/PCM owner's instrument face. The
      // reading arrives as the host received it (raw); the face parses and
      // renders the honest refusing state where no owner reading stands.
      body = <QlInstrumentBody reading={instrumentReading ?? null}/>
    }
  }

  const emptySlot = !waiting && expanded && body === null && kind !== 'parameter'
    ? emptySlotLabel(face.id)
    : null
  const note = waiting
    ? face.note
    : kind === 'parameter'
      ? face.note ?? `declared on the ${manifest.id} chain: ${face.presentations.join(' · ')}`
      : !expanded
        ? emptySlotHint(face.id)
        : undefined

  return (
    <InhabitantCard
      faceId={face.id}
      kind={kind}
      admission={waiting ? 'waiting' : 'admitted'}
      light={light}
      mark={mark}
      title={faceTitle(face.id)}
      owner={`${kind}${dockable ? '' : ' · folded-only'}`}
      note={note}
      status={isInstrument && !waiting
        ? (() => {
            const standing = qlInstrumentStanding(instrumentReading ?? null)
            return <span className="inhabitant-standing-chip" data-ql-standing={standing.state} title={standing.title}>{standing.label}</span>
          })()
        : undefined}
      expanded={expanded}
      onToggle={expandable ? () => setExpanded(value => !value) : null}
      popOut={popOutDeclared}
      width={faceWidth(face)}
      data={waiting ? {'waiting-note': face.note} : undefined}
    >
      {emptySlot && <p className="inhabitant-device-notice" role="status">{emptySlot}</p>}
      {body}
    </InhabitantCard>
  )
}

/** The human names of the declared faces — a type name is not a name. */
const FACE_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'context-world': 'Context · world',
  'agent-identity': 'Agent identity',
  'ground-hygiene': 'Ground hygiene',
  'impact': 'Impact',
  'day-die': 'Day die',
  'flow-document': 'Flow',
  'nara-conversation': 'Conversation',
  'gateway': 'Gateway',
  'gateways-rack': 'Gateways',
  'harness-model': 'Harness · model',
  'experiment': 'Experiment',
  'frames-monitor': 'Frames monitor',
  'skillset-rack': 'Skillset rack',
  'skill-device': 'Skill device',
  'knowledge-route': 'Knowledge route',
  'agency-gateway': 'Agency gateway',
  'capture-skill': 'Capture → skill',
  'agent-custody': 'Agent custody',
  'context-write-mode': 'Write mode',
  'ledger': 'Ledger',
  'approvals': 'Approvals',
  'run-device': 'Run',
  'attempt-review': 'Attempt review',
  'git-seat': 'Git seat',
  'remote-carrier': 'Remote carrier',
  'link': 'Link',
  'seat': 'Seat',
  'sky': 'Sky',
  'torus': 'Torus / field',
  'm3-clock': 'M3 clock',
  'deck': 'Deck',
  'chakra': 'Chakra',
  'm-prime-matrices': 'M′ matrices',
  'ql-instrument': 'QL field / PCM owner',
})

function faceTitle(faceId: string): string {
  return FACE_TITLES[faceId] ?? faceId
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

/** The collapsed strip's hint for body-bearing faces — what expanding docks
 * (the compact card stays honest about where its body lives). */
function emptySlotHint(faceId: string): string {
  switch (faceId) {
    case 'day-die': return 'Expand: the Day die docks its hosted form and die-net reading.'
    case 'flow-document': return 'Expand: the Flow docks its hosted form (Dialogue · Flow · Journal).'
    case 'nara-conversation': return 'Expand: the binding reading and the encounter door.'
    case 'ql-instrument': return 'Expand: the owner\'s reading as the instrument face (scheduling meters, cursors, writes).'
    default: return 'Expand docks this face\'s body.'
  }
}
