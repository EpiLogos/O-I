// The corpus-neutral provider seam — [C2-a1, C2 §1.2].
//
// Named sources: the seam C2 formalises out of the atlas's own load layer —
// `src/data/load.ts` (loadField), `src/data/symbols.ts`, `src/aion/model.ts`
// (loadHistory), `src/sky/load.ts` + `src/sky/ties.ts` (amended per a2/a4/a5/a6
// to take provider-supplied URLs), replacing the fixed fetches of the found
// `src/main.ts:32-38` (a1). Graph nodes and edges are DERIVED, not supplied:
// the provider supplies the five relations (occurrence→family instance,
// occurrence→family co-manifest, occurrence↔occurrence parallel,
// family→archetype tie with basis, body→family|archetype sky tie) and the
// atlas builds the graph (graph/build.ts).
//
// The port carries zero corpus bytes. A provider is anything that can publish
// the bundle below; `name` is the only place the corpus is named (C2 §1.2).

import { loadField } from '../src/data/load';
import { loadHistory } from '../src/aion/model';
import { loadSymbols } from '../src/data/symbols';
import { loadCorpusIndex } from '../src/data/corpus';
import type { Field, ImageRef } from '../src/types/field';
import type { History } from '../src/types/history';
import type { Symbols } from '../src/types/symbols';
import type { CorpusIndex } from '../src/types/corpus';
import type { TiesIndex } from '../src/sky/ties';
import { skyProvider } from './skyProvider';

/** The image assets a provider publishes ([C2 §1.2] "images.json + the
 * referenced assets"). The ported atlas consumes images through the ImageRefs
 * embedded in the field (src/data/model.ts occurrenceImage, arch.image,
 * fam.image) — this bundle is the provider's declared image store beside them.
 * Every ImageRef carries the licence gate structurally: credit, license and
 * sourceUrl are required strings (types/field.ts). */
export interface ImageBundle {
  /** Asset base for site-relative ImageRef paths, when the provider's assets
   * are not served from the host's root. `data:`/`http(s)`/`blob:` refs in the
   * field pass through unresolved (src/data/load.ts resolveSrc). */
  base?: string;
  /** The standalone store (the published images.json), keyed by ref id. */
  refs?: Record<string, ImageRef>;
}

export interface CorpusBundle {
  id: string;
  name: string;
  field: Field; // REQUIRED — the amended contract (types/field.ts)
  images: ImageBundle; // REQUIRED — the image store beside the field's inline refs
  history?: History; // OPTIONAL — Aion readings (types/history.ts)
  /** [C2-a3, r2] The corpus-passage citation index — the slot the dead hand
   * reserved as typed-`unknown` while the atlas's corpus modules were untracked
   * working-tree material. That lane has since landed (atlas c9732df); the
   * modules are carried verbatim under src/types/corpus.ts, src/data/corpus.ts
   * and src/ui/passage.ts, so the slot now takes its real shape. Absence
   * degrades to "no cite is a link" (the found law). */
  corpus?: CorpusIndex;
  symbols?: Symbols; // OPTIONAL — editorial overlay keyed by FamilyId
  ties?: TiesIndex; // OPTIONAL — body↔field ties; sky grids come from their own provider
}

export interface CorpusProvider {
  /** slug, stable in deep links (the router's #/a|f|c|p|o|t keys are the atlas's own grammar). */
  id: string;
  /** display, e.g. "Jung archetypal field" — the only place the corpus is named. */
  name: string;
  load(): Promise<CorpusBundle>;
}

const registry = new Map<string, CorpusProvider>();
let defaultId: string | undefined;

export function registerCorpusProvider(p: CorpusProvider, options?: { asDefault?: boolean }): void {
  registry.set(p.id, p);
  if (options?.asDefault || defaultId === undefined) defaultId = p.id;
}

export function corpusProvider(id?: string): CorpusProvider {
  const p = (id ? registry.get(id) : undefined) ?? registry.get(defaultId ?? '');
  if (!p) throw new Error(`No corpus provider${id ? ` "${id}"` : ''} is registered.`);
  return p;
}

export function loadProvider(id?: string): Promise<CorpusBundle> {
  return corpusProvider(id).load();
}

/** A provider assembled from published JSON bundles at URLs — the common
 * shape. Each optional bundle degrades per the found law: absence is labelled,
 * never filled (the found main.ts's catches). */
export function jsonCorpusProvider(spec: {
  id: string;
  name: string;
  fieldUrl: string;
  historyUrl?: string;
  symbolsUrl?: string;
  /** [C2-a3] the provider's published corpus index (…/corpus/index.json);
   * volume fetches resolve beside it. Absent ⇒ no cite deep links. */
  corpusUrl?: string;
  images?: ImageBundle;
}): CorpusProvider {
  return {
    id: spec.id,
    name: spec.name,
    async load() {
      // [C2-a2] the amended loader takes the provider's URL; validation unchanged.
      // [C2-a5][C2-a4][C2-a3] history/symbols/corpus absence degrades exactly as
      // the found boot caught it (corpus: no cite is a link).
      const [{ field }, history, symbols, corpus] = await Promise.all([
        loadField(spec.fieldUrl),
        spec.historyUrl
          ? loadHistory(spec.historyUrl).catch((error) => {
              console.warn(error);
              return undefined;
            })
          : Promise.resolve(undefined),
        spec.symbolsUrl
          ? loadSymbols(spec.symbolsUrl).catch((error) => {
              console.warn(error);
              return undefined;
            })
          : Promise.resolve(undefined),
        spec.corpusUrl ? loadCorpusIndex(spec.corpusUrl) : Promise.resolve(null),
      ]);
      return { id: spec.id, name: spec.name, field, images: spec.images ?? {}, history, corpus: corpus ?? undefined, symbols };
    },
  };
}

/** [C2-a6] The sky slot's own URLs, resolved: the ties index URL comes from the
 * active sky provider (the bundle stays behind the fetch seams — nothing is
 * imported into a second store). */
export function skyAndTiesUrls(): { skyUrl?: string; tiesUrl?: string } {
  const sky = skyProvider();
  return { skyUrl: sky.skyUrl, tiesUrl: sky.tiesUrl };
}
