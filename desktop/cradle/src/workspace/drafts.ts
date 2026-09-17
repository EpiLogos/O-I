export interface HeldDraft { content: string; base_revision: string; saved_content: string }
const key = (ref: string) => `oi-cradle.draft.v1:${ref}`;
export function readDraft(ref: string): HeldDraft | null {
  try { const d = JSON.parse(localStorage.getItem(key(ref)) ?? "null"); return d && typeof d.content === "string" && typeof d.base_revision === "string" && typeof d.saved_content === "string" ? d : null; } catch { return null; }
}
export function writeDraft(ref: string, draft: HeldDraft) { localStorage.setItem(key(ref), JSON.stringify(draft)); }
export function clearSavedDraft(ref: string, content: string) { if (readDraft(ref)?.content === content) localStorage.removeItem(key(ref)); }
