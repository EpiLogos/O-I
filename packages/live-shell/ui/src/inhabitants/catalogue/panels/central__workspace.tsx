// The Workspace (manual §18.2): the track of one project, book or practice, and what it remembers for each mode. Live's nearest:
// Hybrid Reverb or Simpler's pages — a device of choosers and switches round one picture; it has no smooth quantity, so no dials.
// The picture is the workspace book's own memory (desktop/cradle/src/workspace/store.ts): the open mode's pane tree — splits with
// weights, tab groups with pinned tabs (surface/types.ts Pane) — the side regions, the widget rail, and a mark on each mode that
// keeps a tree of its own (`modeLayouts`). The strip is the five modes (workspace/mode.ts WORKSPACE_MODES); the handle on its
// track sets which mode a launch opens in. The readings are one project of Work (Archetypal-Earth): its clips are real files
// of that project, with the three states that the draft store keeps (workspace/drafts.ts HeldDraft: content against saved_content).
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
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
const modeName = (id: string) => MODES.find(m => m.id === id)?.name ?? id

const KINDS = ['Project', 'Book', 'Practice', 'Other'].map(label => ({value: label.toLowerCase(), label}))
/** Central, or one project of Work (workspace/scope.ts: the workspace's `project`, absent for Central). */
const FOLDERS = [['central', 'Central'], ['Archetypal-Earth', 'Archetypal-Earth'], ['O-I', 'O-I'], ['face-rig', 'face-rig'], ['Workcell', 'Workcell'],
  ['ai-kit', 'ai-kit'], ['Quaternal-Logic', 'Quaternal-Logic']].map(([value, label]) => ({value: value!, label: label!}))
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

// ---------------------------------------------------------------- what the workspace book holds (readings)

interface Group { readonly t: 'g'; readonly tabs: number; readonly pinned?: number; readonly title: string; readonly focus?: boolean; readonly instrument?: boolean }
interface Split { readonly t: 's'; readonly dir: 'h' | 'v'; readonly w: readonly number[]; readonly kids: readonly Node[] }
type Node = Group | Split
/** The pane tree each mode keeps (`layout` for the open mode, `modeLayouts` for the others). A mode that is not here opens on its curated default. */
const TREES: Readonly<Record<string, Node>> = {
  base: {t: 's', dir: 'h', w: [3, 2], kids: [{t: 'g', tabs: 3, pinned: 1, title: 'SPEC.md', focus: true}, {t: 'g', tabs: 1, title: 'Earth', instrument: true}]},
  factory: {t: 'g', tabs: 2, title: 'Desk'},
  techne: {t: 's', dir: 'v', w: [1, 1], kids: [{t: 'g', tabs: 1, title: 'Reading', instrument: true}, {t: 'g', tabs: 2, title: 'Timeline', instrument: true}]},
  live: {t: 'g', tabs: 1, title: 'Torus', instrument: true},
}
/** The sets that the workspace saved, by mode (`sets`, each with its `mode`). */
const SETS: Readonly<Record<string, string>> = {base: 'Reading', factory: 'Run board'}

type ClipState = 'draft' | 'saved' | 'edited'
interface Clip { readonly id: string; readonly name: string; readonly path: string; readonly kind: string; readonly state: ClipState; readonly open: boolean }
/** The clips: files of the project and one page that has no file yet. */
const CLIPS: readonly Clip[] = [
  {id: 'spec', name: 'SPEC.md', path: 'docs', kind: 'File', state: 'saved', open: true},
  {id: 'day', name: '2026-10-12.md', path: 'ProjectCentral/now/day', kind: 'Day', state: 'edited', open: true},
  {id: 'project', name: 'project.json', path: 'ProjectCentral', kind: 'File', state: 'saved', open: false},
  {id: 'draft', name: 'Untitled', path: '', kind: 'Flow', state: 'draft', open: true},
]
const STATES: Readonly<Record<ClipState, string>> = {draft: 'Draft', saved: 'Saved', edited: 'Edited since save'}

