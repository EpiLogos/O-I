/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GlyphItem {
  char: string;
  name: string;
  category: string;
  /** The M3′ form the glyph is drawn from, for the forms' items: the symbol keeps it beside the text (O-I #852). */
  form?: M3Form;
}

export interface GlyphCategory {
  id: string;
  name: string;
  description: string;
  items: GlyphItem[];
}

export interface ChainPreset {
  id: string;
  name: string;
  description: string;
  chain: string[];
  recommendedHold?: number;
  recommendedTransition?: number;
  recommendedEasing?: 'smoothstep' | 'linear' | 'kineticSnap' | 'whip';
}

export const GLYPH_CATEGORIES: GlyphCategory[] = [
  {
    id: 'polygons',
    name: 'Polygons & Sacred Geometry',
    description: 'Geometric primitives from 3-sided delta polygons to 8-gons and sacred polyhedra',
    items: [
      { char: '▲', name: 'Trigon / Triangle', category: 'polygons' },
      { char: '▼', name: 'Inverted Delta', category: 'polygons' },
      { char: '△', name: 'Open Delta', category: 'polygons' },
      { char: '■', name: 'Tetragon / Square', category: 'polygons' },
      { char: '◆', name: 'Rhombus / Diamond', category: 'polygons' },
      { char: '◈', name: 'Nested Diamond', category: 'polygons' },
      { char: '⬟', name: 'Pentagon / 5-Gon', category: 'polygons' },
      { char: '⬠', name: 'Hollow Pentagon', category: 'polygons' },
      { char: '⛤', name: 'Pentagram Sigil', category: 'polygons' },
      { char: '⬢', name: 'Hexagon / 6-Gon', category: 'polygons' },
      { char: '⬡', name: 'Hollow Hexagon', category: 'polygons' },
      { char: '✡', name: 'Hexagram / Star', category: 'polygons' },
      { char: '⯎', name: 'Octagon / 8-Gon', category: 'polygons' },
      { char: '✵', name: '8-Pointed Star', category: 'polygons' },
      { char: '◉', name: 'Concentric Monad', category: 'polygons' },
      { char: '◎', name: 'Bullseye Ring', category: 'polygons' },
      { char: '◯', name: 'Perfect Circle', category: 'polygons' },
      { char: '⎊', name: 'Merkaba Polyhedron', category: 'polygons' },
      { char: '⏣', name: 'Benzene Hex Grid', category: 'polygons' },
      { char: '⯐', name: 'Star Octahedron', category: 'polygons' },
      { char: '⌬', name: 'Fused Hex Core', category: 'polygons' },
      { char: '⊛', name: 'Circled Asterisk', category: 'polygons' },
      { char: '⊕', name: 'Sun Cross / Quadrant', category: 'polygons' },
      { char: '⊗', name: 'Tensor Matrix', category: 'polygons' },
    ],
  },
  {
    id: 'zodiac',
    name: 'Zodiac & Astrological Signs',
    description: 'The complete classical 12 ecliptic zodiac constellations plus Ophiuchus',
    items: [
      { char: '♈', name: 'Aries (Ram)', category: 'zodiac' },
      { char: '♉', name: 'Taurus (Bull)', category: 'zodiac' },
      { char: '♊', name: 'Gemini (Twins)', category: 'zodiac' },
      { char: '♋', name: 'Cancer (Crab)', category: 'zodiac' },
      { char: '♌', name: 'Leo (Lion)', category: 'zodiac' },
      { char: '♍', name: 'Virgo (Maiden)', category: 'zodiac' },
      { char: '♎', name: 'Libra (Scales)', category: 'zodiac' },
      { char: '♏', name: 'Scorpio (Scorpion)', category: 'zodiac' },
      { char: '♐', name: 'Sagittarius (Archer)', category: 'zodiac' },
      { char: '♑', name: 'Capricorn (Sea Goat)', category: 'zodiac' },
      { char: '♒', name: 'Aquarius (Water Bearer)', category: 'zodiac' },
      { char: '♓', name: 'Pisces (Fishes)', category: 'zodiac' },
      { char: '⛎', name: 'Ophiuchus (Serpent)', category: 'zodiac' },
    ],
  },
  {
    id: 'planetary',
    name: 'Planetary & Celestial',
    description: 'Astronomical planet glyphs, lunar phases, and stellar luminaries',
    items: [
      { char: '☉', name: 'Sol / Sun', category: 'planetary' },
      { char: '☽', name: 'Waxing Crescent', category: 'planetary' },
      { char: '☾', name: 'Waning Crescent', category: 'planetary' },
      { char: '☿', name: 'Mercury', category: 'planetary' },
      { char: '♀', name: 'Venus', category: 'planetary' },
      { char: '♁', name: 'Terra / Earth', category: 'planetary' },
      { char: '♂', name: 'Mars', category: 'planetary' },
      { char: '♃', name: 'Jupiter', category: 'planetary' },
      { char: '♄', name: 'Saturn', category: 'planetary' },
      { char: '♅', name: 'Uranus', category: 'planetary' },
      { char: '♆', name: 'Neptune', category: 'planetary' },
      { char: '♇', name: 'Pluto', category: 'planetary' },
      { char: '✦', name: 'Four-Point Flare', category: 'planetary' },
      { char: '✧', name: 'Sparkle Luminary', category: 'planetary' },
      { char: '★', name: 'Five-Point Star', category: 'planetary' },
      { char: '❂', name: 'Radiant Solar Disc', category: 'planetary' },
    ],
  },
  {
    id: 'alchemical',
    name: 'Alchemical Elements',
    description: 'Classical alchemical principles, element triangles, and hermetic symbols',
    items: [
      { char: '🜂', name: 'Ignis (Fire)', category: 'alchemical' },
      { char: '🜄', name: 'Aqua (Water)', category: 'alchemical' },
      { char: '🜁', name: 'Aer (Air)', category: 'alchemical' },
      { char: '🜃', name: 'Terra (Earth)', category: 'alchemical' },
      { char: '🜀', name: 'Quintessence / Aether', category: 'alchemical' },
      { char: '🜍', name: 'Sulphur (Soul)', category: 'alchemical' },
      { char: '🜔', name: 'Sal (Salt / Body)', category: 'alchemical' },
      { char: '🜎', name: 'Hydrargyrum (Mercury / Mind)', category: 'alchemical' },
      { char: '🝤', name: 'Aurum (Gold)', category: 'alchemical' },
      { char: '🝢', name: 'Argentum (Silver)', category: 'alchemical' },
      { char: '🜞', name: 'Sublimation', category: 'alchemical' },
      { char: '🝁', name: 'Distillation Crucible', category: 'alchemical' },
    ],
  },
  {
    id: 'runes',
    name: 'Elder Futhark Runes',
    description: 'Ancient Germanic and Norse stave inscriptions',
    items: [
      { char: 'ᚠ', name: 'Fehu (Wealth)', category: 'runes' },
      { char: 'ᚢ', name: 'Uruz (Strength)', category: 'runes' },
      { char: 'ᚦ', name: 'Thurisaz (Thorn / Giant)', category: 'runes' },
      { char: 'ᚨ', name: 'Ansuz (Breath / Voice)', category: 'runes' },
      { char: 'ᚱ', name: 'Raidho (Journey / Wheel)', category: 'runes' },
      { char: 'ᚲ', name: 'Kenaz (Torch / Fire)', category: 'runes' },
      { char: 'ᚷ', name: 'Gebo (Gift / Exchange)', category: 'runes' },
      { char: 'ᚹ', name: 'Wunjo (Joy / Harmony)', category: 'runes' },
      { char: 'ᚺ', name: 'Hagalaz (Hail / Tempest)', category: 'runes' },
      { char: 'ᚾ', name: 'Nauthiz (Need / Friction)', category: 'runes' },
      { char: 'ᛁ', name: 'Isa (Ice / Stasis)', category: 'runes' },
      { char: 'ᛃ', name: 'Jera (Harvest / Cycle)', category: 'runes' },
      { char: 'ᛇ', name: 'Eihwaz (Yew / Axis)', category: 'runes' },
      { char: 'ᛉ', name: 'Algiz (Elk / Protection)', category: 'runes' },
      { char: 'ᛊ', name: 'Sowilo (Sun Lightning)', category: 'runes' },
      { char: 'ᛏ', name: 'Tiwaz (Justice / Sky)', category: 'runes' },
      { char: 'ᛒ', name: 'Berkana (Birch / Birth)', category: 'runes' },
      { char: 'ᛖ', name: 'Ehwaz (Steed / Momentum)', category: 'runes' },
      { char: 'ᛗ', name: 'Mannaz (Humanity)', category: 'runes' },
      { char: 'ᛚ', name: 'Laguz (Water / Tide)', category: 'runes' },
      { char: 'ᛜ', name: 'Ingwaz (Seed / Core)', category: 'runes' },
      { char: 'ᛞ', name: 'Dagaz (Dawn / Awakening)', category: 'runes' },
      { char: 'ᛟ', name: 'Othala (Ancestry / Hearth)', category: 'runes' },
    ],
  },
  {
    id: 'math',
    name: 'Physics & Operators',
    description: 'Vector calculus operators, continuum mechanics integrals, and constants',
    items: [
      { char: '∞', name: 'Lemniscate / Infinity', category: 'math' },
      { char: '∑', name: 'Summation Sigma', category: 'math' },
      { char: '∏', name: 'Product Pi', category: 'math' },
      { char: '∫', name: 'Continuous Integral', category: 'math' },
      { char: '∬', name: 'Surface Integral', category: 'math' },
      { char: '∮', name: 'Circulation Contour', category: 'math' },
      { char: '∇', name: 'Del / Nabla Gradient', category: 'math' },
      { char: '∂', name: 'Partial Derivative', category: 'math' },
      { char: '√', name: 'Radical / Square Root', category: 'math' },
      { char: 'λ', name: 'Lambda / Eigenvalue', category: 'math' },
      { char: 'Ω', name: 'Ohm / Terminal Omega', category: 'math' },
      { char: 'ℏ', name: 'Reduced Planck Constant', category: 'math' },
      { char: 'ℵ', name: 'Aleph Cardinality', category: 'math' },
    ],
  },
  {
    id: 'greek',
    name: 'Classical Greek & Esoteric',
    description: 'Hellenic letters used across metaphysics, quantum systems, and geometry',
    items: [
      { char: 'Ω', name: 'Omega', category: 'greek' },
      { char: 'Δ', name: 'Delta', category: 'greek' },
      { char: 'Σ', name: 'Sigma', category: 'greek' },
      { char: 'Φ', name: 'Phi / Golden Ratio', category: 'greek' },
      { char: 'Ψ', name: 'Psi / Wavefunction', category: 'greek' },
      { char: 'α', name: 'Alpha', category: 'greek' },
      { char: 'β', name: 'Beta', category: 'greek' },
      { char: 'γ', name: 'Gamma', category: 'greek' },
      { char: 'θ', name: 'Theta', category: 'greek' },
      { char: 'π', name: 'Pi', category: 'greek' },
      { char: 'φ', name: 'Phi (lowercase)', category: 'greek' },
      { char: 'ψ', name: 'Psi (lowercase)', category: 'greek' },
      { char: '☯', name: 'Taijitu / Dualism', category: 'greek' },
      { char: '§', name: 'Section Mark', category: 'greek' },
      { char: '¶', name: 'Pilcrow', category: 'greek' },
    ],
  },
  {
    id: 'chakras',
    name: 'Chakras & Sacred Bija Syllables',
    description: 'Canonical Sanskrit seed mantras and tantric sacred symbols for the 7 primary subtle centers',
    items: [
      { char: 'ॐ', name: 'AUM / Crown & Ajna Cosmic Monad', category: 'chakras' },
      { char: 'हं', name: 'HAM / Vishuddha Throat Mantra', category: 'chakras' },
      { char: 'यं', name: 'YAM / Anahata Heart Mantra', category: 'chakras' },
      { char: 'रं', name: 'RAM / Manipura Solar Plexus Mantra', category: 'chakras' },
      { char: 'वं', name: 'VAM / Svadhisthana Sacral Mantra', category: 'chakras' },
      { char: 'लं', name: 'LAM / Muladhara Root Mantra', category: 'chakras' },
      { char: '☸', name: 'Dharmachakra / 1000-Petal Sahasrara Wheel', category: 'chakras' },
      { char: '🪷', name: 'Lotus of the Heart (Padma)', category: 'chakras' },
      { char: '✡', name: 'Anahata Star Hexagram (Air Yantra)', category: 'chakras' },
      { char: '🔻', name: 'Manipura Downward Fire Triangle', category: 'chakras' },
      { char: '☽', name: 'Svadhisthana Crescent Moon (Water)', category: 'chakras' },
      { char: '■', name: 'Muladhara Golden Earth Square', category: 'chakras' },
      { char: '👁️', name: 'Ajna Divine Third Eye of Wisdom', category: 'chakras' },
      { char: '⚡', name: 'Kundalini Awakening Surge', category: 'chakras' },
    ],
  },
];

