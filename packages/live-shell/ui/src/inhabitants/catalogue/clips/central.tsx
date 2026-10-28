// Central's clip (manual §18.1): a page of a world — a Being, a Thing or a Flow — on that world's track; the Day is the set, not a
// clip. Clip view shows the page as you write it, the same editor as the page in a pane, with its facts and its tools beside it.
// Panel one holds the page's Clip fields (title, colour, kind, template at its version, revision, save state) and the form's own
// fields: a Being's or a Thing's ties, or a Flow's participants, its world and its container (manual §24.5). A page has no Launch tab:
// it is placed, not launched (§16.5, §18.1 Opening a page). It plays from the moment you open it until you close the moment; where it
// opens is a pane's act, and Open in, from its menu, opens a being or a thing in another instrument.
// Panel two holds the tools that shape and mark the page: Text, Highlight and Notes; the five passage acts stand over the selected
// passage. Remember keeps the passage word for word with its source ref as a proposal in your ground: Central's `central.remember`
// (Control/agents/remembered) for a page of your own world, `projectcentral.remember` (the project's ProjectCentral/agents/remembered) for a
// project's, stamped generated-proposal/unrecognised; recognising it is your separate act. The kernel's invoke_action reaches both. The editor's tabs are the ways the page reads: Page and Source, or a Flow's Dialogue, Flow and Journal. A page has no
// envelopes.
//
// The owner's material: `page` (JSON paragraphs {id, kind: h1 | intro | h2 | p | quote, parts: [{text, mark?, note?}]}),
// `selected` (the paragraph the selection stands in), `notes` (JSON {id, anchor, text, timing}), `source` (the page's source
// text), and for a Flow `participants` (JSON {name, initial, kind: person | agent}), `entries` (JSON {id, who, rel?, depth, text,
// kind?: observe | interpret | choose}), `container` and `journalPages` (JSON, the dates the Journal has pages for, newest first).
import type {ReactNode} from 'react'
import {Action, Chooser, Radio, TextField, Toggle, ValueBox} from '../../sdk/panel'
import {has, numOf, strOf} from '../panels/design'
import {COLOURS, Fact, Fields, GrooveOf, GrooveReading, GrooveSwap, MadeOf, grooved, Rows, Row, Said, Wide, choice, flag, read} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

type V = ClipProps['v']
const kindOf = (v: V) => choice(v, 'kind', 'being')
const isFlow = (v: V) => kindOf(v) === 'flow'
const KIND_WORD: Readonly<Record<string, string>> = {flow: 'Flow', being: 'Being', thing: 'Thing'}
const SAVE_TONE = {saved: 'green', unchanged: undefined, stale: 'stall', conflict: 'stall', refused: 'stall'} as const

// ---------------------------------------------------------------- panel one

function ClipPanel(p: ClipProps) {
  const save = strOf(p.v, 'save')
  return <Rows>
    <Row label="Title"><TextField label="Title" does="The page's title, on the clip's colour." value={strOf(p.v, 'name') ?? ''} onChange={x => p.set('name', x)} /></Row>
    <Row label="Colour"><Chooser label="Colour" does="The colour of the clip on the grid and the ruler. A page takes its world's colour." value={choice(p.v, 'colour')} options={COLOURS} onChange={x => p.set('colour', x)} /></Row>
    <Row label="Kind"><Fact label="Kind" does="What sort of page it is. The kind sets the form's fields." value={KIND_WORD[kindOf(p.v)] ?? strOf(p.v, 'kind')} /></Row>
    <Row label="Constellation"><MadeOf p={p} what="the page" /></Row>
    <Row label="Groove"><GrooveOf p={p} /><GrooveSwap p={p} /></Row>
    {grooved(p.v) && <Row label="Reading"><GrooveReading p={p} /></Row>}
    <Row label="Template"><Fact label="Template" does="The design that draws the page, at the version the page opened with. A new version does not change an old page." value={strOf(p.v, 'template')} /></Row>
    <Row label="Revision"><Fact label="Revision" does="The saved revision the page stands on." value={strOf(p.v, 'revision')} /></Row>
    <Row label="Save"><Fact label="Save state" does="The outcome of the last save. A stale or conflicting save keeps your draft and shows what changed." value={save ? save[0]!.toUpperCase() + save.slice(1) : undefined}
      tone={save ? SAVE_TONE[save as keyof typeof SAVE_TONE] : undefined} /></Row>
  </Rows>
}

