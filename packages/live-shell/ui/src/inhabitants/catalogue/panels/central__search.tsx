// Search (manual §18.11): Central's "@" language. A query is read by the one operative grammar of AIKit (aikit-core resource/operative.rs:
// lex, parse, render): `@` and `@0`–`@5` address a horizon, `@# - +` are prefixes, `x`, `/` and `=` join two terms, `( )` frame, `: project`
// scopes, and plain text lowers to `@# @ text` (parse_or_search_expression). Input that does not parse is refused by the owner's CLI
// (`aikit knowledge search -- '( + @0 a + @4 b )'` answers "operative Resolve frame is not closed"). The evaluator keeps a hit only when its kind belongs to the addressed horizon
// (horizons_for_kind, operative.rs:1063). So the picture is the six horizons as lanes, with each hit stacked in every lane its kind belongs
// to, the query's own horizons tinted, and the hits that a narrowing cut drawn as outlines. Live's nearest: Auto Filter, a filter drawn
// across a scale with a handle on it. The fixture is real: the governance statements, the four agents of Control/self/agents, AIKit's
// skills, the projects, and a participant of the shared field (shared-field tests: participant:public:parasakti).
// Grounded in the cradle: the search line and results are desktop/cradle/src/knowledge/SearchOverlay.tsx; the kernel sends the full query
// to `aikit knowledge search|resolve --limit 50 -- <query>` (kernel/src/knowledge.rs:487). Tagging a passage, aliases, the kind filter
// and the limit as a setting have no code yet; the manual specifies them.
import {useState} from 'react'
import {KindMark, type KindShapeName} from '../../sdk/marks'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, Action, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {num, on, str, type DesignedDevice, type Values, type ViewProps} from './design'
import './central__search.css'

// ---------------------------------------------------------------- the grammar (a port of aikit-core resource/operative.rs)

type Horizon = 0 | 1 | 2 | 3 | 4 | 5
type Rel = '@#' | '-' | '+' | 'x' | '/' | '='
type Tok = {k: 'addr'; h: Horizon | null} | {k: 'rel'; op: Rel} | {k: 'scope'} | {k: 'lp'} | {k: 'rp'} | {k: 'atom'; v: string}
export type Node =
  | {n: 'subject'; v: string}
  | {n: 'address'; h: Horizon | null; e: Node}
  | {n: 'scope'; project: string; e: Node}
  | {n: 'unary'; op: Rel; e: Node}
  | {n: 'binary'; op: Rel; l: Node; r: Node}
  | {n: 'frame'; e: Node}

const WS = /\s/
const RELS: Record<string, Rel> = {'-': '-', '+': '+', x: 'x', '/': '/', '=': '='}

/** Operators are recognised only at expression boundaries: punctuation inside paths, refs and words stays literal. */
function lex(raw: string): Tok[] {
  const cs = Array.from(raw), out: Tok[] = []
  const before = (j: number) => j === 0 || WS.test(cs[j - 1]!) || cs[j - 1] === '(' || cs[j - 1] === ')'
  const after = (j: number) => j >= cs.length || WS.test(cs[j]!) || cs[j] === '(' || cs[j] === ')'
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (WS.test(ch)) { i++; continue }
    if (ch === '(') { out.push({k: 'lp'}); i++; continue }
    if (ch === ')') { out.push({k: 'rp'}); i++; continue }
    if (ch === '"' || ch === "'") {
      let v = '', closed = false
      i++
      while (i < cs.length) {
        const c = cs[i]!
        if (c === '\\') { i++; if (i >= cs.length) throw new Error('quoted Resolve subject ends with an escape'); v += cs[i]; i++ }
        else if (c === ch) { i++; closed = true; break }
        else { v += c; i++ }
      }
      if (!closed) throw new Error('quoted Resolve subject is not closed')
      out.push({k: 'atom', v})
      continue
    }
    if (ch === '@' && before(i)) {
      if (cs[i + 1] === '#' && after(i + 2)) { out.push({k: 'rel', op: '@#'}); i += 2; continue }
      const d = cs[i + 1]
      if (d !== undefined && d >= '0' && d <= '5' && after(i + 2)) { out.push({k: 'addr', h: Number(d) as Horizon}); i += 2; continue }
      if (after(i + 1)) { out.push({k: 'addr', h: null}); i++; continue }
    }
    if (ch === ':' && before(i) && after(i + 1) && (out.length === 0 || out[out.length - 1]!.k === 'lp')) { out.push({k: 'scope'}); i++; continue }
    if (before(i) && after(i + 1) && RELS[ch]) { out.push({k: 'rel', op: RELS[ch]!}); i++; continue }
    let v = ''
    while (i < cs.length && !WS.test(cs[i]!) && cs[i] !== '(' && cs[i] !== ')') {
      if (cs[i] === '\\') { i++; if (i >= cs.length) throw new Error('Resolve subject ends with an escape') }
      v += cs[i]; i++
    }
    if (v) out.push({k: 'atom', v})
  }
  return out
}

