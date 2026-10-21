// The Workspace (manual §18.1): the track of one project, book or practice, and what it remembers for each mode. Live's nearest:
// Hybrid Reverb or Simpler's pages — a device of choosers and switches round one picture; it has no smooth quantity, so no dials.
// The picture is the workspace book's own memory (desktop/cradle/src/workspace/store.ts): the open mode's pane tree — splits
// with weights, tab groups with pinned tabs (surface/types.ts Pane) — the side regions, the widget rail, and a mark on each mode
// that keeps a tree of its own (`modeLayouts`). The strip is the five modes (workspace/mode.ts WORKSPACE_MODES); the handle on its
// track sets which mode a launch opens in. The material is the owner's, carried on value keys as JSON strings: `trees` (the pane
// tree of each mode), `sets` (the set each mode opens with), `clips` (the files of the project, with the three states that the
// draft store keeps: workspace/drafts.ts HeldDraft, content against saved_content) and `folders` (the projects of Work). Its sample
// content (Archetypal-Earth) sits in `defaults`. A key the owner does not report draws "—", and the well says which reading is missing.
//
// Two more pages hold the world's own ground, which the track's settings stand on. Ground is what Central makes of the folder you
// dropped on an empty track: Central's inspection (`projectcentral.inspect`: outcome already_conformant | bind_existing_wiki_in_place |
// create_project_central | unresolved_human_decision_required, its reason, the wiki candidates and the native signals), the treatment you
// choose, its preview (`projectcentral.init` with preview, `projectcentral.adopt.preview`, `projectcentral.migrate.preview`: the mutation
// plan's operations) and Accept (`projectcentral.init`, `adopt` or `migrate`). Self is the world's account of itself and the returns people
// wrote (`projectcentral.self.inspect`, central.development-field-reading/v1: the aperture, the six tier bindings, the UX sources and the EX
// returns), with Ensure (`projectcentral.self.ensure`) and Relate (`projectcentral.self.tier.relate` or `retain-tier` for a tier,
// `ux.relate` for an intended experience, `ex.relate` for a return, which only a person can make). Every one is reached by the kernel's
// invoke_action; Accept and Relate carry the person's authority, which that route does not yet carry (ticket §1.1).
//   pc       {outcome, reason, candidates: [{source, space}], signals: [{kind, path}], errors}  the inspection
//   pcPlan   {treatment, operations, source?, target?, preserves}  the preview, for the treatment and source it was asked with
//   self     {aperture: {exists, status}, tiers: [{tier, label?, source}], ux: [{ref, source}], ex: [{ref, source, ux}], unbound: [{source, hints}]}
// Settings: treatment ('create' | 'adopt' | 'migrate'), pcSource (the wiki), bindAs ('0'…'5' | 'ux' | 'ex'), selfSource (the source to bind).
// Acts: pcPreview, pcAccept (JSON {treatment, source?}), selfEnsure, selfRelate (JSON {as, source}).
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
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
/** The head light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not. */
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

// ---------------------------------------------------------------- Ground: the world's ProjectCentral, previewed before it is made

type Outcome = 'already_conformant' | 'bind_existing_wiki_in_place' | 'create_project_central' | 'migrate_selected_material' | 'unresolved_human_decision_required'
type Treatment = 'create' | 'adopt' | 'migrate'
interface Inspection {readonly outcome: Outcome; readonly reason?: string; readonly candidates: readonly {source: string; space?: string}[]; readonly signals: readonly {kind: string; path: string}[]; readonly errors: readonly string[]}
interface Plan {readonly treatment: Treatment; readonly operations: readonly string[]; readonly source?: string; readonly target?: string; readonly preserves?: boolean}
const OUTCOMES: readonly string[] = ['already_conformant', 'bind_existing_wiki_in_place', 'create_project_central', 'migrate_selected_material', 'unresolved_human_decision_required']
const OUTCOME_WORD: Readonly<Record<Outcome, string>> = {already_conformant: 'in place', bind_existing_wiki_in_place: 'a wiki to keep', create_project_central: 'to create',
  migrate_selected_material: 'to copy in', unresolved_human_decision_required: 'your decision'}
const PC_PARTS = ['user', 'governance', 'wiki'] as const
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const txt = (x: unknown) => (typeof x === 'string' && x !== '' ? x : undefined)

