// The Earth's deep-time clock bound to the shell's shared time window (T-ATLAS-TIME; DEVICE-SEMANTICS-LOCK §0.1.3, §7).
//
// One window, owned by the session: the DisclosureSession store the native owner also writes (desktop/cradle/src/techne/
// session.ts, disclosureSession). The clock is a face of that window, never a second clock:
// - a window set anywhere (the Timeline, Places, the owner) moves the Earth's cursor at once, and is never written back;
// - a move the Earth makes (the pane, the time-control face body, shell.setAtlasCursor, play, all time) is committed once,
//   through the session's compare-and-set writer, and the window's own echo is recognised and never re-scrubs the clock;
// - the window carries a whole year: the cursor's year, written as an instant the time authority reads back (a year start,
//   or a bare deep year). The day/night layer reads the same window through its own windowInstant, so a window written
//   here stands at that year for the terminator too.
// The atlas's non-linear deep-time scale stays its own presentation of that one time: the scale maps years to slider
// positions, and the window holds years.
//
// With no session standing there is no shared window to bind to: the clock keeps its own presentation until one stands
// (reported OPEN). Instants are read only through the time authority (scale.ts parseTimestamp), never the platform parser.

import type {DisclosureSelection, DisclosureSession} from '../../../../../../desktop/cradle/src/techne/contract'
import type {DisclosureSessionStore} from '../../../../../../desktop/cradle/src/techne/session'
import {calendarFields, parseTimestamp, yearStartMs} from '../../../../../../desktop/cradle/src/techne/m0m5/timeline/scale'
import {writeSharedWindowCompareAndSet, type CapturedSharedWindow} from '../../../../../expressions-boundary/src/timeWindow'
import type {TimeScale} from './src/data/time'
import type {SharedClockLink, TimeModel} from './src/state/timeModel'

type SharedWindow = NonNullable<DisclosureSession['time_window']>

/** The instant the time authority reads for one whole year: a year start, or a bare deep year (the xsd:gYear shape). */
export function instantOfYear(year: number): string {
  if (!Number.isSafeInteger(year)) throw new RangeError(`A shared-time year is a whole number, and ${year} is not one`)
  if (Math.abs(year) >= 10_000) return String(year)
  if (year >= 0) return `${String(year).padStart(4, '0')}-01-01T00:00:00Z`
  return `-${String(-year).padStart(6, '0')}-01-01T00:00:00Z`
}

/** The fractional year of one epoch ms, read through the time authority's own calendar and year starts. */
function yearOfMs(ms: number): number {
  const year = calendarFields(ms).year;
  return year + (ms - yearStartMs(year)) / (yearStartMs(year + 1) - yearStartMs(year));
}

/** The year a window stands for: the midpoint of a bounded window (the day/night layer's own rule, windowInstant), its
 * bounded edge when one edge is open, and null for all time (no window, or no edge that parses). */
export function windowYear(window: SharedWindow | null): number | null {
  if (!window) return null;
  const at = (value: string | null): number => {
    if (!value) return Number.NaN;
    try {
      return parseTimestamp(value);
    } catch {
      return Number.NaN;
    }
  };
  const from = at(window.from), to = at(window.to);
  if (Number.isFinite(from) && Number.isFinite(to)) return yearOfMs((from + to) / 2);
  if (Number.isFinite(from)) return yearOfMs(from);
  if (Number.isFinite(to)) return yearOfMs(to);
  return null;
}

/** [T-PLACES-ONTO-ATLAS] The year one edge of the window stands at (the transport's window readouts, Technē's punch-in and punch-out),
 * read through the same time authority as the window's own year; null for an open edge or one that does not parse. */
export function windowEdgeYear(value: string | null | undefined): number | null {
  if (!value) return null;
  try {
    const ms = parseTimestamp(value);
    return Number.isFinite(ms) ? Math.floor(yearOfMs(ms)) : null;
  } catch {
    return null;
  }
}

const sameWindow = (a: SharedWindow | null, b: SharedWindow | null): boolean => a === null || b === null
  ? a === b : a.from === b.from && a.to === b.to;

const snapshotOf = (session: DisclosureSession): CapturedSharedWindow => ({
  session_ref: session.session_ref,
  selection: structuredClone(session.selection) as DisclosureSelection,
  window: session.time_window ? {from: session.time_window.from, to: session.time_window.to} : null,
});

/** [T-PLACES-ONTO-ATLAS] Set the shared window to a place's own validity (lane-4 T23: a place carries its window to the Timeline), through
 * the session's compare-and-set writer over the window just read — the same owner write the clock's moves go through. Returns the
 * refusal in the writer's words, or null once written. With no session standing there is no window to write. */
export function writeSharedWindow(store: DisclosureSessionStore, window: SharedWindow | null): string | null {
  const session = store.get();
  if (!session) return 'No shared session stands (no work is open in Technē), so there is no window to set.';
  if (sameWindow(session.time_window ?? null, window)) return null;
  try {
    writeSharedWindowCompareAndSet(store, snapshotOf(session), window);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export interface SharedClockBinding extends SharedClockLink {
  /** Stop following the window and release the clock (the pane is destroyed). */
  dispose(): void;
}

/** Bind the clock to the shared window of `store`. The clock takes the window's place at once; from then on every window
 * change moves it, and every move it makes is committed through the store's compare-and-set writer. */
export function bindSharedTimeClock({store, time, scale}: {store: DisclosureSessionStore; time: TimeModel; scale: TimeScale}): SharedClockBinding {
  /** What the Earth last showed: the session, its selection and the window in force. Null while no session stands. */
  let seen: CapturedSharedWindow | null = null;
  /** True only while the clock's own write is in flight, so the window's echo never re-scrubs the clock. */
  let writing = false;

  const sync = (): void => {
    if (writing) return;
    const session = store.get();
    if (!session) {
      seen = null;
      return;
    }
    const window = session.time_window ?? null;
    const moved = seen === null || !sameWindow(seen.window, window);
    seen = snapshotOf(session);
    if (!moved) return;
    const year = windowYear(window);
    time.follow(year === null ? null : scale.toU(year));
  };

  const commit = (u: number | null): string | null => {
    const session = store.get();
    if (!session) return null; // no shared window stands: the clock keeps its own presentation
    if (seen === null) {
      sync();
      return 'the shared time window was not read by the Earth, so the move was not written; read it again';
    }
    const target: SharedWindow | null = u === null ? null : {from: null, to: instantOfYear(Math.round(scale.fromU(u)))};
    if (sameWindow(session.time_window ?? null, target)) return null; // already standing: nothing is written
    writing = true;
    try {
      writeSharedWindowCompareAndSet(store, seen, target);
    } catch (error) {
      writing = false;
      sync(); // the Earth shows the window the store holds
      const reason = error instanceof Error ? error.message : String(error);
      return `the shared time window refused the move (${reason}), so the cursor stays where the window stands`;
    }
    writing = false;
    seen = snapshotOf(store.get()!);
    return null;
  };

  const link: SharedClockLink = {commit};
  const unsubscribe = store.subscribe(sync);
  time.link = link;
  sync(); // align at bind: the window standing takes the clock's place, and no window in force is all time
  return {
    commit,
    dispose() {
      unsubscribe();
      if (time.link === link) time.link = null;
    },
  };
}
