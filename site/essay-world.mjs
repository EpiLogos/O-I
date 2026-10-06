/** The essay World as an installable, verifiable package.
 *
 * A World package is the published Return-of-Zero edition (the Quartz reading, its `static/fieldIndex.json`,
 * the digest-checked Expression bodies) plus the reader companion's practices, pinned to the exact source
 * commits that produced them and described only by what the artifact itself contains.
 *
 *   node essay-world.mjs build   --vault DIR --vault-commit SHA --pcd DIR --pcd-commit SHA
 *                                --oi DIR --oi-commit SHA --node-modules-from SITE_DIR --out DIR
 *   node essay-world.mjs verify  PACKAGE_OR_INSTALLED_DIR [--vault ESSAY_DIR]
 *   node essay-world.mjs install PACKAGE_DIR [--root DIR] [--register-praxis [--aikit BIN] [--aikit-home DIR]]
 *   node essay-world.mjs resolve [--root DIR] [--verify]
 *   node essay-world.mjs mutation-probe INSTALLED_REVISION_DIR [--also DIR]…   (reads everything, proves nothing changed)
 *   node essay-world.mjs praxis-check PACKAGE_DIR                              (reader SkillSet members bind to shipped Skills)
 *   node essay-world.mjs register-praxis INSTALLED_REVISION_DIR [--aikit BIN] [--aikit-home DIR]   (explicit, machine-local)
 *
 * Nothing here reads the author checkout at run time: `build` reads a pinned commit through a scratch
 * clone (never the working tree), and `install`/`resolve`/`verify` read only the package. The edition is
 * written read-only; reading it changes nothing (verified, see `readAllPages`).
 *
 * Source identity: a page's native ref is the Central source ref `central:source:{world}:{path}` with the
 * world and prefix declared in the manifest (`source_addressing`), exactly as the Cradle's essay adapter
 * derives it from the edition's own source receipt. Slugs and numeric node ids are indices, never identity.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, cp, mkdir, readFile, readdir, readlink, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const WORLD_SCHEMA = 'oi.world-package/v1';
export const WORLD_ID = 'epi-logos/confronting-the-limit';
export const SOURCE_ADDRESSING = { world: 'project:Antykathera-Essay-Work', prefix: 'submission-package/essay/' };
const FILES_NAME = 'world.files.json';
const MANIFEST_NAME = 'world.manifest.json';

// ---------------------------------------------------------------------------------------------------------------------
// Native identity (mirrors desktop/cradle/src/field/source.ts `sourceRef` and epi/essayModel.ts `slugOfVaultPath`)
// ---------------------------------------------------------------------------------------------------------------------

export const sourceRef = (world, path) => `central:source:${world}:${path.replace(/%/g, '%25').replace(/:/g, '%3A').replace(/ /g, '%20')}`;
export function parseSourceRef(ref) {
  const m = /^central:source:((?:control:root)|(?:project:[^:]+)):(.*)$/.exec(ref);
  return m ? { world: m[1], path: m[2].replace(/%20/g, ' ').replace(/%3A/gi, ':').replace(/%25/g, '%') } : undefined;
}
export function slugOfVaultPath(path) {
  const p = path.replace(/\.md$/, '').split('/').map((seg) => seg.replace(/ /g, '-').replace(/&/g, '-and-').replace(/%/g, '-percent').replace(/\?/g, '').replace(/#/g, '')).join('/');
  return p === 'README' ? 'index' : p;
}

// ---------------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------------

export async function walkFiles(root, skip = () => false) {
  const out = [];
  async function walk(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (skip(rel, entry)) continue;
      if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  }
  await walk(root, '');
  return out.sort();
}

async function digestFiles(root, rels) {
  const files = [];
  for (const rel of rels) {
    const bytes = await readFile(join(root, rel));
    files.push({ path: rel, sha256: sha256(bytes), bytes: bytes.length });
  }
  return files;
}
const treeDigest = (files) => sha256(files.map((f) => `${f.path} ${f.sha256}`).join('\n'));

// ---------------------------------------------------------------------------------------------------------------------
// HTML (a bounded, dependency-free reading of Quartz's own output)
// ---------------------------------------------------------------------------------------------------------------------

const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export function articleOf(html) {
  const start = html.indexOf('<article');
  if (start < 0) return '';
  const end = html.indexOf('</article>', start);
  return end < 0 ? html.slice(start) : html.slice(start, end);
}
export const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1])));
export function linksOf(html) {
  const links = [];
  for (const m of html.matchAll(/<a\b([^>]*)>/g)) {
    const href = /\shref="([^"]*)"/.exec(m[1]);
    if (href) links.push(decodeEntities(href[1]));
  }
  return links;
}
export function embedsOf(html) {
  const out = [];
  for (const m of html.matchAll(/<(?:img|source|video|audio)\b([^>]*)>/g)) {
    const src = /\ssrc="([^"]*)"/.exec(m[1]);
    if (src) out.push(decodeEntities(src[1]));
  }
  return out;
}

/** The edition page a URL path names (Quartz serves `a/b` as `a/b.html`; folders as `a/index.html`). */
export function pageForPath(pathname, slugs) {
  let slug;
  try { slug = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return undefined; }
  slug = slug.replace(/\.html$/, '').replace(/\/+$/, '') || 'index';
  for (const candidate of [slug, `${slug}/index`, `${slug}/README`]) if (slugs.has(candidate)) return candidate;
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Description of the artifact: counts are derived from the edition, never asserted
// ---------------------------------------------------------------------------------------------------------------------

/** The depth classes the essay's own structure carries, by the vault path the page was published from.
 *  A = canonical Arguments A01–A36; A′ = their conjugates; C = Concepts C01–C64; A-C = the shared A/C root (conjugate/AC.md);
 *  S = the product records (section-rooms/arguments/products/S0–S5, S-World-and-Life); alignment = each room's canonical alignment;
 *  source-house = the Episteme source houses. Anything else carries no class here. */
export function depthClass(path) {
  const p = path.replace(/^submission-package\/essay\//, '');
  if (/^section-rooms\/arguments\/A\d\d-/.test(p)) return 'A';
  if (/^section-rooms\/arguments\/conjugate\/A\d\d-prime-/.test(p)) return 'A′';
  if (/^section-rooms\/arguments\/conjugate\/AC\.md$/.test(p)) return 'A-C';
  if (/^section-rooms\/arguments\/concepts\/C\d\d-/.test(p)) return 'C';
  if (/^section-rooms\/arguments\/products\/S(?:\d|-World)/.test(p)) return 'S';
  if (/^section-rooms\/\d\d-[^/]+\/P1-CANONICAL-ALIGNMENT\.md$/.test(p)) return 'alignment';
  if (/^symbolon\/episteme\/sources\/[^/]+\/.+\.md$/.test(p) || /^symbolon\/episteme\/sources\/SOURCE-INDEX\.md$/.test(p)) return 'source-house';
  return null;
}

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }

export async function describeEdition(editionDir) {
  const index = await readJson(join(editionDir, 'static/fieldIndex.json'));
  const receipt = await readJson(join(editionDir, 'quartz-source.json'));
  const xindex = await readJson(join(editionDir, 'expressions/index.json'));
  const all = await walkFiles(editionDir);
  const html = all.filter((f) => f.endsWith('.html'));
  const slugs = new Set(index.nodes.map((n) => n.s));
  const byKind = {};
  for (const n of index.nodes) byKind[n.k] = (byKind[n.k] ?? 0) + 1;
  const byRegister = {};
  for (const n of index.nodes) byRegister[n.r] = (byRegister[n.r] ?? 0) + 1;
  const byStation = {};
  for (const n of index.nodes) byStation[n.st] = (byStation[n.st] ?? 0) + 1;
  const pathOfSlug = new Map(receipt.files.filter((f) => f.kind === 'markdown').map((f) => [slugOfVaultPath(f.path), f.path]));
  const depth = {};
  for (const n of index.nodes) {
    const c = depthClass(pathOfSlug.get(n.s) ?? `${n.s}.md`);
    if (c) depth[c] = (depth[c] ?? 0) + 1;
  }
  const assetFiles = receipt.files.filter((f) => f.kind === 'asset');
  const assetByExt = {};
  for (const a of assetFiles) { const e = a.path.split('.').pop().toLowerCase(); assetByExt[e] = (assetByExt[e] ?? 0) + 1; }
  const entries = xindex.entries;
  const byCollection = Object.fromEntries(xindex.collections.map((c) => [c.id, c.count]));
  return {
    pages: { nodes: index.nodes.length, html_files: html.length, staged_markdown: receipt.staged_files, words: index.nodes.reduce((s, n) => s + (n.w ?? 0), 0), links: index.links.length },
    structure: {
      rooms: Object.keys(index.rooms).length, movements: Object.keys(index.moves).length,
      stations: Object.keys(index.stations).length, registers: Object.keys(index.regs).length,
      by_kind: byKind, by_register: byRegister, by_station: byStation,
    },
    depth_classes: { ...depth, rule: 'A = A01–A36; A′ = conjugate/A##-prime-*; C = concepts/C##-*; A-C = conjugate/AC.md; S = arguments/products/S0–S5 + S-World-and-Life; alignment = P1-CANONICAL-ALIGNMENT; source-house = symbolon/episteme/sources/**' },
    assets: { count: assetFiles.length, by_extension: assetByExt },
    expressions: {
      members: entries.length, by_collection: byCollection,
      laid_over_pages: entries.filter((e) => e.nodes.length).length,
      scenes: entries.reduce((s, e) => s + e.scenes.length, 0),
      covers: entries.filter((e) => e.cover).length,
      absent: xindex.absent.length,
      profiles: 'the edition ships oi.journey bodies (scenes inside each); it carries no separate ExpressionProfile artifact',
    },
    edition_files: all.length,
    _index: index, _receipt: receipt, _xindex: xindex, _html: html, _slugs: slugs, _pathOfSlug: pathOfSlug,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Verification of the edition artifact (all pages): references, anchors, embeds, Expressions, source identity
// ---------------------------------------------------------------------------------------------------------------------

/** Read every page the way a reader does — only reads — and return what resolves. Also the mutation probe. */
export async function readAllPages(editionDir, d) {
  const { _index: index, _slugs: slugs, _receipt: receipt, _pathOfSlug: pathOfSlug } = d;
  const files = new Set(await walkFiles(editionDir));
  const idsBySlug = new Map();
  const bodyBySlug = new Map();
  for (const slug of slugs) {
    const file = `${slug}.html`;
    if (!files.has(file)) continue;
    const article = articleOf(await readFile(join(editionDir, file), 'utf8'));
    bodyBySlug.set(slug, article);
    idsBySlug.set(slug, idsOf(article));
  }
  const missingPages = [...slugs].filter((s) => !bodyBySlug.has(s));
  let assetLinks = 0, links = 0, internal = 0, external = 0, withFragment = 0, unresolvedPage = 0, unresolvedFragment = 0, selfFragment = 0, selfFragmentUnresolved = 0;
  const unresolved = [], embeds = { total: 0, resolved: 0, external: 0, unresolved: [] };
  const missingTargets = new Map();   // normalised dangling page target → { count, pages }
  for (const [slug, body] of bodyBySlug) {
    const base = new URL(slug === 'index' ? 'http://e/' : `http://e/${slug.split('/').map(encodeURIComponent).join('/')}`);
    for (const href of linksOf(body)) {
      links++;
      if (/^(?:mailto:|tel:|javascript:)/i.test(href)) { external++; continue; }
      let url; try { url = new URL(href, base); } catch { continue; }
      if (url.origin !== 'http://e') { external++; continue; }
      internal++;
      const target = pageForPath(url.pathname, slugs);
      // A link to a published file (a figure, a diagram) names no page and needs none.
      if (!target && files.has(decodeURIComponent(url.pathname).replace(/^\/+/, ''))) { assetLinks++; continue; }
      const fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
      if (!target) {
        // A same-page fragment resolves against its own page; anything else that names no page is a defect.
        if (!url.pathname.replace(/\/+$/, '') || url.pathname === base.pathname) { selfFragment++; if (fragment && !idsBySlug.get(slug)?.has(fragment)) { selfFragmentUnresolved++; unresolved.push({ page: slug, href, why: 'fragment missing on this page' }); } continue; }
        unresolvedPage++; unresolved.push({ page: slug, href, why: 'no such page', target: decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/\.html$/, '') });
        const key = decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/\.html$/, '');
        const entry = missingTargets.get(key) ?? { count: 0, from: new Set() };
        entry.count++; entry.from.add(slug); missingTargets.set(key, entry);
        continue;
      }
      if (fragment) {
        withFragment++;
        if (!idsBySlug.get(target)?.has(fragment)) { unresolvedFragment++; unresolved.push({ page: slug, href, why: `fragment #${fragment} missing on ${target}`, target, fragment, candidates: [...idsBySlug.get(target) ?? []].filter((id) => id.startsWith(`${fragment}-`)).slice(0, 3) }); }
      }
    }
    for (const src of embedsOf(body)) {
      embeds.total++;
      if (/^(?:https?:|data:|blob:)/i.test(src)) { embeds.external++; continue; }
      let url; try { url = new URL(src, base); } catch { continue; }
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (files.has(rel)) embeds.resolved++; else embeds.unresolved.push({ page: slug, src });
    }
  }
  // The exact-anchor / ref round trip over every page: ref → path → slug → page → every id on it → ref#id.
  let refs = 0, refRound = 0, anchors = 0, anchorRound = 0;
  const refProblems = [];
  const receiptByPath = new Map(receipt.files.filter((f) => f.kind === 'markdown').map((f) => [f.path, f]));
  for (const n of index.nodes) {
    const path = pathOfSlug.get(n.s);
    if (!path) { refProblems.push({ slug: n.s, why: 'no source path in the receipt' }); continue; }
    refs++;
    const ref = sourceRef(SOURCE_ADDRESSING.world, SOURCE_ADDRESSING.prefix + path);
    const back = parseSourceRef(ref);
    const ok = back && back.world === SOURCE_ADDRESSING.world && back.path === SOURCE_ADDRESSING.prefix + path
      && slugOfVaultPath(back.path.slice(SOURCE_ADDRESSING.prefix.length)) === n.s && receiptByPath.has(path) && bodyBySlug.has(n.s);
    if (ok) refRound++; else refProblems.push({ slug: n.s, ref, why: 'ref does not round-trip to the same page and receipt entry' });
    for (const id of idsBySlug.get(n.s) ?? []) {
      anchors++;
      const anchorRef = `${ref}#${id}`;
      const [r, frag] = [anchorRef.slice(0, anchorRef.lastIndexOf('#')), anchorRef.slice(anchorRef.lastIndexOf('#') + 1)];
      if (r === ref && frag === id && idsBySlug.get(n.s).has(frag)) anchorRound++;
    }
  }
  return {
    pages_read: bodyBySlug.size, pages_missing: missingPages, dangling_all: unresolved,
    links: { total: links, internal, external, to_published_files: assetLinks, internal_with_fragment: withFragment, same_page_fragment: selfFragment,
      unresolved_page: unresolvedPage, dangling_targets: summariseDangling(missingTargets), unresolved_fragment: unresolvedFragment + selfFragmentUnresolved, unresolved_sample: unresolved.slice(0, 20), unresolved_all: unresolved.length },
    embeds: { total: embeds.total, resolved: embeds.resolved, external: embeds.external, unresolved: embeds.unresolved.length, unresolved_sample: embeds.unresolved.slice(0, 10) },
    ref_round_trip: { pages: refs, round_tripped: refRound, problems: refProblems.slice(0, 20), problem_count: refProblems.length },
    anchor_round_trip: { anchors, round_tripped: anchorRound },
  };
}

/** Group dangling page targets by what they are: withheld desks that still render as links, or in-scope pages that do not exist. */
function summariseDangling(missingTargets) {
  const groups = {};
  for (const [target, { count, from }] of missingTargets) {
    const category = /(?:^|\/)quilt(?:\/|$)/.test(target) ? 'quilt (withheld working ledgers)'
      : /(?:^|\/)working(?:\/|$)/.test(target) ? 'working (withheld private desks)'
      : /(?:^|\/)(?:reference-notes|private|templates)(?:\/|$)/.test(target) ? 'other withheld folder'
      : 'in-scope path that is not a published page';
    const g = (groups[category] ??= { references: 0, distinct_targets: 0, sample: [] });
    g.references += count; g.distinct_targets++;
    if (g.sample.length < 6) g.sample.push({ target, from_pages: from.size });
  }
  return groups;
}

/** Expression bodies are exact: the digest in the index is the SHA-256 of the body file; covers exist; aboutness names real pages. */
export async function verifyExpressions(editionDir, d) {
  const { _xindex: xindex, _slugs: slugs } = d;
  let verified = 0; const problems = [];
  for (const e of xindex.entries) {
    const file = join(editionDir, 'expressions', e.journey);
    if (!existsSync(file)) { problems.push({ id: e.id, why: 'body missing' }); continue; }
    const bytes = await readFile(file);
    if (`sha256:${sha256(bytes)}` !== e.digest || bytes.length !== e.bytes) { problems.push({ id: e.id, why: 'body digest differs from the index' }); continue; }
    if (!existsSync(join(editionDir, 'expressions', e.cover))) { problems.push({ id: e.id, why: 'cover missing' }); continue; }
    const absentNodes = e.nodes.filter((s) => !slugs.has(s));
    if (absentNodes.length) { problems.push({ id: e.id, why: `about pages absent: ${absentNodes.join(', ')}` }); continue; }
    verified++;
  }
  return { members: xindex.entries.length, verified, problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// The declared-dependency closure of the PUBLISHED source: every reference a published page declares is resolved
// to a published page/asset, or dispositioned as external or withheld. Anything else is a defect.
// ---------------------------------------------------------------------------------------------------------------------

const WITHHELD_RULES = [
  ['working', (p) => /^\.\.\/(?:\.\.\/)*working\//.test(p) || /(?:^|\/)working\//.test(p), 'private working desks (working/)'],
  ['quilt', (p) => /(?:^|\/)quilt(?:\/|$)/.test(p), 'working ledgers (quilt/)'],
  ['reference-notes', (p) => /(?:^|\/)reference-notes(?:\/|$)/.test(p), 'reference notes'],
  ['private', (p) => /(?:^|\/)private(?:\/|$)/.test(p), 'private material'],
  ['templates', (p) => /(?:^|\/)templates(?:\/|$)/.test(p), 'templates'],
];

export function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '').replace(/`[^`\n]*`/g, '');
}
export function declaredReferences(text) {
  const body = stripCode(text.replace(/^---\n[\s\S]*?\n---/, ''));
  const refs = [];
  for (const m of body.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) refs.push({ kind: m[0].startsWith('!') ? 'embed' : 'link', target: m[1].replace(/^<(.*)>$/s, '$1') });
  for (const m of body.matchAll(/(!?)\[\[([^\]|#\\]+)(?:#[^\]|\\]*)?(?:\\?\|[^\]]*)?\]\]/g)) refs.push({ kind: m[1] ? 'wikiembed' : 'wikilink', target: m[2].trim() });
  for (const m of body.matchAll(/<(?:img|source)\b[^>]*\ssrc="([^"]+)"/g)) refs.push({ kind: 'embed', target: m[1] });
  return refs;
}

/** `entries` are the staged inputs (rel path, kind); `exists` answers whether a vault path exists beyond the published set. */
export function closeDependencies(entries, texts, exists = () => false) {
  const published = new Set(entries.map((e) => e.rel));
  const mdBase = new Map();
  for (const e of entries) if (e.rel.endsWith('.md')) { const b = basename(e.rel, '.md').toLowerCase(); (mdBase.get(b) ?? mdBase.set(b, []).get(b)).push(e.rel); }
  const totals = { references: 0, resolved: 0, external: 0, anchor_only: 0, withheld: 0, unresolved: 0, wikilinks: 0 };
  const withheld = {}, unresolved = [], withheldDeclared = new Set();
  const externalDomains = {};
  for (const [rel, text] of texts) {
    for (const r of declaredReferences(text)) {
      totals.references++;
      const target = r.target;
      if (r.kind === 'wikilink' || r.kind === 'wikiembed') {
        totals.wikilinks++;
        // Obsidian resolves a path-qualified wikilink from the vault root and a bare name by its file name.
        const named = target.includes('/') ? (published.has(`${target.replace(/\.md$/, '')}.md`) ? [target] : []) : mdBase.get(basename(target, '.md').toLowerCase()) ?? [];
        const withheldTarget = WITHHELD_RULES.find(([, test]) => test(target));
        if (named.length || published.has(target)) totals.resolved++;
        else if (withheldTarget) {
          totals.withheld++;
          const g = (withheld[withheldTarget[0]] ??= { references: 0, targets: new Set() }); g.references++; g.targets.add(target); withheldDeclared.add(target);
        } else { totals.unresolved++; unresolved.push({ from: rel, target, why: 'wikilink names no published page' }); }
        continue;
      }
      if (/^(?:https?:|mailto:|tel:)/i.test(target)) {
        totals.external++;
        const host = /^https?:\/\/([^/]+)/i.exec(target)?.[1] ?? target.split(':')[0];
        externalDomains[host] = (externalDomains[host] ?? 0) + 1;
        continue;
      }
      if (target.startsWith('#')) { totals.anchor_only++; continue; }
      let path;
      try { path = posix.normalize(posix.join(posix.dirname(rel), decodeURIComponent(target.split('#')[0]))); } catch { totals.unresolved++; unresolved.push({ from: rel, target, why: 'undecodable target' }); continue; }
      if (published.has(path)) { totals.resolved++; continue; }
      const rule = WITHHELD_RULES.find(([, test]) => test(path) || test(target));
      const escapes = path.startsWith('../');
      if (rule || escapes || (path.endsWith('.md') && exists(path))) {
        totals.withheld++;
        const category = rule ? rule[0] : escapes ? 'outside-publication' : 'unpublished-page';
        (withheld[category] ??= { references: 0, targets: new Set() }); withheldDeclared.add(path);
        withheld[category].references++; withheld[category].targets.add(escapes || rule ? posix.normalize(posix.join(posix.dirname(rel), target.split('#')[0])) : path);
        continue;
      }
      totals.unresolved++;
      unresolved.push({ from: rel, target, why: exists(path) ? 'exists in the vault but is not published' : 'no such file' });
    }
  }
  return {
    ...totals,
    declared_internal_unresolved: totals.unresolved,
    withheld_by_category: Object.fromEntries(Object.entries(withheld).map(([k, v]) => [k, { references: v.references, distinct_targets: v.targets.size, sample: [...v.targets].sort().slice(0, 5) }])),
    external_domains: Object.fromEntries(Object.entries(externalDomains).sort((a, b) => b[1] - a[1]).slice(0, 25)),
    unresolved_sample: unresolved.slice(0, 25),
    unresolved_all: unresolved,
    withheld_declared: [...withheldDeclared],
  };
}


// ---------------------------------------------------------------------------------------------------------------------
// Dispositions: every declared reference that does not resolve is classified, never hidden.
//   withheld-by-design   the target is a note that exists but never publishes (working/, quilt/, reference-notes/, private/, templates/,
//                        -NOTES, or a link into one); essay-source.mjs withholds it on purpose and the reading shows a plain label
//   external             a deliberate reference outside the essay
//   authoring-defect     the essay source names something that is not there; `repair` says whether the fix is mechanical (a unique
//                        published target differs only by name), has candidates (the author chooses), or has none
//   publication-defect   the edition links into a withheld desk (the staging law was not applied)
// ---------------------------------------------------------------------------------------------------------------------

export const DISPOSITIONS = ['withheld-by-design', 'external', 'authoring-defect', 'publication-defect'];
const norm = (value) => String(value).replace(/\.(?:md|html)$/i, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

/** Every vault path under the essay directory (links not followed): `rel → { symlink }`. */
export async function indexVault(essayDir) {
  const index = new Map();
  async function walk(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) index.set(rel, { symlink: await readlink(join(dir, entry.name)) });
      else if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else index.set(rel, { symlink: null });
    }
  }
  await walk(essayDir, '');
  return index;
}

const isWithheldPath = (path) => WITHHELD_RULES.some(([, test]) => test(path)) || /(?:^|\/)(?:NOTES|[^/]*-NOTES)\.md$/.test(path) || path.startsWith('../');

/** Classify one unresolved declared reference. `ctx`: published (Set of rel paths), vaultIndex (Map), declaredWithheld (array of target paths the essay itself places in withheld desks). */
export function dispositionOf(item, { published = new Set(), vaultIndex = new Map(), declaredWithheld = [] } = {}) {
  const target = item.target;
  const wiki = /wikilink/.test(item.why);
  const stripped = target.replace(/^(?:\.\.?\/)+/, '').replace(/\\+$/, '');
  if (/^(?:www\.|[a-z0-9-]+(?:\.[a-z0-9-]+)+\/)/i.test(target)) return { disposition: 'external', reason: 'a bare web address, deliberately outside the essay' };
  // A vault entry that is, or links into, a withheld place.
  const bySuffix = [...vaultIndex].filter(([rel]) => rel === stripped || rel.endsWith(`/${stripped}`) || rel === `${stripped}.md` || rel.endsWith(`/${stripped}.md`));
  const byName = wiki && !target.includes('/') ? [...vaultIndex].filter(([rel]) => norm(basename(rel)) === norm(target)) : [];
  for (const [rel, info] of [...bySuffix, ...byName]) {
    if (info.symlink !== null && isWithheldPath(posix.normalize(posix.join(posix.dirname(rel), info.symlink)))) {
      return { disposition: 'withheld-by-design', reason: `the note is a symlink into a withheld working desk (${rel} -> ${info.symlink}); essay-source.mjs never publishes symlinked or working material`, evidence: rel };
    }
    if (isWithheldPath(rel) && !published.has(rel)) return { disposition: 'withheld-by-design', reason: `the note exists but is withheld by rule (${rel})`, evidence: rel };
  }
  const declared = declaredWithheld.find((d) => norm(basename(decodeURIComponent(String(d)))) === norm(wiki ? target : basename(stripped)) && norm(target).length > 2);
  if (declared) return { disposition: 'withheld-by-design', reason: `the essay itself places a note of this name in a withheld desk (${declared})`, evidence: String(declared) };
  // Candidates among published pages.
  const dir = posix.dirname(stripped), leaf = basename(stripped, '.md');
  const sameDir = target.includes('/') ? [...published].filter((rel) => posix.dirname(rel) === dir && basename(rel).toLowerCase().startsWith(`${leaf.toLowerCase()}-`) && rel.endsWith('.md')) : [];
  if (sameDir.length === 1) {
    return { disposition: 'authoring-defect', reason: 'the link names a page that does not exist; exactly one published page in that folder has this name plus a suffix', repair: { kind: 'mechanical', replace: target, with: sameDir[0].replace(/\.md$/, '') } };
  }
  const wanted = norm(wiki ? target : leaf);
  const byTitle = wanted.length > 3 ? [...published].filter((rel) => rel.endsWith('.md') && (norm(basename(rel)) === wanted || norm(basename(rel)).endsWith(`-${wanted}`))) : [];
  if (byTitle.length) return { disposition: 'authoring-defect', reason: 'the link names no published page; published pages answer to a similar name, and the author decides whether one is meant', repair: { kind: 'candidates', candidates: byTitle.slice(0, 3).map((rel) => rel.replace(/\.md$/, '')) } };
  return { disposition: 'authoring-defect', reason: wiki ? 'a title-style wikilink that names no note in the vault or any withheld desk' : 'the path names no file in the vault', repair: { kind: 'none' } };
}

/** Per-reference dispositions plus the per-target table the manifest carries. */
export function dispositionSourceDefects(unresolved, ctx) {
  const references = unresolved.map((item) => ({ ...item, ...dispositionOf(item, ctx) }));
  const table = new Map();
  for (const r of references) {
    const row = table.get(r.target) ?? { target: r.target, kind: /wikilink/.test(r.why) ? 'wikilink' : 'link', references: 0, example_from: r.from, disposition: r.disposition, reason: r.reason, ...(r.repair ? { repair: r.repair } : {}), ...(r.evidence ? { evidence: r.evidence } : {}) };
    row.references++; table.set(r.target, row);
  }
  const rows = [...table.values()].sort((a, b) => a.disposition.localeCompare(b.disposition) || a.target.localeCompare(b.target));
  return { references, table: rows, totals: totalsOf(references.map((r) => r.disposition)), undispositioned: references.filter((r) => !DISPOSITIONS.includes(r.disposition)).length, distinct_targets: rows.length };
}
function totalsOf(list) { const t = Object.fromEntries(DISPOSITIONS.map((d) => [d, 0])); for (const d of list) t[d] = (t[d] ?? 0) + 1; return t; }

/** Classify the edition's dead links and missing fragments. A dead link inherits the disposition of the source reference it came from (matched by
 *  its normalised path, or by its note name for a bare wikilink); a link into a withheld desk is a publication defect; anything else is undispositioned. */
export function dispositionEditionDefects(dangling, sourceTable, { slugs = new Set() } = {}) {
  const byPath = new Map(), byName = new Map();
  for (const row of sourceTable) {
    byPath.set(norm(row.target.replace(/^(?:\.\.?\/)+/, '')), row);
    if (row.kind === 'wikilink' && !row.target.includes('/')) byName.set(norm(row.target), row);
    byName.set(`~${norm(basename(row.target))}`, row);
  }
  const bySlugLeaf = new Map();
  for (const slug of slugs) (bySlugLeaf.get(norm(basename(slug))) ?? bySlugLeaf.set(norm(basename(slug)), []).get(norm(basename(slug)))).push(slug);
  const links = [], fragments = [];
  for (const item of dangling) {
    if (item.why === 'no such page') {
      const target = item.target ?? '', key = norm(target), leaf = norm(basename(target));
      let verdict;
      if (isWithheldPath(target)) verdict = { disposition: 'publication-defect', kind: 'withheld-desk-link', reason: 'the edition links into a withheld desk; staging should have unlinked it' };
      else if (/(?:^|\/)tags(?:\/|$)/.test(target)) verdict = { disposition: 'publication-defect', kind: 'hashtag-link', reason: 'prose containing a #tag was rendered as a link to /tags/<tag>, and the edition emits no page there; the source did not write a link' };
      else {
        const row = byPath.get(key) ?? [...byPath].find(([k]) => key.endsWith(`-${k}`) || key === k)?.[1] ?? byName.get(leaf) ?? byName.get(`~${leaf}`);
        const alike = bySlugLeaf.get(leaf);
        if (row) verdict = { disposition: row.disposition, reason: row.reason };
        else if (alike?.length) verdict = { disposition: 'publication-defect', kind: 'resolver-mismatch', reason: `the vault resolves this wikilink (a note named ${alike[0]} exists) but the edition's link names it differently, so the page was not found`, repair: { kind: 'candidates', candidates: alike.slice(0, 3) } };
      }
      links.push({ page: item.page, href: item.href, disposition: verdict?.disposition ?? 'undispositioned', ...(verdict?.kind ? { kind: verdict.kind } : {}), reason: verdict?.reason ?? 'no source reference accounts for this link', ...(verdict?.repair ? { repair: verdict.repair } : {}) });
    } else {
      fragments.push({ page: item.page, href: item.href, disposition: 'authoring-defect', reason: item.candidates?.length ? `the link names an anchor the page does not have; headings on that page begin ${item.candidates.map((c) => `#${c}`).join(', ')}` : 'the link names an anchor the page does not have', repair: item.candidates?.length ? { kind: 'candidates', candidates: item.candidates } : { kind: 'none' } });
    }
  }
  const group = (list) => ({ total: list.length, by_disposition: { ...totalsOf(list.map((l) => l.disposition)), ...(list.some((l) => l.disposition === 'undispositioned') ? { undispositioned: list.filter((l) => l.disposition === 'undispositioned').length } : {}) }, by_kind: Object.fromEntries([...list.reduce((m, l) => l.kind ? m.set(l.kind, (m.get(l.kind) ?? 0) + 1) : m, new Map())]), undispositioned: list.filter((l) => !DISPOSITIONS.includes(l.disposition)).length });
  return { links, fragments, summary: { links: group(links), fragments: group(fragments) } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Install root, install, resolve
// ---------------------------------------------------------------------------------------------------------------------

/** `OI_WORLDS_ROOT`, else the O:I application-data directory's `worlds/`. The default is a proposal pending owner confirmation. */
export function defaultWorldsRoot(env = process.env) {
  if (env.OI_WORLDS_ROOT) return env.OI_WORLDS_ROOT;
  if (platform() === 'darwin') return join(homedir(), 'Library/Application Support/OI/worlds');
  return join(env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'oi/worlds');
}

export async function verifyPackage(dir, { vaultEssayDir } = {}) {
  const problems = [];
  const manifest = await readJson(join(dir, MANIFEST_NAME)).catch(() => null);
  if (!manifest || manifest.schema !== WORLD_SCHEMA) return { ok: false, problems: ['no readable world manifest of the expected schema'] };
  const list = await readJson(join(dir, FILES_NAME)).catch(() => null);
  if (!list) return { ok: false, problems: ['no file digest list'] };
  if (sha256(JSON.stringify(list.files)) !== manifest.files.list_sha256) problems.push('the file list differs from the manifest');
  if (treeDigest(list.files) !== manifest.files.tree_sha256) problems.push('the tree digest differs from the manifest');
  const onDisk = new Set(await walkFiles(dir, (rel) => rel === MANIFEST_NAME || rel === FILES_NAME));
  for (const f of list.files) {
    if (!onDisk.has(f.path)) { problems.push(`${f.path}: missing`); continue; }
    onDisk.delete(f.path);
    const bytes = await readFile(join(dir, f.path));
    if (sha256(bytes) !== f.sha256) problems.push(`${f.path}: digest differs`);
  }
  for (const extra of onDisk) problems.push(`${extra}: not in the manifest`);
  const description = await describeEdition(join(dir, 'edition'));
  const pages = await readAllPages(join(dir, 'edition'), description);
  const expressions = await verifyExpressions(join(dir, 'edition'), description);
  if (pages.pages_missing.length) problems.push(`${pages.pages_missing.length} indexed pages have no file`);
  if (pages.ref_round_trip.problem_count) problems.push(`${pages.ref_round_trip.problem_count} refs do not round-trip`);
  // Content defects are recorded in the manifest and may not grow or change silently; integrity failures are never recorded.
  const recorded = manifest.verification.edition;
  if (pages.links.unresolved_page !== recorded.links.unresolved_page) problems.push(`dangling page links: ${pages.links.unresolved_page} now, ${recorded.links.unresolved_page} recorded`);
  if (pages.links.unresolved_fragment !== recorded.links.unresolved_fragment) problems.push(`unresolved fragments: ${pages.links.unresolved_fragment} now, ${recorded.links.unresolved_fragment} recorded`);
  if (pages.embeds.unresolved !== recorded.embeds.unresolved) problems.push(`unresolved embeds: ${pages.embeds.unresolved} now, ${recorded.embeds.unresolved} recorded`);
  if (expressions.problems.length) problems.push(`${expressions.problems.length} Expression members do not verify`);
  // Dispositions: nothing declared-internal that fails to resolve may be unclassified, and what is recorded may not drift.
  const recordedDisp = manifest.dependency_closure.dispositions;
  const defects = await readJson(join(dir, 'source/dependency-defects.json')).catch(() => null);
  let dispositions = null;
  if (!recordedDisp || !defects) problems.push('no recorded dispositions for the unresolved references');
  else {
    const sourceUnclassified = defects.source_references_unresolved.filter((r) => !DISPOSITIONS.includes(r.disposition)).length;
    if (sourceUnclassified || recordedDisp.undispositioned) problems.push(`${sourceUnclassified || recordedDisp.undispositioned} unresolved source references have no disposition`);
    if (defects.source_references_unresolved.length !== manifest.dependency_closure.declared_internal_unresolved) problems.push(`source reference defects listed ${defects.source_references_unresolved.length}, recorded ${manifest.dependency_closure.declared_internal_unresolved}`);
    if (recordedDisp.table.reduce((n, r) => n + r.references, 0) !== manifest.dependency_closure.declared_internal_unresolved) problems.push('the disposition table does not account for every unresolved reference');
    dispositions = dispositionEditionDefects(pages.dangling_all, recordedDisp.table, { slugs: description._slugs });
    const edition = recorded.dispositions;
    if (dispositions.summary.links.undispositioned || (dispositions.summary.links.by_disposition.undispositioned ?? 0)) problems.push(`${dispositions.summary.links.by_disposition.undispositioned ?? dispositions.summary.links.undispositioned} edition links to no page have no disposition`);
    if ((dispositions.summary.links.by_kind['withheld-desk-link'] ?? 0) || (recordedDisp.totals['publication-defect'] ?? 0)) problems.push('the edition links into a withheld desk');
    if (!edition || JSON.stringify(dispositions.summary) !== JSON.stringify(edition)) problems.push('edition link/fragment dispositions differ from the recorded ones');
  }
  for (const [name, expected] of Object.entries({ pages: manifest.counts.pages.nodes, expressions: manifest.counts.expressions.members })) {
    const found = name === 'pages' ? description.pages.nodes : description.expressions.members;
    if (found !== expected) problems.push(`${name}: the artifact has ${found}, the manifest says ${expected}`);
  }
  const praxis = await verifyPraxisBinding(dir).catch((e) => ({ unbound: [{ id: 'praxis', why: e.message }] }));
  if (praxis.unbound.length) problems.push(`${praxis.unbound.length} reader-SkillSet members do not bind to a shipped Skill (${praxis.unbound[0].id}: ${praxis.unbound[0].why})`);
  let vault = null;
  if (vaultEssayDir) vault = await verifyAgainstVault(description, vaultEssayDir, manifest);
  if (vault?.problems?.length) problems.push(...vault.problems);
  return { ok: problems.length === 0, problems, manifest_sha256: sha256(await readFile(join(dir, MANIFEST_NAME))), pages, expressions, praxis, vault, dispositions: dispositions?.summary };
}

/** Ordinary reading is read-only: snapshot every file's content and mode, read every page and Expression body, snapshot again. */
export async function ordinaryReadingMutations(dir, { extraRoots = [] } = {}) {
  const snapshot = async (root) => {
    const map = new Map();
    for (const rel of await walkFiles(root)) {
      const abs = join(root, rel); const st = await stat(abs);
      map.set(`${root}::${rel}`, `${sha256(await readFile(abs))}:${st.size}:${st.mode & 0o777}:${st.mtimeMs}`);
    }
    return map;
  };
  const roots = [dir, ...extraRoots];
  const before = new Map(); for (const r of roots) for (const [k, v] of await snapshot(r)) before.set(k, v);
  const d = await describeEdition(join(dir, 'edition'));
  const pages = await readAllPages(join(dir, 'edition'), d);
  const expressions = await verifyExpressions(join(dir, 'edition'), d);
  const after = new Map(); for (const r of roots) for (const [k, v] of await snapshot(r)) after.set(k, v);
  let changed = 0, added = 0, removed = 0;
  for (const [k, v] of before) { if (!after.has(k)) removed++; else if (after.get(k) !== v) changed++; }
  for (const k of after.keys()) if (!before.has(k)) added++;
  return { files_watched: before.size, pages_read: pages.pages_read, expressions_read: expressions.members, changed, added, removed, mutations: changed + added + removed };
}

/** With the pinned vault at hand: each published page's receipt digest is the SHA-256 of that vault file. */
export async function verifyAgainstVault(d, essayDir, manifest) {
  const problems = []; let matched = 0;
  for (const f of d._receipt.files) {
    const file = join(essayDir, f.path);
    if (!existsSync(file)) { problems.push(`${f.path}: not in the vault checkout`); continue; }
    if (sha256(await readFile(file)) === f.sha256) matched++; else problems.push(`${f.path}: differs from the vault`);
  }
  return { receipt_files: d._receipt.files.length, matched, problems: problems.slice(0, 20), problem_count: problems.length };
}

export async function installPackage(packageDir, { root = defaultWorldsRoot() } = {}) {
  const verdict = await verifyPackage(packageDir);
  if (!verdict.ok) throw new Error(`the World package does not verify: ${verdict.problems.slice(0, 5).join('; ')}`);
  const manifest = await readJson(join(packageDir, MANIFEST_NAME));
  const worldDir = join(root, manifest.world_id);
  const revision = manifest.revision;
  const target = join(worldDir, 'revisions', revision);
  if (existsSync(target)) {
    const present = await verifyPackage(target);
    if (!present.ok) throw new Error(`revision ${revision} is already installed but does not verify (${present.problems[0]}); remove it explicitly`);
  } else {
    const staging = join(worldDir, 'revisions', `.staging-${process.pid}`);
    await rm(staging, { recursive: true, force: true });
    await mkdir(dirname(staging), { recursive: true });
    await cp(packageDir, staging, { recursive: true });
    await rename(staging, target);
    // Read-only: ordinary reading cannot change the installed edition.
    for (const rel of await walkFiles(target)) await chmod(join(target, rel), 0o444);
  }
  const previous = await readJson(join(worldDir, 'current.json')).catch(() => null);
  const pointer = {
    schema: 'oi.world-install/v1', world_id: manifest.world_id, revision,
    manifest_sha256: verdict.manifest_sha256, path: relative(worldDir, target),
    installed_at: new Date().toISOString(), previous_revision: previous && previous.revision !== revision ? previous.revision : previous?.previous_revision ?? null,
  };
  await writeFile(join(worldDir, 'current.json.tmp'), JSON.stringify(pointer, null, 2) + '\n');
  await rename(join(worldDir, 'current.json.tmp'), join(worldDir, 'current.json'));
  return { world_dir: worldDir, installed: target, pointer, verified: { pages: verdict.pages.pages_read, expressions: verdict.expressions.verified } };
}

/** What the Cradle reads to find the edition: the installed, verified World — never the author checkout. */
export async function resolveWorld({ root = defaultWorldsRoot(), worldId = WORLD_ID, verify = false } = {}) {
  const worldDir = join(root, worldId);
  const pointer = await readJson(join(worldDir, 'current.json')).catch(() => null);
  if (!pointer) return { state: 'absent', world_id: worldId, root, reason: `no World ${worldId} is installed under ${root}` };
  const dir = resolve(worldDir, pointer.path);
  const manifestBytes = await readFile(join(dir, MANIFEST_NAME)).catch(() => null);
  if (!manifestBytes) return { state: 'broken', world_id: worldId, root, reason: `the installed revision ${pointer.revision} has no manifest` };
  if (sha256(manifestBytes) !== pointer.manifest_sha256) return { state: 'broken', world_id: worldId, root, reason: 'the installed manifest differs from the one installed' };
  const manifest = JSON.parse(manifestBytes);
  const out = {
    state: 'available', world_id: worldId, revision: pointer.revision, root, dir,
    edition_dir: join(dir, 'edition'), praxis_dir: join(dir, 'praxis'),
    manifest: join(dir, MANIFEST_NAME), manifest_sha256: pointer.manifest_sha256,
    source_addressing: manifest.source_addressing, source: manifest.source, counts: { pages: manifest.counts.pages.nodes, expressions: manifest.counts.expressions.members },
  };
  if (verify) { const v = await verifyPackage(dir); if (!v.ok) return { ...out, state: 'broken', reason: v.problems.slice(0, 5).join('; ') }; out.verified = true; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Build: from pinned commits, through scratch clones. Never the author working tree.
// ---------------------------------------------------------------------------------------------------------------------

async function git(args, cwd) { return (await exec('git', cwd ? ['-C', cwd, ...args] : args, { maxBuffer: 64 * 1024 * 1024 })).stdout; }

async function pinnedCheckout(repo, commit, sparse, dest) {
  await git(['clone', '--shared', '--no-checkout', '--quiet', repo, dest]);
  await git(['sparse-checkout', 'set', ...sparse], dest);
  await git(['checkout', '--quiet', '--detach', commit], dest);
  const head = (await git(['rev-parse', 'HEAD'], dest)).trim();
  if (head !== commit) throw new Error(`checkout of ${repo} is ${head}, not the pinned ${commit}`);
  return head;
}

/** `overlay`: repo-relative files taken from the O:I working tree over the pinned archive (a build of uncommitted edition law). The manifest
 *  records each overlaid file's digest and says the build is not pinned; re-build from a commit that contains them to pin it. */
export async function buildWorld({ vault, vaultCommit, pcd, pcdCommit, oi, oiCommit, nodeModulesFrom, out, scratch, overlay = [] }) {
  for (const [name, v] of Object.entries({ vault, vaultCommit, pcd, pcdCommit, oi, oiCommit, nodeModulesFrom, out })) if (!v) throw new Error(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  scratch ??= `${out}.scratch`;
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  const vaultDir = join(scratch, 'Antykathera-Essay-Work');
  await pinnedCheckout(vault, vaultCommit, ['submission-package/essay', 'submission-package/epi-logos', 'submission-package/MANIFEST.json'], vaultDir);
  const pcdDir = join(scratch, 'pcd');
  await pinnedCheckout(pcd, pcdCommit, ['production/s-products'], pcdDir);
  const oiDir = join(scratch, 'o-i');
  await mkdir(oiDir, { recursive: true });
  const archive = await exec('sh', ['-c', `git -C '${oi}' archive '${oiCommit}' site desktop/cradle/expressions-app/collections | tar -x -C '${oiDir}'`]);
  void archive;
  const overlaid = [];
  for (const rel of overlay) {
    const bytes = await readFile(join(oi, rel));
    await mkdir(dirname(join(oiDir, rel)), { recursive: true });
    await writeFile(join(oiDir, rel), bytes);
    overlaid.push({ path: rel, sha256: sha256(bytes) });
  }
  const site = join(oiDir, 'site');
  // Dependencies are tooling, not content: linked from an existing install so the build needs no network.
  await exec('ln', ['-s', resolve(nodeModulesFrom, 'vendor/quartz/node_modules'), join(site, 'vendor/quartz/node_modules')]);
  await exec('ln', ['-s', resolve(nodeModulesFrom, 'node_modules'), join(site, 'node_modules')]);
  await exec(process.execPath, [join(site, 'build-essay-quartz.mjs')], {
    cwd: site, maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, OI_ESSAY_REPO: vaultDir, OI_PCD_S_PRODUCTS_ROOT: join(pcdDir, 'production/s-products') },
  });
  const edition = join(site, '.public-edition/essay');
  const receipt = await readJson(join(edition, 'quartz-source.json'));
  if (receipt.working_tree_dirty) throw new Error('the edition was built from a dirty tree; a World package pins a commit');
  if (receipt.vault_commit !== vaultCommit) throw new Error(`the edition was built from ${receipt.vault_commit}, not ${vaultCommit}`);

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(edition, join(out, 'edition'), { recursive: true });
  // The reader companion's practices, verbatim from the pinned commit.
  await cp(join(vaultDir, 'submission-package/epi-logos'), join(out, 'praxis'), { recursive: true });
  await mkdir(join(out, 'source'), { recursive: true });
  await cp(join(vaultDir, 'submission-package/MANIFEST.json'), join(out, 'source/vault-MANIFEST.json'));

  const essayDir = join(vaultDir, 'submission-package/essay');
  return finalizeWorld({ out, essayDir, vaultDir, vaultCommit, pcdCommit, oiCommit, receipt, siteDir: site, scratch, overlaid });
}

async function finalizeWorld({ out, essayDir, vaultDir, vaultCommit, pcdCommit, oiCommit, receipt, siteDir, overlaid = [] }) {
  const d = await describeEdition(join(out, 'edition'));
  // The declared-dependency closure is computed from the published SOURCE (the staged inputs), through the site's own selection law.
  const sourceModule = await import(pathToFileURL(join(siteDir, 'essay-source.mjs')).href);
  const inputs = await sourceModule.readEssayInputs(essayDir);
  const texts = new Map(inputs.entries.filter((e) => e.kind === 'markdown').map((e) => [e.rel, e.bytes.toString('utf8')]));
  const closure = closeDependencies(inputs.entries, texts, (p) => existsSync(join(essayDir, p)));
  closure.dispositions = dispositionSourceDefects(closure.unresolved_all, { published: new Set(inputs.entries.map((e) => e.rel)), vaultIndex: await indexVault(essayDir), declaredWithheld: closure.withheld_declared });
  const vault = await verifyAgainstVault(d, essayDir, null);
  const bindings = await expressionSourceBindings(siteDir, essayDir, vaultDir);
  return assemblePackage({ out, vaultCommit, pcdCommit, oiCommit, receipt, closure, bindings, vault, publishedInputs: inputs.entries.length, overlaid });
}

/** Describe, verify and seal a package whose `edition/` and `praxis/` are already in place. Every count comes from the artifact. */
export async function assemblePackage({ out, vaultCommit, pcdCommit, oiCommit, receipt, closure, bindings, vault, publishedInputs, overlaid = [] }) {
  const d = await describeEdition(join(out, 'edition'));
  const pages = await readAllPages(join(out, 'edition'), d);
  const expressions = await verifyExpressions(join(out, 'edition'), d);
  await mkdir(join(out, 'source'), { recursive: true });
  const sourceDisp = closure.dispositions ?? dispositionSourceDefects(closure.unresolved_all, { declaredWithheld: closure.withheld_declared ?? [] });
  const editionDisp = dispositionEditionDefects(pages.dangling_all, sourceDisp.table, { slugs: d._slugs });
  await writeFile(join(out, 'source/dependency-defects.json'), JSON.stringify({
    schema: 'oi.world-dependency-defects/v2', vault_commit: vaultCommit,
    meaning: 'declared references that resolve to no published page or file, each with its disposition: withheld by design, external, an authoring defect (with the repair that exists) or a publication defect. Defects stay listed so they can be repaired at their owner.',
    source_references_unresolved: sourceDisp.references,
    edition_links_to_no_page: editionDisp.links,
    edition_fragments_missing: editionDisp.fragments,
  }, null, 1) + '\n');
  const skills = (await readdir(join(out, 'praxis/skills'), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const praxisFiles = await walkFiles(join(out, 'praxis'));
  // The reader SkillSet: the source-owned skills (all that ship) plus the QL/MEF specialist capsules owned elsewhere.
  await mkdir(join(out, 'praxis-skillset'), { recursive: true });
  const skillset = readerSkillset(skills);
  await writeFile(join(out, 'praxis-skillset/members'), skillsetMembersFile(skillset));
  const packaged = (await walkFiles(out)).filter((f) => f !== MANIFEST_NAME && f !== FILES_NAME);
  const files = await digestFiles(out, packaged);
  const fileList = { schema: 'oi.world-files/v1', files };
  const manifest = {
    schema: WORLD_SCHEMA,
    world_id: WORLD_ID,
    title: 'Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality (The Return of Zero)',
    revision: treeDigest(files).slice(0, 16),
    source_addressing: SOURCE_ADDRESSING,
    source: {
      vault: { repo: 'EpiLogos/Antykathera-Essay-Work', commit: vaultCommit, scope: ['submission-package/essay/', 'submission-package/epi-logos/'], working_tree_dirty: receipt.working_tree_dirty, input_sha256: receipt.input_sha256 },
      expression_products: { repo: 'EpiLogos/Point-Cloud-Demo', commit: pcdCommit, path: 'production/s-products' },
      edition_build: { repo: 'EpiLogos/O-I', commit: oiCommit, pinned: overlaid.length === 0, ...(overlaid.length ? { uncommitted_overlay: overlaid, note: 'built with these files from an uncommitted working tree over the pinned archive; rebuild from a commit containing them to pin the package' } : {}), paths: ['site/build-essay-quartz.mjs', 'site/essay-source.mjs', 'site/essay-expressions.mjs', 'site/essay-expression-map.json', 'site/vendor/quartz', 'desktop/cradle/expressions-app/collections/return-of-zero'], quartz: { upstream: 'jackyzha0/quartz', commit: receipt.quartz_commit, vendored_with_local_modifications: 'site/vendor/quartz/PROVENANCE.json' } },
    },
    counts: {
      pages: d.pages, structure: d.structure, depth_classes: d.depth_classes, assets: d.assets, expressions: d.expressions,
      praxis: { skills: skills.length, skill_names: skills, files: praxisFiles.length },
      media_note: 'images, figures and SVGs are the published assets under symbolon/*/{diagrams,plates,media,figures,images}; audio/video appear only if listed under assets.by_extension',
    },
    dependency_closure: {
      basis: 'the published source markdown at the pinned commit, through the site\'s own selection law (essay-source.mjs readEssayInputs)',
      published_inputs: publishedInputs,
      ...Object.fromEntries(Object.entries(closure).filter(([k]) => !['unresolved_all', 'withheld_declared', 'dispositions'].includes(k))),
      full_list: 'source/dependency-defects.json',
      disposition: 'every declared reference is resolved to a published page or asset, external, an in-page anchor, or withheld by rule; each one that is not is recorded in `dispositions` and `source/dependency-defects.json` with a disposition. `dispositions.undispositioned` must be 0; authoring defects stay listed as defects.',
      dispositions: { undispositioned: sourceDisp.undispositioned, references: sourceDisp.references.length, distinct_targets: sourceDisp.distinct_targets, totals: sourceDisp.totals, table: sourceDisp.table },
    },
    expression_source_bindings: bindings,
    verification: {
      source_receipt: { files: vault.receipt_files, matched_vault_bytes: vault.matched, problems: vault.problem_count },
      edition: { pages_read: pages.pages_read, pages_missing: pages.pages_missing.length, links: pages.links, embeds: pages.embeds, dispositions: editionDisp.summary },
      acceptance: {
        declared_internal_references_undispositioned_zero: sourceDisp.undispositioned === 0 && editionDisp.summary.links.undispositioned === 0 && editionDisp.summary.fragments.undispositioned === 0,
        links_into_withheld_desks_zero: (sourceDisp.totals['publication-defect'] ?? 0) === 0 && (editionDisp.summary.links.by_kind['withheld-desk-link'] ?? 0) === 0,
        declared_internal_dependencies_unresolved_zero: closure.declared_internal_unresolved === 0 && pages.links.unresolved_page === 0,
        source_references_unresolved: closure.declared_internal_unresolved, source_reference_dispositions: sourceDisp.totals,
        edition_links_to_no_page: pages.links.unresolved_page, edition_link_dispositions: editionDisp.summary.links.by_disposition,
        edition_fragments_missing: pages.links.unresolved_fragment, edition_fragment_dispositions: editionDisp.summary.fragments.by_disposition,
      },
      ref_round_trip: pages.ref_round_trip, anchor_round_trip: pages.anchor_round_trip,
      expressions: { members: expressions.members, hash_verified: expressions.verified, problems: expressions.problems },
    },
    exclusions: {
      not_in_the_package: ['quilt/ (working ledgers)', 'reference-notes/', 'private/', 'templates/', 'working/ (private working desks, including transcripts)', 'personal Control or Central ground', 'credentials, tokens or keys', 'the author checkout and its Git history', 'Expression journeys other than the 135 curated members', 'legacy field-study, demo and starter collections'],
      withheld_references_remain_as_plain_labels: 'markdown links and wikilinks into withheld desks (and bare wikilinks naming withheld notes) are unlinked at staging and read as plain labels (essay-source.mjs stageEssayInputs)',
      third_party_works: 'bibliographic and source-house pages are published; the underlying third-party works are not redistributed',
    },
    files: { count: files.length, bytes: files.reduce((s, f) => s + f.bytes, 0), tree_sha256: treeDigest(files), list_sha256: sha256(JSON.stringify(files)), list: FILES_NAME },
    praxis: { dir: 'praxis', source: 'submission-package/epi-logos/ at the vault commit, verbatim', skillset },
    built_at: new Date().toISOString(),
  };
  await writeFile(join(out, FILES_NAME), JSON.stringify(fileList, null, 1) + '\n');
  await writeFile(join(out, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// ---------------------------------------------------------------------------------------------------------------------
// The reader/expressive praxis, composed as an AIKit SkillSet over existing Skill identity
// ---------------------------------------------------------------------------------------------------------------------

export const READER_SOURCE_ID = 'epi-logos-reader';
/** QL/MEF specialist capsules owned by QL-MEF, composed by reference; they are not part of this package. */
export const QL_SPECIALISTS = ['skill/ql/ql-foundations', 'skill/ql/ql-operation', 'skill/ql/vak-coordinate-frame'];

export function readerSkillset(skillNames) {
  return {
    name: 'epi-logos-reader',
    semantic_ref: 'epi-logos:reader',
    source_id: READER_SOURCE_ID,
    description: 'The reader and expressive praxis of the Return-of-Zero World: bootstrap, linked-vault reading, pedagogy, investigation and the QL/MEF specialist lenses — composed, not merged; each stays its own Skill.',
    source_owned: skillNames.map((n) => `skill/${READER_SOURCE_ID}/${n}`),
    specialist_owned: QL_SPECIALISTS,
    selection: 'selective: nothing here is a per-turn prompt; AIKit projects and discloses the members a scope enables',
  };
}
export const skillsetMembersFile = (set) => `# One capsule id per line. A set is a folder; this is its membership.\n# Generated from the World package; source-owned members bind to praxis/skills, specialist members to QL-MEF.\n${[...set.source_owned, ...set.specialist_owned].join('\n')}\n`;

/** Every source-owned member resolves to a Skill that ships in praxis/skills (name, SKILL.md, frontmatter name); returns what does not. */
export async function verifyPraxisBinding(packageDir) {
  const manifest = await readJson(join(packageDir, MANIFEST_NAME));
  const members = (await readFile(join(packageDir, 'praxis-skillset/members'), 'utf8')).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const unbound = [], bound = [];
  for (const id of members) {
    const m = new RegExp(`^skill/${READER_SOURCE_ID}/([^/]+)$`).exec(id);
    if (!m) continue;   // specialist, owned elsewhere
    const skill = join(packageDir, 'praxis/skills', m[1], 'SKILL.md');
    const text = await readFile(skill, 'utf8').catch(() => null);
    const name = text && /^name:\s*["']?([^"'\n]+)["']?\s*$/m.exec(text)?.[1];
    if (text && name === m[1]) bound.push(id); else unbound.push({ id, why: !text ? 'no SKILL.md' : `frontmatter name is ${name ?? 'absent'}` });
  }
  const shipped = (await readdir(join(packageDir, 'praxis/skills'), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  const inSet = new Set(members.map((id) => id.split('/').pop()));
  return { set: manifest.praxis.skillset.semantic_ref, members: members.length, bound: bound.length, unbound, shipped_but_unlisted: shipped.filter((n) => !inSet.has(n)) };
}

/** Machine-local, explicit: register the installed praxis as an AIKit source and create the set. Never runs on install by default. */
export async function registerPraxis(installedDir, { aikit = 'aikit', aikitHome, cwd } = {}) {
  const manifest = await readJson(join(installedDir, MANIFEST_NAME));
  const env = { ...process.env, ...(aikitHome ? { AIKIT_HOME: aikitHome } : {}) };
  const run = async (args) => JSON.parse((await exec(aikit, ['--json', ...args], { env, cwd, maxBuffer: 16 * 1024 * 1024 })).stdout).data;
  const skills = join(installedDir, 'praxis/skills');
  const known = await run(['source', 'show', READER_SOURCE_ID]).catch(() => null);
  if (!known) await run(['source', 'add-directory', READER_SOURCE_ID, skills]);
  await run(['source', 'sync', READER_SOURCE_ID]);
  await run(['source', 'promote', READER_SOURCE_ID]);
  const set = manifest.praxis.skillset;
  const ids = [...set.source_owned, ...set.specialist_owned];
  await run(['set', 'create', set.name, ...ids]).catch(async () => { await run(['set', 'add', set.name, ...ids]); });
  return { source: READER_SOURCE_ID, set: set.name, members: ids.length };
}

/** The curated Expression collection binds essay files by SHA-256 at the essay commit it was exported against. */
export async function expressionSourceBindings(siteDir, essayDir, vaultDir) {
  const collections = join(siteDir, '../desktop/cradle/expressions-app/collections/return-of-zero');
  const envelope = await readJson(join(collections, 'PUBLICATION-CURATED.json'));
  let total = 0, match = 0; const missing = [], differ = [];
  for (const ref of envelope.manifests) {
    for (const b of ref.source_bindings ?? []) {
      total++;
      const file = join(vaultDir, b.path);
      if (!existsSync(file)) { missing.push(b.path); continue; }
      if (sha256(await readFile(file)) === b.sha256) match++; else differ.push(b.path);
    }
  }
  return {
    exported_against_essay_commit: envelope.source_revision?.commit ?? null, bindings: total, match, missing: missing.length, differ: differ.length,
    missing_sample: [...new Set(missing)].slice(0, 5), differ_sample: [...new Set(differ)].slice(0, 5),
    meaning: 'bindings pin the essay files the Expression bodies were authored against; missing/differ means the essay moved after the Expressions were exported (aboutness by page pattern still applies via essay-expression-map.json)',
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const option = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const all = (name) => rest.flatMap((a, i) => a === name ? [rest[i + 1]] : []);
  try {
    if (command === 'build') {
      const manifest = await buildWorld({ vault: option('--vault'), vaultCommit: option('--vault-commit'), pcd: option('--pcd'), pcdCommit: option('--pcd-commit'),
        oi: option('--oi'), oiCommit: option('--oi-commit'), nodeModulesFrom: option('--node-modules-from'), out: resolve(option('--out') ?? ''), scratch: option('--scratch'), overlay: all('--overlay') });
      process.stdout.write(JSON.stringify({ built: option('--out'), revision: manifest.revision, counts: manifest.counts, dependency_closure: manifest.dependency_closure }, null, 2) + '\n');
    } else if (command === 'verify') {
      const dir = resolve(rest.find((a) => !a.startsWith('--')) ?? '');
      const verdict = await verifyPackage(dir, { vaultEssayDir: option('--vault') });
      process.stdout.write(JSON.stringify({ ok: verdict.ok, problems: verdict.problems, pages: verdict.pages, expressions: { members: verdict.expressions.members, verified: verdict.expressions.verified }, vault: verdict.vault, dispositions: verdict.dispositions, undispositioned: verdict.dispositions ? verdict.dispositions.links.undispositioned + verdict.dispositions.fragments.undispositioned : null }, null, 2) + '\n');
      process.exit(verdict.ok ? 0 : 1);
    } else if (command === 'install') {
      const installed = await installPackage(resolve(rest.find((a) => !a.startsWith('--')) ?? ''), { root: option('--root') ?? defaultWorldsRoot() });
      if (rest.includes('--register-praxis')) installed.praxis = await registerPraxis(installed.installed, { aikit: option('--aikit') ?? 'aikit', aikitHome: option('--aikit-home') });
      process.stdout.write(JSON.stringify(installed, null, 2) + '\n');
    } else if (command === 'mutation-probe') {
      const probe = await ordinaryReadingMutations(resolve(rest.find((a) => !a.startsWith('--')) ?? ''), { extraRoots: rest.filter((a, i) => rest[i - 1] === '--also').map((p) => resolve(p)) });
      process.stdout.write(JSON.stringify(probe, null, 2) + '\n');
      process.exit(probe.mutations === 0 ? 0 : 1);
    } else if (command === 'praxis-check') {
      const verdict = await verifyPraxisBinding(resolve(rest.find((a) => !a.startsWith('--')) ?? ''));
      process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
      process.exit(verdict.unbound.length ? 1 : 0);
    } else if (command === 'register-praxis') {
      process.stdout.write(JSON.stringify(await registerPraxis(resolve(rest.find((a) => !a.startsWith('--')) ?? ''), { aikit: option('--aikit') ?? 'aikit', aikitHome: option('--aikit-home') }), null, 2) + '\n');
    } else if (command === 'resolve') {
      const resolved = await resolveWorld({ root: option('--root') ?? defaultWorldsRoot(), verify: rest.includes('--verify') });
      process.stdout.write(JSON.stringify(resolved, null, 2) + '\n');
      process.exit(resolved.state === 'available' ? 0 : 1);
    } else {
      process.stderr.write('usage: essay-world.mjs build|verify|install|resolve …\n');
      process.exit(2);
    }
  } catch (error) {
    process.stderr.write(`essay-world: ${error.message}\n`);
    process.exit(1);
  }
}
