// The M2 modulation sources (L9; WORLD-SHELL-DESIGN §14 + §18 "M2"; QL-MEF
// #281 §0.2/§2.4 — the commissioned law).
//
// D13, in the type: **M1 is the oscillator source; M2's pitch structures are
// tuning/modulation over that source, never a second generator.** The
// owner's Vimarśā reading writes the shared `audio_octet_hz[8]` and
// `nodal_quartet[4]` (scene.ts causal trace; the retained app's m2.vimarsha
// shape) — that does not make M2 an independent oscillator source.
//
// This module therefore declares OBSERVABLES, not voices:
// - A source's type carries `generates: false` as a LITERAL — a module that
//   claimed to generate from a source would have to assert a type that does
//   not exist. The only operation a source exposes is a read.
// - A modulation ROUTE addresses a typed parameter (§14's grammar:
//   family/device-instance/key/type/range/unit/write-path) within a DECLARED
//   scope, with amount/polarity and transfer — §2.4's "explicit modulation
//   connections: source, destination, amount/polarity, transfer function,
//   timing and per-note/global scope".
// - Plans are COMPILED before realtime execution (§18 M2: "compiled relation
//   plans before realtime execution"): compilation refuses unknown sources,
//   out-of-scope targets, malformed amounts. The compiled plan is immutable
//   and its evaluate() is pure — no scheduling, no samples, no audio graph.
// - Honesty law (§14): every evaluated route names its source — "nothing
//   moves without a visible cause".
//
// Pure TypeScript. No React, no audio, no timers.

// ── the declared observables ────────────────────────────────────────────────

/** A modulation source: an OBSERVATION of the owner's shared M2 state.
 * `generates: false` is the D13 law as a literal type member. */
export interface QlM2SourceDeclaration {
  readonly id: string
  readonly label: string
  /** The shared reading the observation reads (never a private copy). */
  readonly carrier: 'm2.vimarsha.reading.audio_octet_hz' | 'm2.vimarsha.reading.nodal_quartet'
  readonly unit: 'Hz' | 'mode-index'
  readonly index: number
  /** D13: this observes the M1-source's reading; it generates nothing. */
  readonly generates: false
  /** The role observation law (a modulation source is an analyser-class
   * observation of state — it is not a voice, an emitter or a resonator). */
  readonly law: string
}

/** The eight audible roles of the shared audio octet. */
const AUDIO_OCTET: readonly QlM2SourceDeclaration[] = Object.freeze(
  Array.from({length: 8}, (_, index): QlM2SourceDeclaration => Object.freeze({
    id: `ql:m2/audio-octet/${index}`,
    label: `audio octet ${index} (Hz)`,
    carrier: 'm2.vimarsha.reading.audio_octet_hz',
    unit: 'Hz',
    index,
    generates: false,
    law: 'an observed frequency of the shared M2 reading over the one M1 source — tuning/modulation material, never a generator (owner D13)',
  })),
)

/** The four nodal roles of the shared quartet (mode indices of the surface
 * terms). */
const NODAL_QUARTET: readonly QlM2SourceDeclaration[] = Object.freeze(
  Array.from({length: 4}, (_, index): QlM2SourceDeclaration => Object.freeze({
    id: `ql:m2/nodal-quartet/${index}`,
    label: `nodal quartet ${index} (mode)`,
    carrier: 'm2.vimarsha.reading.nodal_quartet',
    unit: 'mode-index',
    index,
    generates: false,
    law: 'an observed nodal mode of the shared M2 reading — shape material, never a generator (owner D13)',
  })),
)

/** The twelve declared sources: audio_octet[8] + nodal_quartet[4]. */
export const QL_M2_SOURCES: readonly QlM2SourceDeclaration[] = Object.freeze([...AUDIO_OCTET, ...NODAL_QUARTET])

export const qlM2Source = (id: string): QlM2SourceDeclaration | undefined =>
  QL_M2_SOURCES.find(source => source.id === id)

// ── reading the observables off the owner's shared state ────────────────────

