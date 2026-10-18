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
} from './worldTrackAdapter';

export interface ExpressionsWorkReading {
  expressions: {
    id: string;
    name: string;
    scenes: {id: string; name: string; duration: number; takes?: {id: string; name: string}[];
      /** How the scene stands, from the owner's playback reading (R3). */
      status?: ClipStatus; note?: string}[];
  }[];
  // Live's scene rows: each stop stands one or more scenes at once.
  stops?: {id: string; name: string; scenes: {expressionId: string; sceneId: string}[]}[];
  /** The presented scene's automation lanes (R3), each in the scene's own seconds. */
  automation?: {expressionId: string; sceneId: string; lanes: {id: string; device: string; parameter: string; points: {at: number; value: number}[];
    range?: {min: number; max: number}; modulatedBy?: string}[]}[];
  /** Values held off their automation by hand, as the owner counts them. */
  held?: number;
  /** A scene plays outside the saved sequence (Back to Arrangement lights); absent: no playback is read. */
  differs?: boolean;
  /** The owner's scene transport, when the presented composition gives one. */
  controls?: ExpressionsControls;
}

/** The owner ops the views press, each answering in the shell's receipt words. */
export interface ExpressionsControls {
  /** The Expression's own sound (native/frameSound.ts): its mute as it stands, the one soloed, and the writes of each. */
  sound?: {op: string; muted: boolean | null; soloed: string | null; mute(expressionId: string, muted: boolean): unknown; solo(expressionId: string, on: boolean): unknown};
  /** The transport's Studio arm (native/frameSound.ts publishStudioArm): armed, Play records a take. One arm for the open Expression. */
  arm?: {op: string; on: boolean; set(on: boolean): unknown};
  playScene?: {op: string; run(expressionId: string, sceneId: string): unknown};
  stopAll?: {op: string; run(): unknown};
  playSaved?: {op: string; run(): unknown};
  reenable?: {op: string; run(): unknown};
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** Expressions' mixer row (manual §20.1), each control's meaning in the manual's words. Monitor is none. */
export const EXPRESSIONS_MIXER: WorldMixer = {
  activator: {meaning: 'Silences the Expression\'s sound; the picture still plays',
    disabled: missing('Activator', 'a sound mute per Expression in the Expressions engine — stage command {command: "sound", action: "mute", expression_ref, on}, and the hosted state reporting `soundMuted`', 'Expressions')},
  solo: {meaning: 'Lets you hear only this Expression\'s sound',
    disabled: missing('Solo', 'stage command {command: "sound", action: "solo", expression_ref, on} and the hosted state reporting `soundSolo`', 'Expressions')},
  arm: {meaning: 'Arms the Expression for a take: with Arm on, Play records the studio as a take',
    disabled: missing('Arm', 'the transport\'s Studio arm published to the shell (shell.setStudioArm(on) with its flag readable — today it is the transport hook\'s own state, shell/transports/useExpressionsTransport.tsx:96)', 'shell')},
  output: {meaning: 'Its sound goes to the Main track; its picture goes to the stage', route: 'Main · stage'},
};

/** The mixer row where the frame's sound stands behind it: Activator and Solo write it. */
const EXPRESSIONS_MIXER_SOUNDED: WorldMixer = {...EXPRESSIONS_MIXER,
  activator: {meaning: EXPRESSIONS_MIXER.activator!.meaning}, solo: {meaning: EXPRESSIONS_MIXER.solo!.meaning}}

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

