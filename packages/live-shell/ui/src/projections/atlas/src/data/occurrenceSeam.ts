// [§8.4] host adaptation (DEVICE-SEMANTICS-LOCK §8.4), T-ATLAS-SEAM: one occurrence of the mounted field replaced in place.
//
// The host draws one occurrence that changes with the shared window: the QL family's Sun (inhabitants/qlSkyEarthAdapter.ts).
// The model's per-occurrence arrays are index-aligned with `occ`, and the globe's buffers are index-aligned with the model,
// so a replacement that moved the other occurrences would rebuild every index. This seam does not move any:
//   - an occurrence not yet in the model is appended at the tail (index n); a replaced one keeps its index;
//   - a removal is allowed only for the tail occurrence (index n-1).
// The admission path appends (projections/occurrence.ts admitOccurrences), so the Sun sits at the tail at mount and after
// every replacement, and the tail rule holds for it.
//
// The derivation below is buildModel's (data/model.ts) for one occurrence. It is exact for a family the field ties to no
// archetype and no theoretic, and for a place that is no recorded place (a place is two or more occurrences; one is not a
// place). Anything else is refused by name rather than patched, because the derived archOcc, theoOcc and places would each
// need rebuilding. Validation runs in full before any mutation, so a refusal leaves the model as it was.
//
// Declared families are kept: a removed occurrence leaves its family declared with an empty occurrence list.

import type { Family, Occurrence } from '../types/field';
import { slug, shortPlace, type Model } from './model';
import { UNDATED_U } from './time';
import { dirFromLatLon, type Vec3 } from './geo';
import { toRgbPalette, type RGB } from './palette';

export interface SeamChange {
  readonly id: string;
  /** the index the occurrence holds after the change; -1 when it holds none */
  readonly index: number;
  readonly removed: boolean;
  /** false when there was nothing to do (an absence asked for an occurrence the model does not hold) */
  readonly changed: boolean;
}

export class OccurrenceSeamRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OccurrenceSeamRefusal';
  }
}

function refuse(message: string): never {
  throw new OccurrenceSeamRefusal(message);
}

/** Inserts an index into a list kept in year order (the order buildModel sorts every occurrence list into). */
function insertByYear(model: Model, list: number[], index: number): void {
  const year = model.occ[index].year;
  let at = list.length;
  while (at > 0 && model.occ[list[at - 1]].year > year) at--;
  list.splice(at, 0, index);
}

function dropIndex(list: number[] | undefined, index: number): void {
  if (!list) return;
  const at = list.indexOf(index);
  if (at >= 0) list.splice(at, 1);
}

/** The field ties this family to an archetype or a theoretic: its archOcc, theoOcc and tags would change. */
function tiedElsewhere(model: Model, family: Family): string | null {
  if (family.archetypes.length) return `the family ${family.id} is tied to archetypes of its own`;
  for (const a of model.archById.values()) if (a.familyIds.includes(family.id)) return `the family ${family.id} is tied to archetype ${a.id}`;
  for (const t of model.theoById.values()) if (t.families.some((x) => x.id === family.id)) return `the family ${family.id} is tied to theoretic ${t.id}`;
  return null;
}

/** The place id buildModel would give this occurrence, or undefined when it has none. */
function placeIdOf(occ: Occurrence): string | undefined {
  const located = occ.geoPrecision !== 'none' && Number.isFinite(occ.lat) && Number.isFinite(occ.lon);
  const sp = located ? shortPlace(occ.place ?? '') : '';
  return sp ? slug(sp) : undefined;
}

/**
 * Replaces the occurrence `id` in the mounted model, in place. `occ` is the occurrence to hold, or null to take it away.
 * `family` declares the occurrence's family when the model does not yet hold it. Throws OccurrenceSeamRefusal, naming the
 * rule, before any change is made.
 */
