/**
 * Palace instrument registration (L5 Technē T6). Composition only: this
 * claims the 'palace' mount in the shared surface registry; capability stays
 * with the reading's disclosure. The integration composition root calls
 * `registerPalaceSurface()` once.
 */
import { registerTechneSurface } from "../registry";
import { PalaceInstrument } from "./PalaceInstrument";

export function registerPalaceSurface(): () => void {
  return registerTechneSurface("palace", PalaceInstrument);
}
