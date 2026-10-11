// The sample clock as the work-time stratum of the time spine (L9;
// WORLD-SHELL-DESIGN §15 + §18 "Time"; QL-MEF #281 §2.5 — the commissioned
// law, quoted: "Use a coherent sample-time domain for the active audio
// device/offline renderer and explicit mappings to transport,
// physical/control updates, display frames, M1 phase, M3 inscription/
// aperture state, astronomical occurrence and civil Day/NOW").
//
// The law this module encodes:
// - ONE MAPPING TABLE. Every conversion this module performs is a row of
//   QL_CLOCK_MAPPINGS; a conversion without a declared row refuses. There is
//   no silent conversion anywhere: seconds, samples, transport units, M1
//   ticks, M3 inscriptions, sky occasions and civil days do not interchange
//   by arithmetic alone (the techne:time-axis law — clock domains are named,
//   never conflated).
// - Anchors are MEASURED, not computed. The only joint between the sample
//   stratum and civil time is an anchor read off an owner receipt
//   (samples_elapsed + the read's civil instant, same acknowledged basis).
//   Declared RATES carry conversions inside a stratum family; anchors carry
//   conversions across strata.
// - The M1 tick cadence is DECLARED, never fixed: controller.ts CADENCES
//   carries two source-cited rates (1 Hz world clock, 12 Hz PPS user tick)
//   and names neither as the M1 contract. A mapping that uses one must name
//   it (its `source` string rides the result).
// - The spine binds READ-ONLY (§15.1 discipline): this stratum contributes
//   one chronos function — the owner's work-time cursor — and transport
//   takes are material, never a clock (worldTrackAdapter.ts).
// - Policy constants are ports: sample rate 48000 (QL scene_field.rs
//   `default_field` via controller.ts), block 8192, lead/lookahead 0.5 s
//   (EMBEDDED_NATIVE_PLAYBACK).
//
// Pure TypeScript. No React, no timers, no transport: the caller supplies
// every reading and instant.

import {QL_SCENE_SAMPLE_RATE, type QlInstrumentReading} from '../inhabitants/ql/qlInstrumentReading'
import type {TimeSpine, ChronosFunction} from './timeSpine'

// ── the strata this coupling names ───────────────────────────────────────────

export type QlStratumKey =
  | 'samples'          // the owner's coherent sample-time domain (u64 cursor)
  | 'seconds'          // device seconds (sampleRate-derived)
  | 'transport'        // the Timeline playhead's performable time (§15.4)
  | 'm1-phase'         // the M1 torus phase (tick12/cycle; declared cadence)
  | 'm3-inscription'   // the M3 codon/inscription state (event-anchored)
  | 'sky-occurrence'   // the dated sky (K8 retained occasion)
  | 'civil-day'        // civil Day/NOW (Central's closure law)

// ── the declared mapping table ───────────────────────────────────────────────
//
// One table; every conversion is a row. `via` names the carrier (a declared
// rate or an anchor); `law` is the disclosure the result carries. A converter
// that cannot find its row refuses — that IS the no-silent-conversion law,
// made executable.

export interface QlClockMapping {
  readonly from: QlStratumKey
  readonly to: QlStratumKey
  readonly via: 'declared-rate' | 'anchor' | 'identity'
  /** The declared rate or anchor kind the conversion rides. */
  readonly carrier: string
  readonly law: string
}

