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

/** The twelve pitch-class names, for display only (sharps, as the transport writes them). */
export const PITCH_CLASS_NAMES: readonly string[] = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

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

/**
 * A quarter-tone tuning as the owner states it (ql.music-modes/v1 maqam rows):
 * `steps` are the quarter-tone steps between degrees (24 per octave), `fromRoot`
 * the cumulative quarter-tone count from the root, `cents` the owner's cents from
 * the root. Carried exactly; never converted to 12-TET or to any other tuning.
 */
export interface QuarterToneTuning {
  readonly unit: 'quarter-tone'
  readonly steps: readonly number[]
  readonly fromRoot: readonly number[]
  readonly cents: readonly number[]
}

/** A scale's declared tuning: exact ratios, the quarter-tone variant, or none. */
export type KernelTuning = readonly ExactRatio[] | QuarterToneTuning | null

/** One of the 168 lens/CF modal instances the kernel serves (2 bases x 12 lenses x 7 modes). */
export interface KernelLensMode {
  readonly kind: 'lens-cf'
  /** Identity inside the catalogue: anchor basis, lens and mode together. */
  readonly key: string
  readonly label: string
  readonly lens: string
  readonly anchorBasis: string
  readonly contextFrame?: string
  readonly mode: string
  /** The seven pitch classes in degree order from the tonic. */
  readonly pitches: readonly PitchClass[]
  /** The owner's semitone intervals between the seven degrees (sum 12). */
  readonly stepsSemitones?: readonly number[]
  readonly tuning: KernelTuning
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
  /** The owner's family ratio, exact, when the owner states one. */
  readonly familyRatio?: ExactRatio | null
  readonly tuning: KernelTuning
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

/**
 * The waiting state, named exactly. Stated once so the transport and the tests
 * agree. It holds while the kernel has not yet answered the catalogue read.
 */
export const LIVE_MODE_SEAM =
  'the kernel has not served the ql-mef mode_tonic_landscape catalogue yet (ql music modes --json, ql.music-modes/v1); no mode is invented while it is read'

/** The waiting reading: no catalogue, so no mode can be in force. */
export function waitingModeInForce(detail: string = LIVE_MODE_SEAM): ModeInForce {
  return {state: 'waiting', selection: null, line: `Mode in force — waiting: ${detail}.`}
}

function validPitch(value: unknown): value is PitchClass {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 11
}

function isRatio(value: unknown): value is ExactRatio {
  const r = value as ExactRatio
  return !!r && typeof r === 'object' && Number.isInteger(r.num) && Number.isInteger(r.den) && r.num > 0 && r.den > 0
}

function validQuarterTone(tuning: QuarterToneTuning): boolean {
  const {steps, fromRoot, cents} = tuning
  if (!Array.isArray(steps) || !Array.isArray(fromRoot) || !Array.isArray(cents)) return false
  if (fromRoot.length !== steps.length + 1 || fromRoot[0] !== 0) return false
  if (!steps.every(s => Number.isInteger(s) && s > 0)) return false
  if (!steps.every((s, i) => fromRoot[i + 1] - fromRoot[i] === s)) return false
  if (fromRoot[fromRoot.length - 1] !== 24) return false
  return cents.length === fromRoot.length && cents.every(c => Number.isInteger(c) && c >= 0)
}

/** A tuning the owner stated, or none. Anything else is refused, never assumed. */
function validTuning(tuning: KernelTuning | undefined): boolean {
  if (tuning === null || tuning === undefined) return true
  if (Array.isArray(tuning)) return tuning.every(isRatio)
  return (tuning as QuarterToneTuning).unit === 'quarter-tone' && validQuarterTone(tuning as QuarterToneTuning)
}

/** A reading the owner did not produce is refused, not shaped into a mode. */
export function validScale(scale: KernelScale): boolean {
  if (!scale.key || !scale.label || !scale.provenance || scale.provenance.owner !== 'ql-mef') return false
  if (!validTuning(scale.tuning)) return false
  if (scale.kind === 'lens-cf') return scale.pitches.length === 7 && scale.pitches.every(validPitch)
  return scale.pitches === null || scale.pitches.every(validPitch)
}

function provenanceOf(scale: KernelScale): string {
  return `${scale.provenance.owner} ${scale.provenance.symbol}@${scale.provenance.revision}`
}

function tuningOf(scale: KernelScale): string {
  const tuning = scale.tuning
  if (!tuning) return 'tuning: none declared by the kernel (pitch-class addresses only, no equal temperament assumed)'
  if (Array.isArray(tuning)) return `tuning: exact ratios ${tuning.map(r => `${r.num}/${r.den}`).join(' ')}`
  const qt = tuning as QuarterToneTuning
  return `tuning: quarter-tone steps ${qt.steps.join(' ')} (from root ${qt.fromRoot.join(' ')}; cents ${qt.cents.join(' ')}), exact`
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

// ── The owner's catalogue (ql.music-modes/v1) ────────────────────────────────

/** The schema the owner's `ql music modes --json` names (QL-MEF PR #330). */
export const QL_MUSIC_MODES_SCHEMA = 'ql.music-modes/v1'

export interface QlBasis {
  readonly basis: string
  readonly conjugateAxisSemitones: number
  readonly generatorSemitones: number
  readonly generatorRatio: ExactRatio
}

/** A source the owner does not serve, named with its status. */
export interface QlAbsentSource {
  readonly scale: string
  readonly status: string
  readonly reason: string
}

/** The validated catalogue: every row the owner stated, carried with its intervals. */
export interface QlMusicModes {
  readonly schema: typeof QL_MUSIC_MODES_SCHEMA
  readonly registryRevision: string
  readonly bases: readonly QlBasis[]
  readonly scales: readonly KernelScale[]
  readonly sourcesAbsent: readonly QlAbsentSource[]
}

export type QlMusicModesParse = {readonly ok: true; readonly catalogue: QlMusicModes} | {readonly ok: false; readonly refusal: string}

class Refused extends Error {}
function refuse(why: string): never {
  throw new Refused(why)
}
function record(value: unknown, where: string): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : refuse(`${where} is not an object`)
}
function text(value: unknown, where: string): string {
  return typeof value === 'string' && value.length > 0 ? value : refuse(`${where} is not a non-empty string`)
}
function integer(value: unknown, where: string): number {
  return Number.isInteger(value) ? (value as number) : refuse(`${where} is not an integer`)
}
function list(value: unknown, where: string): unknown[] {
  return Array.isArray(value) ? value : refuse(`${where} is not a list`)
}
function pitch(value: unknown, where: string): PitchClass {
  return validPitch(value) ? value : refuse(`${where} is not a pitch class 0..11`)
}
function ratio(value: unknown, where: string): ExactRatio {
  return isRatio(value) ? {num: value.num, den: value.den} : refuse(`${where} is not an exact positive ratio`)
}
function provenance(value: unknown, where: string): ModeProvenance {
  const p = record(value, `${where}`)
  if (p.owner !== 'ql-mef') refuse(`${where}.owner is not ql-mef`)
  return {owner: 'ql-mef', symbol: text(p.symbol, `${where}.symbol`), revision: text(p.revision, `${where}.revision`)}
}

function lensRow(raw: unknown, index: number, bases: ReadonlySet<string>): KernelLensMode {
  const where = `lens_cf[${index}]`
  const row = record(raw, where)
  if (row.kind !== 'lens-cf') refuse(`${where}.kind is not lens-cf`)
  const anchor = text(row.anchor_basis, `${where}.anchor_basis`)
  if (!bases.has(anchor)) refuse(`${where}.anchor_basis ${anchor} is not a served basis`)
  const tonic = pitch(row.tonic, `${where}.tonic`)
  const pitches = list(row.pitches, `${where}.pitches`).map((p, i) => pitch(p, `${where}.pitches[${i}]`))
  if (pitches.length !== 7) refuse(`${where}.pitches is not seven pitch classes`)
  const steps = list(row.steps_semitones, `${where}.steps_semitones`).map((s, i) => integer(s, `${where}.steps_semitones[${i}]`))
  if (steps.length !== 7 || steps.some(s => s <= 0)) refuse(`${where}.steps_semitones is not seven positive semitone steps`)
  if (pitches[0] !== tonic) refuse(`${where}.pitches does not begin on its tonic`)
  let walked: number = tonic
  for (let i = 0; i < 6; i++) {
    walked = (walked + steps[i]) % 12
    if (pitches[i + 1] !== walked) refuse(`${where}.pitches does not follow steps_semitones`)
  }
  if (row.tuning !== null) refuse(`${where}.tuning is not null: a lens row states no tuning`)
  integer(row.scale_beneath_tonic, `${where}.scale_beneath_tonic`)
  return {
    kind: 'lens-cf',
    key: text(row.key, `${where}.key`),
    label: text(row.label, `${where}.label`),
    lens: text(row.lens, `${where}.lens`),
    anchorBasis: anchor,
    contextFrame: text(row.context_frame, `${where}.context_frame`),
    mode: text(row.mode, `${where}.mode`),
    pitches,
    stepsSemitones: steps,
    tuning: null,
    provenance: provenance(row.provenance, `${where}.provenance`),
  }
}

function sourceRow(raw: unknown, index: number): KernelSourceScale {
  const where = `source_scales[${index}]`
  const row = record(raw, where)
  if (row.kind !== 'source') refuse(`${where}.kind is not source`)
  if (row.pitches !== null) refuse(`${where}.pitches is not null: a quarter-tone source serves no pitch set`)
  if (row.tuning_unit !== 'quarter-tone') refuse(`${where}.tuning_unit is not quarter-tone`)
  if (row.tuning !== null) refuse(`${where}.tuning is not null: a quarter-tone source states its tuning in quarter_tone_steps`)
  const steps = list(row.quarter_tone_steps, `${where}.quarter_tone_steps`).map((v, i) => integer(v, `${where}.quarter_tone_steps[${i}]`))
  const fromRoot = list(row.quarter_tones_from_root, `${where}.quarter_tones_from_root`).map((v, i) => integer(v, `${where}.quarter_tones_from_root[${i}]`))
  const cents = list(row.cents_from_root, `${where}.cents_from_root`).map((v, i) => integer(v, `${where}.cents_from_root[${i}]`))
  if (cents.length !== fromRoot.length) refuse(`${where}.cents_from_root does not carry one cent value per degree`)
  const tuning: QuarterToneTuning = {unit: 'quarter-tone', steps, fromRoot, cents}
  if (!validQuarterTone(tuning)) refuse(`${where}.quarter_tones_from_root does not follow quarter_tone_steps across one octave of 24`)
  const familyRatio = row.family_ratio === null ? null : ratio(row.family_ratio, `${where}.family_ratio`)
  return {
    kind: 'source',
    key: text(row.key, `${where}.key`),
    label: text(row.label, `${where}.label`),
    family: text(row.family, `${where}.family`),
    pitches: null,
    familyRatio,
    tuning,
    provenance: provenance(row.provenance, `${where}.provenance`),
  }
}

function basisRow(raw: unknown, index: number): QlBasis {
  const where = `bases[${index}]`
  const row = record(raw, where)
  return {
    basis: text(row.basis, `${where}.basis`),
    conjugateAxisSemitones: integer(row.conjugate_axis_semitones, `${where}.conjugate_axis_semitones`),
    generatorSemitones: integer(row.generator_semitones, `${where}.generator_semitones`),
    generatorRatio: ratio(row.generator_ratio, `${where}.generator_ratio`),
  }
}

/**
 * Parse the owner's `ql music modes --json` reading. Strict: a reading that is
 * not ql.music-modes/v1, or any row the owner did not state exactly, is refused
 * by name. Nothing is shaped into a mode it was not given.
 */
export function parseQlMusicModes(raw: unknown): QlMusicModesParse {
  try {
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).schema !== QL_MUSIC_MODES_SCHEMA) {
      refuse(`the reading is not a ${QL_MUSIC_MODES_SCHEMA} reading`)
    }
    const root = raw as Record<string, unknown>
    const meta = record(root.provenance, 'provenance')
    const bases = list(root.bases, 'bases').map(basisRow)
    const basisNames = new Set(bases.map(b => b.basis))
    if (basisNames.size !== bases.length) refuse('bases carry a duplicate basis')
    const lens = list(root.lens_cf, 'lens_cf').map((row, i) => lensRow(row, i, basisNames))
    const sources = list(root.source_scales, 'source_scales').map(sourceRow)
    const scales: KernelScale[] = [...lens, ...sources]
    const keys = new Set<string>()
    for (const scale of scales) {
      if (keys.has(scale.key)) refuse(`duplicate key ${scale.key}`)
      keys.add(scale.key)
    }
    const sourcesAbsent = list(root.sources_absent, 'sources_absent').map((raw, i) => {
      const row = record(raw, `sources_absent[${i}]`)
      return {scale: text(row.scale, `sources_absent[${i}].scale`), status: text(row.status, `sources_absent[${i}].status`), reason: text(row.reason, `sources_absent[${i}].reason`)}
    })
    return {
      ok: true,
      catalogue: {
        schema: QL_MUSIC_MODES_SCHEMA,
        registryRevision: text(meta.m2_registry_revision, 'provenance.m2_registry_revision'),
        bases,
        scales,
        sourcesAbsent,
      },
    }
  } catch (error) {
    if (error instanceof Refused) return {ok: false, refusal: `ql music modes refused: ${error.message}`}
    throw error
  }
}

