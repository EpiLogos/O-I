/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
uniform float uColorMode; // 0 = black on white (light), 1 = white on black (dark)

// Color System Uniforms
uniform float uColorEnabled;       // 0.0 = classic monochrome, 1.0 = procedural color field
uniform float uColorDistMode;      // 0 = mono, 1 = linear, 2 = radial, 3 = angular, 4 = velocity, 5 = density, 6 = interference, 7 = rainbow
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uAccentColor;
uniform vec3 uPaletteColors[8];    // Dynamic custom color stops
uniform int uColorStopCount;       // Number of custom stops (2 to 8, or 0 for 3-color fallback)
uniform float uColorCycleSpeed;
uniform float uColorWaveFrequency;
uniform float uColorAngle;         // In radians
uniform vec2 uColorCenter;
uniform float uColorTurbulence;
uniform float uColorSpeedReactive;
uniform float uColorDensityWeight;
uniform float uColorHueShift;
uniform float uColorContrast;

// Spatial Chakra Body System Uniforms
// Entity tints (per particle partition) and the composition focus tint — layered over the field palette
uniform int uEntityCount;
uniform float uEditHasSelection;
uniform float uEditSelected[10];
uniform float uEntityBounds[10];
uniform vec3 uEntityTint[10];
uniform float uEntityTintWeight[10];
uniform vec2 uTexSize;
uniform vec3 uFocusTint;
uniform float uFocusTintWeight;

// Semantic spatial colour fields. These are render-only contributions evaluated from semantic
// bindings at the host boundary; they do not own particles, force centres, or resonator state.
uniform float uCompPlane;              // 0 vertical: XY metric; 1 horizontal: XZ metric
uniform int uSemanticColorCount;
uniform vec4 uSemanticColorCenter[16]; // xyz centre, w radius
uniform vec4 uSemanticColorValue[16];  // rgb linear colour, w gain
uniform vec4 uSemanticColorParams[16]; // x metric: 0 plane / 1 world3d, y falloff: 0 gaussian / 1 compact, z blend: 0 weighted / 1 additive
uniform vec3 uParticleColor;   // mono ink colour (also declared in the fragment stage)

uniform vec4 uGrainA;
uniform vec4 uGrainB;
uniform vec4 uGrainC;
uniform float uGrainEnabled;

// Depth presentation. Orthographic rendering has no convergence, so distance
// could never change a mark's size or tone; these uniforms let a perspective
// camera's depth read as distance instead of being collapsed by the projection.
uniform float uDepthEnabled;
uniform float uPerspective;
uniform float uCameraDistance;      // orbit radius of the eye
uniform float uViewHeight;          // world height of the frustum at the target plane
uniform float uSizeAttenuation;     // strength of the 1/w size falloff (0 = none)
uniform float uSizeAttenuationCurve;// exponent shaping how fast far marks shrink
uniform float uSizeDepthBias;       // extra linear size ramp with depth (-1..1)
uniform float uAerialFade;          // how strongly distance dims the ink
uniform float uAerialRange;         // falloff reach, as a multiple of uCameraDistance
uniform vec3 uDepthTint;            // colour far ink shifts toward
uniform float uDepthTintWeight;

varying vec2 vSimUv;
varying float vDensity;
varying float vSpeed;
varying float vJitter;
varying vec3 vColor;
varying float vTinted;
varying float vEditAlpha;
varying float vDepth;               // 0 at the near limit, 1 at the far limit

// High-speed pseudo-random generator
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// RGB to HSV conversion for smooth chromatic rotation
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Smooth gradient ramp evaluator supporting both 3-stop legacy and 2-to-8 custom palette stops
vec3 evalPaletteRamp(float t, vec3 c1, vec3 c2, vec3 c3, float contrast) {
  float ct = clamp(t, 0.0, 1.0);
  if (contrast != 1.0 && contrast > 0.0) {
    ct = pow(ct, contrast);
  }
  if (uColorStopCount >= 2) {
    float scaled = ct * float(uColorStopCount - 1);
    int idx = min(int(floor(scaled)), uColorStopCount - 2);
    float localT = scaled - float(idx);
    localT = smoothstep(0.0, 1.0, localT);
    vec3 cA = uPaletteColors[0];
    vec3 cB = uPaletteColors[1];
    for (int i = 0; i < 7; i++) {
      if (i == idx) {
        cA = uPaletteColors[i];
        cB = uPaletteColors[i + 1];
      }
    }
    return mix(cA, cB, localT);
  }
  if (ct < 0.5) {
    float u = smoothstep(0.0, 0.5, ct);
    return mix(c1, c3, u);
  } else {
    float u = smoothstep(0.5, 1.0, ct);
    return mix(c3, c2, u);
  }
}

