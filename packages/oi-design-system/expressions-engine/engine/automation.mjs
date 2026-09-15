/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
function createAutomationRuntime() {
  return { lanes: /* @__PURE__ */ new Map() };
}
function readPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === void 0) return void 0;
    cur = cur[p];
  }
  return cur;
}
function writePath(obj, path, value) {
  const parts = path.split(".");
  if (parts.some((p) => !p || ["__proto__", "prototype", "constructor"].includes(p))) throw new Error("Unsafe automation path");
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    const cloned = Array.isArray(next) ? [...next] : next && typeof next === "object" ? { ...next } : {};
    cur[key] = cloned;
    cur = cloned;
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}
const TAU = Math.PI * 2;
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function waveform(kind, cycle, rt) {
  const f = cycle - Math.floor(cycle);
  switch (kind) {
    case "sine":
      return Math.sin(f * TAU);
    case "triangle":
      return 1 - 4 * Math.abs(f - 0.5);
    case "square":
      return f < 0.5 ? 1 : -1;
    case "saw":
      return f * 2 - 1;
    case "randomStep": {
      const step = Math.floor(cycle);
      if (step !== rt.lastStep) {
        rt.lastStep = step;
        rt.lastValue = hash(step + rt.randSeed) * 2 - 1;
      }
      return rt.lastValue;
    }
    case "smoothRandom": {
      const step = Math.floor(cycle);
      if (step !== rt.lastStep) {
        rt.lastStep = step;
        rt.lastValue = hash(step + rt.randSeed) * 2 - 1;
        rt.nextValue = hash(step + 1 + rt.randSeed) * 2 - 1;
      }
      const t = f * f * (3 - 2 * f);
      return rt.lastValue + (rt.nextValue - rt.lastValue) * t;
    }
    default:
      return Math.sin(f * TAU);
  }
}
function ease(kind, u) {
  const t = Math.max(0, Math.min(1, u));
  switch (kind) {
    case "linear":
      return t;
    case "smooth":
      return t * t * (3 - 2 * t);
    case "easeIn":
      return t * t * t;
    case "easeOut":
      return 1 - Math.pow(1 - t, 3);
    case "elastic": {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    }
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = t;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    default:
      return t;
  }
}
function getRuntime(rt, lane, now) {
  let r = rt.lanes.get(lane.clockId ?? lane.id);
  if (!r) {
    r = {
      startTime: now + (lane.delayS ?? 0),
      token: lane.fireToken ?? 0,
      randSeed: Math.floor(Math.random() * 1e4),
      lastStep: -1,
      lastValue: 0,
      nextValue: 0
    };
    rt.lanes.set(lane.clockId ?? lane.id, r);
  } else if ((lane.fireToken ?? 0) !== r.token) {
    r.token = lane.fireToken ?? 0;
    r.startTime = now + (lane.delayS ?? 0);
  }
  return r;
}
function evaluateLane(lane, now, rt) {
  if (!lane.enabled || !lane.path) return null;
  const r = getRuntime(rt, lane, now);
  if (lane.type === "lfo") {
    const rate = lane.rateHz ?? 0.25;
    const phase = lane.phase ?? 0;
    const cycle = r.cycle === void 0 || now < (r.lastTime ?? now) ? now * rate + phase : r.cycle + (now - (r.lastTime ?? now)) * (r.rateHz ?? rate) + phase - (r.phaseOffset ?? phase);
    r.cycle = cycle;
    r.lastTime = now;
    r.phaseOffset = phase;
    r.rateHz = rate;
    const w = waveform(lane.waveform ?? "sine", cycle, r);
    const lo = lane.min ?? 0;
    const hi = lane.max ?? 1;
    return { id: lane.id, path: lane.path, value: lo + (hi - lo) * (0.5 + 0.5 * w), phase: cycle - Math.floor(cycle), done: false };
  }
  const dur = Math.max(1e-3, lane.durationS ?? 2);
  const from = lane.from ?? 0;
  const to = lane.to ?? 1;
  let elapsed = now - r.startTime;
  if (elapsed < 0) {
    return { id: lane.id, path: lane.path, value: from, phase: 0, done: false };
  }
  let done = false;
  let u;
  const loop = lane.loop ?? "none";
  if (loop === "restart") {
    u = elapsed % dur / dur;
  } else if (loop === "pingpong") {
    const c = elapsed / dur % 2;
    u = c < 1 ? c : 2 - c;
  } else {
    u = elapsed / dur;
    if (u >= 1) {
      u = 1;
      done = true;
    }
  }
  const e = ease(lane.easing ?? "smooth", u);
  return { id: lane.id, path: lane.path, value: from + (to - from) * e, phase: u, done };
}
function applyAutomations(config, lanes, now, rt, morphDrive) {
  if (!lanes || lanes.length === 0) return { config, live: [] };
  let out = config;
  const live = [];
  for (const lane of lanes) {
    const v = lane.waveform === "morph" && lane.type === "lfo" ? lane.enabled && morphDrive ? { id: lane.id, path: lane.path, value: (lane.min ?? 0) + ((lane.max ?? 1) - (lane.min ?? 0)) * morphDrive.progress, phase: morphDrive.cycleFraction, done: false } : null : evaluateLane(lane, now, rt);
    if (!v) continue;
    const base = readPath(config, lane.path);
    let value = v.value;
    if (lane.blend === "add" && typeof base === "number") value = base + v.value;
    else if (lane.blend === "multiply" && typeof base === "number") value = base * v.value;
    out = writePath(out, lane.path, value);
    live.push({ ...v, value });
  }
  if (rt.lanes.size > lanes.length * 2 + 8) {
    const ids = new Set(lanes.map((l) => l.clockId ?? l.id));
    for (const k of Array.from(rt.lanes.keys())) if (!ids.has(k)) rt.lanes.delete(k);
  }
  return { config: out, live };
}
function createLane(path, type, base, range) {
  const span = Math.max(1e-6, range[1] - range[0]);
  const id = "auto_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  if (type === "lfo") {
    const half = span * 0.15;
    return {
      id,
      path,
      enabled: true,
      type,
      waveform: "sine",
      min: Math.max(range[0], base - half),
      max: Math.min(range[1], base + half),
      rateHz: 0.2,
      phase: 0,
      blend: "replace"
    };
  }
  return {
    id,
    path,
    enabled: true,
    type,
    from: base,
    to: Math.min(range[1], base + span * 0.3),
    durationS: 3,
    easing: "smooth",
    loop: "none",
    fireToken: 1,
    delayS: 0,
    blend: "replace"
  };
}
export {
  applyAutomations,
  createAutomationRuntime,
  createLane,
  ease,
  evaluateLane,
  readPath,
  waveform,
  writePath
};
