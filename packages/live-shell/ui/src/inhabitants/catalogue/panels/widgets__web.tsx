// Web (manual §23.4): the pages an agent read, each as the agent got it, with the text it used marked. A device born on the rail; Live's
// nearest is the browser's preview, the file at the top and its contents under it. The display is the page: its address on the first
// line, its text under it as the agent got it, each passage the agent used under a teal mark. The pages stand as dots down the right
// edge, newest at the top; the handle sits on the page shown.
//
// Owners, keyed on their paths:
//   pages     [{url, title, at, lines, used?}]: the pages the agent fetched, from its encounter tape (desktop/cradle/src/agent/tape/model.ts:
//             a `fetch` call, or a tool named fetch or web_fetch, is a `read`; the address is its title or first location, the text its
//             output). `used` would be the passages the agent used, as [line, from, to]; no owner reports them yet, so a page that
//             carries none says so.
//   page      the address shown; agent the agent followed.
// Mark used text and Follow are the tile's own.
import {Band, Chooser, Display, Folded, Handle, Panel, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

interface Page {readonly url: string; readonly title: string; readonly at?: string; readonly lines: readonly string[]; readonly used?: readonly (readonly [number, number, number])[]}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function pagesOf(v: V): Page[] | undefined {
  const raw = json<unknown>(v, 'pages', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Page[] => rec(e) && typeof e.url === 'string' ? [{url: e.url, title: String(e.title ?? e.url), at: typeof e.at === 'string' ? e.at : undefined,
    lines: Array.isArray(e.lines) ? e.lines.filter((l): l is string => typeof l === 'string') : [],
    used: Array.isArray(e.used) ? e.used.filter((u): u is [number, number, number] => Array.isArray(u) && u.length === 3 && u.every(n => Number.isInteger(n))) : undefined}] : [])
}
const pageOf = (v: V) => { const ps = pagesOf(v), u = strOf(v, 'page'); return ps?.find(x => x.url === u) ?? ps?.[0] }
const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

/** The page: its address, then its lines, the used passages marked when Mark is on. `pager`: the pages as dots down the right edge,
 * handle 1 on the page shown. */
function PageView({p, w, h, pager, size = 9, press}: {p: ViewProps; w: number; h: number; pager: boolean; size?: number; press?: () => void}) {
  const v = p.v, pages = pagesOf(v), pg = pageOf(v), mark = boolOf(v, 'mark') !== false, right = pager ? 16 : 4, lh = size + 4, cw = size * .6
  const room = Math.floor((w - 10 - right) / cw), fit = Math.floor((h - 26) / lh)
  if (!pg) return <text x={6} y={18} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No page read'}</text>
  const idx = pages!.indexOf(pg), dotY = (i: number) => 14 + i * Math.min(12, (h - 24) / Math.max(1, pages!.length - 1)), ps = st(p, 'page')
  return <g>
    <text x={6} y={12} className="dp-ink" style={{fontSize: size, cursor: press ? 'pointer' : undefined}} onClick={press} role={press ? 'button' : undefined}
      data-i={press ? `${host(pg.url)}|Open the page in the pane that has focus.` : undefined}>{host(pg.url).slice(0, room)}</text>
    <path d={`M4 17H${w - right}`} className="dp-faint" />
    {pg.lines.slice(0, fit).map((line, i) => { const y = 28 + i * lh, marks = mark ? (pg.used ?? []).filter(u => u[0] === i) : []
      return <g key={i}>
        {marks.map((m, j) => { const a = Math.min(m[1], room), b = Math.min(m[2], room); return b > a ? <rect key={j} x={6 + a * cw} y={y - size + 1} width={(b - a) * cw} height={size + 2} className="dp-fill" stroke="var(--dp-value)" strokeWidth={.6} /> : null })}
        <text x={6} y={y} className="dp-ink-dim" style={{fontSize: size, fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', whiteSpace: 'pre'}}>{line.slice(0, room)}</text>
      </g> })}
    {mark && !pg.used && <text x={w - right - 2} y={h - 4} textAnchor="end" className="dp-axis">no reading of the used text</text>}
    {pager && pages!.map((x, i) => <circle key={x.url} cx={w - 8} cy={dotY(i)} r={2.2} fill={i === idx ? 'var(--dp-value)' : 'none'} className={i === idx ? undefined : 'dp-faint'} />)}
    {pager && <Handle n={1} x={w - 8} y={dotY(idx)} label="Page" does={`Drag up or down: the page shown, the newest at the top.${ps.disabled ? ` ${ps.disabled}` : ''}`}
      onDrag={ps.disabled ? undefined : (_, y) => { const i = clampTo(0, pages!.length - 1, Math.round((y - 14) / Math.min(12, (h - 24) / Math.max(1, pages!.length - 1)))); if (i !== idx) p.set('page', pages![i]!.url) }} />}
  </g>
}

const LIGHT_WHY = 'Web has no on or off: it only reads. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DISPLAY_DOES = 'The page as the agent got it. The text the agent used is marked.'

function controls(p: ViewProps) {
  const v = p.v, pages = pagesOf(v) ?? []
  return {
    page: <Chooser {...st(p, 'page')} wide label="Page" does="The page to show." value={pageOf(v)?.url ?? ''} options={pages.map(x => ({value: x.url, label: x.title}))} onChange={x => p.set('page', x)}
      disabled={st(p, 'page').disabled ?? (pages.length ? undefined : 'No page read.')} />,
    mark: <Toggle {...st(p, 'mark')} label="Mark used" does="Mark the text the agent used." on={boolOf(v, 'mark') !== false} onChange={x => p.set('mark', x)} />,
    follow: <Toggle {...st(p, 'follow')} label="Follow" does="Show the page the selected agent read last." on={boolOf(v, 'follow') === true} unknown={boolOf(v, 'follow') === undefined} onChange={x => p.set('follow', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:web',
  title: 'Web',
  kind: 'instrument',
  defaults: {
    mark: true, follow: true, agent: 'Fizz · lead', page: 'https://www.ableton.com/en/manual/max-for-live-devices/',
    pages: JSON.stringify([
      {url: 'https://www.ableton.com/en/manual/max-for-live-devices/', title: 'Max for Live devices', at: '14:22', lines: ['Max for Live devices', '', 'LFO and Shaper are modulators: each maps one', 'parameter at a time. Click Map, then click any', 'parameter in the set. The depth sets how far', 'the modulator moves it, from its own value.', '', 'A mapped parameter shows its modulation range', 'as a ring round its knob.'],
        used: [[2, 0, 46], [5, 0, 38], [7, 0, 45]]},
      {url: 'https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode', title: 'BiquadFilterNode', at: '14:09', lines: ['BiquadFilterNode', '', 'The BiquadFilterNode interface represents a', 'simple low-order filter. It is an AudioNode', 'that can represent tone control devices.'], used: [[2, 4, 44]]},
      {url: 'https://www.w3.org/TR/webaudio/', title: 'Web Audio API', at: '13:51', lines: ['Web Audio API', '', 'This specification describes a high-level', 'Web API for processing and synthesizing audio.'], used: []}]),
  },
  fixtures: {
    'Pages an agent read': {},
    'As the tape has it': {pages: JSON.stringify([{url: 'https://www.w3.org/TR/webaudio/', title: 'Web Audio API', at: '13:51', lines: ['Web Audio API', '', 'This specification describes a high-level', 'Web API for processing and synthesizing audio.']}])},
    'No reading': {pages: undefined, page: undefined, reason: 'No page read by the selected agent'},
  },

  folded: p => <Folded title="Web" light="unknown" readings={[pageOf(p.v) ? host(pageOf(p.v)!.url).split('/')[0]! : NONE, `${pagesOf(p.v)?.length ?? NONE} pages`]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Web" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={212}>
        <Display w={200} h={146} label="Page" does={`${DISPLAY_DOES} Drag handle 1 for another page.`}><PageView p={p} w={200} h={146} pager size={8.5} /></Display>
      </Section>
      <Section label="Macros" width={96}>{c.page}{c.mark}{c.follow}</Section>
    </Panel> },

  whole: p => { const c = controls(p), pg = pageOf(p.v), w = wide(p) ? Math.round(clampTo(240, p.room!.w - 300, 600)) : 240
    return <Panel title="Web" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="Page" does={`${DISPLAY_DOES} Drag handle 1 for another page. Click the address to open it.`}><PageView p={p} w={w} h={146} pager size={8.5} press={p.nav.full} /></Display>
        </Section>
        <Section label="Page" grow>{c.page}{c.follow}{c.mark}
          <Readout label="read at" does="When the agent read the page." value={pg?.at} tone="value" />
        </Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMinYMin meet" className="ref-pane-svg" aria-label="The page">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <text x={16} y={22} className="dp-ink" style={{fontSize: 13}}>{pageOf(p.v)?.title ?? NONE}</text>
        <text x={744} y={22} textAnchor="end" className="dp-axis">{pageOf(p.v) ? `read at ${pageOf(p.v)!.at ?? NONE} by ${strOf(p.v, 'agent') ?? NONE}` : ''}</text>
        <g transform="translate(10 30)"><PageView p={{...p, set: () => {}}} w={740} h={380} pager={false} size={12} /></g>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Web" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={266} h={104} label="Page" does={`${DISPLAY_DOES} Click the address to open the page in a pane.`}><PageView p={p} w={266} h={104} pager={false} size={8.5} press={p.nav.full} /></Display>
  </Tile>,
}
