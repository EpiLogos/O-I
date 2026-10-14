/** The QL family's sky→Earth adapter (WORLD-SHELL-DESIGN §3.1, §10.6, §12; manifest `ql-sky-earth-adapter`).
 *
 * The family's projection contribution. The atlas port keeps only the sky envelope (projections/atlas/provider/
 * skyProvider.ts) and never writes this. This module binds ONE point the QL owner states of its dated sky, `subsolar`
 * (additive in `ql.sky-snapshot/v1`, Work/Quaternal-Logic commit 120f093), into the Earth's occurrence contract, with the
 * owner's snapshot as its basis. It admits nothing else: no grid projection, no ephemeris, no other body. The other
 * bodies carry ecliptic longitudes only and have no Earth position, so none is placed.
 *
 * The instant. The Sun is read for the instant the Earth shows: the present sky while no shared window is in force (all
 * time), otherwise the window's year, read as its year start (UTC). The kernel's `nara_identity` / `transit` op passes the
 * `ql.sky-request/v1` through to QL, which answers `historical` for epochs in [1800, 2400) (providers/sky/kerykeion_snapshot.py,
 * MIN_EPOCH / MAX_EPOCH). A year outside that range is refused here, before any kernel call, with the range named.
 *
 * One occurrence. The Sun is always the occurrence `sky-subsolar`; a reading for another instant replaces it, never adds to it.
 * An absence removes it. `sunStanding` gives the words the Earth states about the Sun, or null when the Sun is placed for
 * the instant the Earth shows.
 *
 * Pure apart from the one kernel read, which takes the transport it is given. The shared admission path is
 * projections/occurrence.ts. */

import type {Family, Field, LocusType, Occurrence} from '../projections/atlas/src/types/field'
import {admitOccurrences, checkOccurrence, refuse, type AdmissionRefusal, type Checked} from '../projections/occurrence'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {NaraIdentityResult, SkyRequest} from '../../../../../desktop/cradle/src/nara/identity/types'

/** The family's own declaration for the stated point. The family owns the name; the palette is the Earth's own world
 * palette (projections/atlas/src/data/palette.ts WORLD_PALETTE), so no colour is invented here. */
export const QL_SKY_FAMILY_ID = 'ql-sky-subsolar'
/** The contract's locus vocabulary has no sky value. `historical-event` is the nearest entry; the owner decides a sky value. */
export const QL_SKY_LOCUS: LocusType = 'historical-event'
/** The one occurrence the Sun holds on the Earth. The instant is not in the id: it is the basis's epoch. */
export const SUBSOLAR_OCCURRENCE_ID = 'sky-subsolar'
/** The years the QL sky adapter answers, [first, end): providers/sky/kerykeion_snapshot.py MIN_EPOCH and MAX_EPOCH. */
export const DATED_SKY_FIRST_YEAR = 1800
export const DATED_SKY_END_YEAR = 2400
export const QL_SKY_FAMILY: Family = {
  id: QL_SKY_FAMILY_ID,
  name: 'Subsolar point',
  subtype: 'process',
  aliases: [],
  oneLine: 'The point where the Sun stands overhead on the dated sky, as the QL owner states it.',
  archetypes: [],
  spectrum: {position: 0.55},
  palette: {core: '#c3d2f2', glow: '#4f78cf', fog: '#10193a', deep: '#02030a'},
  body: [],
  occurrenceIds: [],
  synthesised: true,
}

/** The owner's snapshot as this adapter reads it. Field names are the owner's (`providers/sky/kerykeion_snapshot.py`, `produce`). */
export interface QlSkySnapshotStated {
  schema: 'ql.sky-snapshot/v1';
  snapshot_ref: string;
  epoch_utc: string;
  epoch_unix_ms: number;
  receipt_unix_ms: number;
  subsolar?: {latitude_degrees: number; longitude_degrees: number};
}

