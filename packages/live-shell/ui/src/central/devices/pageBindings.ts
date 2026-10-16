// Central's page family on Central's readings and writes (lane BC2): the catalogue's designs — Document (§17.7), Flow (§18.3),
// Text (§18.6), Highlight (§18.7), Notes (§18.8), Beings and Things (§18.4, §18.5), Workspace (§18.2) — each a DesignBinding
// (frame/devices/designed.ts) over the owners that hold its material. Owners write, faces read (lock §0.4): a key an owner reports
// is a reading; a key no owner reports is absent, never the design's default (manual §16.12); a key is written only where an owner
// op stands behind it (§8.1); a control whose write no owner takes stands disabled with the reason (DesignBinding.standing, §6). A
// key the view holds itself — how the device shows the page, the entry the next one answers — is the view's (DesignBinding.local).
// Pure: no React, no transport. The readers are pageReadings.ts; the places are CentralDevices.tsx and pageDevices.tsx.
//
// The owners, each the one the hosted face already reads:
//   - the document the hand reached (central/documents/documentDoor.ts): its form, title, revision, draft fact and the save router's
//     outcome, and its acts Save and Re-read — the hosted face's own (DocumentFlowFace.tsx saveToOwner / load; DocumentDayDieFace);
//   - a Flow's own file (flow/instances.ts readFlowInstance — central.files.read) for what the page holds; an entry is appended
//     through the Flow's own revision-checked write (flow/instance.ts appendEntry + writeFlowInstance — central.files.write, kernel
//     op file_operation; ported from desktop/cradle/src/flow/FlowSurface.tsx:153-165 `save`);
//   - the Day document (`receiving` kind:document), where the reached Day is the one the Day device reads;
//   - Central's roster of accepted agents (owners/readers.ts useRosterAgents) for the agents a Flow can bring in;
//   - the workspace book (desktop/cradle/src/workspace/store.ts, through continuity/workspace.tsx) for the Workspace.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {SaveRouterOutcome} from '../../inhabitants/manifest'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import {civilDayName} from './dayBinding'
import {civilDateOf, clockOf, headOf, wordsOfHtml, type DayPage, type FlowPage, type PageEntry} from './pageReadings'

// ---------------------------------------------------------------------------------------------------------------- the wiring

/** One design's wiring to its owners: every key of the design (its "No readings" fixture) is a reading, a write, the view's own,
 * refused (with why no owner takes it), or absent (with why no owner reports it). The return's WIRING table is this. */
export interface DesignWiring {
  readonly design: string
  readonly keys: readonly string[]
  /** key → the owner reading that fills it. */
  readonly reads: Readonly<Record<string, string>>
  /** key → the owner write it goes through. */
  readonly writes: Readonly<Record<string, string>>
  /** key → why the view holds it (no owner keeps it; it changes only how this device shows the page). */
  readonly local: Readonly<Record<string, string>>
  /** key → why no owner takes a change of it: the control stands disabled with these words. */
  readonly refused: Readonly<Record<string, string>>
  /** key → why no owner reports it: the view draws "—" and names the missing reading. */
  readonly absent: Readonly<Record<string, string>>
}

export const DOCUMENT_DESIGN = 'central:document'
export const FLOW_DESIGN = 'central:flow-document'
export const TEXT_DESIGN = 'central:text'
export const HIGHLIGHT_DESIGN = 'central:highlight'
export const NOTES_DESIGN = 'central:notes'
export const BEINGS_DESIGN = 'central:beings'
export const THINGS_DESIGN = 'central:things'
export const WORKSPACE_DESIGN = 'central:workspace'

const ON_THE_PAGE = 'the hosted form is the page\'s one writer while it holds the page (DocumentFlowFace.tsx: the bridge reads its island and never pushes into it)'
const NO_SELECTION = 'The page\'s selection (ql-flow.html currentSel) does not cross the host bridge: the bridge reads the island only (desktop/cradle/src/document/frame.ts useDocumentHostRead).'

export const DOCUMENT_WIRING: DesignWiring = {
  design: DOCUMENT_DESIGN,
  keys: ['light', 'template', 'title', 'view', 'flowView', 'ground', 'layout', 'pinned', 'agentWrites', 'autosave', 'copied', 'dirty', 'outcome', 'face', 'date',
    'tabTitle', 'highlights', 'notes', 'entries', 'packet', 'journal', 'island', 'save', 'reread', 'copy', 'clear'],
  reads: {
    light: 'the reached document stands: lit when its owner answered (the Flow file read, the Day document), dark when it refused',
    template: 'the reached document\'s form (documentDoor.ts DocumentInPane.form): Day or Flow',
    title: 'a Flow\'s meta.title (its file, flow/instances.ts readFlowInstance); a Day has none of its own (its heading is its date)',
    flowView: 'a Flow\'s meta.view',
    dirty: 'the hosted form\'s draft fact (DocumentInPane.dirty, the face\'s data-dirty)',
    outcome: 'the save router\'s last named outcome (DocumentInPane.outcome); before any save, saved where the face holds nothing its owner does not (the Saved state: the owner holds this revision, centralDeviceModel.ts FLOW_STATES)',
    face: 'the Day document\'s meta.face (the Day device\'s reading, when the reached Day is its document)',
    date: 'the Day\'s civil date (the Day device\'s, when the reached Day is its document)',
    tabTitle: 'the pane\'s own tab title (centralDocuments.ts subjectOf)',
    highlights: 'the passages the page\'s <mark> spans mark (pageReadings.ts wordsOfHtml)',
    notes: 'the page\'s notes (ql-flow.html D.notes; a Day\'s notes)',
    entries: 'a Flow\'s entries: author, first sentence, a highlight or a note on it',
    packet: 'the page\'s own packet (ql-flow.html D.packet; a Day\'s packet)',
    journal: 'a Flow\'s journal pages, by their civil day',
    island: 'what the island\'s other keys hold',
  },
  writes: {
    save: 'the hosted face\'s Save (DocumentInPane.save: a Flow\'s revision-checked central.files.write; a Day\'s receiving write)',
    reread: 'the hosted face\'s Re-read (DocumentInPane.reread)',
  },
  local: {
    view: 'Page or Source changes how this device shows the page; the page itself is the same',
    copy: 'Copy puts the packet on the clipboard as JSON; nothing is written to the page',
    copied: 'whether this device copied the packet',
  },
  refused: {
    title: 'No owner operation renames a page from here: the title is written on the page itself.',
    template: 'A page keeps the template it opened with; no owner operation changes it from here.',
    flowView: `The Flow keeps its view in meta.view: choose Dialogue, Flow or Journal on the page — ${ON_THE_PAGE}.`,
    ground: 'A Day or a Flow keeps its template\'s paper; only a Being or a Thing sets its own.',
    layout: 'A Day or a Flow keeps its template\'s layout; only a Being or a Thing sets its own.',
    pinned: 'Pin is the pane\'s: pin the document\'s tab in its pane.',
    agentWrites: 'No owner holds how agent entries arrive on a page.',
    autosave: 'The hosted form saves only when you press Save: no owner saves by itself.',
    clear: `Clear empties the page's own packet on the page — ${ON_THE_PAGE}.`,
  },
  absent: {
    ground: 'The page\'s paper is its template\'s (a Day or a Flow sets none).',
    layout: 'The page\'s layout is its template\'s (a Day or a Flow sets none).',
    pinned: 'No owner reports whether the pane is pinned to its page.',
    agentWrites: 'No owner holds how agent entries arrive on a page.',
    autosave: 'No owner saves a page by itself.',
  },
}

