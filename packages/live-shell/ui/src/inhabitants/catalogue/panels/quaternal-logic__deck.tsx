// Deck (manual §22.4): a spread of cards, or a hexagram, for a concern you carry, read in six positions that answer one another.
// Live's nearest: Simpler in Slice mode — one display of the material cut into its parts, a few choosers beside it. The display
// is the spread by its own law: the six positions laid in their pairs, P0 over P5, P1 over P4, P2 over P3 (a pair reads as one),
// each card by its name and the codon it belongs to, a reversed card turned; the Sphere fills P0 and P1, the Torus all six, the
// Klein adds the night cards P0′ to P5′ under the day. An I Ching reading draws its six lines from the bottom, the moving lines
// (6 and 9) marked, and the hexagram they turn into beside it: a 6 becomes yang, a 9 yin. A line cast 6 or 9 moves, 7 or 8 rests,
// and the bases carry the same four values: A Old Yin 6, T Old Yang 9 (the moving bases), C Young Yin 8, G Young Yang 7 (the resting).
// Under the matrix you choose the hexagram is a generation cell: its lower trigram's pair under its upper trigram's, the positive
// codon (a·c·d) and the negative (a·b·d), one codon when the cell is non-dual.
//
// Owners. The readings are Quaternal Logic's oracle journey (crates/ql-mef/src/nara/domain/oracle_journey.rs,
// `ql.nara-oracle-journey/v1`, reached by `ql epi-agent invoke nara.journey.*`); no caller in the shell reaches it yet, so the
// spread is the entry's and `reason` names the absence. The value keys follow its shapes:
//   deck          'tarot' | 'iching'                spread  'sphere' | 'torus-day' | 'klein-night' (the owner's spread ids)
//   draw          'random' | 'hand' (the owner's `draw`, or `assign-symbol` by hand)
//   theme         the concern (`set-target-aspect`)   journey  the open journey's name
//   placements    [{position: 'P0'..'P5' | "P0'".."P5'", name, codons: [n], reversed}] — a Placement with its CardIdentity
//   iching        {lines: six of 6..9 from the bottom, nuclear} — an IChingReading
//   m3.card       the card of the codon now, from the M3 state (`ql.m3-state/v1` `tarot`, through the kernel op m3_reception)
//   matrix        'complementary' | 'moving-resting' | 'same-quality': the matrix whose generation cell shows, for the I Ching
//   generation    {hexagram, lower, upper, positive, negative, nonDual} — the kernel's cell (ql_m3_generate) of the primary hexagram
// Pairs, Lemniscate and Moving lines show or open parts of the reading; Agent reads is how an agent's reading arrives.
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const DECKS = [{value: 'tarot', label: 'Tarot', does: 'A spread of cards.'}, {value: 'iching', label: 'I Ching', does: 'A hexagram and its lines.'}] as const
const SPREADS = [{value: 'sphere', label: 'Sphere', does: 'Two cards: a quick bearing.'}, {value: 'torus-day', label: 'Torus', does: 'Six cards, one for each position: the day reading.'},
  {value: 'klein-night', label: 'Klein', does: 'Six day cards and six night cards: the night is the shadow of the day.'}] as const
const DRAWS = [{value: 'random', label: 'Random', does: 'The cards or the lines come at random.'}, {value: 'hand', label: 'By hand', does: 'You pick each card or line.'}] as const
const AGENT = [{value: 'off', label: 'Off', does: 'The agent does not read.'}, {value: 'propose', label: 'Propose', does: 'Each reading the agent makes waits for you to accept it.'},
  {value: 'write', label: 'Write', does: 'The agent\'s readings go in directly, each with a receipt.'}] as const
const MATRICES = [{value: 'complementary', label: 'Complementary', does: 'Complementary: A with T, C with G.'}, {value: 'moving-resting', label: 'Moving and resting', does: 'Moving and resting: A with G, T with C.'},
  {value: 'same-quality', label: 'Same quality', does: 'Same quality: A with C, T with G.'}] as const
/** The coin values the bases carry, as the lines do (M3-COIN-1). */
const COIN: Record<string, number> = {A: 6, T: 9, C: 8, G: 7}
const QUESTION = ['Why', 'What', 'How', 'Who', 'Where', 'Why for']
/** Where a position stands: the day row P0 P1 P2 over P5 P4 P3, so each pair stands in one column. */
const COLUMN = [0, 1, 2, 2, 1, 0], ROW = [0, 0, 0, 1, 1, 1]
const SIZE: Record<string, number> = {sphere: 2, 'torus-day': 6, 'klein-night': 12}
const f1 = (x: number) => x.toFixed(1)

