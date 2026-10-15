// The Flow (manual §18.3): the 0/1 conversation or journal kept as one HTML document. Live's nearest: a MIDI clip's note editor —
// the entries are notes on lanes, one lane for each participant, and the line to the entry that a new one answers is the picture.
// The map is drawn by the document's own law (desktop/cradle/src/flow/plural.ts buildThreads): an entry stands under the entry it
// answers, branches from or corrects; a convergence names every entry it draws together; a source and an artifact are refs.
// The readings are the real Factory flow in Control/user/flows (flow-2026-10-03-1432.html) with the person's entries added.
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__flow-document.css'

type V = ViewProps['v']
type Set = ViewProps['set']
type Kind = 'person' | 'agent'
type RelType = 'reply' | 'branch' | 'correct' | 'converge'

/** A participant of the document (meta.participants): initial, name, kind, and how the attribution is bound. */
interface Who {readonly initial: string; readonly name: string; readonly kind: Kind; readonly basis: 'declared' | 'verified' | 'unknown'; readonly left?: boolean}
/** An entry: its author, time, first words, the relation it carries, and how many sources and artifacts it names. */
interface Ent {readonly by: string; readonly at: string; readonly head: string; readonly rel?: {readonly type: RelType; readonly to: readonly number[]}; readonly src?: number; readonly art?: number}
interface Doc {readonly title: string; readonly template: string; readonly plural: boolean; readonly people: readonly Who[]; readonly entries: readonly Ent[]; readonly pages: readonly string[]; readonly media: number}

const YOU: Who = {initial: 'F', name: 'You', kind: 'person', basis: 'unknown'}

/** flow-2026-10-03-1432.html: eight entries by the Factory coordinator, each naming its run and observations as sources and artifacts.
 * Entries 9 to 13 are the person's, added so that the map shows a reply, a branch, a correction and a convergence. */
const FACTORY: Doc = {
  title: 'Factory original development Run — execution and continuation', template: 'v0.4', plural: true, media: 0,
  people: [YOU, {initial: 'C', name: 'Factory coordinator', kind: 'agent', basis: 'declared'}],
  pages: ['Mon 13 Oct', 'Tue 14 Oct', 'Wed 15 Oct'],
  entries: [
    {by: 'C', at: '13:33', head: 'This is the continuation Flow for the existing Factory development Run', src: 3, art: 1},
    {by: 'C', at: '14:44', head: 'The repaired startup image has been installed on Omarchy', src: 2, art: 1},
    {by: 'C', at: '17:01', head: 'The original development Run remains incomplete', src: 2, art: 1},
    {by: 'C', at: '18:18', head: 'The requested two-machine development Run remains incomplete', src: 2, art: 2},
    {by: 'C', at: '18:45', head: 'The original development Run still has seven required units', src: 2, art: 1},
    {by: 'C', at: '19:20', head: 'The original Run remains incomplete', src: 2, art: 1},
    {by: 'C', at: '21:02', head: 'The development Run has not started its workers', src: 2, art: 2},
    {by: 'C', at: '21:55', head: 'The first worker can retain its coordinator', src: 2, art: 2},
    {by: 'F', at: '22:10', head: 'Which unit starts first?', rel: {type: 'reply', to: [4]}},
    {by: 'F', at: '22:14', head: 'What if the repaired image fails?', rel: {type: 'branch', to: [3]}},
    {by: 'C', at: '22:20', head: 'Then the Run stops at the first unit.', rel: {type: 'reply', to: [10]}},
    {by: 'F', at: '22:26', head: 'I meant the second machine.', rel: {type: 'correct', to: [7]}},
    {by: 'C', at: '22:31', head: 'Both lines end at the first unit.', rel: {type: 'converge', to: [9, 11]}},
  ],
}
/** flow-2026-09-14-2236.html: the earlier form (v0.1), three entries, one journal page, no relations. */
const EARLIER: Doc = {
  title: 'Shared field — first curated artifact', template: 'v0.1', plural: false, media: 0,
  people: [{initial: 'F', name: 'the person', kind: 'person', basis: 'unknown'}, {initial: 'H', name: 'the agent', kind: 'agent', basis: 'unknown'}],
  pages: ['Sun 14 Sep'],
  entries: [
    {by: 'F', at: '21:36', head: 'The shared field is the relational environment'},
    {by: 'F', at: '21:36', head: 'This Flow instance is the first curated HTML artifact'},
    {by: 'H', at: '21:36', head: 'Minted on 2026-09-14 by the Lane C session'},
  ],
}
/** flow-2026-10-07-1343.html: a Flow made from the template, with its person and nothing written. */
const BLANK: Doc = {title: '', template: 'v0.4', plural: true, media: 0, people: [YOU], pages: [], entries: []}
const DOCS: Readonly<Record<string, Doc>> = {factory: FACTORY, earlier: EARLIER, blank: BLANK}

