import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {
  appendContribution, upgradeDocument, validateDocument, readableEntries, buildThreads, relationsOf, portableCopy,
  canonicalJson, sha256, Refusal, FORMAT_VERSION, requestDigest, isFlowDocumentUuid,
} from "../src/flow/plural.ts";

const fixtures = JSON.parse(await readFile(new URL("../documents/fixtures/plural-flow-cases.json", import.meta.url), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

function prepared(testCase) {
  const doc = clone(testCase.doc);
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


// Real pure authoring implementation and native-shared contract inputs; these
// are not native owner/model/renderer execution receipts.
const uuidA = "5c347cc8-4926-42cf-919c-1e892681c6a8";
const uuidB = "b3243d85-2e4b-43fa-9a23-69ad507d3487";
function pinnedAppendInput() {
  const testCase = fixtures.cases.find(row => row.op === "append" && row.expect.outcome === "appended" && !row.mutate);
  assert.ok(testCase, "a real shared successful append contract case is required");
  const doc = prepared(testCase); doc.meta.documentId = uuidA;
  return {doc, request: {...clone(testCase.request), operationRef: "op-document-basis-contract"}, caller: testCase.caller};
}
test("a pinned append and exact retry retain their document UUID without changing the legacy payload digest", () => {
  const {doc, request, caller} = pinnedAppendInput();
  const legacy = appendContribution(clone(doc), request, caller);
  const pinned = appendContribution(clone(doc), {...request, expectedDocumentId: uuidA}, caller);
  assert.equal(pinned.entry.request.documentId, uuidA);
  assert.equal(pinned.entry.request.digest, legacy.entry.request.digest);
  assert.equal(requestDigest(pinned.entry), requestDigest(legacy.entry));
  const before = canonicalJson(pinned.doc);
  const replay = appendContribution(pinned.doc, {...request, at: "2030-01-01T00:00:00Z", expectedDocumentId: uuidA}, caller);
  assert.equal(replay.outcome, "recovered"); assert.equal(canonicalJson(replay.doc), before);
  for (const expectedDocumentId of [undefined, null]) assert.equal(refusal(() => appendContribution(clone(pinned.doc), {...request, expectedDocumentId}, caller)), "request-conflict");
  assert.equal(refusal(() => appendContribution(clone(legacy.doc), {...request, expectedDocumentId: uuidA}, caller)), "request-conflict");
});
test("document UUID mismatch is checked before recovery even when B carries A's operation record", () => {
  const {doc, request, caller} = pinnedAppendInput();
  const first = appendContribution(doc, {...request, expectedDocumentId: uuidA}, caller);
  const replacement = clone(first.doc); replacement.meta.documentId = uuidB;
  const before = canonicalJson(replacement);
  assert.equal(refusal(() => appendContribution(replacement, {...request, expectedDocumentId: uuidA}, caller)), "document-mismatch");
  assert.equal(refusal(() => appendContribution(replacement, {...request, expectedDocumentId: uuidB}, caller)), "request-conflict");
  assert.equal(canonicalJson(replacement), before);
});
test("malformed UUID pins refuse without mutation; absent and null retain legacy replay", () => {
  const {doc, request, caller} = pinnedAppendInput(); const before = canonicalJson(doc);
  for (const expectedDocumentId of ["", 7, "not-a-uuid", ` ${uuidA}`, `${uuidA} `]) {
    assert.equal(refusal(() => appendContribution(doc, {...request, expectedDocumentId}, caller)), "invalid-expected-document-id");
    assert.equal(canonicalJson(doc), before);
  }
  const first = appendContribution(doc, request, caller);
  assert.equal(appendContribution(first.doc, {...request, expectedDocumentId: null}, caller).outcome, "recovered");
  assert.equal(first.entry.request.documentId, undefined);
  for (const spelling of [uuidA, uuidA.toUpperCase(), uuidA.replaceAll("-", ""), `{${uuidA}}`, `urn:uuid:${uuidA}`]) assert.equal(isFlowDocumentUuid(spelling), true);
});

test("the actual generated portable form and typed authoring implementation enforce the same UUID pin contract", async () => {
  const html = await readFile(new URL("../documents/ql-flow.html", import.meta.url), "utf8");
  const script = html.match(/<script id="ql-plural">([\s\S]*?)<\/script>/);
  assert.ok(script, "the genuine generated portable module is required");
  const context = {TextEncoder}; runInNewContext(script[1], context, {timeout: 1000});
  const portable = context.QlPlural; assert.equal(typeof portable.appendContribution, "function");
  const {doc, request, caller} = pinnedAppendInput();
  const typed = appendContribution(clone(doc), {...request, expectedDocumentId: uuidA}, caller);
  const standalone = portable.appendContribution(clone(doc), {...request, expectedDocumentId: uuidA}, caller);
  assert.equal(canonicalJson(standalone), canonicalJson(typed));
  const replacement = clone(typed.doc); replacement.meta.documentId = uuidB;
  for (const expectedDocumentId of [uuidA, uuidB, null]) {
    let code; try { portable.appendContribution(clone(replacement), {...request, expectedDocumentId}, caller); } catch (error) { code = error.code; }
    assert.equal(code, refusal(() => appendContribution(clone(replacement), {...request, expectedDocumentId}, caller)));
  }
});
