// Ground hygiene (DLW §18.5) and Impact (§18.13) on Central's readings (lane BC2): the catalogue's designs
// (inhabitants/catalogue/panels/central__ground-hygiene.tsx, central__impact.tsx) bound over the census and the neighbourhood their
// owners give, classified by the shell's own models (inhabitants/centralHygieneModel.ts, centralImpactModel.ts — the device draws
// what the model reports and classifies nothing itself). Pure: no React, no transport. The readers are groundDevices.ts.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import {HYGIENE_TENDERS, type AuthoredReading, type BoundaryOpSource, type HygieneCensus, type HygieneFinding, type MaterialWorld, type RootReading, type SandboxReading,
  type ScaffoldReading} from '../../inhabitants/centralHygieneModel'
import type {ImpactReading} from '../../inhabitants/centralImpactModel'
import {pageBinding, heldOf, type DesignWiring, type PageActs} from './pageBindings'

export const HYGIENE_DESIGN = 'central:ground-hygiene'
export const IMPACT_DESIGN = 'central:impact'

const tender = (id: string): string => {
  const t = HYGIENE_TENDERS.find(candidate => candidate.id === id)
  return t ? `${t.label}: no writer reaches it from here — it waits on ${t.waitsFor} (${t.ownerOperation}).` : 'No tender has a writer yet.'
}
const NO_TENDER = 'No tender has a writer that reaches it from here (centralHygieneModel.ts HYGIENE_TENDERS: release waits for the seat instrument, prune and sweep for a commissioned repair, Initialise root, Reproject and Recognise for the person\'s route, Reconcile and Release orphans for a kernel route to Workcell), so the device only reads: Tend stands Off.'

/** The tender each act key runs, and its Allow setting (the design's TENDERS; the model's HYGIENE_TENDERS ids). */
export const HYGIENE_TENDER_KEYS: Readonly<Record<string, string>> = {release: 'release-seat', prune: 'prune-worktree', sweep: 'sweep-branch', init: 'init-root',
  reproject: 'reproject-scaffold', recognise: 'recognise-source', reconcile: 'reconcile-binding', orphans: 'release-orphans'}
/** The nine rings of the three pages (§18.5 "What it reads"). */
export const HYGIENE_RINGS = ['seats', 'worktrees', 'branches', 'root', 'scaffold', 'authored', 'worlds', 'bindings', 'sandboxes'] as const
const NO_SANDBOXES = 'The sandboxes are Workcell\'s `workcell sandboxes reconcile --server <url> --json`, which no kernel route reaches yet (T-COVERAGE §1.2).'
const TENDER_KEYS = Object.keys(HYGIENE_TENDER_KEYS)

export const HYGIENE_WIRING: DesignWiring = {
  design: HYGIENE_DESIGN,
  keys: ['light', 'machine', 'machineRef', ...HYGIENE_RINGS.map(ring => `look:${ring}`), 'faults', 'refresh', 'tend', ...TENDER_KEYS.map(key => `allow:${key}`),
    'as:provenance', 'as:standing', 'readAge', 'machines', 'disk', 'seats', 'worktrees', 'branches', 'root', 'scaffold', 'authored', 'worlds', 'sandboxes', 'sources',
    'findings', 'reread', ...TENDER_KEYS, 'sel', 'ask', ...HYGIENE_RINGS.map(ring => `page:${ring}`), 'receipt', 'receipts'],
  reads: {
    light: 'the census stands: lit when an owner answered, dark when every source refused',
    machineRef: 'Workcell\'s own workcell_ref (op workcell_status_read; centralHygieneModel.ts workcellRefOf)',
    machines: 'the machine the readings stand on', readAge: 'seconds since the census was read',
    tend: 'Off — no tender has a writer that reaches it from here (HYGIENE_TENDERS)', refresh: 'On open — the device reads when it opens, and when you press Read now',
    seats: 'the seat instrument\'s rows (seat status --json, through the kernel\'s seat_status_read: groundDevices.ts hygieneMachineRead)',
    worktrees: 'Central\'s git census of the project (central.git.census through invoke_action: groundDevices.ts censusLines)',
    branches: 'Central\'s git census of the project (central.git.census through invoke_action)',
    root: 'Central\'s root as central.doctor reads it (invoke_action; centralHygieneModel.ts rootOfDoctor)',
    scaffold: 'the world\'s scaffold as central.world.reproject.plan {project} reads it (invoke_action; scaffoldOfPlan)',
    authored: 'the world\'s authored ground as projectcentral.ground.inspect {project} reads it (invoke_action; authoredOfInspection)',
    worlds: 'Workcell\'s prepared worlds: none while `workcell status` keeps no world receipt (op workcell_status_read persisted_world_receipts)',
    sources: 'each read with its operation, and the owner\'s refusal in its own words',
    findings: 'the model\'s classification: hygieneFindings over the census, groundFindings and materialFindings over the pages\' readings',
  },
  writes: {reread: 'the census and the pages read again (op workcell_status_read, seat_status_read, and Central\'s readings through invoke_action)'},
  local: {
    machine: 'the machine chosen (this machine; Link lists no other here)', faults: 'Faults only, or every finding', sel: 'the open finding', ask: 'a tender waiting for Confirm',
    ...Object.fromEntries(HYGIENE_RINGS.flatMap(ring => [[`look:${ring}`, 'which rings the device draws'], [`page:${ring}`, 'the list\'s page']])),
    'as:provenance': 'who made a document you would recognise (Human-authored by default, §18.5): held for Recognise',
    'as:standing': 'what a document you would recognise stands as (Design commitment by default, §18.5): held for Recognise',
  },
  refused: {
    tend: NO_TENDER, refresh: 'No timer reads the ground (13 Oct: no scheduled automation without the owner\'s validation): the device reads when it opens and when you press Read now.',
    ...Object.fromEntries(TENDER_KEYS.flatMap(key => [[`allow:${key}`, tender(HYGIENE_TENDER_KEYS[key]!)], [key, tender(HYGIENE_TENDER_KEYS[key]!)]])),
  },
  absent: {
    ...Object.fromEntries(TENDER_KEYS.map(key => [`allow:${key}`, tender(HYGIENE_TENDER_KEYS[key]!)])),
    disk: 'No reading of each workcell\'s free disk reaches the shell (the seat instrument\'s JSON carries it; no host read supplies it here).',
    sandboxes: NO_SANDBOXES,
    receipt: 'No tender has run, so no receipt stands.', receipts: 'No tender has run, so no receipt stands.',
  },
}

