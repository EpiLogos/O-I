// Archetypal readings of history — the data contract for Aion mode.
//
// A HistoryReading is one author's archetypal view of historical time laid
// over the globe. Jung's Aion (CW9ii) is the first reading. Later readings
// (the owner's Antichrist material) declare `extends: "jung-aion"` and add
// epochs, events and threads on the same axes — they never rewrite Jung's.
//
// Output file: public/data/history.json → { readings: HistoryReading[] }.
import type { Convention } from '../aion/precession';
import type { FamilyId, OccurrenceId, Palette } from './field';

/** [C2-b9] A conditional dating the READING itself pins (was the hardcoded
 * JUNG_AQUARIAN in aion/skyclock.ts): the calculation events it names, the span
 * it gives, and the locator that grounds it. The founding reading's mark —
 * Jung's conditional Aquarian dating, Aion ¶149 n.84 (cw09ii, pdf p106) — now
 * travels in that reading's data, not in code. */
export interface ReadingMark {
  id: string; // stable mark id the display logic resolves, e.g. "aquarian-beginnings"
  /** Whose conditional dating this is, as the row label's name ('Jung' for the founding mark). */
  name?: string;
  eventIds: string[]; // the reading's own calculation events, resolved against events[]
  range: { from: number; to: number };
  /** The reading's own wording for the span's indefiniteness, quoted (e.g. '“very indefinite”'). */
  rangeNote?: string;
  locator: string;
}

/** A verbatim passage, always traceable. Never paraphrase inside `text`. */
export interface Passage {
  text: string;
  /** Work key as in the vault ("cw09ii") or a reading-local source key. */
  work: string;
  /** "¶127" or "¶127–128"; pdf page when the paragraph is unresolved. */
  locator: string;
  /** [C2-a3, from 76e4b52] The reading's sourcing label, kept exactly:
   * 'J' = asserted in the reading's own text (the default when absent);
   * 'S' = standard scholarship, quoted for orientation. The founding
   * reading's vocabulary; a later provider may declare its own. */
  basis?: 'J' | 'S';
}

/** Where a reading places the moral/psychic charge of a span of time. */
export type Polarity = 'light' | 'shadow' | 'union' | 'neutral';

export interface Epoch {
  id: string; // "pisces-first-fish"
  name: string; // "The first fish"
  /** Zodiacal sign when the epoch is a Platonic month or part of one. */
  sign?: string;
  from: number; // year, negative = BCE (approximate, as the reading gives it)
  to: number;
  /** Nested epochs (the two fishes inside Pisces) point at their parent. */
  parentId?: string;
  polarity: Polarity;
  /** 0 = instinct/infra-red … 1 = spirit/ultra-violet (same axis as archetypes). */
  spectrum: number;
  palette: Palette;
  oneLine: string; // ≤ 90 chars, the reading's own claim in plain words
  body: string[]; // short plain paragraphs, the site's summary (not the author's words)
  passages: Passage[]; // the author's own words that ground it
  /** field archetypes the epoch bears on (the Self, the Shadow…), when the reading itself names them */
  archetypeIds?: string[];
}

export interface AeonEvent {
  id: string;
  name: string; // "Jupiter–Saturn conjunction in Pisces"
  year: number;
  yearDisplay: string;
  place?: string;
  lat?: number;
  lon?: number;
  epochId: string;
  polarity: Polarity;
  oneLine: string;
  body: string[];
  passages: Passage[];
  familyIds: FamilyId[]; // field families this event bears on (fish, antichrist…)
  /** field archetypes the event bears on (the Self, the Shadow…), when the reading itself names them */
  archetypeIds?: string[];
  occurrenceIds: OccurrenceId[]; // field occurrences it gathers
}

/** A line through time the reading follows (e.g. the Christ/Antichrist opposition). */
export interface AeonThread {
  id: string;
  name: string;
  polarity: Polarity;
  eventIds: string[]; // in order
  oneLine: string;
}

export interface HistoryReading {
  id: string; // "jung-aion"
  title: string; // "Aion"
  author: string; // "C. G. Jung"
  work?: string; // "cw09ii"
  extends?: string; // id of the reading this one continues
  /** Span the reading's own clock covers, for the scrubber. */
  from: number;
  to: number;
  /** [C2-b9] marks the reading itself pins, resolved by id (see ReadingMark). */
  marks?: ReadingMark[];
  /** [C2-b10] the reading's default precession convention — the convention
   * travels with the reading, not the code. One of aion/precession's Convention
   * ids; absent ⇒ the module's founding default ('jung-equal'). */
  convention?: Convention;
  epochs: Epoch[];
  events: AeonEvent[];
  threads: AeonThread[];
}

export interface History {
  generatedAt: string;
  readings: HistoryReading[];
}
