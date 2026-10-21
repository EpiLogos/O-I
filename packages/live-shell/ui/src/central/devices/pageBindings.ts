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
import type {PageField} from '../../../../../../desktop/cradle/src/kernel/types'
import {groundValues, lastKeptThought, thoughtValues, type FlowThought, type ThoughtHand, type WorkspaceGround} from './pageGround'
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
/** The Workspace on the door: the track's Workspace device a world's head opens (§18.1; frame/tracks/useCentralTracks.ts). */
export const WORKSPACE_DEVICE_ID = WORKSPACE_DESIGN

const ON_THE_PAGE = 'the hosted form is the page\'s one writer while it holds the page (DocumentFlowFace.tsx: the bridge reads its island and never pushes into it)'
const NO_SELECTION = 'The page\'s selection (ql-flow.html currentSel) does not cross the host bridge: the bridge reads the island only (desktop/cradle/src/document/frame.ts useDocumentHostRead).'

export const DOCUMENT_WIRING: DesignWiring = {
  design: DOCUMENT_DESIGN,
  keys: ['light', 'template', 'title', 'view', 'flowView', 'ground', 'layout', 'pinned', 'agentWrites', 'autosave', 'copied', 'dirty', 'outcome', 'face', 'date',
    'tabTitle', 'highlights', 'notes', 'entries', 'packet', 'journal', 'island', 'save', 'reread', 'copy', 'clear',
    'selection', 'selectionAct', 'packetScope', 'act.highlight', 'act.note', 'act.topacket', 'act.remember', 'act.answerthis'],
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
    // D6, the Selection group (§17.8): what a plain selection does and what Answer this reads are the shell's, held for the person.
    selectionAct: 'what a plain selection does (Highlight, Note, To packet, Remember or Answer this): the shell holds it, no owner keeps it',
    packetScope: 'what Answer this reads (the selection, the page, or what the page links): the shell holds it, no owner keeps it',
  },
  refused: {
    template: 'A page keeps the template it opened with; no owner operation changes it from here.',
    ground: 'A Day or a Flow keeps its template\'s paper; only a Being or a Thing sets its own.',
    layout: 'A Day or a Flow keeps its template\'s layout; only a Being or a Thing sets its own.',
    pinned: 'Pin is the pane\'s: pin the document\'s tab in its pane.',
    agentWrites: 'No owner holds how agent entries arrive on a page.',
    autosave: 'The hosted form saves only when you press Save: no owner saves by itself.',
    clear: `Clear empties the page's own packet on the page — ${ON_THE_PAGE}.`,
    // The five passage acts (§17.8): their owners exist — the page's island through the save router, the packet, central.remember /
    // projectcentral.remember through invoke_action, the agent's Answer — but each acts on the selected passage, which never reaches
    // this device.
    'act.highlight': `Highlight marks the selected passage on the page: ${NO_SELECTION} Select it in the page's pane and press Highlight there (Clip view writes it through the page owner).`,
    'act.note': `Note attaches a note to the selected passage: ${NO_SELECTION} Select it in the page's pane and press Note there.`,
    'act.topacket': `To packet adds the selected passage to the page's packet: ${NO_SELECTION}`,
    'act.remember': `Remember keeps the selected passage through central.remember (projectcentral.remember for a project's page), which the kernel reaches, but it needs the passage: ${NO_SELECTION}`,
    'act.answerthis': `Answer this sends the selected passage to the agent on the world's chain (Clip view's Answer this, nara/answerThis.ts): ${NO_SELECTION}`,
  },
  absent: {
    selection: NO_SELECTION,
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
    'bring', 'revision', 'state', 'lastSave', 'save', 'reread', 'in:<agent>', 'left:<initial>', 'preflight', 'thought', 'since', 'preflightRead', 'contemplate', 'sinceRead'],
  reads: {
    light: 'the Flow\'s file answered (lit) or refused (dark)',
    title: 'meta.title', template: 'meta.template (its version)', plural: 'the current form (format v4, flow/plural.ts isCurrentFormat)',
    media: 'the files the page keeps (D.media)', people: 'meta.participants (initial, name, person or agent, binding basis); `left:<initial>` for one that left',
    pages: 'the journal\'s pages, by their civil day', entries: 'the entries: author, time, first sentence, relation, sources and artifacts',
    roster: 'Central\'s accepted agents (owners/readers.ts useRosterAgents) not yet in the Flow',
    view: 'meta.view', revision: 'meta.revision (the page\'s own counter)', state: 'saved, or edited since save (the hosted form\'s draft fact)',
    lastSave: 'the save router\'s last named outcome (DocumentInPane.outcome); none before a save',
    preflight: 'Contemplate\'s preflight, as AIKit answered the press (invoke_action `action:contemplate-flow` asked bare; pageGround.ts preflightValue)',
    thought: 'the thought of the one run this window asked (aikit.flow-cognition/v1; thoughtValue), else the Flow\'s last kept thought (aikit_read flow-thoughts, aikit.flow-thoughts/v1: thoughts[0]; JSON null when none is kept)',
    since: 'what changed since that thought (op flow_changed_since; sinceValue), on the kept thought\'s record when no run stands here',
  },
  writes: {
    preflightRead: 'Contemplate\'s preflight asked (invoke_action `action:contemplate-flow`, bare: it records nothing)',
    contemplate: 'Contemplate run once on the preflight record (invoke_action `action:contemplate-flow` with the record)',
    sinceRead: 'what changed since the thought asked (op flow_changed_since)',
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
    upgraded: `The page upgrades its own form (ql-flow.html meta.upgrade) — ${ON_THE_PAGE}.`,
    'in:<agent>': `A participant joins on the page itself (ql-flow.html participants) — ${ON_THE_PAGE}.`,
    'left:<initial>': `A participant leaves on the page itself (ql-flow.html participants) — ${ON_THE_PAGE}.`,
  },
  // The Thought page (D-package; manual §18.1 Thought): AIKit's Flow cognition through the kernel's invoke_action `action:contemplate-flow`
  // (asked bare: the preflight; with the record: one run), the Flow's last kept thought (lane W11: aikit_read flow-thoughts) and op
  // flow_changed_since on that thought.
  absent: {
    preflight: 'Not asked yet: press Preflight — Contemplate\'s preflight is asked only by a press (`action:contemplate-flow`), never by itself.',
    thought: 'The last thought: AIKit has not answered its kept thoughts for this Flow yet (`aikit flow thoughts`).',
    since: 'What changed since the thought: no thought stands yet — none is kept for this Flow, and none ran here (op flow_changed_since takes one).',
  },
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