export const CHAIN_PRESETS: ChainPreset[] = [
  {
    id: 'chakra_kundalini_ascent',
    name: 'Kundalini Chakra Ascent (Root ➔ Crown)',
    description: 'Energetic spinal transit from Muladhara (लं) up through all 7 centers to Sahasrara (ॐ)',
    chain: ['लं', 'वं', 'रं', 'यं', 'हं', 'ॐ', '☸'],
    recommendedHold: 1.2,
    recommendedTransition: 2.4,
    recommendedEasing: 'smoothstep',
  },
  {
    id: 'chakra_sacred_yantras',
    name: 'Sacred Chakra Yantra Geometry',
    description: 'Geometric yantra progression: Square (Earth) ➔ Crescent ➔ Triangle (Fire) ➔ Hexagram (Air) ➔ Circle (Ether) ➔ Two Petals ➔ Lotus',
    chain: ['■', '☽', '🔻', '✡', '◯', '◉', '☸'],
    recommendedHold: 1.0,
    recommendedTransition: 2.2,
    recommendedEasing: 'kineticSnap',
  },
  {
    id: 'platonic_polygons',
    name: 'Platonic Polygon Progression',
    description: 'Iterative vertices expansion: Triangle (3) → Square (4) → Pentagon (5) → Hexagon (6) → Octagon (8) → Circle (∞)',
    chain: ['▲', '■', '⬟', '⬢', '⯎', '◉'],
    recommendedHold: 1.0,
    recommendedTransition: 2.2,
    recommendedEasing: 'kineticSnap',
  },
  {
    id: 'zodiac_ecliptic',
    name: 'Great Zodiac Constellation Orbit',
    description: 'The full 12 constellations of the celestial zodiac transitioning through fire, earth, air, and water',
    chain: ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'],
    recommendedHold: 0.8,
    recommendedTransition: 2.0,
    recommendedEasing: 'smoothstep',
  },
  {
    id: 'sacred_geometry',
    name: 'Sacred Polyhedra & Merkaba Matrix',
    description: 'Complex dimensional sigils from Merkaba to Hexagonal Lattice, Tensor Ring, and Monad',
    chain: ['⎊', '⏣', '✡', '⬢', '⊛', '◎', '⯐'],
    recommendedHold: 1.2,
    recommendedTransition: 2.5,
    recommendedEasing: 'kineticSnap',
  },
  {
    id: 'celestial_planets',
    name: 'Celestial Spheres Planetary Transit',
    description: 'Traversing outward from Sol through inner and outer planetary orbs to the celestial horizon',
    chain: ['☉', '☽', '☿', '♀', '♁', '♂', '♃', '♄', '♅', '♆'],
    recommendedHold: 0.9,
    recommendedTransition: 2.4,
    recommendedEasing: 'smoothstep',
  },
  {
    id: 'alchemical_elements',
    name: 'Hermetic Alchemical Transmutation',
    description: 'Triangular elemental transformations: Fire → Water → Air → Earth → Quintessence → Sulphur → Gold',
    chain: ['🜂', '🜄', '🜁', '🜃', '🜀', '🜍', '🜔', '🝤'],
    recommendedHold: 1.1,
    recommendedTransition: 2.2,
    recommendedEasing: 'whip',
  },
  {
    id: 'nordic_runes',
    name: 'Elder Futhark Stave Sequence',
    description: 'Ancestral Nordic runes radiating mystical kinetic energy through stippled vectors',
    chain: ['ᚠ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᛃ', 'ᛇ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛞ', 'ᛟ'],
    recommendedHold: 0.8,
    recommendedTransition: 2.0,
    recommendedEasing: 'smoothstep',
  },
  {
    id: 'math_continuum',
    name: 'Calculus Operator Continuum',
    description: 'From infinity to contour integrals, nabla gradient, eigenvalue wavefunctions, and omega',
    chain: ['∞', '∑', '∫', '∇', '∂', 'λ', 'Ω'],
    recommendedHold: 1.0,
    recommendedTransition: 2.5,
    recommendedEasing: 'kineticSnap',
  },
  {
    id: 'binary_vortex',
    name: 'Canonical Binary Flux (O ⇄ I)',
    description: 'Extended alternation between the canonical circular void, structural bar, and cardinal cross',
    chain: ['O', 'I', 'X', '+', '0', '1'],
    recommendedHold: 0.7,
    recommendedTransition: 1.8,
    recommendedEasing: 'smoothstep',
  },
  {
    id: 'lexical_words',
    name: 'Semantics Word Stream',
    description: 'Multi-character whole word fluid morphing across abstract typographic concepts',
    chain: ['VOID', 'FORM', 'FLUID', 'FLOW', 'ECHO', 'NULL'],
    recommendedHold: 1.4,
    recommendedTransition: 2.8,
    recommendedEasing: 'smoothstep',
  },
];

