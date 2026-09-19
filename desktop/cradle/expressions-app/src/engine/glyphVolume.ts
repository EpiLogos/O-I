/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Glyph volume law.
 *
 * The field has always carried a per-particle z, but for letterforms it was
 * micro-noise (`(Math.random() - 0.5) * 8`): a flat card with a rough surface,
 * which reads as three-dimensional only while it is seen face-on and collapses
 * the moment the camera moves. This module replaces that noise with a real
 * body.
 *
 * The law is a signed distance transform of the rasterized letterform. For any
 * sample we know how deep it sits inside the stroke (`dIn`, zero at the
 * contour, growing toward the medial axis) or how far it has strayed outside
 * it (`dOut`, the stipple spray). Normalizing that penetration gives `t`, and
 * `t` drives a depth profile: the half-thickness of the glyph at that point.
 *
 *   slab    h = 1            a straight extrusion, constant thickness
 *   bevel   h = t            chamfered from the contour, like an embossed die
 *   round   h = sqrt(1-(1-t)^2)   a pillow: steep shoulders, flat crown
 *   dome    h = sqrt(t)      a convex bulge
 *   taper   h = t^2          a knife-edge sliver
 *
 * Placement inside that thickness is then split three ways, because the three
 * families read differently under rotation:
 *
 *   flanks   z spans the full ±h at the contour — the extruded side walls.
 *            Without these a rotated glyph is two parallel sheets of dots and
 *            the eye reads a hollow shell rather than a solid.
 *   faces    z pinned near ±h across the whole interior — the front and back
 *            surfaces.
 *   body     z uniform through (−h, h) — the interior fill.
 *
 * Everything is deterministic: the same glyph, count and configuration always
 * bake the same body, so a re-bake is never a re-roll.
 */

import type {GlyphVolumeConfig} from './types';

/** Placement families. Exposed for tests and the bake statistics line. */
export type VolumeFamily = 'flank' | 'face' | 'body';

export interface GlyphVolumeStats {
  /** Sampled half-thickness range actually written, in world units. */
  minHalfThickness: number;
  maxHalfThickness: number;
  minZ: number;
  maxZ: number;
  flankCount: number;
  faceCount: number;
  bodyCount: number;
  /** Median normalized penetration of inside samples; the auto reference fallback. */
  referenceThickness: number;
}

/**
 * Exact separable Euclidean distance transform (Felzenszwalb & Huttenlocher).
 * `f` holds 0 at seed cells and a large cost elsewhere; the result is the
 * squared distance to the nearest seed. Exact, not a chamfer approximation —
 * the depth profile is a function of this distance, so its error would show up
 * directly as lumpy thickness.
 */
function distanceTransform2D(seed: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e20;
  const size = Math.max(w, h);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  const dt1d = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
  };

  const out = new Float32Array(w * h);
  // Pass 1: rows.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = seed[row + x] ? 0 : INF;
    dt1d(w);
    for (let x = 0; x < w; x++) out[row + x] = d[x];
  }
  // Pass 2: columns over the row result.
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    dt1d(h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  return out;
}

export interface GlyphDepthFields {
  w: number;
  h: number;
  /** Distance in pixels from every cell to the nearest ink cell (0 inside ink). */
  distToInk: Float32Array;
  /** Distance in pixels from every cell to the nearest empty cell (0 outside ink). */
  distInside: Float32Array;
  /** Normalizing half-width of the stroke, in pixels, robust to thick blobs. */
  referenceThickness: number;
}

/** Stable small PRNG so a bake is reproducible across calls and machines. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string, for deriving a per-glyph bake seed. */
export function hashString(value: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Builds the depth fields for one binary ink mask — the source-agnostic form
 * of the law. Character glyphs pass their rasterized alpha through
 * `buildGlyphDepthFields`; image, ASCII, primitive and cymatic pools pass the
 * thresholded mask their candidates were selected from. One distance
 * transform, one body law, every object type.
 */
export function buildDepthFieldsFromMask(inkMask: Uint8Array, w: number, h: number): GlyphDepthFields {
  const ink = inkMask;
  const empty = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) empty[i] = ink[i] ? 0 : 1;

  // distInside seeds on the empty cells (so ink cells measure inward distance),
  // distToInk seeds on the ink cells (so empty cells measure outward distance).
  const insideSq = distanceTransform2D(empty, w, h);
  const outsideSq = distanceTransform2D(ink, w, h);
  const distInside = new Float32Array(w * h);
  const distToInk = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    distInside[i] = Math.sqrt(insideSq[i]);
    distToInk[i] = Math.sqrt(outsideSq[i]);
  }

  // Reference thickness: a high percentile of the inside distance, not the max.
  // A single thick blob (an 'O' bowl) would otherwise set the scale for a whole
  // word and flatten every thin stroke beside it.
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor((w * h) / 40000));
  for (let i = 0; i < w * h; i += stride) if (ink[i]) samples.push(distInside[i]);
  samples.sort((a, b) => a - b);
  const pick = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0;
  const referenceThickness = Math.max(1, pick);

  return {w, h, distToInk, distInside, referenceThickness};
}

