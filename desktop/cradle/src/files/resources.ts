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
 * known. Path alone or workspace alone is never a key.
 *
 * Coherence: equivalent concurrent acquisitions join one in-flight read;
 * each entry carries a generation that invalidation bumps, and a read
 * publishes only into the generation it started in — a late older
 * completion cannot replace a newer state (the stale-result law, C12).
 */

import {readFile, readFileBytes} from "./client";
import type {CentralLocation, KernelTransportStatus, NativeFileBytes, NativeFileReading} from "../kernel/types";

interface FileEntry<Reading> {
  status: "loading" | "ready" | "error";
  reading?: Reading;
  revision?: string;
  error?: string;
  /** Bumped on every ensure/invalidation; in-flight reads publish only when
   * their captured generation still matches. */
  generation: number;
  inflight: Promise<Reading> | null;
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
let counters: ResourceCounters = {...EMPTY_COUNTERS};
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

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeResources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cache-only observation — what is already resident, never a reason to
 * read. A `ready` entry here is an allowed last reading, not a fresh grant. */
export function peekFileReading(location: CentralLocation): NativeFileReading | undefined {
  return textEntries.get(locationKey(location))?.reading;
}

export function peekFileBytes(location: CentralLocation): NativeFileBytes | undefined {
  return byteEntries.get(locationKey(location))?.reading;
}

export function resourceStats(): ResourceCounters {
  return {...counters};
}

function entryMap<Reading>(binary: boolean): Map<string, FileEntry<Reading>> {
  return (binary ? byteEntries : textEntries) as Map<string, FileEntry<Reading>>;
}

/** Drop one file's resident readings (both operation classes — a write can
 * change either view of the same subject). Receipt-driven invalidation and
 * explicit refresh land here; the entry tombstones to `loading` so a mounted
 * consumer re-reads while any last reading it already held stays visible to
 * it (BOOT-14's law, kept by the consumer, not by a fake freshness claim). */
export function invalidateFile(location: CentralLocation) {
  const key = locationKey(location);
  let dropped = false;
  for (const entries of [textEntries as Map<string, FileEntry<never>>, byteEntries as Map<string, FileEntry<never>>]) {
    const held = entries.get(key);
    if (!held) continue;
    entries.set(key, {...held, status: "loading", generation: held.generation + 1, inflight: null});
    dropped = true;
  }
  if (dropped) {
    counters.invalidations += 1;
    emit();
  }
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
  if (held?.status === "ready") {
    counters.cache_hits += 1;
    emit();
    return held.reading as Reading;
  }
  const generation = held?.generation ?? 0;
  const inflight = read(transport, location);
  entries.set(key, {status: "loading", reading: held?.reading, revision: held?.revision, generation, inflight});
  counters.acquisitions += 1;
  emit();
  try {
    const reading = await inflight;
    const current = entries.get(key);
    if (!current || current.generation !== generation) {
      counters.stale_dropped += 1;
    } else {
      entries.set(key, {status: "ready", reading, revision: reading.revision, generation, inflight: null});
    }
    return reading;
  } catch (error) {
    const current = entries.get(key);
    if (current && current.generation === generation) {
      entries.set(key, {status: "error", error: String(error), reading: current.reading, revision: current.revision, generation, inflight: null});
    }
    throw error;
  } finally {
    emit();
  }
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
