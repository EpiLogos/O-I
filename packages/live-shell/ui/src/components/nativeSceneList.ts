/** Pure Scene-list model: full-order reorder, add gating and standing disclosure.
 * Structural types only; the native owner's reading is never reconstructed here. */

/** dataTransfer MIME carrying a dragged Scene ref. */
export const SCENE_REF_MIME = 'application/x-oi-scene-ref';
/** The native Journey bound: an expression holds at most 64 Scenes. */
export const SCENE_LIMIT = 64;

/** Move the item at `from` to final index `to`. Returns null for a no-op or any
 * out-of-bounds index, so a caller sends nothing. The input is never mutated. */
export function reorderScenes(order: readonly string[], from: number, to: number): string[] | null {
  const n = order.length;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < 0 || from >= n || to >= n || from === to) return null;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A drop slot is an insertion point 0..n (before row `slot`). Removing the
 * dragged row first shifts later slots down by one. */
export function dropSlotTarget(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot;
}

export interface SceneAddIntent {operation: 'add'; title?: string}

/** The add gesture: the owner names the blank draft ('Untitled scene') unless a
 * title is supplied; a supplied title must be 1–160 characters once trimmed. */
export function addSceneIntent(title?: string): SceneAddIntent {
  if (title === undefined) return {operation: 'add'};
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 160) throw Error('Give this Scene a name of 1–160 characters');
  return {operation: 'add', title: trimmed};
}

/** Why adding is blocked, or null when the gesture may be sent. */
export function addSceneBlock(count: number, orderComplete: boolean): string | null {
  if (!orderComplete) return 'Load the complete Scene order before adding a Scene';
  if (count >= SCENE_LIMIT) return 'An expression can contain up to 64 Scenes';
  return null;
}

/** One Scene snapshot request. Restore carries no name. Capture records the presented title; Save & next also asks for the following Scene. */
export function sceneSnapshotRequest(basis: {expression_ref: string; revision: number; scene_ref: string; authored_revision: number}, intentEpoch: number, action: 'save-snapshot' | 'restore-snapshot', name = '', next = false) {
  if (action === 'restore-snapshot') return {operation: 'scene' as const, basis, intent_epoch: intentEpoch, action};
  return {operation: 'scene' as const, basis, intent_epoch: intentEpoch, action, name, next};
}

export interface SceneStanding {
  label: string;
  tone: 'saved' | 'edited' | 'draft' | 'snapshot' | 'unknown';
  /** Disclosure: states exactly what the reading establishes and no more. */
  title: string;
}

/** Working-versus-saved standing from snapshot.availability and snapshot.standing.
 * "Saved" is claimed only when the owner reports the comparison as Saved. */
export function sceneStanding(row: {snapshot: {availability: string; standing: string | null}}): SceneStanding {
  const {availability, standing} = row.snapshot;
  if (availability === 'unavailable') return {label: 'Unknown', tone: 'unknown',
    title: 'No authored Scene material is disclosed, so snapshot standing is not known.'};
  if (availability === 'absent' || standing === 'Draft') return {label: 'Draft', tone: 'draft',
    title: 'Working draft only: no saved snapshot exists for this Scene.'};
  if (standing === 'Saved') return {label: 'Saved', tone: 'saved',
    title: 'The working Scene matches its saved snapshot.'};
  if (standing === 'Edited since save') return {label: 'Edited', tone: 'edited',
    title: 'The working Scene differs from its saved snapshot.'};
  return {label: 'Snapshot', tone: 'snapshot',
    title: 'A saved snapshot exists. Whole-Scene comparison needs complete membership, so working standing is not claimed.'};
}