/**
 * Builds the depth fields for one rasterized glyph. `alpha` is the RGBA buffer
 * from the glyph canvas; anything above `threshold` counts as ink.
 */
export function buildGlyphDepthFields(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 26
): GlyphDepthFields {
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    ink[i] = alpha[i * 4 + 3] > threshold ? 1 : 0;
  }
  return buildDepthFieldsFromMask(ink, w, h);
}

/**
 * Depth profile: normalized half-thickness as a function of penetration `t`,
 * where t is 0 at the contour and 1 at the medial axis.
 */
export function depthProfile(profile: GlyphVolumeConfig['profile'], t: number): number {
  const c = Math.max(0, Math.min(1, t));
  switch (profile) {
    case 'bevel':
      return c;
    case 'round':
      return Math.sqrt(Math.max(0, 1 - (1 - c) * (1 - c)));
    case 'dome':
      return Math.sqrt(c);
    case 'taper':
      return c * c;
    case 'slab':
    default:
      return 1;
  }
}

export interface VolumeShape {
  /** Half-thickness of the body at this cell, in stage units. */
  half: number;
  /** 0..1 flank weight: 1 at the letterform contour, 0 well inside it. */
  contourness: number;
}

/**
 * The shape half of the law: how thick the body is at one cell, and how much
 * of it belongs to the extruded flank. Kept separate from placement so the
 * rasterized pool can carry (half, contourness) per cell and let every
 * particle draw its own z, instead of a pool that must be duplicated per depth
 * sample.
 */
export function cellVolumeShape(
  dIn: number,
  dOut: number,
  referenceThickness: number,
  density: number,
  config: GlyphVolumeConfig
): VolumeShape {
  const ref = Math.max(1, referenceThickness * Math.max(0.05, config.referenceFalloff));
  const wallBand = Math.max(0.5, config.wallBand);
  const outsideTaper = Math.max(0, config.outsideTaper);
  const inside = dOut <= 0.5;

  let t: number;
  let reach: number;
  if (inside) {
    t = Math.max(0, Math.min(1, dIn / ref));
    reach = 1;
  } else {
    // The stipple spray is a thin cloud hugging the surface, not a body: it
    // tapers to nothing over `outsideTaper` reference widths of stray.
    const stray = dOut / ref;
    const fade = Math.max(0, 1 - stray / Math.max(0.05, outsideTaper));
    t = 0;
    reach = fade * fade;
  }

  // Ink density thickens the body: a dense stroke core carries more mass than a
  // sparse spray, and the eye reads that as weight.
  const densityGain = 1 + Math.max(-1, Math.min(1, config.densityDepth)) * (Math.max(0, Math.min(1, density)) - 0.5) * 2;
  const half = Math.max(0, config.depth) * 0.5 * depthProfile(config.profile, t) * reach * Math.max(0, densityGain);

  // Flank weight is contourness: full at the letterform boundary, gone by
  // `wallBand` pixels inward. Flanks only exist where the solid has an edge.
  const contourness = inside ? Math.max(0, 1 - dIn / wallBand) : reach;

  return {half, contourness};
}

/**
 * The placement half of the law: draws one particle's z inside a body whose
 * half-thickness at that cell is `localHalf`. Three families, because they read
 * differently under rotation — flanks give the extruded silhouette, faces give
 * the sheets, the body gives mass.
 */
export function drawVolumeZ(
  localHalf: number,
  contourness: number,
  config: GlyphVolumeConfig,
  rand: () => number
): {z: number; family: VolumeFamily} {
  const wallShare = Math.max(0, Math.min(1, config.wallShare));
  const faceBias = Math.max(0, Math.min(1, config.faceBias));
  const interiorFill = Math.max(0, Math.min(1, config.interiorFill));
  const surfaceThickness = Math.max(0, config.surfaceThickness);
  const jitter = Math.max(0, config.jitter);

  const flankP = wallShare * Math.max(0, Math.min(1, contourness));

  let z: number;
  let family: VolumeFamily;
  const roll = rand();
  if (roll < flankP) {
    // Extruded side wall: the full span of the thickness at the contour.
    z = (rand() * 2 - 1) * localHalf;
    family = 'flank';
  } else if (roll < flankP + (1 - flankP) * faceBias) {
    // Front or back surface, pinned within `surfaceThickness` of the face so
    // the sheet reads as a surface rather than a haze.
    const inset = rand() * Math.min(surfaceThickness, localHalf * 0.9);
    z = (rand() < 0.5 ? -1 : 1) * Math.max(0, localHalf - inset);
    family = 'face';
  } else {
    // Interior. `interiorFill` widens the occupied band; low values keep the
    // mass near the shell so a rotated glyph is not an opaque slug.
    const span = localHalf * interiorFill;
    // A zero-width band must contribute exactly zero, not a signed zero: this
    // value is compared and cached downstream.
    z = span > 0 ? (rand() * 2 - 1) * span : 0;
    family = 'body';
  }

  if (jitter > 0) z += (rand() * 2 - 1) * jitter;
  return {z, family};
}

