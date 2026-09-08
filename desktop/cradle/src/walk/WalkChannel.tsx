/**
 * The walk channel mount (U0.6, map §3 D10) — a null-rendering component
 * inside the KernelProvider that binds `window.__cradle.walk` to the LIVE
 * kernel API. Because it binds the provider's own `apply` queue, every
 * channel op is literally the same serialised KernelOp seam the surfaces
 * use — there is no second authority path to hold.
 *
 * This module is reached ONLY through the dynamically imported, build-gated
 * branch in Cradle.tsx: `vite serve` (dev) and `WALK=1 vite build` (the
 * walk bundle) mount it; a plain production build eliminates the import and
 * this chunk is never emitted (no `__cradle` string in dist — the grep
 * proof lives in walk/README.md).
 */

import { useEffect } from "react";
import { useKernel } from "../kernel/KernelProvider";
import { bindWalkChannel } from "../../walk/client";

export function WalkChannel({layout}:{layout:import("../surface/types").LayoutState}) {
  const kernel = useKernel();
  useEffect(() => {
    // Re-bind as the provider's memoised API is recreated; the channel
    // always speaks to the one live kernel.
    bindWalkChannel(kernel,()=>layout);
  }, [kernel,layout]);
  return null;
}
