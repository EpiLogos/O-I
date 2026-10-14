// World track adapter contract.
//
// A family projects its own reading into the Timeline projection's neutral
// shape: columns (time blocks, e.g. scenes), tracks (lanes, e.g. objects or
// automation), clips (spans placed in a column on a track), and optional
// transport material. The Timeline renders this shape; it knows no family.
//
// Optional time grammar (DEVICE-SEMANTICS-LOCK §7.2): layers (readings that
// extend one another, never rewrite), sections (nested spans, Live's locators)
// and walks (ordered stops, Live's follow-action chains through clips). Every
// addition is optional: an adapter that declares none stays valid.
//
// Pure TypeScript. No React, no family names.

/** A clip's standing as the one standing authority reads it: the visual class
 * it is drawn with, the owner's verbatim word (null when none), and the rule
 * that chose the class. Declared structurally so this contract names no
 * family; the timeline spine fills it from the authority. */
export interface ClipStandingReading {
  visual: 'sourced' | 'derived' | 'authored' | 'disputed' | 'mythic' | 'unavailable';
  verbatim: string | null;
  rule: string;
}

export interface WorldTrackColumn {
  id: string;
  name: string;
}

export interface WorldTrack {
  id: string;
  name: string;
  // Lane kind, chosen by the family (e.g. 'entity', 'automation', 'walk').
  kind: string;
  // The layer (reading) the lane belongs to, when the family declares layers.
  layerId?: string;
  // The track a lane belongs to: lanes that share one groupId are one track.
  groupId?: string;
  // Which side of a grouped track this lane is: sight ('visual') or sound ('audio').
  lane?: 'visual' | 'audio';
}

export interface WorldTrackClip {
  id: string;
  trackId: string;
  columnId: string;
  label: string;
  // Column-local time span. Units are the family's own.
  span?: {start: number; end: number};
  // The family's own stated word, kept verbatim (legacy; the presentation
  // draws from `standing`, never from this word).
  state?: string;
  // The clip's standing, read by the one standing authority (the spine's
  // eventStanding / readStanding call it). Adapters compute it
  // from the source's own disclosed fields; the presentation only draws it.
  // Absent means nothing was disclosed for this clip.
  standing?: ClipStandingReading;
}

// A transport take exposed by a family. Takes belong to the Transport stratum
// of the time spine. An adapter may expose them, but a take is never a clock
// and never a Timeline track.
export interface WorldTrackTake {
  id: string;
  target: string;
  name: string;
}

// A layer: one reading of the material. A later layer extends an earlier one
// and never rewrites it.
export interface WorldTrackLayer {
  id: string;
  name: string;
  extends?: string;
}

// A section: a nested span on the time axis (a locator). The narrowest section
// containing a point supplies what plays inside it.
export interface WorldTrackSection {
  id: string;
  name: string;
  // Half-open span [start, end). Units are the family's own.
  span: {start: number; end: number};
  parentId?: string;
  layerId?: string;
  // The colour the section gives what plays inside it: a hex, or the family's own token.
  atmosphere?: string;
}

// A stop: one step of a walk. It stands a clip of the set, carries a year and a
// place when the material has them, and reaches every item attached to it.
export interface WorldWalkStop {
  id: string;
  label: string;
  // The clip this stop stands (a clip of the same set).
  clipId?: string;
  // Tunes the transport position, when the material has a time.
  year?: number;
  // Tunes the globe, when the material has a place.
  place?: {label?: string; lat?: number; lon?: number};
  // Bucket-mates and attached material reached from this stop. Nothing is dropped.
  also: string[];
  // The scene the stop launches (a scene of the family's own), when the material names one.
  sceneRef?: string;
}

// A walk: an ordered path through the stops. A derived walk is computed from the
// material on read and is never stored.
export interface WorldWalk {
  id: string;
  name: string;
  layerId?: string;
  // The family's own kind of walk. The Timeline does not interpret it.
  kind: string;
  derived: boolean;
  stops: WorldWalkStop[];
}

export interface WorldTrackSet {
  columns: WorldTrackColumn[];
  tracks: WorldTrack[];
  clips: WorldTrackClip[];
  transport?: {takes: WorldTrackTake[]};
  layers?: WorldTrackLayer[];
  sections?: WorldTrackSection[];
  walks?: WorldWalk[];
}

export interface WorldTrackAdapter<T> {
  id: string;
  project(reading: T): WorldTrackSet;
}

// Everything a walk reaches: each stop's own id, the clip it stands, and every
// `also` ref. An unknown walk reaches nothing.
export function walkReaches(set: WorldTrackSet, walkId: string): Set<string> {
  const reached = new Set<string>();
  const walk = set.walks?.find((w) => w.id === walkId);
  for (const stop of walk?.stops ?? []) {
    reached.add(stop.id);
    if (stop.clipId !== undefined) reached.add(stop.clipId);
    for (const ref of stop.also) reached.add(ref);
  }
  return reached;
}
