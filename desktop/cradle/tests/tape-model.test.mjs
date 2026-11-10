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
