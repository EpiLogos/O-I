/**
 * The M3′ proving reading (issue #216) — the lane's local proving input for
 * the source-backed three-Scene walk.
 *
 * Provenance: composed from the pinned TB0 specimen
 * `fixtures/techne/tb0-connective-base-v1.json` (TB0-1, head 2c704dc) — the
 * SAME real subject, whole, warranted QL facet, temporal facets, places,
 * sources, actions and disclosure, verbatim. Two journey-scene bindings are
 * added beside the specimen's own `…/scene/crossing` binding, named in the
 * specimen's own scene-ref grammar, to give the proving walk its three
 * source-backed scenes; they are composed by this instrument's office
 * (authoring), not attributed to any native owner. TB0-1-only fields the
 * ported TS mirror does not yet carry are omitted (`agency`, relation
 * standing/relation_ref/temporal_facet_ref/evidence_refs, place
 * relation/uncertainty, temporal attempt_ref/return_ref,
 * ql.m_coordinate_ref/return_ref) — the mirror is at the T0 field set and
 * this lane does not privately fork the contract; the gap is recorded on the
 * issue. The tests ground every ref against the canonical specimen file, so
 * a drifted ref fails loudly.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../../contract.ts";

export const PROVING_EXPRESSION = "oi:expression:l5-dual-reading";
export const PROVING_SCENE_GROUND = `${PROVING_EXPRESSION}/scene/ground`;
export const PROVING_SCENE_CROSSING = `${PROVING_EXPRESSION}/scene/crossing`;
export const PROVING_SCENE_RETURN = `${PROVING_EXPRESSION}/scene/return`;
export const PROVING_READING_REF = "ql.techne:reading:fixture:tb0-journey-proving@1";
export const PROVING_SUBJECT_REF =
  "central:source:control:root:Work/Quaternal-Logic/docs/L5-TECHNE-DUAL-READING-LOCK.md";
export const PROVING_CONTEXT_FRAME = "mef:context-frame:CF4";
export const PROVING_VAK_SOURCE = "ql:vak:composition:l5-para-vak";

/** The TB0 specimen's reading, narrowed to the T0 mirror's field set and
 * carrying three scene-bearing Expression bindings. */
