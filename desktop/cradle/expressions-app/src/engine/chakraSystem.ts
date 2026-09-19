/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpatialChakraNode, SpatialChakraConfig } from './types';
import { CHAKRA_DEFINITIONS } from './semantics/chakraSemantics';

export interface ChakraGlyphItem {
  id: string;
  char: string;
  sanskrit: string;
  name: string;
  chakra: string;
  category: 'bija' | 'yantra' | 'sacred';
  color: string;
  description: string;
}

/**
 * Curated Sacred Chakra & Geometry Glyphs for single or chained glyph selection
 */
export const CHAKRA_GLYPH_PRESETS: ChakraGlyphItem[] = [
  {
    id: 'bija_om_crown',
    char: 'ॐ',
    sanskrit: 'ॐ',
    name: 'AUM / OM (Pranava)',
    chakra: 'Crown & Third Eye',
    category: 'bija',
    color: '#e066ff',
    description: 'Primordial cosmic vibration, sound of transcendental awareness',
  },
  {
    id: 'bija_ham_throat',
    char: 'हं',
    sanskrit: 'हं',
    name: 'HAM (Vishuddha)',
    chakra: 'Throat',
    category: 'bija',
    color: '#00f5ff',
    description: 'Etheric purification seed syllable of truthful resonant expression',
  },
  {
    id: 'bija_yam_heart',
    char: 'यं',
    sanskrit: 'यं',
    name: 'YAM (Anahata)',
    chakra: 'Heart',
    category: 'bija',
    color: '#00ff88',
    description: 'Air element seed syllable of unbounded unconditional compassion',
  },
  {
    id: 'bija_ram_solar',
    char: 'रं',
    sanskrit: 'रं',
    name: 'RAM (Manipura)',
    chakra: 'Solar Plexus',
    category: 'bija',
    color: '#ffe600',
    description: 'Solar fire seed syllable of transformative kinetic vitality & will',
  },
  {
    id: 'bija_vam_sacral',
    char: 'वं',
    sanskrit: 'वं',
    name: 'VAM (Svadhisthana)',
    chakra: 'Sacral',
    category: 'bija',
    color: '#ff7700',
    description: 'Primal water seed syllable of fluid creativity & emotional grace',
  },
  {
    id: 'bija_lam_root',
    char: 'लं',
    sanskrit: 'लं',
    name: 'LAM (Muladhara)',
    chakra: 'Root',
    category: 'bija',
    color: '#ff1744',
    description: 'Earth foundation seed syllable of steadfast grounding & presence',
  },
  {
    id: 'yantra_dharmachakra',
    char: '☸',
    sanskrit: 'सहस्रार',
    name: 'Dharmachakra (Wheel of Light)',
    chakra: 'Crown',
    category: 'yantra',
    color: '#e066ff',
    description: 'Radiant wheel of cosmic order and infinite petal radiance',
  },
  {
    id: 'yantra_third_eye',
    char: '👁',
    sanskrit: 'ज्ञान',
    name: 'Ajna Winged Eye',
    chakra: 'Third Eye',
    category: 'yantra',
    color: '#4d88ff',
    description: 'Intuitive inner gaze penetrating illusion into pure gnosis',
  },
  {
    id: 'yantra_bindu_circle',
    char: '◯',
    sanskrit: 'बिन्दु',
    name: 'Etheric Bindu (Circle)',
    chakra: 'Throat',
    category: 'yantra',
    color: '#00f5ff',
    description: 'Undivided point of origin and etheric acoustic space',
  },
  {
    id: 'yantra_shatkona_star',
    char: '✡',
    sanskrit: 'षट्कोण',
    name: 'Shatkona (Hexagram)',
    chakra: 'Heart',
    category: 'yantra',
    color: '#00ff88',
    description: 'Union of Shiva (upward fire) and Shakti (downward water)',
  },
  {
    id: 'yantra_fire_triangle',
    char: '▽',
    sanskrit: 'त्रिकोण',
    name: 'Inverted Triangle (Tejas)',
    chakra: 'Solar Plexus',
    category: 'yantra',
    color: '#ffe600',
    description: 'Downward vessel of concentrated solar ignition and willpower',
  },
  {
    id: 'yantra_crescent_moon',
    char: '☽',
    sanskrit: 'चन्द्र',
    name: 'Crescent Moon (Chandra)',
    chakra: 'Sacral',
    category: 'yantra',
    color: '#ff7700',
    description: 'Lunar tides governing subconscious flow and sensual alchemy',
  },
  {
    id: 'yantra_lotus_padma',
    char: '🪷',
    sanskrit: 'पद्म',
    name: 'Lotus Padma (Earth Square)',
    chakra: 'Root',
    category: 'yantra',
    color: '#ff1744',
    description: 'Sacred blossom anchored in clay blossoming into celestial light',
  },
  {
    id: 'sacred_sahasrara_sun',
    char: '✺',
    sanskrit: 'सहस्रदल',
    name: '1000-Petal Radiance',
    chakra: 'Crown',
    category: 'sacred',
    color: '#f0a0ff',
    description: 'Full solar aperture of illumination and boundless oneness',
  },
];

