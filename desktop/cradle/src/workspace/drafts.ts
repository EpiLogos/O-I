export interface HeldDraft { content: string; base_revision: string; saved_content: string }
const key = (ref: string) => `oi-cradle.draft.v1:${ref}`;
export function readDraft(ref: string): HeldDraft | null {
  try { const d = JSON.parse(localStorage.getItem(key(ref)) ?? "null"); return d && typeof d.content === "string" && typeof d.base_revision === "string" && typeof d.saved_content === "string" ? d : null; } catch { return null; }
}
export function writeDraft(ref: string, draft: HeldDraft) { localStorage.setItem(key(ref), JSON.stringify(draft)); }
export function clearSavedDraft(ref: string, content: string) { if (readDraft(ref)?.content === content) localStorage.removeItem(key(ref)); }

/**
 * Acknowledged draft durability (workspace continuity C18, WF1) — the
 * explicit two-phase record for callers that need the crash-loss bound
 * stated, not assumed. ONE record, ONE key: `acknowledged` rides the draft
 * itself, so there is no second storage system and readDraft keeps its
 * exact semantics (an unacknowledged record still reads as the draft).
 *
 * DURABILITY BOUND, honestly: `writeDraftIntent` reaches localStorage
 * immediately, but the caller has not vouched for it — an intent-only
 * draft survives a graceful close (the browser flushes localStorage at
 * pagehide, where the shell's lifecycle wiring acknowledges outstanding
 * intents) and its loss window on a hard crash is whatever the storage
 * layer never flushed. `acknowledgeDraft` is the vouch: once its
 * localStorage write resolves, the acknowledged draft survives any crash
 * or process kill. `writeDraft` — the ordinary path — stays
 * acknowledged-by-write for its existing callers; the application reports
 * an intent-only draft as not durably retained until it is acknowledged.
 * `clearSavedDraft` removes both layers together (one record).
 */
export function writeDraftIntent(ref: string, draft: HeldDraft): void { localStorage.setItem(key(ref), JSON.stringify({ ...draft, acknowledged: false })); }
export function acknowledgeDraft(ref: string, draft: HeldDraft): void { localStorage.setItem(key(ref), JSON.stringify({ ...draft, acknowledged: true })); }
/** The draft with its durability standing. Absent `acknowledged` (every
 * record the ordinary writeDraft path ever wrote) reads as acknowledged —
 * that is today's acknowledged-by-write semantics, not an upgrade. */
export function readDurableDraft(ref: string): { draft: HeldDraft; acknowledged: boolean } | null {
  try { const d = JSON.parse(localStorage.getItem(key(ref)) ?? "null"); return d && typeof d.content === "string" && typeof d.base_revision === "string" && typeof d.saved_content === "string" ? { draft: { content: d.content, base_revision: d.base_revision, saved_content: d.saved_content }, acknowledged: d.acknowledged !== false } : null; } catch { return null; }
}
