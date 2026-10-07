/**
 * The published essay edition, read as a field: the pure translation from the edition's own derived
 * projections (`static/fieldIndex.json`, `quartz-source.json`, `expressions/index.json`) into the
 * field's native terms.
 *
 * The edition is a derived, source-pinned publication of the Antykathera essay vault. Its page
 * slugs, ordinals (`i`) and movement numbers are *projection details*: they are looked up here and
 * nowhere else, and what leaves this module is native —
 *
 *   ref        central:source:project:{project}:{vault path}   (the Source Change Horizon grammar)
 *   revision   sha256:{file digest from the edition's source receipt}
 *   about      Expression ref `expression:{member id}` ← the pages it is about
 *
 * Domain meaning that is genuinely the essay's (rooms, the 48 movements, stations, the article
 * eyebrow) is confined to this adapter; the field host sees groups, facets, sequences and heads.
 * Pure: no DOM, no fetch, so it is testable against the real built edition.
 */
import {CorpusIndex} from "../corpusIndex";
import {sourceRef, type FieldExpression, type FieldExpressionIndex, type FieldFacet, type FieldGroup, type FieldIndexData, type FieldNode, type FieldSequence, type FieldTreeNode} from "../source";

/* ---- raw edition shapes ---- */
export interface RawNode { i: number; s: string; t: string; lab: string; coord: string; st: string; k: string; r: string; w: number; m?: number; room?: number; sec?: string; pos?: string; hub?: 1; asset?: 1 }
export interface RawTree { id: string; kind: "root" | "section" | "folder" | "leaf"; label: string; reg?: string; ni?: number; coord?: string; gloss?: string; key?: string; xhide?: 1; generic?: 1; count: number; vcount: number; children: RawTree[] }
export interface RawFieldIndex {
  v: number;
  regs: Record<string, string>;
  stations: Record<string, { name: string; reg: string; gloss: string }>;
  nodes: RawNode[];
  links: [number, number][];
  rooms: Record<string, { sec: string; title: string; slug: string; i: number }>;
  moves: Record<string, { i: number; title: string; sec: string; room: number }>;
  tree: RawTree;
  x?: Record<string, string[]>;
}
export interface RawSourceReceipt { vault_commit?: string; vault_remote?: string; files?: { path: string; sha256: string; kind: string }[] }
export interface RawExpressionEntry { id: string; title: string; summary: string; collection: string; group: string; scenes: { id: string; name: string; character: string }[]; nodes: string[]; digest: string; journey: string; cover: string }
export interface RawExpressionIndex { entries: RawExpressionEntry[]; collections: { id: string; label: string; count: number }[] }

export interface EssayAddressing {
  /** `project:{id}` — the Central project that owns the essay vault (the directory name when it has no manifest). */
  world: string;
  /** Where the published scope sits inside that project. */
  prefix: string;
}
export const DEFAULT_ADDRESSING: EssayAddressing = { world: "project:Antykathera-Essay-Work", prefix: "submission-package/essay/" };

