#!/usr/bin/env node
// Expression richness linter — the objective floor for the 2026-10 enrichment pass.
//
// Reports, per journey and in total, how much of the Expression format each
// published member actually uses, and FAILS below the enrichment floor
// (brief §3, 2026-10-06):
//   1. formation sequences on >= 1/3 of scenes; at least one sequence that
//      changes glyph AND object state (position/size/tint), not text alone;
//   2. every adjacent scene pair changes >= 3 settings across >= 2 families
//      (a palette-only change does not count);
//   3. at least one scene in 3d: view.mode "3d", entities distributed in z,
//      and a volume/depth setting authored;
//   4. at least three distinct pointer profiles per journey;
//   5. every scene carries a placed text block (kicker + title + italic),
//      body <= 70 words, blocks do not overlap at 1440x900 or 390x844
//      (heuristic box math; the render pass is the visual truth);
//   6. every distinct formation glyph has a rationale in the member's craft
//      note (glyph_rationales in the binding record);
//   7. at least one automation lane / property track, and beats that differ
//      (>= 2 distinct durations or transitions);
//   8. not `free` layout in every scene.
//
// Usage:
//   node site/tests/expression-richness.mjs [--json] [--stats] [--collection DIR]...
// Collections default to the Return-of-Zero collection in this repo plus the
// Point-Cloud-Demo S-products root (OI_PCD_S_PRODUCTS_ROOT or the sibling
// checkout) when present.

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJourney, DEFAULT_ENGINE_SETTINGS } from "../../packages/oi-design-system/expressions-engine/shell/model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");

const PLACEHOLDER_GLYPHS = new Set(["◉", "●", "○", "·", "•", "?", "∅", "#", "*"]);
const NOTATION_GLYPHS = new Set(["0", "1", "/", "Ø", "x", "X", "−", "-", "+", "=", "∞"]);

// format families for the adjacent-scene change check
const FAMILY_OF = {
  pointer: new Set(["engine.pointerMode", "engine.pointerClick", "engine.pointerClickStrength", "engine.pointerClickRadius", "field.params.pointerStrength", "field.params.pointerRadius", "field.params.pointerFalloff"]),
  resonance: new Set(["engine.resonanceEnabled", "engine.resonatorMode", "engine.autoSweep", "engine.sweepDirection", "field.params.frequency", "field.params.dominance", "field.params.excitation"]),
  relational: new Set(["engine.relationalEnabled", "engine.relationalMode", "engine.mediumEnabled", "engine.mediumDimension", "engine.mediumPlane", "engine.collisionEnabled", "engine.collisionMode", "engine.pairwiseEnabled"]),
  morph: new Set(["engine.morphEnabled", "engine.trajectory", "engine.driveShape", "engine.autoOscillate", "morph.thetaRate", "morph.phiRate", "morph.thetaOffset", "morph.phiOffset", "morph.law", "morph.depth", "morph.dwell"]),
  camera: new Set(["view.mode", "view.yaw", "view.pitch", "view.zoom", "view.panX", "view.panY", "composition.plane", "field.params.depth", "field.params.zConfinement", "engine.volumeEnabled", "engine.volumeProfile", "engine.depthPerspective", "engine.depthOcclusion", "engine.depthTintColor", "engine.vortex3d", "engine.dispersion3d"]),
  colour: new Set(["field.background", "field.palette", "engine.colorMode", "engine.colorEnabled", "engine.inkMode", "engine.dotShape", "engine.fontFamily", "engine.fontWeight"]),
};
const MATERIAL_KEYS = new Set(["count", "size", "sizeBias", "opacity", "roundness", "softness", "irregularity", "elongation", "orientation", "contrast", "densityScale", "densityPhase", "edgeWeight", "halo", "grain", "field.material"]);
function familyOf(key) {
  for (const [family, keys] of Object.entries(FAMILY_OF)) if (keys.has(key)) return family;
  if (key.startsWith("field.params.")) {
    const p = key.slice("field.params.".length);
    if (MATERIAL_KEYS.has(p)) return "material";
    return "physics"; // motion/relational-scalar residue: speed, turbulence, gravity*, curl*, drag…
  }
  if (key.startsWith("entity.force") || key.startsWith("entity.sequence")) return "physics";
  return "other";
}

