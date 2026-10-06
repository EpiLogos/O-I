#!/usr/bin/env node
// The CANDIDATE route, end to end, against the real Central ground: `scripts/candidate-launch.mjs --mode web --worlds-root …`
// (the real Cradle on vite, the kernel as the loopback walk bridge, the essay read from the INSTALLED World through the kernel — no edition
// server, no edition address), driven as a person would: first-run welcome, "Choose a corpus" listing the real projects, the Epi-Logos lens on,
// the packaged essay, a relation selected and opened as a tangent, an Expression played from the packaged renderer.
//
//   OI_WORLDS_ROOT=<root with the installed World> (default ~/.oi-candidates/worlds)  [OI_CANDIDATE_BIN=<oi>]  [FIELD_BRIDGE_BIN=<walk-bridge>]
//   node walk/scenarios/candidate-route.mjs [--url http://127.0.0.1:PORT/ --bridge http://127.0.0.1:PORT]   (default: launch the candidate itself)
//
// It launches the candidate with its own free ports and stops exactly the processes it started (the launcher's pid; the launcher stops its bridge
// and vite). The real ground is read, and the AIKit/Central state the field touches is the candidate profile's; nothing is written to the ground.
// Receipt: walk/artifacts/candidate-route.json (grade A: the real ground, the installed World, the real kernel).
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {existsSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {shotPath, writeReceipt} from "../lib/field-walk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "../..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const worldsRoot = process.env.OI_WORLDS_ROOT ?? join(homedir(), ".oi-candidates/worlds");
const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 300) : ""}`); };
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const {port} = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const waitHttp = async (url, label, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); } throw new Error(`${label} did not answer at ${url}`); };

let launcherLog = "";
let launcher = null, appUrl = arg("url"), bridgeUrl = arg("bridge");
const record = {scenario: "candidate-route", spec_ref: "docs/cradle/CENTRAL-FIELD-WORLD-PACKAGE.md §5 and scripts/candidate-launch.mjs (the owner's candidate route)", grade: "A", at: new Date().toISOString(), worlds_root: worldsRoot};
let browser, page, failed = false;
try {
  if (!appUrl) {
    if (!existsSync(join(worldsRoot, "epi-logos/confronting-the-limit/current.json"))) throw new Error(`no installed World under ${worldsRoot} (install one with site/essay-world.mjs install)`);
    const bridgePort = await freePort(), vitePort = await freePort();
    const args = [join(cradle, "scripts/candidate-launch.mjs"), "--mode", "web", "--worlds-root", worldsRoot, "--bridge-port", String(bridgePort), "--vite-port", String(vitePort), "--no-open"];
    if (process.env.OI_CANDIDATE_BIN) args.push("--oi", process.env.OI_CANDIDATE_BIN);
    launcher = spawn(process.execPath, args, {cwd: cradle, env: process.env, stdio: ["ignore", "pipe", "pipe"]});
    let log = ""; const take = d => { log += d; launcherLog += d; }; launcher.stdout.on("data", take); launcher.stderr.on("data", take);
    appUrl = `http://127.0.0.1:${vitePort}/`; bridgeUrl = `http://127.0.0.1:${bridgePort}`;
    await waitHttp(appUrl, "the Cradle dev server"); await waitHttp(`${bridgeUrl}/state`, "the kernel bridge");
    record.launch = {pid: launcher.pid, args: args.slice(1), app: appUrl, bridge: bridgeUrl, edition_server: /essay edition/.test(log) ? "started (unexpected)" : "none"};
    check(/installed under .*no edition server/.test(log) && !/essay edition\s+http/.test(log), "the candidate launched with the installed World and no edition server", log.split("\n").filter(l => /candidate:/.test(l)).slice(0, 3));
  }
  const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.OI_CHROMIUM ?? (existsSync(chromium.executablePath()) ? undefined : existsSync(system) ? system : undefined);
  browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});   // a fresh profile: nothing stored, so the first-run welcome is real
  // the one thing a walk adds: the read-only observation attribute the field exposes for walks (`data-encounter`); no storage, no edition, no bridge address
  await context.addInitScript(() => { try { window.__OI_FIELD_PROBE__ = true; } catch { /* opaque frame */ } });
  page = await context.newPage();
  const errors = [], responses = [], failures = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 240)); });
  page.on("response", r => responses.push({url: r.url(), status: r.status()}));
  page.on("requestfailed", r => failures.push({url: r.url().slice(0, 140), error: r.failure()?.errorText}));
  const settle = ms => page.waitForTimeout(ms);
  await page.goto(appUrl);
  await page.waitForSelector(".desktop-shell", {timeout: 60000});

  // 0 — first run: the welcome is real, and one click dismisses it
  const welcome = page.locator(".oi-welcome");
  check(await welcome.count() > 0, "a fresh profile shows the first-run welcome over the shell");
  await welcome.first().click({force: true});
  const gone = await page.waitForFunction(() => !document.querySelector(".oi-welcome"), null, {timeout: 15000}).then(() => true, () => false);
  check(gone, "one click dismisses the welcome (it fades out and leaves the shell)");

  // 1 — the field on the REAL ground: nothing is linked yet, and it says so, with the real projects to choose from
  await page.waitForSelector(".field-root", {timeout: 60000});
  await page.waitForFunction(() => /Choose a corpus/.test(document.querySelector(".field-root")?.innerText ?? ""), null, {timeout: 120000});
  const choose = await page.locator(".field-root").innerText();
  const projects = ["ACTUATION", "CENTRAL", "FACTORY", "O-I", "QUATERNAL-LOGIC", "AI-KIT"].filter(p => choose.toUpperCase().includes(p));
  check(/NOT CONNECTED/i.test(choose) && projects.length >= 4, "the field opens on 'Choose a corpus', listing the real ground's projects", projects);
  check(await page.locator('.futil__btn[data-util="scope"]').isVisible(), "the utility bar is there (scope, modes, companion, settings)", await page.evaluate(() => [...document.querySelectorAll("[data-util]")].map(e => e.getAttribute("data-util"))));
  await page.screenshot({path: shotPath("candidate-route-01-choose.png")});

  // 2 — the Epi-Logos lens on: the footer lens is revealed from the bottom edge (hover), then pressed
  const lens = page.locator('button[aria-label="Epi-Logos lens"]');
  await page.locator(".workspace-footer-edge").hover(); await settle(300);
  await lens.click({force: true});
  check(await page.locator(".left-lens-chip").count() > 0 && (await lens.getAttribute("aria-pressed")) === "true", "the Epi-Logos lens is on (the chip is shown, the lens is pressed)");
  // "Opening the field…" is the loading state and carries the same title class as the essay: wait for the essay itself
  const t0 = Date.now();
  await page.waitForFunction(() => { const h = document.querySelector(".field-root .ahead__title"); return h && !/^Opening the field/.test(h.textContent ?? "") && document.querySelectorAll(".graph-svg .gn").length > 0; }, null, {timeout: 180000});
  const openedMs = Date.now() - t0;
  const title = await page.locator(".field-root .ahead__title").first().innerText();
  const nodes = await page.locator(".graph-svg .gn").count();
  check(/Confronting the Limit/.test(title) && nodes > 0, "the packaged essay appears: its title and its graph", {title: title.slice(0, 90), graph_nodes: nodes, opened_after_ms: openedMs});
  await settle(1500);
  await page.screenshot({path: shotPath("candidate-route-02-essay.png")});

  // 3 — the manuscript at M16, a relation selected and opened as a tangent
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 90000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 60000});
  await settle(800);
  const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
  const e0 = await enc();
  check(/^central:source:project:Antykathera-Essay-Work:submission-package\/essay\//.test(e0.primary.ref) && e0.primary.span === "M16", "the field stands at M16, addressed by the World's native refs", {ref: e0.primary.ref, span: e0.primary.span});
  const clickNode = async ref => { const b = await page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const rel = await page.evaluate(() => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).find(r => /\/arguments\//.test(decodeURIComponent(r)) && !/README/.test(decodeURIComponent(r))));
  const at = await clickNode(rel); await settle(400);
  const eSel = await enc();
  check(eSel.selected === rel && eSel.primary.span === "M16", "selecting a relation selects it without leaving the passage", {selected: eSel.selected?.split(":").pop().slice(-60)});
  await page.mouse.dblclick(...at);
  await page.waitForFunction(r => { try { return JSON.parse(document.querySelector(".field-root").getAttribute("data-encounter")).tangent?.ref === r; } catch { return false; } }, rel, {timeout: 60000}); await settle(800);
  const eT = await enc();
  const tangentBody = await page.locator(".article.fpane:not([hidden])").first().innerText().catch(() => "");
  check(eT.tangent?.ref === rel && eT.primary.span === "M16", "double-click opens the relation as a tangent beside the passage", {tangent: rel.split("/").pop(), generation: eT.generation});
  await page.screenshot({path: shotPath("candidate-route-03-tangent.png")});

  // 4 — an Expression, from the Library as the tangent with its scene, played by the renderer the World carries
  await page.getByRole("button", {name: /Library/}).first().click(); await settle(800);
  await page.waitForSelector(".library .xcard", {timeout: 60000});
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(500);
  const card = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"]');
  await card.locator(".xchip-s").nth(2).click();
  await page.waitForSelector("iframe.xframe", {timeout: 60000}); await settle(3500);
  const eX = await enc();
  check(eX.tangent?.kind === "expression" && eX.tangent.ref === "expression:roz-room-02-return-of-zero" && !!eX.scene?.scene_id, "an Expression opened as the tangent with its scene", {ref: eX.tangent?.ref, scene: eX.scene?.scene_id});
  const frame = page.frames().find(fr => /\/renderer\/expression\.html/.test(fr.url()));
  check(!!frame && frame.url().startsWith(`${bridgeUrl}/world/`) && /[?&]x=roz-room-02-return-of-zero/.test(frame.url()), "the frame is the packaged renderer, served by the bridge's /world/ route", frame?.url().replace(bridgeUrl, ""));
  const playing = frame ? await frame.evaluate(() => ({text: document.body.innerText.length, state: document.querySelector("[data-state]")?.getAttribute("data-state") ?? null, canvas: document.querySelectorAll("canvas").length})).catch(() => null) : null;
  check(playing && playing.text > 40 && playing.state === "ready" && playing.canvas > 0, "the Expression plays (state ready: the body was checked against the index digest)", playing);
  await page.screenshot({path: shotPath("candidate-route-04-expression.png")});

  // 5 — where every byte of the essay came from, and what went wrong on the way
  const world = responses.filter(r => r.url.startsWith(`${bridgeUrl}/world/`));
  const foreign = responses.filter(r => !r.url.startsWith(appUrl) && !r.url.startsWith(bridgeUrl) && !/^(data|blob):/.test(r.url));
  const essayBytes = world.filter(r => /\/edition\/|\/renderer\//.test(r.url));
  const has = part => essayBytes.some(r => r.url.includes(part) && r.status === 200);
  check(essayBytes.length > 0 && essayBytes.every(r => r.status === 200) && ["/edition/static/fieldIndex.json", "/edition/quartz-source.json", "/edition/expressions/index.json", "/edition/THE-RETURN-OF-ZERO.html", "/renderer/expression.html", "/edition/expressions/x/roz-room-02-return-of-zero.journey.json"].every(has), "every edition and renderer request went to the bridge's /world/ route and was served (index, receipt, pages, renderer, journey)", {requests: essayBytes.length, statuses: [...new Set(essayBytes.map(r => r.status))]});
  check(foreign.length === 0, "nothing was requested from any other host (no edition server, no edition address)", foreign.slice(0, 3));
  // Chrome aborts in-flight requests with ERR_NETWORK_CHANGED whenever this Mac's network state changes under it (observed here with no change of
  // ours, more often while other browsers run). That is the browser's report about the machine, not a page error: it is counted and shown, not hidden,
  // and every check above passed regardless; any other error fails the walk.
  const aborted = errors.filter(m => /ERR_NETWORK_CHANGED/.test(m));
  const errs = errors.filter(m => !/favicon|ERR_NETWORK_CHANGED/.test(m));
  check(errs.length === 0, `no page or console errors (${aborted.length} request(s) aborted by the browser's ERR_NETWORK_CHANGED are counted separately)`, errs.slice(0, 4));
  record.network_changed_aborts = {console_errors: aborted.length, failed_requests: failures.filter(f => /ERR_NETWORK_CHANGED/.test(f.error ?? "")).length};
  record.requests = {world: world.length, sample: world.slice(0, 4).map(r => r.url.replace(bridgeUrl, "")), failed: failures.slice(0, 5)};
  record.projects = projects;
} catch (error) {
  failed = true; await page?.screenshot?.({path: shotPath("candidate-route-failure.png")}).catch(() => {});
  check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
} finally {
  try { await browser?.close(); } catch { /* gone */ }
  let stopped = null;
  if (launcher) { launcher.kill("SIGTERM"); await new Promise(r => setTimeout(r, 2500)); stopped = launcher.exitCode !== null || launcher.killed; }
  const passed = checks.filter(c => c.ok).length;
  if (failed || checks.some(c => !c.ok)) record.launcher_log_tail = launcherLog.split("\n").filter(l => !/GET \/(state|events)/.test(l)).slice(-40);
  writeReceipt("candidate-route.json", {...record, launcher_stopped: stopped, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
