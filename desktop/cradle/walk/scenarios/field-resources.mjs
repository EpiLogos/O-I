#!/usr/bin/env node
// Resource and latency behaviour of the field under repeated use. One CYCLE is the full encounter loop:
//   select -> open tangent -> keep -> promote -> back -> open Expression -> return          (7 transitions)
// and the walk runs CYCLES of them (default 30). Per transition it records input -> paint latency (the input event's own
// timestamp to the second animation frame after the state the transition promises is observed). At the start, the peak
// and after every 10 cycles (settled: garbage collected, loop returned to the main passage) it records JS heap, DOM nodes,
// event listeners, iframes (document and frame tree) and the browser process tree's RSS. Cold and warm first-useful-ready
// timings are measured before the loop.
//
// Budget: the FIRST run writes walk/artifacts/field-resources.budget.json from what it saw (latency x1.5, structural
// drift allowances). That run reports numbers and a verdict but is not judged against a budget it created; later runs
// are. Nothing is tuned to a number: the raw receipt is walk/artifacts/field-resources.json.
//   FIELD_SITE_ROOT=<site root> [FIELD_CYCLES=30] node walk/scenarios/field-resources.mjs
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {cpus, loadavg} from "node:os";
import {join} from "node:path";
import {artifacts, bootField, toggleEpi, writeReceipt} from "../lib/field-walk.mjs";

