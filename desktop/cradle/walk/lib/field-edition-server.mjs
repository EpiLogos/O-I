// A static file server for a built essay edition (or the whole site root), with the two things a real host gives it:
// clean URLs (`/essay/THE-RETURN-OF-ZERO` → `.html`) and CORS, so the Cradle (another origin) can read it.
// Dev tooling for the field walks only — it is not part of the app.
import {createServer} from "node:http";
import {createReadStream, existsSync, statSync} from "node:fs";
import {extname, join, normalize} from "node:path";

const TYPES = {".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain"};

export function serveEdition(root, port = 0) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const candidates = [path, path + ".html", join(path, "index.html")];
    const found = candidates.map(c => join(root, c)).find(f => existsSync(f) && statSync(f).isFile());
    const headers = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "cache-control": "no-store"};
    if (!found) { res.writeHead(404, headers); res.end("not found"); return; }
    res.writeHead(200, {...headers, "content-type": TYPES[extname(found).toLowerCase()] ?? "application/octet-stream"});
    createReadStream(found).pipe(res);
  });
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({server, port: server.address().port, close: () => new Promise(r => server.close(r))})));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, port] = [process.argv[2], Number(process.argv[3] ?? 4180)];
  const s = await serveEdition(root, port);
  console.log(`serving ${root} on http://127.0.0.1:${s.port}/`);
}
