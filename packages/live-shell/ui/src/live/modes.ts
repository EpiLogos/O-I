/**
 * Live's mode in force: the transport's key / root / scale (T-LIVE-MODE-SCALES,
 * leg 1; DEVICE-SEMANTICS-LOCK §0.2 item 5).
 *
 * Owner names, read from QL-MEF (crates/ql-mef/src/music.rs):
 *   ModeTonicInstance { lens, anchor_basis, mode, tonic, pitches: [PitchClass; 7] }
 *   mode_tonic_landscape(basis): the 84 lens/CF modal instances (12 lenses x 7 ModeKind)
 *   PitchClass = u8 in 0..=11, a closed pitch-class address, never a frequency.
 * Source scales (maqam: crates/ql-mef/src/m2.rs maqam_pitches) carry their own tuning.
 *
 * Law: the shell holds NO mode table. Every mode it can choose is one the kernel
 * serves in a catalogue handed in by the owner's reading. With no catalogue the
 * slot waits and says exactly where the kernel seam is. A choice that is not in
 * the catalogue is refused, never invented. A scale's exact tuning travels with
 * it; when the kernel declares none, nothing is assumed (no silent 12-TET).
 *
 * Pure. No React, no store, no I/O.
 */

/** A closed pitch-class address, 0..=11. */
export type PitchClass = number

/** One exact tuning step as the kernel states it: a ratio, never rounded cents. */
export interface ExactRatio {
  readonly num: number
  readonly den: number
}

/** Where a reading comes from: the owner's symbol and its revision. */
export interface ModeProvenance {
  readonly owner: 'ql-mef'
  readonly symbol: string
  readonly revision: string
}

/** One of the 84 lens/CF modal instances the kernel serves. */
export interface KernelLensMode {
  readonly kind: 'lens-cf'
  /** Identity inside the catalogue: anchor basis, lens and mode together. */
  readonly key: string
  readonly label: string
  readonly lens: string
  readonly anchorBasis: string
  readonly mode: string
  /** The seven pitch classes in degree order from the tonic. */
  readonly pitches: readonly PitchClass[]
  readonly tuning: readonly ExactRatio[] | null
  readonly provenance: ModeProvenance
}

/** A source scale (maqam, or another source family) with its declared intervals. */
export interface KernelSourceScale {
  readonly kind: 'source'
  readonly key: string
  readonly label: string
  readonly family: string
  /** Null when the kernel serves no pitch set for this scale. */
  readonly pitches: readonly PitchClass[] | null
  readonly tuning: readonly ExactRatio[] | null
  readonly provenance: ModeProvenance
}

export type KernelScale = KernelLensMode | KernelSourceScale

/** A choice: which catalogued scale, and the root pitch class it sits on. */
export interface ModeChoice {
  readonly key: string
  readonly root: PitchClass
}

export type ModeInForce =
  | {readonly state: 'waiting'; readonly selection: null; readonly line: string}
  | {readonly state: 'in-force'; readonly selection: {readonly scale: KernelScale; readonly root: PitchClass}; readonly line: string}

/** The seam, named exactly. Stated once so the transport and the tests agree. */
export const LIVE_MODE_SEAM =
  'the kernel serves no mode catalogue to the shell: ql-mef mode_tonic_landscape (music.rs) and m2 maqam_pitches (m2.rs) are Rust-only, the ql CLI serves Janko surfaces and lenses rather than modes, and ql-mef holds no Ficino reading'

/** The waiting reading: no catalogue, so no mode can be in force. */
export function waitingModeInForce(detail: string = LIVE_MODE_SEAM): ModeInForce {
  return {state: 'waiting', selection: null, line: `Mode in force — waiting: ${detail}.`}
}

function validPitch(value: unknown): value is PitchClass {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 11
}

function validRatios(ratios: readonly ExactRatio[] | null): boolean {
  return ratios === null || ratios.every(r => Number.isInteger(r.num) && Number.isInteger(r.den) && r.num > 0 && r.den > 0)
}

