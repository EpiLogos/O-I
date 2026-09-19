/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sorted-grid pairwise collision (DEM-style contact response), fragment-shader
 * GPGPU. Four passes, run before the velocity pass only when pairwise is
 * enabled (see GPGPUSimulator.step):
 *   1. cellId  — key every particle texel by its composition-plane cell
 *   2. sort    — one parameterized material executing the bitonic schedule from
 *                pairwiseSchedule.ts (uPartner / uBlock compare-exchange)
 *   3. range   — per-cell binary search over the sorted keys -> (1-based start,
 *                count) in a cell-table texture sized to the cell grid
 *   4. force   — each particle texel sums contact response over its 3x3 cell
 *                neighbourhood directly in particle-index space. Two draw
 *                buffers (MRT): buffer 0 keeps the legacy packing xy = position
 *                correction (px, applied by the position pass), zw = velocity
 *                delta (px/s, applied by the velocity pass); buffer 1 carries
 *                the depth-axis components of those same two vectors (read only
 *                when uPairwise3D = 1). Separation lives at the position level
 *                (a bounded projection cannot pump energy into a dense packing);
 *                velocity change is reserved for genuine approach/recession
 *                between pairs.
 *
 * 3D bodies (uPairwise3D = 1, the glyphVolume signal): the hash and candidate
 * search stay on the composition plane, but each candidate pair's offset gains
 * its depth-axis component (z on the XY picture plane, y on the XZ plate) and
 * the contact normal, overlap, position correction and velocity response are
 * computed and applied through all three axes. The gate is the full 3D
 * distance, so front/back sheet neighbours stop reading as in-plane overlaps
 * and the interior fill stops pressurising in-plane. uPairwise3D = 0 keeps the
 * depth terms exactly zero, which reproduces the legacy planar response bit
 * for bit.
 *
 * All indices/keys are exact integers held in highp floats (<= 2**24). The force
 * pass writes every texel, so no clear pass is needed anywhere in the chain.
 */

import { PAIRWISE_CELL_CAPACITY, PAIRWISE_KEY_SENTINEL, PAIRWISE_SEARCH_ITERATIONS } from '../pairwiseSchedule';

/** Pass 1: (cellKey, particleLinearIndex) per texel; unused/padded texels get the sentinel key. */
export const pairwiseCellIdShader = /* glsl */ `
precision highp float;

uniform sampler2D uPositionTexture;
uniform vec2 uTexSize;        // particle-state texture size
uniform float uParticleCount;
uniform float uExtent;        // grid half-extent, world px
uniform float uCellSize;      // >= interaction radius
uniform vec2 uCells;          // cell-grid dimensions
uniform float uCompPlane;     // 0 = vertical (XY), 1 = horizontal (XZ)

varying vec2 vUv;

void main() {
  float pIndex = floor(vUv.y * uTexSize.y) * uTexSize.x + floor(vUv.x * uTexSize.x);
  if (pIndex >= uParticleCount) {
    gl_FragColor = vec4(${PAIRWISE_KEY_SENTINEL.toFixed(1)}, 0.0, 0.0, 1.0);
    return;
  }
  vec3 pos = texture2D(uPositionTexture, vUv).xyz;
  vec2 p = (uCompPlane < 0.5) ? pos.xy : pos.xz;
  vec2 c = clamp(floor((p + uExtent) / uCellSize), vec2(0.0), uCells - 1.0);
  gl_FragColor = vec4(c.y * uCells.x + c.x, pIndex, 0.0, 1.0);
}
`;

/** Pass 2: one material for the whole bitonic network; a texel keeps the min/max of its XOR partner pair. */
export const pairwiseSortShader = /* glsl */ `
precision highp float;

uniform sampler2D uSortTexture;
uniform float uSide;    // padded power-of-two texture side
uniform float uPartner; // texel XOR distance (power of two)
uniform float uBlock;   // ascending / descending block size (power of two)

varying vec2 vUv;

vec2 keyIndexAt(float i) {
  return texture2D(uSortTexture, (vec2(mod(i, uSide), floor(i / uSide)) + 0.5) / uSide).rg;
}

void main() {
  float i = floor(vUv.y * uSide) * uSide + floor(vUv.x * uSide);
  float bit = mod(floor(i / uPartner), 2.0);
  float j = bit < 0.5 ? i + uPartner : i - uPartner;
  vec4 a = texture2D(uSortTexture, vUv);
  vec2 b = keyIndexAt(j);
  bool asc = mod(floor(i / uBlock), 2.0) < 0.5;
  bool low = i < j;
  // Symmetric tie rule: both texels of a pair agree, so (key, index) pairs never split.
  bool aFirst = (a.x < b.x) || (a.x == b.x && i < j);
  vec4 lo = aFirst ? a : vec4(b.x, b.y, 0.0, 1.0);
  vec4 hi = aFirst ? vec4(b.x, b.y, 0.0, 1.0) : a;
  gl_FragColor = (asc == low) ? lo : hi;
}
`;

