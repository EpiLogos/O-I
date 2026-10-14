// Palace integral whole (lane-5 T14, T16, T17, T18) — the pure model the
// mounted Palace draws from: the reading's real facets as integral regions,
// the guided path's derived edges (broken and self named, never hidden), the
// open route (wired or refused by name), the integral walk with wrap and
// resume, and each region's own standing (warranted, owner or free).
import test from "node:test";
import assert from "node:assert/strict";

import {validateReading} from "../../../src/techne/contract.ts";
import {
  palaceWholeView,
  palaceGuidedEdges,
  palaceOpenRoute,
  palaceWalkSteps,
  palaceWalkAt,
  palaceWalkResume,
  palaceRegionOpenRoute,
  SCENE_REGION_STANDING,
} from "../src/palaceWhole.ts";
import {recallOver} from "../../../src/techne/m0m5/palace/recall.ts";

const ANCHOR = "oi.expression:palace";

const DISCLOSURE = (palaceAvailable, palaceReason) => ({
  instruments: [
    {instrument: "project", available: true, m_prime: 0, reading: "4:2-deep"},
    {instrument: "canvas", available: true, m_prime: 1, reading: "4:2-deep"},
    {instrument: "timeline", available: true, m_prime: 2, reading: "4:2-deep"},
    {instrument: "journey", available: true, m_prime: 3, reading: "4:2-deep"},
    {instrument: "place", available: true, m_prime: 4, reading: "4:2-deep"},
    palaceAvailable
      ? {instrument: "palace", available: true, m_prime: 5, reading: "4:2-deep"}
      : {instrument: "palace", available: false, reason: palaceReason, m_prime: 5, reading: "4:2-deep"},
    {instrument: "expressions", available: true, reading: "3:3-conjugate"},
  ],
  application_cuts: [{cut: "4:2-deep", available: true}],
  degraded: [],
  suggestions: [],
});

/** A reading that discloses every M′ family the integral whole can compose. */
const FULL = {
  contract: "ql.techne/v1",
  reading_ref: "ql.techne:reading:palace-whole",
  snapshot: {revision: "rev-3", basis_ref: null},
  subject: {subject_ref: "wiki:node:alpha", native_owner: "aikit", kind: "wiki-node"},
  whole: {
    whole_ref: "wiki:constellation:alpha",
    member_refs: ["wiki:node:alpha", "wiki:node:beta"],
    relations: [],
    focus_refs: [],
  },
  ql: {
    address: "M3.2",
    shape_ref: "shape:alpha",
    constellation_ref: "constellation:alpha",
    warrant: {result_class: "canonical", evidence_refs: ["ev:1"], provenance_ref: "prov:derivation-7"},
  },
  temporal: [{facet_ref: "t:1", kind: "day", day_ref: "day:2026-09-19", precision: "day"}],
  spatial: [{place_ref: "place:here", precision: "region", identity: {names: [{name: "Here"}]}}],
  provenance: [{source_ref: "central:source:probe", native_owner: "central"}],
  expressions: [
    {expression_ref: "oi.expression:probe", revision: "7", scene_ref: "oi.expression:probe:scene:one"},
  ],
  actions: [{action_ref: "oi.probe.action", native_owner: "aikit", authority: "owner"}],
  disclosure: DISCLOSURE(false, "the reading names no unclaimed composition"),
};

const SPARSE = {
  ...FULL,
  reading_ref: "ql.techne:reading:sparse",
  whole: undefined,
  ql: undefined,
  temporal: undefined,
  spatial: undefined,
  provenance: undefined,
  expressions: [{expression_ref: "oi.expression:probe", revision: "7", scene_ref: "oi.expression:probe:scene:one"}],
};

const EMPTY = {
  ...SPARSE,
  reading_ref: "ql.techne:reading:empty",
  expressions: [],
  disclosure: DISCLOSURE(false, "the reading names no unclaimed composition"),
};