const subject = (v: string): Node => ({n: 'subject', v})
/** Plain text is the potential of a universal address: `@# @ text`. */
const ordinary = (v: string): Node => ({n: 'unary', op: '@#', e: {n: 'address', h: null, e: subject(v)}})

/** x binds tightest, then /, then =; `@#`, `-` and `+` are prefixes; `@N` and `: project` prefix a term. */
function parse(raw: string): Node {
  const toks = lex(raw)
  if (!toks.length) throw new Error('operative Resolve expression is empty')
  let at = 0
  const peek = () => toks[at]
  const isRel = (t: Tok | undefined, op: Rel) => t?.k === 'rel' && t.op === op
  const emptyBody = () => peek() === undefined || peek()!.k === 'rp'
  function primary(): Node {
    const t = toks[at++]
    if (t?.k === 'lp') {
      const e = expression()
      if (toks[at++]?.k !== 'rp') throw new Error('operative Resolve frame is not closed')
      return {n: 'frame', e}
    }
    if (t?.k === 'atom') {
      const parts = [t.v]
      while (peek()?.k === 'atom') parts.push((toks[at++] as {v: string}).v)
      return subject(parts.join(' '))
    }
    if (t?.k === 'rp') throw new Error("unexpected ')' in operative Resolve expression")
    if (t?.k === 'rel') throw new Error(`unexpected relation operator ${t.op}`)
    throw new Error('operative Resolve expression is missing a subject')
  }
  function unary(): Node {
    const t = peek()
    if (t?.k === 'scope') {
      at++
      const p = toks[at++]
      if (p?.k !== 'atom') throw new Error("operative Resolve scope ':' must name a project subject")
      return {n: 'scope', project: p.v, e: emptyBody() ? subject('') : unary()}
    }
    if (t?.k === 'addr') { at++; return {n: 'address', h: t.h, e: emptyBody() ? subject('') : unary()} }
    if (t?.k === 'rel' && (t.op === '@#' || t.op === '-' || t.op === '+')) { at++; return {n: 'unary', op: t.op, e: unary()} }
    return primary()
  }
  const join = (op: Rel, sub: () => Node) => () => {
    let l = sub()
    while (isRel(peek(), op)) { at++; l = {n: 'binary', op, l, r: sub()} }
    return l
  }
  const relate = join('x', unary), context = join('/', relate)
  function expression(): Node { return join('=', context)() }
  const e = expression()
  if (peek()) throw new Error('unexpected material after operative Resolve expression')
  return e
}

function hasSyntax(raw: string): boolean {
  try { return lex(raw).some(t => t.k !== 'atom') } catch { return true }
}
function parseOrSearch(raw: string): Node {
  const t = raw.trim()
  if (!t) return ordinary('')
  if (t.startsWith('"') || t.startsWith("'") || t.includes('\\')) {
    const e = parse(t)
    return e.n === 'subject' ? ordinary(e.v) : e
  }
  return hasSyntax(t) ? parse(t) : ordinary(t)
}

const RESERVED = new Set(['@', '@#', '@0', '@1', '@2', '@3', '@4', '@5', '-', '+', 'x', '/', '=', ':', '(', ')'])
const renderSubject = (v: string) => (!v || RESERVED.has(v) || WS.test(v) || v.startsWith('@') ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v)
const renderChild = (e: Node): string => (e.n === 'binary' ? `( ${render(e)} )` : render(e))
/** The expression as the owner writes it back (ResolveExpression::render). */
export function render(e: Node): string {
  switch (e.n) {
    case 'subject': return renderSubject(e.v)
    case 'address': return `${e.h === null ? '@' : `@${e.h}`} ${renderChild(e.e)}`
    case 'scope': return `: ${renderSubject(e.project)} ${renderChild(e.e)}`
    case 'unary': return `${e.op} ${renderChild(e.e)}`
    case 'binary': return `${renderChild(e.l)} ${e.op} ${renderChild(e.r)}`
    case 'frame': return `( ${render(e.e)} )`
  }
}

