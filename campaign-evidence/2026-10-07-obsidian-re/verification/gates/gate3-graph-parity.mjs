// Gate 3 — Graph parity.
// Contract source: findings/a3-graph-links.md F1–F6 (resolution rule chain,
// cache shapes, graph node/edge/orphan semantics with 1.7.7 default options).
// Oracles: lanes/a3/dump/a3-metadata-dump.json (CDP dump from live pinned
// 1.7.7 renderer) and lanes/a3/dump/graph-links-live.txt (19 live edges).
// The parser + resolver + graph builder below are written from the DOSSIER
// rules alone, run over lanes/a3/fixture-vault/, and compared against both.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lanes = join(here, "..", "..", "..", "..", "ProjectCentral", "now", "tmp", "obsidian-re-20261007", "lanes");
const vault = join(lanes, "a3", "fixture-vault");
const dump = JSON.parse(readFileSync(join(lanes, "a3", "dump", "a3-metadata-dump.json"), "utf8"));
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// ---------- index ----------
function walk(dir, base = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".obsidian") continue;
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
const allFiles = walk(vault);
const mdFiles = allFiles.filter(p => p.toLowerCase().endsWith(".md"));
// basename multimap keyed by lowercased basename incl. extension (F4 step 4)
const byBase = new Map();
for (const p of allFiles) {
  const base = p.slice(p.lastIndexOf("/") + 1).toLowerCase();
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(p);
}

// ---------- parse (F1/F5: links, embeds, frontmatter links) ----------
function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const fm = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1).split(",").map(s => s.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
    } else {
      v = v.replace(/^"(.*)"$/, "$1");
    }
    fm[m[1].toLowerCase()] = v;
  }
  return fm;
}
function collectLinks(text) {
  const links = [], embeds = [];
  const re = /(!?\[\[([^\[\]]+?)\]\])|(\[[^\]]*\]\(([^)]+)\))/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[2] !== undefined) {
      const target = m[2].split("|")[0]; // alias split on first | (F1)
      (m[1].startsWith("!") ? embeds : links).push(target);
    } else if (m[4] !== undefined) {
      const href = decodeURI(m[4]);
      if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("#")) links.push(href); // internal md link (F1)
    }
  }
  return { links, embeds };
}
function frontmatterLinks(fm) {
  const out = [];
  const walkVal = (v) => {
    if (typeof v === "string") { if (/^\[\[[^\[\]]*\]\]$/.test(v.trim())) out.push(v.trim().slice(2, -2)); }
    else if (Array.isArray(v)) v.forEach(walkVal);
    else if (v && typeof v === "object") Object.values(v).forEach(walkVal);
  };
  Object.values(fm).forEach(walkVal);
  return out;
}

