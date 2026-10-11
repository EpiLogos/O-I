import {ListingStore} from '../../../../../desktop/cradle/src/files/listingStore'
import {acquireFileReading, acquireFileBytes, peekFileReading, applyReceipt, releaseFileResourceScope, releaseFileResource,
  fileResourceScopeKey, invalidateFile, type FileResourceAccess} from '../../../../../desktop/cradle/src/files/resources'
import type {CentralLocation, KernelReceipt, NativeFileReading} from '../../../../../desktop/cradle/src/kernel/types'

export const CANDIDATE_WARM_WORKSPACE_LIMIT = 3
/** Disposable source readings follow the candidate's warm workspace budget;
 * native buffers, bindings and dirty work remain with their existing owners. */
export function retainSourceReading(readings: ReadonlyMap<string, NativeFileReading>, workspaceId: string, reading: NativeFileReading): ReadonlyMap<string, NativeFileReading> {
  const next = new Map(readings)
  next.delete(workspaceId)
  next.set(workspaceId,reading)
  while (next.size > CANDIDATE_WARM_WORKSPACE_LIMIT) next.delete(next.keys().next().value!)
  return next
}

export interface ResourceIntent {
  workspaceId: string
  viewId: string
  generation: number
  /** Tests the captured origin, subject and intent; never today's destination. */
  isCurrent: () => boolean
}
/** Projection lifetime above disposable browser/pane components. Separate
 * imported listing instances preserve A→B→A without weakening their guards. */
export class ContinuityResources {
  private access: FileResourceAccess | null = null
  private scopeKey: string | null = null
  private listings = new Map<string, ListingStore>()
  private readings = new Map<string,CentralLocation>()
  hasAccess(): boolean {return this.access !== null && this.scopeKey !== null}
  attach(access: FileResourceAccess): void {
    const next = fileResourceScopeKey(access.transport,access.scope)
    if (next === this.scopeKey) return
    this.retire()
    this.access = {transport: {...access.transport}, scope: {...access.scope}}
    this.scopeKey = next
  }
  retire(): void {
    if (this.access) releaseFileResourceScope(this.access)
    for (const listing of this.listings.values()) listing.setActiveWorkspace(`retired:${crypto.randomUUID()}`)
    this.listings.clear()
    this.readings.clear()
    this.access = null
    this.scopeKey = null
  }
  private captured(intent: ResourceIntent) {
    if (!this.access || !this.scopeKey) throw Error('No current native resource access is attached')
    if (!intent.workspaceId || !intent.viewId || !Number.isSafeInteger(intent.generation) || intent.generation < 0 || !intent.isCurrent()) throw Error('The originating resource intent is unavailable')
    return {access: this.access, key: this.scopeKey}
  }
  private qualify(key: string, intent: ResourceIntent): void {
    if (key !== this.scopeKey || !intent.isCurrent()) throw Error('The resource result belongs to a retired access or view intent')
  }
  private remember(location: CentralLocation): void {
    const key = location.ref || `${location.root}:${location.path}`
    this.readings.delete(key)
    this.readings.set(key,location)
    while (this.readings.size > 64 && this.access) {
      const oldest = this.readings.keys().next().value as string
      releaseFileResource(this.readings.get(oldest)!,this.access)
      this.readings.delete(oldest)
    }
  }
  async read(location: CentralLocation, intent: ResourceIntent) {
    const captured = this.captured(intent)
    const reading = await acquireFileReading(captured.access.transport,location,captured.access.scope)
    this.qualify(captured.key,intent)
    this.remember(location)
    return reading
  }
  async bytes(location: CentralLocation, intent: ResourceIntent) {
    const captured = this.captured(intent)
    const reading = await acquireFileBytes(captured.access.transport,location,captured.access.scope)
    this.qualify(captured.key,intent)
    this.remember(location)
    return reading
  }
  peek(location: CentralLocation) { return this.access ? peekFileReading(location,this.access) : undefined }
  async revalidate(location: CentralLocation, intent: ResourceIntent) {
    const captured = this.captured(intent)
    invalidateFile(location,captured.access)
    return this.read(location,intent)
  }
  directory(workspaceId: string): ListingStore {
    if (!this.access || !this.scopeKey || !workspaceId) throw Error('Directory reading requires the native scope and originating workspace')
    const held = this.listings.get(workspaceId)
    if (held) {this.listings.delete(workspaceId); this.listings.set(workspaceId,held); return held}
    const listing = new ListingStore()
    listing.setActiveWorkspace(`${this.scopeKey}:${workspaceId}`)
    this.listings.set(workspaceId,listing)
    while (this.listings.size > CANDIDATE_WARM_WORKSPACE_LIMIT) {
      const oldest = this.listings.keys().next().value as string
      this.listings.get(oldest)!.setActiveWorkspace(`retired:${crypto.randomUUID()}`)
      this.listings.delete(oldest)
    }
    return listing
  }
  ensureDirectory(workspaceId: string, path: string, fresh = false): ListingStore {
    const listing = this.directory(workspaceId)
    listing.ensure(this.access!.transport,path,fresh)
    return listing
  }
  receipt(receipt: KernelReceipt): boolean {
    if (!this.access || !applyReceipt(receipt,this.access)) return false
    if (typeof receipt.path === 'string') for (const listing of this.listings.values()) listing.invalidateParentOf(receipt.path)
    return true
  }
}
export type {FileResourceAccess}
