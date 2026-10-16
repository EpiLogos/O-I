// The Journey (manual §17.5): Technē's walk through scenes, stop by stop. Live's nearest: Simpler's Slice mode — a ruler cut into
// slices, a playhead through them, and a length and a join for each. The owner is the research frame (field-studies-journeys:
// journeyInstrument.tsx, journeyPath.ts walkJourney / edgeRows, transitions.ts, journeyPace.ts, model.ts Scene.duration and
// Scene.transition) and the engine's transition law (src/engine/transitionMath.ts). The fixture is the frame's own "Field studies"
// journey (model.ts fieldStudies): eight scenes of 14 s, joined by 1.5 s crossfades, looping.
import {useState, type CSSProperties} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import './techne__journey.css'

type V = ViewProps['v']

/** The owner's bounds and defaults: a scene holds 1 s to 1 h (model.ts SCENE_DURATION_*), a blend lasts 0 to 30 s and never past
 * the stop it enters (SCENE_TRANSITION_*, journeyPath.blendLimit); a new scene holds 12 s with a 1.5 s blend (blankScene). */
const HOLD = {min: 1, max: 3600, log: true}
const BLEND_MAX = 30
const HOLD_DEF = 12, BLEND_DEF = 1.5
const DIP_MIN = 0.2, DIP_MAX = 0.8, DIP_DEF = 0.5
/** The stops one page of the pool's list shows. */
const PAGE = 8

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
type Curve = (typeof CURVES)[number]['value']
const SWITCHES = [
  {value: 'immediate', label: 'Immediate', does: 'The next stop takes over when you ask for it.'},
  {value: 'sync', label: 'Sync', does: 'The next stop starts at the same point in its own time as the stop you leave.'},
  {value: 'at-end', label: 'At end', does: 'The next stop waits until the stop you leave has ended.'},
] as const
type Switch = (typeof SWITCHES)[number]['value']
const DIRECTIONS = [{value: 'left', label: 'Left'}, {value: 'right', label: 'Right'}, {value: 'up', label: 'Up'}, {value: 'down', label: 'Down'}] as const

