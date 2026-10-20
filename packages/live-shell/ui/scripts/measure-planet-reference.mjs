#!/usr/bin/env node
// Measures the Earth imagery with the planet-quality metrics (tests/lib/planetMetrics.mjs) and writes
// tests/fixtures/planet-reference.json: the numbers the generated body is held to (tests/w3q-planet-gate.test.mjs). Also measures
// the v1 generator (globe/body.ts at the commit this file names) as `v1Baseline`, so the gate's failure at the start is a record,
// not a claim.
//
// Needs macOS `sips` to decode the JPEG once (the numbers are committed, so CI never decodes). Run from packages/live-shell/ui:
//   node --experimental-strip-types scripts/measure-planet-reference.mjs [path/to/earth-2k.jpg] [--v1]
//
// Not part of the test run; the fixture it writes is the lead's, argued in T-PROCEDURAL-BODY.
import {execFileSync} from 'node:child_process'
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs'
import {inflateSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {measurePlanet} from '../tests/lib/planetMetrics.mjs'

// the calibration images: the Earth blurred by a box of radius 1 (two passes), and the Earth with ±5 of white noise per channel
function blurred(img, r) {
  const {width: w, height: h, data} = img
  let cur = Float32Array.from(data)
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(cur.length)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) { let s = 0; for (let k = -r; k <= r; k++) s += cur[(j * w + ((i + k + w) % w)) * 4 + c]; tmp[(j * w + i) * 4 + c] = s / (2 * r + 1) }
    const next = new Float32Array(cur.length)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[(Math.min(h - 1, Math.max(0, j + k)) * w + i) * 4 + c]; next[(j * w + i) * 4 + c] = s / (2 * r + 1) }
    cur = next
  }
  const out = new Uint8ClampedArray(data.length)
  for (let i = 0; i < out.length; i++) out[i] = i % 4 === 3 ? 255 : cur[i]
  return {width: w, height: h, data: out}
}
function noisy(img, amp) {
  let s = 12345
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const out = {width: img.width, height: img.height, data: new Uint8ClampedArray(img.data)}
  for (let i = 0; i < out.data.length; i++) if (i % 4 < 3) out.data[i] += (rnd() - .5) * amp
  return out
}

const ui = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const jpg = args.find(a => !a.startsWith('--')) ?? join(ui, 'public/textures/earth-2k.jpg')
const dir = mkdtempSync(join(tmpdir(), 'planet-ref-'))
const png = join(dir, 'earth.png')
execFileSync('sips', ['-s', 'format', 'png', jpg, '--out', png], {stdio: 'ignore'})

function decodePng(buf) {
  let at = 8, w = 0, h = 0, depth = 0, type = 0
  const idat = []
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), kind = buf.toString('latin1', at + 4, at + 8), body = buf.subarray(at + 8, at + 8 + len)
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; if (body[12]) throw Error('interlaced') }
    if (kind === 'IDAT') idat.push(body)
    at += 12 + len
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw Error(`png type ${type}/${depth} not handled`)
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride)
  for (let j = 0; j < h; j++) {
    const f = raw[j * (stride + 1)], line = raw.subarray(j * (stride + 1) + 1, (j + 1) * (stride + 1)), cur = px.subarray(j * stride, (j + 1) * stride)
    const up = j ? px.subarray((j - 1) * stride, j * stride) : Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = up[i], c = i >= bpp ? up[i - bpp] : 0
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      cur[i] = (line[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? b : c))) & 255
    }
  }
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) { data[i * 4] = px[i * bpp]; data[i * 4 + 1] = px[i * bpp + 1]; data[i * 4 + 2] = px[i * bpp + 2]; data[i * 4 + 3] = 255 }
  return {width: w, height: h, data}
}

const earth = decodePng(readFileSync(png))
const out = {
  schema: 'oi.planet-reference/v1',
  note: 'Measured by scripts/measure-planet-reference.mjs with tests/lib/planetMetrics.mjs. The Earth is the standard; the gate (tests/w3q-planet-gate.test.mjs) holds a generated body to bands of these numbers. The lead owns this file.',
  calibration: {note: 'the Earth made worse on purpose: the gate must reject both (tests/w3q-planet-gate.test.mjs)', blurred: null, noisy: null},
  earth: {source: 'public/textures/earth-2k.jpg', sha256: createHash('sha256').update(readFileSync(jpg)).digest('hex'), ...measurePlanet(earth)},
}

out.calibration.blurred = measurePlanet(blurred(earth, 1))
out.calibration.noisy = measurePlanet(noisy(earth, 10))

if (args.includes('--v1')) {
  const body = await import('../src/projections/atlas/src/globe/body.ts')
  const base = {body_ref: 'body:ref', seed: 0, generator: {id: 'fbm-sphere', version: 1},
    landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
    sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
  out.v1Baseline = {}
  for (const [name, record] of Object.entries({
    default: {...base, seed: 20261018},
    seedB: {...base, seed: 7},
    fjord: {...base, seed: 42, landmass: {...base.landmass, coast: 'fjord', continents: 2.6, relief: .8}},
    archipelago: {...base, seed: 99, landmass: {...base.landmass, coast: 'archipelago', sea_level: .6}},
  })) out.v1Baseline[name] = measurePlanet(body.bodyImage(record, 2048))
}
const target = join(ui, 'tests/fixtures/planet-reference.json')
if (existsSync(target) && !args.includes('--v1')) {
  // keep a recorded baseline when only the Earth is re-measured
  const before = JSON.parse(readFileSync(target, 'utf8'))
  if (before.v1Baseline) out.v1Baseline = before.v1Baseline
}
writeFileSync(target, JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(out, null, 2))