// ------------------------------------------------------------------------------------------------- M3′ forms as glyphs (O-I #852)
//
// A symbol can take its glyph from a form of M3′: a fold, a codon, a hexagram or a card, beside letters, shapes and images. The four
// are one address of six bits (QL ql-core pole/codon.rs Codon64): bit ℓ is the I-Ching line ℓ (line 0 the bottom); the three sites own
// two lines each (lines 0–1 the inner site Z, 2–3 the hinge Y, 4–5 the outer site X), the even bit a site's polarity (1 yang,
// a mountain crease) and the odd bit its mobility (1 resting); the nucleotide of a site is its two bits (A 0, T 1, C 2, G 3,
// pole/nucleotide.rs). A step changes the form by QL's own law: a moving line flips one bit (Codon64::line_change, the 384
// one-line changes), and a turn about a matrix axis applies that matrix's partner on every site (MatrixFamily::apply_to_codon:
// the address XOR 0x15 for the complementary matrix on i, 0x3F for moving/resting on j, 0x2A for same-quality on k).
// The form keeps its meaning as a symbol: the glyph is drawn from the address, and the address travels with the shape. A card is the
// codon as the Minor Arcana card QL's exact cover gives it (ql-core pole/tarot.rs TarotBridge::card_of_codon): it steps as its codon
// does, and draws the card its codon lands on.

