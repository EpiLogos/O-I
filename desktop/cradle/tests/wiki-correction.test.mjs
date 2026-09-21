/** The correction composer's pure text transformation: one scoped correction
 * becomes one bullet of the reading's current interpretation, never touching
 * the rest of the body, the feedback ledger, or unrelated sections. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {applyCorrection} from "../src/context/wikiCorrection.mjs";

const BODY = `# Working with this ground

intro line

## Current interpretation

- existing bullet

## Correcting this reading

tool text
`;

test("a correction appends one bullet inside the current interpretation section", () => {
  const next = applyCorrection(BODY, "Complete remote-verifiable work; report unavailable hardware as a boundary");
  assert.ok(next.includes("- Complete remote-verifiable work; report unavailable hardware as a boundary"));
  const section = next.split("## Current interpretation")[1].split("## Correcting")[0];
  assert.ok(section.includes("existing bullet"), "existing bullets survive");
  assert.ok(section.indexOf("existing bullet") < section.indexOf("Complete remote"), "the correction lands after existing bullets");
  assert.ok(next.includes("## Correcting this reading"), "later sections survive");
  assert.ok(next.trimEnd().endsWith("tool text"), "later section content is untouched");
});

test("a body without the section gains one at the end", () => {
  const next = applyCorrection("# Just a title\n", "be concise first");
  assert.ok(next.includes("## Current interpretation"));
  assert.ok(next.includes("- be concise first"));
});

test("empty corrections change nothing", () => {
  assert.equal(applyCorrection(BODY, "   "), BODY);
});
