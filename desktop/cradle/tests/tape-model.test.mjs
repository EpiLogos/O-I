// The tape model (10-SIDEBARS §4.4): the owner's encounter journal → a
// turn-aware event tape. Fixtures are real journal excerpts (aikit encounter
// read), trimmed; synthetic events mirror the same envelopes exactly.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/tape-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const T = await import("../src/agent/tape/model.ts");
const fixture = JSON.parse(readFileSync(new URL("./fixtures/tape-journal.json", import.meta.url), "utf8"));

const signal = (cursor, kind, fields = {}, extra = {}) => ({cursor, event: {kind: "provider", ...extra, event: {Signal: {sequence: cursor, native_session_id: "n", provenance: [], kind: {kind, ...fields}}}}});
const user = (cursor, text, extra = {}) => ({cursor, event: {kind: "user-message", draft_revision: 1, text, ...extra}});
const acpCall = (cursor, id, kind, title, path, extra = {}) => signal(cursor, "tool-call", {payload: {sessionUpdate: "tool_call", toolCallId: id, kind, title, locations: path ? [{path}] : [], status: "pending", ...extra}});
const acpDone = (cursor, id, text, status = "completed") => signal(cursor, "tool-call", {payload: {sessionUpdate: "tool_call_update", toolCallId: id, status, content: [{type: "content", content: {type: "text", text}}]}});
const ended = (cursor, stop) => ({cursor, event: {kind: "provider", event: {TurnEnded: {agent_session: "agent-session/x", stop}}}});

test("a real Pi turn: message, one tool call joined to its result by toolCallId, streamed reply", () => {
  const tape = T.tapeFromJournal(fixture.pi);
  assert.equal(tape.lastCursor, 71);
  const turn = tape.turns.find(t => t.index === 1);
  assert.equal(turn.stop, "completed");
  assert.equal(turn.open, false);
  const verbs = turn.rows.map(row => row.verb);
  assert.deepEqual(verbs, ["you", "tool", "reply"]);
  const tool = turn.rows[1];
  assert.equal(tool.object, "bimba_list_coordinates");
  assert.equal(tool.status, "done");
  assert.equal(tool.calls.length, 1);
  assert.equal(tool.calls[0].id, "call_00_ET_gtx8ngz7nkKdMbabxDVT1213");
  assert.deepEqual(tool.calls[0].input, {limit: 5});
  assert.ok(tool.calls[0].output, "the result is joined to the call");
  assert.deepEqual(tool.cursors, [43, 44]);
  assert.ok(turn.rows[2].text.length > 0, "the reply accumulates its chunks");
  // The binding before any message is the preamble turn.
  assert.equal(tape.turns[0].index, 0);
  assert.match(tape.turns[0].rows[0].object, /connected · pi/);
  // Provider status chatter is counted, never shown.
  assert.ok(tape.quiet >= 3);
  assert.equal(tape.unknown, 0);
});

test("a real ACP turn: an addressed message opens it; search and execute calls settle from their updates", () => {
  const tape = T.tapeFromJournal(fixture.acp);
  const turn = tape.turns.find(t => t.index === 1);
  assert.equal(turn.rows[0].verb, "message");
  assert.match(turn.rows[0].text, /continuing work as agent\/tycho-essay-assistant/);
  const read = turn.rows.find(row => row.verb === "read");
  const run = turn.rows.find(row => row.verb === "run");
  assert.equal(read.object, "corpus");
  assert.equal(read.detail, "/private/tmp/ag-lifecycle-2026-09-20/corpus");
  assert.equal(read.status, "done");
  assert.match(JSON.stringify(read.calls[0].output), /File search results/);
  assert.match(run.object, /^ls -la \/private\/tmp\/ag-lifecycle-2026-09-20\/corpus/);
  assert.equal(run.status, "done");
  assert.ok(turn.rows.some(row => row.verb === "think"));
  assert.equal(turn.stop, "completed");
});

