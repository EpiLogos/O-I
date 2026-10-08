import {EDITOR_CHANNEL, type NativeEditorController, type NativeEditorReading, type NativeEditorReply} from './editor.ts';
import type {ExpressionsHost} from './host.ts';
import type {HostTarget} from './protocol.ts';
import {isNativeScenesReading} from './scenesValidation';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const coordinates = (value: unknown) => object(value) && ['x','y','z'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** A chosen control is an owner reading, with an exact entry/target relation.
 * Do not admit plausible controls that are detached from the retained list. */
function chosenControls(value: unknown, scene: Record<string, unknown>, selection: Record<string, unknown>, occurrences: Record<string, unknown>): boolean {
  if (!object(value) || typeof value.available !== 'boolean' || !Array.isArray(value.entries) || !Array.isArray(value.controls)
    || value.entries.length !== value.controls.length || !value.available && value.entries.length !== 0) return false;
  const entries: unknown[] = value.entries, rows: unknown[] = value.controls;
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!object(entry) || !text(entry.id) || ids.has(entry.id) || !text(entry.key)
      || typeof entry.scope !== 'string' || !['field','selected','named'].includes(entry.scope)
      || entry.scope === 'named' && ![entry.entityId,entry.sceneId,entry.journeyId].every(text)) return false;
    ids.add(entry.id);
  }
  const controls = new Set<string>();
  return rows.every(control => {
    if (!object(control) || !text(control.entry_id) || controls.has(control.entry_id) || !ids.has(control.entry_id)
      || typeof control.locked !== 'boolean') return false;
    controls.add(control.entry_id);
    const entry = entries.find(entry => object(entry) && entry.id === control.entry_id) as Record<string, unknown>;
    if (control.target === null) return control.binding === null && control.entity_id === null && control.native_ref === null
      && control.base_value === null && control.effective_value === null && !control.locked && text(control.unavailable_reason);
    const binding = control.binding;
    if (!text(control.target) || !object(binding) || binding.key !== entry.key || control.unavailable_reason !== null
      || !['path','key','bind','label','group'].every(key => text(binding[key]))
      || !['factor','min','max','hardMin','hardMax','step','defaultValue'].every(key => finite(binding[key]))
      || (binding.factor as number) <= 0 || (binding.step as number) <= 0
      || (binding.hardMin as number) > (binding.min as number) || (binding.min as number) > (binding.max as number)
      || (binding.max as number) > (binding.hardMax as number)
      || !(binding.unit === undefined || typeof binding.unit === 'string')
      || !(binding.scale === undefined || binding.scale === 'linear' || binding.scale === 'log')
      || !finite(control.base_value) || !(control.effective_value === null || finite(control.effective_value))) return false;
    if (entry.scope === 'field') return control.target === 'field.' + entry.key && control.entity_id === null && control.native_ref === null;
    if (!text(control.entity_id) || !text(control.native_ref) || occurrences[control.entity_id] !== control.native_ref
      || !(scene.entities as unknown[]).some(entity => object(entity) && entity.id === control.entity_id)
      || control.target !== 'entity:' + encodeURIComponent(control.entity_id) + ':' + entry.key) return false;
    return entry.scope === 'named' ? entry.entityId === control.entity_id : (selection.entity_ids as unknown[])[0] === control.entity_id;
  });
}
function reading(value: unknown): value is NativeEditorReading {
  if (!object(value) || !object(value.basis) || !object(value.scene) || !object(value.history)
    || !object(value.selection) || !object(value.standing) || !object(value.entityOccurrences)) return false;
  const {basis: b, scene, history, selection, standing} = value;
  if (!text(b.expression_ref) || !b.expression_ref.startsWith('expression:') || !revision(b.revision)
    || !text(b.scene_ref) || !revision(b.authored_revision) || !text(scene.id) || typeof scene.name !== 'string'
    || !object(scene.engine) || !object(scene.field) || !object(scene.field.params) || !object(scene.composition)
    || !object(scene.morph) || !Array.isArray(scene.entities) || !Array.isArray(selection.entity_ids)
    || !selection.entity_ids.every(text) || !(selection.step_id === null || text(selection.step_id))
    || typeof history.canUndo !== 'boolean' || typeof history.canRedo !== 'boolean'
    || typeof standing.dirty !== 'boolean' || typeof standing.pending !== 'boolean'
    || !(standing.notice === null || typeof standing.notice === 'string')
    || !Object.values(value.entityOccurrences).every(text)
    || !chosenControls(value.chosenControls,scene,selection,value.entityOccurrences)
    || value.scenes !== undefined && !isNativeScenesReading(value.scenes,{expression_ref:b.expression_ref,revision:b.revision,scene_ref:b.scene_ref})) return false;
  if (value.playback !== undefined && (!object(value.playback) || value.playback.scene_ref !== b.scene_ref
    || !revision(value.playback.intent_epoch) || !finite(value.playback.scene_elapsed_seconds) || value.playback.scene_elapsed_seconds < 0
    || !finite(value.playback.expression_time_seconds) || value.playback.expression_time_seconds < 0
    || !['scene_playing','saved_sequence_playing','field_paused','track_preview'].every(key => typeof (value.playback as Record<string,unknown>)[key] === 'boolean'))) return false;
  if (value.nativeSelection !== undefined && (!object(value.nativeSelection) || !text(value.nativeSelection.scene_ref)
    || !(value.nativeSelection.entity_ref === null || text(value.nativeSelection.entity_ref))
    || value.nativeSelection.relation_ref != null && !text(value.nativeSelection.relation_ref)
    || value.scenes !== undefined && value.nativeSelection.scene_ref !== (value.scenes as unknown as {native_selected_scene_ref: string | null}).native_selected_scene_ref)) return false;
  return scene.entities.every(e => object(e) && text(e.id) && typeof e.name === 'string'
    && coordinates(e.position) && object(e.size) && typeof e.size.x === 'number' && typeof e.size.y === 'number'
    && object(e.force) && text(e.force.kind) && object(e.sequence) && typeof e.sequence.enabled === 'boolean'
    && Array.isArray(e.sequence.steps) && e.sequence.steps.every(step => object(step) && text(step.id)
      && typeof step.text === 'string' && text(step.shape) && typeof step.hold === 'number' && Number.isFinite(step.hold)
      && typeof step.transition === 'number' && Number.isFinite(step.transition)
      && (step.position === null || coordinates(step.position))));
}

