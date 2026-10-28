// The app-side Flow instance module against the v0.4 form: keyed minting,
// validated append for human and agent entries, deterministic retention
// (the Nara path) and an untouched legacy append.
import assert from "node:assert/strict";
import {createServer} from "vite";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import os from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = JSON.parse(readFileSync(root + "documents/fixtures/plural-flow-cases.json", "utf8"));
const server = await createServer({configFile: false, root, cacheDir: path.join(os.tmpdir(), "oi-plural-flow-vite"), server: {middlewareMode: true, hmr: false, ws: false}, appType: "custom", logLevel: "silent"});
try {
  const instance = await server.ssrLoadModule("/src/flow/instance.ts");
  const plural = await server.ssrLoadModule("/src/flow/plural.ts");

  const html = instance.mintInstance("First words.\n\nSecond paragraph.", [
    {initial: "A", kind: "person", name: "Ann"},
    {initial: "A", kind: "agent", name: "Ada", ref: "agent-session/ada-1"},
  ], new Date("2026-09-30T08:00:00Z"));
  const minted = instance.parseInstance(html);
  assert.equal(minted.meta.format.version, 4);
  assert.equal(minted.meta.template, "ql-dialogue-flow v0.4");
  assert.equal(new Set(minted.meta.participants.map(p => p.key)).size, 2, "two participants sharing an initial get distinct keys");
  assert.equal(minted.entries[0].authorKey, minted.meta.participants[0].key);
  assert.equal(minted.entries[0].attribution.basis, "declared");
  assert.deepEqual(plural.validateDocument(minted), []);
  assert.equal(minted.meta.participants[1].binding.basis, "declared", "a session ref makes the binding declared, never verified");

  // A human reply and an agent answer to the same entry land once each, as siblings.
  const ada = minted.meta.participants[1];
  const first = minted.entries[0].id;
  const human = instance.appendEntry(html, "Why does it claim that?", {replyTo: {entryId: first, anchor: null}}, new Date("2026-09-30T08:05:00Z"));
  const agent = instance.appendEntry(human.html, "Because of the second step.", {participant: ada, replyTo: {entryId: human.entry.id, anchor: null}}, new Date("2026-09-30T08:06:00Z"));
  const doc = instance.parseInstance(agent.html);
  assert.equal(doc.entries.length, 3);
  assert.equal(doc.entries[2].authorKey, ada.key);
  assert.equal(doc.entries[2].attribution.basis, "declared", "the app is not a native owner: it records declared attribution");
  assert.equal(doc.meta.revision, 2);
  assert.deepEqual(plural.validateDocument(doc), []);

  // Retention is deterministic and idempotent: same id + operation → recovered, not appended twice.
  const retained = instance.appendEntry(agent.html, "answer", {participant: ada, html: "<p><strong>rich</strong> answer</p>", entryId: "nara-answer-1", operationRef: "nara-retain:nara-answer-1"});
  const again = instance.appendEntry(retained.html, "answer", {participant: ada, html: "<p><strong>rich</strong> answer</p>", entryId: "nara-answer-1", operationRef: "nara-retain:nara-answer-1"});
  const after = instance.parseInstance(again.html);
  assert.equal(after.entries.filter(e => e.id === "nara-answer-1").length, 1);
  assert.equal(after.entries.find(e => e.id === "nara-answer-1").html, "<p><strong>rich</strong> answer</p>");
  assert.equal(after.meta.revision, 3, "a recovered replay does not advance the revision");
  assert.deepEqual(plural.validateDocument(after), []);

  // Entry bodies with HTML comments and script text survive the island round trip.
  const hostile = instance.appendEntry(html, "a <!-- comment --> and </script> text", {html: "<p>a <!-- comment --> and &lt;/script&gt; <script>x</script> text</p>"});
  assert.ok(!hostile.html.includes("<!-- comment -->"), "no raw comment inside the island");
  assert.equal(instance.parseInstance(hostile.html).entries.at(-1).html, "<p>a <!-- comment --> and &lt;/script&gt; <script>x</script> text</p>");

  // A blank template copy with no participants gets its keyed defaults, like the page itself.
  const blank = instance.mintBlankInstance(undefined, new Date("2026-09-30T08:00:00Z"));
  const written = instance.parseInstance(instance.appendEntry(blank, "hello").html);
  assert.equal(written.entries[0].author, "F");
  assert.ok(written.entries[0].authorKey);

  // A legacy document appends exactly as it always did.
  const legacy = fixtures.cases.find(c => c.name === "upgrade-fh-preserves-everything").doc;
  const shell = readFileSync(root + "documents/ql-dialogue-flow.html", "utf8");
  const legacyHtml = instance.embedDocument(shell, JSON.parse(JSON.stringify(legacy)));
  const appended = instance.parseInstance(instance.appendEntry(legacyHtml, "still works").html);
  assert.equal(appended.entries.length, legacy.entries.length + 1);
  assert.equal(appended.entries.at(-1).author, "F");
  assert.equal(appended.entries.at(-1).authorKey, undefined, "a legacy form gains no plural fields by being written");
  assert.equal(appended.meta.format, undefined);

  // A page save of the shared island case (#785). The page reads the island as every JavaScript reader does (integers
  // past 2^53 rounded, integer-like keys first) and makes its change, here the case's append; the host reads what the
  // page holds through the bridge and embeds it into the file's own bytes (live-shell inhabitants/DocumentFlowFace.tsx
  // saveToOwner: embedDocument(instance.html, the island read)). Only the page's change is written: the island is
  // exactly the case's islandAfter around the new entry, and no byte outside the island moves.
  const islandCase = fixtures.cases.find(c => c.name === "an-append-keeps-every-island-byte-it-does-not-own");
  const islandTag = /(<script type="application\/json" id="ql-doc">)[\s\S]*?(<\/script>)/;
  const withIsland = (html, island) => html.replace(islandTag, (_, open, close) => open + island + close);
  const file = withIsland(readFileSync(root + "documents/ql-flow.html", "utf8"), islandCase.island);
  const page = plural.appendContribution(instance.parseInstance(file), JSON.parse(JSON.stringify(islandCase.request)), islandCase.caller);
  const bridged = JSON.parse(JSON.stringify(page.doc));
  const [head, tail] = islandCase.expect.islandAfter;
  assert.equal(instance.embedDocument(file, bridged), withIsland(file, `${head},${JSON.stringify(page.entry)}${tail}`),
    "a page save writes only the page's change into the island; every other byte stays as written");
  // The app's own append writes through the same path and keeps the same bytes.
  const viaAppend = instance.appendEntry(file, "", {participant: {key: "p-ada", initial: "D", kind: "agent"}, html: "<p>Through the app.</p>"});
  for (const kept of ['"x-ledger":{"zeta":"written first","alpha":9007199254740993,"mid":{"z":18446744073709551617,"a":-9223372036854775809}}', '"x-trace":{"tick":9007199254740995,"by":"page"}', islandCase.expect.islandAfter[1]])
    assert.ok(viaAppend.html.includes(kept), `an app append keeps ${kept.slice(0, 40)} as written`);
  console.log("plural-flow instance: ok");
} finally {
  await server.close();
}
