// Usage and lane marks from a real Pi journal (lane 3, 11-FACTORY §3.3 F9/F10):
// footer stats are the journal's own message_end usage sums — turn_end repeats
// are not counted twice — and lane marks carry owner timestamps only.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/tape-usage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const M = await import("../src/agent/tape/model.ts");
const {events} = JSON.parse(readFileSync(new URL("./fixtures/tape-usage-journal.json", import.meta.url), "utf8"));

test("usage sums equal an independent sum of assistant message_end usage", () => {
  const tape = M.tapeFromJournal(events);
  const usage = M.journalUsage(events, tape);
  let input = 0, output = 0, cacheRead = 0, cost = 0, steps = 0;
  for (const {event} of events) {
    const message = event?.event?.Signal?.kind?.message;
    if (!message) continue;
    const parsed = JSON.parse(message);
    if (parsed.type !== "message_end" || parsed.message.role !== "assistant" || !parsed.message.usage) continue;
    steps++; input += parsed.message.usage.input; output += parsed.message.usage.output; cacheRead += parsed.message.usage.cacheRead; cost += parsed.message.usage.cost.total;
  }
  assert.ok(steps > 0);
  assert.equal(usage.steps, steps);
  assert.equal(usage.input, input);
  assert.equal(usage.output, output);
  assert.equal(usage.cacheRead, cacheRead);
  assert.ok(Math.abs(usage.cost - cost) < 1e-9);
  assert.ok(usage.firstAt > 0 && usage.lastAt >= usage.firstAt);
});

test("a journal with no owner stamps has no times and no usage — never zeros", () => {
  const quiet = [{cursor: 1, event: {kind: "user-message", draft_revision: 1, text: "hi"}}];
  const tape = M.tapeFromJournal(quiet);
  const usage = M.journalUsage(quiet, tape);
  assert.equal(usage.steps, 0);
  assert.equal(usage.input, undefined);
  assert.equal(usage.cost, undefined);
  assert.equal(usage.firstAt, undefined);
  assert.ok(M.laneMarks(quiet, tape).every(mark => mark.at === undefined));
});

test("lane marks: input, model and tools, each mapped to a tape row", () => {
  const tape = M.tapeFromJournal(events);
  const marks = M.laneMarks(events, tape);
  assert.ok(marks.some(mark => mark.lane === "input") && marks.some(mark => mark.lane === "model") && marks.some(mark => mark.lane === "tools"));
  assert.ok(marks.filter(mark => mark.lane === "model").every(mark => typeof mark.at === "number"), "every model step carries its owner timestamp");
  assert.ok(marks.every(mark => !mark.rowId || tape.rows.some(row => row.id === mark.rowId)));
});
