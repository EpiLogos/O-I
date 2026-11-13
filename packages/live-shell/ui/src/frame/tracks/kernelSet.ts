// One mode's Set from the kernel (kernel mode_set.rs; docs/architecture/world-shell.md §9.2 layer 4; O-I #1004), as the one Session and
// Arrangement draw it. The kernel builds a mode's Set from the World Model's slices, as data: its rows, its tracks, its clips and the takes
// under them, its Main track, the ruler its instants lie on, and each act as an Action id. What the views call is derived from that data
// here, the same way for every mode — this module knows no mode:
// - the rows are the grid's rows, and the tracks and clips are as the Set holds them; a track the Set says holds nothing says why, in the
//   words of the slice it would have been read from;
// - instants lie on the ruler the Set names: `day`, the minutes (UTC) of one civil day; `clock`, seconds from its origin to now;
// - each take lies under its clip, and on a take lane of its track over the stretch it ran (one still running reaches now), and the take
//   that stands is the main lane's over its stretch;
// - each act runs its Action through the kernel's one write door (`act`, O-I #1002), its input the Set's with the person's value where
//   the act takes one; an Action in the shell's own namespace (`shell.`) is the shell's registered setter. An act the Set carries on some
//   clips or tracks and not on others refuses on the others in words; an act it carries on none waits, by the op its menu names, and a
//   constellation dropped on a track whose clip the Set cannot make yet (`clip.make`) is taken and refused in those words;
// - a Set whose Solo is the shell's attention (its `solo` act) follows what you attend to: only the attended tracks keep their clips and
//   lanes, and a Solo press asks no owner.
// Registered by modeTracks.ts as `kernelModeTracks(<mode>)`.
import {useMemo} from 'react'
import type {KernelOp, KernelTransportStatus, ModeSet, ModeSetAct, ModeSetName, ModeSetSpan} from '../../../../../../desktop/cradle/src/kernel/types'
import {actionData, kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {shellSetter} from '../../inhabitants/sdk/shellSetters'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {useModeSet} from '../../owners/modeSets'
import type {WorldActionReceipt, WorldMixer, WorldTakeLane, WorldTrack, WorldTrackActions, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {UseModeTracks} from './modeTracks'
import {refusingMaker} from './clipMakers'

const MINUTES_PER_DAY = 1440

/** How one act of the Set is run: its Action through the kernel's `act`, or the shell's own setter. */
export interface SetActRunner {
  /** One Action by its registry id, with its input and the project it runs under: the owner's data, or its words thrown. */
  act(action: string, input: Record<string, unknown>, project: string | undefined): Promise<unknown>
  /** The shell's registered setter for an id in its namespace, given the person's value: its receipt. */
  shell(action: string, value: unknown): Promise<WorldActionReceipt>
}

/** What you attend to (manual §16.1 Solo; §16.6 "Solo changes what you attend to, never what runs"): the tracks soloed, by their ids, as
 * the shell holds them on the book's world context (agent/AgentShellContext.tsx `soloed`), and the press that solos one or lifts it. */
export interface SetAttention {
  readonly soloed: ReadonlySet<string>
  solo(trackId: string, on: boolean): void
}

/** What the window adds to the Set it draws: now (the ruler draws no future), the shell's write arm as it stands, what you attend to,
 * and the runner. */
export interface KernelSetView {
  readonly nowMs: number
  readonly armOn?: boolean | null
  readonly attention?: SetAttention
  readonly runner?: SetActRunner
}

/** What a Solo press answers: what you attend to changed, and nothing else did. */
export const SOLO_ON = 'Soloed: the views, the tiles and the instruments show only what you solo. The others keep running.'
export const SOLO_OFF = 'Solo lifted: you attend to everything again; nothing stopped or started.'

/** The tracks you attend to with these soloed: a soloed track, the tracks beneath a soloed one, and the tracks above each of them, so a
 * soloed session keeps its group's head and a soloed group the sessions it holds. Null: you attend to everything — nothing is soloed, or
 * nothing soloed is a track of this Set. Pure. */
export function attendedOf(tracks: readonly {readonly id: string; readonly parent?: string}[], soloed: ReadonlySet<string>): ReadonlySet<string> | null {
  if (!soloed.size) return null
  const parentOf = new Map(tracks.map(track => [track.id, track.parent]))
  const attended = new Set<string>()
  for (const track of tracks) {
    const above: string[] = [], seen = new Set([track.id])
    for (let parent = parentOf.get(track.id); parent && parentOf.has(parent) && !seen.has(parent); parent = parentOf.get(parent)) { seen.add(parent); above.push(parent) }
    if (soloed.has(track.id) || above.some(ref => soloed.has(ref))) for (const ref of [track.id, ...above]) attended.add(ref)
  }
  return attended.size ? attended : null
}

/** The acts the views call on one clip, by their key in the Set (and in WorldTrackActions). */
const CLIP_ACTS = ['openFile', 'revealFile'] as const
/** The acts the views call on one track; `renameTrack` takes the name the person gives. */
const TRACK_ACTS = ['openFolder', 'revealFolder'] as const

const refused = (error: string): WorldActionReceipt => ({ok: false, error})
const clock = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

/** The Set's instants on its ruler: where an instant (unix ms) stands, and the ruler the views draw. A Set with no ruler lays its rows end
 * to end. Pure. */
function rulerOf(set: ModeSet, nowMs: number): {at: (ms: number) => number | undefined; ruler?: WorldTrackSet['ruler']} {
  const ruler = set.ruler
  if (ruler?.kind === 'day' && ruler.date && /^\d{4}-\d{2}-\d{2}$/.test(ruler.date)) {
    const date = ruler.date
    const start = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
    const at = (ms: number): number | undefined => !Number.isFinite(ms) || ms < start || ms >= start + 86_400_000 ? undefined
      : Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round((ms - start) / 60_000)))
    return {at, ruler: {unit: ruler.unit, label: point => `${date.slice(5)} ${clock(Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(point))))}`,
      instant: at, end: MINUTES_PER_DAY}}
  }
  if (ruler?.kind === 'clock') {
    // From the Set's earliest instant to now; a Set with no instant yet stands on the hour ending now.
    const origin = typeof ruler.origin_unix_ms === 'number' ? Math.min(ruler.origin_unix_ms, nowMs) : nowMs - 3_600_000
    const at = (ms: number): number | undefined => Number.isFinite(ms) ? Math.max(0, (Math.min(ms, nowMs) - origin) / 1000) : undefined
    const now = (nowMs - origin) / 1000
    return {at, ruler: {unit: ruler.unit, label: point => new Date(origin + point * 1000).toTimeString().slice(0, 8), end: now, now, instant: at,
      duration: span => `${Math.floor(span / 60)}m ${String(Math.floor(span % 60)).padStart(2, '0')}s`}}
  }
  return {at: () => undefined}
}

