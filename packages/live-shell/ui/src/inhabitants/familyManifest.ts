/** Neutral inhabitant manifest contract (WORLD-SHELL-DESIGN §12–16).
 * The shell door knows only this shape; product families declare themselves
 * through admitted manifests. No family names appear in core logic here. */

import type {LiveSemantic, SemanticInvariant} from './sdk/semantics.ts'
import {validateFaceSemantic} from './sdk/semantics.ts'

export type FamilyManifestId = string

export type DevicePresentation = 'compact' | 'expanded' | 'full'

export interface FamilyFaceDeclaration {
  readonly id: string
  readonly presentations: readonly DevicePresentation[]
  readonly note?: string
  /** The Live semantic this face occupies (DEVICE-SEMANTICS-LOCK §1, §5.1).
   * Required: a face without one is refused at the door. */
  readonly liveSemantic: LiveSemantic
  /** The face's invariant for its semantic (lock §5.3). */
  readonly invariant?: SemanticInvariant
  /** The modes the face presents in (absent = its family's home modes). */
  readonly modes?: readonly string[]
  /** The holder(s) that hold this face (lock §4.8, §4.9; sdk/semantics.ts
   * HOLDERS): a Studio section, the Clip detail or a Technē instrument. A
   * waiting face with no owner yet may leave it absent. */
  readonly heldBy?: readonly string[]
}

export interface FamilyManifest {
  readonly id: FamilyManifestId
  readonly browser: readonly string[]
  readonly faces: readonly FamilyFaceDeclaration[]
  readonly params: { readonly grammar: string }
  readonly projections: readonly string[]
  readonly inspectors: readonly string[]
  readonly time: {
    readonly consumes: readonly string[]
    readonly contributes: readonly string[]
  }
  /** Observable id the family exposes for modulation, or null when none yet. */
  readonly telemetry: string | null
}

const admitted = new Map<FamilyManifestId, FamilyManifest>()

/** Reset hooks — the door is the admission state's single owner, so a reset
 * clears everything admitted BESIDE it too (declared extensions compose onto
 * admitted bases; a reset that left them would compose stale extensions onto
 * re-admitted manifests). [L9 gap fix: the test-only reset previously left
 * the extension ledger standing.] */
const resetHooks: (() => void)[] = []
export function onFamilyManifestReset(hook: () => void): void {
  resetHooks.push(hook)
}

/** Admit or replace one family manifest at the neutral door. */
export function admitFamilyManifest(manifest: FamilyManifest): FamilyManifest {
  // The Live semantic law speaks first (lock §5): a face that does not occupy
  // a semantic, or breaks its invariant or mode, never reaches the door.
  const semanticFaults = manifest.faces.flatMap(face => validateFaceSemantic(face, {family: manifest.id}))
  if (semanticFaults.length) {
    throw new Error(`Family manifest "${manifest.id}" refuses at the door — the Live semantic law (DEVICE-SEMANTICS-LOCK §5):\n- ${semanticFaults.join('\n- ')}`)
  }
  const prior = admitted.get(manifest.id)
  if (prior && JSON.stringify(prior) !== JSON.stringify(manifest)) {
    throw new Error(`Family manifest "${manifest.id}" already admitted with different contents.`)
  }
  admitted.set(manifest.id, manifest)
  return manifest
}

export function familyManifest(id: FamilyManifestId): FamilyManifest | undefined {
  return admitted.get(id)
}

export function allFamilyManifests(): FamilyManifest[] {
  return [...admitted.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Test-only: clear the door between cases — the admitted manifests AND
 * everything composed beside them. */
export function resetFamilyManifestsForTest(): void {
  admitted.clear()
  for (const hook of resetHooks) hook()
}
