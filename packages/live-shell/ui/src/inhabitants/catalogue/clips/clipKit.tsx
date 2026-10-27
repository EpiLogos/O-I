// The Clip view kit: Live 12's Clip View, in the device kit's controls and tokens (ProjectCentral/docs/1-vision/dlw/DLW.md §16.5). The measures are Live's
// own, read from the captures (Work/reverse-engineering/ableton-live-12.0.25/evidence/ui/clip-view):
// - the head is the clip's title bar: its activator, its name on its colour, 17 px high in Live (cap 01, 02);
// - under it, two panels side by side, each 170 px wide in Live with a tab strip of 16 px (cap 02: Main Properties and Launch
//   Properties; then the tools: Pitch and Time, Transform, Generate). The kit's controls are 16 px where Live's are 13, so a
//   panel is 184 px here;
// - the editor takes the rest: a head row level with the title bar (its own toggles at the left, its tabs, a chooser at the
//   right: cap 01 "Fold · Scale · Highlight Scale … Notes · Envelopes · MPE … 1/16"), a ruler with the loop brace, the lanes,
//   and under them a lane of its own (velocity, cap 01) or the envelope's choosers (cap 13–18).
// Nothing in a panel scrolls; only the editor's content does, as in Live. Every control names what it does for the status bar
// (data-i "Name|What it does"), through the device kit's controls.
import {useRef, type CSSProperties, type MouseEvent, type ReactNode} from 'react'
import {Action, Chooser, Handle, Radio, Toggle, ValueBox, type Option, type Standing, type Tone} from '../../sdk/panel'
import {has, strOf, type Value} from '../panels/design'
import {TAB_KEY, type ClipProps, type ClipTab, type DesignedClip, type Place} from './design'
import './clips.css'

/** Live's measures, at the kit's control size. */
export const GROUP_W = 184, HEAD_H = 18, STRIP_H = 18, RULER_H = 16, FOOT_H = 20

const said = (name: string, does?: string) => (does ? `${name}|${does}` : name)

// ---------------------------------------------------------------- the frame

/** Clip view: the head and the panels at the left, the editor beside them. */
export function ClipView({design, p}: {design: DesignedClip; p: ClipProps}) {
  const shown = (tabs: readonly ClipTab[]) => tabs.filter(item => !item.shows || item.shows(p.v))
  const places = {panel: shown(design.panel), tools: shown(design.tools), editor: shown(design.editor)}
  const tab = (place: Place, tabs: readonly ClipTab[]) => tabs.find(item => item.id === strOf(p.v, TAB_KEY[place])) ?? tabs[0]
  const groups = (['panel', 'tools'] as const).filter(place => places[place].length > 0)
  const left = groups.length * GROUP_W + Math.max(0, groups.length - 1)
  const editor = tab('editor', places.editor)
  const ep: ClipProps = {...p, room: {w: p.room.w - left - 3, h: p.room.h - HEAD_H - 2}}
  const colour = strOf(p.v, design.head.colour)
  return <section className="clv" data-clip-mode={design.mode} data-size={p.size} aria-label={`Clip view: ${design.title}`}
    style={{width: p.room.w, height: p.room.h, '--clv-group': `${GROUP_W}px`} as CSSProperties}>
    {left > 0 && <div className="clv-panels" style={{width: left}}>
      <ClipHead p={p} name={design.head.name} colour={colour} active={design.head.active} />
      <div className="clv-groups">
        {groups.map(place => <PanelGroup key={place} place={place} tabs={places[place]} current={tab(place, places[place])} p={p} />)}
      </div>
    </div>}
    <div className="clv-editor">
      <div className="clv-ehead">
        <div className="clv-ebar">{editor?.bar?.(ep)}</div>
        <Tabs place="editor" tabs={places.editor} current={editor} p={p} />
        <div className="clv-ecorner">{design.corner?.(ep)}</div>
      </div>
      <div className="clv-ebody" data-editor={editor?.id}>{editor?.draw(ep)}</div>
    </div>
  </section>
}