/** Central's inspection of the world's folder (`projectcentral.inspect`), or undefined when it reports none. */
function inspectionOf(v: V): Inspection | undefined {
  const raw = json<unknown>(v, 'pc', undefined)
  if (!isRec(raw) || !OUTCOMES.includes(raw.outcome as string)) return undefined
  const candidates = (Array.isArray(raw.candidates) ? raw.candidates : []).flatMap(c => (isRec(c) && txt(c.source) ? [{source: c.source as string, space: txt(c.space)}] : []))
  const signals = (Array.isArray(raw.signals) ? raw.signals : []).flatMap(s => (isRec(s) && txt(s.kind) && txt(s.path) ? [{kind: s.kind as string, path: s.path as string}] : []))
  return {outcome: raw.outcome as Outcome, reason: txt(raw.reason), candidates, signals, errors: Array.isArray(raw.errors) ? raw.errors.filter((e): e is string => typeof e === 'string') : []}
}
function planOf(v: V): Plan | undefined {
  const raw = json<unknown>(v, 'pcPlan', undefined)
  if (!isRec(raw) || (raw.treatment !== 'create' && raw.treatment !== 'adopt' && raw.treatment !== 'migrate')) return undefined
  return {treatment: raw.treatment, operations: Array.isArray(raw.operations) ? raw.operations.filter((o): o is string => typeof o === 'string') : [], source: txt(raw.source), target: txt(raw.target), preserves: raw.preserves === true}
}
/** The treatment the person chose, else the one the inspection points to. */
function treatmentOf(v: V, pc: Inspection | undefined): Treatment | undefined {
  const t = strOf(v, 'treatment')
  if (t === 'create' || t === 'adopt' || t === 'migrate') return t
  return pc?.outcome === 'create_project_central' ? 'create' : pc?.candidates.length ? 'adopt' : undefined
}
/** Why a treatment cannot be chosen for this folder; undefined when it can. */
function treatmentWhy(pc: Inspection | undefined, t: Treatment): string | undefined {
  if (!pc) return 'No reading of the folder.'
  if (pc.outcome === 'already_conformant') return 'The world\'s ground is already in place.'
  if (pc.errors.length) return 'Its ProjectCentral is present but unreadable: mend it by hand. Central will not guess.'
  if (t === 'create') return pc.candidates.length ? 'The folder holds a wiki: keep it in place, or copy it in.' : undefined
  return pc.candidates.length ? undefined : 'The folder holds no wiki to keep or copy.'
}
const pcSource = (v: V, pc: Inspection | undefined) => strOf(v, 'pcSource') ?? (pc?.candidates.length === 1 ? pc.candidates[0]!.source : undefined)
const TREATMENTS = [{value: 'create', label: 'Create', does: 'Make ProjectCentral around the folder. Nothing native moves.'},
  {value: 'adopt', label: 'Keep in place', does: 'Keep the folder\'s wiki where it is, as a source of the new Project wiki.'},
  {value: 'migrate', label: 'Copy in', does: 'Copy the folder\'s wiki into ProjectCentral. The original stays where it is.'}] as const

/** The world's folder: its native material at the left (a README, docs, design, a wiki), ProjectCentral at the right, its three parts
 * dashed where they would be made. A line runs from the folder's wiki to the Project wiki: dotted where it stays in place, an arrow where it is
 * copied in. */
