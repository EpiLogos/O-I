/**
 * What the field reads: a `FieldSource` adapter.
 *
 * The field (Base's default centre) never learns what a corpus *is*. A source tells it:
 *
 *   load()      the corpus structure once — nodes, links, the explorer tree, which pages have
 *               Expressions, ordered sequences (a manuscript's movements) — as a `CorpusIndex`
 *               the graph, connections list, explorer, breadcrumbs and search all read, so they
 *               can never disagree about the neighbourhood.
 *   read(ref)   one page: body, head, and the exact `sourceRef` + `sourceRevision` it was read at.
 *               A revision the caller holds that no longer matches is *refused*, not coerced.
 *   expressions the Expressions the corpus offers, and the pages they are *about*.
 *   searchText  deeper text on demand — never needed for the instant title/path search.
 *
 * Two adapters implement it: `generic/` (a linked local corpus, no essay semantics) and
 * `epi/essaySource.ts` (the published essay edition). Refs are native stable refs
 * (`central:source:{world}:{path}`); slugs, ordinals and file names are display only.
 */
import type {FieldRef} from "./model";
import type {CorpusIndex} from "./corpusIndex";

/** A colour/region of the graph and explorer. `tone` names a field colour token (`--c-<tone>`). */
export interface FieldGroup { id: string; label: string; tone: string }
/** A way hits cluster (the six stations of the essay; top-level folders of an ordinary corpus). */
export interface FieldFacet { id: string; name: string; tone: string; gloss?: string }

export interface FieldNode {
  ref: FieldRef;
  title: string;
  /** The short reading label (a movement's name without its section prefix). */
  label: string;
  coord?: string;
  group: string;
  facet: string;
  kind: string;
  /** Index/README pages: left out of the neighbourhood unless asked for. */
  hub?: boolean;
  words?: number;
  revision?: string;
  /** Display-only path (never an identity). */
  path: string;
}

export interface FieldTreeNode {
  id: string;
  kind: "root" | "section" | "folder" | "leaf";
  label: string;
  ref?: FieldRef;
  coord?: string;
  group?: string;
  gloss?: string;
  key?: string;
  hidden?: boolean;
  generic?: boolean;
  count: number;
  vcount: number;
  children: FieldTreeNode[];
}

/** An ordered run of positions on one page (a manuscript's movements), each of which is also a page. */
export interface FieldSequence {
  ref: FieldRef;
  label: string;
  items: { span: string; ref: FieldRef; label: string; coord: string; section: { id: string; label: string; coord?: string; ref?: FieldRef } }[];
}

export interface FieldIndexData {
  groups: FieldGroup[];
  facets: FieldFacet[];
  nodes: FieldNode[];
  links: [FieldRef, FieldRef][];
  tree: FieldTreeNode;
  /** page ref → Expression refs it is about */
  expressionsOf: Record<FieldRef, FieldRef[]>;
  sequences: FieldSequence[];
  /** The page a first-time reader lands on. */
  home: FieldRef;
  /** Explorer rows (tree keys) open until the reader decides otherwise. */
  defaultOpen?: string[];
  /** The line under the explorer ("8 rooms · 48 movements"); the page count is added by the field. */
  footnote?: string;
}

export interface PagerItem { ref: FieldRef; label: string; sub?: string }
export interface FieldReading {
  ref: FieldRef;
  /** The revision this body was read at. */
  revision: string;
  sourceRef: string;
  sourceRevision: string;
  title: string;
  head: { eyebrow: string[]; deck?: string; meta: string[] };
  format: "html" | "markdown";
  /** Trusted, owner-produced markup of a pinned source (format "html") or markdown. */
  body: string;
  /** Stylesheets the body needs beyond the field's own (maths). Loaded once, by URL. */
  stylesheets?: string[];
  pager?: { prev?: PagerItem; next?: PagerItem; room?: PagerItem };
}

export interface FieldExpressionScene { id: string; name: string; character: string }
export interface FieldExpression {
  /** The Expression's own ref (native identity of the collection member). */
  ref: FieldRef;
  title: string;
  summary: string;
  collection: string;
  group: string;
  scenes: FieldExpressionScene[];
  /** The pages this Expression is about. */
  about: FieldRef[];
  cover?: string;
  digest?: string;
}
export interface FieldExpressionIndex { entries: FieldExpression[]; collections: { id: string; label: string; count: number; detail?: string }[] }

export interface NativeSourceFacts { project: string; location: import("../kernel/location").CentralLocation; revision: string; content: string; title: string }

export interface FieldStanding { state: "available" | "partial" | "unavailable"; reason: string; owner: string }

export class FieldStaleRevision extends Error {
  ref: FieldRef;
  held: string;
  current: string;
  constructor(ref: FieldRef, held: string, current: string) {
    super(`${ref} was read at revision ${held}, but the source now stands at ${current}`);
    this.name = "FieldStaleRevision";
    this.ref = ref; this.held = held; this.current = current;
  }
}

export interface FieldSource {
  id: string;
  label: string;
  world_ref: string;
  standing(): Promise<FieldStanding>;
  load(): Promise<CorpusIndex>;
  read(ref: FieldRef, opts?: { revision?: string }): Promise<FieldReading>;
  expressions?(): Promise<FieldExpressionIndex | null>;
  /** How an Expression is played inside a tab: a frame onto its renderer, or null when this edition has none. */
  expressionView?(entry: FieldExpression, scene: string | undefined, theme: "light" | "dark"): { kind: "frame"; url: string } | null;
  /** The corpus's own shortening of an Expression title for tabs and cards. */
  shortTitle?(title: string): string;
  /** The corpus's own wording for collections in the Library view. */
  libraryNames?(): Record<string, string>;
  /** Full text, fetched only when the reader asks for more than titles. */
  searchText?(): Promise<ReadonlyMap<FieldRef, string>>;
  /** A cover image for an Expression card, if the source has one. */
  coverUrl?(entry: FieldExpression): string | undefined;
  /** The page as a native Central source a constellation can cite: where it lives (the owner's own location), its revision
   * and text, and the Project whose Wiki would hold the constellation. Undefined when the page is not such a source — a
   * published edition's pages, for example, are read but not cited from here. */
  nativeSource?(ref: FieldRef): Promise<NativeSourceFacts | undefined>;
  /** A renderer (an Expression frame) asked to open something by the corpus's own name for it. */
  resolveToken?(token: string): FieldRef | undefined;
  /** Native identity → how the host opens the exact source (editor, history). */
  sourceOf?(ref: FieldRef): { location?: string; revision?: string } | undefined;
}

/** The canonical source ref (Source Change Horizon grammar): `central:source:{world}:{escaped-path}`;
 * escaping is exact and minimal — `%`, `:` and space. */
export function sourceRef(world: string, path: string): string {
  return `central:source:${world}:${path.replace(/%/g, "%25").replace(/:/g, "%3A").replace(/ /g, "%20")}`;
}
export function parseSourceRef(ref: string): { world: string; path: string } | undefined {
  const m = /^central:source:((?:control:root)|(?:project:[^:]+)):(.*)$/.exec(ref);
  if (!m) return undefined;
  return { world: m[1], path: m[2].replace(/%20/g, " ").replace(/%3A/gi, ":").replace(/%25/g, "%") };
}
