import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {readDocumentIdentity, islandSpan, serialiseQlDoc, FAMILY_LABEL} from "../src/document/identity.ts";
import {inPlacePlacementFor, stampCopy} from "../src/flow/placement.ts";

const documents = new URL("../documents/", import.meta.url);
const read = async name => readFile(new URL(name, documents), "utf8");

test("identity: every retained ql-doc family classifies from its own island", async () => {
  const flow = readDocumentIdentity(await read("ql-dialogue-flow.html"));
  assert.equal(flow.family, "flow");
  assert.equal(flow.payload, "ql-doc");
  assert.equal(flow.templateRef, "ql-dialogue-flow v0.1");
  // The authored form (owner, 2026-09-26): same 0/1 family, no paste
  // intake, no seeded entry — classified from its own island like any form.
  // v0.3 authorship is declared identity: participants, kind-keyed
  // attribution, and no hardcoded F/H authorship decisions.
  const flowV3 = readDocumentIdentity(await read("ql-flow.html"));
  assert.equal(flowV3.family, "flow");
  assert.equal(flowV3.payload, "ql-doc");
  assert.equal(flowV3.templateRef, "ql-dialogue-flow v0.4");
  const flowV3Source = await read("ql-flow.html");
  assert.ok(!/dlg-agent|agent-json/.test(flowV3Source), "the form carries no paste-an-agent-return intake");
  assert.ok(/data-k=agent/.test(flowV3Source), "attribution styling keys on the declared kind");
  assert.ok(/participantOf/.test(flowV3Source), "authorship resolves through declared participants");
  assert.ok(/QlPlural\.authorOf/.test(flowV3Source), "v0.4 authorship resolves through participant keys, not initials alone");
  const day = readDocumentIdentity(await read("ql-daily-die.html"));
  assert.equal(day.family, "day");
  assert.equal(day.payload, "ql-doc");
  const beings = readDocumentIdentity(await read("oi-beings.html"));
  assert.equal(beings.family, "beings");
  assert.equal(beings.documentRevision, 0);
  assert.equal(FAMILY_LABEL[beings.family], "Beings");
});

test("identity: the mockup template carries provenance relations, not a ql-doc payload", async () => {
  const mockup = readDocumentIdentity(await read("ui-mockup-template.html"));
  assert.equal(mockup.family, "mockup");
  assert.equal(mockup.payload, "mockup-provenance");
  assert.equal(mockup.documentId, "[product]-[surface]-mockup");
  assert.ok(mockup.relations.design_refs.length >= 1);
  assert.ok(mockup.relations.vision_refs.length >= 1);
  assert.ok(mockup.relations.capability_refs.length >= 1);
});

test("identity: absent payload islands stay unknown — nothing is fabricated", async () => {
  assert.equal(readDocumentIdentity(await read("oi-epi-card.html")), undefined, "the realized Epi-Card carrier keeps no savable ql-doc island");
  assert.equal(readDocumentIdentity("<!doctype html><html><body>plain</body></html>"), undefined);
  assert.equal(readDocumentIdentity(undefined), undefined);
  assert.equal(readDocumentIdentity('<script type="application/json" id="ql-doc">{broken</script>'), undefined);
});

test("identity: the island span splices exactly — outside bytes are the template's", async () => {
  const source = await read("ql-dialogue-flow.html");
  const before = source;
  const span = islandSpan(source, "ql-doc");
  assert.ok(span, "the flow island is found");
  const edited = JSON.stringify({...JSON.parse(span.text), notes: [{id: "n1", text: "authored"}]});
  const spliced = source.slice(0, span.start) + edited + source.slice(span.end);
  assert.notEqual(spliced, before);
  assert.equal(spliced.length, before.length - span.text.length + edited.length);
  const outside = index => spliced.slice(0, index) + spliced.slice(index + edited.length);
  assert.equal(outside(span.start), before.slice(0, span.start) + before.slice(span.end));
  // The spliced island still parses and carries the authored note.
  assert.deepEqual(JSON.parse(islandSpan(spliced, "ql-doc").text).notes, [{id: "n1", text: "authored"}]);
  assert.equal(islandSpan(source, "mockup-provenance"), undefined);
});

test("identity: serialisation keeps text from closing the script island", () => {
  const serial = serialiseQlDoc({meta: {title: "</script><script>alert(1)</script>"}});
  assert.ok(serial.includes("\\u003c/script>"));
  assert.deepEqual(JSON.parse(serial), {meta: {title: "</script><script>alert(1)</script>"}});
});

