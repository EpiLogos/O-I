// The Workspace (manual §18.2): the track of one project, book or practice, and what it remembers for each mode. Live's nearest:
// Hybrid Reverb or Simpler's pages — a device of choosers and switches round one picture; it has no smooth quantity, so no dials.
// The picture is the workspace book's own memory (desktop/cradle/src/workspace/store.ts): the open mode's pane tree — splits
// with weights, tab groups with pinned tabs (surface/types.ts Pane) — the side regions, the widget rail, and a mark on each mode
// that keeps a tree of its own (`modeLayouts`). The strip is the five modes (workspace/mode.ts WORKSPACE_MODES); the handle on its
// track sets which mode a launch opens in. The material is the owner's, carried on value keys as JSON strings: `trees` (the pane
// tree of each mode), `sets` (the set each mode opens with), `clips` (the files of the project, with the three states that the
// draft store keeps: workspace/drafts.ts HeldDraft, content against saved_content) and `folders` (the projects of Work). Its sample
// content (Archetypal-Earth) sits in `defaults`. A key the owner does not report draws "—", and the well says which reading is missing.
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__workspace.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']

/** The five modes, in the order the strip shows them (WORKSPACE_MODES without Epi-Logos and Settings). */
const MODES = [
  {id: 'base', name: 'Central', short: 'Cent.', mark: 'C'}, {id: 'factory', name: 'Factory', short: 'Fact.', mark: 'F'},
  {id: 'expressions', name: 'Expressions', short: 'Expr.', mark: 'E'}, {id: 'techne', name: 'Technē', short: 'Tech.', mark: 'T'},
  {id: 'live', name: 'Live', short: 'Live', mark: 'L'},
] as const
/** The stops of the Open in handle: the mode where you left off, then each mode. */
const STOPS = ['last', ...MODES.map(m => m.id)] as const
/** A mode's name; a mode this strip does not list keeps its own id, and an unreported one draws "—". */
const modeName = (id: string | undefined) => (id === undefined ? NONE : MODES.find(m => m.id === id)?.name ?? id)

const KINDS = ['Project', 'Book', 'Practice', 'Other'].map(label => ({value: label.toLowerCase(), label}))
/** The workspace's folder is Central, or one project of Work (workspace/scope.ts: the workspace's `project`, absent for Central). The
 * projects of Work are the owner's, on the `folders` key. */
const CENTRAL: Option<string> = {value: 'central', label: 'Central'}
/** A project's own space is a place of the suite (projections/atlas/provider/suiteStanding.ts SuitePlace kind 'project'); an owner can declare others. */
const PLACES = [{value: 'own', label: 'Own place'}, {value: 'declared', label: 'Declared place'}, {value: 'none', label: 'None'}]
const OPEN_IN = [{value: 'last', label: 'Last mode'}, ...MODES.map(m => ({value: m.id, label: m.name}))]
const LAUNCH = [
  {value: 'all', label: 'All modes', does: 'Every mode returns as you left it.'}, {value: 'open', label: 'Open mode', does: 'Only the open mode returns.'},
  {value: 'none', label: 'Nothing', does: 'Nothing returns. The workspace opens bare.'},
] as const
const LAUNCH_SHORT = [{...LAUNCH[0], label: 'All'}, {...LAUNCH[1], label: 'Open'}, {...LAUNCH[2], label: 'None'}] as const
const KEEP = [
  {value: 'change', label: 'On change', does: 'The workspace stores your context at each change.'}, {value: 'leave', label: 'On leave', does: 'The workspace stores your context when you leave it.'},
  {value: 'manual', label: 'Manual', does: 'The workspace stores your context when you press Keep now.'},
] as const
const KEEP_SHORT = [{...KEEP[0], label: 'Change'}, {...KEEP[1], label: 'Leave'}, KEEP[2]] as const
const REMEMBER_IN = [{value: 'every', label: 'Every mode', does: 'Keeps context for all five modes.'}, {value: 'open', label: 'Open mode', does: 'Keeps context for the open mode only.'}] as const
const STATES = {draft: 'Draft', saved: 'Saved', edited: 'Edited since save'} as const

// ---------------------------------------------------------------- what the workspace book holds (readings)

interface Group { readonly t: 'g'; readonly tabs: number; readonly pinned: number; readonly title: string; readonly focus: boolean; readonly instrument: boolean }
interface Split { readonly t: 's'; readonly dir: 'h' | 'v'; readonly w: readonly number[]; readonly kids: readonly Node[] }
type Node = Group | Split

