import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  appendContribution, upgradeDocument, validateDocument, readableEntries, buildThreads, relationsOf, portableCopy,
  canonicalJson, sha256, Refusal, FORMAT_VERSION, spliceIsland,
} from "../src/flow/plural.ts";

const fixtures = JSON.parse(await readFile(new URL("../documents/fixtures/plural-flow-cases.json", import.meta.url), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

function prepared(testCase) {
  // An island case carries the exact text between the ql-doc tags; this form reads it as any JavaScript reader does.
  const doc = testCase.island === undefined ? clone(testCase.doc) : JSON.parse(testCase.island);
  for (const [path, value] of Object.entries(testCase.mutate ?? {})) {
    const parts = path.split(".");
    const last = parts.pop();
    parts.reduce((object, key) => object[key], doc)[last] = value;
  }
  return doc;
}
const refusal = fn => { try { fn(); } catch (error) { if (error instanceof Refusal) return error.code; throw error; } return null; };

test("sha256 matches the known vectors the native owners also carry", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  assert.equal(canonicalJson({b: 1, a: [2, {d: 1, c: 2}]}), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

for (const testCase of fixtures.cases) {
  test(`plural form: ${testCase.name}`, () => {
    const doc = prepared(testCase);
    const expect = testCase.expect;
    if (testCase.op === "append") {
      const code = refusal(() => { const result = appendContribution(clone(doc), clone(testCase.request), testCase.caller); testCase.__result = result; });
      if (expect.refusal) return assert.equal(code, expect.refusal);
      assert.equal(code, null);
      const {doc: next, entry, outcome} = testCase.__result;
      assert.equal(outcome, expect.outcome);
      assert.equal(entry.authorKey, expect.author ?? entry.authorKey);
      if (expect.attribution) assert.equal(entry.attribution.basis, expect.attribution);
      if (expect.session) assert.equal(entry.attribution.session, expect.session);
      if (expect.onBehalfOf) assert.deepEqual(entry.attribution.onBehalfOf, expect.onBehalfOf);
      if (expect.replyTo) assert.equal(entry.replyTo.entryId, expect.replyTo);
      if (expect.basisRevision !== undefined) assert.equal(entry.basisRevision, expect.basisRevision);
      if (expect.converges) assert.deepEqual(relationsOf(entry).filter(r => r.type === "converge").map(r => r.entryId), expect.converges);
      for (const key of expect.noBinding ?? []) assert.notEqual(next.meta.participants.find(p => p.key === key).binding?.basis, "verified", "an unauthenticated caller binds no one");
      for (const [key, ref] of Object.entries(expect.binds ?? {})) assert.equal(next.meta.participants.find(p => p.key === key).binding.ref, ref);
      assert.equal(next.meta.revision, doc.meta.revision + 1);
      // Every other entry and collection survives byte for byte.
      assert.deepEqual(next.entries.slice(0, doc.entries.length), doc.entries);
      for (const collection of ["notes", "packet", "media", "journal"]) assert.deepEqual(next[collection], doc[collection]);
      assert.deepEqual(validateDocument(next).filter(i => i.code !== "legacy-format"), []);
    } else if (testCase.op === "upgrade" || testCase.op === "upgrade-twice") {
      const at = "2026-09-30T10:00:00.000Z";
      const next = upgradeDocument(clone(doc), at);
      if (testCase.op === "upgrade-twice") return assert.deepEqual(upgradeDocument(clone(next), "2030-01-01T00:00:00.000Z"), next);
      assert.deepEqual(upgradeDocument(clone(doc), at), next, "deterministic");
      assert.equal(next.meta.format.version, FORMAT_VERSION);
      assert.equal(next.meta.documentId, doc.meta.documentId);
      assert.deepEqual(next.entries.map(e => e.id), expect.entryIds);
      next.entries.forEach((entry, i) => assert.equal(entry.html, doc.entries[i].html));
      for (const key of expect.keepKeys ?? []) assert.deepEqual(next[key], doc[key]);
      for (const [id, basis] of Object.entries(expect.authors ?? {})) assert.equal(next.entries.find(e => e.id === id).attribution.basis, basis);
      for (const id of expect.noAuthorKey ?? []) assert.equal(next.entries.find(e => e.id === id).authorKey, undefined);
      for (const [id, type] of Object.entries(expect.relations ?? {})) assert.equal(relationsOf(next.entries.find(e => e.id === id))[0].type, type);
      assert.equal(next.meta.upgrade.originalDigest, sha256(canonicalJson(doc)));
      assert.deepEqual(validateDocument(next), []);
    } else if (testCase.op === "replay") {
      const first = appendContribution(clone(doc), clone(testCase.request), testCase.caller);
      const again = {...clone(testCase.request), ...testCase.replayRequest};
      const code = refusal(() => { testCase.__second = appendContribution(clone(first.doc), again, testCase.caller); });
      if (expect.second === "recovered") {
        assert.equal(code, null);
        assert.equal(testCase.__second.outcome, "recovered");
        assert.equal(testCase.__second.doc.entries.length, expect.entries);
        assert.equal(testCase.__second.doc.meta.revision, expect.revision);
      } else assert.equal(`refusal:${code}`, expect.second);
    } else if (testCase.op === "sequence") {
      let current = doc;
      for (const step of testCase.steps) current = appendContribution(current, clone(step.request), step.caller).doc;
      assert.equal(current.entries.length, expect.entries);
      assert.equal(current.meta.revision, expect.revision);
      for (const [operation, parent] of Object.entries(expect.replyParents)) assert.equal(current.entries.find(e => e.request?.ref === operation).replyTo.entryId, parent);
      const roots = buildThreads(current);
      assert.equal(roots.length, 1);
      assert.equal(roots[0].children.length, 2, "both replies are siblings of the one question");
    } else if (testCase.op === "append-island") {
      // D10 (O:I #766), the form's half: the island as written is a document this form appends to, and the bytes the
      // native writer must leave are exactly this form's result. JSON.parse rounds integers above 2^53 here, as every
      // JavaScript reader does; the native writer keeps them exact (Central's tests/flow_append.rs), and so does this
      // form's own save, which splices (#785, the spliceIsland tests below).
      const {doc: next, entry, outcome} = appendContribution(clone(doc), clone(testCase.request), testCase.caller);
      assert.equal(outcome, expect.outcome);
      assert.equal(entry.attribution.basis, expect.attribution);
      assert.deepEqual(validateDocument(next).filter(i => i.code !== "legacy-format"), []);
      const [head, tail] = expect.islandAfter;
      // The kept stretches are the island's own bytes: before the new entry only the revision's value moves.
      assert.ok(testCase.island.endsWith(tail), "the bytes after the new entry are the island's own");
      // The revision's value as the island spells it: a hand-written `3.0` is 3 (#798), and the append writes the next count.
      const revision = /("revision":)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/;
      const before = testCase.island.slice(0, -tail.length);
      assert.equal(Number(before.match(revision)[2]), doc.meta.revision, "the island's revision is the count this form read");
      assert.equal(next.meta.revision, doc.meta.revision + 1, "the append counts on from the revision as read");
      assert.equal(before.replace(revision, `$1${next.meta.revision}`), head,
        "the bytes before the new entry are the island's own, the revision's value apart");
      // With this form's entry between them they read as exactly this form's result.
      assert.deepEqual(JSON.parse(`${head},${JSON.stringify(entry)}${tail}`), clone(next));
    } else if (testCase.op === "validate") {
      assert.deepEqual([...new Set(validateDocument(doc).map(i => i.code))].filter(c => c !== "legacy-format"), expect.issues);
    } else if (testCase.op === "read") {
      assert.deepEqual(readableEntries(doc, testCase.reader).map(e => e.id), expect.readable);
    } else assert.fail(`unknown op ${testCase.op}`);
  });
}

test("reading a legacy document never mutates it", () => {
  const legacy = fixtures.cases.find(c => c.name === "upgrade-fh-preserves-everything").doc;
  const before = canonicalJson(legacy);
  validateDocument(legacy);
  relationsOf(legacy.entries[1]);
  buildThreads(legacy);
  assert.equal(canonicalJson(legacy), before);
});

test("a portable copy carries only what the whole group may read and leaves the source untouched", () => {
  const doc = {meta: {documentId: "d", title: "t", revision: 3, current: "e2", journalCurrent: "j1", embeddedPrivate: "EMBEDDED-SECRET", format: {version: 4, minReader: 4},
    participants: [{key: "a", initial: "A", kind: "person", name: "Ann"}, {key: "b", initial: "B", kind: "agent", name: "Bea", ref: "agent-session/secret"}]},
    entries: [
      {id: "e1", author: "A", authorKey: "a", at: "2026-09-30T08:00:00.000Z", html: "<p>open</p>", replyTo: null, touched: false},
      {id: "e2", author: "A", authorKey: "a", at: "2026-09-30T08:01:00.000Z", html: "<p>PRIVATE</p>", replyTo: null, touched: false, audience: {keys: ["a"]}},
      {id: "e3", author: "B", authorKey: "b", at: "2026-09-30T08:02:00.000Z", html: "<p>answer</p>", replyTo: {entryId: "e2", anchor: null}, relations: [{type: "reply", entryId: "e2"}, {type: "source", ref: "central:source:x"}], touched: false, attribution: {basis: "verified", agency: "agent/bea", session: "agent-session/secret", generation: "g1"}, request: {ref: "op-e3", digest: "stale"}},
      {id: "e4", author: "B", authorKey: "b", at: "2026-09-30T08:03:00.000Z", html: "<p>odd</p>", replyTo: null, touched: false, audience: "private"},
    ],
    notes: [{id: "n1", entryId: "e1", text: "<p>NOTE</p>"}], packet: [{id: "p1"}], media: [{id: "m1", entry: "e1"}], journal: [{id: "j1", html: "<p>JOURNAL</p>"}]};
  const before = clone(doc);
  const copy = portableCopy(doc);
  assert.deepEqual(doc, before, "the source is untouched");
  assert.deepEqual(copy.entries.map(e => e.id), ["e1", "e3"]);
  assert.deepEqual([copy.notes, copy.packet, copy.media, copy.journal], [[], [], [], []]);
  assert.equal(copy.entries[1].replyTo, null, "no reply left pointing at a withheld entry");
  assert.deepEqual(copy.entries[1].relations, [{type: "source", ref: "central:source:x"}]);
  assert.ok(!JSON.stringify(copy).match(/PRIVATE|NOTE|JOURNAL|EMBEDDED-SECRET|agent-session\/secret/));
  assert.equal(copy.entries[1].attribution.agency, "agent/bea", "who answered travels; the machine's session does not");
  assert.deepEqual(copy.meta.projection, {kind: "shared-copy", sourceDocumentId: "d", sourceRevision: 3, at: null, withheld: {entries: 2, journal: 1, notes: 1, packet: 1, media: 1}});
  assert.deepEqual(validateDocument(copy).filter(i => i.code !== "legacy-format"), [], "an entry that lost a relation still validates: its digest follows");
});

test("reading a document with an audience this form does not know never throws and never publishes it", () => {
  const doc = {meta: {documentId: "d", revision: 1, format: {version: 4, minReader: 4}, participants: [{key: "a", initial: "A", kind: "person"}, {key: "b", initial: "B", kind: "person"}]},
    entries: [{id: "e1", author: "A", authorKey: "a", at: "2026-09-30T08:00:00.000Z", html: "<p>x</p>", replyTo: null, touched: false, audience: "private"}], notes: [], packet: [], media: [], journal: []};
  assert.deepEqual(readableEntries(doc, "b").map(e => e.id), []);
  assert.deepEqual(readableEntries(doc, "a").map(e => e.id), ["e1"]);
  assert.deepEqual(validateDocument(doc).map(i => i.code).filter(c => c === "invalid-audience"), ["invalid-audience"]);
});

// A save writes into the island only what the page changed (#785), as Central's append does (#766): a JavaScript reader
// rounds integers past 2^53 and moves integer-like keys first, so the island is never re-serialised from what it read.
test("a page save of the shared island case writes the page's append and keeps every other byte", () => {
  const islandCase = fixtures.cases.find(c => c.name === "an-append-keeps-every-island-byte-it-does-not-own");
  const page = appendContribution(JSON.parse(islandCase.island), clone(islandCase.request), islandCase.caller);
  const [head, tail] = islandCase.expect.islandAfter;
  assert.equal(spliceIsland(islandCase.island, page.doc), `${head},${JSON.stringify(page.entry)}${tail}`);
});

// What a save writes into the island is JSON with `</script`, in any case, written `<\/` and the letters after it as written,
// and a comment opening written `<\u0021--` (#797: the escape lowercased the letters, so the read-back refused the save).
const escapedForIsland = value => JSON.stringify(value).replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\u0021--");
for (const islandCase of fixtures.cases.filter(c => c.op === "append-island")) {
  test(`a page save keeps the shared island case as written: ${islandCase.name}`, () => {
    assert.equal(spliceIsland(islandCase.island, JSON.parse(islandCase.island)), islandCase.island, "a save that changes nothing writes the island back byte for byte");
    const page = appendContribution(JSON.parse(islandCase.island), clone(islandCase.request), islandCase.caller);
    const [head, tail] = islandCase.expect.islandAfter;
    const saved = spliceIsland(islandCase.island, page.doc);
    assert.equal(saved, `${head},${escapedForIsland(page.entry)}${tail}`);
    assert.doesNotMatch(saved.slice(head.length, -tail.length), /<\/script|<!--/i, "the island can neither close itself nor open a comment");
    assert.deepEqual(JSON.parse(saved), clone(page.doc), "the island reads back as exactly the page's document");
  });
}

// A hand-written island: spacing, number spellings, an escape, a duplicate key, an integer-like key and integers no
// JavaScript number holds.
const written = '{ "meta": {"revision": 1.0, "2": "integer-like", "big": 18446744073709551617, "view": "dialogue", "view": "flow"},\n'
  + '  "entries": [ {"id": "a", "html": "<p>one<\\/p>", "n": 1e2}, {"id": "b", "html": "x"} ,{"id": "c", "html": "y", "t": 9007199254740993} ],\n'
  + '  "notes": [ 1, 2.50, 3 ], "x-kept": {"z": 1, "a": [true, null]} }';

test("a save that changes nothing writes the island back byte for byte", () => {
  assert.equal(spliceIsland(written, JSON.parse(written)), written);
});

test("a save replaces only the values the page changed, where they stand", () => {
  const doc = JSON.parse(written);
  doc.meta.revision = 2; doc.meta.view = "journal"; doc.entries[1].html = "</script><!--"; doc.notes[1] = 4;
  assert.equal(spliceIsland(written, doc), written
    .replace('"revision": 1.0', '"revision": 2')
    .replace('"view": "flow"', '"view": "journal"')
    .replace('"html": "x"', '"html": "<\\/script><\\u0021--"')
    .replace("2.50", "4"));
});

test("a save keeps the letters of an island-closing tag it escapes, and of one the island holds", () => {
  const holding = written.replace('"html": "y"', '"html": "<\\/SCRIPT>"');
  const doc = JSON.parse(holding);
  assert.equal(doc.entries[2].html, "</SCRIPT>");
  doc.entries[1].html = "</SCRIPT></Script><!--";
  assert.equal(spliceIsland(holding, doc), holding.replace('"html": "x"', '"html": "<\\/SCRIPT><\\/Script><\\u0021--"'));
});

test("a save removes what the page removed and adds what it added, keeping the bytes of what stayed", () => {
  const doc = JSON.parse(written);
  delete doc.meta.big; doc.meta.current = "c"; delete doc["x-kept"];
  doc.entries.splice(1, 1); doc.entries[0].html = "<p>won</p>";
  doc.entries.unshift({id: "o", html: "w"}); doc.entries.push({id: "d", html: "z"});
  assert.equal(spliceIsland(written, doc),
    '{ "meta": {"revision": 1.0, "2": "integer-like", "view": "dialogue", "view": "flow","current":"c"},\n'
    + '  "entries": [ {"id":"o","html":"w"},{"id": "a", "html": "<p>won</p>", "n": 1e2} ,{"id": "c", "html": "y", "t": 9007199254740993},{"id":"d","html":"z"} ],\n'
    + '  "notes": [ 1, 2.50, 3 ] }');
});
