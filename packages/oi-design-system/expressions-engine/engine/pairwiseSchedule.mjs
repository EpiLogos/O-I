/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const PAIRWISE_KEY_SENTINEL = 1e9;
const PAIRWISE_MAX_SORT_SIDE = 1024;
const PAIRWISE_MAX_PARTICLES = PAIRWISE_MAX_SORT_SIDE * PAIRWISE_MAX_SORT_SIDE;
const PAIRWISE_CELL_CAPACITY = 32;
const PAIRWISE_MAX_CELLS_PER_SIDE = 512;
const PAIRWISE_FORCE_SCALE = 8;
const PAIRWISE_MAX_SPEED_FRACTION = 0.02;
const PAIRWISE_SEARCH_ITERATIONS = 20;
const PAIRWISE_MIN_DELTA = 1e-4;
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
function sortSideForParticleTexSide(particleTexSide) {
  const side = nextPowerOfTwo(Math.max(1, Math.floor(particleTexSide)));
  return side <= PAIRWISE_MAX_SORT_SIDE ? side : null;
}
function bitonicSchedule(side) {
  if (side < 1 || (side & side - 1) !== 0) throw new Error("bitonicSchedule requires a power-of-two side");
  const n = side * side;
  const passes = [];
  if (n < 2) return passes;
  let block = 2;
  let stage = 1;
  for (; block <= n; block *= 2, stage++) {
    let partner = block / 2;
    let substage = 1;
    for (; partner >= 1; partner /= 2, substage++) {
      passes.push({ stage, substage, partner, block });
    }
  }
  return passes;
}
function compareExchangePass(keys, ids, partner, block) {
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const j = i ^ partner;
    if (j <= i || j >= n) continue;
    const asc = Math.floor(i / block) % 2 === 0;
    const swap = asc ? keys[i] > keys[j] : keys[i] < keys[j];
    if (!swap) continue;
    const k = keys[i], id = ids[i];
    keys[i] = keys[j];
    ids[i] = ids[j];
    keys[j] = k;
    ids[j] = id;
  }
}
function executeSortSchedule(keys, ids, side) {
  for (const p of bitonicSchedule(side)) compareExchangePass(keys, ids, p.partner, p.block);
}
function cellGridDims(extent, radius) {
  const e = Math.max(1, extent);
  const h = Math.max(1e-3, radius);
  const cellSize = Math.max(h, 2 * e / PAIRWISE_MAX_CELLS_PER_SIDE);
  const cellsX = Math.min(PAIRWISE_MAX_CELLS_PER_SIDE, Math.max(1, Math.ceil(2 * e / cellSize)));
  const cellsY = cellsX;
  return { cellSize, cellsX, cellsY };
}
function worldToCell(x, y, extent, grid) {
  const cx = Math.min(grid.cellsX - 1, Math.max(0, Math.floor((x + extent) / grid.cellSize)));
  const cy = Math.min(grid.cellsY - 1, Math.max(0, Math.floor((y + extent) / grid.cellSize)));
  return { cx, cy, key: cy * grid.cellsX + cx };
}
function cellKeyToCoords(key, grid) {
  return { cx: key % grid.cellsX, cy: Math.floor(key / grid.cellsX) };
}
function cellCenter(key, extent, grid) {
  const { cx, cy } = cellKeyToCoords(key, grid);
  return { x: (cx + 0.5) * grid.cellSize - extent, y: (cy + 0.5) * grid.cellSize - extent };
}
export {
  PAIRWISE_CELL_CAPACITY,
  PAIRWISE_FORCE_SCALE,
  PAIRWISE_KEY_SENTINEL,
  PAIRWISE_MAX_CELLS_PER_SIDE,
  PAIRWISE_MAX_PARTICLES,
  PAIRWISE_MAX_SORT_SIDE,
  PAIRWISE_MAX_SPEED_FRACTION,
  PAIRWISE_MIN_DELTA,
  PAIRWISE_SEARCH_ITERATIONS,
  bitonicSchedule,
  cellCenter,
  cellGridDims,
  cellKeyToCoords,
  compareExchangePass,
  executeSortSchedule,
  nextPowerOfTwo,
  sortSideForParticleTexSide,
  worldToCell
};
