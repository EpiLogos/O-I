// The environs of the process devices (manual §25.6 "Process types, read in time"), each drawn in the kit's well (sdk/panel Display) from
// its reading (environReadings.ts): the Gateway's river, the NOWs' seasons, the Seat page's succession, and the erosion of the Checkouts
// page and of Docs. The approvals queue's lake (software-factory__approvals.tsx QueueWell) is the first of them, and these draw as it does:
// the kit's inks and the shell's tokens, lines and not blobs, the ground keeping its record. A picture is the state now and nothing else:
// it does not move (§25.6 Rules: "a face or a ground moves only for something the run did"), no part of it stands for a reading the owner
// did not give, and while a reading is missing the well says, in the picture, which reading it waits on.
import type {ReactNode} from 'react'
import {Display} from '../../sdk/panel'
import {isAbsent, type EnvironAbsent, type ErosionReading, type ErosionStretch, type RiverReading, type SeasonsReading, type SuccessionReading} from './environReadings'
import './faces.css'

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const f1 = (x: number) => x.toFixed(1)

/** Words broken into lines that fit `chars` characters. */
function wrap(words: string, chars: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of words.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > chars) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}
/** Words centred in the well at `y`, in as many lines as they need. */
function Words({words, w, y, cls = 'dp-ink-dim', max = 4}: {words: string; w: number; y: number; cls?: string; max?: number}) {
  const lines = wrap(words, Math.max(12, Math.floor((w - 16) / 5.2)))
  const shown = lines.length > max ? [...lines.slice(0, max - 1), `${lines.slice(max - 1).join(' ').slice(0, Math.floor((w - 16) / 5.2) - 1)}…`] : lines
  return <text x={w / 2} y={y} className={`${cls} fx-env-words`} textAnchor="middle" data-environ-words="">
    {shown.map((line, i) => <tspan key={i} x={w / 2} dy={i === 0 ? 0 : 11}>{i < shown.length - 1 ? `${line} ` : line}</tspan>)}
  </text>
}
/** A bank's line with its grass, `up` growing away from the water. */
function Bank({w, y, up}: {w: number; y: number; up: boolean}) {
  const grass = Array.from({length: Math.floor(w / 9)}, (_, i) => {
    const x = 4 + i * 9 + (i % 3) * 1.5, dy = up ? -(3 + (i % 2) * 2) : 3 + (i % 2) * 2
    return `M${f1(x)} ${f1(y)}l${(i % 2 ? 1 : -1) * 1.2} ${dy}`
  }).join('')
  return <g><path d={`M0 ${f1(y)}Q${f1(w * 0.3)} ${f1(y + (up ? -1.5 : 1.5))} ${f1(w * 0.55)} ${f1(y)}T${w} ${f1(y)}`} className="dp-faint" />
    <path d={grass} fill="none" stroke="var(--green)" strokeWidth={0.9} opacity={0.5} /></g>
}

/** The well an environ draws in. `still` marks the picture that waits on a reading (the walks and the gallery find it by it). */
function Well({kind, w, h, label, does, corner, state, children}: {kind: string; w: number; h: number; label: string; does: string; corner?: string; state: string; children: ReactNode}) {
  return <div className="fx-env" data-environ={kind} data-environ-state={state}>
    <Display w={w} h={h} label={label} does={does} corner={corner}>{children}</Display>
  </div>
}

// ---------------------------------------------------------------- the river

const RIVER_DOES = 'The gateway as a river, a stream with no done. Its currents are the sessions coming in, the leaves on them the frames in flight. It flows while check-ins arrive, stands still while a reading is missing or past Stall after, and lies dry while nothing can come in.'

