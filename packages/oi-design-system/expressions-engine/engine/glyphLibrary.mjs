/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const GLYPH_CATEGORIES = [
  {
    id: "polygons",
    name: "Polygons & Sacred Geometry",
    description: "Geometric primitives from 3-sided delta polygons to 8-gons and sacred polyhedra",
    items: [
      { char: "\u25B2", name: "Trigon / Triangle", category: "polygons" },
      { char: "\u25BC", name: "Inverted Delta", category: "polygons" },
      { char: "\u25B3", name: "Open Delta", category: "polygons" },
      { char: "\u25A0", name: "Tetragon / Square", category: "polygons" },
      { char: "\u25C6", name: "Rhombus / Diamond", category: "polygons" },
      { char: "\u25C8", name: "Nested Diamond", category: "polygons" },
      { char: "\u2B1F", name: "Pentagon / 5-Gon", category: "polygons" },
      { char: "\u2B20", name: "Hollow Pentagon", category: "polygons" },
      { char: "\u26E4", name: "Pentagram Sigil", category: "polygons" },
      { char: "\u2B22", name: "Hexagon / 6-Gon", category: "polygons" },
      { char: "\u2B21", name: "Hollow Hexagon", category: "polygons" },
      { char: "\u2721", name: "Hexagram / Star", category: "polygons" },
      { char: "\u2BCE", name: "Octagon / 8-Gon", category: "polygons" },
      { char: "\u2735", name: "8-Pointed Star", category: "polygons" },
      { char: "\u25C9", name: "Concentric Monad", category: "polygons" },
      { char: "\u25CE", name: "Bullseye Ring", category: "polygons" },
      { char: "\u25EF", name: "Perfect Circle", category: "polygons" },
      { char: "\u238A", name: "Merkaba Polyhedron", category: "polygons" },
      { char: "\u23E3", name: "Benzene Hex Grid", category: "polygons" },
      { char: "\u2BD0", name: "Star Octahedron", category: "polygons" },
      { char: "\u232C", name: "Fused Hex Core", category: "polygons" },
      { char: "\u229B", name: "Circled Asterisk", category: "polygons" },
      { char: "\u2295", name: "Sun Cross / Quadrant", category: "polygons" },
      { char: "\u2297", name: "Tensor Matrix", category: "polygons" }
    ]
  },
  {
    id: "zodiac",
    name: "Zodiac & Astrological Signs",
    description: "The complete classical 12 ecliptic zodiac constellations plus Ophiuchus",
    items: [
      { char: "\u2648", name: "Aries (Ram)", category: "zodiac" },
      { char: "\u2649", name: "Taurus (Bull)", category: "zodiac" },
      { char: "\u264A", name: "Gemini (Twins)", category: "zodiac" },
      { char: "\u264B", name: "Cancer (Crab)", category: "zodiac" },
      { char: "\u264C", name: "Leo (Lion)", category: "zodiac" },
      { char: "\u264D", name: "Virgo (Maiden)", category: "zodiac" },
      { char: "\u264E", name: "Libra (Scales)", category: "zodiac" },
      { char: "\u264F", name: "Scorpio (Scorpion)", category: "zodiac" },
      { char: "\u2650", name: "Sagittarius (Archer)", category: "zodiac" },
      { char: "\u2651", name: "Capricorn (Sea Goat)", category: "zodiac" },
      { char: "\u2652", name: "Aquarius (Water Bearer)", category: "zodiac" },
      { char: "\u2653", name: "Pisces (Fishes)", category: "zodiac" },
      { char: "\u26CE", name: "Ophiuchus (Serpent)", category: "zodiac" }
    ]
  },
  {
    id: "planetary",
    name: "Planetary & Celestial",
    description: "Astronomical planet glyphs, lunar phases, and stellar luminaries",
    items: [
      { char: "\u2609", name: "Sol / Sun", category: "planetary" },
      { char: "\u263D", name: "Waxing Crescent", category: "planetary" },
      { char: "\u263E", name: "Waning Crescent", category: "planetary" },
      { char: "\u263F", name: "Mercury", category: "planetary" },
      { char: "\u2640", name: "Venus", category: "planetary" },
      { char: "\u2641", name: "Terra / Earth", category: "planetary" },
      { char: "\u2642", name: "Mars", category: "planetary" },
      { char: "\u2643", name: "Jupiter", category: "planetary" },
      { char: "\u2644", name: "Saturn", category: "planetary" },
      { char: "\u2645", name: "Uranus", category: "planetary" },
      { char: "\u2646", name: "Neptune", category: "planetary" },
      { char: "\u2647", name: "Pluto", category: "planetary" },
      { char: "\u2726", name: "Four-Point Flare", category: "planetary" },
      { char: "\u2727", name: "Sparkle Luminary", category: "planetary" },
      { char: "\u2605", name: "Five-Point Star", category: "planetary" },
      { char: "\u2742", name: "Radiant Solar Disc", category: "planetary" }
    ]
  },
  {
    id: "alchemical",
    name: "Alchemical Elements",
    description: "Classical alchemical principles, element triangles, and hermetic symbols",
    items: [
      { char: "\u{1F702}", name: "Ignis (Fire)", category: "alchemical" },
      { char: "\u{1F704}", name: "Aqua (Water)", category: "alchemical" },
      { char: "\u{1F701}", name: "Aer (Air)", category: "alchemical" },
      { char: "\u{1F703}", name: "Terra (Earth)", category: "alchemical" },
      { char: "\u{1F700}", name: "Quintessence / Aether", category: "alchemical" },
      { char: "\u{1F70D}", name: "Sulphur (Soul)", category: "alchemical" },
      { char: "\u{1F714}", name: "Sal (Salt / Body)", category: "alchemical" },
      { char: "\u{1F70E}", name: "Hydrargyrum (Mercury / Mind)", category: "alchemical" },
      { char: "\u{1F764}", name: "Aurum (Gold)", category: "alchemical" },
      { char: "\u{1F762}", name: "Argentum (Silver)", category: "alchemical" },
      { char: "\u{1F71E}", name: "Sublimation", category: "alchemical" },
      { char: "\u{1F741}", name: "Distillation Crucible", category: "alchemical" }
    ]
  },
  {
    id: "runes",
    name: "Elder Futhark Runes",
    description: "Ancient Germanic and Norse stave inscriptions",
    items: [
      { char: "\u16A0", name: "Fehu (Wealth)", category: "runes" },
      { char: "\u16A2", name: "Uruz (Strength)", category: "runes" },
      { char: "\u16A6", name: "Thurisaz (Thorn / Giant)", category: "runes" },
      { char: "\u16A8", name: "Ansuz (Breath / Voice)", category: "runes" },
      { char: "\u16B1", name: "Raidho (Journey / Wheel)", category: "runes" },
      { char: "\u16B2", name: "Kenaz (Torch / Fire)", category: "runes" },
      { char: "\u16B7", name: "Gebo (Gift / Exchange)", category: "runes" },
      { char: "\u16B9", name: "Wunjo (Joy / Harmony)", category: "runes" },
      { char: "\u16BA", name: "Hagalaz (Hail / Tempest)", category: "runes" },
      { char: "\u16BE", name: "Nauthiz (Need / Friction)", category: "runes" },
      { char: "\u16C1", name: "Isa (Ice / Stasis)", category: "runes" },
      { char: "\u16C3", name: "Jera (Harvest / Cycle)", category: "runes" },
      { char: "\u16C7", name: "Eihwaz (Yew / Axis)", category: "runes" },
      { char: "\u16C9", name: "Algiz (Elk / Protection)", category: "runes" },
      { char: "\u16CA", name: "Sowilo (Sun Lightning)", category: "runes" },
      { char: "\u16CF", name: "Tiwaz (Justice / Sky)", category: "runes" },
      { char: "\u16D2", name: "Berkana (Birch / Birth)", category: "runes" },
      { char: "\u16D6", name: "Ehwaz (Steed / Momentum)", category: "runes" },
      { char: "\u16D7", name: "Mannaz (Humanity)", category: "runes" },
      { char: "\u16DA", name: "Laguz (Water / Tide)", category: "runes" },
      { char: "\u16DC", name: "Ingwaz (Seed / Core)", category: "runes" },
      { char: "\u16DE", name: "Dagaz (Dawn / Awakening)", category: "runes" },
      { char: "\u16DF", name: "Othala (Ancestry / Hearth)", category: "runes" }
    ]
  },
  {
    id: "math",
    name: "Physics & Operators",
    description: "Vector calculus operators, continuum mechanics integrals, and constants",
    items: [
      { char: "\u221E", name: "Lemniscate / Infinity", category: "math" },
      { char: "\u2211", name: "Summation Sigma", category: "math" },
      { char: "\u220F", name: "Product Pi", category: "math" },
      { char: "\u222B", name: "Continuous Integral", category: "math" },
      { char: "\u222C", name: "Surface Integral", category: "math" },
      { char: "\u222E", name: "Circulation Contour", category: "math" },
      { char: "\u2207", name: "Del / Nabla Gradient", category: "math" },
      { char: "\u2202", name: "Partial Derivative", category: "math" },
      { char: "\u221A", name: "Radical / Square Root", category: "math" },
      { char: "\u03BB", name: "Lambda / Eigenvalue", category: "math" },
      { char: "\u03A9", name: "Ohm / Terminal Omega", category: "math" },
      { char: "\u210F", name: "Reduced Planck Constant", category: "math" },
      { char: "\u2135", name: "Aleph Cardinality", category: "math" }
    ]
  },
  {
    id: "greek",
    name: "Classical Greek & Esoteric",
    description: "Hellenic letters used across metaphysics, quantum systems, and geometry",
    items: [
      { char: "\u03A9", name: "Omega", category: "greek" },
      { char: "\u0394", name: "Delta", category: "greek" },
      { char: "\u03A3", name: "Sigma", category: "greek" },
      { char: "\u03A6", name: "Phi / Golden Ratio", category: "greek" },
      { char: "\u03A8", name: "Psi / Wavefunction", category: "greek" },
      { char: "\u03B1", name: "Alpha", category: "greek" },
      { char: "\u03B2", name: "Beta", category: "greek" },
      { char: "\u03B3", name: "Gamma", category: "greek" },
      { char: "\u03B8", name: "Theta", category: "greek" },
      { char: "\u03C0", name: "Pi", category: "greek" },
      { char: "\u03C6", name: "Phi (lowercase)", category: "greek" },
      { char: "\u03C8", name: "Psi (lowercase)", category: "greek" },
      { char: "\u262F", name: "Taijitu / Dualism", category: "greek" },
      { char: "\xA7", name: "Section Mark", category: "greek" },
      { char: "\xB6", name: "Pilcrow", category: "greek" }
    ]
  },
  {
    id: "chakras",
    name: "Chakras & Sacred Bija Syllables",
    description: "Canonical Sanskrit seed mantras and tantric sacred symbols for the 7 primary subtle centers",
    items: [
      { char: "\u0950", name: "AUM / Crown & Ajna Cosmic Monad", category: "chakras" },
      { char: "\u0939\u0902", name: "HAM / Vishuddha Throat Mantra", category: "chakras" },
      { char: "\u092F\u0902", name: "YAM / Anahata Heart Mantra", category: "chakras" },
      { char: "\u0930\u0902", name: "RAM / Manipura Solar Plexus Mantra", category: "chakras" },
      { char: "\u0935\u0902", name: "VAM / Svadhisthana Sacral Mantra", category: "chakras" },
      { char: "\u0932\u0902", name: "LAM / Muladhara Root Mantra", category: "chakras" },
      { char: "\u2638", name: "Dharmachakra / 1000-Petal Sahasrara Wheel", category: "chakras" },
      { char: "\u{1FAB7}", name: "Lotus of the Heart (Padma)", category: "chakras" },
      { char: "\u2721", name: "Anahata Star Hexagram (Air Yantra)", category: "chakras" },
      { char: "\u{1F53B}", name: "Manipura Downward Fire Triangle", category: "chakras" },
      { char: "\u263D", name: "Svadhisthana Crescent Moon (Water)", category: "chakras" },
      { char: "\u25A0", name: "Muladhara Golden Earth Square", category: "chakras" },
      { char: "\u{1F441}\uFE0F", name: "Ajna Divine Third Eye of Wisdom", category: "chakras" },
      { char: "\u26A1", name: "Kundalini Awakening Surge", category: "chakras" }
    ]
  }
];
const CHAIN_PRESETS = [
  {
    id: "chakra_kundalini_ascent",
    name: "Kundalini Chakra Ascent (Root \u2794 Crown)",
    description: "Energetic spinal transit from Muladhara (\u0932\u0902) up through all 7 centers to Sahasrara (\u0950)",
    chain: ["\u0932\u0902", "\u0935\u0902", "\u0930\u0902", "\u092F\u0902", "\u0939\u0902", "\u0950", "\u2638"],
    recommendedHold: 1.2,
    recommendedTransition: 2.4,
    recommendedEasing: "smoothstep"
  },
  {
    id: "chakra_sacred_yantras",
    name: "Sacred Chakra Yantra Geometry",
    description: "Geometric yantra progression: Square (Earth) \u2794 Crescent \u2794 Triangle (Fire) \u2794 Hexagram (Air) \u2794 Circle (Ether) \u2794 Two Petals \u2794 Lotus",
    chain: ["\u25A0", "\u263D", "\u{1F53B}", "\u2721", "\u25EF", "\u25C9", "\u2638"],
    recommendedHold: 1,
    recommendedTransition: 2.2,
    recommendedEasing: "kineticSnap"
  },
  {
    id: "platonic_polygons",
    name: "Platonic Polygon Progression",
    description: "Iterative vertices expansion: Triangle (3) \u2192 Square (4) \u2192 Pentagon (5) \u2192 Hexagon (6) \u2192 Octagon (8) \u2192 Circle (\u221E)",
    chain: ["\u25B2", "\u25A0", "\u2B1F", "\u2B22", "\u2BCE", "\u25C9"],
    recommendedHold: 1,
    recommendedTransition: 2.2,
    recommendedEasing: "kineticSnap"
  },
  {
    id: "zodiac_ecliptic",
    name: "Great Zodiac Constellation Orbit",
    description: "The full 12 constellations of the celestial zodiac transitioning through fire, earth, air, and water",
    chain: ["\u2648", "\u2649", "\u264A", "\u264B", "\u264C", "\u264D", "\u264E", "\u264F", "\u2650", "\u2651", "\u2652", "\u2653"],
    recommendedHold: 0.8,
    recommendedTransition: 2,
    recommendedEasing: "smoothstep"
  },
  {
    id: "sacred_geometry",
    name: "Sacred Polyhedra & Merkaba Matrix",
    description: "Complex dimensional sigils from Merkaba to Hexagonal Lattice, Tensor Ring, and Monad",
    chain: ["\u238A", "\u23E3", "\u2721", "\u2B22", "\u229B", "\u25CE", "\u2BD0"],
    recommendedHold: 1.2,
    recommendedTransition: 2.5,
    recommendedEasing: "kineticSnap"
  },
  {
    id: "celestial_planets",
    name: "Celestial Spheres Planetary Transit",
    description: "Traversing outward from Sol through inner and outer planetary orbs to the celestial horizon",
    chain: ["\u2609", "\u263D", "\u263F", "\u2640", "\u2641", "\u2642", "\u2643", "\u2644", "\u2645", "\u2646"],
    recommendedHold: 0.9,
    recommendedTransition: 2.4,
    recommendedEasing: "smoothstep"
  },
  {
    id: "alchemical_elements",
    name: "Hermetic Alchemical Transmutation",
    description: "Triangular elemental transformations: Fire \u2192 Water \u2192 Air \u2192 Earth \u2192 Quintessence \u2192 Sulphur \u2192 Gold",
    chain: ["\u{1F702}", "\u{1F704}", "\u{1F701}", "\u{1F703}", "\u{1F700}", "\u{1F70D}", "\u{1F714}", "\u{1F764}"],
    recommendedHold: 1.1,
    recommendedTransition: 2.2,
    recommendedEasing: "whip"
  },
  {
    id: "nordic_runes",
    name: "Elder Futhark Stave Sequence",
    description: "Ancestral Nordic runes radiating mystical kinetic energy through stippled vectors",
    chain: ["\u16A0", "\u16B1", "\u16B2", "\u16B7", "\u16C3", "\u16C7", "\u16C9", "\u16CA", "\u16CF", "\u16DE", "\u16DF"],
    recommendedHold: 0.8,
    recommendedTransition: 2,
    recommendedEasing: "smoothstep"
  },
  {
    id: "math_continuum",
    name: "Calculus Operator Continuum",
    description: "From infinity to contour integrals, nabla gradient, eigenvalue wavefunctions, and omega",
    chain: ["\u221E", "\u2211", "\u222B", "\u2207", "\u2202", "\u03BB", "\u03A9"],
    recommendedHold: 1,
    recommendedTransition: 2.5,
    recommendedEasing: "kineticSnap"
  },
  {
    id: "binary_vortex",
    name: "Canonical Binary Flux (O \u21C4 I)",
    description: "Extended alternation between the canonical circular void, structural bar, and cardinal cross",
    chain: ["O", "I", "X", "+", "0", "1"],
    recommendedHold: 0.7,
    recommendedTransition: 1.8,
    recommendedEasing: "smoothstep"
  },
  {
    id: "lexical_words",
    name: "Semantics Word Stream",
    description: "Multi-character whole word fluid morphing across abstract typographic concepts",
    chain: ["VOID", "FORM", "FLUID", "FLOW", "ECHO", "NULL"],
    recommendedHold: 1.4,
    recommendedTransition: 2.8,
    recommendedEasing: "smoothstep"
  }
];
export {
  CHAIN_PRESETS,
  GLYPH_CATEGORIES
};
