// The Flow (manual §18.1): the 0/1 conversation or journal kept as one HTML document. Live's nearest: a MIDI clip's note editor —
// the entries are notes on lanes, one lane for each participant, and the line to the entry that a new one answers is the picture.
// The map is drawn by the document's own law (desktop/cradle/src/flow/plural.ts buildThreads): an entry stands under the entry it
// answers, branches from or corrects; a convergence names every entry it draws together; a source and an artifact are refs.
// The document arrives on the keys title, template, plural, people, entries, pages and media (people, entries and pages as JSON),
// and the agents it can bring in on roster. The sample content in `defaults` and `fixtures` is the real Factory flow in
// Control/user/flows (flow-2026-10-03-1432.html) with the person's entries added. A key the owner has not reported is drawn "—".
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, clock, cradleDocuments, json, numOf, on, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__flow-document.css'

type V = ViewProps['v']
type Setter = ViewProps['set']
type Kind = 'person' | 'agent'
type RelType = 'reply' | 'branch' | 'correct' | 'converge'

/** A participant of the document (meta.participants): initial, name, kind, and how the attribution is bound. */
interface Who {readonly initial: string; readonly name: string; readonly kind: Kind; readonly basis: 'declared' | 'verified' | 'unknown'; readonly left?: boolean}
/** An entry: its author, time, first words, the relation it carries, and how many sources and artifacts it names. */
interface Ent {readonly by: string; readonly at: string; readonly head: string; readonly rel?: {readonly type: RelType; readonly to: readonly number[]}; readonly src?: number; readonly art?: number}
/** An accepted agent of the roster that a Flow can bring in (agency/roster.ts). */
interface Agent {readonly id: string; readonly name: string}
/** A row of the entry map: a participant, or an author that the people list does not name (its kind is then unread). */
interface Lane {readonly initial: string; readonly kind: Kind | undefined; readonly left?: boolean}

/** The template version that an upgraded Flow takes: the current form's own name. */
const CURRENT_FORM = 'v0.4'

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
const RELATION_TYPES: readonly string[] = ['reply', 'branch', 'correct', 'converge']

// ---------------------------------------------------------------- what the document holds, from the values

const text = (x: unknown) => (typeof x === 'string' ? x : typeof x === 'number' && Number.isFinite(x) ? String(x) : '')
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const record = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})
/** A list carried as JSON: undefined when the owner reports none, or when what arrives is not a list. */
const listOf = (v: V, key: string): unknown[] | undefined => { const x = json<unknown>(v, key, undefined); return Array.isArray(x) ? x : undefined }

const entOf = (x: unknown): Ent => {
  const e = record(x), r = record(e.rel), type = RELATION_TYPES.includes(text(r.type)) ? (r.type as RelType) : undefined
  return {by: text(e.by) || NONE, at: text(e.at) || NONE, head: text(e.head) || NONE, src: count(e.src), art: count(e.art),
    rel: type ? {type, to: (Array.isArray(r.to) ? r.to : []).filter((n): n is number => typeof n === 'number' && Number.isFinite(n))} : undefined}
}
const whoOf = (x: unknown): Who => {
  const q = record(x)
  return {initial: text(q.initial), name: text(q.name), kind: q.kind === 'agent' ? 'agent' : 'person', basis: q.basis === 'declared' || q.basis === 'verified' ? q.basis : 'unknown'}
}

/** What the page itself has written and not yet saved (the widget's line). */
const extras = (v: V): Ent[] => (listOf(v, 'extra') ?? []).map(entOf)
/** The entries, or undefined when the owner reports none. */
const entriesOf = (v: V): Ent[] | undefined => listOf(v, 'entries')?.map(entOf).concat(extras(v))
const pagesOf = (v: V): string[] | undefined => listOf(v, 'pages')?.map(x => text(x))
const rosterOf = (v: V): Agent[] | undefined => listOf(v, 'roster')?.map(x => { const r = record(x); return {id: text(r.id), name: text(r.name)} }).filter(r => r.id)
/** The Flow is in the current form: the owner says so, or the page has upgraded it. Undefined when nobody has said. */
const pluralOf = (v: V): boolean | undefined => (on(v, 'upgraded') ? true : boolOf(v, 'plural'))
const relationOf = (v: V): RelType | undefined => { const r = strOf(v, 'relation'); return r && RELATION_TYPES.includes(r) ? (r as RelType) : undefined }