// ---------- resolve (F4 rule chain) ----------
function normRel(folder, lp) {
  const segs = (folder ? folder + "/" : "") + lp;
  const out = [];
  for (const seg of segs.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") out.pop(); else out.push(seg);
  }
  return out.join("/");
}
// stripSubpath=false replays the RAW getFirstLinkpathDest (probe oracle):
// the pipeline strips the subpath before this function; a '#…' text handed
// straight to it must fail basename lookup (live: '#Head' → null).
function resolveLink(source, linktext, stripSubpath = true) {
  const path = stripSubpath ? linktext.split("#")[0] : linktext; // subpath strip (F4 step 1)
  if (path === "") return source;      // empty → self (step 2)
  const lower = path.toLowerCase();
  const folder = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
  const hasFolder = lower.includes("/");
  const base = lower.slice(lower.lastIndexOf("/") + 1);
  let candidates = base.includes(".") ? (byBase.get(base) ?? []) : [];
  let appended = false;
  if (candidates.length === 0 || !base.includes(".")) {
    candidates = byBase.get(base + ".md") ?? [];
    appended = true;
  }
  if (candidates.length === 0) return null; // unresolved (step 6)
  const eff = lower + (appended ? ".md" : "");
  if (!hasFolder && candidates.length === 1) return candidates[0]; // step 7
  if (lower.startsWith("./") || lower.startsWith("../")) {          // step 8
    const joined = normRel(folder, lower).replace(/\.md$/, "") ; // compare via endsWith below
    const joinedFull = normRel(folder, eff);
    return candidates.find(c => c.toLowerCase() === joinedFull) ?? null;
  }
  if (path.startsWith("/")) {                                       // steps 9–10
    const full = eff.slice(1);
    return candidates.find(c => c.toLowerCase() === full) ?? null;
  }
  const exact = candidates.find(c => c.toLowerCase() === eff);      // step 9
  if (exact) return exact;
  const ends = candidates.filter(c => c.toLowerCase().endsWith("/" + eff) || c.toLowerCase() === eff);
  const inFolder = ends.filter(c => {                               // step 11
    const cf = c.includes("/") ? c.slice(0, c.lastIndexOf("/")) : "";
    return folder === "" ? cf === "" : cf.toLowerCase() === folder.toLowerCase();
  });
  const pool = inFolder.length ? inFolder : ends;
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.length - b.length); // shortest path first
  return pool[0];
}
function unresolvedKey(linktext) { // F4: subpath stripped, alias dropped, .md stripped iff md ext, case preserved
  let key = linktext.split("#")[0].split("|")[0];
  if (/\.md$/i.test(key)) key = key.slice(0, -3);
  return key;
}
const resolvePipelineStrip = (linktext) => linktext.split("#")[0]; // F4 step 1

// ---------- build caches ----------
const resolved = {}, unresolved = {}, perFileLinks = {};
for (const src of mdFiles) {
  const raw = readFileSync(join(vault, src), "utf8");
  // strip the frontmatter block before body scanning: frontmatter links are
  // collected separately (worker parses them from the YAML, not the body)
  const body = raw.startsWith("---\n") ? raw.slice(raw.indexOf("\n---", 4) + 4) : raw;
  const fm = parseFrontmatter(raw);
  const { links, embeds } = collectLinks(body);
  const all = [...frontmatterLinks(fm), ...links, ...embeds]; // F4: frontmatter links count
  perFileLinks[src] = all;
  resolved[src] = {}; unresolved[src] = {};
  for (const l of all) {
    const dest = resolveLink(src, l);
    if (dest) resolved[src][dest] = (resolved[src][dest] ?? 0) + 1;
    else {
      const k = unresolvedKey(l);
      unresolved[src][k] = (unresolved[src][k] ?? 0) + 1;
    }
  }
}

// ---------- comparisons ----------
// key-order canonicalization: Obsidian's index insertion order (creation
// order) differs from any deterministic walk; the contract is the mapping.
const canon = (x) => Array.isArray(x) ? x.map(canon)
  : (x && typeof x === "object") ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])]))
  : x;
const deepEq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
check("D1. resolvedLinks map identical to live dump (all 12 sources, occurrence counts)",
  deepEq(resolved, dump.resolvedLinks),
  deepEq(resolved, dump.resolvedLinks) ? "" : diffSummary(resolved, dump.resolvedLinks));
check("D2. unresolvedLinks map identical to live dump (keys case-preserved, .md stripped iff md)",
  deepEq(unresolved, dump.unresolvedLinks),
  deepEq(unresolved, dump.unresolvedLinks) ? "" : diffSummary(unresolved, dump.unresolvedLinks));

