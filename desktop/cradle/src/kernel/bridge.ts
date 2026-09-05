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
} from "./types";

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

async function tauriInvoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
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
  return { ...outcome, receipts: outcome.receipts ?? [] };
}

export async function kernelOp(
  transport: KernelTransportStatus,
  op: KernelOp,
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

/** Read the ordered event log at/after a cursor — the typed command the
 * renderer bootstraps and re-syncs through. */
export async function eventsSince(
  transport: KernelTransportStatus,
  sinceSeq: number,
): Promise<KernelReceipt[]> {
  try {
    if (transport.kind === "tauri") {
      return await tauriInvoke<KernelReceipt[]>("kernel_event_log", {
        sinceSeq,
      });
    }
    if (transport.kind === "bridge") {
      const response = await fetch(`${transport.url}/events?since=${sinceSeq}`);
      const body = (await response.json()) as { ok: boolean; receipts?: KernelReceipt[] };
      return body.receipts ?? [];
    }
  } catch {
    // Absence is an observation; the cursor simply does not advance.
  }
  return [];
}

export interface TopicSubscription {
  unsubscribe: () => void;
}

/** Subscribe to the kernel event topic. Tauri pushes; the dev bridge
 * polls its log. Either way, receipts arrive ordered with their seqs. */
export async function subscribeTopic(
  transport: KernelTransportStatus,
  onReceipt: (receipt: KernelReceipt) => void,
): Promise<TopicSubscription | null> {
  try {
    if (transport.kind === "tauri") {
      const event = await import("@tauri-apps/api/event");
      const unlisten = await event.listen<KernelReceipt>(TOPIC, (message) => {
        onReceipt(message.payload);
      });
      return { unsubscribe: unlisten };
    }
    if (transport.kind === "bridge") {
      let cursor = 0;
      let stopped = false;
      const poll = async () => {
        while (!stopped) {
          const receipts = await eventsSince(transport, cursor + 1);
          for (const receipt of receipts) {
            cursor = Math.max(cursor, receipt.seq);
            onReceipt(receipt);
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      };
      void poll();
      return { unsubscribe: () => { stopped = true; } };
    }
  } catch {
    // No topic, no subscription — the pull models still work.
  }
  return null;
}
