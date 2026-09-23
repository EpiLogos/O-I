#!/usr/bin/env node
/**
 * Receipt lint — DESKTOP-LANGUAGE.md "Owner rulings, 22 September 2026"
 * ruling 8 (with docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §4
 * negative roster item 4): acceptance fixtures derive from the designs, and
 * controlled receipts dressed in acceptance shape are banned.
 *
 * Every committed receipt under walk/artifacts/ and tests/artifacts/ must
 * carry:
 *   spec_ref  the design/spec row it serves (e.g. "docs/cradle/05-EXECUTION.md §3")
 *   grade     the evidence grade it claims:
 *               A = live/installed/native evidence
 *               B = real-kernel walk-bridge evidence
 *               C = contract/static check
 *               D = controlled/fixture evidence
 *
 * Rules enforced:
 *   1. A committed receipt must parse as JSON (merge-conflict markers, for
 *      example, make it not a receipt at all).
 *   2. spec_ref must be a non-empty string and grade one of A/B/C/D.
 *   3. A receipt whose own top-level `standing` (or `classification`) text
 *      matches /controlled/i is forced to grade D regardless of what it
 *      claims. (Only the receipt's own fields count — nested domain data
 *      that happens to contain a `standing` key does not.)
 *   4. An evidence aggregate (a receipt carrying both a `classification` and
 *      a `receipts` array) may not emit passed:true / accepted:true unless at
 *      least one of its input receipts is grade A (live/installed).
 *
 * What counts as a receipt: a JSON file under the scanned trees that is
 * acceptance-shaped — its top-level `schema` names a receipt family, or it
 * carries a top-level acceptance field (passed/standing/classification/grade/
 * accepted/failures/checks/pass, or a recorded `bridge`), or it is named
 * receipt.json or *-native.json. Raw data dumps (file hashes, environment
 * censuses, owned-file lists) are not receipts and are not graded — the lint
 * would otherwise force a grade onto bytes that claim nothing.
 *
 * Usage:
 *   node scripts/receipt-lint.mjs             lint; exit 1 with findings
 *   node scripts/receipt-lint.mjs --backfill  one-shot mechanical backfill:
 *       stamps spec_ref + grade only where the receipt's own content already
 *       supports them —
 *         /controlled/i standing or classification  → grade D (forced)
 *         native-walk receipt families / *-native.json → grade A
 *         standing naming executed native/live observation           → A
 *         recorded kernel bridge (bridge / environment.bridge_url)   → B
 *         anything else receipt-shaped                               → C
 *         spec_ref by scenario name (table kept in sync with
 *         walk/run.mjs SCENARIO_SPEC), else docs/cradle/05-EXECUTION.md §3.
 *       Existing grades are kept unless rule 3 forces D down.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cradleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = ["walk/artifacts", "tests/artifacts"];
const GRADES = ["A", "B", "C", "D"];

// The design/spec row each named scenario serves. Keep in sync with
// walk/run.mjs SCENARIO_SPEC. Everything else serves the constitutional
// basis: walks are the acceptance (05-EXECUTION §3).
const SCENARIO_SPEC = {
  "system-settings": "docs/cradle/06-SYSTEM-SETTINGS.md §7",
  "settings-shell": "docs/cradle/12-SETTINGS.md §1 §3 §4 S1 S3 S10 S11 S14 S15",
  "settings-change": "docs/cradle/12-SETTINGS.md §2 §4 S3 S4 S5 S6 S7 S8 S9",
  "settings-credentials": "docs/cradle/12-SETTINGS.md §3.4 §4 S12 S13",
  "settings-auth": "docs/cradle/12-SETTINGS.md §3.3 §3.4; docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §2a",
  "settings-unreadable": "docs/cradle/12-SETTINGS.md §2 §4 S2",
  configuration: "docs/cradle/09-CONFIGURATION-PLANE.md",
  "factory-development": "docs/experience/FACTORY-AGENCY.md §4/§5/§8/§12",
  "background-completion": "docs/experience/FACTORY-AGENCY.md §1 + handoff §4",
  "lane0-repairs": "docs/cradle/10-SIDEBARS.md §6.1 (2,3,7) §3.6 rule 1; 11-FACTORY.md §4",
  "factory-desk": "docs/cradle/11-FACTORY.md §7 F1 F2 F3 F4 F5",
  "factory-run": "docs/cradle/11-FACTORY.md §7 F6 F7 F8 F12 F13",
  "factory-trajectory": "docs/cradle/11-FACTORY.md §7 F9 F10 F11",
  "factory-tasks": "docs/cradle/11-FACTORY.md §7 F14 F15",
  "factory-objects": "docs/cradle/11-FACTORY.md §6 §7 F16",
  "factory-real": "docs/cradle/11-FACTORY.md §7 F5 F6 F7 F12 (real Central-root runs, read-only)",
  "factory-inhabitation": "docs/contracts/WORLD-INHABITATION-V1.md §3 §4; docs/research/openrig-c8fca9d/CROSSWALK.md §8 §15; docs/cradle/11-FACTORY.md §3.4 §5; 10-SIDEBARS.md §4.5 (live, real Central, read-only)",
  "factory-inhabitation-fixture": "docs/contracts/WORLD-INHABITATION-V1.md §3 §4 (controlled standings and refusals)",
  "left-frame": "docs/cradle/10-SIDEBARS.md §5.1 L1 L2 L3 L4 L5 L6 L8",
  "left-unreadable": "docs/cradle/10-SIDEBARS.md §5.1 L7 · §5.2 R8 R9 R10 R11",
  "left-marks": "docs/cradle/10-SIDEBARS.md §5.2 R1 R2 R3 R4 R5 · §3.3 · §3.5",
  "left-rows": "docs/cradle/10-SIDEBARS.md §5.2 R6 R7 R12 · §3.4 A6",
  "left-head": "docs/cradle/10-SIDEBARS.md §3.1 §3.6 D3 D6 (scope menu, workspace footer, create menu, Inbox, ⌘K typed tabs)",
  "left-lens": "docs/cradle/10-SIDEBARS.md §3.1 D2 A5 (Epi-Logos lens)",
  "left-forms": "docs/cradle/10-SIDEBARS.md §3.7 §6.1.6 D5 (forms create a copy; Goal and Vision in place; Factory INTENT)",
  "left-gallery": "docs/cradle/10-SIDEBARS.md §3 (the left frame in light and dark at 1440 / 1000 / 760)",
  "context-canvas-insert": "docs/cradle/10-SIDEBARS.md §4.6 (Context canvas baseline)",
  "right-panel-frame": "docs/cradle/10-SIDEBARS.md §4.1 §4.2 §5.3 P1 P2 P3 P13 P14 P18; §7 A3",
  "right-panel-turn": "docs/cradle/10-SIDEBARS.md §4.3 §4.4 §5.3 P1 P4 P6 P7 P16",
  "right-panel-agents": "docs/cradle/10-SIDEBARS.md §4.5 §4.7 §5.3 P15 P17 P18; §4.1a A4",
  "right-panel-modes": "docs/cradle/10-SIDEBARS.md §7 A1/A2; §4.1 §4.3 §5.3 P5 P1",
  "right-panel-failures": "docs/cradle/10-SIDEBARS.md §5.3 P8 P9 P10 P11 P12",
  "right-panel-context": "docs/cradle/10-SIDEBARS.md §4.6 (Context launcher)",
  "right-panel-shots": "docs/cradle/10-SIDEBARS.md §4.1 §5.3 (looking pass: light/dark, 1440/1000/760)",
};
const DEFAULT_SPEC_REF = "docs/cradle/05-EXECUTION.md §3";

const RECEIPT_SCHEMA = /(walk|acceptance|native|verif|review|recover|binding|resources|reconcil|attribution)/i;
const ACCEPTANCE_MARKERS = ["passed", "standing", "classification", "grade", "accepted", "failures", "checks", "pass"];
const CONTROLLED = /controlled/i;
// Standing texts that themselves record executed native/live observation.
const NATIVE_STANDING = /^(native app and real|executed-native|native-application-observed)\b|Executed native CUA|hosted SharedField|bounded native regression verified|native Quit cleanup observed|bounded native observations|partial native evidence/i;
const NATIVE_SCHEMAS = new Set([
  "oi.cradle.native-walk/v1",
  "oi.cradle.expression-native-review/v1",
  "oi.cradle-native-verification/v1",
]);

function listJsonFiles(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(path));
    else if (entry.name.endsWith(".json")) out.push(path);
  }
  return out;
}

/** Is this JSON an acceptance-shaped receipt (as opposed to a raw data dump)? */
function isReceipt(obj, file) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  const base = basename(file);
  if (base === "receipt.json" || /-native\.json$/.test(base)) return true;
  if (typeof obj.schema === "string" && RECEIPT_SCHEMA.test(obj.schema)) return true;
  for (const marker of ACCEPTANCE_MARKERS) {
    if (obj[marker] !== undefined) return true;
  }
  if (typeof obj.bridge === "string" && obj.bridge) return true;
  return false;
}

