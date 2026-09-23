// factory-real (11-FACTORY §7 F5 F6 F7 F12 + the NOW record page), READ-ONLY
// against the owner's REAL Central ground: the Central-root Factory runs,
// including the queued specimen `oi-65/native-conversation-identity-v3`.
// Nothing is started, recognised or written — every leg is a read, and the
// walk asserts the owner's state file is byte-identical before and after.
// The kernel's suite binding stays isolated (a temp OI_HOME); only the
// Central root is the real one.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {recordOps} from "../lib/factory-ground.mjs";

const ROOT = process.env.OI_WALK_REAL_CENTRAL ?? "/Users/admin/Central";
const ownerJson = (bin, args) => { const done = spawnSync(bin, [...args, "--json"], {encoding: "utf8"}); if (done.status !== 0) throw new Error(`${bin} ${args.join(" ")}: ${done.stderr}`); return JSON.parse(done.stdout); };
const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const firstSentence = text => { const t = text.trim().replace(/\s+/g, " "); const m = /^(.+?[.!?])(?=\s+[A-Z0-9"“(])/.exec(t); return (m ? m[1] : t).replace(/[.]$/, ""); };

export async function setup() {
  const factory = process.env.OI_FACTORY_BIN ?? "factory";
  const location = ownerJson(factory, ["project", "locate", ROOT]);
  const statePath = location.statePath;
  const project = ownerJson(factory, ["development", "project", statePath, location.projectRef]);
  const runs = [];
  for (const summary of project.journeys ?? []) {
    const journey = ownerJson(factory, ["development", "journey", statePath, summary.journeyRef]);
    for (const runRef of summary.runRefs ?? []) {
      const run = ownerJson(factory, ["development", "run", statePath, runRef]);
      runs.push({runRef, journeyRef: journey.journeyRef, purpose: journey.commission?.purpose ?? "", destination: run.destination, lifecycle: run.lifecycle});
    }
  }
  const v3 = runs.find(run => run.destination === "oi-65/native-conversation-identity-v3");
  if (!v3) throw new Error("the real Central-root run oi-65/native-conversation-identity-v3 is not in the owner's reading");
  const inspect = ownerJson(factory, ["workflow", "inspect", statePath, v3.runRef]);
  const build = ownerJson(factory, ["build", "snapshot", statePath, location.projectRef, v3.runRef]);
  const actions = ownerJson(factory, ["action", "list", statePath, location.projectRef, v3.runRef]);
  const nowRef = inspect.units.map(unit => unit.requiredReturn?.address).find(address => address?.startsWith("central:now:"));
  const now = nowRef ? JSON.parse(spawnSync("ctrl", ["--root", ROOT, "--json", "action", "run", "central.now.read", JSON.stringify({now_ref: nowRef})], {encoding: "utf8"}).stdout) : null;
  const home = mkdtempSync(join(tmpdir(), "oi-cradle-factory-real-home-"));
  return {
    root: ROOT, statePath, location, runs, v3, inspect, build, actions, nowRef, now: now?.data ?? null, stateDigest: digest(statePath),
    env: {OI_CENTRAL_ROOT: ROOT, OI_HOME: home},
    cleanup: () => rmSync(home, {recursive: true, force: true}),
  };
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await page.reload(); await channel("info");
  await page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name: "Factory", exact: true}).click();
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await desk.waitFor({timeout: 60000});
  await page.waitForFunction(count => document.querySelectorAll(".fdesk .fdesk-card").length >= count, p.runs.length, {timeout: 180000});

  // F5 on the real ground
  const titles = (await desk.locator("[data-card-title]").allInnerTexts()).map(text => text.trim()).sort();
  const expected = p.runs.map(run => run.purpose.trim() ? firstSentence(run.purpose) : run.destination).sort();
  check(JSON.stringify(titles) === JSON.stringify(expected), "F5 (real): every Central-root card title EQUALS its journey's commission purpose (first sentence)", {titles});
  const texts = await desk.locator(".fdesk-card").allInnerTexts();
  const footers = (await desk.locator("[data-card-footer]").allInnerTexts()).map(text => text.trim());
  check(texts.every(text => !/(^|\s)(run|project):[0-9A-Z]/.test(text)) && footers.every(text => text.startsWith("Central")), "F5 (real): no card carries a run:/project: ref; the footer names Central (control:root)", {footers});
  await shot("desk-real");

  // F6 / F7 / F12 on the queued v3 run
  await desk.locator(`[data-run-card="${p.v3.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${p.v3.runRef}"]`);
  await runPage.waitFor({timeout: 60000});
  const applicable = (p.actions.actions ?? p.actions).filter?.(action => action.currentlyApplicable) ?? [];
  check(await runPage.locator("[data-primary-action]").count() === applicable.length, "F6 (real): the primary action EQUALS the owner's currently-applicable actions for the queued v3 run (none)", {applicable: applicable.map(action => action.label)});
  const frontier = runPage.locator('.fmap-unit[data-frontier="true"]');
  await frontier.waitFor({timeout: 60000});
  check(await frontier.getAttribute("data-unit") === p.build.view.frontier.subjectRef, "F7 (real): the outlined unit EQUALS the owner build view's frontier", {frontier: p.build.view.frontier.subjectRef});
  await frontier.locator(".fmap-unit-open").click();
  const band = runPage.locator(`[data-unit-band="${p.build.view.frontier.subjectRef}"]`);
  await band.locator(".fmap-checks li").first().waitFor({timeout: 60000});
  const shown = await band.locator(".fmap-checks li").evaluateAll(nodes => nodes.map(node => [node.textContent.replace(/ · .*$/, "").trim(), node.getAttribute("data-check-state")]));
  const owner = p.inspect.units.find(unit => unit.workflowUnitRef === p.build.view.frontier.subjectRef).requiredVerification.map(text => [text, "outstanding"]);
  check(JSON.stringify(shown) === JSON.stringify(owner), "F7 (real): the selected unit's checks EQUAL the owner inspection (all outstanding — no attempt has run)", {count: shown.length});
  await shot("run-real-map");
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  check((await runPage.locator("[data-live-empty] p").first().innerText()).trim() === "Nothing is running.", "F6 (real): Live says \"Nothing is running.\"");
  // The NOW record the run returns to, by Central's own reading.
  if (p.nowRef && p.now) {
    const line = runPage.locator("[data-now-line] button");
    await page.waitForFunction(() => !/reading/i.test(document.querySelector("[data-now-line] button")?.textContent ?? "reading"), null, {timeout: 60000});
    const lineText = (await line.innerText()).trim();
    check(lineText === firstSentence(p.now.record.purpose), "NOW (real): the Live NOW line names the record's purpose from Central's NOW reading", {lineText});
    await line.click();
    const object = centre.locator(".object-page");
    await object.locator(".object-fields").waitFor({timeout: 60000});
    const purpose = await object.evaluate(node => [...node.querySelectorAll(".object-fields > dt")].find(dt => dt.textContent.trim() === "Purpose")?.nextElementSibling?.textContent?.trim());
    check(purpose === p.now.record.purpose, "NOW record page (real): Purpose EQUALS central.now.read", {kind: await object.getAttribute("data-object-kind")});
    await shot("now-record-real");
    await centre.getByRole("button", {name: "Back"}).click();
  }
  await runPage.getByRole("tab", {name: "Handoff", exact: true}).click();
  check((await runPage.locator("[data-handoff-empty] p").innerText()).trim() === "Nothing has come back yet.", "F12 (real): nothing returned on the queued run");

  // Read-only, proven.
  check(!ops.some(op => op.op === "factory_owner" && ["recognise", "action-invoke"].includes(op.kind)), "Read-only: no Factory mutation was sent");
  check(digest(p.statePath) === p.stateDigest, "Read-only: the owner's Central-root Factory state is byte-identical after the walk");
}
