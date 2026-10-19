// The Sitting (manual §24.3; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__sitting.tsx, `quaternal-logic:sitting`;
// T-WORLDS §6, W4): a still time with a bell to begin and end it, and a record that you sat.
//   the time       the transport's: Play begins the sitting, Stop ends it now, the length ends it at its bell. `playing` and `elapsed`
//                  are readings of that time while it plays (desktop/cradle/src/nara/sitting.ts);
//   the bell       the field's own sound: the one instrument rings the bell's note as its own strike (live/torusInstrument.ts
//                  commitLiveStage, the Jankó's `janko play` command — the torus sounds it), at the start, at each interval and at the
//                  end. No sample is added; with no instrument mounted the bell is silent and the sitting says so;
//   the record     a page in the practice world (desktop/cradle/src/nara/practiceWorld.ts makePracticePage): a Flow marked as a sitting
//                  whose `meta.sitting` is the record — the time actually sat, never the length set — made through Central's own
//                  creation door when the sitting ends. With After on Write a line, it opens in a pane for the line;
//   the centres    today's centres are the scene's (`ql.scene/v1`), which no owner carries to the shell yet (qlChakra.ts NO_CENTRES):
//                  absent, the spine draws plain and says so;
//   today          today's sittings from the practice world's records, for the widget.
// Length, Bell, Intervals, Focus, Centre, Inquiry and After are what you set (DesignBinding.local); the bell starts on the torus's root
// (the mode in force, native/liveModeCatalogue.ts). Nothing scores a sitting or derives how you are.
import {useEffect, useSyncExternalStore} from 'react'
import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {detectTransport} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import {makePracticePage, practicePages, practiceWorldOf} from '../../../../../../../desktop/cradle/src/nara/practiceWorld'
import {BELL_NOTES, bellMarks, bellPitchClass, checkSitting, DEFAULT_SITTING, sittingOfMeta, sittingRecord, sittingTitle, todaysSittings,
  type SittingFocus, type SittingRecord, type SittingSettings} from '../../../../../../../desktop/cradle/src/nara/sitting'
import type {CentralLocation} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {StageResult} from '@epilogos/expressions-boundary'
import {readWorlds} from '../../../central/centralWorlds'
import {documentLayoutWriter} from '../../../central/documents/documentDoor'
import {commitLiveStage} from '../../../live/torusInstrument'
import {useLiveModeHold} from '../../../native/liveModeCatalogue'
import type {TransportBindings} from '../../../frame/transport/slots'
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value, ValueChange} from '../../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {NO_CENTRES} from './qlChakra'

export const QL_SITTING_FAMILY = 'quaternal-logic'
export const QL_SITTING_FACE = 'sitting'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'sitting'). */
export const QL_SITTING_DEVICE_ID = techneDeviceId(QL_SITTING_FAMILY, QL_SITTING_FACE)

export const BELL_SILENT = 'The bell is silent: no Expressions instrument is mounted to ring it. The sitting still keeps its time.'
export const NOT_KEPT = 'The sitting was not kept: '

/** The settings the view holds (DesignBinding.local). */
export const QL_SITTING_LOCAL = ['length', 'bell', 'intervals', 'focus', 'centre', 'inquiry', 'after'] as const

/** The bell's ring as the field's own sound, and the record's keeping: given (tests give their own), else the instrument and Central. */
export interface SittingOwners {
  readonly ring: (pitchClass: number) => Promise<StageResult>
  readonly keep: (record: SittingRecord) => Promise<{readonly location: CentralLocation; readonly title: string}>
  readonly today: () => Promise<readonly SittingRecord[]>
  readonly open: (location: CentralLocation) => void
  readonly now: () => number
  readonly later: (run: () => void, ms: number) => unknown
  readonly cancel: (handle: unknown) => void
}

/** The torus's own strike for the bell (the Jankó's command: one note, struck as a pointer strikes, never a sample). */
const BELL_AMPLITUDE = 0.35