function isAggregate(obj) {
  // An evidence aggregate names what the collection is (classification) and
  // lists its input receipts. A kernel-op `receipts` array inside a probe
  // record is data, not an aggregator.
  return typeof obj?.classification === "string" && Array.isArray(obj?.receipts);
}

function controlledClaim(obj) {
  return (
    (typeof obj.standing === "string" && CONTROLLED.test(obj.standing)) ||
    (typeof obj.classification === "string" && CONTROLLED.test(obj.classification))
  );
}

/** The grade the receipt's own content supports (backfill only; an existing
 * grade is authoritative unless the forced-D rule applies). */
function derivedGrade(obj, file) {
  if (controlledClaim(obj)) return { grade: "D", reason: "standing/classification says controlled (forced)" };
  if (typeof obj.grade === "string") return { grade: obj.grade, reason: "already carried a grade" };
  if (NATIVE_SCHEMAS.has(obj.schema) || /-native\.json$/.test(basename(file))) {
    return { grade: "A", reason: "native-walk receipt family" };
  }
  if (typeof obj.standing === "string" && NATIVE_STANDING.test(obj.standing)) {
    return { grade: "A", reason: "standing records executed native/live observation" };
  }
  const bridge =
    (typeof obj.bridge === "string" && obj.bridge) ||
    (typeof obj.environment?.bridge_url === "string" && obj.environment.bridge_url);
  if (bridge) return { grade: "B", reason: "recorded real-kernel walk bridge" };
  return { grade: "C", reason: "receipt-shaped without kernel/native/live evidence" };
}

