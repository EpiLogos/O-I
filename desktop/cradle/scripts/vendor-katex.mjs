#!/usr/bin/env node
// Vendors KaTeX's stylesheet and WOFF2 fonts into src/field/vendor/katex so the field renders the edition's pre-rendered maths
// with no CDN fetch (the edition's pages link katex.min.css from jsdelivr; the field bundles it instead). KaTeX is MIT.
//   node scripts/vendor-katex.mjs [--check]
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../site/vendor/quartz/node_modules/katex");
const out = resolve(here, "../src/field/vendor/katex");
const version = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).version;
// keep only the woff2 source of each @font-face (every webview this app runs in reads it)
const css = readFileSync(join(source, "dist/katex.min.css"), "utf8").replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2\"\),url\([^)]*\) format\("woff"\),url\([^)]*\) format\("truetype"\)/g, 'src:url(fonts/$1.woff2) format("woff2")');
const header = `/* KaTeX ${version} (MIT, https://katex.org) — vendored by scripts/vendor-katex.mjs; WOFF2 only. Do not edit. */\n`;
const built = header + css;
if (process.argv.includes("--check")) {
  const ok = existsSync(join(out, "katex.css")) && readFileSync(join(out, "katex.css"), "utf8") === built;
  if (!ok) { console.error("src/field/vendor/katex is out of date; run scripts/vendor-katex.mjs"); process.exit(1); }
  console.log(`katex ${version} vendored copy is current`);
} else {
  mkdirSync(join(out, "fonts"), {recursive: true});
  writeFileSync(join(out, "katex.css"), built);
  for (const f of readdirSync(join(source, "dist/fonts"))) if (f.endsWith(".woff2")) copyFileSync(join(source, "dist/fonts", f), join(out, "fonts", f));
  writeFileSync(join(out, "LICENSE"), readFileSync(join(source, "LICENSE"), "utf8"));
  console.log(`vendored KaTeX ${version} → ${out}`);
}