const horizonsIn = (e: Node, out = new Set<Horizon>()): Set<Horizon> => {
  if (e.n === 'address' && e.h !== null) out.add(e.h)
  if (e.n === 'binary') { horizonsIn(e.l, out); horizonsIn(e.r, out) } else if (e.n !== 'subject') horizonsIn(e.e, out)
  return out
}
/** The horizon that leads the expression, null when it addresses all. */
const lead = (e: Node): Horizon | null => (e.n === 'subject' ? null : e.n === 'address' ? e.h : e.n === 'binary' ? lead(e.l) : lead(e.e))

/** Set the leading horizon of a query as text: `@2 reading` from `reading`, `reading` from `@2 reading`. */
function aimQuery(q: string, h: Horizon | null): string {
  const m = /^\s*@([0-5])?(?=\s|$)\s*/.exec(q)
  const rest = m ? q.slice(m[0].length) : q
  return h === null ? rest : `@${h} ${rest}`
}

// ---------------------------------------------------------------- what is findable

type RKind = 'knowledge-source' | 'knowledge-node' | 'knowledge-frame' | 'agent' | 'project' | 'capability' | 'participant' | 'place'
type Group = 'person' | 'agent' | 'place' | 'document' | 'passage' | 'power'
interface Item {readonly id: string; readonly label: string; readonly ref: string; readonly says: string; readonly kind: RKind; readonly form?: 'method' | 'methodology'; readonly project: string; readonly owner: string}

const GROUPS: readonly {id: Group; name: string; shape: KindShapeName; verb: string; effect: string}[] = [
  {id: 'person', name: 'People', shape: 'occurrence', verb: 'message', effect: 'Sends a message with the passage.'},
  {id: 'agent', name: 'Agents', shape: 'agent', verb: 'starts', effect: 'Starts the agent on the passage, through Answer.'},
  {id: 'place', name: 'Places', shape: 'place', verb: 'files', effect: 'Files the passage on the place.'},
  {id: 'document', name: 'Documents', shape: 'doc', verb: 'adds', effect: 'Adds the passage, with a link back.'},
  {id: 'passage', name: 'Passages', shape: 'source', verb: 'opens', effect: 'Opens the passage.'},
  {id: 'power', name: 'Powers', shape: 'run', verb: 'opens', effect: 'Opens the skill or method.'},
]
const GROUP_OF: Record<RKind, Group> = {'knowledge-source': 'document', 'knowledge-node': 'document', 'knowledge-frame': 'passage', agent: 'agent', project: 'place', place: 'place', capability: 'power', participant: 'person'}
const G = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<Group, (typeof GROUPS)[number]>

const GOV = 'source:Control/agents/governance'
const CORPUS: readonly Item[] = [
  {id: 'doc-ground', label: 'Consult authored ground', ref: `${GOV}/attention/consult-authored-ground.md`, says: 'Read the authored ground before the code.', kind: 'knowledge-source', project: 'control', owner: 'Central'},
  {id: 'doc-gaps', label: 'Own the gaps', ref: `${GOV}/authorship-and-return/own-the-gaps.md`, says: 'A hole that you find is yours to fix.', kind: 'knowledge-source', project: 'control', owner: 'Central'},
  {id: 'doc-recognition', label: 'Recognition', ref: `${GOV}/authorship-and-return/recognition.md`, says: 'When returned reality needs the owner.', kind: 'knowledge-node', project: 'control', owner: 'Central'},
  {id: 'doc-completion', label: 'Completion', ref: `${GOV}/evidence/completion.md`, says: 'A claim of done needs executed evidence.', kind: 'knowledge-node', project: 'control', owner: 'Central'},
  {id: 'psg-completion', label: 'Completion · line 1', ref: `${GOV}/evidence/completion.md#1`, says: 'A completion claim without executed evidence is only tone.', kind: 'knowledge-frame', project: 'control', owner: 'Central'},
  {id: 'agent-cairn', label: 'Cairn', ref: 'agent:cairn', says: 'A patient interpreter.', kind: 'agent', project: 'control', owner: 'Central'},
  {id: 'agent-flint', label: 'Flint', ref: 'agent:flint', says: 'A grounded investigator.', kind: 'agent', project: 'control', owner: 'Central'},
  {id: 'agent-kite', label: 'Kite', ref: 'agent:kite', says: 'An exploratory maker.', kind: 'agent', project: 'control', owner: 'Central'},
  {id: 'agent-lilt', label: 'Lilt', ref: 'agent:lilt', says: 'An associative companion.', kind: 'agent', project: 'control', owner: 'Central'},
  {id: 'cap-orient', label: 'central-orient', ref: 'capability:central-orient', says: 'Orient a session and resume canonical work.', kind: 'capability', form: 'method', project: 'control', owner: 'AIKit'},
  {id: 'cap-ground', label: 'central-ground-keeping', ref: 'capability:central-ground-keeping', says: "The ground laws of Central's source model.", kind: 'capability', project: 'control', owner: 'AIKit'},
  {id: 'cap-wayfinder', label: 'wayfinder', ref: 'capability:wayfinder', says: 'Plan a huge chunk of work as a shared map.', kind: 'capability', form: 'methodology', project: 'control', owner: 'AIKit'},
  {id: 'prj-oi', label: 'O-I', ref: 'project:O-I', says: 'The O:I suite.', kind: 'project', project: 'O-I', owner: 'Central'},
  {id: 'prj-earth', label: 'Archetypal-Earth', ref: 'project:Archetypal-Earth', says: 'The field of places and archetypes.', kind: 'project', project: 'Archetypal-Earth', owner: 'Central'},
  {id: 'plc-bollingen', label: 'Bollingen', ref: 'place:bollingen', says: 'The tower and the stone of 1950.', kind: 'place', project: 'Archetypal-Earth', owner: 'Central'},
  {id: 'doc-stone', label: 'The Bollingen stone', ref: 'wiki:bollingen-stone', says: 'The Things page of the stone.', kind: 'knowledge-node', project: 'Archetypal-Earth', owner: 'Central'},
  {id: 'ppl-parasakti', label: 'parasakti', ref: 'participant:public:parasakti', says: 'A participant of the shared field.', kind: 'participant', project: 'control', owner: 'Shared field'},
]

