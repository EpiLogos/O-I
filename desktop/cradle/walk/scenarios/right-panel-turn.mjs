import {readFileSync, existsSync} from "node:fs";
import {join} from "node:path";
import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral, docText} from "../editor-doc.mjs";
import {openPanel, planeButton, recordCalls, restoreScope} from "../lane2-support.mjs";

/** Real turns in the right panel (10-SIDEBARS §4.3–§4.4; P1 P4 P6 P7 P16, and the
 *  tape): the existing pi provider (GLM) runs real tool calls in a disposable
 *  project, through the real kernel and the lane's AIKit build (owner-stamped
 *  journal times). Isolated AIKIT_HOME; nothing of the owner's state is touched. */
export async function setup(options) { return canvasSetup(options); }

const SESSION_TITLE = "Canvas editor and prepared context acceptance";
const TURN_1 = "Use your bash tool to run `ls -1` in the current directory. Then use your write tool to create a file named turn-note.md whose whole content is the line: tape walk. Then reply with one short sentence.";
const TURN_2 = "Use your bash tool five separate times, one command per call, waiting for each: `sleep 2 && echo one`, `sleep 2 && echo two`, `sleep 2 && echo three`, `sleep 2 && echo four`, `sleep 2 && echo five`. Then reply with the word done.";
const TURN_3 = "Use your bash tool to run `sleep 40 && echo late` and wait for it.";