/** A span of the Set on the ruler: where it starts, and where it ends — an open one ends nowhere (a running clip's open edge). */
function spanOf(span: ModeSetSpan | undefined, at: (ms: number) => number | undefined): {start: number; end?: number} | undefined {
  if (!span) return undefined
  const start = at(span.start_unix_ms)
  if (start === undefined) return undefined
  const end = typeof span.end_unix_ms === 'number' ? at(span.end_unix_ms) : undefined
  return end === undefined ? {start} : {start, end: Math.max(start, end)}
}

/** An act's input with the person's value in the place the act takes it. */
const inputOf = (act: ModeSetAct, value?: unknown): Record<string, unknown> => {
  const input = act.input && typeof act.input === 'object' && !Array.isArray(act.input) ? {...act.input as Record<string, unknown>} : {}
  if (act.takes && value !== undefined) input[act.takes] = value
  return input
}

/** The act run: the shell's setter for its own namespace, else the Action through the kernel's `act`; its answer in the views' words. */
async function runAct(runner: SetActRunner | undefined, act: ModeSetAct, value?: unknown): Promise<WorldActionReceipt> {
  if (act.action.startsWith('shell.')) {
    if (!runner) return refused(`${act.action}: no shell setter reaches this pane.`)
    return runner.shell(act.action, value)
  }
  if (!runner) return refused(`${act.action}: no kernel carrier reaches this pane, so nothing was run.`)
  try {
    const answer = await runner.act(act.action, inputOf(act, value), act.project)
    // An owner that answers a write against a revision that moved says so in its answer, not as a refusal.
    if ((answer as {outcome?: unknown} | null)?.outcome === 'conflict') {
      return refused(`${act.action}: what it writes moved since the Set was read; the Set is read again, so press it again on what stands now.`)
    }
    return {ok: true, note: act.done ?? `${act.words.split(':')[0]} answered.`}
  } catch (cause) {
    return refused(cause instanceof Error ? cause.message : String(cause))
  }
}

