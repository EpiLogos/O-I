/**
 * The kernel React projection (U0.4) — the pull side of the seam. Kernel
 * truth is pulled through these read models; events (the receipts) only
 * say "look again" (02 §5, ported). Receipts are kept ordered with their
 * seqs, deduped by seq — the observable log as the renderer sees it.
 */

import { clearSavedDraft, writeDraft } from "../workspace/drafts";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {KernelApiProvider} from './KernelContext';
export {KernelApiProvider, useKernel} from './KernelContext';
import { emitExpressionCue } from "../stage/cues";
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
  /** The first real state read has returned (success or failure). */
  stateSettled: boolean;
  /** Read-only disclosure of this owner's existing native operation gate. */
  operationReady: boolean;
  snapshot: KernelSnapshotState;
  receipts: KernelReceipt[];
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
// Recent renderer observations only. The kernel owns the complete event log;
// view changes must not retain another session-long copy in every window.
const VIEW_RECEIPT_LIMIT = 256;

export interface KernelProviderProps {
  children: ReactNode;
  transport?: KernelTransportStatus;
  operationEpoch?: string;
  onReceipts?: (receipts: KernelReceipt[]) => void;
  onAccessRetired?: () => void;
  onResync?: NonNullable<Parameters<typeof subscribeTopic>[2]>;
  onSubscriptionError?: (error: string) => void;
  onSubscriptionHealthy?: () => void;
}
export function KernelProvider(props: KernelProviderProps) {
  const transport = useMemo(() => props.transport ?? detectTransport(), [props.transport]);
  const callbacks = useRef(props); callbacks.current = props;
  const epochKey = JSON.stringify([props.operationEpoch, transport]);
  const ownerEpoch = useRef({key: epochKey, generation: 0});
  const operationAdmission = useRef(false);
  const [operationReady, setOperationReady] = useState(false);
  const publishOperationAdmission = useCallback((ready: boolean) => {
    operationAdmission.current = ready; setOperationReady(ready);
  }, []);
  if (ownerEpoch.current.key !== epochKey) {
    ownerEpoch.current = {key: epochKey, generation: ownerEpoch.current.generation + 1};
    operationAdmission.current = false;
  }
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
  // The same last-op error through a stable ref: React state read from a
  // captured closure (the walk seam, event handlers) goes stale, which once
  // masked a real transport failure as "the state read did not serve".
  // Diagnostics read `lastOpError()` and always name the truth.
  const lastOpError = useRef<string | null>(null);
  const opErrorRevision = useRef(0);
  const subscriptionError = useRef<{message: string; revision: number} | null>(null);
  const reportOpError = useCallback((value: string | null) => {
    ++opErrorRevision.current;
    lastOpError.current = value;
    setOpError(value);
  }, []);
  const dismissOpError = useCallback(() => reportOpError(null), [reportOpError]);
  const seenSeq = useRef(0);
  const deliveredSeq = useRef(0);
  const receiptOwner = useRef<string | null>(null);
  const applySerial = useRef(Promise.resolve());

  const admitReceipts = useCallback((incoming: KernelReceipt[]) => {
    if (incoming.length === 0) return;
    const delivered = incoming.filter(receipt => receipt.seq > deliveredSeq.current);
    for (const receipt of delivered) deliveredSeq.current = Math.max(deliveredSeq.current, receipt.seq);
    if (delivered.length) callbacks.current.onReceipts?.(delivered);
    setReceipts((held) => {
      const known = new Set(held.map((receipt) => receipt.seq));
      const fresh = incoming.filter((receipt) => receipt.seq > seenSeq.current || !known.has(receipt.seq));
      for (const receipt of fresh) seenSeq.current = Math.max(seenSeq.current, receipt.seq);
      return fresh.length ? [...held, ...fresh].sort((a, b) => a.seq - b.seq).slice(-VIEW_RECEIPT_LIMIT) : held;
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
      if (epochKey !== ownerEpoch.current.key) {reportOpError('This operation captured retired owner access. Your work remains open.'); return null;}
      const origin = ownerEpoch.current.generation;
      // Serialise ops through one queue so seq order and buffer state stay
      // deterministic under rapid typing.
      const run = applySerial.current.then(async () => {
        if (!operationAdmission.current || origin !== ownerEpoch.current.generation) {reportOpError('The operation belongs to retired owner access. Your work remains open.'); return null;}
        const call = await kernelOp(transport, op);
        if (!operationAdmission.current || origin !== ownerEpoch.current.generation) {reportOpError('The owner changed while the operation was in progress. Reread its result before continuing.'); return null;}
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
    [merge, transport, reportOpError, epochKey],
  );

  const refreshListing = useCallback(async () => {
    if (epochKey !== ownerEpoch.current.key) return;
    const origin = ownerEpoch.current.generation;
    if (!operationAdmission.current) return;
    const call = await kernelOp(transport, { op: "sources_list" });
    if (!operationAdmission.current || origin !== ownerEpoch.current.generation) return;
    if (call.outcome && call.outcome.result === "sources_listed") {
      merge(call.outcome);
      setListingError(null);
    } else {
      setListingError(call.error ?? "the listing did not serve");
    }
  }, [merge, transport, epochKey]);

  const openSource = useCallback(
    async (sourceRef: SourceRef, surfaceId: string) => {
      const origin = ownerEpoch.current.generation;
      if (!await apply({ op: "surface_open", surface_id: surfaceId, kind: "source", source_ref: sourceRef, title: sourceRef }) || origin !== ownerEpoch.current.generation) return;
      if (!await apply({ op: "source_open", source_ref: sourceRef }) || origin !== ownerEpoch.current.generation) return;
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

  // Bootstrap: pull the state, subscribe to the topic, and re-sync the log
  // once by cursor (the command the unit requires the host to expose).
  useEffect(() => {
    let alive = true;
    const origin = ownerEpoch.current.generation;
    publishOperationAdmission(false);
    if (receiptOwner.current !== epochKey) {
      receiptOwner.current = epochKey;
      seenSeq.current = 0;
      deliveredSeq.current = 0;
      setReceipts([]);
    }
    const current = () => alive && origin === ownerEpoch.current.generation;
    let subscription: { unsubscribe: () => void } | null = null;
    let resync: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const initial = await kernelOp(transport, { op: "state" });
      if (!current()) return;
      if (initial.outcome && initial.outcome.result === "state") {
        merge(initial.outcome);
        publishOperationAdmission(true);
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
        if (current()) {
          if (groundCall.error || groundCall.outcome?.result !== "ground_reading") {
            setBoot({ phase: "ground-inaccessible", detail: groundCall.error ?? "Central's ground status could not be read" });
          } else {
            const personalGround = (groundCall.outcome.reading as Record<string, unknown>).personal_ground;
            if (typeof personalGround !== "string") {
              setBoot({ phase: "ground-unrecognised", detail: "No default Central selected" });
            } else {
              const recognizeCall = await kernelOp(transport, { op: "ground", request: { action: "recognize", path: personalGround } });
              if (current()) {
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
      // The replay-stage client qualifies its backlog reads by owner
      // generation; a transport without retained history (embedded hosts,
      // controlled harnesses) refuses honestly. Live receipts still arrive
      // through the subscription below; the backlog never blocks the boot.
      try {
        const backlog = await eventsSince(transport, 1);
        if (current()) admitReceipts(backlog);
      } catch {
        if (current()) admitReceipts([]);
      }
      // Other native windows share this kernel, so pushed receipts mean this
      // window's pulled state may be behind. The re-pull is coalesced: a
      // burst of receipts is one trailing `state` read, not one per receipt
      // (every read is a process spawn on the shared kernel seam).
      const requestResync = () => {
        if (resync) clearTimeout(resync);
        resync = setTimeout(() => {
          resync = null;
          if (!alive) return;
          const generation = ownerEpoch.current.generation;
          void kernelOp(transport, { op: "state" }).then(call => { if (alive && operationAdmission.current && generation === ownerEpoch.current.generation && call.outcome) merge(call.outcome); });
        }, 200);
      };
      subscription = await subscribeTopic(transport, (receipt) => {
        if (!alive) return;
        admitReceipts([receipt]);
        if (transport.kind === "tauri") requestResync();
      }, async (page, lifetime) => {
        if (!alive || !lifetime.isCurrent()) return;
        ++ownerEpoch.current.generation;
        publishOperationAdmission(false);
        callbacks.current.onAccessRetired?.();
        const call = await kernelOp(transport, {op: 'world_read'}, lifetime.signal);
        if (!alive || !lifetime.isCurrent()) return;
        if (call.error || call.outcome?.result !== 'world_read') throw Error(call.error ?? 'The native World did not return its recovery snapshot');
        merge(call.outcome);
        seenSeq.current = page.latest_seq;
        deliveredSeq.current = page.latest_seq;
        setReceipts([]);
        await callbacks.current.onResync?.(page, lifetime);
        if (alive && lifetime.isCurrent()) publishOperationAdmission(true);
      }, error => {if (alive) {reportOpError(error); subscriptionError.current = {message: error, revision: opErrorRevision.current}; callbacks.current.onSubscriptionError?.(error);}},
      () => {if (alive) {
        // A qualified replay clears its own transport failure only. A newer
        // operation refusal remains available for the human to inspect.
        if (subscriptionError.current !== null && opErrorRevision.current === subscriptionError.current.revision && lastOpError.current === subscriptionError.current.message) reportOpError(null);
        subscriptionError.current = null;
        callbacks.current.onSubscriptionHealthy?.();
      }});
      if (!alive) subscription?.unsubscribe();
    })();
    return () => {
      alive = false;
      publishOperationAdmission(false);
      ++ownerEpoch.current.generation;
      if (resync) clearTimeout(resync);
      subscription?.unsubscribe();
    };
  }, [admitReceipts, merge, transport, epochKey, publishOperationAdmission]);

  const api: KernelApi = useMemo(
    () => ({
      transport,
      boot,
      stateSettled,
      operationReady: operationReady && operationAdmission.current,
      snapshot,
      receipts,
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
      operationReady,
      snapshot,
      receipts,
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

  return <KernelApiProvider value={api}>{props.children}</KernelApiProvider>;
}
