// The Journey (manual §17.5): Technē's walk through scenes, stop by stop. Live's nearest: Simpler's Slice mode — a ruler cut into
// slices, a playhead through them, and a length and a join for each. The owner is the research frame (field-studies-journeys:
// journeyInstrument.tsx, journeyPath.ts walkJourney / edgeRows, transitions.ts, journeyPace.ts, model.ts Scene.duration and
// Scene.transition) and the engine's transition law (src/engine/transitionMath.ts). The fixture is the frame's own "Field studies"
// journey (model.ts fieldStudies): eight scenes of 14 s, joined by 1.5 s crossfades, looping.
import type {CSSProperties} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './techne__journey.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']

// ---------------------------------------------------------------- the walk (model.ts fieldStudies: name, character)

const STOPS: readonly (readonly [string, string])[] = [
  ['Ink', 'Fine, irregular stippling. Form on the edge of dissolution.'],
  ['Print', 'An imperfect lattice. A surface beginning to move.'],
  ['Gather', 'Rounded grains find a shared current.'],
  ['Between', 'Two characters, one material. An unsettled identity.'],
  ['Language', 'A different character. The same living field.'],
  ['Weather', 'No centre, no logo. Only changing concentrations.'],
  ['Quiet', 'A little less certainty. A little more space.'],
  ['Nocturne', 'Light collected in the dark. Something quietly taking form.'],
]
const N = STOPS.length
const WALK_NAME = 'Field studies'

/** The owner's bounds and defaults: a scene holds 1 s to 1 h (model.ts SCENE_DURATION_*), a blend lasts 0 to 30 s and never past
 * the stop it enters (SCENE_TRANSITION_*, journeyPath.blendLimit); a new scene holds 12 s with a 1.5 s blend (blankScene). */
const HOLD = {min: 1, max: 3600, log: true}
const BLEND_MAX = 30
const HOLD_DEF = 12, BLEND_DEF = 1.5
const DIP_MIN = 0.2, DIP_MAX = 0.8, DIP_DEF = 0.5

const KINDS = [
  {value: 'cut', label: 'Cut', does: 'The next stop replaces this one at once.'},
  {value: 'crossfade', label: 'Fade', does: 'A crossfade: the next stop fades in over this one.'},
  {value: 'dip-to-colour', label: 'Dip', does: 'This stop gives way to a colour, then the colour gives way to the next.'},
  {value: 'wipe', label: 'Wipe', does: 'The next stop wipes in across this one.'},
] as const
type Kind = (typeof KINDS)[number]['value']
const KIND_LONG: Record<Kind, string> = {cut: 'Cut', crossfade: 'Crossfade', 'dip-to-colour': 'Dip to colour', wipe: 'Wipe'}
const KIND_SHORT: Record<Kind, string> = {cut: 'Cut', crossfade: 'Fade', 'dip-to-colour': 'Dip', wipe: 'Wipe'}
const CURVES = [
  {value: 'linear', label: 'Linear', does: 'The arrival moves at a steady rate.'},
  {value: 'hold', label: 'Hold', does: 'The arrival waits, then lands at its end.'},
  {value: 'smooth', label: 'Smooth', does: 'The arrival eases in and eases out.'},
  {value: 'bezier', label: 'Bezier', does: 'The arrival follows two handles. Without handles it is linear.'},
] as const
const SWITCHES = [
  {value: 'immediate', label: 'Immediate', does: 'The next stop takes over when you ask for it.'},
  {value: 'sync', label: 'Sync', does: 'The next stop starts at the same point in its own time as the stop you leave.'},
  {value: 'at-end', label: 'At end', does: 'The next stop waits until the stop you leave has ended.'},
] as const
const DIRECTIONS = [{value: 'left', label: 'Left'}, {value: 'right', label: 'Right'}, {value: 'up', label: 'Up'}, {value: 'down', label: 'Down'}] as const

