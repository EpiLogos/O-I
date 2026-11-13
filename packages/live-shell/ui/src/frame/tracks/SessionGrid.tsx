// The Session's shared law and parts (parity D-25): the Session grid itself is the catalogue design's Full (inhabitants/catalogue/panels/
// dlw__session-grid.tsx SessionGridView, SessionGrid), drawn by the Session · Arrangement pane on its device. What stays here is what the
// grid and the Arrangement ruler both read: THE selection's shape, the tracks' tree and stalls, an owner's answer to a press, the track's
// colour and ink, the mixer row and levels, and the Main column's head and foot.
import {lazy, Suspense, type ReactNode} from 'react'
import type {WorldTrack, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {levelWord, type MixerCell} from './trackLanes'
import {CutIcon} from '../../agent/agentIcons'
import {type TrackHeadDevice} from './trackHeads'
import './tracks.css'

// The level box is the device plates' own (plateControls.tsx): it loads with the first row that draws a level, not with the frame
// (tests/first-load-budget.test.mjs counts what the frame fetches before it draws).
const OwnerValueBox = lazy(() => import('../devices/plateControls').then(module => ({default: module.OwnerValueBox})))

export interface TracksSelection {
  /** The selected ref (a clip's or a track's id), if it is in this set. */
  ref?: string
  select(target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}): void
}

export const STATUS_WORD: Record<string, string> = {waiting: 'Waiting', running: 'Running', stopped: 'Stopped', recording: 'Recording', stalled: 'Stalled', done: 'Done'}

/** The Main track's ref (Live's Main track: the stops column's head is a track you select, and the Device side then shows its chain).
 * One ref for every set: what a mode's Main track holds is its own detail's (shell/modeDetails.tsx), never a branch here. */
export const MAIN_TRACK_REF = 'main'

/** The Main track's head: a button that selects the Main track, as a track's head selects its track. */
export function MainHead({selection, title, children}: {selection: TracksSelection; title?: string; children: ReactNode}) {
  const selected = selection.ref === MAIN_TRACK_REF
  return <button type="button" className={`thd${selected ? ' sel' : ''}`} aria-pressed={selected} data-track-head="main"
    title={title ? `Main · ${title}` : 'Main · select the Main track: the Device side shows its chain'}
    onClick={() => selection.select({kind: 'track', ref: MAIN_TRACK_REF, title: 'Main'})}>{children}</button>
}

/** The head's button for the track's own device (trackHeads.ts; manual §18.1 "the track's Workspace device"): the press selects the track,
 * so the device reads the track it was opened from, then opens it full in a pane. */
export function TrackDeviceButton({device, track, selection}: {device: TrackHeadDevice | undefined; track: {id: string; name: string}; selection: TracksSelection}) {
  if (!device) return null
  return <button type="button" className="trk-device" aria-label={`Open ${track.name}'s ${device.title} in a pane`} title={device.does} data-track-device={track.id}
    onClick={event => { event.stopPropagation(); selection.select({kind: 'track', ref: track.id, title: track.name}); device.open() }}><CutIcon name="pane" size={10} /></button>
}

/** A track's colour as the views draw it: the one the set gives, else the shell's default. */
export const trackColour = (track: WorldTrack): string => track.color ?? 'var(--track-default, var(--bg-3))'

/** The ink that reads on a track's colour (O-I #747 round 886): the shell's dark ground on a light colour, its text colour on a dark one,
 * by the colour's relative luminance against the crossing of the two (WCAG contrast; ≥ 3 on every colour of Live's palette, tests/
 * session-states-colour-solo-level-886.test.mjs). The shell's default track colour is dark. A colour the shell cannot read (a token)
 * keeps the dark ink it always had (undefined: the CSS default). */