const whole = (x: unknown, high: number): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? clampTo(0, high, Math.round(x)) : undefined)
/** One pane node as the owner reports it, or undefined when it is not one (a node that cannot be read is left out, never guessed). */
function nodeOf(x: unknown, depth = 0): Node | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x) || depth > 6) return undefined
  const n = x as Record<string, unknown>
  if (n.t === 'g') return {t: 'g', tabs: whole(n.tabs, 8) ?? 0, pinned: whole(n.pinned, 8) ?? 0, title: typeof n.title === 'string' ? n.title : NONE, focus: n.focus === true, instrument: n.instrument === true}
  if (n.t !== 's' || (n.dir !== 'h' && n.dir !== 'v')) return undefined
  const kids: Node[] = [], w: number[] = [], weights = Array.isArray(n.w) ? n.w : []
  ;(Array.isArray(n.kids) ? n.kids : []).slice(0, 6).forEach((k, i) => {
    const kid = nodeOf(k, depth + 1), weight = weights[i]
    if (kid) { kids.push(kid); w.push(typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : 1) }
  })
  return kids.length ? {t: 's', dir: n.dir, w, kids} : undefined
}
/** The pane tree each mode keeps (`trees`: `layout` for the open mode, `modeLayouts` for the others); a mode that is not there opens
 * on its curated default. Undefined when the owner reports no trees. */
function treesOf(v: V): ReadonlyMap<string, Node> | undefined {
  const raw = json<unknown>(v, 'trees', undefined)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const trees = new Map<string, Node>()
  for (const [mode, node] of Object.entries(raw)) { const n = nodeOf(node); if (n) trees.set(mode, n) }
  return trees
}
/** The sets that the workspace saved, by mode (`sets`, each with its `mode`). Undefined when the owner reports none. */
function setsOf(v: V): ReadonlyMap<string, string> | undefined {
  const raw = json<unknown>(v, 'sets', undefined)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return new Map(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))
}

