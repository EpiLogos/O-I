import type {NativeScenesReading} from './scenes';
/** Live's launch quantize words the scenes reading may name (the frame's model.ts LAUNCH_QUANTIZE, copied so this reader loads none of
 * the authoring model; tests/launch-quantize-xs08-884.test.mjs holds the two equal). */
export const READ_LAUNCH_QUANTIZE = ['none', '8 bars', '4 bars', '2 bars', '1 bar', '1/2', '1/2t', '1/4', '1/4t', '1/8', '1/8t', '1/16', '1/16t', '1/32'] as const;

/** XS15 (rounds 885–886): the Expression's mixer as the scenes reading discloses it — exactly Volume and Main (linear gain, silence to +6 dB),
 * the Activator and Solo (the frame's native-field/entitySound.ts ExpressionMixReading, read here without loading it). A frame from before
 * Solo says none. */
const readMix = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const mix = value as Record<string, unknown>, level = (gain: unknown) => typeof gain === 'number' && Number.isFinite(gain) && gain >= 0 && gain <= 2;
  return Object.keys(mix).length === ('solo' in mix ? 4 : 3) && level(mix.level) && level(mix.main) && typeof mix.active === 'boolean'
    && (!('solo' in mix) || typeof mix.solo === 'boolean');
};
/** A Torus take's lane in a Scene's performance (kernel torus.rs: `take-lane:torus/<TakeId>`), and the most takes one keeps (MAX_TAKES). */
export const TORUS_TAKE_LANE = 'take-lane:torus/';
export const SCENE_TORUS_TAKES_MAX = 256;
/** A performance counter as the kernel writes one (expression_performance.rs Counter: canonical decimal u64), or null. */
export const sceneCounter = (value: unknown): bigint | null =>
  typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 0xffff_ffff_ffff_ffffn ? BigInt(value) : null;
export const takeRate = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 8000 && (value as number) <= 192000;

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 4096;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const refs = (value: unknown, limit = 65536): value is string[] => Array.isArray(value) && value.length <= limit
  && value.every(text) && new Set(value).size === value.length;
const equalRefs = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, index) => value === b[index]);
const pacing = (value: unknown) => object(value) && finite(value.duration) && value.duration >= 1 && value.duration <= 3600
  && finite(value.transition) && value.transition >= 0 && value.transition <= 30;
const indexOrNull = (value: unknown, minimum = 0) => value === null || Number.isSafeInteger(value) && (value as number) >= minimum;
/** The Torus takes a Scene lays under it (scenes.ts sceneTorusTakes), each whole, on a Torus take lane, its seconds as its samples say. */
const torusTakes = (value: unknown) => Array.isArray(value) && value.length >= 1 && value.length <= SCENE_TORUS_TAKES_MAX && value.every(take => object(take)
  && typeof take.lane_ref === 'string' && take.lane_ref.startsWith(TORUS_TAKE_LANE) && take.lane_ref.length <= 4096
  && typeof take.title === 'string' && take.title.length <= 4096 && typeof take.enabled === 'boolean' && typeof take.solo === 'boolean'
  && text(take.take_ref) && sceneCounter(take.at_sample) !== null && sceneCounter(take.frames) !== null && takeRate(take.sample_rate)
  && takeRate(take.transport_rate) && take.at_seconds === Number(take.at_sample) / take.transport_rate && take.seconds === Number(take.frames) / take.sample_rate);

/** The stretches a Scene comps from its take lanes (scenes.ts sceneTorusComp), each from a Torus take lane, running forward, its seconds as
 * its samples say at the transport's rate. */
const torusComp = (value: unknown) => Array.isArray(value) && value.length >= 1 && value.length <= SCENE_TORUS_TAKES_MAX && value.every(row => {
  if (!object(row) || typeof row.lane_ref !== 'string' || !row.lane_ref.startsWith(TORUS_TAKE_LANE) || row.lane_ref.length > 4096
    || !takeRate(row.sample_rate)) return false;
  const start = sceneCounter(row.start_sample), end = sceneCounter(row.end_sample);
  return start !== null && end !== null && start < end && row.start_seconds === Number(start) / row.sample_rate
    && row.end_seconds === Number(end) / row.sample_rate;
});

