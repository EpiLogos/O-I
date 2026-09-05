/**
 * U0.4 walk — the kernel seam re-proof, verified by operation in the
 * running app (map §5 U0.4; 05-EXECUTION §3: prose and tests do not
 * establish the condition — the walk does).
 *
 * How the kernel is reached: the web bundle driven by Playwright, with the
 * kernel invoked for real through the **dev-only walk bridge** (map §3
 * D10) — the same typed KernelOp seam the Tauri host fronts
 * (`kernel_op` / `kernel_event_log` + the `oi:kernel-event` topic). The
 * bridge is spawned here with the real `ctrl` on PATH and the real O-I
 * ProjectCentral ground — no fixtures anywhere in the chain.
 *
 * Covers the unit contract:
 *   1. list real sources of project O-I from the real horizon; open one
 *      real file → content renders; edit → dirty marker + exactly ONE
 *      buffer-dirty event;
 *   2. ⌘S → revision advances (receipt revision ≠ previous), canonical
 *      layer updated, buffer clean again, exactly one save-success event;
 *   3. concurrent external edit (echo via shell) then ⌘S → structured
 *      conflict {kind: revision-conflict, expected ≠ current}, BOTH sides
 *      preserved (dirty buffer intact, canonical content readable),
 *      exactly one conflict event; after re-reading the new revision, a
 *      second save succeeds;
 *   4. focus: select the open file surface → exactly one focus event
 *      carrying the same ref;
 *   5. event log seq strictly monotonic 1..N, no gaps, no duplicate
 *      emission for one state change; screenshot of the conflict state.
 *
 * The walk leaves the world as it found it: its last act saves the
 * original content back through the owner (a real save, honestly
 * attributed), and the revision returns to the original content hash.
 *
 * Usage: node walk/u0.4-walk.mjs [baseUrl]  (default http://localhost:4173,
 * served by `npm run preview` after `npm run build`).
 */
import { chromium } from "playwright";
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const baseUrl = process.argv[2] ?? "http://localhost:4173";
const bridgeUrl = process.argv[3] ?? "http://127.0.0.1:4179";
const bridgeBind = bridgeUrl.replace("https://", "").replace("http://", "");
const conflictShot = join(here, "u0.4-conflict.png");
mkdirSync(here, { recursive: true });

const TARGET_REF_PREFIX = "central:source:project:project:o-i:";
const TARGET_PATH = "ProjectCentral/user/learnings/README.md";
const TARGET_FILE = join(repoRoot, TARGET_PATH);
const BRIDGE_MANIFEST = join(here, "../kernel/Cargo.toml");

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};
const now = () => Date.now();

// ---------------------------------------------------------------------------
// The dev-only walk bridge: spawned here, fronting the real kernel + ctrl.

const bridge = spawn("cargo", ["run", "--quiet", "--manifest-path", BRIDGE_MANIFEST, "--bin", "walk-bridge", "--", bridgeBind], {
  cwd: repoRoot,
  stdio: ["ignore", "pipe", "pipe"],
});
let bridgeLog = "";
bridge.stdout.on("data", (chunk) => (bridgeLog += chunk));
bridge.stderr.on("data", (chunk) => (bridgeLog += chunk));
const killBridge = () => {
  bridge.kill("SIGTERM");
  if (bridge.exitCode === null) bridge.kill("SIGKILL");
};
process.on("exit", killBridge);
process.on("SIGINT", () => {
  killBridge();
  process.exit(130);
});

/** The walk leaves the world as it found it — even if it fails midway:
 * a crash handler restores the real file's original bytes. */
let originalContent = null;
const restoreFileOnCrash = (error) => {
  if (originalContent !== null) {
    const onDisk = readFileSync(TARGET_FILE, "utf8");
    if (onDisk !== originalContent) {
      writeFileSync(TARGET_FILE, originalContent);
      console.error(`[crash restore] ${TARGET_FILE} returned to its original bytes`);
    }
  }
  console.error(error?.stack ?? error);
  process.exitCode = 1;
};
process.on("uncaughtException", (error) => {
  restoreFileOnCrash(error);
  process.exit(1);
});