/** The accepted agents of the roster that a Flow can bring in (agency/roster.ts; names from Central's guardians). */
const ROSTER = [{id: 'central-guardian', name: 'Central Guardian'}, {id: 'aikit-guardian', name: 'AIKit Guardian'}] as const

const VIEWS = [
  {value: 'dialogue', label: 'Dialogue', does: 'The entries in order, as a conversation.'},
  {value: 'flow', label: 'Flow', does: 'One entry at a time as a full page, with arrows to its neighbours.'},
  {value: 'journal', label: 'Journal', does: 'One person, one page at a time.'},
] as const
const RELATIONS = [
  {value: 'reply', label: 'Reply', does: 'The next entry answers the selected entry.'},
  {value: 'branch', label: 'Branch', does: 'The next entry starts a second line of talk from the selected entry.'},
  {value: 'correct', label: 'Correct', does: 'The next entry says what the selected entry should have said. The selected entry stays.'},
] as const

// ---------------------------------------------------------------- what the document holds, from the values

const docOf = (v: V) => DOCS[str(v, 'doc')]!
const isPlural = (v: V) => docOf(v).plural || on(v, 'upgraded')
const extras = (v: V): Ent[] => { try { return JSON.parse(str(v, 'extra')) as Ent[] } catch { return [] } }
const entriesOf = (v: V): Ent[] => [...docOf(v).entries, ...extras(v)]

