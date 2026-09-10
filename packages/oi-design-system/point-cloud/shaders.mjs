/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Point-cloud expression shaders, ported verbatim from
 * EpiLogos/Point-Cloud-Demo@7616489 (src/engine/shaders/*). The GPGPU
 * material lives here; host wiring lives in host.mjs.
 */

export const curlNoiseGLSL = /* glsl */ `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License.
//

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float permute(float x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float taylorInvSqrt(float r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
}

#define F4 0.309016994374947451

float snoise(vec4 v) {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xx;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

  vec3 values0 = vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2));
  vec2 values1 = vec2(dot(p3, x3), dot(p4, x4));
  vec3 m0 = max(0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.5 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, values0) + dot(m1*m1, values1) );
}

// Computes 3D divergence-free curl noise by taking the curl of a 3D vector potential field
vec3 curlNoise(vec3 p, float time) {
  const float e = 0.08;
  const float inv2e = 1.0 / (2.0 * e);

  // Vector potential psi = (psi_x, psi_y, psi_z)
  // curl(psi) = (d(psi_z)/dy - d(psi_y)/dz, d(psi_x)/dz - d(psi_z)/dx, d(psi_y)/dx - d(psi_x)/dy)

  float px_py = snoise(vec4(p.x, p.y + e, p.z, time));
  float px_my = snoise(vec4(p.x, p.y - e, p.z, time));
  float px_pz = snoise(vec4(p.x, p.y, p.z + e, time));
  float px_mz = snoise(vec4(p.x, p.y, p.z - e, time));

  float py_px = snoise(vec4(p.x + e + 17.3, p.y, p.z, time));
  float py_mx = snoise(vec4(p.x - e + 17.3, p.y, p.z, time));
  float py_pz = snoise(vec4(p.x + 17.3, p.y, p.z + e, time));
  float py_mz = snoise(vec4(p.x + 17.3, p.y, p.z - e, time));

  float pz_px = snoise(vec4(p.x + e + 31.7, p.y, p.z, time));
  float pz_mx = snoise(vec4(p.x - e + 31.7, p.y, p.z, time));
  float pz_py = snoise(vec4(p.x + 31.7, p.y + e, p.z, time));
  float pz_my = snoise(vec4(p.x + 31.7, p.y - e, p.z, time));

  float d_psi_z_dy = (pz_py - pz_my) * inv2e;
  float d_psi_y_dz = (py_pz - py_mz) * inv2e;

  float d_psi_x_dz = (px_pz - px_mz) * inv2e;
  float d_psi_z_dx = (pz_px - pz_mx) * inv2e;

  float d_psi_y_dx = (py_px - py_mx) * inv2e;
  float d_psi_x_dy = (px_py - px_my) * inv2e;

  return vec3(
    d_psi_z_dy - d_psi_y_dz,
    d_psi_x_dz - d_psi_z_dx,
    d_psi_y_dx - d_psi_x_dy
  );
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

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uDelta;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPositionTexture, vUv);
  vec4 velData = texture2D(uVelocityTexture, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // Integrate position
  pos += vel * uDelta;

  // Mild z-plane dampening to preserve typography clarity in the view plane
  pos.z *= 0.98;

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

// Free Relational System & Multi-Attractor Orbits
uniform float uRelationalEnabled;
uniform int uAttractorCount;
uniform vec4 uAttractors[6];      // xyz = center coords, w = relative mass
uniform float uAttractorSpin[6];  // angular momentum/vorticity per pole
uniform float uRelationalGravity; // gravitational pull strength
uniform float uRelationalSpin;    // orbital tangential swirl force
uniform float uChaosFactor;       // strange attractor turbulence

// Interaction properties
uniform vec2 uPointerPos;
uniform vec2 uPointerVelocity;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uInteractionMode; // 0 = repel, 1 = attract, 2 = vortex

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPositionTexture, vUv);
  vec4 velData = texture2D(uVelocityTexture, vUv);
  vec4 targetA = texture2D(uTargetATexture, vUv);
  vec4 targetB = texture2D(uTargetBTexture, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // Interpolate target shape coordinate and target density
  vec3 targetPos = mix(targetA.xyz, targetB.xyz, clamp(uMorphProgress, 0.0, 1.0));
  float targetDensity = mix(targetA.w, targetB.w, clamp(uMorphProgress, 0.0, 1.0));

  // --- 1. Hooke's Law Restorative Force ---
  vec3 toTarget = targetPos - pos;

  // Halftone mode snaps more rigidly to grid positions, stipple mode is looser & more organic
  float returnMultiplier = (uStyleMode > 0.5) ? 6.5 : 4.0;
  // Core density areas have slightly stronger return force, perimeter stipple drifts more freely
  float densityTether = mix(0.45, 1.35, targetDensity);
  // Full testing range: allows negative values (explosive anti-spring) and high snap values
  vec3 fSpring = toTarget * (uReturnSpeed * returnMultiplier * densityTether);

  // --- 2. Divergence-Free Curl Noise Advection ---
  vec3 noiseCoords = vec3(pos.xy * (uCurlScale * 0.0035), pos.z * 0.002);
  vec3 curl = curlNoise(noiseCoords, uTime * uCurlSpeed * 0.85);
  // Modulate curl by dispersion & inverse density so perimeter stippling sprays out
  float curlFalloff = (uStyleMode > 0.5) ? 0.35 : (1.0 + (1.0 - targetDensity) * 0.7);
  vec3 fCurl = curl * (uTurbulence * 85.0 * curlFalloff);

  // --- 3. Vorticity & Orbital Swirl Vector ---
  // Pulls boundary particles in an orbital motion, bridging shapes (e.g. O to I)
  vec2 rVort = pos.xy - uVortexCenter;
  float rLen = length(rVort);
  vec2 vTangent = vec2(-rVort.y, rVort.x) / (rLen + 25.0);
  float vortRadius = 450.0;
  float vortFactor = exp(- (rLen * rLen) / (2.0 * vortRadius * vortRadius));
  vec3 fVortex = vec3(vTangent * (uVortexStrength * 160.0 * vortFactor), 0.0);

  // --- 4. Inter-Glyph Directional Dispersion ---
  vec3 fDisperse = vec3(0.0);
  if (abs(uDispersion) > 0.0001) {
    float bridgeFactor = smoothstep(0.05, 0.95, uMorphProgress) * (1.0 - targetDensity * 0.4);
    fDisperse = vec3(
      uDispersion * 75.0 * (curl.x * 0.8 + 0.6) * bridgeFactor,
      uDispersion * 35.0 * curl.y * bridgeFactor,
      0.0
    );
  }

  // --- 5. Free Relational System: Multi-Attractor Gravity & Orbital Whirlpools ---
  vec3 fRelational = vec3(0.0);
  if (uRelationalEnabled > 0.5) {
    for (int i = 0; i < 6; i++) {
      if (i >= uAttractorCount) break;
      vec3 aPos = uAttractors[i].xyz;
      float aMass = uAttractors[i].w;

      vec3 toAttr = aPos - pos;
      float dAttr = length(toAttr);

      // Softened gravitational potential (Plummer sphere)
      float eps = 45.0;
      float denom = pow(dAttr * dAttr + eps * eps, 1.45);
      fRelational += toAttr * (uRelationalGravity * aMass * 140000.0 / denom);

      // Relational orbital torque / Coriolis swirl around attractor
      vec2 aTan = vec2(-toAttr.y, toAttr.x) / (dAttr + 22.0);
      float aFalloff = exp(- (dAttr * dAttr) / (2.0 * 500.0 * 500.0));
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
    vec2 toPtr = pos.xy - uPointerPos;
    float dPtr = length(toPtr);
    if (dPtr < uPointerRadius) {
      float normDist = dPtr / uPointerRadius;
      float falloff = (1.0 - normDist) * (1.0 - normDist);

      if (uInteractionMode < 0.5) {
        // Repulsion: push outward
        vec2 dir = (dPtr > 0.001) ? (toPtr / dPtr) : vec2(0.0, 1.0);
        fPointer.xy += dir * (uPointerStrength * 400.0 * falloff);
      } else if (uInteractionMode < 1.5) {
        // Attraction: pull inward
        vec2 dir = (dPtr > 0.001) ? (-toPtr / dPtr) : vec2(0.0, 0.0);
        fPointer.xy += dir * (uPointerStrength * 400.0 * falloff);
      } else {
        // Pointer Vortex: swirl around cursor
        vec2 pTan = vec2(-toPtr.y, toPtr.x) / (dPtr + 10.0);
        fPointer.xy += pTan * (uPointerStrength * 480.0 * falloff);
      }

      // Velocity injection from pointer movement
      fPointer.xy += uPointerVelocity * (falloff * 0.85);
    }
  }

  // --- 7. Total Acceleration & Viscous Integration ---
  vec3 accel = fSpring + fCurl + fVortex + fDisperse + fRelational + fPointer;

  // Velocity damping / viscosity (supports zero damping and hyper-viscous)
  vel = (vel + accel * uDelta) * uViscosity;

  // Clamping relaxed to allow high-velocity kinetic testing
  float speed = length(vel);
  float maxSpeed = 35000.0;
  if (speed > maxSpeed) {
    vel = (vel / speed) * maxSpeed;
    speed = maxSpeed;
  }

  gl_FragColor = vec4(vel, speed);
}
`;

export const particleVertexShader = /* glsl */ `
precision highp float;

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;

uniform float uMinParticleSize;
uniform float uMaxParticleSize;
uniform float uStyleMode; // 0 = stipple, 1 = halftone
uniform float uPixelRatio;
uniform vec2 uCanvasSize;
uniform float uTime;

varying vec2 vSimUv;
varying float vDensity;
varying float vSpeed;
varying float vJitter;

// High-speed pseudo-random generator
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vSimUv = uv;

  // Sample simulation textures
  vec4 posData = texture2D(uPositionTexture, uv);
  vec4 velData = texture2D(uVelocityTexture, uv);

  vec3 pos = posData.xyz;
  float density = posData.w; // 0.0 (scatter perimeter) to 1.0 (dense stroke core)
  float speed = velData.w;   // local velocity magnitude

  vDensity = density;
  vSpeed = speed;

  // Compute stochastic micro-jitter based on simulation UV coordinates
  float rnd = hash(uv);
  vJitter = rnd;

  // Dynamic particle size calculation
  float baseSize;
  if (uStyleMode > 0.5) {
    // Ordered Halftone mode:
    // Dot radius scales directly with local target darkness/density, creating true raster halftone
    float halftoneT = pow(density, 1.25);
    baseSize = mix(uMinParticleSize * 0.4, uMaxParticleSize, halftoneT);

    // Speed dispersion causes subtle dot disintegration
    baseSize *= clamp(1.0 - speed * 0.0015, 0.35, 1.2);
  } else {
    // Stochastic Stipple mode:
    // Emulates fine ink-jet / risograph spray with random jittered sizes
    float sizeJitter = mix(0.7, 1.35, rnd);
    float densityWeight = mix(0.5, 1.15, density);
    baseSize = mix(uMinParticleSize, uMaxParticleSize, rnd * 0.8 + density * 0.2) * sizeJitter * densityWeight;

    // Fast moving dispersion particles stretch/shrink into fine aerosol spray
    baseSize = mix(baseSize, uMinParticleSize * 0.8, clamp(speed * 0.002, 0.0, 0.7));
  }

  // Orthographic / view space point size scaling
  gl_PointSize = max(1.0, baseSize * uPixelRatio);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const particleFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uParticleColor;
uniform float uColorMode; // 0 = black on white, 1 = white on black
uniform float uDotShape;  // 0 = circle, 1 = square
uniform float uStyleMode; // 0 = stipple, 1 = halftone
uniform float uContrast;

varying vec2 vSimUv;
varying float vDensity;
varying float vSpeed;
varying float vJitter;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);

  float alpha = 0.0;

  if (uDotShape < 0.5) {
    // High-contrast anti-aliased circular stipple dot
    // Uses smoothstep over tight fractional pixel radius for razor-sharp stippling
    float delta = fwidth(dist);
    alpha = 1.0 - smoothstep(0.48 - delta * 1.5, 0.50, dist);
  } else {
    // Typographic matrix square dither dot
    vec2 d = abs(coord);
    float maxD = max(d.x, d.y);
    float delta = fwidth(maxD);
    alpha = 1.0 - smoothstep(0.48 - delta * 1.5, 0.50, maxD);
  }

  if (alpha < 0.01) {
    discard;
  }

  // Subtle ink saturation modulation in core vs outer spray
  float inkAlpha = alpha;
  if (uStyleMode < 0.5) {
    // Stipple spray has tiny variation in opacity like riso ink absorption
    inkAlpha *= mix(0.85, 1.0, vDensity * 0.5 + vJitter * 0.5);
  }

  gl_FragColor = vec4(uParticleColor, inkAlpha);
}
`;
