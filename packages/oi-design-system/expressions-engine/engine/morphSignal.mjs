const TAU = Math.PI * 2;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
function computeMorphDrive(tm, theta, phi) {
  const shape = tm.driveShape ?? "sine";
  const cycles = theta / TAU;
  const cycleIndex = Math.floor(cycles);
  const f = cycles - cycleIndex;
  let w;
  const tri = 1 - 4 * Math.abs(f - 0.5);
  switch (shape) {
    case "triangle":
      w = tri;
      break;
    case "smooth": {
      const u = (tri + 1) * 0.5;
      w = u * u * (3 - 2 * u) * 2 - 1;
      break;
    }
    case "pulse":
      w = Math.sin(theta) >= 0 ? 1 : -1;
      break;
    default:
      w = Math.sin(theta);
  }
  const hold = Math.max(0, Math.min(0.95, tm.holdRatio ?? 0));
  if (hold > 0) w = Math.max(-1, Math.min(1, w / (1 - hold)));
  const conj = Math.cos(phi + (tm.fiberPhaseOffset ?? 0));
  let signal;
  switch (tm.interference ?? "toroidalOnly") {
    case "product":
      signal = w * conj;
      break;
    case "sum":
      signal = (w + conj) * 0.5;
      break;
    case "beat":
      signal = w * (0.5 + 0.5 * conj);
      break;
    default:
      signal = w;
  }
  const depth = tm.driveDepth ?? 1;
  return { progress: clamp01(0.5 + 0.5 * depth * signal), theta, phi, signal, cycleIndex, cycleFraction: f };
}
export {
  computeMorphDrive
};
