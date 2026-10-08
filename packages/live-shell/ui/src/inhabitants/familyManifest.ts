/** Neutral inhabitant manifest contract (WORLD-SHELL-DESIGN §12–16).
 * The shell door knows only this shape; product families declare themselves
 * through admitted manifests. No family names appear in core logic here. */

export type FamilyManifestId = string

export type DevicePresentation = 'compact' | 'expanded' | 'full'

export interface FamilyFaceDeclaration {
  readonly id: string
  readonly presentations: readonly DevicePresentation[]
  readonly note?: string
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

/** Admit or replace one family manifest at the neutral door. */
export function admitFamilyManifest(manifest: FamilyManifest): FamilyManifest {
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

/** Test-only: clear the door between cases. */
export function resetFamilyManifestsForTest(): void {
  admitted.clear()
}