// A Being's or a Thing's ties are written through the page owner (kernel page op `mutate_field`, desktop/cradle/kernel/src/page.rs
// apply_field: world, subject, kind, office, expression, place, anchor, sources, layout, tone), each on the revision the page was read at —
// the op Clip view already writes a page's fields through (central/clipBinding.ts writePageField; T-COVERAGE §1.3). Where no page is read
// with its revision, each tie stands disabled saying so.
const NO_PAGE_LISTS = 'No owner lists them for a page yet: the page op lists a world\'s pages (`list`), not the subjects, expressions, places or anchors a page ties to.'
const NO_PAGE_READ = 'The page owner writes this tie (kernel page op mutate_field) on the revision the page was read at; no page is read here with its revision.'
const NO_ADD_SOURCE = 'Add takes the file selected in the browser at its present revision; the browser\'s selection is not handed to the page here.'
const NO_ANCHORS = 'An anchor is a point on Earth (its latitude and longitude); no listing of anchors is handed to the page, so none can be chosen by name.'
const TIE_KEYS = (kind: boolean): string[] => ['world', ...(kind ? ['kind'] : []), 'subject', 'o1', 'o2', 'o3', 'o4', 'expression', 'place', 'anchor', 'layout', 'ground', 'addSource', 'dropSource']

