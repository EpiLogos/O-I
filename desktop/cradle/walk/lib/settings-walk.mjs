/**
 * Shared steps for the 12-SETTINGS walks: enter Settings through the real
 * shell, move between sections through the left body, wait for the owners'
 * reads to land, and the two-sided geometry / no-raw-JSON checks.
 */
import {bindDefaultCentral} from "../editor-doc.mjs";

export async function enterSettings(page, {root, baseUrl, query = ""}) {
  await page.goto(`${baseUrl}/${query}`);
  if (root) {
    const chooser = page.getByRole("region", {name: "Central location"});
    if (await chooser.isVisible({timeout: 8000}).catch(() => false)) await bindDefaultCentral(page, root);
  }
  await page.waitForSelector(".desktop-shell", {timeout: 60000});
  // The gear in the left foot (the terminal Settings entry).
  await page.locator(".world-system-settings").first().click();
  await page.locator("[data-settings-page]").waitFor({timeout: 60000});
  await page.locator("[data-settings-navigator]").waitFor({timeout: 60000});
}

export async function openSection(page, id) {
  await page.locator(`[data-settings-section="${id}"]`).click();
  await page.waitForFunction((place) => document.querySelector("[data-settings-page]")?.getAttribute("data-settings-place") === place, `section:${id}`);
}

export async function openProduct(page, id) {
  await page.locator(`[data-settings-product="${id}"]`).click();
  await page.waitForFunction((place) => document.querySelector("[data-settings-page]")?.getAttribute("data-settings-place") === place, `product:${id}`);
}

/** Wait until no section shows its Reading state. */
export async function settled(page, timeout = 240000) {
  await page.waitForFunction(() => !document.querySelector("[data-settings-reading]"), null, {timeout});
}

/** The visible text of the page, excluding collapsed disclosures. */
export async function visibleText(page, selector = "[data-settings-page]") {
  return page.evaluate((sel) => document.querySelector(sel)?.innerText ?? "", selector);
}

/** Raw JSON anywhere visible outside an explicit Show raw disclosure. */
export async function rawJsonOutsideShowRaw(page) {
  return page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.querySelector("[data-settings-page]") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (!/[{[]\s*"[^"]+"\s*:/.test(text)) continue;
      const host = node.parentElement;
      if (!host || host.closest("details:not([open])")) continue;
      if (host.closest("details[data-show-raw], details.settings-raw")) continue;
      const style = getComputedStyle(host);
      if (style.display === "none" || style.visibility === "hidden") continue;
      found.push(text.slice(0, 80));
    }
    return found;
  });
}

/** A controls survey: any disabled control in the settings page body. */
export async function disabledControls(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} button:disabled, ${sel} select:disabled, ${sel} input:disabled`)].map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim()), selector);
}

/** Screenshots at the three widths in both appearances. */
export async function shotMatrix({page, shot}, name) {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme: scheme});
    for (const width of [1440, 1000, 760]) {
      await page.setViewportSize({width, height: 900});
      await page.waitForTimeout(250);
      await shot(`${name}-${scheme}-${width}`);
    }
  }
  await page.emulateMedia({colorScheme: "light"});
  await page.setViewportSize({width: 1280, height: 820});
}