export const IMPACT_WIRING: DesignWiring = {
  design: IMPACT_DESIGN,
  keys: ['light', 'pin', 'depth', 'relation', 'show:references', 'show:links', 'show:sessions', 'closed', 'subject', 'nodes', 'edges', 'references', 'sessions', 'refusal:graph',
    'meaning', 'meaningRead'],
  reads: {
    light: 'the neighbourhood stands: lit when a leg answered, dark when every leg refused', subject: 'the browser\'s selected folder, note or Day (or the pinned one)',
    nodes: 'the graph owner\'s one-hop cut of the subject (op graph; centralImpactModel.ts projectNeighbourhood)', edges: 'the same cut\'s edges, direct and indirect',
    references: 'a folder\'s own listing (op files_list)', sessions: 'the NOW records whose work refs name the subject\'s project or one of its seats (op now kind:list; projectSessions)',
    'refusal:graph': 'the graph owner\'s refusal, in its own words',
  },
  writes: {},
  local: {
    pin: 'Pin keeps the subject while you select elsewhere (the device holds it)', depth: 'how far the device walks the reading\'s links (2 by default, DLW §18.6)',
    relation: 'which kind of link the device lists', 'show:references': 'which lists the device draws', 'show:links': 'which lists the device draws',
    'show:sessions': 'which lists the device draws', closed: 'whether closed sessions are listed (Open only by default)',
  },
  // The Meaning page (D-package; manual §18.6): AIKit's project reflection, read by `aikit knowledge frame <subject>`, has no kernel op.
  refused: {meaningRead: 'Read now (Meaning): missing op — `aikit knowledge frame <subject>` (aikit.project-reflection/v1) has no kernel route; the kernel\'s knowledge requests are status, search, resolve, read, relations, explain, history and use (T-COVERAGE §1.2).'},
  absent: {meaning: 'Meaning: missing op — AIKit\'s project reflection (`aikit knowledge frame <subject>`, aikit.project-reflection/v1) has no kernel route yet (T-COVERAGE §1.2); nothing reads whether the code still says what the product means.'},
}

/** Which of the census's rings a source was read for (the design's own RING_OP). */
const RING_OP: Readonly<Record<'seats' | 'worktrees' | 'branches', RegExp>> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/}

/** The Ground and Material pages' readings, as groundDevices.ts readHygienePages reads them: each reading the owner answered (absent
 * where it refused, or where no route reaches it), the sources with their refusals, and the model's findings over them. */
export interface HygienePages {
  readonly root?: RootReading
  readonly scaffold?: ScaffoldReading
  readonly authored?: AuthoredReading
  readonly worlds?: readonly MaterialWorld[]
  readonly sandboxes?: SandboxReading
  readonly sources: readonly BoundaryOpSource[]
  readonly findings: readonly HygieneFinding[]
}

