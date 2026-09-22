/**
 * The wiki reading both Technè faces share (owner direction 2026-09-19):
 * one register per Central ground — Central itself and every disclosed
 * project — each read through the owner's own file seam, its wiki.json
 * carried verbatim. The navigator renders it as the left index; Instrument
 * 0 renders it as the wiki web the arrangement opens onto. No material is
 * required to be in the experience: the web IS the opening.
 */
export interface WikiSpace { object: "space"; ref: string; title?: string; node_refs?: string[]; child_space_refs?: string[]; revision?: number; anchor_ref?: string }
/** A place a wiki node DECLARES about itself — the owner-supplied spatial
 * reading the M4′ producer (techne/placeFacets.ts) reads verbatim, never
 * inferred. It mirrors the owner-declarable subset of ql.techne/v1
 * TechnePlaceFacet (contract.ts); a declaration with no geometry is a real
 * place that is honestly unlocated, not an absent one. */
export interface WikiPlaceName { name: string; valid_from?: string | null; valid_to?: string | null }
export interface WikiPlaceGeometry { type: "point" | "polygon"; coordinates: unknown }
export interface WikiPlaceHierarchyEntry { place_ref: string; relation: string; valid_from?: string | null; valid_to?: string | null }
export interface WikiPlaceFacet {
  names?: WikiPlaceName[];
  geometry?: WikiPlaceGeometry;
  precision?: "exact" | "approximate" | "region" | "unlocated";
  uncertainty?: string | null;
  hierarchy?: WikiPlaceHierarchyEntry[];
  valid_from?: string | null;
  valid_to?: string | null;
  observer_frame?: string | null;
}
export interface WikiNode { object: "node"; ref: string; title?: string; type?: string; revision?: number; source_refs?: string[]; ql?: { face?: string; position?: number; unit?: string }; place?: WikiPlaceFacet }
export interface WikiConstellationMember { ref?: string; position?: number; conjugate?: boolean }
export interface WikiConstellation { anchor_ref?: string; members?: WikiConstellationMember[] }
export interface WikiFrame { object: "frame"; constellations?: WikiConstellation[] }
export type WikiObject = WikiSpace | WikiNode | WikiFrame;

export type WikiReading =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "ready"; spaces: WikiSpace[]; nodes: WikiNode[]; constellations: WikiConstellation[] }
  | { state: "absent" }
  | { state: "failed"; reason: string };

export function parseWiki(content: string): WikiReading {
  const parsed = JSON.parse(content) as { objects?: WikiObject[] };
  const objects = parsed.objects ?? [];
  return {
    state: "ready",
    spaces: objects.filter((entry): entry is WikiSpace => entry.object === "space"),
    nodes: objects.filter((entry): entry is WikiNode => entry.object === "node"),
    constellations: objects.filter((entry): entry is WikiFrame => entry.object === "frame")
      .flatMap(frame => frame.constellations ?? []),
  };
}

/** One register's wiki.json path on its ground. */
export function wikiPathForProject(projectPath: string | undefined): string {
  return projectPath
    ? `${projectPath}/ProjectCentral/agents/wiki/wiki.json`
    : "Control/agents/wiki/wiki.json";
}
