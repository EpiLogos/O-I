/**
 * The shared file-resource broker (workspace-continuity WF2, contract frozen
 * 2026-09-19 from `docs/experience/WORKSPACE-CONTINUITY.md` §2/§4).
 *
 * ONE owner-mediated acquisition per resource, shared by every consumer —
 * the open path (CradleFrame), the admission prerequisite (mountSurface)
 * and the renderer (MaterialSurface / FileSurface) — instead of today's
 * separate read paths. The kernel/Central stays the state owner: the broker
 * is a bounded projection around the existing `files/client` readers; it
 * grants no authority a real read did not obtain, and a cached reading is
 * never current authority by itself (revalidation stays with the owner).
 *
 * Identity: a key carries the transport epoch (kind + URL — a reconnect or
 * a different bridge is a different access scope), the operation class
 * (UTF-8 reading vs binary bytes — never deduplicated across the two), and
 * the owner's canonical ref, falling back to root+path only when no ref is
 * known. Path alone or workspace alone is never a key. Entries record the
 * location they were acquired under, so invalidation and peeks find a
 * subject by ref or path across the epoch-scoped keys.
 *
 * Coherence: equivalent concurrent acquisitions join one in-flight read;
 * each entry carries a generation that invalidation bumps, and a read
 * publishes only into the generation it started in — a late older
 * completion cannot replace a newer state (the stale-result law, C12).
 * Kernel receipts land in `applyReceipt`: a `file_changed` receipt drops
 * the changed file's readings, deduped by seq like the tree's own feed.
 */

import {readFile, readFileBytes, fileOperation, type FilePreview} from "./client";
import type {CentralLocation, KernelTransportStatus, NativeFileBytes, NativeFileReading} from "../kernel/types";

interface FileEntry<Reading> {
  status: "loading" | "ready" | "error";
  reading?: Reading;
  revision?: string;
  error?: string;
  /** The location the entry was acquired under — receipts name a bare path,
   * so invalidation matches subjects, not one key spelling. */
  location: CentralLocation;
  scopeKey: string;
  /** Bumped on every ensure/invalidation; in-flight reads publish only when
   * their captured generation still matches. */
  generation: number;
  inflight: Promise<Reading> | null;
}

/** Supplied by the host when an owner connection or access grant changes.
 * URL alone cannot identify a reconnect, World, workcell or authority epoch. */
export interface FileResourceScope { owner: string; world: string; workcell: string; accessEpoch: string }
export interface FileResourceAccess { transport: KernelTransportStatus; scope: FileResourceScope }
let hostManaged = false;
let hostAccess: FileResourceAccess | null = null;
let hostCurrent: () => boolean = () => true;
let hostGeneration = 0;
/** Imported native views use the same host-qualified broker as the Browser.
 * An explicit caller scope remains authoritative; an absent host is never a
 * candidate fallback to the legacy unqualified cache. */
export function configureFileResourceHost(access: FileResourceAccess | null, current: () => boolean = () => false): void {
  if (access) fileResourceScopeKey(access.transport,access.scope);
  hostManaged = true; ++hostGeneration;
  hostAccess = access ? {transport:{...access.transport},scope:{...access.scope}} : null;
  hostCurrent = current;
  emit();
}
export function fileResourceHostGeneration(): number { return hostGeneration; }
export function captureFileResourceAccess(transport: KernelTransportStatus): {access?: FileResourceAccess; current: () => boolean} {
  if (!hostManaged) return {current: () => true};
  if (!hostAccess || !hostCurrent() || JSON.stringify(transport) !== JSON.stringify(hostAccess.transport)) throw new StaleFileAcquisition();
  const access = hostAccess, generation = hostGeneration;
  return {access, current: () => generation === hostGeneration && hostCurrent()};
}
export class StaleFileAcquisition extends Error { constructor() { super("The file acquisition belongs to a retired resource generation"); this.name = "StaleFileAcquisition"; } }
export function fileResourceScopeKey(transport: KernelTransportStatus, scope?: FileResourceScope): string {
  const transportKey = transportEpoch(transport);
  if (!scope) return transportKey;
  if ([scope.owner,scope.world,scope.workcell,scope.accessEpoch].some(value => typeof value !== "string" || !value || value.length > 4096)) throw Error("A resource needs an explicit bounded owner, World, workcell and access epoch");
  return JSON.stringify([transportKey,scope.owner,scope.world,scope.workcell,scope.accessEpoch]);
}

