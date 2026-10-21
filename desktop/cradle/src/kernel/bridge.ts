/**
 * The kernel bridge (U0.4) — how the renderer reaches the kernel seam.
 *
 * Three honest transports, in order:
 *   1. Tauri — the real host: `kernel_op` command + `kernel_event_log`
 *      command + the `oi:kernel-event` topic push (the typed seam the unit
 *      requires).
 *   2. The dev-only walk bridge (map §3 D10) — same typed ops over HTTP,
 *      injected by a walk (`window.__OI_KERNEL_BRIDGE__`) or baked for
 *      development (`VITE_KERNEL_BRIDGE`). Development tooling only; it
 *      grants no renderer authority beyond the same KernelOp seam.
 *   3. Unavailable — an honest observation, never a crash (law 7): the
 *      app runs; kernel-backed surfaces disclose their absence.
 */

import type {
  KernelOp,
  KernelOutcome,
  KernelReceipt,
  KernelTransportStatus,
  KernelEventReplay,
} from "./types";

export type {KernelEventReplay} from "./types";

const TOPIC = "oi:kernel-event";

declare global {
  interface Window {
    __OI_KERNEL_BRIDGE__?: string;
    __TAURI_INTERNALS__?: unknown;
  }
}

export function detectTransport(): KernelTransportStatus {
  const injected = typeof window !== "undefined" ? window.__OI_KERNEL_BRIDGE__ : undefined;
  if (injected) return { kind: "bridge", url: injected };
  const baked = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_KERNEL_BRIDGE;
  if (baked) return { kind: "bridge", url: baked };
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    return { kind: "tauri" };
  }
  return {
    kind: "unavailable",
    reason:
      "no kernel transport: neither the Tauri host nor a dev walk bridge is reachable",
  };
}

export async function tauriInvoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(command, args);
}

/** What applying one typed kernel operation produced. `outcome` is null
 * only when the transport itself could not serve (unavailable / network);
 * a kernel-level refusal arrives as `error`, honestly labelled. */
export interface KernelOpCall {
  outcome: KernelOutcome | null;
  error?: string;
}

/** The Rust seam omits empty receipts (`skip_serializing_if`); normalise
 * so every outcome carries its receipts array — an operation that changed
 * nothing honestly shows an empty list. */
function normaliseOutcome(outcome: KernelOutcome): KernelOutcome {
  if (outcome.result === "hosted_native") {
    const native = outcome.outcome;
    // Native cursor belongs to (World, owner generation). Keep it inspectable
    // without feeding it into this body's independent kernel event stream.
    return {...native,receipts:[],native_owner:{world_ref:outcome.source_world_ref,
      owner_generation:outcome.owner_generation,receipts:native.receipts??[]}};
  }
  return { ...outcome, receipts: outcome.receipts ?? [] };
}

export async function kernelReadSend(
  transport: KernelTransportStatus,
  op: KernelOp,
  signal?: AbortSignal,
): Promise<KernelOpCall> {
  try {
    if (transport.kind === "tauri") {
      const outcome = await tauriInvoke<KernelOutcome>("kernel_op", { op });
      return { outcome: outcome ? normaliseOutcome(outcome) : null };
    }
    if (transport.kind === "bridge") {
      const response = await fetch(`${transport.url}/op`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op),
        signal,
      });
      const body = (await response.json()) as { ok: boolean; outcome?: KernelOutcome; error?: string };
      if (!body.ok) return { outcome: null, error: body.error ?? "the kernel refused the operation" };
      return { outcome: body.outcome ? normaliseOutcome(body.outcome) : null };
    }
    return { outcome: null, error: transport.reason };
  } catch (error) {
    return { outcome: null, error: String(error) };
  }
}

/** Ops that change what an owner holds, whatever else they return: an op in this set, or a mixed op whose request is not a read,
 * tells the window's held readings that they may no longer be the owner's (`onKernelWrite`). Over-telling costs a re-read, never a
 * wrong answer. */
const WRITING_OPS: ReadonlySet<string> = new Set(["invoke_action", "file_operation", "decide", "decision_episode_revoke", "decision_preflight", "theme_import", "theme_apply", "theme_revert", "theme_remove",
  "nara_decision_record", "live_device_param_write", "live_clip_write", "live_track_mixer_write", "live_take_comp", "live_groove_pool_write", "harness_agent_control", "chat_default_hold",
  "chat_default_discard", "credential_setup", "credential_rotate", "credential_revoke", "client_install", "product_action_run", "dictation_configure", "working_surface_attachment",
  "encounter_provision", "flow_participant_provision", "receiving", "factory_owner", "config_apply_reviewed", "encounter", "a2a_exchange", "routine", "shared_field", "ground", "setup"]);
