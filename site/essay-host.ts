/** Host rules for the Plate B shell.
 * Vercel rewrites essay routes to essay.html (200). GitHub Pages does not:
 * a missing path serves 404.html and keeps the URL. The same HTML boots the
 * shell only for essay routes, and prefixes assets with the site base
 * (`/O-I` on the project Pages site, empty on oi.epi-logos.org).
 */
import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

export const ESSAY_FILE = /\/essay\.html$/;
export const ESSAY_TAIL = /\/(?:essay|section-rooms|symbolon|manuscript)(?:\/.*)?$/;
export const ESSAY_ROUTE = /\/(?:essay|section-rooms|symbolon|manuscript)(?:\/|$)|\/essay\.html$/;

export type EssayAsset = { kind: 'script' | 'style' | 'preload'; href: string };

export function detectSiteBase(pathname: string): string {
  const base = pathname.replace(ESSAY_FILE, '').replace(ESSAY_TAIL, '');
  if (base === pathname || base === '/') return '';
  return base;
}

export function isEssayRoute(pathname: string): boolean {
  return ESSAY_ROUTE.test(pathname);
}

export function rootAsset(url: string): string | null {
  const path = url.split('?')[0].split('#')[0];
  let root: string | null = null;
  if (path.startsWith('./assets/')) root = path.slice(1);
  else if (path.startsWith('/assets/')) root = path;
  else if (path.startsWith('assets/')) root = `/${path}`;
  if (!root) return null;
  return root + url.slice(path.length);
}

export function essayBootstrap(assets: EssayAsset[]): string {
  return `<script>
(function () {
  var path = location.pathname;
  var base = path.replace(${ESSAY_FILE}, "").replace(${ESSAY_TAIL}, "");
  if (base === path || base === "/") base = "";
  window.__OI_SITE_BASE__ = base;
  if (!${ESSAY_ROUTE}.test(path)) {
    document.body.innerHTML = '<main class="essay-host-miss"><h1>This page is not on the site.</h1></main>';
    return;
  }
  var assets = ${JSON.stringify(assets)};
  for (var i = 0; i < assets.length; i++) {
    var item = assets[i];
    var href = base + item.href;
    if (item.kind === "style") {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    } else if (item.kind === "preload") {
      var preload = document.createElement("link");
      preload.rel = "modulepreload";
      preload.href = href;
      document.head.appendChild(preload);
    } else {
      var script = document.createElement("script");
      script.type = "module";
      script.src = href;
      document.body.appendChild(script);
    }
  }
})();
</script>`;
}

/** Drop Vite's root-relative asset tags and boot them from the real site base. */
export function rewriteBuiltEssayHtml(html: string): string {
  const assets: EssayAsset[] = [];
  let next = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (full, attrs: string) => {
    const src = /src="([^"]+)"/.exec(attrs);
    if (!src) return full;
    const href = rootAsset(src[1]);
    if (!href) return full;
    assets.push({ kind: 'script', href });
    return '';
  });
  next = next.replace(/<link\b([^>]*)>/gi, (full, attrs: string) => {
    const hrefMatch = /href="([^"]+)"/.exec(attrs);
    if (!hrefMatch) return full;
    const href = rootAsset(hrefMatch[1]);
    if (!href) return full;
    const rel = /rel="([^"]+)"/.exec(attrs)?.[1] ?? '';
    if (rel.includes('stylesheet')) assets.push({ kind: 'style', href });
    else if (rel.includes('modulepreload')) assets.push({ kind: 'preload', href });
    else return full;
    return '';
  });
  if (!assets.some((asset) => asset.kind === 'script')) {
    throw new Error('essay.html build did not emit an assets module script.');
  }
  if (!next.includes('</body>')) throw new Error('essay.html has no body.');
  return next.replace('</body>', `${essayBootstrap(assets)}\n</body>`);
}

function walkHtml(dir: string, found: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, found);
    else if (name.endsWith('.html') || name.endsWith('.htm')) found.push(full);
  }
}

