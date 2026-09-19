/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { curlNoiseGLSL } from './curlNoise';
import {
  SDF_GRID,
  SDF_EXTENT,
  SDF_DISTANCE_SCALE,
  SDF_TILE_V,
} from '../sdfField';

/**
 * Shared glyph-SDF boundary sampling for the velocity and position passes.
 * Tiles: uCollisionTile = (uv origin x, uv origin y, tile width in u, enabled);
 * an entity's A/B state tiles sit side by side, B at origin + tile width.
 * d is stored in R as local glyph units / SDF_DISTANCE_SCALE, negative inside strokes.
 */
const sdfSamplingGLSL = /* glsl */ `
uniform sampler2D uSdfAtlas;
uniform vec4 uCollisionTile[10];

vec2 sdfTileUv(vec2 local, vec4 tile, float which) {
  vec2 origin = vec2(tile.x + which * tile.z, tile.y);
  vec2 size = vec2(tile.z, ${SDF_TILE_V});
  vec2 localUv = local / (2.0 * ${SDF_EXTENT}.0) + 0.5;
  vec2 halfTexel = size / (2.0 * ${SDF_GRID}.0);
  return clamp(origin + localUv * size, origin + halfTexel, origin + size - halfTexel);
}

// Blended signed distance (R units) of the A/B pair and its local-space gradient
// (central differences, one cell). grad points toward increasing distance.
void sdfSample(vec2 local, vec4 tile, float blend, out float d, out vec2 grad) {
  vec2 uvA = sdfTileUv(local, tile, 0.0);
  vec2 uvB = sdfTileUv(local, tile, 1.0);
  float dA = texture2D(uSdfAtlas, uvA).x;
  float dB = texture2D(uSdfAtlas, uvB).x;
  d = mix(dA, dB, blend);
  vec2 st = vec2(tile.z, ${SDF_TILE_V}) / ${SDF_GRID}.0;
  float dAx = texture2D(uSdfAtlas, uvA + vec2(st.x, 0.0)).x;
  float dAx0 = texture2D(uSdfAtlas, uvA - vec2(st.x, 0.0)).x;
  float dAy = texture2D(uSdfAtlas, uvA + vec2(0.0, st.y)).x;
  float dAy0 = texture2D(uSdfAtlas, uvA - vec2(0.0, st.y)).x;
  float dBx = texture2D(uSdfAtlas, uvB + vec2(st.x, 0.0)).x;
  float dBx0 = texture2D(uSdfAtlas, uvB - vec2(st.x, 0.0)).x;
  float dBy = texture2D(uSdfAtlas, uvB + vec2(0.0, st.y)).x;
  float dBy0 = texture2D(uSdfAtlas, uvB - vec2(0.0, st.y)).x;
  grad = mix(vec2(dAx - dAx0, dAy - dAy0), vec2(dBx - dBx0, dBy - dBy0), blend);
}

// Entity-local position of a world position (inverse of the forward target
// transform: subtract centre, undo rotation, undo scale; co/si from transform.z).
vec2 sdfLocalPos(vec3 world, vec3 center, vec3 transform, float co, float si, float compPlane) {
  vec3 rel = world - center;
  vec2 p2 = (compPlane > 0.5) ? vec2(rel.x, -rel.z) : rel.xy;
  vec2 un = vec2(p2.x * co + p2.y * si, -p2.x * si + p2.y * co);
  return un / max(transform.xy, vec2(0.001));
}

// Outward world-space normal: the local gradient transforms through the inverse
// entity scale then the forward rotation (∇_world = R·S⁻¹·∇_local); local glyph y
// maps to world -z on the horizontal plane.
vec3 sdfWorldNormal(vec2 grad, vec3 transform, float co, float si, float compPlane) {
  vec2 nLocal = grad / max(length(grad), 0.00001);
  vec2 nScaled = nLocal / max(transform.xy, vec2(0.001));
  vec2 nRot = vec2(nScaled.x * co - nScaled.y * si, nScaled.x * si + nScaled.y * co);
  vec3 nWorld = (compPlane > 0.5) ? vec3(nRot.x, 0.0, -nRot.y) : vec3(nRot.x, nRot.y, 0.0);
  return nWorld / max(length(nWorld), 0.00001);
}

// Local coordinate along the extrusion axis (the slab normal). The 2D section
// lives in the composition plane; the body's thickness runs along this axis.
float sdfLocalZ(vec3 world, vec3 center, float depthScale, float compPlane) {
  vec3 rel = world - center;
  float axis = (compPlane > 0.5) ? rel.y : rel.z;
  return axis / max(depthScale, 0.001);
}

// Local half-thickness of the extruded body at a point (G channel, local units).
float sdfHalfThickness(vec2 local, vec4 tile, float blend) {
  vec2 uvA = sdfTileUv(local, tile, 0.0);
  vec2 uvB = sdfTileUv(local, tile, 1.0);
  return mix(texture2D(uSdfAtlas, uvA).y, texture2D(uSdfAtlas, uvB).y, blend) * ${SDF_DISTANCE_SCALE}.0;
}

// Distance to the extruded solid: the Minkowski combination of the 2D section
// with a segment of half-length h. Within the slab the answer is the 2D field;
// past a face it is the distance to that face plane. This is the genuine
// boundary of a body with thickness, not a silhouette that ignores z.
// (The name "half" is itself reserved in GLSL, hence h.)
float slabDistance(float d2d, float z, float h) {
  float dz = abs(z) - h;
  float o2 = max(d2d, 0.0);
  float oz = max(dz, 0.0);
  if (o2 == 0.0 && oz == 0.0) return max(d2d, dz);
  return length(vec2(o2, oz));
}
`;