/** The owner's horizon table (horizons_for_kind / horizons_for_resource). The resolver has no kind for a participant or a basemap place:
 * both read as world and context here. */
const HORIZONS: Record<RKind, readonly Horizon[]> = {
  'knowledge-source': [0], 'knowledge-node': [0, 2], 'knowledge-frame': [0, 2], agent: [2, 4, 5], project: [4], capability: [5], participant: [4], place: [4],
}
const horizonsOf = (it: Item): readonly Horizon[] => {
  const base = [...HORIZONS[it.kind]]
  if (it.form === 'method') base.push(2)
  if (it.form === 'methodology') base.push(3)
  return base.sort() as Horizon[]
}
/** AddressHorizon::meaning (operative.rs:44). */
const HORIZON_MEANING = ['ground, knowing, available knowledge', 'original, determining structure', 'reflection, meaning', 'language, form', 'world, context, story', 'power, techne, praxis']

// ---------------------------------------------------------------- the owner's evaluation, on that corpus

interface Hit {readonly item: Item; readonly score: number}

/** direct_handle_score and the all-terms fallback of text_score (operative.rs). */
function score(q: string, it: Item): number | null {
  if (!q) return 0
  const label = it.label.toLowerCase(), ref = it.ref.toLowerCase(), says = it.says.toLowerCase()
  const handle = (value: string) => (value === q ? 90000 : value.startsWith(q) ? 20000 - q.length : value.endsWith(q) ? 15000 - q.length : value.includes(q) ? 10000 - q.length : null)
  const direct = Math.max(handle(label) ?? -1, handle(ref) ?? -1)
  if (direct >= 0) return direct
  if (says.includes(q)) return 5000 - q.length
  const terms = q.split(/\s+/).filter(Boolean)
  return terms.length && terms.every(t => label.includes(t) || ref.includes(t) || says.includes(t)) ? 1000 - terms.length : null
}

function evaluate(e: Node, narrow: boolean): Hit[] {
  switch (e.n) {
    case 'subject': return CORPUS.flatMap(item => { const s = score(e.v.trim().toLowerCase(), item); return s === null ? [] : [{item, score: s}] })
    case 'address': { const hits = evaluate(e.e, narrow); return narrow && e.h !== null ? hits.filter(h => horizonsOf(h.item).includes(e.h as Horizon)) : hits }
    case 'scope': { const hits = evaluate(e.e, narrow); return narrow ? hits.filter(h => h.item.project.toLowerCase() === e.project.toLowerCase()) : hits }
    case 'unary': case 'frame': return evaluate(e.e, narrow)
    case 'binary': {
      const by = new Map<string, Hit>()
      for (const h of [...evaluate(e.l, narrow), ...evaluate(e.r, narrow)]) { const had = by.get(h.item.id); if (!had || had.score < h.score) by.set(h.item.id, h) }
      return [...by.values()]
    }
  }
}

// ---------------------------------------------------------------- the values and what they make

