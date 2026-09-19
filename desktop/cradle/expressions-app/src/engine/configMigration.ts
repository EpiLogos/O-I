/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Snapshot persistence + schema migration.
 *
 * Every saved snapshot carries a `schemaVersion`. Loading always runs the raw stored
 * object through `migrateConfig`, which rebuilds a COMPLETE PointCloudConfig from the
 * engine defaults and only then layers the stored values on top. Subsystems that the
 * snapshot does not mention (e.g. toroidalMorph on a snapshot saved before that feature
 * existed) are therefore reset to their disabled defaults instead of leaking across loads.
 *
 * Version history
 *   0  unversioned legacy snapshots (pre-toroidal / pre-3D-pins; color.angle possibly radians)
 *   1  toroidalMorph + placed 3D pins + velocityInfluence normalised
 *   2  color.angle is always degrees; camera + viewport saved alongside config
 *   3  unified morph (dual-phase), extended physics, anchors with shape, automation lanes
 *   4  first-class entities / composition / cymatic medium (legacy glyph, chaining, spatialChakra migrated)
 *   5  semantic field bindings + explicit resonance driver; chakra meaning no longer lives in physics objects
 *      (still v5, additive: optional `medium` / `collision` physics sections, disabled when absent)
 */

import {
  PointCloudConfig,
  PointCloudColorConfig,
  ToroidalMorphConfig,
  CameraOrbState,
  PlacedInteractionPoint,
  AutomationLane,
  MediumConfig,
  CollisionConfig,
} from './types';
import { DEFAULT_CONFIG, DEFAULT_COLOR_CONFIG, DEFAULT_TOROIDAL_CONFIG } from './PointCloudField';
import { createDefaultChakraConfig } from './chakraSystem';
import { isLightHex } from './colorPalettes';
import { migrateLegacyFieldConfig } from './fieldModel';
import type { SemanticFieldConfig, SemanticBinding } from './semantics/semanticTypes';
import { CHAKRA_BY_ID } from './semantics/chakraSemantics';
import { CHAKRA_PROFILE_ID } from './semantics/chakraProfile';
import type { ResonanceDriveConfig } from './resonanceDrive';

export const CONFIG_SCHEMA_VERSION = 5;
export const SNAPSHOT_STORAGE_KEY = 'typographic_pointcloud_saved_states';

export type SpatialGridMode = 'off' | 'axis' | 'grid';

export interface SnapshotViewState {
  camera?: CameraOrbState;
  gridMode?: SpatialGridMode;
}

export interface SavedSnapshot {
  id: string;
  name: string;
  timestamp: number;
  schemaVersion: number;
  config: PointCloudConfig;
  view?: SnapshotViewState;
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Legacy snapshots (v0/v1) could store `color.angle` either in degrees (from factory presets)
 * or in radians (from the old inspector slider which wrote `deg * PI / 180`). Any value in
 * (0, 2PI] is treated as radians and converted; everything else is already degrees.
 */
function normalizeLegacyAngle(angle: unknown, fromVersion: number): number {
  const a = num(angle, DEFAULT_COLOR_CONFIG.angle);
  if (fromVersion >= 2) return a;
  if (a > 0 && a <= Math.PI * 2 + 1e-6 && !Number.isInteger(a)) {
    return Math.round(((a * 180) / Math.PI) * 100) / 100;
  }
  return a;
}

function migratePlacedPoints(raw: unknown): PlacedInteractionPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object')
    .slice(0, 8)
    .map((p: any, i: number) => ({
      id: typeof p.id === 'string' ? p.id : `pin_migrated_${i}_${Date.now().toString(36)}`,
      name: typeof p.name === 'string' ? p.name : `Pin ${i + 1}`,
      x: num(p.x, 0),
      y: num(p.y, 0),
      z: num(p.z, 0),
      radius: num(p.radius, 200),
      strength: num(p.strength, 2.0),
      mode: p.mode === 'attract' || p.mode === 'vortex' ? p.mode : 'repel',
      active: p.active !== false,
    }));
}

function migrateAutomations(raw: unknown): AutomationLane[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => l && typeof l === 'object' && typeof (l as any).path === 'string')
    .map((l: any, i: number) => ({
      id: typeof l.id === 'string' ? l.id : `auto_migrated_${i}_${Date.now().toString(36)}`,
      ...(typeof l.clockId === 'string' && l.clockId ? {clockId:l.clockId} : {}),
      path: l.path,
      enabled: l.enabled !== false,
      type: l.type === 'oneShot' ? 'oneShot' : 'lfo',
      waveform: l.waveform,
      min: typeof l.min === 'number' ? l.min : undefined,
      max: typeof l.max === 'number' ? l.max : undefined,
      rateHz: typeof l.rateHz === 'number' ? l.rateHz : undefined,
      phase: typeof l.phase === 'number' ? l.phase : undefined,
      from: typeof l.from === 'number' ? l.from : undefined,
      to: typeof l.to === 'number' ? l.to : undefined,
      durationS: typeof l.durationS === 'number' ? l.durationS : undefined,
      easing: l.easing,
      loop: l.loop,
      fireToken: typeof l.fireToken === 'number' ? l.fireToken : 1,
      delayS: typeof l.delayS === 'number' ? l.delayS : undefined,
      blend: l.blend,
    }));
}

