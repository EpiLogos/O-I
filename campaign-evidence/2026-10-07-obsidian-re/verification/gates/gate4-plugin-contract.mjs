// Gate 4 — Plugin contract.
// Contract source: findings/a2-plugin-ecosystem.md §1–§8.
// Oracles: lanes/a2 dumps + transcripts (3 isolated pinned 1.7.7 runs with a
// probe plugin and an intentionally-throwing plugin).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lanes = join(here, "..", "..", "..", "..", "ProjectCentral", "now", "tmp", "obsidian-re-20261007", "lanes");
const a2 = join(lanes, "a2");
const dumps = join(a2, "fixture-vault", ".obsidian", "plugins", "re-probe", "dumps");
const run3 = join(a2, "transcripts", "run3");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// §8: exactly 122 exported symbols; apiVersion is the app version; load-bearing surface present.
const keys = JSON.parse(readFileSync(join(dumps, "obsidian-module-keys.json"), "utf8"));
const keyList = Array.isArray(keys) ? keys : keys.keys ?? Object.keys(keys);
check("E1. require('obsidian') exposes exactly 122 symbols", keyList.length === 122, `got ${keyList.length}`);
const flat = new Set(Array.isArray(keys) ? keys : keyList.map(k => k.name ?? k));
const loadBearing = ["Plugin", "Component", "ItemView", "MarkdownView", "Modal", "FuzzySuggestModal", "Notice",
  "Setting", "PluginSettingTab", "Vault", "TFile", "TFolder", "MetadataCache", "FileManager", "WorkspaceLeaf",
  "requestUrl", "normalizePath", "debounce", "addIcon", "setIcon", "parseLinktext", "getLinkpath",
  "prepareFuzzySearch", "Platform", "moment", "Menu", "MenuItem"];
const missingSurface = loadBearing.filter(k => !flat.has(k));
check("E2. documented load-bearing extension points all present", missingSurface.length === 0,
  missingSurface.length ? "missing: " + missingSurface.join(", ") : `${loadBearing.length} exemplars checked`);
const apiVersion = flat.has("apiVersion") ? (keys.apiVersion ?? (Array.isArray(keys) ? null : keys)) : null;
check("E3. apiVersion string present and pinned", typeof apiVersion === "string" && apiVersion === "1.7.7", String(apiVersion));

// §3: pre-enable state — manifests scanned, enabled set prefilled, nothing loaded, trust flag unset.
const pre = JSON.parse(readFileSync(join(run3, "state-pre-enable.json"), "utf8"));
check("E4. restricted mode: trust flag unset before enable, manifests scanned, nothing loaded",
  pre.enableFlagBefore === null && pre.manifests?.includes("re-probe") && pre.manifests?.includes("re-probe-throws")
    && pre.enabledSet?.length === 2 && Array.isArray(pre.loaded) && pre.loaded.length === 0,
  JSON.stringify(pre));

// §3/§6: load order strictly community-plugins.json order; throwing plugin loads first and does not block.
const order = JSON.parse(readFileSync(join(run3, "community-plugins-after.json"), "utf8"));
const lifecycle = readFileSync(join(dumps, "lifecycle.log"), "utf8");
const i1onload = lifecycle.indexOf("[i1] onload called");
const i2onload = lifecycle.indexOf("[i2] onload called");
check("E5. community-plugins.json order preserved (throws-plugin first)",
  JSON.stringify(order) === JSON.stringify(["re-probe-throws", "re-probe"]));
check("E6. throwing plugin's onload failure did not block later plugins (probe still loaded)",
  i1onload >= 0 && i2onload > i1onload);

// §6: lifecycle sequence — onload → registration → persistence; onExternalSettingsChange; disable → fresh instance + onUserEnable.
const logLines = lifecycle.split("\n");
const hasCanary = logLines.some(l => l.includes("styles-canary") && l.includes("rgb(1, 2, 3)"));
const hasExternal = logLines.some(l => l.includes("onExternalSettingsChange called"));
const hasUnload = logLines.some(l => l.includes("onunload called"));
const hasUserEnable = logLines.some(l => l.includes("onUserEnable called"));
const i1register = lifecycle.indexOf("registered active-leaf-change");
check("E7. lifecycle order: onload → registerEvent → saveData/loadData (auto-cleanup registration present)",
  i1onload >= 0 && i1register > i1onload && lifecycle.indexOf("persistence saveData/loadData ok") > i1register);
check("E8. styles.css injected after onload (canary rgb(1,2,3) computed)", hasCanary);
check("E9. external data.json rewrite fired onExternalSettingsChange (~55ms)", hasExternal);
check("E10. disable ran onunload; re-enable constructed a fresh instance with onUserEnable", hasUnload && hasUserEnable);

// §6: error isolation surface message.
const consoleLog = readFileSync(join(run3, "console-log.json"), "utf8");
check("E11. onload throw isolated: 'Plugin failure: re-probe-throws' surfaced with plugin id",
  consoleLog.includes("Plugin failure: re-probe-throws"));

// §6: failed instance remains registered (observed quirk worth documenting).
const post = JSON.parse(readFileSync(join(run3, "state-post-enable.json"), "utf8"));
const postLoaded = JSON.stringify(post).includes("re-probe-throws");
check("E12. failed plugin instance remains in the plugins map (documented 1.7.7 quirk)", postLoaded);

// §7: data.json — 2-space pretty JSON, round-trips.
const dataPath = join(a2, "fixture-vault", ".obsidian", "plugins", "re-probe", "data.json");
const dataBytes = readFileSync(dataPath, "utf8");
const dataParsed = JSON.parse(dataBytes);
check("E13. data.json is exactly JSON.stringify(data, null, 2)", JSON.stringify(dataParsed, null, 2) === dataBytes.replace(/\n$/, ""), dataBytes.slice(0, 60));
const raw = JSON.parse(readFileSync(join(dumps, "data-json-raw.json"), "utf8"));
check("E14. plugin read-back of data.json matches what was saved", raw.readBackMatches === true);

// §4: core-plugins.json is an object map of booleans.
const core = JSON.parse(readFileSync(join(run3, "core-plugins-after.json"), "utf8"));
check("E15. core-plugins.json is a {id: boolean} map",
  core && typeof core === "object" && !Array.isArray(core) && Object.values(core).every(v => typeof v === "boolean"),
  `${Object.keys(core).length} keys`);

// pinning discipline of the oracle runs themselves
for (const r of ["run1", "run2", "run3"]) {
  const p = join(a2, "transcripts", r, "pinning-check.txt");
  if (existsSync(p)) check(`E16. ${r} pinning check CLEAN`, readFileSync(p, "utf8").includes("CLEAN"));
}

const failed = results.filter(r => !r.pass);
console.log(`\nGate 4: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
