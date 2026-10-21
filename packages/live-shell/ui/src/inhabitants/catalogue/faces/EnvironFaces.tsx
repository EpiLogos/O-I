// The environs of the process devices (manual §25.6 "Process types, read in time"; face-rig CREATURE-SPEC.md 24): the Gateway's river, the
// NOWs' seasons, the Seat's succession and Ground hygiene's erosion, each drawn from its reading (environReadings.ts) in the roster's inks and the
// face rig's line language: one ink to a thing, lines and not blobs, the ground keeping its record. A picture is the state now and nothing
// else: it does not move, no part of it stands for a reading the owner did not give, and where there is no reading the frame says why.
import {memo, useLayoutEffect, useRef, useState, type ReactNode} from 'react'
import {INK} from './figures'
import {isAbsent, type ErosionReading, type EnvironAbsent, type RiverReading, type SeasonsReading, type SuccessionReading} from './environReadings'
import './faces.css'

const STILL = '#7d8288'

/** A band as wide as the place it stands in (a pane's foot), drawing an environ at that width: the faces take their width, the place
 * gives it. Nothing is drawn until the width is known. */
export function EnvironBand({height = 120, children}: {height?: number; children: (width: number) => ReactNode}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width))
    measure()
    if (typeof ResizeObserver !== 'function') return
    const seen = new ResizeObserver(measure)
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  return <div className="fx-environ-band" ref={box} style={{height}}>{width > 0 && children(width)}</div>
}
const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The frame every environ shares: the picture, and under it its signature and the words of its state. */
function Frame({kind, signature, words, width, height, absent, children}: {kind: string; signature: string; words: string; width: number; height: number;
  absent?: string; children?: ReactNode}) {
  const h = Math.max(24, height - 16)
  return <figure className="fx-environ" data-environ={kind} data-absent={absent ? 'true' : undefined} style={{width}}>
    {absent
      ? <div className="fx-environ-none" style={{height: h}} role="status">{absent}</div>
      : <svg className="fx-environ-svg" viewBox={`0 0 ${width} ${h}`} width={width} height={h} role="img" aria-label={`${signature}: ${words}`}>{children}</svg>}
    <figcaption className="fx-environ-foot"><span className="fx-sig">{signature}</span><b title={words}>{absent ? 'no reading' : words}</b></figcaption>
  </figure>
}

/** A bank's line with its grass, `up` growing away from the water. */
function bank(width: number, y: number, up: boolean): ReactNode {
  const grass = Array.from({length: Math.floor(width / 9)}, (_, i) => {
    const x = 4 + i * 9 + (i % 3) * 1.5, dy = up ? -(3 + (i % 2) * 2) : 3 + (i % 2) * 2
    return `M${x} ${y}l${(i % 2 ? 1 : -1) * 1.2} ${dy}`
  }).join('')
  return <g><path d={`M0 ${y} Q${width * 0.3} ${y + (up ? -1.5 : 1.5)} ${width * 0.55} ${y} T${width} ${y}`} fill="none" stroke={INK.umber} strokeWidth={1.2} />
    <path d={grass} fill="none" stroke={INK.malachite} strokeWidth={0.9} opacity={0.55} /></g>
}

// ---------------------------------------------------------------- the river

