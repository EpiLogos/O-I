// Sky modulation (manual §22.2; §16.2: "The sky can move a parameter in any mode") on a Live part: the modulator that hands the torus's
// and its effects' parameters to the planets overhead, and its owner — a plan the shell holds for this session and runs on the Sky's
// reading (inhabitants/ql/devices/qlSky.ts, the kernel's nara_identity transit). The catalogue's design
// (inhabitants/catalogue/panels/quaternal-logic__sky-modulation.tsx, `quaternal-logic:sky-modulation`) states the law, and this module
// runs it:
//   Position: the planet's longitude λ moves the target about its base by Amount × (λ/360 − ½) of the target's range, in the range's own
//   scale (logarithmic for a frequency or a time), so a full turn of the planet sweeps a bracket Amount wide.
//   Interval: a frequency target is multiplied by the planet's just interval to the power of Amount (the M2-5 map, m2_sky.rs); Uranus
//   has none and moves by position.
// A target's base is its owner's value when a planet first takes it; every move is written through that target's own owner (the stage
// channel's level, scale and effect edits), ramped over the route's Smoothing; when the last route on a target goes, or the modulator
// is switched off or taken off the chain, the base is written back. Several routes on one target compose in route order.
// Scope is the part's: a played strike is one act through the stage channel and carries no parameter of its own, so nothing moves per
// note, and Note is refused in those words. The plan is held for this session, never in browser storage.
import {EFFECT_LAW, EFFECT_TITLES, type InstrumentEdit, type PresentationEffect} from '@epilogos/expressions-boundary'
import {useSyncExternalStore} from 'react'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import {commitLiveInstrumentEdit, LIVE_TORUS_ABSENT_REASON, type LiveTorusState} from '../torusInstrument'
import {dbToGain, gainToDb} from '../torusDevice'
import {QL_SKY_ABSENT, qlSkyHand, qlSkyValues, SKY_BODIES, type QlSkyState, type SkyBody} from '../../inhabitants/ql/devices/qlSky'

/** The design's family and face: designKey('quaternal-logic', 'sky-modulation') is the design's id. */
export const SKY_MODULATION_FAMILY = 'quaternal-logic'
export const SKY_MODULATION_FACE = 'sky-modulation'
/** The device's id on the Live chain. */
export const SKY_MODULATION_ID = 'live:sky-modulation'
export const SKY_MODULATION_MAX_ROUTES = 8

/** The M2-5 map: each planet's just interval from the root (m2_sky.rs), as the design draws it. Uranus has none. */
export const SKY_INTERVAL: Readonly<Record<SkyBody, readonly [number, number] | null>> = {Sun: [1, 1], Moon: [4, 3], Mercury: [5, 4], Venus: [9, 8],
  Mars: [15, 8], Jupiter: [5, 3], Saturn: [3, 2], Uranus: null, Neptune: [9, 5], Pluto: [9, 4]}

export const NOTE_SCOPE = 'Every value here is the part\'s: a played strike is one act through the stage channel and carries no parameter of its own, so nothing moves per note.'

// ── the targets ─────────────────────────────────────────────────────────────

/** A parameter on the part's chain a planet may move: its range, its owner's value now, and the edit that sets it. */
export interface SkyTarget {
  readonly id: string
  readonly device: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly unit: string
  readonly log: boolean
  /** The owner's value now. */
  readonly value: number
  readonly edit: (value: number) => InstrumentEdit
}

const LOG_KEYS = new Set(['cutoff', 'tone', 'time', 'attack', 'release', 'decay', 'ratio'])
const LABELS: Readonly<Record<string, string>> = {predelay: 'Pre-delay', mix: 'Mix', cutoff: 'Cutoff'}
const label = (key: string) => LABELS[key] ?? key[0]!.toUpperCase() + key.slice(1)

/** What the shell sets from another owner, so that no planet may hold it: the Delay's tempo follows the set's, and the Resonator bank's cut
 * and root follow the M3 clock's and the mode in force's (inhabitants/ql/devices/qlResonatorBank.ts qlBankFollow). */
const FOLLOWED = new Set(['delay/tempo', 'resonator/division', 'resonator/root'])

/** The parameters the owner reports and takes: the torus's level and scale, and every number of each effect on its chain (but those the
 * shell sets from another owner: FOLLOWED). */
