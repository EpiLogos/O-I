// The Sky on its owner (DLW §22.1): the dated sky read from Quaternal Logic, and the binding the catalogue's Sky design is drawn on
// (inhabitants/catalogue/panels/quaternal-logic__sky.tsx, `quaternal-logic:sky`; frame/devices/designed.ts DesignBinding; the pattern of
// central/devices/dayBinding.ts). Owners write, faces read: every value the design draws is the owner's reading or the view's own
// choice, and a key no owner reports stays absent with its reason (manual §16.12).
//
// The producer. The kernel's `nara_identity` op, operation `transit` (desktop/cradle/kernel/src/nara_identity.rs:352-357), runs the
// installed `oi ql nara transit - --json` on a `ql.sky-request/v1` and passes QL's `ql.nara-transit/v1` back; its `sky` is the
// `ql.sky-snapshot/v1` the kerykeion provider calculates (providers/sky/kerykeion_snapshot.py): ten bodies, each with its longitude, its
// daily speed in longitude and whether it goes backward, the epoch, the scope and the backend. It is the read the Earth places its Sun
// by (inhabitants/qlSkyEarthAdapter.ts admitDatedSubsolar). A read, never a write: the sky takes no change. The date the view asks
// for is the view's own: changing it asks the owner again, once the hand has settled, and the newest answer alone stands.
//
// Pure apart from the one kernel read, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {SkyRequest} from '../../../../../../../desktop/cradle/src/nara/identity/types'
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DesignBinding, Standing, Value} from '../../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import {techneDeviceId, techneFaceDeclaration} from './faces'
import {qlRackState, rackPage, type QlRackState} from './qlRack'
import {presenceKeys, skyPresences, withdrawSkyPresence, type SkyPresences} from './skyPresences'

export const QL_SKY_FAMILY = 'quaternal-logic'
export const QL_SKY_FACE = 'sky'
/** The device's id on the door and its design's key: designKey('quaternal-logic', 'sky'). */
export const QL_SKY_DEVICE_ID = techneDeviceId(QL_SKY_FAMILY, QL_SKY_FACE)

export const SKY_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const
export type SkyBody = typeof SKY_BODIES[number]

/** The epochs the owner answers (kerykeion_snapshot.py MIN_EPOCH / MAX_EPOCH; qlSkyEarthAdapter.ts DATED_SKY_FIRST_YEAR / _END_YEAR). */
const FIRST_MS = Date.UTC(1800, 0, 1), END_MS = Date.UTC(2400, 0, 1)
const MS_DAY = 864e5

// ── the request ─────────────────────────────────────────────────────────────

/** What the view asks for: the sky of this moment, or of one instant. */
export type SkyAsk = {readonly now: true} | {readonly now: false; readonly epochMs: number}

/** The `ql.sky-request/v1` for an instant (ported from inhabitants/qlSkyEarthAdapter.ts:132-145 requestAt): UTC, to the second, the
 * shared geocentric view in the tropical zodiac, Moshier allowed — the request the Earth's Sun is read by. */
export function skyRequestAt(epochMs: number, mode: SkyRequest['mode']): SkyRequest {
  return {
    schema: 'ql.sky-request/v1',
    epoch: `${new Date(epochMs).toISOString().slice(0, 19)}Z`,
    timezone: 'UTC',
    mode,
    perspective: 'Apparent Geocentric',
    zodiac: 'Tropical',
    ayanamsha: null,
    observer: null,
    max_age_seconds: 300,
    backend_policy: 'allow-moshier',
  }
}

/** The request for what the view asks, or the reason it is not asked: an instant outside the owner's range is refused here. */
export function skyRequestFor(ask: SkyAsk, at: Date): {ok: true; request: SkyRequest} | {ok: false; reason: string} {
  if (ask.now) return {ok: true, request: skyRequestAt(at.getTime(), 'current')}
  if (!Number.isFinite(ask.epochMs) || ask.epochMs < FIRST_MS || ask.epochMs >= END_MS) return {ok: false, reason: 'The dated sky answers only from 1800 to 2399.'}
  return {ok: true, request: skyRequestAt(ask.epochMs, 'historical')}
}

