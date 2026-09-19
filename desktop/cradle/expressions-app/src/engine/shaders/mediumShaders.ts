/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared medium solver passes: the classic grid-fluid recipe — additive splat,
 * semi-Lagrangian self-advection with dissipation, divergence, Jacobi pressure
 * iterations, gradient subtract (PavelDoGreat structure, no interior
 * boundaries). Solver space uses unit cells; stored velocity carries world px/s
 * clamped to MEDIUM_VEL_LIMIT so divergence and pressure stay bounded — the
 * particle velocity clamp remains the final safety. Boundaries: the grid edge
 * only; samples outside [0,1] clamp to the edge texel (free-slip, no normal
 * inflow generated at the boundary).
 *
 * Every pass carries a 3D twin selected by uMedium3D (0 = legacy 2D sheet, the
 * exact historical expressions; 1 = an N×N×N voxel volume packed into an N²×N²
 * texture as N×N tiles of N×N, tile (tx, ty) = depth slice z = tx + ty·N — see
 * mediumGrid.ts for the canonical math). In 3D:
 *  - the volume is a cube: the sheet extent on both media axes (x·y or x·z per
 *    uMediumPlane) and a depth range of the same span centred on the field, so
 *    one axis of solver space always spans `uMediumExtent` world px;
 *  - advection back-traces in voxel space and samples trilinearly (8 taps of
 *    mediumVolumeSample — the tiling makes hardware bilinear wrong across tile
 *    seams, and nearest-only devices need the interpolation anyway);
 *  - divergence / Jacobi / gradient subtract use 6-neighbour stencils
 *    (±x, ±y, ±z) whose neighbour fetches clamp into the volume: edge cells
 *    repeat, the free-slip wall, exactly the 2D edge philosophy;
 *  - the splat renders each particle three times (uSliceOffset −1/0/+1), the
 *    2–3 nearest depth slices weighted by the hat kernel, so momentum reaches
 *    multiple slices and still sums to the particle's full 3D velocity. The
 *    tradeoff vs. a single nearest-slice splat: three cheap point draws, but
 *    no bilinear smearing across depth at injection time — advection then does
 *    the diffusion, as it does in-plane.
 * The particle-facing coupling counterpart lives in §7C of
 * simulationShaders.ts; mediumGrid.ts holds the node-testable tiling math.
 */

export const MEDIUM_VEL_LIMIT = 3000.0; // px/s stability bound on stored medium velocity
export const MEDIUM_PRESSURE_DECAY = 0.8; // Jacobi warm-start under-relaxation

/**
 * GLSL shared by every 3D branch: tile decode/encode plus clamped volume
 * fetch and trilinear sampling. Uniforms are declared here once so each
 * consuming shader just concatenates the chunk.
 */
const mediumVolumeGLSL = /* glsl */ `
uniform float uMedium3D;     // 0 = legacy 2D sheet, 1 = 3D voxel volume
uniform float uMediumN;      // voxels per volume axis (N)
uniform float uMediumTexSide; // packed texture side (N * N)

// Decode this fragment's texel back to its voxel: N×N tiles laid row-major.
vec3 mediumFragmentVoxel(vec2 uv) {
  vec2 t = floor(uv * uMediumTexSide);
  float tileX = floor(t.x / uMediumN);
  float tileY = floor(t.y / uMediumN);
  return vec3(t.x - tileX * uMediumN, t.y - tileY * uMediumN, tileX + tileY * uMediumN);
}

// Nearest-voxel fetch, clamped into the volume (free-slip wall: edge cells
// repeat beyond the boundary — the 3D twin of the 2D clamp-to-edge texel).
// the voxel argument is expected integral
vec4 mediumVolumeFetch(sampler2D field, vec3 voxel) {
  vec3 c = clamp(voxel, vec3(0.0), vec3(uMediumN - 1.0));
  vec2 tile = vec2(mod(c.z, uMediumN), floor(c.z / uMediumN));
  return texture2D(field, (tile * uMediumN + c.xy + 0.5) / uMediumTexSide);
}

// Trilinear sample of the packed volume at continuous solver-space coordinates
// (one voxel = one unit). Clamping the coordinate before flooring repeats the
// edge cell across the boundary half-cell: flat extrapolation, matching the
// fetch clamp.
vec4 mediumVolumeSample(sampler2D field, vec3 voxel) {
  vec3 c = clamp(voxel, vec3(0.0), vec3(uMediumN - 1.0));
  vec3 i = floor(c);
  vec3 f = c - i;
  vec3 i1 = min(i + vec3(1.0), vec3(uMediumN - 1.0));
  return mix(
    mix(mix(mediumVolumeFetch(field, vec3(i.x, i.y, i.z)), mediumVolumeFetch(field, vec3(i1.x, i.y, i.z)), f.x),
        mix(mediumVolumeFetch(field, vec3(i.x, i1.y, i.z)), mediumVolumeFetch(field, vec3(i1.x, i1.y, i.z)), f.x), f.y),
    mix(mix(mediumVolumeFetch(field, vec3(i.x, i.y, i1.z)), mediumVolumeFetch(field, vec3(i1.x, i.y, i1.z)), f.x),
        mix(mediumVolumeFetch(field, vec3(i.x, i1.y, i1.z)), mediumVolumeFetch(field, vec3(i1.x, i1.y, i1.z)), f.x), f.y),
    f.z);
}
`;

