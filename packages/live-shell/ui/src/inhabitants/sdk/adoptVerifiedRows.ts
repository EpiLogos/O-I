/** The verified agent-shell rows, adopted into the kit — ONE source of truth.
 *
 * The five agent-shell families predate the kit: their manifests are
 * owner-authored at the door and their §14 rows live in
 * `AGENT_SHELL_ADDRESS_TABLE` (the verified ownership map). This loader
 * adopts those rows into the kit's presentation registries WITHOUT
 * re-admitting anything (the door is theirs; this registers the plate
 * layer), so the kit's readers — `sdkParamRows`, `facesForMode`,
 * `allTransportBindings` consumers, the plates below — resolve the
 * agent-shell families like any kit-declared family. The adoption is
 * identity: a registered row IS the table's row (the world gate's
 * ownership-map cross-check stays trivially green).
 *
 * Labels: the table carries keys, not titles; the plate labels are the
 * keys humanised (kebab → words) — the mockup's own names stay on the
 * rack's fidelity-bound cards; these plates are the §14-driven kit layer.
 *
 * Idempotent (merge-by-address), pure of the door, no I/O. */

import {allFamilyManifests, familyManifest, type FamilyManifestId} from '../familyManifest.ts'
import {AGENT_SHELL_ADDRESS_TABLE} from '../agentParamAddresses.ts'
import {deriveAgentDeviceRows} from '../agentDeviceCatalogue.ts'
import type {SdkParamRow} from './define.ts'
import {facePresentations, registerAdoptedArtifacts, sdkParamRows} from './define.ts'
import {onFamilyManifestReset} from '../familyManifest.ts'
import type {IconName} from './icons.ts'
import type {DeviceFormat, SdkModeName} from './modes.ts'

const humanise = (key: string): string =>
  key.split('-').map(part => (part ? part[0]!.toUpperCase() + part.slice(1) : '')).join(' ')

/** The chain faces' marks, as the rack itself draws them today. */
const FACE_MARKS: Record<string, IconName> = {
  gateway: 'link',
  agent: 'form',
  'skillset-rack': 'lib',
  'knowledge-route': 'linkChain',
  'context-world': 'orbit',
  'agent-identity': 'contact',
  'agent-custody': 'arm',
  'context-write-mode': 'arm',
  'git-seat': 'chain',
  'remote-carrier': 'map',
  'harness-model': 'metro',
  'gateways-rack': 'chain',
  experiment: 'metroDots',
  'frames-monitor': 'detail',
}

/** The chain's mode: the agent shell presents in Live mode (its base), with
 * the chain-plate format. */
const CHAIN_MODE: SdkModeName = 'live'

let adopted = false

/** Adopt the verified address table into the kit registries for every
 * admitted family the table names. Call after the families load
 * (`loadAgentShellFamilies()` / `loadWorldShellFamilies()`); idempotent. */
export function adoptVerifiedRows(): void {
  if (adopted) return
  // §14 rows address CHAIN INSTANCES (gateway, agent, skillset, world, git);
  // the catalogue composes each instance from the owning families' faces.
  // A row lands on its family's face for the instance it names.
  const rowsByFace = new Map<string, SdkParamRow[]>()
  const slots = deriveAgentDeviceRows(allFamilyManifests())
  for (const row of AGENT_SHELL_ADDRESS_TABLE) {
    if (!familyManifest(row.family)) continue // the family is not admitted — nothing to adopt onto
    const slot = slots.find(candidate => candidate.id === row.deviceInstance)
    const target =
      slot?.faces.find(ref => ref.family === row.family)
      ?? slot?.faces[0]
    const faceId = target?.faceId ?? row.deviceInstance
    const adoptedRow: SdkParamRow = {
      ...row,
      title: humanise(row.key),
    }
    const faceKey = `${row.family}/${faceId}`
    rowsByFace.set(faceKey, [...rowsByFace.get(faceKey) ?? [], adoptedRow])
  }
  const modes: readonly SdkModeName[] = [CHAIN_MODE]
  const formats: Partial<Record<SdkModeName, DeviceFormat>> = {[CHAIN_MODE]: 'chain-plate'}
  const adoptedFaces: {
    family: FamilyManifestId
    faceId: string
    title: string
    icon: IconName
    modes: readonly SdkModeName[]
    formats: Partial<Record<SdkModeName, DeviceFormat>>
    rows: readonly SdkParamRow[]
  }[] = []
  for (const manifest of allFamilyManifests()) {
    for (const face of manifest.faces) {
      const rows = rowsByFace.get(`${manifest.id}/${face.id}`)
      if (!rows?.length) continue
      adoptedFaces.push({
        family: manifest.id,
        faceId: face.id,
        title: humanise(face.id),
        icon: FACE_MARKS[face.id] ?? 'form',
        modes,
        formats,
        rows,
      })
    }
  }
  registerAdoptedArtifacts(adoptedFaces.map(face => ({
    family: face.family,
    owner: familyOwnerOf(face.family),
    presentation: {
      family: face.family,
      faceId: face.faceId,
      title: face.title,
      icon: face.icon,
      owner: familyOwnerOf(face.family),
      modes: face.modes,
      formats: face.formats,
    },
    rows: face.rows,
  })))
  adopted = true
}

function familyOwnerOf(family: FamilyManifestId): string {
  // The ownership map's families, by their product names.
  const OWNERS: Record<string, string> = {
    central: 'Central',
    actuation: 'Actuation',
    'ai-kit': 'AIKit',
    'software-factory': 'Software Factory',
    workcell: 'Workcell',
    'quaternal-logic': 'Quaternal Logic',
  }
  return OWNERS[family] ?? family
}

/** The kit's door reset clears adoption too (a reset that left adopted
 * rows standing would compose them onto re-admitted families). */
onFamilyManifestReset(() => {
  adopted = false
})

/** Whether a family's §14 rows are visible through the kit. */
export function familyRowsAdopted(family: FamilyManifestId): boolean {
  return sdkParamRows(family).length > 0 && facePresentations(family).length > 0
}
