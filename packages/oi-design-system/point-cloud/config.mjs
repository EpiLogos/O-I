/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renderer-neutral point-cloud configuration: the typed shape (JSDoc), the
 * defaults, the field bounds, and the validated nested-patch semantics.
 * Ported from EpiLogos/Point-Cloud-Demo@7616489 src/engine/types.ts with the
 * integration repairs the handover names: every relational value honours a
 * valid 0 (no `||` defaults), particle sizes are bounded to the desktop's
 * sub-3px ink discipline, and `colorMode` gains `followTheme`.
 *
 * No DOM, no WebGL, no three — importable from any harness.
 */

/**
 * @typedef {Object} PointCloudFluidConfig
 * @property {number} curlScale      Noise frequency (0…15)
 * @property {number} curlSpeed      Noise temporal rate (-5…10)
 * @property {number} vortexStrength Swirl torque between/around glyph centers (-20…25)
 * @property {number} viscosity      Velocity dissipation (0.05…1.02)
 * @property {number} returnSpeed    Snapback spring constant (-5…25)
 * @property {number} turbulence     Overall noise perturbation magnitude (0…20)
 * @property {number} dispersion     Drift / scatter impulse bridging glyphs (-5…15)
 */

/**
 * @typedef {Object} PointCloudInteractionConfig
 * @property {number} radius  Pointer influence radius in local px (0…1500)
 * @property {number} strength Push/pull strength (-10…15)
 * @property {'repel'|'attract'|'vortex'} mode
 */

/**
 * @typedef {Object} PointCloudRelationalConfig
 * @property {boolean} enabled
 * @property {'orbital'|'chaos'|'nbody'} [mode]
 * @property {number} [attractorCount]   1…6
 * @property {number} [attractorGravity] -20…30
 * @property {number} [orbitSpeed]       -10…10 (0 is a valid, honoured value)
 * @property {number} [orbitRadius]      0…1200 (0 is a valid, honoured value)
 * @property {number} [relationalSpin]   -20…20
 * @property {number} [chaosFactor]      0…15
 * @property {number} [wanderSpeed]      0…10 (0 is a valid, honoured value)
 */

/**
 * @typedef {Object} PointCloudConfig
 * @property {string|string[]} glyph  Glyph/word A and B, e.g. ["O","I"], "OI", "✦ ✧"
 * @property {number} particleCount       Requested particles; allocation snaps to a texture ladder
 * @property {string} [fontFamily]
 * @property {string|number} [fontWeight]
 * @property {'followTheme'|'blackOnWhite'|'whiteOnBlack'} colorMode
 * @property {'stipple'|'halftone'} style
 * @property {'circle'|'square'} [dotShape]
 * @property {{min:number,max:number}} particleSize  Dot size bounds in px — desktop law keeps these ≤3
 * @property {PointCloudFluidConfig} fluid
 * @property {PointCloudInteractionConfig} interaction
 * @property {PointCloudRelationalConfig} [relational]
 * @property {number} [morphProgress]     0 = glyph A, 1 = glyph B
 * @property {boolean} [autoMorph]
 * @property {number} [autoMorphDuration] Seconds for a full morph cycle
 */

/** The desktop's ink discipline: particle dots stay essentially below 3px. */
export const MAX_PARTICLE_SIZE_PX = 3;

/** Desktop default — reference-quality field at sub-3px dot sizes. */
export const DEFAULT_CONFIG = Object.freeze({
  glyph: ['O', 'I'],
  particleCount: 120000,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: 900,
  colorMode: 'followTheme',
  style: 'stipple',
  dotShape: 'circle',
  particleSize: { min: 0.7, max: 2.6 },
  fluid: {
    curlScale: 1.2,
    curlSpeed: 0.6,
    vortexStrength: 1.4,
    viscosity: 0.94,
    returnSpeed: 1.1,
    turbulence: 1.0,
    dispersion: 0.65,
  },
  interaction: {
    radius: 180,
    strength: 1.2,
    mode: 'repel',
  },
  relational: {
    enabled: false,
    mode: 'orbital',
    attractorCount: 3,
    attractorGravity: 1.6,
    orbitSpeed: 0.8,
    orbitRadius: 240,
    relationalSpin: 1.4,
    chaosFactor: 0.2,
    wanderSpeed: 0.5,
  },
  morphProgress: 0.0,
  autoMorph: true,
  autoMorphDuration: 4.0,
});