const secs = (x: number) => (x >= 3600 ? `${+(x / 3600).toFixed(1)} h` : x >= 60 ? `${+(x / 60).toFixed(1)} min` : `${+x.toFixed(1)} s`)
const clockOf = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`
const round1 = (x: number) => Math.round(x * 10) / 10

const NO_STOP = 'No reading of the stop the walk stands on.'
const NO_KIND = 'No reading of how this stop is arrived at.'

// ---------------------------------------------------------------- the walk read from the values

/** A reading that is a finite number; undefined while the owner has not reported it. */
const quantity = (v: V, key: string): number | undefined => { const x = numOf(v, key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const textOf = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const oneOf = <T extends string>(options: readonly {readonly value: T}[], x: string | undefined): T | undefined => options.find(o => o.value === x)?.value

/** One stop as the owner reports it. Every reading is undefined while it is unreported. */
interface Stop {
  readonly i: number
  readonly name: string
  /** Where the stop begins on the walk's clock (journeyTimelineLayout: the sum of the holds before it), undefined while one of those holds is unreported. */
  readonly start: number | undefined
  readonly hold: number | undefined
  readonly tr: number | undefined
  readonly kind: Kind | undefined
  readonly curve: Curve | undefined
  readonly sw: Switch | undefined
}

/** The names the owner lists: `stops` is a JSON list of [name, character]. */
const listedNames = (v: V): (string | undefined)[] => {
  const list = json<unknown>(v, 'stops', [])
  return Array.isArray(list) ? list.map(entry => textOf(Array.isArray(entry) ? entry[0] : entry)) : []
}

/** The stops in order, each with its start on the walk's clock. A stop's own `name:i` wins over the list's name when it is reported. */
const stopsOf = (v: V): Stop[] => {
  let t: number | undefined = 0
  return listedNames(v).map((listed, i) => {
    const held = quantity(v, `hold:${i}`), hold = held !== undefined && held > 0 ? held : undefined
    const stop: Stop = {i, name: textOf(strOf(v, `name:${i}`)) ?? listed ?? NONE, start: t, hold, tr: quantity(v, `tr:${i}`),
      kind: oneOf(KINDS, strOf(v, `kind:${i}`)), curve: oneOf(CURVES, strOf(v, `curve:${i}`)), sw: oneOf(SWITCHES, strOf(v, `sw:${i}`))}
    t = t === undefined || hold === undefined ? undefined : t + hold
    return stop
  })
}

/** Whether the walk wraps from its last stop to its first: the document loops and its last stop is not a loop exit (journeyPath.walkJourney).
 * Undefined while the readings that decide it are unreported. */
const wraps = (v: V): boolean | undefined => {
  const loops = boolOf(v, 'docLoops'), exits = boolOf(v, 'stopAtEnd')
  return loops === false || exits === true ? false : loops === true && exits === false ? true : undefined
}

/** How a stop is arrived at: undefined while unreported, 'cut' when nothing blends, else the kind and its seconds. A seam blends only
 * when it is not a cut and it lasts time (journeyPath.seamBlends). */
type Arrival = {readonly kind: Kind; readonly secs: number} | 'cut' | undefined
const arrivalOf = (s: Stop | undefined): Arrival =>
  s === undefined || s.kind === undefined ? undefined : s.kind === 'cut' ? 'cut' : s.tr === undefined ? undefined : s.tr > 0 ? {kind: s.kind, secs: s.tr} : 'cut'
const arrivalShort = (s: Stop | undefined): string => { const a = arrivalOf(s); return a === undefined ? NONE : a === 'cut' ? 'Cut' : `${KIND_SHORT[a.kind]} · ${secs(a.secs)}` }
/** The most a blend can last into a stop: the stop's own length, and 30 s (journeyPath.blendLimit). */
const limitOf = (s: Stop | undefined): number | undefined => (s?.hold === undefined ? undefined : Math.min(BLEND_MAX, s.hold))

function where(v: V) {
  const S = stopsOf(v), n = S.length
  const reported = quantity(v, 'at')
  const at = reported === undefined || n === 0 ? undefined : clampTo(0, n - 1, Math.round(reported))
  const cur = at === undefined ? undefined : S[at]
  const spoken = quantity(v, 'local')
  const local = spoken === undefined ? undefined : clampTo(0, cur?.hold === undefined ? Infinity : Math.max(0, cur.hold - 0.1), spoken)
  const total = n > 0 && S.every(s => s.hold !== undefined) ? S.reduce((sum, s) => sum + (s.hold ?? 0), 0) : undefined
  const now = cur?.start !== undefined && local !== undefined ? cur.start + local : undefined
  // The blend in force: from the stop's start for its seconds, capped at the stop's length (journeyPath.seamStates). The first stop has no seam in the walk.
  const arrival = arrivalOf(cur)
  const span = typeof arrival === 'object' && cur?.hold !== undefined ? Math.min(arrival.secs, cur.hold) : undefined
  const blend = at !== undefined && at > 0 && local !== undefined && span !== undefined && local < span ? local / span : null
  const loops = wraps(v), docLoops = boolOf(v, 'docLoops')
  const next = at === undefined || cur === undefined ? undefined
    : at + 1 < n ? `Next: ${S[at + 1]?.name ?? NONE}`
    : loops === true ? `Next: ${S[0]?.name ?? NONE} (loops)`
    : loops === false ? (docLoops === true ? `Stops at the end of ${cur.name}` : docLoops === false ? 'The walk ends here.' : undefined)
    : undefined
  return {S, n, at, cur, prev: at === undefined ? undefined : S[at - 1], local, total, now, blend, next}
}
type Where = ReturnType<typeof where>

/** Put the walk at a time: the stop it falls in and the seconds into that stop (half-open, like the owner's clock). Nothing moves while a hold is unreported. */
function seek(p: ViewProps, t: number, snap: boolean, perPx: number) {
  const {S, total} = where(p.v)
  if (total === undefined) return
  let time = clampTo(0, total - 0.1, t)
  if (snap) {
    const near = S.map(s => s.start ?? 0).filter(start => Math.abs(start - time) < 6 * perPx).sort((a, b) => Math.abs(a - time) - Math.abs(b - time))[0]
    if (near !== undefined) time = near
  }
  const stop = [...S].reverse().find(s => (s.start ?? 0) <= time) ?? S[0]
  if (stop === undefined) return
  p.set('at', stop.i)
  p.set('local', round1(time - (stop.start ?? 0)))
}

/** The pace of the stop you are on. A shorter stop keeps the walk inside it and keeps its blend inside it (blendLimit). */
function setHold(p: ViewProps, x: number) {
  const {at, cur} = where(p.v)
  if (at === undefined) return
  const hold = round1(clampTo(HOLD.min, HOLD.max, x)), local = quantity(p.v, 'local')
  p.set(`hold:${at}`, hold)
  if (local !== undefined && local > hold - 0.1) p.set('local', round1(Math.max(0, hold - 0.1)))
  if (cur?.tr !== undefined && cur.tr > hold) p.set(`tr:${at}`, hold)
}
const setStop = (p: ViewProps, i: number) => {
  const {n} = where(p.v)
  if (n === 0) return
  p.set('at', clampTo(0, n - 1, Math.round(i)))
  p.set('local', 0)
}

/** The standing of a per-stop key (`hold:3`) for the stop the walk stands on; none while it stands on no stop. */
const stAt = (p: ViewProps, name: string, at: number | undefined): Standing => (at === undefined ? {} : st(p, `${name}:${at}`))
/** The standing the host reports, with the view's own reason for resting where the host gives none. */
const stand = (s: Standing, own?: string): Standing => (own === undefined || s.disabled !== undefined ? s : {...s, disabled: own})
/** The host's reason, if any of these keys stands disabled: a handle that drags them rests too. */
const stopped = (p: ViewProps, ...keys: string[]) => keys.map(k => st(p, k).disabled).find(Boolean)
const asked = (does: string, why: string | undefined) => (why ? `${does} ${why}` : does)

// ---------------------------------------------------------------- the displays

/** The progress law of a blend's curve (transitions.curveProgress over E08's segments): linear is the identity, hold waits for the
 * end, smooth is the smoothstep. A bezier without handles sits at the thirds, which is linear. */
const progress = (curve: string | undefined, f: number) => (curve === 'hold' ? (f >= 1 ? 1 : 0) : curve === 'smooth' ? f * f * (3 - 2 * f) : f)
/** The dip's weights (transitionMath.dipWeights): the colour is fully reached at `at`. */
const dipWeights = (e: number, at: number) => {
  if (e < at) { const out = 1 - e / at; return {out, col: 1 - out, inn: 0} }
  const col = 1 - (e - at) / (1 - at)
  return {out: 0, col, inn: 1 - col}
}

type Level = 'tile' | 'compact' | 'whole'

/** A reading the picture needs and the owner has not reported, said in words in the well. */
const Said = ({x, y, lines}: {x: number; y: number; lines: readonly string[]}) =>
  <>{lines.map((line, k) => <text key={k} x={x} y={y + k * 12} className="dp-ink-dim" textAnchor="middle">{line}</text>)}</>

/** The walk: the stops on one ruler in proportion to their holds, a notch at the head of each stop for the way it arrives, the
 * stop the walk stands on lit with the time spent in it, and the stop and the one after it in words. */
function WalkDisplay({p, w, h, level}: {p: ViewProps; w: number; h: number; level: Level}) {
  const {v, set} = p, live = level !== 'tile'
  const m = where(v), {S, n, at, cur, local, total, blend} = m
  const pad = level === 'tile' ? 5 : level === 'compact' ? 6 : 8
  const x0 = pad, x1 = w - pad, span = x1 - x0
  const ty = level === 'tile' ? 20 : level === 'compact' ? 24 : 20, th = level === 'tile' ? 40 : 28
  const xOf = (t: number) => x0 + t / (total ?? 1) * span
  const lines = level === 'tile' ? [0, 80, 94] : level === 'compact' ? [88, 101, 114] : [76, 88, 100]
  const snap = boolOf(v, 'snap') === true, perPx = (total ?? 0) / span
  const px = (s: number) => x0 + Math.log(s) / Math.log(HOLD.max) * span
  const sy = 126
  const handleY = ty + th + 9
  const headWhy = stopped(p, 'at', 'local')
  const paceWhy = at === undefined ? undefined : stopped(p, `hold:${at}`)
  return <Display w={w} h={h} label="The walk" does="The stops in order, each as long as it is held. Drag handle 1 to move along the walk. Drag handle 2 to set the pace of this stop."
    corner={at === undefined ? NONE : `${at + 1}/${n}`}>
    {total === undefined
      ? <Said x={w / 2} y={ty + th / 2 - 2} lines={n === 0 ? ['No reading', 'of the stops'] : ['No reading of', 'the pace']} />
      : S.map(s => {
        const hold = s.hold ?? 0, cx = xOf(s.start ?? 0), cw = Math.max(2, hold / total * span), here = s.i === at, passed = at !== undefined && s.i < at
        const a = arrivalOf(s), bw = typeof a === 'object' ? Math.max(2.5, Math.min(a.secs, hold) / total * span) : 0
        return <g key={s.i}>
          {(passed || here) && <rect x={cx} y={ty} width={cw} height={th} className={here ? 'dp-fill-on' : 'dp-fill'} />}
          <rect x={cx + .5} y={ty + .5} width={Math.max(1, cw - 1)} height={th - 1} className="dp-faint" style={here ? {stroke: 'var(--dp-on)'} : undefined} />
          {here && local !== undefined && <rect x={cx} y={ty + th - 3} width={cw * local / hold} height={3} style={{fill: 'var(--dp-on)'}} />}
          {cw >= 11 && <text x={cx + 2.5} y={ty + 9} className="dp-axis">{s.i + 1}</text>}
          {s.i > 0 && a !== undefined && (a === 'cut'
            ? <path d={`M${cx} ${ty}V${ty + th}`} className="dp-curve" strokeWidth={1.5} />
            : <path d={`M${cx} ${ty + th}h${bw}L${cx} ${ty + th - 8}Z`} style={{fill: here && blend !== null ? 'var(--dp-on)' : 'var(--dp-value)', opacity: .75}} />)}
        </g>
      })}
    {total !== undefined && m.now !== undefined && <path d={`M${xOf(m.now)} ${ty - 3}V${ty + th + 3}`} className="dp-curve-on" />}
    {live && total !== undefined && m.now !== undefined && <Handle n={1} x={xOf(m.now)} y={handleY} label="Playhead"
      does={asked('Drag along the walk. It lands on the start of a stop when Snap is on.', headWhy)}
      onDrag={headWhy ? undefined : x => seek(p, (x - x0) / span * total, snap, perPx)} onReset={headWhy ? undefined : () => { set('at', 0); set('local', 0) }} />}
    {level !== 'tile' && <text x={x0} y={lines[0]} className="dp-ink" style={{fontSize: 11}}>{at === undefined || cur === undefined ? NONE : `${at + 1} · ${cur.name}`}</text>}
    <text x={x0} y={lines[1]} className="dp-ink-dim">{local === undefined ? NONE : round1(local).toFixed(1)} / {cur?.hold === undefined ? NONE : secs(cur.hold)}</text>
    {blend !== null && m.prev && cur
      ? <text x={x0} y={lines[2]} className="dp-ink" style={{fill: 'var(--dp-on)'}}>{level === 'tile' ? `arriving · ${Math.round(blend * 100)} %` : level === 'compact' ? `${m.prev.name} → ${cur.name}` : `${m.prev.name} → ${cur.name} · ${Math.round(blend * 100)} %`}</text>
      : level !== 'tile' && <text x={x0} y={lines[2]} className="dp-ink-dim">{m.next ?? NONE}</text>}
    {level === 'compact' && <text x={x0} y={130} className="dp-ink-dim">{arrivalShort(cur)}{blend !== null ? ` · ${Math.round(blend * 100)} %` : ''}</text>}
    {level === 'whole' && <>
      <text x={x0} y={114} className="dp-axis">pace of stop {at === undefined ? NONE : at + 1}</text>
      <path d={`M${x0} ${sy}H${x1}`} className="dp-faint" />
      {cur?.hold !== undefined && <path d={`M${x0} ${sy}H${px(cur.hold)}`} className="dp-curve-on" />}
      {[1, 10, 60, 600, 3600].map((s, k) => <g key={s}>
        <path d={`M${px(s)} ${sy - 3}V${sy + 3}`} className="dp-faint" />
        <text x={px(s)} y={sy + 13} className="dp-axis" textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{['1 s', '10 s', '1 min', '10 min', '1 h'][k]}</text>
      </g>)}
      {cur?.hold !== undefined && <Handle n={2} shape="square" x={px(cur.hold)} y={sy} label="Pace"
        does={asked('Drag along the ruler: how long the walk stays at this stop. The ruler is logarithmic, from 1 second to 1 hour.', paceWhy)}
        onDrag={paceWhy ? undefined : x => setHold(p, Math.exp(clampTo(0, 1, (x - x0) / span) * Math.log(HOLD.max)))} onReset={paceWhy ? undefined : () => setHold(p, HOLD_DEF)} />}
    </>}
  </Display>
}

/** The arrival into the stop you are on, drawn across its own length: how much of the new stop is in, and how much of the old.
 * The curve shapes the progress; the kind turns it into weights (app.ts paintTransition: blendProgress, then dipWeights or the
 * wipe). Under the plot, a ruler from 0 to the longest arrival carries the length. */
function SeamDisplay({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const {v, set} = p
  const m = where(v), {cur, at} = m
  const arrival = arrivalOf(cur), limit = limitOf(cur)
  const x0 = 28, x1 = w - 10, yTop = 26, yBot = 80, sy = 116
  const fx = (f: number) => x0 + f * (x1 - x0), yp = (q: number) => yBot - q * (yBot - yTop)
  const lx = (secs: number) => x0 + secs / (limit ?? 1) * (x1 - x0)
  const dipRead = at === undefined ? undefined : quantity(v, `atc:${at}`), dipAt = dipRead !== undefined && dipRead > 0 && dipRead < 1 ? dipRead : undefined, K = 40
  const path = (fn: (f: number) => number) => Array.from({length: K + 1}, (_, k) => { const f = k / K; return `${k ? 'L' : 'M'}${fx(f).toFixed(1)} ${yp(fn(f)).toFixed(1)}` }).join('')
  const e = (f: number) => progress(cur?.curve, f)
  const peak = dipAt === undefined ? undefined : Array.from({length: K + 1}, (_, k) => k / K).find(f => e(f) >= dipAt) ?? 1
  const dir = at === undefined ? undefined : oneOf(DIRECTIONS, strOf(v, `dir:${at}`))
  const sw = SWITCHES.find(x => x.value === cur?.sw)
  const blending = typeof arrival === 'object'
  const legend: {name: string; dash?: string}[] = !blending ? [] : arrival.kind === 'wipe' ? [{name: `wipe ${dir ?? NONE}`}]
    : arrival.kind === 'dip-to-colour' ? [{name: 'new'}, {name: 'old', dash: '3 3'}, {name: 'colour', dash: '1 3'}] : [{name: 'new'}, {name: 'old', dash: '3 3'}]
  // A dip's three names sit closer, so the last does not run into the switch's name at the right.
  const gap = legend.length > 2 ? 34 : 46
  // What the plot needs and the owner has not reported.
  const missing = cur === undefined ? 'the stop' : arrival === undefined ? (cur.kind === undefined ? 'the arrival kind' : 'the arrival length')
    : blending && cur.curve === undefined ? 'the curve' : blending && arrival.kind === 'dip-to-colour' && dipAt === undefined ? 'where the colour is reached' : undefined
  const lengthWhy = at === undefined ? undefined : stopped(p, `tr:${at}`)
  const colourWhy = at === undefined ? undefined : stopped(p, `atc:${at}`)
  return <Display w={w} h={h} label="The arrival" does="How the stop you are on takes over, across its arrival. Drag handle 1 along the ruler to set the length. On a dip, drag handle 2 to set where the colour is reached."
    corner={arrivalShort(cur)}>
    <text x={x0} y={14} className="dp-ink-dim">into {at === undefined || cur === undefined ? NONE : `${at + 1} · ${cur.name}`}</text>
    {[0, .5, 1].map(q => <path key={q} d={`M${x0} ${yp(q)}H${x1}`} className="dp-grid" />)}
    <path d={`M${x0} ${yp(0)}V${yp(1)}`} className="dp-faint" />
    <text x={x0 - 4} y={yp(1) + 3} className="dp-axis" textAnchor="end">1</text>
    <text x={x0 - 4} y={yp(0) + 3} className="dp-axis" textAnchor="end">0</text>
    <text x={x0} y={yBot + 12} className="dp-axis">0</text>
    <text x={x1} y={yBot + 12} className="dp-axis" textAnchor="end">{arrival === undefined ? NONE : blending ? secs(arrival.secs) : '0 s'}</text>
    {missing !== undefined ? <Said x={(x0 + x1) / 2} y={yp(.5) - 2} lines={['No reading of', missing]} />
      : arrival === 'cut' ? <>
        <path d={`M${x0} ${yp(0)}V${yp(1)}H${x1}`} className="dp-curve" />
        <text x={(x0 + x1) / 2} y={yp(.45)} className="dp-ink-dim" textAnchor="middle">{cur?.kind === 'cut' ? 'A cut blends nothing.' : 'No seconds, so no blend.'}</text>
      </> : blending ? <>
        {arrival.kind === 'dip-to-colour' && dipAt !== undefined ? <>
          <path d={path(f => dipWeights(e(f), dipAt).out)} className="dp-faint" strokeDasharray="3 3" />
          <path d={path(f => dipWeights(e(f), dipAt).col)} className="dp-faint" strokeDasharray="1 3" />
          <path d={path(f => dipWeights(e(f), dipAt).inn)} className="dp-curve" />
        </> : <>
          {arrival.kind === 'crossfade' && <path d={path(f => 1 - e(f))} className="dp-faint" strokeDasharray="3 3" />}
          <path d={cur?.curve === 'hold' ? `M${x0} ${yp(0)}H${x1}V${yp(1)}` : path(e)} className="dp-curve" />
        </>}
        {cur?.curve === 'bezier' && [1 / 3, 2 / 3].map(f => <circle key={f} cx={fx(f)} cy={yp(f)} r={1.8} className="dp-faint" />)}
        {arrival.kind === 'dip-to-colour' && dipAt !== undefined && peak !== undefined && <Handle n={2} shape="square" x={fx(peak)} y={yp(1)} label="Colour reached"
          does={asked('Drag left or right: where in the arrival the stop is fully the colour.', colourWhy)}
          onDrag={colourWhy ? undefined : x => set(`atc:${at}`, Math.round(clampTo(DIP_MIN, DIP_MAX, e(clampTo(0, 1, (x - x0) / (x1 - x0)))) * 20) / 20)}
          onReset={colourWhy ? undefined : () => set(`atc:${at}`, DIP_DEF)} />}
      </> : null}
    <text x={x0} y={sy - 10} className="dp-axis">length</text>
    <path d={`M${x0} ${sy}H${x1}`} className="dp-faint" />
    {limit !== undefined && arrival !== undefined && <path d={`M${x0} ${sy}H${lx(blending ? arrival.secs : 0)}`} className="dp-curve-on" />}
    <path d={`M${x0} ${sy - 3}V${sy + 3}M${x1} ${sy - 3}V${sy + 3}`} className="dp-faint" />
    <text x={x0} y={sy + 12} className="dp-axis">0</text>
    <text x={x1} y={sy + 12} className="dp-axis" textAnchor="end">{limit === undefined ? NONE : secs(limit)}</text>
    {limit !== undefined && blending && <Handle n={1} x={lx(arrival.secs)} y={sy} label="Arrival length"
      does={asked('Drag along the ruler: how long the arrival lasts. It stops at the length of this stop, or 30 seconds.', lengthWhy)}
      onDrag={lengthWhy ? undefined : x => set(`tr:${at}`, round1(clampTo(0, limit, (x - x0) / (x1 - x0) * limit)))}
      onReset={lengthWhy ? undefined : () => set(`tr:${at}`, Math.min(BLEND_DEF, limit))} />}
    {legend.map((item, k) => <g key={item.name}>
      <path d={`M${x0 + k * gap} 141h10`} className={item.dash ? 'dp-faint' : 'dp-curve'} strokeDasharray={item.dash} />
      <text x={x0 + k * gap + 13} y={144} className="dp-axis">{item.name}</text>
    </g>)}
    <text x={x1} y={144} className="dp-axis" textAnchor="end">{sw ? sw.label.toLowerCase() : NONE}</text>
  </Display>
}

// ---------------------------------------------------------------- controls

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})

/** Why the seam controls rest: no stop is read, or this is the first stop, which nothing comes before: its arrival plays only when the walk wraps. */
const seamWhy = (v: V, m: Where) => (m.at === undefined ? NO_STOP : m.at === 0 && wraps(v) === false ? 'Stop 1 has no stop before it. Its arrival plays only when the walk loops.' : undefined)
/** Why a control that only one kind of arrival has rests. */
const kindWhy = (m: Where, match: boolean, reason: string) => (m.at === undefined ? NO_STOP : m.cur?.kind === undefined ? NO_KIND : match ? undefined : reason)

const StopDial = (p: ViewProps) => {
  const m = where(p.v)
  return <Dial {...st(p, 'at')} label="Stop" does="The stop the walk stands on. Turn it to play from another stop." value={m.at ?? NaN} def={0}
    scale={{min: 0, max: Math.max(1, m.n - 1), step: 1}} format={x => `${x + 1}`} onChange={x => setStop(p, x)} />
}
const PaceDial = (p: ViewProps) => {
  const m = where(p.v)
  return <Dial {...stAt(p, 'hold', m.at)} label="Pace" does="How long the walk stays at this stop. The range is 1 second to 1 hour." value={m.cur?.hold ?? NaN} def={HOLD_DEF} scale={HOLD}
    format={secs} onChange={x => setHold(p, x)} />
}
const LoopToggle = (p: ViewProps) => {
  const loops = boolOf(p.v, 'docLoops'), looping = wraps(p.v)
  const why = loops === true ? undefined : loops === false ? 'This walk does not loop, and no operation turns looping on.' : 'No reading of whether this walk loops.'
  return <Toggle {...stand(st(p, 'stopAtEnd'), why)} label="Loop" does="Repeat the walk from the first stop. Off stops the walk at the end of the last stop."
    on={looping === true} unknown={looping === undefined} onChange={x => p.set('stopAtEnd', !x)} />
}
const ArrivalRadio = (p: ViewProps) => {
  const m = where(p.v), at = m.at
  return <Radio {...stand(stAt(p, 'kind', at), seamWhy(p.v, m))} label="Arrival" does="How the walk reaches this stop." value={m.cur?.kind ?? ''} options={KINDS} stack
    onChange={at === undefined ? undefined : x => p.set(`kind:${at}`, x)} />
}

// ---------------------------------------------------------------- the pane

/** How the walk ends, in words; undefined while the readings that decide it are unreported. */
const endOf = (v: V, S: readonly Stop[]): string | undefined => {
  const loops = boolOf(v, 'docLoops'), exits = boolOf(v, 'stopAtEnd'), first = S[0], last = S[S.length - 1]
  if (first === undefined || last === undefined || loops === undefined) return undefined
  return !loops ? 'Ends here' : exits === undefined ? undefined : exits ? `Stops at the end of ${last.name}` : `Loops to ${first.name}`
}

function JourneyPane({v}: {v: V}) {
  const m = where(v), {S, n, at} = m
  const switchTail = (s: Stop) => (s.sw !== undefined && s.sw !== 'immediate' ? SWITCHES.find(x => x.value === s.sw)?.label : undefined)
  const curveTail = (s: Stop) => (s.curve !== undefined && s.curve !== 'linear' ? CURVES.find(x => x.value === s.curve)?.label : undefined)
  const seamLabel = (s: Stop) => {
    const a = arrivalOf(s)
    if (a === undefined) return NONE
    return (a === 'cut' ? ['Cut', switchTail(s)] : [`${KIND_LONG[a.kind]} · ${secs(a.secs)}`, switchTail(s), curveTail(s)]).filter(Boolean).join(' · ')
  }
  const first = S[0], wrapped = first === undefined ? undefined : arrivalOf(first)
  return <div className="jn-pane">
    <div className="jn-head"><b>{shown(v, 'walk')}</b><span>{n === 0 ? NONE : `${n} ${n === 1 ? 'stop' : 'stops'}`}</span><span>{m.total === undefined ? NONE : clockOf(m.total)}</span><span>{endOf(v, S) ?? NONE}</span></div>
    <div className="jn-cols"><span>#</span><span>Scene</span><span>Place</span><span>Moment</span><span>Thing</span><span>Narration</span><span>Pace</span></div>
    <ol className="jn-rows">
      {n === 0 && <li className="jn-unread">No reading of the stops.</li>}
      {S.map(s => <li key={s.i} style={{display: 'contents'}}>
        {s.i > 0 && <div className="jn-seam" data-live={s.i === at && m.blend !== null ? 'true' : undefined}>
          <span className="jn-seam-bar"><i style={{'--p': s.i === at && m.blend !== null ? m.blend : at !== undefined && s.i < at ? 1 : 0} as CSSProperties} /></span>
          <span>{seamLabel(s)}</span>
          {s.i === at && m.blend !== null && <b>{Math.round(m.blend * 100)} %</b>}
        </div>}
        <div className="jn-stop" data-current={s.i === at ? 'true' : undefined} data-passed={at !== undefined && s.i < at ? 'true' : undefined}>
          <span className="jn-n">{s.i + 1}</span>
          <span className="jn-scene">{s.name}{at !== undefined && s.i === at + 1 && <span className="jn-tag">next</span>}</span>
          <span className="jn-none">no place</span><span className="jn-none">no moment</span><span className="jn-none">no thing</span>
          <span className="jn-words">{strOf(v, `words:${s.i}`) || NONE}</span>
          <span className="jn-hold">{s.hold === undefined ? NONE : secs(s.hold)}</span>
        </div>
      </li>)}
    </ol>
    <div className="jn-foot"><span>{m.next ?? NONE}</span><span>{wraps(v) === true ? `Wrap: ${wrapped === undefined ? NONE : wrapped === 'cut' ? 'Cut' : `${KIND_LONG[wrapped.kind]} · ${secs(wrapped.secs)}`}` : ''}</span></div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The walk as the research frame ships it (model.ts fieldStudies): eight scenes of 14 s, joined by 1.5 s crossfades. The owner reports
 * each stop on `name:i`, `hold:i`, `tr:i`, `kind:i`, `curve:i`, `sw:i`, `dir:i`, `atc:i` and `words:i`, the list on `stops`
 * (a JSON list of [name, character]) and the walk's name on `walk`. */
function fieldStudies(): Record<string, Value> {
  const stops: [string, string][] = [
    ['Ink', 'Fine, irregular stippling. Form on the edge of dissolution.'],
    ['Print', 'An imperfect lattice. A surface beginning to move.'],
    ['Gather', 'Rounded grains find a shared current.'],
    ['Between', 'Two characters, one material. An unsettled identity.'],
    ['Language', 'A different character. The same living field.'],
    ['Weather', 'No centre, no logo. Only changing concentrations.'],
    ['Quiet', 'A little less certainty. A little more space.'],
    ['Nocturne', 'Light collected in the dark. Something quietly taking form.'],
  ]
  const o: Record<string, Value> = {walk: 'Field studies', stops: JSON.stringify(stops)}
  stops.forEach(([name, words], i) => {
    o[`name:${i}`] = name; o[`hold:${i}`] = 14; o[`tr:${i}`] = BLEND_DEF; o[`kind:${i}`] = 'crossfade'; o[`curve:${i}`] = 'linear'; o[`sw:${i}`] = 'immediate'
    o[`dir:${i}`] = 'left'; o[`atc:${i}`] = DIP_DEF; o[`words:${i}`] = words
  })
  return o
}

const DEFAULTS: Record<string, Value> = {
  light: 'lit', at: 2, local: 0.6, playing: false, entered: false, docLoops: true, stopAtEnd: false, snap: true, takes: 2, take: '2', ...fieldStudies(),
}

export const design: DesignedDevice = {
  id: 'techne:journey',
  title: 'Journey',
  kind: 'instrument',
  firstPage: 'walk',
  defaults: DEFAULTS,
  fixtures: {
    'Mid-walk': {},
    'Reworked seams': {
      at: 4, local: 1.1, stopAtEnd: true,
      'hold:1': 6, 'hold:2': 30, 'hold:5': 45, 'hold:7': 20,
      'kind:1': 'cut', 'kind:2': 'dip-to-colour', 'atc:2': 0.35, 'tr:2': 4, 'curve:2': 'hold',
      'kind:4': 'wipe', 'dir:4': 'right', 'tr:4': 2.5, 'curve:4': 'smooth', 'sw:3': 'sync', 'sw:6': 'at-end',
    },
    'Plays once': {docLoops: false, at: 7, local: 9},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, undefined])),
  },

  folded: p => {
    const m = where(p.v)
    return <Folded title="Journey" light={light(p)} readings={[m.at === undefined ? NONE : `${m.at + 1}/${m.n}`, m.cur?.name ?? NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Journey" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><WalkDisplay p={p} w={140} h={146} level="compact" /></Section>
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
    const m = where(p.v), playing = boolOf(p.v, 'playing')
    return <Tile title={`Journey · ${shown(p.v, 'walk')}`} light={light(p)} span={2} onFull={p.nav.full}>
      <WalkDisplay p={p} w={112} h={104} level="tile" />
      <div className="jn-tile-side">
        <div>
          <b className="jn-tile-name">{m.at === undefined ? NONE : `${m.at + 1} · ${m.cur?.name ?? NONE}`}</b>
          <p className="jn-tile-words">{(m.at === undefined ? undefined : strOf(p.v, `words:${m.at}`)) || NONE}</p>
        </div>
        <div className="jn-tile-row">
          <Action {...st(p, 'playing')} label={playing === true ? 'Stop' : 'Play'} does="Walk the stops from here. The walk stays on the rail when you change mode." onPress={() => p.set('playing', playing !== true)} />
          <Readout label="left" does="The time left at this stop." value={m.cur?.hold !== undefined && m.local !== undefined ? secs(Math.max(0, m.cur.hold - m.local)) : undefined} />
        </div>
      </div>
    </Tile>
  },
}

function JourneyWhole({p}: {p: ViewProps}) {
  const m = where(p.v), {cur, at, n} = m
  const [paged, setPaged] = useState<number | undefined>(undefined)
  const why = seamWhy(p.v, m)
  const stopName = at === undefined || cur === undefined ? NONE : `${at + 1} · ${cur.name}`
  const limit = limitOf(cur), tr = cur?.tr
  const takesRead = quantity(p.v, 'takes'), take = strOf(p.v, 'take')
  const takes = takesRead !== undefined ? Math.max(1, Math.round(takesRead)) : Math.max(0, Math.round(Number(take)) || 0)
  const rows: RowItem[] = n === 0 ? [{id: 'none', name: 'No reading of the stops', light: 'unknown'}] : m.S.map(s => ({
    id: String(s.i), name: `${s.i + 1} · ${s.name}`, light: at === undefined ? 'unknown' : s.i === at ? 'lit' : 'dark', tone: 'accent', note: s.hold === undefined ? NONE : secs(s.hold),
    meter: <span className="jn-row-arrival">{s.i === 0 ? (wraps(p.v) === true ? 'wrap' : NONE) : arrivalShort(s)}</span>}))
  return <Panel title="Journey" view="whole" {...head(p)} pages={[{id: 'walk', label: 'Walk'}, {id: 'seams', label: 'Transitions'}]} page={p.page} onPage={p.setPage}>
    {p.page !== 'seams' ? <>
      <Band>
        <Section width={206}><WalkDisplay p={p} w={194} h={146} level="whole" /></Section>
        <Section label="Walk" cols={3} grow>
          {StopDial(p)}
          {PaceDial(p)}
          <Readout label="length" does="How long the whole walk lasts, all the stops together." value={m.total === undefined ? undefined : clockOf(m.total)} />
          {LoopToggle(p)}
          <Toggle {...st(p, 'snap')} label="Snap" does="Drags land on the start of a stop. Hold Alt to drag free." on={boolOf(p.v, 'snap') === true} unknown={boolOf(p.v, 'snap') === undefined} onChange={x => p.set('snap', x)} />
          <Action {...st(p, 'entered')} label={boolOf(p.v, 'entered') === true ? 'Return' : 'Enter'} does="Go into this stop's scene in its Expression. Return comes back to the same stop." onPress={() => p.set('entered', boolOf(p.v, 'entered') !== true)} />
        </Section>
      </Band>
      <Band>
        <Section width={206}>
          <Rows label="Stops" does="The stops in order. A lit row is the stop the walk stands on; the note is how long it is held." items={rows} size={PAGE}
            page={paged ?? (at === undefined ? 0 : Math.floor(at / PAGE))} onPage={setPaged} />
        </Section>
        <Section label="Narration" grow>
          <TextField {...stand(stAt(p, 'words', at), at === undefined ? NO_STOP : undefined)} label={`Stop ${stopName}`} does="The words the guide speaks at this stop." wide
            placeholder={at !== undefined && !has(p.v, `words:${at}`) ? 'No reading of the narration' : 'Narration for this stop'}
            value={at === undefined ? '' : strOf(p.v, `words:${at}`) ?? ''} onChange={at === undefined ? undefined : x => p.set(`words:${at}`, x)} />
          <Chooser {...st(p, 'take')} label="Take" does="The recorded take that stands." wide value={take ?? ''}
            options={Array.from({length: takes}, (_, k) => ({value: String(k + 1), label: takesRead !== undefined && k + 1 === takes ? `Take ${k + 1} · latest` : `Take ${k + 1}`}))} onChange={x => p.set('take', x)} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}><SeamDisplay p={p} w={194} h={146} /></Section>
        <Section label="Arrival" cols={3} grow>
          {ArrivalRadio(p)}
          <Dial {...stand(stAt(p, 'tr', at), why ?? (cur?.kind === 'cut' ? 'A cut has no length.' : undefined))} label="Time" does="How long the arrival lasts. It cannot pass the length of this stop."
            value={tr !== undefined && limit !== undefined ? Math.min(tr, limit) : NaN} def={limit === undefined ? undefined : Math.min(BLEND_DEF, limit)}
            scale={{min: 0, max: limit ?? BLEND_MAX}} format={x => `${+x.toFixed(1)} s`} onChange={at === undefined ? undefined : x => p.set(`tr:${at}`, round1(x))} />
          <Readout label="longest" does="The longest an arrival can last: the length of this stop, or 30 seconds." value={limit === undefined ? undefined : secs(limit)} />
        </Section>
      </Band>
      <Band>
        <Section label="Curve" width={72}>
          <Radio {...stand(stAt(p, 'curve', at), why ?? (cur?.kind === 'cut' ? 'A cut takes no curve.' : undefined))} does="The shape of the arrival's progress." value={cur?.curve ?? ''} options={CURVES} stack
            onChange={at === undefined ? undefined : x => p.set(`curve:${at}`, x)} />
        </Section>
        <Section label="Switch" width={72}>
          <Radio {...stand(stAt(p, 'sw', at), why)} does="When the next stop takes over." value={cur?.sw ?? ''} options={SWITCHES} stack onChange={at === undefined ? undefined : x => p.set(`sw:${at}`, x)} />
        </Section>
        <Section label="Kind" grow>
          <Dial {...stand(stAt(p, 'atc', at), why ?? kindWhy(m, cur?.kind === 'dip-to-colour', 'Only a dip to colour reaches a colour.'))} label="Colour at" does="Where in the arrival the stop is fully the colour. Only a dip has it."
            value={at === undefined ? NaN : quantity(p.v, `atc:${at}`) ?? NaN} def={DIP_DEF} scale={{min: DIP_MIN, max: DIP_MAX, step: 0.05}}
            format={x => `${Math.round(x * 100)} %`} onChange={at === undefined ? undefined : x => p.set(`atc:${at}`, x)} />
          <Chooser {...stand(stAt(p, 'dir', at), why ?? kindWhy(m, cur?.kind === 'wipe', 'Only a wipe has a direction.'))} label="Direction" does="The way the wipe travels. Only a wipe has it."
            value={at === undefined ? '' : oneOf(DIRECTIONS, strOf(p.v, `dir:${at}`)) ?? ''} options={DIRECTIONS} wide onChange={at === undefined ? undefined : x => p.set(`dir:${at}`, x)} />
        </Section>
      </Band>
    </>}
  </Panel>
}
