// T-PROCEDURAL-BODY, Lane A, round 3: the sky above the ground. The cloud field is analytic, so it can be asked at any resolution as the ground is: at a region view (a pixel is
// 0.022 degrees: a zoom-6 tile's) it must have crisp edges, translucent structure inside a large cloud, and agree with the picture the world view takes; and the field must have no
// direction on the sphere of its own where the ground has none (no pinched equirect near the poles, no streaks along the shear).
//
// Channel: scripted, on the generator's own functions (the GPU is not run). The layer "as it was" at the start of round 3 is the 1024-wide mask the shader magnifies (bilinear, as a GPU
// does); `body.cloudWindow` is the layer the round adds, and each measure is taken on whichever the module offers, so the first form of every test ran, red, on the mask.
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-sky.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {boxBlur} from './lib/planetMetrics.mjs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
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

const globe = new URL('../src/projections/atlas/src/globe/', import.meta.url)
const body = await import(new URL('body.ts', globe).href)
const weather = await import(new URL('bodyWeather.ts', globe).href)
const noise = await import(new URL('bodyNoise.ts', globe).href)
const tiles = await import(new URL('bodyTiles.ts', globe).href)
const {yOfLat} = await import(new URL('tilemath.ts', globe).href)

const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const SEEDS = [20261018, 7, 42]
const make = (seed, change = {}) => ({
  body_ref: 'body:sky', seed, generator: {id: 'fbm-sphere', version: 2},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length
const f = (x, digits = 3) => (typeof x === 'number' ? +x.toFixed(digits) : x)
const D2R = Math.PI / 180
const unit = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R)]

/** A window of the sky at a place: `n` x `n` texels of `texel` degrees, centred on a latitude and longitude (its longitude span widened by 1 / cos(latitude): square texels). */
const regionOf = (lat0, lon0, n = 512, texel = .022) => ({lat0, lon0, halfLat: n * texel / 2, halfLon: n * texel / 2 / Math.cos(lat0 * D2R), n})

/** The 1024-wide mask the shader magnifies, sampled bilinearly (as the GPU does) over a region, carried by the wind at `time` as the shader carries it (the sample taken west of the place by the shift of its
 * latitude): the layer as it was at the start of round 3. */
function maskLayer(record, region, time = 0) {
  const mask = body.cloudImage(record, 1024), mw = mask.width, mh = mask.height, n = region.n, out = new Float32Array(n * n)
  const s = (i, j) => mask.data[(Math.max(0, Math.min(mh - 1, j)) * mw + ((i % mw) + mw) % mw) * 4] / 255
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const lat = region.lat0 + region.halfLat - (j + .5) * 2 * region.halfLat / n, lon = region.lon0 - region.halfLon + (i + .5) * 2 * region.halfLon / n - weather.weatherShift(record, lat, time)
    const u = (lon + 180) / 360 * mw - .5, v = (90 - lat) / 180 * mh - .5, i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0
    out[j * n + i] = (s(i0, j0) * (1 - fu) + s(i0 + 1, j0) * fu) * (1 - fv) + (s(i0, j0 + 1) * (1 - fu) + s(i0 + 1, j0 + 1) * fu) * fv
  }
  return {n, data: out}
}
/** The sky over a region, as the generator offers it: the window of the analytic field when there is one (opacity 0 to 1, row 0 the north edge), else the mask. */
function layerOf(record, region, time = 0) {
  if (typeof body.cloudWindow === 'function') {
    const image = body.cloudWindow(record, region, region.n, time), out = new Float32Array(region.n * region.n)
    for (let k = 0; k < out.length; k++) out[k] = image.data[k * 4] / 255
    return {n: region.n, data: out}
  }
  return maskLayer(record, region, time)
}

/** The 10-to-90% width, in pixels, of the opacity transition across the edges of the clouds in a layer: at every place along a row where the opacity rises through .2, the amplitude is the
 * mean opacity 5 to 9 pixels beyond it (over .25 to count: an edge with a cloud behind it), and the width is the run from a tenth of it to nine tenths of it. */