/** The owner's stated subsolar point as an occurrence, or the owner's own words for why there is none. */
export function subsolarOccurrence(snapshot: unknown): Checked<Occurrence> {
  if (typeof snapshot !== 'object' || snapshot === null) return refuse('the sky reading is not a snapshot');
  const s = snapshot as Partial<QlSkySnapshotStated>;
  if (s.schema !== 'ql.sky-snapshot/v1') return refuse(`the sky reading is not ql.sky-snapshot/v1 (${String(s.schema)})`);
  if (typeof s.snapshot_ref !== 'string' || !s.snapshot_ref || typeof s.epoch_utc !== 'string' || !s.epoch_utc
    || typeof s.epoch_unix_ms !== 'number' || typeof s.receipt_unix_ms !== 'number') {
    return refuse('the sky snapshot does not disclose its ref, epoch and receipt');
  }
  if (s.subsolar === undefined) {
    return refuse(`the sky snapshot ${s.snapshot_ref} states no subsolar point (the owner's field is additive: snapshots produced before it remain valid without one)`);
  }
  const point = s.subsolar as {latitude_degrees?: unknown; longitude_degrees?: unknown} | null;
  const lat = point?.latitude_degrees;
  const lon = point?.longitude_degrees;
  if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return refuse(`the subsolar point of ${s.snapshot_ref} is not a latitude and longitude`);
  }
  const epoch = s.epoch_utc;
  return checkOccurrence({
    id: SUBSOLAR_OCCURRENCE_ID,
    subject_ref: `ql:sky-occasion:${epoch}`,
    title: 'Subsolar point of the dated sky',
    label: 'Subsolar point',
    familyId: QL_SKY_FAMILY_ID,
    coFamilyIds: [],
    locusType: QL_SKY_LOCUS,
    cultureIds: [],
    place: 'Subsolar point of the dated sky, as the owner states it',
    lat,
    lon,
    geoPrecision: 'place',
    year: new Date(s.epoch_unix_ms).getUTCFullYear(),
    yearDisplay: epoch,
    cites: [],
    body: [],
    parallelIds: [],
    basis: {ref: s.snapshot_ref, epoch, read_at_unix_ms: s.receipt_unix_ms},
  });
}

/** The field with the Sun's occurrence taken out, the family's list kept in step. The same field object when no Sun stands. */
export function withoutSubsolar(field: Field): Field {
  if (!field.occurrences.some((item) => item.id === SUBSOLAR_OCCURRENCE_ID)) return field;
  const occurrences = field.occurrences.filter((item) => item.id !== SUBSOLAR_OCCURRENCE_ID);
  const families = field.families.map((family) => family.occurrenceIds.includes(SUBSOLAR_OCCURRENCE_ID)
    ? {...family, occurrenceIds: family.occurrenceIds.filter((id) => id !== SUBSOLAR_OCCURRENCE_ID)}
    : family);
  return {...field, families, occurrences, meta: {...field.meta, counts: {...field.meta.counts, occurrences: occurrences.length}}};
}

/** Admits the owner's stated subsolar point into a field through the one admission path. A Sun already in the field is
 * replaced, never added to. The family is declared by this module when the field does not already declare it; a field
 * that declares it keeps its own entry. When the new reading places no Sun, the field carries none. */
export function admitSubsolar(field: Field, snapshot: unknown): {field: Field; admitted: Occurrence[]; refused: AdmissionRefusal[]} {
  const base = withoutSubsolar(field);
  const checked = subsolarOccurrence(snapshot);
  if (!checked.ok) return {field: base, admitted: [], refused: [{index: 0, reason: checked.reason}]};
  const declared = base.families.some((family) => family.id === QL_SKY_FAMILY_ID);
  return admitOccurrences(declared ? base : {...base, families: [...base.families, QL_SKY_FAMILY]}, [checked.value]);
}

/** The instant the Earth shows: the present (no shared window in force, so all time) or one whole year. */
export type ShownInstant = {readonly present: true; readonly at: Date} | {readonly present: false; readonly year: number};

/** The instant the Earth shows, from the year the shared window stands for (null for all time) and the present moment. */
export function shownInstantOf(year: number | null, at: Date): ShownInstant {
  return year === null ? {present: true, at} : {present: false, year};
}

function requestAt(epoch: string, mode: SkyRequest['mode']): SkyRequest {
  return {
    schema: 'ql.sky-request/v1',
    epoch,
    timezone: 'UTC',
    mode,
    perspective: 'Apparent Geocentric',
    zodiac: 'Tropical',
    ayanamsha: null,
    observer: null,
    max_age_seconds: 300,
    backend_policy: 'allow-moshier',
  };
}

