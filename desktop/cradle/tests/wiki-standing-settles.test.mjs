// Ticket D (PATH §7): a register standing never says "reading" once nothing is reading it. The two store paths where a read's
// answer is dropped — its owner access retired, or a re-read superseded it — each leave a settled standing behind, and a
// waiter (`ensureWikiStanding`, `rereadWikiProjection`) is answered instead of waiting out its 120 s bound.
//
// Scripted over the owner's real wire grammar: a stub `fetch` answers the files seam and the knowledge op the projection reads
// (`files_list`, `file_read`, `knowledge`), and can hold a read in flight until the test releases it. No kernel is reached.
//
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/wiki-standing-settles.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  configureWikiProjectionAccess,
  ensureWikiProjection,
  ensureWikiStanding,
  getWikiProjectionState,
  rereadWikiProjection,
  retireWikiProjectionAccess,
  setWikiProjectionRegisters,
} from "../src/techne/wikiProjectionStore.ts";

const WIKI_PATH = "Control/agents/wiki/wiki.json";
const location = path => ({schema: "central.path-ref/v1", ref: "", root: "", path});
const wiki = nodeRefs => JSON.stringify({objects: [
  {object: "space", ref: "wiki:space:one", title: "One", node_refs: nodeRefs, revision: 1},
  {object: "node", ref: "wiki:node:alpha", title: "Alpha", revision: 1},
]});

/** The stub owner: `ground.content` is the wiki the file read answers; while `ground.hold` is set, every op waits for `release()`. */
function stubOwner() {
  const ground = {content: wiki(["wiki:node:alpha"]), hold: null, ops: []};
  const answer = op => {
    if (op.op === "files_list") return {ok: true, outcome: {result: "directory_read", receipts: [], directory: {schema: "central.directory-reading/v1",
      location: location("Control/agents/wiki"), entries: [{name: "wiki.json", kind: "file", byte_len: 1, retrieval_allowed: true, location: location(WIKI_PATH)}]}}};
    if (op.op === "file_read") return {ok: true, outcome: {result: "file_read", receipts: [], reading: {schema: "central.file-reading/v1", location: location(WIKI_PATH),
      revision: "rev-1", byte_len: ground.content.length, content_encoding: "utf-8", content: ground.content}}};
    if (op.op === "knowledge") return {ok: true, outcome: {result: "knowledge", receipts: [], data: {edges: [], truncated: false, warnings: []}}};
    return {ok: false, error: `the stub owner does not speak ${op.op}`};
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body);
    ground.ops.push(op.op);
    if (ground.hold) await ground.hold.promise;
    const body = answer(op);
    return {ok: true, status: 200, json: async () => body};
  };
  return {
    ground,
    transport: {kind: "bridge", url: "http://owner.test"},
    holdReads() { let release; const promise = new Promise(resolve => { release = resolve; }); ground.hold = {promise, release}; },
    release() { const held = ground.hold; ground.hold = null; held?.release(); },
    restore() { globalThis.fetch = original; },
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const central = {key: "central", title: "Central"};
const phaseOf = key => getWikiProjectionState().standings[key]?.phase;

test("a read whose owner access retires leaves no standing reading: it returns to idle, and the next access reads it again", async () => {
  const owner = stubOwner();
  try {
    configureWikiProjectionAccess("settles-retired", "epoch-1", () => true);
    setWikiProjectionRegisters([central]);
    owner.holdReads();
    ensureWikiProjection(central, owner.transport);
    assert.equal(phaseOf("central"), "reading");
    retireWikiProjectionAccess();
    owner.release();
    await settle();
    assert.equal(phaseOf("central"), "idle", "the dropped read leaves the standing idle, never \"reading\" with nothing reading it");
    // The access comes back with the same epoch (configure returns early: nothing it holds changed). The standing is read again
    // and settles — before, the ensure path saw "reading", started nothing, and the waiter ran out its bound.
    configureWikiProjectionAccess("settles-retired", "epoch-1", () => true);
    const standing = await ensureWikiStanding(central, owner.transport, 2_000);
    assert.equal(standing.phase, "projected");
    assert.equal(owner.ground.ops.filter(op => op === "file_read").length, 2, "the retired read and the one that settled");
  } finally { owner.restore(); }
});

test("a first read superseded by a re-read whose projection throws settles by name, never reading", async () => {
  const owner = stubOwner();
  try {
    configureWikiProjectionAccess("settles-superseded", "epoch-1", () => true);
    setWikiProjectionRegisters([central]);
    owner.holdReads();
    ensureWikiProjection(central, owner.transport);
    assert.equal(phaseOf("central"), "reading");
    // A native write re-reads the register while its first read is in flight (rereadWikiProjection, e.g. after a constellation is
    // created). The fresh reading parses, but its space's members are not a list, so projecting it throws.
    const held = owner.ground.hold;
    owner.ground.hold = null;
    owner.ground.content = wiki("wiki:node:alpha");
    const reread = rereadWikiProjection(central, owner.transport).then(() => null, error => error);
    await settle();
    owner.ground.hold = held;
    owner.release(); // the first read answers now; its answer is stale (superseded) and dropped
    await settle();
    const standing = getWikiProjectionState().standings.central;
    assert.equal(standing.phase, "unavailable", "the only read left settled the standing");
    assert.match(standing.reason, /filter is not a function/, "in the projection's own words");
    const error = await reread;
    assert.match(error?.message ?? "", /filter is not a function/, "the caller is answered at once, not after its 120 s bound");
  } finally { owner.restore(); }
});