/** The letter an agent brought in takes: the first letter of its name that nobody here has (FlowParticipants.tsx initialFor). */
const initialFor = (name: string, used: ReadonlySet<string>) => [...name.toUpperCase().replace(/[^A-Z]/g, ''), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(l => !used.has(l)) ?? '?'
/** The participants, or undefined when the owner reports none. The agents that the page brought in and the ones that left are its own edits. */
const peopleOf = (v: V): Who[] | undefined => {
  const read = listOf(v, 'people')
  if (!read) return undefined
  const base = read.map(whoOf).filter((q, i, all) => q.initial && all.findIndex(z => z.initial === q.initial) === i), used = new Set(base.map(q => q.initial))
  for (const r of rosterOf(v) ?? []) if (on(v, `in:${r.id}`)) { const initial = initialFor(r.name, used); used.add(initial); base.push({initial, name: r.name, kind: 'agent', basis: 'declared'}) }
  return base.map(q => ({...q, left: on(v, `left:${q.initial}`)}))
}
/** Who writes the next entry: the chosen participant, if that one is here. Undefined when nobody is chosen. */
const speakerOf = (v: V): string | undefined => { const s = strOf(v, 'speaker'); return peopleOf(v)?.find(q => !q.left && q.initial === s)?.initial }
const dayNumber = (label: string) => label.split(' ')[1] || NONE
/** Whether the page holds edits that the owner does not: a line written, a Flow upgraded, an agent brought in, a participant let go. */
const edited = (v: V) => extras(v).length > 0 || on(v, 'upgraded') || Object.keys(v).some(k => (k.startsWith('left:') || k.startsWith('in:')) && v[k] === true)

/** The note under the map: who writes the next entry, to what, and how. */
const nextWords = (v: V) => {
  const who = speakerOf(v) ?? NONE, sel = numOf(v, 'entry'), plural = pluralOf(v)
  if (sel === undefined) return `${who} · ${NONE}`
  return sel > 0 && plural !== false ? `${who} → ${sel} · ${plural ? relationOf(v) ?? NONE : NONE}` : `${who} · new`
}
const corner = (v: V) => {
  const view = strOf(v, 'view'), n = entriesOf(v)?.length, pages = pagesOf(v)?.length, sel = numOf(v, 'entry')
  if (view === 'journal') return pages === undefined ? NONE : `${pages} page${pages === 1 ? '' : 's'}`
  if (n === undefined) return NONE
  return view === 'flow' && sel !== undefined && sel > 0 ? `${sel} of ${n}` : `${n} entr${n === 1 ? 'y' : 'ies'}`
}
/** What stops a line from joining the Flow, in words; undefined when nothing does. */
const composeBlock = (v: V): string | undefined => {
  const sel = numOf(v, 'entry'), plural = pluralOf(v)
  return !entriesOf(v) ? 'No reading of the entries.'
    : !peopleOf(v) ? 'No reading of the people.'
    : speakerOf(v) === undefined ? 'No reading of who speaks.'
    : sel === undefined ? 'No reading of the selected entry.'
    : sel > 0 && plural === undefined ? 'No reading of the template form.'
    : sel > 0 && plural && !relationOf(v) ? 'No reading of the relation.'
    : undefined
}

/** Write one line as the next entry (the widget's line, FlowSurface.tsx save): it joins the page's edits, the selection and relation reset. */
function append(p: ViewProps, line: string) {
  const speaker = speakerOf(p.v), sel = numOf(p.v, 'entry'), relation = relationOf(p.v)
  if (composeBlock(p.v) || speaker === undefined || sel === undefined) return
  const now = new Date()
  const ent: Ent = {by: speaker, at: clock(now.getHours() * 60 + now.getMinutes()), head: line, ...(sel > 0 && pluralOf(p.v) && relation ? {rel: {type: relation, to: [sel]}} : {})}
  p.set('extra', JSON.stringify([...extras(p.v), ent]))
  p.set('entry', 0)
  p.set('relation', 'reply')
}

// ---------------------------------------------------------------- marks: a person is drawn solid, an agent as points, an unread kind hollow

function WhoMark({kind, dim}: {kind: Kind | undefined; dim?: boolean}) {
  return <svg className="flw-mark" width={12} height={12} viewBox="0 0 12 12" aria-hidden style={{color: dim ? 'var(--text-faint)' : 'var(--dp-value)'}}>
    {kind === 'person' ? <circle cx={6} cy={6} r={4.4} fill="currentColor" />
      : kind === 'agent' ? [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.35} fill="currentColor" />)
      : <circle cx={6} cy={6} r={3.8} fill="none" stroke="currentColor" strokeWidth={1.2} />}
  </svg>
}