test("repeated calls on the same object coalesce into one row with a count; a different object breaks the run", () => {
  const tape = T.tapeFromJournal([
    user(1, "go"),
    acpCall(2, "a", "read", "read: shell.css", "/src/shell.css"), acpDone(3, "a", "one"),
    acpCall(4, "b", "read", "read: shell.css", "/src/shell.css"), acpDone(5, "b", "two"),
    acpCall(6, "c", "read", "read: shell.css", "/src/shell.css"),
    acpCall(7, "d", "edit", "edit: shell.css", "/src/shell.css"), acpDone(8, "d", "edited"),
    acpDone(9, "c", "three"),
  ]);
  const rows = tape.turns[0].rows;
  assert.deepEqual(rows.map(r => [r.verb, r.object, r.count]), [["you", "go", 1], ["read", "shell.css", 3], ["edit", "shell.css", 1]]);
  const read = rows[1];
  assert.deepEqual(read.calls.map(c => c.output?.[0]?.content?.text), ["one", "two", "three"], "each coalesced call keeps its own exact output");
  assert.equal(read.status, "done", "the row settles once its last call settles");
  assert.deepEqual(read.cursors, [2, 3, 4, 5, 6, 9]);
});

test("filters: All · Edits · Commands · Tools · Waits select by verb", () => {
  const tape = T.tapeFromJournal([
    user(1, "go"), acpCall(2, "a", "read", "read: a", "/a"), acpCall(3, "b", "edit", "edit: b", "/b"),
    acpCall(4, "c", "execute", "terminal: npm test", null), acpCall(5, "d", "other", "mcp: lookup", null),
    signal(6, "permission-requested", {request: {native_request_id: "r1", tool_call: {title: "Run npm run build"}, choices: []}}),
  ]);
  const verbs = filter => T.filterRows(tape.rows, filter).map(r => r.verb);
  assert.deepEqual(T.TAPE_FILTERS.map(f => f.label), ["All", "Edits", "Commands", "Tools", "Waits"]);
  assert.deepEqual(verbs("edits"), ["edit"]);
  assert.deepEqual(verbs("commands"), ["run"]);
  assert.deepEqual(verbs("tools"), ["read", "edit", "run", "tool"]);
  assert.deepEqual(verbs("waits"), ["wait"]);
  assert.equal(verbs("all").length, 6);
  assert.equal(T.filterRows(tape.rows, "commands")[0].object, "npm test");
});

test("time and duration come only from observed times: the owner stamp first, then this window's first sight", () => {
  const stamped = T.tapeFromJournal([
    user(1, "go", {observed_at_ms: 1000}),
    {...acpCall(2, "a", "edit", "edit: shell.css", "/s/shell.css"), event: {...acpCall(2, "a", "edit", "edit: shell.css", "/s/shell.css").event, observed_at_ms: 2000}},
    {...acpDone(3, "a", "ok"), event: {...acpDone(3, "a", "ok").event, observed_at_ms: 14000}},
  ]);
  const edit = stamped.rows.find(r => r.verb === "edit");
  assert.equal(edit.startedAt, 2000);
  assert.equal(edit.durationMs, 12000);
  assert.equal(T.formatDuration(edit.durationMs), "12s");
  const unstamped = T.tapeFromJournal([user(1, "go"), acpCall(2, "a", "edit", "e", "/x"), acpDone(3, "a", "ok")]);
  assert.equal(unstamped.rows[1].startedAt, undefined);
  assert.equal(unstamped.rows[1].durationMs, undefined, "no clock, no duration — never invented");
  const seen = new Map([[2, 500], [3, 1700]]);
  const observed = T.tapeFromJournal([user(1, "go"), acpCall(2, "a", "edit", "e", "/x"), acpDone(3, "a", "ok")], {seenAt: cursor => seen.get(cursor)});
  assert.equal(observed.rows[1].durationMs, 1200);
  assert.equal(T.formatDuration(72_000), "1m 12s");
});