/** One vertex per particle; positions arrive from the particle-state texture.
 *  In 3D mode the same draw runs three times per frame (uSliceOffset −1/0/+1),
 *  each instance writing the particle's momentum into one nearby depth slice. */
export const mediumSplatVertexShader = /* glsl */ `
precision highp float;

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform vec2 uMediumMin;
uniform vec2 uMediumMax;
uniform float uMediumPlane; // 0 = XY media axes, 1 = XZ
uniform float uSplatGain;
uniform float uMedium3D;    // 0 = legacy 2D sheet, 1 = 3D voxel volume
uniform float uMediumN;     // voxels per volume axis
uniform float uSliceOffset; // −1 / 0 / +1: which nearby slice this draw writes

attribute vec2 aParticleUv;
varying vec4 vSplat;

void main() {
  vec3 pos = texture2D(uPositionTexture, aParticleUv).xyz;
  vec3 vel = texture2D(uVelocityTexture, aParticleUv).xyz;
  if (uMedium3D > 0.5) {
    // 3D momentum injection: the particle's full velocity in medium-axis order
    // (a, b, depth), splatted across the nearest slices with the hat kernel so
    // the per-slice weights sum to 1 (momentum conserved, depth honoured).
    vec2 plane = (uMediumPlane > 0.5) ? pos.xz : pos.xy;
    float depth = (uMediumPlane > 0.5) ? pos.y : pos.z;
    vec3 mv = (uMediumPlane > 0.5) ? vel.xzy : vel.xyz;
    float span = max(uMediumMax.x - uMediumMin.x, 0.001);
    vec2 g = (plane - uMediumMin) / max(uMediumMax - uMediumMin, vec2(0.001));
    // Depth covers the same span as the sheet, centred on the field: [-span/2, +span/2].
    float gd = (depth + 0.5 * span) / span;
    bool finite = all(equal(mv, mv)) && all(equal(plane, plane)) && gd == gd;
    // AABB gate (as the 2D clip-space position provides implicitly): anything
    // outside the covered cube injects nothing.
    bool inside = g.x >= 0.0 && g.x <= 1.0 && g.y >= 0.0 && g.y <= 1.0 && gd >= 0.0 && gd <= 1.0;
    float fvz = gd * uMediumN;
    float target = floor(fvz + 0.5) + uSliceOffset; // unclamped target drives the kernel weight
    // Wall clamp: at the volume edges the virtual outside slice folds onto the
    // edge cell (free-slip), so momentum presses against the wall, never leaks
    // past it.
    float slice = clamp(target, 0.0, uMediumN - 1.0);
    float w = max(0.0, 1.0 - abs(fvz - target));
    float sp = length(mv);
    if (sp > ${MEDIUM_VEL_LIMIT}.0) mv *= ${MEDIUM_VEL_LIMIT}.0 / sp;
    vSplat = (finite && inside && w > 0.0) ? vec4(mv * w, w) * uSplatGain : vec4(0.0);
    if (!(finite && inside && w > 0.0)) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off-clip cull: the zero-weight draws cost no fragments
      gl_PointSize = 1.0;
      return;
    }
    // Exact texel targeting: tile (depth slice) * N + the snapped in-tile cell,
    // so a 1px point can never spill across a tile seam.
    vec2 tile = vec2(mod(slice, uMediumN), floor(slice / uMediumN));
    vec2 gpx = clamp(floor(g * uMediumN), vec2(0.0), vec2(uMediumN - 1.0));
    gl_Position = vec4((tile * uMediumN + gpx + 0.5) / (uMediumN * uMediumN) * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = 1.0;
    return;
  }
  vec2 plane = (uMediumPlane > 0.5) ? pos.xz : pos.xy;
  vec2 g = (plane - uMediumMin) / max(uMediumMax - uMediumMin, vec2(0.001));
  vec2 pv = (uMediumPlane > 0.5) ? vel.xz : vel.xy;
  float sp = length(pv);
  // Finite guard: a NaN velocity would poison the medium through accumulation.
  bool finite = all(equal(pv, pv)) && all(equal(plane, plane));
  if (sp > ${MEDIUM_VEL_LIMIT}.0) pv *= ${MEDIUM_VEL_LIMIT}.0 / sp;
  vSplat = finite ? vec4(pv, 1.0, 1.0) * uSplatGain : vec4(0.0);
  gl_Position = vec4(g * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;

export const mediumSplatFragmentShader = /* glsl */ `
precision highp float;

