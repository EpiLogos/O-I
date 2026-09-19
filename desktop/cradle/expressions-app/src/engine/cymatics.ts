/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


/** Generic authored-template mode selection. This is physical geometry, not chakra semantics. */
export function deriveCymaticTemplateModes(frequencyHz:number, baseFrequency=40):{m:number;n:number;l:number;a:number;b:number}{
  const target=Math.max(2,frequencyHz/Math.max(.001,baseFrequency));
  let best={m:1,n:1,error:Infinity};
  for(let m=1;m<=8;m++)for(let n=1;n<=8;n++){const error=Math.abs(m*m+n*n-target);if(error<best.error)best={m,n,error};}
  return{m:best.m,n:best.n,l:Math.max(1,Math.round(Math.sqrt(target/3))),a:1,b:(best.m+best.n)%2===0?1:-1};
}

export type CymaticPlateGeometry = 'square' | 'circular' | 'volumetric3D';
export type CymaticDimension = '2D' | '3D';

/**
 * Evaluates the 2D Square Chladni Wave Equation:
 *   ψ(x, y) = a * cos(n * π * x) * cos(m * π * y) - b * cos(m * π * x) * cos(n * π * y)
 * Inputs: x, y in normalized space [-1, 1]
 * Nodal lines (where sand settles) are the zeros: ψ(x, y) = 0
 */
export function evalChladniSquare(
  x: number,
  y: number,
  m: number,
  n: number,
  a: number = 1.0,
  b: number = 1.0
): number {
  const pi = Math.PI;
  return (
    a * Math.cos(n * pi * x) * Math.cos(m * pi * y) -
    b * Math.cos(m * pi * x) * Math.cos(n * pi * y)
  );
}

/**
 * Evaluates the Circular Plate / Membrane Cymatic Wave Equation:
 *   ψ(r, θ) = cos(n * π * r) * cos(m * θ) - 0.28 * sin((m + n) * π * r)
 * Inputs: r in [0, 1], theta in [0, 2π]
 */
export function evalChladniCircular(
  r: number,
  theta: number,
  m: number,
  n: number
): number {
  const pi = Math.PI;
  // Radial standing wave with azimuthal nodal diameters
  const radial = Math.cos(n * pi * r);
  const azimuthal = Math.cos(m * theta);
  const overtone = 0.22 * Math.sin((m + n) * pi * r);
  return radial * azimuthal - overtone;
}

/**
 * Evaluates 3D Volumetric Cymatics (Acoustic Levitation & 3D Standing Wave Cavities):
 *   Ψ(x, y, z) = cos(l*π*x) * cos(m*π*y) * cos(n*π*z) - cos(m*π*x) * cos(n*π*y) * cos(l*π*z)
 * Inputs: x, y, z in [-1, 1]
 * Nodal surfaces (zero-vibration 3D cages) are the roots: Ψ(x, y, z) = 0
 */
export function evalChladni3D(
  x: number,
  y: number,
  z: number,
  l: number,
  m: number,
  n: number
): number {
  const pi = Math.PI;
  return (
    Math.cos(l * pi * x) * Math.cos(m * pi * y) * Math.cos(n * pi * z) -
    Math.cos(m * pi * x) * Math.cos(n * pi * y) * Math.cos(l * pi * z)
  );
}

/**
 * Renders a physics-accurate 2D Chladni plate onto a canvas.
 * Sand particles accumulate where vibration amplitude |ψ| is near zero.
 * The accumulation density follows an inverted Gaussian: density = exp(-|ψ|^2 / 2σ^2)
 */
