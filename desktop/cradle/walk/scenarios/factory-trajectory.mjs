// factory-trajectory (11-FACTORY §3.3, §7 F9 F10 F11): the Trajectory over
// REAL encounter journals, real kernel. The disposable ground's run A names
// two sessions on its attempts (walk/lib/factory-session.mjs, isolated
// AIKIT_HOME): the running review attempt's session is driven through the
// existing pi/GLM harness (Pi stamps message times and usage), the returned
// survey attempt's session through Hermes over ACP (no owner stamps).
//
//   F9  — Pi session: the lane strip is on a time axis (Duration · Turns ·
//         Calls); the footer's turns · steps · tokens · cache hit · cost
//         EQUAL sums computed here, independently, from the owner's own
//         `encounter read` of the same journal.
//   F10 — ACP session: the axis says "Order", no axis toggles, and the footer
//         shows only turns and steps — no invented durations or tokens.
//   F11 — paused tape: scrolled up, a real new turn arrives (sent through the
//         owner while the page watches); "Resume live · n new" appears with
//         n > 0 and the view does not move (scrollTop equal ±0.5px);
//         resuming follows to the newest row.
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, near, recordOps, shotMatrix} from "../lib/factory-ground.mjs";
import {makeSessions, SESSIONS, SPACE} from "../lib/factory-session.mjs";
import {realProviderAuthorised, REAL_PROVIDER_SKIP_NOTE} from "../lib/walk-provider.mjs";

export async function setup(args) {
  const ground = await factoryGround(args);
  if (!realProviderAuthorised()) {
    return {...ground, realProviderSkipped: true,
      cleanup: () => ground.cleanup()};
  }
  let sessions;
  try {
    const projectRoot = join(ground.root, "Work", "Specimen");
    sessions = makeSessions({root: ground.root, projectRoot, projectId: "specimen-walk", env: ground.env});
    sessions.native("encounter-configure", "--provider-json", JSON.stringify({protocol: "acp", id: "factory-walk-hermes", label: "Factory walk Hermes ACP", argv: [join(process.env.HOME, ".local/bin/hermes-acp")]}));
    sessions.openPi(SESSIONS.review);
    await sessions.turn(SESSIONS.review, "Use your bash tool to run `ls` and then `pwd` in the current directory (two separate calls), then reply with one short sentence naming what you saw.");
    sessions.request(SESSIONS.survey, "open", {space: SPACE, provider: "factory-walk-hermes", cwd: projectRoot});
    await sessions.turn(SESSIONS.survey, "Reply with exactly the word: ok", {timeoutMs: 120000});
    return {...ground, sessions, env: {...ground.env, ...pick(sessions.env, ["AIKIT_HOME", "OI_AIKIT_BIN", "OI_BIN"])},
      cleanup: () => { sessions.stop(); setTimeout(() => ground.cleanup(), 1200); }};
  } catch (error) { sessions?.stop(); ground.cleanup(); throw error; }
}
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));