/** A reading the owner did not produce is refused, not shaped into a mode. */
export function validScale(scale: KernelScale): boolean {
  if (!scale.key || !scale.label || !scale.provenance || scale.provenance.owner !== 'ql-mef') return false
  if (!validRatios(scale.tuning)) return false
  if (scale.kind === 'lens-cf') return scale.pitches.length === 7 && scale.pitches.every(validPitch)
  return scale.pitches === null || scale.pitches.every(validPitch)
}

function provenanceOf(scale: KernelScale): string {
  return `${scale.provenance.owner} ${scale.provenance.symbol}@${scale.provenance.revision}`
}

function tuningOf(scale: KernelScale): string {
  return scale.tuning
    ? `tuning: exact ratios ${scale.tuning.map(r => `${r.num}/${r.den}`).join(' ')}`
    : 'tuning: none declared by the kernel (pitch-class addresses only, no equal temperament assumed)'
}

/**
 * The mode in force for a set (or for one clip). With no catalogue the reading
 * waits and names the seam; with a choice outside the catalogue it waits and
 * names the refusal. Only a catalogued, valid scale on a valid root is in force.
 */
export function resolveModeInForce(catalogue: readonly KernelScale[] | null | undefined, choice: ModeChoice | null): ModeInForce {
  if (!catalogue) return waitingModeInForce()
  if (!choice) return {state: 'waiting', selection: null, line: `Mode in force — none chosen; the kernel serves ${catalogue.length} scales`}
  const scale = catalogue.find(candidate => candidate.key === choice.key)
  if (!scale || !validScale(scale)) return {state: 'waiting', selection: null, line: `Mode in force — waiting: "${choice.key}" is not a scale the kernel serves; nothing is invented`}
  if (!validPitch(choice.root)) return {state: 'waiting', selection: null, line: `Mode in force — waiting: root ${String(choice.root)} is not a pitch class`}
  return {
    state: 'in-force',
    selection: {scale, root: choice.root},
    line: `Mode in force — ${scale.label} on pitch class ${choice.root} · ${provenanceOf(scale)} · ${tuningOf(scale)}`,
  }
}

/**
 * A clip's mode: a clip that carries its own mode overrides the set's for that
 * clip only. A clip without one plays the set's mode.
 */
export function modeForClip(catalogue: readonly KernelScale[] | null | undefined, setChoice: ModeChoice | null, clipChoice: ModeChoice | null): ModeInForce {
  if (!clipChoice) return resolveModeInForce(catalogue, setChoice)
  const clip = resolveModeInForce(catalogue, clipChoice)
  return clip.state === 'in-force' ? {...clip, line: `Clip mode (this clip only) — ${clip.line.replace(/^Mode in force — /, '')}`} : clip
}

/**
 * The pitch-class mask of a scale: twelve booleans, or null when the kernel
 * serves no pitch set. Derived from the owner's pitches, never from a table.
 */
export function pitchMask(scale: KernelScale | null | undefined): readonly boolean[] | null {
  if (!scale || !scale.pitches || !scale.pitches.every(validPitch)) return null
  const mask: boolean[] = Array.from({length: 12}, () => false)
  for (const pitch of scale.pitches) mask[pitch] = true
  return mask
}

export type RollMode = 'highlight' | 'fold'

/**
 * How one roll row with this pitch class shows. Fold keeps only the mode's rows;
 * highlight keeps all rows and marks the mode's. With no pitch set nothing folds
 * and nothing is marked: the roll is shown whole, never guessed.
 */
export function rollRowState(pitch: PitchClass, mask: readonly boolean[] | null, mode: RollMode): {readonly visible: boolean; readonly inMode: boolean} {
  if (!mask) return {visible: true, inMode: false}
  const inMode = mask[pitch] === true
  return {visible: mode === 'highlight' || inMode, inMode}
}
