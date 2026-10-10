// The time spine (WORLD-SHELL-DESIGN §15, §10 seam 7) — the §8 controls
// (Now / Occasion / Transport) over the two-clock bridge, with chronos and
// cron as the deeper platform strata.
//
// Laws this module encodes:
// - Two-clock doctrine (lane-6 SCOPE, §8): civil time keeps the day/NOW
//   closure law and is OWNED by Central — the spine only READS a situated
//   civil-field reading supplied by its caller (the kernel's temporal read).
//   It never reads the wall clock to tell civil time, and no shell timer
//   becomes a clock.
// - Occasion (the K8 sky contract's retained-occasion behaviour): a selected
//   occasion RETAINS its snapshot basis (the event exactly as read: instant,
//   summary, evidence) and separately qualifies its CURRENT admission —
//   standing in a retained time is honest only while the qualification says
//   the material is still admitted. Basis and qualification never merge.
// - Transport (§15.4): the Timeline projection's playhead over performable
//   material. It moves over clips and drives nothing else. A transport take
//   is material, never a clock.
// - Chronos (§15.1): qualitative/cosmic time is PROVIDED by the QL family
//   and exposed read-only. The spine holds the binding surface and no values;
//   until a family binds, the stratum honestly reports no functions.
// - Cron (§15.3): families declare cadences as parameters; firings are real
//   executions, and EVERY firing lands as a Timeline clip — a cron run is
//   temporal material like anything else. The spine fires only what was
//   declared, records only what actually fired, and fabricates no history.
//
// Pure TypeScript. No React, no timers, no kernel transport: the executor
// (the shell's poller, a Workcell/Actuation runner) supplies every instant
// and calls in; this module keeps the strata straight.

import type {WorldTrackClip} from './worldTrackAdapter';

// ── strata readings ──────────────────────────────────────────────────────────

/** The situated civil field (§15.2) — read from the civil owner, never
 * generated here. `dayRef` is the civil day the instant stands in. */
export interface CivilReading {
  instantUnixMs: number;
  dayRef: string | null;
  /** What the reading stands on — the kernel's temporal read, named. */
  source: string;
}

/** One kernel temporal event exactly as the reading gives it
 * (desktop/cradle/kernel/src/temporal_sources.rs — the same rows the
 * agent shell's TemporalEventLike mirrors). Adapters project these;
 * the spine retains them as occasion bases. */
export interface TemporalEventRow {
  stream?: string
  kind?: string
  subject_ref: string
  instant_unix_ms?: number | null
  summary?: string
  day_ref?: string | null
  evidence_refs?: string[]
}

/** The retained occasion basis (§15.5): the snapshot exactly as first read. */
export interface OccasionBasis {
  ref: string;
  instantUnixMs: number | null;
  summary: string | null;
  evidenceRefs: string[];
  /** The civil instant the snapshot was retained at (not the event's time). */
  retainedAtUnixMs: number;
  civilDayRef: string | null;
}

/** Current admission — a SEPARATE qualification, never part of the basis. */
export interface OccasionAdmission {
  admitted: boolean;
  qualifiedAtUnixMs: number;
  /** What the qualification stood on ("present in the temporal reading of …"). */
  disclosure: string;
}

export interface Occasion {
  basis: OccasionBasis;
  admission: OccasionAdmission | null;
}

/** Transport state over performable clips (§15.4). */
export interface TransportState {
  playing: boolean;
  /** The playhead's clip, by id — an index into the presented material. */
  positionClipId: string | null;
  /** The loop brace as the occasion window (Revision 2 transport mapping). */
  loopClipIds: string[] | null;
}

/** A declared cadence (§15.3) — a family's parameter, not a timer. */
export interface CadenceParameter {
  id: string;
  everyMs: number;
  label: string;
  /** Who declared it (the family manifest owns cadence declarations in
   * product; this records the declaring surface honestly). */
  declaredBy: string;
  armed: boolean;
}

/** One real firing, landed as a clip. The instant is the execution's own. */
export interface CronFiring {
  id: string;
  cadenceId: string;
  label: string;
  atUnixMs: number;
  disclosure: string | null;
}

/** A chronos time function bound read-only from the QL family (§15.1). */
export interface ChronosFunction {
  id: string;
  label: string;
  /** Read-only: the family supplies the reading; the spine never computes. */
  read: () => string;
}

// ── the spine ────────────────────────────────────────────────────────────────

export interface TimeSpine {
  /** Adopt the situated civil field (Now). Drives Earth and Timeline alike. */
  readNow(reading: CivilReading): void;
  now(): CivilReading | null;

  /** Retain an occasion from an event, or reopen the already-retained
   * basis for that exact ref (the K8 behaviour: reopening keeps the
   * original snapshot, it never re-bases). */
  selectOccasion(event: TemporalEventRow, retainedAtUnixMs: number): Occasion;
  occasion(): Occasion | null;
  occasionFor(ref: string): Occasion | null;
  /** Every occasion retained in this projection's life — the occasion rail. */
  occasions(): Occasion[];
  /** Re-qualify every retained occasion against a fresh reading — the
   * current-admission field only; bases never move. */
  qualifyOccasions(freshEvents: TemporalEventRow[], qualifiedAtUnixMs: number, disclosure: string): void;

  transport(): TransportState;
  setTransportPosition(clipId: string | null): void;
  setTransportPlaying(playing: boolean): void;
  setTransportLoop(clipIds: string[] | null): void;

