// Session grid (manual §16.6): the shell's own Session view as an instrument that opens in a pane. Live's nearest: the Session view's
// clip grid (a clip launcher with its scene launchers) — here the tracks are the mode's, the clips are its material, and a row is a stop.
// The picture is the grid itself, drawn by the grid's own law (frame/tracks/SessionGrid.tsx): a clip stands in its track's column and its
// row; a clip shows its state (waiting, running with no end, stopped, recording, stalled, done); a group folds its members, and in each row
// where it has no clip of its own it rolls its members' clips up, folded or open, as the shell does (SessionGrid.tsx: "A group with no clip
// of its own in this row rolls up its members'"); a member steps in behind one rail per ancestor, each in that ancestor's colour and the
// track's whole height (tracks.css .rails); a stalled lane lights its retry; the Main column holds the row launchers. The fixture is Factory's own mockup grid
// (desktop/cradle/docs/world-shell/agent-shell-mockup.html:470-478), because Factory is the mode whose owner reports clip states.
// The grid draws from its keys (parity D-25): `tracks` (JSON [{id, name, short, c, parent?, group?}], in the set's order), `clips` (JSON
// [{track, row, label, status, p?, takes?}], rows counted from 1) and `rows` (how many stops the set has); the mockup's grid is its defaults.
//
// The Session itself (moved here from frame/tracks/SessionGrid.tsx with every behaviour it had, parity D-25):
// The one Session view (manual §3, FOUNDATION F3): "the grid: tracks across, rows down, everything launchable, nothing in
// any fixed order." Every mode's tracks arrive through its adapter as one WorldTrackSet; this grid knows no mode. A clip
// shows its state (waiting, running, stopped, recording, stalled); a row's stop launches it whole; a track's square stops
// it. Launch, stop, retry and record run only through the set's actions port, so a set whose owner gives none stays
// read-only and says so; what an owner answers to a press is shown where it was pressed. Everything else comes from the
// set's data: a track under another (`parentId`) folds under it and steps in behind a rail per ancestor, a group's cells
// roll up its members' clips, a stalled lane lights its retry. Craft floor: world-shell-mockup.html `sessView` and
// `.sg/.trk/.cs`, agent-shell-mockup.html `.trk.grp/.cs.grp/.stoprow`; ported from agent/AgentSessionGrid.tsx.
// From the World cut presentation it replaced (git 09a573a1d:.../projections/worldTimelinePresentation.tsx): each clip carries
// its standing mark (trackMarks.ts), and the rows nest under the sections they stand in, each head in its section's atmosphere
// and folding as a group folds (trackSections.ts). A track the set marks read-only (one merged in from another reading, the
// spine's cron firings) is offered none of the set's actions.
// R3 (manual §16.6; lock §0.3 item 3): under each head the track's mixer row after Live's — activator, solo, arm, monitor In · Auto
// · Off, input and output — with what each means in the mode (trackLanes.ts mixerCells); a track flagged `main` is the Main
// track's own material and stands in the Main column at the end, which carries each row's launcher, Stop All and Back to
// Arrangement (lit when what plays differs from the ruler); an armed track's empty slots are record buttons (Live cap 35).
import {useContext, useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent} from 'react'
import {subscribeUndo} from '../../../frame/menu/undo'
import type {WorldTrack, WorldTrackActions, WorldTrackClip, WorldTrackColumn, WorldTrackSection, WorldTrackSet} from '../../../timeline/worldTrackAdapter'
import {clipStandingAttributes, clipStandingEdge, clipStandingMark, clipStandingTag, clipStandingTitle} from '../../../frame/tracks/trackMarks'
import {sectionFoldKey, sessionRowLayout, shownRowLayout} from '../../../frame/tracks/trackSections'
import {mixerCells} from '../../../frame/tracks/trackLanes'
import {CutIcon} from '../../../agent/agentIcons'
import {useTracksMenu} from '../../../frame/menu/TracksMenu'
import {trackHeadDevice, useTrackHeadDevices} from '../../../frame/tracks/trackHeads'
import {chooseTrack, usePartChoice} from '../../../frame/tracks/partChoice'
import {TracksMaterial} from '../../../frame/tracks/tracksDoor'
import {answerOf, clipProgress, heldLaunchReceipt, MainFoot, MainHead, MixerRow, pressedIn, receiptMark, stalledLanes, TrackDeviceButton, trackColour, trackInk, trackTree,
  type PressedReceipt, type TracksSelection} from '../../../frame/tracks/SessionGrid'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {clampTo, on, st, str, type DesignedDevice, type ViewProps, type Values} from './design'
import './dlw__session-grid.css'

type Status = 'waiting' | 'running' | 'stopped' | 'recording' | 'stalled' | 'done'
const STATUS_WORD: Record<Status, string> = {waiting: 'Waiting', running: 'Running', stopped: 'Stopped', recording: 'Recording', stalled: 'Stalled', done: 'Done'}

interface Track {id: string; name: string; short: string; c: string; parent?: string; group?: boolean}
/** A clip's state, where its owner discloses one (absent: drawn as a plain clip, in full colour, as the shell's grid draws it). */
interface Clip {track: string; row: number; label: string; status?: Status; p?: number; takes?: number}

/** The agency tracks of the mockup: a crew under a group, one level deeper under the test lane, and three lanes of their own. */
const MOCK_TRACKS: readonly Track[] = [
  {id: 'g1', name: 'Port bridge-2', short: 'Port', c: '#5cc6b4', group: true},
  {id: 'lead', name: 'Fizz · lead', short: 'Lead', c: '#5cc6b4', parent: 'g1'},
  {id: 'explore', name: 'explore', short: 'Explore', c: '#8fbfb6', parent: 'g1'},
  {id: 'test', name: 'test', short: 'Test', c: '#8fbfb6', parent: 'g1', group: true},
  {id: 'fixture', name: 'fixture-gen', short: 'Fixture', c: '#a8c9c2', parent: 'test'},
  {id: 'honey', name: 'Capture pass', short: 'Capture', c: '#e2a35e'},
  {id: 'bumble', name: 'Review #482', short: 'Review', c: '#d985a6'},
]
/** The tasks of the mockup (rows are batches 1 to 4; the fourth is the empty soft-stop row). Takes are fixture readings. */
const MOCK_CLIPS: readonly Clip[] = [
  {track: 'lead', row: 1, label: 're-plan port', status: 'done'},
  {track: 'lead', row: 2, label: 'map field → plan', status: 'running', p: 55, takes: 2},
  {track: 'lead', row: 3, label: 'drop old captures', status: 'waiting'},
  {track: 'explore', row: 2, label: 'survey widget tree', status: 'done'},
  {track: 'test', row: 2, label: 'widget tests --all', status: 'running', p: 64},
  {track: 'fixture', row: 2, label: 'generate fixtures', status: 'stalled'},
  {track: 'honey', row: 1, label: 'tune physics', status: 'done'},
  {track: 'honey', row: 2, label: 'capture pass', status: 'stopped'},
  {track: 'bumble', row: 1, label: 'review #482', status: 'done'},
  {track: 'bumble', row: 3, label: 'review port plan', status: 'stopped'},
]
const MOCK_ROWS = 4

const clipKey = (c: {track: string; row: number}) => `${c.track}:${c.row}`

/** The set the grid draws, read from its keys, with the grid's law over it. A key with no reading draws no track, no clip, no stop. */
interface Law {
  readonly TRACKS: readonly Track[]; readonly CLIPS: readonly Clip[]; readonly ROWS: number; readonly GROUPS: readonly Track[]
  clipAt(track: string, row: number): Clip | undefined
  ancestors(t: Track): Track[]
  descendants(t: Track): Track[]
}
const listOf = <T,>(raw: unknown): readonly T[] => {
  if (typeof raw !== 'string') return []
  try { const out: unknown = JSON.parse(raw); return Array.isArray(out) ? out as T[] : [] } catch { return [] }
}
const laws = new Map<string, Law>()
function lawOf(v: Values): Law {
  const rows = Number(v.rows), ROWS = Number.isInteger(rows) && rows > 0 ? rows : 0
  const memo = `${String(v.tracks)}\u0000${String(v.clips)}\u0000${ROWS}`
  const known = laws.get(memo)
  if (known) return known
  const TRACKS = listOf<Track>(v.tracks), CLIPS = listOf<Clip>(v.clips)
  const byId = (id: string) => TRACKS.find(t => t.id === id)
  const ancestors = (t: Track): Track[] => {
    const out: Track[] = []
    for (let up = t.parent ? byId(t.parent) : undefined; up && !out.includes(up); up = up.parent ? byId(up.parent) : undefined) out.unshift(up)
    return out
  }
  const law: Law = {TRACKS, CLIPS, ROWS, GROUPS: TRACKS.filter(t => t.group),
    clipAt: (track, row) => CLIPS.find(c => c.track === track && c.row === row), ancestors,
    descendants: t => TRACKS.filter(x => ancestors(x).some(a => a.id === t.id))}
  if (laws.size > 64) laws.clear()
  laws.set(memo, law)
  return law
}

