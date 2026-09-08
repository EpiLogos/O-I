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
import { createPortal } from "react-dom";
import { createLoadingIndicator } from "@epilogos/oi-design-system/loading";
import "@epilogos/oi-design-system/point-cloud.css";
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
  snapshot: KernelSnapshotState;
  receipts: KernelReceipt[];
  listing: SourceListingState | null;
  listingError: string | null;
  opError: string | null;
  sourceErrors: Record<string, string>;
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
  const [boot, setBoot] = useState<KernelBootState>(transport.kind === "unavailable" ? { phase: "transport-unavailable", detail: transport.reason } : STARTING_BOOT);
  // BOOT-00: the window overlay's own gate. It settles the moment the
  // first `KernelOp::State` resolves (success or error) — independent of
  // `boot`'s ground-status resolution, which continues after the overlay
  // is gone (BOOT-02/03/04 render inside the usable shell, not behind it).
  const [stateSettled, setStateSettled] = useState(transport.kind === "unavailable");
  const [snapshot, setSnapshot] = useState<KernelSnapshotState>(EMPTY_SNAPSHOT);
  const [receipts, setReceipts] = useState<KernelReceipt[]>([]);
  const [listing, setListing] = useState<SourceListingState | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const errorOperations = useRef<Record<string, string>>({});
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
        setOpError(call.error ?? null);
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
          } catch { setOpError("Working draft could not be persisted on this device."); }
          merge(result);
        }
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
      setStateSettled(true);
      // BOOT-00/02/03/04: the boot phase, derived only from the transport,
      // this first state read and the ground status op — never a probe of
      // sockets, never an invented readiness signal.
      if (transport.kind === "unavailable") {
        // Already set from the initial useState above.
      } else if (!initial.outcome || initial.outcome.result !== "state") {
        setBoot({ phase: "transport-unavailable", detail: initial.error ?? "The kernel state could not be read" });
      } else {
        setBoot({ phase: "starting", detail: "Checking Central ground…" });
        const groundCall = await kernelOp(transport, { op: "ground", request: { action: "status" } });
        if (alive) {
          if (groundCall.error || groundCall.outcome?.result !== "ground_reading") {
            setBoot({ phase: "ground-inaccessible", detail: groundCall.error ?? "Central's ground status could not be read" });
          } else {
            const personalGround = (groundCall.outcome.reading as Record<string, unknown>).personal_ground;
            if (typeof personalGround !== "string") {
              setBoot({ phase: "ground-unrecognised", detail: "No default Central selected" });
            } else {
              const recognizeCall = await kernelOp(transport, { op: "ground", request: { action: "recognize", path: personalGround } });
              if (alive) {
                const recognized = recognizeCall.outcome?.result === "ground_reading" ? (recognizeCall.outcome.reading as Record<string, unknown>) : undefined;
                const access = recognized?.access as { readable?: boolean; searchable?: boolean } | undefined;
                if (recognizeCall.error || !recognized || recognized.outcome !== "recognized" || !access?.readable || !access?.searchable) {
                  const reason = recognizeCall.error ?? (typeof recognized?.outcome === "string" ? `Central reports this ground as "${recognized.outcome}"` : "The default Central ground is not accessible");
                  setBoot({ phase: "ground-inaccessible", detail: reason });
                } else {
                  setBoot({ phase: "ready" });
                }
              }
            }
          }
        }
      }
      const backlog = await eventsSince(transport, 1);
      if (alive) admitReceipts(backlog);
      subscription = await subscribeTopic(transport, (receipt) => {
        admitReceipts([receipt]);
        // Other native windows share this kernel. Pull after their changes;
        // receipt payloads never become a parallel state store.
        if(transport.kind==="tauri") void kernelOp(transport,{op:"state"}).then(call=>{if(alive&&call.outcome)merge(call.outcome);});
      });
    })();
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, [admitReceipts, merge, transport]);

  const api: KernelApi = useMemo(
    () => ({
      transport,
      boot,
      snapshot,
      receipts,
      listing,
      listingError,
      opError,
      sourceErrors,
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
      boot,
      snapshot,
      receipts,
      listing,
      listingError,
      opError,
      sourceErrors,
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

  // BOOT-00: window-scope indicator until the first `KernelOp::State`
  // settles, then removed immediately (no minimum dwell). Obscured shell
  // content is `inert`; focus returns to the shell once the overlay lifts.
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

  return <KernelContext.Provider value={api}>
    {!stateSettled && <BootOverlay detail={boot.detail} />}
    {props.children}
  </KernelContext.Provider>;
}

/** The design-system window-scope loading body (BOOT-00), portalled above
 * the shell so it is never clipped by a local stacking context. The host
 * (here) owns lifecycle, inertness and focus; the component itself does no
 * I/O, timing or minimum display duration — only `update()` on change. */
function BootOverlay({ detail }: { detail?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const indicator = useRef<ReturnType<typeof createLoadingIndicator>>();
  useEffect(() => {
    const body = createLoadingIndicator({ label: "Opening your world", detail, scope: "window" });
    indicator.current = body;
    host.current?.append(body.element);
    return () => { body.remove(); indicator.current = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { indicator.current?.update({ detail }); }, [detail]);
  return createPortal(<div className="oi-boot-overlay" ref={host} />, document.body);
}
