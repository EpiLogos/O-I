/**
 * The kernel React projection (U0.4) — the pull side of the seam. Kernel
 * truth is pulled through these read models; events (the receipts) only
 * say "look again" (02 §5, ported). Receipts are kept ordered with their
 * seqs, deduped by seq — the observable log as the renderer sees it.
 */

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
import {
  detectTransport,
  eventsSince,
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

export interface KernelApi {
  transport: KernelTransportStatus;
  snapshot: KernelSnapshotState;
  receipts: KernelReceipt[];
  listing: SourceListingState | null;
  listingError: string | null;
  opError: string | null;
  apply: (op: KernelOp) => Promise<KernelOutcome | null>;
  refreshListing: () => Promise<void>;
  /** Typed conveniences the surfaces share. */
  openSource: (sourceRef: SourceRef, surfaceId: string) => Promise<void>;
  editBuffer: (sourceRef: SourceRef, content: string) => Promise<void>;
  saveSource: (sourceRef: SourceRef) => Promise<KernelOutcome | null>;
  rereadSource: (sourceRef: SourceRef) => Promise<void>;
  surfaceOpen: (surfaceId: string, kind: string, sourceRef: SourceRef | undefined, title: string) => Promise<void>;
  surfaceClose: (surfaceId: string) => Promise<void>;
  surfaceFocus: (surfaceId: string) => Promise<void>;
}

const EMPTY_SNAPSHOT: KernelSnapshotState = { focus: {}, surfaces: {}, buffers: {} };

const KernelContext = createContext<KernelApi | null>(null);

export function useKernel(): KernelApi {
  const context = useContext(KernelContext);
  if (!context) throw new Error("useKernel outside KernelProvider");
  return context;
}

export function KernelProvider(props: { children: ReactNode }) {
  const transport = useMemo(detectTransport, []);
  const [snapshot, setSnapshot] = useState<KernelSnapshotState>(EMPTY_SNAPSHOT);
  const [receipts, setReceipts] = useState<KernelReceipt[]>([]);
  const [listing, setListing] = useState<SourceListingState | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const seenSeq = useRef(0);
  const applySerial = useRef(Promise.resolve());

  const admitReceipts = useCallback((incoming: KernelReceipt[]) => {
    if (incoming.length === 0) return;
    setReceipts((held) => {
      const known = new Set(held.map((receipt) => receipt.seq));
      const fresh = incoming.filter((receipt) => receipt.seq > seenSeq.current || !known.has(receipt.seq));
      for (const receipt of fresh) seenSeq.current = Math.max(seenSeq.current, receipt.seq);
      return fresh.length ? [...held, ...fresh].sort((a, b) => a.seq - b.seq) : held;
    });
  }, []);

  // Merge one outcome into the pulled read models.
  const merge = useCallback((outcome: KernelOutcome) => {
    admitReceipts(outcome.receipts ?? []);
    switch (outcome.result) {
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
        setOpError(call.error ?? null);
        if (call.outcome) merge(call.outcome);
        return call.outcome;
      });
      applySerial.current = run.then(() => undefined, () => undefined);
      return run;
    },
    [merge, transport],
  );

  const refreshListing = useCallback(async () => {
    const call = await kernelOp(transport, { op: "sources_list" });
    if (call.outcome && call.outcome.result === "sources_listed") {
      merge(call.outcome);
      setListingError(null);
    } else {
      setListingError(call.error ?? "the listing did not serve");
    }
  }, [merge, transport]);

  const openSource = useCallback(
    async (sourceRef: SourceRef, surfaceId: string) => {
      await apply({ op: "surface_open", surface_id: surfaceId, kind: "source", source_ref: sourceRef, title: sourceRef });
      await apply({ op: "source_open", source_ref: sourceRef });
      await apply({ op: "surface_focus", surface_id: surfaceId });
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

  // Bootstrap: pull the state, subscribe to the topic, and re-sync the log
  // once by cursor (the command the unit requires the host to expose).
  useEffect(() => {
    let alive = true;
    let subscription: { unsubscribe: () => void } | null = null;
    void (async () => {
      const initial = await kernelOp(transport, { op: "state" });
      if (!alive) return;
      if (initial.outcome && initial.outcome.result === "state") {
        merge(initial.outcome);
      }
      const backlog = await eventsSince(transport, 1);
      if (alive) admitReceipts(backlog);
      subscription = await subscribeTopic(transport, (receipt) => admitReceipts([receipt]));
    })();
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, [admitReceipts, merge, transport]);

  const api: KernelApi = useMemo(
    () => ({
      transport,
      snapshot,
      receipts,
      listing,
      listingError,
      opError,
      apply,
      refreshListing,
      openSource,
      editBuffer,
      saveSource,
      rereadSource,
      surfaceOpen,
      surfaceClose,
      surfaceFocus,
    }),
    [
      transport,
      snapshot,
      receipts,
      listing,
      listingError,
      opError,
      apply,
      refreshListing,
      openSource,
      editBuffer,
      saveSource,
      rereadSource,
      surfaceOpen,
      surfaceClose,
      surfaceFocus,
    ],
  );

  return <KernelContext.Provider value={api}>{props.children}</KernelContext.Provider>;
}
