/**
 * The M4′ PlaceFacet producer (parent integration, 2026-09-22) — the local
 * spatial producer gate G3 of the L5 Technē Instrument Wayfinder recorded
 * missing. Unit proofs that it derives REAL ql.techne/v1 spatial facets from
 * what a register's wiki ground actually discloses, and NOTHING when it does
 * not (the map's law §18: "A truly absent spatial facet stays absent"):
 *
 *   1. a hard geography relation (GEOGRAPHY_RELATIONS) and a declared place
 *      each become a facet — the native relation preserved verbatim, the
 *      owner's geometry/precision/names/validity carried verbatim; the
 *      georeferenced historical case and the unlocated mythic case both stand
 *      (gate G3's two required spatial cases);
 *   2. the payload emits `spatial`, validates against the contract, and
 *      discloses `place` available;
 *   3. the consumer (place/modes.ts, place/world.ts) reads them as present,
 *      projects the georeferenced point and slots the unlocated place, and
 *      keeps the factual/mythic relation classes distinct;
 *   4. honest absence — no place data → no `spatial`, place unavailable with
 *      its real reason, the aperture empty;
 *   5. §41 negative — removing the producer's source (the declaration and the
 *      geography relations) makes the "place present" observation fail: the
 *      producer→reading→consumer binding is load-bearing, not decorative;
 *   6. no fabrication — a declaration with no geometry stays "unlocated", and
 *      coordinates and uncertainty are never invented.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-place-facets.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {wikiReadingPayload} = await import("../src/techne/wikiReadingProvider.ts");
const {placeFacetsFromReading} = await import("../src/techne/placeFacets.ts");
const {validateReading} = await import("../src/techne/contract.ts");
const {placeState, renderMapModel} = await import("../src/techne/m0m5/place/modes.ts");
const {placeRelations, relationStandingClass} = await import("../src/techne/m0m5/place/world.ts");

const REGISTER = {key: "central", title: "Central"};
const SUBJECT = {ref: "wiki:central", kind: "wiki-register", title: "Central"};

/** A register reading carrying real place ground: a declared, georeferenced,
 * temporally-valid historical place reached by OCCURRED_AT, and a place
 * reached only by the mythic relation (no declaration → unlocated). */
const placeReading = (overrides = {}) => ({
  state: "ready",
  register: REGISTER,
  wiki: {
    state: "ready",
    spaces: [{object: "space", ref: "central:wiki:root", title: "Central"}],
    nodes: [
      {object: "node", ref: "central:wiki:battle", title: "The Battle"},
      {object: "node", ref: "central:wiki:londinium", title: "Londinium", type: "place", place: {
        geometry: {type: "point", coordinates: [-0.09, 51.51]},
        precision: "exact",
        names: [{name: "Londinium", valid_from: "0047", valid_to: "0410"}],
        valid_from: "0047", valid_to: "0410",
      }},
      {object: "node", ref: "central:wiki:avalon", title: "Avalon"},
    ],
    constellations: [],
  },
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "central.content-fnv1a64/v1:1:test", location: {root: "central", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "available", focusRef: "central:wiki:root", edges: [
    {relation: "OCCURRED_AT", from: "central:wiki:battle", to: "central:wiki:londinium", provider: "wiki", authority: null, revision: "r1"},
    {relation: "MYTH_LOCATED_AT", from: "central:wiki:battle", to: "central:wiki:avalon", provider: "wiki", authority: null, revision: null},
  ], truncated: false, warnings: []},
  ...overrides,
});

/** The same register with NO place ground: one node, only a wiki:child link. */
const bareReading = () => ({
  state: "ready",
  register: REGISTER,
  wiki: {state: "ready", spaces: [{object: "space", ref: "central:wiki:root", title: "Central"}],
    nodes: [{object: "node", ref: "central:wiki:battle", title: "The Battle"}], constellations: []},
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "central.content-fnv1a64/v1:1:test", location: {root: "central", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "available", focusRef: "central:wiki:root", edges: [
    {relation: "wiki:child", from: "central:wiki:root", to: "central:wiki:battle", provider: null, authority: null, revision: "r9"},
  ], truncated: false, warnings: []},
});

