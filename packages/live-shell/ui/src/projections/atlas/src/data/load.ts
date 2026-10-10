import type { Field, ImageRef } from '../types/field';

const BASE = import.meta.env.BASE_URL ?? '/';

/** Site-relative image paths are served from public/; data/http URLs pass through. */
export function resolveSrc(src: string): string {
  if (/^(data:|https?:|blob:)/.test(src)) return src;
  return BASE.replace(/\/$/, '') + '/' + src.replace(/^\//, '');
}

export function imgUrl(ref: ImageRef, thumb = false): string {
  return resolveSrc(thumb && ref.thumb ? ref.thumb : ref.src);
}

/** Load the published field. Missing data must never become invented content.
 * [C2-a2] the field URL is provider-supplied (was the fixed `/data/field.json`);
 * validation unchanged. */
export async function loadField(from?: string): Promise<{ field: Field; fixture: boolean }> {
  let why = 'not found';
  try {
    const res = await fetch(from ?? BASE.replace(/\/$/, '') + '/data/field.json');
    const type = res.headers.get('content-type') ?? '';
    // vite's dev server answers unknown paths with index.html (200) — treat as absent
    if (res.ok && !type.includes('text/html')) {
      const field = (await res.json()) as Field;
      if (field?.occurrences?.length) return { field, fixture: false };
      why = 'empty';
    } else why = `HTTP ${res.status} ${type}`;
  } catch (e) {
    why = String(e);
  }
  throw new Error(`The atlas data could not be loaded (${why}).`);
}
