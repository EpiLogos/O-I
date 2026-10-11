// The corpus contract — the structured passage index behind citation deep links.
// Built by the provider's own ingest from its corpus into its published bundle
// (index + one file per volume). The Field contract (field.ts) is untouched: a
// Cite's locator here is resolved, never rewritten.
//
// Named source: atlas `src/types/corpus.ts` @ HEAD 44601d9 (the corpus lane's
// c9732df), carried verbatim per the a3 errata ("carry the optional corpus
// slot") with one seam amendment marked below.

export interface CorpusChapter {
  id: string;
  title: string;
  /** pdf page the chapter heading sits on. */
  p: number;
  /** offset of the heading line within that page's text. */
  off: number;
}

export interface CorpusPage {
  /** pdf page number. */
  p: number;
  /** printed page label as the corpus kept it, when present. */
  print?: string;
  /** id of the chapter this page opened under. */
  ch?: string;
  text: string;
}

/** A ¶ anchor: a span (off/len) inside its page's text. */
export interface CorpusPara {
  para: number;
  p: number;
  off: number;
  len: number;
}

export interface CorpusWork {
  work: string;
  title: string;
  chapters: CorpusChapter[];
  pages: CorpusPage[];
  paras: CorpusPara[];
}

export interface CorpusIndexEntry {
  work: string;
  title: string;
  /** file name under the provider's published corpus bundle. */
  file: string;
  pages: number;
  paras: number;
  chapters: number;
}

export interface CorpusIndex {
  generatedAt: string;
  /** [C2-a3 · the §1.3 law applied to the corpus index] the provider descriptor
   * replaces the found `vaultPath: string` — same seam law as FieldMeta
   * (types/field.ts): the corpus is named by its provider, in data, and the
   * founding provider's ingest re-emits. */
  provider: { id: string; name: string; home?: string };
  works: CorpusIndexEntry[];
}