test("the producer derives real facets from a declared place and a hard geography relation, verbatim", () => {
  const facets = placeFacetsFromReading(placeReading());
  assert.equal(facets.length, 2, JSON.stringify(facets));

  const londinium = facets.find(facet => facet.place_ref === "central:wiki:londinium");
  assert.ok(londinium, "the georeferenced historical place is present");
  assert.equal(londinium.relation, "OCCURRED_AT", "the native relation is preserved verbatim");
  assert.equal(londinium.precision, "exact", "the owner's precision is carried verbatim");
  assert.deepEqual(londinium.geometry, {type: "point", coordinates: [-0.09, 51.51]});
  assert.equal(londinium.identity.names[0].name, "Londinium");
  assert.equal(londinium.identity.names[0].valid_from, "0047");
  assert.equal(londinium.valid_to, "0410");
  assert.equal(londinium.source_ref, "central:source:Control/agents/wiki/wiki.json");

  const avalon = facets.find(facet => facet.place_ref === "central:wiki:avalon");
  assert.ok(avalon, "the relation-reached place is present");
  assert.equal(avalon.relation, "MYTH_LOCATED_AT", "the mythic relation is preserved verbatim");
  assert.equal(avalon.precision, "unlocated", "no coordinate is invented for a relation-only place");
  assert.equal(avalon.geometry, undefined, "no geometry is manufactured");
  assert.equal(avalon.identity.names[0].name, "Avalon", "the target node's title stands as its name");
});

test("the payload emits spatial, validates against the contract, and discloses place available", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: placeReading()});
  const checked = validateReading(payload);
  assert.ok(checked.valid, `payload drifted: ${checked.errors?.join("; ")}`);
  assert.equal(payload.spatial.length, 2);
  const place = payload.disclosure.instruments.find(entry => entry.instrument === "place");
  assert.equal(place.available, true, "place discloses available when a real facet stands");
  assert.equal(place.reason, undefined, "an available instrument names no absence reason");
});

test("the consumer reads the facets as present, projects the point, slots the unlocated place, and keeps relation classes distinct", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: placeReading()});
  const state = placeState(payload);
  assert.equal(state.status, "present");
  assert.equal(state.facets.length, 2);

  const model = renderMapModel(payload.spatial);
  assert.equal(model.projection.places.length, 2);
  const londinium = model.projection.places.find(place => place.place_ref === "central:wiki:londinium");
  assert.equal(londinium.shape, "point", "the georeferenced place projects to a real point");
  const avalon = model.projection.places.find(place => place.place_ref === "central:wiki:avalon");
  assert.equal(avalon.shape, "none", "the unlocated place is slotted, not given a coordinate");

  const groups = placeRelations(payload.spatial);
  assert.equal(groups.length, 2, "the two native relations stay distinct groups");
  assert.equal(relationStandingClass("OCCURRED_AT"), "factual");
  assert.equal(relationStandingClass("MYTH_LOCATED_AT"), "mythic");
});

test("honest absence — no place ground leaves place unavailable and omits spatial (the map's law §18)", () => {
  assert.deepEqual(placeFacetsFromReading(bareReading()), []);
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: bareReading()});
  const checked = validateReading(payload);
  assert.ok(checked.valid, `payload drifted: ${checked.errors?.join("; ")}`);
  assert.equal(payload.spatial, undefined, "no spatial key when the ground carries no place");
  const place = payload.disclosure.instruments.find(entry => entry.instrument === "place");
  assert.equal(place.available, false);
  assert.match(place.reason, /no spatial facets/);
  assert.equal(placeState(payload).status, "unavailable");
});

test("§41 negative: removing the place source makes the 'place present' observation fail", () => {
  const withPlace = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: placeReading()});
  assert.equal(placeState(withPlace).status, "present");
  assert.equal(renderMapModel(withPlace.spatial ?? []).projection.places.length, 2);

  // Sever the producer's source: no declaration, no geography relations.
  const withoutPlace = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: bareReading()});
  assert.notEqual(placeState(withoutPlace).status, "present", "no place source → the aperture is not present");
  assert.equal(renderMapModel(withoutPlace.spatial ?? []).projection.places.length, 0, "nothing renders once the binding is removed");
});

test("no fabrication — a declared place with no geometry stays unlocated; coordinates and uncertainty are never invented", () => {
  const reading = placeReading({
    wiki: {state: "ready", spaces: [{object: "space", ref: "central:wiki:root", title: "Central"}],
      nodes: [{object: "node", ref: "central:wiki:eden", title: "Eden", type: "place", place: {names: [{name: "Eden"}]}}],
      constellations: []},
    relations: {state: "available", focusRef: "central:wiki:root", edges: [], truncated: false, warnings: []},
  });
  const facets = placeFacetsFromReading(reading);
  assert.equal(facets.length, 1);
  const eden = facets[0];
  assert.equal(eden.place_ref, "central:wiki:eden");
  assert.equal(eden.precision, "unlocated", "no geometry declared → unlocated, never upgraded");
  assert.equal(eden.geometry, undefined, "no coordinate manufactured");
  assert.equal(eden.uncertainty, undefined, "uncertainty is never invented");
  assert.equal(eden.relation, undefined, "a declared place asserts no relation of its own");
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading});
  assert.ok(validateReading(payload).valid);
  assert.equal(payload.disclosure.instruments.find(entry => entry.instrument === "place").available, true);
});
