/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
function deriveCymaticTemplateModes(frequencyHz, baseFrequency = 40) {
  const target = Math.max(2, frequencyHz / Math.max(1e-3, baseFrequency));
  let best = { m: 1, n: 1, error: Infinity };
  for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) {
    const error = Math.abs(m * m + n * n - target);
    if (error < best.error) best = { m, n, error };
  }
  return { m: best.m, n: best.n, l: Math.max(1, Math.round(Math.sqrt(target / 3))), a: 1, b: (best.m + best.n) % 2 === 0 ? 1 : -1 };
}
function evalChladniSquare(x, y, m, n, a = 1, b = 1) {
  const pi = Math.PI;
  return a * Math.cos(n * pi * x) * Math.cos(m * pi * y) - b * Math.cos(m * pi * x) * Math.cos(n * pi * y);
}
function evalChladniCircular(r, theta, m, n) {
  const pi = Math.PI;
  const radial = Math.cos(n * pi * r);
  const azimuthal = Math.cos(m * theta);
  const overtone = 0.22 * Math.sin((m + n) * pi * r);
  return radial * azimuthal - overtone;
}
function evalChladni3D(x, y, z, l, m, n) {
  const pi = Math.PI;
  return Math.cos(l * pi * x) * Math.cos(m * pi * y) * Math.cos(n * pi * z) - Math.cos(m * pi * x) * Math.cos(n * pi * y) * Math.cos(l * pi * z);
}
function renderChladniPlate(ctx, width, height, plateType, m, n, a = 1, b = 1, coherence = 1, chaosIntensity = 1, timeOffset = 0) {
  ctx.clearRect(0, 0, width, height);
  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.44;
  const sigma = 0.08 + (1 - coherence) * 0.22;
  const noiseScale = (1 - coherence) * chaosIntensity * 0.45;
  const isCirc = plateType === "circular";
  const step = 2;
  for (let py = 0; py < height; py += step) {
    const ny = (py - cy) / radius;
    for (let px = 0; px < width; px += step) {
      const nx = (px - cx) / radius;
      const r = Math.sqrt(nx * nx + ny * ny);
      if (isCirc) {
        if (r > 1.02) continue;
      } else {
        if (Math.abs(nx) > 1.02 || Math.abs(ny) > 1.02) continue;
      }
      let perturb = 0;
      if (noiseScale > 1e-3) {
        perturb = noiseScale * (Math.sin(nx * 14 + ny * 12 + timeOffset * 3.5) * 0.5 + Math.cos(nx * 22 - ny * 18 + timeOffset * 2.8) * 0.5);
      }
      let psi = 0;
      if (isCirc) {
        const theta = Math.atan2(ny, nx);
        psi = evalChladniCircular(r, theta, Math.round(m), Math.round(n)) + perturb;
      } else {
        psi = evalChladniSquare(nx, ny, m, n, a, b) + perturb;
      }
      const absPsi = Math.abs(psi);
      const density = Math.exp(-(absPsi * absPsi) / (2 * sigma * sigma));
      if (density > 0.04) {
        const val = Math.min(255, Math.floor(density * 255));
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
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + coherence * 0.35})`;
  ctx.lineWidth = 2;
  if (isCirc) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}
function sampleVolumetric3DNodalPoints(particleCount, l, m, n, coherence = 1, chaosIntensity = 1, radius = 240) {
  const points = [];
  const sigma = 0.09 + (1 - coherence) * 0.25;
  const chaosAmp = (1 - coherence) * chaosIntensity * 0.35;
  let attempts = 0;
  const maxAttempts = particleCount * 25;
  while (points.length < particleCount && attempts < maxAttempts) {
    attempts++;
    const u = Math.random();
    const costheta = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.cbrt(u);
    const sintheta = Math.sqrt(1 - costheta * costheta);
    const nx = r * sintheta * Math.cos(phi);
    const ny = r * sintheta * Math.sin(phi);
    const nz = r * costheta;
    let perturb = 0;
    if (chaosAmp > 1e-3) {
      perturb = (Math.random() - 0.5) * chaosAmp;
    }
    const psi = evalChladni3D(nx, ny, nz, l, m, n) + perturb;
    const absPsi = Math.abs(psi);
    const prob = Math.exp(-(absPsi * absPsi) / (2 * sigma * sigma));
    if (Math.random() < prob) {
      points.push({
        x: nx * radius,
        y: ny * radius,
        z: nz * radius,
        density: Math.min(1, prob * 1.2)
      });
    }
  }
  while (points.length < particleCount) {
    const ang1 = Math.random() * Math.PI * 2;
    const ang2 = (Math.random() - 0.5) * Math.PI;
    const rad = radius * (0.35 + Math.random() * 0.65);
    points.push({
      x: Math.cos(ang1) * Math.cos(ang2) * rad,
      y: Math.sin(ang2) * rad,
      z: Math.sin(ang1) * Math.cos(ang2) * rad,
      density: 0.7
    });
  }
  return points;
}
import { CHAKRA_CYMATIC_PROFILES } from "./legacy/chakraCymaticProfiles.mjs";
export {
  CHAKRA_CYMATIC_PROFILES,
  deriveCymaticTemplateModes,
  evalChladni3D,
  evalChladniCircular,
  evalChladniSquare,
  renderChladniPlate,
  sampleVolumetric3DNodalPoints
};