export type M3FormKind = 'fold' | 'codon' | 'hexagram' | 'card';
export interface M3Form { kind: M3FormKind; address: number }
export type M3Axis = 'i' | 'j' | 'k';
export type M3Step = { line: number } | { axis: M3Axis };

/** The matrices' partner masks on a codon address, by quaternion axis (QL MatrixFamily::codon_mask). */
export const M3_AXIS_MASK: Readonly<Record<M3Axis, number>> = { i: 0x15, j: 0x3f, k: 0x2a };
/** The matrix each axis carries, by QL's names (MatrixFamily::axis). */
export const M3_AXIS_MATRIX: Readonly<Record<M3Axis, 'complementary' | 'moving-resting' | 'same-quality'>> = {
  i: 'complementary', j: 'moving-resting', k: 'same-quality',
};
const NUCLEOTIDES = ['A', 'T', 'C', 'G'] as const;

function assertForm(form: M3Form): void {
  if (!['fold', 'codon', 'hexagram', 'card'].includes(form.kind)) throw new Error(`An M3′ form is a fold, a codon, a hexagram or a card, not ${String(form.kind)}`);
  if (!Number.isInteger(form.address) || form.address < 0 || form.address > 63) throw new Error('An M3′ form\'s address is one of the 64, 0 to 63');
}

