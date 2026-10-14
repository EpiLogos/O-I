import {useEffect, useState, type ReactNode} from 'react'

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
import {deviceBindingId, deviceIdentityFault, type DeviceDetachIdentity} from '../native/detachedKinds'
import {DocumentDayDieFace} from './DocumentDayDieFace'
import {FlowFace} from './DocumentFlowFace'
import {NaraConversationFace} from './ConversationNaraFace'
import {QlInstrumentBody, qlInstrumentLight, qlInstrumentStanding} from './qlInstrumentDevice'
import {AtlasFaceBody, isAtlasFaceId} from './atlasFaceBodies'
import {KnowledgeFaceBody, isKnowledgeFaceId} from './knowledgeGraphFaceBodies'
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
  readonly conversation?: {project: string | null; expressionRef: string | null; conversation?: string | null} | null
  /** The navigator's projects, for the form resolver's owner path. */
  readonly projects?: readonly {name?: string; path?: string}[]
  /** [L9] The QL field/PCM owner's reading as the host received it (raw —
   * the instrument face parses it). Null/absent → the face's refusing state. */
  readonly instrumentReading?: unknown
  /** The focused instrument (a `techne:*` holder id): the faces it holds
   * (`heldBy`) dock expanded and every other face folds — the lock's "the
   * focused lens expanded, the others folded". Absent → every face folds. */
  readonly focusInstrument?: string | null
  /** The host's native device windows (seam 8). A face pops out through `popOut` only where its family declares the
   * device detached kind and the face declares pop-out; `poppedOut` says where a device lives; `redock` returns it.
   * Absent → the pop-out mark stands disabled: the honest state where no host door exists. */
  readonly deviceWindows?: DeviceWindowHost | null
}

/** The host door for popped-out devices. The rack never opens a window itself: the host's existing detach door does. */
export interface DeviceWindowHost {
  readonly popOut: (identity: DeviceDetachIdentity) => void
  readonly redock: (identity: DeviceDetachIdentity) => void
  readonly poppedOut: (identity: DeviceDetachIdentity) => boolean
}

export function InhabitantRack({manifests, transport, day, flow, conversation, projects, instrumentReading, focusInstrument, deviceWindows}: InhabitantRackProps) {
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
                instrumentReading={instrumentReading} focusInstrument={focusInstrument} deviceWindows={deviceWindows}/>
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
  readonly focusInstrument?: string | null
  readonly deviceWindows?: DeviceWindowHost | null
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
function InhabitantFace({face, manifest, transport, day, flow, conversation, projects, instrumentReading, focusInstrument, deviceWindows}: FaceProps) {
  // The focused instrument's faces dock expanded; a change of focus re-stands
  // every face (held → expanded, the rest folded). Without a focus, a face
  // starts folded, as before.
  const focused = focusInstrument != null && (face.heldBy ?? []).includes(focusInstrument)
  // A face whose aperture stands (a Day for the die, a conversation for the Nara face) docks expanded: the selected material's body.
  const apertureStands = (face.id === 'day-die' && !!day) || (face.id === 'nara-conversation' && !!conversation)
  const [expanded, setExpanded] = useState(focused || apertureStands)
  useEffect(() => { setExpanded(focused || apertureStands) }, [focusInstrument, apertureStands])
  const kind = faceKind(face)
  const waiting = face.admission === 'waiting'
  const dockable = (face.dock ?? ['dock']).includes('dock')
  const expandable = (face.dock ?? ['dock']).includes('expand') && !waiting
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

  // Seam 8: a popped-out device lives in its own native window. Its identity is the manifest's family and face with the
  // aperture the face reads; the rack holds no second copy of it. While popped out the rack draws no body.
  const popOutDeclared = (face.dock ?? ['dock']).includes('pop-out')
  const deviceKindDeclared = (manifest.detachedKinds ?? []).includes('device')
  const identity: DeviceDetachIdentity = {
    family: manifest.id,
    face: face.id,
    aperture: {
      day: day ? {project: day.project, sourceRef: day.sourceRef, documentId: day.documentId} : null,
      flow: flow ?? null,
      conversation: conversation ?? null,
      instrument: focusInstrument ?? null,
    },
  }
  const popped = !waiting && !!deviceWindows && deviceWindows.poppedOut(identity)
  const popOutHost = !waiting && popOutDeclared && deviceKindDeclared && deviceWindows ? deviceWindows : null
  const onPopOut = popOutHost && !popped ? () => popOutHost.popOut(identity) : null
  const onRedock = popOutHost && popped ? () => popOutHost.redock(identity) : null

  const body: ReactNode = !waiting && expanded && !popped
    ? faceBodyFor(face, {transport, day, flow, conversation, projects, instrumentReading})
    : null

  const emptySlot = !waiting && expanded && !popped && body === null && kind !== 'parameter'
    ? emptySlotLabel(face.id)
    : null
  const note = popped
    ? 'popped out — this device lives in its own native window; redock returns it to this rack'
    : waiting
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
      onPopOut={onPopOut}
      poppedOut={popped}
      onRedock={onRedock}
      width={faceWidth(face)}
      data={{'waiting-note': waiting ? face.note : undefined, 'device-binding': popOutDeclared ? deviceBindingId(identity) : undefined}}
    >
      {emptySlot && <p className="inhabitant-device-notice" role="status">{emptySlot}</p>}
      {body}
    </InhabitantCard>
  )
}