type ClipState = keyof typeof STATES
/** A clip as the owner reports it; a field it leaves out stays undefined and draws "—". */
interface Clip { readonly id: string; readonly name?: string; readonly path?: string; readonly kind?: string; readonly state?: ClipState; readonly open?: boolean }
const text = (x: unknown) => (typeof x === 'string' ? x : undefined)
/** The clips: files of the project and a page that has no file yet. Undefined when the owner reports none; a new workspace has none. */
function clipsOf(v: V): readonly Clip[] | undefined {
  if (boolOf(v, 'fresh') === true) return []
  const raw = json<unknown>(v, 'clips', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((c, i): Clip[] => {
    if (!c || typeof c !== 'object') return []
    const r = c as Record<string, unknown>
    return [{id: text(r.id) ?? `clip-${i}`, name: text(r.name), path: text(r.path), kind: text(r.kind), open: typeof r.open === 'boolean' ? r.open : undefined,
      state: typeof r.state === 'string' && Object.hasOwn(STATES, r.state) ? r.state as ClipState : undefined}]
  })
}
const openCount = (v: V) => clipsOf(v)?.filter(c => c.open === true).length
const editedCount = (v: V) => clipsOf(v)?.filter(c => c.state === 'edited').length
const openText = (v: V) => { const n = openCount(v); return n === undefined ? NONE : `${n} open` }

/** What a launch does with a mode's tree. A mode whose state the readings do not settle is 'unknown'. */
type ModeState = 'returns' | 'kept' | 'none' | 'unknown'
/** A mode's tree is kept: the workspace keeps panes, the mode has a tree of its own, and "Remember in" reaches it. */
function kept(v: V, mode: string): boolean | undefined {
  const panes = boolOf(v, 'keepPanes'), mem = strOf(v, 'mem')?.split(','), scope = strOf(v, 'rememberIn'), open = strOf(v, 'mode')
  if (panes === false || (mem && !mem.includes(mode))) return false
  if (panes === undefined || !mem || scope === undefined) return undefined
  return scope === 'every' ? true : open === undefined ? undefined : mode === open
}
/** A kept tree returns at launch: all modes return, or only the open one. */
function returns(v: V, mode: string): boolean | undefined {
  const k = kept(v, mode), when = strOf(v, 'onLaunch'), open = strOf(v, 'mode')
  if (k === false || when === 'none') return false
  const back = when === undefined ? undefined : when === 'all' ? true : when === 'open' ? (open === undefined ? undefined : mode === open) : false
  return back === false ? false : k === true && back === true ? true : undefined
}
function modeState(v: V, mode: string): ModeState {
  const k = kept(v, mode), r = returns(v, mode)
  return r === true ? 'returns' : k === true && r === false ? 'kept' : k === false ? 'none' : 'unknown'
}

/** What the picture knows of the open mode's panes: a tree, "no panes open", the curated default, or no reading. */
type Panes = {readonly kind: 'tree'; readonly node: Node} | {readonly kind: 'none' | 'default' | 'unread'}
function panesOf(v: V): Panes {
  const mode = strOf(v, 'mode')
  if (mode === undefined) return {kind: 'unread'}
  if (boolOf(v, 'fresh') === true) return {kind: mode === 'base' ? 'none' : 'default'}
  const trees = treesOf(v)
  if (!trees) return {kind: 'unread'}
  const node = trees.get(mode)
  return node ? {kind: 'tree', node} : {kind: 'default'}
}
const groupsIn = (n: Node): number => (n.t === 'g' ? 1 : n.kids.reduce((a, k) => a + groupsIn(k), 0))
const paneCount = (p: Panes): number | undefined => (p.kind === 'unread' ? undefined : p.kind === 'tree' ? groupsIn(p.node) : 0)
const paneText = (n: number | undefined) => (n === undefined ? NONE : `${n} ${n === 1 ? 'pane' : 'panes'}`)
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
/** The head light reads the owner alone (manual §16.8): lit or dark when it reports, hollow when it has not. */
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
/** The options of a chooser, with the value the owner reports among them when it is not a listed one. */
const withCurrent = (options: readonly Option<string>[], value: string | undefined): readonly Option<string>[] =>
  value === undefined || options.some(o => o.value === value) ? options : [...options, {value, label: value}]
const foldersOf = (v: V): readonly Option<string>[] => {
  const names = json<unknown>(v, 'folders', [])
  return withCurrent([CENTRAL, ...(Array.isArray(names) ? names : []).filter((n): n is string => typeof n === 'string').map(n => ({value: n, label: n}))], strOf(v, 'folder'))
}
const kindLabel = (v: V) => { const k = strOf(v, 'kind'); return k === undefined ? NONE : KINDS.find(o => o.value === k)?.label ?? k }
const folderLabel = (v: V) => { const f = strOf(v, 'folder'); return f === undefined ? NONE : foldersOf(v).find(o => o.value === f)?.label ?? f }

// ---------------------------------------------------------------- the picture

const FAINT_FILL = 'color-mix(in srgb, var(--text, #d4d7da) 34%, transparent)'
const DASH = '3 3'
const DOTS = '1 3'
/** A stroke for a thing the workspace may keep: solid when kept, dashed when not, dotted when the owner has not said. */
const keptDash = (k: boolean | undefined) => (k === true ? undefined : k === false ? DASH : DOTS)

/** The panes of one mode: a split divides its box by its weights, a group is a box with a tick for each tab (a pinned tab filled). */
function Tree({node, x, y, w, h, instruments, titles}: {node: Node; x: number; y: number; w: number; h: number; instruments: boolean | undefined; titles: boolean}) {
  if (node.t === 'g') {
    return <g>
      {node.focus && <rect x={x + .5} y={y + .5} width={w - 1} height={h - 1} className="dp-fill-on" />}
      <rect x={x + .5} y={y + .5} width={w - 1} height={h - 1} className="dp-faint" strokeDasharray={node.instrument ? keptDash(instruments) : undefined}
        style={node.focus ? {stroke: 'var(--dp-on)'} : undefined} />
      {Array.from({length: node.tabs}, (_, i) => <rect key={i} x={x + 3 + i * 7} y={y + 3} width={5} height={3} fill={i < node.pinned ? 'var(--dp-on)' : FAINT_FILL} />)}
      {titles && h >= 22 && w >= 36 && <text x={x + 4} y={y + 16} className="dp-ink-dim">{cut(node.title, Math.floor((w - 8) / 5))}</text>}
    </g>
  }
  const total = node.w.reduce((a, b) => a + b, 0), room = (node.dir === 'h' ? w : h) - 2 * (node.kids.length - 1)
  let at = 0
  return <g>{node.kids.map((kid, i) => {
    const size = room * (node.w[i] ?? 1) / total, kx = node.dir === 'h' ? x + at : x, ky = node.dir === 'v' ? y + at : y
    at += size + 2
    return <Tree key={i} node={kid} x={kx} y={ky} w={node.dir === 'h' ? size : w} h={node.dir === 'v' ? size : h} instruments={instruments} titles={titles} />
  })}</g>
}

/** The open mode's window: the left body, the pane tree, the right panel, and the widget rail at the edge. A rail that is not kept is
 * dashed; one that the owner has not said about is dotted. */
function Stage({v, panes, x, y, w, h, left, right, rail, titles}: {v: V; panes: Panes; x: number; y: number; w: number; h: number; left: number; right: number; rail: number; titles: boolean}) {
  const reported = numOf(v, 'widgets'), cx = x + left + 2, cw = w - left - right - rail - 6
  const widgets = reported !== undefined && Number.isFinite(reported) ? clampTo(0, Math.floor(h / (rail + 2)), Math.floor(reported)) : undefined
  return <g>
    <rect x={x + .5} y={y + .5} width={left - 1} height={h - 1} className="dp-faint" />
    <rect x={x + w - rail - right - 1.5} y={y + .5} width={right - 1} height={h - 1} className="dp-faint" />
    {widgets === undefined
      ? <text x={x + w - rail / 2} y={y + 7} className="dp-axis" textAnchor="middle">{NONE}</text>
      : Array.from({length: widgets}, (_, i) => <rect key={i} x={x + w - rail + .5} y={y + .5 + i * (rail + 2)} width={rail - 1} height={rail - 1} className="dp-faint"
        strokeDasharray={keptDash(boolOf(v, 'keepWidgets'))} style={{fill: 'color-mix(in srgb, var(--dp-value) 30%, transparent)'}} />)}
    {panes.kind === 'tree' ? <Tree node={panes.node} x={cx} y={y} w={cw} h={h} instruments={boolOf(v, 'keepInstruments')} titles={titles} />
      : <g>
        <rect x={cx + .5} y={y + .5} width={cw - 1} height={h - 1} className="dp-faint" strokeDasharray={DASH} />
        {cw >= 40 && (panes.kind === 'unread'
          ? <><text x={cx + cw / 2} y={y + h / 2 - 1} className="dp-axis" textAnchor="middle">No reading</text><text x={cx + cw / 2} y={y + h / 2 + 9} className="dp-axis" textAnchor="middle">of the panes</text></>
          : <text x={cx + cw / 2} y={y + h / 2 + 3} className="dp-axis" textAnchor="middle">{panes.kind === 'none' ? 'no panes open' : 'curated default'}</text>)}
      </g>}
  </g>
}

/** The mark on a mode: filled when its panes return at launch, a ring when they are kept but do not, none otherwise. */
const markOf = (state: ModeState, cx: number, cy: number, r: number) => state === 'returns' ? <circle cx={cx} cy={cy} r={r} fill="var(--dp-on)" />
  : state === 'kept' ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--dp-on)" strokeWidth={1} /> : null