const shown = (v: Values, t: Track) => v[`show:${t.id}`] !== false
const folded = (v: Values, t: Track) => v[`fold:${t.id}`] === true
const hiddenByFold = (v: Values, t: Track) => lawOf(v).ancestors(t).find(a => folded(v, a))
/** The tracks the grid draws: requested, and not folded away under a group. */
const visible = (v: Values) => lawOf(v).TRACKS.filter(t => shown(v, t) && !hiddenByFold(v, t))
const soloed = (v: Values) => lawOf(v).TRACKS.filter(t => on(v, `solo:${t.id}`))
/** With a solo on, you attend to the soloed tracks alone (and what they contain or sit in): the others keep running, out of view (§16.1, §16.6). */
const active = (v: Values, t: Track) => {
  const s = soloed(v), {ancestors} = lawOf(v)
  return s.length === 0 || s.some(x => x.id === t.id || ancestors(x).some(a => a.id === t.id) || ancestors(t).some(a => a.id === x.id))
}
/** Lanes that have stalled, and every group above them: the Session lights a retry on each. */
const stalledHere = (v: Values) => {
  const {CLIPS, TRACKS, ancestors} = lawOf(v)
  const own = CLIPS.filter(c => c.status === 'stalled').flatMap(c => TRACKS.filter(t => t.id === c.track))
  return new Set(own.flatMap(t => [t.id, ...ancestors(t).map(a => a.id)]))
}
const count = (v: Values, s: Status) => lawOf(v).CLIPS.filter(c => c.status === s).length

const FOLLOWS = ['none', 'next', 'first', 'stop'] as const
type Follow = (typeof FOLLOWS)[number]
const FOLLOW_WORD: Record<Follow, string> = {none: 'None', next: 'Next', first: 'First', stop: 'Stop'}
const MODES = ['once', 'hold', 'loop'] as const
type LaunchMode = (typeof MODES)[number]
const MODE_OPTIONS: readonly Option<LaunchMode>[] = [
  {value: 'once', label: 'Once', does: 'The clip plays once, then stops.'},
  {value: 'hold', label: 'Hold', does: 'The clip plays while you hold the launch.'},
  {value: 'loop', label: 'Loop', does: 'The clip plays again until you stop it.'},
]

/** Launch quantize in the owner's words. Factory arms now · next tool · next turn (agent/AgentShellContext.tsx:29); a mode with a beat
 * grid says the bar and the step. */
const QUANT: Record<string, readonly Option<string>[]> = {
  factory: [{value: 'now', label: 'Now', does: 'A launch lands at once.'}, {value: 'tool', label: 'Tool', does: 'A launch lands after the current tool call.'},
    {value: 'turn', label: 'Turn', does: 'A launch lands after the current turn.'}],
  other: [{value: 'now', label: 'Now', does: 'A launch lands at once.'}, {value: 'bar', label: 'Bar', does: 'A launch lands at the next bar.'},
    {value: 'step', label: 'Step', does: 'A launch lands after the current step.'}],
}
const quantOptions = (v: Values) => QUANT[str(v, 'mode')] ?? QUANT.other!
/** The launch quantize the owner reads; none while it reads none (the corner and the bar say so, never a default). */
const quantOf = (v: Values) => { const q = str(v, 'quantize'); return quantOptions(v).find(o => o.value === q) }
const quantWord = (v: Values) => quantOf(v)?.label.toLowerCase() ?? '—'

const selKey = (v: Values) => str(v, 'sel')
const selClip = (v: Values) => lawOf(v).CLIPS.find(c => clipKey(c) === selKey(v))
const followOf = (v: Values, key: string): Follow => { const x = v[`follow:${key}`]; return FOLLOWS.includes(x as Follow) ? x as Follow : 'none' }
const launchOf = (v: Values, key: string): LaunchMode => { const x = v[`launch:${key}`]; return MODES.includes(x as LaunchMode) ? x as LaunchMode : 'once' }
const light = (v: Values) => str(v, 'light') as LightState

// ---------------------------------------------------------------- the picture

interface Geo {w: number; h: number; headY: number; rowH: number; caption: boolean}
const COMPACT: Geo = {w: 140, h: 146, headY: 19, rowH: 21, caption: true}
const WHOLE: Geo = {w: 194, h: 146, headY: 19, rowH: 21, caption: true}
const WIDGET: Geo = {w: 150, h: 104, headY: 5, rowH: 17, caption: false}

/** A press target in the well: a clip to select, a header to arm or fold. Keyboard Enter and Space press it. */
const hit = (act: (() => void) | undefined, said: string) => ({
  className: act ? 'sgd-hit' : undefined, role: act ? 'button' : undefined, tabIndex: act ? 0 : -1, 'data-i': said, onClick: act,
  onKeyDown: act ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } } : undefined,
})

