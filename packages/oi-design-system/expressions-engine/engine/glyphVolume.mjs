/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
function distanceTransform2D(seed, w, h) {
  const INF = 1e20;
  const size = Math.max(w, h);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  const dt1d = (n) => {
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
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = seed[row + x] ? 0 : INF;
    dt1d(w);
    for (let x = 0; x < w; x++) out[row + x] = d[x];
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    dt1d(h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  return out;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function buildDepthFieldsFromMask(inkMask, w, h) {
  const ink = inkMask;
  const empty = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) empty[i] = ink[i] ? 0 : 1;
  const insideSq = distanceTransform2D(empty, w, h);
  const outsideSq = distanceTransform2D(ink, w, h);
  const distInside = new Float32Array(w * h);
  const distToInk = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    distInside[i] = Math.sqrt(insideSq[i]);
    distToInk[i] = Math.sqrt(outsideSq[i]);
  }
  const samples = [];
  const stride = Math.max(1, Math.floor(w * h / 4e4));
  for (let i = 0; i < w * h; i += stride) if (ink[i]) samples.push(distInside[i]);
  samples.sort((a, b) => a - b);
  const pick = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0;
  const referenceThickness = Math.max(1, pick);
  return { w, h, distToInk, distInside, referenceThickness };
}
function buildGlyphDepthFields(alpha, w, h, threshold = 26) {
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    ink[i] = alpha[i * 4 + 3] > threshold ? 1 : 0;
  }
  return buildDepthFieldsFromMask(ink, w, h);
}
function depthProfile(profile, t) {
  const c = Math.max(0, Math.min(1, t));
  switch (profile) {
    case "bevel":
      return c;
    case "round":
      return Math.sqrt(Math.max(0, 1 - (1 - c) * (1 - c)));
    case "dome":
      return Math.sqrt(c);
    case "taper":
      return c * c;
    case "slab":
    default:
      return 1;
  }
}
function cellVolumeShape(dIn, dOut, referenceThickness, density, config) {
  const ref = Math.max(1, referenceThickness * Math.max(0.05, config.referenceFalloff));
  const wallBand = Math.max(0.5, config.wallBand);
  const outsideTaper = Math.max(0, config.outsideTaper);
  const inside = dOut <= 0.5;
  let t;
  let reach;
  if (inside) {
    t = Math.max(0, Math.min(1, dIn / ref));
    reach = 1;
  } else {
    const stray = dOut / ref;
    const fade = Math.max(0, 1 - stray / Math.max(0.05, outsideTaper));
    t = 0;
    reach = fade * fade;
  }
  const densityGain = 1 + Math.max(-1, Math.min(1, config.densityDepth)) * (Math.max(0, Math.min(1, density)) - 0.5) * 2;
  const half = Math.max(0, config.depth) * 0.5 * depthProfile(config.profile, t) * reach * Math.max(0, densityGain);
  const contourness = inside ? Math.max(0, 1 - dIn / wallBand) : reach;
  return { half, contourness };
}
function drawVolumeZ(localHalf, contourness, config, rand) {
  const wallShare = Math.max(0, Math.min(1, config.wallShare));
  const faceBias = Math.max(0, Math.min(1, config.faceBias));
  const interiorFill = Math.max(0, Math.min(1, config.interiorFill));
  const surfaceThickness = Math.max(0, config.surfaceThickness);
  const jitter = Math.max(0, config.jitter);
  const flankP = wallShare * Math.max(0, Math.min(1, contourness));
  let z;
  let family;
  const roll = rand();
  if (roll < flankP) {
    z = (rand() * 2 - 1) * localHalf;
    family = "flank";
  } else if (roll < flankP + (1 - flankP) * faceBias) {
    const inset = rand() * Math.min(surfaceThickness, localHalf * 0.9);
    z = (rand() < 0.5 ? -1 : 1) * Math.max(0, localHalf - inset);
    family = "face";
  } else {
    const span = localHalf * interiorFill;
    z = span > 0 ? (rand() * 2 - 1) * span : 0;
    family = "body";
  }
  if (jitter > 0) z += (rand() * 2 - 1) * jitter;
  return { z, family };
}
const DEFAULT_GLYPH_VOLUME = {
  enabled: false,
  depth: 90,
  profile: "round",
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
  outsideTaper: 0.6
};
function applyGlyphVolume(data, particleCount, fields, worldScale, config, seed) {
  const { w, h, distInside, distToInk, referenceThickness } = fields;
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
    const px = Math.max(0, Math.min(w - 1, Math.round(x / worldScale + w / 2)));
    const py = Math.max(0, Math.min(h - 1, Math.round(h / 2 - y / worldScale)));
    const cell = py * w + px;
    const shape = cellVolumeShape(distInside[cell], distToInk[cell], referenceThickness, density, config);
    const { z, family } = drawVolumeZ(shape.half, shape.contourness, config, rand);
    if (family === "flank") flankCount++;
    else if (family === "face") faceCount++;
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
    referenceThickness
  };
}
function dominantFamily(stats) {
  if (stats.flankCount >= stats.faceCount && stats.flankCount >= stats.bodyCount) return "flank";
  if (stats.faceCount >= stats.bodyCount) return "face";
  return "body";
}
function slabDistance(d2d, z, halfThickness) {
  const dz = Math.abs(z) - halfThickness;
  const outside2d = Math.max(d2d, 0);
  const outsideZ = Math.max(dz, 0);
  if (outside2d === 0 && outsideZ === 0) {
    return Math.max(d2d, dz);
  }
  return Math.hypot(outside2d, outsideZ);
}
export {
  DEFAULT_GLYPH_VOLUME,
  applyGlyphVolume,
  buildDepthFieldsFromMask,
  buildGlyphDepthFields,
  cellVolumeShape,
  depthProfile,
  dominantFamily,
  drawVolumeZ,
  hashString,
  mulberry32,
  slabDistance
};