interface Placement {readonly position: string; readonly name: string; readonly codons: readonly number[]; readonly reversed: boolean}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function placementsOf(v: V): Placement[] | undefined {
  const raw = json<unknown>(v, 'placements', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Placement[] => rec(e) && typeof e.position === 'string' && /^P[0-5]'?$/.test(e.position) && typeof e.name === 'string'
    ? [{position: e.position, name: e.name, codons: Array.isArray(e.codons) ? e.codons.filter((c): c is number => Number.isInteger(c)) : [], reversed: e.reversed === true}] : [])
}
function ichingOf(v: V): {lines: number[]; nuclear?: number} | undefined {
  const raw = json<unknown>(v, 'iching', undefined)
  if (!rec(raw) || !Array.isArray(raw.lines) || raw.lines.length !== 6 || !raw.lines.every(l => l === 6 || l === 7 || l === 8 || l === 9)) return undefined
  return {lines: raw.lines as number[], nuclear: Number.isInteger(raw.nuclear) ? raw.nuclear as number : undefined}
}
interface Cell {readonly hexagram?: number; readonly lower: string; readonly upper: string; readonly positive: string; readonly negative: string; readonly nonDual: boolean}
function generationOf(v: V): Cell | undefined {
  const raw = json<unknown>(v, 'generation', undefined), pair = /^[ATCG]{2}$/, codon = /^[ATCG]{3}$/
  if (!rec(raw) || typeof raw.lower !== 'string' || !pair.test(raw.lower) || typeof raw.upper !== 'string' || !pair.test(raw.upper) || typeof raw.positive !== 'string' || !codon.test(raw.positive)
    || typeof raw.negative !== 'string' || !codon.test(raw.negative) || typeof raw.nonDual !== 'boolean') return undefined
  return {hexagram: Number.isInteger(raw.hexagram) ? raw.hexagram as number : undefined, lower: raw.lower, upper: raw.upper, positive: raw.positive, negative: raw.negative, nonDual: raw.nonDual}
}
/** A codon with its bases' values: "G7 G7 C8". */
const valued = (codon: string) => [...codon].map(b => `${b}${COIN[b]}`).join(' ')
/** The cell in the room it has. */
const cellWords = (c: Cell, big: boolean) => big
  ? `${c.lower} under ${c.upper}: ${c.nonDual ? `${valued(c.positive)}, non-dual` : `+ ${valued(c.positive)} · − ${valued(c.negative)}`}`
  : `${c.lower}/${c.upper} → ${c.nonDual ? `${c.positive}, one` : `${c.positive} · ${c.negative}`}`

