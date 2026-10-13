/**
 * Provider disclosure for the Places surface (lane-4 T7). Pure: no DOM, no
 * maplibre import, so the surface reads these functions and `node --test`
 * loads them directly.
 *
 * Laws: every network-loaded pixel is attributed on the surface, and every
 * unavailable source names its owner's reason verbatim, never a reason of ours.
 * The reason shape is the depth chain's (`DepthState` in world.ts): an
 * availability, what is disclosed, and the honest reason when it is not.
 *
 * Erasable TypeScript: loadable by Vite, the surface and `node --test`.
 */
import type { DepthAvailability } from "../../../../../../../src/techne/m0m5/place/world";
import type { MapTileSource } from "./mapStyle";

/** One source on the surface, in the depth chain's reason shape. */
export interface SourceDisclosure {
  source: string;
  availability: DepthAvailability;
  disclosed: string[];
  /** Required when availability is not "disclosed": the owner's reason, verbatim. */
  reason: string | null;
}

/** The owner's statement for a hosted surface (PsychogeographicMap's `offlineOnly` prop). */
export const HOSTED_NETWORK_REASON =
  "Live sources stay off until you allow them.";

/** The live-service policy's own statement (geography policy.ts, its module header). */
export const OPT_IN_REASON =
  "Live services are explicit opt-in per surface and per action — no data leaves the machine unless the user consents to that specific action.";

/** The surface's own statement when no policy is mounted to consent through. */
export const NO_POLICY_REASON = "No live service policy is mounted on this surface.";

function unavailable(source: string, reason: string): SourceDisclosure {
  return { source, availability: "producer-unavailable", disclosed: [], reason };
}

/** The host of a live source's URL, for the readout; never a path or query. */
export function hostOf(url: string): string {
  try {
    const host = new URL(url).host;
    return host === "" ? "a live source" : host;
  } catch {
    return "a live source";
  }
}

/** Disclosure of the live basemap refresh. Offline-only surfaces, surfaces with
 * no policy, failed sources, un-consented sources each name their reason; a
 * consented, fetched source names its host and its attribution. */
export function liveTileDisclosure(input: {
  offlineOnly: boolean;
  hasPolicy: boolean;
  optedIn: boolean;
  liveSource: MapTileSource | null;
  /** The owner's own failure message from the renderer, verbatim. */
  failure: string | null;
}): SourceDisclosure {
  const source = "live basemap tiles";
  if (input.offlineOnly) return unavailable(source, HOSTED_NETWORK_REASON);
  if (!input.hasPolicy) return unavailable(source, NO_POLICY_REASON);
  if (input.failure !== null && input.failure !== "") return unavailable(source, input.failure);
  if (input.liveSource !== null) {
    return {
      source,
      availability: "disclosed",
      disclosed: [`fetching from ${hostOf(input.liveSource.url)}`, input.liveSource.attribution],
      reason: null,
    };
  }
  if (!input.optedIn) return unavailable(source, OPT_IN_REASON);
  return {
    source,
    availability: "disclosed",
    disclosed: ["opted in; no live tiles requested"],
    reason: null,
  };
}

/** The imagery readout: the live host while it is on screen, otherwise the bundled offline basemap. */
export function imageryReadout(bundled: MapTileSource, liveSource: MapTileSource | null): string {
  if (liveSource !== null) return `imagery: live tiles from ${hostOf(liveSource.url)}`;
  return `imagery: bundled offline basemap (${bundled.kind})`;
}

/** The attribution line: every distinct provider line, in the order given. */
export function attributionReadout(lines: readonly (string | null | undefined)[]): string {
  const unique: string[] = [];
  for (const line of lines) {
    const trimmed = line?.trim();
    if (trimmed && !unique.includes(trimmed)) unique.push(trimmed);
  }
  return unique.length > 0
    ? `Attribution: ${unique.join(" · ")}`
    : "Attribution: none disclosed for this surface";
}
