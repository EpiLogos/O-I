/** Legacy chakra/template correspondences. Not consumed by the live resonator. */

export interface ChakraCymaticProfile {
  chakraId: string;
  chakraName: string;
  sanskrit: string;
  frequencyHz: number;
  squareM: number;
  squareN: number;
  squareA: number;
  squareB: number;
  circularM: number; // Azimuthal nodal lines / petal count
  circularN: number; // Radial concentric nodal rings
  volumetricL: number;
  volumetricM: number;
  volumetricN: number;
  symmetryTitle: string;
  description: string;
}

/** @deprecated Legacy authored-template correspondences. The live resonator does not consume these.
 * The 7 Canonical Chakra Resonant Harmonic Stability Points in Cymatics
 * Derived from Solfeggio acoustic frequencies and their matching geometric nodal symmetries:
 * - Root (Muladhara, 396Hz): 4-Fold Foundation Cross (4 Petals)
 * - Sacral (Svadhisthana, 417Hz): 6-Fold Fluid Hexagonal Ripple (6 Petals)
 * - Solar Plexus (Manipura, 528Hz): 10-Fold Radiant Solar Star (10 Petals)
 * - Heart (Anahata, 639Hz): 12-Fold Shatkona Hexagram Standing Wave (12 Petals)
 * - Throat (Vishuddha, 741Hz): 16-Fold Pure Acoustic Sanctum (16 Petals)
 * - Third Eye (Ajna, 852Hz): Bilateral Dual-Lobe Eye of Intuition (2 Petals)
 * - Crown (Sahasrara, 963Hz): Thousand-Petaled High-Frequency Rosette (Multi-Ring Lattice)
 */
export const CHAKRA_CYMATIC_PROFILES: ChakraCymaticProfile[] = [
  {
    chakraId: 'muladhara',
    chakraName: 'Muladhara (Root)',
    sanskrit: 'मूलाधार',
    frequencyHz: 396,
    squareM: 2,
    squareN: 2,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 2,
    circularN: 1,
    volumetricL: 2,
    volumetricM: 2,
    volumetricN: 1,
    symmetryTitle: '4-Fold Foundation Nodal Cross',
    description: 'Fundamental low-frequency standing wave forming a steadfast 4-petal quadrant nodal lattice.',
  },
  {
    chakraId: 'svadhisthana',
    chakraName: 'Svadhisthana (Sacral)',
    sanskrit: 'स्वाधिष्ठान',
    frequencyHz: 417,
    squareM: 2,
    squareN: 3,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 3,
    circularN: 1,
    volumetricL: 2,
    volumetricM: 3,
    volumetricN: 1,
    symmetryTitle: '6-Fold Fluid Hexagonal Ripple',
    description: 'Fluid undulating acoustic wave producing 6 crescent nodal sectors and rhythmic water ripples.',
  },
  {
    chakraId: 'manipura',
    chakraName: 'Manipura (Solar Plexus)',
    sanskrit: 'मणिपूर',
    frequencyHz: 528,
    squareM: 3,
    squareN: 5,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 5,
    circularN: 1,
    volumetricL: 3,
    volumetricM: 3,
    volumetricN: 2,
    symmetryTitle: '10-Fold Radiant Solar Star',
    description: 'Kinetic transformation frequency forming a 10-ray solar starburst and dense central focal diamond.',
  },
  {
    chakraId: 'anahata',
    chakraName: 'Anahata (Heart)',
    sanskrit: 'अनाहत',
    frequencyHz: 639,
    squareM: 4,
    squareN: 4,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 6,
    circularN: 2,
    volumetricL: 3,
    volumetricM: 3,
    volumetricN: 3,
    symmetryTitle: '12-Fold Shatkona Hexagram Standing Wave',
    description: 'Perfect harmonic balance: interlaced upward and downward standing wave triangles forming a 12-petaled hexagram.',
  },
  {
    chakraId: 'vishuddha',
    chakraName: 'Vishuddha (Throat)',
    sanskrit: 'विशुद्ध',
    frequencyHz: 741,
    squareM: 4,
    squareN: 6,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 8,
    circularN: 2,
    volumetricL: 4,
    volumetricM: 4,
    volumetricN: 2,
    symmetryTitle: '16-Fold Pure Acoustic Sanctum',
    description: 'Etheric purification mode with 16 acoustic petal nodal lobes around concentric resonance rings.',
  },
  {
    chakraId: 'ajna',
    chakraName: 'Ajna (Third Eye)',
    sanskrit: 'आज्ञा',
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
    symmetryTitle: 'Bilateral Dual-Lobe Eye of Gnosis',
    description: 'Bilateral standing wave geometry forming 2 wide lateral winged nodal lobes centered on an intense focal Bindu.',
  },
  {
    chakraId: 'sahasrara',
    chakraName: 'Sahasrara (Crown)',
    sanskrit: 'सहस्रार',
    frequencyHz: 963,
    squareM: 6,
    squareN: 8,
    squareA: 1.0,
    squareB: 1.0,
    circularM: 12,
    circularN: 3,
    volumetricL: 5,
    volumetricM: 5,
    volumetricN: 4,
    symmetryTitle: 'Thousand-Petaled Celestial Rosette',
    description: 'Ultra-high frequency multi-ring complex harmonic with kaleidoscopic fractal nodal intersections.',
  },
];