const box = async locator => { const b = await locator.boundingBox(); return b && {x: b.x, y: b.y, w: b.width, h: b.height, right: b.x + b.width, cy: b.y + b.height / 2}; };

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const calls = recordCalls(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await restoreScope(page, "Editor");
  let panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  await panel.getByRole("button", {name: "History"}).click();
  await panel.getByRole("button", {name: SESSION_TITLE}).first().click({timeout: 20000});
  await panel.locator(".chat-connect").getByRole("button", {name: /Canvas walk Pi/}).click({timeout: 30000});
  await panel.locator('.chat-composer[data-connection="connected"]').waitFor({timeout: 90000});
  const message = panel.getByRole("textbox", {name: "Message", exact: true});
  const sendSlot = await box(panel.getByRole("button", {name: "Send", exact: true}));

  // --- turn 1: P4 in flight, P1 working, then P6 complete ------------------
  await message.fill(TURN_1);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  const stop = panel.getByRole("button", {name: "Stop", exact: true});
  await stop.waitFor({timeout: 30000});
  const stopSlot = await box(stop);
  check(Math.abs(stopSlot.right - sendSlot.right) <= 0.5 && Math.abs(stopSlot.cy - sendSlot.cy) <= 0.5, "P4: Send becomes Stop in the same slot (right edge and centre ±0.5px)", {sendSlot, stopSlot});
  const line = panel.locator(".chat-status-line");
  await line.waitFor({timeout: 30000});
  const lineText = await line.innerText();
  check(/·/.test(lineText) && lineText.length > 3, "P4: the status line names the agent and what it is doing while the turn runs", lineText);
  // P1: the collapsed panel's corner mark carries ● while the turn runs.
  await panel.getByRole("button", {name: "Collapse the panel"}).click();
  const mark = page.locator(".shell-agent-presence");
  await mark.waitFor();
  let owner = p.request("status");
  const markState = await mark.getAttribute("data-presence-state");
  check(owner.state !== "TurnInFlight" || markState === "working", "P1: while the turn runs the closed panel's mark is ● working", {owner: owner.state, markState});
  await shot("p1-working-mark");
  await page.keyboard.press("Meta+Shift+KeyB");
  panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  await panel.locator(".chat-work-mark").first().waitFor({timeout: 240000});
  check(true, "P4: work marks stream into the conversation");
  await shot("p4-in-flight");
  await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 240000});
  for (let reads = 0; reads < 10; reads++) { owner = p.request("status"); if (owner.state === "Resident") break; await page.waitForTimeout(800); }
  await page.waitForTimeout(1500);
  check(await panel.locator(".chat-status-line").count() === 0, "P6: once the turn completes the status line is gone");
  const view = p.request("view");
  check(view.blocks.some(block => block.kind === "assistant" && block.text.trim()), "P6: the result line — a real reply — is in the conversation");
  const marks = await panel.locator(".chat-work-mark").allInnerTexts();
  check(marks.some(text => /ls/.test(text)) && marks.some(text => /turn-note\.md/.test(text)), "the turn's work marks name the command and the file it touched", marks);
  const notePath = join(p.projectRoot, "turn-note.md");
  const noteOnDisk = existsSync(notePath) ? readFileSync(notePath, "utf8") : null;
  check(noteOnDisk !== null && noteOnDisk.includes("tape walk"), "the provider really wrote turn-note.md in the project", noteOnDisk);
  const chip = panel.locator(".chat-artifact", {hasText: "turn-note.md"});
  check(await chip.count() === 1, "P6: an artifact chip names the file the turn changed");
  await chip.click();
  await page.locator(".tab-title", {hasText: "turn-note.md"}).first().waitFor({timeout: 20000});
  await page.getByRole("tab", {name: "Source", exact: true}).click({timeout: 15000}).catch(() => {});
  const doc = await page.waitForFunction(() => document.querySelector('.cm-content[data-source-ref*="turn-note.md"]'), null, {timeout: 20000}).then(() => docText(page, '.cm-content[data-source-ref*="turn-note.md"]')).catch(() => null);
  check(doc === noteOnDisk, "P6: the chip opens the file exactly as the turn left it", {doc, noteOnDisk});
  await shot("p6-complete");

  // --- the tape: Activity from a work mark, rows joined, object page -------
  const editMark = panel.locator(".chat-work-mark", {hasText: "turn-note.md"}).first();
  const rowId = await editMark.getAttribute("data-row");
  await editMark.click();
  const tape = panel.locator(".tape");
  await tape.waitFor();
  const openRow = tape.locator(`[data-tape-row="${rowId}"]`);
  await openRow.waitFor();
  await page.waitForFunction(id => document.querySelector(`[data-tape-row="${id}"]`)?.getAttribute("data-open") === "true", rowId, {timeout: 5000}).catch(() => {});
  check(await openRow.getAttribute("data-open") === "true" && await openRow.getAttribute("data-verb") === "edit", "a work mark opens Activity at that exact event, expanded", {rowId, verb: await openRow.getAttribute("data-verb")});
  const verbs = await tape.locator(".tape-row").evaluateAll(rows => rows.map(row => `${row.getAttribute("data-verb")}:${row.getAttribute("data-status")}`));
  check(verbs.includes("you:done") && verbs.some(v => v.startsWith("run:done")) && verbs.some(v => v.startsWith("edit:done")) && verbs.some(v => v.startsWith("reply:")), "the tape reads the journal: you → run → edit → reply, each settled", verbs);
  const rowTimes = await tape.locator(".tape-row .tape-time").allInnerTexts();
  check(rowTimes.filter(Boolean).length >= 3 && rowTimes.filter(Boolean).every(t => /^\d\d:\d\d:\d\d$/.test(t)), "rows carry the owner's observed time (hh:mm:ss)", rowTimes);
  const raw = await tape.evaluate(el => [...el.querySelectorAll("pre")].every(pre => pre.closest("details.tape-raw")));
  check(raw, "no raw JSON in the tape outside Show raw");
  await openRow.getByRole("button", {name: "Open", exact: true}).click();
  const page_ = page.locator('.object-page[data-object-kind="tape-event"]');
  await page_.waitFor({timeout: 20000});
  await page_.locator(".object-fields dt").first().waitFor({timeout: 20000});
  const fields = await page_.locator(".object-fields dt").allInnerTexts();
  check(["What", "When", "Session", "Journal"].every(label => fields.includes(label)), "Inspect opens the event's own page: labelled fields first", fields);
  check(await page_.evaluate(el => [...el.querySelectorAll("pre")].every(pre => pre.closest("details"))), "the event page shows verbatim material only behind Show raw");
  check(await page.locator(".tab-title", {hasText: /edit turn-note\.md|edited|turn-note\.md/}).count() >= 1, "the page opens as a tab in the focused pane (Base)");
  await shot("tape-event-page");

  // --- turn 2: P16 live / paused while events keep arriving -----------------
  await page.setViewportSize({width: 1280, height: 560});
  await planeButton(panel, "Chat").click();
  await message.fill(TURN_2);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  await planeButton(panel, "Activity").click();
  const body = tape.locator(".tape-body");
  await page.waitForFunction(() => { const el = document.querySelector(".tape-body"); return el && el.scrollHeight > el.clientHeight + 40; }, null, {timeout: 120000});
  check(await tape.getAttribute("data-following") === "true", "P16: the tape follows live by default");
  await body.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
  await tape.locator(".tape-resume").waitFor({timeout: 5000});
  const pausedTop = await body.evaluate(el => el.scrollTop);
  const pausedRows = await tape.locator(".tape-row").count();
  await page.waitForFunction(count => document.querySelectorAll(".tape .tape-row").length > count, pausedRows, {timeout: 120000});
  const afterTop = await body.evaluate(el => el.scrollTop);
  check(Math.abs(afterTop - pausedTop) <= 0.5, "P16: an event arriving while paused does not scroll the view", {pausedTop, afterTop});
  const pill = await tape.locator(".tape-resume").innerText();
  check(/^Resume live · \d+ new$/.test(pill.trim()), "P16: one Resume live pill counts what arrived", pill);
  await shot("p16-paused");
  await tape.locator(".tape-resume").click();
  await page.waitForFunction(() => { const el = document.querySelector(".tape-body"); return el && el.scrollHeight - el.scrollTop - el.clientHeight <= 24; }, null, {timeout: 5000});
  check(await tape.getAttribute("data-following") === "true", "P16: Resume live returns to the newest event and follows again");
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-stop"), null, {timeout: 240000}).catch(() => {});
  await page.setViewportSize({width: 1280, height: 820});

  // --- turn 3: P7 interrupted ----------------------------------------------
  await planeButton(panel, "Chat").click();
  await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 240000});
  await message.fill(TURN_3);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  await panel.locator(".chat-work-mark", {hasText: /sleep 40/}).first().waitFor({timeout: 180000});
  const cancelIndex = calls.length;
  await panel.getByRole("button", {name: "Stop", exact: true}).click();
  const stopping = await panel.locator(".chat-stop").innerText().catch(() => "");
  check(stopping.trim() === "Stopping…", "P4: Stop is a request — the button reads Stopping… until the owner answers", stopping);
  await page.waitForTimeout(300);
  check(calls.slice(cancelIndex).some(call => call.op === "encounter" && call.action === "cancel"), "P7: the Stop went to the owner as a cancel request", calls.slice(cancelIndex).map(call => `${call.op}:${call.action}`));
  try { await panel.locator(".chat-stopped").last().waitFor({timeout: 60000}); }
  catch (error) {
    const v = p.request("view");
    console.log("DIAG blocks", JSON.stringify(v.blocks.slice(-6).map(b => [b.kind, b.text.slice(0, 80)])));
    try { console.log("DIAG status", JSON.stringify(p.request("status"))); } catch (e) { console.log("DIAG status err", String(e).slice(0, 200)); }
    const j = p.request("read", {after: 0, limit: 256});
    console.log("DIAG journal tail", JSON.stringify(j.events.slice(-8).map(e => [e.cursor, e.event.kind, e.event.event?.Signal?.kind?.kind ?? (e.event.event?.TurnEnded ? "TurnEnded:" + JSON.stringify({stop: e.event.event.TurnEnded.stop, interruption: e.event.event.TurnEnded.interruption}) : "")])));
    throw error;
  }
  const stopped = await panel.locator(".chat-stopped").last().innerText();
  check(/^Stopped\./.test(stopped.trim()), "P7: the conversation reads Stopped.", stopped);
  const journal = p.request("read", {after: 0, limit: 256}).events;
  const ended = journal.map(entry => entry.event?.event?.TurnEnded).filter(Boolean).pop();
  check(ended && (ended.stop === "Cancelled" || ended.interruption?.origin === "Human"), "P7: the stop comes from the native reply — the owner's turn record says it was stopped", ended && {stop: ended.stop, interruption: ended.interruption && {origin: ended.interruption.origin, reason: ended.interruption.reason}});
  check(await panel.locator(".chat-work-mark", {hasText: /sleep 40/}).count() >= 1, "P7: what was already done stays visible (its work mark)");
  await planeButton(panel, "Activity").click();
  const lastTurn = tape.locator(".tape-turn").last();
  check(await lastTurn.getAttribute("data-stop") === "cancelled", "P7: the tape's turn closes as stopped", await lastTurn.getAttribute("data-stop"));
  await shot("p7-stopped");
}
