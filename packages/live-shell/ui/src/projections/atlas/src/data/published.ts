// The provider's published material, by name — the one door the atlas reads the found app's `public/data/<name>.json`
// files through.
//
// [§8.4 host adaptation, DEVICE-SEMANTICS-LOCK; C2 provider seam] Archetypal-Earth stands alone and fetches its
// material from its own `public/data/`. The DLW never does: material arrives through the corpus provider (C2) and
// native owners. The found loaders keep their own absence laws untouched — each now asks this door instead of
// `fetch(`${BASE}/data/<name>.json`)`, and an unbound door (or a name the provider does not publish) answers 404,
// which every found loader already reads as "absent, never invented".
//
// Port-new module (no AE source): the call sites it serves are AE @ 5fe5117 `redbook/load.ts`, `dynamics/load.ts`,
// `aion/model.ts` (aionbook), `sky/cards.ts`, `lenses/ui.ts` (loadLensData).

/** What a provider binds: the published file for a name (e.g. `redbook`, `dynamics-route`, `theory`), or null. */
export type PublishedSource = (name: string) => Promise<Response | null>;

let source: PublishedSource | null = null;

/** The host (mount.ts, from the provider's bundle) binds the published material; null unbinds it. */
export function setPublishedSource(next: PublishedSource | null): void {
  source = next;
}

const absent = (): Response => new Response(null, { status: 404, statusText: 'Not published by the provider' });

/** The published file for `name`, as a Response; 404 when the provider does not publish it. Never a public/data fetch. */
export async function fetchPublished(name: string): Promise<Response> {
  if (!source) return absent();
  try {
    return (await source(name)) ?? absent();
  } catch {
    return absent();
  }
}
