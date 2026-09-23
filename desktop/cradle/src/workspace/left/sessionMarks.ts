/**
 * Row marks from REAL session state (10-SIDEBARS §3.3, §5.2 R1–R5).
 *
 * A conversation row's leading mark is the observed state of that AIKit
 * agent session — never invented, never animated without a real change:
 *
 *   needs you  the owner's reading carries a native permission request
 *   working    the connection reports a turn in flight (or a stop pending)
 *   failed     the connection reports an error (the reason is the tooltip)
 *   unread     a completed turn arrived that was not seen while open here
 *   idle       none of the above
 *
 * The source is the owner's own encounter `view` — the same read the chat's
 * shared observer makes — polled for the rows actually on screen at a
 * resting cadence (faster only while a turn is in flight), paused while the
 * document is hidden. When the chat's own observer already holds a session
 * the store reads nothing extra for it: the shared observer is fed the same
 * way (`observeReading`).
 *
 * "Seen" is the one local fact: the newest completed block id observed while
 * the conversation was open here. The first observation of a session seeds
 * it, so old transcript completions never replay as unread.
 */
import {useEffect, useSyncExternalStore} from "react";
import {encounter, type EncounterReading, type EncounterStatus} from "../../encounter/client";
import type {KernelTransportStatus} from "../../kernel/types";

export type RowMark = "idle" | "working" | "needs-you" | "unread" | "failed";

export interface SessionMark {
  mark: RowMark;
  /** The owner's own words for a failure; the tooltip carries it. */
  reason?: string;
  /** The connection's provider label (the agent the row names). */
  agent?: string;
  permissions: number;
  completed?: number;
  /** When this window last saw the reading change (ms). */
  changedAt?: number;
  observedAt: number;
}

export interface SessionKey {project: string; ref: string}
const keyOf = (binding: SessionKey) => `${binding.project}:${binding.ref}`;

const SEEN_KEY = "oi-left-seen.v1";
function loadSeen(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw as Record<string, number> : {};
  } catch { return {}; }
}

const lastCompleted = (reading: EncounterReading | undefined): number | undefined => {
  const blocks = reading?.blocks ?? [];
  for (let index = blocks.length - 1; index >= 0; index--) if (blocks[index].kind === "completed") return blocks[index].id;
  return undefined;
};
const lastFailure = (reading: EncounterReading | undefined): string | undefined => {
  const blocks = reading?.blocks ?? [];
  const last = blocks[blocks.length - 1];
  return last && /^(error|failed|refused)$/i.test(last.kind) ? (last.text || last.kind) : undefined;
};

/** Pure derivation (unit-tested): the owner's reading → the row's mark. */
export function markOf(reading: EncounterReading | undefined, status: EncounterStatus | undefined, seen: number | undefined): Omit<SessionMark, "observedAt" | "changedAt"> {
  const connection = status ?? reading?.connection;
  const permissions = reading?.permissions?.length ?? 0;
  const completed = lastCompleted(reading);
  const agent = connection?.provider?.label;
  const failure = connection?.error ?? lastFailure(reading);
  let mark: RowMark = "idle";
  if (permissions > 0) mark = "needs-you";
  else if (connection?.state === "TurnInFlight" || connection?.state === "InterruptRequested") mark = "working";
  else if (failure) mark = "failed";
  else if (completed !== undefined && seen !== undefined && completed > seen) mark = "unread";
  return {mark, reason: mark === "failed" ? failure ?? undefined : undefined, agent, permissions, completed};
}

interface Watch {binding: SessionKey; count: number}

class MarkStore {
  private marks = new Map<string, SessionMark>();
  private fingerprints = new Map<string, string>();
  private watches = new Map<string, Watch>();
  private listeners = new Set<() => void>();
  private seen: Record<string, number> = loadSeen();
  private active = new Map<string, number>();
  private transport?: KernelTransportStatus;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private version = 0;

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.version;
  get(binding: SessionKey): SessionMark | undefined { return this.marks.get(keyOf(binding)); }
  all(): {key: string; project: string; mark: SessionMark}[] {
    return [...this.marks.entries()].map(([key, mark]) => ({key, project: key.slice(0, key.indexOf(":")), mark}));
  }
  private emit() { this.version++; for (const listener of [...this.listeners]) listener(); }

  watch(transport: KernelTransportStatus, binding: SessionKey): () => void {
    this.transport = transport;
    const key = keyOf(binding);
    const held = this.watches.get(key);
    if (held) held.count++; else this.watches.set(key, {binding, count: 1});
    this.schedule(0);
    return () => {
      const current = this.watches.get(key);
      if (!current) return;
      current.count--;
      if (current.count <= 0) this.watches.delete(key);
    };
  }