const READING_REQUESTS: ReadonlySet<string> = new Set(["inspect", "index", "list", "read", "find_checkpoint", "source-location", "agent-set", "open-day", "roster"]);
export function writesOwner(op: KernelOp): boolean {
  if (WRITING_OPS.has(op.op)) return true;
  const request = (op as { request?: { kind?: unknown; operation?: unknown; action?: unknown } }).request;
  if (op.op === "central" || op.op === "now" || op.op === "page" || op.op === "expression" || op.op === "expression_recovery" || op.op === "encounter_session_settings" || op.op === "knowledge" || op.op === "agent_definition") {
    const kind = request?.kind ?? request?.operation ?? request?.action;
    return typeof kind === "string" ? !READING_REQUESTS.has(kind) && !/^(?:read|list|inspect|search|relations|resolve|status)/.test(kind) : false;
  }
  return false;
}
const writeListeners = new Set<() => void>();
/** Hear that an op which may change an owner's ground completed. */
export function onKernelWrite(listener: () => void): () => void { writeListeners.add(listener); return () => { writeListeners.delete(listener); }; }

export async function kernelOp(
  transport: KernelTransportStatus,
  op: KernelOp,
  signal?: AbortSignal,
): Promise<KernelOpCall> {
  const call = await kernelReadSend(transport, op, signal);
  if (!call.error && writesOwner(op)) for (const listener of [...writeListeners]) listener();
  return call;
}

/** What holds a read of the kernel for the window: one answer per op and transport, asked once however many readers want it, kept
 * until the kernel says its sources moved (the shell installs it, packages/live-shell/ui/src/owners/ownerCall.ts). Without one a
 * read goes to the kernel each time (a host with no shared store, a test). */
export type KernelReadHolder = (transport: KernelTransportStatus, op: KernelOp, fresh: boolean) => Promise<KernelOpCall>;
let readHolder: KernelReadHolder | null = null;
export function installKernelReadHolder(holder: KernelReadHolder | null): void { readHolder = holder; }

/** A kernel op that only reads. It is answered from the window's held answer when one stands for the same op; `fresh` asks the
 * kernel again and replaces it. A write, or a read whose answer must be the owner's now, goes through `kernelOp`. */
