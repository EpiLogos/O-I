#!/usr/bin/env node
// Expression craft gate — the law for the 2026-10-07 rework pass.
//
// This replaces the 2026-10-06 "enrichment floor", whose quotas mandated the
// failure they meant to prevent: a text block on every scene filled the stage
// with citations and routing, per-pair change quotas outlawed stillness, and
// a word swelling into another word counted as "glyph AND object state".
// Four passes of that produced a corpus that is 93% word-glyphs with one
// background per journey. That floor is gone; the law replacing it:
//
//   TEXT IS THE MINIMUM FORM. Any image or glyph can be used. Genuine
//   creativity is required, not optional.
//
// What this gate checks objectively (the critic's eye is the primary
// acceptance; this gate is the plumbing it stands on):
//
//   1. carriers       — every scene is drawn with at least one non-text
//                       formation; ≥ half of a journey's formations are
//                       non-text (ascii, image, geometry, …); formation text
//                       may be notation (≤3 chars) or a single sign-name, never
//                       a sentence; no yantra formations.
//   2. colour         — the journey moves through colour: ≥3 distinct
//                       backgrounds and a palette or tint set that travels.
//   3. rest           — stillness is lawful and required: ≥1/3 of adjacent
//                       scene pairs change no engine/field/view settings.
//                       Motion needs a reason; rest does not.
//   4. scale          — the engine's size normalisation stays on: no scene
//                       disables autoFitSizes; the engine sizes each glyph.
//   5. stage text     — hospitable only: ≤120 words of visible stage text per
//                       journey; no metadata on stage (citations, file paths,
//                       routing words, "Source of record"); text blocks clear
//                       the formations' boxes at 1440×900 and 390×844.
//   6. accountability — every distinct glyph (formation text, or a non-text
//                       formation's name) carries a rationale in the binding's
//                       glyph_rationales; no placeholder glyphs; the binding
//                       record exists.
//   7. renderable     — within the authoring/capture ceiling (≤10 formations,
//                       ≤8 pins per scene); validateJourney clean.
//
// Usage:
//   node site/tests/expression-richness.mjs [--json] [--stats] [--collection DIR]...
// Collections default to the Return-of-Zero collection in this repo plus the
// Point-Cloud-Demo S-products root (OI_PCD_S_PRODUCTS_ROOT or the sibling
// checkout) when present.

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJourney } from "../../packages/oi-design-system/expressions-engine/shell/model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");

const PLACEHOLDER_GLYPHS = new Set(["◉", "●", "○", "·", "•", "?", "∅", "#", "*"]);
const BANNED_SHAPES = new Set(["yantra"]);
const METADATA_RE = /(^|\s)(q\d{3}\b|Met\.\s*\d|Source of record|submission-package|previous\b|next\b|related\b|In the essay)|^#\d+\s*·|\.(md|json|mjs)\b|\/[a-z-]+\/[a-z-]+/i;

function wordCount(s) { return (s ?? "").trim().split(/\s+/).filter(Boolean).length; }

