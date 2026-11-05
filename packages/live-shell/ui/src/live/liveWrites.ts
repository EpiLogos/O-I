// The Live set's own writes and the clip's whole reading (kernel live_clip_read, live_clip_write, live_track_mixer_write — a send
// by its index too — live_take_comp, and the acts on the set's objects, live_set_act (packages/live-set/src/acts.rs, O-I #743); the
// owner is packages/live-set/src/edit.rs; the Groove Pool's are live/liveGrooves.ts). A write is made on the revision the set's standing reading holds (native/application.ts
// readSet) and refused in the owner's words when the file moved since (Live may have saved it); after any write, or a refusal,
// the set is read again (invalidateSet), so every reader — the tracks, Clip view, the chain — draws what the file now holds.
// The kernel admits a write only for a set it has read, which the shell's own reading always is.
import {useEffect, useState} from 'react'
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus, LiveClipAt, LiveClipReading, LiveCompReading, LiveNote, LiveSetAct, LiveSetActed, LiveTrackMixer} from '../../../../../desktop/cradle/src/kernel/types'
import {invalidateSet, readSet, subscribeSet} from '../native/application'
import type {SetSelection} from '../shell/liveSelection'
import {engineEventOfMixerWrite, engineEventOfSendWrite, followInEngine} from './liveEngine'

/** Where the selection's clip stands: its arrangement index, else its session slot; null when it names neither. */
/** One note's lanes on the MPE tab (O-I #853): pressure on the tab's 0–127, bend as its force, each point [beat from the note's start,
 * amount]. */
export interface LiveClipMpeLanes {readonly pressure?: readonly (readonly [number, number])[]; readonly bend?: readonly (readonly [number, number])[]}
/** Why the MPE tab draws no slide: nothing records one. */
export const LIVE_MPE_NO_SLIDE = 'The playing surface records pressure and bend into a held note, not slide.'
/** Why the bend lane is a force, not semitones: nothing clean-room gives the bend a pitch range, and a bend moves the sound, not the
 * tuning (DLW §21.4 Rules). */
export const LIVE_MPE_BEND_FORCE = 'Bend is kept as the hand\'s force along the key, −1 down to 1 up: no clean-room source gives it a range in semitones.'
/** The MPE tab's reading of a clip read whole (O-I #853; DLW §21.1, the MPE tab: each note's own expression): each note's lanes as the set
 * keeps them beside it (packages/live-set acts.rs note_mpe, by the note's NoteId), keyed by that id as the tab's `mpe` value is — its
 * pressure scaled from the kept 0–1 to the tab's 0–127, its bend kept as the force it was played with (LIVE_MPE_BEND_FORCE) — and why
 * the tab has nothing to draw, or null. Pure. */
export function liveClipMpe(notes: readonly LiveNote[] | undefined): {readonly mpe: Readonly<Record<string, LiveClipMpeLanes>>; readonly absent: string | null} {
  const finite = (point: readonly unknown[]): point is [number, number] => point.length === 2 && point.every(n => typeof n === 'number' && Number.isFinite(n))
  const mpe: Record<string, LiveClipMpeLanes> = {}
  for (const note of notes ?? []) {
    if (note.id === undefined || !note.mpe) continue
    const pressure = (note.mpe.pressure ?? []).filter(finite).map(([at, amount]) => [at, Math.round(Math.max(0, Math.min(1, amount)) * 127)] as const)
    const bend = (note.mpe.bend ?? []).filter(finite).map(([at, amount]) => [at, Math.max(-1, Math.min(1, amount))] as const)
    if (pressure.length || bend.length) mpe[String(note.id)] = {...(pressure.length ? {pressure} : {}), ...(bend.length ? {bend} : {})}
  }
  return {mpe, absent: Object.keys(mpe).length ? null : 'No note of this clip carries expression: press or bend a held note while Record records to keep some.'}
}

export function clipAtOf(selection: SetSelection): LiveClipAt | null {
  if (selection.clip !== undefined) return {arrangement: selection.clip}
  return selection.scene === null ? null : {slot: selection.scene}
}

const live = (transport: KernelTransportStatus): string | null =>
  transport.kind === 'unavailable' ? `The set's owner is the kernel, and it is out of reach here: ${transport.reason}` : null

/** Make one write on the standing revision; read the set again whatever the owner answered. */
export async function onRevision<T>(path: string, write: (revision: string, transport: KernelTransportStatus) => Promise<T>): Promise<T> {
  const transport = detectTransport()
  const unreachable = live(transport)
  if (unreachable) throw new Error(unreachable)
  const {revision} = await readSet(path)
  try { return await write(revision, transport) } finally { invalidateSet(path) }
}

/** Change a clip's settings (the design's words) and/or a MIDI clip's notes; answers the clip as it now stands. */
export function writeLiveClip(path: string, track: number, clip: LiveClipAt,
  change: {set?: Record<string, unknown>; notes?: LiveNote[]; envelopes?: {device: string; parameter: string; points: [number, number][]}[]}): Promise<LiveClipReading> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_clip_write', path, expected_revision, track, clip, ...change})
    if (answer.error || answer.outcome?.result !== 'live_clip_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the clip')
    return answer.outcome.reading.clip
  })
}

/** One clip read whole from the set's owner (live_clip_read), once. */
export async function readLiveClip(path: string, track: number, clip: LiveClipAt): Promise<LiveClipReading> {
  const transport = detectTransport()
  const unreachable = live(transport)
  if (unreachable) throw new Error(unreachable)
  const answer = await kernelOp(transport, {op: 'live_clip_read', path, track, clip})
  if (answer.error || answer.outcome?.result !== 'live_clip_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the clip')
  return answer.outcome.reading.clip
}

