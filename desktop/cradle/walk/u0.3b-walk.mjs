/**
 * U0.3b walk — surface management, verified headless against the built
 * bundle (vite preview). Mirrors u0.3-walk.mjs. Everything is driven through
 * the real UI: keyboard chords and pointer gestures, never test doubles.
 *
 * Covers the unit contract (map §5 U0.3b):
 *   - open 4 surfaces → 4 tabs; split, tile, move, pin, close, reopen —
 *     each via keyboard AND pointer;
 *   - right-click a tab → exactly the frame Actions disclosed for it;
 *     invoking one performs the real frame operation;
 *   - a binding with no disclosed Actions opens NO menu (D15 honesty);
 *   - reload → layout + open tabs + depths restore exactly (localStorage);
 *   - close all surfaces → the DOM census returns to the U0.3 rest shape
 *     (6 nodes);
 *   - agency depth states collapsed/strip/panel/full (D17), full a true
 *     overlay that masks the canvas dimensionally without reflowing it.
 *
 * Usage: node walk/u0.3b-walk.mjs [baseUrl]  (default http://localhost:4173)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? "http://localhost:4173";
const tiledShot = join(here, "u0.3b-tiled.png");
const menuShot = join(here, "u0.3b-menu.png");
mkdirSync(here, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};
const now = () => Date.now();

/** Pane-tree extractor: shape, tab titles, active/pinned/focused — the
 * layout as the person sees it (no internal ids leaked into assertions). */
const shape = () =>
  page.evaluate(() => {
    const host = document.querySelector(".surface-host");
    const read = (el) => {
      if (!el) return null;
      if (el.dataset.pane === "group") {
        return {
          tabs: [...el.querySelectorAll(":scope > .tab-strip > .tab")].map((t) => ({
            t: t.dataset.title,
            a: t.dataset.active === "true",
            p: t.dataset.pinned === "true",
          })),
          f: el.dataset.focused === "true",
        };
      }
      return { s: el.dataset.paneDir, c: [...el.children].map(read) };
    };
    return {
      tree: host ? read(host.firstElementChild) : null,
      depth: document.querySelector(".agency-column")?.dataset.depth ?? null,
    };
  });

const menuItems = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".ctx-menu .ctx-item")].map((b) => ({
      ref: b.dataset.actionRef,
      title: b.textContent.trim(),
      enabled: !b.disabled,
    })),
  );

const census = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("body *")).map((e) =>
      [e.tagName.toLowerCase(), typeof e.className === "string" ? e.className : ""]
        .filter(Boolean)
        .join("."),
    ),
  );

const T = (title) => ({ t: title, a: false, p: false });

// ---------------------------------------------------------------------------
// 0. Austere rest first — U0.3 must not be regressed.
await page.goto(baseUrl, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });

const coldStartMs = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const paint = performance
        .getEntriesByType("paint")
        .find((e) => e.name === "first-contentful-paint");
      if (paint) return resolve(paint.startTime);
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") {
            obs.disconnect();
            resolve(e.startTime);
          }
        }
      });
      obs.observe({ type: "paint", buffered: true });
    }),
);
console.log(`cold-start (nav start -> FCP): ${coldStartMs.toFixed(1)} ms`);
check(coldStartMs < 3000, "cold start < 3000 ms");

const restCensus = await census();
check(
  restCensus.length === 6 &&
    restCensus.join("|") ===
      "div|div.rest|aside.agency-field|main.canvas|textarea.canvas-surface|button.to-affordance",
  `rest opens as the exact U0.3 shape (census ${restCensus.length} nodes)`,
);

// ---------------------------------------------------------------------------
// 1. Keyboard: open 4 surfaces -> 4 tabs (one per Surface binding, D16).
let t0 = now();
for (let i = 0; i < 4; i++) await page.keyboard.press("Meta+t");
await page.waitForSelector(".tab-strip");
const tOpen4 = now() - t0;
let s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      tabs: [
        T("Test surface 1"),
        T("Test surface 2"),
        T("Test surface 3"),
        { ...T("Test surface 4"), a: true },
      ],
      f: true,
    }),
  "keyboard ⌘T x4 -> one group, 4 tabs, focus follows the last binding",
);
console.log(`  open-4-tabs (keyboard): ${tOpen4} ms`);