export const FLOW_WIRING: DesignWiring = {
  design: FLOW_DESIGN,
  keys: ['light', 'title', 'template', 'plural', 'media', 'people', 'pages', 'entries', 'roster', 'extra', 'upgraded', 'view', 'entry', 'relation', 'speaker', 'page',
    'bring', 'revision', 'state', 'lastSave', 'save', 'reread', 'in:<agent>', 'left:<initial>'],
  reads: {
    light: 'the Flow\'s file answered (lit) or refused (dark)',
    title: 'meta.title', template: 'meta.template (its version)', plural: 'the current form (format v4, flow/plural.ts isCurrentFormat)',
    media: 'the files the page keeps (D.media)', people: 'meta.participants (initial, name, person or agent, binding basis); `left:<initial>` for one that left',
    pages: 'the journal\'s pages, by their civil day', entries: 'the entries: author, time, first sentence, relation, sources and artifacts',
    roster: 'Central\'s accepted agents (owners/readers.ts useRosterAgents) not yet in the Flow',
    view: 'meta.view', revision: 'meta.revision (the page\'s own counter)', state: 'saved, or edited since save (the hosted form\'s draft fact)',
    lastSave: 'the save router\'s last named outcome (DocumentInPane.outcome); none before a save',
  },
  writes: {
    extra: 'the next entry, appended as the person\'s through the Flow\'s own write (flow/instance.ts appendEntry + central.files.write, op file_operation; FlowSurface.tsx save)',
    save: 'the hosted face\'s Save (DocumentInPane.save)',
    reread: 'the hosted face\'s Re-read (DocumentInPane.reread)',
  },
  local: {
    entry: 'the entry the next entry connects to (New: a line of its own)',
    relation: 'how the next entry connects (Reply by default)',
    speaker: 'who writes the next entry (the person, by default)',
    page: 'the journal page this device shows (the last, by default)',
    bring: 'the agent chosen to bring in',
  },
  refused: {
    view: `The Flow keeps its view in meta.view: choose Dialogue, Flow or Journal on the page — ${ON_THE_PAGE}.`,
    upgraded: `The page upgrades its own form (ql-flow.html meta.upgrade) — ${ON_THE_PAGE}.`,
    'in:<agent>': `A participant joins on the page itself (ql-flow.html participants) — ${ON_THE_PAGE}.`,
    'left:<initial>': `A participant leaves on the page itself (ql-flow.html participants) — ${ON_THE_PAGE}.`,
  },
  absent: {},
}

export const TEXT_WIRING: DesignWiring = {
  design: TEXT_DESIGN,
  keys: ['light', 'size', 'document', 'entries', 'entry', 'from', 'to', 'styles', 'marks'],
  reads: {
    light: 'the reached Flow\'s file answered', document: 'the pane\'s tab title', entries: 'the entries\' words (author, text)',
    styles: 'each entry\'s paragraph style: its first block tag (h2 a Head, blockquote a Quote, ul/li a List)',
    marks: 'each word\'s emphasis: its inline tags (b/strong, i/em, s/strike/del)',
  },
  writes: {},
  local: {},
  refused: {
    size: 'The page sets its own type (ql-flow.html .body p: 17 px, 20 px on a Flow page); no channel carries a reading size into the hosted form.',
    styles: `A paragraph's style is set on the page: select it in the Flow's pane — ${ON_THE_PAGE}.`,
    marks: `A word's emphasis is set on the page: select the words in the Flow's pane — ${ON_THE_PAGE}.`,
    entry: NO_SELECTION, from: NO_SELECTION, to: NO_SELECTION,
  },
  absent: {
    size: 'No owner reports a reading size: the page sets its own type.',
    entry: NO_SELECTION, from: NO_SELECTION, to: NO_SELECTION,
  },
}