export function provingReading(): TechneReading {
  return {
    contract: "ql.techne/v1",
    reading_ref: PROVING_READING_REF,
    snapshot: { revision: null, basis_ref: PROVING_SUBJECT_REF },
    subject: {
      subject_ref: PROVING_SUBJECT_REF,
      native_owner: "central",
      native_revision: null,
      readings: [{ ref: "ql-mef:doc-reading:l5-techne-dual-reading-lock", revision: null }],
      kind: "source",
      standing: "architecture-contract",
    },
    whole: {
      whole_ref: "ql.techne:whole:fixture:l5-techne-contract-ground",
      member_refs: [
        "central:source:control:root:Work/Quaternal-Logic/docs/L5-TECHNE-DUAL-READING-LOCK.md",
        "central:source:control:root:Work/Quaternal-Logic/docs/L5-TECHNE-INSTRUMENT-WAYFINDER.md",
        "central:source:control:root:Work/Quaternal-Logic/docs/integrations/epi-logos/TA-ONTA-VAK-COMPOSITIONAL-EXECUTION-LOCK.md",
        "central:source:control:root:Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-TA-ONTA-AGENT-WORLD-CAPABILITY-MATRIX.md",
        "central:source:control:root:Work/Quaternal-Logic/schemas/techne/ql-techne-reading-v1.schema.json",
        "central:source:control:root:Work/Quaternal-Logic/schemas/techne/ql-techne-session-v1.schema.json",
      ],
      relations: [
        {
          relation: "supersedes",
          from_ref: PROVING_SUBJECT_REF,
          to_ref: "central:source:control:root:Work/Quaternal-Logic/docs/L5-TECHNE-INSTRUMENT-WAYFINDER.md",
          origin: "authored",
          origin_ref: null,
        },
        {
          relation: "companion",
          from_ref: PROVING_SUBJECT_REF,
          to_ref: "central:source:control:root:Work/Quaternal-Logic/docs/integrations/epi-logos/TA-ONTA-VAK-COMPOSITIONAL-EXECUTION-LOCK.md",
          origin: "authored",
          origin_ref: null,
        },
        {
          relation: "INSTANTIATES",
          from_ref: PROVING_SUBJECT_REF,
          to_ref: "ql:vak:composition:l5-para-vak",
          origin: "authored",
          origin_ref: null,
        },
        {
          relation: "implemented-in",
          from_ref: PROVING_SUBJECT_REF,
          to_ref: "central:source:control:root:Work/Quaternal-Logic/schemas/techne/ql-techne-reading-v1.schema.json",
          origin: "recorded",
          origin_ref: "ql-mef:commit:2159c7df8aa8f8db0fbd2fcd800d61feb9b7d0d4",
        },
      ],
      focus_refs: ["central:source:control:root:Work/Quaternal-Logic/schemas/techne/ql-techne-reading-v1.schema.json"],
    },
    ql: {
      address: null,
      shape_ref: "ql:shape:1.0.0:6x6:direct-conjugate",
      constellation_ref: "ql.techne:constellation:fixture:l5-dual-reading",
      lens_ref: "mef:lens:L5@1",
      sublens_ref: null,
      context_frame_ref: PROVING_CONTEXT_FRAME,
      refraction_summary: "The one M′ field read through the L5 office: six deep instruments as M0′–M5′ Technē faces over the 6×6 direct-conjugate shape, with 3:3 Cosmic/Personal as parent readings and Expression as the conjugate 3:3 body.",
      harmonic_reading: null,
      geometric_reading: null,
      vak_source_ref: PROVING_VAK_SOURCE,
      derivation_refs: ["ql:fixture:tb0-dual-reading-derivation"],
      warrant: {
        result_class: "canonical",
        evidence_refs: [
          "central:source:control:root:Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-TA-ONTA-AGENT-WORLD-CAPABILITY-MATRIX.md",
        ],
        provenance_ref: "ql-mef:provider:registry-disclosure",
      },
    },
    temporal: [
      {
        facet_ref: "ql.techne:facet:tb0:authored",
        kind: "occurrence",
        instant: "2026-09-16T00:00:00+01:00",
        precision: "day",
        timezone_policy_ref: "central:source:control:root:Control/user/civil-time-policy.json",
        uncertainty: "the lock records its owner ratification at day precision",
        source_ref: PROVING_SUBJECT_REF,
      },
      {
        facet_ref: "ql.techne:facet:tb0:received",
        kind: "receipt",
        instant: "2026-09-16T17:24:36+01:00",
        precision: "second",
        source_ref: "central:source:control:root:.central/source-change-horizon.json",
        uncertainty: "reconciler-declared receipt of the lock commit on main",
      },
      {
        facet_ref: "ql.techne:facet:tb0:valid",
        kind: "valid",
        interval: { from: "2026-09-16T00:00:00+01:00", to: null, from_precision: "day" },
        uncertainty: "stands until a later owner decision explicitly supersedes the lock",
      },
      {
        facet_ref: "ql.techne:facet:tb0:day",
        kind: "day",
        day_ref: "central:day:control:root:2026-09-16",
        timezone_policy_ref: "central:source:control:root:Control/user/civil-time-policy.json",
      },
      { facet_ref: "ql.techne:facet:tb0:now", kind: "now", now_ref: "central:now:control:root:b417a7c3d37cd47c2762deee3224687d59db1a9015a322e9a8d7584b3947adf6" },
      { facet_ref: "ql.techne:facet:tb0:session", kind: "session", session_ref: "zcode-session-2026-09-16-tb0-connective-base" },
      {
        facet_ref: "ql.techne:facet:tb0:run",
        kind: "run",
        run_ref: "factory:run:01JBD3Z4X7Q9M2A6K4P8T3W5NQ",
        interval: { from: "2026-09-15T09:10:00+01:00", to: "2026-09-15T16:40:00+01:00" },
        uncertainty: "Factory orders by revision, not wall-clock; bounds are the handoff-declared activity window",
      },
    ],
    spatial: [
      {
        place_ref: "place:fixture:royal-observatory-greenwich",
        identity: { names: [{ name: "Royal Observatory, Greenwich", valid_from: "1675", valid_to: null }] },
        geometry: { type: "point", coordinates: [0.0015, 51.4769] },
        precision: "approximate",
        hierarchy: [
          { place_ref: "place:fixture:greenwich", relation: "within", valid_from: "1675", valid_to: null },
          { place_ref: "place:fixture:county-of-london", relation: "within", valid_from: "1889", valid_to: "1965" },
          { place_ref: "place:fixture:greater-london", relation: "within", valid_from: "1965", valid_to: null },
        ],
        valid_from: "1675",
        valid_to: null,
        observer_frame: null,
        source_ref: "aikit:source:fixture:place-gazetteer",
      },
      {
        place_ref: "place:fixture:avalon",
        identity: { names: [{ name: "Avalon", valid_from: null, valid_to: null }] },
        precision: "unlocated",
        hierarchy: [],
        valid_from: null,
        valid_to: null,
        observer_frame: null,
        source_ref: "aikit:source:fixture:myth-gazetteer",
      },
    ],
    provenance: [
      {
        source_ref: PROVING_SUBJECT_REF,
        source_revision: null,
        native_owner: "central",
        selector: { unit: "text_span", start: 0, end: 1200, anchor_ref: null },
        standing: "architecture-contract",
        evidence_refs: [],
      },
      {
        source_ref: "central:source:control:root:Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-TA-ONTA-AGENT-WORLD-CAPABILITY-MATRIX.md",
        source_revision: null,
        native_owner: "central",
        standing: "design-commitment",
        evidence_refs: [],
      },
    ],
    expressions: [
      { expression_ref: PROVING_EXPRESSION, revision: "1", scene_ref: PROVING_SCENE_GROUND, composition_ref: "oi:composition:l5-dual-reading-integral", profile_ref: "oi:expression-profile:l5-techne" },
      { expression_ref: PROVING_EXPRESSION, revision: "1", scene_ref: PROVING_SCENE_CROSSING, composition_ref: "oi:composition:l5-dual-reading-integral", profile_ref: "oi:expression-profile:l5-techne" },
      { expression_ref: PROVING_EXPRESSION, revision: "1", scene_ref: PROVING_SCENE_RETURN, composition_ref: "oi:composition:l5-dual-reading-integral", profile_ref: "oi:expression-profile:l5-techne" },
    ],
    actions: [
      { action_ref: "central.day.read", native_owner: "central/ctrl", authority: "registered-read-action", summary: "Read the owning civil day record.", expected_effects: ["none — read only"], input_schema_ref: null },
      { action_ref: "central.now.read", native_owner: "central/ctrl", authority: "registered-read-action", summary: "Read the root NOW clearing.", expected_effects: ["none — read only"], input_schema_ref: null },
      { action_ref: "oi.expression.open", native_owner: "oi/desktop", authority: "owner-disclosed", summary: "Open the bound Expression and its crossing scene in the Cradle over the same subject refs.", expected_effects: ["an Expression surface opens; no native mutation by itself"], input_schema_ref: null },
      { action_ref: "aikit.wiki.stage", native_owner: "aikit/wiki", authority: "governed-write", summary: "Stage a wiki change for review — the Return leg of the canonical traversal.", expected_effects: ["staged proposal only; no direct mutation of authored ground"], input_schema_ref: null },
    ],
    disclosure: {
      instruments: [
        { instrument: "project", available: true, m_prime: 0, reading: "4:2-deep" },
        { instrument: "canvas", available: true, m_prime: 1, reading: "4:2-deep" },
        { instrument: "timeline", available: true, m_prime: 2, reading: "4:2-deep" },
        { instrument: "journey", available: true, m_prime: 3, reading: "4:2-deep" },
        { instrument: "place", available: true, m_prime: 4, reading: "4:2-deep" },
        { instrument: "palace", available: false, m_prime: 5, reading: "4:2-deep", reason: "no bound integral composition is disclosed for this subject" },
        { instrument: "expressions", available: true, reading: "3:3-conjugate" },
      ],
      degraded: [
        { instrument: "canvas", reason: "a warranted constellation layout is disclosed but no authored presentation view exists yet" },
        { instrument: "place", reason: "the mythic place reading is unlocated by nature; the globe can name it but cannot site it" },
      ],
    },
  };
}
