import type { ResonanceAnchor } from '../cymaticResonator';
import { CHAKRA_DEFINITIONS, type ChakraDefinition } from './chakraSemantics';

export const CHAKRA_PROFILE_ID = 'chakra-seven-v1';

export interface ChakraResonanceMapping {
  node: ChakraDefinition;
  anchor: ResonanceAnchor | null;
}

/** Authored semantic presentation profile — not a live Nara M4 reading.
 * Root→Crown maps onto physical anchors by frequency for resonance colouring only.
 * Centre identity remains distinct from any cymatic station. */
export function mapChakrasToAnchors(anchors: readonly ResonanceAnchor[]): ChakraResonanceMapping[] {
  const ordered = [...anchors].sort((a,b)=>a.frequencyHz-b.frequencyHz);
  return CHAKRA_DEFINITIONS.map((node)=>({node,anchor:ordered[node.order]??null}));
}
