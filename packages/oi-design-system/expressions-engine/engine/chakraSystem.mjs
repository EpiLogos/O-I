/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const CHAKRA_GLYPH_PRESETS = [
  {
    id: "bija_om_crown",
    char: "\u0950",
    sanskrit: "\u0950",
    name: "AUM / OM (Pranava)",
    chakra: "Crown & Third Eye",
    category: "bija",
    color: "#e066ff",
    description: "Primordial cosmic vibration, sound of transcendental awareness"
  },
  {
    id: "bija_ham_throat",
    char: "\u0939\u0902",
    sanskrit: "\u0939\u0902",
    name: "HAM (Vishuddha)",
    chakra: "Throat",
    category: "bija",
    color: "#00f5ff",
    description: "Etheric purification seed syllable of truthful resonant expression"
  },
  {
    id: "bija_yam_heart",
    char: "\u092F\u0902",
    sanskrit: "\u092F\u0902",
    name: "YAM (Anahata)",
    chakra: "Heart",
    category: "bija",
    color: "#00ff88",
    description: "Air element seed syllable of unbounded unconditional compassion"
  },
  {
    id: "bija_ram_solar",
    char: "\u0930\u0902",
    sanskrit: "\u0930\u0902",
    name: "RAM (Manipura)",
    chakra: "Solar Plexus",
    category: "bija",
    color: "#ffe600",
    description: "Solar fire seed syllable of transformative kinetic vitality & will"
  },
  {
    id: "bija_vam_sacral",
    char: "\u0935\u0902",
    sanskrit: "\u0935\u0902",
    name: "VAM (Svadhisthana)",
    chakra: "Sacral",
    category: "bija",
    color: "#ff7700",
    description: "Primal water seed syllable of fluid creativity & emotional grace"
  },
  {
    id: "bija_lam_root",
    char: "\u0932\u0902",
    sanskrit: "\u0932\u0902",
    name: "LAM (Muladhara)",
    chakra: "Root",
    category: "bija",
    color: "#ff1744",
    description: "Earth foundation seed syllable of steadfast grounding & presence"
  },
  {
    id: "yantra_dharmachakra",
    char: "\u2638",
    sanskrit: "\u0938\u0939\u0938\u094D\u0930\u093E\u0930",
    name: "Dharmachakra (Wheel of Light)",
    chakra: "Crown",
    category: "yantra",
    color: "#e066ff",
    description: "Radiant wheel of cosmic order and infinite petal radiance"
  },
  {
    id: "yantra_third_eye",
    char: "\u{1F441}",
    sanskrit: "\u091C\u094D\u091E\u093E\u0928",
    name: "Ajna Winged Eye",
    chakra: "Third Eye",
    category: "yantra",
    color: "#4d88ff",
    description: "Intuitive inner gaze penetrating illusion into pure gnosis"
  },
  {
    id: "yantra_bindu_circle",
    char: "\u25EF",
    sanskrit: "\u092C\u093F\u0928\u094D\u0926\u0941",
    name: "Etheric Bindu (Circle)",
    chakra: "Throat",
    category: "yantra",
    color: "#00f5ff",
    description: "Undivided point of origin and etheric acoustic space"
  },
  {
    id: "yantra_shatkona_star",
    char: "\u2721",
    sanskrit: "\u0937\u091F\u094D\u0915\u094B\u0923",
    name: "Shatkona (Hexagram)",
    chakra: "Heart",
    category: "yantra",
    color: "#00ff88",
    description: "Union of Shiva (upward fire) and Shakti (downward water)"
  },
  {
    id: "yantra_fire_triangle",
    char: "\u25BD",
    sanskrit: "\u0924\u094D\u0930\u093F\u0915\u094B\u0923",
    name: "Inverted Triangle (Tejas)",
    chakra: "Solar Plexus",
    category: "yantra",
    color: "#ffe600",
    description: "Downward vessel of concentrated solar ignition and willpower"
  },
  {
    id: "yantra_crescent_moon",
    char: "\u263D",
    sanskrit: "\u091A\u0928\u094D\u0926\u094D\u0930",
    name: "Crescent Moon (Chandra)",
    chakra: "Sacral",
    category: "yantra",
    color: "#ff7700",
    description: "Lunar tides governing subconscious flow and sensual alchemy"
  },
  {
    id: "yantra_lotus_padma",
    char: "\u{1FAB7}",
    sanskrit: "\u092A\u0926\u094D\u092E",
    name: "Lotus Padma (Earth Square)",
    chakra: "Root",
    category: "yantra",
    color: "#ff1744",
    description: "Sacred blossom anchored in clay blossoming into celestial light"
  },
  {
    id: "sacred_sahasrara_sun",
    char: "\u273A",
    sanskrit: "\u0938\u0939\u0938\u094D\u0930\u0926\u0932",
    name: "1000-Petal Radiance",
    chakra: "Crown",
    category: "sacred",
    color: "#f0a0ff",
    description: "Full solar aperture of illumination and boundless oneness"
  }
];
const CANONICAL_CHAKRAS = [
  {
    id: "sahasrara",
    name: "Sahasrara (Crown)",
    sanskrit: "\u0938\u0939\u0938\u094D\u0930\u093E\u0930",
    seedSyllable: "\u0950",
    symbol: "\u2638",
    englishTitle: "Crown / Pure Consciousness",
    frequencyHz: 963,
    element: "Cosmic Spirit (Akasha)",
    x: 0,
    y: -270,
    scale: 0.16,
    color: "#ff77ff",
    // Brilliant Luminous Radiant Neon Violet
    attractorStrength: 2.2,
    active: true
  },
  {
    id: "ajna",
    name: "Ajna (Third Eye)",
    sanskrit: "\u0906\u091C\u094D\u091E\u093E",
    seedSyllable: "\u0950",
    symbol: "\u{1F441}",
    englishTitle: "Third Eye / Intuition",
    frequencyHz: 852,
    element: "Light (Prakasha)",
    x: 0,
    y: -180,
    scale: 0.14,
    color: "#66a3ff",
    // Radiant Vivid Electric Cyan-Indigo Blue
    attractorStrength: 2,
    active: true
  },
  {
    id: "vishuddha",
    name: "Vishuddha (Throat)",
    sanskrit: "\u0935\u093F\u0936\u0941\u0926\u094D\u0927",
    seedSyllable: "\u0939\u0902",
    symbol: "\u25EF",
    englishTitle: "Throat / Expression",
    frequencyHz: 741,
    element: "Ether / Sound (Akasha)",
    x: 0,
    y: -90,
    scale: 0.14,
    color: "#00ffff",
    // Pure Glowing Electric Neon Cyan
    attractorStrength: 1.8,
    active: true
  },
  {
    id: "anahata",
    name: "Anahata (Heart)",
    sanskrit: "\u0905\u0928\u093E\u0939\u0924",
    seedSyllable: "\u092F\u0902",
    symbol: "\u2721",
    englishTitle: "Heart / Compassion",
    frequencyHz: 639,
    element: "Air (Vayu)",
    x: 0,
    y: 0,
    scale: 0.15,
    color: "#00ff99",
    // Luminous Vivid Emerald Spring Green
    attractorStrength: 2.4,
    active: true
  },
  {
    id: "manipura",
    name: "Manipura (Solar Plexus)",
    sanskrit: "\u092E\u0923\u093F\u092A\u0942\u0930",
    seedSyllable: "\u0930\u0902",
    symbol: "\u25BD",
    englishTitle: "Solar Plexus / Willpower",
    frequencyHz: 528,
    element: "Fire (Tejas)",
    x: 0,
    y: 90,
    scale: 0.14,
    color: "#ffff00",
    // Pure Dazzling Solar Laser Gold Yellow
    attractorStrength: 1.9,
    active: true
  },
  {
    id: "svadhisthana",
    name: "Svadhisthana (Sacral)",
    sanskrit: "\u0938\u094D\u0935\u093E\u0927\u093F\u0937\u094D\u0920\u093E\u0928",
    seedSyllable: "\u0935\u0902",
    symbol: "\u263D",
    englishTitle: "Sacral / Fluid Creativity",
    frequencyHz: 417,
    element: "Water (Apas)",
    x: 0,
    y: 180,
    scale: 0.14,
    color: "#ff8800",
    // Intense Radiant Sunset Flame Orange
    attractorStrength: 1.8,
    active: true
  },
  {
    id: "muladhara",
    name: "Muladhara (Root)",
    sanskrit: "\u092E\u0942\u0932\u093E\u0927\u093E\u0930",
    seedSyllable: "\u0932\u0902",
    symbol: "\u{1FAB7}",
    englishTitle: "Root / Grounded Foundation",
    frequencyHz: 396,
    element: "Earth (Prithvi)",
    x: 0,
    y: 270,
    scale: 0.15,
    color: "#ff2255",
    // Blazing Vivid Laser Ruby Crimson
    attractorStrength: 2.2,
    active: true
  }
];
function createDefaultSpatialChakraConfig() {
  return {
    enabled: false,
    geometryMode: "yantra",
    cymatics: {
      plateGeometry: "square",
      dimension: "2D",
      frequencyHz: 396,
      autoSweep: false,
      sweepSpeed: 8,
      chaosIntensity: 1.4,
      nodalAttraction: 2.8,
      dampingQFactor: 4.5,
      engine: "resonator",
      baseFrequency: 40,
      driveStrength: 1,
      transportGain: 1,
      agitation: 0.3,
      plateSize: 700,
      modeCount: 64,
      boundaryStrength: 6,
      driveScale: 1,
      sweep: {
        enabled: false,
        glideS: 3.5,
        dwellS: 2,
        direction: "ascent"
      }
    },
    playbackMode: "simultaneousBody",
    glyphType: "yantra",
    nodes: CANONICAL_CHAKRAS.map((c) => ({ ...c })),
    activeNodeIndex: 6,
    // Start at Root (bottom) for Kundalini ascent
    transitionDuration: 2.4,
    holdDuration: 1.2,
    autoCycle: true,
    cycleDirection: "ascent",
    attractorInfluence: 1.5,
    particlePartitionSpread: 1,
    plane: "horizontal",
    vortexStrength: 1.6
  };
}
const createDefaultChakraConfig = createDefaultSpatialChakraConfig;
const CHAKRA_SPATIAL_PRESETS = {
  spine_straight: alignToSpine(CANONICAL_CHAKRAS, 85, 0),
  compact_torso: alignToSpine(CANONICAL_CHAKRAS, 60, 0),
  kundalini_serpentine: CANONICAL_CHAKRAS.map((n, i) => ({
    ...n,
    x: Math.round(Math.sin(i / 6 * Math.PI * 2.5) * 110),
    y: Math.round(-255 + i * 85)
  })),
  heart_centered_expansion: CANONICAL_CHAKRAS.map((n, i) => {
    if (n.id === "anahata") {
      return { ...n, x: 0, y: 0, scale: 0.24 };
    }
    const angle = (i > 3 ? i - 1 : i) / 6 * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      x: Math.round(Math.cos(angle) * 220),
      y: Math.round(Math.sin(angle) * 220),
      scale: 0.18
    };
  })
};
function alignToSpine(nodes, spacing = 90, centerX = 0) {
  const count = nodes.length;
  const totalHeight = (count - 1) * spacing;
  const startY = -totalHeight / 2;
  return nodes.map((n, i) => ({
    ...n,
    x: centerX,
    y: Math.round(startY + i * spacing)
  }));
}
function alignToHorizontal(nodes, spacing = 90, centerY = 0) {
  const count = nodes.length;
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;
  return nodes.map((n, i) => ({
    ...n,
    x: Math.round(startX + i * spacing),
    y: centerY
  }));
}
function alignToMandalaRing(nodes, radius = 240, centerX = 0, centerY = 0) {
  const count = nodes.length;
  return nodes.map((n, i) => {
    const angle = -Math.PI / 2 + i / count * Math.PI * 2;
    return {
      ...n,
      x: Math.round(centerX + Math.cos(angle) * radius),
      y: Math.round(centerY + Math.sin(angle) * radius)
    };
  });
}
export {
  CANONICAL_CHAKRAS,
  CHAKRA_GLYPH_PRESETS,
  CHAKRA_SPATIAL_PRESETS,
  alignToHorizontal,
  alignToMandalaRing,
  alignToSpine,
  createDefaultChakraConfig,
  createDefaultSpatialChakraConfig
};
