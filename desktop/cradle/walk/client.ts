/**
 * The walk harness typed client (U0.6, map §3 D10) — the `__cradle.walk`
 * channel: "a typed, dev-only channel in the cradle: invoke operations,
 * read state, capture receipts/screenshots. Dev tooling only — no new
 * renderer authority."
 *
 * THE LAW THIS FILE KEEPS — no second authority path:
 *
 * - Every invoke/read goes through the SAME `KernelOp` seam the app uses.
 *   The channel is bound to the live `KernelApi` (KernelProvider), so its
 *   ops enter the provider's one serialised `apply` queue and merge into
 *   the same read models the surfaces render. The channel cannot reach the
 *   kernel, the bridge, the filesystem, or the shell by any route the app
 *   itself does not already use.
 * - The channel moves no pixels. It can drive the kernel's semantic
 *   relations (e.g. the one global focus) and read state; it cannot make
 *   the renderer present anything — presentation follows the app's own
 *   reconciliation, exactly as for any other kernel event.
 * - It mounts only in dev/walk bundles (`vite serve` or `WALK=1 vite
 *   build`); a plain production build dead-code-eliminates the mount, so
 *   the string `__cradle` never reaches a production bundle (walk/README
 *   documents the grep proof).
 *
 * Op categories (map §5 U0.6):
 *   invoke  — open/save/focus/surface ops as typed calls over KernelOp
 *   read    — kernel state: event log, sources, focus, layout
 *   capture — timing measurement + event-receipt snapshots with seq
 *             numbers (screenshots are taken by the runner, which owns the
 *             browser; they land in walk/artifacts/ beside the receipts)
 *
 * Every op returns one typed receipt: {ok, op, seq_range?, duration_ms,
 * data}. `seq_range` is the inclusive receipt-seq range the op produced
 * (absent when it produced none — an honest no-op is data, not failure).
 */

import type { KernelApi } from "../src/kernel/KernelProvider";
import type {
  KernelOp,
  KernelOpResult,
  KernelReceipt,
  KernelSnapshotState,
  SourceListingState,
} from "../src/kernel/types";
import type { LayoutState } from "../src/surface/types";
import { loadLayout } from "../src/surface/persist";

/** Schema of the walk channel contract. */
export const WALK_CHANNEL_SCHEMA = "oi.cradle.walk/v1";

/** The inclusive span of receipt seqs one operation produced. */
export interface WalkSeqRange {
  from: number;
  to: number;
}

/** What every walk op returns — the receipt the runner records as data. */
export interface WalkReceipt<TData = unknown> {
  ok: boolean;
  op: string;
  seq_range?: WalkSeqRange;
  duration_ms: number;
  data?: TData;
  error?: string;
}

// ---------------------------------------------------------------------------
// Data payloads

export interface WalkEventsData {
  receipts: KernelReceipt[];
  count: number;
  first_seq: number | null;
  last_seq: number | null;
  /** Present when the read was scoped to a cursor. */
  since_seq?: number;
}

export interface WalkTimingData {
  /** First contentful paint, ms from navigation start (null = not observed). */
  fcp_ms: number | null;
  dom_content_loaded_ms: number | null;
  load_ms: number | null;
}

export interface WalkInfoData {
  schema: string;
  mounted_at: string;
  transport: KernelApi["transport"];
  url: string;
}

// ---------------------------------------------------------------------------
// The channel surface

