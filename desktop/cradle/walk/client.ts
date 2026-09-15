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
import {
  FOCUSED_INSTRUMENT_CONTRACT,
  focusedInstrumentSource,
  registerFocusedInstrumentSource,
  requestFocusedInstrumentOpen,
  type BimbaNavigation,
  type FocusedInstrumentCommand,
  type FocusedInstrumentSnapshot,
  type RetainedExpressionLease,
} from "../src/instrument/source";

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

/** What the controlled focused-instrument double has observed. */
export interface WalkInstrumentData {
  registered: boolean;
  available: boolean | null;
  commands: Array<Record<string, unknown>>;
  lease_events: string[];
  attached: boolean;
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
    /** The Global Expression Stage's bounded inspection: presentations,
     * engine capabilities, and whether the window surface's clock is held. */
    stage(): Promise<WalkReceipt<{ paused: boolean | null; presentations: Array<{ id: string; plane: string }> }>>;
  };
  capture: {
    /** In-page timing measurements (cold-start FCP lives here). */
    timing(): Promise<WalkReceipt<WalkTimingData>>;
    /** Snapshot the event receipts with their seq numbers at capture time. */
    events(sinceSeq?: number): Promise<WalkReceipt<WalkEventsData & { captured_at: string }>>;
  };
  /** The focused-instrument seam (K9). Registering a source here is exactly
   * what an external QL adapter does at runtime; the channel adds no
   * renderer authority — the double records what the composition did with
   * the real stage lease and serves contract-shaped snapshots. */
  instrument: {
    /** Register a controlled source double carrying a valid contract snapshot. */
    register(source: { ref: string; title?: string; snapshot: Record<string, unknown>; bimba: Record<string, unknown> }): Promise<WalkReceipt<{ ref: string }>>;
    /** Patch the double's snapshot and notify its subscribers. */
    drive(ref: string, snapshot: Record<string, unknown>): Promise<WalkReceipt<{ available: boolean }>>;
    /** Ask the workspace owner to open the privileged composition. */
    requestOpen(ref: string, title?: string): Promise<WalkReceipt<{ requested: boolean }>>;
    /** What the double observed: commands the composition sent, lease
     * events (checkpoint/pause/recovery/…), attachment state. */
    read(ref: string): Promise<WalkReceipt<WalkInstrumentData>>;
    /** Deregister (the honest source-absent path on a live binding). */
    unregister(ref: string): Promise<WalkReceipt<{ registered: boolean }>>;
    /** Register an externally constructed source object (the controlled-host
     * path: the QL adapter builds its own session; the channel only hands it
     * to the registry). The object must already sit on
     * `globalThis.__k9ExternalSources[ref]`. */
    registerExisting(ref: string): Promise<WalkReceipt<{ registered: boolean }>>;
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

// ---------------------------------------------------------------------------
// The controlled focused-instrument double (K9 walk source)
//
// A contract-shaped FocusedInstrumentSource whose QL side is a recording
// stand-in: snapshots/bimba are supplied by the scenario, commands apply
// their honest minimal state change and are recorded, and the real stage
// lease the composition hands over is wrapped so every checkpoint, pause,
// resume and recovery phase is observed without serialising GPU objects.

interface InstrumentDouble {
  handle: Parameters<typeof registerFocusedInstrumentSource>[0];
  snapshot: FocusedInstrumentSnapshot;
  bimba: BimbaNavigation;
  commands: FocusedInstrumentCommand[];
  leaseEvents: string[];
  lease: RetainedExpressionLease | null;
  listeners: Set<() => void>;
}

const doubles = new Map<string, InstrumentDouble>();
const doubleStops = new Map<string, () => void>();
const EVENT_CAP = 64;

function note(double: InstrumentDouble, event: string): void {
  double.leaseEvents = [...double.leaseEvents.slice(-(EVENT_CAP - 1)), event];
}

function notify(double: InstrumentDouble): void {
  for (const listener of double.listeners) listener();
}

/** Apply the minimal honest state change a command implies, mirroring what
 * a QL owner would answer. Unknown commands apply nothing (still applied —
 * the double owns its own state law; refusals are the producer's judgement). */
function applyCommand(double: InstrumentDouble, command: FocusedInstrumentCommand): void {
  const snapshot = double.snapshot;
  switch (command.kind) {
    case "set-focus":
      snapshot.focus = { ...snapshot.focus, focus: command.focus, available: true, current: true };
      break;
    case "select-bimba":
      snapshot.selection = command.selection;
      snapshot.selection_standing = "current";
      double.bimba = { ...double.bimba, selected_ref: command.selection.selection_ref };
      break;
    case "clear-selection":
      snapshot.selection = null;
      snapshot.selection_standing = null;
      double.bimba = { ...double.bimba, selected_ref: null };
      break;
    case "set-tracking":
      snapshot.tracking = command.tracking;
      break;
    case "freeze":
      snapshot.temporal = "frozen";
      break;
    case "resume-live":
      snapshot.temporal = "live";
      break;
    case "assemble-clock":
      snapshot.clock = { ...snapshot.clock, presentation: { view: "assembled" } };
      break;
    case "explode-clock":
      snapshot.clock = { ...snapshot.clock, presentation: { view: "exploded", pair: command.pair ?? null } };
      break;
    default:
      break;
  }
}

/** Minimal structural shapes for the walk binding's GPU work. The cradle
 * never imports three directly (the engine is vendored plain JS), so the
 * double loads it dynamically and speaks to it through these shapes only. */
interface WalkRenderTarget { texture: unknown; dispose(): void }
interface WalkRenderer {
  readRenderTargetPixels(target: WalkRenderTarget, x: number, y: number, width: number, height: number, buffer: Float32Array): void;
  copyTextureToTexture(source: { data: Float32Array; needsUpdate: boolean; dispose(): void }, destination: unknown): void;
}
interface WalkThree {
  WebGLRenderTarget: new (width: number, height: number, options: {
    minFilter: number; magFilter: number; format: number; type: number;
    depthBuffer: boolean; stencilBuffer: boolean;
  }) => WalkRenderTarget;
  DataTexture: new (data: Float32Array, width: number, height: number, format: number, type: number) => { data: Float32Array; needsUpdate: boolean; dispose(): void };
  Vector2: new (x?: number, y?: number) => unknown;
  RGBAFormat: number;
  FloatType: number;
  NearestFilter: number;
}

function makeDouble(source: { ref: string; title?: string; snapshot: Record<string, unknown>; bimba: Record<string, unknown> }): InstrumentDouble {
  const snapshot = source.snapshot as unknown as FocusedInstrumentSnapshot;
  if (snapshot.schema !== FOCUSED_INSTRUMENT_CONTRACT) {
    throw new Error(`Controlled source snapshot must be ${FOCUSED_INSTRUMENT_CONTRACT}, got ${String(snapshot.schema)}`);
  }
  const double: InstrumentDouble = {
    handle: {
      ref: source.ref,
      title: source.title ?? "Epi / Nara (controlled)",
      async read() { return structuredClone(double.snapshot); },
      async readBimba() { return structuredClone(double.bimba); },
      async command(command: FocusedInstrumentCommand) {
        double.commands = [...double.commands.slice(-31), structuredClone(command)];
        applyCommand(double, command);
        notify(double);
        return { standing: "applied" as const, operation: command.kind, snapshot: structuredClone(double.snapshot) };
      },
      subscribe(listener: () => void) {
        double.listeners.add(listener);
        return () => double.listeners.delete(listener);
      },
      attachExpression(lease: RetainedExpressionLease) {
        // The walk's stand-in binding: take the retained port, own real GPU
        // targets, and answer checkpoint/restore exactly as the admitted law
        // requires — so the composition exercises the real engine lease
        // lifecycle without reproducing QL's sample-correspondence law.
        return (async () => {
          if (double.lease) throw new Error("focused expression already attached");
          const port = lease.retainedTargetPort() as {
            texWidth: number; texHeight: number;
            setTargetTextures(a: unknown, b: unknown, centre: unknown): void;
          };
          note(double, "port");
          const THREE = (await import("three" as string)) as unknown as WalkThree;
          const makeTarget = () => new THREE.WebGLRenderTarget(port.texWidth, port.texHeight, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false,
          });
          const size = port.texWidth * port.texHeight * 4;
          const targets = [makeTarget(), makeTarget()];
          const readPixels = (renderer: WalkRenderer, target: WalkRenderTarget) => {
            const buffer = new Float32Array(size);
            renderer.readRenderTargetPixels(target, 0, 0, port.texWidth, port.texHeight, buffer);
            return buffer;
          };
          const centre = new THREE.Vector2();
          port.setTargetTextures(targets[0], targets[1], centre);
          note(double, "targets-own");
          // Wrap, observe, delegate: the real engine lease does the work; the
          // double only records what the composition asked of it.
          const observed: RetainedExpressionLease = {
            retainedTargetPort: () => lease.retainedTargetPort(),
            checkpointRetainedField: (binding) => { note(double, "checkpoint"); return lease.checkpointRetainedField(binding); },
            restoreRetainedField: (binding, checkpoint) => { note(double, "restore"); return lease.restoreRetainedField(binding, checkpoint); },
            onRecoveryRequired: (listener) => lease.onRecoveryRequired((phase) => { note(double, `recovery:${phase}`); listener(phase); }),
            inspect: () => lease.inspect(),
            pause: (value = true) => { note(double, value ? "paused" : "resumed"); return lease.pause(value); },
            resume: () => { note(double, "resumed"); return lease.resume(); },
            renderOnce: () => { note(double, "render-once"); return lease.renderOnce(); },
            updatePresentation: (request) => { note(double, "presentation"); return lease.updatePresentation(request); },
          };
          double.lease = observed;
          note(double, "attach");
          const binding = {
            checkpoint(renderer: WalkRenderer) {
              const taken = { pos: readPixels(renderer, targets[0]), vel: readPixels(renderer, targets[1]) };
              note(double, "checkpoint-taken");
              return taken;
            },
            restore(renderer: WalkRenderer, checkpoint: { pos: Float32Array; vel: Float32Array }) {
              targets.forEach((target) => target.dispose());
              targets[0] = makeTarget();
              targets[1] = makeTarget();
              port.setTargetTextures(targets[0], targets[1], centre);
              const upload = (data: Float32Array, target: WalkRenderTarget) => {
                const texture = new THREE.DataTexture(data, port.texWidth, port.texHeight, THREE.RGBAFormat, THREE.FloatType);
                texture.needsUpdate = true;
                renderer.copyTextureToTexture(texture, target.texture);
                texture.dispose();
              };
              upload(checkpoint.pos, targets[0]);
              upload(checkpoint.vel, targets[1]);
              note(double, "checkpoint-restored");
            },
          };
          const taken = observed.checkpointRetainedField(binding as unknown as Parameters<RetainedExpressionLease["checkpointRetainedField"]>[0]) as { pos: Float32Array; vel: Float32Array } | undefined;
          observed.onRecoveryRequired((phase) => {
            if (phase === "restored" && taken !== undefined) {
              observed.restoreRetainedField(binding as unknown as Parameters<RetainedExpressionLease["restoreRetainedField"]>[0], taken);
            }
          });
          note(double, "recovery-observed");
          return () => {
            note(double, "detach");
            double.lease = null;
            targets.forEach((target) => target.dispose());
          };
        })();
      },
    },
    snapshot,
    bimba: source.bimba as unknown as BimbaNavigation,
    commands: [],
    leaseEvents: [],
    lease: null,
    listeners: new Set(),
  };
  return double;
}