// ---------------------------------------------------------------- the display

const LINE = 'var(--text-dim)'
/** The well, when a reading that the picture needs is missing: the missing readings, named. */
function Unread({w, h, what}: {w: number; h: number; what: readonly string[]}) {
  const lines = ['No reading', ...what.map(x => `of the ${x}`)]
  return <g>{lines.map((line, i) => <text key={line} x={w / 2} y={h / 2 + (i - (lines.length - 1) / 2) * 11 + 3} textAnchor="middle" className="dp-axis">{line}</text>)}</g>
}
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
function EntryMap({v, set, w, h, live}: {v: V; set?: Setter; w: number; h: number; live: boolean}) {
  const ents = entriesOf(v), people = peopleOf(v)
  if (!ents || !people) return <Unread w={w} h={h} what={[...(ents ? [] : ['entries']), ...(people ? [] : ['people'])]} />
  const N = ents.length, view = strOf(v, 'view'), chosen = numOf(v, 'entry'), sel = clampTo(0, N, chosen ?? 0)
  const plural = pluralOf(v), speaker = speakerOf(v), relation = relationOf(v)
  const strangers = [...new Set(ents.map(e => e.by))].filter(by => !people.some(q => q.initial === by))
  const lanes: Lane[] = [...people.filter(q => !q.left || ents.some(e => e.by === q.initial)), ...strangers.map(initial => ({initial, kind: undefined}))], L = Math.max(1, lanes.length)
  const top = live ? 26 : 5, bottom = live ? 24 : 5, ly = Math.min(30, (h - top - bottom) / L), y0 = top + (h - top - bottom - ly * L) / 2
  const laneY = (initial: string) => y0 + ly * (Math.max(0, lanes.findIndex(q => q.initial === initial)) + .5)
  const xL = live ? 17 : 6, pitch = Math.min(live ? 16 : 9, (w - xL - 5) / (N + 1)), xOf = (k: number) => xL + (k - .5) * pitch
  const barH = Math.max(6, Math.min(16, ly - 6)), barW = clampTo(2.4, 8, pitch * .56), kindOf = (initial: string) => lanes.find(q => q.initial === initial)?.kind
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
        {kind === 'person' ? <rect x={x - barW / 2} y={y - barH / 2} width={barW} height={barH} fill="var(--dp-value)" />
          : kind === 'agent' ? [-1, 0, 1].map(k => <circle key={k} cx={x} cy={y + k * barH / 3} r={clampTo(1, 1.9, barW / 2.4)} fill="var(--dp-value)" />)
          : <rect x={x - barW / 2 + .5} y={y - barH / 2 + .5} width={Math.max(1, barW - 1)} height={barH - 1} fill="none" stroke="var(--dp-value)" strokeWidth={1} />}
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
    {live && sel > 0 && plural && relation && speaker !== undefined && ents[sel - 1] && <Relation type={relation} hot d={arc(xOf(N + 1), laneY(speaker) - barH / 2, xOf(sel), top1(ents[sel - 1]!.by), 0)}
      d2={arc(xOf(N + 1), laneY(speaker) - barH / 2, xOf(sel), top1(ents[sel - 1]!.by), 2)} />}
    {speaker !== undefined && <rect x={xOf(N + 1) - barW / 2} y={laneY(speaker) - barH / 2} width={barW} height={barH} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} strokeDasharray="2 2" />}
    {live && set && chosen !== undefined && <Handle x={xOf(sel)} y={axisY} n={1} shape="ring" label="Entry" does="Drag along the line to select the entry that the next entry connects to. Drag to the start for none."
      onDrag={N ? x => set('entry', clampTo(0, N, Math.round((x - xL) / pitch + .5))) : undefined} onReset={() => set('entry', 0)} />}
    {live && set && speaker !== undefined && <Handle x={xOf(N + 1)} y={laneY(speaker)} n={2} label="Speak as" does="Drag up or down to choose who the next entry belongs to."
      onDrag={(_, y) => { const who = people.filter(q => !q.left); if (who.length) set('speaker', who.reduce((best, q) => Math.abs(laneY(q.initial) - y) < Math.abs(laneY(best.initial) - y) ? q : best).initial) }} />}
  </g>
}