/** The Set as the one Session and Arrangement draw it. Pure, apart from the acts it hands back to run. */
export function kernelSetTracks(set: ModeSet, view: KernelSetView): WorldTrackSet {
  const {at, ruler} = rulerOf(set, view.nowMs)
  const arm = set.acts.arm
  const armOn = arm && typeof view.armOn === 'boolean' ? view.armOn : undefined
  // Solo, where the Set carries it as the shell's attention and the window hands it: with any soloed, only what you attend to keeps its
  // clips and lanes; every track keeps its head and its mixer, so you can solo another or lift this one. Nothing stops.
  const attention = set.acts.solo && view.attention ? view.attention : undefined
  const attended = attention ? attendedOf(set.tracks, attention.soloed) : null
  const attends = (trackId: string) => !attended || attended.has(trackId)
  const tracks: WorldTrack[] = set.tracks.map(track => {
    const own = !track.main && !track.returns && !track.read_only
    const mix = {...(track.works_in ? {works: track.works_in} : {}), ...(armOn !== undefined && own ? {arm: armOn} : {}),
      ...(attention ? {solo: attention.soloed.has(track.id)} : {})}
    return {
      id: track.id,
      name: track.name,
      kind: track.absent ? `${track.kind} · ${track.absent}` : track.kind,
      ...(track.color ? {color: track.color} : {}),
      ...(track.depth ? {depth: track.depth} : {}),
      ...(track.parent ? {parentId: track.parent} : {}),
      ...(track.main ? {main: true as const} : {}),
      ...(track.returns ? {returns: true as const} : {}),
      ...(track.read_only ? {readOnly: true} : {}),
      ...(Object.keys(mix).length ? {mix} : {}),
    }
  })
  const takesOf = new Map<string, {id: string; name: string; standing?: boolean}[]>()
  for (const take of set.takes) {
    const list = takesOf.get(take.clip) ?? []
    list.push({id: take.id, name: take.name, ...(take.standing ? {standing: true} : {})})
    takesOf.set(take.clip, list)
  }
  const clips: WorldTrackClip[] = set.clips.filter(clip => attends(clip.track)).map(clip => {
    const place = spanOf(clip.at, at)
    return {
      id: clip.id,
      trackId: clip.track,
      columnId: clip.row,
      label: clip.label,
      ...(clip.status ? {status: clip.status} : {}),
      ...(clip.state ? {state: clip.state} : {}),
      ...(place ? {at: place} : {}),
      ...(clip.note ? {note: clip.note} : {}),
      ...(takesOf.has(clip.id) ? {takes: takesOf.get(clip.id)} : {}),
    }
  })
  // A take still running is open: its lane reaches the live edge. One its owner gave no place has its lane and no stretch on the ruler.
  const now = at(view.nowMs)
  const lanes: WorldTakeLane[] = set.takes.filter(take => attends(take.track)).map(take => {
    const place = spanOf(take.at, at)
    return {id: take.id, trackId: take.track, name: take.name,
      spans: place ? [{start: place.start, end: place.end ?? Math.max(place.start, now ?? place.start), label: take.words}] : [],
      ...(take.standing ? {standing: true} : {}), ...(take.run ? {of: {runRef: take.run, unitRef: take.unit ?? null}} : {})}
  })
  // The main lane shows which take each stretch came from: the one that stands, over its stretch.
  const comp = lanes.flatMap(lane => lane.standing && lane.spans.length ? [{trackId: lane.trackId, takeId: lane.id, start: lane.spans[0].start, end: lane.spans[0].end}] : [])
  const mixer: WorldMixer = Object.fromEntries(Object.entries(set.mixer).map(([control, said]) => [control, {
    meaning: said.meaning, ...(said.route ? {route: said.route} : {}), ...(said.grain ? {grain: said.grain} : {}),
    // The attention handed lifts Solo's words for its absence.
    ...(said.disabled && !(control === 'solo' && attention) ? {disabled: said.disabled} : {}),
  }]))
  return {
    columns: set.rows.map(row => ({id: row.id, name: row.name})),
    tracks,
    clips,
    ...(ruler ? {ruler} : {}),
    ...(Object.keys(mixer).length ? {mixer} : {}),
    ...(set.main ? {main: {name: set.main.name, chain: set.main.chain}} : {}),
    lanes: {...(lanes.length ? {takes: lanes} : {}), ...(comp.length ? {comp} : {}), absent: set.lanes_absent},
    actions: actionsOf(set, view.runner, attention),
  }
}

