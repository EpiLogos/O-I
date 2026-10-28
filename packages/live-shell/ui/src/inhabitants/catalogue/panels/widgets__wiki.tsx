// Wiki (manual §23.7): the wiki pages an agent may use, read here and never edited. A device born on the rail; Live's nearest is the
// Info View — a page of text beside the work, with its links. The display is the page as its owner reads it: its title and kind, then
// its lines, each link underlined in teal where it resolves and left as it is, faint and dashed, where it does not; a link the reading
// names `external` leads out of the wiki and is its own kind, a solid faint line that opens nothing here (the wiki is read, not left). The pages stand
// as dots down the right edge; the one the agent read last is ringed in amber; the handle sits on the page shown.
//
// Owners, keyed on their paths:
//   pages     the wiki's nodes (Control/agents/wiki/wiki.json or a project's, read by files_list and file_read: WikiNode ref, title, type).
//   body      the page as the knowledge owner reads it (kernel op knowledge, `aikit.markdown-reading/v1`): its lines, and its links as
//             [{line, from, to, target, state}] from the reading's occurrences (state resolved, unresolved, ambiguous or external).
//   page      the page shown; readLast the page the selected agent read last (its encounter's prepared_context_receipts).
// Follow is the monitor's own. The entry's Reads only has no owner: nothing reports the scope's reads, so it is not offered.
//
// A monitor (manual §16.3): it stands on the rail and in a pane, and has two views. The tile is the page shown, its links followable,
// with the pages as dots down its right edge and handle 1 on the one shown; its title opens the page in Full. Full's head carries the
// page's kind, its links and the page the agent read last, with Page and Follow; its body is every page beside the page shown.
import {Chooser, Display, Handle, Tile, Toggle} from '../../sdk/panel'
import {boolOf, clampTo, json, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane, MonitorPicture} from './monitor'

type V = ViewProps['v']

interface Node {readonly ref: string; readonly title: string; readonly type: string}
interface Link {readonly line: number; readonly from: number; readonly to: number; readonly target: string; readonly state: string}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const pagesOf = (v: V): Node[] | undefined => { const raw = json<unknown>(v, 'pages', undefined)
  return Array.isArray(raw) ? raw.flatMap((e): Node[] => rec(e) && typeof e.ref === 'string' ? [{ref: e.ref, title: String(e.title ?? e.ref), type: String(e.type ?? '')}] : []) : undefined }
const bodyOf = (v: V) => { const raw = json<unknown>(v, 'body', undefined); if (!rec(raw) || !Array.isArray(raw.lines)) return undefined
  return {lines: raw.lines.filter((l): l is string => typeof l === 'string'), links: Array.isArray(raw.links) ? raw.links.flatMap((e): Link[] => rec(e) && Number.isInteger(e.line) && Number.isInteger(e.from) && Number.isInteger(e.to)
    ? [{line: e.line as number, from: e.from as number, to: e.to as number, target: String(e.target ?? ''), state: String(e.state ?? 'unresolved')}] : []) : []} }
const pageOf = (v: V) => { const ps = pagesOf(v), r = strOf(v, 'page'); return ps?.find(x => x.ref === r) ?? ps?.[0] }

/** The page and its links: a press on a link that resolves shows its page. `pager`: the pages as dots down the right edge, handle 1 on the
 * page shown. `press`: a press on the title opens the page in Full. */
