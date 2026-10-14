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

/** How a clip stands right now (manual §3: "Every clip shows its state — waiting, running, stopped, recording, stalled —
 * so you can read a whole grid at a glance"). Disclosed by the family from its owner's reading; absent = not disclosed. */
export type ClipStatus = 'waiting' | 'running' | 'stopped' | 'recording' | 'stalled';
/** When a launch lands and what comes after (manual §3: launch quantize and follow actions). Words are the family's own. */
export interface ClipLaunch {
  quantize?: string;
  follow?: string;
}
/** One take under a clip (manual §3: "Takes stack under a clip so you can choose the one that stands"). */
export interface WorldClipTake {
  id: string;
  name: string;
  standing?: boolean;
}
/** The owner operations the shared Session and Arrangement may call (FOUNDATION F3: "an `actions` port naming owner ops").
 * Each names the owner op it runs; a family that declares none leaves its grid read-only. Selection is the shell's own
 * (WorldContext.selection), never an action. */
export interface WorldTrackActions {
  launch?: {op: string; run(clipId: string): unknown};
  launchStop?: {op: string; run(columnId: string): unknown};
  stopTrack?: {op: string; run(trackId: string): unknown};
  record?: {op: string; run(clipId: string): unknown};
  /** Restart a stalled lane from its last good step (manual §6: "its track lights a retry"). The Session shows a retry on
   * each track only where the set carries this, and lights it while the lane has stalled. */
  retry?: {op: string; run(trackId: string): unknown};
  /** Seat what is dropped on the empty track (manual §10.3: "To seat an agent, drag it onto an empty track"): the drag type
   * the set accepts, and the owner op that seats it. The dropped payload reaches `run` as the drag carried it. */
  seat?: {op: string; accepts: string; run(payload: string): unknown};
}
/** What an owner op answers when it answers in words (the shell's own control receipt): a note, or the refusal. An action's
 * `run` may return one, or a promise of one; the Session shows it where the action was pressed. Any other return is not shown. */
export type WorldActionReceipt = {ok: true; note?: string} | {ok: false; error: string};
export interface WorldTrack {
  id: string;
  name: string;
  /** The track's colour (a hex), when the family's owner gives one. */
  color?: string;
  /** Where the track's needle stands on the ruler (Arrangement: "a needle showing where it has got to"), in the ruler's units. */
  needle?: number;
  /** The lane has stalled, as its owner says (manual §6: "a needle that stops moving is a stall"). The Session lights the
   * track's retry and the Arrangement draws its needle stalled. A lane that holds a stalled clip reads as stalled without it. */
  stalled?: boolean;
  /** How deep it sits under a group (manual §6: "each agent's helpers step in beneath it, a coloured rail for every level");
   * 0 or absent at the top. `parentId` names the track it sits under. */
  depth?: number;
  parentId?: string;
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
  /** How the clip stands now (F3). */
  status?: ClipStatus;
  /** When its launch lands and what follows it (F3). */
  launch?: ClipLaunch;
  /** The takes stacked under it (F3). */
  takes?: WorldClipTake[];
  /** Its place on the set's ruler, in the ruler's units, when the material has one (F3: the Arrangement lays clips by it).
   * On a set with a ruler a clip with no `at` has no place on it. No `end` is a point: a running clip's open edge is its
   * track's needle, and a waiting clip with no end has no length at all. */
  at?: {start: number; end?: number};
  /** What its owner discloses is absent about this clip (its state, its length), in the owner's own words. The Session
   * shows it where the clip stands. */
  note?: string;
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
  /** The rows of the Session grid — Live's scenes, the DLW's stops — in order; and, without a ruler, the Arrangement's
   * blocks laid end to end. */
  columns: WorldTrackColumn[];
  /** The Arrangement's ruler, when the material has absolute time: its unit and how to label a point on it. It starts at 0.
   * With a ruler the Arrangement lays only clips that have an `at`. */
  ruler?: {
    unit: string;
    label?: (at: number) => string;
    /** A fixed window: the ruler spans 0 to `end` whatever the clips hold, and a point past it stands at its edge (the run
     * viewer's window). Absent, the ruler spans what its clips and needles hold. */
    end?: number;
    /** Where now stands on the ruler. A now line is drawn there, and a stalled needle's age counts up to it. Absent: no now
     * line and no age. */
    now?: number;
    /** How a length on the ruler reads ("3m 20s"), for a stalled needle's age. Absent: the number and the unit. */
    duration?: (span: number) => string;
  };
  /** The owner operations the shared views may call (F3). */
  actions?: WorldTrackActions;
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
