// Lane S's front: /__application/expressions/* from the frame built at the seat's tree (scratch outDir), everything else to my live-shell.
import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {extname, join, normalize} from 'node:path'
const [, , port, upstream, dist] = process.argv
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf'}
const PREFIX = '/__application/expressions'
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith(PREFIX)) {
    const rel = normalize(decodeURIComponent(url.pathname.slice(PREFIX.length) || '/index.html')).replace(/^(\.\.[/\\])+/, '')
    try {
      const body = await readFile(join(dist, rel))
      res.writeHead(200, {'content-type': types[extname(rel)] ?? 'application/octet-stream', 'cache-control': 'no-store'})
      res.end(body)
    } catch { res.writeHead(404); res.end('not found') }
    return
  }
  const target = new URL(upstream)
  const proxied = http.request({host: target.hostname, port: target.port, path: req.url, method: req.method, headers: req.headers}, upstreamRes => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
    upstreamRes.pipe(res)
  })
  proxied.on('error', error => { res.writeHead(502); res.end(String(error)) })
  req.pipe(proxied)
}).listen(Number(port), '127.0.0.1', () => console.log(`front on ${port} → ${upstream}, frame from ${dist}`))