function WikiPage({p, w, h, pager, size = 9, press}: {p: ViewProps; w: number; h: number; pager: boolean; size?: number; press?: () => void}) {
  const v = p.v, pages = pagesOf(v), pg = pageOf(v), body = bodyOf(v), right = pager ? 16 : 4, lh = size + 4.5, cw = size * .6, room = Math.floor((w - 10 - right) / cw), ps = st(p, 'page')
  if (!pg) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the wiki'}</text>
  const idx = pages!.findIndex(x => x.ref === pg.ref), dotY = (i: number) => 12 + i * Math.min(12, (h - 22) / Math.max(1, pages!.length - 1)), readLast = strOf(v, 'readLast')
  const fit = Math.floor((h - 30) / lh)
  return <g>
    <text x={6} y={13} className="dp-ink" style={{fontSize: size + 1.5, cursor: press ? 'pointer' : undefined}} onClick={press} role={press ? 'button' : undefined}
      data-i={press ? `${pg.title}|Open the page in Full.` : undefined}>{pg.title.slice(0, room - 8)}</text>
    <text x={w - right - 2} y={13} textAnchor="end" className="dp-axis">{pg.type}</text>
    <path d={`M4 18H${w - right}`} className="dp-faint" />
    {!body && <text x={6} y={32} className="dp-ink-dim">No reading of the page</text>}
    {body?.lines.slice(0, fit).map((line, i) => { const y = 30 + i * lh
      return <g key={i}>
        <text x={6} y={y} className="dp-ink-dim dp-mono" style={{fontSize: size, whiteSpace: 'pre'}}>{line.slice(0, room)}</text>
        {body.links.filter(l => l.line === i && l.from < room).map((l, j) => { const resolved = l.state === 'resolved', external = l.state === 'external', x = 6 + l.from * cw, x2 = 6 + Math.min(l.to, room) * cw
          return <g key={j} data-link={l.state}>
            <path d={`M${x.toFixed(1)} ${y + 2}H${x2.toFixed(1)}`} stroke={resolved ? 'var(--dp-value)' : 'var(--text-faint, #71767c)'} strokeWidth={1} strokeDasharray={resolved || external ? undefined : '2 2'} />
            <rect x={x} y={y - size} width={x2 - x} height={size + 4} fill="transparent" style={{cursor: resolved ? 'pointer' : 'default'}}
              data-i={resolved ? `${l.target}|Follow the link.` : external ? `${l.target}|An external link: it leads out of the wiki, and Wiki opens nothing outside it.` : `${l.target}|This link does not resolve: it shows as it is.`}
              onClick={() => { const t = pages!.find(n => n.ref === l.target); if (resolved && t) p.set('page', t.ref) }} />
          </g> })}
      </g> })}
    {pager && pages!.map((x, i) => <g key={x.ref}><circle cx={w - 8} cy={dotY(i)} r={2.2} fill={i === idx ? 'var(--dp-value)' : 'none'} className={i === idx ? undefined : 'dp-faint'} />
      {x.ref === readLast && <circle cx={w - 8} cy={dotY(i)} r={4.5} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}</g>)}
    {pager && <Handle n={1} x={w - 8} y={dotY(idx)} label="Page" does={`Drag up or down: the page shown.${ps.disabled ? ` ${ps.disabled}` : ''}`}
      onDrag={ps.disabled ? undefined : (_, y) => { const i = clampTo(0, pages!.length - 1, Math.round((y - 12) / Math.min(12, (h - 22) / Math.max(1, pages!.length - 1)))); if (i !== idx) p.set('page', pages![i]!.ref) }} />}
  </g>
}

const LIGHT_WHY = 'Wiki has no on or off: it only reads. The light stays hollow.'
const linkCounts = (v: V) => { const b = bodyOf(v); return b ? {resolved: b.links.filter(l => l.state === 'resolved').length, external: b.links.filter(l => l.state === 'external').length,
  open: b.links.filter(l => l.state !== 'resolved' && l.state !== 'external').length} : undefined }
const DISPLAY_DOES = 'The page as the wiki reads it. A link in teal resolves; a link that does not resolve shows as it is, dashed; an external link, a plain line, leads out of the wiki. The amber ring marks the page the agent read last.'

/** Full's head: the page's kind, its links, the page the agent read last; Page and Follow. */
function Head({p}: {p: ViewProps}) {
  const v = p.v, pages = pagesOf(v), pg = pageOf(v), n = linkCounts(v), last = pages?.find(x => x.ref === strOf(v, 'readLast'))
  return <MonitorHead title="Wiki" readings={[
    {label: 'kind', value: pg?.type || undefined, does: 'The kind of the page shown.'},
    {label: 'links', value: n?.resolved, does: 'Links on the page that resolve.', tone: 'value'},
    {label: 'open', value: n?.open, does: 'Links on the page that do not resolve.'},
    {label: 'external', value: n?.external, does: 'Links on the page that lead out of the wiki.'},
    {label: 'read last', value: last?.title, does: 'The page the selected agent read last.', tone: 'accent'},
  ]} controls={<>
    <Chooser {...st(p, 'page')} label="Page" does="The page to show." value={pg?.ref ?? ''} options={(pages ?? []).map(x => ({value: x.ref, label: x.title}))} onChange={x => p.set('page', x)}
      disabled={st(p, 'page').disabled ?? (pages?.length ? undefined : 'No wiki page is read.')} />
    <Toggle {...st(p, 'follow')} label="Follow" does="Show the page the selected agent read last." on={boolOf(v, 'follow') === true} unknown={boolOf(v, 'follow') === undefined}
      onChange={x => { p.set('follow', x); if (x && strOf(v, 'readLast')) p.set('page', strOf(v, 'readLast')) }} />
  </>} />
}