/** The grid by the grid's law: tracks across, stops down, the Main column of row launchers at the end. */
function Grid({v, set, geo, uid, handle}: {v: Values; set?: ViewProps['set']; geo: Geo; uid: string; handle?: boolean}) {
  const {ROWS, clipAt, descendants, CLIPS} = lawOf(v)
  const cols = visible(v), n = cols.length + 1, gap = 2
  const cw = Math.min(26, (geo.w - 12 - gap * (n - 1)) / n), x0 = (geo.w - (n * cw + gap * (n - 1))) / 2
  const colX = (i: number) => x0 + i * (cw + gap)
  const rowY0 = geo.headY + 14, rowY = (r: number) => rowY0 + r * geo.rowH, footY = rowY(ROWS) + 3
  const here = stalledHere(v), armed = str(v, 'armed'), sel = selKey(v), takesShown = on(v, 'takes'), keys = on(v, 'rowKeys')
  const chosen = selClip(v), at = chosen ? cols.findIndex(t => t.id === chosen.track) : -1
  const follow = chosen ? followOf(v, sel) : 'none'
  const cellH = geo.rowH - 3
  // The follow handle: it rests on the selected clip, and moves up to the first clip, down to the next, or to the track's stop.
  const cx = at >= 0 ? colX(at) + cw / 2 : 0, rowCy = (r: number) => rowY(r) + cellH / 2
  const spots: Record<Follow, number> = chosen
    ? {first: rowCy(0), none: rowCy(chosen.row - 1), next: rowCy(Math.min(chosen.row, ROWS - 1)), stop: footY + 3}
    : {first: 0, none: 0, next: 0, stop: 0}
  const nearest = (y: number): Follow => FOLLOWS.reduce((best, f) => (Math.abs(spots[f] - y) < Math.abs(spots[best] - y) ? f : best), 'none' as Follow)
  const caption = chosen ? `${chosen.label} · ${(chosen.status ? STATUS_WORD[chosen.status] : 'no state').toLowerCase()}` : 'No clip selected'
  return <g>
    <defs>
      <pattern id={`${uid}-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="var(--stall)" opacity=".75" /></pattern>
    </defs>
    {cols.map((t, i) => {
      const x = colX(i), silent = !active(v, t), isFolded = folded(v, t)
      const press = set && (t.group ? () => set(`fold:${t.id}`, !isFolded) : () => set('armed', armed === t.id ? 'none' : t.id))
      return <g key={t.id} opacity={silent ? 0.3 : 1}>
        <g {...hit(press, `${t.name}|${t.group ? 'Press to fold or unfold the group.' : 'Press to arm the track.'}`)}>
          <rect x={x} y={geo.headY} width={cw} height={10} fill={t.c} />
          {t.group && <polygon points={isFolded ? `${x + 3},${geo.headY + 2} ${x + 3},${geo.headY + 8} ${x + 7.5},${geo.headY + 5}` : `${x + 2},${geo.headY + 3} ${x + 8},${geo.headY + 3} ${x + 5},${geo.headY + 7.5}`} fill="var(--dp-well)" />}
          {armed === t.id && <circle cx={x + cw / 2} cy={geo.headY + 5} r={2.4} fill="var(--rec)" stroke="var(--dp-well)" strokeWidth={0.8} />}
        </g>
        {Array.from({length: ROWS}, (_, r) => {
          const y = rowY(r), clip = clipAt(t.id, r + 1)
          if (clip) {
            const k = clipKey(clip), isSel = k === sel, p = (clip.p ?? 50) / 100
            return <g key={r} {...hit(set && (() => set('sel', k)), `${clip.label}|${clip.status ? STATUS_WORD[clip.status] : 'No state'}. Press to select the clip.`)}>
              {clip.status === 'waiting'
                ? <rect x={x + 0.5} y={y + 0.5} width={cw - 1} height={cellH - 1} style={{fill: `color-mix(in srgb, ${t.c} 30%, var(--dp-well))`}} stroke={t.c} strokeDasharray="2 1.6" />
                : <rect x={x} y={y} width={cw} height={cellH} fill={t.c} opacity={clip.status === 'done' ? 0.5 : clip.status === 'running' ? 0.4 : 1} />}
              {clip.status === 'running' && <rect x={x} y={y} width={cw * p} height={cellH} fill={t.c} />}
              {clip.status === 'stalled' && <rect x={x} y={y} width={cw} height={cellH} fill={`url(#${uid}-stripe)`} />}
              {clip.status === 'recording' && <rect x={x} y={y} width={2.5} height={cellH} fill="var(--rec)" />}
              {isSel && <rect x={x + 0.6} y={y + 0.6} width={cw - 1.2} height={cellH - 1.2} fill="none" stroke="var(--accent)" strokeWidth={1.2} />}
              {isSel && launchOf(v, k) !== 'once' && <text x={x + 2} y={y + 8} className="dp-axis" style={{fill: 'var(--dp-well)', fontSize: 8}}>{launchOf(v, k) === 'loop' ? '↻' : '‖'}</text>}
              {clip.takes && (takesShown
                ? Array.from({length: clip.takes}, (_, j) => <rect key={j} x={x + cw - 2 - (clip.takes! - j) * 3} y={y + cellH - 4} width={2} height={3} fill={j === clip.takes! - 1 ? 'var(--accent)' : 'var(--dp-well)'} />)
                : <rect x={x + cw - 4} y={y + 1} width={3} height={3} fill="var(--dp-well)" />)}
            </g>
          }
          const rolled = t.group ? descendants(t).flatMap(m => { const c = clipAt(m.id, r + 1); return c ? [{c, m}] : [] }) : []
          if (rolled.length) {
            const sw = (cw - 2) / rolled.length
            return <g key={r}>
              <rect x={x} y={y} width={cw} height={cellH} fill="var(--dp-well)" />
              {rolled.map(({c, m}, j) => <rect key={c.track} x={x + 1 + j * sw} y={y + 2} width={Math.max(1, sw - 1)} height={cellH - 4}
                fill={c.status === 'stalled' ? 'var(--stall)' : c.status === 'waiting' ? 'none' : m.c} stroke={c.status === 'waiting' ? m.c : 'none'} strokeDasharray="1.5 1.2" opacity={c.status === 'done' ? 0.45 : 1} />)}
            </g>
          }
          return <rect key={r} x={x + cw / 2 - 2} y={y + cellH / 2 - 2} width={4} height={4} className="dp-faint" />
        })}
        {(() => {
          const lit = here.has(t.id), stalled = lit ? CLIPS.find(c => c.status === 'stalled' && (c.track === t.id || descendants(t).some(d => d.id === c.track))) : undefined
          return <g {...hit(set && stalled ? () => set('sel', clipKey(stalled)) : undefined, `Retry|${stalled ? 'A lane in here has stalled. Press to select its stalled clip.' : 'No lane in here has stalled.'}`)}>
            <rect x={x} y={footY - 2} width={cw} height={10} fill="transparent" />
            <rect x={x + cw / 2 - 4} y={footY} width={8} height={6} fill={lit ? 'var(--stall)' : 'none'} className={lit ? undefined : 'dp-faint'} />
          </g>
        })()}
      </g>
    })}
    {/* the Main column: the header, and a launcher for each row */}
    <rect x={colX(cols.length)} y={geo.headY} width={cw} height={10} fill="var(--bg-3)" />
    {Array.from({length: ROWS}, (_, r) => {
      const x = colX(cols.length), y = rowY(r)
      return <g key={r} data-i={`Row ${r + 1}|Launches every clip in the row.${keys ? ` Press ${r + 1}.` : ''}`}>
        <rect x={x} y={y} width={cw} height={cellH} className="dp-faint" />
        <polygon points={`${x + 3},${y + cellH / 2 - 3} ${x + 3},${y + cellH / 2 + 3} ${x + 8},${y + cellH / 2}`} fill="var(--text-dim)" />
        {keys && cw >= 14 && <text x={x + cw - 3} y={y + cellH / 2 + 3} className="dp-axis" textAnchor="end">{r + 1}</text>}
      </g>
    })}
    {/* the follow arrow and its handle */}
    {chosen && at >= 0 && follow !== 'none' && <g>
      <line x1={cx} y1={spots.none} x2={cx} y2={spots[follow] + (spots[follow] > spots.none ? -3 : 3)} className="dp-curve-on" />
      <polygon points={spots[follow] > spots.none ? `${cx - 3},${spots[follow] - 5} ${cx + 3},${spots[follow] - 5} ${cx},${spots[follow] - 1}` : `${cx - 3},${spots[follow] + 5} ${cx + 3},${spots[follow] + 5} ${cx},${spots[follow] + 1}`} fill="var(--dp-on)" />
    </g>}
    {handle && set && chosen && at >= 0 && <Handle x={cx} y={spots[follow]} n={1} label="Follow action" shape="ring"
      does="Drag along the track: up for First, down for Next, to the foot for Stop. Rest on the clip for None."
      onDrag={(_x, y) => set(`follow:${sel}`, nearest(clampTo(spots.first - 4, spots.stop + 4, y)))} onReset={() => set(`follow:${sel}`, undefined)} />}
    {geo.caption && <text x={6} y={geo.h - 5} className="dp-ink-dim">{caption.length > (geo.w > 160 ? 40 : 28) ? `${caption.slice(0, geo.w > 160 ? 39 : 27)}…` : caption}</text>}
  </g>
}

// ---------------------------------------------------------------- the pane: the Session itself

/** The set the keys carry, as the grid's law reads a set: the gallery's and any place's that draws the design with no live set (a set
 * with no actions, so the grid stands read-only and says so). Pure. */
export function setOfKeys(v: Values): WorldTrackSet {
  const {TRACKS, CLIPS, ROWS} = lawOf(v)
  const columns = Array.from({length: ROWS}, (_, r) => ({id: `row:${r + 1}`, name: String(r + 1)}))
  return {columns,
    tracks: TRACKS.map(t => ({id: t.id, name: t.name, kind: 'track', color: t.c, ...(t.parent ? {parentId: t.parent} : {}),
      ...(str(v, 'armed') === t.id || v[`solo:${t.id}`] !== undefined ? {mix: {...(str(v, 'armed') === t.id ? {arm: true} : {}), ...(v[`solo:${t.id}`] !== undefined ? {solo: on(v, `solo:${t.id}`)} : {})}} : {})})),
    clips: CLIPS.map(c => {
      const key = clipKey(c), follow = v[`follow:${key}`], mode = v[`launch:${key}`], quantize = key === selKey(v) ? quantOf(v)?.label.toLowerCase() : undefined
      const launch = {...(typeof follow === 'string' ? {follow} : {}), ...(typeof mode === 'string' ? {mode} : {}), ...(quantize ? {quantize} : {})}
      return {id: key, trackId: c.track, columnId: `row:${c.row}`, label: c.label, ...(c.status ? {status: c.status} : {}),
        ...(c.p !== undefined && c.status === 'running' ? {progress: {elapsed: c.p, expected: 100}} : {}),
        ...(c.takes ? {takes: Array.from({length: c.takes}, (_, j) => ({id: `${key}:take:${j + 1}`, name: `Take ${j + 1}`, ...(j === c.takes! - 1 ? {standing: true} : {})}))} : {}),
        ...(Object.keys(launch).length ? {launch} : {})}
    })}
}