test("fixtures satisfy the Technè reading contract", () => {
  for (const reading of [FULL, SPARSE, EMPTY]) {
    const result = validateReading(JSON.parse(JSON.stringify(reading)));
    assert.equal(result.valid, true, `${reading.reading_ref}: ${JSON.stringify(result.errors ?? result)}`);
  }
});

// ---- T14: the integral whole composes the reading's real facets -----------

test("T14: the integral whole shows every disclosed facet family in M0'→M5' order, each ref verbatim", () => {
  const view = palaceWholeView(FULL);
  assert.equal(view.available, true);
  assert.deepEqual(
    view.regions.map((region) => region.key),
    ["ground", "canvas", "relation", "journey", "world", "expression", "sources"],
  );
  const ground = view.regions.find((region) => region.key === "ground");
  assert.deepEqual(
    ground.entries.map((entry) => entry.ref),
    ["wiki:constellation:alpha", "wiki:node:alpha", "wiki:node:beta"],
  );
  const canvas = view.regions.find((region) => region.key === "canvas");
  assert.deepEqual(canvas.entries.map((entry) => entry.ref), ["constellation:alpha", "shape:alpha", "M3.2"]);
  const world = view.regions.find((region) => region.key === "world");
  assert.equal(world.entries[0].ref, "place:here");
  assert.equal(world.entries[0].label, "Here");
});

test("T14: a facet-less region is absent — no placeholder region, no invented beat or source", () => {
  const view = palaceWholeView(SPARSE);
  assert.equal(view.available, true);
  assert.deepEqual(
    view.regions.map((region) => region.key),
    ["journey", "expression"],
    "only the bound Scene and the Expression exist; ground, canvas, relation, world and sources are absent",
  );
  assert.equal(view.regions.some((region) => region.entries.length === 0), false);
});

test("T14: a reading with no composable facet is unavailable with the reading's own reason", () => {
  const view = palaceWholeView(EMPTY);
  assert.equal(view.available, false);
  assert.deepEqual(view.regions, []);
  assert.equal(view.reason, "the reading names no unclaimed composition");
});

test("T14: no reading yet is an honest absence, not an error", () => {
  const view = palaceWholeView(null);
  assert.equal(view.available, false);
  assert.equal(view.regions.length, 0);
  assert.equal(view.reason, null);
});

// ---- T16: objects stay independently addressable, with honest connections --

