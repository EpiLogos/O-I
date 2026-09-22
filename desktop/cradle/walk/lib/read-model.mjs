/** L5 disclosure-cleanliness (docs/cradle/06-SYSTEM-SETTINGS.md §2 L5, §7):
 * "Primary view contains no raw JSON; raw records sit behind disclosure."
 *
 * Shared read-model helpers so every settings-facing scenario asserts the
 * same law the same way (the dossier's spec→fixture derivation map: each
 * spec row becomes a behavioral check). Lives in walk/lib/, not
 * run-support.mjs, so scenarios can import it without touching the runner
 * another lane owns.
 *
 * A violation is, mechanically, rendered text a person reading the primary
 * surface cannot read as prose:
 *   - a rendered (non display:none / visibility:hidden, laid out with a
 *     non-empty box) `<pre>` element outside any disclosure container, or
 *   - a rendered text node whose content is a raw JSON literal — a `{`/`[`
 *     followed by `"key":` shape — or that carries wire-shape field
 *     vocabulary (`action_ref`, `disclosed_at_unix_ms`,
 *     `oi.product-settings-disclosure`, …).
 *
 * A disclosure container is an ancestor `<details>` (the app's established
 * raw-record pattern: `details.product-raw`, `details.settings-dev`,
 * `details.native-setting` — `<details>`-grade per spec L5) or an ancestor
 * carrying `aria-expanded` (the expanded-state disclosure pattern). Content
 * inside one is behind disclosure by construction and never a primary-view
 * violation; collapsed-`<details>` content is not rendered at all, so it
 * never trips the rendered-text rules above.
 */

/** Wire-shape vocabulary that must never reach the primary view. */
const WIRE_TOKENS = [
  "action_ref",
  "disclosed_at_unix_ms",
  "oi.product-settings-disclosure",
];

/** A JSON object/array literal opener followed by a `"key":` pair — the
 * smallest honest shape test for "someone serialized a record here". */
const JSON_SHAPE = /[{[]\s*"[^"]+"\s*:/;

/** The in-page scan. Runs inside the browser with the constants passed as
 * the serialisable argument: Page.evaluate calls `scan(config)`, while
 * Locator.evaluate calls `scan(element, config)` — one function serves the
 * two calling conventions. Returns plain serialisable violations. */
function scanInPage(rootOrConfig, maybeConfig) {
  const config = maybeConfig ?? rootOrConfig;
  const scope = maybeConfig ? rootOrConfig : document.body ?? document.documentElement;
  const wireTokens = config.wireTokens;
  const jsonShape = new RegExp(config.jsonShapeSource);
  const where = (el) => {
    const path = [];
    for (let n = el; n && n.nodeType === 1 && path.length < 4; n = n.parentElement) {
      const cls = (n.getAttribute("class") ?? "").trim().split(/\s+/).slice(0, 2).join(".");
      path.push(cls ? `${n.tagName.toLowerCase()}.${cls}` : n.tagName.toLowerCase());
    }
    return path.reverse().join(" < ");
  };
  const disclosed = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (n instanceof HTMLDetailsElement) return true;
      if (typeof n.hasAttribute === "function" && n.hasAttribute("aria-expanded")) return true;
    }
    return false;
  };
  const rendered = (el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const clipped = (text) => text.replace(/\s+/g, " ").trim().slice(0, 140);
  const violations = [];
  for (const pre of scope.querySelectorAll("pre")) {
    if (!rendered(pre) || disclosed(pre)) continue;
    violations.push({ kind: "pre", where: where(pre), text: clipped(pre.textContent ?? "") });
  }
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    const parent = node.parentElement;
    // A `pre`'s own text is already covered by the pre rule above — don't
    // count the same dump twice.
    if (!parent || parent.tagName === "PRE" || !rendered(parent) || disclosed(parent)) continue;
    const token = wireTokens.find((candidate) => text.includes(candidate));
    if (token) {
      violations.push({ kind: "wire-token", token, where: where(parent), text: clipped(text) });
    } else if (jsonShape.test(text)) {
      violations.push({ kind: "json-text", where: where(parent), text: clipped(text) });
    }
  }
  return violations;
}

/** Scan a Playwright Page (whole document) or Locator (that element's
 * subtree). Returns the violations array — empty when the view is clean. */
export function scanRawJson(root) {
  return root.evaluate(scanInPage, { wireTokens: WIRE_TOKENS, jsonShapeSource: JSON_SHAPE.source });
}

/** Assert L5 against one view through the walk harness's `check`. Returns
 * the violations (empty = pass); the receipt carries them as data so a
 * failure names the exact element and text that violated the law. */
export async function assertNoRawJson(harness, root, label) {
  const violations = await scanRawJson(root);
  harness.check(violations.length === 0, label, { violations });
  return violations;
}
