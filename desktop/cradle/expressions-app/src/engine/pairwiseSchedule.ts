/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure schedule + index math for the sorted-grid pairwise collision system.
 * No WebGL here: the bitonic network, cell-grid geometry and safety caps live in
 * this module so the GPU passes in GPGPUSimulator only execute this schedule and
 * the unit tests can execute the exact same compare-exchange semantics on CPU.
 *
 * Float-safety constraint: every value here must stay an exact integer <= 2**24
 * because the GPU shaders hold keys, particle indices and slot indices in
 * highp floats.
 */

export const PAIRWISE_KEY_SENTINEL = 1e9;      // pad keys sort to the very end
/** Sort render targets are padded power-of-two squares, capped at 1024x1024. */
export const PAIRWISE_MAX_SORT_SIDE = 1024;
export const PAIRWISE_MAX_PARTICLES = PAIRWISE_MAX_SORT_SIDE * PAIRWISE_MAX_SORT_SIDE;
/** Hard total-neighbour cap per particle per frame in the force pass. Glyph packing
 *  density puts hundreds of particles inside h; without a total cap the summed
 *  impulses explode the cloud (bounded work stays 9 x CAP slot visits). */
export const PAIRWISE_CELL_CAPACITY = 32;
/** Cell-table texture is capped at this many cells per axis (memory bound). */
export const PAIRWISE_MAX_CELLS_PER_SIDE = 512;
/** Separation spring scale mapping stiffness*overlap (px) into engine acceleration units. */
export const PAIRWISE_FORCE_SCALE = 8;
/** Fraction of fluid.maxSpeed a single-step pairwise velocity change may reach.
 *  Kept small: crowd piles must jostle, not launch (a frame at the default clamp
 *  is ~0.02 x 35000 = 700 px/s). */
export const PAIRWISE_MAX_SPEED_FRACTION = 0.02;
/** Binary search iterations over the sorted list: ceil(log2(1024**2)) = 20. */
export const PAIRWISE_SEARCH_ITERATIONS = 20;
/** Guarded denominator for impulse/dt terms. */
export const PAIRWISE_MIN_DELTA = 1e-4;

/** One compare-exchange draw of the bitonic network: uniforms (uPartner, uBlock). */
export interface PairwiseSortPass {
  stage: number;     // 1-based; sorted block size at this stage is 2**stage
  substage: number;  // 1-based; compare distance is 2**(stage - substage)
  partner: number;   // texel XOR distance (power of two)
  block: number;     // ascending/descending block (power of two)
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Sort texture side for a particle texture side: padded up to a power of two.
 * Returns null when the cap is hit (the system must disable itself for the frame).
 */
export function sortSideForParticleTexSide(particleTexSide: number): number | null {
  const side = nextPowerOfTwo(Math.max(1, Math.floor(particleTexSide)));
  return side <= PAIRWISE_MAX_SORT_SIDE ? side : null;
}

/**
 * The full bitonic ascending-sort network over side*side texels (side must be a
 * power of two): ceil(log2(n)) stages of up to log2(n) compare-exchange passes.
 * `partner`/`block` are exactly the shader uniforms of the single sort material.
 */
export function bitonicSchedule(side: number): PairwiseSortPass[] {
  if (side < 1 || (side & (side - 1)) !== 0) throw new Error('bitonicSchedule requires a power-of-two side');
  const n = side * side;
  const passes: PairwiseSortPass[] = [];
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

/**
 * CPU reference of the shader compare-exchange: every slot i looks at j = i XOR
 * partner; ascending blocks (floor(i / block) even) place the smaller key at the
 * lower slot, descending blocks the larger. Ties never swap, which preserves
 * (key, index) pairs exactly like the shader's index-based tie rule. Each pair
 * is handled once, from its lower slot (pairs are disjoint, so this equals the
 * GPU's parallel evaluation). `keys`/`ids` move together (the GPU sorts
 * (key, index) pairs in one texel).
 */
export function compareExchangePass(keys: number[], ids: number[], partner: number, block: number): void {
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const j = i ^ partner;
    if (j <= i || j >= n) continue;
    const asc = Math.floor(i / block) % 2 === 0;
    const swap = asc ? keys[i] > keys[j] : keys[i] < keys[j];
    if (!swap) continue;
    const k = keys[i], id = ids[i];
    keys[i] = keys[j]; ids[i] = ids[j];
    keys[j] = k; ids[j] = id;
  }
}

/** Execute the whole schedule in place: keys end ascending, ids follow their keys. */
export function executeSortSchedule(keys: number[], ids: number[], side: number): void {
  for (const p of bitonicSchedule(side)) compareExchangePass(keys, ids, p.partner, p.block);
}

export interface CellGrid {
  cellSize: number;
  cellsX: number;
  cellsY: number;
}

/**
 * Cell grid covering [-extent, extent]^2 in the composition plane. Cells are at
 * least the interaction radius h so the 3x3 neighbourhood always contains every
 * particle within h; the per-axis cap bounds the cell-table texture size.
 */
export function cellGridDims(extent: number, radius: number): CellGrid {
  const e = Math.max(1, extent);
  const h = Math.max(0.001, radius);
  const cellSize = Math.max(h, (2 * e) / PAIRWISE_MAX_CELLS_PER_SIDE);
  const cellsX = Math.min(PAIRWISE_MAX_CELLS_PER_SIDE, Math.max(1, Math.ceil((2 * e) / cellSize)));
  const cellsY = cellsX;
  return { cellSize, cellsX, cellsY };
}

/** World-plane coordinates -> clamped cell coords + row-major float key (exact <= 2**24). */
export function worldToCell(
  x: number,
  y: number,
  extent: number,
  grid: CellGrid
): { cx: number; cy: number; key: number } {
  const cx = Math.min(grid.cellsX - 1, Math.max(0, Math.floor((x + extent) / grid.cellSize)));
  const cy = Math.min(grid.cellsY - 1, Math.max(0, Math.floor((y + extent) / grid.cellSize)));
  return { cx, cy, key: cy * grid.cellsX + cx };
}

/** Row-major float key back to cell coords (GPU cell-table uv lookup helper). */
export function cellKeyToCoords(key: number, grid: CellGrid): { cx: number; cy: number } {
  return { cx: key % grid.cellsX, cy: Math.floor(key / grid.cellsX) };
}

/** Cell centre in world-plane coordinates (diagnostics/tuning helper). */
export function cellCenter(key: number, extent: number, grid: CellGrid): { x: number; y: number } {
  const { cx, cy } = cellKeyToCoords(key, grid);
  return { x: (cx + 0.5) * grid.cellSize - extent, y: (cy + 0.5) * grid.cellSize - extent };
}