/** The request for the present sky at an instant: `current`, UTC, to the second. */
export function currentSkyRequest(at: Date): SkyRequest {
  return requestAt(`${at.toISOString().slice(0, 19)}Z`, 'current');
}

/** The request for the instant the Earth shows: `current` for the present, `historical` at the year start (UTC) for a year. A
 * year outside the QL sky adapter's range is refused by name, before any kernel call. */
export function skyRequestFor(instant: ShownInstant): Checked<SkyRequest> {
  if (instant.present) return {ok: true, value: currentSkyRequest(instant.at)};
  const {year} = instant;
  if (!Number.isSafeInteger(year) || year < DATED_SKY_FIRST_YEAR || year >= DATED_SKY_END_YEAR) {
    return refuse(`the dated sky answers only ${DATED_SKY_FIRST_YEAR} to ${DATED_SKY_END_YEAR - 1}, and the Earth shows ${year}`);
  }
  return {ok: true, value: requestAt(`${String(year).padStart(4, '0')}-01-01T00:00:00Z`, 'historical')};
}

export interface DatedSubsolarState {
  /** the field the Earth draws: admitted with the stated point when placed, otherwise the field without a Sun */
  field: Field;
  placed: boolean;
  /** the owner's or the channel's words for why the point is not placed; null when placed */
  reason: string | null;
  /** the instant the Sun was read for */
  instant: ShownInstant;
}

/** Reads the sky for the instant the Earth shows through the kernel's transit reading and admits the owner's stated subsolar
 * point. Every refusal is kept: the range, the channel's own error, the owner's transit status, the epoch the reply
 * answered for, or the named admission refusal. */
export async function admitDatedSubsolar(field: Field, transport: KernelTransportStatus, instant: ShownInstant): Promise<DatedSubsolarState> {
  const absent = (reason: string): DatedSubsolarState => ({field: withoutSubsolar(field), placed: false, reason, instant});
  const request = skyRequestFor(instant);
  if (!request.ok) return absent(request.reason);
  const call = await kernelOp(transport, {op: 'nara_identity', request: {operation: 'transit', request: request.value}});
  if (call.error || !call.outcome) return absent(`the dated sky did not answer: ${call.error ?? 'no outcome was returned'}`);
  if (call.outcome.result !== 'nara_identity') return absent(`the kernel answered ${call.outcome.result}, not the dated sky`);
  const data = call.outcome.data as NaraIdentityResult;
  if (data.error) return absent(data.error);
  const sky = data.transit?.sky ?? null;
  if (!sky) return absent(`the dated sky is unavailable (transit status: ${data.transit?.status ?? 'no transit reading'})`);
  if (!instant.present && sky.epoch_utc !== request.value.epoch) return absent(`the dated sky answered for ${sky.epoch_utc}, not ${request.value.epoch}`);
  const admitted = admitSubsolar(field, sky);
  if (!admitted.admitted.length) return absent(admitted.refused[0]?.reason ?? 'the stated point was not admitted');
  return {field: admitted.field, placed: true, reason: null, instant};
}

/** The words the Earth states about its Sun, on its own status line. The line names the instant the Sun is drawn for. A
 * Sun that is placed for the instant the Earth shows is stated by nothing. A Sun not placed is stated with its reason. While
 * the Sun is behind the window (`behind`: the window has moved and the Sun is not yet read for it, or a read is pending),
 * the line says the Sun is read for the instant shown once the window settles. `shownYear` is the year the Earth shows, or
 * null for all time. */
export function sunStanding(sun: DatedSubsolarState, shownYear: number | null, reading = false): string | null {
  const drawnYear = sun.instant.present ? null : sun.instant.year;
  const drawn = sun.instant.present ? 'the present sky' : `the year ${sun.instant.year}`;
  const shown = shownYear === null ? 'all time' : `the year ${shownYear}`;
  const behind = reading || drawnYear !== shownYear;
  const follows = `The Earth shows ${shown}, and the Sun is read for it when the window settles.`;
  if (!sun.placed) {
    const reason = (sun.reason ?? 'the stated point was not placed').replace(/\.$/, '');
    return `The Sun is not placed on the Earth for ${drawn}: ${reason}.${behind ? ` ${follows}` : ''}`;
  }
  if (!behind) return null;
  return `The Sun is drawn for ${drawn}. ${follows}`;
}
