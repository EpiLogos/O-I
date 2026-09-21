// The M0′ currentness seam (the remainer the 13-step walk named): a kernel
// `file_changed` receipt whose path is a register's wiki basis invalidates
// that register's cached reading — the one projection store re-reads the
// local whole and re-projects, and a fresh reading stands as "projected"
// (the centre's open flow then presents the new content-addressed
// generation). Proven here at the store level over the REAL wire grammar:
// the stub bridge answers the very `files_list` / `file_read` / `knowledge`
// ops the files seam and knowledge op speak, so a native read is never
// faked — the owner's real wiki.json is owner CAS territory no probe may
// write, and this is the seam the receipt feed (CradleFrame) drives.
//
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/techne-m0-currentness.test.mjs
import test, {after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {promisify} from "node:util";

import {
  applyWikiProjectionReceipt,
  ensureWikiProjection,
  getWikiProjectionState,
  setWikiProjectionRegisters,
  wikiDocumentOf,
  wikiProjectionDocumentReady,
  wikiProjectionOpening,
} from "../src/techne/wikiProjectionStore.ts";

// ---- the wiki fixtures (the parseWiki grammar, verbatim) -------------------

const wikiV1 = () => ({objects: [
  {object: "space", ref: "wiki:space:one", title: "One", node_refs: ["wiki:node:alpha", "wiki:node:beta"], revision: 3},
  {object: "node", ref: "wiki:node:alpha", title: "Alpha", revision: 1},
  {object: "node", ref: "wiki:node:beta", title: "Beta", revision: 1},
]});
const wikiV2 = () => ({objects: [
  {object: "space", ref: "wiki:space:one", title: "One", node_refs: ["wiki:node:alpha", "wiki:node:beta", "wiki:node:gamma"], revision: 4},
  {object: "node", ref: "wiki:node:alpha", title: "Alpha", revision: 1},
  {object: "node", ref: "wiki:node:beta", title: "Beta", revision: 1},
  {object: "node", ref: "wiki:node:gamma", title: "Gamma", revision: 1},
]});

const WIKI_PATH = "Control/agents/wiki/wiki.json";
const WIKI_DIR = "Control/agents/wiki";
const locationFor = path => ({schema: "central.path-ref/v1", ref: "", root: "", path});

// ---- the stub kernel bridge (the ops' real wire shapes) --------------------

// state.mode: "ready" | "absent" | "malformed" | "refused"
const ground = {mode: "ready", revision: "rev-1", wiki: wikiV1()};

const server = createServer((request, response) => {
  let body = "";
  request.on("data", chunk => { body += chunk; });
  request.on("end", () => {
    const op = JSON.parse(body || "{}");
    const json = payload => { response.writeHead(200, {"content-type": "application/json"}); response.end(JSON.stringify(payload)); };
    if (op.op === "files_list") {
      const entries = ground.mode === "absent" ? [] : [{
        name: "wiki.json", kind: "file", byte_len: 128, retrieval_allowed: true,
        location: locationFor(WIKI_PATH),
      }];
      return json({ok: true, outcome: {result: "directory_read", receipts: [], directory: {
        schema: "central.directory-reading/v1", location: locationFor(WIKI_DIR), entries, automatic_agent_or_model_invocation: false,
      }}});
    }
    if (op.op === "file_read") {
      if (ground.mode === "refused") return json({ok: false, error: "the stub ground refused the read"});
      const content = ground.mode === "malformed" ? "{not json at all" : JSON.stringify(ground.wiki);
      return json({ok: true, outcome: {result: "file_read", receipts: [], reading: {
        schema: "central.file-reading/v1", location: locationFor(WIKI_PATH), revision: ground.revision,
        byte_len: content.length, content_encoding: "utf-8", content, project: null, source: null,
        automatic_agent_or_model_invocation: false,
      }}});
    }
    if (op.op === "knowledge") {
      return json({ok: true, outcome: {result: "knowledge", receipts: [], data: {
        edges: [{relation: "supports", from: "wiki:node:alpha", to: "wiki:node:beta", origin: {provider: "stub", authority: "stub", revision: "r1"}}],
        truncated: false, warnings: [],
      }}});
    }
    json({ok: false, error: `the stub bridge does not speak ${op.op}`});
  });
});
await promisify(server.listen.bind(server))(0, "127.0.0.1");
const transport = {kind: "bridge", url: `http://127.0.0.1:${server.address().port}`};

const waitFor = async (predicate, what, timeout = 8000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
};
const standingOf = key => getWikiProjectionState().standings[key];
const centralRegister = {key: "central", title: "Central"};

test("a changed wiki basis invalidates, re-reads and re-projects; everything else leaves the cache alone", async () => {
  // (0) First read through the ordinary ensure cycle: one cached generation.
  setWikiProjectionRegisters([centralRegister]);
  ensureWikiProjection(centralRegister, transport);
  await waitFor(() => standingOf("central")?.phase === "projected", "the first projection");
  const first = standingOf("central");
  const firstRef = first.projection.document.expression_ref;
  assert.match(firstRef, /^expression:techne-m0\.central\./, "the projection carries the register's stable Technè M0′ identity");
  assert.equal(first.projection.constellations[0].members.length, 2, "the first generation carries the wiki's two members");
  assert.equal(first.reading.wikiBasis.revision, "rev-1");

  // (1) The owner writes a changed wiki through central.files; the kernel
  // emits `file_changed`; the receipt invalidates and re-projects. The
  // stale-while-revalidate law: the standing stays visible while it flies.
  ground.revision = "rev-2";
  ground.wiki = wikiV2();
  const invalidated = applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 1}, transport);
  assert.deepEqual(invalidated, ["central"], "the register whose basis changed is invalidated");
  await waitFor(() => standingOf("central")?.phase === "projected" && standingOf("central").reading.wikiBasis.revision === "rev-2", "the fresh generation");
  const second = standingOf("central");
  // Stable identity, revision carries the drift (Technè M0′ owner direction 2026-09-19;
  // WIKI-CONSTELLATION-SPEC currentness law — "Unchanged members retain identities",
  // recomposition is deliberate; wikiExpression.ts: "stable identity and revision are
  // separate", wikiProjectionStore.ts: "a changed wiki is drift, not permission to remint
  // or overwrite composition"). A changed basis is fresh drift on the SAME Expression — the
  // freshness is proven by the revision and member count below — never a silent remint that
  // would orphan the person's open composition.
  assert.equal(second.projection.document.expression_ref, firstRef, "stable identity: a changed basis is drift on the same Expression, never a silent remint");
  assert.equal(second.projection.constellations[0].members.length, 3, "the fresh reading carries the wiki's third member");
  assert.equal(second.reading.wikiBasis.revision, "rev-2");

  // (2) The receipt cursor dedupes: a replayed burst invalidates nothing.
  const replayed = applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 1}, transport);
  assert.deepEqual(replayed, [], "an already-applied seq is not this store's concern");
  assert.equal(standingOf("central").reading.wikiBasis.revision, "rev-2", "the fresh generation stands untouched");

  // (3) A changed file no register reads is not this store's concern.
  const foreign = applyWikiProjectionReceipt({event: "file_changed", path: "Work/Elsewhere/ProjectCentral/agents/wiki/wiki.json", seq: 2}, transport);
  assert.deepEqual(foreign, [], "a foreign path invalidates nothing");

  // (4) Other kernel events are not this store's concern.
  const otherEvent = applyWikiProjectionReceipt({event: "source_changed", path: WIKI_PATH, seq: 3}, transport);
  assert.deepEqual(otherEvent, [], "only file_changed is the currentness seam");
});