test("a pending permission is a wait row that settles when the turn moves on; a cancelled turn cancels what was running", () => {
  const waiting = T.tapeFromJournal([
    user(1, "build"), acpCall(2, "a", "execute", "terminal: npm run build", null),
    signal(3, "permission-requested", {request: {native_request_id: "r1", tool_call: {title: "npm run build"}, choices: []}}),
  ]);
  const wait = waiting.rows.find(r => r.verb === "wait");
  assert.equal(wait.status, "waiting");
  assert.equal(T.inFlightRow(waiting).id, wait.id, "the status line names the wait");
  const moved = T.tapeFromJournal([...[
    user(1, "build"), acpCall(2, "a", "execute", "terminal: npm run build", null),
    signal(3, "permission-requested", {request: {native_request_id: "r1", tool_call: {title: "npm run build"}, choices: []}}),
  ], signal(4, "agent-message-chunk", {text: "ok"}), ended(5, "Cancelled")]);
  assert.equal(moved.rows.find(r => r.verb === "wait").status, "done");
  assert.equal(moved.rows.find(r => r.verb === "run").status, "cancelled");
  assert.equal(moved.turns[0].stop, "cancelled");
  assert.equal(T.inFlightRow(moved), undefined, "no open turn, nothing in flight");
});

test("work marks: one line per tool row of a turn, linked to the tape row", () => {
  const tape = T.tapeFromJournal([
    user(1, "go", {observed_at_ms: 0}),
    {...acpCall(2, "a", "read", "read: DesktopShell.tsx", "/s/DesktopShell.tsx"), event: {...acpCall(2, "a", "read", "read: DesktopShell.tsx", "/s/DesktopShell.tsx").event, observed_at_ms: 0}},
    {...acpDone(3, "a", "x"), event: {...acpDone(3, "a", "x").event, observed_at_ms: 2000}},
    acpCall(4, "b", "edit", "edit: shell.css", "/s/shell.css"),
  ]);
  const marks = T.workMarksOf(tape, 1);
  assert.deepEqual(marks.map(m => m.line), ["read DesktopShell.tsx · 2s", "editing shell.css · running"]);
  assert.equal(marks[0].rowId, "c2");
  assert.equal(T.inFlightRow(tape).object, "shell.css");
});

test("unknown shapes are counted, never guessed at", () => {
  const tape = T.tapeFromJournal([{cursor: 1, event: "nonsense"}, {cursor: 2, event: {kind: "provider", event: {Signal: {kind: {kind: "brand-new-signal"}}}}}]);
  assert.equal(tape.unknown, 2);
  assert.equal(tape.rows.length, 0);
});

test("a stop the person asked for closes the turn as stopped even when the provider reports an abort as a failure", () => {
  const tape = T.tapeFromJournal([
    user(1, "sleep"), acpCall(2, "a", "execute", "terminal: sleep 40", null),
    signal(3, "failed", {reason: "This operation was aborted"}),
    {cursor: 4, event: {kind: "provider", event: {TurnEnded: {stop: {Failed: {reason: "This operation was aborted"}}, interruption: {origin: "Human", reason: "User stopped the encounter", commands: ["abort"]}}}}},
  ]);
  assert.equal(tape.turns[0].stop, "cancelled");
  assert.equal(T.turnStopFromEnd(tape, 0), "cancelled");
  assert.equal(tape.rows.find(r => r.verb === "run").status, "failed", "what the abort cut short keeps its own ending");
});

// be2i ruling 7 (DLW build ruling 2026-11-09): an agent's words and the names its tools report reach the tape plain, through the shared set
// (shared/plainText.ts), so no bidi control reorders a row and no control or invisible character stands in one.
test("the tape reads an agent's words and its tools' names plain: no bidi control, control or invisible character stands in a row (be2i)", () => {
  const tape = T.tapeFromJournal([user(1, "Fix \u202ethe\u0007bug\u200b\u3164"), acpCall(2, "c1", "read", "Read", "/tmp/notes\u202etxt.exe"),
    acpCall(3, "c2", "execute", "ls\u2066 -la\u2069", null)]);
  const rows = tape.turns.flatMap(turn => turn.rows);
  assert.deepEqual(rows.map(row => [row.verb, row.object]), [["you", "Fix the bug"], ["read", "notestxt.exe"], ["run", "ls -la"]]);
  for (const row of rows) assert.ok(!/[\p{Cc}\p{Cf}\u3164]/u.test(row.object), JSON.stringify(row.object));
});

