const TRANSITION_KINDS = ["cut", "crossfade", "dip-to-colour", "wipe"];
const WIPE_DIRECTIONS = ["left", "right", "up", "down"];
const DIP_AT_MIN = 0.2, DIP_AT_MAX = 0.8, DIP_AT_DEFAULT = 0.5;
const SWITCH_MODES = ["immediate", "sync", "at-end"];
const CURVE_TYPES = ["linear", "hold", "smooth", "bezier"];
const clamp01 = (n) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
function dipWeights(fraction, at = DIP_AT_DEFAULT) {
  const f = clamp01(fraction);
  if (f < at) {
    const outgoing = 1 - f / at;
    return { outgoing, colour: 1 - outgoing, incoming: 0 };
  }
  const colour = 1 - (f - at) / (1 - at);
  return { outgoing: 0, colour, incoming: 1 - colour };
}
function wipeHoldRect(direction, fraction, width, height) {
  const e = clamp01(fraction);
  switch (direction) {
    case "right":
      return { x: e * width, y: 0, width: (1 - e) * width, height };
    case "left":
      return { x: 0, y: 0, width: (1 - e) * width, height };
    case "down":
      return { x: 0, y: e * height, width, height: (1 - e) * height };
    case "up":
      return { x: 0, y: 0, width, height: (1 - e) * height };
  }
}
function paintedPassParams(spec, fraction, width, height, holdReady) {
  const f = clamp01(fraction), empty = [0, 0, 0, 0];
  if (spec.kind === "dip-to-colour") return { colourW: dipWeights(f, spec.at).colour, useHold: false, holdRect: empty };
  if (spec.kind === "wipe") {
    if (!holdReady) return { colourW: 0, useHold: false, holdRect: empty };
    const r = wipeHoldRect(spec.direction ?? "left", f, width, height);
    return { colourW: 0, useHold: true, holdRect: [r.x, height - (r.y + r.height), r.width, r.height] };
  }
  return { colourW: 0, useHold: false, holdRect: empty };
}
function srgbUnit(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`A transition colour is a #rgb or #rrggbb hex value, not ${JSON.stringify(String(hex).slice(0, 24))}.`);
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1], n = parseInt(digits, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function renderTargetAction(current, needed) {
  if (!needed) return current ? "release" : "none";
  if (!current) return "allocate";
  return current.width === needed.width && current.height === needed.height ? "none" : "resize";
}
function transitionColourOf(background) {
  return background && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background.trim()) ? background.trim() : "#f4f2eb";
}
const IDENTITY_FIT = { scale: [1, 1], offset: [0, 0] };
function holdFit(out, hold) {
  if (!(out.width > 0 && out.height > 0 && hold.width > 0 && hold.height > 0)) return { scale: [...IDENTITY_FIT.scale], offset: [...IDENTITY_FIT.offset] };
  const outAspect = out.width / out.height, holdAspect = hold.width / hold.height;
  if (Math.abs(outAspect - holdAspect) < 1e-9) return { scale: [1, 1], offset: [0, 0] };
  if (holdAspect > outAspect) {
    const sy = outAspect / holdAspect;
    return { scale: [1, sy], offset: [0, (1 - sy) / 2] };
  }
  const sx = holdAspect / outAspect;
  return { scale: [sx, 1], offset: [(1 - sx) / 2, 0] };
}
function holdSampleUv(uv, fit) {
  const u = (uv[0] - fit.offset[0]) / fit.scale[0], v = (uv[1] - fit.offset[1]) / fit.scale[1];
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}
function compositeMirror(live, colourW, colour, ground) {
  const a = live[3] * (1 - colourW) + colourW;
  const rgb = [0, 1, 2].map((i) => live[i] * (1 - colourW) + colour[i] * colourW + ground[i] * (1 - a));
  return [rgb[0], rgb[1], rgb[2], 1];
}
export {
  CURVE_TYPES,
  DIP_AT_DEFAULT,
  DIP_AT_MAX,
  DIP_AT_MIN,
  SWITCH_MODES,
  TRANSITION_KINDS,
  WIPE_DIRECTIONS,
  compositeMirror,
  dipWeights,
  holdFit,
  holdSampleUv,
  paintedPassParams,
  renderTargetAction,
  srgbUnit,
  transitionColourOf,
  wipeHoldRect
};
