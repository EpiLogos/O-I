const SNAP_TOLERANCE_PX = 6;
function snapCandidates(src) {
  const out = [];
  (src.boundaries ?? []).forEach((time, index) => out.push({ time, kind: "scene", id: `scene:${index}` }));
  for (const marker of src.markers ?? []) out.push({ time: marker.time, kind: "marker", id: `marker:${marker.id}` });
  if (src.playhead !== void 0 && Number.isFinite(src.playhead)) out.push({ time: src.playhead, kind: "playhead", id: "playhead" });
  if (src.loop) {
    out.push({ time: src.loop.from, kind: "loop-in", id: "loop:from" });
    out.push({ time: src.loop.to, kind: "loop-out", id: "loop:to" });
  }
  for (const key of src.keyframes ?? []) out.push({ time: key.time, kind: "keyframe", id: key.id });
  return out.filter((point) => Number.isFinite(point.time));
}
function closestSnap(points, time, secondsPerPx, query = {}) {
  if (!Number.isFinite(time) || !(secondsPerPx > 0)) return null;
  const gap = (query.tolerancePx ?? SNAP_TOLERANCE_PX) * secondsPerPx;
  const excluded = query.exclude instanceof Set ? query.exclude : new Set(query.exclude ?? []);
  let best = null;
  let bestDistance = Infinity;
  for (const point of points) {
    if (excluded.has(point.id)) continue;
    const distance = Math.abs(point.time - time);
    if (distance <= gap && distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}
function snapTime(points, time, secondsPerPx, query) {
  return closestSnap(points, time, secondsPerPx, query)?.time ?? time;
}
function nextSnapPoint(points, t, eps = 5e-3) {
  let best = null;
  for (const point of points) if (point.time > t + eps && (best === null || point.time < best.time)) best = point;
  return best;
}
function prevSnapPoint(points, t, eps = 5e-3) {
  let best = null;
  for (const point of points) if (point.time < t - eps && (best === null || point.time > best.time)) best = point;
  return best;
}
export {
  SNAP_TOLERANCE_PX,
  closestSnap,
  nextSnapPoint,
  prevSnapPoint,
  snapCandidates,
  snapTime
};
