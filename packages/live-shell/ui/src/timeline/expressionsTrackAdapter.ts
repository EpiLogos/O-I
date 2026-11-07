// Expressions track adapter: projects one Expressions work reading into the
// neutral World track shape the Timeline renders (DEVICE-SEMANTICS-LOCK §9.1–9.3).
//
// Projection:
// - tracks: each Expression is a track with two lanes, a visual side and an audio
//   side (`expression:<id>:visual`, `expression:<id>:audio`), grouped under
//   `expression:<id>`.
// - clips: each scene is a clip on both of its Expression's lanes, with the same
//   span, so the two sides stay locked. Spans are column-local (the contract's
//   law): a scene starts at 0 in its stop's column, and an Expression's scenes
//   that share a column lie end to end by duration inside it. Order across
//   stops is the columns' order (lead's ruling, 13 Oct 2026).
// - columns: the stops (Live's scene rows) when stops are given. A scene no stop
//   names sits in a trailing `unstopped` column. Without stops, one column per
//   scene position.
// - transport.takes: each scene's captured takes, targeting the scene.
// - lanes.takes: the Torus takes that lie under a scene (O-I #855; manual §21.1, "Record a part and each pass lies as a take lane under
//   its track"), each its take lane under its Expression's audio side, from the second of the scene it lies at for its length: where
//   the scene lies on the ruler (worldTrackAdapter.ts rowOffsets) plus the take's own seconds in it. As Live's take lanes, each shows its
//   Activator and Solo and its Audition, lit where it sounds in place of the main lane (round 25; DLW build ruling 2026-11-05: "give the
//   Torus take lanes Audition and Comp, and show their Activator and Solo, as Live's take lanes have them").
// - lanes.comp: each stretch the scene's main lane comps from a take lane, under the take it came from, where the scene lies on the ruler;
//   a stretch chosen on a take lane and Return comps it, in the samples of the scene's transport (round 25).
//
// Takes are transport material: never a clock, never a track.
// The inside of one scene is projected by expressionsSequenceEditor.ts.
//
// R3 (manual §20.1 "The mixer row", §16.6, §16.8): each Expression's mixer row (Activator silences its sound, Solo hears only it,
// Arm arms it for a take; its sound goes to the Main track, its picture to the stage); each scene's state as the owner's playback
// says it (the scene that plays runs, the others stand ready); the Main track's Stop All (pause) and Back to Arrangement (play the
// saved sequence — lit while a scene plays outside it); and the presented scene's automation lanes, each naming its device and
// parameter: the recorded moves (an armed take records the studio: the scene's property tracks) and the lanes that move a
// parameter by a generator, which name what moves them. Re-enable lights while the owner counts values held by hand.
// W4: the playing scene carries its progress (its elapsed seconds over the length it plays) and the set its loop (the saved sequence
// returns to its start), each only as the reading gives it; nothing is estimated.
//
// Pure TypeScript. No React, no family names.

import type {
  ClipStatus,
  WorldAutomationLane,
  WorldMixer,
  WorldTrack,
  WorldTrackActions,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackSet,
  WorldTrackTake,
  WorldTakeLane,
  WorldCompStretch,
  TrackLaneKind,
} from './worldTrackAdapter';
import {rowOffsets} from './worldTrackAdapter';

export interface ExpressionsWorkReading {
  expressions: {
    id: string;
    name: string;
    /** The Expression's description (manual §20.1 The track: "Description — A note about the Expression for a reader. An empty note is a
     * real value"), as its owner reads it (the scenes inventory's `description`). Absent: not read. */
    description?: string;
    /** The Expression's colour (DLW.md:8911 "The track head shows the Expression's title and colour"; O-I #747 round 886), as its
     * document keeps it (the scenes inventory's `colour`, #RRGGBB): its track's and its clips'. Absent: it keeps none. */
    colour?: string;
    /** XS04 (rounds 888–889): an Expression held over the presented one's field, not the presented one: its track takes its own mixer row
     * (`mix`, as the field reports it: its Activator, Solo and Volume as linear gain) and none of the presented one's edits. */
    held?: {mix: {active: boolean; solo?: boolean; level?: number}};
    scenes: {id: string; name: string; duration: number; takes?: {id: string; name: string}[];
      /** How the scene stands, from the owner's playback reading (R3). */
      status?: ClipStatus; note?: string;
      /** How far the playing scene has got, from the owner's playback reading: its elapsed seconds and the length it plays (W4). */
      progress?: {elapsed: number; expected: number};
      /** The Torus takes that lie under the scene, as its performance keeps them (expressions-boundary scenes.ts sceneTorusTakes): each by
       * its lane, from its second of the scene for its length in seconds, its lane's Activator and Solo, and the sample of the scene's
       * transport it lies from (`atSample`, the transport running at `rate`). */
      torusTakes?: ExpressionsTorusTake[];
      /** The stretches the scene's main lane comps from its take lanes (scenes.ts sceneTorusComp), each in the scene's own seconds. */
      torusComp?: {lane: string; start: number; end: number}[]}[];
  }[];
  // Live's scene rows: each stop stands one or more scenes at once.
  stops?: {id: string; name: string; scenes: {expressionId: string; sceneId: string}[]}[];
  /** The presented scene's automation lanes (R3), each in the scene's own seconds. */
  automation?: {expressionId: string; sceneId: string; lanes: {id: string; device: string; parameter: string; points: {at: number; value: number}[];
    range?: {min: number; max: number}; modulatedBy?: string; /** a recorded lane drawn on its range (XT10, round 889) */ drawable?: boolean}[]}[];
  /** Values held off their automation by hand, as the owner counts them. */
  held?: number;
  /** A scene plays outside the saved sequence (Back to Arrangement lights); absent: no playback is read. */
  differs?: boolean;
  /** The saved sequence returns to its first scene at its end (the Journey's loop flag, as the owner reads it): the whole sequence the
   * Arrangement lays is the loop. Absent or false: no loop. */
  loop?: boolean;
  /** XT15 (round 889): the loop region the Expression keeps, in seconds of its working clock, which the Arrangement lays from 0: its
   * frame repeats the scenes between its in and out points as the saved sequence plays. It stands over the whole sequence's loop. */
  loopRegion?: {from: number; to: number};
  /** The owner's scene transport, when the presented composition gives one. */
  controls?: ExpressionsControls;
}