const OFFICES = ['1', '2', '3', '4'] as const

function TiesPanel(p: ClipProps) {
  const being = kindOf(p.v) === 'being'
  const offices = (strOf(p.v, 'office') ?? '').split(',').filter(Boolean)
  const sources = read<string[]>(p.v, 'sources', [])
  return <Rows>
    <Row label="World"><Fact label="World" does="The world that the page belongs to." value={strOf(p.v, 'world')} /></Row>
    <Row label="Subject"><Fact label="Subject" does={being ? 'The person or agent the page is about.' : 'The object the page describes.'} value={strOf(p.v, 'subject')} /></Row>
    {being && <Row label="Being"><Radio label="Kind of being" does="Says what sort of being the page holds." value={choice(p.v, 'being')} onChange={x => p.set('being', x)}
      options={[{value: 'person', label: 'Person'}, {value: 'agent', label: 'Agent'}]} /></Row>}
    <Row label="Office">{OFFICES.map(o => <Toggle key={o} label={o} does={`Subject office ${o}: the page takes it up. One or more of four.`} on={offices.includes(o)}
      onChange={on => p.set('office', (on ? [...offices, o] : offices.filter(x => x !== o)).sort().join(','))} />)}</Row>
    <Row label="Sources"><Fact label="Sources" does="Where the claims of the page come from, each at a revision." value={sources.length ? `${sources.length} · ${sources[0]}${sources.length > 1 ? ' …' : ''}` : undefined} /></Row>
    <Row label="Place"><Fact label="Place" does="Where it stands in your world. An empty place stays empty." value={strOf(p.v, 'place')} /></Row>
    <Row label="Anchor"><Fact label="Anchor" does="The real place on Earth the page is tied to." value={strOf(p.v, 'anchor')} /></Row>
    <Row label="Expression"><Fact label="Expression" does="The Expression that the page shows." value={strOf(p.v, 'expression')} tone="value" /></Row>
    <Row label="Layout"><Radio label="Layout" does="How the page is composed." value={choice(p.v, 'layout')} onChange={x => p.set('layout', x)}
      options={[{value: 'portrait', label: 'Portrait'}, {value: 'editorial', label: 'Editorial'}]} /></Row>
    <Row label="Tone"><Radio label="Tone" does="The ground of the page: light or dark." value={choice(p.v, 'tone')} onChange={x => p.set('tone', x)}
      options={[{value: 'paper', label: 'Paper'}, {value: 'ink', label: 'Ink'}]} /></Row>
  </Rows>
}

interface Participant {readonly name: string; readonly initial: string; readonly kind: 'person' | 'agent'; readonly session?: string}

const CONTAINERS = [
  {value: 'none', label: 'None'},
  {value: 'dialogue', label: 'Dialogue', does: 'Bohm\'s dialogue: assumptions are held in view rather than defended.'},
  {value: 'circle', label: 'Circle', does: 'A talking circle: Speak as passes round the participants in order, and only the holder writes.'},
  {value: 'inquiry', label: 'Inquiry', does: 'An inquiry into your own experience: what is here now, then what you notice about it.'},
]

function PeoplePanel(p: ClipProps) {
  const people = read<Participant[]>(p.v, 'participants', [])
  return <>
    <Row label="World"><Fact label="World" does="The world the exchange belongs to: the world of its track." value={strOf(p.v, 'world')} /></Row>
    <Row label="Container"><Chooser label="Container" does="A form that holds the exchange. In a container each entry says whether it observes, interprets or chooses." value={choice(p.v, 'container', 'none')} options={CONTAINERS} onChange={x => p.set('container', x)} /></Row>
    <Said>Who is in the exchange. A person is drawn solid, an agent as points.</Said>
    {people.length ? <ul className="clv-list" aria-label="Participants">
      {people.map(person => <li key={person.name} style={{gridTemplateColumns: '24px minmax(0, 1fr) auto'}} data-i={`${person.name}|A ${person.kind}${person.session ? `, tied to the session ${person.session}` : ''}.`}>
        <span className="clv-avatar" data-kind={person.kind} style={{width: 16, height: 16, fontSize: 8}}>{person.initial}</span>
        <span>{person.name}</span><span className="clv-tag">{person.kind === 'agent' ? person.session ?? 'agent' : 'person'}</span>
      </li>)}
    </ul> : <Said>No participants are read.</Said>}
    <Wide><Action label="Add a participant" does="Adds a person or an agent to the exchange. A participant you add does not start, and is not proof of who wrote." onPress={() => p.set('addParticipant', Date.now())} /></Wide>
  </>
}

