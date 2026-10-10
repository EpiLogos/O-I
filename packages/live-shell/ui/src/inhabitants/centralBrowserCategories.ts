/** Central browser categories — the family's left-browser places (ticket L7;
 * WORLD-SHELL-DESIGN §12/§16: "the browser (its categories)" is one of a
 * family's four surfaces and nowhere else).
 *
 * Registration, not registration-hijack: the shell's browser categories are
 * registered data (WorldBrowser's CATEGORIES, the agent shell's
 * AgentShellBrowser CATEGORIES — both lanes' owner sections). This module
 * declares Central's categories in that same data shape so a host composes
 * them through the existing door; it edits no frame and no owner list. Each
 * category names the owner operations its rows read — a category whose rows
 * have no owner read is declared `waiting`, honestly.
 *
 * Pure data. No React, no transport. */

export interface CentralBrowserCategory {
  readonly id: string
  readonly label: string
  /** What the category's rows are, in the ground's own nouns. */
  readonly note: string
  /** The owner operations the rows read (named per §12/§16). */
  readonly reads: readonly string[]
  /** `admitted`: every read exists today. `waiting`: a read is missing —
   * the category names which. */
  readonly admission: 'admitted' | 'waiting'
}

export const CENTRAL_BROWSER_CATEGORIES: readonly CentralBrowserCategory[] = [
  {
    id: 'central-days',
    label: 'Days',
    note: 'The civil calendar: a day per column, its record and .sources snapshot beneath it.',
    reads: ['op files_list (ProjectCentral/now/day …)', 'op file_read (the day record, CAS-revised)', 'op temporal_events_read (the day\'s clips)'],
    admission: 'admitted',
  },
  {
    id: 'central-now',
    label: 'NOW field',
    note: 'The standing clearings — the register\'s own listing, pointers not authority.',
    reads: ['op now kind:list / kind:read (central.now-listing/v1, central.now-reading/v1)'],
    admission: 'admitted',
  },
  {
    id: 'central-ground',
    label: 'Ground',
    note: 'Worktrees, seats, branches — the hygiene readings as browsable rows.',
    reads: ['op workcell_status_read', 'seat status (Control/user/workcell/seat, machine instrument)', 'git worktree list --porcelain / git for-each-ref (read-only machine reads)'],
    admission: 'admitted',
  },
  {
    id: 'central-impact',
    label: 'Impact',
    note: 'Select a folder or note; the category lists its Central-web neighbourhood as rows.',
    reads: ['op graph (the knowledge graph owner)', 'op wiki_projection_read (refuses in some boots — disclosed, not hidden)', 'op now kind:list (sessions touching)'],
    admission: 'admitted',
  },
  {
    id: 'central-wiki',
    label: 'Wiki',
    note: 'The root wiki as browser rows — already a native Expression projection (§6); the rows route there, not to a second store.',
    reads: ['op wiki_projection_read / op wiki_projection_sources'],
    admission: 'waiting',
  },
]

/** The row shape a host's browser renders — the same data shape the shell's
 * own category tables carry (id + label + meta). */
export interface CentralBrowserRow {
  readonly key: string
  readonly label: string
  readonly meta: string
}

/** The rows one category honestly offers from host-supplied owner data.
 * A waiting category, or one whose reads refused, offers the refusal as its
 * row — an honest empty names itself (the widget guide's empty-slot law). */
export function centralBrowserRows(
  category: CentralBrowserCategory,
  data: {
    days?: readonly {day: string; recordBytes: number | null}[]
    nowRefs?: readonly {now_ref: string; purpose: string; lifecycle: string}[]
    seats?: readonly {workcell: string; product: string; state: string; branch: string | null}[]
    impactSubjects?: readonly {path: string; kind: string}[]
  },
  refusals?: readonly {read: string; refusal: string}[],
): readonly CentralBrowserRow[] {
  const refusalFor = (read: string): string | undefined =>
    refusals?.find(refusal => read.startsWith(refusal.read) || refusal.read.startsWith(read))?.refusal
  switch (category.id) {
    case 'central-days':
      if (refusalFor('op files_list')) return [{key: 'refused', label: `refused — ${refusalFor('op files_list')}`, meta: 'op files_list'}]
      return (data.days ?? []).map(day => ({key: `day:${day.day}`, label: day.day, meta: day.recordBytes !== null ? `${day.recordBytes} B` : 'no record yet'}))
    case 'central-now':
      if (refusalFor('op now')) return [{key: 'refused', label: `refused — ${refusalFor('op now')}`, meta: 'op now'}]
      return (data.nowRefs ?? []).map(row => ({key: row.now_ref, label: row.purpose, meta: row.lifecycle}))
    case 'central-ground':
      if (refusalFor('op workcell_status_read')) return [{key: 'refused', label: `refused — ${refusalFor('op workcell_status_read')}`, meta: 'op workcell_status_read'}]
      return (data.seats ?? []).map(seat => ({key: `${seat.workcell}/${seat.product}`, label: `${seat.workcell}/${seat.product}`, meta: `${seat.state}${seat.branch ? ` · ${seat.branch}` : ''}`}))
    case 'central-impact':
      return (data.impactSubjects ?? []).map(subject => ({key: subject.path, label: subject.path, meta: subject.kind}))
    case 'central-wiki':
      return [{key: 'waiting', label: 'Waiting — the wiki projection owner does not answer in this boot; the wiki projects through its Expression owner when it does.', meta: 'declared, waiting'}]
    default:
      return [{key: 'empty', label: `Nothing disclosed for ${category.label} yet.`, meta: category.reads[0] ?? ''}]
  }
}
