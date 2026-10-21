/** Central hygiene device — the ground as readings (WORLD-SHELL-DESIGN §12,
 * central family: "worktree census, branch audit, erroneous worktree and
 * stray-branch detection, seat occupancy — the field-health behaviours as
 * readings and tenders").
 *
 * Port law: every reading stands on a named owner operation — the kernel's
 * `workcell_status_read` / `git_repository_read` ops where the owner answers,
 * or a machine-level declared owner operation (the seat instrument's
 * `seat status`, read-only git state) supplied by the host at request time.
 * This module stores nothing and reads nothing: it CLASSIFIES what the
 * owners disclosed. A refused owner read is carried verbatim — the refusal
 * is the reading, never silently empty, never substituted.
 *
 * Aperture law: the tenders (release a seat, prune a worktree, sweep a
 * stray branch; initialise the root, reproject a scaffold, recognise a source;
 * reconcile a binding, release orphan sandboxes) are DECLARED controls naming
 * the owner operation that would execute them. No tender fires from a device: each renders as declared and
 * waiting for its writer, exactly as the L2 manifest note promised.
 *
 * Pure TypeScript. No React, no transport, no store. */

// ---------------------------------------------------------------------------
// readings — each one names the owner operation it stands on

/** One owner-read source, carried with its boundary operation. The
 * boundary_op is part of the reading: a reading that cannot name its owner
 * operation is not shown. */
export interface BoundaryOpSource {
  /** The exact owner operation, e.g. `op workcell_status_read`,
   * `seat status (Control/user/workcell/seat)`, `git worktree list --porcelain`. */
  readonly boundaryOp: string
  /** The route the read travelled: the kernel op seam or the machine instrument. */
  readonly channel: 'kernel-op' | 'machine-instrument'
  /** When the read executed (ISO string). */
  readonly at: string
  /** The owner's refusal, verbatim, when the read was refused. A refused
   * source discloses its refusal; it never fabricates data. */
  readonly refusal?: string
}

/** One seat as the register and the live ground hold it. */
export interface SeatReading {
  readonly workcell: string
  /** The workcell's checkout root, when the instrument disclosed it
   * (`/Users/admin/Central/worktrees/env-1`). */
  readonly workcellPath: string | null
  readonly product: string
  readonly state: 'free' | 'claimed' | 'occupied-foreign-lane' | 'unknown'
  readonly branch: string | null
  readonly head: string | null
  readonly claimedBy: string | null
  readonly dirty: number | null
  readonly untracked: number | null
  /** Commits on the seat's branch that the product's main does not hold (`ahead_main`; the text's `+N`), when disclosed. A seat
   * whose branch main does not hold is no landed seat, however clean its tree. */
  readonly ahead?: number | null
  /** Commits on main the seat's branch does not hold (`behind_main`; the text's `-N`), when disclosed. */
  readonly behind?: number | null
  /** Register-vs-live drift, in the instrument's own words (`seat status`). */
  readonly drift: string | null
  /** Disk admission standing, when the instrument disclosed one. */
  readonly admissionNote: string | null
}

/** One worktree row from the census (`git worktree list --porcelain`). */
export interface WorktreeRow {
  readonly path: string
  readonly head: string | null
  readonly branch: string | null
  readonly bare: boolean
  readonly detached: boolean
  /** The repository's main worktree: git lists it first (git-worktree(1) "list": "The main worktree is listed first"). It is the
   * product's primary checkout — a register seat by the register's own law (the primary stands on main), never a stray. */
  readonly main?: boolean
}

/** One branch row from the audit (`git for-each-ref refs/heads`). */
export interface BranchRow {
  readonly name: string
  readonly head: string | null
  /** The worktree currently holding the branch, when one does. */
  readonly checkedOutAt: string | null
}

/** The census: every row keeps the source it was read from. */
export interface HygieneCensus {
  readonly sources: readonly BoundaryOpSource[]
  readonly worktrees: readonly WorktreeRow[]
  readonly branches: readonly BranchRow[]
  readonly seats: readonly SeatReading[]
  /** The machine the readings stand on (`workcell:mac`), when disclosed. */
  readonly machineRef: string | null
  /** Each product's primary checkout as the register names it (`products.<product>.primary` of
   * Control/machines/workcells.register.json: `o-i` → `Work/O-I`), when the host disclosed the register. A seat's product name
   * is not its primary's directory (`ql-mef` stands at `Work/Quaternal-Logic`), so nothing is derived from it. */
  readonly primaries?: Readonly<Record<string, string>>
}

