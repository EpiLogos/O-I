#!/usr/bin/env node
/**
 * Derives src/field/field.css from the site's field stylesheet.
 *
 * The site (site/vendor/quartz/quartz/styles/{field,custom}.scss) is the visual authority for the
 * graph–pages–Expressions field. The Cradle hosts the same anatomy as a hosted surface, so the same
 * rules apply — re-scoped, not rewritten:
 *
 *   #quartz-root#quartz-root.page   → .field-root.field-root       (the surface's own root)
 *   :root[saved-theme='dark']       → .field-root[data-theme='dark']
 *   @media (max-width: N)           → @container field (max-width: N)   (the surface is a pane, not a window)
 *   vw / vh / dvh                   → cqw / cqh                     (relative to the pane)
 *   position: fixed                 → position: absolute            (inside the pane)
 *   #quartz-body / #graph-svg / #tangent-pane → classes             (several fields may be mounted)
 *   .pane / .tab / .tabs            → .fpane / .ftab / .ftabs       (names the workbench's own CSS already uses)
 *
 * It compiles with the `sass` package the Quartz vendor tree already installs (no new dependency
 * tree) and is run by hand when the site's styles change:
 *
 *   node desktop/cradle/scripts/port-field-styles.mjs [--check]
 *
 * `--check` exits non-zero when src/field/field.css differs from what the site's sources produce.
 */
import {createHash} from "node:crypto";
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createRequire} from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const styles = resolve(repo, "site/vendor/quartz/quartz/styles");
const out = resolve(here, "../src/field/field.css");
const require = createRequire(resolve(repo, "site/vendor/quartz/package.json"));

const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
const fieldScss = resolve(styles, "field.scss"), customScss = resolve(styles, "custom.scss");

function compile() {
  const sass = require("sass");
  // custom.scss `@use`s Quartz's base stylesheet; the field is its own page here, so only the field rules are wanted.
  const custom = readFileSync(customScss, "utf8").replace(/@use "\.\/base\.scss";\n/, "");
  const field = sass.compile(fieldScss, {style: "expanded"}).css;
  const rest = sass.compileString(custom.replace('@use "./field.scss";\n', ""), {style: "expanded", loadPaths: [styles]}).css;
  return `${field}\n${rest}`;
}

const ROOT = /#quartz-root#quartz-root\.page/g;
const IDS = {"#quartz-body": ".fq-body", "#graph-svg": ".graph-svg", "#tangent-pane": ".tangent-pane"};

