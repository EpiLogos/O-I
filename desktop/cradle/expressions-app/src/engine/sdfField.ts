/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Glyph signed-distance fields for the collision boundary system.
 *
 * A formation's candidate pool — the same points the particle targets are baked
 * from — is stamped into a coarse binary mask; a two-pass chamfer distance
 * transform turns the mask into a signed distance grid. Tiles are packed into a
 * single RGBA-float atlas (2 columns x 10 rows) so every formation's A/B states
 * upload as one texture at bake time and never change during steady-state frames.
 *
 * Units: the R channel stores distance in LOCAL glyph units / SDF_DISTANCE_SCALE
 * (negative inside strokes, positive outside). G stores the body's local
 * half-thickness in the same encoding, taken as the maximum over the candidates
 * stamped into each cell — the thickness envelope of the solid passing through
 * it. That is what lets the collision wall be the real 3D boundary of an
 * extruded letterform rather than a 2D silhouette that ignores depth. The grid
 * is deliberately coarse (192²): the boundary resolves shapes to about one
 * cell (≈3 local units), which is below the stipple scatter radius.
 */

export const SDF_GRID = 192; // tile side, cells
export const SDF_EXTENT = 300; // each tile covers ±SDF_EXTENT local glyph units
export const SDF_DISTANCE_SCALE = 100; // R = local units / SDF_DISTANCE_SCALE
export const SDF_ATLAS_COLS = 2; // state A | state B side by side
export const SDF_ATLAS_ROWS = 10; // one stable row per entity slot
export const SDF_TILE_U = 1 / SDF_ATLAS_COLS;
export const SDF_TILE_V = 1 / SDF_ATLAS_ROWS;
export const SDF_MAX_DISTANCE = 3; // clamp in R units (the full tile side)
export const SDF_ATLAS_WIDTH = SDF_ATLAS_COLS * SDF_GRID;
export const SDF_ATLAS_HEIGHT = SDF_ATLAS_ROWS * SDF_GRID;

export interface SdfCandidate {
  x: number;
  y: number;
  density: number;
  /** Local half-thickness of the 3D body at this cell (absent = flat). */
  hz?: number;
}

const CHAMFER_DIAG = Math.SQRT2;
const CHAMFER_INF = 1e9;

/**
 * Lowest free slot in [0, SDF_ATLAS_ROWS), or -1 when the atlas is full.
 * Slot assignment is caller-owned: a stable Map from entity id to slot keeps
 * tiles stationary across bakes.
 */
export function allocateEntitySlot(taken: Iterable<number>): number {
  const used = new Set<number>();
  for (const t of taken) used.add(t);
  for (let i = 0; i < SDF_ATLAS_ROWS; i++) {
    if (!used.has(i)) return i;
  }
  return -1;
}

/**
 * Binary occupancy grid of the candidate pool in final local glyph units.
 * Candidates are the authoritative shape for every source kind (glyph raster,
 * yantra, cymatic plate, primitive, image, ascii), so the boundary always
 * matches the baked targets exactly.
 *
 * `thickness` is filled with the maximum local half-thickness stamped into each
 * cell, so a later 3D boundary test can extrude the 2D section without needing
 * a second lookup. Cells no 3D candidate touches stay zero.
 */
export function stampCandidateMask(
  cands: readonly SdfCandidate[],
  scale = 1,
  thickness?: Float32Array
): Float32Array {
  const mask = new Float32Array(SDF_GRID * SDF_GRID);
  const span = 2 * SDF_EXTENT;
  const stamp = 1.35; // cells; keeps raster-thin strokes from eroding away
  const stamp2 = stamp * stamp;
  const reach = Math.ceil(stamp);
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (!(c.density > 0.15)) continue; // matches the sampling alpha gate
    const fx = ((c.x * scale) / span + 0.5) * SDF_GRID;
    const fy = ((c.y * scale) / span + 0.5) * SDF_GRID;
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    const hz = Math.max(0, (c.hz ?? 0) * scale);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx * dx + dy * dy > stamp2) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= SDF_GRID || y >= SDF_GRID) continue;
        const cell = y * SDF_GRID + x;
        mask[cell] = 1;
        if (thickness && hz > thickness[cell]) thickness[cell] = hz;
      }
    }
  }
  return mask;
}