function GroundWell({v, w, h}: {v: V; w: number; h: number}) {
  const pc = inspectionOf(v), t = treatmentOf(v, pc), src = pcSource(v, pc), folder = strOf(v, 'folder')
  if (!pc) return <Display w={w} h={h} label="Ground" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the folder</text></Display>
  const made = pc.outcome === 'already_conformant', bx = w / 2 + 4, rows = (i: number) => 38 + i * 22
  const native = [...pc.signals.filter(s => s.kind !== 'wiki').slice(0, 3).map(s => ({label: s.path, wiki: false})), ...pc.candidates.slice(0, 2).map(c => ({label: c.source, wiki: true}))]
  const wikiY = (s: string | undefined) => { const i = native.findIndex(n => n.wiki && n.label === s); return i < 0 ? undefined : rows(i) }
  const from = wikiY(src), toY = rows(2)
  return <Display w={w} h={h} label="Ground" corner={OUTCOME_WORD[pc.outcome]}
    does="The folder's own material at the left, ProjectCentral at the right, its parts dashed where they would be made. Dotted: the wiki stays in place and joins. Arrow: the wiki is copied in.">
    <rect x={3.5} y={16.5} width={w - 7} height={h - 22} fill="none" className="dp-faint" />
    <text x={8} y={12} className="dp-axis">{folder ? cut(folder, 22) : NONE}</text>
    {native.map((n, i) => <g key={n.label} data-i={`${n.label}|${n.wiki ? 'A wiki of the folder.' : 'Native material. It does not move.'}`}>
      <rect x={10} y={rows(i) - 6} width={10} height={12} fill={n.wiki ? 'var(--dp-value)' : 'none'} stroke={n.wiki ? 'var(--dp-value)' : 'var(--text-dim)'} opacity={n.wiki && n.label !== src && pc.candidates.length > 1 ? .45 : 1} />
      <text x={25} y={rows(i) + 3} className={n.wiki ? 'dp-ink' : 'dp-ink-dim'}>{cut(n.label, 10)}</text>
    </g>)}
    {!native.length && <text x={10} y={rows(0) + 3} className="dp-ink-dim">Nothing native</text>}
    <rect x={bx} y={24} width={w - bx - 10} height={h - 38} fill="none" stroke={made ? 'var(--dp-value)' : 'var(--text-dim)'} strokeDasharray={made ? undefined : '3 2'} />
    <text x={bx + 4} y={33} className="dp-axis">ProjectCentral</text>
    {PC_PARTS.map((part, i) => <g key={part}>
      <rect x={bx + 6} y={rows(i) + 2} width={8} height={8} fill={made ? 'var(--dp-value)' : 'none'} stroke="var(--dp-value)" strokeDasharray={made ? undefined : '2 1.5'} />
      <text x={bx + 18} y={rows(i) + 9} className={made ? 'dp-ink' : 'dp-ink-dim'}>{part === 'wiki' && !made && from !== undefined && (t === 'adopt' || t === 'migrate') ? `wiki · ${t === 'adopt' ? 'in place' : 'copy'}` : part}</text>
    </g>)}
    {!made && from !== undefined && (t === 'adopt' || t === 'migrate') && <g>
      <path d={`M82 ${from}C${bx - 8} ${from} ${bx - 14} ${toY + 6} ${bx + 4} ${toY + 6}`} fill="none" stroke="var(--dp-on)" strokeWidth={1.3} strokeDasharray={t === 'adopt' ? '1.5 2.5' : undefined} />
      {t === 'migrate' && <path d={`M${bx + 4} ${toY + 6}l-6 -3.5v7z`} fill="var(--dp-on)" />}
    </g>}
    {pc.outcome === 'unresolved_human_decision_required' && <text x={w / 2} y={h - 8} className="dp-axis" textAnchor="middle" style={{fill: 'var(--stall)'}}>{pc.errors.length ? 'unreadable manifest' : `${pc.candidates.length} wikis: choose one`}</text>}
  </Display>
}

function groundRows(v: V): RowItem[] {
  const pc = inspectionOf(v), plan = planOf(v), t = treatmentOf(v, pc)
  if (!pc) return [{id: 'none', name: 'No reading of the folder', light: 'unknown'}]
  if (pc.outcome === 'already_conformant') return [{id: 'ok', name: pc.reason ?? 'The world\'s ground is in place.', light: 'lit', tone: 'green'}]
  if (plan && plan.treatment === t) return plan.operations.map((o, i) => ({id: `op${i}`, name: o, light: 'lit', tone: 'accent', note: `${i + 1}`}))
  return [{id: 'reason', name: pc.reason ?? NONE, light: 'dark', note: 'preview first'}, ...pc.errors.map((e, i) => ({id: `e${i}`, name: e, light: 'dark' as LightState, tone: 'stall' as const, note: 'manifest'}))]
}