function migrateColor(
  raw: Partial<PointCloudColorConfig> | undefined,
  fromVersion: number,
  bg: string
): PointCloudColorConfig {
  if (!raw) {
    return { ...DEFAULT_COLOR_CONFIG, backgroundColor: bg };
  }
  return {
    ...DEFAULT_COLOR_CONFIG,
    ...raw,
    angle: normalizeLegacyAngle(raw.angle, fromVersion),
    fieldCenterOffset:
      Array.isArray(raw.fieldCenterOffset) && raw.fieldCenterOffset.length === 2
        ? [num(raw.fieldCenterOffset[0], 0), num(raw.fieldCenterOffset[1], 0)]
        : [0, 0],
    backgroundColor: bg,
    customPaletteColors: Array.isArray(raw.customPaletteColors) && raw.customPaletteColors.length >= 2
      ? raw.customPaletteColors.slice(0, 8).map((c: unknown) => (typeof c === 'string' ? c : '#ffffff'))
      : undefined,
  };
}

function migrateToroidal(raw: Partial<ToroidalMorphConfig> | undefined): ToroidalMorphConfig {
  if (!raw) return { ...DEFAULT_TOROIDAL_CONFIG, enabled: false };
  return { ...DEFAULT_TOROIDAL_CONFIG, ...raw, enabled: raw.enabled === true };
}

/** Shared medium / glyph colliders: optional sections default to disabled; unknown enum values fall back. */
function migrateMedium(raw: Partial<MediumConfig> | undefined): MediumConfig {
  const base = { ...DEFAULT_CONFIG.medium! };
  if (!raw) return { ...base, enabled: false };
  return {
    ...base,
    ...raw,
    enabled: raw.enabled === true,
    plane: raw.plane === 'world3d' ? 'world3d' : 'compositionPlane',
  };
}

function migrateCollision(raw: Partial<CollisionConfig> | undefined): CollisionConfig {
  const base = { ...DEFAULT_CONFIG.collision! };
  if (!raw) return { ...base, enabled: false };
  return {
    ...base,
    ...raw,
    enabled: raw.enabled === true,
    mode: raw.mode === 'vessel' ? 'vessel' : 'obstacle',
  };
}

function cloneSemanticField(raw: SemanticFieldConfig): SemanticFieldConfig {
  return {
    ...raw,
    profile:{...raw.profile},
    affinity:{...raw.affinity},
    bindings:(raw.bindings||[]).map((b)=>({
      ...b,
      ...(b.resonance?{resonance:{...b.resonance}}:{}),
      carriers:(b.carriers||[]).map((c)=>({...c})),
      ...(b.color?{color:{...b.color,radius:{...b.color.radius}}}:{}),
      ...(b.modulations?{modulations:b.modulations.map((m)=>({...m,source:{...m.source},...(m.clamp?{clamp:[...m.clamp] as [number,number]}:{})}))}:{}),
    })),
  };
}

/** v4 carried semantic chakra identity on Entity. v5 retains appearance but moves meaning into bindings. */
function migrateSemanticField(src: Partial<PointCloudConfig>, entities: NonNullable<PointCloudConfig['entities']>): SemanticFieldConfig {
  if (src.semanticField) return cloneSemanticField(src.semanticField);
  const bindings: SemanticBinding[]=[];
  for(const entity of entities){
    const chakraId=entity.chakraId;
    if(!chakraId||!CHAKRA_BY_ID.has(chakraId as any)) continue;
    bindings.push({
      id:`semantic_${chakraId}_${entity.id}`,
      semanticNodeId:chakraId,
      enabled:true,
      resonance:{gain:1},
      carriers:[{kind:'entity',id:entity.id}],
      // v4 partition tint is retained on the entity. Spatial semantic colour starts disabled so migration is appearance-preserving.
      color:{enabled:false,colorSource:'canonical',gain:1,radius:{source:'force'},falloff:'gaussian',metric:'compositionPlane',blend:'weighted',activation:'constant'},
    });
  }
  return {
    enabled:bindings.length>0,
    profile:{kind:'chakra',profileId:CHAKRA_PROFILE_ID},
    affinity:{method:'modalProjection',bandwidth:.14},
    globalColorGain:1,
    bindings,
  };
}