export const HIGHLIGHT_WIRING: DesignWiring = {
  design: HIGHLIGHT_DESIGN,
  keys: ['light', 'colour', 'show', 'pen', 'tool', 'flow', 'flowTitle', 'entries', 'marks', 'sel', 'passage', 'note', 'toPacket', 'answer'],
  reads: {
    light: 'the reached Flow\'s file answered', colour: 'the template\'s one marker colour, yellow (ql-flow.html:10 --hl #FFE97A; :90 .body mark)',
    flow: 'the Flow\'s file name', flowTitle: 'meta.title', entries: 'the entries (number, author, words)',
    marks: 'the words each <mark> span covers, one letter for each word (y: the template\'s yellow)',
  },
  writes: {},
  local: {sel: 'whether the selection tool stands on the held passage (this device\'s own view)'},
  refused: {
    colour: 'The template keeps one marker colour (ql-flow.html --hl); no other colour is the page\'s.',
    show: `Fading the words that are not marked is the page's to draw — ${ON_THE_PAGE}.`,
    pen: `The page's own selection makes a highlight — ${ON_THE_PAGE}.`,
    tool: 'The template shows its selection bar whenever words are selected (ql-flow.html:1063, :1070 placeTool); it has no switch to turn it off.',
    marks: `A highlight is made on the page: select the passage in the Flow's pane and press Highlight — ${ON_THE_PAGE}.`,
    note: `A note is made on the page: select the passage in the Flow's pane and press Note — ${ON_THE_PAGE}.`,
    toPacket: `A passage joins the packet on the page: select it in the Flow's pane and press To packet — ${ON_THE_PAGE}.`,
    answer: 'Answer this sends the packet through the Answer device (the agent that answers, last on the chain).',
  },
  absent: {
    show: 'The template has no Show setting.', pen: 'The template has no Pen setting.', tool: 'The template has no switch for its selection bar.',
    sel: NO_SELECTION, passage: NO_SELECTION,
  },
}

export const NOTES_WIRING: DesignWiring = {
  design: NOTES_DESIGN,
  keys: ['light', 'name', 'title', 'tabTitle', 'timing', 'anchor', 'show', 'order', 'open', 'listPage', 'entries', 'notes'],
  reads: {
    light: 'the reached Flow\'s file answered', name: 'the Flow\'s file name', title: 'meta.title', tabTitle: 'the pane\'s own tab title',
    entries: 'the entries\' words (author, the whole entry\'s text, which a note\'s quoted passage is tested against)',
    notes: 'the page\'s notes (ql-flow.html D.notes: entry, quoted passage, timing — during when the page keeps none — time, words, replies)',
  },
  writes: {},
  local: {
    order: 'the order of this device\'s list of notes', open: 'the entry this device opens (the page\'s own open entry, meta.current, to begin with)',
    listPage: 'the page of this device\'s list',
  },
  refused: {
    notes: `A note is written on the page: select a passage in the Flow's pane and press Note — ${ON_THE_PAGE}.`,
    timing: `The next note is written on the page, which sets its timing (ql-flow.html:1075 'during') — ${ON_THE_PAGE}.`,
    anchor: `The next note stands where you make it on the page — ${ON_THE_PAGE}.`,
    show: `Which notes stand beside the page is the page's to draw — ${ON_THE_PAGE}.`,
  },
  absent: {
    timing: 'No owner holds the timing of a note not yet written.', anchor: 'No owner holds where a note not yet written stands.',
    show: 'The template draws every note beside its entry; it has no Show setting.',
  },
}

const NO_PAGE_LISTS = 'No owner lists them for a page yet: the oi-beings and oi-things forms\' owner has landed no listing read (shell/modeGrammar.ts Beings, Things).'
const NO_PAGE_WRITE = 'The oi.page/v1 page has no owner write the shell can reach (desktop/cradle/src/personal/page.mjs holds the page law; no kernel op carries a page save).'

const pageWiring = (design: string, kind: boolean): DesignWiring => ({
  design,
  keys: ['light', 'world', ...(kind ? ['kind'] : []), 'subject', 'o1', 'o2', 'o3', 'o4', 'expression', 'place', 'anchor', 'layout', 'ground', 'worlds', 'subjects',
    'expressions', 'places', 'anchors', 'title', 'sections', 'links', 'template', 'sources', 'addSource', 'dropSource'],
  reads: {
    light: 'the page\'s island parsed as oi.page/v1', world: 'bindings.worldRef', subject: 'bindings.subjectRef', o1: 'bindings.categories holds C1', o2: 'C2', o3: 'C3', o4: 'C4',
    expression: 'bindings.expressionRef', layout: 'appearance.layout', ground: 'appearance.tone', title: 'meta.title', sections: 'page.sections', links: 'page.links',
    template: 'meta.template at meta.templateVersion', sources: 'bindings.sources (each a ref at its revision)',
  },
  writes: {},
  local: {},
  refused: Object.fromEntries(['world', ...(kind ? ['kind'] : []), 'subject', 'o1', 'o2', 'o3', 'o4', 'expression', 'place', 'anchor', 'layout', 'ground', 'addSource', 'dropSource'].map(key => [key, NO_PAGE_WRITE])),
  absent: {
    ...(kind ? {kind: 'The page holds no kind of its own: a subject\'s kind is the roster\'s, which no page listing reports yet.'} : {}),
    place: 'The page binds no place: the subject\'s place in the wiki carries it, and no reading of it reaches here.',
    anchor: 'The page binds no anchor: the subject\'s place in the wiki carries it, and no reading of it reaches here.',
    worlds: NO_PAGE_LISTS, subjects: NO_PAGE_LISTS, expressions: NO_PAGE_LISTS, places: NO_PAGE_LISTS, anchors: NO_PAGE_LISTS,
  },
})
export const BEINGS_WIRING: DesignWiring = pageWiring(BEINGS_DESIGN, true)
export const THINGS_WIRING: DesignWiring = pageWiring(THINGS_DESIGN, false)