varying vec4 vSplat;

void main() {
  gl_FragColor = vSplat;
}
`;

export const mediumAdvectShader = /* glsl */ `
precision highp float;

uniform sampler2D uMediumVelocity;
uniform float uDelta;
uniform float uDissipation;  // pow(persistence, dt*60)
uniform float uMediumExtent; // world px covered by the grid side
uniform vec2 uTexel;
varying vec2 vUv;
${mediumVolumeGLSL}
void main() {
  if (uMedium3D > 0.5) {
    // Semi-Lagrangian back-trace in voxel space: world px → voxels is
    // uDelta · N / extent (one axis of the cube spans uMediumExtent px over
    // N cells), then trilinear across the tiled slices.
    vec3 voxel = mediumFragmentVoxel(vUv);
    vec3 disp = texture2D(uMediumVelocity, vUv).xyz * (uDelta * uMediumN / max(uMediumExtent, 1.0));
    vec4 advected = mediumVolumeSample(uMediumVelocity, voxel - disp) * uDissipation;
    float sp = length(advected.xyz);
    if (sp > ${MEDIUM_VEL_LIMIT}.0) advected.xyz *= ${MEDIUM_VEL_LIMIT}.0 / sp;
    gl_FragColor = advected;
    return;
  }
  vec4 v = texture2D(uMediumVelocity, vUv);
  vec2 back = clamp(vUv - v.xy * (uDelta / max(uMediumExtent, 1.0)), vec2(0.0), vec2(1.0));
  vec4 advected = texture2D(uMediumVelocity, back) * uDissipation;
  float sp = length(advected.xy);
  if (sp > ${MEDIUM_VEL_LIMIT}.0) advected.xy *= ${MEDIUM_VEL_LIMIT}.0 / sp;
  gl_FragColor = advected;
}
`;

export const mediumDivergenceShader = /* glsl */ `
precision highp float;