// be2j ruling 6 (DLW build ruling 2026-11-09; the review's T7): a row's one line holds one space where its words held a run of white
// space, a control character or a line or paragraph separator, and no white space at either end.
test("one line is one line: each run of white space, a control or a separator stands as one space, trimmed (be2j T7)", async () => {
  const {oneLineText} = await import("../src/shared/plainText.ts");
  assert.equal(oneLineText(" two \t\u2028\u2029 words\n\n and\u0007\u200b  more "), "two words and more");
  const tape = T.tapeFromJournal([user(1, "Look  \u2028 here\n\nnow")]);
  assert.equal(tape.rows[0].object, "Look here now");
});

// be2j ruling 3 (DLW build ruling 2026-11-09): what the tape shows of an agent's words in full, a message's text, a tool's target and
// the row's own title, is plain too, in a block (shared/plainText.ts blockText): its line breaks kept, a separator a line break, no bidi
// control and nothing invisible. The row keeps the words as the journal gave them, so the paths a turn edited stay the tool's own.
test("the tape shows a message's text, a tool's target and a row's title plain in a block, its lines kept; the row keeps the journal's words (be2j)", async () => {
  const {build} = await import("esbuild");
  const {mkdtemp, rm} = await import("node:fs/promises");
  const {join} = await import("node:path");
  const {pathToFileURL, fileURLToPath} = await import("node:url");
  const {createElement} = await import("react");
  const {renderToStaticMarkup} = await import("react-dom/server");
  const here = fileURLToPath(new URL(".", import.meta.url));
  const temp = await mkdtemp(join(here, ".tape-row-"));
  try {
    await build({entryPoints: {row: join(here, "../src/agent/tape/Tape.tsx")}, bundle: true, platform: "node", format: "esm", jsx: "automatic",
      loader: {".css": "empty"}, external: ["react", "react-dom", "react/jsx-runtime"], outdir: temp, outExtension: {".js": ".mjs"}, logLevel: "error"});
    const {TapeRowView} = await import(pathToFileURL(join(temp, "row.mjs")));
    const said = "Fix \u202ethe\u202c bug\u2028then\u200b\u3164 test\nit";
    const tape = T.tapeFromJournal([user(1, said), acpCall(2, "c1", "read", "Read", "/tmp/notes\u202etxt.exe")]);
    const [you, read] = tape.turns.flatMap(turn => turn.rows);
    assert.deepEqual([you.text, read.detail], [said, "/tmp/notes\u202etxt.exe"], "the row keeps the journal's words");
    const drawn = row => renderToStaticMarkup(createElement(TapeRowView, {row: {...row, events: []}, open: true, onToggle: () => {}}));
    const message = drawn(you), target = drawn(read);
    assert.ok(message.includes('<p class="tape-text">Fix the bug\nthen test\nit</p>'), message);
    assert.ok(message.includes('title="Fix the bug\nthen test\nit"'), message);
    assert.ok(target.includes("<span>Target</span>/tmp/notestxt.exe</p>"), target);
    for (const markup of [message, target]) assert.ok(!/[\p{Cf}\u2028\u2029\u3164]/u.test(markup), JSON.stringify(markup));
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
});

// be2k ruling 2 (DLW build ruling 2026-11-10): an event's own page draws what the tape does, plain. Its title and What on one line, a
// message's words and a call's input values and output as a block (shared/plainText.ts), and Show raw verbatim with each character of the
// set written as its escape. In a block a bell and a carriage return between words are spaces (be2k ruling 8). The page reads the events
// again from the owner, here a walk bridge that answers with the journal's words.
test("an event's page shows its title, its words, a call's input and its output plain, and Show raw as escapes (be2k)", async () => {
  const {build} = await import("esbuild");
  const {mkdtemp, rm} = await import("node:fs/promises");
  const {join} = await import("node:path");
  const {pathToFileURL, fileURLToPath} = await import("node:url");
  const {createElement} = await import("react");
  const {renderToStaticMarkup} = await import("react-dom/server");
  const here = fileURLToPath(new URL(".", import.meta.url));
  const src = join(here, "../src/agent/objects");
  const temp = await mkdtemp(join(here, ".tape-object-"));
  const journal = [user(1, "Fix \u202ethe\u202c bug\u2028then\u200b\u0007test\rnow"),
    signal(2, "tool-call", {payload: {type: "tool_execution_start", toolCallId: "p1", toolName: "sea\u202erch\u200b", args: {"no\u2066te": "two\u202e\nlines\u200b", depth: 2}}}),
    signal(3, "tool-result", {payload: {type: "tool_execution_end", toolCallId: "p1", toolName: "sea\u202erch\u200b", result: "found\u2066 it\nnext\u200b"}})];
  const fetched = globalThis.fetch;
  globalThis.fetch = async (_url, {body}) => {
    const {request} = JSON.parse(body);
    const events = journal.filter(event => event.cursor === request.after + 1);
    return {json: async () => ({ok: true, outcome: {result: "encounter_reading", data: {agent_session: request.agent_session, events, next_cursor: request.after + 1, more: false}}})};
  };
  try {
    await build({stdin: {contents: `export {objectKindOf} from ${JSON.stringify(join(src, "registry.ts"))};\nexport {ObjectPageReading} from ${JSON.stringify(join(src, "ObjectPage.tsx"))};\nimport ${JSON.stringify(join(src, "kinds.tsx"))};`, resolveDir: src, loader: "ts"},
      bundle: true, platform: "node", format: "esm", jsx: "automatic", loader: {".css": "empty"}, external: ["react", "react-dom", "react/jsx-runtime", "@tauri-apps/*"],
      outfile: join(temp, "page.mjs"), logLevel: "error"});
    const {objectKindOf, ObjectPageReading} = await import(pathToFileURL(join(temp, "page.mjs")));
    const def = objectKindOf("tape-event"), transport = {kind: "bridge", url: "http://walk.test"};
    const page = async ref => {
      const object = {kind: "tape-event", project: "O-I", ref: `agent-session/x#${ref}`, title: "event"};
      const reading = await def.read(object, {transport});
      return {reading, markup: renderToStaticMarkup(createElement(ObjectPageReading, {object, def, reading})).replace(/<!-- -->/g, "")};
    };
    const message = await page("1"), call = await page("2,3");
    assert.equal(message.reading.title, "Fix the bug then test now");
    assert.ok(message.markup.includes('<p class="object-text">Fix the bug\nthen test now</p>'), message.markup);
    assert.equal(call.reading.title, "tool search");
    assert.deepEqual(call.reading.fields[0], {label: "What", value: "tool · search"});
    assert.ok(call.markup.includes("<dt>note</dt><dd>two\nlines</dd><dt>depth</dt><dd>2</dd>"), call.markup);
    assert.ok(call.markup.includes(">found it\nnext</dd>"), call.markup);
    for (const {markup} of [message, call]) {
      const shown = markup.replace(/<details class="object-raw">.*?<\/details>/s, "");
      assert.ok(!/[\p{Cf}\u2028\u2029\u3164]/u.test(markup), JSON.stringify(markup));
      assert.notEqual(shown, markup, "the page has its Show raw");
    }
    assert.ok(call.markup.includes("sea\\u202erch\\u200b"), "Show raw keeps the tool's name, its override and its zero width as escapes");
  } finally {
    globalThis.fetch = fetched;
    await rm(temp, {recursive: true, force: true});
  }
});

// ── be2l (DLW build ruling 2026-11-10): the follow-ups of the review of be2k ─────────────────────────────────────────────────────────
// Each surface that draws someone else's words is pinned by a drawing of it, so a surface that goes back to raw text fails a test.
const SET_2L = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u;
/** A backslash: an escape is spelled with it here, so this file holds none of the characters it tests for. */
const BS = String.fromCharCode(92);
const bundled2l = async (prefix, options, run) => {
  const {build} = await import("esbuild");
  const {mkdtemp, rm} = await import("node:fs/promises");
  const {join} = await import("node:path");
  const {pathToFileURL, fileURLToPath} = await import("node:url");
  const here = fileURLToPath(new URL(".", import.meta.url));
  const temp = await mkdtemp(join(here, prefix));
  try {
    await build({...options(here), bundle: true, platform: "node", format: "esm", jsx: "automatic", loader: {".css": "empty"},
      external: ["react", "react-dom", "react/jsx-runtime", "@tauri-apps/*"], outfile: join(temp, "out.mjs"), logLevel: "error"});
    return await run(await import(pathToFileURL(join(temp, "out.mjs"))));
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
};
const objects2l = run => bundled2l(".tape-object-", here => {
  const src = `${here}../src/agent/objects`;
  return {stdin: {contents: `export {objectKindOf} from ${JSON.stringify(`${src}/registry.ts`)};\nexport {ObjectPageReading} from ${JSON.stringify(`${src}/ObjectPage.tsx`)};\nimport ${JSON.stringify(`${src}/kinds.tsx`)};`, resolveDir: src, loader: "ts"}};
}, run);

// be2l ruling 1: the tape row's own Show raw, and a call whose whole input is a string.
test("a tape row's Show raw holds its events with each character of the set as its escape, and a call's string input is drawn plain in a block (be2l ruling 1)", async () => {
  const {createElement} = await import("react");
  const {renderToStaticMarkup} = await import("react-dom/server");
  await bundled2l(".tape-row-", here => ({entryPoints: [`${here}../src/agent/tape/Tape.tsx`]}), ({TapeRowView}) => {
    const tape = T.tapeFromJournal([user(1, "Fix \u{202e}the\u{200b} bug"), acpCall(2, "c1", "execute", "Run", null)]);
    const [you, run] = tape.turns.flatMap(turn => turn.rows);
    const drawn = row => renderToStaticMarkup(createElement(TapeRowView, {row, open: true, onToggle: () => {}})).replace(/<!-- -->/g, "");
    const message = drawn(you);
    const raw = /<details class="tape-raw"><summary>Show raw<\/summary><pre>(.*?)<\/pre>/s.exec(message)?.[1] ?? "";
    assert.ok(raw.includes(`Fix ${BS}u202ethe${BS}u200b bug`), `Show raw holds the words with their escapes: ${raw}`);
    assert.ok(!SET_2L.test(message), JSON.stringify(message));
    const call = drawn({...run, calls: [{...run.calls[0], input: "ls\u{202e} -la\n\tdocs\u{200b}"}]});
    assert.ok(call.includes("<dt>input</dt><dd>ls -la\n\tdocs</dd>"), call);
    assert.ok(!SET_2L.test(call), JSON.stringify(call));
  });
});

// be2l rulings 4 and 8: the raw view's escapes. DEL and the C1 controls, each UTF-16 unit of a character past the BMP, four digits
// each; a backslash is doubled, so a string that already reads as an escape is not confused with the character. JSON doubles its own
// backslashes, and escapedJson leaves them as JSON wrote them. A tab stays in a block.
test("escapedText writes DEL, C1 and each UTF-16 unit as four-digit escapes and doubles a backslash; escapedJson is JSON's own and says undefined; a block keeps a tab (be2l rulings 4, 8)", async () => {
  const {escapedText, escapedJson, blockText} = await import("../src/shared/plainText.ts");
  assert.equal(escapedText("a\u{7f}b\u{85}c\u{9f}d"), `a${BS}u007fb${BS}u0085c${BS}u009fd`, "DEL and the C1 controls");
  assert.equal(escapedText("x\u{e0041}y"), `x${BS}udb40${BS}udc41y`, "each UTF-16 unit of a tag character");
  assert.equal(escapedText("so\u{ad}ft"), `so${BS}u00adft`, "four digits");
  assert.equal(escapedText(`a${BS}u202eb\u{202e}c${BS}`), `a${BS}${BS}u202eb${BS}u202ec${BS}${BS}`, "a backslash is doubled: the text that reads as an escape is not the character");
  assert.equal(escapedJson({a: `b${BS}u202e\u{202e}`}), `{"a":"b${BS}${BS}u202e${BS}u202e"}`, "JSON doubled the backslash already: once");
  assert.equal(escapedJson(undefined), "undefined");
  assert.equal(escapedJson(() => 1, 1), "() => 1");
  assert.equal(blockText("a\tb\u{7}c\rd\u{2028}e"), "a\tb c d\ne");
});

// be2l ruling 4: a row whose words show nothing gives its page the object's own title.
test("an event's page whose words show nothing is titled as the object that opened it (be2l ruling 4)", async () => {
  const journal = [user(1, "\u{200b}\u{3164}\u{202e}")];
  const fetched = globalThis.fetch;
  globalThis.fetch = async (_url, {body}) => {
    const {request} = JSON.parse(body);
    const events = journal.filter(event => event.cursor === request.after + 1);
    return {json: async () => ({ok: true, outcome: {result: "encounter_reading", data: {agent_session: request.agent_session, events, next_cursor: request.after + 1, more: false}}})};
  };
  try {
    await objects2l(async ({objectKindOf}) => {
      const object = {kind: "tape-event", project: "O-I", ref: "agent-session/x#1", title: "You said"};
      const reading = await objectKindOf("tape-event").read(object, {transport: {kind: "bridge", url: "http://walk.test"}});
      assert.equal(reading.title, "You said");
    });
  } finally {
    globalThis.fetch = fetched;
  }
});

// be2l ruling 8: an object's page draws every word it was handed plain: the kind and the reference of an object with no page, a
// refused read's reason, a field's value and a relation's label and text. A reference is still offered behind Inspect, read from its
// plain form. The page's own data attributes keep the identity as it is. Show raw of a string is the string, with its escapes.
test("an object's page draws its kind, its reference, a refusal, a field's value and a relation plain; a string's Show raw is the string with escapes (be2l ruling 8)", async () => {
  const {createElement} = await import("react");
  const {renderToStaticMarkup} = await import("react-dom/server");
  await objects2l(({ObjectPageReading}) => {
    const object = {kind: "no\u{202e}te", ref: "central:no\u{200b}te/1", title: "A note"};
    const def = {kind: "note", label: "Note", glyph: "activity", read: async () => ({})};
    const drawn = props => renderToStaticMarkup(createElement(ObjectPageReading, {object, ...props})).replace(/<!-- -->/g, "");
    const shown = markup => markup.replace(/ data-object-(kind|ref)="[^"]*"/g, "");
    const bare = drawn({});
    assert.ok(bare.includes("<dt>Kind</dt><dd>note</dd><dt>Reference</dt><dd>central:note/1</dd>"), bare);
    const refused = drawn({def, error: "No\u{202e} such\u{2028}file\u{200b} here"});
    assert.ok(refused.includes("<p>No such file here</p><p>central:note/1</p>"), refused);
    const read = drawn({def, reading: {kindLabel: "Note", title: "A note", fields: [{label: "Path", value: "notes\u{202e}/plan\u{200b}.md"}, {label: "Source", value: "central:wi\u{200b}ki/root"}, {label: "Size", value: 3}],
      relations: [{label: "Wri\u{202e}tten by", text: "Ma\u{2066}ra\u{2069}"}, {label: "From", text: "world:ma\u{200b}ra/page"}], raw: `two${BS}u202e\u{202e}\nlines\u{200b}`}});
    assert.ok(read.includes("<dt>Path</dt><dd>notes/plan.md</dd>"), read);
    assert.ok(read.includes("<dt>Source</dt><dd><details><summary>Inspect source</summary>central:wiki/root</details></dd><dt>Size</dt><dd>3</dd>"), read);
    assert.ok(read.includes('<span class="object-relation-label">Written by</span><span>Mara</span>'), read);
    assert.ok(read.includes('<span class="object-relation-label">From</span><details><summary>Inspect related source 2</summary>world:mara/page</details>'), read);
    assert.ok(read.includes(`<summary>Show raw</summary><pre>two${BS}${BS}u202e${BS}u202e\nlines${BS}u200b</pre>`), read);
    for (const markup of [bare, refused, read]) assert.ok(!SET_2L.test(shown(markup)), JSON.stringify(markup));
  });
});

// be2n ruling 4 (DLW build ruling 2026-11-11): the page's title (the heading and the page's own name), its kind's label, its state, a
// field's label and a related object's name are the owner's words: each is drawn on one plain line. One that shows nothing gives way:
// the title to the opening object's and then to "Unnamed object", the kind to the registered kind's, a related object to its ordinal;
// a state that shows nothing is not drawn.
test("an object's page draws its title, its kind's label, its state, a field's label and a related object's name plain (be2n ruling 4)", async () => {
  const {createElement} = await import("react");
  const {renderToStaticMarkup} = await import("react-dom/server");
  await objects2l(({ObjectPageReading}) => {
    const object = {kind: "note", ref: "central:note/1", title: "The op\u{200b}ening note"};
    const def = {kind: "note", label: "Note", glyph: "activity", read: async () => ({})};
    const drawn = reading => renderToStaticMarkup(createElement(ObjectPageReading, {object, def, reading})).replace(/<!-- -->/g, "");
    const read = drawn({kindLabel: "Field\u{202e} note", title: "A no\u{200b}te of\u{2028}the day", state: "Dra\u{202e}ft", fields: [{label: "Pa\u{200b}th\u{202e}", value: "notes/plan.md"}],
      relations: [{label: "By", object: {kind: "person", ref: "world:mara", title: "Ma\u{2066}ra\u{2069}"}}, {label: "Of", object: {kind: "note", ref: "central:note/2", title: "\u{200b}\u{3164}"}}]});
    assert.ok(read.includes('<article class="object-page" aria-label="Note: A note of the day"'), read);
    assert.ok(read.includes('<p class="object-kind">Field note</p><h1 class="object-title">A note of the day</h1><p class="object-state">Draft</p>'), read);
    assert.ok(read.includes("<dt>Path</dt><dd>notes/plan.md</dd>"), read);
    assert.ok(/<button type="button" class="object-link" data-object-ref="world:mara"[^>]*>Mara<\/button>/.test(read), read);
    assert.ok(/<button type="button" class="object-link" data-object-ref="central:note\/2"[^>]*>Unnamed related object 2<\/button>/.test(read), read);
    assert.ok(!SET_2L.test(read), JSON.stringify(read));
    const blank = drawn({kindLabel: "\u{200b}", title: "\u{202e}\u{3164}", state: "\u{200b}", fields: []});
    assert.ok(blank.includes('aria-label="Note: The opening note"'), blank);
    assert.ok(blank.includes('<p class="object-kind">Note</p><h1 class="object-title">The opening note</h1></div>'), blank);
    assert.ok(!SET_2L.test(blank), JSON.stringify(blank));
    const nameless = renderToStaticMarkup(createElement(ObjectPageReading, {object: {kind: "note", ref: "central:note/3", title: "\u{200b}"}, def, reading: {title: "\u{2066}", fields: []}}));
    assert.ok(nameless.includes('<h1 class="object-title">Unnamed object</h1>'), nameless);
  });
});