  /** A conversation open here (the focused tab / the panel's binding): its
   * completions are consumed as seen while it stays open. Returns a release. */
  holdOpen(binding: SessionKey): () => void {
    const key = keyOf(binding);
    this.active.set(key, (this.active.get(key) ?? 0) + 1);
    const mark = this.marks.get(key);
    if (mark?.completed !== undefined && this.seen[key] !== mark.completed) this.markSeen(key, mark.completed);
    if (mark?.mark === "unread") { this.marks.set(key, {...mark, mark: "idle"}); this.emit(); }
    return () => {
      const count = (this.active.get(key) ?? 1) - 1;
      if (count <= 0) this.active.delete(key); else this.active.set(key, count);
    };
  }

  private markSeen(key: string, completed: number) {
    this.seen = {...this.seen, [key]: completed};
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(this.seen)); } catch { /* seen is a convenience */ }
  }

  /** Feed an observation made elsewhere (the chat's shared observer). */
  observeReading(binding: SessionKey, reading: EncounterReading | undefined, status?: EncounterStatus) {
    if (!reading && !status) return;
    this.apply(keyOf(binding), reading, status);
  }

  private apply(key: string, reading: EncounterReading | undefined, status: EncounterStatus | undefined) {
    const completed = lastCompleted(reading);
    if (this.seen[key] === undefined) this.markSeen(key, completed ?? -1);
    if (this.active.has(key) && completed !== undefined && this.seen[key] !== completed) this.markSeen(key, completed);
    const derived = markOf(reading, status, this.seen[key]);
    const fingerprint = JSON.stringify([derived, reading?.blocks?.length ?? 0, reading?.blocks?.[reading.blocks.length - 1]?.id ?? null]);
    const previous = this.marks.get(key);
    const now = Date.now();
    const changedAt = this.fingerprints.get(key) === fingerprint || !previous ? previous?.changedAt : now;
    this.fingerprints.set(key, fingerprint);
    const next: SessionMark = {...derived, observedAt: now, changedAt};
    if (previous && JSON.stringify({...previous, observedAt: 0}) === JSON.stringify({...next, observedAt: 0})) { this.marks.set(key, next); return; }
    this.marks.set(key, next);
    this.emit();
  }

  private schedule(delay: number) {
    if (this.running) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick() {
    if (!this.watches.size || !this.transport) return;
    if (document.visibilityState !== "visible") { this.timer = setTimeout(() => void this.tick(), 1500); return; }
    this.running = true;
    const transport = this.transport;
    const batch = [...this.watches.values()];
    // Bounded concurrency: every read is an owner process through the shared
    // kernel seam; the sidebar never floods it.
    for (let index = 0; index < batch.length; index += 3) {
      await Promise.all(batch.slice(index, index + 3).map(async ({binding}) => {
        try {
          const reading = await encounter<EncounterReading>(transport, binding.project, {action: "view", agent_session: binding.ref});
          this.apply(keyOf(binding), reading, reading.connection);
        } catch {
          // An unreadable session carries no mark — never a fabricated state.
        }
      }));
    }
    this.running = false;
    const inFlight = batch.some(({binding}) => this.marks.get(keyOf(binding))?.mark === "working");
    if (this.watches.size) this.timer = setTimeout(() => void this.tick(), inFlight ? 700 : 1500);
  }
}

export const sessionMarks = new MarkStore();

/** Watch one row's session while the row is mounted; returns its mark. */
export function useSessionMark(transport: KernelTransportStatus, binding: SessionKey | undefined, open = false): SessionMark | undefined {
  useSyncExternalStore(sessionMarks.subscribe, sessionMarks.snapshot, sessionMarks.snapshot);
  const project = binding?.project, ref = binding?.ref;
  useEffect(() => (project && ref ? sessionMarks.watch(transport, {project, ref}) : undefined), [transport, project, ref]);
  useEffect(() => (project && ref && open ? sessionMarks.holdOpen({project, ref}) : undefined), [project, ref, open]);
  return binding ? sessionMarks.get(binding) : undefined;
}

/** Aggregate marks per project from what the store has observed. */
export interface ProjectMarks {working: number; needsYou: number; unread: number; failed: number}
export function useProjectMarks(): Record<string, ProjectMarks> {
  useSyncExternalStore(sessionMarks.subscribe, sessionMarks.snapshot, sessionMarks.snapshot);
  const out: Record<string, ProjectMarks> = {};
  for (const {project, mark} of sessionMarks.all()) {
    const row = out[project] ??= {working: 0, needsYou: 0, unread: 0, failed: 0};
    if (mark.mark === "working") row.working++;
    else if (mark.mark === "needs-you") row.needsYou++;
    else if (mark.mark === "unread") row.unread++;
    else if (mark.mark === "failed") row.failed++;
  }
  return out;
}
