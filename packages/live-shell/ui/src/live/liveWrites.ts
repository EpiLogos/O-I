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

/** Where the selection's clip stands: its arrangement index, else its session slot; null when it names neither. */
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

/** Change one control of a track's mixer row; answers the row as it now stands. */
export function writeLiveMixer(path: string, track: number, control: 'activator' | 'solo' | 'arm' | 'monitor', value: boolean | 'in' | 'auto' | 'off'): Promise<LiveTrackMixer> {
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

/** The set's writers the tracks adapter takes (timeline/liveSetTrackAdapter.ts LiveSetReading), each on the set at `path`. */
export function liveSetWrites(path: string) {
  return {
    mixerWrite: (track: number, control: 'activator' | 'solo' | 'arm' | 'monitor', value: boolean | 'in' | 'auto' | 'off') => writeLiveMixer(path, track, control, value),
    sendWrite: (track: number, index: number, value: number) => writeLiveSend(path, track, index, value),
    compWrite: (track: number, take: number, range: {start: number; end: number}) => writeLiveComp(path, track, take, range),
    act: (act: LiveSetAct) => writeLiveSetAct(path, act),
    insertClip: (track: number, scene: number) => writeLiveInsertClip(path, track, scene),
    clipInfo: {read: (track: number, clip: LiveClipAt) => readLiveClip(path, track, clip).then(reading => reading.info ?? ''),
      write: (track: number, clip: LiveClipAt, text: string) => writeLiveClip(path, track, clip, {set: {info: text}})},
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
