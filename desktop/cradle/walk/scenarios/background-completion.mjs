// background-completion (factory289:arrangement branch 0, negative exercised):
// a Run the person left working moves in the owner's world while they are
// focused elsewhere; the Desk's own read then shows the movement in place —
// one card carries the live strip, the Run view's owner build revision
// advances — and the person's scope, selection, focus and the kernel event
// log do not move (a Factory read emits no kernel events). The adverse face:
// the owner can no longer serve the Run's read — the refusal renders as the
// Run's own line with the held view still standing, no global takeover. Named
// gap: no owner verb lands a RUN on its "fail" status on this cut, so the
// run-status fail face is not exercised here; no stand-in was invented.
// Carried finding (2026-09-22, owner = FactoryLive/DeskBoard): after a mere
// board refresh, sibling cards also raise the live strip — the two observe
// paths (DeskBoard build-snapshot read vs development-read) yield different
// signatureOf revisions for the same unchanged state, so changed flips true.
// "No other Run's card claims the movement" is that defect's regression; it
// stays red until the owner lands the fix.
import {execFileSync, spawnSync} from "node:child_process";
import {mkdirSync, readFileSync, renameSync} from "node:fs";
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {setup as sourceSetup} from "./editor.mjs";

/** Run one owner CLI command to completion, capturing stdout or the owner's
 * own stderr words — expected refusals are data here, not failures. */
function ownerCall(bin, args, input) {
  const done = spawnSync(bin, args, {encoding: "utf8", ...(input === undefined ? {} : {input})});
  return {ok: done.status === 0, stdout: done.stdout, stderr: done.stderr};
}

export async function setup(args) {
  const source = await sourceSetup(args);
  const factory = process.env.OI_FACTORY_BIN ?? "factory";
  const statePath = join(source.root, "factory", "developmental-state.json");
  mkdirSync(join(source.root, "factory"), {recursive: true});
  const out = execFileSync(factory, ["conformance", "developmental-state", statePath], {encoding: "utf8"});
  if (!out.includes("Provider state")) throw new Error(`state generator refused: ${out.slice(0, 200)}`);
  const projectRef = (out.match(/^Project:\s*(\S+)$/m) ?? [])[1] ?? null;
  if (!projectRef) throw new Error(`the generator disclosed no project ref: ${out.slice(0, 200)}`);

  // The owner's own readings name the Runs the board will serve. The contrast
  // this scenario proves needs at least two: one Run moves, the others must
  // stay exactly as they were.
  const projectReading = ownerCall(factory, ["development", "project", statePath, projectRef, "--json"]);
  if (!projectReading.ok) throw new Error(`the owner's project reading refused: ${projectReading.stderr.slice(0, 300)}`);
  const journeys = JSON.parse(projectReading.stdout).journeys ?? [];
  const runRefs = [...new Set(journeys.flatMap(journey => Array.isArray(journey.runRefs) ? journey.runRefs : []))];
  if (runRefs.length < 2) throw new Error(`the owner's reading named ${runRefs.length} run(s); one-moves-one-rests needs two`);

  // Every Run's build view captured from the owner's CLI: the labels,
  // statuses, counts and owner build revisions every check below is asserted
  // against by CONTENT EQUALITY — never presence, never a desktop-derived
  // string.
  const runs = runRefs.map(runRef => {
    const build = ownerCall(factory, ["build", "snapshot", statePath, projectRef, runRef, "--json"]);
    if (!build.ok) throw new Error(`the owner refused a build view for ${runRef}: ${build.stderr.slice(0, 200)}`);
    const document = JSON.parse(build.stdout);
    if (document.view?.run?.runRef !== runRef) throw new Error(`the owner's build view answered a different Run for ${runRef}`);
    if (!Number.isInteger(document.revision)) throw new Error(`the owner's build view disclosed no numeric revision for ${runRef}`);
    return {
      runRef, label: document.view.run.label, status: document.view.run.status, revision: document.revision,
      agencies: (document.view.agencies ?? []).length, executions: (document.view.executions ?? []).length,
    };
  });
  if (runs.some(run => runs.some(other => other !== run && other.label.includes(run.label))))
    throw new Error("two Runs' labels are not distinguishable on the board; the contrast would be ambiguous");

  // The owner's own refusal words for a build view whose state file is gone —
  // the exact words the adverse leg must render, captured from the owner.
  const missing = ownerCall(factory, ["build", "snapshot", join(source.root, "factory", "missing-state.json"), projectRef, runRefs[0], "--json"]);
  if (missing.ok) throw new Error("the owner served a build view for a nonexistent state path — the adverse fixture is invalid");
  const refusalFragment = String(missing.stderr).replace(/^factory:\s*/m, "").trim().split(/\s+at line/)[0].replace(/\n/g, " ").trim();

  return {...source, statePath, projectRef, runs, refusalFragment, cleanup: source.cleanup};
}

