// The collapsed-left scope title ([data-shell-scope], in the topbar) and the
// first tab of the focused tab strip must never share pixels. Reads both
// bounding boxes and reports any intersection so a walk can assert it at
// each narrow viewport.
export async function readTitleVsFirstTab(page) {
  const title = await page.locator("[data-shell-scope]").first().boundingBox().catch(() => null);
  const tab = await page.locator('.tab-strip .tab').first().boundingBox().catch(() => null);
  const overlap = Boolean(title && tab
    && title.x < tab.x + tab.width && tab.x < title.x + title.width
    && title.y < tab.y + tab.height && tab.y < title.y + title.height);
  return {title, tab, overlap};
}

// Sets each viewport, waits for layout, and returns one reading per size.
export async function readTitleVsFirstTabAt(page, sizes) {
  const readings = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({width, height});
    await page.waitForTimeout(350);
    readings.push({viewport: `${width}×${height}`, ...await readTitleVsFirstTab(page)});
  }
  return readings;
}