/** The letter an agent brought in takes: the first letter of its name that nobody here has (FlowParticipants.tsx initialFor). */
const initialFor = (name: string, used: ReadonlySet<string>) => [...name.toUpperCase().replace(/[^A-Z]/g, ''), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(l => !used.has(l)) ?? '?'
const peopleOf = (v: V): Who[] => {
  const base = [...docOf(v).people], used = new Set(base.map(q => q.initial))
  for (const r of ROSTER) if (on(v, `in:${r.id}`)) { const initial = initialFor(r.name, used); used.add(initial); base.push({initial, name: r.name, kind: 'agent', basis: 'declared'}) }
  return base.map(q => ({...q, left: on(v, `left:${q.initial}`)}))
}
const speakerOf = (v: V) => { const who = peopleOf(v).filter(q => !q.left); return (who.find(q => q.initial === str(v, 'speaker')) ?? who[0])!.initial }
const waiting = (v: V) => ROSTER.filter(r => !on(v, `in:${r.id}`))
const pagesOf = (v: V) => docOf(v).pages.length
const dayNumber = (label: string) => label.split(' ')[1] ?? ''

/** The note under the map: who writes the next entry, to what, and how. */
const nextWords = (v: V) => {
  const sel = num(v, 'entry'), rel = str(v, 'relation')
  return sel > 0 && isPlural(v) ? `${speakerOf(v)} → ${sel} · ${rel}` : `${speakerOf(v)} · new`
}
const corner = (v: V) => {
  const n = entriesOf(v).length, sel = num(v, 'entry')
  return str(v, 'view') === 'journal' ? `${pagesOf(v)} page${pagesOf(v) === 1 ? '' : 's'}` : str(v, 'view') === 'flow' && sel > 0 ? `${sel} of ${n}` : `${n} entr${n === 1 ? 'y' : 'ies'}`
}
const stateWords: Record<string, string> = {saved: 'saved', edited: 'edited', draft: 'draft'}

/** Write one line as the next entry (the widget's line, FlowSurface.tsx save): it joins the Flow, the selection and relation reset. */
function append(p: ViewProps, text: string) {
  const sel = num(p.v, 'entry'), rel = str(p.v, 'relation') as RelType, list = extras(p.v)
  const ent: Ent = {by: speakerOf(p.v), at: `22:${String(40 + list.length).padStart(2, '0')}`, head: text, ...(sel > 0 && isPlural(p.v) ? {rel: {type: rel, to: [sel]}} : {})}
  p.set('extra', JSON.stringify([...list, ent]))
  p.set('state', 'edited')
  p.set('entry', 0)
  p.set('relation', 'reply')
}

// ---------------------------------------------------------------- marks: a person is drawn solid, an agent as points

function WhoMark({kind, dim}: {kind: Kind; dim?: boolean}) {
  return <svg className="flw-mark" width={12} height={12} viewBox="0 0 12 12" aria-hidden style={{color: dim ? 'var(--text-faint)' : 'var(--dp-value)'}}>
    {kind === 'person'
      ? <circle cx={6} cy={6} r={4.4} fill="currentColor" />
      : [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.35} fill="currentColor" />)}
  </svg>
}

// ---------------------------------------------------------------- the display

const LINE = 'var(--text-dim)'
/** An arc from the top of one entry to the top of another, so that a line never runs through a bar. */
function arc(x1: number, y1: number, x2: number, y2: number, lift: number) {
  const bulge = Math.min(24, Math.abs(x2 - x1) * .42 + 5), top = Math.min(y1, y2) - bulge
  return `M${x1.toFixed(1)} ${(y1 + lift).toFixed(1)}Q${((x1 + x2) / 2).toFixed(1)} ${(top + lift).toFixed(1)} ${x2.toFixed(1)} ${(y2 + lift).toFixed(1)}`
}
/** One relation drawn: a reply is a line, a branch is dashed, a correction is doubled, a convergence is dotted with a join. */
function Relation({type, d, d2, hot, dim}: {type: RelType; d: string; d2?: string; hot?: boolean; dim?: boolean}) {
  const stroke = hot ? 'var(--dp-on)' : LINE, common = {fill: 'none', stroke, strokeWidth: hot ? 1.3 : 1, opacity: dim ? .22 : hot ? 1 : .7}
  return <g>
    <path d={d} {...common} strokeDasharray={type === 'branch' ? '3 2' : type === 'converge' ? '1 2' : undefined} />
    {type === 'correct' && d2 && <path d={d2} {...common} />}
  </g>
}

/** The entries on their lanes, one lane for each participant, in the order they arrived; the lines are the relations. Handle 1 selects
 * the entry on the line under the lanes; handle 2 sits on the next entry and chooses who speaks. */