/** The short rank of a card, for a small card. */
const SHORT: Record<string, string> = {Ace: 'A', Two: '2', Three: '3', Four: '4', Five: '5', Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10', Page: 'Pg', Knight: 'Kn', Queen: 'Q', King: 'K', Princess: 'Pr', Prince: 'Pc'}

/** A card's name in the room it has, as lines: "Five" over "of Cups" on a large card, "5" over "Cups" on a small one, "5C" on the smallest. */
const cardLines = (n: string, room: number): string[] => { const m = /^(\w+) of (\w+)$/.exec(n); if (!m) return [n]
  if (room >= 74) return [m[1]!, `of ${m[2]}`]
  const rank = SHORT[m[1]!] ?? m[1]!, suit = m[2] === 'Pentacles' ? 'Pent.' : m[2]!; return room >= 30 ? [rank, suit] : [`${rank}${m[2]![0]}`] }
/** Words in lines of at most `n` letters. */
const wrap = (text: string, n: number) => text.split(' ').reduce<string[]>((acc, w) => { const last = acc[acc.length - 1]; if (last !== undefined && (last + ' ' + w).length <= n) acc[acc.length - 1] = `${last} ${w}`; else acc.push(w); return acc }, [])

/** The spread: the day cards in their pairs (P0 over P5, P1 over P4, P2 over P3); on the Klein, the night block beside the day. Handle 1,
 * on a tarot spread, is the spread's size on the scale at the top: two, six or twelve. */
function Spread({p, w, h, handles, big}: {p: ViewProps; w: number; h: number; handles: boolean; big: boolean}) {
  const v = p.v, spread = strOf(v, 'spread'), n = spread ? SIZE[spread] ?? 6 : 6, cards = placementsOf(v), pairs = boolOf(v, 'pairs') !== false, night = n === 12
  const top = handles ? 18 : big ? 4 : 14, cols = night ? 6 : 3, block = night ? 8 : 0
  const gx = Math.max(3, w * .03), cw = Math.min((w - block - (cols + 1) * gx) / cols, (h - top - 6 - 3 * gx) / 2 / 1.4), ch = Math.min(cw * 1.4, (h - top - 6 - 3 * gx) / 2)
  const left = (w - block - cols * cw - (cols - 1) * gx) / 2
  const at = (pos: string) => { const i = Number(pos[1]), shade = pos.endsWith("'"); return {x: left + (COLUMN[i]! + (shade ? 3 : 0)) * (cw + gx) + (shade ? block : 0), y: top + gx + ROW[i]! * (ch + gx)} }
  const lit = (pos: string) => { const i = Number(pos[1]); return pos.endsWith("'") ? night : n === 2 ? i < 2 : true }
  const positions = [0, 1, 2, 3, 4, 5].flatMap(i => night ? [`P${i}`, `P${i}'`] : [`P${i}`])
  const sp = st(p, 'spread'), fs = big ? 12 : cw >= 30 ? 8.5 : 7.5
  const scale = {x0: 10, x1: Math.min(w * .55, 110), y: 8}, stop = (k: number) => scale.x0 + k * (scale.x1 - scale.x0) / 2, k = n === 2 ? 0 : n === 6 ? 1 : 2
  return <g>
    {pairs && [false, true].filter(sh => !sh || night).flatMap(sh => [0, 1, 2].map(c => { const a = at(`P${c}${sh ? "'" : ''}`), b = at(`P${5 - c}${sh ? "'" : ''}`)
      return <path key={`${c}${sh}`} d={`M${f1(a.x + cw / 2)} ${f1(a.y + ch)}V${f1(b.y)}`} className="dp-curve-on" strokeDasharray="2 2" opacity={.6} /> }))}
    {positions.map(pos => { const {x, y} = at(pos), card = cards?.find(c => c.position === pos), on = lit(pos), i = Number(pos[1])
      return <g key={pos} opacity={on ? 1 : .3}>
        {card && <rect x={x} y={y} width={cw} height={ch} rx={2} className="dp-fill" />}
        <rect x={x} y={y} width={cw} height={ch} rx={2} fill="none" stroke={card ? 'var(--dp-value)' : 'var(--dp-value-dim)'} strokeWidth={1} strokeDasharray={card ? undefined : '2 2'} />
        {ch >= 26 && <text x={x + 2.5} y={y + fs} className="dp-axis" style={{fontSize: fs * .85}}>{pos.replace("'", '′')}</text>}
        {big && <text x={x + cw - 3} y={y + fs} textAnchor="end" className="dp-axis" style={{fontSize: fs * .85}}>{QUESTION[i]}</text>}
        {card && <g transform={card.reversed ? `rotate(180 ${f1(x + cw / 2)} ${f1(y + ch / 2)})` : undefined}>
          {cardLines(card.name, cw).map((line, j, all) => <text key={j} x={x + cw / 2} y={y + ch / 2 + fs * .35 + (j - (all.length - 1) / 2) * fs * 1.15} textAnchor="middle"
            className={j ? 'dp-ink-dim' : 'dp-ink'} style={{fontSize: j ? fs * .85 : fs}}>{line}</text>)}
        </g>}
        {card && ch >= 34 && <text x={x + cw / 2} y={y + ch - 3} textAnchor="middle" className="dp-axis" style={{fontSize: fs * .8, fill: 'var(--dp-value)'}}>{card.codons.length ? `${big ? 'codon ' : ''}${card.codons.join('·')}` : NONE}</text>}
      </g> })}
    {night && <text x={at("P0'").x} y={top + 2} className="dp-axis" style={{fontSize: big ? 11 : 7.5}}>night</text>}
    {!cards && wrap(strOf(v, 'reason') ?? 'No reading', Math.floor(w / (big ? 7 : 5))).map((line, j, all) =>
      <text key={j} x={w / 2} y={top + (h - top) / 2 + (j - (all.length - 1) / 2) * (big ? 15 : 11)} textAnchor="middle" className="dp-ink-dim" style={{fontSize: big ? 12 : 9}}>{line}</text>)}
    {handles && spread !== undefined && <g>
      <path d={`M${f1(scale.x0)} ${scale.y}H${f1(scale.x1)}`} className="dp-faint" />
      {['2', '6', '12'].map((t, j) => <text key={t} x={stop(j)} y={scale.y + 3} textAnchor={j === 2 ? 'end' : j ? 'middle' : 'start'} className="dp-axis" dx={j === 2 ? -7 : j ? 0 : 7} style={{fontSize: 7}}>{j === k ? '' : t}</text>)}
      <Handle n={1} shape="square" x={stop(k)} y={scale.y} label="Spread" does={`Drag across: two, six or twelve cards.${sp.disabled ? ` ${sp.disabled}` : ''}`}
        onDrag={sp.disabled ? undefined : x => { const j = clampTo(0, 2, Math.round((x - scale.x0) / ((scale.x1 - scale.x0) / 2))); const next = (['sphere', 'torus-day', 'klein-night'] as const)[j]!; if (next !== spread) p.set('spread', next) }}
        onReset={sp.disabled ? undefined : () => p.set('spread', 'torus-day')} />
    </g>}
  </g>
}

/** The hexagram, its lines from the bottom, the moving lines marked, and the hexagram they turn into. Handle 1 shows or hides the move. */
function Hexagram({p, w, h, handles, big}: {p: ViewProps; w: number; h: number; handles: boolean; big: boolean}) {
  const v = p.v, ic = ichingOf(v), moving = boolOf(v, 'movingLines') !== false, ms = st(p, 'movingLines'), cell = generationOf(v)
  if (!ic) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading'}</text>
  const hw = Math.min(w * .32, h * .55), lh = (h - 40) / 6, x0 = w * .1 + (big ? 14 : 0), x1 = w - w * .1 - hw
  const draw = (x: number, lines: number[], marks: boolean) => lines.map((l, i) => { const y = h - 16 - (i + .5) * lh, yang = l === 7 || l === 9, move = l === 6 || l === 9
    return <g key={i}>
      {yang ? <rect x={x} y={y - lh * .18} width={hw} height={lh * .36} fill="var(--dp-value)" />
        : <><rect x={x} y={y - lh * .18} width={hw * .42} height={lh * .36} fill="var(--dp-value)" /><rect x={x + hw * .58} y={y - lh * .18} width={hw * .42} height={lh * .36} fill="var(--dp-value)" /></>}
      {marks && move && moving && <circle cx={x + hw + 7} cy={y} r={2.6} fill="var(--dp-on)" />}
      {marks && big && <text x={x - 8} y={y + 4} textAnchor="end" className={move ? 'dp-ink' : 'dp-axis'} style={{fontSize: 11}}>{l}</text>}
    </g> })
  const turned = ic.lines.map(l => (l === 6 ? 7 : l === 9 ? 8 : l))
  const anyMove = ic.lines.some(l => l === 6 || l === 9)
  return <g>
    <text x={x0} y={h - 3} className="dp-axis" style={{fontSize: big ? 11 : 8.5}}>primary</text>
    {draw(x0, ic.lines, true)}
    {moving && anyMove && <><text x={x1} y={h - 3} className="dp-axis" style={{fontSize: big ? 11 : 8.5}}>becomes</text>{draw(x1, turned, false)}
      <path d={`M${f1(x0 + hw + 14)} ${f1(h / 2)}L${f1(x1 - 6)} ${f1(h / 2)}`} className="dp-curve-on" /></>}
    {big && ic.nuclear !== undefined && <text x={w - 4} y={14} textAnchor="end" className="dp-ink-dim">nuclear hexagram {ic.nuclear}</text>}
    <text x={big ? x0 : 4} y={big ? 14 : 9} className={cell ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: big ? 12 : 8}}>{cell ? cellWords(cell, big) : big ? 'No generation cell from the kernel' : NONE}</text>
    {handles && anyMove && <Handle n={1} shape="square" x={moving ? x1 - 6 : x0 + hw + 14} y={h / 2} label="Moving lines"
      does={`Drag right to show the lines that change and what they become, left to hide them.${ms.disabled ? ` ${ms.disabled}` : ''}`}
      onDrag={ms.disabled ? undefined : x => { const show = x > (x0 + hw + x1) / 2; if (show !== moving) p.set('movingLines', show) }} onReset={ms.disabled ? undefined : () => p.set('movingLines', true)} />}
  </g>
}