// Heuristic stage boxes for the text-clears-formations check. x/y are stage
// fractions, width is px at the authored stage; height is estimated from the
// string and font size. The narrow stage keeps long bodies below the field.
function textRect(item, stageW, stageH, narrow) {
  const size = item.size ?? 28;
  const widthPx = Math.min(item.width ?? 340, narrow ? stageW * 0.92 : stageW);
  const body = narrow ? "" : (item.body ?? "");
  const charsPerLine = Math.max(8, widthPx / (size * 0.52));
  const lines = (s) => Math.max(1, Math.ceil((s ?? "").length / charsPerLine));
  const lineH = size * 1.25;
  const kickerSize = size * 0.42, italicSize = size * 0.62;
  const h = (item.kicker ? kickerSize * 1.6 : 0) + (item.title ? lines(item.title) * lineH : 0) + (item.italic ? lines(item.italic) * italicSize * 1.35 : 0) + (body ? lines(body) * size * 0.85 * 1.5 : 0);
  const x = item.x * stageW, y = item.y * stageH;
  return { x, y, w: widthPx, h };
}
function entityRect(e, stageW, stageH) {
  const p = e.position ?? { x: 0.5, y: 0.5 };
  const s = e.size ?? { x: 0.2, y: 0.1 };
  const w = (typeof s.x === "number" ? s.x : 0.2) * stageW;
  const h = (typeof s.y === "number" ? s.y : 0.1) * stageH;
  return { x: p.x * stageW - w / 2, y: p.y * stageH - h / 2, w, h };
}
function overlapArea(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

function findBinding(journeyPath) {
  const base = journeyPath.replace(/\.journey\.json$/, "");
  for (const candidate of [`${base}.binding.json`, join(dirname(journeyPath), "bindings", `${base.split("/").pop()}.binding.json`), join(dirname(dirname(journeyPath)), "bindings", `${base.split("/").pop()}.binding.json`)]) {
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, "utf8"));
  }
  return null;
}

const isTextFormation = (e) => e.shape === "text" || (!e.shape && e.text);
const formationGlyph = (e) => (e.text ?? "").trim();

