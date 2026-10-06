/**
 * The corpus structure a source hands the field, and every question the field asks of it.
 *
 * One index feeds the explorer, the breadcrumb footer, the graph, the connections list and search,
 * so the visual and the text accounts cannot disagree about "here". It is a derived projection of
 * the source (the essay's `fieldIndex.json` is one such), rebuildable from it; nothing in it is
 * authoritative over the source's own reads.
 *
 * Pure: no DOM, no fetch.
 */
import type {FieldRef} from "./model";
import type {FieldFacet, FieldGroup, FieldIndexData, FieldNode, FieldSequence, FieldTreeNode} from "./source";

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/ß/g, "ss");

export interface Neighbours { out: FieldRef[]; in: FieldRef[]; all: FieldRef[] }
export interface TreeEntry extends FieldTreeNode { parent: TreeEntry | null; children: TreeEntry[] }
export interface Hit { ref: FieldRef; score: number }
export interface SequencePlace { sequence: FieldSequence; at: FieldSequence["items"][number] | null }

export class CorpusIndex {
  readonly groups: FieldGroup[];
  readonly facets: FieldFacet[];
  readonly nodes: FieldNode[];
  readonly home: FieldRef;
  readonly defaultOpen: string[];
  readonly footnote: string;
  readonly tree: TreeEntry;
  readonly sequences: FieldSequence[];
  private readonly byRef = new Map<FieldRef, number>();
  private readonly outs: number[][];
  private readonly ins: number[][];
  private readonly deg: number[];
  private readonly treeById = new Map<string, TreeEntry>();
  private readonly leaf = new Map<FieldRef, TreeEntry>();
  private readonly xs: Map<FieldRef, FieldRef[]>;
  private readonly seqByRef = new Map<FieldRef, SequencePlace>();
  private folded: string[] | null = null;
  private pathFolded: string[] | null = null;
  private textFolded: string[] | null = null;
  private textRaw: string[] | null = null;

  constructor(data: FieldIndexData) {
    this.groups = data.groups; this.facets = data.facets; this.nodes = data.nodes; this.home = data.home; this.sequences = data.sequences;
    this.defaultOpen = data.defaultOpen ?? data.tree.children.filter(c => c.kind === "section").map(c => c.key ?? c.id);
    this.footnote = data.footnote ?? "";
    data.nodes.forEach((n, i) => this.byRef.set(n.ref, i));
    this.outs = data.nodes.map(() => []); this.ins = data.nodes.map(() => []);
    const seen = new Set<string>();
    for (const [a, b] of data.links) {
      const ia = this.byRef.get(a), ib = this.byRef.get(b);
      if (ia == null || ib == null || ia === ib) continue;
      const key = ia + ">" + ib; if (seen.has(key)) continue; seen.add(key);
      this.outs[ia].push(ib); this.ins[ib].push(ia);
    }
    this.deg = data.nodes.map((_, i) => new Set([...this.outs[i], ...this.ins[i]]).size);
    this.xs = new Map(Object.entries(data.expressionsOf));
    const link = (f: FieldTreeNode, parent: TreeEntry | null): TreeEntry => {
      const e = f as TreeEntry; e.parent = parent;
      this.treeById.set(e.id, e);
      if (e.ref && !this.leaf.has(e.ref)) this.leaf.set(e.ref, e);
      e.children.forEach(c => link(c, e));
      return e;
    };
    this.tree = link(data.tree, null);
    for (const seq of data.sequences) {
      this.seqByRef.set(seq.ref, {sequence: seq, at: null});
      for (const it of seq.items) if (!this.seqByRef.has(it.ref)) this.seqByRef.set(it.ref, {sequence: seq, at: it});
    }
  }

  has(ref: FieldRef) { return this.byRef.has(ref); }
  node(ref: FieldRef | null | undefined): FieldNode | undefined { return ref == null ? undefined : this.nodes[this.byRef.get(ref) ?? -1]; }
  degree(ref: FieldRef) { return this.deg[this.byRef.get(ref) ?? -1] ?? 0; }
  group(id: string) { return this.groups.find(g => g.id === id); }
  expressionsOf(ref: FieldRef | null | undefined): FieldRef[] { return ref == null ? [] : this.xs.get(ref) ?? []; }