const practiceWorld = async (transport: KernelTransportStatus) => {
  const worlds = await readWorlds(transport)
  if (worlds.state !== 'read') throw new Error(worlds.state === 'unavailable' ? worlds.reason : 'Central has not disclosed its worlds yet.')
  const world = practiceWorldOf(worlds.worlds)
  if (!world) throw new Error('Central discloses no world to keep your practice in.')
  return world.world
}

const localDay = (ms: number) => {
  const d = new Date(ms), pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function centralOwners(): SittingOwners {
  const transport = () => detectTransport()
  return {
    ring: pitchClass => commitLiveStage({command: 'janko', action: 'play', pitch_classes: [pitchClass], amplitude: BELL_AMPLITUDE}),
    keep: async record => {
      const world = await practiceWorld(transport())
      const title = sittingTitle(record)
      const made = await makePracticePage(transport(), world, 'sitting', {title, meta: {sitting: record}, now: new Date(record.ended_at)})
      return {location: made.location, title}
    },
    today: async () => (await practicePages(transport(), await practiceWorld(transport()), 'sitting'))
      .flatMap(page => { const record = sittingOfMeta(page.island.meta); return record ? [record] : [] }),
    // The document pane's opener is loaded when a record opens (it carries the Flow form's own template).
    open: location => { void import('../../../central/documents/centralDocuments').then(({openCentralDocumentAt}) => documentLayoutWriter()?.(layout => openCentralDocumentAt(layout, {form: 'flow', location}))) },
    now: () => Date.now(),
    later: (run, ms) => setTimeout(run, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
}

// ── the store the views share ───────────────────────────────────────────────

export interface QlSittingState {
  /** What you set; the bell absent until you choose one (it starts on the torus's root). */
  readonly view: Partial<Record<typeof QL_SITTING_LOCAL[number], Value>>
  /** When the sitting now playing began (the transport's time), and the settings it began with; null while none plays. */
  readonly sitting: {readonly startedMs: number; readonly settings: SittingSettings} | null
  readonly elapsed: number
  /** The bell's last answer: rung, or why it was silent. */
  readonly bell: string | null
  /** The last record kept, or why it was not. */
  readonly kept: {readonly location: CentralLocation; readonly title: string} | null
  readonly fault: string | null
  readonly today: readonly SittingRecord[] | null
  /** The transport plays the sitting: from the first hand on the device until a sitting ends. */
  readonly armed: boolean
}
const INITIAL: QlSittingState = {view: {}, sitting: null, elapsed: 0, bell: null, kept: null, fault: null, today: null, armed: false}
let state: QlSittingState = INITIAL
let owners: SittingOwners = centralOwners()
let timers: unknown[] = []
let ticking: unknown = null
const listeners = new Set<() => void>()
const setState = (next: QlSittingState) => { if (next !== state) { state = next; for (const listener of [...listeners]) listener() } }

export function qlSittingState(): QlSittingState { return state }

/** The settings the next sitting begins with: what you set, over the defaults, the bell on `root` until you choose one. */
export function sittingSettingsOf(view: QlSittingState['view'], root: number | null = null): SittingSettings {
  const num = (value: Value | undefined, fallback: number) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback
  const str = (value: Value | undefined): string | null => typeof value === 'string' ? value : null
  return {
    length: Math.round(num(view.length, DEFAULT_SITTING.length)),
    bell: str(view.bell) ?? (root !== null && Number.isInteger(root) && root >= 0 && root < 12 ? BELL_NOTES[root]! : DEFAULT_SITTING.bell),
    intervals: Math.round(num(view.intervals, DEFAULT_SITTING.intervals)),
    focus: (str(view.focus) ?? DEFAULT_SITTING.focus) as SittingFocus,
    centre: str(view.centre),
    inquiry: str(view.inquiry) ?? '',
    after: str(view.after) === 'nothing' ? 'nothing' : 'write',
  }
}

let root: number | null = null

async function ring(): Promise<void> {
  const sitting = state.sitting
  const pitch = sitting ? bellPitchClass(sitting.settings.bell) : null
  if (pitch === null) return
  const answer = await owners.ring(pitch).catch((cause: unknown) => ({ok: false as const, error: cause instanceof Error ? cause.message : String(cause)}))
  setState({...state, bell: answer.ok ? null : `${BELL_SILENT} (${answer.error})`})
}

const clear = () => {
  for (const handle of timers) owners.cancel(handle)
  timers = []
  if (ticking !== null) owners.cancel(ticking)
  ticking = null
}

/** Play: ring the bell and begin. The bell rings again at each interval, and the length ends the sitting at its last bell. */
export function startSitting(): void {
  if (state.sitting) return
  const settings = checkSitting(sittingSettingsOf(state.view, root))
  const startedMs = owners.now()
  setState({...state, sitting: {startedMs, settings}, elapsed: 0, fault: null, armed: true})
  const marks = bellMarks(settings)
  void ring()
  for (const mark of marks.slice(1, -1)) timers.push(owners.later(() => { void ring() }, mark * 1000))
  timers.push(owners.later(() => { void endSitting('bell') }, marks.at(-1)! * 1000))
  const tick = () => {
    if (!state.sitting) return
    setState({...state, elapsed: Math.min(settings.length * 60, Math.round((owners.now() - startedMs) / 1000))})
    ticking = owners.later(tick, 1000)
  }
  ticking = owners.later(tick, 1000)
}

/** Stop, or the last bell: the sitting ends now and keeps the time actually sat, as a page in your practice world. */
export async function endSitting(by: 'bell' | 'stop' = 'stop'): Promise<void> {
  const sitting = state.sitting
  if (!sitting) { setState({...state, armed: false}); return }
  clear()
  const endedMs = owners.now()
  const record = sittingRecord(sitting.settings, sitting.startedMs, endedMs, by)
  // The bell ends the sitting, at its length or at your Stop (ring reads the sitting before it is cleared).
  void ring()
  setState({...state, sitting: null, elapsed: record.sat_seconds, armed: false})
  try {
    const kept = await owners.keep(record)
    setState({...state, kept, fault: null, today: [...(state.today ?? []), record]})
    if (sitting.settings.after === 'write') owners.open(kept.location)
  } catch (cause) {
    setState({...state, fault: `${NOT_KEPT}${cause instanceof Error ? cause.message : String(cause)}`})
  }
}

export function setQlSittingView(view: QlSittingState['view']): void {
  setState({...state, view: {...state.view, ...view}, armed: true})
}

/** Read today's sittings from the practice world's records. */
export async function readTodaysSittings(): Promise<void> {
  try { setState({...state, today: await owners.today()}) } catch { /* none read: the widget says so */ }
}

/** Tests: start again, with other owners. */
export function resetQlSitting(next: {owners?: Partial<SittingOwners>} = {}): void {
  clear()
  state = INITIAL; root = null
  owners = {...centralOwners(), ...(next.owners ?? {})}
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The sitting as the views share it; the bell starts on the torus's root, the mode in force. Today's sittings are read once. */
export function useQlSitting(): QlSittingState {
  const hold = useLiveModeHold()
  root = hold.root
  useEffect(() => { if (state.today === null) void readTodaysSittings() }, [])
  return useSyncExternalStore(subscribe, qlSittingState, qlSittingState)
}

// ── the design's values and its binding ─────────────────────────────────────

/** The design's values: what you set, the time while it plays, today's sittings. Only what is read. */
export function qlSittingValues(sitting: QlSittingState, at: number = root ?? 0): Record<string, Value> {
  const settings = sitting.sitting?.settings ?? sittingSettingsOf(sitting.view, at)
  const values: Record<string, Value> = {length: settings.length, bell: settings.bell, intervals: String(settings.intervals), focus: settings.focus,
    inquiry: settings.inquiry ?? '', after: settings.after, playing: !!sitting.sitting, elapsed: sitting.elapsed}
  if (settings.centre) values.centre = settings.centre
  if (sitting.today) values.today = JSON.stringify(todaysSittings(sitting.today, localDay(owners.now())))
  values.reason = sitting.fault ?? sitting.bell ?? NO_CENTRES
  return values
}

const READINGS: Readonly<Record<string, string>> = {
  centres: NO_CENTRES,
  elapsed: 'The time sat: the transport\'s, read while the sitting plays.',
  today: 'Today\'s sittings, read from your practice world.',
}

/** The binding the runtime hosts the Sitting design on: what you set in your own hand, the sitting played and stopped through Sit (or
 * the transport), and every reading disabled with its reason. A sitting that plays holds its settings until it ends. */
export function qlSittingBinding(sitting: QlSittingState): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(READINGS)) standing[key] = {disabled: why}
  if (sitting.sitting) for (const key of QL_SITTING_LOCAL) standing[key] = {disabled: 'The sitting plays: what you set holds until it ends.'}
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of QL_SITTING_LOCAL) local[key] = value => setQlSittingView({[key]: value})
  return {
    id: QL_SITTING_DEVICE_ID,
    values: qlSittingValues(sitting),
    writes: key => key === 'playing',
    enabledKey: 'playing',
    standing,
    local,
    write: async (changes: readonly ValueChange[]) => {
      for (const change of changes) {
        if (change.key !== 'playing') throw new Error(READINGS[change.key] ?? `${change.key}: the sitting takes no change of it.`)
        if (change.value === true) startSitting()
        else await endSitting('stop')
      }
    },
  }
}

/** The transport while the sitting is in front of you (manual §24.3 "Transport"): Play rings the bell and begins, Stop ends it now and
 * keeps the time sat, Loop shows the intervals. Empty while the sitting is not armed, so the mode's own transport stands. */
export function sittingTransport(sitting: QlSittingState): TransportBindings {
  if (!sitting.armed && !sitting.sitting) return {}
  const settings = sitting.sitting?.settings ?? sittingSettingsOf(sitting.view, root)
  return {
    play: {press: () => { try { startSitting() } catch (cause) { setState({...state, fault: cause instanceof Error ? cause.message : String(cause)}) } },
      lit: !!sitting.sitting, title: 'Play — rings the bell and begins the sitting (the torus sounds the bell).'},
    stop: {press: () => { void endSitting('stop') }, title: 'Stop — ends the sitting now; it keeps the time you actually sat.'},
    loop: {lit: settings.intervals > 0, title: settings.intervals > 0 ? `Loop — the bell rings every ${settings.intervals} minutes.` : 'Loop — no intervals: the bell rings at the start and the end.'},
  }
}

/** The sitting's transport bindings, as the mode's bar takes them. */
export function useSittingTransport(): TransportBindings {
  return sittingTransport(useSyncExternalStore(subscribe, qlSittingState, qlSittingState))
}

// ── the device, for the generic plate that stands in for a view ─────────────

/** The Sitting as a device of the runtime: its length and focus, the time sat, and Sit. */
export function qlSittingDevice(face: InhabitantFaceDeclaration, sitting: QlSittingState): DeviceInstance {
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_SITTING_FAMILY, deviceInstance: face.id, key, title, type, ...rest}) as SdkParamRow
  const rows: SdkParamRow[] = [
    row('length', 'Length', 'number', {group: 'Time', compact: true}),
    row('focus', 'Focus', 'string', {group: 'Attention', compact: true}),
    row('elapsed', 'Sat', 'number', {group: 'Time'}),
    row('playing', 'Sit', 'boolean', {group: 'Time', writePath: 'shell.transport'}),
  ]
  const values = qlSittingValues(sitting)
  const shown: Record<string, ParamValue> = {length: values.length as number, focus: values.focus as string, elapsed: values.elapsed as number, playing: values.playing as boolean}
  return {
    id: QL_SITTING_DEVICE_ID, family: QL_SITTING_FAMILY, face: techneFaceDeclaration(face), rows, values: shown,
    submit: async changes => {
      for (const change of changes) {
        if (change.key !== 'playing') throw new Error(READINGS[change.key] ?? `${change.key}: set it on the Sitting's own view.`)
        if (change.value === true) startSitting()
        else await endSitting('stop')
      }
    },
  }
}