/** XT15 (round 889): a loop region, exactly — its in before its out, in seconds of an Expression's working clock (at most 64 scenes of an
 * hour each), and nothing else. */
const loopRegion = (value: unknown) => object(value) && Object.keys(value).every(key => key === 'from' || key === 'to')
  && typeof value.from === 'number' && typeof value.to === 'number' && Number.isFinite(value.from) && Number.isFinite(value.to)
  && value.from >= 0 && value.from < value.to && value.to <= 64 * 3600;

/** What a scene is a render of (round 891), exactly: a constellation and the revision its body was read at. */
const madeOf = (value: unknown) => object(value) && Object.keys(value).length === 2 && text(value.subject_ref) && text(value.revision);

/** Qualify optional whole-Scene disclosures before they enter shell state.
 * The caller supplies its already-admitted native editor basis. No label,
 * position or compatibility default establishes identity or completeness. */
export function isNativeScenesReading(value: unknown, basis: {expression_ref: string; revision: number; scene_ref: string}): value is NativeScenesReading {
  if (!object(value) || value.schema !== 'oi.native-scenes/v1' || !object(value.basis)
    || value.basis.expression_ref !== basis.expression_ref || value.basis.revision !== basis.revision
    || typeof value.title !== 'string' || value.launch_quantize !== undefined && !(READ_LAUNCH_QUANTIZE as readonly unknown[]).includes(value.launch_quantize)
    || value.mix !== undefined && !readMix(value.mix)
    || value.colour !== undefined && (typeof value.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.colour))
    || value.loop_region !== undefined && !loopRegion(value.loop_region)
    || value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 5000)
    || !object(value.object_titles) || Object.keys(value.object_titles).length>65536
    || !Object.entries(value.object_titles).every(([ref,title])=>text(ref)&&typeof title==='string')
    || !refs(value.native_order, 64) || !value.native_order.includes(basis.scene_ref)
    || !Array.isArray(value.working_order) || value.working_order.length > 64
    || !refs(value.unbound_local_scene_ids, 64) || !Array.isArray(value.scenes)
    || value.scenes.length !== value.native_order.length || !object(value.completeness) || !object(value.timing)
    || !['order', 'material', 'occurrences'].every(key => typeof (value.completeness as Record<string, unknown>)[key] === 'boolean')) return false;
  const native = new Set(value.native_order);
  if (!(value.native_selected_scene_ref === null || text(value.native_selected_scene_ref) && native.has(value.native_selected_scene_ref))
    || !value.working_order.every(ref => ref === null || text(ref) && native.has(ref))
    || value.working_order.filter(ref => ref === null).length !== value.unbound_local_scene_ids.length) return false;
  if (value.completeness.order && (value.unbound_local_scene_ids.length || value.working_order.length !== native.size
    || new Set(value.working_order).size !== native.size)) return false;
  const local = new Set<string>();
  for (const [index, row] of value.scenes.entries()) {
    if (!object(row) || row.scene_ref !== value.native_order[index] || typeof row.title !== 'string' || typeof row.native_title !== 'string'
      || !(row.local_scene_id === null || text(row.local_scene_id)) || !object(row.material)
      || typeof row.material.available !== 'boolean' || !object(row.snapshot) || !object(row.membership)
      || !refs(row.member_refs) || !row.member_refs.every(ref=>Object.hasOwn(value.object_titles as object,ref)) || !Array.isArray(row.members) || row.members.length !== row.member_refs.length
      || typeof row.membership.complete !== 'boolean' || !indexOrNull(row.membership.page)
      || !indexOrNull(row.membership.page_count, 1) || !refs(row.membership.unloaded_refs)
      || !refs(row.membership.unbound_local_entity_ids) || row.torus_takes !== undefined && !torusTakes(row.torus_takes)
      || row.torus_comp !== undefined && !torusComp(row.torus_comp)
      || row.made_of !== undefined && !madeOf(row.made_of)) return false;
    if (row.local_scene_id !== null) {if (local.has(row.local_scene_id)) return false; local.add(row.local_scene_id)}
    if (row.material.available) {
      if (!text(row.local_scene_id) || !pacing(row.working) || row.material.reason !== null
        || !['present', 'absent'].includes(String(row.snapshot.availability))) return false;
    } else if (row.working !== null || !text(row.material.reason) || row.snapshot.availability !== 'unavailable'
      || row.snapshot.standing !== null || row.snapshot.duration !== null) return false;
    if (!(row.snapshot.duration === null || finite(row.snapshot.duration) && row.snapshot.duration >= 1 && row.snapshot.duration <= 3600)
      || !(row.snapshot.standing === null || ['Draft', 'Saved', 'Edited since save'].includes(String(row.snapshot.standing)))
      || !row.membership.complete && row.snapshot.standing !== null) return false;
    const unloaded: string[] = [];
    for (const [memberIndex, member] of row.members.entries()) {
      if (!object(member) || member.entity_ref !== row.member_refs[memberIndex]
        || !(member.local_entity_id === null || text(member.local_entity_id))) return false;
      if (member.state === 'loaded') {
        if (!text(member.local_entity_id) || !object(member.occurrence) || member.occurrence.entity_ref !== member.entity_ref
          || member.occurrence.view_entity_id !== member.local_entity_id) return false;
      } else if (member.state === 'unloaded' || member.state === 'absent') {
        if (member.occurrence !== null) return false;
        if (member.state === 'unloaded') unloaded.push(member.entity_ref as string);
      } else return false;
    }
    if (!equalRefs(unloaded, row.membership.unloaded_refs)) return false;
    if (row.membership.complete) {
      if (!text(row.local_scene_id) || unloaded.length || row.membership.unbound_local_entity_ids.length || row.membership.reason !== null) return false;
    } else if (!text(row.membership.reason)) return false;
  }
  if (value.completeness.material && value.scenes.some(row => !(row as {material: {available: boolean}}).material.available)
    || value.completeness.occurrences && value.scenes.some(row => !(row as {membership: {complete: boolean}}).membership.complete)) return false;
  const sceneRows=value.scenes as Record<string,unknown>[];
  for (const [kind,timing] of Object.entries({working:value.timing.working,saved:value.timing.saved})) {
    if (!object(timing) || typeof timing.available !== 'boolean') return false;
    if (timing.available) {
      if (!value.completeness.order || !value.completeness.material || !finite(timing.total_seconds) || timing.total_seconds < 0
        || !Array.isArray(timing.extents) || timing.extents.length > 64) return false;
      const expected=value.working_order.filter(ref=>kind==='working'||(sceneRows.find(row=>row.scene_ref===ref)?.snapshot as {availability:string}|undefined)?.availability==='present');
      if(timing.extents.length!==expected.length)return false;
      const seen = new Set<string>();let cursor=0;
      for (const [index,extent] of timing.extents.entries()) {
        if (!object(extent) || !text(extent.scene_ref) || !native.has(extent.scene_ref) || seen.has(extent.scene_ref)
          || !finite(extent.start_seconds) || extent.start_seconds < 0
          || !pacing({duration: extent.duration_seconds, transition: extent.transition_seconds})
          || extent.scene_ref!==expected[index]||extent.start_seconds!==cursor) return false;
        const row=sceneRows.find(row=>row.scene_ref===extent.scene_ref)!;
        const duration=kind==='working'?(row.working as {duration:number}).duration:(row.snapshot as {duration:number}).duration;
        if(extent.duration_seconds!==duration)return false;
        cursor+=extent.duration_seconds as number;
        seen.add(extent.scene_ref);
      }
      if(!Number.isFinite(cursor)||cursor!==timing.total_seconds)return false;
    } else if (!text(timing.reason) || !refs(timing.missing_scene_refs, 64) || !timing.missing_scene_refs.every(ref => native.has(ref))
      || !refs(timing.unbound_local_scene_ids, 64)) return false;
  }
  return true;
}