export function kernelRead(transport: KernelTransportStatus, op: KernelOp, options: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<KernelOpCall> {
  if (readHolder && !options.signal) return readHolder(transport, op, options.fresh === true);
  return kernelReadSend(transport, op, options.signal);
}

const safeSequence = (value: unknown, minimum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;

function qualifyReplay(value: unknown, cursor: number, generation?: string): KernelEventReplay {
  const page = value as KernelEventReplay | undefined;
  if (!page || page.schema !== "oi.kernel-event-replay/v1"
    || typeof page.generation !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(page.generation)
    || !safeSequence(page.latest_seq, 0) || !safeSequence(page.next_seq, 1)
    || (page.oldest_seq !== null && !safeSequence(page.oldest_seq, 1))
    || (page.oldest_seq !== null && page.oldest_seq > page.latest_seq)
    || typeof page.resync_required !== "boolean" || typeof page.has_more !== "boolean"
    || !Array.isArray(page.receipts) || page.receipts.length > 128
    || new TextEncoder().encode(JSON.stringify(page)).byteLength > 512 * 1024) {
    throw new Error("Invalid native kernel event replay envelope");
  }
  if (page.resync_required) {
    if (page.receipts.length || page.has_more || page.next_seq !== page.latest_seq + 1) {
      throw new Error("Native kernel resync cannot carry partial receipts");
    }
    return page;
  }
  if ((generation !== undefined && generation !== page.generation)
    || (generation === undefined && cursor !== 1)
    || (page.receipts.length > 0 && page.oldest_seq === null)) {
    throw new Error("Native kernel replay lacks a qualified generation or retained origin");
  }
  let next = cursor;
  for (const receipt of page.receipts) {
    if (!receipt || receipt.schema !== "oi.kernel-event/v1" || receipt.version !== 1
      || !safeSequence(receipt.seq, 1) || receipt.seq !== next
      || receipt.seq > page.latest_seq || typeof receipt.event !== "string"
      || new TextEncoder().encode(JSON.stringify(receipt)).byteLength > 256 * 1024) {
      throw new Error("Native kernel replay is not a contiguous qualified sequence");
    }
    next++;
  }
  if (page.next_seq !== next || page.has_more !== (next <= page.latest_seq)
    || (page.has_more && !page.receipts.length)
    || (page.oldest_seq !== null && cursor < page.oldest_seq)
    || next > page.latest_seq + 1) {
    throw new Error("Invalid native kernel replay continuation");
  }
  return page;
}

/** Pull one exact generation/cursor page. Transport errors and resync remain
 * distinct; absence never becomes a fabricated empty history. */
/** The transport serves no retained-history route: distinct from a
 * refusal, so the subscription ends instead of retrying forever. */
export class ReplayServiceAbsent extends Error {}

/** One replay pull's own time bound over the dev bridge. */
export const REPLAY_TIMEOUT_MS = 10000;

/** The pull was aborted — by its own time bound or by its caller (a page
 * hidden, a subscription ended) — before the kernel's answer was read. It is
 * not the kernel's refusal: the kernel answered nothing the client could read,
 * and the subscription retries at its cursor as for any failed pull. */
export class ReplayAborted extends Error {
  readonly origin: "timeout" | "caller";
  constructor(origin: "timeout" | "caller") {
    super(origin === "timeout"
      ? `Kernel replay aborted: no answer read within ${REPLAY_TIMEOUT_MS} ms`
      : "Kernel replay aborted by its caller");
    this.origin = origin;
    this.name = "ReplayAborted";
  }
}

export function replayAborted(request: AbortSignal, timeout: AbortSignal, caller?: AbortSignal): ReplayAborted | null {
  if (!request.aborted) return null;
  return new ReplayAborted(caller?.aborted ? "caller" : timeout.aborted ? "timeout" : "caller");
}
export async function eventReplay(
  transport: KernelTransportStatus,
  cursor = 1,
  generation?: string,
  limit = 128,
  signal?: AbortSignal,
): Promise<KernelEventReplay> {
  if (!safeSequence(cursor, 1) || !safeSequence(limit, 1) || limit > 128
    || (generation !== undefined && !/^[A-Za-z0-9-]{1,128}$/.test(generation))) {
    throw new Error("Invalid kernel replay request");
  }
  signal?.throwIfAborted();
  if (transport.kind === "tauri") {
    const page = await tauriInvoke<KernelEventReplay>("kernel_event_log", { cursor, generation: generation ?? null, limit });
    return qualifyReplay(page, cursor, generation);
  }
  if (transport.kind === "bridge") {
    const query = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });
    if (generation !== undefined) query.set("generation", generation);
    const timeout = AbortSignal.timeout(REPLAY_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(`${transport.url}/event-replay?${query}`, { signal: requestSignal });
    } catch (error) {
      throw replayAborted(requestSignal, timeout, signal) ?? error;
    }
    // The body is read under the same signal: an abort while it streams is the
    // pull's own abort (its time bound or its caller), never the kernel's refusal.
    let body: { ok: boolean; replay?: unknown; error?: string };
    try {
      body = (await response.json()) as typeof body;
    } catch (error) {
      const aborted = replayAborted(requestSignal, timeout, signal);
      if (aborted) throw aborted;
      if (response.status === 404) throw new ReplayServiceAbsent("Kernel replay route absent on this transport");
      throw new Error(`Kernel replay unreadable (${response.status}): ${String(error)}`);
    }
    if (response.status === 404) {
      // This transport serves no retained-history route at all (embedded
      // hosts, controlled harnesses). Retrying would only spam its console:
      // the subscription ends, exactly like an unavailable transport.
      throw new ReplayServiceAbsent("Kernel replay route absent on this transport");
    }
    if (!response.ok || !body.ok) throw new Error(body.error ?? `Kernel replay refused (${response.status})`);
    return qualifyReplay(body.replay, cursor, generation);
  }
  throw new Error(transport.reason);
}

/** Guarded complete retained history for native protocol verification. A
 * resync/generation change refuses; callers cannot mistake a partial window
 * for a no-event proof. The first page's watermark bounds concurrent reads. */
export async function readEventHistory(transport: KernelTransportStatus, generation?: string, signal?: AbortSignal): Promise<{
  generation: string; oldest_seq: number | null; latest_seq: number; receipts: KernelReceipt[];
}> {
  let page = await eventReplay(transport, 1, generation, 128, signal);
  if (page.resync_required) throw new Error("Kernel replay expired: read current owner models instead of asserting history");
  const first = page, receipts: KernelReceipt[] = [], watermark = page.latest_seq;
  for (let count = 0; count < 32; count++) {
    receipts.push(...page.receipts.filter(receipt => receipt.seq <= watermark));
    if (!page.has_more || page.next_seq > watermark) {
      return { generation: first.generation, oldest_seq: first.oldest_seq, latest_seq: watermark, receipts };
    }
    page = await eventReplay(transport, page.next_seq, first.generation, 128, signal);
    if (page.resync_required) throw new Error("Kernel replay changed or expired while reading its retained window");
  }
  throw new Error("Kernel retained history did not complete within its bounded window");
}