/** The Session the pane draws: the live set the pane hands its device (frame/tracks/tracksDoor.ts TracksMaterial), else the set the keys
 * carry. Which groups fold is the view's own (`fold:*`), so the grid, the Whole's Groups and the picture fold together. */
function SessionFull({p}: {p: ViewProps}) {
  const material = useContext(TracksMaterial)
  const set = material?.set ?? setOfKeys(p.v)
  const selection: TracksSelection = material?.selection ?? {ref: selKey(p.v), select: target => { if (target.kind === 'clip') p.set('sel', target.ref) }}
  const folded = Object.fromEntries(set.tracks.map(track => [track.id, p.v[`fold:${track.id}`] === true]))
  return <SessionGrid set={set} selection={selection} empty={material?.empty} folded={folded} onFold={id => p.set(`fold:${id}`, !folded[id])} />
}

// ---------------------------------------------------------------- the grid's law, moved from frame/tracks/SessionGrid.tsx (parity D-25)

export interface SessionGridViewProps {
  set: WorldTrackSet
  selection: TracksSelection
  /** The groups folded shut, by track id. */
  folded: Readonly<Record<string, boolean>>
  onFold(trackId: string): void
  receipt: PressedReceipt | null
  /** An action pressed: `key` names the control, `what` the press, `run` calls the owner. */
  onPress(key: string, what: string, run: () => unknown): void
  onDismiss(): void
  /** Why there are no tracks yet, said where they will stand. */
  empty?: string
  /** The object menu's handlers on the view (frame/menu/TracksMenu.tsx): its root, the right button and the menu key. */
  menu?: {rootRef: (element: HTMLDivElement | null) => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void; onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void}
  /** The parts chosen with THE selection (O9, partChoice.ts), each drawn as chosen on its head; absent, THE selection alone. */
  chosen?: readonly string[]
}

/** A section's rails: one per section it sits under and its own, each in that section's atmosphere, else the strong line. */
const sectionRails = (chain: readonly WorldTrackSection[]) => chain.length > 0 &&
  <span className="rails" aria-hidden="true">{chain.map(section => <i key={section.id} style={{background: section.atmosphere ?? 'var(--line-strong)'}} />)}</span>

/** What a click on an empty slot chooses (the walk of O-I 857: Live's click on an empty slot selects it): the slot as THE selection names
 * it, on its track, where the set's slots are places of their own (`slotRef`); null where they are not. Pure. */
export function emptySlotChoice(set: Pick<WorldTrackSet, 'slotRef'>, track: {readonly id: string; readonly name: string}, row: {readonly id: string; readonly name: string}) {
  const ref = set.slotRef?.(track.id, row.id)
  return ref ? {kind: 'clip' as const, ref, title: `${track.name} · slot ${row.name}`, track: track.id} : null
}

/** The stops an empty Session shows, as a new Live set does. */
const EMPTY_STOPS: readonly WorldTrackColumn[] = Array.from({length: 8}, (_, i) => ({id: `empty:${i}`, name: String(i + 1)}))

/** The launches held down now, by the press's key: a Gate's press stays held across the renders its own receipt causes. */
const HELD_LAUNCHES = new Set<string>()

/** A control's own grain as its label says it: undefined leaves the set's (`setGrain`, already in its brackets), null says none (the one
 * clip pressed), a word says that. Each clip's ▶ reads its own grain so, as Stop reads `trackStop.grain` (O-I 804 BD round 25). */
const ownGrain = (own: string | null | undefined, setGrain: string): string => (own === undefined ? setGrain : own ? ` (${own})` : '')
const LAUNCH_KEYS = new Set([' ', 'Enter'])
type Press = {stopPropagation(): void; preventDefault?(): void}
type PointerPress = Press & {button?: number; pointerId?: number; currentTarget?: {setPointerCapture?(id: number): void}}
type KeyPress = Press & {key: string; repeat?: boolean}

/** How a clip's launch button takes a press (manual §19.1 The Launch panel). A clip whose launch mode is Gate — "runs it only while you
 * hold the launch" — launches when the pointer or key goes down and is released (the family's `release`) when it comes up; every other
 * clip launches on a click, as it always did (Toggle's second press and Repeat's takes are the family's own launch). Pure, apart from
 * the held set. */
export function clipLaunchPress(clip: Pick<WorldTrackClip, 'id' | 'label' | 'launch'>, launch: WorldTrackActions['launch'],
  onPress: (key: string, what: string, run: () => unknown) => void, key: string) {
  if (!launch) return {}
  const press = () => onPress(key, `Launch ${clip.label}`, () => launch.run(clip.id))
  const release = launch.release
  if (clip.launch?.mode !== 'gate' || !release) return {onClick: (event: Press) => { event.stopPropagation(); press() }}
  const down = () => { if (HELD_LAUNCHES.has(key)) return; HELD_LAUNCHES.add(key); press() }
  const up = () => { if (!HELD_LAUNCHES.delete(key)) return; onPress(key, `Release ${clip.label}`, () => release(clip.id)) }
  return {
    // The pointer did the work; the click its release makes is not a second launch.
    onClick: (event: Press) => { event.stopPropagation() },
    onPointerDown: (event: PointerPress) => {
      if (event.button !== undefined && event.button !== 0) return
      event.stopPropagation()
      if (event.pointerId !== undefined) event.currentTarget?.setPointerCapture?.(event.pointerId)
      down()
    },
    onPointerUp: (event: Press) => { event.stopPropagation(); up() },
    onPointerCancel: (event: Press) => { event.stopPropagation(); up() },
    onKeyDown: (event: KeyPress) => {
      if (!LAUNCH_KEYS.has(event.key)) return
      event.preventDefault?.(); event.stopPropagation()
      if (!event.repeat) down()
    },
    onKeyUp: (event: KeyPress) => {
      if (!LAUNCH_KEYS.has(event.key)) return
      event.preventDefault?.(); event.stopPropagation(); up()
    },
  }
}

