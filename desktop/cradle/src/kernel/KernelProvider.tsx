/**
 * The kernel React projection (U0.4) — the pull side of the seam. Kernel
 * truth is pulled through these read models; events (the receipts) only
 * say "look again" (02 §5, ported). Receipts are kept ordered with their
 * seqs, deduped by seq — the observable log as the renderer sees it.
 */

import { clearSavedDraft, writeDraft } from "../workspace/drafts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emitExpressionCue } from "../stage/cues";
import { invalidateFileReadings } from "../files/resources";
import { invalidateWikiProjectionReadings } from "../techne/wikiProjectionStore";
import { listings } from "../files/listingStore";
import {
  detectTransport,
  kernelOp,
  subscribeTopic,
} from "./bridge";
import type {
  KernelOp,
  KernelOutcome,
  KernelReceipt,
  KernelSnapshotState,
  KernelTransportStatus,
  SourceListingState,
  SourceRef,
} from "./types";

/** BOOT-00/02/03/04: the boot phase, derived only from `detectTransport()`,
 * the first `KernelOp::State` read and the ground status op — never a
 * second source of truth beside the pulled read models above. */
export interface KernelBootState {
  phase:
    | "starting"
    | "ready"
    | "transport-unavailable"
    | "ground-unrecognised"
    | "ground-inaccessible";
  detail?: string;
}

const STARTING_BOOT: KernelBootState = { phase: "starting", detail: "Reading local runtime…" };

export interface KernelApi {
  transport: KernelTransportStatus;
  /** BOOT-00/02/03/04 (additive; no existing read model changes). */
  boot: KernelBootState;
  /** The first real state read has returned (success or failure). */
  stateSettled: boolean;
  snapshot: KernelSnapshotState;
  receipts: KernelReceipt[];
  /** Changes only after an actual owner state read following lost replay.
   * Mounted domain readers use it to re-read; it carries no business state. */
  readModelEpoch: number;
  listing: SourceListingState | null;
  listingError: string | null;
  opError: string | null;
  sourceErrors: Record<string, string>;
  /** The last op error through a stable ref — a captured closure reading
   * `opError` can go stale; diagnostics must always name the truth. */
  lastOpError: () => string | null;
  /** The human's dismissal of the standing op error (footer status). */
  dismissOpError: () => void;
  apply: (op: KernelOp) => Promise<KernelOutcome | null>;
  refreshListing: () => Promise<void>;
  /** Typed conveniences the surfaces share. */
  openSource: (sourceRef: SourceRef, surfaceId: string) => Promise<void>;
  /** Open a Day document's buffer through the owner's Day route — the only
   * reader of a root-register Day source. Returns the opened buffer. */
  dayOpen: (dayRef?: string) => Promise<KernelOutcome | null>;
  editBuffer: (sourceRef: SourceRef, content: string) => Promise<void>;
  saveSource: (sourceRef: SourceRef) => Promise<KernelOutcome | null>;
  rereadSource: (sourceRef: SourceRef) => Promise<void>;
  surfaceOpen: (surfaceId: string, kind: string, sourceRef: SourceRef | undefined, title: string) => Promise<void>;
  surfaceClose: (surfaceId: string) => Promise<void>;
  surfaceFocus: (surfaceId: string) => Promise<void>;
}

const EMPTY_SNAPSHOT: KernelSnapshotState = { focus: {}, surfaces: {}, buffers: {} };
// Recent renderer observations only. The kernel owns a bounded disclosure
// window; durable owner history is read through its own operations.
const VIEW_RECEIPT_LIMIT = 256;
const VIEW_RECEIPT_BYTES = 1024 * 1024;
const VIEW_SINGLE_RECEIPT_BYTES = 256 * 1024;

const KernelContext = createContext<KernelApi | null>(null);

export function useKernel(): KernelApi {
  const context = useContext(KernelContext);
  if (!context) throw new Error("useKernel outside KernelProvider");
  return context;
}

