/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { curlNoiseGLSL } from "./curlNoise.mjs";
const simulationVertexShader = (
  /* glsl */
  `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`
);
const positionSimulationShader = (
  /* glsl */
  `
precision highp float;

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uDelta;
uniform float uCompPlane;        // 0 = vertical (XY facing camera), 1 = horizontal (XZ plate)
uniform float uMorphTrajectory;
uniform float uZDepthRetention;
uniform float uZConfinement;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPositionTexture, vUv);
  vec4 velData = texture2D(uVelocityTexture, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // Integrate position
  pos += vel * uDelta;

  // Mild z-plane dampening only in pure 2D planar mode to preserve flat typography clarity.
  // In Toroidal Hopf (uMorphTrajectory > 0.5) or 3D horizontal chakra mode,
  // Z is the authentic 3D spatial depth coordinate, so preserve full 3D volumetric depth!
  if (uCompPlane < 0.5 && uMorphTrajectory < 0.5) {
    float zDecay = 1.0 - 0.015 * uZConfinement * (1.0 - clamp(uZDepthRetention, 0.0, 1.0));
    pos.z *= pow(max(0.0,zDecay), uDelta * 60.0);
  }

  gl_FragColor = vec4(pos, posData.w); // posData.w holds density/particle metadata
}
`
);
const velocitySimulationShader = (
  /* glsl */
  `
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

// Entities \u2014 first-class centres of formation (see fieldModel.ts). Each enabled formation owns a
// contiguous particle partition; every particle feels every entity's local force.
uniform int uEntityCount;
uniform float uEntityBounds[10];    // exclusive end particle index per partition
uniform vec4 uEntityCenter[10];     // xyz world centre, w = force radius (px)
uniform float uEntityMorph[10];
uniform float uEntityDepthScale[10];
uniform float uEntityNormalized[10];
uniform vec3 uEntityTransform[10];     // per-partition A\u2192B progress
uniform vec4 uEntityForce[10];      // x strength, y mode (0 none, 1 attract, 2 repel, 3 vortex), z spin, w enabled
uniform vec2 uTexSize;              // simulation texture size (particle index reconstruction)
uniform float uCompPlane;           // 0 = vertical (XY), 1 = horizontal (XZ)
uniform float uResDominance;        // 0 = formation springs only \u2026 1 = resonator transport only

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
uniform float uResPlane;        // 0.0 = horizontal plate (X-Z, y confined), 1.0 = vertical plate (X-Y, z confined)
uniform float uResDriveScale;   // final scale on the raw envelope field (tames resonance peaks)

// Dual-Phase Toroidal/Poloidal Morph & Inverse Hopf Fibration System
uniform float uMorphTrajectory;       // 0 = linear, 1 = toroidalHopf, 2 = vortexSpiral, 3 = quantumInterference
uniform float uFiberPhaseOffset;     // delta psi phase difference (0 to 2*PI)
uniform float uToroidalWinding;      // p winding number (e.g. 1 to 12)
uniform float uPoloidalWinding;      // q winding number (e.g. 1 to 12)
uniform float uChiralCoupling;       // coupling/interference strength (0 to 1)
uniform float uOscillationAmp;       // vibrational breathing amplitude
uniform float uOscillationFreq;      // vibrational rate
uniform float uManifoldRadius;       // scale of toroidal interference manifold
uniform float uTorusDepthScale;      // volumetric 3D Z-depth expansion (default 1.0)

// Interaction properties
uniform vec2 uPointerPos;
uniform vec2 uBurstPosition;
uniform vec2 uBurstVelocity;
uniform float uPointerZ;
uniform vec2 uPointerVelocity;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uInteractionMode; // 0 = repel, 1 = attract, 2 = vortex

// Placed persistent interaction points in 3D
uniform int uPlacedPointCount;
uniform vec4 uPlacedPoints[8]; // xyz = 3D position (x, y, z), w = radius
uniform vec4 uPlacedPointParams[8]; // x = strength, y = mode (0 = repel, 1 = attract, 2 = vortex)

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

    float oscBreathing = (1.0 + 0.35 * sin(uPolPhase)) * uOscillationAmp;
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
  vec3 fVortex = vec3(0.0);
  {
    vec2 rVort = pos.xy - uVortexCenter;
    float rLen = length(rVort);
    vec2 vTangent = vec2(-rVort.y, rVort.x) / (rLen + 25.0);
    float vortRadius = max(5.0, uVortexRadius);
    float vortFactor = exp(- (rLen * rLen) / (2.0 * vortRadius * vortRadius));
    fVortex = vec3(vTangent * (uVortexStrength * 160.0 * vortFactor), 0.0);
  }

  // --- 3B. Entity forces: every enabled formation acts on the whole medium (summed, gaussian falloff) ---
  vec3 fEntity = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uEntityCount) break;
    vec4 ef = uEntityForce[i];
    if (ef.w < 0.5) continue;
    vec3 c = uEntityCenter[i].xyz;
    float rad = max(5.0, uEntityCenter[i].w);
    vec3 d = pos - c;
    vec2 dp = (uCompPlane < 0.5) ? d.xy : d.xz;
    float r = length(dp);
    float fall = exp(- (r * r) / (2.0 * rad * rad));
    vec2 tan2 = vec2(-dp.y, dp.x) / (r + 15.0);
    vec2 rad2 = dp / (r + 15.0);
    vec2 f2 = vec2(0.0);
    if (ef.y > 0.5 && ef.y < 1.5) {
      f2 -= rad2 * (ef.x * 400.0 * fall);                     // attract
    } else if (ef.y > 1.5 && ef.y < 2.5) {
      f2 += rad2 * (ef.x * 400.0 * fall);                     // repel
    } else if (ef.y > 2.5) {
      f2 += (tan2 * (ef.x * 220.0) - rad2 * 30.0) * fall;     // vortex swirl with slight inward pull
    }
    f2 += tan2 * (ef.z * 220.0 * fall);                       // additional signed spin
    if (uCompPlane < 0.5) fEntity.xy += f2; else fEntity.xz += f2;
  }

  // --- 4. Inter-Glyph Directional Dispersion ---
  vec3 fDisperse = vec3(0.0);
  if (abs(uDispersion) > 0.0001) {
    float bridgeFactor = smoothstep(0.05, 0.95, sMorph) * (1.0 - targetDensity * 0.4);
    fDisperse = vec3(
      uDispersion * 75.0 * (curl.x * 0.8 + 0.6) * bridgeFactor,
      uDispersion * 35.0 * curl.y * bridgeFactor,
      0.0
    );
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
      
      // Relational orbital torque / Coriolis swirl around attractor
      vec2 aTan = vec2(-toAttr.y, toAttr.x) / (dAttr + 22.0);
      float sr = max(5.0, uSwirlRadius);
      float aFalloff = exp(- (dAttr * dAttr) / (2.0 * sr * sr));
      fRelational.xy += aTan * (uRelationalSpin * uAttractorSpin[i] * 350.0 * aFalloff);
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
        // Pointer Vortex: swirl around cursor
        vec2 pTan = vec2(-toPtr.y, toPtr.x) / (dPtr + 10.0);
        fPointer.xy += pTan * (uPointerStrength * 480.0 * falloff);
      }

      // Velocity injection from mouse movement
      fPointer.xy += uPointerVelocity * (falloff * 0.85);
    }
  }

  // --- 6B. Placed Persistent Interaction Points in 3D (Attractors, Deflectors, Vortices) ---
  if (uPlacedPointCount > 0) {
    for (int i = 0; i < 8; i++) {
      if (i >= uPlacedPointCount) break;
      vec3 pPos = uPlacedPoints[i].xyz;
      float pRad = uPlacedPoints[i].w;
      float pStr = uPlacedPointParams[i].x;
      float pMode = uPlacedPointParams[i].y;

      float pSpin = uPlacedPointParams[i].z;
      bool gaussian = uPlacedPointParams[i].w > 0.5;
      if (pRad > 0.0 && (abs(pStr) > 0.0001 || abs(pSpin) > 0.0001)) {
        vec3 toPt = pos - pPos;
        float dPt = length(toPt);
        if (gaussian || dPt < pRad) {
          float normDist = dPt / pRad;
          float falloff = gaussian ? exp(-0.5 * normDist * normDist) : pow(max(0.0, 1.0 - normDist), uPointerFalloffPower);
          vec3 spinTangent = vec3(-toPt.y, toPt.x, 0.0) / (dPt + 10.0);
          fPointer += spinTangent * (pSpin * 480.0 * falloff);
          if (pMode < 0.5) {
            // 3D Repel
            vec3 dir = (dPt > 0.001) ? (toPt / dPt) : vec3(0.0, 1.0, 0.0);
            fPointer += dir * (pStr * 400.0 * falloff);
          } else if (pMode < 1.5) {
            // 3D Attract
            vec3 dir = (dPt > 0.001) ? (-toPt / dPt) : vec3(0.0);
            fPointer += dir * (pStr * 400.0 * falloff);
          } else {
            // 3D Vortex Swirl (tangential in XY, helical in Z)
            vec3 pTan = vec3(-toPt.y, toPt.x, -toPt.z * 0.35) / (dPt + 10.0);
            fPointer += pTan * (pStr * 480.0 * falloff);
          }
        }
      }
    }
  }

  // --- 7B. Continuous Modal Cymatic Resonator: vibration-field transport ---
  // Real-time approximation: the field intensity I(u,v) = <w^2> ~= Wre^2 + Wim^2 is the
  // time-averaged squared plate displacement (the standard "sand on a vibrating plate"
  // approximation), reconstructed each frame from the resonator's live per-mode complex
  // envelopes. Particles slide down its gradient into the nodal (low-intensity) regions,
  // get agitated in proportion to local vibration, and are softly confined to the plate \u2014
  // there is no attraction to any stored target shape here.
  vec3 fResonator = vec3(0.0);
  if (uResEnabled > 0.5 && uResDominance > 0.0001) {
    const float RES_PI = 3.14159265358979;
    float L = max(10.0, uResPlateSize);
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

  // --- 8. Total Acceleration & Viscous Integration ---
  // The same falloff-weighted velocity impulse as native pointer momentum,
  // independently queued so a toolbar click cannot be cleared by pointer-leave.
  float burstFalloff = pow(max(0.0, 1.0 - distance(pos.xy, uBurstPosition) / max(0.001, uPointerRadius)), uPointerFalloffPower);
  fPointer.xy += uBurstVelocity * burstFalloff * 0.85;
  vec3 accel = fSpring + fCurl + fVortex + fEntity + fDisperse + fRelational + fPointer + fHopf + fResonator;

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
`
);
export {
  positionSimulationShader,
  simulationVertexShader,
  velocitySimulationShader
};