// Pointer open parity: the strip "+" opens; ⌘W (keyboard) closes it again.
await page.click(".strip-open");
s = await shape();
check(
  s.tree.tabs.length === 5 && s.tree.tabs[4].t === "Test surface 5",
  "pointer strip + opens a 5th surface",
);
await page.keyboard.press("Meta+w");
s = await shape();
check(s.tree.tabs.length === 4, "keyboard ⌘W closes it again");

// ---------------------------------------------------------------------------
// 2. Keyboard split / focus between splits / move surface.
await page.keyboard.press("Meta+d"); // split right (active surface 4)
await page.keyboard.press("Alt+ArrowLeft"); // focus the left split
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          tabs: [
            T("Test surface 1"),
            T("Test surface 2"),
            { ...T("Test surface 3"), a: true },
          ],
          f: true,
        },
        { tabs: [{ ...T("Test surface 4"), a: true }], f: false },
      ],
    }),
  "keyboard ⌘D splits right; ⌥← moves focus to the left split",
);

await page.keyboard.press("Meta+Alt+ArrowRight"); // move surface 3 into the right split
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          tabs: [T("Test surface 1"), { ...T("Test surface 2"), a: true }],
          f: false,
        },
        {
          tabs: [T("Test surface 4"), { ...T("Test surface 3"), a: true }],
          f: true,
        },
      ],
    }),
  "keyboard ⌘⌥→ moves the active surface into the neighbouring split",
);

await page.keyboard.press("Meta+Shift+d"); // split down
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        { tabs: [T("Test surface 1"), { ...T("Test surface 2"), a: true }], f: false },
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 4"), a: true }], f: false },
            { tabs: [{ ...T("Test surface 3"), a: true }], f: true },
          ],
        },
      ],
    }),
  "keyboard ⌘⇧D splits down (nested vertical under the right split)",
);

// ---------------------------------------------------------------------------
// 3. Keyboard tile: 4 surfaces -> balanced 2x2.
t0 = now();
await page.keyboard.press("Meta+Alt+t");
const tTile = now() - t0;
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 1"), a: true }], f: true },
            { tabs: [{ ...T("Test surface 2"), a: true }], f: false },
          ],
        },
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 4"), a: true }], f: false },
            { tabs: [{ ...T("Test surface 3"), a: true }], f: false },
          ],
        },
      ],
    }),
  "keyboard ⌘⌥T tiles 4 surfaces into a balanced 2x2",
);
console.log(`  tile (keyboard): ${tTile} ms`);
await page.screenshot({ path: tiledShot });
console.log(`screenshot: ${tiledShot}`);

// ---------------------------------------------------------------------------
// 4. Pointer + menu: focus follows a clicked tab; right-click discloses
//    exactly the frame actions for that binding; menu keyboard invoke
//    performs the real operation.
await page.click('[data-title="Test surface 4"]');
const focused4 = await page.evaluate(() => {
  const el = document.querySelector('[data-title="Test surface 4"]');
  return el.closest(".pane.group").dataset.focused === "true";
});
check(focused4, "pointer click on a tab focuses its split (focus follows binding)");

await page.click('[data-title="Test surface 4"]', { button: "right" });
let items = await menuItems();
check(
  JSON.stringify(items) ===
    JSON.stringify([
      { ref: "surface.close", title: "Close", enabled: true },
      { ref: "surface.split-right", title: "Split right", enabled: true },
      { ref: "surface.split-down", title: "Split down", enabled: true },
      { ref: "surface.pin", title: "Pin", enabled: true },
    ]),
  "right-click a tab -> exactly the disclosed frame actions (D15)",
);
await page.screenshot({ path: menuShot });
console.log(`screenshot: ${menuShot}`);