function edgeWidths(layer) {
  const {n, data} = layer, widths = []
  for (let j = 0; j < n; j += 2) for (let i = 16; i < n - 16; i++) {
    const a = data[j * n + i], b = data[j * n + i + 1]
    if (!(a < .2 && b >= .2)) continue
    let amp = 0
    for (let k = 5; k <= 9; k++) amp += data[j * n + i + 1 + k] / 5
    if (amp < .25) continue
    let lo = i, hi = i + 1
    while (lo > 0 && data[j * n + lo] > .1 * amp && i - lo < 60) lo--
    while (hi < n - 1 && data[j * n + hi] < .9 * amp && hi < i + 60) hi++
    widths.push(hi - lo)
  }
  widths.sort((x, y) => x - y)
  return {count: widths.length, median: widths[widths.length >> 1] ?? NaN}
}
/** The mean |value - its (2r+1)-box blur| over the pixels of a layer in `keep`. */
function energy(layer, r, keep) {
  const {n, data} = layer, blur = boxBlur(data, n, n, r)
  let sum = 0, count = 0
  for (let k = 0; k < n * n; k++) if (keep(k)) { sum += Math.abs(data[k] - blur[k]); count++ }
  return {energy: count ? sum / count : NaN, count}
}
/** The pixels well inside a large cloud: opacity over .3, at least 8 pixels from any opacity under .12, in a cloud of at least 3000 such pixels. */
function interior(layer) {
  const {n, data} = layer, thin = new Uint8Array(n * n)
  for (let k = 0; k < n * n; k++) thin[k] = data[k] < .12 ? 1 : 0
  const near = boxBlur(Float32Array.from(thin), n, n, 8), keep = new Uint8Array(n * n), seen = new Uint8Array(n * n)
  for (let s = 0; s < n * n; s++) {
    if (seen[s] || data[s] <= .3 || near[s] > 0) continue
    const members = [], stack = [s]; seen[s] = 1
    while (stack.length) {
      const at = stack.pop(); members.push(at)
      const j = (at / n) | 0, i = at - j * n
      for (const next of [j > 0 ? at - n : -1, j < n - 1 ? at + n : -1, i > 0 ? at - 1 : -1, i < n - 1 ? at + 1 : -1]) if (next >= 0 && !seen[next] && data[next] > .3 && near[next] === 0) { seen[next] = 1; stack.push(next) }
    }
    if (members.length >= 3000) for (const at of members) keep[at] = 1
  }
  return keep
}

test('CW1 clouds have crisp edges at a region view: the 10-to-90% transition across a cloud edge is a few pixels, not tens', () => {
  // The ceiling is a sharp-edged cloud deck's: at the 250 m a pixel of a satellite's visible channel a cumulus deck's edge is one to three pixels, a thin cirrus veil's more. At the zoom-6 tile's
  // 0.022 degrees a pixel, five at the median. The mask the shader magnifies has 60 pixels at 45 N 20 E and 31 at 15 N 60 W (its texel is 16 pixels, the ramp across it about three texels).
  const widths = SEEDS.flatMap(seed => [regionOf(45, 20), regionOf(15, -60)].map(region => edgeWidths(layerOf(make(seed), region))))
  assert.ok(widths.every(w => w.count >= 60), `there are cloud edges to measure (${widths.map(w => w.count).join(', ')})`)
  assert.ok(Math.max(...widths.map(w => w.median)) <= 5, `the median 10-90% edge width is ${widths.map(w => w.median).join(', ')} pixels (at most 5 for every body and place)`)
})

test('CW2 a large cloud has structure inside: at one to four pixels its opacity varies, a quarter as much as the ground does at the same scale', () => {
  // A smooth wash inside a cloud is what a magnified mask is. The ground at the same scale (a zoom-6 tile, 0.022 degrees a pixel, luma, a lowland and a mountain belt of the default body) has its
  // own 1-pixel energy (mean |value - its 3 by 3 blur|); the cloud's, taken inside the large clouds of a 512-pixel window, is at least a quarter of the ground's (derived: a cloud is smoother than
  // rock, not smoother than a magnified blur: the mask had a few hundredths of the ground's).
  const record = make(SEEDS[0]), ground = [[-11, -92.4], [-44.2, -77.6]].map(([lat, lon]) => {
    const n = 2 ** 6, tile = tiles.bodyTile(record, 6, Math.floor((lon + 180) / 360 * n), Math.floor(yOfLat(6, lat))), luma = new Float32Array(tile.width * tile.height)
    for (let k = 0; k < luma.length; k++) luma[k] = (.299 * tile.data[k * 4] + .587 * tile.data[k * 4 + 1] + .114 * tile.data[k * 4 + 2]) / 255
    return energy({n: tile.width, data: luma}, 1, () => true).energy
  })
  const clouds = SEEDS.flatMap(seed => [regionOf(45, 20), regionOf(-50, 100)].map(region => { const layer = layerOf(make(seed), region), keep = interior(layer); return energy(layer, 1, k => keep[k] === 1) }))
  assert.ok(clouds.every(c => c.count >= 3000), `there is cloud interior to measure (${clouds.map(c => c.count).join(', ')} pixels)`)
  const reference = mean(ground)
  assert.ok(mean(clouds.map(c => c.energy)) >= .25 * reference, `inside the large clouds the 1-pixel energy is ${f(mean(clouds.map(c => c.energy)), 4)}, the ground's ${f(reference, 4)}: at least a quarter of it`)
})