const BOOK_KEEPS = 'The workspace book keeps every part of the context, for every mode, at every change (desktop/cradle/src/workspace/store.ts): it has no such setting.'
export const WORKSPACE_WIRING: DesignWiring = {
  design: WORKSPACE_DESIGN,
  keys: ['light', 'name', 'kind', 'folder', 'place', 'keepPanes', 'keepInstruments', 'keepWidgets', 'keepSets', 'rememberIn', 'onLaunch', 'openIn', 'keepWhen', 'sendToDay',
    'mode', 'mem', 'fresh', 'dirty', 'widgets', 'visited', 'clip', 'folders', 'trees', 'sets', 'clips', 'launch', 'keepNow'],
  reads: {
    light: 'the book holds this workspace open (it is the current one)', name: 'the workspace\'s name', folder: 'its project, or Central',
    mode: 'the open mode (layout.mode)', mem: 'the modes whose pane tree the book keeps (layout, modeLayouts)', fresh: 'the book keeps no tree and no set for it yet',
    widgets: 'the widgets open on the rail', visited: 'when the book last stood in it (lastVisitedAt)',
    trees: 'each mode\'s pane tree (splits with weights, tab groups with their tabs and pins)', sets: 'the newest named set of each mode',
  },
  writes: {
    mode: 'the book\'s own mode switch (continuity/workspace.tsx setMode → store.ts switchMode): the open mode turns',
    name: 'the book\'s own rename of the current workspace (store.ts rename)',
  },
  local: {clip: 'the clip this device holds selected'},
  refused: {
    kind: BOOK_KEEPS, folder: 'A workspace\'s project is its world context; no owner operation moves it from here.',
    place: 'No owner places a workspace on the planet yet.', keepPanes: BOOK_KEEPS, keepInstruments: BOOK_KEEPS, keepWidgets: BOOK_KEEPS, keepSets: BOOK_KEEPS,
    rememberIn: BOOK_KEEPS, onLaunch: BOOK_KEEPS, openIn: BOOK_KEEPS, keepWhen: BOOK_KEEPS, sendToDay: 'No route sends a workspace\'s work to the Day yet.',
    launch: 'This workspace is the one open: its context stands. A launch is choosing it among the workspaces.', keepNow: BOOK_KEEPS,
  },
  absent: {
    kind: BOOK_KEEPS, place: 'No owner places a workspace on the planet yet.', keepPanes: BOOK_KEEPS, keepInstruments: BOOK_KEEPS, keepWidgets: BOOK_KEEPS, keepSets: BOOK_KEEPS,
    rememberIn: BOOK_KEEPS, onLaunch: BOOK_KEEPS, openIn: BOOK_KEEPS, keepWhen: BOOK_KEEPS, sendToDay: 'No route sends a workspace\'s work to the Day yet.',
    dirty: 'No owner reports which of a workspace\'s documents hold edits the owner does not.',
    folders: 'The projects of Work are the world\'s reading, which this device does not take.',
    clips: 'The book keeps no list of the project\'s files; the files are the owner\'s listing, which this device does not take.',
  },
}

export const PAGE_WIRINGS: readonly DesignWiring[] = [DOCUMENT_WIRING, FLOW_WIRING, TEXT_WIRING, HIGHLIGHT_WIRING, NOTES_WIRING, BEINGS_WIRING, THINGS_WIRING, WORKSPACE_WIRING]

// ---------------------------------------------------------------------------------------------------------------- the binding

/** The view's own keys, held outside any one view so the chain, the pool, the pane and the rail draw the same (one store, keyed by
 * device id). Nothing here is an owner reading. */
type Held = Readonly<Record<string, Value>>
const holds = new Map<string, Held>()
const holdListeners = new Set<() => void>()
let holdVersion = 0
export function heldOf(id: string): Held { return holds.get(id) ?? {} }
export function setHeld(id: string, key: string, value: Value | undefined): void {
  const was = heldOf(id)
  if (was[key] === value) return
  const next: Record<string, Value> = {...was}
  if (value === undefined) delete next[key]; else next[key] = value
  holds.set(id, next)
  holdVersion++
  for (const listener of holdListeners) listener()
}
export const subscribeHolds = (listener: () => void): (() => void) => { holdListeners.add(listener); return () => { holdListeners.delete(listener) } }
export const holdsVersion = (): number => holdVersion
export function resetHolds(): void { holds.clear(); holdVersion++; for (const listener of holdListeners) listener() }

/** A key the wiring refuses: the named key, or a dynamic one (`in:<agent>`, `left:<initial>`) its pattern names. */
const refusalOf = (wiring: DesignWiring, key: string): string | undefined =>
  wiring.refused[key] ?? Object.entries(wiring.refused).find(([pattern]) => pattern.includes(':<') && key.startsWith(pattern.slice(0, pattern.indexOf('<'))))?.[1]

/** The owner's acts a binding carries, by key: each receives the value the hand set and resolves when the owner answered, or throws
 * the owner's own words. */
export type PageActs = Readonly<Record<string, (value: Value) => Promise<void>>>

/** A binding over the wiring: the values (owner readings and the view's own keys), the writes the owner takes, the refusals in
 * words. `why` gives the reason an owner write cannot act now (no page reached, the face still reading); it stands disabled. */
export function pageBinding(id: string, wiring: DesignWiring, values: Values, acts: PageActs, why: Readonly<Record<string, string>> = {}, extraStanding: Readonly<Record<string, Standing>> = {}): DesignBinding {
  const local: Record<string, (value: Value | undefined) => void> = {}
  for (const key of Object.keys(wiring.local)) local[key] = value => setHeld(id, key, value)
  const standing: Record<string, Standing> = {}
  for (const [key, reason] of Object.entries(wiring.refused)) if (!key.includes(':<')) standing[key] = {disabled: reason}
  for (const [key, reason] of Object.entries(why)) standing[key] = {disabled: reason}
  Object.assign(standing, extraStanding)
  return {
    id,
    values,
    // A write the owner takes reaches `write`, and so does a refused one, so its refusal is said in the wiring's own words; a pure
    // reading is the host's to refuse (drawn disabled: "A reading: the owner reports it").
    writes: key => !!acts[key] || !!why[key] || refusalOf(wiring, key) !== undefined,
    write: async (changes: readonly ValueChange[]) => {
      for (const change of changes) {
        if (why[change.key]) throw new Error(why[change.key])
        const refused = refusalOf(wiring, change.key)
        if (refused) throw new Error(refused)
        const act = acts[change.key]
        if (!act) throw new Error(`${change.key}: ${wiring.reads[change.key] ? 'a reading — the owner reports it, and nothing here changes it' : 'no owner takes a change of it here'}.`)
        await act(change.value)
      }
    },
    local,
    standing,
  }
}