function derivedSpecRef(obj) {
  if (typeof obj.spec_ref === "string" && obj.spec_ref) return obj.spec_ref;
  const scenario = typeof obj.scenario === "string" ? obj.scenario : null;
  if (scenario && SCENARIO_SPEC[scenario]) return SCENARIO_SPEC[scenario];
  return DEFAULT_SPEC_REF;
}

function collectReceipts() {
  const receipts = [];
  for (const root of SCAN_ROOTS) {
    const absRoot = join(cradleRoot, root);
    let files;
    try {
      files = listJsonFiles(absRoot);
    } catch {
      continue; // no such tree yet
    }
    for (const file of files) receipts.push({ file, rel: relative(cradleRoot, file) });
  }
  return receipts;
}

/** Lint one parsed receipt; returns a list of finding strings. */
function checkReceipt(obj, rel) {
  const findings = [];
  if (typeof obj.spec_ref !== "string" || !obj.spec_ref) {
    findings.push(`${rel}: missing spec_ref (the design/spec row this receipt serves)`);
  }
  if (!GRADES.includes(obj.grade)) {
    findings.push(`${rel}: missing or invalid grade (${JSON.stringify(obj.grade) ?? "undefined"}; need one of ${GRADES.join("/")})`);
  }
  if (controlledClaim(obj) && obj.grade !== "D") {
    findings.push(`${rel}: standing/classification says controlled — grade forced to D, found ${JSON.stringify(obj.grade)}`);
  }
  if (isAggregate(obj)) {
    const grades = obj.receipts.filter((entry) => typeof entry?.grade === "string").map((entry) => entry.grade);
    if (grades.length !== obj.receipts.length) {
      findings.push(`${rel}: aggregate receipt entries must each carry a grade`);
    }
    const claimsPassed = obj.passed === true || obj.accepted === true;
    if (claimsPassed && !grades.includes("A")) {
      findings.push(`${rel}: aggregate claims passed/accepted without at least one grade-A (live/installed) receipt among its inputs`);
    }
    if (obj.grade !== undefined && !GRADES.includes(obj.grade)) {
      findings.push(`${rel}: aggregate grade must be one of ${GRADES.join("/")}`);
    }
  }
  return findings;
}

function runLint() {
  const findings = [];
  for (const { file, rel } of collectReceipts()) {
    let obj;
    try {
      obj = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      findings.push(`${rel}: unparseable JSON (${String(error.message).slice(0, 80)}) — a committed receipt must parse`);
      continue;
    }
    if (!isReceipt(obj, file)) continue; // data artifact, claims nothing
    findings.push(...checkReceipt(obj, rel));
  }
  if (findings.length) {
    for (const finding of findings) console.error(`receipt-lint: ${finding}`);
    console.error(`receipt-lint: ${findings.length} finding(s). See scripts/receipt-lint.mjs for the law and grade taxonomy.`);
    process.exit(1);
  }
  console.log("receipt-lint: every committed receipt carries spec_ref + grade; no forced or aggregate violations.");
}

function runBackfill() {
  let stamped = 0;
  const unparseable = [];
  for (const { file, rel } of collectReceipts()) {
    let obj;
    try {
      obj = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      unparseable.push(rel);
      continue;
    }
    if (!isReceipt(obj, file)) continue;
    const { grade, reason } = derivedGrade(obj, file);
    const specRef = derivedSpecRef(obj);
    if (obj.spec_ref === specRef && obj.grade === grade) continue;
    // Fields lead the receipt so the diff states the claim it now makes.
    const next = { spec_ref: specRef, grade, ...obj };
    if (controlledClaim(obj)) next.grade = "D"; // forced, even over an existing grade
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`receipt-lint: backfilled ${rel} spec_ref=${specRef} grade=${next.grade} (${reason})`);
    stamped++;
  }
  if (unparseable.length) {
    for (const rel of unparseable) console.error(`receipt-lint: cannot backfill unparseable ${rel}`);
    process.exit(1);
  }
  console.log(`receipt-lint: backfill stamped ${stamped} receipt(s).`);
  runLint();
}

if (process.argv.includes("--backfill")) runBackfill();
else runLint();
