/** Path resolution for the Plate B essay shell.
 * Folder and leaf URLs stay inside the shell; they never depend on a host file
 * existing at `…/path.html`. */

export type EssayOffice = { id: string; label: string; child?: boolean };
export type EssayFile = { id: string; office: string | null; title: string; links: string[] };
export type EssayCatalog = {
  schema: string;
  readingRoot: string;
  manuscript: string;
  aliases: Record<string, string>;
  offices: EssayOffice[];
  files: EssayFile[];
};

export type EssayResolution =
  | { kind: 'page'; id: string }
  | { kind: 'folder'; office: string; scope: string }
  | { kind: 'missing'; id: string };

export function requestKey(pathname: string): string {
  const cut = pathname.split('?')[0].split('#')[0];
  let path = cut;
  try { path = decodeURIComponent(cut); } catch { /* keep the raw path */ }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  path = path.replace(/\.html$/i, '').replace(/\.md$/i, '');
  if (path === '/essay' || path === '/essay.html' || path === '' || path === '/') return '';
  if (path.startsWith('/essay/')) return path.slice('/essay/'.length);
  if (path.startsWith('/section-rooms') || path.startsWith('/symbolon') || path.startsWith('/manuscript')) {
    return path.replace(/^\//, '');
  }
  return '';
}

function officeFor(id: string, offices: EssayOffice[]): string | null {
  const matches = offices.filter((office) => id === office.id || id.startsWith(`${office.id}/`));
  matches.sort((a, b) => b.id.length - a.id.length);
  return matches[0]?.id ?? null;
}

export function resolveEssayRequest(pathname: string, catalog: EssayCatalog): EssayResolution {
  const key = requestKey(pathname);
  const alias = key === '' ? catalog.readingRoot : (catalog.aliases[key] ?? key);
  const ids = new Set(catalog.files.map((file) => file.id));
  if (ids.has(alias)) return { kind: 'page', id: alias };
  if (ids.has(`${alias}/README`)) return { kind: 'page', id: `${alias}/README` };
  if (ids.has(`${alias}/ROOM`)) return { kind: 'page', id: `${alias}/ROOM` };
  const office = officeFor(alias, catalog.offices);
  const under = catalog.files.some((file) => file.id === alias || file.id.startsWith(`${alias}/`));
  if (office && (alias === office || under)) return { kind: 'folder', office, scope: alias };
  if (alias && alias !== catalog.readingRoot) return { kind: 'missing', id: alias };
  return { kind: 'page', id: catalog.readingRoot };
}

export function hrefFor(id: string, catalog: EssayCatalog): string {
  if (id === catalog.readingRoot) return '/essay';
  return `/essay/${id.split('/').map(encodeURIComponent).join('/')}`;
}

export function officeOf(id: string, catalog: EssayCatalog): string | null {
  return catalog.files.find((file) => file.id === id)?.office ?? officeFor(id, catalog.offices);
}