/** One group of the scale select: a basis's lens/CF instances on the root, or the source scales placed on it. */
export interface ScaleGroup {
  readonly label: string
  readonly scales: readonly KernelScale[]
}

/**
 * The scales a root presents (the transport's Root, then Scale). A lens/CF row is a
 * mode tonic instance: its pitches are absolute and begin on its tonic, so it is offered
 * only on that tonic, never transposed. A source row (maqam) states its tuning from the
 * root, so it is offered on every root. Grouped by basis, in the owner's basis order.
 */
export function scalesOnRoot(catalogue: QlMusicModes, root: PitchClass): readonly ScaleGroup[] {
  const groups: ScaleGroup[] = catalogue.bases.map(basis => ({
    label: `${basis.basis} basis`,
    scales: catalogue.scales.filter(scale => scale.kind === 'lens-cf' && scale.anchorBasis === basis.basis && scale.pitches[0] === root),
  }))
  groups.push({label: 'source scales, from the root', scales: catalogue.scales.filter(scale => scale.kind === 'source')})
  return groups.filter(group => group.scales.length > 0)
}

/** The one status line: the mode in force, then the absent sources by name. */
export function catalogueStatusLine(catalogue: QlMusicModes, mode: ModeInForce): string {
  const absent = catalogue.sourcesAbsent.map(a => `${a.scale} (${a.status})`).join(', ')
  return `${mode.line} · absent: ${absent || 'none'}`
}