// ---------------------------------------------------------------- the tools

function TextTool(p: ClipProps) {
  return <Fields>
    <Wide><Radio label="Style" does="The paragraph style of the selection." value={choice(p.v, 'text.style')} onChange={x => p.set('text.style', x)}
      options={[{value: 'body', label: 'Body'}, {value: 'head', label: 'Head'}, {value: 'quote', label: 'Quote'}, {value: 'list', label: 'List'}]} /></Wide>
    <Wide><Radio label="Emphasis" does="The emphasis of the selected words." value={choice(p.v, 'text.emphasis')} onChange={x => p.set('text.emphasis', x)}
      options={[{value: 'none', label: 'None'}, {value: 'bold', label: 'Bold'}, {value: 'italic', label: 'Italic'}, {value: 'strike', label: 'Strike'}]} /></Wide>
    <Wide><ValueBox label="Size" does="The type size you see the page in. It changes only your view." value={numOf(p.v, 'text.size') ?? NaN} def={15} scale={{min: 13, max: 22, step: 1}}
      format={x => `${x} pt`} onChange={x => p.set('text.size', x)} wide /></Wide>
    <Wide><Said>Text changes how the words are set, never a word.</Said></Wide>
  </Fields>
}

function HighlightTool(p: ClipProps) {
  return <Fields>
    <Wide><Radio label="Colour" does="The colour of the next highlight." value={choice(p.v, 'hl.colour')} onChange={x => p.set('hl.colour', x)}
      options={[{value: 'yellow', label: 'Yellow'}, {value: 'green', label: 'Green'}, {value: 'blue', label: 'Blue'}, {value: 'pink', label: 'Pink'}]} /></Wide>
    <Wide><Radio label="Show" does="Fades everything except the highlights." value={choice(p.v, 'hl.show')} onChange={x => p.set('hl.show', x)}
      options={[{value: 'all', label: 'All'}, {value: 'highlights', label: 'Highlights only'}]} /></Wide>
    <Toggle label="Pen" does="Makes a drag over text a highlight. Draw in the transport turns it on." on={flag(p.v, 'hl.pen') ?? false} onChange={x => p.set('hl.pen', x)} />
    <Toggle label="Selection tool" does="Shows the five acts when you select a passage." on={p.v['hl.tool'] !== false} onChange={x => p.set('hl.tool', x)} />
  </Fields>
}

function NotesTool(p: ClipProps) {
  return <Fields>
    <Wide><Radio label="Timing" does="Records whether you wrote the note while you read or afterwards." value={choice(p.v, 'notes.timing')} onChange={x => p.set('notes.timing', x)}
      options={[{value: 'during', label: 'During reading'}, {value: 'after', label: 'After'}]} /></Wide>
    <Wide><Radio label="Anchor to" does="The part of the page that the next note is about." value={choice(p.v, 'notes.anchor')} onChange={x => p.set('notes.anchor', x)}
      options={[{value: 'selection', label: 'Selection'}, {value: 'entry', label: 'Entry'}, {value: 'document', label: 'Page'}]} /></Wide>
    <Wide><Radio label="Show" does="Which notes appear beside the page." value={choice(p.v, 'notes.show')} onChange={x => p.set('notes.show', x)}
      options={[{value: 'all', label: 'All notes'}, {value: 'entry', label: 'Open entry'}, {value: 'off', label: 'Off'}]} /></Wide>
    <Wide><Radio label="Order" does="The order of the list of notes." value={choice(p.v, 'notes.order')} onChange={x => p.set('notes.order', x)}
      options={[{value: 'place', label: 'By place'}, {value: 'time', label: 'By time'}]} /></Wide>
  </Fields>
}

// ---------------------------------------------------------------- the editor

interface Part {readonly text: string; readonly mark?: string; readonly note?: string}
interface Para {readonly id: string; readonly kind: 'h1' | 'intro' | 'h2' | 'p' | 'quote'; readonly parts: readonly Part[]}
interface Note {readonly id: string; readonly anchor: string; readonly text: string; readonly timing?: 'during' | 'after'}