  declareCadence(parameter: Omit<CadenceParameter, 'armed'>): CadenceParameter;
  armCadence(id: string, armed: boolean): void;
  cadences(): CadenceParameter[];
  /** Fire a declared cadence NOW — a real execution lands as a clip.
   * Refuses undeclared ids (no synthetic history). Returns the firing. */
  fireCadence(id: string, firing: {atUnixMs: number; label?: string; disclosure?: string | null}): CronFiring;
  firings(): CronFiring[];
  /** The firings as Timeline clips on the cron track — every firing is
   * temporal material like anything else (§15.3). */
  cronClips(): WorldTrackClip[];

  bindChronos(fn: ChronosFunction): void;
  chronos(): ChronosFunction[];

  subscribe(listener: () => void): () => void;
}

export function createTimeSpine(): TimeSpine {
  let now: CivilReading | null = null;
  const retained = new Map<string, Occasion>();
  let selectedRef: string | null = null;
  let transport: TransportState = {playing: false, positionClipId: null, loopClipIds: null};
  const cadences = new Map<string, CadenceParameter>();
  const firings: CronFiring[] = [];
  const chronos = new Map<string, ChronosFunction>();
  const listeners = new Set<() => void>();

  const changed = () => {for (const listener of listeners) listener();};
  const nextFiringId = (cadenceId: string): string => `cron-firing:${cadenceId}:${firings.length + 1}`;

  return {
    readNow(reading) {
      now = reading;
      changed();
    },
    now: () => now,

    selectOccasion(event, retainedAtUnixMs) {
      const existing = retained.get(event.subject_ref);
      const occasion: Occasion = existing
        // Reopening an exact saved occasion keeps its snapshot basis —
        // even when the reading has since refreshed.
        ? {...existing, admission: existing.admission}
        : {
            basis: {
              ref: event.subject_ref,
              instantUnixMs: event.instant_unix_ms ?? null,
              summary: event.summary ?? null,
              evidenceRefs: [...(event.evidence_refs ?? [])],
              retainedAtUnixMs,
              civilDayRef: event.day_ref ?? null,
            },
            admission: null,
          };
      retained.set(event.subject_ref, occasion);
      selectedRef = event.subject_ref;
      changed();
      return occasion;
    },
    occasion: () => (selectedRef ? retained.get(selectedRef) ?? null : null),
    occasionFor: (ref) => retained.get(ref) ?? null,
    occasions: () => [...retained.values()],
    qualifyOccasions(freshEvents, qualifiedAtUnixMs, disclosure) {
      const present = new Set(freshEvents.map((event) => event.subject_ref));
      for (const [ref, occasion] of retained) {
        retained.set(ref, {
          ...occasion,
          admission: {
            admitted: present.has(ref),
            qualifiedAtUnixMs,
            disclosure,
          },
        });
      }
      changed();
    },

    transport: () => transport,
    setTransportPosition(clipId) {transport = {...transport, positionClipId: clipId}; changed();},
    setTransportPlaying(playing) {transport = {...transport, playing}; changed();},
    setTransportLoop(clipIds) {transport = {...transport, loopClipIds: clipIds}; changed();},

    declareCadence(parameter) {
      const declared: CadenceParameter = {...parameter, armed: false};
      cadences.set(parameter.id, declared);
      changed();
      return declared;
    },
    armCadence(id, armed) {
      const cadence = cadences.get(id);
      if (!cadence) throw new Error(`cadence ${id} was never declared`);
      cadences.set(id, {...cadence, armed});
      changed();
    },
    cadences: () => [...cadences.values()],
    fireCadence(id, {atUnixMs, label, disclosure = null}) {
      const cadence = cadences.get(id);
      if (!cadence) throw new Error(`cadence ${id} was never declared — the spine fires only declared cadences (no synthetic history)`);
      const firing: CronFiring = {
        id: nextFiringId(id),
        cadenceId: id,
        label: label ?? cadence.label,
        atUnixMs,
        disclosure,
      };
      firings.push(firing);
      changed();
      return firing;
    },
    firings: () => [...firings],
    cronClips() {
      return firings.map((firing): WorldTrackClip => ({
        id: firing.id,
        trackId: 'cron',
        columnId: 'cron',
        label: `${firing.label} · ${firing.cadenceId}`,
        state: 'fact',
      }));
    },

    bindChronos(fn) {chronos.set(fn.id, fn); changed();},
    chronos: () => [...chronos.values()],

    subscribe(listener) {
      listeners.add(listener);
      return () => {listeners.delete(listener);};
    },
  };
}

// ── shared projection helpers ────────────────────────────────────────────────

/** The civil day key an event stands in — the reading's own day_ref when it
 * carries one, else derived from its civil instant, else null (undated work
 * keeps relative time; no fake dates — crosswalk lane-2 T5). */
export function eventDayKey(event: TemporalEventRow): string | null {
  if (event.day_ref) {
    const tail = event.day_ref.split(':').pop() ?? event.day_ref;
    if (/^\d{4}-\d{2}-\d{2}$/.test(tail)) return tail;
    return event.day_ref;
  }
  if (event.instant_unix_ms != null && Number.isFinite(event.instant_unix_ms)) {
    return new Date(event.instant_unix_ms).toISOString().slice(0, 10);
  }
  return null;
}

/** The standing a clip honestly carries. Events read from the kernel's
 * temporal read are readings of record → 'fact'. The spine never upgrades
 * standing by placement (Revision 2 law); a future source may supply
 * claim/inferred/hypothesis/disputed/ghost and the presentation keeps it. */
export function eventStanding(_event: TemporalEventRow): string {
  return 'fact';
}

/** Hour-of-day for a day-local column (units are the column's own: hours). */
export function eventHourOfDay(event: TemporalEventRow): number | null {
  if (event.instant_unix_ms == null || !Number.isFinite(event.instant_unix_ms)) return null;
  const instant = new Date(event.instant_unix_ms);
  return instant.getUTCHours() + instant.getUTCMinutes() / 60 + instant.getUTCSeconds() / 3600;
}