await page.keyboard.press("Enter"); // first item (Close) is focused in the menu
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 1"), a: true }], f: true },
            { tabs: [{ ...T("Test surface 2"), a: true }], f: false },
          ],
        },
        { tabs: [{ ...T("Test surface 3"), a: true }], f: false },
      ],
    }),
  "menu keyboard invoke (⏎ on Close) performs the real frame operation",
);

await page.keyboard.press("Meta+Shift+t"); // reopen last closed (keyboard)
s = await shape();
check(
  JSON.stringify(s.tree.c[0].c[0].tabs) ===
    JSON.stringify([
      { ...T("Test surface 1"), a: false },
      { ...T("Test surface 4"), a: true },
    ]),
  "keyboard ⌘⇧T reopens the closed surface into the focused group",
);

// Pointer menu invoke: Split right on Test surface 4.
await page.click('[data-title="Test surface 4"]', { button: "right" });
await page.click('.ctx-item[data-action-ref="surface.split-right"]');
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 1"), a: true }], f: false },
            { tabs: [{ ...T("Test surface 2"), a: true }], f: false },
          ],
        },
        { tabs: [{ ...T("Test surface 4"), a: true }], f: true },
        { tabs: [{ ...T("Test surface 3"), a: true }], f: false },
      ],
    }),
  "menu pointer invoke (Split right) performs the real frame operation",
);

// ---------------------------------------------------------------------------
// 5. Drag between splits (pointer move parity).
t0 = now();
await page.dragAndDrop('[data-title="Test surface 2"]', '[data-title="Test surface 3"]');
const tDrag = now() - t0;
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        { tabs: [{ ...T("Test surface 1"), a: true }], f: false },
        { tabs: [{ ...T("Test surface 4"), a: true }], f: false },
        {
          tabs: [
            { ...T("Test surface 2"), a: true },
            T("Test surface 3"),
          ],
          f: true,
        },
      ],
    }),
  "pointer drag moves a surface between splits (dropped before its target)",
);
console.log(`  drag-between-splits: ${tDrag} ms`);

// ---------------------------------------------------------------------------
// 6. Pin: keyboard pin, honest disabled close, pointer unpin, pointer close.
await page.keyboard.press("Alt+p"); // pin active surface (Test surface 2)
s = await shape();
check(
  s.tree.c[2].tabs[0].t === "Test surface 2" && s.tree.c[2].tabs[0].p === true,
  "keyboard ⌥P pins the active surface (marker + pinned first)",
);

await page.click('[data-title="Test surface 2"]', { button: "right" });
items = await menuItems();
check(
  JSON.stringify(items) ===
    JSON.stringify([
      {
        ref: "surface.close",
        title: "Close (pinned — unpin first)",
        enabled: false,
      },
      { ref: "surface.split-right", title: "Split right", enabled: true },
      { ref: "surface.split-down", title: "Split down", enabled: true },
      { ref: "surface.unpin", title: "Unpin", enabled: true },
    ]),
  "pinned binding discloses Close as disabled — an honest no, nothing hidden",
);
await page.keyboard.press("Escape"); // close the menu (it owns the keyboard)

await page.keyboard.press("Meta+w"); // keyboard close on pinned -> refused
s = await shape();
check(
  s.tree.c[2].tabs.length === 2 && s.tree.c[2].tabs[0].p === true,
  "⌘W on a pinned surface refuses (frame holds the pin)",
);

await page.click('[data-title="Test surface 2"]', { button: "right" });
await page.click('.ctx-item[data-action-ref="surface.unpin"]'); // pointer unpin
s = await shape();
check(s.tree.c[2].tabs[0].p === false, "menu pointer invoke unpins");

// Pointer close (tab x), then keyboard reopen.
await page.click('[data-title="Test surface 3"] .tab-close');
s = await shape();
check(
  s.tree.c[2].tabs.length === 1 && s.tree.c[2].tabs[0].t === "Test surface 2",
  "pointer tab x closes the surface",
);
await page.keyboard.press("Meta+Shift+t");
s = await shape();
check(
  s.tree.c[2].tabs.length === 2 && s.tree.c[2].tabs[1].t === "Test surface 3",
  "keyboard ⌘⇧T reopens it into the focused group",
);