// ---------------------------------------------------------------------------
// findings — the field-health behaviours as classified readings

export type HygieneFindingKind =
  | 'seat-claimed'          // informational: a lane holds the seat (never a fault by itself)
  | 'seat-drift'            // the register's pose differs from the live checkout
  | 'seat-floor-breach'     // disk admission below the soft floor (recorded, not repaired)
  | 'checkout-missing'      // a register seat's checkout does not exist on disk
  | 'stray-branch'          // a lane-named branch no register claim accounts for
  | 'worktree-outside-register' // a checked-out worktree no register seat names
  | 'foreign-lane'          // an owner-held unmerged lane occupies a seat (owner's call)
  | 'occupied-by-landed'    // a seat stands on a branch already merged at origin/main
  // The Ground page (Central, through the kernel's invoke_action):
  | 'root-part-missing'     // a part every Central root has is not valid (central.doctor checks)
  | 'root-mixed'            // the root is also a product checkout (central.doctor mixed_root; the owner's call)
  | 'scaffold-missing'      // a part of the world's ProjectCentral would be stamped (central.world.reproject.plan would_stamp)
  | 'source-unrecognised'   // a native candidate whose role hints name a vision, intent, experience, design or architecture
  // The Material page (Workcell):
  | 'binding-drift'         // a world's binding is stale or missing and its receipt can bring it back
  | 'binding-lost'          // a binding that lasted only for its task is missing: nothing brings it back
  | 'sandbox-orphan'        // a sandbox whose lease has ended (Workcell's lease `expired-orphan`)
  | 'sandbox-unproven'      // a sandbox with no lease evidence (lease `unknown`): never released, not a fault

export interface HygieneFinding {
  readonly kind: HygieneFindingKind
  /** What the finding is about (seat, branch or worktree address). */
  readonly subject: string
  /** The standing in plain words — the reading, not a verdict. */
  readonly standing: string
  /** The owner operation(s) this reading stands on. */
  readonly boundaryOps: readonly string[]
  /** What would tend it, when a tender exists — the tender's id, not a fire. */
  readonly tenderId: string | null
}

/** The branch-name shapes agent lanes cut (`seat join` default
 * `agent/<product>-<date>-<time>`; named lanes like `feat/…`, `agent/oh-i`). */
const LANE_BRANCH = /^(agent\/|feat\/|lane\/)/

/** Branches no seat claim accounts for: lane-named, held by no checkout, and
 * not the product's main. Reading, not deletion — the sweep stays a declared
 * tender. Whether a checkout holds a branch is the branch row's own reading
 * (`%(worktreepath)`, BranchRow.checkedOutAt): it does not depend on the
 * worktree read being taken, so turning that read off (Look at: Worktrees
 * off) never makes a held branch look stray. A seat's claim accounts for
 * its branch as well. */
export function strayBranches(census: HygieneCensus): readonly HygieneFinding[] {
  const claimedBranches = new Set(
    census.seats
      .map(seat => seat.branch)
      .filter((branch): branch is string => branch !== null),
  )
  const findings: HygieneFinding[] = []
  for (const branch of census.branches) {
    if (!LANE_BRANCH.test(branch.name)) continue
    if (branch.checkedOutAt !== null || claimedBranches.has(branch.name)) continue
    findings.push({
      kind: 'stray-branch',
      subject: branch.name,
      standing: `lane-named branch with no register claim and no seat holding it (${branch.head?.slice(0, 9) ?? 'unknown head'})`,
      boundaryOps: sourceOps(census),
      tenderId: 'sweep-branch',
    })
  }
  return findings
}

/** The checkout paths the register admits, derived from the census's own
 * rows: each seat's workcell path + product, and each product's primary
 * checkout where the register's own `primary` is disclosed (census.primaries,
 * resolved under the ground root — two levels above a worktrees/ workcell
 * path). A seat's product name is never turned into a primary path
 * (`o-i` stands at `Work/O-I`, `ql-mef` at `Work/Quaternal-Logic`); without
 * the register, the primary is still known as the main worktree git lists
 * first (erroneousWorktrees). */
export function registeredSeatPaths(census: HygieneCensus): readonly string[] {
  const paths = new Set<string>()
  let groundRoot: string | null = null
  for (const seat of census.seats) {
    if (seat.workcellPath) {
      paths.add(`${seat.workcellPath}/${seat.product}`)
      const candidate = seat.workcellPath.match(/^(.*)\/worktrees\/[^/]+$/)?.[1]
      if (candidate) groundRoot = candidate
    }
  }
  for (const primary of Object.values(census.primaries ?? {})) {
    if (primary.startsWith('/')) paths.add(primary)
    else if (groundRoot) paths.add(`${groundRoot}/${primary.replace(/^\.?\//, '')}`)
  }
  return [...paths]
}

