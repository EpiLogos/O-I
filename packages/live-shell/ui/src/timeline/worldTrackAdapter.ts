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
// R3 (manual §16.6, §16.8; lock §0.3 item 3): every track's mixer row (`mixer` + `WorldTrack.mix`, written through
// `actions.mixer`), the Main track (`main` + a track flagged `main`, Stop All, Back to Arrangement), and the lanes under the
// tracks in Arrangement view (`lanes`: automation, take lanes with the comp, a session's event lanes). Live 12's model is the
// reference: Work/reverse-engineering/ableton-live-12.0.25/ui/DLW-CLIP-VIEW-MAPPING.md §1.1, CLIP-VIEW-EVIDENCE.md cap 35–45.
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

/** How a clip stands right now (manual §16.6 Session view: Waiting, Running, Stopped, Recording, Stalled, Done). Disclosed by the
 * family from its owner's reading; absent = not disclosed. Stopped is ready, in full colour; Done is dimmed and settled. */
export type ClipStatus = 'waiting' | 'running' | 'stopped' | 'recording' | 'stalled' | 'done';

/** Live's mixer controls, as every track's row carries them (manual §16.6 "The track": Activator, Solo, Arm, Monitor, Input and
 * output). What each means is the mode's (§17.1–§21.1). */
export type MixerControlId = 'activator' | 'solo' | 'arm' | 'monitor' | 'input' | 'output';
/** Live's Monitor: In, Auto or Off. */
export type MonitorSetting = 'in' | 'auto' | 'off';
/** One mixer control as this mode has it: what it does here (the mode's own table), and — when no owner op writes it — why it
 * cannot be pressed, in the owner's terms. A control the mode has none of ("None.") is absent from the set's `mixer`. */
export interface WorldMixerControl {
  meaning: string;
  /** The route is the mode's own, not a setting (an output that is always the Main track's material; a way in that is the head of the chain): drawn as words,
   * never pressed and never read as an owner's value. */
  route?: string;
  /** No owner op writes it: "no owner operation carries it yet — missing op: … (Owner)". Absent when `actions.mixer` writes it. */
  disabled?: string;
  /** The grain the owner's op takes when it is coarser than one track (the shell's one write arm): said on every track's control. */
  grain?: string;
}
export type WorldMixer = Partial<Record<MixerControlId, WorldMixerControl>>;
/** A track's mixer readings, as its owner reports them. A control the owner reports nothing for is absent: the row draws it
 * unread, never filled in. */
export interface WorldTrackMix {
  activator?: boolean;
  solo?: boolean;
  arm?: boolean;
  monitor?: MonitorSetting;
  input?: string;
  output?: string;
}

/** The Main track (manual §16.6: "The Main track sits at the end, where Live keeps it. It carries each row's launch button, Stop
 * All, and Back to Arrangement … Its own chain holds what works on the whole"). Its rows' launchers are the set's `columns`; a track
 * of the set flagged `main` is the material it carries as its own (a day that every track sends its work to). */
export interface WorldMainTrack {
  /** What the Main track is in this mode, in the mode's words ("Main", or the day it is). */
  name: string;
  /** Its own chain, by device name in order — what works on the whole; the Device side shows it when the Main track is selected. */
  chain: readonly string[];
  /** What plays differs from the ruler, as the owner reports it: Back to Arrangement lights. Absent: no play state is reported. */
  differs?: boolean;
}