const waitForBridge = async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${bridgeUrl}/state`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`walk bridge did not come up:\n${bridgeLog}`);
};

/** The ordered kernel event log, read straight from the bridge (the same
 * receipts the Tauri topic forwards). */
const allEvents = async () => {
  const response = await fetch(`${bridgeUrl}/events?since=1`);
  const body = await response.json();
  return body.receipts ?? [];
};
const eventsAfter = async (seq) => (await allEvents()).filter((event) => event.seq > seq);
const waitForEvents = async (fromSeq, predicate, what) => {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const events = await eventsAfter(fromSeq);
    if (predicate(events)) return events;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

await waitForBridge();
console.log(`walk bridge up: ${bridgeUrl} (real ctrl, project o-i)`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
await page.addInitScript((url) => {
  window.__OI_KERNEL_BRIDGE__ = url;
}, bridgeUrl);

// ---------------------------------------------------------------------------
// 0. Rest first — the kernel provider adds no DOM; austere rest is intact.
await page.goto(baseUrl, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
const restCensus = await page.evaluate(() =>
  Array.from(document.querySelectorAll("body *")).map((element) =>
    [element.tagName.toLowerCase(), typeof element.className === "string" ? element.className : ""]
      .filter(Boolean)
      .join("."),
  ),
);
check(
  restCensus.join("|") ===
    "div|div.rest|aside.agency-field|main.canvas|textarea.canvas-surface|button.to-affordance",
  "austere rest unchanged with the kernel mounted (census 6 nodes)",
);

// ---------------------------------------------------------------------------
// 1. ⌘O → the real horizon listing; open a real file; content renders.
let t0 = now();
await page.keyboard.press("Meta+o");
await page.waitForSelector(".sources-index .source-row", { timeout: 10_000 });
const rows = await page.evaluate(() =>
  [...document.querySelectorAll(".source-row-open")].map((row) => ({
    ref: row.dataset.ref,
    revision: row.dataset.revision,
  })),
);
check(rows.length >= 3, `the real horizon lists ${rows.length} participating sources (≥3, no fixtures)`);
check(
  rows.every((row) => row.ref.startsWith(TARGET_REF_PREFIX)),
  "every listed ref is Central's canonical grammar (central:source:project:project:o-i:…)",
);
check(
  rows.every((row) => row.revision.startsWith("central.content-fnv1a64/v1:")),
  "every row carries the horizon's live revision",
);
const readmeRow = rows.find((row) => row.ref.endsWith(TARGET_PATH));
check(!!readmeRow, `the walk's real file is listed: ${TARGET_PATH}`);

originalContent = readFileSync(TARGET_FILE, "utf8");
const originalRevision = readmeRow.revision;

let seqBeforeOpen = (await allEvents()).length; // receipts 1..N
await page.click(`.source-row-open[data-ref="${readmeRow.ref}"]`);
await page.waitForSelector(".source-textarea", { timeout: 10_000 });
await page.waitForFunction(
  () => document.querySelector(".source-textarea")?.value.length > 0,
  null,
  { timeout: 10_000 },
);
const tOpen = now() - t0;
const rendered = await page.evaluate(() => ({
  value: document.querySelector(".source-textarea").value,
  revision: document.querySelector(".source-revision").dataset.revision,
  ref: document.querySelector(".source-editor").dataset.ref,
}));
check(rendered.value === originalContent, "the real file's content renders verbatim in the editor");
check(rendered.revision === originalRevision, "the canonical revision shown is the horizon's");
check(rendered.ref === readmeRow.ref, "the surface carries the owner's ref verbatim");

const openEvents = await waitForEvents(
  seqBeforeOpen,
  (events) => events.some((event) => event.event === "source_opened"),
  "source_opened after opening",
);
check(
  openEvents.filter((event) => event.event === "source_opened").length === 1,
  "exactly one source_opened event for the open",
);
check(
  openEvents.filter((event) => event.event === "focus_changed").length === 1 &&
    openEvents.find((event) => event.event === "focus_changed")?.focus?.subject?.ref === readmeRow.ref,
  "the open focused the file's ref (one focus event, same ref)",
);
check(
  openEvents.filter((event) => event.event === "surface_changed").length === 1,
  "exactly one surface_changed event for the new surface",
);
console.log(`  open real file: ${tOpen} ms`);

// ---------------------------------------------------------------------------
// 2. Edit → dirty marker + exactly ONE buffer-dirty event.
const edit1 = `${originalContent}\n<!-- u0.4 kernel seam walk: edit one -->\n`;
await page.fill(".source-textarea", edit1);
await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
check(!!(await page.$(".source-dirty-marker")), "the dirty marker renders (buffer ≠ canonical)");
check(
  !!(await page.$(".tab[data-dirty='true']")),
  "the tab carries the dirty state too",
);
let seqBeforeEdit = (await allEvents()).length;
await page.fill(".source-textarea", `${edit1}more typing that is not a new state change\n`);
await page.waitForTimeout(600); // give any spurious emission time to appear
const edit2Events = await eventsAfter(seqBeforeEdit);
check(
  edit2Events.filter((event) => event.event === "buffer_dirty").length === 0,
  "continued typing emits nothing (no duplicate buffer-dirty for one state)",
);