export function skyTargets(state: LiveTorusState | null): SkyTarget[] {
  if (state === null || !state.ok) return []
  const targets: SkyTarget[] = [], p = state.parameters
  if (typeof p?.level === 'number')
    targets.push({id: 'quaternal-logic:torus/level', device: 'Torus', label: 'Level', min: -60, max: 12, unit: 'dB', log: false, value: gainToDb(p.level),
      edit: value => ({kind: 'level', value: dbToGain(value)})})
  const scale = p?.scale?.unitsPerMetre
  if (typeof scale === 'number')
    targets.push({id: 'quaternal-logic:torus/scale', device: 'Torus', label: 'Scale', min: 40, max: 400, unit: 'u/m', log: false, value: scale,
      edit: value => ({kind: 'scale', units_per_metre: value})})
  const effects = p?.effects
  for (const effect of (effects?.chain ?? []) as readonly PresentationEffect[]) {
    for (const [key, law] of Object.entries(EFFECT_LAW[effect])) {
      const value = effects?.[effect]?.[key]
      if (law.kind !== 'number' || FOLLOWED.has(`${effect}/${key}`) || typeof value !== 'number') continue
      targets.push({id: `live:${effect}/${key}`, device: EFFECT_TITLES[effect], label: label(key), min: law.min, max: law.max, unit: law.unit,
        log: LOG_KEYS.has(key) && law.min > 0, value, edit: v => ({kind: 'effect', effect, key, value: v})})
    }
  }
  return targets
}

// ── the law ─────────────────────────────────────────────────────────────────

export type SkyUse = 'position' | 'interval'
export interface SkyRoute {
  readonly id: string
  readonly planet: SkyBody
  readonly target: string
  readonly use: SkyUse
  /** −100..100 %. */
  readonly amount: number
  /** 0..10 s. */
  readonly smoothing: number
}

const clamp = (low: number, high: number, x: number) => Math.min(high, Math.max(low, x))
const norm = (t: Pick<SkyTarget, 'min' | 'max' | 'log'>, x: number) => (t.log ? Math.log(x / t.min) / Math.log(t.max / t.min) : (x - t.min) / (t.max - t.min))
const denorm = (t: Pick<SkyTarget, 'min' | 'max' | 'log'>, u: number) => (t.log ? t.min * (t.max / t.min) ** u : t.min + u * (t.max - t.min))

/** Where one route puts a target from a value, for a planet at λ degrees. Pure. */
export function moved(target: Pick<SkyTarget, 'min' | 'max' | 'log'>, from: number, route: Pick<SkyRoute, 'planet' | 'use' | 'amount'>, longitude: number): number {
  const interval = SKY_INTERVAL[route.planet]
  if (route.use === 'interval' && interval && target.log) return clamp(target.min, target.max, from * (interval[0] / interval[1]) ** (route.amount / 100))
  const lambda = ((longitude % 360) + 360) % 360
  return denorm(target, clamp(0, 1, norm(target, from) + route.amount / 100 * (lambda / 360 - 0.5)))
}

/** Each routed target's value under the sky: its base moved by its routes in order. Pure. */
export function skyValues(targets: readonly SkyTarget[], routes: readonly SkyRoute[], bases: Readonly<Record<string, number>>,
  longitudes: Readonly<Partial<Record<SkyBody, number>>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const target of targets) {
    const mine = routes.filter(route => route.target === target.id && longitudes[route.planet] !== undefined)
    if (!mine.length) continue
    let value = bases[target.id] ?? target.value
    for (const route of mine) value = moved(target, value, route, longitudes[route.planet]!)
    out[target.id] = Math.round(value * 1000) / 1000
  }
  return out
}

// ── the plan the shell holds ────────────────────────────────────────────────

export interface SkyModulationPlan {
  /** Whether the modulator stands on the part's chain. */
  readonly placed: boolean
  readonly on: boolean
  readonly routes: readonly SkyRoute[]
  /** Each routed target's base: its owner's value when a planet first took it. */
  readonly bases: Readonly<Record<string, number>>
  /** What was last written to each target. */
  readonly written: Readonly<Record<string, number>>
  readonly selected?: string
  /** The last write an owner refused, in its words. */
  readonly refusal?: string
}
const EMPTY: SkyModulationPlan = {placed: false, on: true, routes: [], bases: {}, written: {}}
let plan: SkyModulationPlan = EMPTY
const listeners = new Set<() => void>()
const setPlan = (next: SkyModulationPlan) => { plan = next; for (const listener of [...listeners]) listener() }
export function skyModulationPlan(): SkyModulationPlan { return plan }
export function useSkyModulationPlan(): SkyModulationPlan {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => plan, () => plan)
}

/** The edits the owners take, as one hand: a test stands in for the stage channel. */
export type SkyWriter = (edit: InstrumentEdit) => Promise<{ok: true} | {ok: false; error: string}>
let writer: SkyWriter = edit => commitLiveInstrumentEdit(edit)
const ramps = new Map<string, ReturnType<typeof setInterval>>()
const RAMP_MS = 100

