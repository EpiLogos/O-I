import { mapChakrasToAnchors } from "./semantics/chakraProfile.mjs";
function semanticFocusTarget(args) {
  const cfg = args.semanticField;
  if (!args.focus || !cfg?.enabled || cfg.profile.kind !== "chakra" || cfg.profile.profileId !== "chakra-seven-v1") return { kind: "semanticFocus", targetHz: args.currentHz, bound: false };
  const map = mapChakrasToAnchors(args.anchors);
  const bindingFor = (entityId) => cfg.bindings.find((b2) => b2.enabled && b2.carriers.some((c) => c.kind === "entity" && c.id === entityId));
  const resolve = (entityId) => {
    const binding = bindingFor(entityId);
    if (!binding) return null;
    const mapped = map.find((m) => m.node.id === binding.semanticNodeId);
    const override = binding.resonance?.anchorId;
    const anchor = override ? args.anchors.find((a2) => a2.id === override) : mapped?.anchor;
    return binding && anchor ? { binding, anchor } : null;
  };
  const a = resolve(args.focus.entityId), b = resolve(args.focus.nextEntityId);
  if (!a && !b) return { kind: "semanticFocus", targetHz: args.currentHz, bound: false };
  const aa = a ?? b, bb = b ?? a;
  const blend = Math.max(0, Math.min(1, args.focus.blend));
  return { kind: "semanticFocus", targetHz: aa.anchor.frequencyHz + (bb.anchor.frequencyHz - aa.anchor.frequencyHz) * blend, bound: true, semanticNodeId: blend < 0.5 ? aa.binding.semanticNodeId : bb.binding.semanticNodeId, anchorId: blend < 0.5 ? aa.anchor.id : bb.anchor.id };
}
export {
  semanticFocusTarget
};