export function RiverEnviron({reading, w, h, why}: {reading: RiverReading | EnvironAbsent; w: number; h: number; why?: string}) {
  const top = h * 0.2, foot = h * 0.76
  if (isAbsent(reading)) return <Well kind="river" w={w} h={h} label="The river" does={`${RIVER_DOES} ${reading.waits}`} state="waiting">
    <Bank w={w} y={top} up /><Bank w={w} y={foot} up={false} />
    <Words words={reading.waits} w={w} y={(top + foot) / 2 - 2} />
  </Well>
  const {flow} = reading
  const currents = clamp(1, 7, reading.sessions ?? 1)
  const ys = Array.from({length: currents}, (_, i) => top + (i + 1) * (foot - top) / (currents + 1))
  const wave = (y: number, amp: number) => { let d = `M0 ${f1(y)}`; for (let x = 6; x <= w; x += 6) d += `L${x} ${f1(y + Math.sin(x / 7 + y) * amp)}`; return d }
  const leaves = flow === 'flowing' ? clamp(0, 12, reading.inflight ?? 0) : 0
  const said = flow === 'flowing' ? `${plural(reading.sessions ?? 0, 'session')} · ${reading.inflight ?? 0} in flight` : flow === 'dry' ? 'dry' : 'still'
  return <Well kind="river" w={w} h={h} label="The river" does={`${RIVER_DOES} Now: ${flow}. ${reading.why}${why ? ` ${why}` : ''}`} corner={said} state={flow === 'flowing' ? 'live' : flow}>
    <g data-flow={flow}>
      {flow !== 'dry' && <rect x={0} y={top} width={w} height={foot - top} fill={flow === 'flowing' ? 'var(--dp-value)' : 'var(--text-faint)'} opacity={flow === 'flowing' ? 0.16 : 0.1} />}
      {flow === 'dry' && <g className="dp-faint">
        {Array.from({length: Math.floor(w / 26)}, (_, i) => { const x = 8 + i * 26, y = top + (foot - top) * (0.3 + (i % 3) * 0.2); return <path key={i} d={`M${x} ${f1(y)}l7 -3l5 5l8 -2m-13 3l2 6`} /> })}
        {Array.from({length: Math.floor(w / 33)}, (_, i) => <circle key={`p${i}`} cx={15 + i * 33} cy={f1(top + (foot - top) * (0.55 + (i % 2) * 0.25))} r={1.4} fill="var(--text-faint)" stroke="none" />)}
      </g>}
      {flow !== 'dry' && ys.map((y, i) => <g key={i}>
        <path d={flow === 'flowing' ? wave(y, 1.6) : `M0 ${f1(y)}H${w}`} fill="none" stroke={flow === 'flowing' ? 'var(--dp-value)' : 'var(--text-faint)'} strokeWidth={1}
          opacity={flow === 'flowing' ? 0.7 : 0.55} strokeDasharray={flow === 'still' ? '5 4' : undefined} />
        {flow === 'flowing' && Array.from({length: Math.floor(w / 70)}, (_, k) => { const x = 30 + k * 70 + (i % 2) * 24; return <path key={k} d={`M${x} ${f1(y - 3)}l4 3l-4 3`} fill="none" stroke="var(--dp-value)" strokeWidth={1} /> })}
      </g>)}
      {Array.from({length: leaves}, (_, j) => { const y = ys[j % currents]!, x = (j + 0.5) * w / leaves
        return <ellipse key={j} cx={f1(x)} cy={f1(y - 0.5)} rx={3.4} ry={1.5} transform={`rotate(-18 ${f1(x)} ${f1(y)})`} fill="var(--dp-on)" /> })}
      <Bank w={w} y={top} up /><Bank w={w} y={foot} up={false} />
      {flow !== 'flowing' && <Words words={reading.why} w={w} y={(top + foot) / 2 - (reading.why.length > (w - 16) / 5.2 ? 6 : -3)} cls={flow === 'dry' ? 'dp-ink' : 'dp-ink-dim'} max={3} />}
      {flow === 'flowing' && <text x={w - 6} y={h - 5} className="dp-axis" textAnchor="end">{reading.why}</text>}
    </g>
  </Well>
}

// ---------------------------------------------------------------- the seasons

const SEASONS_DOES = 'The NOW field\'s year. Each clearing in growth stands as a stalk in ear, each quiescent one bends dormant; the closed ones lie harvested as sheaves at the right, and the archived ones lie in the soil, one mark each, the record.'