/** The form one step away: one line moved, or one turn about a matrix axis. Refused in words for any other step. */
export function stepM3Form(form: M3Form, step: M3Step): M3Form {
  assertForm(form);
  if ('line' in step) {
    if (!Number.isInteger(step.line) || step.line < 0 || step.line > 5) throw new Error('A moving line is one of the six, 0 (the bottom) to 5');
    return { kind: form.kind, address: form.address ^ (1 << step.line) };
  }
  const mask = M3_AXIS_MASK[step.axis];
  if (mask === undefined) throw new Error('A turn is about a matrix axis: i, j or k');
  return { kind: form.kind, address: form.address ^ mask };
}

/** The three sites, outer X to inner Z: polarity (yang is a mountain crease) and mobility. */
export function m3Sites(form: M3Form): { yang: boolean; resting: boolean }[] {
  assertForm(form);
  return [4, 2, 0].map(low => ({ yang: ((form.address >> low) & 1) === 1, resting: ((form.address >> (low + 1)) & 1) === 1 }));
}

/** The codon's letters, outer site first. */
export function codonLetters(form: M3Form): string {
  assertForm(form);
  return [4, 2, 0].map(low => NUCLEOTIDES[(form.address >> low) & 3]).join('');
}

/** The trigrams in the King Wen table's order, each by its three lines bottom first (1 yang): Qian, Zhen, Kan, Gen, Kun, Xun, Li, Dui. */
const TRIGRAMS = [0b111, 0b001, 0b010, 0b100, 0b000, 0b110, 0b101, 0b011] as const;
/** The King Wen number of each hexagram, by lower trigram (row) and upper trigram (column), in TRIGRAMS order. */
const KING_WEN: readonly (readonly number[])[] = [
  [1, 34, 5, 26, 11, 9, 14, 43],
  [25, 51, 3, 27, 24, 42, 21, 17],
  [6, 40, 29, 4, 7, 59, 64, 47],
  [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45],
  [44, 32, 48, 18, 46, 57, 50, 28],
  [13, 55, 63, 22, 36, 37, 30, 49],
  [10, 54, 60, 41, 19, 61, 38, 58],
];