const CYCLES = Number(process.env.FIELD_CYCLES ?? 30);
const checks = [], skipped = [], record = {cycles: CYCLES};
const skip = label => { skipped.push(label); console.log(`SKIP — ${label}`); };
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 300) : ""}`); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null; };

const f = await bootField({epi: false});
const {page, browser, context} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
await context.addInitScript(() => { const keep = e => { window.__in = e.timeStamp; }; addEventListener("pointerdown", keep, true); addEventListener("keydown", keep, true); });
await page.evaluate(() => { if (window.__inInstalled) return; window.__inInstalled = true; const keep = e => { window.__in = e.timeStamp; }; addEventListener("pointerdown", keep, true); addEventListener("keydown", keep, true); });   // the init script only reaches pages opened after it
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

// ---- instruments -------------------------------------------------------------------------------------------------------
let bcdp = null;
const rssKb = async () => {
  // the browser's own process list (CDP SystemInfo), each pid's resident set read from ps, children included
  bcdp ??= await browser.newBrowserCDPSession();
  const info = (await bcdp.send("SystemInfo.getProcessInfo")).processInfo ?? [];
  const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], {encoding: "utf8"}).trim().split("\n").map(l => l.trim().split(/\s+/).map(Number));
  const rss = new Map(rows.map(([p, , r]) => [p, r])), kids = new Map();
  for (const [p, pp] of rows) (kids.get(pp) ?? kids.set(pp, []).get(pp)).push(p);
  const seen = new Set(); let sum = 0; const walk = p => { if (seen.has(p)) return; seen.add(p); sum += rss.get(p) ?? 0; for (const c of kids.get(p) ?? []) walk(c); };
  for (const x of info) walk(x.id);
  return sum || null;
};
const sample = async ({gc = false} = {}) => {
  if (gc) { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); await settle(300); }
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
  const dom = await page.evaluate(() => ({iframes: document.querySelectorAll("iframe").length, live: document.querySelectorAll("*").length}));
  return {heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents, frames: page.frames().length, iframes: dom.iframes, liveNodes: dom.live, rssMB: await (async () => { const k = await rssKb(); return k == null ? null : +(k / 1024).toFixed(0); })()};
};
const latencies = [];     // {kind, ms, cycle}
// Latency is a property of the machine as much as of the field: with the machine busy (a build, another agent's walk) every
// transition is slower. The 1-minute load average and core count are recorded at the start, at every checkpoint and at the end;
// if the load exceeded half the cores at any of them the latency budget is NOT EVALUATED (and says so), while the structural
// checks (DOM, listeners, heap, RSS, frames) are always evaluated. A real regression still fails on a quiet machine.
const CORES = cpus().length, LOAD_LIMIT = 0.5 * CORES;
const loads = [{at: "start", load1: +loadavg()[0].toFixed(2)}];
const noteLoad = at => loads.push({at, load1: +loadavg()[0].toFixed(2)});
const timed = async (kind, cycle, action, cond, arg) => {
  await page.evaluate(() => { window.__in = null; });
  await action();
  await page.waitForFunction(cond, arg, {timeout: 30000});
  const r = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res({now: performance.now(), at: window.__in})))));
  if (r.at != null) latencies.push({kind, ms: +(r.now - r.at).toFixed(1), cycle});
  else latencies.push({kind, ms: null, cycle});
};
const encIs = "(a) => { try { const e = JSON.parse(document.querySelector('.field-root').getAttribute('data-encounter')); return eval(a.expr); } catch { return false; } }";
const waitEnc = (expr, arg) => [new Function("a", `try { const e = JSON.parse(document.querySelector('.field-root').getAttribute('data-encounter')); return !!(${expr}); } catch { return false; }`), arg];
const node = ref => page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first();
const centre = async ref => { const b = await node(ref).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

let failed = false;
try {
  // ---- cold / warm first-useful-ready ---------------------------------------------------------------------------------
  // cold: a fresh browser context (empty HTTP cache); the shell, then the essay after the lens is turned on
  const timing = {};
  const fresh = async () => {
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
    await ctx.addInitScript(({bridgeUrl, editionUrl}) => { try { sessionStorage.setItem("oi-cradle.welcome.v1", "field-walk"); localStorage.setItem("oi-cradle.welcome.v1", "field-walk"); localStorage.setItem("oi-cradle.essay-edition", editionUrl); if (bridgeUrl) window.__OI_KERNEL_BRIDGE__ = bridgeUrl; } catch { /* opaque */ } }, {bridgeUrl: f.bridgeUrl, editionUrl: f.editionUrl});
    return ctx;
  };
  const useful = async p => { await p.waitForSelector(".article.fpane:not([hidden]) .ahead__eyebrow", {timeout: 90000}); await p.waitForFunction(() => document.querySelectorAll(".graph-svg .gn").length > 0 && !!document.querySelector(".article.fpane:not([hidden]) .ahead__title"), null, {timeout: 90000}); };
  {
    const ctx = await fresh(), p = await ctx.newPage(); const t0 = Date.now();
    await p.goto(process.env.FIELD_APP_URL ?? "http://localhost:1451/"); await p.waitForSelector(".field-root", {timeout: 60000});
    timing.cold_shell_ms = Date.now() - t0;
    const t1 = Date.now(); await toggleEpi(p, true); await useful(p);
    timing.cold_essay_after_lens_ms = Date.now() - t1; timing.cold_total_ms = Date.now() - t0;
    const t2 = Date.now(); await p.reload(); await p.waitForSelector(".field-root", {timeout: 60000});
    if (!(await p.locator(".article.fpane:not([hidden]) .ahead__eyebrow").count())) await toggleEpi(p, true);
    await useful(p); timing.warm_reload_total_ms = Date.now() - t2;
    await ctx.close();
  }
  record.timing = timing;
  console.log("timing", JSON.stringify(timing));

  // ---- the walk's own page: M16, two relations ------------------------------------------------------------------------
  await toggleEpi(page, true);
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000}); await settle(1200);
  const main = (await enc()).primary.ref;
  const rel = await page.evaluate(() => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /\/arguments\//.test(decodeURIComponent(l.dataset.ref)) && !/README/.test(decodeURIComponent(l.dataset.ref))); return li?.dataset.ref; });
  if (!rel) throw new Error("no relation into the arguments is offered at M16");
  const start = await sample({gc: true});
  record.start = start; record.settled = [{cycle: 0, ...start}];
  let peak = {...start};
  const DIAG = process.env.FIELD_DIAG === "1"; record.diag = [];
  let lastKind = null; let prev = start;
  const track = async () => {
    if (DIAG) { const s2 = await sample({gc: true}); record.diag.push({after: lastKind, dNodes: s2.nodes - prev.nodes, dListeners: s2.listeners - prev.listeners, dLive: s2.liveNodes - prev.liveNodes, nodes: s2.nodes, live: s2.liveNodes, listeners: s2.listeners}); prev = s2; } const s = await sample(); for (const k of ["heapMB", "nodes", "listeners", "frames", "iframes", "rssMB"]) if ((s[k] ?? 0) > (peak[k] ?? 0)) peak[k] = s[k]; };

  const PHASES = new Set((process.env.FIELD_PHASES ?? "tangent,expression").split(","));   // bisecting aid: which half of the loop runs
  for (let c = 1; c <= CYCLES; c++) {
    if (PHASES.has("tangent")) {
    const [x, y] = await centre(rel);
    lastKind = "select"; await timed("select", c, () => page.mouse.click(x, y), ...waitEnc(`e.selected === a`, rel)); await track();
    const [x2, y2] = await centre(rel);
    lastKind = "open-tangent"; await timed("open-tangent", c, () => page.mouse.dblclick(x2, y2), ...waitEnc(`e.tangent && e.tangent.ref === a`, rel)); await settle(250); await track();
    lastKind = "keep"; await timed("keep", c, () => page.locator(".ftab").nth(1).dblclick(), () => !document.querySelectorAll(".ftab")[1]?.classList.contains("ftab--preview")); await track();
    lastKind = "promote"; await timed("promote", c, () => page.locator(".ftab").nth(1).locator("[data-promote]").click({force: true}), ...waitEnc(`e.primary.ref === a`, rel)); await settle(250); await track();
    lastKind = "back"; await timed("back", c, () => page.keyboard.press("Alt+ArrowLeft"), ...waitEnc(`e.primary.ref === a`, main)); await settle(250); await track();
    }
    if (PHASES.has("library") && !PHASES.has("expression")) {
      await page.keyboard.press("l"); await page.locator(".library .xcard").first().waitFor({timeout: 30000});   // a locator, not waitForSelector: that returns an ElementHandle, which pins the detached gallery for the life of the page (a measurement artifact found by heap snapshot)
      await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(300);
      lastKind = "library-open"; await track();
      await page.keyboard.press("l"); await settle(500); lastKind = "library-close"; await track();
    }
    if (PHASES.has("expression")) {
    // open the room's Expression through the Library (setup is untimed; the opening click is the transition)
    await page.keyboard.press("l"); await page.locator(".library .xcard").first().waitFor({timeout: 30000});   // a locator, not waitForSelector: that returns an ElementHandle, which pins the detached gallery for the life of the page (a measurement artifact found by heap snapshot)
    await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(200);
    const chip = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"] .xchip-s').nth(2);
    lastKind = "open-expression"; await timed("open-expression", c, () => chip.click(), () => !!document.querySelector("iframe.xframe")); await settle(900); await track();
    lastKind = "return"; await timed("return", c, () => page.locator(".ftab").first().click(), () => !document.querySelector("iframe.xframe") && true); await settle(300); await track();
    }
    // put the strip back to one tab so every cycle starts the same: close every non-main tab
    for (let k = 0; k < 6 && await page.locator(".ftab").count() > 1; k++) { await page.locator(".ftab").last().locator("[data-close]").click({force: true}).catch(() => {}); await settle(150); }
    if ((await enc()).primary.ref !== main) { await page.keyboard.press("Alt+ArrowLeft"); await settle(500); }
    if (c === 1 || c % 10 === 0 || c === CYCLES) { await settle(600); const s = await sample({gc: true}); record.settled.push({cycle: c, ...s}); console.log(`settled@${c}`, JSON.stringify(s)); }
    noteLoad(`cycle ${c}`);
    if (c % 5 === 0) console.log(`cycle ${c}/${CYCLES} done`);
  }
  record.peak = peak;

  noteLoad("end");
  const peakLoad = Math.max(...loads.map(l => l.load1));
  const loaded = peakLoad > LOAD_LIMIT;
  record.machine = {cores: CORES, load_limit: LOAD_LIMIT, peak_load1: peakLoad, start_load1: loads[0].load1, end_load1: loads.at(-1).load1, samples: loads.length, loaded};
  console.log("machine", JSON.stringify(record.machine));
  // ---- latency summary --------------------------------------------------------------------------------------------------
  const kinds = [...new Set(latencies.map(l => l.kind))];
  record.latency = Object.fromEntries(kinds.map(k => { const v = latencies.filter(l => l.kind === k && l.ms != null).map(l => l.ms); return [k, {n: v.length, p50: pct(v, 0.5), p95: pct(v, 0.95), max: Math.max(...v), first: v[0], last: v[v.length - 1]}]; }));
  record.latencySamples = latencies;
  console.log("latency (ms)", JSON.stringify(record.latency));

  // ---- budget and verdict -------------------------------------------------------------------------------------------------
  // the baseline for leak judgement is the WARMED state (after cycle 1: page caches, the explorer's opened rows, the Library's
  // cards are loaded once and legitimately stay); the cold start is reported beside it, not judged against
  const end = record.settled.at(-1), warmed = record.settled.find(s => s.cycle === 1) ?? start;
  record.warmed = warmed;
  const drift = {heapMB: +(end.heapMB - warmed.heapMB).toFixed(2), nodes: end.nodes - warmed.nodes, listeners: end.listeners - warmed.listeners, iframes: end.iframes - start.iframes, frames: end.frames - start.frames, rssMB: end.rssMB == null ? null : end.rssMB - warmed.rssMB};
  record.drift = drift;
  const budgetFile = join(artifacts, "field-resources.budget.json");
  let budget, established = false;
  if (existsSync(budgetFile)) budget = JSON.parse(readFileSync(budgetFile, "utf8"));
  else {
    established = true;
    budget = {established_at: new Date().toISOString(), basis: "first run; observed values with allowances, set before any tuning", established_under_load: loaded ? {peak_load1: peakLoad, cores: CORES, warning: "the machine was loaded: these latencies are inflated; re-establish on a quiet machine"} : null,
      latency_p95_ms: Object.fromEntries(kinds.map(k => [k, Math.ceil(record.latency[k].p95 * 1.5)])),
      settled_drift_allowed: {nodes_pct: 10, listeners_pct: 10, heapMB_pct: 25, rssMB_pct: 30, iframes: 0, frames: 0}};
    writeFileSync(budgetFile, JSON.stringify(budget, null, 2) + "\n");
  }
  record.budget = {file: "walk/artifacts/field-resources.budget.json", established_by_this_run: established, ...budget};
  const within = (d, base, p) => base == null || d <= Math.max(1, base * p / 100);
  const a = budget.settled_drift_allowed;
  const leak = {
    orphan_iframes: end.iframes !== start.iframes || end.frames !== start.frames,
    nodes: !within(drift.nodes, warmed.nodes, a.nodes_pct), listeners: !within(drift.listeners, warmed.listeners, a.listeners_pct),
    heap: !within(drift.heapMB, warmed.heapMB, a.heapMB_pct), rss: drift.rssMB != null && !within(drift.rssMB, warmed.rssMB, a.rssMB_pct),
  };
  // growth that never gives back: every settled checkpoint at least as large as the one before, and the last above the first
  const warmedSeries = record.settled.filter(s => s.cycle >= 1);
  const mono = key => warmedSeries.length > 2 && warmedSeries.every((s, i) => i === 0 || s[key] >= warmedSeries[i - 1][key]) && end[key] > warmed[key];
  record.monotonic = {nodes: mono("nodes"), listeners: mono("listeners"), heapMB: mono("heapMB"), rssMB: mono("rssMB")};
  record.verdict = {leak_or_orphan_found: Object.values(leak).some(Boolean), leak, monotonic_growth: record.monotonic, note: established ? "budget created by this run (not a judgement against itself); verdict uses its allowances" : "judged against the stored budget"};
  console.log("start", JSON.stringify(start)); console.log("peak ", JSON.stringify(peak)); console.log("end  ", JSON.stringify(end)); console.log("drift", JSON.stringify(drift)); console.log("verdict", JSON.stringify(record.verdict));

  check(latencies.length >= CYCLES * 7 * 0.9, "every transition of every cycle was timed (input to paint)", {timed: latencies.filter(l => l.ms != null).length, expected: CYCLES * 7});
  check(!leak.orphan_iframes, "no orphan iframes or frames after the loop (the Expression frame is released every time)", {start: [start.iframes, start.frames], end: [end.iframes, end.frames]});
  check(!leak.nodes && !leak.listeners, "settled DOM nodes and event listeners stay within the allowance of the warmed state (cycle 1)", {nodes: [warmed.nodes, end.nodes], listeners: [warmed.listeners, end.listeners]});
  check(!leak.heap, "settled JS heap stays within the allowance of the warmed state", {warmed: warmed.heapMB, end: end.heapMB});
  check(!leak.rss, "settled process-tree RSS stays within the allowance of the warmed state", {warmed: warmed.rssMB, end: end.rssMB});
  if (!established) for (const k of kinds) {
    if (loaded) skip(`latency budget: ${k} p95 ${record.latency[k].p95} ms vs ${budget.latency_p95_ms[k]} ms — not evaluated: machine loaded (1-min load ${peakLoad} > ${LOAD_LIMIT} = half of ${CORES} cores)`);
    else check(record.latency[k].p95 <= budget.latency_p95_ms[k], `latency budget: ${k} p95 ${record.latency[k].p95} ms <= ${budget.latency_p95_ms[k]} ms (quiet machine: load ${peakLoad} <= ${LOAD_LIMIT})`);
  }
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 6).join(" | "));
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt(process.env.FIELD_DIAG === "1" ? "field-resources.diag.json" : "field-resources.json", {scenario: "field-resources", at: new Date().toISOString(), record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length, skipped: skipped.length}, checks, skipped});
  console.log(`\n${passed}/${checks.length} checks passed${skipped.length ? `, ${skipped.length} not evaluated (machine loaded)` : ""}`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
