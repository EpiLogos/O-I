// The essay adapter's pure half, run against a real built essay edition (not a fixture).
// OI_ESSAY_EDITION=<dir holding static/fieldIndex.json, quartz-source.json, expressions/index.json>
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-essay-model.test.mjs
// Without a built edition the suite SKIPS and says so; it is never green by default.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {buildEssayModel, essayHead, essayPager, slugOfVaultPath, expressionRef, DEFAULT_ADDRESSING} from "../src/field/epi/essayModel.ts";
import {CorpusIndex} from "../src/field/corpusIndex.ts";
import {parseSourceRef, sourceRef} from "../src/field/source.ts";

const dir = process.env.OI_ESSAY_EDITION;
const have = dir && existsSync(join(dir, "static/fieldIndex.json"));
const T = (name, fn) => test(name, {skip: have ? false : "OI_ESSAY_EDITION is not set to a built essay edition"}, fn);
const load = () => {
  const fi = JSON.parse(readFileSync(join(dir, "static/fieldIndex.json"), "utf8"));
  const rc = JSON.parse(readFileSync(join(dir, "quartz-source.json"), "utf8"));
  const xi = JSON.parse(readFileSync(join(dir, "expressions/index.json"), "utf8"));
  const model = buildEssayModel(fi, rc, xi);
  return {fi, rc, xi, model, index: new CorpusIndex(model.data)};
};

test("source refs follow the Source Change Horizon grammar and round-trip", () => {
  const ref = sourceRef("project:example", "a b/c:d%e.md");
  assert.equal(ref, "central:source:project:example:a%20b/c%3Ad%25e.md");
  assert.deepEqual(parseSourceRef(ref), {world: "project:example", path: "a b/c:d%e.md"});
  assert.equal(parseSourceRef("not-a-ref"), undefined);
});

test("the vault path → page slug rule matches Quartz for README and folder indexes", () => {
  assert.equal(slugOfVaultPath("README.md"), "index");
  assert.equal(slugOfVaultPath("section-rooms/arguments/concepts/index.md"), "section-rooms/arguments/concepts/index");
  assert.equal(slugOfVaultPath("a b & c.md"), "a-b--and--c");
});

T("every page of the edition gets a native ref and a pinned revision; no slug or ordinal is an identity", () => {
  const {fi, model, index} = load();
  assert.equal(index.nodes.length, fi.nodes.length);
  assert.equal(new Set(index.nodes.map(n => n.ref)).size, fi.nodes.length, "refs are unique");
  const withoutRevision = index.nodes.filter(n => !n.revision);
  assert.equal(withoutRevision.length, 0, "every page is in the source receipt: " + withoutRevision.slice(0, 3).map(n => n.path));
  for (const n of index.nodes) {
    assert.ok(n.ref.startsWith("central:source:" + DEFAULT_ADDRESSING.world + ":" + DEFAULT_ADDRESSING.prefix), n.ref);
    assert.match(n.revision, /^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(model.slugOf.size, fi.nodes.length);
});

T("links, the tree and the Expression layer survive translation exactly", () => {
  const {fi, model, index} = load();
  let kept = 0;
  const seen = new Set(); for (const [a, b] of fi.links) { if (a !== b && !seen.has(a + ">" + b)) { seen.add(a + ">" + b); kept++; } }
  const counted = index.nodes.reduce((n, node) => n + index.rawCounts(node.ref).cites, 0);
  assert.equal(counted, kept);
  const leaves = []; const walk = f => { if (f.ref) leaves.push(f.ref); f.children.forEach(walk); }; walk(index.tree);
  assert.ok(leaves.length > 900 && leaves.every(r => index.has(r)), "every tree row names a page");
  assert.equal(Object.keys(model.data.expressionsOf).length, Object.keys(fi.x).length);
  for (const refs of Object.values(model.data.expressionsOf)) for (const r of refs) assert.match(r, /^expression:/);
});

T("the manuscript is one sequence of 48 movements; a movement is its own position", () => {
  const {index} = load();
  assert.equal(index.sequences.length, 1);
  const seq = index.sequences[0];
  assert.equal(seq.items.length, 48);
  assert.equal(seq.items[15].span, "M16");
  assert.equal(index.node(seq.items[15].ref).label, "The Crossed Zero");
  assert.equal(index.focusFor(seq.ref, "M16"), seq.items[15].ref, "the graph focus follows the reading position");
  assert.equal(index.focusFor(seq.ref, undefined), seq.ref);
  assert.equal(index.sequenceAt(seq.items[15].ref).at.span, "M16");
  assert.equal(index.sequenceAt(seq.ref).at, null);
});

T("neighbours: hubs are left out unless asked; a hub page keeps its own", () => {
  const {index} = load();
  const m16 = index.sequences[0].items[15].ref;
  const without = index.neighbours(m16, false), withHubs = index.neighbours(m16, true);
  assert.ok(withHubs.all.length >= without.all.length);
  assert.ok(without.all.every(r => !index.node(r).hub));
  assert.ok(without.out.length > 0 && without.in.length > 0);
});

T("the article head, the pager and the breadcrumb path come from the edition's own structure", () => {
  const {model, index} = load();
  const m16 = index.sequences[0].items[15].ref;
  const head = essayHead(model, index, m16);
  assert.equal(head.title, "The Crossed Zero");
  assert.deepEqual(head.eyebrow, ["§1", "Movement 16 of 48"]);
  assert.ok(head.meta[2].startsWith("cites "));
  const pager = essayPager(model, index, m16);
  assert.equal(pager.prev.sub, "← Movement 15");
  assert.equal(pager.next.sub, "Movement 17 →");
  const path = index.pathOf(m16).map(f => f.label);
  assert.deepEqual(path.slice(0, 2), ["Essay", "Section-rooms"]);
  assert.equal(path[path.length - 1], "The Crossed Zero");
});

T("search answers from titles and paths at once, and ranks pages that name the term first", () => {
  const {index} = load();
  const {hits} = index.search("crossed zero");
  assert.ok(hits.length > 0);
  // the site's own ranking: a title that *starts* with the phrase leads, the movement of that name follows
  assert.ok(index.node(hits[0].ref).label.includes("Crossed Zero"));
  assert.ok(hits.slice(0, 5).some(h => index.node(h.ref).label === "The Crossed Zero"));
  assert.equal(index.search("śūnya").hits.length, index.search("sunya").hits.length, "diacritics fold");
  assert.equal(index.search("").hits.length, 0);
});

T("Expressions are about pages by native ref; the first vertical's Expression is a member of the collection", () => {
  const {model, index} = load();
  const room2 = [...model.raw.entries()].find(([, n]) => n.s.startsWith("section-rooms/02-return-of-zero/ROOM-"))[0];
  assert.ok(index.expressionsOf(room2).includes(expressionRef("roz-room-02-return-of-zero")));
  const entry = model.expressions.entries.find(e => e.ref === expressionRef("roz-essay-reading"));
  assert.ok(entry, "roz-essay-reading is in the published collection");
  assert.ok(entry.scenes.length >= 8);
  assert.ok(entry.about.every(r => index.has(r)));
  assert.ok(entry.about.includes(index.sequences[0].ref), "it is about the manuscript");
});