uniform sampler2D uMediumVelocity;
uniform vec2 uTexel;
varying vec2 vUv;
${mediumVolumeGLSL}
void main() {
  if (uMedium3D > 0.5) {
    // 6-neighbour unit-cell divergence; clamped neighbour fetches make the
    // volume edges free-slip walls (no normal inflow at the boundary).
    vec3 voxel = mediumFragmentVoxel(vUv);
    float vL = mediumVolumeFetch(uMediumVelocity, voxel - vec3(1.0, 0.0, 0.0)).x;
    float vR = mediumVolumeFetch(uMediumVelocity, voxel + vec3(1.0, 0.0, 0.0)).x;
    float vB = mediumVolumeFetch(uMediumVelocity, voxel - vec3(0.0, 1.0, 0.0)).x;
    float vT = mediumVolumeFetch(uMediumVelocity, voxel + vec3(0.0, 1.0, 0.0)).x;
    float vK = mediumVolumeFetch(uMediumVelocity, voxel - vec3(0.0, 0.0, 1.0)).x;
    float vF = mediumVolumeFetch(uMediumVelocity, voxel + vec3(0.0, 0.0, 1.0)).x;
    gl_FragColor = vec4(0.5 * (vR - vL + vT - vB + vF - vK), 0.0, 0.0, 1.0);
    return;
  }
  float vL = texture2D(uMediumVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float vR = texture2D(uMediumVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float vB = texture2D(uMediumVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float vT = texture2D(uMediumVelocity, vUv + vec2(0.0, uTexel.y)).y;
  gl_FragColor = vec4(0.5 * (vR - vL + vT - vB), 0.0, 0.0, 1.0);
}
`;

export const mediumPressureShader = /* glsl */ `
precision highp float;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
uniform float uPressureDecay; // warm-start under-relaxation
varying vec2 vUv;
${mediumVolumeGLSL}
void main() {
  if (uMedium3D > 0.5) {
    // Jacobi relaxation of ∇²p = div on the 6-neighbour stencil; the same
    // per-neighbour decay keeps the warm-start under-relaxation of the 2D pass.
    vec3 voxel = mediumFragmentVoxel(vUv);
    float L = mediumVolumeFetch(uPressure, voxel - vec3(1.0, 0.0, 0.0)).x * uPressureDecay;
    float R = mediumVolumeFetch(uPressure, voxel + vec3(1.0, 0.0, 0.0)).x * uPressureDecay;
    float B = mediumVolumeFetch(uPressure, voxel - vec3(0.0, 1.0, 0.0)).x * uPressureDecay;
    float T = mediumVolumeFetch(uPressure, voxel + vec3(0.0, 1.0, 0.0)).x * uPressureDecay;
    float K = mediumVolumeFetch(uPressure, voxel - vec3(0.0, 0.0, 1.0)).x * uPressureDecay;
    float F = mediumVolumeFetch(uPressure, voxel + vec3(0.0, 0.0, 1.0)).x * uPressureDecay;
    float divergence = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T + K + F - divergence) / 6.0, 0.0, 0.0, 1.0);
    return;
  }
  float L = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x * uPressureDecay;
  float R = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x * uPressureDecay;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x * uPressureDecay;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x * uPressureDecay;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

export const mediumGradientSubtractShader = /* glsl */ `
precision highp float;

uniform sampler2D uPressure;
uniform sampler2D uMediumVelocity;
uniform vec2 uTexel;
varying vec2 vUv;
${mediumVolumeGLSL}
void main() {
  if (uMedium3D > 0.5) {
    vec3 voxel = mediumFragmentVoxel(vUv);
    vec4 v = texture2D(uMediumVelocity, vUv);
    float pL = mediumVolumeFetch(uPressure, voxel - vec3(1.0, 0.0, 0.0)).x;
    float pR = mediumVolumeFetch(uPressure, voxel + vec3(1.0, 0.0, 0.0)).x;
    float pB = mediumVolumeFetch(uPressure, voxel - vec3(0.0, 1.0, 0.0)).x;
    float pT = mediumVolumeFetch(uPressure, voxel + vec3(0.0, 1.0, 0.0)).x;
    float pK = mediumVolumeFetch(uPressure, voxel - vec3(0.0, 0.0, 1.0)).x;
    float pF = mediumVolumeFetch(uPressure, voxel + vec3(0.0, 0.0, 1.0)).x;
    vec3 projected = v.xyz - vec3(pR - pL, pT - pB, pF - pK);
    float sp = length(projected);
    if (sp > ${MEDIUM_VEL_LIMIT}.0) projected *= ${MEDIUM_VEL_LIMIT}.0 / sp;
    gl_FragColor = vec4(projected, 1.0);
    return;
  }
  vec4 v = texture2D(uMediumVelocity, vUv);
  float pL = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float pR = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float pB = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float pT = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 projected = v.xy - vec2(pR - pL, pT - pB);
  float sp = length(projected);
  if (sp > ${MEDIUM_VEL_LIMIT}.0) projected *= ${MEDIUM_VEL_LIMIT}.0 / sp;
  gl_FragColor = vec4(projected, v.z, 1.0);
}
`;