export function SessionGridView({set, selection, folded, onFold, receipt, onPress, onDismiss, empty, menu, chosen = []}: SessionGridViewProps) {
  const hands = menu ? {ref: menu.rootRef, onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown} : {}
  const rows = set.columns
  const inRow = new Map<string, WorldTrackClip>()
  for (const clip of set.clips) if (clip.columnId) inRow.set(`${clip.trackId}\u0000${clip.columnId}`, clip)
  // Grouped lanes (sight and sound of one Expression) are one track in the Session grid: the visual lane stands for it.
  // The Main track's own material (a track flagged `main`) stands in the Main column, not among the tracks.
  const lanes = set.tracks.filter(track => !track.main && (!track.groupId || !track.lane || track.lane === 'visual'))
  const mainTrack = set.tracks.find(track => track.main)
  const tree = trackTree(set.tracks)
  // A group's members fold away with it (agent/AgentSessionGrid.tsx:92-96); every ancestor folded hides them, not only the parent.
  const tracks = lanes.filter(track => !tree.ancestorsOf(track).some(above => folded[above.id]))
  // What a head's Shift-click ranges over: the parts drawn, in their order, less the returns (O9; 0D item 9).
  const choosable = tracks.filter(track => !track.returns).map(track => track.id)
  const {here: stalledHere} = stalledLanes(set, tree)
  const launch = set.actions?.launch, launchStop = set.actions?.launchStop, stopTrack = set.actions?.stopTrack, retry = set.actions?.retry, seat = set.actions?.seat
  const removeTrack = set.actions?.removeTrack
  const makeClip = set.actions?.makeClip
  const recordSlot = set.actions?.recordSlot, launchTrack = set.actions?.launchTrack, insertClip = set.actions?.insertClip
  const mainName = set.main?.name
  const mainTitle = set.main ? `${mainName} · its chain: ${set.main.chain.length ? set.main.chain.join(', ') : 'none named'}` : undefined
  // The rows, nested under the sections they stand in (a set with no sections lays them as they come), less what is folded.
  const layout = shownRowLayout(sessionRowLayout(set), folded)
  const spanWords = (section: WorldTrackSection) => {
    const say = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
    return `${say(section.span.start)} – ${say(section.span.end)}`
  }
  // A row whose every clip sits on a read-only track is not the owner's to launch (the spine's firings row).
  const readOnlyTrack = new Set(set.tracks.filter(track => track.readOnly).map(track => track.id))
  const readOnlyRow = (rowId: string) => { const held = set.clips.filter(clip => clip.columnId === rowId); return held.length > 0 && held.every(clip => readOnlyTrack.has(clip.trackId)) }
  // What the owner's ops act on when it is coarser than a control looks, said on each control and over the stops.
  const grain = set.actions?.grain ? ` (${set.actions.grain})` : ''
  // The empty track takes what the set can seat (Live: drop onto the empty area to make a track; manual §10.3: an agent dropped on an
  // empty track takes the seat, a world joins today). An empty Session takes it too: with no track yet, this is the only place to drop.
  const seatHands = {
    'data-seat-drop': seat ? 'open' : undefined, 'data-receipt': receiptMark(receipt, 'seat'),
    title: seat ? `Drop here to seat it on a new track (${seat.op})` : undefined,
    onDragOver: seat ? (event: ReactDragEvent<HTMLElement>) => { if (event.dataTransfer.types.includes(seat.accepts)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } } : undefined,
    onDrop: seat ? (event: ReactDragEvent<HTMLElement>) => { const payload = event.dataTransfer.getData(seat.accepts); if (!payload) return; event.preventDefault(); onPress('seat', 'Seat', () => seat.run(payload)) } : undefined,
  }
  // An empty work draws Live's empty Session: the stops down the right and the drop area where tracks will stand, with the
  // reason in it — never a blank box (world-shell-mockup.html .sg; Live's "Drop Files and Devices Here").
  if (!lanes.length && !mainTrack) return <div className="sg-pane" data-tracks-view="session" data-empty="true" {...hands}>
    <div className="sg" role="grid" aria-label="Session">
      <div className="sg-drop" role="status" {...seatHands}>{empty ?? (seat ? 'No tracks yet. Drop here to start the first.' : 'No tracks in this work yet.')}</div>
      <div className="trk trk-main" role="row" aria-label="Stops">
        <MainHead selection={selection}>Main</MainHead>
        {(rows.length ? rows : EMPTY_STOPS).map((row, index) => <div key={row.id} className="cs" role="gridcell">
          <button type="button" className="stop-launch" disabled title="No row launch: this work has no tracks yet">▸</button>
          <span className="cs-label">{row.name || index + 1}</span>
        </div>)}
        <MainFoot set={set} receipt={receipt} onPress={onPress} />
      </div>
    </div>
  </div>
  // One track's column (a return track's too: it stands after the empty track, before Main, and holds no clip slots — Live's).
  const renderTrack = (track: WorldTrack, column: number) => {
        const ink = trackInk(track.color)
        const style = {'--tc': trackColour(track), ...(ink ? {'--tc-ink': ink} : {})} as CSSProperties
        const selectedTrack = selection.ref === track.id
        const chosenTrack = selectedTrack || chosen.includes(track.id)
        const ancestors = tree.ancestorsOf(track)
        const level = Math.max(track.depth ?? 0, ancestors.length)
        // One rail per ancestor, in that ancestor's colour (agent/AgentSessionGrid.tsx:180-183); a level the set declares
        // with no parent to name is a rail in the track's own colour.
        const rails = [...ancestors.map(trackColour), ...Array.from({length: level - ancestors.length}, () => trackColour(track))]
        const foldable = tree.children.has(track.id)
        const open = !folded[track.id]
        const members = foldable ? tree.descendantsOf(track) : []
        const lit = stalledHere.has(track.id)
        // A track merged from another reading takes none of the set's actions.
        const owned = !track.readOnly
        const trackLaunch = owned ? launch : undefined, trackStop = owned ? stopTrack : undefined
        // A constellation dropped on the track makes the mode's clip of it (manual §10.3, §16.7 Make this mode's clip): the track takes
        // the set's drag type and the owner answers where the drop landed. A return track and a track read from another reading take none.
        const maker = makeClip && owned && !track.returns ? makeClip : null
        // The drag types the maker takes: the set's own, then any other it names (Factory's takes a song's clip beside a constellation,
        // O-I #844: Material › Songs, and a message from Messages, O-I #757, useFactoryTracks.ts withDelegateDrop). The drop hands the
        // maker what the first of them carried.
        const takes = maker ? [maker.accepts, ...(maker.alsoAccepts ?? [])] : []
        const taken = (types: readonly string[]) => takes.find(type => types.includes(type))
        const makeKey = `make:${track.id}`
        return <div key={track.id} className={`trk${level ? ' sub' : ''}${track.returns ? ' trk-return' : ''}`} role="row" style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties}
          data-track={track.id} data-off={track.mix?.activator === false ? 'true' : undefined} data-make-clip={maker ? 'open' : undefined} data-depth={level || undefined} data-group={foldable ? 'true' : undefined} data-stalled={lit ? 'true' : undefined}
          data-receipt={maker ? receiptMark(receipt, makeKey) : undefined}
          onDragOver={maker ? event => { if (taken(event.dataTransfer.types)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } } : undefined}
          onDrop={maker ? event => { const type = taken(event.dataTransfer.types); const payload = type ? event.dataTransfer.getData(type) : ''; if (!payload) return
            event.preventDefault()
            onPress(makeKey, `Make ${track.name}'s clip`, () => maker.run(track.id, payload)) } : undefined}>
          {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
          {foldable && <button type="button" className="gf" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${track.name}`}
            title={`${open ? 'Fold' : 'Unfold'} the ${members.length} under ${track.name}`} onClick={() => onFold(track.id)}>{open ? '▼' : '▶'}</button>}
          <button type="button" className={`thd${chosenTrack ? ' sel' : ''}`} title={`${track.name} · ${track.kind}${track.info ? ` — ${track.info}` : ''}${removeTrack && owned ? ' · select it and press Delete to take it out of the set' : ''}`} aria-pressed={chosenTrack}
            // the head takes focus as it is selected, so its keys reach it: WebKit (the native candidate) focuses no button on a click,
            // and its Backspace then stepped the shell back a page instead of taking the track out (r20)
            // a Shift- or ⌘-click chooses it with the parts chosen before (O9, partChoice.ts), so ⌘G groups them all
            onClick={event => { event.currentTarget.focus(); chooseTrack(selection, set, track, choosable, event) }}
            onKeyDown={removeTrack && owned ? event => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onPress(`remove:${track.id}`, `Remove ${track.name}`, () => removeTrack.run(track.id)) } } : undefined}>
            {/* the track's own colour on its head (DLW.md:8911), where the set gives one */}
            {track.color && <i className="trk-swatch" role="img" aria-label={`Colour ${track.color}`} style={{background: track.color}} />}{track.name}
            {track.mix?.arm === true && <span className="trk-arm" role="img" aria-label="Armed" title="Armed: its empty slots record" />}</button>
          {/* Live's Delete on a selected track, also under the pointer: the selected track's own way out of the set (the inverse of a
              drop on the empty track). What it holds stays where its owner keeps it. */}
          <TrackDeviceButton device={trackHeadDevice(track.id)} track={track} selection={selection} />
          {removeTrack && owned && selectedTrack && <button type="button" className="trk-remove" aria-label={`Take ${track.name} out of the set`} data-receipt={receiptMark(receipt, `remove:${track.id}`)}
            title={`Take ${track.name} out of the set (${removeTrack.op})`} onClick={() => onPress(`remove:${track.id}`, `Remove ${track.name}`, () => removeTrack.run(track.id))}>×</button>}
          {launchTrack && owned && <button type="button" className="trk-launch" aria-label={`Launch ${track.name}`} data-receipt={receiptMark(receipt, `track:${track.id}`)}
            title={`Launch ${track.name} (${launchTrack.op})`} onClick={() => onPress(`track:${track.id}`, `Launch ${track.name}`, () => launchTrack.run(track.id))}>▸</button>}
          <MixerRow cells={mixerCells(set, track, column)} shown={!!set.mixer} trackId={track.id} receipt={receipt} onPress={onPress} />
          {layout.map((item, at) => {
            // A section's head row: a band in the section's atmosphere across every track (its name stands in the stops column).
            // The first track's band carries the section's name too, so the head reads from the left however wide the grid is.
            if (item.kind === 'head') return <div key={`head:${at}:${item.section.id}`} className="cs sect-band" role="presentation" aria-hidden="true"
              data-section-head={item.section.id} style={item.section.atmosphere ? {'--atm': item.section.atmosphere} as CSSProperties : undefined}>
              {column === 0 && <span className="cs-label">{item.section.name}</span>}</div>
            const row = item.column
            // A return track holds no clips: its row is blank, as Live draws a return track's Session column.
            if (track.returns) return <div key={row.id} className="cs" role="gridcell" data-slot-track={track.id} />
            const clip = inRow.get(`${track.id}\u0000${row.id}`) ?? (track.groupId ? set.clips.find(c => c.columnId === row.id && set.tracks.find(t => t.id === c.trackId)?.groupId === track.groupId) : undefined)
            if (clip) {
              const selected = selection.ref === clip.id
              const word = clip.status ? STATUS_WORD[clip.status] : 'State not disclosed'
              const key = `clip:${clip.id}`
              // Its standing, as the source discloses it (trackMarks.ts); a clip with no standing reading draws none.
              const mark = clipStandingMark(clip)
              // How far a running clip has got, only where its owner reads it (clipProgress); else the fill grows with no end, as it always did.
              const progress = clipProgress(clip)
              const mode = shownMode(clip)
              // What this clip's ▶ starts, read as Stop reads its own grain (O-I 804 BD round 25): the clip's grain where the launch gives
              // one (null: the clip pressed, said with nothing), else the set's; and the clip's own op, else the launch's.
              const launchGrain = trackLaunch?.grainOf ? ownGrain(trackLaunch.grainOf(clip.id), grain) : grain
              const launchOp = trackLaunch ? trackLaunch.opOf?.(clip.id) ?? trackLaunch.op : ''
              return <div key={row.id} role="gridcell" className={`cs clip${clip.status ? ` ${clip.status}` : ''}${selected ? ' sel' : ''}`} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
                data-receipt={receiptMark(receipt, key)} data-progress={progress ?? undefined} data-source={clip.source?.standing}
                title={`${clip.label} · ${word}${progress !== null ? ` · ${progress}% through, as its owner reads it` : ''}${mode ? ` · plays ${mode}` : ''}${clip.launch?.quantize ? ` · launches ${clip.launch.quantize}` : ''}${clip.launch?.follow ? ` · then ${clip.launch.follow}` : ''}${clip.takes?.length ? ` · ${clip.takes.length} takes` : ''}${clip.note ? ` · ${clip.note}` : ''}${clipStandingTitle(mark)}${clip.source ? ` · ${clip.source.mark}: ${clip.source.said}` : ''}`}
                {...clipStandingAttributes(mark)} style={mark || progress !== null ? {...(mark ? {borderLeft: clipStandingEdge(mark)} : {}), ...(progress !== null ? {'--p': progress} : {})} as CSSProperties : undefined}
                onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>
                <button type="button" className="tri" aria-label={`Launch ${clip.label}${launchGrain}`} disabled={!trackLaunch} title={trackLaunch ? `Launch (${launchOp})${mode === 'gate' && trackLaunch.release ? ' · held: it runs while you hold the launch' : ''}` : owned ? 'No launch: the owner discloses no launch for this clip' : 'No launch: this track is read, not launched'}
                  {...clipLaunchPress(clip, trackLaunch, onPress, key)} />
                <span className="cs-text">
                  <span className="cs-label">{clip.label}{clipStandingTag(mark)}</span>
                  {clip.source && <span className="cs-source">{clip.source.mark}</span>}
                  {clipSecondLine(clip)}
                </span>
                {clip.status === 'recording' && <i className="cs-rec" role="img" aria-label="Recording" />}
                {clip.note && <span className="cs-note" role="img" aria-label={clip.note} title={clip.note}>⚑</span>}
              </div>
            }
            // A group with no clip of its own in this row rolls up its members': one cell per member's clip, by its status
            // (agent/AgentSessionGrid.tsx:214-229). A read of the members, not a clip: nothing here launches.
            const rolled = members.flatMap(member => { const c = inRow.get(`${member.id}\u0000${row.id}`); return c ? [c] : [] })
            if (rolled.length) {
              const stalledCount = rolled.filter(c => c.status === 'stalled').length
              return <div key={row.id} role="gridcell" className="cs roll" data-rollup={rolled.length}
                title={`${rolled.length} ${rolled.length === 1 ? 'clip' : 'clips'} from the ${members.length} under ${track.name} in this row${stalledCount ? ` · ${stalledCount} stalled` : ''}`}>
                {rolled.map(c => <i key={c.id} data-status={c.status ?? 'undisclosed'} />)}
              </div>
            }
            // A click on an empty slot chooses it, where the set's slots are places of their own (Live's; the walk of O-I 857); a click on
            // its button is the button's.
            const chosen = emptySlotChoice(set, track, row)
            const choose = chosen ? {onClick: (event: ReactMouseEvent<HTMLElement>) => { if (event.target === event.currentTarget) selection.select(chosen) },
              'data-slot-ref': chosen.ref} : {}
            // A double-click on an empty slot starts a clip there (manual §16.6: "An empty slot is a place to write"), the act its menu's Insert clip
            // and ⇧⌘M run (frame/menu/objectActions.ts slotMenu); a double-click on a slot's button is the button's.
            const startClip = insertClip && owned ? {onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
              if (event.target === event.currentTarget) onPress(`insert:${track.id}:${row.id}`, `Insert a clip on ${track.name} · slot ${row.name}`, () => insertClip.run(track.id, row.id))
            }} : {}
            const cell = `cs${chosen && selection.ref === chosen.ref ? ' sel' : ''}`
            // An armed track's empty slots are record buttons, as Live draws them (cap 35); every other empty slot is a stop square.
            if (track.mix?.arm === true && owned) {
              const recordKey = `rec:${track.id}:${row.id}`
              return <div key={row.id} className={cell} role="gridcell" data-receipt={receiptMark(receipt, recordKey)} title="Empty slot · the track is armed: its button records here"
                data-slot-track={track.id} data-slot-row={row.id} {...choose} {...startClip}>
                <button type="button" className="sg-rec" aria-label={`Record on ${track.name}${grain}`} disabled={!recordSlot}
                  title={recordSlot ? `Record into this slot (${recordSlot.op})` : 'No record: the owner gives no op that records into a slot'}
                  onClick={() => { if (recordSlot) onPress(recordKey, `Record on ${track.name}`, () => recordSlot.run(track.id, row.id)) }}><CutIcon name="rec" size={9} /></button>
              </div>
            }
            // A slot whose stop button its owner has removed is blank, as Live draws it (cap 37): launching its row leaves the track playing.
            // It keeps its place, so its menu gives the button back.
            if (track.stopless?.includes(row.id)) return <div key={row.id} className={cell} role="gridcell" data-stopless=""
              title="Empty slot · its stop button is removed: launching the row leaves this track playing" data-slot-track={track.id} data-slot-row={row.id} {...choose} {...startClip} />
            const key = `stop:${track.id}:${row.id}`
            return <div key={row.id} className={cell} role="gridcell" data-receipt={receiptMark(receipt, key)} title={trackStop ? 'Empty slot · its square stops the track' : 'Empty slot'}
              data-slot-track={track.id} data-slot-row={row.id} {...choose} {...startClip}>
              <button type="button" className="sg2" aria-label={`Stop ${track.name}${trackStop && trackStop.grain !== undefined ? (trackStop.grain ? ` (${trackStop.grain})` : '') : grain}`} disabled={!trackStop} title={trackStop ? `Stop ${track.name} (${trackStop.op})` : owned ? 'No stop: the owner discloses no stop for this track' : 'No stop: this track is read, not stopped'}
                onClick={() => { if (trackStop) onPress(key, `Stop ${track.name}`, () => trackStop.run(track.id)) }} />
            </div>
          })}
          {/* The track's Clip Stop under its slots, as Live's (round 889, found walking: a track whose every slot holds a clip had no Stop),
              in the row of the Main column's Stop All; and its Retry where the set gives one. */}
          {(retry || trackStop) && owned && <div className="trk-foot">
            {trackStop && <button type="button" className="cs-stop" aria-label={`Stop the clip on ${track.name}`} data-receipt={receiptMark(receipt, `stop:${track.id}`)}
              title={`Stop: the clip playing on ${track.name} stops (${trackStop.op})`} onClick={() => onPress(`stop:${track.id}`, `Stop ${track.name}`, () => trackStop.run(track.id))} />}
            {retry && <button type="button" className={`rt${lit ? ' lit' : ''}`} aria-label={`Retry ${track.name}${grain}`} data-receipt={receiptMark(receipt, `retry:${track.id}`)}
              title={`Retry ${track.name} (${retry.op})${lit ? ' · lit: a lane in here has stalled' : ''}`}
              onClick={() => onPress(`retry:${track.id}`, `Retry ${track.name}`, () => retry.run(track.id))}>↻</button>}
          </div>}
        </div>
  }
  return <div className="sg-pane" data-tracks-view="session" {...hands}>
    <div className="sg" role="grid" aria-label="Session">
      {tracks.filter(track => !track.returns).map(renderTrack)}
      {/* The empty track: what the set can seat is dropped here (Live: drop onto the empty area to make a track). */}
      <div className="sg-fill" {...seatHands} aria-label={seat ? 'Empty track: drop to seat' : undefined} />
      {/* The return tracks (⌥⌘R shows and hides them: the frame's returns-hidden): in Factory, the workcells (frame/tracks/returnTracks.ts). */}
      {tracks.filter(track => track.returns).map((track, at) => renderTrack(track, tracks.length + at))}
      <div className="trk trk-main" role="row" aria-label="Stops">
        <MainHead selection={selection} title={[mainTitle, grain ? `every control here acts on the${grain.replace(/[()]/g, '')}: the owner takes nothing finer` : undefined].filter(Boolean).join(' · ') || undefined}>{mainName ?? 'Main'}{grain && <span className="sg-grain">{set.actions?.grain}</span>}</MainHead>
        {/* The Main track's own levels: Live's Main has Volume and Pan, and no Activator, Solo or Arm. */}
        <MixerRow cells={mainTrack ? mixerCells(set, mainTrack, set.tracks.indexOf(mainTrack)).filter(cell => cell.level) : []} shown={!!set.mixer} trackId="main" receipt={receipt} onPress={onPress} />
        {layout.map((item, at) => {
          // A section's head: its rails, its fold, its name — the rows under it carry its rail (worldTimelinePresentation.tsx:418-430).
          if (item.kind === 'head') {
            const {section} = item
            const open = !folded[sectionFoldKey(section.id)]
            return <div key={`head:${at}:${section.id}`} className="cs sect-head" role="gridcell" data-section={section.id} data-depth={item.depth}
              style={{'--rails': item.chain.length, ...(section.atmosphere ? {'--atm': section.atmosphere} : {})} as CSSProperties}
              title={`${section.name} · ${item.rows} ${item.rows === 1 ? 'stop stands' : 'stops stand'} in it · ${spanWords(section)}`}>
              {sectionRails(item.chain)}
              <button type="button" className="sect-fold" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${section.name}`}
                onClick={() => onFold(sectionFoldKey(section.id))}>{open ? '▼' : '▶'}</button>
              <span className="cs-label">{section.name}</span>
            </div>
          }
          const {column: row, index} = item
          const key = `row:${row.id}`
          const rowLaunch = readOnlyRow(row.id) ? undefined : launchStop
          // The Main track's own clip in this row (Central: the day's face) stands beside the row's launcher, as its name.
          const own = mainTrack ? inRow.get(`${mainTrack.id}\u0000${row.id}`) : undefined
          return <div key={row.id} className={`cs${own ? ' main-clip' : ''}${own && selection.ref === own.id ? ' sel' : ''}`} role="gridcell" data-row={row.id} data-receipt={receiptMark(receipt, key)}
            style={item.chain.length ? {'--rails': item.chain.length} as CSSProperties : undefined} data-section-rails={item.chain.length || undefined} data-clip={own?.id}>
            {sectionRails(item.chain)}
            <button type="button" className="stop-launch" disabled={!rowLaunch} title={rowLaunch ? `Launch the row: every clip in it (${rowLaunch.op})` : launchStop ? 'No row launch: every clip in this row is read, not launched' : 'No row launch: the owner discloses none'}
              onClick={() => { if (rowLaunch) onPress(key, `Launch row ${row.name || index + 1}`, () => rowLaunch.run(row.id)) }}>▸</button>
            {own
              ? <button type="button" className="cs-label main-face" title={`${own.label} · on ${mainTrack!.name}${own.note ? ` · ${own.note}` : ''}`}
                onClick={() => selection.select({kind: 'clip', ref: own.id, title: own.label, track: own.trackId})}>{own.label}</button>
              : <span className="cs-label">{row.name || index + 1}</span>}
          </div>
        })}
        <MainFoot set={set} receipt={receipt} onPress={onPress} />
      </div>
    </div>
    {receipt && <p className="sg-receipt" role="status" data-ok={receipt.ok}>
      <b>{receipt.what}</b>
      <span>{receipt.text}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </p>}
    <GridLegend set={set} selection={selection} />
  </div>
}

