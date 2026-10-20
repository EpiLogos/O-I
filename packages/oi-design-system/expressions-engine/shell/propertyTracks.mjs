import { baseValue, entityTargets, nativeBinding } from "./nativeParameters.mjs";
import { clone } from "./model.mjs";
const interpolations = /* @__PURE__ */ new Set(["linear", "hold", "smooth", "bezier"]);
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
      if (p.type !== void 0 && !interpolations.has(p.type)) throw new Error("Invalid property keyframe interpolation");
      for (const h of [p.out, p.in]) if (h !== void 0 && (!h || !Number.isFinite(h.dt) || !Number.isFinite(h.dv))) throw new Error("Invalid property keyframe handle");
      last = p.time;
    }
  }
  return clone(value);
}
function segmentValue(a, b, time) {
  switch (a.type) {
    case "hold":
      return a.value;
    case "smooth": {
      const s = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * (s * s * (3 - 2 * s));
    }
    case "bezier":
      return bezierValue(a, b, time);
    default:
      return a.value + (b.value - a.value) * (time - a.time) / (b.time - a.time);
  }
}
function segmentControls(a, b, smooth = false) {
  const span = b.time - a.time, rise = b.value - a.value;
  const o = smooth ? { dt: span / 3, dv: 0 } : a.out ?? { dt: span / 3, dv: rise / 3 };
  const n = smooth ? { dt: -span / 3, dv: 0 } : b.in ?? { dt: -span / 3, dv: -rise / 3 };
  const x1 = a.time + Math.min(span, Math.max(0, o.dt)), x2 = Math.max(x1, b.time + Math.max(-span, Math.min(0, n.dt)));
  return [{ x: a.time, y: a.value }, { x: x1, y: a.value + o.dv }, { x: x2, y: b.value + n.dv }, { x: b.time, y: b.value }];
}
const cubic = (p0, p1, p2, p3, u) => {
  const v = 1 - u;
  return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
};
function curveParameter(c, t) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if (cubic(c[0].x, c[1].x, c[2].x, c[3].x, mid) < t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function bezierValue(a, b, time) {
  if (time <= a.time) return a.value;
  const c = segmentControls(a, b);
  return cubic(c[0].y, c[1].y, c[2].y, c[3].y, curveParameter(c, time));
}
function valueAt(points, time) {
  if (!points.length || time < points[0].time) return void 0;
  let i = points.findIndex((p) => p.time > time);
  if (i < 0) return points.at(-1).value;
  return segmentValue(points[i - 1], points[i], time);
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
function evaluateTracks(s, time, channels) {
  if (!s.propertyTracks?.length) return s;
  const out = { ...s, field: { ...s.field, params: { ...s.field.params } }, entities: s.entities.map((e) => ({ ...e, position: { ...e.position }, size: { ...e.size }, force: { ...e.force }, sequence: { ...e.sequence } })) };
  const evolution = time + (s.entryOffset ?? 0);
  for (const t of out.propertyTracks) {
    if (channels && !channelApplies(t.id, channels)) continue;
    const value = valueAt(t.points, evolution);
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
function channelApplies(id, state) {
  return !state.mute.has(id) && (state.solo.size === 0 || state.solo.has(id));
}
function channelRange(s, t) {
  if (t.bind.startsWith("field.params.")) {
    const b2 = nativeBinding(t.bind.slice(13));
    return b2 ? { label: b2.label, min: b2.hardMin, max: b2.hardMax } : void 0;
  }
  const b = entityTargets(s).find((v) => v.entityId === t.entityId && v.bind === t.bind);
  return b ? { label: b.label, min: b.hardMin, max: b.hardMax } : void 0;
}
function touchesOfKey(points, index) {
  const touched = [{ key: index }];
  if (index < points.length - 1 && points[index].out) touched.push({ handle: index, end: "out" });
  if (index > 0 && points[index].in) touched.push({ handle: index, end: "in" });
  return touched;
}
function validateCurveEdit(points, range, touched) {
  const outOfOrder = points.findIndex((p, i) => i > 0 && Number.isFinite(p.time) && Number.isFinite(points[i - 1].time) && p.time <= points[i - 1].time);
  if (outOfOrder > 0) throw new Error("Keyframes stay in time order.");
  validateTracks([{ id: "curve", bind: "field.params.curve", points }]);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i < points.length - 1 && p.out) {
      const span = points[i + 1].time - p.time;
      if (p.out.dt < 0 || p.out.dt > span) throw new Error("Handle time must stay inside its segment");
    }
    if (i > 0 && p.in) {
      const span = p.time - points[i - 1].time;
      if (p.in.dt < -span || p.in.dt > 0) throw new Error("Handle time must stay inside its segment");
    }
  }
  const within = (v) => !range || v >= range.min && v <= range.max, limit = range ? ` (${range.min} to ${range.max})` : "";
  const scope = touched ?? points.flatMap((_, i) => touchesOfKey(points, i));
  for (const t of scope) {
    if ("key" in t) {
      const p2 = points[t.key];
      if (p2 && !within(p2.value)) throw new Error(`Keyframe value is outside the channel range${limit}`);
      continue;
    }
    const p = points[t.handle];
    if (!p) continue;
    if (t.end === "out") {
      if (t.handle < points.length - 1 && p.out && !within(p.value + p.out.dv)) throw new Error(`Handle value is outside the channel range${limit}`);
    } else if (t.handle > 0 && p.in && !within(p.value + p.in.dv)) throw new Error(`Handle value is outside the channel range${limit}`);
  }
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
  channelApplies,
  channelRange,
  curveParameter,
  evaluateTracks,
  expressionTiming,
  mergeTake,
  readTrackValue,
  sampleTrack,
  segmentControls,
  touchesOfKey,
  validateCurveEdit,
  validateTracks,
  valueAt
};
