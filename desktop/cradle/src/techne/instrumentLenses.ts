/**
 * The six Technē lens registrations (T3, 2026-09-19) — where the ported QL
 * M0′–M5′ instruments become lenses of the Technē mode through the parent
 * seam (lensMount.ts, the one registry the dual-mode HUD mounts through).
 *
 * One lens per instrument; a duplicate registration is a composition bug the
 * seam refuses. Identities and standing come from m0m5/lensDefs.ts (pure,
 * node-testable); the bodies here are:
 *
 *   M0′ project   WikiExpressionBody re-hosted as the ground lens
 *                 (m0m5/ProjectLens.tsx) — the REAL Wiki→Expression
 *                 projection, not rewritten;
 *   M1′–M5′       the ported QL instruments (m0m5/<name>/) seated by
 *                 m0m5/LensBody.tsx behind the four disclosure states.
 *
 * Registration is a side effect of importing this module: the surface
 * imports it once and the lenses stand in the mount registry.
 */
import type {ComponentType} from "react";
import {registerTechneLens, type TechneLens, type TechneLensBodyProps} from "./lensMount";
import {m0m5LensDefs, type M0M5LensId} from "./m0m5/lensDefs";
import {techneInstrumentBody} from "./m0m5/LensBody";
import {ProjectLensBody} from "./m0m5/ProjectLens";
import {CanvasConstellation} from "./m0m5/canvas/CanvasConstellation";
import {TimelineInstrument} from "./m0m5/timeline/TimelineInstrument";
import {JourneyInstrument} from "./m0m5/journey/JourneyInstrument";
import {PlaceInstrument} from "./m0m5/place/PlaceInstrument";
import {PalaceInstrument} from "./m0m5/palace/PalaceInstrument";

/** The body each lens mounts: M0′ the re-hosted Wiki projection; M1′–M5′ the
 * ported QL instruments behind the four-state seat. */
function m0m5LensBody(instrument: M0M5LensId, label: string): ComponentType<TechneLensBodyProps> {
  switch (instrument) {
    case "project": return ProjectLensBody;
    case "canvas": return techneInstrumentBody("canvas", label, CanvasConstellation);
    case "timeline": return techneInstrumentBody("timeline", label, TimelineInstrument);
    case "journey": return techneInstrumentBody("journey", label, JourneyInstrument);
    case "place": return techneInstrumentBody("place", label, PlaceInstrument);
    case "palace": return techneInstrumentBody("palace", label, PalaceInstrument);
  }
}

let registered = false;

/** Register the six M′ lenses (once per module instance). */
export function registerM0M5Lenses(): void {
  if (registered) return;
  registered = true;
  for (const def of m0m5LensDefs()) {
    const lens: TechneLens = {...def, Body: m0m5LensBody(def.instrument, def.label)};
    registerTechneLens(lens);
  }
}

registerM0M5Lenses();