// ── the reading ─────────────────────────────────────────────────────────────

/** One body as the owner states it (the snapshot's own field names). */
export interface SkyBodyReading {
  readonly body: SkyBody
  readonly longitude_degrees: number
  readonly longitude_speed_degrees_per_day?: number
  readonly retrograde: boolean
  readonly backend?: string
}

export interface SkySnapshotReading {
  readonly snapshotRef: string
  readonly epochUtc: string
  readonly epochMs: number
  readonly scope: string | undefined
  readonly standing: string | undefined
  readonly bodies: readonly SkyBodyReading[]
  /** The transit's own status ("available" when the owner calculated the sky). */
  readonly status: string
  /** The owner's `ql.sky-snapshot/v1` verbatim: what QL's scene composes the centres of this same sky from (qlCentres.ts). */
  readonly snapshot?: Readonly<Record<string, unknown>>
}

export type SkyReading = {readonly ok: true; readonly sky: SkySnapshotReading} | {readonly ok: false; readonly reason: string}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isBody = (x: unknown): x is SkyBody => typeof x === 'string' && (SKY_BODIES as readonly string[]).includes(x)

/** The owner's answer as the binding reads it, or the owner's (or the channel's) words for why there is no sky. */
export function readSkyAnswer(answer: KernelOpCall): SkyReading {
  if (answer.outcome == null) return {ok: false, reason: `The dated sky did not answer: ${answer.error ?? 'no outcome was returned'}.`}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  if (outcome.result !== 'nara_identity') return {ok: false, reason: `The kernel answered ${outcome.result ?? 'nothing'}, not the dated sky.`}
  const data = isRecord(outcome.data) ? outcome.data : {}
  if (typeof data.error === 'string') return {ok: false, reason: data.error}
  const transit = isRecord(data.transit) ? data.transit : null
  const sky = transit && isRecord(transit.sky) ? transit.sky : null
  if (!transit || !sky) return {ok: false, reason: `The dated sky is unavailable (transit status: ${typeof transit?.status === 'string' ? transit.status : 'no transit reading'}).`}
  if (sky.schema !== 'ql.sky-snapshot/v1') return {ok: false, reason: `The sky reading is not ql.sky-snapshot/v1 (${String(sky.schema)}).`}
  const epochMs = typeof sky.epoch_utc === 'string' ? Date.parse(sky.epoch_utc) : NaN
  if (typeof sky.snapshot_ref !== 'string' || !Number.isFinite(epochMs)) return {ok: false, reason: 'The sky snapshot does not disclose its ref and epoch.'}
  const bodies = (Array.isArray(sky.bodies) ? sky.bodies : []).flatMap((entry): SkyBodyReading[] => {
    if (!isRecord(entry) || !isBody(entry.body) || !finite(entry.longitude_degrees)) return []
    return [{body: entry.body, longitude_degrees: entry.longitude_degrees, retrograde: entry.retrograde === true,
      ...(finite(entry.longitude_speed_degrees_per_day) ? {longitude_speed_degrees_per_day: entry.longitude_speed_degrees_per_day} : {}),
      ...(typeof entry.backend === 'string' ? {backend: entry.backend} : {})}]
  })
  if (!bodies.length) return {ok: false, reason: `The sky snapshot ${sky.snapshot_ref} states no body.`}
  return {ok: true, sky: {snapshotRef: sky.snapshot_ref, epochUtc: sky.epoch_utc as string, epochMs, bodies, status: typeof transit.status === 'string' ? transit.status : 'available',
    scope: typeof sky.scope === 'string' ? sky.scope : undefined, standing: typeof sky.standing === 'string' ? sky.standing : undefined, snapshot: sky}}
}