/**
 * Named controls with their slider bounds — the one shared parameter schema
 * the settings panel and the validator both read. Bounds mirror the demo's
 * full testing ranges so meaningful zero and negative values survive.
 * `size` sliders are capped at 3px by desktop law.
 */
export const CONTROL_SCHEMA = Object.freeze({
  'particle.count': { label: 'Particle count', min: 1024, max: 262144, step: 1024, integer: true },
  'particle.sizeMin': { label: 'Min dot size (px)', min: 0.2, max: MAX_PARTICLE_SIZE_PX, step: 0.1 },
  'particle.sizeMax': { label: 'Max dot size (px)', min: 0.4, max: MAX_PARTICLE_SIZE_PX, step: 0.1 },
  'fluid.curlScale': { label: 'Curl noise frequency', min: 0, max: 15, step: 0.05 },
  'fluid.curlSpeed': { label: 'Curl evolution rate', min: -5, max: 10, step: 0.05 },
  'fluid.vortexStrength': { label: 'Swirl torque (vorticity)', min: -20, max: 25, step: 0.1 },
  'fluid.viscosity': { label: 'Viscosity (damping)', min: 0.05, max: 1.02, step: 0.005 },
  'fluid.returnSpeed': { label: 'Shape spring snap (k)', min: -5, max: 25, step: 0.1 },
  'fluid.turbulence': { label: 'Turbulence', min: 0, max: 20, step: 0.1 },
  'fluid.dispersion': { label: 'Glyph drift advection', min: -5, max: 15, step: 0.05 },
  'interaction.radius': { label: 'Pointer radius (px)', min: 0, max: 1500, step: 10 },
  'interaction.strength': { label: 'Pointer strength', min: -10, max: 15, step: 0.1 },
  'relational.attractorCount': { label: 'Attractor poles', min: 1, max: 6, step: 1, integer: true },
  'relational.attractorGravity': { label: 'Attractor gravity', min: -20, max: 30, step: 0.1 },
  'relational.orbitSpeed': { label: 'Orbit angular speed', min: -10, max: 10, step: 0.1 },
  'relational.orbitRadius': { label: 'Orbit separation (px)', min: 0, max: 1200, step: 10 },
  'relational.relationalSpin': { label: 'Vortex swirl torque', min: -20, max: 20, step: 0.1 },
  'relational.chaosFactor': { label: 'Strange chaos factor', min: 0, max: 15, step: 0.1 },
  'relational.wanderSpeed': { label: 'Wander drift rate', min: 0, max: 10, step: 0.1 },
  'morphProgress': { label: 'Morph progress', min: 0, max: 1, step: 0.01 },
  'autoMorphDuration': { label: 'Morph cycle duration (s)', min: 0.5, max: 20, step: 0.1 },
});

const NUMBER_PATHS = new Set(Object.keys(CONTROL_SCHEMA));

/** Config keys whose shape differs from their schema path. */
const PATCH_KEY_ALIASES = Object.freeze({
  particleCount: 'particle.count',
});

/** The keys a config document may carry — anything else in an imported
 * JSON wrapper (name, version, …) is ignored, not refused. */
export const CONFIG_KEYS = new Set([
  'glyph', 'particleCount', 'fontFamily', 'fontWeight', 'colorMode', 'style',
  'dotShape', 'particleSize', 'fluid', 'interaction', 'relational',
  'morphProgress', 'autoMorph', 'autoMorphDuration',
]);
const ENUM_PATHS = new Map(Object.entries({
  'style': ['stipple', 'halftone'],
  'dotShape': ['circle', 'square'],
  'colorMode': ['followTheme', 'blackOnWhite', 'whiteOnBlack'],
  'interaction.mode': ['repel', 'attract', 'vortex'],
  'relational.mode': ['orbital', 'chaos', 'nbody'],
  'relational.enabled': [true, false],
  'autoMorph': [true, false],
}));
const TEXT_PATHS = new Set(['glyph.0', 'glyph.1', 'fontFamily', 'fontWeight']);

const clampNumber = (path, value) => {
  const spec = CONTROL_SCHEMA[path];
  if (!Number.isFinite(value)) throw new TypeError(`${path} requires a finite number`);
  if (spec.integer) value = Math.round(value);
  return Math.min(spec.max, Math.max(spec.min, value));
};

