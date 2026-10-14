/** The one Occurrence contract's producer side (WORLD-SHELL-DESIGN §3.1, §10.6; T6).
 *
 * The Earth's `Occurrence` (projections/atlas/src/types/field.ts) IS the contract. Owners produce records in it
 * (the Factory binding, the QL sky snapshot, the corpus ingest) and the Earth reads them. This module is the single
 * check every producer passes through and the single place a checked record is admitted into a field.
 *
 * Laws: nothing here computes astronomy, invents a family, place or year, or upgrades the standing of a record. A
 * basis names the owner reading a record came from; a record with no basis (the founding Jung field) stays valid.
 * Pure TypeScript: no React, no transport, no timers. */

import type {Field, LocusType, GeoPrecision, Occurrence, OccurrenceBasis} from './atlas/src/types/field'

export const LOCUS_TYPES: readonly LocusType[] = ['artifact', 'text-passage', 'myth-episode', 'ritual', 'dream', 'vision', 'active-imagination', 'clinical-case', 'historical-event', 'sky']
export const GEO_PRECISIONS: readonly GeoPrecision[] = ['place', 'region', 'culture', 'none']
const BASIS_KEYS: readonly string[] = ['ref', 'revision', 'epoch', 'read_at_unix_ms']

/** A refusal names the field or rule it failed, in plain words. */
export interface Refusal {
  readonly ok: false;
  readonly reason: string;
}
export type Checked<T> = { readonly ok: true; readonly value: T } | Refusal;

export const refuse = (reason: string): Refusal => ({ ok: false, reason });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** A basis is closed: its ref is a non-empty string, and only the four named fields may appear. */
export function basisOf(input: unknown): Checked<OccurrenceBasis> {
  if (!isRecord(input)) return refuse('the basis is not an object');
  const extra = Object.keys(input).filter((key) => !BASIS_KEYS.includes(key));
  if (extra.length) return refuse(`the basis names fields the contract does not carry: ${extra.join(', ')}`);
  if (!text(input.ref)) return refuse('the basis names no owner ref');
  if (input.revision !== undefined && !text(input.revision)) return refuse('the basis revision is not a non-empty string');
  if (input.epoch !== undefined && !text(input.epoch)) return refuse('the basis epoch is not a non-empty string');
  if (input.read_at_unix_ms !== undefined && !finite(input.read_at_unix_ms)) return refuse('the basis read instant is not a finite unix millisecond value');
  const basis: OccurrenceBasis = {
    ref: input.ref,
    ...(input.revision !== undefined ? { revision: input.revision as string } : {}),
    ...(input.epoch !== undefined ? { epoch: input.epoch as string } : {}),
    ...(input.read_at_unix_ms !== undefined ? { read_at_unix_ms: input.read_at_unix_ms as number } : {}),
  };
  return { ok: true, value: basis };
}

const citeOk = (value: unknown): boolean =>
  isRecord(value) && text(value.work) && typeof value.workTitle === 'string' && typeof value.year === 'string' && typeof value.locator === 'string';

/** Checks one record against the Earth's `Occurrence` contract. Every producer, Factory and QL alike, passes here.
 * The first violation is returned by name; a checked record is returned with its basis normalised. */