const DEFINE = /^@([A-Za-z][\w-]*)\s+=\s+(\S.*)$/
const ALIAS_KEY = 'alias:'
const aliasesOf = (v: Values) => Object.keys(v).filter(k => k.startsWith(ALIAS_KEY) && typeof v[k] === 'string').map(k => ({name: k.slice(ALIAS_KEY.length), search: String(v[k])}))

/** `@name` runs the alias; a `?` in it is a gap that the words after the name fill. */
function expandAlias(raw: string, v: Values): {text: string; alias?: string} {
  const m = /^\s*@([A-Za-z][\w-]*)(?:\s+(\S.*))?$/.exec(raw)
  const found = m && typeof v[ALIAS_KEY + m[1]] === 'string' ? String(v[ALIAS_KEY + m[1]]) : undefined
  if (!m || found === undefined) return {text: raw}
  return {text: m[2] ? found.replace('?', m[2]) : found, alias: m[1]}
}

const WORLDS: readonly Option<string>[] = [
  {value: 'control:root', label: 'Your world'}, {value: 'project:Archetypal-Earth', label: 'Archetypal-Earth'}, {value: 'project:O-I', label: 'O-I'},
  {value: 'project:face-rig', label: 'face-rig'}, {value: 'project:ai-kit', label: 'ai-kit'},
]
const FIELDS: readonly Option<'mine' | 'shared' | 'joined'>[] = [
  {value: 'mine', label: 'Mine', does: 'Your own world only.'}, {value: 'shared', label: 'Shared', does: 'Your world and the shared field.'}, {value: 'joined', label: 'Joined', does: 'Your world, the shared field and the fields that you joined.'},
]
const ENTER: readonly Option<'send' | 'open'>[] = [
  {value: 'send', label: 'Send', does: 'With a passage selected, send it to the result.'}, {value: 'open', label: 'Open', does: 'Open the result and send nothing.'},
]

interface Reading {
  readonly raw: string
  readonly expr: Node
  readonly error?: string
  readonly alias?: string
  readonly defining?: string
  readonly hits: readonly Hit[]
  readonly ghosts: readonly Hit[]
  readonly aimed: ReadonlySet<Horizon>
  readonly lead: Horizon | null
}

function read(v: Values): Reading {
  const raw = str(v, 'query'), def = DEFINE.exec(raw.trim()), ex = expandAlias(raw, v)
  let expr: Node, error: string | undefined
  try { expr = parseOrSearch(ex.text) } catch (e) { error = e instanceof Error ? e.message : String(e); expr = ordinary(ex.text.trim()) }
  const empty = !raw.trim() || !!def || !!error
  const world = str(v, 'reach'), fields = str(v, 'fields')
  const kept = (it: Item) => on(v, `k:${GROUP_OF[it.kind]}`)
    && (world === 'control:root' || world === `project:${it.project}`)
    && (it.owner !== 'Shared field' || fields !== 'mine')
  const sorted = empty ? [] : evaluate(expr, true).filter(h => kept(h.item)).sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
  const hits = sorted.slice(0, num(v, 'limit'))
  const ghosts = empty ? [] : evaluate(expr, false).filter(h => !hits.some(x => x.item.id === h.item.id))
  return {raw, expr, error, alias: ex.alias, defining: def?.[1], hits, ghosts, aimed: horizonsIn(expr), lead: lead(expr)}
}

const light = (v: Values) => str(v, 'light') as LightState
const commit = (p: ViewProps) => (text: string) => {
  const m = DEFINE.exec(text.trim())
  if (m) { p.set(`${ALIAS_KEY}${m[1]}`, m[2]!); p.set('query', `@${m[1]}`) } else p.set('query', text)
}
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const horizonNote = (it: Item) => horizonsOf(it).map(h => `@${h}`).join(' ')
const found = (r: Reading) => (r.defining ? 'keeps' : r.raw.trim() ? `${r.hits.length} found` : 'no query')

function rowsOf(r: Reading): RowItem[] {
  return r.hits.map(h => ({id: h.item.id, name: h.item.label, light: 'lit' as LightState, tone: 'value' as const, note: horizonNote(h.item),
    mark: <KindMark kind={G[GROUP_OF[h.item.kind]].shape} size={14} title={G[GROUP_OF[h.item.kind]].name} />,
    does: `${G[GROUP_OF[h.item.kind]].name} · ${h.item.owner}. ${h.item.says}`}))
}

// ---------------------------------------------------------------- the display: six horizons as lanes

