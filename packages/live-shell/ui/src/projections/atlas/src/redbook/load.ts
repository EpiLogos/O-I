import type { RedBook } from '../types/redbook';
// [§8.4] the Red Book arrives through the provider's published material, never a public/data fetch (data/published.ts)
import { fetchPublished } from '../data/published';

/** Load the published Red Book data. Missing data must never become invented content. */
export async function loadRedbook(): Promise<RedBook | null> {
  try {
    const response = await fetchPublished('redbook');
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return null;
    const redbook = await response.json() as RedBook;
    if (!Array.isArray(redbook.stops) || !redbook.stops.length || !Array.isArray(redbook.sections) || !Array.isArray(redbook.genesis)) return null;
    return redbook;
  } catch {
    return null;
  }
}