/** The values with the view's own keys laid over the owner's readings (each at its default until the hand moves it). */
function withHeld(id: string, wiring: DesignWiring, owner: Record<string, Value>, defaults: Readonly<Record<string, Value | undefined>>): Values {
  const held = heldOf(id)
  for (const key of Object.keys(wiring.local)) {
    const value = held[key] ?? defaults[key]
    if (value !== undefined) owner[key] = value
  }
  return owner
}

// ---------------------------------------------------------------------------------------------------------------- the reached page

/** The document the hand reached, as the door carries it (documentDoor.ts DocumentInPane), reduced to what the bindings read. */
export interface ReachedPage {
  readonly form: 'Day' | 'Flow'
  /** The pane's tab title. */
  readonly tabTitle: string
  readonly dirty: boolean | null
  readonly outcome: SaveRouterOutcome | null
  /** The file's base name (`flow-2026-10-03-1432`), a Flow's. */
  readonly name: string | null
  readonly save?: () => void
  readonly reread?: () => void
}

/** The page's material: a Flow's parsed page (or its owner's refusal), or the Day document's (when the reached Day is the Day
 * device's document: its face and date too). */
export type PageMaterial =
  | {readonly form: 'flow'; readonly page: FlowPage | null; readonly refusal: string | null}
  | {readonly form: 'day'; readonly page: DayPage | null; readonly face: number | null; readonly date: string | null; readonly refusal: string | null}

const lightOf = (material: PageMaterial | null): 'lit' | 'dark' | undefined =>
  !material ? undefined : material.page ? 'lit' : material.refusal ? 'dark' : undefined

const markedRuns = (entries: readonly PageEntry[]): number => entries.reduce((sum, entry) =>
  sum + wordsOfHtml(entry.html).reduce((runs, word, at, all) => runs + (word.marked && !all[at - 1]?.marked ? 1 : 0), 0), 0)

const NO_ACT = (form: string) => `The ${form}'s face has not answered its first read yet: wait for it, or re-read it in its pane.`

/** The Document's readings (DOCUMENT_WIRING). */
export function documentValues(id: string, reached: ReachedPage, material: PageMaterial | null): Values {
  const values: Record<string, Value> = {}
  const light = lightOf(material)
  if (light) values.light = light
  values.template = reached.form === 'Day' ? 'day' : 'flow'
  values.tabTitle = reached.tabTitle
  if (reached.dirty !== null) values.dirty = reached.dirty
  // The save state: the router's named outcome; before any save, Saved where the owner holds what the page holds.
  if (reached.outcome) values.outcome = reached.outcome
  else if (reached.dirty === false && light === 'lit') values.outcome = 'saved'
  if (material?.form === 'flow' && material.page) {
    const page = material.page
    values.title = page.title
    if (page.view) values.flowView = page.view
    const noted = new Set(page.notes.map(note => note.entry).filter((n): n is number => n !== null))
    values.entries = JSON.stringify(page.entries.map(entry => ({by: entry.by, head: headOf(entry.text),
      ...(wordsOfHtml(entry.html).some(word => word.marked) ? {hl: true} : {}), ...(noted.has(entry.n) ? {note: true} : {})})))
    values.highlights = markedRuns(page.entries)
    values.notes = page.notes.length
    values.packet = JSON.stringify(page.packet.filter(item => item.entry !== null).map(item => ({entry: item.entry, scope: item.scope, text: item.text})))
    values.journal = JSON.stringify(page.journal.map(entry => civilDayName(civilDateOf(entry.at)) ?? '—'))
    values.island = JSON.stringify(page.island)
  }
  if (material?.form === 'day') {
    // A Day's page has no title of its own: the template heads it with its date.
    values.title = ''
    if (material.face !== null) values.face = material.face
    if (material.date) values.date = material.date
    if (material.page) {
      values.highlights = material.page.highlights
      values.notes = material.page.notes.length
      values.packet = JSON.stringify(material.page.packet.filter(item => item.entry !== null).map(item => ({entry: item.entry, scope: item.scope, text: item.text})))
      values.island = JSON.stringify(material.page.island)
    }
  }
  return withHeld(id, DOCUMENT_WIRING, values, {view: 'page', copied: false})
}

/** The Document's binding: its readings, the hosted face's Save and Re-read, Copy to the clipboard. */
export function documentBinding(id: string, reached: ReachedPage, material: PageMaterial | null, clipboard?: (text: string) => Promise<void>): DesignBinding {
  const values = documentValues(id, reached, material)
  const form = reached.form
  const acts: PageActs = {
    save: async () => { if (!reached.save) throw new Error(NO_ACT(form)); reached.save() },
    reread: async () => { if (!reached.reread) throw new Error(NO_ACT(form)); reached.reread() },
  }
  const why: Record<string, string> = {}
  if (!reached.save) why.save = NO_ACT(form)
  if (!reached.reread) why.reread = NO_ACT(form)
  const binding = pageBinding(id, DOCUMENT_WIRING, values, acts, why)
  // Copy is the view's own act: the packet as JSON on the clipboard, then the copied mark.
  const copy = (value: Value | undefined) => {
    if (value !== true) return
    const packet = typeof values.packet === 'string' ? values.packet : null
    if (!packet || !clipboard) return
    void clipboard(packet).then(() => setHeld(id, 'copied', true), () => setHeld(id, 'copied', false))
  }
  return {...binding, local: {...binding.local, copy}}
}

