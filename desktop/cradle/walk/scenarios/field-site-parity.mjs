#!/usr/bin/env node
// Site reference vs the native Base field at the pinned passage (THE-RETURN-OF-ZERO at M16), at ~1440 and ~760 px:
// writes walk/artifacts/field-site-<w>.png, field-base-<w>.png and the side-by-side field-compare-<w>.png.
//   FIELD_SITE_ROOT=<built site root> [FIELD_APP_URL=http://localhost:1451/] node walk/scenarios/field-site-parity.mjs
import {bootField, shotPath} from "../lib/field-walk.mjs";
import {readFileSync} from "node:fs";

const f = await bootField({epi: true});
const {page} = f;
const out = [];
try {
  // the site, in its own page of the same browser
  const site = await f.context.newPage();
  const search = page.getByRole("searchbox", {name: "Search"});
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  await search.fill("The Return of Zero"); await page.waitForTimeout(300);
  await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".center-foot .pos b")?.textContent === "M16", null, {timeout: 30000});
  for (const w of [1440, 760]) {
    const h = 900;
    await site.setViewportSize({width: w, height: h});
    await site.goto(`${f.siteBase}/essay/THE-RETURN-OF-ZERO?m=16`, {waitUntil: "load"});
    await site.waitForSelector("body[data-ready='1']", {timeout: 60000}).catch(() => {});
    await site.waitForTimeout(2500);
    await site.screenshot({path: shotPath(`field-site-${w}.png`)});
    await page.setViewportSize({width: w, height: h});
    await page.waitForTimeout(1800);
    await page.screenshot({path: shotPath(`field-base-${w}.png`)});
    // side by side
    const cmp = await f.context.newPage();
    await cmp.setViewportSize({width: w * 2 + 30, height: h + 60});
    const b64 = n => readFileSync(shotPath(n)).toString("base64");
    await cmp.setContent(`<body style="margin:0;background:#888;font:12px system-ui;color:#fff"><div style="display:flex;gap:30px"><div><div style="padding:6px">SITE (essay reader, built edition)</div><img src="data:image/png;base64,${b64(`field-site-${w}.png`)}" width="${w}"></div><div><div style="padding:6px">BASE (native field, Epi world on)</div><img src="data:image/png;base64,${b64(`field-base-${w}.png`)}" width="${w}"></div></div></body>`);
    await cmp.screenshot({path: shotPath(`field-compare-${w}.png`)});
    await cmp.close();
    out.push(w);
  }
  console.log("wrote", out.map(w => `field-compare-${w}.png`).join(", "));
} finally { await f.dispose(); }
