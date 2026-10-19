// Scale mapping (manual §21.3) on its owners: the catalogue's design (inhabitants/catalogue/panels/live__scale-mapping.tsx,
// `live:scale-mapping`) drawn on the Scale note device and the mode it folds onto. Owners write, faces read (lock §0.4):
//   enabled, tie   the Scale note device in the note-device chain (noteDevices/noteDeviceHold.ts setNoteDevicePower, setScaleTie);
//   mode.root      the Live transport's root, and mode.key its scale (native/liveModeCatalogue.ts LiveModeHold, setLiveModeHold),
//                  as the mode in force resolves them (setModeInForce): the same mode the transport, the clip and the keyboard read;
//   mode.lens      the owner's lens rows, mode.sources its source scales with their cents, mode.absent the sources it names absent
//                  (ql.music-modes/v1 through the kernel's music_modes_read, live/modes.ts QlMusicModes).
// The device holds no pitch set of its own (noteDevices.ts), so nothing else is the design's to set. A refused or unread catalogue
// leaves the mode's values absent and says why; the mode is held for this session, as the transport says (the set has no owner
// write for a mode yet).
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {scalesOnRoot, type KernelScale, type QlMusicModes} from '../modes'
import {setModeInForce, setLiveModeHold, type LiveModeCatalogueState, type LiveModeHold} from '../../native/liveModeCatalogue'
import {setNoteDevicePower, setScaleTie} from '../noteDevices/noteDeviceHold'
import {TIE_RULES, TIE_RULE_LABEL, type NoteDevice, type TieRule} from '../noteDevices/noteDevices'

/** The design's family and face: designKey('live', 'scale-mapping') is the design's id. */
export const SCALE_MAPPING_FAMILY = 'live'
export const SCALE_MAPPING_FACE = 'scale-mapping'

/** The Scale note device as the design's device: the same instance, wearing the design's family and face. */
export function asScaleMappingDevice(instance: DeviceInstance): DeviceInstance {
  return {...instance, family: SCALE_MAPPING_FAMILY, face: {...instance.face, id: SCALE_MAPPING_FACE}}
}

/** The owner's hands, so a test can stand in for them. */
export interface ScaleMappingWriters {
  readonly setPower: (id: string, enabled: boolean) => void
  readonly setTie: (id: string, tie: TieRule) => void
  readonly setHold: (patch: Partial<LiveModeHold>) => void
}
const OWNERS: ScaleMappingWriters = {setPower: setNoteDevicePower, setTie: setScaleTie, setHold: setLiveModeHold}

const lensRow = (scale: KernelScale) => scale.kind === 'lens-cf'
  ? [{key: scale.key, basis: scale.anchorBasis, lens: scale.lens, cf: scale.contextFrame ?? '', mode: scale.mode, pitches: [...scale.pitches]}] : []
const sourceRow = (scale: KernelScale) => scale.kind === 'source'
  ? [{key: scale.key, label: scale.label,
    // Only the owner's own cents: a quarter-tone source states them; an exact-ratio tuning is carried, never converted here.
    cents: scale.tuning && !Array.isArray(scale.tuning) ? [...(scale.tuning as {cents: readonly number[]}).cents] : []}] : []

const catalogueOf = (reading: LiveModeCatalogueState): QlMusicModes | null => (reading.state === 'ready' ? reading.catalogue : null)
const catalogueWhy = (reading: LiveModeCatalogueState): string | null =>
  reading.state === 'ready' ? null : reading.state === 'refused' ? `The mode catalogue is refused: ${reading.reason}` : 'The mode catalogue is still being read from the owner.'
const NO_DEVICE = 'No Scale device stands on the note-device chain.'