function flatten(prefix, value, out = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(prefix ? `${prefix}.${k}` : k, v, out);
  } else out[prefix] = value;
  return out;
}
const round = (v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);
function effectiveSettings(scene) {
  const engine = { ...DEFAULT_ENGINE_SETTINGS, ...(scene.engine ?? {}) };
  const flat = flatten("", { engine, "field.params": scene.field?.params ?? {}, view: scene.view ?? {}, composition: { plane: scene.composition?.plane, layout: scene.composition?.layout }, morph: scene.morph ?? {}, "field.background": scene.field?.background, "field.palette": scene.field?.palette, "field.material": scene.field?.material });
  for (const k of Object.keys(flat)) flat[k] = round(flat[k]);
  return flat;
}
function sceneDeltas(a, b) {
  const changes = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changes.push(k);
  return changes;
}

function wordCount(s) { return (s ?? "").trim().split(/\s+/).filter(Boolean).length; }

// Heuristic stage boxes for the text-overlap check. x/y are stage fractions,
// width is px at the authored stage; height is estimated from the string and
// font size. The page keeps long bodies below the field on narrow stages, so
// the narrow check considers kicker+title+italic only.
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
function overlap(a, b) {
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

function glyphsOf(scene) {
  const glyphs = new Set();
  for (const e of scene.entities ?? []) {
    if (e.text) glyphs.add(e.text);
    if (e.sequence?.enabled) for (const st of e.sequence.steps ?? []) if (st.text) glyphs.add(st.text);
  }
  return [...glyphs];
}

function checkJourney(journey, journeyPath) {
  const c = (name, pass, detail) => ({ check: name, pass, detail });
  const findings = [];
  const fail = (name, detail) => findings.push(c(name, false, detail));
  const scenes = journey.scenes ?? [];

  // validity
  try { validateJourney(JSON.parse(JSON.stringify(journey))); } catch (e) { fail("valid", e.message); }

  // 1 — sequences
  const seqScenes = scenes.filter((s) => (s.entities ?? []).some((e) => e.sequence?.enabled && (() => { const gs = new Set((e.sequence.steps ?? []).map((t) => `${t.text}\u0000${t.shape}`)); return gs.size >= 2; })()));
  const morphSeq = scenes.some((s) => (s.entities ?? []).some((e) => e.sequence?.enabled && (e.sequence.steps ?? []).some((st) => st.objectState && (st.position || (st.objectState.size && (st.objectState.size.x !== undefined)) || st.objectState.tint !== undefined))));
  const seqNeed = Math.max(1, Math.ceil(scenes.length / 3));
  if (seqScenes.length < seqNeed) fail("sequences", `${seqScenes.length}/${scenes.length} scenes carry multi-glyph sequences (floor ${seqNeed})`);
  if (!morphSeq) fail("sequences", "no sequence changes glyph AND object state (position/size/tint)");

  // 2 — adjacent-scene multi-family change
  const settings = scenes.map(effectiveSettings);
  let weakPair = null;
  for (let i = 1; i < scenes.length; i++) {
    const changes = sceneDeltas(settings[i - 1], settings[i]).filter((k) => familyOf(k) !== "other" || k.startsWith("field.params."));
    const families = new Set(changes.map(familyOf));
    if (changes.length < 3 || families.size < 2) { weakPair = { at: i, changes: changes.length, families: [...families] }; break; }
  }
  if (weakPair) fail("scene-change", `scenes ${weakPair.at - 1}->${weakPair.at}: ${weakPair.changes} settings across ${weakPair.families.length} family/families (${weakPair.families.join(",") || "none"})`);

  // 3 — 3d
  const scenes3d = scenes.filter((s) => s.view?.mode === "3d" && (s.entities ?? []).some((e) => (e.position?.z ?? 0) !== 0) && ["volumeEnabled", "volumeProfile", "depthPerspective", "depthOcclusion", "depthTintColor"].some((k) => k in (s.engine ?? {})));
  if (!scenes3d.length) fail("3d", "no scene is 3d with z-distributed entities and authored depth/volume");

  // 4 — pointer profiles
  const profiles = new Set(scenes.map((s) => { const e = { ...DEFAULT_ENGINE_SETTINGS, ...(s.engine ?? {}) }; return `${e.pointerMode}/${e.pointerClick}/${e.pointerClickStrength}/${e.pointerClickRadius}`; }));
  if (profiles.size < 3) fail("pointer", `${profiles.size} distinct pointer profiles (floor 3)`);

  // 5 — text blocks
  let textScenes = 0, longBody = null, overlapHit = null, smallSizes = new Set();
  for (const s of scenes) {
    const items = (s.text ?? []).filter((t) => t.visible !== false && (t.kicker || t.title || t.italic || t.body));
    const full = items.filter((t) => t.kicker && t.title && t.italic);
    if (full.length) textScenes++;
    for (const t of items) {
      smallSizes.add(t.size ?? 28);
      if (wordCount(t.body) > 70 && !longBody) longBody = `${s.id}/${t.id}: ${wordCount(t.body)} words`;
    }
    const rectsN = items.map((t) => textRect(t, 390, 844, true));
    const rectsW = items.map((t) => textRect(t, 1440, 900, false));
    for (const [rects, label] of [[rectsN, "390x844"], [rectsW, "1440x900"]]) {
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        if (overlap(rects[i], rects[j]) > 140 && !overlapHit) overlapHit = `${s.id}: blocks ${items[i].id}+${items[j].id} overlap at ${label}`;
      }
    }
  }
  if (textScenes < scenes.length) fail("text", `${textScenes}/${scenes.length} scenes carry kicker+title+italic`);
  if (longBody) fail("text", `body over 70 words at ${longBody}`);
  if (overlapHit) fail("text", overlapHit);
  if (smallSizes.size < 2) fail("text", "no size hierarchy (one text size across the journey)");

  // 6 — glyph rationales
  const binding = findBinding(journeyPath);
  const rationales = new Map(Object.entries(binding?.glyph_rationales ?? {}));
  const noteText = [binding?.notes].flat(Infinity).filter((s) => typeof s === "string").join("\n") + "\n" + JSON.stringify(binding?.glyph_rationales ?? {});
  const used = new Set(scenes.flatMap(glyphsOf));
  const unexplained = [...used].filter((g) => !rationales.has(g) && !noteText.includes(g));
  const placeholders = [...used].filter((g) => g.length <= 2 && (PLACEHOLDER_GLYPHS.has(g) || (NOTATION_GLYPHS.has(g) && !rationales.has(g) && !noteText.includes(g))));
  if (!binding) fail("glyphs", "no craft note (binding record) beside the journey");
  else {
    if (unexplained.length) fail("glyphs", `glyphs without rationale: ${unexplained.map((g) => JSON.stringify(g)).join(", ").slice(0, 300)}`);
    if (placeholders.length) fail("glyphs", `placeholder glyphs: ${placeholders.map((g) => JSON.stringify(g)).join(", ")}`);
  }

  // 7 — automation / time
  const autoScenes = scenes.filter((s) => (s.automation?.length ?? 0) > 0 || (s.propertyTracks?.length ?? 0) > 0);
  const durations = new Set(scenes.map((s) => s.duration));
  const transitions = new Set(scenes.map((s) => s.transition));
  if (!autoScenes.length) fail("automation", "no automation lane or property track");
  if (durations.size < 2 && transitions.size < 2) fail("automation", "one duration and one transition across the journey (no narrative beats)");

  // 8 — layout
  const laidOut = scenes.filter((s) => s.composition?.layout && s.composition.layout !== "free");
  if (!laidOut.length) fail("layout", "every scene is layout free");

  return { findings, stats: { scenes: scenes.length, seqScenes: seqScenes.length, scenes3d: scenes3d.length, profiles: profiles.size, autoScenes: autoScenes.length, laidOut: laidOut.length } };
}

