/**
 * Lane-5 T9 — the journey surface's face onto presence. Pure over its inputs: the
 * storage face is passed in (the renderer's localStorage by default), and every
 * read and write goes through the presence owner (`techne/m0m5/journey/presence.ts`),
 * which owns the key, the validation and the basis standing. This module adds
 * only the disclosure: a restored position is silent when current, disclosed once
 * when the field moved, and dropped with a sentence when it belonged to another
 * reading. Nothing here is a second store.
 */
import type {TechneReading} from '../../../src/techne/contract';
import {
  basisStanding,
  defaultPresenceStorage,
  loadPresence,
  presenceFor,
  isPresenceDraft,
  savePresence,
  type JourneyPresence,
  type JourneyPresenceDraft,
  type PresenceStorage,
} from '../../../src/techne/m0m5/journey/presence';

/** One plain sentence for the status band, in the journey's notice voice. */
export const FIELD_ADVANCED_NOTICE = 'The field moved while you were away — showing the new revision.';
export const STALE_NOTICE = 'The journey you left belonged to another reading, so it was not restored.';

export interface JourneyPresenceReconciliation {
  /** How the author's saved position stands against the reading now disclosed. `none` covers a first
   * visit, a corrupt or drifted entry, and an unavailable store alike. */
  standing: 'none' | 'current' | 'field-advanced' | 'stale';
  /** The saved position, when it still applies to this reading (current or field-advanced). A stale one is never handed back. */
  presence?: JourneyPresence;
  /** Present exactly when the standing needs disclosing. */
  notice?: string;
}

function ownStorage(): PresenceStorage | null {
  try {
    return defaultPresenceStorage();
  } catch {
    // An opaque or blocked origin must still open the journey, with no presence.
    return null;
  }
}

/** Disclose the saved position against the reading, then record the position this surface stands on. The record is
 * written after the read, so a disclosed field-advanced or stale entry is replaced by the current basis and the notice
 * shows once. */
export function reconcileJourneyPresence(input: {
  reading: TechneReading;
  expression_ref: string;
  scene_ref: string;
  /** Omitted: the renderer's storage. `null`: no storage (presence simply does not survive). */
  storage?: PresenceStorage | null;
}): JourneyPresenceReconciliation {
  const storage = input.storage === undefined ? ownStorage() : input.storage;
  const subject = input.reading.subject.subject_ref;
  const entries = loadPresence(storage);
  const saved = entries[subject];
  const revision = input.reading.snapshot?.revision ?? null;
  const standing = saved
    ? basisStanding(saved, {reading_ref: input.reading.reading_ref, snapshot: {revision}})
    : 'none';
  savePresence(storage, {
    ...entries,
    [subject]: presenceFor({
      subject_ref: subject,
      reading_ref: input.reading.reading_ref,
      snapshot_revision: revision,
      expression_ref: input.expression_ref,
      scene_ref: input.scene_ref,
      // T3/T9: the pace draft is not a position; it rides the entry unchanged, with its own basis, until the author saves or discards it.
      draft: saved?.draft ?? null,
    }),
  });
  if (standing === 'current') return {standing, presence: saved};
  if (standing === 'field-advanced') return {standing, presence: saved, notice: FIELD_ADVANCED_NOTICE};
  if (standing === 'stale') return {standing, notice: STALE_NOTICE};
  return {standing};
}

/** The saved position for this reading, read with no write: the restore reads it before anything records. Only a
 * `current` entry is handed back; a `field-advanced` one is for the notice path and a `stale` one is never restored. */
export function savedJourneyPosition(input: {reading: TechneReading; storage?: PresenceStorage | null}): {standing: 'none' | 'current' | 'field-advanced' | 'stale'; presence?: JourneyPresence} {
  const storage = input.storage === undefined ? ownStorage() : input.storage;
  const saved = loadPresence(storage)[input.reading.subject.subject_ref];
  if (!saved) return {standing: 'none'};
  const standing = basisStanding(saved, {reading_ref: input.reading.reading_ref, snapshot: {revision: input.reading.snapshot?.revision ?? null}});
  return standing === 'current' ? {standing, presence: saved} : {standing};
}

/** Record the Scene the author moved to (the strip, a restore) without disclosing. A saved position on the same reading keeps
 * its revision, so a field that moved while away is still disclosed on the next load; a missing or stale one takes the current
 * basis. */
export function recordJourneyPosition(input: {reading: TechneReading; expression_ref: string; scene_ref: string; storage?: PresenceStorage | null}): void {
  const storage = input.storage === undefined ? ownStorage() : input.storage;
  const subject = input.reading.subject.subject_ref;
  const entries = loadPresence(storage);
  const saved = entries[subject];
  const basis = {
    subject_ref: subject,
    reading_ref: input.reading.reading_ref,
    snapshot_revision: input.reading.snapshot?.revision ?? null,
    expression_ref: input.expression_ref,
    scene_ref: input.scene_ref,
  };
  const keepsRevision = saved !== undefined && saved.reading_ref === basis.reading_ref;
  const next = keepsRevision ? {...basis, snapshot_revision: saved.snapshot_revision} : basis;
  savePresence(storage, {...entries, [subject]: presenceFor({...next, draft: saved?.draft ?? null})});
}

/** T3/T9: the pace draft saved for this subject, read against the basis it stands on now. `current` when its reading and its
 * Expression revision are the ones disclosed; `stale` when either has moved. A stale draft is returned so the caller can name it
 * and offer to re-apply or discard it. It is never applied here. Undefined when no draft is saved. */
export function paceDraftOf(input: {reading: TechneReading; revision: number; storage?: PresenceStorage | null}): {standing: 'current' | 'stale'; draft: JourneyPresenceDraft} | undefined {
  const storage = input.storage === undefined ? ownStorage() : input.storage;
  const draft = loadPresence(storage)[input.reading.subject.subject_ref]?.draft;
  if (!draft) return undefined;
  const standing = draft.basis_reading_ref === input.reading.reading_ref && draft.basis_revision === String(input.revision) ? 'current' : 'stale';
  return {standing, draft};
}

/** T3/T9: save the pace draft on this subject's entry, or clear it with `null`. The position is kept as it stands; the draft's basis
 * is written with it. Returns whether the browser kept the write. A draft the browser refused is not kept, so the caller says so
 * and does not hold a second copy. */
export function savePaceDraft(input: {reading: TechneReading; expression_ref: string; scene_ref: string; draft: JourneyPresenceDraft | null; storage?: PresenceStorage | null}): boolean {
  // A draft the presence owner would not read back is refused here, so nothing is written that a reload would silently drop.
  if (input.draft !== null && !isPresenceDraft(input.draft)) return false;
  const storage = input.storage === undefined ? ownStorage() : input.storage;
  const subject = input.reading.subject.subject_ref;
  const entries = loadPresence(storage);
  const saved = entries[subject];
  const keepsRevision = saved !== undefined && saved.reading_ref === input.reading.reading_ref;
  const position = {
    subject_ref: subject,
    reading_ref: input.reading.reading_ref,
    snapshot_revision: keepsRevision && saved !== undefined ? saved.snapshot_revision : (input.reading.snapshot?.revision ?? null),
    expression_ref: input.expression_ref,
    scene_ref: input.scene_ref,
  };
  return savePresence(storage, {...entries, [subject]: presenceFor({...position, draft: input.draft})});
}