/** Uses the already mounted and admitted frame. It owns no document or transport. */
export function createNativeEditorClient(host: ExpressionsHost, messages: EventTarget = window): NativeEditorController {
  const token = crypto.randomUUID();
  let alive = true, current: NativeEditorReading | null = null, admitted: HostTarget | null = null;
  const listeners = new Set<(value: NativeEditorReading | null) => void>();
  const pending = new Map<string, {target: HostTarget; read: boolean; resolve: (reply: NativeEditorReply) => void; timer: ReturnType<typeof setTimeout>}>();
  const deliver = (listener: (value: NativeEditorReading | null) => void, value: NativeEditorReading | null) => {
    try {listener(value)} catch {/* A presentation fault cannot change or strand an owning operation. */}
  };
  const notify = (value: NativeEditorReading | null) => {
    current = value;
    for (const listener of [...listeners]) deliver(listener,value);
  };
  const sameSubject = (a: HostTarget['scene'], b: HostTarget['scene']) => a.expression_ref === b.expression_ref && a.scene_ref === b.scene_ref;
  const adoptable = (target: HostTarget, value: NativeEditorReading) => {
    const now = host.readOutcomeTarget(target);
    if (!now || !sameSubject(target.scene,now.scene) || value.basis.expression_ref !== now.scene.expression_ref
      || value.basis.scene_ref !== now.scene.scene_ref || value.basis.revision < now.scene.revision) return false;
    return !current || current.basis.expression_ref !== value.basis.expression_ref || current.basis.scene_ref !== value.basis.scene_ref
      || value.basis.revision >= current.basis.revision && value.basis.authored_revision >= current.basis.authored_revision;
  };
  const matches = (data: Record<string, unknown>, target: HostTarget) => data.bindingId === target.bindingId && data.epoch === target.epoch;
  const receive = (event: Event) => {
    const e = event as MessageEvent;
    if (!alive || e.source !== host.frame.contentWindow || e.origin !== host.origin) return;
    const data: unknown = e.data;
    if (!object(data) || data.schema !== EDITOR_CHANNEL || data.token !== token) return;
    if (data.kind === 'reading') {
      if (admitted && matches(data,admitted) && reading(data.reading) && adoptable(admitted,data.reading)) notify(data.reading);
      return;
    }
    if (data.kind !== 'result' || typeof data.req !== 'string') return;
    const p = pending.get(data.req);
    if (!p) return;
    clearTimeout(p.timer); pending.delete(data.req);
    if (!matches(data,p.target) || !host.readOutcomeTarget(p.target)) {
      p.resolve({ok:false,error:'The editor carrier belongs to a replaced host epoch; the native outcome is unresolved here'}); return;
    }
    if (!object(data.reply) || typeof data.reply.ok !== 'boolean' || !data.reply.ok && typeof data.reply.error !== 'string') {
      p.resolve({ok:false,error:'Invalid native editor outcome'}); return;
    }
    const reply = data.reply as unknown as NativeEditorReply;
    if (reply.reading !== undefined && !reading(reply.reading)) {
      p.resolve({ok:false,error:'Invalid native editor readback'}); return;
    }
    if (reply.ok && !reply.reading) {p.resolve({ok:false,error:'The owner omitted its editor readback'}); return}
    const adopt = !!reply.reading && adoptable(p.target,reply.reading);
    if (p.read && reply.ok && adopt) admitted = p.target;
    // The exact owner outcome remains true when selection or visibility changes.
    // Only a current reading enters presentation. Settle independently of listeners.
    p.resolve(reply);
    if (adopt && reply.reading) notify(reply.reading);
  };
  messages.addEventListener('message',receive);
  const replaced = () => {
    admitted = null;
    for (const p of pending.values()) {clearTimeout(p.timer); p.resolve({ok:false,error:'The retained application reloaded; its previous native outcomes are unresolved here'})}
    pending.clear();
    notify(null);
  };
  const loaded = () => {
    // The first iframe load may complete the same boot epoch. The host is the
    // authoritative lifetime owner; only a replaced epoch retires these requests.
    if (admitted && host.readOutcomeTarget(admitted) || [...pending.values()].some(p => host.readOutcomeTarget(p.target))) return;
    replaced();
  };
  host.frame.addEventListener('load',loaded);
  return {
    request(request) {
      if (!alive) return Promise.resolve({ok:false,error:'This editor was disposed'});
      let target: HostTarget;
      try {
        target = host.captureTarget();
        if (request.operation !== 'read') {
          if (!admitted || !host.readOutcomeTarget(admitted) || !sameSubject(admitted.scene,target.scene)) throw Error('Read the current native editor before applying an operation');
          if (request.basis.expression_ref !== target.scene.expression_ref || request.basis.scene_ref !== target.scene.scene_ref
            || request.basis.revision !== target.scene.revision) throw Error('The captured native scene changed; retain the draft and refresh');
        }
      } catch (cause) {return Promise.resolve({ok:false,error:cause instanceof Error ? cause.message : String(cause)})}
      const req = crypto.randomUUID();
      return new Promise<NativeEditorReply>(resolve => {
        const timer = setTimeout(() => {pending.delete(req); resolve({ok:false,error:'The native editor did not acknowledge this operation; the result is unresolved'})},30000);
        pending.set(req,{target,read:request.operation === 'read',resolve,timer});
        try {host.frame.contentWindow!.postMessage({schema:EDITOR_CHANNEL,kind:'request',token,req,bindingId:target.bindingId,epoch:target.epoch,request},host.origin)}
        catch (cause) {clearTimeout(timer);pending.delete(req);resolve({ok:false,error:`The native editor request was not delivered: ${cause instanceof Error ? cause.message : String(cause)}`})}
      });
    },
    subscribe(listener) {
      if (!alive) {deliver(listener,null);return () => {}}
      listeners.add(listener);deliver(listener,current);return () => {listeners.delete(listener)};
    },
    dispose() {
      if (!alive) return;
      alive = false;
      messages.removeEventListener('message',receive);host.frame.removeEventListener('load',loaded);
      try {replaced()} finally {listeners.clear()}
    },
  };
}