function EntryMap({v, set, w, h, live}: {v: V; set?: Set; w: number; h: number; live: boolean}) {
  const ents = entriesOf(v), N = ents.length, view = str(v, 'view'), sel = num(v, 'entry'), plural = isPlural(v), speaker = speakerOf(v)
  const people = peopleOf(v), lanes = people.filter(q => !q.left || ents.some(e => e.by === q.initial)), L = Math.max(1, lanes.length)
  const top = live ? 26 : 5, bottom = live ? 24 : 5, ly = Math.min(30, (h - top - bottom) / L), y0 = top + (h - top - bottom - ly * L) / 2
  const laneY = (initial: string) => y0 + ly * (Math.max(0, lanes.findIndex(q => q.initial === initial)) + .5)
  const xL = live ? 17 : 6, pitch = Math.min(live ? 16 : 9, (w - xL - 5) / (N + 1)), xOf = (k: number) => xL + (k - .5) * pitch
  const barH = Math.max(6, Math.min(16, ly - 6)), barW = clampTo(2.4, 8, pitch * .56), kindOf = (initial: string) => lanes.find(q => q.initial === initial)?.kind ?? 'person'
  const near = (n: number) => view !== 'flow' || sel === 0 || n === sel || (ents[n - 1]?.rel?.to ?? []).includes(sel) || (ents[sel - 1]?.rel?.to ?? []).includes(n)
  const axisY = h - 9
  const edges = ents.flatMap((e, i) => e.rel ? (e.rel.type === 'converge' ? e.rel.to : e.rel.to.slice(0, 1)).map(t => ({from: i + 1, to: t, type: e.rel!.type})) : [])
  const top1 = (initial: string) => laneY(initial) - barH / 2
  return <g>
    {live && lanes.map(q => <g key={q.initial}>
      <line x1={xL - 4} x2={w - 4} y1={laneY(q.initial)} y2={laneY(q.initial)} className="dp-faint" opacity={.35} />
      <text x={4} y={laneY(q.initial) + 3} className="dp-axis">{q.initial}</text>
    </g>)}
    {view === 'flow' && sel > 0 && <rect x={xOf(sel) - pitch / 2} y={top - 2} width={pitch} height={h - top - bottom + 4} className="dp-fill-on" />}
    {edges.map((e, i) => {
      const a = ents[e.from - 1]!, b = ents[e.to - 1]
      if (!b) return null
      const x1 = xOf(e.from), x2 = xOf(e.to), y1 = top1(a.by), y2 = top1(b.by), hot = view === 'flow' && (e.from === sel || e.to === sel)
      return <Relation key={i} type={e.type} d={arc(x1, y1, x2, y2, 0)} d2={arc(x1, y1, x2, y2, 2)} hot={hot} dim={!near(e.from) && !near(e.to)} />
    })}
    {ents.map((e, i) => {
      const n = i + 1, x = xOf(n), y = laneY(e.by), kind = kindOf(e.by), o = near(n) ? 1 : .3
      return <g key={n} opacity={o}>
        {kind === 'person'
          ? <rect x={x - barW / 2} y={y - barH / 2} width={barW} height={barH} fill="var(--dp-value)" />
          : [-1, 0, 1].map(k => <circle key={k} cx={x} cy={y + k * barH / 3} r={clampTo(1, 1.9, barW / 2.4)} fill="var(--dp-value)" />)}
        {live && !!e.src && <line x1={x - barW / 2 + .6} x2={x - barW / 2 + .6} y1={y - barH / 2 - 1.5} y2={y - barH / 2 - 1.5 - Math.min(e.src, 3) * 1.4} stroke="var(--text-dim)" strokeWidth={1} />}
        {live && !!e.art && <line x1={x - barW / 2 + .6} x2={x - barW / 2 + .6} y1={y + barH / 2 + 1.5} y2={y + barH / 2 + 1.5 + Math.min(e.art, 3) * 1.4} stroke="var(--text-dim)" strokeWidth={1} />}
        {n === sel && <rect x={x - barW / 2 - 2.5} y={y - barH / 2 - 2.5} width={barW + 5} height={barH + 5} fill="none" stroke="var(--dp-on)" strokeWidth={1.3} />}
      </g>
    })}
    {N === 0 && <text x={w / 2} y={top + 12} textAnchor="middle" className="dp-axis">Nothing written yet.</text>}
    {live && <>
      <text x={4} y={11} className="dp-ink-dim">{nextWords(v)}</text>
      <line x1={xOf(0)} x2={w - 5} y1={axisY} y2={axisY} className="dp-faint" />
      {Array.from({length: N + 1}, (_, k) => <line key={k} x1={xOf(k)} x2={xOf(k)} y1={axisY - 3} y2={axisY + 3} stroke={k === sel ? 'var(--dp-on)' : 'var(--text-faint)'} strokeWidth={1} />)}
    </>}
    {/* the next entry: on the speaker's lane, joined to the selected entry by the relation that you set */}
    {live && sel > 0 && plural && ents[sel - 1] && <Relation type={str(v, 'relation') as RelType} hot d={arc(xOf(N + 1), laneY(speaker) - barH / 2, xOf(sel), top1(ents[sel - 1]!.by), 0)}
      d2={arc(xOf(N + 1), laneY(speaker) - barH / 2, xOf(sel), top1(ents[sel - 1]!.by), 2)} />}
    <rect x={xOf(N + 1) - barW / 2} y={laneY(speaker) - barH / 2} width={barW} height={barH} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} strokeDasharray="2 2" />
    {live && set && <>
      <Handle x={xOf(sel)} y={axisY} n={1} shape="ring" label="Entry" does="Drag along the line to select the entry that the next entry connects to. Drag to the start for none."
        onDrag={N ? x => set('entry', clampTo(0, N, Math.round((x - xL) / pitch + .5))) : undefined} onReset={() => set('entry', 0)} />
      <Handle x={xOf(N + 1)} y={laneY(speaker)} n={2} label="Speak as" does="Drag up or down to choose who the next entry belongs to."
        onDrag={(_, y) => { const who = lanes.filter(q => !q.left); if (who.length) set('speaker', who.reduce((best, q) => Math.abs(laneY(q.initial) - y) < Math.abs(laneY(best.initial) - y) ? q : best).initial) }} />
    </>}
  </g>
}