interface ResourceCounters {
  /** Owner round trips this broker actually started. */
  acquisitions: number;
  /** Acquisitions that joined an equivalent in-flight read. */
  joined: number;
  /** Acquisitions served from a resident ready reading. */
  cache_hits: number;
  invalidations: number;
  /** Generations dropped on the floor by the stale guard. */
  stale_dropped: number;
}

const EMPTY_COUNTERS: ResourceCounters = {acquisitions: 0, joined: 0, cache_hits: 0, invalidations: 0, stale_dropped: 0};

const textEntries = new Map<string, FileEntry<NativeFileReading>>();
const byteEntries = new Map<string, FileEntry<NativeFileBytes>>();
interface PreviewReading {revision:string;location:CentralLocation;preview:FilePreview}
const previewEntries = new Map<string, FileEntry<PreviewReading>>();
type ResourceClass = boolean | "preview";
let counters: ResourceCounters = {...EMPTY_COUNTERS};
let resourceGeneration = 0;
let activeOwnerReads = 0;
const ownerReadQueue: Array<() => void> = [];
function boundedOwnerRead<Reading>(run:()=>Promise<Reading>):Promise<Reading> {
  if(ownerReadQueue.length>=64)return Promise.reject(Error("The native file read budget is full; recoverable work was retained"));
  return new Promise((resolve,reject)=>{
    const start=()=>{
      ++activeOwnerReads;
      void Promise.resolve().then(run).then(resolve,reject).finally(()=>{
        --activeOwnerReads;
        while(activeOwnerReads<2&&ownerReadQueue.length)ownerReadQueue.shift()!();
      });
    };
    if(activeOwnerReads<2)start();else ownerReadQueue.push(start);
  });
}
export function resourceResidencyStats() {return {activeOwnerReads,queuedOwnerReads:ownerReadQueue.length,textEntries:textEntries.size,byteEntries:byteEntries.size,previewEntries:previewEntries.size,listeners:listeners.size};}
const listeners = new Set<() => void>();

/** The access scope of one transport: a reconnect or a different bridge URL
 * is a different epoch — entries from an older epoch never answer for it. */
function transportEpoch(transport: KernelTransportStatus): string {
  return transport.kind === "bridge" ? `bridge:${transport.url}` : transport.kind;
}

/** The owner identity of one location: the canonical ref when the owner has
 * disclosed one, else the scoped path. Never the path alone. */
function locationKey(location: CentralLocation): string {
  return location.ref || `${location.root}:${location.path}`;
}

/** Whether two locations name the same owner subject: the canonical ref
 * when both carry one (or the same root+path beneath those refs), the path
 * when one side is a receipt's path-only name. */