export const QL_CLOCK_MAPPINGS: readonly QlClockMapping[] = Object.freeze([
  {
    from: 'samples', to: 'seconds', via: 'declared-rate', carrier: `sampleRate ${QL_SCENE_SAMPLE_RATE} Hz (QL scene_field.rs default_field)`,
    law: 'exact device-rate division; no resampling, no drift term',
  },
  {
    from: 'seconds', to: 'samples', via: 'declared-rate', carrier: `sampleRate ${QL_SCENE_SAMPLE_RATE} Hz (QL scene_field.rs default_field)`,
    law: 'floor to the integer sample boundary (the audio binding schedules on integer device samples — native-audio.mjs #newOriginTime)',
  },
  {
    from: 'samples', to: 'm1-phase', via: 'declared-rate', carrier: 'a declared tick cadence (controller.ts CADENCES: world 1 tick/s, user 12 ticks/s; neither is fixed by the M1 contract)',
    law: 'samples/48000 × declared ticks-per-second; the cadence\'s own source string rides the result',
  },
  {
    from: 'samples', to: 'transport', via: 'declared-rate', carrier: 'a declared transport rate (seconds per transport unit) supplied by the caller',
    law: 'no implicit tempo: the Timeline\'s performable time base must be declared before samples map onto it',
  },
  {
    from: 'samples', to: 'civil-day', via: 'anchor', carrier: 'a measured anchor (samples_elapsed + the owner read\'s civil instant)',
    law: 'the only sample↔civil joint is a measured anchor; instants map to days by the spine\'s own UTC-day law',
  },
  {
    from: 'civil-day', to: 'sky-occurrence', via: 'anchor', carrier: 'the sky epoch of the anchor (or "now")',
    law: 'a sky occasion retains its snapshot basis and separately qualifies current admission (the K8 behaviour; the spine owns retention)',
  },
  {
    from: 'm3-inscription', to: 'm1-phase', via: 'anchor', carrier: 'ring_codon_advance determinant events (M3 form → Vimarśā pose)',
    law: 'inscription state advances per owner EVENT, not per rate — no silent interpolation between events',
  },
])

function mappingFor(from: QlStratumKey, to: QlStratumKey): QlClockMapping {
  const row = QL_CLOCK_MAPPINGS.find(row => row.from === from && row.to === to)
  if (!row) throw new Error(`no declared mapping ${from} → ${to} in QL_CLOCK_MAPPINGS; no silent conversion`)
  return row
}

// ── typed results — every conversion carries its trail ───────────────────────

export interface QlMapped<T> {
  readonly ok: true
  readonly from: QlStratumKey
  readonly to: QlStratumKey
  readonly value: T
  /** The conversion trail: mapping rows applied, in order. */
  readonly trail: readonly QlClockMapping[]
  /** The declared carrier the last row rode (a rate's source or the anchor's). */
  readonly carrier: string
}

export type QlRefusal = {
  readonly ok: false
  readonly from: QlStratumKey
  readonly to: QlStratumKey
  readonly reason: string
}

export type QlConversion<T> = QlMapped<T> | QlRefusal

const refuse = (from: QlStratumKey, to: QlStratumKey, reason: string): QlRefusal => ({ok: false, from, to, reason})

const U64 = /^(0|[1-9][0-9]{0,19})$/

const samplesOf = (samples: bigint | string | number): bigint => {
  if (typeof samples === 'string') {
    if (!U64.test(samples)) throw new Error(`invalid exact sample cursor: ${samples}`)
    return BigInt(samples)
  }
  if (typeof samples === 'number') {
    if (!Number.isSafeInteger(samples) || samples < 0) throw new Error(`invalid sample count: ${samples}`)
    return BigInt(samples)
  }
  return samples
}

// ── anchors — the measured joints ────────────────────────────────────────────

/** A measured joint between the sample stratum and the rest of the spine.
 * Both halves come from ONE owner acknowledgement: the session's cursor and
 * the read's civil instant, captured together (never derived apart). */
export interface QlClockAnchor {
  readonly samples_elapsed: string
  readonly atUnixMs: number
  readonly m1: {readonly tick12: number; readonly cycle: number} | null
  readonly m3: {readonly inscription_ref: string} | null
  readonly sky: {readonly epoch: string} | null
  /** What measured this anchor, named ("controller reading @ …"). */
  readonly source: string
}

// ── declared rates ───────────────────────────────────────────────────────────

/** A declared tick cadence — controller.ts `CADENCES` are the two source-cited
 * rates; a mapping names which one it rides. */
export interface QlTickCadence {
  readonly id: 'world' | 'user'
  readonly ticksPerSecond: 1 | 12
  readonly source: string
}
export const QL_TICK_CADENCES: readonly QlTickCadence[] = Object.freeze([
  Object.freeze({id: 'world', ticksPerSecond: 1, source: 'M3/M4′ world clock, 1 Hz'}),
  Object.freeze({id: 'user', ticksPerSecond: 12, source: 'PPS user-facing tick, 12 per second'}),
])

/** A declared transport rate — the Timeline's performable time base. There is
 * no default: mapping onto the transport without one refuses. */
export interface QlTransportRate {
  readonly name: string
  readonly secondsPerUnit: number
}

// ── the stratum ──────────────────────────────────────────────────────────────