/** Worktrees checked out outside every registered seat path — the shape the
 * 29 September owner ruling refuses (no per-lane worktrees). The main
 * worktree (the primary checkout) is the register's by its own law. */
export function erroneousWorktrees(census: HygieneCensus, seatPaths: readonly string[]): readonly HygieneFinding[] {
  const findings: HygieneFinding[] = []
  for (const worktree of census.worktrees) {
    if (worktree.bare || worktree.main) continue
    const registered = seatPaths.some(path => worktree.path === path || worktree.path.startsWith(`${path}/`))
    if (registered) continue
    findings.push({
      kind: 'worktree-outside-register',
      subject: worktree.path,
      standing: `checked out at ${worktree.branch ?? `detached ${worktree.head?.slice(0, 9) ?? '?'}`} outside every registered seat`,
      boundaryOps: sourceOps(census),
      tenderId: 'prune-worktree',
    })
  }
  return findings
}

/** Seat-level findings: drift, missing checkouts, floor breaches, foreign
 * lanes, seats standing on landed branches. */
export function seatFindings(census: HygieneCensus): readonly HygieneFinding[] {
  const findings: HygieneFinding[] = []
  for (const seat of census.seats) {
    const ops = sourceOps(census)
    if (seat.drift) {
      findings.push({
        kind: 'seat-drift',
        subject: `${seat.workcell}/${seat.product}`,
        standing: seat.drift,
        boundaryOps: ops,
        tenderId: null, // drift is a stamping question for the seat instrument, not a device tender
      })
    }
    if (seat.state === 'unknown') {
      findings.push({
        kind: 'checkout-missing',
        subject: `${seat.workcell}/${seat.product}`,
        standing: 'the register holds the seat but its checkout did not answer the live read',
        boundaryOps: ops,
        tenderId: null,
      })
    }
    if (seat.admissionNote && /breach|below/i.test(seat.admissionNote)) {
      findings.push({
        kind: 'seat-floor-breach',
        subject: `${seat.workcell}/${seat.product}`,
        standing: seat.admissionNote,
        boundaryOps: ops,
        tenderId: null,
      })
    }
    if (seat.state === 'occupied-foreign-lane') {
      findings.push({
        kind: 'foreign-lane',
        subject: `${seat.workcell}/${seat.product}`,
        standing: `owner-held unmerged lane (${seat.branch ?? 'unknown branch'}) occupies the seat; join and curation refuse — the owner retires it`,
        boundaryOps: ops,
        tenderId: null,
      })
    }
    if (seatOnLanded(seat)) {
      findings.push({
        kind: 'occupied-by-landed',
        subject: `${seat.workcell}/${seat.product}`,
        standing: `seat claims ${seat.branch} with a clean tree and nothing main does not hold (0 ahead) — the lane landed: release the seat (the seat law: a landed lane releases its workcell)`,
        boundaryOps: ops,
        tenderId: 'release-seat',
      })
    }
  }
  return findings
}

/** A claimed seat standing on a landed lane: off main, a clean tree (no
 * tracked change, nothing untracked), and no commit main does not hold
 * (`ahead_main` 0). A clean seat ahead of main still holds unlanded work and
 * is not landed; a seat whose counts the instrument did not disclose is not
 * called landed. */
export function seatOnLanded(seat: SeatReading): boolean {
  return seat.state === 'claimed' && !!seat.branch && !/(^|\/)main$/.test(seat.branch)
    && seat.dirty === 0 && seat.untracked === 0 && seat.ahead === 0
}

/** The census as claimed seats — occupancy is itself a reading (the ticket
 * names seat occupancy first among the readings). */
export function seatOccupancy(census: HygieneCensus): readonly HygieneFinding[] {
  return census.seats
    .filter(seat => seat.state === 'claimed')
    .map(seat => ({
      kind: 'seat-claimed' as const,
      subject: `${seat.workcell}/${seat.product}`,
      standing: `claimed by ${seat.claimedBy ?? 'unknown lane'} on ${seat.branch ?? 'unknown branch'}`
        + (seat.dirty !== null ? ` · ${seat.dirty} dirty, ${seat.untracked ?? '?'} untracked` : ''),
      boundaryOps: sourceOps(census),
      tenderId: null,
    }))
}

/** All findings in the field-health order: occupancy, drift/missing/floor,
 * foreign lanes, stray branches, erroneous worktrees. */