export function renderChladniPlate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  plateType: CymaticPlateGeometry,
  m: number,
  n: number,
  a: number = 1.0,
  b: number = 1.0,
  coherence: number = 1.0,
  chaosIntensity: number = 1.0,
  timeOffset: number = 0.0
) {
  ctx.clearRect(0, 0, width, height);

  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.44;

  // Sharpness of nodal accumulation line
  // At high coherence: very crisp thin nodal lines
  // In chaotic state: wide, blurred, noisy dispersals
  const sigma = 0.08 + (1.0 - coherence) * 0.22;
  const noiseScale = (1.0 - coherence) * chaosIntensity * 0.45;

  const isCirc = plateType === 'circular';

  // Compute grid step of 2 pixels for high performance while retaining crisp detail
  const step = 2;
  for (let py = 0; py < height; py += step) {
    const ny = (py - cy) / radius;
    for (let px = 0; px < width; px += step) {
      const nx = (px - cx) / radius;
      const r = Math.sqrt(nx * nx + ny * ny);

      // Plate boundary masks
      if (isCirc) {
        if (r > 1.02) continue;
      } else {
        if (Math.abs(nx) > 1.02 || Math.abs(ny) > 1.02) continue;
      }

      // Add flutter perturbation during chaotic in-between states
      let perturb = 0;
      if (noiseScale > 0.001) {
        perturb =
          noiseScale *
          (Math.sin(nx * 14.0 + ny * 12.0 + timeOffset * 3.5) * 0.5 +
            Math.cos(nx * 22.0 - ny * 18.0 + timeOffset * 2.8) * 0.5);
      }

      let psi = 0;
      if (isCirc) {
        const theta = Math.atan2(ny, nx);
        psi = evalChladniCircular(r, theta, Math.round(m), Math.round(n)) + perturb;
      } else {
        psi = evalChladniSquare(nx, ny, m, n, a, b) + perturb;
      }

      const absPsi = Math.abs(psi);
      // Nodal lines occur where |ψ| is near 0
      const density = Math.exp(- (absPsi * absPsi) / (2.0 * sigma * sigma));

      if (density > 0.04) {
        const val = Math.min(255, Math.floor(density * 255));
        // Fill step x step block
        for (let dy = 0; dy < step && py + dy < height; dy++) {
          for (let dx = 0; dx < step && px + dx < width; dx++) {
            const idx = ((py + dy) * width + (px + dx)) * 4;
            pixels[idx + 0] = val;
            pixels[idx + 1] = val;
            pixels[idx + 2] = val;
            pixels[idx + 3] = val;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw plate physical boundary ring/rim
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + coherence * 0.35})`;
  ctx.lineWidth = 2.0;
  if (isCirc) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

/**
 * Samples 3D Volumetric Nodal Points directly from the 3D Standing Wave Helmholtz Eigenmodes.
 * Particles settle strictly on 3D zero-potential nodal surfaces: Ψ(x, y, z) = 0.
 */
export function sampleVolumetric3DNodalPoints(
  particleCount: number,
  l: number,
  m: number,
  n: number,
  coherence: number = 1.0,
  chaosIntensity: number = 1.0,
  radius: number = 240
): Array<{ x: number; y: number; z: number; density: number }> {
  const points: Array<{ x: number; y: number; z: number; density: number }> = [];
  const sigma = 0.09 + (1.0 - coherence) * 0.25;
  const chaosAmp = (1.0 - coherence) * chaosIntensity * 0.35;

  let attempts = 0;
  const maxAttempts = particleCount * 25;

  while (points.length < particleCount && attempts < maxAttempts) {
    attempts++;

    // Random point within unit sphere
    const u = Math.random();
    const costheta = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.cbrt(u);
    const sintheta = Math.sqrt(1 - costheta * costheta);

    const nx = r * sintheta * Math.cos(phi);
    const ny = r * sintheta * Math.sin(phi);
    const nz = r * costheta;

    let perturb = 0;
    if (chaosAmp > 0.001) {
      perturb = (Math.random() - 0.5) * chaosAmp;
    }

    const psi = evalChladni3D(nx, ny, nz, l, m, n) + perturb;
    const absPsi = Math.abs(psi);
    const prob = Math.exp(- (absPsi * absPsi) / (2.0 * sigma * sigma));

    if (Math.random() < prob) {
      points.push({
        x: nx * radius,
        y: ny * radius,
        z: nz * radius,
        density: Math.min(1.0, prob * 1.2),
      });
    }
  }

  // If under-sampled due to high modal complexity, fill remainder on spherical nodal shells
  while (points.length < particleCount) {
    const ang1 = Math.random() * Math.PI * 2;
    const ang2 = (Math.random() - 0.5) * Math.PI;
    const rad = radius * (0.35 + Math.random() * 0.65);
    points.push({
      x: Math.cos(ang1) * Math.cos(ang2) * rad,
      y: Math.sin(ang2) * rad,
      z: Math.sin(ang1) * Math.cos(ang2) * rad,
      density: 0.7,
    });
  }

  return points;
}

/** @deprecated retired legacy-workbench semantic/template catalogue. */
export { CHAKRA_CYMATIC_PROFILES } from './legacy/chakraCymaticProfiles';