  for (const expression of reading.expressions) {
    const groupId = expressionGroupId(expression.id);
    tracks.push(
      {id: visualLaneId(expression.id), name: `${expression.name}: visual`, kind: 'expression-visual', groupId, lane: 'visual'},
      {id: audioLaneId(expression.id), name: `${expression.name}: audio`, kind: 'expression-audio', groupId, lane: 'audio'},
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
      const state = {...(scene.status ? {status: scene.status} : {}), ...(scene.note ? {note: scene.note} : {})};
      clips.push(
        {id: `${key}:visual`, trackId: visualLaneId(expression.id), columnId, label: scene.name, span: {start, end}, ...state},
        {id: `${key}:audio`, trackId: audioLaneId(expression.id), columnId, label: scene.name, span: {start, end}, ...state},
      );
      for (const take of scene.takes ?? []) {
        takes.push({id: `${key}:${take.id}`, target: key, name: take.name});
      }
      cursor.set(columnId, end);
    });
  }

  const automation: WorldAutomationLane[] = (reading.automation ?? []).flatMap(scene => scene.lanes.map(lane => ({
    id: `${sceneKey(scene.expressionId, scene.sceneId)}#lane/${lane.id}`, trackId: visualLaneId(scene.expressionId),
    clipId: `${sceneKey(scene.expressionId, scene.sceneId)}:visual`, device: lane.device, parameter: lane.parameter, points: lane.points,
    ...(lane.range ? {range: lane.range} : {}), ...(lane.modulatedBy ? {modulatedBy: lane.modulatedBy} : {}),
  })));
  // The Expression's own sound: each of its lanes carries the Activator and Solo the frame's sound stands at.
  const sound = reading.controls?.sound
  if (sound) for (const track of tracks) {
    const expressionId = track.groupId?.slice('expression:'.length) ?? ''
    track.mix = {...(sound.muted !== null ? {activator: !sound.muted} : {}), solo: sound.soloed === expressionId}
  }
  const arm = reading.controls?.arm
  if (arm) for (const track of tracks) track.mix = {...track.mix, arm: arm.on}
  const set: WorldTrackSet = {columns, tracks, clips, transport: {takes},
    mixer: {...(sound ? EXPRESSIONS_MIXER_SOUNDED : EXPRESSIONS_MIXER), ...(arm ? {arm: {meaning: EXPRESSIONS_MIXER.arm!.meaning, grain: 'the Studio arm: one arm for the open Expression'}} : {})},
    main: {name: 'Main', chain: [], ...(reading.differs !== undefined ? {differs: reading.differs} : {})},
    lanes: {automation, absent: {...EXPRESSIONS_LANES_ABSENT, ...(reading.automation ? {} : {automation: 'The presented scene\'s reading is not published to this pane, so its lanes are unread.'})},
      ...(reading.held !== undefined ? {held: reading.held} : {})}};
  const actions = expressionsActions(reading, clips);
  if (actions) set.actions = actions;
  return set;
}

/** The owner's scene transport over this set's own ids: a clip that is no scene of the set is refused before the owner is called. */
function expressionsActions(reading: ExpressionsWorkReading, clips: readonly WorldTrackClip[]): WorldTrackActions | undefined {
  const controls = reading.controls;
  if (!controls) return undefined;
  const sceneOf = new Map<string, {expressionId: string; sceneId: string}>();
  for (const expression of reading.expressions) for (const scene of expression.scenes) for (const side of ['visual', 'audio']) {
    sceneOf.set(`${sceneKey(expression.id, scene.id)}:${side}`, {expressionId: expression.id, sceneId: scene.id});
  }
  const actions: WorldTrackActions = {};
  const play = controls.playScene;
  if (play && clips.length) actions.launch = {op: play.op, run: clipId => {
    const found = sceneOf.get(clipId);
    return found ? play.run(found.expressionId, found.sceneId) : {ok: false, error: `"${clipId}" is no scene of this Expression.`};
  }};
  if (controls.stopAll) actions.stopAll = controls.stopAll;
  if (controls.playSaved) actions.backToArrangement = controls.playSaved;
  if (controls.reenable) actions.reenable = {op: controls.reenable.op, run: () => controls.reenable!.run()};
  const sound = controls.sound
  if (sound) {
    const expressionOf = (trackId: string) => trackId.replace(/^expression:/, '').replace(/:(visual|audio)$/, '')
    actions.mixer = {...actions.mixer, activator: {op: sound.op, run: (trackId, on) => sound.mute(expressionOf(trackId), !on)},
      solo: {op: sound.op, run: (trackId, on) => sound.solo(expressionOf(trackId), on)}}
  }
  const arm = controls.arm
  if (arm) actions.mixer = {...actions.mixer, arm: {op: arm.op, run: (_trackId, on) => arm.set(on)}}
  return Object.keys(actions).length ? actions : undefined;
}

export const expressionsTrackAdapter: WorldTrackAdapter<ExpressionsWorkReading> = {
  id: EXPRESSIONS_TRACK_ADAPTER_ID,
  project: projectExpressionsWork,
};
