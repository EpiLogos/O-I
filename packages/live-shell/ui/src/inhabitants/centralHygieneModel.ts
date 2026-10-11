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
 * stray branch) are DECLARED controls naming the owner operation that would
 * execute them. No tender fires from a device: each renders as declared and
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

/** Branches no seat claim accounts for: lane-named, not checked out in any
 * registered seat, and not the product's main. Reading, not deletion — the
 * sweep stays a declared tender. */
export function strayBranches(census: HygieneCensus): readonly HygieneFinding[] {
  const claimedBranches = new Set(
    census.seats
      .map(seat => seat.branch)
      .filter((branch): branch is string => branch !== null),
  )
  const checkedOut = new Set(
    census.worktrees
      .map(worktree => worktree.branch)
      .filter((branch): branch is string => branch !== null),
  )
  const findings: HygieneFinding[] = []
  for (const branch of census.branches) {
    if (!LANE_BRANCH.test(branch.name)) continue
    if (claimedBranches.has(branch.name) || checkedOut.has(branch.name)) continue
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
 * seat rows: each seat's workcell path + product, and each product's
 * primary checkout (`<ground>/Work/<product>` — the ground root is two
 * levels above a worktrees/ workcell path). The census carries its own
 * registration facts; the caller supplies no extra machine constants. */
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
  if (groundRoot) {
    for (const seat of census.seats) paths.add(`${groundRoot}/Work/${seat.product}`)
  }
  return [...paths]
}

/** Worktrees checked out outside every registered seat path — the shape the
 * 29 September owner ruling refuses (no per-lane worktrees). */
export function erroneousWorktrees(census: HygieneCensus, seatPaths: readonly string[]): readonly HygieneFinding[] {
  const findings: HygieneFinding[] = []
  for (const worktree of census.worktrees) {
    if (worktree.bare) continue
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
    if (seat.state === 'claimed' && seat.branch && /main$/.test(seat.branch) === false && seat.dirty === 0 && seat.untracked === 0) {
      findings.push({
        kind: 'occupied-by-landed',
        subject: `${seat.workcell}/${seat.product}`,
        standing: `seat claims ${seat.branch} with a clean tree — if the lane landed, release the seat (the seat law: a landed lane releases its workcell)`,
        boundaryOps: ops,
        tenderId: 'release-seat',
      })
    }
  }
  return findings
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
]

/** Assemble the census from host-supplied owner readings. Every source must
 * name its boundary operation; a source that cannot is refused here — that
 * is the aperture law made structural. */
export function assembleCensus(input: {
  sources: readonly BoundaryOpSource[]
  worktrees?: readonly WorktreeRow[]
  branches?: readonly BranchRow[]
  seats?: readonly SeatReading[]
  machineRef?: string | null
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
  }
}

/** Parse `git worktree list --porcelain` output (read-only machine read). */
export function parseWorktreeList(stdout: string): readonly WorktreeRow[] {
  const rows: WorktreeRow[] = []
  let current: {path: string; head: string | null; branch: string | null; bare: boolean; detached: boolean} | null = null
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) rows.push(current)
      current = {path: line.slice('worktree '.length), head: null, branch: null, bare: false, detached: false}
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
 * it actually prints (name, state, branch, dirty counts, actor, drift,
 * admission/floor notes) and leaves everything else as unknown — a parse
 * gap stays honest, never guessed. Continuation lines (floor-breach notes,
 * DRIFT rows) attach to the seat they follow; a DRIFT row names its own
 * product and attaches there. */
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
      const branch = rest.match(/(detached|((?:agent|feat|lane|main)[^\s]*))/)?.[1]
      const head = rest.match(/(?:detached\s+)?([0-9a-f]{7,})/)?.[1] ?? null
      const dirty = rest.match(/(\d+) dirty/)?.[1]
      const untracked = rest.match(/(\d+) untracked/)?.[1]
      const claimedBy = state === 'claimed' ? rest.match(/by (\S+)/)?.[1] ?? null : null
      // `detached None` — the checkout did not answer the live read. The
      // row stays honest: unknown state, nothing invented.
      const unanswered = head === null && /detached\s+None/.test(rest)
      current = {
        workcell,
        workcellPath: workcellPaths.get(workcell) ?? null,
        product,
        state: unanswered ? 'unknown' : state as SeatReading['state'],
        branch: branch === 'detached' ? null : branch ?? null,
        head,
        claimedBy,
        dirty: dirty !== undefined ? Number(dirty) : null,
        untracked: untracked !== undefined ? Number(untracked) : null,
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
