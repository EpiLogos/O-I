/**
 * The Journey instrument's registration (L5 Technē T5). Mounts the journey
 * surface through the Technē surface registry — composition, never
 * capability: availability stays the reading's own disclosure. Exports the
 * register/unregister function; shared seam files are not edited.
 */
import { registerTechneSurface } from "../registry";
import { JourneyInstrument } from "./JourneyInstrument";

/** Register the journey instrument surface. Returns the unregister function. */
export function registerJourneySurface(): () => void {
  return registerTechneSurface("journey", JourneyInstrument);
}
