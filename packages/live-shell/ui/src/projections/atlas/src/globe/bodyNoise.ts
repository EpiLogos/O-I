// The noise generator version 2 stands on (T-PROCEDURAL-BODY): seeded 3D simplex noise on the unit sphere's own coordinates, so there is no seam and no
// pole, with permutation tables made from the seed by a fixed integer generator (nothing here is random or reads a clock). Simplex noise after S. Gustavson's
// "Simplex noise demystified" (public domain): fewer corners than value noise (four, not eight), no axis-aligned blocks, and a gradient at every corner, so the
// shading of the relief that is cut from it has no lattice in it.
//
// Pure TypeScript, no DOM and no three.js: it runs in a worker.

export interface NoiseTables {
  readonly perm: Uint8Array
  /** the gradient index of each permutation entry, already times 3 (a row of the gradient table) */
  readonly grad: Uint8Array
}

/** Twelve gradient directions, the edge midpoints of a cube. */
const GRAD = new Float64Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1])
const F3 = 1 / 3
const G3 = 1 / 6

/** A 32-bit integer generator (Mulberry32): the same seed, the same stream, on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const made = new Map<number, NoiseTables>()

/** The permutation tables of a seed (made once and kept: a handful, the most recent). */
export function tablesOf(seed: number): NoiseTables {
  const key = seed >>> 0
  const hit = made.get(key)
  if (hit) return hit
  const next = mulberry32(key ^ 0x9e3779b9)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const t = p[i]!
    p[i] = p[j]!
    p[j] = t
  }
  const perm = new Uint8Array(512), grad = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]!
    grad[i] = (perm[i]! % 12) * 3
  }
  const tables = {perm, grad}
  if (made.size >= 8) made.delete(made.keys().next().value as number)
  made.set(key, tables)
  return tables
}

/** Simplex noise at a point, about −1 to 1 (the extremes are rare; the middle is flat enough that sums of it stay inside ±1 with room). */
export function simplex3(t: NoiseTables, xin: number, yin: number, zin: number): number {
  const perm = t.perm, grad = t.grad
  const s = (xin + yin + zin) * F3
  const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s)
  const u = (i + j + k) * G3
  const x0 = xin - (i - u), y0 = yin - (j - u), z0 = zin - (k - u)
  let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
  } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
  else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
  else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3
  const ii = i & 255, jj = j & 255, kk = k & 255
  let n = 0
  let a = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
  if (a > 0) { const g = grad[ii + perm[jj + perm[kk]!]!]!; a *= a; n += a * a * (GRAD[g]! * x0 + GRAD[g + 1]! * y0 + GRAD[g + 2]! * z0) }
  a = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
  if (a > 0) { const g = grad[ii + i1 + perm[jj + j1 + perm[kk + k1]!]!]!; a *= a; n += a * a * (GRAD[g]! * x1 + GRAD[g + 1]! * y1 + GRAD[g + 2]! * z1) }
  a = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
  if (a > 0) { const g = grad[ii + i2 + perm[jj + j2 + perm[kk + k2]!]!]!; a *= a; n += a * a * (GRAD[g]! * x2 + GRAD[g + 1]! * y2 + GRAD[g + 2]! * z2) }
  a = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
  if (a > 0) { const g = grad[ii + 1 + perm[jj + 1 + perm[kk + 1]!]!]!; a *= a; n += a * a * (GRAD[g]! * x3 + GRAD[g + 1]! * y3 + GRAD[g + 2]! * z3) }
  return 32 * n
}