test("placement: vision is one per project at the ground root; mockups are dated and many", () => {
  assert.equal(inPlacePlacementFor({kind: "document-vision", label: "Vision"}, {project: "O-I"}, "2026-09-25-1012"), "oi.html");
  assert.match(inPlacePlacementFor({kind: "document-mockup", label: "Mockup"}, {project: "O-I"}, "2026-09-25-1012"), /^mockup-mockup-2026-09-25-1012\.html$/);
  assert.match(inPlacePlacementFor({kind: "document-mockup", label: "Mockup"}, {project: "O-I"}, "2026-09-25-1012", 1), /-2\.html$/, "collisions get a numeric suffix");
  assert.equal(inPlacePlacementFor({kind: "document-goal", label: "Goal"}, {project: "O-I", telos: true}, "2026-09-25-1012"), "telos/goal-2026-09-25-1012.html");
});

test("creation stamp: the copy keeps every template byte except a fresh identity", async () => {
  const template = await read("ql-daily-die.html");
  const fixed = "123e4567-e89b-12d3-a456-426614174000";
  const now = new Date("2026-09-25T10:12:00");
  const copy = stampCopy(template, now, () => fixed);
  // Only the identity's values move, where the template writes them, with the template's own spacing (#803): every other
  // byte, inside the island and out, is the template's.
  assert.equal(copy, template
    .replace('"uuid": null', `"uuid": "${fixed}"`)
    .replace('"created": null', `"created": "${now.toISOString()}"`)
    .replace('"date": null', '"date": "2026-09-25"'));
  // The island itself parses back with the fresh identity and the day stamp.
  const open = "<script type=\"application/json\" id=\"ql-doc\">";
  const head = copy.indexOf(open);
  const island = JSON.parse(copy.slice(head + open.length, copy.indexOf("</script>", head)));
  assert.equal(island.meta.uuid, fixed);
  assert.equal(new Date(island.meta.created).getTime(), now.getTime(), "created is the same civil moment");
  assert.equal(island.meta.date, "2026-09-25");
  // A template without an island is copied verbatim.
  assert.equal(stampCopy("<html><body>no island</body></html>"), "<html><body>no island</body></html>");
});

test("creation stamp: a form's island keeps its key order, spellings and escapes; only the identity moves (#803)", async () => {
  const fixed = "123e4567-e89b-12d3-a456-426614174000";
  const now = new Date("2026-09-25T10:12:00");
  const created = `"${now.toISOString()}"`;
  // Every form that copies in place (Beings, Things, goal, vision): its documentId and created, and nothing else.
  for (const name of ["oi-beings.html", "oi-things.html", "oi-goal.html", "oi-vision.html"]) {
    const template = await read(name);
    assert.equal(stampCopy(template, now, () => fixed), template.replace('"documentId":null', `"documentId":"${fixed}"`).replace('"created":null', `"created":${created}`), name);
  }
  // A person's own template as written: spacing, key order, a number spelt 3.0 or 1e2, an integer past 2^53, a bare `<` and
  // markup in text, and an escaped `<\/SCRIPT>` with its letters. The stamp writes the identity through the host's splice
  // (plural.ts spliceIsland), so none of them is respelt.
  const page = island => `<!doctype html><html><body><main></main>\n<script type="application/json" id="ql-doc">${island}</script>\n<script>/* page */</script></body></html>`;
  const written = text => `{\n  "profile": "oi.page/v1",\n  "meta": {"title": "${text}", "revision": 3.0, "documentId": null, "created" : null, "big": 9007199254740993},\n  "bindings": {"count": 1e2, "z": "first", "a": "second"}\n}`;
  const stamped = text => written(text).replace('"documentId": null', `"documentId": "${fixed}"`).replace('"created" : null', `"created" : ${created}`);
  const text = "a <b>bold</b> claim, 2 < 3, and <\\/SCRIPT> as written";
  assert.equal(stampCopy(page(written(text)), now, () => fixed), page(stamped(text)), "every island byte but the identity's values stays as written");
  // The legacy `<\!--` escape reads as every Flow reader reads it (plural.ts readIsland, flow/instance.ts parseInstance), so a
  // template holding it is stamped too, never copied with the template's own identity.
  const legacy = `${text}, and <\\!-- a comment opening`;
  assert.equal(stampCopy(page(written(legacy)), now, () => fixed), page(stamped(legacy)), "a template with the legacy comment escape is stamped and kept");
});