/** The title bar: the clip's activator, then its name on its colour (cap 01: the orange square and "Melody" on blue). */
function ClipHead({p, name, colour, active}: {p: ClipProps; name: string; colour?: string; active?: string}) {
  const on = active ? p.v[active] !== false : true
  return <div className="clv-head" style={colour ? {'--clv-colour': colour} as CSSProperties : undefined}
    data-i={said('Clip', 'The clip: its name on its colour. Choose the colour from the clip\'s menu in the grid.')}>
    {active && <button type="button" className="clv-activator" aria-pressed={on} aria-label="Clip activator"
      data-i={said('Clip activator', 'Turns the clip on or off. An off clip stays where it is and does not play.')}
      onClick={() => p.set(active, !on)} />}
    <span className="clv-name">{has(p.v, name) ? String(p.v[name]) : '—'}</span>
  </div>
}

function PanelGroup({place, tabs, current, p}: {place: Place; tabs: readonly ClipTab[]; current?: ClipTab; p: ClipProps}) {
  return <div className="clv-group" data-place={place}>
    <Tabs place={place} tabs={tabs} current={current} p={p} />
    <div className="clv-body" data-tab={current?.id}>{current?.draw(p)}</div>
  </div>
}

/** A tab strip (Live's panel tabs, cap 02; the editor's tabs, cap 01). A single tab still shows, so the place is named. */
function Tabs({place, tabs, current, p}: {place: Place; tabs: readonly ClipTab[]; current?: ClipTab; p: ClipProps}) {
  return <div className="clv-tabs" role="tablist" data-place={place}>
    {tabs.map(item => <button key={item.id} type="button" role="tab" className="clv-tab" aria-selected={item.id === current?.id}
      data-i={said(item.label, item.does)} onClick={() => p.set(TAB_KEY[place], item.id)}>{item.label}</button>)}
  </div>
}

// ---------------------------------------------------------------- a panel's body