/** Remove a Quartz `essay/` tree, require the shell plus catalog, and publish 404.html. */
export function finalizeEssayDist(outDir: string) {
  const essayDir = join(outDir, 'essay');
  if (existsSync(essayDir)) {
    if (!statSync(essayDir).isDirectory()) throw new Error('The site build emitted a file named essay next to essay.html.');
    rmSync(essayDir, { recursive: true, force: true });
  }
  if (existsSync(essayDir)) throw new Error('Quartz output at essay/ could not be removed.');
  const leftover: string[] = [];
  if (existsSync(outDir)) walkHtml(outDir, leftover);
  const quartz = leftover.filter((file) => {
    const rel = relative(outDir, file).split(sep).join('/');
    return rel === 'essay' || rel.startsWith('essay/');
  });
  if (quartz.length) throw new Error(`Quartz HTML is still in the site build: ${quartz.join(', ')}`);

  const essayHtmlPath = join(outDir, 'essay.html');
  if (!existsSync(essayHtmlPath)) throw new Error('essay.html is missing from the site build.');
  const html = readFileSync(essayHtmlPath, 'utf8');
  if (/http-equiv\s*=\s*["']refresh/i.test(html)) throw new Error('essay.html is a meta-refresh stub.');
  if (/<meta\b[^>]*name=["']generator["'][^>]*quartz/i.test(html)) throw new Error('essay.html is still a Quartz page.');
  if (!html.includes('__OI_SITE_BASE__')) throw new Error('essay.html is missing the host-base bootstrap.');
  const catalog = join(outDir, 'essay-shell', 'catalog.json');
  if (!existsSync(catalog)) throw new Error('essay-shell/catalog.json is missing from the site build.');
  mkdirSync(dirname(join(outDir, '404.html')), { recursive: true });
  writeFileSync(join(outDir, '404.html'), html);
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function safeFile(dist: string, pathname: string): string | null {
  let decoded = pathname;
  try { decoded = decodeURI(pathname); } catch { return null; }
  const parts: string[] = [];
  for (const part of decoded.split('/')) {
    if (!part) continue;
    let seg = part;
    try { seg = decodeURIComponent(part); } catch { return null; }
    if (seg === '.' || seg === '..' || seg.includes('/') || seg.includes('\\') || seg.includes('\0')) return null;
    parts.push(seg);
  }
  const root = resolve(dist);
  const target = resolve(root, ...parts);
  if (target !== root && !target.startsWith(root + sep)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  if (existsSync(target) && statSync(target).isDirectory()) {
    const index = join(target, 'index.html');
    if (existsSync(index) && statSync(index).isFile()) return index;
  }
  return null;
}

export type HostMode = 'pages' | 'vercel';

/** Static host. Pages: missing paths are 404.html (status 404). Vercel: essay routes rewrite to essay.html (200) unless a real file is already there. */
export function startEssayHost(options: { dist: string; mode: HostMode; prefix?: string; port?: number }): Promise<{ port: number; close: () => Promise<void> }> {
  const dist = resolve(options.dist);
  const prefix = options.prefix ?? '';
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname = url.pathname;
    try { pathname = decodeURI(url.pathname); } catch { pathname = url.pathname; }
    let rel = pathname;
    if (prefix) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) rel = pathname.slice(prefix.length) || '/';
      else rel = pathname;
    }
    const send = (status: number, file: string) => {
      const body = readFileSync(file);
      const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    const miss = join(dist, '404.html');
    if (options.mode === 'vercel' && isEssayRoute(rel)) {
      const existing = safeFile(dist, rel);
      if (existing) { send(200, existing); return; }
      send(200, join(dist, 'essay.html'));
      return;
    }
    const file = safeFile(dist, rel);
    if (file) { send(200, file); return; }
    if (existsSync(miss)) { send(404, miss); return; }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('missing');
  });
  return new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      done({
        port,
        close: () => new Promise((closed) => {
          server.closeAllConnections?.();
          server.close(() => closed());
        }),
      });
    });
  });
}
