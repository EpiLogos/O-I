/** Reference-only Canvas continuity. This never carries source contents or a
 * Graph reading; native owners retain both. Shared by the surface codec and
 * the receiving adapter so restoration has the same admission as opening. */
const object = value => !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const keys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
function json(value, depth = 0, seen = new Set()) {
  if (depth > 16) throw Error('Native Return is too deep');
  if (value === null || typeof value === 'boolean' || typeof value === 'string' && value.length <= 16384 || typeof value === 'number' && Number.isFinite(value)) return value;
  if ((!Array.isArray(value) && !object(value)) || seen.has(value)) throw Error('Native Return is not bounded JSON');
  seen.add(value);
  const result = Array.isArray(value) ? value.map(entry => json(entry, depth + 1, seen)) : Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (key.length > 256 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Invalid Return key');
    return [key, json(entry, depth + 1, seen)];
  }));
  seen.delete(value);
  return result;
}
export function validateNativeKnowledgeContext(raw) {
  try {
    if (!object(raw) || !keys(raw, ['subject_ref','native_owner','register','origin','source_basis','returnTo'])) return null;
    const result = {};
    for (const key of ['subject_ref','native_owner','register']) if (raw[key] !== undefined) {
      if (!text(raw[key])) return null;
      result[key] = raw[key];
    }
    if ((result.subject_ref === undefined) !== (result.native_owner === undefined)) return null;
    if (raw.origin !== undefined) {if (raw.origin !== 'canvas') return null; result.origin = raw.origin;}
    if (raw.source_basis !== undefined) {
      const basis = raw.source_basis;
      if (!object(basis) || !keys(basis, ['expression_ref','revision','scene_ref','entity_ref']) || !text(basis.expression_ref) || !text(basis.scene_ref) || !Number.isSafeInteger(basis.revision) || basis.revision < 1 || basis.entity_ref !== undefined && basis.entity_ref !== null && !text(basis.entity_ref)) return null;
      result.source_basis = {...basis};
    }
    if (raw.returnTo !== undefined) {
      const target=raw.returnTo;
      if (!object(target) || !keys(target,['bindingId','expression_ref','scene_ref','mode','selection','step_id','camera']) || !text(target.bindingId) || !text(target.expression_ref) || !text(target.scene_ref) || !['expressions','techne'].includes(target.mode) || !Array.isArray(target.selection) || target.selection.length>10000 || !target.selection.every(text) || target.step_id!==null&&!text(target.step_id) || target.camera!==undefined&&!object(target.camera)) return null;
      if (result.source_basis && (target.expression_ref!==result.source_basis.expression_ref || target.scene_ref!==result.source_basis.scene_ref)) return null;
      result.returnTo = json(raw.returnTo);
      if (JSON.stringify(result.returnTo).length > 65536) return null;
    }
    if (result.origin === 'canvas') {
      if (!result.subject_ref || !result.native_owner || !result.source_basis || !result.returnTo || !Object.hasOwn(result.source_basis,'entity_ref')) return null;
      const selected=result.source_basis.entity_ref;
      if (selected===null ? result.returnTo.selection.length!==0 : result.returnTo.selection.length!==1 || result.returnTo.selection[0]!==selected) return null;
    }
    return result;
  } catch {return null;}
}