export const RiverEnviron = memo(function RiverEnviron({reading, width = 266, height = 104}: {reading: RiverReading | EnvironAbsent; width?: number; height?: number}) {
  if (isAbsent(reading)) return <Frame kind="river" signature="river · a stream" words="" width={width} height={height} absent={reading.absent} />
  const h = Math.max(24, height - 16), top = h * 0.18, foot = h * 0.86
  const currents = clamp(1, 7, reading.sessions ?? 1)
  const wave = (y: number, amp: number) => {
    let d = `M0 ${y}`
    for (let x = 0; x <= width; x += 6) d += ` L${x} ${(y + Math.sin(x / 7 + y) * amp).toFixed(1)}`
    return d
  }
  const ys = Array.from({length: currents}, (_, i) => top + (i + 1) * (foot - top) / (currents + 1))
  const leaves = reading.flow === 'flowing' ? clamp(0, 12, reading.inflight ?? 0) : 0
  const words = reading.flow === 'dry' ? `dry · ${reading.why}`
    : `${reading.flow === 'still' ? 'still' : 'flowing'} · ${reading.sessions === null ? 'sessions not reported' : plural(reading.sessions, 'session')}${reading.inflight !== null ? ` · ${reading.inflight} in flight` : ''}${reading.flow === 'still' ? ` · ${reading.why}` : ''}`
  return <Frame kind="river" signature="river · a stream" words={words} width={width} height={height}>
    <g data-flow={reading.flow}>
      {reading.flow !== 'dry' && <path d={`M0 ${top} L${width} ${top} L${width} ${foot} L0 ${foot} Z`} fill={reading.flow === 'flowing' ? INK.lapis : STILL} opacity={reading.flow === 'flowing' ? 0.42 : 0.22} />}
      {reading.flow === 'dry' && <g stroke={INK.umber} strokeWidth={0.8} fill="none" opacity={0.75}>
        {Array.from({length: Math.floor(width / 26)}, (_, i) => {
          const x = 8 + i * 26, y = top + (foot - top) * (0.3 + (i % 3) * 0.2)
          return <path key={i} d={`M${x} ${y} l7 -3 l5 5 l8 -2 m-13 3 l2 6`} />
        })}
        {Array.from({length: Math.floor(width / 33)}, (_, i) => <circle key={`p${i}`} cx={15 + i * 33} cy={top + (foot - top) * (0.55 + (i % 2) * 0.25)} r={1.4} fill={INK.umber} stroke="none" />)}
      </g>}
      {reading.flow !== 'dry' && ys.map((y, i) => <g key={i}>
        <path d={reading.flow === 'flowing' ? wave(y, 1.6) : `M0 ${y} L${width} ${y}`} fill="none" stroke={reading.flow === 'flowing' ? INK.bone : '#a8adb2'}
          strokeWidth={1} opacity={reading.flow === 'flowing' ? 0.75 : 0.5} strokeDasharray={reading.flow === 'still' ? '5 4' : undefined} />
        {reading.flow === 'flowing' && Array.from({length: Math.floor(width / 70)}, (_, k) => {
          const x = 30 + k * 70 + (i % 2) * 24
          return <path key={k} d={`M${x} ${y - 3} l4 3 l-4 3`} fill="none" stroke={INK.bone} strokeWidth={1} opacity={0.8} />
        })}
      </g>)}
      {Array.from({length: leaves}, (_, j) => {
        const y = ys[j % currents]!, x = (j + 0.5) * width / leaves
        return <ellipse key={j} cx={x} cy={y - 0.5} rx={3.4} ry={1.5} transform={`rotate(-18 ${x} ${y})`} fill={INK.amber} />
      })}
      {bank(width, top, true)}
      {bank(width, foot, false)}
    </g>
  </Frame>
})

// ---------------------------------------------------------------- the seasons

