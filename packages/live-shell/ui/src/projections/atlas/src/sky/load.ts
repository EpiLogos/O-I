import type { SkyData } from '../types/sky';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** Load the generated sky data. Missing data never becomes invented content: the caller labels its absence.
 * [C2-a6] the sky URL is provider-supplied (was the fixed `/data/sky.json`); in the shell the sky
 * binds from the QL kerykeion contract — the atlas's own generated grid stays one provider's bundle. */
export async function loadSky(from?: string): Promise<SkyData> {
  const res = await fetchRetrying(from ?? `${BASE}/data/sky.json`);
  const type = res.headers.get('content-type') ?? '';
  // vite's dev server answers unknown paths with index.html (200) — treat as absent
  if (!res.ok || type.includes('text/html')) throw new Error(`The sky data could not be loaded (HTTP ${res.status} ${type}).`);
  const sky = (await res.json()) as SkyData;
  if (!sky?.bodies?.length || !sky.planets || !sky.moon || !sky.orbits) throw new Error('The sky data is incomplete.');
  return sky;
}

/**
 * A dropped connection (fetch rejects: aborted, reset, offline for a moment) is tried again twice before the sky is
 * given up for the session; an answer of any status is final and goes to the caller's checks.
 */
async function fetchRetrying(url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
}
