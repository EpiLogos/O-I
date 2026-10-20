// Planet-quality metrics (T-PROCEDURAL-BODY): what the eye reads as "a real planet" measured on an equirect RGBA image, so the
// generated body is held to the Earth's own numbers instead of to taste. Pure: no DOM, no GPU, no randomness.
//
// The image convention is the shell's (globe/body.ts BodyImage): row 0 is the north edge (lat +90), column 0 is longitude -180,
// `data` is RGBA bytes. Every measure weights or bounds by latitude so the equirect's stretching near the poles never counts as
// detail, and every measure is scale-aware: the Earth reference (tests/fixtures/planet-reference.json) is measured at the same
// width as the body under test.
//
// THIS FILE IS THE QUALITY BOUNDARY. Lanes building the generator do not edit it, the reference or the gate that reads them
// (tests/w3q-planet-gate.test.mjs): a change here is the lead's, and is argued in the ticket.

const D2R = Math.PI / 180

export const BAND = 60 // measures over land and sea stay within ±60° (the poles are measured by iceEdge on their own)

const lat = (j, h) => 90 - (j + .5) * 180 / h
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Luma 0–1 of an RGBA image, as a Float32Array. */
export function lumaPlane({width, height, data}) {
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i++) out[i] = (.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]) / 255
  return out
}

/** The cue EARTH_FRAG reads (shaders.ts waterOf): sea is blue well above red. 1 where the pixel is water. */
export function waterMask({width, height, data}, cut = .45) {
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4] / 255, b = data[i * 4 + 2] / 255
    out[i] = (b - r) / (b + .05) > cut ? 1 : 0
  }
  return out
}

/** Ice and snow: bright and unsaturated. */
export function iceMask({width, height, data}) {
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    out[i] = (.299 * r + .587 * g + .114 * b) / 255 > .78 && (mx - mn) / 255 < .16 ? 1 : 0
  }
  return out
}

/** A box blur of radius `r` on a plane (wrapping in longitude, clamped in latitude), by running sums. */
export function boxBlur(plane, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1
  for (let j = 0; j < h; j++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += plane[j * w + ((k % w) + w) % w]
    for (let i = 0; i < w; i++) {
      tmp[j * w + i] = sum / n
      sum += plane[j * w + ((i + r + 1) % w)] - plane[j * w + (((i - r) % w) + w) % w]
    }
  }
  for (let i = 0; i < w; i++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + i]
    for (let j = 0; j < h; j++) {
      out[j * w + i] = sum / n
      sum += tmp[Math.min(h - 1, j + r + 1) * w + i] - tmp[Math.max(0, j - r) * w + i]
    }
  }
  return out
}

/** Fine-scale detail: mean |L − blur_s(L)| over the pixels in `mask` (within ±BAND, weighted by cos(lat)), for each scale in px. A
 * smeared, blobby image is nearly flat at the small scales; a real surface keeps energy down to the pixel. */
export function detailEnergy(image, mask, scales = [1, 2, 4, 8]) {
  const {width: w, height: h} = image, L = lumaPlane(image)
  const out = {}
  for (const s of scales) {
    const B = boxBlur(L, w, h, s)
    let sum = 0, weight = 0
    for (let j = 0; j < h; j++) {
      const la = lat(j, h)
      if (Math.abs(la) > BAND) continue
      const wt = Math.cos(la * D2R)
      for (let i = 0; i < w; i++) {
        if (mask && !mask[j * w + i]) continue
        sum += Math.abs(L[j * w + i] - B[j * w + i]) * wt
        weight += wt
      }
    }
    out[s] = weight ? sum / weight : 0
  }
  return out
}


/** The same fine-scale detail for a local patch (a tile): mean |L − blur_s(L)| over every pixel, with no latitude band or weights. */
export function detailEnergyFlat(image, scales = [1, 2, 4, 8]) {
  const {width: w, height: h} = image, L = lumaPlane(image), out = {}
  for (const s of scales) {
    const B = boxBlur(L, w, h, s)
    let sum = 0
    for (let at = 0; at < w * h; at++) sum += Math.abs(L[at] - B[at])
    out[s] = sum / (w * h)
  }
  return out
}

