import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

/** Serve the Plate B shell for essay and vault paths, and pin its built
 * assets to the host root so deep links still load the script. */
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
  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: unknown, next: () => void) => void) => void }) => {
    middlewares.use((req, _res, next) => {
      rewriteEssay(req);
      next();
    });
  };
  return {
    name: 'essay-plate-b-shell',
    configureServer(server) { attach(server.middlewares); },
    configurePreviewServer(server) { attach(server.middlewares); },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename?.endsWith('essay.html')) return html;
        return html.replace(/="\.\/assets\//g, '="/assets/');
      },
    },
  };
}
