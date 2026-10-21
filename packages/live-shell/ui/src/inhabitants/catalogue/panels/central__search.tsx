// Search (manual §18.4): Central's "@" language. A query is read by the one operative grammar of AIKit (aikit-core resource/operative.rs:
// lex, parse, render): `@` and `@0`–`@5` address a horizon, `@# - +` are prefixes, `x`, `/` and `=` join two terms, `( )` frame, `: project`
// scopes, and plain text lowers to `@# @ text` (parse_or_search_expression). Input that does not parse is refused by the owner's CLI
// (`aikit knowledge search -- '( + @0 a + @4 b )'` answers "operative Resolve frame is not closed"). The evaluator keeps a hit only when its kind belongs to the addressed horizon
// (horizons_for_kind, operative.rs:1063). So the picture is the six horizons as lanes, with each hit stacked in every lane its kind belongs
// to, the query's own horizons tinted, and the hits that a narrowing cut drawn as outlines. Live's nearest: Auto Filter, a filter drawn
// across a scale with a handle on it.
// The grammar above is this device's vocabulary and stays here. The material is the owner's, and it arrives on value keys: `query` (the
// search line), `results` (the hits that the owner returns: kind, horizon, ref, title, and optionally says, owner, project, form), `aliases`
// (the short names kept, as {name, search}) and `projects` (the projects that a search can reach), each a JSON string. The fixtures carry
// real material: the governance statements, the four agents of Control/self/agents, AIKit's skills, the projects, and a participant of the
// shared field (shared-field tests: participant:public:parasakti).
// Grounded in the cradle: the search line and results are desktop/cradle/src/knowledge/SearchOverlay.tsx; the kernel sends the full query
// to `aikit knowledge search|resolve --limit 50 -- <query>` (kernel/src/knowledge.rs:487). Tagging a passage, aliases, the kind filter
// and the limit as a setting have no code yet; the manual specifies them.
// The `vak:` kind reaches Quaternal Logic's Vāk registry, the source-locked language of the map (109 entries at one source revision).
// A `vak:` term names a coordinate, `vak:M0-3`: the registry finds an entry by its coordinate, never by its name. The located entry
// arrives among the `results` as kind `vak-entry` (`ql vak locate <ref>`: its name, its designation as `says`, owner Quaternal Logic).
// Opened, it stands in its neighbourhood: `vak.context` is `ql vak context <ref> <depth>` (`ql.vak-context/v1`), carried as {centre,
// depth, revision, entries: [[ref, name, symbol, source line]], relations: [[from, relation, into]]}, every entry a SOURCE row and
// every relation DERIVED from the coordinates' nesting. `vak.depth` (0..2, the owner's bound) is the depth asked. Both commands are
// CLI; no kernel op reaches them yet, and the binding owes the route. A `vak:` result carries no horizon unless the owner states one.
import {useState} from 'react'
import {KindMark, type KindShapeName} from '../../sdk/marks'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, Action, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
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


const scopesIn = (e: Node, out = new Set<string>()): Set<string> => {
  if (e.n === 'scope') out.add(e.project.toLowerCase())
  if (e.n === 'binary') { scopesIn(e.l, out); scopesIn(e.r, out) } else if (e.n !== 'subject') scopesIn(e.e, out)
  return out
}

// ---------------------------------------------------------------- what is findable (the owner returns it; the view draws it)

type Group = 'person' | 'agent' | 'place' | 'document' | 'passage' | 'power' | 'vak'
/** One result as the owner returns it: what it is (kind, and form for a skill), where it stands (horizon), what it is called and where
 * it lives (title, ref). `horizon` is one horizon or a list; where the owner gives none, the kind's own horizons stand. */
interface Hit {readonly ref: string; readonly title: string; readonly kind: string; readonly horizons: readonly Horizon[]; readonly says?: string; readonly owner?: string; readonly project?: string}

const GROUPS: readonly {id: Group; name: string; shape: KindShapeName; verb: string; effect: string}[] = [
  {id: 'person', name: 'People', shape: 'occurrence', verb: 'message', effect: 'Sends a message with the passage.'},
  {id: 'agent', name: 'Agents', shape: 'agent', verb: 'starts', effect: 'Starts the agent on the passage, through Answer.'},
  {id: 'place', name: 'Places', shape: 'place', verb: 'files', effect: 'Files the passage on the place.'},
  {id: 'document', name: 'Documents', shape: 'doc', verb: 'adds', effect: 'Adds the passage, with a link back.'},
  {id: 'passage', name: 'Passages', shape: 'source', verb: 'opens', effect: 'Opens the passage.'},
  {id: 'power', name: 'Powers', shape: 'run', verb: 'opens', effect: 'Opens the skill or method.'},
  {id: 'vak', name: 'Vāk', shape: 'archetype', verb: 'opens', effect: 'Opens the entry at its source line, among the entries round it.'},
]
/** The owner's kinds and the group each is shown in. A kind this table does not know is shown with the documents. */
const GROUP_OF = new Map<string, Group>([['knowledge-source', 'document'], ['knowledge-node', 'document'], ['knowledge-frame', 'passage'], ['agent', 'agent'], ['project', 'place'], ['place', 'place'], ['capability', 'power'], ['participant', 'person'], ['vak-entry', 'vak']])
const G = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<Group, (typeof GROUPS)[number]>
const groupOf = (h: Hit): Group => GROUP_OF.get(h.kind) ?? 'document'

/** The owner's horizon table (horizons_for_kind / horizons_for_resource). The resolver has no kind for a participant or a basemap place:
 * both read as world and context here. */
const HORIZONS = new Map<string, readonly Horizon[]>([['knowledge-source', [0]], ['knowledge-node', [0, 2]], ['knowledge-frame', [0, 2]], ['agent', [2, 4, 5]], ['project', [4]], ['capability', [5]], ['participant', [4]], ['place', [4]]])
const isHorizon = (x: unknown): x is Horizon => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 5
const horizonsFrom = (kind: string, form: unknown): Horizon[] => {
  const base = [...(HORIZONS.get(kind) ?? [])]
  if (form === 'method') base.push(2)
  if (form === 'methodology') base.push(3)
  return [...new Set(base)].sort((a, b) => a - b)
}
/** AddressHorizon::meaning (operative.rs:44). */
const HORIZON_MEANING = ['ground, knowing, available knowledge', 'original, determining structure', 'reflection, meaning', 'language, form', 'world, context, story', 'power, techne, praxis']

const textOf = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined)
function hitOf(x: unknown): Hit | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as Record<string, unknown>, ref = textOf(o.ref)
  if (ref === undefined) return undefined
  const kind = typeof o.kind === 'string' ? o.kind : ''
  const given = (Array.isArray(o.horizon) ? o.horizon : o.horizon === undefined ? [] : [o.horizon]).filter(isHorizon)
  return {ref, title: textOf(o.title) ?? ref, kind, horizons: given.length ? [...new Set(given)].sort((a, b) => a - b) : horizonsFrom(kind, o.form),
    says: textOf(o.says), owner: textOf(o.owner), project: textOf(o.project)}
}
/** The results the owner returned for the query, or undefined when it reports none. */
function hitsOf(v: Values): Hit[] | undefined {
  const raw = json<unknown>(v, 'results', undefined)
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  return raw.flatMap(x => { const h = hitOf(x); if (!h || seen.has(h.ref)) return []; seen.add(h.ref); return [h] })
}
const horizonNote = (h: Hit) => h.horizons.map(z => `@${z}`).join(' ')
const saysOf = (h: Hit) => `${h.owner ? `${h.owner}. ` : ''}${h.says ?? h.ref}`
const describe = (h: Hit) => `${G[groupOf(h)].name}${h.owner ? ` · ${h.owner}` : ''}. ${h.says ?? h.ref}`