/** Pass 3: renders the cell grid; each cell binary-searches the sorted list for its run. */
export const pairwiseRangeShader = /* glsl */ `
precision highp float;

uniform sampler2D uSortTexture;
uniform float uSide;   // padded sort texture side
uniform float uSlots;  // side * side
uniform vec2 uCells;

varying vec2 vUv;

float keyAt(float i) {
  return texture2D(uSortTexture, (vec2(mod(i, uSide), floor(i / uSide)) + 0.5) / uSide).x;
}

void main() {
  vec2 c = floor(vUv * uCells);
  float cell = c.y * uCells.x + c.x;
  // Leftmost slot with key >= cell.
  float lo = 0.0;
  float hi = uSlots;
  for (int k = 0; k < ${PAIRWISE_SEARCH_ITERATIONS}; k++) {
    float mid = floor((lo + hi) * 0.5);
    if (keyAt(mid) >= cell) hi = mid; else lo = mid;
  }
  float start = hi;
  float count = 0.0;
  if (keyAt(start) == cell) {
    // Leftmost slot with key > cell.
    float lo2 = start;
    float hi2 = uSlots;
    for (int k = 0; k < ${PAIRWISE_SEARCH_ITERATIONS}; k++) {
      float mid = floor((lo2 + hi2) * 0.5);
      if (keyAt(mid) > cell) hi2 = mid; else lo2 = mid;
    }
    count = hi2 - start;
  }
  gl_FragColor = vec4(start + 1.0, count, 0.0, 1.0); // 1-based start disambiguates slot 0
}
`;

/**
 * Pass 4: particle-index space. Each texel sums contact response over its 3x3
 * cell neighbourhood. Output mechanism (corr + dv need six floats in 3D): MRT —
 * the force target is a WebGLRenderTarget with count: 2, so this material (the
 * one GLSL3 material in the chain; three's GLSL3 prefix keeps texture2D and
 * varying working) writes the legacy vec4(corr.xy, dv.xy) packing to buffer 0
 * and the depth-axis components to buffer 1. A second render pass would re-run
 * the whole candidate loop for two floats, and the legacy packing has no spare
 * channels.
 */