  /** The neighbourhood of a page: what it cites, what cites it. Index and README pages are left out unless
   * `hubs` is on or the page is itself one. */
  neighbours(ref: FieldRef, hubs = false): Neighbours {
    const i = this.byRef.get(ref); if (i == null) return {out: [], in: [], all: []};
    const hub = !!this.nodes[i].hub, keep = (j: number) => hubs || hub || !this.nodes[j].hub;
    const out = this.outs[i].filter(keep).map(j => this.nodes[j].ref), inn = this.ins[i].filter(keep).map(j => this.nodes[j].ref);
    return {out, in: inn, all: [...new Set([...out, ...inn])]};
  }
  counts(ref: FieldRef) {
    const i = this.byRef.get(ref); if (i == null) return {cites: 0, citedBy: 0, hubIn: 0};
    const hub = !!this.nodes[i].hub, keep = (j: number) => hub || !this.nodes[j].hub;
    return {cites: this.outs[i].filter(keep).length, citedBy: this.ins[i].filter(keep).length, hubIn: this.ins[i].filter(j => this.nodes[j].hub).length};
  }
  /** Unfiltered counts (the article head says "cites n · cited by m" over every link). */
  rawCounts(ref: FieldRef) { const i = this.byRef.get(ref); return i == null ? {cites: 0, citedBy: 0} : {cites: this.outs[i].length, citedBy: this.ins[i].length}; }
  /** Links of any kind between two refs that are both in `refs` (the faint web among the drawn nodes). */
  linksFrom(ref: FieldRef): FieldRef[] { const i = this.byRef.get(ref); return i == null ? [] : this.outs[i].map(j => this.nodes[j].ref); }
  hubNeighbourCount(ref: FieldRef) {
    const i = this.byRef.get(ref); if (i == null) return 0;
    return new Set([...this.outs[i], ...this.ins[i]].filter(j => this.nodes[j].hub)).size;
  }

  /* ───────── structure ───────── */
  entry(id: string) { return this.treeById.get(id); }
  /** Root-to-page chain of structure nodes (explorer path = footer breadcrumbs); the root itself is excluded. */
  pathOf(ref: FieldRef): TreeEntry[] {
    const chain: TreeEntry[] = [];
    for (let f: TreeEntry | null = this.leaf.get(ref) ?? null; f && f.kind !== "root"; f = f.parent) chain.unshift(f);
    return chain;
  }
  whereOf(ref: FieldRef): string {
    const ch = this.pathOf(ref).slice(0, -1).map(f => f.label);
    const n = this.node(ref);
    return ch.length ? ch.join(" › ") : this.facets.find(f => f.id === n?.facet)?.name ?? "";
  }
  /** The first page at or under a structure node (a folder with no page of its own opens what is in it). */
  firstLeaf(f: TreeEntry): FieldRef | null {
    if (f.ref) return f.ref;
    for (const c of f.children) { const x = this.firstLeaf(c); if (x) return x; }
    return null;
  }

  /* ───────── sequences (a manuscript's movements) ───────── */
  sequenceAt(ref: FieldRef): SequencePlace | undefined { return this.seqByRef.get(ref); }
  /** The page the field's locus stands on: a sequence page at a position stands on that position's page. */
  focusFor(ref: FieldRef, span?: string): FieldRef {
    const seq = this.sequences.find(s => s.ref === ref);
    if (!seq || !span) return ref;
    return seq.items.find(it => it.span === span)?.ref ?? ref;
  }

  /* ───────── search ───────── */
  private prepare() {
    if (this.folded) return;
    this.folded = this.nodes.map(n => fold(n.title + " " + n.label + " " + n.coord));
    this.pathFolded = this.nodes.map(n => fold(n.path));
  }
  /** Full text arrives later and only when asked for; titles and paths keep answering without it. */
  setText(text: ReadonlyMap<FieldRef, string>) {
    this.textRaw = this.nodes.map(n => (text.get(n.ref) ?? "").replace(/\s+/g, " ").trim());
    this.textFolded = this.nodes.map((n, i) => fold(n.title + " \n " + this.textRaw![i]));
  }
  get hasText() { return !!this.textFolded; }
  rawText(ref: FieldRef) { const i = this.byRef.get(ref); return i == null ? "" : this.textRaw?.[i] ?? ""; }

  static parseQuery(raw: string) {
    const phrases: string[] = [], tokens: string[] = [];
    raw = raw.replace(/"([^"]+)"/g, (_, p) => { phrases.push(fold(p.trim())); return " "; });
    raw.split(/\s+/).filter(Boolean).forEach(t => tokens.push(fold(t)));
    return {phrases, tokens, terms: [...phrases, ...tokens]};
  }
  /** Titles and paths at once; with full text loaded, density of hits counts too. */
  search(query: string): { hits: Hit[]; terms: string[] } {
    this.prepare();
    const {terms} = CorpusIndex.parseQuery(query), hits: Hit[] = [];
    if (!terms.length) return {hits, terms};
    for (let i = 0; i < this.nodes.length; i++) {
      const title = this.folded![i], path = this.pathFolded![i], body = this.textFolded?.[i];
      let score = 0, ok = true;
      for (const term of terms) {
        const inPath = path.includes(term), inTitle = title.includes(term);
        let pos = (body ?? title).indexOf(term);
        if (pos < 0 && !inPath && !inTitle) { ok = false; break; }
        let c = 0;
        while (pos >= 0 && c < 30) { c++; pos = (body ?? title).indexOf(term, pos + term.length); }
        score += c + (inPath ? 12 : 0);
        if (inTitle) score += 40 + (title.startsWith(term) ? 20 : 0);
      }
      if (!ok) continue;
      const n = this.nodes[i];
      if (n.hub) score *= 0.35;
      if (n.kind === "movement" || n.kind === "room" || n.kind === "manuscript") score += 8;
      hits.push({ref: n.ref, score});
    }
    hits.sort((a, b) => b.score - a.score);
    return {hits, terms};
  }
}

/** Count a structure node's pages the way the explorer shows them. */
export function naturalCompare(a: string, b: string) { return a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}); }
