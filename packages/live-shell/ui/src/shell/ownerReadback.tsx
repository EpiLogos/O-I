import type {ShellConfig} from '../native/application'
import './ownerReadback.css'

/**
 * The owner readback (P0-R6-ui): which suite products the native host admitted,
 * which the footprint excluded, which failed, and which are absent, read only
 * from the host's own live_shell_config. The shell never hard-codes the product
 * universe: suite_product_ids is the host's disclosure, and a product the host
 * does not name is never drawn. The development browser discloses no owner
 * configuration, so it gets a stated absence, never a fabricated admission.
 */

export type OwnerState = 'admitted' | 'excluded-by-footprint' | 'failed' | 'absent' | 'undisclosed'

export interface OwnerReadbackRow {
  /** The owner, named by the host's product id. */
  owner: string
  state: OwnerState
  /** The state in the window's plain words. */
  label: string
  /** One sentence for the title and for assistive technology. */
  line: string
  /** The owner's remedy. The host names none in live_shell_config, so every
   * non-admitted row says so; null only for an admitted owner. */
  remedy: string | null
}

export type OwnerReadbackKind = 'native' | 'development' | 'pending' | 'unread'

export interface OwnerReadbackReading {
  kind: OwnerReadbackKind
  /** The short status-region words for the whole reading. */
  summary: string
  /** One sentence describing the whole reading, for the title. */
  line: string
  rows: OwnerReadbackRow[]
}

export type OwnerReadbackConfig = Pick<ShellConfig, 'product_ids' | 'contributions' | 'suite_product_ids'>

export interface OwnerReadbackInput {
  native: boolean
  config: OwnerReadbackConfig | null
  /** The owner configuration could not be read; the owner's own words. */
  error: string | null
}

/** The shell's own owner is not a suite product. It appears only when its registration failed. */
const SHELL_OWNER = 'oi'
const NO_REMEDY = 'no remedy named'

const LABEL: Record<OwnerState, string> = {
  admitted: 'admitted',
  'excluded-by-footprint': 'excluded by footprint',
  failed: 'failed',
  absent: 'absent',
  undisclosed: 'not disclosed',
}

const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : null

/** The readback as a pure function of what the host disclosed. */
export function ownerReadbackOf({native, config, error}: OwnerReadbackInput): OwnerReadbackReading {
  if (!native) {
    return {kind: 'development', summary: 'No host readback', rows: [],
      line: 'No host readback: the development browser discloses no owner configuration, so no owner is stated as admitted, excluded or failed.'}
  }
  if (error) {
    return {kind: 'unread', summary: 'Owners not read', rows: [],
      line: `The owner configuration could not be read (${error}); no owner is stated.`}
  }
  if (!config) {
    return {kind: 'pending', summary: 'Reading owners', rows: [], line: 'Reading owner admission from the host.'}
  }

  const admitted = new Set(strings(config.product_ids) ?? [])
  const universe = strings(config.suite_product_ids)
  const contributions = Array.isArray(config.contributions) ? config.contributions : []

  const owners: string[] = []
  const add = (owner: string) => {if (!owners.includes(owner)) owners.push(owner)}
  ;(universe ?? []).forEach(add)
  admitted.forEach(add)
  for (const row of contributions) if (row.owner !== SHELL_OWNER || row.registration === 'failed') add(row.owner)

  const rows: OwnerReadbackRow[] = owners.map(owner => {
    const failure = contributions.find(row => row.owner === owner && row.registration === 'failed')
    const state: OwnerState = failure ? 'failed'
      : admitted.has(owner) ? 'admitted'
      : !universe ? 'undisclosed'
      : universe.includes(owner) ? 'excluded-by-footprint'
      : 'absent'
    const first = contributions.find(row => row.owner === owner)
    const why: Record<OwnerState, string> = {
      admitted: 'the selected backing admits it',
      'excluded-by-footprint': 'the footprint offers it, and the selected backing does not admit it',
      failed: failure?.failure ? `the host's registration failed: ${failure.failure}` : 'the host\'s registration failed',
      absent: first && first.compiled === false ? 'not compiled into this build' : 'the footprint does not offer it',
      undisclosed: 'the host did not disclose the suite product universe',
    }
    const remedy = state === 'admitted' ? null : NO_REMEDY
    const line = `${owner} · ${LABEL[state]} — ${why[state]}.${remedy ? ` Remedy: ${remedy}.` : ''}`
    return {owner, state, label: LABEL[state], line, remedy}
  })

  const admittedCount = rows.filter(row => row.state === 'admitted').length
  const summary = rows.length ? `${admittedCount} of ${rows.length} owners admitted` : 'No owner disclosed'
  const tail = universe ? '' : ' The host did not disclose the suite product universe.'
  return {kind: 'native', summary, rows,
    line: `Owners named by the host: ${admittedCount} admitted of ${rows.length}.${tail}`}
}

/** The owner readback in the status region, beside the run context, in every mode. */
export function OwnerReadback({native, config, error}: OwnerReadbackInput) {
  const reading = ownerReadbackOf({native, config, error})
  return <span className="statusbar-counts owner-readback" data-region="owner-readback"
    data-owner-readback={reading.kind} role="group" aria-label={reading.line} title={reading.line}>
    <span className="owner-readback-summary">{reading.summary}</span>
    {reading.rows.map(row => <span key={row.owner} className="owner-readback-row" data-owner={row.owner}
      data-owner-state={row.state} title={row.line}>{`${row.owner} · ${row.label}`}</span>)}
  </span>
}