export function hygieneFindings(census: HygieneCensus, seatPaths: readonly string[]): readonly HygieneFinding[] {
  return [
    ...seatOccupancy(census),
    ...seatFindings(census),
    ...strayBranches(census),
    ...erroneousWorktrees(census, seatPaths),
  ]
}

/** The boundary ops the census's readings stand on — every finding cites
 * the operations that produced its rows. */
function sourceOps(census: HygieneCensus): readonly string[] {
  return census.sources.map(source => source.boundaryOp)
}

// ---------------------------------------------------------------------------
// tenders — declared, waiting, never fired from a device

export interface HygieneTender {
  readonly id: string
  readonly label: string
  /** The owner operation that would execute the tender, exactly named. */
  readonly ownerOperation: string
  /** Why it waits: the writer lives outside the device (an authenticated
   * instrument, a landed owner op), so the device declares and waits. */
  readonly waitsFor: string
  /** What a receipt of this tender would carry when its writer lands. */
  readonly receiptShape: string
}

/** The route a tender that writes the person's own ground waits on: the kernel's invoke_action reaches Central's actions, and carries the
 * person's authority only for the person's own presses (desktop/cradle/kernel/src/action.rs PERSON_ACTS), which name none of these. */
const PERSON_ROUTE = 'the kernel route that carries the person\'s authority: the owner\'s write needs the person, and invoke_action carries the person only for the presses desktop/cradle/kernel/src/action.rs PERSON_ACTS names, which do not include it'

export const HYGIENE_TENDERS: readonly HygieneTender[] = [
  {
    id: 'release-seat',
    label: 'Release seat',
    ownerOperation: 'seat release <workcell> <product> (Control/user/workcell/seat, file-locked register)',
    waitsFor: 'the seat instrument — a device holds no register write authority',
    receiptShape: 'release return id + the seat refreshed to origin/main, claim cleared',
  },
  {
    id: 'prune-worktree',
    label: 'Prune worktree',
    ownerOperation: 'git worktree remove (through the seat instrument; never a raw worktree add/remove under the seat law)',
    waitsFor: 'a commissioned repair — detection is always in scope, repair is a separate act (field-health law)',
    receiptShape: 'removed path + the register row it served, or the named refusal',
  },
  {
    id: 'sweep-branch',
    label: 'Sweep stray branch',
    ownerOperation: 'git branch -d (owner-commissioned; unmerged foreign lanes are the owner\'s call and refuse the sweep)',
    waitsFor: 'a commissioned repair with the branch\'s lane named — retention wins where cleanup disagrees',
    receiptShape: 'branch name + head + deleted/kept standing with the reason',
  },
  {
    id: 'init-root',
    label: 'Initialise root',
    ownerOperation: 'central.init (Central: create the root\'s missing parts; what is already there is kept)',
    waitsFor: PERSON_ROUTE,
    receiptShape: 'central-initialization: the parts created and the parts kept',
  },
  {
    id: 'reproject-scaffold',
    label: 'Reproject',
    ownerOperation: 'central.world.reproject.apply {project} (Central: stamp only the missing ProjectCentral scaffold; nothing moves)',
    waitsFor: PERSON_ROUTE,
    receiptShape: 'central-world-reproject-receipt: the parts stamped, and what reprojection never does',
  },
  {
    id: 'recognise-source',
    label: 'Recognise',
    ownerOperation: 'projectcentral.ground.apply {project, source, provenance, standing, treatment retain-native-in-place, acceptance human-accepted} (Central)',
    waitsFor: PERSON_ROUTE,
    receiptShape: 'projectcentral-ground-apply: the recorded relation; the source\'s bytes and path stay',
  },
  {
    id: 'reconcile-binding',
    label: 'Reconcile',
    ownerOperation: 'workcell --receipt <R> reconcile --desired <binding>=present (Workcell)',
    waitsFor: 'a kernel route to Workcell\'s reconcile, which the owner has and the kernel does not reach yet (T-COVERAGE §1.2)',
    receiptShape: 'the binding brought back from the world\'s receipt, or Workcell\'s refusal',
  },
  {
    id: 'release-orphans',
    label: 'Release orphans',
    ownerOperation: 'workcell sandboxes reconcile --server <url> --release-orphans (Workcell)',
    waitsFor: 'a kernel route to Workcell\'s sandboxes reconcile, which the owner has and the kernel does not reach yet (T-COVERAGE §1.2)',
    receiptShape: 'the sandboxes released (lease expired-orphan); a sandbox with no lease evidence is never released',
  },
]