/** Wait until the locator resolves to at least `count` elements — the board's
 * reads land as they arrive behind the one serialised kernel queue, so honest
 * latency here is tens of seconds, not fractions. */
async function waitForCount(locator, count, timeout = 90000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await locator.count() >= count) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${count} rows (${await locator.count()} present)`);
    await locator.first().waitFor({timeout: Math.max(1000, deadline - Date.now())}).catch(() => {});
  }
}

export default async function run({page, baseUrl, check, metric, shot, channel, op, waitForEvents, eventsAfter, provision: p}) {
  const first = p.runs[0];
  const others = p.runs.slice(1);
  const ownerLabels = p.runs.map(run => run.label);
  const lastSeq = async () => (await channel("read.events")).data.last_seq ?? 0;

  await page.goto(baseUrl);await channel("info");
  await bindDefaultCentral(page, p.root);
  await page.reload();await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await page.getByRole("button", {name: "Open wiki", exact: true}).waitFor({timeout: 20000});
  await page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name: "Factory", exact: true}).click();
  const centre = page.locator("main.factory-centre");
  await centre.waitFor();
  const board = centre.locator(".desk-board");
  await board.waitFor();
  const picker = page.locator('nav.factory-navigator select[aria-label="Project"]');
  await picker.waitFor({timeout: 20000});
  await picker.selectOption("Editor");
  await page.locator('.factory-space[data-bound="true"]').waitFor({timeout: 20000});

  // The person names the source; the owner's Runs settle as cards.
  const form = board.locator("details.desk-addsource");
  await form.locator("summary").click();
  await form.getByLabel("Developmental state path").fill(p.statePath);
  await form.getByLabel("Factory Project ref").fill(p.projectRef);
  await form.getByLabel("Central Project scope (optional)").fill("Factory-walk");
  await form.getByRole("button", {name: "Add source", exact: true}).click();
  await page.waitForFunction(node => node instanceof HTMLDetailsElement && !node.open, await form.elementHandle(), {timeout: 10000});
  const cards = board.locator(".desk-card");
  await waitForCount(cards, p.runs.length);
  const firstCard = cards.filter({hasText: first.label});
  const renderedTitles = (await board.locator(".desk-card-title").allInnerTexts()).map(title => title.trim()).sort();
  check(renderedTitles.join("|") === [...ownerLabels].sort().join("|"),
    "The board's cards EQUAL the owner's declared run labels — nothing invented, nothing missing", {ownerLabels, renderedTitles});
  check(await board.locator('section.desk-group[aria-label^="Queued"] .desk-card').count() === p.runs.length,
    "Every served Run sits where the owner's own status places it (Queued)");

  // The person selects the first Run, reads its working world, and returns to
  // the board — the selection is held, the layout settles.
  await firstCard.locator(".desk-card-open").click();
  const detail = page.locator(".desk-detail");
  await detail.waitFor();
  const detailTitle = page.locator(".desk-detail-title h1");
  await detailTitle.waitFor({timeout: 30000});
  check(await detailTitle.textContent() === first.label,
    "The opened Run detail names the Run the person chose by the owner's own label", {ownerLabel: first.label});
  const basisBefore = await detail.locator(".desk-detail-live-basis").innerText();
  const revisionBefore = Number((basisBefore.match(/owner build revision (\d+)/) ?? [])[1]);
  check(revisionBefore === first.revision,
    "The Run view's live basis names the owner's build revision the walk captured in setup", {ownerRevision: first.revision, rendered: basisBefore.trim()});
  await page.locator(".desk-run-depths button", {hasText: "Live"}).click();
  check(await page.locator(".desk-run-live-grid article").count() === first.agencies + first.executions,
    "The Live depth renders exactly the agencies and executions the owner's build view carries");
  await shot("settled-detail");
  await detail.locator(".desk-detail-head button.oi-action", {hasText: "Back to Desk"}).click();
  await board.waitFor({timeout: 30000});
  await waitForCount(cards, p.runs.length);

  // The person's resting place: the board's search field holds focus. From
  // here the world moves, and nothing may move them.
  await board.locator('input[aria-label="Search Runs"]').click();
  await page.evaluate(() => document.activeElement?.setAttribute("data-walk-focus", "person"));
  const regionsBefore = await page.locator("[data-region]").count();
  const seqSettled = await lastSeq();

  // The world moves while the person is focused elsewhere: the owner's own
  // mutation admits the Run's completed execution behind the desktop's back.
  // No fake Run store — the owner's state is the only Run state there is.
  const executionRef = "execution:walk-background-arrival";
  const stamp = Date.now();
  const request = {
    contract: "factory.developmental-mutation-request/v1",
    mutationRef: `mutation:walk-background-arrival-${stamp}`,
    occurrenceRef: `occurrence:walk-background-arrival-${stamp}`,
    source: {owner: "factory", reference: executionRef, revision: "rev-walk-arrival", standing: "owner-native-observation"},
    observedAt: new Date().toISOString(),
    mutation: {kind: "admit-situated-execution", execution: {
      runRef: first.runRef, executionRef, status: "success",
      agencyRef: "agency:factory/conformance", harnessRef: "harness:factory-native-cli",
    }},
  };
  const factory = process.env.OI_FACTORY_BIN ?? "factory";
  const applied = ownerCall(factory, ["development", "mutate", p.statePath], JSON.stringify(request));
  if (!applied.ok) throw new Error(`the owner refused its own mutation: ${applied.stderr.slice(0, 300)}`);
  const buildAfter = ownerCall(factory, ["build", "snapshot", p.statePath, p.projectRef, first.runRef, "--json"]);
  if (!buildAfter.ok) throw new Error(`the owner refused a build view after its mutation: ${buildAfter.stderr.slice(0, 200)}`);
  const ownerNow = JSON.parse(buildAfter.stdout);
  const executionsAfterArrival = (ownerNow.view.executions ?? []).length;
  check(ownerNow.revision > revisionBefore && executionsAfterArrival === first.executions + 1,
    "The owner's world moved: its build revision advanced and the completed execution is the owner's own record now",
    {ownerRevision: ownerNow.revision, executions: executionsAfterArrival});
  metric("owner_build_revision_before", revisionBefore);
  metric("owner_build_revision_after_arrival", ownerNow.revision);

  // The person reads (their own explicit Refresh — the desktop invents no
  // poll): the arrival shows in its own place, and nothing else moves.
  const readLanded = await op("person_read_after_background", async () => {
    await board.getByRole("button", {name: "Refresh", exact: true}).click();
    await waitForCount(cards, p.runs.length);
    await firstCard.locator(".desk-card-live").waitFor({timeout: 90000});
  });
  metric("person_read_after_background_ms", readLanded.duration_ms);
  check((await firstCard.locator(".desk-card-live").innerText()).includes("Run updated since your last review"),
    "The completed work marks its own Run's card — updated since your last review, in the card's own place");
  let strayStrips = 0;
  for (const run of others) strayStrips += await cards.filter({hasText: run.label}).locator(".desk-card-live").count();
  check(strayStrips === 0, "No other Run's card claims the movement — exactly the Run that moved is marked");
  const facts = await firstCard.locator(".desk-card-facts").innerText();
  check(facts.includes(`${executionsAfterArrival} execution`),
    "The card's facts carry the owner's own execution count after the arrival", {facts: facts.trim(), ownerExecutions: executionsAfterArrival});
  check(await firstCard.getAttribute("data-status") === first.status
    && await board.locator('section.desk-group[aria-label^="Queued"] .desk-card').count() === p.runs.length,
    "The Run's own state word is still the owner's and no card changed groups — the arrival moved no placement");
  check((await firstCard.locator(".desk-card-project").innerText()).includes("Factory-walk"),
    "The moved Run's card still carries the Central project scope label the person gave it");
  const focusAfterArrival = await page.evaluate(() => {
    const marked = document.querySelector('[data-walk-focus="person"]');
    return {
      survived: marked instanceof HTMLInputElement && marked.getAttribute("aria-label") === "Search Runs",
      focusedElsewhere: document.activeElement === marked || document.activeElement === document.body
        ? null : (document.activeElement?.tagName ?? "?"),
    };
  });
  check(focusAfterArrival.survived && focusAfterArrival.focusedElsewhere === null,
    "The person's place held: their focused element is the same element, and the arrival focused nothing else", focusAfterArrival);
  await page.waitForTimeout(1000); // give any spurious emission time to appear
  const arrivalEvents = await eventsAfter(seqSettled);
  check(arrivalEvents.length === 0,
    "The completion cost the kernel log nothing — no focus event, no duplicate, no event at all for a read",
    {emitted: arrivalEvents.map(event => event.event)});
  await shot("board-after-background-arrival");

  // The Run view shows the completed work: the owner build revision advanced,
  // the execution sits in the Live depth by its owner ref and status, and
  // acknowledging it is the person's own answer, never a forced state.
  await firstCard.locator(".desk-card-open").click();
  await detail.waitFor();
  await detailTitle.waitFor({timeout: 30000});
  const basisNow = await detail.locator(".desk-detail-live-basis").innerText();
  const renderedRevision = Number((basisNow.match(/owner build revision (\d+)/) ?? [])[1]);
  check(renderedRevision === ownerNow.revision,
    "The Run view's live basis EQUALS the owner's advanced build revision — content equality, not presence", {ownerRevision: ownerNow.revision, rendered: basisNow.trim()});
  await page.locator(".desk-run-depths button", {hasText: "Live"}).click();
  const liveRow = page.locator(".desk-run-live-grid article", {hasText: executionRef});
  await liveRow.waitFor({timeout: 30000});
  check((await liveRow.innerText()).includes("success")
    && await page.locator(".desk-run-live-grid article").count() === first.agencies + executionsAfterArrival,
    "The completed execution renders in the Live depth under its owner ref with its owner status");
  const acknowledge = detail.locator(".desk-detail-live").getByRole("button", {name: "Acknowledge"});
  check(await acknowledge.count() === 1, "The arrival is offered, never forced — acknowledge is the person's own answer");
  await acknowledge.click();
  await acknowledge.waitFor({state: "detached", timeout: 15000});
  check(await lastSeq() === seqSettled, "Reading the Run view and answering the arrival emitted no kernel events either");
  await shot("detail-arrival-visible");

  // The adverse face: the owner can no longer serve this Run's read. The walk
  // moves the state away — the world turned hostile, not the app — and the
  // person's own Refresh must meet it as the Run's own refusal line, the held
  // view still standing, the person's place untouched, no global takeover.
  await page.locator(".desk-run-depths button", {hasText: "Live"}).click();
  await page.evaluate(() => document.activeElement?.setAttribute("data-walk-focus", "person"));
  const originalState = readFileSync(p.statePath);
  const heldArticles = await page.locator(".desk-run-live-grid article").count();
  let moved = false;
  try {
    renameSync(p.statePath, `${p.statePath}.walk-unavailable`);
    moved = true;
    await detail.locator(".desk-detail-live").getByRole("button", {name: "Refresh", exact: true}).click();
    const refusal = detail.locator('p[role="alert"]');
    await refusal.waitFor({timeout: 90000});
    const refusalText = await refusal.innerText();
    check(refusalText.includes("refused this Run's build view") && refusalText.includes(p.refusalFragment),
      "The failure is the Run's own refusal line, in the owner's own words", {refusal: refusalText.slice(0, 140)});
    check(await detailTitle.textContent() === first.label
      && await page.locator(".desk-run-live-grid article").count() === heldArticles,
      "The held build view still stands behind the refusal — the failure replaced nothing");
    check(await centre.getAttribute("data-centre-view") === "desk" && await page.locator("main.factory-centre").count() === 1,
      "The centre is unmoved: still the Desk, still the Factory centre");
    check(await page.locator(".desktop-shell").count() === 1 && (await page.locator("[data-region]").count()) === regionsBefore,
      "The shell keeps its regions — no whole-app takeover appeared", {regionsBefore, regionsNow: await page.locator("[data-region]").count()});
    check(await page.getByRole("dialog").count() === 0, "No dialog or global error sheet appeared over the work");
    const focusAfterRefusal = await page.evaluate(() => {
      const marked = document.querySelector('[data-walk-focus="person"]');
      return {
        survived: marked instanceof HTMLButtonElement && (marked.textContent ?? "").includes("Live"),
        focusedElsewhere: document.activeElement === marked || document.activeElement === document.body
          ? null : (document.activeElement?.tagName ?? "?"),
      };
    });
    check(focusAfterRefusal.survived && focusAfterRefusal.focusedElsewhere === null,
      "The person's focus survived the failure exactly where they left it", focusAfterRefusal);
    await page.waitForTimeout(1000);
    check((await eventsAfter(seqSettled)).length === 0,
      "Even the failure emitted no kernel event — a refusal is a read outcome, not a state change");
    await shot("detail-refusal-in-place");
  } finally {
    if (moved) renameSync(`${p.statePath}.walk-unavailable`, p.statePath);
  }
  check(readFileSync(p.statePath).equals(originalState),
    "The walk leaves the owner's world as it found it — the state file is byte-identical");

  // The whole log as data: strictly monotonic, no gaps, no duplicate emission.
  const snapshot = await channel("capture.events");
  const receipts = snapshot.data.receipts;
  const seqs = receipts.map(receipt => receipt.seq);
  const histogram = receipts.reduce((counts, receipt) => {
    counts[receipt.event] = (counts[receipt.event] ?? 0) + 1;
    return counts;
  }, {});
  metric("kernel_events_total", receipts.length);
  check(seqs.length === new Set(seqs).size && seqs.every((seq, index) => seq === index + 1),
    `The kernel event log is strictly monotonic 1..${seqs.length} — no gaps, no duplicate emission`, {histogram});
}
