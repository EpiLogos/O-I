/**
 * The timeline surface registration (L5 Technē T3) — mounts the Timeline
 * instrument into the shared Technē surface registry under `timeline`.
 * Registration is composition, never capability: availability still comes
 * only from each reading's own disclosure; an unregistered or unmounted
 * instrument shows the host's honest placeholder.
 *
 * DO NOT wire this from the shared files — the integration owner calls
 * `registerTimelineSurface()` once at composition time.
 */
import { registerTechneSurface } from "../registry";
import { TimelineInstrument } from "./TimelineInstrument";

export function registerTimelineSurface(): () => void {
  return registerTechneSurface("timeline", TimelineInstrument);
}