export function trackInk(colour: string | undefined): string | undefined {
  if (colour === undefined) return 'var(--text)'
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)?.[1]
  if (!hex) return undefined
  const [r, g, b] = [0, 2, 4].map(at => { const c = parseInt(hex.slice(at, at + 2), 16) / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
  return .2126 * r! + .7152 * g! + .0722 * b! > .18 ? 'var(--bg-0)' : 'var(--text)'
}

/** The tracks' parent links, walked: what each track sits under and what sits under it (`parentId`). */
export interface TrackTree {
  byId: ReadonlyMap<string, WorldTrack>
  /** Direct children by parent id, in the set's order; a track with none has no entry. */
  children: ReadonlyMap<string, readonly WorldTrack[]>
  /** The groups above a track, outermost first (agent/AgentSessionGrid.tsx:101-111). A parent the set does not hold, or a
   * cycle in the links, ends the walk. */
  ancestorsOf(track: WorldTrack): WorldTrack[]
  /** Everything beneath a track, nearest first; a cycle in the links is walked once. */
  descendantsOf(track: WorldTrack): WorldTrack[]
}

export function trackTree(tracks: readonly WorldTrack[]): TrackTree {
  const byId = new Map(tracks.map(track => [track.id, track]))
  const children = new Map<string, WorldTrack[]>()
  for (const track of tracks) {
    if (track.parentId === undefined || track.parentId === track.id || !byId.has(track.parentId)) continue
    const siblings = children.get(track.parentId)
    if (siblings) siblings.push(track)
    else children.set(track.parentId, [track])
  }
  const ancestorsOf = (track: WorldTrack): WorldTrack[] => {
    const out: WorldTrack[] = []
    const seen = new Set([track.id])
    let parent = track.parentId === undefined ? undefined : byId.get(track.parentId)
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      out.unshift(parent)
      parent = parent.parentId === undefined ? undefined : byId.get(parent.parentId)
    }
    return out
  }
  const descendantsOf = (track: WorldTrack): WorldTrack[] => {
    const out: WorldTrack[] = []
    const seen = new Set([track.id])
    const queue = [...(children.get(track.id) ?? [])]
    while (queue.length) {
      const next = queue.shift()!
      if (seen.has(next.id)) continue
      seen.add(next.id)
      out.push(next)
      queue.push(...(children.get(next.id) ?? []))
    }
    return out
  }
  return {byId, children, ancestorsOf, descendantsOf}
}

/** Which lanes have stalled. `own`: the lane says so (the track's flag, or one of its clips is stalled) — the Arrangement's
 * needle. `here`: those and every group above them — the Session's lit retry ("a lane in here has stalled",
 * agent/AgentSessionGrid.tsx:97-100). */
export function stalledLanes(set: WorldTrackSet, tree: TrackTree): {own: Set<string>; here: Set<string>} {
  const own = new Set<string>()
  for (const track of set.tracks) if (track.stalled === true) own.add(track.id)
  for (const clip of set.clips) if (clip.status === 'stalled' && tree.byId.has(clip.trackId)) own.add(clip.trackId)
  const here = new Set(own)
  for (const id of own) for (const above of tree.ancestorsOf(tree.byId.get(id)!)) here.add(above.id)
  return {own, here}
}

/** What the owner answered to a press, in its words. `waits`: the owner holds what was pressed until a boundary (a launch on its Quantize,
 * O-I #747 round 886), so the line follows the clip until it lands. */
export interface ActionReceipt {
  ok: boolean
  text: string
  waits?: boolean
}

/** The words of an owner's answer: `{ok, note}` or `{ok: false, error}` (agent/AgentShellRoot.tsx:29-32). Anything that is
 * not that shape says nothing, and nothing is made up for it. */
export function receiptOf(result: unknown): ActionReceipt | null {
  if (typeof result !== 'object' || result === null || typeof (result as {ok?: unknown}).ok !== 'boolean') return null
  const answer = result as {ok: boolean; note?: unknown; error?: unknown; waits?: unknown}
  const said = answer.ok ? answer.note : answer.error
  if (typeof said === 'string' && said) return {ok: answer.ok, text: said, ...(answer.ok && answer.waits === true ? {waits: true} : {})}
  return {ok: answer.ok, text: answer.ok ? 'The owner answered ok and gave no note.' : 'The owner refused and gave no reason.'}
}

/** Run an action and take its answer, whether it answers now or later; a throw or a rejection is a refusal, said as it was. */
export async function answerOf(run: () => unknown): Promise<ActionReceipt | null> {
  try {
    return receiptOf(await run())
  } catch (error) {
    return {ok: false, text: error instanceof Error ? error.message : String(error)}
  }
}

/** An answer, with the control it answers: `key` names the pressed element, `what` the press. `seen`: a held launch's clip has been read
 * waiting. */
export interface PressedReceipt extends ActionReceipt {
  key: string
  what: string
  seen?: boolean
  /** The set's own tracks it was pressed among (O-I #747 round 893): a line says the last act in that set. The Main track, which every
   * Expression's set shows (XS15), is no one set's and is not among them. */
  among?: readonly string[]
}

