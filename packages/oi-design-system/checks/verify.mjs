/**
 * U0.5 design-system check — evidence, not assertion theatre (#25 list;
 * wayfinder D9 + law 11). Verifies, from the files themselves:
 *
 *   1. tokens.css carries every #25 vocabulary section, non-empty;
 *   2. no token name is defined twice within one scope (block);
 *   3. gold stays scarce — only --oi-gold and --oi-meta-relation carry the
 *      gold value (no new gold roles);
 *   4. the reduced-motion convention exists (motion durations collapse
 *      under prefers-reduced-motion);
 *   5. the cradle's every var(--oi-*) reference resolves to a real token
 *      (package or cradle-defined) — no undefined names;
 *   6. the cradle source contains ZERO raw colours (hex / rgb(a) / hsl(a)).
 *
 * Usage: node checks/verify.mjs   (or `npm run verify` in this package)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const repoRoot = resolve(pkgRoot, "../..");
const cradleSrc = join(repoRoot, "desktop/cradle/src");

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

const css = readFileSync(join(pkgRoot, "tokens.css"), "utf8");

// ---------------------------------------------------------------------------
// 1–4. Parse tokens.css into blocks, tracking section markers.

const REQUIRED_SECTIONS = [
  "foundation tokens",
  "semantic tokens — surface / text / muted / rule roles",
  "relation / focus / projection roles — scarce gold meta-relation",
  "spacing / rhythm",
  "typography",
  "radii",
  "z-layers",
  "motion",
  "focus / keyboard states",
];

const lines = css.split("\n");
const UNSECTIONED = "(unsectioned)";
let section = UNSECTIONED;
const sections = new Map(); // section name -> [token names]
const blocks = []; // { selector, names: [], decls: Map }
const stack = [];
const firstOwner = new Map(); // token name -> section of first definition
const sectionMarker = /^\s*\/\*\s*=+\s*section:\s*(.+?)\s*=+\s*\*\//;
const decl = /^\s*(--oi-[a-z0-9-]+)\s*:\s*(.+?);\s*$/;

for (const line of lines) {
  const marker = line.match(sectionMarker);
  if (marker) section = marker[1];

  const open = line.indexOf("{");
  const close = line.lastIndexOf("}");
  if (open !== -1) {
    const b = { selector: line.slice(0, open).trim(), names: [], decls: new Map() };
    stack.push(b);
    blocks.push(b);
  }

  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    const d = line.match(decl);
    if (d) {
      top.names.push(d[1]);
      top.decls.set(d[1], d[2]);
      // A token belongs to the section whose marker precedes its FIRST
      // definition (theme overrides later re-map the same names).
      if (!firstOwner.has(d[1])) {
        firstOwner.set(d[1], section);
        if (!sections.has(section)) sections.set(section, []);
        sections.get(section).push(d[1]);
      }
    }
  }

  if (close !== -1) stack.pop();
}

for (const required of REQUIRED_SECTIONS) {
  const names = sections.get(required) ?? [];
  check(names.length > 0, `tokens.css section non-empty: ${required} (${names.length} token${names.length === 1 ? "" : "s"})`);
}
const unknownSections = [...sections.keys()].filter((s) => !REQUIRED_SECTIONS.includes(s) && s !== UNSECTIONED);
check(unknownSections.length === 0, `no unlisted section markers (${unknownSections.join(", ") || "none"})`);

// 2. No duplicate token names within one scope.
let duplicates = 0;
for (const b of blocks) {
  const seen = new Set();
  for (const name of b.names) {
    if (seen.has(name)) {
      console.log(`      duplicate in ${b.selector || "(anon)"}: ${name}`);
      duplicates += 1;
    }
    seen.add(name);
  }
}
check(duplicates === 0, `no duplicate token names within a scope (${duplicates})`);

// 3. Gold stays scarce: only --oi-gold / --oi-meta-relation may carry gold.
const defined = new Set(blocks.flatMap((b) => b.names));
const GOLD = "#a8873f";
const goldRoles = [];
for (const b of blocks) {
  for (const [name, value] of b.decls) {
    if (value.toLowerCase().includes(GOLD) || value.includes("var(--oi-gold)")) {
      goldRoles.push(name);
    }
  }
}
const allowedGold = new Set(["--oi-gold", "--oi-meta-relation"]);
check(
  goldRoles.every((n) => allowedGold.has(n)) && goldRoles.length > 0,
  `gold stays scarce — only --oi-gold/--oi-meta-relation carry it (found: ${[...new Set(goldRoles)].join(", ")})`,
);

// 4. Reduced-motion convention.
const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*--oi-motion-fast:\s*0\.01ms[^}]*--oi-motion-normal:\s*0\.01ms/s.test(css);
check(reduced, "reduced-motion convention present (motion durations collapse to 0.01ms)");

// Summary of the vocabulary.
console.log(`      tokens.css defines ${defined.size} unique --oi-* names across ${blocks.length} blocks`);

// ---------------------------------------------------------------------------
// 5–6. Cradle audit: references resolve; zero raw colours.

const collectFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...collectFiles(p));
    else if (/\.(css|ts|tsx|html)$/.test(entry)) out.push(p);
  }
  return out;
};

const files = collectFiles(cradleSrc);
const cradleDefined = new Set(); // tokens the cradle itself defines (should be none, but resolve honestly)
const unresolved = [];
const rawHits = [];
const colourRe = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
const varRe = /var\(\s*(--oi-[a-z0-9-]+)/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = relative(repoRoot, file);

  // Tokens the cradle defines itself (a local definition is a resolution
  // source, though the law prefers the package).
  for (const line of text.split("\n")) {
    const d = line.match(decl);
    if (d) cradleDefined.add(d[1]);
  }

  for (const m of text.matchAll(varRe)) {
    if (!defined.has(m[1]) && !cradleDefined.has(m[1])) {
      unresolved.push(`${rel}: var(${m[1]})`);
    }
  }

  for (const m of text.matchAll(colourRe)) {
    rawHits.push(`${rel}: ${m[0]}`);
  }
}

check(unresolved.length === 0, `cradle var(--oi-*) references all resolve (${unresolved.length ? "UNRESOLVED: " + unresolved.join(", ") : `${files.length} files scanned`})`);
check(rawHits.length === 0, `cradle raw hex/rgba/hsl colours = 0 (${rawHits.length ? rawHits.join(", ") : `${files.length} files scanned`})`);

// ---------------------------------------------------------------------------

if (failures.length) {
  console.error(`\nverify: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nverify: all checks pass");
