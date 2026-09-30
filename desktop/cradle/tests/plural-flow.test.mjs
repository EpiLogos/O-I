import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  appendContribution, upgradeDocument, validateDocument, readableEntries, buildThreads, relationsOf,
  canonicalJson, sha256, Refusal, FORMAT_VERSION,
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