const clipsOf = (v: V): readonly Clip[] => (on(v, 'fresh') ? [] : CLIPS)
const openCount = (v: V) => clipsOf(v).filter(c => c.open).length
const editedCount = (v: V) => clipsOf(v).filter(c => c.state === 'edited').length
const memOf = (v: V) => str(v, 'mem').split(',')
/** A mode's tree is kept: the workspace keeps panes, the mode has a tree of its own, and "Remember in" reaches it. */
const kept = (v: V, mode: string) => on(v, 'keepPanes') && memOf(v).includes(mode) && (str(v, 'rememberIn') === 'every' || mode === str(v, 'mode'))
/** A kept tree returns at launch: all modes return, or only the open one. */
const returns = (v: V, mode: string) => kept(v, mode) && (str(v, 'onLaunch') === 'all' || (str(v, 'onLaunch') === 'open' && mode === str(v, 'mode')))
const treeOf = (v: V): Node | null | undefined => {
  const mode = str(v, 'mode')
  if (on(v, 'fresh')) return mode === 'base' ? null : undefined
  return TREES[mode]
}
const groupsIn = (n: Node | null | undefined): number => (!n ? 0 : n.t === 'g' ? 1 : n.kids.reduce((a, k) => a + groupsIn(k), 0))
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const light = (v: V) => str(v, 'light') as LightState
const folderLabel = (v: V) => FOLDERS.find(f => f.value === str(v, 'folder'))?.label ?? str(v, 'folder')

// ---------------------------------------------------------------- the picture

const FAINT_FILL = 'color-mix(in srgb, var(--text, #d4d7da) 34%, transparent)'
const DASH = '3 3'

/** The panes of one mode: a split divides its box by its weights, a group is a box with a tick for each tab (a pinned tab filled). */
function Tree({node, x, y, w, h, instruments, titles}: {node: Node; x: number; y: number; w: number; h: number; instruments: boolean; titles: boolean}) {
  if (node.t === 'g') {
    const dashed = node.instrument && !instruments
    return <g>
      {node.focus && <rect x={x + .5} y={y + .5} width={w - 1} height={h - 1} className="dp-fill-on" />}
      <rect x={x + .5} y={y + .5} width={w - 1} height={h - 1} className="dp-faint" strokeDasharray={dashed ? DASH : undefined}
        style={node.focus ? {stroke: 'var(--dp-on)'} : undefined} />
      {Array.from({length: node.tabs}, (_, i) => <rect key={i} x={x + 3 + i * 7} y={y + 3} width={5} height={3} fill={i < (node.pinned ?? 0) ? 'var(--dp-on)' : FAINT_FILL} />)}
      {titles && h >= 22 && w >= 36 && <text x={x + 4} y={y + 16} className="dp-ink-dim">{cut(node.title, Math.floor((w - 8) / 5))}</text>}
    </g>
  }
  const total = node.w.reduce((a, b) => a + b, 0), room = (node.dir === 'h' ? w : h) - 2 * (node.kids.length - 1)
  let at = 0
  return <g>{node.kids.map((kid, i) => {
    const size = room * node.w[i]! / total, kx = node.dir === 'h' ? x + at : x, ky = node.dir === 'v' ? y + at : y
    at += size + 2
    return <Tree key={i} node={kid} x={kx} y={ky} w={node.dir === 'h' ? size : w} h={node.dir === 'v' ? size : h} instruments={instruments} titles={titles} />
  })}</g>
}