// ---------- corpus stats (the section-1 table, recomputed) ----------
function corpusStats(entries) {
  const paramValueCounts = {};
  const engineValueCounts = {};
  const glyphHist = {};
  let scenes = 0, entities = 0, seqEntities = 0, multiGlyphEntities = 0, entitiesZ = 0, scenes3d = 0, autoScenes = 0, textEntities = 0, strongForces = 0;
  const layouts = {};
  let journeysChanging = 0;
  for (const { journey } of entries) {
    let changed = false;
    let prevSettings = null;
    for (const s of journey.scenes ?? []) {
      scenes++;
      const settings = effectiveSettings(s);
      if (prevSettings && sceneDeltas(prevSettings, settings).some((k) => familyOf(k) !== "other")) changed = true;
      prevSettings = settings;
      for (const [k, v] of Object.entries(s.field?.params ?? {})) {
        paramValueCounts[k] ??= new Map();
        paramValueCounts[k].set(JSON.stringify(v), (paramValueCounts[k].get(JSON.stringify(v)) ?? 0) + 1);
      }
      for (const [k, v] of Object.entries({ ...DEFAULT_ENGINE_SETTINGS, ...(s.engine ?? {}) })) {
        engineValueCounts[k] ??= new Map();
        engineValueCounts[k].set(JSON.stringify(v), (engineValueCounts[k].get(JSON.stringify(v)) ?? 0) + 1);
      }
      if (s.view?.mode === "3d") scenes3d++;
      if ((s.automation?.length ?? 0) > 0 || (s.propertyTracks?.length ?? 0) > 0) autoScenes++;
      layouts[s.composition?.layout ?? "free"] = (layouts[s.composition?.layout ?? "free"] ?? 0) + 1;
      for (const e of s.entities ?? []) {
        entities++;
        if ((e.text ?? "").length > 1 || (e.text ?? "").length === 1) { if (e.text && [...e.text].length > 1 || /\s/.test(e.text ?? "")) textEntities++; }
        if (e.sequence?.enabled) {
          seqEntities++;
          const gs = new Set((e.sequence.steps ?? []).map((t) => t.text));
          if (gs.size > 1) multiGlyphEntities++;
        }
        if ((e.position?.z ?? 0) !== 0) entitiesZ++;
        if ((e.force?.strength ?? 0) > 0) strongForces++;
        for (const g of glyphsOf(s)) if (g.length <= 2) glyphHist[g] = (glyphHist[g] ?? 0) + 1;
      }
    }
    if (changed) journeysChanging++;
  }
  return { scenes, entities, seqEntities, multiGlyphEntities, entitiesZ, scenes3d, autoScenes, textEntities, strongForces, journeysChanging, layouts, glyphHist,
    paramSpread: Object.fromEntries(Object.entries(paramValueCounts).map(([k, m]) => [k, m.size]).sort((a, b) => b[1] - a[1])),
    engineSpread: Object.fromEntries(Object.entries(engineValueCounts).map(([k, m]) => [k, m.size])) };
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
const collections = [...collectionArgs, ...posArgs, ...defaultCollections].filter((d) => existsSync(d));

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
  if (loadError || !journey) return { file, collection, id: null, ok: false, findings: [c("load", false, loadError ?? "unreadable")], stats: { scenes: 0 } };
  const { findings, stats } = checkJourney(journey, file);
  return { file: relative(REPO, file) ?? file, collection, id: journey.id, name: journey.name, ok: findings.every((f) => f.pass), findings, stats };
});

