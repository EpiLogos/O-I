// The walks of the field, the Red Book and the dynamics route, through the one walk shape the Timeline reads
// (`src/timeline/worldTrackAdapter.ts`: WorldWalk, WorldWalkStop, WorldTrackSection). Aion's walks are in
// `aionTimeline.ts`. Each projection reads the ported Archetypal-Earth material and returns a WorldTrackSet that
// carries one walk and, where the material has them, sections. Pure: the inputs are read, never mutated; nothing is
// stored. The projections call the ported functions and never reimplement them.
//
// Port sources (src/projections/atlas/src/, pinned at Archetypal-Earth 5fe5117):
//   field thread   — data/thread.ts:9-19 ThreadStep (`also`: :18); :87-95 planThread (buckets, thinning, bucket-mates)
//   Red Book       — types/redbook.ts:23-27 RedBookSection; :30-38 RedBookStop; :62-70 RedBook (sections :67, stops :68)
//   dynamics route — types/dynamics.ts:54-66 RouteStop; :68-74 RouteMovement (stops :73); :77-82 DynamicsRoute (movements :81)

import type { WorldTrackSection, WorldTrackSet, WorldWalk, WorldWalkStop } from '../../timeline/worldTrackAdapter';
import type { Model } from './src/data/model';
import { planThread } from './src/data/thread';
import type { DynamicsRoute } from './src/types/dynamics';
import type { RedBook } from './src/types/redbook';

/** A stop's place, when the material has one (its label, latitude, longitude; each as the material gives it). */
export function stopPlace(e: { place?: string; lat?: number; lon?: number }): WorldWalkStop['place'] | undefined {
  if (e.place === undefined && e.lat === undefined && e.lon === undefined) return undefined;
  return { label: e.place, lat: e.lat, lon: e.lon };
}

/** One walk, with the sections it runs through, as a Timeline set. The Timeline's columns, tracks and clips stay empty:
 * the walk is the whole of what these projections give. */
function walkSet(walks: WorldWalk[], sections: WorldTrackSection[] = []): WorldTrackSet {
  return { columns: [], tracks: [], clips: [], sections, walks };
}

export type ThreadSubjectType = 'family' | 'archetype' | 'parallels';

function threadName(model: Model, type: ThreadSubjectType, id: string): string {
  if (type === 'family') return model.famById.get(id)?.name ?? id;
  if (type === 'archetype') return model.archById.get(id)?.name ?? id;
  const i = model.occIndex.get(id);
  return i === undefined ? id : model.occ[i].title;
}

/** A field thread: a subject's located occurrences by year, thinned to one step per time bucket (planThread). Each step
 * stands its occurrence, with year and place; `also` = the step's bucket-mates and the subject's unplaced occurrences,
 * as occurrence ids, so every occurrence of the subject is reached from the walk. Derived on read. */
export function projectFieldThread(model: Model, type: ThreadSubjectType, id: string): WorldTrackSet {
  const stops: WorldWalkStop[] = planThread(model, type, id).map((step) => {
    const o = model.occ[step.occ];
    const place = stopPlace(model.located[step.occ] ? { place: o.place, lat: o.lat, lon: o.lon } : {});
    return {
      id: o.id,
      label: o.label,
      year: o.year,
      ...(place ? { place } : {}),
      also: step.also.map((k) => model.occ[k].id),
    };
  });
  return walkSet([{ id: `field:${type}:${id}`, name: threadName(model, type, id), kind: 'field-thread', derived: true, stops }]);
}

/** The Red Book: one stop per curated `stops[]` entry, in curated order (not derived). Each section spans the years of
 * its dated stops, half-open (the last year + 1, as an Aion event's width). A stop the field does not carry keeps its
 * place in the walk, labelled by its id and undated, so no curated stop is dropped. */
export function projectRedbookWalk(model: Model, redbook: RedBook): WorldTrackSet {
  const yearOf = (id: string): number | undefined => {
    const i = model.occIndex.get(id);
    return i === undefined ? undefined : model.occ[i].year;
  };
  const stops: WorldWalkStop[] = redbook.stops.map((stop) => {
    const i = model.occIndex.get(stop.id);
    if (i === undefined) return { id: stop.id, label: stop.id, also: [] };
    const o = model.occ[i];
    const place = stopPlace(model.located[i] ? { place: o.place, lat: o.lat, lon: o.lon } : {});
    return { id: stop.id, label: o.label, year: o.year, ...(place ? { place } : {}), also: [] };
  });
  const sections: WorldTrackSection[] = [];
  for (const section of redbook.sections) {
    const years = redbook.stops
      .filter((s) => s.sectionId === section.id)
      .map((s) => yearOf(s.id))
      .filter((y): y is number => y !== undefined);
    // A section with no dated stop has no span to draw; its stops remain in the walk.
    if (years.length === 0) continue;
    sections.push({ id: section.id, name: section.name, span: { start: Math.min(...years), end: Math.max(...years) + 1 } });
  }
  return walkSet([{ id: 'redbook', name: redbook.mode.title, kind: 'redbook', derived: false, stops }], sections);
}

/** The dynamics route: one stop per route stop, in order, across the movements (not derived). Each movement is a section
 * whose span is its range of stop indices, half-open. A stop's `also` is its family ids. */
export function projectDynamicsRoute(route: DynamicsRoute): WorldTrackSet {
  const stops: WorldWalkStop[] = [];
  const sections: WorldTrackSection[] = [];
  for (const movement of route.movements) {
    const start = stops.length;
    for (const stop of movement.stops) {
      stops.push({ id: stop.id, label: stop.name ?? stop.concept ?? stop.id, also: [...(stop.familyIds ?? [])] });
    }
    if (stops.length > start) sections.push({ id: movement.id, name: movement.title, span: { start, end: stops.length } });
  }
  return walkSet([{ id: 'dynamics-route', name: route.title, kind: 'dynamics-route', derived: false, stops }], sections);
}
