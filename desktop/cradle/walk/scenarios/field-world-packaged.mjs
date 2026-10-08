#!/usr/bin/env node
// The Epi field over the INSTALLED World package, with no edition server and no edition address anywhere: the page is given only the
// kernel bridge, the kernel is given only OI_WORLDS_ROOT, and every byte of the essay arrives through the bridge's `/world/` route (the dev
// mirror of the Tauri host's `oi-material://localhost/__world/…`). A second phase points the kernel at an empty worlds root and shows the
// field naming the absence instead of falling back.
//
//   OI_WORLDS_ROOT=<root an installed World lives under> FIELD_APP_URL=http://localhost:1451/ node walk/scenarios/field-world-packaged.mjs
//   (or --package <World package dir>: it is installed into a throwaway root first)
//
// Receipt: walk/artifacts/field-world-packaged.json (grade B: real kernel through the walk bridge, headless chromium on the real app).
import {execFileSync, spawn} from "node:child_process";
import {existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {shotPath, toggleEpi, writeReceipt} from "../lib/field-walk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "../..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const APP = process.env.FIELD_APP_URL ?? "http://localhost:1451/";
const BRIDGE_BIN = process.env.FIELD_BRIDGE_BIN ?? join(cradle, "kernel/target/debug/walk-bridge");
const CTRL = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 300) : ""}`); };
const temps = [];
let worldsRoot = process.env.OI_WORLDS_ROOT;
if (arg("package")) {
  worldsRoot = mkdtempSync(join(tmpdir(), "oi-worlds-")); temps.push(worldsRoot);
  execFileSync(process.execPath, [join(cradle, "../../site/essay-world.mjs"), "install", resolve(arg("package")), "--root", worldsRoot], {stdio: "ignore"});
}
if (!worldsRoot || !existsSync(worldsRoot)) { console.error("OI_WORLDS_ROOT must name a root holding an installed World (or pass --package DIR)"); process.exit(2); }
if (!existsSync(BRIDGE_BIN)) { console.error(`no walk bridge at ${BRIDGE_BIN}`); process.exit(2); }

async function waitHttp(url, label) { for (let i = 0; i < 120; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); } throw new Error(`${label} did not answer at ${url}`); }

/** One field session: a fresh ground, the bridge over `root`, a fresh browser context with NO edition configured. */
async function session(root, label, fn) {
  const ground = realpathSync(mkdtempSync(join(tmpdir(), "oi-field-ground-"))), home = mkdtempSync(join(tmpdir(), "oi-field-home-")); temps.push(ground, home);
  const call = (a, i = {}) => execFileSync(CTRL, ["--root", ground, "--json", "action", "run", a, JSON.stringify(i)], {encoding: "utf8"});
  call("central.init"); mkdirSync(join(ground, "Work", "Field")); call("projectcentral.init", {project: "Field", project_id: "field-world"});
  const port = 4300 + Math.floor(Math.random() * 500);
  const bridge = spawn(BRIDGE_BIN, [`127.0.0.1:${port}`], {cwd: ground, env: {...process.env, OI_CENTRAL_ROOT: ground, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field", OI_WORLDS_ROOT: root}, stdio: "ignore"});
  const bridgeUrl = `http://127.0.0.1:${port}`;
  let browser;
  try {
    await waitHttp(`${bridgeUrl}/state`, "the walk bridge");
    const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const executablePath = process.env.OI_CHROMIUM ?? (existsSync(chromium.executablePath()) ? undefined : existsSync(system) ? system : undefined);
    browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 240)); });
    page.on("response", r => requests.push({url: r.url(), status: r.status()}));
    // the page is given the kernel bridge and nothing else: no edition address, no stored one
    await context.addInitScript(({bridgeUrl}) => { try { sessionStorage.setItem("oi-cradle.welcome.v1", "field-walk"); localStorage.setItem("oi-cradle.welcome.v1", "field-walk"); window.__OI_FIELD_PROBE__ = true; window.__OI_KERNEL_BRIDGE__ = bridgeUrl; } catch { /* opaque frame */ } }, {bridgeUrl});
    await page.goto(APP);
    await page.waitForSelector(".desktop-shell", {timeout: 60000}); await page.waitForSelector(".field-root", {timeout: 60000});
    return await fn({page, requests, errors, bridgeUrl, label});
  } finally { try { await browser?.close(); } catch { /* gone */ } try { bridge.kill(); } catch { /* gone */ } }
}

