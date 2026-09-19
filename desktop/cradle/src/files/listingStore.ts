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
 * spinner cascade. Errors stay per path, honestly, where they happened.
 */
import {useEffect, useRef, useSyncExternalStore} from "react";
import {listFiles} from "./client";
import type {KernelReceipt, KernelTransportStatus, NativeDirectory} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";

export interface ListingEntry {
  /** `pending` with a `reading` is a re-read in flight (BOOT-14 keeps the
   * last listing visible); `pending` without one is the first read. */
  status: "pending" | "ready" | "error";
  reading?: NativeDirectory;
  error?: string;
  /** Bumped by invalidation so subscribed directories re-read. */
  rev: number;
}

const EMPTY: ListingEntry = {status: "pending", rev: 0};

class ListingStore {
  private workspace = new Map<string, ListingEntry>();
  private inflight = new Set<string>();
  private listeners = new Set<() => void>();
  private activeKey = "root";
  private loading = false;

  setActiveWorkspace(key: string) {
    if (key === this.activeKey) return;
    this.activeKey = key;
    // Retention keys on the workspace: leaving one releases its listings.
    this.workspace.clear();
    this.inflight.clear();
    this.loading = false;
    this.emit();
  }

  entry(path: string): ListingEntry {
    return this.workspace.get(path) ?? EMPTY;
  }

  isLoading(): boolean {
    return this.loading;
  }

  /** Admit a listing for `path` if it is not held: the ordinary expansion
   * (cached), the first read, or — with `fresh` — the explicit refresh
   * affordance that bypasses both this cache and the kernel's own. */
  ensure(transport: KernelTransportStatus, path: string, fresh = false) {
    const held = this.workspace.get(path);
    if (!fresh && held && held.status !== "pending") return;
    if (!fresh && this.inflight.has(path)) return;
    this.read(transport, path, fresh);
  }

  private read(transport: KernelTransportStatus, path: string, fresh: boolean) {
    const previous = this.workspace.get(path);
    this.workspace.set(path, {status: "pending", reading: previous?.reading, rev: (previous?.rev ?? 0) + (fresh ? 1 : 0)});
    this.inflight.add(path);
    this.loading = true;
    this.emit();
    void listFiles(transport, path, fresh)
      .then(reading => {
        const rev = this.entry(path).rev;
        this.workspace.set(path, {status: "ready", reading, rev});
      })
      .catch(error => {
        const rev = this.entry(path).rev;
        this.workspace.set(path, {status: "error", error: String(error), rev});
      })
      .finally(() => {
        this.inflight.delete(path);
        this.loading = this.inflight.size > 0;
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

const store = new ListingStore();

/** Name the workspace the cache keys on (workspace/store.ts on switch). */
export function setActiveListingWorkspace(key: string) {
  store.setActiveWorkspace(key);
}

function subscribeListings(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The tree-level pending observation: one affordance while ANY listing of
 * the active workspace is in flight — a cached expansion never trips it. */
export function useListingLoading(): boolean {
  return useSyncExternalStore(subscribeListings, () => store.isLoading(), () => false);
}

/** One directory's listing: admitted on mount, retained until a receipt or
 * an explicit refresh invalidates it. `refresh` is the tree's explicit
 * refresh generation — every increment re-reads this path fresh. */
export function useListing(transport: KernelTransportStatus, path: string, refresh: number): ListingEntry {
  const entry = useSyncExternalStore(subscribeListings, () => store.entry(path), () => EMPTY);
  const rev = entry.rev;
  useEffect(() => {
    store.ensure(transport, path, false);
  }, [transport, path, rev]);
  useEffect(() => {
    if (refresh > 0) store.ensure(transport, path, true);
  }, [refresh, transport, path]);
  return entry;
}

/** Kernel receipts drive invalidation: every `file_changed` receipt since
 * the last observed one drops the changed file's parent listing. Mounted
 * once per FileTree root; idempotent across instances. */
export function useListingInvalidation() {
  const kernel = useKernel();
  const changes = kernel.receipts.filter((receipt: KernelReceipt) => receipt.event === "file_changed");
  const latest = changes[changes.length - 1]?.seq;
  const applied = useRef(0);
  useEffect(() => {
    for (const receipt of changes) {
      if (receipt.seq <= applied.current) continue;
      const changed = typeof receipt.path === "string" ? receipt.path : null;
      if (changed !== null) store.invalidateParentOf(changed);
    }
    if (latest !== undefined) applied.current = Math.max(applied.current, latest);
  }, [latest]);
}