export interface QlVimarshaReading {
  readonly audio_octet_hz?: readonly unknown[]
  readonly nodal_quartet?: readonly unknown[]
}

export interface QlM2Observation {
  readonly sourceId: string
  /** The observed value, in the source's declared unit. */
  readonly value: number
}

/** Read the declared observables off one Vimarśā reading — the retained
 * shape (`m2.vimarsha.reading`): audio_octet_hz is eight finite frequencies;
 * nodal_quartet is four voices each carrying frequency_hz and m/n mode
 * indices (the fixture's voices: {m, n, frequency_hz, planet_ref, …}).
 * Refuses a malformed reading rather than inventing values. */
export function readQlM2Sources(reading: QlVimarshaReading | null | undefined):
  {ok: true; observations: QlM2Observation[]} | {ok: false; reason: string} {
  if (!reading || typeof reading !== 'object') return {ok: false, reason: 'no Vimarśā reading is standing'}
  const observations: QlM2Observation[] = []
  const octet = reading.audio_octet_hz
  if (octet !== undefined) {
    if (!Array.isArray(octet) || octet.length !== 8) {
      return {ok: false, reason: `audio_octet_hz must be the shared eight; got ${Array.isArray(octet) ? octet.length : typeof octet}`}
    }
    octet.forEach((value, index) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw Object.assign(new Error(`audio_octet_hz[${index}] is not a finite positive frequency`), {fatal: true})
      }
      observations.push({sourceId: AUDIO_OCTET[index].id, value})
    })
  }
  const quartet = reading.nodal_quartet
  if (quartet !== undefined) {
    if (!Array.isArray(quartet) || quartet.length !== 4) {
      return {ok: false, reason: `nodal_quartet must be the shared four; got ${Array.isArray(quartet) ? quartet.length : typeof quartet}`}
    }
    quartet.forEach((voice, index) => {
      const mode = voice as {frequency_hz?: unknown; m?: unknown; n?: unknown} | null
      if (!mode || typeof mode.frequency_hz !== 'number' || !Number.isFinite(mode.frequency_hz) ||
          !Number.isInteger(mode.m) || !Number.isInteger(mode.n)) {
        throw Object.assign(new Error(`nodal_quartet[${index}] is not a voice with frequency_hz and m/n mode indices`), {fatal: true})
      }
      // The quartet's observable is the mode's frequency; the m/n indices
      // ride the value's identity in the id (shape material for M3's
      // consumers). One scalar per source keeps every route typed as a
      // number-to-parameter relation.
      observations.push({sourceId: NODAL_QUARTET[index].id, value: mode.frequency_hz})
    })
  }
  if (!observations.length) return {ok: false, reason: 'the reading carries neither the octet nor the quartet — nothing is observed'}
  return {ok: true, observations}
}

// ── parameter addresses (§14's grammar, QL family scope) ────────────────────

/** The §14 parameter address, as the QL family declares it: a typed address
 * with declared scope. `writePath` is the exact path the owning owner writes;
 * a route never writes — it proposes an effective value the owning device
 * applies through its own custody/receipt law. */
export interface QlParameterAddress {
  readonly family: string
  readonly deviceInstance: string | null
  readonly key: string
  readonly type: 'number' | 'boolean' | 'enum'
  readonly range?: {readonly min?: number; readonly max?: number}
  readonly unit?: string
  readonly writePath: string
}

/** The declared modulation scope (§14 "specification = scope declaration").
 * A route may address: any quaternal-logic family address, plus the device
 * families the plan's scope explicitly names. Everything else refuses —
 * addressing beyond declared scope is the fault compile catches. */
export interface QlModulationScope {
  readonly families: readonly string[]
  readonly note: string
}

export const QL_MODULATION_SCOPE: QlModulationScope = Object.freeze({
  families: ['quaternal-logic'],
  note: 'the declared scope as this lane lands it: quaternal-logic family addresses only. Widenings (expressions device families) are the family owner\'s later declaration — compile refuses them today.',
})

// ── routes and the compiled plan ────────────────────────────────────────────