/** The views' acts over the Set's own clips and tracks, each its Action; what no act carries waits in the Set's words. Pure. */
function actionsOf(set: ModeSet, runner: SetActRunner | undefined, attention: SetAttention | undefined): WorldTrackActions {
  const actions: WorldTrackActions = {owner: set.owner, waiting: set.waiting}
  const clipsBy = new Map(set.clips.map(clip => [clip.id, clip]))
  const tracksBy = new Map(set.tracks.map(track => [track.id, track]))
  for (const key of CLIP_ACTS) {
    const first = set.clips.find(clip => clip.acts?.[key])?.acts?.[key]
    if (!first) continue
    actions[key] = {op: first.words, run: (clipId: string) => {
      const act = clipsBy.get(clipId)?.acts?.[key]
      return act ? runAct(runner, act) : refused(`"${clipId}" carries no ${first.action} here: ${clipsBy.has(clipId) ? 'its owner gives it none' : 'it is no clip of this Set'}.`)
    }}
  }
  for (const key of TRACK_ACTS) {
    const first = set.tracks.find(track => track.acts?.[key])?.acts?.[key]
    if (!first) continue
    actions[key] = {op: first.words, run: (trackId: string) => {
      const act = tracksBy.get(trackId)?.acts?.[key]
      return act ? runAct(runner, act) : refused(`"${trackId}" carries no ${first.action} here: ${tracksBy.has(trackId) ? 'its owner gives it none' : 'it is no track of this Set'}.`)
    }}
  }
  const rename = set.tracks.find(track => track.acts?.renameTrack)?.acts?.renameTrack
  if (rename) actions.renameTrack = {op: rename.words, run: (trackId: string, name: string) => {
    const track = tracksBy.get(trackId)
    const act = track?.acts?.renameTrack
    if (!act) return refused(track ? `${track.name} takes no name here: ${rename.action} names a project's world, on the revision its owner disclosed.` : `"${trackId}" is no track of this Set.`)
    if (!name.trim()) return refused('A name is text.')
    return runAct(runner, act, name.trim())
  }}
  const arm = set.acts.arm
  if (arm) actions.mixer = {arm: {op: arm.words, run: (_trackId: string, on: boolean) => runAct(runner, arm, on)}}
  // A Solo press changes what you attend to, on a track or a group: no owner is asked, and nothing stops or starts.
  const solo = set.acts.solo
  if (solo && attention) actions.mixer = {...actions.mixer, solo: {op: solo.words, run: (trackId: string, on: boolean) => {
    if (!tracksBy.has(trackId)) return refused(`"${trackId}" is no track of this Set.`)
    attention.solo(trackId, on)
    return {ok: true, note: on ? SOLO_ON : SOLO_OFF}
  }}}
  // A drop is never lost in silence: the Set's words for the clip it cannot make of a constellation yet.
  const making = set.waiting['clip.make']
  if (making) actions.makeClip = refusingMaker(`No owner operation carries it yet — missing op: clip.make (${set.owner}). It waits for ${making}.`)
  return actions
}

/** The runner over a kernel carrier: an Action by `act`, the person's own by the shell window's channel (bridge.ts byShellWindow); the
 * shell's setters as the shell registered them. */
export function setActRunner(transport: KernelTransportStatus): SetActRunner {
  return {
    async act(action, input, project) {
      if (transport.kind === 'unavailable') throw new Error(`The kernel carrier is unavailable, so ${action} was not run: ${transport.reason}`)
      const op: KernelOp = {op: 'act', action, input, ...(project ? {project} : {})}
      return actionData(await kernelOp(transport, op), action)
    },
    async shell(action, value) {
      const dispatch = shellSetter(action)
      if (!dispatch) return refused(`${action} is not registered in this session: the transport registers it, so the press reached no owner.`)
      // The setter's receipt (inhabitants/sdk/shellSetters.ts DispatchReceipt): fired with its note, or refused with its reason and the op.
      const receipt = await dispatch(value)
      return receipt.kind === 'fired' ? {ok: true, note: receipt.note}
        : refused(`${receipt.reason}${receipt.missingOp ? ` — missing op: ${receipt.missingOp}` : ''}`)
    },
  }
}

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}

/** A mode's tracks from its Set in the kernel: the views draw it once the kernel answers, and say why while it has not or cannot. */
export function kernelModeTracks(mode: ModeSetName): UseModeTracks {
  return reading => {
    const transport = reading.transport ?? NO_CARRIER
    const answer = useModeSet(transport, mode)
    const shell = useAgentShellOptional()
    const armOn = shell?.writeArm ?? null
    // What you attend to is the agent shell's, on the book's world context: a Set whose Solo is the shell's attention (its `solo` act,
    // Factory's) follows it.
    const soloed = shell?.soloed, setSolo = shell?.setSolo
    const attention = useMemo<SetAttention | undefined>(() => soloed && setSolo ? {soloed, solo: setSolo} : undefined, [soloed, setSolo])
    const runner = useMemo(() => setActRunner(transport), [transport])
    return useMemo(() => {
      if (answer.state === 'reading') return {waiting: 'This work\'s Set arrives when the kernel answers.'}
      if (answer.state === 'unavailable') return {waiting: `This work's Set is unread: ${answer.reason}`}
      const {set} = answer.answer
      if (set.absent && !set.tracks.length) return {waiting: set.absent}
      return kernelSetTracks(set, {nowMs: Date.now(), armOn, ...(attention ? {attention} : {}), runner})
    }, [answer, armOn, attention, runner])
  }
}