export function resetSkyModulation(next: {writer?: SkyWriter} = {}): void {
  for (const timer of ramps.values()) clearInterval(timer)
  ramps.clear(); writer = next.writer ?? (edit => commitLiveInstrumentEdit(edit)); setPlan(EMPTY)
}

async function write(target: SkyTarget, value: number): Promise<void> {
  const result = await writer(target.edit(value))
  if (!result.ok) { setPlan({...plan, refusal: `${target.device} ${target.label}: ${result.error}`}); return }
  setPlan({...plan, written: {...plan.written, [target.id]: value}, refusal: undefined})
}

/** Bring each target to where the sky puts it (ramped over its routes' longest Smoothing), and hand back the bases no route holds now. */
export async function runSkyModulation(state: LiveTorusState | null, sky: QlSkyState, ramp: boolean = true): Promise<void> {
  const targets = skyTargets(state), byId = new Map(targets.map(target => [target.id, target]))
  const routed = new Set(plan.placed && plan.on ? plan.routes.map(route => route.target) : [])
  // Hand back: a base whose target no route holds goes back to its owner.
  for (const [id, base] of Object.entries(plan.bases)) {
    if (routed.has(id)) continue
    const timer = ramps.get(id); if (timer) { clearInterval(timer); ramps.delete(id) }
    const {[id]: _gone, ...bases} = plan.bases
    const {[id]: _was, ...written} = plan.written
    setPlan({...plan, bases, written})
    const target = byId.get(id)
    if (target) await write(target, base)
  }
  if (!plan.placed || !plan.on || !sky.reading?.ok) return
  // A target first taken: its owner's value now is its base.
  const bases = {...plan.bases}
  for (const id of routed) if (bases[id] === undefined && byId.has(id)) bases[id] = byId.get(id)!.value
  if (Object.keys(bases).length !== Object.keys(plan.bases).length) setPlan({...plan, bases})
  const longitudes: Partial<Record<SkyBody, number>> = {}
  for (const body of sky.reading.sky.bodies) longitudes[body.body] = body.longitude_degrees
  const wanted = skyValues(targets, plan.routes, plan.bases, longitudes)
  for (const [id, value] of Object.entries(wanted)) {
    const target = byId.get(id)!, from = plan.written[id] ?? target.value
    if (Math.abs(from - value) < 1e-9) continue
    const seconds = Math.max(0, ...plan.routes.filter(route => route.target === id).map(route => route.smoothing))
    const previous = ramps.get(id); if (previous) { clearInterval(previous); ramps.delete(id) }
    if (!ramp || seconds === 0) { await write(target, value); continue }
    const steps = Math.max(1, Math.round(seconds * 1000 / RAMP_MS)); let step = 0
    const timer = setInterval(() => {
      step++
      const u = step / steps, at = target.log && from > 0 && value > 0 ? from * (value / from) ** u : from + (value - from) * u
      void write(target, step >= steps ? value : Math.round(at * 1000) / 1000)
      if (step >= steps) { clearInterval(timer); ramps.delete(id) }
    }, RAMP_MS)
    ramps.set(id, timer)
  }
}

/** Put the modulator on the part's chain, or take it off (its routes' bases go back). */
export function placeSkyModulation(placed: boolean): void { setPlan({...plan, placed}) }

// ── the design's values and its binding ─────────────────────────────────────

const isBody = (x: unknown): x is SkyBody => typeof x === 'string' && (SKY_BODIES as readonly string[]).includes(x)
const routeKey = /^(use|amount|scope|smoothing):(.+)$/

/** Why each key the binding does not take has no owner (manual §16.12). */
export const SKY_MODULATION_ABSENT: Readonly<Record<string, string>> = {
  observer: QL_SKY_ABSENT.observer!,
  havePlace: QL_SKY_ABSENT.havePlace!,
}

/** The design's values: the Sky's reading, the part's targets with their bases, and the plan. Only what is reported or held. */
export function skyModulationValues(state: LiveTorusState | null, sky: QlSkyState, held: SkyModulationPlan = plan): Record<string, Value> {
  const values: Record<string, Value> = {}
  const skyValuesNow = qlSkyValues(sky)
  for (const key of ['bodies', 'epoch', 'now', 'year', 'day', 'time', 'observer']) if (skyValuesNow[key] !== undefined) values[key] = skyValuesNow[key]!
  values.light = held.on ? 'lit' : 'dark'
  const targets = skyTargets(state)
  if (!targets.length) values.reason = state === null ? LIVE_TORUS_ABSENT_REASON : 'The part reports no parameter a planet may move.'
  values.targets = JSON.stringify(targets.map(({edit: _edit, value, ...target}) => ({...target, base: held.bases[target.id] ?? value})))
  values.routes = JSON.stringify(held.routes.map(({id, planet, target}) => ({id, planet, target})))
  for (const route of held.routes) {
    values[`use:${route.id}`] = route.use; values[`amount:${route.id}`] = route.amount
    values[`scope:${route.id}`] = 'global'; values[`smoothing:${route.id}`] = route.smoothing
  }
  if (held.selected !== undefined) values.selected = held.selected
  return values
}