function sameSubject(a: CentralLocation | undefined, b: CentralLocation): boolean {
  if (!a) return false;
  if (a.ref && b.ref) return a.ref === b.ref;
  return a.path === b.path && (!a.root || !b.root || a.root === b.root);
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeResources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keys are epoch-scoped, so subject lookup scans the resident set — small
 * by construction (the open files' entries, not the tree). */
function findEntry<Reading>(binary: boolean, location: CentralLocation, access?: FileResourceAccess): FileEntry<Reading> | undefined {
  access ??= hostManaged ? hostAccess ?? undefined : undefined;
  if (hostManaged && !access) return undefined;
  const scopeKey = access ? fileResourceScopeKey(access.transport,access.scope) : undefined;
  const matches = [...entryMap<Reading>(binary).values()].filter(held =>
    sameSubject(held.location,location) && (scopeKey !== undefined ? held.scopeKey === scopeKey : !held.scopeKey.startsWith("[")));
  // The compatibility peek never selects arbitrarily between owner epochs.
  return matches.length === 1 ? matches[0] : undefined;
}

/** Cache-only observation — what is already resident, never a reason to
 * read. A `ready` entry here is an allowed last reading, not a fresh grant. */
export function peekFileReading(location: CentralLocation, access?: FileResourceAccess): NativeFileReading | undefined {
  return findEntry<NativeFileReading>(false, location,access)?.reading;
}

export function peekFileBytes(location: CentralLocation, access?: FileResourceAccess): NativeFileBytes | undefined {
  return findEntry<NativeFileBytes>(true, location,access)?.reading;
}

/** Cache-only full-entry observation — the status and any error beside the
 * reading (C10's law made inspectable); never a reason to read. */
export function peekFileState(location: CentralLocation, access?: FileResourceAccess): {status: FileEntry<NativeFileReading>["status"]; reading?: NativeFileReading; error?: string} | undefined {
  const held = findEntry<NativeFileReading>(false, location,access);
  return held ? {status: held.status, reading: held.reading, error: held.error} : undefined;
}

export function resourceStats(): ResourceCounters {
  return {...counters};
}

function entryMap<Reading>(binary: ResourceClass): Map<string, FileEntry<Reading>> {
  return (binary === "preview" ? previewEntries : binary ? byteEntries : textEntries) as Map<string, FileEntry<Reading>>;
}

/** Drop one file's resident readings (both operation classes — a write can
 * change either view of the same subject, and the change is epoch-
 * independent). Receipt-driven invalidation and explicit refresh land here;
 * the entry tombstones to `loading` so a mounted consumer re-reads while any
 * last reading it already held stays visible to it (BOOT-14's law, kept by
 * the consumer, not by a fake freshness claim). */
export function invalidateFile(location: CentralLocation, access?: FileResourceAccess) {
  access ??= hostManaged ? hostAccess ?? undefined : undefined;
  if (hostManaged && !access) return;
  const scopeKey = access ? fileResourceScopeKey(access.transport,access.scope) : undefined;
  let dropped = false;
  for (const entries of [textEntries as Map<string, FileEntry<never>>, byteEntries as Map<string, FileEntry<never>>]) {
    for (const [key, held] of entries) {
      if (!sameSubject(held.location, location) || (scopeKey !== undefined && held.scopeKey !== scopeKey)) continue;
        entries.set(key, {...held, status: "loading", generation: ++resourceGeneration, inflight: null});
      dropped = true;
    }
  }
  if (dropped) {
    counters.invalidations += 1;
    emit();
  }
}

/** The latest receipt seq applied — deduped exactly like the tree's
 * useListingInvalidation cursor, so a replayed burst applies once. */
const appliedReceiptSeq = new Map<string,number>();

/** Receipt-driven invalidation, as a store function (the shell's kernel-
 * receipt feed subscribes through applyReceipt's own emit): a `file_changed`
 * receipt drops the changed file's readings; every other event is not this
 * broker's concern (expressions re-read through their own channel), and a
 * receipt whose path is not a plain string is ignored, not thrown on. */
export function applyReceipt(receipt: {event: string; path?: unknown; seq: number}, access?: FileResourceAccess): boolean {
  const receiptScope = access ? fileResourceScopeKey(access.transport,access.scope) : "legacy";
  if (receipt.event !== "file_changed") return false;
  if (typeof receipt.seq !== "number" || !Number.isFinite(receipt.seq) || receipt.seq <= (appliedReceiptSeq.get(receiptScope) ?? 0)) return false;
  appliedReceiptSeq.set(receiptScope,receipt.seq);
  if (typeof receipt.path !== "string" || receipt.path.length === 0) return false;
  invalidateFile({schema: "central.path-ref/v1", ref: "", root: "", path: receipt.path},access);
  return true;
}

async function acquire<Reading extends {revision: string; location: CentralLocation}>(
  transport: KernelTransportStatus,
  location: CentralLocation,
  binary: ResourceClass,
  read: (transport: KernelTransportStatus, location: CentralLocation) => Promise<Reading>,
  scope?: FileResourceScope,
  selector?: readonly string[],
): Promise<Reading> {
  const epoch = fileResourceScopeKey(transport,scope);
  const key = JSON.stringify([epoch,binary === "preview" ? "preview" : binary ? "bytes" : "text",locationKey(location),selector ?? null]);
  const entries = entryMap<Reading>(binary);
  const held = entries.get(key);
  if (held) { entries.delete(key); entries.set(key,held); }
  if (held?.inflight) {
    counters.joined += 1;
    emit();
    const reading = await held.inflight;
    if (scope && (!reading || typeof reading.revision !== "string" || !reading.revision || !sameSubject(reading.location,location))) throw Error("The native file reading does not match the requested subject and revision");
    if (scope && entries.get(key)?.generation !== held.generation) throw new StaleFileAcquisition();
    return reading;
  }
  if (held?.status === "ready") {
    counters.cache_hits += 1;
    emit();
    return held.reading as Reading;
  }
  const generation = ++resourceGeneration;
  if (scope && !held && entries.size >= 64) {
    const disposable = [...entries].find(([,entry]) => !entry.inflight);
    if (!disposable) throw Error('The native resource acquisition budget is full; existing work was retained');
    entries.delete(disposable[0]);
  }
  const inflight = boundedOwnerRead(()=>{
    if(entries.get(key)?.generation!==generation)throw new StaleFileAcquisition();
    if(scope&&hostManaged&&(!hostAccess||!hostCurrent()||fileResourceScopeKey(hostAccess.transport,hostAccess.scope)!==epoch))throw new StaleFileAcquisition();
    counters.acquisitions += 1;
    return read(transport,location);
  });
  entries.set(key, {status: "loading", reading: held?.reading, revision: held?.revision, location, scopeKey: epoch, generation, inflight});
  emit();
  try {
    const reading = await inflight;
    if (scope && (!reading || typeof reading.revision !== "string" || !reading.revision || !sameSubject(reading.location,location))) throw Error("The native file reading does not match the requested subject and revision");
    const current = entries.get(key);
    if (!current || current.generation !== generation) {
      counters.stale_dropped += 1;
      if (scope) throw new StaleFileAcquisition();
    } else {
      entries.set(key, {status: "ready", reading, revision: reading.revision, location, scopeKey: epoch, generation, inflight: null});
    }
    return reading;
  } catch (error) {
    const current = entries.get(key);
    if (current && current.generation === generation) {
      entries.set(key, {status: "error", error: String(error), reading: current.reading, revision: current.revision, location, scopeKey: epoch, generation, inflight: null});
    }
    throw error;
  } finally {
    emit();
  }
}

/** The one UTF-8 owner reading for `location`, shared across every consumer
 * of the same subject under the same access scope. */
export async function acquireFileReading(transport: KernelTransportStatus, location: CentralLocation, scope?: FileResourceScope): Promise<NativeFileReading> {
  const host = scope ? undefined : captureFileResourceAccess(transport);
  return acquire(transport, location, false, readFile,scope ?? host?.access?.scope).then(reading => {
    if (host && !host.current()) throw new StaleFileAcquisition();
    return reading;
  });
}

/** The one binary-safe owner reading (images, PDFs, dispositions). */
export async function acquireFileBytes(transport: KernelTransportStatus, location: CentralLocation, scope?: FileResourceScope): Promise<NativeFileBytes> {
  const host = scope ? undefined : captureFileResourceAccess(transport);
  return acquire(transport, location, true, readFileBytes,scope ?? host?.access?.scope).then(reading => {
    if (host && !host.current()) throw new StaleFileAcquisition();
    return reading;
  });
}

/** A held historical revision and its reviewed current basis are separate
 * selectors. Change receipts invalidate current reads, never this pin. The
 * public native owner still enforces restore against expected_revision. */
export async function acquireFilePreview(transport:KernelTransportStatus,location:CentralLocation,expected_revision:string,revision:string,scope?:FileResourceScope):Promise<FilePreview>{
  if([expected_revision,revision].some(value=>typeof value!=="string"||!value||value.length>4096))throw Error("A recovery preview needs the owner's bounded revision and review basis");
  const host=scope?undefined:captureFileResourceAccess(transport);
  const reading=await acquire(transport,location,"preview",async(native,subject)=>{
    const preview=await fileOperation<FilePreview>(native,subject,{action:"recovery_preview",expected_revision,revision});
    if(!preview||preview.revision!==revision||preview.expected_revision!==expected_revision||typeof preview.content!=="string"||typeof preview.current_content!=="string"||typeof preview.changed!=="boolean")throw Error("The recovery preview differs from the requested revision and review basis");
    return {revision,location:subject,preview};
  },scope??host?.access?.scope,[revision,expected_revision]);
  if(host&&!host.current())throw new StaleFileAcquisition();
  return reading.preview;
}

/** Retire trust before reconnect/revocation; held results cannot publish afterward. */
export function releaseFileResourceScope(access: FileResourceAccess): void {
  const key = fileResourceScopeKey(access.transport,access.scope);
  for (const entries of [textEntries,byteEntries,previewEntries]) for (const [entryKey,entry] of entries) if (entry.scopeKey === key) entries.delete(entryKey);
  appliedReceiptSeq.delete(key);
  emit();
}

/** Release only a reconstructible cache entry, never an owner working model. */
export function releaseFileResource(location: CentralLocation, access: FileResourceAccess): void {
  const key = fileResourceScopeKey(access.transport,access.scope);
  for (const entries of [textEntries,byteEntries,previewEntries]) for (const [entryKey,entry] of entries) if (entry.scopeKey === key && sameSubject(entry.location,location)) entries.delete(entryKey);
  emit();
}