test("T16: the guided path derives its edges from the region order, naming gap, broken and self honestly", () => {
  const regions = [
    {name: "A", member_ref: "oi.expression:x"},
    {name: "B", member_ref: "oi.expression:gone"},
    {name: "C", member_ref: null},
    {name: "D", member_ref: ANCHOR},
  ];
  const live = new Set(["oi.expression:x", "oi.expression:y"]);
  const {start, edges} = palaceGuidedEdges(regions, ANCHOR, live);
  assert.equal(start, "A", "the first region is the named start of the guided path");
  assert.deepEqual(
    edges.map((edge) => [edge.from, edge.to, edge.kind]),
    [
      ["A", "B", "broken"],
      ["B", "C", "gap"],
      ["C", "D", "self"],
    ],
  );
  assert.match(edges[0].reason, /no longer disclosed/);
  assert.match(edges[2].reason, /this Palace's own Expression/);
});

test("T16: with the live list not yet known, a filled member draws as a plain path edge", () => {
  const regions = [{name: "A", member_ref: "oi.expression:x"}, {name: "B", member_ref: "oi.expression:gone"}];
  const {edges} = palaceGuidedEdges(regions, ANCHOR, null);
  assert.deepEqual(edges.map((edge) => edge.kind), ["path"]);
});

test("T16: reordering the guided path re-derives the drawn path with no re-authoring", () => {
  const before = [
    {name: "A", member_ref: "oi.expression:x"},
    {name: "B", member_ref: "oi.expression:y"},
    {name: "C", member_ref: "oi.expression:x"},
  ];
  const reordered = [before[2], before[0], before[1]];
  const live = new Set(["oi.expression:x", "oi.expression:y"]);
  const after = palaceGuidedEdges(reordered, ANCHOR, live);
  assert.equal(after.start, "C");
  assert.deepEqual(after.edges.map((edge) => [edge.from, edge.to]), [["C", "A"], ["A", "B"]]);
  assert.deepEqual(after.edges.map((edge) => edge.kind), ["path", "path"]);
});

test("T16: an entry opens through the expression instrument; an unwired instrument is refused by name", () => {
  const wired = new Set(["expressions"]);
  const expression = palaceWholeView(FULL).regions.find((region) => region.key === "expression").entries[0];
  assert.deepEqual(palaceOpenRoute(expression, wired), {
    kind: "open",
    instrument: "expressions",
    ref: "oi.expression:probe",
  });
  const journey = palaceWholeView(FULL).regions.find((region) => region.key === "journey").entries[0];
  const refused = palaceOpenRoute(journey, wired);
  assert.equal(refused.kind, "refused");
  assert.match(refused.reason, /journey/);
  assert.match(refused.reason, /not wired/);
});

test("T16: an entry with no instrument surface says its depth stays in the palace", () => {
  // lane-5 T24 changes provenance: a sources entry opens the source surface (see the T24 tests in palace-bookmarks.test.mjs).
  // What stays refused by name is an entry with no instrument surface that is not provenance.
  const source = palaceWholeView(FULL).regions.find((region) => region.key === "sources").entries[0];
  assert.deepEqual(palaceOpenRoute(source, new Set(["expressions"])), {kind: "source", ref: source.ref});
  const agency = {kind: "agency", ref: "agent:x", label: "agent", open_instrument: null};
  const refused = palaceOpenRoute(agency, new Set(["expressions"]));
  assert.equal(refused.kind, "refused");
  assert.match(refused.reason, /stays in the palace/);
});

test("T16: a saved region whose member is missing is a named-but-missing reference, drawn broken; an unsaved empty region is a gap", () => {
  const regions = [
    {name: "A", member_ref: "oi.expression:x", saved: true},
    {name: "B", member_ref: null, saved: true},
    {name: "C", member_ref: null, saved: false},
  ];
  const live = new Set(["oi.expression:x"]);
  const {edges} = palaceGuidedEdges(regions, ANCHOR, live);
  assert.deepEqual(edges.map((edge) => [edge.from, edge.to, edge.kind]), [["A", "B", "broken"], ["B", "C", "gap"]]);
  assert.match(edges[0].reason, /reference is broken/);
  assert.match(edges[1].reason, /gap/);
});

test("T16: a board card's Open routes its member to the expression instrument, and refuses what it cannot honestly open", () => {
  const live = new Set(["oi.expression:x"]);
  const open = palaceRegionOpenRoute("Gate", {expression_ref: "oi.expression:x"}, ANCHOR, live);
  assert.deepEqual(open, {kind: "open", instrument: "expressions", ref: "oi.expression:x"}, "the member's own ref travels verbatim");
  const empty = palaceRegionOpenRoute("Gate", null, ANCHOR, live);
  assert.equal(empty.kind, "refused");
  assert.match(empty.reason, /holds no Expression to open yet/);
  const self = palaceRegionOpenRoute("Gate", {expression_ref: ANCHOR}, ANCHOR, live);
  assert.equal(self.kind, "refused");
  assert.match(self.reason, /self reference/);
  const broken = palaceRegionOpenRoute("Gate", {expression_ref: "oi.expression:gone"}, ANCHOR, live);
  assert.equal(broken.kind, "refused");
  assert.match(broken.reason, /no longer disclosed/);
  assert.equal(palaceRegionOpenRoute("Gate", {expression_ref: "oi.expression:gone"}, ANCHOR, null).kind, "open", "with the live list unknown, nothing is called broken");
});

// ---- T17: the guided integral walk — method of loci over the whole ---------

test("T17: the walk visits every occupied locus of the whole in order from the named start, and wraps", () => {
  const steps = palaceWalkSteps(FULL);
  const refs = steps.map((step) => step.ref);
  assert.equal(steps.length, 3 + 3 + 1 + 1 + 1 + 1 + 1, "ground(3) canvas(3) relation(1) journey(1) world(1) expression(1) sources(1)");
  assert.equal(palaceWalkAt(steps, 0).step.ref, refs[0], "the walk starts at the palace's named start locus");
  let index = 0;
  const visited = [];
  for (let turn = 0; turn < steps.length; turn += 1) {
    visited.push(palaceWalkAt(steps, index).step.ref);
    index = palaceWalkAt(steps, index + 1).index;
  }
  assert.deepEqual(visited, refs, "every locus once, in walk order");
  assert.equal(palaceWalkAt(steps, steps.length).index, 0, "the walk wraps at the end");
  assert.equal(palaceWalkAt(steps, -1).index, steps.length - 1, "the walk wraps before the start");
});

test("T17: an empty whole focuses nothing", () => {
  const steps = palaceWalkSteps(EMPTY);
  assert.deepEqual(steps, []);
  const focused = palaceWalkAt(steps, 4);
  assert.equal(focused.step, null);
  assert.equal(focused.index, 0);
});

test("T17: leaving mid-walk and returning resumes at the same locus, wrapped into a walk that changed size", () => {
  assert.equal(palaceWalkResume(undefined, 5), 0, "a first visit starts at the named start");
  assert.equal(palaceWalkResume(2, 5), 2, "the same locus is recovered on return");
  assert.equal(palaceWalkResume(4, 2), 0, "a walk that shrank is clamped, never invented");
  assert.equal(palaceWalkResume(3, 0), 0, "an empty walk stands at nothing");
});

test("T17: the integral walk's normalisation is recall.ts's own, so the board and the walk can never disagree on a locus", () => {
  const steps = palaceWalkSteps(FULL);
  const refs = steps.map((step) => step.ref);
  const loci = steps.map((step) => step.locus);
  for (let index = -steps.length - 2; index <= steps.length * 2 + 2; index += 1) {
    assert.equal(palaceWalkAt(steps, index).index, recallOver(refs, loci, index).index, `index ${index}`);
  }
});

// ---- T18: archaeology honesty on every region ------------------------------

test("T18: a QL-warranted canvas region states its warrant class and provenance ref", () => {
  const canvas = palaceWholeView(FULL).regions.find((region) => region.key === "canvas");
  assert.equal(canvas.standing.standing, "warranted");
  assert.equal(canvas.standing.warrant_class, "canonical");
  assert.equal(canvas.standing.provenance_ref, "prov:derivation-7");
  assert.match(canvas.standing.line, /canonical/);
  assert.match(canvas.standing.line, /prov:derivation-7/);
});

test("T18: a region with no warranted structure says plainly that it is free mnemonic composition", () => {
  const world = palaceWholeView(FULL).regions.find((region) => region.key === "world");
  assert.equal(world.standing.standing, "free");
  assert.match(world.standing.line, /^free mnemonic composition/);
  assert.equal(world.standing.warrant_class, null);
  assert.equal(world.standing.provenance_ref, null);
});

test("T18: a hand-arranged Scene region is free composition, never dressed as warranted", () => {
  assert.equal(SCENE_REGION_STANDING.standing, "free");
  assert.match(SCENE_REGION_STANDING.line, /^free mnemonic composition/);
  assert.equal(SCENE_REGION_STANDING.warrant_class, null);
});

test("T18: a region that composes an Expression owner's composition states that standing, not QL", () => {
  const owned = {
    ...FULL,
    expressions: [{expression_ref: "oi.expression:probe", revision: "7", composition_ref: "oi.composition:probe"}],
  };
  const expression = palaceWholeView(owned).regions.find((region) => region.key === "expression");
  assert.equal(expression.standing.standing, "owner");
  assert.match(expression.standing.line, /Expression owner's own composition/);
});
