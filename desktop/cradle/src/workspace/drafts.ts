export interface HeldDraft { content: string; base_revision: string; saved_content: string; acknowledged?: boolean }
/** Existing native recognition qualifies presentation retention. It grants
 * no source mutation authority; writes still enter the native CAS operation. */
export interface DraftOwner { readonly root: string; readonly device: string; readonly inode: string }

export function qualifyDraftOwner(activeRoot: string | undefined, recognition: unknown): DraftOwner | undefined {
  const value = recognition as {schema?: unknown; outcome?: unknown; canonical_path?: unknown; identity?: {device?: unknown; inode?: unknown}; access?: {readable?: unknown; searchable?: unknown}} | undefined;
  if (!activeRoot || value?.schema !== "central.root-recognition/v1" || value.outcome !== "recognized" || value.canonical_path !== activeRoot || value.access?.readable !== true || value.access.searchable !== true) return undefined;
  const {device, inode} = value.identity ?? {};
  if (typeof device !== "string" || !device || typeof inode !== "string" || !inode) return undefined;
  return {root: activeRoot, device, inode};
}

/** A desired next-launch binding or an opaque source ref cannot qualify an
 * active owner. Unknown ownership never falls back to the legacy global key. */
export function draftStorageKey(owner: DraftOwner | undefined, ref: string): string | undefined {
  if (!owner?.root || !owner.device || !owner.inode || !ref) return undefined;
  return `oi-cradle.draft.v2:${JSON.stringify([owner.root, owner.device, owner.inode, ref])}`;
}
interface DraftRecord { schema: "oi-cradle.draft/v2"; owner: DraftOwner; source_ref: string; draft: HeldDraft; acknowledged: boolean }
function readRecord(owner: DraftOwner | undefined, ref: string): DraftRecord | null {
  const key = draftStorageKey(owner, ref);
  if (!key) return null;
  try {
    const record = JSON.parse(localStorage.getItem(key) ?? "null") as DraftRecord | null;
    const draft = record?.draft;
    return record?.schema === "oi-cradle.draft/v2" && record.source_ref === ref && draftStorageKey(record.owner, record.source_ref) === key && typeof record.acknowledged === "boolean" && typeof draft?.content === "string" && typeof draft.base_revision === "string" && typeof draft.saved_content === "string" ? record : null;
  } catch { return null; }
}
function writeRecord(owner: DraftOwner | undefined, ref: string, draft: HeldDraft, acknowledged: boolean) {
  const key = draftStorageKey(owner, ref);
  if (!key) throw Error("The active source owner has not been recognized. Keep this draft open until it can be retained.");
  localStorage.setItem(key, JSON.stringify({schema: "oi-cradle.draft/v2", owner, source_ref: ref, draft: {content: draft.content, base_revision: draft.base_revision, saved_content: draft.saved_content}, acknowledged}));
}
export function readDraft(owner: DraftOwner | undefined, ref: string): HeldDraft | null {
  const record = readRecord(owner, ref);
  return record ? {...record.draft, ...(record.acknowledged ? {} : {acknowledged: false})} : null;
}
export function writeDraft(owner: DraftOwner | undefined, ref: string, draft: HeldDraft) { writeRecord(owner, ref, draft, draft.acknowledged !== false); }
export function clearSavedDraft(owner: DraftOwner | undefined, ref: string, content: string) {
  const key = draftStorageKey(owner, ref);
  if (key && readRecord(owner, ref)?.draft.content === content) localStorage.removeItem(key);
}

/** Existing two-phase durability standing stays on the same qualified
 * record. Browser storage acknowledgement is not a native save or a promise
 * about unflushed bytes after OS/power failure. Legacy v1 bytes stay untouched. */
export function writeDraftIntent(owner: DraftOwner | undefined, ref: string, draft: HeldDraft): void { writeRecord(owner, ref, draft, false); }
export function acknowledgeDraft(owner: DraftOwner | undefined, ref: string, draft: HeldDraft): void { writeRecord(owner, ref, draft, true); }
export function readDurableDraft(owner: DraftOwner | undefined, ref: string): {draft: HeldDraft; acknowledged: boolean} | null {
  const record = readRecord(owner, ref);
  return record ? {draft: record.draft, acknowledged: record.acknowledged} : null;
}