/** The design's values: the Scale device's power and tie, and the mode in force with the owner's catalogue. Only what the owners report. */
export function scaleMappingValues(device: NoteDevice | null, reading: LiveModeCatalogueState, hold: LiveModeHold): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (device) {
    values.enabled = device.enabled
    if (device.kind === 'scale') values.tie = TIE_RULE_LABEL[device.params.tie]
  }
  const catalogue = catalogueOf(reading)
  if (!catalogue) return values
  const mode = setModeInForce(reading, hold).mode
  values['mode.root'] = mode.state === 'in-force' ? mode.selection.root : hold.root
  if (mode.state === 'in-force') values['mode.key'] = mode.selection.scale.key
  values['mode.lens'] = JSON.stringify(catalogue.scales.flatMap(lensRow))
  values['mode.sources'] = JSON.stringify(catalogue.scales.flatMap(sourceRow))
  values['mode.absent'] = JSON.stringify(catalogue.sourcesAbsent.map(absent => ({scale: absent.scale, status: absent.status})))
  return values
}

/** Why the owners do not take a change of this key now, or null when they do. */
function writeStanding(device: NoteDevice | null, reading: LiveModeCatalogueState, key: string): string | null {
  if (key === 'enabled' || key === 'tie') return device ? (key === 'tie' && device.kind !== 'scale' ? 'Only a Scale device has a tie.' : null) : NO_DEVICE
  if (key === 'mode.root' || key === 'mode.key') return catalogueWhy(reading)
  if (key === 'mode.lens' || key === 'mode.sources' || key === 'mode.absent') return 'A reading: the owner\'s catalogue, as the kernel serves it.'
  if (key === 'mode.source') return 'Only your hand sets the mode here: the transport has no Sky key source, and the shell reads no hour ruler.'
  if (key === 'sky.hourRuler') return 'No hour ruler reaches the shell: the hours are counted at a place, and no observer place reaches it.'
  if (key === 'sky.bound') return 'No hour ruler reaches the shell, so no maqām is bound to it here.'
  return `${key}: no setting of the Scale device or the mode it folds onto.`
}

/** Apply the design's changes through the owners, root before scale; throws in words for one they do not take, before any is applied. */
export function applyScaleMappingChanges(device: NoteDevice | null, reading: LiveModeCatalogueState, hold: LiveModeHold, changes: readonly ValueChange[],
  writers: ScaleMappingWriters = OWNERS): void {
  const ordered = [...changes].sort((a, b) => Number(b.key === 'mode.root') - Number(a.key === 'mode.root'))
  let root = hold.root
  const acts: (() => void)[] = []
  for (const {key, value} of ordered) {
    const why = writeStanding(device, reading, key)
    if (why) throw new Error(why)
    if (key === 'enabled') {
      if (typeof value !== 'boolean') throw new Error('The device is on or off.')
      acts.push(() => writers.setPower(device!.id, value))
    } else if (key === 'tie') {
      const tie = TIE_RULES.find(rule => TIE_RULE_LABEL[rule] === value)
      if (!tie) throw new Error(`${String(value)}: the tie goes Up or Down.`)
      acts.push(() => writers.setTie(device!.id, tie))
    } else if (key === 'mode.root') {
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 11) throw new Error('The root is a pitch class, 0 to 11.')
      root = value as number
      acts.push(() => writers.setHold({root: value as number}))
    } else if (key === 'mode.key') {
      const offered = scalesOnRoot(catalogueOf(reading)!, root).some(group => group.scales.some(scale => scale.key === value))
      if (typeof value !== 'string' || !offered) throw new Error(`${String(value)}: the catalogue offers no such scale on this root.`)
      acts.push(() => writers.setHold({key: value}))
    }
  }
  for (const act of acts) act()
}

/** The binding the runtime hosts the Scale mapping design on: the owners' readings and hands, every key they do not take disabled
 * with the reason. */
export function scaleMappingBinding(id: string, device: NoteDevice | null, reading: LiveModeCatalogueState, hold: LiveModeHold,
  writers: ScaleMappingWriters = OWNERS): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of ['enabled', 'tie', 'mode.root', 'mode.key', 'mode.lens', 'mode.sources', 'mode.absent', 'mode.source', 'sky.hourRuler', 'sky.bound']) {
    const why = writeStanding(device, reading, key)
    if (why) standing[key] = {disabled: why}
  }
  return {
    id,
    values: scaleMappingValues(device, reading, hold),
    writes: key => writeStanding(device, reading, key) === null,
    standing,
    write: async changes => applyScaleMappingChanges(device, reading, hold, changes, writers),
    ...(device ? {enabledKey: 'enabled'} : {}),
  }
}
