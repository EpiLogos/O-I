/** Pure chakra semantics. No physics, positions, frequencies, forces or playback state. */
export type ChakraId =
  | 'muladhara'
  | 'svadhisthana'
  | 'manipura'
  | 'anahata'
  | 'vishuddha'
  | 'ajna'
  | 'sahasrara';

export interface ChakraDefinition {
  id: ChakraId;
  /** Root = 0 .. Crown = 6. */
  order: number;
  name: string;
  sanskrit: string;
  englishTitle: string;
  seedSyllable: string;
  symbol: string;
  element: string;
  canonicalColor: string;
  /** Historical correspondence retained as metadata only; never drives CymaticResonator. */
  historicalCorrespondences?: { solfeggioHz?: number };
}

export const CHAKRA_DEFINITIONS: readonly ChakraDefinition[] = [
  { id:'muladhara', order:0, name:'Muladhara (Root)', sanskrit:'मूलाधार', englishTitle:'Root / Grounded Foundation', seedSyllable:'लं', symbol:'🪷', element:'Earth (Prithvi)', canonicalColor:'#ff2255', historicalCorrespondences:{solfeggioHz:396} },
  { id:'svadhisthana', order:1, name:'Svadhisthana (Sacral)', sanskrit:'स्वाधिष्ठान', englishTitle:'Sacral / Fluid Creativity', seedSyllable:'वं', symbol:'☽', element:'Water (Apas)', canonicalColor:'#ff8800', historicalCorrespondences:{solfeggioHz:417} },
  { id:'manipura', order:2, name:'Manipura (Solar Plexus)', sanskrit:'मणिपूर', englishTitle:'Solar Plexus / Willpower', seedSyllable:'रं', symbol:'▽', element:'Fire (Tejas)', canonicalColor:'#ffff00', historicalCorrespondences:{solfeggioHz:528} },
  { id:'anahata', order:3, name:'Anahata (Heart)', sanskrit:'अनाहत', englishTitle:'Heart / Compassion', seedSyllable:'यं', symbol:'✡', element:'Air (Vayu)', canonicalColor:'#00ff99', historicalCorrespondences:{solfeggioHz:639} },
  { id:'vishuddha', order:4, name:'Vishuddha (Throat)', sanskrit:'विशुद्ध', englishTitle:'Throat / Expression', seedSyllable:'हं', symbol:'◯', element:'Ether / Sound (Akasha)', canonicalColor:'#00ffff', historicalCorrespondences:{solfeggioHz:741} },
  { id:'ajna', order:5, name:'Ajna (Third Eye)', sanskrit:'आज्ञा', englishTitle:'Third Eye / Intuition', seedSyllable:'ॐ', symbol:'👁', element:'Light (Prakasha)', canonicalColor:'#66a3ff', historicalCorrespondences:{solfeggioHz:852} },
  { id:'sahasrara', order:6, name:'Sahasrara (Crown)', sanskrit:'सहस्रार', englishTitle:'Crown / Pure Consciousness', seedSyllable:'ॐ', symbol:'☸', element:'Cosmic Spirit (Akasha)', canonicalColor:'#ff77ff', historicalCorrespondences:{solfeggioHz:963} },
] as const;

export const CHAKRA_BY_ID = new Map(CHAKRA_DEFINITIONS.map((node) => [node.id, node] as const));
