import type { Symbols } from '../types/symbols';

/** An additional named source, never merged into the corpus's authored passages.
 * [C2-a4] the symbols URL is provider-supplied (was the fixed `/data/symbols.json`). */
export async function loadSymbols(from?: string): Promise<Symbols> {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const response = await fetch(from ?? `${base}/data/symbols.json`);
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Symbolic readings are unavailable.');
  const symbols = await response.json() as Symbols;
  if (!symbols.source?.title || !Array.isArray(symbols.entries) || symbols.entries.some(e =>
    !e.familyId || !e.title || !Array.isArray(e.body) || !Array.isArray(e.pages) || !Array.isArray(e.resonances))) throw new Error('Symbolic readings are invalid.');
  return symbols;
}
