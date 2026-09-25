import type { IncomingMessage } from 'node:http';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { finalizeEssayDist } from './essay-host';

/** Map clean essay URLs onto the Quartz publication during dev and preview:
 * `/essay` is the reading root, extensionless paths resolve `.html` or a
 * folder index, and missing paths land on the Quartz not-found page. */
export function quartzEssayUrl(url: string, publicDir: string): string | null {
  const queryAt = url.indexOf('?');
  const path = queryAt === -1 ? url : url.slice(0, queryAt);
  const search = queryAt === -1 ? '' : url.slice(queryAt);
  const legacy = path.match(/^\/(?:section-rooms|symbolon|manuscript)(\/.*)?$/);
  let essayPath = path;
  if (legacy) essayPath = `/essay${legacy[1] ?? '/'}`;
  if (essayPath === '/essay' || essayPath === '/essay/') return `/essay/index.html${search}`;
  const within = essayPath.match(/^\/essay\/(.+)$/);
  if (!within) return null;
  const tail = within[1];
  if (/\.[a-z0-9]+$/i.test(tail)) {
    return existsSync(join(publicDir, 'essay', tail)) ? `${essayPath}${search}` : `/essay/404.html${search}`;
  }
  if (existsSync(join(publicDir, 'essay', `${tail}.html`))) return `/essay/${tail}.html${search}`;
  if (existsSync(join(publicDir, 'essay', tail, 'index.html'))) return `/essay/${tail}/index.html${search}`;
  return `/essay/404.html${search}`;
}

/** Map essay URLs in the dev server and enforce the publication contract on
 * the built dist. (Vite preview installs its static stack before plugin
 * middlewares, so deep-link checks self-host the dist — see
 * tests/essay-host-smoke.py — instead of relying on this hook.) */
export function essayShellPlugin(opts: { enforcePublication?: boolean } = {}): Plugin {
  let publicDir = '';
  let outDir = '';
  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: unknown, next: () => void) => void) => void }) => {
    middlewares.use((req, _res, next) => {
      const raw = req.url ?? '';
      const mapped = publicDir ? quartzEssayUrl(raw, publicDir) : null;
      if (mapped) req.url = mapped;
      next();
    });
  };
  return {
    name: 'essay-quartz-publication',
    configResolved(config) {
      publicDir = resolve(config.root, config.publicDir);
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) { attach(server.middlewares); },
    configurePreviewServer(server) { attach(server.middlewares); },
    closeBundle() {
      // Only the public reading edition carries the deployable essay; the
      // default live-client build opts out of the publication contract.
      if (outDir && opts.enforcePublication) finalizeEssayDist(outDir);
    },
  };
}