export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>

/** One read of the dated sky through the kernel. Every refusal is named; nothing is retried or filled in. */
export async function readSkyThroughKernel(call: KernelCall, request: SkyRequest): Promise<SkyReading> {
  try {
    return readSkyAnswer(await call({op: 'nara_identity', request: {operation: 'transit', request}}))
  } catch (cause) {
    return {ok: false, reason: `The kernel could not be asked for the dated sky: ${cause instanceof Error ? cause.message : String(cause)}.`}
  }
}

// ── the store the views share ───────────────────────────────────────────────

/** The view's own choices: which bodies it shows, whether it draws the aspects and the natal ring. No owner keeps them. */
export interface SkyView {
  readonly aspects: boolean
  readonly natal: boolean
  readonly hidden: readonly SkyBody[]
}

export interface QlSkyState {
  readonly ask: SkyAsk
  /** The newest answer, or null before any. */
  readonly reading: SkyReading | null
  /** The ask the reading answers (a reading for an earlier ask stands until the newer one answers). */
  readonly answered: SkyAsk | null
  readonly view: SkyView
  /** The birth sky drawn as the natal ring: a person's saved identity, given by Launch as Sky on their Being page (beingSky.ts); absent,
   * the ring stays closed, with `natalWhy` saying why when a launch found none. */
  readonly natal?: SkyNatal | null
  readonly natalWhy?: string | null
}

/** A birth sky as the person's saved identity carries it (`ql.nara-natal/v1` `sky.bodies`, read through nara_identity open): whose,
 * from which saved identity at which revision, and each body's place. The shell computes no second chart (manual §24.6). */
export interface SkyNatal {
  readonly person_ref: string
  readonly name: string | null
  readonly source: {readonly source_ref: string; readonly revision: string}
  readonly bodies: readonly {readonly body: string; readonly longitude_degrees: number; readonly retrograde: boolean}[]
}

/** Give the Sky its natal source, or take it away with the reason: the natal ring opens on it. */
export function setQlSkyNatal(natal: SkyNatal | null, why: string | null = null): void {
  setState({...state, natal, natalWhy: natal ? null : why, view: natal ? {...state.view, natal: true} : state.view})
}

const INITIAL: QlSkyState = {ask: {now: true}, reading: null, answered: null, view: {aspects: false, natal: false, hidden: []}}
let state: QlSkyState = INITIAL
let asked = false
let sequence = 0
let timer: ReturnType<typeof setTimeout> | null = null
let call: KernelCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }
const setState = (next: QlSkyState) => { if (next !== state) { state = next; notify() } }

export function qlSkyState(): QlSkyState {
  return state
}

/** How long the hand settles before the owner is asked: a drag of the Sun asks once, when it rests. */
export const SKY_SETTLE_MS = 250

/** Read the sky for the current ask now; the newest answer alone stands. */
export async function readQlSkyNow(at: Date = new Date()): Promise<void> {
  const mine = ++sequence, ask = state.ask
  const request = skyRequestFor(ask, at)
  const reading = request.ok ? await readSkyThroughKernel(call, request.request) : {ok: false as const, reason: request.reason}
  if (mine !== sequence) return
  setState({...state, reading, answered: ask})
}

/** Ask for a sky: the view's choice of date. The owner is asked once the hand settles. */
export function askQlSky(ask: SkyAsk): void {
  asked = true
  setState({...state, ask})
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void readQlSkyNow() }, SKY_SETTLE_MS)
}

/** The first read, once: the sky of this moment. */
export function ensureQlSkyRead(): void {
  if (asked) return
  asked = true
  void readQlSkyNow()
}

export function setQlSkyView(view: Partial<SkyView>): void {
  setState({...state, view: {...state.view, ...view}})
}