/** The journal as its pages: a short run of cards with the current one lit. Handle 1 chooses the page. */
function PageStrip({v, set, w, h, live}: {v: V; set?: Set; w: number; h: number; live: boolean}) {
  const pages = docOf(v).pages, P = pages.length, cur = clampTo(1, Math.max(1, P), num(v, 'page'))
  if (!P) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-axis">No journal pages.</text>
  const slot = live ? 30 : 13, cw = live ? 26 : 10, K = Math.max(1, Math.min(P, Math.floor((w - 12) / slot))), start = clampTo(0, P - K, cur - 1 - Math.floor(K / 2))
  const x0 = (w - (K * slot - (slot - cw))) / 2, cy = live ? 40 : 8, ch = live ? 50 : h - 16
  const xOf = (j: number) => x0 + j * slot
  return <g>
    {Array.from({length: K}, (_, j) => {
      const at = start + j + 1, now = at === cur
      return <g key={at}>
        <rect x={xOf(j)} y={cy} width={cw} height={ch} className={now ? 'dp-fill-on' : 'dp-faint'} style={now ? {stroke: 'var(--dp-on)', strokeWidth: 1.3} : undefined} />
        {live && [0, 1, 2, 3].map(r => <line key={r} x1={xOf(j) + 4} x2={xOf(j) + cw - 4 - (r === 3 ? 8 : 0)} y1={cy + 11 + r * 8} y2={cy + 11 + r * 8} className="dp-faint" opacity={.5} />)}
        {live && <text x={xOf(j) + cw / 2} y={cy + ch + 11} textAnchor="middle" className={now ? 'dp-ink' : 'dp-axis'}>{dayNumber(pages[at - 1]!)}</text>}
      </g>
    })}
    {live && start > 0 && <text x={4} y={cy + ch / 2 + 3} className="dp-axis">‹</text>}
    {live && start + K < P && <text x={w - 4} y={cy + ch / 2 + 3} textAnchor="end" className="dp-axis">›</text>}
    {live && <>
      <text x={4} y={11} className="dp-ink-dim">journal</text>
      <text x={w / 2} y={cy + ch + 28} textAnchor="middle" className="dp-ink">Page {cur} of {P}</text>
      <text x={w / 2} y={cy + ch + 41} textAnchor="middle" className="dp-ink-dim">{pages[cur - 1]}</text>
    </>}
    {live && set && <Handle x={xOf(cur - 1 - start) + cw / 2} y={cy - 10} n={1} shape="ring" label="Page" does="Drag along the pages to choose the page to read."
      onDrag={P > 1 ? x => set('page', clampTo(1, P, start + clampTo(0, K - 1, Math.round((x - x0 - cw / 2) / slot)) + 1)) : undefined} onReset={() => set('page', P)} />}
  </g>
}