/** A Torus take that lies under a scene, as the adapter reads it (O-I #855): its lane and title, from its second of the scene for its
 * seconds, its lane's Activator and Solo, and the sample of the scene's transport it lies from, the transport running at `rate`. */
export interface ExpressionsTorusTake {lane: string; name: string; at: number; seconds: number; enabled: boolean; solo: boolean; atSample: string; rate: number}

/** A cut of Arrangement view as the Expression's owner takes it (sceneEdits.ts NativeSceneCutIntent): the scene moved before `to_ref`
 * (Insert; null: last) or in its place (Overwrite); an edge trimmed by `seconds`; the seam after the scene rolled by `seconds`; the scene's
 * content slipped, or the scene slid between its neighbours, by `seconds`; the scene split at its own second `at`. */
export type ExpressionsSceneCut =
  | {operation: 'move'; scene_ref: string; mode: 'insert' | 'overwrite'; to_ref: string | null}
  | {operation: 'trim'; scene_ref: string; edge: 'start' | 'end'; seconds: number}
  | {operation: 'roll' | 'slip' | 'slide'; scene_ref: string; seconds: number}
  | {operation: 'split'; scene_ref: string; at: number};

/** The owner ops the views press, each answering in the shell's receipt words. */
export interface ExpressionsControls {
  /** The Expression's own sound (native/frameSound.ts): its Activator and its Solo as its document keeps them (null while no mixer is
   * read; Solo since round 886, DLW build ruling 2026-11-06), the frame's mute here (what is heard, never the Activator), and the writes of
   * each. */
  sound?: {op: string; active: boolean | null; soloOn: boolean | null; muted?: boolean | null; activate(expressionId: string, on: boolean): unknown; solo(expressionId: string, on: boolean): unknown;
    /** XS15: the Expression's level and the Main level as its document keeps them (linear gain, 0 to 2), and their writes. */
    level?: number | null; main?: number | null; setLevel?(expressionId: string, gain: number): unknown; setMain?(gain: number): unknown};
  /** The transport's Studio arm (native/frameSound.ts publishStudioArm): armed, Play records a take. One arm for the open Expression. */
  arm?: {op: string; on: boolean; set(on: boolean): unknown};
  playScene?: {op: string; run(expressionId: string, sceneId: string): unknown};
  /** XS04 slice 2 (round 889): a held Expression's own mixer — its Activator, Solo and Volume (linear gain) — written through the field's
   * `layer` act `mix`, each answering in the shell's receipt words. */
  layerMix?: {op: string; activate(expressionId: string, on: boolean): unknown; solo(expressionId: string, on: boolean): unknown; setLevel(expressionId: string, gain: number): unknown};
  /** The track's Stop: the scene its Expression plays stops (XS04: a held Expression's over the field, the presented one's on its transport). */
  stopExpression?: {op: string; run(expressionId: string): unknown};
  /** The presented composition's scene edits (the object menu's acts): rename, duplicate, remove, add, the Expression's title — and the
   * Arrangement's cuts (O-I #747; packages/expressions-boundary sceneEdits.ts NativeSceneCutIntent), each in the scene's own seconds. */
  sceneEdit?: {op: string; run(intent: {operation: 'duplicate' | 'remove'; scene_ref: string} | {operation: 'add'} | {operation: 'expression-title'; title: string}
    | {operation: 'expression-description'; description: string} | {operation: 'colour'; colour: string | null} | ExpressionsSceneCut): unknown};
  stopAll?: {op: string; run(): unknown};
  playSaved?: {op: string; run(): unknown};
  reenable?: {op: string; run(): unknown};
  /** XT10 (round 889): a recorded lane of the presented scene drawn over, in its parameter's own values and the scene's seconds. */
  drawLane?: {op: string; run(sceneId: string, trackId: string, points: readonly {time: number; value: number}[]): unknown};
  /** The Torus take lanes of the presented Scene (O-I #855 round 25), each act on the Scene named and refused in words for another:
   * Audition, a lane's take in place of the row's main lane (`scene` the presented Scene, `lane` the lane the frame reports auditioned on
   * it; null hears the main lane again), the comp of a stretch of a lane into the main lane in the samples of the Scene's transport, and a
   * lane's Activator and Solo. */
  takes?: {
    audition: {op: string; scene: string | null; lane: string | null; run(sceneId: string, laneRef: string | null): unknown};
    comp: {op: string; run(sceneId: string, stretch: {lane_ref: string; start_sample: string; end_sample: string}): unknown
      /** The comp taken back (XT08, round 888): the Scene's performance's `uncomp-take`. */
      back?(sceneId: string, stretch: {lane_ref: string; start_sample: string; end_sample: string}): unknown};
    lane: {op: string; run(sceneId: string, laneRef: string, setting: {enabled: boolean; solo: boolean}): unknown};
  };
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** Expressions' mixer row (manual §20.1), each control's meaning in the manual's words. Monitor is none. */
export const EXPRESSIONS_MIXER: WorldMixer = {
  activator: {meaning: 'The Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed.',
    disabled: missing('Activator', 'the Expression\'s mixer kept in its document — the scenes reading disclosing `mix` and the scene edit {operation: "mix", set: {active}}', 'Expressions')},
  solo: {meaning: 'Lets you hear only this Expression\'s sound',
    disabled: missing('Solo', 'the Expression\'s mixer disclosed by the scenes reading (`mix`), and the frame\'s stage command {command: "sound", silenced}', 'Expressions')},
  arm: {meaning: 'Arms the Expression for a take: with Arm on, Play records the studio as a take',
    disabled: missing('Arm', 'the transport\'s Studio arm published to the shell (shell.setStudioArm(on) with its flag readable — today it is the transport hook\'s own state, shell/transports/useExpressionsTransport.tsx:96)', 'shell')},
  output: {meaning: 'Its sound goes to the Main track; its picture goes to the stage', route: 'Main · stage'},
  // XS15 (DLW.md §20.1 The mixer row; DLW build ruling 2026-11-06): the Expression's level, and on the Main track every Expression's.
  volume: {meaning: 'The level of the Expression\'s sound', range: {min: -70, max: 6, unit: 'dB'},
    disabled: missing('Volume', 'the Expression\'s mixer kept in its document — the scenes reading disclosing `mix` and the scene edit {operation: "mix", set: {level | main}}', 'Expressions')},
};
/** The Expressions Main track (§20.1 The Main track: its mixer row "sets the level of every Expression's sound together"). */
export const EXPRESSIONS_MAIN_TRACK_ID = 'expressions:main';
/** Linear gain to the mixer's dB, to a tenth (−70 dB is silence), and back. */
const gainDb = (gain: number) => Math.round(20 * Math.log10(Math.max(gain, 10 ** (-70 / 20))) * 10) / 10 || 0;
const dbGain = (db: number) => db <= -70 ? 0 : Math.min(10 ** (6 / 20), 10 ** (db / 20));

/** The mixer row where the Expression's mixer stands behind it: the Activator writes its document, Solo the frame's hearing. */
const EXPRESSIONS_MIXER_SOUNDED: WorldMixer = {...EXPRESSIONS_MIXER,
  activator: {meaning: EXPRESSIONS_MIXER.activator!.meaning}, solo: {meaning: EXPRESSIONS_MIXER.solo!.meaning},
  volume: {meaning: EXPRESSIONS_MIXER.volume!.meaning, range: EXPRESSIONS_MIXER.volume!.range}}

/** Why the lanes Expressions' owners do not give are absent, in their terms. */
export const EXPRESSIONS_LANES_ABSENT = {
  takes: missing('Captured takes as take lanes', 'the scene\'s takes kept side by side — a take records the studio into the scene\'s property tracks, replacing the last or appending a section (stage command take, mode replace | append), so no second take is kept to choose from; the Expressions document needs Scene.takes[] {id, name, propertyTracks} and an editor change {kind: "take-comp", take_id, range} for the comp that chooses the capture that stands', 'Expressions'),
  events: 'Event lanes belong to agent sessions: a session\'s messages, files, terminal and pages read.',
} as const

export const EXPRESSIONS_TRACK_ADAPTER_ID = 'expressions-track-adapter';

const expressionGroupId = (expressionId: string): string => `expression:${expressionId}`;
const visualLaneId = (expressionId: string): string => `expression:${expressionId}:visual`;
const audioLaneId = (expressionId: string): string => `expression:${expressionId}:audio`;
const sceneKey = (expressionId: string, sceneId: string): string => `scene:${expressionId}:${sceneId}`;
const stopColumnId = (stopId: string): string => `stop:${stopId}`;
const positionColumnId = (index: number): string => `position:${index}`;
const UNSTOPPED_COLUMN_ID = 'unstopped';

function requireDuration(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number`);
  }
  return value;
}

// Which column each scene sits in. A scene takes the first stop that names it.
function placeScenes(reading: ExpressionsWorkReading): {columns: WorldTrackColumn[]; columnOf: Map<string, string>} {
  const columns: WorldTrackColumn[] = [];
  const columnOf = new Map<string, string>();

  if (reading.stops === undefined) {
    const positions = Math.max(0, ...reading.expressions.map((expression) => expression.scenes.length));
    for (let index = 0; index < positions; index += 1) {
      columns.push({id: positionColumnId(index), name: `Scene ${index + 1}`});
    }
    for (const expression of reading.expressions) {
      expression.scenes.forEach((scene, index) => {
        columnOf.set(sceneKey(expression.id, scene.id), positionColumnId(index));
      });
    }
    return {columns, columnOf};
  }

  const known = new Set(reading.expressions.flatMap((expression) =>
    expression.scenes.map((scene) => sceneKey(expression.id, scene.id))));
  for (const stop of reading.stops) {
    columns.push({id: stopColumnId(stop.id), name: stop.name});
    for (const ref of stop.scenes) {
      const key = sceneKey(ref.expressionId, ref.sceneId);
      if (!known.has(key)) {
        throw new Error(`Stop ${stop.id} names scene ${ref.sceneId} of ${ref.expressionId}, which is not in the reading`);
      }
      if (!columnOf.has(key)) columnOf.set(key, stopColumnId(stop.id));
    }
  }
  const unstopped = [...known].filter((key) => !columnOf.has(key));
  if (unstopped.length > 0) {
    columns.push({id: UNSTOPPED_COLUMN_ID, name: 'Unstopped'});
    for (const key of unstopped) columnOf.set(key, UNSTOPPED_COLUMN_ID);
  }
  return {columns, columnOf};
}

export function projectExpressionsWork(reading: ExpressionsWorkReading): WorldTrackSet {
  const {columns, columnOf} = placeScenes(reading);

  const tracks: WorldTrack[] = [];
  const clips: WorldTrackClip[] = [];
  const takes: WorldTrackTake[] = [];
  const laid: {key: string; sceneId: string; trackId: string; columnId: string; start: number; takes: readonly ExpressionsTorusTake[];
    comp: NonNullable<ExpressionsWorkReading['expressions'][number]['scenes'][number]['torusComp']>}[] = [];

  for (const expression of reading.expressions) {
    const groupId = expressionGroupId(expression.id);
    // The track head carries the Expression's description as its info text (manual §20.1 The track; Live's Edit Info Text on a track).
    const info = expression.description ? {info: expression.description} : {};
    // Both lanes wear the Expression's colour where its document keeps one (round 886), and its scenes' cells with them.
    const colour = expression.colour ? {color: expression.colour} : {};
    tracks.push(
      {id: visualLaneId(expression.id), name: `${expression.name}: visual`, kind: 'expression-visual', groupId, lane: 'visual', ...colour, ...info},
      {id: audioLaneId(expression.id), name: `${expression.name}: audio`, kind: 'expression-audio', groupId, lane: 'audio', ...colour, ...info},
    );

    // column-local cursors: one per column this Expression's scenes occupy
    const cursor = new Map<string, number>();
    expression.scenes.forEach((scene) => {
      const duration = requireDuration(scene.duration, `Scene ${scene.id} duration`);
      const key = sceneKey(expression.id, scene.id);
      const columnId = columnOf.get(key);
      if (columnId === undefined) throw new Error(`Scene ${scene.id} of ${expression.id} has no column`);
      const start = cursor.get(columnId) ?? 0;
      const end = start + duration;
      const state = {...(scene.status ? {status: scene.status} : {}), ...(scene.note ? {note: scene.note} : {}),
        ...(scene.progress ? {progress: scene.progress} : {})};
      clips.push(
        {id: `${key}:visual`, trackId: visualLaneId(expression.id), columnId, label: scene.name, span: {start, end}, ...state},
        {id: `${key}:audio`, trackId: audioLaneId(expression.id), columnId, label: scene.name, span: {start, end}, ...state},
      );
      for (const take of scene.takes ?? []) {
        takes.push({id: `${key}:${take.id}`, target: key, name: take.name});
      }
      if (scene.torusTakes?.length) laid.push({key, sceneId: scene.id, trackId: audioLaneId(expression.id), columnId, start, takes: scene.torusTakes, comp: scene.torusComp ?? []});
      cursor.set(columnId, end);
    });
  }

  // Each Torus take on its own take lane, where its scene lies on the ruler and its seconds into the scene, with its lane's Activator and
  // Solo, and lit where the frame auditions it in place of the main lane (round 25); each stretch the main lane comps, under its take.
  const {offsets} = rowOffsets(columns, clips);
  const audition = reading.controls?.takes?.audition;
  const placed: PlacedTake[] = laid.flatMap(({key, sceneId, trackId, columnId, start, takes: own}) => own.map((take) => {
    requireDuration(take.at, `Take ${take.lane} start`);
    return {id: `${key}#${take.lane}`, sceneId, trackId, take, scene: (offsets.get(columnId) ?? 0) + start};
  }));
  const takeLanes: WorldTakeLane[] = placed.map(({id, sceneId, trackId, take, scene}) => {
    const from = scene + take.at;
    return {id, trackId, name: take.name,
      spans: [{start: from, end: from + requireDuration(take.seconds, `Take ${take.lane} length`), label: take.name}],
      enabled: take.enabled, solo: take.solo, ...(audition ? {auditioned: audition.scene === sceneId && audition.lane === take.lane} : {})};
  });
  const comp: WorldCompStretch[] = laid.flatMap(({key, trackId, columnId, start, comp: own}) => own.map((stretch) => {
    const scene = (offsets.get(columnId) ?? 0) + start;
    return {trackId, takeId: `${key}#${stretch.lane}`, start: scene + requireDuration(stretch.start, `Comp of ${stretch.lane} start`),
      end: scene + requireDuration(stretch.end, `Comp of ${stretch.lane} end`)};
  }));
  // Where Torus takes lie, the take lanes are not absent (the Studio's own captured takes still have no lane: EXPRESSIONS_LANES_ABSENT.takes).
  const absentTakes: Partial<Record<TrackLaneKind, string>> = {...EXPRESSIONS_LANES_ABSENT};
  if (takeLanes.length) delete absentTakes.takes;
  const automation: WorldAutomationLane[] = (reading.automation ?? []).flatMap(scene => scene.lanes.map(lane => ({
    id: `${sceneKey(scene.expressionId, scene.sceneId)}#lane/${lane.id}`, trackId: visualLaneId(scene.expressionId),
    clipId: `${sceneKey(scene.expressionId, scene.sceneId)}:visual`, device: lane.device, parameter: lane.parameter, points: lane.points,
    ...(lane.range ? {range: lane.range} : {}), ...(lane.modulatedBy ? {modulatedBy: lane.modulatedBy} : {}),
    ...(lane.drawable && lane.range && !lane.modulatedBy && reading.controls?.drawLane ? {drawable: true} : {}),
  })));
  // The Expression's own sound: each of its lanes carries the Activator and the Solo its document keeps (Solo since round 886). The frame's
  // mute here is what is heard, not whether the Expression plays: it never reads as the Activator (round 885).
  const sound = reading.controls?.sound
  // XS04 slice 2 (round 889, found walking slice 1: a held Expression's track wore the presented one's mixer): a held Expression's lanes
  // carry its own mixer, as the field reports it.
  const heldOf = new Map(reading.expressions.flatMap(expression => expression.held ? [[visualLaneId(expression.id), expression.held], [audioLaneId(expression.id), expression.held]] as const : []))
  for (const track of tracks) {
    const held = heldOf.get(track.id)
    if (held) track.mix = {activator: held.mix.active, ...(typeof held.mix.solo === 'boolean' ? {solo: held.mix.solo} : {}),
      ...(typeof held.mix.level === 'number' ? {volume: gainDb(held.mix.level)} : {})}
    else if (sound) track.mix = {...(sound.active !== null ? {activator: sound.active} : {}), solo: sound.soloOn === true,
      ...(typeof sound.level === 'number' ? {volume: gainDb(sound.level)} : {})}
  }
  const arm = reading.controls?.arm
  if (arm) for (const track of tracks) if (!heldOf.has(track.id)) track.mix = {...track.mix, arm: arm.on}
  // XS15: the Main track, whose Volume sets the level of every Expression's sound together, where the frame's sound takes a Main level.
  const levels = !!(sound?.setLevel && sound.setMain)
  if (sound && levels) tracks.push({id: EXPRESSIONS_MAIN_TRACK_ID, name: 'Main', kind: 'expression-main', main: true,
    mix: typeof sound.main === 'number' ? {volume: gainDb(sound.main)} : {}})
  const set: WorldTrackSet = {columns, tracks, clips, transport: {takes},
    mixer: {...(sound ? EXPRESSIONS_MIXER_SOUNDED : EXPRESSIONS_MIXER), ...(sound && !levels ? {volume: EXPRESSIONS_MIXER.volume} : {}), ...(arm ? {arm: {meaning: EXPRESSIONS_MIXER.arm!.meaning, grain: 'the Studio arm: one arm for the open Expression'}} : {})},
    main: {name: 'Main', chain: [], ...(reading.differs !== undefined ? {differs: reading.differs} : {})},
    lanes: {automation, ...(takeLanes.length ? {takes: takeLanes} : {}), ...(comp.length ? {comp} : {}),
      absent: {...absentTakes, ...(reading.automation ? {} : {automation: 'The presented scene\'s reading is not published to this pane, so its lanes are unread.'})},
      ...(reading.held !== undefined ? {held: reading.held} : {})}};
  // The saved sequence loops whole: from its start to the end of what the Arrangement lays (worldTrackAdapter.ts `loop` with no end).
  if (reading.loopRegion) set.loop = {start: reading.loopRegion.from, end: reading.loopRegion.to};
  else if (reading.loop === true) set.loop = {start: 0};
  // Where each clip lies on the ruler (its row's offset and its span, as the Arrangement lays it: ArrangementRuler.tsx placeClips), for the
  // cuts, which the ruler hands over in its own units.
  const ruler = new Map(clips.map((clip) => {
    const start = (offsets.get(clip.columnId) ?? 0) + (clip.span?.start ?? 0);
    return [clip.id, {start, end: (offsets.get(clip.columnId) ?? 0) + (clip.span?.end ?? start)}] as const;
  }));
  // The playhead (O-I #747 round 883, DLW build ruling 2026-11-06): the playing scene's position, where it lies on the ruler plus the
  // seconds its owner reports it has played (modeTracks.ts statusOf: scene_elapsed_seconds), held within the scene. No reported progress,
  // no playhead: nothing is guessed from a clock.
  const playing = clips.find(clip => clip.status === 'running' && clip.progress && Number.isFinite(clip.progress.elapsed) && clip.id.endsWith(':visual'));
  const lies = playing ? ruler.get(playing.id) : undefined;
  if (playing?.progress && lies) set.playhead = lies.start + Math.min(Math.max(0, playing.progress.elapsed), lies.end - lies.start);
  const actions = expressionsActions(reading, clips, placed, ruler);
  if (actions) set.actions = actions;
  return set;
}