/** A control of a track's mixer row the set's owner writes (live-set edit.rs apply_mixer), and what it takes: the switches on or off,
 * Monitor by its word, Volume as linear gain (Live's −70 dB to +6 dB) and Pan from −1 (left) to 1 (right), as the set keeps them. */
export type LiveMixerControl = 'activator' | 'solo' | 'arm' | 'monitor' | 'volume' | 'pan'
export type LiveMixerValue = boolean | 'in' | 'auto' | 'off' | number

/** Change one control of a track's mixer row; answers the row as it now stands. */
export function writeLiveMixer(path: string, track: number, control: LiveMixerControl, value: LiveMixerValue): Promise<LiveTrackMixer> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_track_mixer_write', path, expected_revision, track, control, value})
    if (answer.error || answer.outcome?.result !== 'live_track_mixer_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the mixer row')
    return answer.outcome.reading.mixer
  })
}

/** Set one send of a track (0 is Send A) to a level as the set keeps it (linear gain, within the send's range); answers the row. */
export function writeLiveSend(path: string, track: number, index: number, value: number): Promise<LiveTrackMixer> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_track_mixer_write', path, expected_revision, track, control: 'send', value, index})
    if (answer.error || answer.outcome?.result !== 'live_track_mixer_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the mixer row')
    return answer.outcome.reading.mixer
  })
}

/** Comp: copy a stretch (in beats) of a track's take lane into its main lane; answers the main lane and the take lanes. */
export function writeLiveComp(path: string, track: number, take: number, range: {start: number; end: number}): Promise<LiveCompReading> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_take_comp', path, expected_revision, track, take, range})
    if (answer.error || answer.outcome?.result !== 'live_take_comp_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the comp')
    return answer.outcome.reading
  })
}

/** One act on the set's objects (manual §10.9; kernel live_set_act, packages/live-set/src/acts.rs): answers what it did, in the owner's
 * words, and where it left what it made. */
export function writeLiveSetAct(path: string, act: LiveSetAct): Promise<LiveSetActed> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_set_act', path, expected_revision, act})
    if (answer.error || answer.outcome?.result !== 'live_set_acted') throw new Error(answer.error ?? 'The set\'s owner did not answer the act')
    return answer.outcome.reading
  })
}

/** Insert clip (⇧⌘M, Live's Insert MIDI Clip): an empty MIDI clip one bar long, looped, in the empty slot `scene` of a MIDI part — the
 * clip Live makes (live_clip_create with no notes and no source). Answers the clip as it now stands. */
export const INSERTED_CLIP_BEATS = 4
export function writeLiveInsertClip(path: string, track: number, scene: number): Promise<LiveClipReading> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_clip_create', path, expected_revision, track, scene, length: INSERTED_CLIP_BEATS, notes: []})
    if (answer.error || answer.outcome?.result !== 'live_clip_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the clip')
    return answer.outcome.reading.clip
  })
}

/** The set's writers the tracks adapter takes (timeline/liveSetTrackAdapter.ts LiveSetReading), each on the set at `path`. A mixer
 * write or a send lands in the set first; while the engine plays the set it then moves the engine too (live/liveEngine.ts). */
export function liveSetWrites(path: string) {
  return {
    mixerWrite: async (track: number, control: LiveMixerControl, value: LiveMixerValue) => {
      const row = await writeLiveMixer(path, track, control, value)
      await followInEngine(path, kinds => engineEventOfMixerWrite(kinds, track, control, value))
      return row
    },
    sendWrite: async (track: number, index: number, value: number) => {
      const row = await writeLiveSend(path, track, index, value)
      await followInEngine(path, kinds => engineEventOfSendWrite(kinds, track, index, value))
      return row
    },
    compWrite: (track: number, take: number, range: {start: number; end: number}) => writeLiveComp(path, track, take, range),
    act: (act: LiveSetAct) => writeLiveSetAct(path, act),
    insertClip: (track: number, scene: number) => writeLiveInsertClip(path, track, scene),
    clipInfo: {read: (track: number, clip: LiveClipAt) => readLiveClip(path, track, clip).then(reading => reading.info ?? ''),
      write: (track: number, clip: LiveClipAt, text: string) => writeLiveClip(path, track, clip, {set: {info: text}})},
    // A kept sound played on a part (O-I #852): opened on the Torus, then kept by the part (live/LivePresets.tsx), loaded when it is dropped.
    openSound: (soundRef: string, track: number) => import('./LivePresets').then(presets => presets.playKeptSoundOn(path, track, soundRef)),
  }
}

export interface LiveClipWhole {
  readonly clip: LiveClipReading | null
  /** The owner's refusal of the read, in its words. */
  readonly error: string | null
}

/** One clip read whole, read again whenever the set is (a write, Live saving it). Nothing while no clip is named. */
export function useLiveClipWhole(path: string | null, track: number | null, at: LiveClipAt | null): LiveClipWhole {
  const [whole, setWhole] = useState<LiveClipWhole>({clip: null, error: null})
  const key = path && track !== null && at ? JSON.stringify([path, track, at]) : null
  useEffect(() => {
    if (!key || !path || track === null || !at) { setWhole({clip: null, error: null}); return }
    let live = true
    const read = () => {
      const transport = detectTransport()
      if (transport.kind === 'unavailable') { setWhole({clip: null, error: transport.reason}); return }
      void kernelOp(transport, {op: 'live_clip_read', path, track, clip: at}).then(answer => {
        if (!live) return
        if (answer.error || answer.outcome?.result !== 'live_clip_reading') setWhole({clip: null, error: answer.error ?? 'The set\'s owner did not answer the clip'})
        else setWhole({clip: answer.outcome.reading.clip, error: null})
      })
    }
    read()
    const off = subscribeSet(path, read)
    return () => { live = false; off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return whole
}
