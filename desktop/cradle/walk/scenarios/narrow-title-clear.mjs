// narrow-title-clear: with the left region collapsed, its scope title (the
// topbar's "Central") and the first tab of the tab strip never share pixels at
// the narrow widths, where the window row is not shared with the tab row
// (420×800, 360×740), and at 1280×820 where the row is shared. At the 1280×820 desktop the default (left open) frame is
// recorded as a screenshot for the before/after comparison and asserted to
// carry no topbar title and a first tab clear of the corner toggle.
import {setup as sourceSetup} from "./editor.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {readTitleVsFirstTabAt} from "../lib/topbar-title-clear.mjs";

export async function setup(args) {
  const p = await sourceSetup(args);
  return {...p, cradleRoot: args.cradleRoot};
}

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  const chooser = page.getByRole("region", {name: "Central location"});
  if (await chooser.isVisible().catch(() => false)) await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");
  await nav.getByRole("button", {name: "Open Explore", exact: true}).click();
  await page.getByRole("region", {name: "Explore"}).waitFor({timeout: 15000});
  // Desktop, default state: the left region is open, so the topbar carries no scope title.
  await page.locator("[data-shell-scope]").waitFor({state: "detached"});
  const tab = await page.locator(".tab-strip .tab").first().boundingBox();
  check(Boolean(tab) && tab.y < 20, "At 1280×820 the first tab still shares the window row (desktop layout unchanged)", {tab});
  await shot("desktop-1280");
  const scope = page.locator("[data-shell-scope]");
  if (await scope.count() === 0) await page.keyboard.press("Meta+b");
  await scope.waitFor();
  // Desktop, left collapsed: the title shares the window row with the first tab
  // row, so the strip's own padding must clear the content-dependent title.
  const [wide] = await readTitleVsFirstTabAt(page, [[1280, 820]]);
  check(Boolean(wide.title && wide.tab) && !wide.overlap, "At 1280×820 with the left region collapsed the scope title and the first tab share no pixels", wide);
  await shot("collapsed-1280");
  for (const [width, height] of [[420, 800], [360, 740]]) {
    const [reading] = await readTitleVsFirstTabAt(page, [[width, height]]);
    check(Boolean(reading.title && reading.tab) && !reading.overlap, `At ${width}×${height} the scope title and the first tab share no pixels`, reading);
    const toggle = await page.getByRole("button", {name: "Toggle left region"}).boundingBox();
    check(Boolean(toggle && reading.tab) && toggle.y + toggle.height <= reading.tab.y + 0.5, `At ${width}×${height} the first tab sits below the corner toggle`, {toggle, tab: reading.tab});
    await shot(`title-clear-${width}`);
  }
}
