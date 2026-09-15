import { baseValue, entityTargets, nativeBinding } from "./nativeParameters.mjs";
import { clone } from "./model.mjs";
const safePath = /^(field\.params\.[A-Za-z0-9_]+|entity\.(position\.[xyz]|scale|tintWeight|force\.(strength|radius|spin)|sequence\.(hold|transition|rateMul|phaseOffset)))$/;
function validateTracks(value) {
  if (!Array.isArray(value) || value.length > 2048) throw new Error("Invalid property tracks");
  const ids = /* @__PURE__ */ new Set(), targets = /* @__PURE__ */ new Set();
  for (const t of value) {
    if (!t || typeof t.id !== "string" || (!safePath.test(t.bind) || t.bind.split(".").some((k) => ["__proto__", "prototype", "constructor"].includes(k))) || t.bind.startsWith("entity.") && typeof t.entityId !== "string" || !Array.isArray(t.points) || t.points.length > 72e3) throw new Error("Invalid property track");
    const target = t.bind + ":" + (t.entityId ?? "");
    if (ids.has(t.id) || targets.has(target)) throw new Error("Duplicate property track");
    ids.add(t.id);
    targets.add(target);
    let last = -1;
    for (const p of t.points) {
      if (!p || !Number.isFinite(p.time) || p.time < 0 || p.time > 3600 || p.time <= last || !Number.isFinite(p.value)) throw new Error("Invalid property keyframe");
      last = p.time;
    }
  }
  return clone(value);
}
function valueAt(points, time) {
  if (!points.length || time < points[0].time) return void 0;
  let i = points.findIndex((p) => p.time > time);
  if (i < 0) return points.at(-1).value;
  const a = points[i - 1], b = points[i];
  return a.value + (b.value - a.value) * (time - a.time) / (b.time - a.time);
}
function readTrackValue(s, t) {
  if (t.bind.startsWith("field.params.")) {
    const key = t.bind.slice(13);
    if (nativeBinding(key)) return baseValue(s, key);
  }
  if (t.bind.startsWith("entity.")) {
    const target = entityTargets(s).find((v) => v.entityId === t.entityId && v.bind === t.bind);
    if (target) return target.value;
  }
  const root = t.bind.startsWith("entity.") ? s.entities.find((e) => e.id === t.entityId) : s;
  const path = t.bind.startsWith("entity.") ? t.bind.slice(7) : t.bind;
  let value = root;
  for (const key of path.split(".")) value = value?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function evaluateTracks(s, time) {
  if (!s.propertyTracks?.length) return s;
  const out = { ...s, field: { ...s.field, params: { ...s.field.params } }, entities: s.entities.map((e) => ({ ...e, position: { ...e.position }, size: { ...e.size }, force: { ...e.force }, sequence: { ...e.sequence } })) };
  for (const t of out.propertyTracks) {
    const value = valueAt(t.points, time);
    if (value === void 0) continue;
    let root = t.bind.startsWith("entity.") ? out.entities.find((e) => e.id === t.entityId) : out;
    const keys = (t.bind.startsWith("entity.") ? t.bind.slice(7) : t.bind).split(".");
    for (const k of keys.slice(0, -1)) root = root?.[k];
    if (root && readTrackValue(s, t) !== void 0) {
      const binding = t.bind.startsWith("field.params.") ? nativeBinding(t.bind.slice(13)) : entityTargets(s).find((v) => v.entityId === t.entityId && v.bind === t.bind);
      root[keys.at(-1)] = binding ? Math.max(binding.hardMin, Math.min(binding.hardMax, value)) : value;
    }
  }
  return out;
}
function mergeTake(existing, take, start, end) {
  const out = clone(existing);
  for (const t of take) {
    const old = out.find((v) => v.bind === t.bind && v.entityId === t.entityId);
    if (!old) {
      out.push(clone(t));
      continue;
    }
    const points = old.points.filter((p) => p.time < start || p.time > end);
    old.points = [...points, ...clone(t.points)].sort((a, b) => a.time - b.time);
  }
  return out;
}
function expressionTiming(j, index, local, savedOnly = false) {
  const duration = (s) => savedOnly ? j.savedScenes?.[s.id]?.duration ?? 0 : s.duration;
  const total = j.scenes.reduce((n, s) => n + duration(s), 0), start = j.scenes.slice(0, index).reduce((n, s) => n + duration(s), 0);
  return { start, total, time: Math.min(total, start + local) };
}
function sampleTrack(track, time, value, previousTime) {
  const last = track.points.at(-1);
  if (!last) {
    track.points.push({ time: previousTime, value });
    return;
  }
  if (last.value === value) return;
  if (previousTime > last.time) track.points.push({ time: previousTime, value: last.value });
  if (time > track.points.at(-1).time) track.points.push({ time, value });
}
export {
  evaluateTracks,
  expressionTiming,
  mergeTake,
  readTrackValue,
  sampleTrack,
  validateTracks,
  valueAt
};