export const simulationVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const positionSimulationShader = /* glsl */ `
precision highp float;

${sdfSamplingGLSL}

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uDelta;
uniform float uCompPlane;        // 0 = vertical (XY facing camera), 1 = horizontal (XZ plate)
uniform float uMorphTrajectory;
uniform float uZDepthRetention;
uniform float uZConfinement;
/** 1 = glyphs are real 3D bodies; their baked depth must not be damped away. */
uniform float uDepthGeometry;

// Glyph SDF colliders (see velocitySimulationShader): the position pass only
// hard-projects obstacle interiors around non-resident particles.
uniform float uCollisionEnabled;
uniform float uCollisionMode;    // 0 = obstacle, 1 = vessel
uniform float uCollisionIntegrity;
uniform sampler2D uTargetATexture;
uniform sampler2D uTargetBTexture;

// Pairwise contact separation (xy = position correction in the composition plane;
// the second draw buffer carries the depth-axis correction when uPairwise3D = 1).
uniform float uPairwiseEnabled;
uniform float uPairwise3D;      // 1 = volumetric bodies: contacts also correct the depth axis
uniform sampler2D uPairwiseCorrectionTexture;
uniform sampler2D uPairwiseCorrectionZTexture;

// Partition geometry so a particle can resolve its own entity (mirrors the velocity pass).
uniform int uEntityCount;
uniform float uEntityBounds[10];
uniform vec4 uEntityCenter[10];
uniform float uEntityMorph[10];
uniform vec3 uEntityTransform[10];
uniform float uEntityDepthScale[10];
uniform vec2 uTexSize;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPositionTexture, vUv);
  vec4 velData = texture2D(uVelocityTexture, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // Integrate position
  pos += vel * uDelta;

  // --- Pairwise contact separation: bounded projection written by the force pass ---
  if (uPairwiseEnabled > 0.5) {
    vec2 pc = texture2D(uPairwiseCorrectionTexture, vUv).xy;
    if (uCompPlane < 0.5) pos.xy += pc; else pos.xz += pc;
    // 3D bodies: the same projection also moves the depth axis (z on XY, y on XZ),
    // so front/back sheets separate through depth instead of being shoved sideways.
    if (uPairwise3D > 0.5) {
      float pcz = texture2D(uPairwiseCorrectionZTexture, vUv).x;
      if (uCompPlane < 0.5) pos.z += pcz; else pos.y += pcz;
    }
  }

  // --- Glyph SDF colliders: hard projection out of solid stroke interiors ---
  // Constraint: only particles strictly below the surface are evicted, so resting
  // particles near d≈0 are not fought; integrity lets energetic particles punch
  // deeper before the wall heals as they calm down. Residency (the particle's own
  // slot lies in the solid) exempts a particle from its own formation's obstacle
  // wall — without it the formation hollows into a shell at the stroke edges.
  if (uCollisionEnabled > 0.5 && uEntityCount > 0) {
    float pIndex = floor(vUv.y * uTexSize.y) * uTexSize.x + floor(vUv.x * uTexSize.x);
    int eIdx = 0;
    for (int i = 0; i < 10; i++) {
      if (i >= uEntityCount) break;
      eIdx = i;
      if (pIndex < uEntityBounds[i]) break;
    }
    vec4 tile = uCollisionTile[eIdx];
    if (tile.w > 0.5 && uCollisionMode < 0.5) {
      float co = cos(uEntityTransform[eIdx].z);
      float si = sin(uEntityTransform[eIdx].z);
      float morph = clamp(uEntityMorph[eIdx], 0.0, 1.0);
      vec2 local = sdfLocalPos(pos, uEntityCenter[eIdx].xyz, uEntityTransform[eIdx], co, si, uCompPlane);
      float d;
      vec2 grad;
      sdfSample(local, tile, morph, d, grad);
      // Residency from the particle's own baked slot (un-noised core is exact enough:
      // jitter is small against stroke thickness, and the classification only gates
      // the wall, it does not shape it).
      vec4 tA = texture2D(uTargetATexture, vUv);
      vec4 tB = texture2D(uTargetBTexture, vUv);
      vec3 tMix = mix(tA.xyz, tB.xyz, morph);
      vec2 tPlaneIn = (uCompPlane < 0.5) ? tMix.xy : vec2(tMix.x, -tMix.z);
      vec2 tScaled = tPlaneIn * uEntityTransform[eIdx].xy;
      vec2 tRot = vec2(tScaled.x * co - tScaled.y * si, tScaled.x * si + tScaled.y * co);
      vec3 tWorld = (uCompPlane < 0.5) ? vec3(tRot, tMix.z) : vec3(tRot.x, tMix.y, -tRot.y);
      vec2 tLocal = sdfLocalPos(tWorld, uEntityCenter[eIdx].xyz, uEntityTransform[eIdx], co, si, uCompPlane);
      float dT;
      vec2 tGrad;
      sdfSample(tLocal, tile, morph, dT, tGrad);
      // Extruded body: a particle laterally inside the letterform but past a face
      // is outside the solid through the thickness, and must leave along the face
      // normal. Without this the wall is a silhouette and depth is not collision.
      if (uDepthGeometry > 0.5) {
        float halfT = sdfHalfThickness(local, tile, morph);
        float dz = sdfLocalZ(pos, uEntityCenter[eIdx].xyz, uEntityDepthScale[eIdx], uCompPlane);
        if (abs(dz) > halfT && d < 0.0) {
          float sgn = dz > 0.0 ? 1.0 : -1.0;
          vec3 nFace = (uCompPlane > 0.5) ? vec3(0.0, sgn, 0.0) : vec3(0.0, 0.0, sgn);
          float wall = 1.0 / (1.0 + uCollisionIntegrity * velData.w * 0.01);
          pos -= nFace * ((abs(dz) - halfT) * wall);
        }
      }
      if (dT >= 0.0 && d < 0.0) {
        vec3 nWorld = sdfWorldNormal(grad, uEntityTransform[eIdx], co, si, uCompPlane);
        // Integrity uses the post-integration speed (velData.w is the velocity magnitude).
        float wall = 1.0 / (1.0 + uCollisionIntegrity * velData.w * 0.01);
        pos -= nWorld * (d * ${SDF_DISTANCE_SCALE}.0 * wall);
      }
    }
  }

  // Mild z-plane dampening only in pure 2D planar mode to preserve flat typography clarity.
  // In Toroidal Hopf (uMorphTrajectory > 0.5) or 3D horizontal chakra mode,
  // Z is the authentic 3D spatial depth coordinate, so preserve full 3D volumetric depth!
  //
  // With true-3D letterform bodies the depth axis IS the geometry (glyphVolume.ts):
  // damping it here would crush a solid back into a card within a second, which is
  // exactly what kept the field a 2D drawing. The main spring already targets the
  // baked z, so it is what holds the body; the planar damping stays available for
  // flat compositions that want it.
  if (uDepthGeometry < 0.5 && uCompPlane < 0.5 && uMorphTrajectory < 0.5) {
    float zDecay = 1.0 - 0.015 * uZConfinement * (1.0 - clamp(uZDepthRetention, 0.0, 1.0));
    pos.z *= pow(max(0.0,zDecay), uDelta * 60.0);
  }

  gl_FragColor = vec4(pos, posData.w); // posData.w holds density/particle metadata
}
`;

