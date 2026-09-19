import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

import {appendEntry,embedDocument,htmlAnchorPosition,htmlToText,parseInstance} from "../src/flow/instance.ts";

const template = await readFile(new URL("../documents/ql-dialogue-flow.html", import.meta.url), "utf8");

test("the supplied 0/1 file is the source, with its distinct collections retained", () => {
  const doc = parseInstance(template);
  assert.equal(doc.meta.template, "ql-dialogue-flow v0.1");
  assert.deepEqual(doc.entries, []);
  assert.deepEqual(doc.notes, []);
  assert.deepEqual(doc.packet, []);
  assert.deepEqual(doc.media, []);
  assert.deepEqual(doc.journal, []);
});

test("append-entry is stable and preserves the rest of the document verbatim", () => {
  const base = parseInstance(template);
  base.meta.documentId = "test-document-id";
  base.meta.revision = 41;
  base.entries.push({
    id: "human-entry", author: "F", at: "2026-09-19T00:00:00.000Z",
    html: "<p>Rich <em>human</em> writing</p>", replyTo: null, touched: false,
  });
  base.notes.push({id: "note-id", entryId: "human-entry", anchor: "human", text: "during"});
  base.media.push({id: "media-id", entry: "human-entry", mime: "image/png", data: "data:image/png;base64,AAAA"});
  base.journal.push({id: "journal-id", at: "2026-09-19T00:00:00.000Z", html: "<p>Journal</p>"});
  base.unpublished = {retain: true};
  const source = embedDocument(template, base);
  const {html, entry, documentId} = appendEntry(source, "new reply");
  assert.equal(documentId, "test-document-id");
  assert.equal(entry.author, "F");
  assert.equal(entry.html, "<p>new reply</p>");
  const next = parseInstance(html);
  assert.equal(next.meta.revision, 42);
  assert.equal(next.unpublished.retain, true);
  assert.deepEqual(next.notes, base.notes);
  assert.deepEqual(next.media, base.media);
  assert.deepEqual(next.journal, base.journal);
  assert.equal(next.entries[0].id, "human-entry");
  assert.equal(next.entries[0].html, "<p>Rich <em>human</em> writing</p>");
  assert.equal(next.entries[1].id, entry.id);
});

test("template anchor comparison is exact and reviewable when absent", () => {
  const entry = "<p>first river</p><p>second river</p>";
  assert.equal(htmlAnchorPosition(entry, "second river"), "first river\n\nsecond river".indexOf("second river"));
  assert.equal(htmlAnchorPosition(entry, "third river"), null);
  assert.equal(htmlToText(entry), "first river\n\nsecond river");
});

test("FlowSurface renders native rich content and snapshots—not ranges—for Context", async () => {
  const surface = await readFile(new URL("../src/flow/FlowSurface.tsx", import.meta.url), "utf8");
  assert.match(surface, /dangerouslySetInnerHTML=\{\{__html:sanitizeRichHtml\(entry\.html\)\}\}/);
  assert.match(surface, /data-flow-entry=\{entry\.id\}/);
  assert.match(surface, /setSelection\(\{entryId,text:excerpt\}\)/);
  assert.match(surface, /oi:context-candidate/);
  assert.match(surface, /workingCopy:false/);
  assert.match(surface, /revision:instance\.doc\.meta\.revision\.toString\(\)/);
  assert.doesNotMatch(surface, /threadParagraphs/);
});