export function KernelProvider(props: { children: ReactNode }) {
  const transport = useMemo(detectTransport, []);
  const [boot, setBoot] = useState<KernelBootState>(transport.kind === "unavailable" ? { phase: "transport-unavailable", detail: transport.reason } : STARTING_BOOT);
  // BOOT-00: the window overlay's own gate. It settles the moment the
  // first `KernelOp::State` resolves (success or error) — independent of
  // `boot`'s ground-status resolution, which continues after the overlay
  // is gone (BOOT-02/03/04 render inside the usable shell, not behind it).
  const [stateSettled, setStateSettled] = useState(transport.kind === "unavailable");
  const [snapshot, setSnapshot] = useState<KernelSnapshotState>(EMPTY_SNAPSHOT);
  const [receipts, setReceipts] = useState<KernelReceipt[]>([]);
  const receiptWindow = useRef<KernelReceipt[]>([]);
  const [readModelEpoch, setReadModelEpoch] = useState(0);
  const [listing, setListing] = useState<SourceListingState | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const listingGeneration = useRef(0);
  // The mount owns each page lifetime. BFCache pause ends read ownership
  // even though React remains mounted; Tauri completion is fenced, not cancelled.
  const ownerReadLifetime = useRef<AbortController | null>(new AbortController());
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const errorOperations = useRef<Record<string, string>>({});
  const [opError, setOpError] = useState<string | null>(null);
  // The same last-op error through a stable ref: React state read from a
  // captured closure (the walk seam, event handlers) goes stale, which once
  // masked a real transport failure as "the state read did not serve".
  // Diagnostics read `lastOpError()` and always name the truth.
  const lastOpError = useRef<string | null>(null);
  const reportOpError = useCallback((value: string | null) => {
    lastOpError.current = value;
    setOpError(value);
  }, []);
  const dismissOpError = useCallback(() => reportOpError(null), [reportOpError]);
  const applySerial = useRef(Promise.resolve());

  const admitReceipts = useCallback((incoming: KernelReceipt[]) => {
    if (incoming.length === 0) return;
    const known = new Set(receiptWindow.current.map(receipt => receipt.seq));
    const fresh = incoming.filter(receipt => !known.has(receipt.seq)
      && new TextEncoder().encode(JSON.stringify(receipt)).byteLength <= VIEW_SINGLE_RECEIPT_BYTES);
    if (!fresh.length) return;
    const next = [...receiptWindow.current, ...fresh].sort((a, b) => a.seq - b.seq).slice(-VIEW_RECEIPT_LIMIT);
    let bytes = 0;
    let first = next.length;
    for (let index = next.length - 1; index >= 0; index--) {
      bytes += new TextEncoder().encode(JSON.stringify(next[index])).byteLength;
      if (bytes > VIEW_RECEIPT_BYTES) break;
      first = index;
    }
    // Oversized operation receipts are not retained here. Their actual gap
    // is disclosed by native replay and forces owner re-reads below.
    receiptWindow.current = next.slice(first);
    setReceipts(receiptWindow.current);
  }, []);

  // Merge one outcome into the pulled read models.
  const merge = useCallback((outcome: KernelOutcome) => {
    admitReceipts(outcome.receipts ?? []);
    switch (outcome.result) {
      case "world_read":
      case "state":
      case "surface_opened":
      case "surface_closed":
      case "surface_focused":
        setSnapshot(outcome.snapshot);
        break;
      case "source_opened":
      case "buffer_edited":
      case "source_saved":
      case "source_save_failed":
      case "source_reread":
        setSnapshot((held) => ({
          ...held,
          buffers: { ...held.buffers, [outcome.buffer.source_ref]: outcome.buffer },
        }));
        break;
      case "sources_listed":
        setListing(outcome.listing);
        break;
      default:
        break;
    }
  }, [admitReceipts]);

  const apply = useCallback(
    async (op: KernelOp): Promise<KernelOutcome | null> => {
      // Serialise ops through one queue so seq order and buffer state stay
      // deterministic under rapid typing.
      const run = applySerial.current.then(async () => {
        const call = await kernelOp(transport, op);
        reportOpError(call.error ?? null);
        if ("source_ref" in op && op.source_ref && op.op.startsWith("source_")) {
          const ref = op.source_ref;
          let reason = call.error;
          if (call.outcome?.result === "source_save_failed") {
            const failure = call.outcome.failure;
            reason = failure.kind === "owner-refused" ? failure.message : failure.kind === "unavailable" ? failure.detail : undefined;
          }
          setSourceErrors(held => {
            const next = { ...held };
            if (reason) {
              next[ref] = reason;
              errorOperations.current[ref] = op.op;
            } else if (errorOperations.current[ref] === op.op) {
              delete next[ref];
              delete errorOperations.current[ref];
            }
            return next;
          });
        }
        if (call.outcome) {
          const result = call.outcome;
          try {
            if (result.result === "source_saved") clearSavedDraft(result.buffer.source_ref, result.buffer.content);
            if (result.result === "source_reread" && result.buffer.dirty) writeDraft(result.buffer.source_ref, result.buffer);
          } catch { reportOpError("Working draft could not be persisted on this device."); }
          merge(result);
        }
        return call.outcome;
      });
      applySerial.current = run.then(() => undefined, () => undefined);
      return run;
    },
    [merge, transport, reportOpError],
  );

  const refreshListing = useCallback(async (live = () => true, signal?: AbortSignal) => {
    const lifetime = ownerReadLifetime.current;
    if (!lifetime) return;
    const current = () => ownerReadLifetime.current === lifetime && !lifetime.signal.aborted && live();
    if (!current()) return;
    const generation = ++listingGeneration.current;
    const readSignal = AbortSignal.any([lifetime.signal, ...(signal ? [signal] : []), AbortSignal.timeout(10000)]);
    const call = await kernelOp(transport, { op: "sources_list" }, readSignal);
    if (!current() || generation !== listingGeneration.current) return;
    if (call.outcome && call.outcome.result === "sources_listed") {
      merge(call.outcome);
      setListingError(null);
    } else {
      setListingError(call.error ?? "the listing did not serve");
    }
  }, [merge, transport]);

  const resetOwnerReadModels = useCallback(() => {
    // Called only after the current lifetime has read real owner State.
    // Last domain readings remain under their existing pending/drift contracts.
    receiptWindow.current = [];
    setReceipts([]);
    invalidateFileReadings();
    listings.invalidateAll();
    invalidateWikiProjectionReadings(transport);
    setReadModelEpoch(epoch => epoch + 1);
  }, [transport]);

  const refreshOwnerModels = useCallback(async (lostReplay: boolean, live = () => true, signal?: AbortSignal) => {
    const lifetime = ownerReadLifetime.current;
    if (!lifetime) return;
    const current = () => ownerReadLifetime.current === lifetime && !lifetime.signal.aborted && live();
    const ownedSignal = AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]);
    const run = applySerial.current.then(async () => {
      if (!current()) return;
      if (lostReplay) listingGeneration.current++;
      const stateCall = await kernelOp(transport, {op: "state"}, AbortSignal.any([ownedSignal, AbortSignal.timeout(10000)]));
      // A retired mount/page must not publish an old read or invalidate its
      // successor's acquisitions, including a late uncancellable Tauri read.
      if (!current()) return;
      if (stateCall.outcome?.result !== "state") {
        throw new Error(stateCall.error ?? "Current kernel state could not be read after event replay loss");
      }
      merge(stateCall.outcome);
      if (lostReplay) {
        resetOwnerReadModels();
        await refreshListing(current, ownedSignal);
      }
    });
    applySerial.current = run.then(() => undefined, () => undefined);
    await run;
  }, [merge, refreshListing, resetOwnerReadModels, transport]);

  const openSource = useCallback(
    async (sourceRef: SourceRef, surfaceId: string) => {
      await apply({ op: "surface_open", surface_id: surfaceId, kind: "source", source_ref: sourceRef, title: sourceRef });
      await apply({ op: "source_open", source_ref: sourceRef });
      await apply({ op: "surface_focus", surface_id: surfaceId });
    },
    [apply],
  );

  const dayOpen = useCallback(
    async (dayRef?: string) => {
      // The buffer lands through the owner's Day route; the surface binds to
      // the disclosed ref. No project-scoped source read ever runs for it.
      return apply({ op: "day_source_open", ...(dayRef ? { day_ref: dayRef } : {}) });
    },
    [apply],
  );

  const editBuffer = useCallback(
    async (sourceRef: SourceRef, content: string) => {
      await apply({ op: "source_edit", source_ref: sourceRef, content });
    },
    [apply],
  );

  const saveSource = useCallback(
    async (sourceRef: SourceRef) => apply({ op: "source_save", source_ref: sourceRef }),
    [apply],
  );

  const rereadSource = useCallback(
    async (sourceRef: SourceRef) => {
      await apply({ op: "source_reread", source_ref: sourceRef });
    },
    [apply],
  );

  const surfaceOpen = useCallback(
    async (surfaceId: string, kind: string, sourceRef: SourceRef | undefined, title: string) => {
      await apply({
        op: "surface_open",
        surface_id: surfaceId,
        kind,
        ...(sourceRef ? { source_ref: sourceRef } : {}),
        title,
      });
    },
    [apply],
  );

  const surfaceClose = useCallback(
    async (surfaceId: string) => {
      await apply({ op: "surface_close", surface_id: surfaceId });
    },
    [apply],
  );

  const surfaceFocus = useCallback(
    async (surfaceId: string) => {
      await apply({ op: "surface_focus", surface_id: surfaceId });
    },
    [apply],
  );

  // Replay retains its native generation/cursor independently of owner reads.
  // This effect also owns the mount/page lifetime of State and listings.
  useEffect(() => {
    let alive = true;
    let pageReads = ownerReadLifetime.current ?? new AbortController();
    ownerReadLifetime.current = pageReads;
    let bootFinished = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let subscriptionStarting = false;
    let resync: ReturnType<typeof setTimeout> | undefined;
    const pageCurrent = (reads: AbortController) => () => alive
      && ownerReadLifetime.current === reads && !reads.signal.aborted;
    const requestState = () => {
      const reads = ownerReadLifetime.current;
      if (resync !== undefined || !alive || !reads) return;
      const current = pageCurrent(reads);
      resync = setTimeout(() => {
        resync = undefined;
        if (current()) void refreshOwnerModels(false, current, reads.signal)
          .catch(error => {if (current()) reportOpError(String(error));});
      }, 200);
    };
    const ensureSubscription = async () => {
      if (!alive || subscription || subscriptionStarting) return;
      subscriptionStarting = true;
      try {
        const next = await subscribeTopic(transport, receipt => {
          if (!alive || !ownerReadLifetime.current) return;
          admitReceipts([receipt]);
          requestState();
        }, async (_page, replayLifetime) => {
          const reads = ownerReadLifetime.current;
          if (!reads) return;
          const current = () => pageCurrent(reads)() && replayLifetime.isCurrent();
          if (current()) await refreshOwnerModels(true, current,
            AbortSignal.any([reads.signal, replayLifetime.signal]));
        }, error => {if (alive && ownerReadLifetime.current) reportOpError(error);});
        if (!alive) next?.unsubscribe();
        else subscription = next;
      } finally {
        subscriptionStarting = false;
      }
    };
    const readBoot = async (reads: AbortController, restored: boolean) => {
      const current = pageCurrent(reads);
      if (!current()) return;
      const read = (op: KernelOp) => kernelOp(transport, op,
        AbortSignal.any([reads.signal, AbortSignal.timeout(10000)]));
      const initial = await read({ op: "state" });
      if (!current()) return;
      if (initial.outcome?.result === "state") merge(initial.outcome);
      setStateSettled(true);
      // Boot is still derived from actual State and authored ground reads.
      // A pause does not settle an unfinished boot or invent readiness.
      if (transport.kind === "unavailable") {
        // Already set from the initial useState above.
      } else if (initial.outcome?.result !== "state") {
        setBoot({ phase: "transport-unavailable", detail: initial.error ?? "The kernel state could not be read" });
      } else {
        if (restored) {
          listingGeneration.current++;
          resetOwnerReadModels();
        }
        // Initial/StrictMode child reads may precede this effect. Complete
        // native listing acquisition from the same admitted owner State.
        await refreshListing(current, reads.signal);
        if (!current()) return;
        setBoot({ phase: "starting", detail: "Checking Central ground…" });
        if (!current()) return;
        const groundCall = await read({ op: "ground", request: { action: "status" } });
        if (!current()) return;
        if (groundCall.error || groundCall.outcome?.result !== "ground_reading") {
          setBoot({ phase: "ground-inaccessible", detail: groundCall.error ?? "Central's ground status could not be read" });
        } else {
          const personalGround = (groundCall.outcome.reading as Record<string, unknown>).personal_ground;
          if (typeof personalGround !== "string") {
            setBoot({ phase: "ground-unrecognised", detail: "No default Central selected" });
          } else {
            if (!current()) return;
            const recognizeCall = await read({ op: "ground", request: { action: "recognize", path: personalGround } });
            if (!current()) return;
            const recognized = recognizeCall.outcome?.result === "ground_reading" ? (recognizeCall.outcome.reading as Record<string, unknown>) : undefined;
            const access = recognized?.access as { readable?: boolean; searchable?: boolean } | undefined;
            if (recognizeCall.error || !recognized || recognized.outcome !== "recognized" || !access?.readable || !access?.searchable) {
              const reason = recognizeCall.error ?? (typeof recognized?.outcome === "string" ? `Central reports this ground as "${recognized.outcome}"` : "The default Central ground is not accessible");
              setBoot({ phase: "ground-inaccessible", detail: reason });
            } else {
              setBoot({ phase: "ready" });
              bootFinished = true;
            }
          }
        }
      }
      if (!current()) return;
      await ensureSubscription();
    };
    const pause = () => {
      pageReads.abort();
      if (ownerReadLifetime.current === pageReads) ownerReadLifetime.current = null;
      listingGeneration.current++;
      if (resync !== undefined) {clearTimeout(resync); resync = undefined;}
    };
    const restore = () => {
      if (!alive || ownerReadLifetime.current) return;
      pageReads = new AbortController();
      ownerReadLifetime.current = pageReads;
      const reads = pageReads, current = pageCurrent(reads);
      // State/listings must become current even if no later native event occurs.
      const resumed = bootFinished
        ? (async () => {await refreshOwnerModels(true, current, reads.signal); if (current()) await ensureSubscription();})()
        : readBoot(reads, true);
      void resumed.catch(error => {if (current()) reportOpError(String(error));});
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", pause);
      window.addEventListener("pageshow", restore);
    }
    const initialReads = pageReads, initialCurrent = pageCurrent(initialReads);
    void readBoot(initialReads, false).catch(error => {if (initialCurrent()) reportOpError(String(error));});
    return () => {
      alive = false;
      pause();
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", pause);
        window.removeEventListener("pageshow", restore);
      }
      subscription?.unsubscribe();
    };
  }, [admitReceipts, merge, transport, refreshOwnerModels, refreshListing, resetOwnerReadModels, reportOpError]);

  const api: KernelApi = useMemo(
    () => ({
      transport,
      boot,
      stateSettled,
      snapshot,
      receipts,
      readModelEpoch,
      listing,
      listingError,
      opError,
      sourceErrors,
      lastOpError: () => lastOpError.current,
      dismissOpError,
      apply,
      refreshListing,
      openSource,
      dayOpen,
      editBuffer,
      saveSource,
      rereadSource,
      surfaceOpen,
      surfaceClose,
      surfaceFocus,
    }),
    [
      transport,
      boot,
      stateSettled,
      snapshot,
      receipts,
      readModelEpoch,
      listing,
      listingError,
      opError,
      sourceErrors,
      apply,
      dismissOpError,
      refreshListing,
      openSource,
      dayOpen,
      editBuffer,
      saveSource,
      rereadSource,
      surfaceOpen,
      surfaceClose,
      surfaceFocus,
    ],
  );

  // BOOT-00: the window's interaction law. Obscured shell content is
  // `inert` until the first `KernelOp::State` settles; focus returns to
  // the shell once the law lifts. The kernel owns no renderer: the boot
  // visuals are the stage's frontstate, driven by the cues below.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    if (!stateSettled) {
      root.setAttribute("inert", "");
    } else {
      root.removeAttribute("inert");
      if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      root.focus();
    }
    return () => root.removeAttribute("inert");
  }, [stateSettled]);

  // Boot is stated, never rendered here: the semantic cues are the whole
  // kernel→stage boot contract. `app.opening` stands while the first
  // state read is in flight; `app.ready` fires exactly once, the moment
  // it settles (success or error), with no minimum dwell.
  const settledOnce = useRef(false);
  useEffect(() => {
    if (stateSettled) {
      if (settledOnce.current) return;
      settledOnce.current = true;
      emitExpressionCue({ kind: "app.ready" });
      return;
    }
    emitExpressionCue({ kind: "app.opening", label: "Opening your world", detail: boot.detail });
  }, [stateSettled, boot.detail]);

  return <KernelContext.Provider value={api}>{props.children}</KernelContext.Provider>;
}