/** Build the channel over the live kernel API. The expression stage is
 * bound when the mount sits inside its provider (walk bundles do); ops
 * that need it report its absence honestly. */
export function createWalkChannel(
  kernel: KernelApi,
  readLayout:()=>LayoutState,
  stage?: { inspect(): Record<string, unknown> },
): CradleWalkChannel {
  const mountedAt = new Date().toISOString();

  /** One typed op through the provider's queue — THE seam, no other path. */
  const throughSeam = async (op: string, payload: KernelOp) =>
    timed<{ outcome: KernelOpResult }>(op, async () => {
      const outcome = await kernel.apply(payload);
      if (!outcome) {
        // The provider resolves kernel refusals to a null outcome and
        // records the reason on its stable last-op-error ref; ops are
        // serialised, so the reason on the API right now is this op's
        // reason. The React-state fallback covers providers that predate
        // the ref.
        return { error: kernel.lastOpError?.() ?? kernel.opError ?? "the operation produced no outcome" };
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
            return { error: kernel.lastOpError?.() ?? kernel.opError ?? "the state read did not serve" };
          }
          return { data: outcome.snapshot };
        }),
      focus: () =>
        timed("read.focus", async () => {
          const outcome = await kernel.apply({ op: "state" });
          if (!outcome || outcome.result !== "state") {
            return { error: kernel.lastOpError?.() ?? kernel.opError ?? "the focus read did not serve" };
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
        timed("read.layout", async () => ({ data: { layout: structuredClone(readLayout()) } })),
      stage: () =>
        timed<{ paused: boolean | null; presentations: Array<{ id: string; plane: string }> }>("read.stage", async () => {
          if (!stage) return { error: "the expression stage is not bound to this channel" };
          const inspect = stage.inspect() as { paused?: boolean | null; presentations?: Array<{ id: string; plane: string }> };
          return { data: { paused: inspect.paused ?? null, presentations: inspect.presentations ?? [] } };
        }),
    },
    capture: {
      timing: () => timed("capture.timing", async () => ({ data: await timingData() })),
      events: (sinceSeq = 0) =>
        timed("capture.events", async () => ({
          data: { ...eventsData(readEvents(sinceSeq), sinceSeq), captured_at: new Date().toISOString() },
        })),
    },
    instrument: {
      register: (source) =>
        timed<{ ref: string }>("instrument.register", async () => {
          // The same ref resurrects the SAME double: a returning owner is
          // one owner, not a second one — the composition's held lease and
          // the recorded history stay continuous across re-registration.
          const existing = doubles.get(source.ref);
          if (existing) {
            existing.snapshot = source.snapshot as unknown as FocusedInstrumentSnapshot;
            existing.bimba = source.bimba as unknown as BimbaNavigation;
            if (!focusedInstrumentSource(source.ref)) {
              doubleStops.set(source.ref, registerFocusedInstrumentSource(existing.handle));
            }
            return { data: { ref: source.ref } };
          }
          const double = makeDouble(source);
          doubleStops.set(source.ref, registerFocusedInstrumentSource(double.handle));
          doubles.set(source.ref, double);
          return { data: { ref: source.ref } };
        }),
      drive: (ref, snapshot) =>
        timed<{ available: boolean }>("instrument.drive", async () => {
          const double = doubles.get(ref);
          if (!double) return { error: `controlled source ${ref} is not registered` };
          double.snapshot = { ...double.snapshot, ...snapshot } as FocusedInstrumentSnapshot;
          notify(double);
          return { data: { available: double.snapshot.available } };
        }),
      requestOpen: (ref, title) =>
        timed<{ requested: boolean }>("instrument.requestOpen", async () => {
          requestFocusedInstrumentOpen(ref, title);
          return { data: { requested: true } };
        }),
      read: (ref) =>
        timed<WalkInstrumentData>("instrument.read", async () => {
          const double = doubles.get(ref);
          if (!double) return { error: `controlled source ${ref} is not registered` };
          return {
            data: {
              registered: true,
              available: double.snapshot.available,
              commands: double.commands as Array<Record<string, unknown>>,
              lease_events: double.leaseEvents,
              attached: double.lease !== null,
            },
          };
        }),
      unregister: (ref) =>
        timed<{ registered: boolean }>("instrument.unregister", async () => {
          const double = doubles.get(ref);
          if (!double) return { error: `controlled source ${ref} is not registered` };
          doubleStops.get(ref)?.();
          doubleStops.delete(ref);
          doubles.delete(ref);
          return { data: { registered: false } };
        }),
      registerExisting: (ref) =>
        timed<{ registered: boolean }>("instrument.registerExisting", async () => {
          const external = (globalThis as unknown as { __k9ExternalSources?: Record<string, unknown> }).__k9ExternalSources?.[ref];
          if (!external) return { error: `no externally constructed source sits at __k9ExternalSources.${ref}` };
          doubleStops.set(ref, registerFocusedInstrumentSource(external as Parameters<typeof registerFocusedInstrumentSource>[0]));
          return { data: { registered: true } };
        }),
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
export function bindWalkChannel(
  kernel: KernelApi,
  readLayout:()=>LayoutState,
  stage?: { inspect(): Record<string, unknown> },
): CradleWalkChannel {
  const channel = createWalkChannel(kernel,readLayout,stage);
  window.__cradle = { ...(window.__cradle ?? {}), walk: channel };
  return channel;
}

/** Remove the channel (symmetry for tests of the mount itself). */
export function unbindWalkChannel(): void {
  if (window.__cradle) delete window.__cradle.walk;
}