export const pairwiseForceShader = /* glsl */ `
precision highp float;

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform sampler2D uSortTexture;   // sorted (cellKey, particleIndex) list
uniform sampler2D uCellTable;     // per-cell (1-based start, count)
uniform vec2 uTexSize;
uniform vec2 uCells;
uniform float uSide;
uniform float uExtent;
uniform float uCellSize;
uniform float uRadius;            // interaction radius h, world px
uniform float uStiffness;
uniform float uRestitution;
uniform float uPairViscosity;
uniform float uCompPlane;
uniform float uPairwise3D;        // 0 = planar contacts (legacy), 1 = full 3D contacts
uniform float uParticleCount;

varying vec2 vUv;

layout(location = 0) out vec4 outPlane; // xy = position correction, zw = velocity delta (plane axes)
layout(location = 1) out vec4 outDepth; // x = position correction, y = velocity delta (depth axis)

vec2 sortUv(float i) {
  return (vec2(mod(i, uSide), floor(i / uSide)) + 0.5) / uSide;
}

vec2 particleUv(float i) {
  return (vec2(mod(i, uTexSize.x), floor(i / uTexSize.x)) + 0.5) / uTexSize;
}

void main() {
  float pIndex = floor(vUv.y * uTexSize.y) * uTexSize.x + floor(vUv.x * uTexSize.x);
  vec2 corr = vec2(0.0);
  vec2 dv = vec2(0.0);
  float corrZ = 0.0;
  float dvZ = 0.0;
  if (pIndex < uParticleCount) {
    vec3 pos = texture2D(uPositionTexture, vUv).xyz;
    vec3 vel = texture2D(uVelocityTexture, vUv).xyz;
    vec2 p2 = (uCompPlane < 0.5) ? pos.xy : pos.xz;
    vec2 v2 = (uCompPlane < 0.5) ? vel.xy : vel.xz;
    // Depth-axis coordinate, matching the plane convention: z on the vertical
    // picture plane (XY), y on the horizontal plate (XZ).
    float pz = (uCompPlane < 0.5) ? pos.z : pos.y;
    float vz = (uCompPlane < 0.5) ? vel.z : vel.y;
    vec2 c = clamp(floor((p2 + uExtent) / uCellSize), vec2(0.0), uCells - 1.0);
    float cap = float(${PAIRWISE_CELL_CAPACITY});
    float responded = 0.0;
    bool stop = false;
    for (int dy = -1; dy <= 1; dy++) {
      if (stop) break;
      for (int dx = -1; dx <= 1; dx++) {
        if (stop) break;
        vec2 cn = c + vec2(float(dx), float(dy));
        if (cn.x < 0.0 || cn.y < 0.0 || cn.x >= uCells.x || cn.y >= uCells.y) continue;
        vec2 range = texture2D(uCellTable, (cn + 0.5) / uCells).rg;
        float count = min(range.y, cap);
        for (int k = 0; k < ${PAIRWISE_CELL_CAPACITY}; k++) {
          if (float(k) >= count) break;
          float other = texture2D(uSortTexture, sortUv(range.x - 1.0 + float(k))).y;
          if (other == pIndex) continue;
          vec3 oPos = texture2D(uPositionTexture, particleUv(other)).xyz;
          vec3 oVel = texture2D(uVelocityTexture, particleUv(other)).xyz;
          vec2 q2 = (uCompPlane < 0.5) ? oPos.xy : oPos.xz;
          vec2 w2 = (uCompPlane < 0.5) ? oVel.xy : oVel.xz;
          vec2 d = p2 - q2;
          float dist = length(d);
          // 3D bodies: the plane distance is computed first (cheap early-out),
          // then the offset gains its depth-axis component. The full 3D length
          // is the single gate: it lower-bounds nothing less than the plane
          // length, so dist >= uRadius also rejects candidates far in depth.
          float dz = 0.0;
          float dvz = 0.0;
          if (uPairwise3D > 0.5) {
            dz = pz - ((uCompPlane < 0.5) ? oPos.z : oPos.y);
            dvz = vz - ((uCompPlane < 0.5) ? oVel.z : oVel.y);
            dist = sqrt(dist * dist + dz * dz);
          }
          if (dist >= uRadius || dist < 0.0001) continue;
          // Total-response cap: glyph packing puts hundreds of particles inside h;
          // the nearest CAP contacts define the interaction. Slot visits stay
          // bounded by 9 x CAP either way.
          if (responded >= cap) { stop = true; break; }
          responded += 1.0;
          vec2 n = d / dist;
          vec3 n3 = vec3(n, dz / dist); // depth component is exactly 0 when planar
          float x = 1.0 - dist / uRadius;
          // Position-level separation: a relaxed projection (fraction of the
          // overlap) that cannot add kinetic energy, so a dense packing stays
          // quiet at rest instead of pre-pressurising the field.
          float push = x * x * uRadius * 0.35 * uStiffness;
          corr += n * push;
          corrZ += n3.z * push;
          vec2 relV = v2 - w2;
          float vn = dot(relV, n) + dvz * n3.z;
          // Normal restitution only for approaching pairs; tangential smoothing.
          if (vn < 0.0) {
            float bounce = -vn * (1.0 + uRestitution) * 0.5;
            dv += n * bounce;
            dvZ += n3.z * bounce;
          }
          dv -= (relV - n * vn) * (uPairViscosity * 0.5);
          dvZ -= (dvz - n3.z * vn) * (uPairViscosity * 0.5);
        }
      }
    }
    // Bound the total projection so dense piles correct, never teleport. In 3D
    // the bound applies to the full correction vector.
    float cLen = length(corr);
    float cMax = 2.0 * uRadius;
    float cLenFull = (uPairwise3D > 0.5) ? sqrt(cLen * cLen + corrZ * corrZ) : cLen;
    if (cLenFull > cMax) {
      float s = cMax / cLenFull;
      corr *= s;
      corrZ *= s;
    }
  }
  // Buffer 0 is the planar packing the consumers have always read; buffer 1
  // holds the depth-axis components (exact zeros while uPairwise3D = 0).
  outPlane = vec4(corr, dv);
  outDepth = vec4(corrZ, dvZ, 0.0, 1.0);
}
`;
