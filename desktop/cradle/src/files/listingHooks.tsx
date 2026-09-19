/**
 * The listing store's React bindings — split from listingStore.ts (which
 * stays react/kernel-free so node:test can load the pure store through
 * workspace/store.ts): the tree-level pending observation, one directory's
 * admission, and the kernel-receipt invalidation feed. The hooks moved here
 * verbatim, 2026-09-19.
 */
import {useEffect,useRef,useSyncExternalStore} from "react";
import type {KernelReceipt,KernelTransportStatus} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";
import {EMPTY_LISTING,listings,type ListingEntry} from "./listingStore";

function subscribeListings(listener: () => void): () => void {
  return listings.subscribe(listener);
}

/** The tree-level pending observation: one affordance while ANY listing of
 * the active workspace is in flight — a cached expansion never trips it. */
export function useListingLoading(): boolean {
  return useSyncExternalStore(subscribeListings, () => listings.isLoading(), () => false);
}

/** One directory's listing: admitted on mount, retained until a receipt or
 * an explicit refresh invalidates it. `refresh` is the tree's explicit
 * refresh generation — every increment re-reads this path fresh. */
export function useListing(transport: KernelTransportStatus, path: string, refresh: number): ListingEntry {
  const entry = useSyncExternalStore(subscribeListings, () => listings.entry(path), () => EMPTY_LISTING);
  const rev = entry.rev;
  useEffect(() => {
    listings.ensure(transport, path, false);
  }, [transport, path, rev]);
  useEffect(() => {
    if (refresh > 0) listings.ensure(transport, path, true);
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
      if (changed !== null) listings.invalidateParentOf(changed);
    }
    if (latest !== undefined) applied.current = Math.max(applied.current, latest);
  }, [latest]);
}
