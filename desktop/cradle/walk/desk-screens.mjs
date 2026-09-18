// The Factory desk reading screenshots (2026-09-18 redesign pass): drives the
// running cradle against the real walk bridge and the enriched conformance
// specimen (labelled fixture material in a dev/test environment only), and
// captures the desk in each of its stages: returned (interrupts + review
// card + trace drill + work map), the material depth on the right, and the
// working stage. Evidence for the stage-driven reading, not acceptance of
// any owner's production Run.
import {chromium} from "playwright";
import {writeFileSync} from "node:fs";

const S = "/private/tmp/oi-factory-desk-specimen";
const RUN = "run:01ARZ3NDEKTSV4RRFFQ69G5FAA";
const LINK = "central-project:specimen-20260918";
const PROJECT = process.env.WALK_PROJECT ?? "O-I";
const artifacts = "walk/artifacts";

const browser = await chromium.launch({headless: true});
const errors = [];

async function stage() {
  const context = await browser.newContext({viewport: {width: 1422, height: 858}, reducedMotion: "reduce"});
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  await page.addInitScript(() => {
    window.__OI_KERNEL_BRIDGE__ = "http://127.0.0.1:4179";
    sessionStorage.setItem("oi-cradle.welcome.v1", "1");
  });
  return {context, page};
}

async function connect(page, statePath) {
  await page.goto(process.env.WALK_URL ?? "http://localhost:4173");
  await page.getByRole("button", {name: PROJECT, exact: true}).click();
  await page.getByRole("navigation", {name: PROJECT + " work", exact: true}).getByRole("button", {name: "Runs / Build", exact: true}).click();
  const runs = page.getByRole("region", {name: "Factory Runs and Build"});
  await runs.locator(".factory-source-picker summary").click();
  await runs.getByLabel("Developmental state path", {exact: true}).fill(statePath);
  await runs.getByLabel("Central Project ref", {exact: true}).fill(LINK);
  await runs.getByLabel("Run ref (optional)", {exact: true}).fill(RUN);
  await runs.getByRole("button", {name: "Read Runs", exact: true}).click();
  await runs.locator(".fb-build-surface").waitFor({timeout: 20000});
  return runs;
}

try {
  // — Returned stage: interrupts pin the top, review leads the body. —
  const returned = await stage();
  const runs = await connect(returned.page, `${S}/desk-state.json`);
  const sentence = await runs.locator(".fb-run-sentence").innerText();
  console.log("HEADER SENTENCE:", sentence.trim());
  const interruptsFirst = await runs.locator(".fb-interrupts").evaluate(el => {
    const reading = el.closest(".fb-reading");
    return reading && reading.firstElementChild === el;
  });
  console.log("INTERRUPTS FIRST:", interruptsFirst);
  await returned.page.screenshot({path: `${artifacts}/factory-desk-20260918-returned.png`});

  // The review card: claim with its evidence directly beneath it.
  const claim = runs.locator(".fb-review-card .fb-claim-reading").first();
  const evidenceUnderClaim = await claim.locator(".fb-claim-evidence .fb-evidence-inline").count();
  console.log("EVIDENCE INLINE UNDER CLAIM:", evidenceUnderClaim);

  // Drill into the execution's trace.
  await runs.locator(".fb-trace-drill > summary").first().click();
  await runs.locator(".fb-trace-drill .fb-waterfall").waitFor({timeout: 5000});
  await returned.page.screenshot({path: `${artifacts}/factory-desk-20260918-trace.png`});

  // The work map folds open as orientation.
  await runs.locator("details.fb-workmap > summary").click();
  await runs.getByRole("region", {name: "Factory Run map"}).waitFor({timeout: 5000});
  await returned.page.screenshot({path: `${artifacts}/factory-desk-20260918-workmap.png`});

  // The material depth opens on the right return pane.
  await runs.getByRole("button", {name: "Open native material", exact: true}).click();
  await returned.page.locator(".factory-material-surface").first().waitFor({timeout: 10000});
  await returned.page.screenshot({path: `${artifacts}/factory-desk-20260918-material.png`});

  // — Working stage: live work leads, the header speaks the run as working. —
  const working = await stage();
  const workingRuns = await connect(working.page, `${S}/working-state.json`);
  console.log("WORKING SENTENCE:", (await workingRuns.locator(".fb-run-sentence").innerText()).trim());
  await working.page.screenshot({path: `${artifacts}/factory-desk-20260918-working.png`});
  await working.context.close();
  await returned.context.close();

  writeFileSync(`${artifacts}/factory-desk-20260918.json`, JSON.stringify({
    standing: "dev environment: real cradle build + real walk bridge + enriched conformance specimen (labelled fixture); not production acceptance",
    headerSentenceReturned: sentence.trim(),
    interruptsFirst,
    evidenceInlineUnderClaim: evidenceUnderClaim,
    errors
  }, null, 2));
  if (errors.length) throw new Error("page errors: " + errors.join("; "));
  console.log("DESK SCREENSHOTS COMPLETE");
} catch (error) {
  console.error(String(error));
  await returned?.page?.screenshot({path: `${artifacts}/factory-desk-20260918-failure.png`}).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
