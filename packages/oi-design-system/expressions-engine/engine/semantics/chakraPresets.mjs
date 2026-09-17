import { CANONICAL_CHAKRAS } from "../chakraSystem.mjs";
import { makeFormation } from "../fieldModel.mjs";
import { CHAKRA_DEFINITIONS } from "./chakraSemantics.mjs";
import { CHAKRA_PROFILE_ID } from "./chakraProfile.mjs";
function makeSemanticChakraEntities(shapeKind = "yantra") {
  return CHAKRA_DEFINITIONS.map((definition) => {
    const legacy = CANONICAL_CHAKRAS.find((c) => c.id === definition.id);
    return makeFormation({
      id: `ent_semantic_${definition.id}`,
      name: definition.name,
      x: legacy.x,
      y: -legacy.y,
      z: 0,
      scale: (legacy.scale ?? 0.2) * 2.4,
      shape: shapeKind === "cymatic" ? { kind: "cymatic", frequencyHz: definition.historicalCorrespondences?.solfeggioHz } : shapeKind === "glyph" ? { kind: "glyph", text: definition.seedSyllable } : { kind: "yantra", yantraId: definition.id },
      forces: {
        mode: "vortex",
        strength: (legacy.attractorStrength ?? 2) * 0.6,
        radius: (legacy.scale ?? 0.2) * 450,
        spin: definition.order % 2 === 0 ? 1.2 : -1.2
      },
      tint: definition.canonicalColor,
      tintWeight: 1
    });
  });
}
function makeChakraSemanticField(entities, activation = "constant") {
  return {
    enabled: true,
    profile: { kind: "chakra", profileId: CHAKRA_PROFILE_ID },
    affinity: { method: "modalProjection", bandwidth: 0.14 },
    globalColorGain: 1,
    bindings: CHAKRA_DEFINITIONS.map((definition) => {
      const entity = entities.find((e) => e.id === `ent_semantic_${definition.id}`) || entities.find((e) => e.name === definition.name);
      return {
        id: `semantic:${definition.id}`,
        semanticNodeId: definition.id,
        enabled: !!entity,
        resonance: { gain: 1 },
        carriers: entity ? [{ kind: "entity", id: entity.id }] : [],
        color: {
          enabled: true,
          colorSource: "canonical",
          gain: 0.85,
          radius: { source: "force" },
          falloff: "gaussian",
          metric: "compositionPlane",
          blend: "weighted",
          activation
        },
        modulations: activation === "focus" ? [
          {
            source: { kind: "focus" },
            target: "color.gain",
            amount: 0.8,
            offset: 1,
            clamp: [1, 1.8]
          }
        ] : void 0
      };
    })
  };
}
export {
  makeChakraSemanticField,
  makeSemanticChakraEntities
};
