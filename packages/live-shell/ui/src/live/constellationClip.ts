// Live's clip of a constellation (O-I #768). Manual §21.2 What strikes the Torus: "The constellation in focus — Through Live's clip of it:
// drop the constellation on a part and Live transcribes it into a clip, whose notes strike their keys' points as it plays. The constellation
// stays as it is"; §21.1 the Clip panel's Constellation, "The clip's source when Live made it of a constellation, as a sample is an audio
// clip's"; §10.3 "Drag it onto a track and this mode makes its own clip of it … a clip in Live"; decision #709: "you don't have to do
// anything other than transcribe".
//
// The transcription is the grammar's own, read from its owners, never a table of its own:
//   - a member's coordinate is what the wiki declares for it: its sixfold position and its face (owners/constellations.ts, from
//     techne/wikiExpression.ts: a frame member's `position` and `conjugate`, else the node's `ql.position` and `ql.face`); a face the wiki
//     does not declare is the direct one, as a frame member's `conjugate` flag reads when it is absent;
//   - a coordinate's key is the Jankó surface's: the owner's window (`ql music janko window`, ql.janko-surface/v1, live/janko/jankoLayout.ts)
//     names each key's coordinate and the pitch class it sounds at the lens in force (QL-MEF janko.rs JankoSurface::coordinate and
//     music.rs MusicalBasis::pitch_at: position n sounds 2n, its prime face 2n + 1) — the keys you would press;
//   - the members struck together are one act, as a chord is ("A chord — Several points excited together. They draw the figure of the
//     chord", §21.1 The input), for the clip's whole length: the constellation's figure, not an order or a rhythm the wiki does not state.
//     A key two members name sounds once. A member with no declared position strikes no key and is named.
// What the grammar does not state is the clip's frame, and it is held to Live's own defaults for a new clip: one bar (CLIP_BEATS), looped,
// each note at velocity 100, in the octave from C3 (MIDI 60; the torus strikes by pitch class, live/clipPlayer.ts, so the octave is
// presentation until a key's point is ruled, MT1).
//
// The clip is made by the set's owner (kernel live_clip_create → packages/live-set edit.rs clip_create, in the part's first empty slot, in
// the document's own shape) with the constellation's ref as its source, kept in the DLW's record beside the set (live-set sources.rs), and
// read back from the owner (live_clip_read's `source`). Pure, apart from the default owners at the end.
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, LiveClipAt, LiveClipReading, LiveNote} from '../../../../../desktop/cradle/src/kernel/types'
import {CONSTELLATION_DRAG} from '../frame/browser/constellationFocus'
import {constellationNamed, constellationsNow, type Constellation} from '../owners/constellations'
import type {WorldActionReceipt, WorldTrackActions} from '../timeline/worldTrackAdapter'
import {liveJankoWindow, readJankoWindow, type JankoWindow} from './janko/jankoLayout'
import {readJankoWindowThroughKernel} from '../native/liveJankoWindow'
import {onRevision} from './liveWrites'

/** A new clip's length in beats: one bar of 4/4, Live's own new clip. */
export const CLIP_BEATS = 4
/** The octave the notes stand in: Live's C3. */
const OCTAVE_BASE = 60
/** Live's velocity for a note drawn by hand. */
const VELOCITY = 100

/** One member's strike: who, and the key it strikes (its pitch name on the surface). */
export interface Struck {readonly member: string; readonly key: string; readonly pitchClass: number}

export type Transcription =
  | {readonly notes: readonly LiveNote[]; readonly struck: readonly Struck[]; readonly left: readonly string[]; readonly refused?: undefined}
  | {readonly refused: string}

/** The constellation transcribed on the owner's surface: each placed member's key, struck together for the clip's length. Pure. */
export function transcribeConstellation(constellation: Pick<Constellation, 'title' | 'members'>, window: JankoWindow): Transcription {
  const keys = window.rows.flat()
  const struck: Struck[] = []
  const left: string[] = []
  for (const member of constellation.members) {
    const position = member.position
    if (position === null || !Number.isInteger(position) || position < 0 || position > 5) {
      left.push(position === null ? `${member.title}: the wiki declares no sixfold position for it, so it strikes no key`
        : `${member.title}: its position ${position} is no position of the six, so it strikes no key`)
      continue
    }
    const face = member.face ?? 'direct'
    const key = keys.find(row => row.position === position && row.face === face)
    if (!key) { left.push(`${member.title}: the surface the owner serves holds no key at ${position}${face === 'prime' ? '′' : ''}`); continue }
    struck.push({member: member.title, key: key.pitchName, pitchClass: key.pitchClass})
  }
  if (!struck.length) return {refused: `No member of ${constellation.title} declares a sixfold position the surface has a key for, so Live has nothing to transcribe.`
    + (left.length ? ` ${left.join('; ')}.` : '')}
  const classes = [...new Set(struck.map(row => row.pitchClass))].sort((a, b) => a - b)
  const notes = classes.map((pitchClass): LiveNote => ({p: OCTAVE_BASE + pitchClass, at: 0, len: CLIP_BEATS, vel: VELOCITY}))
  return {notes, struck, left}
}

/** What the set's owner is asked to make. */
export interface MadeClip {readonly length: number; readonly set: {readonly name: string}; readonly notes: readonly LiveNote[]; readonly source: string}