/** Land and sea masks inside ±BAND (land: not water and not ice). */
function bands(image) {
  const {width: w, height: h} = image, water = waterMask(image), ice = iceMask(image)
  const land = new Uint8Array(w * h), sea = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    if (Math.abs(lat(j, h)) > BAND) continue
    for (let i = 0; i < w; i++) {
      const at = j * w + i
      if (water[at]) sea[at] = 1
      else if (!ice[at]) land[at] = 1
    }
  }
  return {land, sea}
}

/** Coast and islands inside ±BAND: how much shoreline there is (boundary pixels per pixel), and the land in pieces of at least a
 * hundredth of a percent of the image. A smooth blob has little shoreline and few pieces; a coast has both, at every scale. */
export function coastMeasure(image) {
  const {width: w, height: h} = image, {land} = bands(image)
  let boundary = 0, landPx = 0
  for (let j = 1; j < h - 1; j++) {
    if (Math.abs(lat(j, h)) > BAND) continue
    for (let i = 0; i < w; i++) {
      const at = j * w + i
      if (!land[at]) continue
      landPx++
      if (!land[at - w] || !land[at + w] || !land[j * w + ((i + 1) % w)] || !land[j * w + ((i + w - 1) % w)]) boundary++
    }
  }
  // connected pieces (4-neighbour, wrapping in longitude)
  const seen = new Uint8Array(w * h), minSize = Math.max(4, Math.floor(w * h * 1e-4)), sizes = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (!land[start] || seen[start]) continue
    let size = 0
    stack.length = 0; stack.push(start); seen[start] = 1
    while (stack.length) {
      const at = stack.pop(); size++
      const j = (at / w) | 0, i = at - j * w
      const around = [j > 0 ? at - w : -1, j < h - 1 ? at + w : -1, j * w + ((i + 1) % w), j * w + ((i + w - 1) % w)]
      for (const n of around) if (n >= 0 && land[n] && !seen[n]) { seen[n] = 1; stack.push(n) }
    }
    if (size >= minSize) sizes.push(size)
  }
  sizes.sort((a, b) => b - a)
  return {coastDensity: boundary / (w * h), landShare: landPx / (w * h), pieces: sizes.length, largestShare: sizes[0] ? sizes[0] / Math.max(1, landPx) : 0}
}

/** Palette richness of the land: the hue/saturation/value cells holding at least half a percent of it, and the entropy of the
 * land's colours over those cells. One flat green is 1; a world of deserts, forests, plains, rock and snow is many. */
