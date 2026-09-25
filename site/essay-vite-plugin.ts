import type { IncomingMessage } from 'node:http';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { finalizeEssayDist, rewriteBuiltEssayHtml } from './essay-host';

/** Serve the Plate B shell for essay and vault paths during dev and preview. */
function rewriteEssay(req: IncomingMessage) {
  const raw = req.url ?? '';
  const queryAt = raw.indexOf('?');
  const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const search = queryAt === -1 ? '' : raw.slice(queryAt);
  const vault = path === '/essay' || path === '/essay/'
    || /^\/essay\/.+/.test(path)
    || /^\/(?:section-rooms|symbolon|manuscript)(?:\/.*)?$/.test(path);
  if (vault) req.url = `/essay.html${search}`;
}

export function essayShellPlugin(): Plugin {
  let outDir = '';
  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: unknown, next: () => void) => void) => void }) => {
    middlewares.use((req, _res, next) => {
      rewriteEssay(req);
      next();
    });
  };
  return {
    name: 'essay-plate-b-shell',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) { attach(server.middlewares); },
    configurePreviewServer(server) { attach(server.middlewares); },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.server) return html;
        const filename = ctx.filename ?? '';
        if (!filename.endsWith(`${sep}essay.html`) && !filename.endsWith('/essay.html')) return html;
        return rewriteBuiltEssayHtml(html);
      },
    },
    closeBundle() {
      if (outDir) finalizeEssayDist(outDir);
    },
  };
}
