/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure tiling math for the 3D shared medium: an N×N×N voxel volume packed into
 * an N²×N² texture as N×N tiles of N×N, where tile (tx, ty) holds the depth
 * slice z = tx + ty·N and texel = tile·N + (x, y). This module is the single
 * source of truth for the mapping the GLSL in mediumShaders.ts (and the 7C
 * coupling block in simulationShaders.ts) re-implements — the node tests pin
 * it here so the allocation math and the shader math cannot drift apart.
 *
 * Grid-size mapping: the volume derives its per-axis resolution from the same
 * gridRes parameter the 2D sheet uses, N = clamp(round(gridRes / 6), 16, 64).
 * The default gridRes 192 gives N = 32 — the packed texture is 1024², about
 * 16.8 MB of RGBA32F per solver target (five targets live: velocity ping-pong,
 * divergence, pressure ping-pong). The cap N ≤ 64 keeps the packed texture at
 * the 4096² guard: 4096² · 16 B ≈ 268 MB per target is the absolute ceiling,
 * and round(gridRes / 6) never reaches it below gridRes 1024.
 *
 * World mapping (mirrored in the shaders, never scaled differently): the volume
 * covers the sheet extent in its two media axes (x·y or x·z per uMediumPlane)
 * and a depth range of the same span centred on the field, so the volume is a
 * cube: [-extent, +extent] on every media axis, depth centred on 0.
 */

/** Coarsest solvable volume axis (packed texture side 16² = 256 texels). */
export const MEDIUM3_MIN_N = 16;
/** Finest volume axis; N² ≤ 4096 keeps every solver texture inside the guard. */
export const MEDIUM3_MAX_N = 64;

/** Voxels per axis of the 3D medium for a 2D `gridRes` setting. */
export function mediumVolumeSideFor(gridRes: number): number {
  const res = Math.max(16, Math.min(1024, Math.round(gridRes)));
  // One depth cell per ~6 in-plane cells: the volume stays coarse enough to
  // solve every frame while the sheet remains the resolution reference.
  const n = Math.round(res / 6);
  return Math.max(MEDIUM3_MIN_N, Math.min(MEDIUM3_MAX_N, n));
}

/** Side of the packed 2D texture holding the whole N³ volume. */
export function mediumVolumeTextureSide(n: number): number {
  return n * n;
}

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

export interface Texel {
  tx: number;
  ty: number;
}

/** Clamp a voxel coordinate into the volume: edge cells repeat (free-slip wall — the 3D twin of the 2D clamp-to-edge texel). */
export function mediumVoxelClamp(n: number, x: number, y: number, z: number): Voxel {
  const m = n - 1;
  return {
    x: Math.max(0, Math.min(m, x)),
    y: Math.max(0, Math.min(m, y)),
    z: Math.max(0, Math.min(m, z)),
  };
}

/** Which N×N tile (depth slice) a z index lands in: slices run over [0, N²−1]. */
export function mediumSliceTile(n: number, z: number): Texel {
  const clamped = Math.max(0, Math.min(n * n - 1, Math.round(z)));
  return { tx: clamped % n, ty: Math.floor(clamped / n) };
}

/** Integer texel of the packed texture for a voxel (coordinates within [0, n)). */
export function mediumVoxelTexel(n: number, x: number, y: number, z: number): Texel {
  const tile = mediumSliceTile(n, z);
  return { tx: tile.tx * n + Math.floor(x), ty: tile.ty * n + Math.floor(y) };
}

/** UV of a voxel's texel centre in the packed texture. */
export function mediumVoxelUv(n: number, x: number, y: number, z: number): { u: number; v: number } {
  const t = mediumVoxelTexel(n, x, y, z);
  const side = mediumVolumeTextureSide(n);
  return { u: (t.tx + 0.5) / side, v: (t.ty + 0.5) / side };
}

/** Inverse of mediumVoxelUv: continuous voxel coordinates for a packed-texture UV (texel centres land back on integer voxels). */
export function mediumUvToVoxel(n: number, u: number, v: number): Voxel {
  const side = mediumVolumeTextureSide(n);
  const tx = Math.max(0, Math.min(side - 1, Math.floor(u * side)));
  const ty = Math.max(0, Math.min(side - 1, Math.floor(v * side)));
  const tileX = Math.floor(tx / n);
  const tileY = Math.floor(ty / n);
  return { x: tx - tileX * n, y: ty - tileY * n, z: tileX + tileY * n };
}

/**
 * The eight trilinear corner weights for a fractional in-cell position
 * (fx, fy, fz ∈ [0,1]), ordered (000, 100, 010, 110, 001, 101, 011, 111) —
 * the same order the GLSL mix chains in mediumShaders.ts apply. The weights
 * are a partition of unity, so splatted mass and sampled fields are conserved.
 */
export function mediumTrilinearWeights(fx: number, fy: number, fz: number): number[] {
  const w0 = 1 - fx;
  const w1 = 1 - fy;
  const w2 = 1 - fz;
  return [
    w0 * w1 * w2,
    fx * w1 * w2,
    w0 * fy * w2,
    fx * fy * w2,
    w0 * w1 * fz,
    fx * w1 * fz,
    w0 * fy * fz,
    fx * fy * fz,
  ];
}

/**
 * Splat slice weighting for one particle at continuous depth voxel `fz` and
 * slice offset `offset` (draws run at -1, 0, +1): the hat kernel partitions
 * the particle's momentum across its 2–3 nearest slices with total weight 1,
 * and weights reach exactly 0 once the slice is a full cell away. The weight
 * is measured against the unclamped target slice, exactly as the splat vertex
 * shader does: a virtual slice past the volume wall folds onto the edge cell
 * (free-slip) instead of leaking beyond it, and a full cell away contributes
 * nothing.
 */
export function mediumSplatSliceWeight(fz: number, n: number, offset: number): number {
  const target = Math.round(fz) + offset;
  return Math.max(0, 1 - Math.abs(fz - target));
}