export interface QlSampleClockStratum {
  readonly policy: {
    readonly sampleRate: typeof QL_SCENE_SAMPLE_RATE
    readonly blockFrames: number
    readonly leadSeconds: number
    readonly lookaheadSeconds: number
  }
  /** The declared table — exposed so a face can render it and a reviewer can
   * audit every conversion the stratum will ever perform. */
  readonly mappings: readonly QlClockMapping[]

  samplesToSeconds(samples: bigint | string | number): QlConversion<number>
  secondsToSamples(seconds: number): QlConversion<number>
  /** samples → M1 phase, riding a DECLARED cadence. */
  samplesToM1Phase(samples: bigint | string | number, cadence: QlTickCadence): QlConversion<{ticks: number; tick12: number}>
  /** samples → transport units, riding a DECLARED transport rate. */
  samplesToTransport(samples: bigint | string | number, rate: QlTransportRate): QlConversion<number>
  /** samples → the civil instant, THROUGH a measured anchor (the only joint). */
  instantAtSamples(samples: bigint | string | number, anchor: QlClockAnchor): QlConversion<number>
  /** The civil day key an instant stands in (the spine's own UTC-day law —
   * eventDayKey's derivation, named here as the civil stratum's row). */
  civilDayAt(instantUnixMs: number): string
  /** The anchor's sky as occasion material for the spine (basis retained;
   * admission is the spine's separate qualification). */
  skyOccasionAt(anchor: QlClockAnchor): {subject_ref: string; instant_unix_ms: number; summary: string; evidence_refs: string[]; day_ref: string} | null
  /** M1 phase AT an anchor's neighbours: the inscription row — M3 state moves
   * by EVENT. Given two anchors' M1 ticks, refuses interpolation between
   * inscription events; returns the anchor's own M3 state only. */
  inscriptionAt(anchor: QlClockAnchor): QlConversion<string>

  /** Bind read-only into the §15 spine: the owner's work-time cursor as a
   * chronos function. Absent owner → the function reads "no functions" (the
   * spine's own honesty for an unbound stratum). */
  bindToSpine(spine: TimeSpine, readOwner: () => QlInstrumentReading | null): ChronosFunction
}