/** The five acts over the selected passage (manual §18.1 "The selection tool"). */
function Acts({p}: {p: ClipProps}) {
  const act = (label: string, does: string) => <button type="button" data-i={`${label}|${does}`} onClick={() => p.set(`act.${label.toLowerCase().replace(' ', '')}`, Date.now())}>{label}</button>
  return <div className="clv-acts" role="toolbar" aria-label="Passage acts">
    {act('Highlight', 'Marks the passage in the chosen colour. Choose it again on a highlight to remove it.')}
    {act('Note', 'Opens a note anchored to the passage.')}
    {act('To packet', 'Adds the passage to the packet.')}
    {act('Remember', 'Keeps the passage word for word, with where it came from, as a proposal in your ground. It stays unrecognised until you recognise it.')}
    {act('Answer this', 'Sends the packet and the passage to the agent on the world\'s chain. The answer arrives as a new entry, with its sources.')}
  </div>
}

function Paper({p, children}: {p: ClipProps; children: ReactNode}) {
  const notes = read<Note[]>(p.v, 'notes', [])
  const show = choice(p.v, 'notes.show', 'all')
  const ordered = choice(p.v, 'notes.order', 'place') === 'time' ? [...notes].reverse() : notes
  return <div className="clv-page">
    <article className="clv-paper" data-tone={choice(p.v, 'tone', 'paper')} data-show={choice(p.v, 'hl.show', 'all')} style={{fontSize: numOf(p.v, 'text.size') ?? 15}}
      data-i="Page|The page as its template draws it. Select a passage to reach its acts.">{children}</article>
    {show !== 'off' && <aside className="clv-margin" aria-label="Notes" data-i="Notes|Your notes, each beside the place it is anchored to. An agent reads a note only when you add it to the packet.">
      <span className="clv-margin-head">Notes</span>
      {ordered.length ? ordered.map(note => <div key={note.id} className="clv-note">{note.text}<small>{note.anchor}{note.timing === 'after' ? ' · after reading' : ''}</small></div>)
        : <Said>No notes.</Said>}
    </aside>}
  </div>
}

function PageTab(p: ClipProps) {
  // Absent: the owner has not read the page. Read and holding nothing ('[]', as an empty file reads: 0 B, the empty hash): the page is
  // empty, which is a reading, not its absence.
  if (!has(p.v, 'page')) return <Said>No reading of the page yet.</Said>
  const page = read<unknown>(p.v, 'page', null)
  if (!Array.isArray(page)) return <Said>The page's reading is not a list of paragraphs.</Said>
  if (!page.length) return <Said>The page is empty.</Said>
  const paras = page as Para[]
  const selected = strOf(p.v, 'selected')
  const part = (part: Part, i: number) => part.mark ? <mark key={i} data-colour={part.mark}>{part.text}</mark>
    : part.note ? <span key={i} className="clv-anchor">{part.text}</span> : <span key={i} className="clv-plain">{part.text}</span>
  return <Paper p={p}>
    {paras.map(para => {
      const body = para.parts.map(part)
      const sel = para.id === selected && p.v['hl.tool'] !== false
      const inner = para.kind === 'h1' ? <h1>{body}</h1> : para.kind === 'h2' ? <h2>{body}</h2> : para.kind === 'intro' ? <p className="clv-intro">{body}</p>
        : para.kind === 'quote' ? <p className="clv-quote">{body}</p> : <p className={sel ? 'clv-selected' : undefined} onClick={() => p.set('selected', para.id)}>{body}</p>
      return <div key={para.id}>{sel && <Acts p={p} />}{inner}</div>
    })}
  </Paper>
}

interface Entry {readonly id: string; readonly who: string; readonly rel?: string; readonly depth?: number; readonly text: string; readonly day?: string; readonly kind?: 'observe' | 'interpret' | 'choose'}
const ENTRY_KIND: Readonly<Record<string, string>> = {observe: 'Observe', interpret: 'Interpret', choose: 'Choose'}