// ---------------------------------------------------------------------------
// 7. Silence law: a binding with no disclosed Actions opens no menu.
await page.keyboard.press("Meta+Alt+n"); // silent test binding
s = await shape();
const silent = s.tree.c[2].tabs.find((t) => t.t.includes("silent"));
check(!!silent && silent.a === true, "⌘⌥N opens the silent test binding (clearly named)");
await page.click('.tab-strip >> text=/silent/', { button: "right" });
const menuCount = await page.evaluate(() => document.querySelectorAll(".ctx-menu").length);
check(menuCount === 0, "no disclosed Actions -> no menu, nothing fabricated (D15)");
await page.keyboard.press("Meta+w"); // close the silent binding
s = await shape();
check(!JSON.stringify(s).includes("silent"), "silent binding closes via ⌘W");

// ---------------------------------------------------------------------------
// 8. Frame menu on the strip: tile / restore / reopen disclosures.
const stripBox = await page.locator(".pane.group.focused .tab-strip").boundingBox();
await page.mouse.click(stripBox.x + stripBox.width - 60, stripBox.y + 8, { button: "right" });
items = await menuItems();
check(
  JSON.stringify(items) ===
    JSON.stringify([
      { ref: "surface.tile", title: "Tile all surfaces", enabled: true },
      { ref: "surface.restore-layout", title: "Restore layout", enabled: true },
      { ref: "surface.reopen", title: "Reopen last closed", enabled: true },
    ]),
  "strip right-click -> exactly the frame-level disclosures, all enabled here",
);
await page.click('.ctx-item[data-action-ref="surface.tile"]'); // pointer tile
s = await shape();
check(
  JSON.stringify(s.tree) ===
    JSON.stringify({
      s: "h",
      c: [
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 1"), a: true }], f: true },
            { tabs: [{ ...T("Test surface 4"), a: true }], f: false },
          ],
        },
        {
          s: "v",
          c: [
            { tabs: [{ ...T("Test surface 2"), a: true }], f: false },
            { tabs: [{ ...T("Test surface 3"), a: true }], f: false },
          ],
        },
      ],
    }),
  "menu pointer invoke tiles all surfaces (pointer tile parity)",
);

// ---------------------------------------------------------------------------
// 9. Agency depth states (D17): strip -> panel -> full (true overlay,
//    canvas masked dimensionally) -> Escape -> panel -> strip -> collapsed.
// Widths are read after the motion token settles (240 ms).
await page.keyboard.press("Alt+]");
await page.waitForTimeout(320);
const panel = await page.evaluate(() => {
  const col = document.querySelector(".agency-column");
  return {
    depth: col.dataset.depth,
    w: col.getBoundingClientRect().width,
    canvasW: document.querySelector(".surface-host").getBoundingClientRect().width,
  };
});
check(
  panel.depth === "panel" && panel.w > 200,
  "⌥] raises the agency column to panel depth",
);

await page.keyboard.press("Alt+]"); // full
await page.waitForTimeout(320);
const full = await page.evaluate(() => ({
  depth: document.querySelector(".agency-column").dataset.depth,
  overlayW:
    document.querySelector(".agency-overlay")?.getBoundingClientRect().width ?? 0,
  canvasW: document.querySelector(".surface-host").getBoundingClientRect().width,
  note: !!document.querySelector(".agency-note"),
}));
check(full.depth === "full", "⌥] again -> full depth (true overlay)");
check(
  Math.abs(full.canvasW - panel.canvasW) < 1,
  "full masks the canvas dimensionally — its layout width is untouched",
);
check(
  full.overlayW >= 1279 && full.note,
  "the full layer covers the frame and states its honest absence",
);

