import {EXPRESSION_LAUNCH_QUANTIZE, type Journey, type LaunchQuantize, type Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {KernelConversion, OccurrenceBinding} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {sceneSaveState} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow';
import {expressionTiming} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks';
import {sceneCounter, SCENE_TORUS_TAKES_MAX, takeRate as rate, TORUS_TAKE_LANE} from './scenesValidation';
import {expressionMixOf, type ExpressionMixReading} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound';

/** Supplied by the retained app's transport owner. This module never advances,
 * seeks or converts a clock, and simulation time is not sequence time. */
export interface NativeScenePlaybackReading {
  scene_ref: string;
  scene_elapsed_seconds: number;
  expression_time_seconds: number;
  scene_playing: boolean;
  saved_sequence_playing: boolean;
  field_paused: boolean;
  track_preview: boolean;
  /** XS08: a launch the transport holds for its Quantize, its scene and the second of the playing scene it lands at; null or absent, none
   * waits (an older frame says nothing). */
  launch_pending?: {scene_ref: string; at_seconds: number} | null;
}

export interface NativeSceneMemberReading {
  entity_ref: string;
  local_entity_id: string | null;
  /** Absent means not present in this working material, not deleted natively.
   * Saved-only and retained hidden membership remain in member_refs. */
  state: 'loaded' | 'unloaded' | 'absent';
  occurrence: OccurrenceBinding | null;
}

export interface NativeSceneReading {
  scene_ref: string;
  local_scene_id: string | null;
  native_title: string;
  title: string;
  working: {duration: number; transition: number} | null;
  snapshot: {availability: 'present' | 'absent' | 'unavailable'; duration: number | null;
    standing: ReturnType<typeof sceneSaveState> | null};
  material: {available: boolean; reason: string | null};
  member_refs: string[];
  members: NativeSceneMemberReading[];
  membership: {complete: boolean; page: number | null; page_count: number | null;
    unloaded_refs: string[]; unbound_local_entity_ids: string[]; reason: string | null};
  /** The Torus takes that lie under the Scene (O-I #855), as its performance keeps them. Absent: it keeps none. */
  torus_takes?: NativeSceneTorusTake[];
  /** The stretches of its take lanes comped into the row's main lane (O-I #855 round 25), in the order comped. Absent: none is. */
  torus_comp?: NativeSceneTakeComp[];
  /** What the scene is a render of (manual §10.3 Media), where its body is a knowledge whole: the constellation and the revision the body
   * was read at (expression_carrier.rs SceneBody.reading), so a reader can say whether the source has moved since (O-I #747 round 891).
   * Absent: the scene is made of no constellation, or its body is not disclosed. Where its body is a file (`text_source`, `image_media`),
   * the file, its carrier, the revision the body was read at and, once Central's file owner has answered, the revision it stands at `now`
   * (O-I #747 round 892: every scene made of a file carries the mark, not only the presented one). */
  made_of?: {subject_ref: string; revision: string} | NativeSceneFileSource;
}

/** A scene made of a file (O-I #747 round 892): the kernel's scene body names the file and the revision it was read at; `now` is the revision
 * Central's file owner reads it at now (createSceneSourcesNow), absent while nothing has answered or the read was refused. */
export interface NativeSceneFileSource {subject_ref: string; revision: string; carrier: SceneSourceCarrier; now?: string}
export type SceneSourceCarrier = 'text_source' | 'image_media';

/** A Torus take that lies under a Scene (O-I #855; kernel expression_performance/torus.rs TorusTakeRecord): its take lane as the
 * Scene's performance keeps it (`take-lane:torus/<TakeId>`, with its title, Activator and Solo), the take by its ref, and where it lies:
 * from the sample of the performance's transport it lies at, for its frames at the take's sample rate, each also in the Scene's own
 * seconds (the performance's transport runs at `transport_rate`, its sample rate: O-I #855 round 25 carries it, so a stretch of the
 * Scene's seconds is a stretch of the transport's samples, as a comp names it). */
export interface NativeSceneTorusTake {
  lane_ref: string; title: string; enabled: boolean; solo: boolean; take_ref: string;
  at_sample: string; frames: string; sample_rate: number; transport_rate: number; at_seconds: number; seconds: number;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** A stretch of a Torus take lane comped into the row's main lane (O-I #855 round 25; kernel expression_performance/torus.rs TakeComp):
 * its lane, and from and to which sample of the performance's transport (running at `sample_rate`) the main lane sounds the take that lies
 * on it there, each also in the Scene's own seconds. */
export interface NativeSceneTakeComp {
  lane_ref: string; start_sample: string; end_sample: string; sample_rate: number; start_seconds: number; end_seconds: number;
}

/** The stretches a Scene's performance comps from its Torus take lanes, in the order comped. One whose lane is no Torus take lane, or
 * that does not run forward, is none. Pure. */
export function sceneTorusComp(performance: unknown): NativeSceneTakeComp[] {
  if (!record(performance) || !Array.isArray(performance.torus_comp) || !rate(performance.sample_rate)) return [];
  const transport = performance.sample_rate;
  return performance.torus_comp.slice(0, SCENE_TORUS_TAKES_MAX).flatMap((row): NativeSceneTakeComp[] => {
    if (!record(row) || typeof row.lane_ref !== 'string' || !row.lane_ref.startsWith(TORUS_TAKE_LANE)) return [];
    const start = sceneCounter(row.start_sample), end = sceneCounter(row.end_sample);
    if (start === null || end === null || start >= end) return [];
    return [{lane_ref: row.lane_ref, start_sample: String(start), end_sample: String(end), sample_rate: transport,
      start_seconds: Number(start) / transport, end_seconds: Number(end) / transport}];
  });
}

/** The take a Scene's row sounds at `sample` of its transport (O-I #855 round 25; DLW build ruling 2026-11-05: "Which lane sounds: one
 * per row, the active lane (Live's main lane / comp); Audition on a take lane solos that lane in place of it"), and its frame there: while
 * a lane is auditioned, the take on that lane lying there; else, where a stretch is comped over the sample, the take on the latest such
 * stretch's lane; else the latest take laid there. Each lane is heard by the kernel's layer law (expression_performance.rs replay: a lane
 * sounds while it is on and, while any lane on is soloed, soloed), so a stretch comped from a lane that is not heard is silent. Null where
 * no take sounds. Pure. */
export function soundingTorusTake(takes: readonly Pick<NativeSceneTorusTake, 'lane_ref' | 'enabled' | 'solo' | 'take_ref' | 'at_sample' | 'frames'>[],
  comp: readonly Pick<NativeSceneTakeComp, 'lane_ref' | 'start_sample' | 'end_sample'>[], audition: string | null, sample: number):
  {take_ref: string; lane_ref: string; from_frame: number} | null {
  const over = (take: (typeof takes)[number]) => Number(take.at_sample) <= sample && sample < Number(take.at_sample) + Number(take.frames);
  const latest = (rows: readonly (typeof takes)[number][]) => {
    const take = rows.filter(over).at(-1);
    return take ? {take_ref: take.take_ref, lane_ref: take.lane_ref, from_frame: sample - Number(take.at_sample)} : null;
  };
  if (audition !== null) return latest(takes.filter(take => take.lane_ref === audition));
  const soloing = takes.some(take => take.enabled && take.solo);
  const heard = (take: (typeof takes)[number]) => take.enabled && (!soloing || take.solo);
  const stretch = comp.filter(row => Number(row.start_sample) <= sample && sample < Number(row.end_sample)).at(-1);
  if (stretch) return latest(takes.filter(take => take.lane_ref === stretch.lane_ref && heard(take)));
  return latest(takes.filter(heard));
}

/** The Torus takes a Scene's performance lays under it, in the order it keeps them: each on its take lane (the layer it names). A record
 * whose lane is no Torus take lane, or whose take, lane or sample is not whole, is none. Pure. */
export function sceneTorusTakes(performance: unknown): NativeSceneTorusTake[] {
  if (!record(performance) || !Array.isArray(performance.torus_takes) || !Array.isArray(performance.layers)) return [];
  const layers: unknown[] = performance.layers;
  return performance.torus_takes.slice(0, SCENE_TORUS_TAKES_MAX).flatMap((row): NativeSceneTorusTake[] => {
    if (!record(row) || !record(row.take) || !Number.isSafeInteger(row.layer)) return [];
    const take = row.take, lane = layers[row.layer as number];
    const at = sceneCounter(row.at_sample), frames = sceneCounter(take.frames);
    const transport = rate(performance.sample_rate) ? performance.sample_rate : take.sample_rate;
    if (!record(lane) || typeof lane.layer_ref !== 'string' || !lane.layer_ref.startsWith(TORUS_TAKE_LANE) || typeof lane.title !== 'string'
      || typeof lane.enabled !== 'boolean' || typeof lane.solo !== 'boolean' || typeof take.take_ref !== 'string' || !take.take_ref
      || at === null || frames === null || !rate(take.sample_rate) || !rate(transport)) return [];
    return [{lane_ref: lane.layer_ref, title: lane.title, enabled: lane.enabled, solo: lane.solo, take_ref: take.take_ref,
      at_sample: String(at), frames: String(frames), sample_rate: take.sample_rate, transport_rate: transport, at_seconds: Number(at) / transport,
      seconds: Number(frames) / take.sample_rate}];
  });
}

export type NativeSceneTimingReading =
  | {available: true; total_seconds: number;
      extents: {scene_ref: string; start_seconds: number; duration_seconds: number; transition_seconds: number}[]}
  | {available: false; reason: string; missing_scene_refs: string[]; unbound_local_scene_ids: string[]};

export interface NativeScenesReading {
  schema: 'oi.native-scenes/v1';
  basis: {expression_ref: string; revision: number};
  title: string;
  /** The Expression description of the working Journey (journey.description). Empty is a real value. */
  description: string;
  /** The saved-sequence loop flag of the working Journey (journey.loop). */
  loop: boolean;
  /** XT15 (O-I #747 round 889; §16.6 "A loop region plays and repeats only between its in and out points"): the loop region the Expression
   * keeps (journey.loopRegion), in seconds of its working clock, present only while it keeps one. The frame repeats the scenes between
   * its in and out points as the saved sequence plays (field-studies-journeys sceneTransport.ts). */
  loop_region?: {from: number; to: number};
  /** XS08: the transport's Quantize the Expression keeps (journey.launchQuantize, Live's bar where it keeps none). Optional on the wire:
   * an older frame does not say. */
  launch_quantize?: LaunchQuantize;
  /** XS15 (round 885): the Expression's mixer as its document keeps it — Volume, the Main level (linear gain, 0 to 2) and the Activator —
   * its defaults where it keeps none. Optional on the wire: an older frame does not say, and no mixer is read. */
  mix?: ExpressionMixReading;
  /** The Expression's colour (DLW.md:8911; round 886), a palette colour (#RRGGBB), present only while the Expression keeps one. */
  colour?: string;
  native_selected_scene_ref: string | null;
  native_order: string[];
  object_titles: Record<string,string>;
  /** Null entries are local drafts without a captured native Scene identity. */
  working_order: (string | null)[];
  unbound_local_scene_ids: string[];
  scenes: NativeSceneReading[];
  completeness: {order: boolean; material: boolean; occurrences: boolean};
  timing: {working: NativeSceneTimingReading; saved: NativeSceneTimingReading};
}

const sameRefs = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((ref, index) => ref === b[index]);
const validTiming = (scene: Scene | undefined): scene is Scene => !!scene &&
  Number.isFinite(scene.duration) && scene.duration >= 1 && scene.duration <= 3600 &&
  Number.isFinite(scene.transition) && scene.transition >= 0 && scene.transition <= 30;

const FILE_CARRIERS: readonly string[] = ['text_source', 'image_media'];
/** Where a file's revision now is kept: by its carrier (which read answers it) and its ref. */
export const sceneSourceKey = (carrier: SceneSourceCarrier, ref: string) => `${carrier}\u0000${ref}`;
/** A scene body's source at the revision it was read at: a knowledge whole's constellation (O-I #747 round 891), or a file with the revision
 * Central's file owner reads it at now, where `now` holds one (round 892); else none. */
function madeOf(body: unknown, now?: ReadonlyMap<string, string>): NonNullable<NativeSceneReading['made_of']> | null {
  const file = fileBody(body);
  if (file) {
    const current = now?.get(sceneSourceKey(file.carrier, file.subject_ref));
    return {...file, ...(current ? {now: current} : {})};
  }
  if (!record(body) || body.carrier !== 'knowledge_whole' || typeof body.subject_ref !== 'string' || !body.subject_ref || !record(body.reading)) return null;
  const revision = body.reading.revision;
  return typeof revision === 'string' && revision ? {subject_ref: body.subject_ref, revision} : null;
}
function fileBody(body: unknown): Omit<NativeSceneFileSource, 'now'> | null {
  if (!record(body) || !FILE_CARRIERS.includes(String(body.carrier)) || typeof body.subject_ref !== 'string' || !body.subject_ref
    || !record(body.reading) || typeof body.reading.revision !== 'string' || !body.reading.revision) return null;
  return {subject_ref: body.subject_ref, revision: body.reading.revision, carrier: body.carrier as SceneSourceCarrier};
}

/** The revisions the files an Expression's scenes are made of stand at now (O-I #747 round 892), as Central's file owner answers them through
 * the frame's own host reads (`read`: central-subject-text for a text source, central-subject-bytes for an image). `ask` asks once for each
 * file at each revision a body was read at — a Remake reads it again at another — and asks every file `again` when the window comes back to
 * the front (a file changed elsewhere meanwhile). `changed` hears when a file's revision now is news, so the reading can be published again.
 * A refused read compares nothing: the file is dropped from `now`, never guessed as current or gone (frame/detail/remake.ts sourceStanding). */
export function createSceneSourcesNow(read: (carrier: SceneSourceCarrier, ref: string) => Promise<{revision?: unknown} | null>, changed: () => void) {
  const now = new Map<string, string>(), asked = new Map<string, string>(), asking = new Set<string>();
  const settle = (key: string, revision: string | undefined) => {
    if (revision === undefined ? !now.has(key) : now.get(key) === revision) return;
    if (revision === undefined) now.delete(key); else now.set(key, revision);
    changed();
  };
  return {
    now: (): ReadonlyMap<string, string> => now,
    ask(scenes: readonly {body?: unknown}[], options: {again?: boolean} = {}) {
      for (const scene of scenes) {
        const file = fileBody(scene.body);
        if (!file) continue;
        const key = sceneSourceKey(file.carrier, file.subject_ref);
        if (asking.has(key) || !options.again && asked.get(key) === file.revision) continue;
        asked.set(key, file.revision); asking.add(key);
        void read(file.carrier, file.subject_ref).then(
          answer => typeof answer?.revision === 'string' && answer.revision ? answer.revision : undefined, () => undefined)
          .then(revision => { asking.delete(key); settle(key, revision) });
      }
    },
  };
}
export type SceneSourcesNow = ReturnType<typeof createSceneSourcesNow>;

/** Project the existing authoring owners; no storage, native writes or new
 * document. Conversion compatibility defaults are not authored pacing. */
export function projectNativeScenes(journey: Journey, view: KernelConversion, sourcesNow?: ReadonlyMap<string, string>): NativeScenesReading {
  if (journey.id !== view.journey.id) throw Error('The working Journey does not address this captured native Expression');
  const nativeOrder = view.document.scenes.map(scene => scene.scene_ref);
  if (new Set(nativeOrder).size !== nativeOrder.length) throw Error('Native Scene identity is ambiguous');
  const nativeRefs = new Set(nativeOrder);
  const bindings = new Map<string, {id: string; binding: KernelConversion['bindings'][string]}>();
  const localRefs = new Map<string, string>();
  for (const [id, binding] of Object.entries(view.bindings)) {
    if (!nativeRefs.has(binding.scene_ref)) continue;
    if (bindings.has(binding.scene_ref)) throw Error('Two local Scenes address the same native Scene');
    bindings.set(binding.scene_ref, {id, binding});
    localRefs.set(id, binding.scene_ref);
  }
  const localScenes = new Map(journey.scenes.map(scene => [scene.id, scene]));
  if (localScenes.size !== journey.scenes.length) throw Error('Working Scene identity is ambiguous');
  const workingOrder = journey.scenes.map(scene => localRefs.get(scene.id) ?? null);
  const unbound = journey.scenes.filter(scene => !localRefs.has(scene.id)).map(scene => scene.id);
  const rows = view.document.scenes.map((native): NativeSceneReading => {
    const captured = bindings.get(native.scene_ref), local = captured && localScenes.get(captured.id);
    const binding = captured?.binding;
    const presentation = native.presentation;
    const available = !!local && validTiming(local) && presentation?.schema === 'oi.journey-scene/v1' && validTiming(presentation.scene);
    const reason = !captured ? 'Native Scene correspondence is not loaded' : !local ? 'The working Scene is not loaded' :
      presentation?.schema !== 'oi.journey-scene/v1' ? 'No authored native Scene material is disclosed' :
      !available ? 'Scene pacing is unavailable or outside its owner bounds' : null;
    const occurrences = new Map(binding?.occurrences.map(row => [row.entity_ref, row]) ?? []);
    const loaded = new Set(binding?.loaded_refs ?? []), hidden = new Set(binding?.hidden_refs ?? []);
    const localEntities = new Set(local?.entities.map(entity => entity.id) ?? []);
    const members = native.entity_refs.map((entity_ref): NativeSceneMemberReading => {
      const occurrence = occurrences.get(entity_ref), localId = view.entity_ids[entity_ref] ?? null;
      const state = !local || !binding ? 'unloaded' : occurrence && localEntities.has(occurrence.view_entity_id) ? 'loaded' :
        loaded.has(entity_ref) || hidden.has(entity_ref) ? 'absent' : 'unloaded';
      return {entity_ref, local_entity_id: localId, state, occurrence: state === 'loaded' && occurrence ? {...occurrence,
        subject: occurrence.subject ? structuredClone(occurrence.subject) : null} : null};
    });
    const knownLocalIds = new Set(members.map(member => member.local_entity_id).filter((id): id is string => id !== null));
    const unboundEntities = local?.entities.filter(entity => !knownLocalIds.has(entity.id)).map(entity => entity.id) ?? [];
    const unloadedRefs = members.filter(member => member.state === 'unloaded').map(member => member.entity_ref);
    const membershipMatches = !!binding && sameRefs(binding.member_refs, native.entity_refs);
    const complete = !!local && membershipMatches && unloadedRefs.length === 0 && unboundEntities.length === 0;
    const saved = local && journey.savedScenes?.[local.id];
    const takes = sceneTorusTakes(native.performance), comp = sceneTorusComp(native.performance), made = madeOf(native.body, sourcesNow);
    return {scene_ref: native.scene_ref, local_scene_id: captured?.id ?? null, native_title: native.title,
      title: local?.name ?? native.title, working: available ? {duration: local!.duration, transition: local!.transition} : null,
      snapshot: {availability: !available ? 'unavailable' : saved ? 'present' : 'absent',
        duration: available && validTiming(saved) ? saved.duration : null,
        // A saved/edited comparison of just one loaded page cannot establish
        // whole-Scene standing. Keep snapshot existence separate from it.
        standing: available && complete ? sceneSaveState(journey, local!) : null},
      material: {available, reason}, member_refs: [...native.entity_refs], members,
      membership: {complete, page: binding?.page ?? null, page_count: binding?.page_count ?? null,
        unloaded_refs: unloadedRefs, unbound_local_entity_ids: unboundEntities,
        reason: complete ? null : !membershipMatches ? 'Native membership correspondence is not loaded or disagrees' :
          !local ? 'The working Scene is not loaded' : unboundEntities.length ? 'Local objects have no captured native identity' : 'Some native occurrences are not loaded'},
      ...(takes.length ? {torus_takes: takes} : {}), ...(comp.length ? {torus_comp: comp} : {}), ...(made ? {made_of: made} : {})};
  });
  const orderComplete = unbound.length === 0 && workingOrder.length === nativeOrder.length &&
    new Set(workingOrder).size === nativeOrder.length && nativeOrder.every(ref => workingOrder.includes(ref));
  const missing = rows.filter(row => !row.material.available).map(row => row.scene_ref);
  const timing = (savedOnly: boolean): NativeSceneTimingReading => {
    const unavailableSaved = savedOnly ? rows.filter(row => row.snapshot.availability === 'present' && row.snapshot.duration === null).map(row => row.scene_ref) : [];
    if (!orderComplete || missing.length || unavailableSaved.length) return {available: false,
      reason: 'A complete ref-addressed authored sequence is required to derive its time extent',
      missing_scene_refs: [...new Set([...missing, ...unavailableSaved])], unbound_local_scene_ids: [...unbound]};
    return {available: true, total_seconds: expressionTiming(journey, 0, 0, savedOnly).total,
      extents: journey.scenes.flatMap((scene, index) => {
        const played = savedOnly ? journey.savedScenes?.[scene.id] : scene;
        if (!played) return [];
        return [{scene_ref: localRefs.get(scene.id)!, start_seconds: expressionTiming(journey, index, 0, savedOnly).start,
          duration_seconds: played.duration, transition_seconds: played.transition}];
      })};
  };
  return {schema: 'oi.native-scenes/v1', basis: {expression_ref: view.document.expression_ref, revision: view.document.revision},
    title: journey.name, description: journey.description, loop: journey.loop === true,
    ...(journey.loopRegion ? {loop_region: {from: journey.loopRegion.from, to: journey.loopRegion.to}} : {}),
    launch_quantize: journey.launchQuantize ?? EXPRESSION_LAUNCH_QUANTIZE, mix: {...expressionMixOf(journey.mix)}, ...(journey.colour !== undefined ? {colour: journey.colour} : {}), native_selected_scene_ref: view.document.selection?.scene_ref ?? null,
    object_titles:Object.fromEntries(Object.values(view.document.entities).map(entity=>[entity.entity_ref,entity.title])),
    native_order: nativeOrder, working_order: workingOrder, unbound_local_scene_ids: unbound, scenes: rows,
    completeness: {order: orderComplete, material: missing.length === 0, occurrences: rows.every(row => row.membership.complete)},
    timing: {working: timing(false), saved: timing(true)}};
}

/** Query native membership without confusing another Scene or an unloaded page
 * with a missing subject. No fallback to a different occurrence is allowed. */
export function nativeSceneMember(reading: NativeScenesReading, sceneRef: string, entityRef: string):
  NativeSceneMemberReading | {entity_ref: string; state: 'absent' | 'unavailable'; reason: string} {
  const scene = reading.scenes.find(row => row.scene_ref === sceneRef);
  if (!scene) return {entity_ref: entityRef, state: 'unavailable', reason: 'The native Scene is not disclosed'};
  return scene.members.find(row => row.entity_ref === entityRef) ??
    {entity_ref: entityRef, state: 'absent', reason: 'The subject is not a member of this native Scene'};
}
