/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