function Picture({v, set, w, h, live}: {v: V; set?: Set; w: number; h: number; live: boolean}) {
  return str(v, 'view') === 'journal' ? <PageStrip v={v} set={set} w={w} h={h} live={live} /> : <EntryMap v={v} set={set} w={w} h={h} live={live} />
}
const MAP_DOES = 'Each bar is an entry, on its author\'s row. A line joins an entry to the one it answers. Handle 1 selects an entry; handle 2 chooses who speaks.'

// ---------------------------------------------------------------- controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

function ViewRadio({p}: {p: ViewProps}) {
  return <Radio label="View" does="How the page shows the entries: Dialogue, Flow or Journal." value={str(p.v, 'view')} options={VIEWS} stack onChange={x => p.set('view', x)} />
}
const JOURNAL = 'A Journal page is not an entry. Set View to Dialogue or Flow.'
function RelationRadio({p}: {p: ViewProps}) {
  const none = str(p.v, 'view') === 'journal' ? JOURNAL : !isPlural(p.v) ? 'Upgrade the Flow first. An earlier form has no relations.' : num(p.v, 'entry') === 0 ? 'Select an entry first.' : undefined
  return <Radio label="Relation" does="How the next entry connects to the selected entry." value={str(p.v, 'relation')} options={RELATIONS} stack onChange={x => p.set('relation', x)} disabled={none} />
}
function SpeakAs({p}: {p: ViewProps}) {
  const who = peopleOf(p.v).filter(q => !q.left)
  return <Chooser label="Speak as" does="Who the next entry belongs to. A participant that you add does not start." value={speakerOf(p.v)}
    options={who.map(q => ({value: q.initial, label: q.name}))} onChange={x => p.set('speaker', x)} disabled={str(p.v, 'view') === 'journal' ? JOURNAL : undefined} />
}
function EntryBox({p, wide}: {p: ViewProps; wide?: boolean}) {
  const N = entriesOf(p.v).length
  return <ValueBox wide={wide} label="Entry" does="The entry that the next entry connects to. New starts a line of its own." value={Math.min(num(p.v, 'entry'), N)} def={0}
    scale={{min: 0, max: Math.max(1, N), step: 1}} format={x => (x === 0 ? 'New' : `${x}`)} onChange={x => p.set('entry', x)}
    disabled={str(p.v, 'view') === 'journal' ? JOURNAL : N === 0 ? 'Nothing is written yet.' : undefined} />
}
function PageBox({p, wide}: {p: ViewProps; wide?: boolean}) {
  const P = pagesOf(p.v)
  return <ValueBox wide={wide} label="Page" does="The Journal page that you read, numbered from the first. The date shows in the display." value={clampTo(1, Math.max(2, P), num(p.v, 'page'))} def={Math.max(1, P)}
    scale={{min: 1, max: Math.max(2, P), step: 1}} format={x => (P === 0 ? 'None' : `${x} / ${P}`)} onChange={x => p.set('page', x)}
    disabled={P === 0 ? 'This Flow has no journal pages.' : P === 1 ? 'This Flow has one journal page.' : undefined} />
}
/** The fourth macro follows the view: the entry in Dialogue and Flow, the page in Journal. */
function Place({p}: {p: ViewProps}) { return str(p.v, 'view') === 'journal' ? <PageBox p={p} wide /> : <EntryBox p={p} wide /> }