export const SeasonsEnviron = memo(function SeasonsEnviron({reading, width = 266, height = 104}: {reading: SeasonsReading | EnvironAbsent; width?: number; height?: number}) {
  if (isAbsent(reading)) return <Frame kind="seasons" signature="seasons · the field's year" words="" width={width} height={height} absent={reading.absent} />
  const h = Math.max(24, height - 16), ground = h * 0.66, field = width * 0.74, pad = 4
  const n = reading.standing.length, step = (field - pad * 2) / Math.max(n, 1)
  const tall = (ground - 4) * 0.82
  const {growth, dormant, harvested, record} = reading.counts
  const sheaves = harvested ?? 0
  const shown = Math.min(sheaves, 5)
  const sheafX = (i: number) => field + 8 + i * Math.max(9, (width - field - 14) / 5)
  // The record lies in the soil: one mark for each clearing archived, laid row on row through the soil (as many rows as the soil holds).
  const soil = h - ground - 4
  const cols = Math.max(1, Math.min(Math.floor((width - 8) / 4), Math.ceil(Math.sqrt((record ?? 0) * (width - 8) / Math.max(soil, 1)))))
  const rows = Math.max(1, Math.min(Math.floor(soil / 4), Math.ceil((record ?? 0) / cols)))
  const marks = Math.min(record ?? 0, cols * rows)
  const colW = (width - 8) / cols, rowH = soil / rows
  const words = [`${growth ?? '—'} in growth`, `${dormant ?? '—'} dormant`, `${harvested ?? '—'} harvested`, record === null ? 'the record unread' : `${record} in the record`].join(' · ')
  return <Frame kind="seasons" signature="seasons · the field's year" words={words} width={width} height={height}>
    <rect x={0} y={ground} width={width} height={h - ground} fill={INK.umber} opacity={0.2} />
    {Array.from({length: marks}, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols, jitter = ((i * 37) % 11) / 11 - 0.5
      const x = 4 + (c + 0.5 + (r % 2) * 0.5 + jitter * 0.4) * colW, y = ground + 2 + (r + 0.5 + jitter * 0.3) * rowH
      return <path key={i} d={`M${x - 1.5} ${y + 1} l3 -2`} stroke={INK.bone} strokeWidth={1} opacity={0.5} />
    })}
    <path d={`M0 ${ground} L${width} ${ground}`} stroke={INK.umber} strokeWidth={1.2} />
    {n === 0 && <text x={field / 2} y={ground - 8} textAnchor="middle" className="fx-environ-note">fallow: nothing in growth</text>}
    {reading.standing.map((c, i) => {
      const x = pad + (i + 0.5) * step
      if (c.season === 'growth') return <g key={c.ref}><title>{c.purpose}</title>
        <path d={`M${x} ${ground} L${x} ${ground - tall}`} stroke={INK.malachite} strokeWidth={1.3} />
        <path d={`M${x} ${ground - tall * 0.45} q${-3} -2 ${-4} -6 M${x} ${ground - tall * 0.62} q3 -2 4 -6`} fill="none" stroke={INK.malachite} strokeWidth={0.9} opacity={0.8} />
        <ellipse cx={x} cy={ground - tall - 3.6} rx={1.7} ry={4} fill={INK.malachite} />
      </g>
      return <g key={c.ref} opacity={0.6}><title>{c.purpose}</title>
        <path d={`M${x} ${ground} Q${x} ${ground - tall * 0.3} ${x + 3} ${ground - tall * 0.42}`} fill="none" stroke={INK.bone} strokeWidth={1.1} />
      </g>
    })}
    {sheaves > 0 && Array.from({length: shown}, (_, i) => {
      const x = sheafX(i), y = ground, s = Math.min(16, tall * 0.55)
      return <g key={i} stroke={INK.gold} strokeWidth={1} fill="none">
        {[-3, -1.5, 0, 1.5, 3].map(dx => <path key={dx} d={`M${x + dx * 0.6} ${y} L${x + dx * 1.3} ${y - s}`} />)}
        <path d={`M${x - 2.6} ${y - s * 0.45} L${x + 2.6} ${y - s * 0.45}`} strokeWidth={1.6} />
      </g>
    })}
    {sheaves > shown && <text x={width - 3} y={ground - 3} textAnchor="end" className="fx-environ-note">+{sheaves - shown}</text>}
  </Frame>
})

// ---------------------------------------------------------------- the succession

