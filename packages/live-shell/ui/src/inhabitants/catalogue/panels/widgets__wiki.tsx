// Wiki (manual §23.7): the wiki pages an agent may use, read here and never edited. A device born on the rail; Live's nearest is the
// Info View — a page of text beside the work, with its links. The display is the page as its owner reads it: its title and kind, then
// its lines, each link underlined in teal where it resolves and left as it is, faint and dashed, where it does not. The pages stand
// as dots down the right edge; the one the agent read last is ringed in amber; the handle sits on the page shown.
//
// Owners, keyed on their paths:
//   pages     the wiki's nodes (Control/agents/wiki/wiki.json or a project's, read by files_list and file_read: WikiNode ref, title, type).
//   body      the page as the knowledge owner reads it (kernel op knowledge, `aikit.markdown-reading/v1`): its lines, and its links as
//             [{line, from, to, target, state}] from the reading's occurrences (state resolved, unresolved, ambiguous or external).
//   page      the page shown; readLast the page the selected agent read last (its encounter's prepared_context_receipts).
// Follow is the tile's own. The entry's Reads only has no owner: nothing reports the scope's reads, so it is not offered.
import {Band, Chooser, Display, Folded, Handle, Panel, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'

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

/** The page and its links. `pager`: the pages as dots down the right edge, handle 1 on the page shown. `follow`: a press on a link that
 * resolves shows its page. */
function WikiPage({p, w, h, pager, size = 9}: {p: ViewProps; w: number; h: number; pager: boolean; size?: number}) {
  const v = p.v, pages = pagesOf(v), pg = pageOf(v), body = bodyOf(v), right = pager ? 16 : 4, lh = size + 4.5, cw = size * .6, room = Math.floor((w - 10 - right) / cw), ps = st(p, 'page')
  if (!pg) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the wiki'}</text>
  const idx = pages!.indexOf(pg), dotY = (i: number) => 12 + i * Math.min(12, (h - 22) / Math.max(1, pages!.length - 1)), readLast = strOf(v, 'readLast')
  const fit = Math.floor((h - 30) / lh)
  return <g>
    <text x={6} y={13} className="dp-ink" style={{fontSize: size + 1.5}}>{pg.title.slice(0, room - 8)}</text>
    <text x={w - right - 2} y={13} textAnchor="end" className="dp-axis">{pg.type}</text>
    <path d={`M4 18H${w - right}`} className="dp-faint" />
    {!body && <text x={6} y={32} className="dp-ink-dim">No reading of the page</text>}
    {body?.lines.slice(0, fit).map((line, i) => { const y = 30 + i * lh
      return <g key={i}>
        <text x={6} y={y} className="dp-ink-dim" style={{fontSize: size, fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', whiteSpace: 'pre'}}>{line.slice(0, room)}</text>
        {body.links.filter(l => l.line === i && l.from < room).map((l, j) => { const resolved = l.state === 'resolved', x = 6 + l.from * cw, x2 = 6 + Math.min(l.to, room) * cw
          return <g key={j}>
            <path d={`M${x.toFixed(1)} ${y + 2}H${x2.toFixed(1)}`} stroke={resolved ? 'var(--dp-value)' : 'var(--text-faint, #71767c)'} strokeWidth={1} strokeDasharray={resolved ? undefined : '2 2'} />
            <rect x={x} y={y - size} width={x2 - x} height={size + 4} fill="transparent" style={{cursor: resolved ? 'pointer' : 'default'}}
              data-i={resolved ? `${l.target}|Follow the link.` : `${l.target}|This link does not resolve: it shows as it is.`}
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
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const linkCounts = (v: V) => { const b = bodyOf(v); return b ? {resolved: b.links.filter(l => l.state === 'resolved').length, open: b.links.filter(l => l.state !== 'resolved').length} : undefined }
const DISPLAY_DOES = 'The page as the wiki reads it. A link in teal resolves; a link that does not resolve shows as it is. The amber ring marks the page the agent read last.'

function controls(p: ViewProps) {
  const v = p.v, pages = pagesOf(v) ?? []
  return {
    page: <Chooser {...st(p, 'page')} wide label="Page" does="The page to show." value={pageOf(v)?.ref ?? ''} options={pages.map(x => ({value: x.ref, label: x.title}))} onChange={x => p.set('page', x)}
      disabled={st(p, 'page').disabled ?? (pages.length ? undefined : 'No wiki page is read.')} />,
    follow: <Toggle {...st(p, 'follow')} label="Follow" does="Show the page the selected agent read last." on={boolOf(v, 'follow') === true} unknown={boolOf(v, 'follow') === undefined}
      onChange={x => { p.set('follow', x); if (x && strOf(v, 'readLast')) p.set('page', strOf(v, 'readLast')) }} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:wiki',
  title: 'Wiki',
  kind: 'instrument',
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
    'Another page': {page: 'wiki:node:device-ui', body: JSON.stringify({lines: ['A device must show its state at a glance, answer', 'the hand at once and never ask you to read.', '', 'Its panel is drawn after Live\'s own devices.'], links: []})},
    'No reading': {pages: undefined, body: undefined, page: undefined, readLast: undefined, reason: 'The wiki did not answer'},
  },

  folded: p => <Folded title="Wiki" light="unknown" readings={[pageOf(p.v)?.title ?? NONE, pageOf(p.v)?.type ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Wiki" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={232}>
        <Display w={220} h={146} label="Page" does={`${DISPLAY_DOES} Drag handle 1 for another page.`}><WikiPage p={p} w={220} h={146} pager size={8.5} /></Display>
      </Section>
      <Section label="Macros" width={104}>{c.page}{c.follow}</Section>
    </Panel> },

  whole: p => { const c = controls(p), n = linkCounts(p.v), w = wide(p) ? Math.round(clampTo(240, p.room!.w - 260, 600)) : 240
    return <Panel title="Wiki" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Page" does={`${DISPLAY_DOES} Drag handle 1 for another page.`}><WikiPage p={p} w={w} h={146} pager size={8.5} /></Display>
        </Section>
        <Section label="Page" grow>{c.page}{c.follow}
          <div className="ref-pair">
            <Readout label="links" does="Links on the page that resolve." value={n?.resolved} tone="value" />
            <Readout label="open" does="Links on the page that do not resolve." value={n?.open} />
          </div>
        </Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMinYMin meet" className="ref-pane-svg" aria-label="The wiki page">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <g transform="translate(10 10)"><WikiPage p={p} w={740} h={400} pager={false} size={13} /></g>
        <text x={750} y={410} textAnchor="end" className="dp-axis">read here, edited only by a return</text>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Wiki" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Page" does={`${DISPLAY_DOES} Press ▦ to read it in a pane.`}><WikiPage p={p} w={266} h={104} pager={false} size={8.5} /></Display>
  </Tile>,
}
