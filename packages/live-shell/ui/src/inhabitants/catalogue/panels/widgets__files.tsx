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
// The Diff page (manual §23.2, which took in the Diff device of §23.4): the changes not yet committed, and the changes an agent
// proposes, read before you approve them; Live's nearest is the clip's Notes editor, the material line by line. Its values stand under
// `diff.` (a binding hosts the page by prefixing the seat's diff binding):
//   diff.files  [{path, status, adds, dels, patch?, author?}]: the seat's diff (`central.git-diff/v1` DiffFile `new_path`, `status` A, M or
//               D, `adds`, `dels`, `patch`; kernel op git_diff_read, from HEAD to the working tree). `author` marks a proposed change; no
//               owner reports proposed changes yet (a consent request carries a tool call, not a patch).
//   diff.branch, diff.head  the seat's branch and HEAD (git_repository_read); diff.open the file whose diff is shown.
// Changes (diff.show: uncommitted · proposed · both), Session (diff.session: selected · all) and Layout (diff.layout: unified · split) are
// the monitor's own (the renderer holds a layout only for its session: git/diffModel.ts DiffLayout).
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the tree, with Show as handle 1 on
// it; a file pressed there opens in Full. Full has two pages. Files: its head carries the counts and Show, Blocked and Follow; its body
// is the tree beside the file opened. Diff: its head carries the branch, HEAD, the files, the lines and the proposed changes, with
// Changes, Session and Layout; its body is the files beside the diff of the one opened, with Layout as handle 1 on the diff.
import {Display, Handle, Radio, Tile, Toggle} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, prefixed, railAndPane, scoped, st, strOf, type ViewProps} from './design'
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