/** The plan after the design's changes. Throws in words for a change the plan does not take; the plan it was given stands. */
export function skyModulationChanges(held: SkyModulationPlan, targets: readonly SkyTarget[], changes: readonly ValueChange[]): SkyModulationPlan {
  let next = held
  // The route list first: a new route's own keys follow it in the same set.
  const ordered = [...changes].sort((a, b) => Number(b.key === 'routes') - Number(a.key === 'routes'))
  for (const {key, value} of ordered) {
    if (key === 'light') {
      next = {...next, on: value === 'lit' || value === true}
    } else if (key === 'routes') {
      let raw: unknown
      try { raw = JSON.parse(String(value)) } catch { throw new Error('The routes are a list of assignments.') }
      if (!Array.isArray(raw) || raw.length > SKY_MODULATION_MAX_ROUTES) throw new Error(`At most ${SKY_MODULATION_MAX_ROUTES} assignments.`)
      const routes = raw.map((entry: Record<string, unknown>): SkyRoute => {
        if (typeof entry?.id !== 'string' || !isBody(entry.planet) || typeof entry.target !== 'string') throw new Error('An assignment is a planet and a target.')
        if (!targets.some(target => target.id === entry.target)) throw new Error(`${String(entry.target)}: no parameter on the part's chain a planet may move.`)
        const kept = next.routes.find(route => route.id === entry.id)
        return {id: entry.id, planet: entry.planet, target: entry.target, use: kept?.use ?? 'position', amount: kept?.amount ?? 50, smoothing: kept?.smoothing ?? 1}
      })
      next = {...next, routes}
    } else {
      const match = routeKey.exec(key)
      if (!match) throw new Error(SKY_MODULATION_ABSENT[key] ?? `${key}: no setting of the modulator.`)
      const [, field, id] = match
      const route = next.routes.find(item => item.id === id)
      if (value === undefined && !route) continue
      if (!route) throw new Error(`${id}: no such assignment.`)
      let patch: Partial<SkyRoute>
      if (field === 'use') {
        if (value !== 'position' && value !== 'interval') throw new Error('Use is Position or Interval.')
        patch = {use: value}
      } else if (field === 'amount') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < -100 || value > 100) throw new Error('Amount is −100 to 100 %.')
        patch = {amount: value}
      } else if (field === 'smoothing') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) throw new Error('Smoothing is 0 to 10 s.')
        patch = {smoothing: value}
      } else {
        if (value !== 'global') throw new Error(NOTE_SCOPE)
        patch = {}
      }
      next = {...next, routes: next.routes.map(item => (item.id === id ? {...item, ...patch} : item))}
    }
  }
  return next
}

/** The binding the runtime hosts the Sky modulation design on: the Sky's reading and the plan, the date in the Sky's own hand, the
 * selected assignment in the view's, and Note and the observer refused with their reasons. */
export function skyModulationBinding(state: LiveTorusState | null, sky: QlSkyState, after: () => void = () => {}): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(SKY_MODULATION_ABSENT)) standing[key] = {disabled: why}
  const local: Record<string, (value: Value | undefined) => void> = {selected: value => setPlan({...plan, selected: typeof value === 'string' ? value : undefined})}
  for (const key of ['now', 'year', 'day', 'time']) local[key] = value => qlSkyHand(key, value)
  return {
    id: SKY_MODULATION_ID,
    values: skyModulationValues(state, sky),
    writes: key => key === 'light' || key === 'routes' || routeKey.test(key),
    standing,
    local,
    write: async (changes: readonly ValueChange[]) => { setPlan(skyModulationChanges(plan, skyTargets(state), changes)); after() },
  }
}

/** Which planet holds each routed key under a target prefix (an effect's `live:<effect>/`, the torus's `quaternal-logic:torus/`), for that
 * device's binding (designed.ts modulatedBy): the status bar names the planet. */
export function skyHeldUnder(prefix: string, held: SkyModulationPlan = plan): Record<string, string> {
  const out: Record<string, string> = {}
  if (!held.placed || !held.on) return out
  for (const route of held.routes) if (route.target.startsWith(prefix)) out[route.target.slice(prefix.length)] = route.planet
  return out
}
export const skyHeldKeys = (effect: PresentationEffect, held: SkyModulationPlan = plan): Record<string, string> => skyHeldUnder(`live:${effect}/`, held)
export const skyHeldTorusKeys = (held: SkyModulationPlan = plan): Record<string, string> => skyHeldUnder('quaternal-logic:torus/', held)