const marked = (state: ModeState) => state === 'returns' || state === 'kept'
const SAID_STRIP: Readonly<Record<ModeState, string>> = {
  returns: 'Opens this mode. Its panes return at launch.', kept: 'Opens this mode. Its panes are kept but do not return at launch.',
  none: 'Opens this mode. Nothing of it is kept.', unknown: 'Opens this mode. What a launch restores of it is not reported.',
}

/** Turning to another mode asks the owner to open it. */
const turnTo = (set?: SetFn) => (id: string) => set?.('mode', id)

/** The strip: a stop for "Last mode", then the five modes. A mode cell turns the open mode; a mark on it says what a launch does with its tree. */
function Strip({v, set, x, y, cell, h, names, sets}: {v: V; set?: SetFn; x: number; y: number; cell: number; h: number; names: boolean; sets: boolean}) {
  const mode = strOf(v, 'mode'), openIn = strOf(v, 'openIn'), at = (i: number) => x + i * cell
  const turn = turnTo(set), saved = sets && boolOf(v, 'keepSets') === true && boolOf(v, 'fresh') !== true ? setsOf(v) : undefined
  return <g role="radiogroup" aria-label="Modes">
    <g role="radio" aria-checked={openIn === 'last'} aria-label="Last mode" tabIndex={set ? (openIn === 'last' ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
      data-i="Last mode|A launch opens in the mode where you left off." onClick={() => set?.('openIn', 'last')}>
      <rect x={at(0) + .5} y={y + .5} width={cell - 1} height={h - 1} className="dp-faint" strokeDasharray={DASH} />
      <text x={at(0) + cell / 2} y={y + h / 2 + 3.5} className="dp-ink-dim" textAnchor="middle">{names ? 'Last' : '↺'}</text>
    </g>
    {MODES.map((m, i) => {
      const cx = at(i + 1), open = m.id === mode, state = modeState(v, m.id)
      return <g key={m.id} role="radio" aria-checked={open} aria-label={m.name} tabIndex={set ? (open ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
        data-i={`${m.name}|${SAID_STRIP[state]}`} onClick={() => turn(m.id)}>
        <rect x={cx + .5} y={y + .5} width={cell - 1} height={h - 1} className={open ? 'dp-fill-on' : 'dp-faint'} style={open ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : undefined} />
        <text x={cx + cell / 2} y={y + h / 2 + (marked(state) ? 1.5 : 3.5)} className={open ? 'dp-ink' : 'dp-ink-dim'} textAnchor="middle">{names ? m.short : m.mark}</text>
        {markOf(state, cx + cell / 2, y + h - 4.5, 1.9)}
        {saved?.has(m.id) && <rect x={cx + 3} y={y + h - 7} width={4} height={4} fill="var(--dp-value)" />}
      </g>
    })}
  </g>
}

/** The Open in handle: a track under the strip with a stop for each choice. Drag the handle to a stop. With no reading of the stop, the
 * handle is not drawn, and a click on a stop of the track asks for it. */
function OpenTrack({v, set, x, y, cell, label}: {v: V; set?: SetFn; x: number; y: number; cell: number; label: boolean}) {
  const openIn = strOf(v, 'openIn'), at = openIn === undefined ? -1 : STOPS.indexOf(openIn as (typeof STOPS)[number]), px = (i: number) => x + i * cell + cell / 2
  return <g>
    <line x1={px(0)} y1={y} x2={px(STOPS.length - 1)} y2={y} className="dp-faint" />
    {STOPS.map((s, i) => <line key={s} x1={px(i)} y1={y - 2} x2={px(i)} y2={y + 2} className="dp-faint" />)}
    {label && <text x={x + 1} y={y + 12} className="dp-ink-dim"><tspan className="dp-axis">opens in </tspan>{openIn === undefined ? NONE : openIn === 'last' ? 'Last mode' : modeName(openIn)}</text>}
    {set && at >= 0 && <Handle x={px(at)} y={y} n={1} shape="ring" label="Open in" does="Drag along the track: the mode that comes forward after a launch."
      onDrag={(hx) => set('openIn', STOPS[Math.round(clampTo(0, STOPS.length - 1, (hx - x - cell / 2) / cell))]!)} onReset={() => set('openIn', 'last')} />}
    {set && at < 0 && STOPS.map((s, i) => <rect key={s} x={px(i) - cell / 2} y={y - 5} width={cell} height={10} fill="transparent" style={{cursor: 'pointer'}}
      data-i={`Open in ${s === 'last' ? 'Last mode' : modeName(s)}|The mode that comes forward after a launch.`} onClick={() => set('openIn', s)} />)}
  </g>
}

/** The picture at one size: the name, the strip, the Open in track and the open mode's window. */
function Picture({v, set, w, names, sets}: {v: V; set?: SetFn; w: number; names: boolean; sets: boolean}) {
  const cell = (w - 8) / 6, panes = panesOf(v), count = paneCount(panes), dirty = boolOf(v, 'dirty')
  return <g>
    <text x={5} y={11} className="dp-ink">{cut(shown(v, 'name'), names ? 26 : 16)}</text>
    <Strip v={v} set={set} x={4} y={15} cell={cell} h={19} names={names} sets={sets} />
    <OpenTrack v={v} set={set} x={4} y={43} cell={cell} label />
    <Stage v={v} panes={panes} x={4} y={62} w={w - 8} h={69} left={names ? 14 : 12} right={names ? 26 : 20} rail={names ? 7 : 6} titles={names || (count ?? 0) > 0} />
    <text x={5} y={142} className="dp-ink-dim">{modeName(strOf(v, 'mode'))} · {paneText(count)}</text>
    <text x={w - 5} y={142} className="dp-ink-dim" textAnchor="end" style={dirty === true ? {fill: 'var(--dp-on)'} : undefined}>{dirty === undefined ? NONE : dirty ? 'unkept' : 'kept'}</text>
  </g>
}

/** The small picture for the widget: the five modes and the open mode's window. */
function Mini({v, set}: {v: V; set?: SetFn}) {
  const mode = strOf(v, 'mode'), cell = 20, panes = panesOf(v), turn = turnTo(set)
  return <g>
    <g role="radiogroup" aria-label="Modes">{MODES.map((m, i) => {
      const open = m.id === mode, state = modeState(v, m.id)
      return <g key={m.id} role="radio" aria-checked={open} aria-label={m.name} tabIndex={set ? (open ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
        data-i={`${m.name}|Opens this mode.`} onClick={() => turn(m.id)}>
        <rect x={6 + i * cell + .5} y={4.5} width={cell - 1} height={17} className={open ? 'dp-fill-on' : 'dp-faint'} style={open ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : undefined} />
        <text x={6 + i * cell + cell / 2} y={marked(state) ? 14 : 16} className={open ? 'dp-ink' : 'dp-ink-dim'} textAnchor="middle">{m.mark}</text>
        {markOf(state, 6 + i * cell + cell / 2, 19, 1.6)}
      </g>
    })}</g>
    <Stage v={v} panes={panes} x={4} y={26} w={104} h={66} left={8} right={14} rail={5} titles={false} />
    <text x={5} y={101} className="dp-ink-dim">{cut(modeName(mode), 12)} · {paneText(paneCount(panes))}</text>
  </g>
}

// ---------------------------------------------------------------- the controls

/** Launch: asks Central to bring back the remembered context (the workspace's activate). */
const launch = (p: ViewProps) => () => p.set('launch', true)
/** Keep now: asks Central to store the context at once (the workspace's checkpoint). */
const keepNow = (p: ViewProps) => () => p.set('keepNow', true)
const rename = (p: ViewProps) => (x: string) => { if (x.trim()) p.set('name', x.trim()) }
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const toggle = (p: ViewProps, key: string, label: string, does: string) => {
  const now = boolOf(p.v, key)
  return <Toggle key={key} label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}

const LAUNCH_DOES = 'Restores the remembered context of this workspace.'
const KEEP_NOW = 'Stores the context of this workspace at once.'
const REMEMBER_PARTS = [
  ['keepPanes', 'Panes', 'Keeps which panes are open, how they split and which are pinned.'],
  ['keepInstruments', 'Instruments', 'Keeps which instrument each pane holds, and its build.'],
  ['keepWidgets', 'Widgets', 'Keeps which widgets are open on the rail, which are pinned and which preset is in use.'],
  ['keepSets', 'Sets', 'Keeps the saved set that each mode opens with.'],
] as const

export const design: DesignedDevice = {
  id: 'central:workspace',
  title: 'Workspace',
  kind: 'instrument',
  defaults: {
    light: 'lit', name: 'Archetypal Earth', kind: 'project', folder: 'Archetypal-Earth', place: 'own',
    keepPanes: true, keepInstruments: true, keepWidgets: true, keepSets: true, rememberIn: 'every',
    onLaunch: 'all', openIn: 'last', keepWhen: 'change', sendToDay: true,
    // Readings: what the workspace book reports, never set from here (the open mode is turned from the strip).
    mode: 'base', mem: 'base,factory,techne,live', fresh: false, dirty: false, widgets: 3, visited: '2 d ago', clip: 'day',
    // The material, as JSON strings: the projects of Work, the pane tree of each mode, the set each mode opens with, and the clips.
    folders: JSON.stringify(['Archetypal-Earth', 'O-I', 'face-rig', 'Workcell', 'ai-kit', 'Quaternal-Logic']),
    trees: JSON.stringify({
      base: {t: 's', dir: 'h', w: [3, 2], kids: [{t: 'g', tabs: 3, pinned: 1, title: 'SPEC.md', focus: true}, {t: 'g', tabs: 1, title: 'Earth', instrument: true}]},
      factory: {t: 'g', tabs: 2, title: 'Desk'},
      techne: {t: 's', dir: 'v', w: [1, 1], kids: [{t: 'g', tabs: 1, title: 'Reading', instrument: true}, {t: 'g', tabs: 2, title: 'Timeline', instrument: true}]},
      live: {t: 'g', tabs: 1, title: 'Torus', instrument: true},
    }),
    sets: JSON.stringify({base: 'Reading', factory: 'Run board'}),
    clips: JSON.stringify([
      {id: 'spec', name: 'SPEC.md', path: 'docs', kind: 'File', state: 'saved', open: true},
      {id: 'day', name: '2026-10-12.md', path: 'ProjectCentral/now/day', kind: 'Day', state: 'edited', open: true},
      {id: 'project', name: 'project.json', path: 'ProjectCentral', kind: 'File', state: 'saved', open: false},
      {id: 'draft', name: 'Untitled', path: '', kind: 'Flow', state: 'draft', open: true},
    ]),
  },
  fixtures: {
    'Archetypal Earth': {},
    'A new workspace': {name: 'New workspace', folder: 'central', fresh: true, mem: 'base', widgets: 2, visited: 'now', clips: '[]', trees: '{}', sets: '{}'},
    'Not launched': {light: 'dark', visited: '6 d ago', mode: 'techne'},
    'No readings': Object.fromEntries(['light', 'name', 'kind', 'folder', 'place', 'keepPanes', 'keepInstruments', 'keepWidgets', 'keepSets', 'rememberIn', 'onLaunch',
      'openIn', 'keepWhen', 'sendToDay', 'mode', 'mem', 'fresh', 'dirty', 'widgets', 'visited', 'clip', 'folders', 'trees', 'sets', 'clips'].map(k => [k, undefined])),
  },

  folded: p => <Folded title={cut(shown(p.v, 'name'), 18)} light={light(p)} readings={[openText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Workspace" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The workspace" does="The panes of the open mode. A mark on a mode shows what a launch restores. Drag handle 1 to set the mode that a launch opens in."
        corner={openText(p.v)}>
        <Picture v={p.v} set={p.set} w={140} names={false} sets={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Action label="Launch" does={LAUNCH_DOES} onPress={launch(p)} />
      <Radio label="Restore" does="What comes back when you launch the workspace: all modes, the open mode or nothing." value={strOf(p.v, 'onLaunch') ?? ''} options={LAUNCH_SHORT} stack onChange={x => p.set('onLaunch', x)} />
      <Radio label="Keep" does="When the workspace stores your context." value={strOf(p.v, 'keepWhen') ?? ''} options={KEEP_SHORT} stack onChange={x => p.set('keepWhen', x)} />
      {toggle(p, 'sendToDay', 'To Day', 'Send the work of this workspace to the Day.')}
    </Section>
  </Panel>,

  whole: p => <Panel title="Workspace" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The workspace" does="The panes of the open mode. A filled mark on a mode: its panes return at launch. A ring: kept, but not restored. A teal square: a saved set. Drag handle 1 to set the mode that a launch opens in."
          corner={openText(p.v)}>
          <Picture v={p.v} set={p.set} w={194} names sets />
        </Display>
      </Section>
      <Section label="Identity" grow>
        <TextField label="Name" does="The name on the track and in the browser." value={strOf(p.v, 'name') ?? ''} placeholder={has(p.v, 'name') ? 'New workspace' : NONE} onChange={rename(p)} />
        <Chooser label="Kind" does="The starting set of panes and widgets for a new workspace." value={strOf(p.v, 'kind') ?? ''} options={withCurrent(KINDS, strOf(p.v, 'kind'))} onChange={x => p.set('kind', x)} />
        <Chooser label="Folder" does="The folder whose files show as clips: Central or one project of Work." value={strOf(p.v, 'folder') ?? ''} options={foldersOf(p.v)} onChange={x => p.set('folder', x)} />
        <Chooser label="Place" does="Where the workspace stands on your planet. A project has its own place." value={strOf(p.v, 'place') ?? ''} options={withCurrent(PLACES, strOf(p.v, 'place'))} onChange={x => p.set('place', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Remember" width={82}>
        {REMEMBER_PARTS.map(([key, label, does]) => toggle(p, key, label, does))}
        <Action label="Keep now" does={KEEP_NOW} onPress={keepNow(p)} />
      </Section>
      <Section label="Keep" width={88}>
        <Radio label="Remember in" does="Keeps context for all five modes, or for the open mode only." value={strOf(p.v, 'rememberIn') ?? ''} options={REMEMBER_IN} stack onChange={x => p.set('rememberIn', x)} />
        <Radio label="Keep context" does="When the workspace stores your context." value={strOf(p.v, 'keepWhen') ?? ''} options={KEEP} stack onChange={x => p.set('keepWhen', x)} />
      </Section>
      <Section label="Launch" width={96}>
        <Action label="Launch" does={LAUNCH_DOES} onPress={launch(p)} />
        <Radio label="On launch" does="What comes back when you launch the workspace." value={strOf(p.v, 'onLaunch') ?? ''} options={LAUNCH} stack onChange={x => p.set('onLaunch', x)} />
        <Chooser label="Open in" does="The mode that comes forward after a launch." value={strOf(p.v, 'openIn') ?? ''} options={withCurrent(OPEN_IN, strOf(p.v, 'openIn'))} onChange={x => p.set('openIn', x)} />
      </Section>
      <Section label="Day" grow>
        {toggle(p, 'sendToDay', 'Send to Day', 'Send the work of this workspace to the Day, the Main track.')}
        <Readout big label="open" does="Documents open in panes." value={openCount(p.v)} tone="accent" />
        <Readout label="edited" does="Clips edited since save." value={editedCount(p.v)} tone="value" />
      </Section>
    </Band>
  </Panel>,

  full: p => <WorkspaceBody p={p} />,

  widget: p => <Tile title={shown(p.v, 'name')} light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The workspace" does="The five modes and the panes of the open one. Click a mode to open it.">
      <Mini v={p.v} set={p.set} />
    </Display>
    <div className="ref-tile-side">
      <Readout big label="open" does="Documents open in panes." value={openCount(p.v)} tone="accent" onPress={p.nav.full} />
      <Readout label="edited" does="Clips edited since save." value={editedCount(p.v)} tone="value" />
      <Action label="Launch" does={LAUNCH_DOES} onPress={launch(p)} />
    </div>
  </Tile>,
}

// ---------------------------------------------------------------- the pane: the clips, and the set that each mode opens with

const SAID_ROW: Readonly<Record<ModeState, string>> = {
  returns: 'Its panes return at launch.', kept: 'Its panes are kept but do not return at launch.',
  none: 'Nothing of this mode is kept.', unknown: 'What a launch restores of this mode is not reported.',
}
const STATE_WORD: Readonly<Record<ModeState, string>> = {returns: 'returns', kept: 'kept', none: 'not kept', unknown: NONE}

function WorkspaceBody({p}: {p: ViewProps}) {
  const v = p.v, clips = clipsOf(v), trees = treesOf(v), sets = setsOf(v), fresh = boolOf(v, 'fresh') === true, selected = strOf(v, 'clip'), mode = strOf(v, 'mode')
  return <div className="cws">
    <header className="cws-head">
      <h3>{shown(v, 'name')}</h3>
      <span>{kindLabel(v)} · {folderLabel(v)} · here {shown(v, 'visited')}</span>
    </header>
    <section aria-label="Clips">
      <h4>Clips <small>{clips ? clips.length : NONE}</small></h4>
      {clips === undefined ? <p className="cws-empty">No reading of the clips.</p>
        : clips.length === 0 ? <p className="cws-empty">No clips yet. Drag a folder from the browser onto this track.</p>
        : <ul className="cws-list">{clips.map((c, i) => <li key={`${c.id}:${i}`} data-selected={c.id === selected ? 'true' : undefined}>
          <button type="button" className="cws-row" data-i={`${c.name ?? NONE}|Opens this document in a pane.`} onClick={() => p.set('clip', c.id)}>
            <Lamp state={c.state === undefined || c.state === 'draft' ? 'unknown' : 'lit'} tone={c.state === 'saved' ? 'green' : 'accent'} label={c.state ? STATES[c.state] : 'No reading'} />
            <b>{c.name ?? NONE}</b><span className="cws-path">{c.path ?? NONE}</span><span>{c.kind ?? NONE}</span>
            <span className="cws-state" data-state={c.state}>{c.state ? STATES[c.state] : NONE}</span>
            <span className="cws-open">{c.open === true ? 'open' : c.open === false ? '' : NONE}</span>
          </button>
        </li>)}</ul>}
    </section>
    <section aria-label="Modes">
      <h4>Modes <small>what each opens with</small></h4>
      <ul className="cws-list">{MODES.map(m => {
        const state = modeState(v, m.id), tree = trees?.get(m.id)
        return <li key={m.id} data-selected={m.id === mode ? 'true' : undefined}>
          <div className="cws-row" data-i={`${m.name}|${SAID_ROW[state]}`}>
            <Lamp state={state === 'returns' ? 'lit' : state === 'none' ? 'dark' : 'unknown'} label={state === 'unknown' ? 'No reading' : STATE_WORD[state]} />
            <b>{m.name}</b><span className="cws-path">{fresh ? 'curated default' : !trees ? NONE : tree ? paneText(groupsIn(tree)) : 'curated default'}</span>
            <span>{(!fresh && sets?.get(m.id)) || NONE}</span><span className="cws-state">{STATE_WORD[state]}</span>
            <span className="cws-open">{m.id === mode ? 'open' : ''}</span>
          </div>
        </li>
      })}</ul>
    </section>
  </div>
}
