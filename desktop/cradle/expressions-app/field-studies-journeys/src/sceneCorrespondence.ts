/** Exact occurrence correspondence for the existing authoring Scene carrier.
 * Only presentation-local reference fields are translated. Source identities,
 * captions, evidence and native original snapshots are not string-rewritten.
 * Filtering is a rendering disclosure; the untouched whole stays in the native
 * document and is merged back when this working page is saved.
 */
import {clone, type Scene, type Entity} from './model.js';

type RecordValue = Record<string, any>;
const record = (value: unknown): value is RecordValue =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function mapSceneOccurrences(
  input: Scene,
  sceneId: string,
  refs: ReadonlyMap<string, string>,
  visible?: ReadonlySet<string>,
): Scene {
  const scene = clone(input);
  const map = (id: string): string => refs.get(id) ?? id;
  const keep = (id: unknown): boolean => typeof id !== 'string' || !visible || visible.has(id);
  scene.id = sceneId;
  // Keep the whole constraint even on a paged view; only occurrence IDs map.
  if(scene.composition.blueprint)scene.composition.blueprint.members=scene.composition.blueprint.members.map(member=>({...member,entity_ref:map(member.entity_ref)}));
  scene.entities = scene.entities.filter(entity => keep(entity.id)).map(entity => {
    const id = map(entity.id);
    // Embedded native entity parameters still address this exact occurrence.
    return {...entity, id, ...(entity.native ? {native: {...entity.native, id}} : {})};
  });
  for (const key of ['automation', 'propertyTracks', 'toolbelt'] as const) {
    const values = scene[key];
    if (Array.isArray(values)) (scene as unknown as RecordValue)[key] = values
      .filter(value => keep((value as RecordValue).entityId))
      .map(value => typeof (value as RecordValue).entityId === 'string'
        ? {...value, entityId: map((value as RecordValue).entityId)} : value);
  }
  if (scene.research) {
    scene.research.cards=Object.fromEntries(Object.entries(scene.research.cards).filter(([id])=>keep(id)).map(([id,card])=>[map(id),card]));
  }
  if (scene.semanticField) {
    scene.semanticField.bindings = scene.semanticField.bindings.map(binding => ({
      ...binding,
      carriers: binding.carriers.filter(carrier => carrier.kind !== 'entity' || keep(carrier.id))
        .map(carrier => carrier.kind === 'entity' ? {...carrier, id: map(carrier.id)} : carrier),
    })).filter(binding => binding.carriers.length > 0);
  }
  if (scene.native) {
    for (const key of ['config', 'projection'] as const) {
      const native = scene.native[key] as unknown as RecordValue | undefined;
      if (!native) continue;
      if (Array.isArray(native.entities)) native.entities = native.entities
        .filter(entity => keep(entity.id)).map(entity => ({...entity, id: map(entity.id)}));
      // Native automation uses entityId when it is occurrence-bound. No
      // arbitrary graph/source strings or positional indices are readdressed.
      if (Array.isArray(native.automation)) native.automation = native.automation
        .filter(value => keep(value.entityId)).map(value => typeof value.entityId === 'string'
          ? {...value, entityId: map(value.entityId)} : value);
    }
  }
  return scene;
}

/** Merge the edited loaded page with the material that was not loaded.
 * Removing a visible formation hides its presentation, not its source/member.
 * A deliberate native membership removal is a separate constructive Action.
 */
