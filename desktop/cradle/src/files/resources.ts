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
 * Identity: a key carries the transport endpoint (kind + URL), the operation class
 * (UTF-8 reading vs binary bytes — never deduplicated across the two), and
 * the complete native schema/root/ref/path tuple. Cache-only peeks require
 * that same endpoint and tuple; receipt invalidation can name a bare path.
 * Resident text is a bounded last reading. Each later acquisition returns
 * to the owner for current access and content.
 *
 * Coherence: equivalent concurrent acquisitions join one in-flight read;
 * each entry carries a generation that invalidation bumps, and a read
 * publishes only into the generation it started in — a late older
 * completion cannot replace a newer state (the stale-result law, C12).
 * Kernel receipts land in `applyReceipt`: a `file_changed` receipt drops
 * the changed file's readings, deduped by seq like the tree's own feed.
 */

import {readFile, readFileBytes} from "./client";
import type {CentralLocation, KernelTransportStatus, NativeFileBytes, NativeFileReading} from "../kernel/types";

interface FileEntry<Reading> {
  status: "loading" | "ready" | "error";
  reading?: Reading;
  revision?: string;
  error?: string;
  /** The location the entry was acquired under — receipts name a bare path,
   * so invalidation matches subjects, not one key spelling. */
  location: CentralLocation;
  /** Bumped on every ensure/invalidation; in-flight reads publish only when
   * their captured generation still matches. */
  generation: number;
  inflight: Promise<Reading> | null;
  lastUse: number;
  scope: string;
  superseded: boolean;
  /** Consumer request ordering fences delayed failures, never owner authority. */
  requestOrder: number;
  admittedOrder?: number;
}

interface ResourceCounters {
  /** Owner round trips this broker actually started. */
  acquisitions: number;
  /** Acquisitions that joined an equivalent in-flight read. */
  joined: number;
  /** Cache-only presentation peeks served from a resident reading. */
  cache_hits: number;
  invalidations: number;
  /** Generations dropped on the floor by the stale guard. */
  stale_dropped: number;
}

const EMPTY_COUNTERS: ResourceCounters = {acquisitions: 0, joined: 0, cache_hits: 0, invalidations: 0, stale_dropped: 0};

const textEntries = new Map<string, FileEntry<NativeFileReading>>();
const byteEntries = new Map<string, FileEntry<NativeFileBytes>>();
let counters: ResourceCounters = {...EMPTY_COUNTERS};
const listeners = new Set<() => void>();
// The native retained-file owner uses 64 files / 32 MiB. This renderer
// projection additionally counts strings conservatively as UTF-16 payload.
const MAX_ENTRIES = 64;
const MAX_PAYLOAD_BYTES = 32 * 1024 * 1024;
let lastUse = 0;
let requestOrder = 0;
const pendingReads = new Set<FileEntry<unknown>>();
function payloadBytes(reading: unknown): number {
  const value = reading as {content?: string; content_base64?: string} | undefined;
  return 2 * ((value?.content?.length ?? 0) + (value?.content_base64?.length ?? 0));
}
function trimResident() {
  const held = [...[...textEntries.entries()].map(([key, value]) => ({map: textEntries, key, value})),
    ...[...byteEntries.entries()].map(([key, value]) => ({map: byteEntries, key, value}))].sort((a, b) => a.value.lastUse - b.value.lastUse);
  let count = held.length, bytes = held.reduce((sum, entry) => sum + payloadBytes(entry.value.reading), 0);
  for (const entry of held) {
    if (count <= MAX_ENTRIES && bytes <= MAX_PAYLOAD_BYTES) break;
    entry.map.delete(entry.key); count--; bytes -= payloadBytes(entry.value.reading);
    entry.value.reading = undefined;
  }
}

/** Endpoint scope; a native bootstrap resets a lifetime at the same URL. */
function transportEpoch(transport: KernelTransportStatus): string {
  return transport.kind === "bridge" ? `bridge:${transport.url}` : transport.kind;
}

/** Keep the native owner root beside its ref/path. A ref never discards
 * the root qualification that the actual owner checks on every read. */
function locationKey(location: CentralLocation): string {
  return JSON.stringify([location.schema, location.root, location.ref, location.path]);
}

/** Whether two locations name the same owner subject: the canonical ref
 * when both carry one (or the same root+path beneath those refs), the path
 * when one side is a receipt's path-only name. */