/** Quartz's slug for a vault path (what the edition names its pages), so a source receipt's path finds its page. */
export function slugOfVaultPath(path: string): string {
  let p = path.replace(/\.md$/, "");
  p = p.split("/").map(seg => seg.replace(/ /g, "-").replace(/&/g, "-and-").replace(/%/g, "-percent").replace(/\?/g, "").replace(/#/g, "")).join("/");
  return p === "README" ? "index" : p;
}

export interface EssayModel {
  data: FieldIndexData;
  /** slug → ref and back: used only to fetch a page body and resolve links written as site paths. */
  slugOf: Map<string, string>;
  refOfSlug: Map<string, string>;
  raw: Map<string, RawNode>;
  expressions: FieldExpressionIndex | null;
  edition: { commit?: string; remote?: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const expressionRef = (id: string) => `expression:${id}`;
export const expressionId = (ref: string) => ref.replace(/^expression:/, "");

export function buildEssayModel(raw: RawFieldIndex, receipt?: RawSourceReceipt | null, xindex?: RawExpressionIndex | null, addressing: EssayAddressing = DEFAULT_ADDRESSING): EssayModel {
  const digests = new Map<string, { path: string; sha: string }>();
  for (const f of receipt?.files ?? []) if (f.kind === "markdown") digests.set(slugOfVaultPath(f.path), { path: f.path, sha: f.sha256 });

  const slugOf = new Map<string, string>(), refOfSlug = new Map<string, string>(), rawBy = new Map<string, RawNode>();
  const refAt: string[] = [];
  for (const n of raw.nodes) {
    const d = digests.get(n.s);
    // A page the receipt does not list keeps a ref derived from its slug — present, but with no revision to pin.
    const ref = sourceRef(addressing.world, addressing.prefix + (d?.path ?? n.s + ".md"));
    refAt[n.i] = ref; slugOf.set(ref, n.s); refOfSlug.set(n.s, ref); rawBy.set(ref, n);
  }

  const groups: FieldGroup[] = Object.entries(raw.regs).map(([id, label]) => ({ id, label, tone: id }));
  const facets: FieldFacet[] = Object.entries(raw.stations).map(([id, s]) => ({ id, name: s.name, tone: s.reg, gloss: s.gloss }));
  const nodes: FieldNode[] = raw.nodes.map(n => ({
    ref: refAt[n.i], title: n.t, label: n.lab, coord: n.coord || undefined, group: n.r, facet: n.st, kind: n.k,
    hub: n.hub ? true : undefined, words: n.w, path: n.s,
    revision: digests.get(n.s) ? `sha256:${digests.get(n.s)!.sha}` : undefined,
  }));
  const links = raw.links.map(([a, b]) => [refAt[a], refAt[b]] as [string, string]);

  const treeOf = (f: RawTree): FieldTreeNode => ({
    id: f.id, kind: f.kind, label: f.label, ref: f.ni != null ? refAt[f.ni] : undefined, coord: f.coord || undefined, group: f.reg,
    gloss: f.gloss, key: f.key, hidden: f.xhide ? true : undefined, generic: f.generic ? true : undefined, count: f.count, vcount: f.vcount,
    children: f.children.map(treeOf),
  });

  const expressionsOf: Record<string, string[]> = {};
  for (const [i, ids] of Object.entries(raw.x ?? {})) { const ref = refAt[+i]; if (ref) expressionsOf[ref] = ids.map(expressionRef); }

  // The manuscript's movements: a sequence on the manuscript page, each of which is also a page.
  const sequences: FieldSequence[] = [];
  const ms = raw.nodes.find(n => n.s === "THE-RETURN-OF-ZERO");
  if (ms && Object.keys(raw.moves).length) {
    const items = Object.keys(raw.moves).map(Number).sort((a, b) => a - b).map(m => {
      const mv = raw.moves[m], room = raw.rooms[mv.room];
      return { span: "M" + pad(m), ref: refAt[mv.i], label: mv.title, coord: "M" + pad(m), section: { id: "room" + mv.room, label: room?.title ?? "", coord: room?.sec, ref: room ? refAt[room.i] : undefined } };
    });
    sequences.push({ ref: refAt[ms.i], label: "The 48 movements", items });
  }

  const home = raw.nodes.find(n => n.s === "index") ?? raw.nodes.find(n => n.s === "THE-RETURN-OF-ZERO") ?? raw.nodes[0];
  const data: FieldIndexData = {
    groups, facets, nodes, links, tree: treeOf(raw.tree), expressionsOf, sequences, home: refAt[home.i],
    defaultOpen: ["essay", "field", "rooms"], footnote: `${Object.keys(raw.rooms).length} rooms · ${Object.keys(raw.moves).length} movements`,
  };

  let expressions: FieldExpressionIndex | null = null;
  if (xindex?.entries) {
    const entries: FieldExpression[] = xindex.entries.map((e: RawExpressionEntry) => ({
      ref: expressionRef(e.id), title: e.title, summary: e.summary, collection: e.collection, group: e.group, scenes: e.scenes,
      about: e.nodes.map(s => refOfSlug.get(s)).filter((r): r is string => !!r), cover: e.cover, digest: e.digest,
    }));
    expressions = { entries, collections: xindex.collections.map(c => ({ ...c })) };
  }
  return { data, slugOf, refOfSlug, raw: rawBy, expressions, edition: { commit: receipt?.vault_commit, remote: receipt?.vault_remote } };
}

/** What the article head says, as the essay's own eyebrow: station and room, movement of 48, argument coordinate. */
export function essayHead(model: EssayModel, index: CorpusIndex, ref: string): { title: string; eyebrow: string[]; deck?: string; meta: string[] } | undefined {
  const n = model.raw.get(ref); if (!n) return undefined;
  const node = index.node(ref)!;
  const title = ["movement", "room", "reading", "alignment"].includes(n.k) || /^[A-Z0-9-]+$/.test(n.t) ? n.lab : n.t;
  const parts = n.t.split(" — ");
  const deck = n.k === "room" ? parts.slice(2).join(" — ") : n.k === "reading" ? parts.slice(1).join(" — ") : "";
  const mins = Math.max(1, Math.round(n.w / 230));
  const c = index.rawCounts(ref);
  const facets = new Map(index.facets.map(f => [f.id, f]));
  let eyebrow: string[];
  const roomOf = (num: number | undefined) => (num == null ? undefined : [...model.raw.values()].find(r => r.k === "room" && r.room === num));
  if (n.k === "movement") eyebrow = [n.sec ?? "", `Movement ${n.m} of 48`];
  else if (n.k === "room") eyebrow = [n.sec ?? "", `Room ${pad(n.room!)}`];
  else if (n.k === "reading" || n.k === "alignment") { const r = roomOf(n.room); eyebrow = [r?.sec ?? "", r ? r.lab : ""]; }
  else if (n.k === "manuscript") eyebrow = ["Manuscript", n.s === "THE-RETURN-OF-ZERO" ? "M01–M48" : "§0/1"];
  else if (n.k === "argument") eyebrow = ["Argument", n.coord];
  else {
    const chain = index.pathOf(ref).slice(0, -1), st = facets.get(node.facet);
    const tail = chain.length ? chain[chain.length - 1].label : "";
    eyebrow = [st?.name ?? "", tail && tail !== st?.name ? tail : n.k === "core" ? "The relation itself" : ""];
  }
  return {
    title, eyebrow: eyebrow.filter(Boolean), deck: deck || undefined,
    meta: [`${n.w.toLocaleString("en-US")} words`, mins >= 120 ? `${Math.round(mins / 60)} h read` : `${mins} min`, `cites ${c.cites}`, `cited by ${c.citedBy}`],
  };
}

/** The pager under a movement or a room. */
export function essayPager(model: EssayModel, index: CorpusIndex, ref: string) {
  const n = model.raw.get(ref); if (!n) return undefined;
  const seq = index.sequences[0];
  const item = (r: string | undefined, label: string, sub: string) => (r && index.node(r) ? { ref: r, label, sub } : undefined);
  if (n.k === "movement" && n.m != null && seq) {
    const at = (m: number) => seq.items.find(it => it.span === "M" + pad(m));
    const prev = at(n.m - 1), next = at(n.m + 1), room = [...model.raw.values()].find(r => r.k === "room" && r.room === n.room);
    return {
      prev: prev && item(prev.ref, prev.label, `← Movement ${n.m - 1}`),
      next: next && item(next.ref, next.label, `Movement ${n.m + 1} →`),
      room: room && item([...model.raw.entries()].find(([, v]) => v === room)?.[0], `The room · ${n.sec}`, ""),
    };
  }
  if (n.k === "room" && n.room != null) {
    const rooms = [...model.raw.entries()].filter(([, v]) => v.k === "room").sort((a, b) => a[1].room! - b[1].room!);
    const k = rooms.findIndex(([, v]) => v.room === n.room);
    const p = rooms[k - 1], q = rooms[k + 1];
    return { prev: p && item(p[0], p[1].lab, `← Room ${p[1].sec}`), next: q && item(q[0], q[1].lab, `Room ${q[1].sec} →`) };
  }
  return undefined;
}