/** Legacy in-process callers still get a strictly qualified complete window.
 * Reused cursors require the explicit generation-aware eventReplay API. */
export async function eventsSince(transport: KernelTransportStatus, sinceSeq: number): Promise<KernelReceipt[]> {
  if (sinceSeq > 1) throw new Error("Kernel continuation requires an explicit generation");
  return (await readEventHistory(transport)).receipts;
}

export interface TopicSubscription {
  unsubscribe: () => void;
}

/** Tauri push is an invalidation hint; both transports receive the same
 * bounded, generation-qualified pages. An expired window refreshes actual
 * owner models before adopting the returned continuation. */
export async function subscribeTopic(
  transport: KernelTransportStatus,
  onReceipt: (receipt: KernelReceipt) => void,
  onResync?: (page: KernelEventReplay, lifetime: {signal: AbortSignal; isCurrent: () => boolean}) => Promise<void> | void,
  onError?: (error: string) => void,
  onHealthy?: () => void,
): Promise<TopicSubscription | null> {
  if (transport.kind === "unavailable") return null;
  let cursor = 1, generation: string | undefined, stopped = false, paused = false;
  let requestEpoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false, requested = false;
  let retryDelay = 250;
  let read: AbortController | undefined;
  let unlisten: (() => void) | undefined;
  let unhealthy = false;
  const schedule = (delay: number) => {
    requested = true;
    if (stopped || paused || active || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; void drain(); }, delay);
  };
  const drain = async () => {
    if (stopped || paused || active) return;
    const epoch = requestEpoch;
    const current = () => !stopped && !paused && epoch === requestEpoch;
    active = true; requested = false;
    let failed = false;
    try {
      // Yield after a bounded batch; a continuously active kernel cannot
      // monopolise the window or accumulate an unbounded renderer queue.
      for (let pages = 0; pages < 8 && current(); pages++) {
        const pageRead = new AbortController();
        read = pageRead;
        const page = await eventReplay(transport, cursor, generation, 128, pageRead.signal);
        if (!current()) return;
        if (page.resync_required) {
          if (!onResync) throw new Error("Kernel replay requires current owner read models");
          await onResync(page, {signal: pageRead.signal, isCurrent: current});
          if (!current()) return;
        } else {
          for (const receipt of page.receipts) {
            if (!current()) return;
            onReceipt(receipt);
          }
        }
        read = undefined;
        generation = page.generation; cursor = page.next_seq;
        retryDelay = 250;
        if (unhealthy) { unhealthy = false; onHealthy?.(); }
        if (!page.has_more) break;
        if (pages === 7) requested = true;
      }
    } catch (error) {
      failed = true;
      if (error instanceof ReplayServiceAbsent) {
        stopped = true;
        onError?.(String(error));
        return;
      }
      if (current()) { unhealthy = true; onError?.(String(error)); }
    } finally {
      read = undefined;
      active = false;
      if (!stopped && !paused && epoch !== requestEpoch) {
        // A restored page starts a fresh pull at the last qualified cursor.
        schedule(0);
      } else if (!stopped && !paused && failed) {
        // Keep the old qualified cursor. A failed owner resync cannot wait
        // forever for another native push or become a current empty view.
        schedule(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 5000);
      } else if (!stopped && !paused && (transport.kind === "bridge" || requested)) {
        schedule(transport.kind === "bridge" ? 250 : 50);
      }
    }
  };
  const pause = () => {
    paused = true; requestEpoch++;
    read?.abort();
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  };
  const resume = () => {
    if (stopped || !paused) return;
    paused = false; schedule(0);
  };
  const removeLifecycleListeners = () => {
    if (typeof window === "undefined") return;
    window.removeEventListener("pagehide", pause);
    window.removeEventListener("pageshow", resume);
  };
  // Navigation cancels the owned HTTP pull. Late Tauri completion is fenced;
  // pages restored from the cache keep their qualified native continuation.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
  }
  try {
    if (transport.kind === "tauri") {
      const event = await import("@tauri-apps/api/event");
      unlisten = await event.listen(TOPIC, () => schedule(50));
    }
    schedule(0);
    return { unsubscribe: () => {
      stopped = true; pause();
      unlisten?.(); removeLifecycleListeners();
    } };
  } catch (error) {
    stopped = true; pause(); unlisten?.(); removeLifecycleListeners();
    onError?.(String(error));
    return null;
  }
}
