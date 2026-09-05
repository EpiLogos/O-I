/**
 * Scenario: rest (ported from the u0.3 walk) — austere rest, verified in a
 * headless browser against the walk bundle served by vite preview. Asserts
 * the resting shape and nothing else: left agency column + centre canvas
 * only; zero additional chrome. Cold-start FCP is captured through the
 * `__cradle.walk` channel (capture.timing) — a metric, not prose.
 *
 * This scenario runs WITHOUT the walk bridge on purpose: with no kernel
 * transport the app must still open to honest rest (law 7 — the channel
 * itself reports the transport as unavailable, recorded as data).
 */

export default async function run(ctx) {
  const { page, baseUrl, check, metric, shot, channel } = ctx;

  await page.goto(baseUrl, { waitUntil: "load" });

  // Cold start through the channel: navigation start -> first contentful
  // paint, measured in-page, returned as data.
  const timing = await channel("capture.timing");
  const fcp = timing.data.fcp_ms;
  metric("cold_start_fcp_ms", fcp);
  check(
    fcp !== null && fcp < 3000,
    `cold start < 3000 ms (FCP ${fcp === null ? "not observed" : `${fcp.toFixed(1)} ms`})`,
  );

  // The channel mounts even with no kernel behind it — and reports the
  // transport honestly as unavailable. Absence is an observation (law 7).
  const info = await channel("info");
  check(
    info.data.transport.kind === "unavailable",
    "with no bridge injected the kernel transport is honestly unavailable",
    { transport: info.data.transport },
  );

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
      agencyEmpty: document.querySelector(".agency-field")?.children.length === 0,
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
  // #root, .rest, .agency-field, .canvas, textarea, .to-affordance — nothing
  // else (the walk channel adds no DOM of its own).
  check(
    shape.all.length === 6 &&
      shape.all.join("|") ===
        "div|div.rest|aside.agency-field|main.canvas|textarea.canvas-surface|button.to-affordance",
    `zero elements beyond the rest shape (found ${shape.all.length} nodes)`,
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
  check(censusAfter === 6, `rest restored after addressing closes (found ${censusAfter} nodes)`);

  await shot("rest");
}