export function SeasonsEnviron({reading, w, h}: {reading: SeasonsReading | EnvironAbsent; w: number; h: number}) {
  const ground = h * 0.64
  if (isAbsent(reading)) return <Well kind="seasons" w={w} h={h} label="The seasons" does={`${SEASONS_DOES} ${reading.waits}`} state="waiting">
    <path d={`M0 ${f1(ground)}H${w}`} className="dp-faint" strokeDasharray="3 3" />
    <Words words={reading.waits} w={w} y={ground / 2} />
  </Well>
  const field = w * 0.74, pad = 6, n = reading.standing.length, step = (field - pad * 2) / Math.max(n, 1), tall = (ground - 8) * 0.8
  const {growth, dormant, harvested, record} = reading.counts
  const sheaves = harvested ?? 0, shown = Math.min(sheaves, 5)
  const sheafX = (i: number) => field + 10 + i * Math.max(9, (w - field - 18) / 5)
  // The record lies in the soil: one mark for each clearing archived, row on row, as many rows as the soil holds.
  const soil = h - ground - 16, area = Math.max(1, (w - 8) * soil)
  const cols = Math.max(1, Math.min(Math.floor((w - 8) / 4), Math.ceil(Math.sqrt((record ?? 0) * (w - 8) / Math.max(soil, 1)))))
  const rows = Math.max(1, Math.min(Math.floor(soil / 4), Math.ceil((record ?? 0) / cols)))
  const marks = area > 0 ? Math.min(record ?? 0, cols * rows) : 0, colW = (w - 8) / cols, rowH = soil / rows
  const words = [`${growth ?? '—'} in growth`, `${dormant ?? '—'} dormant`, `${harvested ?? '—'} harvested`, record === null ? 'the record unread' : `${record} in the record`].join(' · ')
  return <Well kind="seasons" w={w} h={h} label="The seasons" does={`${SEASONS_DOES} Now: ${words}.`} corner={growth === null ? undefined : `${growth} in growth`} state="live">
    <rect x={0} y={f1(ground)} width={w} height={f1(h - ground - 14)} fill="var(--text-faint)" opacity={0.14} />
    {Array.from({length: marks}, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols, jitter = ((i * 37) % 11) / 11 - 0.5
      const x = 4 + (c + 0.5 + (r % 2) * 0.5 + jitter * 0.4) * colW, y = ground + 2 + (r + 0.5 + jitter * 0.3) * rowH
      return <path key={i} d={`M${f1(x - 1.5)} ${f1(y + 1)}l3 -2`} stroke="var(--text-dim)" strokeWidth={1} opacity={0.5} />
    })}
    <path d={`M0 ${f1(ground)}H${w}`} className="dp-faint" />
    {n === 0 && <text x={field / 2} y={ground - 10} textAnchor="middle" className="dp-ink-dim">Fallow: nothing in growth</text>}
    {reading.standing.map((c, i) => {
      const x = pad + (i + 0.5) * step
      if (c.season === 'growth') return <g key={c.ref} data-season="growth"><title>{c.purpose}</title>
        <path d={`M${f1(x)} ${f1(ground)}V${f1(ground - tall)}`} stroke="var(--green)" strokeWidth={1.3} />
        <path d={`M${f1(x)} ${f1(ground - tall * 0.45)}q-3 -2 -4 -6M${f1(x)} ${f1(ground - tall * 0.62)}q3 -2 4 -6`} fill="none" stroke="var(--green)" strokeWidth={0.9} opacity={0.8} />
        <ellipse cx={f1(x)} cy={f1(ground - tall - 3.6)} rx={1.7} ry={4} fill="var(--green)" />
      </g>
      return <g key={c.ref} data-season="dormant" opacity={0.7}><title>{c.purpose}</title>
        <path d={`M${f1(x)} ${f1(ground)}Q${f1(x)} ${f1(ground - tall * 0.3)} ${f1(x + 3)} ${f1(ground - tall * 0.42)}`} fill="none" stroke="var(--text-faint)" strokeWidth={1.1} />
      </g>
    })}
    {Array.from({length: shown}, (_, i) => {
      const x = sheafX(i), s = Math.min(16, tall * 0.55)
      return <g key={i} data-season="harvested" stroke="var(--dp-on)" strokeWidth={1} fill="none">
        {[-3, -1.5, 0, 1.5, 3].map(dx => <path key={dx} d={`M${f1(x + dx * 0.6)} ${f1(ground)}L${f1(x + dx * 1.3)} ${f1(ground - s)}`} />)}
        <path d={`M${f1(x - 2.6)} ${f1(ground - s * 0.45)}H${f1(x + 2.6)}`} strokeWidth={1.6} />
      </g>
    })}
    {sheaves > shown && <text x={w - 4} y={ground - 4} textAnchor="end" className="dp-axis">+{sheaves - shown}</text>}
    <text x={6} y={h - 4} className="dp-axis">{words}</text>
  </Well>
}

// ---------------------------------------------------------------- the succession

const SUCCESSION_DOES = 'The product\'s seats as ground, one lane after another. Main is the soil the landed lanes laid down. A lane grows on its seat by the commits main does not hold; main\'s newer commits lie lighter on top; files with no commit mound beside it. A cleared seat waits for the next lane; orange is another lane\'s unmerged work, and a flag marks drift.'