const secs = (x: number) => (x >= 3600 ? `${+(x / 3600).toFixed(1)} h` : x >= 60 ? `${+(x / 60).toFixed(1)} min` : `${+x.toFixed(1)} s`)
const clockOf = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`
const round1 = (x: number) => Math.round(x * 10) / 10

// ---------------------------------------------------------------- the walk read from the values

interface Stop {readonly i: number; readonly name: string; readonly start: number; readonly hold: number; readonly tr: number; readonly kind: Kind; readonly curve: string; readonly sw: string}

/** The stops in order, each with its start on the walk's clock (journeyTimelineLayout: the sum of the holds before it). */
const stopsOf = (v: V): Stop[] => {
  let t = 0
  return STOPS.map(([name], i) => {
    const hold = num(v, `hold:${i}`), stop: Stop = {i, name, start: t, hold, tr: num(v, `tr:${i}`), kind: str(v, `kind:${i}`) as Kind, curve: str(v, `curve:${i}`), sw: str(v, `sw:${i}`)}
    t += hold
    return stop
  })
}
/** Whether the walk wraps from its last stop to its first: the document loops and its last stop is not a loop exit (journeyPath.walkJourney). */
const wraps = (v: V) => on(v, 'docLoops') && !on(v, 'stopAtEnd')
/** A seam blends only when it is not a cut and it lasts time (journeyPath.seamBlends). */
const blends = (s: Stop) => s.kind !== 'cut' && s.tr > 0
/** The most a blend can last into a stop: the stop's own length, and 30 s (journeyPath.blendLimit). */
const limitOf = (s: Stop) => Math.min(BLEND_MAX, s.hold)

function where(v: V) {
  const S = stopsOf(v), at = clampTo(0, N - 1, Math.round(num(v, 'at'))), cur = S[at]!
  const local = clampTo(0, Math.max(0, cur.hold - 0.1), num(v, 'local'))
  const total = S.reduce((n, s) => n + s.hold, 0)
  // The blend in force: from the stop's start for its seconds, capped at the stop's length (journeyPath.seamStates). The first stop has no seam in the walk.
  const span = Math.min(cur.tr, cur.hold)
  const blend = at > 0 && blends(cur) && local < span ? local / span : null
  const next = at + 1 < N ? `Next: ${S[at + 1]!.name}` : wraps(v) ? `Next: ${S[0]!.name} (loops)` : on(v, 'docLoops') ? `Stops at the end of ${cur.name}` : 'The walk ends here.'
  return {S, at, cur, prev: S[at - 1], local, total, now: cur.start + local, blend, next}
}

/** Put the walk at a time: the stop it falls in and the seconds into that stop (half-open, like the owner's clock). */
function seek(p: {v: V; set: SetFn}, t: number, snap: boolean, perPx: number) {
  const S = stopsOf(p.v), total = S.reduce((n, s) => n + s.hold, 0)
  let time = clampTo(0, total - 0.1, t)
  if (snap) {
    const near = S.map(s => s.start).filter(start => Math.abs(start - time) < 6 * perPx).sort((a, b) => Math.abs(a - time) - Math.abs(b - time))[0]
    if (near !== undefined) time = near
  }
  const stop = [...S].reverse().find(s => s.start <= time) ?? S[0]!
  p.set('at', stop.i)
  p.set('local', round1(time - stop.start))
}

/** The pace of the stop you are on. A shorter stop keeps the walk inside it and keeps its blend inside it (blendLimit). */
function setHold(p: {v: V; set: SetFn}, x: number) {
  const i = Math.round(num(p.v, 'at')), hold = round1(clampTo(HOLD.min, HOLD.max, x))
  p.set(`hold:${i}`, hold)
  if (num(p.v, 'local') > hold - 0.1) p.set('local', round1(Math.max(0, hold - 0.1)))
  if (num(p.v, `tr:${i}`) > hold) p.set(`tr:${i}`, hold)
}
const setStop = (p: {v: V; set: SetFn}, i: number) => { p.set('at', i); p.set('local', 0) }

// ---------------------------------------------------------------- the displays

/** The progress law of a blend's curve (transitions.curveProgress over E08's segments): linear is the identity, hold waits for the
 * end, smooth is the smoothstep. A bezier without handles sits at the thirds, which is linear. */
const progress = (curve: string, f: number) => (curve === 'hold' ? (f >= 1 ? 1 : 0) : curve === 'smooth' ? f * f * (3 - 2 * f) : f)
/** The dip's weights (transitionMath.dipWeights): the colour is fully reached at `at`. */
const dipWeights = (e: number, at: number) => {
  if (e < at) { const out = 1 - e / at; return {out, col: 1 - out, inn: 0} }
  const col = 1 - (e - at) / (1 - at)
  return {out: 0, col, inn: 1 - col}
}

type Level = 'tile' | 'compact' | 'whole'

/** The walk: the stops on one ruler in proportion to their holds, a notch at the head of each stop for the way it arrives, the
 * stop the walk stands on lit with the time spent in it, and the stop and the one after it in words. */
function WalkDisplay({v, set, w, h, level}: {v: V; set?: SetFn; w: number; h: number; level: Level}) {
  const m = where(v), {S, at, cur, local, total, blend} = m
  const pad = level === 'tile' ? 5 : level === 'compact' ? 6 : 8
  const x0 = pad, x1 = w - pad, span = x1 - x0
  const ty = level === 'tile' ? 20 : level === 'compact' ? 24 : 20, th = level === 'tile' ? 40 : 28
  const xOf = (t: number) => x0 + t / total * span
  const lines = level === 'tile' ? [0, 80, 94] : level === 'compact' ? [88, 101, 114] : [76, 88, 100]
  const snap = on(v, 'snap'), perPx = total / span
  const px = (s: number) => x0 + Math.log(s) / Math.log(HOLD.max) * span
  const sy = 126
  const handleY = ty + th + 9
  return <Display w={w} h={h} label="The walk" does="The stops in order, each as long as it is held. Drag handle 1 to move along the walk. Drag handle 2 to set the pace of this stop."
    corner={`${at + 1}/${N}`}>
    {S.map(s => {
      const cx = xOf(s.start), cw = Math.max(2, s.hold / total * span), here = s.i === at
      const bw = Math.max(2.5, Math.min(s.tr, s.hold) / total * span)
      return <g key={s.i}>
        {(s.i < at || here) && <rect x={cx} y={ty} width={cw} height={th} className={here ? 'dp-fill-on' : 'dp-fill'} />}
        <rect x={cx + .5} y={ty + .5} width={Math.max(1, cw - 1)} height={th - 1} className="dp-faint" style={here ? {stroke: 'var(--dp-on)'} : undefined} />
        {here && <rect x={cx} y={ty + th - 3} width={cw * local / cur.hold} height={3} style={{fill: 'var(--dp-on)'}} />}
        {cw >= 11 && <text x={cx + 2.5} y={ty + 9} className="dp-axis">{s.i + 1}</text>}
        {s.i > 0 && (s.kind === 'cut' || s.tr <= 0
          ? <path d={`M${cx} ${ty}V${ty + th}`} className="dp-curve" strokeWidth={1.5} />
          : <path d={`M${cx} ${ty + th}h${bw}L${cx} ${ty + th - 8}Z`} style={{fill: here && blend !== null ? 'var(--dp-on)' : 'var(--dp-value)', opacity: .75}} />)}
      </g>
    })}
    <path d={`M${xOf(m.now)} ${ty - 3}V${ty + th + 3}`} className="dp-curve-on" />
    {set && <Handle n={1} x={xOf(m.now)} y={handleY} label="Playhead" does="Drag along the walk. It lands on the start of a stop when Snap is on."
      onDrag={x => seek({v, set}, (x - x0) / span * total, snap, perPx)} onReset={() => { set('at', 0); set('local', 0) }} />}
    {level !== 'tile' && <text x={x0} y={lines[0]} className="dp-ink" style={{fontSize: 11}}>{at + 1} · {cur.name}</text>}
    <text x={x0} y={lines[1]} className="dp-ink-dim">{round1(local).toFixed(1)} / {secs(cur.hold)}</text>
    {blend !== null && m.prev
      ? <text x={x0} y={lines[2]} className="dp-ink" style={{fill: 'var(--dp-on)'}}>{level === 'tile' ? `arriving · ${Math.round(blend * 100)} %` : level === 'compact' ? `${m.prev.name} → ${cur.name}` : `${m.prev.name} → ${cur.name} · ${Math.round(blend * 100)} %`}</text>
      : level !== 'tile' && <text x={x0} y={lines[2]} className="dp-ink-dim">{m.next}</text>}
    {level === 'compact' && <text x={x0} y={130} className="dp-ink-dim">{blends(cur) ? `${KIND_SHORT[cur.kind]} · ${secs(cur.tr)}` : 'Cut'}{blend !== null ? ` · ${Math.round(blend * 100)} %` : ''}</text>}
    {level === 'whole' && <>
      <text x={x0} y={114} className="dp-axis">pace of stop {at + 1}</text>
      <path d={`M${x0} ${sy}H${x1}`} className="dp-faint" />
      <path d={`M${x0} ${sy}H${px(cur.hold)}`} className="dp-curve-on" />
      {[1, 10, 60, 600, 3600].map((s, k) => <g key={s}>
        <path d={`M${px(s)} ${sy - 3}V${sy + 3}`} className="dp-faint" />
        <text x={px(s)} y={sy + 13} className="dp-axis" textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{['1 s', '10 s', '1 min', '10 min', '1 h'][k]}</text>
      </g>)}
      {set && <Handle n={2} shape="square" x={px(cur.hold)} y={sy} label="Pace" does="Drag along the ruler: how long the walk stays at this stop. The ruler is logarithmic, from 1 second to 1 hour."
        onDrag={x => setHold({v, set}, Math.exp(clampTo(0, 1, (x - x0) / span) * Math.log(HOLD.max)))} onReset={() => setHold({v, set}, HOLD_DEF)} />}
    </>}
  </Display>
}

/** The arrival into the stop you are on, drawn across its own length: how much of the new stop is in, and how much of the old.
 * The curve shapes the progress; the kind turns it into weights (app.ts paintTransition: blendProgress, then dipWeights or the
 * wipe). Under the plot, a ruler from 0 to the longest arrival carries the length. */
function SeamDisplay({v, set, w, h}: {v: V; set?: SetFn; w: number; h: number}) {
  const m = where(v), {cur, at} = m
  const limit = limitOf(cur), blending = blends(cur)
  const x0 = 28, x1 = w - 10, yTop = 26, yBot = 80, sy = 116
  const fx = (f: number) => x0 + f * (x1 - x0), yp = (p: number) => yBot - p * (yBot - yTop)
  const lx = (s: number) => x0 + s / limit * (x1 - x0)
  const dipAt = num(v, `atc:${at}`), K = 40
  const path = (fn: (f: number) => number) => Array.from({length: K + 1}, (_, k) => { const f = k / K; return `${k ? 'L' : 'M'}${fx(f).toFixed(1)} ${yp(fn(f)).toFixed(1)}` }).join('')
  const e = (f: number) => progress(cur.curve, f)
  const peak = Array.from({length: K + 1}, (_, k) => k / K).find(f => e(f) >= dipAt) ?? 1
  const dir = str(v, `dir:${at}`)
  const sw = SWITCHES.find(s => s.value === cur.sw)!
  const legend: {name: string; dash?: string}[] = !blending ? [] : cur.kind === 'wipe' ? [{name: `wipe ${dir}`}]
    : cur.kind === 'dip-to-colour' ? [{name: 'new'}, {name: 'old', dash: '3 3'}, {name: 'colour', dash: '1 3'}] : [{name: 'new'}, {name: 'old', dash: '3 3'}]
  return <Display w={w} h={h} label="The arrival" does="How the stop you are on takes over, across its arrival. Drag handle 1 along the ruler to set the length. On a dip, drag handle 2 to set where the colour is reached."
    corner={blending ? `${KIND_SHORT[cur.kind]} · ${secs(cur.tr)}` : 'Cut'}>
    <text x={x0} y={14} className="dp-ink-dim">into {at + 1} · {cur.name}</text>
    {[0, .5, 1].map(q => <path key={q} d={`M${x0} ${yp(q)}H${x1}`} className="dp-grid" />)}
    <path d={`M${x0} ${yp(0)}V${yp(1)}`} className="dp-faint" />
    <text x={x0 - 4} y={yp(1) + 3} className="dp-axis" textAnchor="end">1</text>
    <text x={x0 - 4} y={yp(0) + 3} className="dp-axis" textAnchor="end">0</text>
    <text x={x0} y={yBot + 12} className="dp-axis">0</text>
    <text x={x1} y={yBot + 12} className="dp-axis" textAnchor="end">{blending ? secs(cur.tr) : '0 s'}</text>
    {!blending ? <>
      <path d={`M${x0} ${yp(0)}V${yp(1)}H${x1}`} className="dp-curve" />
      <text x={(x0 + x1) / 2} y={yp(.45)} className="dp-ink-dim" textAnchor="middle">{cur.kind === 'cut' ? 'A cut blends nothing.' : 'No seconds, so no blend.'}</text>
    </> : <>
      {cur.kind === 'dip-to-colour' ? <>
        <path d={path(f => dipWeights(e(f), dipAt).out)} className="dp-faint" strokeDasharray="3 3" />
        <path d={path(f => dipWeights(e(f), dipAt).col)} className="dp-faint" strokeDasharray="1 3" />
        <path d={path(f => dipWeights(e(f), dipAt).inn)} className="dp-curve" />
      </> : <>
        {cur.kind === 'crossfade' && <path d={path(f => 1 - e(f))} className="dp-faint" strokeDasharray="3 3" />}
        <path d={cur.curve === 'hold' ? `M${x0} ${yp(0)}H${x1}V${yp(1)}` : path(e)} className="dp-curve" />
      </>}
      {cur.curve === 'bezier' && [1 / 3, 2 / 3].map(f => <circle key={f} cx={fx(f)} cy={yp(f)} r={1.8} className="dp-faint" />)}
      {set && cur.kind === 'dip-to-colour' && <Handle n={2} shape="square" x={fx(peak)} y={yp(1)} label="Colour reached" does="Drag left or right: where in the arrival the stop is fully the colour."
        onDrag={x => set(`atc:${at}`, Math.round(clampTo(DIP_MIN, DIP_MAX, e(clampTo(0, 1, (x - x0) / (x1 - x0)))) * 20) / 20)} onReset={() => set(`atc:${at}`, DIP_DEF)} />}
    </>}
    <text x={x0} y={sy - 10} className="dp-axis">length</text>
    <path d={`M${x0} ${sy}H${x1}`} className="dp-faint" />
    <path d={`M${x0} ${sy}H${lx(blending ? cur.tr : 0)}`} className="dp-curve-on" />
    <path d={`M${x0} ${sy - 3}V${sy + 3}M${x1} ${sy - 3}V${sy + 3}`} className="dp-faint" />
    <text x={x0} y={sy + 12} className="dp-axis">0</text>
    <text x={x1} y={sy + 12} className="dp-axis" textAnchor="end">{secs(limit)}</text>
    {set && cur.kind !== 'cut' && <Handle n={1} x={lx(cur.tr)} y={sy} label="Arrival length" does="Drag along the ruler: how long the arrival lasts. It stops at the length of this stop, or 30 seconds."
      onDrag={x => set(`tr:${at}`, round1(clampTo(0, limit, (x - x0) / (x1 - x0) * limit)))} onReset={() => set(`tr:${at}`, Math.min(BLEND_DEF, cur.hold))} />}
    {legend.map((item, k) => <g key={item.name}>
      <path d={`M${x0 + k * 46} 141h10`} className={item.dash ? 'dp-faint' : 'dp-curve'} strokeDasharray={item.dash} />
      <text x={x0 + k * 46 + 13} y={144} className="dp-axis">{item.name}</text>
    </g>)}
    <text x={x1} y={144} className="dp-axis" textAnchor="end">{sw.label.toLowerCase()}</text>
  </Display>
}

// ---------------------------------------------------------------- controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

/** Why the seam controls rest on the first stop: nothing comes before it, so its arrival plays only when the walk wraps. */
const seamWhy = (v: V) => (num(v, 'at') === 0 && !wraps(v) ? 'Stop 1 has no stop before it. Its arrival plays only when the walk loops.' : undefined)

const StopDial = (p: ViewProps) => <Dial label="Stop" does="The stop the walk stands on. Turn it to play from another stop." value={Math.round(num(p.v, 'at'))} def={0}
  scale={{min: 0, max: N - 1, step: 1}} format={x => `${x + 1}`} onChange={x => setStop(p, x)} />
const PaceDial = (p: ViewProps) => <Dial label="Pace" does="How long the walk stays at this stop. The range is 1 second to 1 hour." value={where(p.v).cur.hold} def={HOLD_DEF} scale={HOLD}
  format={secs} onChange={x => setHold(p, x)} />
const LoopToggle = (p: ViewProps) => <Toggle label="Loop" does="Repeat the walk from the first stop. Off stops the walk at the end of the last stop."
  on={wraps(p.v)} onChange={x => p.set('stopAtEnd', !x)} disabled={on(p.v, 'docLoops') ? undefined : 'This walk does not loop, and no operation turns looping on.'} />
const ArrivalRadio = (p: ViewProps) => {
  const i = Math.round(num(p.v, 'at'))
  return <Radio label="Arrival" does="How the walk reaches this stop." value={str(p.v, `kind:${i}`)} options={KINDS} stack onChange={x => p.set(`kind:${i}`, x)} disabled={seamWhy(p.v)} />
}

// ---------------------------------------------------------------- the pane

function JourneyPane({v}: {v: V}) {
  const m = where(v), {S, at} = m
  const tail = (s: Stop) => [s.sw !== 'immediate' ? SWITCHES.find(x => x.value === s.sw)!.label : null, s.curve !== 'linear' ? CURVES.find(x => x.value === s.curve)!.label : null].filter(Boolean)
  const seamLabel = (s: Stop) => [blends(s) ? `${KIND_LONG[s.kind]} · ${secs(s.tr)}` : 'Cut', ...(blends(s) ? tail(s) : s.sw !== 'immediate' ? [SWITCHES.find(x => x.value === s.sw)!.label] : [])].join(' · ')
  const last = S[N - 1]!
  const end = wraps(v) ? `Loops to ${S[0]!.name}` : on(v, 'docLoops') ? `Stops at the end of ${last.name}` : 'Ends here'
  return <div className="jn-pane">
    <div className="jn-head"><b>{WALK_NAME}</b><span>{N} stops</span><span>{clockOf(m.total)}</span><span>{end}</span></div>
    <div className="jn-cols"><span>#</span><span>Scene</span><span>Place</span><span>Moment</span><span>Thing</span><span>Narration</span><span>Pace</span></div>
    <ol className="jn-rows">
      {S.map(s => <li key={s.i} style={{display: 'contents'}}>
        {s.i > 0 && <div className="jn-seam" data-live={s.i === at && m.blend !== null ? 'true' : undefined}>
          <span className="jn-seam-bar"><i style={{'--p': s.i === at && m.blend !== null ? m.blend : s.i < at ? 1 : 0} as CSSProperties} /></span>
          <span>{seamLabel(s)}</span>
          {s.i === at && m.blend !== null && <b>{Math.round(m.blend * 100)} %</b>}
        </div>}
        <div className="jn-stop" data-current={s.i === at ? 'true' : undefined} data-passed={s.i < at ? 'true' : undefined}>
          <span className="jn-n">{s.i + 1}</span>
          <span className="jn-scene">{s.name}{s.i === at + 1 && <span className="jn-tag">next</span>}</span>
          <span className="jn-none">no place</span><span className="jn-none">no moment</span><span className="jn-none">no thing</span>
          <span className="jn-words">{str(v, `words:${s.i}`) || '—'}</span>
          <span className="jn-hold">{secs(s.hold)}</span>
        </div>
      </li>)}
    </ol>
    <div className="jn-foot"><span>{m.next}</span><span>{wraps(v) ? `Wrap: ${KIND_LONG[S[0]!.kind]} · ${secs(S[0]!.tr)}` : ''}</span></div>
  </div>
}

// ---------------------------------------------------------------- the device

function perStop(): Record<string, number | string | boolean> {
  const o: Record<string, number | string | boolean> = {}
  STOPS.forEach(([, words], i) => {
    o[`hold:${i}`] = 14; o[`tr:${i}`] = BLEND_DEF; o[`kind:${i}`] = 'crossfade'; o[`curve:${i}`] = 'linear'; o[`sw:${i}`] = 'immediate'
    o[`dir:${i}`] = 'left'; o[`atc:${i}`] = DIP_DEF; o[`words:${i}`] = words
  })
  return o
}

export const design: DesignedDevice = {
  id: 'techne:journey',
  title: 'Journey',
  kind: 'instrument',
  firstPage: 'walk',
  defaults: {
    light: 'lit', at: 2, local: 0.6, playing: false, entered: false, docLoops: true, stopAtEnd: false, snap: true, takes: 2, take: '2', ...perStop(),
  },
  fixtures: {
    'Mid-walk': {},
    'Reworked seams': {
      at: 4, local: 1.1, stopAtEnd: true,
      'hold:1': 6, 'hold:2': 30, 'hold:5': 45, 'hold:7': 20,
      'kind:1': 'cut', 'kind:2': 'dip-to-colour', 'atc:2': 0.35, 'tr:2': 4, 'curve:2': 'hold',
      'kind:4': 'wipe', 'dir:4': 'right', 'tr:4': 2.5, 'curve:4': 'smooth', 'sw:3': 'sync', 'sw:6': 'at-end',
    },
    'Plays once': {docLoops: false, at: 7, local: 9},
  },

  folded: p => <Folded title="Journey" light={light(p.v)} readings={[`${where(p.v).at + 1}/${N}`, where(p.v).cur.name]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Journey" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><WalkDisplay v={p.v} set={p.set} w={140} h={146} level="compact" /></Section>
    <Section label="Macros" cols={2}>
      {StopDial(p)}
      {PaceDial(p)}
      {ArrivalRadio(p)}
      {LoopToggle(p)}
    </Section>
  </Panel>,

  whole: p => <JourneyWhole p={p} />,

  full: p => <JourneyPane v={p.v} />,

  widget: p => {
    const m = where(p.v)
    return <Tile title={`Journey · ${WALK_NAME}`} light={light(p.v)} span={2} onFull={p.nav.full}>
      <WalkDisplay v={p.v} w={112} h={104} level="tile" />
      <div className="jn-tile-side">
        <div>
          <b className="jn-tile-name">{m.at + 1} · {m.cur.name}</b>
          <p className="jn-tile-words">{str(p.v, `words:${m.at}`)}</p>
        </div>
        <div className="jn-tile-row">
          <Action label={on(p.v, 'playing') ? 'Stop' : 'Play'} does="Walk the stops from here. The walk stays on the rail when you change mode." onPress={() => p.set('playing', !on(p.v, 'playing'))} />
          <Readout label="left" does="The time left at this stop." value={secs(Math.max(0, m.cur.hold - m.local))} />
        </div>
      </div>
    </Tile>
  },
}

function JourneyWhole({p}: {p: ViewProps}) {
  const m = where(p.v), {cur, at} = m
  const i = at
  const dipOn = cur.kind === 'dip-to-colour', wipeOn = cur.kind === 'wipe', cutOn = cur.kind === 'cut'
  const why = seamWhy(p.v)
  const takes = Math.max(1, Math.round(num(p.v, 'takes')))
  const rows: RowItem[] = m.S.map(s => ({id: String(s.i), name: `${s.i + 1} · ${s.name}`, light: s.i === at ? 'lit' : 'dark', tone: 'accent', note: secs(s.hold),
    meter: <span className="jn-row-arrival">{s.i === 0 ? (wraps(p.v) ? 'wrap' : '—') : blends(s) ? `${KIND_SHORT[s.kind]} · ${secs(s.tr)}` : 'Cut'}</span>}))
  return <Panel title="Journey" view="whole" {...head(p)} pages={[{id: 'walk', label: 'Walk'}, {id: 'seams', label: 'Transitions'}]} page={p.page} onPage={p.setPage}>
    {p.page !== 'seams' ? <>
      <Band>
        <Section width={206}><WalkDisplay v={p.v} set={p.set} w={194} h={146} level="whole" /></Section>
        <Section label="Walk" cols={3} grow>
          {StopDial(p)}
          {PaceDial(p)}
          <Readout label="length" does="How long the whole walk lasts, all the stops together." value={clockOf(m.total)} />
          {LoopToggle(p)}
          <Toggle label="Snap" does="Drags land on the start of a stop. Hold Alt to drag free." on={on(p.v, 'snap')} onChange={x => p.set('snap', x)} />
          <Action label={on(p.v, 'entered') ? 'Return' : 'Enter'} does="Go into this stop's scene in its Expression. Return comes back to the same stop." onPress={() => p.set('entered', !on(p.v, 'entered'))} />
        </Section>
      </Band>
      <Band>
        <Section width={206}>
          <Rows label="Stops" does="The stops in order. A lit row is the stop the walk stands on; the note is how long it is held." items={rows} size={N} />
        </Section>
        <Section label="Narration" grow>
          <TextField label={`Stop ${i + 1} · ${cur.name}`} does="The words the guide speaks at this stop." wide placeholder="Narration for this stop"
            value={str(p.v, `words:${i}`)} onChange={x => p.set(`words:${i}`, x)} />
          <Chooser label="Take" does="The recorded take that stands." wide value={str(p.v, 'take')}
            options={Array.from({length: takes}, (_, k) => ({value: String(k + 1), label: k + 1 === takes ? `Take ${k + 1} · latest` : `Take ${k + 1}`}))} onChange={x => p.set('take', x)} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}><SeamDisplay v={p.v} set={p.set} w={194} h={146} /></Section>
        <Section label="Arrival" cols={3} grow>
          {ArrivalRadio(p)}
          <Dial label="Time" does="How long the arrival lasts. It cannot pass the length of this stop." value={Math.min(cur.tr, limitOf(cur))} def={Math.min(BLEND_DEF, limitOf(cur))}
            scale={{min: 0, max: limitOf(cur)}} format={x => `${+x.toFixed(1)} s`} onChange={x => p.set(`tr:${i}`, round1(x))} disabled={why ?? (cutOn ? 'A cut has no length.' : undefined)} />
          <Readout label="longest" does="The longest an arrival can last: the length of this stop, or 30 seconds." value={secs(limitOf(cur))} />
        </Section>
      </Band>
      <Band>
        <Section label="Curve" width={72}>
          <Radio does="The shape of the arrival's progress." value={cur.curve} options={CURVES} stack onChange={x => p.set(`curve:${i}`, x)} disabled={why ?? (cutOn ? 'A cut takes no curve.' : undefined)} />
        </Section>
        <Section label="Switch" width={72}>
          <Radio does="When the next stop takes over." value={cur.sw} options={SWITCHES} stack onChange={x => p.set(`sw:${i}`, x)} disabled={why} />
        </Section>
        <Section label="Kind" grow>
          <Dial label="Colour at" does="Where in the arrival the stop is fully the colour. Only a dip has it." value={num(p.v, `atc:${i}`)} def={DIP_DEF} scale={{min: DIP_MIN, max: DIP_MAX, step: 0.05}}
            format={x => `${Math.round(x * 100)} %`} onChange={x => p.set(`atc:${i}`, x)} disabled={why ?? (dipOn ? undefined : 'Only a dip to colour reaches a colour.')} />
          <Chooser label="Direction" does="The way the wipe travels. Only a wipe has it." value={str(p.v, `dir:${i}`)} options={DIRECTIONS} wide onChange={x => p.set(`dir:${i}`, x)}
            disabled={why ?? (wipeOn ? undefined : 'Only a wipe has a direction.')} />
        </Section>
      </Band>
    </>}
  </Panel>
}