function migrateResonanceDrive(src: Partial<PointCloudConfig>, field:{composition:NonNullable<PointCloudConfig['composition']>;cymatics:NonNullable<PointCloudConfig['cymatics']>}, semantic:SemanticFieldConfig):ResonanceDriveConfig {
  if(src.resonanceDrive) return {...src.resonanceDrive} as ResonanceDriveConfig;
  const cym=field.cymatics;
  if(cym.autoSweep||cym.sweep?.enabled)return{kind:'sweep',glideS:cym.sweep?.glideS??cym.sweepSpeed,dwellS:cym.sweep?.dwellS,direction:cym.sweep?.direction};
  if(cym.followFocus&&field.composition.orchestration.followStation&&semantic.enabled&&semantic.bindings.length>0)return{kind:'semanticFocus',profileId:semantic.profile.profileId};
  return{kind:'frequency'};
}

/**
 * Rebuild a complete, engine-safe PointCloudConfig from any partial / legacy object.
 * Pure: safe to call from lazy state initialisers and module scope.
 */
export function migrateConfig(
  incoming: Partial<PointCloudConfig> | null | undefined,
  fromVersion: number = CONFIG_SCHEMA_VERSION
): PointCloudConfig {
  const src: Partial<PointCloudConfig> = incoming && typeof incoming === 'object' ? incoming : {};

  const colorMode =
    src.colorMode === 'blackOnWhite' || src.colorMode === 'whiteOnBlack'
      ? src.colorMode
      : src.backgroundColor && isLightHex(src.backgroundColor)
      ? 'blackOnWhite'
      : 'whiteOnBlack';
  const bg =
    src.backgroundColor ||
    src.color?.backgroundColor ||
    (colorMode === 'blackOnWhite' ? '#fafaf9' : '#09090b');

  const chakraDefaults = createDefaultChakraConfig();
  // Field organisation: entities / composition / cymatic medium (legacy glyph/chaining/chakra → entities)
  const field = migrateLegacyFieldConfig({
    ...src,
    interaction: { ...DEFAULT_CONFIG.interaction, ...(src.interaction || {}), placedPoints: migratePlacedPoints(src.interaction?.placedPoints) },
  });
  const semanticField=migrateSemanticField(src,field.entities);
  const resonanceDrive=migrateResonanceDrive(src,field,semanticField);

  return {
    ...DEFAULT_CONFIG,
    ...src,
    colorMode,
    backgroundColor: bg,
    backgroundMode: src.backgroundMode || src.color?.backgroundMode || DEFAULT_CONFIG.backgroundMode,
    backgroundGlowIntensity:
      src.backgroundGlowIntensity ?? src.color?.backgroundGlowIntensity ?? DEFAULT_CONFIG.backgroundGlowIntensity,
    glyph: Array.isArray(src.glyph)
      ? [String(src.glyph[0] ?? 'O'), String(src.glyph[1] ?? src.glyph[0] ?? 'I')]
      : typeof src.glyph === 'string' && src.glyph.length > 0
      ? src.glyph
      : DEFAULT_CONFIG.glyph,
    particleCount: Math.max(512, Math.round(num(src.particleCount, DEFAULT_CONFIG.particleCount))),
    particleSize: {
      min: num(src.particleSize?.min, DEFAULT_CONFIG.particleSize.min),
      max: num(src.particleSize?.max, DEFAULT_CONFIG.particleSize.max),
    },
    fluid: { ...DEFAULT_CONFIG.fluid, ...(src.fluid || {}) },
    interaction: {
      ...DEFAULT_CONFIG.interaction,
      ...(src.interaction || {}),
      velocityInfluence: num(src.interaction?.velocityInfluence, DEFAULT_CONFIG.interaction.velocityInfluence ?? 0.85),
      placedPoints: migratePlacedPoints(src.interaction?.placedPoints),
    },
    relational: src.relational
      ? { ...DEFAULT_CONFIG.relational!, ...src.relational, enabled: src.relational.enabled === true }
      : { ...DEFAULT_CONFIG.relational!, enabled: false },
    pairwise: src.pairwise
      ? { ...DEFAULT_CONFIG.pairwise!, ...src.pairwise, enabled: src.pairwise.enabled === true }
      : { ...DEFAULT_CONFIG.pairwise!, enabled: false },
    chaining: src.chaining
      ? {
          ...DEFAULT_CONFIG.chaining!,
          ...src.chaining,
          chain:
            Array.isArray(src.chaining.chain) && src.chaining.chain.length > 0
              ? [...src.chaining.chain]
              : [...DEFAULT_CONFIG.chaining!.chain],
          enabled: src.chaining.enabled === true,
        }
      : { ...DEFAULT_CONFIG.chaining!, chain: [...DEFAULT_CONFIG.chaining!.chain], enabled: false },
    spatialChakra: src.spatialChakra
      ? {
          ...chakraDefaults,
          ...src.spatialChakra,
          cymatics: { ...chakraDefaults.cymatics!, ...(src.spatialChakra.cymatics || {}) },
          nodes:
            Array.isArray(src.spatialChakra.nodes) && src.spatialChakra.nodes.length > 0
              ? src.spatialChakra.nodes.map((n) => ({ ...n }))
              : chakraDefaults.nodes.map((n) => ({ ...n })),
          enabled: src.spatialChakra.enabled === true,
        }
      : { ...chakraDefaults, enabled: false },
    toroidalMorph: migrateToroidal(src.toroidalMorph),
    medium: migrateMedium(src.medium),
    collision: migrateCollision(src.collision),
    color: migrateColor(src.color, fromVersion, bg),
    automations: migrateAutomations(src.automations),
    entities: field.entities,
    composition: field.composition,
    cymatics: field.cymatics,
    semanticField,
    resonanceDrive,
    morphProgress: num(src.morphProgress, 0),
    autoMorph: src.autoMorph !== undefined ? !!src.autoMorph : DEFAULT_CONFIG.autoMorph,
    autoMorphDuration: num(src.autoMorphDuration, DEFAULT_CONFIG.autoMorphDuration ?? 4.0),
  };
}