/** Every page of the wiki the agent may use: its title and kind, the one shown marked, the one the agent read last ringed in amber. */
function PageList({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const pages = pagesOf(p.v), pg = pageOf(p.v), last = strOf(p.v, 'readLast'), lh = 40, room = Math.floor((w - 34) / 6)
  if (!pages) return <text x={14} y={24} className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'No reading of the wiki'}</text>
  return <g>{pages.slice(0, Math.floor((h - 8) / lh)).map((x, i) => { const y = 8 + i * lh, on = x.ref === pg?.ref
    return <g key={x.ref} role="button" tabIndex={0} aria-label={`Show ${x.title}`} onClick={() => p.set('page', x.ref)} onKeyDown={e => { if (e.key === 'Enter') p.set('page', x.ref) }}
      data-i={`${x.title}|${x.ref === last ? 'The page the agent read last. ' : ''}Show the page.`}>
      <rect x={0} y={y} width={w} height={lh - 2} fill={on ? 'var(--sel, #7ec3e6)' : 'transparent'} opacity={on ? .16 : 1} />
      {on && <rect x={0} y={y} width={2} height={lh - 2} fill="var(--sel, #7ec3e6)" />}
      {x.ref === last && <circle cx={w - 14} cy={y + 12} r={4.5} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
      <text x={14} y={y + 16} className="dp-ink" style={{fontSize: 11}}>{x.title.slice(0, room)}</text>
      <text x={14} y={y + 30} className="dp-axis" style={{fontSize: 9}}>{x.type}</text>
    </g> })}</g>
}

export const design = railAndPane({
  id: 'widgets:wiki',
  title: 'Wiki',
  kind: 'monitor',
  defaults: {
    follow: true, page: 'wiki:node:seat-guard', readLast: 'wiki:node:seat-guard',
    pages: JSON.stringify([
      {ref: 'wiki:node:seat-guard', title: 'Seat guard: use seats', type: 'learning'},
      {ref: 'wiki:node:shared-seat', title: 'Shared seat: neighbours commit', type: 'learning'},
      {ref: 'wiki:node:device-ui', title: 'Device UI standard', type: 'intent'},
      {ref: 'wiki:node:owner', title: 'The owner', type: 'identity'}]),
    body: JSON.stringify({lines: ['Workcells are the persistent shared tracks: env-1,', 'env-2 and env-3, one seat per product. Join a seat', 'through the seat instrument; never add a tree.', '', 'Neighbours commit the tree: see Shared seat.', 'Commit by path only. See also Worktree lanes.'],
      links: [{line: 4, from: 32, to: 43, target: 'wiki:node:shared-seat', state: 'resolved'}, {line: 5, from: 30, to: 44, target: 'wiki:node:worktree-lanes', state: 'unresolved'}]}),
  },
  fixtures: {
    'The page the agent read': {},
    // A page whose reading names a link out of the wiki (the knowledge owner's occurrence state `external`).
    'An external link': {body: JSON.stringify({lines: ['The device rules follow Ableton\'s manual:', 'https://www.ableton.com/en/manual/ for the shapes.'], links: [{line: 1, from: 0, to: 33, target: 'https://www.ableton.com/en/manual/', state: 'external'}]})},
    'Another page': {page: 'wiki:node:device-ui', body: JSON.stringify({lines: ['A device must show its state at a glance, answer', 'the hand at once and never ask you to read.', '', 'Its panel is drawn after Live\'s own devices.'], links: []})},
    'No reading': {pages: undefined, body: undefined, page: undefined, readLast: undefined, reason: 'The wiki did not answer'},
  },

  full: p => <MonitorPane dark label="Wiki" head={<Head p={p} />}>{room => { const lw = Math.round(clampTo(200, 260, room.w * .3))
    return <MonitorPicture room={room} label="The pages and the page">
      <PageList p={p} w={lw} h={room.h} />
      <path d={`M${lw + .5} 0V${room.h}`} className="dp-faint" />
      <g transform={`translate(${lw + 10} 10)`}><WikiPage p={p} w={room.w - lw - 20} h={room.h - 24} pager={false} size={13} /></g>
      <text x={room.w - 12} y={room.h - 8} textAnchor="end" className="dp-axis">read here, edited only by a return</text>
    </MonitorPicture> }}</MonitorPane>,

  widget: p => <Tile title="Wiki" light="unknown" lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Page" does={`${DISPLAY_DOES} Drag handle 1 for another page. Click the title to read it in Full.`}><WikiPage p={p} w={266} h={104} pager size={8.5} press={p.nav.full} /></Display>
  </Tile>,
})