export function replaceModelOccurrence(model: Model, occ: Occurrence | null, id: string, family?: Family): SeamChange {
  if (occ !== null && occ.id !== id) refuse(`the occurrence ${occ.id} was given for ${id}`);
  if (model.field.occurrences !== model.occ) refuse('the model no longer holds the field\'s occurrence list, so it cannot be changed in place');
  const n = model.occ.length;
  const at = model.occIndex.get(id);

  if (occ === null) {
    if (at === undefined) return { id, index: -1, removed: false, changed: false };
    if (at !== n - 1) refuse(`${id} is at ${at} of ${n}: only the last occurrence leaves the globe in place, so no other index moves`);
    removeTail(model, n - 1);
    return { id, index: -1, removed: true, changed: true };
  }

  // ── validate in full, then change ──
  const fam = model.famById.get(occ.familyId) ?? (family && family.id === occ.familyId ? family : undefined);
  if (!fam) refuse(`the family ${occ.familyId} is not declared, and none was given for ${id}`);
  const palette = model.famPalette.get(fam.id) ?? (fam.palette ? toRgbPalette(fam.palette, fam.spectrum?.position ?? 0.5) : undefined);
  if (!palette) refuse(`the family ${fam.id} has no palette, so ${id} has no colour`);
  const tie = tiedElsewhere(model, fam);
  if (tie) refuse(`${id} cannot be placed in place: ${tie}`);
  const place = placeIdOf(occ);
  if (place && model.places.has(place)) refuse(`${id} is placed at ${place}, a recorded place; a place is rebuilt, not patched`);

  const located = occ.geoPrecision !== 'none' && Number.isFinite(occ.lat) && Number.isFinite(occ.lon);
  const dir: Vec3 = dirFromLatLon(occ.lat, occ.lon);
  const u = occ.dated === false ? UNDATED_U : model.scale.toU(occ.year); // [§8.4 host] undated: outside the scale
  const colour: RGB = [...palette.core] as RGB;
  const k = at ?? n;

  // the old occurrence leaves its lists
  if (at !== undefined) {
    const old = model.occ[at];
    dropIndex(model.famOcc.get(old.familyId), at);
    for (const c of old.cultureIds) dropIndex(model.cultureOcc.get(c), at);
    model.occIndex.delete(old.id);
  }

  // the arrays at k: appended at the tail, or overwritten at the index it holds
  if (k === n) {
    model.occ.push(occ);
    model.dir.push(dir);
    model.colour.push(colour);
    model.tags.push({ archetypes: [], theoretics: [] });
    model.occPlace.push(undefined);
    model.u = grow(model.u, n + 1);
    model.located = growBytes(model.located, n + 1);
  } else {
    model.occ[k] = occ;
    model.dir[k] = dir;
    model.colour[k] = colour;
    model.tags[k] = { archetypes: [], theoretics: [] };
    model.occPlace[k] = undefined; // a single occurrence is not a place
  }
  model.u[k] = u;
  model.located[k] = located ? 1 : 0;

  // the new occurrence joins its lists, and its family is declared when the model did not hold it
  if (!model.famById.has(fam.id)) model.famById.set(fam.id, fam);
  if (!model.famPalette.has(fam.id)) model.famPalette.set(fam.id, palette);
  if (!model.field.families.some((f) => f.id === fam.id)) model.field.families.push(fam);
  let famList = model.famOcc.get(fam.id);
  if (!famList) model.famOcc.set(fam.id, (famList = []));
  insertByYear(model, famList, k);
  for (const c of occ.cultureIds) {
    let list = model.cultureOcc.get(c);
    if (!list) model.cultureOcc.set(c, (list = []));
    insertByYear(model, list, k);
  }
  model.occIndex.set(occ.id, k);
  syncCounts(model);
  return { id, index: k, removed: false, changed: true };
}

function removeTail(model: Model, k: number): void {
  const old = model.occ[k];
  dropIndex(model.famOcc.get(old.familyId), k);
  for (const c of old.cultureIds) dropIndex(model.cultureOcc.get(c), k);
  model.occIndex.delete(old.id);
  model.occ.pop();
  model.dir.pop();
  model.colour.pop();
  model.tags.pop();
  model.occPlace.pop();
  model.u = model.u.slice(0, k);
  model.located = model.located.slice(0, k);
  syncCounts(model);
}

function grow(src: Float32Array, length: number): Float32Array {
  const out = new Float32Array(length);
  out.set(src.subarray(0, Math.min(src.length, length)));
  return out;
}

function growBytes(src: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(src.subarray(0, Math.min(src.length, length)));
  return out;
}

function syncCounts(model: Model): void {
  const counts = model.field.meta.counts;
  counts.occurrences = model.occ.length;
  counts.families = model.field.families.length;
}
