// The finished generator's pictures (version 2), the same bodies the `before/` ones were drawn from, but at the widths the globe is given now.
// node after/render-v2.mjs <out dir>   (the tests' own TypeScript loader, so the generator's .ts runs as it does in the gate)
import {deflateSync} from 'node:zlib'
import {writeFileSync} from 'node:fs'
import {register} from 'node:module'
const compiler = 'file:///Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/node_modules/typescript/lib/typescript.js'
register(`data:text/javascript,${encodeURIComponent(`

import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const B = await import('file:///Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/src/globe/body.ts')
const T = await import('file:///Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/src/globe/bodyTiles.ts')
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
function png(path, img) {
  const {width: w, height: h, data} = img
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  writeFileSync(path, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
const base = {body_ref: 'body:demo', seed: 123456789, generator: {id: 'fbm-sphere', version: 2},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const out = process.argv[2]
const time = (label, run) => { const c0 = process.cpuUsage(), v = run(), u = process.cpuUsage(c0); console.log(label, 'cpu ms', Math.round((u.user + u.system) / 1000)); return v }
png(`${out}/body-default-2048.png`, time('2048', () => B.bodyImage(base, 2048)))
png(`${out}/body-fjord-2048.png`, B.bodyImage({...base, seed: 42, landmass: {...base.landmass, coast: 'fjord', continents: 2.6, relief: .8}}, 2048))
png(`${out}/body-archipelago-2048.png`, B.bodyImage({...base, seed: 7, landmass: {...base.landmass, coast: 'archipelago', sea_level: .6}}, 2048))
png(`${out}/body-default-4096.png`, time('4096', () => B.bodyImage(base, 4096)))
png(`${out}/cloud-default-2048.png`, B.cloudImage(base, 2048))
// what the closest camera sees now: four z7 tiles over land, side by side (the `before/` showed the 1024 base enlarged six times)
const base512 = B.bodyImage(base, 512)
const N = 128, tiles = []
for (let ty = 40; ty < 90 && tiles.length < 4; ty += 3) for (let tx = 0; tx < N && tiles.length < 4; tx += 7) {
  const px = Math.floor(((tx + .5) / N) * 512), py = Math.floor(((ty + .5) / N) * 256), i = (py * 512 + px) * 4, r = base512.data[i], g = base512.data[i + 1], b = base512.data[i + 2]
  if (g > b + 8 || r > b + 8) tiles.push(T.bodyTile(base, 7, tx, ty))
}
const TW = 256, mosaic = new Uint8ClampedArray(TW * 2 * TW * 2 * 4)
tiles.forEach((t, k) => { const ox = (k % 2) * TW, oy = Math.floor(k / 2) * TW; for (let y = 0; y < TW; y++) for (let x = 0; x < TW; x++) for (let c = 0; c < 4; c++) mosaic[((oy + y) * TW * 2 + ox + x) * 4 + c] = t.data[(y * TW + x) * 4 + c] })
png(`${out}/tiles-z7-default.png`, {width: TW * 2, height: TW * 2, data: mosaic})
console.log('land share', B.landShare(base).toFixed(3), 'tiles', tiles.length)
