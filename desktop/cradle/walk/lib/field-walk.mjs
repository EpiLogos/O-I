// Shared plumbing for the field walks: a disposable Central ground, the prebuilt walk bridge (no cargo build), a static
// server for a built essay edition, and a headless chromium on the real app. Dev tooling only.
//
//   FIELD_APP_URL      the served Cradle bundle (vite dev or preview)           default http://localhost:1451/
//   FIELD_SITE_ROOT    a built site root: it holds essay/ and expression.html   required
//   FIELD_BRIDGE_BIN   the walk-bridge binary                                   default kernel/target/debug/walk-bridge
import {execFileSync, spawn} from "node:child_process";
import {cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {serveEdition} from "./field-edition-server.mjs";

export const cradleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const artifacts = join(cradleRoot, "walk/artifacts");

async function waitHttp(url, label, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const r = await fetch(url); if (r.ok) return; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); }
  throw new Error(`${label} did not answer at ${url}`);
}

export async function bootField({width = 1440, height = 900, epi = true, bridge = true, fixture = null, provision = null, siteRoot = process.env.FIELD_SITE_ROOT, appUrl = process.env.FIELD_APP_URL ?? "http://localhost:1451/"} = {}) {
  if (!siteRoot || !existsSync(join(siteRoot, "essay/static/fieldIndex.json"))) throw new Error("FIELD_SITE_ROOT must name a built site root (essay/static/fieldIndex.json)");
  const disposers = [];
  let ground = null;
  const dispose = async () => { for (const d of disposers.reverse()) { try { await d(); } catch { /* best effort */ } } };
  try {
    const edition = await serveEdition(siteRoot, 0);
    disposers.push(() => edition.close());
    let bridgeUrl = null;
    if (bridge) {
      const bin = process.env.FIELD_BRIDGE_BIN ?? join(cradleRoot, "kernel/target/debug/walk-bridge");
      if (!existsSync(bin)) throw new Error(`no walk-bridge binary at ${bin} (build it, or set FIELD_BRIDGE_BIN)`);
      const root = mkdtempSync(join(tmpdir(), "oi-field-ground-")), home = mkdtempSync(join(tmpdir(), "oi-field-home-"));
      disposers.push(() => { rmSync(root, {recursive: true, force: true}); rmSync(home, {recursive: true, force: true}); });
      const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
      const call = (a, i = {}) => execFileSync(ctrl, ["--root", root, "--json", "action", "run", a, JSON.stringify(i)], {encoding: "utf8"});
      call("central.init"); mkdirSync(join(root, "Work", "Field")); call("projectcentral.init", {project: "Field", project_id: "field-walk"});
      if (fixture) cpSync(fixture, join(root, "Work", "Field"), {recursive: true});   // an ordinary corpus, linked as the project
      const port = 4300 + Math.floor(Math.random() * 500);
      // a walk that needs more of the ground (an AIKit home, a session) provisions it here and may add to the bridge's env
      const extra = provision ? await provision({root, home, projectRoot: join(root, "Work", "Field")}) : {};
      const child = spawn(bin, [`127.0.0.1:${port}`], {cwd: root, env: {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field", ...(extra?.env ?? {})}, stdio: "ignore"});
      if (extra?.cleanup) disposers.push(extra.cleanup);
      ground = {root, home, extra};
      disposers.push(() => child.kill());
      await waitHttp(`http://127.0.0.1:${port}/state`, "the walk bridge");
      bridgeUrl = `http://127.0.0.1:${port}`;
    }
    // OI_CHROMIUM names a chromium-family executable; without it the bundled one, then an installed Google Chrome.
    const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const executablePath = process.env.OI_CHROMIUM ?? (existsSync(chromium.executablePath()) ? undefined : existsSync(system) ? system : undefined);
    const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
    disposers.push(() => browser.close());
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message + " " + String(e.stack ?? "").split("\n").slice(1, 3).join(" | ")));
    page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
    const editionUrl = `http://127.0.0.1:${edition.port}/essay/`;
    await page.addInitScript(({bridgeUrl, editionUrl}) => {
      try {
        sessionStorage.setItem("oi-cradle.welcome.v1", "field-walk"); localStorage.setItem("oi-cradle.welcome.v1", "field-walk");
        localStorage.setItem("oi-cradle.essay-edition", editionUrl);
        window.__OI_FIELD_PROBE__ = true;
        if (bridgeUrl) window.__OI_KERNEL_BRIDGE__ = bridgeUrl;
      } catch { /* opaque frame */ }
    }, {bridgeUrl, editionUrl});
    await page.goto(appUrl);
    await page.waitForSelector(".desktop-shell", {timeout: 60000});
    await page.waitForSelector(".field-root", {timeout: 60000});
    if (epi) await toggleEpi(page, true);
    return {page, errors, editionUrl, ground, siteBase: `http://127.0.0.1:${edition.port}`, dispose, browser, context, bridgeUrl};
  } catch (e) { await dispose(); throw e; }
}

export async function toggleEpi(page, on) {
  const pressed = await page.evaluate(() => !!document.querySelector(".left-lens-chip"));
  if (pressed === on) return;
  await page.locator(".workspace-footer-edge").hover().catch(() => {});
  await page.waitForTimeout(250);
  await page.locator('button[aria-label="Epi-Logos lens"]').click({force: true});
  if (on) await page.waitForSelector(".field-root .ahead__title, .field-root .fq-body", {timeout: 60000});
}

export const shotPath = name => { mkdirSync(artifacts, {recursive: true}); return join(artifacts, name); };
export const writeReceipt = (name, receipt) => { mkdirSync(artifacts, {recursive: true}); writeFileSync(join(artifacts, name), JSON.stringify(receipt, null, 2) + "\n"); };
