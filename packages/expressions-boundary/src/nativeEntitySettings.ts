/** Object-level Name, Lock and Enabled edits (inspector.ts entityControls, the
 * name, lock and enabled rows above Position). The reducer lives in
 * nativeDeviceEdits.ts; this module owns only the closed key set, the per-key
 * value types and the lock rule. */
import type {NativeEntitySettingChange} from './editor';

/** Model limit for Entity.name (model.ts entity validation: str(e.name, 160)). */
export const ENTITY_SETTING_NAME_LIMIT = 160;
export const ENTITY_SETTING_KEYS = ['name', 'locked', 'enabled'] as const;
/** A locked entity refuses every object edit except its own lock (app.ts entity
 * bind guard: `path!=='entity.locked'`). Name and Enabled therefore refuse on a
 * locked entity, exactly as the app inspector does. */
export const ENTITY_SETTING_EXEMPT_FROM_LOCK: readonly (typeof ENTITY_SETTING_KEYS)[number][] = ['locked'];

/** Closed shape check. Entity existence and the lock rule need the Scene, so the
 * reducer checks them; this only admits an exact key with its exact value type. */
export function validateNativeEntitySettingChange(change: unknown): NativeEntitySettingChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted native object setting and value.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'entity_id', 'key', 'value'].includes(key))) throw Error('An object setting belongs only to its own object; foreign operands were retained.');
  if (row.kind !== 'entity-setting' || typeof row.entity_id !== 'string' || !row.entity_id) throw Error('Choose an admitted native object setting and value.');
  const name = row.value;
  const valid = row.key === 'name' ? typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= ENTITY_SETTING_NAME_LIMIT
    : row.key === 'locked' || row.key === 'enabled' ? typeof row.value === 'boolean'
    : false;
  if (!valid) throw Error('Choose an admitted native object setting and value.');
  return change as NativeEntitySettingChange;
}