/** Fields two to a row, each named above its field (Live's Start | End, Position | Length, cap 02). */
export function Fields({cols = 2, children}: {cols?: number; children: ReactNode}) {
  return <div className="clv-fields" style={{gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`}}>{children}</div>
}

/** One field spanning the row. */
export function Wide({children}: {children: ReactNode}) {
  return <div className="clv-wide">{children}</div>
}

/** Rows named at the left, for a panel with many fields (a page's ties, a scene's body). */
export function Rows({children}: {children: ReactNode}) {
  return <div className="clv-rows">{children}</div>
}

/** One named row. The control inside carries the same name, for the status bar; the row shows it once, at the left. */
export function Row({label, children}: {label: string; children: ReactNode}) {
  return <div className="clv-row"><span className="clv-row-label">{label}</span><div className="clv-row-control">{children}</div></div>
}

/** Two values under one name, with a sign between them (Live's Signature "4 / 4"). Each control keeps its own name for the
 * status bar. */
export function Pair({label, sep = '/', children}: {label: string; sep?: string; children: [ReactNode, ReactNode]}) {
  return <div className="clv-pair"><span className="clv-pair-label">{label}</span>
    <div className="clv-pair-boxes">{children[0]}<span className="clv-pair-sep">{sep}</span>{children[1]}</div></div>
}

/** A hairline between blocks of a panel. */
export function Rule() {
  return <hr className="clv-rule" />
}

/** A small heading inside a panel (Live's "Launch", "Quantize"). */
export function Caption({children, right}: {children: ReactNode; right?: ReactNode}) {
  return <div className="clv-caption"><span>{children}</span>{right}</div>
}

/** A line the panel says, when there is nothing to set (a reading, or why a place is empty). */
export function Said({children}: {children: ReactNode}) {
  return <p className="clv-said">{children}</p>
}

/** A read-only fact as a field: its value in the field's frame, never editable (a revision, a state). */
export function Fact({label, does, value, tone}: {label: string; does: string; value?: ReactNode; tone?: Tone}) {
  const known = value !== undefined && value !== null && value !== ''
  return <div className="dp-cell dp-cell--wide clv-fact" data-i={said(label, known ? does : `${does} No reading from the owner yet.`)} data-unread={known ? undefined : 'true'}>
    <span className="dp-label">{label}</span>
    <output className="clv-fact-value" data-tone={known ? tone : undefined}>{known ? value : '—'}</output>
  </div>
}

// ---------------------------------------------------------------- time

/** Beats as Live writes a place: bars, beats and sixteenths, from 1 ("3. 1. 1"). */
export const place = (beats: number, per = 4) => {
  const bar = Math.floor(beats / per) + 1, beat = Math.floor(beats % per) + 1, six = Math.floor((beats % 1) * 4 + 1e-6) + 1
  return `${bar}. ${beat}. ${six}`
}
/** Beats as Live writes a length: bars, beats and sixteenths, from 0 ("2. 0. 0"). */
export const span = (beats: number, per = 4) => `${Math.floor(beats / per)}. ${Math.floor(beats % per)}. ${Math.floor((beats % 1) * 4 + 1e-6)}`

/** A place in the clip with Live's Set button beside its name (Start, End, Position, Length; cap 01, 02). */
export function PlaceField({label, does, value, def, min, max, format, onChange, onSet, standing}: {
  label: string; does: string; value?: number; def?: number; min: number; max: number; format: (x: number) => string
  onChange?: (x: number) => void; onSet?: () => void; standing?: Standing
}) {
  return <div className="clv-place">
    <div className="clv-place-head"><span>{label}</span>
      <button type="button" className="clv-set" disabled={!onSet} data-i={said('Set', `Sets ${label} to the playhead's place.`)} onClick={onSet}>Set</button>
    </div>
    <ValueBox {...standing} label={label} does={does} value={value ?? NaN} def={def} scale={{min, max, step: 0.25}} format={format} onChange={onChange} wide />
  </div>
}

// ---------------------------------------------------------------- the editor's lanes

export interface Lane {
  readonly id: string
  /** The name at the lane's key (C3; Read; a symbol's name). */
  readonly label?: string
  /** How the key is drawn: a white or black piano key, one of the Jankó keyboard's two row families, or a plain name. */
  readonly key?: 'white' | 'black' | 'a' | 'b' | 'name'
  /** The lane belongs to the scale or kind in force: highlighted when Highlight is on (cap 10). */
  readonly marked?: boolean
}

export interface Block {
  readonly id: string
  readonly lane: string
  readonly at: number
  /** Its length. Absent: it has no end yet (a running task), drawn fading to the right. */
  readonly len?: number
  readonly label?: string
  readonly tone?: Tone
  /** The change into the next step, after the hold (an Expression's glide), in the same unit as `len`. */
  readonly glide?: number
  /** 0–127, for the velocity lane. */
  readonly vel?: number
  /** Drawn dashed: it waits and has no length yet. */
  readonly dashed?: boolean
  /** Drawn striped: it stopped where its output stopped. */
  readonly striped?: boolean
  /** What it is, for the status bar. */
  readonly does?: string
}

/** A line across the lanes at a moment: a steer you sent, a marker, the present. */
export interface Mark {readonly at: number; readonly label: string; readonly tone?: Tone; readonly does?: string}

export interface LaneGridProps {
  readonly lanes: readonly Lane[]
  readonly blocks: readonly Block[]
  readonly marks?: readonly Mark[]
  /** The span shown, in the clip's own unit (beats, seconds). */
  readonly from: number
  readonly to: number
  /** The ruler's major step (a bar) and minor step (a beat), in the same unit. */
  readonly major: number
  readonly minor: number
  readonly label: (t: number) => string
  readonly loop?: {readonly from: number; readonly to: number}
  readonly keyW?: number
  readonly laneH?: number
  readonly highlight?: boolean
  readonly selected?: string
  readonly onSelect?: (id: string) => void
  readonly w: number
  readonly h: number
  readonly name: string
  readonly does: string
  /** A lane under the lanes, at full width (Live's velocity lane, cap 01). */
  readonly under?: ReactNode
  readonly underH?: number
}

/** The ruler with the loop brace, as Live draws it over its editor (cap 01: bar numbers, the blue brace). */
export function Ruler({from, to, major, minor, label, loop, keyW, w}: {from: number; to: number; major: number; minor: number; label: (t: number) => string; loop?: {from: number; to: number}; keyW: number; w: number}) {
  const inner = w - keyW, x = (t: number) => keyW + (t - from) / (to - from) * inner
  const ticks: ReactNode[] = []
  for (let t = Math.ceil(from / minor) * minor; t <= to + 1e-9; t += minor) {
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6
    ticks.push(<g key={t.toFixed(4)}>
      <line x1={x(t)} x2={x(t)} y1={isMajor ? 2 : 8} y2={11} className="clv-tick" />
      {(isMajor || inner / ((to - from) / minor) > 46) && <text x={x(t) + 2} y={8} className="clv-tick-label">{label(t)}</text>}
    </g>)
  }
  return <svg className="clv-ruler" width={w} height={RULER_H} viewBox={`0 0 ${w} ${RULER_H}`} aria-hidden="true">
    {ticks}
    {loop && <rect x={x(loop.from)} y={12} width={Math.max(1, x(loop.to) - x(loop.from))} height={4} className="clv-brace" />}
  </svg>
}

/** The lanes: a key or a name at the left of each lane, the blocks along the time, the ruler over them. The lanes scroll when
 * they do not fit (Live's note editor), the ruler and the lane under them stay. */
export function LaneGrid(g: LaneGridProps) {
  const keyW = g.keyW ?? 52, laneH = g.laneH ?? 10, underH = g.under ? (g.underH ?? 44) : 0
  const inner = g.w - keyW, x = (t: number) => keyW + (t - g.from) / (g.to - g.from) * inner
  const index = new Map(g.lanes.map((lane, i) => [lane.id, i]))
  const height = g.lanes.length * laneH
  const lines: ReactNode[] = []
  for (let t = Math.ceil(g.from / g.minor) * g.minor; t <= g.to + 1e-9; t += g.minor) {
    const isMajor = Math.abs(t / g.major - Math.round(t / g.major)) < 1e-6
    lines.push(<line key={t.toFixed(4)} x1={x(t)} x2={x(t)} y1={0} y2={height} className={isMajor ? 'clv-bar' : 'clv-beat'} />)
  }
  return <div className="clv-grid" style={{width: g.w}} data-i={said(g.name, g.does)}>
    <Ruler from={g.from} to={g.to} major={g.major} minor={g.minor} label={g.label} loop={g.loop} keyW={keyW} w={g.w} />
    <div className="clv-lanes" style={{height: g.h - RULER_H - underH}}>
      <svg width={g.w} height={Math.max(height, 1)} viewBox={`0 0 ${g.w} ${Math.max(height, 1)}`} role="group" aria-label={g.name}>
        <defs>
          <linearGradient id="clv-open" x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity="1" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
          <pattern id="clv-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" className="clv-stripe" /></pattern>
        </defs>
        {g.lanes.map((lane, i) => <g key={lane.id}>
          <rect x={keyW} y={i * laneH} width={inner} height={laneH} className="clv-lane" data-key={lane.key} data-marked={g.highlight && lane.marked ? 'true' : undefined} />
          <Key lane={lane} y={i * laneH} w={keyW} h={laneH} highlight={g.highlight} />
        </g>)}
        {lines}
        {g.blocks.map(block => {
          const row = index.get(block.lane)
          if (row === undefined) return null
          const x0 = x(block.at), y0 = row * laneH + 1, hh = laneH - 2
          const open = block.len === undefined
          const x1 = open ? x(g.to) : x(block.at + block.len!)
          const wide = Math.max(2, x1 - x0)
          const glide = block.glide ? Math.max(0, x(block.at + (block.len ?? 0) + block.glide) - x1) : 0
          return <g key={block.id} className="clv-block" data-tone={block.tone ?? 'value'} data-selected={block.id === g.selected ? 'true' : undefined}
            data-i={said(block.label ?? 'Step', block.does)} onClick={g.onSelect ? () => g.onSelect!(block.id) : undefined} style={{cursor: g.onSelect ? 'pointer' : undefined}}>
            <rect x={x0} y={y0} width={wide} height={hh} className="clv-block-body" data-open={open ? 'true' : undefined}
              style={open ? {fill: 'url(#clv-open)'} : undefined} strokeDasharray={block.dashed ? '3 2' : undefined} />
            {block.striped && <rect x={x0} y={y0} width={wide} height={hh} fill="url(#clv-stripes)" />}
            {glide > 0 && <path d={`M${x1} ${y0} L${x1 + glide} ${y0 + hh / 2} L${x1} ${y0 + hh} Z`} className="clv-glide" />}
            {block.label && laneH >= 12 && wide > 26 && <text x={x0 + 3} y={y0 + hh - 3} className="clv-block-label">{fit(block.label, wide - 6)}</text>}
          </g>
        })}
        {(g.marks ?? []).map(mark => <g key={`${mark.at}-${mark.label}`} className="clv-mark" data-tone={mark.tone ?? 'accent'} data-i={said(mark.label, mark.does)}>
          <line x1={x(mark.at)} x2={x(mark.at)} y1={0} y2={height} />
          <rect x={x(mark.at) - 3} y={0} width={6} height={6} />
        </g>)}
      </svg>
    </div>
    {g.under && <div className="clv-under" style={{height: underH}}>{g.under}</div>}
  </div>
}

/** Text cut to the room it has, at the lane's 9 px type (about 5 px a letter). */
export const fit = (text: string, px: number) => {
  const n = Math.max(1, Math.floor(px / 5.2))
  return text.length > n ? `${text.slice(0, Math.max(1, n - 1))}…` : text
}

function Key({lane, y, w, h, highlight}: {lane: Lane; y: number; w: number; h: number; highlight?: boolean}) {
  const kind = lane.key ?? 'name'
  if (kind === 'name') return <g>
    <rect x={0} y={y} width={w} height={h} className="clv-key" data-key="name" data-marked={highlight && lane.marked ? 'true' : undefined} />
    {lane.label && <text x={4} y={y + h - Math.max(2, (h - 8) / 2)} className="clv-key-label">{fit(lane.label, w - 6)}</text>}
  </g>
  // A key: its label at the left where it names a C (Live: C2, C3), the key itself at the right (cap 01, 11, 12).
  const keyX = w - 26
  return <g>
    <rect x={0} y={y} width={keyX} height={h} className="clv-key" data-key="gutter" />
    {lane.label && <text x={3} y={y + h - 1.5} className="clv-key-label">{lane.label}</text>}
    <rect x={keyX} y={y} width={26} height={h} className="clv-key" data-key={kind} data-marked={highlight && lane.marked ? 'true' : undefined} />
    {highlight && lane.marked && <rect x={w - 6} y={y} width={6} height={h} className="clv-key-mark" />}
  </g>
}

/** The lane under the notes: one stem for each block, as high as its value (Live's velocity lane, cap 01). */
export function StemLane({blocks, from, to, keyW, w, h, name, does, max = 127, top = '127', mid = '64', low = '1'}: {
  blocks: readonly Block[]; from: number; to: number; keyW: number; w: number; h: number; name: string; does: string; max?: number; top?: string; mid?: string; low?: string
}) {
  const inner = w - keyW, x = (t: number) => keyW + (t - from) / (to - from) * inner, y = (vel: number) => h - 4 - (vel / max) * (h - 8)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="clv-stems" data-i={said(name, does)} role="group" aria-label={name}>
    <rect x={0} y={0} width={keyW} height={h} className="clv-key" data-key="gutter" />
    <text x={keyW - 4} y={10} className="clv-axis" textAnchor="end">{top}</text>
    <text x={keyW - 4} y={h / 2 + 3} className="clv-axis" textAnchor="end">{mid}</text>
    <text x={keyW - 4} y={h - 3} className="clv-axis" textAnchor="end">{low}</text>
    {blocks.filter(block => block.vel !== undefined).map(block => <g key={block.id} className="clv-stem">
      <line x1={x(block.at)} x2={x(block.at)} y1={h - 4} y2={y(block.vel!)} />
      <circle cx={x(block.at)} cy={y(block.vel!)} r={2.5} />
      {block.len !== undefined && <line x1={x(block.at)} x2={x(block.at + block.len)} y1={y(block.vel!)} y2={y(block.vel!)} className="clv-stem-len" />}
    </g>)}
  </svg>
}

// ---------------------------------------------------------------- the envelope editor

export type Point = readonly [number, number]

export interface EnvelopeProps {
  readonly p: ClipProps
  /** The device chooser and the control chooser (cap 14, 15, 26, 27). */
  readonly devices: readonly Option<string>[]
  readonly device: string
  readonly onDevice: (device: string) => void
  readonly controls: readonly Option<string>[]
  readonly control: string
  readonly onControl: (control: string) => void
  /** Automation or Modulation, for a device's or the mixer's parameter (cap 16, 17). Absent for the clip's own controls (cap 27). */
  readonly mode?: 'automation' | 'modulation'
  readonly onMode?: (mode: 'automation' | 'modulation') => void
  /** Linked runs with the clip's loop; unlinked has its own start, end and loop (cap 18). */
  readonly linked: boolean
  readonly onLinked: (linked: boolean) => void
  readonly own?: {readonly start: number; readonly end: number; readonly format: (x: number) => string}
  /** The breakpoints, in the clip's time and the control's value. */
  readonly points: readonly Point[]
  readonly onPoints?: (points: readonly Point[]) => void
  /** A shape the lane computes instead of breakpoints (an Expression's wave or ramp): drawn, not dragged. */
  readonly curve?: (t: number) => number
  readonly min: number
  readonly max: number
  /** Named steps for a control that takes one of a few values (Effort: Low … Max): the lane draws steps between them. */
  readonly steps?: readonly string[]
  readonly format: (x: number) => string
  readonly from: number
  readonly to: number
  readonly major: number
  readonly minor: number
  readonly label: (t: number) => string
  /** What the lane is drawn over, faint (Live draws the notes behind the envelope, cap 13). */
  readonly behind?: (w: number, h: number, keyW: number) => ReactNode
  /** Controls beside the lane (an Expression lane's wave and rate). */
  readonly side?: ReactNode
  readonly sideW?: number
  readonly w: number
  readonly h: number
}

/** Live's envelope editor: the lane over the clip's time, the breakpoints as handles, and its choosers along the foot. Click the
 * line to add a breakpoint, drag one to move it, double-click one to remove it. */
export function EnvelopeEditor(e: EnvelopeProps) {
  const keyW = 52, sideW = e.side ? (e.sideW ?? 0) : 0
  const w = e.w - sideW, laneH = e.h - RULER_H - FOOT_H
  const inner = w - keyW, top = 8, bottom = laneH - 8
  const x = (t: number) => keyW + (t - e.from) / (e.to - e.from) * inner
  const tOf = (px: number) => e.from + (px - keyW) / inner * (e.to - e.from)
  const yOf = (value: number) => bottom - (value - e.min) / (e.max - e.min) * (bottom - top)
  const valueOf = (py: number) => {
    const raw = e.min + (bottom - py) / (bottom - top) * (e.max - e.min)
    const clamped = Math.min(e.max, Math.max(e.min, raw))
    return e.steps ? Math.round(clamped) : clamped
  }
  const svg = useRef<SVGSVGElement>(null)
  const sorted = [...e.points].sort((a, b) => a[0] - b[0])
  const stepped = !!e.steps
  const path = (() => {
    if (e.curve) {
      const n = Math.max(2, Math.round(inner / 3))
      return Array.from({length: n + 1}, (_, i) => { const t = e.from + i / n * (e.to - e.from); return `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${yOf(e.curve!(t)).toFixed(1)}` }).join(' ')
    }
    if (!sorted.length) return ''
    let d = `M${keyW} ${yOf(sorted[0]![1])}`
    for (const [t, value] of sorted) d += stepped ? ` H${x(t)} V${yOf(value)}` : ` L${x(t)} ${yOf(value)}`
    return `${d} H${keyW + inner}`
  })()
  const add = (event: MouseEvent<SVGRectElement>) => {
    if (!e.onPoints || e.curve) return
    const box = svg.current!.getBoundingClientRect()
    const t = tOf((event.clientX - box.left) * w / box.width), value = valueOf((event.clientY - box.top) * laneH / box.height)
    e.onPoints([...sorted, [Math.min(e.to, Math.max(e.from, t)), value] as const])
  }
  const tone = e.mode === 'modulation' ? 'value' : 'rec'
  return <div className="clv-env" style={{width: e.w}}>
    <div className="clv-env-main" style={{width: w}}>
      <Ruler from={e.from} to={e.to} major={e.major} minor={e.minor} label={e.label} keyW={keyW} w={w} />
      <svg ref={svg} className="clv-env-lane" width={w} height={laneH} viewBox={`0 0 ${w} ${laneH}`} role="group" aria-label="Envelope"
        data-i={said('Envelope', e.curve ? 'The shape the lane draws over the scene, from its settings at the right.' : 'Click the line to add a breakpoint. Drag a breakpoint to move it; double-click it to remove it.')}>
        <rect x={0} y={0} width={keyW} height={laneH} className="clv-key" data-key="gutter" />
        {e.steps ? e.steps.map((step, i) => <text key={step} x={keyW - 4} y={yOf(i) + 3} className="clv-axis" textAnchor="end">{step}</text>)
          : <>
            <text x={keyW - 4} y={top + 3} className="clv-axis" textAnchor="end">{e.format(e.max)}</text>
            <text x={keyW - 4} y={bottom + 3} className="clv-axis" textAnchor="end">{e.format(e.min)}</text>
          </>}
        <rect x={keyW} y={0} width={inner} height={laneH} className="clv-env-field" data-mode={e.mode ?? 'clip'} onClick={add} />
        {e.behind?.(w, laneH, keyW)}
        {e.steps?.map((_, i) => <line key={i} x1={keyW} x2={keyW + inner} y1={yOf(i)} y2={yOf(i)} className="clv-beat" />)}
        {path && <path d={path} className="clv-env-line" data-tone={tone} />}
        {!e.curve && !sorted.length && <line x1={keyW} x2={keyW + inner} y1={yOf((e.min + e.max) / 2)} y2={yOf((e.min + e.max) / 2)} className="clv-env-unset" />}
        {!e.curve && e.onPoints && sorted.map(([t, value], i) => <Handle key={`${i}-${t}`} x={x(t)} y={yOf(value)} shape="square" tone={tone === 'rec' ? 'accent' : 'value'}
          label={`Breakpoint ${i + 1}`} does={`${e.label(t)}: ${e.steps ? e.steps[Math.round(value)] ?? e.format(value) : e.format(value)}. Drag to move it; double-click to remove it.`}
          onDrag={(px, py) => e.onPoints!(sorted.map((point, j) => j === i ? [Math.min(e.to, Math.max(e.from, tOf(px))), valueOf(py)] as const : point))}
          onReset={() => e.onPoints!(sorted.filter((_, j) => j !== i))} />)}
      </svg>
      <div className="clv-foot">
        <Chooser label="Device" does="The device whose parameter the envelope moves." value={e.device} options={e.devices} onChange={e.onDevice} />
        <Chooser label="Control" does="The parameter the envelope moves over the clip's own time." value={e.control} options={e.controls} onChange={e.onControl} />
        {e.mode && <Radio label="Mode" value={e.mode} onChange={e.onMode} options={[
          {value: 'automation', label: 'Automation', does: 'Sets the value over the clip.'},
          {value: 'modulation', label: 'Modulation', does: 'Moves the value up and down from the track\'s own value or automation.'},
        ]} />}
        <Toggle label={e.linked ? 'Linked' : 'Unlinked'} does="Linked, the envelope runs with the clip's loop. Unlinked, it has its own start, end and loop." on={e.linked} onChange={e.onLinked} />
        {!e.linked && e.own && <span className="clv-own">
          <span>Start {e.own.format(e.own.start)}</span><span>End {e.own.format(e.own.end)}</span><span>Length {e.own.format(e.own.end - e.own.start)}</span>
        </span>}
      </div>
    </div>
    {e.side && <div className="clv-env-side" style={{width: sideW}}>{e.side}</div>}
  </div>
}

// ---------------------------------------------------------------- small helpers the designs share

/** The clip colours, as Live's clip menu offers them (cap 22), in the shell's own tokens. */
export const COLOURS: readonly Option<string>[] = [
  ['var(--sel)', 'Sky'], ['var(--fizz)', 'Teal'], ['var(--green)', 'Sage'], ['var(--honey)', 'Honey'], ['var(--accent)', 'Amber'], ['var(--stall)', 'Orange'],
  ['var(--rec)', 'Red'], ['var(--bumble)', 'Rose'], ['var(--parasakti)', 'Violet'], ['var(--w-ariadne)', 'Ochre'], ['var(--drone)', 'Grey-green'], ['var(--tower)', 'Sand'],
].map(([value, label]) => ({value: value!, label: label!}))

/** A value from the values, as the kit's controls take it: a string option, or the first option when absent. */
export const choice = (v: ClipProps['v'], key: string, fallback = '') => strOf(v, key) ?? fallback
/** A boolean value: undefined when absent, so a Toggle draws hollow. */
export const flag = (v: ClipProps['v'], key: string) => (has(v, key) ? v[key] === true : undefined)
/** A JSON value parsed, or `fallback`. */
export function read<T>(v: ClipProps['v'], key: string, fallback: T): T {
  if (!has(v, key)) return fallback
  try { return JSON.parse(String(v[key])) as T } catch { return fallback }
}
export const write = (p: ClipProps, key: string, value: unknown) => p.set(key, JSON.stringify(value) as Value)
/** A momentary act a design draws as Live's buttons (Duplicate, Transform, Generate): the press is recorded on its key. */
export function Press({p, k, label, does, why}: {p: ClipProps; k: string; label: string; does: string; why?: string}) {
  return <Action label={label} does={does} disabled={why} onPress={() => p.set(k, Date.now())} />
}