/** The lanes under a track in Arrangement view (manual §16.6: automation, take and event lanes). */
export type TrackLaneKind = 'takes' | 'automation' | 'events';
/** An automation lane: one parameter that moves, naming its device and its parameter. */
export interface WorldAutomationLane {
  id: string;
  trackId: string;
  device: string;
  parameter: string;
  /** Its breakpoints, value 0–1 of `range`: in the ruler's units, or — with `clipId` — in that clip's own time from its start. */
  points: readonly {at: number; value: number}[];
  clipId?: string;
  /** The value's range, as the owner gives it. */
  range?: {min: number; max: number};
  /** What moves it, when it is modulated (§14: nothing moves without a visible cause). */
  modulatedBy?: string;
  /** Held off its lane by hand, as the owner reports: Re-enable gives it back (`actions.reenable`). */
  overridden?: boolean;
}
/** A take lane: one take, laid on the ruler as Live's take lanes are. */
export interface WorldTakeLane {
  id: string;
  trackId: string;
  name: string;
  /** The take's stretches on the ruler, each with its owner's label. */
  spans: readonly {start: number; end: number; label: string}[];
  /** This take stands, as the owner reports it. */
  standing?: boolean;
}
/** A stretch of a track's main lane and the take it came from (Live: "the main lane shows which take each stretch came from"). */
export interface WorldCompStretch {
  trackId: string;
  takeId: string;
  start: number;
  end: number;
}
/** An event lane (an agent session's): one kind of a session's events, in the owner's word for the kind. */
export interface WorldEventLane {
  id: string;
  trackId: string;
  kind: string;
  name: string;
  events: readonly {id: string; at: number; label: string; detail?: string; ref?: string}[];
}
export interface WorldTrackLanes {
  automation?: WorldAutomationLane[];
  takes?: WorldTakeLane[];
  comp?: WorldCompStretch[];
  events?: WorldEventLane[];
  /** Why a kind of lane has nothing under this mode's tracks, in the owner's terms (said beside the Lanes setting). */
  absent?: Partial<Record<TrackLaneKind, string>>;
  /** How many parameters are held off their automation by hand, as the owner counts them (Re-enable lights while any are). */
  held?: number;
}
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
  /** `grain`, when given, is this stop's own (null: it acts on the one track pressed), said instead of the set's. */
  stopTrack?: {op: string; run(trackId: string): unknown; grain?: string | null};
  record?: {op: string; run(clipId: string): unknown};
  /** Restart a stalled lane from its last good step (manual §6: "its track lights a retry"). The Session shows a retry on
   * each track only where the set carries this, and lights it while the lane has stalled. */
  retry?: {op: string; run(trackId: string): unknown};
  /** Seat what is dropped on the empty track (manual §10.3: "To seat an agent, drag it onto an empty track"): the drag type
   * the set accepts, and the owner op that seats it. The dropped payload reaches `run` as the drag carried it. */
  seat?: {op: string; accepts: string; run(payload: string): unknown};
  /** Take a track out of the set (Live: select the track, Delete): the inverse of `seat`. What the track holds stays where its owner
   * keeps it; only the set no longer holds the track. */
  removeTrack?: {op: string; run(trackId: string): unknown};
  /** The grain the owner's ops take when it is coarser than the controls look (e.g. "whole harness": a Stop on one track
   * stops the harness). The Session says it on every control it applies to. */
  grain?: string;
  /** Stand a walk's stop (T-TIMELINE-WALKS leg 3: a stop focuses its occasion, or the epoch of the reading its walk belongs
   * to): the Arrangement's walk rails press it. `walkId` and the stop's index in that walk name the stop. Absent, a rail's stops are read, not pressed. */
  focusStop?: {op: string; run(walkId: string, stopIndex: number): unknown};
  /** The mixer row's writes, each through its owner (manual §16.6). A control absent here stands disabled with the reason the
   * set's `mixer` gives. */
  mixer?: {
    activator?: {op: string; run(trackId: string, on: boolean): unknown};
    solo?: {op: string; run(trackId: string, on: boolean): unknown};
    arm?: {op: string; run(trackId: string, on: boolean): unknown};
    monitor?: {op: string; run(trackId: string, setting: MonitorSetting): unknown};
  };
  /** Launch the track itself (a workspace: "Launch the workspace and that context comes back"). */
  launchTrack?: {op: string; run(trackId: string): unknown};
  /** Record into an armed track's empty slot (Live: an armed track's empty slots are record buttons). */
  recordSlot?: {op: string; run(trackId: string, columnId: string): unknown};
  /** The Main track's Stop All, and its Back to Arrangement (play the ruler again). */
  stopAll?: {op: string; run(): unknown};
  backToArrangement?: {op: string; run(): unknown};
  /** Copy a stretch of a take into the main lane (Live: select a range of a take lane and press Return): the comp. */
  comp?: {op: string; run(trackId: string, takeId: string, range: {start: number; end: number}): unknown};
  /** Audition a take from its lane. */
  audition?: {op: string; run(trackId: string, takeId: string): unknown};
  /** Give overridden parameters back to their lanes (Re-enable); a lane's id when one lane is meant. */
  reenable?: {op: string; run(laneId?: string): unknown};
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
  /** No owner op of the set reaches this track: a track merged in from another reading (the time spine's cron firings beside a
   * mode's own tracks). The shared views offer none of the set's actions on it. Absent: the set's actions apply. */
  readOnly?: boolean;
  /** Its mixer readings (manual §16.6), as its owner reports them. */
  mix?: WorldTrackMix;
  /** This track is the Main track's own material (the day the tracks send their work to). The views draw it at the end, as Live keeps Main. */
  main?: true;
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
    /** Where a civil instant (unix ms) stands on this ruler, when the ruler lays civil time; undefined for an instant it has no
     * place for (a day it does not cover). Absent: the ruler places no instant, and material known only by its instant (a
     * cron firing) is left to the Session. */
    instant?: (unixMs: number) => number | undefined;
  };
  /** The occasion the time spine stands in (WORLD-SHELL-DESIGN §15.5: a retained basis and, separately, its current
   * admission), as a reading for the views. Absent: no occasion is stood in. */
  occasion?: WorldTrackOccasion;
  /** The owner operations the shared views may call (F3). */
  actions?: WorldTrackActions;
  tracks: WorldTrack[];
  clips: WorldTrackClip[];
  transport?: {takes: WorldTrackTake[]};
  layers?: WorldTrackLayer[];
  sections?: WorldTrackSection[];
  walks?: WorldWalk[];
  /** The mode's mixer row: which of Live's controls it has and what each does here (§17.1–§21.1). Absent: no row is drawn. */
  mixer?: WorldMixer;
  /** The Main track: its name, its chain, and whether what plays differs from the ruler. */
  main?: WorldMainTrack;
  /** The lanes under the tracks in Arrangement view. */
  lanes?: WorldTrackLanes;
}

/** The retained occasion as the shared views read it: its basis words exactly as first read, where it stands on this set's
 * ruler (the clip that draws its event), and its current admission — a separate qualification that is null until a fresh
 * reading has qualified it. Filled from the spine by the World cut's registration; a view only draws it. */
export interface WorldTrackOccasion {
  ref: string;
  /** The basis's summary, else its ref. */
  label: string;
  /** The year of the basis's instant, when it has one (for the readout). */
  year?: number;
  /** The clip of this set that stands the occasion's event, and its place on the ruler; absent when none here does. */
  clipId?: string;
  at?: number;
  admission: {admitted: boolean; disclosure: string} | null;
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