/** The states a clip can stand in, in the order the legend names them (dlw:session-grid's foot). */
const LEGEND_STATES = ['waiting', 'running', 'stopped', 'recording', 'stalled', 'done'] as const

/** The launch mode the second line says: the owner's word, except the design's default (once), which the design draws as nothing. */
const shownMode = (clip: Pick<WorldTrackClip, 'launch'>): string | undefined => {
  const mode = clip.launch?.mode?.trim()
  return mode && mode.toLowerCase() !== 'once' ? mode : undefined
}

/** A clip's second line (catalogue dlw__session-grid.tsx FullGrid's cell, its `<small>`): how it plays (the launch mode, where its owner
 * says one other than once), what follows it, as the owner words it, and the takes stacked under it. Nothing to say, no line. */
export function clipSecondLine(clip: Pick<WorldTrackClip, 'launch' | 'takes'>) {
  const mode = shownMode(clip), follow = clip.launch?.follow, takes = clip.takes?.length ?? 0
  const said = [
    mode && <span key="mode" className="cs-mode">{mode}</span>,
    follow && <span key="follow" className="cs-follow">→ {follow}</span>,
    takes > 0 && <span key="takes" className="cs-takes">{takes} {takes === 1 ? 'take' : 'takes'}</span>,
  ].filter(Boolean)
  if (!said.length) return null
  return <small className="cs-sub">{said.flatMap((part, i) => (i ? [' · ', part] : [part]))}</small>
}