const pageWiring = (design: string, kind: boolean, read = false): DesignWiring => ({
  design,
  keys: ['light', 'world', ...(kind ? ['kind'] : []), 'subject', 'o1', 'o2', 'o3', 'o4', 'expression', 'place', 'anchor', 'layout', 'ground', 'worlds', 'subjects',
    'expressions', 'places', 'anchors', 'title', 'sections', 'links', 'template', 'sources', 'addSource', 'dropSource'],
  reads: {
    light: 'the page\'s island parsed as oi.page/v1', world: 'bindings.worldRef', subject: 'bindings.subjectRef', o1: 'bindings.categories holds C1', o2: 'C2', o3: 'C3', o4: 'C4',
    ...(kind ? {kind: 'bindings.kind (person or agent)'} : {}), place: 'bindings.placeRef',
    expression: 'bindings.expressionRef', layout: 'appearance.layout', ground: 'appearance.tone', title: 'meta.title', sections: 'page.sections', links: 'page.links',
    template: 'meta.template at meta.templateVersion', sources: 'bindings.sources (each a ref at its revision)', worlds: 'the worlds Central discloses (central/centralWorlds.ts readWorlds), where handed in',
  },
  writes: read ? {
    world: 'page op mutate_field `world`', subject: 'page op mutate_field `subject`', ...(kind ? {kind: 'page op mutate_field `kind`'} : {}),
    o1: 'page op mutate_field `office` (the offices that stay on, C1–C4)', o2: 'the same', o3: 'the same', o4: 'the same',
    expression: 'page op mutate_field `expression`', place: 'page op mutate_field `place`', layout: 'page op mutate_field `layout`', ground: 'page op mutate_field `tone`',
    dropSource: 'page op mutate_field `sources` (the list without the source)',
  } : {},
  local: {},
  refused: read ? {addSource: NO_ADD_SOURCE, anchor: NO_ANCHORS} : Object.fromEntries(TIE_KEYS(kind).map(key => [key, NO_PAGE_READ])),
  absent: {
    ...(kind ? {kind: 'The page names no kind (bindings.kind): a Being is a person or an agent once the page owner writes one.'} : {}),
    place: 'The page binds no place (bindings.placeRef).',
    anchor: NO_ANCHORS,
    worlds: 'No list of worlds is handed to the page here (central/centralWorlds.ts readWorlds discloses them).', subjects: NO_PAGE_LISTS, expressions: NO_PAGE_LISTS,
    places: NO_PAGE_LISTS, anchors: NO_PAGE_LISTS,
  },
})
export const BEINGS_WIRING: DesignWiring = pageWiring(BEINGS_DESIGN, true)
export const THINGS_WIRING: DesignWiring = pageWiring(THINGS_DESIGN, false)
/** The wirings where a page is read with its revision and its owner's write is handed in (PageHand). */
export const BEINGS_READ_WIRING: DesignWiring = pageWiring(BEINGS_DESIGN, true, true)
export const THINGS_READ_WIRING: DesignWiring = pageWiring(THINGS_DESIGN, false, true)

/** Why a write of a world's ground stands: Central takes it, but it writes the person's ground and is not among the person's own presses the
 * kernel carries through invoke_action (action.rs PERSON_ACTS), so nothing writes it from here. */
const NOT_PERSON_ACT = 'it is not among the person\'s own presses the kernel carries (desktop/cradle/kernel/src/action.rs PERSON_ACTS), so it waits for the kernel to carry it.'
/** Binding a source as an intended experience or a return: Central's projectcentral.self.ux.relate {ux_ref} and ex.relate {ex_ref, actor_kind,
 * ux_refs} take a reference the design does not name, and neither is among the person's own presses the kernel carries. */