/** The journal as its pages: a short run of cards with the current one lit. Handle 1 chooses the page. */
function PageStrip({v, set, w, h, live}: {v: V; set?: Setter; w: number; h: number; live: boolean}) {
  const pages = pagesOf(v)
  if (!pages) return <Unread w={w} h={h} what={['pages']} />
  const P = pages.length, chosen = numOf(v, 'page'), cur = chosen === undefined ? 0 : clampTo(1, Math.max(1, P), chosen)
  if (!P) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-axis">No journal pages.</text>
  const slot = live ? 30 : 13, cw = live ? 26 : 10, K = Math.max(1, Math.min(P, Math.floor((w - 12) / slot))), start = clampTo(0, P - K, Math.max(1, cur) - 1 - Math.floor(K / 2))
  const x0 = (w - (K * slot - (slot - cw))) / 2, cy = live ? 40 : 8, ch = live ? 50 : h - 16
  const xOf = (j: number) => x0 + j * slot
  return <g>
    {Array.from({length: K}, (_, j) => {
      const at = start + j + 1, now = at === cur
      return <g key={at}>
        <rect x={xOf(j)} y={cy} width={cw} height={ch} className={now ? 'dp-fill-on' : 'dp-faint'} style={now ? {stroke: 'var(--dp-on)', strokeWidth: 1.3} : undefined} />
        {live && [0, 1, 2, 3].map(r => <line key={r} x1={xOf(j) + 4} x2={xOf(j) + cw - 4 - (r === 3 ? 8 : 0)} y1={cy + 11 + r * 8} y2={cy + 11 + r * 8} className="dp-faint" opacity={.5} />)}
        {live && <text x={xOf(j) + cw / 2} y={cy + ch + 11} textAnchor="middle" className={now ? 'dp-ink' : 'dp-axis'}>{dayNumber(pages[at - 1] ?? '')}</text>}
      </g>
    })}
    {live && start > 0 && <text x={4} y={cy + ch / 2 + 3} className="dp-axis">‹</text>}
    {live && start + K < P && <text x={w - 4} y={cy + ch / 2 + 3} textAnchor="end" className="dp-axis">›</text>}
    {live && <>
      <text x={4} y={11} className="dp-ink-dim">journal</text>
      <text x={w / 2} y={cy + ch + 28} textAnchor="middle" className="dp-ink">Page {cur || NONE} of {P}</text>
      <text x={w / 2} y={cy + ch + 41} textAnchor="middle" className="dp-ink-dim">{pages[cur - 1] || NONE}</text>
    </>}
    {live && set && chosen !== undefined && <Handle x={xOf(cur - 1 - start) + cw / 2} y={cy - 10} n={1} shape="ring" label="Page" does="Drag along the pages to choose the page to read."
      onDrag={P > 1 ? x => set('page', clampTo(1, P, start + clampTo(0, K - 1, Math.round((x - x0 - cw / 2) / slot)) + 1)) : undefined} onReset={() => set('page', P)} />}
  </g>
}

function Picture({v, set, w, h, live}: {v: V; set?: Setter; w: number; h: number; live: boolean}) {
  return strOf(v, 'view') === 'journal' ? <PageStrip v={v} set={set} w={w} h={h} live={live} /> : <EntryMap v={v} set={set} w={w} h={h} live={live} />
}
const MAP_DOES = 'Each bar is an entry, on its author\'s row. A line joins an entry to the one it answers. Handle 1 selects an entry; handle 2 chooses who speaks.'
/** The well's words: the document's title, when the owner reports one, then what the picture is. */
const mapDoes = (v: V) => { const title = strOf(v, 'title'); return title ? `${title}. ${MAP_DOES}` : MAP_DOES }

// ---------------------------------------------------------------- controls

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})

