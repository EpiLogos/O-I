/**
 * Technē instrument bootstrap (L5 Technē integration) — the one composition
 * root that mounts the constellation's instrument surfaces. Registration is
 * composition, never capability: which instruments a subject actually
 * supports comes only from the reading's disclosure (wayfinder §2.1, §5).
 *
 * The M1′–M4′ embodiment path keeps K9's own registration discipline: the
 * focused-instrument OWNER source is the QL transport's to register (the
 * walk harness shows the pattern); `registerTechneFocusedInstrumentSource`
 * wraps it per selection and is wired where a live QL source exists.
 */
import { registerCanvasSurface } from "./canvas/register";
import { registerTimelineSurface } from "./timeline/register";
import { registerPlaceSurface } from "./place/register";
import { registerJourneySurface } from "./journey/register";
import { registerPalaceSurface } from "./palace/register";
import { registerProjectSurface } from "./project/register";
import { registerExpressionsSurface } from "./expressions/register";

export function registerTechneInstruments(): () => void {
  const unregister = [
    registerProjectSurface(),
    registerCanvasSurface(),
    registerTimelineSurface(),
    registerPlaceSurface(),
    registerJourneySurface(),
    registerPalaceSurface(),
    registerExpressionsSurface(),
  ];
  return () => unregister.splice(0).forEach((off) => off());
}
