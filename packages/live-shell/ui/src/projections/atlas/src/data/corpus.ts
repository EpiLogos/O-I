// Citation deep links: resolve a Cite ("¶452 (pdf p350)") to the actual passage
// in the corpus index the provider's ingest built. Loading is lazy per volume
// and cached; a missing index or volume degrades to "no link", never to an
// invented passage.
//
// Named source: atlas `src/data/corpus.ts` @ HEAD 44601d9 (c9732df), carried
// verbatim; the fetch paths carry the one [C2-a3] amendment (provider-supplied
// paths; the degrade-to-null law stays, untouched).
import type { CorpusIndex, CorpusWork } from '../types/corpus';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** [C2-a3] the corpus paths are provider-supplied (was the fixed
 * `/data/corpus/…`); the default keeps the found layout. The active base is
 * adopted when an index loads — one projection pane carries one active corpus
 * at a time, the same slot law as the sky's SIDECAR_BASE. */
let activeBase = `${BASE}/data/corpus`;

const indexCache = new Map<string, Promise<CorpusIndex | null>>();
const workCache = new Map<string, Promise<CorpusWork | null>>();

export function loadCorpusIndex(from?: string): Promise<CorpusIndex | null> {
  const url = from ?? `${BASE}/data/corpus/index.json`;
  let p = indexCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((res) => (res.ok && !res.headers.get('content-type')?.includes('text/html') ? (res.json() as Promise<CorpusIndex>) : null))
      .then((index) => {
        // [C2-a3] adopt the provider's base so volume fetches resolve beside it
        if (index) activeBase = url.replace(/\/index\.json$/, '');
        return index;
      })
      .catch(() => null);
    indexCache.set(url, p);
  }
  return p;
}

/** True when the cite's work can be opened at all (cheap check used while rendering cite lines). */
export function corpusWorkKnown(known: Set<string>, work: string): boolean {
  return known.has(work);
}

function loadCorpusWork(work: string): Promise<CorpusWork | null> {
  const key = `${activeBase}|${work}`;
  let p = workCache.get(key);
  if (!p) {
    p = fetch(`${activeBase}/${encodeURIComponent(work)}.json`)
      .then((res) => (res.ok && !res.headers.get('content-type')?.includes('text/html') ? (res.json() as Promise<CorpusWork>) : null))
      .catch(() => null);
    workCache.set(key, p);
  }
  return p;
}

/** The ¶ number(s) and pdf page range a Cite locator names. */
export interface LocatorParts {
  para?: number;
  /** inclusive pdf page range, when the cite carries one. */
  pages?: [number, number?];
}

export function parseLocator(locator: string): LocatorParts {
  const para = /¶\s*(\d+)/.exec(locator);
  const page = /pdf\s+p\.?\s*(\d+)(?:\s*[–-]\s*(\d+))?/i.exec(locator);
  return {
    ...(para ? { para: Number(para[1]) } : {}),
    ...(page ? { pages: [Number(page[1]), page[2] ? Number(page[2]) : undefined] } : {}),
  };
}

export interface PassageRef {
  work: string;
  title: string;
  /** pdf page the passage sits on. */
  page: number;
  print?: string;
  chapter?: { id: string; title: string };
  /** ¶ number when the passage is an anchored paragraph. */
  para?: number;
  /** the passage text: the ¶ span, or the page text when the work has no ¶s. */
  text: string;
  /** the whole page text, for the "on the page" context. */
  pageText: string;
  /** ¶ anchors on the page (for prev/next walking). */
  index: number;
}

/**
 * Resolve a Cite to the passage it names, inside one loaded volume (pure; the
 * IO wrapper below adds fetching). Preference: the ¶ on a page inside the cited
 * range; then the ¶ anywhere in the work (essay numbering restarts, so the page
 * disambiguates); then the cited page itself (seminars have no ¶s).
 */
export function resolveInWork(doc: CorpusWork, locator: string): PassageRef | null {
  if (!doc.pages.length) return null;
  const { para, pages } = parseLocator(locator);
  const [pFrom, pTo] = pages ?? [undefined, undefined];
  const inRange = (p: number) => pFrom === undefined || (p >= pFrom && (pTo ?? pFrom) >= p);
  let anchor: { para: number; p: number; off: number; len: number } | undefined;
  if (para !== undefined) {
    const candidates = doc.paras.filter((x) => x.para === para);
    anchor = candidates.find((x) => inRange(x.p)) ?? candidates[0];
  }
  let page = doc.pages.find((pg) => pg.p === (anchor?.p ?? pFrom));
  if (!page && pFrom !== undefined) page = [...doc.pages].reverse().find((pg) => pg.p < pFrom) ?? doc.pages[0];
  if (!page) return null;
  const chapter = page.ch ? doc.chapters.find((c) => c.id === page!.ch) : undefined;
  const text = anchor ? page.text.slice(anchor.off, anchor.off + anchor.len) : page.text;
  const index = anchor ? doc.paras.findIndex((x) => x.para === anchor!.para && x.p === anchor!.p && x.off === anchor!.off) : -1;
  return {
    work: doc.work,
    title: doc.title,
    page: page.p,
    ...(page.print ? { print: page.print } : {}),
    ...(chapter ? { chapter: { id: chapter.id, title: chapter.title } } : {}),
    ...(anchor ? { para: anchor.para } : {}),
    text,
    pageText: page.text,
    index,
  };
}

/** Fetching resolver: the cite's work must be in the loaded index. */
export async function resolvePassage(index: CorpusIndex | null, work: string, locator: string): Promise<PassageRef | null> {
  if (!index || !index.works.some((w) => w.work === work)) return null;
  const doc = await loadCorpusWork(work);
  if (!doc) return null;
  return resolveInWork(doc, locator);
}

/** The ¶ anchor before/after the given one within the same work (for stepping through). */
export async function neighbourPara(work: string, index: number, delta: number): Promise<PassageRef | null> {
  const doc = await loadCorpusWork(work);
  if (!doc) return null;
  return neighbourInWork(doc, index, delta);
}

/** Pure neighbour step, shareable with tests. */
export function neighbourInWork(doc: CorpusWork, index: number, delta: number): PassageRef | null {
  const next = doc.paras[index + delta];
  if (!next) return null;
  const page = doc.pages.find((pg) => pg.p === next.p);
  if (!page) return null;
  const chapter = page.ch ? doc.chapters.find((c) => c.id === page!.ch) : undefined;
  return {
    work: doc.work,
    title: doc.title,
    page: page.p,
    ...(page.print ? { print: page.print } : {}),
    ...(chapter ? { chapter: { id: chapter.id, title: chapter.title } } : {}),
    para: next.para,
    text: page.text.slice(next.off, next.off + next.len),
    pageText: page.text,
    index: index + delta,
  };
}
