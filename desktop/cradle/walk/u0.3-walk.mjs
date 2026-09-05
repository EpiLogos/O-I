/**
 * U0.3 walk — austere rest, verified in a headless browser against the
 * built bundle (vite preview). Asserts the resting shape and nothing else:
 * left agency column + centre canvas only; zero additional chrome.
 * Captures screenshot + cold-start (navigation start -> first paint).
 *
 * Usage: node walk/u0.3-walk.mjs [baseUrl]  (default http://localhost:4173)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? "http://localhost:4173";
const shotPath = join(here, "u0.3-rest.png");
mkdirSync(here, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

await page.goto(baseUrl, { waitUntil: "load" });

// Cold start: navigation start -> first contentful paint (in-page metric).
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
console.log(`cold-start (nav start -> first contentful paint): ${coldStartMs.toFixed(1)} ms`);
check(coldStartMs < 3000, "cold start < 3000 ms");

// Resting shape: body > #root > .rest with exactly [agency-field, canvas].
const shape = await page.evaluate(() => {
  const root = document.getElementById("root");
  const rest = root?.firstElementChild;
  const children = rest ? Array.from(rest.children).map((c) => c.className) : [];
  const all = Array.from(document.querySelectorAll("body *")).map((e) =>
    [
      e.tagName.toLowerCase(),
      e.className && typeof e.className === "string" ? e.className : "",
    ]
      .filter(Boolean)
      .join("."),
  );
  return {
    bodyChildCount: document.body.children.length,
    restClass: rest?.className ?? null,
    children,
    all,
    canvasTextarea: !!document.querySelector(".canvas textarea.canvas-surface"),
    agencyEmpty:
      document.querySelector(".agency-field")?.children.length === 0,
    focusedIs: document.activeElement?.className ?? null,
  };
});

check(shape.bodyChildCount === 1, "body has exactly one child (#root)");
check(shape.restClass === "rest", "root renders .rest");
check(
  shape.children.length === 2 &&
    shape.children[0] === "agency-field" &&
    shape.children[1] === "canvas",
  "rest = agency field left + canvas centre only",
);
check(shape.canvasTextarea, "canvas contains the writing surface (textarea)");
check(shape.agencyEmpty, "agency field is honest absence (renders no children)");
check(shape.focusedIs === "canvas-surface", "caret is in the canvas at rest");

// The visible element census: exactly
// #root, .rest, .agency-field, .canvas, textarea, .to-affordance — nothing else.
console.log("element census:", JSON.stringify(shape.all));
check(
  shape.all.length === 6 &&
    shape.all.join("|") ===
      "div|div.rest|aside.agency-field|main.canvas|textarea.canvas-surface|button.to-affordance",
  `zero elements beyond the rest shape (found ${shape.all.length})`,
);

// Keyboard reachability of the To: affordance: Tab from the canvas.
await page.keyboard.press("Tab");
const focusedAfterTab = await page.evaluate(() => document.activeElement?.className);
check(focusedAfterTab === "to-affordance", "To: affordance reachable by keyboard (Tab)");
await page.keyboard.press("Enter");
const addressing = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
check(addressing === "Address draft", "To: opens the address draft line");
// Escape returns the caret to the canvas.
await page.keyboard.press("Escape");
const backToCanvas = await page.evaluate(() => document.activeElement?.className);
check(backToCanvas === "canvas-surface", "Escape returns the caret to the canvas");

// Restored resting census after the address line closed.
const censusAfter = await page.evaluate(() => document.querySelectorAll("body *").length);
check(censusAfter === 6, `rest restored after addressing closes (found ${censusAfter})`);

await page.screenshot({ path: shotPath, fullPage: false });
console.log(`screenshot: ${shotPath}`);

await browser.close();

if (failures.length) {
  console.error(`\nWALK FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nWALK PASSED: austere rest verified");
