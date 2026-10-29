/**
 * World's PlaceFacet producer (parent integration, 2026-09-22) — the local
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
 *   3. the consumer reads them (place/world.ts — the relation classes; since
 *      15 Oct the atlas is the one map, packages/live-shell/ui
 *      projections/atlas/provider/suiteReading.ts, tested beside it — the
 *      frame map's place/modes.ts retired with T-PLACES-ONTO-ATLAS), keeping
 *      the factual/mythic relation classes distinct;
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

test("the consumer reads the facets, the georeferenced place carries a point and the unlocated none, and relation classes stay distinct", () => {
  const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: placeReading()});
  assert.equal(payload.spatial.length, 2)
  const londinium = payload.spatial.find(facet => facet.place_ref === "central:wiki:londinium") ?? payload.spatial.find(facet => facet.identity?.place_ref === "central:wiki:londinium")
  assert.ok(londinium?.geometry, "the georeferenced place carries the owner's geometry")
  const avalon = payload.spatial.find(facet => facet !== londinium)
  assert.equal(avalon.geometry, undefined, "the unlocated place is carried without a coordinate")

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
});

test("§41 negative: removing the place source makes the 'place present' observation fail", () => {
  const withPlace = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: placeReading()});
  const available = payload => payload.disclosure.instruments.find(entry => entry.instrument === "place").available
  assert.equal(available(withPlace), true);
  assert.equal((withPlace.spatial ?? []).length, 2);

  // Sever the producer's source: no declaration, no geography relations.
  const withoutPlace = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: bareReading()});
  assert.equal(available(withoutPlace), false, "no place source → place is not present");
  assert.equal((withoutPlace.spatial ?? []).length, 0, "nothing stands for a consumer to draw once the binding is removed");
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

// O-I #746: a stop of a route carries its place in the order (AIKit PlaceFacet.sequence, beside the relation it is a stop of), and the route
// walks its stops in that order. A stop without one (a route written before stops carried an order) walks first, by its validity as before.
const {routeModel, validatePlaceFacet} = {...(await import("../src/techne/m0m5/place/world.ts")), ...(await import("../src/techne/contract.ts"))};
const stop = (ref, lon, extra = {}) => ({place_ref: ref, precision: "approximate", relation: "TRAVELLED_TO", geometry: {type: "point", coordinates: [lon, 10]}, ...extra});

test("a route walks its stops in their order: the place each holds in the order, not the order they were written", () => {
  const route = routeModel([stop("p:c", 3, {sequence: 3}), stop("p:a", 1, {sequence: 1}), stop("p:b", 2, {sequence: 2})]);
  assert.deepEqual(route.stops.map(entry => entry.place_ref), ["p:a", "p:b", "p:c"]);
  assert.deepEqual(route.stops.map(entry => entry.sequence), [1, 2, 3]);
  assert.match(route.note, /order/, "the note says what the order is");
  const joined = routeModel([stop("p:later", 9, {sequence: 1}), stop("p:dated", 8, {valid_from: "0400-01-01"}), stop("p:earlier", 7, {valid_from: "0300-01-01"})]);
  assert.deepEqual(joined.stops.map(entry => entry.place_ref), ["p:earlier", "p:dated", "p:later"],
    "stops without an order walk first by their dates, as before; the stops joined in order follow");
  assert.equal(routeModel([stop("p:a", 1, {sequence: 1})]), null, "one stop is no route");
});

test("the contract carries a stop's order beside its relation, and refuses an order with no relation or no count", () => {
  const errors = label => { const list = []; validatePlaceFacet(label, "place", list); return list };
  assert.deepEqual(errors(stop("p:a", 1, {sequence: 2})), []);
  assert.match(errors({...stop("p:a", 1, {sequence: 2}), relation: undefined}).join(" "), /sequence/, "an order is an order within a relation's route");
  assert.match(errors(stop("p:a", 1, {sequence: 0})).join(" "), /sequence/, "counted from 1");
  assert.match(errors(stop("p:a", 1, {sequence: 1.5})).join(" "), /sequence/);
});