function GroundBands({p}: {p: ViewProps}) {
  const pc = inspectionOf(p.v), plan = planOf(p.v), t = treatmentOf(p.v, pc), src = pcSource(p.v, pc), [page, setPage] = useState(0)
  const blocked = t ? treatmentWhy(pc, t) : 'No reading of the folder.', needsSource = t === 'adopt' || t === 'migrate'
  const value = JSON.stringify({treatment: t, ...(needsSource ? {source: src} : {})}), previewed = !!plan && plan.treatment === t && (!needsSource || plan.source === src)
  return <>
    <Band>
      <Section width={206}><GroundWell v={p.v} w={194} h={146} /></Section>
      <Section label="Treatment" width={104}>
        <Radio {...st(p, 'treatment')} label="Make" does="How the world gets its ground: made around the folder, or with the folder's wiki kept in place or copied in." value={t ?? ''} stack
          options={TREATMENTS.map(o => ({...o, why: treatmentWhy(pc, o.value)}))} onChange={x => { p.set('treatment', x); p.set('pcPlan', undefined) }} />
        <Chooser {...st(p, 'pcSource')} label="Wiki" wide does="The folder's wiki to keep in place or copy in." value={src ?? ''} options={(pc?.candidates ?? []).map(c => ({value: c.source, label: c.source}))}
          onChange={x => { p.set('pcSource', x); p.set('pcPlan', undefined) }} disabled={st(p, 'pcSource').disabled ?? (needsSource ? (pc?.candidates.length ? undefined : 'The folder holds no wiki.') : 'Create needs no wiki.')} />
      </Section>
      <Section label="Accept" grow>
        <Readout label="found" does="What Central found in the folder." value={pc ? OUTCOME_WORD[pc.outcome] : undefined} tone={pc?.outcome === 'unresolved_human_decision_required' ? 'stall' : 'value'} />
        {previewed
          ? <div className="ref-pair">
              <Action {...st(p, 'pcAccept')} hold label="Accept" does="Make the world's ground as previewed. Native files do not move; a wiki kept in place stays where it is." onPress={() => p.set('pcAccept', value)} />
              <Action label="Cancel" does="Leave the folder as it is." onPress={() => p.set('pcPlan', undefined)} />
            </div>
          : <Action {...st(p, 'pcPreview')} label="Preview" does="Show every step Central would take. Nothing changes." onPress={!blocked && (!needsSource || src) ? () => p.set('pcPreview', value) : undefined}
              disabled={st(p, 'pcPreview').disabled ?? blocked ?? (needsSource && !src ? 'Choose the wiki first.' : undefined)} />}
        <Readout label="original" does="Whether the folder's own wiki stays where it is." value={plan && previewed ? (plan.preserves ? 'kept' : 'moved') : undefined} tone={plan?.preserves ? 'green' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={previewed ? `The preview · ${plan!.operations.length} steps` : pc ? `The folder · ${pc.signals.length} native signs, ${pc.candidates.length} wiki${pc.candidates.length === 1 ? '' : 's'}` : 'The folder'}
        does="Before a preview, what Central found. After one, every step it would take, in order." items={groundRows(p.v)} size={7} page={page} onPage={setPage} /></Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- Self: the world's account of itself, and what people returned

interface TierBinding {readonly tier: number; readonly label?: string; readonly source?: string}
interface Ux {readonly ref: string; readonly source: string}
interface Ex {readonly ref: string; readonly source: string; readonly ux: readonly string[]}
interface SelfReading {readonly exists?: boolean; readonly status?: string; readonly tiers: readonly TierBinding[]; readonly ux: readonly Ux[]; readonly ex: readonly Ex[]; readonly unbound: readonly {source: string; hints: readonly string[]}[]}
const TIERS = [0, 1, 2, 3, 4, 5] as const
function selfOf(v: V): SelfReading | undefined {
  const raw = json<unknown>(v, 'self', undefined)
  if (!isRec(raw)) return undefined
  const ap = isRec(raw.aperture) ? raw.aperture : {}
  const list = (x: unknown) => (Array.isArray(x) ? x.filter(isRec) : [])
  return {exists: typeof ap.exists === 'boolean' ? ap.exists : undefined, status: txt(ap.status),
    tiers: list(raw.tiers).flatMap(t => (typeof t.tier === 'number' && t.tier >= 0 && t.tier <= 5 ? [{tier: t.tier, label: txt(t.label), source: txt(t.source)}] : [])),
    ux: list(raw.ux).flatMap(u => (txt(u.ref) && txt(u.source) ? [{ref: u.ref as string, source: u.source as string}] : [])),
    ex: list(raw.ex).flatMap(e => (txt(e.ref) && txt(e.source) ? [{ref: e.ref as string, source: e.source as string, ux: Array.isArray(e.ux) ? e.ux.filter((x): x is string => typeof x === 'string') : []}] : [])),
    unbound: list(raw.unbound).flatMap(u => (txt(u.source) ? [{source: u.source as string, hints: Array.isArray(u.hints) ? u.hints.filter((x): x is string => typeof x === 'string') : []}] : []))}
}
const boundTier = (s: SelfReading, tier: number) => s.tiers.find(t => t.tier === tier && t.source)
const nextEmpty = (s: SelfReading, after = -1) => TIERS.find(t => t > after && !boundTier(s, t)) ?? TIERS.find(t => !boundTier(s, t))
const tail = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const BIND_AS = [...TIERS.map(t => ({value: String(t), label: `Tier ${t}`, does: `Bind the source as tier ${t} of the world's account.`})),
  {value: 'ux', label: 'Intended experience', does: 'Bind a source you wrote or adopted as an experience the world means to give.'},
  {value: 'ex', label: 'Return', does: 'Bind your own report of what an experience was like, against the experience it answers. Only a person can bind a return.'}]

/** The world's account: six tiers from 0 at the foot to 5 at the head, filled where a source is bound and named by it, dashed where none is;
 * the tier Bind as points at is ringed. At the right, the experiences the world means to give, and the returns people wrote against them. */
function SelfWell({v, w, h}: {v: V; w: number; h: number}) {
  const s = selfOf(v), at = strOf(v, 'bindAs')
  if (!s) return <Display w={w} h={h} label="Self" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the world's self</text></Display>
  const y = (tier: number) => h - 20 - tier * 20, x0 = 18, x1 = 120, ux = 146, ex = 178
  const bound = TIERS.filter(t => boundTier(s, t)).length
  return <Display w={w} h={h} label="Self" corner={s.exists === false ? 'no self yet' : `${bound} of 6 tiers`}
    does="Six tiers of the world's account, 0 at the foot. Filled: a source is bound, and named. Dashed: none yet. At the right, the experiences the world means to give and the returns written against them.">
    {TIERS.map(t => { const b = boundTier(s, t), chosen = at === String(t); return <g key={t} data-i={`Tier ${t}|${b ? `${b.label ? `${b.label}: ` : ''}${b.source}` : 'No source is bound to this tier yet.'}`}>
      <text x={6} y={y(t) + 3} className="dp-axis">{t}</text>
      <rect x={x0} y={y(t) - 6} width={x1 - x0} height={12} fill={b ? 'color-mix(in srgb, var(--dp-value) 30%, transparent)' : 'none'} stroke={b ? 'var(--dp-value)' : 'var(--text-faint)'} strokeDasharray={b ? undefined : '2 2'} />
      {b && <text x={x0 + 4} y={y(t) + 3} className="dp-ink">{cut(b.label ?? tail(b.source!), 17)}</text>}
      {chosen && <rect x={x0 - 2.5} y={y(t) - 8.5} width={x1 - x0 + 5} height={17} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
    </g> })}
    <text x={ux} y={h - 4} className="dp-axis" textAnchor="middle">UX</text><text x={ex} y={h - 4} className="dp-axis" textAnchor="middle">EX</text>
    {s.ux.slice(0, 5).map((u, i) => { const yy = 40 + i * 20; return <g key={u.ref} data-i={`${u.ref}|${u.source}: an experience the world means to give.`}>
      <circle cx={ux} cy={yy} r={4.5} fill={at === 'ux' ? 'var(--dp-on)' : 'var(--dp-value)'} />
      {s.ex.filter(e => e.ux.includes(u.ref)).slice(0, 3).map((e, k) => <g key={e.ref} data-i={`${e.ref}|${e.source}: a return written against ${u.ref}.`}>
        <path d={`M${ux + 5} ${yy}L${ex - 4} ${yy + (k - 1) * 6}`} stroke="var(--dp-value)" opacity={.6} />
        <rect x={ex - 3.5} y={yy + (k - 1) * 6 - 3.5} width={7} height={7} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />
      </g>)}
    </g> })}
    {!s.ux.length && <text x={(ux + ex) / 2} y={44} className="dp-axis" textAnchor="middle">none</text>}
  </Display>
}

function selfRows(v: V): RowItem[] {
  const s = selfOf(v)
  if (!s) return [{id: 'none', name: 'No reading of the world\'s self', light: 'unknown'}]
  return [
    ...TIERS.map(t => { const b = boundTier(s, t); return {id: `t${t}`, name: b ? (b.label ? `${b.label} · ${b.source}` : b.source!) : 'No source yet', light: (b ? 'lit' : 'dark') as LightState, tone: 'value' as const, note: `tier ${t}`} }),
    ...s.ux.map(u => ({id: `u:${u.ref}`, name: u.source, light: 'lit' as LightState, tone: 'value' as const, note: u.ref})),
    ...s.ex.map(e => ({id: `e:${e.ref}`, name: e.source, light: 'lit' as LightState, tone: 'accent' as const, note: `return · ${e.ux.join(', ') || NONE}`})),
    ...s.unbound.map(u => ({id: `c:${u.source}`, name: u.source, light: 'dark' as LightState, tone: 'stall' as const, note: u.hints.length ? u.hints.join(', ') : 'not bound', does: 'A source of the world no tier holds yet. Choose it, then Relate.'})),
  ]
}

function SelfBands({p}: {p: ViewProps}) {
  const s = selfOf(p.v), at = strOf(p.v, 'bindAs'), src = strOf(p.v, 'selfSource'), [page, setPage] = useState(0)
  const candidates = s ? [...s.unbound.map(u => u.source)] : []
  const why = !s ? 'No reading of the world\'s self.' : s.exists === false ? 'The world has no self yet: Ensure it first.' : !at ? 'Choose what to bind it as.' : !src ? 'Choose a source.'
    : at === 'ex' && !s.ux.length ? 'A return answers an intended experience: bind one first.' : undefined
  return <>
    <Band>
      <Section width={206}><SelfWell v={p.v} w={194} h={146} /></Section>
      <Section label="Self" width={104}>
        <Readout label="self" does="Whether the world has its ProjectCentral/self: where its account of itself is written." value={s ? (s.exists ? 'present' : 'none yet') : undefined} tone={s?.exists ? 'green' : 'stall'} />
        <Action {...st(p, 'selfEnsure')} label="Ensure" does="Add ProjectCentral/self where it is missing. Native documents, the wiki and the NOW field stay where they are."
          onPress={s && s.exists === false ? () => p.set('selfEnsure', true) : undefined} disabled={st(p, 'selfEnsure').disabled ?? (s?.exists ? 'The world has its self.' : undefined)} />
        <Readout label="returns" does="Returns people wrote against the world's intended experiences." value={s?.ex.length} tone="accent" />
      </Section>
      <Section label="Bind" grow>
        <Chooser {...st(p, 'bindAs')} label="As" wide does="What the source becomes: one tier of the world's account, an intended experience, or a return against one." value={at ?? ''} options={BIND_AS} onChange={x => p.set('bindAs', x)} />
        <Chooser {...st(p, 'selfSource')} label="Source" wide does="A source of the world that is not bound yet." value={src ?? ''} options={candidates.map(c => ({value: c, label: tail(c)}))} onChange={x => p.set('selfSource', x)} />
        <div className="ref-pair">
          <Action {...st(p, 'selfRelate')} hold label="Relate" does="Bind the source as chosen. Its bytes and its path stay; its standing is recorded." onPress={!why ? () => p.set('selfRelate', JSON.stringify({as: at, source: src})) : undefined}
            disabled={st(p, 'selfRelate').disabled ?? why} />
          <Action label="Next" does="Point As at the next tier that has no source yet." onPress={s ? () => { const n = nextEmpty(s, at === undefined || isNaN(Number(at)) ? -1 : Number(at)); if (n !== undefined) p.set('bindAs', String(n)) } : undefined}
            disabled={s && TIERS.every(t => boundTier(s, t)) ? 'Every tier has a source.' : undefined} />
        </div>
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={s ? `The account · ${TIERS.filter(t => boundTier(s, t)).length} of 6 tiers, ${s.ux.length} experience${s.ux.length === 1 ? '' : 's'}, ${s.ex.length} return${s.ex.length === 1 ? '' : 's'}, ${s.unbound.length} unbound` : 'The account'}
        does="The six tiers, the intended experiences, the returns, then the sources no tier holds yet. Select an unbound source to bind it." items={selfRows(p.v)} size={14} columns={2} page={page} onPage={setPage}
        selected={src ? `c:${src}` : undefined} onSelect={id => { if (id.startsWith('c:')) p.set('selfSource', id.slice(2)) }} /></Section>
    </Band>
  </>
}

type PageId = 'workspace' | 'ground' | 'self'
const PAGE_IDS: readonly {id: PageId; label: string}[] = [{id: 'workspace', label: 'Track'}, {id: 'ground', label: 'Ground'}, {id: 'self', label: 'Self'}]
const pageOf = (p: ViewProps): PageId => (p.page === 'ground' || p.page === 'self' ? p.page : 'workspace')
function pageLight(v: V, id: PageId): LightState | undefined {
  if (id === 'ground') { const pc = inspectionOf(v); return pc ? (pc.outcome === 'already_conformant' ? 'lit' : 'dark') : undefined }
  if (id === 'self') { const s = selfOf(v); return s ? (s.exists && TIERS.every(t => boundTier(s, t)) ? 'lit' : 'dark') : undefined }
  return undefined
}

/** Full's Ground tab: what Central found in the folder, and the preview's steps in order. */
function GroundDoc({v}: {v: V}) {
  const pc = inspectionOf(v), plan = planOf(v), t = treatmentOf(v, pc)
  return <div className="ref-doc cws-doc">
    <h3>Ground <small>{shown(v, 'folder')} · {pc ? OUTCOME_WORD[pc.outcome] : 'no reading'}</small></h3>
    {!pc ? <p className="ref-doc-lead">No reading of the folder.</p> : <>
      <p className="ref-doc-lead">{pc.reason ?? NONE}</p>
      <ol className="ref-doc-list">
        {pc.signals.map(s => <li key={s.path}><span className="dp-lamp" data-light="lit" data-tone="value" /><b>{s.path}</b><span className="ref-doc-rev">{s.kind}</span><p>Native material. It stays where it is.</p></li>)}
        {pc.candidates.map(c => <li key={c.source}><span className="dp-lamp" data-light="lit" data-tone="accent" /><b>{c.source}</b><span className="ref-doc-rev">wiki</span><p>{c.space ?? NONE}</p></li>)}
        {pc.errors.map((e, i) => <li key={`e${i}`}><span className="dp-lamp" data-light="dark" data-tone="stall" /><b>Manifest</b><span className="ref-doc-rev">unreadable</span><p>{e}</p></li>)}
      </ol>
      <section className="ref-doc-kind"><h4>The preview</h4>
        {plan && plan.treatment === t ? <ol className="ref-doc-steps">{plan.operations.map((o, i) => <li key={i}>{o}</li>)}</ol>
          : <p className="ref-doc-lead">{pc.outcome === 'already_conformant' ? 'Nothing to make: the world\'s ground is in place.' : 'No preview yet. Choose how to make it in Device view and press Preview.'}</p>}
      </section>
    </>}
  </div>
}

/** Full's Self tab: the account tier by tier, the intended experiences with the returns written against each, and the sources unbound. */
function SelfDoc({v}: {v: V}) {
  const s = selfOf(v)
  return <div className="ref-doc cws-doc">
    <h3>Self <small>{shown(v, 'name')} · {s ? (s.exists ? `${TIERS.filter(t => boundTier(s, t)).length} of 6 tiers bound` : 'no self yet') : 'no reading'}</small></h3>
    {!s ? <p className="ref-doc-lead">No reading of the world's self.</p> : <>
      <ol className="ref-doc-list">{TIERS.map(t => { const b = boundTier(s, t); return <li key={t} data-dim={b ? undefined : 'true'}>
        <span className="dp-lamp" data-light={b ? 'lit' : 'dark'} data-tone="value" /><b>Tier {t}</b><span className="ref-doc-rev">{b?.label ?? ''}</span><p>{b?.source ?? 'No source yet.'}</p>
      </li> })}</ol>
      <section className="ref-doc-kind"><h4>Intended experiences, and the returns against them</h4>
        {!s.ux.length ? <p className="ref-doc-lead">No intended experience is bound yet.</p>
          : <ol className="ref-doc-list">{s.ux.map(u => { const r = s.ex.filter(e => e.ux.includes(u.ref)); return <li key={u.ref}>
            <span className="dp-lamp" data-light="lit" data-tone="value" /><b>{u.ref}</b><span className="ref-doc-rev">{r.length} return{r.length === 1 ? '' : 's'}</span>
            <span className="ref-doc-standing">{u.source}</span><p>{r.length ? r.map(e => e.source).join(' · ') : 'Nobody has written a return against it yet.'}</p>
          </li> })}</ol>}
      </section>
      {s.unbound.length > 0 && <section className="ref-doc-kind"><h4>Sources no tier holds yet</h4>
        <ol className="ref-doc-list">{s.unbound.map(u => <li key={u.source} data-dim="true"><span className="dp-lamp" data-light="dark" data-tone="stall" /><b>{u.source}</b><span className="ref-doc-rev">{u.hints.join(', ') || NONE}</span></li>)}</ol>
      </section>}
    </>}
  </div>
}

// Samples. Archetypal-Earth's ground is in place (`projectcentral.inspect`); a folder dropped from elsewhere shows each outcome Central gives.
const PC_IN_PLACE = {outcome: 'already_conformant', reason: 'ProjectCentral human-source and Agent-Wiki fractal is present and readable.',
  candidates: [{source: 'ProjectCentral/agents/wiki/wiki.json', space: 'central:wiki:project:Archetypal-Earth'}], signals: [{kind: 'readme', path: 'README.md'}, {kind: 'docs', path: 'docs'}], errors: []}
const PC_ADOPT = {outcome: 'bind_existing_wiki_in_place', reason: 'One compatible OKF Wiki source was found; it can remain in place as a participating source while ProjectCentral receives its canonical Agent Wiki.',
  candidates: [{source: 'wiki/wiki.json', space: 'central:wiki:project:Palace'}], signals: [{kind: 'readme', path: 'README.md'}, {kind: 'docs', path: 'docs'}, {kind: 'design', path: 'design'}, {kind: 'wiki', path: 'wiki'}], errors: []}
const PLAN_ADOPT = {treatment: 'adopt', source: 'wiki/wiki.json', target: 'ProjectCentral/agents/wiki/wiki.json', preserves: true, operations: [
  'create ProjectCentral/user and ProjectCentral/agents/{governance,wiki}', 'create canonical ProjectCentral Agent Wiki', 'retain adopted Wiki source in place: wiki/wiki.json',
  'record the in-place source as a participating Wiki source', 'federate the canonical Project WikiSpace from the Central root']}
const PC_CREATE = {outcome: 'create_project_central', reason: 'No compatible OKF Wiki source was found; the canonical human-source/Agent-Wiki fractal can be created around the native Project.',
  candidates: [], signals: [{kind: 'readme', path: 'README.md'}, {kind: 'docs', path: 'docs'}], errors: []}
const PC_TWO = {outcome: 'unresolved_human_decision_required', reason: 'Multiple compatible Wiki sources were found; Central will not guess which one should participate as the adopted source.',
  candidates: [{source: 'wiki/wiki.json', space: 'central:wiki:project:Palace'}, {source: 'notes/.okf/wiki.json', space: 'central:wiki:project:Palace-notes'}], signals: [{kind: 'readme', path: 'README.md'}, {kind: 'wiki', path: 'wiki'}], errors: []}
// Archetypal-Earth's account as it is being written: two tiers bound, the walks it means to give, and one return against them.
const SELF = {aperture: {exists: true, status: 'present'},
  tiers: [{tier: 1, source: 'docs/SPEC.md'}, {tier: 4, source: 'AGENTS.md'}],
  ux: [{ref: 'ux:walks', source: 'docs/SPEC.md#walks'}, {ref: 'ux:lenses', source: 'docs/SPEC.md#lenses'}],
  ex: [{ref: 'ex:walk-2026-10-12', source: 'ProjectCentral/user/returns/walk-2026-10-12.md', ux: ['ux:walks']}],
  unbound: [{source: 'README.md', hints: ['readme']}, {source: 'curation/plates.md', hints: ['design']}, {source: 'ephemeris/README.md', hints: ['architecture']}]}

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
    // Ground and Self: Central's inspection of the folder (`projectcentral.inspect`) with any preview, and the world's account of itself.
    pc: JSON.stringify(PC_IN_PLACE), self: JSON.stringify(SELF), bindAs: '0',
  },
  firstPage: 'workspace',
  fixtures: {
    'Archetypal Earth': {},
    'A new workspace': {name: 'New workspace', folder: 'central', fresh: true, mem: 'base', widgets: 2, visited: 'now', clips: '[]', trees: '{}', sets: '{}'},
    'Not launched': {light: 'dark', visited: '6 d ago', mode: 'techne'},
    'A folder dropped': {name: 'Palace', folder: 'Palace', fresh: true, mem: 'base', clips: '[]', trees: '{}', sets: '{}', pc: JSON.stringify(PC_ADOPT), pcPlan: JSON.stringify(PLAN_ADOPT), treatment: 'adopt',
      self: JSON.stringify({aperture: {exists: false, status: 'legacy-migratable-absence'}, tiers: [], ux: [], ex: [], unbound: [{source: 'README.md', hints: ['readme']}, {source: 'design/rooms.md', hints: ['design']}]})},
    'A plain folder': {name: 'Palace', folder: 'Palace', fresh: true, mem: 'base', clips: '[]', trees: '{}', sets: '{}', pc: JSON.stringify(PC_CREATE)},
    'Two wikis': {name: 'Palace', folder: 'Palace', fresh: true, mem: 'base', clips: '[]', trees: '{}', sets: '{}', pc: JSON.stringify(PC_TWO), treatment: 'adopt', pcSource: 'notes/.okf/wiki.json'},
    'No readings': Object.fromEntries(['light', 'name', 'kind', 'folder', 'place', 'keepPanes', 'keepInstruments', 'keepWidgets', 'keepSets', 'rememberIn', 'onLaunch',
      'openIn', 'keepWhen', 'sendToDay', 'mode', 'mem', 'fresh', 'dirty', 'widgets', 'visited', 'clip', 'folders', 'trees', 'sets', 'clips', 'pc', 'pcPlan', 'self', 'bindAs'].map(k => [k, undefined])),
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

  whole: p => <Panel title="Workspace" view="whole" {...head(p)} pages={PAGE_IDS.map(x => ({id: x.id, label: x.label, light: pageLight(p.v, x.id)}))} page={pageOf(p)} onPage={p.setPage}>
    {pageOf(p) === 'ground' ? <GroundBands p={p} /> : pageOf(p) === 'self' ? <SelfBands p={p} /> : <>
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
    </>}
  </Panel>,

  full: p => <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
      {PAGE_IDS.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === pageOf(p)} onClick={() => p.setPage(x.id)}>{x.id === 'workspace' ? 'Clips and modes' : x.label}</button>)}
    </div>
    <div className="cws-host">{pageOf(p) === 'ground' ? <GroundDoc v={p.v} /> : pageOf(p) === 'self' ? <SelfDoc v={p.v} /> : <WorkspaceBody p={p} />}</div>
  </div>,

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