// ---------------------------------------------------------------------------------------------------------------- the Flow

/** The Flow's readings (FLOW_WIRING). `roster` is Central's accepted agents (null while it answers). */
export function flowValues(id: string, reached: ReachedPage, material: PageMaterial | null, roster: readonly Pick<RosterAgent, 'ref' | 'name' | 'accepted'>[] | null): Values {
  const values: Record<string, Value> = {}
  const light = lightOf(material)
  if (light) values.light = light
  if (reached.dirty !== null) values.state = reached.dirty ? 'edited' : 'saved'
  values.lastSave = reached.outcome ?? ''
  const page = material?.form === 'flow' ? material.page : null
  const defaults: Record<string, Value | undefined> = {entry: 0, relation: 'reply'}
  if (page) {
    values.title = page.title
    if (page.template) values.template = page.template.split(/\s+/).pop()!
    values.plural = page.plural
    values.media = page.media
    if (page.view) values.view = page.view
    if (page.revision !== null) values.revision = page.revision
    values.people = JSON.stringify(page.people.map(person => ({initial: person.initial, name: person.name, kind: person.kind, basis: person.basis})))
    for (const person of page.people) if (person.left) values[`left:${person.initial}`] = true
    values.pages = JSON.stringify(page.journal.map(entry => civilDayName(civilDateOf(entry.at)) ?? '—'))
    values.entries = JSON.stringify(page.entries.map(entry => ({by: entry.by, at: clockOf(entry.at) ?? '—', head: headOf(entry.text),
      ...(entry.relation ? {rel: entry.relation} : {}), ...(entry.sources ? {src: entry.sources} : {}), ...(entry.artifacts ? {art: entry.artifacts} : {})})))
    // Who writes the next entry: the person (FlowSurface.tsx writerOf — the person participant still in the Flow).
    const writer = page.people.find(person => person.kind === 'person' && !person.left)
    if (writer) defaults.speaker = writer.initial
    defaults.page = Math.max(1, page.journal.length)
    if (roster) {
      const present = new Set(page.people.flatMap(person => [person.ref, person.name].filter((x): x is string => !!x)))
      const offers = roster.filter(agent => agent.accepted && !present.has(agent.ref) && !present.has(agent.name)).map(agent => ({id: agent.ref, name: agent.name}))
      values.roster = JSON.stringify(offers)
      defaults.bring = offers[0]?.id ?? 'none'
    }
  }
  return withHeld(id, FLOW_WIRING, values, defaults)
}

/** A line the widget wrote: the entry the design composes (central__flow-document.tsx append: by, at, head, rel). */
interface Composed {readonly by: string; readonly head: string; readonly rel?: {readonly type: string; readonly to: readonly number[]}}

/** What the Flow's write needs: append one entry as the person, connected to an earlier one, through the Flow's own write. */
export interface FlowWriters {
  readonly append: (entry: {readonly text: string; readonly speaker: string; readonly relation: {readonly type: 'reply' | 'branch' | 'correct'; readonly entryId: string} | null}) => Promise<void>
}

/** The Flow's binding: its readings, the person's next entry through the Flow's own write, the hosted face's Save and Re-read. */
export function flowBinding(id: string, reached: ReachedPage, material: PageMaterial | null, roster: Parameters<typeof flowValues>[3], writers: FlowWriters | null): DesignBinding {
  const values = flowValues(id, reached, material, roster)
  const page = material?.form === 'flow' ? material.page : null
  const acts: PageActs = {
    save: async () => { if (!reached.save) throw new Error(NO_ACT('Flow')); reached.save() },
    reread: async () => { if (!reached.reread) throw new Error(NO_ACT('Flow')); reached.reread() },
    extra: async value => {
      if (!page || !writers) throw new Error(material?.refusal ?? 'The Flow has not been read yet, so no entry can join it.')
      if (reached.dirty) throw new Error('The page holds edits its owner does not: save or re-read them first, so the entry joins the revision you read.')
      let lines: unknown
      try { lines = JSON.parse(String(value)) } catch { lines = null }
      const composed = (Array.isArray(lines) ? lines : []).filter((line): line is Composed => !!line && typeof (line as Composed).head === 'string' && typeof (line as Composed).by === 'string')
      for (const line of composed) {
        const speaker = page.people.find(person => person.initial === line.by)
        if (!speaker) throw new Error(`${line.by} is not in this Flow.`)
        // An entry the shell writes is the person's (FlowSurface.tsx writerOf); an agent's entry comes from the agent itself.
        if (speaker.kind !== 'person') throw new Error(`${speaker.name || speaker.initial} is an agent: an agent's entry comes from the agent, and the shell writes only the person's.`)
        const to = line.rel && line.rel.to.length === 1 ? page.entries[line.rel.to[0]! - 1] : undefined
        const type = line.rel?.type
        if (line.rel && (!to || (type !== 'reply' && type !== 'branch' && type !== 'correct'))) throw new Error('The entry this one connects to is not in the Flow.')
        await writers.append({text: line.head, speaker: speaker.initial, relation: to && type ? {type: type as 'reply' | 'branch' | 'correct', entryId: to.id} : null})
      }
    },
  }
  const why: Record<string, string> = {}
  if (!reached.save) why.save = NO_ACT('Flow')
  if (!reached.reread) why.reread = NO_ACT('Flow')
  const standing: Record<string, Standing> = {}
  for (const key of Object.keys(values)) if (key.startsWith('left:')) standing[key] = {disabled: FLOW_WIRING.refused['left:<initial>']!}
  if (page && roster) for (const agent of roster) standing[`in:${agent.ref}`] = {disabled: FLOW_WIRING.refused['in:<agent>']!}
  return pageBinding(id, FLOW_WIRING, values, acts, why, standing)
}

