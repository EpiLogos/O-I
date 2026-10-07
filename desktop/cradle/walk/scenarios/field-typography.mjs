#!/usr/bin/env node
// UX9, deterministically: the reading column's computed styles in the native field equal the site's, element by element, at the
// same viewport. No screenshots: for each pair of elements (the site's and the native one that shows the same thing at the same
// locus, THE-RETURN-OF-ZERO at M16) the walk reads getComputedStyle and compares font family, size, weight, style, line height,
// letter spacing, colour, case, alignment, the block margins, and the used width of the column (the measure).
//
// A numeric property matches within 0.05px (container-query units round differently by a few thousandths); every other property
// must be identical after whitespace normalisation. A pair is compared only if BOTH documents have the element (a missing
// one on either side is a check of its own, never silently skipped). The receipt carries every value read.
//   FIELD_SITE_ROOT=<site root> node walk/scenarios/field-typography.mjs
import {bootField, writeReceipt} from "../lib/field-walk.mjs";

const checks = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 400) : ""}`); };
const f = await bootField({epi: true});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);

// [name, native selector, site selector, required]
const PAIRS = [
  ["title", ".ahead__title", ".ahead__title", true],
  ["eyebrow", ".ahead__eyebrow", ".ahead__eyebrow", true],
  ["meta line", ".ahead__meta", ".ahead__meta", true],
  ["body column", ".field-body article", "article", true],
  ["body paragraph", ".field-body article > p", "article > p", true],
  ["section heading (h2)", ".field-body article h2", "article h2", true],
  ["sub-heading (h3)", ".field-body article h3", "article h3", false],
  ["list item", ".field-body article li", "article li", false],
  ["block quote", ".field-body article blockquote", "article blockquote", false],
  ["inline link in a paragraph", ".field-body article p a", "article p a", false],
  ["inline code", ".field-body article p code", "article p code", false],
  ["figure caption", ".field-body article figcaption", "article figcaption", false],
];
const PROPS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "color", "textTransform", "textAlign", "marginTop", "marginBottom", "textDecorationLine"];
const NUMERIC = new Set(["fontSize", "lineHeight", "letterSpacing", "marginTop", "marginBottom"]);
const read = (p, sel, scope) => p.evaluate(({sel, scope}) => {
  const root = scope ? document.querySelector(scope) : document;
  const e = root?.querySelector(sel); if (!e) return null;
  const c = getComputedStyle(e), r = e.getBoundingClientRect();
  const o = {}; for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "color", "textTransform", "textAlign", "marginTop", "marginBottom", "textDecorationLine"]) o[k] = c[k];
  o.usedWidth = Math.round(r.width * 100) / 100; o.text = (e.textContent ?? "").trim().slice(0, 40);
  return o;
}, {sel, scope});
const num = v => (v === "normal" ? NaN : parseFloat(v));
// A colour is compared as RGB numbers (computed colours serialise as rgb() or color(srgb …)). The field draws the site's gold from the
// ONE gold token (--oi-meta-relation, "gold stays scarce"), mixed toward black: those are the only colours allowed to differ, by at
// most GOLD_TOLERANCE per 8-bit channel, and every colour that is not identical is listed in the detail with both values.
const GOLD_TOLERANCE = 4;
const rgbOf = v => { const m = /^rgba?\(([^)]+)\)$/.exec(v); if (m) return m[1].split(/[ ,\/]+/).slice(0, 3).map(Number); const c = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(v); return c ? [c[1], c[2], c[3]].map(x => Math.round(Number(x) * 255 * 100) / 100) : null; };
const norm = v => String(v).replace(/\s+/g, " ").replace(/"/g, "'").trim();

const goldDrift = [];
let failed = false;
try {
  const search = page.getByRole("searchbox", {name: "Search"});
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000});
  const site = await f.context.newPage();
  // The site lays out by its VIEWPORT; the field lays out by its CONTAINER (the pane the window gives it, a few px narrower than
  // the viewport). The two are compared at the same layout width: the site's viewport = the field's container. The field's
  // viewport is widened by whatever the window takes, and both numbers go in the receipt.
  const containerWidth = () => page.evaluate(() => Math.round(document.querySelector(".field-host").getBoundingClientRect().width));
  for (const w of [1440, 1000, 760]) {
    await site.setViewportSize({width: w, height: 900}); await page.setViewportSize({width: w, height: 900}); await settle(600);
    let cw = await containerWidth(); if (cw !== w) { await page.setViewportSize({width: w + (w - cw), height: 900}); await settle(900); cw = await containerWidth(); }
    check(cw === w, `[${w}px] the field's container is ${w}px wide (the site's viewport)`, {container: cw, viewport: (await page.viewportSize()).width});
    await site.goto(`${f.siteBase}/essay/THE-RETURN-OF-ZERO?m=16`, {waitUntil: "load"});
    await site.waitForSelector("body[data-ready='1']", {timeout: 60000}).catch(() => {}); await site.waitForTimeout(2500);
    await settle(1800);
    record[w] = {};
    for (const [name, nsel, ssel, required] of PAIRS) {
      const n = await read(page, nsel, ".article.fpane:not([hidden])"), s = await read(site, ssel, null);
      record[w][name] = {native: n, site: s};
      if (!n || !s) { if (required || !!n !== !!s) check(false, `[${w}px] ${name}: present in both documents`, {native: !!n, site: !!s}); else console.log(`(skip) [${w}px] ${name}: absent in both`); continue; }
      const diffs = [];
      for (const k of PROPS) {
        if (k === "color" && rgbOf(n[k]) && rgbOf(s[k])) {
          const a = rgbOf(n[k]), b = rgbOf(s[k]), d = Math.max(...a.map((x, i) => Math.abs(x - b[i])));
          if (d > GOLD_TOLERANCE) diffs.push({prop: k, native: n[k], site: s[k]});
          else if (d > 0.5) goldDrift.push({w, element: name, native: a.map(x => Math.round(x)), site: b, maxChannelDelta: Math.round(d * 10) / 10});
        }
        else if (NUMERIC.has(k) && Number.isFinite(num(n[k])) && Number.isFinite(num(s[k]))) { if (Math.abs(num(n[k]) - num(s[k])) > 0.05) diffs.push({prop: k, native: n[k], site: s[k]}); }
        else if (norm(n[k]) !== norm(s[k])) diffs.push({prop: k, native: n[k], site: s[k]});
      }
      check(diffs.length === 0, `[${w}px] ${name}: computed type styles equal the site's`, diffs.length ? diffs : {sample: n.text});
    }
    // the measure. The rule is compared (the reading pane's padding, margins and max-width are the same computed values), and the
    // used width of the article column must follow that rule on BOTH sides: min(max-width, centre - margins) - padding.
    const geo = (p, pane, centre, col) => p.evaluate(({pane, centre, col}) => {
      const q = s => document.querySelector(s), c = getComputedStyle(q(pane)), n = k => parseFloat(c[k]) || 0;
      return {paddingLeft: c.paddingLeft, paddingRight: c.paddingRight, marginLeft: c.marginLeft, marginRight: c.marginRight, maxWidth: c.maxWidth,
        centre: q(centre).getBoundingClientRect().width, column: q(col).getBoundingClientRect().width, right: q(".right, aside.right")?.getBoundingClientRect().width ?? null,
        expected: Math.min(c.maxWidth === "none" ? Infinity : parseFloat(c.maxWidth), q(centre).getBoundingClientRect().width - n("marginLeft") - n("marginRight")) - n("paddingLeft") - n("paddingRight")};
    }, {pane, centre, col});
    const gn = await geo(page, ".article.fpane:not([hidden])", ".center-scroll", ".article.fpane:not([hidden]) .field-body article"), gs = await geo(site, "#essay-pane", ".center-scroll", "article");
    record[w].measure = {native: gn, site: gs};
    const rule = ["paddingLeft", "paddingRight", "maxWidth"].filter(k => gn[k] !== gs[k]);
    check(rule.length === 0, `[${w}px] the reading pane has the same measure rule (padding and max-width)`, rule.length ? rule.map(k => ({prop: k, native: gn[k], site: gs[k]})) : {maxWidth: gn.maxWidth, padding: gn.paddingLeft});
    check(gn.marginLeft === gn.marginRight && gs.marginLeft === gs.marginRight, `[${w}px] the pane is centred on both sides (auto margins; their used value follows the centre width, so it is not compared)`, {native: gn.marginLeft, site: gs.marginLeft});
    check(Math.abs(gn.column - gn.expected) <= 1 && Math.abs(gs.column - gs.expected) <= 1, `[${w}px] the column's used width follows that rule on both sides`, {native: [gn.column, gn.expected], site: [gs.column, gs.expected]});
    // The one place the layouts differ, asserted as what is true so a change on either side is noticed: the field panel beside the
    // page. The reference edition is the baseline snapshot (ca603fb4e), whose tablet rule is a fixed 300px column; the site
    // stylesheet in this tree (and so the native field) gives it var(--cr) = 340px. Equal at >= 1100px.
    const wantPanel = w >= 1100 ? {native: 340, site: 340} : {native: 340, site: 300};
    check(Math.round(gn.right) === wantPanel.native && Math.round(gs.right) === wantPanel.site, `[${w}px] DEPARTURE recorded: the field panel is ${wantPanel.native}px natively and ${wantPanel.site}px in the baseline edition${w >= 1100 ? " (equal)" : " (site-version drift: the baseline predates the resizable panel)"}`, {native: Math.round(gn.right), site: Math.round(gs.right)});
  }
  // ---- the palette itself, both themes (the generated stylesheet holds only token references; this reads what they RESOLVE to) ----
  // Each palette variable is painted on a probe element inside the field (native) / on the site's root (site) and read back as a
  // computed colour, light and dark. Everything but the gold family must be identical to the site's; the gold family is drawn from
  // --oi-meta-relation and is asserted to equal the documented mapping (port-field-styles.mjs, GOLD), with the site's value recorded.
  const PALETTE = ["--bg", "--panel", "--field-bg", "--ink", "--muted", "--faint", "--rule", "--rule-soft", "--c-essay", "--c-core", "--c-matheme", "--c-mytheme", "--c-episteme", "--plate-mat", "--gold", "--gold-hi", "--hl"];
  const GOLDY = new Set(["--gold", "--gold-hi", "--hl"]);
  const MAPPED = {light: {"--gold": [128, 103, 48], "--gold-hi": [168, 135, 63]}, dark: {"--gold": [177, 147, 83], "--gold-hi": [192, 169, 117]}};
  const rgbaOf = v => { const m = /^rgba?\(([^)]+)\)$/.exec(v); if (m) { const p = m[1].split(/[ ,\/]+/).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; } const c = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?/.exec(v); return c ? [c[1], c[2], c[3]].map(x => Math.round(Number(x) * 255 * 100) / 100).concat([c[4] === undefined ? 1 : Number(c[4])]) : null; };
  const resolve = (p, scope, names) => p.evaluate(({scope, names}) => { const host = document.querySelector(scope); const out = {}; for (const n of names) { const e = document.createElement("i"); e.style.cssText = `position:absolute;background:var(${n})`; host.append(e); out[n] = getComputedStyle(e).backgroundColor; e.remove(); } return out; }, {scope, names});
  const desktop = () => page.evaluate(() => document.body.dataset.theme ?? null);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(t => { document.body.dataset.theme = t; }, theme);   // the host sets the theme on the body (index.html: <body class="oi-desktop">)
    await site.evaluate(t => document.documentElement.setAttribute("saved-theme", t), theme);
    await settle(900);
    const nat = await resolve(page, ".field-root", PALETTE), sit = await resolve(site, "#quartz-root", PALETTE);
    const plain = PALETTE.filter(n => !GOLDY.has(n)), wrong = plain.filter(n => { const a = rgbaOf(nat[n]), b = rgbaOf(sit[n]); return !a || !b || a.some((x, i) => Math.abs(x - b[i]) > (i === 3 ? 0.005 : 0.6)); });
    record[`palette-${theme}`] = {native: nat, site: sit};
    check(wrong.length === 0, `[${theme}] the palette the field resolves to equals the site's (${plain.length} roles: grounds, inks, rules, the five register hues, the plate)`, wrong.length ? wrong.map(n => ({role: n, native: nat[n], site: sit[n]})) : {desktopTheme: await desktop()});
    const gold = ["--gold", "--gold-hi"].map(n => ({role: n, native: rgbaOf(nat[n]).slice(0, 3).map(Math.round), site: rgbaOf(sit[n]).slice(0, 3), want: MAPPED[theme][n]}));
    check(gold.every(g => g.native.every((x, i) => Math.abs(x - g.want[i]) <= 1)), `[${theme}] DEPARTURE recorded: the field's gold is drawn from the one gold token and equals the documented mapping (site values listed)`, gold);
  }
  await page.evaluate(() => { document.body.dataset.theme = "light"; });
  record.goldDrift = goldDrift;
  const seen = [...new Map(goldDrift.map(g => [g.element + JSON.stringify(g.native), g])).values()];
  check(seen.length <= 1 && seen.every(g => g.element === "eyebrow"), "colours: the only computed colour that differs from the site's is the eyebrow's gold, drawn from the one gold token (--oi-meta-relation), within 4/255 per channel", seen.map(g => ({element: g.element, native: g.native, site: g.site, maxChannelDelta: g.maxChannelDelta})));
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-typography.json", {scenario: "field-typography", at: new Date().toISOString(), record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