function sameSubject(a: CentralLocation | undefined, b: CentralLocation, allowPathOnlyReceipt = false): boolean {
  if (!a) return false;
  // A native path-only change receipt deliberately invalidates every scoped
  // copy of that path. A qualified read/peek must match the owner root.
  if (!b.root || !a.root) return allowPathOnlyReceipt && !b.root && !b.ref && a.path === b.path;
  if (a.root !== b.root) return false;
  return a.schema === b.schema && a.ref === b.ref && a.path === b.path;
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
function findEntry<Reading>(transport: KernelTransportStatus, binary: boolean, location: CentralLocation): FileEntry<Reading> | undefined {
  if (!location.root) return undefined;
  const held = entryMap<Reading>(binary).get(`${transportEpoch(transport)}|${binary ? "bytes" : "text"}|${locationKey(location)}`);
  if (!held || !sameSubject(held.location, location)) return undefined;
  held.lastUse = ++lastUse;
  return held;
}

/** Cache-only observation — what is already resident, never a reason to
 * read. A `ready` entry here is an allowed last reading, not a fresh grant. */
export function peekFileReading(transport: KernelTransportStatus, location: CentralLocation): NativeFileReading | undefined {
  const reading = findEntry<NativeFileReading>(transport, false, location)?.reading;
  if (reading) counters.cache_hits++;
  return reading;
}

export function peekFileBytes(transport: KernelTransportStatus, location: CentralLocation): NativeFileBytes | undefined {
  const reading = findEntry<NativeFileBytes>(transport, true, location)?.reading;
  if (reading) counters.cache_hits++;
  return reading;
}

/** Cache-only full-entry observation — the status and any error beside the
 * reading (C10's law made inspectable); never a reason to read. */
export function peekFileState(transport: KernelTransportStatus, location: CentralLocation): {status: FileEntry<NativeFileReading>["status"]; reading?: NativeFileReading; error?: string} | undefined {
  const held = findEntry<NativeFileReading>(transport, false, location);
  return held ? {status: held.status, reading: held.reading, error: held.error} : undefined;
}

export function resourceStats(): ResourceCounters & {resident_entries: number; retained_payload_bytes: number} {
  return {...counters, resident_entries: textEntries.size + byteEntries.size,
    retained_payload_bytes: [...textEntries.values(), ...byteEntries.values()].reduce((sum, entry) => sum + payloadBytes(entry.reading), 0)};
}

function entryMap<Reading>(binary: boolean): Map<string, FileEntry<Reading>> {
  return (binary ? byteEntries : textEntries) as Map<string, FileEntry<Reading>>;
}

/** Drop one file's resident readings (both operation classes — a write can
 * change either view of the same subject, and the change is epoch-
 * independent). Receipt-driven invalidation and explicit refresh land here;
 * the entry tombstones to `loading` so a mounted consumer re-reads while any
 * last reading it already held stays visible to it (BOOT-14's law, kept by
 * the consumer, not by a fake freshness claim). */
export function invalidateFile(location: CentralLocation) {
  let dropped = false;
  for (const pending of pendingReads) if (sameSubject(pending.location, location, true)) pending.superseded = true;
  for (const entries of [textEntries as Map<string, FileEntry<never>>, byteEntries as Map<string, FileEntry<never>>]) {
    for (const [key, held] of entries) {
      if (!sameSubject(held.location, location, true)) continue;
      held.superseded = true;
      entries.set(key, {...held, status: "loading", generation: held.generation + 1, inflight: null, superseded: false});
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
const appliedReceiptSeq = new Map<string, number>();

/** A successful native bootstrap state read establishes this consumer's
 * owner lifetime. Old in-flight reads cannot publish into its new entries. */
export function beginResourceOwner(transport: KernelTransportStatus) {
  const scope = transportEpoch(transport);
  for (const pending of pendingReads) if (pending.scope === scope) pending.superseded = true;
  appliedReceiptSeq.delete(scope);
  for (const entries of [textEntries, byteEntries]) for (const key of entries.keys()) {
    if (key.startsWith(`${scope}|`)) entries.delete(key);
  }
  emit();
}

/** An owner refusal withdraws both resident representations. A delayed
 * failure cannot withdraw a reading admitted by a later request; local
 * ordering only fences delivery, and every admission still comes from the
 * native owner. Earlier pending responses are also no longer deliverable. */
function withdrawEarlierReadings(failed: FileEntry<unknown>) {
  const matches = (held: FileEntry<unknown>) => held.scope === failed.scope && sameSubject(held.location, failed.location);
  for (const pending of pendingReads) {
    if (pending !== failed && matches(pending) && pending.requestOrder <= failed.requestOrder) pending.superseded = true;
  }
  for (const entries of [textEntries, byteEntries]) for (const [key, held] of entries) {
    if (!matches(held)) continue;
    if ((held.admittedOrder ?? 0) <= failed.requestOrder) {
      held.reading = undefined; held.revision = undefined; held.admittedOrder = undefined;
    }
    if (held !== failed && held.requestOrder <= failed.requestOrder) entries.delete(key);
  }
}

/** Receipt-driven invalidation, as a store function (the shell's kernel-
 * receipt feed subscribes through applyReceipt's own emit): a `file_changed`
 * receipt drops the changed file's readings; every other event is not this
 * broker's concern (expressions re-read through their own channel), and a
 * receipt whose path is not a plain string is ignored, not thrown on. */
export function applyReceipt(transport: KernelTransportStatus, receipt: {event: string; path?: unknown; seq: number}) {
  if (receipt.event !== "file_changed") return;
  const scope = transportEpoch(transport);
  if (!Number.isSafeInteger(receipt.seq) || receipt.seq <= (appliedReceiptSeq.get(scope) ?? 0)) return;
  appliedReceiptSeq.delete(scope); appliedReceiptSeq.set(scope, receipt.seq);
  if (appliedReceiptSeq.size > MAX_ENTRIES) appliedReceiptSeq.delete(appliedReceiptSeq.keys().next().value!);
  if (typeof receipt.path !== "string" || receipt.path.length === 0) return;
  invalidateFile({schema: "central.path-ref/v1", ref: "", root: "", path: receipt.path});
}

async function acquire<Reading extends {revision: string}>(
  transport: KernelTransportStatus,
  location: CentralLocation,
  binary: boolean,
  read: (transport: KernelTransportStatus, location: CentralLocation) => Promise<Reading>,
): Promise<Reading> {
  const epoch = transportEpoch(transport);
  const key = `${epoch}|${binary ? "bytes" : "text"}|${locationKey(location)}`;
  const entries = entryMap<Reading>(binary);
  const held = entries.get(key);
  if (held?.inflight) {
    counters.joined += 1;
    emit();
    return held.inflight;
  }
  // A retained reading is presentation, not a renewable access grant. Later
  // acquisitions re-enter the native owner, including after a policy change.
  if (pendingReads.size >= MAX_ENTRIES) throw Error("Too many file reads are pending. Wait for an existing read to finish.");
  const generation = held?.generation ?? 0;
  const entry: FileEntry<Reading> = {status: "loading", reading: held?.reading, revision: held?.revision, admittedOrder: held?.admittedOrder, location, generation, inflight: null, lastUse: ++lastUse, scope: epoch, superseded: false, requestOrder: ++requestOrder};
  const inflight = (async () => {
    try {
      const reading = await read(transport, location);
      if (entry.superseded) {
        counters.stale_dropped++;
        throw Error("The file or its owner changed during this read. Read it again.");
      }
      if (entries.get(key) === entry) {
        entry.status = "ready"; entry.reading = reading; entry.revision = reading.revision;
        entry.admittedOrder = entry.requestOrder;
        entry.inflight = null; entry.lastUse = ++lastUse; trimResident();
      }
      // LRU eviction alone does not revoke a completed native reading from
      // its original consumer. Supersession above does, including for joiners.
      return reading;
    } catch (error) {
      if (!entry.superseded) withdrawEarlierReadings(entry);
      if (entries.get(key) === entry) {
        entry.status = "error"; entry.error = String(error).slice(0,8192);
        entry.reading = undefined; entry.revision = undefined; entry.inflight = null;
      }
      throw error;
    } finally {
      pendingReads.delete(entry); emit();
    }
  })();
  entry.inflight = inflight; pendingReads.add(entry); entries.set(key, entry);
  trimResident();
  counters.acquisitions += 1;
  emit();
  return inflight;
}

/** The one UTF-8 owner reading for `location`, shared across every consumer
 * of the same subject under the same access scope. */
export function acquireFileReading(transport: KernelTransportStatus, location: CentralLocation): Promise<NativeFileReading> {
  return acquire(transport, location, false, readFile);
}

/** The one binary-safe owner reading (images, PDFs, dispositions). */
export function acquireFileBytes(transport: KernelTransportStatus, location: CentralLocation): Promise<NativeFileBytes> {
  return acquire(transport, location, true, readFileBytes);
}
