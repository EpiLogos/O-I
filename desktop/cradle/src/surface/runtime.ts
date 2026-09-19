/**
 * The surface runtime registry (workspace-continuity WF4, contract frozen
 * 2026-09-19 from `docs/experience/WORKSPACE-CONTINUITY.md` §5).
 *
 * Residency is presentation infrastructure above the replaceable
 * arrangement/pane trees: it records, per open surface, whether its view is
 * `active` (presented and responsive), `retained` (a reusable view held —
 * mounted-concealed or parked — within the declared budget) or `released`
 * (disposable runtime resources freed after recoverable state was secured).
 * It owns no layout, no bindings and no owner identity — the book keeps
 * membership, the kernel keeps admission; this only names what is resident
 * so retention, budgets and probes have one honest source.
 *
 * Budget: a bounded warm working set. Eviction is LRU over
 * budget-evictable kinds (clean, reconstructible views); kinds whose
 * release would lose unrecoverable work are never evicted by the budget —
 * they leave residency only through explicit close. Every eviction names
 * its reason, and the counters make "bounded" a measured fact instead of a
 * hope.
 */

export type Residency = "active" | "retained" | "released";

export interface RuntimeRecord {
  surfaceId: string;
  kind: string;
  residency: Residency;
  /** Monotonic present/park touches — the LRU clock. */
  lastTouch: number;
}

export interface RuntimeStats {
  active: number;
  retained: number;
  /** Cumulative releases by reason ("close", "budget", "unmount"). */
  released: number;
  evictions: number;
  retainedIds: string[];
}

/** Kinds whose concealed view is cheap to rebuild from kernel-owned state —
 * the pane tier already releases these (Workbench CONCEAL_RELEASES); the
 * budget may evict them first everywhere. */
export const BUDGET_EVICTABLE_KINDS = new Set(["sources", "blank"]);

/** The warm-set budget: how many non-centre views may stay retained across
 * the shell at once. Centres are bounded by their own per-kind count and do
 * not draw from this budget. */
export const RETAINED_VIEW_BUDGET = 12;

const clock = {value: 0};
const records = new Map<string, RuntimeRecord>();
const listeners = new Set<() => void>();
const totals = {released: 0, evictions: 0};

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function runtimeRecord(surfaceId: string): RuntimeRecord | undefined {
  const record = records.get(surfaceId);
  return record ? {...record} : undefined;
}

export function runtimeStats(): RuntimeStats {
  let active = 0, retained = 0;
  const retainedIds: string[] = [];
  for (const record of records.values()) {
    if (record.residency === "active") active += 1;
    else if (record.residency === "retained") { retained += 1; retainedIds.push(record.surfaceId); }
  }
  return {active, retained, released: totals.released, evictions: totals.evictions, retainedIds};
}

function setResidency(surfaceId: string, kind: string, residency: Residency) {
  const previous = records.get(surfaceId);
  if (previous?.residency === residency) return;
  records.set(surfaceId, {surfaceId, kind, residency, lastTouch: residency === "released" ? previous?.lastTouch ?? 0 : ++clock.value});
  if (residency === "released") totals.released += 1;
  emit();
}

/** The view is the presented one (its pane's active tab, the mode stage). */
export function markPresented(surfaceId: string, kind: string) {
  setResidency(surfaceId, kind, "active");
  enforceBudget(kind);
}

/** The view is held mounted-concealed or parked — reusable without a read. */
export function markRetained(surfaceId: string, kind: string) {
  setResidency(surfaceId, kind, "retained");
}

/** The view's runtime resources are freed. `reason` names why ("close",
 * "budget", "unmount") — probes and the landing record read these. */
export function markReleased(surfaceId: string, kind: string) {
  setResidency(surfaceId, kind, "released");
  records.delete(surfaceId);
}

/** The surface left the book entirely (explicit close or last membership
 * removal): its retention record goes with it. */
export function forgetSurface(surfaceId: string) {
  if (records.delete(surfaceId)) emit();
}

/** Hold the warm set bounded: when retention exceeds the budget, release
 * the oldest retained budget-evictable views first. Dirty or unrecoverable
 * kinds are never chosen — they are not in the evictable set by law. */
function enforceBudget(incomingKind: string) {
  if (BUDGET_EVICTABLE_KINDS.has(incomingKind)) return;
  let retainedCount = 0;
  for (const record of records.values()) if (record.residency === "retained") retainedCount += 1;
  if (retainedCount <= RETAINED_VIEW_BUDGET) return;
  const evictable = [...records.values()]
    .filter(record => record.residency === "retained" && BUDGET_EVICTABLE_KINDS.has(record.kind))
    .sort((a, b) => a.lastTouch - b.lastTouch);
  for (const record of evictable) {
    if (retainedCount <= RETAINED_VIEW_BUDGET) break;
    records.delete(record.surfaceId);
    totals.evictions += 1;
    totals.released += 1;
    retainedCount -= 1;
  }
  emit();
}

/** Walk-probe seam: retention and budget facts as data, the same way the
 * walk receipts read the book. Presentation infrastructure, not authority. */
export function exposeRuntimeProbe() {
  if (typeof window === "undefined") return;
  (window as unknown as {__oiSurfaceRuntime?: {stats: () => RuntimeStats; record: (id: string) => RuntimeRecord | undefined}}).__oiSurfaceRuntime = {
    stats: runtimeStats,
    record: runtimeRecord,
  };
}
