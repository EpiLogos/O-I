// Files (manual §23.2): the files an agent read and the files it changed, as a tree, with the lines added and removed. A device born on
// the rail; Live's nearest is the browser's file list, folders and files in one column with a mark at the right. The display is the
// tree as the owners state it: each folder once, its files under it; a changed file marked M with its lines added (green) and removed
// (red), a file the agent read marked with an arrow, a place the agent may not reach struck through in red with its reason.
//
// Owners, keyed on their paths:
//   files     [{path, verb, adds?, dels?, blocked?}]: path and verb from the agent's encounter tape (desktop/cradle/src/agent/tape/model.ts
//             TapeRow `detail` and `verb`: 'read' or 'edit'), adds and dels from the seat's diff (`central.git-diff/v1` DiffFile `adds`,
//             `dels`, kernel op git_diff_read), and blocked the reason a place is out of reach where the file owner says it is
//             (`central.directory-reading/v1` NativeFileEntry `retrieval_allowed`). The tape carries no counts of its own.
//   agent     the agent the tree follows (the shell's selected agent session); open the file shown full; content its lines
//             (`central.file-reading/v1` `content`, kernel op file_read).
// Show, Blocked and Follow are the monitor's own; no owner keeps them.
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the tree, with Show as handle 1 on
// it; a file pressed there opens in Full. Full's head carries the counts and every setting (Show, Blocked, Follow); its body is the
// tree beside the file opened.
import {Display, Handle, Radio, Tile, Toggle} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, MonitorPicture} from './monitor'

type V = ViewProps['v']

const SHOWS = [{value: 'touched', label: 'Read · changed', does: 'List the files the agent read or changed.'}, {value: 'changed', label: 'Changed', does: 'List only the files the agent changed.'},
  {value: 'all', label: 'All', does: 'List every file in the tree, touched or not.'}] as const
interface File {readonly path: string; readonly verb: 'read' | 'edit' | 'none'; readonly adds?: number; readonly dels?: number; readonly blocked?: string}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function filesOf(v: V): File[] | undefined {
  const raw = json<unknown>(v, 'files', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): File[] => rec(e) && typeof e.path === 'string' ? [{path: e.path, verb: e.verb === 'edit' ? 'edit' : e.verb === 'read' ? 'read' : 'none',
    adds: Number.isInteger(e.adds) ? e.adds as number : undefined, dels: Number.isInteger(e.dels) ? e.dels as number : undefined, blocked: typeof e.blocked === 'string' ? e.blocked : undefined}] : [])
}
/** The rows the tree shows, in order, by the Show filter (a blocked place shows unless hidden): the folder the files share, then each
 * folder under it once, as one row however deep it runs, and its files under it. */
function rowsOf(v: V) {
  const files = filesOf(v), show = strOf(v, 'show') ?? 'touched', blocked = boolOf(v, 'blocked') !== false
  if (!files) return undefined
  const kept = files.filter(f => (f.blocked ? blocked : show === 'all' || (show === 'changed' ? f.verb === 'edit' : f.verb !== 'none'))).sort((a, b) => a.path.localeCompare(b.path))
  const dirOf = (f: File) => f.path.split('/').slice(0, -1)
  let common = kept.length ? dirOf(kept[0]!) : []
  for (const f of kept) { const d = dirOf(f); let n = 0; while (n < common.length && n < d.length && common[n] === d[n]) n++; common = common.slice(0, n) }
  const rows: ({kind: 'dir'; name: string; depth: number} | {kind: 'file'; file: File; name: string; depth: number})[] = common.length ? [{kind: 'dir', name: common.join('/'), depth: 0}] : []
  let last: string | undefined
  for (const f of kept) {
    const d = dirOf(f).slice(common.length).join('/')
    if (d && d !== last) rows.push({kind: 'dir', name: d, depth: 1})
    last = d
    rows.push({kind: 'file', file: f, name: f.path.split('/').pop()!, depth: d ? 2 : 1})
  }
  return rows
}
const counts = (v: V) => { const f = filesOf(v); return f ? {read: f.filter(x => x.verb === 'read').length, changed: f.filter(x => x.verb === 'edit').length, adds: f.reduce((n, x) => n + (x.adds ?? 0), 0), dels: f.reduce((n, x) => n + (x.dels ?? 0), 0)} : undefined }

/** The tree. `handle`: the Show filter as a three-stop scale at the top (drag across: read and changed, changed only, all). `press`: a row
 * opens its file in the pane. */
