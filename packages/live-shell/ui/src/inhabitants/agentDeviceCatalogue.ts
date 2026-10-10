import {allFamilyManifests, type DevicePresentation, type FamilyManifest, type FamilyManifestId} from './familyManifest.ts'

/** The agent device chain derived at the neutral door (WORLD-SHELL-DESIGN §13).
 *
 * The chain's slot order and composition are declared here; every family id,
 * face id, title-side presentation and admit fact is READ from the admitted
 * manifests. A slot renders only the faces its families actually admitted:
 * an unadmitted face is dropped, and a slot left with no admitted face drops
 * out entirely. Nothing here hardcodes a family name into the shell core —
 * this module lives beside the manifests, not in it, and the seventh-product
 * test admits a family at runtime with zero change here.
 *
 * Pure: no store, no view, no I/O. */

export interface AgentChainFaceRef {
  readonly family: FamilyManifestId
  readonly faceId: string
}

export interface AgentChainSlot {
  /** The chain slot id (also the shell's expandedDevice id). */
  readonly id: string
  readonly title: string
  /** The faces composed on the slot, primary first (§14 composition). */
  readonly faces: readonly AgentChainFaceRef[]
}

/** The chain composition — mockup order gateway → agent → skillset → world →
 * git (AGENTIC-CONVERGENCE Rev 5). The agent slot composes actuation's
 * harness-model, software-factory's agent-custody and central's
 * agent-identity on ONE visible face; the world slot composes central reads,
 * the ai-kit knowledge route and software-factory write mode. */
const CHAIN_SLOTS: readonly AgentChainSlot[] = [
  {id: 'gateway', title: 'Gateway · hermes', faces: [{family: 'actuation', faceId: 'gateway'}]},
  {
    id: 'agent',
    title: 'Agent',
    faces: [
      {family: 'actuation', faceId: 'harness-model'},
      {family: 'software-factory', faceId: 'agent-custody'},
      {family: 'central', faceId: 'agent-identity'},
    ],
  },
  {id: 'skillset', title: 'Skillset rack', faces: [{family: 'ai-kit', faceId: 'skillset-rack'}]},
  {
    id: 'world',
    title: 'World · bridge',
    faces: [
      {family: 'central', faceId: 'context-world'},
      {family: 'ai-kit', faceId: 'knowledge-route'},
      {family: 'software-factory', faceId: 'context-write-mode'},
    ],
  },
  {id: 'git', title: 'Git', faces: [{family: 'workcell', faceId: 'git-seat'}]},
]

export interface AgentDeviceRow {
  readonly id: string
  readonly title: string
  /** The primary (first admitted) family — the slot's data-family. */
  readonly family: FamilyManifestId
  /** The admitted faces on the slot, with presentations read from the manifest. */
  readonly faces: readonly {family: FamilyManifestId; faceId: string; presentations: readonly DevicePresentation[]}[]
}

/** Derive the pool/chain device rows from admitted manifests. A face the door
 * has not admitted is left off; a slot with nothing admitted disappears. */
export function deriveAgentDeviceRows(manifests: readonly FamilyManifest[]): AgentDeviceRow[] {
  const byFamily = new Map(manifests.map(manifest => [manifest.id, manifest]))
  const rows: AgentDeviceRow[] = []
  for (const slot of CHAIN_SLOTS) {
    const faces = slot.faces.flatMap(ref => {
      const manifest = byFamily.get(ref.family)
      const face = manifest?.faces.find(candidate => candidate.id === ref.faceId)
      return face ? [{family: ref.family, faceId: ref.faceId, presentations: face.presentations}] : []
    })
    if (faces.length) rows.push({id: slot.id, title: slot.title, family: faces[0]!.family, faces})
  }
  return rows
}

/** The chain rows over the door's current admissions. */
export function agentDeviceCatalogue(): AgentDeviceRow[] {
  return deriveAgentDeviceRows(allFamilyManifests())
}
