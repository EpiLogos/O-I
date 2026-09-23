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
