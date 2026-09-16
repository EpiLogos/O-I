/**
 * The Canvas/Constellation registration (L5 Technē T2) — the one-lane seam
 * to the T0 surface registry. The integration owner calls
 * `registerCanvasSurface()` once at composition; it returns the unregister
 * function. Nothing shared is edited here.
 */
import { registerTechneSurface } from "../registry";
import { CanvasConstellation } from "./CanvasConstellation";

/** Mount the canvas instrument. Returns the unregister function. */
export function registerCanvasSurface(): () => void {
  return registerTechneSurface("canvas", CanvasConstellation);
}
