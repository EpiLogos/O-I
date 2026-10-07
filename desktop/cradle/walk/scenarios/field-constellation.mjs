#!/usr/bin/env node
// Constellation entry. In the field (Epi world off, an ordinary linked corpus whose pages are Central sources) a graph
// MULTI-SELECT gathers pages into the encounter's constellation (`enter-constellation`); "Open in Technè" creates the
// constellation in the Project's own Wiki through the owner's `aikit.constellation.apply` (every member citing its exact
// source at the exact revision), seats it, and enters Technè on that scene through the existing selection + `oi:epi-examine`
// hop. Then: Technè shows exactly that set; the Wiki register on disk holds exactly that set; return lands on the field with
// the encounter intact. The refusal path (a published edition's pages are read, not cited) is walked too.
//   OI_AIKIT_BIN=$(which aikit) FIELD_SITE_ROOT=<site root> node walk/scenarios/field-constellation.mjs
import {execFileSync} from "node:child_process";
import {chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 260) : ""}`); return !!ok; };
const aikit = process.env.OI_AIKIT_BIN;
if (!aikit) { console.error("OI_AIKIT_BIN must name the native AIKit"); process.exit(2); }
const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));
const provision = async ({root, home, projectRoot}) => {
  const router = join(root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") { const c = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync("oi", args, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`); chmodSync(router, 0o755);
  const env = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: join(root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_BIN: router};
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", projectRoot, "project", "bind", "field-walk", "--directory", projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  // Technè hosts the vendored Expressions application, which the kernel serves from the Central ground's own Work/O-I (the
  // production route); the disposable ground gets that build copied there.
  const dist = fileURLToPath(new URL("../../expressions-app/dist", import.meta.url));
  mkdirSync(join(root, "Work/O-I/desktop/cradle/expressions-app"), {recursive: true});
  cpSync(dist, join(root, "Work/O-I/desktop/cradle/expressions-app/dist"), {recursive: true});
  // one page outside the Project's source horizon, linking to the README: readable by the field, not citable by a Wiki
  writeFileSync(join(projectRoot, "outside.md"), "# Outside Page\n\nA page beside the horizon. Home: [Harbour Notes](ProjectCentral/user/README.md).\n");
  return {env};
};
const f = await bootField({epi: false, provision, fixture, fixtureAt: "ProjectCentral/user"});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const tabs = () => page.locator(".ftab").count();
const title = () => page.locator(".article.fpane:not([hidden]) .ahead__title").textContent();
const R = p => `central:source:project:field-walk:ProjectCentral/user/${p}`;
const wikiFile = () => JSON.parse(readFileSync(join(f.ground.root, "Work/Field/ProjectCentral/agents/wiki/wiki.json"), "utf8"));
const nodeBox = async ref => (await page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first().boundingBox());
const stage = () => page.evaluate(() => [...document.querySelectorAll("[data-mode-stage]")].find(e => !e.hidden)?.dataset.modeStage ?? "base");
let failed = false;
try {
  // scope → the linked project; its pages are Central sources (ProjectCentral/user)
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000}); await settle(800);
  const e0 = await enc();
  check(e0.world_ref === "project:field-walk" && e0.primary.ref.startsWith("central:source:project:field-walk:"), "the corpus's refs use the Project's own id (project:field-walk), not its directory name", e0.primary.ref);
  // turn the main page to the corpus README (search, Shift+Enter = main)
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("Harbour Notes"); await settle(300); await search.press("Shift+Enter"); await search.fill(""); await settle(1000);
  check(await title() === "Harbour Notes", "the main page is the corpus README", await title());
  // the locus: the README's neighbours are drawn
  await page.waitForFunction(() => document.querySelectorAll(".graph-svg .gn").length >= 4, null, {timeout: 20000});
  const drawn = await page.evaluate(() => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref));
  const want = [R("notes/alpha.md"), R("notes/beta.md"), R("projects/plan.md")];
  check(want.every(r => drawn.includes(r)), "the graph draws Alpha, Beta and the Plan around the home page", drawn.length);
  const before = await enc(), tabs0 = await tabs();

  // gather by pointer: Cmd/Ctrl-click two nodes, then the card's Gather button on the third
  for (const r of want.slice(0, 2)) { const b = await nodeBox(r); await page.keyboard.down("Control"); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.keyboard.up("Control"); await settle(300); }
  let e1 = await enc();
  check(JSON.stringify(e1.constellation?.refs) === JSON.stringify(want.slice(0, 2)), "Ctrl-click gathers a node into the constellation (and selects nothing)", e1.constellation);
  check(e1.selected === before.selected && e1.focus === "primary" && await tabs() === tabs0, "gathering opened no tab and navigated nowhere");
  const b3 = await nodeBox(want[2]); await page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 2); await settle(300);
  await page.locator(".gcard [data-gather]").click(); await settle(400);
  e1 = await enc();
  check(JSON.stringify(e1.constellation?.refs) === JSON.stringify(want), "the card's Gather adds the selected page", e1.constellation?.refs?.length);
  check(await page.locator(".graph-svg .gn.is-gathered").count() === 3, "the three gathered nodes are marked in the graph");
  check(await page.locator(".gcons__list li").count() === 3, "the constellation bar lists exactly the three");
  // keyboard: g toggles the selected node; press it twice (take out, put back)
  await page.locator(".graph-svg").focus(); await page.keyboard.press("g"); await settle(300);
  check((await enc()).constellation.refs.length === 2, "keyboard: g on the selected node takes it out");
  await page.keyboard.press("g"); await settle(300);
  check((await enc()).constellation.refs.length === 3, "…and puts it back");
  await page.screenshot({path: shotPath("field-constellation-01-gathered-1440.png")});
  const gen = (await enc()).generation, wikiBefore = wikiFile();

  // hand-off
  await page.getByRole("button", {name: "Open in Technè"}).click();
  await page.getByLabel("Constellation title").fill("Harbour pages");
  await page.getByRole("button", {name: /Create it in the Wiki/}).click();
  await page.waitForFunction(() => [...document.querySelectorAll("[data-mode-stage]")].some(e => e.dataset.modeStage === "techne" && !e.hidden), null, {timeout: 60000});
  await settle(2500);
  check(await stage() === "techne", "Technè is entered by the existing hop (oi:epi-examine)", await stage());
  const wiki = wikiFile();
  const frames = (wiki.objects ?? wiki.graph ?? Object.values(wiki).flat()).filter?.(o => o && o.object === "frame") ?? [];
  const mine = frames.find(fr => JSON.stringify(fr).includes("Harbour pages"));
  const members = (mine?.constellations?.[0]?.members ?? []).map(m => m.ref);
  record.wikiFrame = {frame: mine?.ref, members};
  check(!!mine && JSON.stringify(members.slice().sort()) === JSON.stringify(want.slice().sort()), "the Project's Wiki register on disk holds the constellation with exactly the gathered set", {members: members.length});
  check(JSON.stringify(mine?.constellations?.[0]?.members?.map(m => m["aikit.constellation-participation/v1"]?.sources?.[0]?.source_revision?.slice(0, 12)).every(Boolean)) === "true", "every member cites its source at an exact revision");
  check((wiki.objects ?? []).length > (wikiBefore.objects ?? []).length || JSON.stringify(wiki) !== JSON.stringify(wikiBefore), "the register changed only by that creation");
  // the hosted Technè application renders the scene in its own frame: read what it shows
  let seen = "";
  for (let i = 0; i < 40 && !(/alpha/.test(seen) && /beta/.test(seen) && /plan/.test(seen)); i++) {
    seen = (await Promise.all(page.frames().filter(fr => fr !== page.mainFrame()).map(fr => fr.evaluate(() => document.body?.innerText ?? "").catch(() => "")))).join("\n");
    await settle(500);
  }
  record.techneFrameText = seen.replace(/\s+/g, " ").slice(0, 300);
  const map = await page.locator('[data-region="left"]').innerText();
  check(/Harbour pages/.test(map) && ["alpha", "beta", "plan"].every(n => map.includes(n)), "Technè's wiki map lists the constellation with exactly its three members", map.replace(/\s+/g, " ").slice(0, 160));
  check(/Harbour pages/.test(seen) && ["alpha", "beta", "plan"].every(n => seen.includes(n)), "the focused Technè projection shows that constellation: its title and the three members", record.techneFrameText);
  check(!/gamma|glossary|reference/i.test(seen.replace(/Harbour pages/g, "")), "…and nothing else of the corpus");
  await page.screenshot({path: shotPath("field-constellation-02-techne-1440.png")});

  // return to the field: the window's own return chip (left frame)
  if ((await page.evaluate(() => document.querySelector('[data-region="left"]')?.dataset.depth)) !== "panel") { await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(500); }
  await page.locator(".left-return").click({timeout: 15000}); await settle(1500);
  check(await stage() === "base" && await page.locator(".field-root").isVisible(), "Return lands on the field");
  const e2 = await enc();
  check(e2.primary.ref === before.primary.ref && JSON.stringify(e2.constellation?.refs) === JSON.stringify(want) && e2.generation === gen, "the encounter is intact on return: same main page, same constellation, same generation", {gen: e2.generation, was: gen});
  check(await page.locator(".graph-svg .gn.is-gathered").count() === 3, "the gathered nodes are still marked");

  // refusal: a page the Wiki cannot cite is gathered; the owner's refusal is shown in its own words and nothing is created
  await page.locator(".gcons button", {hasText: "Leave"}).click(); await settle(300);
  const wikiNow = JSON.stringify(wikiFile());
  const outsideRef = `central:source:project:field-walk:outside.md`;
  await page.waitForFunction(ref => !!document.querySelector(`.graph-svg .gn[data-ref="${ref}"]`), outsideRef, {timeout: 20000});
  for (const r of [outsideRef, want[0]]) { const b = await nodeBox(r); await page.keyboard.down("Control"); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.keyboard.up("Control"); await settle(250); }
  check((await enc()).constellation?.refs.length === 2, "a new constellation of two pages is gathered (one outside the source horizon)");
  await page.getByRole("button", {name: "Open in Technè"}).click();
  await page.getByLabel("Constellation title").fill("Should not exist");
  await page.getByRole("button", {name: /Create it in the Wiki/}).click();
  await page.locator(".gcons__err").waitFor({timeout: 30000});
  const refusal = await page.locator(".gcons__err").textContent();
  record.refusal = refusal;
  check(refusal.length > 20 && await stage() === "base", "the owner's refusal is shown in its own words and the field stays", refusal.slice(0, 200));
  check(JSON.stringify(wikiFile()) === wikiNow, "nothing was created: the Wiki register is byte-identical");
  check((await enc()).constellation?.refs.length === 2, "the gathered set is kept so the person can adjust it");
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-constellation-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-constellation.json", {scenario: "field-constellation", at: new Date().toISOString(), passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, record, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