function FlowTab({p, view}: {p: ClipProps; view: 'dialogue' | 'flow' | 'journal'}) {
  const entries = read<Entry[]>(p.v, 'entries', [])
  const people = read<Participant[]>(p.v, 'participants', [])
  if (!entries.length) return <Said>No reading of the Flow yet.</Said>
  const kind = (who: string) => people.find(person => person.name === who)?.kind ?? 'person'
  const initial = (who: string) => people.find(person => person.name === who)?.initial ?? who[0]
  const speaker = strOf(p.v, 'speakAs')
  const shown = view === 'journal' ? entries.filter(entry => entry.who === speaker) : entries
  const selected = strOf(p.v, 'selected')
  return <Paper p={p}>
    <h1>{strOf(p.v, 'name') ?? ''}</h1>
    <p className="clv-intro">{view === 'journal' ? `${speaker ?? ''} · ${strOf(p.v, 'journalPage') ?? ''}` : people.map(person => person.name).join(' · ')}</p>
    {shown.map(entry => <div key={entry.id}>
      {entry.id === selected && <Acts p={p} />}
      <div className="clv-entry" data-depth={view === 'flow' ? Math.min(2, entry.depth ?? 0) : undefined} onClick={() => p.set('selected', entry.id)}>
        <span className="clv-avatar" data-kind={kind(entry.who)}>{initial(entry.who)}</span>
        <div>
          <span className="clv-entry-who">{entry.who}</span>{entry.rel && view !== 'journal' && <span className="clv-entry-rel">{entry.rel}</span>}{entry.kind && <span className="clv-entry-rel">{ENTRY_KIND[entry.kind]}</span>}
          <p className={entry.id === selected ? 'clv-selected' : undefined}>{entry.text}</p>
        </div>
      </div>
    </div>)}
  </Paper>
}

function SourceTab(p: ClipProps) {
  const text = strOf(p.v, 'source')
  return text ? <pre className="clv-source" data-i="Source|The page's source text.">{text}</pre> : <Said>No reading of the page's source.</Said>
}

const flowBar = (p: ClipProps) => {
  const people = read<Participant[]>(p.v, 'participants', [])
  const pages = read<string[]>(p.v, 'journalPages', [])
  const held = choice(p.v, 'container', 'none') !== 'none'
  return <>
    <Chooser label="Speak as" does="Who the next entry belongs to." value={choice(p.v, 'speakAs')} options={people.map(person => ({value: person.name, label: `As ${person.name}`}))} onChange={x => p.set('speakAs', x)} />
    {choice(p.v, 'view.editor') !== 'journal' && <Chooser label="Relation" does="How the next entry connects to the entry you select." value={choice(p.v, 'relation')} onChange={x => p.set('relation', x)}
      options={[['reply', 'Reply'], ['branch', 'Branch'], ['converge', 'Converge'], ['correct', 'Correct'], ['source', 'Source'], ['artifact', 'Artifact']].map(([value, label]) => ({value: value!, label: label!}))} />}
    {held && <Chooser label="Entry" does="What the next entry is, in a container: what happened, what you take it to mean, or what you decide." value={choice(p.v, 'entryKind', 'observe')} onChange={x => p.set('entryKind', x)}
      options={[{value: 'observe', label: 'Observe'}, {value: 'interpret', label: 'Interpret'}, {value: 'choose', label: 'Choose'}]} />}
    {choice(p.v, 'view.editor') === 'journal' && <Chooser label="Journal page" does="The page of the Journal that you read. Today's is first." value={choice(p.v, 'journalPage')} onChange={x => p.set('journalPage', x)}
      options={pages.map(d => ({value: d, label: d}))} />}
    <Action label="Media" does="Attaches an image, a video or an audio file, up to 12 MB, to the next entry. The page keeps it inside itself." onPress={() => p.set('media', Date.now())} />
  </>
}

const corner = (p: ClipProps) => {
  const save = strOf(p.v, 'save')
  return <span className="clv-own" data-i="Save state|The outcome of the last save, and the revision the page stands on.">{save ? `${save[0]!.toUpperCase()}${save.slice(1)}` : '—'} · {strOf(p.v, 'revision') ?? '—'}</span>
}

// ---------------------------------------------------------------- the fixtures