export const SuccessionEnviron = memo(function SuccessionEnviron({reading, width = 266, height = 104}: {reading: SuccessionReading | EnvironAbsent; width?: number; height?: number}) {
  if (isAbsent(reading)) return <Frame kind="succession" signature="succession · lane after lane" words="" width={width} height={height} absent={reading.absent} />
  const h = Math.max(24, height - 16), ground = h * 0.58
  const plotW = width / reading.plots.length
  const words = reading.plots.map(p => `${p.seat} ${p.state === 'free' ? 'cleared' : p.state === 'held' ? `${p.lane ?? 'a lane'}${p.ahead !== null ? ` +${p.ahead}` : ''}` : p.state === 'foreign' ? 'a foreign lane' : 'unread'}`).join(' · ')
  // The ground is main: the soil the lanes that landed before laid down, stratum on stratum. A lane grows on it (its commits main does not
  // hold), rooted where it was cut; what main laid down since lies on top beside its roots, lighter (the commits on main it does not hold).
  const strata = Math.max(2, Math.floor((h - ground - 4) / 4))
  return <Frame kind="succession" signature="succession · lane after lane" words={words} width={width} height={height}>
    <rect x={0} y={ground} width={width} height={h - ground} fill={INK.umber} opacity={0.22} />
    {Array.from({length: strata}, (_, k) => <path key={k} d={`M0 ${ground + 4 + k * 4} Q${width * 0.35} ${ground + 4 + k * 4 + (k % 2 ? 1 : -1)} ${width * 0.6} ${ground + 4 + k * 4} T${width} ${ground + 4 + k * 4}`}
      fill="none" stroke={INK.umber} strokeWidth={0.7} opacity={0.55 - Math.min(0.35, k * 0.04)} />)}
    {reading.plots.map((p, i) => {
      const x0 = i * plotW, cx = x0 + plotW / 2
      const grow = p.ahead === null ? 0.35 : 0.22 + 0.78 * Math.min(1, Math.log2(p.ahead + 1) / 6)
      const tall = (ground - 6) * grow
      const plants = Math.min(5, p.workers)
      const span = Math.min(plotW * 0.5, 9 * plants)
      const fresh = p.state === 'held' && p.behind ? Math.min(h - ground - 6, 2 + Math.log2(p.behind + 1) * 3) : 0
      const mound = p.loose ? Math.min(plotW * 0.22, 4 + Math.log2(p.loose + 1) * 3) : 0
      const xs = Array.from({length: plants}, (_, k) => cx - span / 2 + (plants === 1 ? span / 2 : k * span / (plants - 1)))
      return <g key={p.seat} data-plot={p.state}><title>{`${p.seat}: ${p.state}${p.lane ? ` · ${p.lane}` : ''}${p.ahead !== null ? ` · ${p.ahead} ahead` : ''}${p.behind ? ` · ${p.behind} behind main` : ''}${p.loose ? ` · ${p.loose} uncommitted` : ''}`}</title>
        {fresh > 0 && Array.from({length: Math.max(1, Math.round(fresh / 2.5))}, (_, k) => <path key={`f${k}`} d={`M${x0 + 4} ${ground + 1.5 + k * 2.5} Q${cx} ${ground + 1.5 + k * 2.5 + (k % 2 ? 0.8 : -0.8)} ${x0 + plotW - 4} ${ground + 1.5 + k * 2.5}`}
          fill="none" stroke={INK.bone} strokeWidth={0.8} opacity={0.42} />)}
        {p.state === 'free' && <path d={Array.from({length: 6}, (_, k) => `M${cx - 18 + k * 7} ${ground - 1.2} l4 0`).join('')} stroke={INK.umber} strokeWidth={1.1} opacity={0.75} />}
        {p.state === 'held' && xs.map((x, k) => {
          const t = tall * (0.82 + 0.18 * ((k + 1) % 2))
          return <g key={k} stroke={INK.malachite} fill="none" strokeWidth={1.2} strokeDasharray={p.ahead === null ? '3 2' : undefined}>
            <path d={`M${x} ${ground} L${x} ${ground - t}`} />
            <path d={`M${x} ${ground - t * 0.4} q-4 -1 -6 -5 M${x} ${ground - t * 0.62} q4 -1 6 -5 M${x} ${ground - t * 0.85} q-3 -1 -4 -4`} strokeWidth={0.9} />
            <path d={`M${x} ${ground} l-3 ${fresh + 5} M${x} ${ground} l2 ${fresh + 7} M${x} ${ground} l0 ${fresh + 9}`} strokeWidth={0.6} opacity={0.55} strokeDasharray={undefined} />
          </g>
        })}
        {p.state === 'foreign' && <g stroke={INK.umber} fill="none" strokeWidth={1.1}>
          <path d={`M${cx - 11} ${ground} q3 -${(ground - 6) * 0.45} 11 -${(ground - 6) * 0.48} q8 ${(ground - 6) * 0.03} 11 ${(ground - 6) * 0.48}`} />
          <path d={`M${cx - 6} ${ground - 2} l10 -${(ground - 6) * 0.3} M${cx - 1} ${ground - 1} l7 -${(ground - 6) * 0.2} M${cx + 4} ${ground - 1} l-6 -${(ground - 6) * 0.26}`} strokeWidth={0.7} />
        </g>}
        {p.state === 'unknown' && <text x={cx} y={ground - 6} textAnchor="middle" className="fx-environ-note">unread</text>}
        {mound > 0 && <path d={`M${cx + span / 2 + 4} ${ground} q${mound / 2} -${mound * 0.8} ${mound} 0`} fill={INK.umber} opacity={0.75} />}
        {p.drift && <g stroke={INK.cinnabar} strokeWidth={1}><path d={`M${x0 + plotW - 8} ${ground} L${x0 + plotW - 8} ${ground - 16}`} /><path d={`M${x0 + plotW - 8} ${ground - 16} l6 2.5 l-6 2.5`} fill={INK.cinnabar} /></g>}
        <text x={x0 + 5} y={h - 4} className="fx-environ-label">{p.seat}</text>
        {i > 0 && <path d={`M${x0} ${4} L${x0} ${ground}`} stroke="var(--line, #24262a)" strokeWidth={1} strokeDasharray="2 3" />}
      </g>
    })}
    <path d={`M0 ${ground} L${width} ${ground}`} stroke={INK.umber} strokeWidth={1.2} />
  </Frame>
})

