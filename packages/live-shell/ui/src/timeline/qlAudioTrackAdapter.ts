// The QL audio track adapter (L9) — the family's audio material projected
// into the Timeline's neutral World track shape over L4's contract
// (worldTrackAdapter.ts). Composed beside the existing registry; the adapter
// knows no other family and the Timeline knows no family.
//
// Laws encoded here:
// - Port law: the material's time base IS the owner's sample clock. Spans are
//   given in native samples and converted to device seconds by the declared
//   mapping table (qlSampleClock.ts) — the sample rate must be the composed
//   owner's 48000 (QL scene_field.rs), and any other rate is refused with the
//   audio binding's own words: no implicit resampling (native-audio.mjs
//   `decode`).
// - Musical law: every lane carries its role IN the type; a role the audio
//   track cannot honestly host refuses with the classification law named
//   (qlTrackRoles.ts).
// - Take machinery: the port ledger's record/replace/append takes are exposed
//   as transport material, named as the PERFORMANCE-RECORDING SEED — declared,
//   never claimed working (the honest boundary: realtime recording belongs to
//   #281's packets).
// - Honesty: no clip here claims a sounding effect. A clip is time-positioned
//   role-classified material; its standing travels in its label/state.
//
// Pure TypeScript. No React, no clock, no audio graph.

import {
  QL_SCENE_SAMPLE_RATE,
} from '../inhabitants/ql/qlInstrumentReading'
import {createQlSampleClockStratum} from './qlSampleClock'
import {QL_AUDIO_ROLES, QL_ROLE_LAWS, type QlSonicRole} from './qlTrackRoles'
import type {
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackSet,
  WorldTrackTake,
  WorldTrack,
} from './worldTrackAdapter'

/** One performance-recording take seed (the port ledger's record/replace/
 * append machinery, named — not working, waiting for #281's packets). */
export interface QlPerformanceTake {
  readonly id: string
  /** What the take would record (a lane id, a target address). */
  readonly target: string
  readonly operation: 'record' | 'replace' | 'append'
}

/** One audio clip: time-positioned, role-classified, sample-addressed. */
export interface QlAudioClip {
  readonly id: string
  readonly label: string
  /** Native sample range, exact u64 decimal strings (the owner's cursor
   * domain). Converted to device seconds by the declared mapping. */
  readonly start_sample: string
  readonly end_sample: string
  /** The clip's own standing, carried verbatim (never upgraded by
   * placement): e.g. 'fact' for acknowledged material, 'planned' otherwise. */
  readonly standing?: string
}

/** One audio lane: a lane of role-classified audio material. */
export interface QlAudioLane {
  readonly id: string
  readonly name: string
  readonly role: QlSonicRole
  readonly clips: readonly QlAudioClip[]
}

/** The audio track reading the family supplies. Columns are the composition
 * passes (the family's own time blocks). */
export interface QlAudioTrackReading {
  /** The composed owner's device rate — must be 48000. */
  readonly sampleRate: number
  readonly columns: readonly {readonly id: string; readonly name: string}[]
  readonly presentedColumnId: string
  readonly lanes: readonly QlAudioLane[]
  readonly takes?: readonly QlPerformanceTake[]
}

export const QL_AUDIO_TRACK_ADAPTER_ID = 'ql-audio-track-adapter'

const U64 = /^(0|[1-9][0-9]{0,19})$/

export function projectQlAudioTracks(reading: QlAudioTrackReading): WorldTrackSet {
  if (reading.sampleRate !== QL_SCENE_SAMPLE_RATE) {
    // The audio binding's own law (native-audio.mjs decode): device/native
    // sample-rate mismatch; no implicit resampling.
    throw new Error(`sample rate ${reading.sampleRate} is not the composed owner's rate (${QL_SCENE_SAMPLE_RATE}); no implicit resampling`)
  }
  if (!reading.columns.some(column => column.id === reading.presentedColumnId)) {
    throw new Error(`presented column ${reading.presentedColumnId} is not in the reading`)
  }
  const clock = createQlSampleClockStratum()

  const columns: WorldTrackColumn[] = reading.columns.map(({id, name}) => ({id, name}))
  const tracks: WorldTrack[] = []
  const clips: WorldTrackClip[] = []

  for (const lane of reading.lanes) {
    if (!QL_AUDIO_ROLES.includes(lane.role)) {
      const law = QL_ROLE_LAWS[lane.role]
      throw new Error(
        lane.role === 'analyser'
          ? `lane "${lane.id}" carries the analyser role: ${law.law} — analysers belong to the metering surfaces, not to an audio track`
          : `lane "${lane.id}" carries the ${law.label} role: ${law.law} — a visual-only glyph does not belong on an audio track`,
      )
    }
    tracks.push({
      id: `ql-audio:${lane.id}`,
      name: `${lane.name} · ${QL_ROLE_LAWS[lane.role].label}`,
      kind: `ql-audio/${lane.role}`,
    })
    for (const clip of lane.clips) {
      if (!U64.test(clip.start_sample) || !U64.test(clip.end_sample)) {
        throw new Error(`clip ${clip.id}: sample cursors must be exact u64 decimals`)
      }
      if (BigInt(clip.end_sample) <= BigInt(clip.start_sample)) {
        throw new Error(`clip ${clip.id}: empty or reversed sample range`)
      }
      const start = clock.samplesToSeconds(clip.start_sample)
      if (!start.ok) throw new Error(`clip ${clip.id}: ${start.reason}`)
      const end = clock.samplesToSeconds(clip.end_sample)
      if (!end.ok) throw new Error(`clip ${clip.id}: ${end.reason}`)
      clips.push({
        id: `ql-audio-clip:${clip.id}`,
        trackId: `ql-audio:${lane.id}`,
        columnId: reading.presentedColumnId,
        // The role and the standing travel with the label: placement never
        // upgrades standing, and the classification is visible.
        label: `${clip.label} [${QL_ROLE_LAWS[lane.role].label}${clip.standing ? ' · ' + clip.standing : ''}]`,
        span: {start: start.value, end: end.value},
        state: clip.standing ?? 'fact',
      })
    }
  }

  // Takes are transport material (worldTrackAdapter's contract): the
  // performance-recording seed, named, never a clock and never a track.
  const takes: WorldTrackTake[] = (reading.takes ?? []).map(take => ({
    id: take.id,
    target: take.target,
    name: `Take ${take.operation} · ${take.target} · performance-recording seed (owner pending, #281)`,
  }))

  return {columns, tracks, clips, transport: {takes}}
}

export const qlAudioTrackAdapter: WorldTrackAdapter<QlAudioTrackReading> = {
  id: QL_AUDIO_TRACK_ADAPTER_ID,
  project: projectQlAudioTracks,
}