// ---------------------------------------------------------------------------
// the Ground and Material pages — Central's root, a world's scaffold and authored ground; Workcell's worlds and sandboxes

/** Central's root as `central.doctor` reads it (central-health): each required part, and whether the root is also a product checkout. */
export interface RootReading {
  readonly root: string
  readonly valid: boolean
  readonly checks: readonly {readonly path: string; readonly valid: boolean}[]
  readonly mixed: {readonly detected: boolean; readonly signals: readonly string[]}
}
/** A world's scaffold as `central.world.reproject.plan {project}` reads it: what is already present, what would be stamped. */
export interface ScaffoldReading {readonly project: string; readonly present: readonly string[]; readonly missing: readonly string[]}
/** A world's authored ground as `projectcentral.ground.inspect {project}` reads it: the recognised sources, how many native candidates
 * wait, and those the model lists as findings (WAITING_HINTS). */
export interface AuthoredReading {
  readonly status: string
  readonly recognised: readonly {readonly path: string; readonly provenance: string}[]
  readonly waiting: number
  readonly listed: readonly {readonly path: string; readonly hints: readonly string[]}[]
}
/** One prepared world as Workcell reads it (its receipt), with each binding's presence (Workcell's BindingPresence: present, missing,
 * released, suspended, snapshotted, stale) and health; `persistence` where the receipt says the binding lasts only for its task. */
export interface MaterialWorld {
  readonly ref: string
  readonly state?: string
  readonly bindings: readonly {readonly ref: string; readonly presence: string; readonly health?: string; readonly persistence?: string}[]
}
/** A sandbox server's sandboxes as `workcell sandboxes reconcile --server <url> --json` classifies them (lease live | expired-orphan | unknown). */
export interface SandboxReading {
  readonly server: string
  readonly sandboxes: readonly {readonly id: string; readonly state?: string; readonly lease: string; readonly expiresAt?: string | null}[]
}

/** The role hints a native candidate must carry to be listed as waiting for recognition: the manual's "a vision, an intent, an
 * experience or a design" (§18.5), with architecture (the design's own list). Central's words for them (projectcentral.ground.inspect
 * role_hints). Central decides no authorship: a listed candidate is a reading, and only Recognise makes it ground. */
export const WAITING_HINTS: readonly string[] = ['vision', 'intent', 'desired-experience', 'design', 'architecture']

const rec = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)
const pathsOf = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap(item => (rec(item) && text(item.path) ? [String(item.path)] : [])) : [])

/** `central.doctor`'s data as the Ground page's root. Null when it is not that reading. */
export function rootOfDoctor(data: unknown): RootReading | null {
  if (!rec(data) || !Array.isArray(data.checks) || typeof data.valid !== 'boolean') return null
  const mixed = rec(data.mixed_root) ? data.mixed_root : {}
  return {root: text(data.root) ?? '', valid: data.valid,
    checks: data.checks.flatMap(check => (rec(check) && text(check.path) && typeof check.valid === 'boolean' ? [{path: String(check.path), valid: check.valid}] : [])),
    mixed: {detected: mixed.detected === true, signals: Array.isArray(mixed.signals) ? mixed.signals.map(String) : []}}
}

/** `central.world.reproject.plan`'s data (central.world-reproject-plan/v1) as the Ground page's scaffold. Null when it is not that plan. */
export function scaffoldOfPlan(data: unknown): ScaffoldReading | null {
  if (!rec(data) || data.schema !== 'central.world-reproject-plan/v1') return null
  return {project: text(data.project) ?? '', present: pathsOf(data.already_present), missing: pathsOf(data.would_stamp)}
}

/** `projectcentral.ground.inspect`'s data as the Ground page's authored ground: the recognised sources (path, provenance), the count of
 * native candidates, and those whose role hints name WAITING_HINTS. Null when it is not that inspection. */
export function authoredOfInspection(data: unknown): AuthoredReading | null {
  if (!rec(data) || !Array.isArray(data.native_candidates) || !Array.isArray(data.recognised_sources)) return null
  const hinted = (row: Record<string, unknown>) => (Array.isArray(row.role_hints) ? row.role_hints.filter((hint): hint is string => typeof hint === 'string') : [])
  return {
    status: text(data.status) ?? 'unknown',
    recognised: data.recognised_sources.flatMap(row => (rec(row) && text(row.path) ? [{path: String(row.path), provenance: text(row.provenance) ?? 'unresolved'}] : [])),
    waiting: data.native_candidates.length,
    listed: data.native_candidates.flatMap(row => {
      if (!rec(row) || !text(row.path)) return []
      const hints = hinted(row)
      return hints.some(hint => WAITING_HINTS.includes(hint)) ? [{path: String(row.path), hints}] : []
    }),
  }
}