// ---------------------------------------------------------------------------------------------------------------- the effects

/** The words an effect device reads of an entry: at most this many (a long entry's start). */
export const EFFECT_WORDS = 160

/** Text's readings (TEXT_WIRING): the entries' words, each paragraph's style and each word's emphasis, as the page keeps them. */
export function textValues(reached: ReachedPage, material: PageMaterial | null): Values {
  const values: Record<string, Value> = {document: reached.tabTitle}
  const light = lightOf(material)
  if (light) values.light = light
  const page = material?.form === 'flow' ? material.page : null
  if (page) {
    const styles: Record<string, string> = {}, marks: Record<string, string> = {}
    values.entries = JSON.stringify(page.entries.map(entry => {
      const words = wordsOfHtml(entry.html, EFFECT_WORDS)
      if (entry.style !== 'body') styles[entry.n] = entry.style
      words.forEach((word, at) => { if (word.flags) marks[`${entry.n}:${at}`] = word.flags })
      return {by: entry.by, head: words.map(word => word.word).join(' ')}
    }))
    values.styles = JSON.stringify(styles)
    values.marks = JSON.stringify(marks)
  }
  return values
}

/** Highlight's readings (HIGHLIGHT_WIRING): the entries, and one letter for each word — `y` where a <mark> covers it. */
export function highlightValues(id: string, reached: ReachedPage, material: PageMaterial | null): Values {
  const values: Record<string, Value> = {}
  const light = lightOf(material)
  if (light) values.light = light
  const page = material?.form === 'flow' ? material.page : null
  if (page) {
    values.colour = 'yellow'
    values.flow = reached.name ?? reached.tabTitle
    values.flowTitle = page.title
    const rows: string[] = []
    values.entries = JSON.stringify(page.entries.map(entry => {
      const words = wordsOfHtml(entry.html, EFFECT_WORDS)
      rows.push(words.map(word => (word.marked ? 'y' : '.')).join(''))
      return {n: entry.n, by: entry.by, text: words.map(word => word.word).join(' ')}
    }))
    values.marks = rows.join('|')
  }
  return withHeld(id, HIGHLIGHT_WIRING, values, {sel: false})
}

/** Notes' readings (NOTES_WIRING): the entries' whole words and the page's notes. */
export function notesValues(id: string, reached: ReachedPage, material: PageMaterial | null): Values {
  const values: Record<string, Value> = {tabTitle: reached.tabTitle}
  const light = lightOf(material)
  if (light) values.light = light
  const page = material?.form === 'flow' ? material.page : null
  const defaults: Record<string, Value | undefined> = {order: 'place', listPage: 0}
  if (reached.name) values.name = reached.name
  if (page) {
    values.title = page.title
    values.entries = JSON.stringify(page.entries.map(entry => ({by: entry.by, head: entry.text})))
    values.notes = JSON.stringify(page.notes.map(note => ({id: note.id, entry: note.entry, anchor: note.anchor, text: note.text, timing: note.timing,
      at: note.at ?? '', replies: note.replies})))
    if (page.entries.length) defaults.open = page.current ?? 1
  }
  return withHeld(id, NOTES_WIRING, values, defaults)
}

export const textBinding = (id: string, reached: ReachedPage, material: PageMaterial | null): DesignBinding => pageBinding(id, TEXT_WIRING, textValues(reached, material), {})
export const highlightBinding = (id: string, reached: ReachedPage, material: PageMaterial | null): DesignBinding => pageBinding(id, HIGHLIGHT_WIRING, highlightValues(id, reached, material), {})
export const notesBinding = (id: string, reached: ReachedPage, material: PageMaterial | null): DesignBinding => pageBinding(id, NOTES_WIRING, notesValues(id, reached, material), {})

// ---------------------------------------------------------------------------------------------------------------- Beings and Things

const recordOf = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)
const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** A Beings or Things page's readings (BEINGS_WIRING, THINGS_WIRING) from its parsed oi.page/v1 island (personal/page.mjs
 * readPage). Null island: nothing is read, and the light stays dark. */
export function pageValues(doc: unknown): Values {
  const page = recordOf(doc)
  if (!page || page.profile !== 'oi.page/v1') return {light: 'dark'}
  const values: Record<string, Value> = {light: 'lit'}
  const meta = recordOf(page.meta) ?? {}, bindings = recordOf(page.bindings) ?? {}, appearance = recordOf(page.appearance) ?? {}, body = recordOf(page.page) ?? {}
  const title = textOf(meta.title)
  if (title !== null) values.title = title
  const template = textOf(meta.template), version = textOf(meta.templateVersion)
  if (template) values.template = `${template.replace(/^oi\.template\//, '').replace(/^./, c => c.toUpperCase())}${version ? ` v${version}` : ''}`
  for (const [key, from] of [['world', bindings.worldRef], ['subject', bindings.subjectRef], ['expression', bindings.expressionRef]] as const) {
    if (from === null) values[key] = ''
    else if (typeof from === 'string') values[key] = from
  }
  if (Array.isArray(bindings.categories)) for (const n of [1, 2, 3, 4]) values[`o${n}`] = bindings.categories.includes(`C${n}`)
  if (appearance.layout === 'portrait' || appearance.layout === 'editorial') values.layout = appearance.layout
  if (appearance.tone === 'paper' || appearance.tone === 'ink') values.ground = appearance.tone
  if (Array.isArray(body.sections)) values.sections = body.sections.length
  if (Array.isArray(body.links)) values.links = body.links.length
  if (Array.isArray(bindings.sources)) {
    values.sources = JSON.stringify(bindings.sources.map(recordOf).filter((source): source is Record<string, unknown> => source !== null).map(source => {
      const ref = textOf(source.ref) ?? ''
      return {name: ref.split(/[/:]/).filter(Boolean).pop() ?? ref, ref, rev: textOf(source.revision) ?? ''}
    }))
  }
  return values
}

