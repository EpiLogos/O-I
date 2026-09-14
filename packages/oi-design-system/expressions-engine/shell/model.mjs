const DEFAULT_ENGINE_SETTINGS = { paletteSource: "custom", grainProfile: true, backgroundMode: "solid", resonatorMode: "resonator", focusOrder: "listed", dotShape: "circle", fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 900, resonanceEnabled: true, morphEnabled: false, trajectory: "toroidalHopf", driveShape: "sine", autoOscillate: true, relationalEnabled: false, relationalMode: "orbital", pointerMode: "repel", colorMode: "linearGradient", colorEnabled: true, mediumPlane: "vertical", autoSweep: false, sweepDirection: "ascent" };
const clone = (v) => JSON.parse(JSON.stringify(v));
const uid = (prefix = "id") => prefix + "-" + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DEFAULT_PARAMS = {
  count: 62e3,
  size: 2.8,
  sizeBias: 1.6,
  opacity: 0.92,
  roundness: 0.95,
  softness: 0.15,
  irregularity: 0.35,
  elongation: 0.04,
  orientation: 0,
  jitter: 0.8,
  contrast: 0.93,
  densityScale: 1,
  densityPhase: 0.3,
  edgeWeight: 0,
  halo: 0.13,
  thickness: 0.035,
  warp: 0.4,
  speed: 0.7,
  circulation: 1,
  turbulence: 0.22,
  turbulenceScale: 1.2,
  damping: 1.4,
  recovery: 1.1,
  flow: 1,
  dispersion: 0.09,
  pointerStrength: 0.8,
  pointerRadius: 0.23,
  pointerFalloff: 2,
  depth: 0.12,
  grain: 0.035,
  snapRigidity: 1,
  densityTether: 1,
  curlDepth: 0.2,
  vortexRadius: 0.4,
  gravityX: 0,
  gravityY: 0,
  gravityZ: 0,
  quadraticDrag: 0.2,
  thermalJitter: 0,
  speedLimit: 3,
  zConfinement: 1,
  timeScale: 1,
  gravitySoftening: 0.1,
  gravityFalloff: 2,
  swirlRadius: 0.4,
  frequency: 220,
  dominance: 0,
  resonanceDamping: 0.04,
  excitation: 0.6
};
function entity(name, text = "O", position = { x: 0, y: 0, z: 0 }) {
  return {
    id: uid("entity"),
    name,
    kind: "formation",
    position: { ...position },
    size: { x: 0.65, y: 0.86 },
    rotation: 0,
    shape: "text",
    text,
    share: 1,
    tint: "#252720",
    tintWeight: 0,
    locked: false,
    force: { kind: "attract", strength: 0, radius: 0.45, spin: 0 },
    station: null,
    sequence: { enabled: false, clock: "seconds", steps: [{ id: uid("step"), text, shape: "text", hold: 3, transition: 1, position: null }] }
  };
}
function pin(position) {
  const e = entity("Attractor", "", position);
  e.kind = "pin";
  e.share = 0;
  e.force.strength = 1;
  e.size = { x: 0.1, y: 0.1 };
  return e;
}
function blankScene(name = "Untitled scene") {
  return {
    engine: { ...DEFAULT_ENGINE_SETTINGS },
    id: uid("scene"),
    name,
    character: "An arrangement, waiting to happen.",
    duration: 12,
    transition: 1.5,
    view: { mode: "2d", yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 },
    field: { background: "#f4f2eb", palette: ["#252720", "#252720"], material: "ink", params: { ...DEFAULT_PARAMS } },
    entities: [],
    text: [],
    composition: { layout: "free", plane: "XY", focus: "parallel", focusDuration: 4, carryTint: true, carryStation: false, frequencyDriver: "manual" },
    morph: { thetaRate: 0.08, phiRate: 0.13, thetaOffset: 0, phiOffset: 0, law: "theta", depth: 1, dwell: 0.3 },
    automation: []
  };
}
const descriptions = [
  ["Ink", "Between", "form & field.", "Fine, irregular stippling.\nForm on the edge of dissolution."],
  ["Print", "The print", "comes undone.", "An imperfect lattice.\nA surface beginning to move."],
  ["Gather", "Gathering", "a current.", "Rounded grains find\na shared current."],
  ["Between", "Neither one.", "Nor two.", "Two characters, one material.\nAn unsettled identity."],
  ["Language", "A language", "of particles.", "A different character.\nThe same living field."],
  ["Weather", "A change", "in the weather.", "No centre, no logo.\nOnly changing concentrations."],
  ["Quiet", "Room for", "something else.", "A little less certainty.\nA little more space."],
  ["Nocturne", "What the", "dark holds.", "Light collected in the dark.\nSomething quietly taking form."]
];
function fieldStudies() {
  const scenes = descriptions.map((d, i) => {
    const s = blankScene(d[0]);
    s.id = "study-" + i;
    s.character = d[3].replace("\n", " ");
    s.duration = 14;
    const o = entity("O \u2014 opening", "O", { x: -0.22, y: 0.03, z: 0 });
    o.id = "opening-o";
    o.size = { x: 1.43, y: 1.63 };
    o.rotation = -5;
    o.share = 4;
    const ii = entity("I \u2014 interval", "I", { x: 0.66, y: 0.015, z: 0 });
    ii.id = "opening-i";
    ii.size = { x: 0.28, y: 1.62 };
    ii.share = 1;
    s.entities = [o, ii];
    if (i === 1) {
      s.field.material = "print";
      Object.assign(s.field.params, { count: 24e3, size: 4.1, contrast: 0.7, warp: 0.12, jitter: 0.08, roundness: 0.15, dispersion: 0.025, speed: 0.4 });
    }
    if (i === 2) {
      const e = entity("Gathering ring", "O");
      e.id = "opening-o";
      e.shape = "ring";
      e.size = { x: 1.6, y: 1.64 };
      s.entities = [e];
      s.field.material = "round";
      Object.assign(s.field.params, { count: 28e3, size: 3.6, contrast: 0.75, warp: 0.4, densityPhase: 2 });
    }
    if (i === 3) {
      o.position.x = -0.14;
      o.rotation = -17;
      ii.position.x = 0.4;
      ii.rotation = 10;
      Object.assign(s.field.params, { warp: 0.8, dispersion: 0.16, contrast: 0.86 });
    }
    if (i === 4) {
      o.text = "&";
      o.name = "Ampersand";
      o.size = { x: 1.25, y: 1.5 };
      o.position.x = 0.1;
      o.rotation = 0;
      s.entities = [o];
      Object.assign(s.field.params, { warp: 0.12, contrast: 0.6 });
    }
    if (i === 5) {
      o.shape = "square";
      o.name = "Atmosphere";
      o.position.x = 0;
      o.size = { x: 3.6, y: 2.5 };
      s.entities = [o];
      Object.assign(s.field.params, { count: 52e3, size: 1.45, contrast: 0.98, densityScale: 1.8, warp: 0.25, opacity: 0.5, dispersion: 0.4 });
    }
    if (i === 6) {
      o.position.x = 0.2;
      o.size = { x: 1.15, y: 1.55 };
      ii.position.x = 0.84;
      s.field.palette = ["#8b8576", "#c5bba3"];
      Object.assign(s.field.params, { count: 29e3, opacity: 0.5, size: 1.5, contrast: 0.7, warp: 0.14 });
    }
    if (i === 7) {
      s.field.background = "#1d231f";
      s.field.palette = ["#eee9d9", "#a9b399"];
      Object.assign(s.field.params, { opacity: 0.9, densityPhase: 1.9 });
    }
    s.field.params.count = 62e3;
    return s;
  });
  return { schema: "oi.journey", version: 1, id: "field-studies", name: "Field studies", description: "Eight states of a living material. An expression from ink to atmosphere.", loop: true, scenes, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function chakraEntities() {
  return ["Root", "Sacral", "Solar", "Heart", "Throat", "Brow", "Crown"].map((name, i) => {
    const e = entity(name, ["\u25B3", "\u25EF", "\u25B3", "\u2727", "\u25EF", "\u221E", "\u2727"][i], { x: 0.18, y: -0.82 + i * 0.274, z: 0 });
    e.size = { x: 0.235, y: 0.235 };
    e.tint = ["#a94138", "#c67c46", "#c2a852", "#638c69", "#5898a4", "#737599", "#a590b0"][i];
    e.tintWeight = 1;
    e.station = i;
    e.force = { kind: "vortex", strength: 0.3, radius: 0.27, spin: 0.12 };
    return e;
  });
}
function sevenCentres() {
  const s = blankScene("Seven centres");
  s.entities = chakraEntities();
  s.field.params.count = 42e3;
  s.field.params.contrast = 0.5;
  s.field.params.warp = 0.12;
  s.composition.layout = "column";
  const t = clone(s);
  t.id = uid("scene");
  t.name = "A rising attention";
  t.composition.focus = "travelling";
  return { schema: "oi.journey", version: 1, id: "seven-centres", name: "Seven centres", description: "A spatial composition; not seven isolated simulations.", loop: true, scenes: [s, t], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function smallLanguage() {
  const j = fieldStudies();
  j.id = "small-language";
  j.name = "A small language";
  j.description = "Three characters, and the intervals between them.";
  j.scenes = [j.scenes[0], j.scenes[4], j.scenes[6]].map((s, i) => {
    s.id = uid("scene");
    s.name = ["A beginning", "And", "An opening"][i];
    return s;
  });
  return j;
}
function blankJourney() {
  return { schema: "oi.journey", version: 1, id: uid("journey"), name: "Untitled expression", description: "", loop: true, scenes: [blankScene()], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function validateJourney(value) {
  if (!value || typeof value !== "object") throw new Error("Choose a Field Studies journey JSON file.");
  const inspect = (v, depth = 0) => {
    if (depth > 40) throw new Error("Document nesting is too deep.");
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Non-finite value.");
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k)) throw new Error("Unsafe document key.");
      inspect(x, depth + 1);
    }
  };
  inspect(value);
  const j = clone(value);
  if (j.schema !== "oi.journey" || j.version !== 1) throw new Error("This is not a journey-schema 1 document. Use Import for native schema-4 configurations.");
  const finite = (n, a, b) => typeof n === "number" && Number.isFinite(n) && n >= a && n <= b;
  const str = (s, max = 5e3) => typeof s === "string" && s.length <= max;
  const safeId = (s) => typeof s === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(s);
  const color = (s) => typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
  if (!str(j.name, 160) || !safeId(j.id) || !str(j.description) || typeof j.loop !== "boolean" || !Array.isArray(j.scenes) || !j.scenes.length || j.scenes.length > 64) throw new Error("Journey metadata or scene count is invalid (1\u201364 scenes).");
  const ids = /* @__PURE__ */ new Set();
  for (const s of j.scenes) {
    s.engine = { ...DEFAULT_ENGINE_SETTINGS, ...s.engine };
    if (!safeId(s.id) || ids.has(s.id) || !str(s.name, 160) || !str(s.character) || !finite(s.duration, 1, 3600) || !finite(s.transition, 0, 30)) throw new Error("Invalid or duplicate scene.");
    ids.add(s.id);
    if (!s.view) s.view = { mode: "2d", yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
    if (s.view.nativeScaffold !== void 0 && !["off", "axis", "grid"].includes(s.view.nativeScaffold)) throw new Error("Invalid native scaffold.");
    if (!["2d", "3d"].includes(s.view.mode) || !finite(s.view.yaw, -1e3, 1e3) || !finite(s.view.pitch, -1e3, 1e3) || !finite(s.view.zoom, 0.01, 100) || !finite(s.view.panX, -10, 10) || !finite(s.view.panY, -10, 10)) throw new Error("Invalid scene framing.");
    if (!s.field || !color(s.field.background) || !["ink", "print", "round"].includes(s.field.material) || !Array.isArray(s.field.palette) || s.field.palette.length < 2 || s.field.palette.length > 8 || !s.field.palette.every(color) || !s.field.params) throw new Error("Scene material or palette is invalid.");
    for (const [key, defaultValue] of Object.entries(DEFAULT_PARAMS)) {
      if (!(key in s.field.params)) s.field.params[key] = defaultValue;
      if (!finite(s.field.params[key], -1e8, 1e8)) throw new Error("Invalid numeric field parameter: " + key);
    }
    if (!Array.isArray(s.entities) || s.entities.length > 32 || !Array.isArray(s.text) || s.text.length > 16 || !Array.isArray(s.automation) || s.automation.length > 64) throw new Error("Scene exceeds safe authoring limits.");
    const eids = /* @__PURE__ */ new Set();
    for (const e of s.entities) {
      if (!safeId(e.id) || eids.has(e.id) || !str(e.name, 160) || !str(e.text, 120) || !["formation", "pin"].includes(e.kind) || !["text", "ring", "disc", "square", "triangle", "yantra", "cymatic"].includes(e.shape)) throw new Error("Invalid entity.");
      eids.add(e.id);
      if (!e.position || !Object.values(e.position).every((n) => finite(n, -100, 100)) || !["x", "y", "z"].every((k) => finite(e.position[k], -100, 100)) || !e.size || !finite(e.size.x, 1e-3, 100) || !finite(e.size.y, 1e-3, 100) || !finite(e.rotation, -36e3, 36e3) || !finite(e.share, 0, 1e3) || !color(e.tint) || !finite(e.tintWeight, 0, 1) || typeof e.locked !== "boolean") throw new Error("Invalid entity transform or appearance.");
      if (!e.force || !["none", "attract", "repel", "vortex"].includes(e.force.kind) || !finite(e.force.strength, -1e3, 1e3) || !finite(e.force.radius, 1e-3, 125) || !finite(e.force.spin, -1e3, 1e3) || !(e.station === null || Number.isInteger(e.station) && e.station >= 0 && e.station < 7)) throw new Error("Invalid entity influence.");
      if (e.source) {
        if (e.kind !== "formation" || !["ascii", "image"].includes(e.source.kind)) throw new Error("Invalid formation source");
        if (e.source.kind === "ascii" && (!e.source.ascii || !str(e.source.ascii.text, 5e4))) throw new Error("Invalid ASCII source");
        if (e.source.kind === "image" && (!e.source.image || !["luminance", "edgeSobel", "silhouette"].includes(e.source.image.mode) || !finite(e.source.image.threshold, 0, 1) || !finite(e.source.image.scale, 0.01, 100) || e.source.image.dataUrl !== void 0 && !str(e.source.image.dataUrl, 12e6))) throw new Error("Invalid image source");
      }
      if (!e.sequence || typeof e.sequence.enabled !== "boolean" || !["seconds", "morph"].includes(e.sequence.clock) || !Array.isArray(e.sequence.steps) || e.sequence.steps.length > 32) throw new Error("Invalid sequence.");
      for (const step of e.sequence.steps) {
        if (!safeId(step.id) || !str(step.text, 120) || !["text", "ring", "disc", "square", "triangle", "yantra", "cymatic"].includes(step.shape) || !finite(step.hold, 0, 3600) || !finite(step.transition, 0, 3600) || step.position !== null && (!step.position || !["x", "y", "z"].every((k) => finite(step.position[k], -100, 100)))) throw new Error("Invalid sequence step.");
      }
    }
    for (const t of s.text) {
      if (!safeId(t.id) || !str(t.kicker, 300) || !str(t.title, 300) || !str(t.italic, 300) || !str(t.body) || !finite(t.x, -0.5, 1.5) || !finite(t.y, -0.5, 1.5) || !finite(t.width, 60, 1e3) || !finite(t.size, 14, 150) || !["left", "center", "right"].includes(t.align) || typeof t.visible !== "boolean") throw new Error("Invalid page text.");
    }
    if (!s.composition || !["XY", "XZ", "YZ"].includes(s.composition.plane) || !["parallel", "travelling"].includes(s.composition.focus) || !finite(s.composition.focusDuration, 0.01, 3600) || !["manual", "focus", "automation"].includes(s.composition.frequencyDriver)) throw new Error("Invalid composition.");
    if (!s.morph || !["theta", "product", "sum", "beat"].includes(s.morph.law) || !finite(s.morph.thetaRate, -100, 100) || !finite(s.morph.phiRate, -100, 100) || !finite(s.morph.thetaOffset, -1e3, 1e3) || !finite(s.morph.phiOffset, -1e3, 1e3) || !finite(s.morph.depth, -10, 10) || !finite(s.morph.dwell, 0, 0.99)) throw new Error("Invalid morph clock.");
    for (const a of s.automation) {
      if (!safeId(a.id) || !str(a.target, 250) || !["lfo", "ramp"].includes(a.type) || !["sine", "triangle", "square", "saw", "steps", "smooth"].includes(a.wave) || !["replace", "add", "multiply"].includes(a.blend) || !["once", "loop", "pingpong"].includes(a.loop) || ![a.min, a.max, a.rate, a.phase, a.duration, a.delay].every((n) => typeof n === "number" && Number.isFinite(n)) || !(a.firedAt === null || typeof a.firedAt === "number" && Number.isFinite(a.firedAt))) throw new Error("Invalid automation lane.");
    }
  }
  return clone(j);
}
export {
  DEFAULT_ENGINE_SETTINGS,
  DEFAULT_PARAMS,
  blankJourney,
  blankScene,
  chakraEntities,
  clamp,
  clone,
  entity,
  fieldStudies,
  pin,
  sevenCentres,
  smallLanguage,
  uid,
  validateJourney
};