export const velocitySimulationShader = /* glsl */ `
precision highp float;

${curlNoiseGLSL}

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform sampler2D uTargetATexture;
uniform sampler2D uTargetBTexture;
uniform sampler2D uTargetNoise;

uniform float uMorphProgress;
uniform float uDelta;
uniform float uTime;

// Fluid properties
uniform float uCurlScale;
uniform float uCurlSpeed;
uniform float uTurbulence;
uniform float uVortexStrength;
uniform vec2 uVortexCenter;
/** 1 = real 3D bodies: the depth axis is geometry, so forces act through it. */
uniform float uDepthGeometry;
/** 0 = swirl in the picture plane, 1 = a genuine helical vortex about the depth axis. */
uniform float uVortex3d;
/** 0 = dispersion stays in the plane, 1 = it carries into the depth axis. */
uniform float uDispersion3d;
uniform float uViscosity;
uniform float uReturnSpeed;
uniform float uDispersion;
uniform float uStyleMode; // 0 = stipple, 1 = halftone

// Extended physics
uniform float uSnapRigidity;        // multiplier on Hooke restoring force (1.0 classic)
uniform float uDensityTether;       // 0 = uniform spring, 1 = classic density-weighted spring
uniform float uCurlDepth;           // relative Z noise frequency
uniform float uVortexRadius;        // gaussian radius of the global vortex (px)
uniform vec3 uGravity;              // constant body force
uniform float uQuadraticDrag;       // v^2 drag coefficient
uniform float uThermalJitter;       // brownian agitation
uniform float uMaxSpeed;            // hard velocity clamp
uniform float uGravitySoftening;    // Plummer epsilon (px)
uniform float uGravityFalloff;      // potential exponent
uniform float uSwirlRadius;         // orbital swirl gaussian radius (px)
uniform float uPointerFalloffPower; // pointer / pin falloff exponent
uniform float uTorPhase;            // running toroidal phase (radians)
uniform float uPolPhase;            // running poloidal phase (radians)

// Entities — first-class centres of formation (see fieldModel.ts). Each enabled formation owns a
// contiguous particle partition; every particle feels every entity's local force.
uniform int uEntityCount;
uniform float uEntityBounds[10];    // exclusive end particle index per partition
uniform vec4 uEntityCenter[10];     // xyz world centre, w = force radius (px)
uniform float uEntityMorph[10];
uniform float uEntityDepthScale[10];
uniform float uEntityNormalized[10];
uniform vec3 uEntityTransform[10];     // per-partition A→B progress
uniform vec2 uTexSize;

// Unified persistent force emitters (formations + pins). w in params = metric: 0 composition plane, 1 world 3D.
uniform int uForceEmitterCount;
uniform vec4 uForceEmitterCenter[18]; // xyz centre, w radius
uniform vec4 uForceEmitterParams[18]; // x strength, y mode 1 attract 2 repel 3 vortex, z spin, w metric              // simulation texture size (particle index reconstruction)
uniform float uCompPlane;           // 0 = vertical (XY), 1 = horizontal (XZ)
uniform float uResDominance;        // 0 = formation springs only … 1 = resonator transport only

// Free Relational System & Multi-Attractor Orbits
uniform float uRelationalEnabled;
uniform int uAttractorCount;
uniform vec4 uAttractors[10];      // xyz = center coords, w = relative mass
uniform float uAttractorSpin[10];  // angular momentum/vorticity per pole
uniform float uRelationalGravity; // gravitational pull strength
uniform float uRelationalSpin;    // orbital tangential swirl force
uniform float uChaosFactor;       // strange attractor turbulence

// Dedicated Per-Chakra Multi-Vortex Geometry System


// Continuous Modal Cymatic Resonator: ONE driven, damped thin-plate instrument whose
// evolving vibration field transports particles (real-time envelope-domain approximation;
// see cymaticResonator.ts for the physical derivation). Replaces per-chakra template
// attraction when enabled: geometry emerges from transport toward this field's nodal
// regions, not from snapping to stored target coordinates.
uniform float uResEnabled;      // 0.0 = off, 1.0 = on
uniform int uResModeCount;      // number of participating modes this frame (<=64)
uniform float uResRe[64];       // per-mode complex envelope, real part
uniform float uResIm[64];       // per-mode complex envelope, imaginary part
uniform float uResPlateSize;    // plate side L, world px
uniform float uResTransport;    // gain on -grad(intensity): slides particles toward nodal lines
uniform float uResAgitation;    // random kick amplitude, scaled by sqrt(local intensity)
uniform float uResBoundary;     // soft-wall strength keeping particles on the plate
uniform float uResPlane;        // 0.0 = horizontal plate (X-Z, y confined), 1.0 = vertical plate (X-Y, z confined); 2D mode only
uniform float uResDriveScale;   // final scale on the raw envelope field (tames resonance peaks)
uniform float uRes3D;           // 0.0 = 2D plate above, 1.0 = volumetric standing-wave field on all three axes (box boundary is the only cage)

// Sorted-grid pairwise collisions: per-particle contact acceleration from
// pairwiseForcePass (composition-plane xy/xz; the second draw buffer carries
// the depth-axis dv when uPairwise3D = 1). Disabled = exact zero.
uniform sampler2D uPairwiseForceTexture;
uniform sampler2D uPairwiseForceZTexture;
uniform float uPairwiseEnabled;
uniform float uPairwise3D;
uniform float uPairMaxDelta;    // per-step clamp on |pairwise dv| (speed units)

// Dual-Phase Toroidal/Poloidal Morph & Inverse Hopf Fibration System
uniform float uMorphTrajectory;       // 0 = linear, 1 = toroidalHopf, 2 = vortexSpiral, 3 = quantumInterference
uniform float uFiberPhaseOffset;     // delta psi phase difference (0 to 2*PI)
uniform float uToroidalWinding;      // p winding number (e.g. 1 to 12)
uniform float uPoloidalWinding;      // q winding number (e.g. 1 to 12)
uniform float uChiralCoupling;       // coupling/interference strength (0 to 1)
uniform float uOscillationAmp;       // vibrational breathing amplitude
uniform float uOscillationFreq;      // vibrational rate
uniform float uBreathPhase;          // dedicated breathing oscillator phase (radians)
uniform float uBreathDepth;          // breathing swell depth around unity (0 = none, default 0.35)
uniform float uManifoldRadius;       // scale of toroidal interference manifold
uniform float uTorusDepthScale;      // volumetric 3D Z-depth expansion (default 1.0)

// Interaction properties
uniform vec2 uPointerPos;
uniform vec2 uBurstPosition;
uniform float uBurstZ;        // depth of the queued click effect
uniform vec2 uBurstVelocity;
uniform float uBurstRadius;   // characteristic falloff radius of the queued click effect
uniform float uBurstRadial;   // outward (+) / inward (−) shock component
uniform float uBurstSpin;     // tangential vortex-whirl component
uniform float uPointerZ;
uniform vec2 uPointerVelocity;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uInteractionMode; // 0 = repel, 1 = attract, 2 = vortex

// Shared Eulerian medium (see mediumShaders.ts): particles inject momentum into a
// coarse grid fluid and are pushed by its pressure gradient and carried by its flow.
uniform float uMediumEnabled;
uniform sampler2D uMediumVelTexture;
uniform sampler2D uMediumPressureTexture;
uniform vec2 uMediumMin;
uniform vec2 uMediumMax;
uniform vec2 uMediumTexel;
uniform float uMediumGridRes;
uniform float uMediumPlane;         // 0 = XY media axes, 1 = XZ
uniform float uMediumPressureGain;  // gradient repulsion gain
uniform float uMediumCoupling;      // drag toward the medium flow
uniform float uMedium3D;            // 0 = 2D sheet (legacy), 1 = 3D voxel volume
uniform float uMediumN;             // 3D: voxels per volume axis (N, see mediumGrid.ts)
uniform float uMediumTexSide;       // 3D: packed texture side (N * N)

// Glyph SDF colliders: letterforms act as physical boundaries whose strength
// modulates with local particle energy (integrity). The third dimension is
// ignored, like the resonator plate.
uniform float uCollisionEnabled;
uniform float uCollisionMode;       // 0 = obstacle (strokes solid), 1 = vessel (strokes contain)
uniform float uCollisionRestitution;
uniform float uCollisionFriction;
uniform float uCollisionBand;       // influence band, world px
uniform float uCollisionStrength;
uniform float uCollisionIntegrity;

${sdfSamplingGLSL}

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPositionTexture, vUv);
  vec4 velData = texture2D(uVelocityTexture, vUv);
  vec4 targetA = texture2D(uTargetATexture, vUv);
  vec4 targetB = texture2D(uTargetBTexture, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // Which entity partition does this particle belong to?
  float pIndex = floor(vUv.y * uTexSize.y) * uTexSize.x + floor(vUv.x * uTexSize.x);
  int eIdx = 0;
  for (int i = 0; i < 10; i++) {
    if (i >= uEntityCount) break;
    eIdx = i;
    if (pIndex < uEntityBounds[i]) break;
  }
  float sMorph = clamp(uEntityMorph[eIdx], 0.0, 1.0);
  vec3 entityCenter = uEntityCenter[eIdx].xyz;

  vec3 transform = uEntityTransform[eIdx];
  float co=cos(transform.z),si=sin(transform.z);
  vec4 noise = texture2D(uTargetNoise, vUv);
  float normalized = uEntityNormalized[eIdx];
  vec2 a = ((uCompPlane > 0.5 ? vec2(targetA.x,-targetA.z) : targetA.xy) + noise.xy * normalized) * transform.xy;
  vec2 b = ((uCompPlane > 0.5 ? vec2(targetB.x,-targetB.z) : targetB.xy) + noise.zw * normalized) * transform.xy;
  a=vec2(a.x*co-a.y*si,a.x*si+a.y*co) + noise.xy * (1.0-normalized);
  b=vec2(b.x*co-b.y*si,b.x*si+b.y*co) + noise.zw * (1.0-normalized);
  if(uCompPlane>0.5){targetA.x=a.x;targetA.z=-a.y;targetB.x=b.x;targetB.z=-b.y;targetA.y*=uEntityDepthScale[eIdx];targetB.y*=uEntityDepthScale[eIdx];}
  else{targetA.xy=a;targetB.xy=b;targetA.z*=uEntityDepthScale[eIdx];targetB.z*=uEntityDepthScale[eIdx];}
  // Targets are baked in entity-local coordinates; the centre is a uniform (moving never re-bakes)
  vec3 targetPos = mix(targetA.xyz, targetB.xyz, sMorph) + entityCenter;
  float targetDensity = mix(targetA.w, targetB.w, sMorph);

  // --- Dual-Phase Toroidal/Poloidal Hopf Fibration Interference Manifold ---
  vec3 fHopf = vec3(0.0);
  float morphEnvelope = 4.0 * sMorph * (1.0 - sMorph);

  if (uMorphTrajectory > 0.5 && morphEnvelope > 0.001) {
    vec3 morphCenter = 0.5 * (targetA.xyz + targetB.xyz) + entityCenter;
    vec3 localPos = pos - morphCenter;

    float rMajor = max(25.0, uManifoldRadius);
    float rMinor = rMajor * 0.42;

    float theta = atan(localPos.y, localPos.x);
    float dXY = length(localPos.xy);
    float phi = atan(localPos.z, dXY - rMajor);

    float p = max(1.0, floor(uToroidalWinding + 0.5));
    float q = max(1.0, floor(uPoloidalWinding + 0.5));
    float omega = uTorPhase * 0.5;
    float dPsiHalf = uFiberPhaseOffset * 0.5;

    // Left and right chiral inverse Hopf fibers
    float psiL = omega + theta * p + phi * q + dPsiHalf;
    float psiR = -omega - theta * p + phi * q - dPsiHalf;

    float waveCos = cos(omega + theta * p + dPsiHalf);
    float waveSin = sin(omega + theta * p + dPsiHalf);
    float polSin = sin(phi * q);
    float polCos = cos(phi * q);

    vec3 hopfInterference;
    if (uMorphTrajectory < 1.5) {
      // 1. Toroidal Hopf Fibration interference manifold
      hopfInterference = vec3(
        2.0 * polSin * waveCos,
        -2.0 * polSin * waveSin,
        polCos * cos(2.0 * phi * q)
      );
    } else if (uMorphTrajectory < 2.5) {
      // 2. Chiral Vortex Spiral
      float chiralSign = (uChiralCoupling > 0.5) ? 1.0 : -1.0;
      hopfInterference = vec3(
        -sin(theta * p + psiL) * chiralSign,
        cos(theta * p + psiL),
        sin(psiR) * polCos
      );
    } else {
      // 3. Quantum Wave Interference
      float psi1 = sin(psiL);
      float psi2 = sin(psiR);
      float superpos = (psi1 + psi2 * uChiralCoupling);
      hopfInterference = vec3(
        superpos * cos(theta),
        superpos * sin(theta),
        (psi1 * psi2) * sin(phi * q)
      );
    }

    float oscBreathing = (1.0 + uBreathDepth * sin(uBreathPhase)) * uOscillationAmp;
    vec3 morphDisplacement = hopfInterference * (rMinor * 0.75 * oscBreathing * morphEnvelope);
    morphDisplacement.z *= max(0.1, uTorusDepthScale > 0.001 ? uTorusDepthScale : 1.0);
    targetPos += morphDisplacement;

    // Tangential geodesic flow force along the double-covered Hopf fibers
    float zDepthFactor = max(0.1, uTorusDepthScale > 0.001 ? uTorusDepthScale : 1.0);
    fHopf = vec3(
      -hopfInterference.y,
      hopfInterference.x,
      hopfInterference.z * 0.75 * zDepthFactor
    ) * (uOscillationAmp * 50.0 * morphEnvelope * uChiralCoupling);
  }

  // --- 1. Hooke's Law Restorative Force ---
  vec3 toTarget = targetPos - pos;
  
  // Halftone mode snaps more rigidly to grid positions, stipple mode is looser & more organic
  float returnMultiplier = (uStyleMode > 0.5) ? 6.5 : 4.0;
  // Core density areas have slightly stronger return force, perimeter stipple drifts more freely
  float densityTether = mix(1.0, mix(0.45, 1.35, targetDensity), clamp(uDensityTether, 0.0, 4.0));
  // Full testing range: allows negative values (explosive anti-spring) and high snap values
  vec3 fSpring = toTarget * (uReturnSpeed * returnMultiplier * densityTether * uSnapRigidity);
  // The continuous modal resonator transports particles itself; geometry must emerge from
  // that transport, not from a spring toward stored target coordinates.
  fSpring *= 1.0 - uResEnabled * clamp(uResDominance, 0.0, 1.0);

  if(uEntityCount == 0) fSpring = vec3(0.0);
  // --- 2. Divergence-Free Curl Noise Advection ---
  vec3 noiseCoords = vec3(pos.xy * (uCurlScale * 0.0035), pos.z * (uCurlScale * 0.0035 * uCurlDepth));
  vec3 curl = curlNoise(noiseCoords, uTime * uCurlSpeed * 0.85);
  // Modulate curl by dispersion & inverse density so perimeter stippling sprays out
  float curlFalloff = (uStyleMode > 0.5) ? 0.35 : (1.0 + (1.0 - targetDensity) * 0.7);
  vec3 fCurl = curl * (uTurbulence * 85.0 * curlFalloff);

  // --- 3. Field vortex (global) ---
  // The planar field swirls in the composition plane. With true 3D bodies the same
  // strength becomes a vortex about a real axis, so the swirl turns *through* the
  // letterform instead of sliding the whole cloud sideways in the picture plane —
  // the cue that separates a flat drawing from a solid.
  vec3 fVortex = vec3(0.0);
  {
    vec2 rVort = pos.xy - uVortexCenter;
    float rLen = length(rVort);
    vec2 vTangent = vec2(-rVort.y, rVort.x) / (rLen + 25.0);
    float vortRadius = max(5.0, uVortexRadius);
    float vortFactor = exp(- (rLen * rLen) / (2.0 * vortRadius * vortRadius));
    vec3 fPlanar = vec3(vTangent * (uVortexStrength * 160.0 * vortFactor), 0.0);

    if (uDepthGeometry > 0.5 && uVortex3d > 0.0001) {
      // Radial distance measured in the full 3D frame, so the falloff is a shell
      // rather than a cylinder and the vortex decays through the thickness.
      vec3 r = vec3(rVort, pos.z);
      float r3 = max(0.001, length(r));
      float fall3 = exp(- (r3 * r3) / (2.0 * vortRadius * vortRadius));
      float axis3 = (uCompPlane > 0.5) ? 1.0 : -1.0;
      // Swirl about the depth axis, plus a pitch term along it: a helix.
      vec3 swirl = vec3(-r.y, r.x, 0.0) / (r3 + 25.0);
      vec3 pitch = vec3(0.0, 0.0, axis3 * -r.y) / (r3 + 25.0);
      vec3 f3 = (swirl + pitch * 0.75) * (uVortexStrength * 160.0 * fall3);
      fVortex = mix(fPlanar, f3, clamp(uVortex3d, 0.0, 1.0));
    } else {
      fVortex = fPlanar;
    }
  }

  // --- 3B. Unified persistent force emitters: formations and pins share one physical path ---
  vec3 fEntity = vec3(0.0);
  for (int i = 0; i < 18; i++) {
    if (i >= uForceEmitterCount) break;
    vec4 centre = uForceEmitterCenter[i];
    vec4 params = uForceEmitterParams[i];
    float radius = max(5.0, centre.w);
    vec3 d = pos - centre.xyz;
    bool world3d = params.w > 0.5;
    float dist = world3d ? length(d) : length((uCompPlane < 0.5) ? d.xy : d.xz);
    float fall = exp(-(dist * dist) / (2.0 * radius * radius));
    if (fall < 0.000001) continue;
    if (world3d) {
      // Swirl about the depth axis of the composition, not always about world
      // Z: on a horizontal stage the genuine whirlpool axis is vertical.
      vec3 axis = (uCompPlane > 0.5) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      vec3 radial = d / (dist + 15.0);
      vec3 tangent = cross(axis, d) / (dist + 15.0);
      if (params.y > 0.5 && params.y < 1.5) fEntity -= radial * (params.x * 400.0 * fall);
      else if (params.y > 1.5 && params.y < 2.5) fEntity += radial * (params.x * 400.0 * fall);
      else if (params.y > 2.5) {
        vec3 helix = (cross(axis, d) - axis * dot(d, axis) * 0.35) / (dist + 10.0);
        fEntity += helix * (params.x * 480.0 * fall);
      }
      fEntity += tangent * (params.z * 480.0 * fall);
    } else {
      vec2 dp = (uCompPlane < 0.5) ? d.xy : d.xz;
      float r = length(dp);
      vec2 tangent = vec2(-dp.y, dp.x) / (r + 15.0);
      vec2 radial = dp / (r + 15.0);
      vec2 force2 = vec2(0.0);
      if (params.y > 0.5 && params.y < 1.5) force2 -= radial * (params.x * 400.0 * fall);
      else if (params.y > 1.5 && params.y < 2.5) force2 += radial * (params.x * 400.0 * fall);
      else if (params.y > 2.5) force2 += (tangent * (params.x * 220.0) - radial * 30.0) * fall;
      force2 += tangent * (params.z * 220.0 * fall);
      if (uCompPlane < 0.5) fEntity.xy += force2; else fEntity.xz += force2;
    }
  }

  // --- 4. Inter-Glyph Directional Dispersion ---
  // The bridge between two letterforms disperses along the curl field. With 3D
  // bodies the same bridge also opens through the thickness, so the two forms
  // interpenetrate in depth rather than only sliding past each other.
  vec3 fDisperse = vec3(0.0);
  if (abs(uDispersion) > 0.0001) {
    float bridgeFactor = smoothstep(0.05, 0.95, sMorph) * (1.0 - targetDensity * 0.4);
    vec3 fPlanar = vec3(
      uDispersion * 75.0 * (curl.x * 0.8 + 0.6) * bridgeFactor,
      uDispersion * 35.0 * curl.y * bridgeFactor,
      0.0
    );
    if (uDepthGeometry > 0.5 && uDispersion3d > 0.0001) {
      vec3 f3 = vec3(fPlanar.xy, uDispersion * 75.0 * curl.z * bridgeFactor);
      fDisperse = mix(fPlanar, f3, clamp(uDispersion3d, 0.0, 1.0));
    } else {
      fDisperse = fPlanar;
    }
  }

  // --- 5. Free Relational System: Multi-Attractor Gravity & Orbital Whirlpools ---
  vec3 fRelational = vec3(0.0);
  if (uRelationalEnabled > 0.5) {
    for (int i = 0; i < 10; i++) {
      if (i >= uAttractorCount) break;
      vec3 aPos = uAttractors[i].xyz;
      float aMass = uAttractors[i].w;
      
      vec3 toAttr = aPos - pos;
      float dAttr = length(toAttr);
      
      // Softened gravitational potential (Plummer sphere)
      float eps = max(1.0, uGravitySoftening);
      float denom = pow(dAttr * dAttr + eps * eps, uGravityFalloff);
      fRelational += toAttr * (uRelationalGravity * aMass * 140000.0 / denom);
      
      // Relational orbital torque / Coriolis swirl around attractor. Under true
      // 3D bodies the whirlpool turns about the depth axis through the attractor,
      // so a body's sheets revolve with it rather than sliding past in-plane.
      float sr = max(5.0, uSwirlRadius);
      float aFalloff = exp(- (dAttr * dAttr) / (2.0 * sr * sr));
      float spinMag = uRelationalSpin * uAttractorSpin[i] * 350.0 * aFalloff;
      vec3 axisR = (uCompPlane > 0.5) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      vec3 swirlPlanar = vec3(-toAttr.y, toAttr.x, 0.0) / (dAttr + 22.0);
      vec3 swirl3 = cross(axisR, toAttr) / (dAttr + 22.0);
      fRelational += mix(swirlPlanar, swirl3, uDepthGeometry) * spinMag;
    }

    // Chaos Vector Field (Strange attractor non-linear flow)
    if (uChaosFactor > 0.001) {
      float sX = sin(pos.y * 0.007 + uTime * 0.8);
      float cY = cos(pos.x * 0.007 - uTime * 0.7);
      vec3 chaosVec = vec3(
        sX * cY - 0.08 * pos.x * 0.003,
        cos(pos.z * 0.01 + uTime * 0.5) * sX - 0.08 * pos.y * 0.003,
        sin(pos.x * 0.005 + pos.y * 0.005)
      );
      fRelational += chaosVec * (uChaosFactor * 160.0);
    }
  }

  // --- 6. Pointer Interaction Force ---
  vec3 fPointer = vec3(0.0);
  if (uPointerRadius > 0.0 && abs(uPointerStrength) > 0.0001) {
    vec3 toPtr = pos - vec3(uPointerPos,uPointerZ);
    float dPtr = length(toPtr);
    if (dPtr < uPointerRadius) {
      float normDist = dPtr / uPointerRadius;
      float falloff = pow(max(0.0, 1.0 - normDist), uPointerFalloffPower);

      if (uInteractionMode < 0.5) {
        // Repulsion: push outward
        vec3 dir = (dPtr > 0.001) ? (toPtr / dPtr) : vec3(0.0, 1.0, 0.0);
        fPointer += dir * (uPointerStrength * 400.0 * falloff);
      } else if (uInteractionMode < 1.5) {
        // Attraction: pull inward
        vec3 dir = (dPtr > 0.001) ? (-toPtr / dPtr) : vec3(0.0);
        fPointer += dir * (uPointerStrength * 400.0 * falloff);
      } else {
        // Pointer Vortex: swirl around cursor. With 3D bodies the whirl turns
        // about the depth axis through the pointer, carrying the sheets with it.
        vec3 axisP = (uCompPlane > 0.5) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
        vec3 swirlPlanar = vec3(-toPtr.y, toPtr.x, 0.0) / (dPtr + 10.0);
        vec3 swirl3 = cross(axisP, toPtr) / (dPtr + 10.0);
        fPointer += mix(swirlPlanar, swirl3, uDepthGeometry) * (uPointerStrength * 480.0 * falloff);
      }

      // Velocity injection from mouse movement
      fPointer.xy += uPointerVelocity * (falloff * 0.85);
    }
  }

  // --- 6B. Legacy placed points are compiled into the unified force-emitter table. ---

  // --- 7B. Continuous Modal Cymatic Resonator: vibration-field transport ---
  // Real-time approximation: the field intensity I = <w^2> ~= Wre^2 + Wim^2 is the
  // time-averaged squared displacement of the driven medium (the standard "sand on a
  // vibrating plate" approximation), reconstructed each frame from the resonator's live
  // per-mode complex envelopes. Particles slide down its gradient into the nodal
  // (low-intensity) regions, get agitated in proportion to local vibration, and are
  // softly confined to the resonator's extent — there is no attraction to any stored
  // target shape here.
  // uRes3D selects the mode set the CPU is driving: 0 = the 2D plate (uResPlane picks
  // horizontal/vertical, normal axis hard-confined); 1 = the volumetric standing-wave
  // field of a rigid-walled box cavity, where the medium IS the space — transport,
  // agitation and the soft box all act on all three axes, so particles are organised
  // through the whole volume and entrained toward 3D nodal regions.
  vec3 fResonator = vec3(0.0);
  if (uResEnabled > 0.5 && uResDominance > 0.0001) {
    const float RES_PI = 3.14159265358979;
    float L = max(10.0, uResPlateSize);
    if (uRes3D > 0.5) {
      // Volumetric branch: W(x,y,z) = sum envelope * cos(m*pi*u)cos(n*pi*v)cos(p*pi*w),
      // coordinates centred per axis: u,v,w = pos/L + 0.5. Outside [0,1] the cosines just
      // extrapolate; the soft box below is what recages those particles. Slot layout
      // matches cymaticResonator.ts: i = ((m-1)*4 + (n-1))*4 + (p-1), m,n,p in [1..4].
      float un = pos.x / L + 0.5;
      float vn = pos.y / L + 0.5;
      float wn = pos.z / L + 0.5;

      float Wre = 0.0;
      float Wim = 0.0;
      float dWre_du = 0.0;
      float dWre_dv = 0.0;
      float dWre_dw = 0.0;
      float dWim_du = 0.0;
      float dWim_dv = 0.0;
      float dWim_dw = 0.0;

      for (int i = 0; i < 64; i++) {
        // Sparse addressed modes are not a contiguous prefix. Inspect all 64 slots.
        if (abs(uResRe[i]) + abs(uResIm[i]) < 0.00000001) continue;
        int mi = i / 16;
        int ni = (i - mi * 16) / 4;
        int qi = i - mi * 16 - ni * 4;
        float m = float(mi + 1);
        float n = float(ni + 1);
        float p = float(qi + 1);

        float mPiL = m * RES_PI / L;
        float nPiL = n * RES_PI / L;
        float pPiL = p * RES_PI / L;

        float cosMu = cos(m * RES_PI * un);
        float cosNv = cos(n * RES_PI * vn);
        float cosPw = cos(p * RES_PI * wn);
        float sinMu = sin(m * RES_PI * un);
        float sinNv = sin(n * RES_PI * vn);
        float sinPw = sin(p * RES_PI * wn);

        float phi = cosMu * cosNv * cosPw;
        float dphi_du = -mPiL * sinMu * cosNv * cosPw;
        float dphi_dv = -nPiL * cosMu * sinNv * cosPw;
        float dphi_dw = -pPiL * cosMu * cosNv * sinPw;

        float re = uResRe[i];
        float im = uResIm[i];

        Wre += re * phi;
        Wim += im * phi;
        dWre_du += re * dphi_du;
        dWre_dv += re * dphi_dv;
        dWre_dw += re * dphi_dw;
        dWim_du += im * dphi_du;
        dWim_dv += im * dphi_dv;
        dWim_dw += im * dphi_dw;
      }

      float intensity = (Wre * Wre + Wim * Wim) * uResDriveScale;
      float dI_du = 2.0 * (Wre * dWre_du + Wim * dWim_du) * uResDriveScale;
      float dI_dv = 2.0 * (Wre * dWre_dv + Wim * dWim_dv) * uResDriveScale;
      float dI_dw = 2.0 * (Wre * dWre_dw + Wim * dWim_dw) * uResDriveScale;

      // Transport: slide down the vibration-intensity gradient in full 3D.
      vec3 transport = -vec3(dI_du, dI_dv, dI_dw) * uResTransport;

      // Agitation: grains bounce where the medium itself is moving, proportional to
      // sqrt(intensity); the kick is hashed per particle and per frame in 3D.
      vec3 seedR = vec3(vUv * 731.3, uTime * 9.13);
      vec3 kick = vec3(
        fract(sin(dot(seedR, vec3(27.61, 61.19, 14.7))) * 51234.239) * 2.0 - 1.0,
        fract(sin(dot(seedR, vec3(71.41, 19.61, 38.3))) * 61234.919) * 2.0 - 1.0,
        fract(sin(dot(seedR, vec3(13.17, 43.71, 91.19))) * 41234.317) * 2.0 - 1.0
      );
      vec3 agitation = kick * (uResAgitation * sqrt(max(0.0, intensity)));

      // Soft box on all three axes (half-size L/2 per axis). This volume boundary is the
      // ONLY cage in 3D: no normal-axis pin, no plate damping — the body law's own spring
      // holds the shape while the field organises it.
      float halfL = L * 0.5;
      vec3 boundaryForce = vec3(0.0);
      if (abs(pos.x) > halfL) boundaryForce.x = -sign(pos.x) * (abs(pos.x) - halfL);
      if (abs(pos.y) > halfL) boundaryForce.y = -sign(pos.y) * (abs(pos.y) - halfL);
      if (abs(pos.z) > halfL) boundaryForce.z = -sign(pos.z) * (abs(pos.z) - halfL);
      boundaryForce *= uResBoundary;

      fResonator = (transport + agitation + boundaryForce) * clamp(uResDominance, 0.0, 1.0);
    } else {
    // 2D plate (legacy path, expressions and constants unchanged). uResPlane stays
    // meaningful here only: it selects which two world axes are the plate surface.
    float u = pos.x;
    float v = (uResPlane < 0.5) ? pos.z : pos.y;
    float un = u / L;
    float vn = v / L;

    float Wre = 0.0;
    float Wim = 0.0;
    float dWre_du = 0.0;
    float dWre_dv = 0.0;
    float dWim_du = 0.0;
    float dWim_dv = 0.0;

    for (int i = 0; i < 64; i++) {
      // Sparse addressed modes are not a contiguous prefix. Inspect all 64 slots.
      if (abs(uResRe[i]) + abs(uResIm[i]) < 0.00000001) continue;
      int mi = i / 8;
      int ni = i - mi * 8;
      float m = float(mi + 1);
      float n = float(ni + 1);
      float s = (mod(m + n, 2.0) < 0.5) ? 1.0 : -1.0;

      float mPiL = m * RES_PI / L;
      float nPiL = n * RES_PI / L;

      float cosMu = cos(m * RES_PI * un);
      float cosNv = cos(n * RES_PI * vn);
      float cosNu = cos(n * RES_PI * un);
      float cosMv = cos(m * RES_PI * vn);
      float sinMu = sin(m * RES_PI * un);
      float sinNv = sin(n * RES_PI * vn);
      float sinNu = sin(n * RES_PI * un);
      float sinMv = sin(m * RES_PI * vn);

      float phi = cosMu * cosNv + s * cosNu * cosMv;
      float dphi_du = -mPiL * sinMu * cosNv - s * nPiL * sinNu * cosMv;
      float dphi_dv = -nPiL * cosMu * sinNv - s * mPiL * cosNu * sinMv;

      float re = uResRe[i];
      float im = uResIm[i];

      Wre += re * phi;
      Wim += im * phi;
      dWre_du += re * dphi_du;
      dWre_dv += re * dphi_dv;
      dWim_du += im * dphi_du;
      dWim_dv += im * dphi_dv;
    }

    float intensity = (Wre * Wre + Wim * Wim) * uResDriveScale;
    float dI_du = 2.0 * (Wre * dWre_du + Wim * dWim_du) * uResDriveScale;
    float dI_dv = 2.0 * (Wre * dWre_dv + Wim * dWim_dv) * uResDriveScale;

    // Transport: slide down the vibration-intensity gradient toward nodal (quiet) regions.
    vec2 transport = -vec2(dI_du, dI_dv) * uResTransport;

    // Agitation: grains bounce where the plate itself is moving, proportional to sqrt(intensity).
    vec3 seedR = vec3(vUv * 731.3, uTime * 9.13);
    vec2 kick = vec2(
      fract(sin(dot(seedR, vec3(27.61, 61.19, 14.7))) * 51234.239) * 2.0 - 1.0,
      fract(sin(dot(seedR, vec3(71.41, 19.61, 38.3))) * 61234.919) * 2.0 - 1.0
    );
    vec2 agitation = kick * (uResAgitation * sqrt(max(0.0, intensity)));

    // Soft boundary wall keeping particles on the finite plate.
    vec2 boundaryForce = vec2(0.0);
    float halfL = L * 0.5;
    if (abs(u) > halfL) boundaryForce.x = -sign(u) * (abs(u) - halfL);
    if (abs(v) > halfL) boundaryForce.y = -sign(v) * (abs(v) - halfL);
    boundaryForce *= uResBoundary;

    vec2 planeForce = transport + agitation + boundaryForce;

    float dom = clamp(uResDominance, 0.0, 1.0);
    if (uResPlane < 0.5) {
      // Horizontal plate: X-Z is the plate surface, Y is the plate normal.
      fResonator.x += planeForce.x;
      fResonator.z += planeForce.y;
      fResonator.y += -pos.y * 6.0 * dom;
      vel.y *= mix(1.0, 0.9, dom);
    } else {
      // Vertical plate: X-Y is the plate surface, Z is the plate normal.
      fResonator.x += planeForce.x;
      fResonator.y += planeForce.y;
      fResonator.z += -pos.z * 6.0 * dom;
      vel.z *= mix(1.0, 0.9, dom);
    }
    fResonator *= dom;
    }
  }

  // --- 7C. Shared Eulerian medium: crowd pressure + drag into the medium flow ---
  // Samples are gated to the grid AABB; particles outside the covered extent feel nothing.
  vec3 fMedium = vec3(0.0);
  if (uMediumEnabled > 0.5 && uMedium3D < 0.5) {
    vec2 mPos = (uMediumPlane > 0.5) ? pos.xz : pos.xy;
    vec2 mSpan = max(uMediumMax - uMediumMin, vec2(0.001));
    vec2 guv = (mPos - uMediumMin) / mSpan;
    if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0) {
      vec2 flow = texture2D(uMediumVelTexture, guv).xy;
      vec2 mPlane = (uMediumPlane > 0.5) ? vel.xz : vel.xy;
      // Pressure gradient per world px: the solver runs in unit cells, so the
      // central difference is divided by the world cell size.
      float cellWorld = mSpan.x / max(uMediumGridRes, 1.0);
      float pR = texture2D(uMediumPressureTexture, guv + vec2(uMediumTexel.x, 0.0)).x;
      float pL = texture2D(uMediumPressureTexture, guv - vec2(uMediumTexel.x, 0.0)).x;
      float pT = texture2D(uMediumPressureTexture, guv + vec2(0.0, uMediumTexel.y)).x;
      float pB = texture2D(uMediumPressureTexture, guv - vec2(0.0, uMediumTexel.y)).x;
      vec2 gradP = vec2(pR - pL, pT - pB) / (2.0 * max(cellWorld, 0.001));
      vec2 f2 = -gradP * (uMediumPressureGain * 40.0) + (flow - mPlane) * (uMediumCoupling * 6.0);
      if (uMediumPlane > 0.5) fMedium.xz = f2; else fMedium.xy = f2;
    }
  }
  if (uMediumEnabled > 0.5 && uMedium3D > 0.5) {
    // 3D medium: an N×N×N voxel volume tiled into an N²×N² texture (N×N tiles
    // of N×N, tile = depth slice; canonical math in mediumGrid.ts). The volume
    // covers the sheet extent on its two media axes and a depth range of the
    // same span centred on the field, so it is a cube. The particle samples the
    // flow trilinearly at its own 3D position and the pressure gradient from
    // the same eight taps: force acts on all three world axes, so a body is
    // entrained as a solid through the full depth, not as a decal on a sheet.
    float mN = uMediumN;
    float mSide = uMediumTexSide;
    vec2 mSpan = max(uMediumMax - uMediumMin, vec2(0.001));
    vec2 mPos = (uMediumPlane > 0.5) ? pos.xz : pos.xy;
    float mDepth = (uMediumPlane > 0.5) ? pos.y : pos.z;
    vec2 guv = (mPos - uMediumMin) / mSpan;
    // Depth axis spans the sheet extent, centred on the field: [-span/2, +span/2].
    float gd = (mDepth + 0.5 * mSpan.x) / mSpan.x;
    if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0 && gd > 0.0 && gd < 1.0) {
      // Trilinear tap (macro, not helper: the 7C block stays self-contained
      // inside main). Voxel coords clamp to the volume edge — free-slip wall,
      // the same boundary philosophy as the solver — then the tiling maps the
      // depth slice to its N×N tile.
      #define M3_TAP(tex, px, py, pz) texture2D(tex, (vec2(mod(pz, mN) * mN + px, floor(pz / mN) * mN + py) + 0.5) / mSide)
      vec3 fv = clamp(vec3(guv * mN, gd * mN), vec3(0.0), vec3(mN - 1.0));
      vec3 mi = floor(fv);
      vec3 mf = fv - mi;
      vec3 c0 = max(mi, vec3(0.0));
      vec3 c1 = min(mi + vec3(1.0), vec3(mN - 1.0));
      vec4 v000 = M3_TAP(uMediumVelTexture, c0.x, c0.y, c0.z);
      vec4 v100 = M3_TAP(uMediumVelTexture, c1.x, c0.y, c0.z);
      vec4 v010 = M3_TAP(uMediumVelTexture, c0.x, c1.y, c0.z);
      vec4 v110 = M3_TAP(uMediumVelTexture, c1.x, c1.y, c0.z);
      vec4 v001 = M3_TAP(uMediumVelTexture, c0.x, c0.y, c1.z);
      vec4 v101 = M3_TAP(uMediumVelTexture, c1.x, c0.y, c1.z);
      vec4 v011 = M3_TAP(uMediumVelTexture, c0.x, c1.y, c1.z);
      vec4 v111 = M3_TAP(uMediumVelTexture, c1.x, c1.y, c1.z);
      vec3 flow = mix(mix(mix(v000, v100, mf.x), mix(v010, v110, mf.x), mf.y),
                      mix(mix(v001, v101, mf.x), mix(v011, v111, mf.x), mf.y), mf.z).xyz;
      float p000 = M3_TAP(uMediumPressureTexture, c0.x, c0.y, c0.z).x;
      float p100 = M3_TAP(uMediumPressureTexture, c1.x, c0.y, c0.z).x;
      float p010 = M3_TAP(uMediumPressureTexture, c0.x, c1.y, c0.z).x;
      float p110 = M3_TAP(uMediumPressureTexture, c1.x, c1.y, c0.z).x;
      float p001 = M3_TAP(uMediumPressureTexture, c0.x, c0.y, c1.z).x;
      float p101 = M3_TAP(uMediumPressureTexture, c1.x, c0.y, c1.z).x;
      float p011 = M3_TAP(uMediumPressureTexture, c0.x, c1.y, c1.z).x;
      float p111 = M3_TAP(uMediumPressureTexture, c1.x, c1.y, c1.z).x;
      #undef M3_TAP
      // Exact trilinear derivative: per-cell pressure slope per world px — the
      // same magnitude the 2D central difference carries on smooth fields.
      float cellWorld = mSpan.x / max(mN, 1.0);
      vec3 gradP = vec3(
        ((p100 - p000) * (1.0 - mf.y) + (p110 - p010) * mf.y) * (1.0 - mf.z)
          + ((p101 - p001) * (1.0 - mf.y) + (p111 - p011) * mf.y) * mf.z,
        ((p010 - p000) * (1.0 - mf.x) + (p110 - p100) * mf.x) * (1.0 - mf.z)
          + ((p011 - p001) * (1.0 - mf.x) + (p111 - p101) * mf.x) * mf.z,
        ((p001 - p000) * (1.0 - mf.y) + (p011 - p010) * mf.y) * (1.0 - mf.x)
          + ((p101 - p100) * (1.0 - mf.y) + (p111 - p110) * mf.y) * mf.x
      ) / max(cellWorld, 0.001);
      vec3 mVel = (uMediumPlane > 0.5) ? vel.xzy : vel.xyz;
      vec3 f3 = -gradP * (uMediumPressureGain * 40.0) + (flow - mVel) * (uMediumCoupling * 6.0);
      // Medium-axis order (a, b, depth) unwound to world axes; all three drive.
      fMedium += (uMediumPlane > 0.5) ? f3.xzy : f3;
    }
  }

  // --- 7D. Glyph SDF colliders: letterforms as boundaries with energy-dependent integrity ---
  // Sign convention: grad points toward increasing distance (out of the strokes), so
  // obstacle mode pushes along +grad and vessel mode along -grad. Integrity is a
  // constraint, not a decoration: wall strength decays with the contact speed, so
  // energetic particles buy passage and the wall heals as things calm down.
  // Residency: a wall never fights a particle whose own slot lives in the solid —
  // obstacle walls stop visitors only, vessel walls contain residents only. Without
  // this the formation hollows itself into a wireframe shell.
  vec3 fCollision = vec3(0.0);
  if (uCollisionEnabled > 0.5) {
    vec4 tile = uCollisionTile[eIdx];
    if (tile.w > 0.5) {
      float cMorph = sMorph;
      vec2 local = sdfLocalPos(pos, entityCenter, transform, co, si, uCompPlane);
      float cD;
      vec2 cGrad;
      sdfSample(local, tile, cMorph, cD, cGrad);
      vec2 tLocal = sdfLocalPos(targetPos, entityCenter, transform, co, si, uCompPlane);
      float dT;
      vec2 tGrad;
      sdfSample(tLocal, tile, cMorph, dT, tGrad);
      bool resident = dT < 0.0;
      vec3 cN = sdfWorldNormal(cGrad, transform, co, si, uCompPlane);
      float cBand = max(1.0, uCollisionBand);
      float cWorld = cD * ${SDF_DISTANCE_SCALE}.0;
      // Extruded body: the boundary is the Minkowski combination of the 2D section
      // with the local thickness, so a particle can no longer pass straight through
      // a letterform's depth and the wall normal turns to face the near surface.
      if (uDepthGeometry > 0.5) {
        float cHalf = sdfHalfThickness(local, tile, cMorph);
        float cDz = sdfLocalZ(pos, entityCenter, uEntityDepthScale[eIdx], uCompPlane);
        cWorld = slabDistance(cWorld, cDz, cHalf);
        float over = abs(cDz) - cHalf;
        if (over > 0.0) {
          float sgn = cDz > 0.0 ? 1.0 : -1.0;
          cN = (uCompPlane > 0.5) ? vec3(0.0, sgn, 0.0) : vec3(0.0, 0.0, sgn);
        }
      }
      // Contact falloff: full strength at the surface, decaying outward across the band.
      float cFalloff = exp(-max(0.0, cWorld) / cBand);
      float cSpeed = length(vel);
      float cWall = 1.0 / (1.0 + uCollisionIntegrity * cSpeed * 0.01 * cFalloff);
      float cW = clamp(cFalloff * cWall, 0.0, 1.0);
      vec2 cPlane = (uCompPlane > 0.5) ? vel.xz : vel.xy;
      float cVn = dot(cPlane, cN.xy);
      vec2 cTan = cPlane - cN.xy * cVn;
      if (uCollisionMode < 0.5) {
        // Obstacle: strokes are solid to visitors; the exp term grows with penetration
        // depth (bounded at e^2) so deep intruders are evicted harder.
        if (!resident && cWorld < cBand) {
          float push = uCollisionStrength * 400.0 * exp(clamp(-cWorld / cBand, -1.0, 2.0));
          fCollision += cN * (push * cW);
          if (cVn < 0.0) {
            if (uDepthGeometry > 0.5) {
              // The depth axis takes part in the contact: a face hit reflects
              // and rubs in full 3D, so a face is as hard as a flank.
              float vn3 = dot(vel, cN);
              vec3 reflected3 = (vel - cN * vn3) * (1.0 - uCollisionFriction) - cN * (vn3 * uCollisionRestitution);
              vel = mix(vel, reflected3, cW);
            } else {
              vec2 reflected = cTan * (1.0 - uCollisionFriction) - cN.xy * (cVn * uCollisionRestitution);
              vec2 vNew = mix(cPlane, reflected, cW);
              if (uCompPlane > 0.5) vel.xz = vNew; else vel.xy = vNew;
            }
          }
        }
      } else {
        // Vessel: stroke interiors contain their residents. Thin strokes make this
        // degenerate (band overlaps both walls); the falloff blend keeps the response finite.
        if (resident && cWorld > -cBand && cWorld < cBand * 4.0) {
          float push = uCollisionStrength * 400.0 * cFalloff;
          fCollision -= cN * (push * cW);
          if (cVn > 0.0) {
            if (uDepthGeometry > 0.5) {
              float vn3 = dot(vel, cN);
              vec3 reflected3 = (vel - cN * vn3) * (1.0 - uCollisionFriction) - cN * (vn3 * uCollisionRestitution);
              vel = mix(vel, reflected3, cW);
            } else {
              vec2 reflected = cTan * (1.0 - uCollisionFriction) - cN.xy * (cVn * uCollisionRestitution);
              vec2 vNew = mix(cPlane, reflected, cW);
              if (uCompPlane > 0.5) vel.xz = vNew; else vel.xy = vNew;
            }
          }
        }
      }
    }
  }

  // --- 7E. Sorted-grid pairwise collision response ---
  // The pass writes composition-plane forces; the per-step velocity change is
  // clamped so a dense pile can never inject more than uPairMaxDelta in one step.
  vec3 fPairwise = vec3(0.0);
  if (uPairwiseEnabled > 0.5) {
    vec4 pw = texture2D(uPairwiseForceTexture, vUv);
    vec3 pairAccel;
    if (uPairwise3D > 0.5) {
      // 3D bodies: the force pass's second draw buffer carries the depth-axis
      // dv, and the clamp must bound the full 3D velocity change, not its
      // in-plane projection. Stored order is (plane axis 0, depth, plane axis 1),
      // which is already the world order on the XZ plate.
      vec3 pairDv3 = vec3(pw.z, texture2D(uPairwiseForceZTexture, vUv).x, pw.w);
      float pairDvLen3 = length(pairDv3);
      if (pairDvLen3 > uPairMaxDelta) pairDv3 *= uPairMaxDelta / pairDvLen3;
      pairAccel = (uCompPlane < 0.5) ? vec3(pairDv3.x, pairDv3.z, pairDv3.y) : pairDv3;
    } else {
      vec2 pairDv = pw.zw;
      float pairDvLen = length(pairDv);
      if (pairDvLen > uPairMaxDelta) pairDv *= uPairMaxDelta / pairDvLen;
      pairAccel = (uCompPlane < 0.5) ? vec3(pairDv, 0.0) : vec3(pairDv.x, 0.0, pairDv.y);
    }
    fPairwise = pairAccel / max(uDelta, 0.0001);
  }

  // --- 8. Total Acceleration & Viscous Integration ---
  // Queued click effects: a falloff-weighted impulse around the burst centre,
  // independently queued so a toolbar click cannot be cleared by pointer-leave.
  // Directional (shove), radial (pulse / implode) and tangential (vortex)
  // components compose; each decays through the CPU-side effect state. With 3D
  // bodies the radial shock measures in the full frame (a sphere, not a disc)
  // and the whirl turns about the depth axis through the burst centre.
  vec3 burstOff = pos - vec3(uBurstPosition, uBurstZ);
  float burstDistPlanar = max(0.001, length(burstOff.xy));
  float burstDist = mix(burstDistPlanar, max(0.001, length(burstOff)), uDepthGeometry);
  vec3 radialDir = mix(vec3(burstOff.xy / burstDistPlanar, 0.0), burstOff / burstDist, uDepthGeometry);
  float burstFalloff = pow(max(0.0, 1.0 - burstDist / max(0.001, uBurstRadius)), uPointerFalloffPower);
  vec3 burstAxis = (uCompPlane > 0.5) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  fPointer.xy += uBurstVelocity * burstFalloff * 0.85;
  fPointer += radialDir * (uBurstRadial * burstFalloff);
  fPointer += mix(vec3(-radialDir.y, radialDir.x, 0.0), cross(burstAxis, radialDir), uDepthGeometry) * (uBurstSpin * burstFalloff);
  vec3 accel = fSpring + fCurl + fVortex + fEntity + fDisperse + fRelational + fPointer + fHopf + fResonator + fMedium + fCollision + fPairwise;

  // Constant body force (gravity / wind)
  accel += uGravity * 120.0;

  // Thermal / Brownian agitation (hash noise, decorrelated per particle & frame)
  if (uThermalJitter > 0.0001) {
    vec3 seed = vec3(vUv * 913.7, uTime * 7.31);
    vec3 jit = vec3(
      fract(sin(dot(seed, vec3(12.9898, 78.233, 37.719))) * 43758.5453),
      fract(sin(dot(seed, vec3(93.9898, 67.345, 11.135))) * 24634.6345),
      fract(sin(dot(seed, vec3(45.332, 21.678, 88.123))) * 16227.1327)
    ) * 2.0 - 1.0;
    accel += jit * (uThermalJitter * 400.0);
  }

  // Velocity damping / viscosity (supports zero damping and hyper-viscous)
  vel = (vel + accel * uDelta) * uViscosity;

  // Quadratic (speed-squared) drag
  float speed = length(vel);
  if (uQuadraticDrag > 0.0 && speed > 0.001) {
    float dragScale = max(0.0, 1.0 - uQuadraticDrag * 0.00005 * speed * uDelta * 60.0);
    vel *= dragScale;
    speed = length(vel);
  }

  // Hard clamp (user-adjustable)
  float maxSpeed = max(10.0, uMaxSpeed);
  if (speed > maxSpeed) {
    vel = (vel / speed) * maxSpeed;
    speed = maxSpeed;
  }

  gl_FragColor = vec4(vel, speed);
}
`;
