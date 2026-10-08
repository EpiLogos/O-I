import type {EncounterReading} from '../../../../../desktop/cradle/src/encounter/client'
import type {EncounterSessionBinding} from '../../../../../desktop/cradle/src/encounter/session'

/** A disclosed destination, supplied by the retained Workbench; never inferred
 * from the selected source or the roster displayed alongside it. */
export interface NativePreparedContextScope {
  workspaceId: string
  accessEpoch: number
  project: string
  sourceWorldRef?: string
  accompanying?: {project: string; ref: string; space: string}
}
export function preparedContextScopeKey(scope: NativePreparedContextScope): string {
  if (!scope.workspaceId || !Number.isSafeInteger(scope.accessEpoch) || scope.accessEpoch < 0 || typeof scope.project !== 'string'
    || (scope.sourceWorldRef !== undefined && !scope.sourceWorldRef.trim())) throw new Error('The native context destination is unavailable.')
  const binding = scope.accompanying
  if (binding && (binding.project !== scope.project || !binding.ref.trim() || !binding.space.trim())) throw new Error('The retained conversation belongs to another context destination.')
  return JSON.stringify([scope.workspaceId, scope.accessEpoch, scope.sourceWorldRef ?? null, scope.project, binding?.ref ?? null, binding?.space ?? null])
}
export function preparedContextSession(scope: NativePreparedContextScope): EncounterSessionBinding | undefined {
  preparedContextScopeKey(scope)
  return scope.accompanying ? {...scope.accompanying, sourceWorldRef: scope.sourceWorldRef} : undefined
}
export function preparedContextCurrent(scope: NativePreparedContextScope, capturedKey: string, current: () => boolean, mounted: boolean, visible: boolean): boolean {
  if (!mounted || !visible || !current()) return false
  try { return preparedContextScopeKey(scope) === capturedKey }
  catch { return false }
}
export type DeliveredContextReceipt = NonNullable<EncounterReading['prepared_context_receipts']>[number]
/** This validates a read, never promotes prepared material into a delivered
 * receipt or turns delivery into completion/recognition. Missing disclosure is
 * distinct from an owner's explicit empty receipt list. */
export function readDeliveredContext(scope: NativePreparedContextScope, value: unknown): readonly DeliveredContextReceipt[] | undefined {
  const binding = preparedContextSession(scope)
  if (!binding || value === undefined) return undefined
  if (!value || typeof value !== 'object' || (value as EncounterReading).agent_session !== binding.ref) throw new Error('The context receipts belong to another native conversation.')
  const receipts = (value as EncounterReading).prepared_context_receipts
  if (receipts === undefined) return undefined
  if (!Array.isArray(receipts)) throw new Error('The native delivered-context reading is malformed.')
  for (const receipt of receipts) {
    if (!receipt || !Number.isSafeInteger(receipt.cursor) || receipt.cursor < 0 || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0
      || typeof receipt.digest !== 'string' || !receipt.digest.startsWith('blake3:') || receipt.digest.length <= 7
      || typeof receipt.standing !== 'string' || !Array.isArray(receipt.items)) throw new Error('The native delivered-context receipt is malformed.')
    const ids = new Set<string>()
    for (const item of receipt.items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string'
        || typeof item.source_ref !== 'string' || !item.source_ref || (item.source_revision !== undefined && typeof item.source_revision !== 'string')) throw new Error('The native delivered-context item is malformed.')
      ids.add(item.id)
    }
  }
  return receipts
}
