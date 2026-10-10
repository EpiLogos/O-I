// The QL visual/physics track adapter (L9) — the family's visible physical
// material projected into the Timeline's neutral World track shape over L4's
// contract (worldTrackAdapter.ts).
//
// Laws encoded here:
// - Musical law: lanes carry their role IN the type; the physics track admits
//   the roles whose operative product is visible physical behaviour and
//   refuses a miscast role with the classification law named
//   (qlTrackRoles.ts). The visual-only glyph IS admitted here — honestly
//   labelled so it is never certified as physical synthesis (§1.3).
// - No silent conversion: each lane declares its own span unit (the family's
//   own units, per the contract); spans pass through with their unit named.
//   Mapping a span onto another stratum happens only through the declared
//   table (qlSampleClock.ts) — never here.
// - Common cause: a resonator's visible displacement derives from the same
//   evolving state as its audio pickup; a clip on this track and its audio
//   twin share the owner state — they are never "effects sharing a
//   timestamp".
//
// Pure TypeScript. No React, no clock, no simulation.

import {QL_PHYSICS_ROLES, QL_ROLE_LAWS, type QlSonicRole} from './qlTrackRoles'
import type {
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackSet,
  WorldTrack,
} from './worldTrackAdapter'

/** The span units a physics lane may declare — the family's own, never a
 * silent alias for another stratum. */
export type QlPhysicsSpanUnit = 'seconds' | 'm1-ticks' | 'engine-blocks'

export interface QlPhysicsClip {
  readonly id: string
  readonly label: string
  readonly start: number
  readonly end: number
  /** The clip's own standing, carried verbatim (never upgraded). */
  readonly standing?: string
}

export interface QlPhysicsLane {
  readonly id: string
  readonly name: string
  readonly role: QlSonicRole
  /** The lane's own span unit — declared, disclosed on the track row. */
  readonly spanUnit: QlPhysicsSpanUnit
  readonly clips: readonly QlPhysicsClip[]
}

export interface QlPhysicsTrackReading {
  readonly columns: readonly {readonly id: string; readonly name: string}[]
  readonly presentedColumnId: string
  readonly lanes: readonly QlPhysicsLane[]
}

export const QL_PHYSICS_TRACK_ADAPTER_ID = 'ql-physics-track-adapter'

const UNIT_LABEL: Readonly<Record<QlPhysicsSpanUnit, string>> = Object.freeze({
  'seconds': 's',
  'm1-ticks': 'M1 ticks',
  'engine-blocks': 'engine blocks',
})

export function projectQlPhysicsTracks(reading: QlPhysicsTrackReading): WorldTrackSet {
  if (!reading.columns.some(column => column.id === reading.presentedColumnId)) {
    throw new Error(`presented column ${reading.presentedColumnId} is not in the reading`)
  }
  const columns: WorldTrackColumn[] = reading.columns.map(({id, name}) => ({id, name}))
  const tracks: WorldTrack[] = []
  const clips: WorldTrackClip[] = []

  for (const lane of reading.lanes) {
    if (!QL_PHYSICS_ROLES.includes(lane.role)) {
      // The only refused role is the analyser: measured-audio diagnostic
      // display — metering's concern, never physical material.
      throw new Error(`lane "${lane.id}" carries the analyser role: ${QL_ROLE_LAWS.analyser.law} — analysers belong to the metering surfaces, not to a physics track`)
    }
    const law = QL_ROLE_LAWS[lane.role]
    const unit = UNIT_LABEL[lane.spanUnit]
    tracks.push({
      id: `ql-physics:${lane.id}`,
      name: `${lane.name} · ${law.label} (${unit})`,
      kind: `ql-physics/${lane.role}`,
    })
    for (const clip of lane.clips) {
      if (!Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.end <= clip.start) {
        throw new Error(`clip ${clip.id}: span must be finite with end > start (in ${unit})`)
      }
      // The visual-only glyph keeps its honest standing: visible, labelled,
      // never certified as physical synthesis (its law rides the label).
      const suffix = lane.role === 'visual-only' ? ' · visual-only' : ''
      clips.push({
        id: `ql-physics-clip:${clip.id}`,
        trackId: `ql-physics:${lane.id}`,
        columnId: reading.presentedColumnId,
        label: `${clip.label} [${law.label}${suffix}${clip.standing ? ' · ' + clip.standing : ''}]`,
        span: {start: clip.start, end: clip.end},
        state: clip.standing ?? (lane.role === 'visual-only' ? 'visual-only' : 'fact'),
      })
    }
  }

  return {columns, tracks, clips}
}

export const qlPhysicsTrackAdapter: WorldTrackAdapter<QlPhysicsTrackReading> = {
  id: QL_PHYSICS_TRACK_ADAPTER_ID,
  project: projectQlPhysicsTracks,
}