export const RELATE_UX_EX_REFUSED = `Relate as an intended experience or a return: projectcentral.self.ux.relate {ux_ref, source_ref} and ex.relate {ex_ref, source_ref, actor_kind, ux_refs} write the world's self — ${NOT_PERSON_ACT}`
const NO_WORLD_GROUND = 'no world\'s ground is read here (a workspace of your root has no ProjectCentral; Ground hygiene reads the root\'s).'
const NO_THOUGHT_HAND = 'Contemplate: no Flow is reached with its AIKit Flow ref here, so neither the preflight nor a run can be asked (`action:contemplate-flow`).'
const BOOK_KEEPS = 'The workspace book keeps every part of the context, for every mode, at every change (desktop/cradle/src/workspace/store.ts): it has no such setting.'
export const WORKSPACE_WIRING: DesignWiring = {
  design: WORKSPACE_DESIGN,
  keys: ['light', 'name', 'kind', 'folder', 'place', 'keepPanes', 'keepInstruments', 'keepWidgets', 'keepSets', 'rememberIn', 'onLaunch', 'openIn', 'keepWhen', 'sendToDay',
    'mode', 'mem', 'fresh', 'dirty', 'widgets', 'visited', 'clip', 'folders', 'trees', 'sets', 'clips', 'launch', 'keepNow',
    'pc', 'pcPlan', 'self', 'treatment', 'pcSource', 'bindAs', 'selfSource', 'pcPreview', 'pcAccept', 'selfEnsure', 'selfRelate'],
  reads: {
    light: 'the book holds this workspace open (it is the current one)',
    name: 'the world\'s name as Central discloses it (world browse), when a world\'s head opened the Workspace (§18.1 Name: "The world\'s name"); else the book\'s workspace\'s name',
    folder: 'the world\'s project, or Central for your world (world browse), when a world\'s head opened it; else the book\'s workspace\'s project, or Central',
    folders: 'the projects of Work that are worlds, as Central discloses them (world browse: central/centralWorlds.ts readWorlds)',
    mode: 'the open mode (layout.mode)', mem: 'the modes whose pane tree the book keeps (layout, modeLayouts)', fresh: 'the book keeps no tree and no set for it yet',
    widgets: 'the widgets open on the rail', visited: 'when the book last stood in it (lastVisitedAt)',
    trees: 'each mode\'s pane tree (splits with weights, tab groups with their tabs and pins)', sets: 'the newest named set of each mode',
    pc: 'what Central would make of the world\'s folder (projectcentral.inspect {project}; pageGround.ts pcValue)',
    self: 'the world\'s self (projectcentral.self.inspect {project}; selfValue)', pcPlan: 'the preview asked last (projectcentral.adopt.preview | migrate.preview; planValue)',
  },
  writes: {
    pcPreview: 'Central\'s preview of the treatment chosen (projectcentral.adopt.preview | migrate.preview {project, source}, through invoke_action): a reading, nothing changes',
    mode: 'the book\'s own mode switch (continuity/workspace.tsx setMode → store.ts switchMode): the open mode turns',
    name: 'the book\'s own rename of the current workspace (store.ts rename)',
    pcAccept: 'the person\'s Accept: projectcentral.init {project, project_id}, adopt or migrate {project, project_id, source} as previewed (invoke_action, action.rs PERSON_ACTS)',
    selfEnsure: 'the person\'s Ensure: projectcentral.self.ensure {project} (invoke_action, action.rs PERSON_ACTS)',
    selfRelate: 'the person\'s Relate of a tier: projectcentral.self.tier.relate {project, source_ref, tier, acceptance human-accepted} (invoke_action, action.rs PERSON_ACTS)',
  },
  local: {clip: 'the clip this device holds selected',
    // The Ground and Self pages' settings (D-package; manual §18.1 Ground): the person's choices, held until a preview or an accept asks.
    treatment: 'how Central would make the folder\'s ground (create, adopt or migrate): the person\'s choice, held until a preview asks for it',
    pcSource: 'the wiki a treatment keeps or copies: the person\'s choice, held until a preview asks for it',
    bindAs: 'the tier, UX or EX a source is bound as: the person\'s choice, held until Relate asks for it',
    selfSource: 'the unbound source chosen to bind: the person\'s choice, held until Relate asks for it'},
  refused: {
    pcPreview: `Preview: ${NO_WORLD_GROUND}`,
    kind: BOOK_KEEPS, folder: 'A workspace\'s project is its world context; no owner operation moves it from here.',
    place: 'No owner places a workspace on the planet yet.', keepPanes: BOOK_KEEPS, keepInstruments: BOOK_KEEPS, keepWidgets: BOOK_KEEPS, keepSets: BOOK_KEEPS,
    rememberIn: BOOK_KEEPS, onLaunch: BOOK_KEEPS, openIn: BOOK_KEEPS, keepWhen: BOOK_KEEPS, sendToDay: 'No route sends a workspace\'s work to the Day yet.',
    launch: 'This workspace is the one open: its context stands. A launch is choosing it among the workspaces.', keepNow: BOOK_KEEPS,
  },
  absent: {
    pc: 'Not read: the workspace names no project world (projectcentral.inspect reads one project), or Central has not answered.',
    pcPlan: 'Not asked yet: press Preview (projectcentral.adopt.preview or migrate.preview); Central has no preview of projectcentral.init.',
    self: 'Not read: the workspace names no project world (projectcentral.self.inspect reads one project), or Central has not answered.',
    kind: BOOK_KEEPS, place: 'No owner places a workspace on the planet yet.', keepPanes: BOOK_KEEPS, keepInstruments: BOOK_KEEPS, keepWidgets: BOOK_KEEPS, keepSets: BOOK_KEEPS,
    rememberIn: BOOK_KEEPS, onLaunch: BOOK_KEEPS, openIn: BOOK_KEEPS, keepWhen: BOOK_KEEPS, sendToDay: 'No route sends a workspace\'s work to the Day yet.',
    dirty: 'No owner reports which of a workspace\'s documents hold edits the owner does not.',
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
const DIRTY = 'The page holds edits its owner does not: save or re-read them first, so the change joins the revision you read.'

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
  // The Selection group's holds start where the manual sets them (§17.8: Selection act Highlight, Packet scope Selection).
  return withHeld(id, DOCUMENT_WIRING, values, {view: 'page', copied: false, selectionAct: 'highlight', packetScope: 'selection'})
}

/** A Flow's own metadata write (central/devices/centralDeviceWrites.ts setFlowMeta), handed in where the reached page is a Flow. */
export type FlowMetaWriter = (change: {readonly title?: string; readonly view?: string}) => Promise<void>

/** The Document's binding: its readings, the hosted face's Save and Re-read, Copy to the clipboard, and a Flow's title and view. */
export function documentBinding(id: string, reached: ReachedPage, material: PageMaterial | null, clipboard?: (text: string) => Promise<void>,
  meta?: FlowMetaWriter | null): DesignBinding {
  const values = documentValues(id, reached, material)
  const form = reached.form
  const acts: PageActs = {
    save: async () => { if (!reached.save) throw new Error(NO_ACT(form)); reached.save() },
    reread: async () => { if (!reached.reread) throw new Error(NO_ACT(form)); reached.reread() },
    // A Flow's title and view are its own file's meta, written on its revision; the page must hold no unsaved edits first.
    ...(form === 'Flow' && meta ? {
      title: async (value: Value) => { if (reached.dirty) throw new Error(DIRTY); await meta({title: String(value ?? '')}) },
      flowView: async (value: Value) => { if (reached.dirty) throw new Error(DIRTY); await meta({view: String(value ?? '')}) },
    } : {}),
  }
  const why: Record<string, string> = {}
  if (form === 'Day') {
    why.title = 'A Day has no title of its own: its heading is its date.'
    why.flowView = 'A Day has no view of its own: Dialogue, Flow and Journal are a Flow\'s.'
  } else if (!meta) {
    why.title = why.flowView = 'The Flow\'s file is not reached here: open it from the browser, and its title and view are written on its file.'
  }
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
  /** The Flow's own meta (its view), written on its file's revision (centralDeviceWrites.ts setFlowMeta). */
  readonly meta?: FlowMetaWriter
}

/** The Flow's binding: its readings, the person's next entry through the Flow's own write, the hosted face's Save and Re-read. */
export function flowBinding(id: string, reached: ReachedPage, material: PageMaterial | null, roster: Parameters<typeof flowValues>[3], writers: FlowWriters | null,
  thought: {readonly state: FlowThought; readonly hand: ThoughtHand | null} | null = null): DesignBinding {
  const values = {...flowValues(id, reached, material, roster), ...thoughtValues(thought?.state ?? null)}
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
    // The view the Flow opens in: its file's meta.view, written on its revision.
    view: async value => {
      if (!writers?.meta) throw new Error('The Flow\'s file is not reached here: open it from the browser, and its view is written on its file.')
      if (reached.dirty) throw new Error(DIRTY)
      await writers.meta({view: String(value ?? '')})
    },
    // The Thought page (pageGround.ts): each a press, never by itself.
    preflightRead: async () => {
      if (!thought?.hand) throw new Error(NO_THOUGHT_HAND)
      await thought.hand.preflight()
    },
    contemplate: async () => {
      const pre = thought?.state.preflight
      if (!thought?.hand) throw new Error(NO_THOUGHT_HAND)
      if (pre?.status !== 'answered' || !pre.value || typeof pre.value !== 'object') throw new Error(pre?.status === 'refused' ? pre.error : 'Read the preflight first: Contemplate runs only on the record it gives.')
      await thought.hand.contemplate(pre.value as Record<string, unknown>)
    },
    sinceRead: async () => {
      const run = thought?.state.thought
      if (!thought?.hand) throw new Error(NO_THOUGHT_HAND)
      const data = run?.status === 'answered' && run.value && typeof run.value === 'object' ? run.value as Record<string, unknown> : null
      // Without a run here, the Flow's last kept thought is the one changes are read since (its record, as AIKit kept it).
      const kept = !run && thought.state.kept?.status === 'answered' ? lastKeptThought(thought.state.kept.value) : undefined
      if (kept) { await thought.hand.since(kept.thought); return }
      if (!data || data.state !== 'cognition') throw new Error(kept === null ? 'There is no thought to read from: AIKit keeps no thought for this Flow (it keeps one only when a host executor runs a contemplation), and none ran here.'
        : 'There is no thought to read from: Contemplate has not run here, or it did not think.')
      await thought.hand.since(data)
    },
  }
  const why: Record<string, string> = {}
  if (!thought?.hand) for (const key of ['preflightRead', 'contemplate', 'sinceRead']) why[key] = NO_THOUGHT_HAND
  if (!writers?.meta) why.view = 'The Flow\'s file is not reached here: open it from the browser, and its view is written on its file.'
  if (!reached.save) why.save = NO_ACT('Flow')
  if (!reached.reread) why.reread = NO_ACT('Flow')
  const standing: Record<string, Standing> = {}
  for (const key of Object.keys(values)) if (key.startsWith('left:')) standing[key] = {disabled: FLOW_WIRING.refused['left:<initial>']!}
  // The kept thoughts refused (an AIKit that keeps none, or cannot read them): its words, until a run here stands.
  if (!('thought' in values) && thought?.state.kept?.status === 'refused') standing.thought = {disabled: thought.state.kept.error}
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
  for (const [key, from] of [['world', bindings.worldRef], ['subject', bindings.subjectRef], ['expression', bindings.expressionRef], ['place', bindings.placeRef]] as const) {
    if (from === null) values[key] = ''
    else if (typeof from === 'string') values[key] = from
  }
  if (bindings.kind === 'person' || bindings.kind === 'agent') values.kind = bindings.kind
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

/** A Being or Thing page read with its revision, and its owner's write on that revision: the page op's `mutate_field` (personal/pageOwner.ts
 * writePageField(transport, location, revision, field, value)), resolving once the owner answered, throwing its words. `worlds` are the
 * worlds Central discloses (centralWorlds.ts readWorlds), as {value: the world ref, label}, where handed in. */
export interface PageHand {
  readonly write: (field: PageField, value: unknown) => Promise<void>
  readonly worlds?: readonly {readonly value: string; readonly label: string}[]
}

const OFFICE_KEYS = ['o1', 'o2', 'o3', 'o4'] as const

/** The ties' writes, each through the page owner: a ref (empty is none), a kind, the offices that stay on with one turned, a layout, a
 * tone, the sources without one. */
function tieActs(doc: unknown, kind: boolean, hand: PageHand): PageActs {
  const page = recordOf(doc), bindings = recordOf(page?.bindings) ?? {}
  const ref = (value: Value) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  const offices = (key: string, on: boolean) => {
    const held = Array.isArray(bindings.categories) ? bindings.categories.filter((c): c is string => typeof c === 'string') : []
    const next = OFFICE_KEYS.map((_, i) => `C${i + 1}`).filter((office, i) => (OFFICE_KEYS[i] === key ? on : held.includes(office)))
    if (!next.length) throw new Error('A page takes up one or more of the offices C1 to C4: the last one stays.')
    return hand.write('office', next)
  }
  return {
    world: async value => hand.write('world', ref(value)),
    subject: async value => hand.write('subject', ref(value)),
    ...(kind ? {kind: async (value: Value) => hand.write('kind', value)} : {}),
    ...Object.fromEntries(OFFICE_KEYS.map(key => [key, async (value: Value) => offices(key, value === true)])),
    expression: async value => hand.write('expression', ref(value)),
    place: async value => hand.write('place', ref(value)),
    layout: async value => hand.write('layout', value),
    ground: async value => hand.write('tone', value),
    dropSource: async value => {
      const sources = (Array.isArray(bindings.sources) ? bindings.sources : []).map(recordOf).filter((source): source is Record<string, unknown> => source !== null)
      if (!sources.some(source => source.ref === value)) throw new Error(`${String(value)} is no source of this page.`)
      return hand.write('sources', sources.filter(source => source.ref !== value).map(source => ({ref: source.ref, revision: source.revision})))
    },
  }
}

/** A Being's or Thing's binding: its readings; with a page hand, its ties written through the page owner on the revision read. */
function tiesBinding(id: string, doc: unknown, kind: boolean, hand?: PageHand | null): DesignBinding {
  const values: Record<string, Value> = {...pageValues(doc)}
  const page = recordOf(doc)?.profile === 'oi.page/v1'
  if (hand?.worlds) values.worlds = JSON.stringify(hand.worlds)
  if (!hand || !page) return pageBinding(id, kind ? BEINGS_WIRING : THINGS_WIRING, values, {})
  return pageBinding(id, kind ? BEINGS_READ_WIRING : THINGS_READ_WIRING, values, tieActs(doc, kind, hand))
}
export const beingsBinding = (id: string, doc: unknown, hand?: PageHand | null): DesignBinding => tiesBinding(id, doc, true, hand)
export const thingsBinding = (id: string, doc: unknown, hand?: PageHand | null): DesignBinding => tiesBinding(id, doc, false, hand)

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
/** The world a world's head opened the Workspace on (§18.1 "the track's Workspace device"): its name and project as Central discloses them. */
export interface TrackWorld {
  readonly name: string
  /** The project it is, or null for your world. */
  readonly project: string | null
}

export function workspaceValues(id: string, workspace: BookWorkspace | null, now: number, world: TrackWorld | null = null, folders: readonly string[] | null = null): Values {
  const values: Record<string, Value> = {}
  if (folders) values.folders = JSON.stringify(folders)
  if (world) { values.name = world.name; values.folder = world.project ?? 'central' }
  if (!workspace) return withHeld(id, WORKSPACE_WIRING, values, {})
  values.light = 'lit'
  if (!world) { values.name = workspace.name; values.folder = workspace.project ?? 'central' }
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
/** A world's name is its register's: Central names it in its disclosure, and no owner operation renames a world from here. */
export const WORLD_NAME_REFUSED = 'Name: a world\'s name is its register\'s, as Central discloses it (world browse); no owner operation renames a world from here — missing op: a world rename in Central.'

export function workspaceBinding(id: string, workspace: BookWorkspace | null, now: number, book: BookActs | null, ground: WorkspaceGround | null = null,
  world: TrackWorld | null = null, folders: readonly string[] | null = null): DesignBinding {
  const NO_BOOK = 'No workspace book is mounted here.'
  const acts: Record<string, (value: Value) => Promise<void>> = {
    mode: async value => {
      if (!book) throw new Error(NO_BOOK)
      if (typeof value !== 'string' || !(WORKSPACE_MODES as readonly string[]).includes(value)) throw new Error(`${String(value)} is none of the five modes.`)
      book.switchMode(value)
    },
    name: async value => {
      if (world) throw new Error(WORLD_NAME_REFUSED)
      if (!book) throw new Error(NO_BOOK)
      if (typeof value !== 'string' || !value.trim()) throw new Error('A workspace keeps a name: write one.')
      book.rename(value.trim())
    },
  }
  // The Ground page's Preview (pageGround.ts): the treatment and the wiki the hand holds, else what the inspection points to.
  const held = heldOf(id)
  const pc = ground?.pc?.status === 'answered' ? ground.pc.value as {outcome?: unknown; wiki_candidates?: unknown} | null : null
  const candidates = Array.isArray(pc?.wiki_candidates) ? pc!.wiki_candidates.flatMap(row => (row && typeof (row as {source?: unknown}).source === 'string' ? [(row as {source: string}).source] : [])) : []
  acts.pcPreview = async value => {
    const asked = typeof value === 'string' && value.startsWith('{') ? (() => { try { return JSON.parse(value) as {treatment?: unknown; source?: unknown} } catch { return {} } })() : {}
    const treatment = asked.treatment ?? held.treatment ?? (pc?.outcome === 'create_project_central' ? 'create' : candidates.length ? 'adopt' : undefined)
    const source = typeof asked.source === 'string' ? asked.source : typeof held.pcSource === 'string' ? held.pcSource : candidates.length === 1 ? candidates[0] : undefined
    if (!ground?.preview || !ground.project) throw new Error(WORKSPACE_WIRING.refused.pcPreview!)
    if (treatment === 'create') throw new Error('Preview: Central has no preview of projectcentral.init; the inspection\'s outcome is its plan.')
    if (treatment !== 'adopt' && treatment !== 'migrate') throw new Error('Preview: choose how Central makes the ground (create, adopt or migrate) first.')
    if (!source) throw new Error('Preview: choose the wiki to keep or copy first.')
    await ground.preview(treatment, source)
  }
  // The person's Accept, Ensure and Relate (action.rs PERSON_ACTS): what the design sends, to the world's own ground.
  const noHand = (act: string): string => (ground?.project ? `${act}: no transport reaches Central here.` : `${act}: ${NO_WORLD_GROUND}`)
  acts.pcAccept = async value => {
    const asked = typeof value === 'string' && value.startsWith('{') ? (() => { try { return JSON.parse(value) as {treatment?: unknown; source?: unknown} } catch { return {} } })() : {}
    if (!ground?.accept) throw new Error(noHand('Accept'))
    const treatment = asked.treatment
    if (treatment !== 'create' && treatment !== 'adopt' && treatment !== 'migrate') throw new Error('Accept: choose how Central makes the ground (create, adopt or migrate) first.')
    const source = typeof asked.source === 'string' && asked.source ? asked.source : null
    if (treatment !== 'create' && !source) throw new Error('Accept: choose the wiki to keep or copy first.')
    await ground.accept(treatment, source)
  }
  acts.selfEnsure = async () => {
    if (!ground?.ensure) throw new Error(noHand('Ensure'))
    await ground.ensure()
  }
  acts.selfRelate = async value => {
    const asked = typeof value === 'string' && value.startsWith('{') ? (() => { try { return JSON.parse(value) as {as?: unknown; source?: unknown} } catch { return {} } })() : {}
    if (!ground?.relate) throw new Error(noHand('Relate'))
    if (asked.as === 'ux' || asked.as === 'ex') throw new Error(RELATE_UX_EX_REFUSED)
    const tier = typeof asked.as === 'string' && /^[0-5]$/.test(asked.as) ? Number(asked.as) : null
    if (tier === null) throw new Error('Relate: choose the tier (0 to 5) the source is bound as first.')
    if (typeof asked.source !== 'string' || !asked.source) throw new Error('Relate: choose a source first.')
    await ground.relate(tier, asked.source)
  }
  const why: Record<string, string> = book ? {} : {mode: NO_BOOK, name: NO_BOOK}
  if (world) why.name = WORLD_NAME_REFUSED
  if (!ground?.preview || !ground.project) why.pcPreview = WORKSPACE_WIRING.refused.pcPreview!
  if (!ground?.accept) why.pcAccept = noHand('Accept')
  if (!ground?.ensure) why.selfEnsure = noHand('Ensure')
  if (!ground?.relate) why.selfRelate = noHand('Relate')
  else if (held.bindAs === 'ux' || held.bindAs === 'ex') why.selfRelate = RELATE_UX_EX_REFUSED
  const wiring = {...WORKSPACE_WIRING, refused: Object.fromEntries(Object.entries(WORKSPACE_WIRING.refused).filter(([key]) => key !== 'pcPreview'))}
  return pageBinding(id, wiring, {...workspaceValues(id, workspace, now, world, folders), ...groundValues(ground)}, acts, why)
}