await page.keyboard.press("Escape");
const afterEsc = await page.evaluate(() => document.querySelector(".agency-column").dataset.depth);
check(afterEsc === "panel", "Escape steps the full overlay back to panel");
await page.keyboard.press("Alt+["); // -> strip
await page.waitForTimeout(320);
await page.keyboard.press("Alt+["); // -> collapsed
await page.waitForTimeout(320);
const collapsed = await page.evaluate(() => {
  const col = document.querySelector(".agency-column");
  return { depth: col.dataset.depth, w: col.getBoundingClientRect().width };
});
check(
  collapsed.depth === "collapsed" && collapsed.w === 0,
  "⌥[ lowers through strip to collapsed (width 0)",
);
await page.keyboard.press("Alt+]"); // back to strip...
await page.keyboard.press("Alt+]"); // ...and leave at panel for the persistence check
await page.waitForTimeout(320);
const depthForPersist = await page.evaluate(
  () => document.querySelector(".agency-column").dataset.depth,
);
check(depthForPersist === "panel", "depth settles at panel for the persistence check");

// ---------------------------------------------------------------------------
// 10. Persistence: reload -> layout + tabs + depths restore exactly.
const before = await shape();
t0 = now();
await page.reload({ waitUntil: "load" });
await page.waitForSelector(".tab-strip");
const tRestore = now() - t0;
const after = await shape();
check(
  JSON.stringify(before) === JSON.stringify(after),
  "reload restores the layout, open tabs, active bindings, and depth exactly",
);
console.log(`  reload-restore: ${tRestore} ms`);

// ---------------------------------------------------------------------------
// 11. Restore layout: mangle, then ⌘⌥R returns to the loaded layout.
await page.keyboard.press("Meta+d");
const mangled = await shape();
check(
  JSON.stringify(mangled) !== JSON.stringify(after),
  "⌘D mangles the restored layout (control)",
);
await page.keyboard.press("Meta+Alt+r");
const restored = await shape();
check(
  JSON.stringify(restored) === JSON.stringify(after),
  "keyboard ⌘⌥R restores the presentation layout to the load snapshot",
);

const stripBox2 = await page.locator(".pane.group.focused .tab-strip").boundingBox();
await page.mouse.click(stripBox2.x + stripBox2.width - 60, stripBox2.y + 8, { button: "right" });
items = await menuItems();
check(
  items.find((i) => i.ref === "surface.restore-layout")?.enabled === false,
  "Restore layout discloses disabled when already at the restore point",
);
await page.keyboard.press("Escape");

// ---------------------------------------------------------------------------
// 12. Close all surfaces -> austere rest, exactly 6 nodes.
t0 = now();
for (let i = 0; i < 4; i++) await page.keyboard.press("Meta+w");
const tCloseAll = now() - t0;
await page.waitForSelector(".rest");
const finalCensus = await census();
check(
  finalCensus.length === 6 &&
    finalCensus.join("|") ===
      "div|div.rest|aside.agency-field|main.canvas|textarea.canvas-surface|button.to-affordance",
  `close all -> exact U0.3 rest shape returns (census ${finalCensus.length} nodes)`,
);
console.log(`  close-all-to-rest: ${tCloseAll} ms`);
const focusAtRest = await page.evaluate(() => document.activeElement?.className);
check(focusAtRest === "canvas-surface", "the caret is back in the canvas at rest");
const agencyEmpty = await page.evaluate(
  () => document.querySelector(".agency-field")?.children.length === 0,
);
check(agencyEmpty, "the agency field is honest absence again at rest");

await browser.close();

console.log("\n--- timings ---");
console.log(`cold-start FCP        ${coldStartMs.toFixed(1)} ms (< 3000)`);
console.log(`open 4 tabs (kbd)     ${tOpen4} ms`);
console.log(`tile (kbd)            ${tTile} ms`);
console.log(`drag between splits   ${tDrag} ms`);
console.log(`reload restore        ${tRestore} ms`);
console.log(`close-all -> rest     ${tCloseAll} ms`);

if (failures.length) {
  console.error(`\nWALK FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nWALK PASSED: surface management verified (keyboard + pointer parity)");