/** Tests: a fixture call, and a fresh store. */
export function resetQlSky(next: {call?: KernelCall} = {}): void {
  if (timer !== null) clearTimeout(timer)
  timer = null; asked = false; sequence++
  call = next.call ?? (op => kernelOp(detectTransport(), op))
  state = INITIAL
  notify()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The sky as the views read it; the first view to mount asks for the sky of this moment. */
export function useQlSky(): QlSkyState {
  useEffect(() => { ensureQlSkyRead() }, [])
  return useSyncExternalStore(subscribe, qlSkyState, qlSkyState)
}

// ── the design's values and its binding ─────────────────────────────────────

/** The date's parts as the design keeps them (year, day of the year, minutes of the day; UTC). */
const partsOf = (ms: number) => {
  const d = new Date(ms), year = d.getUTCFullYear()
  return {year, day: Math.floor((ms - Date.UTC(year, 0, 1)) / MS_DAY) + 1, time: d.getUTCHours() * 60 + d.getUTCMinutes()}
}
const fromParts = (year: number, day: number, time: number) => Date.UTC(year, 0, 1) + (day - 1) * MS_DAY + time * 6e4

/** Why each design key the binding leaves absent, or does not take, has no owner (manual §16.12: "say which one"). */
export const QL_SKY_ABSENT: Readonly<Record<string, string>> = {
  run: 'No clock runs the sky here: each date is one read of the owner, asked when you change it. A running sky would ask the owner again and again.',
  speed: 'No clock runs the sky here, so it has no speed.',
  observer: 'The shell asks for the shared geocentric sky: no observer place reaches it, so the private sky cannot be asked.',
  havePlace: 'No observer place reaches the shell.',
  natalBodies: 'The birth sky is the person\'s saved Nara identity (ql.nara-natal/v1): launch your Being page as Sky, and the Sky reads it from your identity.',
  aspectList: 'The transit lists no aspects; the view finds them from the bodies by the owner\'s rule.',
  moves: 'No compiled modulation plan runs in the shell: nothing the sky moves is evaluated, so no move is reported.',
  dayRuler: 'The rulers are counted from sunrise at a place, and no observer place reaches the shell.',
  hourRuler: 'The rulers are counted from sunrise at a place, and no observer place reaches the shell.',
  hourOf: 'The hours are counted from sunrise and sunset at a place, and no observer place reaches the shell.',
  hourHalf: 'The hours are counted from sunrise and sunset at a place, and no observer place reaches the shell.',
  sunrise: 'No observer place reaches the shell, so no sunrise is read.',
  sunset: 'No observer place reaches the shell, so no sunset is read.',
  place: 'No observer place reaches the shell.',
  // The Share page (manual §22.1): consent is Nara's presence. The kernel's nara_presence prepares and publishes one presence publication
  // (desktop/cradle/src/nara/nativePresence.ts: field, world, projection and participant refs the Sky does not hold); nothing reads the
  // world's participants to the shell. The consents both ways are SharedField's list (skyPresences.ts), drawn over these words once read.
  // Withdraw (`presence.withdraw`, the consent you chose under You share with) is the person's own withdrawal: nara_presence `withdraw`
  // with a fresh withdrawal_ref, then the list read again (skyPresences.ts withdrawSkyPresence).
  'presence.participants': 'The world\'s participants: no owner operation carries them here — missing op: a read of the world\'s participants for the Sky (Nara\'s presence, through the kernel).',
  'presence.target': 'No participants are read here, so there is no one to choose — missing op: a read of the world\'s participants (Nara\'s presence, through the kernel).',
  'presence.consents': 'Reading the presence consents SharedField lists…',
  'presence.shared': 'Reading the presence consents SharedField lists…',
  'presence.share': 'Share: no owner operation carries it here — missing op: nara_presence publish from the Sky, which holds none of the world, projection and participant refs a publication needs.',
  'natal.of': 'Whose birth sky rings: the ring opens on the identity Launch gave the Sky; opening another\'s needs their consent read — missing op: `ql nara presence-consent` through the kernel.',
  // The Rack page (manual §16.16) reads M2′'s rack from the map's ledger (qlRack.ts): no key of it is absent here.
}

/** The keys the view holds (DesignBinding.local): the date it asks for, and its own drawing choices. */
export const QL_SKY_LOCAL: readonly string[] = ['now', 'year', 'day', 'time', 'aspects', 'natal', ...SKY_BODIES.map(body => `b:${body}`)]

/** The design's values from the owner's reading and the view's choices. Only what is reported. */
export function qlSkyValues(sky: QlSkyState): Record<string, Value> {
  const values: Record<string, Value> = {}
  const reading = sky.reading
  if (reading?.ok) {
    values.light = reading.sky.status === 'available' ? 'lit' : 'dark'
    values.epoch = reading.sky.epochUtc
    values.bodies = JSON.stringify(reading.sky.bodies.map(body => ({body: body.body, longitude_degrees: body.longitude_degrees,
      ...(body.longitude_speed_degrees_per_day !== undefined ? {longitude_speed_degrees_per_day: body.longitude_speed_degrees_per_day} : {}), retrograde: body.retrograde})))
    const backends = [...new Set(reading.sky.bodies.map(body => body.backend).filter((backend): backend is string => !!backend))]
    if (backends.length === 1) values.backend = backends[0]!
    if (reading.sky.scope === 'shared-geocentric') values.observer = 'shared'
    else if (reading.sky.scope === 'observer-private') values.observer = 'private'
  } else if (reading) {
    values.light = 'dark'
    values.reason = reading.reason
  }
  values.now = sky.ask.now
  // The date the boxes start from: the one asked, or, while the sky of this moment stands, the moment the owner answered for.
  const from = !sky.ask.now ? sky.ask.epochMs : reading?.ok ? reading.sky.epochMs : undefined
  if (from !== undefined) Object.assign(values, partsOf(from))
  values.aspects = sky.view.aspects
  values.natal = sky.view.natal
  if (sky.natal) values.natalBodies = JSON.stringify(sky.natal.bodies.map(body => ({body: body.body, longitude_degrees: body.longitude_degrees, retrograde: body.retrograde})))
  for (const body of SKY_BODIES) values[`b:${body}`] = !sky.view.hidden.includes(body)
  return values
}

/** The view's hand for a key it holds: the date asks the owner again; the drawing choices are kept by the view. A drop is no change. */
export function qlSkyHand(key: string, value: Value | undefined, sky: QlSkyState = qlSkyState()): void {
  if (value === undefined) return
  if (key === 'now') {
    if (value === true) askQlSky({now: true})
    else if (sky.ask.now) {
      const read = sky.reading?.ok ? sky.reading.sky.epochMs : Date.now()
      askQlSky({now: false, epochMs: read})
    }
    return
  }
  if (key === 'year' || key === 'day' || key === 'time') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    const base = !sky.ask.now ? sky.ask.epochMs : sky.reading?.ok ? sky.reading.sky.epochMs : Date.now()
    const parts = {...partsOf(base), [key]: Math.round(value)}
    askQlSky({now: false, epochMs: fromParts(parts.year, parts.day, parts.time)})
    return
  }
  if (key === 'aspects' || key === 'natal') { setQlSkyView({[key]: value === true}); return }
  const body = key.startsWith('b:') ? key.slice(2) : null
  if (body !== null && (SKY_BODIES as readonly string[]).includes(body)) {
    const hidden = sky.view.hidden.filter(item => item !== body)
    setQlSkyView({hidden: value === false ? [...hidden, body as SkyBody] : hidden})
  }
}

