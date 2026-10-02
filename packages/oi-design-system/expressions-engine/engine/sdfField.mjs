/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const SDF_GRID = 192;
const SDF_EXTENT = 300;
const SDF_DISTANCE_SCALE = 100;
const SDF_ATLAS_COLS = 2;
const SDF_ATLAS_ROWS = 10;
const SDF_TILE_U = 1 / SDF_ATLAS_COLS;
const SDF_TILE_V = 1 / SDF_ATLAS_ROWS;
const SDF_MAX_DISTANCE = 3;
const SDF_ATLAS_WIDTH = SDF_ATLAS_COLS * SDF_GRID;
const SDF_ATLAS_HEIGHT = SDF_ATLAS_ROWS * SDF_GRID;
const CHAMFER_DIAG = Math.SQRT2;
const CHAMFER_INF = 1e9;
function allocateEntitySlot(taken) {
  const used = /* @__PURE__ */ new Set();
  for (const t of taken) used.add(t);
  for (let i = 0; i < SDF_ATLAS_ROWS; i++) {
    if (!used.has(i)) return i;
  }
  return -1;
}
function stampCandidateMask(cands, scale = 1, thickness) {
  const mask = new Float32Array(SDF_GRID * SDF_GRID);
  const span = 2 * SDF_EXTENT;
  const stamp = 1.35;
  const stamp2 = stamp * stamp;
  const reach = Math.ceil(stamp);
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (!(c.density > 0.15)) continue;
    const fx = (c.x * scale / span + 0.5) * SDF_GRID;
    const fy = (c.y * scale / span + 0.5) * SDF_GRID;
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
function chamferSignedDistance(mask, size = SDF_GRID) {
  const dIn = new Float32Array(size * size).fill(CHAMFER_INF);
  const dOut = new Float32Array(size * size).fill(CHAMFER_INF);
  for (let i = 0; i < size * size; i++) {
    if (mask[i] > 0.5) dIn[i] = 0;
    else dOut[i] = 0;
  }
  const sweep = (d, x0, x1, y0, y1, sx, sy) => {
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
function buildSdfTile(cands, scale = 1) {
  const thickness = new Float32Array(SDF_GRID * SDF_GRID);
  const mask = stampCandidateMask(cands, scale, thickness);
  const signed = chamferSignedDistance(mask, SDF_GRID);
  const cellLocal = 2 * SDF_EXTENT / SDF_GRID;
  const tile = new Float32Array(SDF_GRID * SDF_GRID * 4);
  for (let i = 0; i < SDF_GRID * SDF_GRID; i++) {
    const d = Math.max(-SDF_MAX_DISTANCE, Math.min(SDF_MAX_DISTANCE, signed[i] * cellLocal / SDF_DISTANCE_SCALE));
    tile[i * 4] = d;
    tile[i * 4 + 1] = Math.min(SDF_MAX_DISTANCE, thickness[i] / SDF_DISTANCE_SCALE);
    tile[i * 4 + 3] = 1;
  }
  return tile;
}
function writeSdfTile(atlas, slot, which, tile) {
  const colOffset = which * SDF_GRID;
  for (let y = 0; y < SDF_GRID; y++) {
    const src = y * SDF_GRID * 4;
    const dst = ((slot * SDF_GRID + y) * SDF_ATLAS_WIDTH + colOffset) * 4;
    atlas.set(tile.subarray(src, src + SDF_GRID * 4), dst);
  }
}
export {
  SDF_ATLAS_COLS,
  SDF_ATLAS_HEIGHT,
  SDF_ATLAS_ROWS,
  SDF_ATLAS_WIDTH,
  SDF_DISTANCE_SCALE,
  SDF_EXTENT,
  SDF_GRID,
  SDF_MAX_DISTANCE,
  SDF_TILE_U,
  SDF_TILE_V,
  allocateEntitySlot,
  buildSdfTile,
  chamferSignedDistance,
  stampCandidateMask,
  writeSdfTile
};
