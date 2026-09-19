/**
 * The wiki reading both Technè faces share (owner direction 2026-09-19):
 * one register per Central ground — Central itself and every disclosed
 * project — each read through the owner's own file seam, its wiki.json
 * carried verbatim. The navigator renders it as the left index; Instrument
 * 0 renders it as the wiki web the arrangement opens onto. No material is
 * required to be in the experience: the web IS the opening.
 */
export interface WikiSpace { object: "space"; ref: string; title?: string; node_refs?: string[]; child_space_refs?: string[]; revision?: number; anchor_ref?: string }
export interface WikiNode { object: "node"; ref: string; title?: string; type?: string; revision?: number; source_refs?: string[]; ql?: { face?: string; position?: number; unit?: string } }
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
