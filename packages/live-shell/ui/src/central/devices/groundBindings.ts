// Ground hygiene (DLW §18.5) and Impact (§18.13) on Central's readings (lane BC2): the catalogue's designs
// (inhabitants/catalogue/panels/central__ground-hygiene.tsx, central__impact.tsx) bound over the census and the neighbourhood their
// owners give, classified by the shell's own models (inhabitants/centralHygieneModel.ts, centralImpactModel.ts — the device draws
// what the model reports and classifies nothing itself). The tenders with an owner route write through it, each the person's press on a
// finding (lane K0, HYGIENE_WRITERS): Initialise root, Reproject and Recognise through Central's invoke_action, which carries the person's
// authority for them (action.rs PERSON_ACTS), and Reconcile through Workcell's reconcile on the world's receipt; so Tending is the hand's
// setting. The Material page's sandboxes are Workcell's report of a named server (workcell_read sandboxes) and Release orphans writes
// through workcell_write release-orphans; no server is named yet, so both stand refused saying so (NO_SANDBOX_SERVER). Release seat, Prune
// and Sweep have no writer here. Pure: no React, no transport. The readers are groundDevices.ts.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import {HYGIENE_TENDERS, type AuthoredReading, type BoundaryOpSource, type HygieneCensus, type HygieneFinding, type MaterialWorld, type RootReading, type SandboxReading,
  type ScaffoldReading} from '../../inhabitants/centralHygieneModel'
import type {ImpactReading} from '../../inhabitants/centralImpactModel'
import {pageBinding, heldOf, type DesignWiring} from './pageBindings'
import type {WorkcellWriteRequest} from '../../../../../../desktop/cradle/src/kernel/types'

export const HYGIENE_DESIGN = 'central:ground-hygiene'
export const IMPACT_DESIGN = 'central:impact'

const tender = (id: string): string => {
  const t = HYGIENE_TENDERS.find(candidate => candidate.id === id)
  return t ? `${t.label}: no writer reaches it from here — it waits on ${t.waitsFor} (${t.ownerOperation}).` : 'No tender has a writer yet.'
}

/** The tender each act key runs, and its Allow setting (the design's TENDERS; the model's HYGIENE_TENDERS ids). */
export const HYGIENE_TENDER_KEYS: Readonly<Record<string, string>> = {release: 'release-seat', prune: 'prune-worktree', sweep: 'sweep-branch', init: 'init-root',
  reproject: 'reproject-scaffold', recognise: 'recognise-source', reconcile: 'reconcile-binding', orphans: 'release-orphans'}
/** The tenders that write through their owner here (lane K0), each the person's press, and the operation it goes through: Central's three
 * through invoke_action, which carries the person's authority for them (desktop/cradle/kernel/src/action.rs PERSON_ACTS names central.init,
 * central.world.reproject.apply and projectcentral.ground.apply), and Workcell's reconcile on the world's receipt (workcell_write, routed since
 * a4c97faa9). Release orphans writes too once a sandbox server is named (HYGIENE_ORPHANS_WIRING). */
export const HYGIENE_WRITERS: Readonly<Record<string, string>> = {
  init: 'central.init through invoke_action, the person\'s press (action.rs PERSON_ACTS): Central creates the root\'s missing parts and keeps what is there',
  reproject: 'central.world.reproject.apply {project} through invoke_action, the person\'s press (PERSON_ACTS): Central stamps only the missing scaffold',
  recognise: 'projectcentral.ground.apply {project, source, provenance, standing, treatment retain-native-in-place, acceptance human-accepted} through invoke_action, the person\'s press (PERSON_ACTS)',
  reconcile: 'workcell_write reconcile {receipt, desired [<binding>=present]} (`workcell --receipt R reconcile --desired`) on the world\'s receipt',
}
/** The tenders no writer reaches from here: the seat's release, a worktree's prune and a branch's sweep (a commissioned repair). */
const REFUSED_TENDERS = Object.keys(HYGIENE_TENDER_KEYS).filter(key => !(key in HYGIENE_WRITERS) && key !== 'orphans')
/** The nine rings of the three pages (§18.5 "What it reads"). */
export const HYGIENE_RINGS = ['seats', 'worktrees', 'branches', 'root', 'scaffold', 'authored', 'worlds', 'bindings', 'sandboxes'] as const
/** Why the sandboxes are not read: the kernel reads a server Workcell is pointed at (workcell_read sandboxes, lane K0), and none is named. */
export const NO_SANDBOX_SERVER = 'No sandbox server is named here: Workcell\'s `workcell sandboxes reconcile --server <url>` reads a server by its URL (the kernel\'s workcell_read sandboxes), and no Workcell reading names the URL of the sandbox deployment it declares.'
const NO_SANDBOXES = `The sandboxes: ${NO_SANDBOX_SERVER}`
const TENDER_KEYS = Object.keys(HYGIENE_TENDER_KEYS)
const NO_RECEIPT = 'The device keeps no tender\'s receipt: each tender\'s owner answers its press, and the pages are read again after it.'

