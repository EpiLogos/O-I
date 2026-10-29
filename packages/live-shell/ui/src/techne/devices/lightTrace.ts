// Technē's light trace over the Canvas (the catalogue's techne:light, carried as the Canvas's Light page; O-I ticket 684). The design names
// LightBox's engine (EpiLogos/LightBox src/optics/raytracer.ts traceRays) and draws the bench by its own law (techne__canvas.tsx `trace`),
// which is the display law: this is that law as Technē's engine, over the Canvas positions the research frame reports — each card's
// centre, and the lines between cards with the standing each carries. LightBox's raytracer itself (2D geometric optics over placed optical
// elements: Fresnel splitting, refraction by wavelength) is not this candidate's: the board holds cards and lines, not optical surfaces.
//   - light leaves the source card and follows the lines you drew, up to Bounces lines deep, while it carries a thousandth of the source;
//   - a card shares the light it receives equally among its lines out, so a conclusion never holds more than its source gave;
//   - a line passes the share its standing allows (Transmission) and loses to its length, e^(−length / 4000 canvas units); a line that
//     carries no standing passes nothing;
//   - an element on a card changes what leaves it: a funnel sends all of it down the line out that passes the most, a prism fans it into the
//     Spectrum's bands (drawn, not divided), a mirror sends it back along the line it came by, an absorber keeps a quarter, a stop ends it, a
//     sensor reads what arrives and ends it.
// Deterministic, nothing random, and a ray is a picture: it never becomes a relation. Pure.

export type Element = 'funnel' | 'prism' | 'mirror' | 'absorber' | 'stop' | 'sensor'
export type StandingWord = 'fact' | 'claim' | 'inference' | 'guess'
export const ELEMENTS: readonly Element[] = ['funnel', 'prism', 'mirror', 'absorber', 'stop', 'sensor']
export const STANDINGS: readonly StandingWord[] = ['fact', 'claim', 'inference', 'guess']
/** What an absorber keeps, and the length over which a line's light falls by e (canvas units). */
export const ABSORBED = 0.25, LOSS_LENGTH = 4000
/** The share of the source below which a ray is no longer followed. */
export const FLOOR = 1e-3

export interface BoardCard {readonly id: string; readonly kind: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number}
export interface BoardLine {readonly from: string; readonly to: string; readonly standing?: string}
export interface Board {readonly cards: readonly BoardCard[]; readonly lines: readonly BoardLine[]}

export interface LightSettings {
  readonly on: boolean
  readonly source: string | undefined
  readonly elements: readonly {readonly at: string; readonly kind: string}[]
  readonly bounces: number
  /** Each standing's transmission, 0..100 %. */
  readonly tx: Readonly<Record<StandingWord, number | undefined>>
}

export interface LightTrace {
  /** The light reaching each card, the source being 1. */
  readonly cards: Readonly<Record<string, number>>
  /** The light each line carries, by the line's place on the board. */
  readonly lines: readonly number[]
  /** What each sensor reads, in the order the elements name them. */
  readonly sensors: readonly {readonly at: string; readonly power: number}[]
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const parse = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try { return JSON.parse(raw) } catch { return undefined }
}

/** The bench's board from the Canvas's values (`items`, `lines`, as canvasValues reports them): the cards and stickies, and each line
 * between two of them by index or id, with the standing it carries as its third element where it carries one. */
export function boardOf(values: Readonly<Record<string, unknown>>): Board {
  const items = parse(values.items), lines = parse(values.lines)
  const cards: BoardCard[] = (Array.isArray(items) ? items : []).flatMap((o): BoardCard[] => (o && typeof o === 'object' && typeof o.id === 'string'
    && (o.kind === 'card' || o.kind === 'sticky') && [o.x, o.y, o.w, o.h].every(finite) ? [{id: o.id, kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h}] : []))
  const end = (k: unknown) => (typeof k === 'number' ? cards[k] : cards.find(card => card.id === k))
  const bench: BoardLine[] = (Array.isArray(lines) ? lines : []).flatMap((e): BoardLine[] => {
    if (!Array.isArray(e) || (e.length !== 2 && e.length !== 3)) return []
    const a = end(e[0]), b = end(e[1])
    return a && b ? [{from: a.id, to: b.id, ...(typeof e[2] === 'string' ? {standing: e[2]} : {})}] : []
  })
  return {cards, lines: bench}
}

/** The trace of the light over the board, by the bench's law. */
export function traceRays(board: Board, settings: LightSettings): LightTrace {
  const elements = new Map<string, Element>()
  for (const e of settings.elements) {
    const kind = e.kind === 'lens' ? 'funnel' : e.kind
    if ((ELEMENTS as readonly string[]).includes(kind)) elements.set(e.at, kind as Element)
  }
  const at = new Map(board.cards.map(card => [card.id, card]))
  const txOf = (standing: string | undefined) => {
    if (!standing || !(STANDINGS as readonly string[]).includes(standing)) return undefined
    const x = settings.tx[standing as StandingWord]
    return finite(x) ? Math.min(100, Math.max(0, x)) / 100 : undefined
  }
  const cardLoad = new Map<string, number>(), lineLoad = board.lines.map(() => 0)
  const sensors = () => [...elements].filter(([, kind]) => kind === 'sensor').map(([card]) => ({at: card, power: cardLoad.get(card) ?? 0}))
  const source = settings.source
  if (!settings.on || !source || !at.has(source)) return {cards: Object.fromEntries(cardLoad), lines: lineLoad, sensors: sensors()}
  const centre = (card: BoardCard) => [card.x + card.w / 2, card.y + card.h / 2] as const
  type Ray = {card: string; power: number; came?: number; depth: number}
  const queue: Ray[] = [{card: source, power: 1, depth: 0}]
  cardLoad.set(source, 1)
  while (queue.length) {
    const ray = queue.shift()!
    if (ray.depth >= settings.bounces || ray.power < FLOOR) continue
    const kind = elements.get(ray.card)
    if (ray.card !== source && (kind === 'stop' || kind === 'sensor')) continue
    let outs = board.lines.map((line, index) => [line, index] as const).filter(([line]) => line.from === ray.card && txOf(line.standing) !== undefined)
    if (kind === 'mirror' && ray.came !== undefined) {
      const back = board.lines[ray.came]!
      outs = [[{from: ray.card, to: back.from, ...(back.standing ? {standing: back.standing} : {})}, ray.came] as const]
    }
    if (kind === 'funnel' && outs.length > 1) outs = [outs.reduce((best, o) => (txOf(o[0].standing)! > txOf(best[0].standing)! ? o : best))]
    if (!outs.length) continue
    const power = ray.power * (kind === 'absorber' ? ABSORBED : 1) / outs.length
    for (const [line, index] of outs) {
      const a = at.get(line.from), b = at.get(line.to), tx = txOf(line.standing)
      if (!a || !b || tx === undefined) continue
      const [ax, ay] = centre(a), [bx, by] = centre(b), arrive = power * tx * Math.exp(-Math.hypot(bx - ax, by - ay) / LOSS_LENGTH)
      lineLoad[index] = lineLoad[index]! + arrive
      cardLoad.set(line.to, (cardLoad.get(line.to) ?? 0) + arrive)
      queue.push({card: line.to, power: arrive, came: index, depth: ray.depth + 1})
    }
  }
  return {cards: Object.fromEntries(cardLoad), lines: lineLoad, sensors: sensors()}
}