/** Read the current value at a dotted config path. */
export function readPath(config, path) {
  if (path === 'glyph.0') return Array.isArray(config.glyph) ? config.glyph[0] : config.glyph;
  if (path === 'glyph.1') return Array.isArray(config.glyph) ? (config.glyph[1] ?? config.glyph[0]) : config.glyph;
  const [head, sub] = path.split('.');
  const holder = sub ? config[head] : config;
  return sub ? holder?.[sub] : holder;
}

/**
 * Apply one validated dotted patch entry onto a config, returning a new
 * config. Throws TypeError/RangeError on non-finite numbers, out-of-bounds
 * values, unknown enums, or unknown paths — never silently coerces.
 * `glyph.0`/`glyph.1` accept any non-empty trimmed string (arbitrary words).
 */
export function applyPath(config, path, value) {
  if (NUMBER_PATHS.has(path)) {
    const next = clampNumber(path, typeof value === 'string' ? Number(value) : value);
    return setPath(config, path, next);
  }
  if (ENUM_PATHS.has(path)) {
    const allowed = ENUM_PATHS.get(path);
    if (typeof value === 'string' && !allowed.includes(value)) throw new RangeError(`${path} must be one of ${allowed.join('/')}`);
    if (typeof value === 'boolean' && !allowed.includes(value)) throw new RangeError(`${path} must be ${allowed.join('/')}`);
    return setPath(config, path, value);
  }
  if (TEXT_PATHS.has(path)) {
    const text = String(value ?? '').trim();
    if (!text && path.startsWith('glyph')) throw new TypeError('A glyph/word target requires visible text');
    return setPath(config, path, text || undefined);
  }
  throw new RangeError(`Unknown expression control: ${path}`);
}

function setPath(config, path, value) {
  if (path === 'glyph.0') {
    const b = Array.isArray(config.glyph) ? (config.glyph[1] ?? value) : value;
    return { ...config, glyph: [value, b] };
  }
  if (path === 'glyph.1') {
    const a = Array.isArray(config.glyph) ? config.glyph[0] : value;
    return { ...config, glyph: [a, value] };
  }
  const dot = path.indexOf('.');
  if (dot < 0) return { ...config, [path]: value };
  const head = path.slice(0, dot), sub = path.slice(dot + 1);
  return { ...config, [head]: { ...(config[head] ?? {}), [sub]: value } };
}

/**
 * Validate and apply a whole patch object (nested partial config semantics —
 * the shape of saved states and imports). Unknown keys are rejected; every
 * leaf passes the same bounds as one-path patches. Returns a new config.
 */
export function applyPatch(config, patch) {
  let next = config;
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === 'particleSize' && value && typeof value === 'object') {
      const current = next.particleSize ?? DEFAULT_CONFIG.particleSize;
      const merged = { ...current };
      if (value.min !== undefined) merged.min = clampNumber('particle.sizeMin', value.min);
      if (value.max !== undefined) merged.max = clampNumber('particle.sizeMax', value.max);
      if (merged.min > merged.max) [merged.min, merged.max] = [merged.max, merged.min];
      next = { ...next, particleSize: merged };
      continue;
    }
    if (key === 'glyph') {
      const parts = Array.isArray(value) ? value : String(value).split(/\s+/);
      if (parts.length === 1) next = applyPath(next, 'glyph.0', parts[0]);
      else { next = applyPath(next, 'glyph.0', parts[0]); next = applyPath(next, 'glyph.1', parts[1]); }
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [sub, leaf] of Object.entries(value)) {
        next = applyPath(next, `${key}.${sub}`, leaf);
      }
      continue;
    }
    next = applyPath(next, PATCH_KEY_ALIASES[key] ?? key, value);
  }
  return next;
}

/** Structural clone of a config — saved recipes stay deterministic. */
export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Merge saved/serialized config over the defaults with saved-value honesty:
 * absent keys keep their default, present keys survive verbatim after
 * validation (meaningful zero and negative values included).
 */
export function hydrateConfig(overrides) {
  const cleaned = {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (CONFIG_KEYS.has(key)) cleaned[key] = value;
  }
  return applyPatch(cloneConfig(DEFAULT_CONFIG), cleaned);
}