/** The Ground page's readings, each with the operation it was read by. */
export interface GroundReadings {
  readonly root?: RootReading | null
  readonly scaffold?: ScaffoldReading | null
  readonly authored?: AuthoredReading | null
  readonly ops: {readonly root: string; readonly scaffold: string; readonly authored: string}
}

/** The Ground page's findings: a root part not valid (Initialise root), the root mixed with a product checkout (yours to decide), each
 * part of the scaffold the plan would stamp (Reproject), each listed candidate (Recognise). */
export function groundFindings(ground: GroundReadings): readonly HygieneFinding[] {
  const findings: HygieneFinding[] = []
  for (const check of ground.root?.checks ?? []) if (!check.valid) findings.push({kind: 'root-part-missing', subject: check.path,
    standing: `The root has no valid ${check.path}. Initialise root creates what is missing and keeps what is there.`, boundaryOps: [ground.ops.root], tenderId: 'init-root'})
  if (ground.root?.mixed.detected) findings.push({kind: 'root-mixed', subject: ground.root.root || 'the root',
    standing: `The root is also a product checkout${ground.root.mixed.signals.length ? ` (${ground.root.mixed.signals.join(', ')})` : ''}. The decision is yours.`, boundaryOps: [ground.ops.root], tenderId: null})
  for (const path of ground.scaffold?.missing ?? []) findings.push({kind: 'scaffold-missing', subject: path,
    standing: `The world's ProjectCentral has no ${path.replace(/^.*?ProjectCentral\/?/, '') || 'ProjectCentral'}. Reproject stamps it and moves nothing.`, boundaryOps: [ground.ops.scaffold], tenderId: 'reproject-scaffold'})
  for (const row of ground.authored?.listed ?? []) findings.push({kind: 'source-unrecognised', subject: row.path,
    standing: `Its name suggests ${row.hints.filter(hint => WAITING_HINTS.includes(hint)).join(' and ').replace(/-/g, ' ')}. Central does not infer authorship: recognise it to make it ground, or leave it as project source.`,
    boundaryOps: [ground.ops.authored], tenderId: 'recognise-source'})
  return findings
}

/** The Material page's readings, each with the operation it was read by. */
export interface MaterialReadings {
  readonly worlds?: readonly MaterialWorld[] | null
  readonly sandboxes?: SandboxReading | null
  readonly ops: {readonly worlds: string; readonly sandboxes: string}
}

/** The Material page's findings: a binding stale or missing that its receipt can bring back (Reconcile); one that lasted only for its task
 * and is missing (lost: nothing brings it back); a sandbox whose lease ended (Release orphans); a sandbox with no lease evidence (a
 * reading, never released). */
export function materialFindings(material: MaterialReadings): readonly HygieneFinding[] {
  const findings: HygieneFinding[] = []
  for (const world of material.worlds ?? []) for (const binding of world.bindings) {
    const subject = `${world.ref}#${binding.ref}`
    const ephemeral = binding.persistence === 'ephemeral' || binding.persistence === 'task'
    if (binding.presence === 'missing' && ephemeral) findings.push({kind: 'binding-lost', subject,
      standing: 'The binding lasted only for its task: its material is gone and nothing brings it back.', boundaryOps: [material.ops.worlds], tenderId: null})
    else if (binding.presence === 'stale' || binding.presence === 'missing') findings.push({kind: 'binding-drift', subject,
      standing: `The binding is ${binding.presence}: the receipt names it and the provider no longer holds it as it was. Reconcile brings it back.`, boundaryOps: [material.ops.worlds], tenderId: 'reconcile-binding'})
  }
  for (const box of material.sandboxes?.sandboxes ?? []) {
    if (box.lease === 'expired-orphan') findings.push({kind: 'sandbox-orphan', subject: box.id,
      standing: `Its lease ended${box.expiresAt ? ` at ${box.expiresAt}` : ''}. Nothing holds it.`, boundaryOps: [material.ops.sandboxes], tenderId: 'release-orphans'})
    else if (box.lease === 'unknown') findings.push({kind: 'sandbox-unproven', subject: box.id,
      standing: 'The server reports no lease for it, so it may be live. It is never released here.', boundaryOps: [material.ops.sandboxes], tenderId: null})
  }
  return findings
}

/** Assemble the census from host-supplied owner readings. Every source must
 * name its boundary operation; a source that cannot is refused here — that
 * is the aperture law made structural. */