// ---------------------------------------------------------------- the values and what they make

const DEFINE = /^@([A-Za-z][\w-]*)\s+=\s+(\S.*)$/
const ALIAS_NAME = /^[A-Za-z][\w-]*$/
interface Alias {readonly name: string; readonly search: string}
/** The aliases the owner keeps, or undefined when it reports none. */
function aliasesOf(v: Values): Alias[] | undefined {
  const raw = json<unknown>(v, 'aliases', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x): Alias[] => {
    const a = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    return typeof a.name === 'string' && ALIAS_NAME.test(a.name) && typeof a.search === 'string' ? [{name: a.name, search: a.search}] : []
  })
}
/** The projects a search can reach, or undefined when the owner reports none. */
function projectsOf(v: Values): string[] | undefined {
  const raw = json<unknown>(v, 'projects', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x): string[] => {
    const name = typeof x === 'string' ? x : x && typeof x === 'object' ? (x as Record<string, unknown>).name : undefined
    return typeof name === 'string' && name ? [name] : []
  })
}

/** `@name` runs the alias; a `?` in it is a gap that the words after the name fill. */
function expandAlias(raw: string, aliases: readonly Alias[] | undefined): {text: string; alias?: string} {
  const m = /^\s*@([A-Za-z][\w-]*)(?:\s+(\S.*))?$/.exec(raw)
  const found = m ? aliases?.find(a => a.name === m[1])?.search : undefined
  if (!m || found === undefined) return {text: raw}
  return {text: m[2] ? found.replace('?', m[2]) : found, alias: m[1]}
}

const ROOT = 'control:root'
/** Your world, then each project the owner reaches. The reach in force always stands in the list. */
function worldsOf(reach: string | undefined, projects: readonly string[] | undefined): Option<string>[] {
  const options: Option<string>[] = [{value: ROOT, label: 'Your world'}, ...(projects ?? []).map(name => ({value: `project:${name}`, label: name}))]
  if (reach?.startsWith('project:') && !options.some(o => o.value === reach)) options.push({value: reach, label: reach.slice('project:'.length)})
  return options
}
const FIELDS: readonly Option<'mine' | 'shared' | 'joined'>[] = [
  {value: 'mine', label: 'Mine', does: 'Your own world only.'}, {value: 'shared', label: 'Shared', does: 'Your world and the shared field.'}, {value: 'joined', label: 'Joined', does: 'Your world, the shared field and the fields that you joined.'},
]
const ENTER: readonly Option<'send' | 'open'>[] = [
  {value: 'send', label: 'Send', does: 'With a passage selected, send it to the result.'}, {value: 'open', label: 'Open', does: 'Open the result and send nothing.'},
]

interface Reading {
  /** The query as typed; undefined when the owner reports none. */
  readonly raw: string | undefined
  readonly expr: Node
  readonly error?: string
  readonly alias?: string
  readonly defining?: string
  /** What the search finds in reach; undefined when there is a search to answer and the owner reports no results. */
  readonly hits: readonly Hit[] | undefined
  /** Results that the horizon, reach or kinds cut. */
  readonly ghosts: readonly Hit[]
  readonly aimed: ReadonlySet<Horizon>
  readonly lead: Horizon | null
  /** The coordinate a `vak:` term names. */
  readonly vak?: string
}

function read(v: Values): Reading {
  const raw = strOf(v, 'query'), def = raw === undefined ? null : DEFINE.exec(raw.trim()), ex = raw === undefined ? {text: '', alias: undefined} : expandAlias(raw, aliasesOf(v))
  let expr: Node, error: string | undefined
  try { expr = parseOrSearch(ex.text) } catch (e) { error = e instanceof Error ? e.message : String(e); expr = ordinary(ex.text.trim()) }
  const owned = hitsOf(v), reach = strOf(v, 'reach'), fields = strOf(v, 'fields'), limit = numOf(v, 'limit'), aimed = horizonsIn(expr), scopes = scopesIn(expr)
  // The owner answers the text and has applied the query's own operators. What the view cuts on top is the horizon, the reach
  // and the kinds: the outlines in the well.
  const kept = (h: Hit) => (!aimed.size || h.horizons.some(z => aimed.has(z)))
    && (!scopes.size || h.project === undefined || scopes.has(h.project.toLowerCase()))
    && boolOf(v, `k:${groupOf(h)}`) !== false
    && (reach === undefined || reach === ROOT || h.project === undefined || reach === `project:${h.project}`)
    && !(fields === 'mine' && h.owner === 'Shared field')
  const asked = raw !== undefined && !!raw.trim() && !def && !error
  const cut = asked && owned ? owned.filter(kept) : []
  const hits = limit === undefined || !Number.isFinite(limit) ? cut : cut.slice(0, Math.max(0, limit))
  return {raw, expr, error, alias: ex.alias, defining: def?.[1], aimed, lead: lead(expr), vak: error ? undefined : VAK_TERM.exec(ex.text)?.[1],
    hits: raw === undefined || (asked && !owned) ? undefined : hits, ghosts: asked && owned ? owned.filter(h => !hits.includes(h)) : []}
}

// ---------------------------------------------------------------- a Vāk entry and the entries round it