export const beingsBinding = (id: string, doc: unknown): DesignBinding => pageBinding(id, BEINGS_WIRING, pageValues(doc), {})
export const thingsBinding = (id: string, doc: unknown): DesignBinding => pageBinding(id, THINGS_WIRING, pageValues(doc), {})

// ---------------------------------------------------------------------------------------------------------------- the Workspace

/** The workspace book's own shapes, as far as the Workspace reads them (desktop/cradle/src/workspace/store.ts Workspace;
 * surface/types.ts Pane). */
export interface BookPane {
  readonly type: 'group' | 'split'
  readonly id: string
  /** A group's tabs (surface ids), its pinned subset and the tab in front. */
  readonly tabs?: readonly string[]
  readonly pinned?: readonly string[]
  readonly active?: string | null
  /** A split's direction (`h` side by side, `v` stacked), its children and their weights. */
  readonly dir?: 'h' | 'v'
  readonly children?: readonly BookPane[]
  readonly weights?: readonly number[]
}
export interface BookLayout {
  readonly root: BookPane | null
  readonly mode?: string
  readonly surfaces?: Readonly<Record<string, {readonly title?: string; readonly kind?: string}>>
  readonly focusedGroupId?: string | null
}
export interface BookWorkspace {
  readonly id: string
  readonly name: string
  readonly project?: string
  readonly layout: BookLayout
  readonly modeLayouts?: Readonly<Record<string, BookLayout | undefined>>
  readonly sets?: readonly {readonly mode?: string; readonly name?: string}[]
  readonly widgets?: {readonly open: readonly string[]}
  readonly lastVisitedAt?: number
}

/** The design's modes: the book's mode names (`base` is Central, `live` is Live). */
const WORKSPACE_MODES = ['base', 'factory', 'expressions', 'techne', 'live'] as const

/** One pane of the book as the design's node: a tab group (its tab count, pins, the title of its tab in front, whether it holds the
 * focus or an instrument) or a split (its direction and weights). */
function nodeOfPane(pane: BookPane | null | undefined, layout: BookLayout, depth = 0): unknown {
  if (!pane || depth > 6) return undefined
  if (pane.type === 'group') {
    const tabs = pane.tabs ?? []
    const front = pane.active ?? tabs[0]
    const surface = front ? layout.surfaces?.[front] : undefined
    return {t: 'g', tabs: tabs.length, pinned: pane.pinned?.length ?? 0, title: surface?.title ?? '', focus: pane.id === layout.focusedGroupId,
      instrument: !!surface?.kind && surface.kind.startsWith('projection.') && surface.kind !== 'projection.central-document'}
  }
  const kids = (pane.children ?? []).map(child => nodeOfPane(child, layout, depth + 1)).filter(Boolean)
  return kids.length ? {t: 's', dir: pane.dir === 'v' ? 'v' : 'h', w: pane.weights ?? kids.map(() => 1), kids} : undefined
}

/** How long ago, in the design's short words (`now`, `5 min ago`, `3 h ago`, `2 d ago`). */
export function agoOf(at: number | undefined, now: number): string | undefined {
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined
  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`
}

/** The Workspace's readings (WORKSPACE_WIRING) from the book's current workspace. */
export function workspaceValues(id: string, workspace: BookWorkspace | null, now: number): Values {
  const values: Record<string, Value> = {}
  if (!workspace) return withHeld(id, WORKSPACE_WIRING, values, {})
  values.light = 'lit'
  values.name = workspace.name
  values.folder = workspace.project ?? 'central'
  const mode = workspace.layout.mode ?? 'base'
  values.mode = mode
  const trees: Record<string, unknown> = {}
  const open = nodeOfPane(workspace.layout.root, workspace.layout)
  if (open) trees[mode] = open
  for (const [other, layout] of Object.entries(workspace.modeLayouts ?? {})) {
    if (other === mode || !layout) continue
    const node = nodeOfPane(layout.root, layout)
    if (node) trees[other] = node
  }
  values.trees = JSON.stringify(trees)
  values.mem = WORKSPACE_MODES.filter(name => name in trees).join(',')
  const sets: Record<string, string> = {}
  // The book keeps its sets newest first: the first of each mode is the one it opens with.
  for (const set of workspace.sets ?? []) if (set.mode && set.name && !(set.mode in sets)) sets[set.mode] = set.name
  values.sets = JSON.stringify(sets)
  values.fresh = !Object.keys(trees).length && !(workspace.sets ?? []).length
  if (workspace.widgets) values.widgets = workspace.widgets.open.length
  const visited = agoOf(workspace.lastVisitedAt, now)
  if (visited) values.visited = visited
  return withHeld(id, WORKSPACE_WIRING, values, {})
}

/** The workspace book's own acts the Workspace takes: its mode switch and its rename (continuity/workspace.tsx over store.ts). */
export interface BookActs {
  readonly switchMode: (mode: string) => void
  readonly rename: (name: string) => void
}

/** The Workspace's binding: the open mode turns, and the name changes, through the book's own acts. */
export function workspaceBinding(id: string, workspace: BookWorkspace | null, now: number, book: BookActs | null): DesignBinding {
  const NO_BOOK = 'No workspace book is mounted here.'
  const acts: PageActs = {
    mode: async value => {
      if (!book) throw new Error(NO_BOOK)
      if (typeof value !== 'string' || !(WORKSPACE_MODES as readonly string[]).includes(value)) throw new Error(`${String(value)} is none of the five modes.`)
      book.switchMode(value)
    },
    name: async value => {
      if (!book) throw new Error(NO_BOOK)
      if (typeof value !== 'string' || !value.trim()) throw new Error('A workspace keeps a name: write one.')
      book.rename(value.trim())
    },
  }
  return pageBinding(id, WORKSPACE_WIRING, workspaceValues(id, workspace, now), acts, book ? {} : {mode: NO_BOOK, name: NO_BOOK})
}
