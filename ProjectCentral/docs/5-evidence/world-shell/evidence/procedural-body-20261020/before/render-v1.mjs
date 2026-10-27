import {deflateSync} from 'node:zlib'
import {writeFileSync} from 'node:fs'
import * as B from '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/src/globe/body.ts'

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
const base = {body_ref: 'body:demo', seed: 123456789, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const out = process.argv[2]
const t0 = performance.now()
png(`${out}/body-default-1024.png`, B.bodyImage(base, 1024))
console.log('1024 ms', Math.round(performance.now() - t0))
png(`${out}/body-fjord-1024.png`, B.bodyImage({...base, seed: 42, landmass: {...base.landmass, coast: 'fjord', continents: 2.6, relief: .8}}, 1024))
png(`${out}/body-archipelago-1024.png`, B.bodyImage({...base, seed: 7, landmass: {...base.landmass, coast: 'archipelago', sea_level: .6}}, 1024))
const t1 = performance.now()
png(`${out}/body-default-4096.png`, B.bodyImage(base, 4096))
console.log('4096 ms', Math.round(performance.now() - t1))
// a close-in window onto the 1024 body as the globe would show it at ~8x zoom: crop 128x64 and nearest/bilinear upscaled 8x
const small = B.bodyImage(base, 1024)
const cw = 160, ch = 80, x0 = 400, y0 = 200, k = 6, W = cw * k, H = ch * k
const zoom = new Uint8ClampedArray(W * H * 4)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const fx = x0 + x / k - .5, fy = y0 + y / k - .5, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy
  for (let c = 0; c < 4; c++) { const p = (X, Y) => small.data[(Y * small.width + X) * 4 + c]
    zoom[(y * W + x) * 4 + c] = (p(ix, iy) * (1 - ax) + p(ix + 1, iy) * ax) * (1 - ay) + (p(ix, iy + 1) * (1 - ax) + p(ix + 1, iy + 1) * ax) * ay }
}
png(`${out}/body-default-1024-zoom6x.png`, {width: W, height: H, data: zoom})
console.log('land share', B.landShare(base).toFixed(3))