/** A press's answer as the views show it, with the set it was pressed in (round 893). */
export const pressedIn = (set: WorldTrackSet, key: string, what: string, answer: ActionReceipt): PressedReceipt =>
  ({key, what, ...answer, among: set.tracks.filter(track => !track.main).map(track => track.id)})

/** A held launch's line as the set moves on (O-I #747 round 886): while its clip waits it stands; when the clip runs it says that it
 * landed; when the clip, once seen waiting, neither waits nor runs (or is gone), it clears — it never keeps a stale "lands at". Before the
 * reading has caught up with the launch (not yet seen waiting) it stands. Any other line is the set's to leave alone. Returns the same
 * line when nothing changed. A line pressed in another set (none of the set's own tracks it was pressed among is shown: another Expression
 * opened, round 893; the Main track every set shows does not count) says nothing of what is shown, and clears. */
export function heldLaunchReceipt(receipt: PressedReceipt | null, set: WorldTrackSet): PressedReceipt | null {
  if (receipt?.among?.length && !set.tracks.some(track => !track.main && receipt.among!.includes(track.id))) return null
  if (!receipt?.waits || !receipt.key.startsWith('clip:')) return receipt
  const clip = set.clips.find(candidate => `clip:${candidate.id}` === receipt.key)
  if (!clip) return null
  if (clip.status === 'running') return {key: receipt.key, what: receipt.what, ok: true, text: `Landed on its Quantize: ${clip.label} plays.`, ...(receipt.among ? {among: receipt.among} : {})}
  if (clip.status === 'waiting') return receipt.seen ? receipt : {...receipt, seen: true}
  return receipt.seen ? null : receipt
}

export const receiptMark = (receipt: PressedReceipt | null, key: string): 'ok' | 'refused' | undefined =>
  receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined

/** A track's mixer row (manual §16.6), as Live draws it under the slots' head: the switches and the monitor on one line, the routes
 * on the next, then Volume and Pan. A control with no owner write stands disabled, its title naming the op it lacks; an unread value
 * is drawn unread. The Arrangement head draws the switches alone (`routes={false}`) and its levels on a line of their own (MixerLevels). */