/** The open mode's window: the left body, the pane tree, the right panel, and the widget rail at the edge. A rail that is not kept is dashed. */
function Stage({v, x, y, w, h, left, right, rail, titles}: {v: V; x: number; y: number; w: number; h: number; left: number; right: number; rail: number; titles: boolean}) {
  const tree = treeOf(v), widgets = num(v, 'widgets'), cx = x + left + 2, cw = w - left - right - rail - 6
  return <g>
    <rect x={x + .5} y={y + .5} width={left - 1} height={h - 1} className="dp-faint" />
    <rect x={x + w - rail - right - 1.5} y={y + .5} width={right - 1} height={h - 1} className="dp-faint" />
    {Array.from({length: widgets}, (_, i) => <rect key={i} x={x + w - rail + .5} y={y + .5 + i * (rail + 2)} width={rail - 1} height={rail - 1} className="dp-faint"
      strokeDasharray={on(v, 'keepWidgets') ? undefined : DASH} style={{fill: 'color-mix(in srgb, var(--dp-value) 30%, transparent)'}} />)}
    {tree ? <Tree node={tree} x={cx} y={y} w={cw} h={h} instruments={on(v, 'keepInstruments')} titles={titles} />
      : <g>
        <rect x={cx + .5} y={y + .5} width={cw - 1} height={h - 1} className="dp-faint" strokeDasharray={DASH} />
        {cw >= 40 && <text x={cx + cw / 2} y={y + h / 2 + 3} className="dp-axis" textAnchor="middle">{tree === null ? 'no panes open' : 'curated default'}</text>}
      </g>}
  </g>
}

/** Turning to another mode changes the context. Unless the workspace keeps on change, the change waits to be kept. */
const turnTo = (v: V, set?: SetFn) => (id: string) => {
  set?.('mode', id)
  if (str(v, 'keepWhen') !== 'change') set?.('dirty', true)
}