export interface CradleWalkChannel {
  invoke: {
    /** Apply any typed KernelOp directly — the seam primitive the named
     * conveniences below wrap. Same queue, same merge, same receipts. */
    kernel_op(op: KernelOp): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Open a source into the buffer layer through the owner's read. */
    source_open(sourceRef: string, project?: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Set the cradle-held buffer content (the dirty layer). */
    source_edit(sourceRef: string, content: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** CAS-save the buffer through the owner's write. */
    source_save(sourceRef: string, project?: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Re-read the canonical layer (the conflict reconcile path). */
    source_reread(sourceRef: string, project?: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Make a surface binding's ref the one current focus subject — the
     * real focus relation op; emits focus_changed only when it moves. */
    surface_focus(surfaceId: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Register a surface binding kernel-side. Bindings belong to the
     * frame — the app reconciles them against its layout; walks drive
     * binding changes through the real UI (keyboard/pointer). */
    surface_open(args: {
      surface_id: string;
      kind: string;
      source_ref?: string;
      title: string;
    }): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
    /** Close a surface binding kernel-side (same reconciliation law). */
    surface_close(surfaceId: string): Promise<WalkReceipt<{ outcome: KernelOpResult }>>;
  };
  read: {
    /** The whole kernel state (pulled through the seam, emits nothing). */
    state(): Promise<WalkReceipt<KernelSnapshotState>>;
    /** The one global focus relation as it stands. */
    focus(): Promise<WalkReceipt<KernelSnapshotState["focus"]>>;
    /** The ordered event log after `since` (all receipts when omitted). */
    events(sinceSeq?: number): Promise<WalkReceipt<WalkEventsData>>;
    /** The project's participating sources as the owner disclosed them. */
    sources(project?: string): Promise<WalkReceipt<SourceListingState>>;
    /** The frame's persisted layout state — the presentation read model. */
    layout(): Promise<WalkReceipt<{ layout: LayoutState | null }>>;
  };
  capture: {
    /** In-page timing measurements (cold-start FCP lives here). */
    timing(): Promise<WalkReceipt<WalkTimingData>>;
    /** Snapshot the event receipts with their seq numbers at capture time. */
    events(sinceSeq?: number): Promise<WalkReceipt<WalkEventsData & { captured_at: string }>>;
  };
  /** Channel identity — schema, transport, mount time. */
  info(): Promise<WalkReceipt<WalkInfoData>>;
}

declare global {
  interface Window {
    __cradle?: { walk?: CradleWalkChannel };
  }
}

// ---------------------------------------------------------------------------
// Implementation

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function seqRangeOf(receipts: KernelReceipt[]): WalkSeqRange | undefined {
  if (receipts.length === 0) return undefined;
  return { from: receipts[0].seq, to: receipts[receipts.length - 1].seq };
}

interface OpRun<TData> {
  data?: TData;
  error?: string;
  receipts?: KernelReceipt[];
}

/** Time one op, fold its receipts into a seq range, never throw — a walk
 * receipt records failure as data. */
async function timed<TData>(op: string, run: () => Promise<OpRun<TData>>): Promise<WalkReceipt<TData>> {
  const started = performance.now();
  try {
    const outcome = await run();
    const receipt: WalkReceipt<TData> = {
      ok: outcome.error === undefined,
      op,
      duration_ms: roundMs(performance.now() - started),
    };
    const range = seqRangeOf(outcome.receipts ?? []);
    if (range) receipt.seq_range = range;
    if (outcome.data !== undefined) receipt.data = outcome.data;
    if (outcome.error !== undefined) receipt.error = outcome.error;
    return receipt;
  } catch (error) {
    return {
      ok: false,
      op,
      duration_ms: roundMs(performance.now() - started),
      error: String(error),
    };
  }
}

function eventsData(receipts: KernelReceipt[], sinceSeq: number): WalkEventsData {
  const span = seqRangeOf(receipts);
  return {
    receipts,
    count: receipts.length,
    first_seq: span ? span.from : null,
    last_seq: span ? span.to : null,
    ...(sinceSeq > 0 ? { since_seq: sinceSeq } : {}),
  };
}

/** Build the channel over the live kernel API. */
export function createWalkChannel(kernel: KernelApi): CradleWalkChannel {
  const mountedAt = new Date().toISOString();

  /** One typed op through the provider's queue — THE seam, no other path. */
  const throughSeam = async (op: string, payload: KernelOp) =>
    timed<{ outcome: KernelOpResult }>(op, async () => {
      const outcome = await kernel.apply(payload);
      if (!outcome) {
        // The provider resolves kernel refusals to a null outcome and
        // records the reason on opError; ops are serialised, so the reason
        // on the API right now is this op's reason.
        return { error: kernel.opError ?? "the operation produced no outcome" };
      }
      // The receipts ride the receipt envelope (seq_range); the data carries
      // the outcome's result payload without duplicating them.
      const { receipts, ...result } = outcome;
      return {
        data: { outcome: result },
        receipts: receipts ?? [],
      };
    });

  const readEvents = (sinceSeq = 0): KernelReceipt[] =>
    kernel.receipts.filter((receipt) => receipt.seq > sinceSeq);

  /** First contentful paint, ms from navigation start — buffered observer
   * fallback, because the paint entry can land moments after the load
   * event (null only if genuinely never observed within the grace window). */
  const firstContentfulPaint = (): Promise<number | null> =>
    new Promise((resolve) => {
      const observed = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint");
      if (observed) return resolve(observed.startTime);
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            observer.disconnect();
            resolve(entry.startTime);
          }
        }
      });
      observer.observe({ type: "paint", buffered: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 2_000);
    });

  const timingData = async (): Promise<WalkTimingData> => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const fcp = await firstContentfulPaint();
    return {
      fcp_ms: fcp === null ? null : roundMs(fcp),
      dom_content_loaded_ms: navigation ? roundMs(navigation.domContentLoadedEventEnd) : null,
      load_ms: navigation ? roundMs(navigation.loadEventEnd) : null,
    };
  };

  return {
    invoke: {
      kernel_op: (op) => throughSeam(`invoke.${op.op}`, op),
      source_open: (sourceRef, project) =>
        throughSeam("invoke.source_open", { op: "source_open", source_ref: sourceRef, ...(project ? { project } : {}) }),
      source_edit: (sourceRef, content) =>
        throughSeam("invoke.source_edit", { op: "source_edit", source_ref: sourceRef, content }),
      source_save: (sourceRef, project) =>
        throughSeam("invoke.source_save", { op: "source_save", source_ref: sourceRef, ...(project ? { project } : {}) }),
      source_reread: (sourceRef, project) =>
        throughSeam("invoke.source_reread", { op: "source_reread", source_ref: sourceRef, ...(project ? { project } : {}) }),
      surface_focus: (surfaceId) =>
        throughSeam("invoke.surface_focus", { op: "surface_focus", surface_id: surfaceId }),
      surface_open: (args) => throughSeam("invoke.surface_open", { op: "surface_open", ...args }),
      surface_close: (surfaceId) =>
        throughSeam("invoke.surface_close", { op: "surface_close", surface_id: surfaceId }),
    },
    read: {
      state: () =>
        timed("read.state", async () => {
          const outcome = await kernel.apply({ op: "state" });
          if (!outcome || outcome.result !== "state") {
            return { error: kernel.opError ?? "the state read did not serve" };
          }
          return { data: outcome.snapshot };
        }),
      focus: () =>
        timed("read.focus", async () => {
          const outcome = await kernel.apply({ op: "state" });
          if (!outcome || outcome.result !== "state") {
            return { error: kernel.opError ?? "the focus read did not serve" };
          }
          return { data: outcome.snapshot.focus };
        }),
      events: (sinceSeq = 0) =>
        timed("read.events", async () => ({ data: eventsData(readEvents(sinceSeq), sinceSeq) })),
      sources: (project) =>
        timed("read.sources", async () => {
          const outcome = await kernel.apply({
            op: "sources_list",
            ...(project ? { project } : {}),
          });
          if (!outcome || outcome.result !== "sources_listed") {
            return { error: kernel.opError ?? "the listing did not serve" };
          }
          return { data: outcome.listing };
        }),
      layout: () =>
        timed("read.layout", async () => ({ data: { layout: loadLayout() } })),
    },
    capture: {
      timing: () => timed("capture.timing", async () => ({ data: await timingData() })),
      events: (sinceSeq = 0) =>
        timed("capture.events", async () => ({
          data: { ...eventsData(readEvents(sinceSeq), sinceSeq), captured_at: new Date().toISOString() },
        })),
    },
    info: () =>
      timed("info", async () => ({
        data: {
          schema: WALK_CHANNEL_SCHEMA,
          mounted_at: mountedAt,
          transport: kernel.transport,
          url: location.href,
        } as WalkInfoData,
      })),
  };
}

/** Mount the channel on `window.__cradle.walk` (dev/walk bundles only —
 * the mount itself is dynamically imported behind the build gate in
 * Cradle.tsx, so production never carries this code). */
export function bindWalkChannel(kernel: KernelApi): CradleWalkChannel {
  const channel = createWalkChannel(kernel);
  window.__cradle = { ...(window.__cradle ?? {}), walk: channel };
  return channel;
}

/** Remove the channel (symmetry for tests of the mount itself). */
export function unbindWalkChannel(): void {
  if (window.__cradle) delete window.__cradle.walk;
}