/** The King Wen number of a hexagram address (line ℓ is bit ℓ, line 0 the bottom, 1 yang). */
export function kingWen(address: number): number {
  const lower = TRIGRAMS.indexOf((address & 0b111) as (typeof TRIGRAMS)[number]);
  const upper = TRIGRAMS.indexOf(((address >> 3) & 0b111) as (typeof TRIGRAMS)[number]);
  return KING_WEN[lower][upper];
}

/** The suits in QL's order (TarotSuit: Cups 0, Wands 1, Pentacles 2, Swords 3), each the family of the outer site's nucleotide (A, T, C,
 * G), and the sign a card of the suit is drawn with: the playing-card suit that stands for it (Cups hearts, Wands clubs, Pentacles
 * diamonds, Swords spades). */
const SUITS = [['Cups', '♥'], ['Wands', '♣'], ['Pentacles', '♦'], ['Swords', '♠']] as const;
/** The pip slots in QL's RWS register (TarotPip::rws_name), and the sign each is drawn with. */
const RANKS = [['Ace', 'A'], ['Two', '2'], ['Three', '3'], ['Four', '4'], ['Five', '5'], ['Six', '6'], ['Seven', '7'], ['Eight', '8'],
  ['Nine', '9'], ['Ten', '10'], ['Page', 'P'], ['Knight', 'Kn'], ['Queen', 'Q'], ['King', 'K']] as const;
