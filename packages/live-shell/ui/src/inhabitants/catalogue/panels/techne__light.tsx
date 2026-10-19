// Light (manual §17.10, techne:light): an optical bench laid over the Canvas, to see how much of a source's force reaches a conclusion
// through a chain of readings. Live's nearest: a send effect whose display is the signal's path (Hybrid Reverb's routing page). The
// cards stay the Canvas's cards (its `items`, its `lines`); the bench adds a source, elements on cards, and sensors. Its engine is
// LightBox's (optics/raytracer.ts traceRays over the Canvas positions, nothing random); the display draws the same law:
//   - light leaves the source card and follows the lines you drew, from end to end, up to Bounces lines deep;
//   - a card shares the light it receives equally among its lines out, so a conclusion never holds more force than its source gave;
//   - a line passes the share its standing allows (Transmission: fact, claim, inference, guess) and loses to its length by Beer–Lambert,
//     e^(−length / 4000 canvas units);
//   - an element on a card changes what leaves it: a lens sends all of it down the line that passes most, a prism fans it into the
//     Spectrum's bands, a mirror sends it back along the line it came by, an absorber keeps a quarter, a stop ends it;
//   - a sensor reads the power that reaches it, the source being 1.
// A ray is presentation: it never becomes a relation, and Promote still goes to the relation's owner. The sensors' numbers are the
// engine's readings; the drawn rays only show where the light goes.
//
// Owners, and the keys on their paths:
//   items, lines     the Canvas's board (techne:canvas): items [{id, name, x, y, w, h}], lines [{from, to, standing}]
//   light.on         the light
//   light.source     the source card's id
//   light.card       the card whose element you set (the shell holds this choice)
//   light.elements   [{at, kind}], kind 'lens' | 'prism' | 'mirror' | 'absorber' | 'stop' | 'sensor'
//   light.bounces    1..100 (35)   light.segments  500..20000 (4500)   light.spectrum  5 | 9 | 13 bands (9)   light.rays  draw the rays
//   tx.fact, tx.claim, tx.inference, tx.guess   0..100 % each: proposed and tunable (100, 85, 60, 35)
//   sensor.power     the engine's readings: [{at, power}]
import {Band, Chooser, Dial, Display, Folded, Panel, Radio, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, pct, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type Kind = 'lens' | 'prism' | 'mirror' | 'absorber' | 'stop' | 'sensor'
type StandingWord = 'fact' | 'claim' | 'inference' | 'guess'
const KIND_WORD: Record<Kind, string> = {lens: 'Lens', prism: 'Prism', mirror: 'Mirror', absorber: 'Absorber', stop: 'Stop', sensor: 'Sensor'}
const KIND_MARK: Record<Kind, string> = {lens: '()', prism: '△', mirror: '|', absorber: '▪', stop: '✕', sensor: '◎'}
const STANDINGS: readonly StandingWord[] = ['fact', 'claim', 'inference', 'guess']
const TX_DEF: Record<StandingWord, number> = {fact: 100, claim: 85, inference: 60, guess: 35}
const SPECTRA = [{value: '5', label: '5', does: 'Five bands.'}, {value: '9', label: '9', does: 'Nine bands.'}, {value: '13', label: '13', does: 'Thirteen bands.'}] as const
const ABSORBED = .25, LOSS_LENGTH = 4000

interface Item {readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number}
interface Line {readonly from: string; readonly to: string; readonly standing?: StandingWord}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const itemsOf = (v: V): Item[] | undefined => {
  const raw = json<unknown>(v, 'items', undefined)
  return Array.isArray(raw) ? raw.flatMap((e): Item[] => (rec(e) && typeof e.id === 'string' && fin(e.x) && fin(e.y) && fin(e.w) && fin(e.h) ? [{id: e.id, name: String(e.name ?? e.id), x: e.x, y: e.y, w: e.w, h: e.h}] : [])) : undefined
}
const linesOf = (v: V): Line[] => json<unknown[]>(v, 'lines', []).flatMap((e): Line[] => (rec(e) && typeof e.from === 'string' && typeof e.to === 'string'
  ? [{from: e.from, to: e.to, standing: STANDINGS.includes(e.standing as StandingWord) ? e.standing as StandingWord : undefined}] : []))
const elementsOf = (v: V): Map<string, Kind> => new Map(json<unknown[]>(v, 'light.elements', []).flatMap((e): [string, Kind][] => (rec(e) && typeof e.at === 'string' && typeof e.kind === 'string' && e.kind in KIND_WORD ? [[e.at, e.kind as Kind]] : [])))
const txOf = (v: V, s: StandingWord | undefined) => { if (s === undefined) return undefined; const x = numOf(v, `tx.${s}`); return x === undefined ? undefined : clampTo(0, 100, x) / 100 }

/** The bench by its law: the power on each line and reaching each card, from the source, up to Bounces lines deep. */
export function trace(v: V) {
  const items = itemsOf(v) ?? [], lines = linesOf(v), elements = elementsOf(v), source = strOf(v, 'light.source'), bounces = numOf(v, 'light.bounces') ?? 35
  const at = new Map(items.map(i => [i.id, i])), centre = (i: Item) => [i.x + i.w / 2, i.y + i.h / 2] as const
  const lineLoad = new Map<number, number>(), cardLoad = new Map<string, number>(), spectral = new Set<number>()
  if (!source || !at.has(source) || boolOf(v, 'light.on') === false) return {items, lines, elements, lineLoad, cardLoad, spectral, source}
  type Ray = {card: string; power: number; came?: number; depth: number; split: boolean}
  const queue: Ray[] = [{card: source, power: 1, depth: 0, split: false}]
  cardLoad.set(source, 1)
  while (queue.length) {
    const ray = queue.shift()!
    if (ray.depth >= bounces || ray.power < 1e-3) continue
    const kind = elements.get(ray.card)
    if (ray.card !== source && (kind === 'stop' || kind === 'sensor')) continue
    let outs = lines.map((l, i) => [l, i] as const).filter(([l]) => l.from === ray.card && txOf(v, l.standing) !== undefined)
    if (kind === 'mirror' && ray.came !== undefined) outs = [[{from: ray.card, to: lines[ray.came]!.from, standing: lines[ray.came]!.standing}, ray.came] as const]
    if (kind === 'lens' && outs.length > 1) outs = [outs.reduce((best, o) => (txOf(v, o[0].standing)! > txOf(v, best[0].standing)! ? o : best))]
    if (!outs.length) continue
    const power = ray.power * (kind === 'absorber' ? ABSORBED : 1) / outs.length
    for (const [line, index] of outs) {
      const a = at.get(line.from), b = at.get(line.to), tx = txOf(v, line.standing)
      if (!a || !b || tx === undefined) continue
      const [ax, ay] = centre(a), [bx, by] = centre(b), arrive = power * tx * Math.exp(-Math.hypot(bx - ax, by - ay) / LOSS_LENGTH)
      lineLoad.set(index, (lineLoad.get(index) ?? 0) + arrive)
      if (kind === 'prism' || ray.split) spectral.add(index)
      cardLoad.set(line.to, (cardLoad.get(line.to) ?? 0) + arrive)
      queue.push({card: line.to, power: arrive, came: index, depth: ray.depth + 1, split: kind === 'prism' || ray.split})
    }
  }
  return {items, lines, elements, lineLoad, cardLoad, spectral, source}
}

/** The bench over the board, fitted to the well. */
function Bench({v, w, h, labels}: {v: V; w: number; h: number; labels: boolean}) {
  const t = trace(v)
  if (!t.items.length) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No board from the Canvas' : NONE}</text>
  const x0 = Math.min(...t.items.map(i => i.x)), y0 = Math.min(...t.items.map(i => i.y)), x1 = Math.max(...t.items.map(i => i.x + i.w)), y1 = Math.max(...t.items.map(i => i.y + i.h))
  const k = Math.min((w - 16) / (x1 - x0), (h - 16) / (y1 - y0)), ox = (w - (x1 - x0) * k) / 2, oy = (h - (y1 - y0) * k) / 2
  const X = (x: number) => ox + (x - x0) * k, Y = (y: number) => oy + (y - y0) * k
  const chosen = strOf(v, 'light.card'), byId = new Map(t.items.map(i => [i.id, i])), bands = Number(strOf(v, 'light.spectrum') ?? 9), rays = boolOf(v, 'light.rays') !== false, read = powerOf(v)
  const hue = (b: number) => `hsl(${Math.round(270 - 270 * b / Math.max(1, bands - 1))} 80% 62%)`
  return <g>
    {t.lines.map((l, i) => { const a = byId.get(l.from), b = byId.get(l.to); if (!a || !b) return null
      const ax = X(a.x + a.w / 2), ay = Y(a.y + a.h / 2), bx = X(b.x + b.w / 2), by = Y(b.y + b.h / 2), load = t.lineLoad.get(i)
      return <g key={i}>
        <path d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`} className="dp-faint" strokeDasharray={l.standing ? undefined : '2 2'} />
        {rays && load !== undefined && (t.spectral.has(i)
          ? Array.from({length: bands}, (_, b) => { const off = (b - (bands - 1) / 2) * 1.1, nx = -(by - ay), ny = bx - ax, len = Math.hypot(nx, ny) || 1
            return <path key={b} d={`M${(ax + nx / len * off).toFixed(1)} ${(ay + ny / len * off).toFixed(1)}L${(bx + nx / len * off).toFixed(1)} ${(by + ny / len * off).toFixed(1)}`} stroke={hue(b)} strokeWidth={.7} opacity={clampTo(.15, 1, load)} /> })
          : <path d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`} stroke="var(--dp-on)" strokeWidth={.6 + 3.2 * load} opacity={clampTo(.2, 1, .25 + load)} />)}
      </g> })}
    {t.items.map(i => { const kind = t.elements.get(i.id), load = read.get(i.id), src = i.id === t.source
      return <g key={i.id}>
        <rect x={X(i.x)} y={Y(i.y)} width={i.w * k} height={i.h * k} rx={2} fill="var(--dp-well)" stroke={src ? 'var(--dp-on)' : kind === 'sensor' ? 'var(--dp-value)' : 'var(--dp-value-dim)'} strokeWidth={src || kind === 'sensor' ? 1.4 : .8} />
        {i.id === chosen && <rect x={X(i.x) - 2.5} y={Y(i.y) - 2.5} width={i.w * k + 5} height={i.h * k + 5} rx={3} fill="none" stroke="var(--dp-on)" strokeWidth={.8} strokeDasharray="2 2" />}
        {labels && i.w * k > 40 && <text x={X(i.x) + 3} y={Y(i.y) + 10} className="dp-ink" style={{fontSize: 8}}>{i.name}</text>}
        {kind && <text x={X(i.x + i.w) - 3} y={Y(i.y) + 10} textAnchor="end" className="dp-axis" style={{fontSize: 8}}>{KIND_MARK[kind]}</text>}
        {labels && kind === 'sensor' && <text x={X(i.x + i.w / 2)} y={Y(i.y + i.h) - 3} textAnchor="middle" className="dp-ink" style={{fontSize: 9}}>{load === undefined ? NONE : pct(load * 100)}</text>}
        {labels && src && <text x={X(i.x + i.w / 2)} y={Y(i.y + i.h) - 3} textAnchor="middle" className="dp-axis" style={{fontSize: 8}}>source</text>}
      </g> })}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'light.on'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light.on').disabled, onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light.on', !(boolOf(p.v, 'light.on') === true))})