const passed = results.filter((r) => r.ok).length;
const stats = corpusStats(entries.filter((e) => e.journey));

if (asJson) {
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), collections: collections.map((c) => relative(REPO, c) ?? c), skipped, totals: { journeys: results.length, passed, failed: results.length - passed }, corpus: stats, results }, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id ?? "?"}  ${r.file}`);
    for (const f of r.findings.filter((x) => !x.pass)) console.log(`      ✗ ${f.check}: ${f.detail}`);
  }
  console.log(`\n${passed}/${results.length} journeys meet the enrichment floor.`);
  if (asStats) {
    console.log(`\ncorpus: ${stats.scenes} scenes, ${stats.entities} entities`);
    console.log(`sequences: ${stats.seqEntities} entities (${stats.multiGlyphEntities} multi-glyph) | 3d scenes: ${stats.scenes3d} | entities with z: ${stats.entitiesZ}`);
    console.log(`automation scenes: ${stats.autoScenes} | forces with strength>0: ${stats.strongForces} | journeys changing between scenes: ${stats.journeysChanging}/${results.length}`);
    console.log(`layouts:`, stats.layouts);
    console.log(`short-glyph histogram:`, Object.fromEntries(Object.entries(stats.glyphHist).sort((a, b) => b[1] - a[1]).slice(0, 12)));
    console.log(`param spread (distinct values):`, stats.paramSpread);
    console.log(`engine spread (distinct values):`, stats.engineSpread);
  }
}
if (skipped.length) console.error(`skipped (no journeys found): ${skipped.join(", ")}`);
process.exitCode = passed === results.length ? 0 : 1;