function Lanes({r, p, w, h, compact}: {r: Reading; p: ViewProps; w: number; h: number; compact: boolean}) {
  const pad = 14, step = (w - 2 * pad) / 6, x = (stop: number) => pad + stop * step, top = 24, base = h - 40, axis = h - 24
  const stack = new Array<number>(6).fill(0)
  const place = (hit: Hit) => horizonsOf(hit.item).map(hz => ({hz, i: stack[hz]!++}))
  const real = r.hits.flatMap(hit => place(hit).map(c => ({...c, id: hit.item.id})))
  const ghost = r.ghosts.flatMap(hit => place(hit).map(c => ({...c, id: hit.item.id})))
  const aim = (stop: number) => p.set('query', aimQuery(str(p.v, 'query'), stop <= 0 ? null : (stop - 1) as Horizon))
  const stop = r.lead === null ? 0 : r.lead + 1
  const message = r.error ? '' : !r.raw.trim() ? 'Type @ and a word.' : r.defining ? `Enter keeps @${r.defining}.` : !r.hits.length ? 'No result in reach.' : ''
  return <g>
    {Array.from(r.aimed).map(hz => <rect key={hz} x={x(hz + 1) - 9} y={top - 4} width={18} height={base - top + 8} fill="rgba(92,200,189,.10)" />)}
    <text x={4} y={11} style={{font: '8.5px var(--font-ui)', fill: 'var(--text-dim)'}}>{r.error ? 'does not parse' : trunc(render(r.expr), compact ? 17 : 22)}</text>
    {[0, 1, 2, 3, 4, 5, 6].map(s => <line key={s} x1={x(s)} y1={top} x2={x(s)} y2={axis} className="dp-faint" />)}
    <line x1={x(0)} y1={axis} x2={x(6)} y2={axis} stroke="var(--dp-value)" strokeOpacity={0.5} />
    {ghost.map(c => <rect key={`g${c.id}${c.hz}`} x={x(c.hz + 1) - 6} y={base - (c.i + 1) * 8} width={12} height={6} fill="none" stroke="var(--text-faint)" strokeDasharray="2 2" />)}
    {real.map(c => <rect key={`r${c.id}${c.hz}`} x={x(c.hz + 1) - 6} y={base - (c.i + 1) * 8} width={12} height={6} fill="var(--dp-value)" />)}
    {['@', '0', '1', '2', '3', '4', '5'].map((t, s) => <text key={t} x={x(s)} y={h - 6} textAnchor="middle" className="dp-axis">{t}</text>)}
    {message && <text x={w / 2} y={top + (base - top) / 2} textAnchor="middle" className="dp-axis">{message}</text>}
    {r.error && <text x={w / 2} y={top + (base - top) / 2} textAnchor="middle" style={{font: '8.5px var(--font-ui)', fill: 'var(--stall)'}}>{trunc(r.error.replace('operative Resolve ', ''), compact ? 26 : 34)}</text>}
    <Handle x={x(stop)} y={axis} n={1} shape="ring" label="Aim"
      does="Drag along the line to put a horizon, @0 to @5, in front of the search. Drag to the left end to search all horizons."
      onDrag={(px) => aim(Math.round(Math.min(6, Math.max(0, (px - pad) / step))))} onReset={() => aim(0)} />
  </g>
}

function Well({r, p, w, h, compact}: {r: Reading; p: ViewProps; w: number; h: number; compact: boolean}) {
  return <Display w={w} h={h} label="Horizons" corner={found(r)}
    does="The six horizons. Each result stands in every horizon its kind belongs to. An outline is a result that the horizon, reach or kinds cut.">
    <Lanes r={r} p={p} w={w} h={h} compact={compact} />
  </Display>
}

// ---------------------------------------------------------------- controls shared by the views

const QueryLine = ({p, label}: {p: ViewProps; label?: string}) =>
  <div className="srch-span"><TextField wide label={label} does="Type @ and a word. Press Enter to search. Type @name = search to keep an alias." placeholder="@ a word" value={str(p.v, 'query')} onChange={commit(p)} /></div>

const ReachChooser = ({p}: {p: ViewProps}) =>
  <Chooser wide label="Reach" does="The world a search looks in: your whole world, or one project." value={str(p.v, 'reach')} options={WORLDS} onChange={x => p.set('reach', x)} />
const ShownDial = ({p}: {p: ViewProps}) =>
  <Dial label="Shown" does="The most results that a search returns." value={num(p.v, 'limit')} def={50} scale={{min: 10, max: 100, step: 10}} format={x => `${x}`} onChange={x => p.set('limit', x)} />
