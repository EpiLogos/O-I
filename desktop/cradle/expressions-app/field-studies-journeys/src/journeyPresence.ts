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
  savePresence,
  type JourneyPresence,
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
    }),
  });
  if (standing === 'current') return {standing, presence: saved};
  if (standing === 'field-advanced') return {standing, presence: saved, notice: FIELD_ADVANCED_NOTICE};
  if (standing === 'stale') return {standing, notice: STALE_NOTICE};
  return {standing};
}
