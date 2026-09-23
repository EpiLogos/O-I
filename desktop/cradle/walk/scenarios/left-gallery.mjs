/**
 * The left frame's surfaces in light and dark at 1440, 1000 and 760 wide
 * (lane 1 acceptance screenshots), on the real kernel and a disposable
 * ground. Each capture is checked, not only taken: the head and the foot are
 * present and pinned at the same boxes in both appearances, the body never
 * scrolls sideways, and the appearance actually changed the ground.
 */
import {setup as groundSetup, bindDefaultCentral} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const grounds = {};
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme: theme});
    await page.reload(); await channel("info");
    await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
    const alpha = left.locator('li[data-navigation-path="Work/Alpha"]');
    if ((await page.locator('[data-project-path="Work/Alpha"]').getAttribute("aria-expanded")) !== "true") await page.locator('[data-project-path="Work/Alpha"]').click();
    await page.mouse.move(700, 880);
    try { await alpha.locator(".left-conversation").first().waitFor({timeout: 45000}); }
    catch { const after = await page.evaluate(() => { const book = JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "{}"); return JSON.stringify(book.workspaces?.map(w => [w.projectNavigation, w.centralFiles, w.project])); }); const pressed = await alpha.locator(".project-modes button").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label") + "=" + node.getAttribute("aria-pressed"))); throw new Error(`NAV after ${after} pressed ${pressed} Alpha rows absent: expanded=${await page.locator('[data-project-path="Work/Alpha"]').getAttribute("aria-expanded")} text=${JSON.stringify((await alpha.innerText()).slice(0, 300))}`); }
    grounds[theme] = await left.evaluate(node => getComputedStyle(document.body).backgroundColor + "|" + getComputedStyle(node.querySelector(".left-scope-name")).color);
    for (const width of [1440, 1000, 760]) {
      await page.setViewportSize({width, height: 900});
      await page.waitForTimeout(350);
      const frame = await left.evaluate(node => {
        const body = node.querySelector("[data-left-body]");
        const head = node.querySelector("[data-left-head]")?.getBoundingClientRect();
        const foot = node.querySelector("[data-left-foot]")?.getBoundingClientRect();
        return {sideways: body.scrollWidth - body.clientWidth, head: head ? Math.round(head.height) : 0, footBottom: foot ? Math.round(foot.bottom) : 0, height: Math.round(node.getBoundingClientRect().bottom)};
      });
      check(frame.head === 40 && frame.sideways <= 0 && Math.abs(frame.footBottom - frame.height) <= 1, `${theme} ${width}: head present (40px), foot pinned to the region's bottom, no sideways scroll in the body`, frame);
      await shot(`base-${theme}-${width}`);
      if (width === 1440) {
        await left.locator("[data-left-head] .left-scope-trigger").click();
        const menu = page.getByRole("group", {name: "Scope and workspace"});
        await menu.waitFor();
        const clipped = await menu.evaluate(node => { const box = node.getBoundingClientRect(); const hit = document.elementFromPoint(box.right - 6, box.top + 30); return {right: Math.round(box.right), inside: !!hit && node.contains(hit)}; });
        check(clipped.inside, `${theme}: the scope menu is whole — its right edge is not clipped by the narrow sidebar`, clipped);
        await shot(`scope-menu-${theme}-${width}`);
        await page.keyboard.press("Escape");
        await left.locator("[data-left-foot]").getByRole("button", {name: /^Inbox/}).click();
        await left.locator(".left-inbox .receiving-row").first().waitFor({timeout: 20000});
        await shot(`inbox-${theme}-${width}`);
        await left.locator("[data-left-foot]").getByRole("button", {name: /^Inbox/}).click();
      }
      await left.locator('.world-mode-strip [data-mode="factory"]').click();
      await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
      await left.locator('[data-section="intent"]').waitFor({timeout: 30000});
      await page.waitForFunction(() => ![...document.querySelectorAll('[data-region="left"] .left-reading')].some(node => node.getBoundingClientRect().height > 0), null, {timeout: 60000}).catch(() => {});
      await page.waitForTimeout(300);
      await shot(`factory-${theme}-${width}`);
      await left.locator('.world-mode-strip [data-mode="base"]').click();
      await page.locator('.desktop-shell[data-mode="base"]').waitFor();
    }
  }
  check(grounds.light !== grounds.dark, "The appearance changes the ground and the ink (light vs dark)", grounds);
}