/** Default volume law: off, so every existing composition bakes exactly as before. */
export const DEFAULT_GLYPH_VOLUME: GlyphVolumeConfig = {
  enabled: false,
  depth: 90,
  profile: 'round',
  referenceFalloff: 1,
  wallShare: 0.34,
  faceBias: 0.55,
  interiorFill: 0.25,
  jitter: 2,
  densityDepth: 0.35,
  surfaceThickness: 6,
  // The contour band is measured in raster pixels against strokes whose
  // half-width runs to ~100px on a bold letterform. A narrow band confines the
  // flank to a hairline at the very edge — where every profile has tapered to
  // almost nothing — and the body never grows a visible side wall. The band is
  // therefore a substantial fraction of the stroke, so the extrusion has depth.
  wallBand: 42,
  outsideTaper: 0.6,
};

/**
 * Writes real depth into an already-baked target array.
 *
 * Mutates `data` in place, one vec4 per particle (x, y, z, density). The planar
 * x/y and the density are left exactly as the 2D law produced them, so a
 * face-on composition is unchanged; only z stops being noise.
 *
 * `worldScale` converts canvas pixels to world units, matching the sampler.
 */
export function applyGlyphVolume(
  data: Float32Array,
  particleCount: number,
  fields: GlyphDepthFields,
  worldScale: number,
  config: GlyphVolumeConfig,
  seed: number
): GlyphVolumeStats {
  const {w, h, distInside, distToInk, referenceThickness} = fields;
  const rand = mulberry32(seed);

  let flankCount = 0;
  let faceCount = 0;
  let bodyCount = 0;
  let minHalf = Infinity;
  let maxHalf = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < particleCount; i++) {
    const x = data[i * 4];
    const y = data[i * 4 + 1];
    const density = data[i * 4 + 3];

    // Invert the sampler's projection to recover the canvas cell this point came from.
    const px = Math.max(0, Math.min(w - 1, Math.round(x / worldScale + w / 2)));
    const py = Math.max(0, Math.min(h - 1, Math.round(h / 2 - y / worldScale)));
    const cell = py * w + px;

    const shape = cellVolumeShape(distInside[cell], distToInk[cell], referenceThickness, density, config);
    const {z, family} = drawVolumeZ(shape.half, shape.contourness, config, rand);
    if (family === 'flank') flankCount++;
    else if (family === 'face') faceCount++;
    else bodyCount++;

    data[i * 4 + 2] = z;
    if (shape.half < minHalf) minHalf = shape.half;
    if (shape.half > maxHalf) maxHalf = shape.half;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minHalf)) {
    minHalf = 0;
    maxHalf = 0;
    minZ = 0;
    maxZ = 0;
  }

  return {
    minHalfThickness: minHalf,
    maxHalfThickness: maxHalf,
    minZ,
    maxZ,
    flankCount,
    faceCount,
    bodyCount,
    referenceThickness,
  };
}

/** Which family a sample belongs to, for the bake report. */
export function dominantFamily(stats: GlyphVolumeStats): VolumeFamily {
  if (stats.flankCount >= stats.faceCount && stats.flankCount >= stats.bodyCount) return 'flank';
  if (stats.faceCount >= stats.bodyCount) return 'face';
  return 'body';
}

/**
 * Extruded-glyph slab SDF: the signed distance to a 2D letterform given real
 * thickness. Outside the slab the distance is dominated by the 2D field; within
 * the thickness band it is the inward/outward distance along the normal.
 *
 *   d = min( max(d2d, z - h), 0 ) + length( max(vec2(d2d, |z| - h), 0) )
 *
 * which is the exact SDF of the Minkowski product of a 2D shape with a segment:
 * a genuine prism, not a 2D wall that ignores z. Used by the collision pass so
 * a particle can no longer pass through a letterform's thickness.
 */
export function slabDistance(d2d: number, z: number, halfThickness: number): number {
  const dz = Math.abs(z) - halfThickness;
  const outside2d = Math.max(d2d, 0);
  const outsideZ = Math.max(dz, 0);
  if (outside2d === 0 && outsideZ === 0) {
    return Math.max(d2d, dz);
  }
  return Math.hypot(outside2d, outsideZ);
}
