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
export interface WikiConstellationMember { ref?: string; position?: number; conjugate?: boolean; participation_ref?: string }
/** `title`/`question` are the containing frame's own authored inquiry
 * (`aikit.constellation/v1`), carried for presentation: a constellation is
 * named by what its author called it, never by its anchor's raw ref. */
export interface WikiConstellation { anchor_ref?: string; members?: WikiConstellationMember[]; frame_ref?: string; frame_revision?: number; title?: string; question?: string }
export interface WikiFrameConstruction { title?: unknown; inquiry?: { question?: unknown } }
export interface WikiFrame { object: "frame"; ref?: string; revision?: number; constellations?: WikiConstellation[]; "aikit.constellation/v1"?: WikiFrameConstruction }
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
      // Flattening is presentation only; keep the exact containing owner for
      // frame facts. An anchor is a different native subject, not a frame ID.
      .flatMap(frame => (frame.constellations ?? []).map(constellation => {
        const {frame_ref:_frameRef,frame_revision:_frameRevision,title:_title,question:_question,...value}=constellation;
        const construction = frame["aikit.constellation/v1"];
        const title = typeof construction?.title === "string" ? construction.title.trim() : "";
        const question = typeof construction?.inquiry?.question === "string" ? construction.inquiry.question.trim() : "";
        return {...value,
          ...(title ? {title} : {}),
          ...(question ? {question} : {}),
          ...(typeof frame.ref === "string" && frame.ref ? {frame_ref:frame.ref} : {}),
          ...(Number.isSafeInteger(frame.revision) && Number(frame.revision) > 0 ? {frame_revision:frame.revision} : {}),
          ...(constellation.members ? {members:constellation.members.map(member => {
            const {participation_ref:_participationRef,...value}=member;
            const native = (member as WikiConstellationMember & {'aikit.constellation-participation/v1'?: {participation_ref?: unknown}})['aikit.constellation-participation/v1'];
            return {...value,...(typeof native?.participation_ref === 'string' && native.participation_ref ? {participation_ref:native.participation_ref} : {})};
          })} : {}),
        };
      })),
  };
}

/** One register's wiki.json path on its ground. */
export function wikiPathForProject(projectPath: string | undefined): string {
  return projectPath
    ? `${projectPath}/ProjectCentral/agents/wiki/wiki.json`
    : "Control/agents/wiki/wiki.json";
}