function ViewRadio({p}: {p: ViewProps}) {
  return <Radio label="View" does="How the page shows the entries: Dialogue, Flow or Journal." value={strOf(p.v, 'view') ?? ''} options={VIEWS} stack onChange={x => p.set('view', x)} />
}
const JOURNAL = 'A Journal page is not an entry. Set View to Dialogue or Flow.'
function RelationRadio({p}: {p: ViewProps}) {
  const sel = numOf(p.v, 'entry'), plural = pluralOf(p.v)
  const none = strOf(p.v, 'view') === 'journal' ? JOURNAL : plural === undefined ? 'No reading of the template form.' : !plural ? 'Upgrade the Flow first. An earlier form has no relations.'
    : sel === undefined ? 'No reading of the selected entry.' : sel === 0 ? 'Select an entry first.' : undefined
  return <Radio label="Relation" does="How the next entry connects to the selected entry." value={strOf(p.v, 'relation') ?? ''} options={RELATIONS} stack onChange={x => p.set('relation', x)} disabled={none} />
}
function SpeakAs({p}: {p: ViewProps}) {
  const who = peopleOf(p.v)?.filter(q => !q.left)
  return <Chooser label="Speak as" does="Who the next entry belongs to. A participant that you add does not start." value={speakerOf(p.v) ?? ''}
    options={(who ?? []).map(q => ({value: q.initial, label: q.name || NONE}))} onChange={x => p.set('speaker', x)}
    disabled={strOf(p.v, 'view') === 'journal' ? JOURNAL : !who ? 'No reading of the people.' : undefined} />
}
function EntryBox({p, wide}: {p: ViewProps; wide?: boolean}) {
  const N = entriesOf(p.v)?.length, sel = numOf(p.v, 'entry')
  return <ValueBox wide={wide} label="Entry" does="The entry that the next entry connects to. New starts a line of its own." value={sel === undefined || N === undefined ? NaN : Math.min(sel, N)} def={0}
    scale={{min: 0, max: Math.max(1, N ?? 1), step: 1}} format={x => (x === 0 ? 'New' : `${x}`)} onChange={x => p.set('entry', x)}
    disabled={strOf(p.v, 'view') === 'journal' ? JOURNAL : N === undefined ? 'No reading of the entries.' : N === 0 ? 'Nothing is written yet.' : undefined} />
}
function PageBox({p, wide}: {p: ViewProps; wide?: boolean}) {
  const P = pagesOf(p.v)?.length, page = numOf(p.v, 'page')
  return <ValueBox wide={wide} label="Page" does="The Journal page that you read, numbered from the first. The date shows in the display."
    value={page === undefined || P === undefined ? NaN : clampTo(1, Math.max(2, P), page)} def={Math.max(1, P ?? 1)}
    scale={{min: 1, max: Math.max(2, P ?? 2), step: 1}} format={x => (P === 0 ? 'None' : `${x} / ${P ?? NONE}`)} onChange={x => p.set('page', x)}
    disabled={P === undefined ? 'No reading of the pages.' : P === 0 ? 'This Flow has no journal pages.' : P === 1 ? 'This Flow has one journal page.' : undefined} />
}
/** The fourth macro follows the view: the entry in Dialogue and Flow, the page in Journal. */
function Place({p}: {p: ViewProps}) { return strOf(p.v, 'view') === 'journal' ? <PageBox p={p} wide /> : <EntryBox p={p} wide /> }

function participantRows(v: V, set: Setter, page: number, onPage: (n: number) => void) {
  const people = peopleOf(v)
  const items: RowItem[] = people ? people.map(q => ({
    id: q.initial, name: q.name || NONE, light: q.left ? 'dark' : 'lit', tone: 'value', request: q.left ? undefined : true,
    why: q.left ? 'Left this Flow. Its entries stay.' : undefined, note: q.initial, mark: <WhoMark kind={q.kind} dim={q.left} />,
  })) : [{id: 'unread', name: 'No reading of the people', light: 'unknown', does: 'The owner reports no participants for this Flow.'}]
  return <Rows label="Participants" does="Everyone in the exchange. The square is your request: press it to let a participant leave. Their entries stay." items={items} size={4} page={page} onPage={onPage}
    onRequest={(id, x) => { if (x || !people) return; set(`left:${id}`, true); if (strOf(v, 'speaker') === id) { const next = people.find(q => q.initial !== id && !q.left); if (next) set('speaker', next.initial) } }} />
}
function BringIn({p}: {p: ViewProps}) {
  const roster = rosterOf(p.v), rest = roster?.filter(r => !on(p.v, `in:${r.id}`)), chosen = strOf(p.v, 'bring'), pick = rest?.find(r => r.id === chosen)?.id, plural = pluralOf(p.v)
  const why = plural === undefined ? 'No reading of the template form.' : !plural ? 'Upgrade the Flow first.' : !roster ? 'No reading of the roster.' : undefined
  return <>
    <Chooser label="Bring in" does="An accepted agent of the roster. Joining records a participant. It starts nothing." value={pick ?? (rest && !rest.length ? 'none' : '')}
      options={rest?.length ? rest.map(r => ({value: r.id, label: r.name || NONE})) : roster ? [{value: 'none', label: 'Everyone is here'}] : []} onChange={x => p.set('bring', x)} disabled={why} />
    <Action label="Add" does="Add the chosen agent as a participant. It does not start, and it is not proof of who wrote."
      disabled={why ?? (rest?.length ? (pick ? undefined : 'Choose an agent first.') : 'Every accepted agent is here.')}
      onPress={() => { if (!pick || !rest) return; p.set(`in:${pick}`, true); p.set('bring', rest.find(r => r.id !== pick)?.id ?? 'none') }} />
  </>
}