export function assembleCensus(input: {
  sources: readonly BoundaryOpSource[]
  worktrees?: readonly WorktreeRow[]
  branches?: readonly BranchRow[]
  seats?: readonly SeatReading[]
  machineRef?: string | null
  primaries?: Readonly<Record<string, string>>
}): HygieneCensus {
  for (const source of input.sources) {
    if (!source.boundaryOp) throw new Error('a hygiene reading without its boundary operation is not a reading')
  }
  return {
    sources: input.sources,
    worktrees: input.worktrees ?? [],
    branches: input.branches ?? [],
    seats: input.seats ?? [],
    machineRef: input.machineRef ?? null,
    ...(input.primaries ? {primaries: input.primaries} : {}),
  }
}

/** The machine a workcell status reading names: Workcell's own `workcell_ref` (`workcell status --json` → "workcell_ref":
 * "workcell:mac"; the kernel's `workcell_status_read` carries that reading as it is). A key the owner does not print is not read. */
export function workcellRefOf(reading: unknown): string | null {
  const ref = reading && typeof reading === 'object' ? (reading as {workcell_ref?: unknown}).workcell_ref : undefined
  return typeof ref === 'string' && ref ? ref : null
}

/** Parse `git worktree list --porcelain` output (read-only machine read). The first row is the main worktree (git's own order). */
export function parseWorktreeList(stdout: string): readonly WorktreeRow[] {
  const rows: WorktreeRow[] = []
  let current: {path: string; head: string | null; branch: string | null; bare: boolean; detached: boolean; main: boolean} | null = null
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) rows.push(current)
      current = {path: line.slice('worktree '.length), head: null, branch: null, bare: false, detached: false, main: rows.length === 0}
    } else if (current && line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length)
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    } else if (current && line === 'bare') {
      current.bare = true
    } else if (current && line === 'detached') {
      current.detached = true
    }
  }
  if (current) rows.push(current)
  return rows
}

/** Parse `git for-each-ref refs/heads --format=%(refname:short)%09%(objectname)%09%(worktreepath)` output. */
export function parseBranchRefs(stdout: string): readonly BranchRow[] {
  return stdout.split('\n').filter(line => line.trim().length > 0).map(line => {
    const [name, head, worktreePath] = line.split('\t')
    return {name, head: head || null, checkedOutAt: worktreePath || null}
  })
}

/** Parse the seat instrument's `seat status` output into seat rows. The
 * instrument's display format is the owner's; this parser reads only what
 * it actually prints (name, state, pose, the change marks, actor, drift,
 * admission/floor notes) and leaves everything else as unknown — a parse
 * gap stays honest, never guessed. Continuation lines (floor-breach notes,
 * DRIFT rows) attach to the seat they follow; a DRIFT row names its own
 * product and attaches there.
 *
 * The pose is the first word after the state: the live branch, or
 * `detached <head>` (any branch name — `dlw/build`, `fold/…`, `speed/…` —
 * never a guessed prefix). The marks follow it, and the instrument prints a
 * mark only when its count is not zero (Control/user/workcell/seat
 * cmd_status: `N dirty`, `N untracked`, `+N` ahead of main, `-N` behind),
 * so on an answered row an absent mark reads 0. Prefer the instrument's own
 * JSON (`seat status --json`, parseSeatStatusJson), which states every
 * count. */