/** QL's exact cover of the 64 codons by the 56 Minor Arcana cards, by suit in QL's order and pip ascending, each card its codon's letters,
 * outer site first (a court carrying two, its primary first): the kernel's M3_TAROT_CODON_MAP (vendor/epi-kernel/reference/src/m3.c
 * FR 2.3.19, parsed by ql-core pole/tarot.rs parse_kernel_source), transcribed. The yin suits carry their two codons at the Knight and
 * the King, the yang suits at the Page and the Queen. */
const CARD_CODONS: readonly (readonly string[])[] = [
  ['AAA', 'AAG', 'AAT', 'ACC', 'ATG', 'AGA', 'AGT', 'AGG', 'ATT', 'ATA', 'ACA', 'ACG AGC', 'AAC', 'ACT ATC'],
  ['TTT', 'TTA', 'TTC', 'TGG', 'TAC', 'TCA', 'TCC', 'TAA', 'TCT', 'TAT', 'TAG TGA', 'TGT', 'TCG TGC', 'TTG'],
  ['CCC', 'CCG', 'CCT', 'CAA', 'CGC', 'CGG', 'CGT', 'CTG', 'CTT', 'CTC', 'CCA', 'CAG CGA', 'CAC', 'CAT CTA'],
  ['GGG', 'GGA', 'GGC', 'GTT', 'GAC', 'GAG', 'GCA', 'GCC', 'GAA', 'GCG', 'GCT GTC', 'GGT', 'GAT GTA', 'GTG'],
];
const addressOf = (letters: string) => [...letters].reduce((address, n) => (address << 2) | NUCLEOTIDES.indexOf(n as (typeof NUCLEOTIDES)[number]), 0);

/** A Minor Arcana card as QL's M3 state names it (`tarot`: card_id, suit, rank, codons), its pip slot and the sign it is drawn with. */
export interface M3Card { cardId: number; suit: string; rank: string; pip: number; codons: number[]; sign: string }
const CARDS: readonly M3Card[] = CARD_CODONS.flatMap((suit, s) => suit.map((codons, pip) => ({
  cardId: s * 14 + pip, suit: SUITS[s][0], rank: RANKS[pip][0], pip, codons: codons.split(' ').map(addressOf), sign: `${RANKS[pip][1]}${SUITS[s][1]}`,
})));
const CARD_OF_CODON: readonly M3Card[] = (() => {
  const of: M3Card[] = [];
  for (const card of CARDS) for (const codon of card.codons) of[codon] = card;
  return of;
})();

/** The card QL's exact cover gives a form's codon (TarotBridge::card_of_codon), whatever its kind. */
export function m3Card(form: M3Form): M3Card {
  assertForm(form);
  return CARD_OF_CODON[form.address];
}

/** The text the glyph rasteriser draws for a form: a fold's three creases (∧ a mountain, ∨ a valley; dotted ⋏ ⋎ when moving), a
 * codon's letters, a hexagram's sign (U+4DC0 ䷀ … U+4DFF ䷿, in King Wen order), or a card's rank and suit sign (A♥ the Ace of Cups). */
export function m3FormGlyph(form: M3Form): string {
  assertForm(form);
  if (form.kind === 'codon') return codonLetters(form);
  if (form.kind === 'card') return m3Card(form).sign;
  if (form.kind === 'fold') return m3Sites(form).map(site => (site.yang ? (site.resting ? '∧' : '⋏') : (site.resting ? '∨' : '⋎'))).join('');
  return String.fromCodePoint(0x4dc0 + kingWen(form.address) - 1);
}

/** M3′'s torus keeps the proportion of M1′'s, its tube nine to sixteen (manual §20.2, §20.9; torusObject TORUS_MINOR / TORUS_MAJOR). */
export const M3_TORUS_TUBE = 9 / 16;
export const M3_FORMS = 64;
export const M3_LENSES = 12;