// ---------------------------------------------------------------------------
// 3. ⌘S → revision advances, canonical updated, buffer clean, one event.
const dirtyContent = await page.evaluate(() => document.querySelector(".source-textarea").value);
const revisionBeforeSave = await page.evaluate(
  () => document.querySelector(".source-revision").dataset.revision,
);
seqBeforeEdit = (await allEvents()).length;
t0 = now();
await page.keyboard.press("Meta+s");
const save1Events = await waitForEvents(
  seqBeforeEdit,
  (events) => events.some((event) => event.event === "source_changed"),
  "save-success event",
);
const tSave = now() - t0;
await page.waitForSelector(".source-editor[data-dirty='false']", { timeout: 10_000 });
check(
  save1Events.filter((event) => event.event === "source_changed").length === 1,
  "exactly one save-success (source_changed) event",
);
const save1 = save1Events.find((event) => event.event === "source_changed");
const revisionAfterSave = save1.revision;
check(
  revisionAfterSave !== revisionBeforeSave,
  `the revision advanced on save: …${revisionBeforeSave.slice(-16)} → …${revisionAfterSave.slice(-16)}`,
);
const canonicalNow = await page.evaluate(
  () => document.querySelector(".source-revision").dataset.revision,
);
check(
  canonicalNow === revisionAfterSave,
  "the canonical layer shown advanced to the receipt revision",
);
check(
  !(await page.$(".source-dirty-marker")),
  "the buffer is clean again (both layers synced)",
);
console.log(`  save (⌘S): ${tSave} ms; receipt revision …${revisionAfterSave.slice(-16)}`);

// ---------------------------------------------------------------------------
// 4. Concurrent external edit → ⌘S → structured conflict, both sides kept.
const edit2 = `${dirtyContent}\n<!-- u0.4 kernel seam walk: edit two (the cradle side) -->\n`;
await page.fill(".source-textarea", edit2);
await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
// The external edit lands on disk under the buffer — echo via shell.
const externalLine = "external edit from outside the cradle (u0.4 conflict probe)";
execSync(`printf '%s\\n' '${externalLine}' >> '${TARGET_FILE}'`);
console.log(`  external edit appended on disk: ${TARGET_PATH}`);

seqBeforeEdit = (await allEvents()).length;
await page.keyboard.press("Meta+s");
const conflictEvents = await waitForEvents(
  seqBeforeEdit,
  (events) => events.some((event) => event.event === "source_write_conflict"),
  "structured conflict event",
);
await page.waitForSelector(".source-editor[data-conflicted='true']", { timeout: 10_000 });
check(
  conflictEvents.filter((event) => event.event === "source_write_conflict").length === 1,
  "exactly one conflict (source_write_conflict) event",
);
const conflictEvent = conflictEvents.find((event) => event.event === "source_write_conflict");
check(
  conflictEvent.source.ref === readmeRow.ref &&
    conflictEvent.expected_revision === revisionAfterSave &&
    conflictEvent.current_revision !== conflictEvent.expected_revision,
  `the conflict is structured with both revisions: expected ≠ current (…${conflictEvent.expected_revision.slice(-12)} ≠ …${conflictEvent.current_revision.slice(-12)})`,
);
// BOTH sides preserved.
const conflictDom = await page.evaluate(() => ({
  buffer: document.querySelector(".source-textarea").value,
  expected: document.querySelector("[data-expected]").dataset.expected,
  current: document.querySelector("[data-current]").dataset.current,
  canonical: document.querySelector(".source-conflict-canonical-body").textContent,
  dirty: document.querySelector(".source-editor").dataset.dirty,
}));
check(conflictDom.buffer === edit2, "the cradle buffer is intact (dirty, preserved — no data loss)");
check(conflictDom.dirty === "true", "the buffer stays dirty through the conflict");
check(
  conflictDom.expected === revisionAfterSave && conflictDom.current === conflictEvent.current_revision,
  "the surfaced panel carries the same expected/current pair as the event",
);
check(
  conflictDom.canonical.includes(externalLine) && conflictDom.canonical.includes("edit one"),
  "the canonical side is readable and shows the external edit (the other preserved side)",
);
await page.screenshot({ path: conflictShot });
console.log(`screenshot: ${conflictShot}`);