/** The strip: a stop for "Last mode", then the five modes. A mode cell turns the open mode; a mark on it says what a launch does with its tree. */
function Strip({v, set, x, y, cell, h, names, sets}: {v: V; set?: SetFn; x: number; y: number; cell: number; h: number; names: boolean; sets: boolean}) {
  const mode = str(v, 'mode'), openIn = str(v, 'openIn'), at = (i: number) => x + i * cell
  const turn = turnTo(v, set)
  return <g role="radiogroup" aria-label="Modes">
    <g role="radio" aria-checked={openIn === 'last'} aria-label="Last mode" tabIndex={set ? (openIn === 'last' ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
      data-i="Last mode|A launch opens in the mode where you left off." onClick={() => set?.('openIn', 'last')}>
      <rect x={at(0) + .5} y={y + .5} width={cell - 1} height={h - 1} className="dp-faint" strokeDasharray={DASH} />
      <text x={at(0) + cell / 2} y={y + h / 2 + 3.5} className="dp-ink-dim" textAnchor="middle">{names ? 'Last' : '↺'}</text>
    </g>
    {MODES.map((m, i) => {
      const cx = at(i + 1), open = m.id === mode, state = returns(v, m.id) ? 'returns' : kept(v, m.id) ? 'kept' : 'none'
      return <g key={m.id} role="radio" aria-checked={open} aria-label={m.name} tabIndex={set ? (open ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
        data-i={`${m.name}|${state === 'returns' ? 'Opens this mode. Its panes return at launch.' : state === 'kept' ? 'Opens this mode. Its panes are kept but do not return at launch.' : 'Opens this mode. Nothing of it is kept.'}`}
        onClick={() => turn(m.id)}>
        <rect x={cx + .5} y={y + .5} width={cell - 1} height={h - 1} className={open ? 'dp-fill-on' : 'dp-faint'} style={open ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : undefined} />
        <text x={cx + cell / 2} y={y + h / 2 + (state === 'none' ? 3.5 : 1.5)} className={open ? 'dp-ink' : 'dp-ink-dim'} textAnchor="middle">{names ? m.short : m.mark}</text>
        {state === 'returns' && <circle cx={cx + cell / 2} cy={y + h - 4.5} r={1.9} fill="var(--dp-on)" />}
        {state === 'kept' && <circle cx={cx + cell / 2} cy={y + h - 4.5} r={1.9} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
        {sets && on(v, 'keepSets') && !on(v, 'fresh') && SETS[m.id] && <rect x={cx + 3} y={y + h - 7} width={4} height={4} fill="var(--dp-value)" />}
      </g>
    })}
  </g>
}

/** The Open in handle: a track under the strip with a stop for each choice. Drag the handle to a stop. */
function OpenTrack({v, set, x, y, cell, label}: {v: V; set?: SetFn; x: number; y: number; cell: number; label: boolean}) {
  const at = Math.max(0, STOPS.indexOf(str(v, 'openIn') as (typeof STOPS)[number])), px = (i: number) => x + i * cell + cell / 2
  return <g>
    <line x1={px(0)} y1={y} x2={px(STOPS.length - 1)} y2={y} className="dp-faint" />
    {STOPS.map((s, i) => <line key={s} x1={px(i)} y1={y - 2} x2={px(i)} y2={y + 2} className="dp-faint" />)}
    {label && <text x={x + 1} y={y + 12} className="dp-ink-dim"><tspan className="dp-axis">opens in </tspan>{str(v, 'openIn') === 'last' ? 'Last mode' : modeName(str(v, 'openIn'))}</text>}
    {set && <Handle x={px(at)} y={y} n={1} shape="ring" label="Open in" does="Drag along the track: the mode that comes forward after a launch."
      onDrag={(hx) => set('openIn', STOPS[Math.round(clampTo(0, STOPS.length - 1, (hx - x - cell / 2) / cell))]!)} onReset={() => set('openIn', 'last')} />}
  </g>
}

/** The picture at one size: the name, the strip, the Open in track and the open mode's window. */
function Picture({v, set, w, names, sets}: {v: V; set?: SetFn; w: number; names: boolean; sets: boolean}) {
  const cell = (w - 8) / 6, tree = treeOf(v)
  const panes = groupsIn(tree)
  return <g>
    <text x={5} y={11} className="dp-ink">{cut(str(v, 'name'), names ? 26 : 16)}</text>
    <Strip v={v} set={set} x={4} y={15} cell={cell} h={19} names={names} sets={sets} />
    <OpenTrack v={v} set={set} x={4} y={43} cell={cell} label />
    <Stage v={v} x={4} y={62} w={w - 8} h={69} left={names ? 14 : 12} right={names ? 26 : 20} rail={names ? 7 : 6} titles={names || panes > 0} />
    <text x={5} y={142} className="dp-ink-dim">{modeName(str(v, 'mode'))} · {panes} {panes === 1 ? 'pane' : 'panes'}</text>
    <text x={w - 5} y={142} className="dp-ink-dim" textAnchor="end" style={on(v, 'dirty') ? {fill: 'var(--dp-on)'} : undefined}>{on(v, 'dirty') ? 'unkept' : 'kept'}</text>
  </g>
}

/** The small picture for the widget: the five modes and the open mode's window. */
function Mini({v, set}: {v: V; set?: SetFn}) {
  const mode = str(v, 'mode'), cell = 20, tree = treeOf(v), turn = turnTo(v, set)
  return <g>
    <g role="radiogroup" aria-label="Modes">{MODES.map((m, i) => {
      const open = m.id === mode, state = returns(v, m.id) ? 'returns' : kept(v, m.id) ? 'kept' : 'none'
      return <g key={m.id} role="radio" aria-checked={open} aria-label={m.name} tabIndex={set ? (open ? 0 : -1) : -1} style={{cursor: set ? 'pointer' : 'default'}}
        data-i={`${m.name}|Opens this mode.`} onClick={() => turn(m.id)}>
        <rect x={6 + i * cell + .5} y={4.5} width={cell - 1} height={17} className={open ? 'dp-fill-on' : 'dp-faint'} style={open ? {stroke: 'var(--dp-on)', strokeWidth: 1.2} : undefined} />
        <text x={6 + i * cell + cell / 2} y={state === 'none' ? 16 : 14} className={open ? 'dp-ink' : 'dp-ink-dim'} textAnchor="middle">{m.mark}</text>
        {state === 'returns' && <circle cx={6 + i * cell + cell / 2} cy={19} r={1.6} fill="var(--dp-on)" />}
        {state === 'kept' && <circle cx={6 + i * cell + cell / 2} cy={19} r={1.6} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
      </g>
    })}</g>
    <Stage v={v} x={4} y={26} w={104} h={66} left={8} right={14} rail={5} titles={false} />
    <text x={5} y={101} className="dp-ink-dim">{cut(modeName(mode), 12)} · {groupsIn(tree)} {groupsIn(tree) === 1 ? 'pane' : 'panes'}</text>
  </g>
}

// ---------------------------------------------------------------- the controls

/** Launch: the remembered context comes back. The open mode follows "Open in", unless nothing is to return. */
const launch = (p: ViewProps) => () => {
  p.set('light', 'lit')
  if (str(p.v, 'onLaunch') !== 'none' && str(p.v, 'openIn') !== 'last') p.set('mode', str(p.v, 'openIn'))
}
const rename = (p: ViewProps) => (x: string) => { if (x.trim()) p.set('name', x.trim()) }
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

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
  },
  fixtures: {
    'Archetypal Earth': {},
    'A new workspace': {name: 'New workspace', folder: 'central', fresh: true, mem: 'base', widgets: 2, visited: 'now'},
    'Not launched': {light: 'dark', visited: '6 d ago', mode: 'techne'},
  },

  folded: p => <Folded title={cut(str(p.v, 'name'), 18)} light={light(p.v)} readings={[`${openCount(p.v)} open`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Workspace" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The workspace" does="The panes of the open mode. A mark on a mode shows what a launch restores. Drag handle 1 to set the mode that a launch opens in."
        corner={`${openCount(p.v)} open`}>
        <Picture v={p.v} set={p.set} w={140} names={false} sets={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Action label="Launch" does={LAUNCH_DOES} onPress={launch(p)} />
      <Radio label="Restore" does="What comes back when you launch the workspace: all modes, the open mode or nothing." value={str(p.v, 'onLaunch')} options={LAUNCH_SHORT} stack onChange={x => p.set('onLaunch', x)} />
      <Radio label="Keep" does="When the workspace stores your context." value={str(p.v, 'keepWhen')} options={KEEP_SHORT} stack onChange={x => p.set('keepWhen', x)} />
      <Toggle label="To Day" does="Send the work of this workspace to the Day." on={on(p.v, 'sendToDay')} onChange={x => p.set('sendToDay', x)} />
    </Section>
  </Panel>,

  whole: p => <Panel title="Workspace" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The workspace" does="The panes of the open mode. A filled mark on a mode: its panes return at launch. A ring: kept, but not restored. A teal square: a saved set. Drag handle 1 to set the mode that a launch opens in."
          corner={`${openCount(p.v)} open`}>
          <Picture v={p.v} set={p.set} w={194} names sets />
        </Display>
      </Section>
      <Section label="Identity" grow>
        <TextField label="Name" does="The name on the track and in the browser." value={str(p.v, 'name')} placeholder="New workspace" onChange={rename(p)} />
        <Chooser label="Kind" does="The starting set of panes and widgets for a new workspace." value={str(p.v, 'kind')} options={KINDS} onChange={x => p.set('kind', x)} />
        <Chooser label="Folder" does="The folder whose files show as clips: Central or one project of Work." value={str(p.v, 'folder')} options={FOLDERS} onChange={x => p.set('folder', x)} />
        <Chooser label="Place" does="Where the workspace stands on your planet. A project has its own place." value={str(p.v, 'place')} options={PLACES} onChange={x => p.set('place', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Remember" width={82}>
        {REMEMBER_PARTS.map(([key, label, does]) => <Toggle key={key} label={label} does={does} on={on(p.v, key)} onChange={x => p.set(key, x)} />)}
        <Action label="Keep now" does={KEEP_NOW} onPress={() => p.set('dirty', false)} />
      </Section>
      <Section label="Keep" width={88}>
        <Radio label="Remember in" does="Keeps context for all five modes, or for the open mode only." value={str(p.v, 'rememberIn')} options={REMEMBER_IN} stack onChange={x => p.set('rememberIn', x)} />
        <Radio label="Keep context" does="When the workspace stores your context." value={str(p.v, 'keepWhen')} options={KEEP} stack onChange={x => p.set('keepWhen', x)} />
      </Section>
      <Section label="Launch" width={96}>
        <Action label="Launch" does={LAUNCH_DOES} onPress={launch(p)} />
        <Radio label="On launch" does="What comes back when you launch the workspace." value={str(p.v, 'onLaunch')} options={LAUNCH} stack onChange={x => p.set('onLaunch', x)} />
        <Chooser label="Open in" does="The mode that comes forward after a launch." value={str(p.v, 'openIn')} options={OPEN_IN} onChange={x => p.set('openIn', x)} />
      </Section>
      <Section label="Day" grow>
        <Toggle label="Send to Day" does="Send the work of this workspace to the Day, the Main track." on={on(p.v, 'sendToDay')} onChange={x => p.set('sendToDay', x)} />
        <Readout big label="open" does="Documents open in panes." value={openCount(p.v)} tone="accent" />
        <Readout label="edited" does="Clips edited since save." value={editedCount(p.v)} tone="value" />
      </Section>
    </Band>
  </Panel>,

  full: p => <WorkspaceBody p={p} />,

  widget: p => <Tile title={str(p.v, 'name')} light={light(p.v)} span={2} onFull={p.nav.full}>
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

function WorkspaceBody({p}: {p: ViewProps}) {
  const v = p.v, clips = clipsOf(v), selected = str(v, 'clip')
  return <div className="cws">
    <header className="cws-head">
      <h3>{str(v, 'name')}</h3>
      <span>{KINDS.find(k => k.value === str(v, 'kind'))?.label} · {folderLabel(v)} · here {str(v, 'visited')}</span>
    </header>
    <section aria-label="Clips">
      <h4>Clips <small>{clips.length}</small></h4>
      {clips.length === 0 ? <p className="cws-empty">No clips yet. Drag a folder from the browser onto this track.</p>
        : <ul className="cws-list">{clips.map(c => <li key={c.id} data-selected={c.id === selected ? 'true' : undefined}>
          <button type="button" className="cws-row" data-i={`${c.name}|Opens this document in a pane.`} onClick={() => p.set('clip', c.id)}>
            <Lamp state={c.state === 'draft' ? 'unknown' : 'lit'} tone={c.state === 'saved' ? 'green' : 'accent'} label={STATES[c.state]} />
            <b>{c.name}</b><span className="cws-path">{c.path}</span><span>{c.kind}</span><span className="cws-state" data-state={c.state}>{STATES[c.state]}</span>
            <span className="cws-open">{c.open ? 'open' : ''}</span>
          </button>
        </li>)}</ul>}
    </section>
    <section aria-label="Modes">
      <h4>Modes <small>what each opens with</small></h4>
      <ul className="cws-list">{MODES.map(m => {
        const state = returns(v, m.id) ? 'returns' : kept(v, m.id) ? 'kept' : 'none', set = on(v, 'fresh') ? undefined : SETS[m.id]
        return <li key={m.id} data-selected={m.id === str(v, 'mode') ? 'true' : undefined}>
          <div className="cws-row" data-i={`${m.name}|${state === 'returns' ? 'Its panes return at launch.' : state === 'kept' ? 'Its panes are kept but do not return at launch.' : 'Nothing of this mode is kept.'}`}>
            <Lamp state={state === 'returns' ? 'lit' : state === 'kept' ? 'unknown' : 'dark'} label={state} />
            <b>{m.name}</b><span className="cws-path">{groupsIn(TREES[m.id]) && !on(v, 'fresh') ? `${groupsIn(TREES[m.id])} ${groupsIn(TREES[m.id]) === 1 ? 'pane' : 'panes'}` : 'curated default'}</span>
            <span>{set ?? '—'}</span><span className="cws-state">{state === 'returns' ? 'returns' : state === 'kept' ? 'kept' : 'not kept'}</span>
            <span className="cws-open">{m.id === str(v, 'mode') ? 'open' : ''}</span>
          </div>
        </li>
      })}</ul>
    </section>
  </div>
}
