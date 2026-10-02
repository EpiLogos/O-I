/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const MEDIUM3_MIN_N = 16;
const MEDIUM3_MAX_N = 64;
function mediumVolumeSideFor(gridRes) {
  const res = Math.max(16, Math.min(1024, Math.round(gridRes)));
  const n = Math.round(res / 6);
  return Math.max(MEDIUM3_MIN_N, Math.min(MEDIUM3_MAX_N, n));
}
function mediumVolumeTextureSide(n) {
  return n * n;
}
function mediumVoxelClamp(n, x, y, z) {
  const m = n - 1;
  return {
    x: Math.max(0, Math.min(m, x)),
    y: Math.max(0, Math.min(m, y)),
    z: Math.max(0, Math.min(m, z))
  };
}
function mediumSliceTile(n, z) {
  const clamped = Math.max(0, Math.min(n * n - 1, Math.round(z)));
  return { tx: clamped % n, ty: Math.floor(clamped / n) };
}
function mediumVoxelTexel(n, x, y, z) {
  const tile = mediumSliceTile(n, z);
  return { tx: tile.tx * n + Math.floor(x), ty: tile.ty * n + Math.floor(y) };
}
function mediumVoxelUv(n, x, y, z) {
  const t = mediumVoxelTexel(n, x, y, z);
  const side = mediumVolumeTextureSide(n);
  return { u: (t.tx + 0.5) / side, v: (t.ty + 0.5) / side };
}
function mediumUvToVoxel(n, u, v) {
  const side = mediumVolumeTextureSide(n);
  const tx = Math.max(0, Math.min(side - 1, Math.floor(u * side)));
  const ty = Math.max(0, Math.min(side - 1, Math.floor(v * side)));
  const tileX = Math.floor(tx / n);
  const tileY = Math.floor(ty / n);
  return { x: tx - tileX * n, y: ty - tileY * n, z: tileX + tileY * n };
}
function mediumTrilinearWeights(fx, fy, fz) {
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
    fx * fy * fz
  ];
}
function mediumSplatSliceWeight(fz, n, offset) {
  const target = Math.round(fz) + offset;
  return Math.max(0, 1 - Math.abs(fz - target));
}
export {
  MEDIUM3_MAX_N,
  MEDIUM3_MIN_N,
  mediumSliceTile,
  mediumSplatSliceWeight,
  mediumTrilinearWeights,
  mediumUvToVoxel,
  mediumVolumeSideFor,
  mediumVolumeTextureSide,
  mediumVoxelClamp,
  mediumVoxelTexel,
  mediumVoxelUv
};
