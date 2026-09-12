import { join } from "node:path";
import { setup as sourceSetup } from "./editor.mjs";

/** W1.4/W1.5 (the desktop half): explicit Contemplate and the what-changed
 * read, on the Flow surface. The owner operations are live on the installed
 * cut (`aikit flow preflight|contemplate|changed-since`); this walk proves
 * the desktop law around them: never auto-invoked, the owner's preflight
 * answer renders verbatim whatever it is, execution needs the held preflight
 * record and a second explicit act, and the what-changed strip exists only
 * once a thought exists. On a ground whose owner store does not hold the
 * Flow's knowledge node, the owner's own refusal (flow.not_found) is the
 * honest disclosure — asserted here as the owner's words, never paraphrased.
 * The preflight-record → record-gated execute payload path is proven by the
 * kernel's flow_cognition/action_dispatch suites; a ground whose store
 * resolves the node is an ai-kit store-provisioning question (named open). */

export async function setup(args) {
  const source = await sourceSetup(args);
  // The contemplate dispatch shells the owner's aikit; give it a private
  // home so the walk never touches the ambient store (the isolation law).
  // Pre-warm the home once: a fresh store bootstraps on first contact, and
  // the walk's explicit act should measure the owner's answer, not the
  // store's first boot.
  const { execFileSync } = await import("node:child_process");
  const env = { ...process.env, ...source.env, AIKIT_HOME: join(source.root, ".aikit-home") };
  try { execFileSync(process.env.OI_AIKIT_BIN ?? "aikit", ["--json", "status"], { encoding: "utf8", env }); } catch { /* the preflight itself will disclose a real unavailability */ }
  return { ...source, env };
}

export default async function run({ page, baseUrl, check, shot, channel, provision: p }) {
  await page.goto(baseUrl); await channel("info");
  const nav = page.getByRole("complementary", { name: "World navigator" });
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await page.getByRole("button", { name: "New flow", exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "New flow", exact: true }).click();
  const flowEditor = page.locator(".flow-surface .cm-content");
  await flowEditor.waitFor({ timeout: 20000 });
  const cognition = page.locator(".flow-cognition");
  await cognition.waitFor();

  // 1 — never auto-invoked: at rest the section is idle and inert.
  check((await cognition.getAttribute("data-contemplate-state")) === "idle", "The contemplate section opens idle — no disclosure, no execution, no read");
  check(await cognition.locator("[data-owner-payload]").count() === 0, "At rest nothing has been contemplated: no owner payload was fetched or rendered");
  check(await cognition.locator(".flow-changed").count() === 0, "The what-changed strip is absent without a held thought record");

  // 2 — the explicit preflight act asks the owner; the owner's answer
  // renders verbatim. On this ground the store does not hold the Flow's
  // knowledge node, so the owner's own refusal IS the disclosure.
  await cognition.locator("summary").click();
  await cognition.getByRole("button", { name: "Contemplate this Flow", exact: true }).click();
  await page.locator('.flow-cognition[data-contemplate-state="refused"]').waitFor({ timeout: 90000 });
  const refusal = (await cognition.locator('[data-owner-refusal]').first().innerText()).trim();
  check(refusal.includes("no Flow node resolves"), "The owner's own refusal renders verbatim (flow node not in this ground's store)", refusal);
  check(await cognition.locator("[data-owner-payload]").count() === 0, "A refusal discloses no fabricated preflight payload");
  check(await cognition.locator(".flow-cognition-execute").count() === 0, "Execution is unreachable without a preflight record — no execute control is offered");
  check(await cognition.locator(".flow-changed").count() === 0, "The what-changed strip stays absent — the thought record only comes from a real preflight");
  const events = (await channel("read.events", [0])).data.receipts;
  check(events.every(e => e.event !== "contemplate_executed"), "The event log holds no contemplate execution", events.map(e => e.event));
  await shot("contemplate-owner-refusal-verbatim");
}
