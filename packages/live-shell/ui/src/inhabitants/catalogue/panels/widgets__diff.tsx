// Diff (manual §23.4): the changes not yet committed, and the changes an agent proposes, read before you approve them. A device born on
// the rail; Live's nearest is the clip's Notes and Envelopes editor — the material line by line, what is added and what is taken out.
// The display is the diff itself: the lines of a file's patch, an added line on a green ground, a removed line on a red one, a hunk's
// head faint; side by side, the old lines at the left and the new at the right. On the rail it is the list of changed files, each with
// a bar of its lines added (green) and removed (red).
//
// Owners, keyed on their paths:
//   files     [{path, status, adds, dels, patch?, author?}]: the seat's diff (`central.git-diff/v1` DiffFile `new_path`, `status` A, M or D,
//             `adds`, `dels`, `patch`; kernel op git_diff_read, from HEAD to the working tree). `author` would mark a proposed change; no
//             owner reports proposed changes yet (a consent request carries a tool call, not a patch), so a fixture of the seat has none.
//   branch, head  the seat's branch and HEAD (git_repository_read); open the file shown full.
// Show, Session and Layout are the monitor's own (the renderer holds a layout only for its session: git/diffModel.ts DiffLayout).
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the list of changed files, with Show in
// one small row under it (its list has no handle); a file pressed there opens its diff in Full. Full's head carries the branch, HEAD,
// the files, the lines and the proposed changes, with Show, Session and Layout; its body is the files beside the diff of the one
// opened, with Layout as handle 1 on the diff.
import {Display, Handle, Radio, Tile} from '../../sdk/panel'
import {clampTo, json, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, MonitorPicture} from './monitor'

type V = ViewProps['v']

const SHOWS = [{value: 'uncommitted', label: 'Uncommitted', does: 'The changes not yet committed.'}, {value: 'proposed', label: 'Proposed', does: 'The changes an agent proposes.'},
  {value: 'both', label: 'Both', does: 'Both kinds of change.'}] as const
const SESSIONS = [{value: 'selected', label: 'Selected', does: 'The changes of the selected session.'}, {value: 'all', label: 'All', does: 'The changes of every session.'}] as const
const LAYOUTS = [{value: 'unified', label: 'Unified', does: 'The lines in one column.'}, {value: 'split', label: 'Split', does: 'Side by side: the old lines at the left, the new at the right.'}] as const
interface File {readonly path: string; readonly status: string; readonly adds?: number; readonly dels?: number; readonly patch?: string; readonly author?: string}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function filesOf(v: V): File[] | undefined {
  const raw = json<unknown>(v, 'files', undefined)
  if (!Array.isArray(raw)) return undefined
  const show = strOf(v, 'show') ?? 'both'
  return raw.flatMap((e): File[] => rec(e) && typeof e.path === 'string' ? [{path: e.path, status: String(e.status ?? 'M'), adds: Number.isInteger(e.adds) ? e.adds as number : undefined,
    dels: Number.isInteger(e.dels) ? e.dels as number : undefined, patch: typeof e.patch === 'string' ? e.patch : undefined, author: typeof e.author === 'string' ? e.author : undefined}] : [])
    .filter(f => show === 'both' || (show === 'proposed' ? f.author !== undefined : f.author === undefined))
}
const openOf = (v: V) => { const fs = filesOf(v), o = strOf(v, 'open'); return fs?.find(f => f.path === o) ?? fs?.find(f => f.patch) ?? fs?.[0] }
const base = (path: string) => path.split('/').pop() ?? path