// probes: 37 getFirstLinkpathDest cases recorded live. The pipeline strips
// the subpath BEFORE calling the resolver; a probe whose linktext STARTS with
// '#'. reaches the raw resolver un-stripped and must fail there (live:
// '#Head' → null), while the pipeline's bare '[[#Section]]' resolves to self.
let probePass = 0, probeFail = [];
for (const p of dump.probes) {
  const mine = p.linktext.startsWith("#")
    ? resolveLink(p.source, p.linktext, false)
    : resolveLink(p.source, resolvePipelineStrip(p.linktext));
  const want = p.dest ?? null;
  if (mine === want || (mine && want && mine.toLowerCase() === want.toLowerCase())) probePass++;
  else probeFail.push(`${p.source} [[${p.linktext}]] → mine=${mine} live=${p.dest}`);
}
check("D3. all 37 recorded getFirstLinkpathDest probes reproduce", probePass === dump.probes.length,
  probePass + "/" + dump.probes.length + (probeFail.length ? "; fails: " + probeFail.join(" | ") : ""));

// backlinks: invert resolved, compare source sets + counts per destination
let blOk = true, blDetail = "";
const myBacklinks = {};
for (const [s, targets] of Object.entries(resolved))
  for (const [t, n] of Object.entries(targets)) (myBacklinks[t] ??= {})[s] = n;
for (const [dest, sources] of Object.entries(dump.backlinks)) {
  const mine = myBacklinks[dest] ?? {};
  const want = Object.fromEntries(Object.entries(sources).map(([s, refs]) => [s, Array.isArray(refs) ? refs.length : refs]));
  if (!deepEq(mine, want)) { blOk = false; blDetail += `${dest}: mine=${JSON.stringify(mine)} live=${JSON.stringify(want)}; `; }
}
check("D4. backlinks (inverted resolved, occurrence counts) match live dump", blOk, blDetail);

// graph with 1.7.7 default options (F6): showTags=false, showAttachments=false,
// hideUnresolved=false, showOrphans=true (kept)
const mdSet = new Set(mdFiles);
const nodes = new Set(mdFiles);
const edges = new Set();
for (const [s, targets] of Object.entries(resolved))
  for (const t of Object.keys(targets)) if (mdSet.has(t)) { nodes.add(t); edges.add(`${s} --> ${t}`); }
for (const [s, keys] of Object.entries(unresolved))
  for (const k of Object.keys(keys)) { nodes.add(k); edges.add(`${s} --> ${k}`); }
const liveEdges = [...readFileSync(join(lanes, "a3", "dump", "graph-links-live.txt"), "utf8")
  .matchAll(/"([^"]+ --> [^"]+)"/g)].map(m => m[1]);
const liveSet = new Set(liveEdges);
const mySet = new Set(edges);
const missing = [...liveSet].filter(e => !mySet.has(e));
const extra = [...mySet].filter(e => !liveSet.has(e));
check("D5. graph node count matches live (16)", nodes.size === 16, `mine=${nodes.size}`);
check("D6. graph edge set matches live exactly (19, adjacency-level)",
  missing.length === 0 && extra.length === 0 && mySet.size === liveSet.size,
  mySet.size === liveSet.size ? "" : `missing=[${missing}] extra=[${extra}]`);

// counts summary — asserted against the dump itself (the oracle), corrected
// at convergence from the lane's misquoted summary (was 21/34/6)
const livePairs = Object.values(dump.resolvedLinks).reduce((a, t) => a + Object.keys(t).length, 0);
const liveOcc = Object.values(dump.resolvedLinks).reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0);
check("D7. oracle counts hold: 17 resolved pairs / 33 occurrences / 4 distinct unresolved keys",
  deepEq(resolved, dump.resolvedLinks) &&
  livePairs === 17 && liveOcc === 33 &&
  new Set(Object.values(dump.unresolvedLinks).flatMap(u => Object.keys(u))).size === 4,
  `pairs=${livePairs} occ=${liveOcc}`);

function diffSummary(mine, live) {
  const diffs = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(live)]);
  for (const k of keys) if (!deepEq(mine[k] ?? {}, live[k] ?? {}))
    diffs.push(`${k}: mine=${JSON.stringify(mine[k] ?? {})} live=${JSON.stringify(live[k] ?? {})}`);
  return diffs.join(" | ").slice(0, 400);
}

const failed = results.filter(r => !r.pass);
console.log(`\nGate 3: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
