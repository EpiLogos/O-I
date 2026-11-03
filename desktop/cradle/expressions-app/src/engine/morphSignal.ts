import type {ToroidalMorphConfig} from './types';
const TAU=Math.PI*2;const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
export interface MorphDriveState {
  progress: number;
  theta: number;
  phi: number;
  signal: number;        // -1..1 combined drive
  cycleIndex: number;    // floor(theta / 2π)
  cycleFraction: number; // 0..1 within the current toroidal cycle
}

/**
 * The unified morph control law: two conjugate phases (toroidal θ, poloidal φ) produce a
 * -1..1 interference signal that becomes the A→B morph progress. Pure and reusable by the UI.
 */
export function computeMorphDrive(tm: ToroidalMorphConfig, theta: number, phi: number): MorphDriveState {
  const shape = tm.driveShape ?? 'sine';
  const cycles = theta / TAU;
  const cycleIndex = Math.floor(cycles);
  const f = cycles - cycleIndex;
  let w: number;
  const tri = 1 - 4 * Math.abs(f - 0.5);
  switch (shape) {
    case 'triangle':
      w = tri;
      break;
    case 'smooth': {
      const u = (tri + 1) * 0.5;
      w = (u * u * (3 - 2 * u)) * 2 - 1;
      break;
    }
    case 'pulse':
      w = Math.sin(theta) >= 0 ? 1 : -1;
      break;
    default:
      w = Math.sin(theta);
  }
  const hold = Math.max(0, Math.min(0.95, tm.holdRatio ?? 0));
  if (hold > 0) w = Math.max(-1, Math.min(1, w / (1 - hold)));

  const conj = Math.cos(phi + (tm.fiberPhaseOffset ?? 0));
  let signal: number;
  switch (tm.interference ?? 'toroidalOnly') {
    case 'product':
      signal = w * conj;
      break;
    case 'sum':
      signal = (w + conj) * 0.5;
      break;
    case 'beat':
      signal = w * (0.5 + 0.5 * conj);
      break;
    default:
      signal = w;
  }
  const depth = tm.driveDepth ?? 1;
  return { progress: clamp01(0.5 + 0.5 * depth * signal), theta, phi, signal, cycleIndex, cycleFraction: f };
}

/**
 * The pulse as the morph's carrier (DLW §21.2 "The Torus in the pane": the morph is "timed by the pulse's two turnings, one round the
 * ring and one round the tube"; O-I 851). At a count of the Torus's pulse steps the torus has turned as QL's key-point law turns it
 * (janko.rs point): one step is a sixth of a turn round the ring (θ here, the toroidal phase: the cover angle mod 360°) and a twelfth of a
 * turn round the tube (φ, the poloidal phase: half the cover angle), so one return of twelve steps is the 720° cover. The phases run on
 * unwrapped, as the engine's own oscillators do.
 */
export function pulseTurnings(steps: number): {theta: number; phi: number} {
  return {theta: steps * Math.PI / 3, phi: steps * Math.PI / 6};
}
