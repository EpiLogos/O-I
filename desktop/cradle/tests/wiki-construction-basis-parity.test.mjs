// The register-basis guard in constructionProjection.ts's constructionWhole
// compares a frame/relation decoded straight from the on-disk Wiki register
// (decodeRegister, construction.ts) against the frame/relation returned by
// the native `aikit.constellation.apply`/`read` response (SavedConstruction
// .reading.frame / .relations — never round-tripped through the file). The
// register's raw JSON rows carry their own row-type discriminator (`object:
// "frame"` / `object: "edge"`) so a mixed array can be parsed; the native
// reading projection never carries that key. Before this fix, decodeRegister
// pushed the raw row verbatim, so `sameComposition(decoded, reading)` judged
// an UNCHANGED, just-saved constellation as mismatched purely on the
// presence of that one storage-only key — refusing "Open live composition"
// immediately after every successful save (techne-construction-join.mjs).
import test from "node:test";
import assert from "node:assert/strict";

import {decodeRegister, CONSTRUCTION, PARTICIPATION, RELATION} from "../src/knowledge/construction.ts";
import {sameComposition} from "../src/knowledge/constructionProjection.ts";

const frameRef = "wiki:frame:test-1";
const participationA = "participation:wiki:a";
const participationB = "participation:wiki:b";
const relationRef = "wiki:relation:test-1";

function nativeFrame() {
  return {
    ref: frameRef,
    revision: 1,
    constellations: [{
      anchor_ref: "wiki:anchor:test-1",
      members: [
        {ref: "source:a", conjugate: false, [PARTICIPATION]: {participation_ref: participationA, role_ref: null, sources: [{source_ref: "source:a", source_revision: "r1"}], note: "first"}},
        {ref: "source:a", conjugate: false, [PARTICIPATION]: {participation_ref: participationB, role_ref: null, sources: [{source_ref: "source:a", source_revision: "r1"}], note: "second"}},
      ],
      returns: [],
    }],
    [CONSTRUCTION]: {title: "Inquiry", inquiry: {question: "Why?"}, relation_refs: [relationRef]},
  };
}
function nativeRelation() {
  return {
    ref: relationRef, revision: 1, from_ref: "source:a", to_ref: "source:a", relation: "qualifies",
    [RELATION]: {from_participation_ref: participationA, to_participation_ref: participationB, direction: "directed", standing: "proposed", evidence: []},
  };
}
function registerFile() {
  const objects = [
    {object: "frame", ...nativeFrame()},
    {object: "edge", ...nativeRelation()},
  ];
  return {schema: "central.file-reading/v1", location: {schema: "central.path-ref/v1", ref: "ref:x", root: "/r", path: "wiki.json"}, revision: "rev-1", byte_len: 0, content_encoding: "utf-8", content: JSON.stringify({objects}), project: null, source: null, automatic_agent_or_model_invocation: false};
}

test("decodeRegister strips the register's own row-type discriminator from frames", () => {
  const {frames} = decodeRegister(registerFile(), "source_ref");
  assert.equal(frames.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(frames[0], "object"), false, "the decoded frame must not carry the raw row's `object` discriminator");
  assert.equal(frames[0].ref, frameRef);
});

test("decodeRegister strips the row-type discriminator from relations", () => {
  const {relations} = decodeRegister(registerFile(), "source_ref");
  assert.equal(relations.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(relations[0], "object"), false, "the decoded relation must not carry the raw row's `object` discriminator");
  assert.equal(relations[0].ref, relationRef);
});

test("a just-saved frame from the native reading compares equal to the same frame decoded from the register (the exact basis check constructionWhole runs)", () => {
  const {frames} = decodeRegister(registerFile(), "source_ref");
  // What `aikit.constellation.apply`/`read` actually return as `reading.frame`
  // — the same content, but never carrying the register's row discriminator.
  const nativeReadingFrame = nativeFrame();
  assert.equal(sameComposition(frames[0], nativeReadingFrame), true, "an unchanged, just-saved frame must not be judged as a mismatched basis");
});

test("a genuinely changed frame still compares unequal", () => {
  const {frames} = decodeRegister(registerFile(), "source_ref");
  const changed = nativeFrame();
  changed[CONSTRUCTION].title = "A different title";
  assert.equal(sameComposition(frames[0], changed), false, "a real content change must still be caught");
});