test('CW3 the window and the picture are one sky: the window of the field, taken to the mask’s own scale, is the mask', () => {
  // The mask is the same field with fewer octaves and a soft edge; the window adds the octaves and the crisp edge. Reduced to the mask's texel (a 16 by 16 box mean) the two agree: the mean
  // absolute difference is under .1, they correlate at over .9, and their mean opacity differs by under a quarter.
  const record = make(SEEDS[0]), region = regionOf(40, 10, 512, .022), layer = layerOf(record, region), mask = maskLayer(record, region), k = 16, m = region.n / k
  const reduce = l => { const out = new Float32Array(m * m); for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { let s = 0; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += l.data[(j * k + y) * region.n + i * k + x]; out[j * m + i] = s / (k * k) } return out }
  const a = reduce(layer), b = reduce(mask), ma = mean(a), mb = mean(b)
  let diff = 0, sab = 0, saa = 0, sbb = 0
  for (let q = 0; q < a.length; q++) { diff += Math.abs(a[q] - b[q]); sab += (a[q] - ma) * (b[q] - mb); saa += (a[q] - ma) ** 2; sbb += (b[q] - mb) ** 2 }
  assert.ok(diff / a.length <= .1, `the mean absolute difference is ${f(diff / a.length, 3)} (at most .1)`)
  assert.ok(sab / Math.sqrt(saa * sbb) >= .9, `the correlation is ${f(sab / Math.sqrt(saa * sbb), 3)} (at least .9)`)
  assert.ok(Math.abs(ma / mb - 1) <= .25, `the mean opacity is ${f(ma, 3)} against the mask’s ${f(mb, 3)} (within a quarter)`)
})

// ── no direction of its own ──────────────────────────────────────────────────────────────────────────────────────────────────

/** East-west and north-south gradient energy (the sum of |value two steps east - value two steps west| and of the same northward) of a function of the sphere's direction, on a tangent
 * grid of `n` by `n` equal steps of `step` radians about a latitude and longitude: sphere-corrected, so that equal steps are equal distances at every latitude. */
function gradients(field, lat0, lon0, n = 96, step = 2.5e-3) {
  const p0 = unit(lat0, lon0), east = [-p0[2], 0, p0[0]], el = Math.hypot(east[0], east[2]); east[0] /= el; east[2] /= el
  const north = [p0[1] * east[2] - p0[2] * east[1], p0[2] * east[0] - p0[0] * east[2], p0[0] * east[1] - p0[1] * east[0]]
  const at = (i, j) => { const q = [0, 1, 2].map(c => p0[c] + step * (i * east[c] + j * north[c])), l = Math.hypot(...q); return field(q[0] / l, q[1] / l, q[2] / l) }
  const grid = []
  for (let j = -n / 2; j <= n / 2; j++) { const row = []; for (let i = -n / 2; i <= n / 2; i++) row.push(at(i, j)); grid.push(row) }
  let ew = 0, ns = 0
  for (let j = 1; j < grid.length - 1; j++) for (let i = 1; i < grid[j].length - 1; i++) { ew += Math.abs(grid[j][i + 1] - grid[j][i - 1]); ns += Math.abs(grid[j + 1][i] - grid[j - 1][i]) }
  return {ew, ns}
}
const LONS = Array.from({length: 24}, (_, k) => 15 * k)
/** The east-west over north-south structure of a field at a latitude, pooled over 24 longitudes (one window holds a handful of features and its own ratio scatters by a third or more: the pool
 * is the field's), and the scatter of the windows' own ratios. */
