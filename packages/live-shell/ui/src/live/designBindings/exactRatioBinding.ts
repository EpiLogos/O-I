// Exact-ratio tuning (manual §21.4) on what its owners state: the catalogue's design (inhabitants/catalogue/panels/live__exact-ratio.tsx,
// `live:exact-ratio`). Owners write, faces read (lock §0.4), and only one owner here states anything the design draws: the kernel's
// mode catalogue gives each basis's generator (ql.music-modes/v1 `bases[].generator_ratio`: 9:8 chromatic, 3:2 fifths), keyed
// basis.<name>. Nothing that sounds takes a tuning. QL composes the torus's voices from the map's just ratios on its own root
// (ql-mef crates/ql-mef/src/scene.rs SceneTuning: the root in Hz and M1's harmonic ratio are its only choices, the ratios are map
// facts), and the field's compose request carries no tuning (native-field/controller.ts compose: texture, scale, sky, event); the
// hosted reading does not announce the voices' ratios. So the reference, the ratio set, the comma, the export and the bend range
// stand disabled with that reason, and the well says it. Readout and Error are the view's own choices, held by the binding's hand
// (designed.ts `local`) for this session: how a note's tuning shows, not what it is.
import type {DesignBinding, Standing, Value} from '../../frame/devices/designed'
import type {LiveModeCatalogueState} from '../../native/liveModeCatalogue'

/** The design's family and face: designKey('live', 'exact-ratio') is the design's id. */
export const EXACT_RATIO_FAMILY = 'live'
export const EXACT_RATIO_FACE = 'exact-ratio'

const NO_TUNING_OWNER = 'No owner takes a tuning: QL composes the torus\'s voices from the map\'s just ratios on its own root (ql-mef scene.rs '
  + 'SceneTuning), and the field\'s compose request carries no tuning operand, so a tuning set here would sound nowhere.'

/** Why each key the design draws has no owner reading or write (manual §16.12: "say which one"). */
export const EXACT_RATIO_ABSENT: Readonly<Record<string, string>> = {
  light: `No on or off: ${NO_TUNING_OWNER}`,
  refNote: `No reference note: ${NO_TUNING_OWNER}`,
  refHz: `No reference frequency: ${NO_TUNING_OWNER} QL's root is its own default, which no reading announces.`,
  ratioSet: `No ratio set: ${NO_TUNING_OWNER}`,
  comma: `No comma: ${NO_TUNING_OWNER}`,
  export: 'No export: the shell has no MIDI output for a tuning to leave by.',
  bendRange: 'No bend range: the shell has no MIDI output for a tuning to leave by.',
  'source.ratios': 'The hosted reading does not announce the voices\' just ratios; they are the map\'s, read by QL, not the shell.',
}

/** The view's own choices, for this session, by device id. */
const VIEW = new Map<string, {readout?: Value; error?: Value}>()

/** The design's values: the bases' generators as the owner states them, the view's own choices, and the absence named in the well. */
export function exactRatioValues(id: string, reading: LiveModeCatalogueState): Record<string, Value> {
  const values: Record<string, Value> = {reason: 'No owner takes a tuning yet'}
  if (reading.state === 'ready') for (const basis of reading.catalogue.bases) values[`basis.${basis.basis}`] = `${basis.generatorRatio.num}:${basis.generatorRatio.den}`
  const view = VIEW.get(id)
  if (view?.readout !== undefined) values.readout = view.readout
  if (view?.error !== undefined) values.error = view.error
  return values
}

/** The binding the runtime hosts the Exact-ratio design on: readings only, the view's two choices in its own hand, and every
 * tuning key disabled with the reason. */
export function exactRatioBinding(id: string, reading: LiveModeCatalogueState, changed: () => void = () => {}): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(EXACT_RATIO_ABSENT)) standing[key] = {disabled: why}
  const hold = (key: 'readout' | 'error') => (value: Value | undefined) => { VIEW.set(id, {...VIEW.get(id), [key]: value}); changed() }
  return {
    id,
    values: exactRatioValues(id, reading),
    writes: () => false,
    standing,
    local: {readout: hold('readout'), error: hold('error')},
  }
}

/** Forget the view's choices (a test, or the device leaving the chain). */
export function resetExactRatioView(id?: string): void { if (id) VIEW.delete(id); else VIEW.clear() }