export const HYGIENE_WIRING: DesignWiring = {
  design: HYGIENE_DESIGN,
  keys: ['light', 'machine', 'machineRef', ...HYGIENE_RINGS.map(ring => `look:${ring}`), 'faults', 'refresh', 'tend', ...TENDER_KEYS.map(key => `allow:${key}`),
    'as:provenance', 'as:standing', 'readAge', 'machines', 'disk', 'seats', 'worktrees', 'branches', 'root', 'scaffold', 'authored', 'worlds', 'sandboxes', 'sources',
    'findings', 'reread', ...TENDER_KEYS, 'sel', 'ask', ...HYGIENE_RINGS.map(ring => `page:${ring}`), 'receipt', 'receipts'],
  reads: {
    light: 'the census stands: lit when an owner answered, dark when every source refused',
    machineRef: 'Workcell\'s own workcell_ref (op workcell_status_read; centralHygieneModel.ts workcellRefOf)',
    machines: 'the machine the readings stand on', readAge: 'seconds since the census was read',
    refresh: 'On open — the device reads when it opens, and when you press Read now',
    seats: 'the seat instrument\'s rows (seat status --json, through the kernel\'s seat_status_read: groundDevices.ts hygieneMachineRead)',
    worktrees: 'Central\'s git census of the project (central.git.census through invoke_action: groundDevices.ts censusLines)',
    branches: 'Central\'s git census of the project (central.git.census through invoke_action)',
    root: 'Central\'s root as central.doctor reads it (invoke_action; centralHygieneModel.ts rootOfDoctor)',
    scaffold: 'the world\'s scaffold as central.world.reproject.plan {project} reads it (invoke_action; scaffoldOfPlan)',
    authored: 'the world\'s authored ground as projectcentral.ground.inspect {project} reads it (invoke_action; authoredOfInspection)',
    worlds: 'Workcell\'s prepared worlds of this machine\'s cell: `workcell worlds` (workcell_read worlds) lists their receipts, and each is read with the kernel\'s material_read for its bindings\' presence',
    sources: 'each read with its operation, and the owner\'s refusal in its own words',
    findings: 'the model\'s classification: hygieneFindings over the census, groundFindings and materialFindings over the pages\' readings',
  },
  writes: {reread: 'the census and the pages read again (op workcell_status_read, seat_status_read, workcell_read worlds, material_read, and Central\'s readings through invoke_action)',
    ...HYGIENE_WRITERS},
  local: {
    machine: 'the machine chosen (this machine; Link lists no other here)', faults: 'Faults only, or every finding', sel: 'the open finding', ask: 'a tender waiting for Confirm',
    tend: 'Tending (§18.5: Propose by default): the hand\'s own setting, Off, Propose or Write, over the tenders that have a writer',
    ...Object.fromEntries(Object.keys(HYGIENE_WRITERS).map(key => [`allow:${key}`, 'whether the device offers the tender (§18.5 Allowed tenders: On by default)'])),
    ...Object.fromEntries(HYGIENE_RINGS.flatMap(ring => [[`look:${ring}`, 'which rings the device draws'], [`page:${ring}`, 'the list\'s page']])),
    'as:provenance': 'who made a document you would recognise (Human-authored by default, §18.5): held for Recognise',
    'as:standing': 'what a document you would recognise stands as (Design commitment by default, §18.5): held for Recognise',
  },
  refused: {
    refresh: 'No timer reads the ground (13 Oct: no scheduled automation without the owner\'s validation): the device reads when it opens and when you press Read now.',
    ...Object.fromEntries([...REFUSED_TENDERS, 'orphans'].flatMap(key => [[`allow:${key}`, tender(HYGIENE_TENDER_KEYS[key]!)], [key, tender(HYGIENE_TENDER_KEYS[key]!)]])),
  },
  absent: {
    ...Object.fromEntries([...REFUSED_TENDERS, 'orphans'].map(key => [`allow:${key}`, tender(HYGIENE_TENDER_KEYS[key]!)])),
    disk: 'No reading of each workcell\'s free disk reaches the shell (the seat instrument\'s JSON carries it; no host read supplies it here).',
    sandboxes: NO_SANDBOXES,
    receipt: NO_RECEIPT, receipts: NO_RECEIPT,
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

/** A sandbox server named to Ground hygiene, and Workcell's release of its orphans (workcell_write release-orphans {server}, `workcell
 * sandboxes reconcile --server <url> --release-orphans`): Workcell's report, or its refusal thrown in its words. Nothing names one yet. */
export interface HygieneSandboxes {
  readonly server: string
  readonly release: (server: string) => Promise<unknown>
}

/** The owners' writes the tenders go through, each handed in by the reader (groundDevices.ts); a tender whose port is absent stands disabled
 * naming the carrier it lacks. */
export interface HygienePorts {
  /** One of the person's own Central acts through invoke_action (centralDeviceWrites.ts centralWrite): Central's answer, or its words. */
  readonly central?: (action: string, input: Readonly<Record<string, unknown>>) => Promise<unknown>
  /** Workcell's writes on a prepared world (workcell_write): its answer, or its words. */
  readonly workcell?: (request: WorkcellWriteRequest) => Promise<unknown>
  /** The project whose world the Ground page reads (groundDevices.ts CENSUS_PROJECT). */
  readonly project?: string
  /** A named sandbox server: Release orphans writes on it. */
  readonly sandboxes?: HygieneSandboxes | null
}

/** Ground hygiene with a sandbox server named: Release orphans has a writer too, and its Allow is the hand's setting (On by default). */
export const HYGIENE_ORPHANS_WIRING: DesignWiring = (() => {
  const omit = (table: Readonly<Record<string, string>>, keys: readonly string[]) => Object.fromEntries(Object.entries(table).filter(([key]) => !keys.includes(key)))
  return {
    ...HYGIENE_WIRING, refused: omit(HYGIENE_WIRING.refused, ['orphans', 'allow:orphans']), absent: omit(HYGIENE_WIRING.absent, ['allow:orphans']),
    writes: {...HYGIENE_WIRING.writes, orphans: 'workcell_write release-orphans {server}: `workcell sandboxes reconcile --server <url> --release-orphans` releases every sandbox whose lease ended, and never one without lease evidence'},
    local: {...HYGIENE_WIRING.local, 'allow:orphans': 'whether the device offers Release orphans (§18.5 Allowed tenders: On by default)'},
  }
})()

/** Ground hygiene's readings (HYGIENE_WIRING; HYGIENE_ORPHANS_WIRING when a sandbox server is named). Null census: not read yet — every
 * reading absent. */
export function hygieneValues(id: string, read: HygieneRead | null, now: number, orphans = false): Values {
  const values: Record<string, Value> = {}
  if (read) {
    const {census} = read
    const answered = census.sources.filter(source => !source.refusal)
    values.light = answered.length ? 'lit' : 'dark'
    if (census.machineRef) {
      values.machineRef = census.machineRef
      values.machines = JSON.stringify([{id: 'this', label: 'This machine', ref: census.machineRef}])
    }
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
  // The view's holds start where the manual sets them (§18.5: Look at All On; Tending Propose; Allowed tenders All On; Provenance
  // Human-authored; Standing Design commitment).
  const defaults: Record<string, Value> = {machine: 'this', faults: true, tend: 'propose', ...Object.fromEntries(HYGIENE_RINGS.map(ring => [`look:${ring}`, true])),
    ...Object.fromEntries([...Object.keys(HYGIENE_WRITERS), ...(orphans ? ['orphans'] : [])].map(key => [`allow:${key}`, true])),
    'as:provenance': 'human-authored', 'as:standing': 'design-commitment'}
  const wiring = orphans ? HYGIENE_ORPHANS_WIRING : HYGIENE_WIRING
  for (const key of Object.keys(wiring.local)) { const value = held[key] ?? defaults[key]; if (value !== undefined) values[key] = value }
  return values
}

/** Release orphans on the named server: the pressed sandbox must be an orphan in Workcell's last report, and stands released when Workcell's
 * report names it released; a failure for it is Workcell's words. Then the pages are read again. */
async function releaseOrphans(read: HygieneRead | null, sandboxes: HygieneSandboxes, value: Value, reread: (() => Promise<void>) | null): Promise<void> {
  const subject = typeof value === 'string' ? value : ''
  const box = read?.pages?.sandboxes?.sandboxes.find(row => row.id === subject)
  if (!box || box.lease !== 'expired-orphan') throw new Error(`Release orphans: ${subject || 'that sandbox'} is not an orphan in Workcell's last report of ${sandboxes.server}; read it again.`)
  const report = await sandboxes.release(sandboxes.server) as {released_sandboxes?: unknown; failures?: unknown} | null
  const failure = Array.isArray(report?.failures) ? (report!.failures as {target?: unknown; operation?: unknown; reason?: unknown}[]).find(row => row?.target === subject) : undefined
  if (failure) throw new Error(`Workcell could not release ${subject}: ${String(failure.reason ?? failure.operation ?? 'no reason given')}`)
  if (reread) await reread()
}

/** The finding a tender is pressed on: the pages' finding of that kind on that subject, or why there is none. */
function findingOf(read: HygieneRead | null, kind: string, subject: string, what: string): HygieneFinding {
  const found = read?.pages?.findings.find(row => row.kind === kind && row.subject === subject)
  if (!found) throw new Error(`${what}: ${subject || 'that'} is not among the findings the pages last read; read them again.`)
  return found
}

/** The tenders' writes through their owners (HYGIENE_WRITERS), each pressed on a finding of the pages' last reading, then the pages read
 * again. Every refusal is the owner's words. */
function tenderActs(read: HygieneRead | null, ports: HygienePorts, reread: (() => Promise<void>) | null): Record<string, (value: Value) => Promise<void>> {
  const again = async () => { if (reread) await reread() }
  const central = async (action: string, input: Readonly<Record<string, unknown>>) => {
    if (!ports.central) throw new Error('The kernel carrier is unavailable here, so Central cannot be asked.')
    await ports.central(action, input)
    await again()
  }
  const project = read?.pages?.scaffold?.project || ports.project
  return {
    init: async value => {
      findingOf(read, 'root-part-missing', typeof value === 'string' ? value : '', 'Initialise root')
      await central('central.init', {})
    },
    reproject: async value => {
      findingOf(read, 'scaffold-missing', typeof value === 'string' ? value : '', 'Reproject')
      if (!project) throw new Error('Reproject: no world is named whose scaffold the plan read.')
      await central('central.world.reproject.apply', {project})
    },
    recognise: async value => {
      let asked: {source?: unknown; provenance?: unknown; standing?: unknown}
      try { asked = JSON.parse(String(value)) as typeof asked } catch { throw new Error('Recognise: the press names no source, provenance and standing.') }
      const source = typeof asked.source === 'string' ? asked.source : ''
      findingOf(read, 'source-unrecognised', source, 'Recognise')
      if (typeof asked.provenance !== 'string' || typeof asked.standing !== 'string') throw new Error('Recognise: choose its provenance and standing first.')
      if (!ports.project) throw new Error('Recognise: no world is named whose authored ground the inspection read.')
      await central('projectcentral.ground.apply', {project: ports.project, source, provenance: asked.provenance, standing: asked.standing,
        treatment: 'retain-native-in-place', acceptance: 'human-accepted'})
    },
    reconcile: async value => {
      const subject = typeof value === 'string' ? value : ''
      findingOf(read, 'binding-drift', subject, 'Reconcile')
      const cut = subject.lastIndexOf('#'), worldRef = subject.slice(0, cut), binding = subject.slice(cut + 1)
      const world = read?.pages?.worlds?.find(row => row.ref === worldRef)
      if (!world?.receipt) throw new Error(`Reconcile: Workcell named no receipt for ${worldRef || 'that world'}, so it cannot be asked.`)
      if (!ports.workcell) throw new Error('The kernel carrier is unavailable here, so Workcell cannot be asked.')
      await ports.workcell({kind: 'reconcile', receipt: world.receipt, desired: [`${binding}=present`]})
      await again()
    },
  }
}

/** Ground hygiene's binding: the census, Read now through the owners again; Initialise root, Reproject and Recognise through Central and
 * Reconcile through Workcell, each the person's press on a finding; Release orphans through Workcell when a sandbox server is named; the
 * seat's release, a worktree's prune and a branch's sweep disabled with the model's reason. */
export function hygieneBinding(id: string, read: HygieneRead | null, now: number, reread: (() => Promise<void>) | null, ports: HygienePorts = {}): DesignBinding {
  const sandboxes = ports.sandboxes ?? null
  const acts: Record<string, (value: Value) => Promise<void>> = {reread: async () => { if (!reread) throw new Error('No transport reaches the owners here.'); await reread() },
    ...tenderActs(read, ports, reread)}
  if (sandboxes) acts.orphans = value => releaseOrphans(read, sandboxes, value, reread)
  const why: Record<string, string> = reread ? {} : {reread: 'No transport reaches the owners here.'}
  if (!ports.central) for (const key of ['init', 'reproject', 'recognise']) why[key] = 'The kernel carrier is unavailable here, so Central cannot be asked.'
  if (!ports.workcell) why.reconcile = 'The kernel carrier is unavailable here, so Workcell cannot be asked.'
  // No sandbox read answered from the server named: Release orphans has nothing to stand on, and says why.
  if (sandboxes && !read?.pages?.sandboxes) {
    why.orphans = read?.pages?.sources.find(source => /sandboxes/.test(source.boundaryOp))?.refusal ?? `Release orphans: Workcell has not reported ${sandboxes.server}'s sandboxes yet.`
  }
  return pageBinding(id, sandboxes ? HYGIENE_ORPHANS_WIRING : HYGIENE_WIRING, hygieneValues(id, read, now, !!sandboxes), acts, why)
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