const BEING_PAGE: Para[] = [
  {id: 'h', kind: 'h1', parts: [{text: 'Hildegard of Bingen'}]},
  {id: 'i', kind: 'intro', parts: [{text: 'Abbess, visionary and composer of the Rhineland, 1098 – 1179.'}]},
  {id: 'p1', kind: 'p', parts: [{text: 'She wrote down the visions she had carried since childhood only in her forties, when '}, {text: 'a voice from heaven told her to write what she saw and heard', mark: 'yellow'}, {text: '. The Scivias took ten years.'}]},
  {id: 's1', kind: 'h2', parts: [{text: '1. The music'}]},
  {id: 'p2', kind: 'p', parts: [{text: 'Her songs move by wide leaps, often more than an octave in a phrase, '}, {text: 'which the chant of her time avoided', note: 'n1'}, {text: '. The Ordo Virtutum sets the virtues against the devil, who alone may not sing.'}]},
  {id: 'q', kind: 'quote', parts: [{text: 'O viriditas digiti Dei — O greenness of the finger of God.'}]},
  {id: 's2', kind: 'h2', parts: [{text: '2. The greening'}]},
  {id: 'p3', kind: 'p', parts: [{text: 'Viriditas, the greening power, runs through her medicine, her music and her theology alike: '}, {text: 'the same word names the sap in a tree and the life of the soul', mark: 'green'}, {text: '.'}]},
]
const BEING_NOTES: Note[] = [
  {id: 'n1', anchor: '§1 · "which the chant of her time avoided"', text: 'Check against the Dendermonde codex before claiming this.', timing: 'during'},
  {id: 'n2', anchor: '§2 · the page', text: 'Pair with the Physica on plants: the same word in both.', timing: 'after'},
]
const BEING_SOURCE = `---
template: beings · standard @ 7
world: Your world
subject: Hildegard of Bingen
office: [2, 3]
place: Disibodenberg
anchor: 49.8155 N, 7.6602 E
---

# Hildegard of Bingen

> Abbess, visionary and composer of the Rhineland, 1098 – 1179.

She wrote down the visions she had carried since childhood only in
her forties, when ==a voice from heaven told her to write what she
saw and heard==. The Scivias took ten years.

## 1. The music
…`
const FLOW_PEOPLE: Participant[] = [{name: 'Frank', initial: 'F', kind: 'person'}, {name: 'Fizz', initial: 'Fz', kind: 'agent', session: 'lead · O-I'}, {name: 'Mara', initial: 'M', kind: 'person'}]
const FLOW_ENTRIES: Entry[] = [
  {id: 'e1', who: 'Frank', text: 'Can the Day close itself when the last session lands, or do we still need the evening pass?'},
  {id: 'e2', who: 'Fizz', rel: 'Reply', depth: 1, text: 'It can close on the owner\'s automation once every session has landed. The evening pass stays for what only you can add.'},
  {id: 'e3', who: 'Mara', rel: 'Branch', depth: 1, text: 'What happens to a run that is still going at midnight?'},
  {id: 'e4', who: 'Fizz', rel: 'Reply', depth: 2, text: 'It shows on tomorrow\'s face 2 as running, and today\'s Day closes without it.'},
  {id: 'e5', who: 'Frank', rel: 'Correct', depth: 1, text: 'Not midnight: the day start time, which is off by default and then follows the civil day.'},
]

const INQUIRY_ENTRIES: Entry[] = [
  {id: 'i1', who: 'Frank', kind: 'observe', text: 'A tightness under the ribs when I picture the empty rooms.'},
  {id: 'i2', who: 'Frank', kind: 'interpret', depth: 1, text: 'It feels like leaving is a verdict on the years there.'},
  {id: 'i3', who: 'Nara', rel: 'Reply', kind: 'observe', depth: 1, text: 'You wrote on 11 Oct that the rooms "were never the point". The tightness came today, not then.'},
  {id: 'i4', who: 'Frank', kind: 'choose', text: 'Walk through once more on Sunday, and decide after.'},
]

