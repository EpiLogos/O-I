import {chmodSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, planeButton, recordCalls, restoreScope} from "../lane2-support.mjs";

/** When sending or reading goes wrong (10-SIDEBARS §5.3 P8 P9 P10 P11 P12).
 *  Real kernel, real AIKit (the lane build), the existing pi provider, a
 *  disposable ground and isolated AIKIT_HOME. Faults are injected only at the
 *  transport boundary the kernel crosses — the `oi` owner router the walks
 *  already use (canvas-context precedent) — by flag files in the disposable
 *  ground: the owner refuses a send (P8), the reply to a send is lost after
 *  the owner took it (P9), reads stop answering (P10), the encounter owner is
 *  out of reach (P11). The app sees exactly what a real failure gives it. */
export async function setup(options) {
  const provision = await canvasSetup(options);
  const faults = join(provision.root, ".walk-faults");
  mkdirSync(faults, {recursive: true});
  const aikit = provision.env.OI_AIKIT_BIN;
  const router = join(provision.root, "oi-fault-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
const args = process.argv.slice(2);
const flag = name => existsSync(${JSON.stringify(faults)} + "/" + name);
const forward = () => spawnSync(${JSON.stringify(aikit)}, args.slice(1), {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
if (args[0] !== "aikit") { const child = spawnSync("oi", args, {stdio: "inherit"}); process.exit(child.status ?? 1); }
const encounterVerb = args.includes("encounter") || args.includes("encounter-start");
let action;
try { action = JSON.parse(args[args.indexOf("--request-json") + 1] ?? "{}").action; } catch { action = undefined; }
if (encounterVerb && flag("unreachable")) { process.stderr.write("AIKit encounter owner unavailable: connection refused (walk fault)"); process.exit(1); }
if (encounterVerb && flag("reads-fail") && ["view", "status", "read"].includes(action)) { process.stderr.write("connection reset by peer (walk fault)"); process.exit(1); }
if (encounterVerb && flag("prompt-refused") && /^prompt/.test(action ?? "")) { process.stdout.write(JSON.stringify({ok: false, error: {code: "encounter.walk_refused", message: "The owner refused this send (walk fault)"}})); process.exit(0); }
if (encounterVerb && flag("prompt-uncertain") && /^prompt/.test(action ?? "")) { forward(); process.stderr.write("connection reset while sending (walk fault)"); process.exit(1); }
const child = forward();
process.stdout.write(child.stdout ?? ""); process.stderr.write(child.stderr ?? "");
process.exit(child.status ?? 1);
`);
  chmodSync(router, 0o755);
  provision.env.OI_BIN = router;
  // A second attached conversation for P12.
  const second = "agent-session/failures-walk-second";
  const staged = provision.native("stage", "--space", provision.space, "--intent-json", JSON.stringify({operation: "attach-agent-session", attachment: {agent_session: second, purpose: "The second conversation", provenance: ["Explicit walk conversation"]}}));
  provision.native("apply", "--preview-json", JSON.stringify(staged));
  return {...provision, faults, second, fault: (name, on) => on ? writeFileSync(join(faults, name), "on") : rmSync(join(faults, name), {force: true})};
}

const SESSION_TITLE = "Canvas editor and prepared context acceptance";

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
  const userBlocks = text => p.request("view").blocks.filter(block => block.kind === "user" && block.text.trim() === text).length;

  // --- P10: reads stop answering — reconnecting, the draft kept -------------
  const KEPT = "P10 draft — kept while reconnecting";
  await message.fill(KEPT);
  for (let i = 0; i < 10 && p.request("view").draft.text !== KEPT; i++) await page.waitForTimeout(400);
  const usersBefore = p.request("view").blocks.filter(block => block.kind === "user").length;
  p.fault("reads-fail", true);
  const line = panel.locator('[data-line="reconnecting"]');
  await line.waitFor({timeout: 20000});
  check(/^Reconnecting — last seen \d+s ago\. Your draft is kept\.$/.test((await line.innerText()).trim()), "P10: one line under the tabs — Reconnecting, last seen, draft kept", await line.innerText());
  check(await panel.locator('.avatar-menu-open').count() === 1 && await message.inputValue() === KEPT, "P10: the draft stays in the composer");
  await shot("p10-reconnecting");
  p.fault("reads-fail", false);
  await line.waitFor({state: "detached", timeout: 20000});
  await page.waitForTimeout(1500);
  const usersAfter = p.request("view").blocks.filter(block => block.kind === "user").length;
  check(usersAfter === usersBefore && await panel.locator(".chat-turn-user").count() === usersBefore, "P10: on reconnect the transcript replays from its cursor with no duplicate messages", {usersBefore, usersAfter});
  await message.fill("");

  // --- P8: the owner refuses the send — not sent, Retry, draft kept ---------
  const P8 = "Reply with the single word: retried.";
  await message.fill(P8);
  for (let i = 0; i < 10 && p.request("view").draft.text !== P8; i++) await page.waitForTimeout(400);
  p.fault("prompt-refused", true);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  const notSent = panel.locator(".chat-send-state[role=alert]");
  await notSent.waitFor({timeout: 20000});
  check((await notSent.innerText()).trim().startsWith("Message not sent.") && await notSent.getByRole("button", {name: "Retry"}).count() === 1, "P8: Message not sent. with Retry beside the kept draft");
  check(await message.inputValue() === P8 && p.request("view").draft.text === P8, "P8: the draft is retained, in the composer and at the owner");
  check(userBlocks(P8) === 0, "P8: nothing was sent");
  await shot("p8-not-sent");
  p.fault("prompt-refused", false);
  await notSent.getByRole("button", {name: "Retry"}).click();
  await panel.locator(".chat-turn-user", {hasText: P8}).first().waitFor({timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 240000});
  check(userBlocks(P8) === 1, "P8: Retry sends it once");

  // --- P9: delivery uncertain — reconcile against the owner, never resend ----
  const P9 = "Reply with the single word: landed.";
  await message.fill(P9);
  for (let i = 0; i < 10 && p.request("view").draft.text !== P9; i++) await page.waitForTimeout(400);
  p.fault("prompt-uncertain", true);
  const promptsBefore = calls.filter(call => call.op === "encounter" && /^prompt/.test(call.action ?? "")).length;
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  await panel.getByRole("button", {name: "Send", exact: true}).click();
  const checking = panel.locator(".chat-send-state[role=status]");
  const sawChecking = await checking.waitFor({timeout: 20000}).then(async () => (await checking.innerText()).trim()).catch(() => null);
  check(sawChecking === "Checking whether your message was sent…", "P9: Checking whether your message was sent… while reconciling", sawChecking);
  p.fault("prompt-uncertain", false);
  await checking.waitFor({state: "detached", timeout: 30000});
  await page.waitForTimeout(1000);
  check(userBlocks(P9) === 1, "P9: the owner's record shows it was sent — exactly once", userBlocks(P9));
  check(calls.filter(call => call.op === "encounter" && /^prompt/.test(call.action ?? "")).length - promptsBefore === 1, "P9: no second send was made");
  check(await panel.locator(".chat-send-state[role=alert]").count() === 0, "P9: a landed message is never shown as not sent");
  await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 240000});

  // --- P12: another conversation — nothing of the previous one shows --------
  await planeButton(panel, "Activity").click();
  const firstRows = await panel.locator(".tape .tape-row").count();
  check(firstRows > 0, "P12 (before): the first conversation's activity is on the tape", firstRows);
  await planeButton(panel, "Chat").click();
  // Another conversation takes the panel through the same prepared-session
  // bind every native Agent preparation uses (choose → start / read).
  await page.evaluate(detail => window.dispatchEvent(new CustomEvent("oi:agent-session-prepared", {detail})), {project: "Editor", ref: p.second, space: p.space, title: "The second conversation"});
  await page.waitForFunction(ref => document.querySelector(".agent-layer")?.getAttribute("data-agent-session-ref") === ref, p.second, {timeout: 30000});
  const chatText = await panel.locator(".agent-chat").innerText();
  check(!chatText.includes(P8) && !chatText.includes(P9), "P12: a newly bound conversation shows nothing of the previous one in Chat");
  await planeButton(panel, "Activity").click();
  await page.waitForTimeout(1500);
  const secondRows = await panel.locator(".tape .tape-row").allInnerTexts();
  check(!secondRows.some(text => /retried|landed/.test(text)), "P12: the Activity tape is the new conversation's own", secondRows.length);
  await planeButton(panel, "Chat").click();
  check(p.request("view").blocks.some(block => block.text.includes(P9)), "P12: the previous conversation is kept (its owner record is untouched)");
  await shot("p12-switched");

  // --- P11: the encounter owner is out of reach — say so, local work goes on -
  p.fault("unreachable", true);
  await page.reload();
  panel = await openPanel(page);
  await planeButton(panel, "Chat").click();
  const away = panel.locator('[data-line="unreachable"]');
  await away.waitFor({timeout: 30000});
  check((await away.innerText()).trim().startsWith("Agents aren't reachable here right now."), "P11: Agents aren't reachable here right now — plus what still works", await away.innerText());
  check(await panel.locator('.avatar-menu-open[data-presence="unavailable"]').count() === 1, "P11: the avatar carries × (unavailable)");
  await page.waitForTimeout(6000);
  check(await panel.getByText("Reading the conversation…").count() === 0, "P11: no perpetual loading");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  const fileRow = nav.locator(`[data-file-path="Work/Editor/${p.sourcePath}"]`);
  for (let attempt = 0; attempt < 3 && !await fileRow.isVisible().catch(() => false); attempt++) {
    if (!await nav.getByRole("button", {name: "Editor: files", exact: true}).isVisible().catch(() => false)) await nav.locator('[data-project-path="Work/Editor"]').click();
    await nav.getByRole("button", {name: "Editor: files", exact: true}).click().catch(() => {});
    await fileRow.waitFor({timeout: 5000}).catch(() => {});
  }
  await fileRow.click({timeout: 20000});
  await page.locator(".tab-title", {hasText: p.sourcePath}).first().waitFor({timeout: 20000});
  check(true, "P11: local work stays usable — a file opens while agents are out of reach");
  await shot("p11-unreachable");
  p.fault("unreachable", false);
}