function participantRows(v: V, set: Set, page: number, onPage: (n: number) => void) {
  const items: RowItem[] = peopleOf(v).map(q => ({
    id: q.initial, name: q.name, light: q.left ? 'dark' : 'lit', tone: 'value', request: q.left ? undefined : true,
    why: q.left ? 'Left this Flow. Its entries stay.' : undefined, note: q.initial, mark: <WhoMark kind={q.kind} dim={q.left} />,
  }))
  return <Rows label="Participants" does="Everyone in the exchange. The square is your request: press it to let a participant leave. Their entries stay." items={items} size={4} page={page} onPage={onPage}
    onRequest={(id, x) => { if (x) return; set(`left:${id}`, true); set('state', 'edited'); if (str(v, 'speaker') === id) { const next = peopleOf(v).find(q => q.initial !== id && !q.left); if (next) set('speaker', next.initial) } }} />
}
function BringIn({p}: {p: ViewProps}) {
  const rest = waiting(p.v), pick = rest.find(r => r.id === str(p.v, 'bring'))?.id ?? rest[0]?.id ?? 'none', why = !isPlural(p.v) ? 'Upgrade the Flow first.' : undefined
  return <>
    <Chooser label="Bring in" does="An accepted agent of the roster. Joining records a participant. It starts nothing." value={pick}
      options={rest.length ? rest.map(r => ({value: r.id, label: r.name})) : [{value: 'none', label: 'Everyone is here'}]} onChange={x => p.set('bring', x)} disabled={why} />
    <Action label="Add" does="Add the chosen agent as a participant. It does not start, and it is not proof of who wrote." disabled={why ?? (rest.length ? undefined : 'Every accepted agent is here.')}
      onPress={() => { p.set(`in:${pick}`, true); p.set('state', 'edited'); p.set('bring', rest.find(r => r.id !== pick)?.id ?? 'none') }} />
  </>
}

/** Save is the document's own revision-checked write: it names saved when edits went in and unchanged when there were none. */
function save(p: ViewProps) {
  if (str(p.v, 'state') === 'edited') { p.set('revision', num(p.v, 'revision') + 1); p.set('state', 'saved'); p.set('save', 'saved') } else p.set('save', 'unchanged')
}

// ---------------------------------------------------------------- the views

function Whole({p}: {p: ViewProps}) {
  const [at, setAt] = useState(0)
  const v = p.v, n = entriesOf(v).length, plural = isPlural(v), doc = docOf(v), edited = str(v, 'state') === 'edited'
  return <Panel title="Flow" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The entries" does={MAP_DOES} corner={corner(v)}>
          <Picture v={v} set={p.set} w={194} h={146} live />
        </Display>
      </Section>
      <Section label="Page" width={92}>
        <ViewRadio p={p} />
        <PageBox p={p} />
      </Section>
      <Section label="Next entry" grow>
        <EntryBox p={p} />
        <RelationRadio p={p} />
        <SpeakAs p={p} />
      </Section>
    </Band>
    <Band>
      <Section label="People" width={160}>
        {participantRows(v, p.set, at, setAt)}
        <BringIn p={p} />
      </Section>
      <Section label="Document" cols={4} grow>
        <Readout label="revision" does="The revision that the owner holds. A save checks it." value={`r${num(v, 'revision')}`} />
        <Readout label="state" does="Saved: the owner holds this revision. Edited: the page holds edits that the owner does not." value={stateWords[str(v, 'state')]} tone={edited ? 'accent' : 'green'} />
        <Readout label="template" does="The template version that this Flow opened with. It keeps it until you upgrade." value={plural ? 'v0.4' : doc.template} tone={plural ? undefined : 'stall'} />
        <Readout label="save" does="What the last save did: saved, unchanged, stale, conflict or refused." value={str(v, 'save') || 'none'} />
        <Readout label="entries" does="Entries in the dialogue." value={n} />
        <Readout label="pages" does="Pages in the journal." value={pagesOf(v)} />
        <Readout label="media" does="Files attached to entries, up to 12 MB each. Add them on the page." value={doc.media} />
        {plural ? <div /> : <Action label="Upgrade" does="Change the earlier form to the current one. Every entry stays." onPress={() => { p.set('upgraded', true); p.set('state', 'edited') }} />}
        <Action label="Save" does="Write the page to the native source. The owner checks the revision first." onPress={() => save(p)} />
        <Action label="Re-read" does="Read the current document again. Edits that the owner does not hold are dropped." onPress={() => { p.set('state', 'saved'); p.set('save', '') }} />
      </Section>
    </Band>
  </Panel>
}

