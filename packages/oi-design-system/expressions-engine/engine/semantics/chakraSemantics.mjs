const CHAKRA_DEFINITIONS = [
  { id: "muladhara", order: 0, name: "Muladhara (Root)", sanskrit: "\u092E\u0942\u0932\u093E\u0927\u093E\u0930", englishTitle: "Root / Grounded Foundation", seedSyllable: "\u0932\u0902", symbol: "\u{1FAB7}", element: "Earth (Prithvi)", canonicalColor: "#ff2255", historicalCorrespondences: { solfeggioHz: 396 } },
  { id: "svadhisthana", order: 1, name: "Svadhisthana (Sacral)", sanskrit: "\u0938\u094D\u0935\u093E\u0927\u093F\u0937\u094D\u0920\u093E\u0928", englishTitle: "Sacral / Fluid Creativity", seedSyllable: "\u0935\u0902", symbol: "\u263D", element: "Water (Apas)", canonicalColor: "#ff8800", historicalCorrespondences: { solfeggioHz: 417 } },
  { id: "manipura", order: 2, name: "Manipura (Solar Plexus)", sanskrit: "\u092E\u0923\u093F\u092A\u0942\u0930", englishTitle: "Solar Plexus / Willpower", seedSyllable: "\u0930\u0902", symbol: "\u25BD", element: "Fire (Tejas)", canonicalColor: "#ffff00", historicalCorrespondences: { solfeggioHz: 528 } },
  { id: "anahata", order: 3, name: "Anahata (Heart)", sanskrit: "\u0905\u0928\u093E\u0939\u0924", englishTitle: "Heart / Compassion", seedSyllable: "\u092F\u0902", symbol: "\u2721", element: "Air (Vayu)", canonicalColor: "#00ff99", historicalCorrespondences: { solfeggioHz: 639 } },
  { id: "vishuddha", order: 4, name: "Vishuddha (Throat)", sanskrit: "\u0935\u093F\u0936\u0941\u0926\u094D\u0927", englishTitle: "Throat / Expression", seedSyllable: "\u0939\u0902", symbol: "\u25EF", element: "Ether / Sound (Akasha)", canonicalColor: "#00ffff", historicalCorrespondences: { solfeggioHz: 741 } },
  { id: "ajna", order: 5, name: "Ajna (Third Eye)", sanskrit: "\u0906\u091C\u094D\u091E\u093E", englishTitle: "Third Eye / Intuition", seedSyllable: "\u0950", symbol: "\u{1F441}", element: "Light (Prakasha)", canonicalColor: "#66a3ff", historicalCorrespondences: { solfeggioHz: 852 } },
  { id: "sahasrara", order: 6, name: "Sahasrara (Crown)", sanskrit: "\u0938\u0939\u0938\u094D\u0930\u093E\u0930", englishTitle: "Crown / Pure Consciousness", seedSyllable: "\u0950", symbol: "\u2638", element: "Cosmic Spirit (Akasha)", canonicalColor: "#ff77ff", historicalCorrespondences: { solfeggioHz: 963 } }
];
const CHAKRA_BY_ID = new Map(CHAKRA_DEFINITIONS.map((node) => [node.id, node]));
export {
  CHAKRA_BY_ID,
  CHAKRA_DEFINITIONS
};