const DISPLAY_DOES = 'The bench over the Canvas: light leaves the source card and follows your lines; each line passes the share its standing allows; a sensor reads what arrives.'
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined

/** The engine's reading at each sensor, by the card it stands on. */
const powerOf = (v: V) => new Map(json<unknown[]>(v, 'sensor.power', []).flatMap((r): [string, number][] => (rec(r) && typeof r.at === 'string' && fin(r.power) ? [[r.at, r.power]] : [])))
function sensorRows(v: V): RowItem[] {
  const items = new Map((itemsOf(v) ?? []).map(i => [i.id, i])), read = powerOf(v)
  return [...elementsOf(v)].filter(([, kind]) => kind === 'sensor').map(([at]) => {
    const power = read.get(at)
    return {id: at, name: items.get(at)?.name ?? at, light: power === undefined ? 'unknown' : power > 0 ? 'lit' : 'dark', tone: 'value', note: power === undefined ? NONE : pct(power * 100)}
  })
}
function controls(p: ViewProps) {
  const v = p.v, items = itemsOf(v) ?? []
  const tx = (s: StandingWord) => <Dial key={s} {...st(p, `tx.${s}`)} label={s.charAt(0).toUpperCase() + s.slice(1)} does={`How much of the light a ${s} passes. Proposed and tunable.`}
    value={numOf(v, `tx.${s}`) ?? NaN} def={TX_DEF[s]} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set(`tx.${s}`, Math.round(x))} />
  const known = STANDINGS.map(s => numOf(v, `tx.${s}`)), all = known.every(x => x !== undefined), mean = all ? known.reduce((a, b) => a! + b!, 0)! / 4 : NaN
  return {
    source: <Chooser {...st(p, 'light.source')} label="Source" does="The card the light leaves." value={strOf(v, 'light.source') ?? ''} options={items.map(i => ({value: i.id, label: i.name}))}
      onChange={x => p.set('light.source', x)} disabled={st(p, 'light.source').disabled ?? (items.length ? undefined : 'The Canvas reports no cards.')} />,
    card: <Chooser {...st(p, 'light.card')} label="Card" does="The card whose element you set." value={strOf(v, 'light.card') ?? ''} options={items.map(i => ({value: i.id, label: i.name}))}
      onChange={x => p.set('light.card', x)} disabled={st(p, 'light.card').disabled ?? (items.length ? undefined : 'The Canvas reports no cards.')} />,
    element: (() => { const card = strOf(v, 'light.card'), placed = elementsOf(v)
      return <Chooser {...st(p, 'light.elements')} label="Element" does="What the chosen card does to the light." value={card === undefined ? '' : placed.get(card) ?? 'none'}
        options={[{value: 'none', label: 'None', does: 'The card shares its light among its lines out.'}, ...(Object.keys(KIND_WORD) as Kind[]).map(k => ({value: k, label: KIND_WORD[k]}))]}
        onChange={x => { if (card === undefined) return; const next = new Map(placed); if (x === 'none') next.delete(card); else next.set(card, x as Kind)
          p.set('light.elements', JSON.stringify([...next].map(([at, kind]) => ({at, kind})))) }}
        disabled={st(p, 'light.elements').disabled ?? (card === undefined ? 'Choose a card first.' : undefined)} /> })(),
    bounces: <ValueBox {...st(p, 'light.bounces')} label="Bounces" does="How many lines deep the light travels." value={numOf(v, 'light.bounces') ?? NaN} def={35} scale={{min: 1, max: 100, step: 1}} format={x => `${x}`} onChange={x => p.set('light.bounces', x)} />,
    segments: <ValueBox {...st(p, 'light.segments')} label="Segments" does="How finely the engine traces each ray." value={numOf(v, 'light.segments') ?? NaN} def={4500} scale={{min: 500, max: 20000, log: true, step: 100}} format={x => `${Math.round(x)}`} onChange={x => p.set('light.segments', Math.round(x / 100) * 100)} />,
    spectrum: <Radio {...st(p, 'light.spectrum')} label="Spectrum" does="How many bands a prism fans the light into." value={strOf(v, 'light.spectrum') ?? ''} options={SPECTRA} onChange={x => p.set('light.spectrum', Number(x))} />,
    rays: <Toggle {...st(p, 'light.rays')} label="Rays" does="Draw the rays over the Canvas." on={boolOf(v, 'light.rays') === true} unknown={boolOf(v, 'light.rays') === undefined} onChange={x => p.set('light.rays', x)} />,
    tx,
    // The macro moves the four standings together, each within its own range.
    transmission: <Dial label="Transmit" does="Moves the four standings' transmission together, each within its range." value={mean} def={70} scale={{min: 0, max: 100}} format={pct}
      onChange={all ? x => { const d = x - mean; STANDINGS.forEach((s, i) => p.set(`tx.${s}`, Math.round(clampTo(0, 100, known[i]! + d)))) } : undefined} />,
  }
}

