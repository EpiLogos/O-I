import { snapTime } from "./snapModel.mjs";
const MARKER_COLOURS = ["amber", "rose", "sage", "sky", "violet"];
const MARKER_LIMIT = 64;
const MARKER_NAME_MAX = 80;
const MARKER_SNAP_PX = 6;
const LOOP_MIN_SECONDS = 0.05;
const LOOP_EPSILON = 1e-9;
const JOURNEY_TIME_MAX = 64 * 3600;
const SAFE_ID = /^[a-zA-Z0-9_.:-]{1,160}$/;
const MARKER_FIELDS = ["id", "name", "time", "colour"];
const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const round2 = (n) => Math.round(n * 100) / 100;
const clampTime = (t, duration) => Math.min(Math.max(0, t), Math.max(0, duration));
function journeyTotal(durations) {
  return durations.reduce((sum, d) => sum + d, 0);
}
function sceneBoundaries(durations) {
  const out = [0];
  let sum = 0;
  for (const d of durations) {
    sum += d;
    out.push(sum);
  }
  return out;
}
function playDurations(scenes, savedScenes, saved) {
  return scenes.map((scene) => saved ? savedScenes?.[scene.id]?.duration ?? 0 : scene.duration);
}
function sceneAtJourneyTime(durations, t) {
  const value = Math.max(0, t);
  let start = 0, last = -1;
  for (let index = 0; index < durations.length; index++) {
    const duration = durations[index];
    if (!(duration > 0)) continue;
    last = index;
    if (value < start + duration) return { sceneIndex: index, local: value - start };
    start += duration;
  }
  return last < 0 ? { sceneIndex: 0, local: 0 } : { sceneIndex: last, local: durations[last] };
}
function toPlayClock(working, play, t) {
  const { sceneIndex, local } = sceneAtJourneyTime(working, t);
  const start = sceneBoundaries(play)[sceneIndex] ?? 0;
  return start + Math.min(local, play[sceneIndex] ?? 0);
}
function toPlayRegion(working, play, region) {
  if (!region) return void 0;
  const from = toPlayClock(working, play, region.from), to = toPlayClock(working, play, region.to);
  return to > from ? { from, to } : void 0;
}
function sceneLocalRegion(working, sceneIndex, region) {
  if (!region || !(region.to > region.from)) return void 0;
  const start = sceneBoundaries(working)[sceneIndex], duration = working[sceneIndex];
  if (start === void 0 || !(duration > 0) || region.from < start || region.to > start + duration) return void 0;
  return { from: region.from - start, to: region.to - start };
}
function loopPlayNotice(working, play, region) {
  if (!region || !(region.to > region.from)) return null;
  if (!toPlayRegion(working, play, region)) return "The loop has no length in the saved scenes, so saved playback runs without it. Save the scene it sits in to loop there.";
  const edgeUnsaved = [region.from, region.to].some((t) => !(play[sceneAtJourneyTime(working, t).sceneIndex] > 0));
  return edgeUnsaved ? "A loop edge sits in an unsaved scene; saved playback loops at the nearest saved instant. Save that scene to loop there." : null;
}
function snapToBoundary(time, boundaries, secondsPerPx, tolerancePx = MARKER_SNAP_PX) {
  return snapTime(boundaries.map((b, index) => ({ time: b, kind: "scene", id: `scene:${index}` })), time, secondsPerPx, { tolerancePx });
}
function sortMarkers(list) {
  return [...list].sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function validateMarkers(value, duration) {
  if (!Array.isArray(value) || value.length > MARKER_LIMIT) throw new Error(`A journey holds at most ${MARKER_LIMIT} markers.`);
  const ids = /* @__PURE__ */ new Set();
  return sortMarkers(value.map((row) => {
    if (!isRecord(row) || Object.keys(row).some((key) => !MARKER_FIELDS.includes(key))) throw new Error("Invalid journey marker.");
    const { id, name, time, colour } = row;
    if (typeof id !== "string" || !SAFE_ID.test(id) || ids.has(id)) throw new Error("Marker identities must be unique and safe.");
    ids.add(id);
    if (typeof name !== "string" || name.length < 1 || name.length > MARKER_NAME_MAX) throw new Error(`Marker names are 1\u2013${MARKER_NAME_MAX} characters.`);
    if (typeof time !== "number" || !Number.isFinite(time)) throw new Error("Marker time must be a finite number.");
    if (!MARKER_COLOURS.includes(colour)) throw new Error("Marker colour must be a palette key.");
    return { id, name, time: clampTime(round2(time), duration), colour };
  }));
}
function validateLoopRegion(value, duration) {
  if (value === void 0 || value === null) return void 0;
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "from" && key !== "to") || typeof value.from !== "number" || typeof value.to !== "number" || !Number.isFinite(value.from) || !Number.isFinite(value.to)) {
    throw new Error("Invalid loop region.");
  }
  const from = clampTime(round2(value.from), duration), to = clampTime(round2(value.to), duration);
  return to - from >= LOOP_MIN_SECONDS - LOOP_EPSILON ? { from, to } : void 0;
}
function markerNamed(list, id) {
  return list.find((m) => m.id === id);
}
function markerAdd(list, marker) {
  if (list.length >= MARKER_LIMIT) throw new Error(`A journey holds at most ${MARKER_LIMIT} markers.`);
  if (list.some((m) => m.id === marker.id)) throw new Error("This marker already exists.");
  return sortMarkers([...list, { ...marker, time: round2(marker.time) }]);
}
function markerRename(list, id, name) {
  const next = name.trim();
  if (!next || next.length > MARKER_NAME_MAX) throw new Error(`Marker names are 1\u2013${MARKER_NAME_MAX} characters.`);
  if (!markerNamed(list, id)) throw new Error("This marker is no longer on the journey.");
  return list.map((m) => m.id === id ? { ...m, name: next } : m);
}
function markerMove(list, id, time, duration) {
  if (!markerNamed(list, id)) throw new Error("This marker is no longer on the journey.");
  return sortMarkers(list.map((m) => m.id === id ? { ...m, time: clampTime(round2(time), duration) } : m));
}
function markerRemove(list, id) {
  if (!markerNamed(list, id)) throw new Error("This marker is no longer on the journey.");
  return list.filter((m) => m.id !== id);
}
function nextMarkerTime(list, t, eps = 5e-3) {
  let best = null;
  for (const m of list) if (m.time > t + eps && (best === null || m.time < best)) best = m.time;
  return best;
}
function prevMarkerTime(list, t, eps = 5e-3) {
  let best = null;
  for (const m of list) if (m.time < t - eps && (best === null || m.time > best)) best = m.time;
  return best;
}
function setLoopEdge(region, edge, time, duration) {
  const t = clampTime(round2(time), duration);
  const base = region ?? { from: 0, to: duration };
  const next = edge === "from" ? { from: t, to: base.to } : { from: base.from, to: t };
  if (next.to - next.from < LOOP_MIN_SECONDS - LOOP_EPSILON) {
    return { refusal: edge === "from" ? "The loop in must come before the loop out." : "The loop out must come after the loop in." };
  }
  return { region: next };
}
function dragLoopEdge(region, edge, time, duration) {
  const t = clampTime(round2(time), duration);
  return edge === "from" ? { from: Math.min(t, region.to - LOOP_MIN_SECONDS), to: region.to } : { from: region.from, to: Math.max(t, region.from + LOOP_MIN_SECONDS) };
}
function moveLoopRegion(region, delta, duration) {
  const length = region.to - region.from;
  const from = round2(Math.min(Math.max(region.from + delta, 0), Math.max(0, duration - length)));
  return { from, to: round2(from + length) };
}
function regionWrap(durations, sceneIndex, elapsed, advance, region) {
  if (!region || !(region.to > region.from) || !(advance > 0) || !Number.isFinite(elapsed)) return null;
  const before = (sceneBoundaries(durations)[sceneIndex] ?? 0) + elapsed;
  const after = before + advance;
  if (!(before < region.to && after >= region.to)) return null;
  const over = (after - region.to) % (region.to - region.from);
  return sceneAtJourneyTime(durations, region.from + over);
}
export {
  JOURNEY_TIME_MAX,
  LOOP_MIN_SECONDS,
  MARKER_COLOURS,
  MARKER_LIMIT,
  MARKER_NAME_MAX,
  MARKER_SNAP_PX,
  dragLoopEdge,
  journeyTotal,
  loopPlayNotice,
  markerAdd,
  markerMove,
  markerNamed,
  markerRemove,
  markerRename,
  moveLoopRegion,
  nextMarkerTime,
  playDurations,
  prevMarkerTime,
  regionWrap,
  sceneAtJourneyTime,
  sceneBoundaries,
  sceneLocalRegion,
  setLoopEdge,
  snapToBoundary,
  sortMarkers,
  toPlayClock,
  toPlayRegion,
  validateLoopRegion,
  validateMarkers
};