/**
 * Two-pass 3x3 chamfer distance transform (weights 1, √2). Signed result in
 * cells: negative inside the mask, positive outside. An empty mask yields all
 * positive distances (no boundary anywhere).
 */
export function chamferSignedDistance(mask: Float32Array, size = SDF_GRID): Float32Array {
  const dIn = new Float32Array(size * size).fill(CHAMFER_INF);
  const dOut = new Float32Array(size * size).fill(CHAMFER_INF);
  for (let i = 0; i < size * size; i++) {
    if (mask[i] > 0.5) dIn[i] = 0;
    else dOut[i] = 0;
  }
  const sweep = (d: Float32Array, x0: number, x1: number, y0: number, y1: number, sx: number, sy: number) => {
    for (let y = y0; y !== y1; y += sy) {
      const row = y * size;
      for (let x = x0; x !== x1; x += sx) {
        const i = row + x;
        let v = d[i];
        const px = x - sx;
        const py = y - sy;
        if (px >= 0 && px < size) v = Math.min(v, d[i - sx] + 1);
        if (py >= 0 && py < size) {
          v = Math.min(v, d[i - sy * size] + 1);
          if (px >= 0 && px < size) v = Math.min(v, d[i - sy * size - sx] + CHAMFER_DIAG);
          const ppx = x + sx;
          if (ppx >= 0 && ppx < size) v = Math.min(v, d[i - sy * size + sx] + CHAMFER_DIAG);
        }
        d[i] = v;
      }
    }
  };
  sweep(dIn, 0, size, 0, size, 1, 1);
  sweep(dIn, size - 1, -1, size - 1, -1, -1, -1);
  sweep(dOut, 0, size, 0, size, 1, 1);
  sweep(dOut, size - 1, -1, size - 1, -1, -1, -1);
  const signed = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    signed[i] = dIn[i] - dOut[i];
  }
  return signed;
}

/**
 * Encoded RGBA tile: R = signed distance (local units / 100),
 * G = half-thickness (local units / 100), A = 1.
 */
export function buildSdfTile(cands: readonly SdfCandidate[], scale = 1): Float32Array {
  const thickness = new Float32Array(SDF_GRID * SDF_GRID);
  const mask = stampCandidateMask(cands, scale, thickness);
  const signed = chamferSignedDistance(mask, SDF_GRID);
  const cellLocal = (2 * SDF_EXTENT) / SDF_GRID;
  const tile = new Float32Array(SDF_GRID * SDF_GRID * 4);
  for (let i = 0; i < SDF_GRID * SDF_GRID; i++) {
    const d = Math.max(-SDF_MAX_DISTANCE, Math.min(SDF_MAX_DISTANCE, signed[i] * cellLocal / SDF_DISTANCE_SCALE));
    tile[i * 4] = d;
    tile[i * 4 + 1] = Math.min(SDF_MAX_DISTANCE, thickness[i] / SDF_DISTANCE_SCALE);
    tile[i * 4 + 3] = 1;
  }
  return tile;
}

/** Blit one encoded tile into the atlas at (slot, which 0=A | 1=B). */
export function writeSdfTile(atlas: Float32Array, slot: number, which: 0 | 1, tile: Float32Array): void {
  const colOffset = which * SDF_GRID;
  for (let y = 0; y < SDF_GRID; y++) {
    const src = y * SDF_GRID * 4;
    const dst = ((slot * SDF_GRID + y) * SDF_ATLAS_WIDTH + colOffset) * 4;
    atlas.set(tile.subarray(src, src + SDF_GRID * 4), dst);
  }
}
