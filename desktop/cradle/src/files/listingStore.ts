/**
 * The file tree's listing store — the retention law's cache tier for
 * directory listings (owner-approved 2026-09-19). The kernel stays the
 * state owner: every entry is one owner-verified `central.files.list`
 * reading, keyed by its path, and the store only decides how long a reading
 * stays admitted. Kernel receipts drive invalidation — a `file_changed`
 * receipt drops the changed file's PARENT listing (the one listing a write
 * can change), exactly as the expressions surfaces re-read on
 * `expression_changed` — and the explicit refresh affordance bypasses the
 * cache with the kernel's own `fresh` flag.
 *
 * The cache keys on the WORKSPACE: switching workspaces releases every
 * listing so the next workspace starts honest (workspace/store.ts names the
 * active workspace here). Within a workspace a listing lives until a receipt
 * or an explicit refresh invalidates it — collapsed folders keep their
 * children mounted-concealed (FileTree), so re-expansion renders from this
 * cache with no read at all.
 *
 * Presentation law (BOOT-14): a re-read keeps the last-observed reading
 * visible — the entry keeps its `reading` while a fresh one is in flight —
 * and pending is disclosed by ONE tree-level affordance, never a per-node
 * spinner cascade. Errors stay per path, honestly, where they happened —
 * an error replaces the entry's STATUS, never its last reading (C10).
 *
 * Coherence (C12): every read captures the path's generation at start and
 * publishes only while it is still current — an older slow completion
 * cannot roll a newer listing backward. A fresh refresh supersedes an
 * ordinary read in flight instead of racing it (and joins an already-fresh
 * one), so the newest intent always wins single-flight.
 *
 * This module is deliberately react/kernel-free so node:test can load it
 * through workspace/store.ts; the React bindings live in listingHooks.tsx.
 */
import {listFiles} from "./client";
import type {KernelTransportStatus, NativeDirectory} from "../kernel/types";

export interface ListingEntry {
  /** `pending` with a `reading` is a re-read in flight (BOOT-14 keeps the
   * last listing visible); `pending` without one is the first read. */
  status: "pending" | "ready" | "error";
  reading?: NativeDirectory;
  error?: string;
  /** Bumped by invalidation so subscribed directories re-read. */
  rev: number;
}

export const EMPTY_LISTING: ListingEntry = {status: "pending", rev: 0};

export class ListingStore {
  private workspace = new Map<string, ListingEntry>();
  /** The reads in flight, named by path and whether they are fresh. */
  private inflight = new Map<string, boolean>();
  /** Each path's current read generation. Captures come from one store-wide
   * monotonic counter, so a generation is never reused — clearing the map on
   * a workspace switch orphans every read in flight across that boundary. */
  private generations = new Map<string, number>();
  private generationCounter = 0;
  private listeners = new Set<() => void>();
  private activeKey = "root";
  private loading = false;
  private stale = 0;

  setActiveWorkspace(key: string) {
    if (key === this.activeKey) return;
    this.activeKey = key;
    // Retention keys on the workspace: leaving one releases its listings.
    // Clearing the generations orphans the reads in flight too — a late
    // completion from the old workspace is stale-dropped, never published
    // into the new one.
    this.workspace.clear();
    this.inflight.clear();
    this.generations.clear();
    this.loading = false;
    this.emit();
  }

  entry(path: string): ListingEntry {
    return this.workspace.get(path) ?? EMPTY_LISTING;
  }

  isLoading(): boolean {
    return this.loading;
  }

  /** Completions the generation guard dropped (C12 evidence). */
  staleDropped(): number {
    return this.stale;
  }

  /** Admit a listing for `path` if it is not held: the ordinary expansion
   * (cached), the first read, or — with `fresh` — the explicit refresh
   * affordance that bypasses both this cache and the kernel's own. A fresh
   * refresh joins an already-fresh read and SUPERSEDES an ordinary one:
   * the superseded completion is dropped by its generation, never published. */
  ensure(transport: KernelTransportStatus, path: string, fresh = false) {
    const held = this.workspace.get(path);
    if (!fresh && held && held.status !== "pending") return;
    if (!fresh && this.inflight.has(path)) return;
    if (fresh && this.inflight.get(path) === true) return;
    this.read(transport, path, fresh);
  }

  private read(transport: KernelTransportStatus, path: string, fresh: boolean) {
    const previous = this.workspace.get(path);
    const rev = (previous?.rev ?? 0) + (fresh ? 1 : 0);
    const generation = ++this.generationCounter;
    this.generations.set(path, generation);
    this.workspace.set(path, {status: "pending", reading: previous?.reading, rev});
    this.inflight.set(path, fresh);
    this.loading = true;
    this.emit();
    void listFiles(transport, path, fresh)
      .then(reading => {
        if (this.generations.get(path) !== generation) { this.stale += 1; return; }
        this.workspace.set(path, {status: "ready", reading, rev});
      })
      .catch(error => {
        if (this.generations.get(path) !== generation) { this.stale += 1; return; }
        // C10: the error takes the status, never the last reading.
        this.workspace.set(path, {status: "error", error: String(error), reading: this.workspace.get(path)?.reading, rev});
      })
      .finally(() => {
        // Only the current generation owns the in-flight slot: a stale
        // completion must not release the read that superseded it.
        if (this.generations.get(path) === generation) {
          this.inflight.delete(path);
          this.loading = this.inflight.size > 0;
        }
        this.emit();
      });
  }

  /** A `file_changed` receipt's invalidation: the changed file's parent is
   * the one listing a write can change. The tombstone keeps the last reading
   * visible (BOOT-14) and bumps `rev` so mounted directories re-read; an
   * unmounted path re-reads on its next mount. */
  invalidateParentOf(filePath: string) {
    const parent = parentPath(filePath);
    if (parent === null) return;
    const held = this.workspace.get(parent);
    if (held?.status === "pending" && this.inflight.has(parent)) return;
    this.workspace.set(parent, {status: "pending", reading: held?.reading, rev: (held?.rev ?? 0) + 1});
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

/** The Central path one level above `path` (`null` at the root ""). */
export function parentPath(path: string): string | null {
  if (!path.includes("/")) return "";
  const cut = path.lastIndexOf("/");
  return path.slice(0, cut);
}

export const listings = new ListingStore();

/** Name the workspace the cache keys on (workspace/store.ts on switch). */
export function setActiveListingWorkspace(key: string) {
  listings.setActiveWorkspace(key);
}