export function SuccessionEnviron({reading, w, h}: {reading: SuccessionReading | EnvironAbsent; w: number; h: number}) {
  const ground = h * 0.58
  if (isAbsent(reading)) return <Well kind="succession" w={w} h={h} label="The succession" does={`${SUCCESSION_DOES} ${reading.waits}`} state="waiting">
    <path d={`M0 ${f1(ground)}H${w}`} className="dp-faint" strokeDasharray="3 3" />
    <Words words={reading.waits} w={w} y={ground / 2 - 4} />
  </Well>
  const plotW = w / reading.plots.length, strata = Math.max(2, Math.floor((h - ground - 18) / 5))
  const said = reading.plots.map(p => `${p.seat} ${p.state === 'free' ? 'cleared' : p.state === 'held' ? `${p.lane ?? 'a lane'}${p.ahead !== null ? ` +${p.ahead}` : ''}` : p.state === 'foreign' ? 'another lane\'s work' : 'unread'}`).join(' · ')
  return <Well kind="succession" w={w} h={h} label="The succession" does={`${SUCCESSION_DOES} Now: ${said}.`} corner={reading.product} state="live">
    <rect x={0} y={f1(ground)} width={w} height={f1(h - ground - 14)} fill="var(--text-faint)" opacity={0.14} />
    {Array.from({length: strata}, (_, k) => { const y = ground + 5 + k * 5
      return <path key={k} d={`M0 ${f1(y)}Q${f1(w * 0.35)} ${f1(y + (k % 2 ? 1 : -1))} ${f1(w * 0.6)} ${f1(y)}T${w} ${f1(y)}`} className="dp-faint" opacity={0.9 - Math.min(0.6, k * 0.08)} /> })}
    {reading.plots.map((p, i) => {
      const x0 = i * plotW, cx = x0 + plotW / 2
      const grow = p.ahead === null ? 0.35 : 0.2 + 0.8 * Math.min(1, Math.log2(p.ahead + 1) / 8)
      const tall = (ground - 8) * grow, plants = Math.min(5, p.workers), span = Math.min(plotW * 0.5, 9 * plants)
      const fresh = p.state === 'held' && p.behind ? Math.min(h - ground - 20, 2 + Math.log2(p.behind + 1) * 3) : 0
      const mound = p.loose ? Math.min(plotW * 0.2, 3 + Math.log2(p.loose + 1) * 2.4) : 0
      const xs = Array.from({length: plants}, (_, k) => cx - span / 2 + (plants === 1 ? span / 2 : k * span / (plants - 1)))
      const ink = p.state === 'foreign' ? 'var(--stall)' : 'var(--green)'
      return <g key={p.seat} data-plot={p.state}>
        <title>{`${p.seat}: ${p.state === 'held' ? 'held' : p.state === 'free' ? 'cleared' : p.state === 'foreign' ? 'another lane\'s unmerged work' : 'unread'}${p.lane ? ` · ${p.lane}` : ''}${p.ahead !== null && p.state !== 'free' ? ` · ${p.ahead} ahead of main` : ''}${p.behind ? ` · ${p.behind} behind main` : ''}${p.loose ? ` · ${plural(p.loose, 'file')} with no commit` : ''}${p.drift ? ' · drift' : ''}`}</title>
        {fresh > 0 && Array.from({length: Math.max(1, Math.round(fresh / 2.5))}, (_, k) => <path key={`f${k}`} d={`M${f1(x0 + 4)} ${f1(ground + 1.5 + k * 2.5)}Q${f1(cx)} ${f1(ground + 1.5 + k * 2.5 + (k % 2 ? 0.8 : -0.8))} ${f1(x0 + plotW - 4)} ${f1(ground + 1.5 + k * 2.5)}`}
          fill="none" stroke="var(--text-dim)" strokeWidth={0.8} opacity={0.45} />)}
        {p.state === 'free' && <path d={Array.from({length: 5}, (_, k) => `M${f1(cx - 15 + k * 7)} ${f1(ground - 1.2)}h4`).join('')} stroke="var(--text-faint)" strokeWidth={1.1} />}
        {(p.state === 'held' || p.state === 'foreign') && xs.map((x, k) => { const t = tall * (0.82 + 0.18 * ((k + 1) % 2))
          return <g key={k} stroke={ink} fill="none" strokeWidth={1.2} strokeDasharray={p.ahead === null ? '3 2' : undefined}>
            <path d={`M${f1(x)} ${f1(ground)}V${f1(ground - t)}`} />
            <path d={`M${f1(x)} ${f1(ground - t * 0.4)}q-4 -1 -6 -5M${f1(x)} ${f1(ground - t * 0.62)}q4 -1 6 -5M${f1(x)} ${f1(ground - t * 0.85)}q-3 -1 -4 -4`} strokeWidth={0.9} />
            <path d={`M${f1(x)} ${f1(ground)}l-3 ${f1(fresh + 5)}M${f1(x)} ${f1(ground)}l2 ${f1(fresh + 7)}M${f1(x)} ${f1(ground)}v${f1(fresh + 9)}`} strokeWidth={0.6} opacity={0.55} strokeDasharray={undefined} />
          </g> })}
        {p.state === 'unknown' && <text x={cx} y={ground - 6} textAnchor="middle" className="dp-axis">unread</text>}
        {mound > 0 && <path d={`M${f1(cx + span / 2 + 4)} ${f1(ground)}q${f1(mound / 2)} ${f1(-mound * 0.8)} ${f1(mound)} 0`} fill="var(--stall)" opacity={0.7} />}
        {p.drift && <g stroke="var(--stall)" strokeWidth={1}><path d={`M${f1(x0 + plotW - 8)} ${f1(ground)}V${f1(ground - 16)}`} /><path d={`M${f1(x0 + plotW - 8)} ${f1(ground - 16)}l6 2.5l-6 2.5`} fill="var(--stall)" /></g>}
        <text x={f1(x0 + 4)} y={h - 4} className="dp-axis">{p.seat}</text>
        {i > 0 && <path d={`M${f1(x0)} 4V${f1(ground)}`} className="dp-faint" strokeDasharray="2 3" />}
      </g>
    })}
    <path d={`M0 ${f1(ground)}H${w}`} className="dp-faint" />
  </Well>
}