// ---------------------------------------------------------------- the views

function Whole({p}: {p: ViewProps}) {
  const [at, setAt] = useState(0)
  const v = p.v, n = entriesOf(v)?.length, plural = pluralOf(v), pages = pagesOf(v)?.length, held = edited(v)
  const revision = numOf(v, 'revision'), state = held ? 'edited' : strOf(v, 'state'), last = strOf(v, 'lastSave'), template = on(v, 'upgraded') ? CURRENT_FORM : strOf(v, 'template')
  return <Panel title="Flow" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The entries" does={mapDoes(v)} corner={corner(v)}>
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
        <Readout label="revision" does="The revision that the owner holds. A save checks it." value={revision === undefined ? undefined : `r${revision}`} copy={revision === undefined ? undefined : `r${revision}`} />
        <Readout label="state" does="Saved: the owner holds this revision. Edited: the page holds edits that the owner does not." value={state} tone={held || state === 'edited' ? 'accent' : 'green'} />
        <Readout label="template" does="The template version that this Flow opened with. It keeps it until you upgrade." value={template} tone={plural === false ? 'stall' : undefined} />
        <Readout label="save" does="What the last save did: saved, unchanged, stale, conflict or refused." value={last === undefined ? undefined : last || 'none'} />
        <Readout label="entries" does="Entries in the dialogue." value={n} />
        <Readout label="pages" does="Pages in the journal." value={pages} />
        <Readout label="media" does="Files attached to entries, up to 12 MB each. Add them on the page." value={numOf(v, 'media')} />
        {plural === true ? <div /> : <Action label="Upgrade" does="Change the earlier form to the current one. Every entry stays." disabled={plural === undefined ? 'No reading of the template form.' : undefined}
          onPress={() => p.set('upgraded', true)} />}
        <Action label="Save" does="Write the page to the native source. The owner checks the revision first." disabled={revision === undefined ? 'No reading of the revision to check.' : undefined}
          onPress={() => p.set('save', true)} />
        <Action label="Re-read" does="Read the current document again. Edits that the owner does not hold are dropped." onPress={() => p.set('reread', true)} />
      </Section>
    </Band>
  </Panel>
}

/** The widget: the last entries, and a line for the next one. */
function Lines({v}: {v: V}) {
  const ents = entriesOf(v), who = peopleOf(v) ?? []
  if (!ents) return <ul className="flw-last"><li className="flw-last-empty" data-i="Entries|No reading of the entries.">No reading of the entries.</li></ul>
  const last = ents.slice(-4)
  if (!last.length) return <ul className="flw-last"><li className="flw-last-empty" data-i="Entries|Nothing is written yet.">Nothing is written yet.</li></ul>
  return <ul className="flw-last">{last.map((e, i) => {
    const q = who.find(w => w.initial === e.by), n = ents.length - last.length + i + 1
    return <li key={n} data-i={`${q?.name || e.by}|${e.head}`}><WhoMark kind={q?.kind} /><span>{e.head}</span><time>{e.at}</time></li>
  })}</ul>
}
function Compose({p}: {p: ViewProps}) {
  const [line, setLine] = useState('')
  const why = composeBlock(p.v)
  const send = () => { if (!why && line.trim()) { append(p, line.trim()); setLine('') } }
  return <div className="flw-compose" data-i={`Next entry|${why ?? 'Write a line and press Enter. It joins the Flow as the person in Speak as, with the relation that you set.'}`}>
    <span className="flw-to">{nextWords(p.v)}</span>
    <input aria-label="Next entry" value={line} placeholder={why ? NONE : 'Write the next entry'} disabled={!!why} onChange={e => setLine(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }} />
  </div>
}

