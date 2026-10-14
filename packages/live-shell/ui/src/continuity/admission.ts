/**
 * The candidate's first-run apply of the owner-admitted everyday continuity
 * (LEGACY-CRADLE-RETIREMENT §4.1). The native host verifies each admission
 * (native_shell continuity_admission.rs) and hands over only verified records. This
 * module applies them to the candidate namespace with localStorage, by the recorded
 * policy, and confirms once. It is pure over a Storage-shaped store and a native
 * reader, so the apply is testable without WebKit.
 *
 * Rules, all of which the tests pin:
 * - Default policy writes only into an empty candidate namespace. A key already holding
 *   the admitted value is left as it is (a retry after an interrupted apply). Any other
 *   key under the namespace refuses by name and nothing is written.
 * - Owner-replace copies every existing candidate key into a preserved snapshot first,
 *   verifies each copy, records a manifest last, and only then writes. The snapshot is
 *   keyed by the admission digest, so a retry reuses the snapshot taken before any write
 *   instead of copying a half-applied state.
 * - The workspace book is written last, so its presence means the other records landed.
 * - A failure after the first write blocks the workspace mount (the caller's gate), so
 *   nothing reads or overwrites a partial apply. A refusal writes nothing and the
 *   candidate starts with its own data.
 */

export const ADMISSION_NAMESPACE = 'oi.live-shell.candidate.workspace.v2'
const CANDIDATE_PREFIX = 'oi.live-shell.candidate.'
const DRAFT_PREFIX = 'oi-cradle.draft.v1:'
export const POLICY_EMPTY = 'apply-when-candidate-namespace-empty'
export const POLICY_PRESERVE = 'apply-after-preserving-candidate-namespace'
export const PRESERVED_SCHEMA = 'oi.live-shell.candidate.preserved/v1'

export interface AdmittedRecord {
  class: string
  target_key: string
  text: string
  text_sha256: string
}

export interface VerifiedAdmission {
  status: 'verified'
  admission: string
  bundle_digest_sha256: string
  adoption_sha256: string
  apply_policy: string
  owner_replace: boolean
  candidate_keys_present: string[]
  records: AdmittedRecord[]
}

/** What the native host reads from the candidate's data home. */
export type PendingAdmission =
  | {status: 'none'}
  | {status: 'refused'; admission: string; reason: string}
  | VerifiedAdmission

export interface AdmissionConfirmation {
  admission: string
  applied: number
  preserved: string | null
}

export type AdmissionOutcome =
  | {status: 'none'}
  | {status: 'refused'; admission: string; reason: string}
  | {status: 'applied'; admission: string; records: number; written: number; preserved: string | null; confirmed: boolean}
  /** The apply stopped. `written` counts admitted records already written: with none, the namespace is as it was and the
   * workspace mounts; with some, the workspace is held until the owner chooses to start without the admission. */
  | {status: 'failed'; admission: string; reason: string; written: number}