// ---------------------------------------------------------------- the erosion

const EROSION_DOES = 'The ground in section, worn by repeated passage: one stretch for each part, one channel for each kind of wear, as wide as it is frequent and as deep as it is grave. A print is passage or a reading that is no fault; a groove is drift you can tend; a gully is a loss or a breach. A dot marks wear a tender fits. A dashed stretch is unsurveyed: its read was refused or is missing.'

/** One stretch's channels: each kind of wear cuts one notch, as wide as it is frequent (a log of the count) and as deep as it is grave. */
function cutsOf(s: ErosionStretch, x0: number, width: number, surface: number, below: number) {
  const inner = width - 12
  const widths = s.wear.map(w => (w.depth === 1 ? 10 : 6) + Math.log2(w.count + 1) * (w.depth === 1 ? 6 : 4))
  const total = widths.reduce((a, b) => a + b, 0), scale = total > inner ? inner / total : 1
  let cursor = x0 + 6 + (inner - total * scale) / 2, d = `M${f1(x0 + 2)} ${f1(surface)}`
  const cuts = s.wear.map((w, k) => {
    const wd = widths[k]! * scale, x = cursor + wd / 2
    cursor += wd
    const deep = w.depth === 1 ? 2 + Math.min(3, Math.log2(w.count + 1)) : below * Math.min(0.85, (w.depth === 2 ? 0.18 : 0.36) + Math.log2(w.count + 1) * 0.06)
    return {w, x, wd, deep}
  })
  for (const c of cuts) {
    if (c.w.depth === 1) {
      const dimples = Math.max(2, Math.min(9, Math.round(c.wd / 4)))
      for (let k = 0; k < dimples; k++) { const a = c.x - c.wd / 2 + k * c.wd / dimples, b = a + c.wd / dimples; d += `L${f1(a)} ${f1(surface)}Q${f1((a + b) / 2)} ${f1(surface + c.deep)} ${f1(b)} ${f1(surface)}` }
    } else d += `L${f1(c.x - c.wd / 2)} ${f1(surface)}C${f1(c.x - c.wd / 4)} ${f1(surface)} ${f1(c.x - c.wd / 6)} ${f1(surface + c.deep)} ${f1(c.x)} ${f1(surface + c.deep)}C${f1(c.x + c.wd / 6)} ${f1(surface + c.deep)} ${f1(c.x + c.wd / 4)} ${f1(surface)} ${f1(c.x + c.wd / 2)} ${f1(surface)}`
  }
  return {d: `${d}L${f1(x0 + width - 2)} ${f1(surface)}`, cuts}
}