export function parseSeatStatus(stdout: string): readonly SeatReading[] {
  // The draft is mutable while the parser attaches continuation rows; the
  // returned rows are the readonly readings.
  type SeatDraft = {-readonly [K in keyof SeatReading]: SeatReading[K]}
  const seats: SeatDraft[] = []
  const workcellPaths = new Map<string, string>()
  let workcell = ''
  let current: SeatDraft | null = null
  for (const line of stdout.split('\n')) {
    const wc = line.match(/^workcell (\S+)\s+\(([^)]+)\)/)
    if (wc) {
      workcell = wc[1]
      workcellPaths.set(wc[1], wc[2])
      current = null
      continue
    }
    // `  o-i     claimed   agent/o-i-20261007-1639   57 dirty 19 untracked +21 by codex:sol-new-shell`
    // `  actuation  free   detached 68a621a            1 untracked -2`
    // (column alignment varies; the state word anchors the row)
    const seat = line.match(/^\s{2}(\S+)\s+(free|claimed|occupied-foreign-lane)\s+(.*)$/)
    if (seat && workcell) {
      const [, product, state, rest] = seat
      const claim = rest.match(/\sby (\S+)\s*$/)
      const words = (claim ? rest.slice(0, claim.index) : rest).trim().split(/\s+/).filter(Boolean)
      const detached = words[0] === 'detached'
      const pose = detached ? words.slice(0, 2) : words.slice(0, 1)
      const marks = words.slice(pose.length).join(' ')
      const liveHead = detached ? words[1] ?? null : null
      // `detached None` — the checkout did not answer the live read. The
      // row stays honest: unknown state, no counts, nothing invented.
      const unanswered = detached && (liveHead === null || liveHead === 'None')
      const count = (pattern: RegExp): number | null => {
        if (unanswered) return null
        const found = marks.match(pattern)?.[1]
        return found !== undefined ? Number(found) : 0
      }
      current = {
        workcell,
        workcellPath: workcellPaths.get(workcell) ?? null,
        product,
        state: unanswered ? 'unknown' : state as SeatReading['state'],
        branch: detached ? null : words[0] ?? null,
        head: unanswered || !liveHead || !/^[0-9a-f]{7,}$/.test(liveHead) ? null : liveHead,
        claimedBy: state === 'claimed' ? claim?.[1] ?? null : null,
        dirty: count(/(\d+) dirty/),
        untracked: count(/(\d+) untracked/),
        ahead: count(/(?:^|\s)\+(\d+)(?:\s|$)/),
        behind: count(/(?:^|\s)-(\d+)(?:\s|$)/),
        drift: null,
        admissionNote: null,
      }
      seats.push(current)
      continue
    }
    const breach = line.match(/^\s+(floor breach recorded:.*)$/)
    if (breach && current) {
      current.admissionNote = breach[1].trim()
      continue
    }
    const drift = line.match(/^\s*DRIFT:\s*(\S+):\s*(.*)$/)
    if (drift) {
      const target = seats.find(candidate => candidate.workcell === workcell && candidate.product === drift[1])
        ?? current
      if (target) target.drift = drift[2].trim()
    }
  }
  return seats
}

/** The seat instrument's own JSON (`seat status --json`, schema `central.workcell-status/v1`; Control/user/workcell/seat
 * cmd_status), the reading to prefer over the text: every count is stated (`tracked_changes`, `untracked`, `ahead_main`,
 * `behind_main`), the live pose is separate from the register's, and each workcell's drift lines name their product. Null when
 * the text is not that reading (the caller falls back to the text parser). A workcell drift line `<product>: checkout missing`
 * makes that seat unknown, as the text's `detached None` does. */
export function parseSeatStatusJson(stdout: string): readonly SeatReading[] | null {
  let report: unknown
  try { report = JSON.parse(stdout) } catch { return null }
  const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const doc = record(report)
  if (!doc || doc.schema !== 'central.workcell-status/v1' || !Array.isArray(doc.workcells)) return null
  const text = (value: unknown): string | null => typeof value === 'string' && value ? value : null
  const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
  const seats: SeatReading[] = []
  for (const cell of doc.workcells) {
    const workcell = record(cell)
    const name = text(workcell?.name)
    if (!workcell || !name) continue
    const drifts = (Array.isArray(workcell.drift) ? workcell.drift : []).filter((line): line is string => typeof line === 'string')
    for (const row of Array.isArray(workcell.seats) ? workcell.seats : []) {
      const seat = record(row)
      const product = text(seat?.product)
      if (!seat || !product) continue
      const drift = drifts.find(line => line.startsWith(`${product}: `))?.slice(product.length + 2).trim() ?? null
      const missing = drift === 'checkout missing'
      const declared = seat.state === 'free' || seat.state === 'claimed' || seat.state === 'occupied-foreign-lane' ? seat.state : 'unknown'
      const admission = record(seat.admission)
      const free = count(admission?.free_gb), floor = count(admission?.soft_floor_gb)
      const admissionNote = admission
        ? `${text(admission.standing) ?? 'admission recorded'}${free !== null && floor !== null ? ` (${free} GB free < soft ${floor} GB)` : ''}`
        : null
      seats.push({
        workcell: name,
        workcellPath: text(workcell.path),
        product,
        state: missing ? 'unknown' : declared,
        branch: missing ? null : text(seat.live_branch),
        head: missing ? null : text(seat.live_head),
        claimedBy: text(seat.claimed_by),
        dirty: missing ? null : count(seat.tracked_changes),
        untracked: missing ? null : count(seat.untracked),
        ahead: missing ? null : count(seat.ahead_main),
        behind: missing ? null : count(seat.behind_main),
        drift: missing ? null : drift,
        admissionNote,
      })
    }
  }
  return seats
}