/** Independent sums over the owner's journal: assistant message_end usage. */
function ownerUsage(events) {
  const sum = {steps: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0, any: false};
  for (const {event} of events) {
    const message = event?.event?.Signal?.kind?.kind === "status" ? event.event.Signal.kind.message : undefined;
    if (typeof message !== "string" || !message.startsWith("{")) continue;
    let parsed; try { parsed = JSON.parse(message); } catch { continue; }
    if (parsed.type !== "message_end" || parsed.message?.role !== "assistant" || !parsed.message.usage) continue;
    const usage = parsed.message.usage;
    sum.any = true; sum.steps++;
    sum.input += usage.input ?? 0; sum.output += usage.output ?? 0; sum.cacheRead += usage.cacheRead ?? 0; sum.cacheWrite += usage.cacheWrite ?? 0;
    sum.totalTokens += usage.totalTokens ?? 0; sum.cost += usage.cost?.total ?? 0;
  }
  return sum;
}
const tokens = value => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M` : value >= 1000 ? `${Math.round(value / 1000)}K` : String(value);

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  if (p.realProviderSkipped) {
    await page.goto(baseUrl); await channel("info");
    check(true, REAL_PROVIDER_SKIP_NOTE);
    return;
  }
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  recordOps(page);
  const A = p.specimen.runs.A;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});
  await centre.locator(`[data-run-card="${A.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await runPage.waitFor();
  await runPage.getByRole("tab", {name: "Trajectory", exact: true}).click();
  const selector = runPage.getByRole("combobox", {name: "Session"});
  await selector.waitFor({timeout: 60000});
  const options = (await selector.locator("option").allInnerTexts()).map(text => text.trim());
  const ownerSessions = p.specimen.readings.inspect.attempts.filter(attempt => attempt.body?.agentSessionRef).length;
  check(options.length === ownerSessions && options.every(text => / · attempt \d+$/.test(text)), "Session selector: one entry per attempt the owner names, as agent · unit · attempt n", {options});
  const fall = runPage.locator(".ftraj-fall-row");
  await fall.first().waitFor({timeout: 30000}).catch(() => {});
  const bars = await runPage.locator(".ftraj-fall-bar").evaluateAll(nodes => nodes.map(node => { const bar = node.getBoundingClientRect(), track = node.parentElement.getBoundingClientRect(); return {start: Number(node.getAttribute("data-start")), running: node.getAttribute("data-running") === "true", left: bar.left - track.left, right: track.right - bar.right}; }));
  const ownerStarts = [p.specimen.readings.telemetryInspect, p.specimen.readings.telemetryInspectRunning].map(reading => Date.parse(reading.reading.temporal.started.value)).sort();
  const first = bars.find(bar => bar.start === ownerStarts[0]), running = bars.find(bar => bar.running);
  check(bars.length === 2 && JSON.stringify(bars.map(bar => bar.start).sort()) === JSON.stringify(ownerStarts) && !!first && near(first.left, 0) && !!running && near(running.right, 0),
    "Execution waterfall: one bar per execution at the owner's telemetry start; the earliest starts at the track's left edge and the running one reaches its right edge (±0.5px)", {bars, ownerStarts});

  // ---- F9: the Pi session
  const reviewOption = options.find(text => /^Reviewer/.test(text)) ?? options[0];
  await selector.selectOption({label: reviewOption});
  const foot = runPage.locator("[data-trajectory-stats]");
  await page.waitForFunction(() => document.querySelector("[data-trajectory-stats]")?.getAttribute("data-trajectory-stats") === "timed", null, {timeout: 90000});
  const journal = p.sessions.read(SESSIONS.review).events;
  const usage = ownerUsage(journal);
  const turns = journal.filter(entry => entry.event?.kind === "user-message").length;
  const expected = [`${turns} turn${turns === 1 ? "" : "s"}`, `${usage.steps} steps`, `${tokens(usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite)} tok`,
    ...(usage.input + usage.cacheRead > 0 ? [`cache hit ${Math.round(usage.cacheRead / (usage.input + usage.cacheRead) * 100)}%`] : []), `$${usage.cost.toFixed(3)}`].join(" · ");
  const footText = (await foot.innerText()).trim();
  check(usage.any && footText === expected, "F9: footer stats EQUAL the owner journal's own usage sums (turns · steps · tokens · cache hit · cost)", {footText, expected, usage});
  const strip = runPage.locator(".ftraj-strip");
  check(await strip.getAttribute("data-axis") === "duration" && await runPage.getByRole("radio", {name: "Duration"}).count() === 1, "F9: the lane strip is on a time axis with Duration · Turns · Calls");
  const modelMarks = await strip.locator('[data-lane-kind="model"]').count(), toolMarks = await strip.locator('[data-lane-kind="tools"]').count();
  check(modelMarks === usage.steps && toolMarks >= 2, "F9: one Model mark per model step, one Tools mark per call", {modelMarks, toolMarks});
  const beforeTurns = await strip.locator('[data-lane-kind="model"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("x"))));
  await runPage.getByRole("radio", {name: "Calls"}).click();
  const afterCalls = await strip.locator('[data-lane-kind="model"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("x"))));
  check(await strip.getAttribute("data-axis") === "calls" && JSON.stringify(beforeTurns) !== JSON.stringify(afterCalls), "Toggling Calls changes the x-axis (marks move)");
  await runPage.getByRole("radio", {name: "Duration"}).click();
  await shotMatrix(page, shot, "factory-trajectory", async () => {});

  // ---- F10: the ACP session
  const surveyOption = options.find(text => /^Surveyor/.test(text)) ?? options[1];
  await selector.selectOption({label: surveyOption});
  await page.waitForFunction(() => document.querySelector("[data-trajectory-stats]")?.getAttribute("data-trajectory-stats") === "order", null, {timeout: 90000});
  await page.waitForFunction(() => /steps/.test(document.querySelector("[data-trajectory-stats]")?.textContent ?? "") && document.querySelectorAll(".ftraj .tape-row").length > 0, null, {timeout: 60000});
  const orderFoot = (await foot.innerText()).trim();
  const acpJournal = p.sessions.read(SESSIONS.survey).events;
  check(await runPage.locator('[data-axis="order"]').first().innerText() === "Order" && await runPage.getByRole("radio", {name: "Duration"}).count() === 0,
    "F10: without owner timestamps the axis says Order and the Duration/Turns/Calls toggles are absent");
  check(/^\d+ turns? · \d+ steps$/.test(orderFoot) && !ownerUsage(acpJournal).any, "F10: the footer shows only turns and steps — no tokens, cost or tok/s invented", {orderFoot});
  const durations = await runPage.locator(".ftraj .tape-duration").allInnerTexts();
  check(durations.every(text => !/\d/.test(text)), "F10: no invented durations on the rows", {durations});
  await shot("f10-order");

  // ---- F11: paused, a real arrival
  await selector.selectOption({label: reviewOption});
  await page.waitForFunction(() => document.querySelector("[data-trajectory-stats]")?.getAttribute("data-trajectory-stats") === "timed", null, {timeout: 60000});
  await page.setViewportSize({width: 1280, height: 560});
  const body = runPage.locator(".ftraj .tape-body");
  // Open rows until the body scrolls, then scroll up to pause following.
  for (const row of await runPage.locator(".ftraj .tape-row-line").all()) { if (await body.evaluate(node => node.scrollHeight > node.clientHeight + 80)) break; await row.click(); }
  await body.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); });
  await page.waitForFunction(() => document.querySelector(".ftraj .tape")?.getAttribute("data-following") === "false", null, {timeout: 10000});
  const pausedTop = await body.evaluate(node => node.scrollTop);
  const rowsBefore = await runPage.locator(".ftraj .tape-row").count();
  await p.sessions.turn(SESSIONS.review, "Use your bash tool once more to run `ls -a`, then reply with one short sentence.");
  await page.waitForFunction(count => document.querySelectorAll(".ftraj .tape-row").length > count, rowsBefore, {timeout: 120000});
  const pill = runPage.locator(".tape-resume");
  const pillText = (await pill.innerText()).trim();
  const afterTop = await body.evaluate(node => node.scrollTop);
  check(/^Resume live · \d+ new$/.test(pillText) && Number(pillText.match(/(\d+) new/)[1]) > 0 && near(pausedTop, afterTop), "F11: while paused, real arrivals show \"Resume live · n new\" and the view does not scroll (scrollTop equal ±0.5px)", {pillText, pausedTop, afterTop});
  await shot("f11-paused");
  await pill.click();
  await page.waitForFunction(() => { const node = document.querySelector(".ftraj .tape-body"); return !!node && node.scrollHeight - node.scrollTop - node.clientHeight <= 24; }, null, {timeout: 10000});
  check(await runPage.locator(".tape-resume").count() === 0 && await runPage.locator(".ftraj .tape").getAttribute("data-following") === "true", "F11: Resume live follows to the newest row again");
  await page.setViewportSize({width: 1280, height: 820});
}