/** The binding the runtime hosts the Sky design on: the owner's sky, the view's own keys in its own hand, and no write — the sky
 * takes no change. Every key no owner keeps stands disabled with the reason. */
export function qlSkyBinding(sky: QlSkyState, rack: QlRackState = qlRackState(2), presences: SkyPresences = skyPresences(),
  withdraw: (consent: string) => Promise<void> = withdrawSkyPresence): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(QL_SKY_ABSENT)) standing[key] = {disabled: why}
  // The Share page's consents both ways: SharedField's list, split by the person's Participants (skyPresences.ts).
  const consents = presenceKeys(presences)
  Object.assign(standing, consents.standing)
  // Withdraw: a consent of yours, while SharedField's list stands; else why not.
  if (!presences.ok) standing['presence.withdraw'] = {disabled: `The consents are not read, so none can be withdrawn: ${presences.reason}`}
  else if (!presences.mine.some(row => row.permitted)) standing['presence.withdraw'] = {disabled: 'You share your sky with no one now: there is no consent to withdraw.'}
  // The birth sky is a reading of the person's saved identity, never written here; absent, why it is not drawn.
  standing.natalBodies = {disabled: sky.natal ? 'Your birth sky, read from your saved identity: correct the identity, never the sky.' : sky.natalWhy ?? QL_SKY_ABSENT.natalBodies!}
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of QL_SKY_LOCAL) local[key] = value => qlSkyHand(key, value)
  // The Rack page: M2′'s rack from the map's ledger, and the part you choose (qlRack.ts).
  const page = rackPage(2, rack)
  Object.assign(standing, page.standing); Object.assign(local, page.local)
  const waiting = [...(page.waiting ? ['rack'] : []), ...(!presences.ok && presences.busy ? ['presence.consents', 'presence.shared'] : [])]
  return {id: QL_SKY_DEVICE_ID, values: {...qlSkyValues(sky), ...page.values, ...consents.values}, standing, local, ...(waiting.length ? {waiting} : {}),
    writes: key => key === 'presence.withdraw',
    write: async changes => {
      for (const {key, value} of changes) {
        if (key !== 'presence.withdraw') throw new Error(`${key}: the sky takes no change.`)
        if (typeof value !== 'string' || !value) throw new Error('Withdraw: choose a consent you gave, under You share with.')
        await withdraw(value)
      }
    }}
}

