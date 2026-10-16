// Session grid (manual §17.8): the shell's own Session view as an instrument that opens in a pane. Live's nearest: the Session view's
// clip grid (a clip launcher with its scene launchers) — here the tracks are the mode's, the clips are its material, and a row is a stop.
// The picture is the grid itself, drawn by the grid's own law (frame/tracks/SessionGrid.tsx): a clip stands in its track's column and its
// row; a clip shows its state (waiting, running with no end, stopped, recording, stalled, done); a group folds its members and rolls their
// clips up; a stalled lane lights its retry; the Main column holds the row launchers. The fixture is Factory's own mockup grid
// (desktop/cradle/docs/world-shell/agent-shell-mockup.html:470-478), because Factory is the mode whose owner reports clip states.
import type {CSSProperties, KeyboardEvent} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {clampTo, on, str, type DesignedDevice, type ViewProps, type Values} from './design'
import './dlw__session-grid.css'

type Status = 'waiting' | 'running' | 'stopped' | 'recording' | 'stalled' | 'done'
const STATUS_WORD: Record<Status, string> = {waiting: 'Waiting', running: 'Running', stopped: 'Stopped', recording: 'Recording', stalled: 'Stalled', done: 'Done'}
const LEGEND: readonly Status[] = ['waiting', 'running', 'stopped', 'recording', 'stalled', 'done']

interface Track {id: string; name: string; short: string; c: string; parent?: string; group?: boolean}
interface Clip {track: string; row: number; label: string; status: Status; p?: number; takes?: number}