function migrateView(raw: any): SnapshotViewState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const view: SnapshotViewState = {};
  if (raw.camera && typeof raw.camera === 'object') {
    view.camera = {
      pitch: num(raw.camera.pitch, 0),
      yaw: num(raw.camera.yaw, 0),
      zoom: num(raw.camera.zoom, 1),
      panX: num(raw.camera.panX, 0),
      panY: num(raw.camera.panY, 0),
    };
  }
  if (raw.gridMode === 'off' || raw.gridMode === 'axis' || raw.gridMode === 'grid') {
    view.gridMode = raw.gridMode;
  }
  return view;
}

export function migrateSnapshot(raw: any, index: number = 0): SavedSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const fromVersion = num(raw.schemaVersion, 0);
  const cfgSource = raw.config && typeof raw.config === 'object' ? raw.config : raw;
  return {
    id: typeof raw.id === 'string' ? raw.id : `state_migrated_${index}_${Date.now().toString(36)}`,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : `Snapshot ${index + 1}`,
    timestamp: num(raw.timestamp, Date.now()),
    schemaVersion: CONFIG_SCHEMA_VERSION,
    config: migrateConfig(cfgSource, fromVersion),
    view: migrateView(raw.view),
  };
}

/** Deep-clone a config into a plain JSON-safe object (drops functions / typed arrays). */
export function serializeConfig(config: PointCloudConfig): PointCloudConfig {
  return JSON.parse(JSON.stringify(config));
}

export function createSnapshot(
  name: string,
  config: PointCloudConfig,
  view?: SnapshotViewState
): SavedSnapshot {
  return {
    id: 'state_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    name,
    timestamp: Date.now(),
    schemaVersion: CONFIG_SCHEMA_VERSION,
    config: serializeConfig(config),
    view: view ? JSON.parse(JSON.stringify(view)) : undefined,
  };
}

/**
 * Load, migrate and (if anything changed) write back the migrated snapshot list.
 * Never throws: a corrupt store yields an empty list and the raw payload is kept
 * under a backup key so nothing is silently destroyed.
 */
export function loadSnapshots(): SavedSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!stored) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (e) {
    console.error('Snapshot store is corrupt; preserving raw payload under backup key.', e);
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY + '_corrupt_backup', stored);
    } catch {
      /* ignore */
    }
    return [];
  }

  const list = Array.isArray(parsed) ? parsed : [];
  const needsMigration = list.some((s: any) => num(s?.schemaVersion, 0) !== CONFIG_SCHEMA_VERSION);
  const migrated = list
    .map((s, i) => {
      try {
        return migrateSnapshot(s, i);
      } catch (e) {
        console.error('Failed to migrate snapshot; skipping.', s, e);
        return null;
      }
    })
    .filter((s): s is SavedSnapshot => s !== null);

  if (needsMigration) {
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY + '_pre_migration_backup', stored);
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(migrated));
    } catch (e) {
      console.warn('Could not persist migrated snapshots', e);
    }
  }
  return migrated;
}

export function persistSnapshots(snapshots: SavedSnapshot[]): boolean {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
    return true;
  } catch (e) {
    console.error('Failed to persist snapshots:', e);
    return false;
  }
}