/** A `vak:` term in the search: the coordinate it names. */
const VAK_TERM = /(?:^|\s)vak:(M0\S*)/
interface VakEntry {readonly ref: string; readonly name: string; readonly symbol: string; readonly line?: number}
interface VakContext {readonly centre: string; readonly depth: number; readonly revision?: string; readonly entries: readonly VakEntry[]; readonly relations: readonly (readonly [string, string, string])[]}
/** The neighbourhood the owner returned, or undefined when it reports none. */
function vakContextOf(v: Values): VakContext | undefined {
  const raw = json<unknown>(v, 'vak.context', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  if (typeof o.centre !== 'string' || !Array.isArray(o.entries)) return undefined
  const entries = o.entries.flatMap((e): VakEntry[] => (Array.isArray(e) && typeof e[0] === 'string' ? [{ref: e[0], name: textOf(e[1]) ?? e[0], symbol: textOf(e[2]) ?? '', line: typeof e[3] === 'number' ? e[3] : undefined}] : []))
  const relations = (Array.isArray(o.relations) ? o.relations : []).flatMap((r): (readonly [string, string, string])[] => (Array.isArray(r) && r.length === 3 && r.every(x => typeof x === 'string') ? [[r[0], r[1], r[2]] as const] : []))
  return {centre: o.centre, depth: typeof o.depth === 'number' ? o.depth : 0, revision: textOf(o.revision), entries, relations}
}
/** Each entry's distance in relations from the centre, up to the depth the owner answered. */
function hopsOf(c: VakContext): Map<string, number> {
  const hops = new Map<string, number>([[c.centre, 0]])
  for (let d = 1; d <= c.depth; d++) for (const [a, , b] of c.relations) {
    if (hops.get(a) === d - 1 && !hops.has(b)) hops.set(b, d)
    if (hops.get(b) === d - 1 && !hops.has(a)) hops.set(a, d)
  }
  return hops
}
const vakDepthWord = (v: Values) => { const d = numOf(v, 'vak.depth'); return d === undefined ? undefined : `${d}` }

/** The neighbourhood: the entry at the centre, the entries one relation away on the first ring (its parent at the top), two away on the
 * second, each by its symbol. Handle 1 is the depth: drag it out to the second ring, in to the centre. */
function VakRings({p, w, h, labels}: {p: ViewProps; w: number; h: number; labels: boolean}) {
  const c = vakContextOf(p.v), cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 12, rings = [0, R * .46, R * .92]
  const off = st(p, 'vak.depth').disabled, asked = numOf(p.v, 'vak.depth')
  const handle = asked !== undefined && <Handle n={1} shape="ring" x={cx + rings[Math.round(clampTo(0, 2, asked))]!} y={cy} label="Depth"
    does={`Drag out or in: how many relations from the entry the neighbourhood reaches, 0 to 2.${off ? ` ${off}` : ''}`}
    onDrag={off ? undefined : x => { const d = Math.round(clampTo(0, 2, (x - cx) / (R * .46))); if (d !== asked) p.set('vak.depth', d) }} onReset={off ? undefined : () => p.set('vak.depth', 1)} />
  if (!c) return <g><text x={cx} y={cy} textAnchor="middle" className="dp-axis">No reading of the entries round it.</text>{handle}</g>
  const hops = hopsOf(c), byRef = new Map(c.entries.map(e => [e.ref, e])), at = new Map<string, readonly [number, number]>([[c.centre, [cx, cy]]])
  const first = c.entries.filter(e => hops.get(e.ref) === 1), parents = new Set(c.relations.filter(r => r[0] === c.centre && r[1] === 'parent').map(r => r[2]))
  const ordered = [...first.filter(e => parents.has(e.ref)), ...first.filter(e => !parents.has(e.ref))]
  ordered.forEach((e, i) => { const a = (-90 + i * 360 / Math.max(1, ordered.length)) * Math.PI / 180; at.set(e.ref, [cx + rings[1]! * Math.cos(a), cy + rings[1]! * Math.sin(a)]) })
  // The second ring keeps each entry beside the entry it came through.
  const anchor = (ref: string) => c.relations.find(r => (r[0] === ref && hops.get(r[2]) === 1) || (r[2] === ref && hops.get(r[0]) === 1))
  const second = c.entries.filter(e => hops.get(e.ref) === 2).map(e => { const r = anchor(e.ref), via = r ? (r[0] === e.ref ? r[2] : r[0]) : c.centre, [x, y] = at.get(via) ?? [cx, cy]
    return {e, angle: Math.atan2(y - cy, x - cx)} }).sort((a, b) => a.angle - b.angle)
  second.forEach(({e}, i) => { const a = (-90 + (i + .5) * 360 / Math.max(1, second.length)) * Math.PI / 180; at.set(e.ref, [cx + rings[2]! * Math.cos(a), cy + rings[2]! * Math.sin(a)]) })
  const fs = labels ? 8 : 6.5
  return <g>
    {rings.slice(1).map((r, i) => <circle key={i} cx={cx} cy={cy} r={r} className="dp-faint" opacity={i + 1 <= c.depth ? .7 : .25} strokeDasharray={i + 1 <= c.depth ? undefined : '2 3'} />)}
    {c.relations.map(([a, rel, b], i) => { const p0 = at.get(a), p1 = at.get(b); if (!p0 || !p1) return null
      return <path key={i} d={`M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`} stroke={rel === 'parent' ? 'var(--dp-on)' : 'var(--dp-value-dim)'} strokeWidth={.7} opacity={.7} /> })}
    {[...at].map(([ref, [x, y]]) => { const e = byRef.get(ref), hop = hops.get(ref) ?? 0
      return <g key={ref}>
        <circle cx={x} cy={y} r={hop === 0 ? 5 : hop === 1 ? 3.2 : 1.8} fill={hop === 0 ? 'var(--dp-on)' : 'var(--dp-value)'} opacity={hop === 2 ? .7 : 1} />
        {(hop === 0 || (labels && hop === 1)) && e && <text x={x} y={y - (hop === 0 ? 8 : 5)} textAnchor="middle" className={hop === 0 ? 'dp-ink' : 'dp-axis'}
          style={{fontSize: hop === 0 ? fs + 1 : fs, paintOrder: 'stroke', stroke: '#121a20', strokeWidth: 3}}>{(e.symbol || e.ref.replace(/^M0-?/, '') || e.ref).slice(0, 7)}</text>}
      </g> })}
    {handle}
  </g>
}
const vakRows = (v: Values): RowItem[] | undefined => { const c = vakContextOf(v); if (!c) return undefined; const hops = hopsOf(c)
  return [...c.entries].sort((a, b) => (hops.get(a.ref) ?? 3) - (hops.get(b.ref) ?? 3)).map(e => ({id: e.ref, name: e.name, light: e.ref === c.centre ? 'lit' : 'dark', tone: 'value' as const,
    note: e.symbol.slice(0, 8), does: `${e.ref} · ${hops.get(e.ref) === 0 ? 'the entry' : `${hops.get(e.ref)} away`} · source line ${e.line ?? NONE}`}))}

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const commit = (p: ViewProps) => (text: string) => {
  const m = DEFINE.exec(text.trim())
  if (!m) { p.set('query', text); return }
  if (st(p, 'aliases').disabled) return
  p.set('aliases', JSON.stringify([...(aliasesOf(p.v) ?? []).filter(a => a.name !== m[1]), {name: m[1]!, search: m[2]!}]))
  p.set('query', `@${m[1]}`)
}
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const found = (r: Reading) => (r.raw === undefined ? NONE : r.defining ? 'keeps' : !r.raw.trim() ? 'no query' : r.hits === undefined ? NONE : `${r.hits.length} found`)
/** The well's words where there is nothing to draw: the missing reading named, or what to do. */
const said = (r: Reading) => r.raw === undefined ? 'No reading of the query.' : r.error ? '' : !r.raw.trim() ? 'Type @ and a word.' : r.defining ? `Enter keeps @${r.defining}.`
  : r.hits === undefined ? 'No reading of the results.' : !r.hits.length ? 'No result in reach.' : ''

function rowsOf(r: Reading): RowItem[] {
  return (r.hits ?? []).map(h => ({id: h.ref, name: h.title, light: 'lit' as LightState, tone: 'value' as const, note: horizonNote(h),
    mark: <KindMark kind={G[groupOf(h)].shape} size={14} title={G[groupOf(h)].name} />, does: describe(h)}))
}

// ---------------------------------------------------------------- the display: six horizons as lanes

function Lanes({r, p, w, h, compact}: {r: Reading; p: ViewProps; w: number; h: number; compact: boolean}) {
  const pad = 14, step = (w - 2 * pad) / 6, x = (stop: number) => pad + stop * step, top = 24, base = h - 40, axis = h - 24
  const stack = new Array<number>(6).fill(0)
  const place = (hit: Hit) => hit.horizons.map(hz => ({hz, i: stack[hz]!++}))
  const real = (r.hits ?? []).flatMap(hit => place(hit).map(c => ({...c, id: hit.ref})))
  const ghost = r.ghosts.flatMap(hit => place(hit).map(c => ({...c, id: hit.ref})))
  const aim = (stop: number) => p.set('query', aimQuery(strOf(p.v, 'query') ?? '', stop <= 0 ? null : (stop - 1) as Horizon))
  const stop = r.lead === null ? 0 : r.lead + 1
  const off = st(p, 'query').disabled
  const message = said(r)
  return <g>
    {Array.from(r.aimed).map(hz => <rect key={hz} x={x(hz + 1) - 9} y={top - 4} width={18} height={base - top + 8} fill="rgba(92,200,189,.10)" />)}
    <text x={4} y={11} style={{font: '8.5px var(--font-ui)', fill: 'var(--text-dim)'}}>{r.raw === undefined ? NONE : r.error ? 'does not parse' : trunc(render(r.expr), compact ? 17 : 22)}</text>
    {[0, 1, 2, 3, 4, 5, 6].map(s => <line key={s} x1={x(s)} y1={top} x2={x(s)} y2={axis} className="dp-faint" />)}
    <line x1={x(0)} y1={axis} x2={x(6)} y2={axis} stroke="var(--dp-value)" strokeOpacity={0.5} />
    {ghost.map(c => <rect key={`g${c.id}${c.hz}`} x={x(c.hz + 1) - 6} y={base - (c.i + 1) * 8} width={12} height={6} fill="none" stroke="var(--text-faint)" strokeDasharray="2 2" />)}
    {real.map(c => <rect key={`r${c.id}${c.hz}`} x={x(c.hz + 1) - 6} y={base - (c.i + 1) * 8} width={12} height={6} fill="var(--dp-value)" />)}
    {['@', '0', '1', '2', '3', '4', '5'].map((t, s) => <text key={t} x={x(s)} y={h - 6} textAnchor="middle" className="dp-axis">{t}</text>)}
    {message && <text x={w / 2} y={top + (base - top) / 2} textAnchor="middle" className="dp-axis">{message}</text>}
    {r.error && <text x={w / 2} y={top + (base - top) / 2} textAnchor="middle" style={{font: '8.5px var(--font-ui)', fill: 'var(--stall)'}}>{trunc(r.error.replace('operative Resolve ', ''), compact ? 26 : 34)}</text>}
    {r.raw !== undefined && <Handle x={x(stop)} y={axis} n={1} shape="ring" label="Aim"
      does={`Drag along the line to put a horizon, @0 to @5, in front of the search. Drag to the left end to search all horizons.${off ? ` ${off}` : ''}`}
      onDrag={off ? undefined : (px) => aim(Math.round(Math.min(6, Math.max(0, (px - pad) / step))))} onReset={off ? undefined : () => aim(0)} />}
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
  <div className="srch-span"><TextField {...st(p, 'query')} wide label={label} placeholder="@ a word" value={strOf(p.v, 'query') ?? ''} onChange={commit(p)}
    does={`Type @ and a word. Press Enter to search.${st(p, 'aliases').disabled ? '' : ' Type @name = search to keep an alias.'}`} /></div>

const ReachChooser = ({p}: {p: ViewProps}) => {
  const projects = projectsOf(p.v)
  return <Chooser {...st(p, 'reach')} wide label="Reach" does={`The world a search looks in: your whole world, or one project.${projects === undefined ? ' No reading of the projects.' : ''}`}
    value={strOf(p.v, 'reach') ?? ''} options={worldsOf(strOf(p.v, 'reach'), projects)} onChange={x => p.set('reach', x)} />
}
const ShownDial = ({p}: {p: ViewProps}) =>
  <Dial {...st(p, 'limit')} label="Shown" does="The most results that a search returns." value={numOf(p.v, 'limit') ?? NaN} def={50} scale={{min: 10, max: 100, step: 10}} format={x => `${x}`} onChange={x => p.set('limit', x)} />
const EnterRadio = ({p}: {p: ViewProps}) =>
  <Radio {...st(p, 'enter')} label="Enter" does="What Enter does when a passage is selected." value={(strOf(p.v, 'enter') ?? '') as 'send' | 'open'} options={ENTER} stack onChange={x => p.set('enter', x)} />

function AliasRows({p, size, columns}: {p: ViewProps; size: number; columns: 1 | 2}) {
  const list = aliasesOf(p.v), off = st(p, 'aliases').disabled
  if (list === undefined) return <><Rows label="Aliases · —" does="Your own short names for long searches." items={[]} size={size} columns={columns} /><p className="srch-none">No reading of the aliases</p></>
  if (!list.length) return <><Rows label="Aliases · 0" does="Your own short names for long searches." items={[]} size={size} columns={columns} /><p className="srch-none">No aliases</p></>
  const items: RowItem[] = list.map(a => ({id: a.name, name: `@${a.name}`, light: 'lit', tone: 'value', request: off ? undefined : true, note: trunc(a.search, 24), does: a.search}))
  return <Rows label={`Aliases · ${list.length}`} does={`Your own short names for long searches.${off ? ` ${off}` : ' Turn a square off to remove an alias.'}`} items={items}
    onRequest={off ? undefined : (id, keep) => { if (!keep) p.set('aliases', JSON.stringify(list.filter(a => a.name !== id))) }} size={size} columns={columns} />
}

// ---------------------------------------------------------------- the whole view

const PAGES = [{id: 'find', label: 'Find'}, {id: 'keep', label: 'Keep'}] as const

/** The Find page for a `vak:` term: the entry it locates, and the entries round it. */
function VakFind({p, r}: {p: ViewProps; r: Reading}) {
  const [at, setAt] = useState(0)
  const c = vakContextOf(p.v), centre = c?.entries.find(e => e.ref === c.centre), rows = vakRows(p.v)
  return <>
    <Band>
      <Section width={164}><Display w={152} h={146} label="Round the entry" corner={vakDepthWord(p.v) === undefined ? NONE : `depth ${vakDepthWord(p.v)}`}
        does="The entry the search locates at the centre, its parent at the top of the first ring, the entries one relation away on that ring and two away on the second.">
        <VakRings p={p} w={152} h={146} labels={false} /></Display></Section>
      <Section label="Query" grow>
        <div className="srch-grid4">
          <QueryLine p={p} />
          <Readout big label="round it" does="Entries in the neighbourhood, the entry among them." value={c?.entries.length} tone="value" />
          <Dial {...st(p, 'vak.depth')} label="Depth" does="How many relations from the entry the neighbourhood reaches. The registry reaches two at most." value={numOf(p.v, 'vak.depth') ?? NaN} def={1}
            scale={{min: 0, max: 2, step: 1}} format={x => `${x}`} onChange={x => p.set('vak.depth', x)} />
          <Readout label="symbol" does="The entry's symbol, as its source row gives it." value={centre?.symbol || (centre ? NONE : undefined)} />
          <Readout label={`line ${centre?.line ?? NONE}`} does="The entry's coordinate, locked to its line in the source. Press to copy the coordinate." value={r.vak} copy={r.vak} />
        </div>
      </Section>
    </Band>
    <Band>
      <Section grow>{rows === undefined
        ? <div className="srch-keep"><Rows label="Round it · —" does="The entries round the one the search located." items={[]} size={10} columns={2} /><p className="srch-none">No reading of the entries round it</p></div>
        : <Rows label={`Round it · ${rows.length}`} does="The entries round the one the search located, nearest first. The lit row is the entry; the note is each entry's symbol." items={rows} size={10} columns={2} page={at} onPage={setAt} />}</Section>
    </Band>
  </>
}

function SearchWhole({p}: {p: ViewProps}) {
  const [at, setAt] = useState(0)
  const r = read(p.v)
  const aimed = r.raw === undefined ? undefined : r.lead === null ? 'all' : `@${r.lead}`
  return <Panel title="Search" view="whole" light={light(p)} pages={PAGES} page={p.page} onPage={p.setPage} onFold={p.nav.fold} onFull={p.nav.full}>
    {p.page === 'keep' ? <>
      <Band>
        <Section label="Reach" width={124}>
          <ReachChooser p={p} />
          <Radio {...st(p, 'fields')} label="Fields" does="Which fields a search looks in beside your world." value={(strOf(p.v, 'fields') ?? '') as 'mine' | 'shared' | 'joined'} options={FIELDS} stack onChange={x => p.set('fields', x)} />
        </Section>
        <Section label="Kinds" cols={2}>
          {GROUPS.map(g => {
            const now = boolOf(p.v, `k:${g.id}`)
            return <Toggle {...st(p, `k:${g.id}`)} key={g.id} label={g.name} does={`Show ${g.name.toLowerCase()} in the results.`} on={now === true} unknown={now === undefined} onChange={x => p.set(`k:${g.id}`, x)} />
          })}
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
            <TextField {...st(p, 'aliases')} wide label="New alias" does="Type @name = search and press Enter. Use ? for a gap that the next word fills." placeholder="@name = search" value="" onChange={commit(p)} />
          </div>
        </Section>
      </Band>
    </> : r.vak !== undefined ? <VakFind p={p} r={r} /> : <>
      <Band>
        <Section width={164}><Well r={r} p={p} w={152} h={146} compact={false} /></Section>
        <Section label="Query" grow>
         <div className="srch-grid4">
          <QueryLine p={p} />
          <Readout big label="found" does="Results that the search returns." value={r.hits?.length} tone="value" />
          <Readout label="aimed" does={r.lead === null ? 'The search looks in all horizons.' : `@${r.lead}: ${HORIZON_MEANING[r.lead] ?? ''}.`} value={aimed} />
          <Readout label="shown" does="The most results that a search returns." value={numOf(p.v, 'limit')} />
          <Readout label={r.alias && !r.error ? 'alias' : 'owner'} does={r.error ? `The owner refuses the search: ${r.error}.` : 'The owner parsed the search.'}
            value={r.raw === undefined ? undefined : r.error ? 'refused' : r.alias ? `@${r.alias}` : r.hits === undefined ? undefined : 'parsed'} tone={r.error ? 'stall' : undefined} />
         </div>
        </Section>
      </Band>
      <Band>
        <Section grow>{r.hits === undefined
          ? <div className="srch-keep"><Rows label="Results · —" does="The results of the search." items={[]} size={10} columns={2} /><p className="srch-none">{r.raw === undefined ? 'No reading of the query' : 'No reading of the results'}</p></div>
          : <Rows label={`Results · ${r.hits.length}`} does="The square is not used here. The mark is the kind, the note is the horizons that the kind belongs to." items={rowsOf(r)} size={10} columns={2} page={at} onPage={setAt} />}</Section>
      </Band>
    </>}
  </Panel>
}

// ---------------------------------------------------------------- the pane

function SearchFull({p}: {p: ViewProps}) {
  const r = read(p.v), hits = r.hits ?? []
  const pick = strOf(p.v, 'pick'), picked = hits.find(h => h.ref === pick) ?? hits[0]
  const gid = picked ? groupOf(picked) : undefined
  const selection = strOf(p.v, 'selection'), from = strOf(p.v, 'from'), enter = strOf(p.v, 'enter'), size = selection?.length
  const pickOff = st(p, 'pick').disabled
  const canSend = gid === 'person' || gid === 'agent' || gid === 'place' || gid === 'document'
  const verdict = r.hits === undefined ? 'No reading of the results.' : !picked ? 'Nothing to send.' : enter === undefined ? 'No reading of what Enter does.'
    : enter === 'send' && canSend ? (selection === undefined ? 'No reading of the selection.' : `Enter sends ${size} characters from ${from ?? NONE} to ${picked.title}.`) : `Enter opens ${picked.title}.`
  return <div className="ref-pane-body srch-full">
    <div className="srch-full-line"><QueryLine p={p} /></div>
    <div className="srch-read">
      <span>{r.raw === undefined ? 'No reading of the query' : <>Read as <code>{render(r.expr)}</code></>}</span>
      <span><b>{r.hits?.length ?? NONE}</b> found</span>
      {r.alias && <span>alias <b>@{r.alias}</b></span>}
      {r.error && <span data-bad="true">The owner refuses it: {r.error}.</span>}
    </div>
    <div className="srch-full-body">
      <div className="srch-groups">
        {!hits.length && <p className="srch-empty">{r.raw === undefined ? 'No reading of the query.' : r.error ? 'Change the search so that it parses.' : !r.raw.trim() ? 'Type @ and a word.'
          : r.hits === undefined ? 'No reading of the results.' : 'No result in reach.'}</p>}
        {GROUPS.filter(g => hits.some(h => groupOf(h) === g.id)).map(g => <section key={g.id} className="srch-group">
          <h4><KindMark kind={g.shape} size={16} /> {g.name} <small>{hits.filter(h => groupOf(h) === g.id).length}</small></h4>
          <ul>{hits.filter(h => groupOf(h) === g.id).map(h => <li key={h.ref}>
            <button type="button" className="srch-hit" aria-pressed={picked?.ref === h.ref} disabled={!!pickOff} onClick={() => p.set('pick', h.ref)}
              data-i={`${h.title}|${saysOf(h)}${pickOff ? ` ${pickOff}` : ''}`}>
              <KindMark kind={g.shape} size={12} />
              <span className="srch-hit-name">{h.title}</span>
              <span className="srch-hit-note">{horizonNote(h)} · {g.verb}</span>
            </button>
          </li>)}</ul>
        </section>)}
      </div>
      {gid === 'vak' ? <aside className="srch-side">
        <h4>{picked!.title}</h4>
        <p className="srch-from">{picked!.ref.replace(/^vak:/, '')} · {saysOf(picked!)}</p>
        <h4>Round it{vakDepthWord(p.v) === undefined ? '' : `, depth ${vakDepthWord(p.v)}`}</h4>
        <svg viewBox="0 0 246 200" width="100%" className="srch-vak" role="group" aria-label="The entries round it"><VakRings p={p} w={246} h={200} labels /></svg>
        <p className="srch-from">{vakContextOf(p.v)?.revision ? `Source revision ${vakContextOf(p.v)!.revision!.slice(0, 10)}. Every entry is a source row; every line is drawn from the coordinates.` : 'No reading of the entries round it.'}</p>
      </aside> : <aside className="srch-side">
        <h4>Selected passage</h4>
        <blockquote className="srch-quote">{selection ?? NONE}</blockquote>
        <p className="srch-from">from {from ?? NONE} · {size ?? NONE} characters</p>
        <h4>Where a tag would send it</h4>
        <ul className="srch-targets">{GROUPS.filter(g => g.id !== 'power' && g.id !== 'vak').map(g => <li key={g.id} data-on={gid === g.id ? 'true' : undefined}><b>{g.name.replace(/s$/, '')}</b><span>{g.effect}</span></li>)}</ul>
        <p className="srch-send">{verdict}</p>
      </aside>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:search',
  title: 'Search',
  kind: 'instrument',
  defaults: {
    light: 'lit', query: 'ground', reach: ROOT, fields: 'mine', limit: 50, enter: 'send',
    'k:person': true, 'k:agent': true, 'k:place': true, 'k:document': true, 'k:passage': true, 'k:power': true, 'k:vak': true, 'vak.depth': 1,
    selection: 'A completion claim without executed evidence is only tone.', from: 'Completion', pick: 'agent:flint',
    // Readings: what the owner returns for the query, the aliases it keeps, the projects a search can reach.
    results: JSON.stringify([
      {ref: 'source:Control/agents/governance/attention/consult-authored-ground.md', title: 'Consult authored ground', says: 'Read the authored ground before the code.', kind: 'knowledge-source', horizon: [0], project: 'control', owner: 'Central'},
      {ref: 'capability:central-ground-keeping', title: 'central-ground-keeping', says: "The ground laws of Central's source model.", kind: 'capability', horizon: [5], project: 'control', owner: 'AIKit'},
      {ref: 'agent:flint', title: 'Flint', says: 'A grounded investigator.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
    ]),
    aliases: JSON.stringify([]),
    projects: JSON.stringify(['Archetypal-Earth', 'O-I', 'face-rig', 'ai-kit']),
  },
  fixtures: {
    'Aimed at @2': {query: '@2 ground'},
    'Your aliases': {query: '@team', aliases: JSON.stringify([{name: 'team', search: '@ cairn / @ flint'}, {name: 'stone', search: ': Archetypal-Earth bollingen'}, {name: 'why', search: '@# ( ? x @1 ground )'}]),
      results: JSON.stringify([
        {ref: 'agent:cairn', title: 'Cairn', says: 'A patient interpreter.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
        {ref: 'agent:flint', title: 'Flint', says: 'A grounded investigator.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
      ])},
    'Does not parse': {query: '( + @0 ground + @4 world )', results: JSON.stringify([])},
    // One result of every kind the owner returns, for the pane's groups and the list's pages.
    'Every kind': {query: 'e', results: JSON.stringify([
      {ref: 'source:Control/agents/governance/attention/consult-authored-ground.md', title: 'Consult authored ground', says: 'Read the authored ground before the code.', kind: 'knowledge-source', horizon: [0], project: 'control', owner: 'Central'},
      {ref: 'source:Control/agents/governance/authorship-and-return/own-the-gaps.md', title: 'Own the gaps', says: 'A hole that you find is yours to fix.', kind: 'knowledge-source', horizon: [0], project: 'control', owner: 'Central'},
      {ref: 'source:Control/agents/governance/authorship-and-return/recognition.md', title: 'Recognition', says: 'When returned reality needs the owner.', kind: 'knowledge-node', horizon: [0, 2], project: 'control', owner: 'Central'},
      {ref: 'source:Control/agents/governance/evidence/completion.md', title: 'Completion', says: 'A claim of done needs executed evidence.', kind: 'knowledge-node', horizon: [0, 2], project: 'control', owner: 'Central'},
      {ref: 'source:Control/agents/governance/evidence/completion.md#1', title: 'Completion · line 1', says: 'A completion claim without executed evidence is only tone.', kind: 'knowledge-frame', horizon: [0, 2], project: 'control', owner: 'Central'},
      {ref: 'agent:cairn', title: 'Cairn', says: 'A patient interpreter.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
      {ref: 'agent:flint', title: 'Flint', says: 'A grounded investigator.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
      {ref: 'agent:kite', title: 'Kite', says: 'An exploratory maker.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
      {ref: 'agent:lilt', title: 'Lilt', says: 'An associative companion.', kind: 'agent', horizon: [2, 4, 5], project: 'control', owner: 'Central'},
      {ref: 'capability:central-orient', title: 'central-orient', says: 'Orient a session and resume canonical work.', kind: 'capability', form: 'method', horizon: [2, 5], project: 'control', owner: 'AIKit'},
      {ref: 'capability:central-ground-keeping', title: 'central-ground-keeping', says: "The ground laws of Central's source model.", kind: 'capability', horizon: [5], project: 'control', owner: 'AIKit'},
      {ref: 'capability:wayfinder', title: 'wayfinder', says: 'Plan a huge chunk of work as a shared map.', kind: 'capability', form: 'methodology', horizon: [3, 5], project: 'control', owner: 'AIKit'},
      {ref: 'project:O-I', title: 'O-I', says: 'The O:I suite.', kind: 'project', horizon: [4], project: 'O-I', owner: 'Central'},
      {ref: 'project:Archetypal-Earth', title: 'Archetypal-Earth', says: 'The field of places and archetypes.', kind: 'project', horizon: [4], project: 'Archetypal-Earth', owner: 'Central'},
      {ref: 'place:bollingen', title: 'Bollingen', says: 'The tower and the stone of 1950.', kind: 'place', horizon: [4], project: 'Archetypal-Earth', owner: 'Central'},
      {ref: 'wiki:bollingen-stone', title: 'The Bollingen stone', says: 'The Things page of the stone.', kind: 'knowledge-node', horizon: [0, 2], project: 'Archetypal-Earth', owner: 'Central'},
      {ref: 'participant:public:parasakti', title: 'parasakti', says: 'A participant of the shared field.', kind: 'participant', horizon: [4], project: 'control', owner: 'Shared field'},
    ]), fields: 'shared'},
    // `ql vak locate M0-3` and `ql vak context M0-3 1` (Vāk source revision daa660cb): the archetypal number language and its eleven
    // archetypes, with its parent Anuttara.
    'Vāk M0-3, one relation round': {query: 'vak:M0-3', pick: 'vak:M0-3', results: JSON.stringify([{ref: 'vak:M0-3', title: 'Archetypal Number Language', says: 'Anuttara Position #3: The Complete Proto-Mathematical-Linguistic System - Para Vāk', kind: 'vak-entry', owner: 'Quaternal Logic'}]),
      'vak.context': "{\"centre\": \"M0-3\", \"depth\": 1, \"revision\": \"daa660cbc1b8c5da83828698665a753852cb0287\", \"entries\": [[\"M0\", \"Anuttara\", \"\", 21], [\"M0-3\", \"Archetypal Number Language\", \"12+4+2\", 39], [\"M0-3-(0/1)\", \"The Mirror\", \"(-)\", 40], [\"M0-3-10\", \"Archetype 7 - Divine Action\", \"7\", 70], [\"M0-3-11\", \"Archetype 8 - Structural Reflection\", \"8\", 78], [\"M0-3-2\", \"Archetype 0\", \"0\", 43], [\"M0-3-3\", \"Archetype 1\", \"1\", 44], [\"M0-3-4\", \"Archetype 0/1\", \"0/1\", 45], [\"M0-3-5\", \"Archetype 2\", \"2\", 46], [\"M0-3-6\", \"Archetype 3\", \"3\", 47], [\"M0-3-7\", \"Archetype 4\", \"4\", 60], [\"M0-3-8\", \"Archetype 5 - Dynamic Harmony\", \"5\", 61], [\"M0-3-9\", \"Archetype 6 - Synthetic Emptiness\", \"6\", 69]], \"relations\": [[\"M0-3\", \"parent\", \"M0\"], [\"M0-3\", \"child\", \"M0-3-(0/1)\"], [\"M0-3\", \"child\", \"M0-3-10\"], [\"M0-3\", \"child\", \"M0-3-11\"], [\"M0-3\", \"child\", \"M0-3-2\"], [\"M0-3\", \"child\", \"M0-3-3\"], [\"M0-3\", \"child\", \"M0-3-4\"], [\"M0-3\", \"child\", \"M0-3-5\"], [\"M0-3\", \"child\", \"M0-3-6\"], [\"M0-3\", \"child\", \"M0-3-7\"], [\"M0-3\", \"child\", \"M0-3-8\"], [\"M0-3\", \"child\", \"M0-3-9\"]]}"},
    // `ql vak context M0-3 2`: the archetypes' own rows, and Anuttara's other five positions.
    'Vāk M0-3, two relations round': {query: 'vak:M0-3', pick: 'vak:M0-3', 'vak.depth': 2, results: JSON.stringify([{ref: 'vak:M0-3', title: 'Archetypal Number Language', says: 'Anuttara Position #3: The Complete Proto-Mathematical-Linguistic System - Para Vāk', kind: 'vak-entry', owner: 'Quaternal Logic'}]),
      'vak.context': "{\"centre\": \"M0-3\", \"depth\": 2, \"revision\": \"daa660cbc1b8c5da83828698665a753852cb0287\", \"entries\": [[\"M0\", \"Anuttara\", \"\", 21], [\"M0-(4.0/1)\", \"O# - Paramasiva Base\", \"O#\", 80], [\"M0-(4.0/1/2)\", \"X# - Parashakti Base\", \"X#\", 87], [\"M0-(4.0/1/2/3)\", \"N# - Spanda Base\", \"N#\", 94], [\"M0-(4.5/0)\", \"# - Nara Base\", \"#\", 108], [\"M0-0\", \"Transcendent Void - 4-Fold Zero Unity\", \"(0000) -\", 23], [\"M0-1\", \"Emergence of Non-Duality\", \"(0/1)/00x00 = (∞x∞)x(R#/##)\", 26], [\"M0-2\", \"8-fold Zero-Zero\", \"(00-00), 00/00, 00x00, (00+00) = 9\", 28], [\"M0-3\", \"Archetypal Number Language\", \"12+4+2\", 39], [\"M0-3-(0/1)\", \"The Mirror\", \"(-)\", 40], [\"M0-3-(0/1)-0\", \"The Frame\", \"()\", 41], [\"M0-3-(0/1)-1\", \"The Operator\", \"-\", 42], [\"M0-3-10\", \"Archetype 7 - Divine Action\", \"7\", 70], [\"M0-3-10-(0/1)\", \"Svatantrya - Freedom\", \"(R#)\", 71], [\"M0-3-10-2\", \"Srishti - Creation\", \"(R0)\", 72], [\"M0-3-10-3\", \"Sthiti - Sustenance\", \"(R1)\", 73], [\"M0-3-10-4\", \"Samhara - Dissolution\", \"(R2)\", 74], [\"M0-3-10-5\", \"Tirodhana - Veiling\", \"(R3)\", 75], [\"M0-3-10-6\", \"Anugraha - Grace\", \"(R4)\", 76], [\"M0-3-10-7\", \"Samavesa - Absorption\", \"(R5)\", 77], [\"M0-3-11\", \"Archetype 8 - Structural Reflection\", \"8\", 78], [\"M0-3-2\", \"Archetype 0\", \"0\", 43], [\"M0-3-3\", \"Archetype 1\", \"1\", 44], [\"M0-3-4\", \"Archetype 0/1\", \"0/1\", 45], [\"M0-3-5\", \"Archetype 2\", \"2\", 46], [\"M0-3-6\", \"Archetype 3\", \"3\", 47], [\"M0-3-6-0\", \"Actual Identity (!)\", \"!\", 48], [\"M0-3-6-1\", \"Potential Essence (?)\", \"?\", 49], [\"M0-3-6-10\", \"Self Questioning World (!?/?!)\", \"!?/?!\", 58], [\"M0-3-6-11\", \"World Questioning Self (?!/!?)\", \"?!/!?\", 59], [\"M0-3-6-2\", \"Subjective I (!-)\", \"!-\", 50], [\"M0-3-6-3\", \"Asserted Am (-?)\", \"-?\", 51], [\"M0-3-6-4\", \"The Statement (!?)\", \"!?\", 52], [\"M0-3-6-5\", \"Objective Is (?-)\", \"?-\", 53], [\"M0-3-6-6\", \"Query of Other (-!)\", \"-!\", 54], [\"M0-3-6-7\", \"Reflexive Query (?!)\", \"?!\", 55], [\"M0-3-6-8\", \"Integrated Self (-!/!-)\", \"-!/!-\", 56], [\"M0-3-6-9\", \"Relational Other (-?/?-)\", \"-?/?-\", 57], [\"M0-3-7\", \"Archetype 4\", \"4\", 60], [\"M0-3-8\", \"Archetype 5 - Dynamic Harmony\", \"5\", 61], [\"M0-3-8-(0/1)\", \"Mono - The One\", \"(-)\", 62], [\"M0-3-8-2\", \"Poly - The Many\", \"@\", 63], [\"M0-3-8-3\", \"Poly- - Actually Many\", \"(-)-@+@-(-) + @-(-)+(-)-@\", 64], [\"M0-3-8-4\", \"-Mono - Potentially One\", \"(-)×@\", 65], [\"M0-3-8-5\", \"Mono- - Actualising The One\", \"= =\", 66], [\"M0-3-8-6\", \"-Poly - Potentiating The Many\", \"(-)/@\", 67], [\"M0-3-8-7\", \"MonoPoly - (M)Any-One\", \"(@)\", 68], [\"M0-3-9\", \"Archetype 6 - Synthetic Emptiness\", \"6\", 69], [\"M0-4\", \"The Holographic Matrix of Context\", \"(4.0/1-4/5)\", 79], [\"M0-4.4.0-(4.4/5)\", \"M# - Mahamaya Base\", \"M#\", 101], [\"M0-5\", \"Siva-Shakti Unity\", \"(5/0)\", 115]], \"relations\": [[\"M0-3\", \"parent\", \"M0\"], [\"M0-3\", \"child\", \"M0-3-(0/1)\"], [\"M0-3\", \"child\", \"M0-3-10\"], [\"M0-3\", \"child\", \"M0-3-11\"], [\"M0-3\", \"child\", \"M0-3-2\"], [\"M0-3\", \"child\", \"M0-3-3\"], [\"M0-3\", \"child\", \"M0-3-4\"], [\"M0-3\", \"child\", \"M0-3-5\"], [\"M0-3\", \"child\", \"M0-3-6\"], [\"M0-3\", \"child\", \"M0-3-7\"], [\"M0-3\", \"child\", \"M0-3-8\"], [\"M0-3\", \"child\", \"M0-3-9\"], [\"M0\", \"child\", \"M0-(4.0/1)\"], [\"M0\", \"child\", \"M0-(4.0/1/2)\"], [\"M0\", \"child\", \"M0-(4.0/1/2/3)\"], [\"M0\", \"child\", \"M0-(4.5/0)\"], [\"M0\", \"child\", \"M0-0\"], [\"M0\", \"child\", \"M0-1\"], [\"M0\", \"child\", \"M0-2\"], [\"M0\", \"child\", \"M0-3\"], [\"M0\", \"child\", \"M0-4\"], [\"M0\", \"child\", \"M0-4.4.0-(4.4/5)\"], [\"M0\", \"child\", \"M0-5\"], [\"M0-3-(0/1)\", \"parent\", \"M0-3\"], [\"M0-3-(0/1)\", \"child\", \"M0-3-(0/1)-0\"], [\"M0-3-(0/1)\", \"child\", \"M0-3-(0/1)-1\"], [\"M0-3-10\", \"parent\", \"M0-3\"], [\"M0-3-10\", \"child\", \"M0-3-10-(0/1)\"], [\"M0-3-10\", \"child\", \"M0-3-10-2\"], [\"M0-3-10\", \"child\", \"M0-3-10-3\"], [\"M0-3-10\", \"child\", \"M0-3-10-4\"], [\"M0-3-10\", \"child\", \"M0-3-10-5\"], [\"M0-3-10\", \"child\", \"M0-3-10-6\"], [\"M0-3-10\", \"child\", \"M0-3-10-7\"], [\"M0-3-11\", \"parent\", \"M0-3\"], [\"M0-3-2\", \"parent\", \"M0-3\"], [\"M0-3-3\", \"parent\", \"M0-3\"], [\"M0-3-4\", \"parent\", \"M0-3\"], [\"M0-3-5\", \"parent\", \"M0-3\"], [\"M0-3-6\", \"parent\", \"M0-3\"], [\"M0-3-6\", \"child\", \"M0-3-6-0\"], [\"M0-3-6\", \"child\", \"M0-3-6-1\"], [\"M0-3-6\", \"child\", \"M0-3-6-10\"], [\"M0-3-6\", \"child\", \"M0-3-6-11\"], [\"M0-3-6\", \"child\", \"M0-3-6-2\"], [\"M0-3-6\", \"child\", \"M0-3-6-3\"], [\"M0-3-6\", \"child\", \"M0-3-6-4\"], [\"M0-3-6\", \"child\", \"M0-3-6-5\"], [\"M0-3-6\", \"child\", \"M0-3-6-6\"], [\"M0-3-6\", \"child\", \"M0-3-6-7\"], [\"M0-3-6\", \"child\", \"M0-3-6-8\"], [\"M0-3-6\", \"child\", \"M0-3-6-9\"], [\"M0-3-7\", \"parent\", \"M0-3\"], [\"M0-3-8\", \"parent\", \"M0-3\"], [\"M0-3-8\", \"child\", \"M0-3-8-(0/1)\"], [\"M0-3-8\", \"child\", \"M0-3-8-2\"], [\"M0-3-8\", \"child\", \"M0-3-8-3\"], [\"M0-3-8\", \"child\", \"M0-3-8-4\"], [\"M0-3-8\", \"child\", \"M0-3-8-5\"], [\"M0-3-8\", \"child\", \"M0-3-8-6\"], [\"M0-3-8\", \"child\", \"M0-3-8-7\"], [\"M0-3-9\", \"parent\", \"M0-3\"]]}"},
    'Vāk M0-3, the entry alone': {query: 'vak:M0-3', pick: 'vak:M0-3', 'vak.depth': 0, results: JSON.stringify([{ref: 'vak:M0-3', title: 'Archetypal Number Language', says: 'Anuttara Position #3: The Complete Proto-Mathematical-Linguistic System - Para Vāk', kind: 'vak-entry', owner: 'Quaternal Logic'}]),
      'vak.context': "{\"centre\": \"M0-3\", \"depth\": 0, \"revision\": \"daa660cbc1b8c5da83828698665a753852cb0287\", \"entries\": [[\"M0-3\", \"Archetypal Number Language\", \"12+4+2\", 39]], \"relations\": []}"},
    'No readings': Object.fromEntries(['light', 'query', 'reach', 'fields', 'limit', 'enter', 'k:person', 'k:agent', 'k:place', 'k:document', 'k:passage', 'k:power', 'k:vak',
      'selection', 'from', 'pick', 'results', 'aliases', 'projects', 'vak.depth', 'vak.context'].map(k => [k, undefined])),
  },
  firstPage: 'find',

  folded: p => {
    const r = read(p.v)
    return <Folded title="Search" light={light(p)} readings={[r.raw === undefined ? NONE : `@ ${trunc(r.raw, 10)}`, r.hits === undefined ? NONE : `${r.hits.length} found`]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const r = read(p.v)
    return <Panel title="Search" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>{r.vak !== undefined
        ? <Display w={140} h={146} label="Round the entry" corner={vakDepthWord(p.v) === undefined ? NONE : `depth ${vakDepthWord(p.v)}`}
          does="The entry the search locates, and the entries round it. Drag handle 1 for the depth."><VakRings p={p} w={140} h={146} labels={false} /></Display>
        : <Well r={r} p={p} w={140} h={146} compact />}</Section>
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
    const r = read(p.v), list = (aliasesOf(p.v) ?? []).slice(0, 3)
    return <Tile title="Search" light={light(p)} span={2} onFull={p.nav.full}>
      <div className="srch-tile">
        <QueryLine p={p} />
        <Rows does="The last results of the search." items={rowsOf(r)} size={3} />
        <div className="srch-aliases">
          {list.length
            ? list.map(a => <Action {...st(p, 'query')} key={a.name} label={`@${a.name}`} does={`Run ${a.search}`} onPress={() => p.set('query', `@${a.name}`)} />)
            : <Readout big label="found" value={r.hits?.length} tone="value" />}
        </div>
      </div>
    </Tile>
  },
}