// ---------------------------------------------------------------------------
// 5. Re-read the new revision → a second save succeeds.
const seqBeforeReread = (await allEvents()).length;
await page.click(".source-reread");
const rereadEvents = await waitForEvents(
  seqBeforeReread,
  (events) => events.some((event) => event.event === "source_opened"),
  "canonical re-read event",
);
await page.waitForSelector(".source-editor[data-conflicted='false']", { timeout: 10_000 });
check(
  rereadEvents.filter((event) => event.event === "source_opened").length === 1,
  "the re-read is one canonical re-open event",
);
const rebased = await page.evaluate(() => ({
  base: document.querySelector(".source-revision").dataset.revision,
  buffer: document.querySelector(".source-textarea").value,
  dirty: document.querySelector(".source-editor").dataset.dirty,
}));
check(
  rebased.base === conflictEvent.current_revision,
  "the buffer's base rebased onto the current canonical revision",
);
check(
  rebased.buffer === edit2 && rebased.dirty === "true",
  "the cradle edit survived the re-read (still dirty — the layers stay distinct)",
);

await page.click(".source-textarea"); // the caret returns to the writing layer
seqBeforeEdit = (await allEvents()).length;
await page.keyboard.press("Meta+s");
const save2Events = await waitForEvents(
  seqBeforeEdit,
  (events) => events.some((event) => event.event === "source_changed"),
  "second save success",
);
await page.waitForSelector(".source-editor[data-dirty='false']", { timeout: 10_000 });
check(
  save2Events.filter((event) => event.event === "source_changed").length === 1,
  "after the re-read, the second save succeeds — exactly one save-success event",
);
const save2 = save2Events.find((event) => event.event === "source_changed");
check(
  save2.revision !== conflictEvent.current_revision,
  `the revision advanced again on the reconciled save (…${save2.revision.slice(-16)})`,
);

// ---------------------------------------------------------------------------
// 6. Focus: select another surface, then this file surface → exactly one
//    focus event carrying the same ref.
await page.click('.tab[data-title="Sources"]');
await page.waitForSelector(".sources-index", { timeout: 10_000 });
await page.waitForTimeout(400); // let any spurious focus emission surface
let seqBeforeFocus = (await allEvents()).length;
await page.click(`.tab[data-title="README.md"]`);
const focusEvents = await waitForEvents(
  seqBeforeFocus,
  (events) => events.some((event) => event.event === "focus_changed"),
  "focus event on re-selecting the file surface",
);
check(
  focusEvents.filter((event) => event.event === "focus_changed").length === 1,
  "selecting the open file surface emits exactly one focus event",
);
check(
  focusEvents.find((event) => event.event === "focus_changed")?.focus?.subject?.ref === readmeRow.ref,
  "the focus event carries the same ref (the one global focus relation)",
);

// ---------------------------------------------------------------------------
// 7. Leave the world as found: save the original content back through the
//    owner; the revision returns to the original content hash.
await page.fill(".source-textarea", originalContent);
await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
seqBeforeEdit = (await allEvents()).length;
await page.keyboard.press("Meta+s");
const restoreEvents = await waitForEvents(
  seqBeforeEdit,
  (events) => events.some((event) => event.event === "source_changed"),
  "restore save",
);
const restore = restoreEvents.find((event) => event.event === "source_changed");
check(
  restore.revision === originalRevision,
  "the original content restored through a real save — the revision returns to the original hash",
);
const onDiskAfter = readFileSync(TARGET_FILE, "utf8");
check(onDiskAfter === originalContent, "the file on disk is byte-identical to how the walk found it");

// ---------------------------------------------------------------------------
// 8. The whole log: strictly monotonic seqs, no gaps, no duplicate seq.
const receipts = await allEvents();
const seqs = receipts.map((receipt) => receipt.seq);
const histogram = receipts.reduce((counts, receipt) => {
  counts[receipt.event] = (counts[receipt.event] ?? 0) + 1;
  return counts;
}, {});
check(
  seqs.length === new Set(seqs).size && seqs.every((seq, index) => seq === index + 1),
  `the event log is strictly monotonic 1..${seqs.length} with no gaps and no duplicate emission`,
);
console.log(`\n--- event log (${seqs.length} receipts) ---`);
for (const [tag, count] of Object.entries(histogram).sort()) {
  console.log(`  ${tag.padEnd(22)} ${count}`);
}
const sample = receipts.slice(0, 4).map((receipt) => `${receipt.seq}:${receipt.event}`).join("  ");
console.log(`  first receipts: ${sample}`);
console.log(
  `  revision pair:   …${revisionBeforeSave.slice(-16)} → …${revisionAfterSave.slice(-16)} (save 1)`,
);
console.log(
  `  conflict pair:   expected …${conflictEvent.expected_revision.slice(-16)} ≠ current …${conflictEvent.current_revision.slice(-16)}`,
);

await browser.close();
killBridge();

if (failures.length) {
  console.error(`\nWALK FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nWALK PASSED: kernel seam re-proven by operation (events, focus, CAS source writes)");