void main() {
  vSimUv = uv;

  // Sample simulation textures
  vec4 posData = texture2D(uPositionTexture, uv);
  vec4 velData = texture2D(uVelocityTexture, uv);

  vec3 pos = posData.xyz;
  float density = posData.w; // 0.0 (scatter perimeter) to 1.0 (dense stroke core)
  float speed = velData.w;   // Local velocity magnitude

  if(uGrainEnabled>0.5) {
    density=clamp(pow(max(0.0001,density),mix(0.35,3.0,uGrainB.w)),0.0,1.0);
  }
  vDensity = density;
  vSpeed = speed;

  // Compute stochastic micro-jitter based on simulation UV coordinates
  float rnd = hash(uv);
  vJitter = rnd;
  if(uGrainEnabled>0.5) rnd=pow(rnd,max(0.1,uGrainA.x));

  // Dynamic particle size calculation
  float baseSize;
  if (uStyleMode > 0.5) {
    // Ordered Halftone mode:
    float halftoneT = pow(density, 1.25);
    baseSize = mix(uMinParticleSize * 0.4, uMaxParticleSize, halftoneT);
    baseSize *= clamp(1.0 - speed * 0.0015, 0.35, 1.2);
  } else {
    // Stochastic Stipple mode:
    float sizeJitter = mix(0.7, 1.35, rnd);
    float densityWeight = mix(0.5, 1.15, density);
    baseSize = mix(uMinParticleSize, uMaxParticleSize, rnd * 0.8 + density * 0.2) * sizeJitter * densityWeight;
    baseSize = mix(baseSize, uMinParticleSize * 0.8, clamp(speed * 0.002, 0.0, 0.7));
  }

  // --- Procedural Field Color Evaluation ---
  if (uColorEnabled > 0.5) {
    // Center-offset particle coordinates in glyph space
    vec2 p = pos.xy - uColorCenter;

    // Organic turbulence modulation: curl noise and local speed swirl the color coordinates
    if (uColorTurbulence > 0.01) {
      float warp = ((rnd - 0.5) * 40.0 + speed * 0.1) * uColorTurbulence;
      p += vec2(sin(pos.y * 0.015 + uTime * 0.8), cos(pos.x * 0.015 + uTime * 0.8)) * warp;
    }

    vec3 col = uPrimaryColor;
    int mode = int(uColorDistMode + 0.5);

    if (mode == 0) {
      // Monochrome Tint
      col = (uColorStopCount >= 1) ? uPaletteColors[0] : uPrimaryColor;
    } else if (mode == 1) {
      // Linear Planar Wave Gradient
      vec2 dir = vec2(cos(uColorAngle), sin(uColorAngle));
      float proj = dot(p, dir);
      float phase = proj * (uColorWaveFrequency * 0.0035) + uTime * uColorCycleSpeed;
      float t = 0.5 + 0.5 * sin(phase);
      col = evalPaletteRamp(t, uPrimaryColor, uSecondaryColor, uAccentColor, uColorContrast);
    } else if (mode == 2) {
      // Concentric Radial Ring Waves
      float dist = length(p);
      float phase = dist * (uColorWaveFrequency * 0.0055) - uTime * uColorCycleSpeed;
      float t = 0.5 + 0.5 * cos(phase);
      col = evalPaletteRamp(t, uPrimaryColor, uSecondaryColor, uAccentColor, uColorContrast);
    } else if (mode == 3) {
      // Conic Angular Sweep
      float ang = atan(p.y, p.x);
      float normAng = (ang / 6.2831853) + 0.5;
      float phase = fract(normAng * max(1.0, floor(uColorWaveFrequency + 0.5)) + uTime * uColorCycleSpeed * 0.15);
      col = evalPaletteRamp(phase, uPrimaryColor, uSecondaryColor, uAccentColor, uColorContrast);
    } else if (mode == 4) {
      // Kinetic Velocity Thermal Spectrum
      float normSpeed = clamp(speed * 0.0035 * (1.0 + uColorSpeedReactive), 0.0, 1.0);
      float t = pow(normSpeed, max(0.2, 1.2 - uColorSpeedReactive * 0.4));
      col = evalPaletteRamp(t, uPrimaryColor, uSecondaryColor, uAccentColor, uColorContrast);
    } else if (mode == 5) {
      // Density Core vs Peripheral Spray Depth
      float t = clamp(density * (1.0 + uColorDensityWeight * 0.5), 0.0, 1.0);
      col = evalPaletteRamp(t, uSecondaryColor, uPrimaryColor, uAccentColor, uColorContrast);
    } else if (mode == 6) {
      // Dual Orthogonal Standing Wave Cymatic Interference
      float k = uColorWaveFrequency * 0.004;
      float w1 = sin((p.x * cos(uColorAngle) + p.y * sin(uColorAngle)) * k + uTime * uColorCycleSpeed);
      float w2 = cos((-p.x * sin(uColorAngle) + p.y * cos(uColorAngle)) * k + uTime * uColorCycleSpeed * 1.33);
      float t = 0.5 + 0.25 * w1 + 0.25 * w2;
      col = evalPaletteRamp(t, uPrimaryColor, uSecondaryColor, uAccentColor, uColorContrast);
    } else if (mode == 7) {
      // Prismatic Rainbow Iridescence
      float k = uColorWaveFrequency * 0.0028;
      float phase = fract(dot(p, vec2(cos(uColorAngle), sin(uColorAngle))) * k + uTime * uColorCycleSpeed * 0.25 + density * 0.2);
      vec3 spectral = hsv2rgb(vec3(phase, 0.88, 0.95));
      col = mix(spectral, uPrimaryColor, 0.12);
    }

    // Dynamic Kinetic Velocity Boost
    if (uColorSpeedReactive > 0.05) {
      float boost = clamp(speed * 0.002 * uColorSpeedReactive, 0.0, 0.65);
      col = mix(col, uAccentColor + vec3(0.2), boost);
    }

    // Density Weighting (stroke core saturation vs mist)
    if (uColorDensityWeight > 0.05) {
      col *= mix(0.72, 1.28, pow(density, 0.85) * uColorDensityWeight);
    }

    // Continuous Temporal Hue Rotation
    if (abs(uColorHueShift) > 0.001) {
      vec3 hsv = rgb2hsv(col);
      hsv.x = fract(hsv.x + uColorHueShift);
      col = hsv2rgb(hsv);
    }

    vColor = col;
  } else {
    vColor = vec3(1.0);
  }

  // Entity tint: which partition is this particle in?
  float pIndex = floor(uv.y * uTexSize.y) * uTexSize.x + floor(uv.x * uTexSize.x);
  int eIdx = 0;
  for (int i = 0; i < 10; i++) {
    if (i >= uEntityCount) break;
    eIdx = i;
    if (pIndex < uEntityBounds[i]) break;
  }
  vEditAlpha = (uEditHasSelection > 0.5 && uEntityCount > 0 && uEditSelected[eIdx] < 0.5) ? 0.23 : 1.0;
  float tintW = (uEntityCount > 0) ? clamp(uEntityTintWeight[eIdx], 0.0, 1.0) : 0.0;
  vTinted = max(tintW, clamp(uFocusTintWeight, 0.0, 1.0));
  if (tintW > 0.001) {
    vec3 tint = uEntityTint[eIdx];
    vec3 tinted = (uColorMode > 0.5)
      ? mix(tint * 1.15, tint * 1.35 + vec3(0.12), density * 0.55)
      : mix(tint * 0.85, tint, density * 0.45);
    vec3 base = (uColorEnabled > 0.5) ? vColor : uParticleColor;
    vColor = mix(base, tinted, tintW);
  }
  if (uFocusTintWeight > 0.001) {
    vec3 base = (uColorEnabled > 0.5 || tintW > 0.001) ? vColor : uParticleColor;
    vColor = mix(base, uFocusTint, clamp(uFocusTintWeight, 0.0, 1.0));
  }

  // Semantic colour is spatial, not partition-owned. Any particle receives a contribution when
  // it enters a bound semantic centre's kernel. Weighted fields are order-independent; additive
  // fields are accumulated separately so authoring-array order can never change the result.
  vec3 semanticWeighted = vec3(0.0);
  float semanticWeight = 0.0;
  vec3 semanticAdd = vec3(0.0);
  float semanticAddWeight = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uSemanticColorCount) break;
    vec4 centre = uSemanticColorCenter[i];
    vec4 value = uSemanticColorValue[i];
    vec4 params = uSemanticColorParams[i];
    float radius = max(0.001, centre.w);
    vec3 delta = pos - centre.xyz;
    float dist = params.x > 0.5
      ? length(delta)
      : (uCompPlane > 0.5 ? length(delta.xz) : length(delta.xy));
    float normDist = dist / radius;
    float kernel = params.y > 0.5
      ? pow(max(0.0, 1.0 - normDist), 2.0)
      : exp(-0.5 * normDist * normDist);
    float weight = max(0.0, value.w) * kernel;
    if (params.z > 0.5) {
      semanticAdd += value.rgb * weight;
      semanticAddWeight += weight;
    } else {
      semanticWeighted += value.rgb * weight;
      semanticWeight += weight;
    }
  }
  if (semanticWeight > 0.000001) {
    vec3 base = (uColorEnabled > 0.5 || vTinted > 0.001) ? vColor : uParticleColor;
    vec3 semanticColor = semanticWeighted / semanticWeight;
    float alpha = clamp(1.0 - exp(-semanticWeight), 0.0, 1.0);
    vColor = mix(base, semanticColor, alpha);
    vTinted = max(vTinted, alpha);
  }
  if (semanticAddWeight > 0.000001) {
    vec3 base = (uColorEnabled > 0.5 || vTinted > 0.001) ? vColor : uParticleColor;
    // Additive is intentionally explicit and bounded; weighted mixing is the default semantic law.
    vColor = clamp(base + semanticAdd, vec3(0.0), vec3(2.5));
    vTinted = max(vTinted, clamp(1.0 - exp(-semanticAddWeight), 0.0, 1.0));
  }

  if(uGrainEnabled>0.5){
    float band=0.7+0.3*sin(pos.x*0.01*uGrainC.x+sin(pos.y*0.013*uGrainC.x)+uGrainC.y);
    baseSize*=mix(1.0,band,uGrainB.w*.35);
    baseSize*=1.0+uGrainC.z*(1.0-density);
  }
  // --- Depth presentation ---
  // gl_PointSize is in device pixels, so a perspective camera only reads as
  // depth if the mark's size is divided by its view distance. Distance is
  // normalized against the orbit radius and the frustum's world height, which
  // keeps the curve stable across zoom, resize and output resolution.
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float viewZ = max(0.0, -mvPosition.z);
  float farReach = max(1.0, uCameraDistance * max(0.1, uAerialRange));
  vDepth = clamp((viewZ - (uCameraDistance - farReach)) / (2.0 * farReach), 0.0, 1.0);

  if (uDepthEnabled > 0.5) {
    if (uPerspective > 0.5 && uSizeAttenuation > 0.0) {
      // Physical 1/w falloff, anchored at the orbit radius so strength 1 is
      // exactly the perspective law and >1 exaggerates the separation.
      float w = max(uCameraDistance * 0.05, viewZ);
      float ratio = uCameraDistance / w;
      baseSize *= pow(max(0.0, ratio), uSizeAttenuation * uSizeAttenuationCurve);
    }
    if (abs(uSizeDepthBias) > 0.0001) {
      // Linear depth ramp on top: near marks larger, far smaller (or inverted).
      baseSize *= 1.0 + uSizeDepthBias * (0.5 - vDepth);
    }
  }

  gl_PointSize = max(1.0, baseSize * uPixelRatio);
}
`;

export const particleFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uParticleColor;
uniform float uColorMode;    // 0 = black on white, 1 = white on black
uniform float uColorEnabled; // 0 = classic monochrome, 1 = procedural color field
// (entity / focus tints arrive through vTinted)
uniform float uDotShape;     // 0 = circle, 1 = square
uniform float uStyleMode;    // 0 = stipple, 1 = halftone
uniform float uContrast;

uniform vec4 uGrainA;
uniform vec4 uGrainB;
uniform vec4 uGrainC;
uniform float uGrainEnabled;
varying vec2 vSimUv;
varying float vDensity;
varying float vSpeed;
varying float vJitter;
varying vec3 vColor;
varying float vTinted;
varying float vEditAlpha;
varying float vDepth;

uniform float uDepthEnabled;
uniform float uAerialFade;
uniform vec3 uDepthTint;
uniform float uDepthTintWeight;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if(uGrainEnabled>0.5){
    float angle=uGrainB.z+(vJitter-.5)*uGrainB.x;
    float co=cos(angle),si=sin(angle);
    coord=vec2(coord.x*co-coord.y*si,coord.x*si+coord.y*co);
    coord.y*=1.0+uGrainB.y;
  }
  float dist = length(coord);

  float alpha = 0.0;

  if (uDotShape < 0.5) {
    // High-contrast anti-aliased circular stipple dot
    float delta = fwidth(dist);
    alpha = 1.0 - smoothstep(0.48 - delta * 1.5, 0.50, dist);
  } else {
    // Typographic matrix square dither dot
    vec2 d = abs(coord);
    float maxD = max(d.x, d.y);
    float delta = fwidth(maxD);
    alpha = 1.0 - smoothstep(0.48 - delta * 1.5, 0.50, maxD);
  }

  if(uGrainEnabled>0.5){
    float squareDistance=max(abs(coord.x),abs(coord.y));
    float outline=mix(squareDistance,dist,clamp(uGrainA.z,0.0,1.0));
    outline+=(sin(atan(coord.y,coord.x)*7.0+vJitter*25.0))*uGrainB.x*.045;
    // Derivatives cross the primitive edge for one-pixel GL points. An unbounded
    // fwidth made subpixel ink almost transparent. Limit the analytic edge band.
    float aa=clamp(fwidth(outline)*1.5,.006,.22)+uGrainA.w*.15;
    alpha=1.0-smoothstep(.49-aa,.50,outline);
    alpha*=uGrainA.y;
    alpha*=mix(clamp(uGrainC.w*2.0,0.0,1.0),1.0,smoothstep(0.0,.25,vDensity));
  }
  if (alpha < 0.01) {
    discard;
  }

  // Subtle ink saturation modulation in core vs outer spray
  float inkAlpha = alpha;
  if (uStyleMode < 0.5) {
    inkAlpha *= mix(0.85, 1.0, vDensity * 0.5 + vJitter * 0.5);
  }

  vec3 finalColor = (uColorEnabled > 0.5 || vTinted > 0.001) ? vColor : uParticleColor;

  // Aerial perspective: distant ink loses contrast and drifts toward the depth
  // tint, which is how a real volume of marks separates front from back. The
  // bias is one-sided — the near limit is never brightened — so the drawing's
  // overall weight is preserved rather than washed out.
  if (uDepthEnabled > 0.5) {
    if (uAerialFade > 0.0001) {
      inkAlpha *= mix(1.0, 1.0 - uAerialFade * vDepth, clamp(vDepth * 2.0, 0.0, 1.0));
    }
    if (uDepthTintWeight > 0.0001) {
      finalColor = mix(finalColor, uDepthTint, clamp(uDepthTintWeight * vDepth, 0.0, 1.0));
    }
  }

  gl_FragColor = vec4(finalColor, inkAlpha * vEditAlpha);
}
`;
