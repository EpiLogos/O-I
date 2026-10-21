import { channelRange, valueAt, segmentControls } from "./propertyTracks.mjs";
import { esc } from "./icons.mjs";
const PATH_SPACE = 1e3;
const HIT_RADIUS = 8;
const SAMPLES_PER_SEGMENT = 32;
const INTERPOLATIONS = ["hold", "linear", "smooth", "bezier"];
const INTERPOLATION_LABEL = { hold: "Hold", linear: "Linear", smooth: "Smooth", bezier: "Bezier" };
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const fmt = (n) => String(Number(n.toPrecision(4)));
function copyKey(p) {
  const q = { time: p.time, value: p.value };
  if (p.type !== void 0) q.type = p.type;
  if (p.out) q.out = { ...p.out };
  if (p.in) q.in = { ...p.in };
  return q;
}
function channelName(scene, track) {
  return channelRange(scene, track)?.label ?? track.bind;
}
function laneFrame(points, duration, range, width, height) {
  const timeMax = Math.max(1, duration, points.at(-1)?.time ?? 0);
  let lo = 0, hi = 1;
  if (points.length) {
    lo = hi = points[0].value;
    for (const p of points) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
  }
  const span = hi - lo, pad = span > 0 ? span * 0.15 : Math.max(1, Math.abs(hi) * 0.25);
  let valueMin = lo - pad, valueMax = hi + pad;
  if (range && Number.isFinite(range.min) && range.min <= lo && range.min > valueMin) valueMin = range.min;
  if (range && Number.isFinite(range.max) && range.max >= hi && range.max < valueMax) valueMax = range.max;
  return { width, height, timeMax, valueMin, valueMax };
}
function toPixel(frame, time, value) {
  return { x: time / frame.timeMax * frame.width, y: (frame.valueMax - value) / (frame.valueMax - frame.valueMin) * frame.height };
}
function fromPixel(frame, x, y) {
  return { time: x / frame.width * frame.timeMax, value: frame.valueMax - y / frame.height * (frame.valueMax - frame.valueMin) };
}
function shownHandles(points, selected) {
  if (selected === null || selected < 0 || selected >= points.length) return [];
  const shown = [];
  if (selected < points.length - 1 && points[selected].type === "bezier") shown.push({ index: selected, end: "out" }, { index: selected + 1, end: "in" });
  if (selected > 0 && points[selected - 1].type === "bezier") shown.push({ index: selected - 1, end: "out" }, { index: selected, end: "in" });
  return shown;
}
function handlePosition(points, index, end) {
  if (end === "out") {
    const c2 = segmentControls(points[index], points[index + 1]);
    return c2[1];
  }
  const c = segmentControls(points[index - 1], points[index]);
  return c[2];
}
function curveHit(points, frame, selected, x, y, radius = HIT_RADIUS) {
  let key = null;
  for (let i = 0; i < points.length; i++) {
    const q = toPixel(frame, points[i].time, points[i].value), d = Math.hypot(x - q.x, y - q.y);
    if (d <= radius && (!key || d < key.d)) key = { d, index: i };
  }
  if (key) return { kind: "key", index: key.index };
  let handle = null;
  for (const h of shownHandles(points, selected)) {
    const c = handlePosition(points, h.index, h.end), q = toPixel(frame, c.x, c.y), d = Math.hypot(x - q.x, y - q.y);
    if (d <= radius && (!handle || d < handle.d)) handle = { d, hit: { kind: "handle", index: h.index, end: h.end } };
  }
  return handle ? handle.hit : null;
}
function moveKey(points, index, time, value) {
  return points.map((p, i) => {
    const q = copyKey(p);
    if (i === index) {
      q.time = time;
      q.value = value;
    }
    return q;
  });
}
function moveHandle(points, index, end, time, value) {
  const out = points.map(copyKey), anchor = points[index];
  out[index][end] = { dt: time - anchor.time, dv: value - anchor.value };
  return out;
}
function setSegmentType(points, index, type) {
  if (index < 0 || index >= points.length - 1) throw new Error("This keyframe has no segment after it");
  const out = points.map(copyKey), p = out[index];
  if (type === "linear") delete p.type;
  else p.type = type;
  if (type !== "bezier") {
    delete out[index].out;
    delete out[index + 1].in;
  }
  return out;
}
function insertKey(points, time) {
  if (points.some((p) => p.time === time)) throw new Error("A keyframe already sits at this time");
  const out = points.map(copyKey);
  const at = out.findIndex((p) => p.time > time), k = at < 0 ? out.length : at;
  const value = points.length ? valueAt(points, time) ?? points[0].value : 0;
  const fresh = { time, value };
  if (k > 0 && k < out.length) {
    const left = out[k - 1];
    if (left.type !== void 0) fresh.type = left.type;
    delete left.out;
    delete out[k].in;
  }
  out.splice(k, 0, fresh);
  return out;
}
function removeKey(points, index) {
  if (points.length <= 2) throw new Error("A channel keeps at least two keyframes");
  if (index < 0 || index >= points.length) throw new Error("No keyframe is selected");
  const out = points.map(copyKey);
  if (index > 0) delete out[index - 1].out;
  if (index < out.length - 1) delete out[index + 1].in;
  out.splice(index, 1);
  return out;
}
function samplePath(points, frame) {
  if (!points.length) return "";
  const sx = (t) => t / frame.timeMax * PATH_SPACE, sy = (v) => (frame.valueMax - v) / (frame.valueMax - frame.valueMin) * PATH_SPACE;
  const parts = [];
  const put = (cmd, t, v) => parts.push(`${cmd}${sx(t).toFixed(2)} ${sy(v).toFixed(2)}`);
  put("M", points[0].time, points[0].value);
  for (let j = 0; j < points.length - 1; j++) {
    const a = points[j], b = points[j + 1];
    if (a.type === "hold") {
      put("L", b.time, a.value);
      put("L", b.time, b.value);
      continue;
    }
    for (let k = 1; k <= SAMPLES_PER_SEGMENT; k++) {
      const t = k === SAMPLES_PER_SEGMENT ? b.time : a.time + (b.time - a.time) * k / SAMPLES_PER_SEGMENT;
      put("L", t, valueAt(points, t) ?? b.value);
    }
  }
  const last = points.at(-1);
  if (last.time < frame.timeMax) put("L", frame.timeMax, last.value);
  return parts.join(" ");
}
function previewScene(scene, drag) {
  if (!drag?.preview || drag.sceneId !== scene.id || !scene.propertyTracks?.some((t) => t.id === drag.trackId)) return scene;
  const preview = drag.preview.map(copyKey);
  return { ...scene, propertyTracks: scene.propertyTracks.map((t) => t.id === drag.trackId ? { ...t, points: preview } : t) };
}
function channelStateFor(scene, views) {
  const solo = /* @__PURE__ */ new Set(), mute = /* @__PURE__ */ new Set();
  for (const t of scene.propertyTracks ?? []) {
    const v = views(t.id);
    if (v?.solo) solo.add(t.id);
    if (v?.mute) mute.add(t.id);
  }
  return solo.size || mute.size ? { solo, mute } : void 0;
}
function channelPanelHTML(panel) {
  const { scene, selected, views } = panel, tracks = scene.propertyTracks ?? [];
  if (!tracks.length) return "";
  const rows = tracks.map((t) => {
    const v = views(t.id) ?? { solo: false, mute: false, shown: true }, name = esc(channelName(scene, t)), id = esc(t.id), on = selected?.trackId === t.id;
    return `<div class="curve-channel${on ? " is-selected" : ""}"><button type="button" class="curve-name" data-action="curve-select" data-track-id="${id}" aria-pressed="${on}">${name}<small>${t.points.length} keys</small></button><button type="button" class="curve-toggle" data-action="curve-solo" data-track-id="${id}" aria-pressed="${v.solo}" aria-label="Solo ${name}" title="Solo: only soloed channels play">S</button><button type="button" class="curve-toggle" data-action="curve-mute" data-track-id="${id}" aria-pressed="${v.mute}" aria-label="Mute ${name}" title="Mute: this channel does not play">M</button><button type="button" class="curve-toggle curve-eye" data-action="curve-show" data-track-id="${id}" aria-pressed="${v.shown}" aria-label="${v.shown ? "Hide" : "Show"} curve ${name}" title="${v.shown ? "Hide the curve" : "Show the curve"}">${EYE}</button></div>`;
  }).join("");
  const track = selected ? tracks.find((t) => t.id === selected.trackId) : void 0;
  const lane = track && track.points.length && (views(track.id)?.shown ?? true) ? curveLaneHTML(scene, track, selected.index) : "";
  return `<div class="curve-channels" aria-label="Channels">${rows}</div>${lane}`;
}
function curveLaneHTML(scene, track, selectedIndex) {
  const id = esc(track.id), name = esc(channelName(scene, track)), frame = laneFrame(track.points, scene.duration, channelRange(scene, track), 100, 100);
  const keys = track.points.map((p, i) => {
    const q = toPixel(frame, p.time, p.value);
    return `<span class="curve-key${i === selectedIndex ? " is-selected" : ""}" data-key="${i}" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%" role="img" aria-label="Keyframe ${i + 1} at ${fmt(p.time)} seconds, value ${fmt(p.value)}"></span>`;
  }).join("");
  const handles = shownHandles(track.points, selectedIndex).map((h) => {
    const c = handlePosition(track.points, h.index, h.end), q = toPixel(frame, c.x, c.y);
    return `<span class="curve-handle curve-handle-${h.end}" data-key="${h.index}" data-end="${h.end}" style="left:${q.x.toFixed(3)}%;top:${q.y.toFixed(3)}%"></span>`;
  }).join("");
  const point = selectedIndex !== null ? track.points[selectedIndex] : void 0;
  const hasSegment = selectedIndex !== null && selectedIndex < track.points.length - 1;
  const current = point && hasSegment ? point.type ?? "linear" : "";
  const controls = point ? `<div class="curve-tools" role="group" aria-label="Segment after keyframe ${selectedIndex + 1}">${INTERPOLATIONS.map((type) => `<button type="button" data-action="curve-segment" data-track-id="${id}" data-index="${selectedIndex}" data-type="${type}" aria-pressed="${current === type}"${hasSegment ? "" : " disabled"}>${INTERPOLATION_LABEL[type]}</button>`).join("")}<button type="button" data-action="curve-delete-key" data-track-id="${id}" data-index="${selectedIndex}" aria-label="Delete keyframe"${track.points.length <= 2 ? " disabled" : ""}>Delete</button></div><p class="curve-readout">${fmt(point.time)} s \xB7 ${fmt(point.value)}</p>` : "";
  return `<div class="curve-lane-wrap"><div class="curve-lane" data-track-id="${id}" data-scene-id="${esc(scene.id)}" role="group" aria-label="Curve for ${name}"><svg class="curve-svg" viewBox="0 0 ${PATH_SPACE} ${PATH_SPACE}" preserveAspectRatio="none" aria-hidden="true"><path d="${samplePath(track.points, frame)}"/></svg>${handles}${keys}</div>${controls}</div>`;
}
export {
  HIT_RADIUS,
  INTERPOLATIONS,
  PATH_SPACE,
  channelName,
  channelPanelHTML,
  channelStateFor,
  curveHit,
  fromPixel,
  handlePosition,
  insertKey,
  laneFrame,
  moveHandle,
  moveKey,
  previewScene,
  removeKey,
  samplePath,
  setSegmentType,
  shownHandles,
  toPixel
};