/** The Storage subset the apply uses; a fake satisfies it in tests. */
export interface AdmissionStore {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AdmissionDeps {
  store: AdmissionStore
  namespace?: string
  read: () => Promise<PendingAdmission>
  confirm: (confirmation: AdmissionConfirmation) => Promise<void>
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function keysOf(store: AdmissionStore): string[] {
  const keys: string[] = []
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (key !== null) keys.push(key)
  }
  return keys.sort()
}

/** Whether a key is one the admission may write: the candidate namespace or a shared draft. */
function migratedTarget(key: string): boolean {
  return key.startsWith(CANDIDATE_PREFIX) || key.startsWith(DRAFT_PREFIX)
}

/**
 * Copies the present candidate keys into a preserved snapshot, verifies every copy, and
 * records the manifest last. An existing manifest is reused after its copies are verified.
 */
async function preserveNamespace(
  store: AdmissionStore,
  manifestKey: string,
  present: string[],
  admission: VerifiedAdmission,
): Promise<string> {
  const existing = store.getItem(manifestKey)
  if (existing !== null) {
    const manifest = JSON.parse(existing) as {schema?: unknown; entries?: {copy_key: string; text_sha256: string}[]}
    if (manifest.schema !== PRESERVED_SCHEMA || !Array.isArray(manifest.entries)) throw new Error('The preserved snapshot manifest is not readable; nothing is written')
    for (const entry of manifest.entries) {
      const copy = store.getItem(entry.copy_key)
      if (copy === null || await sha256Hex(copy) !== entry.text_sha256) throw new Error(`The preserved copy ${entry.copy_key} does not match its record; nothing is written`)
    }
    return manifestKey
  }
  const entries: {source_key: string; copy_key: string; text_sha256: string}[] = []
  for (const key of present) {
    const value = store.getItem(key)
    if (value === null) continue
    const copyKey = `${manifestKey}:${key}`
    store.setItem(copyKey, value)
    if (store.getItem(copyKey) !== value) throw new Error(`The preserved copy of ${key} did not verify; nothing is written`)
    entries.push({source_key: key, copy_key: copyKey, text_sha256: await sha256Hex(value)})
  }
  store.setItem(manifestKey, JSON.stringify({
    schema: PRESERVED_SCHEMA,
    admission: admission.admission,
    bundle_digest_sha256: admission.bundle_digest_sha256,
    entries,
    standing: 'Candidate namespace copied before an owner-replace admission; the copies are not deleted by the candidate.',
  }))
  if (store.getItem(manifestKey) === null) throw new Error('The preserved snapshot manifest did not write; nothing is written')
  return manifestKey
}

/** Applies one verified admission to the store. Returns a refusal before any write. */
export async function applyVerifiedAdmission(
  store: AdmissionStore,
  namespace: string,
  admission: VerifiedAdmission,
): Promise<AdmissionOutcome> {
  const refuse = (reason: string): AdmissionOutcome => ({status: 'refused', admission: admission.admission, reason})
  let written = 0
  try {
    for (const record of admission.records) {
      if (!migratedTarget(record.target_key)) return refuse(`${record.target_key} is not a continuity key; nothing is written`)
      if (await sha256Hex(record.text) !== record.text_sha256) return refuse(`The admitted text digest differs for ${record.target_key}; nothing is written`)
    }
    const targets = new Map(admission.records.map(record => [record.target_key, record]))
    const present = keysOf(store).filter(key => key.startsWith(CANDIDATE_PREFIX) || targets.has(key))
    const conflicts = present.filter(key => targets.get(key)?.text !== store.getItem(key))
    if (admission.apply_policy === POLICY_EMPTY) {
      if (conflicts.length) return refuse(`The candidate namespace already holds ${conflicts.length} key(s) (first: ${conflicts[0]}); the admission applies only to an empty namespace. Nothing is written.`)
    } else if (admission.apply_policy === POLICY_PRESERVE) {
      if (!admission.owner_replace) return refuse('The admission applies over existing candidate data only with owner-replace; nothing is written.')
    } else {
      return refuse('The admission names an unrecognised apply policy; nothing is written.')
    }
    let preserved: string | null = null
    if (admission.apply_policy === POLICY_PRESERVE) {
      const digest16 = admission.admission.replace(/^admission-/, '')
      preserved = await preserveNamespace(store, `${namespace}.preserved.${digest16}`, present, admission)
    }
    // Non-book records first; the workspace book last, so its presence means the rest landed.
    const ordered = [...admission.records.filter(r => r.class !== 'workspace-book'), ...admission.records.filter(r => r.class === 'workspace-book')]
    for (const record of ordered) {
      if (store.getItem(record.target_key) === record.text) continue
      store.setItem(record.target_key, record.text)
      written++
      if (store.getItem(record.target_key) !== record.text) throw new Error(`${record.target_key} did not hold the admitted value after its write`)
    }
    return {status: 'applied', admission: admission.admission, records: admission.records.length, written, preserved, confirmed: false}
  } catch (error) {
    const where = written
      ? `${written} admitted record(s) were written before it stopped; the next start re-verifies and retries`
      : 'nothing admitted was written, so the workspace is as it was; the next start retries'
    return {status: 'failed', admission: admission.admission, written, reason: `The admitted continuity could not be applied (${messageOf(error)}): ${where}.`}
  }
}

/**
 * The startup apply: read the native verdict, apply by policy, then confirm once. A
 * confirm failure after writes is a failure, so the workspace stays held and the next
 * start re-verifies, finds the values already in place, and confirms.
 */
export async function applyPendingAdmission(deps: AdmissionDeps): Promise<AdmissionOutcome> {
  try {
    const pending = await deps.read()
    if (pending.status === 'none') return {status: 'none'}
    if (pending.status === 'refused') return {status: 'refused', admission: pending.admission, reason: pending.reason}
    const applied = await applyVerifiedAdmission(deps.store, deps.namespace ?? ADMISSION_NAMESPACE, pending)
    if (applied.status !== 'applied') return applied
    try {
      await deps.confirm({admission: pending.admission, applied: pending.records.length, preserved: applied.preserved})
    } catch (error) {
      return {status: 'failed', admission: pending.admission, written: Math.max(applied.written, 1), reason: `The admitted records are in place but APPLIED could not be recorded (${messageOf(error)}). The next start re-verifies the values in place and confirms.`}
    }
    return {...applied, confirmed: true}
  } catch (error) {
    // Nothing is written before the read answers, so a read failure never holds the workspace.
    return {status: 'failed', admission: '', written: 0, reason: `The owner-admitted continuity could not be read (${messageOf(error)}); nothing was applied, and the next start reads it again.`}
  }
}

/** The one-time status line for an outcome; null when there is nothing to report. */
export function admissionReport(outcome: AdmissionOutcome): string | null {
  switch (outcome.status) {
    case 'none': return null
    case 'refused': return `Owner-admitted continuity was not applied (${outcome.admission}): ${outcome.reason}`
    case 'failed': return outcome.reason
    case 'applied': {
      const already = outcome.records - outcome.written
      const preserved = outcome.preserved ? ` The earlier candidate data is preserved under ${outcome.preserved}.` : ''
      return `Applied the owner-admitted continuity: ${outcome.records} record(s), ${outcome.written} written, ${already} already in place.${preserved}`
    }
  }
}