/** Full's head on the Files page: the counts, and every setting. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, n = counts(v)
  return <MonitorHead title="Files" readings={[
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

// ------------------------------------------------------------------------------------------------ the Diff page (`diff.` keys)

const CHANGES = [{value: 'uncommitted', label: 'Uncommitted', does: 'The changes not yet committed.'}, {value: 'proposed', label: 'Proposed', does: 'The changes an agent proposes.'},
  {value: 'both', label: 'Both', does: 'Both kinds of change.'}] as const
const SESSIONS = [{value: 'selected', label: 'Selected', does: 'The changes of the selected session.'}, {value: 'all', label: 'All', does: 'The changes of every session.'}] as const
const LAYOUTS = [{value: 'unified', label: 'Unified', does: 'The lines in one column.'}, {value: 'split', label: 'Side by side', does: 'The old lines at the left, the new at the right.'}] as const
interface Change {readonly path: string; readonly status: string; readonly adds?: number; readonly dels?: number; readonly patch?: string; readonly author?: string}
function changesOf(v: V): Change[] | undefined {
  const raw = json<unknown>(v, 'files', undefined)
  if (!Array.isArray(raw)) return undefined
  const show = strOf(v, 'show') ?? 'both'
  return raw.flatMap((e): Change[] => rec(e) && typeof e.path === 'string' ? [{path: e.path, status: String(e.status ?? 'M'), adds: Number.isInteger(e.adds) ? e.adds as number : undefined,
    dels: Number.isInteger(e.dels) ? e.dels as number : undefined, patch: typeof e.patch === 'string' ? e.patch : undefined, author: typeof e.author === 'string' ? e.author : undefined}] : [])
    .filter(f => show === 'both' || (show === 'proposed' ? f.author !== undefined : f.author === undefined))
}
const openChange = (v: V) => { const fs = changesOf(v), o = strOf(v, 'open'); return fs?.find(f => f.path === o) ?? fs?.find(f => f.patch) ?? fs?.[0] }
const base = (path: string) => path.split('/').pop() ?? path
const f1 = (x: number) => x.toFixed(1)
/** A patch's lines, each with its kind. */
function linesOf(patch: string | undefined) { return (patch ?? '').split('\n').filter(l => l.length).map(l => ({kind: l.startsWith('@@') ? 'hunk' : l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx', text: l.startsWith('@@') ? l : l.slice(1)})) }

/** The diff of one file: an added line on a green ground, a removed line on a red one, a hunk's head faint; side by side, the old lines at
 * the left and the new at the right. Handle 1 is Layout: drag it to the middle for side by side, to the left edge for one column. */
function Patch({p, w, h, size = 8.5}: {p: ViewProps; w: number; h: number; size?: number}) {
  const v = p.v, f = openChange(v), split = strOf(v, 'layout') === 'split', lh = size + 3.5, cw = size * .6, top = 15, fit = Math.floor((h - top - 3) / lh), ls = st(p, 'layout')
  if (!f) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? (changesOf(v) ? 'No change to show' : 'No reading of the diff')}</text>
  const all = linesOf(f.patch), col = split ? (w - 8) / 2 : w - 8, room = Math.floor((col - 4) / cw)
  type L = {kind: string; text: string}
  const rows: {l?: L; r?: L}[] = split
    ? (() => { const out: {l?: L; r?: L}[] = []; let dels: L[] = []
        for (const x of all) { if (x.kind === 'del') { dels.push(x); continue } if (x.kind === 'add') { const d = dels.shift(); out.push({l: d, r: x}); continue }
          for (const d of dels) out.push({l: d}); dels = []; out.push({l: x, r: x}) } for (const d of dels) out.push({l: d}); return out })()
    : all.map(x => ({l: x}))
  const line = (x: L | undefined, x0: number, y: number, k: string) => x && <g key={k}>
    {(x.kind === 'add' || x.kind === 'del') && <rect x={x0} y={y - size} width={col} height={lh} fill={x.kind === 'add' ? 'var(--green)' : 'var(--rec)'} opacity={.18} />}
    <text x={x0 + 3} y={y} className={`${x.kind === 'hunk' ? 'dp-axis' : 'dp-ink'} dp-mono`} style={{fontSize: size, whiteSpace: 'pre',
      fill: x.kind === 'add' ? 'var(--green)' : x.kind === 'del' ? 'var(--rec)' : undefined}}>{(x.kind === 'add' ? '+' : x.kind === 'del' ? '−' : x.kind === 'hunk' ? '' : ' ') + x.text.slice(0, room)}</text>
  </g>
  const dx = split ? 4 + col : 4
  return <g>
    <text x={4} y={10} className="dp-ink" style={{fontSize: size}}>{f.status} {base(f.path)}{f.author ? ` · ${f.author}` : ''}</text>
    {f.patch === undefined && <text x={4} y={top + 12} className="dp-ink-dim">No reading of the lines</text>}
    {rows.slice(0, fit).map((r, i) => { const y = top + (i + 1) * lh - 2; return <g key={i}>{line(r.l, 4, y, 'l')}{split && line(r.r, 4 + col, y, 'r')}</g> })}
    {split && <path d={`M${f1(4 + col)} ${top}V${h}`} className="dp-faint" />}
    <Handle n={1} shape="square" x={dx} y={top + 4} label="Layout" does={`Drag to the middle to set the lines side by side, to the left edge for one column.${ls.disabled ? ` ${ls.disabled}` : ''}`}
      onDrag={ls.disabled ? undefined : x => { const next = x > w * .3 ? 'split' : 'unified'; if (next !== strOf(v, 'layout')) p.set('layout', next) }} onReset={ls.disabled ? undefined : () => p.set('layout', 'unified')} />
  </g>
}

/** The changed files, each with a bar of its lines added and removed; `mark` is the file opened, `press` opens one. */
function ChangeList({p, w, h, press, mark, top = 20}: {p: ViewProps; w: number; h: number; press: (path: string) => void; mark?: string; top?: number}) {
  const fs = changesOf(p.v), lh = 13, fit = Math.floor((h - top + 6) / lh), max = Math.max(1, ...(fs ?? []).map(f => (f.adds ?? 0) + (f.dels ?? 0))), barW = Math.min(70, w * .3)
  if (!fs) return <text x={6} y={18} className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'No reading of the diff'}</text>
  if (!fs.length) return <text x={6} y={18} className="dp-ink-dim">No change to show</text>
  return <g>{fs.slice(0, fit).map((f, i) => { const y = top + i * lh, a = f.adds ?? 0, d = f.dels ?? 0, x1 = w - 6 - barW
    return <g key={f.path}>
      {mark === f.path && <rect x={0} y={y - 10} width={w} height={lh} fill="var(--sel, #7ec3e6)" opacity={.16} />}
      <text x={6} y={y} className="dp-ink" style={{fontSize: 9}}><tspan className="dp-axis">{f.status}</tspan> {base(f.path).slice(0, Math.floor((x1 - 60) / 5))}{f.author ? <tspan className="dp-axis"> · {f.author}</tspan> : null}</text>
      <text x={x1 - 4} y={y} textAnchor="end" style={{fontSize: 8.5}}><tspan fill="var(--green)">+{a}</tspan> <tspan fill="var(--rec)">−{d}</tspan></text>
      <rect x={x1} y={y - 6} width={barW * a / max} height={5} fill="var(--green)" opacity={.7} />
      <rect x={x1 + barW * a / max} y={y - 6} width={barW * d / max} height={5} fill="var(--rec)" opacity={.7} />
      <rect x={0} y={y - 10} width={w} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`Open the diff of ${f.path}`}
        data-i={`${base(f.path)}|Show its diff beside the list.`} onClick={() => press(f.path)} onKeyDown={e => { if (e.key === 'Enter') press(f.path) }} />
    </g> })}
    {fs.length > fit && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{fs.length - fit}</text>}
  </g>
}

/** Full's head on the Diff page: the seat's branch and HEAD, the files, the lines and the proposed changes; Changes, Session and Layout. */
function DiffHead({p}: {p: ViewProps}) {
  const v = p.v, fs = changesOf(v), t = fs ? {files: fs.length, adds: fs.reduce((n, f) => n + (f.adds ?? 0), 0), dels: fs.reduce((n, f) => n + (f.dels ?? 0), 0)} : undefined
  return <MonitorHead title="Diff" readings={[
    {label: 'branch', value: strOf(v, 'branch'), does: 'The seat\'s branch.', copy: strOf(v, 'branch')},
    {label: 'HEAD', value: strOf(v, 'head'), does: 'The commit the changes stand on.'},
    {label: 'files', value: t?.files, does: 'The files shown.'},
    {label: 'lines', value: t ? <><span style={{color: 'var(--green)'}}>+{t.adds}</span> <span style={{color: 'var(--rec)'}}>−{t.dels}</span></> : undefined, does: 'Lines added and removed in all the files shown.'},
    {label: 'proposed', value: fs?.filter(f => f.author).length, does: 'Changes an agent proposes, each with its author. Accept them in Approvals.', tone: 'accent'},
  ]} controls={<>
    <Radio {...st(p, 'show')} label="Changes" does="Which changes are listed: those not yet committed, those an agent proposes, or both." value={strOf(v, 'show') ?? ''} options={CHANGES} onChange={x => p.set('show', x)} />
    <Radio {...st(p, 'session')} label="Session" does="Whose changes show: the selected session's, or every session's." value={strOf(v, 'session') ?? ''} options={SESSIONS} onChange={x => p.set('session', x)} />
    <Radio {...st(p, 'layout')} label="Layout" does="How the lines are set out." value={strOf(v, 'layout') ?? ''} options={LAYOUTS} onChange={x => p.set('layout', x)} />
  </>} />
}

const PAGES = [{id: 'files', label: 'Files'}, {id: 'diff', label: 'Diff'}] as const
const pageOf = (p: ViewProps) => (p.page === 'diff' ? 'diff' : 'files')
/** The pane's pages, over its head. */
function PaneTabs({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
    {PAGES.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{x.label}</button>)}
  </div>
}
const diffOf = (p: ViewProps) => scoped(p, 'diff.')

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
    ...prefixed('diff.', {
      show: 'both', session: 'selected', layout: 'unified', branch: 'dlw/build', head: '345d74e', open: 'packages/live-shell/ui/src/shell/widgets.tsx',
      files: JSON.stringify([
        {path: 'packages/live-shell/ui/src/shell/widgets.tsx', status: 'M', adds: 4, dels: 1, patch: '@@ -37,6 +37,9 @@\n const MODE_TILES = [\'packet\', \'trail\', \'field\', \'nows\', \'results\', \'sky\'] as const\n-const AGENT_TILES = [\'sessions\', \'agents\', \'terminal\']\n+const AGENT_TILES = [\'sessions\', \'agents\', \'terminal\', \'files\',\n+  \'web\', \'graph\', \'frames\', \'ledger\', \'approvals\']\n const OWN_BODIES = {packet: PacketWidget, trail: TrailWidget}\n+// A widget with no device elsewhere is born on the rail.\n+export const RAIL_BORN = [\'files\', \'web\']\n export const WIDGETS = ['},
        {path: 'packages/live-shell/ui/src/frame/widgets/deviceWidgets.tsx', status: 'M', adds: 4, dels: 1},
        {path: 'packages/live-shell/ui/tests/f8-widgets.test.mjs', status: 'M', adds: 9, dels: 0},
        {path: 'packages/live-shell/ui/src/shell/railBorn.ts', status: 'A', adds: 22, dels: 0, author: 'Fizz · lead'}]),
    }) as Record<string, string>,
  },
  firstPage: 'files',
  fixtures: {
    'An agent at work': {},
    'Changed only': {show: 'changed', blocked: false},
    'Side by side': {'diff.layout': 'split'},
    'Proposed only': {'diff.show': 'proposed'},
    'No reading': {files: undefined, content: undefined, agent: undefined, reason: 'No agent is selected', 'diff.files': undefined, 'diff.reason': 'No seat is selected'},
  },

  full: p => pageOf(p) === 'diff'
    ? <MonitorPane dark label="Diff" head={<><PaneTabs p={p} /><DiffHead p={diffOf(p)} /></>}>{room => { const d = diffOf(p), lw = Math.round(clampTo(220, 300, room.w * .34)), path = openChange(d.v)?.path
      return <MonitorPicture room={room} label="The files and the diff of one">
        <ChangeList p={d} w={lw} h={room.h} mark={path} press={x => d.set('open', x)} />
        <path d={`M${lw + .5} 0V${room.h}`} className="dp-faint" />
        <g transform={`translate(${lw + 8} 8)`}>
          <text x={room.w - lw - 24} y={10} textAnchor="end" className="dp-axis">{path ?? ''}</text>
          <Patch p={d} w={room.w - lw - 20} h={room.h - 16} size={11} />
        </g>
      </MonitorPicture> }}</MonitorPane>
    : <MonitorPane dark label="Files" head={<><PaneTabs p={p} /><Head p={p} /></>}>{room => { const tw = Math.round(clampTo(220, 300, room.w * .34))
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