/** The grid's foot (catalogue dlw__session-grid.tsx FullGrid's bar): the legend of a clip's states, and what the selected clip launches
 * and does after, in its owner's words where the set gives them (its launch's quantize and follow). */
export function GridLegend({set, selection}: {set: WorldTrackSet; selection: TracksSelection}) {
  const chosen = selection.ref ? set.clips.find(clip => clip.id === selection.ref) : undefined
  const says = chosen ? [chosen.label, chosen.launch?.quantize ? `launches ${chosen.launch.quantize}` : null, chosen.launch?.follow ? `then ${chosen.launch.follow}` : null].filter(Boolean).join(' · ') : 'No clip selected'
  return <footer className="sg-legend" aria-label="Legend">
    {LEGEND_STATES.map(state => <span key={state} className="sg-key"><i data-status={state} />{STATUS_WORD[state]}</span>)}
    <span className="sg-says">{says}</span>
  </footer>
}

/** The Session grid: the view, with the state a grid keeps — which groups are folded shut, and the owner's last answer. */
export function SessionGrid({set, selection, empty, folded: held, onFold}: {set: WorldTrackSet; selection: TracksSelection; empty?: string
  /** The groups folded shut, where the device's view holds them (`fold:*`); absent, the grid keeps its own. */
  folded?: Readonly<Record<string, boolean>>; onFold?: (trackId: string) => void}) {
  // A mode naming its tracks' own devices again draws their head buttons (trackHeads.ts).
  useTrackHeadDevices()
  const [own, setFolded] = useState<Record<string, boolean>>({})
  const folded = held ?? own
  const [receipt, setReceipt] = useState<PressedReceipt | null>(null)
  const latest = useRef(0)
  const press = (key: string, what: string, run: () => unknown) => {
    const turn = ++latest.current
    setReceipt(null)
    void answerOf(run).then(answer => { if (answer && turn === latest.current) setReceipt(pressedIn(set, key, what, answer)) })
  }
  const fold = (id: string) => (onFold ? onFold(id) : setFolded(current => ({...current, [id]: !current[id]})))
  // A held launch's line follows its clip until it lands (round 886): it says that it landed, or clears.
  useEffect(() => { setReceipt(current => heldLaunchReceipt(current, set)) }, [set])
  // The receipt says the last act: Undo, Redo or another act listed clears it, as the Arrangement's (O-I #747 round 893).
  useEffect(() => subscribeUndo(() => setReceipt(null)), [])
  // Every object's acts, after Live's: its menu, Live's keys on the selection, rename in place (frame/menu/TracksMenu.tsx).
  const menu = useTracksMenu({set, selection, view: 'session', press, folded: id => folded[id], fold})
  // The parts chosen with THE selection (O9): the view draws each as chosen on its head.
  const chosen = usePartChoice(selection.ref, set).parts
  return <><SessionGridView set={set} selection={selection} folded={folded} receipt={receipt} onPress={press} empty={empty} chosen={chosen}
    menu={{rootRef: element => { menu.rootRef.current = element }, onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown}}
    onFold={fold} onDismiss={() => { latest.current += 1; setReceipt(null) }} />{menu.layer}</>
}