/**
 * The 7 Canonical Chakras arranged along the subtle human energetic spine
 * Coordinates: y < 0 is upward toward the head/crown, y > 0 is downward toward root
 */
export const CANONICAL_CHAKRAS: SpatialChakraNode[] = [...CHAKRA_DEFINITIONS]
  .reverse() // legacy order remains Crown -> Root for snapshot/preset compatibility
  .map((definition) => {
    const scaleById: Record<string, number> = {sahasrara:.16,ajna:.14,vishuddha:.14,anahata:.15,manipura:.14,svadhisthana:.14,muladhara:.15};
    const strengthById: Record<string, number> = {sahasrara:2.2,ajna:2.0,vishuddha:1.8,anahata:2.4,manipura:1.9,svadhisthana:1.8,muladhara:2.2};
    return {
      id: definition.id,
      name: definition.name,
      sanskrit: definition.sanskrit,
      seedSyllable: definition.seedSyllable,
      symbol: definition.symbol,
      englishTitle: definition.englishTitle,
      // Historical correspondence only. The real resonator does not consume this value.
      frequencyHz: definition.historicalCorrespondences?.solfeggioHz,
      element: definition.element,
      x: 0,
      y: 270 - definition.order * 90,
      scale: scaleById[definition.id] ?? .14,
      color: definition.canonicalColor,
      attractorStrength: strengthById[definition.id] ?? 2,
      active: true,
    };
  });

/**
 * Creates a complete default Spatial Chakra Configuration
 */
export function createDefaultSpatialChakraConfig(): SpatialChakraConfig {
  return {
    enabled: false,
    geometryMode: 'yantra',
    cymatics: {
      plateGeometry: 'square',
      dimension: '2D',
      frequencyHz: 396,
      autoSweep: false,
      sweepSpeed: 8.0,
      chaosIntensity: 1.4,
      nodalAttraction: 2.8,
      dampingQFactor: 4.5,
      engine: 'resonator',
      baseFrequency: 40,
      driveStrength: 1.0,
      transportGain: 1.0,
      agitation: 0.3,
      plateSize: 700,
      modeCount: 64,
      boundaryStrength: 6.0,
      driveScale: 1.0,
      sweep: {
        enabled: false,
        glideS: 3.5,
        dwellS: 2.0,
        direction: 'ascent',
      },
    },
    playbackMode: 'simultaneousBody',
    glyphType: 'yantra',
    nodes: CANONICAL_CHAKRAS.map((c) => ({ ...c })),
    activeNodeIndex: 6, // Start at Root (bottom) for Kundalini ascent
    transitionDuration: 2.4,
    holdDuration: 1.2,
    autoCycle: true,
    cycleDirection: 'ascent',
    attractorInfluence: 1.5,
    particlePartitionSpread: 1.0,
    plane: 'horizontal',
    vortexStrength: 1.6,
  };
}

export const createDefaultChakraConfig = createDefaultSpatialChakraConfig;

/**
 * Spatial Layout Presets for subtle body positioning
 */
export const CHAKRA_SPATIAL_PRESETS = {
  spine_straight: alignToSpine(CANONICAL_CHAKRAS, 85, 0),
  compact_torso: alignToSpine(CANONICAL_CHAKRAS, 60, 0),
  kundalini_serpentine: CANONICAL_CHAKRAS.map((n, i) => ({
    ...n,
    x: Math.round(Math.sin((i / 6) * Math.PI * 2.5) * 110),
    y: Math.round(-255 + i * 85),
  })),
  heart_centered_expansion: CANONICAL_CHAKRAS.map((n, i) => {
    if (n.id === 'anahata') {
      return { ...n, x: 0, y: 0, scale: 0.24 };
    }
    const angle = ((i > 3 ? i - 1 : i) / 6) * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      x: Math.round(Math.cos(angle) * 220),
      y: Math.round(Math.sin(angle) * 220),
      scale: 0.18,
    };
  }),
};

/**
 * Alignment helpers for user layouts
 */
export function alignToSpine(nodes: SpatialChakraNode[], spacing: number = 90, centerX: number = 0): SpatialChakraNode[] {
  const count = nodes.length;
  const totalHeight = (count - 1) * spacing;
  const startY = -totalHeight / 2;

  return nodes.map((n, i) => ({
    ...n,
    x: centerX,
    y: Math.round(startY + i * spacing),
  }));
}

export function alignToHorizontal(nodes: SpatialChakraNode[], spacing: number = 90, centerY: number = 0): SpatialChakraNode[] {
  const count = nodes.length;
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;

  return nodes.map((n, i) => ({
    ...n,
    x: Math.round(startX + i * spacing),
    y: centerY,
  }));
}

export function alignToMandalaRing(
  nodes: SpatialChakraNode[],
  radius: number = 240,
  centerX: number = 0,
  centerY: number = 0
): SpatialChakraNode[] {
  const count = nodes.length;
  return nodes.map((n, i) => {
    // Start at top (-PI/2) and circle clockwise
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    return {
      ...n,
      x: Math.round(centerX + Math.cos(angle) * radius),
      y: Math.round(centerY + Math.sin(angle) * radius),
    };
  });
}
