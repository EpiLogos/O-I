/**
 * The Story instrument's registration (L5 Technē T5). Mounts the story
 * surface through the Technē surface registry — composition, never
 * capability: availability stays the reading's own disclosure. Exports the
 * register/unregister function; shared seam files are not edited.
 */
import { registerTechneSurface } from "../registry";
import { StoryInstrument } from "./StoryInstrument";

/** Register the story instrument surface. Returns the unregister function. */
export function registerStorySurface(): () => void {
  return registerTechneSurface("story", StoryInstrument);
}
