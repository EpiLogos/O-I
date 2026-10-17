// Ground hygiene (DLW §18.5) and Impact (§18.13) on Central's readings (lane BC2): the catalogue's designs
// (inhabitants/catalogue/panels/central__ground-hygiene.tsx, central__impact.tsx) bound over the census and the neighbourhood their
// owners give, classified by the shell's own models (inhabitants/centralHygieneModel.ts, centralImpactModel.ts — the device draws
// what the model reports and classifies nothing itself). Pure: no React, no transport. The readers are groundDevices.ts.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import {HYGIENE_TENDERS, type HygieneCensus, type HygieneFinding} from '../../inhabitants/centralHygieneModel'
import type {ImpactReading} from '../../inhabitants/centralImpactModel'
import {pageBinding, heldOf, type DesignWiring, type PageActs} from './pageBindings'

export const HYGIENE_DESIGN = 'central:ground-hygiene'
export const IMPACT_DESIGN = 'central:impact'

const tender = (id: string): string => {
  const t = HYGIENE_TENDERS.find(candidate => candidate.id === id)
  return t ? `${t.label} has no writer yet: ${t.waitsFor} (${t.ownerOperation}).` : 'No tender has a writer yet.'
}
const NO_TENDER = 'No tender has a writer yet (centralHygieneModel.ts HYGIENE_TENDERS: release waits for the seat instrument, prune and sweep for a commissioned repair), so the device only reads: Tend stands Off.'

export const HYGIENE_WIRING: DesignWiring = {
  design: HYGIENE_DESIGN,
  keys: ['light', 'machine', 'machineRef', 'look:seats', 'look:worktrees', 'look:branches', 'faults', 'refresh', 'tend', 'allow:release', 'allow:prune', 'allow:sweep',
    'readAge', 'machines', 'disk', 'seats', 'worktrees', 'branches', 'sources', 'findings', 'reread', 'release', 'prune', 'sweep', 'sel', 'ask',
    'page:seats', 'page:worktrees', 'page:branches', 'receipt', 'receipts'],
  reads: {
    light: 'the census stands: lit when an owner answered, dark when every source refused',
    machineRef: 'Workcell\'s own workcell_ref (op workcell_status_read; centralHygieneModel.ts workcellRefOf)',
    machines: 'the machine the readings stand on', readAge: 'seconds since the census was read',
    tend: 'Off — no tender has a writer yet (HYGIENE_TENDERS)', refresh: 'On open — the device reads when it opens, and when you press Read now',
    seats: 'the seat instrument\'s rows (seat status --json, else its text), where a host supplies that read',
    worktrees: 'git worktree list --porcelain, where a host supplies that read', branches: 'git for-each-ref, where a host supplies that read',
    sources: 'each read with its operation, and the owner\'s refusal in its own words', findings: 'the model\'s classification (hygieneFindings)',
  },
  writes: {reread: 'the census read again (op workcell_status_read, op git_repository_read, and the host\'s machine reads)'},
  local: {
    machine: 'the machine chosen (this machine; Link lists no other here)', 'look:seats': 'which rings the device draws', 'look:worktrees': 'which rings the device draws',
    'look:branches': 'which rings the device draws', faults: 'Faults only, or every finding', sel: 'the open finding', ask: 'a tender waiting for Confirm',
    'page:seats': 'the list\'s page', 'page:worktrees': 'the list\'s page', 'page:branches': 'the list\'s page',
  },
  refused: {
    tend: NO_TENDER, refresh: 'No timer reads the ground (13 Oct: no scheduled automation without the owner\'s validation): the device reads when it opens and when you press Read now.',
    'allow:release': tender('release-seat'), 'allow:prune': tender('prune-worktree'), 'allow:sweep': tender('sweep-branch'),
    release: tender('release-seat'), prune: tender('prune-worktree'), sweep: tender('sweep-branch'),
  },
  absent: {
    'allow:release': tender('release-seat'), 'allow:prune': tender('prune-worktree'), 'allow:sweep': tender('sweep-branch'),
    disk: 'No reading of each workcell\'s free disk reaches the shell (the seat instrument\'s JSON carries it; no host read supplies it here).',
    receipt: 'No tender has run, so no receipt stands.', receipts: 'No tender has run, so no receipt stands.',
  },
}

export const IMPACT_WIRING: DesignWiring = {
  design: IMPACT_DESIGN,
  keys: ['light', 'pin', 'depth', 'relation', 'show:references', 'show:links', 'show:sessions', 'closed', 'subject', 'nodes', 'edges', 'references', 'sessions', 'refusal:graph'],
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
  refused: {},
  absent: {},
}

/** Which of the census's rings a source was read for (the design's own RING_OP). */
const RING_OP: Readonly<Record<'seats' | 'worktrees' | 'branches', RegExp>> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/}

export interface HygieneRead {
  readonly census: HygieneCensus
  readonly findings: readonly HygieneFinding[]
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
    values.sources = JSON.stringify(census.sources)
    values.findings = JSON.stringify(read.findings)
    const ringRead = (ring: keyof typeof RING_OP) => answered.some(source => RING_OP[ring].test(source.boundaryOp))
    if (ringRead('seats')) values.seats = JSON.stringify(census.seats)
    if (ringRead('worktrees')) values.worktrees = JSON.stringify(census.worktrees)
    if (ringRead('branches')) values.branches = JSON.stringify(census.branches)
  }
  const held = heldOf(id)
  const defaults: Record<string, Value> = {machine: 'this', 'look:seats': true, 'look:worktrees': true, 'look:branches': true, faults: true}
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