const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function createQlSampleClockStratum(policy?: {
  blockFrames?: number
  leadSeconds?: number
  lookaheadSeconds?: number
}): QlSampleClockStratum {
  // Policy values are the owner's (controller.ts), passed verbatim; the rate
  // is never an option.
  const resolved = Object.freeze({
    sampleRate: QL_SCENE_SAMPLE_RATE,
    blockFrames: policy?.blockFrames ?? 8192,
    leadSeconds: policy?.leadSeconds ?? 0.5,
    lookaheadSeconds: policy?.lookaheadSeconds ?? 0.5,
  })

  const samplesToSeconds = (samples: bigint | string | number): QlConversion<number> => {
    const row = mappingFor('samples', 'seconds')
    const value = roundTo(Number(samplesOf(samples)) / resolved.sampleRate, 9)
    return {ok: true, from: 'samples', to: 'seconds', value, trail: [row], carrier: row.carrier}
  }

  const secondsToSamples = (seconds: number): QlConversion<number> => {
    if (!Number.isFinite(seconds) || seconds < 0) return refuse('seconds', 'samples', `not a finite non-negative seconds value: ${seconds}`)
    const row = mappingFor('seconds', 'samples')
    // Integer device sample boundary (native-audio.mjs #newOriginTime's law).
    const value = Math.floor(seconds * resolved.sampleRate)
    return {ok: true, from: 'seconds', to: 'samples', value, trail: [row], carrier: row.carrier}
  }

  const samplesToM1Phase = (samples: bigint | string | number, cadence: QlTickCadence): QlConversion<{ticks: number; tick12: number}> => {
    if (!QL_TICK_CADENCES.some(declared => declared.id === cadence.id && declared.ticksPerSecond === cadence.ticksPerSecond)) {
      return refuse('samples', 'm1-phase', `cadence ${cadence.id} @ ${cadence.ticksPerSecond}/s is not one of the declared CADENCES — the M1 contract fixes neither rate, so a mapping must declare a real one`)
    }
    const row = mappingFor('samples', 'm1-phase')
    const ticks = roundTo((Number(samplesOf(samples)) / resolved.sampleRate) * cadence.ticksPerSecond, 6)
    return {
      ok: true, from: 'samples', to: 'm1-phase', value: {ticks, tick12: ((Math.floor(ticks) % 12) + 12) % 12},
      trail: [row], carrier: `${cadence.source} (declared cadence "${cadence.id}")`,
    }
  }

  const samplesToTransport = (samples: bigint | string | number, rate: QlTransportRate): QlConversion<number> => {
    if (!Number.isFinite(rate.secondsPerUnit) || rate.secondsPerUnit <= 0) {
      return refuse('samples', 'transport', `transport rate "${rate.name}" must carry a positive seconds-per-unit`)
    }
    const row = mappingFor('samples', 'transport')
    return {
      ok: true, from: 'samples', to: 'transport',
      value: roundTo(Number(samplesOf(samples)) / resolved.sampleRate / rate.secondsPerUnit, 9),
      trail: [row], carrier: `declared transport rate "${rate.name}" (${rate.secondsPerUnit} s/unit)`,
    }
  }

  const instantAtSamples = (samples: bigint | string | number, anchor: QlClockAnchor): QlConversion<number> => {
    const row = mappingFor('samples', 'civil-day')
    if (!U64.test(anchor.samples_elapsed) || !Number.isFinite(anchor.atUnixMs)) {
      return refuse('samples', 'civil-day', 'the anchor is not a measured joint (exact cursor + civil instant required)')
    }
    const deltaSamples = samplesOf(samples) - BigInt(anchor.samples_elapsed)
    const deltaMs = (Number(deltaSamples) / resolved.sampleRate) * 1000
    return {
      ok: true, from: 'samples', to: 'civil-day',
      value: Math.round(anchor.atUnixMs + deltaMs),
      trail: [row], carrier: `measured anchor (${anchor.source}): samples_elapsed ${anchor.samples_elapsed} @ ${new Date(anchor.atUnixMs).toISOString()}`,
    }
  }

  const civilDayAt = (instantUnixMs: number): string => {
    // The spine's own derivation (timeSpine.eventDayKey's instant branch) —
    // the civil stratum's key, named here so the table's row is executable.
    return new Date(instantUnixMs).toISOString().slice(0, 10)
  }

  const skyOccasionAt = (anchor: QlClockAnchor) => {
    const row = mappingFor('civil-day', 'sky-occurrence')
    void row
    if (!anchor.sky) return null
    const day = civilDayAt(anchor.atUnixMs)
    return {
      subject_ref: `ql:sky-occasion:${anchor.sky.epoch}`,
      instant_unix_ms: anchor.atUnixMs,
      summary: `QL sky epoch ${anchor.sky.epoch} (retained occasion; standing in the epoch's sky is honest only while its current admission says so)`,
      evidence_refs: [`ql:clock-anchor:${anchor.samples_elapsed}`],
      day_ref: day,
    }
  }

  const inscriptionAt = (anchor: QlClockAnchor): QlConversion<string> => {
    const row = mappingFor('m3-inscription', 'm1-phase')
    if (!anchor.m3) return refuse('m3-inscription', 'm1-phase', 'the anchor carries no M3 inscription state — inscription maps by owner EVENT, never by rate')
    return {
      ok: true, from: 'm3-inscription', to: 'm1-phase', value: anchor.m3.inscription_ref,
      trail: [row], carrier: `ring_codon_advance events (anchor ${anchor.source})`,
    }
  }

  const bindToSpine = (spine: TimeSpine, readOwner: () => QlInstrumentReading | null): ChronosFunction => {
    const fn: ChronosFunction = {
      id: 'ql-work-clock',
      label: 'QL instrument work-time cursor (samples_elapsed @ 48 kHz)',
      // Read-only: the family supplies the reading; the spine never computes.
      read: () => {
        const reading = readOwner()
        if (!reading || reading.disposed) return 'no functions — the QL field/PCM owner is not standing'
        return `samples_elapsed ${reading.acknowledged.samples_elapsed} @ ${resolved.sampleRate} Hz (generation ${reading.acknowledged.generation}, standing ${reading.standing})`
      },
    }
    spine.bindChronos(fn)
    return fn
  }

  return {
    policy: resolved,
    mappings: QL_CLOCK_MAPPINGS,
    samplesToSeconds,
    secondsToSamples,
    samplesToM1Phase,
    samplesToTransport,
    instantAtSamples,
    civilDayAt,
    skyOccasionAt,
    inscriptionAt,
    bindToSpine,
  }
}