export interface HygieneRead {
  readonly census: HygieneCensus
  readonly findings: readonly HygieneFinding[]
  /** The Ground and Material pages' readings, where they were read. */
  readonly pages?: HygienePages
  /** When it was read (ms since the epoch). */
  readonly at: number
}

/** Ground hygiene's readings (HYGIENE_WIRING). Null census: not read yet — every reading absent. */
export function hygieneValues(id: string, read: HygieneRead | null, now: number): Values {
  const values: Record<string, Value> = {}
  if (read) {
    const {census} = read
    const answered = census.sources.filter(source => !source.refusal)
    values.light = answered.length ? 'lit' : 'dark'
    if (census.machineRef) {
      values.machineRef = census.machineRef
      values.machines = JSON.stringify([{id: 'this', label: 'This machine', ref: census.machineRef}])
    }
    values.tend = 'off'
    values.refresh = 'open'
    values.readAge = Math.max(0, Math.round((now - read.at) / 1000))
    values.sources = JSON.stringify([...census.sources, ...(read.pages?.sources ?? [])])
    values.findings = JSON.stringify([...read.findings, ...(read.pages?.findings ?? [])])
    // The Ground and Material pages: each reading its owner answered.
    for (const key of ['root', 'scaffold', 'authored', 'worlds', 'sandboxes'] as const) if (read.pages?.[key] !== undefined) values[key] = JSON.stringify(read.pages[key])
    const ringRead = (ring: keyof typeof RING_OP) => answered.some(source => RING_OP[ring].test(source.boundaryOp))
    if (ringRead('seats')) values.seats = JSON.stringify(census.seats)
    if (ringRead('worktrees')) values.worktrees = JSON.stringify(census.worktrees)
    if (ringRead('branches')) values.branches = JSON.stringify(census.branches)
  }
  const held = heldOf(id)
  // The view's holds start where the manual sets them (§18.5: Look at All On; Provenance Human-authored; Standing Design commitment).
  const defaults: Record<string, Value> = {machine: 'this', faults: true, ...Object.fromEntries(HYGIENE_RINGS.map(ring => [`look:${ring}`, true])),
    'as:provenance': 'human-authored', 'as:standing': 'design-commitment'}
  for (const key of Object.keys(HYGIENE_WIRING.local)) { const value = held[key] ?? defaults[key]; if (value !== undefined) values[key] = value }
  return values
}

/** Ground hygiene's binding: the census, Read now through the owners again, every tender disabled with the model's reason. */
export function hygieneBinding(id: string, read: HygieneRead | null, now: number, reread: (() => Promise<void>) | null): DesignBinding {
  const acts: PageActs = {reread: async () => { if (!reread) throw new Error('No transport reaches the owners here.'); await reread() }}
  return pageBinding(id, HYGIENE_WIRING, hygieneValues(id, read, now), acts, reread ? {} : {reread: 'No transport reaches the owners here.'})
}

/** Impact's readings (IMPACT_WIRING) from the owners' legs, as centralImpactModel.ts assembles them. */
export function impactValues(id: string, reading: ImpactReading | null): Values {
  const values: Record<string, Value> = {}
  if (reading) {
    const {subject} = reading
    values.subject = JSON.stringify({kind: subject.kind, path: subject.path, ref: subject.ref ?? null})
    const leg = (name: string) => reading.legs.find(candidate => candidate.name === name)
    const answered = reading.legs.filter(candidate => !candidate.refusal)
    values.light = answered.length ? 'lit' : 'dark'
    const graph = leg('neighbourhood')
    if (graph?.refusal) values['refusal:graph'] = graph.refusal
    else if (graph) { values.nodes = JSON.stringify(reading.nodes); values.edges = JSON.stringify(reading.edges) }
    const files = leg('references')
    if (files && !files.refusal) values.references = JSON.stringify(reading.references)
    const now = leg('sessions')
    if (now && !now.refusal) values.sessions = JSON.stringify(reading.sessions)
  }
  const held = heldOf(id)
  const defaults: Record<string, Value> = {pin: false, depth: 2, relation: 'all', 'show:references': true, 'show:links': true, 'show:sessions': true, closed: false}
  for (const key of Object.keys(IMPACT_WIRING.local)) { const value = held[key] ?? defaults[key]; if (value !== undefined) values[key] = value }
  return values
}

/** Impact's binding: it reads, and changes nothing (DLW §18.6 "Impact reads. It changes nothing"). */
export const impactBinding = (id: string, reading: ImpactReading | null): DesignBinding => pageBinding(id, IMPACT_WIRING, impactValues(id, reading), {})