function checkJourney(journey, journeyPath) {
  const fail = (name, detail) => { findings.push({ check: name, pass: false, detail }); };
  const findings = [];
  const scenes = journey.scenes ?? [];

  // validity
  try { validateJourney(JSON.parse(JSON.stringify(journey))); } catch (e) { fail("valid", e.message); }

  // renderability: the authoring/capture app refuses >10 formations / >8 pins per scene
  for (const s of scenes) {
    const forms = (s.entities ?? []).filter((e) => e.kind === "formation").length;
    const pins = (s.entities ?? []).filter((e) => e.kind === "pin").length;
    if (forms > 10 || pins > 8) fail("renderable", `${s.id}: ${forms} formations / ${pins} pins — the authoring app refuses over 10/8`);
  }

  // 1 — carriers: text is the minimum form
  let entities = 0, nonText = 0, sentence = null, yantra = null;
  const scenesWithoutMark = [];
  for (const s of scenes) {
    const es = s.entities ?? [];
    const forms = es.filter((e) => e.kind === "formation");
    const marks = forms.filter((e) => !isTextFormation(e));
    entities += forms.length; nonText += marks.length;
    if (forms.length && !marks.length) scenesWithoutMark.push(s.id);
    for (const e of forms) {
      if (BANNED_SHAPES.has(e.shape) && !yantra) yantra = `${s.id}/${e.name ?? e.id}: ${e.shape}`;
      const g = formationGlyph(e);
      if (isTextFormation(e) && g.length > 3 && g.includes(" ") && !sentence) sentence = `${s.id}: ${JSON.stringify(g)} — a sentence is not a glyph`;
    }
  }
  if (scenesWithoutMark.length) fail("carriers", `scenes drawn with text only (no non-text formation): ${scenesWithoutMark.slice(0, 6).join(", ")}${scenesWithoutMark.length > 6 ? ` +${scenesWithoutMark.length - 6}` : ""}`);
  const nonTextShare = entities ? nonText / entities : 0;
  if (entities && nonTextShare < 0.5) fail("carriers", `only ${Math.round(nonTextShare * 100)}% of formations are non-text (floor 50% — text is the minimum form; draw the rest: ascii, image, geometry, anything but sentences)`);
  if (sentence) fail("carriers", sentence);
  if (yantra) fail("carriers", yantra);

  // 2 — colour journey
  const backgrounds = new Set(scenes.map((s) => (s.field?.background ?? "").toLowerCase()).filter(Boolean));
  const palettes = new Set(scenes.map((s) => JSON.stringify((s.field?.palette ?? []).map((x) => (x ?? "").toLowerCase()))).filter((p) => p !== "[]"));
  const tints = new Set(scenes.flatMap((s) => (s.entities ?? []).map((e) => (e.tint ?? "").toLowerCase())).filter(Boolean));
  if (backgrounds.size < Math.min(3, scenes.length)) fail("colour", `${backgrounds.size} distinct background(s) across ${scenes.length} scenes (the journey must move through colour)`);
  if (palettes.size < 2 && tints.size < 3) fail("colour", `${palettes.size} palette(s), ${tints.size} tint(s) — particle colour must travel too`);

  // 3 — rest: stillness is lawful and required
  const sig = (s) => JSON.stringify({ e: s.engine ?? {}, f: { background: s.field?.background, palette: s.field?.palette, params: s.field?.params ?? {} }, v: s.view ?? {}, m: s.morph ?? {} });
  let stillPairs = 0, pairs = 0;
  for (let i = 1; i < scenes.length; i++) { pairs++; if (sig(scenes[i - 1]) === sig(scenes[i])) stillPairs++; }
  const stillFloor = Math.ceil(pairs / 3);
  if (pairs > 0 && stillPairs < stillFloor) fail("rest", `${stillPairs}/${pairs} adjacent pairs are still (floor ${stillFloor} — rest is part of the composition; motion needs a reason, stillness does not)`);

  // 4 — scale: the engine sizes each glyph
  for (const s of scenes) {
    if (s.engine && "autoFitSizes" in s.engine && s.engine.autoFitSizes === false) { fail("scale", `${s.id}: autoFitSizes disabled — size normalisation is the engine's job; compose within it`); break; }
  }

  // 5 — stage text: hospitable only
  let words = 0, metadata = null, overlapHit = null;
  for (const s of scenes) {
    const items = (s.text ?? []).filter((t) => t && t.visible !== false && (t.kicker || t.title || t.italic || t.body));
    const ents = (s.entities ?? []).filter((e) => e.position && e.kind === "formation");
    for (const t of items) {
      words += wordCount([t.kicker, t.title, t.italic, t.body].filter(Boolean).join(" "));
      if (!metadata) {
        const blob = [t.kicker, t.title, t.italic, t.body].filter(Boolean).join(" · ");
        if (METADATA_RE.test(blob)) metadata = `${s.id}/${t.id}: ${JSON.stringify(blob.slice(0, 80))} — metadata lives in the binding and the field's connections panel, not on the stage`;
      }
    }
    for (const t of items) {
      for (const [w, h, narrow] of [[1440, 900, false], [390, 844, true]]) {
        const tr = textRect(t, w, h, narrow);
        for (const e of ents) {
          if (overlapArea(tr, entityRect(e, w, h)) > 140 * (narrow ? 40 : 90) && !overlapHit) overlapHit = `${s.id}: text ${t.id} sits on formation ${e.name ?? e.id} at ${w}x${h}`;
          if (overlapHit) break;
        }
        if (overlapHit) break;
      }
      if (overlapHit) break;
    }
  }
  if (words > 120) fail("stage-text", `${words} words of visible stage text (budget 120 — the field carries the words; the stage carries the sign)`);
  if (metadata) fail("stage-text", metadata);
  if (overlapHit) fail("stage-text", overlapHit);

  // 6 — accountability: every glyph has a rationale
  const binding = findBinding(journeyPath);
  const rationales = new Map(Object.entries(binding?.glyph_rationales ?? {}));
  const noteLines = [binding?.notes].flat(Infinity).filter((x) => typeof x === "string").flatMap((x) => x.split("\n")).map((l) => l.trim());
  const hasRationale = (g) => rationales.has(g) || noteLines.some((l) => l.startsWith(g) && /^([\s:,—–-]|$)/.test(l.slice(g.length)));
  const used = new Set();
  for (const s of scenes) for (const e of s.entities ?? []) {
    const g = formationGlyph(e);
    if (g) used.add(g);
    else if (e.kind === "formation" && e.name) used.add(e.name);
    if (e.sequence?.enabled) for (const st of e.sequence.steps ?? []) { const sg = (st.text ?? "").trim(); if (sg) used.add(sg); }
  }
  const unexplained = [...used].filter((g) => !hasRationale(g));
  const placeholders = [...used].filter((g) => g.length <= 2 && PLACEHOLDER_GLYPHS.has(g) && !hasRationale(g));
  if (!binding) fail("accountability", "no craft note (binding record) beside the journey");
  else {
    if (unexplained.length) fail("accountability", `glyphs without rationale: ${unexplained.map((g) => JSON.stringify(g)).join(", ").slice(0, 300)}`);
    if (placeholders.length) fail("accountability", `placeholder glyphs: ${placeholders.map((g) => JSON.stringify(g)).join(", ")}`);
  }

  return { findings, stats: { scenes: scenes.length, entities, nonText, backgrounds: backgrounds.size, palettes: palettes.size, tints: tints.size, stillPairs, pairs, stageWords: words } };
}

