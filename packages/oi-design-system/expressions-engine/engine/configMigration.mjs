/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_CONFIG, DEFAULT_COLOR_CONFIG, DEFAULT_TOROIDAL_CONFIG } from "./PointCloudField.mjs";
import { createDefaultChakraConfig } from "./chakraSystem.mjs";
import { isLightHex } from "./colorPalettes.mjs";
import { migrateLegacyFieldConfig } from "./fieldModel.mjs";
const CONFIG_SCHEMA_VERSION = 4;
const SNAPSHOT_STORAGE_KEY = "typographic_pointcloud_saved_states";
const num = (v, fallback) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
function normalizeLegacyAngle(angle, fromVersion) {
  const a = num(angle, DEFAULT_COLOR_CONFIG.angle);
  if (fromVersion >= 2) return a;
  if (a > 0 && a <= Math.PI * 2 + 1e-6 && !Number.isInteger(a)) {
    return Math.round(a * 180 / Math.PI * 100) / 100;
  }
  return a;
}
function migratePlacedPoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p === "object").slice(0, 8).map((p, i) => ({
    id: typeof p.id === "string" ? p.id : `pin_migrated_${i}_${Date.now().toString(36)}`,
    name: typeof p.name === "string" ? p.name : `Pin ${i + 1}`,
    x: num(p.x, 0),
    y: num(p.y, 0),
    z: num(p.z, 0),
    radius: num(p.radius, 200),
    strength: num(p.strength, 2),
    mode: p.mode === "attract" || p.mode === "vortex" ? p.mode : "repel",
    active: p.active !== false
  }));
}
function migrateAutomations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l) => l && typeof l === "object" && typeof l.path === "string").map((l, i) => ({
    id: typeof l.id === "string" ? l.id : `auto_migrated_${i}_${Date.now().toString(36)}`,
    path: l.path,
    enabled: l.enabled !== false,
    type: l.type === "oneShot" ? "oneShot" : "lfo",
    waveform: l.waveform,
    min: typeof l.min === "number" ? l.min : void 0,
    max: typeof l.max === "number" ? l.max : void 0,
    rateHz: typeof l.rateHz === "number" ? l.rateHz : void 0,
    phase: typeof l.phase === "number" ? l.phase : void 0,
    from: typeof l.from === "number" ? l.from : void 0,
    to: typeof l.to === "number" ? l.to : void 0,
    durationS: typeof l.durationS === "number" ? l.durationS : void 0,
    easing: l.easing,
    loop: l.loop,
    fireToken: typeof l.fireToken === "number" ? l.fireToken : 1,
    delayS: typeof l.delayS === "number" ? l.delayS : void 0,
    blend: l.blend
  }));
}
function migrateColor(raw, fromVersion, bg) {
  if (!raw) {
    return { ...DEFAULT_COLOR_CONFIG, backgroundColor: bg };
  }
  return {
    ...DEFAULT_COLOR_CONFIG,
    ...raw,
    angle: normalizeLegacyAngle(raw.angle, fromVersion),
    fieldCenterOffset: Array.isArray(raw.fieldCenterOffset) && raw.fieldCenterOffset.length === 2 ? [num(raw.fieldCenterOffset[0], 0), num(raw.fieldCenterOffset[1], 0)] : [0, 0],
    backgroundColor: bg,
    customPaletteColors: Array.isArray(raw.customPaletteColors) && raw.customPaletteColors.length >= 2 ? raw.customPaletteColors.slice(0, 8).map((c) => typeof c === "string" ? c : "#ffffff") : void 0
  };
}
function migrateToroidal(raw) {
  if (!raw) return { ...DEFAULT_TOROIDAL_CONFIG, enabled: false };
  return { ...DEFAULT_TOROIDAL_CONFIG, ...raw, enabled: raw.enabled === true };
}
function migrateConfig(incoming, fromVersion = CONFIG_SCHEMA_VERSION) {
  const src = incoming && typeof incoming === "object" ? incoming : {};
  const colorMode = src.colorMode === "blackOnWhite" || src.colorMode === "whiteOnBlack" ? src.colorMode : src.backgroundColor && isLightHex(src.backgroundColor) ? "blackOnWhite" : "whiteOnBlack";
  const bg = src.backgroundColor || src.color?.backgroundColor || (colorMode === "blackOnWhite" ? "#fafaf9" : "#09090b");
  const chakraDefaults = createDefaultChakraConfig();
  const field = migrateLegacyFieldConfig({
    ...src,
    interaction: { ...DEFAULT_CONFIG.interaction, ...src.interaction || {}, placedPoints: migratePlacedPoints(src.interaction?.placedPoints) }
  });
  return {
    ...DEFAULT_CONFIG,
    ...src,
    colorMode,
    backgroundColor: bg,
    backgroundMode: src.backgroundMode || src.color?.backgroundMode || DEFAULT_CONFIG.backgroundMode,
    backgroundGlowIntensity: src.backgroundGlowIntensity ?? src.color?.backgroundGlowIntensity ?? DEFAULT_CONFIG.backgroundGlowIntensity,
    glyph: Array.isArray(src.glyph) ? [String(src.glyph[0] ?? "O"), String(src.glyph[1] ?? src.glyph[0] ?? "I")] : typeof src.glyph === "string" && src.glyph.length > 0 ? src.glyph : DEFAULT_CONFIG.glyph,
    particleCount: Math.max(512, Math.round(num(src.particleCount, DEFAULT_CONFIG.particleCount))),
    particleSize: {
      min: num(src.particleSize?.min, DEFAULT_CONFIG.particleSize.min),
      max: num(src.particleSize?.max, DEFAULT_CONFIG.particleSize.max)
    },
    fluid: { ...DEFAULT_CONFIG.fluid, ...src.fluid || {} },
    interaction: {
      ...DEFAULT_CONFIG.interaction,
      ...src.interaction || {},
      velocityInfluence: num(src.interaction?.velocityInfluence, DEFAULT_CONFIG.interaction.velocityInfluence ?? 0.85),
      placedPoints: migratePlacedPoints(src.interaction?.placedPoints)
    },
    relational: src.relational ? { ...DEFAULT_CONFIG.relational, ...src.relational, enabled: src.relational.enabled === true } : { ...DEFAULT_CONFIG.relational, enabled: false },
    chaining: src.chaining ? {
      ...DEFAULT_CONFIG.chaining,
      ...src.chaining,
      chain: Array.isArray(src.chaining.chain) && src.chaining.chain.length > 0 ? [...src.chaining.chain] : [...DEFAULT_CONFIG.chaining.chain],
      enabled: src.chaining.enabled === true
    } : { ...DEFAULT_CONFIG.chaining, chain: [...DEFAULT_CONFIG.chaining.chain], enabled: false },
    spatialChakra: src.spatialChakra ? {
      ...chakraDefaults,
      ...src.spatialChakra,
      cymatics: { ...chakraDefaults.cymatics, ...src.spatialChakra.cymatics || {} },
      nodes: Array.isArray(src.spatialChakra.nodes) && src.spatialChakra.nodes.length > 0 ? src.spatialChakra.nodes.map((n) => ({ ...n })) : chakraDefaults.nodes.map((n) => ({ ...n })),
      enabled: src.spatialChakra.enabled === true
    } : { ...chakraDefaults, enabled: false },
    toroidalMorph: migrateToroidal(src.toroidalMorph),
    color: migrateColor(src.color, fromVersion, bg),
    automations: migrateAutomations(src.automations),
    entities: field.entities,
    composition: field.composition,
    cymatics: field.cymatics,
    morphProgress: num(src.morphProgress, 0),
    autoMorph: src.autoMorph !== void 0 ? !!src.autoMorph : DEFAULT_CONFIG.autoMorph,
    autoMorphDuration: num(src.autoMorphDuration, DEFAULT_CONFIG.autoMorphDuration ?? 4)
  };
}
function migrateView(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const view = {};
  if (raw.camera && typeof raw.camera === "object") {
    view.camera = {
      pitch: num(raw.camera.pitch, 0),
      yaw: num(raw.camera.yaw, 0),
      zoom: num(raw.camera.zoom, 1),
      panX: num(raw.camera.panX, 0),
      panY: num(raw.camera.panY, 0)
    };
  }
  if (raw.gridMode === "off" || raw.gridMode === "axis" || raw.gridMode === "grid") {
    view.gridMode = raw.gridMode;
  }
  return view;
}
function migrateSnapshot(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const fromVersion = num(raw.schemaVersion, 0);
  const cfgSource = raw.config && typeof raw.config === "object" ? raw.config : raw;
  return {
    id: typeof raw.id === "string" ? raw.id : `state_migrated_${index}_${Date.now().toString(36)}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : `Snapshot ${index + 1}`,
    timestamp: num(raw.timestamp, Date.now()),
    schemaVersion: CONFIG_SCHEMA_VERSION,
    config: migrateConfig(cfgSource, fromVersion),
    view: migrateView(raw.view)
  };
}
function serializeConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
function createSnapshot(name, config, view) {
  return {
    id: "state_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    name,
    timestamp: Date.now(),
    schemaVersion: CONFIG_SCHEMA_VERSION,
    config: serializeConfig(config),
    view: view ? JSON.parse(JSON.stringify(view)) : void 0
  };
}
function loadSnapshots() {
  if (typeof localStorage === "undefined") return [];
  let stored = null;
  try {
    stored = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!stored) return [];
  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch (e) {
    console.error("Snapshot store is corrupt; preserving raw payload under backup key.", e);
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY + "_corrupt_backup", stored);
    } catch {
    }
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : [];
  const needsMigration = list.some((s) => num(s?.schemaVersion, 0) !== CONFIG_SCHEMA_VERSION);
  const migrated = list.map((s, i) => {
    try {
      return migrateSnapshot(s, i);
    } catch (e) {
      console.error("Failed to migrate snapshot; skipping.", s, e);
      return null;
    }
  }).filter((s) => s !== null);
  if (needsMigration) {
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY + "_pre_migration_backup", stored);
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(migrated));
    } catch (e) {
      console.warn("Could not persist migrated snapshots", e);
    }
  }
  return migrated;
}
function persistSnapshots(snapshots) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
    return true;
  } catch (e) {
    console.error("Failed to persist snapshots:", e);
    return false;
  }
}
export {
  CONFIG_SCHEMA_VERSION,
  SNAPSHOT_STORAGE_KEY,
  createSnapshot,
  loadSnapshots,
  migrateConfig,
  migrateSnapshot,
  persistSnapshots,
  serializeConfig
};