export interface HarmonicSpectrumState {
  frequencyHz: number;
  coherence: number; // 0.0 (maximum chaos) to 1.0 (crystallized lock)
  isLocked: boolean; // true if within resonance lock bandwidth
  lockStrength: number; // 0.0 to 1.0
  chaosTurbulence: number; // In-between turbulent agitation factor
  nearestProfile: ChakraCymaticProfile;
  detuneHz: number; // Signed distance in Hz to nearest harmonic
  statusLabel: 'Resonance Lock' | 'Harmonic Transition' | 'Chaotic In-Between';
  effectiveM: number;
  effectiveN: number;
  effectiveL: number;
  squareA: number;
  squareB: number;
}

/**
 * Evaluates continuous acoustic frequency against the harmonic spectrum
 * Calculates physical resonance lock coherence and in-between chaotic agitation.
 */
export function evalHarmonicSpectrum(
  frequencyHz: number,
  dampingQ: number = 4.5
): HarmonicSpectrumState {
  const f = Math.max(300, Math.min(1050, frequencyHz));

  // Find the two surrounding harmonic nodes
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

  // Gaussian resonance lock basin width determined by Q-factor
  // High Q = sharper resonance peaks; lower Q = broader lock basins
  const sigma = 55.0 / Math.max(1.0, dampingQ);
  const coherence = Math.exp(- (detune * detune) / (2.0 * sigma * sigma));
  const isLocked = coherence >= 0.70;
  const lockStrength = Math.max(0.0, Math.min(1.0, (coherence - 0.15) / 0.85));

  // Chaotic turbulence peaks in between harmonic stability points
  // When coherence is low, chaotic fluttering of grains is maximal
  const chaosTurbulence = Math.pow(1.0 - coherence, 1.4);

  let statusLabel: 'Resonance Lock' | 'Harmonic Transition' | 'Chaotic In-Between';
  if (isLocked) {
    statusLabel = 'Resonance Lock';
  } else if (coherence > 0.28) {
    statusLabel = 'Harmonic Transition';
  } else {
    statusLabel = 'Chaotic In-Between';
  }

  // Determine continuous fractional modal numbers (m, n, l) across the spectrum
  let effectiveM = nearest.squareM;
  let effectiveN = nearest.squareN;
  let effectiveL = nearest.volumetricL;
  let squareA = nearest.squareA;
  let squareB = nearest.squareB;

  // Smooth interpolation between adjacent modes when transitioning
  let nextIdx = nearestIdx;
  if (detune > 0 && nearestIdx < CHAKRA_CYMATIC_PROFILES.length - 1) {
    nextIdx = nearestIdx + 1;
  } else if (detune < 0 && nearestIdx > 0) {
    nextIdx = nearestIdx - 1;
  }

  if (nextIdx !== nearestIdx) {
    const other = CHAKRA_CYMATIC_PROFILES[nextIdx];
    const range = Math.abs(other.frequencyHz - nearest.frequencyHz);
    const alpha = Math.min(1.0, Math.max(0.0, Math.abs(detune) / Math.max(1, range)));
    // Non-linear easing: hold near stability point, rapidly traverse in-between chaos
    const t = alpha * alpha * (3.0 - 2.0 * alpha);

    effectiveM = nearest.squareM * (1.0 - t) + other.squareM * t;
    effectiveN = nearest.squareN * (1.0 - t) + other.squareN * t;
    effectiveL = nearest.volumetricL * (1.0 - t) + other.volumetricL * t;
    squareA = nearest.squareA * (1.0 - t) + other.squareA * t;
    squareB = nearest.squareB * (1.0 - t) + other.squareB * t;
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
    squareB,
  };
}