/** Where a form read through a lens stands on M3′'s torus: one circle carries the forms (φ, by address), the other the lenses (θ). */
export function m3TorusPlace(address: number, lens: number): { phi: number; theta: number; point: [number, number, number] } {
  const phi = (2 * Math.PI * (((address % M3_FORMS) + M3_FORMS) % M3_FORMS)) / M3_FORMS;
  const theta = (2 * Math.PI * (((lens % M3_LENSES) + M3_LENSES) % M3_LENSES)) / M3_LENSES;
  const ring = 1 + M3_TORUS_TUBE * Math.cos(theta);
  return { phi, theta, point: [ring * Math.cos(phi), ring * Math.sin(phi), M3_TORUS_TUBE * Math.sin(theta)] };
}

/** A Morph between a form and one of its changes: the two glyphs, the step, and the two places on M3′'s torus it moves between
 * (through the lens in force). The engine's Morph drives the field between the two along a torus of that proportion. */
export function m3FormMorph(form: M3Form, step: M3Step, lens = 0) {
  const to = stepM3Form(form, step);
  return {
    from: { form, glyph: m3FormGlyph(form), place: m3TorusPlace(form.address, lens) },
    to: { form: to, glyph: m3FormGlyph(to), place: m3TorusPlace(to.address, lens) },
    step,
    tube: M3_TORUS_TUBE,
  };
}

/** The four ways a form is drawn, by the editor's words for them. */
export const M3_FORM_KINDS: readonly { kind: M3FormKind; label: string }[] = [
  { kind: 'fold', label: 'Fold' }, { kind: 'codon', label: 'Codon' }, { kind: 'hexagram', label: 'Hexagram' }, { kind: 'card', label: 'Card' },
];

/** The steps the editor offers a form: each of the six lines (1 the bottom), and a turn about each matrix axis. */
export const M3_STEPS: readonly { step: M3Step; label: string; does: string }[] = [
  ...Array.from({ length: 6 }, (_, line) => ({ step: { line }, label: String(line + 1), does: `Move line ${line + 1}${line === 0 ? ', the bottom' : line === 5 ? ', the top' : ''}` })),
  ...(['i', 'j', 'k'] as const).map(axis => ({ step: { axis }, label: axis, does: `Turn about ${axis}: the ${M3_AXIS_MATRIX[axis]} matrix's partner on every site` })),
];

/** What a symbol drawn from a form holds: the text the form draws, and the form itself. */
export function m3FormShape(form: M3Form): { text: string; form: M3Form } {
  return { text: m3FormGlyph(form), form };
}

/** The form a symbol keeps when its text is set: its own form while the text is still the one the form draws, none once it is not. */
export function formOfText(shape: { text?: string; form?: M3Form }, text: string): M3Form | undefined {
  return shape.form && m3FormGlyph(shape.form) === text ? shape.form : undefined;
}

/** The M3′ forms category of the glyph library: the 64 hexagrams, by address, then the 56 cards, in QL's deck order. */
export const M3_FORM_CATEGORY: GlyphCategory = {
  id: 'm3-forms',
  name: 'M3′ forms',
  description: 'Folds, codons, hexagrams and cards of M3′: a step moves one line or turns about a matrix axis',
  items: [
    ...Array.from({ length: M3_FORMS }, (_, address) => ({
      char: m3FormGlyph({ kind: 'hexagram', address }),
      form: { kind: 'hexagram' as const, address },
      name: `${kingWen(address)} · ${codonLetters({ kind: 'codon', address })} · ${address.toString(2).padStart(6, '0')}`,
      category: 'm3-forms',
    })),
    ...CARDS.map(card => ({
      char: card.sign,
      form: { kind: 'card' as const, address: card.codons[0] },
      name: `${card.rank} of ${card.suit} · ${card.codons.map(address => codonLetters({ kind: 'codon', address })).join(' ')}`,
      category: 'm3-forms',
    })),
  ],
};
GLYPH_CATEGORIES.push(M3_FORM_CATEGORY);