export const design: DesignedDevice = {
  id: 'techne:light',
  title: 'Light',
  kind: 'effect',
  defaults: {
    'light.on': true,
    // A reading's chain on the Canvas: a dream as the source, two images, a reading, and two conclusions as sensors. Positions are
    // the Canvas's own (canvas units); the lines carry the standings the person gave them.
    items: JSON.stringify([
      {id: 'dream', name: 'The river dream', x: 0, y: 160, w: 300, h: 120}, {id: 'water', name: 'Water', x: 520, y: 0, w: 260, h: 110},
      {id: 'crossing', name: 'Crossing', x: 520, y: 330, w: 260, h: 110}, {id: 'reading', name: 'A threshold', x: 1020, y: 160, w: 280, h: 120},
      {id: 'move', name: 'Change jobs', x: 1520, y: 40, w: 260, h: 110}, {id: 'grief', name: 'Grief, unsaid', x: 1520, y: 320, w: 260, h: 110}]),
    lines: JSON.stringify([
      {from: 'dream', to: 'water', standing: 'fact'}, {from: 'dream', to: 'crossing', standing: 'claim'}, {from: 'water', to: 'reading', standing: 'inference'},
      {from: 'crossing', to: 'reading', standing: 'claim'}, {from: 'reading', to: 'move', standing: 'guess'}, {from: 'reading', to: 'grief', standing: 'inference'}]),
    'light.source': 'dream', 'light.card': 'reading',
    'light.elements': JSON.stringify([{at: 'move', kind: 'sensor'}, {at: 'grief', kind: 'sensor'}]),
    'light.bounces': 35, 'light.segments': 4500, 'light.spectrum': 9, 'light.rays': true,
    'tx.fact': 100, 'tx.claim': 85, 'tx.inference': 60, 'tx.guess': 35,
    // The engine's readings at the two sensors, by the law above (trace() gives the same numbers).
    'sensor.power': JSON.stringify([{at: 'move', power: .078}, {at: 'grief', power: .134}]),
  },
  fixtures: {
    'Two conclusions share the reading': {},
    'A lens at the reading': {'light.elements': JSON.stringify([{at: 'reading', kind: 'lens'}, {at: 'move', kind: 'sensor'}, {at: 'grief', kind: 'sensor'}]),
      'sensor.power': JSON.stringify([{at: 'move', power: 0}, {at: 'grief', power: .268}])},
    'A prism at the dream': {'light.elements': JSON.stringify([{at: 'dream', kind: 'prism'}, {at: 'move', kind: 'sensor'}, {at: 'grief', kind: 'sensor'}])},
    'Guesses pass little': {'tx.guess': 10, 'tx.inference': 40, 'sensor.power': JSON.stringify([{at: 'move', power: .019}, {at: 'grief', power: .076}])},
    'No board': {items: undefined, lines: undefined, 'sensor.power': undefined},
    'No readings': {'light.on': undefined, items: undefined, lines: undefined, 'light.source': undefined, 'light.card': undefined, 'light.elements': undefined, 'light.bounces': undefined, 'light.segments': undefined,
      'light.spectrum': undefined, 'light.rays': undefined, 'tx.fact': undefined, 'tx.claim': undefined, 'tx.inference': undefined, 'tx.guess': undefined, 'sensor.power': undefined},
  },

  folded: p => { const items = new Map((itemsOf(p.v) ?? []).map(i => [i.id, i])), src = strOf(p.v, 'light.source')
    return <Folded title="Light" light={lightOf(p)} readings={[src ? items.get(src)?.name ?? src : NONE, `${sensorRows(p.v).length} sensors`]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p)
    return <Panel title="Light" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The bench" does={DISPLAY_DOES}><Bench v={p.v} w={140} h={146} labels={false} /></Display></Section>
      <Section label="Macros" cols={2}>{c.spectrum}{c.bounces}{c.transmission}{c.rays}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 600, 480)) : 186
    return <Panel title="Light" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><Display w={w} h={146} label="The bench" does={DISPLAY_DOES}><Bench v={p.v} w={w} h={146} labels={w > 200} /></Display></Section>
        <Section label="Source" width={124}>{c.source}{c.card}{c.element}</Section>
        <Section label="Rays" cols={2} grow>{c.bounces}{c.segments}{c.spectrum}{c.rays}</Section>
      </Band>
      <Band>
        <Section label="Transmission" cols={4} width={232}>{STANDINGS.map(s => c.tx(s))}</Section>
        <Section label="Sensors" grow><Rows does="The power that reaches each sensor, the source being 100 %." items={sensorRows(p.v)} size={4} /></Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The bench over the Canvas">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Bench v={p.v} w={760} h={420} labels /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Light" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={110} h={100} label="The bench" does={DISPLAY_DOES}><Bench v={p.v} w={110} h={100} labels={false} /></Display>
    <Rows does="The power at each sensor." items={sensorRows(p.v)} size={3} />
  </Tile>,
}
