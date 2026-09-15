import {
  DEFAULT_COMPOSITION,
  DEFAULT_FORCES,
  DEFAULT_SEQUENCE,
  makeFormation,
  makeLink
} from "./fieldModel.mjs";
import { CHAKRA_PROFILE_ID } from "./semantics/chakraProfile.mjs";
import { makeChakraSemanticField, makeSemanticChakraEntities } from "./semantics/chakraPresets.mjs";
const COMPOSITION_PRESETS = [
  {
    id: "single_glyph",
    name: "Single Glyph Morph",
    description: "One formation morphing O \u21C4 I on the field drive",
    build: () => ({
      entities: [
        makeFormation({
          id: "ent_main",
          name: "Main",
          shape: { kind: "glyph", text: "O" },
          sequence: {
            ...DEFAULT_SEQUENCE,
            links: [makeLink({ kind: "glyph", text: "O" }), makeLink({ kind: "glyph", text: "I" })],
            advance: "time",
            order: "pingpong",
            hold: 0.2,
            transition: 3.8
          }
        })
      ],
      composition: {
        plane: "vertical",
        orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel" },
        layoutName: "Single formation"
      },
      cymatics: { enabled: false }
    })
  },
  {
    id: "chakra_body",
    name: "Chakra Body \xB7 7 centres",
    description: "Seven ordinary yantra formations with independent semantic bindings and spatial colour",
    build: () => {
      const entities = makeSemanticChakraEntities("yantra");
      return {
        entities,
        composition: {
          plane: "vertical",
          orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel", followStation: false },
          entityTintWeight: 0.35,
          layoutName: "Chakra Body"
        },
        cymatics: { enabled: false, followFocus: false },
        semanticField: makeChakraSemanticField(entities, "constant"),
        resonanceDrive: { kind: "frequency" }
      };
    }
  },
  {
    id: "kundalini_focus",
    name: "Kundalini \xB7 travelling focus",
    description: "A travelling focus through semantic chakra bindings; focus may explicitly drive the shared resonator",
    build: () => {
      const entities = makeSemanticChakraEntities("yantra");
      return {
        entities,
        composition: {
          plane: "vertical",
          orchestration: { mode: "focus", order: "listed", dwell: 1.4, glide: 2.4, followStation: false, focusTintWeight: 0 },
          entityTintWeight: 0.25,
          layoutName: "Kundalini"
        },
        cymatics: { enabled: true, dominance: 0.25, followFocus: false },
        semanticField: makeChakraSemanticField(entities, "focus"),
        resonanceDrive: { kind: "semanticFocus", profileId: CHAKRA_PROFILE_ID }
      };
    }
  },
  {
    id: "cymatic_plate",
    name: "Cymatic Plate \xB7 resonator",
    description: "Pure driven plate: geometry emerges from the resonator, sweeping the seven physical anchors",
    build: () => ({
      entities: [
        makeFormation({
          id: "ent_medium",
          name: "Medium",
          shape: { kind: "glyph", text: "\u25CF" },
          forces: { ...DEFAULT_FORCES, mode: "none" },
          tintWeight: 0
        })
      ],
      composition: {
        plane: "horizontal",
        orchestration: { ...DEFAULT_COMPOSITION.orchestration, mode: "parallel" },
        layoutName: "Cymatic plate"
      },
      cymatics: { enabled: true, dominance: 1, autoSweep: true, followFocus: false },
      resonanceDrive: { kind: "sweep" }
    })
  },
  {
    id: "chakra_cymatic",
    name: "Chakra centres over a resonant plate",
    description: "Live modal affinity drives spatial semantic colour while the same entities remain independently physical",
    build: () => {
      const entities = makeSemanticChakraEntities("yantra");
      return {
        entities,
        composition: {
          plane: "vertical",
          orchestration: { mode: "focus", order: "listed", dwell: 2, glide: 3, followStation: false, focusTintWeight: 0 },
          entityTintWeight: 0.2,
          layoutName: "Chakra \xD7 Cymatic"
        },
        cymatics: { enabled: true, dominance: 0.55, autoSweep: false, followFocus: false },
        semanticField: makeChakraSemanticField(entities, "resonanceAffinity"),
        resonanceDrive: { kind: "semanticFocus", profileId: CHAKRA_PROFILE_ID }
      };
    }
  }
];
export {
  COMPOSITION_PRESETS
};