function pooled(field, lat) {
  const windows = LONS.map(lon => gradients(field, lat, lon)), ratios = windows.map(w => w.ew / w.ns), mu = mean(ratios)
  return {ratio: windows.reduce((s, w) => s + w.ew, 0) / windows.reduce((s, w) => s + w.ns, 0), sd: Math.sqrt(mean(ratios.map(r => (r - mu) ** 2)))}
}

test('CW4 the cloud field has no direction of its own near the poles: from 65 to 80 degrees its east-west and north-south structure are equal, as an isotropic field’s are', () => {
  // Measured on sphere-corrected samples of the opacity the shader draws (the field through the opacity ramp, at 0.14 degree steps, a quarter of the mask's texel), pooled over 24 longitudes
  // at 65, 72 and 80 degrees. The band is derived from the field itself at the equator, where nothing is stretched by the sphere: the scatter of its windows' own ratios about their mean there
  // (a third of the mean or more: a window holds a handful of features), over the square root of the 72 windows pooled, four standard errors, at least .1. The estimator is first shown fair:
  // an isotropic field (simplex noise at 60 cycles to the radian) pooled the same way reads 1.00. A field sampled or curled in (longitude, latitude) is stretched by 1 / cos(latitude)
  // toward the pole and reads far from one there.
  const tables = noise.tablesOf(12345), isotropic = (x, y, z) => .5 + .5 * noise.simplex3(tables, x * 60, y * 60, z * 60)
  for (const lat of [65, 72, 80]) assert.ok(Math.abs(pooled(isotropic, lat).ratio - 1) <= .06, `an isotropic field pooled at ${lat} degrees reads ${f(pooled(isotropic, lat).ratio, 3)} (within .06 of one)`)
  for (const seed of SEEDS) {
    const record = make(seed), edge = weather.cloudEdge(seed, weather.cloudTarget(record.sky.clouds, 0)), field = (x, y, z) => weather.cloudCover(seed, edge, x, y, z, 0)
    const band = Math.max(.1, 4 * pooled(field, 0).sd / Math.sqrt(72))
    for (const lat of [65, 72, 80]) {
      const ratio = pooled(field, lat).ratio
      assert.ok(Math.abs(ratio - 1) <= band, `seed ${seed} at ${lat} degrees: east-west over north-south structure ${f(ratio, 3)} (one within ${f(band, 3)}, from the field’s own scatter at the equator)`)
    }
  }
})

test('CW5 the shear is not a streak: at the clock’s extremes the sheared sky is stretched along the parallels by no more than two fifths more than the sky unsheared, at 20 to 70 degrees', () => {
  // The wind carries the mask by a speed that differs with latitude (bodyWeather.ts): at the clock's greatest reach the shift between neighbouring latitudes is at most about two degrees to the
  // degree (weatherClock's bound, S5). Pooled over 24 longitudes, the field's east-west over north-south structure is .78 at the equator rising to 1.0 at the pole (its own elongation, by
  // design); sheared at the extremes it is .71 to .97, which is .78 to .95 of the unsheared at 20 to 65 degrees: the bound, a ratio of the two of at least .7, is two fifths more stretched.
  const record = make(SEEDS[0]), edge = weather.cloudEdge(record.seed, weather.cloudTarget(record.sky.clouds, 0))
  const extremes = [0, 0], reach = [0, 0]
  for (let day = 0; day < 120; day += .25) for (const [k, sign] of [[0, 1], [1, -1]]) { const c = sign * weather.weatherClock(record.seed, day * 86400000); if (c > reach[k]) { reach[k] = c; extremes[k] = day } }
  const at = day => (x, y, z) => weather.cloudCover(record.seed, edge, x, y, z, weather.weatherShift(record, Math.asin(y) / D2R, day * 86400000))
  const plain = (x, y, z) => weather.cloudCover(record.seed, edge, x, y, z, 0)
  for (const lat of [20, 40, 52, 65]) {
    const base = pooled(plain, lat).ratio
    for (const day of extremes) {
      const sheared = pooled(at(day), lat).ratio
      assert.ok(sheared / base >= .7, `at ${lat} degrees on day ${day} the ratio is ${f(sheared, 2)} against ${f(base, 2)} unsheared: ${f(sheared / base, 2)} of it (at least .7)`)
    }
  }
})

/** The mean local structure-tensor coherence of a field on a sphere-corrected tangent grid (80 by 80 steps of 3 milliradians, 8 by 8 windows of the two-step gradient): 0 where the
 * gradient points every way (a speckle), 1 where it points one way (a streak); pooled over 12 longitudes at a latitude. Orientation-independent: a streak that curls round a cyclone is
 * as coherent as one along a parallel, which the east-west over north-south ratio cannot see. */