export const clip: DesignedClip = {
  id: 'clip:central',
  mode: 'central',
  title: 'A Central page',
  head: {name: 'name', colour: 'colour'},
  defaults: {
    kind: 'being', name: 'Hildegard of Bingen', colour: 'var(--honey)', template: 'Beings · standard @ 7', revision: 'a41c9e2', save: 'saved',
    madeOf: 'Viriditas', 'madeOf.ref': 'wiki:anchor:viriditas',
    world: 'Your world', subject: 'Hildegard of Bingen', being: 'person', office: '2,3', sources: JSON.stringify(['Scivias, ed. Führkötter @ r3', 'Physica @ r1', 'Ordo Virtutum @ r2']),
    place: 'Disibodenberg', anchor: '49.8155 N, 7.6602 E', expression: 'Viriditas · scene 1', layout: 'portrait', tone: 'paper',
    page: JSON.stringify(BEING_PAGE), notes: JSON.stringify(BEING_NOTES), source: BEING_SOURCE, selected: 'p2',
    'text.style': 'body', 'text.emphasis': 'none', 'text.size': 15, 'hl.colour': 'yellow', 'hl.show': 'all', 'hl.pen': false, 'hl.tool': true,
    'notes.timing': 'during', 'notes.anchor': 'selection', 'notes.show': 'all', 'notes.order': 'place',
    'view.panel': 'clip', 'view.tools': 'highlight', 'view.editor': 'page',
  },
  fixtures: {
    'A Being': {},
    'A Flow': {kind: 'flow', name: 'Closing the day', colour: 'var(--sel)', template: 'Flow · standard @ 4', revision: '7be0d13', save: 'unchanged',
      participants: JSON.stringify(FLOW_PEOPLE), entries: JSON.stringify(FLOW_ENTRIES), speakAs: 'Frank', relation: 'reply', journalPage: '16 Oct 2026', selected: 'e2',
      journalPages: JSON.stringify(['16 Oct 2026', '15 Oct 2026', '14 Oct 2026']), world: 'O:I', container: 'none',
      notes: JSON.stringify([{id: 'n3', anchor: 'Fizz · "the owner\'s automation"', text: 'Which automation? Name it in the Day entry.'}]), source: '---\ntemplate: flow · standard @ 4\n---\n\n## Frank\nCan the Day close itself …',
      'view.panel': 'people', 'view.editor': 'flow', 'view.tools': 'notes'},
    'An inquiry': {kind: 'flow', name: 'What the move asks', colour: 'var(--parasakti)', template: 'Flow · standard @ 4', revision: '0c31f9a', save: 'saved', world: 'Practice',
      participants: JSON.stringify([{name: 'Frank', initial: 'F', kind: 'person'}, {name: 'Nara', initial: 'N', kind: 'agent', session: 'practice'}]), container: 'inquiry', entryKind: 'observe', relation: 'reply',
      entries: JSON.stringify(INQUIRY_ENTRIES), speakAs: 'Frank', selected: 'i3', journalPages: JSON.stringify(['18 Oct 2026', '17 Oct 2026']), journalPage: '18 Oct 2026',
      notes: undefined, source: '---\ntemplate: flow · standard @ 4\ncontainer: inquiry\n---', 'view.panel': 'people', 'view.editor': 'dialogue', 'view.tools': 'notes'},
    'At night': {tone: 'ink', 'hl.show': 'highlights', 'view.panel': 'ties', 'view.tools': 'text', 'text.size': 16},
    'No readings': {page: undefined, revision: undefined, save: undefined, template: undefined, world: undefined, subject: undefined, sources: undefined, place: undefined, anchor: undefined, expression: undefined, notes: undefined, source: undefined},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'The page\'s title, colour, kind, template, revision and save state.', draw: ClipPanel},
    {id: 'ties', label: 'Ties', does: 'What the page is tied to: its world, its subject, its offices, its sources and its place.', draw: TiesPanel, shows: v => kindOf(v) === 'being' || kindOf(v) === 'thing'},
    {id: 'people', label: 'Participants', does: 'Who is in the exchange, the world it belongs to, and the form that holds it.', draw: PeoplePanel, shows: isFlow},
  ],
  tools: [
    {id: 'text', label: 'Text', does: 'How the words are set: the paragraph style, the emphasis and the size you read at.', draw: TextTool},
    {id: 'highlight', label: 'Highlight', does: 'Marks the passages that matter as you read.', draw: HighlightTool},
    {id: 'notes', label: 'Notes', does: 'Your own thoughts beside a passage, each anchored to the place it is about.', draw: NotesTool},
  ],
  editor: [
    {id: 'page', label: 'Page', does: 'The page as its template draws it.', draw: PageTab, shows: v => !isFlow(v)},
    {id: 'dialogue', label: 'Dialogue', does: 'The exchange between the participants, entry by entry, in order.', draw: p => <FlowTab p={p} view="dialogue" />, bar: flowBar, shows: isFlow},
    {id: 'flow', label: 'Flow', does: 'The same entries as threads, with the relations drawn between them.', draw: p => <FlowTab p={p} view="flow" />, bar: flowBar, shows: isFlow},
    {id: 'journal', label: 'Journal', does: 'One person, one page at a time.', draw: p => <FlowTab p={p} view="journal" />, bar: flowBar, shows: isFlow},
    {id: 'source', label: 'Source', does: 'The page\'s source text.', draw: SourceTab},
  ],
  corner,
}
