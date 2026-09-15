/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const CHAKRA_CYMATIC_PROFILES = [
  {
    chakraId: "muladhara",
    chakraName: "Muladhara (Root)",
    sanskrit: "\u092E\u0942\u0932\u093E\u0927\u093E\u0930",
    frequencyHz: 396,
    squareM: 2,
    squareN: 2,
    squareA: 1,
    squareB: 1,
    circularM: 2,
    circularN: 1,
    volumetricL: 2,
    volumetricM: 2,
    volumetricN: 1,
    symmetryTitle: "4-Fold Foundation Nodal Cross",
    description: "Fundamental low-frequency standing wave forming a steadfast 4-petal quadrant nodal lattice."
  },
  {
    chakraId: "svadhisthana",
    chakraName: "Svadhisthana (Sacral)",
    sanskrit: "\u0938\u094D\u0935\u093E\u0927\u093F\u0937\u094D\u0920\u093E\u0928",
    frequencyHz: 417,
    squareM: 2,
    squareN: 3,
    squareA: 1,
    squareB: 1,
    circularM: 3,
    circularN: 1,
    volumetricL: 2,
    volumetricM: 3,
    volumetricN: 1,
    symmetryTitle: "6-Fold Fluid Hexagonal Ripple",
    description: "Fluid undulating acoustic wave producing 6 crescent nodal sectors and rhythmic water ripples."
  },
  {
    chakraId: "manipura",
    chakraName: "Manipura (Solar Plexus)",
    sanskrit: "\u092E\u0923\u093F\u092A\u0942\u0930",
    frequencyHz: 528,
    squareM: 3,
    squareN: 5,
    squareA: 1,
    squareB: 1,
    circularM: 5,
    circularN: 1,
    volumetricL: 3,
    volumetricM: 3,
    volumetricN: 2,
    symmetryTitle: "10-Fold Radiant Solar Star",
    description: "Kinetic transformation frequency forming a 10-ray solar starburst and dense central focal diamond."
  },
  {
    chakraId: "anahata",
    chakraName: "Anahata (Heart)",
    sanskrit: "\u0905\u0928\u093E\u0939\u0924",
    frequencyHz: 639,
    squareM: 4,
    squareN: 4,
    squareA: 1,
    squareB: 1,
    circularM: 6,
    circularN: 2,
    volumetricL: 3,
    volumetricM: 3,
    volumetricN: 3,
    symmetryTitle: "12-Fold Shatkona Hexagram Standing Wave",
    description: "Perfect harmonic balance: interlaced upward and downward standing wave triangles forming a 12-petaled hexagram."
  },
  {
    chakraId: "vishuddha",
    chakraName: "Vishuddha (Throat)",
    sanskrit: "\u0935\u093F\u0936\u0941\u0926\u094D\u0927",
    frequencyHz: 741,
    squareM: 4,
    squareN: 6,
    squareA: 1,
    squareB: 1,
    circularM: 8,
    circularN: 2,
    volumetricL: 4,
    volumetricM: 4,
    volumetricN: 2,
    symmetryTitle: "16-Fold Pure Acoustic Sanctum",
    description: "Etheric purification mode with 16 acoustic petal nodal lobes around concentric resonance rings."
  },
  {
    chakraId: "ajna",
    chakraName: "Ajna (Third Eye)",
    sanskrit: "\u0906\u091C\u094D\u091E\u093E",
    frequencyHz: 852,
    squareM: 1,
    squareN: 5,
    squareA: 1.25,
    squareB: 0.75,
    circularM: 1,
    circularN: 3,
    volumetricL: 2,
    volumetricM: 1,
    volumetricN: 4,
    symmetryTitle: "Bilateral Dual-Lobe Eye of Gnosis",
    description: "Bilateral standing wave geometry forming 2 wide lateral winged nodal lobes centered on an intense focal Bindu."
  },
  {
    chakraId: "sahasrara",
    chakraName: "Sahasrara (Crown)",
    sanskrit: "\u0938\u0939\u0938\u094D\u0930\u093E\u0930",
    frequencyHz: 963,
    squareM: 6,
    squareN: 8,
    squareA: 1,
    squareB: 1,
    circularM: 12,
    circularN: 3,
    volumetricL: 5,
    volumetricM: 5,
    volumetricN: 4,
    symmetryTitle: "Thousand-Petaled Celestial Rosette",
    description: "Ultra-high frequency multi-ring complex harmonic with kaleidoscopic fractal nodal intersections."
  }
];
function evalHarmonicSpectrum(frequencyHz, dampingQ = 4.5) {
  const f = Math.max(300, Math.min(1050, frequencyHz));
  let bestDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < CHAKRA_CYMATIC_PROFILES.length; i++) {
    const dist = Math.abs(f - CHAKRA_CYMATIC_PROFILES[i].frequencyHz);
    if (dist < bestDist) {
      bestDist = dist;
      nearestIdx = i;
    }
  }
  const nearest = CHAKRA_CYMATIC_PROFILES[nearestIdx];
  const detune = f - nearest.frequencyHz;
  const sigma = 55 / Math.max(1, dampingQ);
  const coherence = Math.exp(-(detune * detune) / (2 * sigma * sigma));
  const isLocked = coherence >= 0.7;
  const lockStrength = Math.max(0, Math.min(1, (coherence - 0.15) / 0.85));
  const chaosTurbulence = Math.pow(1 - coherence, 1.4);
  let statusLabel;
  if (isLocked) {
    statusLabel = "Resonance Lock";
  } else if (coherence > 0.28) {
    statusLabel = "Harmonic Transition";
  } else {
    statusLabel = "Chaotic In-Between";
  }
  let effectiveM = nearest.squareM;
  let effectiveN = nearest.squareN;
  let effectiveL = nearest.volumetricL;
  let squareA = nearest.squareA;
  let squareB = nearest.squareB;
  let nextIdx = nearestIdx;
  if (detune > 0 && nearestIdx < CHAKRA_CYMATIC_PROFILES.length - 1) {
    nextIdx = nearestIdx + 1;
  } else if (detune < 0 && nearestIdx > 0) {
    nextIdx = nearestIdx - 1;
  }
  if (nextIdx !== nearestIdx) {
    const other = CHAKRA_CYMATIC_PROFILES[nextIdx];
    const range = Math.abs(other.frequencyHz - nearest.frequencyHz);
    const alpha = Math.min(1, Math.max(0, Math.abs(detune) / Math.max(1, range)));
    const t = alpha * alpha * (3 - 2 * alpha);
    effectiveM = nearest.squareM * (1 - t) + other.squareM * t;
    effectiveN = nearest.squareN * (1 - t) + other.squareN * t;
    effectiveL = nearest.volumetricL * (1 - t) + other.volumetricL * t;
    squareA = nearest.squareA * (1 - t) + other.squareA * t;
    squareB = nearest.squareB * (1 - t) + other.squareB * t;
  }
  return {
    frequencyHz: f,
    coherence,
    isLocked,
    lockStrength,
    chaosTurbulence,
    nearestProfile: nearest,
    detuneHz: detune,
    statusLabel,
    effectiveM,
    effectiveN,
    effectiveL,
    squareA,
    squareB
  };
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
export {
  CHAKRA_CYMATIC_PROFILES,
  evalChladni3D,
  evalChladniCircular,
  evalChladniSquare,
  evalHarmonicSpectrum,
  renderChladniPlate,
  sampleVolumetric3DNodalPoints
};