function coherence(field, lat) {
  const n = 80, step = 3e-3, B = 8
  let sum = 0, count = 0
  for (let lon = 0; lon < 360; lon += 30) {
    const p0 = unit(lat, lon), east = [-p0[2], 0, p0[0]], el = Math.hypot(east[0], east[2]); east[0] /= el; east[2] /= el
    const north = [p0[1] * east[2] - p0[2] * east[1], p0[2] * east[0] - p0[0] * east[2], p0[0] * east[1] - p0[1] * east[0]]
    const at = (i, j) => { const q = [0, 1, 2].map(c => p0[c] + step * ((i - n / 2) * east[c] + (j - n / 2) * north[c])), l = Math.hypot(...q); return field(q[0] / l, q[1] / l, q[2] / l) }
    const grid = []
    for (let j = 0; j <= n; j++) { const row = []; for (let i = 0; i <= n; i++) row.push(at(i, j)); grid.push(row) }
    for (let j = 1; j + B < n; j += B) for (let i = 1; i + B < n; i += B) {
      let xx = 0, yy = 0, xy = 0
      for (let b = 0; b < B; b++) for (let a = 0; a < B; a++) { const x = grid[j + b][i + a + 1] - grid[j + b][i + a - 1], y = grid[j + b + 1][i + a] - grid[j + b - 1][i + a]; xx += x * x; yy += y * y; xy += x * y }
      const trace = xx + yy
      if (trace < 1e-6) continue
      sum += Math.sqrt((xx - yy) ** 2 + 4 * xy * xy) / trace; count++
    }
  }
  return sum / Math.max(1, count)
}

test('CW6 the sky is not streaked: the coherence of its structure is within two fifths of an isotropic field’s of the same scale, and the wind at its greatest adds up to a fifth more', () => {
  // The system view showed cloud streaks like a motion blur. The coherence of a field's gradient (0 speckle, 1 streak) at 3 milliradians a step, 8 by 8 windows, pooled over 12 longitudes: an
  // isotropic field at 25 cycles to the radian (the cloud field's third and fourth octaves, which set what a window holds) reads .50 (60 cycles: .29). The first sky read .74 to .77 unsheared at
  // 0 to 75 degrees and .76 to .83 sheared at the clock's extremes (the finest octaves, folded by a stretch of the sphere's y that left under two texels of the mask north-south at the equator, made
  // a comb of fine lines that the shear then carried); the bound is that reference and two fifths (.70), and with the wind at its greatest a fifth more of the unsheared (at most .20 above it).
  const tables = noise.tablesOf(12345), reference = pooled2(tables)
  assert.ok(Math.abs(reference - .5) <= .08, `the isotropic reference reads ${f(reference, 3)} (.5 within .08)`)
  const record = make(SEEDS[0]), edge = weather.cloudEdge(record.seed, weather.cloudTarget(record.sky.clouds, 0))
  const plain = (x, y, z) => weather.cloudCover(record.seed, edge, x, y, z, 0)
  const at = day => (x, y, z) => weather.cloudCover(record.seed, edge, x, y, z, weather.weatherShift(record, Math.asin(y) / D2R, day * 86400000))
  const extremes = [0, 0], reach = [0, 0]
  for (let day = 0; day < 120; day += .25) for (const [k, sign] of [[0, 1], [1, -1]]) { const c = sign * weather.weatherClock(record.seed, day * 86400000); if (c > reach[k]) { reach[k] = c; extremes[k] = day } }
  for (const lat of [20, 40, 52, 65]) {
    const base = coherence(plain, lat)
    assert.ok(base <= 1.4 * reference, `at ${lat} degrees the sky’s coherence is ${f(base, 3)} (at most ${f(1.4 * reference, 3)}: two fifths above an isotropic field’s ${f(reference, 3)})`)
    for (const day of extremes) { const sheared = coherence(at(day), lat); assert.ok(sheared - base <= .2, `at ${lat} degrees on day ${day} the wind adds ${f(sheared - base, 3)} (${f(base, 3)} to ${f(sheared, 3)}: at most .2)`) }
  }
})
function pooled2(tables) { return coherence((x, y, z) => .5 + .5 * noise.simplex3(tables, x * 25, y * 25, z * 25), 40) }