const EnterRadio = ({p}: {p: ViewProps}) =>
  <Radio label="Enter" does="What Enter does when a passage is selected." value={str(p.v, 'enter') as 'send' | 'open'} options={ENTER} stack onChange={x => p.set('enter', x)} />

function AliasRows({p, size, columns}: {p: ViewProps; size: number; columns: 1 | 2}) {
  const list = aliasesOf(p.v)
  if (!list.length) return <><Rows label="Aliases · 0" does="Your own short names for long searches." items={[]} size={size} columns={columns} /><p className="srch-none">No aliases</p></>
  const items: RowItem[] = list.map(a => ({id: a.name, name: `@${a.name}`, light: 'lit', tone: 'value', request: true, note: trunc(a.search, 24), does: a.search}))
  return <Rows label={`Aliases · ${list.length}`} does="Your own short names for long searches. Turn a square off to remove an alias." items={items}
    onRequest={(id, keep) => { if (!keep) p.set(`${ALIAS_KEY}${id}`, undefined) }} size={size} columns={columns} />
}

// ---------------------------------------------------------------- the whole view

const PAGES = [{id: 'find', label: 'Find'}, {id: 'keep', label: 'Keep'}] as const

function SearchWhole({p}: {p: ViewProps}) {
  const [at, setAt] = useState(0)
  const r = read(p.v)
  const aimed = r.lead === null ? 'all' : `@${r.lead}`
  return <Panel title="Search" view="whole" light={light(p.v)} pages={PAGES} page={p.page} onPage={p.setPage} onFold={p.nav.fold} onFull={p.nav.full}>
    {p.page === 'keep' ? <>
      <Band>
        <Section label="Reach" width={124}>
          <ReachChooser p={p} />
          <Radio label="Fields" does="Which fields a search looks in beside your world." value={str(p.v, 'fields') as 'mine' | 'shared' | 'joined'} options={FIELDS} stack onChange={x => p.set('fields', x)} />
        </Section>
        <Section label="Kinds" cols={2}>
          {GROUPS.map(g => <Toggle key={g.id} label={g.name} does={`Show ${g.name.toLowerCase()} in the results.`} on={on(p.v, `k:${g.id}`)} onChange={x => p.set(`k:${g.id}`, x)} />)}
        </Section>
        <Section label="Results" cols={2}>
          <ShownDial p={p} />
          <EnterRadio p={p} />
        </Section>
      </Band>
      <Band>
        <Section label="Aliases" grow>
          <div className="srch-keep">
            <AliasRows p={p} size={8} columns={2} />
            <TextField wide label="New alias" does="Type @name = search and press Enter. Use ? for a gap that the next word fills." placeholder="@name = search" value="" onChange={commit(p)} />
          </div>
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={164}><Well r={r} p={p} w={152} h={146} compact={false} /></Section>
        <Section label="Query" grow>
         <div className="srch-grid4">
          <QueryLine p={p} />
          <Readout big label="found" does="Results that the search returns." value={r.hits.length} tone="value" />
          <Readout label="aimed" does={r.lead === null ? 'The search looks in all horizons.' : `@${r.lead}: ${HORIZON_MEANING[r.lead]}.`} value={aimed} />
          <Readout label="shown" does="The most results that a search returns." value={num(p.v, 'limit')} />
          <Readout label={r.alias && !r.error ? 'alias' : 'owner'} does={r.error ? `The owner refuses the search: ${r.error}.` : 'The owner parsed the search.'} value={r.error ? 'refused' : r.alias ? `@${r.alias}` : 'parsed'} tone={r.error ? 'stall' : undefined} />
         </div>
        </Section>
      </Band>
      <Band>
        <Section grow><Rows label={`Results · ${r.hits.length}`} does="The square is not used here. The mark is the kind, the note is the horizons that the kind belongs to." items={rowsOf(r)} size={10} columns={2} page={at} onPage={setAt} /></Section>
      </Band>
    </>}
  </Panel>
}

// ---------------------------------------------------------------- the pane