const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

export const design: DesignedDevice = {
  id: 'central:flow-document',
  title: 'Flow',
  kind: 'instrument',
  defaults: {
    light: 'lit',
    // The document, as the owner reports it. flow-2026-10-03-1432.html: eight entries by the Factory coordinator, each naming its run and
    // observations as sources and artifacts. Entries 9 to 13 are the person's, added so that the map shows a reply, a branch, a correction
    // and a convergence.
    title: 'Factory original development Run — execution and continuation', template: 'v0.4', plural: true, media: 0,
    people: JSON.stringify([
      {initial: 'F', name: 'You', kind: 'person', basis: 'unknown'},
      {initial: 'C', name: 'Factory coordinator', kind: 'agent', basis: 'declared'},
    ]),
    pages: JSON.stringify(['Mon 13 Oct', 'Tue 14 Oct', 'Wed 15 Oct']),
    entries: JSON.stringify([
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
    ]),
    // The accepted agents of the roster that a Flow can bring in (agency/roster.ts; names from Central's guardians).
    roster: JSON.stringify([{id: 'central-guardian', name: 'Central Guardian'}, {id: 'aikit-guardian', name: 'AIKit Guardian'}]),
    // What the page holds and the owner does not: lines written, the upgrade, agents brought in (`in:<id>`), participants let go (`left:<initial>`).
    extra: '[]', upgraded: false,
    view: 'dialogue', entry: 11, relation: 'reply', speaker: 'F', page: 3, bring: 'central-guardian',
    // Readings: what the owner reports for the document, never set from here.
    revision: 8, state: 'edited', lastSave: '',
  },
  fixtures: {
    'Factory run': {},
    // flow-2026-09-14-2236.html: the earlier form (v0.1), three entries, one journal page, no relations.
    'Earlier form': {
      title: 'Shared field — first curated artifact', template: 'v0.1', plural: false, media: 0,
      people: JSON.stringify([
        {initial: 'F', name: 'the person', kind: 'person', basis: 'unknown'},
        {initial: 'H', name: 'the agent', kind: 'agent', basis: 'unknown'},
      ]),
      pages: JSON.stringify(['Sun 14 Sep']),
      entries: JSON.stringify([
        {by: 'F', at: '21:36', head: 'The shared field is the relational environment'},
        {by: 'F', at: '21:36', head: 'This Flow instance is the first curated HTML artifact'},
        {by: 'H', at: '21:36', head: 'Minted on 2026-09-14 by the Lane C session'},
      ]),
      entry: 3, page: 1, revision: 1, state: 'saved',
    },
    // flow-2026-10-07-1343.html: a Flow made from the template, with its person and nothing written.
    'New Flow': {
      title: '', template: 'v0.4', plural: true, media: 0,
      people: JSON.stringify([{initial: 'F', name: 'You', kind: 'person', basis: 'unknown'}]),
      pages: JSON.stringify([]), entries: JSON.stringify([]),
      entry: 0, page: 1, revision: 0, state: 'saved',
    },
    'No readings': Object.fromEntries(['light', 'title', 'template', 'plural', 'media', 'people', 'pages', 'entries', 'roster', 'extra', 'upgraded', 'view', 'entry',
      'relation', 'speaker', 'page', 'bring', 'revision', 'state', 'lastSave'].map(k => [k, undefined])),
  },

  folded: p => {
    const people = peopleOf(p.v), n = entriesOf(p.v)?.length
    return <Folded title="Flow" light={light(p)} onUnfold={p.nav.unfold}
      readings={[people ? people.filter(q => !q.left).map(q => q.initial).join(' ') || NONE : NONE, n === undefined ? NONE : entriesWord(n)]} />
  },

  compact: p => <Panel title="Flow" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The entries" does={mapDoes(p.v)} corner={corner(p.v)}>
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

  full: () => {
    const root = cradleDocuments()
    return <div className="ref-pane-body">
      {root && <iframe className="ref-pane-frame" title="The Flow's page, as the template draws it" src={`${root}/ql-flow.html`} />}
    </div>
  },

  widget: p => <Tile title="Flow" light={light(p)} span={2} onFull={p.nav.full}>
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