function rescope(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // The two token blocks and the document-level resets become the surface's own.
  css = css.replace(/:root\[saved-theme=['"]?dark['"]?\]/g, ".field-root[data-theme='dark']");
  css = css.replace(/:root\[saved-theme=['"]?light['"]?\]/g, ".field-root[data-theme='light']");
  css = css.replace(/(^|[\s,{}])html,\s*\nbody\s*\{[^}]*\}/g, "$1");
  css = css.replace(/(^|\n)html\s*\{[^}]*\}/g, "$1").replace(/(^|\n)body\s*\{[^}]*\}/g, "$1");
  css = css.replace(/(^|\n)(\s*):root\s*\{/g, "$1$2.field-root {").replace(/(^|\n):root,/g, "$1.field-root,");
  css = css.replace(/(^|\n)\*\s*\{\s*box-sizing: border-box;\s*\}/g, "$1.field-root, .field-root * { box-sizing: border-box; }");
  css = css.replace(/body\.is-resizing[^{]*\{[^}]*\}/g, "");
  css = css.replace(/(^|\n)\* \{ animation: none !important[^}]*\}/g, "$1.field-root * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }");
  css = css.replace(ROOT, ".field-root.field-root");
  for (const [from, to] of Object.entries(IDS)) css = css.split(from).join(to);
  // Class names the Cradle's own stylesheets already use (the workbench's `.pane`, its `.tab` strip) are renamed, so
  // neither side's rules reach the other: the field's pane is `.fpane`, its tabs `.ftab`.
  css = css.replace(/\.tabs(?![\w-])/g, ".ftabs").replace(/\.tab(?=__|--)/g, ".ftab").replace(/\.tab(?![\w-])/g, ".ftab").replace(/\.pane(?![\w-])/g, ".fpane");
  css = css.replace(/@media \(max-width: (\d+px)\)/g, "@container field (max-width: $1)");
  css = css.replace(/(\d+(?:\.\d+)?)dvh/g, "$1cqh").replace(/(\d+(?:\.\d+)?)vh/g, "$1cqh").replace(/(\d+(?:\.\d+)?)vw/g, "$1cqw");
  css = css.replace(/position:\s*fixed/g, "position: absolute");
  // The page was the document: overflow hidden belongs to the surface root now.
  return css;
}

/**
 * Colours. The site's stylesheets carry literal colours; the Cradle's design-system policy
 * (packages/oi-design-system/checks/verify.mjs: "cradle raw hex/rgba/hsl colours = 0") admits none in a consumer.
 * Every literal the compiler emits is therefore replaced here, by an EXPLICIT table, with a token reference:
 *
 *   grounds, inks, the five register hues  → var(--oi-field-*)      (packages/oi-design-system/tokens.css, light + dark)
 *   rules, shadows, scrims, highlights     → color-mix(in srgb, <token> N%, transparent)   (the same colour at the same alpha)
 *   the site's golds                       → the ONE gold, var(--oi-meta-relation), mixed toward black (light) or paper (dark).
 *                                            Gold keeps one value and one role (verify.mjs: "gold stays scarce"); these are
 *                                            the only places the field's colour differs from the site's, and by a few units:
 *                                            see GOLD below for the exact computed values.
 *
 * A literal that is not in the table stops the script: a new colour in the site's styles is a decision, not a drift.
 */
const INK = "var(--oi-field-ink)", GOLD_ROLE = "var(--oi-meta-relation)", BLACK = "var(--oi-field-black)", PAPER = "var(--oi-white)";
const mix = (c, pct, toward = "transparent") => `color-mix(in srgb, ${c} ${pct}%, ${toward})`;
const COLOURS = new Map([
  // light
  ["#fbfaf6", "var(--oi-field-paper)"], ["#f5f3ed", "var(--oi-field-panel)"], ["#f1efe8", "var(--oi-field-ground)"], ["#111112", INK],
  ["#66645f", "var(--oi-field-muted)"], ["#8f8c84", "var(--oi-field-faint)"],
  ["rgb(17 17 18 / 14%)", mix(INK, 14)], ["rgb(17 17 18 / 7%)", mix(INK, 7)], ["rgb(17 17 18 / 45%)", mix(INK, 45)],
  ["#8a8473", "var(--oi-field-register-core)"], ["#2a766e", "var(--oi-field-register-matheme)"], ["#a54a31", "var(--oi-field-register-mytheme)"], ["#3d5c8d", "var(--oi-field-register-episteme)"],
  ["#f5f0e6", "var(--oi-field-plate)"],
  // dark
  ["#0b0b0c", "var(--oi-field-paper)"], ["#101011", "var(--oi-field-panel)"], ["#0e0e0f", "var(--oi-field-ground)"], ["#f4f2ec", INK],
  ["#b8b6b0", "var(--oi-field-muted)"], ["#7e7c76", "var(--oi-field-faint)"],
  ["rgb(244 242 236 / 18%)", mix(INK, 18)], ["rgb(244 242 236 / 8%)", mix(INK, 8)], ["rgb(0 0 0 / 80%)", mix(BLACK, 80)],
  ["#a8a291", "var(--oi-field-register-core)"], ["#6fb8ae", "var(--oi-field-register-matheme)"], ["#df8f72", "var(--oi-field-register-mytheme)"], ["#8eaad6", "var(--oi-field-register-episteme)"],
  ["#ece6d8", "var(--oi-field-plate)"],
  // overlays and the badge's ink
  ["rgba(0, 0, 0, 0.62)", mix(BLACK, 62)], ["rgba(0, 0, 0, 0.38)", mix(BLACK, 38)], ["#111", "var(--oi-field-on-mark)"],
  // GOLD — the site's four golds and its highlight, drawn from the one gold. Computed values, site → field (gold #a8873f = 168 135 63):
  //   #80642e (128 100 46) → 76% gold + black  = 128 103 48     (light --gold)
  //   #a67f2c (166 127 44) → the gold itself   = 168 135 63     (light --gold-hi)
  //   #b2944f (178 148 79) → 89% gold + paper  = 177 147 83     (dark --gold; paper = --oi-white #f7f7f4)
  //   #d2ae5e (210 174 94) → 70% gold + paper  = 192 169 117    (dark --gold-hi)
  //   --hl rgb(178 148 79 / 22% and 26%) → the gold at 22% / 26%
  ["#80642e", mix(GOLD_ROLE, 76, BLACK)], ["#a67f2c", GOLD_ROLE], ["#b2944f", mix(GOLD_ROLE, 89, PAPER)], ["#d2ae5e", mix(GOLD_ROLE, 70, PAPER)],
  ["rgb(178 148 79 / 22%)", mix(GOLD_ROLE, 22)], ["rgb(178 148 79 / 26%)", mix(GOLD_ROLE, 26)],
]);
function tokenise(css) {
  const unmapped = new Set();
  const out = css.replace(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g, lit => {
    const to = COLOURS.get(lit.toLowerCase());
    if (to === undefined) { unmapped.add(lit); return lit; }
    return to;
  });
  if (unmapped.size) { console.error(`port-field-styles: colour literals with no entry in COLOURS (map each to a token, see the header): ${[...unmapped].join(", ")}`); process.exit(1); }
  return out;
}

const header = (body) => `/* GENERATED by desktop/cradle/scripts/port-field-styles.mjs — do not edit; run the script.
 * Source: site/vendor/quartz/quartz/styles/field.scss (${sha(fieldScss)}) + custom.scss (${sha(customScss)}).
 * The site is the visual authority; this file is its re-scope for a hosted surface (see the script header). */
${body}`;

const root = `
.field-host { container: field / size; position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
.field-host .field-root { width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--ink); font-family: var(--ui); font-synthesis: none; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
.field-host .field-root.page { height: 100%; }
/* five neutral tones for a corpus with no registers of its own (the generic adapter): the same five colours, unnamed. */
.field-host .field-root { --c-t0: var(--c-essay); --c-t1: var(--c-core); --c-t2: var(--c-matheme); --c-t3: var(--c-mytheme); --c-t4: var(--c-episteme); }
/* Hosted in the desktop shell: the window's own controls float over the pane's top corners (shell.css sets the
   reserves on the shell and the corner cutout on the pane). The field keeps its heads clear of them — the one place
   the host's geometry reaches into the site's layout. */
.field-host .field-root.field-root .left .left-inner { padding-top: 34px; }
/* Quartz shows heading permalinks only on hover; here the heading is the link target and the icon is dropped. */
.field-host .field-root.field-root .prose a[role='anchor'] { display: none; }
.field-host .field-root.field-root .rail-left { padding-top: 46px; }
@container field (max-width: 1099px) { .field-host .field-root.field-root .center-head { padding-left: max(6px, var(--shell-scope-reserve, 0px)); } }
.field-host .field-root.field-root .rail-right { padding-top: 46px; }
.field-host .field-root.field-root .graph-head { padding-right: max(6px, calc(var(--window-cutout-right, 0px) + 4px)); }
.field-host .field-root.field-root[data-right='closed'] .rail-right { padding-top: 46px; }
.field-host .field-root.field-root .field-back { flex: none; margin-left: 4px; }
/* The site's global element rules that a Quartz document supplies and a hosted surface does not inherit (base.scss): headings
   take the header font stack, and the eyebrow rides the body line height. Pinned by walk/scenarios/field-typography.mjs
   (computed styles, native vs site). */
.field-host .field-root.field-root .ahead__title { font-family: "Avenir Next", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
.field-host .field-root.field-root .ahead__eyebrow { line-height: 1.6rem; }
/* the gathered constellation (field/Right.tsx, graphView.ts) */
.field-host .field-root.field-root .gn.is-gathered circle.n { fill-opacity: 1; stroke: var(--gold-hi); stroke-width: 2.2; }
.field-host .field-root.field-root .gcard__act button.is-g { background: transparent; color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.field-host .field-root.field-root .gcons { flex: none; padding: 8px 12px 10px 18px; border-top: 1px solid var(--rule); background: var(--field-bg); }
.field-host .field-root.field-root .gcons__head { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; color: var(--muted); }
.field-host .field-root.field-root .gcons__head b { font-size: 0.64rem; letter-spacing: var(--track); text-transform: uppercase; color: var(--gold); }
.field-host .field-root.field-root .gcons__list { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 0; padding: 0; list-style: none; max-height: 64px; overflow: auto; }
.field-host .field-root.field-root .gcons__list li { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 4px 2px 8px; border: 1px solid var(--gold); border-radius: 99px; font-size: 0.7rem; }
.field-host .field-root.field-root .gcons__list li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 16ch; }
.field-host .field-root.field-root .gcons__list li button { display: grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; color: var(--faint); }
.field-host .field-root.field-root .gcons__form { display: grid; gap: 6px; margin-top: 8px; }
.field-host .field-root.field-root .gcons__form input { height: 28px; padding: 0 9px; border: 1px solid var(--rule); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 0.78rem var(--ui); }
.field-host .field-root.field-root .gcons__err { margin: 0; font-size: 0.72rem; color: var(--c-mytheme); }
/* the utility bar: scope · modes · companion · settings (field/Utility.tsx) */
.field-host .field-root.field-root .futil { position: relative; display: flex; align-items: center; gap: 2px; }
.field-host .field-root.field-root .futil--bar { flex: none; padding: 6px 8px; border-top: 1px solid var(--rule); }
.field-host .field-root.field-root .futil--rail { flex-direction: column; margin-top: auto; padding-bottom: 12px; }
.field-host .field-root.field-root .futil--rail .futil__spacer { display: none; }
.field-host .field-root.field-root .futil__spacer { flex: 1; }
.field-host .field-root.field-root .futil__slot { position: relative; }
.field-host .field-root.field-root .futil__btn.is-on { color: var(--gold); }
.field-host .field-root.field-root .futil__t { max-width: 9ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.72rem; font-weight: 600; }
.field-host .field-root.field-root .futil__menu { position: absolute; z-index: 90; min-width: 220px; max-width: 280px; padding: 6px; border: 1px solid var(--rule); border-radius: 10px; background: var(--bg); box-shadow: var(--shadow); }
.field-host .field-root.field-root .futil--bar .futil__menu { bottom: calc(100% + 6px); left: 0; }
.field-host .field-root.field-root .futil--rail .futil__menu { left: calc(100% + 8px); bottom: 0; }
.field-host .field-root.field-root .futil__h { margin: 6px 8px 4px; font-size: 0.6rem; font-weight: 650; letter-spacing: var(--track); text-transform: uppercase; color: var(--muted); }
.field-host .field-root.field-root .futil__h:first-child { margin-top: 2px; }
.field-host .field-root.field-root .futil__note { margin: 6px 8px; font-size: 0.74rem; color: var(--muted); }
.field-host .field-root.field-root .futil__item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px 8px; border-radius: 6px; font-size: 0.8rem; text-align: left; }
.field-host .field-root.field-root .futil__item:hover { background: var(--rule-soft); }
.field-host .field-root.field-root .futil__item i { flex: none; width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.field-host .field-root.field-root .futil__item.is-on i { background: var(--gold-hi); box-shadow: none; }
`;

const built = header(tokenise(rescope(compile())).replace(/\n{3,}/g, "\n\n") + root);
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== built) { console.error("src/field/field.css is out of date with the site's field styles; run scripts/port-field-styles.mjs"); process.exit(1); }
  console.log("src/field/field.css matches the site's styles");
} else {
  writeFileSync(out, built);
  console.log(`wrote ${out} (${built.length} bytes)`);
}
void pathToFileURL;