/** The widget: the last entries, and a line for the next one. */
function Lines({v}: {v: V}) {
  const ents = entriesOf(v), who = peopleOf(v), last = ents.slice(-4)
  if (!last.length) return <ul className="flw-last"><li className="flw-last-empty" data-i="Entries|Nothing is written yet.">Nothing is written yet.</li></ul>
  return <ul className="flw-last">{last.map((e, i) => {
    const q = who.find(w => w.initial === e.by), n = ents.length - last.length + i + 1
    return <li key={n} data-i={`${q?.name ?? e.by}|${e.head}`}><WhoMark kind={q?.kind ?? 'person'} /><span>{e.head}</span><time>{e.at}</time></li>
  })}</ul>
}
function Compose({p}: {p: ViewProps}) {
  const [text, setText] = useState('')
  const send = () => { if (text.trim()) { append(p, text.trim()); setText('') } }
  return <div className="flw-compose" data-i="Next entry|Write a line and press Enter. It joins the Flow as the person in Speak as, with the relation that you set.">
    <span className="flw-to">{nextWords(p.v)}</span>
    <input aria-label="Next entry" value={text} placeholder="Write the next entry" onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }} />
  </div>
}

export const design: DesignedDevice = {
  id: 'central:flow-document',
  title: 'Flow',
  kind: 'instrument',
  defaults: {
    light: 'lit', doc: 'factory', extra: '[]', upgraded: false,
    view: 'dialogue', entry: 11, relation: 'reply', speaker: 'F', page: 3, bring: 'central-guardian',
    // Readings: what the owner reports for the document, never set from here.
    revision: 8, state: 'edited', save: '',
  },
  fixtures: {
    'Factory run': {},
    'Earlier form': {doc: 'earlier', entry: 3, page: 1, revision: 1, state: 'saved'},
    'New Flow': {doc: 'blank', entry: 0, page: 1, revision: 0, state: 'saved'},
  },

  folded: p => <Folded title="Flow" light={light(p.v)} readings={[peopleOf(p.v).filter(q => !q.left).map(q => q.initial).join(' '), `${entriesOf(p.v).length} entries`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Flow" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The entries" does={MAP_DOES} corner={corner(p.v)}>
        <Picture v={p.v} set={p.set} w={140} h={146} live />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={126}>
      <ViewRadio p={p} />
      <RelationRadio p={p} />
      <div style={{gridColumn: 'span 2', width: '100%'}}><SpeakAs p={p} /></div>
      <div style={{gridColumn: 'span 2', width: '100%'}}><Place p={p} /></div>
    </Section>
  </Panel>,

  whole: p => <Whole p={p} />,

  full: () => <div className="ref-pane-body">
    <iframe className="ref-pane-frame" title="The Flow's page, as the template draws it" src={`${__CRADLE_DOCUMENTS__}/ql-flow.html`} />
  </div>,

  widget: p => <Tile title="Flow" light={light(p.v)} span={2} onFull={p.nav.full}>
    <div className="flw-wid">
      <div className="flw-wid-top">
        <Display w={76} h={68} label="The entries" does="Each bar is an entry, on its author's row.">
          <Picture v={p.v} w={76} h={68} live={false} />
        </Display>
        <Lines v={p.v} />
      </div>
      <Compose p={p} />
    </div>
  </Tile>,
}