export interface QlModulationRoute {
  readonly sourceId: string
  readonly target: QlParameterAddress
  /** Amount and polarity (§2.4): the target's delta per unit of source. */
  readonly amount: number
  readonly transfer: 'linear' | 'log'
  /** Per-§2.4 timing/scope: which lifetime the modulation belongs to. */
  readonly scope: 'instrument' | 'body' | 'context' | 'presentation'
}

export interface QlRoutedEffect {
  readonly sourceId: string
  readonly sourceLabel: string
  readonly target: QlParameterAddress
  /** The effective target value: base + amount × observed source. Clamped to
   * the address's declared hard range when it declares one; the clamp is
   * disclosed, never silent. */
  readonly effective: number
  readonly clamped: boolean
}

export interface QlCompiledModulationPlan {
  readonly routes: readonly QlModulationRoute[]
  readonly scope: QlModulationScope
  /** Evaluate one observation set — pure, allocation-light, realtime-safe in
   * the §2.5 sense (no I/O, no locks, no graph walks). Every effect names its
   * source: nothing moves without a visible cause (§14). */
  evaluate(observations: readonly QlM2Observation[], bases: ReadonlyMap<string, number>): QlRoutedEffect[]
}

/** Compile routes into an immutable plan BEFORE realtime execution.
 * Refuses: unknown source ids, targets outside the declared scope, target
 * addresses without a write path, non-finite amounts, duplicate
 * source→target pairs. */
export function compileQlModulationPlan(routes: readonly QlModulationRoute[],
  scope: QlModulationScope = QL_MODULATION_SCOPE):
  {ok: true; plan: QlCompiledModulationPlan} | {ok: false; faults: string[]} {
  const faults: string[] = []
  const seen = new Set<string>()
  routes.forEach((route, index) => {
    const where = `route ${index} (${route.sourceId} → ${route.target.key})`
    if (!qlM2Source(route.sourceId)) faults.push(`${where}: unknown modulation source — only QL_M2_SOURCES route`)
    if (!scope.families.includes(route.target.family)) {
      faults.push(`${where}: target family "${route.target.family}" is outside the declared scope (${scope.families.join(', ')})`)
    }
    if (!route.target.writePath) faults.push(`${where}: a route addresses a typed write path; this target has none`)
    if (!Number.isFinite(route.amount)) faults.push(`${where}: amount must be finite`)
    if (route.transfer === 'log' && (route.amount <= 0)) faults.push(`${where}: a log transfer needs a positive amount`)
    const pair = `${route.sourceId}→${route.target.family}/${route.target.deviceInstance ?? '*'}/${route.target.key}`
    if (seen.has(pair)) faults.push(`${where}: duplicate source→target pair (${pair})`)
    seen.add(pair)
  })
  if (faults.length) return {ok: false, faults}
  const frozen = Object.freeze([...routes])
  return {
    ok: true,
    plan: {
      routes: frozen,
      scope,
      evaluate(observations, bases) {
        const byId = new Map(observations.map(observation => [observation.sourceId, observation.value]))
        const effects: QlRoutedEffect[] = []
        for (const route of frozen) {
          const observed = byId.get(route.sourceId)
          if (observed === undefined) continue // an unread source drives nothing — and shows nothing
          const source = qlM2Source(route.sourceId)
          const raw = route.transfer === 'log'
            ? Math.log(Math.max(observed, Number.EPSILON)) * route.amount
            : observed * route.amount
          const base = bases.get(`${route.target.family}/${route.target.deviceInstance ?? '*'}/${route.target.key}`) ?? 0
          let effective = base + raw
          let clamped = false
          if (route.target.range) {
            const {min, max} = route.target.range
            if (min !== undefined && effective < min) {effective = min; clamped = true}
            if (max !== undefined && effective > max) {effective = max; clamped = true}
          }
          effects.push({
            sourceId: route.sourceId,
            sourceLabel: source?.label ?? route.sourceId,
            target: route.target,
            effective,
            clamped,
          })
        }
        return effects
      },
    },
  }
}