export function mergeScenePage(whole: Scene, edited: Scene, loaded: ReadonlySet<string>): Scene {
  const result = clone(edited);
  const hidden = whole.entities.filter(entity => !loaded.has(entity.id));
  // Removing an optional whole-level carrier while only one page is loaded
  // must not discard the unseen occurrences' controls or native parameters.
  // Preserve the authored proposal but require whole-context reconciliation.
  if (hidden.length && ((whole.semanticField && !result.semanticField) || (whole.native && !result.native))) {
    throw new Error('A hidden member page still uses this carrier; retain it or reconcile the whole before removing it');
  }
  const selected = new Map(result.entities.map(entity => [entity.id, entity]));
  const retained = new Map(hidden.map(entity => [entity.id, entity]));
  // Keep the authored visible order and preserve every unloaded occurrence.
  result.entities = [...result.entities, ...hidden.filter(entity => !selected.has(entity.id))];
  const unseen = (value: RecordValue): boolean => typeof value.entityId === 'string' && retained.has(value.entityId);
  for (const key of ['automation', 'propertyTracks', 'toolbelt'] as const) {
    const older = whole[key];
    if (!Array.isArray(older)) continue;
    const current = result[key] ?? [];
    const ids = new Set(current.map(value => value.id));
    (result as unknown as RecordValue)[key] = [...current, ...older.filter(value => unseen(value as RecordValue) && !ids.has(value.id))];
  }
  if (whole.research) {
    if(!result.research&&hidden.some(entity=>whole.research!.cards[entity.id]))throw new Error('Hidden research cards still need their material; retain the carrier');
    if(result.research)for(const [id,card] of Object.entries(whole.research.cards))if(retained.has(id)&&!result.research.cards[id])result.research.cards[id]=clone(card);
  }
  if (whole.semanticField && result.semanticField) {
    const bindings = result.semanticField.bindings;
    for (const original of whole.semanticField.bindings) {
      const carriers = original.carriers.filter(carrier => carrier.kind === 'entity' && retained.has(carrier.id));
      if (!carriers.length) continue;
      const found = bindings.find(binding => binding.id === original.id);
      if (found) found.carriers.push(...carriers.filter(carrier => !found.carriers.some(value => value.kind === carrier.kind && value.id === carrier.id)));
      else bindings.push({...clone(original), carriers});
    }
  }
  if (whole.native && result.native) {
    for (const key of ['config', 'projection'] as const) {
      const before = whole.native[key] as unknown as RecordValue | undefined;
      const after = result.native[key] as unknown as RecordValue | undefined;
      if (!before || !after) continue;
      if (Array.isArray(before.entities) && Array.isArray(after.entities)) {
        const present = new Set(after.entities.map(entity => entity.id));
        after.entities.push(...before.entities.filter(entity => retained.has(entity.id) && !present.has(entity.id)));
      }
    }
  }
  return result;
}

/** Validate the data-only boundary before giving media to the renderer.
 * Native Actions enforce this again at persistence. No ambient URL requests,
 * executable properties, prototype keys or invented carrier kinds are admitted.
 */
export function validateSceneData(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('Scene material exceeds the native nesting budget');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite Scene material');
  if (Array.isArray(value)) {
    if (value.length > 4096) throw new Error('Scene material array exceeds the native budget');
    for (const item of value) validateSceneData(item, depth + 1);
  } else if (record(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe Scene material key');
      if (key === 'dataUrl' && (typeof item !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item)
        || item.slice(item.indexOf(',') + 1).length % 4 !== 0)) {
        throw new Error('Scene images require embedded PNG/JPEG/WebP data, not an ambient URL');
      }
      validateSceneData(item, depth + 1);
    }
  }
}

export function assertMaterialOccurrences(material: Scene, sceneRef: string, members: readonly string[]): void {
  validateSceneData(material);
  if (!material || material.id !== sceneRef || !Array.isArray(material.entities)) throw new Error('Scene material addresses a different native Scene');
  const seen = new Set<string>();
  for (const entity of material.entities as Entity[]) {
    if (!members.includes(entity.id) || seen.has(entity.id)) throw new Error('Scene material contains an undisclosed or duplicate occurrence');
    seen.add(entity.id);
  }
}

/** Wire equality is independent of object insertion order (serde_json may
 * canonicalise keys). Arrays retain order; omitted optional fields compare
 * as they will actually cross JSON, so an acknowledgement is not a new edit. */
export function sameSceneData(a:unknown,b:unknown):boolean {
 const canonical=(value:unknown):string=>{
  if(Array.isArray(value))return '['+value.map(item=>canonical(item??null)).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';
  return JSON.stringify(value)??'null';
 };
 return canonical(a)===canonical(b);
}