/** A Torus take as it lies on the ruler: its take lane, its scene, the track it lies under, and where its scene begins on the ruler. */
interface PlacedTake {id: string; sceneId: string; trackId: string; take: ExpressionsTorusTake; scene: number}

/** The owner's scene transport over this set's own ids: a clip that is no scene of the set is refused before the owner is called. */
function expressionsActions(reading: ExpressionsWorkReading, clips: readonly WorldTrackClip[], placed: readonly PlacedTake[] = [],
  ruler: ReadonlyMap<string, {start: number; end: number}> = new Map()): WorldTrackActions | undefined {
  const controls = reading.controls;
  if (!controls) return undefined;
  const sceneOf = new Map<string, {expressionId: string; sceneId: string}>();
  for (const expression of reading.expressions) for (const scene of expression.scenes) for (const side of ['visual', 'audio']) {
    sceneOf.set(`${sceneKey(expression.id, scene.id)}:${side}`, {expressionId: expression.id, sceneId: scene.id});
  }
  const actions: WorldTrackActions = {};
  const play = controls.playScene;
  // XS15: an Expression its Activator switched off launches none of its scenes ("Off, its scenes do not launch"), said in plain words.
  const nameOf = (expressionId: string) => reading.expressions.find(expression => expression.id === expressionId)?.name ?? 'This Expression';
  // The mixer read is the presented Expression's (the first); an Expression held over the field answers for its own Activator (XS04).
  const presented = reading.expressions[0]?.id ?? '';
  // XS04 (round 889, found walking slice 1): a held Expression is changed where it is presented, never through the presented one's edits.
  const heldOne = (expressionId: string) => reading.expressions.find(expression => expression.id === expressionId && expression.held) ?? null;
  const heldWords = (expressionId: string) => ({ok: false as const, error: `${nameOf(expressionId)} is held over the field: open it to change it.`});
  const heldClip = (clipId: string) => { const found = sceneOf.get(clipId); return found && heldOne(found.expressionId) ? heldWords(found.expressionId) : null };
  const off = (expressionId: string) => expressionId === presented && controls.sound?.active === false
    ? {ok: false, error: `${nameOf(expressionId)} is switched off: switch its Activator on to launch its scenes.`} : null;
  if (play && clips.length) actions.launch = {op: play.op, run: clipId => {
    const found = sceneOf.get(clipId);
    return found ? off(found.expressionId) ?? play.run(found.expressionId, found.sceneId) : {ok: false, error: `"${clipId}" is no scene of this Expression.`};
  }};
  // XS05, the Main track's row launchers (§20.1 The Main track; §16.6 Rules: "a row launches only what is in it"; O-I #747 round 883):
  // a row starts its scene on every Expression in it, each through that Expression's own scene launch, in the order they stand; the first
  // refusal is the row's answer, in the owner's words.
  if (play && clips.length) actions.launchStop = {op: `${play.op}, for each Expression's scene in the row`, run: async columnId => {
    const inRow = clips.filter(clip => clip.columnId === columnId && clip.id.endsWith(':visual')).map(clip => sceneOf.get(clip.id)!).filter(Boolean);
    if (!inRow.length) return {ok: false, error: 'This row holds no scene: a row launches only what is in it.'};
    const refused = inRow.map(scene => off(scene.expressionId)).find(Boolean);
    if (refused) return refused;
    for (const scene of inRow) {
      const reply = await play.run(scene.expressionId, scene.sceneId) as {ok?: boolean; error?: string} | undefined;
      if (reply && reply.ok === false) return reply;
    }
    return {ok: true, note: `The row plays: its scene on ${inRow.length} Expression${inRow.length === 1 ? '' : 's'}.`};
  }};
  if (controls.stopAll) actions.stopAll = controls.stopAll;
  const stopExpression = controls.stopExpression;
  if (stopExpression) actions.stopTrack = {op: stopExpression.op, grain: null,
    run: trackId => stopExpression.run(trackId.replace(/^expression:/, '').replace(/:(visual|audio)$/, ''))};
  const saved = controls.playSaved;
  if (saved) actions.backToArrangement = {op: saved.op, run: () => off(presented) ?? saved.run()};
  if (controls.reenable) actions.reenable = {op: controls.reenable.op, run: () => controls.reenable!.run()};
  // XT10 (round 889): a drawn lane's 0–1 heights on its parameter's range, in its scene's own seconds, through the presented composition.
  const drawLane = controls.drawLane
  if (drawLane && reading.automation?.some(scene => scene.lanes.some(lane => lane.drawable))) actions.drawLane = {op: drawLane.op, run: (laneId, points) => {
    for (const scene of reading.automation ?? []) for (const lane of scene.lanes) {
      if (`${sceneKey(scene.expressionId, scene.sceneId)}#lane/${lane.id}` !== laneId) continue
      if (!lane.drawable || !lane.range) return {ok: false, error: `${lane.device} / ${lane.parameter} moves by itself: it is not drawn.`}
      const {min, max} = lane.range
      return drawLane.run(scene.sceneId, lane.id, points.map(point => ({time: point.at, value: min + Math.min(1, Math.max(0, point.value)) * (max - min)})))
    }
    return {ok: false, error: 'That lane is not the presented scene\'s: open its scene to draw it.'}
  }}
  const sound = controls.sound
  if (sound) {
    const expressionOf = (trackId: string) => trackId.replace(/^expression:/, '').replace(/:(visual|audio)$/, '')
    const own = {ok: false, error: 'The Main track has no Activator or Solo of its own: each Expression has them on its own track.'}
    // XS04 slice 2 (round 889): a held Expression's mixer row is its own, written through the field; the presented one's its document's.
    const layerMix = controls.layerMix
    const held = (trackId: string) => heldOne(expressionOf(trackId)) ? expressionOf(trackId) : null
    const noLayerMix = (trackId: string) => ({ok: false, error: `${nameOf(expressionOf(trackId))}'s mixer is not reachable: no Expressions application holds it over the field.`})
    actions.mixer = {...actions.mixer, activator: {op: layerMix ? `${sound.op}; a held Expression's, ${layerMix.op}` : sound.op, run: (trackId, on) => {
      if (trackId === EXPRESSIONS_MAIN_TRACK_ID) return own
      const layer = held(trackId)
      return layer ? layerMix ? layerMix.activate(layer, on) : noLayerMix(trackId) : sound.activate(expressionOf(trackId), on)
    }},
      solo: {op: layerMix ? `${sound.op}; a held Expression's, ${layerMix.op}` : sound.op, run: (trackId, on) => {
        if (trackId === EXPRESSIONS_MAIN_TRACK_ID) return own
        const layer = held(trackId)
        return layer ? layerMix ? layerMix.solo(layer, on) : noLayerMix(trackId) : sound.solo(expressionOf(trackId), on)
      }}}
    const {setLevel, setMain} = sound
    if (setLevel && setMain) actions.mixer.volume = {op: `${sound.op} · level and Main${layerMix ? `; a held Expression's, ${layerMix.op}` : ''}`, run: (trackId, db) => {
      if (!Number.isFinite(db)) return {ok: false, error: 'The volume takes a level in dB.'}
      if (trackId === EXPRESSIONS_MAIN_TRACK_ID) return setMain(dbGain(db))
      const layer = held(trackId)
      return layer ? layerMix ? layerMix.setLevel(layer, dbGain(db)) : noLayerMix(trackId) : setLevel(expressionOf(trackId), dbGain(db))
    }}
  }
  const arm = controls.arm
  if (arm) actions.mixer = {...actions.mixer, arm: {op: arm.op, run: (_trackId, on) => arm.set(on)}}
  // A Torus take lane's acts (O-I #855 round 25), each on the scene its take lies under: Audition (pressed on the lane auditioned, the main
  // lane sounds again), the comp of the stretch chosen on the ruler, in the samples of the scene's transport and within the take, and the
  // lane's Activator and Solo. A lane that is no take lane of this set is refused before the owner is called.
  const takes = controls.takes
  if (takes && placed.length) {
    const lanes = new Map(placed.map(found => [found.id, found]))
    const laneOf = (trackId: string, takeId: string) => { const found = lanes.get(takeId); return found && found.trackId === trackId ? found : null }
    const none = (takeId: string) => ({ok: false, error: `"${takeId}" is no take lane of this Expression.`})
    actions.audition = {op: takes.audition.op, run: (trackId, takeId) => {
      const found = laneOf(trackId, takeId)
      if (!found) return none(takeId)
      const auditioned = takes.audition.scene === found.sceneId && takes.audition.lane === found.take.lane
      return takes.audition.run(found.sceneId, auditioned ? null : found.take.lane)
    }}
    // The stretch chosen on the ruler, as samples of the Scene's transport and within the take; the comp and its way back take the same.
    const compOn = (trackId: string, takeId: string, range: {start: number; end: number},
      act: (sceneId: string, stretch: {lane_ref: string; start_sample: string; end_sample: string}) => unknown) => {
      const found = laneOf(trackId, takeId)
      if (!found) return none(takeId)
      const {take, scene} = found, at = Number(take.atSample)
      const sample = (t: number) => Math.round((t - scene) * take.rate)
      const start = Math.max(at, sample(range.start)), end = Math.min(at + Math.round(take.seconds * take.rate), sample(range.end))
      if (!(end > start)) return {ok: false, error: `The stretch chosen lies outside ${take.name}: choose a stretch of the take itself.`}
      return act(found.sceneId, {lane_ref: take.lane, start_sample: String(start), end_sample: String(end)})
    }
    const back = takes.comp.back
    actions.comp = {op: takes.comp.op, run: (trackId, takeId, range) => compOn(trackId, takeId, range, (sceneId, stretch) => takes.comp.run(sceneId, stretch)),
      ...(back ? {back: (trackId: string, takeId: string, range: {start: number; end: number}) => compOn(trackId, takeId, range, (sceneId, stretch) => back(sceneId, stretch))} : {})}
    actions.takeLane = {op: takes.lane.op, run: (trackId, takeId, setting) => {
      const found = laneOf(trackId, takeId)
      return found ? takes.lane.run(found.sceneId, found.take.lane, setting) : none(takeId)
    }}
  }
  // A scene's acts (manual §20.1's action table): duplicate, delete, insert after the presented scene, the Expression's title.
  const edit = controls.sceneEdit
  if (edit) {
    const scene = (clipId: string) => sceneOf.get(clipId)
    const refused = (clipId: string) => ({ok: false, error: `"${clipId}" is no scene of this Expression.`})
    actions.duplicateClip = {op: `${edit.op} · duplicate`, run: clipId => { const found = scene(clipId); return heldClip(clipId) ?? (found ? edit.run({operation: 'duplicate', scene_ref: found.sceneId}) : refused(clipId)) }}
    actions.deleteClip = {op: `${edit.op} · remove`, run: clipId => { const found = scene(clipId); return heldClip(clipId) ?? (found ? edit.run({operation: 'remove', scene_ref: found.sceneId}) : refused(clipId)) }}
    const heldTrack = (trackId: string) => { const id = trackId.replace(/^expression:/, '').replace(/:(visual|audio)$/, ''); return heldOne(id) ? heldWords(id) : null }
    actions.insertClip = {op: `${edit.op} · add (a blank scene after the presented one)`, run: () => edit.run({operation: 'add'})}
    actions.insertRow = {op: `${edit.op} · add (a blank scene after the presented one)`, run: () => edit.run({operation: 'add'})}
    actions.renameTrack = {op: `${edit.op} · expression-title`, run: (trackId, name) => heldTrack(trackId) ?? edit.run({operation: 'expression-title', title: name})}
    // The Colour menu on an Expression's track (DLW.md:8911; round 886): the Expression's colour, kept in its document.
    actions.colourTrack = {op: `${edit.op} · colour (the Expression's colour, kept in its document)`, run: (trackId, colour) => heldTrack(trackId) ?? edit.run({operation: 'colour', colour})}
    // The Expression's description on its track head (manual §20.1 The track: Title and Description stand on the head): the head's
    // Edit info text reads it as the owner reads it and writes it through the owner's expression-description (sceneEdits.ts:24). Only
    // where the reading carries the description: an unread one is never offered as empty, which would write it away.
    const described = new Map(reading.expressions.flatMap(expression => typeof expression.description === 'string'
      ? [[visualLaneId(expression.id), expression.description], [audioLaneId(expression.id), expression.description]] as const : []));
    if (described.size) actions.trackInfo = {op: `${edit.op} · expression-description`,
      read: async trackId => { const text = described.get(trackId); if (text === undefined) throw new Error('This track is no Expression of this set.'); return text },
      run: (trackId, text) => described.has(trackId) ? edit.run({operation: 'expression-description', description: text}) : {ok: false, error: 'This track is no Expression of this set.'}}
    else actions.waiting = {...actions.waiting, 'track.info': 'the Expression\'s description in the tracks\' reading (frame/tracks/modeTracks.ts nativeTracks: content.scenes.description)'}
    Object.assign(actions, sceneCuts(reading, sceneOf, ruler, edit, heldClip))
  }
  actions.owner = 'Expressions · the native composition (packages/expressions-boundary sceneEdits)'
  return actions;
}