const bridgeSource = await readFile(new URL("../src/context/document-host.js", import.meta.url), "utf8");

function bridgeSandbox(islands, docRole) {
  const replies = [];
  const listeners = [];
  const island = payload => islands[payload];
  const context = {
    window: {},
    parent: {postMessage: reply => replies.push(reply)},
    document: {
      body: {getAttribute: attribute => docRole ?? null},
      getElementById: id => island(id) === undefined ? null : {textContent: island(id)},
    },
  };
  context.window = context.window;
  vm.createContext(context);
  vm.runInContext(bridgeSource, context);
  listeners.push(message => context.window.__OI_DOCUMENT_HOST__ && null);
  return {
    context,
    replies,
    send(message) {
      const receive = message;
      // The bridge subscribes through window.addEventListener; drive it via
      // the captured subscription below.
      context.__deliver?.(receive);
    },
  };
}

test("document host bridge: answers only the parent, only op read, only once registered", async () => {
  const flowIsland = (await read("ql-dialogue-flow.html")).match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)[1];
  const context = {
    window: {addEventListener: (kind, handler) => { context.__deliver = handler; }},
    parent: {postMessage: reply => context.__replies.push(reply)},
    document: {
      body: {getAttribute: () => null},
      getElementById: id => id === "ql-doc" ? {textContent: flowIsland} : null,
    },
    __replies: [],
  };
  context.window = context.window;
  vm.createContext(context);
  vm.runInContext(bridgeSource, context);
  assert.ok(context.__deliver, "the bridge subscribes to messages");
  const deliver = (data, source) => context.__deliver({data, source});
  deliver({type: "oi:document-host-request", request: "r1", op: "read"}, {some: "other window"});
  assert.equal(context.__replies.length, 0, "a message from another source is ignored");
  deliver({type: "oi:document-host-request", request: "r2", op: "write", value: "rewritten"}, context.parent);
  assert.equal(context.__replies.length, 0, "no op other than read is answered");
  deliver({type: "oi:page-context-request", request: "r3", op: "read"}, context.parent);
  assert.equal(context.__replies.length, 0, "another bridge's envelope is ignored");
  deliver({type: "oi:document-host-request", request: "r4", op: "read"}, context.parent);
  assert.equal(context.__replies.length, 1);
  assert.equal(context.__replies[0].type, "oi:document-host-response");
  assert.equal(context.__replies[0].request, "r4");
  assert.equal(context.__replies[0].result.present, true);
  assert.equal(context.__replies[0].result.payload, "ql-doc");
  assert.deepEqual(JSON.parse(context.__replies[0].result.text), JSON.parse(flowIsland));
  assert.equal(context.__replies[0].result.revision, 0);
});

test("document host bridge: a page without islands answers present:false, honestly", async () => {
  const context = {
    window: {addEventListener: (kind, handler) => { context.__deliver = handler; }},
    parent: {postMessage: reply => context.__replies.push(reply)},
    document: {body: {getAttribute: attribute => attribute === "data-doc-role" ? "mockup" : null}, getElementById: () => null},
    __replies: [],
  };
  context.window = context.window;
  vm.createContext(context);
  vm.runInContext(bridgeSource, context);
  context.__deliver({data: {type: "oi:document-host-request", request: "r1", op: "read"}, source: context.parent});
  assert.equal(context.__replies[0].result.present, false);
  assert.equal(context.__replies[0].result.docRole, "mockup");
});

test("host boundary: the bridge script carries no authority and the frame stays opaque-origin", async () => {
  assert.doesNotMatch(bridgeSource, /fetch|XMLHttpRequest|localStorage|indexedDB|require\(|import\(/, "the page-side bridge performs no IO");
  const material = await readFile(new URL("../src/material/MaterialSurface.tsx", import.meta.url), "utf8");
  assert.match(material, /sandbox="allow-scripts allow-forms allow-downloads"/);
  assert.doesNotMatch(material, /allow-same-origin/, "a document frame never shares the app's origin");
  // The native-save route crosses the host, never the page: the page-side
  // bridge script names no owner operation at all.
  assert.doesNotMatch(bridgeSource, /source\.write|file_operation|invoke_action|kernel/);
});
