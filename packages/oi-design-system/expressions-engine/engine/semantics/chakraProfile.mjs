import { CHAKRA_DEFINITIONS } from "./chakraSemantics.mjs";
const CHAKRA_PROFILE_ID = "chakra-seven-v1";
function mapChakrasToAnchors(anchors) {
  const ordered = [...anchors].sort((a, b) => a.frequencyHz - b.frequencyHz);
  return CHAKRA_DEFINITIONS.map((node) => ({ node, anchor: ordered[node.order] ?? null }));
}
export {
  CHAKRA_PROFILE_ID,
  mapChakrasToAnchors
};
