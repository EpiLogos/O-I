import type { ResonanceAnchor } from '../cymaticResonator';
import { CHAKRA_DEFINITIONS, type ChakraDefinition } from './chakraSemantics';

export const CHAKRA_PROFILE_ID = 'chakra-seven-v1';

export interface ChakraResonanceMapping {
  node: ChakraDefinition;
  anchor: ResonanceAnchor | null;
}

/** Root→Crown maps monotonically onto the seven physical anchors selected by the current instrument. */
export function mapChakrasToAnchors(anchors: readonly ResonanceAnchor[]): ChakraResonanceMapping[] {
  const ordered = [...anchors].sort((a,b)=>a.frequencyHz-b.frequencyHz);
  return CHAKRA_DEFINITIONS.map((node)=>({node,anchor:ordered[node.order]??null}));
}