test("a wiki basis that becomes absent invalidates the cache to the honest absence", async () => {
  ground.mode = "absent";
  ground.revision = "rev-3";
  const invalidated = applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 4}, transport);
  assert.deepEqual(invalidated, ["central"], "the served register is invalidated");
  await waitFor(() => standingOf("central")?.phase === "absent", "the honest absence");
  assert.equal(wikiDocumentOf(standingOf("central")), undefined, "no document stands for an absent wiki");
});

test("a wiki that appears where none stood is picked up by the same seam", async () => {
  ground.mode = "ready";
  ground.revision = "rev-4";
  ground.wiki = wikiV1();
  const invalidated = applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 5}, transport);
  assert.deepEqual(invalidated, ["central"], "an absent register is invalidated too");
  await waitFor(() => standingOf("central")?.phase === "projected", "the newly served projection");
  assert.equal(standingOf("central").reading.wikiBasis.revision, "rev-4");
});

test("a refused re-read under a standing document is named as drift, never a silent stale claim", async () => {
  // Stand the generation the way the centre does (the store's own centre-
  // entry functions): the projected generation is opened in the kernel and
  // its document — with the person's position — becomes the standing truth.
  await waitFor(() => standingOf("central")?.phase === "projected", "the standing before the open");
  const standingGeneration = standingOf("central");
  wikiProjectionOpening("central");
  wikiProjectionDocumentReady("central", {
    schema: "oi.expression/v1", expression_ref: standingGeneration.projection.document.expression_ref,
    title: "the local whole", revision: 2,
    selection: {scene_ref: standingGeneration.projection.overviewSceneRef, entity_ref: null},
    scenes: [], entities: {}, relations: {}, provenance: [],
  });
  assert.equal(standingOf("central")?.phase, "ready", "the document stands");
  // The basis changes; the fresh read is refused; the standing document
  // keeps showing and the failure is named — never a silent stale claim.
  ground.mode = "refused";
  assert.deepEqual(applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 6}, transport), ["central"]);
  await waitFor(() => standingOf("central")?.phase === "drift", "the named drift");
  assert.match(standingOf("central").reason, /could not be served/, "the drift names the failed fresh read");
  assert.ok(wikiDocumentOf(standingOf("central")), "the standing generation still shows");
});

test("a malformed wiki basis is an unavailable reading, not a crash and not a silent keep", async () => {
  // First stand a fresh projected generation again (the refusal above left
  // the register in drift): a good basis re-stands as projected.
  ground.mode = "ready";
  ground.revision = "rev-6";
  ground.wiki = wikiV1();
  assert.deepEqual(applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 7}, transport), ["central"]);
  await waitFor(() => standingOf("central")?.phase === "projected", "the re-served projection");
  // Then a malformed basis under a projected (document-less) standing is
  // the named unavailable state — the parse failure is the reason.
  ground.mode = "malformed";
  ground.revision = "rev-7";
  assert.deepEqual(applyWikiProjectionReceipt({event: "file_changed", path: WIKI_PATH, seq: 8}, transport), ["central"]);
  await waitFor(() => standingOf("central")?.phase === "unavailable", "the named unavailable state");
  assert.match(standingOf("central").reason, /JSON/i, "the parse failure is the named reason");
});

after(() => { server.close(); });
