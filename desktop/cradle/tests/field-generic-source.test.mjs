// The generic field adapter on a small linked corpus that is NOT the essay (tests/fixtures/field-corpus), read through
// a plain-directory io — the same adapter the app runs on Central's file reads.
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-generic-source.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, cpSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, relative} from "node:path";
import {createGenericFieldSource, extractLinks, resolveRelative, parseFrontmatter} from "../src/field/generic/genericSource.ts";
import {FieldStaleRevision} from "../src/field/source.ts";

const FIXTURE = new URL("./fixtures/field-corpus/", import.meta.url).pathname;
const ioOver = root => ({
  async list(path) { return readdirSync(join(root, path)).map(name => { const st = statSync(join(root, path, name)); return {name, path: path ? path + "/" + name : name, kind: st.isDirectory() ? "directory" : "file"}; }); },
  async read(path) { const b = readFileSync(join(root, path)); return {content: b.toString("utf8"), revision: "sha256:" + createHash("sha256").update(b).digest("hex")}; },
  async bytes(path) { return {base64: readFileSync(join(root, path)).toString("base64"), mime: path.endsWith(".svg") ? "image/svg+xml" : null}; },
});
const make = (root = FIXTURE) => createGenericFieldSource({world: "project:harbour", root: "", label: "Harbour", io: ioOver(root)});
const byTitle = (index, t) => index.nodes.find(n => n.title === t);

test("link extraction: paths and wiki names, with fences and images left out", () => {
  const l = extractLinks("see [a](x/y.md#h) and [[Name|alias]] and [[T#sec]] ![img](p.png) [ext](https://x.org) [top](#h)\n```\n[no](z.md)\n```");
  assert.deepEqual(l.map(x => [x.kind, x.target, x.hash]), [["wiki", "Name", undefined], ["wiki", "T", "sec"], ["path", "x/y.md", "h"]]);
  assert.equal(resolveRelative("a/b", "../c.md"), "a/c.md");
  assert.equal(resolveRelative("", "../c.md"), undefined, "a link may not leave the root");
  assert.equal(parseFrontmatter("---\ntitle: \"Q\"\n---\nbody").title, "Q");
});

test("the corpus becomes nodes, links, groups and a tree — nothing named in advance", async () => {
  const s = make(); const index = await s.load();
  assert.equal(index.nodes.length, 7, "markdown files only: " + index.nodes.map(n => n.path));
  assert.ok(!index.nodes.some(n => /\.txt$|\.svg$/.test(n.path)));
  assert.deepEqual(index.groups.map(g => g.label), ["Top level", "Notes", "Projects", "Reference"]);
  assert.equal(byTitle(index, "Alpha Tide").path, "notes/alpha.md", "frontmatter title wins");
  assert.equal(byTitle(index, "Glossary of Terms").path, "reference/glossary.md");
  assert.equal(byTitle(index, "Beta Mooring").label, "Beta Mooring", "first heading");
  assert.ok(byTitle(index, "Harbour Notes").hub && index.node(index.home).title === "Harbour Notes", "root README is home and a hub");
  for (const n of index.nodes) { assert.ok(n.ref.startsWith("central:source:project:harbour:"), n.ref); assert.match(n.revision, /^sha256:[0-9a-f]{64}$/); }
  assert.equal(index.sequences.length, 0); assert.equal(index.expressionsOf(index.home).length, 0);
  const A = byTitle(index, "Alpha Tide").ref, B = byTitle(index, "Beta Mooring").ref, G = byTitle(index, "Gamma Depth").ref, P = byTitle(index, "Project Plan").ref;
  const nb = index.neighbours(A);
  assert.ok(nb.out.includes(B) && nb.out.includes(G) && nb.out.includes(P), "relative path, wiki name and ../ path");
  assert.ok(nb.in.includes(B) && nb.in.includes(G) && nb.in.includes(P), "cited back by them");
  assert.ok(!index.neighbours(B).out.some(r => index.node(r).title === "ignored"), "fenced links are not links");
  assert.ok(index.neighbours(G).out.includes(B), "wiki alias resolves by name");
  // tree: a folder with a README of its own opens that page
  const refFolder = index.tree.children[0].children.find(f => f.label === "Reference");
  assert.equal(index.node(refFolder.ref).title, "Reference");
  assert.deepEqual(index.pathOf(G).map(f => f.label), ["Harbour", "Notes", "Deep", "Gamma Depth"]);
  assert.equal(index.search("mooring").hits.length >= 1, true);
  assert.equal(index.search("glossary").hits[0].ref, byTitle(index, "Glossary of Terms").ref);
});

test("read: markdown rendered, internal links are refs, images inlined, revision disclosed", async () => {
  const s = make(); const index = await s.load();
  const plan = byTitle(index, "Project Plan");
  const r = await s.read(plan.ref, {revision: plan.revision});
  assert.equal(r.sourceRevision, plan.revision); assert.equal(r.sourceRef, plan.ref);
  assert.match(r.body, /data:image\/svg\+xml;base64,/, "the image is the owner's bytes");
  const alpha = byTitle(index, "Alpha Tide");
  assert.ok(r.body.includes(`data-fref="${alpha.ref}"`), "a relative link is a native ref");
  const home = await s.read(index.home);
  assert.ok(home.body.includes(`data-fref="${byTitle(index, "Beta Mooring").ref}"`), "a wiki link is a native ref");
  const a = await s.read(alpha.ref);
  assert.ok(!r.body.includes("<h1"), "the page title is the article head, not repeated in the body");
  assert.ok((await s.read(byTitle(index, "Alpha Tide").ref)).body.includes(`data-fref="${plan.ref}" data-fspan="budget"`), "the fragment travels as the span");
});

test("a held revision that no longer matches the source is refused, not coerced", async () => {
  const dir = mkdtempSync(join(tmpdir(), "field-corpus-")); cpSync(FIXTURE, dir, {recursive: true});
  try {
    const s = make(dir); const index = await s.load(); const n = byTitle(index, "Beta Mooring");
    writeFileSync(join(dir, "notes/beta.md"), "# Beta Mooring\n\nchanged.\n");
    await assert.rejects(() => s.read(n.ref, {revision: n.revision}), e => e instanceof FieldStaleRevision && e.held === n.revision && e.current !== n.revision);
    const fresh = await s.read(n.ref);       // no held revision: reads what stands
    assert.notEqual(fresh.revision, n.revision);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("bounds: a corpus larger than one pass reads says so", async () => {
  const s = createGenericFieldSource({world: "project:harbour", root: "", label: "Harbour", io: ioOver(FIXTURE), limits: {dirs: 400, files: 3, bytes: 400000, concurrency: 2}});
  assert.equal((await s.standing()).state, "partial"); assert.equal((await s.load()).nodes.length, 3);
});

test("the adapter itself names no corpus: no essay or fixture vocabulary in its source", () => {
  const src = readFileSync(new URL("../src/field/generic/genericSource.ts", import.meta.url), "utf8");
  for (const w of ["essay", "movement", "Return of Zero", "harbour", "Harbour", "Antykathera"]) assert.ok(!src.includes(w), w);
});
void relative;