export function checkOccurrence(value: unknown): Checked<Occurrence> {
  if (!isRecord(value)) return refuse('the occurrence is not an object');
  if (!text(value.id)) return refuse('the occurrence has no id');
  const where = `occurrence ${String(value.id)}`;
  if (value.subject_ref !== undefined && !text(value.subject_ref)) return refuse(`${where}: subject_ref is not a non-empty string`);
  if (!text(value.title)) return refuse(`${where}: no title`);
  if (typeof value.label !== 'string') return refuse(`${where}: no label`);
  if (!text(value.familyId)) return refuse(`${where}: no familyId`);
  if (!Array.isArray(value.coFamilyIds) || !value.coFamilyIds.every(text)) return refuse(`${where}: coFamilyIds is not a list of ids`);
  if (!LOCUS_TYPES.includes(value.locusType as LocusType)) return refuse(`${where}: locusType "${String(value.locusType)}" is not in the contract`);
  if (!Array.isArray(value.cultureIds) || !value.cultureIds.every(text)) return refuse(`${where}: cultureIds is not a list of ids`);
  if (typeof value.place !== 'string') return refuse(`${where}: place is not prose`);
  if (!finite(value.lat) || Math.abs(value.lat) > 90) return refuse(`${where}: lat is not a latitude (lat/lon are always present; (0,0) when unplaced)`);
  if (!finite(value.lon) || Math.abs(value.lon) > 180) return refuse(`${where}: lon is not a longitude`);
  if (!GEO_PRECISIONS.includes(value.geoPrecision as GeoPrecision)) return refuse(`${where}: geoPrecision "${String(value.geoPrecision)}" is not in the contract`);
  if (!finite(value.year)) return refuse(`${where}: year is not a number`);
  if (typeof value.yearDisplay !== 'string') return refuse(`${where}: yearDisplay is not text`);
  if (value.yearRange !== undefined && !(Array.isArray(value.yearRange) && value.yearRange.length === 2 && value.yearRange.every(finite))) return refuse(`${where}: yearRange is not a pair of years`);
  if (!Array.isArray(value.cites) || !value.cites.every(citeOk)) return refuse(`${where}: cites are not {work, workTitle, year, locator}`);
  if (value.quote !== undefined && typeof value.quote !== 'string') return refuse(`${where}: quote is not text`);
  if (!Array.isArray(value.body) || !value.body.every((paragraph) => typeof paragraph === 'string')) return refuse(`${where}: body is not a list of paragraphs`);
  if (!Array.isArray(value.parallelIds) || !value.parallelIds.every(text)) return refuse(`${where}: parallelIds is not a list of ids`);
  if (value.image !== undefined && !isRecord(value.image)) return refuse(`${where}: image is not an image reference`);
  let basis: OccurrenceBasis | undefined;
  if (value.basis !== undefined) {
    const checked = basisOf(value.basis);
    if (!checked.ok) return refuse(`${where}: ${checked.reason}`);
    basis = checked.value;
  }
  const occurrence = { ...value, ...(basis ? { basis } : {}) } as unknown as Occurrence;
  return { ok: true, value: occurrence };
}

export interface AdmissionRefusal {
  readonly index: number;
  readonly id?: string;
  readonly reason: string;
}

/** Admits checked records into a field, in the field's own order. A record is refused by name when it fails the
 * contract, when its id is already in the field, or when the field declares no family for it: the Earth draws an
 * occurrence through its family's palette, so an undeclared family is not placed. The field's family lists and
 * counts are kept in step with what was admitted. */
export function admitOccurrences(field: Field, candidates: readonly unknown[]): { field: Field; admitted: Occurrence[]; refused: AdmissionRefusal[] } {
  const ids = new Set(field.occurrences.map((item) => item.id));
  const declared = new Set(field.families.map((family) => family.id));
  const admitted: Occurrence[] = [];
  const refused: AdmissionRefusal[] = [];
  candidates.forEach((candidate, index) => {
    const checked = checkOccurrence(candidate);
    if (!checked.ok) return refused.push({ index, reason: checked.reason });
    const occurrence = checked.value;
    if (ids.has(occurrence.id)) return refused.push({ index, id: occurrence.id, reason: `occurrence ${occurrence.id} is already in the field` });
    if (!declared.has(occurrence.familyId)) return refused.push({ index, id: occurrence.id, reason: `the field declares no family "${occurrence.familyId}", so ${occurrence.id} is not placed` });
    ids.add(occurrence.id);
    admitted.push(occurrence);
  });
  if (!admitted.length) return { field, admitted, refused };
  const year = new Map([...field.occurrences, ...admitted].map((item) => [item.id, item.year] as const));
  const families = field.families.map((family) => {
    const added = admitted.filter((item) => item.familyId === family.id).map((item) => item.id);
    if (!added.length) return family;
    return { ...family, occurrenceIds: [...family.occurrenceIds, ...added].sort((a, b) => (year.get(a) ?? 0) - (year.get(b) ?? 0)) };
  });
  const counts = field.meta.counts;
  return {
    field: {
      ...field,
      families,
      occurrences: [...field.occurrences, ...admitted],
      meta: { ...field.meta, counts: { ...counts, occurrences: field.occurrences.length + admitted.length } },
    },
    admitted,
    refused,
  };
}