const record = {scenario: "field-world-packaged", spec_ref: "docs/cradle/CENTRAL-FIELD-WORLD-PACKAGE.md §5 (the TypeScript contract for the Epi adapter)", grade: "B", at: new Date().toISOString(), worlds_root: worldsRoot};
let failed = false;
try {
  // phase 1: the installed World, served only by the bridge
  await session(worldsRoot, "installed", async ({page, requests, errors, bridgeUrl}) => {
    await toggleEpi(page, true);
    await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 90000});
    const stored = await page.evaluate(() => ({edition_override: window.__OI_ESSAY_EDITION__ ?? null, saved: localStorage.getItem("oi-cradle.essay-edition")}));
    check(stored.edition_override === null && stored.saved === null, "no edition address is configured anywhere in the page (no override, nothing saved)", stored);
    const search = page.getByRole("searchbox", {name: "Search"});
    await search.fill("The Return of Zero"); await page.waitForTimeout(300); await search.press("Shift+Enter");
    await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
    await search.fill("");
    await page.locator(".mrail__t[data-span='M16']").click({force: true});
    await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000});
    await page.waitForTimeout(800);
    const encounter = JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
    check(/^central:source:project:Antykathera-Essay-Work:submission-package\/essay\//.test(encounter.primary.ref) && encounter.primary.span === "M16", "the field stands at M16 of the essay, addressed by the World's native refs", {ref: encounter.primary.ref, span: encounter.primary.span});
    const body = await page.locator(".article.fpane:not([hidden]) .abody, .article.fpane:not([hidden])").first().innerText();
    check(body.length > 500, "the passage's text is on screen", {chars: body.length});
    // an Expression, opened from the Library as the tangent with its scene, played by the renderer the World carries
    await page.getByRole("button", {name: /Library/}).first().click(); await page.waitForTimeout(800);
    await page.waitForSelector(".library .xcard", {timeout: 30000});
    await page.locator(".xcolls button", {hasText: /^Here/}).click(); await page.waitForTimeout(500);
    const card = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"]');
    await card.locator(".xchip-s").nth(2).click();
    await page.waitForSelector("iframe.xframe", {timeout: 30000}); await page.waitForTimeout(3000);
    const eX = JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
    check(eX.tangent?.kind === "expression" && eX.tangent.ref === "expression:roz-room-02-return-of-zero" && !!eX.scene?.scene_id, "an Expression opened as the tangent with its scene", {ref: eX.tangent?.ref, scene: eX.scene?.scene_id});
    const frame = page.frames().find(fr => /\/renderer\/expression\.html/.test(fr.url()));
    check(!!frame && frame.url().startsWith(`${bridgeUrl}/world/`) && /[?&]x=roz-room-02-return-of-zero/.test(frame.url()) && /embed=1/.test(frame.url()), "the frame is the renderer the World carries, served by the /world/ route, asked for this Expression", frame?.url().replace(bridgeUrl, ""));
    const playing = frame ? await frame.evaluate(() => ({text: document.body.innerText.length, failure: document.querySelector("[data-state]")?.getAttribute("data-state") ?? null, canvas: document.querySelectorAll("canvas").length})).catch(() => null) : null;
    check(playing && playing.text > 40 && playing.failure === "ready", "the real Expression renderer is playing in its frame (state ready: the renderer checked the body against the index digest before drawing)", playing);
    const frameRequests = requests.filter(r => frame && r.url.startsWith(`${bridgeUrl}/world/`) && /renderer\/|expressions\//.test(r.url));
    check(["renderer/expression.html", "renderer/assets/", "edition/expressions/index.json", "edition/expressions/x/roz-room-02-return-of-zero.journey.json"].every(part => frameRequests.some(r => r.url.includes(part) && r.status === 200)), "the renderer, its assets, the index and the journey body all came through /world/ with 200", frameRequests.map(r => r.url.replace(`${bridgeUrl}/world/epi-logos%2Fconfronting-the-limit/`, "").replace(/^[0-9a-f]{16}\//, "")));
    await page.screenshot({path: shotPath("field-world-packaged-03-expression.png")});
    const worldRequests = requests.filter(r => r.url.startsWith(`${bridgeUrl}/world/`));
    const other = requests.filter(r => !r.url.startsWith(APP) && !r.url.startsWith(bridgeUrl) && !r.url.startsWith("data:") && !r.url.startsWith("blob:"));
    check(worldRequests.length > 0 && worldRequests.every(r => r.status === 200), "every edition and renderer request went to the bridge's /world/ route and was served", {requests: worldRequests.length, statuses: [...new Set(worldRequests.map(r => r.status))]});
    check(worldRequests.some(r => /\/edition\/static\/fieldIndex\.json$/.test(r.url)) && worldRequests.some(r => /\/edition\/section-rooms\/.*\.html$|\/edition\/THE-RETURN-OF-ZERO\.html$/.test(r.url)), "the structure index and a page were read through it", worldRequests.slice(0, 3).map(r => r.url.replace(bridgeUrl, "")));
    check(other.length === 0, "nothing was requested from any other host (no edition server exists)", other.slice(0, 3));
    const ops = await page.evaluate(() => performance.getEntriesByType("resource").filter(e => /\/op$/.test(e.name)).length);
    check(ops > 0, "the kernel was asked (world_resolve) over the bridge", {op_requests: ops});
    await page.screenshot({path: shotPath("field-world-packaged-01-installed.png")});
    const errs = errors.filter(m => !/Failed to load resource|favicon/.test(m));
    check(errs.length === 0, "no page or console errors", errs.slice(0, 3));
    record.installed = {world_requests: worldRequests.length, sample: worldRequests.slice(0, 6).map(r => r.url.replace(bridgeUrl, "")), primary: encounter.primary};
  });
  // phase 2: no World installed under the root the kernel is given
  const empty = mkdtempSync(join(tmpdir(), "oi-worlds-empty-")); temps.push(empty);
  await session(empty, "absent", async ({page, requests, bridgeUrl}) => {
    await toggleEpi(page, true).catch(() => {});
    await page.waitForFunction(() => /Return-of-Zero World is absent/.test(document.body.innerText), null, {timeout: 60000});
    const text = await page.evaluate(() => document.body.innerText);
    const reason = (text.match(/The Return-of-Zero World is absent[^\n]*/) ?? [""])[0];
    check(/no World epi-logos\/confronting-the-limit is installed under/.test(reason), "an empty worlds root: the field names the absence and its reason (no fallback host)", reason.slice(0, 200));
    check(requests.filter(r => r.url.startsWith(`${bridgeUrl}/world/`)).length === 0, "no edition file was requested when none is installed");
    await page.screenshot({path: shotPath("field-world-packaged-02-absent.png")});
    record.absent = {reason};
  });
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
} finally {
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-world-packaged.json", {...record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  for (const t of temps) rmSync(t, {recursive: true, force: true});
  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
