/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CHAKRA_DEFINITIONS } from "./semantics/chakraSemantics.mjs";
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
const CANONICAL_CHAKRAS = [...CHAKRA_DEFINITIONS].reverse().map((definition) => {
  const scaleById = { sahasrara: 0.16, ajna: 0.14, vishuddha: 0.14, anahata: 0.15, manipura: 0.14, svadhisthana: 0.14, muladhara: 0.15 };
  const strengthById = { sahasrara: 2.2, ajna: 2, vishuddha: 1.8, anahata: 2.4, manipura: 1.9, svadhisthana: 1.8, muladhara: 2.2 };
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
    scale: scaleById[definition.id] ?? 0.14,
    color: definition.canonicalColor,
    attractorStrength: strengthById[definition.id] ?? 2,
    active: true
  };
});
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
