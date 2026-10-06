/**
 * The generic field adapter: an ordinary linked local corpus — a project's (or Central's) markdown — read through
 * Central's own file reads. No corpus-specific semantics, names, counts or lens tables:
 *
 *   nodes   every `.md` file under the root (bounded);  title = frontmatter `title`, else the first `# ` heading,
 *           else the file name;  group/facet = the top-level folder it sits in;  README/index pages are "hubs".
 *   links   `[text](relative.md#frag)` and `[[wiki target|alias]]`, resolved against the linking file's folder or by
 *           file name / title — the same two ways any markdown vault links.
 *   tree    the folder structure (a folder with a README/index of its own opens that page).
 *   read    the file's text rendered as markdown (the app's own safe renderer), with `{sourceRef, sourceRevision}` =
 *           the revision the owner's read disclosed; a held revision that no longer matches is REFUSED.
 *
 * Reads go through a `GenericIo` so the same adapter runs on the kernel's file reads in the app and on a plain
 * directory in a node test. Refs are `central:source:{world}:{path in the world}`; paths are display only.
 */
import {CorpusIndex, naturalCompare} from "../corpusIndex";
import {renderMarkdown} from "../../material/markdown";
import {FieldStaleRevision, sourceRef, type FieldGroup, type FieldIndexData, type FieldNode, type FieldReading, type FieldSource, type FieldStanding, type FieldTreeNode} from "../source";
import type {FieldRef} from "../model";

export interface GenericEntry { name: string; path: string; kind: "file" | "directory" }
export interface GenericIo {
  list(path: string): Promise<GenericEntry[]>;
  read(path: string): Promise<{ content: string; revision: string }>;
  bytes?(path: string): Promise<{ base64: string; mime: string | null }>;
}
export interface GenericCorpus {
  /** `project:{id}` or `control:root` — the world that owns the files. */
  world: string;
  /** Where the corpus starts, in the io's own path terms (also the prefix stripped to make world-relative paths). */
  root: string;
  label: string;
  io: GenericIo;
  /** Bounds: a corpus larger than this is read partially and says so. */
  limits?: { dirs: number; files: number; bytes: number; concurrency: number };
}

const DEFAULT_LIMITS = { dirs: 400, files: 1500, bytes: 400_000, concurrency: 8 };
const SKIP_DIR = /^(\.|node_modules$|target$|dist$|build$|__pycache__$)/;
const TONES = ["t0", "t1", "t2", "t3", "t4"];   // the field's five neutral colour tokens (--c-t0…), cycled
const HUB = /^(readme|index)$/i;

const stripExt = (n: string) => n.replace(/\.(md|markdown)$/i, "");
const isMd = (n: string) => /\.(md|markdown)$/i.test(n);
const join = (a: string, b: string) => (a ? a.replace(/\/+$/, "") + "/" + b : b);
const dirOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);
/** Resolve `target` against the folder `from` (both world-relative, no leading slash); undefined if it escapes the root. */
export function resolveRelative(from: string, target: string): string | undefined {
  const out = from ? from.split("/") : [];
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (!out.length) return undefined; out.pop(); } else out.push(seg);
  }
  return out.join("/");
}