/** What a face body reads: the aperture and the owner readings the host holds. */
interface FaceReads {
  readonly transport: KernelTransportStatus
  readonly day?: InhabitantRackProps['day']
  readonly flow?: InhabitantRackProps['flow']
  readonly conversation?: InhabitantRackProps['conversation']
  readonly projects?: readonly {name?: string; path?: string}[]
  readonly instrumentReading?: unknown
}

/** One face's expanded body, selected by the face's identity and the aperture it reads (null where the face docks no
 * body). Shared by the rack and by a popped-out device's receiving body, so both draw the same face. */
export function faceBodyFor(face: InhabitantFaceDeclaration, reads: FaceReads): ReactNode | null {
  const {transport, day, flow, conversation, projects, instrumentReading} = reads
  if (face.id === 'day-die' && day) {
    return <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef}
      documentId={day.documentId} projects={projects}/>
  }
  if (face.id === 'flow-document' && flow) return <FlowFace transport={transport} location={flow.location}/>
  if (face.id === 'nara-conversation') {
    return <NaraConversationFace transport={transport} project={conversation?.project ?? null}
      expressionRef={conversation?.expressionRef ?? null} conversation={conversation?.conversation ?? null}/>
  }
  // [L9 musical family] the QL field/PCM owner's instrument face. The reading arrives as the host received it (raw); the
  // face parses it and renders the honest refusing state where no owner reading stands.
  if (face.id === 'ql-instrument') return <QlInstrumentBody reading={instrumentReading ?? null}/>
  // [atlas family] the Earth's own controls on the 0 instrument's rack: each body drives the mounted atlas's own state.
  if (isAtlasFaceId(face.id)) return <AtlasFaceBody faceId={face.id}/>
  // [T-KNOWLEDGE-GRAPH-DEVICE] the wiki constellation's own controls: each body drives the open graph's own handle.
  if (isKnowledgeFaceId(face.id)) return <KnowledgeFaceBody faceId={face.id}/>
  return null
}

export interface DeviceFaceProps {
  readonly identity: DeviceDetachIdentity
  readonly manifests: readonly InhabitantManifest[]
  readonly transport: KernelTransportStatus
  readonly projects?: readonly {name?: string; path?: string}[]
  /** The QL owner's reading as the receiving frame holds it (raw; the instrument face parses it). */
  readonly instrumentReading?: unknown
}

/** The receiving body of a popped-out device (seam 8): the face the identity names, drawn from the same manifest and the
 * identity's aperture, reading the same owners. A face the manifests no longer carry is refused, named, never drawn. */
export function DeviceFace({identity, manifests, transport, projects, instrumentReading}: DeviceFaceProps) {
  const fault = deviceIdentityFault(identity, manifests)
  const manifest = manifests.find(entry => entry.id === identity.family)
  const face = manifest?.faces.find(entry => entry.id === identity.face)
  if (fault || !manifest || !face) {
    return <p className="inhabitant-device-notice" role="alert" data-device-fault>{fault ?? 'The device is not declared by any admitted family.'}</p>
  }
  const body = faceBodyFor(face, {
    transport, day: identity.aperture.day, flow: identity.aperture.flow,
    conversation: identity.aperture.conversation, projects, instrumentReading: instrumentReading ?? null,
  })
  const light: CardLight = face.id === 'ql-instrument'
    ? qlInstrumentLight(instrumentReading ?? null)
    : {state: 'admitted', title: 'Admitted at the manifest door — the native owner exists; its registry owns the controls'}
  return (
    <div className="inhabitant-rack" data-device-window data-family={manifest.id} data-device-face={face.id}>
      <InhabitantCard faceId={face.id} kind={faceKind(face)} light={light} mark={FACE_MARKS[face.id]} title={faceTitle(face.id)}
        owner={`${faceKind(face)} · popped out`} width={faceWidth(face)} expanded>
        {body ?? <p className="inhabitant-device-notice" role="status">{emptySlotLabel(face.id)}</p>}
      </InhabitantCard>
    </div>
  )
}

/** The human names of the declared faces — a type name is not a name. */
const FACE_TITLES: Readonly<Record<string, string>> = Object.freeze({
  // the 0 instrument (the atlas) and the knowledge graph
  'globe-engine': 'Globe',
  'graph-tools': 'Graph tools',
  'mode-switch': 'Earth ⇄ Graph',
  'time-control': 'Deep time',
  'knowledge-scope': 'Scope',
  'knowledge-filters': 'Filters',
  'knowledge-display': 'Display',
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
