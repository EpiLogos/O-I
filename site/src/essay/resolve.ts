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

declare global {
  interface Window { __OI_SITE_BASE__?: string }
}

function normalizeBase(base: string): string {
  if (!base || base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** Empty in dev and on oi.epi-logos.org. `/O-I` when GitHub Pages serves the project site. */
export function siteBase(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.__OI_SITE_BASE__;
  return typeof raw === 'string' ? normalizeBase(raw) : '';
}

export function sitePath(path: string, base = siteBase()): string {
  const prefix = normalizeBase(base);
  const abs = path.startsWith('/') ? path : `/${path}`;
  return `${prefix}${abs}`;
}

export function withoutSiteBase(pathname: string, base = siteBase()): string {
  const prefix = normalizeBase(base);
  if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}

export function isShellPath(pathname: string): boolean {
  return pathname === '/essay' || pathname.startsWith('/essay/')
    || pathname === '/section-rooms' || pathname.startsWith('/section-rooms/')
    || pathname === '/symbolon' || pathname.startsWith('/symbolon/')
    || pathname === '/manuscript' || pathname.startsWith('/manuscript/');
}

export function requestKey(pathname: string, base = siteBase()): string {
  const cut = pathname.split('?')[0].split('#')[0];
  let path = cut;
  try { path = decodeURIComponent(cut); } catch { /* keep the raw path */ }
  path = withoutSiteBase(path, base);
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

export function resolveEssayRequest(pathname: string, catalog: EssayCatalog, base = siteBase()): EssayResolution {
  const key = requestKey(pathname, base);
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

export function hrefFor(id: string, catalog: EssayCatalog, base = siteBase()): string {
  if (id === catalog.readingRoot) return sitePath('/essay', base);
  return sitePath(`/essay/${id.split('/').map(encodeURIComponent).join('/')}`, base);
}

export function officeOf(id: string, catalog: EssayCatalog): string | null {
  return catalog.files.find((file) => file.id === id)?.office ?? officeFor(id, catalog.offices);
}