/** The agency tracks of the mockup: a crew under a group, one level deeper under the test lane, and three lanes of their own. */
const TRACKS: readonly Track[] = [
  {id: 'g1', name: 'Port bridge-2', short: 'Port', c: '#5cc6b4', group: true},
  {id: 'lead', name: 'Fizz · lead', short: 'Lead', c: '#5cc6b4', parent: 'g1'},
  {id: 'explore', name: 'explore', short: 'Explore', c: '#8fbfb6', parent: 'g1'},
  {id: 'test', name: 'test', short: 'Test', c: '#8fbfb6', parent: 'g1', group: true},
  {id: 'fixture', name: 'fixture-gen', short: 'Fixture', c: '#a8c9c2', parent: 'test'},
  {id: 'honey', name: 'Capture pass', short: 'Capture', c: '#e2a35e'},
  {id: 'bumble', name: 'Review #482', short: 'Review', c: '#d985a6'},
]
/** The tasks of the mockup (rows are batches 1 to 4; the fourth is the empty soft-stop row). Takes are fixture readings. */
const CLIPS: readonly Clip[] = [
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
const ROWS = 4

const clipKey = (c: {track: string; row: number}) => `${c.track}:${c.row}`
const clipAt = (track: string, row: number) => CLIPS.find(c => c.track === track && c.row === row)
const byId = (id: string) => TRACKS.find(t => t.id === id)
const ancestors = (t: Track): Track[] => {
  const out: Track[] = []
  for (let up = t.parent ? byId(t.parent) : undefined; up && !out.includes(up); up = up.parent ? byId(up.parent) : undefined) out.unshift(up)
  return out
}
const descendants = (t: Track) => TRACKS.filter(x => ancestors(x).some(a => a.id === t.id))
const GROUPS = TRACKS.filter(t => t.group)

const shown = (v: Values, t: Track) => v[`show:${t.id}`] !== false
const folded = (v: Values, t: Track) => v[`fold:${t.id}`] === true
const hiddenByFold = (v: Values, t: Track) => ancestors(t).find(a => folded(v, a))
/** The tracks the grid draws: requested, and not folded away under a group. */
const visible = (v: Values) => TRACKS.filter(t => shown(v, t) && !hiddenByFold(v, t))
const soloed = (v: Values) => TRACKS.filter(t => on(v, `solo:${t.id}`))
/** With a solo on, only the soloed tracks (and what they contain or sit in) may run. */
const active = (v: Values, t: Track) => {
  const s = soloed(v)
  return s.length === 0 || s.some(x => x.id === t.id || ancestors(x).some(a => a.id === t.id) || ancestors(t).some(a => a.id === x.id))
}
/** Lanes that have stalled, and every group above them: the Session lights a retry on each. */
const stalledHere = () => {
  const own = CLIPS.filter(c => c.status === 'stalled').map(c => byId(c.track)!)
  return new Set(own.flatMap(t => [t.id, ...ancestors(t).map(a => a.id)]))
}
const count = (s: Status) => CLIPS.filter(c => c.status === s).length

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
const quantOf = (v: Values) => { const q = str(v, 'quantize'); return quantOptions(v).find(o => o.value === q) ?? quantOptions(v)[0]! }

const selKey = (v: Values) => str(v, 'sel')
const selClip = (v: Values) => CLIPS.find(c => clipKey(c) === selKey(v))
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
  const cols = visible(v), n = cols.length + 1, gap = 2
  const cw = Math.min(26, (geo.w - 12 - gap * (n - 1)) / n), x0 = (geo.w - (n * cw + gap * (n - 1))) / 2
  const colX = (i: number) => x0 + i * (cw + gap)
  const rowY0 = geo.headY + 14, rowY = (r: number) => rowY0 + r * geo.rowH, footY = rowY(ROWS) + 3
  const here = stalledHere(), armed = str(v, 'armed'), sel = selKey(v), takesShown = on(v, 'takes'), keys = on(v, 'rowKeys')
  const chosen = selClip(v), at = chosen ? cols.findIndex(t => t.id === chosen.track) : -1
  const follow = chosen ? followOf(v, sel) : 'none'
  const cellH = geo.rowH - 3
  // The follow handle: it rests on the selected clip, and moves up to the first clip, down to the next, or to the track's stop.
  const cx = at >= 0 ? colX(at) + cw / 2 : 0, rowCy = (r: number) => rowY(r) + cellH / 2
  const spots: Record<Follow, number> = chosen
    ? {first: rowCy(0), none: rowCy(chosen.row - 1), next: rowCy(Math.min(chosen.row, ROWS - 1)), stop: footY + 3}
    : {first: 0, none: 0, next: 0, stop: 0}
  const nearest = (y: number): Follow => FOLLOWS.reduce((best, f) => (Math.abs(spots[f] - y) < Math.abs(spots[best] - y) ? f : best), 'none' as Follow)
  const caption = chosen ? `${chosen.label} · ${STATUS_WORD[chosen.status].toLowerCase()}` : 'No clip selected'
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
            return <g key={r} {...hit(set && (() => set('sel', k)), `${clip.label}|${STATUS_WORD[clip.status]}. Press to select the clip.`)}>
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
          const rolled = t.group && isFolded ? descendants(t).flatMap(m => { const c = clipAt(m.id, r + 1); return c ? [{c, m}] : [] }) : []
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

// ---------------------------------------------------------------- the pane

function FullGrid({v}: {v: Values}) {
  const cols = visible(v), here = stalledHere(), armed = str(v, 'armed'), sel = selKey(v), takesShown = on(v, 'takes'), keys = on(v, 'rowKeys')
  const chosen = selClip(v), q = quantOf(v)
  return <div className="sgd-pane">
    <div className="sgd" role="grid" aria-label="Session">
      {cols.map(t => {
        const isFolded = folded(v, t)
        return <div key={t.id} className="sgd-trk" role="row" style={{'--tc': t.c} as CSSProperties} data-silent={!active(v, t) || undefined}>
          <div className="sgd-head">
            {ancestors(t).map(a => <i key={a.id} className="sgd-rail" style={{background: a.c}} />)}
            {t.group && <span className="sgd-fold">{isFolded ? '▶' : '▼'}</span>}
            <b>{t.name}</b>
            {armed === t.id && <span className="sgd-arm" role="img" aria-label="Armed" />}
          </div>
          {Array.from({length: ROWS}, (_, r) => {
            const clip = clipAt(t.id, r + 1)
            if (clip) {
              const k = clipKey(clip), f = followOf(v, k), m = launchOf(v, k)
              return <div key={r} role="gridcell" className="sgd-cell" data-status={clip.status} data-sel={k === sel || undefined} style={{'--p': clip.p ?? 50} as CSSProperties}>
                <i className="sgd-tri" />
                <span className="sgd-text">
                  <span className="sgd-label">{clip.label}</span>
                  {(m !== 'once' || f !== 'none' || clip.takes) && <small>
                    {[m !== 'once' ? m : '', f !== 'none' ? `→ ${f}` : ''].filter(Boolean).join(' · ')}
                    {clip.takes && (takesShown
                      ? <span className="sgd-ticks" aria-label={`${clip.takes} takes`}>{Array.from({length: clip.takes}, (_, j) => <i key={j} data-standing={j === clip.takes! - 1 || undefined} />)}</span>
                      : <span className="sgd-takes" aria-label={`${clip.takes} takes`}>{clip.takes} takes</span>)}
                  </small>}
                </span>
              </div>
            }
            const rolled = t.group && isFolded ? descendants(t).flatMap(mm => { const c = clipAt(mm.id, r + 1); return c ? [{c, mm}] : [] }) : []
            if (rolled.length) return <div key={r} role="gridcell" className="sgd-cell sgd-roll">{rolled.map(({c, mm}) => <i key={mm.id} data-status={c.status} style={{'--tc': mm.c} as CSSProperties} />)}</div>
            return <div key={r} role="gridcell" className="sgd-cell" data-empty="true"><span className="sgd-stopsq" /></div>
          })}
          <div className="sgd-foot"><span className="sgd-retry" data-lit={here.has(t.id) || undefined}>↻</span></div>
        </div>
      })}
      <div className="sgd-trk sgd-main" role="row">
        <div className="sgd-head"><b>Main</b></div>
        {Array.from({length: ROWS}, (_, r) => <div key={r} role="gridcell" className="sgd-cell sgd-stops"><span className="sgd-launch">▸</span>{keys ? <kbd>{r + 1}</kbd> : <span>{r + 1}</span>}</div>)}
        <div className="sgd-foot" />
      </div>
    </div>
    <footer className="sgd-bar">
      {LEGEND.map(s => <span key={s} className="sgd-key"><i data-status={s} />{STATUS_WORD[s]}</span>)}
      <span className="sgd-says">{chosen ? `${chosen.label} · launches ${q.label.toLowerCase()} · then ${followOf(v, selKey(v))}` : 'No clip selected'}</span>
    </footer>
  </div>
}

// ---------------------------------------------------------------- controls shared by the views

/** The selected clip's follow action, and where it is set. */
const setFollow = (p: ViewProps) => (f: Follow) => p.set(`follow:${selKey(p.v)}`, f === 'none' ? undefined : f)
const trackOptions: readonly Option<string>[] = [{value: 'none', label: 'None'}, ...TRACKS.filter(t => !t.group).map(t => ({value: t.id, label: t.short}))]

const quantDial = (p: ViewProps) => {
  const opts = quantOptions(p.v), at = Math.max(0, opts.findIndex(o => o.value === quantOf(p.v).value))
  return <Dial label="Quantize" does="When a launch lands." value={at} def={Math.max(0, opts.findIndex(o => o.value === (str(p.v, 'mode') === 'factory' ? 'tool' : 'now')))}
    scale={{min: 0, max: opts.length - 1, step: 1}} format={x => opts[x]!.label} onChange={x => p.set('quantize', opts[x]!.value)} />
}
const followDial = (p: ViewProps) => <Dial label="Follow" does="What comes after the selected clip: None, Next, First or Stop." value={FOLLOWS.indexOf(followOf(p.v, selKey(p.v)))} def={0}
  scale={{min: 0, max: 3, step: 1}} format={x => FOLLOW_WORD[FOLLOWS[x]!]} onChange={x => setFollow(p)(FOLLOWS[x]!)} />
const modeRadio = (p: ViewProps) => <Radio label="Mode" does="How the selected clip plays." value={launchOf(p.v, selKey(p.v))} options={MODE_OPTIONS} stack
  onChange={x => p.set(`launch:${selKey(p.v)}`, x === 'once' ? undefined : x)} />
const armChooser = (p: ViewProps) => <Chooser label="Armed" does="The track that voice and the composer address." value={str(p.v, 'armed')} options={trackOptions} onChange={x => p.set('armed', x)} wide />

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'dlw:session-grid',
  title: 'Session grid',
  kind: 'instrument',
  defaults: {
    light: 'lit', mode: 'factory', sel: 'lead:2', armed: 'lead', quantize: 'tool', takes: false, rowKeys: true,
  },
  fixtures: {
    'Follow chain': {'follow:lead:1': 'next', 'follow:lead:2': 'next', 'launch:lead:2': 'hold'},
    'Crew folded': {'fold:g1': true, takes: true},
    'Lead solo': {'solo:lead': true, sel: 'honey:2'},
  },

  folded: p => <Folded title="Session grid" light={light(p.v)} readings={['Factory', `${visible(p.v).length} tracks`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Session grid" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Session" corner={`launch ${quantOf(p.v).label.toLowerCase()}`}
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
        <Display w={194} h={146} label="Session" corner={`launch ${quantOf(p.v).label.toLowerCase()}`}
          does="Tracks across, stops down. Press a clip to select it, a header to arm or fold. Drag handle 1 to set what follows the clip.">
          <Grid v={p.v} set={p.set} geo={WHOLE} uid="w" handle />
        </Display>
      </Section>
      <Section label="Launch" cols={3} grow>
        {modeRadio(p)}
        <Radio label="Quantize" does="When a launch lands." value={quantOf(p.v).value} options={quantOptions(p.v)} stack onChange={x => p.set('quantize', x)} />
        {followDial(p)}
        <div style={{gridColumn: 'span 3', width: '100%'}}>{armChooser(p)}</div>
        <Readout label="running" does="Clips that run now. A running clip has no end." value={count('running')} tone="value" />
        <Readout label="waiting" does="Clips that wait for their launch." value={count('waiting')} tone="accent" />
        <Readout label="stalled" does="Clips frozen where their output stopped. The track lights a retry." value={count('stalled')} tone="stall" />
      </Section>
    </Band>
    <Band>
      <Section width={150}>
        <Rows label="Tracks" does="The tracks of the mode. The square is your request to show one; the light says the grid draws it."
          items={TRACKS.map((t): RowItem => {
            const under = hiddenByFold(p.v, t)
            return {id: t.id, name: `${'  '.repeat(ancestors(t).length)}${t.name}`, request: shown(p.v, t), light: shown(p.v, t) && !under ? 'lit' : 'dark', tone: 'value',
              note: String(CLIPS.filter(c => c.track === t.id).length), why: shown(p.v, t) && under ? `Folded under ${under.name}.` : undefined, does: `${t.name}: shown in the grid.`}
          })}
          onRequest={(id, x) => p.set(`show:${id}`, x)} size={7} />
      </Section>
      <Section label="Solo" width={76}>
        {TRACKS.map(t => <Toggle key={t.id} label={t.short} does={`Let only the soloed tracks run. ${t.name}.`} on={on(p.v, `solo:${t.id}`)} onChange={x => p.set(`solo:${t.id}`, x)} />)}
      </Section>
      <Section label="Grid" cols={2} grow>
        <Radio label="Groups" does="Fold every group under its header, or open it." value={GROUPS.every(g => folded(p.v, g)) ? 'folded' : 'open'}
          options={[{value: 'open', label: 'Open'}, {value: 'folded', label: 'Folded'}]} stack onChange={x => GROUPS.forEach(g => p.set(`fold:${g.id}`, x === 'folded'))} />
        <Toggle label="Takes" does="Show the takes stacked under each clip." on={on(p.v, 'takes')} onChange={x => p.set('takes', x)} />
        <Toggle label="Row keys" does="Let the number keys launch rows." on={on(p.v, 'rowKeys')} onChange={x => p.set('rowKeys', x)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <FullGrid v={p.v} />,

  widget: p => <Tile title="Session grid" light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={150} h={104} label="Session" does="Press a clip to select it. Press a lit retry to select the stalled clip.">
      <Grid v={p.v} set={p.set} geo={WIDGET} uid="t" />
    </Display>
    <div className="sgd-tile-side">
      <Readout big label="running" does="Clips that run now." value={count('running')} tone="value" />
      <Readout big label="waiting" does="Clips that wait for their launch." value={count('waiting')} tone="accent" />
      <Readout big label="stalled" does="Press to select the stalled clip." value={count('stalled')} tone="stall" onPress={() => p.set('sel', 'fixture:2')} />
    </div>
  </Tile>,
}