const LIGHT_WHY = 'The Deck has no on or off. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const isTarot = (v: V) => strOf(v, 'deck') !== 'iching'
const Picture = (props: {p: ViewProps; w: number; h: number; handles: boolean; big: boolean}) => (isTarot(props.p.v) ? <Spread {...props} /> : <Hexagram {...props} />)
const corner = (v: V) => (isTarot(v) ? SPREADS.find(s => s.value === strOf(v, 'spread'))?.label ?? NONE : strOf(v, 'deck') ? 'I Ching' : NONE)
const DISPLAY_DOES = 'The reading: the six positions in their pairs, each card with its codon. An I Ching reading shows its lines, the moving ones marked.'

function controls(p: ViewProps) {
  const v = p.v, tarot = isTarot(v), why = tarot ? undefined : 'An I Ching reading has no spread.'
  return {
    deck: <Radio {...st(p, 'deck')} label="Deck" does="The kind of reading." value={strOf(v, 'deck') ?? ''} options={DECKS} stack onChange={x => p.set('deck', x)} />,
    spread: <Radio {...st(p, 'spread')} label="Spread" does="The size of the tarot spread." value={strOf(v, 'spread') ?? ''} options={SPREADS} stack onChange={x => p.set('spread', x)} disabled={st(p, 'spread').disabled ?? why} />,
    draw: <Radio {...st(p, 'draw')} label="Draw" does="How the cards or the lines come." value={strOf(v, 'draw') ?? ''} options={DRAWS} stack onChange={x => p.set('draw', x)} />,
    agent: <Radio {...st(p, 'agentReads')} label="Agent reads" does="How an agent's reading arrives." value={strOf(v, 'agentReads') ?? ''} options={AGENT} stack onChange={x => p.set('agentReads', x)} />,
    pairs: <Toggle {...st(p, 'pairs')} label="Pairs" does="Mark the pairs: P0 and P5, P1 and P4, P2 and P3." on={boolOf(v, 'pairs') !== false} onChange={x => p.set('pairs', x)} disabled={st(p, 'pairs').disabled ?? why} />,
    lemniscate: <Toggle {...st(p, 'lemniscate')} label="Lemniscate" does="Open the reading of position P4." on={boolOf(v, 'lemniscate') === true} onChange={x => p.set('lemniscate', x)} disabled={st(p, 'lemniscate').disabled ?? why} />,
    moving: <Toggle {...st(p, 'movingLines')} label="Moving lines" does="Mark the lines that change, and show what they become." on={boolOf(v, 'movingLines') !== false} onChange={x => p.set('movingLines', x)}
      disabled={st(p, 'movingLines').disabled ?? (tarot ? 'A tarot spread has no lines.' : undefined)} />,
    matrix: <Chooser {...st(p, 'matrix')} wide label="Matrix" does="For the I Ching, the matrix whose generation cell shows." value={strOf(v, 'matrix') ?? ''} options={MATRICES} onChange={x => p.set('matrix', x)}
      disabled={st(p, 'matrix').disabled ?? (tarot ? 'A tarot spread has no generation cell.' : undefined)} />,
    theme: <TextField {...st(p, 'theme')} wide label="Theme" does="The concern, in its deeper form." placeholder="the concern" value={strOf(v, 'theme') ?? ''} onChange={x => p.set('theme', x)} />,
    journey: <Chooser {...st(p, 'journey')} wide label="Journey" does="The journey that the reading joins." value={strOf(v, 'journey') ?? ''}
      options={strOf(v, 'journey') ? [{value: strOf(v, 'journey')!, label: strOf(v, 'journey')!}] : []} onChange={x => p.set('journey', x)}
      disabled={st(p, 'journey').disabled ?? (strOf(v, 'journey') ? undefined : 'No journey is open.')} />,
  }
}