function Tree({p, w, h, handle, press, size = 10, mark}: {p: ViewProps; w: number; h: number; handle: boolean; press?: (path: string) => void; size?: number; mark?: string}) {
  const v = p.v, rows = rowsOf(v), top = handle ? 22 : 12, lh = size + 3, fit = Math.floor((h - top - 2) / lh), shown = rows?.slice(0, fit) ?? []
  const show = strOf(v, 'show') ?? 'touched', k = Math.max(0, SHOWS.findIndex(s => s.value === show)), x0 = 8, x1 = Math.min(w - 8, 120), stop = (j: number) => x0 + j * (x1 - x0) / 2
  const sst = st(p, 'show')
  return <g>
    {handle && <g>
      <path d={`M${x0} 8H${x1}`} className="dp-faint" />
      {['touched', 'changed', 'all'].map((t, j) => <text key={t} x={stop(j)} y={18} textAnchor={j === 2 ? 'end' : j ? 'middle' : 'start'} className="dp-axis" style={{fontSize: 7}}>{t}</text>)}
      <Handle n={1} shape="square" x={stop(k)} y={8} label="Show" does={`Drag across: the files the agent read or changed, those it changed, or all.${sst.disabled ? ` ${sst.disabled}` : ''}`}
        onDrag={sst.disabled ? undefined : x => { const j = clampTo(0, 2, Math.round((x - x0) / ((x1 - x0) / 2))); if (SHOWS[j]!.value !== show) p.set('show', SHOWS[j]!.value) }} onReset={sst.disabled ? undefined : () => p.set('show', 'touched')} />
    </g>}
    {!rows && <text x={6} y={top + 14} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the files'}</text>}
    {rows && !rows.length && <text x={6} y={top + 14} className="dp-ink-dim">No file to show</text>}
    {shown.map((r, i) => { const y = top + i * lh + size, x = 6 + r.depth * 8
      // A folder that runs too long for the row keeps its end, where the files are.
      if (r.kind === 'dir') { const room = Math.floor((w - x - 8) / (size * .5)), name = r.name.length > room ? `…${r.name.slice(-room + 1)}` : r.name
        return <text key={i} x={x} y={y} className="dp-axis" style={{fontSize: size * .9}}>{name}/</text> }
      const f = r.file, nums = f.verb === 'edit' && (f.adds !== undefined || f.dels !== undefined)
      return <g key={i}>
        {mark === f.path && <rect x={0} y={y - size} width={w} height={lh} fill="var(--sel, #7ec3e6)" opacity={.16} />}
        <text x={x} y={y} className={f.blocked ? 'dp-axis' : 'dp-ink'} style={{fontSize: size}}>{f.verb === 'edit' ? 'M ' : f.verb === 'read' ? '→ ' : '  '}{r.name}</text>
        {f.blocked && <path d={`M${x} ${y - size * .35}H${Math.min(w - 4, x + 14 + r.name.length * size * .55)}`} stroke="var(--rec)" strokeWidth={1} />}
        {nums && <text x={w - 6} y={y} textAnchor="end" style={{fontSize: size * .9}}>
          <tspan fill="var(--green)">+{f.adds ?? 0}</tspan> <tspan fill="var(--rec)">−{f.dels ?? 0}</tspan></text>}
        {press && <rect x={0} y={y - size} width={w} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={f.blocked ? `Why ${f.path} is blocked` : `Open ${f.path}`}
          data-i={f.blocked ? `${r.name}|Blocked: ${f.blocked}` : `${r.name}|Open the file in the pane that has focus.`} onClick={() => { if (!f.blocked) press(f.path) }} onKeyDown={e => { if (e.key === 'Enter' && !f.blocked) press(f.path) }} />}
      </g> })}
    {rows && rows.length > fit && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{rows.length - fit}</text>}
  </g>
}

const LIGHT_WHY = 'Files has no on or off: it only reads. The light stays hollow.'
const openFile = (p: ViewProps) => (path: string) => { p.set('open', path); p.nav.full?.() }
const DISPLAY_DOES = 'The files the agent touched. M: changed, with lines added and removed. An arrow: read. Struck through in red: a place the agent may not reach.'

/** Full's head: the agent, the counts, and every setting. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, n = counts(v)
  return <MonitorHead title="Files" readings={[
    {label: 'agent', value: strOf(v, 'agent'), does: 'The agent the tree follows.'},
    {label: 'changed', value: n?.changed, does: 'Files the agent changed.', tone: 'accent'},
    {label: 'read', value: n?.read, does: 'Files the agent read.', tone: 'value'},
    {label: 'lines', value: n ? <><span style={{color: 'var(--green)'}}>+{n.adds}</span> <span style={{color: 'var(--rec)'}}>−{n.dels}</span></> : undefined, does: 'Lines added and removed in the files the agent changed.'},
  ]} controls={<>
    <Radio {...st(p, 'show')} label="Show" does="Which files the tree lists." value={strOf(v, 'show') ?? ''} options={SHOWS} onChange={x => p.set('show', x)} />
    <Toggle {...st(p, 'blocked')} label="Blocked" does="Show the places the agent may not reach, with the reason." on={boolOf(v, 'blocked') !== false} onChange={x => p.set('blocked', x)} />
    <Toggle {...st(p, 'follow')} label="Follow" does="Keep the tree on the selected agent." on={boolOf(v, 'follow') === true} unknown={boolOf(v, 'follow') === undefined} onChange={x => p.set('follow', x)} />
  </>} />
}

/** The file opened, beside the tree: its path, its lines added and removed, its lines numbered. */
function OpenFile({p, x0, w, h}: {p: ViewProps; x0: number; w: number; h: number}) {
  const lines = json<string[]>(p.v, 'content', []), path = strOf(p.v, 'open'), f = filesOf(p.v)?.find(x => x.path === path), lh = 13.5, fit = Math.max(0, Math.floor((h - 46) / lh))
  const room = Math.max(8, Math.floor((w - 50) / 6.3))
  return <g transform={`translate(${x0} 0)`}>
    <text x={14} y={22} className="dp-ink dp-mono" style={{fontSize: 11}}>{path ? (path.length > room ? `…${path.slice(-room + 1)}` : path) : 'No file open'}</text>
    {f?.verb === 'edit' && <text x={w - 14} y={22} textAnchor="end" style={{fontSize: 11}}><tspan fill="var(--green)">+{f.adds ?? 0}</tspan>  <tspan fill="var(--rec)">−{f.dels ?? 0}</tspan></text>}
    <path d={`M0 32H${w}`} className="dp-faint" />
    {lines.length ? lines.slice(0, fit).map((l, i) => <g key={i}>
      <text x={38} y={52 + i * lh} textAnchor="end" className="dp-axis">{i + 1}</text>
      <text x={48} y={52 + i * lh} className="dp-ink dp-mono" style={{fontSize: 10.5, whiteSpace: 'pre'}}>{l.slice(0, room)}</text>
    </g>) : <text x={14} y={60} className="dp-ink-dim">{path ? 'No reading of the file' : 'Click a file in the tree to read it here'}</text>}
    {lines.length > fit && <text x={w - 14} y={h - 6} textAnchor="end" className="dp-axis">+{lines.length - fit} lines</text>}
  </g>
}

export const design = railAndPane({
  id: 'widgets:files',
  title: 'Files',
  kind: 'monitor',
  defaults: {
    show: 'touched', blocked: true, follow: true, agent: 'Fizz · lead', open: 'packages/live-shell/ui/src/shell/widgets.tsx',
    files: JSON.stringify([
      {path: 'packages/live-shell/ui/src/shell/widgets.tsx', verb: 'edit', adds: 12, dels: 3},
      {path: 'packages/live-shell/ui/src/shell/TrailWidget.tsx', verb: 'read'},
      {path: 'packages/live-shell/ui/src/frame/widgets/widgets.ts', verb: 'read'},
      {path: 'packages/live-shell/ui/src/frame/widgets/deviceWidgets.tsx', verb: 'edit', adds: 4, dels: 1},
      {path: 'packages/live-shell/ui/tests/f8-widgets.test.mjs', verb: 'edit', adds: 9, dels: 0},
      {path: 'packages/live-shell/ui/src/shell/widgetDefaults.ts', verb: 'none'},
      {path: 'desktop/cradle/src-tauri/tauri.conf.json', verb: 'none', blocked: 'Outside the scope: the agent may read the shell only.'}]),
    content: JSON.stringify(['// The widget rail: every widget the shell offers, by id.', "const MODE_TILES = ['packet', 'trail', 'field', 'nows', 'results', 'sky'] as const",
      "const AGENT_TILES = ['sessions', 'agents', 'terminal', 'files', 'web', 'graph', 'diff', 'frames', 'ledger', 'approvals'] as const", '', 'export const WIDGETS = [', '  {id: \'agent\', name: \'Agent\'},',
      '  ...MODE_TILES.map(id => modeTile(id)),', '  ...AGENT_TILES.map(id => agentTile(id)),', ']']),
  },
  fixtures: {
    'An agent at work': {},
    'Changed only': {show: 'changed', blocked: false},
    'No reading': {files: undefined, content: undefined, agent: undefined, reason: 'No agent is selected'},
  },

  full: p => <MonitorPane dark label="Files" head={<Head p={p} />}>{room => { const tw = Math.round(clampTo(220, 300, room.w * .34))
    return <MonitorPicture room={room} label="The tree and the file">
      <Tree p={p} w={tw} h={room.h} handle={false} size={10.5} mark={strOf(p.v, 'open')} press={path => p.set('open', path)} />
      <path d={`M${tw + .5} 0V${room.h}`} className="dp-faint" />
      <OpenFile p={p} x0={tw + 1} w={room.w - tw - 1} h={room.h} />
    </MonitorPicture> }}</MonitorPane>,

  widget: p => <Tile title="Files" light="unknown" lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Files" does={`${DISPLAY_DOES} Drag handle 1 for what the tree lists. Click a file to open it in Full; point at a blocked place to read why.`} corner={strOf(p.v, 'agent') ?? NONE}>
      <Tree p={p} w={266} h={104} handle press={openFile(p)} size={9} />
    </Display>
  </Tile>,
})
