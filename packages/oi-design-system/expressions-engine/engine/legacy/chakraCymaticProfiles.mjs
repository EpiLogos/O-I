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
export {
  CHAKRA_CYMATIC_PROFILES,
  evalHarmonicSpectrum
};
