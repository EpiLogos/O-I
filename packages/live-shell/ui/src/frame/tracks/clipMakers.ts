// Each mode's clip of a constellation dropped on a track (manual §10.3: "Drag it onto a track and this mode makes its own clip of it, with
// the constellation as its source: a page in Central, a task in Factory, a scene in Expressions, an event in Technē, a clip in Live";
// §16.7 Make this mode's clip). A mode's set carries its maker, never a branch in the frame: Central's makes a page through the page's
// owners (central/madeOfConstellation.ts, on the set useCentralTracks.ts gives); Factory's makes the session's task of it on AIKit
// (agent/clipBinding.ts taskMaker, on useFactoryTracks.ts's set); Expressions' makes a scene of it in the open Expression
// (components/expressions/clip/clipBinding.ts sceneMaker, on modeTracks.ts expressionsTracks' set); Technē's makes an event of it in the
// World's walk Expression (techne/clipBinding.ts techneEventMaker, on useTechneTracks.ts's set); Live's transcribes it into a clip on the part
// (live/constellationClip.ts liveClipMaker, on modeTracks.ts liveTracks' set). A mode whose owner has no operation
// to make its clip of a constellation registers the words its refusal says (MODE_CLIP_MAKERS, read by the tracks pane as it reads
// MODE_OWNERS): its tracks still take the drop and refuse it naming the operation the owner lacks — a drop is never lost in silence
// (useCentralTracks.ts withWorldSeat keeps the same law for a world). Pure.
import {CONSTELLATION_DRAG} from '../browser/constellationFocus'
import type {WorldActionReceipt, WorldTrackActions, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {SurfMode} from '../../shell/modeGrammar'

type Maker = NonNullable<WorldTrackActions['makeClip']>

/** The modes whose owner cannot make its clip of a constellation yet, each in the words the refusal says. Factory's and Expressions'
 * refusals (AIKit's task_create; the knowledge_whole resolver) are REPLACED by their sets' own makers (O-I #768, part two), and Technē's
 * (event_create on the temporal events projection) and Live's (live_clip_create on live-set) by their sets' own (part three): every mode
 * now makes its clip of a constellation, so none stands here. The table stays the door a mode without an owner op would use. */
export const CLIP_MAKERS_REFUSED: Readonly<Partial<Record<SurfMode, string>>> = {}

/** A maker that takes the drop and refuses it in `words`. */
export function refusingMaker(words: string): Maker {
  return {op: words, accepts: CONSTELLATION_DRAG, run: async (): Promise<WorldActionReceipt> => ({ok: false, error: words})}
}

/** The set with its tracks' maker. A set that already carries one keeps it. Pure. */
export function withClipMaker(set: WorldTrackSet, maker: Maker): WorldTrackSet {
  if (set.actions?.makeClip) return set
  return {...set, actions: {...set.actions, makeClip: maker}}
}

/** The maker each mode's tracks carry where its set brings none: a refusal in the words its owner's missing operation says. A table,
 * never a branch (frame/tracks/TracksPane.tsx applies it as it applies MODE_OWNERS). Every mode's set brings its own now. */
export const MODE_CLIP_MAKERS: Readonly<Partial<Record<SurfMode, Maker>>> = Object.fromEntries(
  Object.entries(CLIP_MAKERS_REFUSED).map(([mode, words]) => [mode, refusingMaker(words as string)]))
