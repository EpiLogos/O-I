import { stateSource } from "./sourceState.mjs";
import { resolvedAutomation, automationLeader } from "./automationLinks.mjs";
import { applyNativeDelta } from "./nativeDelta.mjs";
import { DEFAULT_CONFIG, DEFAULT_COLOR_CONFIG, DEFAULT_TOROIDAL_CONFIG } from "../engine/PointCloudField.mjs";
import { DEFAULT_SEQUENCE, DEFAULT_FORCES, DEFAULT_COMPOSITION, DEFAULT_CYMATIC_MEDIUM, MAX_FORMATIONS, MAX_PINS } from "../engine/fieldModel.mjs";
import { makeSemanticChakraEntities } from "../engine/semantics/chakraPresets.mjs";
import { migrateSnapshot, CONFIG_SCHEMA_VERSION } from "../engine/configMigration.mjs";
import { writePath, readPath } from "../engine/automation.mjs";
import { NATIVE_BINDINGS, WORLD_SCALE, baseValue, bindValue, nativeBinding, automationTarget, entityTargets, stableNativeTarget } from "./nativeParameters.mjs";
import { clone, blankJourney, blankScene, entity, validateJourney, DEFAULT_ENGINE_SETTINGS } from "./model.mjs";
const MATERIAL_KEYS = ["sizeBias", "opacity", "roundness", "softness", "irregularity", "elongation", "orientation", "contrast", "densityScale", "densityPhase", "edgeWeight", "halo"];
function assertSafe(value, depth = 0) {
  if (depth > 30) throw new Error("Document nesting exceeds the safe limit");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite document value");
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(k)) throw new Error("Unsafe document key: " + k);
    if ((k === "path" || k === "nativePath") && typeof v === "string" && v.split(".").some((p) => ["__proto__", "constructor", "prototype"].includes(p))) throw new Error("Unsafe automation path");
    assertSafe(v, depth + 1);
  }
}
function checkNativeLimits(s) {
  if (s.entities.filter((e) => e.kind === "formation").length > MAX_FORMATIONS) throw new Error(`The native field supports ${MAX_FORMATIONS} formations per scene. Nothing was imported or discarded.`);
  if (s.entities.filter((e) => e.kind === "pin").length > MAX_PINS) throw new Error(`The native field supports ${MAX_PINS} pins per scene. Nothing was imported or discarded.`);
  for (const b of NATIVE_BINDINGS) {
    const value = baseValue(s, b.key);
    if (!Number.isFinite(value) || value < b.hardMin || value > b.hardMax) throw new Error(`${b.label} is outside its native validated bounds (${b.hardMin}\u2013${b.hardMax}).`);
  }
}
function shapeOf(e, native) {
  if (e.shape === "yantra") return { ...native, kind: "yantra", yantraId: e.yantraId ?? native?.yantraId ?? "anahata" };
  if (e.shape === "cymatic") return { ...native, kind: "cymatic", frequencyHz: e.templateFrequency ?? native?.frequencyHz ?? 396, plateGeometry: e.templateGeometry, dimension: e.templateDimension };
  if (e.shape === "text") return { ...native, kind: "glyph", text: e.text.trim() || "O" };
  return { kind: "primitive", primitive: e.shape };
}
function toNativeEntity(e, semanticAuthority = false) {
  const original = e.native;
  const { enabled, clock, steps, manual, ...nativeSequence } = e.sequence;
  const sequence = { ...DEFAULT_SEQUENCE, ...original?.sequence, ...nativeSequence, links: [] };
  const hold = e.sequence.hold ?? e.sequence.steps[0]?.hold ?? sequence.hold;
  const transition = e.sequence.transition ?? e.sequence.steps[0]?.transition ?? sequence.transition;
  return {
    ...original,
    id: e.id,
    name: e.name,
    kind: e.kind,
    enabled: e.enabled !== false,
    x: e.position.x * WORLD_SCALE,
    y: e.position.y * WORLD_SCALE,
    z: e.position.z * WORLD_SCALE,
    scale: e.scale ?? 1,
    extent: { width: e.size.x * WORLD_SCALE, height: e.size.y * WORLD_SCALE, rotation: e.rotation * Math.PI / 180, normalized: original ? original.extent?.normalized ?? !!original.extent : true },
    share: e.kind === "pin" ? 0 : e.share,
    shape: shapeOf(e, original?.shape),
    sequence: {
      ...sequence,
      hold,
      transition,
      advance: e.sequence.enabled ? e.sequence.clock === "morph" ? "morphCycle" : "time" : "off",
      links: e.kind === "pin" ? [] : e.sequence.enabled || e.sequence.manual ? e.sequence.steps.map((k) => ({
        ...k.native,
        id: k.id,
        name: k.name,
        source: k.source ? clone(k.source) : void 0,
        state: k.objectState ? { scale: k.objectState.scale ?? 1, extent: { width: k.objectState.size.x * WORLD_SCALE, height: k.objectState.size.y * WORLD_SCALE, rotation: k.objectState.rotation * Math.PI / 180, normalized: true }, tint: k.objectState.tint, tintWeight: k.objectState.tintWeight, forces: { mode: k.objectState.force.kind, strength: k.objectState.force.strength, radius: k.objectState.force.radius * WORLD_SCALE, spin: k.objectState.force.spin } } : void 0,
        shape: shapeOf(k, k.native?.shape),
        hold: k.holdOverride ? k.hold : e.sequence.hold === void 0 && k.hold !== hold ? k.hold : void 0,
        transition: k.transitionOverride ? k.transition : e.sequence.transition === void 0 && k.transition !== transition ? k.transition : void 0,
        x: k.position ? k.position.x * WORLD_SCALE : void 0,
        y: k.position ? k.position.y * WORLD_SCALE : void 0,
        z: k.position ? k.position.z * WORLD_SCALE : void 0
      })) : [{ id: e.id + "_base", source: e.source ? clone(e.source) : void 0, shape: shapeOf(e, original?.shape) }]
    },
    forces: { ...DEFAULT_FORCES, ...original?.forces, mode: e.force.kind, strength: e.force.strength, radius: e.force.radius * WORLD_SCALE, spin: e.force.spin },
    authoringSource: e.sequence.enabled || e.sequence.manual ? stateSource(e, 0) ? clone(stateSource(e, 0)) : void 0 : e.source ? clone(e.source) : void 0,
    tint: e.tint,
    tintWeight: e.tintWeight,
    stationIndex: semanticAuthority ? original?.stationIndex : e.station ?? original?.stationIndex,
    chakraId: semanticAuthority ? original?.chakraId : original?.chakraId
  };
}
const waves = { sine: "sine", triangle: "triangle", square: "square", saw: "saw", steps: "randomStep", smooth: "smoothRandom", morph: "morph" };
function projectNativeConfig(s) {
  checkNativeLimits(s);
  const original = s.native?.config;
  let cfg = clone(original ?? DEFAULT_CONFIG);
  cfg.color = { ...DEFAULT_COLOR_CONFIG, ...cfg.color };
  cfg.toroidalMorph = { ...DEFAULT_TOROIDAL_CONFIG, ...cfg.toroidalMorph };
  cfg.composition = { ...DEFAULT_COMPOSITION, ...cfg.composition, orchestration: { ...DEFAULT_COMPOSITION.orchestration, ...cfg.composition?.orchestration } };
  cfg.cymatics = { ...DEFAULT_CYMATIC_MEDIUM, ...cfg.cymatics };
  for (const b of NATIVE_BINDINGS) cfg = writePath(cfg, b.path, baseValue(s, b.key) * b.factor);
  cfg.particleCount = Math.floor(cfg.particleCount);
  cfg.backgroundColor = s.field.background;
  cfg.backgroundMode = s.engine.backgroundMode ?? "solid";
  cfg.fontFamily = s.engine.fontFamily ?? cfg.fontFamily;
  const authoredWeight = s.engine.fontWeight ?? cfg.fontWeight;
  cfg.fontWeight = typeof authoredWeight === "string" && /^\d+$/.test(authoredWeight) ? Number(authoredWeight) : authoredWeight;
  cfg.color = { ...DEFAULT_COLOR_CONFIG, ...cfg.color, enabled: s.engine.colorEnabled !== false, mode: s.engine.colorMode, primaryColor: s.field.palette[0], secondaryColor: s.field.palette.at(-1), accentColor: s.field.palette[Math.floor(s.field.palette.length / 2)], customPaletteColors: s.engine.paletteSource === "legacy" ? void 0 : [...s.field.palette], backgroundColor: s.field.background, backgroundMode: s.engine.backgroundMode ?? "solid" };
  cfg.colorMode = s.engine.inkMode ?? cfg.colorMode;
  if (s.engine.paletteId) cfg.color.paletteId = s.engine.paletteId;
  cfg.style = s.field.material === "print" ? "halftone" : "stipple";
  cfg.dotShape = s.engine.dotShape ?? "circle";
  if (s.engine.grainProfile === false) cfg.material = void 0;
  const semanticAuthority = !!s.semanticField?.enabled;
  cfg.entities = s.entities.map((e) => toNativeEntity(e, semanticAuthority));
  const first = s.entities.find((e) => e.kind === "formation" && e.enabled !== false);
  cfg.sourceType = first?.source?.kind === "image" ? "image" : first?.source?.kind === "ascii" ? "ascii" : "composition";
  cfg.customImage = first?.source?.kind === "image" ? clone(first.source.image) : void 0;
  cfg.asciiGlyph = first?.source?.kind === "ascii" ? clone(first.source.ascii) : void 0;
  cfg.toroidalMorph = { ...DEFAULT_TOROIDAL_CONFIG, ...cfg.toroidalMorph, enabled: s.engine.morphEnabled, autoOscillate: s.engine.autoOscillate, trajectory: s.engine.trajectory, driveShape: s.engine.driveShape, interference: s.morph.law === "theta" ? "toroidalOnly" : s.morph.law };
  const semanticFocus = s.composition.frequencyDriver === "focus" && semanticAuthority;
  const legacyFocus = s.composition.frequencyDriver === "focus" && !semanticAuthority;
  cfg.composition = { ...DEFAULT_COMPOSITION, ...cfg.composition, plane: s.engine.mediumPlane, layoutName: s.composition.layout, orchestration: {
    ...DEFAULT_COMPOSITION.orchestration,
    ...cfg.composition?.orchestration,
    mode: s.composition.focus === "travelling" ? "focus" : "parallel",
    order: s.engine.focusOrder ?? "listed",
    followStation: legacyFocus && s.composition.carryStation,
    focusTintWeight: s.composition.carryTint ? cfg.composition?.orchestration.focusTintWeight ?? 0 : 0
  } };
  cfg.cymatics = { ...DEFAULT_CYMATIC_MEDIUM, ...cfg.cymatics, plateGeometry: s.engine.templateGeometry ?? cfg.cymatics.plateGeometry, dimension: s.engine.templateDimension ?? cfg.cymatics.dimension, enabled: s.engine.resonanceEnabled, engine: s.engine.resonatorMode ?? "resonator", followFocus: legacyFocus, autoSweep: s.engine.autoSweep && s.composition.frequencyDriver === "automation", sweep: { glideS: 8, dwellS: 2, ...cfg.cymatics?.sweep, enabled: s.engine.autoSweep && s.composition.frequencyDriver === "automation", direction: s.engine.sweepDirection } };
  cfg.semanticField = s.semanticField ? clone(s.semanticField) : void 0;
  if (s.composition.frequencyDriver === "focus" && semanticAuthority) cfg.resonanceDrive = { kind: "semanticFocus", profileId: s.semanticField.profile.profileId };
  else if (s.composition.frequencyDriver === "automation" && s.engine.autoSweep) cfg.resonanceDrive = { kind: "sweep", glideS: cfg.cymatics.sweep?.glideS, dwellS: cfg.cymatics.sweep?.dwellS, direction: cfg.cymatics.sweep?.direction };
  else if (s.composition.frequencyDriver !== "focus") cfg.resonanceDrive = { kind: "frequency" };
  else cfg.resonanceDrive = void 0;
  cfg.relational = { ...cfg.relational, enabled: s.engine.relationalEnabled, mode: s.engine.relationalMode };
  cfg.interaction = { ...cfg.interaction, mode: s.engine.pointerMode, clickMode: s.engine.pointerClick ?? "pulse", placedPoints: [] };
  cfg.automations = s.automation.map((authored) => {
    const l = resolvedAutomation(s.automation, authored), leader = automationLeader(s.automation, authored);
    const b = automationTarget(s, l.target);
    if (!b) return l.nativePath ? { ...original?.automations?.find((a) => a.id === l.nativeId), id: l.nativeId ?? l.id, path: l.nativePath, enabled: false, type: l.type === "lfo" ? "lfo" : "oneShot" } : null;
    const factor = l.blend === "multiply" ? 1 : b.factor;
    return {
      ...l.syncWith || leader.clockId ? { clockId: leader.clockId ?? leader.nativeId ?? leader.id } : {},
      id: l.nativeId ?? l.id,
      path: b.path,
      enabled: l.enabled && (b.path !== "cymatics.frequencyHz" || s.composition.frequencyDriver === "automation"),
      type: l.type === "lfo" ? "lfo" : "oneShot",
      waveform: waves[l.wave],
      min: l.min * factor,
      max: l.max * factor,
      rateHz: l.rate,
      phase: l.phase,
      blend: l.blend,
      from: l.min * factor,
      to: l.max * factor,
      durationS: l.duration,
      delayS: l.delay,
      easing: l.easing ?? "smooth",
      loop: l.loop === "once" ? "none" : l.loop === "loop" ? "restart" : "pingpong",
      fireToken: l.firedAt ?? 0
    };
  }).filter((l) => !!l);
  return cfg;
}
function toNativeConfig(s) {
  const projected = projectNativeConfig(s);
  if (!s.native) return projected;
  const baseline = s.native.projection ?? nativeSnapshotToJourney({ schemaVersion: CONFIG_SCHEMA_VERSION, config: s.native.config }).scenes[0].native.projection;
  return applyNativeDelta(s.native.config, baseline, projected);
}
const shellShape = (s) => s.kind === "glyph" ? "text" : s.kind === "primitive" ? s.primitive ?? "disc" : s.kind;
function fromNativeEntity(e) {
  const out = entity(e.name, e.shape.text ?? "", { x: e.x / WORLD_SCALE, y: e.y / WORLD_SCALE, z: e.z / WORLD_SCALE });
  out.id = e.id;
  out.kind = e.kind;
  out.enabled = e.enabled;
  out.native = clone(e);
  out.scale = e.scale;
  out.shape = shellShape(e.shape);
  out.yantraId = e.shape.yantraId;
  out.templateFrequency = e.shape.frequencyHz;
  out.templateGeometry = e.shape.plateGeometry;
  out.templateDimension = e.shape.dimension;
  out.size = e.extent ? { x: e.extent.width / WORLD_SCALE, y: e.extent.height / WORLD_SCALE } : { x: 1, y: 1 };
  out.rotation = (e.extent?.rotation ?? 0) * 180 / Math.PI;
  out.share = e.kind === "pin" ? 0 : e.share;
  out.tint = e.tint;
  out.tintWeight = e.tintWeight;
  out.force = { kind: e.forces.mode, strength: e.forces.strength, radius: e.forces.radius / WORLD_SCALE, spin: e.forces.spin };
  out.station = e.stationIndex ?? null;
  out.sequence = { ...e.sequence, manual: e.sequence.advance === "off" && e.sequence.links.length > 1, enabled: e.sequence.advance !== "off", clock: e.sequence.advance === "morphCycle" ? "morph" : "seconds", steps: (e.sequence.links.length ? e.sequence.links : [{ id: e.id + "_base", source: e.authoringSource ? clone(e.authoringSource) : void 0, shape: e.shape }]).map((k) => ({
    id: k.id,
    name: k.name,
    source: k.source ? clone(k.source) : void 0,
    objectState: k.state ? { scale: k.state.scale, size: { x: (k.state.extent?.width ?? 400) / WORLD_SCALE, y: (k.state.extent?.height ?? 400) / WORLD_SCALE }, rotation: (k.state.extent?.rotation ?? 0) * 180 / Math.PI, tint: k.state.tint, tintWeight: k.state.tintWeight, force: { kind: k.state.forces.mode, strength: k.state.forces.strength, radius: k.state.forces.radius / WORLD_SCALE, spin: k.state.forces.spin } } : void 0,
    native: clone(k),
    holdOverride: k.hold !== void 0,
    transitionOverride: k.transition !== void 0,
    text: k.shape.text ?? "",
    shape: shellShape(k.shape),
    yantraId: k.shape.yantraId,
    templateFrequency: k.shape.frequencyHz,
    templateGeometry: k.shape.plateGeometry,
    templateDimension: k.shape.dimension,
    hold: k.hold ?? e.sequence.hold,
    transition: k.transition ?? e.sequence.transition,
    position: k.x !== void 0 || k.y !== void 0 || k.z !== void 0 ? { x: (k.x ?? 0) / WORLD_SCALE, y: (k.y ?? 0) / WORLD_SCALE, z: (k.z ?? 0) / WORLD_SCALE } : null
  })) };
  if (e.authoringSource) out.source = clone(e.authoringSource);
  return out;
}
function nativeSnapshotToJourney(raw, index = 0) {
  assertSafe(raw);
  if (!raw || typeof raw !== "object") throw new Error("Not a native scene configuration");
  const value = raw;
  if (Number(value.schemaVersion ?? 0) > CONFIG_SCHEMA_VERSION) throw new Error(`Native schema ${value.schemaVersion} is newer than ${CONFIG_SCHEMA_VERSION}; the original is unchanged.`);
  const source = value.config ?? value;
  if (!source || !["entities", "fluid", "glyph", "spatialChakra", "particleCount"].some((k) => k in source)) throw new Error("Not a recognised native configuration");
  if (!source.entities && Array.isArray(source.interaction?.placedPoints) && source.interaction.placedPoints.length > 8) throw new Error("Native pin capacity exceeded; original entries have not been truncated.");
  const rawEntities = source.entities;
  if (Array.isArray(rawEntities) && (rawEntities.filter((e) => e.kind === "formation").length > 10 || rawEntities.filter((e) => e.kind === "pin").length > 8)) throw new Error("Native capacity exceeded; no entities were silently truncated.");
  const snapshot = migrateSnapshot(value, index);
  if (!snapshot) throw new Error("Native migration returned no scene");
  const cfg = snapshot.config, s = blankScene(snapshot.name), j = blankJourney();
  const completeNative = Number(value.schemaVersion) >= 4 && Number(value.schemaVersion) <= CONFIG_SCHEMA_VERSION && source.fluid && source.interaction && source.particleSize && typeof source.particleCount === "number" && Array.isArray(source.entities);
  s.native = { config: clone(completeNative ? source : cfg), original: clone(raw) };
  s.text = [];
  s.engine = { ...DEFAULT_ENGINE_SETTINGS, inkMode: cfg.colorMode, templateGeometry: cfg.cymatics?.plateGeometry, templateDimension: cfg.cymatics?.dimension, resonanceEnabled: cfg.cymatics?.enabled ?? false, morphEnabled: cfg.toroidalMorph?.enabled ?? false, autoOscillate: cfg.toroidalMorph?.autoOscillate ?? true, trajectory: cfg.toroidalMorph?.trajectory ?? "linear", driveShape: cfg.toroidalMorph?.driveShape ?? "sine", relationalEnabled: cfg.relational?.enabled ?? false, relationalMode: cfg.relational?.mode ?? "orbital", pointerMode: cfg.interaction.mode, pointerClick: cfg.interaction.clickMode ?? "pulse", pointerClickStrength: cfg.interaction.clickStrength ?? 2.2, pointerClickRadius: (cfg.interaction.clickRadius ?? 180) / 400, colorMode: cfg.color?.mode ?? "monochrome", colorEnabled: cfg.color?.enabled ?? false, mediumPlane: cfg.composition?.plane ?? "vertical", autoSweep: cfg.cymatics?.sweep?.enabled ?? cfg.cymatics?.autoSweep ?? false, sweepDirection: cfg.cymatics?.sweep?.direction ?? "ascent" };
  s.field.background = cfg.backgroundColor ?? cfg.color?.backgroundColor ?? "#f4f2eb";
  s.field.material = cfg.style === "halftone" ? "print" : "ink";
  s.field.palette = cfg.color?.customPaletteColors?.length ? cfg.color.customPaletteColors.slice(0, 8) : [cfg.color?.primaryColor ?? "#252720", cfg.color?.accentColor ?? "#252720", cfg.color?.secondaryColor ?? "#252720"];
  for (const b of NATIVE_BINDINGS) {
    const v = readPath(cfg, b.path);
    if (typeof v === "number") bindValue(s, b.bind, v / b.factor);
  }
  if (cfg.cymatics?.sweep?.glideS === void 0) bindValue(s, "field.params.native_cymatics__sweep__glideS", nativeBinding("native_cymatics__sweep__glideS").defaultValue);
  s.engine.paletteId = cfg.color?.paletteId;
  s.engine.paletteSource = cfg.color?.customPaletteColors?.length ? "custom" : "legacy";
  if (cfg.paperGrain === void 0) s.field.params.grain = 0;
  s.engine.grainProfile = !!cfg.material;
  s.engine.backgroundMode = cfg.backgroundMode ?? cfg.color?.backgroundMode ?? "solid";
  s.engine.dotShape = cfg.dotShape ?? "circle";
  s.engine.fontFamily = cfg.fontFamily;
  s.engine.fontWeight = cfg.fontWeight;
  s.engine.resonatorMode = cfg.cymatics?.engine ?? "resonator";
  s.engine.focusOrder = cfg.composition?.orchestration.order ?? "listed";
  s.entities = (cfg.entities ?? []).map(fromNativeEntity);
  s.semanticField = cfg.semanticField ? clone(cfg.semanticField) : void 0;
  s.resonanceDrive = cfg.resonanceDrive ? clone(cfg.resonanceDrive) : void 0;
  const first = s.entities.find((e) => e.kind === "formation" && e.enabled !== false);
  if (first && !first.source) {
    if (cfg.sourceType === "image" && cfg.customImage?.dataUrl) first.source = { kind: "image", image: clone(cfg.customImage) };
    else if (cfg.sourceType === "ascii" && cfg.asciiGlyph?.text) first.source = { kind: "ascii", ascii: clone(cfg.asciiGlyph) };
  }
  if (value.authoringView) s.view = clone(value.authoringView);
  else if (snapshot.view?.camera) s.view.nativeCamera = clone(snapshot.view.camera);
  s.composition.layout = cfg.composition?.layoutName ?? "free";
  s.composition.focus = cfg.composition?.orchestration.mode === "focus" ? "travelling" : "parallel";
  s.composition.carryTint = (cfg.composition?.orchestration.focusTintWeight ?? 0) > 0;
  s.composition.carryStation = cfg.composition?.orchestration.followStation ?? false;
  s.composition.frequencyDriver = cfg.resonanceDrive?.kind === "semanticFocus" ? "focus" : cfg.resonanceDrive?.kind === "sweep" || cfg.cymatics?.sweep?.enabled || cfg.cymatics?.autoSweep || cfg.automations?.some((l) => l.enabled && l.path === "cymatics.frequencyHz") ? "automation" : cfg.cymatics?.followFocus ? "focus" : "manual";
  s.morph.law = cfg.toroidalMorph?.interference === "toroidalOnly" ? "theta" : cfg.toroidalMorph?.interference ?? "theta";
  s.automation = (cfg.automations ?? []).map((l) => {
    const b = NATIVE_BINDINGS.find((b2) => b2.path === l.path), eb = entityTargets(s).find((b2) => b2.path === l.path);
    const factor = l.blend === "multiply" ? 1 : b?.factor ?? eb?.factor ?? 1;
    const clockLeader = l.clockId ? (cfg.automations ?? []).find((a) => a.id === l.clockId) ?? (cfg.automations ?? []).find((a) => a.clockId === l.clockId) : void 0;
    return { ...l.clockId ? { clockId: l.clockId } : {}, ...clockLeader && clockLeader.id !== l.id ? { syncWith: clockLeader.id } : {}, id: l.id, nativeId: l.id, nativePath: l.path, entityId: eb?.entityId, enabled: l.enabled, target: b ? "field." + b.key : eb?.target ?? stableNativeTarget(s, l.path), type: l.type === "lfo" ? "lfo" : "ramp", wave: l.waveform === "randomStep" ? "steps" : l.waveform === "smoothRandom" ? "smooth" : l.waveform ?? "sine", min: (l.type === "lfo" ? l.min ?? 0 : l.from ?? 0) / factor, max: (l.type === "lfo" ? l.max ?? 1 : l.to ?? 1) / factor, rate: l.rateHz ?? 0.25, phase: l.phase ?? 0, blend: l.blend ?? "replace", duration: l.durationS ?? 2, delay: l.delayS ?? 0, loop: l.loop === "restart" ? "loop" : l.loop === "pingpong" ? "pingpong" : "once", firedAt: l.fireToken ?? null, easing: l.easing ?? "smooth" };
  });
  if (snapshot.view?.gridMode && !s.view.nativeScaffold) s.view.nativeScaffold = snapshot.view.gridMode;
  j.name = snapshot.name;
  j.description = "Native scene configuration imported through schema-5 migration. Original payload retained; this is not a runtime checkpoint.";
  j.scenes = [s];
  checkNativeLimits(s);
  s.native.projection = clone(projectNativeConfig(s));
  return validateJourney(j);
}
function importDocuments(raw) {
  const journeys = [], errors = [];
  for (const [index, v] of (Array.isArray(raw) ? raw : [raw]).entries()) try {
    assertSafe(v);
    const j = v?.schema === "oi.journey" ? validateJourney(v) : nativeSnapshotToJourney(v, index);
    j.scenes.forEach(checkNativeLimits);
    journeys.push(j);
  } catch (e) {
    errors.push({ index, message: e instanceof Error ? e.message : String(e) });
  }
  return { journeys, errors };
}
function nativeExport(s) {
  return { schemaVersion: CONFIG_SCHEMA_VERSION, id: s.id, name: s.name, timestamp: Date.now(), config: toNativeConfig(s), authoringView: clone(s.view), source: s.native?.original };
}
function nativeChakras() {
  return makeSemanticChakraEntities("yantra").slice().reverse().map((e, i) => {
    const out = fromNativeEntity(e);
    out.position = { x: 0.18, y: -0.82 + i * 0.274, z: 0 };
    out.size = { x: 0.235, y: 0.235 };
    out.scale = 1;
    out.native = { ...e, extent: { width: 94, height: 94, rotation: 0 } };
    out.force.radius = 0.27;
    return out;
  });
}
export {
  MATERIAL_KEYS,
  assertSafe,
  checkNativeLimits,
  fromNativeEntity,
  importDocuments,
  nativeChakras,
  nativeExport,
  nativeSnapshotToJourney,
  toNativeConfig,
  toNativeEntity
};