function SearchFull({p}: {p: ViewProps}) {
  const r = read(p.v)
  const picked = r.hits.find(h => h.item.id === str(p.v, 'pick')) ?? r.hits[0]
  const gid = picked ? GROUP_OF[picked.item.kind] : undefined
  const size = str(p.v, 'selection').length
  const sends = picked && str(p.v, 'enter') === 'send' && gid && (gid === 'person' || gid === 'agent' || gid === 'place' || gid === 'document')
  return <div className="ref-pane-body srch-full">
    <div className="srch-full-line"><QueryLine p={p} /></div>
    <div className="srch-read">
      <span>Read as <code>{render(r.expr)}</code></span>
      <span><b>{r.hits.length}</b> found</span>
      {r.alias && <span>alias <b>@{r.alias}</b></span>}
      {r.error && <span data-bad="true">The owner refuses it: {r.error}.</span>}
    </div>
    <div className="srch-full-body">
      <div className="srch-groups">
        {!r.hits.length && <p className="srch-empty">{r.error ? 'Change the search so that it parses.' : r.raw.trim() ? 'No result in reach.' : 'Type @ and a word.'}</p>}
        {GROUPS.filter(g => r.hits.some(h => GROUP_OF[h.item.kind] === g.id)).map(g => <section key={g.id} className="srch-group">
          <h4><KindMark kind={g.shape} size={16} /> {g.name} <small>{r.hits.filter(h => GROUP_OF[h.item.kind] === g.id).length}</small></h4>
          <ul>{r.hits.filter(h => GROUP_OF[h.item.kind] === g.id).map(h => <li key={h.item.id}>
            <button type="button" className="srch-hit" aria-pressed={picked?.item.id === h.item.id} onClick={() => p.set('pick', h.item.id)}
              data-i={`${h.item.label}|${h.item.owner}. ${h.item.says}`}>
              <KindMark kind={g.shape} size={12} />
              <span className="srch-hit-name">{h.item.label}</span>
              <span className="srch-hit-note">{horizonNote(h.item)} · {g.verb}</span>
            </button>
          </li>)}</ul>
        </section>)}
      </div>
      <aside className="srch-side">
        <h4>Selected passage</h4>
        <blockquote className="srch-quote">{str(p.v, 'selection')}</blockquote>
        <p className="srch-from">from {str(p.v, 'from')} · {size} characters</p>
        <h4>Where a tag would send it</h4>
        <ul className="srch-targets">{GROUPS.filter(g => g.id !== 'power').map(g => <li key={g.id} data-on={gid === g.id ? 'true' : undefined}><b>{g.name.replace(/s$/, '')}</b><span>{g.effect}</span></li>)}</ul>
        <p className="srch-send">{!picked ? 'Nothing to send.' : sends ? `Enter sends ${size} characters from ${str(p.v, 'from')} to ${picked.item.label}.` : `Enter opens ${picked.item.label}.`}</p>
      </aside>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:search',
  title: 'Search',
  kind: 'instrument',
  defaults: {
    light: 'lit', query: 'ground', reach: 'control:root', fields: 'mine', limit: 50, enter: 'send',
    'k:person': true, 'k:agent': true, 'k:place': true, 'k:document': true, 'k:passage': true, 'k:power': true,
    selection: 'A completion claim without executed evidence is only tone.', from: 'Completion', pick: 'agent-flint',
  },
  fixtures: {
    'Aimed at @2': {query: '@2 ground'},
    'Your aliases': {query: '@team', 'alias:team': '@ cairn / @ flint', 'alias:stone': ': Archetypal-Earth bollingen', 'alias:why': '@# ( ? x @1 ground )'},
    'Does not parse': {query: '( + @0 ground + @4 world )'},
  },
  firstPage: 'find',

  folded: p => {
    const r = read(p.v)
    return <Folded title="Search" light={light(p.v)} readings={[`@ ${trunc(str(p.v, 'query'), 10)}`, `${r.hits.length} found`]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const r = read(p.v)
    return <Panel title="Search" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}><Well r={r} p={p} w={140} h={146} compact /></Section>
      <Section cols={2}>
        <QueryLine p={p} label="Search" />
        <div className="srch-span"><ReachChooser p={p} /></div>
        <ShownDial p={p} />
        <EnterRadio p={p} />
      </Section>
    </Panel>
  },

  whole: p => <SearchWhole p={p} />,

  full: p => <SearchFull p={p} />,

  widget: p => {
    const r = read(p.v), list = aliasesOf(p.v).slice(0, 3)
    return <Tile title="Search" light={light(p.v)} span={2} onFull={p.nav.full}>
      <div className="srch-tile">
        <QueryLine p={p} />
        <Rows does="The last results of the search." items={rowsOf(r)} size={3} />
        <div className="srch-aliases">
          {list.length
            ? list.map(a => <Action key={a.name} label={`@${a.name}`} does={`Run ${a.search}`} onPress={() => p.set('query', `@${a.name}`)} />)
            : <Readout big label="found" value={r.hits.length} tone="value" />}
        </div>
      </div>
    </Tile>
  },
}