const day = (cards: [string, string, number[], boolean?][]) => JSON.stringify(cards.map(([position, name, codons, reversed]) => ({position, name, codons, reversed: reversed === true})))

export const design: DesignedDevice = {
  id: 'quaternal-logic:deck',
  title: 'Deck',
  kind: 'instrument',
  defaults: {
    deck: 'tarot', spread: 'torus-day', draw: 'random', theme: 'What the work asks of me now', pairs: true, lemniscate: false, movingLines: true, agentReads: 'propose', journey: 'October journey',
    // Cards as the owner names them, each with its codon (`ql kernel m3`, the M3 state's `tarot` for each address).
    placements: day([['P0', 'Five of Cups', [7]], ['P1', 'Ten of Wands', [17]], ['P2', 'Page of Pentacles', [40], true], ['P3', 'Six of Swords', [51]], ['P4', 'Two of Cups', [3]],
      ['P5', 'Three of Wands', [22]]]),
    iching: JSON.stringify({lines: [7, 8, 9, 7, 6, 8], nuclear: 32}),
    // ql_m3_generate on main (61c0e16): the lines above are hexagram 13, Li under Zhen.
    matrix: 'complementary', generation: JSON.stringify({hexagram: 13, lower: 'GG', upper: 'GC', positive: 'GGC', negative: 'GGC', nonDual: true}),
    'm3.card': 'Five of Cups',
  },
  fixtures: {
    'A day reading': {},
    'Klein, with the night': {spread: 'klein-night', placements: day([['P0', 'Five of Cups', [7]], ['P1', 'Ten of Wands', [17]], ['P2', 'Page of Pentacles', [40], true], ['P3', 'Six of Swords', [51]],
      ['P4', 'Two of Cups', [3]], ['P5', 'Three of Wands', [22]], ["P0'", 'Three of Swords', [62]], ["P1'", 'Six of Cups', [12]], ["P2'", 'King of Pentacles', [33, 36]], ["P3'", 'Seven of Pentacles', [45]],
      ["P4'", 'Eight of Swords', [58], true], ["P5'", 'Queen of Wands', [27, 30]]])},
    'An I Ching reading': {deck: 'iching'},
    'I Ching, moving and resting': {deck: 'iching', matrix: 'moving-resting', generation: JSON.stringify({hexagram: 13, lower: 'GG', upper: 'CT', positive: 'GCT', negative: 'GGT', nonDual: false})},
    'As the shell has it': {placements: undefined, iching: undefined, generation: undefined, theme: undefined, journey: undefined, reason: 'No journey owner reaches the shell'},
  },

  folded: p => <Folded title="Deck" light="unknown" readings={[DECKS.find(d => d.value === strOf(p.v, 'deck'))?.label ?? NONE, corner(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Deck" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The reading" does={`${DISPLAY_DOES} Drag handle 1.`} corner={corner(p.v)}><Picture p={p} w={140} h={146} handles big={false} /></Display>
      </Section>
      <Section label="Macros" cols={2} width={140}>{c.deck}{c.spread}{c.draw}{c.agent}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 560, 380)) : 186
    return <Panel title="Deck" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The reading" does={`${DISPLAY_DOES} Drag handle 1.`} corner={corner(p.v)}><Picture p={p} w={w} h={146} handles big={false} /></Display>
        </Section>
        <Section label="Reading" width={76}>{c.deck}{c.spread}</Section>
        <Section label="Show" grow>{c.pairs}{c.lemniscate}{c.moving}{c.matrix}</Section>
      </Band>
      <Band>
        <Section label="Concern" width={170}>{c.theme}{c.journey}
          <Readout label="codon now" does="The card of the codon the M3 clock stands on now." value={strOf(p.v, 'm3.card')} tone="value" />
        </Section>
        <Section label="Draw" width={76}>{c.draw}</Section>
        <Section label="Agent" grow>{c.agent}</Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The reading">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <text x={20} y={24} className="dp-ink" style={{fontSize: 14}}>{strOf(p.v, 'theme') ?? NONE}</text>
        <text x={740} y={24} textAnchor="end" className="dp-ink-dim">{strOf(p.v, 'journey') ?? NONE}</text>
        <g transform="translate(60 36)"><Picture p={{...p, set: () => {}}} w={640} h={372} handles={false} big /></g>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Deck" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={150} h={100} label="The last reading" does="The last reading. Press ▦ to open the Deck in the pane that has focus."><Picture p={p} w={150} h={100} handles={false} big={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="theme" value={strOf(p.v, 'theme') ? (strOf(p.v, 'theme')!.length > 16 ? `${strOf(p.v, 'theme')!.slice(0, 15)}…` : strOf(p.v, 'theme')) : undefined} />
      <Readout label="spread" value={corner(p.v)} tone="value" />
    </div>
  </Tile>,
}