// ── the device, for the generic plate that stands in for a view ─────────────

const SIGN = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis']
const placeOf = (lon: number, back: boolean) => `${Math.floor(((lon % 30) + 30) % 30)}° ${SIGN[Math.floor((((lon % 360) + 360) % 360) / 30)]}${back ? ' R' : ''}`

/** The Sky as a device of the runtime: each body's place as a reading, and the date the owner answered for. Its one control, Now, is
 * the view's own (it asks the owner again). */
export function qlSkyDevice(face: InhabitantFaceDeclaration, sky: QlSkyState): DeviceInstance {
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_SKY_FAMILY, deviceInstance: face.id, key, title, type, ...rest}) as SdkParamRow
  const rows: SdkParamRow[] = [
    row('now', 'Now', 'boolean', {group: 'Date', compact: true, writePath: 'shell.skyDate'}),
    row('date', 'Date', 'string', {group: 'Date', compact: true}),
    ...SKY_BODIES.map(body => row(body, body, 'string', {group: 'Bodies', ...(body === 'Sun' ? {compact: true} : {})})),
  ]
  const values: Record<string, ParamValue> = {now: sky.ask.now}
  if (sky.reading?.ok) {
    values.date = sky.reading.sky.epochUtc.slice(0, 16).replace('T', ' ')
    for (const body of sky.reading.sky.bodies) values[body.body] = placeOf(body.longitude_degrees, body.retrograde)
  }
  return {
    id: QL_SKY_DEVICE_ID, family: QL_SKY_FAMILY, face: techneFaceDeclaration(face), rows, values,
    submit: async changes => {
      for (const change of changes) {
        if (change.key !== 'now' || typeof change.value !== 'boolean') throw new Error(`${change.key}: the sky takes no change; only the date it is read for moves.`)
        qlSkyHand('now', change.value)
      }
    },
  }
}