export function MixerRow({cells, shown, routes: withRoutes = true, trackId, receipt, onPress}: {cells: readonly MixerCell[]; shown: boolean; routes?: boolean
  trackId: string; receipt: PressedReceipt | null; onPress(key: string, what: string, run: () => unknown): void}) {
  if (!shown) return null
  // A column with no row of its own (the Main column, a track read from another reading) keeps the row's height, so the slots align.
  if (!cells.length) return <div className="trk-mix" aria-hidden="true" />
  const io = (cell: MixerCell) => cell.id === 'input' || cell.id === 'output' || cell.id === 'works'
  const switches = cells.filter(cell => cell.state !== 'route' && !io(cell) && !cell.level)
  const routes = withRoutes ? cells.filter(io) : []
  return <div className={withRoutes ? 'trk-mix' : 'tl-mix'} role="group" aria-label="Mixer" data-mixer={trackId}>
    {switches.length > 0 && <div className="mx-row">{switches.map(cell => {
      const key = `mix:${cell.id}:${trackId}`
      const press = cell.press
      return <button key={cell.id} type="button" className={`mx mx-${cell.id}`} data-mix={cell.id} data-state={cell.state}
        aria-label={cell.label} aria-pressed={cell.state === 'on' ? true : cell.state === 'off' ? false : undefined} disabled={!press}
        data-receipt={receiptMark(receipt, key)} title={cell.title}
        onClick={() => { if (press) onPress(key, press.what, press.run) }}>{cell.id === 'arm' ? <CutIcon name="rec" size={9} /> : cell.text}</button>
    })}</div>}
    {routes.length > 0 && <div className="mx-io">{routes.map(cell => {
      const choose = cell.choose, key = `mix:${cell.id}:${trackId}`
      return <span key={cell.id} className={`mx-route mx-${cell.id}`} data-mix={cell.id} data-state={cell.state} title={cell.title}
        {...(choose ? {'data-receipt': receiptMark(receipt, key)} : {})}>
        <small>{cell.id === 'input' ? 'in' : cell.id === 'works' ? 'works in' : 'out'}</small>
        {choose ? <select className="mx-choose" aria-label={`${cell.label}: ${cell.text}`} value={choose.value ?? ''}
          onChange={event => { const to = event.currentTarget.value; if (to) onPress(key, choose.what(to), () => choose.run(to)) }}>
          {choose.value === null && <option value="">{cell.text}</option>}
          {choose.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select> : cell.text}</span>
    })}</div>}
    {withRoutes && <MixerLevels cells={cells} trackId={trackId} receipt={receipt} onPress={onPress} />}
  </div>
}

/** Volume and Pan (§21.1 "The mixer row"): a value box each over its owner, the value sent on release (plateControls.tsx). On the
 * Session row under the routes, in the Main column alone, and in the Arrangement head on a line under the name and switches. */
export function MixerLevels({cells, trackId, receipt, onPress}: {cells: readonly MixerCell[]; trackId: string; receipt: PressedReceipt | null
  onPress(key: string, what: string, run: () => unknown): void}) {
  const levels = cells.filter(cell => cell.level)
  if (!levels.length) return null
  return <div className="mx-lv">{levels.map(cell => {
    const level = cell.level!, set = level.set, key = `mix:${cell.key ?? cell.id}:${trackId}`
    return <span key={cell.key ?? cell.id} className={`mx-level mx-${cell.id}`} data-mix={cell.id} data-send={cell.send} data-state={cell.state} data-receipt={receiptMark(receipt, key)} title={cell.title}>
      <Suspense fallback={<span className="mx-level-wait">{cell.text}</span>}><OwnerValueBox label={cell.label} does={cell.title} value={level.value} def={0} format={v => levelWord(v, level.unit)}
        scale={{min: level.min, max: level.max, step: level.unit === 'dB' ? 0.1 : 0.02}}
        onCommit={set ? v => onPress(key, set.what(v), () => set.run(v)) : undefined}
        why={set ? undefined : cell.title} /></Suspense>
    </span>
  })}</div>
}

/** The Main column's status row (Live cap 35, 41): Stop All, and Back to Arrangement — lit when what plays differs from the ruler.
 * Each runs only through the set's owner op; without one it stands disabled and says so. */
export function MainFoot({set, receipt, onPress}: {set: WorldTrackSet; receipt: PressedReceipt | null; onPress(key: string, what: string, run: () => unknown): void}) {
  const stopAll = set.actions?.stopAll, back = set.actions?.backToArrangement
  const differs = set.main?.differs
  return <div className="trk-foot main-foot" role="group" aria-label="Main status">
    <button type="button" className="sa" aria-label="Stop All" disabled={!stopAll} data-receipt={receiptMark(receipt, 'stop-all')}
      title={stopAll ? `Stop All: every clip stops (${stopAll.op}). Pressed twice, it cancels at once.` : 'Stop All: the owner gives no op that stops every clip here'}
      onClick={() => { if (stopAll) onPress('stop-all', 'Stop All', () => stopAll.run()) }}><CutIcon name="stop" size={10} /></button>
    <button type="button" className={`ba${differs ? ' lit' : ''}`} aria-label="Back to Arrangement" disabled={!back} data-receipt={receiptMark(receipt, 'back')}
      data-differs={differs === undefined ? 'unread' : String(differs)}
      title={`Back to Arrangement${differs === undefined ? ' · the owner reports no play state to compare with the ruler' : differs ? ' · lit: what plays differs from the ruler' : ' · what plays is the ruler'}${back ? ` (${back.op})` : ' · the owner gives no op that plays the ruler again'}`}
      onClick={() => { if (back) onPress('back', 'Back to Arrangement', () => back.run()) }}><CutIcon name="arrangement" size={10} /></button>
  </div>
}

/** A running clip's progress in whole percent, from its owner's elapsed and expected length (`progress`; the design's `--p`), never past
 * 100: the fill reaches the reading and has no end drawn. Null where no reading gives it — a clip not running, no expected length, or a
 * value that is not a finite count — and nothing is estimated in its place. */
export function clipProgress(clip: Pick<WorldTrackClip, 'status' | 'progress'>): number | null {
  const read = clip.progress
  if (clip.status !== 'running' || !read) return null
  const {elapsed, expected} = read
  if (!Number.isFinite(elapsed) || !Number.isFinite(expected) || !(expected > 0) || elapsed < 0) return null
  return Math.min(100, Math.round(elapsed / expected * 100))
}