/** A patch's lines, each with its kind; side by side, the removed lines stand at the left and the added at the right. */
function linesOf(patch: string | undefined) { return (patch ?? '').split('\n').filter(l => l.length).map(l => ({kind: l.startsWith('@@') ? 'hunk' : l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx', text: l.startsWith('@@') ? l : l.slice(1)})) }

/** The patch of one file. `divider`: handle 1, the layout — drag it to the middle to set the lines side by side, to the left edge for one column. */
function Patch({p, w, h, size = 8.5, divider}: {p: ViewProps; w: number; h: number; size?: number; divider: boolean}) {
  const v = p.v, f = openOf(v), split = strOf(v, 'layout') === 'split', lh = size + 3.5, cw = size * .6, top = 15, fit = Math.floor((h - top - 3) / lh), ls = st(p, 'layout')
  if (!f) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? (filesOf(v) ? 'No change to show' : 'No reading of the diff')}</text>
  const all = linesOf(f.patch), col = split ? (w - 8) / 2 : w - 8, room = Math.floor((col - 4) / cw)
  const rows: {l?: {kind: string; text: string}; r?: {kind: string; text: string}}[] = split
    ? (() => { const out: {l?: {kind: string; text: string}; r?: {kind: string; text: string}}[] = []; let dels: {kind: string; text: string}[] = []
        for (const x of all) { if (x.kind === 'del') { dels.push(x); continue } if (x.kind === 'add') { const d = dels.shift(); out.push({l: d, r: x}); continue }
          for (const d of dels) out.push({l: d}); dels = []; out.push({l: x, r: x}) } for (const d of dels) out.push({l: d}); return out })()
    : all.map(x => ({l: x}))
  const line = (x: {kind: string; text: string} | undefined, x0: number, y: number, k: string) => x && <g key={k}>
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
    {divider && <Handle n={1} shape="square" x={dx} y={top + 4} label="Layout" does={`Drag to the middle to set the lines side by side, to the left edge for one column.${ls.disabled ? ` ${ls.disabled}` : ''}`}
      onDrag={ls.disabled ? undefined : x => { const next = x > w * .3 ? 'split' : 'unified'; if (next !== strOf(v, 'layout')) p.set('layout', next) }} onReset={ls.disabled ? undefined : () => p.set('layout', 'unified')} />}
  </g>
}
const f1 = (x: number) => x.toFixed(1)

/** The changed files, each with its bar of lines added and removed. `press` opens a file's diff; `mark` is the file opened. */
function FileList({p, w, h, press, mark, top = 22}: {p: ViewProps; w: number; h: number; press?: (path: string) => void; mark?: string; top?: number}) {
  const fs = filesOf(p.v), lh = 13, fit = Math.floor((h - top + 6) / lh), max = Math.max(1, ...(fs ?? []).map(f => (f.adds ?? 0) + (f.dels ?? 0))), barW = Math.min(70, w * .3)
  if (!fs) return <text x={6} y={18} className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'No reading of the diff'}</text>
  if (!fs.length) return <text x={6} y={18} className="dp-ink-dim">No change to show</text>
  return <g>{fs.slice(0, fit).map((f, i) => { const y = top + i * lh, a = f.adds ?? 0, d = f.dels ?? 0, x1 = w - 6 - barW
    return <g key={f.path}>
      {mark === f.path && <rect x={0} y={y - 10} width={w} height={lh} fill="var(--sel, #7ec3e6)" opacity={.16} />}
      <text x={6} y={y} className="dp-ink" style={{fontSize: 9}}><tspan className="dp-axis">{f.status}</tspan> {base(f.path).slice(0, Math.floor((x1 - 60) / 5))}{f.author ? <tspan className="dp-axis"> · {f.author}</tspan> : null}</text>
      <text x={x1 - 4} y={y} textAnchor="end" style={{fontSize: 8.5}}><tspan fill="var(--green)">+{a}</tspan> <tspan fill="var(--rec)">−{d}</tspan></text>
      <rect x={x1} y={y - 6} width={barW * a / max} height={5} fill="var(--green)" opacity={.7} />
      <rect x={x1 + barW * a / max} y={y - 6} width={barW * d / max} height={5} fill="var(--rec)" opacity={.7} />
      {press && <rect x={0} y={y - 10} width={w} height={lh} fill="transparent" style={{cursor: 'pointer'}} role="button" tabIndex={0} aria-label={`Open the diff of ${f.path}`}
        data-i={`${base(f.path)}|Open its diff in the pane that has focus.`} onClick={() => press(f.path)} onKeyDown={e => { if (e.key === 'Enter') press(f.path) }} />}
    </g> })}
    {fs.length > fit && <text x={w - 6} y={h - 3} textAnchor="end" className="dp-axis">+{fs.length - fit}</text>}
  </g>
}

const LIGHT_WHY = 'Diff has no on or off: it only reads. The light stays hollow.'
const totals = (v: V) => { const fs = filesOf(v); return fs ? {files: fs.length, adds: fs.reduce((n, f) => n + (f.adds ?? 0), 0), dels: fs.reduce((n, f) => n + (f.dels ?? 0), 0)} : undefined }
const openDiff = (p: ViewProps) => (path: string) => { p.set('open', path); p.nav.full?.() }

function controls(p: ViewProps) {
  const v = p.v
  return {
    show: <Radio {...st(p, 'show')} label="Show" does="Which changes the tile lists." value={strOf(v, 'show') ?? ''} options={SHOWS} onChange={x => p.set('show', x)} />,
    session: <Radio {...st(p, 'session')} label="Session" does="Whose changes to show." value={strOf(v, 'session') ?? ''} options={SESSIONS} onChange={x => p.set('session', x)} />,
    layout: <Radio {...st(p, 'layout')} label="Layout" does="How the lines are set out." value={strOf(v, 'layout') ?? ''} options={LAYOUTS} onChange={x => p.set('layout', x)} />,
  }
}

/** Full's head: the seat's branch and HEAD, the files, the lines and the proposed changes; Show, Session and Layout. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, t = totals(v), c = controls(p)
  return <MonitorHead title="Diff" readings={[
    {label: 'branch', value: strOf(v, 'branch'), does: 'The seat\'s branch.', copy: strOf(v, 'branch')},
    {label: 'HEAD', value: strOf(v, 'head'), does: 'The commit the changes stand on.'},
    {label: 'files', value: t?.files, does: 'The files shown.'},
    {label: 'lines', value: t ? <><span style={{color: 'var(--green)'}}>+{t.adds}</span> <span style={{color: 'var(--rec)'}}>−{t.dels}</span></> : undefined, does: 'Lines added and removed in all the files shown.'},
    {label: 'proposed', value: filesOf(v)?.filter(f => f.author).length, does: 'Changes an agent proposes. Accept them in Approvals.', tone: 'accent'},
  ]} controls={<>{c.show}{c.session}{c.layout}</>} />
}

export const design = railAndPane({
  id: 'widgets:diff',
  title: 'Diff',
  kind: 'monitor',
  defaults: {
    show: 'both', session: 'selected', layout: 'unified', branch: 'dlw/build', head: '345d74e', open: 'packages/live-shell/ui/src/shell/widgets.tsx',
    files: JSON.stringify([
      {path: 'packages/live-shell/ui/src/shell/widgets.tsx', status: 'M', adds: 4, dels: 1, patch: '@@ -37,6 +37,9 @@\n const MODE_TILES = [\'packet\', \'trail\', \'field\', \'nows\', \'results\', \'sky\'] as const\n-const AGENT_TILES = [\'sessions\', \'agents\', \'terminal\']\n+const AGENT_TILES = [\'sessions\', \'agents\', \'terminal\', \'files\',\n+  \'web\', \'graph\', \'diff\', \'frames\', \'ledger\', \'approvals\']\n const OWN_BODIES = {packet: PacketWidget, trail: TrailWidget}\n+// A widget with no device elsewhere is born on the rail.\n+export const RAIL_BORN = [\'files\', \'web\', \'diff\']\n export const WIDGETS = ['},
      {path: 'packages/live-shell/ui/src/frame/widgets/deviceWidgets.tsx', status: 'M', adds: 4, dels: 1},
      {path: 'packages/live-shell/ui/tests/f8-widgets.test.mjs', status: 'M', adds: 9, dels: 0},
      {path: 'packages/live-shell/ui/src/shell/railBorn.ts', status: 'A', adds: 22, dels: 0, author: 'Fizz · lead'}]),
  },
  fixtures: {
    'The seat and a proposal': {},
    'Side by side': {layout: 'split'},
    'Proposed only': {show: 'proposed'},
    'No reading': {files: undefined, reason: 'No seat is selected'},
  },

  full: p => <MonitorPane dark label="Diff" head={<Head p={p} />}>{room => { const lw = Math.round(clampTo(220, 300, room.w * .34)), path = openOf(p.v)?.path
    return <MonitorPicture room={room} label="The files and the diff of one">
      <FileList p={p} w={lw} h={room.h} top={20} mark={path} press={x => p.set('open', x)} />
      <path d={`M${lw + .5} 0V${room.h}`} className="dp-faint" />
      <g transform={`translate(${lw + 8} 8)`}>
        <text x={room.w - lw - 24} y={10} textAnchor="end" className="dp-axis">{path ?? ''}</text>
        <Patch p={p} w={room.w - lw - 20} h={room.h - 16} size={11} divider />
      </g>
    </MonitorPicture> }}</MonitorPane>,

  widget: p => <Tile title="Diff" light="unknown" lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
    <div className="mon-tile">
      <Display w={266} h={82} label="Changed files" does="The files that changed in the selected session. Click one to open its diff in Full.">
        <FileList p={p} w={266} h={82} top={13} press={openDiff(p)} />
      </Display>
      <div className="mon-tile-row">{controls(p).show}</div>
    </div>
  </Tile>,
})
