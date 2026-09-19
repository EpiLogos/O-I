/**
 * Techne extraction check (lane T8, L5 Technē convergence). Verifies, from
 * the files themselves:
 *
 *   1. techne.css parses — comments stripped, braces balanced;
 *   2. every --oi-techne-* token introduced in techne.css is defined in BOTH
 *      the light scope (.oi-techne) and the night scope
 *      (.oi-techne[data-techne-night="true]") — no half-themed token;
 *   3. the theme module's luminance derivation agrees with a table of known
 *      cases (light scene → night:false, dark scene → night:true,
 *      preference-vs-scene opposition → hudContrast:true, threshold boundary);
 *   4. the attributes applyTechneTheme writes are selectors techne.css
 *      actually styles;
 *   5. gold stays scarce — no --oi-techne-* token carries the gold value.
 *
 * Usage: node checks/techne.mjs   (also wired into `npm run verify`)
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

const css = readFileSync(join(pkgRoot, "techne.css"), "utf8");

// ---------------------------------------------------------------------------
// 1. Parse: strip comments, then walk the braces.

const stripped = css.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, "");
let depth = 0;
let balanced = true;
for (const ch of stripped) {
  if (ch === "{") depth += 1;
  else if (ch === "}") {
    depth -= 1;
    if (depth < 0) balanced = false;
  }
}
check(balanced && depth === 0, `techne.css parses (balanced braces, final depth ${depth})`);

// ---------------------------------------------------------------------------
// 2. Both scopes define every --oi-techne-* token.

const TOKEN = /^\s*(--oi-techne-[a-z0-9-]+)\s*:/;
const scopeTokens = (selectorSuffix) => {
  const opener = new RegExp(`\\.oi-techne${selectorSuffix}\\s*\\{`);
  const match = stripped.match(opener);
  if (!match) return null;
  let at = stripped.indexOf("{", match.index);
  let level = 0;
  const names = new Set();
  for (let i = at; i < stripped.length; i++) {
    if (stripped[i] === "{") level += 1;
    else if (stripped[i] === "}") {
      level -= 1;
      if (level === 0) break;
    } else if (level === 1) {
      const rest = stripped.slice(i);
      const decl = rest.match(TOKEN);
      if (decl && /^\s/.test(rest)) names.add(decl[1]);
    }
  }
  return names;
};
const light = scopeTokens("(?![a-z\\[-])");
const night = scopeTokens('\\[data-techne-night="true"\\]');

check(light !== null, "techne.css has a light scope block (.oi-techne)");
check(night !== null, "techne.css has a night scope block (.oi-techne[data-techne-night=\"true\"])");
if (light && night) {
  const onlyLight = [...light].filter((t) => !night.has(t));
  const onlyNight = [...night].filter((t) => !light.has(t));
  check(
    onlyLight.length === 0 && onlyNight.length === 0 && light.size > 0,
    `every --oi-techne-* token has light and night values (${light.size} tokens${
      onlyLight.length ? "; light-only: " + onlyLight.join(", ") : ""
    }${onlyNight.length ? "; night-only: " + onlyNight.join(", ") : ""})`,
  );
}

// ---------------------------------------------------------------------------
// 3. The theme module's luminance derivation against known cases.

const { techneLuminance, deriveTechneTheme, applyTechneTheme } = await import(
  pathToFileURL(join(pkgRoot, "src/techne-theme.mjs")).href
);

const cases = [
  // [paper, appearance, night, hudContrast, note]
  ["#f4f2eb", "scene", false, false, "warm paper scene stays light"],
  ["#000000", "scene", true, false, "black scene derives night"],
  ["#10140f", "scene", true, false, "dark scene derives night"],
  ["#ffffff", "scene", false, false, "white scene stays light"],
  ["#000000", "light", false, true, "light preference over dark scene needs hud contrast"],
  ["#ffffff", "dark", true, true, "dark preference over light scene needs hud contrast"],
  ["#10140f", "dark", true, false, "dark preference over dark scene: plain night"],
  ["#f4f2eb", "light", false, false, "light preference over light scene: plain light"],
  ["#646464", "scene", false, false, "luminance exactly 100 reads light (strict <100)"],
  ["#636363", "scene", true, false, "just below the threshold reads night"],
];
let themeFailures = 0;
for (const [paper, appearance, nightExpected, hudExpected, note] of cases) {
  const got = deriveTechneTheme({ paper, appearance });
  const ok = got.night === nightExpected && got.hudContrast === hudExpected;
  if (!ok) themeFailures += 1;
  console.log(`      ${ok ? "ok" : "MISMATCH"}  ${paper} ${appearance}: night=${got.night} hudContrast=${got.hudContrast} (${note})`);
}
check(themeFailures === 0, `theme derivation agrees with the known-case table (${cases.length} cases)`);
check(
  Math.abs(techneLuminance("#f4f2eb") - 0.2126 * 244 - 0.7152 * 242 - 0.0722 * 235) < 1e-9,
  "luminance is the Rec. 709 sum app.ts uses (0.2126R + 0.7152G + 0.0722B)",
);
let threw = false;
try { deriveTechneTheme({ paper: "#f4f2e", appearance: "scene" }); } catch { threw = true; }
check(threw, "a malformed scene background is rejected, not silently derived");

// ---------------------------------------------------------------------------
// 4. The applied attributes are styled by techne.css.

const fakeStyle = { properties: new Map(), setProperty(name, value) { this.properties.set(name, value); } };
const fakeRoot = {
  style: fakeStyle,
  attributes: new Map(),
  setAttribute(name, value) { this.attributes.set(name, value); },
};
applyTechneTheme(fakeRoot, { paper: "#000000", ink: "#ededed", appearance: "scene" });
check(
  fakeRoot.attributes.get("data-techne-night") === "true"
    && fakeRoot.attributes.get("data-techne-hud-contrast") === "false"
    && fakeStyle.properties.get("--oi-world-surface") === "#000000"
    && fakeStyle.properties.get("--oi-world-foreground") === "#ededed",
  "applyTechneTheme sets night/hud-contrast attributes and the world host hooks",
);
check(
  css.includes("data-techne-night") && css.includes("data-techne-hud-contrast"),
  "techne.css styles both attributes the theme module applies",
);

// ---------------------------------------------------------------------------
// 5. Gold stays scarce: no techne token carries the house gold.

const GOLD = "#a8873f";
const goldHits = [...stripped.matchAll(/--oi-techne-[a-z0-9-]+\s*:\s*[^;]+/g)]
  .map((m) => m[0])
  .filter((decl) => decl.toLowerCase().includes(GOLD));
check(goldHits.length === 0, `no --oi-techne-* token carries the gold value (${goldHits.join(", ") || "none"})`);

// ---------------------------------------------------------------------------

if (failures.length) {
  console.error(`\ntechne check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\ntechne check: all checks pass");