// ---------------------------------------------------------------- the erosion

const PAGE_WORD = {checkouts: 'checkouts', ground: 'ground', material: 'material'} as const

export const ErosionEnviron = memo(function ErosionEnviron({reading, width = 266, height = 104}: {reading: ErosionReading | EnvironAbsent; width?: number; height?: number}) {
  if (isAbsent(reading)) return <Frame kind="erosion" signature="erosion · worn by passage" words="" width={width} height={height} absent={reading.absent} />
  const h = Math.max(24, height - 16), surface = h * 0.3, bandW = width / reading.pages.length
  const grooves = (p: ErosionReading['pages'][number]) => p.wear.filter(w => w.depth > 1).length
  const words = reading.pages.map(p => p.unsurveyed.length && !p.wear.length ? `${PAGE_WORD[p.page]} unsurveyed`
    : `${PAGE_WORD[p.page]} ${grooves(p) ? plural(grooves(p), 'groove') : p.wear.length ? plural(p.wear.length, 'print') : 'sound'}`).join(' · ')
  return <Frame kind="erosion" signature="erosion · worn by passage" words={words} width={width} height={height}>
    {reading.pages.map((p, i) => {
      const x0 = i * bandW, inner = bandW - 12
      // The same passage wears one channel, however often it comes: each kind of finding cuts one notch, as wide and as deep as it is
      // frequent (a log of the count) and as its kind is grave — a print stays a dimpled stretch, a groove is cut, a gully goes deep.
      const kinds = [...new Map(p.wear.map(w => [w.kind, w])).values()].map(w => ({w, n: p.wear.filter(x => x.kind === w.kind).length}))
        .sort((a, b) => b.w.depth - a.w.depth || b.n - a.n)
      const widths = kinds.map(({w, n}) => (w.depth === 1 ? 10 : 6) + Math.log2(n + 1) * (w.depth === 1 ? 6 : 4))
      const total = widths.reduce((a, b) => a + b, 0), scale = total > inner ? inner / total : 1
      let cursor = x0 + 6 + (inner - total * scale) / 2, d = `M${x0 + 2} ${surface}`
      const cuts = kinds.map(({w, n}, k) => {
        const wd = widths[k]! * scale, x = cursor + wd / 2
        cursor += wd
        const deep = w.depth === 1 ? 2 + Math.min(3, Math.log2(n + 1)) : (h - surface) * Math.min(0.85, (w.depth === 2 ? 0.16 : 0.32) + Math.log2(n + 1) * 0.06)
        return {w, n, x, wd, deep}
      })
      for (const c of cuts) {
        if (c.w.depth === 1) {
          const dimples = Math.max(2, Math.min(9, Math.round(c.wd / 4)))
          for (let k = 0; k < dimples; k++) { const a = c.x - c.wd / 2 + k * c.wd / dimples, b = a + c.wd / dimples; d += ` L${a.toFixed(1)} ${surface} Q${((a + b) / 2).toFixed(1)} ${(surface + c.deep).toFixed(1)} ${b.toFixed(1)} ${surface}` }
        } else d += ` L${(c.x - c.wd / 2).toFixed(1)} ${surface} C${(c.x - c.wd / 4).toFixed(1)} ${surface} ${(c.x - c.wd / 6).toFixed(1)} ${(surface + c.deep).toFixed(1)} ${c.x.toFixed(1)} ${(surface + c.deep).toFixed(1)} C${(c.x + c.wd / 6).toFixed(1)} ${(surface + c.deep).toFixed(1)} ${(c.x + c.wd / 4).toFixed(1)} ${surface} ${(c.x + c.wd / 2).toFixed(1)} ${surface}`
      }
      d += ` L${x0 + bandW - 2} ${surface}`
      const unsurveyed = p.unsurveyed.length > 0 && p.wear.length === 0
      return <g key={p.page} data-page={p.page}><title>{p.unsurveyed.length ? p.unsurveyed.join('\n') : `${PAGE_WORD[p.page]}: ${kinds.map(({w, n}) => `${n} ${w.kind}`).join(', ') || 'no finding'}`}</title>
        <path d={`${d} L${x0 + bandW - 2} ${h - 2} L${x0 + 2} ${h - 2} Z`} fill={INK.umber} opacity={unsurveyed ? 0.07 : 0.2} />
        {[0.5, 0.66, 0.82].map((f, k) => <path key={k} d={`M${x0 + 2} ${h * f} Q${x0 + bandW * 0.5} ${h * f + (k % 2 ? 1.5 : -1.5)} ${x0 + bandW - 2} ${h * f}`} fill="none" stroke={INK.umber} strokeWidth={0.7} opacity={0.45} />)}
        <path d={d} fill="none" stroke={unsurveyed ? STILL : INK.umber} strokeWidth={1.2} strokeDasharray={unsurveyed ? '4 3' : undefined} />
        {cuts.filter(c => c.w.depth > 1).map((c, k) => <path key={k} d={`M${c.x} ${surface + 2} L${c.x} ${surface + c.deep - 1}`} stroke={c.w.depth === 3 ? INK.cinnabar : INK.amber} strokeWidth={1} opacity={0.8} />)}
        {cuts.filter(c => c.wd > 9 || cuts.length < 6).map((c, k) => <text key={`n${k}`} x={c.x} y={surface - 4} textAnchor="middle" className="fx-environ-note">{c.n}</text>)}
        {cuts.filter(c => c.w.tendable).map((c, k) => <circle key={`t${k}`} cx={c.x + Math.min(c.wd / 2, 6)} cy={surface - 7} r={1.5} fill={INK.amber} />)}
        {p.wear.length === 0 && !unsurveyed && <path d={Array.from({length: Math.floor((bandW - 8) / 9)}, (_, k) => `M${x0 + 6 + k * 9} ${surface} l${k % 2 ? 1 : -1} -4`).join('')} stroke={INK.malachite} strokeWidth={0.9} opacity={0.6} />}
        {unsurveyed && <text x={x0 + bandW / 2} y={surface - 5} textAnchor="middle" className="fx-environ-note">unsurveyed</text>}
        <text x={x0 + 5} y={h - 4} className="fx-environ-label">{PAGE_WORD[p.page]}</text>
        {i > 0 && <path d={`M${x0} ${4} L${x0} ${h - 2}`} stroke="var(--line, #24262a)" strokeWidth={1} />}
      </g>
    })}
  </Frame>
})
