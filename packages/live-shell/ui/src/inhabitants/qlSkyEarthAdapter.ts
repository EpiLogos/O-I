/** The QL family's sky→Earth adapter (WORLD-SHELL-DESIGN §3.1, §10.6, §12; manifest `ql-sky-earth-adapter`).
 *
 * The family's projection contribution. The atlas port keeps only the sky envelope (projections/atlas/provider/
 * skyProvider.ts) and never writes this. This module binds ONE point the QL owner states of its dated sky, `subsolar`
 * (additive in `ql.sky-snapshot/v1`, Work/Quaternal-Logic commit 120f093), into the Earth's occurrence contract, with the
 * owner's snapshot as its basis. It admits nothing else: no grid projection, no ephemeris, no other body. The other
 * bodies carry ecliptic longitudes only and have no Earth position, so none is placed.
 *
 * Read path: the native dated-sky transit (`kernel_op` → `nara_identity` / `transit`), the reading the Places day/night
 * already uses. Its `sky` is the owner's snapshot, passed through untouched.
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
    id: `sky-subsolar:${epoch}`,
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

/** Admits the owner's stated subsolar point into a field through the one admission path. The family is declared by
 * this module when the field does not already declare it; a field that declares it keeps its own entry. */
export function admitSubsolar(field: Field, snapshot: unknown): {field: Field; admitted: Occurrence[]; refused: AdmissionRefusal[]} {
  const checked = subsolarOccurrence(snapshot);
  if (!checked.ok) return {field, admitted: [], refused: [{index: 0, reason: checked.reason}]};
  const declared = field.families.some((family) => family.id === QL_SKY_FAMILY_ID);
  return admitOccurrences(declared ? field : {...field, families: [...field.families, QL_SKY_FAMILY]}, [checked.value]);
}

/** The request for the sky at an instant: `current` (the present sky), UTC, to the second. */
export function currentSkyRequest(at: Date): SkyRequest {
  return {
    schema: 'ql.sky-request/v1',
    epoch: `${at.toISOString().slice(0, 19)}Z`,
    timezone: 'UTC',
    mode: 'current',
    perspective: 'Apparent Geocentric',
    zodiac: 'Tropical',
    ayanamsha: null,
    observer: null,
    max_age_seconds: 300,
    backend_policy: 'allow-moshier',
  };
}

export interface DatedSubsolarState {
  /** the field the Earth draws: admitted with the stated point when placed, otherwise the field as given */
  field: Field;
  placed: boolean;
  /** the owner's or the channel's words for why the point is not placed; null when placed */
  reason: string | null;
}

/** Reads the current dated sky through the kernel's transit reading and admits the owner's stated subsolar point. Every
 * refusal is kept: the channel's own error, the owner's transit status, or the named admission refusal. */
export async function admitDatedSubsolar(field: Field, transport: KernelTransportStatus, at: Date): Promise<DatedSubsolarState> {
  const absent = (reason: string): DatedSubsolarState => ({field, placed: false, reason});
  const call = await kernelOp(transport, {op: 'nara_identity', request: {operation: 'transit', request: currentSkyRequest(at)}});
  if (call.error || !call.outcome) return absent(`the dated sky did not answer: ${call.error ?? 'no outcome was returned'}`);
  if (call.outcome.result !== 'nara_identity') return absent(`the kernel answered ${call.outcome.result}, not the dated sky`);
  const data = call.outcome.data as NaraIdentityResult;
  if (data.error) return absent(data.error);
  const sky = data.transit?.sky ?? null;
  if (!sky) return absent(`the dated sky is unavailable (transit status: ${data.transit?.status ?? 'no transit reading'})`);
  const admitted = admitSubsolar(field, sky);
  if (!admitted.admitted.length) return absent(admitted.refused[0]?.reason ?? 'the stated point was not admitted');
  return {field: admitted.field, placed: true, reason: null};
}