export function paletteMeasure(image) {
  const {width: w, height: h, data} = image, {land} = bands(image), counts = new Map()
  let total = 0
  for (let at = 0; at < w * h; at++) {
    if (!land[at]) continue
    const r = data[at * 4] / 255, g = data[at * 4 + 1] / 255, b = data[at * 4 + 2] / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
    let hue = 0
    if (d > 1e-6) hue = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    const sat = mx ? d / mx : 0
    const key = `${Math.floor(hue * 2) % 12}:${sat < .25 ? 0 : sat < .55 ? 1 : 2}:${mx < .25 ? 0 : mx < .45 ? 1 : mx < .65 ? 2 : 3}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }
  let bins = 0, entropy = 0
  for (const n of counts.values()) {
    const p = n / total
    if (p >= .005) bins++
    entropy -= p * Math.log2(p)
  }
  return {bins, entropy}
}

/** How ragged the ice edge is. For each column, the latitude (from 45° poleward) where three ice pixels in a row first stand; the
 * spread of that latitude across the columns that have an edge, north and south averaged, in degrees, and how many columns have
 * one. A latitude ruler has spread 0; a real cap, sheet or sea-ice margin wanders. */
export function iceEdge(image) {
  const {width: w, height: h} = image, ice = iceMask(image)
  const north = [], south = []
  const row45n = Math.floor((90 - 45) * h / 180), row45s = h - 1 - row45n
  for (let i = 0; i < w; i++) {
    for (let j = row45n; j >= 2; j--) if (ice[j * w + i] && ice[(j - 1) * w + i] && ice[(j - 2) * w + i]) { north.push(lat(j, h)); break }
    for (let j = row45s; j <= h - 3; j++) if (ice[j * w + i] && ice[(j + 1) * w + i] && ice[(j + 2) * w + i]) { south.push(-lat(j, h)); break }
  }
  const sd = xs => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
  return {spreadDeg: (sd(north) + sd(south)) / 2, coverage: (north.length + south.length) / (2 * w)}
}

/** The sea floor's texture: the spread of the sea's luma once its broad tone is taken away (blur radius 16 px), over sea inside
 * ±BAND. A flat navy has none; bathymetry, shelves, ridges and trenches have some. */
export function seaTexture(image) {
  const {width: w, height: h} = image, L = lumaPlane(image), {sea} = bands(image), B = boxBlur(L, w, h, 16)
  let sum = 0, sum2 = 0, n = 0
  for (let at = 0; at < w * h; at++) {
    if (!sea[at]) continue
    const d = L[at] - B[at]
    sum += d; sum2 += d * d; n++
  }
  return n ? Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)) : 0
}

/** Distance in pixels from every pixel to the nearest pixel of `mask` (a 3-4 chamfer, wrapping in longitude). */
export function distanceTo(mask, w, h) {
  const d = new Float32Array(w * h).fill(1e9)
  for (let at = 0; at < w * h; at++) if (mask[at]) d[at] = 0
  const relax = (at, from, cost) => { if (from + cost < d[at]) d[at] = from + cost }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const at = j * w + i, l = (i + w - 1) % w, r = (i + 1) % w
    if (j > 0) { relax(at, d[at - w], 3); relax(at, d[(j - 1) * w + l], 4); relax(at, d[(j - 1) * w + r], 4) }
    relax(at, d[j * w + l], 3)
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const at = j * w + i, l = (i + w - 1) % w, r = (i + 1) % w
    if (j < h - 1) { relax(at, d[at + w], 3); relax(at, d[(j + 1) * w + l], 4); relax(at, d[(j + 1) * w + r], 4) }
    relax(at, d[j * w + r], 3)
  }
  for (let at = 0; at < w * h; at++) d[at] /= 3
  return d
}

/** The sea's shelf and its deep tone, by distance from land (over sea inside ±BAND, at the image's own pixels):
 *   nearOverDeep  the sea's luma within 3 px of land over its luma beyond 48 px (the shelf's brightness: a halo is many times the deep sea)
 *   reach         the distance in px at which the sea's luma has fallen halfway from its shore value to its deep value (how wide the shelf is)
 *   deepBroad     the spread of the deep sea (beyond 48 px of land) about its own tone over a 64 px box, as a share of its mean (basins
 *                 and swirls of abyss that the open sea does not have; the Earth's open sea changes slowly, with the latitude)
 * The Earth's shelf is narrow with a sharp edge; a soft bright halo round every coast, or a deep sea of dark swirls, is the tell of a
 * painted body. */
export function shelfMeasure(image) {
  const {width: w, height: h} = image, L = lumaPlane(image), {land, sea} = bands(image), d = distanceTo(land, w, h)
  const edges = [0, 3, 6, 12, 24, 48, 96, 1e9], centres = [1.5, 4.5, 9, 18, 36, 72, 140], sum = new Float64Array(7), n = new Float64Array(7)
  const deepMask = new Float32Array(w * h), deepL = new Float32Array(w * h)
  for (let at = 0; at < w * h; at++) {
    if (!sea[at]) continue
    for (let b = 0; b < 7; b++) if (d[at] > edges[b] && d[at] <= edges[b + 1]) { sum[b] += L[at]; n[b]++; break }
    if (d[at] > 48) { deepMask[at] = 1; deepL[at] = L[at] }
  }
  const profile = [...sum].map((s, b) => (n[b] ? s / n[b] : NaN)), nDeep = n[5] + n[6]
  if (!n[0] || !nDeep) return {nearOverDeep: NaN, reach: NaN, deepBroad: NaN}
  const near = profile[0], deep = (sum[5] + sum[6]) / nDeep, half = deep + (near - deep) / 2
  let reach = centres[6]
  for (let b = 0; b < 6; b++) if (profile[b] >= half && profile[b + 1] < half) { reach = centres[b] + (profile[b] - half) / (profile[b] - profile[b + 1]) * (centres[b + 1] - centres[b]); break }
  const tone = boxBlur(deepL, w, h, 64), share = boxBlur(deepMask, w, h, 64)
  let s2 = 0, c = 0, m = 0
  for (let at = 0; at < w * h; at++) if (deepMask[at] && share[at] > .5) { const x = L[at] - tone[at] / share[at]; s2 += x * x; m += L[at]; c++ }
  return {nearOverDeep: near / Math.max(deep, 1e-9), reach, deepBroad: c ? Math.sqrt(s2 / c) / Math.max(m / c, 1e-9) : NaN}
}

/** Seam integrity at the wrap: the difference across the ±180° meridian relative to the ordinary difference between neighbours at
 * the same place (column 0 to 1, and the last column to the one before it). 1 is invisible; much larger shows a line. */
export function seamRatio(image) {
  const {width: w, height: h} = image, L = lumaPlane(image)
  let across = 0, ordinary = 0
  for (let j = 0; j < h; j++) {
    if (Math.abs(lat(j, h)) > BAND) continue
    across += Math.abs(L[j * w] - L[j * w + w - 1])
    ordinary += (Math.abs(L[j * w + 1] - L[j * w]) + Math.abs(L[j * w + w - 1] - L[j * w + w - 2])) / 2
  }
  return across / Math.max(ordinary, 1e-9)
}

/** Every measure of one image, for the reference and the gate. */
export function measurePlanet(image) {
  const {land, sea} = bands(image)
  const landDetail = detailEnergy(image, land), seaDetail = detailEnergy(image, sea), coast = coastMeasure(image)
  return {
    width: image.width,
    landDetail, seaDetail,
    landTilt: landDetail[1] / Math.max(landDetail[8], 1e-9),
    seaTilt: seaDetail[1] / Math.max(seaDetail[8], 1e-9),
    coast: {...coast, perLand: coast.coastDensity / Math.max(coast.landShare, 1e-9)},
    palette: paletteMeasure(image),
    ice: iceEdge(image),
    seaTexture: seaTexture(image),
    shelf: shelfMeasure(image),
    seamRatio: seamRatio(image),
  }
}

/** Where a generated body falls short of the Earth's standard: the clauses of the gate, each against the Earth's own numbers
 * (`reference`, tests/fixtures/planet-reference.json `earth`, measured at the same width). Returns the clauses that fail, by name,
 * with the numbers; an empty list is a body that stands at the Earth's standard. Nothing here takes a threshold from taste: each is
 * a fraction or multiple of what the Earth measures, and the Earth itself passes every one.
 *
 *   opts.caps       the body has polar caps to speak of (ice_caps above ~.15): the ice-edge clauses apply
 *   opts.minPieces  the fewest separate lands expected (default 10; the Earth has 21; an archipelago has more)
 *   opts.shelf      false leaves the shelf clauses out (the gate runs them in a test of their own)
 */
export function assessPlanet(m, reference, opts = {}) {
  const e = reference, fails = []
  const need = (name, ok, detail) => { if (!ok) fails.push(`${name}: ${detail}`) }
  const f = x => (typeof x === 'number' ? +x.toFixed(4) : x)
  // fine detail on land and sea, at the pixel, and its fall-off across scales (blur fails the tilt's floor, white noise its ceiling)
  need('land detail at 1px', m.landDetail[1] >= .5 * e.landDetail[1] && m.landDetail[1] <= 2.5 * e.landDetail[1], `${f(m.landDetail[1])} not in [${f(.5 * e.landDetail[1])}, ${f(2.5 * e.landDetail[1])}]`)
  need('land tilt (E1/E8)', m.landTilt >= .6 * e.landTilt && m.landTilt <= 1.6 * e.landTilt, `${f(m.landTilt)} not in [${f(.6 * e.landTilt)}, ${f(1.6 * e.landTilt)}]`)
  need('land octave ratios', m.landDetail[1] / m.landDetail[2] <= .95 && m.landDetail[2] / m.landDetail[4] <= .95, `E1/E2 ${f(m.landDetail[1] / m.landDetail[2])}, E2/E4 ${f(m.landDetail[2] / m.landDetail[4])} must stay under .95 (white noise is flat across scales)`)
  need('sea detail at 1px', m.seaDetail[1] >= .5 * e.seaDetail[1] && m.seaDetail[1] <= 2.5 * e.seaDetail[1], `${f(m.seaDetail[1])} not in [${f(.5 * e.seaDetail[1])}, ${f(2.5 * e.seaDetail[1])}]`)
  need('sea tilt (E1/E8)', m.seaTilt >= .6 * e.seaTilt && m.seaTilt <= 1.6 * e.seaTilt, `${f(m.seaTilt)} not in [${f(.6 * e.seaTilt)}, ${f(1.6 * e.seaTilt)}]`)
  // the coast: shoreline per land pixel, and the land in pieces
  const perLand = e.coast.coastDensity / e.coast.landShare
  need('shoreline per land pixel', m.coast.perLand >= .6 * perLand && m.coast.perLand <= 3 * perLand, `${f(m.coast.perLand)} not in [${f(.6 * perLand)}, ${f(3 * perLand)}]`)
  need('separate lands', m.coast.pieces >= (opts.minPieces ?? 10), `${m.coast.pieces} under ${opts.minPieces ?? 10}`)
  // the land's colour
  need('palette cells', m.palette.bins >= .8 * e.palette.bins, `${m.palette.bins} under ${f(.8 * e.palette.bins)}`)
  need('palette entropy', m.palette.entropy >= .85 * e.palette.entropy, `${f(m.palette.entropy)} under ${f(.85 * e.palette.entropy)}`)
  // the ice margin wanders (a latitude ruler is the tell of a flat cutoff)
  if (opts.caps !== false) {
    need('ice edge spread', m.ice.spreadDeg >= .4 * e.ice.spreadDeg && m.ice.spreadDeg <= 3 * e.ice.spreadDeg, `${f(m.ice.spreadDeg)}° not in [${f(.4 * e.ice.spreadDeg)}, ${f(3 * e.ice.spreadDeg)}]`)
    need('ice edge coverage', m.ice.coverage >= .5, `${f(m.ice.coverage)} under .5`)
  }
  // the sea's shelf: narrow, not a bright halo; and an open sea that changes slowly (a measure absent from an older record is not judged)
  if (opts.shelf !== false && m.shelf && e.shelf) {
    const band = (name, x, lo, hi, ref) => need(name, Number.isFinite(x) && x >= lo * ref && x <= hi * ref, `${f(x)} not in [${f(lo * ref)}, ${f(hi * ref)}]`)
    band('shelf brightness (shore over deep sea)', m.shelf.nearOverDeep, .6, 1.5, e.shelf.nearOverDeep)
    band('shelf reach (px to half)', m.shelf.reach, .4, 1.6, e.shelf.reach)
    band('deep sea broad tone', m.shelf.deepBroad, .4, 1.35, e.shelf.deepBroad)
  }
  need('seam at ±180°', m.seamRatio <= 2, `${f(m.seamRatio)} over 2`)
  return fails
}

/** A box-filter downscale of an image by an integer factor (to compare an image with a reference at its own width). */
export function downscale({width, height, data}, k) {
  if (k === 1) return {width, height, data}
  const w = Math.floor(width / k), h = Math.floor(height / k), out = new Uint8ClampedArray(w * h * 4)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 4; c++) {
    let s = 0
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += data[((j * k + y) * width + i * k + x) * 4 + c]
    out[(j * w + i) * 4 + c] = s / (k * k)
  }
  return {width: w, height: h, data: out}
}

export const unit = clamp01