/** The owner's op (kernel lib.rs KernelOp::LiveClipCreate). */
export type LiveClipCreateOp = Extract<KernelOp, {op: 'live_clip_create'}>
export function liveClipCreateRequest(path: string, expectedRevision: string, track: number, made: MadeClip): LiveClipCreateOp {
  return {op: 'live_clip_create', path, expected_revision: expectedRevision, track, length: made.length, set: {...made.set}, notes: [...made.notes], source: made.source}
}

/** A clip's reading with its source, as the set's owner gives it (live-set edit.rs with_source). */
export type SourcedClip = LiveClipReading & {source?: string | null; sourceRefused?: string}

/** The owners Live's clip of a constellation is made through. Tests hand in their own. */
export interface LiveClipOwners {
  /** The constellation a ref names in the wiki's reading. */
  named(ref: string): Constellation | null
  /** The Jankó surface in force, as the owner serves it; a refusal throws in its words. */
  window(): Promise<JankoWindow>
  /** Make the clip in the part's first empty slot; where it was made. */
  create(path: string, track: number, made: MadeClip): Promise<{at: LiveClipAt}>
  /** The clip, read back from the set's owner. */
  read(path: string, track: number, at: LiveClipAt): Promise<SourcedClip>
}

type Maker = NonNullable<WorldTrackActions['makeClip']>
const said = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

/** The maker the Live set carries (frame/tracks/modeTracks.ts): a constellation dropped on a part of the open set at `path` is transcribed
 * and made into a clip there, its source read back from the owner. Null with no open set. */
export function liveClipMaker(path: string | null | undefined, owners: LiveClipOwners = liveClipOwners): Maker | null {
  if (!path) return null
  return {accepts: CONSTELLATION_DRAG,
    op: 'the constellation transcribed on the Jankó surface the owner serves, then the set\'s owner: live_clip_create in the part\'s first empty slot, its source kept beside the set, read back',
    run: async (trackId: string, payload: string): Promise<WorldActionReceipt> => {
      const part = new RegExp(`^als:${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#track/(\\d+)$`).exec(trackId)
      if (!part) return {ok: false, error: `${trackId} is not a part of the open set, so no clip is made there.`}
      const track = Number(part[1])
      const ref = payload.trim()
      const constellation = owners.named(ref)
      if (!constellation) return {ok: false, error: `${ref} is no constellation the wiki's reading holds now.`}
      let window: JankoWindow
      try { window = await owners.window() } catch (cause) {
        return {ok: false, error: `The Jankó surface is not served, so no member's key is known and nothing is transcribed: ${said(cause)}`}
      }
      const transcribed = transcribeConstellation(constellation, window)
      if (transcribed.refused !== undefined) return {ok: false, error: transcribed.refused}
      let at: LiveClipAt
      try {
        at = (await owners.create(path, track, {length: CLIP_BEATS, set: {name: constellation.title}, notes: transcribed.notes, source: ref})).at
      } catch (cause) {
        return {ok: false, error: `Live made no clip of ${constellation.title}: ${said(cause)}`}
      }
      const where = 'slot' in at ? `scene ${at.slot + 1}` : `the arrangement`
      let back: SourcedClip
      try { back = await owners.read(path, track, at) } catch (cause) {
        return {ok: false, error: `Live made ${constellation.title} in ${where}, but the set's owner did not read it back: ${said(cause)}`}
      }
      if (back.source !== ref) return {ok: false, error: `Live made ${constellation.title} in ${where}, but its owner reads its source as `
        + (back.source ? back.source : back.sourceRefused ? `unread (${back.sourceRefused})` : 'none') + `, not ${ref}.`}
      const keys = transcribed.struck.map(row => `${row.member} ${row.key}`).join(', ')
      return {ok: true, note: `Live made ${constellation.title} in ${where}: ${transcribed.notes.length} ${transcribed.notes.length === 1 ? 'key' : 'keys'} struck together (${keys}).`
        + (transcribed.left.length ? ` ${transcribed.left.join('; ')}.` : '') + ' Its owner reads its source as the constellation.'}
    }}
}

// ── the default owners ───────────────────────────────────────────────────────

/** The surface in force: the window the keyboard holds, else the owner's default read through the kernel. */
async function surfaceInForce(): Promise<JankoWindow> {
  const held = liveJankoWindow()
  if (held?.ok) return held.window
  const answer = await readJankoWindowThroughKernel(op => kernelOp(detectTransport(), op), null)
  if (!answer.ok) throw Error(held && !held.ok ? held.fault : answer.reason)
  const read = readJankoWindow(answer.document)
  if (!read.ok) throw Error(read.fault)
  return read.window
}

export const liveClipOwners: LiveClipOwners = {
  named: ref => constellationNamed(constellationsNow().rows, ref),
  window: surfaceInForce,
  create: (path, track, made) => onRevision(path, async (revision, transport) => {
    const answer = await kernelOp(transport, liveClipCreateRequest(path, revision, track, made))
    const outcome = answer.outcome as {result?: string; reading?: {at?: LiveClipAt}} | null
    if (answer.error || outcome?.result !== 'live_clip_reading' || !outcome.reading?.at) throw new Error(answer.error ?? 'The set\'s owner did not answer the clip it made')
    return {at: outcome.reading.at}
  }),
  read: async (path, track, at) => {
    const answer = await kernelOp(detectTransport(), {op: 'live_clip_read', path, track, clip: at})
    const outcome = answer.outcome as {result?: string; reading?: {clip?: SourcedClip}} | null
    if (answer.error || outcome?.result !== 'live_clip_reading' || !outcome.reading?.clip) throw new Error(answer.error ?? 'The set\'s owner did not answer the clip')
    return outcome.reading.clip
  },
}