// ---------------------------------------------------------------- controls shared by the views

/** The selected clip's follow action, and where it is set. */
const setFollow = (p: ViewProps) => (f: Follow) => p.set(`follow:${selKey(p.v)}`, f === 'none' ? undefined : f)
const trackOptions = (v: Values): readonly Option<string>[] => [{value: 'none', label: 'None'}, ...lawOf(v).TRACKS.filter(t => !t.group).map(t => ({value: t.id, label: t.short}))]

const quantDial = (p: ViewProps) => {
  const opts = quantOptions(p.v), at = Math.max(0, opts.findIndex(o => o.value === quantOf(p.v)?.value))
  return <Dial {...st(p, 'quantize')} label="Quantize" does="When a launch lands." value={at} def={Math.max(0, opts.findIndex(o => o.value === (str(p.v, 'mode') === 'factory' ? 'tool' : 'now')))}
    scale={{min: 0, max: opts.length - 1, step: 1}} format={x => opts[x]!.label} onChange={x => p.set('quantize', opts[x]!.value)} />
}
const followDial = (p: ViewProps) => <Dial {...st(p, `follow:${selKey(p.v)}`)} label="Follow" does="What comes after the selected clip: None, Next, First or Stop." value={FOLLOWS.indexOf(followOf(p.v, selKey(p.v)))} def={0}
  scale={{min: 0, max: 3, step: 1}} format={x => FOLLOW_WORD[FOLLOWS[x]!]} onChange={x => setFollow(p)(FOLLOWS[x]!)} />
const modeRadio = (p: ViewProps) => <Radio {...st(p, `launch:${selKey(p.v)}`)} label="Mode" does="How the selected clip plays." value={launchOf(p.v, selKey(p.v))} options={MODE_OPTIONS} stack
  onChange={x => p.set(`launch:${selKey(p.v)}`, x === 'once' ? undefined : x)} />
const armChooser = (p: ViewProps) => <Chooser {...st(p, 'armed')} label="Armed" does="The track that voice and the composer address." value={str(p.v, 'armed')} options={trackOptions(p.v)} onChange={x => p.set('armed', x)} wide />

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'dlw:session-grid',
  title: 'Session grid',
  kind: 'instrument',
  defaults: {
    light: 'lit', mode: 'factory', sel: 'lead:2', armed: 'lead', quantize: 'tool', takes: false, rowKeys: true,
    tracks: JSON.stringify(MOCK_TRACKS), clips: JSON.stringify(MOCK_CLIPS), rows: MOCK_ROWS,
  },
  fixtures: {
    'Follow chain': {'follow:lead:1': 'next', 'follow:lead:2': 'next', 'launch:lead:2': 'hold'},
    'Crew folded': {'fold:g1': true, takes: true},
    'Lead solo': {'solo:lead': true, sel: 'honey:2'},
  },

  folded: p => <Folded title="Session grid" light={light(p.v)} readings={['Factory', `${visible(p.v).length} tracks`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Session grid" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Session" corner={`launch ${quantWord(p.v)}`}
        does="Tracks across, stops down. Press a clip to select it. Drag handle 1 to set what follows it.">
        <Grid v={p.v} set={p.set} geo={COMPACT} uid="c" handle />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      {quantDial(p)}
      {followDial(p)}
      {modeRadio(p)}
      {armChooser(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Session grid" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="Session" corner={`launch ${quantWord(p.v)}`}
          does="Tracks across, stops down. Press a clip to select it, a header to arm or fold. Drag handle 1 to set what follows the clip.">
          <Grid v={p.v} set={p.set} geo={WHOLE} uid="w" handle />
        </Display>
      </Section>
      <Section label="Launch" cols={3} grow>
        {modeRadio(p)}
        <Radio {...st(p, 'quantize')} label="Quantize" does="When a launch lands." value={quantOf(p.v)?.value ?? ''} options={quantOptions(p.v)} stack onChange={x => p.set('quantize', x)} />
        {followDial(p)}
        <div style={{gridColumn: 'span 3', width: '100%'}}>{armChooser(p)}</div>
        <Readout label="running" does="Clips that run now. A running clip has no end." value={count(p.v, 'running')} tone="value" />
        <Readout label="waiting" does="Clips that wait for their launch." value={count(p.v, 'waiting')} tone="accent" />
        <Readout label="stalled" does="Clips frozen where their output stopped. The track lights a retry." value={count(p.v, 'stalled')} tone="stall" />
      </Section>
    </Band>
    <Band>
      <Section width={150}>
        <Rows label="Tracks" does="The tracks of the mode. The square is your request to show one; the light says the grid draws it."
          empty="This mode holds no tracks yet." why={typeof p.v.tracks === 'string' ? undefined : 'No reading of the mode\'s tracks.'}
          items={typeof p.v.tracks !== 'string' ? undefined : lawOf(p.v).TRACKS.map((t): RowItem => {
            const under = hiddenByFold(p.v, t)
            return {id: t.id, name: `${'  '.repeat(lawOf(p.v).ancestors(t).length)}${t.name}`, request: shown(p.v, t), light: shown(p.v, t) && !under ? 'lit' : 'dark', tone: 'value',
              note: String(lawOf(p.v).CLIPS.filter(c => c.track === t.id).length), why: shown(p.v, t) && under ? `Folded under ${under.name}.` : undefined, does: `${t.name}: shown in the grid.`}
          })}
          onRequest={(id, x) => p.set(`show:${id}`, x)} size={7} />
      </Section>
      <Section label="Solo" width={76}>
        {lawOf(p.v).TRACKS.map(t => <Toggle key={t.id} {...st(p, `solo:${t.id}`)} label={t.short} does={`Attend to the soloed tracks alone; the others keep running. ${t.name}.`} on={on(p.v, `solo:${t.id}`)} onChange={x => p.set(`solo:${t.id}`, x)} />)}
      </Section>
      <Section label="Grid" cols={2} grow>
        <Radio label="Groups" does="Fold every group under its header, or open it." value={lawOf(p.v).GROUPS.length && lawOf(p.v).GROUPS.every(g => folded(p.v, g)) ? 'folded' : 'open'}
          options={[{value: 'open', label: 'Open'}, {value: 'folded', label: 'Folded'}]} stack onChange={x => lawOf(p.v).GROUPS.forEach(g => p.set(`fold:${g.id}`, x === 'folded'))} />
        <Toggle {...st(p, 'takes')} label="Takes" does="Show the takes stacked under each clip." on={on(p.v, 'takes')} onChange={x => p.set('takes', x)} />
        <Toggle {...st(p, 'rowKeys')} label="Row keys" does="Let the number keys launch rows." on={on(p.v, 'rowKeys')} onChange={x => p.set('rowKeys', x)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <SessionFull p={p} />,

  widget: p => <Tile title="Session grid" light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={150} h={104} label="Session" does="Press a clip to select it. Press a lit retry to select the stalled clip.">
      <Grid v={p.v} set={p.set} geo={WIDGET} uid="t" />
    </Display>
    <div className="sgd-tile-side">
      <Readout big label="running" does="Clips that run now." value={count(p.v, 'running')} tone="value" />
      <Readout big label="waiting" does="Clips that wait for their launch." value={count(p.v, 'waiting')} tone="accent" />
      <Readout big label="stalled" does="Press to select the stalled clip." value={count(p.v, 'stalled')} tone="stall" onPress={() => { const stalled = lawOf(p.v).CLIPS.find(c => c.status === 'stalled'); if (stalled) p.set('sel', clipKey(stalled)) }} />
    </div>
  </Tile>,
}
