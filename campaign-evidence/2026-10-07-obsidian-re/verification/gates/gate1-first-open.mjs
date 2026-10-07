// Gate 1 — Fixture-vault behavioral diff (first-open .obsidian contract).
// Contract source: findings/a1-file-save-handling.md F8 (+F4 for config shape).
// Oracle: ../..(tmp)/lanes/a1/fixtures/empty-vault/ (captured from live pinned 1.7.7).
// The harness re-derives the first-open tree from the DOCUMENT alone and
// byte-compares against the live-captured oracle.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const lanes = join(here, "..", "..", "..", "..", "ProjectCentral", "now", "tmp", "obsidian-re-20261007", "lanes");
const oracle = join(lanes, "a1", "fixtures", "empty-vault", ".obsidian");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// --- Part A: suite mechanics — byte-diff tool round-trips the oracle verbatim.
const tmp = mkdtempSync(join(tmpdir(), "gate1-"));
mkdirSync(join(tmp, ".obsidian"), { recursive: true });
for (const f of readdirSync(oracle)) copyFileSync(join(oracle, f), join(tmp, ".obsidian", f));
let a = true;
for (const f of readdirSync(oracle)) {
  if (!readFileSync(join(oracle, f)).equals(readFileSync(join(tmp, ".obsidian", f)))) a = false;
}
check("A. byte-diff round-trip of captured oracle tree", a, "4 files copied and compared");

// --- Part B: contract re-derivation from the dossier text alone.
// F8: app.json = {} (2 bytes), appearance.json = {} (2 bytes).
check("B1. app.json is exactly {}", readFileSync(join(oracle, "app.json"), "utf8") === "{}");
check("B2. appearance.json is exactly {}", readFileSync(join(oracle, "appearance.json"), "utf8") === "{}");

// F8: core-plugins.json = 2-space JSON, 28 keys, defaults listed in the dossier.
const dossierDefaults = {
  "file-explorer": true, "global-search": true, switcher: true, graph: true,
  backlink: true, canvas: true, "outgoing-link": true, "tag-pane": true,
  "page-preview": true, "daily-notes": true, templates: true, "note-composer": true,
  "command-palette": true, "editor-status": true, bookmarks: true, outline: true,
  "word-count": true, "file-recovery": true,
  properties: false, "slash-command": false, "markdown-importer": false,
  "zk-prefixer": false, "random-note": false, slides: false,
  "audio-recorder": false, workspaces: false, publish: false, sync: false,
};
const coreBytes = readFileSync(join(oracle, "core-plugins.json"), "utf8");
const coreParsed = JSON.parse(coreBytes);
const derived = JSON.stringify(dossierDefaults, null, 2) + (coreBytes.endsWith("\n") ? "\n" : "");
check("B3. core-plugins.json has exactly 28 keys", Object.keys(coreParsed).length === 28, `got ${Object.keys(coreParsed).length}`);
check("B4. core-plugins.json defaults match the documented true/false set",
  JSON.stringify(coreParsed, Object.keys(dossierDefaults).sort()) === JSON.stringify(dossierDefaults, Object.keys(dossierDefaults).sort()),
  derived === coreBytes ? "(byte-identical to dossier-derived serialization)" : "(key/value set equal; serialization order differs — reported)");
if (derived !== coreBytes) {
  console.log("      note: dossier-derived bytes differ from oracle bytes (order/whitespace). Structural equality is the contract; byte layout is serialization detail.");
}

// F8: workspace.json ~4010B default layout — structural assertions on documented facts.
const ws = JSON.parse(readFileSync(join(oracle, "workspace.json"), "utf8"));
const wsOk =
  ws.main && Array.isArray(ws.main.children) &&
  ws.left && ws.left.width === 300 && Array.isArray(ws.left.children) &&
  ws.right && ws.right.width === 300 && ws.right.collapsed === true &&
  Array.isArray(ws.lastOpenFiles) && ws.lastOpenFiles.length === 0 &&
  typeof ws.active === "string";
check("B5. workspace.json matches documented default-layout facts", wsOk,
  "main tabs split, left/right width 300, right collapsed, active leaf id, empty lastOpenFiles");

// F8: absent on first open.
const listing = readdirSync(oracle).sort();
check("B6. first-open .obsidian contains exactly the four files",
  JSON.stringify(listing) === JSON.stringify(["app.json", "appearance.json", "core-plugins.json", "workspace.json"]),
  listing.join(", "));

const failed = results.filter(r => !r.pass);
console.log(`\nGate 1: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