/** The Arrangement's cuts of a scene (O-I #747; manual §16.6's table), each the owner's scene edit on the scene its clip shows (either side),
 * the ruler's units made the scene's own seconds, to the millisecond. A scene lies on the ruler where the Arrangement lays it; its
 * neighbours are its Expression's scenes in order. What the owner cannot be asked is said in words before it is called: a clip that is no
 * scene of the set, a move to where the scene stands (nothing to change), an Overwrite dropped on no other scene, a roll before the first
 * scene, a split outside the scene. */
function sceneCuts(reading: ExpressionsWorkReading, sceneOf: ReadonlyMap<string, {expressionId: string; sceneId: string}>,
  ruler: ReadonlyMap<string, {start: number; end: number}>, edit: NonNullable<ExpressionsControls['sceneEdit']>,
  heldClip: (clipId: string) => {ok: false; error: string} | null = () => null): Partial<WorldTrackActions> {
  const ms = (value: number) => Math.round(value * 1000) / 1000
  const refused = (error: string) => ({ok: false as const, error})
  const placeOf = (clipId: string) => {
    const found = sceneOf.get(clipId), at = ruler.get(clipId)
    const expression = found && reading.expressions.find(row => row.id === found.expressionId)
    if (!found || !at || !expression) return null
    const row = expression.scenes.flatMap(scene => {
      const lies = ruler.get(`${sceneKey(expression.id, scene.id)}:visual`)
      return lies ? [{sceneId: scene.id, name: scene.name, ...lies}] : []
    })
    const index = row.findIndex(scene => scene.sceneId === found.sceneId)
    return {...found, ...at, name: row[index]?.name ?? found.sceneId, row, index}
  }
  const none = (clipId: string) => refused(`"${clipId}" is no scene of this Expression.`)
  const finite = (value: number) => Number.isFinite(value)
  const cut = (clipId: string, run: (place: NonNullable<ReturnType<typeof placeOf>>) => unknown, ...values: number[]) => {
    const held = heldClip(clipId)
    if (held) return held
    const place = placeOf(clipId)
    if (!place) return none(clipId)
    if (!values.every(finite)) return refused('The ruler gave no point for this cut.')
    return run(place)
  }
  return {
    moveClip: {op: `${edit.op} · move`, run: (clipId, at, mode) => cut(clipId, place => {
      if (mode === 'overwrite') {
        const target = place.row.find(scene => scene.sceneId !== place.sceneId && at >= scene.start && at < scene.end)
        return target ? edit.run({operation: 'move', scene_ref: place.sceneId, mode: 'overwrite', to_ref: target.sceneId})
          : refused('Drop the scene on the scene it replaces: Overwrite lays it in that scene\'s place.')
      }
      // Insert: before the scene that begins nearest where its start is dropped, or last where the end of the sequence is nearer.
      const points = [...place.row.map(scene => ({at: scene.start, before: scene.sceneId as string | null})), {at: place.row.at(-1)!.end, before: null}]
      const nearest = points.reduce((best, point) => Math.abs(point.at - at) < Math.abs(best.at - at) ? point : best)
      const next = place.row[place.index + 1]?.sceneId ?? null
      if (nearest.before === place.sceneId || nearest.before === next) return {ok: true as const, note: `${place.name} stands where it was dropped: nothing moved.`}
      return edit.run({operation: 'move', scene_ref: place.sceneId, mode: 'insert', to_ref: nearest.before})
    }, at)},
    trimClip: {op: `${edit.op} · trim`, run: (clipId, edge, at) => cut(clipId, place =>
      edit.run({operation: 'trim', scene_ref: place.sceneId, edge, seconds: ms(at - (edge === 'start' ? place.start : place.end))}), at)},
    rollClip: {op: `${edit.op} · roll`, run: (clipId, edge, at) => cut(clipId, place => {
      if (edge === 'end') return edit.run({operation: 'roll', scene_ref: place.sceneId, seconds: ms(at - place.end)})
      const before = place.row[place.index - 1]
      return before ? edit.run({operation: 'roll', scene_ref: before.sceneId, seconds: ms(at - place.start)})
        : refused(`There is no scene before this one to roll the seam into: ${place.name} is the first.`)
    }, at)},
    slipClip: {op: `${edit.op} · slip`, run: (clipId, by) => cut(clipId, place => edit.run({operation: 'slip', scene_ref: place.sceneId, seconds: ms(by)}), by)},
    slideClip: {op: `${edit.op} · slide`, run: (clipId, by) => cut(clipId, place => edit.run({operation: 'slide', scene_ref: place.sceneId, seconds: ms(by)}), by)},
    splitClip: {op: `${edit.op} · split`, run: (clipId, at) => cut(clipId, place => at > place.start && at < place.end
      ? edit.run({operation: 'split', scene_ref: place.sceneId, at: ms(at - place.start)})
      : refused(`Set the insert marker inside ${place.name} on the ruler: Split cuts it there.`), at)},
  }
}

export const expressionsTrackAdapter: WorldTrackAdapter<ExpressionsWorkReading> = {
  id: EXPRESSIONS_TRACK_ADAPTER_ID,
  project: projectExpressionsWork,
};