export function parseFrontmatter(text: string): { title?: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return {body: text};
  const t = /^title:\s*(.+?)\s*$/m.exec(m[1]);
  return {title: t ? t[1].replace(/^["']|["']$/g, "") : undefined, body: text.slice(m[0].length)};
}
export interface RawLink { kind: "path" | "wiki"; target: string; hash?: string }
/** Links out of one markdown text (code spans and fences excluded). */
export function extractLinks(body: string): RawLink[] {
  const text = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const out: RawLink[] = [];
  for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]/g)) out.push({kind: "wiki", target: m[1].trim(), hash: m[2]});
  for (const m of text.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const raw = m[1];
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue;
    const [pathPart, hash] = raw.split("#");
    let target = pathPart; try { target = decodeURIComponent(pathPart); } catch { /* keep */ }
    if (target) out.push({kind: "path", target, hash});
  }
  return out;
}
export function firstHeading(body: string): string | undefined {
  const m = /^#{1}\s+(.+?)\s*#*\s*$/m.exec(body.replace(/```[\s\S]*?```/g, ""));
  return m ? m[1].replace(/[*_`]/g, "").trim() : undefined;
}
const prettify = (s: string) => { const t = s.replace(/[-_]+/g, " ").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : s; };

interface Scanned { path: string; title: string; label: string; words: number; revision: string; links: RawLink[]; hub: boolean }

export interface GenericModel { data: FieldIndexData; byRef: Map<FieldRef, Scanned>; pathOf: Map<FieldRef, string>; refOfPath: Map<string, FieldRef>; truncated: boolean; scanned: number }

export async function scanCorpus(c: GenericCorpus): Promise<GenericModel> {
  const L = {...DEFAULT_LIMITS, ...c.limits};
  const rel = (p: string) => (c.root && p.startsWith(c.root.replace(/\/+$/, "") + "/") ? p.slice(c.root.replace(/\/+$/, "").length + 1) : p);
  const files: GenericEntry[] = [], queue: string[] = [c.root];
  let dirs = 0, truncated = false;
  while (queue.length) {
    const dir = queue.shift()!;
    if (dirs++ >= L.dirs) { truncated = true; break; }
    let entries: GenericEntry[];
    try { entries = await c.io.list(dir); } catch (e) { if (dir === c.root) throw e; continue; }
    for (const e of entries.sort((a, b) => naturalCompare(a.name, b.name))) {
      if (e.kind === "directory") { if (!SKIP_DIR.test(e.name)) queue.push(e.path); }
      else if (e.kind === "file" && isMd(e.name) && !e.name.startsWith(".")) { if (files.length >= L.files) truncated = true; else files.push(e); }
    }
  }
  const scanned: Scanned[] = new Array(files.length);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(L.concurrency, files.length)}, async () => {
    while (next < files.length) {
      const k = next++, f = files[k];
      try {
        const r = await c.io.read(f.path);
        const fm = parseFrontmatter(r.content.length > L.bytes ? r.content.slice(0, L.bytes) : r.content);
        const stem = stripExt(f.name);
        const title = fm.title ?? firstHeading(fm.body) ?? prettify(stem);
        scanned[k] = {path: rel(f.path), title, label: title, words: (fm.body.match(/\S+/g) ?? []).length, revision: r.revision, links: extractLinks(fm.body), hub: HUB.test(stem)};
      } catch { /* an unreadable file is simply not a node */ }
    }
  }));
  const pages = scanned.filter(Boolean).sort((a, b) => naturalCompare(a.path, b.path));

  // groups: the top-level folder a page sits in
  const top = (p: string) => (p.includes("/") ? p.slice(0, p.indexOf("/")) : "");
  const groupIds = [...new Set(pages.map(p => top(p.path)))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : naturalCompare(a, b)));
  const groups: FieldGroup[] = groupIds.map((id, i) => ({id: id || "(top)", label: id ? prettify(id) : "Top level", tone: TONES[i % TONES.length]}));
  const gid = (p: string) => top(p) || "(top)";
  const tone = (id: string) => groups.find(g => g.id === id)!.tone;

  const refOfPath = new Map<string, FieldRef>(), pathOf = new Map<FieldRef, string>(), byRef = new Map<FieldRef, Scanned>();
  for (const p of pages) { const ref = sourceRef(c.world, p.path); refOfPath.set(p.path, ref); pathOf.set(ref, p.path); byRef.set(ref, p); }
  const nodes: FieldNode[] = pages.map(p => ({
    ref: refOfPath.get(p.path)!, title: p.title, label: p.label, group: gid(p.path), facet: gid(p.path), kind: p.hub ? "index" : "page",
    hub: p.hub || undefined, words: p.words, revision: p.revision, path: p.path,
  }));

  // links: relative paths and wiki names (file name or title, case-folded)
  const byStem = new Map<string, FieldRef | null>();
  const note = (k: string, ref: FieldRef) => { k = k.toLowerCase(); byStem.set(k, byStem.has(k) && byStem.get(k) !== ref ? null : ref); };
  for (const p of pages) { const ref = refOfPath.get(p.path)!; note(stripExt(baseOf(p.path)), ref); note(p.title, ref); note(stripExt(p.path), ref); }
  const links: [FieldRef, FieldRef][] = [];
  for (const p of pages) {
    const from = refOfPath.get(p.path)!;
    for (const l of p.links) {
      let to: FieldRef | undefined | null;
      if (l.kind === "wiki") to = byStem.get(l.target.toLowerCase()) ?? byStem.get(stripExt(baseOf(l.target)).toLowerCase());
      else { const r = resolveRelative(dirOf(p.path), l.target); to = r === undefined ? undefined : refOfPath.get(r) ?? refOfPath.get(r + ".md"); }
      if (to && to !== from) links.push([from, to]);
    }
  }

  // tree: folders, a folder with a README/index of its own opens that page
  let uid = 0;
  const mk = (kind: FieldTreeNode["kind"], label: string, o: Partial<FieldTreeNode> = {}): FieldTreeNode => ({id: "g" + uid++, kind, label, children: [], count: 0, vcount: 0, ...o});
  const root = mk("root", c.label);
  const section = mk("section", c.label, {key: "root"}); root.children.push(section);
  const dirsMap = new Map<string, FieldTreeNode>([["", section]]);
  const folder = (dir: string): FieldTreeNode => {
    let f = dirsMap.get(dir); if (f) return f;
    const parent = folder(dirOf(dir));
    f = mk("folder", prettify(baseOf(dir)), {key: "d:" + dir, group: tone(gid(dir + "/x")), generic: true}); parent.children.push(f); dirsMap.set(dir, f); return f;
  };
  for (const p of pages) {
    const dir = dirOf(p.path), ref = refOfPath.get(p.path)!, g = tone(gid(p.path));
    if (p.hub && dir) { const f = folder(dir); if (f.ref == null) { f.ref = ref; continue; } }
    folder(dir).children.push(mk("leaf", p.label, {ref, group: g}));
  }
  const tidy = (f: FieldTreeNode) => {
    for (const ch of f.children) if (ch.kind !== "leaf") tidy(ch);
    f.children.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "folder" ? -1 : 1) || naturalCompare(a.label, b.label));
    for (const ch of f.children) if (ch.kind === "folder" && !ch.children.length && ch.ref) { ch.kind = "leaf"; ch.count = 1; }
    const own = f.kind === "folder" && f.ref ? 1 : 0;
    f.count = f.children.reduce((s, ch) => s + (ch.kind === "leaf" ? 1 : ch.count), 0) + own;
    f.vcount = f.count;
  };
  tidy(root);

  const homePage = pages.find(p => p.hub && !p.path.includes("/")) ?? pages[0];
  const data: FieldIndexData = {
    groups, facets: groups.map(g => ({id: g.id, name: g.label, tone: g.tone})), nodes, links, tree: root, expressionsOf: {}, sequences: [],
    home: homePage ? refOfPath.get(homePage.path)! : "", defaultOpen: ["root"],
    footnote: truncated ? `read in part — first ${nodes.length.toLocaleString("en-US")} pages` : undefined,
  };
  return {data, byRef, pathOf, refOfPath, truncated, scanned: nodes.length};
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function createGenericFieldSource(c: GenericCorpus): FieldSource & { model(): Promise<GenericModel> } {
  let loading: Promise<{ model: GenericModel; index: CorpusIndex }> | null = null;
  const ensure = () => (loading ??= scanCorpus(c).then(model => ({model, index: new CorpusIndex(model.data)})).catch(e => { loading = null; throw e; }));
  const abs = (p: string) => join(c.root, p);

  const source: FieldSource & { model(): Promise<GenericModel> } = {
    id: "field/linked-corpus", label: c.label, world_ref: c.world,
    model: async () => (await ensure()).model,
    async standing(): Promise<FieldStanding> {
      try {
        const {model} = await ensure();
        if (!model.scanned) return {state: "partial", reason: "No markdown pages were found under this folder.", owner: "Central's file reads"};
        return {state: model.truncated ? "partial" : "available", reason: `${model.scanned.toLocaleString("en-US")} markdown pages${model.truncated ? " (read in part — the corpus is larger than one pass reads)" : ""}`, owner: "Central's file reads"};
      } catch (e) { return {state: "unavailable", reason: e instanceof Error ? e.message : String(e), owner: "Central's file reads"}; }
    },
    async load() { return (await ensure()).index; },
    async read(ref, opts): Promise<FieldReading> {
      const {model, index} = await ensure();
      const path = model.pathOf.get(ref), page = model.byRef.get(ref), node = index.node(ref);
      if (!path || !page || !node) throw new Error(`${ref} is not a page of this corpus`);
      const r = await c.io.read(abs(path));                      // always the owner's current text
      if (opts?.revision && opts.revision !== r.revision) throw new FieldStaleRevision(ref, opts.revision, r.revision);
      const fm = parseFrontmatter(r.content);
      const dir = dirOf(path);
      const images = new Map<string, string>();
      // wiki links become relative links the renderer already understands
      // the page's own title is the article head: a leading `# Title` that says the same thing is not repeated
      const lead = /^\s*#\s+(.+?)\s*#*\s*\r?\n/.exec(fm.body);
      const own = lead && lead[1].replace(/[*_`]/g, "").trim() === node.title ? fm.body.slice(lead[0].length) : fm.body;
      const text = own.replace(/(?<!!)\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/g, (_m, target: string, hash: string | undefined, alias: string | undefined) => `[${alias ?? target}](__wiki__/${encodeURIComponent(target.trim())}${hash ? "#" + hash : ""})`);
      const html = renderMarkdown(text, {resolveAsset: t => {
        const [p0, hash] = t.split("#");
        if (p0.startsWith("__wiki__/")) {
          const tgt = decodeURIComponent(p0.slice(9)).toLowerCase();
          const hit = model.data.nodes.find(n => stripExt(baseOf(n.path)).toLowerCase() === tgt || n.title.toLowerCase() === tgt);
          return hit ? `#oi-ref:${encodeURIComponent(hit.ref)}${hash ? "#" + hash : ""}` : "";
        }
        let dec = p0; try { dec = decodeURIComponent(p0); } catch { /* keep */ }
        const resolved = resolveRelative(dir, dec);
        if (resolved === undefined) return "";
        if (isMd(resolved)) { const to = model.refOfPath.get(resolved); return to ? `#oi-ref:${encodeURIComponent(to)}${hash ? "#" + hash : ""}` : ""; }
        images.set("oi-asset:" + resolved, resolved); return "oi-asset:" + resolved;
      }});
      // images: the owner's byte read, inlined (a file's neighbours stay readable without a file server)
      let body = html;
      if (c.io.bytes) {
        for (const [token, path2] of images) {
          try { const b = await c.io.bytes(abs(path2)); body = body.split(token).join(`data:${b.mime ?? "application/octet-stream"};base64,${b.base64}`); } catch { /* left unresolved: the alt text shows */ }
        }
      }
      // internal link tokens → data-fref (the field maps a click to one operation)
      body = body.replace(/<a href="#oi-ref:([^"#]+)(?:#([^"]*))?"([^>]*)>/g, (_m, ref2: string, hash: string | undefined, rest: string) => `<a href="#" data-fref="${escHtml(decodeURIComponent(ref2))}"${hash ? ` data-fspan="${escHtml(hash)}"` : ""}${rest}>`);
      const trail = index.pathOf(ref).slice(0, -1).map(f => f.label);
      return {
        ref, revision: r.revision, sourceRef: ref, sourceRevision: r.revision, title: node.title,
        head: {eyebrow: trail.length ? [trail[trail.length - 1]] : [c.label], meta: [`${page.words.toLocaleString("en-US")} words`, `cites ${index.rawCounts(ref).cites}`, `cited by ${index.rawCounts(ref).citedBy}`]},
        format: "html", body: `<article class="prose">${body}</article>`,
      };
    },
    searchText: async () => {
      const {model} = await ensure(), out = new Map<FieldRef, string>();
      for (const n of model.data.nodes) { try { out.set(n.ref, parseFrontmatter((await c.io.read(abs(n.path))).content).body); } catch { /* skip */ } }
      return out;
    },
    sourceOf: ref => ({location: ref}),
  };
  return source;
}