export function ErosionEnviron({reading, w, h, label = 'The erosion'}: {reading: ErosionReading | EnvironAbsent; w: number; h: number; label?: string}) {
  const surface = h * 0.36
  if (isAbsent(reading)) return <Well kind="erosion" w={w} h={h} label={label} does={`${EROSION_DOES} ${reading.waits}`} state="waiting">
    <path d={`M0 ${f1(surface)}H${w}`} className="dp-faint" strokeDasharray="4 3" />
    <Words words={reading.waits} w={w} y={surface + 18} />
  </Well>
  const bandW = w / reading.stretches.length, below = h - 14 - surface
  const worn = reading.stretches.filter(s => s.state === 'worn').length
  const said = reading.stretches.map(s => `${s.label} ${s.state === 'worn' ? s.wear.map(x => `${x.count} ${x.label}`).join(', ') : s.state === 'sound' ? 'sound' : s.state === 'bare' ? 'bare' : 'unsurveyed'}`).join(' · ')
  return <Well kind="erosion" w={w} h={h} label={label} does={`${EROSION_DOES} Now: ${said}.${reading.unread.length ? ` ${reading.unread.join(' ')}` : ''}`} corner={`${worn} of ${reading.stretches.length} worn`} state="live">
    {reading.stretches.map((s, i) => {
      const x0 = i * bandW, {d, cuts} = cutsOf(s, x0, bandW, surface, below), open = s.state === 'unsurveyed' || s.state === 'bare'
      return <g key={s.id} data-stretch={s.state}>
        <title>{s.state === 'worn' ? `${s.label}: ${s.wear.map(x => `${x.count} ${x.label}`).join(', ')}${s.why ? ` · ${s.why}` : ''}` : s.why ?? `${s.label}: sound`}</title>
        <path d={`${d}L${f1(x0 + bandW - 2)} ${f1(h - 14)}L${f1(x0 + 2)} ${f1(h - 14)}Z`} fill="var(--text-faint)" opacity={open ? 0.05 : 0.16} />
        {[0.55, 0.7, 0.85].map((f, k) => { const y = surface + below * f
          return <path key={k} d={`M${f1(x0 + 2)} ${f1(y)}Q${f1(x0 + bandW * 0.5)} ${f1(y + (k % 2 ? 1.5 : -1.5))} ${f1(x0 + bandW - 2)} ${f1(y)}`} className="dp-faint" opacity={open ? 0.4 : 0.8} /> })}
        <path d={d} fill="none" stroke={open ? 'var(--text-faint)' : 'var(--text-dim)'} strokeWidth={1.2} strokeDasharray={s.state === 'unsurveyed' ? '4 3' : s.state === 'bare' ? '1 3' : undefined} />
        {cuts.filter(c => c.w.depth > 1).map((c, k) => <path key={k} d={`M${f1(c.x)} ${f1(surface + 2)}V${f1(surface + c.deep - 1)}`} stroke={c.w.depth === 3 ? 'var(--rec)' : 'var(--stall)'} strokeWidth={1} />)}
        {cuts.filter(c => c.wd > 9 || cuts.length < 4).map((c, k) => <text key={`n${k}`} x={f1(c.x)} y={f1(surface - 4)} textAnchor="middle" className="dp-axis">{c.w.count}</text>)}
        {cuts.filter(c => c.w.tendable).map((c, k) => <circle key={`t${k}`} cx={f1(c.x + Math.min(c.wd / 2, 6))} cy={f1(surface - 11)} r={1.6} fill="var(--dp-on)" />)}
        {s.state === 'sound' && <path d={Array.from({length: Math.floor((bandW - 8) / 9)}, (_, k) => `M${f1(x0 + 6 + k * 9)} ${f1(surface)}l${k % 2 ? 1 : -1} -4`).join('')} stroke="var(--green)" strokeWidth={0.9} opacity={0.6} />}
        {open && <text x={f1(x0 + bandW / 2)} y={f1(surface - 5)} textAnchor="middle" className="dp-axis">{s.state === 'bare' ? 'no source' : 'unsurveyed'}</text>}
        <text x={f1(x0 + 4)} y={h - 4} className="dp-axis">{s.label}</text>
        {i > 0 && <path d={`M${f1(x0)} 4V${f1(h - 14)}`} className="dp-faint" />}
      </g>
    })}
    {reading.unread.length > 0 && <text x={6} y={10} className="dp-axis">{reading.unread.join(' · ')}</text>}
  </Well>
}
