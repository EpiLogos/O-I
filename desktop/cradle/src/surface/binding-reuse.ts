import type {SurfaceBinding} from "./types";

/** Reuse only the presentation requested by the caller. Factory state paths
 * and explicit review revisions qualify the owner ref; a matching Run label
 * or ref alone cannot substitute another retained source. */
export function matchesSurfaceRequest(surface:SurfaceBinding,requested:SurfaceBinding):boolean {
  if(surface.kind!==requested.kind||surface.ref!==requested.ref||surface.project!==requested.project)return false;
  if(requested.kind!=="factory-material"&&requested.kind!=="factory-handoff")return true;
  const held=surface.view?.factory, next=requested.view?.factory;
  if(held?.statePath!==next?.statePath||held?.runRef!==next?.runRef)return false;
  // Explicit material selection names its exact Build revision. A quiet
  // ingress reopen retains either held review until an explicit Refresh.
  return next?.expectedRevision===undefined
    ? true
    : held?.expectedRevision===next?.expectedRevision;
}