// ---------- discovery ----------
function journeyFilesIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".journey.json")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// ---------- main ----------
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const asStats = args.includes("--stats");
const collectionArgs = args.filter((a) => a.startsWith("--collection")).flatMap((a) => [a.split("=")[1]].filter(Boolean));
const posArgs = args.filter((a) => !a.startsWith("--"));
const defaultCollections = [join(REPO, "desktop/cradle/expressions-app/collections/return-of-zero")];
const pcd = process.env.OI_PCD_S_PRODUCTS_ROOT ?? join(REPO, "../Point-Cloud-Demo/production/s-products");
if (existsSync(pcd)) defaultCollections.push(resolve(pcd));
const explicit = [...collectionArgs, ...posArgs].filter((d) => existsSync(d));
const collections = explicit.length ? explicit : defaultCollections.filter((d) => existsSync(d));

const entries = [];
const skipped = [];
for (const dir of collections) {
  const files = journeyFilesIn(dir);
  if (!files.length) skipped.push(dir);
  for (const f of files) {
    let journey = null, loadError = null;
    try { journey = JSON.parse(readFileSync(f, "utf8")); } catch (e) { loadError = e.message; }
    entries.push({ file: f, collection: relative(REPO, dir).split("/").includes("collections") ? relative(REPO, dir) : dir, journey, loadError });
  }
}

const results = entries.map(({ file, collection, journey, loadError }) => {
  if (loadError || !journey) return { file, collection, id: null, ok: false, findings: [{ check: "load", pass: false, detail: loadError ?? "unreadable" }], stats: { scenes: 0 } };
  const { findings, stats } = checkJourney(journey, file);
  return { file: relative(REPO, file) ?? file, collection, id: journey.id, name: journey.name, ok: findings.every((f) => f.pass), findings, stats };
});

const passed = results.filter((r) => r.ok).length;

if (asJson) {
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), collections: collections.map((c) => relative(REPO, c) ?? c), skipped, totals: { journeys: results.length, passed, failed: results.length - passed }, results }, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id ?? "?"}  ${r.file}`);
    for (const f of r.findings.filter((x) => !x.pass)) console.log(`      ✗ ${f.check}: ${f.detail}`);
  }
  console.log(`\n${passed}/${results.length} journeys meet the craft law.`);
  if (asStats) {
    const t = results.reduce((a, r) => ({ scenes: a.scenes + (r.stats.scenes || 0), nonText: a.nonText + (r.stats.nonText || 0), entities: a.entities + (r.stats.entities || 0), words: a.words + (r.stats.stageWords || 0) }), { scenes: 0, nonText: 0, entities: 0, words: 0 });
    console.log(`\ncorpus: ${t.scenes} scenes, ${t.entities} formations (${Math.round((100 * t.nonText) / Math.max(1, t.entities))}% non-text), ${t.words} words of stage text`);
  }
}
if (skipped.length) console.error(`skipped (no journeys found): ${skipped.join(", ")}`);
process.exitCode = passed === results.length ? 0 : 1;
